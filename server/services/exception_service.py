from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from models import ExceptionModel, LoanModel
from loguru import logger

class ExceptionService:
    def __init__(self, db: Session):
        self.db = db

    async def create_exception(self, exception_data: dict) -> ExceptionModel:
        """Create a new exception"""
        try:
            exception = ExceptionModel(**exception_data)
            self.db.add(exception)
            self.db.commit()
            self.db.refresh(exception)
            
            logger.info(f"Exception created: {exception.rule_id} for loan {exception.xp_loan_number}")
            return exception
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating exception: {e}")
            raise

    async def get_exceptions(
        self, 
        status: Optional[str] = None,
        severity: Optional[str] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> List[ExceptionModel]:
        """Get paginated list of exceptions with filters"""
        query = self.db.query(ExceptionModel)
        
        if status:
            query = query.filter_by(status=status)
        if severity:
            query = query.filter_by(severity=severity)
            
        return query.order_by(desc(ExceptionModel.detected_at)).offset(skip).limit(limit).all()

    async def get_exception_by_id(self, exception_id: str) -> Optional[ExceptionModel]:
        """Get exception by ID"""
        return self.db.query(ExceptionModel).filter_by(id=exception_id).first()

    async def resolve_exception(
        self, 
        exception_id: str, 
        resolution_type: str,
        resolved_by: str,
        notes: Optional[str] = None
    ) -> ExceptionModel:
        """Resolve an exception"""
        exception = self.db.query(ExceptionModel).filter_by(id=exception_id).first()
        if not exception:
            raise ValueError(f"Exception not found: {exception_id}")
        
        exception.status = "resolved"
        exception.resolved_at = datetime.now()
        exception.resolved_by = resolved_by
        if notes:
            exception.notes = notes
        
        # Add resolution metadata
        current_metadata = exception.evidence or {}
        current_metadata["resolution"] = {
            "type": resolution_type,
            "timestamp": datetime.now().isoformat(),
            "resolved_by": resolved_by
        }
        exception.evidence = current_metadata
        
        self.db.commit()
        self.db.refresh(exception)
        
        logger.info(f"Exception resolved: {exception_id} by {resolved_by}")
        return exception

    async def apply_auto_fix(self, exception_id: str, applied_by: str) -> Dict[str, Any]:
        """Apply auto-fix suggestion for an exception"""
        exception = self.db.query(ExceptionModel).filter_by(id=exception_id).first()
        if not exception:
            raise ValueError(f"Exception not found: {exception_id}")
        
        if not exception.auto_fix_suggestion:
            raise ValueError("No auto-fix suggestion available for this exception")
        
        try:
            # Apply the auto-fix based on suggestion
            auto_fix = exception.auto_fix_suggestion
            fix_result = await self._execute_auto_fix(exception, auto_fix)
            
            if fix_result["success"]:
                # Mark exception as resolved
                await self.resolve_exception(
                    exception_id,
                    "auto_fix",
                    applied_by,
                    f"Auto-fix applied: {auto_fix.get('description', 'Unknown fix')}"
                )
                
                return {
                    "status": "success",
                    "message": "Auto-fix applied successfully",
                    "details": fix_result
                }
            else:
                logger.error(f"Auto-fix failed for exception {exception_id}: {fix_result.get('error')}")
                return {
                    "status": "error",
                    "message": "Auto-fix failed",
                    "error": fix_result.get("error")
                }
                
        except Exception as e:
            logger.error(f"Error applying auto-fix: {e}")
            return {
                "status": "error",
                "message": "Auto-fix execution failed",
                "error": str(e)
            }

    async def _execute_auto_fix(self, exception: ExceptionModel, auto_fix: dict) -> Dict[str, Any]:
        """Execute the auto-fix suggestion"""
        try:
            fix_type = auto_fix.get("type")
            
            if fix_type == "UPDATE_PURCHASE_ADVICE_RATE":
                return await self._fix_rate_parity(exception, auto_fix)
            elif fix_type == "POPULATE_ESCROW_ITEMS":
                return await self._fix_missing_escrow(exception, auto_fix)
            else:
                return {
                    "success": False,
                    "error": f"Unknown auto-fix type: {fix_type}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def _fix_rate_parity(self, exception: ExceptionModel, auto_fix: dict) -> Dict[str, Any]:
        """Fix rate parity issues"""
        try:
            # Get the loan
            loan = self.db.query(LoanModel).filter_by(xp_loan_number=exception.xp_loan_number).first()
            if not loan:
                return {"success": False, "error": "Loan not found"}
            
            # Update the loan with the corrected rate
            new_rate = auto_fix.get("new_value")
            if new_rate:
                loan.interest_rate = float(new_rate)
                
                # Update metadata to track the fix
                metadata = loan.metadata or {}
                metadata["auto_fixes"] = metadata.get("auto_fixes", [])
                metadata["auto_fixes"].append({
                    "type": "rate_parity_fix",
                    "old_rate": exception.evidence.get("purchase_advice_rate"),
                    "new_rate": new_rate,
                    "timestamp": datetime.now().isoformat(),
                    "exception_id": exception.id
                })
                loan.metadata = metadata
                
                self.db.commit()
                
                return {
                    "success": True,
                    "message": f"Interest rate updated to {new_rate}",
                    "old_rate": exception.evidence.get("purchase_advice_rate"),
                    "new_rate": new_rate
                }
            else:
                return {"success": False, "error": "No new rate value provided"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _fix_missing_escrow(self, exception: ExceptionModel, auto_fix: dict) -> Dict[str, Any]:
        """Fix missing escrow items"""
        try:
            # Get the loan
            loan = self.db.query(LoanModel).filter_by(xp_loan_number=exception.xp_loan_number).first()
            if not loan:
                return {"success": False, "error": "Loan not found"}
            
            # Add escrow information to metadata
            metadata = loan.metadata or {}
            metadata["escrow_items"] = auto_fix.get("escrow_items", [])
            metadata["auto_fixes"] = metadata.get("auto_fixes", [])
            metadata["auto_fixes"].append({
                "type": "escrow_population",
                "items_added": len(auto_fix.get("escrow_items", [])),
                "timestamp": datetime.now().isoformat(),
                "exception_id": exception.id
            })
            loan.metadata = metadata
            
            self.db.commit()
            
            return {
                "success": True,
                "message": "Escrow items populated",
                "items_added": len(auto_fix.get("escrow_items", []))
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def detect_rate_parity_exception(self, loan_data: dict, xp_loan_number: str) -> Optional[ExceptionModel]:
        """Detect rate parity violations between data sources"""
        try:
            # Extract rates from different sources
            purchase_advice_rate = None
            uldd_rate = None
            
            # Check if this is purchase advice data
            if "interestRate" in loan_data:
                purchase_advice_rate = float(loan_data["interestRate"])
            
            # Check if this is ULDD data
            if "DEAL" in loan_data:
                deal = loan_data["DEAL"]
                loans_list = deal.get("LOANS", {}).get("LOAN", [])
                if not isinstance(loans_list, list):
                    loans_list = [loans_list]
                
                for loan in loans_list:
                    if loan.get("@LoanRoleType") == "SubjectLoan":
                        terms = loan.get("TERMS_OF_MORTGAGE", {})
                        uldd_rate = terms.get("NoteRatePercent")
                        if uldd_rate:
                            uldd_rate = float(uldd_rate)
                        break
            
            # Check existing loan for comparison
            existing_loan = self.db.query(LoanModel).filter_by(xp_loan_number=xp_loan_number).first()
            if existing_loan and existing_loan.metadata:
                # Check for rate mismatch
                if purchase_advice_rate and existing_loan.interest_rate:
                    existing_rate = float(existing_loan.interest_rate)
                    if abs(purchase_advice_rate - existing_rate) > 0.001:  # 0.1% tolerance
                        return await self._create_rate_parity_exception(
                            xp_loan_number,
                            purchase_advice_rate,
                            existing_rate,
                            "purchase_advice_vs_existing"
                        )
                
                if uldd_rate and existing_loan.interest_rate:
                    existing_rate = float(existing_loan.interest_rate)
                    if abs(uldd_rate - existing_rate) > 0.001:
                        return await self._create_rate_parity_exception(
                            xp_loan_number,
                            uldd_rate,
                            existing_rate,
                            "uldd_vs_existing"
                        )
            
            return None
            
        except Exception as e:
            logger.error(f"Error detecting rate parity exception: {e}")
            return None

    async def _create_rate_parity_exception(
        self, 
        xp_loan_number: str, 
        rate1: float, 
        rate2: float, 
        comparison_type: str
    ) -> ExceptionModel:
        """Create a rate parity exception"""
        
        # Determine which rate to use as authoritative (higher rate wins for safety)
        authoritative_rate = max(rate1, rate2)
        
        exception_data = {
            "xp_loan_number": xp_loan_number,
            "rule_id": "RATE_PARITY_CHECK",
            "rule_name": "Rate Parity Violation",
            "severity": "HIGH",
            "status": "open",
            "confidence": 0.94,
            "description": f"Rate mismatch detected: {rate1}% vs {rate2}%",
            "evidence": {
                "rate1": rate1,
                "rate2": rate2,
                "comparison_type": comparison_type,
                "difference": abs(rate1 - rate2)
            },
            "auto_fix_suggestion": {
                "type": "UPDATE_PURCHASE_ADVICE_RATE",
                "description": f"Use authoritative rate ({authoritative_rate}%)",
                "new_value": authoritative_rate,
                "confidence": 0.94
            },
            "sla_due": datetime.now() + timedelta(hours=24)
        }
        
        return await self.create_exception(exception_data)
