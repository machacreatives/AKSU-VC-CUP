import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { denyUnlessOwnTeam, requireAdmin } from "@/lib/require-admin";
import { getMatch } from "@/lib/db/queries";
import { scoreFromEvents } from "@/lib/ratings";
import { recordAudit } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

/**
 * Set the scoreline to what the recorded goals add up to.
 *
 * The score has two writers — typed directly, or moved by a goal event — and
 * nothing reconciled them. Deriving it automatically on every read would be
 * wrong: a result known before anyone was logging events is legitimate, and
 * silently zeroing it would destroy real data. So the two are allowed to
 * differ, the admin is *told* when they do, and this is the deliberate act
 * that makes the events win.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const match = await getMatch(params.id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });

    // Either side's admin can do this for their own match: it only ever makes
    // the scoreline agree with events they were already allowed to record.
    const inThisMatch =
      denyUnlessOwnTeam(auth.user, match.home.departmentId) === null ||
      denyUnlessOwnTeam(auth.user, match.away.departmentId) === null;
    if (!inThisMatch) {
      return NextResponse.json(
        { error: "You can only do this for your own team's matches." },
        { status: 403 }
      );
    }

    const derived = scoreFromEvents(match);
    await sql`
      UPDATE matches SET home_score = ${derived.home}, away_score = ${derived.away}
      WHERE id = ${params.id}
    `;

    // Overwrites a scoreline someone typed, so it records what it replaced.
    await recordAudit({
      actor: auth.user,
      action: "match.recalculate_score",
      targetType: "match",
      targetId: params.id,
      targetLabel: `${match.home.score}-${match.away.score} to ${derived.home}-${derived.away}`,
      detail: {
        from: { home: match.home.score, away: match.away.score },
        to: derived,
      },
    });

    return NextResponse.json({ ok: true, match: await getMatch(params.id), applied: derived });
  } catch (err) {
    console.error("recalculate score failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not recalculate the score." }, { status: 500 });
  }
}
