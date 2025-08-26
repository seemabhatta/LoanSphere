from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from services.tinydb_service import get_tinydb_service

router = APIRouter()

@router.get("/")
async def get_commitments():
    """Get all commitment documents from TinyDB"""
    try:
        tinydb = get_tinydb_service()
        commitments = tinydb.get_all_commitments()
        
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
        tinydb = get_tinydb_service()
        commitment = tinydb.get_commitment(commitment_id)
        
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