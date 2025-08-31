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

# Add DataMind path for imports
DATAMIND_PATH = os.path.join(os.path.dirname(__file__), '..', 'attached_assets', 'datamind-master', 'datamind-master')
if DATAMIND_PATH not in sys.path:
    sys.path.insert(0, DATAMIND_PATH)

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
    # Add connection pooling
    _snowflake_connection: Optional[Any] = field(default=None, init=False)
    _connection_config: Optional[Dict[str, Any]] = field(default=None, init=False)
    
    def __post_init__(self):
        """Ensure selected_tables is always a list"""
        if self.selected_tables is None:
            self.selected_tables = []


class DataModelAgentSession:
    """Session management for @datamodel agent"""
    
    def __init__(self, session_id: str, connection_id: str):
        self.session_id = session_id
        self.connection_id = connection_id
        self.agent_context = AgentContext(connection_id=connection_id)
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.sqlite_session = None
        
        # Create SQLite session for OpenAI Agent SDK if available
        if AGENTS_AVAILABLE:
            try:
                self.sqlite_session = SQLiteSession(f"datamodel_session_{session_id}")
            except Exception as e:
                logger.warning(f"Failed to create SQLite session: {e}")
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.now()
    
    def is_expired(self, timeout_minutes: int = 60) -> bool:
        """Check if session is expired"""
        return (datetime.now() - self.last_activity).total_seconds() > (timeout_minutes * 60)
    
    def get_snowflake_connection(self):
        """Get or create a reusable Snowflake connection"""
        if self.agent_context._snowflake_connection is None:
            # Load connection config once
            if self.agent_context._connection_config is None:
                db = SessionLocal()
                try:
                    conn = db.query(SnowflakeConnectionModel).filter_by(
                        id=self.connection_id
                    ).first()
                    if not conn:
                        raise ValueError(f"Connection not found: {self.connection_id}")
                    
                    self.agent_context._connection_config = {
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
            
            # Create connection once and reuse
            import snowflake.connector
            self.agent_context._snowflake_connection = snowflake.connector.connect(
                **self.agent_context._connection_config
            )
            logger.info(f"Created Snowflake connection for session {self.session_id}")
        
        return self.agent_context._snowflake_connection
    
    def close_snowflake_connection(self):
        """Close the Snowflake connection when session ends"""
        if self.agent_context._snowflake_connection:
            try:
                self.agent_context._snowflake_connection.close()
                logger.info(f"Closed Snowflake connection for session {self.session_id}")
            except Exception as e:
                logger.warning(f"Error closing Snowflake connection: {e}")
            finally:
                self.agent_context._snowflake_connection = None


class DataModelAgent:
    """@datamodel Agent Service - OpenAI Agent SDK integration"""
    
    def __init__(self):
        self.sessions: Dict[str, DataModelAgentSession] = {}
        self.agent = None
        
        if AGENTS_AVAILABLE:
            self._init_agent()
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
    
    def _get_agent_instructions(self) -> str:
        """Get agent instructions - exact copy from DataMind CLI"""
        return """
        You are a Snowflake Data Dictionary Generator Assistant that helps users create YAML data dictionaries from their Snowflake tables.

        Your capabilities:
        1. Connect to Snowflake databases
        2. Browse database structures (databases, schemas, tables)
        3. Select tables for dictionary generation
        4. Generate comprehensive YAML data dictionaries
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

        SIMPLIFIED WORKFLOW - FOLLOW THIS EXACTLY:
        1. Wait for user to request connection or ask about capabilities
        2. When ready, connect to Snowflake using the provided connection
        3. Get databases and let user select ONE
        4. Get schemas and let user select ONE  
        5. Get tables and let user select which ones
        6. Generate dictionary immediately after table selection
        7. Save to file and optionally upload to stage

        IMPORTANT: Do NOT auto-connect to Snowflake on startup. Wait for user interaction first.

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
            """Generate YAML data dictionary from selected tables"""
            return self._generate_yaml_dictionary(output_filename)
            
        @function_tool
        def save_dictionary(filename: str) -> str:
            """Save the generated dictionary to a file"""
            return self._save_dictionary(filename)
            
        @function_tool
        def upload_to_stage(stage_name: str, filename: str) -> str:
            """Upload the generated dictionary to a Snowflake stage"""
            return self._upload_to_stage(stage_name, filename)
            
        @function_tool
        def get_current_context() -> str:
            """Get current agent context and state"""
            return self._get_current_context()
            
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
    
    def _connect_to_snowflake(self) -> str:
        """Connect to Snowflake and establish a connection"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        # Connection is already established when session was created
        return f"✅ Connected to Snowflake using connection: {session.connection_id}"
    
    def _get_databases(self) -> str:
        """Get list of available databases"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        try:
            from src.functions.metadata_functions import list_databases
            result = list_databases(session)
            
            if result["status"] == "success":
                databases = result["databases"]
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
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        session.agent_context.current_database = database_name
        session.update_activity()
        
        return f"✅ Selected database: {database_name}"
    
    def _get_schemas(self, database_name: Optional[str] = None) -> str:
        """Get schemas for a database"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        db_name = database_name or session.agent_context.current_database
        if not db_name:
            return "❌ No database selected. Please select a database first."
        
        try:
            from src.functions.metadata_functions import list_schemas
            result = list_schemas(session, db_name)
            
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
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        if not session.agent_context.current_database:
            return "❌ No database selected. Please select a database first."
        
        session.agent_context.current_schema = schema_name
        session.update_activity()
        
        return f"✅ Selected schema: {schema_name}"
    
    def _get_tables(self) -> str:
        """Get tables in the current database and schema"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        if not session.agent_context.current_database or not session.agent_context.current_schema:
            return "❌ Database and schema must be selected first."
        
        try:
            from src.functions.metadata_functions import list_tables
            result = list_tables(
                session,
                session.agent_context.current_database,
                session.agent_context.current_schema
            )
            
            if result["status"] == "success":
                tables = result["tables"]
                table_list = []
                for i, table in enumerate(tables, 1):
                    table_list.append(f"{i}. {table['table']} ({table['table_type']})")
                
                # Store tables for later selection
                session.agent_context.available_tables = tables
                
                return f"📋 Found {len(tables)} tables in {session.agent_context.current_database}.{session.agent_context.current_schema}:\n" + "\n".join(table_list)
            else:
                return f"❌ Failed to get tables: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error getting tables: {e}")
            return f"❌ Error getting tables: {str(e)}"
    
    def _select_tables(self, table_selection: str) -> str:
        """Select tables for dictionary generation"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        if not session.agent_context.current_database or not session.agent_context.current_schema:
            return "❌ Database and schema must be selected first."
        
        # Get available tables if not stored
        available_tables = getattr(session.agent_context, 'available_tables', [])
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
        
        session.agent_context.selected_tables = selected_tables
        session.update_activity()
        
        return f"✅ Selected {len(selected_tables)} table(s): {', '.join(selected_tables)}"
    
    def _generate_yaml_dictionary(self, output_filename: Optional[str] = None) -> str:
        """Generate YAML data dictionary from selected tables"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        context = session.agent_context
        if not context.selected_tables:
            return "❌ No tables selected. Please select tables first."
        
        try:
            from src.functions.dictionary_functions import generate_data_dictionary
            result = generate_data_dictionary(
                context.connection_id,
                context.selected_tables,
                context.current_database,
                context.current_schema
            )
            
            if result["status"] == "success":
                context.dictionary_content = result["yaml_dictionary"]
                session.update_activity()
                
                tables_processed = result.get("tables_processed", len(context.selected_tables))
                return f"✅ Generated YAML dictionary for {tables_processed} table(s)! Dictionary is ready for download."
            else:
                return f"❌ Failed to generate dictionary: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error generating YAML dictionary: {e}")
            return f"❌ Error generating dictionary: {str(e)}"
    
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
    
    def _get_current_context(self) -> str:
        """Get current agent context and state"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        context = session.agent_context
        context_info = []
        context_info.append(f"🔗 Connection: {context.connection_id}")
        context_info.append(f"🗄️ Database: {context.current_database or 'Not selected'}")
        context_info.append(f"📂 Schema: {context.current_schema or 'Not selected'}")
        context_info.append(f"📋 Selected Tables: {len(context.selected_tables)} ({', '.join(context.selected_tables) if context.selected_tables else 'None'})")
        context_info.append(f"📄 Dictionary: {'Generated' if context.dictionary_content else 'Not generated'}")
        
        return "📊 Current Context:\n" + "\n".join(context_info)
    
    def _show_dictionary_preview(self) -> str:
        """Show a preview of the generated dictionary"""
        session = self._get_current_session()
        if not session:
            return "❌ No active session"
        
        if not session.agent_context.dictionary_content:
            return "❌ No dictionary content available. Please generate a dictionary first."
        
        # Show first 500 characters
        preview = session.agent_context.dictionary_content[:500]
        if len(session.agent_context.dictionary_content) > 500:
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
            # Validate connection exists
            db = SessionLocal()
            try:
                conn = db.query(SnowflakeConnectionModel).filter_by(id=connection_id).first()
                if not conn:
                    raise ValueError(f"Connection not found: {connection_id}")
                
                if not conn.is_active:
                    raise ValueError(f"Connection is not active: {connection_id}")
                
                # Generate session ID
                session_id = f"datamodel_{int(time.time())}_{connection_id}"
                
                # Create session
                session = DataModelAgentSession(session_id, connection_id)
                self.sessions[session_id] = session
                
                # Cleanup expired sessions
                self.cleanup_expired_sessions()
                
                logger.info(f"Started @datamodel agent session: {session_id}")
                return session_id
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error starting @datamodel session: {e}")
            raise
    
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
                    # Use OpenAI Agent SDK  
                    result = await Runner.run(
                        self.agent, 
                        message, 
                        session=session.sqlite_session
                    )
                    
                    response = result.final_output if hasattr(result, 'final_output') else str(result)
                else:
                    # Fallback mode
                    response = self._fallback_response(session, message)
                
                logger.debug(f"@datamodel agent response: {response}")
                return response
                
            finally:
                # Clear current session reference
                self._current_session = None
                
        except Exception as e:
            logger.error(f"Error in @datamodel agent chat: {e}")
            raise
    
    def _fallback_response(self, session: DataModelAgentSession, message: str) -> str:
        """Fallback response when OpenAI Agent SDK is not available"""
        msg_lower = message.lower()
        context = session.agent_context
        
        if not context.current_database:
            return "I can help you create YAML data dictionaries from your Snowflake database! I'm ready to connect when you are. You can ask me to 'show databases' or 'connect to Snowflake' to get started."
        elif not context.current_schema:
            return f"Great! Database '{context.current_database}' is selected. Now let me show you the available schemas."
        elif not context.selected_tables:
            return f"Perfect! Schema '{context.current_schema}' is selected. Now let me show you the available tables so you can select which ones to include in your data dictionary."
        elif "generate" in msg_lower or "create" in msg_lower:
            return f"Excellent! I'll generate a YAML data dictionary for your selected tables: {', '.join(context.selected_tables)}"
        else:
            return "I'm ready to help you generate YAML data dictionaries! You can ask me to show databases, schemas, tables, or generate a dictionary."
    
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