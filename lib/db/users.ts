import { sql } from "@vercel/postgres";
import { unstable_noStore as noStore } from "next/cache";
import crypto from "crypto";
import { hashPassword } from "@/lib/password";

export type AdminUser = {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

type AdminUserWithHash = AdminUser & { passwordHash: string };

const SELECT_FIELDS = `id, username, display_name AS "displayName",
       created_at AS "createdAt", last_login_at AS "lastLoginAt"`;

export async function countAdminUsers(): Promise<number> {
  noStore();
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM admin_users`;
  return rows[0].n as number;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  noStore();
  const { rows } = await sql.query(
    `SELECT ${SELECT_FIELDS} FROM admin_users ORDER BY created_at`
  );
  return rows as AdminUser[];
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  noStore();
  const { rows } = await sql.query(`SELECT ${SELECT_FIELDS} FROM admin_users WHERE id = $1`, [id]);
  return (rows[0] as AdminUser) ?? null;
}

// Usernames are compared case-insensitively so "Admin" and "admin" are the
// same account, which is what people expect when they mistype a capital.
export async function getAdminUserByUsername(
  username: string
): Promise<AdminUserWithHash | null> {
  noStore();
  const { rows } = await sql.query(
    `SELECT ${SELECT_FIELDS}, password_hash AS "passwordHash"
     FROM admin_users WHERE LOWER(username) = LOWER($1)`,
    [username]
  );
  return (rows[0] as AdminUserWithHash) ?? null;
}

export async function createAdminUser(
  username: string,
  password: string,
  displayName?: string
): Promise<AdminUser> {
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const { rows } = await sql.query(
    `INSERT INTO admin_users (id, username, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SELECT_FIELDS}`,
    [id, username.trim(), passwordHash, displayName?.trim() || null]
  );
  return rows[0] as AdminUser;
}

export async function setAdminPassword(id: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await sql`UPDATE admin_users SET password_hash = ${passwordHash} WHERE id = ${id}`;
}

export async function deleteAdminUser(id: string): Promise<void> {
  await sql`DELETE FROM admin_users WHERE id = ${id}`;
}

export async function recordLogin(id: string): Promise<void> {
  await sql`UPDATE admin_users SET last_login_at = now() WHERE id = ${id}`;
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}
