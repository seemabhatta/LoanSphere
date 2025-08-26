# Co-Issue Loan Boarding - Multi-Agent Pipeline

## Overview

A comprehensive loan boarding automation system designed to transform co-issue loan boarding bottlenecks into a high-FPY (First-Pass Yield), low-latency, compliant pipeline. The system uses multiple specialized AI agents to orchestrate document processing, data validation, exception handling, and compliance management for mortgage loan boarding operations.

The application demonstrates an end-to-end loan boarding workflow that processes commitments, purchase advice, loan data (ULDD), and documents through automated pipelines with real-time monitoring and exception management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

**UI/UX Preferences:**
- Side panel should be visible by default when the application loads or refreshes
- Typography consistency is critical - all numbers and metrics must display identically across all pages

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite for development
- **UI Components**: Shadcn/ui component library with Radix UI primitives and Tailwind CSS styling
- **State Management**: Zustand for global state management
- **Data Fetching**: TanStack Query v5 for server state management
- **Routing**: Wouter for client-side routing
- **Real-time Updates**: WebSocket integration for live data updates
- **Forms**: React Hook Form with Zod validation
- **Animation**: Framer Motion for component animations

### Backend Architecture
- **Primary Backend**: Python FastAPI with all business logic and data processing
- **Proxy Layer**: Node.js Express server with HTTP proxy middleware for API forwarding
- **Multi-Agent System**: 
  - PlannerAgent: Task orchestration and workflow planning
  - ToolAgent: Executes specific boarding tools and operations
  - VerifierAgent: Data validation and MISMO-aligned rule-based verification
  - DocumentAgent: Document processing, OCR, and classification with S3 integration
- **Task Orchestration**: WebSocket-based real-time agent status monitoring
- **API Documentation**: FastAPI automatic OpenAPI/Swagger documentation

### Data Storage Solutions
- **Primary Database**: SQLAlchemy ORM with SQLite for development (PostgreSQL-ready models)
- **Session Storage**: FastAPI session middleware with configurable secret keys
- **Document Storage**: S3-compatible storage for loan documents and file uploads
- **Configuration & Staging**: TinyDB for fixtures, configuration data, and document staging
- **Knowledge Graph**: RDFLib for loan relationship mapping and data lineage
- **Migration Support**: Alembic for database schema migrations

### Authentication and Authorization
- Session-based authentication with FastAPI SessionMiddleware
- JWT token support with python-jose and bcrypt password hashing
- Role-based access control for different user types (Seller, Buyer, Agency profiles)
- OAuth integration ready with dedicated auth router

### Key Design Patterns
- **Multi-Agent Architecture**: Specialized agents handle different aspects of loan processing
- **Event-Driven Processing**: WebSocket-based real-time updates and notifications
- **Pipeline Pattern**: Sequential processing stages with validation gates
- **Exception Handling**: Comprehensive exception taxonomy with auto-fix suggestions
- **Compliance Tracking**: Built-in RESPA/TILA compliance monitoring
- **Hybrid Database Strategy**: SQLAlchemy for relational data, TinyDB for document staging
- **Proxy Pattern**: Node.js proxy layer for seamless frontend-backend integration
- **Repository Pattern**: Service layer abstraction for data access

## External Dependencies

### Database Services
- **SQLAlchemy**: Python SQL toolkit and ORM with SQLite/PostgreSQL support
- **Alembic**: Database migration tool for SQLAlchemy
- **TinyDB**: Lightweight document database for staging and configuration

### AI and ML Services
- **OpenAI**: AI agent orchestration and document processing capabilities
- **PyTesseract**: OCR engine for document text extraction
- **Pillow**: Python imaging library for document preprocessing

### Third-Party APIs
- **Agency APIs**: Integration with Fannie Mae, Freddie Mac, and Ginnie Mae systems
- **HTTPX**: Modern async HTTP client for external API communications
- **Websockets**: Real-time bidirectional communication protocol

### Infrastructure Services
- **S3-Compatible Storage**: Document and file storage for loan packages
- **WebSocket Services**: Real-time agent status and pipeline updates
- **OpenSearch**: Document search and indexing capabilities

### UI and Component Libraries
- **Radix UI**: Complete set of accessible component primitives (40+ components)
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **Lucide React**: Modern icon library with 1000+ icons
- **Recharts**: Composable charting library for React
- **React Icons**: Popular icon libraries integration
- **Embla Carousel**: Lightweight carousel library
- **Vaul**: Drawer component for mobile interfaces
- **CMDK**: Command palette component
- **Next Themes**: Theme switching capability

### Development Tools
- **Vite**: Build tool and development server with React plugin
- **ESBuild**: JavaScript bundler for production builds
- **TSX**: TypeScript execution engine for development
- **TypeScript**: Static type checking and enhanced IDE support
- **PostCSS**: CSS processing with Tailwind and Autoprefixer
- **Concurrently**: Run multiple development servers simultaneously
- **Uvicorn**: ASGI server for FastAPI applications
- **Loguru**: Enhanced Python logging with structured output

## Current Development Status

### Implemented Features
- ✅ Multi-agent system architecture with WebSocket communication
- ✅ Document staging and processing pipeline
- ✅ MISMO-aligned validation rule engine
- ✅ Exception management with auto-fix suggestions
- ✅ Real-time dashboard with metrics tracking
- ✅ S3-compatible document storage integration
- ✅ TinyDB-based staging system for development
- ✅ Comprehensive UI component library with 40+ Radix components
- ✅ FastAPI backend with automatic OpenAPI documentation

### Development Environment
- **Package Manager**: npm with package-lock.json for dependency management
- **Build System**: Vite for frontend, ESBuild for production bundling
- **Database**: SQLite for development, PostgreSQL-ready models for production
- **Container Support**: Dockerfile available for deployment
- **Railway Integration**: railway.json configuration for cloud deployment

## Support

For business logic questions, refer to `requirements.md`.
