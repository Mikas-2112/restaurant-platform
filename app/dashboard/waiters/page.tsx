"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import QRCode from "qrcode";

type Waiter = {
  id: string;
  name: string;
  role: string;
  photo_url: string | null;
  active: boolean;
};
type Tip = {
  id: string;
  waiter_id: string;
  amount: number;
  status: string;
  created_at: string;
};
type DashboardData = {
  restaurant: {
    name: string;
    slug: string;
    currency: string;
    tipping_enabled: boolean;
  };
  waiters: Waiter[];
  tips: Tip[];
};

export default function WaitersDashboard() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [form, setForm] = useState({ name: "", role: "Waiter", photoUrl: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [generalQr, setGeneralQr] = useState("");
  const [generalTipUrl, setGeneralTipUrl] = useState("");

  const load = useCallback(
    async (accessToken: string) => {
      const response = await fetch("/api/owner/waiters", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401) {
        router.replace("/auth");
        return;
      }
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not load waiter tipping.");
      setData(result);
    },
    [router],
  );

  useEffect(() => {
    getSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data: sessionData }) => {
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          router.replace("/auth");
          return;
        }
        setToken(accessToken);
        load(accessToken).catch((reason: unknown) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load waiter tipping.",
          ),
        );
      });
  }, [load, router]);

  useEffect(() => {
    if (!data) return;
    const url = `${window.location.origin}/tip/${data.restaurant.slug}`;
    QRCode.toDataURL(url, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#18181b", light: "#ffffff" },
    })
      .then((image) => {
        setGeneralTipUrl(url);
        setGeneralQr(image);
      })
      .catch(() => setError("Could not generate the tipping QR code."));
  }, [data]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const totals = useMemo(() => {
    const result = new Map<string, { amount: number; count: number }>();
    data?.tips
      .filter((tip) => tip.created_at.slice(0, 7) === currentMonth)
      .forEach((tip) => {
        const current = result.get(tip.waiter_id) ?? { amount: 0, count: 0 };
        result.set(tip.waiter_id, {
          amount: current.amount + Number(tip.amount),
          count: current.count + 1,
        });
      });
    return result;
  }, [currentMonth, data]);

  const monthlyHistory = useMemo(() => {
    const waiterNames = new Map(
      data?.waiters.map((waiter) => [waiter.id, waiter.name]) ?? [],
    );
    const months = new Map<
      string,
      Map<
        string,
        { waiterId: string; name: string; amount: number; count: number }
      >
    >();
    data?.tips
      .filter((tip) => tip.created_at.slice(0, 7) !== currentMonth)
      .forEach((tip) => {
        const month = tip.created_at.slice(0, 7);
        const waiters = months.get(month) ?? new Map();
        const current = waiters.get(tip.waiter_id) ?? {
          waiterId: tip.waiter_id,
          name: waiterNames.get(tip.waiter_id) ?? "Former waiter",
          amount: 0,
          count: 0,
        };
        current.amount += Number(tip.amount);
        current.count += 1;
        waiters.set(tip.waiter_id, current);
        months.set(month, waiters);
      });
    return [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, waiters]) => ({
        month,
        waiters: [...waiters.values()].sort((a, b) => b.amount - a.amount),
        total: [...waiters.values()].reduce(
          (sum, waiter) => sum + waiter.amount,
          0,
        ),
      }));
  }, [currentMonth, data]);

  async function toggleTipping() {
    if (!data) return;
    setSaving(true);
    setError("");
    setSuccess("");
    const enabled = !data.restaurant.tipping_enabled;
    const response = await fetch("/api/owner/waiters", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "toggle-tipping", enabled }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Could not update tipping.");
    else {
      setSuccess(
        enabled
          ? "Independent waiter tipping is now live."
          : "Waiter tipping is paused.",
      );
      await load(token);
    }
    setSaving(false);
  }

  async function addWaiter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const response = await fetch("/api/owner/waiters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Could not add waiter.");
    else {
      setForm({ name: "", role: "Waiter", photoUrl: "" });
      setSuccess("Waiter added.");
      await load(token);
    }
    setSaving(false);
  }

  async function setActive(waiter: Waiter) {
    setSaving(true);
    setError("");
    setSuccess("");
    const response = await fetch("/api/owner/waiters", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ waiterId: waiter.id, active: !waiter.active }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Could not update waiter.");
    else {
      setSuccess(
        waiter.active
          ? "Waiter hidden from the public tip page."
          : "Waiter is visible again.",
      );
      await load(token);
    }
    setSaving(false);
  }

  function copyLink(waiterId?: string) {
    if (!data) return;
    const suffix = waiterId ? `?waiter=${waiterId}` : "";
    navigator.clipboard.writeText(
      `${window.location.origin}/tip/${data.restaurant.slug}${suffix}`,
    );
    setSuccess("Tip link copied.");
  }

  function downloadGeneralQr() {
    if (!generalQr || !data) return;
    const link = document.createElement("a");
    link.href = generalQr;
    link.download = `${data.restaurant.slug}-waiter-tipping-qr.png`;
    link.click();
  }

  function printGeneralQr() {
    if (!generalQr || !data) return;
    const printWindow = window.open("", "_blank", "width=700,height=900");
    if (!printWindow) {
      setError("Please allow pop-ups to print the tipping card.");
      return;
    }
    const safeName = data.restaurant.name.replace(
      /[&<>'"]/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[character] ?? character,
    );
    printWindow.document.write(
      `<!doctype html><html><head><title>${safeName} tipping QR</title><style>@page{size:A5 portrait;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#18181b}.card{width:148mm;height:210mm;padding:18mm;background:#fffbeb;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.eyebrow{margin:0 0 5mm;color:#b45309;font-weight:700;letter-spacing:.15em;text-transform:uppercase}h1{margin:0;font-size:28pt}.prompt{margin:5mm 0 9mm;color:#52525b;font-size:14pt}.qr-wrap{padding:6mm;border:1px solid #e4e4e7;border-radius:7mm;background:#fff}.qr{display:block;width:78mm;height:78mm}.note{margin:7mm 0 0;color:#71717a;font-size:10pt}</style></head><body><article class="card"><p class="eyebrow">Thank your waiter</p><h1>${safeName}</h1><p class="prompt">Scan, choose your waiter and leave a tip</p><div class="qr-wrap"><img class="qr" src="${generalQr}" alt="Tipping QR"></div><p class="note">Independent from ordering · Secure payment</p></article><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`,
    );
    printWindow.document.close();
  }

  if (!data)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf9f6]">
        <p>{error || "Loading waiter tipping…"}</p>
      </main>
    );
  const symbol =
    data.restaurant.currency === "GBP"
      ? "£"
      : data.restaurant.currency === "AZN"
        ? "₼"
        : `${data.restaurant.currency} `;

  return (
    <main className="min-h-screen bg-[#faf9f6] px-5 py-8 text-zinc-900">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <a
              href="/dashboard"
              className="text-sm font-semibold text-zinc-500"
            >
              ← Back to menu
            </a>
            <h1 className="mt-2 text-3xl font-bold">Waiter tipping</h1>
            <p className="mt-1 text-zinc-500">
              Runs separately from customer ordering.
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href={`/tip/${data.restaurant.slug}`}
              target="_blank"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold"
            >
              Open public tip page
            </a>
            <button
              type="button"
              onClick={() => copyLink()}
              className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
            >
              Copy tip link
            </button>
          </div>
        </header>

        {error && (
          <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>
        )}
        {success && (
          <p className="mt-6 rounded-xl bg-green-50 p-4 text-green-800">
            {success}
          </p>
        )}

        <section className="mt-7 flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <p className="font-bold">Independent tipping page</p>
            <p className="mt-1 text-sm text-zinc-500">
              Customers can use it even when online ordering is switched off.
            </p>
          </div>
          <button
            disabled={saving}
            onClick={toggleTipping}
            className={`rounded-xl px-5 py-3 font-semibold text-white ${data.restaurant.tipping_enabled ? "bg-green-600" : "bg-zinc-700"}`}
          >
            {data.restaurant.tipping_enabled
              ? "Enabled — click to pause"
              : "Disabled — click to enable"}
          </button>
        </section>

        <section className="mt-7 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="grid items-center gap-7 md:grid-cols-[260px_1fr]">
            <div className="rounded-2xl bg-amber-50 p-5 text-center">
              <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl bg-white p-3 shadow-sm">
                {generalQr ? (
                  <img
                    src={generalQr}
                    alt="General waiter tipping QR code"
                    className="h-full w-full"
                  />
                ) : (
                  <span className="text-sm text-zinc-400">Generating QR…</span>
                )}
              </div>
              <p className="mt-3 font-bold">Scan to tip a waiter</p>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700">
                Main tipping QR
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                One QR for the whole restaurant
              </h2>
              <p className="mt-2 max-w-2xl text-zinc-600">
                Put this on tables, receipts or near the exit. Customers scan
                it, see every active waiter and select the person who served
                them.
              </p>
              <p className="mt-4 break-all rounded-xl bg-zinc-50 p-3 text-sm text-zinc-500">
                {generalTipUrl || `/tip/${data.restaurant.slug}`}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!generalQr}
                  onClick={downloadGeneralQr}
                  className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Download QR image
                </button>
                <button
                  type="button"
                  disabled={!generalQr}
                  onClick={printGeneralQr}
                  className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  Print A5 tipping card
                </button>
                <a
                  href={`/tip/${data.restaurant.slug}`}
                  target="_blank"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800"
                >
                  Test customer page
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-7 grid gap-7 lg:grid-cols-[340px_1fr]">
          <form
            onSubmit={addWaiter}
            className="h-fit rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-bold">Add a waiter</h2>
            <label className="mt-5 block text-sm font-semibold">
              Name
              <input
                required
                maxLength={80}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Role
              <input
                required
                maxLength={80}
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Photo URL{" "}
              <span className="font-normal text-zinc-400">(optional)</span>
              <input
                type="url"
                value={form.photoUrl}
                onChange={(event) =>
                  setForm({ ...form, photoUrl: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3"
              />
            </label>
            <button
              disabled={saving}
              className="mt-5 w-full rounded-xl bg-amber-600 px-5 py-3 font-bold text-white disabled:opacity-50"
            >
              Add waiter
            </button>
          </form>

          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold">Your team</h2>
                <p className="text-sm text-zinc-500">
                  Current-month balances reset automatically on the first day of
                  every month.
                </p>
              </div>
              <p className="text-sm font-semibold">
                {data.waiters.filter((waiter) => waiter.active).length} active
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.waiters.map((waiter) => {
                const total = totals.get(waiter.id) ?? { amount: 0, count: 0 };
                return (
                  <article
                    key={waiter.id}
                    className={`rounded-3xl border bg-white p-5 shadow-sm ${waiter.active ? "border-zinc-200" : "border-zinc-200 opacity-60"}`}
                  >
                    <div className="flex items-center gap-4">
                      {waiter.photo_url ? (
                        <img
                          src={waiter.photo_url}
                          alt={waiter.name}
                          className="h-16 w-16 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl font-bold text-amber-800">
                          {waiter.name.charAt(0)}
                        </span>
                      )}
                      <div>
                        <h3 className="text-lg font-bold">{waiter.name}</h3>
                        <p className="text-sm text-zinc-500">{waiter.role}</p>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <p className="text-xs text-zinc-500">Tips this month</p>
                        <p className="mt-1 text-lg font-bold">
                          {symbol}
                          {total.amount.toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-zinc-50 p-3">
                        <p className="text-xs text-zinc-500">This month</p>
                        <p className="mt-1 text-lg font-bold">{total.count}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => copyLink(waiter.id)}
                        className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold"
                      >
                        Copy personal link
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setActive(waiter)}
                        className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold"
                      >
                        {waiter.active ? "Hide" : "Restore"}
                      </button>
                    </div>
                  </article>
                );
              })}
              {data.waiters.length === 0 && (
                <p className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500 sm:col-span-2">
                  Add the first waiter to create the public tipping page.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="mt-7 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700">
              Payment records
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Previous months by waiter
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Balances reset automatically each month, but every recorded tip
              remains here so the owner knows what each waiter earned.
            </p>
          </div>
          <div className="mt-6 space-y-5">
            {monthlyHistory.map((record) => (
              <article
                key={record.month}
                className="overflow-hidden rounded-2xl border border-zinc-200"
              >
                <div className="flex items-center justify-between bg-zinc-50 px-4 py-3">
                  <h3 className="font-bold">
                    {new Date(
                      `${record.month}-01T12:00:00Z`,
                    ).toLocaleDateString([], {
                      month: "long",
                      year: "numeric",
                    })}
                  </h3>
                  <p className="font-bold">
                    Month total: {symbol}
                    {record.total.toFixed(2)}
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_90px_130px] px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
                  <span>Waiter</span>
                  <span className="text-right">Tips</span>
                  <span className="text-right">Earned</span>
                </div>
                {record.waiters.map((waiter) => (
                  <div
                    key={waiter.waiterId}
                    className="grid grid-cols-[1fr_90px_130px] border-t border-zinc-100 px-4 py-4"
                  >
                    <span className="font-semibold">{waiter.name}</span>
                    <span className="text-right text-zinc-500">
                      {waiter.count}
                    </span>
                    <span className="text-right font-bold">
                      {symbol}
                      {waiter.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </article>
            ))}
            {!monthlyHistory.length && (
              <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
                Previous-month records will appear here automatically on the
                first day of the next month.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
