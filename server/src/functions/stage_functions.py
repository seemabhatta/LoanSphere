"""
Snowflake staging functions for file upload and management
Provides DataMind CLI-compatible interface for LoanSphere
"""
import snowflake.connector
import tempfile
import os
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


def create_snowflake_stage(connection_id: str, database_name: str, schema_name: str, stage_name: str) -> Dict[str, Any]:
    """Create a Snowflake stage for file uploads"""
    try:
        config = get_snowflake_connection(connection_id)
        
        # Connect to Snowflake
        conn = snowflake.connector.connect(**config)
        cursor = conn.cursor()
        
        try:
            # Create stage if it doesn't exist
            stage_sql = f"""
            CREATE STAGE IF NOT EXISTS {database_name}.{schema_name}.{stage_name}
            COMMENT = 'Stage for YAML dictionary files created by LoanSphere @datamodel agent'
            """
            cursor.execute(stage_sql)
            
            return {
                "status": "success",
                "message": f"Stage {stage_name} created successfully"
            }
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error creating stage: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


def save_dictionary_to_stage(connection_id: str, stage_name: str, filename: str, yaml_content: str) -> Dict[str, Any]:
    """Save YAML dictionary content to Snowflake stage"""
    try:
        config = get_snowflake_connection(connection_id)
        
        # Create temporary file with YAML content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as temp_file:
            temp_file.write(yaml_content)
            temp_file_path = temp_file.name
        
        try:
            # Connect to Snowflake
            conn = snowflake.connector.connect(**config)
            cursor = conn.cursor()
            
            try:
                # Upload file to stage
                put_sql = f"PUT file://{temp_file_path} {stage_name}/{filename}"
                cursor.execute(put_sql)
                
                return {
                    "status": "success",
                    "message": f"File uploaded to {stage_name}/{filename}"
                }
                
            finally:
                cursor.close()
                conn.close()
                
        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)
            
    except Exception as e:
        logger.error(f"Error saving to stage: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


def list_stage_files(connection_id: str, database_name: str, schema_name: str, stage_name: str) -> Dict[str, Any]:
    """List files in a Snowflake stage"""
    try:
        config = get_snowflake_connection(connection_id)
        
        # Connect to Snowflake
        conn = snowflake.connector.connect(**config)
        cursor = conn.cursor()
        
        try:
            # List files in stage
            list_sql = f"LIST @{database_name}.{schema_name}.{stage_name}"
            cursor.execute(list_sql)
            
            files = []
            for row in cursor.fetchall():
                files.append({
                    'name': os.path.basename(row[0]),  # File name
                    'size': row[1],  # File size
                    'last_modified': row[2]  # Last modified
                })
            
            return {
                "status": "success",
                "files": files
            }
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error listing stage files: {e}")
        return {
            "status": "error",
            "error": str(e)
        }