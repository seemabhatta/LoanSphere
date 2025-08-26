# Commitment Pipeline Implementation

## Overview

This document outlines the implementation of the separate commitment pipeline where commitments are processed independently and purchase advice creates/finds loan numbers while mapping to existing commitments.

## Key Changes Made

### 1. Commitment Processing Flow (`server/services/loan_tracking_service.py`)

#### Standalone Commitment Processing
- **Location**: Lines 66-84 in `_process_commitment_standalone()`
- **Behavior**: Commitments are stored only in the commitments collection
- **No loan tracking**: No loan tracking record is created for commitments
- **Storage**: Uses TinyDB commitments collection via `store_commitment()`

```python
def _process_commitment_standalone(self, file_data: Dict[str, Any], source_file_id: str) -> Dict[str, Any]:
    # Extract commitment ID to use as document ID
    commitment_id = self._extract_commitment_id(file_data)
    
    # Store only in commitments collection
    document_record_id = self._store_document_in_nosql(
        file_data, 'commitment', commitment_id, source_file_id
    )
    
    return {
        "tracking_record": None,
        "document_record_id": document_record_id,
        "commitment_id": commitment_id,
        "action": "commitment_stored"
    }
```

### 2. Purchase Advice Processing with Loan Number Logic

#### Enhanced Purchase Advice Processing
- **Location**: Lines 434-509 in `_create_tracking_record_for_purchase_advice()`
- **Key Features**:
  - **Existing loan lookup**: Checks for existing loan tracking records by investor/fannie mae loan numbers
  - **New loan creation**: Creates new XP loan number if no existing record found
  - **Commitment association**: Automatically links to matching commitments

```python
# Check if loan tracking record already exists based on investor loan number or fannie mae loan number
loan_numbers = identifiers.get('loan_numbers', [])
existing_record = None

for loan_num in loan_numbers:
    existing_record = self.tinydb.find_loan_tracking_by_external_ids({'loan_numbers': [loan_num]})
    if existing_record:
        logger.info(f"Found existing loan tracking record for loan number {loan_num}: {existing_record['xpLoanNumber']}")
        break

if existing_record:
    # Update existing record with purchase advice
    return self._update_tracking_record(existing_record, purchase_data, 'purchase_advice', source_file_id)

# Generate new XP loan number for purchase advice if no existing record found
xp_loan_number = f"XP{int(datetime.now().timestamp())}"
```

### 3. Enhanced Commitment Mapping Logic

#### Robust Commitment Association
- **Location**: Lines 511-611 in `_associate_with_commitment()`
- **Multiple matching strategies**:
  - Direct commitment ID matching
  - Loan number cross-matching between purchase advice and commitments
  - Support for nested data structures

```python
# Try to find commitments by commitment ID first
for commitment_id in commitment_ids_to_try:
    commitment = self.tinydb.get_commitment(commitment_id)
    if commitment:
        matched_commitments.append((commitment_id, commitment))

# If no direct commitment ID match, try to find by loan numbers
if not matched_commitments and loan_numbers:
    all_commitments = self.tinydb.get_all_commitments()
    for commitment_record in all_commitments:
        commitment_data = commitment_record.get('commitment_data', {})
        # Check if any loan number from purchase advice matches commitment
        for loan_num in loan_numbers:
            # ... matching logic
```

### 4. API Response Handling (`server/routers/staging.py`)

#### Differentiated Response Format
- **Location**: Lines 303-327
- **Handles different response formats** based on file type:
  - **Commitments**: Returns `commitmentId`, `documentRecordId`, no loan tracking
  - **Other types**: Returns `xpLoanNumber`, `trackingRecord` with full loan tracking data

```python
# Handle different response formats based on file type
if result.get("tracking_record"):
    # Regular processing with loan tracking
    return {
        "success": True,
        "xpLoanNumber": result["xp_loan_number"],
        "trackingRecord": {...}
    }
else:
    # Commitment processing - no loan tracking
    return {
        "success": True,
        "commitmentId": result.get("commitment_id"),
        "action": result["action"],
        "documentRecordId": result["document_record_id"]
    }
```

## Data Flow Architecture

### 1. Commitment Processing
```
Commitment Data → _process_commitment_standalone() → TinyDB Commitments Collection
```

### 2. Purchase Advice Processing
```
Purchase Advice Data → _create_tracking_record_for_purchase_advice() 
                    ↓
Check for existing loan tracking by loan numbers
                    ↓
If exists: Update existing record
If not: Create new XP loan number
                    ↓
Associate with commitments via _associate_with_commitment()
                    ↓
Store in TinyDB purchase_advice collection
```

## Key Features Implemented

### 1. 1:n Relationship Support
- **Commitments exist independently** without loan tracking records
- **Multiple commitments can map** to a single loan tracking record
- **Purchase advice creates the bridge** between commitments and loans

### 2. Robust Identifier Matching
- **Multiple field matching** for commitment IDs and loan numbers
- **Nested data structure support** for complex JSON formats
- **Fallback mechanisms** when direct matches aren't found

### 3. Status Tracking
- **Commitment status**: Stored independently in commitments collection
- **Loan tracking status**: Updates based on associations
  - `PurchaseAdviceReceived`: Initial purchase advice processing
  - `CommitmentLinked`: When successfully associated with commitment

### 4. Database Collections

#### TinyDB Collections Used:
- **`commitments.json`**: Standalone commitment documents
- **`purchase_advice.json`**: Purchase advice documents
- **`loan_tracking.json`**: Loan tracking records with cross-references

## Testing Results

### Commitment Processing Test
```bash
curl -X POST "http://localhost:8000/api/staging/process" \
  -H "Content-Type: application/json" \
  -d '{
    "fileData": {
      "commitmentId": "TEST_COMMIT_001",
      "investorLoanNumber": "IL12345",
      "investorName": "Test Investor"
    },
    "fileType": "commitment",
    "sourceFileId": "test_source_001"
  }'
```

**Response:**
```json
{
  "success": true,
  "commitmentId": "TEST_COMMIT_001",
  "action": "commitment_stored",
  "documentRecordId": "2"
}
```

### Purchase Advice Processing Test
```bash
curl -X POST "http://localhost:8000/api/staging/process" \
  -H "Content-Type: application/json" \
  -d '{
    "fileData": {
      "commitmentId": "TEST_COMMIT_001",
      "investorLoanNumber": "IL12345",
      "investorName": "Test Investor"
    },
    "fileType": "purchase_advice",
    "sourceFileId": "test_purchase_001"
  }'
```

**Response:**
```json
{
  "success": true,
  "xpLoanNumber": "XP1756154597",
  "action": "created",
  "trackingRecord": {
    "xpLoanNumber": "XP1756154597",
    "externalIds": {
      "correspondentLoanNumber": "IL12345",
      "investorName": "Test Investor",
      "commitmentId": "TEST_COMMIT_001"
    },
    "status": {
      "boardingReadiness": "PurchaseAdviceReceived"
    },
    "metaData": {
      "commitment": {
        "links": {
          "documentDb": {
            "collection": "commitments",
            "documentId": "TEST_COMMIT_001"
          }
        },
        "matchedBy": "commitment_mapping"
      }
    }
  }
}
```

## Files Modified

1. **`server/services/loan_tracking_service.py`** - Core processing logic
2. **`server/routers/staging.py`** - API endpoint response handling
3. **`server/services/tinydb_service.py`** - Database operations (already had required methods)

## Benefits

1. **Clean Separation**: Commitments operate independently from loan tracking
2. **Flexible Mapping**: Multiple matching strategies for robust association
3. **1:n Support**: Supports complex business relationships where multiple commitments can relate to one loan
4. **Extensible**: Easy to add new matching criteria or processing rules
5. **Status Tracking**: Clear visibility into processing stages and associations

## Next Steps

1. **UI Integration**: Update frontend to display commitment processing results
2. **Reporting**: Add commitment-specific reporting and analytics
3. **Validation**: Add business rule validation for commitment data
4. **Error Handling**: Enhanced error recovery for failed associations