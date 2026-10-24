"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type KitchenOrder = {
  id: string;
  table_number: string;
  customer_note: string;
  status: string;
  total: number | string;
  created_at: string;
  order_items: {
    id: string;
    item_name: string;
    unit_price: number | string;
    quantity: number;
    customer_note: string;
  }[];
};
const statusOptions = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];
const statusLabel: Record<string, string> = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function KitchenOrdersPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [restaurant, setRestaurant] = useState<{
    name: string;
    ordering_enabled: boolean;
  } | null>(null);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"active" | "history" | "all">("active");
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const seenOrders = useRef<Set<string>>(new Set());
  const loadedOnce = useRef(false);
  const loadOrders = useCallback(
    async (accessToken: string) => {
      const response = await fetch("/api/owner/orders", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401) {
        router.replace("/auth");
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not load orders.");
        return;
      }
      setRestaurant(result.restaurant);
      const incoming = result.orders as KitchenOrder[];
      if (loadedOnce.current && incoming.some((order) => order.status === "new" && !seenOrders.current.has(order.id))) {
        setNewOrderAlert(true);
        try { const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; const context = new AudioContextClass(); const oscillator = context.createOscillator(); oscillator.frequency.value = 880; oscillator.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.18); } catch { /* Visual alert remains available. */ }
      }
      incoming.forEach((order) => seenOrders.current.add(order.id));
      loadedOnce.current = true;
      setOrders(incoming);
    },
    [router],
  );
  useEffect(() => {
    let timer: number | undefined;
    getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          router.replace("/auth");
          return;
        }
        setToken(accessToken);
        loadOrders(accessToken);
        timer = window.setInterval(() => loadOrders(accessToken), 5000);
      });
    return () => { if (timer) window.clearInterval(timer); };
  }, [loadOrders, router]);
  async function updateStatus(orderId: string, status: string) {
    if (status === "cancelled" && !window.confirm("Cancel this order? The customer will see that it was cancelled.")) return;
    const response = await fetch("/api/owner/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId, status }),
    });
    if (!response.ok) setError("Could not update the order.");
    else loadOrders(token);
  }
  const visibleOrders = orders.filter((order) => filter === "all" || (filter === "active" ? !["completed", "cancelled"].includes(order.status) : ["completed", "cancelled"].includes(order.status)));
  return (
    <main className="min-h-screen bg-zinc-100 p-6 text-zinc-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
              Kitchen display
            </p>
            <h1 className="mt-1 text-3xl font-bold">
              {restaurant?.name ?? "Kitchen orders"}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Updates automatically every five seconds.
            </p>
          </div>
          <a
            href="/dashboard"
            className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold"
          >
            Back to dashboard
          </a>
        </header>
        {error && (
          <p className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>
        )}
        {newOrderAlert && <button type="button" onClick={() => setNewOrderAlert(false)} className="mb-5 flex w-full items-center justify-between rounded-2xl bg-red-600 p-5 text-left font-bold text-white shadow-lg"><span>🔔 New kitchen order received</span><span className="text-sm">Dismiss</span></button>}
        {restaurant && !restaurant.ordering_enabled && (
          <p className="mb-5 rounded-xl bg-amber-50 p-4 text-amber-800">
            Customer ordering is currently switched off. Existing orders remain
            visible.
          </p>
        )}
        <div className="mb-5 flex flex-wrap gap-2">{(["active", "history", "all"] as const).map((option) => <button key={option} type="button" onClick={() => setFilter(option)} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${filter === option ? "bg-black text-white" : "bg-white text-zinc-600"}`}>{option}</button>)}</div>
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {visibleOrders.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center text-zinc-500">
              No orders yet.
            </div>
          ) : (
            visibleOrders.map((order) => (
              <article
                key={order.id}
                className={`rounded-2xl border-t-4 bg-white p-5 shadow-sm ${order.status === "new" ? "border-red-500" : order.status === "ready" ? "border-green-500" : "border-orange-400"}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">Table</p>
                    <h2 className="text-3xl font-bold">{order.table_number}</h2>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase">
                      {statusLabel[order.status]}
                    </span>
                    <p className="mt-2 text-xs text-zinc-500">
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="mt-5 divide-y divide-zinc-100">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="py-3">
                      <p className="font-semibold">
                        <span className="mr-2 text-orange-600">
                          {item.quantity}×
                        </span>
                        {item.item_name}
                      </p>
                      {item.customer_note && (
                        <p className="mt-1 rounded-lg bg-yellow-50 p-2 text-sm font-medium text-yellow-900">
                          Note: {item.customer_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {order.customer_note && (
                  <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm">
                  <strong>Allergies / dietary requirements:</strong> {order.customer_note}
                  </p>
                )}
                <p className="mt-4 font-bold">
                  Total: £{Number(order.total).toFixed(2)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={status === order.status}
                      onClick={() => updateStatus(order.id, status)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:ring-2 ${status === "cancelled" ? "bg-red-50 text-red-700" : "bg-zinc-100"}`}
                    >
                      {statusLabel[status]}
                    </button>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
