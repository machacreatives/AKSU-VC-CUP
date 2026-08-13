// Uses Web Crypto, not node:crypto.
//
// middleware.ts imports this file, and Next.js middleware runs on the Edge
// runtime, which has no Node built-ins. The previous node:crypto version threw
// "The edge runtime does not support Node.js 'crypto' module" on every request
// that carried a session cookie — i.e. every admin page load after logging in.
// Web Crypto is available in both the Edge runtime and Node 18+, so one
// implementation serves the middleware and the route handlers. Its API is
// promise-based, which is why everything here is async.

const COOKIE_NAME = "aksu_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const encoder = new TextEncoder();

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

// Compare fixed-length digests without an early exit, so the time taken
// doesn't reveal how much of the value matched.
function timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder.encode(value));
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(signature);
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const validUser = process.env.ADMIN_USERNAME ?? "";
  const validPass = process.env.ADMIN_PASSWORD ?? "";
  // Without configured credentials the old code let empty strings through.
  if (!validUser || !validPass) return false;

  // Hashing first keeps the comparison constant-time for any input length.
  const [u, expectedU, p, expectedP] = await Promise.all([
    sha256(username),
    sha256(validUser),
    sha256(password),
    sha256(validPass),
  ]);
  return timingSafeEqual(u, expectedU) && timingSafeEqual(p, expectedP);
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${expires}`;
  return `${payload}.${await sign(payload)}`;
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = await sign(payload);
  if (!timingSafeEqual(encoder.encode(signature).buffer, encoder.encode(expected).buffer)) {
    return false;
  }
  return Number(payload) > Date.now();
}

export { COOKIE_NAME, SESSION_TTL_MS };
