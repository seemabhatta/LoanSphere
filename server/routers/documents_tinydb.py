from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from services.tinydb_service import get_tinydb_service

router = APIRouter()

@router.get("/")
async def get_documents():
    """Get all document metadata from TinyDB"""
    try:
        tinydb = get_tinydb_service()
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
                'created_at': doc.get('created_at', ''),
                'updated_at': metadata.get('updated_at', doc.get('created_at', '')),
                'extracted_data': metadata.get('extracted_data')
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