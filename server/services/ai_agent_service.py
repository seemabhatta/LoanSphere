"""
AI Agent Service for LoanSphere
Uses OpenAI Agent SDK following DataMind pattern to provide conversational interface 
for querying loan data, purchase advice, and commitments
"""
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from dataclasses import dataclass

# OpenAI Agent SDK imports (following DataMind pattern)
AGENTS_AVAILABLE = True
try:
    from agents import Agent, Runner, function_tool, SQLiteSession
except Exception as _e:  # ImportError or other
    AGENTS_AVAILABLE = False
    # Define a no-op decorator so module import doesn't fail where used
    def function_tool(func=None, *args, **kwargs):
        def wrapper(f):
            return f
        return wrapper(func) if callable(func) else wrapper

from services.loan_data_service import get_loan_data_service
from services.purchase_advice_service import get_purchase_advice_service
from services.commitment_service import get_commitment_service
from services.loan_tracking_service import LoanTrackingService

# Module-level function tools (avoid bound methods so JSON schema doesn't include 'self')
@function_tool
def tool_get_all_loan_data() -> str:
    """Get all loan data documents"""
    try:
        loan_data_service = get_loan_data_service()
        results = loan_data_service.get_all_loan_data()
        if not results:
            return "No loan data documents found in the system."
        summary = f"Found {len(results)} loan data documents:\n"
        for i, doc in enumerate(results[:10], 1):
            loan_id = doc.get('id') or doc.get('loan_data_id') or 'Unknown'
            stored_at = doc.get('stored_at', 'Unknown')
            summary += f"{i}. ID: {loan_id} (Stored: {stored_at})\n"
        if len(results) > 10:
            summary += f"... and {len(results) - 10} more documents"
        return summary
    except Exception as e:
        logger.error(f"Error getting loan data: {e}")
        return f"Error retrieving loan data: {str(e)}"

@function_tool
def tool_get_loan_data_by_id(loan_id: str) -> str:
    """Get specific loan data document by ID"""
    try:
        loan_data_service = get_loan_data_service()
        result = loan_data_service.get_loan_data(loan_id)
        if not result:
            return f"No loan data found for ID: {loan_id}"
        stored = result.get('processed_at') or result.get('stored_at') or 'N/A'
        summary = f"Loan Data for ID: {loan_id}\n"
        summary += f"- Stored/Processed At: {stored}\n"
        # Try to detect type hints and identifiers in payload
        data = result.get('data') or result.get('loan_data') or {}
        if isinstance(data, dict):
            if 'ULDD' in data or 'MISMO' in data or 'DEAL' in data:
                summary += "- Contains ULDD/MISMO formatted loan data\n"
            xp = None
            if isinstance(data.get('eventMetadata'), dict):
                xp = data['eventMetadata'].get('xpLoanNumber')
            if xp:
                summary += f"- XP Loan Number: {xp}\n"
        return summary
    except Exception as e:
        logger.error(f"Error getting loan data by ID: {e}")
        return f"Error retrieving loan data for {loan_id}: {str(e)}"

@function_tool
def tool_get_loan_data_raw_by_id(loan_id: str) -> str:
    """Get raw loan data JSON by ID"""
    try:
        lds = get_loan_data_service()
        raw = lds.tinydb.get_loan_data(loan_id)
        if not raw:
            return f"No raw loan data found for ID: {loan_id}"
        data = raw.get('loan_data', raw)
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error getting raw loan data by ID: {e}")
        return f"Error retrieving raw loan data for {loan_id}: {str(e)}"

@function_tool
def tool_get_latest_loan_data_raw() -> str:
    """Get raw JSON for the most recently processed loan data"""
    try:
        tdb = get_loan_data_service().tinydb
        items = tdb.get_all_loan_data()
        if not items:
            return "No loan data documents found."
        def key_fn(it):
            return it.get('processed_at') or it.get('stored_at') or ''
        latest = sorted(items, key=key_fn, reverse=True)[0]
        data = latest.get('loan_data', latest)
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error getting latest raw loan data: {e}")
        return f"Error retrieving latest raw loan data: {str(e)}"

@function_tool
def tool_get_latest_loan_data_summary() -> str:
    """Get a concise summary of the most recently processed loan data"""
    try:
        tdb = get_loan_data_service().tinydb
        items = tdb.get_all_loan_data()
        if not items:
            return "No loan data documents found."
        def key_fn(it):
            return it.get('processed_at') or it.get('stored_at') or ''
        latest = sorted(items, key=key_fn, reverse=True)[0]
        data = latest.get('loan_data') or {}
        xp = None
        if isinstance(data.get('eventMetadata'), dict):
            xp = data['eventMetadata'].get('xpLoanNumber')
        return (
            f"Latest Loan Data\n"
            f"- ID: {latest.get('id') or latest.get('loan_data_id')}\n"
            f"- XP Loan Number: {xp or 'N/A'}\n"
            f"- ULDD/MISMO: {'yes' if ('DEAL' in data or 'ULDD' in data or 'MISMO' in data) else 'unknown'}\n"
            f"- Timestamp: {latest.get('processed_at') or latest.get('stored_at') or 'N/A'}"
        )
    except Exception as e:
        logger.error(f"Error getting latest loan data summary: {e}")
        return f"Error retrieving latest loan data summary: {str(e)}"

@function_tool
def tool_get_loan_data_full_by_id(loan_id: str) -> str:
    """Get full details for loan data: transformed fields (if any) + raw JSON"""
    try:
        lds = get_loan_data_service()
        transformed = lds.get_loan_data(loan_id)
        raw = lds.tinydb.get_loan_data(loan_id)
        if not raw and not transformed:
            return f"No loan data found for ID: {loan_id}"
        payload = {
            'transformed': transformed,
            'raw': (raw or {}).get('loan_data', raw)
        }
        return json.dumps(payload, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error getting full loan data by ID: {e}")
        return f"Error retrieving full loan data for {loan_id}: {str(e)}"

@function_tool
def tool_list_loan_data_json() -> str:
    """List loan data docs as JSON array with id and timestamps"""
    try:
        lds = get_loan_data_service()
        items = lds.get_all_loan_data()
        out = []
        for it in items:
            out.append({
                'id': it.get('id') or it.get('loan_data_id'),
                'stored_at': it.get('stored_at'),
                'status': it.get('status'),
            })
        return json.dumps(out, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error listing loan data json: {e}")
        return f"Error listing loan data json: {str(e)}"

@function_tool
def tool_get_all_purchase_advices() -> str:
    """Get all purchase advice documents"""
    try:
        pa_service = get_purchase_advice_service()
        results = pa_service.get_all_purchase_advices()
        if not results:
            return "No purchase advice documents found in the system."
        summary = f"Found {len(results)} purchase advice documents:\n"
        for i, doc in enumerate(results[:10], 1):
            pa_id = doc.get('id') or doc.get('purchase_advice_id') or 'Unknown'
            stored_at = doc.get('stored_at', 'Unknown')
            summary += f"{i}. ID: {pa_id} (Stored: {stored_at})\n"
        if len(results) > 10:
            summary += f"... and {len(results) - 10} more documents"
        return summary
    except Exception as e:
        logger.error(f"Error getting purchase advice: {e}")
        return f"Error retrieving purchase advice: {str(e)}"

@function_tool
def tool_get_purchase_advice_by_id(pa_id: str) -> str:
    """Get specific purchase advice document by ID"""
    try:
        pa_service = get_purchase_advice_service()
        result = pa_service.get_purchase_advice(pa_id)
        if not result:
            return f"No purchase advice found for ID: {pa_id}"
        stored = result.get('processed_at') or result.get('stored_at') or 'N/A'
        data = result.get('purchase_data') or {}
        seller = data.get('sellerNumber') or (data.get('purchaseAdviceData') or {}).get('sellerNumber')
        servicer = data.get('servicerNumber') or (data.get('purchaseAdviceData') or {}).get('servicerNumber')
        prin = data.get('prinPurchased') or (data.get('purchaseAdviceData') or {}).get('prinPurchased')
        summary = f"Purchase Advice for ID: {pa_id}\n"
        summary += f"- Seller Number: {seller or 'N/A'}\n"
        summary += f"- Servicer Number: {servicer or 'N/A'}\n"
        summary += f"- Principal Purchased: {prin or 'N/A'}\n"
        summary += f"- Stored/Processed At: {stored}\n"
        return summary
    except Exception as e:
        logger.error(f"Error getting purchase advice by ID: {e}")
        return f"Error retrieving purchase advice for {pa_id}: {str(e)}"

@function_tool
def tool_get_purchase_advice_raw_by_id(pa_id: str) -> str:
    """Get raw purchase advice JSON by ID"""
    try:
        pas = get_purchase_advice_service()
        raw = pas.tinydb.get_purchase_advice(pa_id)
        if not raw:
            return f"No raw purchase advice found for ID: {pa_id}"
        data = raw.get('purchase_data', raw)
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error getting raw purchase advice by ID: {e}")
        return f"Error retrieving raw purchase advice for {pa_id}: {str(e)}"

@function_tool
def tool_get_latest_purchase_advice_raw() -> str:
    """Get raw JSON for the most recently processed purchase advice"""
    try:
        tdb = get_purchase_advice_service().tinydb
        items = tdb.get_all_purchase_advice()
        if not items:
            return "No purchase advice documents found."
        def key_fn(it):
            return it.get('processed_at') or it.get('stored_at') or ''
        latest = sorted(items, key=key_fn, reverse=True)[0]
        data = latest.get('purchase_data', latest)
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error getting latest raw purchase advice: {e}")
        return f"Error retrieving latest raw purchase advice: {str(e)}"

@function_tool
def tool_list_purchase_advices_json() -> str:
    """List purchase advices as JSON array with id and timestamps"""
    try:
        pas = get_purchase_advice_service()
        items = pas.get_all_purchase_advices()
        out = []
        for it in items:
            out.append({
                'id': it.get('id') or it.get('purchase_advice_id'),
                'stored_at': it.get('stored_at'),
                'status': it.get('status'),
            })
        return json.dumps(out, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error listing purchase advices json: {e}")
        return f"Error listing purchase advices json: {str(e)}"

@function_tool
def tool_get_latest_purchase_advice_summary() -> str:
    """Get a concise summary of the most recently processed purchase advice"""
    try:
        tdb = get_purchase_advice_service().tinydb
        items = tdb.get_all_purchase_advice()
        if not items:
            return "No purchase advice documents found."
        def key_fn(it):
            return it.get('processed_at') or it.get('stored_at') or ''
        latest = sorted(items, key=key_fn, reverse=True)[0]
        data = latest.get('purchase_data') or {}
        seller = data.get('sellerNumber') or (data.get('purchaseAdviceData') or {}).get('sellerNumber')
        servicer = data.get('servicerNumber') or (data.get('purchaseAdviceData') or {}).get('servicerNumber')
        prin = data.get('prinPurchased') or (data.get('purchaseAdviceData') or {}).get('prinPurchased')
        return (
            f"Latest Purchase Advice\n"
            f"- ID: {latest.get('id') or latest.get('purchase_advice_id')}\n"
            f"- Seller Number: {seller or 'N/A'}\n"
            f"- Servicer Number: {servicer or 'N/A'}\n"
            f"- Principal Purchased: {prin or 'N/A'}\n"
            f"- Timestamp: {latest.get('processed_at') or latest.get('stored_at') or 'N/A'}"
        )
    except Exception as e:
        logger.error(f"Error getting latest purchase advice summary: {e}")
        return f"Error retrieving latest purchase advice summary: {str(e)}"

@function_tool
def tool_get_purchase_advice_full_by_id(pa_id: str) -> str:
    """Get full details for purchase advice: transformed (minimal) + raw JSON"""
    try:
        pas = get_purchase_advice_service()
        transformed = pas.get_purchase_advice(pa_id)
        raw = pas.tinydb.get_purchase_advice(pa_id)
        if not raw and not transformed:
            return f"No purchase advice found for ID: {pa_id}"
        payload = {
            'transformed': transformed,
            'raw': (raw or {}).get('purchase_data', raw)
        }
        return json.dumps(payload, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error getting full purchase advice by ID: {e}")
        return f"Error retrieving full purchase advice for {pa_id}: {str(e)}"

@function_tool
def tool_get_all_commitments() -> str:
    """Get all commitment documents"""
    try:
        commitment_service = get_commitment_service()
        results = commitment_service.get_all_commitments()
        if not results:
            return "No commitment documents found in the system."
        summary = f"Found {len(results)} commitment documents:\n"
        for i, doc in enumerate(results[:10], 1):
            # Transformed docs use 'id' and 'commitmentId'
            commitment_id = doc.get('id') or doc.get('commitmentId') or 'Unknown'
            stored_at = doc.get('stored_at') or doc.get('createdAt') or doc.get('updatedAt') or 'Unknown'
            summary += f"{i}. ID: {commitment_id} (alias: {doc.get('commitmentId','N/A')}) Stored: {stored_at}\n"
        if len(results) > 10:
            summary += f"... and {len(results) - 10} more documents"
        return summary
    except Exception as e:
        logger.error(f"Error getting commitments: {e}")
        return f"Error retrieving commitments: {str(e)}"

@function_tool
def tool_get_commitment_by_id(commitment_id: str) -> str:
    """Get specific commitment document by ID"""
    try:
        commitment_service = get_commitment_service()
        result = commitment_service.get_commitment(commitment_id)
        if not result:
            return f"No commitment found for ID: {commitment_id}"
        summary = f"Commitment for ID: {commitment_id}\n"
        summary += f"- Agency: {result.get('agency', 'unknown')}\n"
        summary += f"- Investor Loan Number: {result.get('investorLoanNumber', 'N/A')}\n"
        summary += f"- Stored/Processed At: {result.get('createdAt') or result.get('updatedAt') or result.get('stored_at', 'N/A')}\n"
        return summary
    except Exception as e:
        logger.error(f"Error getting commitment by ID: {e}")
        return f"Error retrieving commitment for {commitment_id}: {str(e)}"

@function_tool
def tool_get_commitment_raw_by_id(commitment_id: str) -> str:
    """Get raw commitment JSON by ID"""
    try:
        cs = get_commitment_service()
        raw = cs.tinydb.get_commitment(commitment_id)
        if not raw:
            return f"No raw commitment found for ID: {commitment_id}"
        # Return only the stored raw payload if available
        data = raw.get('commitment_data', raw)
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error getting raw commitment by ID: {e}")
        return f"Error retrieving raw commitment for {commitment_id}: {str(e)}"

@function_tool
def tool_get_latest_commitment_raw() -> str:
    """Get raw JSON for the most recently processed commitment"""
    try:
        tdb = get_commitment_service().tinydb
        items = tdb.get_all_commitments()
        if not items:
            return "No commitments found."
        # Sort by processed_at descending; fall back to insertion order
        def key_fn(it):
            return it.get('processed_at') or ''
        latest = sorted(items, key=key_fn, reverse=True)[0]
        data = latest.get('commitment_data', latest)
        return json.dumps(data, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error getting latest raw commitment: {e}")
        return f"Error retrieving latest raw commitment: {str(e)}"

@function_tool
def tool_get_latest_commitment_summary() -> str:
    """Get a concise summary of the most recently processed commitment"""
    try:
        cs = get_commitment_service()
        items = cs.get_all_commitments()
        if not items:
            return "No commitment documents found."
        def key_fn(it):
            return it.get('updatedAt') or it.get('createdAt') or ''
        latest = sorted(items, key=key_fn, reverse=True)[0]
        return (
            f"Latest Commitment\n"
            f"- ID: {latest.get('id')} (alias: {latest.get('commitmentId')} )\n"
            f"- Agency: {latest.get('agency','unknown')}\n"
            f"- Investor Loan Number: {latest.get('investorLoanNumber','N/A')}\n"
            f"- Status: {latest.get('status','N/A')}\n"
            f"- Timestamp: {latest.get('updatedAt') or latest.get('createdAt') or 'N/A'}"
        )
    except Exception as e:
        logger.error(f"Error getting latest commitment summary: {e}")
        return f"Error retrieving latest commitment summary: {str(e)}"

@function_tool
def tool_get_commitment_full_by_id(commitment_id: str) -> str:
    """Get full details for a commitment: transformed fields + raw JSON"""
    try:
        cs = get_commitment_service()
        transformed = cs.get_commitment(commitment_id)
        raw = cs.tinydb.get_commitment(commitment_id)
        if not raw and not transformed:
            return f"No commitment found for ID: {commitment_id}"
        payload = {
            'transformed': transformed,
            'raw': (raw or {}).get('commitment_data', raw)
        }
        return json.dumps(payload, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error getting full commitment by ID: {e}")
        return f"Error retrieving full commitment for {commitment_id}: {str(e)}"

@function_tool
def tool_list_commitments_json() -> str:
    """List commitments as JSON array with id, alias, and timestamps"""
    try:
        cs = get_commitment_service()
        transformed = cs.get_all_commitments()
        out = []
        for c in transformed:
            out.append({
                'id': c.get('id'),
                'commitmentId': c.get('commitmentId'),
                'agency': c.get('agency'),
                'investorLoanNumber': c.get('investorLoanNumber'),
                'createdAt': c.get('createdAt'),
                'updatedAt': c.get('updatedAt'),
            })
        return json.dumps(out, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error listing commitments json: {e}")
        return f"Error listing commitments json: {str(e)}"

@function_tool
def tool_get_loan_tracking_records() -> str:
    """Get all loan tracking records"""
    try:
        lts = LoanTrackingService()
        results = lts.get_all_tracking_records()
        if not results:
            return "No loan tracking records found in the system."
        summary = f"Found {len(results)} loan tracking records:\n"
        for i, record in enumerate(results[:10], 1):
            xp_loan_number = record.get('xpLoanNumber', 'Unknown')
            status = record.get('status', 'Unknown')
            summary += f"{i}. Loan: {xp_loan_number} (Status: {status})\n"
        if len(results) > 10:
            summary += f"... and {len(results) - 10} more records"
        return summary
    except Exception as e:
        logger.error(f"Error getting loan tracking records: {e}")
        return f"Error retrieving loan tracking records: {str(e)}"

@function_tool
def tool_search_by_loan_number(xp_loan_number: str) -> str:
    """Search across all data types for a specific loan number"""
    try:
        summary = f"Search results for loan number: {xp_loan_number}\n\n"
        # tracking
        lts = LoanTrackingService()
        tracking_records = lts.get_all_tracking_records()
        matching_tracking = [r for r in tracking_records if r.get('xpLoanNumber') == xp_loan_number]
        if matching_tracking:
            summary += f"Loan Tracking: Found {len(matching_tracking)} records\n"
            for record in matching_tracking:
                status = record.get('status', 'Unknown')
                summary += f"  - Status: {status}\n"
        # commitments
        cs = get_commitment_service()
        commitments = cs.get_all_commitments()
        matching_commitments = [c for c in commitments if xp_loan_number in str(c)]
        if matching_commitments:
            summary += f"Commitments: Found {len(matching_commitments)} documents\n"
        # purchase advice
        ps = get_purchase_advice_service()
        purchase_advices = ps.get_all_purchase_advices()
        matching_pa = [pa for pa in purchase_advices if xp_loan_number in str(pa)]
        if matching_pa:
            summary += f"Purchase Advice: Found {len(matching_pa)} documents\n"
        # loan data
        lds = get_loan_data_service()
        loan_data = lds.get_all_loan_data()
        matching_loan_data = [ld for ld in loan_data if xp_loan_number in str(ld)]
        if matching_loan_data:
            summary += f"Loan Data: Found {len(matching_loan_data)} documents\n"
        if not any([matching_tracking, matching_commitments, matching_pa, matching_loan_data]):
            summary += "No matching records found."
        return summary
    except Exception as e:
        logger.error(f"Error searching by loan number: {e}")
        return f"Error searching for loan number {xp_loan_number}: {str(e)}"


@dataclass
class AgentContext:
    """Context to track conversation state"""
    conversation_history: List[Dict[str, str]]
    current_query: Optional[str] = None
    last_results: Optional[Dict[str, Any]] = None
    filters: Optional[Dict[str, Any]] = None
    
    def add_message(self, role: str, content: str):
        """Add message to conversation history"""
        self.conversation_history.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })


class LoanSphereAgent:
    """AI Agent for LoanSphere loan data queries using OpenAI Agent SDK"""
    
    def __init__(self):
        if not AGENTS_AVAILABLE:
            raise ImportError("The 'agents' package is not installed. Install openai-agents to enable AI features.")
        self.loan_data_service = get_loan_data_service()
        self.purchase_advice_service = get_purchase_advice_service()
        self.commitment_service = get_commitment_service()
        self.loan_tracking_service = LoanTrackingService()
        self.context = AgentContext(conversation_history=[])
        
        # Get OpenAI API key from environment
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        # Select model (configurable via OPENAI_MODEL). Defaults to gpt-4o.
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        logger.info(f"Initializing LoanSphere Agent with model: {model_name}")

        # Create agent with instructions and tools
        self.agent = Agent(
            name="LoanSphere AI Assistant",
            model=model_name,
            instructions="""
            You are a helpful AI assistant for LoanSphere, a loan boarding system. Your role is to help users query and analyze:
            - Loan Data (ULDD/MISMO format documents)
            - Purchase Advice documents  
            - Commitment documents
            - Loan Tracking records
            
            You have access to specialized tools to search, filter, and analyze this data. Always:
            1. Be helpful and conversational
            2. Explain what data you're searching when you use tools
            3. Provide meaningful summaries of results
            4. Suggest follow-up questions or analysis
            5. If asked about specific loan numbers, use them as filters
            6. Format responses clearly with bullet points or tables when appropriate

            When you list commitments, you will see lines like:
            "ID: <id> (alias: <commitmentId>) ...".
            If the user asks to "show" or "open" a commitment afterwards, call the tool to fetch details using the exact ID value shown after "ID:".
            
            Available data types:
            - Loan Data: Raw ULDD/MISMO loan documents with detailed loan information
            - Purchase Advice: Documents related to loan purchases and advice
            - Commitments: Loan commitment documents and agreements
            - Loan Tracking: Records tracking loan processing status and history
            
            When users ask vague questions, help them by suggesting specific queries they might want to make.

            For follow-ups like "details" or "details for the last X shown", use the following behavior:
            - If no ID is provided and the user doesn't ask for raw, return the latest SUMMARY for that type.
            - If the user explicitly asks for "raw" details, return the latest RAW JSON payload for that type, or the specific record's raw JSON if an ID is provided.
            - When listing, present IDs clearly (e.g., "ID: <id>") and then prefer that ID in subsequent detail calls.
            - If the user says "show me everything" or "current details is not good", respond with the FULL DETAILS tool for that type (combined transformed + raw JSON) for the last-listed or latest record.
        """,
            tools=[
                tool_get_all_loan_data,
                tool_get_loan_data_by_id,
                tool_get_all_purchase_advices,
                tool_get_purchase_advice_by_id,
                tool_get_all_commitments,
                tool_get_commitment_by_id,
                tool_get_commitment_raw_by_id,
                tool_get_latest_commitment_raw,
                tool_get_latest_commitment_summary,
                tool_get_commitment_full_by_id,
                tool_list_commitments_json,
                tool_get_loan_data_raw_by_id,
                tool_get_latest_loan_data_raw,
                tool_get_latest_loan_data_summary,
                tool_get_loan_data_full_by_id,
                tool_list_loan_data_json,
                tool_get_purchase_advice_raw_by_id,
                tool_get_latest_purchase_advice_raw,
                tool_get_latest_purchase_advice_summary,
                tool_get_purchase_advice_full_by_id,
                tool_list_purchase_advices_json,
                tool_get_loan_tracking_records,
                tool_search_by_loan_number,
            ]
        )
    
    @function_tool
    def get_all_loan_data(self) -> str:
        """Get all loan data documents"""
        try:
            results = self.loan_data_service.get_all_loan_data()
            self.context.last_results = {"type": "loan_data", "data": results}
            
            if not results:
                return "No loan data documents found in the system."
                
            summary = f"Found {len(results)} loan data documents:\n"
            for i, doc in enumerate(results[:10], 1):  # Show first 10
                loan_id = doc.get('loan_data_id', 'Unknown')
                stored_at = doc.get('stored_at', 'Unknown')
                summary += f"{i}. Loan ID: {loan_id} (Stored: {stored_at})\n"
            
            if len(results) > 10:
                summary += f"... and {len(results) - 10} more documents"
                
            return summary
        except Exception as e:
            logger.error(f"Error getting loan data: {e}")
            return f"Error retrieving loan data: {str(e)}"
    
    @function_tool
    def get_loan_data_by_id(self, loan_id: str) -> str:
        """Get specific loan data document by ID"""
        try:
            result = self.loan_data_service.get_loan_data(loan_id)
            
            if not result:
                return f"No loan data found for ID: {loan_id}"
            
            self.context.last_results = {"type": "loan_data", "data": result}
            
            # Extract key information for summary
            summary = f"Loan Data for ID: {loan_id}\n"
            summary += f"- Document ID: {result.get('doc_id', 'N/A')}\n"
            summary += f"- Stored At: {result.get('stored_at', 'N/A')}\n"
            
            # Try to extract meaningful loan details from the data
            loan_data = result.get('loan_data', {})
            if 'DEAL' in loan_data:
                deal = loan_data['DEAL']
                if 'LOANS' in deal and 'LOAN' in deal['LOANS']:
                    summary += "- Contains ULDD/MISMO formatted loan data\n"
            
            return summary
        except Exception as e:
            logger.error(f"Error getting loan data by ID: {e}")
            return f"Error retrieving loan data for {loan_id}: {str(e)}"
    
    @function_tool
    def get_all_purchase_advices(self) -> str:
        """Get all purchase advice documents"""
        try:
            results = self.purchase_advice_service.get_all_purchase_advices()
            self.context.last_results = {"type": "purchase_advice", "data": results}
            
            if not results:
                return "No purchase advice documents found in the system."
                
            summary = f"Found {len(results)} purchase advice documents:\n"
            for i, doc in enumerate(results[:10], 1):
                pa_id = doc.get('purchase_advice_id', 'Unknown')
                stored_at = doc.get('stored_at', 'Unknown')
                summary += f"{i}. PA ID: {pa_id} (Stored: {stored_at})\n"
            
            if len(results) > 10:
                summary += f"... and {len(results) - 10} more documents"
                
            return summary
        except Exception as e:
            logger.error(f"Error getting purchase advice: {e}")
            return f"Error retrieving purchase advice: {str(e)}"
    
    @function_tool
    def get_purchase_advice_by_id(self, pa_id: str) -> str:
        """Get specific purchase advice document by ID"""
        try:
            result = self.purchase_advice_service.get_purchase_advice(pa_id)
            
            if not result:
                return f"No purchase advice found for ID: {pa_id}"
            
            self.context.last_results = {"type": "purchase_advice", "data": result}
            
            summary = f"Purchase Advice for ID: {pa_id}\n"
            summary += f"- Document ID: {result.get('doc_id', 'N/A')}\n"
            summary += f"- Stored At: {result.get('stored_at', 'N/A')}\n"
            
            return summary
        except Exception as e:
            logger.error(f"Error getting purchase advice by ID: {e}")
            return f"Error retrieving purchase advice for {pa_id}: {str(e)}"
    
    @function_tool
    def get_all_commitments(self) -> str:
        """Get all commitment documents"""
        try:
            results = self.commitment_service.get_all_commitments()
            self.context.last_results = {"type": "commitments", "data": results}
            
            if not results:
                return "No commitment documents found in the system."
                
            summary = f"Found {len(results)} commitment documents:\n"
            for i, doc in enumerate(results[:10], 1):
                commitment_id = doc.get('commitment_id', 'Unknown')
                stored_at = doc.get('stored_at', 'Unknown')
                summary += f"{i}. Commitment ID: {commitment_id} (Stored: {stored_at})\n"
            
            if len(results) > 10:
                summary += f"... and {len(results) - 10} more documents"
                
            return summary
        except Exception as e:
            logger.error(f"Error getting commitments: {e}")
            return f"Error retrieving commitments: {str(e)}"
    
    @function_tool
    def get_commitment_by_id(self, commitment_id: str) -> str:
        """Get specific commitment document by ID"""
        try:
            result = self.commitment_service.get_commitment(commitment_id)
            
            if not result:
                return f"No commitment found for ID: {commitment_id}"
            
            self.context.last_results = {"type": "commitment", "data": result}
            
            summary = f"Commitment for ID: {commitment_id}\n"
            summary += f"- Document ID: {result.get('doc_id', 'N/A')}\n"
            summary += f"- Stored At: {result.get('stored_at', 'N/A')}\n"
            
            return summary
        except Exception as e:
            logger.error(f"Error getting commitment by ID: {e}")
            return f"Error retrieving commitment for {commitment_id}: {str(e)}"
    
    @function_tool
    def get_loan_tracking_records(self) -> str:
        """Get all loan tracking records"""
        try:
            results = self.loan_tracking_service.get_all_tracking_records()
            self.context.last_results = {"type": "loan_tracking", "data": results}
            
            if not results:
                return "No loan tracking records found in the system."
                
            summary = f"Found {len(results)} loan tracking records:\n"
            for i, record in enumerate(results[:10], 1):
                xp_loan_number = record.get('xpLoanNumber', 'Unknown')
                status = record.get('status', 'Unknown')
                summary += f"{i}. Loan: {xp_loan_number} (Status: {status})\n"
            
            if len(results) > 10:
                summary += f"... and {len(results) - 10} more records"
                
            return summary
        except Exception as e:
            logger.error(f"Error getting loan tracking records: {e}")
            return f"Error retrieving loan tracking records: {str(e)}"
    
    @function_tool
    def search_by_loan_number(self, xp_loan_number: str) -> str:
        """Search across all data types for a specific loan number"""
        try:
            results = {}
            summary = f"Search results for loan number: {xp_loan_number}\n\n"
            
            # Search loan tracking
            tracking_records = self.loan_tracking_service.get_all_tracking_records()
            matching_tracking = [r for r in tracking_records if r.get('xpLoanNumber') == xp_loan_number]
            results['tracking'] = matching_tracking
            
            if matching_tracking:
                summary += f"Loan Tracking: Found {len(matching_tracking)} records\n"
                for record in matching_tracking:
                    status = record.get('status', 'Unknown')
                    summary += f"  - Status: {status}\n"
            
            # Search commitments
            commitments = self.commitment_service.get_all_commitments()
            matching_commitments = [c for c in commitments if xp_loan_number in str(c)]
            results['commitments'] = matching_commitments
            
            if matching_commitments:
                summary += f"Commitments: Found {len(matching_commitments)} documents\n"
            
            # Search purchase advice
            purchase_advices = self.purchase_advice_service.get_all_purchase_advices()
            matching_pa = [pa for pa in purchase_advices if xp_loan_number in str(pa)]
            results['purchase_advice'] = matching_pa
            
            if matching_pa:
                summary += f"Purchase Advice: Found {len(matching_pa)} documents\n"
            
            # Search loan data
            loan_data = self.loan_data_service.get_all_loan_data()
            matching_loan_data = [ld for ld in loan_data if xp_loan_number in str(ld)]
            results['loan_data'] = matching_loan_data
            
            if matching_loan_data:
                summary += f"Loan Data: Found {len(matching_loan_data)} documents\n"
            
            self.context.last_results = {"type": "search_results", "data": results, "query": xp_loan_number}
            
            if not any([matching_tracking, matching_commitments, matching_pa, matching_loan_data]):
                summary += "No matching records found."
            
            return summary
            
        except Exception as e:
            logger.error(f"Error searching by loan number: {e}")
            return f"Error searching for loan number {xp_loan_number}: {str(e)}"
    
    def chat(self, user_message: str, session_id: Optional[str] = None) -> str:
        """Main chat interface using Runner with session management (following DataMind pattern)"""
        try:
            self.context.add_message("user", user_message)
            
            # Create session if not provided (following DataMind pattern)
            if not session_id:
                import time
                session_id = f"loansphere_session_{int(time.time())}"
            
            # Create sessions directory if it doesn't exist
            sessions_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'sessions')
            os.makedirs(sessions_dir, exist_ok=True)
            
            # Try to create session with custom path (if SQLiteSession supports it)
            try:
                # Try with db_path parameter (common pattern)
                session_db_path = os.path.join(sessions_dir, f"{session_id}.db")
                session = SQLiteSession(session_id, db_path=session_db_path)
            except TypeError:
                try:
                    # Try with database parameter
                    session_db_path = os.path.join(sessions_dir, f"{session_id}.db")
                    session = SQLiteSession(session_id, database=session_db_path)
                except TypeError:
                    # Fall back to default behavior
                    logger.warning("Could not set custom session path, using default location")
                    session = SQLiteSession(session_id)
            
            # Run the agent synchronously with session using Runner classmethod API
            # Note: This should be used only when no event loop is running.
            result = Runner.run_sync(self.agent, user_message, session=session)

            # Extract a reasonable text response from the RunResult
            response_content = None
            try:
                final_output = getattr(result, 'final_output', None)
                if final_output is not None:
                    # Try common attributes first
                    response_content = getattr(final_output, 'text', None) or getattr(final_output, 'content', None)
                    if response_content is None:
                        response_content = str(final_output)
                else:
                    raw_responses = getattr(result, 'raw_responses', [])
                    if raw_responses:
                        last = raw_responses[-1]
                        raw_item = getattr(last, 'raw_item', None)
                        if raw_item is not None:
                            content_list = getattr(raw_item, 'content', None)
                            texts = []
                            if isinstance(content_list, list):
                                for c in content_list:
                                    ctype = getattr(c, 'type', None)
                                    if ctype in ('output_text', 'text'):
                                        text_obj = getattr(c, 'text', None)
                                        if text_obj is not None:
                                            val = getattr(text_obj, 'value', None) or getattr(text_obj, 'text', None)
                                            if val:
                                                texts.append(val)
                                if texts:
                                    response_content = "\n".join(texts)
                        if response_content is None:
                            response_content = str(last)
            except Exception:
                # Fallback to pretty string of result
                response_content = str(result)
            
            if response_content is None:
                response_content = str(result)
            
            self.context.add_message("assistant", response_content)
            return response_content
            
        except Exception as e:
            logger.error(f"Error in chat: {e}")
            error_msg = f"I apologize, but I encountered an error: {str(e)}"
            self.context.add_message("assistant", error_msg)
            return error_msg

    async def chat_async(self, user_message: str, session_id: Optional[str] = None) -> str:
        """Async chat interface that works within FastAPI's running event loop."""
        try:
            self.context.add_message("user", user_message)

            if not session_id:
                import time
                session_id = f"loansphere_session_{int(time.time())}"

            sessions_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'sessions')
            os.makedirs(sessions_dir, exist_ok=True)

            try:
                session_db_path = os.path.join(sessions_dir, f"{session_id}.db")
                session = SQLiteSession(session_id, db_path=session_db_path)
            except TypeError:
                try:
                    session_db_path = os.path.join(sessions_dir, f"{session_id}.db")
                    session = SQLiteSession(session_id, database=session_db_path)
                except TypeError:
                    logger.warning("Could not set custom session path, using default location")
                    session = SQLiteSession(session_id)

            # Use async Runner API to avoid nested event loop issues
            result = await Runner.run(self.agent, user_message, session=session)

            # Reuse the same extraction logic
            response_content = None
            try:
                final_output = getattr(result, 'final_output', None)
                if final_output is not None:
                    response_content = getattr(final_output, 'text', None) or getattr(final_output, 'content', None)
                    if response_content is None:
                        response_content = str(final_output)
                else:
                    raw_responses = getattr(result, 'raw_responses', [])
                    if raw_responses:
                        last = raw_responses[-1]
                        raw_item = getattr(last, 'raw_item', None)
                        if raw_item is not None:
                            content_list = getattr(raw_item, 'content', None)
                            texts = []
                            if isinstance(content_list, list):
                                for c in content_list:
                                    ctype = getattr(c, 'type', None)
                                    if ctype in ('output_text', 'text'):
                                        text_obj = getattr(c, 'text', None)
                                        if text_obj is not None:
                                            val = getattr(text_obj, 'value', None) or getattr(text_obj, 'text', None)
                                            if val:
                                                texts.append(val)
                                if texts:
                                    response_content = "\n".join(texts)
                        if response_content is None:
                            response_content = str(last)
            except Exception:
                response_content = str(result)

            if response_content is None:
                response_content = str(result)

            self.context.add_message("assistant", response_content)
            return response_content

        except Exception as e:
            logger.error(f"Error in chat (async): {e}")
            error_msg = f"I apologize, but I encountered an error: {str(e)}"
            self.context.add_message("assistant", error_msg)
            return error_msg


# Singleton instance
_agent_instance = None

def get_ai_agent() -> LoanSphereAgent:
    """Get singleton AI agent instance"""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = LoanSphereAgent()
    return _agent_instance
