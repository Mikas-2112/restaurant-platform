"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setStatus("The passwords do not match.");
      return;
    }
    setSaving(true);
    setStatus("");
    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password,
    });
    setSaving(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-6 py-12 text-zinc-900">
      <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl shadow-black/5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
          Restaurant owner
        </p>
        <h1 className="mt-3 text-3xl font-bold">Choose a new password</h1>
        <form onSubmit={save} className="mt-8 space-y-5">
          <label className="block text-sm font-medium">
            New password
            <input
              required
              minLength={6}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
            />
          </label>
          <label className="block text-sm font-medium">
            Confirm password
            <input
              required
              minLength={6}
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
            />
          </label>
          <button
            disabled={saving}
            className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save new password"}
          </button>
        </form>
        {status && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {status}
          </p>
        )}
      </section>
    </main>
  );
}
