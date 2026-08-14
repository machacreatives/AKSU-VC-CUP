import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { runSchema } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

// Creates the tables if they are missing. This replaced the old seed route,
// which also copied lib/mock-data.ts into the database — that demo data has
// been removed, so this only ever sets up the schema. Every statement is
// CREATE TABLE / CREATE INDEX IF NOT EXISTS, so re-running is harmless and
// never touches existing rows.
export async function POST() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    await runSchema();

    const { rows } = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM departments) AS departments,
        (SELECT COUNT(*)::int FROM players)     AS players,
        (SELECT COUNT(*)::int FROM matches)     AS matches
    `;

    return NextResponse.json({ ok: true, tables: rows[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
