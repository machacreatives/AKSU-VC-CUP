import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireSuperadmin } from "@/lib/require-admin";
import { runSchema } from "@/lib/db/schema";
import { recordAudit } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

/**
 * Empty the tournament and leave a working, up-to-date database behind.
 *
 * What goes: every team, squad, fixture, event, group and venue.
 *
 * What stays, deliberately:
 *  - Superadmin accounts. Wiping the account you are signed in as would end
 *    the session that asked for the wipe, and first-run setup only reopens
 *    when *no* administrator is left — a half-emptied admin table would lock
 *    the dashboard instead of resetting it.
 *  - The audit log. It is the record of who did this, so destroying it as part
 *    of the same action defeats the point of having one.
 *
 * Team administrators are *not* exempt: admin_users.department_id cascades
 * from departments, so an account tied to a deleted team goes with it. That is
 * the existing rule for deleting a single team, applied to all of them at once,
 * and the confirmation says so before anything runs.
 *
 * Rows are deleted rather than tables dropped, then the schema is re-applied.
 * The button this sits behind used to be "Update database", and a reset that
 * left the schema stale would take that away.
 */
export async function POST() {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    // Counted first: after the wipe there is nothing left to describe what was
    // in there, and "reset the database" with no numbers is a useless log line.
    const { rows: before } = await sql`
      SELECT (SELECT COUNT(*)::int FROM departments)  AS departments,
             (SELECT COUNT(*)::int FROM players)      AS players,
             (SELECT COUNT(*)::int FROM matches)      AS matches,
             (SELECT COUNT(*)::int FROM match_events) AS events,
             (SELECT COUNT(*)::int FROM groups)       AS groups,
             (SELECT COUNT(*)::int FROM venues)       AS venues,
             (SELECT COUNT(*)::int FROM admin_users WHERE role = 'TEAM_ADMIN') AS "teamAdmins",
             (SELECT COUNT(*)::int FROM admin_users WHERE role = 'SUPERADMIN') AS superadmins`;
    const counts = before[0];

    const client = await sql.connect();
    try {
      await client.query("BEGIN");
      // Child rows first. The foreign keys would cascade most of this anyway,
      // but naming the order makes the intent explicit and keeps the delete
      // from depending on which ON DELETE rule happens to be in place.
      await client.query("DELETE FROM match_events");
      await client.query("DELETE FROM matches");
      await client.query("DELETE FROM players");
      // Cascades to admin_users.department_id, taking team admins with it.
      await client.query("DELETE FROM departments");
      await client.query("DELETE FROM groups");
      await client.query("DELETE FROM venues");
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // Outside the transaction: the schema statements are individually
    // idempotent but not transactional, and a failure here leaves an empty
    // database rather than a half-deleted one.
    const { applied } = await runSchema();

    await recordAudit({
      actor: auth.user,
      action: "database.reset",
      targetType: "system",
      targetLabel: "the whole tournament",
      detail: { removed: counts, schemaStatements: applied },
    });

    return NextResponse.json({ ok: true, removed: counts, schemaStatements: applied });
  } catch (err) {
    console.error("database reset failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Could not reset the database. Nothing was changed." },
      { status: 500 }
    );
  }
}
