"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // On a brand-new database there is no account to sign in with yet, so send
  // the first visitor to setup rather than leaving them stuck at a form that
  // can never succeed.
  useEffect(() => {
    fetch("/api/admin/setup")
      .then((r) => r.json())
      .then((b) => {
        if (b.needsSetup) router.replace("/admin/setup");
      })
      .catch(() => {});
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError(body.error ?? "Invalid username or password.");
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-card border border-line bg-surface p-6 shadow-premium lg:max-w-md lg:p-8">
        <h1 className="text-center text-[18px] font-extrabold text-white">Admin Login</h1>
        <div className="space-y-1">
          <label className="text-[12.5px] font-semibold text-white">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-[8px] border border-line bg-surface2 px-3 py-2 text-[14.5px] text-white outline-none focus:border-accent"
            autoComplete="username"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[12.5px] font-semibold text-white">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[8px] border border-line bg-surface2 px-3 py-2 text-[14.5px] text-white outline-none focus:border-accent"
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-[13px] font-medium text-loss">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-[8px] bg-accent py-2.5 text-[14.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
