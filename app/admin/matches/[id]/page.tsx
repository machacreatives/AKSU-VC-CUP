"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Department, MatchEvent, MatchEventType } from "@/lib/types";
import DeptBadge from "@/components/DeptBadge";
import { useConfirm } from "@/components/ConfirmDialog";
import { Skeleton, SkeletonRows, SkeletonScreen } from "@/components/Skeleton";
import { queryKeys, useDepartments, useMatch } from "@/lib/api";
import MatchStatsControls from "./MatchStatsControls";
import LineupEditor from "./LineupEditor";
import ManOfTheMatch from "./ManOfTheMatch";
import EventForm from "./EventForm";
import ScoreControls from "../../ScoreControls";
import { Banner, Notice, btnDanger, btnSm, useNotice } from "../../ui";
import { useQueryClient } from "@tanstack/react-query";

const EVENT_STYLES: Record<MatchEventType, { label: string; className: string }> = {
  GOAL: { label: "Goal", className: "border-win/40 bg-win/15 text-win" },
  YELLOW: { label: "Yellow", className: "border-gold/40 bg-gold/15 text-gold" },
  RED: { label: "Red", className: "border-loss/40 bg-loss/15 text-loss" },
  SUB: { label: "Sub", className: "border-line bg-surface2 text-white" },
};

const fallbackTeam = (id: string, label: string): Department => ({
  id,
  name: label,
  shortName: label.slice(0, 3).toUpperCase(),
  faculty: "",
  campus: "main",
  group: "A",
  color: "#6B7280",
});

export default function AdminMatchPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const matchQuery = useMatch(params.id);
  const departmentsQuery = useDepartments();

  const match = matchQuery.data ?? null;
  const departments: Department[] = departmentsQuery.data ?? [];

  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useNotice();

  const error = localError || matchQuery.error?.message || departmentsQuery.error?.message || "";

  // An event touches more than this match.
  //
  // The scoreline moves, so the fixture list is stale — and the goal, assist or
  // card lands on the player's totals, so every leaderboard is stale too. That
  // last one was missing: the Stats tab kept showing the old numbers until its
  // five-minute cache expired, which read as goals not being recorded at all.
  const load = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.match(params.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.matches }),
      queryClient.invalidateQueries({ queryKey: queryKeys.players }),
    ]);
  };

  async function removeEvent(event: MatchEvent) {
    const ok = await confirm({
      title: `Remove this ${EVENT_STYLES[event.type].label.toLowerCase()}?`,
      body: (
        <p>
          {event.minute}&apos; {event.playerName}. Anything it added — the scoreline, the player&apos;s
          totals, the team&apos;s stats — is rolled back.
        </p>
      ),
      confirmLabel: "Remove event",
      busyLabel: "Removing…",
      tone: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/matches/${params.id}/events`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: event.id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not remove the event.");
      },
    });
    if (!ok) return;
    await load();
    setNotice("Event removed.");
  }

  if (error)
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        <Link href="/admin" className="text-[13px] font-bold text-accent">
          &larr; Back to dashboard
        </Link>
        <Banner tone="error">{error}</Banner>
      </div>
    );

  if (!match) {
    return (
      <SkeletonScreen label="Loading match">
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 lg:px-6 lg:py-7">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-[54px] w-full rounded-card" />
          <Skeleton className="h-3.5 w-20" />
          <SkeletonRows rows={4} />
        </div>
      </SkeletonScreen>
    );
  }

  const homeTeam =
    departments.find((d) => d.id === match.home.departmentId) ??
    fallbackTeam(match.home.departmentId, "Home");
  const awayTeam =
    departments.find((d) => d.id === match.away.departmentId) ??
    fallbackTeam(match.away.departmentId, "Away");

  function teamFor(id: string) {
    return id === homeTeam.id ? homeTeam : awayTeam;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-5 lg:px-6 lg:py-7">
      <Link href="/admin" className="text-[13px] font-bold text-accent">
        &larr; Back to dashboard
      </Link>

      <header className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-premium">
        <div className="flex flex-wrap items-center gap-2">
          <DeptBadge department={homeTeam} size={30} />
          <span className="text-[17px] font-extrabold text-white lg:text-[20px]">
            {homeTeam.shortName} {match.home.score} - {match.away.score} {awayTeam.shortName}
          </span>
          <DeptBadge department={awayTeam} size={30} />
          <span className="ml-auto text-[12px] text-white/70">
            {[match.kickoff, match.venue].filter(Boolean).join(" · ")}
          </span>
        </div>

        {/* The score belongs here as well as on the dashboard: this is the
            screen open while the match is being watched. */}
        <div className="border-t border-line pt-3">
          <ScoreControls
            match={match}
            home={homeTeam}
            away={awayTeam}
            size="large"
            onSaved={(updated) => {
              queryClient.setQueryData(queryKeys.match(match.id), updated);
              queryClient.invalidateQueries({ queryKey: queryKeys.matches });
              setNotice("Score updated.");
            }}
            onError={(message) => setLocalError(message)}
          />
          <p className="mt-1.5 text-[11.5px] text-white/70">
            Recording a goal below moves this on its own — edit it here only to correct it.
          </p>
        </div>
      </header>

      <Notice>{notice}</Notice>

      {/* Teamsheets come before the events: they are set before kick-off, and
          they are what the substitution picker offers all match. */}
      <LineupEditor
        match={match}
        home={homeTeam}
        away={awayTeam}
        locked={Boolean(match.firstHalfStartedAt) || match.status !== "UPCOMING"}
        onSaved={setNotice}
      />

      <section className="space-y-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Add event</h2>
        <EventForm
          match={match}
          home={homeTeam}
          away={awayTeam}
          onAdded={() => {
            load();
            setNotice("Event added.");
          }}
        />
      </section>

      <MatchStatsControls match={match} home={homeTeam} away={awayTeam} />

      <ManOfTheMatch match={match} home={homeTeam} away={awayTeam} />

      <section className="space-y-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">
          Events
          {match.events.length > 0 && (
            <span className="ml-2 font-semibold text-white/70">{match.events.length}</span>
          )}
        </h2>

        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {match.events.map((e, i) => {
            const style = EVENT_STYLES[e.type];
            const team = teamFor(e.departmentId);
            return (
              <div
                key={e.id ?? i}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-[13.5px] text-white"
              >
                <span className="tabular w-9 shrink-0 font-bold">{e.minute}&apos;</span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style.className}`}
                >
                  {style.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{e.playerName}</span>
                  <span className="text-white/70"> · {team.shortName}</span>
                  {e.assistPlayerName && (
                    <span className="text-white/70"> · assist {e.assistPlayerName}</span>
                  )}
                  {e.subInPlayerName && (
                    <span className="text-white/70"> · on {e.subInPlayerName}</span>
                  )}
                  {e.detail && <span className="text-white/70"> · {e.detail}</span>}
                  {!e.playerId && <span className="ml-1 text-[11.5px] text-gold">unlinked</span>}
                </span>
                <button
                  onClick={() => e.id != null && removeEvent(e)}
                  className={`${btnDanger} ${btnSm}`}
                >
                  Remove
                </button>
              </div>
            );
          })}
          {match.events.length === 0 && (
            <p className="px-3 py-5 text-center text-[13.5px] text-white/70">
              No events yet. Goals, cards and substitutions recorded above appear here and on the
              public match page.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
