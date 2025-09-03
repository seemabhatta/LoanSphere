#!/usr/bin/env python3
"""
Shared visualization storage for datamind charts
Stores chart HTML separately from agent responses to bypass text sanitization
"""

import threading
import time
from typing import Optional

# Thread-safe storage for the latest visualization
_latest_viz: Optional[str] = None
_viz_timestamp: Optional[float] = None
_lock = threading.Lock()

def store_latest_visualization(html: str) -> None:
    """Store the latest visualization HTML"""
    print(f"DEBUG VIZ STORE: Storing latest visualization, HTML length: {len(html)}")
    global _latest_viz, _viz_timestamp
    with _lock:
        _latest_viz = html
        _viz_timestamp = time.time()
        
def get_latest_visualization(max_age_seconds: float = 30.0) -> Optional[str]:
    """Retrieve and remove the latest visualization HTML if within max age"""
    global _latest_viz, _viz_timestamp
    with _lock:
        if _latest_viz and _viz_timestamp:
            age = time.time() - _viz_timestamp
            if age <= max_age_seconds:
                html = _latest_viz
                _latest_viz = None
                _viz_timestamp = None
                print(f"DEBUG VIZ STORE: Retrieved latest visualization, HTML length: {len(html)}, age: {age:.1f}s")
                return html
            else:
                print(f"DEBUG VIZ STORE: Latest visualization too old ({age:.1f}s), discarding")
                _latest_viz = None
                _viz_timestamp = None
        else:
            print("DEBUG VIZ STORE: No latest visualization found")
        return None

def has_latest_visualization() -> bool:
    """Check if a recent visualization exists"""
    with _lock:
        return _latest_viz is not None