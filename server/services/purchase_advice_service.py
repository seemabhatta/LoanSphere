"""
Simple Purchase Advice Service
Handles storing and retrieving purchase advice documents in TinyDB collection
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from loguru import logger

from services.tinydb_service import get_tinydb_service


class PurchaseAdviceService:
    """Simple service for purchase advice storage and retrieval"""
    
    def __init__(self):
        self.tinydb = get_tinydb_service()
    
    def store_purchase_advice(self, pa_data: Dict[str, Any], source_file_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Store a purchase advice document
        
        Args:
            pa_data: Raw purchase advice data
            source_file_id: Optional source file reference
            
        Returns:
            Stored purchase advice record with metadata
        """
        try:
            # Basic validation
            if not pa_data:
                raise ValueError("Purchase advice data cannot be empty")
            
            # Extract purchase advice ID
            pa_id = self._extract_purchase_advice_id(pa_data)
            
            # Validate required fields
            self._validate_purchase_advice_data(pa_data, pa_id)
            
            # Store in TinyDB
            doc_id = self.tinydb.store_purchase_advice(
                purchase_advice_id=pa_id,
                purchase_data=pa_data,
                source_file_id=source_file_id or f"manual_{datetime.now().timestamp()}"
            )
            
            logger.info(f"Stored purchase advice: {pa_id}")
            
            return {
                "id": pa_id,
                "doc_id": doc_id,
                "purchase_advice_id": pa_id,
                "stored_at": datetime.now().isoformat(),
                "status": "stored"
            }
            
        except Exception as e:
            logger.error(f"Error storing purchase advice: {e}")
            raise ValueError(f"Failed to store purchase advice: {str(e)}")
    
    def get_purchase_advice(self, pa_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a purchase advice by ID
        
        Args:
            pa_id: Purchase advice identifier
            
        Returns:
            Purchase advice record or None if not found
        """
        try:
            pa = self.tinydb.get_purchase_advice(pa_id)
            
            if pa:
                logger.debug(f"Retrieved purchase advice: {pa_id}")
            else:
                logger.debug(f"Purchase advice not found: {pa_id}")
            
            return pa
            
        except Exception as e:
            logger.error(f"Error retrieving purchase advice {pa_id}: {e}")
            return None
    
    def get_all_purchase_advices(self) -> List[Dict[str, Any]]:
        """
        Get all purchase advice documents
        
        Returns:
            List of purchase advice records
        """
        try:
            purchase_advices = self.tinydb.get_all_purchase_advice()
            logger.debug(f"Retrieved {len(purchase_advices)} purchase advices")
            return purchase_advices
            
        except Exception as e:
            logger.error(f"Error retrieving all purchase advices: {e}")
            return []
    
    def _extract_purchase_advice_id(self, pa_data: Dict[str, Any]) -> str:
        """
        Extract purchase advice ID from purchase advice data
        
        Args:
            pa_data: Raw purchase advice data
            
        Returns:
            Purchase advice ID string
        """
        # Try different possible field names
        id_fields = [
            'purchaseAdviceId', 'purchase_advice_id', 'id',
            'adviceId', 'advice_id', 'paId', 'pa_id',
            'xpLoanNumber', 'loanNumber', 'loan_number'
        ]
        
        # Check direct fields
        for field in id_fields:
            if field in pa_data and pa_data[field]:
                return str(pa_data[field])
        
        # Check nested purchaseAdviceData field
        if 'purchaseAdviceData' in pa_data:
            nested_data = pa_data['purchaseAdviceData']
            for field in id_fields:
                if field in nested_data and nested_data[field]:
                    return str(nested_data[field])
        
        # Check eventMetadata for xpLoanNumber
        if 'eventMetadata' in pa_data:
            metadata = pa_data['eventMetadata']
            if 'xpLoanNumber' in metadata and metadata['xpLoanNumber']:
                return str(metadata['xpLoanNumber'])
        
        # Generate fallback ID
        fallback_id = f"PA_{int(datetime.now().timestamp())}"
        logger.warning(f"No purchase advice ID found, using fallback: {fallback_id}")
        return fallback_id
    
    def _validate_purchase_advice_data(self, pa_data: Dict[str, Any], pa_id: str) -> None:
        """
        Basic validation of purchase advice data
        
        Args:
            pa_data: Raw purchase advice data
            pa_id: Extracted purchase advice ID
            
        Raises:
            ValueError: If validation fails
        """
        if not pa_id:
            raise ValueError("Purchase advice ID is required")
        
        # Check for nested structure
        actual_data = pa_data.get('purchaseAdviceData', pa_data)
        
        # Log warning for missing common fields (don't fail, just warn)
        if not actual_data.get('sellerNumber') and not pa_data.get('sellerNumber'):
            logger.warning(f"Missing sellerNumber for purchase advice {pa_id}")
        
        if not actual_data.get('servicerNumber') and not pa_data.get('servicerNumber'):
            logger.warning(f"Missing servicerNumber for purchase advice {pa_id}")
        
        if not actual_data.get('prinPurchased') and not pa_data.get('prinPurchased'):
            logger.warning(f"Missing prinPurchased amount for purchase advice {pa_id}")


# Singleton instance
_purchase_advice_service = None

def get_purchase_advice_service() -> PurchaseAdviceService:
    """Get singleton purchase advice service instance"""
    global _purchase_advice_service
    if _purchase_advice_service is None:
        _purchase_advice_service = PurchaseAdviceService()
    return _purchase_advice_service