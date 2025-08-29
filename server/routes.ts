import type { Express } from "express";
import { createServer, type Server } from "http";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import net from 'net';

async function isPortInUse(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication is now handled by Python backend

  // Health check endpoint (not proxied)
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'Node.js Proxy Active', 
      message: 'All API requests forwarded to Python FastAPI',
      python_api: 'http://127.0.0.1:8000',
      architecture: 'Node.js Express → Python FastAPI',
      auth: 'OAuth 2.0 (Google only)'
    });
  });

  // Start Python FastAPI server (only if port 8000 not already in use)
  const fastApiPort = 8000;
  const alreadyRunning = await isPortInUse(fastApiPort);
  let pythonProcess: ReturnType<typeof spawn> | null = null;

  if (alreadyRunning) {
    console.log(`♻️  Reusing existing Python FastAPI on port ${fastApiPort}`);
  } else {
    console.log('🐍 Starting Python FastAPI server...');
    const pythonCmd = 'python3';
    const uvicornArgs = ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', String(fastApiPort)];
    pythonProcess = spawn(pythonCmd, uvicornArgs, {
      cwd: './server',
      stdio: 'pipe'
    });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`[python] ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.log(`[python] ${data.toString().trim()}`);
    });

    // Wait briefly for Python server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`✅ Python FastAPI server running on port ${fastApiPort}`);
  }

  // Cleanup Python process on exit
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down Python server...');
    if (pythonProcess) pythonProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down Python server...');
    if (pythonProcess) pythonProcess.kill('SIGTERM');
    process.exit(0);
  });

  // Proxy remaining API requests to Python FastAPI (excluding auth routes)
  const apiProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    timeout: 30000,
    pathRewrite: {
      '^/': '/api/'  // Add /api prefix since Express strips it
    },
    onProxyReq: (proxyReq, req, res) => {
      // Forward cookies from client to Python backend
      if (req.headers.cookie) {
        proxyReq.setHeader('cookie', req.headers.cookie);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      // Forward set-cookie headers from Python backend to client
      if (proxyRes.headers['set-cookie']) {
        res.setHeader('set-cookie', proxyRes.headers['set-cookie']);
      }
    }
  });

  app.use('/api', (req, res, next) => {
    // Proxy all API requests to Python backend
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
