from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from models import DocumentModel, LoanModel
from loguru import logger

class DocumentService:
    def __init__(self, db: Session):
        self.db = db

    async def create_document(self, document_data: dict) -> DocumentModel:
        """Create a new document record"""
        try:
            document = DocumentModel(**document_data)
            self.db.add(document)
            self.db.commit()
            self.db.refresh(document)
            
            logger.info(f"Document created: {document.xp_doc_id} for loan {document.xp_loan_number}")
            return document
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating document: {e}")
            raise

    async def get_documents(
        self,
        xp_loan_number: Optional[str] = None,
        document_type: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[DocumentModel]:
        """Get paginated list of documents with filters"""
        query = self.db.query(DocumentModel)
        
        if xp_loan_number:
            query = query.filter_by(xp_loan_number=xp_loan_number)
        if document_type:
            query = query.filter_by(document_type=document_type)
        if status:
            query = query.filter_by(status=status)
            
        return query.order_by(desc(DocumentModel.created_at)).offset(skip).limit(limit).all()

    async def update_document_status(
        self,
        document_id: str,
        status: str,
        stage_status: Optional[Dict[str, str]] = None
    ) -> DocumentModel:
        """Update document processing status"""
        document = self.db.query(DocumentModel).filter_by(id=document_id).first()
        if not document:
            raise ValueError(f"Document not found: {document_id}")
        
        document.status = status
        document.updated_at = datetime.now()
        
        # Update individual stage statuses
        if stage_status:
            if "ocr_status" in stage_status:
                document.ocr_status = stage_status["ocr_status"]
            if "classification_status" in stage_status:
                document.classification_status = stage_status["classification_status"]
            if "extraction_status" in stage_status:
                document.extraction_status = stage_status["extraction_status"]
            if "validation_status" in stage_status:
                document.validation_status = stage_status["validation_status"]
        
        self.db.commit()
        self.db.refresh(document)
        
        logger.info(f"Document status updated: {document_id} -> {status}")
        return document

    async def get_processing_pipeline_status(self) -> Dict[str, Any]:
        """Get document processing pipeline status"""
        try:
            # OCR Processing
            ocr_pending = self.db.query(DocumentModel).filter_by(ocr_status="pending").count()
            ocr_processing = self.db.query(DocumentModel).filter_by(ocr_status="processing").count()
            ocr_completed = self.db.query(DocumentModel).filter_by(ocr_status="completed").count()
            ocr_total = ocr_pending + ocr_processing + ocr_completed
            ocr_progress = (ocr_completed / ocr_total * 100) if ocr_total > 0 else 0

            # Classification
            class_pending = self.db.query(DocumentModel).filter_by(classification_status="pending").count()
            class_processing = self.db.query(DocumentModel).filter_by(classification_status="processing").count()
            class_completed = self.db.query(DocumentModel).filter_by(classification_status="completed").count()
            class_total = class_pending + class_processing + class_completed
            class_progress = (class_completed / class_total * 100) if class_total > 0 else 0

            # Data Extraction
            extract_pending = self.db.query(DocumentModel).filter_by(extraction_status="pending").count()
            extract_processing = self.db.query(DocumentModel).filter_by(extraction_status="processing").count()
            extract_completed = self.db.query(DocumentModel).filter_by(extraction_status="completed").count()
            extract_total = extract_pending + extract_processing + extract_completed
            extract_progress = (extract_completed / extract_total * 100) if extract_total > 0 else 0

            # Validation
            valid_pending = self.db.query(DocumentModel).filter_by(validation_status="pending").count()
            valid_processing = self.db.query(DocumentModel).filter_by(validation_status="processing").count()
            valid_completed = self.db.query(DocumentModel).filter_by(validation_status="completed").count()
            valid_total = valid_pending + valid_processing + valid_completed
            valid_progress = (valid_completed / valid_total * 100) if valid_total > 0 else 0

            return {
                "ocr_processing": {
                    "queue": ocr_pending + ocr_processing,
                    "completed": ocr_completed,
                    "progress": round(ocr_progress, 1)
                },
                "classification": {
                    "queue": class_pending + class_processing,
                    "completed": class_completed,
                    "progress": round(class_progress, 1)
                },
                "extraction": {
                    "queue": extract_pending + extract_processing,
                    "completed": extract_completed,
                    "progress": round(extract_progress, 1)
                },
                "validation": {
                    "queue": valid_pending + valid_processing,
                    "completed": valid_completed,
                    "progress": round(valid_progress, 1)
                }
            }
        except Exception as e:
            logger.error(f"Error getting processing pipeline status: {e}")
            return {
                "ocr_processing": {"queue": 0, "completed": 0, "progress": 0},
                "classification": {"queue": 0, "completed": 0, "progress": 0},
                "extraction": {"queue": 0, "completed": 0, "progress": 0},
                "validation": {"queue": 0, "completed": 0, "progress": 0}
            }

    async def process_document_from_data(self, document_data: dict) -> Dict[str, Any]:
        """Process document data and create document record"""
        try:
            # Extract document information
            xp_loan_number = document_data.get("xpLoanNumber")
            if not xp_loan_number:
                raise ValueError("No XP loan number found in document data")

            # Find associated loan
            loan = self.db.query(LoanModel).filter_by(xp_loan_number=xp_loan_number).first()
            
            doc_data = {
                "loan_id": loan.id if loan else None,
                "xp_loan_number": xp_loan_number,
                "xp_doc_guid": document_data.get("xpDocGUID"),
                "xp_doc_id": document_data.get("xpDocId"),
                "document_type": document_data.get("documentType"),
                "status": "pending",
                "s3_location": document_data.get("links", {}).get("location"),
                "metadata": {
                    "external_ids": document_data.get("externalIds", {}),
                    "raw_data": document_data
                }
            }
            
            document = await self.create_document(doc_data)
            
            # Start processing pipeline
            await self._start_document_processing(document)
            
            return {
                "status": "success",
                "document_id": document.id,
                "xp_doc_id": document.xp_doc_id
            }
            
        except Exception as e:
            logger.error(f"Error processing document data: {e}")
            raise

    async def _start_document_processing(self, document: DocumentModel):
        """Start the document processing pipeline"""
        try:
            # Update status to processing
            await self.update_document_status(
                document.id,
                "processing",
                {"ocr_status": "processing"}
            )
            
            # Simulate OCR processing
            await self._simulate_ocr_processing(document)
            
        except Exception as e:
            logger.error(f"Error starting document processing: {e}")

    async def _simulate_ocr_processing(self, document: DocumentModel):
        """Simulate OCR processing"""
        try:
            # Update to completed
            await self.update_document_status(
                document.id,
                "processing",
                {
                    "ocr_status": "completed",
                    "classification_status": "processing"
                }
            )
            
            # Simulate classification
            await self._simulate_classification(document)
            
        except Exception as e:
            logger.error(f"Error in OCR processing simulation: {e}")

    async def _simulate_classification(self, document: DocumentModel):
        """Simulate document classification"""
        try:
            # Update to completed
            await self.update_document_status(
                document.id,
                "processing",
                {
                    "classification_status": "completed",
                    "extraction_status": "processing"
                }
            )
            
            # Simulate data extraction
            await self._simulate_data_extraction(document)
            
        except Exception as e:
            logger.error(f"Error in classification simulation: {e}")

    async def _simulate_data_extraction(self, document: DocumentModel):
        """Simulate data extraction"""
        try:
            # Mock extracted data based on document type
            extracted_data = self._generate_mock_extracted_data(document.document_type)
            
            # Update document with extracted data
            document.extracted_data = extracted_data
            await self.update_document_status(
                document.id,
                "processing",
                {
                    "extraction_status": "completed",
                    "validation_status": "processing"
                }
            )
            
            # Simulate validation
            await self._simulate_validation(document)
            
        except Exception as e:
            logger.error(f"Error in data extraction simulation: {e}")

    async def _simulate_validation(self, document: DocumentModel):
        """Simulate data validation"""
        try:
            # Update to completed
            await self.update_document_status(
                document.id,
                "completed",
                {"validation_status": "completed"}
            )
            
            logger.info(f"Document processing completed: {document.xp_doc_id}")
            
        except Exception as e:
            logger.error(f"Error in validation simulation: {e}")

    def _generate_mock_extracted_data(self, document_type: str) -> dict:
        """Generate mock extracted data based on document type"""
        if document_type == "Appraisal":
            return {
                "property_value": 295000,
                "appraisal_date": "2025-04-09",
                "appraiser_name": "John Smith",
                "property_address": "3407 Wakefield Dr, Columbia, MO 65203"
            }
        elif document_type == "Income_Documentation":
            return {
                "monthly_income": 8764,
                "employment_status": "Full-time",
                "employer": "ABC Corporation"
            }
        elif document_type == "Credit_Report":
            return {
                "credit_score": 785,
                "report_date": "2025-04-15",
                "credit_repository": "Equifax"
            }
        else:
            return {
                "document_type": document_type,
                "extraction_timestamp": datetime.now().isoformat()
            }
