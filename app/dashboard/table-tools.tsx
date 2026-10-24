"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

type RestaurantTable = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
};
type Props = {
  accessToken: string;
  restaurantId: string;
  restaurantName: string;
};

export default function TableTools({
  accessToken,
  restaurantId,
  restaurantName,
}: Props) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!accessToken) return;
    const response = await fetch("/api/owner/tables", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = await response.json();
    if (response.ok) setTables(result);
    else setError(result.error ?? "Could not load tables.");
  }, [accessToken]);
  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);
  async function createTable(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/owner/tables", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error);
    else {
      setName("");
      setError("");
      load();
    }
  }
  async function updateTable(
    id: string,
    updates: { name?: string; active?: boolean },
  ) {
    const response = await fetch(`/api/owner/tables/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(updates),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error);
    else load();
  }
  async function rename(table: RestaurantTable) {
    const next = window.prompt("New table name", table.name)?.trim();
    if (next && next !== table.name) updateTable(table.id, { name: next });
  }
  async function remove(table: RestaurantTable) {
    if (
      !window.confirm(
        `Delete ${table.name}? Its printed QR code will stop selecting a table.`,
      )
    )
      return;
    const response = await fetch(`/api/owner/tables/${table.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) setError("Could not delete the table.");
    else load();
  }
  async function qrFor(table: RestaurantTable) {
    return QRCode.toDataURL(
      `${window.location.origin}/r/${restaurantId}?table=${table.id}`,
      { width: 720, margin: 2, errorCorrectionLevel: "H" },
    );
  }
  async function download(table: RestaurantTable) {
    const image = await qrFor(table);
    const link = document.createElement("a");
    link.href = image;
    link.download = `${table.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`;
    link.click();
  }
  async function print(table: RestaurantTable) {
    const image = await qrFor(table);
    const popup = window.open("", "_blank", "width=650,height=750");
    if (!popup) {
      setError("Please allow pop-ups to print.");
      return;
    }
    const safeName = table.name.replace(/[&<>'"]/g, "");
    const safeRestaurant = restaurantName.replace(/[&<>'"]/g, "");
    popup.document.write(
      `<!doctype html><html><head><title>${safeName}</title><style>@page{size:90mm 90mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial;color:#18181b}.card{width:90mm;height:90mm;padding:6mm;background:#fffaf3;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}h1{margin:0;font-size:17pt}.restaurant{margin:1mm 0 2mm;color:#71717a;font-size:9pt}.qr{width:55mm;height:55mm}.prompt{margin:2mm 0 0;font-size:9pt;font-weight:700}</style></head><body><main class="card"><h1>${safeName}</h1><p class="restaurant">${safeRestaurant}</p><img class="qr" src="${image}"><p class="prompt">Scan to view the menu and order</p></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),200));<\/script></body></html>`,
    );
    popup.document.close();
  }
  return (
    <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-600">
            Table QR codes
          </p>
          <h2 className="mt-2 text-xl font-bold">Restaurant tables</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Each table gets a permanent QR code that fills and locks its table
            name automatically.
          </p>
        </div>
        <form onSubmit={createTable} className="flex gap-2">
          <input
            required
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Table 12"
            className="min-w-0 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm"
          />
          <button className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white">
            Add table
          </button>
        </form>
      </div>
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {tables.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">
            Add your first table to generate its QR code.
          </p>
        ) : (
          tables.map((table) => (
            <div
              key={table.id}
              className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{table.name}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${table.active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"}`}
                  >
                    {table.active ? "Active" : "Disabled"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Permanent table ID: {table.id.slice(0, 8)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => print(table)}
                  className="rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700"
                >
                  Print card
                </button>
                <button
                  type="button"
                  onClick={() => download(table)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Download QR
                </button>
                <button
                  type="button"
                  onClick={() => rename(table)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateTable(table.id, { active: !table.active })
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  {table.active ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(table)}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
