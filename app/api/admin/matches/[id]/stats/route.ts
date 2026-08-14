import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getMatch, setMatchStats } from "@/lib/db/queries";
import { TeamMatchStats } from "@/lib/types";

export const dynamic = "force-dynamic";

const COUNTERS = ["shots", "shotsOnTarget", "corners", "fouls"] as const;

function readSide(raw: unknown, side: string): { stats?: TeamMatchStats; error?: string } {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object") return { error: `Invalid ${side} stats.` };

  const input = raw as Record<string, unknown>;
  const possession = Number(input.possession ?? 0);
  if (!Number.isFinite(possession) || possession < 0 || possession > 100) {
    return { error: `${side} possession must be between 0 and 100.` };
  }

  const stats = { possession: Math.round(possession) } as TeamMatchStats;
  for (const key of COUNTERS) {
    const value = Number(input[key] ?? 0);
    if (!Number.isInteger(value) || value < 0 || value > 999) {
      return { error: `${side} ${key} must be a whole number between 0 and 999.` };
    }
    stats[key] = value;
  }
  return { stats };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const match = await getMatch(params.id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });

    const body = await req.json();

    // `clear` removes both sides, which hides the public Stats tab again —
    // that tab only appears when both sides have stats.
    if (body.clear === true) {
      await setMatchStats(params.id, null, null);
      return NextResponse.json({ ok: true, match: await getMatch(params.id) });
    }

    const home = readSide(body.home, "Home");
    if (home.error) return NextResponse.json({ error: home.error }, { status: 400 });
    const away = readSide(body.away, "Away");
    if (away.error) return NextResponse.json({ error: away.error }, { status: 400 });

    if (home.stats && away.stats && home.stats.possession + away.stats.possession !== 100) {
      return NextResponse.json(
        { error: "Possession has to add up to 100% across both teams." },
        { status: 400 }
      );
    }

    await setMatchStats(params.id, home.stats ?? null, away.stats ?? null);
    return NextResponse.json({ ok: true, match: await getMatch(params.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
