"""
AI Agent Router for LoanSphere
Provides chat endpoint for conversational AI interface to query loan data
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, AsyncGenerator
from loguru import logger
import asyncio
import json

from services.ai_agent_service import get_ai_agent
from services.datamodel_agent_service import get_datamodel_agent

router = APIRouter()

# Global progress tracking for sessions
_progress_streams = {}


class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    page: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    visualization: Optional[Dict[str, Any]] = None


# @datamodel Agent Models
class DataModelStartRequest(BaseModel):
    connection_id: str


class DataModelStartResponse(BaseModel):
    session_id: str
    connection_name: str
    initialization_message: str


class DataModelChatRequest(BaseModel):
    session_id: str
    message: str


class DataModelChatResponse(BaseModel):
    response: str
    session_id: str
    context: Dict[str, Any]


class DataModelContextResponse(BaseModel):
    connection_id: Optional[str] = None
    current_database: Optional[str] = None
    current_schema: Optional[str] = None
    selected_tables: list[str] = []
    yaml_ready: bool = False


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


# @datamodel Agent Endpoints

@router.post("/datamodel/start", response_model=DataModelStartResponse)
async def start_datamodel_agent(request: DataModelStartRequest):
    """Start a new @datamodel agent session"""
    try:
        datamodel_agent = get_datamodel_agent()
        session_id = datamodel_agent.start_session(request.connection_id)
        connection_info = datamodel_agent.get_connection_info(request.connection_id)
        
        # Get auto-initialization response like DataMind CLI
        initialization_message = await datamodel_agent.get_initialization_response(session_id)
        
        return DataModelStartResponse(
            session_id=session_id,
            connection_name=connection_info["name"],
            initialization_message=initialization_message
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error starting @datamodel agent session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")


@router.post("/datamodel/chat", response_model=DataModelChatResponse)
async def chat_datamodel_agent(request: DataModelChatRequest):
    """Handle chat message in @datamodel agent session"""
    try:
        datamodel_agent = get_datamodel_agent()
        response = await datamodel_agent.chat(request.session_id, request.message)
        context = datamodel_agent.get_session_context(request.session_id)
        
        return DataModelChatResponse(
            response=response,
            session_id=request.session_id,
            context={
                "connection_id": context.connection_id,
                "current_database": context.current_database,
                "current_schema": context.current_schema,
                "selected_tables": context.selected_tables,
                "yaml_ready": bool(context.dictionary_content)
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error in @datamodel agent chat: {e}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.get("/datamodel/progress/{session_id}")
async def stream_datamodel_progress(session_id: str):
    """Stream real-time progress updates for @datamodel operations"""
    
    async def generate_progress_stream():
        """Generate SSE stream for progress updates"""
        logger.info(f"[SSE] Starting progress stream for session {session_id}")
        try:
            # Initialize progress stream for this session
            if session_id not in _progress_streams:
                _progress_streams[session_id] = asyncio.Queue()
                logger.info(f"[SSE] Created new progress queue for session {session_id}")
            else:
                logger.info(f"[SSE] Using existing progress queue for session {session_id}")
            
            queue = _progress_streams[session_id]
            logger.info(f"[SSE] Progress stream initialized, queue size: {queue.qsize()}")
            
            # Send initial connection message
            connection_msg = json.dumps({'type': 'connected', 'session_id': session_id, 'message': 'Progress stream connected'})
            yield f"data: {connection_msg}\n\n"
            logger.info(f"[SSE] Sent connection message for session {session_id}")
            
            # Keep the stream alive for a reasonable amount of time
            max_idle_time = 300  # 5 minutes
            idle_count = 0
            
            while idle_count < max_idle_time:
                try:
                    # Wait for progress updates with timeout
                    progress_data = await asyncio.wait_for(queue.get(), timeout=1.0)
                    progress_msg = json.dumps(progress_data)
                    yield f"data: {progress_msg}\n\n"
                    logger.info(f"[SSE] Sent progress message for session {session_id}: {progress_data.get('message', 'No message')}")
                    idle_count = 0  # Reset idle counter when we get a message
                except asyncio.TimeoutError:
                    # Send keep-alive ping and increment idle counter
                    ping_msg = json.dumps({'type': 'ping', 'timestamp': asyncio.get_event_loop().time()})
                    yield f"data: {ping_msg}\n\n"
                    logger.debug(f"[SSE] Sent ping for session {session_id}, idle count: {idle_count}")
                    idle_count += 1
                except Exception as e:
                    logger.error(f"[SSE] Error in progress stream: {e}")
                    break
            
            logger.info(f"[SSE] Stream for session {session_id} timed out after {max_idle_time} seconds")
                    
        except Exception as e:
            logger.error(f"[SSE] Progress stream error: {e}")
            error_msg = json.dumps({'type': 'error', 'message': str(e)})
            yield f"data: {error_msg}\n\n"
        finally:
            # Clean up - but only if the stream was actually closed by the client
            logger.info(f"[SSE] Stream for session {session_id} ended, cleaning up")
            if session_id in _progress_streams:
                del _progress_streams[session_id]
                logger.info(f"[SSE] Cleaned up stream for session {session_id}")
    
    return StreamingResponse(
        generate_progress_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        }
    )


def send_progress_update(session_id: str, progress_type: str, message: str, data: dict = None):
    """Helper function to send progress updates to SSE stream"""
    logger.info(f"[SSE] Attempting to send progress update for session {session_id}: {message}")
    
    if session_id in _progress_streams:
        update = {
            'type': progress_type,
            'message': message,
            'timestamp': asyncio.get_event_loop().time()
        }
        if data:
            update.update(data)
        
        try:
            _progress_streams[session_id].put_nowait(update)
            logger.info(f"[SSE] Successfully queued progress update for session {session_id}")
        except Exception as e:
            logger.error(f"[SSE] Failed to queue progress update: {e}")
    else:
        logger.warning(f"[SSE] No progress stream found for session: {session_id}. Available streams: {list(_progress_streams.keys())}")


@router.post("/datamodel/test-progress/{session_id}")
async def test_progress_updates(session_id: str):
    """Test endpoint to manually send progress updates"""
    logger.info(f"[SSE TEST] Testing progress updates for session {session_id}")
    
    # Send a test progress update
    send_progress_update(session_id, 'progress', 'Test progress message', {'test': True})
    
    return {"status": "sent", "session_id": session_id, "available_streams": list(_progress_streams.keys())}


@router.get("/datamodel/context", response_model=DataModelContextResponse)
async def get_datamodel_context(session_id: str):
    """Get current context for @datamodel agent session"""
    try:
        datamodel_agent = get_datamodel_agent()
        context = datamodel_agent.get_session_context(session_id)
        
        return DataModelContextResponse(
            connection_id=context.connection_id,
            current_database=context.current_database,
            current_schema=context.current_schema,
            selected_tables=context.selected_tables,
            yaml_ready=bool(context.dictionary_content)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting @datamodel context: {e}")
        raise HTTPException(status_code=500, detail=f"Context error: {str(e)}")


@router.post("/datamodel/download")
async def download_datamodel_yaml(request: Dict[str, str]):
    """Download the generated YAML dictionary file"""
    from fastapi import Response
    
    try:
        session_id = request.get("session_id")
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")
        
        datamodel_agent = get_datamodel_agent()
        yaml_bytes, filename = datamodel_agent.download_yaml_dictionary(session_id)
        
        return Response(
            content=yaml_bytes,
            media_type="application/x-yaml",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error downloading @datamodel YAML: {e}")
        raise HTTPException(status_code=500, detail=f"Download error: {str(e)}")


@router.delete("/datamodel/session")
async def delete_datamodel_session(session_id: str):
    """Delete a @datamodel agent session"""
    try:
        datamodel_agent = get_datamodel_agent()
        success = datamodel_agent.delete_session(session_id)
        
        return {"ok": success}
        
    except Exception as e:
        logger.error(f"Error deleting @datamodel session: {e}")
        raise HTTPException(status_code=500, detail=f"Delete error: {str(e)}")
