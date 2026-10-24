"use client";
import { useState } from "react";
export type TipPageData = {
  restaurant: { name: string; currency: string; logo_url?: string };
  waiters: { id: string; name: string; role: string; photo_url?: string }[];
};
export default function TipClient({
  data,
  slug,
  selectedWaiter = "",
  result = "",
}: {
  data: TipPageData;
  slug: string;
  selectedWaiter?: string;
  result?: string;
}) {
  const [waiterId, setWaiterId] = useState(selectedWaiter);
  const [amount, setAmount] = useState("5");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function payTip() {
    if (!waiterId) {
      setError("Choose the waiter you want to thank.");
      return;
    }
    setSubmitting(true);
    setError("");
    const response = await fetch(`/api/restaurants/${slug}/tips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId, amount, message }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    window.location.assign(result.checkoutUrl);
  }
  return (
    <main className="min-h-screen bg-amber-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          {data.restaurant.logo_url && (
            <img
              src={data.restaurant.logo_url}
              alt="Restaurant logo"
              className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover"
            />
          )}
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-700">
            Say thank you
          </p>
          <h1 className="mt-2 text-4xl font-bold">Tip your waiter</h1>
          <p className="mt-3 text-zinc-600">
            Your tip is independent from ordering and goes to the waiter
            selected at {data.restaurant.name}.
          </p>
        </header>
        {result === "success" && (
          <p className="mx-auto mt-6 max-w-md rounded-2xl bg-green-100 p-4 text-center font-semibold text-green-800">
            Thank you—your tip was recorded successfully.
          </p>
        )}
        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">1. Choose your waiter</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {data.waiters.map((waiter) => (
              <button
                key={waiter.id}
                type="button"
                onClick={() => setWaiterId(waiter.id)}
                className={`flex items-center gap-4 rounded-2xl border p-4 text-left ${waiterId === waiter.id ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200" : "border-zinc-200"}`}
              >
                {waiter.photo_url ? (
                  <img
                    src={waiter.photo_url}
                    alt={waiter.name}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-xl font-bold">
                    {waiter.name.charAt(0)}
                  </span>
                )}
                <span>
                  <strong className="block">{waiter.name}</strong>
                  <span className="text-sm text-zinc-500">{waiter.role}</span>
                </span>
              </button>
            ))}
          </div>
          <h2 className="mt-8 text-xl font-bold">2. Choose a tip</h2>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[3, 5, 10, 20].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value))}
                className={`rounded-xl py-3 font-bold ${amount === String(value) ? "bg-amber-600 text-white" : "bg-zinc-100"}`}
              >
                £{value}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm font-semibold">
            Custom amount
            <input
              type="number"
              min="0.5"
              max="1000"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Message{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
            <textarea
              maxLength={300}
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Thank your waiter…"
              className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3"
            />
          </label>
          <button
            type="button"
            disabled={submitting}
            onClick={payTip}
            className="mt-6 w-full rounded-xl bg-amber-600 px-5 py-4 font-bold text-white disabled:opacity-50"
          >
            {submitting
              ? "Opening payment…"
              : `Tip £${Number(amount || 0).toFixed(2)}`}
          </button>
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
