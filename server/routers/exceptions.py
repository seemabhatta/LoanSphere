from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from services.exception_service import ExceptionService

router = APIRouter()

@router.get("/")
async def get_exceptions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get paginated list of exceptions"""
    try:
        exception_service = ExceptionService(db)
        exceptions = await exception_service.get_exceptions(
            status=status, 
            severity=severity, 
            skip=skip, 
            limit=limit
        )
        
        return {
            "exceptions": [
                {
                    "id": exception.id,
                    "xp_loan_number": exception.xp_loan_number,
                    "rule_id": exception.rule_id,
                    "rule_name": exception.rule_name,
                    "severity": exception.severity,
                    "status": exception.status,
                    "confidence": float(exception.confidence) if exception.confidence else None,
                    "description": exception.description,
                    "evidence": exception.evidence,
                    "auto_fix_suggestion": exception.auto_fix_suggestion,
                    "detected_at": exception.detected_at.isoformat() if exception.detected_at else None,
                    "resolved_at": exception.resolved_at.isoformat() if exception.resolved_at else None,
                    "resolved_by": exception.resolved_by,
                    "sla_due": exception.sla_due.isoformat() if exception.sla_due else None,
                    "notes": exception.notes
                }
                for exception in exceptions
            ],
            "total": len(exceptions),
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{exception_id}")
async def get_exception(exception_id: str, db: Session = Depends(get_db)):
    """Get exception by ID"""
    try:
        exception_service = ExceptionService(db)
        exception = await exception_service.get_exception_by_id(exception_id)
        
        if not exception:
            raise HTTPException(status_code=404, detail="Exception not found")
        
        return {
            "id": exception.id,
            "loan_id": exception.loan_id,
            "xp_loan_number": exception.xp_loan_number,
            "rule_id": exception.rule_id,
            "rule_name": exception.rule_name,
            "severity": exception.severity,
            "status": exception.status,
            "confidence": float(exception.confidence) if exception.confidence else None,
            "description": exception.description,
            "evidence": exception.evidence,
            "auto_fix_suggestion": exception.auto_fix_suggestion,
            "detected_at": exception.detected_at.isoformat() if exception.detected_at else None,
            "resolved_at": exception.resolved_at.isoformat() if exception.resolved_at else None,
            "resolved_by": exception.resolved_by,
            "sla_due": exception.sla_due.isoformat() if exception.sla_due else None,
            "notes": exception.notes
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{exception_id}/resolve")
async def resolve_exception(
    exception_id: str,
    resolution_data: dict,
    db: Session = Depends(get_db)
):
    """Resolve an exception"""
    try:
        exception_service = ExceptionService(db)
        
        resolution_type = resolution_data.get("resolution_type", "manual")
        resolved_by = resolution_data.get("resolved_by", "system")
        notes = resolution_data.get("notes")
        
        resolved_exception = await exception_service.resolve_exception(
            exception_id, resolution_type, resolved_by, notes
        )
        
        return {
            "id": resolved_exception.id,
            "status": resolved_exception.status,
            "resolved_at": resolved_exception.resolved_at.isoformat() if resolved_exception.resolved_at else None,
            "resolved_by": resolved_exception.resolved_by
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{exception_id}/auto-fix")
async def apply_auto_fix(
    exception_id: str,
    fix_data: dict,
    db: Session = Depends(get_db)
):
    """Apply auto-fix for an exception"""
    try:
        exception_service = ExceptionService(db)
        applied_by = fix_data.get("applied_by", "system")
        
        result = await exception_service.apply_auto_fix(exception_id, applied_by)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/summary")
async def get_exception_stats(db: Session = Depends(get_db)):
    """Get exception statistics summary"""
    try:
        exception_service = ExceptionService(db)
        
        # Get counts by status
        open_exceptions = await exception_service.get_exceptions(status="open")
        resolved_exceptions = await exception_service.get_exceptions(status="resolved")
        
        # Get counts by severity
        high_severity = await exception_service.get_exceptions(severity="HIGH")
        medium_severity = await exception_service.get_exceptions(severity="MEDIUM")
        low_severity = await exception_service.get_exceptions(severity="LOW")
        
        return {
            "by_status": {
                "open": len(open_exceptions),
                "resolved": len(resolved_exceptions)
            },
            "by_severity": {
                "high": len([e for e in high_severity if e.status == "open"]),
                "medium": len([e for e in medium_severity if e.status == "open"]),
                "low": len([e for e in low_severity if e.status == "open"])
            },
            "total_open": len(open_exceptions),
            "total_resolved": len(resolved_exceptions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
