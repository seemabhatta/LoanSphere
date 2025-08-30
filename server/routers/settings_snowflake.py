from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import SnowflakeConnectionModel

router = APIRouter()


def sanitize(conn: SnowflakeConnectionModel) -> dict:
    d = {k: getattr(conn, k) for k in [
        'id','name','account','username','database','schema','warehouse','role','authenticator',
        'is_default','is_active','last_connected','created_at','updated_at'
    ]}
    return d


@router.get("/snowflake/connections")
def list_connections(db: Session = Depends(get_db)) -> List[dict]:
    conns = db.query(SnowflakeConnectionModel).order_by(
        SnowflakeConnectionModel.is_default.desc(), SnowflakeConnectionModel.updated_at.desc()
    ).all()
    return [sanitize(c) for c in conns]


@router.post("/snowflake/connections")
def create_connection(payload: dict, db: Session = Depends(get_db)) -> dict:
    required = ['name','account','username','password']
    for r in required:
        if r not in payload or not payload[r]:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")

    conn = SnowflakeConnectionModel(
        user_id='default',
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
    """Test a Snowflake connection"""
    conn = db.query(SnowflakeConnectionModel).get(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Validate required connection parameters
    missing_params = []
    if not conn.account or conn.account.strip() == '':
        missing_params.append("account")
    if not conn.username or conn.username.strip() == '':
        missing_params.append("username")
    if not conn.password or conn.password.strip() == '':
        missing_params.append("password")
    
    if missing_params:
        return {
            "success": False,
            "message": f"Missing required connection parameters: {', '.join(missing_params)}"
        }
    
    try:
        # Import snowflake connector
        import snowflake.connector
        from snowflake.connector.errors import DatabaseError, ProgrammingError
        
        # Basic validation first
        if len(conn.account.strip()) < 5:
            return {
                "success": False,
                "message": "Account identifier too short (minimum 5 characters)"
            }
        
        if len(conn.username.strip()) < 3:
            return {
                "success": False,
                "message": "Username too short (minimum 3 characters)"
            }
        
        if len(conn.password.strip()) < 1:
            return {
                "success": False,
                "message": "Password cannot be empty"
            }
        
        # Prepare connection configuration
        connection_config = {
            'user': conn.username.strip(),
            'password': conn.password.strip(),
            'account': conn.account.strip(),
        }
        
        # Add optional parameters if they exist
        if conn.warehouse and conn.warehouse.strip():
            connection_config['warehouse'] = conn.warehouse.strip()
        if conn.database and conn.database.strip():
            connection_config['database'] = conn.database.strip()
        if conn.schema and conn.schema.strip():
            connection_config['schema'] = conn.schema.strip()
        if conn.role and conn.role.strip():
            connection_config['role'] = conn.role.strip()
        if conn.authenticator and conn.authenticator.strip():
            connection_config['authenticator'] = conn.authenticator.strip().lower()
        
        # Set connection timeout
        connection_config['connection_timeout'] = 30
        connection_config['network_timeout'] = 30
        
        # Attempt real connection to Snowflake
        sf_conn = None
        try:
            sf_conn = snowflake.connector.connect(**connection_config)
            
            # Test the connection with a simple query
            cursor = sf_conn.cursor()
            cursor.execute("SELECT CURRENT_VERSION(), CURRENT_USER(), CURRENT_ROLE(), CURRENT_DATABASE(), CURRENT_WAREHOUSE()")
            result = cursor.fetchone()
            
            version = result[0] if result[0] else "Unknown"
            current_user = result[1] if result[1] else "Unknown"
            current_role = result[2] if result[2] else "None"
            current_database = result[3] if result[3] else "None"
            current_warehouse = result[4] if result[4] else "None"
            
            cursor.close()
            
            # Update last connected time on successful connection
            conn.last_connected = datetime.utcnow()
            db.commit()
            
            return {
                "success": True,
                "message": f"✅ Successfully connected to Snowflake!\n\n" +
                          f"Connection Details:\n" +
                          f"• Snowflake Version: {version}\n" +
                          f"• Connected User: {current_user}\n" +
                          f"• Current Role: {current_role}\n" +
                          f"• Current Database: {current_database}\n" +
                          f"• Current Warehouse: {current_warehouse}\n\n" +
                          f"Connection test completed successfully."
            }
            
        except DatabaseError as e:
            return {
                "success": False,
                "message": f"❌ Database connection failed:\n{str(e)}\n\nPlease check your credentials and network connectivity."
            }
        except ProgrammingError as e:
            return {
                "success": False,
                "message": f"❌ Authentication failed:\n{str(e)}\n\nPlease verify your username, password, and account identifier."
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"❌ Connection test failed:\n{str(e)}\n\nPlease check your connection parameters and try again."
            }
        finally:
            # Always close the connection if it was opened
            if sf_conn:
                try:
                    sf_conn.close()
                except:
                    pass
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}"
        }


@router.put("/snowflake/connections/{conn_id}")
def update_connection(conn_id: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    """Update an existing Snowflake connection"""
    # Get the existing connection
    conn = db.query(SnowflakeConnectionModel).get(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Validate required fields (removed user_id and password from required)
    required = ['name', 'account', 'username']
    for r in required:
        if r not in payload or not payload[r]:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")
    
    # Update the connection fields
    conn.name = payload['name']
    conn.account = payload['account']
    conn.username = payload['username']
    # Only update password if provided (non-empty)
    if payload.get('password'):
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
def set_default(conn_id: str, db: Session = Depends(get_db)) -> dict:
    # Unset others
    db.query(SnowflakeConnectionModel).update({SnowflakeConnectionModel.is_default: False})
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


@router.post("/snowflake/test-connection")
def test_connection_params(payload: dict) -> dict:
    """Test Snowflake connection with provided parameters without saving"""
    required = ['name','account','username','password']
    for r in required:
        if r not in payload or not payload[r]:
            raise HTTPException(status_code=400, detail=f"Missing field: {r}")
    
    try:
        import snowflake.connector
        from snowflake.connector.errors import DatabaseError, ProgrammingError
        
        # Prepare connection configuration from payload
        connection_config = {
            'user': payload['username'].strip(),
            'password': payload['password'].strip(),
            'account': payload['account'].strip(),
        }
        
        # Add optional parameters if they exist
        if payload.get('warehouse') and payload['warehouse'].strip():
            connection_config['warehouse'] = payload['warehouse'].strip()
        if payload.get('database') and payload['database'].strip():
            connection_config['database'] = payload['database'].strip()
        if payload.get('schema') and payload['schema'].strip():
            connection_config['schema'] = payload['schema'].strip()
        if payload.get('role') and payload['role'].strip():
            connection_config['role'] = payload['role'].strip()
        if payload.get('authenticator') and payload['authenticator'].strip():
            connection_config['authenticator'] = payload['authenticator'].strip().lower()
        
        # Set connection timeout
        connection_config['connection_timeout'] = 30
        connection_config['network_timeout'] = 30
        
        # Attempt real connection to Snowflake
        sf_conn = None
        try:
            sf_conn = snowflake.connector.connect(**connection_config)
            
            # Test the connection with a simple query
            cursor = sf_conn.cursor()
            cursor.execute("SELECT CURRENT_VERSION(), CURRENT_USER(), CURRENT_ROLE(), CURRENT_DATABASE(), CURRENT_WAREHOUSE()")
            result = cursor.fetchone()
            
            version = result[0] if result[0] else "Unknown"
            current_user = result[1] if result[1] else "Unknown"
            current_role = result[2] if result[2] else "None"
            current_database = result[3] if result[3] else "None"
            current_warehouse = result[4] if result[4] else "None"
            
            cursor.close()
            
            return {
                "success": True,
                "message": f"✅ Successfully connected to Snowflake!\n\n" +
                          f"Connection Details:\n" +
                          f"• Snowflake Version: {version}\n" +
                          f"• Connected User: {current_user}\n" +
                          f"• Current Role: {current_role}\n" +
                          f"• Current Database: {current_database}\n" +
                          f"• Current Warehouse: {current_warehouse}\n\n" +
                          f"Connection test completed successfully."
            }
            
        except DatabaseError as e:
            return {
                "success": False,
                "message": f"❌ Database connection failed:\n{str(e)}\n\nPlease check your credentials and network connectivity."
            }
        except ProgrammingError as e:
            return {
                "success": False,
                "message": f"❌ Authentication failed:\n{str(e)}\n\nPlease verify your username, password, and account identifier."
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"❌ Connection test failed:\n{str(e)}\n\nPlease check your connection parameters and try again."
            }
        finally:
            # Always close the connection if it was opened
            if sf_conn:
                try:
                    sf_conn.close()
                except:
                    pass
                    
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}"
        }


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

