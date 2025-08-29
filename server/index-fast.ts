import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { setupVite, log } from "./vite";

const app = express();

// Minimal middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

(async () => {
  const server = createServer(app);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'Fast Dev Server Active', 
      message: 'Assuming Python FastAPI already running on port 8000',
      mode: 'development-fast'
    });
  });

  // Fast proxy setup - assume Python is already running
  const apiProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    timeout: 10000,
    pathRewrite: {
      '^/': '/api/'
    },
    onProxyReq: (proxyReq, req, res) => {
      if (req.headers.cookie) {
        proxyReq.setHeader('cookie', req.headers.cookie);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      if (proxyRes.headers['set-cookie']) {
        res.setHeader('set-cookie', proxyRes.headers['set-cookie']);
      }
    }
  });

  app.use('/api', (req, res, next) => {
    console.log(`🔄 Proxying ${req.method} ${req.originalUrl} to Python`);
    apiProxy(req, res, (err: any) => {
      if (err) {
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Python server unavailable - start it manually',
            hint: 'Run: cd server && python3 -m uvicorn main:app --reload --port 8000'
          });
        }
      }
    });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  // Skip Vite setup for maximum speed - assuming client runs separately
  // For even faster startup, run: npm run dev:client in separate terminal
  if (process.env.SKIP_VITE !== 'true' && app.get("env") === "development") {
    console.log("⚡ Setting up Vite (fast mode)...");
    await setupVite(app, server);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log(`⚡ Fast dev server running on port ${port}`);
    console.log(`💡 Make sure Python server is running: cd server && python3 -m uvicorn main:app --reload --port 8000`);
  });
})();