"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Match, Department } from "@/lib/types";

export default function AdminDashboard() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [mRes, dRes] = await Promise.all([fetch("/api/matches"), fetch("/api/departments")]);
      if (!mRes.ok || !dRes.ok) {
        throw new Error(
          "Could not read from the database. If the tables do not exist yet, run the seed below."
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

  async function seed() {
    setSeeding(true);
    setNotice("");
    setError("");
    const res = await fetch("/api/admin/seed", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setSeeding(false);
    if (res.ok) {
      setNotice(
        `Database ready — ${body.seeded?.departments ?? 0} departments, ${body.seeded?.players ?? 0} players, ${body.seeded?.matches ?? 0} matches.`
      );
      load();
    } else {
      setError(body.error ?? "Seeding failed.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  if (loading) return <div className="px-4 py-6 text-white">Loading...</div>;

  return (
    <div className="space-y-5 px-4 py-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-extrabold text-white">Admin Dashboard</h1>
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

        <div className="space-y-2">
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
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={m.status}
                  onChange={(e) => updateMatch(m, { status: e.target.value as Match["status"] })}
                  className="rounded-[6px] border border-line bg-surface2 px-2 py-1 text-[13px] text-white"
                >
                  <option value="UPCOMING">UPCOMING</option>
                  <option value="LIVE">LIVE</option>
                  <option value="HT">HT</option>
                  <option value="FT">FT</option>
                </select>
                <input
                  type="number"
                  value={m.minute ?? ""}
                  onChange={(e) => updateMatch(m, { minute: Number(e.target.value) })}
                  placeholder="min"
                  className="w-16 rounded-[6px] border border-line bg-surface2 px-2 py-1 text-[13px] text-white"
                />
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

      <section className="space-y-2 border-t border-line pt-4">
        <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">Database</h2>
        <p className="text-[13.5px] text-white">
          Creates the tables if they are missing and loads the demo departments, players and fixtures.
          Safe to re-run: existing rows are updated in place rather than duplicated.
        </p>
        <button
          onClick={seed}
          disabled={seeding}
          className="rounded-[8px] bg-accent px-4 py-2 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {seeding ? "Seeding..." : "Initialise & seed database"}
        </button>
      </section>
    </div>
  );
}
