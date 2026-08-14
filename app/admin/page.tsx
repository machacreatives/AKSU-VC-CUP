"use client";

import { useState } from "react";
import Link from "next/link";
import { Match, Department, MatchStatus } from "@/lib/types";
import DeptBadge from "@/components/DeptBadge";
import { useConfirm } from "@/components/ConfirmDialog";
import { queryKeys, useDepartments, useMatches, useMe } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import MatchClockControls from "./MatchClockControls";
import ScoreControls from "./ScoreControls";
import { Skeleton, SkeletonCard, SkeletonScreen } from "@/components/Skeleton";
import MatchForm from "./MatchForm";
import {
  Banner,
  EmptyState,
  Notice,
  PageHeader,
  btnDanger,
  btnOutline,
  btnPrimary,
  btnSecondary,
  btnSm,
  useNotice,
} from "./ui";

const STATUS_STYLES: Record<MatchStatus, string> = {
  LIVE: "border-win/40 bg-win/15 text-win",
  HT: "border-win/40 bg-win/15 text-win",
  FT: "border-line bg-surface2 text-white",
  UPCOMING: "border-line bg-surface2 text-white",
};

const STATUS_LABELS: Record<MatchStatus, string> = {
  LIVE: "Live",
  HT: "Half time",
  FT: "Full time",
  UPCOMING: "Upcoming",
};

const fallbackTeam = (id: string): Department => ({
  id,
  name: id,
  shortName: id.slice(0, 3).toUpperCase(),
  faculty: "",
  campus: "main",
  group: "A",
  color: "#6B7280",
});

export default function AdminDashboard() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const matchesQuery = useMatches();
  const departmentsQuery = useDepartments();

  const { data: me } = useMe();
  const superadmin = me?.role === "SUPERADMIN";
  const myTeam = me?.departmentId ?? null;

  const allMatches: Match[] = matchesQuery.data ?? [];
  // A team admin sees the fixtures they are playing in and nothing else.
  const matches = superadmin
    ? allMatches
    : allMatches.filter(
        (m) => m.home.departmentId === myTeam || m.away.departmentId === myTeam
      );
  const departments: Department[] = departmentsQuery.data ?? [];
  const loading = matchesQuery.isPending || departmentsQuery.isPending;

  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useNotice();
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const error = localError || matchesQuery.error?.message || departmentsQuery.error?.message || "";
  const setError = setLocalError;

  // Writes elsewhere on the page invalidate rather than hand-patching, so the
  // list cannot drift from what the database actually holds.
  const load = () => queryClient.invalidateQueries({ queryKey: queryKeys.matches });
  const setMatches = (updater: (prev: Match[]) => Match[]) =>
    queryClient.setQueryData<Match[]>(queryKeys.matches, (prev) => updater(prev ?? []));

  function team(id: string) {
    return departments.find((d) => d.id === id) ?? fallbackTeam(id);
  }

  function deptName(id: string) {
    return team(id).shortName;
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
          <p>
            Match stats and the players&apos; goal and card totals are rolled back too. The fixture
            itself is kept.
          </p>
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
    queryClient.invalidateQueries({ queryKey: queryKeys.match(m.id) });
    setNotice("Match reset.");
  }

  async function removeMatch(m: Match) {
    const isLive = m.status === "LIVE" || m.status === "HT";

    const ok = await confirm({
      title: `Delete ${deptName(m.home.departmentId)} vs ${deptName(m.away.departmentId)}?`,
      body: (
        <>
          <p>This removes the fixture entirely and cannot be undone.</p>
          {/* Deleting a match nobody is watching is housekeeping. Deleting one
              that is on air drops it out from under every viewer, so say so. */}
          {isLive && (
            <p className="font-semibold text-gold">
              This match is on air. Anyone watching it will be told it has been removed and sent
              back to the fixture list. If you only want to clear the score and clock, use{" "}
              <strong>Reset</strong> instead.
            </p>
          )}
        </>
      ),
      confirmLabel: isLive ? "Delete live match" : "Delete match",
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
          <div className="grid gap-3 xl:grid-cols-2">
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
      <PageHeader
        title="Matches"
        subtitle={
          superadmin
            ? "Run the clock, record the score and keep every fixture up to date."
            : "Your team's fixtures. Run the clock and record what happens."
        }
        action={
          superadmin &&
          !showNewMatch && (
            <button
              onClick={() => {
                setEditingId(null);
                setShowNewMatch(true);
              }}
              className={btnPrimary}
            >
              + New match
            </button>
          )
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      <Notice>{notice}</Notice>

      {showNewMatch && (
        <MatchForm
          departments={departments}
          onClose={() => setShowNewMatch(false)}
          onSaved={(created) => {
            setMatches((prev) => [...prev, created]);
            setNotice("Match created.");
          }}
        />
      )}

      {matches.length === 0 && !error && !showNewMatch && !superadmin && (
        <EmptyState
          title="No fixtures yet"
          body="Your team has no matches scheduled. Fixtures are created by the tournament organisers."
        />
      )}

      {matches.length === 0 && !error && !showNewMatch && superadmin && (
        <EmptyState
          title="No fixtures yet"
          body="Create the first fixture and it will appear here, on the public site and in the group tables."
          action={
            <button onClick={() => setShowNewMatch(true)} className={btnPrimary}>
              + New match
            </button>
          }
        />
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {matches.map((m) => {
          const home = team(m.home.departmentId);
          const away = team(m.away.departmentId);

          if (editingId === m.id) {
            return (
              <div key={m.id} className="xl:col-span-2">
                <MatchForm
                  departments={departments}
                  match={m}
                  onClose={() => setEditingId(null)}
                  onSaved={(updated) => {
                    setMatches((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                    setNotice("Fixture updated.");
                  }}
                />
              </div>
            );
          }

          return (
            <article
              key={m.id}
              className="flex flex-col gap-3 rounded-card border border-line bg-surface p-3.5 shadow-premium lg:p-4"
            >
              {/* Who, when and where — the identity of the fixture. */}
              <header className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <DeptBadge department={home} size={26} />
                    <span className="truncate text-[15px] font-bold text-white">
                      {home.shortName}
                    </span>
                    <span className="text-[13px] text-white/60">v</span>
                    <DeptBadge department={away} size={26} />
                    <span className="truncate text-[15px] font-bold text-white">
                      {away.shortName}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[12px] text-white/70">
                    {[m.kickoff, m.round, m.venue].filter(Boolean).join(" · ")}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    STATUS_STYLES[m.status]
                  }`}
                >
                  {STATUS_LABELS[m.status]}
                </span>
              </header>

              <div className="rounded-[8px] border border-line bg-surface2/50 p-2.5">
                <MatchClockControls
                  match={m}
                  onChange={(updated) => {
                    setMatches((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                    queryClient.invalidateQueries({ queryKey: queryKeys.match(updated.id) });
                  }}
                />
              </div>

              {superadmin && (
              <div className="rounded-[8px] border border-line bg-surface2/50 p-2.5">
                <ScoreControls
                  match={m}
                  home={home}
                  away={away}
                  onSaved={(updated) => {
                    setMatches((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                    queryClient.invalidateQueries({ queryKey: queryKeys.match(updated.id) });
                  }}
                  onError={(message) => {
                    setError(message);
                    load();
                  }}
                />
              </div>
              )}

              {/* Actions, as buttons. These used to be four differently coloured
                  bits of underlined text competing with the team names. */}
              <footer className="flex flex-wrap gap-2 border-t border-line pt-3">
                <Link href={`/admin/matches/${m.id}`} className={`${btnPrimary} ${btnSm}`}>
                  {superadmin ? "Events & stats" : "Teamsheet, events & stats"}
                </Link>
                {superadmin && (
                  <>
                    <button onClick={() => setEditingId(m.id)} className={`${btnSecondary} ${btnSm}`}>
                      Edit fixture
                    </button>
                    <button
                      onClick={() => resetMatchCompletely(m)}
                      className={`${btnOutline} ${btnSm} ml-auto`}
                    >
                      Reset
                    </button>
                    <button onClick={() => removeMatch(m)} className={`${btnDanger} ${btnSm}`}>
                      Delete
                    </button>
                  </>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
