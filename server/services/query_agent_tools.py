"""
Query Agent Tools for LoanSphere
Adapted from agentic_query_cli.py for unified agent framework
"""
import os
import sys
import json
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass, field

# Optional visualization dependencies
try:
    import pandas as pd
    import tempfile
    import webbrowser
    VISUALIZATION_AVAILABLE = True
except ImportError:
    pd = None
    tempfile = None
    webbrowser = None
    VISUALIZATION_AVAILABLE = False
try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

# Import metadata functions (same as datamodel)
try:
    from src.functions.metadata_functions import list_databases, list_schemas, list_tables, list_stages
    from src.functions.stage_functions import list_stage_files
except ImportError:
    logger.warning("Could not import metadata functions - some functionality may be limited")

# OpenAI Agent SDK imports
try:
    from agents import function_tool
    from openai import OpenAI
except ImportError:
    def function_tool(func=None, *args, **kwargs):
        def wrapper(f):
            return f
        return wrapper(func) if callable(func) else wrapper

# Use LoanSphere's connection infrastructure instead of Datamind
try:
    # Import LoanSphere's connection utilities
    import snowflake.connector
    from database import get_db
    from models import SnowflakeConnectionModel
    LOANSPHERE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"LoanSphere connection infrastructure not available: {e}")
    LOANSPHERE_AVAILABLE = False


@dataclass
class QueryAgentContext:
    """Context for query agent operations"""
    connection_id: Optional[str] = None
    database: Optional[str] = None
    schema: Optional[str] = None
    stage: Optional[str] = None
    yaml_file: Optional[str] = None
    yaml_content: Optional[str] = None
    tables: List[Dict[str, Any]] = field(default_factory=list)
    last_query_results: List[Dict[str, Any]] = field(default_factory=list)
    last_query_columns: List[str] = field(default_factory=list)
    last_query_sql: Optional[str] = None


# Global context for current session
_current_context: Optional[QueryAgentContext] = None


def get_current_context() -> QueryAgentContext:
    """Get or create current query context"""
    global _current_context
    if _current_context is None:
        _current_context = QueryAgentContext()
    return _current_context


def set_connection_context(connection_id: str):
    """Set connection context for query operations"""
    global _current_context
    if _current_context is None:
        _current_context = QueryAgentContext()
    _current_context.connection_id = connection_id


def execute_snowflake_query(connection_id: str, query: str):
    """Execute query using shared connection pool"""
    try:
        from .connection_manager import SharedConnectionPool
        return SharedConnectionPool.execute_query_sync(connection_id, query)
    except Exception as e:
        logger.error(f"Error executing Snowflake query with connection {connection_id}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {"status": "error", "error": f"Connection error: {str(e)}"}


# Connection Tools
@function_tool
def connect_to_snowflake(connection_id: str) -> str:
    """Connect to Snowflake using LoanSphere's connection pool"""
    if not LOANSPHERE_AVAILABLE:
        return "❌ LoanSphere connection infrastructure not available"
    
    context = get_current_context()
    context.connection_id = connection_id
    
    try:
        # Use LoanSphere's connection pool - connection should already be validated by unified service
        return f"✅ Connected to Snowflake successfully! Connection ID: {connection_id}"
    except Exception as e:
        return f"❌ Failed to connect to Snowflake: {str(e)}"


@function_tool
def get_current_context_info() -> str:
    """Get current connection and context information"""
    context = get_current_context()
    
    info = []
    info.append(f"Connection ID: {context.connection_id or 'Not connected'}")
    info.append(f"Database: {context.database or 'Not selected'}")
    info.append(f"Schema: {context.schema or 'Not selected'}")
    info.append(f"Stage: {context.stage or 'Not selected'}")
    info.append(f"YAML File: {context.yaml_file or 'Not loaded'}")
    info.append(f"Available Tables: {len(context.tables)}")
    info.append(f"Last Query Results: {len(context.last_query_results)} rows")
    
    return "📋 Current Context:\n" + "\n".join([f"  {item}" for item in info])


# Database Tools
@function_tool
def get_databases() -> str:
    """Get available databases from Snowflake"""
    if not LOANSPHERE_AVAILABLE:
        return "❌ LoanSphere connection infrastructure not available"
    
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    # Use LoanSphere connection to query databases
    result = execute_snowflake_query(context.connection_id, "SHOW DATABASES")
    
    if result["status"] == "error":
        return f"❌ Failed to get databases: {result['error']}"
    
    databases = [row.get("name") for row in result.get("result", [])]
    if not databases:
        return "❌ No databases found"
    
    response = f"📂 Available databases ({len(databases)}):\n"
    for i, db in enumerate(databases, 1):
        response += f"  {i}. {db}\n"
    
    return response


@function_tool
def select_database(database_name: str) -> str:
    """Select a database by name - LLM agent will provide the correct name"""
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    context.database = database_name
    return f"✅ Selected database: {context.database}"


@function_tool
def get_schemas() -> str:
    """Get available schemas from selected database"""
    if not LOANSPHERE_AVAILABLE:
        return "❌ LoanSphere connection infrastructure not available"
    
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    if not context.database:
        return "❌ No database selected. Please select a database first."
    
    # Get actual connection from SharedConnectionPool
    from .connection_manager import SharedConnectionPool
    snowflake_connection = SharedConnectionPool._connections.get(context.connection_id)
    if not snowflake_connection:
        return "❌ Connection not found in pool. Please reconnect."
    
    result = list_schemas(snowflake_connection, context.database)
    
    if result["status"] == "error":
        return f"❌ Failed to get schemas: {result['error']}"
    
    schemas = result.get("schemas", [])
    if not schemas:
        return "❌ No schemas found"
    
    response = f"📁 Available schemas in {context.database} ({len(schemas)}):\n"
    for i, schema in enumerate(schemas, 1):
        response += f"  {i}. {schema}\n"
    
    return response


@function_tool
def select_schema(schema_name: str) -> str:
    """Select a schema by name - LLM agent provides the correct name"""
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    if not context.database:
        return "❌ No database selected. Please select a database first."
    
    context.schema = schema_name
    return f"✅ Selected schema: {context.schema}"


# Stage Tools
@function_tool
def get_stages() -> str:
    """Get available stages from selected database/schema"""
    if not LOANSPHERE_AVAILABLE:
        return "❌ LoanSphere connection infrastructure not available"
    
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    if not context.database or not context.schema:
        return "❌ Database and schema must be selected first."
    
    # Get actual connection from SharedConnectionPool
    from .connection_manager import SharedConnectionPool
    snowflake_connection = SharedConnectionPool._connections.get(context.connection_id)
    if not snowflake_connection:
        return "❌ Connection not found in pool. Please reconnect."
    
    result = list_stages(snowflake_connection, context.database, context.schema)
    
    if result["status"] == "error":
        return f"❌ Failed to get stages: {result['error']}"
    
    stages = result.get("stages", [])
    if not stages:
        return "❌ No stages found"
    
    response = f"🗃️ Available stages ({len(stages)}):\n"
    for i, stage in enumerate(stages, 1):
        response += f"  {i}. {stage}\n"
    
    return response


@function_tool
def select_stage(stage_name: str) -> str:
    """Select a stage by name - LLM agent provides the correct name"""
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    if not context.database or not context.schema:
        return "❌ Database and schema must be selected first."
    
    context.stage = stage_name
    return f"✅ Selected stage: {context.stage}"


@function_tool
def get_yaml_files() -> str:
    """Get available YAML files from selected stage"""
    if not LOANSPHERE_AVAILABLE:
        return "❌ LoanSphere connection infrastructure not available"
    
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    if not context.stage:
        return "❌ No stage selected. Please select a stage first."
    
    # Call list_stage_files with correct parameters
    result = list_stage_files(context.connection_id, context.database, context.schema, context.stage)
    
    if result["status"] == "error":
        return f"❌ Failed to get YAML files: {result['error']}"
    
    files = result.get("files", [])
    # Filter for YAML files
    yaml_files = [f for f in files if f.get("name", "").lower().endswith(('.yaml', '.yml'))]
    
    if not yaml_files:
        return "❌ No YAML files found in selected stage"
    
    response = f"📄 Available YAML files in {context.stage} ({len(yaml_files)}):\n"
    for i, file_info in enumerate(yaml_files, 1):
        filename = file_info.get("name", "Unknown")
        size = file_info.get("size", "Unknown")
        response += f"  {i}. {filename} ({size})\n"
    
    return response


@function_tool
def load_yaml_file(filename: str) -> str:
    """Load a YAML file by filename - LLM agent provides the correct filename"""
    if not LOANSPHERE_AVAILABLE:
        return "❌ LoanSphere connection infrastructure not available"
    
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    if not context.stage:
        return "❌ No stage selected. Please select a stage first."
    
    # Load YAML content from stage using Snowflake connection
    try:
        from .connection_manager import SharedConnectionPool
        import snowflake.connector
        import yaml
        import tempfile
        import os
        
        # Get actual connection from pool
        snowflake_connection = SharedConnectionPool._connections.get(context.connection_id)
        if not snowflake_connection:
            return "❌ Connection not found in pool. Please reconnect."
        
        cursor = snowflake_connection.cursor()
        
        # Download file from stage to temporary location
        with tempfile.TemporaryDirectory() as temp_dir:
            get_sql = f"GET @{context.stage}/{filename} file://{temp_dir}/"
            cursor.execute(get_sql)
            
            # Look for the downloaded file (Snowflake may compress it)
            downloaded_files = os.listdir(temp_dir)
            if not downloaded_files:
                return f"❌ No files downloaded from stage {context.stage}"
            
            # Try to find the YAML file
            yaml_file_path = None
            for file in downloaded_files:
                if filename in file or file.endswith('.yaml') or file.endswith('.yml'):
                    yaml_file_path = os.path.join(temp_dir, file)
                    break
            
            if not yaml_file_path:
                return f"❌ Could not find {filename} in downloaded files: {downloaded_files}"
            
            # Read the YAML content
            with open(yaml_file_path, 'r') as f:
                yaml_content = f.read()
        
        cursor.close()
        
        # Parse YAML
        yaml_data = yaml.safe_load(yaml_content)
        
        # Store in context
        context.yaml_file = filename
        context.yaml_content = yaml_content
        
        # Extract table information from YAML structure
        tables = []
        if isinstance(yaml_data, dict) and "tables" in yaml_data:
            for table in yaml_data["tables"]:
                if isinstance(table, dict) and "base_table" in table:
                    base_table = table["base_table"]
                    tables.append({
                        "name": table.get("name", "Unknown"),
                        "database": base_table.get("database", ""),
                        "schema": base_table.get("schema", ""),
                        "full_name": f"{base_table.get('database', '')}.{base_table.get('schema', '')}.{table.get('name', '')}"
                    })
        
        context.tables = tables
        table_count = len(tables)
        
        return f"✅ Successfully loaded {filename}! Found {table_count} tables: {', '.join([t['name'] for t in tables])}\n🔍 Ready for natural language queries!"
        
    except Exception as e:
        logger.error(f"Error loading YAML file: {e}")
        return f"❌ Failed to load YAML file: {str(e)}"


@function_tool
def get_yaml_content() -> str:
    """Get the current loaded YAML content - LLM will format as needed"""
    context = get_current_context()
    
    if not context.yaml_content:
        return "❌ No YAML file loaded. Please load a YAML file first."
    
    # Return raw content info - let LLM decide how to present it
    return f"📄 YAML file loaded: {context.yaml_file}\n📊 Content available for analysis\n🔗 Use this data dictionary context for SQL generation"


# Query Tools
@function_tool
def generate_sql(query: str, table_name: Optional[str] = None) -> str:
    """Generate SQL from natural language query using OpenAI and YAML schema"""
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    if not context.yaml_content:
        return "❌ No YAML file loaded. Please load a data dictionary first with load_yaml_file()."
    
    # Use first table if not specified
    if not table_name and context.tables:
        table_name = context.tables[0]['name']
    
    if not table_name:
        return "❌ No table specified and no tables available."
    
    try:
        import os
        from openai import OpenAI
        
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Create prompt with YAML schema context
        system_prompt = f"""You are a SQL generation expert. Convert natural language queries to SQL using the provided YAML data dictionary.

YAML Data Dictionary:
{context.yaml_content}

Rules:
1. Generate only valid Snowflake SQL
2. Use the exact table and column names from the YAML
3. Return only the SQL query, no explanations
4. If the query cannot be answered with available data, return "CANNOT_GENERATE"
"""
        
        user_prompt = f"Convert this natural language query to SQL for table '{table_name}': {query}"
        
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=1000
        )
        
        sql = response.choices[0].message.content.strip()
        
        if sql == "CANNOT_GENERATE" or "cannot" in sql.lower():
            return f"❌ Cannot generate SQL for query: {query}. The data dictionary may not contain the required information."
        
        return f"✅ Generated SQL: {sql}"
        
    except Exception as e:
        logger.error(f"Error generating SQL: {e}")
        return f"❌ SQL generation failed: {str(e)}"


@function_tool
def execute_sql(sql: str, table_name: Optional[str] = None) -> str:
    """Execute SQL query and return results"""
    if not LOANSPHERE_AVAILABLE:
        return "❌ LoanSphere connection infrastructure not available"
    
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    # Execute using LoanSphere connection
    result = execute_snowflake_query(context.connection_id, sql)
    
    if result["status"] == "error":
        return f"❌ SQL execution failed: {result['error']}"
    
    # Store all results for analysis and visualization
    context.last_query_results = result.get("result", [])
    context.last_query_columns = result.get("columns", [])
    context.last_query_sql = sql
    
    # Return formatted success info
    row_count = result.get('row_count', 0)
    if row_count > 0:
        # Show first few rows as preview
        preview_rows = min(3, len(context.last_query_results))
        preview = context.last_query_results[:preview_rows]
        
        response = f"✅ Query executed successfully! {row_count} rows returned.\n\n"
        response += f"📊 **Results Preview** (first {preview_rows} rows):\n"
        for i, row in enumerate(preview, 1):
            response += f"  Row {i}: {dict(row)}\n"
        
        if row_count > preview_rows:
            response += f"  ... and {row_count - preview_rows} more rows\n"
        
        response += f"\n💡 Data stored for analysis and visualization. You can ask me to create charts or analyze this data!"
        return response
    else:
        return f"✅ Query executed successfully! No rows returned (this might be expected for DDL/DML operations)."


@function_tool
def generate_query_summary(query: str, sql: str, results: str) -> str:
    """Generate AI summary of query results using OpenAI"""
    context = get_current_context()
    if not context.connection_id:
        return "❌ No connection established. Please connect first."
    
    try:
        import os
        from openai import OpenAI
        
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Use stored results or provided results
        results_data = results or str(context.last_query_results) or "No results available"
        
        system_prompt = """You are a data analyst. Create a clear, concise summary of SQL query results.
        
Focus on:
1. What the query was trying to find
2. Key insights from the results
3. Notable patterns or trends
4. Business implications if relevant

Keep it concise but informative."""
        
        user_prompt = f"""
Original Query: {query}
SQL Used: {sql}
Results: {results_data}

Please provide a summary of these query results."""
        
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        
        summary = response.choices[0].message.content.strip()
        return f"📊 **Query Summary**:\n{summary}"
        
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        return f"❌ Summary generation failed: {str(e)}"


# Visualization Tools
@function_tool
def create_visualization(user_request: str = "create a chart") -> str:
    """Create LLM-powered data visualization based on user request"""
    if not VISUALIZATION_AVAILABLE:
        return """❌ Visualization dependencies not available. 

To enable chart functionality, install the full requirements:
```
pip install -r requirements-full.txt
```

Or install specific packages:
```
pip install pandas plotly
```

Core @query functionality (SQL queries) works without these dependencies."""
    
    context = get_current_context()
    
    if not context.last_query_results:
        return "❌ No query results available for visualization. Please run a query first."
    
    if not LOANSPHERE_AVAILABLE:
        return "❌ LoanSphere connection infrastructure not available - visualization requires LLM integration"
    
    # Pure LLM-driven visualization - no data preprocessing
    return _create_complete_visualization(context.last_query_results, user_request, context.last_query_sql)


@function_tool
def get_visualization_suggestions() -> str:
    """Get LLM-powered visualization suggestions based on current data"""
    if not VISUALIZATION_AVAILABLE:
        return """❌ Visualization dependencies not available. 

To enable chart suggestions, install the full requirements:
```
pip install -r requirements-full.txt
```

Core @query functionality (SQL queries) works without these dependencies."""
    
    context = get_current_context()
    
    if not context.last_query_results:
        return "❌ No query results available. Please run a query first."
    
    if not LOANSPHERE_AVAILABLE:
        return "❌ LoanSphere connection infrastructure not available - suggestions require LLM integration"
    
    # Pure LLM analysis - no data preprocessing
    return _get_llm_suggestions(context.last_query_results, context.last_query_sql)


def _analyze_data_structure(df) -> Dict[str, Any]:
    """Analyze DataFrame structure for LLM input"""
    if not VISUALIZATION_AVAILABLE:
        return {"error": "pandas not available"}
        
    if pd is None:
        return {"error": "pandas not available"}
    
    # Convert sample data to JSON-safe format
    sample_data = []
    for record in df.head(3).to_dict('records'):
        safe_record = {}
        for k, v in record.items():
            if pd.isna(v):
                safe_record[k] = None
            elif isinstance(v, pd.Timestamp):
                safe_record[k] = v.isoformat()
            elif hasattr(v, 'item'):  # numpy types
                safe_record[k] = v.item()
            else:
                safe_record[k] = str(v) if v is not None else None
        sample_data.append(safe_record)
    
    analysis = {
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": [],
        "sample_data": sample_data,
        "data_types": {}
    }
    
    for col in df.columns:
        col_info = {
            "name": col,
            "dtype": str(df[col].dtype),
            "null_count": int(df[col].isnull().sum()),
            "unique_count": int(df[col].nunique())
        }
        
        # Add specific analysis based on data type
        if df[col].dtype in ['int64', 'float64']:
            col_info.update({
                "min": float(df[col].min()) if pd.notna(df[col].min()) else None,
                "max": float(df[col].max()) if pd.notna(df[col].max()) else None,
                "mean": float(df[col].mean()) if pd.notna(df[col].mean()) else None
            })
        elif df[col].dtype == 'object':
            # Convert pandas value counts to JSON-safe format
            top_values = df[col].value_counts().head(5)
            col_info["top_values"] = {str(k): int(v) for k, v in top_values.items()}
        
        analysis["columns"].append(col_info)
        analysis["data_types"][col] = str(df[col].dtype)
    
    return analysis


def _get_llm_visualization_plan(data_summary: Dict, user_request: str, sql_query: Optional[str]) -> Dict:
    """Use LLM to create a visualization plan"""
    
    system_prompt = """You are a data visualization expert. Analyze the provided data structure and user request to create the best possible chart.

Your tasks:
1. Analyze the data structure and understand what story the data tells
2. Recommend the most appropriate chart type based on the data and user request
3. Generate Python code using plotly to create an interactive chart
4. Provide a clear explanation of why this visualization is optimal

IMPORTANT RULES:
- Always use plotly (px or go) for interactive charts
- The DataFrame variable is called 'df' 
- Return valid Python code that can be executed directly
- Include proper error handling
- Make charts visually appealing with titles, labels, and colors
- Consider the data types and relationships when choosing chart types

Return your response as JSON with these keys:
- chart_type: string (e.g., "bar", "line", "scatter", "pie", "histogram", "box")
- chart_code: string (complete Python code to generate the chart)
- explanation: string (why this chart type and configuration is best)
- title: string (descriptive chart title)
"""

    user_prompt = f"""
Data Structure Analysis:
{json.dumps(data_summary, indent=2)}

Original SQL Query: {sql_query or "Not available"}

User Request: {user_request}

Please analyze this data and create the best visualization plan. Consider:
- What insights can be gained from this data?
- What chart type best represents the relationships?
- How can we make the visualization most informative and engaging?

Generate Python plotly code that will create an excellent interactive chart.
"""

    from utils import llm_util
    response = llm_util.call_response_api(llm_util.llm_model, system_prompt, user_prompt)
    result_text = response.choices[0].message.content
    
    # Try to parse JSON response
    try:
        original_text = result_text
        if result_text.startswith("```json"):
            result_text = result_text[7:-3]
        elif result_text.startswith("```"):
            result_text = result_text[3:-3]
        
        viz_plan = json.loads(result_text)
        viz_plan["status"] = "success"
        return viz_plan
        
    except json.JSONDecodeError:
        # If JSON parsing fails, extract code manually
        return {
            "status": "success",
            "chart_type": "auto",
            "chart_code": original_text,
            "explanation": "LLM generated visualization code",
            "title": "Data Visualization"
        }


def _execute_llm_chart_code(df, chart_code: str, explanation: str) -> str:
    """Execute the LLM-generated chart code safely"""
    if not VISUALIZATION_AVAILABLE:
        return "❌ Visualization dependencies not available"
    
    try:
        # Import required libraries for code execution
        import plotly.express as px
        import plotly.graph_objects as go
        import numpy as np
        
        # Create safe execution environment
        safe_globals = {
            'df': df,
            'px': px,
            'go': go,
            'np': np,
            'pd': pd
        }
        
        # Execute the LLM-generated code
        exec(chart_code, safe_globals)
        
        # Look for the figure object
        fig = None
        for var_name in ['fig', 'figure', 'chart']:
            if var_name in safe_globals:
                fig = safe_globals[var_name]
                break
        
        if fig is None:
            # Try to find any plotly figure objects
            for var_name, var_value in safe_globals.items():
                if hasattr(var_value, 'write_html'):
                    fig = var_value
                    break
        
        if fig is None:
            return f"❌ No figure object found in generated code. Available variables: {list(safe_globals.keys())}"
        
        # Save and display the chart
        temp_dir = tempfile.gettempdir()
        chart_path = os.path.join(temp_dir, "loansphere_query_chart.html")
        
        fig.write_html(chart_path)
        
        # Try to open in browser
        success_msg = f"✅ **LLM-Generated Chart Created Successfully!**\n\n"
        success_msg += f"📊 **Explanation**: {explanation}\n\n"
        success_msg += f"📁 **Chart saved to**: {chart_path}\n"
        
        try:
            webbrowser.open(f"file://{chart_path}")
            success_msg += "🌐 **Chart opened in browser**"
        except Exception:
            success_msg += "💡 **Tip**: Open the HTML file in your browser to view the interactive chart"
        
        return success_msg
        
    except Exception as e:
        return f"❌ Error executing LLM chart code: {str(e)}\n\nGenerated code:\n```python\n{chart_code}\n```"


def _create_complete_visualization(query_results: List[Dict], user_request: str, sql_query: Optional[str]) -> str:
    """Create LLM-powered visualization from query results using pandas DataFrame"""
    if not VISUALIZATION_AVAILABLE:
        return "❌ Visualization dependencies not available"
        
    if not query_results:
        return "❌ No data available to visualize."
    
    try:
        # Convert results to DataFrame for analysis
        df = pd.DataFrame(query_results)
        
        if df.empty:
            return "❌ No data available to visualize."
        
        # Get data summary for LLM analysis
        data_summary = _analyze_data_structure(df)
        
        # Use LLM to analyze data and generate visualization plan
        viz_plan = _get_llm_visualization_plan(data_summary, user_request, sql_query)
        
        if viz_plan["status"] == "error":
            return f"❌ Visualization planning failed: {viz_plan['error']}"
        
        # Generate and execute the chart code using LLM
        chart_result = _execute_llm_chart_code(df, viz_plan["chart_code"], viz_plan["explanation"])
        
        return chart_result
        
    except Exception as e:
        return f"❌ Error creating LLM-powered visualization: {str(e)}"


def _get_llm_suggestions(query_results: List[Dict], sql_query: Optional[str]) -> str:
    """LLM-powered visualization suggestions based on pandas DataFrame analysis"""
    if not VISUALIZATION_AVAILABLE:
        return "❌ Visualization dependencies not available"
        
    if not query_results:
        return "❌ No data available for visualization suggestions."
    
    try:
        df = pd.DataFrame(query_results)
        
        if df.empty:
            return "❌ No data available for visualization suggestions."
        
        # Get comprehensive data analysis
        data_summary = _analyze_data_structure(df)
        
        # Use LLM to generate intelligent suggestions
        system_prompt = """You are a data visualization consultant. Analyze the provided data and suggest the best visualization options.

Provide practical, actionable suggestions that consider:
- Data types and relationships
- Data volume and distribution  
- Business insights that can be revealed
- Different chart types for different purposes

Format your response as a helpful guide with specific recommendations and example commands.
"""

        user_prompt = f"""
Data Analysis:
{json.dumps(data_summary, indent=2)}

Original SQL Query: {sql_query or "Not available"}

Please provide intelligent visualization suggestions for this dataset. Include:
1. Overview of the data characteristics
2. Top 3-5 recommended chart types with explanations
3. Specific insights each chart type would reveal
4. Example commands the user can use (like "create a bar chart showing sales by region")

Make the suggestions practical and insightful.
"""

        from utils import llm_util
        response = llm_util.call_response_api(llm_util.llm_model, system_prompt, user_prompt)
        return f"🤖 **LLM Analysis & Suggestions:**\n\n{response.choices[0].message.content}"
        
    except Exception as e:
        return f"❌ Error getting LLM suggestions: {str(e)}"




# Export all tools for agent configuration
QUERY_AGENT_TOOLS = [
    connect_to_snowflake,
    get_current_context_info,
    get_databases,
    select_database,
    get_schemas,
    select_schema,
    get_stages,
    select_stage,
    get_yaml_files,
    load_yaml_file,
    get_yaml_content,
    generate_sql,
    execute_sql,
    generate_query_summary,
    create_visualization,
    get_visualization_suggestions
]