"""
@datamodel Agent Service for LoanSphere
Ports DataMind CLI agent functionality to service class with OpenAI Agent SDK
"""
import os
import sys
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from loguru import logger

# DataMind functionality now copied and improved locally

# OpenAI Agent SDK imports
AGENTS_AVAILABLE = True
try:
    from agents import Agent, Runner, function_tool
    from agents.memory.session import SQLiteSession
except Exception as _e:
    AGENTS_AVAILABLE = False
    # Define no-op decorator so module import doesn't fail
    def function_tool(func=None, *args, **kwargs):
        def wrapper(f):
            return f
        return wrapper(func) if callable(func) else wrapper

from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models import SnowflakeConnectionModel


@dataclass
class AgentContext:
    """Stores agent context and state - matches DataMind structure exactly"""
    connection_id: Optional[str] = None
    current_database: Optional[str] = None
    current_schema: Optional[str] = None
    current_stage: Optional[str] = None
    selected_tables: List[str] = field(default_factory=list)
    dictionary_content: Optional[str] = None
    available_tables: List[Dict] = field(default_factory=list)  # Store tables for selection
    # Cache for expensive operations
    databases_cache: Optional[Dict] = None
    schemas_cache: Optional[Dict] = None
    
    def __post_init__(self):
        """Ensure lists are always initialized"""
        if self.selected_tables is None:
            self.selected_tables = []
        if self.available_tables is None:
            self.available_tables = []


class DataModelAgentSession:
    """Session management for @datamodel agent with pre-emptive connection"""
    
    def __init__(self, session_id: str, connection_id: str):
        self.session_id = session_id
        self.connection_id = connection_id
        self.agent_context = AgentContext(connection_id=connection_id)
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.sqlite_session = None
        self._snowflake_connection = None
        self._connection_config = None
        
        # Create SQLite session for OpenAI Agent SDK if available
        if AGENTS_AVAILABLE:
            try:
                self.sqlite_session = SQLiteSession(f"datamodel_session_{session_id}")
            except Exception as e:
                logger.warning(f"Failed to create SQLite session: {e}")
                self.sqlite_session = None
        else:
            self.sqlite_session = None
        
        # Connection will be established lazily on first use for better performance
        self._snowflake_connection = None
        self._connection_config = None
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.now()
    
    def is_expired(self, timeout_minutes: int = 60) -> bool:
        """Check if session is expired"""
        return (datetime.now() - self.last_activity).total_seconds() > (timeout_minutes * 60)
    
    
    def get_snowflake_connection(self):
        """Get or create a reusable Snowflake connection"""
        if self._snowflake_connection is None:
            # Load connection config once
            if self._connection_config is None:
                try:
                    db = SessionLocal()
                    try:
                        conn = db.query(SnowflakeConnectionModel).filter_by(
                            id=self.connection_id
                        ).first()
                        if not conn:
                            raise ValueError(f"Connection not found: {self.connection_id}")
                        
                        # Build connection config based on authenticator type
                        config = {
                            'user': conn.username,
                            'account': conn.account,
                            'warehouse': conn.warehouse,
                            'database': conn.database,
                            'schema': conn.schema,
                            'role': conn.role,
                            'connection_timeout': 10,  # Shorter timeout
                            'network_timeout': 15      # Shorter network timeout
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
                                # Remove password and user from config for RSA
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
                        
                        self._connection_config = config
                    finally:
                        db.close()
                except Exception as e:
                    logger.error(f"Failed to load connection config: {e}")
                    return None
            
            # Create connection once and reuse
            try:
                import snowflake.connector
                self._snowflake_connection = snowflake.connector.connect(**self._connection_config)
                logger.info(f"✅ Created Snowflake connection for session {self.session_id}")
            except Exception as e:
                logger.error(f"❌ Failed to create Snowflake connection: {e}")
                return None
        
        return self._snowflake_connection
    
    def close_snowflake_connection(self):
        """Close the Snowflake connection when session ends"""
        if self._snowflake_connection:
            try:
                self._snowflake_connection.close()
                logger.info(f"Closed Snowflake connection for session {self.session_id}")
            except Exception as e:
                logger.warning(f"Error closing Snowflake connection: {e}")
            finally:
                self._snowflake_connection = None


class DataModelAgent:
    """@datamodel Agent Service - OpenAI Agent SDK integration"""
    
    def __init__(self):
        self.sessions: Dict[str, DataModelAgentSession] = {}
        self.agent = None
        self.openai_client = None
        
        if AGENTS_AVAILABLE:
            self._init_agent()
            self._init_openai_client()
        else:
            logger.warning("OpenAI Agent SDK not available - using fallback mode")
    
    def _init_agent(self):
        """Initialize OpenAI Agent with DataMind tools and instructions"""
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("OPENAI_API_KEY not found - agent will be limited")
                return
            
            model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            logger.info(f"Initializing @datamodel Agent with model: {model_name}")
            
            self.agent = Agent(
                name="DataModelAgent",
                model=model_name,
                instructions=self._get_agent_instructions(),
                tools=self._get_function_tools()
            )
            
        except Exception as e:
            logger.error(f"Failed to initialize @datamodel agent: {e}")
            self.agent = None
    
    def _init_openai_client(self):
        """Initialize OpenAI client for structured output generation"""
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("OPENAI_API_KEY not found - structured generation will be limited")
                return
            
            from openai import OpenAI
            self.openai_client = OpenAI(api_key=api_key)
            logger.info("OpenAI client initialized for structured semantic model generation")
            
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            self.openai_client = None
    
    def _get_agent_instructions(self) -> str:
        """Get agent instructions - complete copy from DataMind CLI"""
        return """
You are a Snowflake Data Dictionary Generator Assistant that helps users create YAML data dictionaries from their Snowflake tables.

Your capabilities:
1. Connect to Snowflake databases
2. Browse database structures (databases, schemas, tables, stages)
3. Select tables for dictionary generation
4. Generate AI-powered intelligent semantic models with LLM analysis
5. Save dictionaries to local files
6. Upload dictionaries to Snowflake stages

IMPORTANT BEHAVIORAL GUIDELINES:
- Be conversational and flexible - users can express their intent in ANY way
- When you show a list of tables, users might say: "HMDA_SAMPLE", "the second one", "2", "table 2", "select HMDA", "generate dictionary for HMDA_SAMPLE", etc.
- ALWAYS interpret user intent intelligently based on context
- If user mentions a table name that exists, select it immediately
- If user says "generate" or "create" after seeing tables, proceed with generation
- Don't be rigid about format - be helpful and smart about what users mean
- Take action immediately when intent is clear

CRITICAL CONTEXTUAL RESPONSE RULES - FOLLOW THESE EXACTLY:
1. When you show a list of TABLES and user responds with a number, ONLY call select_tables()
2. When you show a list of DATABASES and user responds with a number, ONLY call select_database()
3. When you show a list of SCHEMAS and user responds with a number, ONLY call select_schema()
4. NEVER EVER call select_database() after showing tables
5. NEVER EVER call select_schema() after showing tables
6. NEVER EVER call get_tables() after showing tables
7. If user says "2" after you show tables, call select_tables("2") - DO NOT call anything else

CONTEXTUAL RESPONSE EXAMPLES:
Example 1:
Assistant: "I found 2 databases: 1. CORTES_DEMO_2  2. SNOWFLAKE. Which would you like to explore?"
User: "1"
Assistant: [calls select_database("CORTES_DEMO_2") immediately - because last message was about DATABASES]

Example 2:
Assistant: "Available tables: 1. DAILY_REVENUE  2. HMDA_SAMPLE  3. MORTGAGE_LENDING_RATES"
User: "2"
Assistant: [calls select_tables("2") immediately - because last message was about TABLES]

Example 3:
Assistant: "Available tables: 1. CUSTOMERS  2. ORDERS  3. PRODUCTS"
User: "HMDA_SAMPLE"
Assistant: [calls select_tables("HMDA_SAMPLE") then generate_yaml_dictionary() immediately]

Example 4:
Assistant: "Available tables: 1. CUSTOMERS  2. ORDERS  3. PRODUCTS"
User: "generate"
Assistant: [calls select_tables("all") then generate_yaml_dictionary() immediately]

WRONG EXAMPLES TO AVOID:
❌ If last message showed tables and user says "2", DO NOT call select_database()
❌ If last message showed databases and user says "2", DO NOT call select_tables()
❌ NEVER ignore the context of what you just presented to the user

SIMPLIFIED WORKFLOW - FOLLOW THIS EXACTLY:
1. Connect to Snowflake
2. Get databases and let user select ONE
3. Get schemas and let user select ONE  
4. Get tables and let user select which ones
5. Generate dictionary immediately after table selection
6. Save to file

IMPORTANT: After step 4 (showing tables), the ONLY valid next action is select_tables() followed by generate_yaml_dictionary()
DO NOT call any other database/schema tools after showing tables to user.

Auto-initialization Steps:
- Connect to Snowflake immediately
- Get databases, let user select or auto-select first one
- Get schemas, let user select or auto-select first one
- Get tables and present options for user selection
- Generate dictionary once tables are selected

EFFICIENCY RULES:
- Avoid duplicate API calls - don't verify selections that were just made
- Use the most direct path to complete the workflow
- Don't call the same endpoint multiple times unnecessarily
- Once connected, reuse the same connection for all operations
- NEVER call connect_to_snowflake() more than once per session

Dictionary Generation Guidelines:
- Always show progress when generating dictionaries
- All dictionary generation uses AI-powered intelligent semantic modeling with LLM analysis
- Semantic models use GPT intelligence for superior column classification, business-friendly descriptions, and automatic relationship detection
- Models include measures (numeric metrics), dimensions (categorical data), time dimensions, and relationships
- Generated with structured output validation to ensure schema compliance
- Provide clear feedback on what tables are being processed
- Offer to save locally and upload to stage
- Show preview of generated content when helpful
- Handle errors gracefully and suggest solutions

Use the available tools to help users create comprehensive data dictionaries efficiently.
        """
    
    def _get_function_tools(self) -> List:
        """Get list of function tools - creates wrappers for OpenAI schema compatibility"""
        
        @function_tool
        def connect_to_snowflake() -> str:
            """Connect to Snowflake and establish a connection"""
            return self._connect_to_snowflake()
            
        @function_tool
        def get_databases() -> str:
            """Get list of available databases"""
            return self._get_databases()
            
        @function_tool
        def select_database(database_name: str) -> str:
            """Select a specific database to work with"""
            return self._select_database(database_name)
            
        @function_tool
        def get_schemas(database_name: str = None) -> str:
            """Get schemas for a database"""
            return self._get_schemas(database_name)
            
        @function_tool
        def select_schema(schema_name: str) -> str:
            """Select a specific schema to work with"""
            return self._select_schema(schema_name)
            
        @function_tool
        def get_tables() -> str:
            """Get tables in the current database and schema"""
            return self._get_tables()
            
        @function_tool
        def select_tables(table_selection: str) -> str:
            """Select tables for dictionary generation"""
            return self._select_tables(table_selection)
            
        @function_tool
        def generate_yaml_dictionary(output_filename: str = None) -> str:
            """Generate AI-powered intelligent semantic model with LLM analysis and structured output"""
            return self._generate_intelligent_semantic_model(output_filename)
            
        @function_tool
        def save_dictionary(filename: str) -> str:
            """Save the generated dictionary to a file"""
            return self._save_dictionary(filename)
            
        @function_tool
        def upload_to_stage(stage_name: str, filename: str) -> str:
            """Upload the generated dictionary to a Snowflake stage"""
            return self._upload_to_stage(stage_name, filename)
            
        @function_tool
        def get_stages() -> str:
            """Get stages in the current database and schema"""
            return self._get_stages()
            
        @function_tool
        def get_current_context() -> str:
            """Get current agent context and state"""
            return self.get_current_context_info()
            
        @function_tool
        def show_dictionary_preview() -> str:
            """Show a preview of the generated dictionary"""
            return self._show_dictionary_preview()
        
        return [
            connect_to_snowflake,
            get_databases,
            select_database,
            get_schemas,
            select_schema,
            get_tables,
            get_stages,
            select_tables,
            generate_yaml_dictionary,
            save_dictionary,
            upload_to_stage,
            get_current_context,
            show_dictionary_preview
        ]
    
    # Function tools - these wrap DataMind implementations
    def _get_current_session(self) -> Optional[DataModelAgentSession]:
        """Get current session from context (helper method)"""
        # This will be set by the chat method
        return getattr(self, '_current_session', None)
    
    def _get_current_context(self) -> Optional[AgentContext]:
        """Get current agent context - matches DataMind pattern"""
        session = self._get_current_session()
        if session:
            return session.agent_context
        return None
    
    def _connect_to_snowflake(self) -> str:
        """Connect to Snowflake and establish a connection"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        # Connection is already established when session was created
        return f"✅ Connected to Snowflake using connection: {session.connection_id}"
    
    def _get_databases(self) -> str:
        """Get list of available databases (with caching)"""
        context = self._get_current_context()
        session = self._get_current_session()
        if not context or not session:
            return "❌ No active session"
        
        # Check cache first (5 minute cache)
        import time
        if context.databases_cache and time.time() - context.databases_cache.get('timestamp', 0) < 300:
            logger.info("Using cached databases list")
            databases = context.databases_cache['databases']
            database_list = []
            for i, db in enumerate(databases, 1):
                database_list.append(f"{i}. {db}")
            return f"📊 Found {len(databases)} databases:\n" + "\n".join(database_list)
        
        try:
            from src.functions.metadata_functions import list_databases
            
            # Get or create connection lazily
            snowflake_connection = session.get_snowflake_connection()
            if not snowflake_connection:
                return "❌ Failed to establish Snowflake connection. Please check your connection settings."
            
            result = list_databases(snowflake_connection)
            
            if result["status"] == "success":
                databases = result["databases"]
                
                # Cache the result
                context.databases_cache = {
                    'databases': databases,
                    'timestamp': time.time()
                }
                
                database_list = []
                for i, db in enumerate(databases, 1):
                    database_list.append(f"{i}. {db}")
                
                return f"📊 Found {len(databases)} databases:\n" + "\n".join(database_list)
            else:
                return f"❌ Failed to get databases: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error getting databases: {e}")
            return f"❌ Error getting databases: {str(e)}"
    
    def _select_database(self, database_name: str) -> str:
        """Select a specific database to work with"""
        context = self._get_current_context()
        if not context:
            return "❌ No active session"
        
        context.current_database = database_name
        session = self._get_current_session()
        if session:
            session.update_activity()
        
        return f"✅ Selected database: {database_name}"
    
    def _get_schemas(self, database_name: Optional[str] = None) -> str:
        """Get schemas for a database"""
        context = self._get_current_context()
        session = self._get_current_session()
        if not context or not session:
            return "❌ No active session"
        
        db_name = database_name or context.current_database
        if not db_name:
            return "❌ No database selected. Please select a database first."
        
        try:
            from src.functions.metadata_functions import list_schemas
            
            # Get or create connection lazily
            snowflake_connection = session.get_snowflake_connection()
            if not snowflake_connection:
                return "❌ Failed to establish Snowflake connection. Please check your connection settings."
            
            result = list_schemas(snowflake_connection, db_name)
            
            if result["status"] == "success":
                schemas = result["schemas"]
                schema_list = []
                for i, schema in enumerate(schemas, 1):
                    schema_list.append(f"{i}. {schema}")
                
                return f"📂 Found {len(schemas)} schemas in {db_name}:\n" + "\n".join(schema_list)
            else:
                return f"❌ Failed to get schemas: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error getting schemas: {e}")
            return f"❌ Error getting schemas: {str(e)}"
    
    def _select_schema(self, schema_name: str) -> str:
        """Select a specific schema to work with"""
        context = self._get_current_context()
        session = self._get_current_session()
        if not context or not session:
            return "❌ No active session"
        
        if not context.current_database:
            return "❌ No database selected. Please select a database first."
        
        context.current_schema = schema_name
        session.update_activity()
        
        return f"✅ Selected schema: {schema_name}"
    
    def _get_tables(self) -> str:
        """Get tables in the current database and schema"""
        context = self._get_current_context()
        session = self._get_current_session()
        if not context or not session:
            return "❌ No active session"
        
        if not context.current_database or not context.current_schema:
            return "❌ Database and schema must be selected first."
        
        try:
            from src.functions.metadata_functions import list_tables
            
            # Get or create connection lazily
            snowflake_connection = session.get_snowflake_connection()
            if not snowflake_connection:
                return "❌ Failed to establish Snowflake connection. Please check your connection settings."
            
            result = list_tables(
                snowflake_connection,
                context.current_database,
                context.current_schema
            )
            
            if result["status"] == "success":
                tables = result["tables"]
                table_list = []
                for i, table in enumerate(tables, 1):
                    table_list.append(f"{i}. {table['table']} ({table['table_type']})")
                
                # Store tables for later selection - this matches DataMind pattern
                context.available_tables = tables
                
                return f"📋 Found {len(tables)} tables in {context.current_database}.{context.current_schema}:\n" + "\n".join(table_list)
            else:
                return f"❌ Failed to get tables: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error getting tables: {e}")
            return f"❌ Error getting tables: {str(e)}"
    
    def _get_stages(self) -> str:
        """Get stages in the current database and schema"""
        context = self._get_current_context()
        session = self._get_current_session()
        if not context or not session:
            return "❌ No active session"
        
        if not context.current_database or not context.current_schema:
            return "❌ Database and schema must be selected first."
        
        try:
            from src.functions.metadata_functions import list_stages
            
            # Get or create connection lazily
            snowflake_connection = session.get_snowflake_connection()
            if not snowflake_connection:
                return "❌ Failed to establish Snowflake connection. Please check your connection settings."
            
            result = list_stages(
                snowflake_connection,
                context.current_database,
                context.current_schema
            )
            
            if result["status"] == "success":
                stages = result["stages"]
                if stages:
                    stage_list = []
                    for i, stage in enumerate(stages, 1):
                        stage_list.append(f"{i}. **{stage['name']}** ({stage['type']})")
                    
                    return f"📦 Found {len(stages)} stages in {context.current_database}.{context.current_schema}:\n" + "\n".join(stage_list)
                else:
                    return f"📦 No stages found in {context.current_database}.{context.current_schema}"
            else:
                return f"❌ Failed to get stages: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error getting stages: {e}")
            return f"❌ Error getting stages: {str(e)}"
    
    def _select_tables(self, table_selection: str) -> str:
        """Select tables for dictionary generation"""
        context = self._get_current_context()
        session = self._get_current_session()
        if not context or not session:
            return "❌ No active session"
        
        if not context.current_database or not context.current_schema:
            return "❌ Database and schema must be selected first."
        
        # Get available tables if not stored
        available_tables = context.available_tables
        if not available_tables:
            # Need to get tables first
            return "❌ Please get tables first before selecting."
        
        table_names = [table['table'] for table in available_tables]
        selected_tables = []
        
        # Parse selection (matches DataMind logic exactly)
        if table_selection.lower() in ['all', '*']:
            selected_tables = table_names
        elif table_selection.isdigit():
            index = int(table_selection) - 1
            if 0 <= index < len(table_names):
                selected_tables = [table_names[index]]
            else:
                return f"❌ Invalid table number. Please select between 1 and {len(table_names)}"
        elif ',' in table_selection:
            selections = [s.strip() for s in table_selection.split(',')]
            for selection in selections:
                if selection.isdigit():
                    index = int(selection) - 1
                    if 0 <= index < len(table_names):
                        selected_tables.append(table_names[index])
                    else:
                        return f"❌ Invalid table number: {selection}"
                elif selection in table_names:
                    selected_tables.append(selection)
                else:
                    return f"❌ Table '{selection}' not found"
        elif table_selection in table_names:
            selected_tables = [table_selection]
        else:
            return f"❌ Invalid selection '{table_selection}'. Use table numbers (1,2,3), names, or 'all'"
        
        context.selected_tables = selected_tables
        session.update_activity()
        
        # Auto-generate dictionary after selection (matching DataMind behavior)
        try:
            generation_result = self._generate_intelligent_semantic_model()
            return f"✅ Selected {len(selected_tables)} table(s): {', '.join(selected_tables)}\n\n" + generation_result
        except Exception as e:
            logger.error(f"Error auto-generating after selection: {e}")
            return f"✅ Selected {len(selected_tables)} table(s): {', '.join(selected_tables)}\n❌ Auto-generation failed: {str(e)}\nPlease try 'generate_yaml_dictionary()' manually."
    
    def _generate_intelligent_semantic_model(self, output_filename: Optional[str] = None) -> str:
        """Generate AI-powered intelligent semantic model using LLM analysis and structured output"""
        context = self._get_current_context()
        session = self._get_current_session()
        if not context or not session:
            return "❌ No active session"
        
        if not context.selected_tables:
            return "❌ No tables selected. Please select tables first."
        
        if not self.openai_client:
            return "❌ OpenAI client not available. Intelligent generation requires OPENAI_API_KEY to be configured."
        
        try:
            from src.functions.intelligent_semantic_functions import generate_intelligent_semantic_model
            
            # Get or create connection lazily
            snowflake_connection = session.get_snowflake_connection()
            if not snowflake_connection:
                return "❌ Failed to establish Snowflake connection. Please check your connection settings."
            
            result = generate_intelligent_semantic_model(
                self.openai_client,
                snowflake_connection,
                context.selected_tables,
                context.current_database,
                context.current_schema,
                session.connection_id,
                session.session_id  # Pass session_id for progress updates
            )
            
            if result["status"] == "success":
                context.dictionary_content = result["yaml_dictionary"]
                session.update_activity()
                
                tables_processed = result.get("tables_processed", len(context.selected_tables))
                total_measures = result.get("total_measures", 0)
                total_dimensions = result.get("total_dimensions", 0)
                total_time_dims = result.get("total_time_dimensions", 0)
                total_relationships = result.get("total_relationships", 0)
                
                return f"🧠✅ Generated intelligent semantic model for {tables_processed} table(s)!\n" + \
                       f"📊 AI Analysis Results:\n" + \
                       f"   • {total_measures} measures (numeric metrics)\n" + \
                       f"   • {total_dimensions} dimensions (categorical data)\n" + \
                       f"   • {total_time_dims} time dimensions (temporal fields)\n" + \
                       f"   • {total_relationships} relationships detected\n" + \
                       f"🎯 Generated with LLM intelligence and structured output validation\n" + \
                       f"Ready for download or upload to stage."
            else:
                return f"❌ Failed to generate intelligent semantic model: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error generating intelligent semantic model: {e}")
            return f"❌ Error generating intelligent semantic model: {str(e)}"
    
    def _save_dictionary(self, filename: str) -> str:
        """Save the generated dictionary to a file"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        if not session.agent_context.dictionary_content:
            return "❌ No dictionary content available. Please generate a dictionary first."
        
        try:
            with open(filename, 'w') as f:
                f.write(session.agent_context.dictionary_content)
            return f"✅ Dictionary saved to: {filename}"
        except Exception as e:
            return f"❌ Failed to save dictionary: {str(e)}"
    
    def _upload_to_stage(self, stage_name: str, filename: str) -> str:
        """Upload the generated dictionary to a Snowflake stage"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        context = session.agent_context
        if not context.dictionary_content:
            return "❌ No dictionary content available. Please generate a dictionary first."
        
        if not context.current_database or not context.current_schema:
            return "❌ Database and schema must be selected first."
        
        # Qualify the stage name with database and schema
        qualified_stage_name = f"@{context.current_database}.{context.current_schema}.{stage_name}"
        
        try:
            from src.functions.stage_functions import save_dictionary_to_stage
            result = save_dictionary_to_stage(
                context.connection_id,
                qualified_stage_name,
                filename,
                context.dictionary_content
            )
            
            if result["status"] == "success":
                return f"✅ Dictionary uploaded to stage: {stage_name}/{filename}"
            else:
                return f"❌ Failed to upload to stage: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error uploading to stage: {e}")
            return f"❌ Error uploading to stage: {str(e)}"
    
    def get_current_context_info(self) -> str:
        """Get current agent context and state - renamed to avoid conflict"""
        context = self._get_current_context()
        if not context:
            return "❌ No active session"
        context_info = []
        context_info.append(f"🔗 Connection: {context.connection_id}")
        context_info.append(f"🗄️ Database: {context.current_database or 'Not selected'}")
        context_info.append(f"📂 Schema: {context.current_schema or 'Not selected'}")
        context_info.append(f"📋 Selected Tables: {len(context.selected_tables)} ({', '.join(context.selected_tables) if context.selected_tables else 'None'})")
        context_info.append(f"📄 Dictionary: {'Generated' if context.dictionary_content else 'Not generated'}")
        
        return "📊 Current Context:\n" + "\n".join(context_info)
    
    def _show_dictionary_preview(self) -> str:
        """Show a preview of the generated dictionary"""
        context = self._get_current_context()
        if not context:
            return "❌ No active session"
        
        if not context.dictionary_content:
            return "❌ No dictionary content available. Please generate a dictionary first."
        
        # Show first 500 characters
        preview = context.dictionary_content[:500]
        if len(context.dictionary_content) > 500:
            preview += "...\n\n[Content truncated - use save_dictionary() to save the full content]"
        
        return f"📋 Dictionary Preview:\n\n{preview}"
    
    def _create_stage(self, stage_name: str = "YAML_STAGE") -> str:
        """Create a Snowflake stage for uploading files"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        context = session.agent_context
        if not context.current_database or not context.current_schema:
            return "❌ Database and schema must be selected first."
        
        try:
            from src.functions.stage_functions import create_snowflake_stage
            result = create_snowflake_stage(
                context.connection_id,
                context.current_database,
                context.current_schema,
                stage_name
            )
            
            if result["status"] == "success":
                context.current_stage = stage_name
                return f"✅ Stage '{stage_name}' created successfully in {context.current_database}.{context.current_schema}"
            else:
                return f"❌ Failed to create stage: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error creating stage: {e}")
            return f"❌ Error creating stage: {str(e)}"
    
    def _list_stage_files(self, stage_name: str = None) -> str:
        """List files in a Snowflake stage"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        context = session.agent_context
        if not context.current_database or not context.current_schema:
            return "❌ Database and schema must be selected first."
        
        stage_to_list = stage_name or context.current_stage or "YAML_STAGE"
        
        try:
            from src.functions.stage_functions import list_stage_files
            result = list_stage_files(
                context.connection_id,
                context.current_database,
                context.current_schema,
                stage_to_list
            )
            
            if result["status"] == "success":
                files = result["files"]
                if files:
                    file_list = []
                    for i, file_info in enumerate(files, 1):
                        file_list.append(f"{i}. {file_info['name']} ({file_info['size']} bytes)")
                    return f"📁 Files in stage @{stage_to_list}:\n" + "\n".join(file_list)
                else:
                    return f"📁 Stage @{stage_to_list} is empty"
            else:
                return f"❌ Failed to list stage files: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error listing stage files: {e}")
            return f"❌ Error listing stage files: {str(e)}"
    
    def _validate_yaml_before_upload(self, yaml_content: str = None) -> tuple[bool, str]:
        """Validate YAML content before uploading to stage"""
        session = self._get_current_session()
        if not session:
            return False, "❌ No active session"
        
        content_to_validate = yaml_content or session.agent_context.dictionary_content
        if not content_to_validate:
            return False, "❌ No YAML content to validate"
        
        try:
            import yaml
            # Parse YAML to check if it's valid
            yaml.safe_load(content_to_validate)
            
            # Check if it looks like a data dictionary
            parsed = yaml.safe_load(content_to_validate)
            if not isinstance(parsed, dict):
                return False, "❌ YAML content is not a dictionary structure"
            
            # Check for expected dictionary structure
            if 'version' not in parsed and 'tables' not in parsed:
                return False, "❌ YAML does not appear to be a data dictionary (missing 'version' or 'tables' sections)"
            
            return True, "✅ YAML content is valid"
            
        except yaml.YAMLError as e:
            return False, f"❌ Invalid YAML format: {str(e)}"
        except Exception as e:
            return False, f"❌ Validation error: {str(e)}"
    
    # Public API methods
    def start_session(self, connection_id: str) -> str:
        """Start a new @datamodel agent session"""
        try:
            # Validate connection exists - with timeout protection
            db = SessionLocal()
            try:
                # Add explicit timeout to database query
                conn = db.query(SnowflakeConnectionModel).filter_by(id=connection_id).first()
                if not conn:
                    raise ValueError(f"Connection not found: {connection_id}")
                
                if not conn.is_active:
                    raise ValueError(f"Connection is not active: {connection_id}")
                
            finally:
                # Ensure database connection is closed
                try:
                    db.close()
                except:
                    pass
                
            # Generate session ID
            session_id = f"datamodel_{int(time.time())}_{connection_id}"
            
            # Create session - this should be fast now with lazy connection
            session = DataModelAgentSession(session_id, connection_id)
            self.sessions[session_id] = session
            
            # Cleanup expired sessions
            self.cleanup_expired_sessions()
            
            logger.info(f"Started @datamodel agent session: {session_id}")
            
            return session_id
                
        except Exception as e:
            logger.error(f"Error starting @datamodel session: {e}")
            raise
    
    async def get_initialization_response(self, session_id: str) -> str:
        """Get auto-initialization response like DataMind CLI"""
        try:
            session = self.sessions.get(session_id)
            if not session:
                raise ValueError("Session not found")
            
            # For now, return simple message to avoid blocking issues
            # Auto-initialization will be added back once basic chat works
            return "🎉 Connected! I'm ready to help you generate YAML data dictionaries. Please ask me to show databases to get started."
                
        except Exception as e:
            logger.error(f"Error in auto-initialization: {e}")
            return f"🎉 Connected! I'm ready to help you generate YAML data dictionaries. Please ask me to show databases to get started."
    
    async def chat(self, session_id: str, message: str) -> str:
        """Handle chat message with @datamodel agent"""
        try:
            session = self.sessions.get(session_id)
            if not session:
                raise ValueError("Session not found")
            
            if session.is_expired():
                del self.sessions[session_id]
                raise ValueError("Session expired")
            
            session.update_activity()
            
            # Set current session for function tools
            self._current_session = session
            
            try:
                if self.agent and AGENTS_AVAILABLE:
                    # Import Runner here to avoid import issues
                    from agents import Runner
                    
                    # Use OpenAI Agent SDK  
                    result = await Runner.run(
                        self.agent, 
                        message, 
                        session=session.sqlite_session
                    )
                    
                    response = result.final_output if hasattr(result, 'final_output') else str(result)
                else:
                    # No fallback - require OpenAI Agent SDK
                    response = "❌ OpenAI Agent SDK not available. Please ensure proper configuration."
                
                logger.debug(f"@datamodel agent response: {response}")
                return response
                
            finally:
                # Clear current session reference
                self._current_session = None
                
        except Exception as e:
            logger.error(f"Error in @datamodel agent chat: {e}")
            raise
    
    # Removed _fallback_response method - using OpenAI Agent SDK only
    
    def get_session_context(self, session_id: str) -> AgentContext:
        """Get session context"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("Session not found")
        
        return session.agent_context
    
    def get_connection_info(self, connection_id: str) -> Dict[str, Any]:
        """Get connection information"""
        db = SessionLocal()
        try:
            conn = db.query(SnowflakeConnectionModel).filter_by(id=connection_id).first()
            if not conn:
                raise ValueError("Connection not found")
            
            return {
                'name': conn.name,
                'account': conn.account,
                'database': conn.database,
                'schema': conn.schema
            }
        finally:
            db.close()
    
    def download_yaml_dictionary(self, session_id: str) -> tuple[bytes, str]:
        """Download generated YAML dictionary"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("Session not found")
        
        context = session.agent_context
        if not context.dictionary_content:
            raise ValueError("No YAML dictionary available")
        
        # Generate filename
        db = context.current_database or "database"
        schema = context.current_schema or "schema"
        
        if len(context.selected_tables) == 1:
            filename = f"{db}_{schema}_{context.selected_tables[0]}.yaml"
        else:
            filename = f"{db}_{schema}_dictionary.yaml"
        
        yaml_bytes = context.dictionary_content.encode('utf-8')
        
        return yaml_bytes, filename
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session and clean up connections"""
        if session_id in self.sessions:
            session = self.sessions[session_id]
            # Close Snowflake connection if it exists
            session.close_snowflake_connection()
            del self.sessions[session_id]
            logger.info(f"Deleted @datamodel agent session: {session_id}")
        
        return True
    
    def cleanup_expired_sessions(self, timeout_minutes: int = 60):
        """Clean up expired sessions"""
        expired_ids = [
            sid for sid, session in self.sessions.items()
            if session.is_expired(timeout_minutes)
        ]
        
        for sid in expired_ids:
            session = self.sessions[sid]
            session.close_snowflake_connection()
            del self.sessions[sid]
        
        if expired_ids:
            logger.info(f"Cleaned up {len(expired_ids)} expired @datamodel sessions")
    
    # Staging API methods
    def upload_to_staging(self, session_id: str, filename: str) -> Dict[str, Any]:
        """Upload YAML dictionary to staging area (public API method)"""
        try:
            session = self.sessions.get(session_id)
            if not session:
                raise ValueError("Session not found")
            
            context = session.agent_context
            if not context.dictionary_content:
                raise ValueError("No dictionary content available")
            
            # Set current session for function tools
            self._current_session = session
            
            try:
                # Validate YAML before upload
                is_valid, error_msg = self._validate_yaml_before_upload()
                if not is_valid:
                    return {"status": "error", "error": error_msg}
                
                # Upload to stage
                result = self._upload_to_stage("YAML_STAGE", filename)
                
                if "✅" in result:
                    return {
                        "status": "success",
                        "path": f"@YAML_STAGE/{filename}",
                        "message": result
                    }
                else:
                    return {"status": "error", "error": result}
                    
            finally:
                self._current_session = None
                
        except Exception as e:
            logger.error(f"Error uploading to staging: {e}")
            return {"status": "error", "error": str(e)}
    
    def list_staging_files(self, session_id: str, stage_name: str = None) -> List[str]:
        """List files in staging area (public API method)"""
        try:
            session = self.sessions.get(session_id)
            if not session:
                raise ValueError("Session not found")
            
            # Set current session for function tools
            self._current_session = session
            
            try:
                result = self._list_stage_files(stage_name)
                
                # Parse the result to extract file names
                if "📁 Files in stage" in result:
                    lines = result.split('\n')[1:]  # Skip header
                    files = []
                    for line in lines:
                        if '. ' in line:
                            # Extract filename from "1. filename.yaml (123 bytes)"
                            filename = line.split('. ')[1].split(' (')[0]
                            files.append(filename)
                    return files
                else:
                    return []
                    
            finally:
                self._current_session = None
                
        except Exception as e:
            logger.error(f"Error listing staging files: {e}")
            raise


# Singleton instance
_datamodel_agent_instance = None

def get_datamodel_agent() -> DataModelAgent:
    """Get singleton @datamodel agent instance"""
    global _datamodel_agent_instance
    if _datamodel_agent_instance is None:
        _datamodel_agent_instance = DataModelAgent()
    return _datamodel_agent_instance