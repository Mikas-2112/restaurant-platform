import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/restaurant-store";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

type OrderItem = {
  menu_item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number | string;
};
type Order = {
  id: string;
  table_number: string;
  status: string;
  subtotal: number | string;
  service_charge_amount: number | string;
  tip_amount: number | string;
  total: number | string;
  created_at: string;
  order_items: OrderItem[];
};
type WaiterTip = {
  id: string;
  waiter_id: string;
  amount: number | string;
  paid_at: string | null;
  created_at: string;
  distributed_at?: string | null;
};

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const range = new URL(request.url).searchParams.get("range") ?? "30";
  const days = [7, 30, 90, 365].includes(Number(range)) ? Number(range) : 30;
  const granularity =
    range === "90" ? "week" : range === "365" ? "month" : "day";
  const supabase = getSupabaseServerClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, currency")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!restaurant)
    return NextResponse.json(
      { error: "Restaurant not found." },
      { status: 404 },
    );
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  let query = supabase
    .from("orders")
    .select(
      "id, table_number, status, subtotal, service_charge_amount, tip_amount, total, created_at, order_items(menu_item_id, item_name, quantity, unit_price)",
    )
    .eq("restaurant_id", restaurant.id)
    .eq("payment_status", "paid")
    .order("created_at", { ascending: true })
    .limit(5000);
  const requestedStart = new Date(Date.now() - days * 86400000);
  const detailStart =
    range === "365" || requestedStart < yearStart ? yearStart : requestedStart;
  query = query.gte("created_at", detailStart.toISOString());
  const { data, error } = await query;
  if (error)
    return NextResponse.json(
      { error: "Could not load analytics." },
      { status: 500 },
    );
  const { data: olderOrders } = await supabase
    .from("orders")
    .select("total, service_charge_amount, created_at")
    .eq("restaurant_id", restaurant.id)
    .eq("payment_status", "paid")
    .lt("created_at", yearStart.toISOString())
    .order("created_at", { ascending: true })
    .limit(10000);
  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("id, name, price, available")
    .eq("restaurant_id", restaurant.id);
  if (menuError)
    return NextResponse.json(
      { error: "Could not load menu analytics." },
      { status: 500 },
    );
  const tipQuery = supabase
    .from("waiter_tips")
    .select("id, waiter_id, amount, paid_at, created_at, distributed_at")
    .eq("restaurant_id", restaurant.id)
    .eq("status", "paid")
    .order("created_at", { ascending: true })
    .limit(5000);
  let { data: waiterTipRows, error: waiterTipError } = await tipQuery;
  if (waiterTipError) {
    const fallback = supabase
      .from("waiter_tips")
      .select("id, waiter_id, amount, paid_at, created_at")
      .eq("restaurant_id", restaurant.id)
      .eq("status", "paid")
      .order("created_at", { ascending: true })
      .limit(5000);
    const fallbackResult = await fallback;
    waiterTipRows =
      fallbackResult.data?.map((tip) => ({ ...tip, distributed_at: null })) ??
      null;
    waiterTipError = fallbackResult.error;
  }
  if (waiterTipError)
    return NextResponse.json(
      { error: "Could not load tip analytics." },
      { status: 500 },
    );
  const waiterTips = (waiterTipRows ?? []) as WaiterTip[];
  const { data: archivedTipRows } = await supabase
    .from("waiter_tip_monthly_totals")
    .select("month, total_amount, tip_count")
    .eq("restaurant_id", restaurant.id)
    .order("month", { ascending: true });
  const archivedTips = archivedTipRows ?? [];
  const currentYear = String(yearStart.getUTCFullYear());
  const currentWaiterTips = waiterTips.filter((tip) =>
    (tip.paid_at ?? tip.created_at).startsWith(currentYear),
  );
  const currentArchivedTips = archivedTips.filter((tip) =>
    String(tip.month).startsWith(currentYear),
  );
  const tipTotal =
    currentWaiterTips.reduce((sum, tip) => sum + Number(tip.amount), 0) +
    currentArchivedTips.reduce((sum, tip) => sum + Number(tip.total_amount), 0);
  const distributedTips = waiterTips.filter((tip) =>
    Boolean(tip.distributed_at),
  );
  const awaitingTips = waiterTips.filter((tip) => !tip.distributed_at);
  const monthlyTips = new Map<string, { amount: number; count: number }>();
  for (const tip of currentArchivedTips)
    monthlyTips.set(String(tip.month).slice(0, 7), {
      amount: Number(tip.total_amount),
      count: Number(tip.tip_count),
    });
  for (const tip of currentWaiterTips) {
    const month = (tip.paid_at ?? tip.created_at).slice(0, 7);
    const current = monthlyTips.get(month) ?? { amount: 0, count: 0 };
    current.amount += Number(tip.amount);
    current.count += 1;
    monthlyTips.set(month, current);
  }
  const orders = (data ?? []) as Order[];
  const annualSummaries = new Map<
    string,
    {
      year: string;
      revenue: number;
      serviceCharges: number;
      tips: number;
      orders: number;
    }
  >();
  for (const order of olderOrders ?? []) {
    const year = order.created_at.slice(0, 4);
    const current = annualSummaries.get(year) ?? {
      year,
      revenue: 0,
      serviceCharges: 0,
      tips: 0,
      orders: 0,
    };
    current.revenue += Number(order.total);
    current.serviceCharges += Number(order.service_charge_amount);
    current.orders += 1;
    annualSummaries.set(year, current);
  }
  for (const tip of archivedTips) {
    const year = String(tip.month).slice(0, 4);
    if (year === currentYear) continue;
    const current = annualSummaries.get(year) ?? {
      year,
      revenue: 0,
      serviceCharges: 0,
      tips: 0,
      orders: 0,
    };
    current.tips += Number(tip.total_amount);
    annualSummaries.set(year, current);
  }
  const revenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const subtotal = orders.reduce(
    (sum, order) => sum + Number(order.subtotal),
    0,
  );
  const serviceCharges = orders.reduce(
    (sum, order) => sum + Number(order.service_charge_amount),
    0,
  );
  const tips = orders.reduce((sum, order) => sum + Number(order.tip_amount), 0);
  const dishes = new Map<string, { quantity: number; revenue: number }>();
  for (const item of menuItems ?? [])
    dishes.set(item.name, { quantity: 0, revenue: 0 });
  const itemPerformance = new Map(
    (menuItems ?? []).map((item) => [
      item.id,
      {
        id: item.id,
        name: item.name,
        price: Number(item.price),
        available: item.available,
        quantity: 0,
        revenue: 0,
      },
    ]),
  );
  const tables = new Map<string, { orders: number; revenue: number }>();
  const periods = new Map<string, { orders: number; revenue: number }>();
  const periodKey = (value: string | Date) => {
    const date = new Date(value);
    if (granularity === "month")
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
    if (granularity === "week") {
      const monday = new Date(date);
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      return monday.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
  };
  if (days) {
    const cursor = new Date();
    cursor.setUTCHours(12, 0, 0, 0);
    if (granularity === "month") cursor.setUTCMonth(0, 1);
    else cursor.setUTCDate(cursor.getUTCDate() - (days - 1));
    const end = new Date();
    while (cursor <= end) {
      periods.set(periodKey(cursor), { orders: 0, revenue: 0 });
      if (granularity === "month")
        cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
      else
        cursor.setUTCDate(
          cursor.getUTCDate() + (granularity === "week" ? 7 : 1),
        );
    }
  }
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
    revenue: 0,
  }));
  for (const order of orders) {
    const orderTotal = Number(order.total);
    const table = tables.get(order.table_number) ?? { orders: 0, revenue: 0 };
    table.orders += 1;
    table.revenue += orderTotal;
    tables.set(order.table_number, table);
    const date = periodKey(order.created_at);
    const period = periods.get(date) ?? { orders: 0, revenue: 0 };
    period.orders += 1;
    period.revenue += orderTotal;
    periods.set(date, period);
    const hour = new Date(order.created_at).getHours();
    hourly[hour].orders += 1;
    hourly[hour].revenue += orderTotal;
    for (const item of order.order_items ?? []) {
      const itemRevenue = Number(item.unit_price) * item.quantity;
      const dish = dishes.get(item.item_name) ?? { quantity: 0, revenue: 0 };
      dish.quantity += item.quantity;
      dish.revenue += itemRevenue;
      dishes.set(item.item_name, dish);
      if (item.menu_item_id) {
        const performance = itemPerformance.get(item.menu_item_id);
        if (performance) {
          performance.quantity += item.quantity;
          performance.revenue += itemRevenue;
        }
      }
    }
  }
  const dishPerformance = [...dishes.entries()].map(([name, values]) => ({
    name,
    ...values,
  }));
  const currentNames = new Set((menuItems ?? []).map((item) => item.name));
  return NextResponse.json({
    restaurant,
    range,
    granularity,
    summary: {
      revenue,
      subtotal,
      serviceCharges,
      tips,
      orders: orders.length,
      averageOrderValue: orders.length ? revenue / orders.length : 0,
      completed: orders.filter((order) => order.status === "completed").length,
      cancelled: orders.filter((order) => order.status === "cancelled").length,
    },
    tipAnalytics: {
      total: tipTotal,
      count:
        currentWaiterTips.length +
        currentArchivedTips.reduce(
          (sum, tip) => sum + Number(tip.tip_count),
          0,
        ),
      average: 0,
      awaitingDistribution: awaitingTips.reduce(
        (sum, tip) => sum + Number(tip.amount),
        0,
      ),
      distributed: distributedTips.reduce(
        (sum, tip) => sum + Number(tip.amount),
        0,
      ),
      awaitingTipIds: awaitingTips.map((tip) => tip.id),
      monthly: [...monthlyTips.entries()]
        .map(([month, values]) => ({ month, ...values }))
        .sort((a, b) => b.month.localeCompare(a.month)),
    },
    annualSummaries: [...annualSummaries.values()].sort((a, b) =>
      b.year.localeCompare(a.year),
    ),
    daily: [...periods.entries()].map(([date, values]) => ({
      date,
      ...values,
    })),
    hourly: hourly.filter((entry) => entry.orders > 0),
    dishes: dishPerformance
      .filter((dish) => dish.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 10),
    leastPopular: dishPerformance
      .filter((dish) => currentNames.has(dish.name))
      .sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue)
      .slice(0, 10),
    menuItems: [...itemPerformance.values()],
    tables: [...tables.entries()]
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
    orders: orders
      .slice()
      .reverse()
      .map(({ order_items, ...order }) => ({
        ...order,
        itemCount: order_items.reduce((sum, item) => sum + item.quantity, 0),
      })),
  });
}
