# SSE Unification Plan

## Objective
Unify both initialization and chat endpoints to use the same simple SSE streaming pattern, eliminating complex async job system and creating foundation for consistent overlay UI.

## Current State Analysis

### Initialization SSE (`/datamodel/progress/{session_id}`)
✅ **Working Well**:
- Simple ThreadPoolExecutor pattern
- Direct SSE streaming with real-time progress
- Clean message format: `{'type': 'auto_init', 'message': '...'}`
- No complex state management
- Reliable user experience

### Chat System (`/datamodel/chat/async` + polling)
❌ **Overly Complex**:
- Async job system with global state (`_async_jobs`)
- Polling-based progress updates
- Complex job lifecycle management
- Multiple endpoints for single operation
- Inconsistent with initialization pattern

## Phase 1: Unify to Initialization Pattern

### Step 1: Remove Complex Chat Async System
**Delete these components**:
- `/datamodel/chat/async` endpoint
- `/datamodel/job/{job_id}` endpoint  
- `_async_jobs` global state
- `update_job_progress()` function
- `get_current_job_id()` / `set_current_job_id()` functions
- All job progress infrastructure

### Step 2: Create Simple Chat SSE Endpoint
**New endpoint**: `/datamodel/chat/stream/{session_id}`

**Pattern** (copy from initialization):
```python
@router.get("/datamodel/chat/stream/{session_id}")
async def stream_datamodel_chat(session_id: str, message: str):
    """Simple SSE stream for chat - same pattern as initialization"""
    
    async def chat_event_stream():
        try:
            datamodel_agent = get_datamodel_agent()
            
            if datamodel_agent and session_id in datamodel_agent.sessions:
                # Same ThreadPoolExecutor pattern as initialization
                from concurrent.futures import ThreadPoolExecutor
                
                loop = asyncio.get_event_loop()
                executor = ThreadPoolExecutor(max_workers=1)
                
                # Start chat task
                chat_task = loop.run_in_executor(
                    executor,
                    datamodel_agent.chat_sync,
                    session_id,
                    message
                )
                
                # Progress updates while waiting (same pattern as init)
                progress_count = 0
                yield f"data: {json.dumps({'type': 'chat_progress', 'message': '🤔 Processing your request...'})}\n\n"
                
                while not chat_task.done():
                    await asyncio.sleep(10)
                    progress_count += 1
                    
                    if progress_count == 1:
                        yield f"data: {json.dumps({'type': 'chat_progress', 'message': '🧠 Analyzing your request...'})}\n\n"
                    elif progress_count == 2:
                        yield f"data: {json.dumps({'type': 'chat_progress', 'message': '⚡ Generating response...'})}\n\n"
                    # ... more progress messages
                
                # Get result
                response = await chat_task
                
                # Final result
                yield f"data: {json.dumps({'type': 'chat_result', 'data': response})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Error: {str(e)}'})}\n\n"
    
    return StreamingResponse(
        chat_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive", 
            "Access-Control-Allow-Origin": "*",
        }
    )
```

### Step 3: Frontend Changes
**Update chat UI to use SSE**:
- Replace async job polling with SSE EventSource
- Use same SSE client pattern as initialization
- Handle `chat_progress` and `chat_result` message types
- Remove job polling logic

## Phase 2: Overlay Implementation (Future)

### Step 1: Standardize Message Types
- Initialization: `{'type': 'progress', 'message': '...'}`
- Chat: `{'type': 'progress', 'message': '...'}`
- Results: `{'type': 'result', 'data': ...}`

### Step 2: Unified Overlay UI
- Both initialization and chat show progress in overlay
- Remove chat bubble progress display
- Consistent progress indicator across all agent operations

## Benefits

### Immediate (Phase 1)
- **Simplified Architecture**: Single SSE pattern instead of mixed polling/streaming
- **Consistent UX**: Same progress experience for both initialization and chat
- **Reduced Complexity**: Eliminate async job management overhead
- **Better Reliability**: Proven initialization pattern applied to chat
- **Easier Maintenance**: One SSE pattern to maintain instead of two systems

### Future (Phase 2)
- **Unified UI**: Consistent overlay progress for all operations
- **Scalable Pattern**: Easy to add more agent operations with same SSE pattern
- **Clean Codebase**: No mixed async/polling patterns

## Implementation Checklist

### Phase 1
- [ ] Remove `/datamodel/chat/async` endpoint
- [ ] Remove async job infrastructure (`_async_jobs`, progress functions)
- [ ] Create `/datamodel/chat/stream/{session_id}` endpoint using initialization pattern
- [ ] Add `datamodel_agent.chat_sync()` method if needed
- [ ] Update frontend to use SSE for chat instead of polling
- [ ] Test unified SSE pattern works for both initialization and chat

### Phase 2 (Future)
- [ ] Standardize message types across both endpoints
- [ ] Implement overlay UI for both initialization and chat
- [ ] Remove chat bubble progress display
- [ ] Ensure consistent progress messaging format

## Success Criteria
- Both initialization and chat use identical SSE streaming pattern
- No async job polling system remains
- Frontend shows consistent progress experience
- Foundation established for unified overlay UI