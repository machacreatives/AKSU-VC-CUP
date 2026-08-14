"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDepartments, useMatches, usePlayers } from "@/lib/api";
import { buildTeamProfile, sidesOf, TeamProfile } from "@/lib/team-profile";
import { useDepartmentLookup } from "@/lib/data-context";
import { Department, Match, Player, PLAYER_STATUS_LABELS } from "@/lib/types";
import DeptBadge from "@/components/DeptBadge";
import FormGuide from "@/components/FormGuide";
import MatchCard from "@/components/MatchCard";
import RatingPill from "@/components/RatingPill";

/** One number with a caption. The profile is mostly these. */
function Stat({
  label,
  value,
  tone = "plain",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "plain" | "win" | "loss" | "gold";
  hint?: string;
}) {
  const toneClass =
    tone === "win"
      ? "text-win"
      : tone === "loss"
      ? "text-loss"
      : tone === "gold"
      ? "text-gold"
      : "text-white";
  return (
    <div className="rounded-card border border-line bg-surface px-3 py-2.5">
      <div className={`tabular text-[22px] font-extrabold leading-tight ${toneClass}`}>{value}</div>
      <div className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-white/60">
        {label}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-white/50">{hint}</div>}
    </div>
  );
}

function SectionHeading({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 px-1">
      <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-accent">{children}</h2>
      {/* Which matches the block counts. The Record totals match the group
          table (finished only) while Leaders counts every goal recorded, so a
          goal in a match still in progress makes the two disagree. Saying so
          is better than quietly picking one and being wrong on the other. */}
      {note && <span className="text-[11.5px] text-white/50">{note}</span>}
    </div>
  );
}

/** Where the team stands, in words. */
function PositionBadge({ profile }: { profile: TeamProfile }) {
  const p = profile.position;

  if (p.kind === "group") {
    const ordinal = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"][p.position] ?? `${p.position}th`;
    return (
      <span className="rounded-full border border-accent/40 bg-accent/15 px-2.5 py-1 text-[12px] font-bold text-white">
        {ordinal} in Group {p.group} · {p.points} pt{p.points === 1 ? "" : "s"}
      </span>
    );
  }

  if (p.kind === "knockout") {
    return (
      <span
        className={`rounded-full border px-2.5 py-1 text-[12px] font-bold ${
          p.eliminated
            ? "border-loss/40 bg-loss/10 text-loss"
            : "border-win/40 bg-win/15 text-win"
        }`}
      >
        {p.eliminated ? `Out at the ${p.label.toLowerCase()}` : `In the ${p.label.toLowerCase()}`}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-line bg-surface2 px-2.5 py-1 text-[12px] font-bold text-white/70">
      Not in a group yet
    </span>
  );
}

/** A finished match as one line, from this team's point of view. */
function ResultRow({ match, teamId }: { match: Match; teamId: string }) {
  const getDepartment = useDepartmentLookup();
  const s = sidesOf(match, teamId);
  if (!s) return null;

  // A results list that does not name the opponent is a column of scorelines.
  const atHome = match.home.departmentId === teamId;
  const opponent = getDepartment(atHome ? match.away.departmentId : match.home.departmentId);
  const result = s.own > s.against ? "W" : s.own === s.against ? "D" : "L";
  const tone =
    result === "W" ? "bg-win/20 text-win" : result === "D" ? "bg-surface3 text-white/70" : "bg-loss/20 text-loss";

  return (
    <Link
      href={`/match/${match.id}`}
      className="flex items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-2 transition-colors hover:border-white/20"
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-[11px] font-extrabold ${tone}`}>
        {result}
      </span>
      <span className="tabular shrink-0 text-[14px] font-bold text-white">
        {s.own} - {s.against}
      </span>
      <span className="shrink-0 text-[11px] font-bold uppercase text-white/40">
        {atHome ? "H" : "A"}
      </span>
      <DeptBadge department={opponent} size={18} />
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">
        {opponent.shortName}
        <span className="ml-2 font-normal text-white/55">{match.kickoff}</span>
      </span>
      <span className="shrink-0 text-[11.5px] font-semibold text-white/50">
        {match.stage && match.stage !== "GROUP" ? match.stage : match.round}
      </span>
    </Link>
  );
}

function TopPlayer({
  title,
  player,
  metric,
  suffix,
}: {
  title: string;
  player: Player | null;
  metric: number;
  suffix: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-3 py-2.5">
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-white/60">{title}</div>
      {player ? (
        <div className="mt-1 flex items-center gap-2">
          <span className="tabular text-[12px] font-bold text-white/50">#{player.number}</span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white">{player.name}</span>
          <span className="tabular shrink-0 text-[15px] font-extrabold text-accent">
            {metric}
            <span className="ml-1 text-[11px] font-semibold text-white/60">{suffix}</span>
          </span>
        </div>
      ) : (
        <div className="mt-1 text-[13.5px] text-white/50">None yet</div>
      )}
    </div>
  );
}

export default function TeamProfileView({
  teamId,
  initialProfile,
  initialMatches,
  initialPlayers,
  initialDepartments,
}: {
  teamId: string;
  initialProfile: TeamProfile;
  initialMatches: Match[];
  initialPlayers: Player[];
  initialDepartments: Department[];
}) {
  // The same cached queries the rest of the site polls, so a goal scored during
  // a live match moves this page's totals without a reload.
  const { data: matches = initialMatches } = useMatches({ initialData: initialMatches });
  const { data: players = initialPlayers } = usePlayers({ initialData: initialPlayers });
  const { data: departments = initialDepartments } = useDepartments({
    initialData: initialDepartments,
  });

  const profile = useMemo(() => {
    const team = departments.find((d) => d.id === teamId);
    // The team can vanish mid-session if an admin deletes it. Falling back to
    // the server snapshot keeps the page readable instead of throwing.
    if (!team) return initialProfile;
    return buildTeamProfile(team, matches, players, departments);
  }, [teamId, matches, players, departments, initialProfile]);

  const { team, record } = profile;
  const keeper = profile.squad.filter((p) => p.position === "GK");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-5 lg:px-6 lg:py-7">
      <Link href="/" className="inline-block text-[13px] font-bold text-accent">
        &larr; All teams
      </Link>

      {/* Identity */}
      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <DeptBadge department={team} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-extrabold leading-tight text-white lg:text-[32px]">
              {team.name}
            </h1>
            <p className="mt-0.5 text-[13.5px] text-white/70">
              {team.shortName} · {team.faculty}
            </p>
            <p className="mt-1 text-[13.5px] text-white">
              <span className="text-white/60">Coach: </span>
              {team.coach ? (
                <span className="font-bold">{team.coach}</span>
              ) : (
                <span className="text-white/50">not named yet</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PositionBadge profile={profile} />
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-white/60">
              Form
            </span>
            <FormGuide form={profile.form} size={16} />
          </span>
        </div>
      </header>

      {/* Next and last game */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <SectionHeading>Next game</SectionHeading>
          {profile.nextMatch ? (
            <MatchCard match={profile.nextMatch} />
          ) : (
            <p className="rounded-card border border-line bg-surface px-3.5 py-3 text-[13.5px] text-white/70">
              No fixture scheduled.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <SectionHeading>Last game</SectionHeading>
          {profile.lastMatch ? (
            <MatchCard match={profile.lastMatch} />
          ) : (
            <p className="rounded-card border border-line bg-surface px-3.5 py-3 text-[13.5px] text-white/70">
              No matches played yet.
            </p>
          )}
        </section>
      </div>

      {/* The numbers */}
      <section className="space-y-2">
        <SectionHeading note="Finished matches">Record</SectionHeading>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Played" value={record.played} />
          <Stat
            label="W / D / L"
            value={`${record.won}-${record.drawn}-${record.lost}`}
          />
          <Stat label="Goals scored" value={profile.goalsScored} tone="win" />
          <Stat label="Goals conceded" value={profile.goalsConceded} tone="loss" />
          <Stat
            label="Goal difference"
            value={profile.goalDifference > 0 ? `+${profile.goalDifference}` : profile.goalDifference}
            tone={profile.goalDifference > 0 ? "win" : profile.goalDifference < 0 ? "loss" : "plain"}
          />
          <Stat
            label="Clean sheets"
            value={profile.cleanSheets}
            hint={keeper.length === 1 ? keeper[0].name : undefined}
          />
          <Stat label="Yellow cards" value={profile.yellowCards} tone="gold" />
          <Stat label="Red cards" value={profile.redCards} tone="loss" />
        </div>
      </section>

      {/* Leaders */}
      <section className="space-y-2">
        <SectionHeading note="All recorded goals and assists">Leaders</SectionHeading>
        <div className="grid gap-2 sm:grid-cols-2">
          <TopPlayer
            title="Top scorer"
            player={profile.topScorer}
            metric={profile.topScorer?.goals ?? 0}
            suffix="goals"
          />
          <TopPlayer
            title="Most assists"
            player={profile.topAssister}
            metric={profile.topAssister?.assists ?? 0}
            suffix="assists"
          />
        </div>
      </section>

      {/* Squad */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <SectionHeading>Squad</SectionHeading>
          <span className="text-[12px] text-white/60">
            {profile.squad.length} player{profile.squad.length === 1 ? "" : "s"}
          </span>
        </div>

        {profile.squad.length === 0 ? (
          <p className="rounded-card border border-line bg-surface px-3.5 py-3 text-[13.5px] text-white/70">
            No squad registered yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-card border border-line bg-surface">
            {profile.squad.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center gap-2.5 px-3 py-2 ${i > 0 ? "border-t border-line" : ""}`}
              >
                <span className="tabular w-7 shrink-0 text-[13px] font-bold text-white/50">
                  {p.number}
                </span>
                <span className="w-8 shrink-0 text-[11px] font-bold uppercase text-white/60">
                  {p.position}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
                  {p.name}
                  {p.squadRole !== "PLAYER" && (
                    <span className="ml-1.5 text-[10.5px] font-bold uppercase text-accent">
                      {p.squadRole === "CAPTAIN" ? "C" : "VC"}
                    </span>
                  )}
                  {p.status !== "ACTIVE" && (
                    <span className="ml-1.5 text-[10.5px] font-bold uppercase text-gold">
                      {PLAYER_STATUS_LABELS[p.status]}
                    </span>
                  )}
                </span>
                <span className="tabular hidden shrink-0 gap-2 text-[12px] text-white/60 sm:flex">
                  {p.goals > 0 && <span>{p.goals}G</span>}
                  {p.assists > 0 && <span>{p.assists}A</span>}
                </span>
                {p.rating !== undefined && (
                  <span className="shrink-0">
                    <RatingPill rating={p.rating} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Results */}
      {profile.played.length > 0 && (
        <section className="space-y-2">
          <SectionHeading>Results</SectionHeading>
          <div className="space-y-1.5">
            {profile.played.map((m) => (
              <ResultRow key={m.id} match={m} teamId={team.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
