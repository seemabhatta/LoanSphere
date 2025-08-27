from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from services.purchase_advice_service import get_purchase_advice_service

router = APIRouter()

@router.post("/")
async def store_purchase_advice(pa_data: Dict[str, Any]):
    """Store a new purchase advice document"""
    try:
        pa_service = get_purchase_advice_service()
        result = pa_service.store_purchase_advice(pa_data)
        
        return {
            "success": True,
            "purchase_advice": result,
            "message": f"Purchase advice {result['purchase_advice_id']} stored successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store purchase advice: {str(e)}")

@router.get("/")
async def get_purchase_advices():
    """Get all purchase advice documents"""
    try:
        pa_service = get_purchase_advice_service()
        purchase_advices = pa_service.get_all_purchase_advices()
        
        return {
            "success": True,
            "purchase_advices": purchase_advices,
            "total": len(purchase_advices)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get purchase advices: {str(e)}")

@router.get("/{purchase_advice_id}")
async def get_purchase_advice(purchase_advice_id: str):
    """Get purchase advice by ID"""
    try:
        pa_service = get_purchase_advice_service()
        purchase_advice = pa_service.get_purchase_advice(purchase_advice_id)
        
        if not purchase_advice:
            raise HTTPException(status_code=404, detail="Purchase advice not found")
        
        return {
            "success": True,
            "purchase_advice": purchase_advice
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get purchase advice: {str(e)}")