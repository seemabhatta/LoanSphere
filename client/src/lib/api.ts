export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
  options?: { timeout?: number }
): Promise<any> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const fullUrl = url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
  
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeout = options?.timeout || 30000; // Default 30 second timeout for slow API responses
  
  // For Railway/production, increase timeouts significantly
  const isProduction = window.location.hostname !== 'localhost';
  const productionTimeout = isProduction ? Math.max(timeout, 600000) : timeout; // 10 minutes in production
  
  const timeoutId = setTimeout(() => controller.abort(), productionTimeout);
  
  try {
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
    
    clearTimeout(timeoutId);
    
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
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout / 1000} seconds. The API is taking longer than expected to respond.`);
    }
    
    throw error;
  }
}
