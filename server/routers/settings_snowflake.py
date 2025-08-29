from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import SnowflakeConnectionModel

router = APIRouter()


def sanitize(conn: SnowflakeConnectionModel) -> dict:
    d = {k: getattr(conn, k) for k in [
        'id','user_id','name','account','username','database','schema','warehouse','role','authenticator',
        'is_default','is_active','last_connected','created_at','updated_at'
    ]}
    return d


@router.get("/snowflake/connections/{user_id}")
def list_connections(user_id: str, db: Session = Depends(get_db)) -> List[dict]:
    conns = db.query(SnowflakeConnectionModel).filter_by(user_id=user_id).order_by(
        SnowflakeConnectionModel.is_default.desc(), SnowflakeConnectionModel.updated_at.desc()
    ).all()
    return [sanitize(c) for c in conns]


@router.post("/snowflake/connections")
def create_connection(payload: dict, db: Session = Depends(get_db)) -> dict:
    required = ['userId','name','account','username','password']
    for r in required:
        if r not in payload or not payload[r]:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")

    conn = SnowflakeConnectionModel(
        user_id=payload['userId'],
        name=payload['name'],
        account=payload['account'],
        username=payload['username'],
        password=payload.get('password'),
        database=payload.get('database'),
        schema=payload.get('schema'),
        warehouse=payload.get('warehouse'),
        role=payload.get('role'),
        authenticator=payload.get('authenticator', 'SNOWFLAKE'),
        is_default=bool(payload.get('isDefault', False)),
        is_active=bool(payload.get('isActive', True))
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return sanitize(conn)


@router.post("/snowflake/connections/{conn_id}/test")
def test_connection(conn_id: str, db: Session = Depends(get_db)) -> dict:
    # Stub: always returns success True; replace with real Snowflake test later
    conn = db.query(SnowflakeConnectionModel).get(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    conn.last_connected = datetime.utcnow()
    db.commit()
    return {"success": True}


@router.put("/snowflake/connections/{conn_id}/default")
def set_default(conn_id: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    user_id = payload.get('userId')
    if not user_id:
        raise HTTPException(status_code=400, detail="userId is required")
    # Unset others
    db.query(SnowflakeConnectionModel).filter_by(user_id=user_id).update({SnowflakeConnectionModel.is_default: False})
    # Set this one
    conn = db.query(SnowflakeConnectionModel).get(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    conn.is_default = True
    db.commit()
    return {"success": True}


@router.delete("/snowflake/connections/{conn_id}")
def delete_connection(conn_id: str, db: Session = Depends(get_db)) -> dict:
    conn = db.query(SnowflakeConnectionModel).get(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()
    return {"success": True}

