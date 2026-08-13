import { sql } from "@vercel/postgres";
import { unstable_noStore as noStore } from "next/cache";
import { Department, Match, MatchEvent, Player, StandingsRow } from "@/lib/types";

// @vercel/postgres talks to Neon over HTTP, and Next.js patches global fetch
// with its Data Cache — so query responses were being cached to disk under
// .next/cache and served forever. Scores stayed frozen at whatever the first
// read returned, even across a dev-server restart, and even though the pages
// are `dynamic = "force-dynamic"` (that marks the *route* dynamic; it does not
// opt the underlying fetches out of the Data Cache).
//
// noStore() opts every read below out of that cache.
function freshRead() {
  noStore();
}

// ---------- Departments ----------

export async function getDepartments(): Promise<Department[]> {
  freshRead();
  const { rows } = await sql`SELECT id, name, short_name AS "shortName", faculty, campus, "group", color FROM departments ORDER BY name`;
  return rows as Department[];
}

export async function upsertDepartment(d: Department) {
  await sql`
    INSERT INTO departments (id, name, short_name, faculty, campus, "group", color)
    VALUES (${d.id}, ${d.name}, ${d.shortName}, ${d.faculty}, ${d.campus}, ${d.group}, ${d.color})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, short_name = EXCLUDED.short_name, faculty = EXCLUDED.faculty,
      campus = EXCLUDED.campus, "group" = EXCLUDED."group", color = EXCLUDED.color
  `;
}

export async function deleteDepartment(id: string) {
  await sql`DELETE FROM departments WHERE id = ${id}`;
}

// ---------- Players ----------

export async function getPlayers(): Promise<Player[]> {
  freshRead();
  const { rows } = await sql`
    SELECT id, name, number, position, department_id AS "departmentId", level,
           rating, goals, assists, yellow_cards AS "yellowCards", red_cards AS "redCards"
    FROM players ORDER BY department_id, number
  `;
  // pg returns NUMERIC as a string to preserve precision, so `rating` arrives
  // as "7.8" and anything calling .toFixed() on it blows up. INTEGER columns
  // already come back as numbers.
  return rows.map((row: any) => ({
    ...row,
    rating: row.rating === null || row.rating === undefined ? undefined : Number(row.rating),
  })) as Player[];
}

export async function upsertPlayer(p: Player) {
  await sql`
    INSERT INTO players (id, name, number, position, department_id, level, rating, goals, assists, yellow_cards, red_cards)
    VALUES (${p.id}, ${p.name}, ${p.number}, ${p.position}, ${p.departmentId}, ${p.level}, ${p.rating ?? null}, ${p.goals}, ${p.assists}, ${p.yellowCards}, ${p.redCards})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, number = EXCLUDED.number, position = EXCLUDED.position,
      department_id = EXCLUDED.department_id, level = EXCLUDED.level, rating = EXCLUDED.rating,
      goals = EXCLUDED.goals, assists = EXCLUDED.assists,
      yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards
  `;
}

export async function deletePlayer(id: string) {
  await sql`DELETE FROM players WHERE id = ${id}`;
}

// ---------- Matches ----------

function rowToMatchBase(row: any): Omit<Match, "events"> {
  return {
    id: row.id,
    status: row.status,
    minute: row.minute ?? undefined,
    kickoff: row.kickoff,
    round: row.round,
    group: row.group,
    venue: row.venue,
    home: {
      departmentId: row.home_department_id,
      score: row.home_score,
      formation: row.home_formation ?? undefined,
      startingXI: row.home_starting_xi ?? undefined,
      captainId: row.home_captain_id ?? undefined,
      stats: row.home_stats ?? undefined,
    },
    away: {
      departmentId: row.away_department_id,
      score: row.away_score,
      formation: row.away_formation ?? undefined,
      startingXI: row.away_starting_xi ?? undefined,
      captainId: row.away_captain_id ?? undefined,
      stats: row.away_stats ?? undefined,
    },
  };
}

export async function getMatches(): Promise<Match[]> {
  freshRead();
  const { rows: matchRows } = await sql`SELECT * FROM matches ORDER BY id`;
  const { rows: eventRows } = await sql`SELECT id, match_id, minute, type, department_id, player_name, detail FROM match_events ORDER BY minute`;

  return matchRows.map((row: any) => {
    const events: MatchEvent[] = eventRows
      .filter((e: any) => e.match_id === row.id)
      .map((e: any) => ({
        id: e.id,
        minute: e.minute,
        type: e.type,
        departmentId: e.department_id,
        playerName: e.player_name,
        detail: e.detail ?? undefined,
      }));
    return { ...rowToMatchBase(row), events };
  });
}

export async function getMatch(id: string): Promise<Match | null> {
  freshRead();
  const { rows } = await sql`SELECT * FROM matches WHERE id = ${id}`;
  if (rows.length === 0) return null;
  const { rows: eventRows } = await sql`SELECT id, minute, type, department_id, player_name, detail FROM match_events WHERE match_id = ${id} ORDER BY minute`;
  const events: MatchEvent[] = eventRows.map((e: any) => ({
    id: e.id,
    minute: e.minute,
    type: e.type,
    departmentId: e.department_id,
    playerName: e.player_name,
    detail: e.detail ?? undefined,
  }));
  return { ...rowToMatchBase(rows[0]), events };
}

export async function upsertMatch(m: Match) {
  // sql`` only takes primitives, and the starting XIs are TEXT[] columns, so
  // this one goes through the parameterised form where pg maps JS arrays.
  await sql.query(
    `
    INSERT INTO matches (
      id, status, minute, kickoff, round, "group", venue,
      home_department_id, away_department_id, home_score, away_score,
      home_formation, away_formation, home_starting_xi, away_starting_xi,
      home_captain_id, away_captain_id, home_stats, away_stats
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11,
      $12, $13,
      $14, $15,
      $16, $17,
      $18, $19
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status, minute = EXCLUDED.minute, kickoff = EXCLUDED.kickoff,
      round = EXCLUDED.round, "group" = EXCLUDED."group", venue = EXCLUDED.venue,
      home_department_id = EXCLUDED.home_department_id, away_department_id = EXCLUDED.away_department_id,
      home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score,
      home_formation = EXCLUDED.home_formation, away_formation = EXCLUDED.away_formation,
      home_starting_xi = EXCLUDED.home_starting_xi, away_starting_xi = EXCLUDED.away_starting_xi,
      home_captain_id = EXCLUDED.home_captain_id, away_captain_id = EXCLUDED.away_captain_id,
      home_stats = EXCLUDED.home_stats, away_stats = EXCLUDED.away_stats
  `,
    [
      m.id, m.status, m.minute ?? null, m.kickoff, m.round, m.group, m.venue,
      m.home.departmentId, m.away.departmentId, m.home.score, m.away.score,
      m.home.formation ?? null, m.away.formation ?? null,
      m.home.startingXI ?? null, m.away.startingXI ?? null,
      m.home.captainId ?? null, m.away.captainId ?? null,
      m.home.stats ? JSON.stringify(m.home.stats) : null,
      m.away.stats ? JSON.stringify(m.away.stats) : null,
    ]
  );
}

export async function deleteMatch(id: string) {
  await sql`DELETE FROM matches WHERE id = ${id}`;
}

// The Top Scorers / Cards tables read the counters on the players row, so an
// event recorded in admin has to move them or those tabs never change.
const STAT_COLUMN: Partial<Record<MatchEvent["type"], string>> = {
  GOAL: "goals",
  YELLOW: "yellow_cards",
  RED: "red_cards",
};

async function adjustPlayerStat(e: MatchEvent, delta: 1 | -1) {
  const column = STAT_COLUMN[e.type];
  if (!column) return; // SUB has no counter

  // `column` is only ever one of the three literals above, never user input.
  await sql.query(
    `UPDATE players SET ${column} = GREATEST(${column} + $1, 0)
     WHERE department_id = $2 AND LOWER(name) = LOWER($3)`,
    [delta, e.departmentId, e.playerName]
  );
}

export async function addMatchEvent(
  matchId: string,
  e: MatchEvent,
  { syncPlayerStats = true }: { syncPlayerStats?: boolean } = {}
) {
  await sql`
    INSERT INTO match_events (match_id, minute, type, department_id, player_name, detail)
    VALUES (${matchId}, ${e.minute}, ${e.type}, ${e.departmentId}, ${e.playerName}, ${e.detail ?? null})
  `;
  if (syncPlayerStats) await adjustPlayerStat(e, 1);
}

export async function deleteMatchEvent(eventId: number) {
  // Read it back first so removing a mistake also rolls the counter back.
  const { rows } = await sql`
    SELECT type, department_id AS "departmentId", player_name AS "playerName", minute
    FROM match_events WHERE id = ${eventId}
  `;
  await sql`DELETE FROM match_events WHERE id = ${eventId}`;
  if (rows.length > 0) await adjustPlayerStat(rows[0] as MatchEvent, -1);
}

// ---------- Standings (computed from finished + live matches) ----------

export async function getStandings(): Promise<StandingsRow[]> {
  freshRead();
  const [matches, departments] = await Promise.all([getMatches(), getDepartments()]);
  return computeStandings(matches, departments);
}

// Split out so pages that already loaded matches + departments don't re-query.
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
