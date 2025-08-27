"""
Simple Loan Data Service
Handles storing and retrieving loan data documents (ULDD/MISMO format) in TinyDB collection
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from loguru import logger

from services.tinydb_service import get_tinydb_service


class LoanDataService:
    """Simple service for loan data storage and retrieval"""
    
    def __init__(self):
        self.tinydb = get_tinydb_service()
    
    def store_loan_data(self, loan_data: Dict[str, Any], source_file_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Store a loan data document (ULDD/MISMO format)
        
        Args:
            loan_data: Raw loan data (typically ULDD format)
            source_file_id: Optional source file reference
            
        Returns:
            Stored loan data record with metadata
        """
        try:
            # Basic validation
            if not loan_data:
                raise ValueError("Loan data cannot be empty")
            
            # Extract loan data ID
            loan_id = self._extract_loan_data_id(loan_data)
            
            # Validate required fields
            self._validate_loan_data(loan_data, loan_id)
            
            # Store in TinyDB
            doc_id = self.tinydb.store_loan_data(
                loan_data_id=loan_id,
                loan_data=loan_data,
                source_file_id=source_file_id or f"manual_{datetime.now().timestamp()}"
            )
            
            logger.info(f"Stored loan data: {loan_id}")
            
            return {
                "id": loan_id,
                "doc_id": doc_id,
                "loan_data_id": loan_id,
                "stored_at": datetime.now().isoformat(),
                "status": "stored"
            }
            
        except Exception as e:
            logger.error(f"Error storing loan data: {e}")
            raise ValueError(f"Failed to store loan data: {str(e)}")
    
    def get_loan_data(self, loan_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve loan data by ID
        
        Args:
            loan_id: Loan data identifier
            
        Returns:
            Loan data record or None if not found
        """
        try:
            loan_data = self.tinydb.get_loan_data(loan_id)
            
            if loan_data:
                logger.debug(f"Retrieved loan data: {loan_id}")
            else:
                logger.debug(f"Loan data not found: {loan_id}")
            
            return loan_data
            
        except Exception as e:
            logger.error(f"Error retrieving loan data {loan_id}: {e}")
            return None
    
    def get_all_loan_data(self) -> List[Dict[str, Any]]:
        """
        Get all loan data documents
        
        Returns:
            List of loan data records
        """
        try:
            loan_data_records = self.tinydb.get_all_loan_data()
            logger.debug(f"Retrieved {len(loan_data_records)} loan data records")
            return loan_data_records
            
        except Exception as e:
            logger.error(f"Error retrieving all loan data: {e}")
            return []
    
    def _extract_loan_data_id(self, loan_data: Dict[str, Any]) -> str:
        """
        Extract loan data ID from ULDD/MISMO data
        
        Args:
            loan_data: Raw loan data (ULDD format)
            
        Returns:
            Loan data ID string
        """
        # Try different possible field names for top-level IDs
        top_level_fields = [
            'loanId', 'loan_id', 'id',
            'xpLoanNumber', 'loanNumber', 'loan_number'
        ]
        
        # Check direct fields
        for field in top_level_fields:
            if field in loan_data and loan_data[field]:
                return str(loan_data[field])
        
        # Check eventMetadata for xpLoanNumber
        if 'eventMetadata' in loan_data:
            metadata = loan_data['eventMetadata']
            if 'xpLoanNumber' in metadata and metadata['xpLoanNumber']:
                return str(metadata['xpLoanNumber'])
        
        # Check ULDD/MISMO structure
        if 'DEAL' in loan_data:
            deal = loan_data['DEAL']
            
            # Check for LOANS section
            if 'LOANS' in deal and 'LOAN' in deal['LOANS']:
                loans = deal['LOANS']['LOAN']
                
                # Handle both single loan and array of loans
                if isinstance(loans, list):
                    loans = loans
                else:
                    loans = [loans]
                
                # Look for subject loan
                for loan in loans:
                    if loan.get('@LoanRoleType') == 'SubjectLoan' or not loan.get('@LoanRoleType'):
                        # Try to find loan identifier
                        loan_identifiers = [
                            'LoanIdentifier', '@LoanIdentifier', 
                            'LenderLoanIdentifier', 'InvestorLoanIdentifier'
                        ]
                        
                        for identifier in loan_identifiers:
                            if identifier in loan and loan[identifier]:
                                return str(loan[identifier])
                        
                        # Check LOAN_IDENTIFIERS section
                        if 'LOAN_IDENTIFIERS' in loan:
                            identifiers = loan['LOAN_IDENTIFIERS']
                            if 'LOAN_IDENTIFIER' in identifiers:
                                loan_ids = identifiers['LOAN_IDENTIFIER']
                                if isinstance(loan_ids, list):
                                    # Use first identifier
                                    if loan_ids and loan_ids[0].get('LoanIdentifier'):
                                        return str(loan_ids[0]['LoanIdentifier'])
                                elif loan_ids.get('LoanIdentifier'):
                                    return str(loan_ids['LoanIdentifier'])
        
        # Generate fallback ID
        fallback_id = f"LOAN_DATA_{int(datetime.now().timestamp())}"
        logger.warning(f"No loan data ID found, using fallback: {fallback_id}")
        return fallback_id
    
    def _validate_loan_data(self, loan_data: Dict[str, Any], loan_id: str) -> None:
        """
        Basic validation of loan data
        
        Args:
            loan_data: Raw loan data
            loan_id: Extracted loan ID
            
        Raises:
            ValueError: If validation fails
        """
        if not loan_id:
            raise ValueError("Loan data ID is required")
        
        # Check for ULDD structure
        if 'DEAL' not in loan_data:
            logger.warning(f"Missing DEAL structure for loan data {loan_id} - may not be ULDD format")
        else:
            deal = loan_data['DEAL']
            
            # Check for basic ULDD sections
            if 'LOANS' not in deal:
                logger.warning(f"Missing LOANS section for loan data {loan_id}")
            
            if 'COLLATERALS' not in deal:
                logger.warning(f"Missing COLLATERALS section for loan data {loan_id}")
            
            # Check for subject loan
            if 'LOANS' in deal and 'LOAN' in deal['LOANS']:
                loans = deal['LOANS']['LOAN']
                if isinstance(loans, list):
                    subject_loans = [loan for loan in loans if loan.get('@LoanRoleType') == 'SubjectLoan']
                    if not subject_loans:
                        logger.warning(f"No SubjectLoan found for loan data {loan_id}")
                elif not loans.get('@LoanRoleType') == 'SubjectLoan':
                    logger.warning(f"Loan role type not specified for loan data {loan_id}")


# Singleton instance
_loan_data_service = None

def get_loan_data_service() -> LoanDataService:
    """Get singleton loan data service instance"""
    global _loan_data_service
    if _loan_data_service is None:
        _loan_data_service = LoanDataService()
    return _loan_data_service