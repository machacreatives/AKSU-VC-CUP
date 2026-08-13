import { NextResponse } from "next/server";
import { upsertMatch, deleteMatch } from "@/lib/db/queries";
import { Match } from "@/lib/types";

export async function POST(req: Request) {
  const match = (await req.json()) as Match;
  await upsertMatch(match);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await deleteMatch(id);
  return NextResponse.json({ ok: true });
}
