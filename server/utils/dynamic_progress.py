"""
Pure Instruction-Driven Progress System
Generates contextual progress messages using single LLM instruction - no hardcoded logic
"""
import asyncio
import os
from typing import Dict, Any, Optional
from loguru import logger


class DynamicProgressManager:
    """
    Pure instruction-driven progress message generation
    Single LLM call with context - no hardcoded logic patterns
    """
    
    def __init__(self, agent_type: str, openai_client):
        self.agent_type = agent_type
        self.openai_client = openai_client
    
    def generate_contextual_progress_message_async(self, context: Dict[str, Any], 
                                                  step: str = None, 
                                                  callback=None) -> None:
        """Generate progress message using pure instruction-driven approach"""
        
        async def _background_generation():
            # Single instruction to LLM - let AI interpret and execute
            prompt = f"""Generate a brief, professional progress update for a {self.agent_type} agent.

Current context:
{context}

Step: {step}

Requirements:
- 1-2 sentences maximum
- Reference specific details from context when available  
- Professional and informative tone
- Show meaningful progress
- Avoid generic phrases like "processing..." or "analyzing..."

Progress message:"""
            
            # Single LLM call - no validation, no logic, no templates
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.openai_client.responses.create(
                    model=os.getenv("OPENAI_MODEL"),
                    input=prompt
                )
            )
            
            message = response.output_text.strip()
            logger.debug(f"Generated progress: {message}")
            
            # Call callback with LLM result
            if callback:
                callback(message)
        
        # Fire and forget - succeed or fail cleanly
        asyncio.create_task(_background_generation())


# Utility functions for integration with existing progress system
def generate_dynamic_progress_fire_and_forget(agent_type: str, 
                                             openai_client,
                                             session_context: Dict[str, Any],
                                             message: str,
                                             current_data: Optional[Dict] = None,
                                             step: str = None,
                                             callback=None,
                                             job_id: str = None) -> None:
    """
    Intelligent fallback-only dynamic progress generation
    Only triggers when progress queue is stale - no hardcoded logic
    """
    
    # Check if queue-based system should handle this instead
    if job_id:
        try:
            # Import here to avoid circular dependency
            from server.routers.ai_agent import is_progress_queue_stale, get_queue_status
            
            queue_status = get_queue_status(job_id)
            logger.debug(f"Queue status for job {job_id}: {queue_status}")
            
            # Only generate dynamic progress if queue is stale
            if not is_progress_queue_stale(job_id):
                logger.debug(f"Skipping dynamic progress for job {job_id} - queue has recent meaningful updates")
                return
                
            logger.info(f"Generating fallback dynamic progress for stale queue: {job_id}")
            
        except ImportError:
            logger.warning("Could not import queue status functions - proceeding with dynamic progress")
    
    manager = DynamicProgressManager(agent_type, openai_client)
    
    # Enhanced callback to mark progress as fallback priority
    def intelligent_callback(generated_message: str):
        if callback:
            callback(generated_message)
        
        # If we have job_id, send to queue with fallback priority
        if job_id:
            try:
                from server.routers.ai_agent import update_job_progress
                update_job_progress(
                    job_id=job_id,
                    step=step or "processing",
                    message=generated_message,
                    percentage=50,  # Neutral percentage for fallback
                    priority="fallback"
                )
            except ImportError:
                logger.warning("Could not import update_job_progress - callback only")
    
    # Simply pass all context to LLM - let AI interpret everything
    context = {
        "agent_type": agent_type,
        "user_message": message,
        "session_context": session_context,
        "data_context": current_data,
        "step": step,
        "queue_status": "stale_fallback"  # Inform LLM this is fallback mode
    }
    
    manager.generate_contextual_progress_message_async(context, step, intelligent_callback)


def extract_session_context_from_agent(agent) -> Dict[str, Any]:
    """Extract session context - minimal extraction, let LLM interpret what's available"""
    
    # Get session from agent
    session = None
    if hasattr(agent, '_current_session') and agent._current_session:
        session = agent._current_session
    elif hasattr(agent, 'sessions') and agent.sessions:
        sessions = agent.sessions
        if sessions:
            session = list(sessions.values())[-1]  # Get last session
    
    if not session:
        raise ValueError("No session available from agent")
    
    # Extract all available attributes - let LLM decide what's relevant
    context = {}
    
    # Get basic session attributes
    for attr in ['current_database', 'current_schema', 'connection_id', 'selected_tables']:
        if hasattr(session, attr):
            context[attr] = getattr(session, attr)
    
    # Get connection info if available
    if hasattr(session, 'snowflake_connection'):
        conn = session.snowflake_connection
        if hasattr(conn, 'database'):
            context['connection_database'] = conn.database
    
    return context