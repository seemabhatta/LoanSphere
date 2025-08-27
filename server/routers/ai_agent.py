"""
AI Agent Router for LoanSphere
Provides chat endpoint for conversational AI interface to query loan data
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from loguru import logger

from services.ai_agent_service import get_ai_agent

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    page: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    visualization: Optional[Dict[str, Any]] = None


@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(chat_request: ChatMessage):
    """
    Chat with the AI agent to query loan data, purchase advice, and commitments
    """
    try:
        try:
            agent = get_ai_agent()
        except ImportError as ie:
            # AI not available in this deployment
            raise HTTPException(status_code=503, detail=str(ie))
        
        # Generate session_id if not provided
        session_id = chat_request.session_id
        if not session_id:
            import time
            session_id = f"loansphere_session_{int(time.time())}"
        
        # Use async chat and pass along optional UI context
        response_text = await agent.chat_async(
            chat_request.message,
            session_id=session_id,
            page=chat_request.page,
            page_context=chat_request.context,
        )
        # Try to extract an optional visualization from special code blocks
        viz = None
        try:
            import re, json
            m = re.search(r"```chart\s*(\{[\s\S]*?\})\s*```", response_text)
            if m:
                viz = json.loads(m.group(1))
            else:
                g = re.search(r"```graph\s*(\{[\s\S]*?\})\s*```", response_text)
                if g:
                    viz = json.loads(g.group(1))
                    if isinstance(viz, dict) and 'type' not in viz:
                        viz['type'] = 'graph'
        except Exception:
            viz = None

        return ChatResponse(response=response_text, session_id=session_id, visualization=viz)
        
    except Exception as e:
        logger.error(f"Error in agent chat: {e}")
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")
