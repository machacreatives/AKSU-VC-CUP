import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { denyUnlessOwnTeam, requireAdmin } from "@/lib/require-admin";
import { getDepartments } from "@/lib/db/queries";
import {
  PLAYER_STATUSES,
  POSITIONS,
  PlayerPosition,
  PlayerStatus,
  SQUAD_ROLES,
  SquadRole,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_ROWS = 60;

type IncomingRow = {
  line?: number;
  name?: string;
  number?: string | number;
  position?: string;
  squadRole?: string;
  status?: string;
};

type RowError = { line: number; field: string; message: string };

// The import is all-or-nothing: the client has already shown a preview with
// every problem attached to its line, so a partial write would leave the admin
// diffing a half-loaded squad against their spreadsheet.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const dryRun = body.dryRun === true;
    const mode = body.mode === "replace" ? "replace" : "append";
    const rows: IncomingRow[] = Array.isArray(body.rows) ? body.rows : [];

    const team = (await getDepartments()).find((d) => d.id === params.id);
    if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });

    const denied = denyUnlessOwnTeam(auth.user, params.id);
    if (denied) return denied;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Nothing to import." }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `That is ${rows.length} rows. Import at most ${MAX_ROWS} at a time.` },
        { status: 400 }
      );
    }

    // Numbers already taken, unless the whole squad is being replaced.
    const { rows: existing } = await sql`
      SELECT id, name, number FROM players WHERE department_id = ${params.id}
    `;
    const taken = new Map<number, string>(
      mode === "replace" ? [] : existing.map((r) => [Number(r.number), String(r.name)])
    );

    const errors: RowError[] = [];
    const seenNumbers = new Map<number, number>();
    const roleCounts: Record<string, number> = { CAPTAIN: 0, VICE_CAPTAIN: 0 };
    const clean: {
      name: string;
      number: number;
      position: PlayerPosition;
      squadRole: SquadRole;
      status: PlayerStatus;
    }[] = [];

    rows.forEach((row, index) => {
      const line = row.line ?? index + 2;
      const name = String(row.name ?? "").trim();
      const numberRaw = String(row.number ?? "").trim();
      const number = Number(numberRaw);
      const position = String(row.position ?? "").trim().toUpperCase() as PlayerPosition;
      const squadRole = (String(row.squadRole ?? "").trim().toUpperCase() || "PLAYER") as SquadRole;
      const status = (String(row.status ?? "").trim().toUpperCase() || "ACTIVE") as PlayerStatus;

      if (!name) errors.push({ line, field: "name", message: "Name is required." });

      if (!numberRaw) {
        errors.push({ line, field: "number", message: "Shirt number is required." });
      } else if (!Number.isInteger(number) || number < 1 || number > 99) {
        errors.push({ line, field: "number", message: `"${numberRaw}" is not a number between 1 and 99.` });
      } else if (seenNumbers.has(number)) {
        errors.push({
          line,
          field: "number",
          message: `Shirt ${number} is also used on line ${seenNumbers.get(number)}.`,
        });
      } else if (taken.has(number)) {
        errors.push({
          line,
          field: "number",
          message: `Shirt ${number} already belongs to ${taken.get(number)}.`,
        });
      } else {
        seenNumbers.set(number, line);
      }

      if (!POSITIONS.includes(position)) {
        errors.push({
          line,
          field: "position",
          message: `"${row.position ?? ""}" is not a position. Use GK, DF, MF or FW.`,
        });
      }
      if (!SQUAD_ROLES.includes(squadRole)) {
        errors.push({
          line,
          field: "squadRole",
          message: `"${row.squadRole}" is not a role. Use captain, vice_captain or player.`,
        });
      } else if (squadRole !== "PLAYER") {
        roleCounts[squadRole]++;
      }
      if (!PLAYER_STATUSES.includes(status)) {
        errors.push({
          line,
          field: "status",
          message: `"${row.status}" is not a status. Use active, injured or suspended.`,
        });
      }

      clean.push({ name, number, position, squadRole, status });
    });

    // A squad has one captain, so a file naming two is a mistake worth catching
    // before it silently demotes one of them.
    for (const role of ["CAPTAIN", "VICE_CAPTAIN"] as const) {
      if (roleCounts[role] > 1) {
        errors.push({
          line: 0,
          field: "squadRole",
          message: `The file names ${roleCounts[role]} ${role === "CAPTAIN" ? "captains" : "vice-captains"}. A squad can have one.`,
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Some rows need attention.", rows: errors }, { status: 400 });
    }
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, ready: clean.length });
    }

    if (mode === "replace") {
      await sql`DELETE FROM players WHERE department_id = ${params.id}`;
    }

    // One multi-row INSERT: atomic on its own, so no explicit transaction is
    // needed with the HTTP-mode driver.
    await sql.query(
      `INSERT INTO players (id, name, number, position, department_id, squad_role, status)
       SELECT * FROM unnest(
         $1::text[], $2::text[], $3::int[], $4::text[], $5::text[], $6::text[], $7::text[]
       )`,
      [
        clean.map(() => crypto.randomUUID()),
        clean.map((r) => r.name),
        clean.map((r) => r.number),
        clean.map((r) => r.position),
        clean.map(() => params.id),
        clean.map((r) => r.squadRole),
        clean.map((r) => r.status),
      ]
    );

    return NextResponse.json({ ok: true, imported: clean.length, replaced: mode === "replace" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
