"""
Shared connection manager for Snowflake connections
Avoids circular imports between unified_agent_service and query_agent_tools
"""
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any
try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

try:
    import snowflake.connector
    from database import SessionLocal, get_db
    from models import SnowflakeConnectionModel
    CONNECTION_DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Connection dependencies not available: {e}")
    CONNECTION_DEPENDENCIES_AVAILABLE = False


class SharedConnectionPool:
    """Centralized connection pool for Snowflake connections"""
    _connections: Dict[str, Any] = {}
    _executor = ThreadPoolExecutor(max_workers=3)
    
    @classmethod
    async def get_snowflake_connection(cls, connection_id: str):
        """Get or create Snowflake connection"""
        if not CONNECTION_DEPENDENCIES_AVAILABLE:
            raise Exception("Connection dependencies not available")
            
        if connection_id not in cls._connections:
            cls._connections[connection_id] = await cls._create_snowflake_connection(connection_id)
        return cls._connections[connection_id]
    
    @classmethod
    async def _create_snowflake_connection(cls, connection_id: str):
        """Create new Snowflake connection"""
        try:
            # Get connection details from database
            db = next(get_db())
            connection = db.query(SnowflakeConnectionModel).filter(SnowflakeConnectionModel.id == connection_id).first()
            
            if not connection:
                raise Exception(f"Connection {connection_id} not found")
            
            # Build connection config
            config = {
                'account': connection.account,
                'user': connection.username,
                'database': connection.database,
                'schema': connection.schema,
                'warehouse': connection.warehouse,
                'role': connection.role,
            }
            
            # Add connection settings
            config.update({
                'connection_timeout': 20,
                'network_timeout': 25,
                'login_timeout': 30,
                'client_session_keep_alive': False,
                'client_request_mfa_token': False,
            })
            
            # Handle different authentication types (from unified_agent_service logic)
            if connection.authenticator == 'RSA':
                if connection.private_key:
                    import tempfile
                    with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
                        f.write(connection.private_key)
                        config['private_key_file'] = f.name
                else:
                    raise Exception("RSA authentication selected but no private key provided")
            elif connection.authenticator == 'PAT':
                config['token'] = connection.password
                config['authenticator'] = 'oauth'
            elif connection.authenticator == 'oauth':
                config['token'] = connection.password
                config['authenticator'] = 'oauth'
            else:
                config['password'] = connection.password
                config['authenticator'] = connection.authenticator or 'snowflake'
            
            # Create connection
            snowflake_conn = snowflake.connector.connect(**config)
            logger.info(f"✅ Created Snowflake connection for {connection_id}")
            return snowflake_conn
                
        except Exception as e:
            logger.error(f"❌ Failed to create Snowflake connection: {e}")
            raise
    
    @classmethod 
    def execute_query_sync(cls, connection_id: str, query: str):
        """Execute query synchronously using connection pool"""
        def _sync_execute():
            # Get connection - should already be created
            if connection_id not in cls._connections:
                return {"status": "error", "error": "Connection not found. Please initialize connection first."}
            
            conn = cls._connections[connection_id]
            cursor = conn.cursor()
            cursor.execute(query)
            
            # Fetch results
            results = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            
            # Convert to list of dictionaries
            data = []
            for row in results:
                row_dict = {}
                for i, col in enumerate(columns):
                    row_dict[col] = row[i]
                data.append(row_dict)
            
            cursor.close()
            
            return {
                "status": "success",
                "result": data,
                "columns": columns,
                "row_count": len(data)
            }
        
        try:
            # Execute in thread pool to avoid blocking the event loop
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_sync_execute)
                return future.result(timeout=30)  # 30 second timeout
                
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            return {"status": "error", "error": str(e)}
    
    @classmethod
    async def run_blocking(cls, func, *args, **kwargs):
        """Run blocking operation in thread pool"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(cls._executor, func, *args, **kwargs)