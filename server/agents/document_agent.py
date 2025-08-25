import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from loguru import logger

from services.loan_service import LoanService
from services.document_service import DocumentService

class DocumentAgent:
    def __init__(self, loan_service: LoanService, websocket_manager):
        self.loan_service = loan_service
        self.websocket_manager = websocket_manager
        self.status = "idle"
        self.current_task = None
        self.last_activity = datetime.now()
        self.tasks_completed = 0
        self.tasks_errored = 0
        
        # Initialize document service (would normally be injected)
        from database import SessionLocal
        db = SessionLocal()
        self.document_service = DocumentService(db)

    async def get_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "name": "DocumentAgent",
            "type": "document",
            "status": self.status,
            "current_task": self.current_task,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "tasks_completed": self.tasks_completed,
            "tasks_errored": self.tasks_errored
        }

    async def process_documents(self, xp_loan_number: str, document_ids: list = None) -> Dict[str, Any]:
        """Process documents for a loan"""
        try:
            self.status = "running"
            self.current_task = f"Processing documents for {xp_loan_number}"
            self.last_activity = datetime.now()
            
            await self._broadcast_status_update()
            
            # Get loan data
            loan = await self.loan_service.get_loan_by_xp_number(xp_loan_number)
            if not loan:
                raise ValueError(f"Loan not found: {xp_loan_number}")
            
            # Get documents to process
            if document_ids:
                documents = []
                for doc_id in document_ids:
                    doc = await self.document_service.get_documents(document_id=doc_id)
                    if doc:
                        documents.extend(doc)
            else:
                # Get all documents for the loan
                documents = await self.document_service.get_documents(xp_loan_number=xp_loan_number)
            
            processing_results = []
            
            for document in documents:
                result = await self._process_single_document(document)
                processing_results.append(result)
                
                # Log activity
                await self.loan_service.log_pipeline_activity(
                    loan_id=loan.id,
                    xp_loan_number=xp_loan_number,
                    activity_type="document_processed",
                    status="SUCCESS" if result["status"] == "success" else "ERROR",
                    message=f"Document {document.xp_doc_id} processed",
                    agent_name="DocumentAgent"
                )
            
            self.tasks_completed += 1
            self.status = "idle"
            self.current_task = None
            
            await self._broadcast_status_update()
            
            return {
                "status": "success",
                "documents_processed": len(processing_results),
                "results": processing_results
            }
            
        except Exception as e:
            logger.error(f"Error processing documents: {e}")
            self.tasks_errored += 1
            self.status = "error"
            await self._broadcast_status_update()
            
            return {
                "status": "error",
                "error": str(e)
            }

    async def _process_single_document(self, document) -> Dict[str, Any]:
        """Process a single document through OCR, classification, and extraction"""
        try:
            # OCR Processing
            ocr_result = await self._perform_ocr(document)
            if ocr_result["status"] != "success":
                return {"document_id": document.id, "status": "error", "stage": "ocr", "error": ocr_result.get("error")}
            
            # Classification
            classification_result = await self._classify_document(document, ocr_result["text"])
            if classification_result["status"] != "success":
                return {"document_id": document.id, "status": "error", "stage": "classification", "error": classification_result.get("error")}
            
            # Data Extraction
            extraction_result = await self._extract_data(document, ocr_result["text"], classification_result["document_type"])
            if extraction_result["status"] != "success":
                return {"document_id": document.id, "status": "error", "stage": "extraction", "error": extraction_result.get("error")}
            
            # Validation
            validation_result = await self._validate_extracted_data(document, extraction_result["extracted_data"])
            
            # Update document with final status
            final_status = "completed" if validation_result["status"] == "success" else "validation_failed"
            await self.document_service.update_document_status(
                document.id,
                final_status,
                {
                    "ocr_status": "completed",
                    "classification_status": "completed",
                    "extraction_status": "completed",
                    "validation_status": "completed" if validation_result["status"] == "success" else "failed"
                }
            )
            
            return {
                "document_id": document.id,
                "status": "success",
                "ocr_result": ocr_result,
                "classification_result": classification_result,
                "extraction_result": extraction_result,
                "validation_result": validation_result
            }
            
        except Exception as e:
            logger.error(f"Error processing document {document.id}: {e}")
            return {
                "document_id": document.id,
                "status": "error",
                "error": str(e)
            }

    async def _perform_ocr(self, document) -> Dict[str, Any]:
        """Perform OCR on document"""
        try:
            # Update status
            await self.document_service.update_document_status(
                document.id,
                "processing",
                {"ocr_status": "processing"}
            )
            
            # Simulate OCR processing
            await asyncio.sleep(0.5)  # Simulate processing time
            
            # Mock OCR text based on document type
            ocr_text = self._generate_mock_ocr_text(document.document_type)
            
            # Update status
            await self.document_service.update_document_status(
                document.id,
                "processing",
                {"ocr_status": "completed"}
            )
            
            return {
                "status": "success",
                "text": ocr_text,
                "confidence": 0.95
            }
            
        except Exception as e:
            await self.document_service.update_document_status(
                document.id,
                "error",
                {"ocr_status": "failed"}
            )
            return {"status": "error", "error": str(e)}

    async def _classify_document(self, document, ocr_text: str) -> Dict[str, Any]:
        """Classify document type"""
        try:
            # Update status
            await self.document_service.update_document_status(
                document.id,
                "processing",
                {"classification_status": "processing"}
            )
            
            # Simulate classification processing
            await asyncio.sleep(0.3)
            
            # Use existing document type or classify from OCR text
            document_type = document.document_type
            confidence = 0.92
            
            # Update status
            await self.document_service.update_document_status(
                document.id,
                "processing",
                {"classification_status": "completed"}
            )
            
            return {
                "status": "success",
                "document_type": document_type,
                "confidence": confidence
            }
            
        except Exception as e:
            await self.document_service.update_document_status(
                document.id,
                "error",
                {"classification_status": "failed"}
            )
            return {"status": "error", "error": str(e)}

    async def _extract_data(self, document, ocr_text: str, document_type: str) -> Dict[str, Any]:
        """Extract structured data from document"""
        try:
            # Update status
            await self.document_service.update_document_status(
                document.id,
                "processing",
                {"extraction_status": "processing"}
            )
            
            # Simulate data extraction processing
            await asyncio.sleep(0.4)
            
            # Extract data based on document type
            extracted_data = self._extract_fields_by_type(document_type, ocr_text)
            
            # Update document with extracted data
            document.extracted_data = extracted_data
            
            # Update status
            await self.document_service.update_document_status(
                document.id,
                "processing",
                {"extraction_status": "completed"}
            )
            
            return {
                "status": "success",
                "extracted_data": extracted_data
            }
            
        except Exception as e:
            await self.document_service.update_document_status(
                document.id,
                "error",
                {"extraction_status": "failed"}
            )
            return {"status": "error", "error": str(e)}

    async def _validate_extracted_data(self, document, extracted_data: dict) -> Dict[str, Any]:
        """Validate extracted data"""
        try:
            # Update status
            await self.document_service.update_document_status(
                document.id,
                "processing",
                {"validation_status": "processing"}
            )
            
            # Simulate validation processing
            await asyncio.sleep(0.2)
            
            # Perform validation checks
            validation_results = {
                "valid": True,
                "issues": [],
                "confidence_score": 0.88
            }
            
            # Check for missing required fields
            required_fields = self._get_required_fields(document.document_type)
            for field in required_fields:
                if field not in extracted_data or not extracted_data[field]:
                    validation_results["issues"].append(f"Missing required field: {field}")
                    validation_results["valid"] = False
            
            # Update status
            status = "completed" if validation_results["valid"] else "failed"
            await self.document_service.update_document_status(
                document.id,
                "processing",
                {"validation_status": status}
            )
            
            return {
                "status": "success" if validation_results["valid"] else "validation_failed",
                "validation_results": validation_results
            }
            
        except Exception as e:
            await self.document_service.update_document_status(
                document.id,
                "error",
                {"validation_status": "failed"}
            )
            return {"status": "error", "error": str(e)}

    def _generate_mock_ocr_text(self, document_type: str) -> str:
        """Generate mock OCR text for different document types"""
        if document_type == "Appraisal":
            return "UNIFORM RESIDENTIAL APPRAISAL REPORT\nProperty Value: $295,000\nEffective Date: April 9, 2025\nAppraiser: John Smith"
        elif document_type == "Income_Documentation":
            return "EMPLOYMENT VERIFICATION\nMonthly Income: $8,764\nEmployer: ABC Corporation\nEmployment Status: Full-time"
        elif document_type == "Credit_Report":
            return "CREDIT REPORT\nCredit Score: 785\nReport Date: April 15, 2025\nRepository: Equifax"
        else:
            return f"Document Type: {document_type}\nContent extracted via OCR"

    def _extract_fields_by_type(self, document_type: str, ocr_text: str) -> dict:
        """Extract fields based on document type"""
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

    def _get_required_fields(self, document_type: str) -> list:
        """Get required fields for document type"""
        if document_type == "Appraisal":
            return ["property_value", "appraisal_date"]
        elif document_type == "Income_Documentation":
            return ["monthly_income", "employment_status"]
        elif document_type == "Credit_Report":
            return ["credit_score", "report_date"]
        else:
            return []

    async def _broadcast_status_update(self):
        """Broadcast agent status update via WebSocket"""
        try:
            status = await self.get_status()
            await self.websocket_manager.broadcast({
                "type": "agent_status_update",
                "agent": "document",
                "data": status,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Error broadcasting status update: {e}")
