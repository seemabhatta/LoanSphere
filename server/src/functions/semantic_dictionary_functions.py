"""
Semantic Dictionary Functions - Enhanced DataMind-style dictionary generation
Generates rich semantic models with measures, dimensions, and relationships
"""
import yaml
from datetime import datetime
from typing import Dict, List, Any, Optional
from loguru import logger
from .metadata_functions import get_table_columns_with_connection, get_table_metadata_with_connection
from utils.semantic_model_util import (
    classify_column_by_name_and_type, 
    detect_primary_key_columns,
    generate_column_synonyms,
    infer_default_aggregation,
    validate_semantic_model
)


def collect_sample_values(snowflake_connection, database_name: str, schema_name: str, 
                         table_name: str, column_name: str, limit: int = 5) -> List[str]:
    """
    Collect sample values from a specific column for semantic enrichment.
    """
    try:
        cursor = snowflake_connection.cursor()
        
        # Get distinct sample values, excluding nulls
        query = f"""
        SELECT DISTINCT "{column_name}"
        FROM "{database_name}"."{schema_name}"."{table_name}" 
        WHERE "{column_name}" IS NOT NULL 
        LIMIT {limit}
        """
        
        cursor.execute(query)
        samples = [str(row[0]) for row in cursor.fetchall()]
        cursor.close()
        
        return samples
        
    except Exception as e:
        logger.warning(f"Could not collect samples for {table_name}.{column_name}: {e}")
        return []


def detect_enum_columns(snowflake_connection, database_name: str, schema_name: str, 
                       table_name: str, column_name: str, threshold: int = 20) -> bool:
    """
    Detect if a column contains enumerated values (limited set of distinct values).
    """
    try:
        cursor = snowflake_connection.cursor()
        
        # Count distinct values
        query = f"""
        SELECT COUNT(DISTINCT "{column_name}") as distinct_count,
               COUNT(*) as total_count
        FROM "{database_name}"."{schema_name}"."{table_name}" 
        WHERE "{column_name}" IS NOT NULL
        """
        
        cursor.execute(query)
        result = cursor.fetchone()
        cursor.close()
        
        if result:
            distinct_count, total_count = result
            # If distinct values are less than threshold and less than 50% of total
            return distinct_count <= threshold and distinct_count < total_count * 0.5
            
    except Exception as e:
        logger.warning(f"Could not check enum for {table_name}.{column_name}: {e}")
    
    return False


def generate_semantic_model_dictionary(snowflake_connection, table_names: List[str], 
                                     database_name: str, schema_name: str, 
                                     connection_id: str = "session") -> Dict[str, Any]:
    """
    Generate DataMind-style semantic model dictionary with measures, dimensions, and relationships.
    """
    try:
        logger.info(f"Generating semantic model for {len(table_names)} tables in {database_name}.{schema_name}")
        
        # Initialize semantic model structure
        semantic_model = {
            'name': f"{database_name}_{schema_name}_semantic_model",
            'tables': [],
            'relationships': [],  # Will be populated in future phases
            'verified_queries': []  # Will be populated in future phases
        }
        
        successful_tables = 0
        failed_tables = []
        
        # Process each table
        for table_name in table_names:
            try:
                logger.info(f"Processing table: {table_name}")
                
                # Get detailed column information
                columns_result = get_table_columns_with_connection(
                    snowflake_connection, database_name, schema_name, table_name
                )
                
                if columns_result["status"] == "success":
                    columns = columns_result["columns"]
                    
                    # Get table metadata
                    table_metadata = get_table_metadata_with_connection(
                        snowflake_connection, database_name, schema_name, table_name
                    )
                    
                    # Detect primary key
                    primary_key_columns = detect_primary_key_columns(columns, table_name)
                    
                    # Build semantic table structure
                    table_dict = {
                        'name': table_name,
                        'description': table_metadata.get('comment', f"Semantic model for {table_name} table"),
                        'base_table': {
                            'database': database_name,
                            'schema': schema_name,
                            'table': table_name
                        },
                        'primary_key': {
                            'columns': primary_key_columns
                        } if primary_key_columns else None,
                        'time_dimensions': [],
                        'measures': [],
                        'dimensions': []
                    }
                    
                    # Classify and process each column
                    for col in columns:
                        column_name = col['name']
                        column_type = col['type']
                        
                        # Collect sample values (limit to avoid performance issues)
                        sample_values = collect_sample_values(
                            snowflake_connection, database_name, schema_name, 
                            table_name, column_name, limit=3
                        )
                        
                        # Generate synonyms
                        synonyms = generate_column_synonyms(column_name)
                        
                        # Classify column type
                        column_classification = classify_column_by_name_and_type(
                            column_name, column_type, sample_values
                        )
                        
                        # Base column properties
                        base_props = {
                            'name': column_name,
                            'expr': f'"{column_name}"',  # Simple column reference
                            'description': col.get('comment') or f"{column_name.replace('_', ' ').title()} field",
                            'dataType': column_type,
                            'sampleValues': sample_values,
                            'synonyms': synonyms
                        }
                        
                        # Add to appropriate category
                        if column_classification == 'time_dimension':
                            time_dim = {
                                **base_props,
                                'unique': False  # Could be enhanced with actual uniqueness check
                            }
                            table_dict['time_dimensions'].append(time_dim)
                            
                        elif column_classification == 'measure':
                            measure = {
                                **base_props,
                                'default_aggregation': infer_default_aggregation(column_name, column_type)
                            }
                            table_dict['measures'].append(measure)
                            
                        else:  # dimension
                            # Check if it's an enum
                            is_enum = detect_enum_columns(
                                snowflake_connection, database_name, schema_name, 
                                table_name, column_name
                            )
                            
                            dimension = {
                                **base_props,
                                'unique': column_name.lower().endswith('_id') or 'id' in column_name.lower(),
                                'isEnum': is_enum,
                                'cortexSearchService': '',  # Could be enhanced
                                'cortexSearchServiceName': ''  # Could be enhanced
                            }
                            table_dict['dimensions'].append(dimension)
                    
                    # Remove primary_key if empty
                    if not table_dict['primary_key'] or not table_dict['primary_key']['columns']:
                        table_dict.pop('primary_key', None)
                    
                    semantic_model['tables'].append(table_dict)
                    successful_tables += 1
                    
                else:
                    error_msg = columns_result.get("error", "Unknown error")
                    logger.error(f"Failed to get columns for {table_name}: {error_msg}")
                    failed_tables.append({"table": table_name, "error": error_msg})
                    
            except Exception as e:
                logger.error(f"Error processing table {table_name}: {e}")
                failed_tables.append({"table": table_name, "error": str(e)})
        
        # Convert to YAML string with proper formatting
        yaml_content = yaml.dump(
            semantic_model, 
            default_flow_style=False, 
            sort_keys=False, 
            indent=2,
            width=120,
            allow_unicode=True
        )
        
        # Validate against schema (if protobuf available)
        validation_result = validate_semantic_model(yaml_content)
        
        logger.info(f"Successfully generated semantic model for {successful_tables}/{len(table_names)} tables")
        if validation_result['status'] == 'success':
            logger.info("Semantic model validation passed")
        else:
            logger.warning(f"Semantic model validation warning: {validation_result['message']}")
        
        return {
            "status": "success",
            "yaml_dictionary": yaml_content,
            "semantic_model": semantic_model,
            "tables_processed": successful_tables,
            "tables_failed": len(failed_tables),
            "validation": validation_result,
            "total_measures": sum(len(table.get('measures', [])) for table in semantic_model['tables']),
            "total_dimensions": sum(len(table.get('dimensions', [])) for table in semantic_model['tables']),
            "total_time_dimensions": sum(len(table.get('time_dimensions', [])) for table in semantic_model['tables'])
        }
        
    except Exception as e:
        logger.error(f"Error generating semantic model dictionary: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


def generate_basic_relationships(semantic_model: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Generate basic relationships by analyzing column names across tables.
    This is a simple heuristic-based approach.
    """
    relationships = []
    tables = semantic_model.get('tables', [])
    
    for i, left_table in enumerate(tables):
        for j, right_table in enumerate(tables):
            if i >= j:  # Avoid duplicates and self-references
                continue
                
            left_name = left_table['name']
            right_name = right_table['name']
            
            # Look for foreign key relationships
            left_dims = [dim['name'] for dim in left_table.get('dimensions', [])]
            right_dims = [dim['name'] for dim in right_table.get('dimensions', [])]
            
            # Check if left table has a column that references right table
            for left_col in left_dims:
                if left_col.lower().endswith(f"{right_name.lower()}_id"):
                    relationships.append({
                        'name': f"{left_name}_to_{right_name}",
                        'left_table': left_name,
                        'right_table': right_name,
                        'relationship_columns': [
                            {
                                'left_column': left_col,
                                'right_column': 'id'  # Assuming 'id' is primary key
                            }
                        ],
                        'join_type': 'LEFT',
                        'relationship_type': 'MANY_TO_ONE'
                    })
    
    return relationships


logger.info("Semantic dictionary functions initialized")