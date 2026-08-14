"use client";

import Link from "next/link";
import { KNOCKOUT_STAGES, Match, MatchStage, STAGE_LABELS } from "@/lib/types";
import { advancedTo, tieOutcome } from "@/lib/knockout";
import { useDepartmentLookup } from "@/lib/data-context";
import DeptBadge from "./DeptBadge";
import MatchClock from "./MatchClock";

/** Which rounds get a column, and how many ties each holds when full. */
const BRACKET: { stage: MatchStage; ties: number }[] = [
  { stage: "R16", ties: 8 },
  { stage: "QF", ties: 4 },
  { stage: "SF", ties: 2 },
  { stage: "FINAL", ties: 1 },
];

function TieCard({ match, all }: { match: Match; all: Match[] }) {
  const getDepartment = useDepartmentLookup();
  const home = getDepartment(match.home.departmentId);
  const away = getDepartment(match.away.departmentId);

  const isLive = match.status === "LIVE" || match.status === "HT";
  const isFT = match.status === "FT";
  // Extra time and penalties included: a tie level after ninety minutes used to
  // read as a finished match with no winner, forever.
  const outcome = tieOutcome(match);
  const winner = outcome.winner;
  const next = advancedTo(match, all);

  const row = (side: "home" | "away") => {
    const team = side === "home" ? home : away;
    const score = side === "home" ? match.home.score : match.away.score;
    const lost = winner !== null && winner !== side;
    return (
      <div className="flex min-w-0 items-center gap-2">
        <DeptBadge department={team} size={20} />
        <span
          className={`min-w-0 flex-1 truncate text-[14px] ${
            lost ? "font-medium text-white/55" : "font-bold text-white"
          }`}
        >
          {team.shortName}
        </span>
        {match.status !== "UPCOMING" && (
          <span
            className={`tabular text-[15px] font-extrabold ${
              isLive ? "text-win" : lost ? "text-white/55" : "text-white"
            }`}
          >
            {score}
          </span>
        )}
      </div>
    );
  };

  return (
    <Link
      href={`/match/${match.id}`}
      className="block space-y-1.5 rounded-card border border-line bg-surface px-3 py-2.5 transition-colors hover:border-white/20"
    >
      {row("home")}
      {row("away")}
      <div className="flex items-center justify-between border-t border-line pt-1.5 text-[11.5px] text-white/60">
        <span className="truncate">{outcome.note ?? match.kickoff}</span>
        {isLive ? (
          <MatchClock match={match} className="shrink-0 font-bold text-win" />
        ) : (
          <span className="shrink-0 font-semibold">{isFT ? "FT" : ""}</span>
        )}
      </div>
      {outcome.unresolved && (
        <p className="text-[11px] font-semibold text-gold">Level — to be decided</p>
      )}
      {next && (
        <p className="truncate text-[11px] text-white/50">
          Winner &rarr; {STAGE_LABELS[next.stage ?? "SF"]}
        </p>
      )}
    </Link>
  );
}

function TBDCard() {
  return (
    <div className="flex items-center justify-between rounded-card border border-dashed border-line bg-surface px-3 py-3">
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold text-white/50">TBD</span>
        <span className="text-[15px] font-semibold text-white/50">TBD</span>
      </div>
      <span className="text-[12px] font-bold uppercase tracking-wide text-white/50">vs</span>
    </div>
  );
}

/**
 * The bracket, from real fixtures.
 *
 * This used to render seven hardcoded "TBD" cards regardless of what was in the
 * database, so it said exactly the same thing on the day of the final as it did
 * before a ball was kicked. Rounds with no ties yet still show placeholders —
 * that part was right, a bracket should show the shape of what is coming.
 */
export default function KnockoutBracket({ matches }: { matches: Match[] }) {
  const knockout = matches.filter((m) => m.stage && m.stage !== "GROUP");
  const thirdPlace = knockout.filter((m) => m.stage === "THIRD");
  const anyPlayed = knockout.length > 0;

  // Only show rounds that either have ties or come after one that does — an
  // eight-team tournament should not display an empty round of 16.
  const rounds = BRACKET.filter(({ stage }) => {
    if (knockout.some((m) => m.stage === stage)) return true;
    return stage !== "R16" && anyPlayed;
  });

  return (
    <div className="space-y-5">
      {!anyPlayed && (
        <div className="rounded-card border border-line bg-surface2 px-3.5 py-3">
          <p className="text-[14px] font-medium text-white">
            The knockout bracket opens once the group stage finishes. Ties appear here as they are
            drawn.
          </p>
        </div>
      )}

      {/* Stacked rounds on phones. On large screens the rounds become columns
          that read left to right, and each round is centred against the one
          before it so it reads as an actual bracket. */}
      <div
        className="space-y-5 lg:grid lg:items-center lg:gap-6 lg:space-y-0"
        style={{ gridTemplateColumns: `repeat(${Math.max(rounds.length, 1)}, minmax(0, 1fr))` }}
      >
        {(rounds.length > 0 ? rounds : BRACKET.slice(1)).map(({ stage, ties }) => {
          const played = knockout.filter((m) => m.stage === stage);
          const placeholders = Math.max(0, ties - played.length);

          return (
            <section key={stage} className="space-y-2">
              <h2 className="px-1 text-[13px] font-extrabold uppercase tracking-wide text-accent lg:text-center lg:text-[14px]">
                {STAGE_LABELS[stage]}
              </h2>
              <div className="space-y-2 lg:space-y-4">
                {played.map((m) => (
                  <TieCard key={m.id} match={m} all={matches} />
                ))}
                {Array.from({ length: placeholders }).map((_, i) => (
                  <TBDCard key={`tbd-${i}`} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {thirdPlace.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-extrabold uppercase tracking-wide text-accent">
            {STAGE_LABELS.THIRD}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:max-w-md">
            {thirdPlace.map((m) => (
              <TieCard key={m.id} match={m} all={matches} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
