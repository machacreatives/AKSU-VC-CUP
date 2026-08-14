"use client";

import { useState } from "react";
import Link from "next/link";
import DeptBadge from "@/components/DeptBadge";
import { Skeleton, SkeletonPageHeader, SkeletonScreen } from "@/components/Skeleton";
import { useDepartments, useMatches } from "@/lib/api";
import { computeStandings, sortStandings } from "@/lib/standings";
import {
  CAMPUSES,
  Department,
  KNOCKOUT_STAGES,
  Match,
  MatchStage,
  STAGE_LABELS,
} from "@/lib/types";
import { Banner, EmptyState, Notice, PageHeader, RequireSuperadmin, btnOutline, btnPrimary, btnSm, useNotice } from "../ui";
import MatchForm from "../MatchForm";

const STATUS_STYLES: Record<string, string> = {
  LIVE: "border-win/40 bg-win/15 text-win",
  HT: "border-win/40 bg-win/15 text-win",
  FT: "border-line bg-surface2 text-white",
  UPCOMING: "border-line bg-surface2 text-white",
};

/**
 * The bracket, from the admin side.
 *
 * Ties are created by hand rather than generated: the tournament decides its
 * own seeding, and a fixture list that invents Quarter-Final 3 from group
 * positions would be wrong the first time two teams finish level. What this
 * does give is the group winners alongside, so whoever is drawing the bracket
 * can see who qualified without leaving the page.
 */
function AdminKnockoutPage() {
  const matchesQuery = useMatches();
  const teamsQuery = useDepartments();

  const matches: Match[] = matchesQuery.data ?? [];
  const departments: Department[] = teamsQuery.data ?? [];
  const loading = matchesQuery.isPending || teamsQuery.isPending;
  const error = matchesQuery.error?.message || teamsQuery.error?.message || "";

  const [notice, setNotice] = useNotice();
  const [creating, setCreating] = useState<MatchStage | null>(null);

  const team = (id: string) =>
    departments.find((d) => d.id === id) ?? {
      id,
      name: id,
      shortName: id.slice(0, 3).toUpperCase(),
      faculty: "",
      campus: "main" as const,
      group: "",
      color: "#6B7280",
    };

  const knockout = matches.filter((m) => m.stage && m.stage !== "GROUP");

  // Who is top of each group so far — the practical input to drawing a bracket.
  const standings = sortStandings(computeStandings(matches, departments));
  const leaders = departments.length
    ? Array.from(new Set(departments.map((d) => d.group).filter(Boolean)))
        .map((groupId) => {
          const rows = standings.filter(
            (r) => departments.find((d) => d.id === r.departmentId)?.group === groupId
          );
          return { groupId, top: rows[0] };
        })
        .filter((g) => g.top)
    : [];

  if (loading) {
    return (
      <SkeletonScreen label="Loading knockout">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
          <SkeletonPageHeader />
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-card" />
            ))}
          </div>
        </div>
      </SkeletonScreen>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <PageHeader
        title="Knockout"
        subtitle="Ties from the round of 16 to the final. These sit outside the group tables."
        action={
          !creating && (
            <button onClick={() => setCreating("QF")} className={btnPrimary}>
              + New tie
            </button>
          )
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      <Notice>{notice}</Notice>

      {creating && (
        <MatchForm
          departments={departments}
          onClose={() => setCreating(null)}
          onSaved={(created) =>
            setNotice(`${STAGE_LABELS[created.stage ?? "QF"]} tie created.`)
          }
        />
      )}

      {leaders.length > 0 && (
        <div className="rounded-card border border-line bg-surface p-3">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/70">
            Currently topping each group
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {leaders.map(({ groupId, top }) => {
              const t = team(top!.departmentId);
              return (
                <span key={groupId} className="flex items-center gap-1.5 text-[13px] text-white">
                  <span className="font-bold text-accent">{groupId}</span>
                  <DeptBadge department={t} size={18} />
                  {t.shortName}
                  <span className="text-white/60">{top!.points} pts</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {knockout.length === 0 && !creating ? (
        <EmptyState
          title="No knockout ties yet"
          body="Create the ties once the group stage has decided who goes through. They appear in the public Knockout tab as you add them."
          action={
            <button onClick={() => setCreating("QF")} className={btnPrimary}>
              + New tie
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          {KNOCKOUT_STAGES.map((stage) => {
            const ties = knockout.filter((m) => m.stage === stage);
            if (ties.length === 0) return null;

            return (
              <section key={stage} className="space-y-2">
                <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-accent">
                  {STAGE_LABELS[stage]}
                </h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {ties.map((m) => {
                    const home = team(m.home.departmentId);
                    const away = team(m.away.departmentId);
                    return (
                      <article
                        key={m.id}
                        className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5 shadow-premium"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <DeptBadge department={home} size={24} />
                          <span className="text-[14.5px] font-bold text-white">
                            {home.shortName}
                          </span>
                          <span className="tabular text-[15px] font-extrabold text-white">
                            {m.status === "UPCOMING"
                              ? "v"
                              : `${m.home.score} - ${m.away.score}`}
                          </span>
                          <span className="text-[14.5px] font-bold text-white">
                            {away.shortName}
                          </span>
                          <DeptBadge department={away} size={24} />
                          <span
                            className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                              STATUS_STYLES[m.status] ?? STATUS_STYLES.UPCOMING
                            }`}
                          >
                            {m.status}
                          </span>
                        </div>
                        <p className="text-[12px] text-white/70">
                          {[m.kickoff, m.venue].filter(Boolean).join(" · ")}
                        </p>
                        <div className="flex flex-wrap gap-2 border-t border-line pt-2.5">
                          <Link href={`/admin/matches/${m.id}`} className={`${btnPrimary} ${btnSm}`}>
                            Events &amp; stats
                          </Link>
                          <Link href="/admin" className={`${btnOutline} ${btnSm}`}>
                            Clock &amp; score
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Banner tone="info">
        Knockout results never reach a group table — only group-stage fixtures are counted there.
        Everything else about a tie works the same: teamsheets, clock, events and stats all live on
        its match page.
      </Banner>
    </div>
  );
}

// Fixtures, groups, tables and the team list belong to whoever runs the
// tournament. A team admin who reaches this URL gets an explanation.
export default function Guarded() {
  return (
    <RequireSuperadmin>
      <AdminKnockoutPage />
    </RequireSuperadmin>
  );
}
