from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from services.loan_data_service import get_loan_data_service

router = APIRouter()

@router.post("/")
async def store_loan_data(loan_data: Dict[str, Any]):
    """Store a new loan data document (ULDD/MISMO format)"""
    try:
        loan_data_service = get_loan_data_service()
        result = loan_data_service.store_loan_data(loan_data)
        
        return {
            "success": True,
            "loan_data": result,
            "message": f"Loan data {result['loan_data_id']} stored successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store loan data: {str(e)}")

@router.get("/")
async def get_loan_data():
    """Get all loan data documents"""
    try:
        loan_data_service = get_loan_data_service()
        loan_data_records = loan_data_service.get_all_loan_data()
        
        return {
            "success": True,
            "loan_data": loan_data_records,
            "total": len(loan_data_records)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get loan data: {str(e)}")

@router.get("/{loan_data_id}")
async def get_loan_data_by_id(loan_data_id: str):
    """Get loan data by ID"""
    try:
        loan_data_service = get_loan_data_service()
        loan_data = loan_data_service.get_loan_data(loan_data_id)
        
        if not loan_data:
            raise HTTPException(status_code=404, detail="Loan data not found")
        
        return {
            "success": True,
            "loan_data": loan_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get loan data: {str(e)}")