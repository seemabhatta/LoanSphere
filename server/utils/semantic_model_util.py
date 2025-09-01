"""
Semantic Model Utilities for LoanSphere
Ported from DataMind CLI - Provides validation and structured generation of semantic models
"""
import os
import re
import yaml
from typing import Dict, Any, Tuple, Optional
from datetime import datetime
from loguru import logger

from google.protobuf.json_format import ParseDict
from utils.schema.semantic_model_pb2 import SemanticModel
from pydantic import BaseModel
from typing import List, Optional

PROTOBUF_AVAILABLE = True

class PydanticSemanticModel(BaseModel):
    name: str
    tables: List[dict] = []
    relationships: List[dict] = []
    verified_queries: List[dict] = []


def convert_dates_to_strings(obj):
    """Convert date objects to ISO format strings for protobuf compatibility"""
    if isinstance(obj, dict):
        return {k: convert_dates_to_strings(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_dates_to_strings(i) for i in obj]
    elif isinstance(obj, (datetime.date, datetime)):
        return obj.isoformat()
    else:
        return obj


def convert_sample_values_to_strings(data):
    """Ensure all sample values are strings for protobuf compatibility"""
    if isinstance(data, dict):
        for k, v in data.items():
            if k == "sampleValues" and isinstance(v, list):
                data[k] = [str(item) for item in v]
            else:
                convert_sample_values_to_strings(v)
    elif isinstance(data, list):
        for item in data:
            convert_sample_values_to_strings(item)
    return data


def validate_yaml_with_proto(yaml_str: str) -> Tuple[bool, Optional[str]]:
    """
    Validates a YAML string against the SemanticModel protobuf schema.
    Returns (True, None) if valid, (False, error_message) if not.
    """
    try:
        data = yaml.safe_load(yaml_str)
        data = convert_dates_to_strings(data)
        data = convert_sample_values_to_strings(data)
        
        # Convert YAML dict to protobuf
        ParseDict(data, SemanticModel())
        return True, None
    except Exception as e:
        return False, str(e)


def validate_semantic_model(yaml_str: str) -> Dict[str, Any]:
    """
    Validates a YAML string against the SemanticModel protobuf schema.
    Returns status dict with success/error information.
    """
    try:
        is_valid, error = validate_yaml_with_proto(yaml_str)
        if is_valid:
            return {"status": "success", "message": "YAML is valid against protobuf schema."}
        else:
            return {"status": "error", "message": error}
    except Exception as e:
        return {"status": "error", "message": f"Validation failed: {str(e)}"}


def generate_structured_yaml_with_openai(table_data_prompt: str, openai_client) -> str:
    """
    Generate YAML using OpenAI structured output with semantic model schema.
    Uses auto-generated Pydantic model from protobuf schema to guarantee valid structure.
    """
    if not PROTOBUF_AVAILABLE or not PydanticSemanticModel:
        raise Exception("Protobuf dependencies not available for structured generation")
        
    try:
        response = openai_client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a data dictionary generator. Generate a structured semantic model based on the provided table data. Classify columns as measures (numeric metrics), dimensions (categorical attributes), or time_dimensions (date/time fields). Include sample values, synonyms, and descriptions."},
                {"role": "user", "content": table_data_prompt}
            ],
            response_format=PydanticSemanticModel
        )
        
        # Convert Pydantic model to YAML
        semantic_model = response.parsed
        
        if semantic_model is None:
            raise Exception("Response parsed is None - structured parsing failed")
            
        yaml_text = yaml.dump(semantic_model.model_dump(), sort_keys=False, default_flow_style=False)
        
        logger.info(f"Generated structured semantic model YAML ({len(yaml_text)} characters)")
        return yaml_text
        
    except Exception as e:
        logger.error(f"Failed to generate structured YAML: {e}")
        raise Exception(f"Structured YAML generation failed: {str(e)}")


def classify_column_by_name_and_type(column_name: str, column_type: str, sample_values: list = None) -> str:
    """
    Classify a column as 'measure', 'dimension', or 'time_dimension' based on name and type.
    Simple heuristic-based classification without LLM.
    """
    column_name_lower = column_name.lower()
    column_type_lower = column_type.lower()
    
    # Time dimension patterns
    time_patterns = [
        'date', 'time', 'timestamp', 'created', 'updated', 'modified', 
        'start', 'end', 'expires', 'due', 'birth', 'event'
    ]
    if any(pattern in column_name_lower for pattern in time_patterns) or \
       any(t in column_type_lower for t in ['date', 'time', 'timestamp']):
        return 'time_dimension'
    
    # Measure patterns (numeric fields that can be aggregated)
    measure_patterns = [
        'amount', 'total', 'sum', 'count', 'num', 'quantity', 'qty', 'price', 
        'cost', 'value', 'balance', 'rate', 'percent', 'score', 'rating',
        'revenue', 'profit', 'loss', 'income', 'expense', 'fee', 'charge'
    ]
    numeric_types = ['number', 'numeric', 'decimal', 'float', 'double', 'int', 'bigint']
    
    if (any(pattern in column_name_lower for pattern in measure_patterns) and \
        any(t in column_type_lower for t in numeric_types)) or \
       (column_name_lower.endswith(('_amount', '_total', '_count', '_sum'))):
        return 'measure'
    
    # Default to dimension (categorical/descriptive data)
    return 'dimension'


def detect_primary_key_columns(columns: list, table_name: str) -> list:
    """
    Detect likely primary key columns using heuristics.
    """
    pk_candidates = []
    
    for col in columns:
        col_name = col.get('name', '').lower()
        col_type = col.get('type', '').lower()
        
        # Common primary key patterns
        if col_name in ['id', 'pk', f'{table_name.lower()}_id'] or \
           col_name.endswith('_id') and col_name.startswith(table_name.lower()[:3]) or \
           ('int' in col_type or 'number' in col_type) and 'id' in col_name:
            pk_candidates.append(col['name'])
    
    return pk_candidates[:1]  # Return first candidate only


def generate_column_synonyms(column_name: str) -> list:
    """
    Generate simple synonyms for column names using basic transformations.
    """
    synonyms = []
    name = column_name.lower()
    
    # Common business term mappings
    synonym_map = {
        'customer_id': ['customer', 'cust_id', 'client_id'],
        'product_id': ['product', 'item_id', 'sku'],
        'order_id': ['order', 'order_number', 'order_num'],
        'amount': ['total', 'sum', 'value'],
        'quantity': ['qty', 'count', 'number'],
        'created_date': ['created', 'date_created', 'creation_date'],
        'updated_date': ['updated', 'date_updated', 'last_modified'],
    }
    
    # Check exact matches
    if name in synonym_map:
        synonyms.extend(synonym_map[name])
    
    # Generate variations
    if '_' in name:
        # Convert snake_case to space separated
        synonyms.append(name.replace('_', ' '))
        # Convert to camelCase
        parts = name.split('_')
        camel_case = parts[0] + ''.join(word.capitalize() for word in parts[1:])
        synonyms.append(camel_case)
    
    return list(set(synonyms))  # Remove duplicates


def infer_default_aggregation(column_name: str, column_type: str) -> str:
    """
    Infer the default aggregation for measure columns.
    """
    name_lower = column_name.lower()
    
    if 'count' in name_lower or 'num' in name_lower or name_lower.endswith('_count'):
        return 'SUM'
    elif 'rate' in name_lower or 'percent' in name_lower or 'ratio' in name_lower:
        return 'AVG'
    elif 'amount' in name_lower or 'total' in name_lower or 'sum' in name_lower:
        return 'SUM'
    elif 'price' in name_lower or 'cost' in name_lower or 'value' in name_lower:
        return 'AVG'
    else:
        return 'SUM'  # Default aggregation


logger.info("Semantic model utilities initialized")