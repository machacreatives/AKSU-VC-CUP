"use client";

import { useMemo } from "react";
import Link from "next/link";
import StandingsTable from "@/components/StandingsTable";
import { DataProvider } from "@/lib/data-context";
import { Skeleton, SkeletonPageHeader, SkeletonScreen } from "@/components/Skeleton";
import { useDepartments, useGroups, useMatches } from "@/lib/api";
import { computeStandings, sortStandings } from "@/lib/standings";
import {
  CAMPUSES,
  CAMPUS_LABELS,
  Department,
  Group,
  Match,
  groupsForCampus,
} from "@/lib/types";
import { Banner, EmptyState, PageHeader } from "../ui";

/**
 * The group tables, exactly as the public site computes them.
 *
 * Nothing here is editable, and that is the point: points are three for a win
 * and one for a draw, counted from finished fixtures. If a table looks wrong
 * the fix is the result that produced it, so every row links back to the
 * matches it came from.
 */
export default function AdminStandingsPage() {
  const matchesQuery = useMatches();
  const teamsQuery = useDepartments();
  const groupsQuery = useGroups();

  const matches = useMemo<Match[]>(() => matchesQuery.data ?? [], [matchesQuery.data]);
  const departments = useMemo<Department[]>(() => teamsQuery.data ?? [], [teamsQuery.data]);
  const groups = useMemo<Group[]>(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const loading = matchesQuery.isPending || teamsQuery.isPending || groupsQuery.isPending;
  const error = matchesQuery.error?.message || teamsQuery.error?.message || "";

  const standings = useMemo(
    () => computeStandings(matches, departments),
    [matches, departments]
  );

  const played = matches.filter((m) => m.status === "FT").length;
  const live = matches.filter((m) => m.status === "LIVE" || m.status === "HT").length;

  if (loading) {
    return (
      <SkeletonScreen label="Loading tables">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
          <SkeletonPageHeader />
          <div className="grid gap-5 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 w-full rounded-card" />
            ))}
          </div>
        </div>
      </SkeletonScreen>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <PageHeader
        title="Tables"
        subtitle="Counted from every finished fixture — three points for a win, one for a draw."
      />

      {error && <Banner tone="error">{error}</Banner>}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-white">
        <span>{played} match{played === 1 ? "" : "es"} counted</span>
        {live > 0 && (
          <span className="font-semibold text-win">
            {live} in progress — counted once they finish
          </span>
        )}
        <span>{departments.length} teams</span>
      </div>

      {departments.length === 0 ? (
        <EmptyState
          title="No teams yet"
          body="Add teams and record results — the tables build themselves from there."
          action={
            <Link href="/admin/teams" className="text-[13px] font-bold text-accent">
              Go to Teams &rarr;
            </Link>
          }
        />
      ) : (
        <DataProvider departments={departments} players={[]} serverNow={0}>
          <div className="space-y-6">
            {CAMPUSES.map((campus) => (
              <section key={campus} className="min-w-0 space-y-3">
                <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-accent">
                  {CAMPUS_LABELS[campus]}
                </h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {groupsForCampus(groups, campus).map((group) => {
                    // Filter on campus as well as group: a team sitting in a
                    // group that belongs to the other campus would otherwise
                    // appear under both headings.
                    const rows = sortStandings(
                      standings.filter((row) => {
                        const team = departments.find((d) => d.id === row.departmentId);
                        return team?.group === group.id && team?.campus === campus;
                      })
                    );

                    return (
                      <div key={group.id} className="min-w-0 space-y-1">
                        {rows.length === 0 ? (
                          <div className="rounded-card border border-line bg-surface px-3 py-6 text-center">
                            <p className="text-[13px] font-bold uppercase tracking-wide text-accent">
                              Group {group.name}
                            </p>
                            <p className="mt-1 text-[13px] text-white/70">No teams assigned.</p>
                          </div>
                        ) : (
                          <StandingsTable rows={rows} title={`Group ${group.name}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </DataProvider>
      )}

      <Banner tone="info">
        These are read-only. To change a table, change the result that feeds it — edit the score on{" "}
        <Link href="/admin" className="font-bold text-accent">
          Matches
        </Link>{" "}
        and end the match, or move a team between groups under{" "}
        <Link href="/admin/table" className="font-bold text-accent">
          Groups
        </Link>
        .
      </Banner>
    </div>
  );
}
