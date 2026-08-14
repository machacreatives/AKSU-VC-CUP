import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/require-admin";
import { getMatch, resetMatch } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

// Full reset: score back to 0-0, clock cleared, every event removed and the
// players' goal/card totals rolled back with them. The fixture itself (teams,
// group, round, venue, kickoff) is kept, so the match can simply be played
// again — use DELETE /api/admin/matches to remove the fixture entirely.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    const existing = await getMatch(params.id);
    if (!existing) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    await resetMatch(params.id);
    return NextResponse.json({ ok: true, match: await getMatch(params.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
