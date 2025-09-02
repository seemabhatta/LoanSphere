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

        # Call OpenAI with streaming and reasoning
        logger.info("🧠 [PROGRESS] Starting OpenAI analysis - this is where the magic happens...")
        logger.info("💭 [PROGRESS] AI is now thinking through your data structure step by step...")
        send_progress('progress', 'Starting OpenAI analysis - this is where the magic happens...', 'Processing')
        send_progress('progress', 'AI is now thinking through your data structure step by step...', 'Processing')
        
        # Use streaming for real-time updates
        import os
        model_name = os.getenv("OPENAI_MODEL", "gpt-5")
        response_stream = openai_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt + "\n\nAfter showing your <thinking> process, return your final response as a valid JSON object. CRITICAL: Ensure the JSON is properly formatted with:\n- All strings in double quotes\n- No trailing commas\n- Properly escaped quotes within strings\n- Valid JSON structure: {'name': 'model_name', 'tables': [...], 'relationships': [...], 'verified_queries': [...]}"},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,  # Lower temperature for more consistent results
            stream=True  # Enable streaming for real-time updates
        )
        
        # Process streaming response and extract reasoning
        full_response = ""
        thinking_content = ""
        in_thinking = False
        
        logger.info("📡 [PROGRESS] Receiving AI response stream...")
        send_progress('progress', 'Receiving AI response stream...', 'Processing')
        
        for chunk in response_stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                full_response += content
                
                # Extract thinking process
                if "<thinking>" in content:
                    in_thinking = True
                    logger.info("🤔 [AI THINKING] AI has started reasoning process...")
                    send_progress('progress', '🤔 AI has started reasoning process...', 'Processing')
                elif "</thinking>" in content:
                    in_thinking = False
                    logger.info("✅ [AI THINKING] AI completed reasoning, generating final model...")
                    send_progress('progress', '✅ AI completed reasoning, generating final model...', 'Processing')
                elif in_thinking:
                    thinking_content += content
                    # Log interesting parts of thinking in real-time
                    if any(keyword in content.lower() for keyword in ["analyzing", "examining", "identifying", "detecting", "creating"]):
                        logger.info(f"💡 [AI THINKING] {content.strip()}")
                        # Send key thinking updates to UI
                        clean_content = content.strip()
                        if clean_content:
                            send_progress('progress', f'💡 AI: {clean_content}', 'Processing')
        
        # Log the complete thinking process
        if thinking_content.strip():
            logger.info("🧠 [AI REASONING] Complete thinking process:")
            for line in thinking_content.strip().split('\n'):
                if line.strip():
                    logger.info(f"  💭 {line.strip()}")
        
        if not full_response.strip():
            raise Exception("OpenAI response was empty")
        
        # Parse AI response
        logger.info("🔍 [PROGRESS] Parsing AI-generated semantic model...")
        send_progress('progress', 'Parsing AI-generated semantic model...', 'Parsing')
        
        # Parse JSON response (extract JSON from the full response)
        import json
        import re
        
        try:
            # Remove thinking tags first if present
            json_content = full_response
            if '</thinking>' in json_content:
                # Extract everything after the closing thinking tag
                json_content = json_content.split('</thinking>', 1)[-1].strip()
            
            # Try multiple JSON extraction strategies
            semantic_model_dict = None
            
            # Strategy 1: Look for JSON code blocks
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', json_content, re.DOTALL)
            if json_match:
                try:
                    semantic_model_dict = json.loads(json_match.group(1))
                    logger.info("✅ Successfully parsed JSON from code block")
                except json.JSONDecodeError:
                    pass
            
            # Strategy 2: Find first complete JSON object
            if not semantic_model_dict:
                json_match = re.search(r'\{[^{]*?\}', json_content, re.DOTALL)
                if json_match:
                    try:
                        semantic_model_dict = json.loads(json_match.group(0))
                        logger.info("✅ Successfully parsed JSON from first object match")
                    except json.JSONDecodeError:
                        pass
                        
            # Strategy 3: Find largest JSON object (handles nested objects)
            if not semantic_model_dict:
                # Find all potential JSON objects by counting braces
                start_pos = 0
                while start_pos < len(json_content):
                    brace_start = json_content.find('{', start_pos)
                    if brace_start == -1:
                        break
                        
                    brace_count = 0
                    brace_end = brace_start
                    
                    for i in range(brace_start, len(json_content)):
                        if json_content[i] == '{':
                            brace_count += 1
                        elif json_content[i] == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                brace_end = i
                                break
                    
                    if brace_count == 0:  # Found complete JSON object
                        candidate = json_content[brace_start:brace_end + 1]
                        try:
                            semantic_model_dict = json.loads(candidate)
                            logger.info("✅ Successfully parsed JSON from brace matching")
                            break
                        except json.JSONDecodeError:
                            pass
                    
                    start_pos = brace_start + 1
            
            # Strategy 4: Try to clean and fix common JSON issues
            if not semantic_model_dict:
                logger.warning("🔧 Attempting to fix common JSON formatting issues...")
                
                # Find the most likely JSON candidate
                json_match = re.search(r'\{.*\}', json_content, re.DOTALL)
                if json_match:
                    candidate = json_match.group(0)
                    
                    # Common fixes
                    # Fix trailing commas
                    candidate = re.sub(r',(\s*[}\]])', r'\1', candidate)
                    # Fix unescaped quotes in strings (basic attempt)
                    candidate = re.sub(r'("description":\s*")([^"]*)"([^",}]*)"([^"]*")', r'\1\2\"\3\"\4', candidate)
                    
                    try:
                        semantic_model_dict = json.loads(candidate)
                        logger.info("✅ Successfully parsed JSON after cleanup")
                    except json.JSONDecodeError:
                        pass
            
            if not semantic_model_dict:
                # Log more details for debugging
                logger.error(f"📄 [DEBUG] Content after </thinking>: {json_content[:1000]}...")
                raise json.JSONDecodeError("No valid JSON found in response after all strategies", json_content, 0)
                    
        except json.JSONDecodeError as e:
            logger.error(f"❌ [ERROR] Failed to parse AI response as JSON: {e}")
            logger.error(f"📄 [ERROR] Response content: {full_response[:500]}...")
            raise Exception(f"Failed to parse AI response: {str(e)}")
        
        # Finalize semantic model
        logger.info("🎯 [PROGRESS] Finalizing semantic model structure...")
        send_progress('progress', 'Finalizing semantic model structure...', 'Finalizing')
        
        # Ensure the model name is set
        if not semantic_model_dict.get('name'):
            semantic_model_dict['name'] = f"{database_name}_{schema_name}_intelligent_semantic_model"
        
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
