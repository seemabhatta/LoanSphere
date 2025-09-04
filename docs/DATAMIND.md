# DataMind AI Assistant

AI-powered natural language data analysis and visualization platform integrated into LoanSphere.

## Overview

DataMind enables users to interact with Snowflake databases using natural language queries and automatically generate interactive visualizations. The system leverages OpenAI's Agents SDK to provide autonomous data exploration capabilities.

### Key Features

- **Natural Language Querying**: Ask questions in plain English about your data
- **Interactive Visualizations**: Automatic chart generation with Plotly
- **Data Dictionary Generation**: Automated YAML schema documentation
- **Session Memory**: Maintains context across conversations
- **Real-time Results**: Streaming responses with live chart updates

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│                                                              │
│   React UI (ai-assistant-datamind.tsx)                      │
│   ├── Chat Interface                                        │
│   ├── Mode Selector (Query/Dictionary)                      │
│   └── PlotlyChart Component (iframe sandbox)                │
│                                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                       │
│                                                              │
│   FastAPI Router (datamind_api.py)                          │
│   ├── Session Management                                    │
│   ├── Request/Response Handling                             │
│   └── Visualization Store Integration                       │
│                                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATION LAYER                 │
│                                                              │
│   OpenAI Agents SDK                                         │
│   ├── Query Agent (snowflake_agent)                         │
│   │   └── Tools: SQL execution, YAML loading, Visualization │
│   └── Dictionary Agent (dictionary_agent)                   │
│       └── Tools: Schema exploration, YAML generation        │
│                                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA & AI SERVICES                      │
│                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌──────────────┐      │
│   │  Snowflake  │  │  OpenAI API │  │   SQLite     │      │
│   │  Database   │  │  (LLM)      │  │   Sessions   │      │
│   └─────────────┘  └─────────────┘  └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **React** + **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Radix UI** - Component primitives
- **Custom iframe** - Secure chart rendering

### Backend API Layer
- **FastAPI** - REST API wrapper
- **Pydantic** - Data validation
- **Asyncio** - Async request handling
- **Threading** - Visualization storage

### DataMind Core Engine
- **OpenAI Agents SDK** - Agent orchestration
- **SQLite** - Session/memory storage
- **OpenAI API** - LLM calls
- **Snowflake Connector** - Database connectivity
- **PyYAML** - Data dictionary parsing
- **Protobuf** - Data serialization

### Data & Visualization
- **Pandas** - Data manipulation
- **Plotly** - Interactive charts (Python → HTML → React)
- **Matplotlib/Seaborn/Statsmodels** - Additional visualization libraries

## Setup & Configuration

### Environment Variables

Add these to your `.env` file or Railway environment variables:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Snowflake Configuration
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_WAREHOUSE=your_warehouse
SNOWFLAKE_DATABASE=your_database
SNOWFLAKE_SCHEMA=your_schema
SNOWFLAKE_ROLE=your_role
```

### Dependencies

All required dependencies are already included in `server/requirements.txt`:

```
openai-agents==0.2.9
snowflake-connector-python==3.17.2
pandas==2.1.4
plotly>=5.0.0
matplotlib>=3.5.0
seaborn>=0.11.0
statsmodels>=0.13.0
PyYAML==6.0.2
```

### Access

Navigate to `/datamind` in your LoanSphere application to access the DataMind Assistant.

## Usage Guide

### Query Mode

**Natural Language Data Exploration:**

1. **Load a Data Dictionary:**
   - Select from available YAML files
   - Example: "Load product_dictionary.yaml"

2. **Ask Business Questions:**
   - "How many products do we have?"
   - "Show me sales by region"
   - "What are the top 10 customers by revenue?"

3. **Request Visualizations:**
   - "Create a pie chart of this data"
   - "Show me a bar chart of sales by month"
   - "Generate a line chart showing trends"

### Dictionary Generation Mode

**Automated Schema Documentation:**

1. **Explore Database Structure:**
   - "Show me available databases"
   - "List tables in the current schema"

2. **Generate Documentation:**
   - "Create a YAML dictionary for the CUSTOMERS table"
   - "Generate documentation for all tables in this schema"

### Example Workflow

```
User: "Load the product dictionary"
DataMind: ✅ Loaded product_dictionary.yaml with PRODUCT table data

User: "How many products are in each category?"
DataMind: 📊 Found 5 product categories:
- Electronics: 150 products
- Clothing: 89 products
- Books: 234 products
- Home: 67 products
- Toys: 45 products

User: "Show this as a pie chart"
DataMind: ✅ Created interactive pie chart [CHART DISPLAYS]
```

## Technical Implementation Details

### Visualization Bypass Pattern

**Problem:** OpenAI Agents SDK sanitizes HTML content from agent responses.

**Solution:** Store chart HTML separately from text responses:

1. **Visualization Generation:** Agent creates Plotly chart → HTML stored in memory
2. **Text Response:** Agent returns clean text without HTML
3. **API Integration:** FastAPI retrieves stored HTML and combines with response
4. **Frontend Rendering:** React displays chart in sandboxed iframe

### Session Management

- **SQLiteSession:** Maintains conversation context and memory
- **Agent Context:** Stores query results, database connections, loaded YAML files
- **Session Isolation:** Each chat session is independent

### Security Considerations

- **Iframe Sandboxing:** Charts rendered with `sandbox="allow-scripts allow-same-origin"`
- **SQL Injection Prevention:** Parameterized queries through Snowflake connector
- **Environment Variable Protection:** Credentials stored securely, not in code

## Data Flow

1. **User Query** → React UI → FastAPI Router
2. **Agent Processing** → OpenAI Agents SDK → Tool Execution
3. **Data Access** → Snowflake Connector → Query Execution
4. **Visualization** → Plotly Generation → Memory Storage
5. **Response Assembly** → FastAPI combines text + visualization
6. **Frontend Display** → React renders message + embedded chart

## Troubleshooting

### Common Issues

**1. "No Snowflake connection"**
- Verify all `SNOWFLAKE_*` environment variables are set
- Check network connectivity to Snowflake
- Validate credentials

**2. "Charts not displaying"**
- Check browser console for iframe errors
- Verify Plotly dependencies in requirements.txt
- Ensure visualization storage is functioning

**3. "Agent timeout errors"**
- Increase timeout values in datamind_api.py
- Check OpenAI API rate limits
- Verify OPENAI_API_KEY is valid

### Debug Logging

Enable debug logging to trace issues:

```python
# Look for these debug messages in server logs:
DEBUG VIZ: Starting visualization...
DEBUG VIZ STORE: Storing visualization...
DEBUG: Executing SQL...
```

## Performance Considerations

- **Session Caching:** SQLite sessions reduce initialization overhead
- **Visualization Storage:** In-memory storage with 30-second expiry
- **Async Processing:** Non-blocking request handling
- **Connection Pooling:** Snowflake connections are reused

## Future Enhancements

- **Multi-database Support:** Beyond Snowflake
- **Advanced Chart Types:** 3D visualizations, geographic maps
- **Export Capabilities:** PDF/PNG chart downloads
- **Collaborative Features:** Shared sessions and reports
- **Custom Dashboards:** Persistent visualization collections

---

## Support

For technical issues or questions about DataMind integration, refer to the main LoanSphere documentation or contact the development team.