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
        Process file: move to NoSQL storage and create/update tracking record
        
        Args:
            file_data: The file data to process
            file_type: Type of file (commitment, purchase_advice, loan_data)
            source_file_id: ID of the original staged file
            
        Returns:
            Dictionary with processing results
        """
        
        # 1. Find or create loan tracking record
        tracking_record = self.find_existing_tracking_record(file_data)
        
        if tracking_record:
            logger.info(f"Updating existing tracking record: {tracking_record['xpLoanNumber']}")
            updated_record = self._update_tracking_record(tracking_record, file_data, file_type, source_file_id)
        else:
            logger.info("Creating new loan tracking record")
            updated_record = self._create_tracking_record(file_data, file_type, source_file_id)
        
        # 2. Store document in NoSQL collection
        document_record_id = self._store_document_in_nosql(
            file_data, file_type, updated_record['xpLoanNumber'], source_file_id
        )
        
        return {
            "tracking_record": updated_record,
            "document_record_id": document_record_id,
            "xp_loan_number": updated_record['xpLoanNumber'],
            "action": "updated" if tracking_record else "created"
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
        
        # Build status
        status = {
            "boardingReadiness": "DataReceived",
            "lastEvaluated": datetime.now().isoformat()
        }
        
        # Build metadata with array structure for 1:n relationships
        metadata = {}
        
        if file_type == 'commitment':
            # Commitment is 1:1
            metadata[file_type] = {
                "links": {
                    "raw": f"staged_files/{source_file_id}",
                    "transformed": f"processed/{file_type}/{xp_loan_number}.json",
                    "documentDb": {
                        "collection": self._get_collection_name(file_type),
                        "documentId": xp_loan_number
                    }
                }
            }
        else:
            # Purchase advice and loan data are 1:n - use arrays
            collection_name = self._get_collection_name(file_type)
            document_id = f"{xp_loan_number}_{int(datetime.now().timestamp())}"
            
            metadata[file_type] = [{
                "links": {
                    "raw": f"staged_files/{source_file_id}",
                    "transformed": f"processed/{file_type}/{document_id}.json",
                    "documentDb": {
                        "collection": collection_name,
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
                    "raw": f"staged_files/{source_file_id}",
                    "transformed": f"processed/{file_type}/{xp_loan_number}.json",
                    "documentDb": {
                        "collection": self._get_collection_name(file_type),
                        "documentId": xp_loan_number
                    }
                }
            }
        else:
            # Purchase advice and loan data are 1:n - append to array
            collection_name = self._get_collection_name(file_type)
            document_id = f"{xp_loan_number}_{int(datetime.now().timestamp())}"
            
            new_document = {
                "links": {
                    "raw": f"staged_files/{source_file_id}",
                    "transformed": f"processed/{file_type}/{document_id}.json",
                    "documentDb": {
                        "collection": collection_name,
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
        """Store document in TinyDB collection"""
        
        # For 1:n relationships, create unique document IDs
        if file_type == 'commitment':
            document_id = xp_loan_number
        else:
            document_id = f"{xp_loan_number}_{int(datetime.now().timestamp())}"
        
        collection = self._get_collection_name(file_type)
        
        document_record_id = self.tinydb.store_processed_document(
            document_id=document_id,
            collection=collection,
            document_data=file_data,
            source_file_id=source_file_id
        )
        
        logger.info(f"Stored document in {collection} collection: {document_id}")
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
            'InvestorLoanIdentifier', 'SellerLoanIdentifier'
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