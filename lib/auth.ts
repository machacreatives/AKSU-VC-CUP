// Session cookie handling. Uses Web Crypto, not node:crypto.
//
// middleware.ts imports this file and Next.js middleware runs on the Edge
// runtime, which has no Node built-ins. Web Crypto exists in both the Edge
// runtime and Node 18+, so one implementation serves the middleware and the
// route handlers. Its API is promise-based, hence everything here is async.
//
// Credentials themselves live in the admin_users table and are checked in the
// login route with scrypt (see lib/password.ts). This file only proves that a
// visitor already logged in, and as whom.

const COOKIE_NAME = "aksu_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const encoder = new TextEncoder();

export type SessionPayload = {
  sub: string; // admin_users.id
  username: string;
  exp: number; // epoch ms
};

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET env var is not set");
  return secret;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// base64url, so the payload survives a cookie value without escaping.
function encodePayload(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const b64 = btoa(String.fromCharCode(...encoder.encode(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    );
    const parsed = JSON.parse(json);
    if (typeof parsed?.sub !== "string" || typeof parsed?.exp !== "number") return null;
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

// Compare without an early exit, so timing doesn't reveal how much matched.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toHex(signature);
}

export async function createSessionToken(user: { id: string; username: string }): Promise<string> {
  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${await sign(encoded)}`;
}

// Returns the session if the signature is valid and it hasn't expired.
// Deliberately does not hit the database: this runs in middleware on every
// admin request, and a DB round-trip there would be paid on each one.
export async function readSessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  // Fail closed rather than throwing.
  //
  // This runs inside middleware on every admin request. An exception there is
  // not a redirect to the login page — it is MIDDLEWARE_INVOCATION_FAILED, a
  // 500 on the whole route, and it happens only once a browser is carrying a
  // cookie. A missing ADMIN_SESSION_SECRET therefore looked fine until the
  // moment someone had a session, and then locked the admin area entirely.
  // Treating an unverifiable token as "not signed in" sends them to the login
  // page, which explains the real problem.
  let expected: string;
  try {
    expected = await sign(encoded);
  } catch (err) {
    console.error("session verification failed:", err instanceof Error ? err.message : err);
    return null;
  }

  if (!timingSafeEqual(signature, expected)) return null;

  const payload = decodePayload(encoded);
  if (!payload || payload.exp <= Date.now()) return null;
  return payload;
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  return (await readSessionToken(token)) !== null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  // A `secure` cookie is dropped by the browser over plain http://localhost,
  // which would silently break login in development.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};

export { COOKIE_NAME, SESSION_TTL_MS };
