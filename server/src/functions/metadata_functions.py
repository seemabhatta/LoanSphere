"""
Enhanced metadata functions - Copied and improved from DataMind CLI
Provides efficient Snowflake metadata operations with connection pooling
"""
import snowflake.connector
from typing import Dict, List, Any
from loguru import logger
from database import SessionLocal
from models import SnowflakeConnectionModel


def get_snowflake_connection_config(connection_id: str) -> Dict[str, Any]:
    """Get Snowflake connection configuration by ID"""
    db = SessionLocal()
    try:
        conn = db.query(SnowflakeConnectionModel).filter_by(id=connection_id).first()
        if not conn:
            raise ValueError(f"Connection not found: {connection_id}")
        
        # Build connection config based on authenticator type
        config = {
            'user': conn.username,
            'account': conn.account,
            'warehouse': conn.warehouse,
            'database': conn.database,
            'schema': conn.schema,
            'role': conn.role
        }
        
        # Handle different authentication types
        if conn.authenticator == 'RSA':
            # Use RSA key-pair authentication
            if conn.private_key:
                import tempfile
                # Save private key to temporary file
                with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
                    f.write(conn.private_key)
                    config['private_key_file'] = f.name
                # Remove password from config for RSA
                config.pop('password', None)
            else:
                raise ValueError("RSA authentication selected but no private key provided")
        elif conn.authenticator == 'PAT':
            # Use Personal Access Token - Snowflake requires 'oauth' authenticator with 'token' parameter
            config['token'] = conn.password  # PAT stored in password field
            config['authenticator'] = 'oauth'
        elif conn.authenticator == 'oauth':
            # Direct oauth authentication
            config['token'] = conn.password
            config['authenticator'] = 'oauth'
        else:
            # Use username/password
            config['password'] = conn.password
            config['authenticator'] = conn.authenticator or 'snowflake'
        
        return config
    finally:
        db.close()


def list_databases(snowflake_connection) -> Dict[str, Any]:
    """
    List all databases in Snowflake using pre-established connection
    Enhanced version with connection reuse for better performance
    """
    try:
        cursor = snowflake_connection.cursor()
        
        try:
            cursor.execute("SHOW DATABASES")
            databases = []
            for row in cursor.fetchall():
                # Filter out system databases if desired
                db_name = row[1]
                if not db_name.startswith('SNOWFLAKE_'):  # Optional filter
                    databases.append(db_name)
            
            logger.info(f"Listed {len(databases)} databases using existing connection")
            
            return {
                "status": "success",
                "databases": databases,
                "count": len(databases)
            }
            
        finally:
            cursor.close()
            # Don't close connection - it's reused
            
    except Exception as e:
        logger.error(f"Error listing databases: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


def list_schemas(snowflake_connection, database_name: str) -> Dict[str, Any]:
    """
    List schemas in a database using pre-established connection
    Enhanced version with connection reuse for better performance
    """
    try:
        cursor = snowflake_connection.cursor()
        
        try:
            cursor.execute(f"SHOW SCHEMAS IN DATABASE {database_name}")
            schemas = []
            for row in cursor.fetchall():
                schema_name = row[1]
                # Filter out system schemas if desired
                if not schema_name.startswith('INFORMATION_SCHEMA'):
                    schemas.append(schema_name)
                else:
                    # Still include INFORMATION_SCHEMA but put it last
                    schemas.append(schema_name)
            
            logger.info(f"Listed {len(schemas)} schemas in {database_name}")
            
            return {
                "status": "success",
                "schemas": schemas,
                "database": database_name,
                "count": len(schemas)
            }
            
        finally:
            cursor.close()
            # Don't close connection - it's reused
            
    except Exception as e:
        logger.error(f"Error listing schemas in {database_name}: {e}")
        return {
            "status": "error",
            "error": str(e),
            "database": database_name
        }


def list_tables(snowflake_connection, database_name: str, schema_name: str) -> Dict[str, Any]:
    """
    List tables in a schema using pre-established connection
    Enhanced version with connection reuse for better performance
    """
    try:
        cursor = snowflake_connection.cursor()
        
        try:
            # Get tables with additional metadata
            cursor.execute(f"SHOW TABLES IN SCHEMA {database_name}.{schema_name}")
            tables = []
            for row in cursor.fetchall():
                table_info = {
                    'table': row[1],  # Table name
                    'table_type': row[3] if len(row) > 3 else 'BASE TABLE',
                    'rows': row[4] if len(row) > 4 else None,
                    'size_bytes': row[5] if len(row) > 5 else None,
                    'comment': row[6] if len(row) > 6 else None
                }
                tables.append(table_info)
            
            # Sort by table name for consistent ordering
            tables.sort(key=lambda x: x['table'])
            
            logger.info(f"Listed {len(tables)} tables in {database_name}.{schema_name}")
            
            return {
                "status": "success", 
                "tables": tables,
                "database": database_name,
                "schema": schema_name,
                "count": len(tables)
            }
            
        finally:
            cursor.close()
            # Don't close connection - it's reused
            
    except Exception as e:
        logger.error(f"Error listing tables in {database_name}.{schema_name}: {e}")
        return {
            "status": "error",
            "error": str(e),
            "database": database_name,
            "schema": schema_name
        }


def list_stages(snowflake_connection, database_name: str, schema_name: str) -> Dict[str, Any]:
    """
    List stages in a schema using pre-established connection
    """
    try:
        cursor = snowflake_connection.cursor()
        
        try:
            cursor.execute(f"SHOW STAGES IN SCHEMA {database_name}.{schema_name}")
            stages = []
            for row in cursor.fetchall():
                stage_info = {
                    'name': row[1],  # Stage name
                    'database_name': row[2] if len(row) > 2 else database_name,
                    'schema_name': row[3] if len(row) > 3 else schema_name,
                    'type': row[4] if len(row) > 4 else 'INTERNAL',
                    'url': row[5] if len(row) > 5 else None,
                    'comment': row[6] if len(row) > 6 else None
                }
                stages.append(stage_info)
            
            # Sort by stage name for consistent ordering
            stages.sort(key=lambda x: x['name'])
            
            logger.info(f"Listed {len(stages)} stages in {database_name}.{schema_name}")
            
            return {
                "status": "success",
                "stages": stages,
                "database": database_name,
                "schema": schema_name,
                "count": len(stages)
            }
            
        finally:
            cursor.close()
            # Don't close connection - it's reused
            
    except Exception as e:
        logger.error(f"Error listing stages in {database_name}.{schema_name}: {e}")
        return {
            "status": "error",
            "error": str(e),
            "database": database_name,
            "schema": schema_name
        }


def get_table_columns(connection_id: str, database_name: str, schema_name: str, table_name: str) -> Dict[str, Any]:
    """
    Get detailed column information for a table
    Enhanced version with comprehensive metadata
    """
    try:
        config = get_snowflake_connection_config(connection_id)
        conn = snowflake.connector.connect(**config)
        cursor = conn.cursor()
        
        try:
            # Get column details from INFORMATION_SCHEMA
            query = f"""
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                ORDINAL_POSITION,
                CHARACTER_MAXIMUM_LENGTH,
                NUMERIC_PRECISION,
                NUMERIC_SCALE,
                COMMENT
            FROM {database_name}.INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '{schema_name}'
            AND TABLE_NAME = '{table_name}'
            ORDER BY ORDINAL_POSITION
            """
            
            cursor.execute(query)
            columns = []
            for row in cursor.fetchall():
                column_info = {
                    'name': row[0],
                    'type': row[1],
                    'nullable': row[2] == 'YES',
                    'default': row[3],
                    'position': row[4],
                    'max_length': row[5],
                    'precision': row[6],
                    'scale': row[7],
                    'comment': row[8]
                }
                columns.append(column_info)
            
            return {
                "status": "success",
                "columns": columns,
                "table": table_name,
                "schema": schema_name,
                "database": database_name,
                "count": len(columns)
            }
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error getting columns for {database_name}.{schema_name}.{table_name}: {e}")
        return {
            "status": "error",
            "error": str(e),
            "table": table_name,
            "schema": schema_name,
            "database": database_name
        }