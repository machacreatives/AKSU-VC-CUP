"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/setup")
      .then((r) => r.json())
      .then((b) => setNeedsSetup(!!b.needsSetup))
      .catch(() => setNeedsSetup(false))
      .finally(() => setChecking(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, displayName }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError(body.error ?? "Could not create the account.");
    }
  }

  if (checking) return <div className="px-4 py-6 text-white">Checking…</div>;

  if (!needsSetup) {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-10 text-center">
        <h1 className="text-[18px] font-extrabold text-white">Setup already complete</h1>
        <p className="text-[14px] text-white">
          An administrator account already exists, so this page is closed.
        </p>
        <Link href="/admin/login" className="inline-block font-bold text-accent">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-card border border-line bg-surface p-6 shadow-premium lg:max-w-md lg:p-8"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-[18px] font-extrabold text-white">Create administrator</h1>
          <p className="text-[13px] text-white">
            This is the first account. Setup closes once it exists.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-[12.5px] font-semibold text-white">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-[8px] border border-line bg-surface2 px-3 py-2 text-[14.5px] text-white outline-none focus:border-accent"
            autoComplete="username"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-[12.5px] font-semibold text-white">Display name (optional)</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-[8px] border border-line bg-surface2 px-3 py-2 text-[14.5px] text-white outline-none focus:border-accent"
            autoComplete="name"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[12.5px] font-semibold text-white">
            Password (min {MIN_PASSWORD_LENGTH} characters)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[8px] border border-line bg-surface2 px-3 py-2 text-[14.5px] text-white outline-none focus:border-accent"
            autoComplete="new-password"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-[12.5px] font-semibold text-white">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-[8px] border border-line bg-surface2 px-3 py-2 text-[14.5px] text-white outline-none focus:border-accent"
            autoComplete="new-password"
            required
          />
        </div>

        {error && <p className="text-[13px] font-medium text-loss">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-[8px] bg-accent py-2.5 text-[14.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
