import { NextResponse } from "next/server";
import { isSuperadmin, requireAdmin } from "@/lib/require-admin";
import { getMatch, setMatchStats } from "@/lib/db/queries";
import { TeamMatchStats } from "@/lib/types";

export const dynamic = "force-dynamic";

const COUNTERS = ["shots", "shotsOnTarget", "corners", "fouls"] as const;

/** Used when a side has no stored possession yet and a team admin saves first. */
const DEFAULT_POSSESSION = 50;

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
    const superadmin = isSuperadmin(auth.user);

    // Which side, if any, the caller owns. A team admin may only touch theirs.
    const ownSide: "home" | "away" | null = superadmin
      ? null
      : auth.user.departmentId === match.home.departmentId
      ? "home"
      : auth.user.departmentId === match.away.departmentId
      ? "away"
      : null;

    if (!superadmin && !ownSide) {
      return NextResponse.json(
        { error: "You can only record stats for your own team's matches." },
        { status: 403 }
      );
    }

    // `clear` removes both sides, which hides the public Stats tab again —
    // that tab only appears when both sides have stats. Clearing the opponent's
    // work is not a team admin's to do.
    if (body.clear === true) {
      if (!superadmin) {
        return NextResponse.json(
          { error: "Only a superadmin can clear the stats for a match." },
          { status: 403 }
        );
      }
      await setMatchStats(params.id, null, null);
      return NextResponse.json({ ok: true, match: await getMatch(params.id) });
    }

    const home = readSide(body.home, "Home");
    if (home.error) return NextResponse.json({ error: home.error }, { status: 400 });
    const away = readSide(body.away, "Away");
    if (away.error) return NextResponse.json({ error: away.error }, { status: 400 });

    let nextHome = home.stats ?? null;
    let nextAway = away.stats ?? null;

    if (superadmin) {
      if (nextHome && nextAway && nextHome.possession + nextAway.possession !== 100) {
        return NextResponse.json(
          { error: "Possession has to add up to 100% across both teams." },
          { status: 400 }
        );
      }
    } else if (ownSide) {
      // A team admin's write merges into what is stored rather than replacing
      // it. Sending one side used to NULL the other, so a team recording its
      // own shots wiped the opponent's entire panel.
      const incoming = ownSide === "home" ? nextHome : nextAway;
      if (!incoming) {
        return NextResponse.json(
          { error: `Send your own side's stats as "${ownSide}".` },
          { status: 400 }
        );
      }

      const storedOwn = match[ownSide].stats;
      const storedOther = match[ownSide === "home" ? "away" : "home"].stats ?? null;

      // Possession is one number shared by both teams, so setting half of it
      // silently rewrites the opponent's half. Keep whatever is stored.
      const merged: TeamMatchStats = {
        ...incoming,
        possession: storedOwn?.possession ?? DEFAULT_POSSESSION,
      };

      nextHome = ownSide === "home" ? merged : storedOther;
      nextAway = ownSide === "away" ? merged : storedOther;
    }

    await setMatchStats(params.id, nextHome, nextAway);
    return NextResponse.json({ ok: true, match: await getMatch(params.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
