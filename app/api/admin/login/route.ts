import { NextResponse } from "next/server";
import { COOKIE_NAME, createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { getAdminUserByUsername, recordLogin } from "@/lib/db/users";
import { verifyPassword, wasteTimeLikeAVerify } from "@/lib/password";

export const dynamic = "force-dynamic";

// Crude in-process throttle. It is per serverless instance, not global, so it
// slows down a naive password guesser but is not a substitute for a real rate
// limiter (Vercel WAF, Upstash) if this is ever exposed to the open internet.
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

function clearAttempts(ip: string) {
  attempts.delete(ip);
}

export async function POST(req: Request) {
  try {
    return await handleLogin(req);
  } catch (err) {
    // Anything thrown here used to escape as a bare 500 with no body, which is
    // indistinguishable from a broken database. The one that actually bites is
    // a missing ADMIN_SESSION_SECRET: every step up to signing the cookie
    // succeeds, so a wrong password correctly returns 401 and only a *correct*
    // password fails — which reads like the password itself being rejected.
    const message = err instanceof Error ? err.message : String(err);
    console.error("admin login failed:", message);

    if (message.includes("ADMIN_SESSION_SECRET")) {
      return NextResponse.json(
        {
          error:
            "The server is missing its ADMIN_SESSION_SECRET setting, so it cannot issue a login session. Set it in the hosting environment and redeploy.",
        },
        { status: 500 }
      );
    }
    // Everything else is generic. This endpoint is unauthenticated, and a
    // driver error here would carry table names and the database hostname to
    // whoever posted the form. The detail is in the log above.
    return NextResponse.json(
      { error: "Could not sign in. Please try again." },
      { status: 500 }
    );
  }
}

async function handleLogin(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  if (tooManyAttempts(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  let username: unknown, password: unknown;
  try {
    ({ username, password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const user = await getAdminUserByUsername(username);

  // Same wording and comparable timing whether the account is missing or the
  // password is wrong, so neither reveals which accounts exist.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await wasteTimeLikeAVerify(password);

  if (!ok || !user) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  clearAttempts(ip);
  await recordLogin(user.id);

  const token = await createSessionToken(user);
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, displayName: user.displayName },
  });
  res.cookies.set(COOKIE_NAME, token, sessionCookieOptions);
  return res;
}
