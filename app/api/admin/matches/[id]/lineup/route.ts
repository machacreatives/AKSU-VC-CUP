import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireAdmin } from "@/lib/require-admin";
import { getMatch, lineupsLocked, setMatchLineup } from "@/lib/db/queries";
import { isValidFormation, rowsFromFormation } from "@/lib/formation";

export const dynamic = "force-dynamic";

const MAX_BENCH = 12;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const match = await getMatch(params.id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });

    // A teamsheet describes who started. Once the whistle has gone that is a
    // record, not a plan — editing it would rewrite who was on the pitch when
    // a goal was already scored.
    if (lineupsLocked(match)) {
      return NextResponse.json(
        {
          error:
            "This match has already kicked off, so the teamsheets are locked. Reset the clock first if it was started by mistake.",
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const side: "home" | "away" | null =
      body.side === "home" || body.side === "away" ? body.side : null;
    if (!side) return NextResponse.json({ error: "Side must be home or away." }, { status: 400 });

    const formation = String(body.formation ?? "").trim();
    if (!isValidFormation(formation)) {
      return NextResponse.json(
        { error: `"${formation}" is not a formation of ten outfield players.` },
        { status: 400 }
      );
    }

    const startingXI: string[] = Array.isArray(body.startingXI)
      ? body.startingXI.map((id: unknown) => String(id))
      : [];
    const bench: string[] = Array.isArray(body.bench)
      ? Array.from(new Set(body.bench.map((id: unknown) => String(id))))
      : [];

    // The XI is positional — index n is slot n on the pitch — so a short list
    // is not "ten players named", it is a formation with a hole in it.
    const slots = rowsFromFormation(formation).reduce((sum, n) => sum + n, 0);
    if (startingXI.length !== slots || startingXI.some((id) => !id)) {
      return NextResponse.json(
        {
          error: `Fill all ${slots} positions — ${
            startingXI.filter(Boolean).length
          } chosen so far.`,
        },
        { status: 400 }
      );
    }
    if (new Set(startingXI).size !== startingXI.length) {
      return NextResponse.json(
        { error: "The same player is named in two positions." },
        { status: 400 }
      );
    }

    const overlap = bench.filter((id) => startingXI.includes(id));
    if (overlap.length > 0) {
      return NextResponse.json(
        { error: "A player cannot start and be a substitute in the same match." },
        { status: 400 }
      );
    }
    if (bench.length > MAX_BENCH) {
      return NextResponse.json(
        { error: `A bench holds at most ${MAX_BENCH} players.` },
        { status: 400 }
      );
    }

    // Everyone named has to actually be in that team's squad, or a teamsheet
    // could field the other team's striker.
    const departmentId = match[side].departmentId;
    const everyone = Array.from(new Set([...startingXI, ...bench]));
    const { rows } = await sql.query(
      `SELECT id FROM players WHERE id = ANY($1::text[]) AND department_id = $2`,
      [everyone, departmentId]
    );
    if (rows.length !== everyone.length) {
      return NextResponse.json(
        { error: "One of those players is not in this team's squad." },
        { status: 400 }
      );
    }

    const captainId = body.captainId ? String(body.captainId) : null;
    if (captainId && !startingXI.includes(captainId)) {
      return NextResponse.json(
        { error: "The captain has to be one of the eleven starting." },
        { status: 400 }
      );
    }

    await setMatchLineup(params.id, side, { formation, startingXI, captainId, bench });
    return NextResponse.json({ ok: true, match: await getMatch(params.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
