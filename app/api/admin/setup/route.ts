import { NextResponse } from "next/server";
import { COOKIE_NAME, createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { runSchema } from "@/lib/db/schema";
import { countAdminUsers, createAdminUser, isUniqueViolation } from "@/lib/db/users";
import { validatePassword } from "@/lib/password";

export const dynamic = "force-dynamic";

// Creating the tables normally requires a session, but on a brand-new database
// there is no account to sign in with and no admin_users table to create one
// in. Setup breaks that deadlock by ensuring the schema itself. Every
// statement is CREATE ... IF NOT EXISTS, so it never touches existing data.
async function ensureSchema() {
  await runSchema();
}

// First-run bootstrap. Creates the very first administrator, and only while
// the admin_users table is empty — once an account exists this endpoint is
// closed for good, so it cannot be used to mint extra accounts later. That is
// what makes it safe to leave unauthenticated in middleware.ts.

export async function GET() {
  try {
    await ensureSchema();
    return NextResponse.json({ needsSetup: (await countAdminUsers()) === 0 });
  } catch (err) {
    return NextResponse.json(
      { needsSetup: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureSchema();

    if ((await countAdminUsers()) > 0) {
      return NextResponse.json(
        { error: "Setup has already been completed. Sign in instead." },
        { status: 409 }
      );
    }

    const { username, password, displayName } = await req.json();

    if (typeof username !== "string" || username.trim().length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters." },
        { status: 400 }
      );
    }
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const user = await createAdminUser(username, password, displayName);

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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
