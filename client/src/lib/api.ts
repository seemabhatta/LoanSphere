export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
  options?: { timeout?: number }
): Promise<any> {
  // Use environment variable for API base URL, fallback to localhost for development
  const baseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');
  const fullUrl = url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
  const isProduction = !import.meta.env.DEV;
  console.log('[API] Making request to:', fullUrl, isProduction ? '(Production)' : '(Development)');
  console.log('[API] Base URL:', baseUrl);
  console.log('[API] Original URL:', url);
  
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | null = null;
  
  // Standard timeout handling - same for all environments
  if (options?.timeout !== undefined) {
    timeoutId = setTimeout(() => controller.abort(), options.timeout);
  }
  
  try {
    console.log('[API] Starting fetch request...');
    const response = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? {} : {})
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
      signal: controller.signal
    });
    console.log('[API] Fetch completed successfully');
    
    if (timeoutId) clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status}: ${errorText || response.statusText}`);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    
    console.log('[API] Fetch error:', error);
    console.log('[API] Error name:', error.name);
    console.log('[API] Error message:', error.message);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out. The API is taking longer than expected to respond.`);
    }
    
    throw error;
  }
}
