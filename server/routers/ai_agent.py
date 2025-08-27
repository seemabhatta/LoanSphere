"""
AI Agent Router for LoanSphere
Provides chat endpoint for conversational AI interface to query loan data
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from loguru import logger

from services.ai_agent_service import get_ai_agent

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


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
        
        # Use async chat to avoid nested event loop issues
        response = await agent.chat_async(chat_request.message, session_id=session_id)
        
        return ChatResponse(response=response, session_id=session_id)
        
    except Exception as e:
        logger.error(f"Error in agent chat: {e}")
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")
