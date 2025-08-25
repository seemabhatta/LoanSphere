import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from loguru import logger

from services.loan_service import LoanService
from services.exception_service import ExceptionService

class VerifierAgent:
    def __init__(self, loan_service: LoanService, websocket_manager):
        self.loan_service = loan_service
        self.websocket_manager = websocket_manager
        self.status = "idle"
        self.current_task = None
        self.last_activity = datetime.now()
        self.tasks_completed = 0
        self.tasks_errored = 0
        
        # Initialize exception service (would normally be injected)
        from database import SessionLocal
        db = SessionLocal()
        self.exception_service = ExceptionService(db)

    async def get_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "name": "VerifierAgent",
            "type": "verifier",
            "status": self.status,
            "current_task": self.current_task,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "tasks_completed": self.tasks_completed,
            "tasks_errored": self.tasks_errored
        }

    async def verify_loan_data(self, xp_loan_number: str, rule_packs: List[str] = None) -> Dict[str, Any]:
        """Verify loan data against MISMO-aligned rule packs"""
        try:
            self.status = "running"
            self.current_task = f"Verifying loan data for {xp_loan_number}"
            self.last_activity = datetime.now()
            
            await self._broadcast_status_update()
            
            # Get loan data
            loan = await self.loan_service.get_loan_by_xp_number(xp_loan_number)
            if not loan:
                raise ValueError(f"Loan not found: {xp_loan_number}")
            
            # Default rule packs if none specified
            if not rule_packs:
                rule_packs = [
                    "data_completeness",
                    "rate_parity",
                    "ltv_validation",
                    "escrow_requirements",
                    "compliance_checks"
                ]
            
            verification_results = []
            exceptions_created = []
            
            for rule_pack in rule_packs:
                pack_result = await self._execute_rule_pack(loan, rule_pack)
                verification_results.append(pack_result)
                
                # Create exceptions for failed rules
                if pack_result["status"] == "failed":
                    for failed_rule in pack_result.get("failed_rules", []):
                        exception = await self._create_exception_from_rule(loan, failed_rule)
                        if exception:
                            exceptions_created.append(exception.id)
            
            # Log activity
            await self.loan_service.log_pipeline_activity(
                loan_id=loan.id,
                xp_loan_number=xp_loan_number,
                activity_type="verification_completed",
                status="SUCCESS",
                message=f"Verification completed, {len(exceptions_created)} exceptions found",
                agent_name="VerifierAgent"
            )
            
            self.tasks_completed += 1
            self.status = "idle"
            self.current_task = None
            
            await self._broadcast_status_update()
            
            return {
                "status": "success",
                "verification_results": verification_results,
                "exceptions_created": exceptions_created
            }
            
        except Exception as e:
            logger.error(f"Error verifying loan data: {e}")
            self.tasks_errored += 1
            self.status = "error"
            await self._broadcast_status_update()
            
            return {
                "status": "error",
                "error": str(e)
            }

    async def _execute_rule_pack(self, loan, rule_pack: str) -> Dict[str, Any]:
        """Execute a specific rule pack"""
        try:
            if rule_pack == "data_completeness":
                return await self._check_data_completeness(loan)
            elif rule_pack == "rate_parity":
                return await self._check_rate_parity(loan)
            elif rule_pack == "ltv_validation":
                return await self._check_ltv_validation(loan)
            elif rule_pack == "escrow_requirements":
                return await self._check_escrow_requirements(loan)
            elif rule_pack == "compliance_checks":
                return await self._check_compliance_requirements(loan)
            else:
                return {
                    "rule_pack": rule_pack,
                    "status": "error",
                    "error": f"Unknown rule pack: {rule_pack}"
                }
                
        except Exception as e:
            return {
                "rule_pack": rule_pack,
                "status": "error",
                "error": str(e)
            }

    async def _check_data_completeness(self, loan) -> Dict[str, Any]:
        """Check data completeness rules"""
        required_fields = {
            "xp_loan_number": loan.xp_loan_number,
            "note_amount": loan.note_amount,
            "interest_rate": loan.interest_rate,
            "property_value": loan.property_value,
            "ltv_ratio": loan.ltv_ratio
        }
        
        failed_rules = []
        missing_fields = []
        
        for field, value in required_fields.items():
            if not value:
                missing_fields.append(field)
                failed_rules.append({
                    "rule_id": f"COMPLETENESS_{field.upper()}",
                    "rule_name": f"Required Field: {field}",
                    "severity": "HIGH",
                    "description": f"Required field {field} is missing",
                    "evidence": {"missing_field": field}
                })
        
        return {
            "rule_pack": "data_completeness",
            "status": "passed" if not failed_rules else "failed",
            "total_rules": len(required_fields),
            "passed_rules": len(required_fields) - len(failed_rules),
            "failed_rules": failed_rules,
            "details": {
                "missing_fields": missing_fields,
                "completeness_score": round((len(required_fields) - len(failed_rules)) / len(required_fields) * 100, 1)
            }
        }

    async def _check_rate_parity(self, loan) -> Dict[str, Any]:
        """Check rate parity between data sources"""
        failed_rules = []
        
        # Check if we have multiple rate sources in metadata
        if loan.metadata:
            purchase_advice_data = loan.metadata.get("purchase_advice_data")
            uldd_data = loan.metadata.get("uldd_data")
            
            if purchase_advice_data and uldd_data:
                pa_rate = purchase_advice_data.get("interestRate")
                
                # Extract ULDD rate
                uldd_rate = None
                deal = uldd_data.get("DEAL", {})
                loans_list = deal.get("LOANS", {}).get("LOAN", [])
                if not isinstance(loans_list, list):
                    loans_list = [loans_list]
                
                for uldd_loan in loans_list:
                    if uldd_loan.get("@LoanRoleType") == "SubjectLoan":
                        terms = uldd_loan.get("TERMS_OF_MORTGAGE", {})
                        uldd_rate = terms.get("NoteRatePercent")
                        break
                
                if pa_rate and uldd_rate:
                    pa_rate = float(pa_rate)
                    uldd_rate = float(uldd_rate)
                    
                    if abs(pa_rate - uldd_rate) > 0.001:  # 0.1% tolerance
                        failed_rules.append({
                            "rule_id": "RATE_PARITY_PA_ULDD",
                            "rule_name": "Purchase Advice vs ULDD Rate Parity",
                            "severity": "HIGH",
                            "description": f"Rate mismatch: PA {pa_rate}% vs ULDD {uldd_rate}%",
                            "evidence": {
                                "purchase_advice_rate": pa_rate,
                                "uldd_rate": uldd_rate,
                                "difference": abs(pa_rate - uldd_rate)
                            },
                            "auto_fix_suggestion": {
                                "type": "UPDATE_PURCHASE_ADVICE_RATE",
                                "description": f"Use ULDD rate ({uldd_rate}%) as authoritative",
                                "new_value": uldd_rate
                            }
                        })
        
        return {
            "rule_pack": "rate_parity",
            "status": "passed" if not failed_rules else "failed",
            "total_rules": 1,
            "passed_rules": 1 - len(failed_rules),
            "failed_rules": failed_rules
        }

    async def _check_ltv_validation(self, loan) -> Dict[str, Any]:
        """Check LTV validation rules"""
        failed_rules = []
        
        if loan.ltv_ratio and loan.note_amount and loan.property_value:
            calculated_ltv = float(loan.note_amount) / float(loan.property_value)
            reported_ltv = float(loan.ltv_ratio)
            
            if abs(calculated_ltv - reported_ltv) > 0.01:  # 1% tolerance
                failed_rules.append({
                    "rule_id": "LTV_CALCULATION",
                    "rule_name": "LTV Calculation Verification",
                    "severity": "MEDIUM",
                    "description": f"LTV mismatch: Calculated {calculated_ltv:.3f} vs Reported {reported_ltv:.3f}",
                    "evidence": {
                        "calculated_ltv": round(calculated_ltv, 4),
                        "reported_ltv": round(reported_ltv, 4),
                        "note_amount": float(loan.note_amount),
                        "property_value": float(loan.property_value)
                    }
                })
        
        return {
            "rule_pack": "ltv_validation",
            "status": "passed" if not failed_rules else "failed",
            "total_rules": 1,
            "passed_rules": 1 - len(failed_rules),
            "failed_rules": failed_rules
        }

    async def _check_escrow_requirements(self, loan) -> Dict[str, Any]:
        """Check escrow requirements"""
        failed_rules = []
        
        # Check if escrow is indicated but missing items
        if loan.metadata:
            # Check ULDD data for escrow indicator
            uldd_data = loan.metadata.get("uldd_data")
            if uldd_data:
                deal = uldd_data.get("DEAL", {})
                loans_list = deal.get("LOANS", {}).get("LOAN", [])
                if not isinstance(loans_list, list):
                    loans_list = [loans_list]
                
                for uldd_loan in loans_list:
                    if uldd_loan.get("@LoanRoleType") == "SubjectLoan":
                        loan_detail = uldd_loan.get("LOAN_DETAIL", {})
                        escrow_indicator = loan_detail.get("EscrowIndicator")
                        
                        if escrow_indicator:
                            # Check if escrow items are present
                            escrow_section = uldd_loan.get("ESCROW", {})
                            escrow_items = escrow_section.get("ESCROW_ITEMS", {}).get("ESCROW_ITEM", [])
                            
                            if not escrow_items:
                                failed_rules.append({
                                    "rule_id": "ESCROW_ITEMS_MISSING",
                                    "rule_name": "Missing Escrow Items",
                                    "severity": "MEDIUM",
                                    "description": "Escrow indicator is true but no escrow items found",
                                    "evidence": {
                                        "escrow_indicator": escrow_indicator,
                                        "escrow_items_count": len(escrow_items) if isinstance(escrow_items, list) else (1 if escrow_items else 0)
                                    },
                                    "auto_fix_suggestion": {
                                        "type": "POPULATE_ESCROW_ITEMS",
                                        "description": "Populate default escrow items based on property value",
                                        "escrow_items": [
                                            {"type": "property_tax", "monthly_amount": 200},
                                            {"type": "homeowners_insurance", "monthly_amount": 150}
                                        ]
                                    }
                                })
                        break
        
        return {
            "rule_pack": "escrow_requirements",
            "status": "passed" if not failed_rules else "failed",
            "total_rules": 1,
            "passed_rules": 1 - len(failed_rules),
            "failed_rules": failed_rules
        }

    async def _check_compliance_requirements(self, loan) -> Dict[str, Any]:
        """Check compliance requirements"""
        failed_rules = []
        
        # Check for missing compliance data
        if not loan.interest_rate:
            failed_rules.append({
                "rule_id": "TILA_INTEREST_RATE",
                "rule_name": "TILA Interest Rate Required",
                "severity": "HIGH",
                "description": "Interest rate required for TILA compliance",
                "evidence": {"missing_data": "interest_rate"}
            })
        
        return {
            "rule_pack": "compliance_checks",
            "status": "passed" if not failed_rules else "failed",
            "total_rules": 1,
            "passed_rules": 1 - len(failed_rules),
            "failed_rules": failed_rules
        }

    async def _create_exception_from_rule(self, loan, failed_rule: Dict[str, Any]) -> Optional:
        """Create an exception from a failed rule"""
        try:
            exception_data = {
                "loan_id": loan.id,
                "xp_loan_number": loan.xp_loan_number,
                "rule_id": failed_rule["rule_id"],
                "rule_name": failed_rule["rule_name"],
                "severity": failed_rule["severity"],
                "status": "open",
                "confidence": 0.95,
                "description": failed_rule["description"],
                "evidence": failed_rule.get("evidence", {}),
                "auto_fix_suggestion": failed_rule.get("auto_fix_suggestion"),
                "sla_due": datetime.now() + timedelta(hours=24 if failed_rule["severity"] == "HIGH" else 72)
            }
            
            return await self.exception_service.create_exception(exception_data)
            
        except Exception as e:
            logger.error(f"Error creating exception from rule: {e}")
            return None

    async def _broadcast_status_update(self):
        """Broadcast agent status update via WebSocket"""
        try:
            status = await self.get_status()
            await self.websocket_manager.broadcast({
                "type": "agent_status_update",
                "agent": "verifier",
                "data": status,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Error broadcasting status update: {e}")
