import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdmin } from "@/lib/require-admin";
import { getMatch, setMatchBench } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const MAX_BENCH = 12;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const match = await getMatch(params.id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });

    const body = await req.json();
    const side: "home" | "away" | null =
      body.side === "home" || body.side === "away" ? body.side : null;
    if (!side) return NextResponse.json({ error: "Side must be home or away." }, { status: 400 });

    if (!Array.isArray(body.playerIds)) {
      return NextResponse.json({ error: "Send the substitutes as a list." }, { status: 400 });
    }

    // Duplicates would show the same player twice in the coming-on picker.
    const playerIds: string[] = Array.from(
      new Set(body.playerIds.map((id: unknown) => String(id)))
    );
    if (playerIds.length > MAX_BENCH) {
      return NextResponse.json(
        { error: `A bench holds at most ${MAX_BENCH} players.` },
        { status: 400 }
      );
    }

    if (playerIds.length > 0) {
      // Every named substitute has to actually be in that team's squad —
      // otherwise a substitution can bring on someone else's player.
      const departmentId = match[side].departmentId;
      const { rows } = await sql.query(
        `SELECT id FROM players WHERE id = ANY($1::text[]) AND department_id = $2`,
        [playerIds, departmentId]
      );
      if (rows.length !== playerIds.length) {
        return NextResponse.json(
          { error: "One of those players is not in this team's squad." },
          { status: 400 }
        );
      }
    }

    await setMatchBench(params.id, side, playerIds);
    return NextResponse.json({ ok: true, match: await getMatch(params.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
