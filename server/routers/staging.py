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
async def stage_file(file_data: StagedFileCreate, db: Session = Depends(get_db)):
    """Stage a file for processing"""
    try:
        staged_file = StagedFileModel(
            id=str(uuid.uuid4()),
            filename=file_data.filename or f"staged-{int(datetime.now().timestamp())}.json",
            type=file_data.type or "unknown",
            data=json.dumps(file_data.data),
            uploaded_at=datetime.now()
        )
        
        db.add(staged_file)
        db.commit()
        db.refresh(staged_file)
        
        return {
            "success": True,
            "id": staged_file.id,
            "message": "File staged successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stage file: {str(e)}")

@router.get("/list")
async def list_staged_files(db: Session = Depends(get_db)):
    """Get all staged files"""
    try:
        staged_files = db.query(StagedFileModel).all()
        
        files = [
            {
                "id": file.id,
                "filename": file.filename,
                "type": file.type,
                "uploaded_at": file.uploaded_at.isoformat(),
                "size": len(file.data)
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
async def download_staged_file(file_id: str, db: Session = Depends(get_db)):
    """Download a staged file by ID"""
    try:
        staged_file = db.query(StagedFileModel).filter(StagedFileModel.id == file_id).first()
        
        if not staged_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            "success": True,
            "file": {
                "id": staged_file.id,
                "filename": staged_file.filename,
                "type": staged_file.type,
                "data": json.loads(staged_file.data),
                "uploaded_at": staged_file.uploaded_at.isoformat()
            }
        }
    except Exception as e:
        if "File not found" in str(e):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

@router.delete("/delete/{file_id}")
async def delete_staged_file(file_id: str, db: Session = Depends(get_db)):
    """Delete a staged file"""
    try:
        staged_file = db.query(StagedFileModel).filter(StagedFileModel.id == file_id).first()
        
        if not staged_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        db.delete(staged_file)
        db.commit()
        
        return {
            "success": True,
            "message": "File deleted"
        }
    except Exception as e:
        if "File not found" in str(e):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

# Commitment staging endpoint
@router.post("/stage/commitment")
async def stage_commitment(commitment_data: dict, db: Session = Depends(get_db)):
    """Stage commitment data and create loan"""
    try:
        from services.loan_service import LoanService
        
        # Extract commitment data
        commitment_id = commitment_data.get("commitmentId") or commitment_data.get("commitmentData", {}).get("commitmentId")
        investor_loan_number = commitment_data.get("investorLoanNumber") or commitment_data.get("commitmentData", {}).get("investorLoanNumber")
        
        if not commitment_id and not investor_loan_number:
            raise HTTPException(
                status_code=400, 
                detail="Missing required commitment fields"
            )
        
        # Use fallback values
        final_commitment_id = commitment_id or f"GEN_{int(datetime.now().timestamp())}"
        final_loan_number = investor_loan_number or f"LN_{int(datetime.now().timestamp())}"
        
        # Extract commitment details
        actual_commitment_data = commitment_data.get("commitmentData", commitment_data)
        
        # Create loan from commitment
        loan_service = LoanService(db)
        loan_data = {
            "xp_loan_number": final_loan_number,
            "tenant_id": "staged_commitment", 
            "commitment_id": final_commitment_id,
            "seller_name": actual_commitment_data.get("sellerName", "Unknown Seller"),
            "seller_number": actual_commitment_data.get("sellerNumber"),
            "servicer_number": actual_commitment_data.get("servicerNumber"),
            "status": "staged",
            "product": actual_commitment_data.get("product", "Unknown"),
            "boarding_readiness": "data_received",
            "commitment_date": datetime.fromisoformat(actual_commitment_data["commitmentDate"]) if actual_commitment_data.get("commitmentDate") else None,
            "expiration_date": datetime.fromisoformat(actual_commitment_data["expirationDate"]) if actual_commitment_data.get("expirationDate") else None,
            "current_commitment_amount": actual_commitment_data.get("currentCommitmentAmount"),
            "metadata": json.dumps({
                "source": "commitment_staging",
                "staged_at": datetime.now().isoformat(),
                "original_data": commitment_data
            })
        }
        
        loan = await loan_service.create_loan(loan_data)
        
        return {
            "success": True,
            "loan": {
                "xp_loan_number": loan.xp_loan_number,
                "id": loan.id,
                "status": loan.status,
                "commitment_id": final_commitment_id
            },
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
async def stage_purchase_advice(purchase_data: dict, db: Session = Depends(get_db)):
    """Stage purchase advice data"""
    try:
        from services.loan_service import LoanService
        
        # Extract purchase advice data with flexible field handling
        loan_number = (
            purchase_data.get("loanNumber") or 
            purchase_data.get("investorLoanNumber") or 
            purchase_data.get("loan_number") or
            f"PA_{int(datetime.now().timestamp())}"
        )
        
        seller_name = (
            purchase_data.get("sellerName") or
            purchase_data.get("seller_name") or
            purchase_data.get("originatorName") or
            "Unknown Seller"
        )
        
        # Create loan from purchase advice
        loan_service = LoanService(db)
        loan_data = {
            "xp_loan_number": loan_number,
            "tenant_id": "staged_purchase_advice",
            "seller_name": seller_name,
            "status": "staged",
            "product": purchase_data.get("product", "Unknown"),
            "boarding_readiness": "data_received",
            "purchased_amount": purchase_data.get("purchaseAmount"),
            "note_amount": purchase_data.get("noteAmount"),
            "upb_amount": purchase_data.get("upbAmount"),
            "metadata": json.dumps({
                "source": "purchase_advice_staging",
                "staged_at": datetime.now().isoformat(),
                "original_data": purchase_data
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
            "message": "Purchase advice data staged successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stage purchase advice: {str(e)}")

@router.post("/stage/loan")
async def stage_loan_data(loan_data: dict, db: Session = Depends(get_db)):
    """Stage generic loan data"""
    try:
        from services.loan_service import LoanService
        
        # Extract loan identifier with flexible field handling
        loan_identifier = (
            loan_data.get("loanNumber") or
            loan_data.get("loan_number") or
            loan_data.get("loanId") or
            loan_data.get("originalLoanNumber") or
            loan_data.get("investorLoanNumber") or
            # Check nested structures
            loan_data.get("loanIdentifier", {}).get("originalLoanNumber") or
            loan_data.get("loan_identifier", {}).get("original_loan_number") or
            f"LD_{int(datetime.now().timestamp())}"
        )
        
        # Extract loan details with flexible field handling
        loan_details = loan_data.get("loanDetails", loan_data)
        property_data = loan_data.get("property", loan_data)
        borrower_data = loan_data.get("borrower", loan_data)
        
        loan_service = LoanService(db)
        
        # Try to find existing loan or create new one
        existing_loan = await loan_service.get_loan_by_xp_number(loan_identifier)
        
        if existing_loan:
            # Update existing loan with new data
            update_data = {
                "note_amount": (
                    loan_details.get("noteAmount") or
                    loan_details.get("note_amount") or
                    loan_data.get("noteAmount")
                ),
                "interest_rate": (
                    loan_details.get("interestRate") or
                    loan_details.get("interest_rate") or
                    loan_data.get("interestRate")
                ),
                "property_value": (
                    property_data.get("appraisedValue") or
                    property_data.get("appraised_value") or
                    loan_data.get("propertyValue")
                ),
                "ltv_ratio": (
                    property_data.get("ltvRatio") or
                    property_data.get("ltv_ratio") or
                    loan_data.get("ltvRatio")
                ),
                "credit_score": (
                    borrower_data.get("creditScore") or
                    borrower_data.get("credit_score") or
                    loan_data.get("creditScore")
                ),
                "boarding_readiness": "data_received",
                "metadata": json.dumps({
                    **json.loads(existing_loan.metadata or "{}"),
                    "loan_data_update": {
                        "staged_at": datetime.now().isoformat(),
                        "original_data": loan_data
                    }
                })
            }
            
            loan = await loan_service.update_loan(existing_loan.id, update_data)
        else:
            # Create new loan from loan data
            new_loan_data = {
                "xp_loan_number": loan_identifier,
                "tenant_id": "staged_loan_data",
                "status": "staged",
                "boarding_readiness": "data_received",
                "note_amount": (
                    loan_details.get("noteAmount") or
                    loan_details.get("note_amount") or
                    loan_data.get("noteAmount")
                ),
                "interest_rate": (
                    loan_details.get("interestRate") or
                    loan_details.get("interest_rate") or
                    loan_data.get("interestRate")
                ),
                "property_value": (
                    property_data.get("appraisedValue") or
                    property_data.get("appraised_value") or
                    loan_data.get("propertyValue")
                ),
                "ltv_ratio": (
                    property_data.get("ltvRatio") or
                    property_data.get("ltv_ratio") or
                    loan_data.get("ltvRatio")
                ),
                "credit_score": (
                    borrower_data.get("creditScore") or
                    borrower_data.get("credit_score") or
                    loan_data.get("creditScore")
                ),
                "upb_amount": loan_data.get("upbAmount") or loan_data.get("upb_amount"),
                "seller_name": loan_data.get("originatorName") or loan_data.get("sellerName"),
                "metadata": json.dumps({
                    "source": "loan_data_staging",
                    "staged_at": datetime.now().isoformat(),
                    "original_data": loan_data
                })
            }
            
            loan = await loan_service.create_loan(new_loan_data)
        
        return {
            "success": True,
            "loan": {
                "xp_loan_number": loan.xp_loan_number,
                "id": loan.id,
                "status": loan.status
            },
            "message": "Loan data staged successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stage loan data: {str(e)}")