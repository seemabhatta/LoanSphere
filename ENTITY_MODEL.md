# Entity Model for Loan Tracking System

## Core Entities (Loan Origination Business Model)

### **Loan** (Core Asset)
- `xpLoanNumber` - Primary identifier (XP123456789)
- `status` - Processing status (ReadyToBoard, CommitmentLinked, etc.)
- `amount` - Loan amount in USD
- `rate` - Interest rate
- `ltv` - Loan-to-value ratio
- `creditScore` - Borrower credit score
- `closingDate` - Expected/actual closing date
- `propertyAddress` - Subject property location
- `borrowerInfo` - End borrower details

### **Seller (Correspondent)**
- `name` - Correspondent lender name (e.g., "ABC Mortgage Co")
- `nmls` - NMLS identifier
- `contactInfo` - Business contact information
- `originationCapacity` - Loan origination volume capability
- `correspondentAgreements` - Active correspondent relationships with agencies

### **Buyer (Aggregator)**
- `name` - Aggregator name (e.g., "Freedom Mortgage", "Quicken Loans")
- `type` - Business model: `aggregator|warehouse_lender|correspondent_investor`
- `capacity` - Purchasing/warehousing capacity
- `territories` - Geographic areas of operation
- `productTypes` - Loan products they purchase

### **Agency (Investor)**
- `name` - Ultimate investor (e.g., "Fannie Mae", "Freddie Mac", "Ginnie Mae")
- `type` - Classification:
  - `fannie_mae` - Fannie Mae
  - `freddie_mac` - Freddie Mac  
  - `ginnie_mae` - Ginnie Mae
  - `private_investor` - Private capital source
- `programs` - Available loan programs
- `guidelines` - Underwriting guidelines

### **Commitment**
- `commitmentId` - Primary identifier from agency
- `amount` - Commitment amount/capacity
- `expirationDate` - When commitment expires  
- `terms` - Commitment terms (rate, pricing, delivery requirements)
- `pricing` - Pricing structure/margins
- `deliveryRequirements` - What must be delivered to fulfill commitment
- **Purpose**: Seller's commitment to deliver loans to Agency through Aggregator

### **Purchase Advice**  
- `purchaseAdviceId` - Unique identifier
- `commitmentReference` - Links to specific commitment
- `loanDetails` - Specific loan being purchased
- `purchasePrice` - Amount aggregator pays to seller
- `settlementDate` - When transaction settles
- `deliveryInstructions` - How/where to deliver loan
- **Purpose**: Aggregator's actual purchase of specific loan from Seller

### **Loan Data (ULDD)**
- `ulddId` - ULDD document identifier  
- `loanNumber` - Associated loan number
- `dataVersion` - ULDD format version
- `submissionDate` - When submitted to agency
- `validationStatus` - Pass/fail validation status
- **Purpose**: Standardized loan data package for agency delivery

### **Documents**
- `documentId` - Unique document identifier
- `associatedLoan` - Which loan this supports
- `type` - Document classification:
  - `note` - Promissory note
  - `deed_of_trust` - Security instrument
  - `appraisal` - Property valuation
  - `credit_report` - Borrower credit
  - `income_docs` - Income verification
  - `title_insurance` - Title policy
- `uploadDate` - When document was received
- `processingStatus` - Current processing state
- **Purpose**: Supporting documentation required for loan delivery

## Business Workflow

### **Loan Origination & Sale Process**
1. **Commitment Phase**: 
   - Seller (Correspondent) gets commitment from Agency (via Aggregator)
   - Commitment specifies terms, pricing, delivery requirements
   
2. **Loan Origination**:
   - Seller originates loans to borrowers
   - Loans must meet commitment criteria
   
3. **Purchase Phase**:
   - Aggregator issues Purchase Advice to buy specific loan from Seller
   - Purchase Advice references the original commitment
   - Specifies purchase price and settlement terms
   
4. **Delivery Phase**:
   - Seller delivers Loan Data (ULDD) and Documents to Aggregator
   - Aggregator validates and packages for Agency delivery
   - Agency receives complete loan package

### **Entity Relationships**
```
Seller -[HAS_COMMITMENT_WITH]-> Agency
Aggregator -[FACILITATES]-> (Seller, Agency)
Loan -[ORIGINATED_BY]-> Seller
Loan -[PURCHASED_BY]-> Aggregator  
Loan -[ULTIMATELY_OWNED_BY]-> Agency
Purchase Advice -[EXECUTES]-> Commitment
Loan Data (ULDD) -[DESCRIBES]-> Loan
Documents -[SUPPORT]-> Loan
```

## Relationships in Current TinyDB Implementation

### **Current Structure (`loan_tracking.json`)**
```json
{
  "xpLoanNumber": "XP123456789",
  "tenantId": "default_tenant",
  "externalIds": {
    "commitmentId": "COMMIT_001",
    "correspondentLoanNumber": "CORR123",
    "investorLoanNumber": "INV456",
    "investorName": "Fannie Mae"
  },
  "status": {
    "boardingReadiness": "CommitmentLinked",
    "lastEvaluated": "2025-01-01T12:00:00Z"
  },
  "metaData": {
    "commitment": {...},
    "purchase_advice": [...],
    "loan_data": [...]
  }
}
```

### **Entity Mapping to Current Fields**
- **Loan** → `xpLoanNumber`, `status.boardingReadiness`
- **Commitment** → `externalIds.commitmentId`, `metaData.commitment`
- **Investor/Agency** → `externalIds.investorName`
- **Document** → `metaData.*` (by document type)
- **Seller** → `externalIds.correspondentLoanNumber` (implicit)
- **Buyer** → Not explicitly captured in current structure

## Future Knowledge Graph Migration Path

When ready to implement knowledge graph:

1. **Extract entities** from current JSON structure
2. **Create nodes** for each entity type
3. **Establish relationships** based on current `externalIds` and `metaData`
4. **Enhance with missing entities** (Seller, Buyer details)
5. **Query optimization** for complex relationship traversals

## Current TinyDB Collections
- `loan_tracking.json` - Main loan tracking records
- `commitments.json` - Standalone commitment documents  
- `purchase_advice.json` - Purchase advice documents
- `loan_data.json` - ULDD/loan data documents
- `stage.json` - Staged files awaiting processing

This entity model provides the foundation for both current TinyDB operations and future knowledge graph implementation.