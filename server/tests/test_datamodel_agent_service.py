"""
Test-Driven Development for DataModel Agent Service
Tests written FIRST, then implementation follows
"""
import pytest
import json
import os
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from datetime import datetime

# Set test environment
os.environ['TEST_MODE'] = 'true'

# Test the service that doesn't exist yet - TDD approach
from services.datamodel_agent_service import (
    DataModelAgent,
    AgentContext, 
    get_datamodel_agent
)


class TestAgentContext:
    """Test AgentContext dataclass - matches DataMind structure exactly"""
    
    def test_agent_context_initialization_defaults(self):
        """Test AgentContext initializes with correct defaults"""
        context = AgentContext()
        
        assert context.connection_id is None
        assert context.current_database is None
        assert context.current_schema is None
        assert context.current_stage is None
        assert context.selected_tables == []  # Should default to empty list
        assert context.dictionary_content is None
    
    def test_agent_context_with_values(self):
        """Test AgentContext can be initialized with values"""
        context = AgentContext(
            connection_id="conn-123",
            current_database="TEST_DB",
            current_schema="TEST_SCHEMA",
            selected_tables=["TABLE1", "TABLE2"],
            dictionary_content="test: yaml\ncontent: here"
        )
        
        assert context.connection_id == "conn-123"
        assert context.current_database == "TEST_DB"
        assert context.current_schema == "TEST_SCHEMA"
        assert context.selected_tables == ["TABLE1", "TABLE2"]
        assert context.dictionary_content == "test: yaml\ncontent: here"
    
    def test_agent_context_selected_tables_post_init(self):
        """Test that selected_tables gets properly initialized to empty list"""
        context = AgentContext(connection_id="test")
        
        # Should be empty list, not None
        assert isinstance(context.selected_tables, list)
        assert len(context.selected_tables) == 0


class TestDataModelAgent:
    """Test DataModel Agent Service - Core OpenAI Agent functionality"""
    
    @pytest.fixture
    def mock_agent_sdk(self):
        """Mock OpenAI Agent SDK components"""
        with patch('services.datamodel_agent_service.Agent') as mock_agent_class, \
             patch('services.datamodel_agent_service.Runner') as mock_runner:
            
            mock_agent = Mock()
            mock_agent_class.return_value = mock_agent
            
            mock_result = Mock()
            mock_result.final_output = "Test agent response"
            mock_runner.run_sync.return_value = mock_result
            
            yield {
                'agent_class': mock_agent_class,
                'agent': mock_agent,
                'runner': mock_runner,
                'result': mock_result
            }
    
    @pytest.fixture  
    def mock_snowflake_connection(self):
        """Mock Snowflake connection from LoanSphere"""
        mock_conn = Mock()
        mock_conn.id = "test-conn-123"
        mock_conn.name = "Test Snowflake Connection"
        mock_conn.account = "test-account"
        mock_conn.database = "TEST_DB"
        mock_conn.schema = "TEST_SCHEMA"
        mock_conn.is_active = True
        
        return mock_conn
    
    def test_datamodel_agent_initialization(self, mock_agent_sdk):
        """Test DataModel Agent initializes with correct OpenAI Agent SDK setup"""
        agent_service = DataModelAgent()
        
        # Should have created OpenAI Agent with correct parameters
        mock_agent_sdk['agent_class'].assert_called_once()
        call_args = mock_agent_sdk['agent_class'].call_args
        
        # Verify agent was created with correct name and tools
        assert call_args[1]['name'] == "DataModelAgent"
        assert 'instructions' in call_args[1]
        assert 'tools' in call_args[1]
        assert len(call_args[1]['tools']) == 12  # Should have 12 function tools like DataMind
    
    def test_datamodel_agent_has_required_function_tools(self, mock_agent_sdk):
        """Test agent has all 12 required function tools from DataMind"""
        agent_service = DataModelAgent()
        
        call_args = mock_agent_sdk['agent_class'].call_args
        tools = call_args[1]['tools']
        
        # Extract tool names (function names)
        tool_names = [tool.__name__ for tool in tools]
        
        expected_tools = [
            'connect_to_snowflake',
            'get_databases', 
            'select_database',
            'get_schemas',
            'select_schema', 
            'get_tables',
            'select_tables',
            'generate_yaml_dictionary',
            'save_dictionary',
            'upload_to_stage',
            'get_current_context',
            'show_dictionary_preview'
        ]
        
        for expected_tool in expected_tools:
            assert expected_tool in tool_names
    
    @patch('services.datamodel_agent_service.SessionLocal')
    def test_start_session_with_snowflake_connection(self, mock_session_local, mock_snowflake_connection, mock_agent_sdk):
        """Test starting a session with valid Snowflake connection"""
        # Mock database session
        mock_db_session = Mock()
        mock_db_session.query.return_value.filter_by.return_value.first.return_value = mock_snowflake_connection
        mock_session_local.return_value = mock_db_session
        
        agent_service = DataModelAgent()
        session_id = agent_service.start_session("test-conn-123")
        
        # Should return a valid session ID
        assert session_id.startswith("datamodel_")
        assert "test-conn-123" in session_id
        
        # Should have stored the session
        assert session_id in agent_service.sessions
        session = agent_service.sessions[session_id]
        assert session.connection_id == "test-conn-123"
        assert session.agent_context.connection_id == "test-conn-123"
    
    def test_start_session_with_invalid_connection(self, mock_agent_sdk):
        """Test starting session fails with invalid connection"""
        with patch('services.datamodel_agent_service.SessionLocal') as mock_session_local:
            mock_db_session = Mock()
            mock_db_session.query.return_value.filter_by.return_value.first.return_value = None
            mock_session_local.return_value = mock_db_session
            
            agent_service = DataModelAgent()
            
            with pytest.raises(ValueError, match="Connection not found"):
                agent_service.start_session("invalid-conn")
    
    def test_chat_with_agent(self, mock_snowflake_connection, mock_agent_sdk):
        """Test chat functionality integrates with OpenAI Agent SDK"""
        with patch('services.datamodel_agent_service.SessionLocal') as mock_session_local:
            mock_db_session = Mock()
            mock_db_session.query.return_value.filter_by.return_value.first.return_value = mock_snowflake_connection
            mock_session_local.return_value = mock_db_session
            
            agent_service = DataModelAgent()
            session_id = agent_service.start_session("test-conn-123")
            
            # Test chat
            response = agent_service.chat(session_id, "show me databases")
            
            # Should have called OpenAI Agent SDK
            mock_agent_sdk['runner'].run_sync.assert_called_once()
            call_args = mock_agent_sdk['runner'].run_sync.call_args
            assert call_args[0][1] == "show me databases"  # User message
            
            # Should return agent response
            assert response == "Test agent response"
    
    def test_chat_with_invalid_session(self, mock_agent_sdk):
        """Test chat fails with invalid session ID"""
        agent_service = DataModelAgent()
        
        with pytest.raises(ValueError, match="Session not found"):
            agent_service.chat("invalid-session", "test message")
    
    def test_get_session_context(self, mock_snowflake_connection, mock_agent_sdk):
        """Test getting session context returns AgentContext state"""
        with patch('services.datamodel_agent_service.SessionLocal') as mock_session_local:
            mock_db_session = Mock()
            mock_db_session.query.return_value.filter_by.return_value.first.return_value = mock_snowflake_connection
            mock_session_local.return_value = mock_db_session
            
            agent_service = DataModelAgent()
            session_id = agent_service.start_session("test-conn-123")
            
            # Modify context state
            session = agent_service.sessions[session_id]
            session.agent_context.current_database = "TEST_DB"
            session.agent_context.selected_tables = ["TABLE1", "TABLE2"]
            
            # Get context
            context = agent_service.get_session_context(session_id)
            
            assert context.connection_id == "test-conn-123"
            assert context.current_database == "TEST_DB"
            assert context.selected_tables == ["TABLE1", "TABLE2"]
    
    def test_delete_session(self, mock_snowflake_connection, mock_agent_sdk):
        """Test session deletion"""
        with patch('services.datamodel_agent_service.SessionLocal') as mock_session_local:
            mock_db_session = Mock()
            mock_db_session.query.return_value.filter_by.return_value.first.return_value = mock_snowflake_connection
            mock_session_local.return_value = mock_db_session
            
            agent_service = DataModelAgent()
            session_id = agent_service.start_session("test-conn-123")
            
            # Verify session exists
            assert session_id in agent_service.sessions
            
            # Delete session
            success = agent_service.delete_session(session_id)
            
            assert success is True
            assert session_id not in agent_service.sessions
    
    def test_download_yaml_dictionary(self, mock_snowflake_connection, mock_agent_sdk):
        """Test downloading generated YAML dictionary"""
        with patch('services.datamodel_agent_service.SessionLocal') as mock_session_local:
            mock_db_session = Mock()
            mock_db_session.query.return_value.filter_by.return_value.first.return_value = mock_snowflake_connection
            mock_session_local.return_value = mock_db_session
            
            agent_service = DataModelAgent()
            session_id = agent_service.start_session("test-conn-123")
            
            # Set up generated dictionary content
            session = agent_service.sessions[session_id]
            session.agent_context.dictionary_content = "tables:\n  - name: TABLE1\n    type: BASE_TABLE"
            session.agent_context.current_database = "TEST_DB"
            session.agent_context.current_schema = "TEST_SCHEMA"
            session.agent_context.selected_tables = ["TABLE1"]
            
            # Download YAML
            yaml_bytes, filename = agent_service.download_yaml_dictionary(session_id)
            
            assert isinstance(yaml_bytes, bytes)
            assert filename == "TEST_DB_TEST_SCHEMA_dictionary.yaml"
            assert b"tables:" in yaml_bytes
            assert b"TABLE1" in yaml_bytes
    
    def test_download_yaml_no_content_error(self, mock_snowflake_connection, mock_agent_sdk):
        """Test download fails when no YAML content generated"""
        with patch('services.datamodel_agent_service.SessionLocal') as mock_session_local:
            mock_db_session = Mock()
            mock_db_session.query.return_value.filter_by.return_value.first.return_value = mock_snowflake_connection
            mock_session_local.return_value = mock_db_session
            
            agent_service = DataModelAgent()
            session_id = agent_service.start_session("test-conn-123")
            
            # No dictionary content set
            with pytest.raises(ValueError, match="No YAML dictionary available"):
                agent_service.download_yaml_dictionary(session_id)


class TestDataModelAgentFunctionTools:
    """Test the 12 function tools that wrap DataMind implementations"""
    
    @pytest.fixture
    def agent_context(self):
        """Create test agent context"""
        return AgentContext(connection_id="test-conn")
    
    @pytest.fixture
    def mock_datamind_functions(self):
        """Mock all DataMind function implementations"""
        with patch('src.functions.metadata_functions.list_databases') as mock_list_dbs, \
             patch('src.functions.metadata_functions.list_schemas') as mock_list_schemas, \
             patch('src.functions.metadata_functions.list_tables') as mock_list_tables, \
             patch('src.functions.dictionary_functions.generate_data_dictionary') as mock_gen_dict:
            
            # Set up successful responses
            mock_list_dbs.return_value = {"status": "success", "databases": ["DB1", "DB2"]}
            mock_list_schemas.return_value = {"status": "success", "schemas": ["SCHEMA1", "SCHEMA2"]}
            mock_list_tables.return_value = {
                "status": "success", 
                "tables": [{"table": "TABLE1", "table_type": "BASE_TABLE"}]
            }
            mock_gen_dict.return_value = {
                "status": "success",
                "yaml_dictionary": "tables:\n  - name: TABLE1",
                "tables_processed": 1
            }
            
            yield {
                'list_databases': mock_list_dbs,
                'list_schemas': mock_list_schemas, 
                'list_tables': mock_list_tables,
                'generate_data_dictionary': mock_gen_dict
            }
    
    def test_function_tool_get_databases(self, agent_context, mock_datamind_functions):
        """Test get_databases function tool"""
        # This will be a function_tool that calls DataMind's list_databases
        # Import will fail until we implement the service
        pass  # Placeholder for when service exists
    
    def test_function_tool_select_database(self, agent_context, mock_datamind_functions):
        """Test select_database function tool updates context"""
        # This will test that select_database updates agent_context.current_database
        pass  # Placeholder for when service exists
    
    def test_function_tool_generate_yaml_dictionary(self, agent_context, mock_datamind_functions):
        """Test generate_yaml_dictionary function tool"""
        # This will test YAML generation and context update
        pass  # Placeholder for when service exists


class TestDataModelAgentSingleton:
    """Test singleton pattern for agent service"""
    
    def test_get_datamodel_agent_returns_singleton(self):
        """Test get_datamodel_agent returns same instance"""
        agent1 = get_datamodel_agent()
        agent2 = get_datamodel_agent()
        
        assert agent1 is agent2  # Same object instance
    
    def test_get_datamodel_agent_returns_datamodel_agent_instance(self):
        """Test get_datamodel_agent returns correct type"""
        agent = get_datamodel_agent()
        
        assert isinstance(agent, DataModelAgent)


class TestSessionManagement:
    """Test session lifecycle and management"""
    
    @pytest.fixture
    def agent_service(self, mock_snowflake_connection):
        """Create agent service with mocked dependencies"""
        with patch('services.datamodel_agent_service.Agent'), \
             patch('services.datamodel_agent_service.SessionLocal') as mock_session_local:
            
            mock_db_session = Mock()
            mock_db_session.query.return_value.filter_by.return_value.first.return_value = mock_snowflake_connection
            mock_session_local.return_value = mock_db_session
            
            return DataModelAgent()
    
    def test_session_cleanup_after_timeout(self, agent_service):
        """Test sessions are cleaned up after timeout"""
        # Create session
        session_id = agent_service.start_session("test-conn-123")
        assert session_id in agent_service.sessions
        
        # Mock old timestamp
        session = agent_service.sessions[session_id]
        old_time = datetime.now()
        old_time = old_time.replace(hour=old_time.hour - 2)  # 2 hours ago
        session.last_activity = old_time
        
        # Cleanup should remove old session
        agent_service.cleanup_expired_sessions(timeout_minutes=60)  # 1 hour timeout
        
        assert session_id not in agent_service.sessions
    
    def test_session_activity_updates(self, agent_service):
        """Test session activity timestamp updates on interaction"""
        session_id = agent_service.start_session("test-conn-123")
        original_time = agent_service.sessions[session_id].last_activity
        
        # Mock time passage
        import time
        time.sleep(0.001)
        
        # Chat should update activity
        with patch('services.datamodel_agent_service.Runner') as mock_runner:
            mock_result = Mock()
            mock_result.final_output = "response"
            mock_runner.run_sync.return_value = mock_result
            
            agent_service.chat(session_id, "test message")
        
        new_time = agent_service.sessions[session_id].last_activity
        assert new_time > original_time


# Integration Tests - These test the complete workflow
class TestDataModelAgentIntegration:
    """Test complete @datamodel agent workflow end-to-end"""
    
    @pytest.fixture
    def full_agent_setup(self):
        """Set up complete agent with all mocked dependencies"""
        with patch('services.datamodel_agent_service.Agent') as mock_agent_class, \
             patch('services.datamodel_agent_service.Runner') as mock_runner, \
             patch('services.datamodel_agent_service.SessionLocal') as mock_session_local, \
             patch('src.functions.metadata_functions.list_databases') as mock_list_dbs, \
             patch('src.functions.metadata_functions.list_schemas') as mock_list_schemas, \
             patch('src.functions.metadata_functions.list_tables') as mock_list_tables, \
             patch('src.functions.dictionary_functions.generate_data_dictionary') as mock_gen_dict:
            
            # Mock Snowflake connection
            mock_conn = Mock()
            mock_conn.id = "test-conn"
            mock_conn.name = "Test Connection"
            mock_conn.is_active = True
            
            mock_db_session = Mock()
            mock_db_session.query.return_value.filter_by.return_value.first.return_value = mock_conn
            mock_session_local.return_value = mock_db_session
            
            # Mock OpenAI Agent responses
            mock_agent = Mock()
            mock_agent_class.return_value = mock_agent
            
            def mock_run_sync(agent, message, session=None):
                mock_result = Mock()
                if "database" in message.lower():
                    mock_result.final_output = "📊 Found 2 databases: 1. DB1  2. DB2. Which would you like to explore?"
                elif "schema" in message.lower():
                    mock_result.final_output = "📂 Found 2 schemas: 1. SCHEMA1  2. SCHEMA2. Which would you like to use?"
                elif "table" in message.lower():
                    mock_result.final_output = "📋 Found 1 table: 1. TABLE1 (BASE_TABLE). Select tables for dictionary generation."
                elif "generate" in message.lower():
                    mock_result.final_output = "✅ Generated YAML dictionary for 1 table! Ready for download."
                else:
                    mock_result.final_output = "I can help you generate YAML data dictionaries. Let's start by connecting to Snowflake!"
                return mock_result
            
            mock_runner.run_sync.side_effect = mock_run_sync
            
            # Mock DataMind functions
            mock_list_dbs.return_value = {"status": "success", "databases": ["DB1", "DB2"]}
            mock_list_schemas.return_value = {"status": "success", "schemas": ["SCHEMA1", "SCHEMA2"]}
            mock_list_tables.return_value = {
                "status": "success",
                "tables": [{"table": "TABLE1", "table_type": "BASE_TABLE"}]
            }
            mock_gen_dict.return_value = {
                "status": "success", 
                "yaml_dictionary": "tables:\n  - name: TABLE1\n    type: BASE_TABLE",
                "tables_processed": 1
            }
            
            yield DataModelAgent()
    
    def test_complete_datamodel_workflow(self, full_agent_setup):
        """Test complete workflow: connect → browse → select → generate → download"""
        agent = full_agent_setup
        
        # 1. Start session
        session_id = agent.start_session("test-conn")
        assert session_id.startswith("datamodel_")
        
        # 2. Initial chat - should guide user to connect
        response = agent.chat(session_id, "Hello, I want to create a data model")
        assert "connect" in response.lower() or "snowflake" in response.lower()
        
        # 3. Browse databases
        response = agent.chat(session_id, "show me databases")
        assert "DB1" in response and "DB2" in response
        
        # 4. Select database
        response = agent.chat(session_id, "1")  # Select DB1
        # Agent should understand context and select database
        
        # 5. Browse schemas
        response = agent.chat(session_id, "show schemas")
        assert "SCHEMA1" in response and "SCHEMA2" in response
        
        # 6. Select schema
        response = agent.chat(session_id, "1")  # Select SCHEMA1
        
        # 7. Browse tables
        response = agent.chat(session_id, "show tables")
        assert "TABLE1" in response
        
        # 8. Generate dictionary
        response = agent.chat(session_id, "generate dictionary for TABLE1")
        assert "generated" in response.lower() or "ready" in response.lower()
        
        # 9. Download dictionary
        context = agent.get_session_context(session_id)
        if context.dictionary_content:  # Should have content after generation
            yaml_bytes, filename = agent.download_yaml_dictionary(session_id)
            assert isinstance(yaml_bytes, bytes)
            assert filename.endswith(".yaml")
        
        # 10. Cleanup
        success = agent.delete_session(session_id)
        assert success is True
    
    def test_agent_context_updates_during_workflow(self, full_agent_setup):
        """Test that AgentContext updates correctly during workflow"""
        agent = full_agent_setup
        session_id = agent.start_session("test-conn")
        
        # Initially empty context
        context = agent.get_session_context(session_id)
        assert context.current_database is None
        assert context.current_schema is None
        assert context.selected_tables == []
        assert context.dictionary_content is None
        
        # After workflow steps, context should be populated
        # (This will be validated when function tools are implemented)
        agent.chat(session_id, "connect and browse databases")
        # Context updates will be tested when tools are implemented


if __name__ == "__main__":
    pytest.main([__file__, "-v"])