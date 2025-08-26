from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import json
from datetime import datetime
from typing import List
import uvicorn
import os
from loguru import logger

# from database import init_db, get_db  # Using TinyDB instead
from routers import loans, exceptions, agents, compliance, documents, metrics, staging, purchase_advices
from services.loan_service import LoanService
from agents.planner_agent import PlannerAgent
from agents.tool_agent import ToolAgent
from agents.verifier_agent import VerifierAgent
from agents.document_agent import DocumentAgent

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

# Initialize agents
agents_registry = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Co-Issue Loan Boarding System")
    
    # Initialize database - SKIPPED: Using TinyDB instead
    # await init_db()
    
    # Skip agent initialization - Using TinyDB staging directly
    # db = None  # Using TinyDB instead
    # loan_service = LoanService(db)
    # 
    # agents_registry["planner"] = PlannerAgent(loan_service, manager)
    # agents_registry["tool"] = ToolAgent(loan_service, manager)
    # agents_registry["verifier"] = VerifierAgent(loan_service, manager)
    # agents_registry["document"] = DocumentAgent(loan_service, manager)
    # 
    # # Start agent monitoring
    # asyncio.create_task(monitor_agents())
    
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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(loans.router, prefix="/api/loans", tags=["loans"])
app.include_router(exceptions.router, prefix="/api/exceptions", tags=["exceptions"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(compliance.router, prefix="/api/compliance", tags=["compliance"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])
app.include_router(staging.router, prefix="/api/simple", tags=["staging"])
app.include_router(staging.router, prefix="/api/staging", tags=["staging"])
app.include_router(purchase_advices.router, prefix="/api/purchase-advices", tags=["purchase-advices"])

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

async def monitor_agents():
    """Background task to monitor agent status and broadcast updates"""
    while True:
        try:
            # Collect agent statuses
            agent_statuses = []
            for name, agent in agents_registry.items():
                status = await agent.get_status()
                agent_statuses.append({
                    "name": name,
                    "status": status["status"],
                    "current_task": status.get("current_task"),
                    "last_activity": status.get("last_activity")
                })
            
            # Broadcast agent status update
            await manager.broadcast({
                "type": "agent_status_update",
                "data": agent_statuses,
                "timestamp": datetime.now().isoformat()
            })
            
            await asyncio.sleep(10)  # Update every 10 seconds
            
        except Exception as e:
            logger.error(f"Error in agent monitoring: {e}")
            await asyncio.sleep(30)

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
