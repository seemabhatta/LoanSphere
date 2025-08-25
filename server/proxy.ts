import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

// Proxy API requests to Python FastAPI server
app.use('/api', createProxyMiddleware({
  target: 'http://127.0.0.1:8000',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Python API server not available' });
  }
}));

// Proxy WebSocket connections
app.use('/ws', createProxyMiddleware({
  target: 'ws://127.0.0.1:8000',
  ws: true,
  changeOrigin: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Proxy server running',
    python_api: 'http://127.0.0.1:8000'
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Forwarding API calls to Python FastAPI on port 8000`);
});