from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from services.tinydb_service import TinyDBService
from services.tinydb_exception_service import TinyDBExceptionService

router = APIRouter()

# Initialize TinyDB services
tinydb_service = TinyDBService()
exception_service = TinyDBExceptionService(tinydb_service)

@router.get("/")
async def get_exceptions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None
):
    """Get paginated list of exceptions"""
    try:
        exceptions = exception_service.get_exceptions(
            status=status, 
            severity=severity, 
            category=category,
            skip=skip, 
            limit=limit
        )
        
        # Calculate age for each exception
        from datetime import datetime
        for exception in exceptions:
            if exception.get('detected_at'):
                try:
                    detected = datetime.fromisoformat(exception['detected_at'].replace('Z', '+00:00'))
                    days_old = (datetime.now() - detected.replace(tzinfo=None)).days
                    exception['days_old'] = days_old
                except:
                    exception['days_old'] = 0
            else:
                exception['days_old'] = 0
        
        return exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{exception_id}")
async def get_exception(exception_id: str):
    """Get exception by ID"""
    try:
        exception = exception_service.get_exception_by_id(exception_id)
        
        if not exception:
            raise HTTPException(status_code=404, detail="Exception not found")
        
        return exception
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{exception_id}/resolve")
async def resolve_exception(
    exception_id: str,
    resolution_data: dict
):
    """Resolve an exception"""
    try:
        resolution_type = resolution_data.get("resolution_type", "manual")
        resolved_by = resolution_data.get("resolved_by", "system")
        notes = resolution_data.get("notes")
        
        resolved_exception = exception_service.resolve_exception(
            exception_id, resolution_type, resolved_by, notes
        )
        
        if not resolved_exception:
            raise HTTPException(status_code=404, detail="Exception not found")
        
        return {
            "id": resolved_exception.get("id"),
            "status": resolved_exception.get("status"),
            "resolved_at": resolved_exception.get("resolved_at"),
            "resolved_by": resolved_exception.get("resolved_by")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{exception_id}/auto-fix")
async def apply_auto_fix(
    exception_id: str,
    fix_data: dict
):
    """Apply auto-fix for an exception"""
    try:
        applied_by = fix_data.get("applied_by", "system")
        
        result = exception_service.apply_auto_fix(exception_id, applied_by)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/summary")
async def get_exception_stats():
    """Get exception statistics summary"""
    try:
        stats = exception_service.get_exception_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
