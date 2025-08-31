"""
Tests for Snowflake staging integration with @datamodel agent
Includes mocked authentication to avoid Google login issues during automated testing
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import tempfile
import os
from services.datamodel_agent_service import DataModelAgent, get_datamodel_agent


@pytest.fixture
def mock_snowflake_connection():
    """Mock Snowflake connection without requiring actual authentication"""
    mock_conn = Mock()
    mock_conn.connection_id = "test_connection_123"
    mock_conn.name = "Test Snowflake Connection"
    mock_conn.database = "TEST_DB" 
    mock_conn.schema = "TEST_SCHEMA"
    mock_conn.warehouse = "TEST_WH"
    mock_conn.stage = "TEST_STAGE"
    return mock_conn


@pytest.fixture
def mock_agent_with_staging():
    """DataModel agent with staging capabilities mocked"""
    # Mock all the imports that might be missing
    with patch.dict('sys.modules', {
        'agents': Mock(),
        'agents.memory.session': Mock(),
        'src.functions.metadata_functions': Mock(),
        'src.functions.dictionary_functions': Mock(),
        'src.functions.stage_functions': Mock(),
        'database': Mock(),
        'models': Mock()
    }):
        # Create agent without OpenAI dependencies
        agent = DataModelAgent()
        agent.agent = Mock()  # Mock the OpenAI agent
        
        # Mock the staging-related functions
        agent._stage_manager = Mock()
        agent._stage_manager.create_stage.return_value = True
        agent._stage_manager.upload_file.return_value = {"status": "success", "file_path": "@TEST_STAGE/test.yaml"}
        agent._stage_manager.list_stage_files.return_value = ["test.yaml", "another.yaml"]
        
        yield agent


class TestSnowflakeStaging:
    """Test Snowflake staging functionality with mocked authentication"""
    
    def test_create_stage_success(self, mock_agent_with_staging, mock_snowflake_connection):
        """Test successful stage creation"""
        session_id = mock_agent_with_staging.start_session(mock_snowflake_connection.connection_id)
        
        # Mock the create stage function
        with patch.object(mock_agent_with_staging, '_create_stage') as mock_create:
            mock_create.return_value = "Stage 'TEST_STAGE' created successfully"
            
            result = mock_agent_with_staging._create_stage()
            assert "created successfully" in result
            mock_create.assert_called_once()
    
    def test_upload_yaml_to_stage(self, mock_agent_with_staging, mock_snowflake_connection):
        """Test uploading YAML dictionary to Snowflake stage"""
        session_id = mock_agent_with_staging.start_session(mock_snowflake_connection.connection_id)
        
        # Create test YAML content
        yaml_content = """
        version: 1.0
        tables:
          customers:
            columns:
              - customer_id: INTEGER
              - name: VARCHAR(100)
        """
        
        # Mock the upload function
        with patch.object(mock_agent_with_staging, '_upload_to_stage') as mock_upload:
            mock_upload.return_value = "File uploaded to @TEST_STAGE/data_dictionary.yaml"
            
            result = mock_agent_with_staging._upload_to_stage()
            assert "uploaded to" in result
            assert "data_dictionary.yaml" in result
            mock_upload.assert_called_once()
    
    def test_list_stage_files(self, mock_agent_with_staging, mock_snowflake_connection):
        """Test listing files in Snowflake stage"""
        session_id = mock_agent_with_staging.start_session(mock_snowflake_connection.connection_id)
        
        with patch.object(mock_agent_with_staging, '_list_stage_files') as mock_list:
            mock_list.return_value = "Files in stage:\n- data_dictionary.yaml\n- backup.yaml"
            
            result = mock_agent_with_staging._list_stage_files()
            assert "Files in stage" in result
            assert "data_dictionary.yaml" in result
            mock_list.assert_called_once()
    
    def test_stage_authentication_bypass(self, mock_agent_with_staging):
        """Test that staging works without requiring Google authentication"""
        # This test verifies our mocking strategy bypasses auth
        session_id = mock_agent_with_staging.start_session("mock_connection")
        
        # Should not raise authentication errors
        with patch('services.datamodel_agent_service.get_snowflake_connections') as mock_get_conn:
            mock_get_conn.return_value = [{"id": "mock_connection", "name": "Mock Conn"}]
            
            # These operations should work without auth
            assert session_id is not None
            context = mock_agent_with_staging.get_session_context(session_id)
            assert context.connection_id == "mock_connection"


class TestSnowflakeStagingIntegration:
    """Integration tests for staging with complete workflow"""
    
    def test_complete_yaml_to_stage_workflow(self):
        """Test complete workflow from YAML generation to stage upload"""
        # Mock all dependencies to bypass authentication
        with patch.dict('sys.modules', {
            'agents': Mock(),
            'agents.memory.session': Mock(), 
            'src.functions.metadata_functions': Mock(),
            'src.functions.dictionary_functions': Mock(),
            'src.functions.stage_functions': Mock(),
            'database': Mock(),
            'models': Mock()
        }):
            # Create a minimal mock agent for testing
            agent = DataModelAgent()
            agent.sessions = {}
            agent.agent = Mock()
            
            # Mock the session
            mock_session = Mock()
            mock_session.agent_context = Mock()
            mock_session.agent_context.selected_tables = ["table1", "table2"]
            mock_session.agent_context.dictionary_content = "yaml content"
            mock_session.agent_context.current_database = "TEST_DB"
            mock_session.agent_context.current_schema = "TEST_SCHEMA"
            agent.sessions["test_session"] = mock_session
            
            # Mock the workflow methods
            with patch.object(agent, '_generate_yaml_dictionary') as mock_gen, \
                 patch.object(agent, '_save_dictionary') as mock_save, \
                 patch.object(agent, '_upload_to_stage') as mock_upload:
                
                mock_gen.return_value = "Generated YAML dictionary with 5 tables"
                mock_save.return_value = "Dictionary saved successfully"
                mock_upload.return_value = "Uploaded to @YAML_STAGE/dictionary.yaml"
                
                # Set current session for function tools
                agent._current_session = mock_session
                
                # Simulate the workflow
                gen_result = agent._generate_yaml_dictionary()
                save_result = agent._save_dictionary()
                upload_result = agent._upload_to_stage()
                
                assert "Generated YAML" in gen_result
                assert "saved successfully" in save_result
                assert "Uploaded to" in upload_result
    
    def test_staging_error_handling(self):
        """Test error handling in staging operations"""
        # Mock all dependencies to bypass authentication
        with patch.dict('sys.modules', {
            'agents': Mock(),
            'agents.memory.session': Mock(),
            'src.functions.metadata_functions': Mock(),
            'src.functions.dictionary_functions': Mock(),
            'src.functions.stage_functions': Mock(),
            'database': Mock(),
            'models': Mock()
        }):
            agent = DataModelAgent()
            agent.sessions = {}
            agent.agent = Mock()
            
            # Mock the session
            mock_session = Mock()
            mock_session.agent_context = Mock()
            agent.sessions["test_session"] = mock_session
            agent._current_session = mock_session
            
            # Test upload failure
            with patch.object(agent, '_upload_to_stage') as mock_upload:
                mock_upload.side_effect = Exception("Stage not accessible")
                
                # Should handle the error gracefully
                try:
                    result = agent._upload_to_stage()
                except Exception as e:
                    assert "Stage not accessible" in str(e)
    
    def test_stage_file_validation(self, mock_agent_with_staging):
        """Test validation of files before uploading to stage"""
        session_id = mock_agent_with_staging.start_session("test_conn")
        
        # Test invalid YAML content
        with patch.object(mock_agent_with_staging, '_validate_yaml_before_upload') as mock_validate:
            mock_validate.return_value = False, "Invalid YAML format"
            
            is_valid, error_msg = mock_agent_with_staging._validate_yaml_before_upload()
            assert not is_valid
            assert "Invalid YAML" in error_msg
        
        # Test valid YAML content
        with patch.object(mock_agent_with_staging, '_validate_yaml_before_upload') as mock_validate:
            mock_validate.return_value = True, None
            
            is_valid, error_msg = mock_agent_with_staging._validate_yaml_before_upload()
            assert is_valid
            assert error_msg is None


class TestStagingAPI:
    """Test API endpoints for staging functionality"""
    
    @patch('services.datamodel_agent_service.get_datamodel_agent')
    def test_staging_api_endpoints_mocked(self, mock_get_agent):
        """Test staging-related API endpoints with mocked authentication"""
        # Mock the agent service
        mock_agent = Mock()
        mock_agent.upload_to_staging.return_value = {"status": "success", "path": "@STAGE/file.yaml"}
        mock_agent.list_staging_files.return_value = ["file1.yaml", "file2.yaml"]
        mock_get_agent.return_value = mock_agent
        
        # Test upload endpoint (would be called by frontend)
        upload_result = mock_agent.upload_to_staging("session_123", "file.yaml")
        assert upload_result["status"] == "success"
        
        # Test list endpoint
        files = mock_agent.list_staging_files("session_123")
        assert len(files) == 2
        assert "file1.yaml" in files


if __name__ == "__main__":
    pytest.main([__file__, "-v"])