// Single source of truth for the database shape.
//
// This used to live in schema.sql and be read with fs.readFileSync at runtime,
// which is not safe on Vercel — files that nothing imports are not guaranteed
// to be traced into the serverless bundle. Keeping it as a module means it is
// always there.

export const SCHEMA_SQL = `-- AKSU Score database schema
-- Mirrors lib/types.ts exactly so the frontend needs minimal changes.

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  faculty TEXT NOT NULL,
  campus TEXT NOT NULL CHECK (campus IN ('main','obioakpa')),
  "group" TEXT NOT NULL CHECK ("group" IN ('A','B','C','D')),
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number INTEGER NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('GK','DF','MF','FW')),
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  rating NUMERIC,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  yellow_cards INTEGER NOT NULL DEFAULT 0,
  red_cards INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('LIVE','UPCOMING','FT','HT')),
  minute INTEGER,
  kickoff TEXT NOT NULL,
  round TEXT NOT NULL,
  "group" TEXT NOT NULL CHECK ("group" IN ('A','B','C','D')),
  venue TEXT NOT NULL,
  home_department_id TEXT NOT NULL REFERENCES departments(id),
  away_department_id TEXT NOT NULL REFERENCES departments(id),
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  home_formation TEXT,
  away_formation TEXT,
  home_starting_xi TEXT[],
  away_starting_xi TEXT[],
  home_captain_id TEXT,
  away_captain_id TEXT,
  home_stats JSONB,
  away_stats JSONB
);

-- Match clock. The minute is never stored as a ticking number. We record when
-- each half kicked off and every client derives the minute from that, so all
-- viewers agree without the admin typing anything.
-- ADD COLUMN IF NOT EXISTS so existing databases pick these up on init.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS first_half_started_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS second_half_started_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS first_half_added_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS second_half_added_minutes INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS match_events (
  id SERIAL PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  minute INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('GOAL','YELLOW','RED','SUB')),
  department_id TEXT NOT NULL REFERENCES departments(id),
  player_name TEXT NOT NULL,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_players_department ON players(department_id);
CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id);

ALTER TABLE players ADD COLUMN IF NOT EXISTS squad_role TEXT NOT NULL DEFAULT 'PLAYER';
ALTER TABLE players ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE players ALTER COLUMN level DROP NOT NULL;

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_squad_role_ck;
ALTER TABLE players ADD CONSTRAINT players_squad_role_ck CHECK (squad_role IN ('CAPTAIN','VICE_CAPTAIN','PLAYER'));

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_status_ck;
ALTER TABLE players ADD CONSTRAINT players_status_ck CHECK (status IN ('ACTIVE','INJURED','SUSPENDED'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_players_dept_number ON players (department_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_short_name ON departments (LOWER(short_name));
`;

// Split for drivers that accept only one statement per call.
//
// Line comments are stripped first: a `;` inside a `--` comment would
// otherwise be treated as a statement boundary and split the comment into
// fragments that Postgres tries to execute.
export const SCHEMA_STATEMENTS = SCHEMA_SQL.split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

import { sql } from "@vercel/postgres";

/**
 * Apply the schema, reporting which statement failed.
 *
 * The statements are replayed on every init, and the loop is NOT transactional
 * — a failure at statement n leaves the database half-migrated. Every statement
 * is written to be independently idempotent, but when one does fail the bare
 * driver error gives no clue which one it was, so wrap it.
 */
export async function runSchema(): Promise<{ applied: number }> {
  for (let i = 0; i < SCHEMA_STATEMENTS.length; i++) {
    try {
      await sql.query(SCHEMA_STATEMENTS[i]);
    } catch (err) {
      const firstLine = SCHEMA_STATEMENTS[i].split("\n")[0].slice(0, 90);
      throw new Error(
        `Schema statement ${i + 1}/${SCHEMA_STATEMENTS.length} failed (${firstLine}): ` +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }
  return { applied: SCHEMA_STATEMENTS.length };
}
