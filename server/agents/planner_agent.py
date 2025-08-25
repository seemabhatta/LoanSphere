import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from loguru import logger

from services.loan_service import LoanService

class PlannerAgent:
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
            "name": "PlannerAgent",
            "type": "planner",
            "status": self.status,
            "current_task": self.current_task,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "tasks_completed": self.tasks_completed,
            "tasks_errored": self.tasks_errored
        }

    async def plan_loan_boarding(self, xp_loan_number: str) -> Dict[str, Any]:
        """Plan the loan boarding process"""
        try:
            self.status = "running"
            self.current_task = f"Planning boarding for {xp_loan_number}"
            self.last_activity = datetime.now()
            
            await self._broadcast_status_update()
            
            # Get loan data
            loan = await self.loan_service.get_loan_by_xp_number(xp_loan_number)
            if not loan:
                raise ValueError(f"Loan not found: {xp_loan_number}")
            
            # Create boarding plan
            boarding_plan = await self._create_boarding_plan(loan)
            
            # Log activity
            await self.loan_service.log_pipeline_activity(
                loan_id=loan.id,
                xp_loan_number=xp_loan_number,
                activity_type="boarding_planned",
                status="SUCCESS",
                message="Boarding plan created successfully",
                agent_name="PlannerAgent"
            )
            
            self.tasks_completed += 1
            self.status = "idle"
            self.current_task = None
            
            await self._broadcast_status_update()
            
            return {
                "status": "success",
                "boarding_plan": boarding_plan
            }
            
        except Exception as e:
            logger.error(f"Error planning loan boarding: {e}")
            self.tasks_errored += 1
            self.status = "error"
            await self._broadcast_status_update()
            
            return {
                "status": "error",
                "error": str(e)
            }

    async def _create_boarding_plan(self, loan) -> Dict[str, Any]:
        """Create a detailed boarding plan for the loan"""
        plan = {
            "loan_id": loan.id,
            "xp_loan_number": loan.xp_loan_number,
            "steps": [],
            "estimated_duration": 0,
            "priority": "normal"
        }
        
        # Determine required steps based on loan data
        steps = []
        
        # Data validation step
        steps.append({
            "step_id": "data_validation",
            "name": "Data Validation",
            "description": "Validate loan data completeness and accuracy",
            "agent": "VerifierAgent",
            "estimated_duration": 15,  # minutes
            "dependencies": [],
            "status": "pending"
        })
        
        # Document processing step
        steps.append({
            "step_id": "document_processing",
            "name": "Document Processing",
            "description": "Process and extract data from loan documents",
            "agent": "DocumentAgent", 
            "estimated_duration": 30,
            "dependencies": [],
            "status": "pending"
        })
        
        # Compliance check step
        steps.append({
            "step_id": "compliance_check",
            "name": "Compliance Verification",
            "description": "Verify RESPA/TILA compliance requirements",
            "agent": "VerifierAgent",
            "estimated_duration": 20,
            "dependencies": ["data_validation"],
            "status": "pending"
        })
        
        # Escrow setup step (if required)
        if loan.metadata and loan.metadata.get("escrow_required"):
            steps.append({
                "step_id": "escrow_setup",
                "name": "Escrow Account Setup",
                "description": "Set up escrow account and schedule payments",
                "agent": "ToolAgent",
                "estimated_duration": 25,
                "dependencies": ["data_validation"],
                "status": "pending"
            })
        
        # Final boarding step
        steps.append({
            "step_id": "boarding_completion",
            "name": "Boarding Completion",
            "description": "Finalize loan boarding and update systems",
            "agent": "ToolAgent",
            "estimated_duration": 10,
            "dependencies": ["compliance_check", "document_processing"],
            "status": "pending"
        })
        
        plan["steps"] = steps
        plan["estimated_duration"] = sum(step["estimated_duration"] for step in steps)
        
        # Determine priority based on loan characteristics
        if loan.note_amount and float(loan.note_amount) > 500000:
            plan["priority"] = "high"
        elif loan.status == "purchased":
            plan["priority"] = "medium"
        
        return plan

    async def orchestrate_task_execution(self, boarding_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Orchestrate the execution of boarding tasks"""
        try:
            self.status = "running"
            self.current_task = f"Orchestrating tasks for {boarding_plan['xp_loan_number']}"
            
            await self._broadcast_status_update()
            
            # Execute steps in dependency order
            completed_steps = []
            
            for step in boarding_plan["steps"]:
                # Check if dependencies are met
                dependencies_met = all(
                    dep in completed_steps for dep in step["dependencies"]
                )
                
                if dependencies_met:
                    step_result = await self._execute_step(step, boarding_plan["xp_loan_number"])
                    if step_result["status"] == "success":
                        completed_steps.append(step["step_id"])
                        step["status"] = "completed"
                    else:
                        step["status"] = "failed"
                        # Log failure and potentially retry
                        logger.warning(f"Step {step['step_id']} failed: {step_result.get('error')}")
            
            self.status = "idle"
            self.current_task = None
            await self._broadcast_status_update()
            
            return {
                "status": "completed",
                "completed_steps": completed_steps,
                "total_steps": len(boarding_plan["steps"])
            }
            
        except Exception as e:
            logger.error(f"Error orchestrating task execution: {e}")
            self.status = "error"
            await self._broadcast_status_update()
            return {"status": "error", "error": str(e)}

    async def _execute_step(self, step: Dict[str, Any], xp_loan_number: str) -> Dict[str, Any]:
        """Execute a single boarding step"""
        try:
            # Simulate step execution based on agent type
            agent_name = step["agent"]
            
            await self.loan_service.log_pipeline_activity(
                xp_loan_number=xp_loan_number,
                activity_type="step_started",
                status="RUNNING",
                message=f"Started {step['name']}",
                agent_name=agent_name
            )
            
            # Simulate processing time
            await asyncio.sleep(1)  # Reduced for demo purposes
            
            await self.loan_service.log_pipeline_activity(
                xp_loan_number=xp_loan_number,
                activity_type="step_completed",
                status="SUCCESS",
                message=f"Completed {step['name']}",
                agent_name=agent_name
            )
            
            return {"status": "success"}
            
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def _broadcast_status_update(self):
        """Broadcast agent status update via WebSocket"""
        try:
            status = await self.get_status()
            await self.websocket_manager.broadcast({
                "type": "agent_status_update",
                "agent": "planner",
                "data": status,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Error broadcasting status update: {e}")
