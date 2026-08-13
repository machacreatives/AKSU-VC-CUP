import crypto from "crypto";
import { promisify } from "util";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/password-policy";

// Password hashing with scrypt from Node's standard library.
//
// scrypt is deliberately slow and memory-hard, so a leaked `password_hash`
// column is expensive to attack offline. It's in node:crypto, so there is no
// dependency to install and no native module to fail on Vercel.
//
// Only ever called from route handlers, which run on the Node.js runtime.
// The Edge middleware never touches this file — it only verifies the signed
// session cookie, which uses Web Crypto.

const scrypt = promisify(crypto.scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

// OWASP's baseline scrypt parameters. N is the CPU/memory cost.
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function encode(salt: Buffer, key: Buffer): string {
  const { N, r, p } = PARAMS;
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return encode(salt, key);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");

  // Re-derive using the parameters the hash was created with, so old hashes
  // keep verifying if PARAMS is tuned upwards later.
  const actual = await scrypt(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// Used when no user matches the submitted username. Verifying against a real
// hash costs the same as a genuine check, so response time doesn't reveal
// whether an account exists.
let decoyHash: string | null = null;
export async function wasteTimeLikeAVerify(password: string): Promise<false> {
  if (!decoyHash) decoyHash = await hashPassword(crypto.randomBytes(16).toString("hex"));
  await verifyPassword(password, decoyHash);
  return false;
}

export { MIN_PASSWORD_LENGTH, validatePassword };
