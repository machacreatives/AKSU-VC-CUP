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
  "group" TEXT NOT NULL,
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
  "group" TEXT NOT NULL,
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

ALTER TABLE match_events ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS assist_player_id TEXT;
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS assist_player_name TEXT;

UPDATE match_events e
SET player_id = p.id
FROM players p
WHERE e.player_id IS NULL
  AND p.department_id = e.department_id
  AND LOWER(TRIM(p.name)) = LOWER(TRIM(e.player_name))
  AND (SELECT COUNT(*) FROM players q
       WHERE q.department_id = e.department_id
         AND LOWER(TRIM(q.name)) = LOWER(TRIM(e.player_name))) = 1;

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_player_fk;
ALTER TABLE match_events ADD CONSTRAINT match_events_player_fk
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_assist_fk;
ALTER TABLE match_events ADD CONSTRAINT match_events_assist_fk
  FOREIGN KEY (assist_player_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_assist_only_on_goal_ck;
ALTER TABLE match_events ADD CONSTRAINT match_events_assist_only_on_goal_ck
  CHECK (assist_player_id IS NULL OR type = 'GOAL');

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_no_self_assist_ck;
ALTER TABLE match_events ADD CONSTRAINT match_events_no_self_assist_ck
  CHECK (assist_player_id IS NULL OR assist_player_id <> player_id);

CREATE INDEX IF NOT EXISTS idx_match_events_player ON match_events(player_id);
CREATE INDEX IF NOT EXISTS idx_match_events_assist ON match_events(assist_player_id);

-- Venues. Fixtures still store the venue as text so renaming or removing a
-- ground cannot rewrite the history of matches already played there. This
-- table is what the fixture form offers, not a foreign key.
CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_venues_name ON venues (LOWER(name));

-- Seed the list from grounds already in use, so the dropdown is not empty on
-- an existing database and no fixture loses its venue.
INSERT INTO venues (id, name)
SELECT DISTINCT
  LOWER(REGEXP_REPLACE(BTRIM(venue), '[^a-zA-Z0-9]+', '-', 'g')),
  BTRIM(venue)
FROM matches
WHERE venue IS NOT NULL AND BTRIM(venue) <> ''
ON CONFLICT DO NOTHING;

-- The scheduled instant, alongside the display text already in kickoff.
-- Left NULL on existing rows: the old values were free text like "Sat, 3:00 PM"
-- with no date in them, so there is nothing honest to convert them into.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS kickoff_at TIMESTAMPTZ;

-- Named substitutes per side. Only these players are offered as coming on.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_bench TEXT[];
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_bench TEXT[];

-- A substitution is one event with two players: player_id goes off,
-- sub_in_player_id comes on.
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS sub_in_player_id TEXT;
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS sub_in_player_name TEXT;

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_sub_in_fk;
ALTER TABLE match_events ADD CONSTRAINT match_events_sub_in_fk
  FOREIGN KEY (sub_in_player_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_sub_in_only_on_sub_ck;
ALTER TABLE match_events ADD CONSTRAINT match_events_sub_in_only_on_sub_ck
  CHECK (sub_in_player_id IS NULL OR type = 'SUB');

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_no_self_sub_ck;
ALTER TABLE match_events ADD CONSTRAINT match_events_no_self_sub_ck
  CHECK (sub_in_player_id IS NULL OR sub_in_player_id <> player_id);

-- Groups.
--
-- These used to be four fixed letters, written into a TypeScript union and a
-- CHECK constraint on two tables, so adding one meant a code change and a
-- deploy. They are rows now, and each one belongs to a campus.
--
-- The id is the value already stored in departments."group" and
-- matches."group", so seeding A-D below leaves every existing row meaning
-- exactly what it meant before, with no data migration.
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  campus TEXT NOT NULL CHECK (campus IN ('main','obioakpa')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_name ON groups (LOWER(name));

INSERT INTO groups (id, name, campus, sort_order) VALUES
  ('A', 'A', 'main', 1),
  ('B', 'B', 'main', 2),
  ('C', 'C', 'obioakpa', 3),
  ('D', 'D', 'obioakpa', 4)
ON CONFLICT DO NOTHING;

-- Any group that existing data refers to but the seed did not create. Without
-- this the foreign keys below would fail on a database that already holds a
-- value outside A-D.
INSERT INTO groups (id, name, campus, sort_order)
SELECT DISTINCT d."group", d."group", d.campus, 99
FROM departments d
WHERE d."group" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO groups (id, name, campus, sort_order)
SELECT DISTINCT m."group", m."group", 'main', 99
FROM matches m
WHERE m."group" IS NOT NULL
ON CONFLICT DO NOTHING;

-- The letters are no longer a closed set, so the CHECKs have to go. The
-- foreign keys take over: a group cannot be deleted while anything points at
-- it, and nothing can point at a group that does not exist.
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_group_check;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_group_check;

ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_group_fk;
ALTER TABLE departments ADD CONSTRAINT departments_group_fk
  FOREIGN KEY ("group") REFERENCES groups(id);

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_group_fk;
ALTER TABLE matches ADD CONSTRAINT matches_group_fk
  FOREIGN KEY ("group") REFERENCES groups(id);

-- How a goal was scored. Needed because the match graphic marks a penalty and
-- a free kick differently from a goal in open play, and "Penalty" typed into
-- the free-text detail field is not something a renderer can read.
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS goal_type TEXT;

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_goal_type_ck;
ALTER TABLE match_events ADD CONSTRAINT match_events_goal_type_ck
  CHECK (goal_type IS NULL OR (type = 'GOAL' AND goal_type IN ('OPEN_PLAY','PENALTY','FREE_KICK')));

-- Man of the match. ON DELETE SET NULL rather than CASCADE: removing a player
-- from a squad should not delete the match they were once best in.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS man_of_the_match_id TEXT;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_motm_fk;
ALTER TABLE matches ADD CONSTRAINT matches_motm_fk
  FOREIGN KEY (man_of_the_match_id) REFERENCES players(id) ON DELETE SET NULL;

-- Knockout. Group fixtures keep counting toward the table, everything else is
-- a tie in the bracket, so a cup result can no longer pollute a group table.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'GROUP';

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_stage_ck;
ALTER TABLE matches ADD CONSTRAINT matches_stage_ck
  CHECK (stage IN ('GROUP','R16','QF','SF','THIRD','FINAL'));

-- A knockout tie belongs to no group, so the column has to allow it. The
-- foreign key still holds for every row that names one.
ALTER TABLE matches ALTER COLUMN "group" DROP NOT NULL;
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
