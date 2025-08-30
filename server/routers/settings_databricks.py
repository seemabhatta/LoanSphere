from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import DatabricksConnectionModel

router = APIRouter()


def sanitize(conn: DatabricksConnectionModel) -> dict:
    d = {k: getattr(conn, k) for k in [
        'id','name','server_hostname','http_path','catalog','schema','cluster_id',
        'is_default','is_active','last_connected','created_at','updated_at'
    ]}
    # Add token indicator without exposing the actual token
    d['has_token'] = bool(conn.access_token and conn.access_token.strip())
    return d


@router.get("/databricks/connections")
def list_connections(db: Session = Depends(get_db)) -> List[dict]:
    conns = db.query(DatabricksConnectionModel).order_by(
        DatabricksConnectionModel.is_default.desc(), DatabricksConnectionModel.updated_at.desc()
    ).all()
    return [sanitize(c) for c in conns]


@router.post("/databricks/connections")
def create_connection(payload: dict, db: Session = Depends(get_db)) -> dict:
    required = ['name','server_hostname','http_path','access_token']
    for r in required:
        if r not in payload or not payload[r]:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")

    conn = DatabricksConnectionModel(
        user_id='default',
        name=payload['name'],
        server_hostname=payload['server_hostname'],
        http_path=payload['http_path'],
        access_token=payload.get('access_token'),
        catalog=payload.get('catalog'),
        schema=payload.get('schema'),
        cluster_id=payload.get('cluster_id'),
        is_default=bool(payload.get('isDefault', False)),
        is_active=bool(payload.get('isActive', True))
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return sanitize(conn)


@router.post("/databricks/connections/{conn_id}/test")
def test_connection(conn_id: str, db: Session = Depends(get_db)) -> dict:
    """Test a Databricks connection"""
    conn = db.query(DatabricksConnectionModel).get(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Validate required connection parameters
    missing_params = []
    if not conn.server_hostname or conn.server_hostname.strip() == '':
        missing_params.append("server_hostname")
    if not conn.http_path or conn.http_path.strip() == '':
        missing_params.append("http_path")
    if not conn.access_token or conn.access_token.strip() == '':
        missing_params.append("access_token")
    
    if missing_params:
        return {
            "success": False,
            "message": f"Missing required connection parameters: {', '.join(missing_params)}"
        }
    
    try:
        # Import databricks connector
        from databricks import sql
        
        # Basic validation first
        if len(conn.server_hostname.strip()) < 5:
            return {
                "success": False,
                "message": "Server hostname too short (minimum 5 characters)"
            }
        
        if len(conn.http_path.strip()) < 5:
            return {
                "success": False,
                "message": "HTTP path too short (minimum 5 characters)"
            }
        
        if len(conn.access_token.strip()) < 10:
            return {
                "success": False,
                "message": "Access token too short (minimum 10 characters)"
            }
        
        # Prepare connection configuration
        connection_config = {
            'server_hostname': conn.server_hostname.strip(),
            'http_path': conn.http_path.strip(),
            'access_token': conn.access_token.strip(),
        }
        
        # Attempt real connection to Databricks
        db_conn = None
        try:
            db_conn = sql.connect(**connection_config)
            
            # Test the connection with a simple query
            cursor = db_conn.cursor()
            cursor.execute("SELECT current_version(), current_user()")
            result = cursor.fetchone()
            
            version = result[0] if result[0] else "Unknown"
            current_user = result[1] if result[1] else "Unknown"
            
            cursor.close()
            
            # Update last connected time on successful connection
            conn.last_connected = datetime.utcnow()
            db.commit()
            
            return {
                "success": True,
                "message": f"✅ Successfully connected to Databricks!\n\n" +
                          f"Connection Details:\n" +
                          f"• Databricks Version: {version}\n" +
                          f"• Connected User: {current_user}\n" +
                          f"• Server: {conn.server_hostname}\n" +
                          f"• HTTP Path: {conn.http_path}\n\n" +
                          f"Connection test completed successfully."
            }
            
        except Exception as e:
            error_msg = str(e).lower()
            if "authentication" in error_msg or "token" in error_msg:
                return {
                    "success": False,
                    "message": f"❌ Authentication failed:\n{str(e)}\n\nPlease verify your access token."
                }
            elif "connection" in error_msg or "network" in error_msg:
                return {
                    "success": False,
                    "message": f"❌ Connection failed:\n{str(e)}\n\nPlease check your server hostname and HTTP path."
                }
            else:
                return {
                    "success": False,
                    "message": f"❌ Connection test failed:\n{str(e)}\n\nPlease check your connection parameters and try again."
                }
        finally:
            # Always close the connection if it was opened
            if db_conn:
                try:
                    db_conn.close()
                except:
                    pass
        
    except ImportError:
        return {
            "success": False,
            "message": "Databricks connector not available. Please install databricks-sql-connector."
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}"
        }


@router.put("/databricks/connections/{conn_id}")
def update_connection(conn_id: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    """Update an existing Databricks connection"""
    # Get the existing connection
    conn = db.query(DatabricksConnectionModel).get(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Validate required fields
    required = ['name', 'server_hostname', 'http_path']
    for r in required:
        if r not in payload or not payload[r]:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")
    
    # Update the connection fields
    conn.name = payload['name']
    conn.server_hostname = payload['server_hostname']
    conn.http_path = payload['http_path']
    # Only update access token if explicitly provided and not None/undefined
    if 'access_token' in payload and payload['access_token'] is not None and payload['access_token'].strip():
        conn.access_token = payload['access_token']
    conn.catalog = payload.get('catalog')
    conn.schema = payload.get('schema')
    conn.cluster_id = payload.get('cluster_id')
    conn.is_default = bool(payload.get('is_default', False))
    conn.is_active = bool(payload.get('is_active', True))
    conn.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(conn)
    return sanitize(conn)


@router.put("/databricks/connections/{conn_id}/default")
def set_default(conn_id: str, db: Session = Depends(get_db)) -> dict:
    # Unset others
    db.query(DatabricksConnectionModel).update({DatabricksConnectionModel.is_default: False})
    # Set this one
    conn = db.query(DatabricksConnectionModel).get(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    conn.is_default = True
    db.commit()
    return {"success": True}


@router.delete("/databricks/connections/{conn_id}")
def delete_connection(conn_id: str, db: Session = Depends(get_db)) -> dict:
    conn = db.query(DatabricksConnectionModel).get(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()
    return {"success": True}


@router.post("/databricks/test-connection")
def test_connection_params(payload: dict) -> dict:
    """Test Databricks connection with provided parameters without saving"""
    required = ['name','server_hostname','http_path','access_token']
    for r in required:
        if r not in payload or not payload[r]:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")
    
    try:
        from databricks import sql
        
        # Prepare connection configuration from payload
        connection_config = {
            'server_hostname': payload['server_hostname'].strip(),
            'http_path': payload['http_path'].strip(),
            'access_token': payload['access_token'].strip(),
        }
        
        # Attempt real connection to Databricks
        db_conn = None
        try:
            db_conn = sql.connect(**connection_config)
            
            # Test the connection with a simple query
            cursor = db_conn.cursor()
            cursor.execute("SELECT current_version(), current_user()")
            result = cursor.fetchone()
            
            version = result[0] if result[0] else "Unknown"
            current_user = result[1] if result[1] else "Unknown"
            
            cursor.close()
            
            return {
                "success": True,
                "message": f"✅ Successfully connected to Databricks!\n\n" +
                          f"Connection Details:\n" +
                          f"• Databricks Version: {version}\n" +
                          f"• Connected User: {current_user}\n" +
                          f"• Server: {payload['server_hostname']}\n" +
                          f"• HTTP Path: {payload['http_path']}\n\n" +
                          f"Connection test completed successfully."
            }
            
        except Exception as e:
            error_msg = str(e).lower()
            if "authentication" in error_msg or "token" in error_msg:
                return {
                    "success": False,
                    "message": f"❌ Authentication failed:\n{str(e)}\n\nPlease verify your access token."
                }
            elif "connection" in error_msg or "network" in error_msg:
                return {
                    "success": False,
                    "message": f"❌ Connection failed:\n{str(e)}\n\nPlease check your server hostname and HTTP path."
                }
            else:
                return {
                    "success": False,
                    "message": f"❌ Connection test failed:\n{str(e)}\n\nPlease check your connection parameters and try again."
                }
        finally:
            # Always close the connection if it was opened
            if db_conn:
                try:
                    db_conn.close()
                except:
                    pass
                    
    except ImportError:
        return {
            "success": False,
            "message": "Databricks connector not available. Please install databricks-sql-connector."
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}"
        }