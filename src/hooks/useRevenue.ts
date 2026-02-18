import { useState, useEffect } from 'react';

export interface RevenueData {
  total_revenue: number;
  order_count: number;
  average_order: number;
  date_calculated: string;
  last_30_days: number;
  recurring_monthly: number;
}

export function useRevenue() {
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/metrics/revenue');
      
      if (!response.ok) {
        throw new Error(`Revenue API error: ${response.statusText}`);
      }

      const data: RevenueData = await response.json();
      setRevenue(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch revenue';
      setError(message);
      console.error('Revenue fetch error:', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchRevenue, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return { revenue, loading, error, refetch: fetchRevenue };
}
