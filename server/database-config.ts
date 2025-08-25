import Database from "better-sqlite3";
import { graph, NamedNode, literal } from "rdflib";
import { Client } from "@opensearch-project/opensearch";

// SQLite Database Configuration
export class SQLiteDB {
  private db: Database.Database;

  constructor(filename: string = "loan_boarding.db") {
    this.db = new Database(filename);
    this.initializeTables();
  }

  private initializeTables() {
    // Create SQLite tables based on our schema
    const statements = [
      `CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY,
        xp_loan_number TEXT UNIQUE NOT NULL,
        tenant_id TEXT NOT NULL,
        seller_name TEXT,
        status TEXT DEFAULT 'pending',
        boarding_status TEXT DEFAULT 'not_started',
        first_pass_yield INTEGER DEFAULT 0,
        time_to_board INTEGER,
        auto_clear_rate REAL,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS exceptions (
        id TEXT PRIMARY KEY,
        loan_id TEXT REFERENCES loans(id),
        xp_loan_number TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        rule_name TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        confidence REAL,
        description TEXT NOT NULL,
        evidence TEXT,
        auto_fix_suggestion TEXT,
        detected_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        description TEXT,
        current_task TEXT,
        tasks_completed INTEGER DEFAULT 0,
        tasks_errored INTEGER DEFAULT 0,
        last_activity INTEGER,
        metadata TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS compliance_events (
        id TEXT PRIMARY KEY,
        loan_id TEXT REFERENCES loans(id),
        xp_loan_number TEXT NOT NULL,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        due_date INTEGER,
        completed_at INTEGER,
        description TEXT,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        loan_id TEXT REFERENCES loans(id),
        xp_loan_number TEXT NOT NULL,
        xp_doc_guid TEXT NOT NULL,
        xp_doc_id TEXT NOT NULL,
        document_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        ocr_status TEXT DEFAULT 'pending',
        s3_location TEXT,
        extracted_data TEXT,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`
    ];

    statements.forEach(statement => {
      this.db.exec(statement);
    });
  }

  getDatabase() {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

// Simple JSON Configuration for fixtures and configuration
export class ConfigDB {
  private data: Map<string, any> = new Map();

  constructor(filename: string = "config.json") {
    // Use simple in-memory storage for now
  }

  // Store system configuration
  getConfig(key: string) {
    return this.data.get(key) || null;
  }

  setConfig(key: string, value: any) {
    this.data.set(key, value);
  }

  // Store rule definitions and business logic fixtures
  getRules() {
    return this.getConfig("business_rules") || [];
  }

  setRules(rules: any[]) {
    this.setConfig("business_rules", rules);
  }

  // Store agency configurations
  getAgencyConfig(agency: string) {
    return this.getConfig(`agency_${agency}`) || {};
  }

  setAgencyConfig(agency: string, config: any) {
    this.setConfig(`agency_${agency}`, config);
  }
}

// RDFLib Knowledge Graph for relationship mapping
export class LoanKnowledgeGraph {
  private store: any;
  private baseURI: string;

  constructor() {
    this.store = graph();
    this.baseURI = "http://loanboarding.example.com/";
  }

  // Add loan relationships
  addLoanRelationship(loanId: string, relationType: string, targetId: string, targetType: string) {
    const loanNode = new NamedNode(`${this.baseURI}loan/${loanId}`);
    const targetNode = new NamedNode(`${this.baseURI}${targetType}/${targetId}`);
    const relation = new NamedNode(`${this.baseURI}relation/${relationType}`);
    
    this.store.add(loanNode, relation, targetNode);
  }

  // Add agent task relationships
  addAgentTask(agentId: string, taskType: string, loanId: string) {
    const agentNode = new NamedNode(`${this.baseURI}agent/${agentId}`);
    const loanNode = new NamedNode(`${this.baseURI}loan/${loanId}`);
    const taskRelation = new NamedNode(`${this.baseURI}relation/performs_task`);
    const taskNode = new NamedNode(`${this.baseURI}task/${taskType}`);
    
    this.store.add(agentNode, taskRelation, taskNode);
    this.store.add(taskNode, new NamedNode(`${this.baseURI}relation/targets`), loanNode);
  }

  // Query relationships
  queryRelationships(subjectType: string, subjectId: string) {
    const subjectNode = new NamedNode(`${this.baseURI}${subjectType}/${subjectId}`);
    const statements = this.store.statementsMatching(subjectNode, undefined, undefined);
    return statements.map((stmt: any) => ({
      predicate: stmt.predicate.value,
      object: stmt.object.value
    }));
  }

  // Export graph as Turtle format
  serialize(): string {
    return this.store.serialize(undefined, "text/turtle");
  }
}

// OpenSearch Configuration for document indexing and search
export class DocumentSearchIndex {
  private client: Client;
  private indexName: string;

  constructor() {
    // Configure for local OpenSearch instance
    this.client = new Client({
      node: process.env.OPENSEARCH_URL || "http://localhost:9200",
      auth: {
        username: process.env.OPENSEARCH_USERNAME || "admin",
        password: process.env.OPENSEARCH_PASSWORD || "admin"
      },
      ssl: {
        rejectUnauthorized: false
      }
    });
    this.indexName = "loan-documents";
    this.initializeIndex();
  }

  private async initializeIndex() {
    try {
      const exists = await this.client.indices.exists({ index: this.indexName });
      if (!exists.body) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                loan_id: { type: "keyword" },
                xp_loan_number: { type: "keyword" },
                document_type: { type: "keyword" },
                content: { type: "text", analyzer: "standard" },
                extracted_data: { type: "object" },
                ocr_confidence: { type: "float" },
                created_at: { type: "date" },
                tags: { type: "keyword" }
              }
            }
          }
        });
      }
    } catch (error) {
      console.warn("OpenSearch not available, document search disabled:", error);
    }
  }

  // Index document content
  async indexDocument(documentId: string, data: {
    loanId: string;
    xpLoanNumber: string;
    documentType: string;
    content: string;
    extractedData?: any;
    ocrConfidence?: number;
    tags?: string[];
  }) {
    try {
      await this.client.index({
        index: this.indexName,
        id: documentId,
        body: {
          ...data,
          created_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Failed to index document:", error);
    }
  }

  // Search documents
  async searchDocuments(query: string, filters?: { loanId?: string; documentType?: string }) {
    try {
      const searchBody: any = {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ["content", "extracted_data"]
                }
              }
            ]
          }
        }
      };

      if (filters) {
        searchBody.query.bool.filter = [];
        if (filters.loanId) {
          searchBody.query.bool.filter.push({ term: { loan_id: filters.loanId } });
        }
        if (filters.documentType) {
          searchBody.query.bool.filter.push({ term: { document_type: filters.documentType } });
        }
      }

      const response = await this.client.search({
        index: this.indexName,
        body: searchBody
      });

      return response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source
      }));
    } catch (error) {
      console.error("Document search failed:", error);
      return [];
    }
  }

  // Delete document from index
  async deleteDocument(documentId: string) {
    try {
      await this.client.delete({
        index: this.indexName,
        id: documentId
      });
    } catch (error) {
      console.error("Failed to delete document from index:", error);
    }
  }
}

// Export configured instances
export const sqliteDB = new SQLiteDB();
export const configDB = new ConfigDB();
export const knowledgeGraph = new LoanKnowledgeGraph();
export const documentSearch = new DocumentSearchIndex();

// Initialize sample configuration data
configDB.setRules([
  {
    id: "income_verification",
    name: "Income Verification Required",
    type: "data_validation",
    severity: "HIGH",
    description: "All loans must have verified income documentation"
  },
  {
    id: "credit_score_minimum",
    name: "Credit Score Minimum",
    type: "eligibility",
    severity: "MEDIUM", 
    description: "Credit score must be above 620 for conventional loans"
  }
]);

configDB.setAgencyConfig("fannie_mae", {
  api_endpoint: "https://api.fanniemae.com",
  timeout: 30000,
  retry_attempts: 3
});

configDB.setAgencyConfig("freddie_mac", {
  api_endpoint: "https://api.freddiemac.com", 
  timeout: 30000,
  retry_attempts: 3
});