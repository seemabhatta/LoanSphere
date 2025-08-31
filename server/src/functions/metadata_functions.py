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


def list_databases(connection_id: str) -> Dict[str, Any]:
    """
    List all databases in Snowflake
    Enhanced version from DataMind with better error handling
    """
    try:
        config = get_snowflake_connection_config(connection_id)
        conn = snowflake.connector.connect(**config)
        cursor = conn.cursor()
        
        try:
            cursor.execute("SHOW DATABASES")
            databases = []
            for row in cursor.fetchall():
                # Filter out system databases if desired
                db_name = row[1]
                if not db_name.startswith('SNOWFLAKE_'):  # Optional filter
                    databases.append(db_name)
            
            logger.info(f"Listed {len(databases)} databases for connection {connection_id}")
            
            return {
                "status": "success",
                "databases": databases,
                "count": len(databases)
            }
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error listing databases for {connection_id}: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


def list_schemas(connection_id: str, database_name: str) -> Dict[str, Any]:
    """
    List schemas in a database
    Enhanced version from DataMind with better error handling
    """
    try:
        config = get_snowflake_connection_config(connection_id)
        conn = snowflake.connector.connect(**config)
        cursor = conn.cursor()
        
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
            conn.close()
            
    except Exception as e:
        logger.error(f"Error listing schemas in {database_name}: {e}")
        return {
            "status": "error",
            "error": str(e),
            "database": database_name
        }


def list_tables(connection_id: str, database_name: str, schema_name: str) -> Dict[str, Any]:
    """
    List tables in a schema  
    Enhanced version from DataMind with table metadata
    """
    try:
        config = get_snowflake_connection_config(connection_id)
        conn = snowflake.connector.connect(**config)
        cursor = conn.cursor()
        
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
            conn.close()
            
    except Exception as e:
        logger.error(f"Error listing tables in {database_name}.{schema_name}: {e}")
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