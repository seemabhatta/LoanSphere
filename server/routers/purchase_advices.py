from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from services.tinydb_service import get_tinydb_service

router = APIRouter()

@router.get("/")
async def get_purchase_advices():
    """Get all purchase advice documents from TinyDB"""
    try:
        tinydb = get_tinydb_service()
        purchase_advices = tinydb.get_all_purchase_advice()
        
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
        tinydb = get_tinydb_service()
        purchase_advice = tinydb.get_purchase_advice(purchase_advice_id)
        
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