# AI Assistant 3 - Minimal Integration Plan for Datamind CLI Agents

## Overview
Create a minimal UI entry point for the datamind CLI agents, exposing them as APIs while preserving their auto-initialization behavior.

## Key Insight
The datamind CLI agents **auto-initialize** on startup:
- **Query Agent**: Connects to Snowflake → explores databases → finds YAML files → ready for queries
- **Generate Agent**: Connects to Snowflake → explores databases → shows tables → ready for dictionary generation

## Implementation Approach

### 1. Backend API Wrapper (`server/routers/datamind_api.py`)
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
import sys
import time
sys.path.append('server/datamind-master/datamind-master')

from agents import Runner
from agents.memory.session import SQLiteSession

# Import the pre-configured agents
from src.cli.agentic_query_cli import snowflake_agent
from src.cli.agentic_generate_yaml_cli import dictionary_agent

router = APIRouter()

# Store active sessions with their agents
agent_sessions = {}

class DatamindRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    mode: str  # "query" or "generate"

class DatamindResponse(BaseModel):
    response: str
    session_id: str
    initialized: bool

@router.post("/datamind/chat")
async def datamind_chat(request: DatamindRequest):
    """Single endpoint for both agents"""
    
    # Generate or get session ID
    session_id = request.session_id or f"{request.mode}_{int(time.time())}"
    
    # Check if this is a new session
    if session_id not in agent_sessions:
        # Create new session
        session = SQLiteSession(session_id)
        
        # Select agent based on mode
        if request.mode == "query":
            agent = snowflake_agent
            init_prompt = "Please connect to Snowflake, navigate to the available databases and schemas, find the stage with YAML files, and show me the available YAML data dictionaries so I can select one to work with."
        else:  # generate
            agent = dictionary_agent  
            init_prompt = "Please connect to Snowflake and guide me through selecting a database, schema, and tables to create a data dictionary"
        
        # Auto-initialize the agent
        init_result = Runner.run_sync(agent, init_prompt, session=session)
        
        # Store session info
        agent_sessions[session_id] = {
            "session": session,
            "agent": agent,
            "mode": request.mode,
            "initialized": True
        }
        
        # If this was just initialization, return init message
        if not request.message or request.message == "[INIT]":
            return DatamindResponse(
                response=init_result.final_output,
                session_id=session_id,
                initialized=True
            )
        
        # Otherwise, also process the user's message
        result = Runner.run_sync(agent, request.message, session=session)
        return DatamindResponse(
            response=f"{init_result.final_output}\n\n{result.final_output}",
            session_id=session_id,
            initialized=True
        )
    
    else:
        # Use existing session
        session_info = agent_sessions[session_id]
        result = Runner.run_sync(
            session_info["agent"], 
            request.message, 
            session=session_info["session"]
        )
        
        return DatamindResponse(
            response=result.final_output,
            session_id=session_id,
            initialized=True
        )

@router.delete("/datamind/session/{session_id}")
async def clear_session(session_id: str):
    """Clear a specific session"""
    if session_id in agent_sessions:
        del agent_sessions[session_id]
    return {"status": "cleared"}
```

### 2. Minimal Frontend Page (`client/src/pages/ai-assistant-3.tsx`)
```tsx
import { useState, useEffect } from 'react';

export default function AIAssistant3() {
  const [mode, setMode] = useState<'query' | 'generate'>('query');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Auto-initialize when mode changes
  useEffect(() => {
    initializeAgent();
  }, [mode]);
  
  const initializeAgent = async () => {
    setIsInitializing(true);
    setMessages([]);
    setSessionId(null);
    
    const response = await fetch('/api/datamind/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '[INIT]',
        mode: mode
      })
    });
    
    const data = await response.json();
    setSessionId(data.session_id);
    setMessages([
      { type: 'assistant', content: data.response }
    ]);
    setIsInitializing(false);
  };
  
  const sendMessage = async () => {
    if (!input.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { type: 'user', content: input }]);
    
    // Send to API
    const response = await fetch('/api/datamind/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input,
        mode: mode,
        session_id: sessionId
      })
    });
    
    const data = await response.json();
    
    // Add assistant response
    setMessages(prev => [...prev, { type: 'assistant', content: data.response }]);
    setInput('');
  };
  
  return (
    <div>
      {/* Mode selector */}
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="query">Natural Language Query</option>
        <option value="generate">Dictionary Generator</option>
      </select>
      
      {/* Chat messages */}
      <div className="messages">
        {isInitializing && <div>Initializing {mode} agent...</div>}
        {messages.map((msg, i) => (
          <div key={i} className={msg.type}>
            {msg.content}
          </div>
        ))}
      </div>
      
      {/* Input */}
      <input 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        placeholder={
          mode === 'query' 
            ? "Ask about your data..."
            : "Select tables to generate dictionary..."
        }
        disabled={isInitializing}
      />
      <button onClick={sendMessage} disabled={isInitializing}>Send</button>
    </div>
  );
}
```

### 3. Update Main Router (`server/main.py`)
```python
from routers import datamind_api
app.include_router(datamind_api.router, prefix="/api")
```

### 4. Navigation Update (`client/src/components/sidebar.tsx`)
Add to OVERVIEW section:
```tsx
{ 
  name: "Datamind Assistant", 
  href: "/ai-assistant-3", 
  icon: Sparkles, 
  description: "Snowflake query & dictionary tools" 
}
```

### 5. Add Route (`client/src/App.tsx`)
```tsx
import AIAssistant3 from "@/pages/ai-assistant-3";

// Add route
<Route path="/ai-assistant-3">
  <AIAssistant3 />
</Route>
```

## How It Works

1. **User selects mode** (Query or Generate)
2. **Frontend automatically sends [INIT]** message
3. **Backend creates new session** and runs auto-initialization:
   - Query mode: Connects → explores → finds YAML files
   - Generate mode: Connects → shows databases/schemas/tables
4. **User sees initialization output** (available YAMLs or tables)
5. **User continues conversation** with the initialized agent
6. **Session persists** until cleared or mode changed

## Key Benefits

1. **Preserves CLI Behavior**: Auto-initialization works exactly like CLI
2. **Minimal Code Changes**: Datamind code untouched
3. **Simple API**: One endpoint handles everything
4. **Session Management**: Built-in session persistence
5. **Mode Switching**: Easy to switch between query and generate

## Files to Create

1. `server/routers/datamind_api.py` - API wrapper (thin layer)
2. `client/src/pages/ai-assistant-3.tsx` - Simple UI page
3. Update `server/main.py` - Add router
4. Update `client/src/App.tsx` - Add route
5. Update `client/src/components/sidebar.tsx` - Add nav link

## Environment Setup
Ensure `.env` file in datamind directory has:
```env
OPENAI_API_KEY=xxx
SNOWFLAKE_USER=xxx
SNOWFLAKE_PASSWORD=xxx
SNOWFLAKE_ACCOUNT=xxx
SNOWFLAKE_WAREHOUSE=xxx
```

## Testing
1. Start server with datamind API router
2. Navigate to /ai-assistant-3
3. Select "Query" mode - should auto-connect and show YAMLs
4. Select "Generate" mode - should auto-connect and show tables
5. Continue conversations in each mode