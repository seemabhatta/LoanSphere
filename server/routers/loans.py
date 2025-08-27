from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from services.loan_data_service import get_loan_data_service

router = APIRouter()

@router.get("/")
async def get_loans(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    status: Optional[str] = None
):
    """Get paginated list of loans from loan data service"""
    try:
        loan_data_service = get_loan_data_service()
        all_loan_data = loan_data_service.get_all_loan_data()
        
        # Convert loan data records to loan format for UI
        loans = []
        for loan_data_record in all_loan_data:
            loan = {
                "id": loan_data_record.get('id'),
                "xp_loan_number": loan_data_record.get('id'),
                "tenant_id": "loan_data",
                "status": "loan_data",
                "boarding_readiness": "data_received",
                "boarding_status": "staged",
                "first_pass_yield": False,
                "created_at": loan_data_record.get('processed_at'),
                "metadata": str(loan_data_record.get('loan_data', {}))
            }
            loans.append(loan)
        
        # Apply pagination
        total = len(loans)
        paginated_loans = loans[skip:skip + limit]
        
        return {
            "loans": paginated_loans,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{xp_loan_number}")
async def get_loan(xp_loan_number: str):
    """Get loan by XP loan number"""
    try:
        loan_data_service = get_loan_data_service()
        loan_data = loan_data_service.get_loan_data(xp_loan_number)
        
        if not loan_data:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        return {
            "id": loan_data.get('id'),
            "xp_loan_number": loan_data.get('id'),
            "tenant_id": "loan_data",
            "status": "loan_data",
            "boarding_readiness": "data_received",
            "boarding_status": "staged",
            "first_pass_yield": False,
            "created_at": loan_data.get('processed_at'),
            "loan_data": loan_data.get('loan_data', {})
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
