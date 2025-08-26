import express from "express";
import { storage } from "../storage";
import { documentSearch } from "../database-config";
import { commitmentStorage } from "../commitment-storage";

const router = express.Router();


// Data staging endpoints
router.post("/stage/commitment", async (req, res) => {
  try {
    const commitmentData = req.body;
    
    console.log("Received commitment data:", JSON.stringify(commitmentData, null, 2));
    
    // Validate commitment data structure - handle nested structure
    const commitmentId = commitmentData.commitmentId || commitmentData.commitmentData?.commitmentId;
    const investorLoanNumber = commitmentData.investorLoanNumber || commitmentData.commitmentData?.investorLoanNumber;
    
    console.log("Extracted values:", { commitmentId, investorLoanNumber });
    
    if (!commitmentId && !investorLoanNumber) {
      return res.status(400).json({ 
        error: "Missing required commitment fields",
        received: { commitmentId, investorLoanNumber },
        data: commitmentData
      });
    }
    
    // Use fallback values if only one is missing
    const finalCommitmentId = commitmentId || `GEN_${Date.now()}`;
    const finalLoanNumber = investorLoanNumber || `LN_${Date.now()}`;
    
    // Store in NoSQL commitment storage
    const agency = detectAgency(commitmentData);
    const commitment = await commitmentStorage.storeCommitment(commitmentData, agency);
    
    // Also create loan from commitment for pipeline processing
    const actualCommitmentData = commitmentData.commitmentData || commitmentData;
    const loanData = {
      xpLoanNumber: finalLoanNumber,
      tenantId: "staged_commitment",
      commitmentId: finalCommitmentId,
      commitmentDate: actualCommitmentData.commitmentDate ? new Date(actualCommitmentData.commitmentDate).getTime() : Date.now(),
      expirationDate: actualCommitmentData.expirationDate ? new Date(actualCommitmentData.expirationDate).getTime() : Date.now() + 90 * 24 * 60 * 60 * 1000,
      currentCommitmentAmount: actualCommitmentData.currentCommitmentAmount || 0,
      product: actualCommitmentData.product?.productType || "Unknown",
      sellerName: actualCommitmentData.sellerNumber ? `Seller ${actualCommitmentData.sellerNumber}` : "Unknown Seller",
      sellerNumber: actualCommitmentData.sellerNumber || null,
      servicerNumber: actualCommitmentData.servicerNumber || null,
      status: "staged",
      boardingReadiness: "data_received",
      metadata: JSON.stringify({
        source: "commitment_staging",
        stagedAt: new Date().toISOString(),
        commitmentDocumentId: commitment.id,
        agency: agency,
        originalData: commitmentData
      })
    };
    
    const loan = await storage.createLoan(loanData);
    res.json({ 
      success: true, 
      loan, 
      commitment,
      agency,
      message: "Commitment data staged successfully in NoSQL storage" 
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/stage/uldd", async (req, res) => {
  try {
    const ulddData = req.body;
    
    // Find existing loan or create new one
    let loan = await storage.getLoanByXpNumber(ulddData.loanIdentifier?.originalLoanNumber);
    
    if (!loan) {
      // Create new loan from ULDD
      const loanData = {
        xpLoanNumber: ulddData.loanIdentifier.originalLoanNumber,
        tenantId: "staged_uldd",
        noteAmount: ulddData.loanDetails?.noteAmount,
        interestRate: ulddData.loanDetails?.interestRate,
        propertyValue: ulddData.property?.appraisedValue,
        ltvRatio: ulddData.property?.ltvRatio,
        creditScore: ulddData.borrower?.creditScore,
        status: "staged",
        boardingReadiness: "data_received",
        metadata: JSON.stringify({
          source: "uldd_staging",
          stagedAt: new Date().toISOString(),
          originalData: ulddData
        })
      };
      
      loan = await storage.createLoan(loanData);
    } else {
      // Update existing loan with ULDD data
      const updates = {
        noteAmount: ulddData.loanDetails?.noteAmount || loan.noteAmount,
        interestRate: ulddData.loanDetails?.interestRate || loan.interestRate,
        propertyValue: ulddData.property?.appraisedValue || loan.propertyValue,
        ltvRatio: ulddData.property?.ltvRatio || loan.ltvRatio,
        creditScore: ulddData.borrower?.creditScore || loan.creditScore,
        boardingReadiness: "data_received",
        metadata: JSON.stringify({
          ...JSON.parse(loan.metadata || "{}"),
          ulddUpdate: {
            stagedAt: new Date().toISOString(),
            originalData: ulddData
          }
        })
      };
      
      loan = await storage.updateLoan(loan.id, updates);
    }
    
    res.json({ success: true, loan, message: "ULDD data staged successfully" });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Staging status and management
router.get("/staged/summary", async (req, res) => {
  try {
    const loans = await storage.getLoans();
    const stagedLoans = loans.filter(loan => 
      loan.status === "staged" || loan.boardingReadiness === "data_received"
    );
    
    // Get commitment storage summary
    const commitmentSummary = await commitmentStorage.getSummary();
    
    const summary = {
      totalStaged: stagedLoans.length,
      bySource: stagedLoans.reduce((acc, loan) => {
        const metadata = JSON.parse(loan.metadata || "{}");
        const source = metadata.source || "unknown";
        acc[source] = ((acc as any)[source] || 0) + 1;
        return acc;
      }, {}),
      readyForBoarding: stagedLoans.filter(loan => 
        loan.boardingReadiness === "data_received"
      ).length,
      commitments: commitmentSummary
    };
    
    res.json({ success: true, summary, stagedLoans });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/staged/:loanId/promote", async (req, res) => {
  try {
    const { loanId } = req.params;
    
    const loan = await storage.updateLoan(loanId, {
      status: "pending",
      boardingStatus: "ready_to_start",
      boardingReadiness: "ready"
    });
    
    if (!loan) {
      return res.status(404).json({ error: "Loan not found" });
    }
    
    res.json({ 
      success: true, 
      loan, 
      message: "Loan promoted to active boarding pipeline" 
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Clear staging data
router.delete("/staged/clear", async (req, res) => {
  try {
    const loans = await storage.getLoans();
    const stagedLoans = loans.filter(loan => loan.status === "staged");
    
    let deletedCount = 0;
    for (const loan of stagedLoans) {
      await storage.deleteLoan(loan.id);
      deletedCount++;
    }
    
    res.json({ 
      success: true, 
      message: `Cleared ${deletedCount} staged loans`,
      deletedCount 
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Helper function to detect agency from commitment data
function detectAgency(commitmentData: any): string {
  const data = commitmentData.commitmentData || commitmentData;
  
  if (data.commitmentId?.startsWith("FNMA")) return "fannie_mae";
  if (data.commitmentId?.startsWith("FHLMC")) return "freddie_mac";
  if (data.commitmentId?.startsWith("GNMA")) return "ginnie_mae";
  
  // Check other indicators
  if (data.agency) return data.agency.toLowerCase().replace(/ /g, "_");
  if (data.investor) return data.investor.toLowerCase().replace(/ /g, "_");
  
  return "unknown";
}

// Get commitment data endpoints
router.get("/commitments", async (req, res) => {
  try {
    const commitments = await commitmentStorage.getAllCommitments();
    res.json({ success: true, commitments });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get("/commitments/summary", async (req, res) => {
  try {
    const summary = await commitmentStorage.getSummary();
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get("/commitments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const commitment = await commitmentStorage.getByCommitmentId(id);
    
    if (!commitment) {
      return res.status(404).json({ error: "Commitment not found" });
    }
    
    res.json({ success: true, commitment });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as stagingAPI };