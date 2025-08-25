import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stagingAPI } from "./fixtures/staging-api";
import { simpleStagingAPI } from "./simple-staging";

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple staging routes
  app.use("/api/simple", simpleStagingAPI);
  
  // Complex staging and sample data routes
  app.use("/api/staging", stagingAPI);

  // Loans API
  app.get("/api/loans", async (req, res) => {
    try {
      const loans = await storage.getLoans();
      res.json({ loans });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loans" });
    }
  });

  app.get("/api/loans/:id", async (req, res) => {
    try {
      const loan = await storage.getLoan(req.params.id);
      if (!loan) {
        return res.status(404).json({ error: "Loan not found" });
      }
      res.json({ loan });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loan" });
    }
  });

  // Pipeline Activity API
  app.get("/api/loans/activity/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const activities = await storage.getRecentPipelineActivities(limit);
      res.json({ activities });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent activities" });
    }
  });

  // Agents API
  app.get("/api/agents/status/summary", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      res.json({ agents });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  // Exceptions API
  app.get("/api/exceptions", async (req, res) => {
    try {
      const exceptions = await storage.getExceptions();
      const openExceptions = exceptions.filter(ex => ex.status === 'open');
      res.json({ exceptions: openExceptions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exceptions" });
    }
  });

  // Metrics Dashboard API
  app.get("/api/metrics/dashboard", async (req, res) => {
    try {
      const loans = await storage.getLoans();
      const activities = await storage.getRecentPipelineActivities(5);
      
      const loanMetrics = {
        total_loans: loans.length,
        active_loans: loans.filter(l => l.status === 'processing' || l.status === 'boarding_in_progress').length,
        completed_loans: loans.filter(l => l.status === 'completed').length,
        failed_loans: loans.filter(l => l.status === 'error').length,
        first_pass_yield: loans.length > 0 ? loans.filter(l => l.firstPassYield === 1).length / loans.length : 0,
        avg_time_to_board: loans.length > 0 ? loans.reduce((sum, l) => sum + (l.timeToBoard || 0), 0) / loans.length : 0
      };

      const documentMetrics = {
        total_processed: 0,
        success_rate: 0,
        avg_confidence: 0
      };

      res.json({ 
        loan_metrics: loanMetrics,
        recent_activity: activities,
        document_metrics: documentMetrics
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // Compliance Dashboard API
  app.get("/api/compliance/dashboard/summary", async (req, res) => {
    try {
      const complianceEvents = await storage.getComplianceEvents();
      const status = {
        respa_compliance: complianceEvents.filter(e => e.eventType?.includes('respa')).length,
        tila_compliance: complianceEvents.filter(e => e.eventType?.includes('tila')).length,
        total_events: complianceEvents.length,
        pending_events: complianceEvents.filter(e => e.status === 'pending').length
      };
      res.json({ status });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch compliance status" });
    }
  });

  // Basic health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);

  return httpServer;
}
