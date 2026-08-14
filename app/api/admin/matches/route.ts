import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/require-admin";
import { deleteMatch, getDepartments, getMatch, upsertMatch } from "@/lib/db/queries";
import { GroupId, Match, MatchStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const GROUPS: GroupId[] = ["A", "B", "C", "D"];
const STATUSES: MatchStatus[] = ["UPCOMING", "LIVE", "HT", "FT"];

// POST creates a fixture when no `id` is supplied, and updates one when there
// is. Previously this cast the request body straight to Match and wrote it,
// which meant a malformed payload became a malformed row.
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();

    const isUpdate = typeof body.id === "string" && body.id.length > 0;
    const existing = isUpdate ? await getMatch(body.id) : null;
    if (isUpdate && !existing) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // On update, fall back to the stored values so a partial payload cannot
    // blank out fields it never mentioned.
    const homeDepartmentId = body.home?.departmentId ?? existing?.home.departmentId;
    const awayDepartmentId = body.away?.departmentId ?? existing?.away.departmentId;

    if (typeof homeDepartmentId !== "string" || typeof awayDepartmentId !== "string") {
      return NextResponse.json({ error: "Both teams are required." }, { status: 400 });
    }
    if (homeDepartmentId === awayDepartmentId) {
      return NextResponse.json({ error: "A team cannot play itself." }, { status: 400 });
    }

    const departmentIds = new Set((await getDepartments()).map((d) => d.id));
    for (const id of [homeDepartmentId, awayDepartmentId]) {
      if (!departmentIds.has(id)) {
        return NextResponse.json({ error: `Unknown department: ${id}` }, { status: 400 });
      }
    }

    const group = (body.group ?? existing?.group) as GroupId;
    if (!GROUPS.includes(group)) {
      return NextResponse.json({ error: "Group must be A, B, C or D." }, { status: 400 });
    }

    const status = (body.status ?? existing?.status ?? "UPCOMING") as MatchStatus;
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid match status." }, { status: 400 });
    }

    const match: Match = {
      id: isUpdate ? body.id : crypto.randomUUID(),
      status,
      minute: body.minute ?? existing?.minute,
      // The clock columns are owned by the clock endpoint; carry the stored
      // values through so an ordinary save cannot wipe a running match.
      firstHalfStartedAt: existing?.firstHalfStartedAt ?? null,
      secondHalfStartedAt: existing?.secondHalfStartedAt ?? null,
      firstHalfAddedMinutes: existing?.firstHalfAddedMinutes ?? 0,
      secondHalfAddedMinutes: existing?.secondHalfAddedMinutes ?? 0,
      kickoff: (body.kickoff ?? existing?.kickoff ?? "TBC").toString().trim() || "TBC",
      round: (body.round ?? existing?.round ?? "").toString().trim(),
      group,
      venue: (body.venue ?? existing?.venue ?? "").toString().trim(),
      home: {
        ...(existing?.home ?? {}),
        departmentId: homeDepartmentId,
        score: Number(body.home?.score ?? existing?.home.score ?? 0),
      },
      away: {
        ...(existing?.away ?? {}),
        departmentId: awayDepartmentId,
        score: Number(body.away?.score ?? existing?.away.score ?? 0),
      },
      events: [],
    };

    if (!match.round) {
      return NextResponse.json({ error: "Round is required (e.g. Matchday 1)." }, { status: 400 });
    }
    if (!match.venue) {
      return NextResponse.json({ error: "Venue is required." }, { status: 400 });
    }

    await upsertMatch(match);
    return NextResponse.json({ ok: true, match: await getMatch(match.id) });
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
    if (typeof id !== "string") {
      return NextResponse.json({ error: "Missing match id" }, { status: 400 });
    }
    await deleteMatch(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
