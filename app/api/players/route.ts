import { NextResponse } from "next/server";
import { getPlayers } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const players = await getPlayers();
  return NextResponse.json(players);
}
