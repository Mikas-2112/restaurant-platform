"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QrToolsProps = {
  restaurantId: string;
  restaurantName: string;
  logoUrl?: string;
};

function safeFileName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "restaurant";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export default function QrTools({ restaurantId, restaurantName, logoUrl }: QrToolsProps) {
  const [permanentUrl, setPermanentUrl] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [qrError, setQrError] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/r/${restaurantId}`;
    QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: "H", color: { dark: "#18181b", light: "#ffffff" } })
      .then((image) => {
        setPermanentUrl(url);
        setQrImage(image);
      })
      .catch(() => setQrError("Could not generate the QR code."));
  }, [restaurantId]);

  function downloadQrCode() {
    if (!qrImage) return;
    const link = document.createElement("a");
    link.href = qrImage;
    link.download = `${safeFileName(restaurantName)}-menu-qr.png`;
    link.click();
  }

  function printTableCard(format: "a5" | "7cm" | "9cm" | "10cm" | "a4-sheet" = "a5") {
    if (!qrImage) return;
    const printWindow = window.open("", "_blank", "width=700,height=900");
    if (!printWindow) {
      setQrError("Please allow pop-ups to print the table card.");
      return;
    }
    const safeName = escapeHtml(restaurantName);
    const safeLogo = logoUrl ? escapeHtml(logoUrl) : "";
    const isSheet = format === "a4-sheet";
    const isSquare = format !== "a5" && !isSheet;
    const size = isSquare ? format.replace("cm", "0mm") : "148mm";
    const pageSize = isSheet ? "A4 portrait" : isSquare ? `${size} ${size}` : "A5 portrait";
    const cardCount = isSheet ? 6 : 1;
    const cardMarkup = Array.from({ length: cardCount }, () => `<article class="card">${safeLogo ? `<img class="logo" src="${safeLogo}" alt="">` : ""}<p class="eyebrow">Digital menu</p><h1>${safeName}</h1><p class="prompt">Scan for menu</p><div class="qr-wrap"><img class="qr" src="${qrImage}" alt="QR code"></div></article>`).join("");
    printWindow.document.write(`<!doctype html><html><head><title>${safeName} table card</title><style>
      @page { size: ${pageSize}; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #f4f4f5; font-family: Arial, sans-serif; color: #18181b; }
      .sheet { ${isSheet ? "width: 210mm; min-height: 297mm; padding: 11mm 25mm; display: grid; grid-template-columns: repeat(2, 70mm); grid-auto-rows: 70mm; gap: 7mm 20mm; align-content: center;" : ""} }
      .card { width: ${isSheet ? "70mm" : size}; height: ${isSheet ? "70mm" : isSquare ? size : "210mm"}; margin: 0 auto; padding: ${isSquare || isSheet ? "4mm" : "20mm 16mm"}; background: #fffaf3; border: ${isSheet ? "0.3mm dashed #a1a1aa" : "0"}; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
      .logo { width: 25mm; height: 25mm; border-radius: 6mm; object-fit: cover; margin-bottom: 8mm; }
      .eyebrow { margin: 0 0 4mm; color: #ea580c; font-size: 10pt; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
      h1 { margin: 0; max-width: 110mm; font-size: 27pt; line-height: 1.08; }
      .prompt { margin: 5mm 0 9mm; color: #52525b; font-size: 13pt; }
      .qr-wrap { padding: 6mm; border: 1px solid #e4e4e7; border-radius: 7mm; background: white; box-shadow: 0 3mm 12mm rgba(0,0,0,.06); }
      .qr { display: block; width: 76mm; height: 76mm; }
      ${isSquare || isSheet ? ".logo { width: 9mm; height: 9mm; border-radius: 2mm; margin-bottom: 1.5mm; } .eyebrow { display: none; } h1 { max-width: 58mm; font-size: 10pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .prompt { margin: 1mm 0 1.5mm; font-size: 7.5pt; } .qr-wrap { padding: 1.5mm; border-radius: 2mm; box-shadow: none; } .qr { width: 42mm; height: 42mm; }" : ""}
      @media print { body { background: white; } .card { margin: 0; } }
    </style></head><body><main class="sheet">${cardMarkup}</main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);
    printWindow.document.close();
  }

  return <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-600">QR tools</p>
      <h2 className="mt-2 text-xl font-bold">Your scannable menu</h2>
      <p className="mt-1 text-sm text-zinc-500">Use this code online or print it for tables. It always follows your restaurant&apos;s latest public menu URL.</p>
    </div>
    {qrError && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{qrError}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="rounded-2xl border border-zinc-200 bg-[#fffaf3] p-6 text-center">
        <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-2xl bg-white p-3 shadow-sm">
          {qrImage ? <img src={qrImage} alt={`QR code for ${restaurantName}'s menu`} className="h-full w-full" /> : <span className="text-sm text-zinc-400">Generating QR code…</span>}
        </div>
        <p className="mt-4 font-semibold">{restaurantName}</p>
        <p className="mt-1 text-sm text-zinc-500">Scan to view the menu</p>
      </div>
      <div className="flex flex-col justify-center">
        <p className="text-sm font-semibold text-zinc-900">Permanent QR destination</p>
        <p className="mt-2 break-all rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">{permanentUrl || `/r/${restaurantId}`}</p>
        <p className="mt-3 text-sm leading-6 text-zinc-500">You can rename the public menu URL later without reprinting this code. Keep this permanent destination for all signs, stickers and table cards.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={!qrImage} onClick={downloadQrCode} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Download QR image</button>
          {permanentUrl && <a href={permanentUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">Test QR destination</a>}
        </div>
        <div className="mt-6 border-t border-zinc-200 pt-6">
          <p className="text-sm font-semibold text-zinc-900">Print formats</p>
          <p className="mt-1 text-sm text-zinc-500">Choose a full table card, a compact square, or six 7 cm cards on one A4 cutting sheet.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!qrImage} onClick={() => printTableCard("a5")} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50">A5 card</button>
            <button type="button" disabled={!qrImage} onClick={() => printTableCard("7cm")} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50">7 × 7 cm</button>
            <button type="button" disabled={!qrImage} onClick={() => printTableCard("9cm")} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50">9 × 9 cm</button>
            <button type="button" disabled={!qrImage} onClick={() => printTableCard("10cm")} className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50">10 × 10 cm</button>
            <button type="button" disabled={!qrImage} onClick={() => printTableCard("a4-sheet")} className="rounded-lg bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50">A4 sheet · 6 squares</button>
          </div>
        </div>
      </div>
    </div>
  </section>;
}
