"""
Loan Tracking Service
Handles TinyDB document storage and loan tracking records
"""
from typing import Optional, Dict, Any, List
import json
from datetime import datetime
from loguru import logger

from services.tinydb_service import get_tinydb_service
from services.loan_matching_service import LoanMatchingService


class LoanTrackingService:
    """Service to manage loan tracking records and processed documents using TinyDB"""
    
    def __init__(self, db_session=None):
        self.tinydb = get_tinydb_service()
        # Keep SQL session for matching service (uses SQL for identifier extraction)
        if db_session:
            self.matching_service = LoanMatchingService(db_session)
        else:
            self.matching_service = None
    
    def find_existing_tracking_record(self, file_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find existing loan tracking record based on file data identifiers"""
        
        # Extract identifiers using the matching service
        if self.matching_service:
            identifiers = self.matching_service._extract_loan_identifiers(file_data)
        else:
            # Fallback identifier extraction if no SQL session
            identifiers = self._extract_loan_identifiers_local(file_data)
        
        if not identifiers:
            return None
        
        # Use TinyDB to find matching record
        tracking_record = self.tinydb.find_loan_tracking_by_external_ids(identifiers)
        
        if tracking_record:
            logger.info(f"Found existing tracking record: {tracking_record['xpLoanNumber']}")
        
        return tracking_record
    
    def process_file_to_nosql(self, file_data: Dict[str, Any], file_type: str, source_file_id: str) -> Dict[str, Any]:
        """
        Process file: move to NoSQL storage and handle different workflows
        
        Args:
            file_data: The file data to process
            file_type: Type of file (commitment, purchase_advice, loan_data, documents)
            source_file_id: ID of the original staged file
            
        Returns:
            Dictionary with processing results
        """
        
        if file_type == 'commitment':
            # Commitment workflow: standalone, no loan tracking
            return self._process_commitment_standalone(file_data, source_file_id)
        else:
            # Other workflows: create/update loan tracking
            return self._process_with_loan_tracking(file_data, file_type, source_file_id)
    
    def _process_commitment_standalone(self, file_data: Dict[str, Any], source_file_id: str) -> Dict[str, Any]:
        """Process commitment as standalone document without loan tracking"""
        
        # Extract commitment ID to use as document ID
        commitment_id = self._extract_commitment_id(file_data)
        
        # Store only in commitments collection
        document_record_id = self._store_document_in_nosql(
            file_data, 'commitment', commitment_id, source_file_id
        )
        
        logger.info(f"Processed commitment standalone: {commitment_id}")
        
        return {
            "tracking_record": None,
            "document_record_id": document_record_id,
            "commitment_id": commitment_id,
            "action": "commitment_stored"
        }
    
    def _process_with_loan_tracking(self, file_data: Dict[str, Any], file_type: str, source_file_id: str) -> Dict[str, Any]:
        """Process with loan tracking (purchase_advice, loan_data, documents)"""
        
        # For purchase advice, always create new loan tracking (don't look for existing)
        if file_type == 'purchase_advice':
            logger.info("Creating new loan tracking record for purchase advice")
            updated_record = self._create_tracking_record_for_purchase_advice(file_data, source_file_id)
            
            # Try to associate with existing commitment
            self._associate_with_commitment(updated_record, file_data)
        else:
            # For loan_data and documents, try to find existing tracking record
            tracking_record = self.find_existing_tracking_record(file_data)
            
            if tracking_record:
                logger.info(f"Updating existing tracking record: {tracking_record['xpLoanNumber']}")
                updated_record = self._update_tracking_record(tracking_record, file_data, file_type, source_file_id)
            else:
                logger.info("Creating new loan tracking record")
                updated_record = self._create_tracking_record(file_data, file_type, source_file_id)
        
        # Store document in appropriate collection
        document_record_id = self._store_document_in_nosql(
            file_data, file_type, updated_record['xpLoanNumber'], source_file_id
        )
        
        return {
            "tracking_record": updated_record,
            "document_record_id": document_record_id,
            "xp_loan_number": updated_record['xpLoanNumber'],
            "action": "created" if file_type == 'purchase_advice' else "updated_or_created"
        }
    
    def _create_tracking_record(self, file_data: Dict[str, Any], file_type: str, source_file_id: str) -> Dict[str, Any]:
        """Create new loan tracking record using TinyDB"""
        
        # Extract identifiers
        if self.matching_service:
            identifiers = self.matching_service._extract_loan_identifiers(file_data)
        else:
            identifiers = self._extract_loan_identifiers_local(file_data)
        
        # Generate XP loan number if not available
        loan_numbers = identifiers.get('loan_numbers', [])
        xp_loan_number = loan_numbers[0] if loan_numbers else f"XP{int(datetime.now().timestamp())}"
        
        # Build external IDs
        external_ids = {}
        commitment_ids = identifiers.get('commitment_ids', [])
        servicer_numbers = identifiers.get('servicer_numbers', [])
        
        if commitment_ids:
            external_ids['commitmentId'] = commitment_ids[0]
            if len(commitment_ids) > 1:
                external_ids['investorCommitmentId'] = commitment_ids[1]
        
        if loan_numbers:
            external_ids['correspondentLoanNumber'] = loan_numbers[0]
            if len(loan_numbers) > 1:
                external_ids['aggregatorLoanNumber'] = loan_numbers[1]
            if len(loan_numbers) > 2:
                external_ids['investorLoanNumber'] = loan_numbers[2]
        
        # Extract investor name from file data
        external_ids['investorName'] = self._extract_investor_name(file_data, file_type)
        
        # Build status - determine boarding readiness based on file type and data completeness
        boarding_readiness = self._determine_boarding_readiness(file_type, file_data, loan_numbers)
        status = {
            "boardingReadiness": boarding_readiness,
            "lastEvaluated": datetime.now().isoformat()
        }
        
        # Build metadata with array structure for 1:n relationships
        metadata = {}
        
        if file_type == 'commitment':
            # Commitment is 1:1
            metadata[file_type] = {
                "links": {
                    "raw": f"stage/{source_file_id}",
                    "transformed": f"processed/{file_type}/{xp_loan_number}.json",
                    "documentDb": {
                        "collection": file_type,
                        "documentId": xp_loan_number
                    }
                }
            }
        else:
            # Purchase advice and loan data are 1:n - use arrays
            document_id = f"{xp_loan_number}_{int(datetime.now().timestamp())}"
            
            metadata[file_type] = [{
                "links": {
                    "raw": f"stage/{source_file_id}",
                    "transformed": f"processed/{file_type}/{document_id}.json",
                    "documentDb": {
                        "collection": file_type,
                        "documentId": document_id
                    }
                }
            }]
        
        # Create tracking record using TinyDB
        tracking_record = self.tinydb.create_loan_tracking_record(
            xp_loan_number=xp_loan_number,
            tenant_id="default_tenant",
            external_ids=external_ids,
            status=status,
            metadata=metadata
        )
        
        logger.info(f"Created new loan tracking record: {xp_loan_number}")
        return tracking_record
    
    def _update_tracking_record(self, tracking_record: Dict[str, Any], file_data: Dict[str, Any], 
                              file_type: str, source_file_id: str) -> Dict[str, Any]:
        """Update existing loan tracking record with new file data using TinyDB"""
        
        xp_loan_number = tracking_record['xpLoanNumber']
        
        # Extract identifiers
        if self.matching_service:
            identifiers = self.matching_service._extract_loan_identifiers(file_data)
        else:
            identifiers = self._extract_loan_identifiers_local(file_data)
        
        # Update external IDs if we have new ones
        existing_external_ids = tracking_record.get('externalIds', {})
        
        # Add any new loan numbers
        loan_numbers = identifiers.get('loan_numbers', [])
        for loan_num in loan_numbers:
            if loan_num not in existing_external_ids.values():
                # Find appropriate field for this loan number
                if 'aggregatorLoanNumber' not in existing_external_ids:
                    existing_external_ids['aggregatorLoanNumber'] = loan_num
                elif 'correspondentLoanNumber' not in existing_external_ids:
                    existing_external_ids['correspondentLoanNumber'] = loan_num
                elif 'investorLoanNumber' not in existing_external_ids:
                    existing_external_ids['investorLoanNumber'] = loan_num
        
        # Add commitment IDs
        commitment_ids = identifiers.get('commitment_ids', [])
        for comm_id in commitment_ids:
            if 'commitmentId' not in existing_external_ids:
                existing_external_ids['commitmentId'] = comm_id
            elif 'investorCommitmentId' not in existing_external_ids:
                existing_external_ids['investorCommitmentId'] = comm_id
        
        # Update investor name if available
        investor_name = self._extract_investor_name(file_data, file_type)
        if investor_name and investor_name != "Unknown":
            existing_external_ids['investorName'] = investor_name
        
        # Update status
        existing_status = tracking_record.get('status', {})
        existing_status['lastEvaluated'] = datetime.now().isoformat()
        
        # Update metadata - handle 1:n relationships
        existing_metadata = tracking_record.get('metaData', {})
        
        if file_type == 'commitment':
            # Commitment is 1:1 - replace
            existing_metadata[file_type] = {
                "links": {
                    "raw": f"stage/{source_file_id}",
                    "transformed": f"processed/{file_type}/{xp_loan_number}.json",
                    "documentDb": {
                        "collection": file_type,
                        "documentId": xp_loan_number
                    }
                }
            }
        else:
            # Purchase advice and loan data are 1:n - append to array
            document_id = f"{xp_loan_number}_{int(datetime.now().timestamp())}"
            
            new_document = {
                "links": {
                    "raw": f"stage/{source_file_id}",
                    "transformed": f"processed/{file_type}/{document_id}.json",
                    "documentDb": {
                        "collection": file_type,
                        "documentId": document_id
                    }
                }
            }
            
            # Initialize array if doesn't exist, or append to existing array
            if file_type not in existing_metadata:
                existing_metadata[file_type] = [new_document]
            else:
                # If it's not already an array, convert it
                if not isinstance(existing_metadata[file_type], list):
                    existing_metadata[file_type] = [existing_metadata[file_type]]
                existing_metadata[file_type].append(new_document)
        
        # Update boarding readiness based on available data
        data_types = list(existing_metadata.keys())
        if len(data_types) >= 2:  # Have at least 2 data types
            existing_status['boardingReadiness'] = "ReadyToBoard"
        else:
            existing_status['boardingReadiness'] = "DataReceived"
        
        # Update the record in TinyDB
        updates = {
            'externalIds': existing_external_ids,
            'status': existing_status,
            'metaData': existing_metadata
        }
        
        updated_record = self.tinydb.update_loan_tracking_record(xp_loan_number, updates)
        
        logger.info(f"Updated loan tracking record: {xp_loan_number}")
        return updated_record
    
    def _store_document_in_nosql(self, file_data: Dict[str, Any], file_type: str, 
                               xp_loan_number: str, source_file_id: str) -> str:
        """Store document in appropriate TinyDB collection"""
        
        # For 1:n relationships, create unique document IDs
        if file_type == 'commitment':
            document_id = xp_loan_number
            document_record_id = self.tinydb.store_commitment(document_id, file_data, source_file_id)
        elif file_type == 'purchase_advice':
            document_id = f"{xp_loan_number}_{int(datetime.now().timestamp())}"
            document_record_id = self.tinydb.store_purchase_advice(document_id, file_data, source_file_id)
        elif file_type == 'loan_data':
            document_id = f"{xp_loan_number}_{int(datetime.now().timestamp())}"
            document_record_id = self.tinydb.store_loan_data(document_id, file_data, source_file_id)
        elif file_type == 'documents':
            document_id = f"{xp_loan_number}_{int(datetime.now().timestamp())}"
            document_record_id = self.tinydb.store_document_metadata(document_id, file_data)
        else:
            # Default case - store as loan data
            document_id = f"{xp_loan_number}_{int(datetime.now().timestamp())}"
            document_record_id = self.tinydb.store_loan_data(document_id, file_data, source_file_id)
        
        logger.info(f"Stored document in {file_type} collection: {document_id}")
        return document_record_id
    
    def _get_collection_name(self, file_type: str) -> str:
        """Map file type to collection name"""
        collection_map = {
            'commitment': 'commitment',
            'purchase_advice': 'purchaseAdvice',
            'loan_data': 'uldd'
        }
        return collection_map.get(file_type, 'unknown')
    
    def _extract_investor_name(self, file_data: Dict[str, Any], file_type: str) -> str:
        """Extract investor name from file data"""
        
        # Try various fields where investor name might be
        investor_fields = [
            'investorName', 'investor_name', 'sellerName', 'seller_name'
        ]
        
        for field in investor_fields:
            value = file_data.get(field)
            if value and value not in ['Unknown', 'Unknown Seller', '']:
                return value
        
        # For ULDD data, try to extract from nested structure
        if file_type == 'loan_data':
            try:
                deal = file_data.get('DEAL', {})
                parties = deal.get('PARTIES', {})
                party_list = parties.get('PARTY', [])
                
                if not isinstance(party_list, list):
                    party_list = [party_list]
                
                for party in party_list:
                    roles = party.get('ROLES', {})
                    role_ids = roles.get('PARTY_ROLE_IDENTIFIERS', {})
                    party_id = role_ids.get('PARTY_ROLE_IDENTIFIER', {})
                    
                    if isinstance(party_id, dict):
                        extension = party_id.get('EXTENSION', {})
                        seller_name = extension.get('SellerName')
                        if seller_name:
                            return seller_name
                            
            except Exception as e:
                logger.debug(f"Error extracting investor name from ULDD: {e}")
        
        return "Unknown"
    
    def _extract_loan_identifiers_local(self, loan_data: Dict[str, Any]) -> Dict[str, List[str]]:
        """Local identifier extraction (fallback when no SQL matching service)"""
        identifiers = {
            'commitment_ids': [],
            'loan_numbers': [],
            'servicer_numbers': []
        }
        
        # Commitment identifiers
        commitment_fields = [
            'commitmentId', 'commitmentNo', 'commitment_id', 
            'InvestorCommitmentIdentifier', 'investorCommitmentIdentifier'
        ]
        for field in commitment_fields:
            value = loan_data.get(field)
            if value:
                identifiers['commitment_ids'].append(str(value))
        
        # Loan number identifiers
        loan_number_fields = [
            'lenderLoanNo', 'fannieMaeLn', 'loanNumber', 'loan_number',
            'loanId', 'originalLoanNumber', 'investorLoanNumber',
            'InvestorLoanIdentifier', 'SellerLoanIdentifier',
            'correspondentLoanNumber', 'aggregatorLoanNumber'
        ]
        for field in loan_number_fields:
            value = loan_data.get(field)
            if value and str(value) != 'XXXXXXXX':
                identifiers['loan_numbers'].append(str(value))
        
        # Servicer numbers
        servicer_fields = ['servicerNumber', 'servicer_number']
        for field in servicer_fields:
            value = loan_data.get(field)
            if value:
                identifiers['servicer_numbers'].append(str(value))
        
        # Remove duplicates
        for key in identifiers:
            identifiers[key] = list(set(identifiers[key]))
        
        return identifiers
    
    def get_all_tracking_records(self) -> List[Dict[str, Any]]:
        """Get all loan tracking records for UI display"""
        return self.tinydb.get_all_loan_tracking_records()
    
    def _extract_commitment_id(self, commitment_data: Dict[str, Any]) -> str:
        """Extract commitment ID from commitment data"""
        # Try various fields where commitment ID might be
        commitment_fields = ['commitmentId', 'commitmentNo', 'commitment_id']
        
        for field in commitment_fields:
            value = commitment_data.get(field)
            if value:
                return str(value)
        
        # Fallback to timestamp if no ID found
        return f"COMMIT_{int(datetime.now().timestamp())}"
    
    def _create_tracking_record_for_purchase_advice(self, purchase_data: Dict[str, Any], source_file_id: str) -> Dict[str, Any]:
        """Create new loan tracking record specifically for purchase advice"""
        
        # Extract identifiers from purchase advice
        if self.matching_service:
            identifiers = self.matching_service._extract_loan_identifiers(purchase_data)
        else:
            identifiers = self._extract_loan_identifiers_local(purchase_data)
        
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
            xp_loan_number = existing_record['xpLoanNumber']
            return self._update_tracking_record(existing_record, purchase_data, 'purchase_advice', source_file_id)
        
        # Generate new XP loan number for purchase advice if no existing record found
        xp_loan_number = f"XP{int(datetime.now().timestamp())}"
        
        # Build external IDs
        external_ids = {}
        servicer_numbers = identifiers.get('servicer_numbers', [])
        
        if loan_numbers:
            external_ids['correspondentLoanNumber'] = loan_numbers[0]
            if len(loan_numbers) > 1:
                external_ids['aggregatorLoanNumber'] = loan_numbers[1]
            if len(loan_numbers) > 2:
                external_ids['investorLoanNumber'] = loan_numbers[2]
        
        if servicer_numbers:
            external_ids['servicerNumber'] = servicer_numbers[0]
        
        # Extract investor name
        external_ids['investorName'] = self._extract_investor_name(purchase_data, 'purchase_advice')
        
        # Build status
        status = {
            "boardingReadiness": "PurchaseAdviceReceived",
            "lastEvaluated": datetime.now().isoformat()
        }
        
        # Build metadata for purchase advice
        document_id = f"{xp_loan_number}_{int(datetime.now().timestamp())}"
        metadata = {
            "purchase_advice": [{
                "links": {
                    "raw": f"stage/{source_file_id}",
                    "transformed": f"processed/purchase_advice/{document_id}.json",
                    "documentDb": {
                        "collection": "purchase_advice",
                        "documentId": document_id
                    }
                }
            }]
        }
        
        # Create tracking record using TinyDB
        tracking_record = self.tinydb.create_loan_tracking_record(
            xp_loan_number=xp_loan_number,
            tenant_id="default_tenant",
            external_ids=external_ids,
            status=status,
            metadata=metadata
        )
        
        logger.info(f"Created new loan tracking record for purchase advice: {xp_loan_number}")
        return tracking_record
    
    def _associate_with_commitment(self, tracking_record: Dict[str, Any], purchase_data: Dict[str, Any]):
        """Try to associate loan tracking record with existing commitment"""
        
        # Extract commitment identifiers from purchase advice
        commitment_fields = ['commitmentId', 'commitment_id', 'investorCommitmentId', 'investorCommitmentIdentifier']
        commitment_ids_to_try = []
        
        for field in commitment_fields:
            value = purchase_data.get(field)
            if value:
                commitment_ids_to_try.append(str(value))
        
        # Also try to extract from nested data structures if they exist
        if 'commitmentData' in purchase_data:
            commitment_data = purchase_data['commitmentData']
            for field in commitment_fields:
                value = commitment_data.get(field)
                if value:
                    commitment_ids_to_try.append(str(value))
        
        # Also try to extract from loan-level data like investor loan number matching
        loan_numbers = []
        loan_fields = ['investorLoanNumber', 'loanNumber', 'fannieMaeLn', 'lenderLoanNo']
        for field in loan_fields:
            value = purchase_data.get(field)
            if value:
                loan_numbers.append(str(value))
        
        matched_commitments = []
        
        # Try to find commitments by commitment ID first
        for commitment_id in commitment_ids_to_try:
            commitment = self.tinydb.get_commitment(commitment_id)
            if commitment:
                matched_commitments.append((commitment_id, commitment))
                logger.info(f"Found commitment by ID {commitment_id}")
        
        # If no direct commitment ID match, try to find by loan numbers in commitment data
        if not matched_commitments and loan_numbers:
            # Search all commitments for matching loan numbers
            all_commitments = self.tinydb.get_all_commitments()
            for commitment_record in all_commitments:
                commitment_data = commitment_record.get('commitment_data', {})
                
                # Check if any loan number from purchase advice matches commitment
                for loan_num in loan_numbers:
                    commitment_loan_fields = ['investorLoanNumber', 'loanNumber', 'fannieMaeLn', 'lenderLoanNo']
                    for field in commitment_loan_fields:
                        commitment_loan_value = commitment_data.get(field)
                        if commitment_loan_value and str(commitment_loan_value) == loan_num:
                            matched_commitments.append((commitment_record['id'], commitment_record))
                            logger.info(f"Found commitment by matching loan number {loan_num}: {commitment_record['id']}")
                            break
                    
                    if matched_commitments:
                        break
                
                if matched_commitments:
                    break
        
        if matched_commitments:
            # Use the first matched commitment
            commitment_id, commitment = matched_commitments[0]
            
            # Update tracking record to link to commitment
            existing_metadata = tracking_record.get('metaData', {})
            existing_metadata['commitment'] = {
                "links": {
                    "documentDb": {
                        "collection": "commitments",
                        "documentId": commitment_id
                    }
                },
                "matchedBy": "commitment_mapping"
            }
            
            # Update external IDs with commitment info
            existing_external_ids = tracking_record.get('externalIds', {})
            existing_external_ids['commitmentId'] = commitment_id
            
            # Extract additional info from commitment if available
            commitment_data = commitment.get('commitment_data', {})
            if 'investorName' in commitment_data and commitment_data['investorName']:
                existing_external_ids['investorName'] = commitment_data['investorName']
            
            # Update the tracking record
            updates = {
                'externalIds': existing_external_ids,
                'metaData': existing_metadata,
                'status': {
                    **tracking_record.get('status', {}),
                    'boardingReadiness': 'CommitmentLinked',
                    'lastEvaluated': datetime.now().isoformat()
                }
            }
            
            self.tinydb.update_loan_tracking_record(tracking_record['xpLoanNumber'], updates)
            
            logger.info(f"Associated loan {tracking_record['xpLoanNumber']} with commitment {commitment_id}")
        else:
            logger.info(f"No matching commitments found for purchase advice. Tried IDs: {commitment_ids_to_try}, Loan numbers: {loan_numbers}")
    
    def _determine_boarding_readiness(self, file_type: str, file_data: Dict[str, Any], loan_numbers: List[str]) -> str:
        """Determine boarding readiness based on file type and data completeness"""
        
        if file_type == 'loan_data' and self._has_comprehensive_uldd_data(file_data):
            # ULDD with comprehensive data can be ReadyToBoard if it has key loan identifiers
            if len(loan_numbers) >= 2:  # Has multiple loan numbers (correspondent, aggregator, investor)
                return "ReadyToBoard"
            else:
                return "ULDDReceived"
        elif file_type == 'purchase_advice':
            return "PurchaseAdviceReceived"
        elif file_type == 'commitment':
            return "CommitmentReceived"
        else:
            return "DataReceived"
    
    def _has_comprehensive_uldd_data(self, file_data: Dict[str, Any]) -> bool:
        """Check if ULDD data contains comprehensive loan information"""
        
        # Check for key ULDD fields that indicate comprehensive data
        key_fields = [
            'loanAmount', 'interestRate', 'loanPurpose', 
            'propertyType', 'occupancyStatus', 'creditScore',
            'loanToValueRatio', 'debtToIncomeRatio'
        ]
        
        # Also check nested ULDD structure
        if 'DEAL' in file_data:
            deal = file_data.get('DEAL', {})
            loans = deal.get('LOANS', {})
            loan = loans.get('LOAN', {}) if isinstance(loans.get('LOAN'), dict) else (loans.get('LOAN', [{}])[0] if loans.get('LOAN') else {})
            
            # Check loan-level data
            loan_detail = loan.get('LOAN_DETAIL', {})
            if loan_detail.get('LoanAmount') and loan_detail.get('NoteRatePercent'):
                return True
        
        # Check flat structure
        present_fields = sum(1 for field in key_fields if file_data.get(field))
        return present_fields >= 4  # Has at least 4 key fields