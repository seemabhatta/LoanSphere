"""
Unified Agent Service for LoanSphere
Combines all agent functionality into a single, extensible service
"""
import os
import json
import asyncio
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime
from loguru import logger
from concurrent.futures import ThreadPoolExecutor

# OpenAI Agent SDK imports
AGENTS_AVAILABLE = True
try:
    from agents import Agent, Runner, function_tool
    from agents.memory.session import SQLiteSession
except Exception as _e:
    AGENTS_AVAILABLE = False
    def function_tool(func=None, *args, **kwargs):
        def wrapper(f):
            return f
        return wrapper(func) if callable(func) else wrapper

from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models import SnowflakeConnectionModel

# Import existing tools (available as module-level functions)
from services.ai_agent_service import (
    tool_get_all_loan_data, tool_get_loan_data_by_id, tool_get_loan_data_raw_by_id,
    tool_get_latest_loan_data_raw, tool_get_all_commitments, tool_get_commitment_by_id,
    tool_search_by_loan_number, tool_get_loan_tracking_records
)

# Note: Datamodel agent tools are defined as inner functions and need special handling
# For now, we'll create placeholder tools and integrate with existing service

# Simple datamodel tools - these will delegate to the existing service
@function_tool
def tool_get_databases() -> str:
    """Get available databases from Snowflake connection"""
    # This will be handled by the datamodel agent integration
    return "Available databases: (Use datamodel agent for detailed exploration)"

@function_tool 
def tool_get_schemas() -> str:
    """Get available schemas from selected database"""
    return "Available schemas: (Use datamodel agent for detailed exploration)"

@function_tool
def tool_generate_dictionary() -> str:
    """Generate YAML data dictionary for selected tables"""
    return "YAML dictionary generation: (Use datamodel agent for full functionality)"


@dataclass
class RequestContext:
    """Stateless request context that carries all needed information"""
    mode: str
    connection_id: Optional[str] = None
    user_id: str = "default"
    session_id: Optional[str] = None  # For reusing existing agent sessions
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "mode": self.mode,
            "connection_id": self.connection_id,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "metadata": self.metadata
        }


class ConnectionPool:
    """Centralized connection pool for expensive resources"""
    _connections: Dict[str, Any] = {}
    _executor = ThreadPoolExecutor(max_workers=3)
    
    @classmethod
    async def get_snowflake_connection(cls, connection_id: str):
        """Get or create Snowflake connection"""
        if connection_id not in cls._connections:
            cls._connections[connection_id] = await cls._create_snowflake_connection(connection_id)
        return cls._connections[connection_id]
    
    @classmethod
    async def _create_snowflake_connection(cls, connection_id: str):
        """Create Snowflake connection using existing logic"""
        return await asyncio.get_event_loop().run_in_executor(
            cls._executor, 
            cls._create_snowflake_connection_sync, 
            connection_id
        )
    
    @classmethod
    def _create_snowflake_connection_sync(cls, connection_id: str):
        """Synchronous Snowflake connection creation (from existing code)"""
        try:
            db = SessionLocal()
            try:
                conn = db.query(SnowflakeConnectionModel).filter_by(id=connection_id).first()
                if not conn:
                    raise ValueError(f"Connection not found: {connection_id}")
                
                # Build connection config (copied from existing logic)
                config = {
                    'user': conn.username,
                    'account': conn.account,
                    'warehouse': conn.warehouse,
                    'database': conn.database,
                    'schema': conn.schema,
                    'role': conn.role,
                    'connection_timeout': 20,
                    'network_timeout': 25,
                    'login_timeout': 30,
                    'client_session_keep_alive': False,
                    'client_request_mfa_token': False,
                }
                
                # Handle different authentication types
                if conn.authenticator == 'RSA':
                    if conn.private_key:
                        import tempfile
                        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
                            f.write(conn.private_key)
                            config['private_key_file'] = f.name
                    else:
                        raise ValueError("RSA authentication selected but no private key provided")
                elif conn.authenticator == 'PAT':
                    config['token'] = conn.password
                    config['authenticator'] = 'oauth'
                elif conn.authenticator == 'oauth':
                    config['token'] = conn.password
                    config['authenticator'] = 'oauth'
                else:
                    config['password'] = conn.password
                    config['authenticator'] = conn.authenticator or 'snowflake'
                
                # Create connection
                import snowflake.connector
                snowflake_conn = snowflake.connector.connect(**config)
                logger.info(f"✅ Created Snowflake connection for {connection_id}")
                return snowflake_conn
                
            finally:
                db.close()
        except Exception as e:
            logger.error(f"❌ Failed to create Snowflake connection: {e}")
            raise
    
    @classmethod
    async def run_blocking(cls, func, *args, **kwargs):
        """Run blocking operation in thread pool"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(cls._executor, func, *args, **kwargs)


class UnifiedAgentService:
    """Unified service that manages all agent types"""
    
    # Agent configurations
    AGENT_CONFIG = {
        "general": {
            "model": "gpt-4o-mini",
            "system_prompt": """You are a loan specialist AI assistant for LoanSphere. 
                You help with loan data queries, purchase advice, commitments, and boarding tracking.
                Always provide accurate, helpful responses about loan-related topics.""",
            "tools": [
                tool_get_all_loan_data, tool_get_loan_data_by_id, tool_get_loan_data_raw_by_id,
                tool_get_latest_loan_data_raw, tool_get_all_commitments, tool_get_commitment_by_id,
                tool_search_by_loan_number, tool_get_loan_tracking_records
            ],
            "requires_connection": False,
            "timeout": 30
        },
        "datamodel": {
            "model": "gpt-4o-mini",
            "system_prompt": """You are a Snowflake Data Dictionary Generator Assistant that helps users create YAML data dictionaries from their Snowflake tables.

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
- Provide clear feedback on what tables are being processed
- Offer to save locally and upload to stage
- Show preview of generated content when helpful
- Handle errors gracefully and suggest solutions

Use the available tools to help users create comprehensive data dictionaries efficiently.""",
            "tools": [
                tool_get_databases, tool_get_schemas, tool_generate_dictionary
            ],
            "requires_connection": True,
            "timeout": 180  # Allow time for YAML schema generation
        }
    }
    
    def __init__(self):
        self.agents: Dict[str, Agent] = {}
        self.openai_client = None
        
        if AGENTS_AVAILABLE:
            self._init_openai_client()
        else:
            logger.warning("OpenAI Agent SDK not available - using fallback mode")
    
    def _init_openai_client(self):
        """Initialize OpenAI client"""
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("OPENAI_API_KEY not found")
                return
            
            from openai import OpenAI
            self.openai_client = OpenAI(api_key=api_key)
            logger.info("OpenAI client initialized for unified agent service")
            
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
    
    async def get_or_create_agent(self, context: RequestContext) -> Optional[Agent]:
        """Get or create agent for given context"""
        if not AGENTS_AVAILABLE:
            return None
            
        # Create agent key (mode + connection for datamodel agents)
        if context.mode == "datamodel" and context.connection_id:
            agent_key = f"{context.mode}_{context.connection_id}"
        else:
            agent_key = context.mode
            
        if agent_key not in self.agents:
            self.agents[agent_key] = await self._create_agent(context)
            
        return self.agents[agent_key]
    
    async def _create_agent(self, context: RequestContext) -> Agent:
        """Create new agent instance"""
        config = self.AGENT_CONFIG.get(context.mode)
        if not config:
            raise ValueError(f"Unknown agent mode: {context.mode}")
        
        model_name = os.getenv("OPENAI_MODEL", config["model"])
        
        # Set up connection context for datamodel agents
        if context.mode == "datamodel" and context.connection_id:
            # Get connection to validate it exists
            await ConnectionPool.get_snowflake_connection(context.connection_id)
        
        logger.info(f"Creating {context.mode} agent with model: {model_name}")
        
        agent = Agent(
            name=f"{context.mode.title()}Agent",
            model=model_name,
            instructions=config["system_prompt"],
            tools=config["tools"],
        )
        
        return agent
    
    async def chat(self, message: str, context: RequestContext) -> str:
        """Unified chat method for all agent types"""
        try:
            # For datamodel mode, delegate to existing service for complex operations
            if context.mode == "datamodel" and context.connection_id:
                return await self._handle_datamodel_chat(message, context)
            
            agent = await self.get_or_create_agent(context)
            if not agent:
                return "❌ Agent SDK not available. Please ensure proper configuration."
            
            # Set context for tools (similar to existing _current_session pattern)
            self._current_context = context
            
            # Create SQLite session for conversation memory
            session_id = f"{context.mode}_{context.connection_id or 'default'}_{datetime.now().strftime('%Y%m%d')}"
            sqlite_session = SQLiteSession(session_id)
            
            # Run agent
            result = await Runner.run(agent, message, session=sqlite_session)
            response = result.final_output if hasattr(result, 'final_output') else str(result)
            
            logger.debug(f"{context.mode} agent response: {response}")
            return response
            
        except Exception as e:
            logger.error(f"Error in {context.mode} agent chat: {e}")
            raise
        finally:
            self._current_context = None
    
    async def _handle_datamodel_chat(self, message: str, context: RequestContext) -> str:
        """Handle datamodel chat by delegating to existing datamodel agent service"""
        try:
            logger.info(f"[Unified] Delegating datamodel chat to existing service")
            
            # Import here to avoid circular imports
            from services.datamodel_agent_service import get_datamodel_agent
            
            # Get existing datamodel agent
            datamodel_service = get_datamodel_agent()
            logger.info(f"[Unified] Got datamodel service, active sessions: {len(datamodel_service.sessions)}")
            
            # Reuse existing session or create new one
            if context.session_id and datamodel_service.sessions.get(context.session_id):
                session_id = context.session_id
                logger.info(f"[Unified] Reusing existing session: {session_id}")
            else:
                try:
                    session_id = datamodel_service.start_session(context.connection_id)
                    logger.info(f"[Unified] Created new datamodel session: {session_id}")
                except Exception as session_error:
                    logger.error(f"[Unified] Failed to create session: {session_error}")
                    return f"Failed to create datamodel session: {str(session_error)}"
            
            # Use existing chat method
            logger.info(f"[Unified] Calling datamodel chat with session {session_id}")
            response = await datamodel_service.chat(session_id, message)
            logger.info(f"[Unified] Got datamodel response: {response[:100]}...")
            
            # Update context with the session_id that was used
            context.session_id = session_id
            
            return response
            
        except Exception as e:
            logger.error(f"[Unified] Error in datamodel delegation: {e}")
            import traceback
            logger.error(f"[Unified] Traceback: {traceback.format_exc()}")
            return f"I'm having trouble connecting to the datamodel service. Error: {str(e)}"
    
    # Streaming functionality removed - using simple HTTP responses only
    
    def get_available_modes(self) -> List[str]:
        """Get list of available agent modes"""
        return list(self.AGENT_CONFIG.keys())
    
    def get_mode_info(self, mode: str) -> Dict[str, Any]:
        """Get information about an agent mode"""
        config = self.AGENT_CONFIG.get(mode, {})
        return {
            "mode": mode,
            "requires_connection": config.get("requires_connection", False),
            "timeout": config.get("timeout", 30),
            "description": config.get("system_prompt", "").split('.')[0]  # First sentence
        }


# Singleton instance
_unified_agent_service = None

def get_unified_agent_service() -> UnifiedAgentService:
    """Get singleton unified agent service instance"""
    global _unified_agent_service
    if _unified_agent_service is None:
        _unified_agent_service = UnifiedAgentService()
    return _unified_agent_service