"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Match, Department } from "@/lib/types";
import AccountSection from "./AccountSection";
import MatchClockControls from "./MatchClockControls";

export default function AdminDashboard() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialising, setInitialising] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [mRes, dRes] = await Promise.all([fetch("/api/matches"), fetch("/api/departments")]);
      if (!mRes.ok || !dRes.ok) {
        throw new Error(
          "Could not read from the database. If the tables do not exist yet, create them below."
        );
      }
      setMatches(await mRes.json());
      setDepartments(await dRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function deptName(id: string) {
    return departments.find((d) => d.id === id)?.shortName ?? id;
  }

  async function updateMatch(
    m: Match,
    patch: Partial<Pick<Match, "status" | "minute">> & { homeScore?: number; awayScore?: number }
  ) {
    const updated: Match = {
      ...m,
      status: patch.status ?? m.status,
      minute: patch.minute ?? m.minute,
      home: { ...m.home, score: patch.homeScore ?? m.home.score },
      away: { ...m.away, score: patch.awayScore ?? m.away.score },
    };
    setMatches((prev) => prev.map((x) => (x.id === m.id ? updated : x)));

    const res = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (!res.ok) {
      setError("Save failed — the change was not written to the database.");
      load(); // roll the optimistic edit back to what is actually stored
    }
  }

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
        `Tables ready — currently holding ${t.departments ?? 0} departments, ${t.players ?? 0} players, ${t.matches ?? 0} matches.`
      );
      load();
    } else {
      setError(body.error ?? "Could not create the tables.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  if (loading) return <div className="px-4 py-6 text-white">Loading...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-extrabold text-white lg:text-[22px]">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link href="/" className="rounded-full border border-line px-3 py-1.5 text-[13px] font-bold text-white">
            View site
          </Link>
          <button
            onClick={logout}
            className="rounded-full border border-line px-3 py-1.5 text-[13px] font-bold text-white"
          >
            Log out
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-card border border-loss/40 bg-loss/10 px-3 py-2 text-[13.5px] font-medium text-white">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-card border border-win/40 bg-win/10 px-3 py-2 text-[13.5px] font-medium text-white">
          {notice}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">Matches</h2>

        {matches.length === 0 && !error && (
          <p className="text-[14px] text-white">No matches in the database yet.</p>
        )}

        <div className="grid gap-2 xl:grid-cols-2">
          {matches.map((m) => (
            <div key={m.id} className="rounded-card border border-line bg-surface p-3 shadow-premium">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[14px] font-semibold text-white">
                  {deptName(m.home.departmentId)} vs {deptName(m.away.departmentId)}
                </span>
                <Link href={`/admin/matches/${m.id}`} className="text-[12.5px] font-bold text-accent">
                  Edit lineups &amp; events &rarr;
                </Link>
              </div>
              <MatchClockControls
                match={m}
                onChange={(updated) =>
                  setMatches((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                }
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold text-white">Score</span>
                <input
                  type="number"
                  value={m.home.score}
                  onChange={(e) => updateMatch(m, { homeScore: Number(e.target.value) })}
                  className="w-14 rounded-[6px] border border-line bg-surface2 px-2 py-1 text-center text-[13px] text-white"
                />
                <span className="text-white">-</span>
                <input
                  type="number"
                  value={m.away.score}
                  onChange={(e) => updateMatch(m, { awayScore: Number(e.target.value) })}
                  className="w-14 rounded-[6px] border border-line bg-surface2 px-2 py-1 text-center text-[13px] text-white"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <AccountSection />

      <section className="space-y-2 border-t border-line pt-4">
        <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">Database</h2>
        <p className="text-[13.5px] text-white">
          Creates the tables if they are missing. Safe to re-run — it never touches rows that
          already exist.
        </p>
        <button
          onClick={initDb}
          disabled={initialising}
          className="rounded-[8px] bg-accent px-4 py-2 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {initialising ? "Creating tables..." : "Initialise database"}
        </button>
      </section>
    </div>
  );
}
