# Co-Issue Loan Boarding - Multi-Agent Pipeline

## Overview

A comprehensive loan boarding automation system designed to transform co-issue loan boarding bottlenecks into a high-FPY (First-Pass Yield), low-latency, compliant pipeline. The system uses multiple specialized AI agents to orchestrate document processing, data validation, exception handling, and compliance management for mortgage loan boarding operations.

The application demonstrates an end-to-end loan boarding workflow that processes commitments, purchase advice, loan data (ULDD), and documents through automated pipelines with real-time monitoring and exception management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for development
- **UI Components**: Shadcn/ui component library with Tailwind CSS for styling
- **State Management**: Zustand for global state management
- **Data Fetching**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Real-time Updates**: WebSocket integration for live data updates

### Backend Architecture
- **Primary Backend**: Python FastAPI with all business logic and data processing
- **Proxy Layer**: Minimal Node.js Express server that forwards API calls to Python
- **Multi-Agent System**: 
  - PlannerAgent: Task orchestration and workflow planning
  - ToolAgent: Executes specific boarding tools and operations
  - VerifierAgent: Data validation and rule-based verification
  - DocumentAgent: Document processing, OCR, and classification
- **Task Orchestration**: DAG-based task execution with explicit error handling

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Drizzle ORM for schema management
- **Session Storage**: Connect-pg-simple for PostgreSQL-backed sessions
- **Document Storage**: S3-compatible storage for loan documents
- **Configuration**: TinyDB for fixtures and configuration data
- **Knowledge Graph**: RDFLib for relationship mapping

### Authentication and Authorization
- Session-based authentication with PostgreSQL backing
- Role-based access control for different user types (Seller, Buyer, Agency profiles)

### Key Design Patterns
- **Multi-Agent Architecture**: Specialized agents handle different aspects of loan processing
- **Event-Driven Processing**: WebSocket-based real-time updates and notifications
- **Pipeline Pattern**: Sequential processing stages with validation gates
- **Exception Handling**: Comprehensive exception taxonomy with auto-fix suggestions
- **Compliance Tracking**: Built-in RESPA/TILA compliance monitoring

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting (@neondatabase/serverless)
- **Drizzle**: Type-safe ORM with PostgreSQL dialect

### AI and ML Services
- **OpenAI**: AI agent orchestration and document processing capabilities

### Third-Party APIs
- **Agency APIs**: Integration with Fannie Mae, Freddie Mac, and Ginnie Mae systems for commitment and purchase advice data

### Infrastructure Services
- **S3-Compatible Storage**: Document and file storage for loan packages
- **WebSocket Services**: Real-time communication and status updates

### UI and Component Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Recharts**: Data visualization components

### Development Tools
- **Vite**: Build tool and development server
- **ESBuild**: JavaScript bundler for production
- **PostCSS**: CSS processing with Tailwind