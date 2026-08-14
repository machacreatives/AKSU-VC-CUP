import { Department, GroupId, Match, StandingsRow } from "@/lib/types";

// Pure tally, no database access, so both the server render and the client
// (which keeps matches fresh through React Query) compute the table from the
// same code.

/** Only a finished group-stage fixture builds a group table. */
function countsTowardTable(m: Match): boolean {
  return m.status === "FT" && (m.stage ?? "GROUP") === "GROUP";
}

/**
 * Oldest first.
 *
 * The form guide is the reason this matters: `getMatches` orders by
 * `kickoff_at NULLS LAST`, so fixtures recorded before the date picker existed
 * — precisely the oldest ones — sorted to the *end*. A form guide built in that
 * order would show the oldest results as the most recent.
 */
function chronologically(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const at = a.kickoffAt ? Date.parse(a.kickoffAt) : 0;
    const bt = b.kickoffAt ? Date.parse(b.kickoffAt) : 0;
    return at - bt || a.id.localeCompare(b.id);
  });
}

/**
 * Build a table.
 *
 * `groupId` scopes it to one group, and scopes it **by the group each match was
 * played in** — not by the group its teams happen to be in now. Without that,
 * moving a team from B to A carried its entire past record into the Group A
 * table and silently removed those matches from Group B's. Nothing validates
 * that a group fixture is even between two teams of that group, so the match's
 * own `group` is the only trustworthy answer to "which table does this belong
 * to".
 */
export function computeStandings(
  matches: Match[],
  departments: Department[],
  groupId?: GroupId
): StandingsRow[] {
  const inScope = groupId ? departments.filter((d) => d.group === groupId) : departments;

  const table = new Map<string, StandingsRow>();
  for (const d of inScope) {
    table.set(d.id, {
      departmentId: d.id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      form: [],
    });
  }

  for (const m of chronologically(matches)) {
    if (!countsTowardTable(m)) continue;
    if (groupId && m.group !== groupId) continue;

    const home = table.get(m.home.departmentId);
    const away = table.get(m.away.departmentId);
    if (!home || !away) continue;

    home.played++; away.played++;
    home.goalsFor += m.home.score; home.goalsAgainst += m.away.score;
    away.goalsFor += m.away.score; away.goalsAgainst += m.home.score;

    if (m.home.score > m.away.score) {
      home.won++; home.points += 3; away.lost++;
      home.form.push("W"); away.form.push("L");
    } else if (m.home.score < m.away.score) {
      away.won++; away.points += 3; home.lost++;
      away.form.push("W"); home.form.push("L");
    } else {
      home.drawn++; away.drawn++; home.points++; away.points++;
      home.form.push("D"); away.form.push("D");
    }
  }

  // Most recent five, most recent first — what a form guide means.
  for (const row of table.values()) {
    row.form = row.form.slice(-FORM_LENGTH).reverse();
  }

  return Array.from(table.values());
}

/** How many results the form guide shows. */
export const FORM_LENGTH = 5;

const goalDifference = (r: StandingsRow) => r.goalsFor - r.goalsAgainst;

/**
 * The record between a specific set of teams, and nobody else.
 *
 * Used to separate teams level on points. Only matches where *both* sides are
 * in the tied set count — a win over a team that finished elsewhere in the
 * table says nothing about which of two level teams finished above the other.
 */
function headToHead(
  tied: StandingsRow[],
  matches: Match[],
  groupId?: GroupId
): Map<string, { points: number; gd: number; scored: number }> {
  const ids = new Set(tied.map((r) => r.departmentId));
  const mini = new Map<string, { points: number; gd: number; scored: number }>();
  for (const id of ids) mini.set(id, { points: 0, gd: 0, scored: 0 });

  for (const m of matches) {
    if (!countsTowardTable(m)) continue;
    if (groupId && m.group !== groupId) continue;
    if (!ids.has(m.home.departmentId) || !ids.has(m.away.departmentId)) continue;

    const home = mini.get(m.home.departmentId)!;
    const away = mini.get(m.away.departmentId)!;
    home.scored += m.home.score; away.scored += m.away.score;
    home.gd += m.home.score - m.away.score;
    away.gd += m.away.score - m.home.score;

    if (m.home.score > m.away.score) home.points += 3;
    else if (m.home.score < m.away.score) away.points += 3;
    else { home.points++; away.points++; }
  }

  return mini;
}

/**
 * League order: points, then the head-to-head record between the teams that are
 * level, then overall goal difference, then goals scored.
 *
 * Head-to-head first among equals is what most cup formats specify, and it can
 * reverse who goes through — which matters here, because the knockout page
 * reads the top of each group to seed the bracket.
 *
 * `matches` is optional so a caller without them still gets a sensible order;
 * omitting it simply skips the head-to-head step.
 */
export function sortStandings(
  rows: StandingsRow[],
  matches?: Match[],
  groupId?: GroupId
): StandingsRow[] {
  const byPoints = [...rows].sort(
    (a, b) => b.points - a.points || goalDifference(b) - goalDifference(a) || b.goalsFor - a.goalsFor
  );
  if (!matches) return byPoints;

  // Re-order each block of teams that finished level on points.
  const out: StandingsRow[] = [];
  for (let i = 0; i < byPoints.length; ) {
    let j = i;
    while (j + 1 < byPoints.length && byPoints[j + 1].points === byPoints[i].points) j++;

    if (j === i) {
      out.push(byPoints[i]);
    } else {
      const tied = byPoints.slice(i, j + 1);
      const mini = headToHead(tied, matches, groupId);
      tied.sort((a, b) => {
        const ma = mini.get(a.departmentId)!;
        const mb = mini.get(b.departmentId)!;
        return (
          mb.points - ma.points ||
          mb.gd - ma.gd ||
          mb.scored - ma.scored ||
          goalDifference(b) - goalDifference(a) ||
          b.goalsFor - a.goalsFor ||
          // Last resort, so the order never depends on insertion order.
          a.departmentId.localeCompare(b.departmentId)
        );
      });
      out.push(...tied);
    }
    i = j + 1;
  }
  return out;
}
