"""
Unified Agent Router for LoanSphere
Simplified single router that handles all agent interactions
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from loguru import logger

from services.unified_agent_service import get_unified_agent_service, RequestContext

router = APIRouter()


# Request/Response Models
class ChatRequest(BaseModel):
    mode: str
    message: str
    connection_id: Optional[str] = None
    session_id: Optional[str] = None
    user_id: str = "default"
    metadata: Dict[str, Any] = {}


class ChatResponse(BaseModel):
    response: str
    mode: str
    connection_id: Optional[str] = None
    session_id: Optional[str] = None
    context: Dict[str, Any] = {}


class AgentModeInfo(BaseModel):
    mode: str
    requires_connection: bool
    timeout: int
    description: str


class AvailableModesResponse(BaseModel):
    modes: List[AgentModeInfo]


# Endpoints
@router.get("/modes", response_model=AvailableModesResponse)
async def get_available_modes():
    """Get all available agent modes"""
    try:
        service = get_unified_agent_service()
        modes = []
        
        for mode in service.get_available_modes():
            mode_info = service.get_mode_info(mode)
            modes.append(AgentModeInfo(**mode_info))
        
        return AvailableModesResponse(modes=modes)
        
    except Exception as e:
        logger.error(f"Error getting available modes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Synchronous chat endpoint for quick operations"""
    try:
        service = get_unified_agent_service()
        context = RequestContext(
            mode=request.mode,
            connection_id=request.connection_id,
            session_id=request.session_id,
            user_id=request.user_id,
            metadata=request.metadata
        )
        
        # Validate mode
        if context.mode not in service.get_available_modes():
            raise HTTPException(status_code=400, detail=f"Invalid agent mode: {context.mode}")
        
        # Check connection requirement
        mode_info = service.get_mode_info(context.mode)
        if mode_info["requires_connection"] and not context.connection_id:
            raise HTTPException(status_code=400, detail=f"Agent mode '{context.mode}' requires a connection_id")
        
        response = await service.chat(request.message, context)
        
        return ChatResponse(
            response=response,
            mode=context.mode,
            connection_id=context.connection_id,
            session_id=context.session_id,
            context=context.to_dict()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/simple")
async def simple_chat(request: ChatRequest):
    """Simple chat endpoint - no streaming, just direct response"""
    try:
        service = get_unified_agent_service()
        context = RequestContext(
            mode=request.mode,
            connection_id=request.connection_id,
            session_id=request.session_id,
            user_id=request.user_id,
            metadata=request.metadata
        )
        
        # Validate mode
        if context.mode not in service.get_available_modes():
            raise HTTPException(status_code=400, detail=f"Invalid agent mode: {context.mode}")
        
        # Check connection requirement
        mode_info = service.get_mode_info(context.mode)
        if mode_info["requires_connection"] and not context.connection_id:
            raise HTTPException(status_code=400, detail=f"Agent mode '{context.mode}' requires a connection_id")
        
        logger.info(f"[Simple] Starting {context.mode} agent chat")
        
        # Get simple response without streaming
        response = await service.chat(request.message, context)
        
        logger.info(f"[Simple] Completed {context.mode} agent chat")
        
        return ChatResponse(
            response=response,
            mode=context.mode,
            connection_id=context.connection_id,
            session_id=context.session_id,
            context=context.to_dict()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in simple chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        service = get_unified_agent_service()
        modes = service.get_available_modes()
        
        return {
            "status": "healthy",
            "available_modes": modes,
            "agents_sdk_available": True  # Will be False if SDK import failed
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "agents_sdk_available": False
        }


# Backward compatibility endpoints (optional - for gradual migration)
@router.post("/datamodel/start")
async def datamodel_start_compat(connection_id: str):
    """Backward compatibility for datamodel session start"""
    try:
        # In the new system, we don't need to "start" sessions
        # Just validate that the connection exists
        service = get_unified_agent_service()
        context = RequestContext(mode="datamodel", connection_id=connection_id)
        
        # This will validate the connection exists
        await service.get_or_create_agent(context)
        
        # Return a fake session_id for compatibility
        session_id = f"datamodel_{connection_id}_{int(asyncio.get_event_loop().time())}"
        
        return {
            "session_id": session_id,
            "message": "Session ready (using unified agent service)"
        }
        
    except Exception as e:
        logger.error(f"Error in datamodel start: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/datamodel/chat")
async def datamodel_chat_compat(
    session_id: str,
    message: str
):
    """Backward compatibility for datamodel chat"""
    try:
        # Extract connection_id from session_id
        # Format: datamodel_{connection_id}_{timestamp}
        parts = session_id.split("_")
        if len(parts) >= 2 and parts[0] == "datamodel":
            connection_id = parts[1]
        else:
            raise HTTPException(status_code=400, detail="Invalid session_id format")
        
        # Use the unified chat system
        request = ChatRequest(
            mode="datamodel",
            message=message,
            connection_id=connection_id
        )
        
        response = await chat(request)
        
        # Return in old format
        return {
            "response": response.response,
            "session_id": session_id,
            "context": response.context
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in datamodel chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))