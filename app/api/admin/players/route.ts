import { NextResponse } from "next/server";
import { upsertPlayer, deletePlayer } from "@/lib/db/queries";
import { Player } from "@/lib/types";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const player = (await req.json()) as Player;
  await upsertPlayer(player);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await req.json();
  await deletePlayer(id);
  return NextResponse.json({ ok: true });
}
