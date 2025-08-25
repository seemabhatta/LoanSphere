import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stagingAPI } from "./fixtures/staging-api";

export async function registerRoutes(app: Express): Promise<Server> {
  // Staging and sample data routes
  app.use("/api/staging", stagingAPI);

  // Basic health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);

  return httpServer;
}
