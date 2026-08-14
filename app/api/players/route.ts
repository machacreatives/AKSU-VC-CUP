import { NextResponse } from "next/server";
import { getPlayersWithRatings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  // Ratings ride along with the squad — they are derived from matches, so a
  // bare getPlayers() would serve every player with no rating at all.
  const players = await getPlayersWithRatings();
  return NextResponse.json(players);
}
