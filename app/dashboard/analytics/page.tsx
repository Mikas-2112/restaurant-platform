"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type Analytics = {
  restaurant: { name: string; currency: string };
  granularity: "day" | "week" | "month";
  summary: {
    revenue: number;
    subtotal: number;
    serviceCharges: number;
    tips: number;
    orders: number;
    averageOrderValue: number;
    completed: number;
    cancelled: number;
  };
  tipAnalytics: {
    total: number;
    count: number;
    average: number;
    awaitingDistribution: number;
    distributed: number;
    awaitingTipIds: string[];
    monthly: { month: string; amount: number; count: number }[];
  };
  annualSummaries: {
    year: string;
    revenue: number;
    serviceCharges: number;
    tips: number;
    orders: number;
  }[];
  daily: { date: string; orders: number; revenue: number }[];
  dishes: { name: string; quantity: number; revenue: number }[];
  leastPopular: { name: string; quantity: number; revenue: number }[];
  menuItems: {
    id: string;
    name: string;
    price: number;
    available: boolean;
    quantity: number;
    revenue: number;
  }[];
  tables: { name: string; orders: number; revenue: number }[];
  orders: {
    id: string;
    table_number: string;
    status: string;
    subtotal: number;
    service_charge_amount: number;
    tip_amount: number;
    total: number;
    created_at: string;
    itemCount: number;
  }[];
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [range, setRange] = useState("30");
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [itemSearch, setItemSearch] = useState("");
  const [itemSort, setItemSort] = useState("quantity-desc");
  const [itemPage, setItemPage] = useState(1);
  const load = useCallback(
    async (accessToken: string, selectedRange: string) => {
      setLoading(true);
      setError("");
      const response = await fetch(
        `/api/owner/analytics?range=${selectedRange}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (response.status === 401) {
        router.replace("/auth");
        return;
      }
      const result = await response.json();
      if (!response.ok) setError(result.error ?? "Could not load analytics.");
      else setData(result);
      setLoading(false);
    },
    [router],
  );
  useEffect(() => {
    getSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data: session }) => {
        const accessToken = session.session?.access_token;
        if (!accessToken) {
          router.replace("/auth");
          return;
        }
        load(accessToken, range);
      });
  }, [load, range, router]);
  function downloadReport() {
    if (!data) return;
    const rows = [
      [
        "Order reference",
        "Date",
        "Table",
        "Status",
        "Items",
        "Subtotal",
        "Service charge",
        "Tips",
        "Total",
      ],
      ...data.orders.map((order) => [
        order.id.slice(0, 8).toUpperCase(),
        new Date(order.created_at).toLocaleString(),
        order.table_number,
        order.status,
        order.itemCount,
        Number(order.subtotal).toFixed(2),
        Number(order.service_charge_amount).toFixed(2),
        Number(order.tip_amount).toFixed(2),
        Number(order.total).toFixed(2),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `${data.restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-analytics.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  const money = (value: number) =>
    `${data?.restaurant.currency ?? "£"}${Number(value).toFixed(2)}`;
  const maxDaily = Math.max(
    1,
    ...(data?.daily.map((day) => day.revenue) ?? []),
  );
  const maxDish = Math.max(
    1,
    ...(data?.dishes.map((dish) => dish.quantity) ?? []),
  );
  const completionRate = data?.summary.orders
    ? Math.round((data.summary.completed / data.summary.orders) * 100)
    : 0;
  const trendLabel = (dateValue: string) => {
    const date = new Date(`${dateValue}T12:00:00Z`);
    if (data?.granularity === "month")
      return date.toLocaleDateString([], { month: "short", year: "numeric" });
    if (data?.granularity === "week")
      return `Week of ${date.toLocaleDateString([], { day: "numeric", month: "short" })}`;
    return date.toLocaleDateString([], { day: "numeric", month: "short" });
  };
  const trendDescription =
    data?.granularity === "month"
      ? "Paid totals by month"
      : data?.granularity === "week"
        ? "Paid totals by week"
        : "Paid totals by day";
  const filteredItems = (data?.menuItems ?? [])
    .filter((item) =>
      item.name.toLowerCase().includes(itemSearch.trim().toLowerCase()),
    )
    .sort((a, b) => {
      if (itemSort === "quantity-asc")
        return a.quantity - b.quantity || a.name.localeCompare(b.name);
      if (itemSort === "revenue-desc")
        return b.revenue - a.revenue || a.name.localeCompare(b.name);
      if (itemSort === "name") return a.name.localeCompare(b.name);
      return b.quantity - a.quantity || a.name.localeCompare(b.name);
    });
  const itemPageCount = Math.max(1, Math.ceil(filteredItems.length / 25));
  const safeItemPage = Math.min(itemPage, itemPageCount);
  const visibleItems = filteredItems.slice(
    (safeItemPage - 1) * 25,
    safeItemPage * 25,
  );
  return (
    <main className="min-h-screen bg-[#f5f4f0] p-6 text-zinc-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-600">
              Performance
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {data?.restaurant.name ?? "Restaurant analytics"}
            </h1>
            <p className="mt-2 text-zinc-500">
              Paid-order performance, service charges and menu insights.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/dashboard"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold"
            >
              Dashboard
            </a>
            <a
              href="/dashboard/orders"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold"
            >
              Kitchen
            </a>
            <button
              onClick={downloadReport}
              disabled={!data?.orders.length}
              className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              Download CSV
            </button>
          </div>
        </header>
        <div className="mb-7 flex flex-wrap gap-2">
          {[
            ["7", "7 days"],
            ["30", "30 days"],
            ["90", "90 days"],
            ["365", "This year"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${range === value ? "bg-indigo-700 text-white" : "bg-white text-zinc-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {error && (
          <p className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>
        )}
        {loading && !data ? (
          <div className="rounded-3xl bg-white p-12 text-center text-zinc-500">
            Loading analytics…
          </div>
        ) : (
          data && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Revenue", money(data.summary.revenue), "Paid order total"],
                  [
                    "Paid orders",
                    data.summary.orders,
                    `${data.summary.completed} completed`,
                  ],
                  [
                    "Average order",
                    money(data.summary.averageOrderValue),
                    "Per paid order",
                  ],
                  [
                    "Service charges",
                    money(data.summary.serviceCharges),
                    "Shown separately",
                  ],
                ].map(([label, value, note]) => (
                  <article
                    key={label}
                    className="rounded-3xl bg-white p-6 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-zinc-500">
                      {label}
                    </p>
                    <p className="mt-3 text-3xl font-bold">{value}</p>
                    <p className="mt-2 text-xs text-zinc-400">{note}</p>
                  </article>
                ))}
              </section>
              <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700">
                      Tips analytics
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">
                      Separate from sales revenue
                    </h2>
                    <p className="mt-1 text-sm text-amber-900/70">
                      Waiter tips are tracked here and are never included in the
                      revenue cards above.
                    </p>
                  </div>
                </div>
                <article className="mt-6 max-w-sm rounded-2xl bg-white p-5">
                  <p className="text-sm font-semibold text-zinc-500">
                    Current-year waiter tips
                  </p>
                  <p className="mt-2 text-3xl font-bold">
                    {money(data.tipAnalytics.total)}
                  </p>
                </article>
                <div className="mt-6 max-h-[420px] overflow-y-auto rounded-2xl border border-amber-200 bg-white">
                  <div className="sticky top-0 z-10 grid grid-cols-[1fr_90px_130px] bg-amber-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-amber-900 sm:grid-cols-[1fr_120px_170px]">
                    <span>Month</span>
                    <span className="text-right">Tips</span>
                    <span className="text-right">Total tips</span>
                  </div>
                  {data.tipAnalytics.monthly.map((month) => (
                    <div
                      key={month.month}
                      className="grid grid-cols-[1fr_90px_130px] items-center border-t border-amber-100 px-4 py-4 sm:grid-cols-[1fr_120px_170px]"
                    >
                      <span className="font-semibold">
                        {new Date(
                          `${month.month}-01T12:00:00Z`,
                        ).toLocaleDateString([], {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-right text-sm text-zinc-500">
                        {month.count}
                      </span>
                      <span className="text-right text-lg font-bold">
                        {money(month.amount)}
                      </span>
                    </div>
                  ))}
                  {!data.tipAnalytics.monthly.length && (
                    <p className="p-6 text-center text-zinc-500">
                      No waiter tips recorded yet.
                    </p>
                  )}
                </div>
              </section>
              <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Completed years
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">Annual summaries</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Older detail is archived securely; the dashboard keeps one
                    broad result for each completed year.
                  </p>
                </div>
                <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
                  <div className="grid grid-cols-[70px_1fr] bg-zinc-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-500 sm:grid-cols-[90px_1fr_1fr_1fr_100px]">
                    <span>Year</span>
                    <span className="text-right">Revenue</span>
                    <span className="hidden text-right sm:block">
                      Service charges
                    </span>
                    <span className="hidden text-right sm:block">
                      Waiter tips
                    </span>
                    <span className="hidden text-right sm:block">Orders</span>
                  </div>
                  {data.annualSummaries.map((year) => (
                    <div
                      key={year.year}
                      className="grid grid-cols-[70px_1fr] items-center border-t border-zinc-100 px-4 py-4 sm:grid-cols-[90px_1fr_1fr_1fr_100px]"
                    >
                      <span className="font-bold">{year.year}</span>
                      <span className="text-right text-lg font-bold">
                        {money(year.revenue)}
                      </span>
                      <span className="hidden text-right sm:block">
                        {money(year.serviceCharges)}
                      </span>
                      <span className="hidden text-right sm:block">
                        {money(year.tips)}
                      </span>
                      <span className="hidden text-right sm:block">
                        {year.orders}
                      </span>
                    </div>
                  ))}
                  {!data.annualSummaries.length && (
                    <p className="border-t border-zinc-100 p-6 text-center text-zinc-500">
                      The first annual summary will appear after this calendar
                      year ends.
                    </p>
                  )}
                </div>
              </section>
              <section className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[1.4fr_1fr]">
                <article className="min-w-0 overflow-hidden rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">Revenue trend</h2>
                      <p className="text-sm text-zinc-500">
                        {trendDescription}
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                      {data.daily.length}{" "}
                      {data.granularity === "month"
                        ? "months"
                        : data.granularity === "week"
                          ? "weeks"
                          : "days"}
                    </span>
                  </div>
                  {data.daily.length ? (
                    <>
                      <div className="mt-8 w-full max-w-full overflow-x-auto overscroll-x-contain pb-3">
                        <div
                          className={`grid h-60 items-end gap-2 ${range === "30" || range === "90" ? "w-max min-w-full" : "w-full"}`}
                          style={{
                            gridTemplateColumns:
                              range === "30"
                                ? `repeat(${data.daily.length}, 52px)`
                                : range === "90"
                                  ? `repeat(${data.daily.length}, 78px)`
                                  : `repeat(${data.daily.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {data.daily.map((day) => (
                            <div
                              key={day.date}
                              className="flex min-w-0 flex-col items-center justify-end gap-2"
                            >
                              <span className="max-w-full truncate text-[10px] font-semibold text-zinc-500">
                                {money(day.revenue)}
                              </span>
                              <div
                                title={`${day.orders} orders`}
                                className="w-full rounded-t-lg bg-indigo-500"
                                style={{
                                  height: `${Math.max(8, (day.revenue / maxDaily) * 170)}px`,
                                }}
                              />
                              {range === "7" ? (
                                <span className="text-center leading-tight">
                                  <span className="block text-xs font-semibold text-zinc-700">
                                    {new Date(
                                      `${day.date}T12:00:00Z`,
                                    ).toLocaleDateString([], {
                                      weekday: "short",
                                    })}
                                  </span>
                                  <span className="mt-1 block whitespace-nowrap text-[10px] text-zinc-500">
                                    {new Date(
                                      `${day.date}T12:00:00Z`,
                                    ).toLocaleDateString([], {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                </span>
                              ) : (
                                <span className="whitespace-nowrap text-[10px] text-zinc-500">
                                  {trendLabel(day.date)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      {(range === "30" || range === "90") && (
                        <p className="mt-2 text-center text-xs text-zinc-400">
                          Scroll inside the chart to see all{" "}
                          {range === "90" ? "weeks" : "30 days"}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-10 text-center text-zinc-500">
                      No paid orders in this period.
                    </p>
                  )}
                </article>
                <article className="rounded-3xl bg-zinc-900 p-6 text-white shadow-sm">
                  <h2 className="text-xl font-bold">Order health</h2>
                  <div className="mt-7 flex items-end justify-between">
                    <div>
                      <p className="text-5xl font-bold">{completionRate}%</p>
                      <p className="mt-2 text-sm text-zinc-400">
                        Completion rate
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{data.summary.completed} completed</p>
                      <p className="mt-1 text-zinc-400">
                        {data.summary.cancelled} cancelled
                      </p>
                    </div>
                  </div>
                  <div className="mt-7 h-3 overflow-hidden rounded-full bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-green-400"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  <div className="mt-8 border-t border-zinc-700 pt-5">
                    <p className="text-sm text-zinc-400">Food subtotal</p>
                    <p className="mt-1 text-xl font-bold">
                      {money(data.summary.subtotal)}
                    </p>
                  </div>
                </article>
              </section>
              <section className="mt-6 grid gap-6 lg:grid-cols-2">
                <article className="rounded-3xl bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-bold">Popular dishes</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Ranked by quantity sold
                  </p>
                  <div className="mt-6 space-y-5">
                    {data.dishes.length ? (
                      data.dishes.map((dish, index) => (
                        <div key={dish.name}>
                          <div className="mb-2 flex justify-between gap-4">
                            <p className="font-semibold">
                              <span className="mr-2 text-zinc-400">
                                {index + 1}
                              </span>
                              {dish.name}
                            </p>
                            <p className="text-sm text-zinc-500">
                              {dish.quantity} sold · {money(dish.revenue)}
                            </p>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-orange-500"
                              style={{
                                width: `${(dish.quantity / maxDish) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-500">No dish data yet.</p>
                    )}
                  </div>
                </article>
                <article className="rounded-3xl bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-bold">Table performance</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Revenue and paid orders by table
                  </p>
                  <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
                    <div className="grid grid-cols-3 bg-zinc-50 px-4 py-3 text-xs font-bold uppercase text-zinc-500">
                      <span>Table</span>
                      <span className="text-right">Orders</span>
                      <span className="text-right">Revenue</span>
                    </div>
                    {data.tables.map((table) => (
                      <div
                        key={table.name}
                        className="grid grid-cols-3 border-t border-zinc-100 px-4 py-4"
                      >
                        <span className="font-semibold">{table.name}</span>
                        <span className="text-right">{table.orders}</span>
                        <span className="text-right font-semibold">
                          {money(table.revenue)}
                        </span>
                      </div>
                    ))}
                    {!data.tables.length && (
                      <p className="p-6 text-center text-zinc-500">
                        No table data yet.
                      </p>
                    )}
                  </div>
                </article>
              </section>
              <section className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-rose-950">
                      Least popular dishes
                    </h2>
                    <p className="mt-1 text-sm text-rose-800">
                      Current menu items with the fewest sales in this period,
                      including dishes never ordered.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700">
                    A signal—not an automatic removal rule
                  </span>
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {data.leastPopular.map((dish, index) => (
                    <div
                      key={dish.name}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold">{dish.name}</p>
                          <p className="text-xs text-zinc-500">
                            {dish.quantity === 0
                              ? "Never ordered in this period"
                              : `${dish.quantity} sold`}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-zinc-600">
                        {money(dish.revenue)}
                      </p>
                    </div>
                  ))}
                  {!data.leastPopular.length && (
                    <p className="text-sm text-rose-800">
                      No current menu items to compare.
                    </p>
                  )}
                </div>
                <p className="mt-5 text-xs leading-5 text-rose-700">
                  Consider seasonality, availability, food cost and how long an
                  item has been listed before replacing it.
                </p>
              </section>
              <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">Every menu item</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Individual sales and revenue for all current dishes in the
                      selected period.
                    </p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-600">
                    {filteredItems.length} items
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px]">
                  <input
                    type="search"
                    value={itemSearch}
                    onChange={(event) => {
                      setItemSearch(event.target.value);
                      setItemPage(1);
                    }}
                    placeholder="Search dishes…"
                    className="rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-indigo-500"
                  />
                  <select
                    value={itemSort}
                    onChange={(event) => {
                      setItemSort(event.target.value);
                      setItemPage(1);
                    }}
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none focus:border-indigo-500"
                  >
                    <option value="quantity-desc">Most sold first</option>
                    <option value="quantity-asc">Least sold first</option>
                    <option value="revenue-desc">Highest revenue first</option>
                    <option value="name">Name A–Z</option>
                  </select>
                </div>
                <div className="mt-5 max-w-full overflow-x-auto rounded-2xl border border-zinc-200">
                  <div className="min-w-[680px]">
                    <div className="grid grid-cols-[1fr_110px_110px_130px_100px] bg-zinc-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
                      <span>Dish</span>
                      <span className="text-right">Price</span>
                      <span className="text-right">Sold</span>
                      <span className="text-right">Revenue</span>
                      <span className="text-right">Status</span>
                    </div>
                    {visibleItems.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1fr_110px_110px_130px_100px] items-center border-t border-zinc-100 px-4 py-4 text-sm"
                      >
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-right">{money(item.price)}</span>
                        <span className="text-right font-bold">
                          {item.quantity}
                        </span>
                        <span className="text-right font-semibold">
                          {money(item.revenue)}
                        </span>
                        <span
                          className={`text-right text-xs font-semibold ${item.available ? "text-green-700" : "text-zinc-400"}`}
                        >
                          {item.available ? "Available" : "Hidden"}
                        </span>
                      </div>
                    ))}
                    {!visibleItems.length && (
                      <p className="p-8 text-center text-zinc-500">
                        No menu items match your search.
                      </p>
                    )}
                  </div>
                </div>
                {itemPageCount > 1 && (
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      disabled={safeItemPage === 1}
                      onClick={() =>
                        setItemPage((page) => Math.max(1, page - 1))
                      }
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <p className="text-sm text-zinc-500">
                      Page {safeItemPage} of {itemPageCount}
                    </p>
                    <button
                      type="button"
                      disabled={safeItemPage === itemPageCount}
                      onClick={() =>
                        setItemPage((page) => Math.min(itemPageCount, page + 1))
                      }
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </section>
            </>
          )
        )}
      </div>
    </main>
  );
}
