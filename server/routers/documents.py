from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from services.document_service import DocumentService

router = APIRouter()

@router.get("/")
async def get_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    xp_loan_number: Optional[str] = None,
    document_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get paginated list of documents"""
    try:
        document_service = DocumentService(db)
        documents = await document_service.get_documents(
            xp_loan_number=xp_loan_number,
            document_type=document_type,
            status=status,
            skip=skip,
            limit=limit
        )
        
        return {
            "documents": [
                {
                    "id": doc.id,
                    "loan_id": doc.loan_id,
                    "xp_loan_number": doc.xp_loan_number,
                    "xp_doc_guid": doc.xp_doc_guid,
                    "xp_doc_id": doc.xp_doc_id,
                    "document_type": doc.document_type,
                    "status": doc.status,
                    "ocr_status": doc.ocr_status,
                    "classification_status": doc.classification_status,
                    "extraction_status": doc.extraction_status,
                    "validation_status": doc.validation_status,
                    "s3_location": doc.s3_location,
                    "extracted_data": doc.extracted_data,
                    "metadata": doc.metadata,
                    "created_at": doc.created_at.isoformat() if doc.created_at else None,
                    "updated_at": doc.updated_at.isoformat() if doc.updated_at else None
                }
                for doc in documents
            ],
            "total": len(documents),
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{document_id}")
async def get_document(document_id: str, db: Session = Depends(get_db)):
    """Get document by ID"""
    try:
        from models import DocumentModel
        document = db.query(DocumentModel).filter_by(id=document_id).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {
            "id": document.id,
            "loan_id": document.loan_id,
            "xp_loan_number": document.xp_loan_number,
            "xp_doc_guid": document.xp_doc_guid,
            "xp_doc_id": document.xp_doc_id,
            "document_type": document.document_type,
            "status": document.status,
            "ocr_status": document.ocr_status,
            "classification_status": document.classification_status,
            "extraction_status": document.extraction_status,
            "validation_status": document.validation_status,
            "s3_location": document.s3_location,
            "extracted_data": document.extracted_data,
            "metadata": document.metadata,
            "created_at": document.created_at.isoformat() if document.created_at else None,
            "updated_at": document.updated_at.isoformat() if document.updated_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest")
async def ingest_document_data(document_data: dict, db: Session = Depends(get_db)):
    """Ingest document data"""
    try:
        document_service = DocumentService(db)
        result = await document_service.process_document_from_data(document_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{document_id}/status")
async def update_document_status(
    document_id: str,
    status_data: dict,
    db: Session = Depends(get_db)
):
    """Update document processing status"""
    try:
        document_service = DocumentService(db)
        
        status = status_data.get("status")
        stage_status = status_data.get("stage_status", {})
        
        updated_document = await document_service.update_document_status(
            document_id, status, stage_status
        )
        
        return {
            "id": updated_document.id,
            "status": updated_document.status,
            "ocr_status": updated_document.ocr_status,
            "classification_status": updated_document.classification_status,
            "extraction_status": updated_document.extraction_status,
            "validation_status": updated_document.validation_status,
            "updated_at": updated_document.updated_at.isoformat() if updated_document.updated_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pipeline/status")
async def get_processing_pipeline_status(db: Session = Depends(get_db)):
    """Get document processing pipeline status"""
    try:
        document_service = DocumentService(db)
        status = await document_service.get_processing_pipeline_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{document_id}/process")
async def process_document(document_id: str, db: Session = Depends(get_db)):
    """Start processing a document"""
    try:
        from models import DocumentModel
        document = db.query(DocumentModel).filter_by(id=document_id).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document_service = DocumentService(db)
        await document_service._start_document_processing(document)
        
        return {
            "document_id": document_id,
            "status": "processing_started",
            "message": "Document processing initiated"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/summary")
async def get_document_stats(db: Session = Depends(get_db)):
    """Get document statistics summary"""
    try:
        from models import DocumentModel
        
        # Get counts by status
        total_documents = db.query(DocumentModel).count()
        pending_docs = db.query(DocumentModel).filter_by(status="pending").count()
        processing_docs = db.query(DocumentModel).filter_by(status="processing").count()
        completed_docs = db.query(DocumentModel).filter_by(status="completed").count()
        error_docs = db.query(DocumentModel).filter_by(status="error").count()
        
        # Get counts by document type
        doc_types = db.query(DocumentModel.document_type).distinct().all()
        type_counts = {}
        for doc_type in doc_types:
            if doc_type[0]:
                count = db.query(DocumentModel).filter_by(document_type=doc_type[0]).count()
                type_counts[doc_type[0]] = count
        
        return {
            "total_documents": total_documents,
            "by_status": {
                "pending": pending_docs,
                "processing": processing_docs,
                "completed": completed_docs,
                "error": error_docs
            },
            "by_type": type_counts,
            "processing_rate": round((completed_docs / total_documents * 100) if total_documents > 0 else 0, 1)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
