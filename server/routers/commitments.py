from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from services.commitment_service import get_commitment_service

router = APIRouter()

@router.post("/")
async def store_commitment(commitment_data: Dict[str, Any]):
    """Store a new commitment document"""
    try:
        commitment_service = get_commitment_service()
        result = commitment_service.store_commitment(commitment_data)
        
        return {
            "success": True,
            "commitment": result,
            "message": f"Commitment {result['commitment_id']} stored successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store commitment: {str(e)}")

@router.get("/")
async def get_commitments():
    """Get all commitment documents"""
    try:
        commitment_service = get_commitment_service()
        commitments = commitment_service.get_all_commitments()
        
        return {
            "success": True,
            "commitments": commitments,
            "total": len(commitments)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get commitments: {str(e)}")

@router.get("/{commitment_id}")
async def get_commitment(commitment_id: str):
    """Get commitment by ID"""
    try:
        commitment_service = get_commitment_service()
        commitment = commitment_service.get_commitment(commitment_id)
        
        if not commitment:
            raise HTTPException(status_code=404, detail="Commitment not found")
        
        return {
            "success": True,
            "commitment": commitment
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get commitment: {str(e)}")