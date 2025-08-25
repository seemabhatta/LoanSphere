import os
import asyncio
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from loguru import logger

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./loan_boarding.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

async def init_db():
    """Initialize database with tables"""
    try:
        # Import all models to ensure they're registered
        from models import Base, LoanModel, ExceptionModel, AgentModel, ComplianceEventModel, DocumentModel, MetricModel, PipelineActivityModel, StagedFileModel, ProcessedDocumentModel, LoanTrackingModel
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        # Initialize default agents if they don't exist
        db = SessionLocal()
        try:
            initialize_default_agents(db)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error initializing default data: {e}")
        finally:
            db.close()
            
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

def initialize_default_agents(db):
    """Initialize default agents in the database"""
    from models import AgentModel
    
    default_agents = [
        {
            "name": "PlannerAgent",
            "type": "planner",
            "status": "idle",
            "description": "Task orchestration and workflow planning",
        },
        {
            "name": "ToolAgent", 
            "type": "tool",
            "status": "idle",
            "description": "Pipeline execution and data processing",
        },
        {
            "name": "VerifierAgent",
            "type": "verifier", 
            "status": "idle",
            "description": "Rule validation and compliance checking",
        },
        {
            "name": "DocumentAgent",
            "type": "document",
            "status": "idle", 
            "description": "OCR, classification, and data extraction",
        }
    ]
    
    for agent_data in default_agents:
        existing = db.query(AgentModel).filter_by(name=agent_data["name"]).first()
        if not existing:
            agent = AgentModel(**agent_data)
            db.add(agent)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
