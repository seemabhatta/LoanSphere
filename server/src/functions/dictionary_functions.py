"""
Dictionary generation functions for YAML data dictionaries
Provides DataMind CLI-compatible interface for LoanSphere
"""
import snowflake.connector
import yaml
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


def generate_data_dictionary(connection_id: str, table_names: List[str], 
                           database_name: str, schema_name: str) -> Dict[str, Any]:
    """Generate YAML data dictionary from selected tables"""
    try:
        config = get_snowflake_connection(connection_id)
        
        # Connect to Snowflake
        conn = snowflake.connector.connect(**config)
        cursor = conn.cursor()
        
        try:
            # Initialize dictionary structure
            dictionary = {
                'version': '1.0',
                'metadata': {
                    'database': database_name,
                    'schema': schema_name,
                    'generated_at': str(cursor.execute("SELECT CURRENT_TIMESTAMP()").fetchone()[0]),
                    'tables_count': len(table_names)
                },
                'tables': {}
            }
            
            # Process each table
            for table_name in table_names:
                logger.info(f"Processing table: {table_name}")
                
                # Get table columns
                cursor.execute(f"""
                    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, ORDINAL_POSITION
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_CATALOG = '{database_name}'
                    AND TABLE_SCHEMA = '{schema_name}'
                    AND TABLE_NAME = '{table_name}'
                    ORDER BY ORDINAL_POSITION
                """)
                
                columns = []
                for row in cursor.fetchall():
                    column = {
                        'name': row[0],
                        'type': row[1],
                        'nullable': row[2] == 'YES',
                        'position': row[4]
                    }
                    if row[3]:  # Default value
                        column['default'] = row[3]
                    columns.append(column)
                
                # Get table comment/description
                cursor.execute(f"""
                    SELECT TABLE_COMMENT 
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_CATALOG = '{database_name}'
                    AND TABLE_SCHEMA = '{schema_name}' 
                    AND TABLE_NAME = '{table_name}'
                """)
                comment_result = cursor.fetchone()
                
                # Build table dictionary entry
                table_dict = {
                    'description': comment_result[0] if comment_result and comment_result[0] else f"Table {table_name}",
                    'columns': columns,
                    'column_count': len(columns)
                }
                
                dictionary['tables'][table_name] = table_dict
            
            # Convert to YAML string
            yaml_content = yaml.dump(dictionary, default_flow_style=False, sort_keys=False, indent=2)
            
            return {
                "status": "success",
                "yaml_dictionary": yaml_content,
                "tables_processed": len(table_names)
            }
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error generating data dictionary: {e}")
        return {
            "status": "error",
            "error": str(e)
        }