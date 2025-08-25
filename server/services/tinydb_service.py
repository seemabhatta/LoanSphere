"""
TinyDB Service for NoSQL Document Storage
"""
try:
    from tinydb import TinyDB, Query
    from tinydb.storages import JSONStorage
    from tinydb.middlewares import CachingMiddleware
except ImportError:
    # Fallback if TinyDB is not installed
    print("TinyDB not installed. Please run: pip install tinydb>=4.8.0")
    raise ImportError("TinyDB package is required but not installed")
from typing import Optional, Dict, Any, List
import os
from datetime import datetime
from loguru import logger


class TinyDBService:
    """Service for managing TinyDB document storage"""
    
    def __init__(self, db_path: str = "loan_sphere.json"):
        """Initialize TinyDB with caching for better performance"""
        self.db_path = db_path
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        
        # Initialize TinyDB with caching middleware for better performance
        self.db = TinyDB(
            db_path,
            storage=CachingMiddleware(JSONStorage),
            indent=2  # Pretty JSON formatting
        )
        
        # Get table references
        self.loan_tracking = self.db.table('loan_tracking')
        self.processed_documents = self.db.table('processed_documents')
        self.staged_files = self.db.table('staged_files')  # Keep staging in TinyDB too
        
        logger.info(f"TinyDB initialized at: {os.path.abspath(db_path)}")
    
    def close(self):
        """Close the database connection"""
        self.db.close()
    
    # Staged Files Operations
    def store_staged_file(self, filename: str, file_type: str, data: Dict[str, Any]) -> str:
        """Store a staged file and return its ID"""
        file_id = f"staged_{int(datetime.now().timestamp() * 1000)}"
        
        staged_file = {
            'id': file_id,
            'filename': filename,
            'type': file_type,
            'data': data,
            'uploaded_at': datetime.now().isoformat()
        }
        
        self.staged_files.insert(staged_file)
        logger.info(f"Stored staged file: {file_id}")
        return file_id
    
    def get_staged_file(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get a staged file by ID"""
        File = Query()
        return self.staged_files.search(File.id == file_id)
    
    def get_all_staged_files(self) -> List[Dict[str, Any]]:
        """Get all staged files"""
        return self.staged_files.all()
    
    def delete_staged_file(self, file_id: str) -> bool:
        """Delete a staged file"""
        File = Query()
        result = self.staged_files.remove(File.id == file_id)
        if result:
            logger.info(f"Deleted staged file: {file_id}")
            return True
        return False
    
    # Processed Documents Operations
    def store_processed_document(self, document_id: str, collection: str, 
                               document_data: Dict[str, Any], source_file_id: str) -> str:
        """Store a processed document"""
        doc_record_id = f"doc_{int(datetime.now().timestamp() * 1000)}"
        
        document = {
            'id': doc_record_id,
            'document_id': document_id,
            'collection': collection,
            'document_data': document_data,
            'source_file_id': source_file_id,
            'processed_at': datetime.now().isoformat()
        }
        
        self.processed_documents.insert(document)
        logger.info(f"Stored processed document: {document_id} in collection: {collection}")
        return doc_record_id
    
    def get_processed_document(self, document_id: str, collection: str) -> Optional[Dict[str, Any]]:
        """Get a processed document by ID and collection"""
        Doc = Query()
        results = self.processed_documents.search(
            (Doc.document_id == document_id) & (Doc.collection == collection)
        )
        return results[0] if results else None
    
    def get_documents_by_collection(self, collection: str) -> List[Dict[str, Any]]:
        """Get all documents in a collection"""
        Doc = Query()
        return self.processed_documents.search(Doc.collection == collection)
    
    # Loan Tracking Operations
    def create_loan_tracking_record(self, xp_loan_number: str, tenant_id: str,
                                  external_ids: Dict[str, Any], status: Dict[str, Any],
                                  metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new loan tracking record"""
        tracking_record = {
            'xpLoanNumber': xp_loan_number,
            'tenantId': tenant_id,
            'externalIds': external_ids,
            'status': status,
            'metaData': metadata,
            'createdAt': datetime.now().isoformat(),
            'updatedAt': datetime.now().isoformat()
        }
        
        doc_id = self.loan_tracking.insert(tracking_record)
        tracking_record['_doc_id'] = doc_id  # TinyDB's internal ID
        
        logger.info(f"Created loan tracking record: {xp_loan_number}")
        return tracking_record
    
    def update_loan_tracking_record(self, xp_loan_number: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing loan tracking record"""
        Loan = Query()
        
        # Add updatedAt timestamp
        updates['updatedAt'] = datetime.now().isoformat()
        
        # Update the record
        result = self.loan_tracking.update(updates, Loan.xpLoanNumber == xp_loan_number)
        
        if result:
            # Return the updated record
            updated_record = self.loan_tracking.search(Loan.xpLoanNumber == xp_loan_number)[0]
            logger.info(f"Updated loan tracking record: {xp_loan_number}")
            return updated_record
        
        return None
    
    def get_loan_tracking_record(self, xp_loan_number: str) -> Optional[Dict[str, Any]]:
        """Get a loan tracking record by XP loan number"""
        Loan = Query()
        results = self.loan_tracking.search(Loan.xpLoanNumber == xp_loan_number)
        return results[0] if results else None
    
    def find_loan_tracking_by_external_ids(self, identifiers: Dict[str, List[str]]) -> Optional[Dict[str, Any]]:
        """Find loan tracking record by external identifiers"""
        Loan = Query()
        
        # Search by XP loan number first
        loan_numbers = identifiers.get('loan_numbers', [])
        for loan_num in loan_numbers:
            results = self.loan_tracking.search(Loan.xpLoanNumber == loan_num)
            if results:
                return results[0]
        
        # Search by external IDs
        commitment_ids = identifiers.get('commitment_ids', [])
        servicer_numbers = identifiers.get('servicer_numbers', [])
        
        # Get all records and search in external IDs
        all_records = self.loan_tracking.all()
        for record in all_records:
            external_ids = record.get('externalIds', {})
            
            # Check commitment IDs
            for comm_id in commitment_ids:
                if (external_ids.get('commitmentId') == comm_id or
                    external_ids.get('investorCommitmentId') == comm_id):
                    return record
            
            # Check loan numbers in external IDs
            for loan_num in loan_numbers:
                if (external_ids.get('aggregatorLoanNumber') == loan_num or
                    external_ids.get('correspondentLoanNumber') == loan_num or
                    external_ids.get('investorLoanNumber') == loan_num):
                    return record
        
        return None
    
    def get_all_loan_tracking_records(self) -> List[Dict[str, Any]]:
        """Get all loan tracking records"""
        return self.loan_tracking.all()
    
    # Query and Analytics
    def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        return {
            'staged_files_count': len(self.staged_files),
            'processed_documents_count': len(self.processed_documents),
            'loan_tracking_records_count': len(self.loan_tracking),
            'collections': {
                'commitment': len(self.get_documents_by_collection('commitment')),
                'purchaseAdvice': len(self.get_documents_by_collection('purchaseAdvice')),
                'uldd': len(self.get_documents_by_collection('uldd'))
            },
            'database_path': os.path.abspath(self.db_path)
        }
    
    def backup_database(self, backup_path: str) -> bool:
        """Create a backup of the database"""
        try:
            import shutil
            shutil.copy2(self.db_path, backup_path)
            logger.info(f"Database backed up to: {backup_path}")
            return True
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            return False


# Global TinyDB instance
_tinydb_service = None

def get_tinydb_service() -> TinyDBService:
    """Get the global TinyDB service instance"""
    global _tinydb_service
    if _tinydb_service is None:
        _tinydb_service = TinyDBService("data/loan_sphere.json")
    return _tinydb_service

def close_tinydb():
    """Close the TinyDB connection"""
    global _tinydb_service
    if _tinydb_service:
        _tinydb_service.close()
        _tinydb_service = None