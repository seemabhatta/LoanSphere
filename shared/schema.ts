import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Loans table
export const loans = pgTable("loans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  xpLoanNumber: text("xp_loan_number").notNull().unique(),
  tenantId: text("tenant_id").notNull(),
  sellerName: text("seller_name"),
  sellerNumber: text("seller_number"),
  servicerNumber: text("servicer_number"),
  status: text("status").notNull().default("pending"),
  product: text("product"),
  commitmentId: text("commitment_id"),
  commitmentDate: timestamp("commitment_date"),
  expirationDate: timestamp("expiration_date"),
  currentCommitmentAmount: decimal("current_commitment_amount"),
  purchasedAmount: decimal("purchased_amount"),
  remainingBalance: decimal("remaining_balance"),
  minPTR: decimal("min_ptr"),
  interestRate: decimal("interest_rate"),
  passThruRate: decimal("pass_thru_rate"),
  noteAmount: decimal("note_amount"),
  upbAmount: decimal("upb_amount"),
  propertyValue: decimal("property_value"),
  ltvRatio: decimal("ltv_ratio"),
  creditScore: integer("credit_score"),
  boardingReadiness: text("boarding_readiness").default("pending"),
  boardingStatus: text("boarding_status").default("not_started"),
  firstPassYield: boolean("first_pass_yield").default(false),
  timeToBoard: integer("time_to_board"), // in hours
  autoClearRate: decimal("auto_clear_rate"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Exceptions table
export const exceptions = pgTable("exceptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loans.id),
  xpLoanNumber: text("xp_loan_number").notNull(),
  ruleId: text("rule_id").notNull(),
  ruleName: text("rule_name").notNull(),
  severity: text("severity").notNull(), // HIGH, MEDIUM, LOW
  status: text("status").notNull().default("open"), // open, resolved, dismissed
  confidence: decimal("confidence"),
  description: text("description").notNull(),
  evidence: jsonb("evidence"),
  autoFixSuggestion: jsonb("auto_fix_suggestion"),
  detectedAt: timestamp("detected_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
  slaDue: timestamp("sla_due"),
  notes: text("notes")
});

// Agents table
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // planner, tool, verifier, document
  status: text("status").notNull().default("idle"), // active, running, idle, error, wait
  description: text("description"),
  currentTask: text("current_task"),
  tasksCompleted: integer("tasks_completed").default(0),
  tasksErrored: integer("tasks_errored").default(0),
  lastActivity: timestamp("last_activity"),
  metadata: jsonb("metadata")
});

// Compliance events table
export const complianceEvents = pgTable("compliance_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loans.id),
  xpLoanNumber: text("xp_loan_number").notNull(),
  eventType: text("event_type").notNull(), // respa_welcome, escrow_setup, tila_disclosure
  status: text("status").notNull(), // pending, completed, overdue
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
  xpLoanNumber: text("xp_loan_number").notNull(),
  xpDocGUID: text("xp_doc_guid").notNull(),
  xpDocId: text("xp_doc_id").notNull(),
  documentType: text("document_type").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, classified, extracted, validated, error
  ocrStatus: text("ocr_status").default("pending"),
  classificationStatus: text("classification_status").default("pending"),
  extractionStatus: text("extraction_status").default("pending"),
  validationStatus: text("validation_status").default("pending"),
  s3Location: text("s3_location"),
  extractedData: jsonb("extracted_data"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Metrics table for tracking system performance
export const metrics = pgTable("metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricType: text("metric_type").notNull(),
  value: decimal("value").notNull(),
  period: text("period").notNull(), // hourly, daily, weekly
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata")
});

// Pipeline activity for real-time monitoring
export const pipelineActivity = pgTable("pipeline_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loans.id),
  xpLoanNumber: text("xp_loan_number"),
  activityType: text("activity_type").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull(),
  agentName: text("agent_name"),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata")
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

// Types
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
