import { NextResponse } from "next/server";
import { upsertMatch, deleteMatch } from "@/lib/db/queries";
import { Match } from "@/lib/types";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const match = (await req.json()) as Match;
  await upsertMatch(match);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await req.json();
  await deleteMatch(id);
  return NextResponse.json({ ok: true });
}
