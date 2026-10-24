"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Checkout = { order: { id: string; table_number: string; subtotal: number; service_charge_amount: number; total: number }; restaurant: { name: string; currency: string } };

export default function DemoCheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState("");

  useEffect(() => {
    fetch(`/api/demo-checkout/${id}`, { cache: "no-store" }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; }).then(setCheckout).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Demo checkout unavailable."));
  }, [id]);

  async function finish(outcome: "success" | "failed" | "cancelled") {
    setSubmitting(outcome); setError("");
    const response = await fetch(`/api/demo-checkout/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Could not complete the demo payment."); setSubmitting(""); return; }
    window.location.assign(result.redirectUrl);
  }

  if (error && !checkout) return <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6"><p className="rounded-2xl bg-white p-8 text-red-700 shadow-sm">{error}</p></main>;
  if (!checkout) return <main className="flex min-h-screen items-center justify-center bg-zinc-100"><p>Preparing demo checkout…</p></main>;
  const currency = checkout.restaurant.currency;
  const serviceChargePercent = Number(checkout.order.subtotal) > 0 ? (Number(checkout.order.service_charge_amount) / Number(checkout.order.subtotal)) * 100 : 0;
  const serviceChargeLabel = Number(serviceChargePercent.toFixed(2));
  return <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6 text-zinc-900"><section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl"><div className="bg-indigo-700 px-6 py-5 text-white"><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">Demonstration only</p><h1 className="mt-2 text-2xl font-bold">Test payment</h1><p className="mt-1 text-sm text-indigo-100">No card is charged and no money moves.</p></div><div className="p-6"><h2 className="text-xl font-bold">{checkout.restaurant.name}</h2><p className="mt-1 text-sm text-zinc-500">Table {checkout.order.table_number} · {checkout.order.id.slice(0, 8).toUpperCase()}</p><div className="mt-6 space-y-3 border-y border-zinc-200 py-5 text-sm"><div className="flex justify-between"><span>Food subtotal</span><span>{currency}{Number(checkout.order.subtotal).toFixed(2)}</span></div><div className="flex justify-between"><span>Service charge ({serviceChargeLabel}%)</span><span>{currency}{Number(checkout.order.service_charge_amount).toFixed(2)}</span></div><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{currency}{Number(checkout.order.total).toFixed(2)}</span></div></div><button disabled={Boolean(submitting)} onClick={() => finish("success")} className="mt-6 w-full rounded-xl bg-indigo-700 px-5 py-3.5 font-semibold text-white disabled:opacity-50">{submitting === "success" ? "Confirming…" : "Simulate successful payment"}</button><div className="mt-3 grid grid-cols-2 gap-3"><button disabled={Boolean(submitting)} onClick={() => finish("failed")} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-50">Payment fails</button><button disabled={Boolean(submitting)} onClick={() => finish("cancelled")} className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold disabled:opacity-50">Customer cancels</button></div>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div></section></main>;
}
