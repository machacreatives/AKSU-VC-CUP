import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, readSessionToken } from "@/lib/auth";
import { getAdminUserById, type AdminUser } from "@/lib/db/users";

// middleware.ts is the cheap first gate: it verifies the cookie's signature
// and expiry without touching the database, on every admin request.
//
// That alone is not enough. The session is stateless, so a cookie stays
// cryptographically valid until it expires even if the account behind it was
// deleted — a removed administrator would keep write access for up to 12
// hours. This confirms the account still exists before anything is written,
// which is one indexed lookup on actions that happen a few times a match.
export async function requireAdmin(): Promise<
  { user: AdminUser; response?: never } | { user?: never; response: NextResponse }
> {
  const session = await readSessionToken(cookies().get(COOKIE_NAME)?.value);
  if (!session) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await getAdminUserById(session.sub);
  if (!user) {
    // Account deleted since the cookie was issued — clear it on the way out.
    const response = NextResponse.json({ error: "Account no longer exists" }, { status: 401 });
    response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return { response };
  }

  return { user };
}
