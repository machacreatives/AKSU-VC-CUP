import { NextResponse } from "next/server";
import { COOKIE_NAME, createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { runSchema } from "@/lib/db/schema";
import { createFirstAdminUser, isUniqueViolation, needsSetup } from "@/lib/db/users";
import { validatePassword } from "@/lib/password";

export const dynamic = "force-dynamic";

// First-run bootstrap. Creates the very first administrator, and only while
// the admin_users table is empty — once an account exists this endpoint is
// closed for good, so it cannot be used to mint extra accounts later. That is
// what makes it safe to leave unauthenticated in middleware.ts.

/**
 * Is setup still open?
 *
 * A pure read. This used to call runSchema() first, which meant every
 * anonymous GET replayed ~50 DDL statements against production — one request
 * became fifty database round trips with no rate limit in front of it, and the
 * replay includes DROP CONSTRAINT / ADD CONSTRAINT pairs, so the role and team
 * constraints were momentarily absent on a live table at the say-so of anyone
 * who could reach the URL.
 *
 * needsSetup() tolerates the table not existing, so a never-migrated database
 * still answers correctly without being migrated by a GET.
 */
export async function GET() {
  try {
    return NextResponse.json({ needsSetup: await needsSetup() });
  } catch {
    // Deliberately no detail: this endpoint is unauthenticated, and the driver
    // message carries table names and the database hostname.
    return NextResponse.json(
      { needsSetup: false, error: "Could not reach the database." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // Check before migrating. On an established instance this returns
    // immediately and the schema is never touched; the replay is confined to
    // the one case that genuinely needs it — bootstrapping an empty database,
    // where there is no account to authenticate as yet.
    if (!(await needsSetup())) {
      return NextResponse.json(
        { error: "Setup has already been completed. Sign in instead." },
        { status: 409 }
      );
    }

    await runSchema();

    const { username, password, displayName } = await req.json();

    if (typeof username !== "string" || username.trim().length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters." },
        { status: 400 }
      );
    }
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    // Atomic: two concurrent setup requests cannot both mint a superadmin.
    const user = await createFirstAdminUser(username, password, displayName);
    if (!user) {
      return NextResponse.json(
        { error: "Setup has already been completed. Sign in instead." },
        { status: 409 }
      );
    }

    // Sign the new administrator straight in — they just proved who they are
    // by creating the account.
    const token = await createSessionToken(user);
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions);
    return res;
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    console.error("setup failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not complete setup." }, { status: 500 });
  }
}
