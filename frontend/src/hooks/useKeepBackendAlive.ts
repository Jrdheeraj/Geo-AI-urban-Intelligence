import { useEffect } from 'react';

/**
 * Hook to keep Render backend warm by pinging every 5 minutes
 * Prevents cold start issues on free tier
 */
export function useKeepBackendAlive() {
  useEffect(() => {
    // Get API URL from environment or use default
    const API_URL = import.meta.env.VITE_API_URL || 'https://geo-ai-urban-intelligence.onrender.com';
    
    // Keep-alive function
    const ping = () => {
      fetch(`${API_URL}/`)
        .catch(() => {}); // Silently ignore errors
    };
    
    // Ping immediately on mount
    ping();
    
    // Set up periodic pings every 5 minutes
    const interval = setInterval(ping, 5 * 60 * 1000);
    
    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);
}
