import { Match, Player } from "@/lib/types";

// Player ratings, computed rather than judged.
//
// Every number here comes out of what the match records: goals, assists, clean
// sheets, possession, attacking output and discipline. The same performance
// always produces the same rating, and any rating can be explained by pointing
// at the rules that made it — which is the whole point of not having somebody
// type a number into a box.
//
// Nothing is stored. Ratings are derived from matches and events the same way
// lib/standings.ts derives the table, so they cannot drift out of step with the
// events they describe: delete a goal and the rating falls on the next read.

export const RATING_RULES = {
  /** Everyone who appeared starts here. */
  BASE: 6.0,
  MAX: 10.0,
  /** Nobody drops below this, however bad the afternoon. */
  FLOOR: 4.0,

  // Goals taper: the first is worth most, and a hat-trick lands exactly on the
  // ceiling (6 + 2 + 1 + 1 = 10) without needing a special case for it.
  FIRST_GOAL: 2.0,
  FURTHER_GOAL: 1.0,

  ASSIST: 0.5,
  CLEAN_SHEET: 2.0,
  POSSESSION: 2.0,
  ATTACKING_OUTPUT: 1.0,

  YELLOW: -0.5,
  RED: -2.0,

  /** "Has possession" — more than half of it. */
  POSSESSION_MIN: 51,
  /** "Plenty of shots and corners" — both have to clear the bar. */
  SHOTS_MIN: 10,
  CORNERS_MIN: 5,

  /** Three goals takes man of the match, whoever the admin named. */
  HAT_TRICK: 3,
} as const;

/** One rule that fired, and what it was worth. Drives the admin breakdown. */
export type RatingLine = { label: string; delta: number };

export type MatchRating = {
  rating: number;
  lines: RatingLine[];
  /** True when the rating was forced to 10.0 by the award rather than summed. */
  manOfTheMatch: boolean;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Who took part, per side.
 *
 * The teamsheet is the answer when there is one. Fixtures recorded before
 * teamsheets existed have neither a starting XI nor a bench, so they fall back
 * to whoever appears in an event — otherwise every old match would rate nobody.
 */
function appearances(match: Match, side: "home" | "away"): Set<string> {
  const team = match[side];
  const ids = new Set<string>(team.startingXI ?? []);

  // A substitute only counts once they actually came on.
  for (const event of match.events) {
    if (event.type === "SUB" && event.subInPlayerId && event.departmentId === team.departmentId) {
      ids.add(event.subInPlayerId);
    }
  }

  if (ids.size === 0) {
    for (const event of match.events) {
      if (event.departmentId !== team.departmentId) continue;
      if (event.playerId) ids.add(event.playerId);
      if (event.assistPlayerId) ids.add(event.assistPlayerId);
    }
  }

  return ids;
}

/**
 * The scoreline the recorded goals add up to.
 *
 * A score can be typed directly or moved by recording goals, and nothing ever
 * reconciled the two — type a 3-1 and Top Scorers stays empty while the match
 * page shows a scoreline no goalscorer explains. This is what the events say,
 * so the difference can at least be pointed at.
 */
export function scoreFromEvents(match: Match): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const event of match.events) {
    if (event.type !== "GOAL") continue;
    if (event.departmentId === match.home.departmentId) home++;
    else if (event.departmentId === match.away.departmentId) away++;
  }
  return { home, away };
}

/** True when the stored scoreline and the recorded goals disagree. */
export function scoreDisagreesWithEvents(match: Match): boolean {
  const derived = scoreFromEvents(match);
  return derived.home !== match.home.score || derived.away !== match.away.score;
}

/** A match only rates players once the referee has started it. */
export function hasKickedOff(match: Match): boolean {
  return match.status === "LIVE" || match.status === "HT" || match.status === "FT";
}

/**
 * Man of the match, after the hat-trick rule.
 *
 * Three goals takes the award outright. Derived rather than written back, so
 * removing one of those goals hands the award straight back to whoever the
 * admin picked instead of leaving a stale winner in the database.
 */
export function effectiveManOfTheMatch(match: Match): string | null {
  const goals = new Map<string, number>();
  // Minute of the goal that completed a hat-trick, for tie-breaking.
  const completedAt = new Map<string, number>();

  for (const event of [...match.events].sort((a, b) => a.minute - b.minute)) {
    if (event.type !== "GOAL" || !event.playerId) continue;
    const total = (goals.get(event.playerId) ?? 0) + 1;
    goals.set(event.playerId, total);
    if (total === RATING_RULES.HAT_TRICK) completedAt.set(event.playerId, event.minute);
  }

  const scorers = [...goals.entries()].filter(([, n]) => n >= RATING_RULES.HAT_TRICK);
  if (scorers.length === 0) return match.manOfTheMatchId ?? null;

  // Most goals wins; then whoever got there first; then id, so two identical
  // hat-tricks still resolve to the same player on every render.
  scorers.sort(
    (a, b) =>
      b[1] - a[1] ||
      (completedAt.get(a[0]) ?? 0) - (completedAt.get(b[0]) ?? 0) ||
      a[0].localeCompare(b[0])
  );
  return scorers[0][0];
}

/**
 * Ratings for one match, keyed by player id.
 *
 * Returns an empty map for a fixture that has not kicked off — there is nothing
 * to rate yet, and a pitch full of 6.0s before a ball is played reads as a
 * verdict rather than an absence.
 */
export function computeMatchRatings(match: Match, players: Player[]): Map<string, MatchRating> {
  const ratings = new Map<string, MatchRating>();
  if (!hasKickedOff(match)) return ratings;

  const byId = new Map(players.map((p) => [p.id, p]));
  const motm = effectiveManOfTheMatch(match);

  for (const side of ["home", "away"] as const) {
    const team = match[side];
    const opponent = match[side === "home" ? "away" : "home"];
    const played = appearances(match, side);
    if (played.size === 0) continue;

    const cleanSheet = opponent.score === 0;
    const stats = team.stats;
    const hasPossession = (stats?.possession ?? 0) >= RATING_RULES.POSSESSION_MIN;
    const attacked =
      (stats?.shots ?? 0) >= RATING_RULES.SHOTS_MIN &&
      (stats?.corners ?? 0) >= RATING_RULES.CORNERS_MIN;

    // One pass over the events per side rather than a filter per player.
    const goals = new Map<string, number>();
    const assists = new Map<string, number>();
    const yellows = new Map<string, number>();
    const reds = new Map<string, number>();
    const bump = (map: Map<string, number>, id?: string) => {
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    };

    for (const event of match.events) {
      if (event.departmentId !== team.departmentId) continue;
      if (event.type === "GOAL") {
        bump(goals, event.playerId);
        bump(assists, event.assistPlayerId);
      } else if (event.type === "YELLOW") {
        bump(yellows, event.playerId);
      } else if (event.type === "RED") {
        bump(reds, event.playerId);
      }
    }

    for (const playerId of played) {
      const player = byId.get(playerId);
      // A teamsheet can name an id that no longer resolves — the XI and bench
      // are TEXT[] columns, so nothing stops a deleted player's id staying
      // behind. Rating a name nobody can look up puts a 6.0 on the board for a
      // player who does not exist; the pitch already draws them as "Unknown".
      if (!player) continue;

      const lines: RatingLine[] = [{ label: "Base", delta: RATING_RULES.BASE }];

      const scored = goals.get(playerId) ?? 0;
      if (scored > 0) {
        const delta =
          RATING_RULES.FIRST_GOAL + (scored - 1) * RATING_RULES.FURTHER_GOAL;
        lines.push({ label: scored === 1 ? "Goal" : `${scored} goals`, delta });
      }

      const assisted = assists.get(playerId) ?? 0;
      if (assisted > 0) {
        lines.push({
          label: assisted === 1 ? "Assist" : `${assisted} assists`,
          delta: assisted * RATING_RULES.ASSIST,
        });
      }

      // The back line is rated on the team's clean sheet, not on anything the
      // events can attribute to one defender.
      if (cleanSheet && (player.position === "GK" || player.position === "DF")) {
        lines.push({ label: "Clean sheet", delta: RATING_RULES.CLEAN_SHEET });
      }
      if (hasPossession && player.position === "MF") {
        lines.push({
          label: `Possession ${stats?.possession}%`,
          delta: RATING_RULES.POSSESSION,
        });
      }
      if (attacked && player.position === "FW") {
        lines.push({
          label: `${stats?.shots} shots, ${stats?.corners} corners`,
          delta: RATING_RULES.ATTACKING_OUTPUT,
        });
      }

      const booked = yellows.get(playerId) ?? 0;
      if (booked > 0) {
        lines.push({
          label: booked === 1 ? "Yellow card" : `${booked} yellow cards`,
          delta: booked * RATING_RULES.YELLOW,
        });
      }
      const sentOff = reds.get(playerId) ?? 0;
      if (sentOff > 0) {
        lines.push({ label: "Red card", delta: sentOff * RATING_RULES.RED });
      }

      const total = lines.reduce((sum, line) => sum + line.delta, 0);
      const clamped = Math.min(RATING_RULES.MAX, Math.max(RATING_RULES.FLOOR, total));

      // The award is worth a 10.0 outright, applied last so it wins over
      // everything else that happened.
      const isMotm = motm === playerId;
      if (isMotm && clamped < RATING_RULES.MAX) {
        lines.push({
          label: "Man of the match",
          delta: round1(RATING_RULES.MAX - clamped),
        });
      }

      ratings.set(playerId, {
        rating: round1(isMotm ? RATING_RULES.MAX : clamped),
        lines,
        manOfTheMatch: isMotm,
      });
    }
  }

  return ratings;
}

export type SeasonRating = { average: number; appearances: number };

/**
 * The season figure behind the Best Rated tab: the mean of a player's match
 * ratings across finished fixtures.
 *
 * Deliberately excludes matches still in progress. A rating that moves every
 * time somebody scores would reshuffle the leaderboard mid-afternoon, and a
 * player who happens to be on the pitch right now would outrank one who is not.
 */
export function computeSeasonRatings(
  matches: Match[],
  players: Player[]
): Map<string, SeasonRating> {
  const totals = new Map<string, { sum: number; count: number }>();

  for (const match of matches) {
    if (match.status !== "FT") continue;
    for (const [playerId, { rating }] of computeMatchRatings(match, players)) {
      const entry = totals.get(playerId) ?? { sum: 0, count: 0 };
      entry.sum += rating;
      entry.count += 1;
      totals.set(playerId, entry);
    }
  }

  const out = new Map<string, SeasonRating>();
  for (const [playerId, { sum, count }] of totals) {
    out.set(playerId, { average: round1(sum / count), appearances: count });
  }
  return out;
}

/**
 * Attach season ratings to a squad list.
 *
 * `Player.rating` used to come from a database column nothing ever wrote, so it
 * was always undefined and every leaderboard was empty. It is computed now, and
 * this is the only thing that sets it.
 */
export function withSeasonRatings(players: Player[], matches: Match[]): Player[] {
  const season = computeSeasonRatings(matches, players);
  return players.map((player) => {
    const entry = season.get(player.id);
    return entry
      ? { ...player, rating: entry.average, appearances: entry.appearances }
      : { ...player, rating: undefined, appearances: 0 };
  });
}
