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
    
    def __init__(self, db_path: str = "data"):
        """Initialize separate TinyDB files for each collection"""
        self.db_path = db_path
        
        # Ensure directory exists
        os.makedirs(os.path.abspath(db_path), exist_ok=True)
        
        # Initialize separate TinyDB files for each collection
        self.stage_db = TinyDB(
            os.path.join(db_path, "stage.json"),
            storage=CachingMiddleware(JSONStorage),
            indent=2
        )
        self.commitments_db = TinyDB(
            os.path.join(db_path, "commitments.json"),
            storage=CachingMiddleware(JSONStorage),
            indent=2
        )
        self.loan_data_db = TinyDB(
            os.path.join(db_path, "loan_data.json"),
            storage=CachingMiddleware(JSONStorage),
            indent=2
        )
        self.purchase_advice_db = TinyDB(
            os.path.join(db_path, "purchase_advice.json"),
            storage=CachingMiddleware(JSONStorage),
            indent=2
        )
        self.documents_metadata_db = TinyDB(
            os.path.join(db_path, "documents_metadata.json"),
            storage=CachingMiddleware(JSONStorage),
            indent=2
        )
        self.loan_tracking_db = TinyDB(
            os.path.join(db_path, "loan_tracking.json"),
            storage=CachingMiddleware(JSONStorage),
            indent=2
        )
        self.exceptions_db = TinyDB(
            os.path.join(db_path, "exceptions.json"),
            storage=CachingMiddleware(JSONStorage),
            indent=2
        )
        
        # Get collection references (default tables in each file)
        self.stage = self.stage_db
        self.commitments = self.commitments_db
        self.loan_data = self.loan_data_db
        self.purchase_advice = self.purchase_advice_db
        self.documents_metadata = self.documents_metadata_db
        self.loan_tracking = self.loan_tracking_db
        self.exceptions = self.exceptions_db
        
        logger.info(f"TinyDB initialized at: {os.path.abspath(db_path)}")
    
    def close(self):
        """Close all database connections"""
        self.stage_db.close()
        self.commitments_db.close()
        self.loan_data_db.close()
        self.purchase_advice_db.close()
        self.exceptions_db.close()
        self.documents_metadata_db.close()
        self.loan_tracking_db.close()
    
    # Stage Collection Operations
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
        
        self.stage.insert(staged_file)
        self.stage_db.storage.flush()  # Flush to disk immediately
        logger.info(f"Stored staged file: {file_id}")
        return file_id
    
    def get_staged_file(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get a staged file by ID"""
        File = Query()
        return self.stage.search(File.id == file_id)
    
    def get_all_staged_files(self) -> List[Dict[str, Any]]:
        """Get all staged files"""
        return self.stage.all()
    
    def delete_staged_file(self, file_id: str) -> bool:
        """Delete a staged file"""
        File = Query()
        result = self.stage.remove(File.id == file_id)
        if result:
            logger.info(f"Deleted staged file: {file_id}")
            return True
        return False
    
    # Document Operations for specific collections
    def store_commitment(self, commitment_id: str, commitment_data: Dict[str, Any], source_file_id: str) -> str:
        """Store a commitment document"""
        commitment = {
            'id': commitment_id,
            'commitment_data': commitment_data,
            'source_file_id': source_file_id,
            'processed_at': datetime.now().isoformat()
        }
        
        doc_id = self.commitments.insert(commitment)
        self.commitments_db.storage.flush()  # Flush to disk immediately
        logger.info(f"Stored commitment: {commitment_id}")
        return str(doc_id)
    
    def store_loan_data(self, loan_data_id: str, loan_data: Dict[str, Any], source_file_id: str) -> str:
        """Store loan data document"""
        document = {
            'id': loan_data_id,
            'loan_data': loan_data,
            'source_file_id': source_file_id,
            'processed_at': datetime.now().isoformat()
        }
        
        doc_id = self.loan_data.insert(document)
        self.loan_data_db.storage.flush()  # Flush to disk immediately
        logger.info(f"Stored loan data: {loan_data_id}")
        return str(doc_id)
    
    def store_purchase_advice(self, purchase_advice_id: str, purchase_data: Dict[str, Any], source_file_id: str) -> str:
        """Store purchase advice document"""
        document = {
            'id': purchase_advice_id,
            'purchase_data': purchase_data,
            'source_file_id': source_file_id,
            'processed_at': datetime.now().isoformat()
        }
        
        doc_id = self.purchase_advice.insert(document)
        self.purchase_advice_db.storage.flush()  # Flush to disk immediately
        logger.info(f"Stored purchase advice: {purchase_advice_id}")
        return str(doc_id)
    
    def store_document_metadata(self, metadata_id: str, metadata: Dict[str, Any]) -> str:
        """Store document metadata"""
        metadata_record = {
            'id': metadata_id,
            'metadata': metadata,
            'created_at': datetime.now().isoformat()
        }
        
        doc_id = self.documents_metadata.insert(metadata_record)
        self.documents_metadata_db.storage.flush()  # Flush to disk immediately
        logger.info(f"Stored document metadata: {metadata_id}")
        return str(doc_id)
    
    def get_commitment(self, commitment_id: str) -> Optional[Dict[str, Any]]:
        """Get a commitment by ID"""
        Doc = Query()
        results = self.commitments.search(Doc.id == commitment_id)
        return results[0] if results else None
    
    def get_loan_data(self, loan_data_id: str) -> Optional[Dict[str, Any]]:
        """Get loan data by ID"""
        Doc = Query()
        results = self.loan_data.search(Doc.id == loan_data_id)
        return results[0] if results else None
    
    def get_purchase_advice(self, purchase_advice_id: str) -> Optional[Dict[str, Any]]:
        """Get purchase advice by ID"""
        Doc = Query()
        results = self.purchase_advice.search(Doc.id == purchase_advice_id)
        return results[0] if results else None
    
    def get_all_commitments(self) -> List[Dict[str, Any]]:
        """Get all commitments"""
        return self.commitments.all()
    
    def get_all_loan_data(self) -> List[Dict[str, Any]]:
        """Get all loan data"""
        return self.loan_data.all()
    
    def get_all_purchase_advice(self) -> List[Dict[str, Any]]:
        """Get all purchase advice"""
        return self.purchase_advice.all()
    
    def get_all_documents_metadata(self) -> List[Dict[str, Any]]:
        """Get all document metadata"""
        return self.documents_metadata.all()
    
    def get_document_metadata(self, metadata_id: str) -> Optional[Dict[str, Any]]:
        """Get document metadata by ID"""
        Doc = Query()
        results = self.documents_metadata.search(Doc.id == metadata_id)
        return results[0] if results else None
    
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
        self.loan_tracking_db.storage.flush()  # Flush to disk immediately
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
            self.loan_tracking_db.storage.flush()  # Flush to disk immediately
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
            'stage_count': len(self.stage),
            'commitments_count': len(self.commitments),
            'loan_data_count': len(self.loan_data),
            'purchase_advice_count': len(self.purchase_advice),
            'documents_metadata_count': len(self.documents_metadata),
            'loan_tracking_count': len(self.loan_tracking),
            'collections': {
                'stage': len(self.stage),
                'commitments': len(self.commitments),
                'loan_data': len(self.loan_data),
                'purchase_advice': len(self.purchase_advice),
                'documents_metadata': len(self.documents_metadata),
                'loan_tracking': len(self.loan_tracking)
            },
            'database_directory': os.path.abspath(self.db_path)
        }
    
    def backup_database(self, backup_path: str) -> bool:
        """Create a backup of all database files"""
        try:
            import shutil
            os.makedirs(backup_path, exist_ok=True)
            
            # Copy each collection file
            files = [
                "stage.json", "commitments.json", "loan_data.json",
                "purchase_advice.json", "documents_metadata.json", "loan_tracking.json"
            ]
            
            for file in files:
                source = os.path.join(self.db_path, file)
                if os.path.exists(source):
                    shutil.copy2(source, backup_path)
            
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
        _tinydb_service = TinyDBService("data")
    return _tinydb_service

def close_tinydb():
    """Close the TinyDB connection"""
    global _tinydb_service
    if _tinydb_service:
        _tinydb_service.close()
        _tinydb_service = None