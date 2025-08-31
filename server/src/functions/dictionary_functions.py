"""
Enhanced dictionary functions - Copied and improved from DataMind CLI
Generates comprehensive YAML data dictionaries from Snowflake metadata
"""
import yaml
from datetime import datetime
from typing import Dict, List, Any
from loguru import logger
from .metadata_functions import get_snowflake_connection_config, get_table_columns
import snowflake.connector


def generate_data_dictionary(connection_id: str, table_names: List[str], 
                           database_name: str, schema_name: str) -> Dict[str, Any]:
    """
    Generate comprehensive YAML data dictionary from selected tables
    Enhanced version from DataMind with better structure and metadata
    """
    try:
        logger.info(f"Generating dictionary for {len(table_names)} tables in {database_name}.{schema_name}")
        
        # Initialize dictionary structure with enhanced metadata
        dictionary = {
            'version': '2.0',  # Enhanced version
            'metadata': {
                'database': database_name,
                'schema': schema_name,
                'generated_at': datetime.now().isoformat(),
                'generated_by': 'LoanSphere @datamodel Agent',
                'connection_id': connection_id,
                'tables_count': len(table_names),
                'generation_notes': 'Auto-generated YAML data dictionary with comprehensive metadata'
            },
            'tables': {}
        }
        
        successful_tables = 0
        failed_tables = []
        
        # Process each table
        for table_name in table_names:
            try:
                logger.info(f"Processing table: {table_name}")
                
                # Get detailed column information
                columns_result = get_table_columns(connection_id, database_name, schema_name, table_name)
                
                if columns_result["status"] == "success":
                    columns = columns_result["columns"]
                    
                    # Get additional table metadata
                    table_metadata = get_table_metadata(connection_id, database_name, schema_name, table_name)
                    
                    # Build enhanced table dictionary entry
                    table_dict = {
                        'description': table_metadata.get('comment', f"Table {table_name} in {schema_name} schema"),
                        'type': 'table',  # Could be 'table', 'view', etc.
                        'schema': schema_name,
                        'database': database_name,
                        'columns': [],
                        'metadata': {
                            'column_count': len(columns),
                            'row_count': table_metadata.get('rows', 'Unknown'),
                            'size_bytes': table_metadata.get('size_bytes', 'Unknown'),
                            'last_altered': table_metadata.get('last_altered', 'Unknown'),
                            'created': table_metadata.get('created', 'Unknown')
                        },
                        'data_types_summary': {}
                    }
                    
                    # Process columns with enhanced information
                    data_types = {}
                    for col in columns:
                        column_entry = {
                            'name': col['name'],
                            'type': col['type'],
                            'nullable': col['nullable'],
                            'position': col['position']
                        }
                        
                        # Add optional fields if present
                        if col['default']:
                            column_entry['default'] = col['default']
                        if col['comment']:
                            column_entry['description'] = col['comment']
                        if col['max_length']:
                            column_entry['max_length'] = col['max_length']
                        if col['precision']:
                            column_entry['precision'] = col['precision']
                        if col['scale']:
                            column_entry['scale'] = col['scale']
                        
                        table_dict['columns'].append(column_entry)
                        
                        # Track data type usage
                        base_type = col['type'].split('(')[0]  # Remove precision/scale for counting
                        data_types[base_type] = data_types.get(base_type, 0) + 1
                    
                    table_dict['data_types_summary'] = data_types
                    dictionary['tables'][table_name] = table_dict
                    successful_tables += 1
                    
                else:
                    error_msg = columns_result.get("error", "Unknown error")
                    logger.error(f"Failed to get columns for {table_name}: {error_msg}")
                    failed_tables.append({"table": table_name, "error": error_msg})
                    
            except Exception as e:
                logger.error(f"Error processing table {table_name}: {e}")
                failed_tables.append({"table": table_name, "error": str(e)})
        
        # Update metadata with results
        dictionary['metadata']['successful_tables'] = successful_tables
        dictionary['metadata']['failed_tables'] = len(failed_tables)
        if failed_tables:
            dictionary['metadata']['failures'] = failed_tables
        
        # Convert to YAML string with proper formatting
        yaml_content = yaml.dump(
            dictionary, 
            default_flow_style=False, 
            sort_keys=False, 
            indent=2,
            width=120,
            allow_unicode=True
        )
        
        logger.info(f"Successfully generated dictionary for {successful_tables}/{len(table_names)} tables")
        
        return {
            "status": "success",
            "yaml_dictionary": yaml_content,
            "tables_processed": successful_tables,
            "tables_failed": len(failed_tables),
            "total_columns": sum(len(table['columns']) for table in dictionary['tables'].values())
        }
        
    except Exception as e:
        logger.error(f"Error generating data dictionary: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


def get_table_metadata(connection_id: str, database_name: str, schema_name: str, table_name: str) -> Dict[str, Any]:
    """
    Get additional table metadata beyond columns
    Enhanced metadata collection
    """
    try:
        config = get_snowflake_connection_config(connection_id)
        conn = snowflake.connector.connect(**config)
        cursor = conn.cursor()
        
        try:
            # Get table information from SHOW TABLES
            cursor.execute(f"SHOW TABLES LIKE '{table_name}' IN SCHEMA {database_name}.{schema_name}")
            table_info = cursor.fetchone()
            
            metadata = {}
            if table_info:
                metadata = {
                    'name': table_info[1],
                    'database_name': table_info[0],
                    'schema_name': table_info[2],
                    'kind': table_info[3],  # TABLE, VIEW, etc.
                    'rows': table_info[4] if len(table_info) > 4 else None,
                    'size_bytes': table_info[5] if len(table_info) > 5 else None,
                    'comment': table_info[6] if len(table_info) > 6 else None,
                    'created': table_info[8] if len(table_info) > 8 else None,
                    'last_altered': table_info[9] if len(table_info) > 9 else None,
                    'retention_time': table_info[10] if len(table_info) > 10 else None
                }
            
            return metadata
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.warning(f"Could not get table metadata for {table_name}: {e}")
        return {}


def validate_yaml_dictionary(yaml_content: str) -> Dict[str, Any]:
    """
    Validate generated YAML dictionary
    Enhanced validation with detailed feedback
    """
    try:
        # Parse YAML
        data = yaml.safe_load(yaml_content)
        
        # Validation checks
        issues = []
        warnings = []
        
        # Check required structure
        if not isinstance(data, dict):
            issues.append("YAML content is not a dictionary")
            return {"valid": False, "issues": issues}
        
        # Check for required sections
        required_sections = ['version', 'metadata', 'tables']
        for section in required_sections:
            if section not in data:
                issues.append(f"Missing required section: {section}")
        
        # Validate metadata
        if 'metadata' in data:
            metadata = data['metadata']
            required_metadata = ['database', 'schema', 'generated_at', 'tables_count']
            for field in required_metadata:
                if field not in metadata:
                    warnings.append(f"Missing metadata field: {field}")
        
        # Validate tables
        if 'tables' in data:
            tables = data['tables']
            if not isinstance(tables, dict):
                issues.append("Tables section must be a dictionary")
            else:
                for table_name, table_data in tables.items():
                    if 'columns' not in table_data:
                        issues.append(f"Table {table_name} missing columns section")
                    elif not isinstance(table_data['columns'], list):
                        issues.append(f"Table {table_name} columns must be a list")
        
        # Calculate statistics
        stats = {
            "total_tables": len(data.get('tables', {})),
            "total_columns": 0,
            "data_types": set()
        }
        
        if 'tables' in data:
            for table_data in data['tables'].values():
                if 'columns' in table_data:
                    stats['total_columns'] += len(table_data['columns'])
                    for col in table_data['columns']:
                        if 'type' in col:
                            stats['data_types'].add(col['type'].split('(')[0])
        
        stats['data_types'] = list(stats['data_types'])
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
            "statistics": stats
        }
        
    except yaml.YAMLError as e:
        return {
            "valid": False,
            "issues": [f"YAML parsing error: {str(e)}"]
        }
    except Exception as e:
        return {
            "valid": False,
            "issues": [f"Validation error: {str(e)}"]
        }