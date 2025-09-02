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
        
        config = {
            'user': conn.username,
            'account': conn.account,
            'warehouse': conn.warehouse,
            'database': conn.database,
            'schema': conn.schema,
            'role': conn.role
        }
        
        # Handle authentication based on type
        if conn.authenticator == 'RSA' and conn.private_key:
            # RSA key-pair authentication
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
                f.write(conn.private_key.strip())
                config['private_key_file'] = f.name
        else:
            # Traditional password authentication
            config['password'] = conn.password
            if conn.authenticator and conn.authenticator.strip():
                config['authenticator'] = conn.authenticator.strip().lower()
        
        return config
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
        
        # Create a temporary directory and write a file with the exact desired filename
        tmp_dir = tempfile.mkdtemp(prefix="yaml_stage_")
        # Normalize extension to .yaml
        if filename.lower().endswith('.yml'):
            filename = filename[:-4] + '.yaml'
        file_path = os.path.join(tmp_dir, filename)
        with open(file_path, 'w', encoding='utf-8') as temp_file:
            temp_file.write(yaml_content)
        
        try:
            # Connect to Snowflake
            conn = snowflake.connector.connect(**config)
            cursor = conn.cursor()
            
            try:
                # Upload file to stage without auto-compression so the name remains as provided
                # Note: Snowflake PUT uses the source file name; the target path must be a stage (or stage folder) only.
                put_sql = f"PUT file://{file_path} {stage_name} AUTO_COMPRESS=FALSE OVERWRITE=TRUE"
                cursor.execute(put_sql)
                
                return {
                    "status": "success",
                    "message": f"File uploaded to {stage_name}/{filename}"
                }
                
            finally:
                cursor.close()
                conn.close()
                
        finally:
            # Clean up temporary file and directory
            try:
                os.unlink(file_path)
            finally:
                try:
                    os.rmdir(tmp_dir)
                except Exception:
                    pass
            
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
