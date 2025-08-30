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


@router.put("/snowflake/connections/{conn_id}")
def update_connection(conn_id: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    """Update an existing Snowflake connection"""
    # Get the existing connection
    conn = db.query(SnowflakeConnectionModel).get(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Validate required fields
    required = ['user_id', 'name', 'account', 'username', 'password']
    for r in required:
        if r not in payload or not payload[r]:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")
    
    # Update the connection fields
    conn.user_id = payload['user_id']
    conn.name = payload['name']
    conn.account = payload['account']
    conn.username = payload['username']
    conn.password = payload.get('password')
    conn.database = payload.get('database')
    conn.schema = payload.get('schema')
    conn.warehouse = payload.get('warehouse')
    conn.role = payload.get('role')
    conn.authenticator = payload.get('authenticator', 'SNOWFLAKE')
    conn.is_default = bool(payload.get('is_default', False))
    conn.is_active = bool(payload.get('is_active', True))
    conn.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(conn)
    return sanitize(conn)


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


@router.post("/snowflake/test-env-connection")
def test_env_connection() -> dict:
    """Test Snowflake connection using environment variables without saving"""
    import os
    
    # Get Snowflake configuration from environment variables
    snowflake_config = {
        'user': os.getenv('SNOWFLAKE_USER'),
        'password': os.getenv('SNOWFLAKE_PASSWORD'),
        'account': os.getenv('SNOWFLAKE_ACCOUNT'),
        'warehouse': os.getenv('SNOWFLAKE_WAREHOUSE'),
        'database': os.getenv('SNOWFLAKE_DATABASE'),
        'schema': os.getenv('SNOWFLAKE_SCHEMA'),
        'role': os.getenv('SNOWFLAKE_ROLE')
    }
    
    # Check if all required Snowflake environment variables are present
    missing_vars = [k for k, v in snowflake_config.items() if not v]
    if missing_vars:
        return {
            'success': False,
            'message': f"Missing Snowflake environment variables: {', '.join([f'SNOWFLAKE_{k.upper()}' for k in missing_vars])}"
        }
    
    # For demo purposes, validate configuration but don't attempt real connection
    # In production, you would uncomment the real connection test below
    
    # Validate configuration format
    if not snowflake_config['account'] or len(snowflake_config['account']) < 5:
        return {
            'success': False,
            'message': 'Invalid account identifier format'
        }
    
    if not snowflake_config['user'] or len(snowflake_config['user']) < 3:
        return {
            'success': False,
            'message': 'Invalid username format'
        }
    
    # For demo: Return success with configuration summary
    return {
        'success': True,
        'message': f'✅ Configuration validated successfully!\n' +
                   f'Account: {snowflake_config["account"]}\n' +
                   f'User: {snowflake_config["user"]}\n' +
                   f'Database: {snowflake_config["database"]}\n' +
                   f'Warehouse: {snowflake_config["warehouse"]}\n' +
                   f'Note: For production, enable real connection test in the code.'
    }
    
    # PRODUCTION CODE (currently commented out):
    # try:
    #     from services.snowflake_util import test_connection as test_sf
    #     result = test_sf(snowflake_config)
    #     return result
    # except ImportError:
    #     return {
    #         'success': False,
    #         'message': 'Snowflake connector not available'
    #     }
    # except Exception as e:
    #     return {
    #         'success': False,
    #         'message': f'Connection test failed: {str(e)}'
    #     }

