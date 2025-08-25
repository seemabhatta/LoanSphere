import type { Express } from "express";
import { createServer, type Server } from "http";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Proxy all API requests to Python FastAPI - manual path handling  
  app.use('/api', (req, res, next) => {
    // Manual proxy with preserved path
    const proxy = createProxyMiddleware({
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
      pathRewrite: (path, req) => {
        // The path here is already stripped of /api by the middleware
        // We need to add it back
        const fullPath = `/api${path}`;
        console.log(`🔄 Proxying: ${req.originalUrl} -> ${fullPath}`);
        return fullPath;
      },
      onError: (err, req, res) => {
      console.error('❌ Proxy error:', err.message);
      res.status(500).json({ 
        error: 'Python FastAPI server not available',
        message: 'Ensure Python server is running on port 8000',
        details: err.message
      });
    },
    onProxyRes: (proxyRes, req, res) => {
      // Log successful proxy requests
      if (req.path.startsWith('/api')) {
        console.log(`🔄 Proxied ${req.method} ${req.path} → Python FastAPI`);
      }
    }
    });
    proxy(req, res, next);
  });

  // Health check endpoint (not proxied)
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'Node.js Proxy Active', 
      message: 'All API requests forwarded to Python FastAPI',
      python_api: 'http://127.0.0.1:8000',
      architecture: 'Node.js Express → Python FastAPI'
    });
  });

  // All other routes are now handled by the proxy middleware above

  const httpServer = createServer(app);

  return httpServer;
}
