from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from services.tinydb_service import get_tinydb_service
import json
from datetime import datetime

router = APIRouter()

@router.get("/")
async def get_documents():
    """Get all document metadata from TinyDB"""
    try:
        tinydb = get_tinydb_service()
        documents = tinydb.get_all_documents_metadata()
        
        # If no documents exist, create sample data
        if not documents:
            sample_documents = [
                # Original PDF blob that gets split into multiple documents
                {
                    "id": "BLOB_001_XP12345",
                    "metadata": {
                        "xp_doc_id": "BLOB_001_XP12345", 
                        "xp_loan_number": "XP12345",
                        "document_type": "Loan Package (PDF Blob)",
                        "status": "completed",
                        "ocr_status": "completed",
                        "classification_status": "completed", 
                        "extraction_status": "completed",
                        "validation_status": "completed",
                        "split_count": 3
                    }
                },
                # Split document 1 from the blob
                {
                    "id": "DOC_001_1_XP12345",
                    "metadata": {
                        "xp_doc_id": "DOC_001_1_XP12345", 
                        "xp_loan_number": "XP12345",
                        "document_type": "Appraisal",
                        "status": "completed",
                        "ocr_status": "completed",
                        "classification_status": "completed", 
                        "extraction_status": "completed",
                        "validation_status": "completed",
                        "parent_doc_id": "BLOB_001_XP12345",
                        "is_split_document": True,
                        "extracted_data": {
                            "property_value": 450000,
                            "appraiser": "ABC Appraisal Co",
                            "appraisal_date": "2024-08-20"
                        }
                    }
                },
                # Split document 2 from the blob
                {
                    "id": "DOC_001_2_XP12345", 
                    "metadata": {
                        "xp_doc_id": "DOC_001_2_XP12345",
                        "xp_loan_number": "XP12345", 
                        "document_type": "Credit Report",
                        "status": "processing",
                        "ocr_status": "completed",
                        "classification_status": "completed",
                        "extraction_status": "processing", 
                        "validation_status": "pending",
                        "parent_doc_id": "BLOB_001_XP12345",
                        "is_split_document": True
                    }
                },
                # Split document 3 from the blob
                {
                    "id": "DOC_001_3_XP12345", 
                    "metadata": {
                        "xp_doc_id": "DOC_001_3_XP12345",
                        "xp_loan_number": "XP12345", 
                        "document_type": "W2 Form",
                        "status": "completed",
                        "ocr_status": "completed",
                        "classification_status": "completed",
                        "extraction_status": "completed", 
                        "validation_status": "completed",
                        "parent_doc_id": "BLOB_001_XP12345",
                        "is_split_document": True
                    }
                },
                # Single document (not from a blob)
                {
                    "id": "DOC_003_XP67890",
                    "metadata": {
                        "xp_doc_id": "DOC_003_XP67890",
                        "xp_loan_number": "XP67890",
                        "document_type": "Income Documentation", 
                        "status": "error",
                        "ocr_status": "completed",
                        "classification_status": "completed",
                        "extraction_status": "failed",
                        "validation_status": "pending"
                    }
                },
                # Another blob currently being processed
                {
                    "id": "BLOB_002_XP67890",
                    "metadata": {
                        "xp_doc_id": "BLOB_002_XP67890", 
                        "xp_loan_number": "XP67890",
                        "document_type": "Loan Package (PDF Blob)",
                        "status": "processing",
                        "ocr_status": "processing",
                        "classification_status": "pending", 
                        "extraction_status": "pending",
                        "validation_status": "pending",
                        "split_count": 2
                    }
                }
            ]
            
            # Store sample documents
            for doc in sample_documents:
                tinydb.store_document_metadata(doc["id"], doc["metadata"])
                
            # Retrieve the newly created documents
            documents = tinydb.get_all_documents_metadata()
        
        # Transform TinyDB documents to match expected format
        formatted_documents = []
        for doc in documents:
            metadata = doc.get('metadata', {})
            formatted_doc = {
                'id': doc.get('id', ''),
                'xp_doc_id': metadata.get('xp_doc_id', doc.get('id', '')),
                'xp_loan_number': metadata.get('xp_loan_number', 'Unknown'),
                'document_type': metadata.get('document_type', 'Unknown'),
                'status': metadata.get('status', 'pending'),
                'ocr_status': metadata.get('ocr_status', 'pending'),
                'classification_status': metadata.get('classification_status', 'pending'),
                'extraction_status': metadata.get('extraction_status', 'pending'),
                'validation_status': metadata.get('validation_status', 'pending'),
                'created_at': doc.get('created_at', datetime.now().isoformat()),
                'updated_at': metadata.get('updated_at', doc.get('created_at', datetime.now().isoformat())),
                'extracted_data': metadata.get('extracted_data'),
                'parent_doc_id': metadata.get('parent_doc_id'),
                'is_split_document': metadata.get('is_split_document', False),
                'split_count': metadata.get('split_count')
            }
            formatted_documents.append(formatted_doc)
        
        return {
            "success": True,
            "documents": formatted_documents,
            "total": len(formatted_documents)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {str(e)}")

@router.get("/{document_id}")
async def get_document(document_id: str):
    """Get document by ID"""
    try:
        tinydb = get_tinydb_service()
        document = tinydb.get_document_metadata(document_id)
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {
            "success": True,
            "document": document
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get document: {str(e)}")

# Additional endpoints for pipeline status and stats (returning minimal data)
@router.get("/pipeline/status")
async def get_pipeline_status():
    """Get pipeline status - simplified for TinyDB"""
    return {
        "ocr_processing": {"queue": 0, "progress": 100},
        "classification": {"completed": 3, "progress": 100}, 
        "extraction": {"completed": 2, "progress": 67},
        "validation": {"queue": 1, "progress": 33}
    }

@router.get("/stats/summary") 
async def get_stats_summary():
    """Get document stats summary - simplified for TinyDB"""
    try:
        tinydb = get_tinydb_service()
        documents = tinydb.get_all_documents_metadata()
        
        total = len(documents)
        by_status = {}
        by_type = {}
        
        for doc in documents:
            metadata = doc.get('metadata', {})
            status = metadata.get('status', 'unknown')
            doc_type = metadata.get('document_type', 'unknown')
            
            by_status[status] = by_status.get(status, 0) + 1
            by_type[doc_type] = by_type.get(doc_type, 0) + 1
        
        return {
            "total_documents": total,
            "processing_rate": 67,
            "by_status": by_status,
            "by_type": by_type
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")