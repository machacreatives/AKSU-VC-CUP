import { NextResponse } from "next/server";
import { getGroups } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

// Public: the group tables on the home page are built from this, so it cannot
// sit behind the admin session the way venues do.
export async function GET() {
  try {
    return NextResponse.json(await getGroups());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
