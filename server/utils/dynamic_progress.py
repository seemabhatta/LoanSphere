"""
Dynamic Context-Aware Progress System
Generates intelligent, contextual progress messages using AI based on actual runtime context
"""
import asyncio
from typing import Dict, Any, Optional
from loguru import logger


class DynamicProgressManager:
    """
    Manages dynamic progress message generation for any agent type
    Uses OpenAI to generate contextual messages based on actual operation data
    """
    
    def __init__(self, agent_type: str, openai_client):
        self.agent_type = agent_type
        self.openai_client = openai_client
        
    def extract_operation_context(self, session_context: Dict[str, Any], 
                                 message: str, 
                                 current_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Extract rich context about what's actually happening"""
        
        # Infer operation type from message
        operation_type = self._infer_operation_type(message)
        
        # Extract data context
        data_context = {}
        if current_data:
            tables = current_data.get('tables', [])
            data_context = {
                "table_count": len(tables),
                "total_columns": sum(len(t.get('columns', [])) for t in tables),
                "table_names": [t.get('name') for t in tables[:3]],  # First 3 tables
                "largest_table": max(tables, key=lambda t: len(t.get('columns', [])), default={}).get('name') if tables else None,
                "has_sample_data": any(t.get('columns', [{}])[0].get('sample_values') for t in tables if t.get('columns'))
            }
        
        return {
            "agent_type": self.agent_type,
            "operation_type": operation_type,
            "message": message,
            "session_context": {
                "database": session_context.get("current_database"),
                "schema": session_context.get("current_schema"), 
                "connection": session_context.get("connection_id")
            },
            "data_context": data_context,
            "processing_stage": self._get_processing_stage(message, current_data)
        }
    
    def generate_contextual_progress_message_async(self, context: Dict[str, Any], 
                                                  step: str = None, 
                                                  callback=None) -> None:
        """Generate AI-powered contextual progress message as fire-and-forget background task"""
        
        async def _background_generation():
            try:
                prompt = self._build_progress_prompt(context, step)
                
                # Use OpenAI Responses API (latest version)
                import asyncio
                import os
                model_name = os.getenv("OPENAI_MODEL", "gpt-5")
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.openai_client.responses.create(
                        model=model_name,
                        input=prompt
                    )
                )
                
                message = response.output_text.strip()
                logger.debug(f"Generated dynamic progress: {message}")
                
                # Call callback with generated message if provided
                if callback:
                    callback(message)
                    
            except Exception as e:
                logger.debug(f"Dynamic progress generation failed (non-critical): {e}")
                # Generate fallback message
                fallback = self._generate_fallback_message(context, step)
                if callback:
                    callback(fallback)
        
        # Fire and forget - never blocks main execution
        import asyncio
        try:
            asyncio.create_task(_background_generation())
        except Exception as e:
            logger.debug(f"Could not create dynamic progress task: {e}")
            # If can't create task, just use fallback immediately
            if callback:
                fallback = self._generate_fallback_message(context, step)
                callback(fallback)
    
    def _infer_operation_type(self, message: str) -> str:
        """Infer what type of operation is being performed"""
        message_lower = message.lower()
        
        if 'database' in message_lower or 'show databases' in message_lower:
            return "database_listing"
        elif 'schema' in message_lower or message in ['1', '2', '3', '4', '5']:
            return "schema_analysis"
        elif 'table' in message_lower or 'generate' in message_lower:
            return "semantic_generation"
        elif 'query' in message_lower or 'search' in message_lower:
            return "data_querying"
        else:
            return "data_processing"
    
    def _get_processing_stage(self, message: str, current_data: Optional[Dict]) -> str:
        """Determine what stage of processing we're in"""
        if not current_data:
            return "initialization"
        elif current_data.get('tables') and len(current_data['tables']) > 0:
            return "data_analysis"
        else:
            return "request_processing"
    
    def _build_progress_prompt(self, context: Dict[str, Any], step: str) -> str:
        """Build the prompt for AI progress message generation"""
        
        data_details = ""
        if context["data_context"]:
            dc = context["data_context"]
            if dc.get("table_count", 0) > 0:
                data_details = f"""
Data being processed:
- {dc['table_count']} tables with {dc['total_columns']} total columns
- Tables: {', '.join(dc['table_names'])}
- Largest table: {dc['largest_table']} 
- Has sample data: {dc['has_sample_data']}"""
        
        session_info = ""
        if context["session_context"].get("database"):
            sc = context["session_context"]
            session_info = f"Database: {sc['database']}.{sc['schema']} via {sc['connection']}"
        
        return f"""You are generating a progress update for a user working with a {context['agent_type']} agent.

Current Operation: {context['operation_type']}
User Message: "{context['message']}"
Processing Stage: {context['processing_stage']}
Current Step: {step or 'N/A'}

{session_info}
{data_details}

Generate a brief, informative progress message (1-2 sentences) that:
1. Shows what's currently happening with specific data details when available
2. Uses actual table names, column counts, and database details from the context
3. Is professional but engaging 
4. Gives confidence that meaningful progress is being made
5. Avoids generic phrases like "processing..." or "analyzing..."

Examples of good messages:
- "Connecting to CORRESPONDENT_DB and scanning 5 loan tables for metadata structure..."
- "AI is examining HMDA_SAMPLE's 78 columns to identify measures and dimensions for mortgage compliance reporting..."
- "Analyzing relationship patterns between BORROWER_INFO and LOAN_DETAILS tables with 156 combined fields..."

Progress message:"""
    
    def _generate_fallback_message(self, context: Dict[str, Any], step: str) -> str:
        """Generate fallback message when AI generation fails"""
        
        operation = context["operation_type"]
        data_ctx = context["data_context"]
        
        if operation == "database_listing":
            db = context["session_context"].get("database", "database")
            return f"Connecting to {db} and listing available schemas..."
            
        elif operation == "semantic_generation" and data_ctx.get("table_count"):
            count = data_ctx["table_count"]
            cols = data_ctx["total_columns"]
            return f"AI is analyzing {count} tables with {cols} columns for semantic modeling..."
            
        elif operation == "schema_analysis" and data_ctx.get("table_names"):
            tables = ", ".join(data_ctx["table_names"][:2])
            return f"Examining table structure for {tables} and related metadata..."
            
        else:
            # Generic fallback
            agent = context["agent_type"]
            return f"Processing {agent} operation with current data context..."


# Utility functions for integration with existing progress system
def generate_dynamic_progress_fire_and_forget(agent_type: str, 
                                             openai_client,
                                             session_context: Dict[str, Any],
                                             message: str,
                                             current_data: Optional[Dict] = None,
                                             step: str = None,
                                             callback=None) -> None:
    """Fire-and-forget function to generate dynamic progress message - never blocks"""
    
    try:
        manager = DynamicProgressManager(agent_type, openai_client)
        context = manager.extract_operation_context(session_context, message, current_data)
        manager.generate_contextual_progress_message_async(context, step, callback)
    except Exception as e:
        logger.debug(f"Dynamic progress setup failed (non-critical): {e}")
        # If setup fails, just call callback with basic fallback
        if callback:
            fallback = f"Processing {agent_type} operation..."
            callback(fallback)


def extract_session_context_from_agent(agent) -> Dict[str, Any]:
    """Extract session context from datamodel agent"""
    try:
        # Try to get session from agent
        session = None
        if hasattr(agent, '_current_session') and agent._current_session:
            session = agent._current_session
        elif hasattr(agent, 'sessions') and agent.sessions:
            # Get the most recent session if available
            sessions = agent.sessions
            if sessions:
                session = list(sessions.values())[-1]  # Get last session
        
        if session:
            context = {
                "current_database": getattr(session, 'current_database', None),
                "current_schema": getattr(session, 'current_schema', None), 
                "connection_id": getattr(session, 'connection_id', None),
                "selected_tables": getattr(session, 'selected_tables', [])
            }
            
            # If database is still None, try to get from connection
            if not context["current_database"] and hasattr(session, 'snowflake_connection'):
                try:
                    # Try to extract from connection object
                    conn = session.snowflake_connection
                    if hasattr(conn, 'database'):
                        context["current_database"] = conn.database
                except Exception as e:
                    logger.debug(f"Could not extract database from connection: {e}")
            
            return context
            
    except Exception as e:
        logger.debug(f"Could not extract session context: {e}")
    
    # Fallback to basic context
    return {
        "current_database": "database",
        "current_schema": "schema", 
        "connection_id": "connection",
        "selected_tables": []
    }