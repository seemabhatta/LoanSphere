from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
import sys
import time
import os
import asyncio

# Add the datamind directory to Python path
datamind_path = os.path.join(os.path.dirname(__file__), '..', 'datamind-master', 'datamind-master')
sys.path.insert(0, datamind_path)

from agents import Runner
from agents.memory.session import SQLiteSession

# Import the pre-configured agents
from src.cli.agentic_query_cli import snowflake_agent
from src.cli.agentic_generate_yaml_cli import dictionary_agent

router = APIRouter()

# Store active sessions with their agents
agent_sessions = {}

def parse_visualization_data(response_text: str) -> tuple[str, Optional[Dict]]:
    """Extract visualization data from response text"""
    if '[CHART_HTML]' not in response_text:
        return response_text, None
    
    # Find and extract chart HTML
    start_marker = '[CHART_HTML]'
    end_marker = '[/CHART_HTML]'
    start_idx = response_text.find(start_marker)
    end_idx = response_text.find(end_marker)
    
    if start_idx == -1 or end_idx == -1:
        return response_text, None
    
    # Extract the HTML content
    chart_html = response_text[start_idx + len(start_marker):end_idx]
    
    # Remove the chart markers from the response text
    clean_response = response_text[:start_idx] + response_text[end_idx + len(end_marker):]
    clean_response = clean_response.strip()
    
    visualization_data = {
        "type": "plotly",
        "html": chart_html
    }
    
    return clean_response, visualization_data

class DatamindRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    mode: str  # "query" or "generate"

class DatamindResponse(BaseModel):
    response: str
    session_id: str
    initialized: bool
    visualization: Optional[Dict] = None

@router.post("/datamind/chat")
async def datamind_chat(request: DatamindRequest):
    """Single endpoint for both agents"""
    print(f"📥 Datamind chat request: mode={request.mode}, session_id={request.session_id}, message={request.message[:50]}...")
    
    # Generate or get session ID
    session_id = request.session_id or f"{request.mode}_{int(time.time())}"
    
    # Check if this is a new session
    if session_id not in agent_sessions:
        # Create new session
        session = SQLiteSession(session_id)
        
        # Select agent based on mode
        if request.mode == "query":
            agent = snowflake_agent
            # Lighter initialization - just connect, don't explore everything
            init_prompt = "Please connect to Snowflake and confirm you're ready to help with data queries."
        else:  # generate
            agent = dictionary_agent  
            # Lighter initialization - just connect, don't explore everything
            init_prompt = "Please connect to Snowflake and confirm you're ready to help generate data dictionaries."
        
        # Auto-initialize the agent with timeout handling
        try:
            # Set a 120-second timeout for initialization
            init_result = await asyncio.wait_for(
                Runner.run(agent, init_prompt, session=session),
                timeout=120.0
            )
        except asyncio.TimeoutError:
            return DatamindResponse(
                response=f"Timeout initializing {request.mode} agent. Please try again.",
                session_id=session_id,
                initialized=False,
                visualization=None
            )
        except Exception as e:
            return DatamindResponse(
                response=f"Error initializing {request.mode} agent: {str(e)}",
                session_id=session_id,
                initialized=False,
                visualization=None
            )
        
        # Store session info
        agent_sessions[session_id] = {
            "session": session,
            "agent": agent,
            "mode": request.mode,
            "initialized": True
        }
        
        # If this was just initialization, return init message
        if not request.message or request.message == "[INIT]":
            clean_response, visualization = parse_visualization_data(init_result.final_output)
            return DatamindResponse(
                response=clean_response,
                session_id=session_id,
                initialized=True,
                visualization=visualization
            )
        
        # Otherwise, also process the user's message
        try:
            result = await asyncio.wait_for(
                Runner.run(agent, request.message, session=session),
                timeout=180.0
            )
            combined_response = f"{init_result.final_output}\n\n{result.final_output}"
            clean_response, visualization = parse_visualization_data(combined_response)
            return DatamindResponse(
                response=clean_response,
                session_id=session_id,
                initialized=True,
                visualization=visualization
            )
        except asyncio.TimeoutError:
            return DatamindResponse(
                response=f"Timeout processing message. Please try again.",
                session_id=session_id,
                initialized=True,
                visualization=None
            )
        except Exception as e:
            return DatamindResponse(
                response=f"Error processing message: {str(e)}",
                session_id=session_id,
                initialized=True,
                visualization=None
            )
    
    else:
        # Use existing session
        session_info = agent_sessions[session_id]
        try:
            result = await asyncio.wait_for(
                Runner.run(
                    session_info["agent"], 
                    request.message, 
                    session=session_info["session"]
                ),
                timeout=180.0
            )
            clean_response, visualization = parse_visualization_data(result.final_output)
            return DatamindResponse(
                response=clean_response,
                session_id=session_id,
                initialized=True,
                visualization=visualization
            )
        except asyncio.TimeoutError:
            return DatamindResponse(
                response="Timeout processing message. Please try again.",
                session_id=session_id,
                initialized=True,
                visualization=None
            )
        except Exception as e:
            return DatamindResponse(
                response=f"Error processing message: {str(e)}",
                session_id=session_id,
                initialized=True,
                visualization=None
            )

@router.delete("/datamind/session/{session_id}")
async def clear_session(session_id: str):
    """Clear a specific session"""
    if session_id in agent_sessions:
        del agent_sessions[session_id]
    return {"status": "cleared"}