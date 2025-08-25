from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from services.compliance_service import ComplianceService

router = APIRouter()

@router.get("/status")
async def get_compliance_status(db: Session = Depends(get_db)):
    """Get overall compliance status"""
    try:
        compliance_service = ComplianceService(db)
        status = await compliance_service.get_compliance_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/events")
async def get_compliance_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    xp_loan_number: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get compliance events"""
    try:
        from models import ComplianceEventModel
        
        query = db.query(ComplianceEventModel)
        
        if event_type:
            query = query.filter_by(event_type=event_type)
        if status:
            query = query.filter_by(status=status)
        if xp_loan_number:
            query = query.filter_by(xp_loan_number=xp_loan_number)
        
        events = query.offset(skip).limit(limit).all()
        
        return {
            "events": [
                {
                    "id": event.id,
                    "loan_id": event.loan_id,
                    "xp_loan_number": event.xp_loan_number,
                    "event_type": event.event_type,
                    "status": event.status,
                    "due_date": event.due_date.isoformat() if event.due_date else None,
                    "completed_at": event.completed_at.isoformat() if event.completed_at else None,
                    "description": event.description,
                    "metadata": event.metadata,
                    "created_at": event.created_at.isoformat() if event.created_at else None
                }
                for event in events
            ],
            "total": len(events),
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/events/recent")
async def get_recent_compliance_events(
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db)
):
    """Get recent compliance events"""
    try:
        compliance_service = ComplianceService(db)
        events = await compliance_service.get_recent_compliance_events(limit=limit)
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/events/{event_id}/complete")
async def complete_compliance_event(event_id: str, db: Session = Depends(get_db)):
    """Mark a compliance event as completed"""
    try:
        compliance_service = ComplianceService(db)
        completed_event = await compliance_service.complete_compliance_event(event_id)
        
        return {
            "id": completed_event.id,
            "status": completed_event.status,
            "completed_at": completed_event.completed_at.isoformat() if completed_event.completed_at else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/events/overdue")
async def get_overdue_events(db: Session = Depends(get_db)):
    """Get overdue compliance events"""
    try:
        compliance_service = ComplianceService(db)
        overdue_events = await compliance_service.get_overdue_events()
        
        return {
            "overdue_events": [
                {
                    "id": event.id,
                    "xp_loan_number": event.xp_loan_number,
                    "event_type": event.event_type,
                    "description": event.description,
                    "due_date": event.due_date.isoformat() if event.due_date else None,
                    "days_overdue": (event.due_date - event.created_at).days if event.due_date and event.created_at else 0
                }
                for event in overdue_events
            ],
            "total_overdue": len(overdue_events)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/check/{xp_loan_number}")
async def check_loan_compliance(xp_loan_number: str, db: Session = Depends(get_db)):
    """Check compliance for a specific loan"""
    try:
        from services.loan_service import LoanService
        compliance_service = ComplianceService(db)
        loan_service = LoanService(db)
        
        # Get the loan
        loan = await loan_service.get_loan_by_xp_number(xp_loan_number)
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        
        # Check compliance
        events = await compliance_service.check_compliance_for_loan(loan)
        
        return {
            "xp_loan_number": xp_loan_number,
            "compliance_events_created": len(events),
            "events": [
                {
                    "id": event.id,
                    "event_type": event.event_type,
                    "status": event.status,
                    "due_date": event.due_date.isoformat() if event.due_date else None,
                    "description": event.description
                }
                for event in events
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard/summary")
async def get_compliance_dashboard_summary(db: Session = Depends(get_db)):
    """Get compliance dashboard summary"""
    try:
        compliance_service = ComplianceService(db)
        
        # Get compliance status
        status = await compliance_service.get_compliance_status()
        
        # Get recent events
        recent_events = await compliance_service.get_recent_compliance_events(limit=5)
        
        # Get overdue events
        overdue_events = await compliance_service.get_overdue_events()
        
        return {
            "status": status,
            "recent_events": recent_events,
            "overdue_count": len(overdue_events),
            "alerts": [
                {
                    "type": "warning" if status["overdue_count"] > 0 else "info",
                    "message": f"{status['overdue_count']} overdue compliance events" if status["overdue_count"] > 0 else "All compliance events on track"
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
