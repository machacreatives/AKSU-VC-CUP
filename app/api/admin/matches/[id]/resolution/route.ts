import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/require-admin";
import { getMatch, setTieResolution } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * How a knockout tie was decided: extra time, and the shoot-out if there was
 * one. Superadmin only — who goes through is a tournament decision, not one
 * either competing team should be able to record for itself.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    const match = await getMatch(params.id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });

    if (!match.stage || match.stage === "GROUP") {
      return NextResponse.json(
        { error: "Only a knockout tie is settled this way — a group match can end level." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const wentToExtraTime = body.wentToExtraTime === true;

    const raw = [body.homePenalties, body.awayPenalties];
    const cleared = raw.every((v) => v === null || v === undefined || v === "");
    let homePenalties: number | null = null;
    let awayPenalties: number | null = null;

    if (!cleared) {
      const [h, a] = raw.map((v) => Number(v));
      if (![h, a].every((n) => Number.isInteger(n) && n >= 0 && n <= 99)) {
        return NextResponse.json(
          { error: "Penalty scores must be whole numbers between 0 and 99." },
          { status: 400 }
        );
      }
      // A shoot-out that ends level has decided nothing.
      if (h === a) {
        return NextResponse.json(
          { error: "A shoot-out cannot end level — one side has to go through." },
          { status: 400 }
        );
      }
      homePenalties = h;
      awayPenalties = a;
    }

    // Penalties only mean anything when the match itself finished level.
    if (homePenalties !== null && match.home.score !== match.away.score) {
      return NextResponse.json(
        { error: "This tie was not level, so it was not decided on penalties." },
        { status: 400 }
      );
    }

    await setTieResolution(params.id, { wentToExtraTime, homePenalties, awayPenalties });
    return NextResponse.json({ ok: true, match: await getMatch(params.id) });
  } catch (err) {
    console.error("tie resolution failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not save how the tie was decided." }, { status: 500 });
  }
}
