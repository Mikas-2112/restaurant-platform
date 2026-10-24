"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
type Detail = {
  tip: { amount: number; customer_message: string };
  waiter: { name: string; role: string };
  restaurant: { name: string };
};
export default function DemoTipCheckout() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/demo-tip-checkout/${id}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return result;
      })
      .then(setData)
      .catch((reason) => setError(reason.message));
  }, [id]);
  async function finish(outcome: string) {
    setBusy(true);
    const response = await fetch(`/api/demo-tip-checkout/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    window.location.assign(result.redirectUrl);
  }
  if (!data)
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100">
        {error || "Loading…"}
      </main>
    );
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
      <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="bg-amber-600 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-100">
            Demo payment
          </p>
          <h1 className="mt-2 text-2xl font-bold">Tip {data.waiter.name}</h1>
          <p className="mt-1 text-amber-100">No real money moves.</p>
        </div>
        <div className="p-6">
          <p className="text-sm text-zinc-500">
            {data.restaurant.name} · {data.waiter.role}
          </p>
          <p className="mt-5 text-4xl font-bold">
            £{Number(data.tip.amount).toFixed(2)}
          </p>
          {data.tip.customer_message && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">
              “{data.tip.customer_message}”
            </p>
          )}
          <button
            disabled={busy}
            onClick={() => finish("success")}
            className="mt-6 w-full rounded-xl bg-amber-600 py-3.5 font-bold text-white"
          >
            Simulate successful tip
          </button>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              disabled={busy}
              onClick={() => finish("failed")}
              className="rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-700"
            >
              Payment fails
            </button>
            <button
              disabled={busy}
              onClick={() => finish("cancelled")}
              className="rounded-xl border border-zinc-200 py-3 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        </div>
      </section>
    </main>
  );
}
