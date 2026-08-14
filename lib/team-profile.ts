import {
  Department,
  GroupId,
  Match,
  MatchStage,
  Player,
  STAGE_LABELS,
  StandingsRow,
} from "@/lib/types";
import { computeStandings, sortStandings } from "@/lib/standings";
import { tieWinnerDepartmentId } from "@/lib/knockout";

/**
 * Everything a team's profile shows, derived from matches and events.
 *
 * Nothing here is stored. Goals scored, clean sheets, cards and form are all
 * counted from the same fixtures the rest of the site reads, so a corrected
 * scoreline or a deleted event moves this page too — the alternative, a set of
 * per-team counter columns, is exactly the dual-source problem that was taken
 * out of the players table.
 *
 * The one exception is the coach, which is a fact about the team rather than
 * something a match can tell you, so it lives on the department row.
 */

export type TeamPosition =
  | { kind: "group"; group: GroupId; position: number; of: number; points: number }
  | { kind: "knockout"; stage: MatchStage; label: string; eliminated: boolean }
  | { kind: "none" };

export type TeamProfile = {
  team: Department;
  /** Finished matches only, newest first. */
  played: Match[];
  nextMatch: Match | null;
  lastMatch: Match | null;
  /** Most recent first, capped at five — same convention as the group table. */
  form: ("W" | "D" | "L")[];
  record: StandingsRow;
  goalsScored: number;
  goalsConceded: number;
  goalDifference: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  squad: Player[];
  topScorer: Player | null;
  topAssister: Player | null;
  position: TeamPosition;
};

/** A match this team is in, either side. */
function involves(match: Match, teamId: string): boolean {
  return match.home.departmentId === teamId || match.away.departmentId === teamId;
}

/** This team's and the opponent's score, whichever side they were on. */
export function sidesOf(match: Match, teamId: string): { own: number; against: number } | null {
  if (match.home.departmentId === teamId) return { own: match.home.score, against: match.away.score };
  if (match.away.departmentId === teamId) return { own: match.away.score, against: match.home.score };
  return null;
}

function byKickoff(a: Match, b: Match): number {
  const at = a.kickoffAt ? Date.parse(a.kickoffAt) : 0;
  const bt = b.kickoffAt ? Date.parse(b.kickoffAt) : 0;
  return at - bt || a.id.localeCompare(b.id);
}

const FINISHED = (m: Match) => m.status === "FT";
const LIVE = (m: Match) => m.status === "LIVE" || m.status === "HT";

/**
 * Where the team stands.
 *
 * A group team gets its row in its own group's table. A knockout side gets the
 * furthest round it reached, and whether it went out there — which is a
 * different question from "did it lose", because a tie level after ninety
 * minutes is decided on penalties.
 */
export function teamPosition(
  team: Department,
  matches: Match[],
  departments: Department[]
): TeamPosition {
  const knockout = matches
    .filter((m) => involves(m, team.id) && m.stage && m.stage !== "GROUP")
    .sort(byKickoff);

  if (knockout.length > 0) {
    const furthest = knockout[knockout.length - 1];
    const stage = furthest.stage as MatchStage;
    // Only a finished tie can eliminate anyone. A tie still level and
    // unresolved has no winner yet, so nobody is out.
    const winner = furthest.status === "FT" ? tieWinnerDepartmentId(furthest) : null;
    return {
      kind: "knockout",
      stage,
      label: STAGE_LABELS[stage],
      eliminated: winner !== null && winner !== team.id,
    };
  }

  if (!team.group) return { kind: "none" };

  const inGroup = departments.filter((d) => d.group === team.group && d.campus === team.campus);
  const table = sortStandings(
    computeStandings(matches, inGroup, team.group),
    matches,
    team.group
  );
  const index = table.findIndex((r) => r.departmentId === team.id);
  if (index === -1) return { kind: "none" };

  return {
    kind: "group",
    group: team.group,
    position: index + 1,
    of: table.length,
    points: table[index].points,
  };
}

export function buildTeamProfile(
  team: Department,
  matches: Match[],
  players: Player[],
  departments: Department[]
): TeamProfile {
  const theirs = matches.filter((m) => involves(m, team.id));
  const finished = theirs.filter(FINISHED).sort(byKickoff);

  // A match in progress is the one people came to see, so it counts as "next"
  // ahead of anything merely scheduled.
  const live = theirs.filter(LIVE).sort(byKickoff)[0] ?? null;
  const upcoming = theirs
    .filter((m) => m.status === "UPCOMING")
    .sort(byKickoff)[0] ?? null;

  let goalsScored = 0;
  let goalsConceded = 0;
  let cleanSheets = 0;
  const form: ("W" | "D" | "L")[] = [];

  // Tallied here rather than read out of computeStandings, which is scoped to
  // one group and needs both sides in the table. A profile counts every
  // finished match the team played, knockout ties included.
  const record: StandingsRow = {
    departmentId: team.id,
    played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0, form: [],
  };

  for (const match of finished) {
    const s = sidesOf(match, team.id);
    if (!s) continue;
    goalsScored += s.own;
    goalsConceded += s.against;
    if (s.against === 0) cleanSheets++;

    const result = s.own > s.against ? "W" : s.own === s.against ? "D" : "L";
    form.push(result);

    record.played++;
    record.goalsFor += s.own;
    record.goalsAgainst += s.against;
    if (result === "W") { record.won++; record.points += 3; }
    else if (result === "D") { record.drawn++; record.points += 1; }
    else record.lost++;
  }
  record.form = form.slice(-5).reverse();

  // Cards come from events rather than the squad's totals, because a card
  // shown to someone since removed from the squad still happened.
  let yellowCards = 0;
  let redCards = 0;
  for (const match of theirs) {
    for (const event of match.events) {
      if (event.departmentId !== team.id) continue;
      if (event.type === "YELLOW") yellowCards++;
      if (event.type === "RED") redCards++;
    }
  }

  const squad = players
    .filter((p) => p.departmentId === team.id)
    .sort((a, b) => a.number - b.number);

  const best = (key: "goals" | "assists"): Player | null => {
    const ranked = squad
      .filter((p) => p[key] > 0)
      .sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name));
    return ranked[0] ?? null;
  };

  return {
    team,
    played: [...finished].reverse(),
    nextMatch: live ?? upcoming,
    lastMatch: finished[finished.length - 1] ?? null,
    form: form.slice(-5).reverse(),
    record,
    goalsScored,
    goalsConceded,
    goalDifference: goalsScored - goalsConceded,
    cleanSheets,
    yellowCards,
    redCards,
    squad,
    topScorer: best("goals"),
    topAssister: best("assists"),
    position: teamPosition(team, matches, departments),
  };
}
