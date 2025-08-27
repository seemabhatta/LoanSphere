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
from agents import Agent, Runner, function_tool, SQLiteSession

from services.loan_data_service import get_loan_data_service
from services.purchase_advice_service import get_purchase_advice_service
from services.commitment_service import get_commitment_service
from services.loan_tracking_service import LoanTrackingService


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
        self.loan_data_service = get_loan_data_service()
        self.purchase_advice_service = get_purchase_advice_service()
        self.commitment_service = get_commitment_service()
        self.loan_tracking_service = LoanTrackingService()
        self.context = AgentContext(conversation_history=[])
        
        # Get OpenAI API key from environment
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        # Create agent with instructions (following DataMind pattern)
        self.agent = Agent(
            model="gpt-4o",
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
            
            Available data types:
            - Loan Data: Raw ULDD/MISMO loan documents with detailed loan information
            - Purchase Advice: Documents related to loan purchases and advice
            - Commitments: Loan commitment documents and agreements
            - Loan Tracking: Records tracking loan processing status and history
            
            When users ask vague questions, help them by suggesting specific queries they might want to make.
            """,
            functions=[
                self.get_all_loan_data,
                self.get_loan_data_by_id,
                self.get_all_purchase_advices,
                self.get_purchase_advice_by_id,
                self.get_all_commitments,
                self.get_commitment_by_id,
                self.get_loan_tracking_records,
                self.search_by_loan_number
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
            
            # Use Runner with session to handle the conversation (following DataMind pattern)
            runner = Runner(agent=self.agent)
            
            # Send user message and get response with session
            result = runner.run_sync(user_message, session=session)
            
            response_content = result.content if hasattr(result, 'content') else str(result)
            
            self.context.add_message("assistant", response_content)
            return response_content
            
        except Exception as e:
            logger.error(f"Error in chat: {e}")
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