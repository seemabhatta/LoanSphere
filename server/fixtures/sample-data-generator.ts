import { randomUUID } from "crypto";
import { storage } from "../storage";
import { configDB, documentSearch } from "../database-config";

// Synthetic Data Generator for Loan Boarding System
export class SampleDataGenerator {
  
  // Generate synthetic loan data
  static generateLoan(overrides: any = {}) {
    const xpLoanNumber = `LN${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
    
    return {
      xpLoanNumber,
      tenantId: overrides.tenantId || "tenant1",
      sellerName: overrides.sellerName || this.getRandomSeller(),
      sellerNumber: `SE${Math.floor(Math.random() * 10000)}`,
      servicerNumber: `SV${Math.floor(Math.random() * 10000)}`,
      status: overrides.status || this.getRandomStatus(),
      product: overrides.product || this.getRandomProduct(),
      commitmentId: `CM${Math.floor(Math.random() * 100000)}`,
      commitmentDate: Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000,
      expirationDate: Date.now() + Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000,
      currentCommitmentAmount: 100000 + Math.random() * 900000,
      noteAmount: 90000 + Math.random() * 810000,
      propertyValue: 120000 + Math.random() * 1080000,
      ltvRatio: 0.7 + Math.random() * 0.25,
      creditScore: 620 + Math.floor(Math.random() * 230),
      interestRate: 3.5 + Math.random() * 4,
      boardingReadiness: "pending",
      boardingStatus: "not_started",
      firstPassYield: 0,
      timeToBoard: null,
      autoClearRate: null,
      metadata: JSON.stringify({
        generatedAt: new Date().toISOString(),
        synthetic: true
      }),
      ...overrides
    };
  }

  // Generate synthetic exceptions
  static generateException(loanId: string, xpLoanNumber: string, overrides: any = {}) {
    const ruleTypes = [
      { id: "income_verification", name: "Income Verification Required", severity: "HIGH" },
      { id: "credit_score_minimum", name: "Credit Score Below Minimum", severity: "MEDIUM" },
      { id: "property_appraisal", name: "Property Appraisal Missing", severity: "HIGH" },
      { id: "debt_to_income", name: "Debt-to-Income Ratio High", severity: "MEDIUM" },
      { id: "employment_verification", name: "Employment Verification Pending", severity: "LOW" }
    ];
    
    const rule = ruleTypes[Math.floor(Math.random() * ruleTypes.length)];
    
    return {
      loanId,
      xpLoanNumber,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status: Math.random() > 0.7 ? "resolved" : "open",
      confidence: 0.7 + Math.random() * 0.3,
      description: `${rule.name} detected during loan boarding process`,
      evidence: JSON.stringify({
        detectedFields: ["income", "employment"],
        confidence: 0.85,
        source: "automated_validation"
      }),
      autoFixSuggestion: JSON.stringify({
        action: "request_documentation",
        documents: ["W2", "Pay_Stub"],
        priority: rule.severity
      }),
      resolvedAt: Math.random() > 0.5 ? Date.now() : null,
      resolvedBy: Math.random() > 0.5 ? "system" : null,
      slaDue: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      notes: `Auto-generated exception for testing purposes`,
      ...overrides
    };
  }

  // Generate synthetic documents
  static generateDocument(loanId: string, xpLoanNumber: string, overrides: any = {}) {
    const docTypes = ["Appraisal", "Income_Documentation", "Credit_Report", "Property_Deed", "Insurance_Policy"];
    const docType = overrides.documentType || docTypes[Math.floor(Math.random() * docTypes.length)];
    
    return {
      loanId,
      xpLoanNumber,
      xpDocGUID: randomUUID(),
      xpDocId: `DOC${Math.floor(Math.random() * 100000)}`,
      documentType: docType,
      status: overrides.status || this.getRandomDocStatus(),
      ocrStatus: "completed",
      classificationStatus: "completed",
      extractionStatus: "completed",
      validationStatus: "pending",
      s3Location: `s3://loan-docs/${xpLoanNumber}/${docType.toLowerCase()}.pdf`,
      extractedData: JSON.stringify(this.generateExtractedData(docType)),
      metadata: JSON.stringify({
        uploadedAt: new Date().toISOString(),
        synthetic: true,
        fileSize: Math.floor(Math.random() * 5000000) + 100000
      }),
      ...overrides
    };
  }

  // Generate synthetic compliance events
  static generateComplianceEvent(loanId: string, xpLoanNumber: string, overrides: any = {}) {
    const eventTypes = ["respa_welcome", "escrow_setup", "tila_disclosure", "closing_disclosure"];
    const eventType = overrides.eventType || eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    return {
      loanId,
      xpLoanNumber,
      eventType,
      status: Math.random() > 0.6 ? "completed" : "pending",
      dueDate: Date.now() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000,
      completedAt: Math.random() > 0.5 ? Date.now() : null,
      description: `${eventType.replace(/_/g, ' ')} compliance requirement`,
      metadata: JSON.stringify({
        regulatoryRequirement: true,
        generatedAt: new Date().toISOString()
      }),
      ...overrides
    };
  }

  // Helper methods
  private static getRandomSeller(): string {
    const sellers = [
      "First National Bank",
      "Community Credit Union", 
      "Prime Mortgage Corp",
      "Heritage Lending",
      "Coastal Financial",
      "Mountain View Bank"
    ];
    return sellers[Math.floor(Math.random() * sellers.length)];
  }

  private static getRandomStatus(): string {
    const statuses = ["pending", "processing", "reviewing", "approved", "funded"];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private static getRandomProduct(): string {
    const products = ["30Y Fixed", "15Y Fixed", "5/1 ARM", "7/1 ARM", "FHA 30Y", "VA 30Y"];
    return products[Math.floor(Math.random() * products.length)];
  }

  private static getRandomDocStatus(): string {
    const statuses = ["pending", "processing", "classified", "extracted", "validated", "error"];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private static generateExtractedData(docType: string): any {
    switch (docType) {
      case "Appraisal":
        return {
          propertyValue: 250000 + Math.random() * 500000,
          appraisedDate: new Date().toISOString(),
          appraiserName: "John Smith, MAI",
          propertyType: "Single Family Residence"
        };
      case "Income_Documentation":
        return {
          monthlyIncome: 3000 + Math.random() * 7000,
          employerName: "ABC Corporation",
          employmentType: "Full Time",
          yearsEmployed: 2 + Math.random() * 10
        };
      case "Credit_Report":
        return {
          creditScore: 620 + Math.floor(Math.random() * 230),
          reportDate: new Date().toISOString(),
          totalDebt: 5000 + Math.random() * 50000,
          monthlyPayments: 500 + Math.random() * 2000
        };
      default:
        return {
          documentDate: new Date().toISOString(),
          extractedText: `Sample extracted text for ${docType}`
        };
    }
  }

  // Bulk data generation methods
  static async generateLoanPipeline(count: number = 5): Promise<void> {
    console.log(`Generating ${count} synthetic loans with complete pipeline data...`);
    
    for (let i = 0; i < count; i++) {
      // Create loan
      const loanData = this.generateLoan();
      const loan = await storage.createLoan(loanData);
      
      // Generate 2-4 exceptions per loan
      const exceptionCount = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < exceptionCount; j++) {
        const exceptionData = this.generateException(loan.id, loan.xpLoanNumber);
        await storage.createException(exceptionData);
      }
      
      // Generate 3-6 documents per loan
      const docCount = 3 + Math.floor(Math.random() * 4);
      for (let k = 0; k < docCount; k++) {
        const docData = this.generateDocument(loan.id, loan.xpLoanNumber);
        const document = await storage.createDocument(docData);
        
        // Index document in OpenSearch
        await documentSearch.indexDocument(document.id, {
          loanId: loan.id,
          xpLoanNumber: loan.xpLoanNumber,
          documentType: document.documentType,
          content: `Sample content for ${document.documentType} document`,
          extractedData: JSON.parse(document.extractedData || "{}"),
          ocrConfidence: 0.85 + Math.random() * 0.15
        });
      }
      
      // Generate 2-3 compliance events per loan
      const complianceCount = 2 + Math.floor(Math.random() * 2);
      for (let l = 0; l < complianceCount; l++) {
        const complianceData = this.generateComplianceEvent(loan.id, loan.xpLoanNumber);
        await storage.createComplianceEvent(complianceData);
      }
      
      console.log(`Generated loan ${loan.xpLoanNumber} with complete pipeline data`);
    }
  }

  // Generate realistic test scenarios
  static async generateTestScenarios(): Promise<void> {
    console.log("Generating realistic test scenarios...");
    
    // Scenario 1: High-performing loan (FPY success)
    const highPerformLoan = this.generateLoan({
      status: "approved",
      boardingStatus: "completed",
      firstPassYield: 1,
      timeToBoard: 1.2,
      autoClearRate: 0.95
    });
    const loan1 = await storage.createLoan(highPerformLoan);
    
    // Scenario 2: Problem loan with multiple exceptions
    const problemLoan = this.generateLoan({
      status: "reviewing", 
      boardingStatus: "in_progress",
      firstPassYield: 0,
      timeToBoard: 8.5,
      autoClearRate: 0.25
    });
    const loan2 = await storage.createLoan(problemLoan);
    
    // Add high-severity exceptions to problem loan
    for (let i = 0; i < 5; i++) {
      const exception = this.generateException(loan2.id, loan2.xpLoanNumber, {
        severity: "HIGH",
        status: "open"
      });
      await storage.createException(exception);
    }
    
    // Scenario 3: Document processing workflow
    const docLoan = this.generateLoan({ status: "processing" });
    const loan3 = await storage.createLoan(docLoan);
    
    const docStatuses = ["pending", "processing", "classified", "extracted", "validated"];
    for (let i = 0; i < docStatuses.length; i++) {
      const doc = this.generateDocument(loan3.id, loan3.xpLoanNumber, {
        status: docStatuses[i],
        documentType: ["Appraisal", "Income_Documentation", "Credit_Report", "Property_Deed", "Insurance_Policy"][i]
      });
      await storage.createDocument(doc);
    }
    
    console.log("Test scenarios generated successfully");
  }
}

// Business rules and configurations
export class FixtureLoader {
  static async loadBusinessRules(): Promise<void> {
    const rules = [
      {
        id: "income_verification",
        name: "Income Verification Required",
        type: "data_validation",
        severity: "HIGH",
        description: "All loans must have verified income documentation",
        conditions: ["missing_w2", "missing_paystub", "insufficient_income_docs"],
        autoFix: {
          action: "request_documents",
          documents: ["W2", "Pay_Stub", "Bank_Statement"]
        }
      },
      {
        id: "credit_score_minimum", 
        name: "Credit Score Minimum",
        type: "eligibility",
        severity: "MEDIUM",
        description: "Credit score must be above 620 for conventional loans",
        conditions: ["credit_score < 620"],
        autoFix: {
          action: "manual_review",
          escalation: "underwriter"
        }
      },
      {
        id: "ltv_ratio_check",
        name: "Loan-to-Value Ratio Validation",
        type: "risk_assessment", 
        severity: "HIGH",
        description: "LTV ratio must not exceed program guidelines",
        conditions: ["ltv_ratio > 0.95"],
        autoFix: {
          action: "require_mi_or_reduce_loan",
          options: ["mortgage_insurance", "loan_amount_reduction"]
        }
      }
    ];
    
    configDB.setRules(rules);
    console.log("Business rules loaded successfully");
  }
  
  static async loadAgencyConfigs(): Promise<void> {
    // Fannie Mae configuration
    configDB.setAgencyConfig("fannie_mae", {
      api_endpoint: "https://api.fanniemae.com",
      timeout: 30000,
      retry_attempts: 3,
      loan_limits: {
        conforming: 766550,
        high_balance: 1149825
      },
      required_docs: ["1003", "1008", "appraisal", "credit_report"]
    });
    
    // Freddie Mac configuration
    configDB.setAgencyConfig("freddie_mac", {
      api_endpoint: "https://api.freddiemac.com",
      timeout: 30000,
      retry_attempts: 3,
      loan_limits: {
        conforming: 766550,
        high_balance: 1149825  
      },
      required_docs: ["1003", "1008", "appraisal", "credit_report"]
    });
    
    // Ginnie Mae configuration
    configDB.setAgencyConfig("ginnie_mae", {
      api_endpoint: "https://api.ginniemae.gov",
      timeout: 45000,
      retry_attempts: 2,
      programs: ["FHA", "VA", "USDA"],
      required_docs: ["1003", "certificate_of_eligibility", "appraisal"]
    });
    
    console.log("Agency configurations loaded successfully");
  }
}