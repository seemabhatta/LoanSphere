import type { Express } from "express";
import { createServer, type Server } from "http";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import { setupAuth, isAuthenticated } from "./replitAuth";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes - must come before proxy middleware
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Health check endpoint (not proxied)
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'Node.js Proxy Active', 
      message: 'All API requests forwarded to Python FastAPI',
      python_api: 'http://127.0.0.1:8000',
      architecture: 'Node.js Express → Python FastAPI',
      auth: 'Replit OpenID Connect'
    });
  });

  // Start Python FastAPI server
  console.log('🐍 Starting Python FastAPI server...');
  const pythonProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'], {
    cwd: './server',
    stdio: 'pipe'
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[python] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.log(`[python] ${data.toString().trim()}`);
  });

  // Wait for Python server to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('✅ Python FastAPI server running on port 8000');

  // Cleanup Python process on exit
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down Python server...');
    pythonProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Python server...');
    pythonProcess.kill('SIGTERM');
    process.exit(0);
  });

  // Proxy remaining API requests to Python FastAPI (excluding auth routes)
  const apiProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    timeout: 30000,
    pathRewrite: {
      '^/': '/api/'  // Add /api prefix since Express strips it
    }
  });

  app.use('/api', (req, res, next) => {
    // Skip proxy for auth routes - handle them above
    if (req.path.startsWith('/auth/') || req.path === '/auth' || req.path.startsWith('/login') || req.path.startsWith('/logout') || req.path.startsWith('/callback')) {
      return next();
    }
    console.log(`🔄 Proxying ${req.method} ${req.originalUrl} to Python`);
    apiProxy(req, res, (err: any) => {
      if (err) {
        console.error('❌ Proxy error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Python FastAPI server not available',
            message: 'Ensure Python server is running on port 8000',
            details: err.message
          });
        }
      }
    });
  });

  // All other routes are now handled by the proxy middleware above

  const httpServer = createServer(app);

  return httpServer;
}
