from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from models import ComplianceEventModel, LoanModel
from loguru import logger

class ComplianceService:
    def __init__(self, db: Session):
        self.db = db

    async def create_compliance_event(self, event_data: dict) -> ComplianceEventModel:
        """Create a new compliance event"""
        try:
            event = ComplianceEventModel(**event_data)
            self.db.add(event)
            self.db.commit()
            self.db.refresh(event)
            
            logger.info(f"Compliance event created: {event.event_type} for loan {event.xp_loan_number}")
            return event
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating compliance event: {e}")
            raise

    async def get_compliance_status(self) -> Dict[str, Any]:
        """Get overall compliance status"""
        try:
            # RESPA Welcome Letters
            respa_total = self.db.query(ComplianceEventModel).filter_by(event_type="respa_welcome").count()
            respa_on_time = self.db.query(ComplianceEventModel).filter(
                ComplianceEventModel.event_type == "respa_welcome",
                ComplianceEventModel.status.in_(["completed", "pending"])
            ).count()
            respa_percentage = (respa_on_time / respa_total * 100) if respa_total > 0 else 100

            # Escrow Setup
            escrow_total = self.db.query(ComplianceEventModel).filter_by(event_type="escrow_setup").count()
            escrow_on_time = self.db.query(ComplianceEventModel).filter(
                ComplianceEventModel.event_type == "escrow_setup",
                ComplianceEventModel.status.in_(["completed", "pending"])
            ).count()
            escrow_percentage = (escrow_on_time / escrow_total * 100) if escrow_total > 0 else 100

            # TILA Disclosures
            tila_total = self.db.query(ComplianceEventModel).filter_by(event_type="tila_disclosure").count()
            tila_on_time = self.db.query(ComplianceEventModel).filter(
                ComplianceEventModel.event_type == "tila_disclosure",
                ComplianceEventModel.status.in_(["completed", "pending"])
            ).count()
            tila_percentage = (tila_on_time / tila_total * 100) if tila_total > 0 else 100

            # Get overdue events
            overdue_count = self.db.query(ComplianceEventModel).filter(
                ComplianceEventModel.status == "pending",
                ComplianceEventModel.due_date < datetime.now()
            ).count()

            return {
                "respa_welcome": {
                    "percentage": round(respa_percentage, 1),
                    "total": respa_total,
                    "on_time": respa_on_time,
                    "status": self._get_status_level(respa_percentage)
                },
                "escrow_setup": {
                    "percentage": round(escrow_percentage, 1),
                    "total": escrow_total,
                    "on_time": escrow_on_time,
                    "status": self._get_status_level(escrow_percentage)
                },
                "tila_disclosure": {
                    "percentage": round(tila_percentage, 1),
                    "total": tila_total,
                    "on_time": tila_on_time,
                    "status": self._get_status_level(tila_percentage)
                },
                "overdue_count": overdue_count,
                "overall_status": "on_track" if overdue_count == 0 else "attention_needed"
            }
        except Exception as e:
            logger.error(f"Error getting compliance status: {e}")
            return {
                "respa_welcome": {"percentage": 0, "total": 0, "on_time": 0, "status": "unknown"},
                "escrow_setup": {"percentage": 0, "total": 0, "on_time": 0, "status": "unknown"},
                "tila_disclosure": {"percentage": 0, "total": 0, "on_time": 0, "status": "unknown"},
                "overdue_count": 0,
                "overall_status": "unknown"
            }

    def _get_status_level(self, percentage: float) -> str:
        """Get status level based on percentage"""
        if percentage >= 99:
            return "success"
        elif percentage >= 95:
            return "warning"
        else:
            return "error"

    async def get_recent_compliance_events(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent compliance events"""
        try:
            events = self.db.query(ComplianceEventModel).order_by(
                desc(ComplianceEventModel.created_at)
            ).limit(limit).all()
            
            return [
                {
                    "id": event.id,
                    "xp_loan_number": event.xp_loan_number,
                    "event_type": event.event_type,
                    "status": event.status,
                    "description": event.description,
                    "due_date": event.due_date.isoformat() if event.due_date else None,
                    "completed_at": event.completed_at.isoformat() if event.completed_at else None,
                    "created_at": event.created_at.isoformat() if event.created_at else None
                }
                for event in events
            ]
        except Exception as e:
            logger.error(f"Error getting recent compliance events: {e}")
            return []

    async def check_compliance_for_loan(self, loan: LoanModel) -> List[ComplianceEventModel]:
        """Check and create compliance events for a loan"""
        try:
            events = []
            
            # RESPA Welcome Letter - due 60 days after loan purchase
            if loan.status in ["purchased", "boarded"]:
                existing_respa = self.db.query(ComplianceEventModel).filter(
                    ComplianceEventModel.xp_loan_number == loan.xp_loan_number,
                    ComplianceEventModel.event_type == "respa_welcome"
                ).first()
                
                if not existing_respa:
                    respa_event = await self.create_compliance_event({
                        "loan_id": loan.id,
                        "xp_loan_number": loan.xp_loan_number,
                        "event_type": "respa_welcome",
                        "status": "pending",
                        "due_date": datetime.now() + timedelta(days=60),
                        "description": "RESPA welcome letter must be sent"
                    })
                    events.append(respa_event)

            # Escrow Setup - due 30 days after loan purchase
            if loan.status in ["purchased", "boarded"] and loan.metadata and loan.metadata.get("escrow_required"):
                existing_escrow = self.db.query(ComplianceEventModel).filter(
                    ComplianceEventModel.xp_loan_number == loan.xp_loan_number,
                    ComplianceEventModel.event_type == "escrow_setup"
                ).first()
                
                if not existing_escrow:
                    escrow_event = await self.create_compliance_event({
                        "loan_id": loan.id,
                        "xp_loan_number": loan.xp_loan_number,
                        "event_type": "escrow_setup",
                        "status": "pending",
                        "due_date": datetime.now() + timedelta(days=30),
                        "description": "Escrow account setup required"
                    })
                    events.append(escrow_event)

            # TILA Disclosure - due 3 business days after application
            existing_tila = self.db.query(ComplianceEventModel).filter(
                ComplianceEventModel.xp_loan_number == loan.xp_loan_number,
                ComplianceEventModel.event_type == "tila_disclosure"
            ).first()
            
            if not existing_tila:
                tila_event = await self.create_compliance_event({
                    "loan_id": loan.id,
                    "xp_loan_number": loan.xp_loan_number,
                    "event_type": "tila_disclosure",
                    "status": "completed",  # Assume already sent for existing loans
                    "due_date": datetime.now() + timedelta(days=3),
                    "completed_at": datetime.now(),
                    "description": "TILA disclosure provided"
                })
                events.append(tila_event)
            
            return events
            
        except Exception as e:
            logger.error(f"Error checking compliance for loan {loan.xp_loan_number}: {e}")
            return []

    async def complete_compliance_event(self, event_id: str) -> ComplianceEventModel:
        """Mark a compliance event as completed"""
        event = self.db.query(ComplianceEventModel).filter_by(id=event_id).first()
        if not event:
            raise ValueError(f"Compliance event not found: {event_id}")
        
        event.status = "completed"
        event.completed_at = datetime.now()
        
        self.db.commit()
        self.db.refresh(event)
        
        logger.info(f"Compliance event completed: {event_id}")
        return event

    async def get_overdue_events(self) -> List[ComplianceEventModel]:
        """Get all overdue compliance events"""
        return self.db.query(ComplianceEventModel).filter(
            ComplianceEventModel.status == "pending",
            ComplianceEventModel.due_date < datetime.now()
        ).all()
