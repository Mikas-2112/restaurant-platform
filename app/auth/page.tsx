"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

type Mode = "sign-up" | "sign-in";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    setIsError(false);

    try {
      const supabase = getSupabaseBrowserClient();
      const result =
        mode === "sign-up"
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      if (mode === "sign-in") {
        if (!result.data.session)
          throw new Error(
            "Sign-in succeeded, but no session was created. Please try again.",
          );
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.data.session.access_token,
          refresh_token: result.data.session.refresh_token,
        });
        if (sessionError) throw sessionError;
        const sessionResponse = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: result.data.session.access_token,
          }),
        });
        if (!sessionResponse.ok) {
          const sessionResult = await sessionResponse.json();
          throw new Error(
            sessionResult.error ?? "The owner session could not be saved.",
          );
        }
        window.location.assign("/dashboard");
        return;
      }

      if (result.data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setStatus(
        "Check your email to confirm your account, then return here to sign in.",
      );
    } catch (error) {
      setIsError(true);
      setStatus(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode((current) => (current === "sign-up" ? "sign-in" : "sign-up"));
    setStatus("");
    setIsError(false);
  }

  async function resetPassword() {
    if (!email.trim()) {
      setIsError(true);
      setStatus("Enter your email address first, then press Forgot password.");
      return;
    }
    setSubmitting(true);
    setStatus("");
    setIsError(false);
    const { error } =
      await getSupabaseBrowserClient().auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/reset`,
        },
      );
    setSubmitting(false);
    if (error) {
      setIsError(true);
      setStatus(error.message);
      return;
    }
    setStatus(
      "Password reset email sent. Open the link in that email to choose a new password.",
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-6 py-12 text-zinc-900">
      <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl shadow-black/5">
        <Link href="/" className="text-xl font-bold tracking-tight">
          dine<span className="text-orange-600">.</span>
        </Link>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
          Restaurant owners
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {mode === "sign-up" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-zinc-500">
          {mode === "sign-up"
            ? "Start managing your restaurant menu online."
            : "Sign in to manage your restaurant."}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block text-sm font-medium">
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              required
              minLength={6}
              type="password"
              autoComplete={
                mode === "sign-up" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-black"
            />
          </label>
          {mode === "sign-in" && (
            <button
              type="button"
              disabled={submitting}
              onClick={resetPassword}
              className="text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              Forgot password?
            </button>
          )}
          <button
            disabled={submitting}
            className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? "Please wait…"
              : mode === "sign-up"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        {status && (
          <p
            role="status"
            className={`mt-5 rounded-xl p-3 text-sm ${isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
          >
            {status}
          </p>
        )}

        <button
          type="button"
          onClick={switchMode}
          className="mt-6 text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          {mode === "sign-up"
            ? "Already have an account? Sign in"
            : "Need an account? Create one"}
        </button>
      </section>
    </main>
  );
}
