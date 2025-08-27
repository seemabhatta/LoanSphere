from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import json
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
                "metadata": json.dumps(loan_data_record.get('loan_data', {}))
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
async def ingest_loan_data(loan_data: dict):
    """Ingest loan data from various sources - using loan data service"""
    try:
        loan_data_service = get_loan_data_service()
        result = loan_data_service.store_loan_data(loan_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{xp_loan_number}/status")
async def update_loan_status(
    xp_loan_number: str, 
    status_data: dict
):
    """Update loan status - placeholder for loan data service"""
    try:
        # For now, just return success - loan data service doesn't have status updates yet
        return {
            "id": xp_loan_number,
            "xp_loan_number": xp_loan_number,
            "status": status_data.get("status", "updated"),
            "message": "Status update not implemented for loan data service"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{xp_loan_number}/board")
async def start_boarding_process(xp_loan_number: str):
    """Start the boarding process for a loan - placeholder"""
    try:
        # For now, just return success - boarding process not implemented for loan data service
        return {
            "status": "success",
            "message": "Boarding process not implemented for loan data service",
            "xp_loan_number": xp_loan_number
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics/dashboard")
async def get_dashboard_metrics():
    """Get dashboard metrics - placeholder"""
    try:
        # Return basic metrics based on loan data service
        loan_data_service = get_loan_data_service()
        all_loans = loan_data_service.get_all_loan_data()
        
        return {
            "total_loans": len(all_loans),
            "fpy": 0,
            "ttb": 0,
            "auto_clear_rate": 0,
            "open_exceptions": 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/activity/recent")
async def get_recent_activity(
    limit: int = Query(10, le=50)
):
    """Get recent pipeline activity - placeholder"""
    try:
        # Return empty activity for now
        return {"activity": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
