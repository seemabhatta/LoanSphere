import os
import asyncio
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from loguru import logger

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./loan_boarding.db")

# Only use check_same_thread=False for SQLite databases
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

async def init_db():
    """Initialize database with tables"""
    try:
        # Import all models to ensure they're registered
        from models import Base, LoanModel, ExceptionModel, ComplianceEventModel, DocumentModel, MetricModel, PipelineActivityModel, StagedFileModel, ProcessedDocumentModel, LoanTrackingModel, SnowflakeConnectionModel, AgentConfigurationModel
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
            
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
