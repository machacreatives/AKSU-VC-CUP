import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { requireAdmin } from "@/lib/require-admin";
import { deletePlayer, getDepartments, setSquadRole, upsertPlayer } from "@/lib/db/queries";
import {
  PLAYER_STATUSES,
  POSITIONS,
  PlayerPosition,
  PlayerProfile,
  PlayerStatus,
  SQUAD_ROLES,
  SquadRole,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();

    const isUpdate = typeof body.id === "string" && body.id.length > 0;
    let existing: PlayerProfile | null = null;
    if (isUpdate) {
      const { rows } = await sql`
        SELECT id, name, number, position, department_id AS "departmentId",
               squad_role AS "squadRole", status
        FROM players WHERE id = ${body.id}
      `;
      existing = (rows[0] as PlayerProfile) ?? null;
      if (!existing) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    const name = String(body.name ?? existing?.name ?? "").trim();
    const number = Number(body.number ?? existing?.number);
    const position = (body.position ?? existing?.position) as PlayerPosition;
    const departmentId = String(body.departmentId ?? existing?.departmentId ?? "");
    const squadRole = (body.squadRole ?? existing?.squadRole ?? "PLAYER") as SquadRole;
    const status = (body.status ?? existing?.status ?? "ACTIVE") as PlayerStatus;

    if (!name) return NextResponse.json({ error: "Player name is required." }, { status: 400 });
    if (!Number.isInteger(number) || number < 1 || number > 99) {
      return NextResponse.json({ error: "Shirt number must be between 1 and 99." }, { status: 400 });
    }
    if (!POSITIONS.includes(position)) {
      return NextResponse.json({ error: "Pick a position." }, { status: 400 });
    }
    if (!SQUAD_ROLES.includes(squadRole)) {
      return NextResponse.json({ error: "Invalid squad role." }, { status: 400 });
    }
    if (!PLAYER_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const departmentIds = new Set((await getDepartments()).map((d) => d.id));
    if (!departmentIds.has(departmentId)) {
      return NextResponse.json({ error: "Unknown team." }, { status: 400 });
    }

    // One shirt number per squad. Checked here so the admin gets a name rather
    // than a unique-index violation.
    const { rows: clash } = await sql`
      SELECT name FROM players
      WHERE department_id = ${departmentId} AND number = ${number} AND id <> ${body.id ?? ""}
    `;
    if (clash.length > 0) {
      return NextResponse.json(
        { error: `Shirt ${number} already belongs to ${clash[0].name}.` },
        { status: 409 }
      );
    }

    const player: PlayerProfile = {
      id: isUpdate ? body.id : crypto.randomUUID(),
      name,
      number,
      position,
      departmentId,
      // Written as PLAYER first, then promoted below so the incumbent is
      // demoted in the same request.
      squadRole: "PLAYER",
      status,
    };

    await upsertPlayer(player);
    if (squadRole !== "PLAYER") await setSquadRole(player.id, departmentId, squadRole);

    return NextResponse.json({ ok: true, player: { ...player, squadRole } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { id } = await req.json();
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Missing player id." }, { status: 400 });
    }
    await deletePlayer(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
