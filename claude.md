# LoanSphere Async Processing Implementation

## Overview
This document describes the universal async processing system implemented to handle long-running AI operations in both local development and Railway production environments.

## Problem Solved
- **Railway timeout issues**: Railway has ~30 second request timeout limits, but AI semantic model generation takes 3-5 minutes
- **Poor user experience**: Users saw blank loading screens for 4+ minutes with no feedback
- **502 Gateway timeouts**: Long requests would fail with "Application failed to respond" errors

## Solution: Universal Async Job Processing

### Backend Implementation
**File:** `server/routers/ai_agent.py`

#### New Endpoints:
```python
# Start async job - returns immediately with job ID
POST /api/ai-agent/datamodel/chat/async
{
  "session_id": "datamodel_session_id",
  "message": "2"  # table selection
}
# Response: {"job_id": "uuid", "status": "processing"}

# Poll job status and get results
GET /api/ai-agent/datamodel/job/{job_id}
# Response: 
# - Processing: {"job_id": "uuid", "status": "processing"}
# - Completed: {"job_id": "uuid", "status": "completed", "result": {...}}
# - Failed: {"job_id": "uuid", "status": "failed", "error": "..."}
```

#### Job Tracking:
```python
_async_jobs = {}  # job_id -> {status, result, error, started_at}
```

### Frontend Implementation  
**File:** `client/src/pages/ai-assistant.tsx`

#### Smart Operation Detection:
```javascript
const isLongRunningOperation = outgoing.toLowerCase().includes('generate') || 
                              outgoing === '2' || 
                              outgoing.toLowerCase().includes('hmda') ||
                              // ... other table names
```

#### Async Flow:
1. **Start job** with 30 second timeout
2. **Poll every 5 seconds** for up to 5 minutes
3. **Progressive status messages** every 30 seconds:
   - "Starting data analysis..."
   - "Analyzing table structures and collecting metadata..."  
   - "Preparing AI analysis with chain-of-thought reasoning..."
   - "Starting OpenAI analysis - this is where the magic happens..."
   - "AI is thinking through your data structure step by step..."
   - "Receiving AI response stream..."
   - "Parsing AI-generated semantic model..."
   - "Finalizing semantic model structure..."

#### Sync Flow:
Quick operations (databases, schemas, stages) use regular synchronous requests with 30 second timeout.

## API Configuration
**File:** `client/src/lib/api.ts`

```javascript
// Universal base URL handling
const baseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
```

- **Local development**: Direct connection to `localhost:8000` (bypasses Vite proxy timeout issues)
- **Railway production**: Uses relative URLs (same origin)

## Benefits

### ✅ Reliability
- No more Railway 502 timeouts
- Handles network issues gracefully during polling
- Self-cleaning job tracking (completed jobs are removed)

### ✅ User Experience  
- Progressive status messages instead of blank loading screens
- Clear error handling with specific error messages
- Consistent behavior across all environments

### ✅ Maintainability
- Same implementation for local and production
- No environment-specific code branches
- Easy to extend for other long-running operations

## Usage Examples

### Long-running operation (table selection):
```
User: "2" (selects HMDA_SAMPLE table)
→ Async processing
→ Progressive status messages
→ Result after 3-4 minutes
```

### Quick operation (list databases):
```
User: "show databases"  
→ Synchronous processing
→ Result in 5-10 seconds
```

## Development Commands

### Local Development:
```bash
# Frontend (with direct backend connection)
npm run dev:client

# Backend  
npm run python
```

### Railway Deployment:
- Uses same code
- Async processing prevents timeouts
- No special configuration needed

## Future Enhancements
- Add job progress percentage tracking
- Implement job cancellation
- Add job history/logging
- Scale to Redis for multi-instance deployments

## Related Files
- `server/routers/ai_agent.py` - Async endpoints
- `client/src/pages/ai-assistant.tsx` - Frontend async handling  
- `client/src/lib/api.ts` - Universal API client
- `server/src/functions/intelligent_semantic_functions.py` - AI processing (progress logging)

---
*Generated with Claude Code - This implementation ensures reliable long-running AI operations in both development and production environments.*