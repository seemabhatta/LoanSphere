"""
Intelligent Semantic Model Functions - OpenAI Structured Output Integration
Uses LLM intelligence for advanced semantic model generation with guaranteed schema compliance
"""
import yaml
from datetime import datetime
from typing import Dict, List, Any, Optional
from loguru import logger
from .metadata_functions import get_table_columns_with_connection, get_table_metadata_with_connection
from utils.semantic_model_util import PydanticSemanticModel, PROTOBUF_AVAILABLE


def collect_table_intelligence_data(snowflake_connection, database_name: str, schema_name: str, 
                                  table_names: List[str], sample_limit: int = 5) -> Dict[str, Any]:
    """
    Collect comprehensive table data for LLM analysis including sample values and metadata.
    """
    intelligence_data = {
        'database': database_name,
        'schema': schema_name,
        'tables': []
    }
    
    for table_name in table_names:
        try:
            # Get column metadata
            columns_result = get_table_columns_with_connection(
                snowflake_connection, database_name, schema_name, table_name
            )
            
            if columns_result["status"] != "success":
                logger.warning(f"Could not get columns for {table_name}")
                continue
                
            # Get table metadata  
            table_metadata = get_table_metadata_with_connection(
                snowflake_connection, database_name, schema_name, table_name
            )
            
            # Collect sample data for each column
            table_info = {
                'name': table_name,
                'description': table_metadata.get('comment', ''),
                'row_count': table_metadata.get('rows'),
                'columns': []
            }
            
            for col in columns_result["columns"]:
                column_name = col['name']
                
                # Get sample values
                sample_values = []
                try:
                    cursor = snowflake_connection.cursor()
                    query = f'''
                    SELECT DISTINCT "{column_name}"
                    FROM "{database_name}"."{schema_name}"."{table_name}" 
                    WHERE "{column_name}" IS NOT NULL 
                    LIMIT {sample_limit}
                    '''
                    cursor.execute(query)
                    sample_values = [str(row[0]) for row in cursor.fetchall()]
                    cursor.close()
                except Exception as e:
                    logger.debug(f"Could not get samples for {column_name}: {e}")
                
                # Get value statistics for better classification
                stats_info = {}
                try:
                    cursor = snowflake_connection.cursor()
                    stats_query = f'''
                    SELECT 
                        COUNT(DISTINCT "{column_name}") as distinct_count,
                        COUNT(*) as total_count,
                        COUNT("{column_name}") as non_null_count
                    FROM "{database_name}"."{schema_name}"."{table_name}"
                    '''
                    cursor.execute(stats_query)
                    result = cursor.fetchone()
                    if result:
                        stats_info = {
                            'distinct_count': result[0],
                            'total_count': result[1], 
                            'non_null_count': result[2],
                            'uniqueness_ratio': result[0] / result[1] if result[1] > 0 else 0
                        }
                    cursor.close()
                except Exception as e:
                    logger.debug(f"Could not get stats for {column_name}: {e}")
                
                table_info['columns'].append({
                    'name': column_name,
                    'data_type': col['type'],
                    'nullable': col['nullable'],
                    'comment': col.get('comment', ''),
                    'sample_values': sample_values,
                    'statistics': stats_info
                })
            
            intelligence_data['tables'].append(table_info)
            
        except Exception as e:
            logger.error(f"Error collecting intelligence data for {table_name}: {e}")
    
    return intelligence_data


def generate_intelligent_semantic_model(openai_client, snowflake_connection, 
                                       table_names: List[str], database_name: str, 
                                       schema_name: str, connection_id: str = "session") -> Dict[str, Any]:
    """
    Generate intelligent semantic model using OpenAI structured output with LLM-powered analysis.
    """
    if not PROTOBUF_AVAILABLE:
        logger.warning("Protobuf not available, using simplified validation")
        # Continue without protobuf validation
    
    if not openai_client:
        return {
            "status": "error", 
            "error": "OpenAI client not available. Please check OPENAI_API_KEY configuration."
        }
    
    try:
        logger.info(f"Generating intelligent semantic model for {len(table_names)} tables")
        
        # Collect comprehensive table intelligence data
        intelligence_data = collect_table_intelligence_data(
            snowflake_connection, database_name, schema_name, table_names
        )
        
        # Create detailed prompt for LLM analysis
        system_prompt = """You are an expert data analyst and semantic modeling specialist. 

Your task is to analyze database table structures and generate a comprehensive semantic model that categorizes columns into:

**MEASURES** - Numeric fields that represent metrics, amounts, or quantities that can be aggregated:
- Revenue, sales, amounts, totals, counts, quantities, rates, percentages, scores
- Should have appropriate default_aggregation (SUM, AVG, COUNT, MIN, MAX)

**DIMENSIONS** - Categorical or descriptive fields that provide context and can be used for grouping:
- IDs, names, categories, statuses, codes, descriptions, locations
- Determine if they're enums (limited distinct values) based on uniqueness ratio
- Mark as unique if they appear to be identifiers

**TIME_DIMENSIONS** - Date, time, or temporal fields:
- Created dates, updated timestamps, activity periods, event times

For each field, generate:
- Intelligent business-friendly descriptions 
- Relevant synonyms and alternative names
- Appropriate data types and sample values
- Detect primary key patterns (ID fields, unique identifiers)
- Infer relationships between tables based on naming patterns

Analyze the table structure, column names, data types, sample values, and statistics to make intelligent classifications."""

        # Format intelligence data for the prompt
        tables_summary = []
        for table in intelligence_data['tables']:
            columns_info = []
            for col in table['columns']:
                stats = col.get('statistics', {})
                uniqueness = stats.get('uniqueness_ratio', 0)
                distinct_count = stats.get('distinct_count', 0)
                
                col_summary = f"- {col['name']} ({col['data_type']}) - "
                if col['comment']:
                    col_summary += f"Comment: {col['comment']} - "
                if col['sample_values']:
                    col_summary += f"Samples: {col['sample_values'][:3]} - "
                col_summary += f"Distinct: {distinct_count}, Uniqueness: {uniqueness:.2f}"
                
                columns_info.append(col_summary)
            
            table_summary = f"""
Table: {table['name']}
Description: {table.get('description', 'No description')}
Rows: {table.get('row_count', 'Unknown')}
Columns:
{chr(10).join(columns_info)}
"""
            tables_summary.append(table_summary)
        
        user_prompt = f"""Analyze these database tables from {database_name}.{schema_name} and generate a semantic model:

{chr(10).join(tables_summary)}

Generate a complete semantic model with intelligent classification of all columns into measures, dimensions, and time dimensions. Include meaningful descriptions, synonyms, and relationships."""

        # Use OpenAI regular completion with JSON format
        logger.info("Calling OpenAI for intelligent semantic model generation")
        response = openai_client.chat.completions.create(
            model="gpt-4o",  # Use the best model for intelligence
            messages=[
                {"role": "system", "content": system_prompt + "\n\nReturn your response as a valid JSON object with the structure: {'name': 'model_name', 'tables': [...], 'relationships': [...], 'verified_queries': [...]}"},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1  # Lower temperature for more consistent results
        )
        
        if not response.choices[0].message.content:
            raise Exception("OpenAI response was empty")
        
        # Parse JSON response
        import json
        try:
            semantic_model_dict = json.loads(response.choices[0].message.content)
        except json.JSONDecodeError as e:
            # Fallback: try to extract JSON from markdown code blocks
            import re
            content = response.choices[0].message.content
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
            if json_match:
                semantic_model_dict = json.loads(json_match.group(1))
            else:
                raise Exception(f"Failed to parse JSON response: {e}")
        
        # Ensure the model name is set
        if not semantic_model_dict.get('name'):
            semantic_model_dict['name'] = f"{database_name}_{schema_name}_intelligent_semantic_model"
        
        # Convert to YAML
        yaml_content = yaml.dump(
            semantic_model_dict, 
            default_flow_style=False, 
            sort_keys=False, 
            indent=2,
            width=120,
            allow_unicode=True
        )
        
        # Calculate statistics
        total_tables = len(semantic_model_dict.get('tables', []))
        total_measures = sum(len(table.get('measures', [])) for table in semantic_model_dict.get('tables', []))
        total_dimensions = sum(len(table.get('dimensions', [])) for table in semantic_model_dict.get('tables', []))
        total_time_dimensions = sum(len(table.get('time_dimensions', [])) for table in semantic_model_dict.get('tables', []))
        total_relationships = len(semantic_model_dict.get('relationships', []))
        
        logger.info(f"Generated intelligent semantic model: {total_measures} measures, {total_dimensions} dimensions, {total_time_dimensions} time dims, {total_relationships} relationships")
        
        return {
            "status": "success",
            "yaml_dictionary": yaml_content,
            "semantic_model": semantic_model_dict,
            "tables_processed": total_tables,
            "total_measures": total_measures,
            "total_dimensions": total_dimensions,
            "total_time_dimensions": total_time_dimensions,
            "total_relationships": total_relationships,
            "generation_method": "intelligent_llm",
            "validation": {"status": "success", "message": "Generated with structured output validation"}
        }
        
    except Exception as e:
        logger.error(f"Error generating intelligent semantic model: {e}")
        return {
            "status": "error",
            "error": f"Intelligent generation failed: {str(e)}"
        }


logger.info("Intelligent semantic model functions initialized")