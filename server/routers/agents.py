from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from database import get_db
from models import AgentModel

router = APIRouter()

@router.get("/")
async def get_agents(db: Session = Depends(get_db)):
    """Get all agents"""
    try:
        agents = db.query(AgentModel).all()
        
        return {
            "agents": [
                {
                    "id": agent.id,
                    "name": agent.name,
                    "type": agent.type,
                    "status": agent.status,
                    "description": agent.description,
                    "current_task": agent.current_task,
                    "tasks_completed": agent.tasks_completed,
                    "tasks_errored": agent.tasks_errored,
                    "last_activity": agent.last_activity.isoformat() if agent.last_activity else None,
                    "metadata": agent.metadata
                }
                for agent in agents
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{agent_id}")
async def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """Get agent by ID"""
    try:
        agent = db.query(AgentModel).filter_by(id=agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return {
            "id": agent.id,
            "name": agent.name,
            "type": agent.type,
            "status": agent.status,
            "description": agent.description,
            "current_task": agent.current_task,
            "tasks_completed": agent.tasks_completed,
            "tasks_errored": agent.tasks_errored,
            "last_activity": agent.last_activity.isoformat() if agent.last_activity else None,
            "metadata": agent.metadata
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/summary")
async def get_agent_status_summary(db: Session = Depends(get_db)):
    """Get agent status summary"""
    try:
        agents = db.query(AgentModel).all()
        
        status_counts = {}
        agent_details = []
        
        for agent in agents:
            # Count by status
            if agent.status not in status_counts:
                status_counts[agent.status] = 0
            status_counts[agent.status] += 1
            
            # Prepare agent details
            agent_details.append({
                "name": agent.name,
                "type": agent.type,
                "status": agent.status,
                "current_task": agent.current_task,
                "last_activity": agent.last_activity.isoformat() if agent.last_activity else None
            })
        
        return {
            "summary": {
                "total_agents": len(agents),
                "status_distribution": status_counts
            },
            "agents": agent_details
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{agent_id}/status")
async def update_agent_status(
    agent_id: str,
    status_data: dict,
    db: Session = Depends(get_db)
):
    """Update agent status"""
    try:
        agent = db.query(AgentModel).filter_by(id=agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Update status
        if "status" in status_data:
            agent.status = status_data["status"]
        
        if "current_task" in status_data:
            agent.current_task = status_data["current_task"]
        
        if "metadata" in status_data:
            current_metadata = agent.metadata or {}
            current_metadata.update(status_data["metadata"])
            agent.metadata = current_metadata
        
        # Update activity timestamp
        from datetime import datetime
        agent.last_activity = datetime.now()
        
        db.commit()
        db.refresh(agent)
        
        return {
            "id": agent.id,
            "name": agent.name,
            "status": agent.status,
            "current_task": agent.current_task,
            "last_activity": agent.last_activity.isoformat() if agent.last_activity else None
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{agent_id}/task/complete")
async def complete_task(agent_id: str, task_data: dict, db: Session = Depends(get_db)):
    """Mark a task as completed for an agent"""
    try:
        agent = db.query(AgentModel).filter_by(id=agent_id).first()
        
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Update task counters
        success = task_data.get("success", True)
        if success:
            agent.tasks_completed += 1
        else:
            agent.tasks_errored += 1
        
        # Clear current task
        agent.current_task = None
        agent.status = "idle"
        
        # Update activity timestamp
        from datetime import datetime
        agent.last_activity = datetime.now()
        
        db.commit()
        db.refresh(agent)
        
        return {
            "id": agent.id,
            "name": agent.name,
            "status": agent.status,
            "tasks_completed": agent.tasks_completed,
            "tasks_errored": agent.tasks_errored
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/performance/metrics")
async def get_agent_performance_metrics(db: Session = Depends(get_db)):
    """Get agent performance metrics"""
    try:
        agents = db.query(AgentModel).all()
        
        performance_data = []
        
        for agent in agents:
            total_tasks = agent.tasks_completed + agent.tasks_errored
            success_rate = (agent.tasks_completed / total_tasks * 100) if total_tasks > 0 else 0
            
            performance_data.append({
                "name": agent.name,
                "type": agent.type,
                "tasks_completed": agent.tasks_completed,
                "tasks_errored": agent.tasks_errored,
                "total_tasks": total_tasks,
                "success_rate": round(success_rate, 1),
                "current_status": agent.status
            })
        
        return {
            "performance_metrics": performance_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
