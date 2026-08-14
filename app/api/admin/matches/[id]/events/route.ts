import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { denyUnlessOwnTeam, requireAdmin } from "@/lib/require-admin";
import { addMatchEvent, deleteMatchEvent, getMatch } from "@/lib/db/queries";
import { GOAL_TYPES, GoalType, MatchEventType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPES: MatchEventType[] = ["GOAL", "YELLOW", "RED", "SUB"];

type SquadMember = { id: string; name: string; departmentId: string };

async function findPlayer(id: string): Promise<SquadMember | null> {
  const { rows } = await sql`
    SELECT id, name, department_id AS "departmentId" FROM players WHERE id = ${id}
  `;
  return (rows[0] as SquadMember) ?? null;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const match = await getMatch(params.id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });

    const body = await req.json();
    const type = body.type as MatchEventType;
    const minute = Number(body.minute);
    const departmentId = String(body.departmentId ?? "");

    if (!TYPES.includes(type)) {
      return NextResponse.json({ error: "Pick an event type." }, { status: 400 });
    }
    // Stoppage time in a long second half can run past 90, so allow headroom.
    if (!Number.isInteger(minute) || minute < 0 || minute > 130) {
      return NextResponse.json({ error: "Minute must be between 0 and 130." }, { status: 400 });
    }
    // Previously unchecked: an event could be filed against a team that was
    // not even playing in this match.
    if (departmentId !== match.home.departmentId && departmentId !== match.away.departmentId) {
      return NextResponse.json({ error: "That team is not in this match." }, { status: 400 });
    }
    // A team admin records their own team's events and nobody else's.
    const denied = denyUnlessOwnTeam(auth.user, departmentId);
    if (denied) return denied;

    const player = body.playerId ? await findPlayer(String(body.playerId)) : null;
    if (!player) {
      return NextResponse.json({ error: "Pick the player from the squad." }, { status: 400 });
    }
    if (player.departmentId !== departmentId) {
      return NextResponse.json(
        { error: `${player.name} does not play for that team.` },
        { status: 400 }
      );
    }

    let assist: SquadMember | null = null;
    if (body.assistPlayerId) {
      if (type !== "GOAL") {
        return NextResponse.json({ error: "Only a goal can have an assist." }, { status: 400 });
      }
      assist = await findPlayer(String(body.assistPlayerId));
      if (!assist) return NextResponse.json({ error: "Unknown assisting player." }, { status: 400 });
      if (assist.id === player.id) {
        return NextResponse.json({ error: "A player cannot assist their own goal." }, { status: 400 });
      }
      if (assist.departmentId !== departmentId) {
        return NextResponse.json(
          { error: `${assist.name} is not on the same team as the scorer.` },
          { status: 400 }
        );
      }
    }

    // A substitution is one event describing two players: `playerId` goes off
    // and this one comes on. Recorded together so the timeline reads as a
    // single change rather than two unrelated lines.
    let subIn: SquadMember | null = null;
    if (body.subInPlayerId) {
      if (type !== "SUB") {
        return NextResponse.json(
          { error: "Only a substitution names a player coming on." },
          { status: 400 }
        );
      }
      subIn = await findPlayer(String(body.subInPlayerId));
      if (!subIn) return NextResponse.json({ error: "Unknown substitute." }, { status: 400 });
      if (subIn.id === player.id) {
        return NextResponse.json(
          { error: "A player cannot be substituted for themselves." },
          { status: 400 }
        );
      }
      if (subIn.departmentId !== departmentId) {
        return NextResponse.json(
          { error: `${subIn.name} does not play for that team.` },
          { status: 400 }
        );
      }

      // Only a named substitute can come on. Enforced here and not just in the
      // form, so the rule survives a stale page or a direct API call.
      const side = departmentId === match.home.departmentId ? match.home : match.away;
      const bench = side.bench ?? [];
      if (!bench.includes(subIn.id)) {
        return NextResponse.json(
          {
            error: `${subIn.name} is not on the bench for this match. Name them under Substitutes first.`,
          },
          { status: 400 }
        );
      }
      // Bound to a const: TypeScript drops the narrowing on a `let` once it is
      // read inside a closure.
      const incoming = subIn;
      if (match.events.some((e) => e.type === "SUB" && e.subInPlayerId === incoming.id)) {
        return NextResponse.json(
          { error: `${incoming.name} has already come on in this match.` },
          { status: 400 }
        );
      }
    }
    if (type === "SUB" && !subIn) {
      return NextResponse.json({ error: "Pick the player coming on." }, { status: 400 });
    }

    // How the goal was scored, so the lineup graphic can mark a penalty and a
    // free kick differently. Defaults to open play rather than being required.
    let goalType: GoalType | undefined;
    if (body.goalType) {
      if (type !== "GOAL") {
        return NextResponse.json({ error: "Only a goal has a goal type." }, { status: 400 });
      }
      if (!GOAL_TYPES.includes(body.goalType)) {
        return NextResponse.json({ error: "Unknown goal type." }, { status: 400 });
      }
      goalType = body.goalType as GoalType;
    } else if (type === "GOAL") {
      goalType = "OPEN_PLAY";
    }

    await addMatchEvent(params.id, {
      minute,
      type,
      departmentId,
      playerId: player.id,
      playerName: player.name,
      assistPlayerId: assist?.id,
      assistPlayerName: assist?.name,
      subInPlayerId: subIn?.id,
      subInPlayerName: subIn?.name,
      goalType,
      detail: body.detail ? String(body.detail).trim() : undefined,
    });

    return NextResponse.json({ ok: true, match: await getMatch(params.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { eventId } = await req.json();
    if (!Number.isInteger(eventId)) {
      return NextResponse.json({ error: "Missing event id." }, { status: 400 });
    }

    // This used to delete whatever id it was handed, without checking the event
    // belonged to this match at all — so any event in the tournament could be
    // removed through any match's URL. Resolve it first, then check both that
    // it is in this match and that it belongs to the caller's team.
    const match = await getMatch(params.id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });

    const event = match.events.find((e) => e.id === eventId);
    if (!event) {
      return NextResponse.json({ error: "That event is not in this match." }, { status: 404 });
    }
    const denied = denyUnlessOwnTeam(auth.user, event.departmentId);
    if (denied) return denied;

    await deleteMatchEvent(eventId);
    return NextResponse.json({ ok: true, match: await getMatch(params.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
