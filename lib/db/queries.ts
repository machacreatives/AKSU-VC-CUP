import { sql } from "@vercel/postgres";
import { unstable_noStore as noStore } from "next/cache";
import {
  Department,
  Group,
  Match,
  MatchEvent,
  Player,
  PlayerProfile,
  StandingsRow,
  TeamMatchStats,
  Venue,
} from "@/lib/types";
import { computeStandings } from "@/lib/standings";
import { withSeasonRatings } from "@/lib/ratings";

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
  const { rows } = await sql`SELECT id, name, short_name AS "shortName", faculty, campus, "group", color, coach FROM departments ORDER BY name`;
  return rows as Department[];
}

export async function upsertDepartment(d: Department) {
  await sql`
    INSERT INTO departments (id, name, short_name, faculty, campus, "group", color, coach)
    VALUES (${d.id}, ${d.name}, ${d.shortName}, ${d.faculty}, ${d.campus}, ${d.group}, ${d.color},
            ${d.coach ?? null})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, short_name = EXCLUDED.short_name, faculty = EXCLUDED.faculty,
      campus = EXCLUDED.campus, "group" = EXCLUDED."group", color = EXCLUDED.color,
      coach = EXCLUDED.coach
  `;
}

export async function deleteDepartment(id: string) {
  await sql`DELETE FROM departments WHERE id = ${id}`;
}

// ---------- Groups ----------

export async function getGroups(): Promise<Group[]> {
  freshRead();
  const { rows } = await sql`
    SELECT id, name, campus, sort_order AS "sortOrder"
    FROM groups ORDER BY campus, sort_order, name
  `;
  return rows as Group[];
}

export async function upsertGroup(g: Group) {
  await sql`
    INSERT INTO groups (id, name, campus, sort_order)
    VALUES (${g.id}, ${g.name}, ${g.campus}, ${g.sortOrder})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, campus = EXCLUDED.campus, sort_order = EXCLUDED.sort_order
  `;
}

export async function deleteGroup(id: string) {
  await sql`DELETE FROM groups WHERE id = ${id}`;
}

/**
 * What still points at a group, so deleting one can explain itself.
 *
 * The foreign keys would refuse the delete anyway, but as an opaque 23503 the
 * admin cannot act on.
 */
export async function countGroupUsage(id: string): Promise<{ teams: number; matches: number }> {
  freshRead();
  const { rows } = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM departments WHERE "group" = ${id}) AS teams,
      (SELECT COUNT(*)::int FROM matches WHERE "group" = ${id}) AS matches
  `;
  return { teams: rows[0].teams as number, matches: rows[0].matches as number };
}

/**
 * Move everything in one group to another, then remove the first.
 *
 * Deleting a populated group is refused, so without this the only way to
 * retire one is to move every team by hand first. Done as one transaction:
 * a half-moved group would leave teams pointing at a group that is gone.
 */
export async function mergeGroupInto(fromId: string, toId: string) {
  const client = await sql.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE departments SET "group" = $1 WHERE "group" = $2`, [toId, fromId]);
    await client.query(`UPDATE matches SET "group" = $1 WHERE "group" = $2`, [toId, fromId]);
    await client.query(`DELETE FROM groups WHERE id = $1`, [fromId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Venues ----------

export async function getVenues(): Promise<Venue[]> {
  freshRead();
  const { rows } = await sql`SELECT id, name FROM venues ORDER BY name`;
  return rows as Venue[];
}

export async function upsertVenue(v: Venue) {
  await sql`
    INSERT INTO venues (id, name) VALUES (${v.id}, ${v.name})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `;
}

/**
 * Removing a ground from the list does not touch the fixtures played there —
 * matches store the venue as text precisely so this is safe.
 */
export async function deleteVenue(id: string) {
  await sql`DELETE FROM venues WHERE id = ${id}`;
}

/** How many fixtures name this ground, so the admin can be told before deleting. */
export async function countMatchesAtVenue(name: string): Promise<number> {
  freshRead();
  const { rows } = await sql`
    SELECT COUNT(*)::int AS count FROM matches WHERE LOWER(BTRIM(venue)) = LOWER(BTRIM(${name}))
  `;
  return (rows[0]?.count as number) ?? 0;
}

// ---------- Players ----------

/**
 * Squads, with goals, assists and cards counted from the events themselves.
 *
 * These used to be counter columns on the players row, incremented and
 * decremented alongside every event write. That made two sources of truth for
 * the same number — the leaderboards read the counters while the ratings, the
 * lineup board and the match page all counted from events — with nothing
 * detecting disagreement and no way to repair it once it happened.
 *
 * Counting on read is a join over a table that holds a few hundred rows for a
 * tournament of this size, and it cannot drift by construction.
 *
 * Every COUNT is cast to int: Postgres returns int8, which the driver hands
 * back as a string, and `"3" > 0` is not the comparison the leaderboards think
 * they are making.
 */
export async function getPlayers(): Promise<Player[]> {
  freshRead();
  const { rows } = await sql`
    SELECT p.id, p.name, p.number, p.position, p.department_id AS "departmentId",
           p.squad_role AS "squadRole", p.status,
           COALESCE(g.goals, 0)   AS goals,
           COALESCE(a.assists, 0) AS assists,
           COALESCE(c.yellows, 0) AS "yellowCards",
           COALESCE(c.reds, 0)    AS "redCards"
    FROM players p
    LEFT JOIN (
      SELECT player_id, COUNT(*)::int AS goals
      FROM match_events WHERE type = 'GOAL' AND player_id IS NOT NULL
      GROUP BY player_id
    ) g ON g.player_id = p.id
    LEFT JOIN (
      SELECT assist_player_id AS pid, COUNT(*)::int AS assists
      FROM match_events WHERE assist_player_id IS NOT NULL
      GROUP BY assist_player_id
    ) a ON a.pid = p.id
    LEFT JOIN (
      SELECT player_id,
             (COUNT(*) FILTER (WHERE type = 'YELLOW'))::int AS yellows,
             (COUNT(*) FILTER (WHERE type = 'RED'))::int    AS reds
      FROM match_events WHERE player_id IS NOT NULL
      GROUP BY player_id
    ) c ON c.player_id = p.id
    ORDER BY p.department_id, p.number
  `;
  return rows as Player[];
}

/**
 * Squads with their season rating attached.
 *
 * Ratings are computed from matches (see lib/ratings.ts), not stored, so every
 * caller that serves players to the UI needs the fixture list too. This exists
 * as one function rather than three call sites because forgetting it does not
 * fail loudly — it just empties the Best Rated leaderboard, which is exactly
 * how the old `players.rating` column went unnoticed for so long.
 */
export async function getPlayersWithRatings(): Promise<Player[]> {
  const [players, matches] = await Promise.all([getPlayers(), getMatches()]);
  return withSeasonRatings(players, matches);
}

/**
 * Write the squad record only.
 *
 * Takes PlayerProfile, not Player, so the stat counters are structurally out of
 * reach: this used to write goals/assists/cards from the caller's payload, which
 * meant saving a player form from stale state wiped whatever had been scored
 * since the page loaded. Those columns are owned by match events alone.
 */
export async function upsertPlayer(p: PlayerProfile) {
  await sql`
    INSERT INTO players (id, name, number, position, department_id, squad_role, status)
    VALUES (${p.id}, ${p.name}, ${p.number}, ${p.position}, ${p.departmentId}, ${p.squadRole}, ${p.status})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, number = EXCLUDED.number, position = EXCLUDED.position,
      department_id = EXCLUDED.department_id,
      squad_role = EXCLUDED.squad_role, status = EXCLUDED.status
  `;
}

/**
 * A team may have only one captain and one vice-captain, so promoting somebody
 * has to demote the incumbent. Done as two statements rather than a partial
 * unique index, which would surface as an opaque 23505 to the admin.
 */
export async function setSquadRole(playerId: string, departmentId: string, role: PlayerProfile["squadRole"]) {
  if (role !== "PLAYER") {
    await sql`
      UPDATE players SET squad_role = 'PLAYER'
      WHERE department_id = ${departmentId} AND squad_role = ${role} AND id <> ${playerId}
    `;
  }
  await sql`UPDATE players SET squad_role = ${role} WHERE id = ${playerId}`;
}

/**
 * Matches whose teamsheet names this player, split by whether they have been
 * played.
 *
 * The starting XI and bench are TEXT[] columns and the captain is a bare TEXT,
 * so no foreign key can protect them. Deleting a player used to leave their id
 * behind in every teamsheet they appeared in, and the lineup board then drew a
 * shirt numbered 0 named "Unknown" — which the ratings engine went on to rate.
 */
export async function playerTeamsheetUsage(
  playerId: string
): Promise<{ played: string[]; upcoming: string[] }> {
  freshRead();
  const { rows } = await sql`
    SELECT id, (first_half_started_at IS NOT NULL OR status <> 'UPCOMING') AS started
    FROM matches
    WHERE ${playerId} = ANY(COALESCE(home_starting_xi, '{}'))
       OR ${playerId} = ANY(COALESCE(away_starting_xi, '{}'))
       OR ${playerId} = ANY(COALESCE(home_bench, '{}'))
       OR ${playerId} = ANY(COALESCE(away_bench, '{}'))
       OR home_captain_id = ${playerId}
       OR away_captain_id = ${playerId}
  `;
  return {
    played: rows.filter((r) => r.started).map((r) => r.id as string),
    upcoming: rows.filter((r) => !r.started).map((r) => r.id as string),
  };
}

/**
 * Remove a player, taking their name off any teamsheet that has not been used
 * yet.
 *
 * A teamsheet for a match still to come is a plan and can be edited; one for a
 * match already played is a record, and the caller refuses the delete in that
 * case rather than quietly shrinking a starting eleven to ten.
 */
export async function deletePlayer(id: string) {
  const client = await sql.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE matches
       SET home_starting_xi = array_remove(home_starting_xi, $1),
           away_starting_xi = array_remove(away_starting_xi, $1),
           home_bench       = array_remove(home_bench, $1),
           away_bench       = array_remove(away_bench, $1),
           home_captain_id  = NULLIF(home_captain_id, $1),
           away_captain_id  = NULLIF(away_captain_id, $1)
       WHERE first_half_started_at IS NULL AND status = 'UPCOMING'`,
      [id]
    );
    await client.query(`DELETE FROM players WHERE id = $1`, [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Matches ----------

function rowToMatchBase(row: any): Omit<Match, "events"> {
  return {
    id: row.id,
    status: row.status,
    minute: row.minute ?? undefined,
    firstHalfStartedAt: row.first_half_started_at
      ? new Date(row.first_half_started_at).toISOString()
      : null,
    secondHalfStartedAt: row.second_half_started_at
      ? new Date(row.second_half_started_at).toISOString()
      : null,
    firstHalfAddedMinutes: row.first_half_added_minutes ?? 0,
    secondHalfAddedMinutes: row.second_half_added_minutes ?? 0,
    kickoff: row.kickoff,
    kickoffAt: row.kickoff_at ? new Date(row.kickoff_at).toISOString() : null,
    round: row.round,
    group: row.group ?? null,
    stage: row.stage ?? "GROUP",
    manOfTheMatchId: row.man_of_the_match_id ?? null,
    wentToExtraTime: row.went_to_extra_time ?? false,
    homePenalties: row.home_penalties ?? null,
    awayPenalties: row.away_penalties ?? null,
    venue: row.venue,
    home: {
      departmentId: row.home_department_id,
      score: row.home_score,
      formation: row.home_formation ?? undefined,
      startingXI: row.home_starting_xi ?? undefined,
      bench: row.home_bench ?? undefined,
      captainId: row.home_captain_id ?? undefined,
      stats: row.home_stats ?? undefined,
    },
    away: {
      departmentId: row.away_department_id,
      score: row.away_score,
      formation: row.away_formation ?? undefined,
      startingXI: row.away_starting_xi ?? undefined,
      bench: row.away_bench ?? undefined,
      captainId: row.away_captain_id ?? undefined,
      stats: row.away_stats ?? undefined,
    },
  };
}

const EVENT_COLUMNS = `id, minute, type, department_id, player_id, player_name,
           assist_player_id, assist_player_name, sub_in_player_id, sub_in_player_name,
           goal_type, detail`;

function rowToEvent(e: any): MatchEvent {
  return {
    id: e.id,
    minute: e.minute,
    type: e.type,
    departmentId: e.department_id,
    playerId: e.player_id ?? undefined,
    playerName: e.player_name,
    assistPlayerId: e.assist_player_id ?? undefined,
    assistPlayerName: e.assist_player_name ?? undefined,
    subInPlayerId: e.sub_in_player_id ?? undefined,
    subInPlayerName: e.sub_in_player_name ?? undefined,
    goalType: e.goal_type ?? undefined,
    detail: e.detail ?? undefined,
  };
}

export async function getMatches(): Promise<Match[]> {
  freshRead();
  const { rows: matchRows } = await sql`SELECT * FROM matches ORDER BY kickoff_at NULLS LAST, id`;
  const { rows: eventRows } = await sql.query(
    `SELECT match_id, ${EVENT_COLUMNS} FROM match_events ORDER BY minute`
  );

  return matchRows.map((row: any) => {
    const events: MatchEvent[] = eventRows
      .filter((e: any) => e.match_id === row.id)
      .map(rowToEvent);
    return { ...rowToMatchBase(row), events };
  });
}

export async function getMatch(id: string): Promise<Match | null> {
  freshRead();
  const { rows } = await sql`SELECT * FROM matches WHERE id = ${id}`;
  if (rows.length === 0) return null;
  const { rows: eventRows } = await sql.query(
    `SELECT ${EVENT_COLUMNS} FROM match_events WHERE match_id = $1 ORDER BY minute`,
    [id]
  );
  return { ...rowToMatchBase(rows[0]), events: eventRows.map(rowToEvent) };
}

export async function upsertMatch(m: Match) {
  // sql`` only takes primitives, and the starting XIs are TEXT[] columns, so
  // this one goes through the parameterised form where pg maps JS arrays.
  await sql.query(
    `
    INSERT INTO matches (
      id, status, minute, kickoff, kickoff_at, round, "group", stage, venue,
      home_department_id, away_department_id, home_score, away_score,
      home_formation, away_formation, home_starting_xi, away_starting_xi,
      home_bench, away_bench,
      home_captain_id, away_captain_id, home_stats, away_stats,
      went_to_extra_time, home_penalties, away_penalties
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15,
      $16, $17,
      $18, $19,
      $20, $21,
      $22, $23,
      $24, $25, $26
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status, minute = EXCLUDED.minute, kickoff = EXCLUDED.kickoff,
      kickoff_at = EXCLUDED.kickoff_at,
      round = EXCLUDED.round, "group" = EXCLUDED."group", stage = EXCLUDED.stage,
      venue = EXCLUDED.venue,
      home_department_id = EXCLUDED.home_department_id, away_department_id = EXCLUDED.away_department_id,
      home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score,
      home_formation = EXCLUDED.home_formation, away_formation = EXCLUDED.away_formation,
      home_starting_xi = EXCLUDED.home_starting_xi, away_starting_xi = EXCLUDED.away_starting_xi,
      home_bench = EXCLUDED.home_bench, away_bench = EXCLUDED.away_bench,
      home_captain_id = EXCLUDED.home_captain_id, away_captain_id = EXCLUDED.away_captain_id,
      home_stats = EXCLUDED.home_stats, away_stats = EXCLUDED.away_stats,
      went_to_extra_time = EXCLUDED.went_to_extra_time,
      home_penalties = EXCLUDED.home_penalties,
      away_penalties = EXCLUDED.away_penalties
  `,
    [
      m.id, m.status, m.minute ?? null, m.kickoff, m.kickoffAt ?? null, m.round,
      m.group ?? null, m.stage ?? "GROUP", m.venue,
      m.home.departmentId, m.away.departmentId, m.home.score, m.away.score,
      m.home.formation ?? null, m.away.formation ?? null,
      m.home.startingXI ?? null, m.away.startingXI ?? null,
      m.home.bench ?? null, m.away.bench ?? null,
      m.home.captainId ?? null, m.away.captainId ?? null,
      m.home.stats ? JSON.stringify(m.home.stats) : null,
      m.away.stats ? JSON.stringify(m.away.stats) : null,
      m.wentToExtraTime ?? false,
      m.homePenalties ?? null,
      m.awayPenalties ?? null,
    ]
  );
}

/**
 * Name the substitutes for one side.
 *
 * Its own statement rather than part of upsertMatch: naming a bench during a
 * live match must not be able to touch the scoreline or the clock.
 */
export async function setMatchBench(matchId: string, side: "home" | "away", playerIds: string[]) {
  const column = side === "home" ? "home_bench" : "away_bench";
  await sql.query(`UPDATE matches SET ${column} = $1 WHERE id = $2`, [playerIds, matchId]);
}

/**
 * The whole teamsheet for one side: formation, starting XI, captain, bench.
 *
 * Written together because they only make sense together — an XI of eleven
 * against a formation with ten slots puts a player nowhere, and a captain who
 * is not in the XI wears an armband on the bench. Still scoped to one side and
 * still nowhere near the clock or the scoreline.
 */
export async function setMatchLineup(
  matchId: string,
  side: "home" | "away",
  lineup: {
    formation: string;
    startingXI: string[];
    captainId: string | null;
    bench: string[];
  }
) {
  const prefix = side === "home" ? "home" : "away";
  await sql.query(
    `UPDATE matches
     SET ${prefix}_formation = $1, ${prefix}_starting_xi = $2,
         ${prefix}_captain_id = $3, ${prefix}_bench = $4
     WHERE id = $5`,
    [lineup.formation, lineup.startingXI, lineup.captainId, lineup.bench, matchId]
  );
}

/** True when both sides have a full eleven named. Gates kickoff. */
export function lineupsReady(match: Match): boolean {
  return (
    (match.home.startingXI?.length ?? 0) === 11 && (match.away.startingXI?.length ?? 0) === 11
  );
}

/**
 * Once the referee has blown the whistle the teamsheet is history, not a plan.
 * Editing it mid-match would silently rewrite who was on the pitch when a goal
 * was scored, so it locks the moment the first half starts.
 */
export function lineupsLocked(match: Match): boolean {
  return Boolean(match.firstHalfStartedAt) || match.status !== "UPCOMING";
}

export async function setManOfTheMatch(matchId: string, playerId: string | null) {
  await sql`UPDATE matches SET man_of_the_match_id = ${playerId} WHERE id = ${matchId}`;
}

// Wipe a match back to a clean slate: no score, no clock, no events.
//
// Events are removed one by one through deleteMatchEvent so each one rolls its
// goal/card back off the player's totals. Deleting the rows in a single
// statement would leave the Top Scorers table crediting goals from a match
// that no longer records them.
export async function resetMatch(id: string) {
  // Events used to be deleted one at a time so each could roll its goal back
  // off a player's counter — 3 statements per event, none of it transactional.
  // Stats are counted from the events now, so removing them removes their
  // contribution, and the whole reset is two statements in one transaction.
  const client = await sql.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM match_events WHERE match_id = $1`, [id]);
    await client.query(
      `UPDATE matches
       SET status = 'UPCOMING', minute = NULL, home_score = 0, away_score = 0,
           first_half_started_at = NULL, second_half_started_at = NULL,
           first_half_added_minutes = 0, second_half_added_minutes = 0,
           home_stats = NULL, away_stats = NULL
       WHERE id = $1`,
      [id]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Team stats for a match — possession, shots and so on.
//
// These columns have always been read by the public stats tab but never
// written: the matches route builds each side from departmentId and score
// only, so anything sent for `stats` was silently dropped. This is the write
// path. Kept separate from upsertMatch so recording a stat mid-match cannot
// touch the scoreline, the clock or the lineups.
export async function setMatchStats(
  id: string,
  home: TeamMatchStats | null,
  away: TeamMatchStats | null
) {
  await sql`
    UPDATE matches
    SET home_stats = ${home ? JSON.stringify(home) : null}::jsonb,
        away_stats = ${away ? JSON.stringify(away) : null}::jsonb
    WHERE id = ${id}
  `;
}

/**
 * Record how a knockout tie was decided.
 *
 * Separate from upsertMatch for the same reason the stats and lineup writers
 * are: settling a tie after the whistle must not be able to touch the clock,
 * the teamsheets or the fixture itself.
 */
export async function setTieResolution(
  id: string,
  resolution: { wentToExtraTime: boolean; homePenalties: number | null; awayPenalties: number | null }
) {
  await sql`
    UPDATE matches
    SET went_to_extra_time = ${resolution.wentToExtraTime},
        home_penalties = ${resolution.homePenalties},
        away_penalties = ${resolution.awayPenalties}
    WHERE id = ${id}
  `;
}

export async function deleteMatch(id: string) {
  // match_events cascades. Player stats are counted from those events, so the
  // match's contribution disappears with it — there is nothing left to roll
  // back by hand, which is what the old resetMatch-first dance was for.
  await sql`DELETE FROM matches WHERE id = ${id}`;
}

// An event says something about the team as well as the player, and until now
// nothing acted on that: a goal was logged and the scoreboard stayed 0-0, a
// booking was logged and the foul count stayed put, so the admin had to
// remember to type both. These are the consequences a single event has for the
// team's side of the match.
//
// A goal is, by definition, a shot and a shot on target — counting it as
// neither leaves "shots on target" lower than the number of goals scored.
const TEAM_STAT_DELTAS: Partial<Record<MatchEvent["type"], Partial<TeamMatchStats>>> = {
  GOAL: { shots: 1, shotsOnTarget: 1 },
  YELLOW: { fouls: 1 },
  RED: { fouls: 1 },
};

const DEFAULT_TEAM_STATS: TeamMatchStats = {
  possession: 50,
  shots: 0,
  shotsOnTarget: 0,
  corners: 0,
  fouls: 0,
};

/**
 * Move the scoreline and the team stat counters for one event.
 *
 * Applied with delta 1 when an event is recorded and -1 when it is removed, so
 * deleting a mistake undoes everything it caused. The admin can still type over
 * any of these afterwards — this only supplies the obvious consequence, it does
 * not own the numbers.
 */
async function applyTeamEffects(matchId: string, e: MatchEvent, delta: 1 | -1) {
  const statDelta = TEAM_STAT_DELTAS[e.type];
  const scoreDelta = e.type === "GOAL" ? delta : 0;
  if (!statDelta && scoreDelta === 0) return;

  const { rows } = await sql`
    SELECT home_department_id, away_department_id, home_stats, away_stats
    FROM matches WHERE id = ${matchId}
  `;
  const row = rows[0];
  if (!row) return;

  // An event filed against a team not in this match would otherwise silently
  // adjust the home side.
  const side =
    row.home_department_id === e.departmentId
      ? "home"
      : row.away_department_id === e.departmentId
      ? "away"
      : null;
  if (!side) return;

  if (scoreDelta !== 0) {
    const column = side === "home" ? "home_score" : "away_score";
    await sql.query(
      `UPDATE matches SET ${column} = GREATEST(${column} + $1, 0) WHERE id = $2`,
      [scoreDelta, matchId]
    );
  }

  if (statDelta) {
    const stored = (side === "home" ? row.home_stats : row.away_stats) as TeamMatchStats | null;
    // Nothing recorded yet and an event being removed: there is no count to
    // roll back, and inventing a zeroed block would make the public Stats tab
    // appear because of a deletion.
    if (!stored && delta === -1) return;

    const column = side === "home" ? "home_stats" : "away_stats";

    // Incremented inside Postgres rather than read into JS, changed, and
    // written back. Two goals in the same second both used to read shots: 4
    // and both write 5, so one shot vanished — and the same blob is written
    // wholesale by the stats panel's debounced save, which could overwrite a
    // goal recorded during its 700ms window.
    //
    // Each field reads from the *original* column value, not from the
    // accumulating expression: the keys are independent, so this stays linear
    // in size instead of nesting exponentially.
    const params: unknown[] = [matchId, JSON.stringify(DEFAULT_TEAM_STATS)];
    const base = `COALESCE(${column}, $2::jsonb)`;
    let expression = base;

    for (const [key, amount] of Object.entries(statDelta)) {
      // `key` comes from TEAM_STAT_DELTAS, a module constant — never a request.
      params.push(amount * delta);
      const placeholder = `$${params.length}`;
      expression =
        `jsonb_set(${expression}, '{${key}}', ` +
        `to_jsonb(GREATEST(0, COALESCE((${base}->>'${key}')::int, 0) + ${placeholder})))`;
    }

    await sql.query(`UPDATE matches SET ${column} = ${expression} WHERE id = $1`, params);
  }
}

export async function addMatchEvent(matchId: string, e: MatchEvent) {
  await sql`
    INSERT INTO match_events (
      match_id, minute, type, department_id,
      player_id, player_name, assist_player_id, assist_player_name,
      sub_in_player_id, sub_in_player_name, goal_type, detail
    )
    VALUES (
      ${matchId}, ${e.minute}, ${e.type}, ${e.departmentId},
      ${e.playerId ?? null}, ${e.playerName},
      ${e.assistPlayerId ?? null}, ${e.assistPlayerName ?? null},
      ${e.subInPlayerId ?? null}, ${e.subInPlayerName ?? null},
      ${e.goalType ?? null}, ${e.detail ?? null}
    )
  `;
  await applyTeamEffects(matchId, e, 1);
}

export async function deleteMatchEvent(eventId: number) {
  // One statement, not SELECT-then-DELETE. Two concurrent deletes — a
  // double-tap, a retried request — both used to read the row before either
  // delete landed, so both applied the rollback and the match lost two goals
  // for one removal. RETURNING makes the loser see no rows and do nothing.
  const { rows } = await sql`
    DELETE FROM match_events WHERE id = ${eventId}
    RETURNING match_id AS "matchId", type, department_id AS "departmentId",
              player_id AS "playerId", player_name AS "playerName",
              assist_player_id AS "assistPlayerId", minute
  `;
  if (rows.length === 0) return;

  const event = rows[0] as MatchEvent & { matchId: string };
  await applyTeamEffects(event.matchId, event, -1);
}

// ---------- Standings (computed from finished + live matches) ----------

export async function getStandings(): Promise<StandingsRow[]> {
  freshRead();
  const [matches, departments] = await Promise.all([getMatches(), getDepartments()]);
  return computeStandings(matches, departments);
}


export { computeStandings };
