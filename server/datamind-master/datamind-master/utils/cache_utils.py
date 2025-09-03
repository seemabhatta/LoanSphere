CACHE_SIZE = 100

# In-memory cache replacement for streamlit session state
_QUERY_CACHE = {}

def get_cached_sql(user_input):
    """Get cached SQL from in-memory cache."""
    return _QUERY_CACHE.get(user_input)

def set_cached_sql(user_input, intent, sql_response):
    """Set user query, intent, and SQL in cache."""
    global _QUERY_CACHE
    # Enforce cache size limit
    if len(_QUERY_CACHE) >= CACHE_SIZE:
        # Remove the first inserted item (FIFO)
        first_key = next(iter(_QUERY_CACHE))
        del _QUERY_CACHE[first_key]
    _QUERY_CACHE[user_input] = {'intent': intent, 'sql': sql_response}

def clear_session_cache():
    """Clear ONLY the cache from session state - DO NOT delete files."""
    global _QUERY_CACHE
    _QUERY_CACHE.clear()
    print('Session cache cleared - files preserved')

def print_cache_content():
    """Print the current cache content in a readable format."""
    if _QUERY_CACHE:
        for k, v in _QUERY_CACHE.items():
            print(f'User Query: {k}\n  Intent: {v["intent"]}\n  SQL: {v["sql"]}\n')
    else:
        print('Current cache content: (empty)')
