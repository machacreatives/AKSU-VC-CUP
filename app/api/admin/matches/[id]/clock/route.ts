import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { denyUnlessOwnTeam, requireAdmin } from "@/lib/require-admin";
import { getMatch, lineupsReady } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

// Referee controls for the match clock.
//
// Every timestamp is written with Postgres `now()` rather than a time sent by
// the browser: the admin's device clock could be minutes off, and that error
// would show up on every viewer's screen. The database is the single source of
// truth for when a half started.

type Action =
  | "start-first-half"
  | "end-first-half"
  | "start-second-half"
  | "end-match"
  | "set-added-time"
  | "reset";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const action = body.action as Action;
    const id = params.id;

    // Either side's administrator may run the clock for a match they are in —
    // whoever is at the ground. Not for anybody else's match.
    const owned = await getMatch(id);
    if (!owned) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    const inThisMatch =
      denyUnlessOwnTeam(auth.user, owned.home.departmentId) === null ||
      denyUnlessOwnTeam(auth.user, owned.away.departmentId) === null;
    if (!inThisMatch) {
      return NextResponse.json(
        { error: "You can only run the clock for your own team's matches." },
        { status: 403 }
      );
    }

    switch (action) {
      case "start-first-half": {
        // No kickoff without a teamsheet. Enforced here and not only in the
        // dashboard, so a stale page cannot start a match that has no lineup —
        // and once it is running the public Lineups tab has something to show.
        const match = owned;
        if (!lineupsReady(match)) {
          const missing = [
            (match.home.startingXI?.length ?? 0) !== 11 ? "the home side" : "",
            (match.away.startingXI?.length ?? 0) !== 11 ? "the away side" : "",
          ].filter(Boolean);
          return NextResponse.json(
            {
              error: `Name the starting eleven for ${missing.join(" and ")} before kick-off. Set it under Teamsheets on the match page.`,
            },
            { status: 409 }
          );
        }

        await sql`
          UPDATE matches
          SET status = 'LIVE', first_half_started_at = now(),
              second_half_started_at = NULL, minute = NULL
          WHERE id = ${id}
        `;
        break;
      }

      case "end-first-half":
        // Keep first_half_started_at: it is the record of when the half ran,
        // and clearing it would make the second half impossible to distinguish
        // from a match that never kicked off.
        await sql`UPDATE matches SET status = 'HT' WHERE id = ${id}`;
        break;

      case "start-second-half":
        await sql`
          UPDATE matches
          SET status = 'LIVE', second_half_started_at = now()
          WHERE id = ${id}
        `;
        break;

      case "end-match":
        await sql`UPDATE matches SET status = 'FT' WHERE id = ${id}`;
        break;

      case "set-added-time": {
        const half = body.half === "second" ? "second" : "first";
        const minutes = Number(body.minutes);
        if (!Number.isFinite(minutes) || minutes < 0 || minutes > 30) {
          return NextResponse.json(
            { error: "Added time must be between 0 and 30 minutes." },
            { status: 400 }
          );
        }
        if (half === "first") {
          await sql`UPDATE matches SET first_half_added_minutes = ${minutes} WHERE id = ${id}`;
        } else {
          await sql`UPDATE matches SET second_half_added_minutes = ${minutes} WHERE id = ${id}`;
        }
        break;
      }

      case "reset":
        await sql`
          UPDATE matches
          SET status = 'UPCOMING', first_half_started_at = NULL,
              second_half_started_at = NULL, minute = NULL,
              first_half_added_minutes = 0, second_half_added_minutes = 0
          WHERE id = ${id}
        `;
        break;

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Return the updated match so the admin UI reflects server time straight
    // away instead of guessing what the write did.
    return NextResponse.json({ ok: true, match: await getMatch(id), serverNow: Date.now() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
