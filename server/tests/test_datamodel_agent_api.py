"""
Test-Driven Development for @datamodel Agent API Endpoints
Tests written FIRST, then API implementation follows
"""
import pytest
import json
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI

# Test the API endpoints that don't exist yet - TDD approach
from routers.ai_agent import router


# Create test app
app = FastAPI()
app.include_router(router, prefix="/api/agents")

client = TestClient(app)


class TestDataModelAgentAPIEndpoints:
    """Test @datamodel agent API endpoints following LoanSphere patterns"""
    
    @pytest.fixture
    def mock_datamodel_agent_service(self):
        """Mock the datamodel agent service"""
        with patch('routers.ai_agent.get_datamodel_agent') as mock_get_agent:
            mock_service = Mock()
            mock_get_agent.return_value = mock_service
            yield mock_service
    
    @pytest.fixture
    def mock_snowflake_connection(self):
        """Mock valid Snowflake connection"""
        return {
            'id': 'conn-123',
            'name': 'Test Snowflake Connection',
            'account': 'test-account',
            'database': 'TEST_DB',
            'schema': 'TEST_SCHEMA',
            'is_active': True
        }

    def test_datamodel_agent_start_endpoint_success(self, mock_datamodel_agent_service):
        """Test POST /api/agents/datamodel/start - successful session creation"""
        # Mock service response
        mock_datamodel_agent_service.start_session.return_value = "datamodel_session_123"
        mock_datamodel_agent_service.get_connection_info.return_value = {
            'name': 'Test Snowflake Connection'
        }
        
        # Make request
        response = client.post("/api/agents/datamodel/start", json={
            "connection_id": "conn-123"
        })
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "datamodel_session_123"
        assert data["connection_name"] == "Test Snowflake Connection"
        
        # Verify service was called correctly
        mock_datamodel_agent_service.start_session.assert_called_once_with("conn-123")
    
    def test_datamodel_agent_start_endpoint_missing_connection_id(self, mock_datamodel_agent_service):
        """Test start endpoint with missing connection_id"""
        response = client.post("/api/agents/datamodel/start", json={})
        
        assert response.status_code == 422  # Validation error
        assert "connection_id" in response.text.lower()
    
    def test_datamodel_agent_start_endpoint_invalid_connection(self, mock_datamodel_agent_service):
        """Test start endpoint with invalid connection"""
        mock_datamodel_agent_service.start_session.side_effect = ValueError("Connection not found")
        
        response = client.post("/api/agents/datamodel/start", json={
            "connection_id": "invalid-conn"
        })
        
        assert response.status_code == 400
        assert "Connection not found" in response.json()["detail"]
    
    def test_datamodel_agent_chat_endpoint_success(self, mock_datamodel_agent_service):
        """Test POST /api/agents/datamodel/chat - successful chat interaction"""
        # Mock service response
        mock_datamodel_agent_service.chat.return_value = "📊 Found 2 databases: TEST_DB, DEMO_DB"
        mock_datamodel_agent_service.get_session_context.return_value = Mock(
            connection_id="conn-123",
            current_database=None,
            current_schema=None,
            selected_tables=[],
            dictionary_content=None
        )
        
        # Make request
        response = client.post("/api/agents/datamodel/chat", json={
            "session_id": "datamodel_session_123",
            "message": "show me databases"
        })
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["response"] == "📊 Found 2 databases: TEST_DB, DEMO_DB"
        assert data["session_id"] == "datamodel_session_123"
        assert "context" in data
        
        # Verify service calls
        mock_datamodel_agent_service.chat.assert_called_once_with(
            "datamodel_session_123", "show me databases"
        )
    
    def test_datamodel_agent_chat_endpoint_invalid_session(self, mock_datamodel_agent_service):
        """Test chat endpoint with invalid session"""
        mock_datamodel_agent_service.chat.side_effect = ValueError("Session not found")
        
        response = client.post("/api/agents/datamodel/chat", json={
            "session_id": "invalid-session",
            "message": "test message"
        })
        
        assert response.status_code == 404
        assert "Session not found" in response.json()["detail"]
    
    def test_datamodel_agent_chat_endpoint_missing_fields(self, mock_datamodel_agent_service):
        """Test chat endpoint with missing required fields"""
        # Missing message
        response = client.post("/api/agents/datamodel/chat", json={
            "session_id": "datamodel_session_123"
        })
        assert response.status_code == 422
        
        # Missing session_id
        response = client.post("/api/agents/datamodel/chat", json={
            "message": "test message"
        })
        assert response.status_code == 422
    
    def test_datamodel_agent_context_endpoint_success(self, mock_datamodel_agent_service):
        """Test GET /api/agents/datamodel/context - get session context"""
        # Mock context
        mock_context = Mock()
        mock_context.connection_id = "conn-123"
        mock_context.current_database = "TEST_DB"
        mock_context.current_schema = "TEST_SCHEMA"
        mock_context.selected_tables = ["TABLE1", "TABLE2"]
        mock_context.dictionary_content = None
        
        mock_datamodel_agent_service.get_session_context.return_value = mock_context
        
        # Make request
        response = client.get("/api/agents/datamodel/context?session_id=datamodel_session_123")
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["connection_id"] == "conn-123"
        assert data["current_database"] == "TEST_DB"
        assert data["current_schema"] == "TEST_SCHEMA"
        assert data["selected_tables"] == ["TABLE1", "TABLE2"]
        assert data["yaml_ready"] is False  # No dictionary_content
        
        mock_datamodel_agent_service.get_session_context.assert_called_once_with("datamodel_session_123")
    
    def test_datamodel_agent_context_endpoint_with_yaml_ready(self, mock_datamodel_agent_service):
        """Test context endpoint when YAML dictionary is ready"""
        mock_context = Mock()
        mock_context.connection_id = "conn-123"
        mock_context.current_database = "TEST_DB"
        mock_context.current_schema = "TEST_SCHEMA"
        mock_context.selected_tables = ["TABLE1"]
        mock_context.dictionary_content = "tables:\n  - name: TABLE1"
        
        mock_datamodel_agent_service.get_session_context.return_value = mock_context
        
        response = client.get("/api/agents/datamodel/context?session_id=datamodel_session_123")
        
        assert response.status_code == 200
        data = response.json()
        assert data["yaml_ready"] is True  # Has dictionary_content
    
    def test_datamodel_agent_context_endpoint_missing_session_id(self, mock_datamodel_agent_service):
        """Test context endpoint without session_id parameter"""
        response = client.get("/api/agents/datamodel/context")
        
        assert response.status_code == 422  # Missing required query parameter
    
    def test_datamodel_agent_download_endpoint_success(self, mock_datamodel_agent_service):
        """Test POST /api/agents/datamodel/download - download YAML dictionary"""
        # Mock service response
        yaml_content = "tables:\n  - name: TABLE1\n    type: BASE_TABLE"
        filename = "TEST_DB_TEST_SCHEMA_dictionary.yaml"
        mock_datamodel_agent_service.download_yaml_dictionary.return_value = (
            yaml_content.encode('utf-8'), filename
        )
        
        # Make request
        response = client.post("/api/agents/datamodel/download", json={
            "session_id": "datamodel_session_123"
        })
        
        # Verify response
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/x-yaml"
        assert f"attachment; filename={filename}" in response.headers["content-disposition"]
        assert yaml_content.encode('utf-8') == response.content
        
        mock_datamodel_agent_service.download_yaml_dictionary.assert_called_once_with("datamodel_session_123")
    
    def test_datamodel_agent_download_endpoint_no_yaml_available(self, mock_datamodel_agent_service):
        """Test download endpoint when no YAML dictionary is available"""
        mock_datamodel_agent_service.download_yaml_dictionary.side_effect = ValueError("No YAML dictionary available")
        
        response = client.post("/api/agents/datamodel/download", json={
            "session_id": "datamodel_session_123"
        })
        
        assert response.status_code == 404
        assert "No YAML dictionary available" in response.json()["detail"]
    
    def test_datamodel_agent_download_endpoint_missing_session_id(self, mock_datamodel_agent_service):
        """Test download endpoint without session_id"""
        response = client.post("/api/agents/datamodel/download", json={})
        
        assert response.status_code == 400
        assert "session_id required" in response.json()["detail"]
    
    def test_datamodel_agent_delete_session_endpoint_success(self, mock_datamodel_agent_service):
        """Test DELETE /api/agents/datamodel/session - delete session"""
        mock_datamodel_agent_service.delete_session.return_value = True
        
        response = client.delete("/api/agents/datamodel/session?session_id=datamodel_session_123")
        
        assert response.status_code == 200
        assert response.json() == {"ok": True}
        
        mock_datamodel_agent_service.delete_session.assert_called_once_with("datamodel_session_123")
    
    def test_datamodel_agent_delete_session_endpoint_missing_session_id(self, mock_datamodel_agent_service):
        """Test delete session endpoint without session_id"""
        response = client.delete("/api/agents/datamodel/session")
        
        assert response.status_code == 422  # Missing required query parameter


class TestDataModelAgentAPIModels:
    """Test Pydantic models for @datamodel agent API"""
    
    def test_datamodel_start_request_model(self):
        """Test DataModelStartRequest model validation"""
        from routers.ai_agent import DataModelStartRequest
        
        # Valid request
        request = DataModelStartRequest(connection_id="conn-123")
        assert request.connection_id == "conn-123"
        
        # Test validation
        with pytest.raises(Exception):  # ValidationError
            DataModelStartRequest()  # Missing required field
    
    def test_datamodel_start_response_model(self):
        """Test DataModelStartResponse model"""
        from routers.ai_agent import DataModelStartResponse
        
        response = DataModelStartResponse(
            session_id="datamodel_session_123",
            connection_name="Test Connection"
        )
        
        assert response.session_id == "datamodel_session_123"
        assert response.connection_name == "Test Connection"
    
    def test_datamodel_chat_request_model(self):
        """Test DataModelChatRequest model validation"""
        from routers.ai_agent import DataModelChatRequest
        
        # Valid request
        request = DataModelChatRequest(
            session_id="datamodel_session_123",
            message="show databases"
        )
        assert request.session_id == "datamodel_session_123"
        assert request.message == "show databases"
        
        # Test validation
        with pytest.raises(Exception):
            DataModelChatRequest(session_id="test")  # Missing message
    
    def test_datamodel_chat_response_model(self):
        """Test DataModelChatResponse model"""
        from routers.ai_agent import DataModelChatResponse
        
        response = DataModelChatResponse(
            response="Found 2 databases",
            session_id="datamodel_session_123",
            context={
                "connection_id": "conn-123",
                "current_database": "TEST_DB"
            }
        )
        
        assert response.response == "Found 2 databases"
        assert response.session_id == "datamodel_session_123"
        assert response.context["connection_id"] == "conn-123"
    
    def test_datamodel_context_response_model(self):
        """Test DataModelContextResponse model"""
        from routers.ai_agent import DataModelContextResponse
        
        response = DataModelContextResponse(
            connection_id="conn-123",
            current_database="TEST_DB",
            current_schema="TEST_SCHEMA",
            selected_tables=["TABLE1", "TABLE2"],
            yaml_ready=True
        )
        
        assert response.connection_id == "conn-123"
        assert response.current_database == "TEST_DB"
        assert response.current_schema == "TEST_SCHEMA"
        assert response.selected_tables == ["TABLE1", "TABLE2"]
        assert response.yaml_ready is True


class TestDataModelAgentAPIIntegration:
    """Integration tests for complete @datamodel agent API workflow"""
    
    @pytest.fixture
    def mock_complete_workflow(self):
        """Mock complete workflow dependencies"""
        with patch('routers.ai_agent.get_datamodel_agent') as mock_get_agent:
            mock_service = Mock()
            mock_get_agent.return_value = mock_service
            
            # Mock workflow responses
            mock_service.start_session.return_value = "datamodel_session_123"
            mock_service.get_connection_info.return_value = {'name': 'Test Connection'}
            
            # Mock chat responses for different stages
            def mock_chat(session_id, message):
                if "database" in message.lower():
                    return "📊 Found 2 databases: 1. TEST_DB  2. DEMO_DB. Which would you like to explore?"
                elif message == "1":
                    return "✅ Selected database: TEST_DB. Now getting schemas..."
                elif "schema" in message.lower():
                    return "📂 Found 2 schemas: 1. PUBLIC  2. STAGING. Which would you like to use?"
                elif "table" in message.lower():
                    return "📋 Found 3 tables: 1. CUSTOMERS  2. ORDERS  3. PRODUCTS. Select tables for dictionary generation."
                elif "generate" in message.lower() or "all" in message.lower():
                    return "✅ Generated YAML dictionary for 3 tables! Dictionary is ready for download."
                else:
                    return "I can help you create YAML data dictionaries! Let's start by browsing your databases."
            
            mock_service.chat.side_effect = mock_chat
            
            # Mock context updates during workflow
            def mock_get_context(session_id):
                context = Mock()
                context.connection_id = "conn-123"
                context.current_database = "TEST_DB"
                context.current_schema = "PUBLIC"
                context.selected_tables = ["CUSTOMERS", "ORDERS", "PRODUCTS"]
                context.dictionary_content = "tables:\n  - name: CUSTOMERS\n  - name: ORDERS\n  - name: PRODUCTS"
                return context
            
            mock_service.get_session_context.side_effect = mock_get_context
            
            # Mock download
            yaml_content = "tables:\n  - name: CUSTOMERS\n  - name: ORDERS\n  - name: PRODUCTS"
            mock_service.download_yaml_dictionary.return_value = (
                yaml_content.encode('utf-8'), 
                "TEST_DB_PUBLIC_dictionary.yaml"
            )
            
            yield mock_service
    
    def test_complete_datamodel_workflow_api_integration(self, mock_complete_workflow):
        """Test complete workflow: start → chat → browse → select → generate → download → cleanup"""
        # 1. Start session
        response = client.post("/api/agents/datamodel/start", json={
            "connection_id": "conn-123"
        })
        assert response.status_code == 200
        session_data = response.json()
        session_id = session_data["session_id"]
        
        # 2. Initial chat - get help
        response = client.post("/api/agents/datamodel/chat", json={
            "session_id": session_id,
            "message": "help me create data dictionary"
        })
        assert response.status_code == 200
        assert "YAML data dictionaries" in response.json()["response"]
        
        # 3. Browse databases
        response = client.post("/api/agents/datamodel/chat", json={
            "session_id": session_id,
            "message": "show me databases"
        })
        assert response.status_code == 200
        assert "TEST_DB" in response.json()["response"]
        assert "DEMO_DB" in response.json()["response"]
        
        # 4. Select database
        response = client.post("/api/agents/datamodel/chat", json={
            "session_id": session_id,
            "message": "1"  # Select first database
        })
        assert response.status_code == 200
        assert "Selected database: TEST_DB" in response.json()["response"]
        
        # 5. Browse schemas
        response = client.post("/api/agents/datamodel/chat", json={
            "session_id": session_id,
            "message": "show schemas"
        })
        assert response.status_code == 200
        assert "PUBLIC" in response.json()["response"]
        assert "STAGING" in response.json()["response"]
        
        # 6. Browse tables
        response = client.post("/api/agents/datamodel/chat", json={
            "session_id": session_id,
            "message": "show tables"
        })
        assert response.status_code == 200
        assert "CUSTOMERS" in response.json()["response"]
        
        # 7. Generate dictionary
        response = client.post("/api/agents/datamodel/chat", json={
            "session_id": session_id,
            "message": "generate dictionary for all tables"
        })
        assert response.status_code == 200
        assert "Generated YAML dictionary" in response.json()["response"]
        
        # 8. Check context - should show YAML is ready
        response = client.get(f"/api/agents/datamodel/context?session_id={session_id}")
        assert response.status_code == 200
        context_data = response.json()
        assert context_data["yaml_ready"] is True
        assert context_data["current_database"] == "TEST_DB"
        assert context_data["current_schema"] == "PUBLIC"
        assert len(context_data["selected_tables"]) == 3
        
        # 9. Download YAML dictionary
        response = client.post("/api/agents/datamodel/download", json={
            "session_id": session_id
        })
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/x-yaml"
        assert "TEST_DB_PUBLIC_dictionary.yaml" in response.headers["content-disposition"]
        assert b"CUSTOMERS" in response.content
        assert b"ORDERS" in response.content
        
        # 10. Cleanup session
        response = client.delete(f"/api/agents/datamodel/session?session_id={session_id}")
        assert response.status_code == 200
        assert response.json()["ok"] is True
    
    def test_datamodel_api_error_handling_workflow(self, mock_complete_workflow):
        """Test API error handling throughout workflow"""
        # Start with invalid connection
        mock_complete_workflow.start_session.side_effect = ValueError("Connection not found")
        
        response = client.post("/api/agents/datamodel/start", json={
            "connection_id": "invalid-conn"
        })
        assert response.status_code == 400
        assert "Connection not found" in response.json()["detail"]
        
        # Reset mock for valid session
        mock_complete_workflow.start_session.side_effect = None
        mock_complete_workflow.start_session.return_value = "valid_session"
        
        # Chat with invalid session
        mock_complete_workflow.chat.side_effect = ValueError("Session not found")
        
        response = client.post("/api/agents/datamodel/chat", json={
            "session_id": "invalid_session",
            "message": "test"
        })
        assert response.status_code == 404
        assert "Session not found" in response.json()["detail"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])