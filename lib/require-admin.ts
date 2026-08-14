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

export function isSuperadmin(user: AdminUser): boolean {
  return user.role === "SUPERADMIN";
}

/**
 * For anything that belongs to the tournament rather than to one team:
 * fixtures, groups, venues, man of the match, accounts, the schema.
 *
 * The role is read from the database row on every call, not from the session
 * cookie — the cookie lives for 12 hours, so a role baked into it would keep
 * working for half a day after the account was demoted.
 */
export async function requireSuperadmin(): Promise<
  { user: AdminUser; response?: never } | { user?: never; response: NextResponse }
> {
  const auth = await requireAdmin();
  if (auth.response) return auth;

  if (!isSuperadmin(auth.user)) {
    return {
      response: NextResponse.json(
        { error: "This is only available to a superadmin." },
        { status: 403 }
      ),
    };
  }
  return { user: auth.user };
}

/**
 * Guard for anything owned by a specific team. Returns a response to send, or
 * null to carry on.
 *
 * Deliberately a check the caller has to place rather than a wrapper: which
 * department a request belongs to differs per route — a body field on events, a
 * side resolved from the match on lineups, a URL segment on the bulk squad
 * import — so there is nothing uniform to hoist.
 */
export function denyUnlessOwnTeam(user: AdminUser, departmentId: string): NextResponse | null {
  if (isSuperadmin(user)) return null;
  if (user.departmentId && user.departmentId === departmentId) return null;
  return NextResponse.json(
    { error: "You can only make changes for your own team." },
    { status: 403 }
  );
}
