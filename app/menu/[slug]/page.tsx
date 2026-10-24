"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RestaurantMenu } from "../../lib/menu";

type BasketItem = {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
};
type TrackedOrder = {
  id: string;
  status: string;
  createdAt: string;
  completedAt?: string;
};
const terminalStatuses = new Set(["completed", "cancelled"]);
const finishedOrderLifetime = 30 * 60 * 1000;
const visitLifetime = 12 * 60 * 60 * 1000;

function removeExpiredOrders(orders: TrackedOrder[]) {
  const now = Date.now();
  return orders.filter((order) => {
    const createdAt = new Date(order.createdAt).getTime();
    if (!Number.isFinite(createdAt) || now - createdAt >= visitLifetime)
      return false;
    if (!terminalStatuses.has(order.status)) return true;
    const finishedAt = new Date(order.completedAt ?? order.createdAt).getTime();
    return (
      Number.isFinite(finishedAt) && now - finishedAt < finishedOrderLifetime
    );
  });
}

export default function MenuPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [category, setCategory] = useState("All");
  const [error, setError] = useState("");
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [detectedTable, setDetectedTable] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [allergies, setAllergies] = useState("");
  const [recentlyAddedId, setRecentlyAddedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");
  const [submittedOrders, setSubmittedOrders] = useState<TrackedOrder[]>([]);

  const saveAnonymousOrders = useCallback(
    (orders: TrackedOrder[]) => {
      const key = `dine-customer:${params.slug}`;
      let sessionId = "";
      try {
        sessionId =
          JSON.parse(window.localStorage.getItem(key) ?? "{}").sessionId ?? "";
      } catch {
        /* Start a fresh anonymous session. */
      }
      window.localStorage.setItem(
        key,
        JSON.stringify({ sessionId: sessionId || crypto.randomUUID(), orders }),
      );
    },
    [params.slug],
  );

  function addToBasket(item: RestaurantMenu["items"][number]) {
    setBasket((current) =>
      current.some((entry) => entry.itemId === item.id)
        ? current.map((entry) =>
            entry.itemId === item.id
              ? { ...entry, quantity: entry.quantity + 1 }
              : entry,
          )
        : [
            ...current,
            {
              itemId: item.id,
              name: item.name,
              price: item.price,
              quantity: 1,
              note: "",
            },
          ],
    );
    setRecentlyAddedId(item.id);
    window.setTimeout(
      () =>
        setRecentlyAddedId((current) => (current === item.id ? "" : current)),
      800,
    );
  }

  async function submitOrder() {
    if (!detectedTable || basket.length === 0) {
      setOrderMessage(
        "Scan the QR code on your table before placing an order.",
      );
      return;
    }
    setSubmitting(true);
    setOrderMessage("");
    const response = await fetch(`/api/restaurants/${params.slug}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber,
        tableId: detectedTable?.id,
        customerNote: allergies,
        items: basket,
      }),
    });
    const result = await response.json();
    if (!response.ok)
      setOrderMessage(result.error ?? "Could not submit your order.");
    else {
      if (result.checkoutUrl) {
        window.location.assign(String(result.checkoutUrl));
        return;
      }
      setOrderMessage("Could not open secure checkout.");
    }
    setSubmitting(false);
  }

  useEffect(() => {
    fetch(`/api/restaurants/${params.slug}/menu`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? "This restaurant menu could not be found."
              : "Could not load this menu.",
          );
        return response.json() as Promise<
          RestaurantMenu | { redirectSlug: string }
        >;
      })
      .then((result) => {
        if ("redirectSlug" in result)
          router.replace(`/menu/${result.redirectSlug}`);
        else setMenu(result);
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load this menu.",
        ),
      );
  }, [params.slug, router]);

  useEffect(() => {
    const tableId = new URLSearchParams(window.location.search).get("table");
    if (!tableId) return;
    fetch(`/api/restaurants/${params.slug}/tables/${tableId}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return result as { id: string; name: string };
      })
      .then((table) => {
        setDetectedTable(table);
        setTableNumber(table.name);
      })
      .catch((tableError: unknown) =>
        setOrderMessage(
          tableError instanceof Error
            ? tableError.message
            : "This table QR is not valid.",
        ),
      );
  }, [params.slug]);

  useEffect(() => {
    const key = `dine-customer:${params.slug}`;
    try {
      const saved = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      const restored: TrackedOrder[] = Array.isArray(saved.orders)
        ? saved.orders
        : saved.order?.id
          ? [{ ...saved.order, createdAt: new Date().toISOString() }]
          : [];
      const currentOrders = removeExpiredOrders(restored);
      if (currentOrders.length)
        Promise.resolve().then(() => setSubmittedOrders(currentOrders));
      if (!saved.sessionId || !Array.isArray(saved.orders))
        window.localStorage.setItem(
          key,
          JSON.stringify({
            sessionId: saved.sessionId || crypto.randomUUID(),
            orders: currentOrders,
          }),
        );
    } catch {
      window.localStorage.setItem(
        key,
        JSON.stringify({ sessionId: crypto.randomUUID(), orders: [] }),
      );
    }
  }, [params.slug]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const payment = search.get("payment");
    const orderId = search.get("order");
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return;
    if (payment !== "success" && payment !== "cancelled") return;
    const timer = window.setTimeout(() => {
      if (payment === "cancelled") {
        setOrderMessage("Payment was cancelled. Your order was not sent to the kitchen.");
        return;
      }
      setBasket([]);
      setAllergies("");
      setOrderMessage("Payment received. We’re confirming your order with the kitchen.");
      setSubmittedOrders((current) => {
        if (current.some((order) => order.id === orderId)) return current;
        const updated = [
          ...current,
          { id: orderId, status: "pending_payment", createdAt: new Date().toISOString() },
        ];
        saveAnonymousOrders(updated);
        return updated;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [saveAnonymousOrders]);

  const trackedOrderIds = submittedOrders.map((order) => order.id).join(",");
  useEffect(() => {
    if (!trackedOrderIds) return;
    const checkStatus = async () => {
      const results = await Promise.all(
        trackedOrderIds.split(",").map(async (id) => {
          const response = await fetch(`/api/orders/${id}`, {
            cache: "no-store",
          });
          return response.ok ? await response.json() : null;
        }),
      );
      setSubmittedOrders((current) => {
        const updated = current.map((order) => {
          const result = results.find((entry) => entry?.id === order.id);
          if (!result) return order;
          const becameFinished =
            terminalStatuses.has(result.status) &&
            !terminalStatuses.has(order.status);
          return {
            ...order,
            status: result.status,
            ...(becameFinished
              ? { completedAt: new Date().toISOString() }
              : {}),
          };
        });
        const currentOrders = removeExpiredOrders(updated);
        saveAnonymousOrders(currentOrders);
        return currentOrders;
      });
    };
    checkStatus();
    const timer = window.setInterval(checkStatus, 4000);
    return () => window.clearInterval(timer);
  }, [saveAnonymousOrders, trackedOrderIds]);

  const activeOrders = submittedOrders.filter(
    (order) => !["completed", "cancelled"].includes(order.status),
  );
  const previousOrders = submittedOrders.filter((order) =>
    terminalStatuses.has(order.status),
  );
  const canOrder = Boolean(menu?.restaurant.orderingEnabled && detectedTable);
  const basketSubtotal = basket.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const basketServiceCharge =
    basketSubtotal * ((menu?.restaurant.serviceChargePercent ?? 0) / 100);

  const categories = [
    "All",
    ...(menu?.categories.map((item) => item.name) ?? []),
  ];
  const visibleItems = (menu?.items ?? []).filter(
    (item) =>
      item.available && (category === "All" || item.category === category),
  );
  if (error)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] p-6">
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-xl font-bold">Menu unavailable</h1>
          <p className="mt-2 text-zinc-500">{error}</p>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#faf9f6] text-zinc-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {menu?.restaurant.coverImageUrl && (
          <img
            src={menu.restaurant.coverImageUrl}
            alt={`${menu.restaurant.name} cover`}
            className="mb-8 h-64 w-full rounded-3xl object-cover shadow-sm"
          />
        )}
        <header className="mb-8 text-center">
          {menu?.restaurant.logoUrl && (
            <img
              src={menu.restaurant.logoUrl}
              alt={`${menu.restaurant.name} logo`}
              className="mx-auto mb-4 h-24 w-24 rounded-2xl border-4 border-white object-cover shadow-md"
            />
          )}
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-orange-600">
            {menu?.restaurant.cuisine || "Restaurant Menu"}
          </p>
          <h1 className="text-4xl font-bold tracking-tight">
            {menu?.restaurant.name ?? "Loading menu…"}
          </h1>
          {menu && (
            <>
              <p className="mt-3 text-zinc-500">
                {menu.restaurant.description}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {menu.restaurant.location}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm font-medium text-orange-600">
                {menu.restaurant.phone && (
                  <a href={`tel:${menu.restaurant.phone}`}>Call restaurant</a>
                )}
                {menu.restaurant.email && (
                  <a href={`mailto:${menu.restaurant.email}`}>Email</a>
                )}
                {menu.restaurant.website && (
                  <a
                    href={menu.restaurant.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website
                  </a>
                )}
              </div>
            </>
          )}
        </header>
        {detectedTable && (
          <div className="mx-auto mb-8 max-w-md rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
              Table detected
            </p>
            <p className="mt-1 text-2xl font-bold">{detectedTable.name}</p>
            <p className="mt-1 text-sm text-green-800">
              Orders from this menu will be sent to this table automatically.
            </p>
          </div>
        )}
        {menu?.restaurant.orderingEnabled && !detectedTable && (
          <div className="mx-auto mb-8 max-w-md rounded-2xl border border-zinc-200 bg-white p-4 text-center">
            <p className="font-semibold">Menu viewing only</p>
            <p className="mt-1 text-sm text-zinc-500">
              To place an order, scan the QR code located on your restaurant
              table.
            </p>
          </div>
        )}
        {menu && Object.keys(menu.restaurant.openingHours).length > 0 && (
          <details className="mx-auto mb-8 max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-center font-semibold">
              Opening hours
            </summary>
            <div className="mt-4 space-y-2">
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((day) => {
                const hours = menu.restaurant.openingHours[day];
                return (
                  hours && (
                    <div key={day} className="flex justify-between text-sm">
                      <span>{day}</span>
                      <span className="text-zinc-500">
                        {hours.closed
                          ? "Closed"
                          : `${hours.open}–${hours.close}`}
                      </span>
                    </div>
                  )
                );
              })}
            </div>
          </details>
        )}
        <div className="mb-10 flex flex-wrap justify-center gap-3">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${category === item ? "bg-black text-white" : "bg-white text-zinc-700 shadow-sm hover:bg-zinc-100"}`}
            >
              {item}
            </button>
          ))}
        </div>
        {!menu ? (
          <div className="rounded-2xl bg-white p-10 text-center text-zinc-500 shadow-sm">
            Loading menu…
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-zinc-500">
              No menu items available in this category.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {visibleItems.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-56 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center bg-zinc-100 text-sm text-zinc-400">
                    No photo
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-orange-600">
                        {item.category}
                      </p>
                      <h2 className="text-xl font-semibold">{item.name}</h2>
                    </div>
                    <span className="text-lg font-semibold">
                      {menu.restaurant.currency}
                      {item.price.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    {item.description}
                  </p>
                  {canOrder && (
                    <button
                      type="button"
                      onClick={() => addToBasket(item)}
                      className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition duration-150 active:scale-95 ${recentlyAddedId === item.id ? "scale-[0.98] bg-green-600" : "bg-black hover:bg-zinc-800"}`}
                    >
                      {recentlyAddedId === item.id ? "Added ✓" : "Add to order"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {activeOrders.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
                  Live updates
                </p>
                <h2 className="mt-1 text-2xl font-bold">Your active orders</h2>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                {activeOrders.length} active
              </span>
            </div>
            <div className="space-y-4">
              {activeOrders.map((order) => {
                const latest =
                  order.id === submittedOrders[submittedOrders.length - 1]?.id;
                const label =
                  (
                    {
                      pending_payment: "Confirming payment",
                      new: "Sent to kitchen",
                      accepted: "Accepted",
                      preparing: "Being prepared",
                      ready: "Ready at your table soon",
                    } as Record<string, string>
                  )[order.status] ?? order.status;
                const currentIndex = [
                  "pending_payment",
                  "new",
                  "accepted",
                  "preparing",
                  "ready",
                ].indexOf(order.status);
                return (
                  <article
                    key={order.id}
                    className="rounded-3xl border border-green-200 bg-green-50 p-6"
                  >
                    {latest && (
                      <span className="rounded-full bg-green-700 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                        Latest order
                      </span>
                    )}
                    <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-bold">{label}</h3>
                        <p className="mt-1 text-sm text-green-800">
                          Reference: {order.id.slice(0, 8).toUpperCase()} ·{" "}
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className="text-sm font-semibold capitalize text-green-800">
                        {order.status}
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-5 gap-2">
                      {[0, 1, 2, 3, 4].map((index) => (
                        <div
                          key={index}
                          className={`h-2 rounded-full ${currentIndex >= index ? "bg-green-600" : "bg-green-200"}`}
                        />
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-zinc-500">
              Orders are sent separately and may arrive at different times. All
              statuses remain on this device after refreshing.
            </p>
          </section>
        )}
        {previousOrders.length > 0 && (
          <details className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
            <summary className="cursor-pointer font-semibold">
              Previous orders ({previousOrders.length})
            </summary>
            <div className="mt-4 space-y-3">
              {previousOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 p-4"
                >
                  <div>
                    <p className="font-semibold capitalize">{order.status}</p>
                    <p className="text-sm text-zinc-500">
                      {order.id.slice(0, 8).toUpperCase()} ·{" "}
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSubmittedOrders((current) => {
                        const updated = current.filter(
                          (item) => item.id !== order.id,
                        );
                        saveAnonymousOrders(updated);
                        return updated;
                      })
                    }
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
        {canOrder && menu && (
          <section
            id="basket"
            className="mt-10 scroll-mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
                  Your order
                </p>
                <h2 className="mt-1 text-2xl font-bold">Basket</h2>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold">
                {basket.reduce((sum, item) => sum + item.quantity, 0)} items
              </span>
            </div>
            {basket.length === 0 ? (
              <p className="mt-5 text-zinc-500">
                Add dishes from the menu above.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {basket.map((item) => (
                  <div
                    key={item.itemId}
                    className="rounded-2xl border border-zinc-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-zinc-500">
                          {menu.restaurant.currency}
                          {(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setBasket((current) =>
                              current
                                .map((entry) =>
                                  entry.itemId === item.itemId
                                    ? {
                                        ...entry,
                                        quantity: Math.max(
                                          0,
                                          entry.quantity - 1,
                                        ),
                                      }
                                    : entry,
                                )
                                .filter((entry) => entry.quantity > 0),
                            )
                          }
                          className="h-9 w-9 rounded-lg border"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setBasket((current) =>
                              current.map((entry) =>
                                entry.itemId === item.itemId
                                  ? { ...entry, quantity: entry.quantity + 1 }
                                  : entry,
                              ),
                            )
                          }
                          className="h-9 w-9 rounded-lg border"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <input
                      maxLength={300}
                      value={item.note}
                      onChange={(event) =>
                        setBasket((current) =>
                          current.map((entry) =>
                            entry.itemId === item.itemId
                              ? { ...entry, note: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      placeholder="Changes for this dish, e.g. no onions"
                      className="mt-3 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Table number
                <input
                  required
                  maxLength={30}
                  value={tableNumber}
                  readOnly={Boolean(detectedTable)}
                  onChange={(event) => setTableNumber(event.target.value)}
                  placeholder="e.g. 12"
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 read-only:bg-green-50 read-only:font-semibold read-only:text-green-800"
                />
              </label>
              <label className="text-sm font-medium">
                Allergies or dietary requirements{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
                <input
                  maxLength={500}
                  value={allergies}
                  onChange={(event) => setAllergies(event.target.value)}
                  placeholder="e.g. peanut allergy, gluten-free"
                  className="mt-2 w-full rounded-xl border border-amber-300 bg-amber-50/50 px-4 py-3 outline-none focus:border-amber-500"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-500">Subtotal: {menu.restaurant.currency}{basketSubtotal.toFixed(2)}</p>
                <p className="text-sm text-zinc-500">Service charge ({menu.restaurant.serviceChargePercent}%): {menu.restaurant.currency}{basketServiceCharge.toFixed(2)}</p>
                <p className="mt-1 text-xl font-bold">Total: {menu.restaurant.currency}{(basketSubtotal + basketServiceCharge).toFixed(2)}</p>
              </div>
              <button
                type="button"
                disabled={submitting || basket.length === 0}
                onClick={submitOrder}
                className="rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition duration-150 hover:bg-orange-700 active:scale-95 disabled:opacity-50"
              >
                {submitting ? "Opening secure checkout…" : "Pay securely & order"}
              </button>
            </div>
            {activeOrders.length > 0 && basket.length > 0 && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                This will create a separate kitchen order and may arrive
                separately from your earlier order.
              </p>
            )}
            {orderMessage && (
              <p className="mt-4 rounded-xl bg-orange-50 p-4 text-sm text-orange-800">
                {orderMessage}
              </p>
            )}
          </section>
        )}
      </div>
      {canOrder && menu && basket.length > 0 && (
        <button
          type="button"
          onClick={() =>
            document
              .getElementById("basket")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="fixed bottom-4 left-4 right-4 z-30 flex items-center justify-between rounded-2xl bg-black px-5 py-4 font-semibold text-white shadow-2xl active:scale-[0.98] sm:hidden"
        >
          <span>
            View order · {basket.reduce((sum, item) => sum + item.quantity, 0)}{" "}
            items
          </span>
          <span>
            {menu.restaurant.currency}
            {basket
              .reduce((sum, item) => sum + item.price * item.quantity, 0)
              .toFixed(2)}
          </span>
        </button>
      )}
    </main>
  );
}
