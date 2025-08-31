"""
Metadata functions for Snowflake database operations
Provides DataMind CLI-compatible interface for LoanSphere
"""
import snowflake.connector
from typing import Dict, List, Any
from loguru import logger
from database import SessionLocal
from models import SnowflakeConnectionModel


def get_snowflake_connection(connection_id: str) -> Dict[str, Any]:
    """Get Snowflake connection configuration by ID"""
    db = SessionLocal()
    try:
        conn = db.query(SnowflakeConnectionModel).filter_by(id=connection_id).first()
        if not conn:
            raise ValueError(f"Connection not found: {connection_id}")
        
        return {
            'user': conn.username,
            'password': conn.password,
            'account': conn.account,
            'warehouse': conn.warehouse,
            'database': conn.database,
            'schema': conn.schema,
            'role': conn.role
        }
    finally:
        db.close()


def list_databases(session) -> Dict[str, Any]:
    """List available databases in Snowflake connection using session's reusable connection"""
    try:
        # Use the session's reusable connection
        conn = session.get_snowflake_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("SHOW DATABASES")
            databases = [row[1] for row in cursor.fetchall()]  # Database name is in column 1
            
            return {
                "status": "success",
                "databases": databases
            }
            
        finally:
            cursor.close()
            # Don't close conn - it's reused by the session
            
    except Exception as e:
        logger.error(f"Error listing databases: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


def list_schemas(session, database_name: str) -> Dict[str, Any]:
    """List schemas in a specific database using session's reusable connection"""
    try:
        conn = session.get_snowflake_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(f"SHOW SCHEMAS IN DATABASE {database_name}")
            schemas = [row[1] for row in cursor.fetchall()]  # Schema name is in column 1
            
            return {
                "status": "success",
                "schemas": schemas
            }
            
        finally:
            cursor.close()
            
    except Exception as e:
        logger.error(f"Error listing schemas: {e}")
        return {
            "status": "error", 
            "error": str(e)
        }


def list_tables(session, database_name: str, schema_name: str) -> Dict[str, Any]:
    """List tables in a specific database and schema using session's reusable connection"""
    try:
        conn = session.get_snowflake_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(f"SHOW TABLES IN SCHEMA {database_name}.{schema_name}")
            tables = []
            for row in cursor.fetchall():
                tables.append({
                    'table': row[1],  # Table name
                    'table_type': row[3] if len(row) > 3 else 'BASE TABLE'  # Table type
                })
            
            return {
                "status": "success",
                "tables": tables
            }
            
        finally:
            cursor.close()
            
    except Exception as e:
        logger.error(f"Error listing tables: {e}")
        return {
            "status": "error",
            "error": str(e)
        }