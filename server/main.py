from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager
import asyncio
import json
from datetime import datetime
from typing import List
import uvicorn
import os
from loguru import logger
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(dotenv_path="../.env")

# from database import init_db, get_db  # Using TinyDB instead
from routers import loans, exceptions, compliance, documents, metrics, staging, purchase_advices, commitments, auth, loan_data, ai_agent
from routers import settings_snowflake, settings_agent_config
from routers import graph as graph_router
from services.loan_service import LoanService

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connection established. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket connection closed. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")

manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Co-Issue Loan Boarding System")
    
    # Initialize SQLite for settings tables (TinyDB still used for app docs)
    from database import init_db
    await init_db()
    
    
    logger.info("System initialized successfully")
    yield
    
    # Shutdown
    logger.info("Shutting down Co-Issue Loan Boarding System")

app = FastAPI(
    title="Co-Issue Loan Boarding System",
    description="Multi-Agent Loan Boarding Automation Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Session middleware (required for OAuth)
app.add_middleware(
    SessionMiddleware, 
    secret_key=os.getenv("SESSION_SECRET", "your-secret-key-here")
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(loans.router, prefix="/api/loans", tags=["loans"])
app.include_router(exceptions.router, prefix="/api/exceptions", tags=["exceptions"])
app.include_router(compliance.router, prefix="/api/compliance", tags=["compliance"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])
app.include_router(staging.router, prefix="/api/simple", tags=["staging"])
app.include_router(staging.router, prefix="/api/staging", tags=["staging"])
app.include_router(purchase_advices.router, prefix="/api/purchase-advices", tags=["purchase-advices"])
app.include_router(commitments.router, prefix="/api/commitments", tags=["commitments"])
app.include_router(loan_data.router, prefix="/api/loan-data", tags=["loan-data"])
app.include_router(ai_agent.router, prefix="/api/ai-agent", tags=["ai-agent"])
app.include_router(graph_router.router, prefix="/api/graph", tags=["graph"])
app.include_router(settings_snowflake.router, prefix="/api", tags=["settings-snowflake"])
app.include_router(settings_agent_config.router, prefix="/api", tags=["settings-agent-config"])

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "ping":
                await manager.send_personal_message(
                    json.dumps({"type": "pong", "timestamp": datetime.now().isoformat()}),
                    websocket
                )
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/")
async def root():
    return {"message": "Co-Issue Loan Boarding System API", "status": "operational"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
