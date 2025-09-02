# Simple SSE endpoint - replace the complex one

@router.get("/datamodel/progress/{session_id}")
async def stream_datamodel_progress(session_id: str):
    """Simple SSE stream - no queues, direct message sending"""
    
    async def simple_event_stream():
        logger.info(f"[SSE] Starting simple stream for session {session_id}")
        
        # Send connection message
        yield f"data: {json.dumps({'type': 'connected', 'message': 'SSE Connected'})}\n\n"
        
        # Get datamodel agent and start auto-init
        datamodel_agent = get_datamodel_agent()
        if datamodel_agent and session_id in datamodel_agent.sessions:
            session = datamodel_agent.sessions[session_id]
            
            # Start auto-init and send messages directly
            try:
                # Import SSE function
                from server.routers.ai_agent import send_progress_update
                
                # Set current session for tools
                datamodel_agent._current_session = session
                
                # Step 1
                yield f"data: {json.dumps({'type': 'auto_init', 'message': '🔗 Connecting To Snowflake...'})}\n\n"
                
                # Step 2  
                yield f"data: {json.dumps({'type': 'auto_init', 'message': '📡 Connecting to Snowflake...'})}\n\n"
                connect_result = datamodel_agent._connect_to_snowflake()
                
                # Step 3
                yield f"data: {json.dumps({'type': 'auto_init', 'message': '✅ Connected to Snowflake successfully!'})}\n\n"
                
                # Step 4
                yield f"data: {json.dumps({'type': 'auto_init', 'message': '📊 Scanning the DBs...'})}\n\n"
                databases_result = datamodel_agent._get_databases()
                
                # Step 5 - Final result
                yield f"data: {json.dumps({'type': 'auto_init', 'message': databases_result})}\n\n"
                
            except Exception as e:
                error_msg = f"⚠️ Connection issue: {str(e)}"
                yield f"data: {json.dumps({'type': 'auto_init', 'message': error_msg})}\n\n"
            finally:
                datamodel_agent._current_session = None
        
        # Keep stream alive
        while True:
            await asyncio.sleep(30)
            yield f"data: {json.dumps({'type': 'keepalive', 'timestamp': time.time()})}\n\n"
    
    return StreamingResponse(
        simple_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )