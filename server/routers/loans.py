from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
from services.loan_service import LoanService
from models import LoanModel

router = APIRouter()

@router.get("/")
async def get_loans(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    status: Optional[str] = None
):
    """Get paginated list of loans - Using TinyDB now"""
    try:
        # Return empty loans list since we're using TinyDB staging system
        loans = []
        
        # Filter by status if provided
        if status:
            loans = [loan for loan in loans if loan.status == status]
        
        return {
            "loans": [],
            "total": 0,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{xp_loan_number}")
async def get_loan(xp_loan_number: str, db: Session = Depends(get_db)):
    """Get loan by XP loan number"""
    try:
        loan_service = LoanService(db)
        loan = await loan_service.get_loan_by_xp_number(xp_loan_number)
        
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        return {
            "id": loan.id,
            "xp_loan_number": loan.xp_loan_number,
            "tenant_id": loan.tenant_id,
            "seller_name": loan.seller_name,
            "seller_number": loan.seller_number,
            "servicer_number": loan.servicer_number,
            "status": loan.status,
            "product": loan.product,
            "commitment_id": loan.commitment_id,
            "note_amount": float(loan.note_amount) if loan.note_amount else None,
            "interest_rate": float(loan.interest_rate) if loan.interest_rate else None,
            "pass_thru_rate": float(loan.pass_thru_rate) if loan.pass_thru_rate else None,
            "property_value": float(loan.property_value) if loan.property_value else None,
            "ltv_ratio": float(loan.ltv_ratio) if loan.ltv_ratio else None,
            "credit_score": loan.credit_score,
            "boarding_readiness": loan.boarding_readiness,
            "boarding_status": loan.boarding_status,
            "first_pass_yield": loan.first_pass_yield,
            "time_to_board": loan.time_to_board,
            "metadata": loan.metadata,
            "created_at": loan.created_at.isoformat() if loan.created_at else None,
            "updated_at": loan.updated_at.isoformat() if loan.updated_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest")
async def ingest_loan_data(loan_data: dict, db: Session = Depends(get_db)):
    """Ingest loan data from various sources"""
    try:
        loan_service = LoanService(db)
        result = await loan_service.process_loan_data(loan_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{xp_loan_number}/status")
async def update_loan_status(
    xp_loan_number: str, 
    status_data: dict,
    db: Session = Depends(get_db)
):
    """Update loan status"""
    try:
        loan_service = LoanService(db)
        loan = await loan_service.get_loan_by_xp_number(xp_loan_number)
        
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        new_status = status_data.get("status")
        metadata = status_data.get("metadata")
        
        updated_loan = await loan_service.update_loan_status(loan.id, new_status, metadata)
        
        return {
            "id": updated_loan.id,
            "xp_loan_number": updated_loan.xp_loan_number,
            "status": updated_loan.status,
            "updated_at": updated_loan.updated_at.isoformat() if updated_loan.updated_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{xp_loan_number}/board")
async def start_boarding_process(xp_loan_number: str, db: Session = Depends(get_db)):
    """Start the boarding process for a loan"""
    try:
        loan_service = LoanService(db)
        loan = await loan_service.get_loan_by_xp_number(xp_loan_number)
        
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        # Update status to boarding_in_progress
        await loan_service.update_loan_status(
            loan.id, 
            "boarding_in_progress",
            {"boarding_started": datetime.now().isoformat()}
        )
        
        # Log pipeline activity
        await loan_service.log_pipeline_activity(
            loan_id=loan.id,
            xp_loan_number=xp_loan_number,
            activity_type="boarding_started",
            status="SUCCESS",
            message="Boarding process initiated",
            agent_name="System"
        )
        
        return {
            "status": "success",
            "message": "Boarding process started",
            "xp_loan_number": xp_loan_number
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics/dashboard")
async def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Get dashboard metrics"""
    try:
        loan_service = LoanService(db)
        metrics = await loan_service.get_dashboard_metrics()
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/activity/recent")
async def get_recent_activity(
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db)
):
    """Get recent pipeline activity"""
    try:
        loan_service = LoanService(db)
        activity = await loan_service.get_recent_pipeline_activity(limit=limit)
        return {"activity": activity}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
