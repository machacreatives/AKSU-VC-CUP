"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StatList from "@/components/StatList";
import TabBar from "@/components/TabBar";
import { DataProvider } from "@/lib/data-context";
import { Skeleton, SkeletonPageHeader, SkeletonRows, SkeletonScreen } from "@/components/Skeleton";
import { useDepartments, usePlayers } from "@/lib/api";
import { Player } from "@/lib/types";
import { Banner, EmptyState, PageHeader } from "../ui";

type MetricId = "scorers" | "assists" | "ratings" | "cards";

const metricTabs: { id: MetricId; label: string }[] = [
  { id: "scorers", label: "Top Scorers" },
  { id: "assists", label: "Top Assists" },
  { id: "ratings", label: "Best Rated" },
  { id: "cards", label: "Cards" },
];

export default function AdminStatsPage() {
  const [tab, setTab] = useState<MetricId>("scorers");
  const teamsQuery = useDepartments();
  const playersQuery = usePlayers();

  const departments = teamsQuery.data ?? [];
  const players = useMemo<Player[]>(() => playersQuery.data ?? [], [playersQuery.data]);
  const loading = teamsQuery.isPending || playersQuery.isPending;
  const error = teamsQuery.error?.message || playersQuery.error?.message || "";

  // The same orderings the public tabs use, so what an administrator checks
  // here is exactly what a visitor sees.
  const boards = useMemo(() => {
    const byGoals = [...players].filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals);
    const byAssists = [...players].filter((p) => p.assists > 0).sort((a, b) => b.assists - a.assists);
    const byRating = [...players]
      .filter((p) => (p.rating ?? 0) > 0)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const byCards = [...players]
      .map((p) => ({ ...p, cardScore: p.redCards * 3 + p.yellowCards }))
      .filter((p) => p.cardScore > 0)
      .sort((a, b) => b.cardScore - a.cardScore);
    return { scorers: byGoals, assists: byAssists, ratings: byRating, cards: byCards };
  }, [players]);

  if (loading) {
    return (
      <SkeletonScreen label="Loading player statistics">
        <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
          <SkeletonPageHeader />
          <div className="flex gap-1.5">
            {["w-28", "w-28", "w-24", "w-20"].map((w, i) => (
              <Skeleton key={i} className={`h-8 rounded-full ${w}`} />
            ))}
          </div>
          <SkeletonRows rows={8} />
        </div>
      </SkeletonScreen>
    );
  }

  const active = boards[tab];

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
      <PageHeader
        title="Player stats"
        subtitle="The same leaderboards the public site shows, with every qualifying player rather than the top 12."
      />

      {error && <Banner tone="error">{error}</Banner>}

      <div className="-mx-4 lg:-mx-6">
        <TabBar tabs={metricTabs} active={tab} onChange={setTab} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-white">
        <span>{players.length} players</span>
        <span>{boards.scorers.length} have scored</span>
        <span>{boards.assists.length} have assisted</span>
        <span>{boards.cards.length} have been booked</span>
      </div>

      {players.length === 0 ? (
        <EmptyState
          title="No players yet"
          body="Build the squads first — these leaderboards are counted from them."
          action={
            <Link href="/admin/teams" className="text-[13px] font-bold text-accent">
              Go to Teams &rarr;
            </Link>
          }
        />
      ) : (
        // StatList resolves each player's team through the shared context, the
        // same way the public tabs do.
        <DataProvider departments={departments} players={players} serverNow={Date.now()}>
          {active.length === 0 ? (
            <EmptyState
              title={`Nothing recorded for ${metricTabs.find((t) => t.id === tab)?.label.toLowerCase()} yet`}
              body="Numbers appear here as match events are recorded."
            />
          ) : (
            <StatList
              players={active}
              metric={tab === "scorers" ? "goals" : tab === "ratings" ? "rating" : tab}
              limit={Infinity}
            />
          )}
        </DataProvider>
      )}
    </div>
  );
}
