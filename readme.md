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

**Python Dependencies:**
```bash
pip install uvicorn fastapi python-dotenv tinydb
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

```bash
npm run dev
```

This starts:
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

### Port Conflicts
- Frontend: Change port in `vite.config.ts`
- Backend: Set `PORT` environment variable

### Python Issues  
- Ensure Python 3.11+ installed
- Install uvicorn: `pip install uvicorn[standard]`

### OAuth Issues
- Verify Google Cloud Console redirect URIs
- Check `APP_URL` environment variable for production

## Support

For business logic questions, refer to `requirements.md`.
For technical issues, check logs and environment configuration.