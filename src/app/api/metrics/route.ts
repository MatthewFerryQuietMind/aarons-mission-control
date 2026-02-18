// API Route: /api/metrics/revenue
// Fetches monthly revenue from Keap and returns clean data for dashboard

import { NextRequest, NextResponse } from 'next/server';

const KEAP_TOKEN = process.env.NEXT_PUBLIC_KEAP_TOKEN;
const KEAP_API = 'https://api.infusionsoft.com/crm/rest/v1';

interface KeapOrder {
  id: number;
  title: string;
  status: string;
  total: number;
  total_paid: number;
  order_date: string;
  recurring?: boolean;
}

interface RevenueData {
  total_revenue: number;
  order_count: number;
  average_order: number;
  date_calculated: string;
  last_30_days: number;
  recurring_monthly: number;
}

/**
 * Fetch all orders from Keap
 */
async function fetchKeapOrders(limit = 100): Promise<KeapOrder[]> {
  try {
    const response = await fetch(
      `${KEAP_API}/orders?limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${KEAP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Keap API error:', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.orders || [];
  } catch (error) {
    console.error('Error fetching Keap orders:', error);
    return [];
  }
}

/**
 * Calculate revenue metrics
 */
function calculateMetrics(orders: KeapOrder[]): RevenueData {
  // Filter for PAID orders only
  const paidOrders = orders.filter((order) => order.status === 'PAID');
  
  // Calculate totals
  const totalRevenue = paidOrders.reduce((sum, order) => {
    return sum + (order.total_paid || 0);
  }, 0);

  // Calculate month-to-date (1st of current month to today)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthToDate = paidOrders
    .filter((order) => new Date(order.order_date) >= monthStart)
    .reduce((sum, order) => sum + (order.total_paid || 0), 0);

  // Calculate last 30 days (for reference, but not used in display)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last30Days = paidOrders
    .filter((order) => new Date(order.order_date) >= thirtyDaysAgo)
    .reduce((sum, order) => sum + (order.total_paid || 0), 0);

  const orderCount = paidOrders.length;
  const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0;

  return {
    total_revenue: Math.round(totalRevenue * 100) / 100,
    order_count: orderCount,
    average_order: Math.round(avgOrder * 100) / 100,
    date_calculated: new Date().toISOString(),
    last_30_days: Math.round(last30Days * 100) / 100,
    recurring_monthly: Math.round(monthToDate * 100) / 100, // Now returns month-to-date total
  };
}

/**
 * GET handler - fetch and return revenue metrics
 */
export async function GET(request: NextRequest) {
  try {
    if (!KEAP_TOKEN) {
      return NextResponse.json(
        { error: 'KEAP_TOKEN not configured' },
        { status: 500 }
      );
    }

    const orders = await fetchKeapOrders(200);
    const metrics = calculateMetrics(orders);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Revenue API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}
