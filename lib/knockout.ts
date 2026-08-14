import { Match, MatchStage } from "@/lib/types";

// How a knockout tie is decided, and how the bracket flows.
//
// A tie used to be "completed" the moment it reached full time, even at 1-1,
// with no way to record extra time or a shoot-out and therefore no way to say
// who went through. The bracket drew four parallel lists of cards with nothing
// connecting them.

export type TieOutcome = {
  /** Null while the tie is unfinished, or finished and still level. */
  winner: "home" | "away" | null;
  /** Finished, level, and no shoot-out recorded — needs the admin. */
  unresolved: boolean;
  /** "a.e.t." / "4-2 on penalties" — how it was decided. */
  note: string | null;
};

export function tieOutcome(match: Match): TieOutcome {
  const knockout = Boolean(match.stage && match.stage !== "GROUP");
  if (!knockout || match.status !== "FT") {
    return { winner: null, unresolved: false, note: null };
  }

  const aet = match.wentToExtraTime ? "a.e.t." : null;

  if (match.home.score !== match.away.score) {
    return {
      winner: match.home.score > match.away.score ? "home" : "away",
      unresolved: false,
      note: aet,
    };
  }

  const hp = match.homePenalties;
  const ap = match.awayPenalties;
  if (hp != null && ap != null && hp !== ap) {
    return {
      winner: hp > ap ? "home" : "away",
      unresolved: false,
      note: [aet, `${Math.max(hp, ap)}-${Math.min(hp, ap)} on penalties`].filter(Boolean).join(" · "),
    };
  }

  // Level at full time with no shoot-out recorded. Somebody has to go through,
  // so this is surfaced rather than left as a quietly completed tie.
  return { winner: null, unresolved: true, note: aet };
}

/** The department that went through, if the tie has been decided. */
export function tieWinnerDepartmentId(match: Match): string | null {
  const { winner } = tieOutcome(match);
  if (!winner) return null;
  return winner === "home" ? match.home.departmentId : match.away.departmentId;
}

/** Rounds in order, so "the round after this one" is answerable. */
const ROUND_ORDER: MatchStage[] = ["R16", "QF", "SF", "FINAL"];

export function nextStage(stage: MatchStage): MatchStage | null {
  const i = ROUND_ORDER.indexOf(stage);
  return i >= 0 && i < ROUND_ORDER.length - 1 ? ROUND_ORDER[i + 1] : null;
}

/**
 * Where a tie's winner ended up.
 *
 * Derived by looking for them in a later round rather than stored as a link
 * between fixtures. That avoids the alternative — creating next-round ties
 * before their participants are known, which would mean nullable team columns
 * on every match in the tournament — and it cannot go stale: change who won and
 * the connection follows.
 */
export function advancedTo(match: Match, all: Match[]): Match | null {
  const winner = tieWinnerDepartmentId(match);
  const after = match.stage ? nextStage(match.stage) : null;
  if (!winner || !after) return null;

  return (
    all.find(
      (m) =>
        m.stage === after &&
        (m.home.departmentId === winner || m.away.departmentId === winner)
    ) ?? null
  );
}

/** Ties that finished level with no shoot-out — the admin's to-do list. */
export function unresolvedTies(matches: Match[]): Match[] {
  return matches.filter((m) => tieOutcome(m).unresolved);
}
