import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  real,
  boolean
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loans table
export const loans = pgTable("loans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  xpLoanNumber: varchar("xp_loan_number").notNull().unique(),
  tenantId: varchar("tenant_id").notNull(),
  sellerName: varchar("seller_name"),
  sellerNumber: varchar("seller_number"),
  servicerNumber: varchar("servicer_number"),
  status: varchar("status").notNull().default("pending"),
  product: varchar("product"),
  commitmentId: varchar("commitment_id"),
  commitmentDate: timestamp("commitment_date"),
  expirationDate: timestamp("expiration_date"),
  currentCommitmentAmount: real("current_commitment_amount"),
  purchasedAmount: real("purchased_amount"),
  remainingBalance: real("remaining_balance"),
  minPTR: real("min_ptr"),
  interestRate: real("interest_rate"),
  passThruRate: real("pass_thru_rate"),
  noteAmount: real("note_amount"),
  upbAmount: real("upb_amount"),
  propertyValue: real("property_value"),
  ltvRatio: real("ltv_ratio"),
  creditScore: integer("credit_score"),
  boardingReadiness: varchar("boarding_readiness").default("pending"),
  boardingStatus: varchar("boarding_status").default("not_started"),
  firstPassYield: boolean("first_pass_yield").default(false),
  timeToBoard: real("time_to_board"), // in hours
  autoClearRate: real("auto_clear_rate"),
  metadata: jsonb("model_metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Exceptions table
export const exceptions = pgTable("exceptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loans.id),
  xpLoanNumber: varchar("xp_loan_number").notNull(),
  ruleId: varchar("rule_id").notNull(),
  ruleName: varchar("rule_name").notNull(),
  severity: varchar("severity").notNull(), // HIGH, MEDIUM, LOW
  status: varchar("status").notNull().default("open"), // open, resolved, dismissed
  confidence: real("confidence"),
  description: text("description").notNull(),
  evidence: jsonb("evidence"),
  autoFixSuggestion: jsonb("auto_fix_suggestion"),
  detectedAt: timestamp("detected_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  slaDue: timestamp("sla_due"),
  notes: text("notes")
});

// Agents table
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // planner, tool, verifier, document
  status: varchar("status").notNull().default("idle"), // active, running, idle, error, wait
  description: text("description"),
  currentTask: text("current_task"),
  tasksCompleted: integer("tasks_completed").default(0),
  tasksErrored: integer("tasks_errored").default(0),
  lastActivity: timestamp("last_activity"),
  metadata: jsonb("metadata")
});

// Staged Files table
export const stagedFiles = pgTable("staged_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: varchar("filename").notNull(),
  type: varchar("type").notNull(),
  data: jsonb("data").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow()
});

// Compliance events table
export const complianceEvents = pgTable("compliance_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loans.id),
  xpLoanNumber: varchar("xp_loan_number").notNull(),
  eventType: varchar("event_type").notNull(), // respa_welcome, escrow_setup, tila_disclosure
  status: varchar("status").notNull(), // pending, completed, overdue
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow()
});

// Documents table
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loans.id),
  xpLoanNumber: varchar("xp_loan_number").notNull(),
  xpDocGUID: varchar("xp_doc_guid").notNull(),
  xpDocId: varchar("xp_doc_id").notNull(),
  documentType: varchar("document_type").notNull(),
  status: varchar("status").notNull().default("pending"), // pending, processing, classified, extracted, validated, error
  ocrStatus: varchar("ocr_status").default("pending"),
  classificationStatus: varchar("classification_status").default("pending"),
  extractionStatus: varchar("extraction_status").default("pending"),
  validationStatus: varchar("validation_status").default("pending"),
  s3Location: varchar("s3_location"),
  extractedData: jsonb("extracted_data"),
  metadata: jsonb("model_metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Metrics table for tracking system performance
export const metrics = pgTable("metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricType: varchar("metric_type").notNull(),
  value: real("value").notNull(),
  period: varchar("period").notNull(), // hourly, daily, weekly
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata")
});

// Pipeline activity for real-time monitoring
export const pipelineActivity = pgTable("pipeline_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loans.id),
  xpLoanNumber: varchar("xp_loan_number"),
  activityType: varchar("activity_type").notNull(),
  status: varchar("status").notNull(),
  message: text("message").notNull(),
  agentName: varchar("agent_name"),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("model_metadata")
});

// Schema exports for validation
export const insertLoanSchema = createInsertSchema(loans).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertExceptionSchema = createInsertSchema(exceptions).omit({
  id: true,
  detectedAt: true
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true
});

export const insertComplianceEventSchema = createInsertSchema(complianceEvents).omit({
  id: true,
  createdAt: true
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertMetricSchema = createInsertSchema(metrics).omit({
  id: true,
  timestamp: true
});

export const insertPipelineActivitySchema = createInsertSchema(pipelineActivity).omit({
  id: true,
  timestamp: true
});

export const insertStagedFileSchema = createInsertSchema(stagedFiles).omit({
  id: true,
  uploadedAt: true
});

// Authentication schemas - mandatory for Replit Auth
export const upsertUserSchema = createInsertSchema(users);
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Types
export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Loan = typeof loans.$inferSelect;
export type InsertLoan = z.infer<typeof insertLoanSchema>;

export type Exception = typeof exceptions.$inferSelect;
export type InsertException = z.infer<typeof insertExceptionSchema>;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type ComplianceEvent = typeof complianceEvents.$inferSelect;
export type InsertComplianceEvent = z.infer<typeof insertComplianceEventSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;

export type PipelineActivity = typeof pipelineActivity.$inferSelect;
export type InsertPipelineActivity = z.infer<typeof insertPipelineActivitySchema>;

export type StagedFile = typeof stagedFiles.$inferSelect;
export type InsertStagedFile = z.infer<typeof insertStagedFileSchema>;