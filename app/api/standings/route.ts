import { NextResponse } from "next/server";
import { getStandings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const standings = await getStandings();
  return NextResponse.json(standings);
}
