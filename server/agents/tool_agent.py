import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from loguru import logger

from services.loan_service import LoanService

class ToolAgent:
    def __init__(self, loan_service: LoanService, websocket_manager):
        self.loan_service = loan_service
        self.websocket_manager = websocket_manager
        self.status = "idle"
        self.current_task = None
        self.last_activity = datetime.now()
        self.tasks_completed = 0
        self.tasks_errored = 0

    async def get_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "name": "ToolAgent",
            "type": "tool",
            "status": self.status,
            "current_task": self.current_task,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "tasks_completed": self.tasks_completed,
            "tasks_errored": self.tasks_errored
        }

    async def execute_boarding_tools(self, xp_loan_number: str, tools: list) -> Dict[str, Any]:
        """Execute boarding tools for a loan"""
        try:
            self.status = "running"
            self.current_task = f"Executing tools for {xp_loan_number}"
            self.last_activity = datetime.now()
            
            await self._broadcast_status_update()
            
            # Get loan data
            loan = await self.loan_service.get_loan_by_xp_number(xp_loan_number)
            if not loan:
                raise ValueError(f"Loan not found: {xp_loan_number}")
            
            results = []
            
            for tool in tools:
                tool_result = await self._execute_tool(tool, loan)
                results.append(tool_result)
                
                # Log activity
                await self.loan_service.log_pipeline_activity(
                    loan_id=loan.id,
                    xp_loan_number=xp_loan_number,
                    activity_type="tool_executed",
                    status="SUCCESS" if tool_result["status"] == "success" else "ERROR",
                    message=f"Tool {tool['name']} executed",
                    agent_name="ToolAgent"
                )
            
            self.tasks_completed += 1
            self.status = "idle"
            self.current_task = None
            
            await self._broadcast_status_update()
            
            return {
                "status": "success",
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Error executing boarding tools: {e}")
            self.tasks_errored += 1
            self.status = "error"
            await self._broadcast_status_update()
            
            return {
                "status": "error",
                "error": str(e)
            }

    async def _execute_tool(self, tool: Dict[str, Any], loan) -> Dict[str, Any]:
        """Execute a specific tool"""
        try:
            tool_name = tool.get("name")
            
            if tool_name == "escrow_calculator":
                return await self._execute_escrow_calculator(loan)
            elif tool_name == "srp_pricer":
                return await self._execute_srp_pricer(loan)
            elif tool_name == "compliance_checker":
                return await self._execute_compliance_checker(loan)
            elif tool_name == "data_validator":
                return await self._execute_data_validator(loan)
            else:
                return {
                    "status": "error",
                    "tool": tool_name,
                    "error": f"Unknown tool: {tool_name}"
                }
                
        except Exception as e:
            return {
                "status": "error",
                "tool": tool.get("name", "unknown"),
                "error": str(e)
            }

    async def _execute_escrow_calculator(self, loan) -> Dict[str, Any]:
        """Execute escrow calculation tool"""
        try:
            # Simulate escrow calculation
            property_value = float(loan.property_value) if loan.property_value else 300000
            annual_taxes = property_value * 0.012  # 1.2% property tax rate
            annual_insurance = property_value * 0.003  # 0.3% insurance rate
            
            monthly_escrow = (annual_taxes + annual_insurance) / 12
            
            escrow_data = {
                "monthly_escrow_payment": round(monthly_escrow, 2),
                "annual_taxes": round(annual_taxes, 2),
                "annual_insurance": round(annual_insurance, 2),
                "total_annual_escrow": round(annual_taxes + annual_insurance, 2)
            }
            
            # Update loan metadata
            metadata = loan.metadata or {}
            metadata["escrow_calculation"] = escrow_data
            metadata["escrow_required"] = True
            
            await self.loan_service.update_loan_status(
                loan.id,
                loan.status,
                metadata
            )
            
            return {
                "status": "success",
                "tool": "escrow_calculator",
                "result": escrow_data
            }
            
        except Exception as e:
            return {
                "status": "error",
                "tool": "escrow_calculator",
                "error": str(e)
            }

    async def _execute_srp_pricer(self, loan) -> Dict[str, Any]:
        """Execute SRP pricing tool"""
        try:
            # Simulate SRP pricing calculation
            note_amount = float(loan.note_amount) if loan.note_amount else 250000
            interest_rate = float(loan.interest_rate) if loan.interest_rate else 0.0675
            
            # Base SRP rate calculation (simplified)
            base_srp_rate = 1.25  # Base rate
            
            # Adjustments based on loan characteristics
            ltv_adjustment = 0.1 if loan.ltv_ratio and float(loan.ltv_ratio) > 0.8 else 0
            credit_adjustment = -0.05 if loan.credit_score and loan.credit_score > 750 else 0.05
            
            gross_srp_rate = base_srp_rate + ltv_adjustment + credit_adjustment
            gross_srp_amount = note_amount * (gross_srp_rate / 100)
            
            # Deduct servicer fees
            servicer_fees = 185.00
            net_srp_amount = gross_srp_amount - servicer_fees
            
            # Holdback (typically 10%)
            holdback_amount = gross_srp_amount * 0.10
            funded_srp = net_srp_amount - holdback_amount
            
            srp_data = {
                "gross_srp_rate": round(gross_srp_rate, 5),
                "gross_srp_amount": round(gross_srp_amount, 2),
                "servicer_fees": servicer_fees,
                "net_srp_amount": round(net_srp_amount, 2),
                "holdback_amount": round(holdback_amount, 2),
                "funded_srp": round(funded_srp, 2)
            }
            
            # Update loan metadata
            metadata = loan.metadata or {}
            metadata["srp_pricing"] = srp_data
            
            await self.loan_service.update_loan_status(
                loan.id,
                loan.status,
                metadata
            )
            
            return {
                "status": "success",
                "tool": "srp_pricer",
                "result": srp_data
            }
            
        except Exception as e:
            return {
                "status": "error",
                "tool": "srp_pricer",
                "error": str(e)
            }

    async def _execute_compliance_checker(self, loan) -> Dict[str, Any]:
        """Execute compliance checking tool"""
        try:
            compliance_results = {
                "respa_compliance": True,
                "tila_compliance": True,
                "hmda_compliance": True,
                "escrow_compliance": True,
                "issues": []
            }
            
            # Check for common compliance issues
            if not loan.interest_rate:
                compliance_results["tila_compliance"] = False
                compliance_results["issues"].append("Missing interest rate for TILA disclosure")
            
            if loan.metadata and loan.metadata.get("escrow_required") and not loan.metadata.get("escrow_calculation"):
                compliance_results["escrow_compliance"] = False
                compliance_results["issues"].append("Escrow required but not calculated")
            
            # Update loan metadata
            metadata = loan.metadata or {}
            metadata["compliance_check"] = compliance_results
            
            await self.loan_service.update_loan_status(
                loan.id,
                loan.status,
                metadata
            )
            
            return {
                "status": "success",
                "tool": "compliance_checker",
                "result": compliance_results
            }
            
        except Exception as e:
            return {
                "status": "error",
                "tool": "compliance_checker",
                "error": str(e)
            }

    async def _execute_data_validator(self, loan) -> Dict[str, Any]:
        """Execute data validation tool"""
        try:
            validation_results = {
                "valid": True,
                "completeness_score": 0,
                "missing_fields": [],
                "data_quality_issues": []
            }
            
            required_fields = [
                "xp_loan_number", "note_amount", "interest_rate", 
                "property_value", "ltv_ratio"
            ]
            
            missing_count = 0
            for field in required_fields:
                if not getattr(loan, field, None):
                    validation_results["missing_fields"].append(field)
                    missing_count += 1
            
            validation_results["completeness_score"] = round(
                (len(required_fields) - missing_count) / len(required_fields) * 100, 1
            )
            
            if missing_count > 0:
                validation_results["valid"] = False
            
            # Update loan metadata
            metadata = loan.metadata or {}
            metadata["data_validation"] = validation_results
            
            await self.loan_service.update_loan_status(
                loan.id,
                loan.status,
                metadata
            )
            
            return {
                "status": "success",
                "tool": "data_validator",
                "result": validation_results
            }
            
        except Exception as e:
            return {
                "status": "error",
                "tool": "data_validator",
                "error": str(e)
            }

    async def _broadcast_status_update(self):
        """Broadcast agent status update via WebSocket"""
        try:
            status = await self.get_status()
            await self.websocket_manager.broadcast({
                "type": "agent_status_update",
                "agent": "tool",
                "data": status,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Error broadcasting status update: {e}")
