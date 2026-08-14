import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { denyUnlessOwnTeam, requireAdmin } from "@/lib/require-admin";
import { getDepartments } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * Name the coach.
 *
 * Its own endpoint rather than a field on POST /api/admin/departments, which is
 * superadmin-only and rewrites the whole team. A team admin needs to name their
 * own coach without also being handed the power to rename the team, move it
 * between groups or change its badge colour.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const denied = denyUnlessOwnTeam(auth.user, params.id);
  if (denied) return denied;

  try {
    const body = await req.json();
    // Blank clears it. Stored as NULL so "no coach named" is distinguishable
    // from a coach whose name is the empty string.
    const coach = String(body.coach ?? "").trim().slice(0, 80) || null;

    const { rowCount } = await sql`
      UPDATE departments SET coach = ${coach} WHERE id = ${params.id}
    `;
    if (rowCount === 0) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const department = (await getDepartments()).find((d) => d.id === params.id);
    return NextResponse.json({ ok: true, department });
  } catch (err) {
    console.error("coach update failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not save the coach." }, { status: 500 });
  }
}
