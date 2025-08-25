import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Loans table
export const loans = sqliteTable("loans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  xpLoanNumber: text("xp_loan_number").notNull().unique(),
  tenantId: text("tenant_id").notNull(),
  sellerName: text("seller_name"),
  sellerNumber: text("seller_number"),
  servicerNumber: text("servicer_number"),
  status: text("status").notNull().default("pending"),
  product: text("product"),
  commitmentId: text("commitment_id"),
  commitmentDate: integer("commitment_date"), // Unix timestamp
  expirationDate: integer("expiration_date"), // Unix timestamp
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
  boardingReadiness: text("boarding_readiness").default("pending"),
  boardingStatus: text("boarding_status").default("not_started"),
  firstPassYield: integer("first_pass_yield").default(0), // 0 = false, 1 = true
  timeToBoard: integer("time_to_board"), // in hours
  autoClearRate: real("auto_clear_rate"),
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at").default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at").default(sql`(strftime('%s', 'now'))`)
});

// Exceptions table
export const exceptions = sqliteTable("exceptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  loanId: text("loan_id").references(() => loans.id),
  xpLoanNumber: text("xp_loan_number").notNull(),
  ruleId: text("rule_id").notNull(),
  ruleName: text("rule_name").notNull(),
  severity: text("severity").notNull(), // HIGH, MEDIUM, LOW
  status: text("status").notNull().default("open"), // open, resolved, dismissed
  confidence: real("confidence"),
  description: text("description").notNull(),
  evidence: text("evidence"), // JSON string
  autoFixSuggestion: text("auto_fix_suggestion"), // JSON string
  detectedAt: integer("detected_at").default(sql`(strftime('%s', 'now'))`),
  resolvedAt: integer("resolved_at"),
  resolvedBy: text("resolved_by"),
  slaDue: integer("sla_due"),
  notes: text("notes")
});

// Agents table
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type").notNull(), // planner, tool, verifier, document
  status: text("status").notNull().default("idle"), // active, running, idle, error, wait
  description: text("description"),
  currentTask: text("current_task"),
  tasksCompleted: integer("tasks_completed").default(0),
  tasksErrored: integer("tasks_errored").default(0),
  lastActivity: integer("last_activity"),
  metadata: text("metadata") // JSON string
});

// Staged Files table
export const stagedFiles = sqliteTable("staged_files", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  filename: text("filename").notNull(),
  type: text("type").notNull(),
  data: text("data").notNull(), // JSON string
  uploadedAt: integer("uploaded_at").default(sql`(strftime('%s', 'now'))`)
});

// Compliance events table
export const complianceEvents = sqliteTable("compliance_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  loanId: text("loan_id").references(() => loans.id),
  xpLoanNumber: text("xp_loan_number").notNull(),
  eventType: text("event_type").notNull(), // respa_welcome, escrow_setup, tila_disclosure
  status: text("status").notNull(), // pending, completed, overdue
  dueDate: integer("due_date"),
  completedAt: integer("completed_at"),
  description: text("description"),
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at").default(sql`(strftime('%s', 'now'))`)
});

// Documents table
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  loanId: text("loan_id").references(() => loans.id),
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
  extractedData: text("extracted_data"), // JSON string
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at").default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at").default(sql`(strftime('%s', 'now'))`)
});

// Metrics table for tracking system performance
export const metrics = sqliteTable("metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  metricType: text("metric_type").notNull(),
  value: real("value").notNull(),
  period: text("period").notNull(), // hourly, daily, weekly
  timestamp: integer("timestamp").default(sql`(strftime('%s', 'now'))`),
  metadata: text("metadata") // JSON string
});

// Pipeline activity for real-time monitoring
export const pipelineActivity = sqliteTable("pipeline_activity", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  loanId: text("loan_id").references(() => loans.id),
  xpLoanNumber: text("xp_loan_number"),
  activityType: text("activity_type").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull(),
  agentName: text("agent_name"),
  timestamp: integer("timestamp").default(sql`(strftime('%s', 'now'))`),
  metadata: text("metadata") // JSON string
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

export type StagedFile = typeof stagedFiles.$inferSelect;
export type InsertStagedFile = z.infer<typeof insertStagedFileSchema>;