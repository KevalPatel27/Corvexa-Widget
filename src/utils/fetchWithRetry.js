
export async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          ...options.headers,
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=30, max=1000',
        },
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.name === 'AbortError' || error.name === 'TypeError') {
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
} 