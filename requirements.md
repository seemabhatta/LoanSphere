# LoanSphere – Simplified Business Requirements & Data Correlations  

## Executive Summary  
LoanSphere tracks mortgage loans across 4 datasets: **Commitments, Purchase Advice, Loan Data (ULDD), and Loan Documents.**  
The system creates a full loan lifecycle view from capacity → purchase → performance → servicing.  

---

## Key Terms  

- **Seller / Correspondent** → Loan originator selling loans.  
- **Agency / Investor** → Entity acquiring loans (e.g., Fannie Mae, Freddie Mac, Ginnie Mae).  
- **Buyer / Aggregator** → Institution purchasing loans from correspondents after delivery to Agencies/Investors (e.g., Freedom Mortgage).  

---

## Core Data Flow  

```
1. COMMITMENT → Seller’s capacity & terms with Investors
2. PURCHASE ADVICE → Loan purchase execution against commitment with Investors
3. LOAN DATA (ULDD) → Detailed loan attributes received from Investors to buyer
4. LOAN DOCUMENTS → PDF blob docs that needs to be processed to extract information, classified, extracted, versioned
```

**Primary Correlation Key:**  
`fannieMaeLn` (Purchase Advice) ↔ `InvestorLoanIdentifier` (Loan Data).  

---

## Dataset Requirements  

### 1. Commitment  
- **Purpose:** Defines seller’s capacity and terms.  
- **Key Fields:** `commitmentId`, `servicerNumber`, `commitmentAmount`, `product`, `minPTR`, `expirationDate`.  
- **Rules:**  
  - Independent of loan tracking.  
  - Multiple loans can draw from one commitment.  

### 2. Purchase Advice  
- **Purpose:** Records loan purchase execution.  
- **Key Fields:** `fannieMaeLn` (primary correlation), `servicerNumber`, `commitmentNo`, `prinPurchased`, `interestRate`, `passThruRate`, `lenderLoanNo`.  
- **Rules:**  
  - Links commitments ↔ loans.  
  - Updates or creates loan tracking record.  

### 3. Loan Data (ULDD)  
- **Purpose:** Detailed loan-level data and payment history.  
- **Key Fields:** `InvestorLoanIdentifier`, `InvestorCommitmentIdentifier`, `UPBAmount`, `CurrentInterestRatePercent`, `EscrowBalanceAmount`, `LastPaymentReceivedDate`.  
- **Rules:**  
  - Best effort to match purchase advice loan number. 
  - Basis for investor/servicer reporting.  

### 4. Loan Documents  
- **Purpose:** Supporting PDFs for compliance and servicing.  
- **Processing:** OCR + LLM extraction, classification, versioning.  
- **Linking:** Correlate with `xpLoanNumber` in loan tracking.  

---

## Correlation Chain  

```
Commitment (ID + Servicer)  
    ↓  
Purchase Advice (fannieMaeLn)  
    ↓  
Loan Data (InvestorLoanIdentifier)  
    ↓  
Documents + Servicing
```

---

## Validation Rules  

- **Servicer Consistency:** Servicer number must match across datasets.  
- **Financial Reconciliation:**  
  - Purchase ≤ commitment capacity.  
  - Loan UPB ≤ purchased amount.  
  - Rates consistent (PTR → purchase → loan).  
- **Temporal:**  
  - Purchase within commitment validity.  
  - Loan data dates follow purchase.  

---

## Processing Logic  

1. **Commitment Ingestion**  
   - Save to `commitments`.  
   - Create/update `loan_tracking` metadata.  

2. **Purchase Advice Ingestion**  
   - Save to `purchase_advice`.  
   - Update/create `loan_tracking`.  
   - Link to commitment by ID → loan number → servicer (fallbacks).  

3. **Loan Data Ingestion**  
   - Save to `loan_data`.  
   - Update `loan_tracking`.  
   - Cross-reference purchase advice + commitments.  

4. **Document Ingestion**  
   - Save to `loan_documents`.  
   - Update `loan_tracking` with extracted fields + completeness flags.  

---

## Status Tracking  

- `CommitmentReceived`  
- `PurchaseAdviceReceived`  
- `CommitmentLinked`  
- `LoanDataReceived`  
- `DocumentsReceived`  
- `ReadyToBoard` (fully correlated loan record)  

---

## Collections  

- **commitments** → capacity, utilization  
- **purchase_advice** → purchase records  
- **loan_data** → loan-level details  
- **loan_documents** → OCR’d/structured docs  
- **loan_tracking** (central hub) → unified record, statuses, cross-refs  

---

## Reporting  

- **Commitment Utilization:** usage vs capacity, expirations.  
- **Correlation Exceptions:** missing IDs, orphaned records.  
- **Performance:** loan portfolio metrics, servicer stats.  
- **Documents:** completeness & versioning.  

---

## Success Criteria  

1. Full chain established (Commitment → Purchase → Loan Data → Docs).  
2. Financials reconcile correctly.  
3. Dates follow logical order.  
4. Complete records available for reporting.  
5. Exceptions logged and resolved.  
