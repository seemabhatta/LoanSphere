from sqlalchemy import Column, String, Integer, DateTime, Boolean, Numeric, Text, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class LoanModel(Base):
    __tablename__ = "loans"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    xp_loan_number = Column(String, unique=True, nullable=False)
    tenant_id = Column(String, nullable=False)
    seller_name = Column(String)
    seller_number = Column(String)
    servicer_number = Column(String)
    status = Column(String, nullable=False, default="pending")
    product = Column(String)
    commitment_id = Column(String)
    commitment_date = Column(DateTime)
    expiration_date = Column(DateTime)
    current_commitment_amount = Column(Numeric(15, 2))
    purchased_amount = Column(Numeric(15, 2))
    remaining_balance = Column(Numeric(15, 2))
    min_ptr = Column(Numeric(5, 4))
    interest_rate = Column(Numeric(5, 4))
    pass_thru_rate = Column(Numeric(5, 4))
    note_amount = Column(Numeric(15, 2))
    upb_amount = Column(Numeric(15, 2))
    property_value = Column(Numeric(15, 2))
    ltv_ratio = Column(Numeric(5, 4))
    credit_score = Column(Integer)
    boarding_readiness = Column(String, default="pending")
    boarding_status = Column(String, default="not_started")
    first_pass_yield = Column(Boolean, default=False)
    time_to_board = Column(Integer)  # in hours
    auto_clear_rate = Column(Numeric(5, 4))
    model_metadata = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    exceptions = relationship("ExceptionModel", back_populates="loan")
    compliance_events = relationship("ComplianceEventModel", back_populates="loan")
    documents = relationship("DocumentModel", back_populates="loan")

class ExceptionModel(Base):
    __tablename__ = "exceptions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    loan_id = Column(String, ForeignKey("loans.id"))
    xp_loan_number = Column(String, nullable=False)
    rule_id = Column(String, nullable=False)
    rule_name = Column(String, nullable=False)
    severity = Column(String, nullable=False)  # HIGH, MEDIUM, LOW
    status = Column(String, nullable=False, default="open")  # open, resolved, dismissed
    confidence = Column(Numeric(5, 4))
    description = Column(Text, nullable=False)
    evidence = Column(JSON)
    auto_fix_suggestion = Column(JSON)
    detected_at = Column(DateTime, server_default=func.now())
    resolved_at = Column(DateTime)
    resolved_by = Column(String)
    sla_due = Column(DateTime)
    notes = Column(Text)
    
    # Relationships
    loan = relationship("LoanModel", back_populates="exceptions")

class AgentModel(Base):
    __tablename__ = "agents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # planner, tool, verifier, document
    status = Column(String, nullable=False, default="idle")  # active, running, idle, error, wait
    description = Column(String)
    current_task = Column(String)
    tasks_completed = Column(Integer, default=0)
    tasks_errored = Column(Integer, default=0)
    last_activity = Column(DateTime)
    model_metadata = Column(JSON)

class ComplianceEventModel(Base):
    __tablename__ = "compliance_events"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    loan_id = Column(String, ForeignKey("loans.id"))
    xp_loan_number = Column(String, nullable=False)
    event_type = Column(String, nullable=False)  # respa_welcome, escrow_setup, tila_disclosure
    status = Column(String, nullable=False)  # pending, completed, overdue
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
    description = Column(String)
    model_metadata = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    loan = relationship("LoanModel", back_populates="compliance_events")

class DocumentModel(Base):
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    loan_id = Column(String, ForeignKey("loans.id"))
    xp_loan_number = Column(String, nullable=False)
    xp_doc_guid = Column(String, nullable=False)
    xp_doc_id = Column(String, nullable=False)
    document_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")
    ocr_status = Column(String, default="pending")
    classification_status = Column(String, default="pending")
    extraction_status = Column(String, default="pending")
    validation_status = Column(String, default="pending")
    s3_location = Column(String)
    extracted_data = Column(JSON)
    model_metadata = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    loan = relationship("LoanModel", back_populates="documents")

class MetricModel(Base):
    __tablename__ = "metrics"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    metric_type = Column(String, nullable=False)
    value = Column(Numeric(10, 4), nullable=False)
    period = Column(String, nullable=False)  # hourly, daily, weekly
    timestamp = Column(DateTime, server_default=func.now())
    model_metadata = Column(JSON)

class PipelineActivityModel(Base):
    __tablename__ = "pipeline_activity"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    loan_id = Column(String, ForeignKey("loans.id"))
    xp_loan_number = Column(String)
    activity_type = Column(String, nullable=False)
    status = Column(String, nullable=False)
    message = Column(String, nullable=False)
    agent_name = Column(String)
    timestamp = Column(DateTime, server_default=func.now())
    model_metadata = Column(JSON)

class StagedFileModel(Base):
    __tablename__ = "staged_files"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    type = Column(String, nullable=False)
    data = Column(Text, nullable=False)  # JSON string
    uploaded_at = Column(DateTime, server_default=func.now())
