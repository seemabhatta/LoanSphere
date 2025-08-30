from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Dict
from datetime import datetime

from database import get_db
from models import AgentConfigurationModel

router = APIRouter()


@router.get("/agent-config/{user_id}")
def get_agent_config(user_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    config = (
        db.query(AgentConfigurationModel)
        .filter(AgentConfigurationModel.user_id == user_id)
        .order_by(AgentConfigurationModel.updated_at.desc())
        .first()
    )
    if config:
        return config.config_data or {"functionTools": [], "agentPrompts": [], "agentConfigs": []}
    return {"functionTools": [], "agentPrompts": [], "agentConfigs": []}


@router.put("/agent-config/{user_id}")
def save_agent_config(user_id: str, payload: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    existing = (
        db.query(AgentConfigurationModel)
        .filter(AgentConfigurationModel.user_id == user_id)
        .order_by(AgentConfigurationModel.updated_at.desc())
        .first()
    )
    if existing:
        existing.config_data = payload
        existing.updated_at = datetime.utcnow()
        db.commit()
        return {"success": True}
    new_cfg = AgentConfigurationModel(user_id=user_id, config_data=payload)
    db.add(new_cfg)
    db.commit()
    return {"success": True}

