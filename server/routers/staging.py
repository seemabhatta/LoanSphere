from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import json
import uuid

from database import get_db
from models import StagedFileModel

router = APIRouter()

class StagedFileCreate(BaseModel):
    filename: str
    type: str
    data: dict

class StagedFileResponse(BaseModel):
    id: str
    filename: str
    type: str
    size: int
    uploaded_at: str

@router.post("/stage")
async def stage_file(file_data: StagedFileCreate):
    """Stage a file for processing using TinyDB"""
    try:
        from services.tinydb_service import get_tinydb_service
        
        tinydb = get_tinydb_service()
        
        file_id = tinydb.store_staged_file(
            filename=file_data.filename or f"staged-{int(datetime.now().timestamp())}.json",
            file_type=file_data.type or "unknown",
            data=file_data.data
        )
        
        return {
            "success": True,
            "id": file_id,
            "message": "File staged successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stage file: {str(e)}")

@router.get("/list")
async def list_staged_files():
    """Get all staged files from TinyDB"""
    try:
        from services.tinydb_service import get_tinydb_service
        
        tinydb = get_tinydb_service()
        staged_files = tinydb.get_all_staged_files()
        
        files = [
            {
                "id": file["id"],
                "filename": file["filename"],
                "type": file["type"], 
                "uploaded_at": file["uploaded_at"],
                "size": len(json.dumps(file["data"]))
            }
            for file in staged_files
        ]
        
        return {
            "success": True,
            "files": files,
            "total": len(files)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")

@router.get("/download/{file_id}")
async def download_staged_file(file_id: str):
    """Download a staged file by ID from TinyDB"""
    try:
        from services.tinydb_service import get_tinydb_service
        
        tinydb = get_tinydb_service()
        staged_files = tinydb.get_staged_file(file_id)
        
        if not staged_files:
            raise HTTPException(status_code=404, detail="File not found")
        
        staged_file = staged_files[0]  # get_staged_file returns a list
        
        return {
            "success": True,
            "file": {
                "id": staged_file["id"],
                "filename": staged_file["filename"], 
                "type": staged_file["type"],
                "data": staged_file["data"],
                "uploaded_at": staged_file["uploaded_at"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

@router.delete("/delete/{file_id}")
async def delete_staged_file(file_id: str):
    """Delete a staged file from TinyDB"""
    try:
        from services.tinydb_service import get_tinydb_service
        
        tinydb = get_tinydb_service()
        success = tinydb.delete_staged_file(file_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            "success": True,
            "message": "File deleted"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

# Commitment staging endpoint
@router.post("/stage/commitment")
async def stage_commitment(commitment_data: dict):
    """Stage commitment data (no matching, just store in TinyDB)"""
    try:
        from services.tinydb_service import get_tinydb_service
        
        tinydb = get_tinydb_service()
        
        file_id = tinydb.store_staged_file(
            filename=f"commitment-{int(datetime.now().timestamp())}.json",
            file_type="commitment",
            data=commitment_data
        )
        
        return {
            "success": True,
            "id": file_id,
            "message": "Commitment data staged successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stage commitment: {str(e)}")

@router.post("/stage/uldd")
async def stage_uldd(uldd_data: dict, db: Session = Depends(get_db)):
    """Stage ULDD data"""
    try:
        from services.loan_service import LoanService
        
        loan_service = LoanService(db)
        loan_identifier = uldd_data.get("loanIdentifier", {}).get("originalLoanNumber")
        
        if not loan_identifier:
            raise HTTPException(status_code=400, detail="Missing loan identifier")
        
        # Try to find existing loan or create new one
        existing_loan = await loan_service.get_loan_by_xp_number(loan_identifier)
        
        if existing_loan:
            # Update existing loan with ULDD data
            loan_details = uldd_data.get("loanDetails", {})
            property_data = uldd_data.get("property", {})
            borrower_data = uldd_data.get("borrower", {})
            
            update_data = {
                "note_amount": loan_details.get("noteAmount"),
                "interest_rate": loan_details.get("interestRate"),
                "property_value": property_data.get("appraisedValue"),
                "ltv_ratio": property_data.get("ltvRatio"),
                "credit_score": borrower_data.get("creditScore"),
                "boarding_readiness": "data_received",
                "metadata": json.dumps({
                    **json.loads(existing_loan.metadata or "{}"),
                    "uldd_update": {
                        "staged_at": datetime.now().isoformat(),
                        "original_data": uldd_data
                    }
                })
            }
            
            loan = await loan_service.update_loan(existing_loan.id, update_data)
        else:
            # Create new loan from ULDD
            loan_data = {
                "xp_loan_number": loan_identifier,
                "tenant_id": "staged_uldd",
                "status": "staged",
                "boarding_readiness": "data_received",
                "note_amount": uldd_data.get("loanDetails", {}).get("noteAmount"),
                "interest_rate": uldd_data.get("loanDetails", {}).get("interestRate"),
                "property_value": uldd_data.get("property", {}).get("appraisedValue"),
                "ltv_ratio": uldd_data.get("property", {}).get("ltvRatio"),
                "credit_score": uldd_data.get("borrower", {}).get("creditScore"),
                "metadata": json.dumps({
                    "source": "uldd_staging",
                    "staged_at": datetime.now().isoformat(),
                    "original_data": uldd_data
                })
            }
            
            loan = await loan_service.create_loan(loan_data)
        
        return {
            "success": True,
            "loan": {
                "xp_loan_number": loan.xp_loan_number,
                "id": loan.id,
                "status": loan.status
            },
            "message": "ULDD data staged successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stage ULDD: {str(e)}")

@router.post("/stage/purchase")
async def stage_purchase_advice(purchase_data: dict):
    """Stage purchase advice data (no matching, just store in TinyDB)"""
    try:
        from services.tinydb_service import get_tinydb_service
        
        tinydb = get_tinydb_service()
        
        file_id = tinydb.store_staged_file(
            filename=f"purchase-advice-{int(datetime.now().timestamp())}.json",
            file_type="purchase_advice",
            data=purchase_data
        )
        
        return {
            "success": True,
            "id": file_id,
            "message": "Purchase advice data staged successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stage purchase advice: {str(e)}")

@router.post("/stage/loan")
async def stage_loan_data(loan_data: dict):
    """Stage generic loan data (no matching, just store in TinyDB)"""
    try:
        from services.tinydb_service import get_tinydb_service
        
        tinydb = get_tinydb_service()
        
        file_id = tinydb.store_staged_file(
            filename=f"loan-data-{int(datetime.now().timestamp())}.json",
            file_type="loan_data",
            data=loan_data
        )
        
        return {
            "success": True,
            "id": file_id,
            "message": "Loan data staged successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stage loan data: {str(e)}")

@router.post("/stage/documents")
async def stage_documents(documents_data: dict):
    """Stage documents metadata (no matching, just store in TinyDB)"""
    try:
        from services.tinydb_service import get_tinydb_service
        
        tinydb = get_tinydb_service()
        
        file_id = tinydb.store_staged_file(
            filename=f"documents-{int(datetime.now().timestamp())}.json",
            file_type="documents",
            data=documents_data
        )
        
        return {
            "success": True,
            "id": file_id,
            "message": "Documents staged successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stage documents: {str(e)}")

@router.post("/process")
async def process_file_with_tracking(request_data: dict):
    """Process file data: move to TinyDB and create/update loan tracking record"""
    try:
        from services.loan_tracking_service import LoanTrackingService
        
        file_data = request_data.get("fileData")
        file_type = request_data.get("fileType", "unknown")
        source_file_id = request_data.get("sourceFileId", "unknown")
        
        if not file_data:
            raise HTTPException(status_code=400, detail="Missing file data")
        
        # Use loan tracking service to process file (no SQL session needed)
        tracking_service = LoanTrackingService()
        result = tracking_service.process_file_to_nosql(file_data, file_type, source_file_id)
        
        # Handle different response formats based on file type
        if result.get("tracking_record"):
            # Regular processing with loan tracking
            return {
                "success": True,
                "xpLoanNumber": result["xp_loan_number"],
                "action": result["action"],  # "created" or "updated"
                "trackingRecord": {
                    "xpLoanNumber": result["tracking_record"]["xpLoanNumber"],
                    "tenantId": result["tracking_record"]["tenantId"],
                    "externalIds": result["tracking_record"]["externalIds"],
                    "status": result["tracking_record"]["status"],
                    "metaData": result["tracking_record"]["metaData"]
                },
                "message": f"{file_type.replace('_', ' ').title()} processed successfully - tracking record {result['action']}"
            }
        else:
            # Commitment processing - no loan tracking
            return {
                "success": True,
                "commitmentId": result.get("commitment_id"),
                "action": result["action"],
                "documentRecordId": result["document_record_id"],
                "message": f"{file_type.replace('_', ' ').title()} processed successfully - {result['action']}"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

@router.get("/tracking")
async def get_loan_tracking_records():
    """Get all loan tracking records from TinyDB"""
    try:
        from services.loan_tracking_service import LoanTrackingService
        
        tracking_service = LoanTrackingService()
        records = tracking_service.get_all_tracking_records()
        
        return {
            "success": True,
            "records": records,
            "total": len(records)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tracking records: {str(e)}")

@router.get("/stats")
async def get_database_stats():
    """Get TinyDB database statistics"""
    try:
        from services.tinydb_service import get_tinydb_service
        
        tinydb = get_tinydb_service()
        stats = tinydb.get_database_stats()
        
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")