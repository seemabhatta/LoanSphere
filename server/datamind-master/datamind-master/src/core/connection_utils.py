import os
import uuid
from typing import Dict, Any, Optional
import snowflake.connector
from dotenv import load_dotenv

# Load environment variables from root directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '.env'))

# Global connection store - shared across all modules
snowflake_connections: Dict[str, Dict[str, Any]] = {}

def get_connection(connection_id: str) -> Optional[Dict[str, Any]]:
    """Get connection by ID"""
    return snowflake_connections.get(connection_id)

def get_snowflake_connection(connection_id: str):
    """Get the actual Snowflake connection object, with error handling"""
    if connection_id not in snowflake_connections:
        raise Exception("Connection not found")
    
    return snowflake_connections[connection_id]["connection"]

def store_connection(connection_id: str, connection_data: Dict[str, Any]):
    """Store connection data"""
    snowflake_connections[connection_id] = connection_data

def remove_connection(connection_id: str):
    """Remove connection from store"""
    if connection_id in snowflake_connections:
        del snowflake_connections[connection_id]

def create_snowflake_connection():
    """Create a new Snowflake connection using environment variables"""
    # Get connection parameters from environment
    conn_params = {
        "account": os.getenv("SNOWFLAKE_ACCOUNT"),
        "user": os.getenv("SNOWFLAKE_USER"),
        "password": os.getenv("SNOWFLAKE_PASSWORD"),
        "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE"),
        "database": os.getenv("SNOWFLAKE_DATABASE"),
        "schema": os.getenv("SNOWFLAKE_SCHEMA"),
        "role": os.getenv("SNOWFLAKE_ROLE")
    }
    
    # Debug logging
    print(f"🔍 Snowflake connection params loaded:")
    print(f"  Account: {conn_params['account']}")
    print(f"  User: {conn_params['user']}")
    print(f"  Password: {'*' * len(conn_params['password']) if conn_params['password'] else None}")
    print(f"  Warehouse: {conn_params['warehouse']}")
    print(f"  Database: {conn_params['database']}")
    print(f"  Schema: {conn_params['schema']}")
    print(f"  Role: {conn_params['role']}")
    
    # Validate required parameters
    if not all([conn_params["account"], conn_params["user"], conn_params["password"]]):
        missing = [k for k, v in conn_params.items() if k in ["account", "user", "password"] and not v]
        raise Exception(f"Missing required Snowflake credentials in environment variables: {missing}")
    
    # Remove None values
    conn_params = {k: v for k, v in conn_params.items() if v is not None}
    
    try:
        print("🔄 Attempting to connect to Snowflake...")
        # Create connection
        conn = snowflake.connector.connect(**conn_params)
        print("✅ Snowflake connection established")
        
        # Test connection
        print("🧪 Testing connection...")
        cursor = conn.cursor()
        cursor.execute("SELECT current_version()")
        version = cursor.fetchone()[0]
        cursor.close()
        print(f"✅ Connection test successful. Snowflake version: {version}")
        
    except Exception as e:
        print(f"❌ Snowflake connection failed: {str(e)}")
        print(f"❌ Error type: {type(e).__name__}")
        raise e
    
    # Generate connection ID
    connection_id = str(uuid.uuid4())
    
    # Store connection
    connection_data = {
        "connection": conn,
        "version": version,
        **conn_params
    }
    store_connection(connection_id, connection_data)
    
    return connection_id, connection_data

def get_active_connections_count() -> int:
    """Get count of active connections"""
    return len(snowflake_connections)