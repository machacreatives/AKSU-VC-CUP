import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

// Who is signed in, and what they are allowed to do. The admin area is entirely
// client components reading through React Query, and middleware cannot check a
// role without a database round-trip on the Edge — so the UI asks here.
//
// This is not the security boundary. Every restriction is enforced again in the
// route that performs the write; this only stops the interface offering a
// control that would come back 403.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id, username, displayName, role, departmentId } = auth.user;
  return NextResponse.json({ id, username, displayName, role, departmentId });
}
