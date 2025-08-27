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
- **Donot make any changes to backend**: Your role is to enhance frontend experience only
## Support

For business logic questions, refer to `requirements.md`.
