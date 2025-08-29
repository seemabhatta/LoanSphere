# LoanSphere - Setup Instructions

A mortgage loan management system for processing commitments, purchase advice, and loan performance data.

## Prerequisites

- **Node.js 20+**
- **Python 3.11+**
- **Git**

## Local Development Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd LoanSphere
```

### 2. Install Dependencies

**Node.js Dependencies:**
```bash
npm install
```

**Python Dependencies (Virtual Environment Recommended):**
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r server/requirements.txt

# Or install manually:
pip install uvicorn fastapi python-dotenv tinydb sqlalchemy authlib itsdangerous httpx loguru snowflake-connector-python
```

### 3. Environment Configuration

Create `.env` file:
```bash
# OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=your_session_secret

# Development
NODE_ENV=development
```

### 4. Start Development Server

#### 🚀 **Recommended: Fast Development Mode**
```bash
# Fastest startup (~2-3 seconds) - assumes Python server already running
npm run dev:fast
```

#### **Alternative Development Commands**
```bash
# Standard mode (starts all services, ~8+ seconds)
npm run dev

# Start Python server only (run in separate terminal)
npm run python

# Concurrent mode (separate client/server processes)
npm run dev:concurrent

# Watch mode (auto-restart on changes)
npm run dev:watch
```

#### **Optimal Development Workflow:**
1. **First time setup:**
   ```bash
   # Activate Python virtual environment
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Start Python server in one terminal
   cd server && python3 -m uvicorn main:app --reload --port 8000
   
   # Start Express server in another terminal
   npm run dev:fast
   ```

2. **Daily development (fastest - Python already running):**
   ```bash
   npm run dev:fast
   ```

3. **If Python server stops working:**
   ```bash
   # Kill any stuck processes
   pkill -f "uvicorn main:app"
   
   # Restart Python server (in venv)
   source venv/bin/activate
   cd server && python3 -m uvicorn main:app --reload --port 8000
   ```

**Development URLs:**
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Node.js API**: http://localhost:5000 (Express proxy)  
- **Python API**: http://localhost:8000 (FastAPI server)

## Production Deployment (Railway)

### 1. Environment Variables
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret  
SESSION_SECRET=your_session_secret
NODE_ENV=production
PORT=8080
APP_URL=https://your-railway-app-url
```

### 2. Deploy
```bash
git push origin main
```

Railway will:
- Build using Dockerfile
- Install Node.js and Python dependencies
- Start unified server on PORT

## API Endpoints

### Core Processing
- `POST /api/staging/process` - Data ingestion
- `GET /api/commitments` - Commitment management
- `GET /api/loans` - Loan data access
- `GET /api/purchase-advices` - Purchase advice operations

### Authentication  
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/user` - Current user info
- `POST /api/auth/logout` - Logout

## Testing

### Sample Data Ingestion
```bash
# Process commitment data
curl -X POST "http://localhost:8000/api/staging/process" \
  -H "Content-Type: application/json" \
  -d '{
    "fileData": {"commitmentId": "TEST_001", "amount": 1000000},
    "fileType": "commitment",
    "sourceFileId": "test_001"
  }'

# Process purchase advice
curl -X POST "http://localhost:8000/api/staging/process" \
  -H "Content-Type: application/json" \
  -d '{
    "fileData": {"fannieMaeLn": "4032661590", "commitmentNo": "TEST_001"},
    "fileType": "purchase_advice", 
    "sourceFileId": "test_002"
  }'
```

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js Express (proxy) + Python FastAPI (core logic)
- **Database**: TinyDB (JSON file storage)
- **Authentication**: Google OAuth 2.0

## Documentation

- **Business Requirements**: See `requirements.md`
- **System Architecture**: Multi-collection data correlation system
- **Data Flow**: Commitment → Purchase Advice → Loan Data processing

## Troubleshooting

### Development Speed Issues
```bash
# If npm run dev:fast shows "Python server unavailable"
source venv/bin/activate
cd server && python3 -m uvicorn main:app --reload --port 8000

# If startup is still slow, clear caches
rm -rf node_modules/.vite
npm run dev:fast
```

### Port Conflicts
```bash
# If "Address already in use" error:
pkill -f "uvicorn main:app"  # Kill Python server
npm run python              # Restart Python server

# Frontend port conflicts: Change port in `vite.config.ts`
# Backend port conflicts: Set `PORT` environment variable
```

### Python Issues  
- Ensure Python 3.11+ installed
- **Always activate virtual environment first**: `source venv/bin/activate`
- **Missing dependencies error**: Install with `pip install -r server/requirements.txt`
- **Import errors**: Check if `itsdangerous`, `authlib`, `sqlalchemy` are installed
- **Auth not working**: Ensure Google OAuth credentials in `.env`

### Performance Optimizations
- **Fast mode**: Uses `npm run dev:fast` (2-3s startup)
- **Vite optimizations**: Pre-bundles dependencies, disabled error overlay
- **TypeScript**: `--no-cache` flag for faster compilation

### OAuth Issues
- Verify Google Cloud Console redirect URIs
- Check `APP_URL` environment variable for production

## Support

For business logic questions, refer to `requirements.md`.
For technical issues, check logs and environment configuration.