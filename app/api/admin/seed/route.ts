import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { departments, players, matches } from "@/lib/mock-data";
import { SCHEMA_STATEMENTS } from "@/lib/db/schema";
import { upsertDepartment, upsertPlayer, upsertMatch, addMatchEvent } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // 1. Create tables if they don't exist yet
    for (const stmt of SCHEMA_STATEMENTS) {
      await sql.query(stmt);
    }

    // 2. Seed from the demo data. Departments/players/matches upsert on their
    //    stable ids, but match_events use a SERIAL id, so re-running would
    //    duplicate every goal and card — clear them first.
    for (const d of departments) await upsertDepartment(d);
    for (const p of players) await upsertPlayer(p);

    await sql`DELETE FROM match_events`;
    for (const m of matches) {
      await upsertMatch(m);
      // Bypass the stat-syncing helper: the seeded player rows already carry
      // their goal/card totals, so counting the events again would double them.
      for (const e of m.events) await addMatchEvent(m.id, e, { syncPlayerStats: false });
    }

    return NextResponse.json({
      ok: true,
      seeded: {
        departments: departments.length,
        players: players.length,
        matches: matches.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
