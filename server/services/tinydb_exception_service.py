from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid
from loguru import logger

from services.tinydb_service import TinyDBService

class TinyDBExceptionService:
    def __init__(self, tinydb_service: TinyDBService):
        self.db = tinydb_service
        
        # Initialize with some sample exceptions for demo
        self._ensure_sample_data()
    
    def _ensure_sample_data(self):
        """Create sample exception data for demonstration"""
        exceptions = self.db.get_all('exceptions')
        
        if not exceptions:  # Only create if no exceptions exist
            sample_exceptions = [
                {
                    'id': str(uuid.uuid4()),
                    'xp_loan_number': 'XP12345',
                    'rule_id': 'DOC_MISSING_001',
                    'rule_name': 'Missing W-2 Documents',
                    'severity': 'HIGH',
                    'status': 'open',
                    'confidence': 0.95,
                    'description': 'Required W-2 documents are missing for borrower income verification',
                    'evidence': {
                        'missing_documents': ['W-2 2023', 'W-2 2022'],
                        'source': 'document_validation'
                    },
                    'auto_fix_suggestion': None,
                    'detected_at': (datetime.now() - timedelta(hours=2)).isoformat(),
                    'resolved_at': None,
                    'resolved_by': None,
                    'sla_due': (datetime.now() + timedelta(hours=22)).isoformat(),
                    'notes': None,
                    'category': 'documentation'
                },
                {
                    'id': str(uuid.uuid4()),
                    'xp_loan_number': 'XP12346',
                    'rule_id': 'RATE_PARITY_001',
                    'rule_name': 'Interest Rate Mismatch',
                    'severity': 'HIGH',
                    'status': 'open',
                    'confidence': 0.94,
                    'description': 'Interest rate mismatch between purchase advice (5.25%) and ULDD data (5.75%)',
                    'evidence': {
                        'purchase_advice_rate': 5.25,
                        'uldd_rate': 5.75,
                        'difference': 0.5
                    },
                    'auto_fix_suggestion': {
                        'type': 'UPDATE_RATE',
                        'description': 'Use higher rate (5.75%) for conservative approach',
                        'new_value': 5.75,
                        'confidence': 0.94
                    },
                    'detected_at': (datetime.now() - timedelta(hours=1)).isoformat(),
                    'resolved_at': None,
                    'resolved_by': None,
                    'sla_due': (datetime.now() + timedelta(hours=23)).isoformat(),
                    'notes': None,
                    'category': 'data_validation'
                },
                {
                    'id': str(uuid.uuid4()),
                    'xp_loan_number': 'XP12347',
                    'rule_id': 'COMP_DTI_001',
                    'rule_name': 'DTI Ratio Exceeds Guidelines',
                    'severity': 'MEDIUM',
                    'status': 'open',
                    'confidence': 0.87,
                    'description': 'Debt-to-income ratio of 48% exceeds Fannie Mae guideline of 45%',
                    'evidence': {
                        'calculated_dti': 48.2,
                        'guideline_limit': 45.0,
                        'investor': 'FNMA'
                    },
                    'auto_fix_suggestion': None,
                    'detected_at': (datetime.now() - timedelta(days=1)).isoformat(),
                    'resolved_at': None,
                    'resolved_by': None,
                    'sla_due': (datetime.now() + timedelta(days=2)).isoformat(),
                    'notes': None,
                    'category': 'investor_compliance'
                },
                {
                    'id': str(uuid.uuid4()),
                    'xp_loan_number': 'XP12348',
                    'rule_id': 'SYS_API_001',
                    'rule_name': 'Agency API Connection Failed',
                    'severity': 'LOW',
                    'status': 'open',
                    'confidence': 0.99,
                    'description': 'Unable to retrieve updated purchase advice from Freddie Mac API',
                    'evidence': {
                        'api_endpoint': 'freddie_mac_purchase_advice',
                        'error_code': 'TIMEOUT_ERROR',
                        'retry_count': 3
                    },
                    'auto_fix_suggestion': {
                        'type': 'RETRY_API_CALL',
                        'description': 'Retry API call with exponential backoff',
                        'retry_delay': 300,
                        'confidence': 0.85
                    },
                    'detected_at': (datetime.now() - timedelta(days=2)).isoformat(),
                    'resolved_at': None,
                    'resolved_by': None,
                    'sla_due': (datetime.now() + timedelta(days=3)).isoformat(),
                    'notes': None,
                    'category': 'system_processing'
                },
                {
                    'id': str(uuid.uuid4()),
                    'xp_loan_number': 'XP12349',
                    'rule_id': 'REV_UW_001',
                    'rule_name': 'Credit Score Variance',
                    'severity': 'MEDIUM',
                    'status': 'open',
                    'confidence': 0.78,
                    'description': 'Significant credit score variance between credit reports requires manual review',
                    'evidence': {
                        'scores': {
                            'experian': 742,
                            'equifax': 721,
                            'transunion': 698
                        },
                        'variance': 44
                    },
                    'auto_fix_suggestion': None,
                    'detected_at': (datetime.now() - timedelta(days=3)).isoformat(),
                    'resolved_at': None,
                    'resolved_by': None,
                    'sla_due': (datetime.now() + timedelta(days=1)).isoformat(),
                    'notes': None,
                    'category': 'manual_review'
                },
                {
                    'id': str(uuid.uuid4()),
                    'xp_loan_number': 'XP12350',
                    'rule_id': 'DOC_COMP_001',
                    'rule_name': 'Appraisal Report Incomplete',
                    'severity': 'HIGH',
                    'status': 'resolved',
                    'confidence': 0.91,
                    'description': 'Appraisal report missing comparable sales analysis section',
                    'evidence': {
                        'missing_sections': ['comparable_sales', 'market_analysis'],
                        'appraiser_id': 'APP-001'
                    },
                    'auto_fix_suggestion': None,
                    'detected_at': (datetime.now() - timedelta(days=5)).isoformat(),
                    'resolved_at': (datetime.now() - timedelta(hours=8)).isoformat(),
                    'resolved_by': 'underwriter_jane',
                    'sla_due': (datetime.now() - timedelta(days=2)).isoformat(),
                    'notes': 'Requested complete appraisal from appraiser - received within 24h',
                    'category': 'documentation'
                }
            ]
            
            for exception in sample_exceptions:
                self.db.create('exceptions', exception)
                
            logger.info(f"Created {len(sample_exceptions)} sample exceptions")
    
    def get_exceptions(
        self, 
        status: Optional[str] = None,
        severity: Optional[str] = None,
        category: Optional[str] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get paginated list of exceptions with filters"""
        try:
            exceptions = self.db.get_all('exceptions')
            
            # Apply filters
            if status and status != 'all':
                exceptions = [e for e in exceptions if e.get('status') == status]
            if severity and severity != 'all':
                exceptions = [e for e in exceptions if e.get('severity') == severity]
            if category and category != 'all':
                exceptions = [e for e in exceptions if e.get('category') == category]
            
            # Sort by detected_at (newest first)
            exceptions.sort(key=lambda x: x.get('detected_at', ''), reverse=True)
            
            # Apply pagination
            total = len(exceptions)
            exceptions = exceptions[skip:skip+limit]
            
            logger.info(f"Retrieved {len(exceptions)} exceptions (total: {total})")
            return exceptions
            
        except Exception as e:
            logger.error(f"Error getting exceptions: {e}")
            return []
    
    def get_exception_by_id(self, exception_id: str) -> Optional[Dict[str, Any]]:
        """Get exception by ID"""
        try:
            exceptions = self.db.get_all('exceptions')
            for exception in exceptions:
                if exception.get('id') == exception_id:
                    return exception
            return None
        except Exception as e:
            logger.error(f"Error getting exception {exception_id}: {e}")
            return None
    
    def create_exception(self, exception_data: dict) -> Dict[str, Any]:
        """Create a new exception"""
        try:
            # Add required fields
            exception_data['id'] = str(uuid.uuid4())
            exception_data['detected_at'] = datetime.now().isoformat()
            if 'status' not in exception_data:
                exception_data['status'] = 'open'
                
            # Set SLA due date (24 hours for HIGH, 72 hours for others)
            hours_to_add = 24 if exception_data.get('severity') == 'HIGH' else 72
            exception_data['sla_due'] = (datetime.now() + timedelta(hours=hours_to_add)).isoformat()
            
            exception = self.db.create('exceptions', exception_data)
            logger.info(f"Exception created: {exception_data.get('rule_id')} for loan {exception_data.get('xp_loan_number')}")
            return exception
            
        except Exception as e:
            logger.error(f"Error creating exception: {e}")
            raise
    
    def resolve_exception(
        self, 
        exception_id: str, 
        resolution_type: str,
        resolved_by: str,
        notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Resolve an exception"""
        try:
            exception = self.get_exception_by_id(exception_id)
            if not exception:
                logger.error(f"Exception not found: {exception_id}")
                return None
            
            # Update exception
            update_data = {
                'status': 'resolved',
                'resolved_at': datetime.now().isoformat(),
                'resolved_by': resolved_by
            }
            
            if notes:
                update_data['notes'] = notes
            
            # Add resolution metadata to evidence
            current_evidence = exception.get('evidence', {})
            current_evidence['resolution'] = {
                'type': resolution_type,
                'timestamp': datetime.now().isoformat(),
                'resolved_by': resolved_by
            }
            update_data['evidence'] = current_evidence
            
            updated_exception = self.db.update('exceptions', exception_id, update_data)
            logger.info(f"Exception resolved: {exception_id} by {resolved_by}")
            return updated_exception
            
        except Exception as e:
            logger.error(f"Error resolving exception {exception_id}: {e}")
            return None
    
    def apply_auto_fix(self, exception_id: str, applied_by: str) -> Dict[str, Any]:
        """Apply auto-fix suggestion for an exception"""
        try:
            exception = self.get_exception_by_id(exception_id)
            if not exception:
                return {
                    'status': 'error',
                    'message': 'Exception not found'
                }
            
            auto_fix = exception.get('auto_fix_suggestion')
            if not auto_fix:
                return {
                    'status': 'error',
                    'message': 'No auto-fix suggestion available'
                }
            
            # Execute the auto-fix (simplified for demo)
            fix_result = self._execute_auto_fix(exception, auto_fix)
            
            if fix_result.get('success'):
                # Mark exception as resolved
                self.resolve_exception(
                    exception_id,
                    'auto_fix',
                    applied_by,
                    f"Auto-fix applied: {auto_fix.get('description', 'Unknown fix')}"
                )
                
                return {
                    'status': 'success',
                    'message': 'Auto-fix applied successfully',
                    'details': fix_result
                }
            else:
                return {
                    'status': 'error',
                    'message': 'Auto-fix failed',
                    'error': fix_result.get('error')
                }
                
        except Exception as e:
            logger.error(f"Error applying auto-fix: {e}")
            return {
                'status': 'error',
                'message': 'Auto-fix execution failed',
                'error': str(e)
            }
    
    def _execute_auto_fix(self, exception: Dict[str, Any], auto_fix: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the auto-fix suggestion (simplified demo implementation)"""
        try:
            fix_type = auto_fix.get('type')
            
            if fix_type == 'UPDATE_RATE':
                return {
                    'success': True,
                    'message': f"Interest rate updated to {auto_fix.get('new_value')}%",
                    'details': {
                        'old_value': exception.get('evidence', {}).get('purchase_advice_rate'),
                        'new_value': auto_fix.get('new_value')
                    }
                }
            elif fix_type == 'RETRY_API_CALL':
                return {
                    'success': True,
                    'message': "API call retried successfully",
                    'details': {
                        'retry_count': 1,
                        'delay': auto_fix.get('retry_delay')
                    }
                }
            else:
                return {
                    'success': False,
                    'error': f"Unknown auto-fix type: {fix_type}"
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_exception_stats(self) -> Dict[str, Any]:
        """Get exception statistics summary"""
        try:
            exceptions = self.db.get_all('exceptions')
            
            # Calculate stats
            total_open = len([e for e in exceptions if e.get('status') == 'open'])
            total_resolved = len([e for e in exceptions if e.get('status') == 'resolved'])
            
            # By severity (only open exceptions)
            open_exceptions = [e for e in exceptions if e.get('status') == 'open']
            high_severity = len([e for e in open_exceptions if e.get('severity') == 'HIGH'])
            medium_severity = len([e for e in open_exceptions if e.get('severity') == 'MEDIUM'])
            low_severity = len([e for e in open_exceptions if e.get('severity') == 'LOW'])
            
            # By category (only open exceptions)
            by_category = {}
            for category in ['documentation', 'data_validation', 'investor_compliance', 'manual_review', 'system_processing']:
                by_category[category] = len([e for e in open_exceptions if e.get('category') == category])
            
            # By age
            now = datetime.now()
            under_24h = 0
            one_to_three_days = 0
            over_three_days = 0
            
            for exception in open_exceptions:
                detected_str = exception.get('detected_at')
                if detected_str:
                    try:
                        detected = datetime.fromisoformat(detected_str.replace('Z', '+00:00'))
                        hours_old = (now - detected.replace(tzinfo=None)).total_seconds() / 3600
                        
                        if hours_old < 24:
                            under_24h += 1
                        elif hours_old <= 72:  # 3 days
                            one_to_three_days += 1
                        else:
                            over_three_days += 1
                    except:
                        pass
            
            return {
                'by_status': {
                    'open': total_open,
                    'resolved': total_resolved
                },
                'by_severity': {
                    'high': high_severity,
                    'medium': medium_severity,
                    'low': low_severity
                },
                'by_category': by_category,
                'by_age': {
                    'under_24h': under_24h,
                    'one_to_three_days': one_to_three_days,
                    'over_three_days': over_three_days
                },
                'total_open': total_open,
                'total_resolved': total_resolved,
                'auto_fix_available': len([e for e in open_exceptions if e.get('auto_fix_suggestion')]),
                'avg_resolution_time_hours': 2.4  # Mock for now
            }
            
        except Exception as e:
            logger.error(f"Error getting exception stats: {e}")
            return {
                'by_status': {'open': 0, 'resolved': 0},
                'by_severity': {'high': 0, 'medium': 0, 'low': 0},
                'by_category': {},
                'by_age': {'under_24h': 0, 'one_to_three_days': 0, 'over_three_days': 0},
                'total_open': 0,
                'total_resolved': 0,
                'auto_fix_available': 0,
                'avg_resolution_time_hours': 0
            }