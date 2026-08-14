import { Department, Match, StandingsRow } from "@/lib/types";

// Pure tally, no database access, so both the server render and the client
// (which now keeps matches fresh through React Query) can compute the table
// from the same code.
export function computeStandings(matches: Match[], departments: Department[]): StandingsRow[] {
  const table = new Map<string, StandingsRow>();
  for (const d of departments) {
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

  for (const m of matches) {
    if (m.status !== "FT") continue;
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

  return Array.from(table.values());
}
