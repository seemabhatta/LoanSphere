"""
Loan Matching Service
Handles correlation and consolidation of loan data from multiple sources
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_
import json
from datetime import datetime
from loguru import logger

from models import LoanModel
from services.loan_service import LoanService


class LoanMatchingService:
    """Service to match and consolidate loan data from multiple file types"""
    
    def __init__(self, db: Session):
        self.db = db
        self.loan_service = LoanService(db)
    
    def find_matching_loan(self, loan_data: Dict[str, Any]) -> Optional[LoanModel]:
        """
        Find existing loan that matches the provided data based on various identifiers
        
        Args:
            loan_data: Dictionary containing loan information with potential matching fields
            
        Returns:
            Matching LoanModel if found, None otherwise
        """
        # Extract all possible identifiers from the loan data
        identifiers = self._extract_loan_identifiers(loan_data)
        
        if not identifiers:
            logger.debug("No identifiers found for matching")
            return None
        
        # Search for loans with matching identifiers
        query_conditions = []
        
        # Check commitment IDs
        commitment_ids = identifiers.get('commitment_ids', [])
        if commitment_ids:
            query_conditions.append(LoanModel.commitment_id.in_(commitment_ids))
        
        # Check loan numbers (xp_loan_number and metadata)
        loan_numbers = identifiers.get('loan_numbers', [])
        if loan_numbers:
            query_conditions.append(LoanModel.xp_loan_number.in_(loan_numbers))
            
            # Also search in metadata for additional loan identifiers
            for loan_num in loan_numbers:
                query_conditions.append(LoanModel.metadata.contains(loan_num))
        
        # Check servicer numbers
        servicer_numbers = identifiers.get('servicer_numbers', [])
        if servicer_numbers:
            for servicer_num in servicer_numbers:
                query_conditions.append(LoanModel.servicer_number == servicer_num)
                query_conditions.append(LoanModel.metadata.contains(servicer_num))
        
        if not query_conditions:
            return None
        
        # Execute query with OR conditions
        try:
            matching_loan = self.db.query(LoanModel).filter(
                or_(*query_conditions)
            ).first()
            
            if matching_loan:
                logger.info(f"Found matching loan: {matching_loan.xp_loan_number}")
                return matching_loan
                
        except Exception as e:
            logger.error(f"Error searching for matching loan: {e}")
        
        return None
    
    def _extract_loan_identifiers(self, loan_data: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Extract all possible loan identifiers from various data formats
        
        Returns:
            Dictionary with lists of identifiers by type
        """
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
            value = self._safe_get(loan_data, field)
            if value:
                identifiers['commitment_ids'].append(str(value))
        
        # Loan number identifiers
        loan_number_fields = [
            'lenderLoanNo', 'fannieMaeLn', 'loanNumber', 'loan_number',
            'loanId', 'originalLoanNumber', 'investorLoanNumber',
            'InvestorLoanIdentifier', 'SellerLoanIdentifier'
        ]
        for field in loan_number_fields:
            value = self._safe_get(loan_data, field)
            if value and str(value) != 'XXXXXXXX':  # Skip masked values
                identifiers['loan_numbers'].append(str(value))
        
        # Handle nested loan identifiers (ULDD format)
        self._extract_nested_identifiers(loan_data, identifiers)
        
        # Servicer numbers
        servicer_fields = ['servicerNumber', 'servicer_number']
        for field in servicer_fields:
            value = self._safe_get(loan_data, field)
            if value:
                identifiers['servicer_numbers'].append(str(value))
        
        # Remove duplicates
        for key in identifiers:
            identifiers[key] = list(set(identifiers[key]))
        
        logger.debug(f"Extracted identifiers: {identifiers}")
        return identifiers
    
    def _extract_nested_identifiers(self, loan_data: Dict[str, Any], identifiers: Dict[str, List[str]]):
        """Extract identifiers from nested structures like ULDD format"""
        
        # Handle loanIdentifier nested structure
        loan_identifier = loan_data.get('loanIdentifier', {})
        if isinstance(loan_identifier, dict):
            original_num = loan_identifier.get('originalLoanNumber')
            if original_num and str(original_num) != 'XXXXXXXX':
                identifiers['loan_numbers'].append(str(original_num))
        
        # Handle DEAL.LOANS.LOAN.LOAN_IDENTIFIERS structure
        try:
            deal = loan_data.get('DEAL', {})
            loans = deal.get('LOANS', {})
            loan_list = loans.get('LOAN', [])
            
            if not isinstance(loan_list, list):
                loan_list = [loan_list]
            
            for loan in loan_list:
                if not isinstance(loan, dict):
                    continue
                    
                loan_ids = loan.get('LOAN_IDENTIFIERS', {})
                loan_id_list = loan_ids.get('LOAN_IDENTIFIER', [])
                
                if not isinstance(loan_id_list, list):
                    loan_id_list = [loan_id_list]
                
                for identifier in loan_id_list:
                    if not isinstance(identifier, dict):
                        continue
                    
                    # Extract various identifier types
                    for key in ['InvestorCommitmentIdentifier', 'InvestorLoanIdentifier', 'SellerLoanIdentifier']:
                        value = identifier.get(key)
                        if value and str(value) != 'XXXXXXXX':
                            if key == 'InvestorCommitmentIdentifier':
                                identifiers['commitment_ids'].append(str(value))
                            else:
                                identifiers['loan_numbers'].append(str(value))
                    
                    # Handle nested extensions
                    extension = identifier.get('EXTENSION', {})
                    other = extension.get('OTHER', {})
                    loan_id_ext = other.get('LOAN_IDENTIFIER_EXTENSION', {})
                    nested_id = loan_id_ext.get('LoanIdentifier')
                    if nested_id and str(nested_id) != 'XXXXXXXX':
                        identifiers['loan_numbers'].append(str(nested_id))
                        
        except Exception as e:
            logger.debug(f"Error extracting nested identifiers: {e}")
    
    def _safe_get(self, data: Dict[str, Any], key: str) -> Any:
        """Safely get value from dictionary, handling various data types"""
        try:
            return data.get(key)
        except (AttributeError, TypeError):
            return None
    
    async def consolidate_loan_data(self, new_data: Dict[str, Any], source_type: str) -> LoanModel:
        """
        Consolidate new loan data with existing loan or create new one
        
        Args:
            new_data: New loan data from file
            source_type: Type of source file ('commitment', 'purchase_advice', 'loan_data')
            
        Returns:
            LoanModel (either updated existing or newly created)
        """
        # Try to find matching existing loan
        existing_loan = self.find_matching_loan(new_data)
        
        if existing_loan:
            # Update existing loan with new data
            logger.info(f"Updating existing loan {existing_loan.xp_loan_number} with {source_type} data")
            updated_loan = await self._merge_loan_data(existing_loan, new_data, source_type)
            return updated_loan
        else:
            # Create new loan from the data
            logger.info(f"Creating new loan from {source_type} data")
            new_loan = await self._create_loan_from_data(new_data, source_type)
            return new_loan
    
    async def _merge_loan_data(self, existing_loan: LoanModel, new_data: Dict[str, Any], source_type: str) -> LoanModel:
        """Merge new data into existing loan"""
        
        # Parse existing metadata
        existing_metadata = json.loads(existing_loan.metadata or "{}")
        
        # Prepare update data based on source type
        update_data = {}
        
        if source_type == 'commitment':
            update_data.update({
                'commitment_id': new_data.get('commitmentId'),
                'seller_name': new_data.get('sellerName'),
                'seller_number': new_data.get('sellerNumber'),
                'servicer_number': new_data.get('servicerNumber'),
                'product': new_data.get('product'),
                'commitment_date': datetime.fromisoformat(new_data['commitmentDate']) if new_data.get('commitmentDate') else None,
                'expiration_date': datetime.fromisoformat(new_data['expirationDate']) if new_data.get('expirationDate') else None,
                'current_commitment_amount': new_data.get('currentCommitmentAmount'),
            })
            
        elif source_type == 'purchase_advice':
            update_data.update({
                'purchased_amount': new_data.get('prinPurchased'),
                'interest_rate': new_data.get('interestRate', 0) / 100 if new_data.get('interestRate') else None,
                'pass_thru_rate': new_data.get('passThruRate', 0) / 100 if new_data.get('passThruRate') else None,
                'servicer_number': new_data.get('servicerNumber'),
            })
            
        elif source_type == 'loan_data':
            # Extract from complex ULDD structure
            update_data.update(self._extract_uldd_loan_data(new_data))
        
        # Add source tracking to metadata
        existing_metadata[f'{source_type}_data'] = {
            'updated_at': datetime.now().isoformat(),
            'original_data': new_data
        }
        
        # Track data sources
        sources = existing_metadata.get('data_sources', [])
        if source_type not in sources:
            sources.append(source_type)
        existing_metadata['data_sources'] = sources
        
        update_data['metadata'] = json.dumps(existing_metadata)
        update_data['boarding_readiness'] = 'data_received'
        
        # Update the loan
        updated_loan = await self.loan_service.update_loan(existing_loan.id, update_data)
        return updated_loan
    
    async def _create_loan_from_data(self, loan_data: Dict[str, Any], source_type: str) -> LoanModel:
        """Create new loan from data"""
        
        # Extract primary loan number
        identifiers = self._extract_loan_identifiers(loan_data)
        
        # Use first available loan number or generate one
        loan_numbers = identifiers.get('loan_numbers', [])
        primary_loan_number = loan_numbers[0] if loan_numbers else f"{source_type.upper()}_{int(datetime.now().timestamp())}"
        
        # Base loan data
        new_loan_data = {
            'xp_loan_number': primary_loan_number,
            'tenant_id': f'staged_{source_type}',
            'status': 'staged',
            'boarding_readiness': 'data_received',
            'metadata': json.dumps({
                'source': source_type,
                'data_sources': [source_type],
                'staged_at': datetime.now().isoformat(),
                f'{source_type}_data': {
                    'staged_at': datetime.now().isoformat(),
                    'original_data': loan_data
                },
                'all_identifiers': identifiers
            })
        }
        
        # Add source-specific data
        if source_type == 'commitment':
            new_loan_data.update({
                'commitment_id': loan_data.get('commitmentId'),
                'seller_name': loan_data.get('sellerName'),
                'seller_number': loan_data.get('sellerNumber'),
                'servicer_number': loan_data.get('servicerNumber'),
                'product': loan_data.get('product'),
                'commitment_date': datetime.fromisoformat(loan_data['commitmentDate']) if loan_data.get('commitmentDate') else None,
                'expiration_date': datetime.fromisoformat(loan_data['expirationDate']) if loan_data.get('expirationDate') else None,
                'current_commitment_amount': loan_data.get('currentCommitmentAmount'),
            })
            
        elif source_type == 'purchase_advice':
            new_loan_data.update({
                'purchased_amount': loan_data.get('prinPurchased'),
                'interest_rate': loan_data.get('interestRate', 0) / 100 if loan_data.get('interestRate') else None,
                'pass_thru_rate': loan_data.get('passThruRate', 0) / 100 if loan_data.get('passThruRate') else None,
                'servicer_number': loan_data.get('servicerNumber'),
                'seller_name': loan_data.get('sellerName'),
            })
            
        elif source_type == 'loan_data':
            new_loan_data.update(self._extract_uldd_loan_data(loan_data))
        
        # Create the loan
        new_loan = await self.loan_service.create_loan(new_loan_data)
        return new_loan
    
    def _extract_uldd_loan_data(self, uldd_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract loan data from ULDD format"""
        extracted = {}
        
        try:
            deal = uldd_data.get('DEAL', {})
            loans = deal.get('LOANS', {})
            loan_list = loans.get('LOAN', [])
            
            if not isinstance(loan_list, list):
                loan_list = [loan_list]
            
            # Get first loan (subject loan)
            if loan_list:
                loan = loan_list[0]
                
                # Extract basic loan details
                loan_detail = loan.get('LOAN_DETAIL', {})
                extracted['interest_rate'] = loan_detail.get('CurrentInterestRatePercent')
                
                # Extract terms
                terms = loan.get('TERMS_OF_MORTGAGE', {})
                extracted['note_amount'] = terms.get('NoteAmount')
                
                # Extract LTV
                ltv_data = loan.get('LTV', {})
                extracted['ltv_ratio'] = ltv_data.get('LTVRatioPercent')
                
                # Extract credit score
                credit_data = loan.get('LOAN_LEVEL_CREDIT', {})
                credit_detail = credit_data.get('LOAN_LEVEL_CREDIT_DETAIL', {})
                extracted['credit_score'] = credit_detail.get('LoanLevelCreditScoreValue')
                
                # Extract payment info
                payment_data = loan.get('PAYMENT', {})
                payment_summary = payment_data.get('PAYMENT_SUMMARY', {})
                extracted['upb_amount'] = payment_summary.get('UPBAmount')
            
            # Extract property value
            collaterals = deal.get('COLLATERALS', {})
            collateral = collaterals.get('COLLATERAL', {})
            properties = collateral.get('PROPERTIES', {})
            property_data = properties.get('PROPERTY', {})
            valuations = property_data.get('PROPERTY_VALUATIONS', {})
            valuation = valuations.get('PROPERTY_VALUATION', {})
            valuation_detail = valuation.get('PROPERTY_VALUATION_DETAIL', {})
            extracted['property_value'] = valuation_detail.get('PropertyValuationAmount')
            
        except Exception as e:
            logger.error(f"Error extracting ULDD data: {e}")
        
        return extracted