import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/require-admin";
import { getAuditLog } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

/**
 * The log, newest first. Superadmin only.
 *
 * A team administrator reading it would learn every other team's private
 * squad changes, and — more to the point — the log exists to hold
 * administrators accountable, so it cannot be readable by everyone it holds
 * accountable.
 */
export async function GET(req: Request) {
  const auth = await requireSuperadmin();
  if (auth.response) return auth.response;

  try {
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 100);
    return NextResponse.json({ entries: await getAuditLog(limit) });
  } catch (err) {
    console.error("audit read failed:", err instanceof Error ? err.message : err);
    // The table may not exist yet on a database that predates it. An empty log
    // reads better than an error box on a page that is otherwise fine.
    return NextResponse.json({ entries: [], unavailable: true });
  }
}
