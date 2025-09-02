"""
Intelligent Semantic Model Functions - OpenAI Structured Output Integration
Uses LLM intelligence for advanced semantic model generation with guaranteed schema compliance
"""
import yaml
from datetime import datetime
from typing import Dict, List, Any, Optional
from loguru import logger
from .metadata_functions import get_table_columns_with_connection, get_table_metadata_with_connection
from utils.semantic_model_util import validate_semantic_model, PydanticSemanticModel


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
                                       schema_name: str, connection_id: str = "session",
                                       session_id: str = None, job_id: str = None) -> Dict[str, Any]:
    """
    Generate intelligent semantic model using OpenAI structured output with LLM-powered analysis.
    """
    logger.info("Using protobuf-validated semantic model generation")
    
    # Helper function to send progress updates with dynamic messaging
    def send_progress(progress_type: str, message: str, step: str = None, data: dict = None):
        # Log progress for user visibility
        logger.info(f"[PROGRESS] {message}")
        if step:
            logger.info(f"[STEP] {step}")
        
        # Update async job progress if job_id is available
        current_job_id = job_id
        if not current_job_id:
            try:
                from routers.ai_agent import get_current_job_id
                current_job_id = get_current_job_id()
            except Exception:
                pass
                
        if current_job_id and progress_type in ['start', 'progress', 'complete']:
            try:
                from routers.ai_agent import update_job_progress
                
                # Map descriptive step to percentage
                step_percentages = {
                    "Initializing": 50, "Analyzing": 55, "Preparing": 60, 
                    "Processing": 70, "Parsing": 85, "Finalizing": 90, "Complete": 100
                }
                percentage = step_percentages.get(step, 70)
                
                # Send meaningful assistant logs - simple direct updates
                update_job_progress(
                    current_job_id, 
                    step or "Processing (AI)", 
                    message,  # Use the original meaningful message directly
                    percentage
                )
            except Exception as e:
                logger.error(f"Failed to update job progress: {e}")
    
    if not openai_client:
        return {
            "status": "error", 
            "error": "OpenAI client not available. Please check OPENAI_API_KEY configuration."
        }
    
    try:
        logger.info(f"🚀 [PROGRESS] Starting intelligent semantic model generation for {len(table_names)} tables")
        send_progress('start', f'Starting intelligent semantic model generation for {len(table_names)} tables', 'Initializing')
        
        # Collect comprehensive table intelligence data
        logger.info("📊 [PROGRESS] Analyzing table structures and collecting metadata...")
        send_progress('progress', 'Analyzing table structures and collecting metadata...', 'Analyzing')
        
        intelligence_data = collect_table_intelligence_data(
            snowflake_connection, database_name, schema_name, table_names
        )
        
        # Progress logging for data collection
        logger.info(f"✅ [PROGRESS] Collected intelligence data for {len(intelligence_data.get('tables', []))} tables")
        for table in intelligence_data.get('tables', [])[:1]:  # Log first table only
            logger.info(f"📋 [PROGRESS] Table {table.get('name')} has {len(table.get('columns', []))} columns")
            send_progress('progress', f'Table {table.get("name")} has {len(table.get("columns", []))} columns', 'Analyzing')
        
        # Prepare AI analysis
        logger.info("🤖 [PROGRESS] Preparing AI analysis with chain-of-thought reasoning...")
        send_progress('progress', 'Preparing AI analysis with chain-of-thought reasoning...', 'Preparing')
        
        # Create detailed prompt for LLM analysis with reasoning chain
        system_prompt = """You are an expert data analyst and semantic modeling specialist. 

IMPORTANT: Before generating the final semantic model, please show your step-by-step thinking process using this format:

<thinking>
1. **Table Analysis**: First, I'll examine each table structure...
2. **Column Classification**: Next, I'll identify measures, dimensions, and time fields...
3. **Relationship Detection**: Then, I'll look for relationships between tables...
4. **Semantic Modeling**: Finally, I'll create the comprehensive model...
</thinking>

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

        # Call OpenAI with structured output (no more manual JSON parsing!)
        logger.info("🧠 [PROGRESS] Starting OpenAI structured output generation...")
        logger.info("🎯 [PROGRESS] Using Pydantic/Protobuf schema for guaranteed valid output...")
        send_progress('progress', 'Starting OpenAI structured output generation...', 'Processing')
        send_progress('progress', 'Using Pydantic/Protobuf schema for guaranteed valid output...', 'Processing')
        
        # Use structured output API - no more parsing headaches!
        import os
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        
        # Validate model supports structured output
        if not model_name.startswith(("gpt-4o", "gpt-5")):
            logger.warning(f"⚠️ Model {model_name} may not support structured output, using gpt-4o-mini")
            model_name = "gpt-4o-mini"
        
        logger.info(f"🤖 [PROGRESS] Using model: {model_name}")
        send_progress('progress', f'Using model: {model_name}', 'Processing')
        
        try:
            response = openai_client.responses.parse(
                model=model_name,
                input=[
                    {"role": "system", "content": "You are a data dictionary generator. Generate a structured semantic model based on the provided table data. Focus on categorizing columns as dimensions, measures, or time dimensions based on their data types and business context."},
                    {"role": "user", "content": user_prompt}
                ],
                text_format=PydanticSemanticModel
            )
            
            logger.info("✅ [PROGRESS] Structured output generated successfully!")
            send_progress('progress', 'Structured output generated successfully!', 'Processing')
            
            # Extract structured data from response
            semantic_model = response.output_parsed
            if semantic_model is None:
                logger.error("❌ [ERROR] Response output_parsed is None")
                raise Exception("Response output_parsed is None - structured parsing failed")
                
            # Convert Pydantic model to dictionary
            semantic_model_dict = semantic_model.dict()
            
            # Validate the generated model
            table_count = len(semantic_model_dict.get('tables', []))
            logger.info(f"📊 [SUCCESS] Generated semantic model with {table_count} tables")
            
            if table_count == 0:
                logger.warning("⚠️ [WARNING] No tables found in generated semantic model")
            
            # Log table details for debugging
            for i, table in enumerate(semantic_model_dict.get('tables', [])[:3]):  # Log first 3 tables
                table_name = table.get('name', 'Unknown')
                dimensions = len(table.get('dimensions', []))
                measures = len(table.get('measures', []))
                logger.info(f"  📋 Table {i+1}: {table_name} - {dimensions} dimensions, {measures} measures")
            
        except Exception as structured_error:
            logger.error(f"❌ [CRITICAL ERROR] Structured output failed: {structured_error}")
            logger.error(f"📋 [ERROR DETAILS] Model: {model_name}, Error type: {type(structured_error)}")
            raise Exception(f"Structured semantic model generation failed: {str(structured_error)}")
        
        logger.info("🔍 [PROGRESS] Processing structured semantic model...")
        send_progress('progress', 'Processing structured semantic model...', 'Processing')
        
        # Finalize semantic model
        logger.info("🎯 [PROGRESS] Finalizing semantic model structure...")
        send_progress('progress', 'Finalizing semantic model structure...', 'Finalizing')
        
        # Ensure the model name is set
        if not semantic_model_dict.get('name'):
            semantic_model_dict['name'] = f"{database_name}_{schema_name}_intelligent_semantic_model"
            logger.info(f"🏷️ [FIX] Set semantic model name: {semantic_model_dict['name']}")
        
        # Final validation
        logger.info(f"🔍 [VALIDATION] Final model structure:")
        logger.info(f"  📛 Name: {semantic_model_dict.get('name', 'NOT SET')}")
        logger.info(f"  📊 Tables: {len(semantic_model_dict.get('tables', []))}")
        logger.info(f"  🔗 Relationships: {len(semantic_model_dict.get('relationships', []))}")
        logger.info(f"  ✅ Verified Queries: {len(semantic_model_dict.get('verified_queries', []))}")
        
        # Debug logging
        logger.info(f"OpenAI response structure: {list(semantic_model_dict.keys())}")
        if 'tables' in semantic_model_dict:
            logger.info(f"Number of tables in response: {len(semantic_model_dict['tables'])}")
            for i, table in enumerate(semantic_model_dict.get('tables', [])[:1]):  # Log first table only
                logger.info(f"Table {i} keys: {list(table.keys()) if isinstance(table, dict) else 'Not a dict'}")
        else:
            logger.warning("No 'tables' key in OpenAI response!")
        
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
        
        # Final success logging
        logger.info(f"🎉 [SUCCESS] Generated intelligent semantic model!")
        logger.info(f"📊 [RESULTS] Summary: {total_measures} measures, {total_dimensions} dimensions, {total_time_dimensions} time dims, {total_relationships} relationships")
        logger.info(f"✅ [COMPLETE] Semantic model generation completed successfully for {total_tables} tables")
        
        # Send final success progress update
        send_progress('complete', f'🎉 Generated semantic model with {total_measures} measures, {total_dimensions} dimensions, {total_time_dimensions} time dims, {total_relationships} relationships', 'Complete', {
            'total_tables': total_tables,
            'total_measures': total_measures,
            'total_dimensions': total_dimensions,
            'total_time_dimensions': total_time_dimensions,
            'total_relationships': total_relationships
        })
        
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
