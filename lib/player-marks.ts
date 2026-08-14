import { Match, MatchEvent } from "@/lib/types";

/**
 * What happened to each player in a match, reduced to the badges shown beside
 * their name on the lineup board.
 *
 * Computed in one pass over the events rather than filtering per player inside
 * the render: a 4-2-3-1 against a 4-3-3 is twenty-two lookups over the same
 * array otherwise.
 */
export type PlayerMarks = {
  goals: number;
  penalties: number;
  freeKicks: number;
  assists: number;
  yellows: number;
  reds: number;
  cameOn: boolean;
  wentOff: boolean;
};

const EMPTY: PlayerMarks = {
  goals: 0,
  penalties: 0,
  freeKicks: 0,
  assists: 0,
  yellows: 0,
  reds: 0,
  cameOn: false,
  wentOff: false,
};

export type MarkKind =
  | "goal"
  | "penalty"
  | "freeKick"
  | "assist"
  | "yellow"
  | "red"
  | "motm"
  | "on"
  | "off";

/**
 * One emoji per thing that happened.
 *
 * `label` is not decoration — an emoji alone is unreadable to a screen reader
 * and ambiguous to anyone who has not been told what a boot means, so every
 * mark carries its text.
 */
export const MARKS: Record<MarkKind, { emoji: string; label: string }> = {
  goal: { emoji: "⚽", label: "Goal" },
  penalty: { emoji: "🥅", label: "Penalty scored" },
  freeKick: { emoji: "🎯", label: "Free kick scored" },
  assist: { emoji: "🥾", label: "Assist" },
  yellow: { emoji: "🟨", label: "Yellow card" },
  red: { emoji: "🟥", label: "Red card" },
  motm: { emoji: "⭐", label: "Man of the match" },
  on: { emoji: "🔺", label: "Came on" },
  off: { emoji: "🔻", label: "Went off" },
};

export function buildPlayerMarks(match: Match): Map<string, PlayerMarks> {
  const marks = new Map<string, PlayerMarks>();

  const to = (id: string | undefined): PlayerMarks | null => {
    if (!id) return null;
    if (!marks.has(id)) marks.set(id, { ...EMPTY });
    return marks.get(id)!;
  };

  for (const event of match.events as MatchEvent[]) {
    if (event.type === "GOAL") {
      const scorer = to(event.playerId);
      if (scorer) {
        scorer.goals++;
        if (event.goalType === "PENALTY") scorer.penalties++;
        if (event.goalType === "FREE_KICK") scorer.freeKicks++;
      }
      const assister = to(event.assistPlayerId);
      if (assister) assister.assists++;
    } else if (event.type === "YELLOW") {
      const p = to(event.playerId);
      if (p) p.yellows++;
    } else if (event.type === "RED") {
      const p = to(event.playerId);
      if (p) p.reds++;
    } else if (event.type === "SUB") {
      const off = to(event.playerId);
      if (off) off.wentOff = true;
      const on = to(event.subInPlayerId);
      if (on) on.cameOn = true;
    }
  }

  return marks;
}

/**
 * The badges for one player, in a fixed order so two players never show the
 * same set in a different sequence.
 *
 * Repeats are counted rather than repeated past two — three goals reads
 * "⚽ ×3", which stays legible inside a pitch marker.
 */
export function marksFor(
  marks: PlayerMarks | undefined,
  { isManOfTheMatch = false }: { isManOfTheMatch?: boolean } = {}
): { kind: MarkKind; count: number }[] {
  const out: { kind: MarkKind; count: number }[] = [];
  if (isManOfTheMatch) out.push({ kind: "motm", count: 1 });
  if (!marks) return out;

  // A penalty and a free kick are goals too, so the plain ball only counts the
  // ones that were neither — otherwise a penalty shows two symbols for one goal.
  const openPlay = marks.goals - marks.penalties - marks.freeKicks;
  if (openPlay > 0) out.push({ kind: "goal", count: openPlay });
  if (marks.penalties > 0) out.push({ kind: "penalty", count: marks.penalties });
  if (marks.freeKicks > 0) out.push({ kind: "freeKick", count: marks.freeKicks });
  if (marks.assists > 0) out.push({ kind: "assist", count: marks.assists });
  if (marks.yellows > 0) out.push({ kind: "yellow", count: marks.yellows });
  if (marks.reds > 0) out.push({ kind: "red", count: marks.reds });
  return out;
}
