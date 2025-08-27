"""
Simple Commitment Service
Handles storing and retrieving commitment documents in TinyDB collection
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from loguru import logger

from services.tinydb_service import get_tinydb_service


class CommitmentService:
    """Simple service for commitment storage and retrieval"""
    
    def __init__(self):
        self.tinydb = get_tinydb_service()
    
    def store_commitment(self, commitment_data: Dict[str, Any], source_file_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Store a commitment document
        
        Args:
            commitment_data: Raw commitment data
            source_file_id: Optional source file reference
            
        Returns:
            Stored commitment record with metadata
        """
        try:
            # Basic validation
            if not commitment_data:
                raise ValueError("Commitment data cannot be empty")
            
            # Extract commitment ID
            commitment_id = self._extract_commitment_id(commitment_data)
            
            # Validate required fields
            self._validate_commitment_data(commitment_data, commitment_id)
            
            # Store in TinyDB
            doc_id = self.tinydb.store_commitment(
                commitment_id=commitment_id,
                commitment_data=commitment_data,
                source_file_id=source_file_id or f"manual_{datetime.now().timestamp()}"
            )
            
            logger.info(f"Stored commitment: {commitment_id}")
            
            return {
                "id": commitment_id,
                "doc_id": doc_id,
                "commitment_id": commitment_id,
                "stored_at": datetime.now().isoformat(),
                "status": "stored"
            }
            
        except Exception as e:
            logger.error(f"Error storing commitment: {e}")
            raise ValueError(f"Failed to store commitment: {str(e)}")
    
    def get_commitment(self, commitment_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a commitment by ID
        
        Args:
            commitment_id: Commitment identifier
            
        Returns:
            Commitment record or None if not found
        """
        try:
            commitment = self.tinydb.get_commitment(commitment_id)
            
            if commitment:
                logger.debug(f"Retrieved commitment: {commitment_id}")
                # Transform to UI format
                return self._transform_commitment_for_ui(commitment)
            else:
                logger.debug(f"Commitment not found: {commitment_id}")
            
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving commitment {commitment_id}: {e}")
            return None
    
    def get_all_commitments(self) -> List[Dict[str, Any]]:
        """
        Get all commitment documents
        
        Returns:
            List of commitment records
        """
        try:
            commitments = self.tinydb.get_all_commitments()
            logger.debug(f"Retrieved {len(commitments)} commitments")
            
            # Transform all commitments to UI format
            transformed_commitments = []
            for commitment in commitments:
                transformed = self._transform_commitment_for_ui(commitment)
                if transformed:
                    transformed_commitments.append(transformed)
            
            return transformed_commitments
            
        except Exception as e:
            logger.error(f"Error retrieving all commitments: {e}")
            return []
    
    def _extract_commitment_id(self, commitment_data: Dict[str, Any]) -> str:
        """
        Extract commitment ID from commitment data
        
        Args:
            commitment_data: Raw commitment data
            
        Returns:
            Commitment ID string
        """
        # Try different possible field names
        id_fields = [
            'commitmentId', 'commitment_id', 'id',
            'commitmentNo', 'commitment_no'
        ]
        
        # Check direct fields
        for field in id_fields:
            if field in commitment_data and commitment_data[field]:
                return str(commitment_data[field])
        
        # Check nested commitmentData field
        if 'commitmentData' in commitment_data:
            nested_data = commitment_data['commitmentData']
            for field in id_fields:
                if field in nested_data and nested_data[field]:
                    return str(nested_data[field])
        
        # Generate fallback ID
        fallback_id = f"COMMITMENT_{int(datetime.now().timestamp())}"
        logger.warning(f"No commitment ID found, using fallback: {fallback_id}")
        return fallback_id
    
    def _validate_commitment_data(self, commitment_data: Dict[str, Any], commitment_id: str) -> None:
        """
        Basic validation of commitment data
        
        Args:
            commitment_data: Raw commitment data
            commitment_id: Extracted commitment ID
            
        Raises:
            ValueError: If validation fails
        """
        if not commitment_id:
            raise ValueError("Commitment ID is required")
        
        # Check for nested structure
        actual_data = commitment_data.get('commitmentData', commitment_data)
        
        # Log warning for missing common fields (don't fail, just warn)
        if not actual_data.get('investorLoanNumber'):
            logger.warning(f"Missing investorLoanNumber for commitment {commitment_id}")
        
        if not actual_data.get('sellerNumber'):
            logger.warning(f"Missing sellerNumber for commitment {commitment_id}")
    
    def _transform_commitment_for_ui(self, commitment: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Transform TinyDB commitment format to UI-expected format
        
        Args:
            commitment: Raw TinyDB commitment record
            
        Returns:
            Transformed commitment for UI consumption
        """
        try:
            if not commitment:
                return None
            
            # Extract commitment data
            commitment_data = commitment.get('commitment_data', {})
            
            return {
                "id": commitment.get('id'),
                "commitmentId": commitment_data.get('commitmentId') or commitment.get('id'),
                "investorLoanNumber": commitment_data.get('investorLoanNumber'),
                "agency": self._detect_agency_from_data(commitment_data),
                "status": commitment_data.get('status', 'staged').lower(),
                "data": commitment_data,  # UI expects 'data' field
                "createdAt": commitment.get('processed_at'),  # UI expects 'createdAt'
                "updatedAt": commitment.get('processed_at'),
                "metadata": {
                    "source": "commitment_upload",  # UI expects 'metadata.source'
                    "stagedAt": commitment.get('processed_at'),
                    "sourceFileId": commitment.get('source_file_id')
                }
            }
        except Exception as e:
            logger.error(f"Error transforming commitment for UI: {e}")
            return None
    
    def _detect_agency_from_data(self, commitment_data: Dict[str, Any]) -> str:
        """Detect agency from commitment data"""
        commitment_id = commitment_data.get('commitmentId', '')
        
        if commitment_id.startswith('FNMA'):
            return 'fannie_mae'
        elif commitment_id.startswith('FHLMC'):
            return 'freddie_mac' 
        elif commitment_id.startswith('GNMA'):
            return 'ginnie_mae'
        
        return 'unknown'


# Singleton instance
_commitment_service = None

def get_commitment_service() -> CommitmentService:
    """Get singleton commitment service instance"""
    global _commitment_service
    if _commitment_service is None:
        _commitment_service = CommitmentService()
    return _commitment_service