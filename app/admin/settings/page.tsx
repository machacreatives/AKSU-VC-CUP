"use client";

import { useState } from "react";
import { Banner, PageHeader, btnPrimary } from "../ui";
import AccountSection from "../AccountSection";

export default function SettingsPage() {
  const [initialising, setInitialising] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function initDb() {
    setInitialising(true);
    setNotice("");
    setError("");
    const res = await fetch("/api/admin/init-db", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setInitialising(false);
    if (res.ok) {
      const t = body.tables ?? {};
      setNotice(
        `Tables ready — currently holding ${t.departments ?? 0} teams, ${t.players ?? 0} players, ${t.matches ?? 0} matches.`
      );
    } else {
      setError(body.error ?? "Could not update the database.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <PageHeader title="Settings" subtitle="Administrators and database." />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}

      <AccountSection />

      <section className="space-y-2 border-t border-line pt-4">
        <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">Database</h2>
        <p className="text-[13.5px] text-white">
          Creates any missing tables and columns. Safe to re-run — it never touches rows that already
          exist. Run this after updating the app, so new fields are added to your existing data.
        </p>
        <button onClick={initDb} disabled={initialising} className={btnPrimary}>
          {initialising ? "Updating…" : "Update database"}
        </button>
      </section>
    </div>
  );
}
