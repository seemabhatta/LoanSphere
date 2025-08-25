import express from "express";
import { SampleDataGenerator, FixtureLoader } from "./sample-data-generator";
import { storage } from "../storage";
import { documentSearch } from "../database-config";

const router = express.Router();

// Generate synthetic data endpoints
router.post("/generate/loans/:count", async (req, res) => {
  try {
    const count = parseInt(req.params.count) || 5;
    await SampleDataGenerator.generateLoanPipeline(count);
    res.json({ 
      success: true, 
      message: `Generated ${count} synthetic loans with complete pipeline data`,
      count 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate/scenarios", async (req, res) => {
  try {
    await SampleDataGenerator.generateTestScenarios();
    res.json({ 
      success: true, 
      message: "Generated realistic test scenarios"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/load/fixtures", async (req, res) => {
  try {
    await FixtureLoader.loadBusinessRules();
    await FixtureLoader.loadAgencyConfigs();
    res.json({ 
      success: true, 
      message: "Loaded business rules and agency configurations"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Individual data generators
router.post("/generate/loan", async (req, res) => {
  try {
    const overrides = req.body;
    const loanData = SampleDataGenerator.generateLoan(overrides);
    const loan = await storage.createLoan(loanData);
    res.json({ success: true, loan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate/exception/:loanId", async (req, res) => {
  try {
    const { loanId } = req.params;
    const overrides = req.body;
    
    const loan = await storage.getLoan(loanId);
    if (!loan) {
      return res.status(404).json({ error: "Loan not found" });
    }
    
    const exceptionData = SampleDataGenerator.generateException(loanId, loan.xpLoanNumber, overrides);
    const exception = await storage.createException(exceptionData);
    res.json({ success: true, exception });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate/document/:loanId", async (req, res) => {
  try {
    const { loanId } = req.params;
    const overrides = req.body;
    
    const loan = await storage.getLoan(loanId);
    if (!loan) {
      return res.status(404).json({ error: "Loan not found" });
    }
    
    const docData = SampleDataGenerator.generateDocument(loanId, loan.xpLoanNumber, overrides);
    const document = await storage.createDocument(docData);
    
    // Index in OpenSearch
    await documentSearch.indexDocument(document.id, {
      loanId: loan.id,
      xpLoanNumber: loan.xpLoanNumber,
      documentType: document.documentType,
      content: `Sample content for ${document.documentType} document`,
      extractedData: JSON.parse(document.extractedData || "{}"),
      ocrConfidence: 0.85 + Math.random() * 0.15
    });
    
    res.json({ success: true, document });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Data staging endpoints
router.post("/stage/commitment", async (req, res) => {
  try {
    const commitmentData = req.body;
    
    // Validate commitment data structure
    if (!commitmentData.commitmentId || !commitmentData.investorLoanNumber) {
      return res.status(400).json({ error: "Missing required commitment fields" });
    }
    
    // Create loan from commitment
    const loanData = {
      xpLoanNumber: commitmentData.investorLoanNumber,
      tenantId: "staged_commitment",
      commitmentId: commitmentData.commitmentId,
      commitmentDate: new Date(commitmentData.commitmentDate).getTime(),
      expirationDate: new Date(commitmentData.expirationDate).getTime(),
      currentCommitmentAmount: commitmentData.currentCommitmentAmount,
      product: commitmentData.product?.productType,
      sellerName: `Seller ${commitmentData.sellerNumber}`,
      sellerNumber: commitmentData.sellerNumber,
      servicerNumber: commitmentData.servicerNumber,
      status: "staged",
      boardingReadiness: "pending",
      metadata: JSON.stringify({
        source: "commitment_staging",
        stagedAt: new Date().toISOString(),
        originalData: commitmentData
      })
    };
    
    const loan = await storage.createLoan(loanData);
    res.json({ success: true, loan, message: "Commitment data staged successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Staging status and management
router.get("/staged/summary", async (req, res) => {
  try {
    const loans = await storage.getLoans();
    const stagedLoans = loans.filter(loan => 
      loan.status === "staged" || loan.boardingReadiness === "data_received"
    );
    
    const summary = {
      totalStaged: stagedLoans.length,
      bySource: stagedLoans.reduce((acc, loan) => {
        const metadata = JSON.parse(loan.metadata || "{}");
        const source = metadata.source || "unknown";
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {}),
      readyForBoarding: stagedLoans.filter(loan => 
        loan.boardingReadiness === "data_received"
      ).length
    };
    
    res.json({ success: true, summary, stagedLoans });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

export { router as stagingAPI };