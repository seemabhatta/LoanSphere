import { 
  type Loan, type InsertLoan,
  type Exception, type InsertException,
  type Agent, type InsertAgent,
  type ComplianceEvent, type InsertComplianceEvent,
  type Document, type InsertDocument,
  type Metric, type InsertMetric,
  type PipelineActivity, type InsertPipelineActivity,
  type StagedFile, type InsertStagedFile
} from "@shared/schema";
import { randomUUID } from "crypto";

// Storage interface for the loan boarding system
export interface IStorage {
  // Loans
  getLoans(): Promise<Loan[]>;
  getLoan(id: string): Promise<Loan | undefined>;
  getLoanByXpNumber(xpLoanNumber: string): Promise<Loan | undefined>;
  createLoan(loan: InsertLoan): Promise<Loan>;
  updateLoan(id: string, updates: Partial<Loan>): Promise<Loan | undefined>;
  deleteLoan(id: string): Promise<boolean>;

  // Exceptions
  getExceptions(): Promise<Exception[]>;
  getException(id: string): Promise<Exception | undefined>;
  getExceptionsByLoan(loanId: string): Promise<Exception[]>;
  createException(exception: InsertException): Promise<Exception>;
  updateException(id: string, updates: Partial<Exception>): Promise<Exception | undefined>;
  deleteException(id: string): Promise<boolean>;

  // Agents
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentByName(name: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: string): Promise<boolean>;

  // Compliance Events
  getComplianceEvents(): Promise<ComplianceEvent[]>;
  getComplianceEvent(id: string): Promise<ComplianceEvent | undefined>;
  getComplianceEventsByLoan(loanId: string): Promise<ComplianceEvent[]>;
  createComplianceEvent(event: InsertComplianceEvent): Promise<ComplianceEvent>;
  updateComplianceEvent(id: string, updates: Partial<ComplianceEvent>): Promise<ComplianceEvent | undefined>;
  deleteComplianceEvent(id: string): Promise<boolean>;

  // Documents
  getDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByLoan(loanId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  // Metrics
  getMetrics(): Promise<Metric[]>;
  getMetric(id: string): Promise<Metric | undefined>;
  getMetricsByType(metricType: string): Promise<Metric[]>;
  createMetric(metric: InsertMetric): Promise<Metric>;
  updateMetric(id: string, updates: Partial<Metric>): Promise<Metric | undefined>;
  deleteMetric(id: string): Promise<boolean>;

  // Pipeline Activity
  getPipelineActivities(): Promise<PipelineActivity[]>;
  getPipelineActivity(id: string): Promise<PipelineActivity | undefined>;
  getPipelineActivitiesByLoan(loanId: string): Promise<PipelineActivity[]>;
  getRecentPipelineActivities(limit?: number): Promise<PipelineActivity[]>;
  createPipelineActivity(activity: InsertPipelineActivity): Promise<PipelineActivity>;
  updatePipelineActivity(id: string, updates: Partial<PipelineActivity>): Promise<PipelineActivity | undefined>;
  deletePipelineActivity(id: string): Promise<boolean>;

  // Staged Files
  getStagedFiles(): Promise<StagedFile[]>;
  getStagedFile(id: string): Promise<StagedFile | undefined>;
  createStagedFile(file: InsertStagedFile): Promise<StagedFile>;
  deleteStagedFile(id: string): Promise<boolean>;
}

// SQLite-based storage implementation
export class SQLiteStorage implements IStorage {
  private loans: Map<string, Loan> = new Map();
  private exceptions: Map<string, Exception> = new Map();
  private agents: Map<string, Agent> = new Map();
  private complianceEvents: Map<string, ComplianceEvent> = new Map();
  private documents: Map<string, Document> = new Map();
  private metrics: Map<string, Metric> = new Map();
  private pipelineActivities: Map<string, PipelineActivity> = new Map();
  private stagedFiles: Map<string, StagedFile> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample agents
    const sampleAgents = [
      { name: "PlannerAgent", type: "planner", status: "active", description: "Orchestrates loan boarding workflow", tasksCompleted: 45, tasksErrored: 2 },
      { name: "ToolAgent", type: "tool", status: "running", description: "Executes boarding tools and operations", tasksCompleted: 78, tasksErrored: 3 },
      { name: "VerifierAgent", type: "verifier", status: "idle", description: "Validates data and business rules", tasksCompleted: 32, tasksErrored: 1 },
      { name: "DocumentAgent", type: "document", status: "running", description: "Processes and classifies documents", tasksCompleted: 56, tasksErrored: 4 }
    ];

    sampleAgents.forEach(agent => {
      const id = randomUUID();
      const fullAgent: Agent = {
        id,
        ...agent,
        currentTask: agent.status === "running" ? "Processing loan documents" : null,
        lastActivity: Date.now(),
        metadata: "{}"
      };
      this.agents.set(id, fullAgent);
    });

    // Sample loans
    const sampleLoans = [
      {
        xpLoanNumber: "LN001234",
        tenantId: "tenant1",
        sellerName: "First National Bank",
        status: "processing",
        product: "30Y Fixed",
        boardingStatus: "in_progress",
        firstPassYield: 1,
        timeToBoard: 1.5,
        autoClearRate: 0.85
      },
      {
        xpLoanNumber: "LN001235",
        tenantId: "tenant1",
        sellerName: "Community Credit Union",
        status: "pending",
        product: "15Y Fixed",
        boardingStatus: "not_started",
        firstPassYield: 0,
        timeToBoard: null,
        autoClearRate: null
      }
    ];

    sampleLoans.forEach(loan => {
      const id = randomUUID();
      const fullLoan: Loan = {
        id,
        ...loan,
        sellerNumber: null,
        servicerNumber: null,
        commitmentId: null,
        commitmentDate: null,
        expirationDate: null,
        currentCommitmentAmount: null,
        purchasedAmount: null,
        remainingBalance: null,
        minPTR: null,
        interestRate: null,
        passThruRate: null,
        noteAmount: null,
        upbAmount: null,
        propertyValue: null,
        ltvRatio: null,
        creditScore: null,
        boardingReadiness: "pending",
        metadata: "{}",
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.loans.set(id, fullLoan);
    });
  }

  // Loans
  async getLoans(): Promise<Loan[]> { return Array.from(this.loans.values()); }
  async getLoan(id: string): Promise<Loan | undefined> { return this.loans.get(id); }
  async getLoanByXpNumber(xpLoanNumber: string): Promise<Loan | undefined> {
    return Array.from(this.loans.values()).find(loan => loan.xpLoanNumber === xpLoanNumber);
  }
  async createLoan(insertLoan: InsertLoan): Promise<Loan> {
    const id = randomUUID();
    const loan: Loan = { 
      ...insertLoan, 
      id, 
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    };
    this.loans.set(id, loan);
    return loan;
  }
  async updateLoan(id: string, updates: Partial<Loan>): Promise<Loan | undefined> {
    const loan = this.loans.get(id);
    if (!loan) return undefined;
    const updated = { ...loan, ...updates, updatedAt: Date.now() };
    this.loans.set(id, updated);
    return updated;
  }
  async deleteLoan(id: string): Promise<boolean> { return this.loans.delete(id); }

  // Exceptions
  async getExceptions(): Promise<Exception[]> { return Array.from(this.exceptions.values()); }
  async getException(id: string): Promise<Exception | undefined> { return this.exceptions.get(id); }
  async getExceptionsByLoan(loanId: string): Promise<Exception[]> {
    return Array.from(this.exceptions.values()).filter(ex => ex.loanId === loanId);
  }
  async createException(insertException: InsertException): Promise<Exception> {
    const id = randomUUID();
    const exception: Exception = { 
      ...insertException, 
      id, 
      detectedAt: Date.now() 
    };
    this.exceptions.set(id, exception);
    return exception;
  }
  async updateException(id: string, updates: Partial<Exception>): Promise<Exception | undefined> {
    const exception = this.exceptions.get(id);
    if (!exception) return undefined;
    const updated = { ...exception, ...updates };
    this.exceptions.set(id, updated);
    return updated;
  }
  async deleteException(id: string): Promise<boolean> { return this.exceptions.delete(id); }

  // Agents
  async getAgents(): Promise<Agent[]> { return Array.from(this.agents.values()); }
  async getAgent(id: string): Promise<Agent | undefined> { return this.agents.get(id); }
  async getAgentByName(name: string): Promise<Agent | undefined> {
    return Array.from(this.agents.values()).find(agent => agent.name === name);
  }
  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const id = randomUUID();
    const agent: Agent = { ...insertAgent, id };
    this.agents.set(id, agent);
    return agent;
  }
  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    const updated = { ...agent, ...updates };
    this.agents.set(id, updated);
    return updated;
  }
  async deleteAgent(id: string): Promise<boolean> { return this.agents.delete(id); }

  // Compliance Events
  async getComplianceEvents(): Promise<ComplianceEvent[]> { return Array.from(this.complianceEvents.values()); }
  async getComplianceEvent(id: string): Promise<ComplianceEvent | undefined> { return this.complianceEvents.get(id); }
  async getComplianceEventsByLoan(loanId: string): Promise<ComplianceEvent[]> {
    return Array.from(this.complianceEvents.values()).filter(event => event.loanId === loanId);
  }
  async createComplianceEvent(insertEvent: InsertComplianceEvent): Promise<ComplianceEvent> {
    const id = randomUUID();
    const event: ComplianceEvent = { 
      ...insertEvent, 
      id, 
      createdAt: Date.now() 
    };
    this.complianceEvents.set(id, event);
    return event;
  }
  async updateComplianceEvent(id: string, updates: Partial<ComplianceEvent>): Promise<ComplianceEvent | undefined> {
    const event = this.complianceEvents.get(id);
    if (!event) return undefined;
    const updated = { ...event, ...updates };
    this.complianceEvents.set(id, updated);
    return updated;
  }
  async deleteComplianceEvent(id: string): Promise<boolean> { return this.complianceEvents.delete(id); }

  // Documents
  async getDocuments(): Promise<Document[]> { return Array.from(this.documents.values()); }
  async getDocument(id: string): Promise<Document | undefined> { return this.documents.get(id); }
  async getDocumentsByLoan(loanId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => doc.loanId === loanId);
  }
  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = { 
      ...insertDocument, 
      id, 
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    };
    this.documents.set(id, document);
    return document;
  }
  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    const updated = { ...document, ...updates, updatedAt: Date.now() };
    this.documents.set(id, updated);
    return updated;
  }
  async deleteDocument(id: string): Promise<boolean> { return this.documents.delete(id); }

  // Metrics
  async getMetrics(): Promise<Metric[]> { return Array.from(this.metrics.values()); }
  async getMetric(id: string): Promise<Metric | undefined> { return this.metrics.get(id); }
  async getMetricsByType(metricType: string): Promise<Metric[]> {
    return Array.from(this.metrics.values()).filter(metric => metric.metricType === metricType);
  }
  async createMetric(insertMetric: InsertMetric): Promise<Metric> {
    const id = randomUUID();
    const metric: Metric = { 
      ...insertMetric, 
      id, 
      timestamp: Date.now() 
    };
    this.metrics.set(id, metric);
    return metric;
  }
  async updateMetric(id: string, updates: Partial<Metric>): Promise<Metric | undefined> {
    const metric = this.metrics.get(id);
    if (!metric) return undefined;
    const updated = { ...metric, ...updates };
    this.metrics.set(id, updated);
    return updated;
  }
  async deleteMetric(id: string): Promise<boolean> { return this.metrics.delete(id); }

  // Pipeline Activity
  async getPipelineActivities(): Promise<PipelineActivity[]> { return Array.from(this.pipelineActivities.values()); }
  async getPipelineActivity(id: string): Promise<PipelineActivity | undefined> { return this.pipelineActivities.get(id); }
  async getPipelineActivitiesByLoan(loanId: string): Promise<PipelineActivity[]> {
    return Array.from(this.pipelineActivities.values()).filter(activity => activity.loanId === loanId);
  }
  async getRecentPipelineActivities(limit: number = 10): Promise<PipelineActivity[]> {
    return Array.from(this.pipelineActivities.values())
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit);
  }
  async createPipelineActivity(insertActivity: InsertPipelineActivity): Promise<PipelineActivity> {
    const id = randomUUID();
    const activity: PipelineActivity = { 
      ...insertActivity, 
      id, 
      timestamp: Date.now() 
    };
    this.pipelineActivities.set(id, activity);
    return activity;
  }
  async updatePipelineActivity(id: string, updates: Partial<PipelineActivity>): Promise<PipelineActivity | undefined> {
    const activity = this.pipelineActivities.get(id);
    if (!activity) return undefined;
    const updated = { ...activity, ...updates };
    this.pipelineActivities.set(id, updated);
    return updated;
  }
  async deletePipelineActivity(id: string): Promise<boolean> { return this.pipelineActivities.delete(id); }

  // Staged Files methods
  async getStagedFiles(): Promise<StagedFile[]> { return Array.from(this.stagedFiles.values()); }
  async getStagedFile(id: string): Promise<StagedFile | undefined> { return this.stagedFiles.get(id); }
  async createStagedFile(fileData: InsertStagedFile): Promise<StagedFile> {
    const file: StagedFile = {
      id: randomUUID(),
      uploadedAt: Date.now(),
      ...fileData
    };
    this.stagedFiles.set(file.id, file);
    return file;
  }
  async deleteStagedFile(id: string): Promise<boolean> { return this.stagedFiles.delete(id); }
}

export const storage = new SQLiteStorage();