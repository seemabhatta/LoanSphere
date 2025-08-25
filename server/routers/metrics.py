from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from database import get_db
from models import MetricModel

router = APIRouter()

@router.get("/")
async def get_metrics(
    metric_type: Optional[str] = None,
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get metrics with filters"""
    try:
        query = db.query(MetricModel)
        
        if metric_type:
            query = query.filter_by(metric_type=metric_type)
        
        if period:
            query = query.filter_by(period=period)
        
        if start_date:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(MetricModel.timestamp >= start_dt)
        
        if end_date:
            end_dt = datetime.fromisoformat(end_date)
            query = query.filter(MetricModel.timestamp <= end_dt)
        
        metrics = query.order_by(MetricModel.timestamp.desc()).all()
        
        return {
            "metrics": [
                {
                    "id": metric.id,
                    "metric_type": metric.metric_type,
                    "value": float(metric.value),
                    "period": metric.period,
                    "timestamp": metric.timestamp.isoformat() if metric.timestamp else None,
                    "metadata": metric.metadata
                }
                for metric in metrics
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
async def create_metric(metric_data: dict, db: Session = Depends(get_db)):
    """Create a new metric"""
    try:
        metric = MetricModel(
            metric_type=metric_data["metric_type"],
            value=metric_data["value"],
            period=metric_data.get("period", "daily"),
            metadata=metric_data.get("metadata")
        )
        
        db.add(metric)
        db.commit()
        db.refresh(metric)
        
        return {
            "id": metric.id,
            "metric_type": metric.metric_type,
            "value": float(metric.value),
            "period": metric.period,
            "timestamp": metric.timestamp.isoformat() if metric.timestamp else None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard")
async def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Get metrics for dashboard display"""
    try:
        from services.loan_service import LoanService
        from services.document_service import DocumentService
        
        loan_service = LoanService(db)
        document_service = DocumentService(db)
        
        # Get loan metrics
        loan_metrics = await loan_service.get_dashboard_metrics()
        
        # Get document processing metrics
        doc_metrics = await document_service.get_processing_pipeline_status()
        
        # Get recent activity
        recent_activity = await loan_service.get_recent_pipeline_activity(limit=5)
        
        return {
            "loan_metrics": loan_metrics,
            "document_metrics": doc_metrics,
            "recent_activity": recent_activity,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trends/{metric_type}")
async def get_metric_trends(
    metric_type: str,
    days: int = Query(30, le=365),
    db: Session = Depends(get_db)
):
    """Get metric trends over time"""
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        metrics = db.query(MetricModel).filter(
            MetricModel.metric_type == metric_type,
            MetricModel.timestamp >= start_date
        ).order_by(MetricModel.timestamp).all()
        
        return {
            "metric_type": metric_type,
            "period_days": days,
            "data_points": [
                {
                    "value": float(metric.value),
                    "timestamp": metric.timestamp.isoformat() if metric.timestamp else None,
                    "period": metric.period
                }
                for metric in metrics
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/performance/summary")
async def get_performance_summary(db: Session = Depends(get_db)):
    """Get performance summary metrics"""
    try:
        from models import LoanModel, ExceptionModel, ComplianceEventModel
        
        # Loan performance
        total_loans = db.query(LoanModel).count()
        completed_loans = db.query(LoanModel).filter_by(boarding_status="completed").count()
        
        # Exception performance
        total_exceptions = db.query(ExceptionModel).count()
        resolved_exceptions = db.query(ExceptionModel).filter_by(status="resolved").count()
        
        # Compliance performance
        total_compliance_events = db.query(ComplianceEventModel).count()
        completed_compliance = db.query(ComplianceEventModel).filter_by(status="completed").count()
        
        # Calculate rates
        boarding_completion_rate = (completed_loans / total_loans * 100) if total_loans > 0 else 0
        exception_resolution_rate = (resolved_exceptions / total_exceptions * 100) if total_exceptions > 0 else 0
        compliance_completion_rate = (completed_compliance / total_compliance_events * 100) if total_compliance_events > 0 else 0
        
        return {
            "summary": {
                "boarding_completion_rate": round(boarding_completion_rate, 1),
                "exception_resolution_rate": round(exception_resolution_rate, 1),
                "compliance_completion_rate": round(compliance_completion_rate, 1),
                "total_loans": total_loans,
                "total_exceptions": total_exceptions,
                "total_compliance_events": total_compliance_events
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{metric_id}")
async def delete_metric(metric_id: str, db: Session = Depends(get_db)):
    """Delete a metric"""
    try:
        metric = db.query(MetricModel).filter_by(id=metric_id).first()
        
        if not metric:
            raise HTTPException(status_code=404, detail="Metric not found")
        
        db.delete(metric)
        db.commit()
        
        return {"message": "Metric deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
