// API Route: /api/metrics
// Fetches month-to-date revenue from Keap and returns clean data for dashboard

import { NextRequest, NextResponse } from 'next/server';

// Support both server-side and public env vars
const KEAP_TOKEN = process.env.KEAP_TOKEN || process.env.NEXT_PUBLIC_KEAP_TOKEN;
const KEAP_API = 'https://api.infusionsoft.com/crm/rest/v1';

interface KeapTransaction {
  id: number;
  amount: number;
  collection_method?: string;
  currency?: string;
  transaction_date: string;
  type?: string;
  contact_id?: number;
  gateway?: string;
  errors?: string;
}

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
  mtd_revenue: number;
  mtd_month_name: string;
  mtd_source: string; // 'transactions' | 'orders' | 'fallback'
  coaching_clients: number;
  elevate_clients: number;
}

/**
 * Fetch count of contacts with a given Keap tag ID
 */
async function fetchKeapTagCount(tagId: number): Promise<number> {
  try {
    const response = await fetch(
      `https://api.infusionsoft.com/crm/rest/v1/tags/${tagId}/contacts?limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${KEAP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300 }, // cache 5 min
      }
    );
    if (!response.ok) {
      console.warn(`Keap tag ${tagId} count error:`, response.status);
      return 0;
    }
    const data = await response.json();
    return data.count ?? 0;
  } catch (error) {
    console.error(`Error fetching Keap tag ${tagId} count:`, error);
    return 0;
  }
}

/**
 * Fetch MTD transactions from Keap (most accurate for revenue)
 */
async function fetchKeapTransactionsMTD(): Promise<{ success: boolean; total: number; count: number }> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const since = monthStart.toISOString();
    const until = now.toISOString();

    const response = await fetch(
      `${KEAP_API}/transactions?since=${since}&until=${until}&limit=1000`,
      {
        headers: {
          'Authorization': `Bearer ${KEAP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300 }, // cache 5 min
      }
    );

    if (!response.ok) {
      console.warn('Keap transactions API error:', response.status, response.statusText);
      return { success: false, total: 0, count: 0 };
    }

    const data = await response.json();
    const transactions: KeapTransaction[] = data.transactions || data || [];

    // Sum successful transactions (exclude refunds/errors)
    const total = transactions.reduce((sum: number, t: KeapTransaction) => {
      if (t.errors) return sum; // skip failed transactions
      return sum + (t.amount || 0);
    }, 0);

    return { success: true, total: Math.round(total * 100) / 100, count: transactions.length };
  } catch (error) {
    console.error('Error fetching Keap transactions:', error);
    return { success: false, total: 0, count: 0 };
  }
}

/**
 * Fetch MTD orders from Keap (primary revenue source)
 * Excludes DRAFT orders; sums `total` field for all other statuses (PAID, COMPLETE, etc.)
 */
async function fetchKeapOrdersMTD(): Promise<{ success: boolean; total: number; count: number; allOrders: KeapOrder[] }> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const since = monthStart.toISOString();

    const response = await fetch(
      `${KEAP_API}/orders?since=${since}&limit=1000`,
      {
        headers: {
          'Authorization': `Bearer ${KEAP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      console.warn('Keap orders API error:', response.status, response.statusText);
      return { success: false, total: 0, count: 0, allOrders: [] };
    }

    const data = await response.json();
    const orders: KeapOrder[] = data.orders || [];

    // Exclude DRAFT orders; sum total for all others (PAID, COMPLETE, PENDING, etc.)
    const nonDraftOrders = orders.filter((o: KeapOrder) => o.status !== 'DRAFT');
    const total = nonDraftOrders.reduce((sum: number, o: KeapOrder) => sum + (o.total || 0), 0);

    return { success: true, total: Math.round(total * 100) / 100, count: nonDraftOrders.length, allOrders: orders };
  } catch (error) {
    console.error('Error fetching Keap orders:', error);
    return { success: false, total: 0, count: 0, allOrders: [] };
  }
}

/**
 * Fetch all-time orders for aggregate stats (limited set)
 */
async function fetchAllOrders(limit = 200): Promise<KeapOrder[]> {
  try {
    const response = await fetch(
      `${KEAP_API}/orders?limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${KEAP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300 },
      }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.orders || [];
  } catch {
    return [];
  }
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

    const now = new Date();
    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const mtdMonthName = monthNames[now.getMonth()];

    // Use orders endpoint as primary source for MTD revenue
    // Orders endpoint is more accurate than transactions for MTD reporting
    const ordersResult = await fetchKeapOrdersMTD();

    let mtdRevenue = 0;
    let mtdSource = 'fallback';

    if (ordersResult.success) {
      mtdRevenue = ordersResult.total;
      mtdSource = 'orders';
    }

    // Fetch Keap tag counts for coaching and elevate clients
    // Tag 10147 = "One On One Coaching Client - Current"
    // Tag 10123 = "Customer - Elevate Intensive - Current"
    const [coachingClients, elevateClients] = await Promise.all([
      fetchKeapTagCount(10147),
      fetchKeapTagCount(10123),
    ]);

    // Fetch all orders for aggregate stats
    const allOrders = await fetchAllOrders(200);
    const paidOrders = allOrders.filter((o: KeapOrder) => o.status === 'PAID' || o.status === 'COMPLETE');
    const totalRevenue = paidOrders.reduce((sum: number, o: KeapOrder) => sum + (o.total_paid || 0), 0);

    // Last 30 days from orders
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30Days = paidOrders
      .filter((o: KeapOrder) => new Date(o.order_date) >= thirtyDaysAgo)
      .reduce((sum: number, o: KeapOrder) => sum + (o.total_paid || 0), 0);

    const orderCount = paidOrders.length;
    const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0;

    const result: RevenueData = {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      order_count: orderCount,
      average_order: Math.round(avgOrder * 100) / 100,
      date_calculated: now.toISOString(),
      last_30_days: Math.round(last30Days * 100) / 100,
      recurring_monthly: mtdRevenue, // kept for backward compat
      mtd_revenue: mtdRevenue,
      mtd_month_name: mtdMonthName,
      mtd_source: mtdSource,
      coaching_clients: coachingClients,
      elevate_clients: elevateClients,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}
