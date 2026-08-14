"use client";

import { useState } from "react";
import Link from "next/link";
import { Match, Department } from "@/lib/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { queryKeys, useDepartments, useMatches } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import MatchClockControls from "./MatchClockControls";
import { Skeleton, SkeletonCard, SkeletonScreen } from "@/components/Skeleton";
import NewMatchForm from "./NewMatchForm";

export default function AdminDashboard() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const matchesQuery = useMatches();
  const departmentsQuery = useDepartments();

  const matches: Match[] = matchesQuery.data ?? [];
  const departments: Department[] = departmentsQuery.data ?? [];
  const loading = matchesQuery.isPending || departmentsQuery.isPending;

  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useState("");
  const [showNewMatch, setShowNewMatch] = useState(false);
  const error = localError || matchesQuery.error?.message || departmentsQuery.error?.message || "";
  const setError = setLocalError;

  // Writes elsewhere on the page invalidate rather than hand-patching, so the
  // list cannot drift from what the database actually holds.
  const load = () => queryClient.invalidateQueries({ queryKey: queryKeys.matches });
  const setMatches = (updater: (prev: Match[]) => Match[]) =>
    queryClient.setQueryData<Match[]>(queryKeys.matches, (prev) => updater(prev ?? []));

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

  async function resetMatchCompletely(m: Match) {
    // The dialog runs the request itself so the button can show progress and
    // the modal stays put until the write actually lands.
    let updated: Match | null = null;

    const ok = await confirm({
      title: `Reset ${deptName(m.home.departmentId)} vs ${deptName(m.away.departmentId)}?`,
      body: (
        <>
          <p>The score returns to 0-0, the clock is cleared and every recorded event is removed.</p>
          <p>The players&apos; goal and card totals are rolled back too. The fixture itself is kept.</p>
        </>
      ),
      confirmLabel: "Reset match",
      busyLabel: "Resetting…",
      tone: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/matches/${m.id}/reset`, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.match) throw new Error(body.error ?? "Could not reset the match.");
        updated = body.match;
      },
    });
    if (!ok || !updated) return;

    const next = updated as Match;
    setMatches((prev) => prev.map((x) => (x.id === m.id ? next : x)));
    setNotice("Match reset.");
  }

  async function removeMatch(m: Match) {
    const ok = await confirm({
      title: `Delete ${deptName(m.home.departmentId)} vs ${deptName(m.away.departmentId)}?`,
      body: <p>This removes the fixture entirely and cannot be undone.</p>,
      confirmLabel: "Delete match",
      busyLabel: "Deleting…",
      tone: "danger",
      onConfirm: async () => {
        const res = await fetch("/api/admin/matches", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: m.id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not delete the match.");
      },
    });
    if (!ok) return;

    setMatches((prev) => prev.filter((x) => x.id !== m.id));
    setNotice("Match deleted.");
  }



  if (loading) {
    return (
      <SkeletonScreen label="Loading matches">
        <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-28 rounded-[8px]" />
          </div>
          <div className="grid gap-2 xl:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </SkeletonScreen>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <h1 className="text-[18px] font-extrabold text-white lg:text-[22px]">Matches</h1>

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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">Matches</h2>
          {!showNewMatch && (
            <button
              onClick={() => setShowNewMatch(true)}
              className="rounded-[8px] bg-accent px-4 py-2 text-[13.5px] font-bold text-white"
            >
              + New match
            </button>
          )}
        </div>

        {showNewMatch && (
          <NewMatchForm
            departments={departments}
            onClose={() => setShowNewMatch(false)}
            onCreated={(created) => {
              setMatches((prev) => [...prev, created]);
              setNotice("Match created.");
            }}
          />
        )}

        {matches.length === 0 && !error && (
          <p className="text-[14px] text-white">
            No matches yet — use <span className="font-bold">+ New match</span> to add the first fixture.
          </p>
        )}

        <div className="grid gap-2 xl:grid-cols-2">
          {matches.map((m) => (
            <div key={m.id} className="rounded-card border border-line bg-surface p-3 shadow-premium">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[14px] font-semibold text-white">
                  {deptName(m.home.departmentId)} vs {deptName(m.away.departmentId)}
                </span>
                <div className="flex items-center gap-3">
                  <Link href={`/admin/matches/${m.id}`} className="text-[12.5px] font-bold text-accent">
                    Edit lineups &amp; events &rarr;
                  </Link>
                  <button
                    onClick={() => resetMatchCompletely(m)}
                    className="text-[12px] font-bold text-white underline decoration-line underline-offset-2"
                  >
                    Reset match
                  </button>
                  <button onClick={() => removeMatch(m)} className="text-[12px] font-bold text-loss">
                    Delete
                  </button>
                </div>
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

    </div>
  );
}
