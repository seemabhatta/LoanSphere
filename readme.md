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

#### 🚀 **Development Speed Options (Fastest to Slowest)**

**Ultra-Fast Mode (~1 second startup):**
```bash
# Terminal 1: Start API server only
npm run dev:ultra

# Terminal 2: Start client server separately  
npm run dev:client
```

**Fast Mode (~2-3 seconds startup):**
```bash
# Fastest single-command option (assumes Python already running)
npm run dev:fast
```

**Alternative Commands:**
```bash
# Standard mode (starts all services, ~8+ seconds)
npm run dev

# Concurrent mode (separate client/server processes, ~3-4 seconds)
npm run dev:concurrent

# Watch mode (auto-restart on changes)
npm run dev:watch

# Start Python server only (run in separate terminal)
npm run python
```

#### **⚡ Recommended Development Workflow:**

**For Maximum Speed (3 terminals):**
```bash
# Terminal 1: Python API server
source venv/bin/activate
cd server && python3 -m uvicorn main:app --reload --port 8000

# Terminal 2: Express proxy server (~1s startup)
npm run dev:ultra

# Terminal 3: Vite client server (independent)
npm run dev:client
```

**For Simplicity (2 terminals):**
```bash
# Terminal 1: Python API server
source venv/bin/activate
cd server && python3 -m uvicorn main:app --reload --port 8000

# Terminal 2: Everything else (~2-3s startup)
npm run dev:fast
```

**For First-Time Setup (1 command):**
```bash
# Starts everything automatically (~8+ seconds)
npm run dev
```

**Development URLs:**
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Node.js API**: http://localhost:5000 (Express proxy)  
- **Python API**: http://localhost:8000 (FastAPI server)

## Production Deployment (Railway)

### 1. Environment Variables
```bash
# Authentication
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret  
SESSION_SECRET=your_session_secret

# DataMind AI Assistant
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
SNOWFLAKE_ACCOUNT=your_snowflake_account
SNOWFLAKE_USER=your_snowflake_user
SNOWFLAKE_PASSWORD=your_snowflake_password
SNOWFLAKE_WAREHOUSE=your_warehouse
SNOWFLAKE_DATABASE=your_database
SNOWFLAKE_SCHEMA=your_schema
SNOWFLAKE_ROLE=your_role

# Deployment
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

### DataMind AI Assistant
- `POST /api/datamind/chat` - Natural language data queries and visualization
- `DELETE /api/datamind/session/{id}` - Clear session

## DataMind AI Assistant

AI-powered natural language data analysis with interactive visualizations.

### Features
- **Natural Language Querying**: Ask questions about your data in plain English
- **Interactive Visualizations**: Automatic chart generation with Plotly
- **Data Dictionary Generation**: Automated YAML schema documentation
- **Snowflake Integration**: Direct connection to enterprise data warehouses
- **Session Memory**: Maintains context across conversations

### Access
Navigate to `/datamind` in your application to access the DataMind Assistant.

### Documentation
📖 **[Full DataMind Documentation](./docs/DATAMIND.md)** - Complete setup guide, architecture details, and usage examples.

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
- **Ultra mode**: `npm run dev:ultra` (~1s startup) - Express only, separate Vite
- **Fast mode**: `npm run dev:fast` (~2-3s startup) - Skips Python startup wait
- **Concurrent mode**: `npm run dev:concurrent` (~3-4s startup) - Parallel processes
- **Vite optimizations**: Pre-bundles dependencies, disabled error overlay
- **TypeScript**: `--no-cache` flag for faster compilation

### Why Development is Slow
**Startup Bottlenecks:**
1. **Python server startup** (~3s) - Port checking and uvicorn launch
2. **Vite bundling** (~2-4s) - Dependency scanning and pre-bundling
3. **Express setup** (~0.5s) - Middleware and proxy configuration

**Speed Comparison:**
- `npm run dev`: ~8+ seconds (full stack)
- `npm run dev:fast`: ~2-3 seconds (skip Python wait)  
- `npm run dev:ultra`: ~1 second (Express only)

### OAuth Issues
- Verify Google Cloud Console redirect URIs
- Check `APP_URL` environment variable for production

## Support

For business logic questions, refer to `requirements.md`.
For technical issues, check logs and environment configuration.