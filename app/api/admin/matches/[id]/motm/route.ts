import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdmin } from "@/lib/require-admin";
import { getMatch, setManOfTheMatch } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const match = await getMatch(params.id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });

    const body = await req.json();

    // An empty value clears the award rather than being an error — changing
    // your mind should not need a different endpoint.
    const playerId = body.playerId ? String(body.playerId) : null;

    if (playerId) {
      // Must have played in this match, for one of these two teams. Awarding it
      // to somebody who was not on the pitch is the only way to get this wrong.
      const { rows } = await sql`
        SELECT id, name, department_id AS "departmentId" FROM players WHERE id = ${playerId}
      `;
      const player = rows[0];
      if (!player) return NextResponse.json({ error: "Unknown player." }, { status: 400 });

      const sides = [match.home, match.away];
      const side = sides.find((s) => s.departmentId === player.departmentId);
      if (!side) {
        return NextResponse.json(
          { error: `${player.name} did not play in this match.` },
          { status: 400 }
        );
      }

      const involved = [...(side.startingXI ?? []), ...(side.bench ?? [])];
      if (involved.length > 0 && !involved.includes(playerId)) {
        return NextResponse.json(
          { error: `${player.name} was not named in the teamsheet for this match.` },
          { status: 400 }
        );
      }
    }

    await setManOfTheMatch(params.id, playerId);
    return NextResponse.json({ ok: true, match: await getMatch(params.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
