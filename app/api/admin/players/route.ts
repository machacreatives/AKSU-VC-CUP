import { NextResponse } from "next/server";
import { upsertPlayer, deletePlayer } from "@/lib/db/queries";
import { Player } from "@/lib/types";

export async function POST(req: Request) {
  const player = (await req.json()) as Player;
  await upsertPlayer(player);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await deletePlayer(id);
  return NextResponse.json({ ok: true });
}
