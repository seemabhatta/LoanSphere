from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from models import LoanModel, ExceptionModel, ComplianceEventModel, MetricModel, PipelineActivityModel
from loguru import logger

class LoanService:
    def __init__(self, db: Session):
        self.db = db

    async def create_loan(self, loan_data: dict) -> LoanModel:
        """Create a new loan record"""
        try:
            loan = LoanModel(**loan_data)
            self.db.add(loan)
            self.db.commit()
            self.db.refresh(loan)
            
            # Log pipeline activity
            await self.log_pipeline_activity(
                loan_id=loan.id,
                xp_loan_number=loan.xp_loan_number,
                activity_type="loan_created",
                status="SUCCESS",
                message=f"Loan {loan.xp_loan_number} created successfully"
            )
            
            logger.info(f"Loan created: {loan.xp_loan_number}")
            return loan
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating loan: {e}")
            raise

    async def get_loan_by_xp_number(self, xp_loan_number: str) -> Optional[LoanModel]:
        """Get loan by XP loan number"""
        return self.db.query(LoanModel).filter_by(xp_loan_number=xp_loan_number).first()

    async def get_loans(self, skip: int = 0, limit: int = 100) -> List[LoanModel]:
        """Get paginated list of loans"""
        return self.db.query(LoanModel).offset(skip).limit(limit).all()

    async def update_loan_status(self, loan_id: str, status: str, metadata: Optional[dict] = None) -> LoanModel:
        """Update loan status"""
        loan = self.db.query(LoanModel).filter_by(id=loan_id).first()
        if not loan:
            raise ValueError(f"Loan not found: {loan_id}")
        
        loan.status = status
        loan.updated_at = datetime.now()
        
        if metadata:
            current_metadata = loan.model_metadata or {}
            current_metadata.update(metadata)
            loan.model_metadata = current_metadata
        
        self.db.commit()
        self.db.refresh(loan)
        
        # Log pipeline activity
        await self.log_pipeline_activity(
            loan_id=loan.id,
            xp_loan_number=loan.xp_loan_number,
            activity_type="status_update",
            status="SUCCESS",
            message=f"Loan status updated to {status}"
        )
        
        return loan

    async def get_dashboard_metrics(self) -> Dict[str, Any]:
        """Get dashboard metrics"""
        try:
            # First-Pass Yield
            total_loans = self.db.query(LoanModel).count()
            fpy_loans = self.db.query(LoanModel).filter_by(first_pass_yield=True).count()
            fpy = (fpy_loans / total_loans * 100) if total_loans > 0 else 0

            # Average Time-to-Board
            avg_ttb = self.db.query(func.avg(LoanModel.time_to_board)).filter(
                LoanModel.time_to_board.isnot(None)
            ).scalar() or 0

            # Auto-Clear Rate
            auto_clear_loans = self.db.query(LoanModel).filter(
                LoanModel.auto_clear_rate > 0.7
            ).count()
            auto_clear_rate = (auto_clear_loans / total_loans * 100) if total_loans > 0 else 0

            # Open Exceptions
            open_exceptions = self.db.query(ExceptionModel).filter_by(status="open").count()

            return {
                "fpy": round(fpy, 1),
                "ttb": round(avg_ttb, 1),
                "auto_clear_rate": round(auto_clear_rate, 1),
                "open_exceptions": open_exceptions,
                "total_loans": total_loans
            }
        except Exception as e:
            logger.error(f"Error getting dashboard metrics: {e}")
            return {
                "fpy": 0,
                "ttb": 0,
                "auto_clear_rate": 0,
                "open_exceptions": 0,
                "total_loans": 0
            }

    async def get_recent_pipeline_activity(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent pipeline activity"""
        try:
            activities = self.db.query(PipelineActivityModel).order_by(
                desc(PipelineActivityModel.timestamp)
            ).limit(limit).all()
            
            return [
                {
                    "id": activity.id,
                    "xp_loan_number": activity.xp_loan_number,
                    "activity_type": activity.activity_type,
                    "status": activity.status,
                    "message": activity.message,
                    "agent_name": activity.agent_name,
                    "timestamp": activity.timestamp.isoformat() if activity.timestamp else None
                }
                for activity in activities
            ]
        except Exception as e:
            logger.error(f"Error getting pipeline activity: {e}")
            return []

    async def log_pipeline_activity(
        self,
        loan_id: Optional[str] = None,
        xp_loan_number: Optional[str] = None,
        activity_type: str = "",
        status: str = "",
        message: str = "",
        agent_name: Optional[str] = None,
        metadata: Optional[dict] = None
    ):
        """Log pipeline activity"""
        try:
            activity = PipelineActivityModel(
                loan_id=loan_id,
                xp_loan_number=xp_loan_number,
                activity_type=activity_type,
                status=status,
                message=message,
                agent_name=agent_name,
                metadata=metadata
            )
            self.db.add(activity)
            self.db.commit()
        except Exception as e:
            logger.error(f"Error logging pipeline activity: {e}")
            self.db.rollback()

    async def process_loan_data(self, loan_data: dict) -> Dict[str, Any]:
        """Process incoming loan data and create/update loan"""
        try:
            xp_loan_number = loan_data.get("xpLoanNumber") or loan_data.get("eventMetadata", {}).get("xpLoanNumber")
            
            if not xp_loan_number:
                raise ValueError("No XP loan number found in loan data")

            # Check if loan exists
            existing_loan = await self.get_loan_by_xp_number(xp_loan_number)
            
            if existing_loan:
                # Update existing loan
                return await self.update_existing_loan(existing_loan, loan_data)
            else:
                # Create new loan
                return await self.create_new_loan(loan_data)
                
        except Exception as e:
            logger.error(f"Error processing loan data: {e}")
            raise

    async def create_new_loan(self, loan_data: dict) -> Dict[str, Any]:
        """Create new loan from incoming data"""
        # Extract data from different sources (commitment, purchase advice, ULDD)
        xp_loan_number = loan_data.get("xpLoanNumber") or loan_data.get("eventMetadata", {}).get("xpLoanNumber")
        
        # Handle commitment data
        if "commitmentId" in loan_data:
            return await self.create_loan_from_commitment(loan_data)
        
        # Handle purchase advice data
        elif "sellerNumber" in loan_data and "purchaseDate" in loan_data:
            return await self.create_loan_from_purchase_advice(loan_data)
        
        # Handle ULDD data
        elif "DEAL" in loan_data:
            return await self.create_loan_from_uldd(loan_data)
        
        else:
            raise ValueError("Unknown loan data format")

    async def create_loan_from_commitment(self, commitment_data: dict) -> Dict[str, Any]:
        """Create loan from commitment data"""
        loan_data = {
            "xp_loan_number": commitment_data.get("eventMetadata", {}).get("xpLoanNumber", ""),
            "tenant_id": "default",
            "seller_name": commitment_data.get("sellerName"),
            "seller_number": commitment_data.get("sellerNumber"),
            "servicer_number": commitment_data.get("servicerNumber"),
            "status": commitment_data.get("status", "pending").lower(),
            "product": commitment_data.get("product"),
            "commitment_id": commitment_data.get("commitmentId"),
            "current_commitment_amount": commitment_data.get("currentCommitmentAmount"),
            "purchased_amount": commitment_data.get("purchasedAmount", 0),
            "remaining_balance": commitment_data.get("remainingBalance"),
            "min_ptr": commitment_data.get("minPTR"),
            "metadata": {
                "source": "commitment",
                "raw_data": commitment_data
            }
        }
        
        loan = await self.create_loan(loan_data)
        return {"status": "success", "loan_id": loan.id, "xp_loan_number": loan.xp_loan_number}

    async def create_loan_from_purchase_advice(self, pa_data: dict) -> Dict[str, Any]:
        """Create loan from purchase advice data"""
        loan_data = {
            "xp_loan_number": pa_data.get("eventMetadata", {}).get("xpLoanNumber", ""),
            "tenant_id": "default",
            "seller_number": pa_data.get("sellerNumber"),
            "servicer_number": pa_data.get("servicerNumber"),
            "status": "purchased",
            "commitment_id": pa_data.get("commitmentNo"),
            "note_amount": pa_data.get("prinPurchased"),
            "interest_rate": pa_data.get("interestRate"),
            "pass_thru_rate": pa_data.get("passThruRate"),
            "metadata": {
                "source": "purchase_advice",
                "raw_data": pa_data
            }
        }
        
        loan = await self.create_loan(loan_data)
        return {"status": "success", "loan_id": loan.id, "xp_loan_number": loan.xp_loan_number}

    async def create_loan_from_uldd(self, uldd_data: dict) -> Dict[str, Any]:
        """Create loan from ULDD data"""
        deal = uldd_data.get("DEAL", {})
        loans_data = deal.get("LOANS", {}).get("LOAN", [])
        
        if not isinstance(loans_data, list):
            loans_data = [loans_data]
        
        # Get the subject loan
        subject_loan = None
        for loan in loans_data:
            if loan.get("@LoanRoleType") == "SubjectLoan":
                subject_loan = loan
                break
        
        if not subject_loan:
            raise ValueError("No subject loan found in ULDD data")
        
        # Extract loan details
        terms = subject_loan.get("TERMS_OF_MORTGAGE", {})
        loan_detail = subject_loan.get("LOAN_DETAIL", {})
        property_data = deal.get("COLLATERALS", {}).get("COLLATERAL", {}).get("PROPERTIES", {}).get("PROPERTY", {})
        
        loan_data = {
            "xp_loan_number": uldd_data.get("eventMetadata", {}).get("xpLoanNumber", ""),
            "tenant_id": "default",
            "status": "underwriting",
            "note_amount": terms.get("NoteAmount"),
            "interest_rate": terms.get("NoteRatePercent"),
            "property_value": property_data.get("PROPERTY_VALUATIONS", {}).get("PROPERTY_VALUATION", {}).get("PROPERTY_VALUATION_DETAIL", {}).get("PropertyValuationAmount"),
            "ltv_ratio": subject_loan.get("LTV", {}).get("LTVRatioPercent"),
            "credit_score": subject_loan.get("LOAN_LEVEL_CREDIT", {}).get("LOAN_LEVEL_CREDIT_DETAIL", {}).get("LoanLevelCreditScoreValue"),
            "metadata": {
                "source": "uldd",
                "raw_data": uldd_data
            }
        }
        
        loan = await self.create_loan(loan_data)
        return {"status": "success", "loan_id": loan.id, "xp_loan_number": loan.xp_loan_number}

    async def update_existing_loan(self, loan: LoanModel, new_data: dict) -> Dict[str, Any]:
        """Update existing loan with new data"""
        # Determine data source and update accordingly
        source = "unknown"
        
        if "commitmentId" in new_data:
            source = "commitment"
        elif "sellerNumber" in new_data and "purchaseDate" in new_data:
            source = "purchase_advice"
        elif "DEAL" in new_data:
            source = "uldd"
        
        # Update metadata to track data sources
        current_metadata = loan.model_metadata or {}
        current_metadata[f"{source}_data"] = new_data
        current_metadata["last_updated_source"] = source
        current_metadata["last_updated"] = datetime.now().isoformat()
        
        await self.update_loan_status(
            loan.id, 
            loan.status, 
            current_metadata
        )
        
        return {"status": "updated", "loan_id": loan.id, "xp_loan_number": loan.xp_loan_number}
