import { sql } from "@vercel/postgres";
import { unstable_noStore as noStore } from "next/cache";
import crypto from "crypto";
import { hashPassword } from "@/lib/password";
import type { AdminRole } from "@/lib/types";

export type { AdminRole };

export type AdminUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: AdminRole;
  /** The team a TEAM_ADMIN belongs to. Always null for a SUPERADMIN. */
  departmentId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

type AdminUserWithHash = AdminUser & { passwordHash: string };

const SELECT_FIELDS = `id, username, display_name AS "displayName",
       role, department_id AS "departmentId",
       created_at AS "createdAt", last_login_at AS "lastLoginAt"`;

export async function countAdminUsers(): Promise<number> {
  noStore();
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM admin_users`;
  return rows[0].n as number;
}

/**
 * Whether first-run setup is still open.
 *
 * Tolerates the table not existing, so the answer can be given without
 * migrating the database first. That matters: the setup GET used to run the
 * whole schema on every anonymous request just to be able to count rows.
 */
export async function needsSetup(): Promise<boolean> {
  noStore();
  try {
    return (await countAdminUsers()) === 0;
  } catch (err) {
    // 42P01 undefined_table — a database that has never been migrated, which
    // is exactly the state setup exists to resolve.
    if ((err as { code?: string }).code === "42P01") return true;
    throw err;
  }
}

/**
 * Create the very first administrator, atomically.
 *
 * `INSERT ... WHERE NOT EXISTS` rather than count-then-insert: those were two
 * statements with no transaction, so two concurrent setup requests could both
 * read an empty table and both mint a superadmin. Returns null when an account
 * already existed, which the caller reports as "setup is closed".
 */
export async function createFirstAdminUser(
  username: string,
  password: string,
  displayName?: string
): Promise<AdminUser | null> {
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const { rows } = await sql.query(
    `INSERT INTO admin_users (id, username, password_hash, display_name, role, department_id)
     SELECT $1, $2, $3, $4, 'SUPERADMIN', NULL
     WHERE NOT EXISTS (SELECT 1 FROM admin_users)
     RETURNING ${SELECT_FIELDS}`,
    [id, username.trim(), passwordHash, displayName?.trim() || null]
  );
  return (rows[0] as AdminUser) ?? null;
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
     FROM admin_users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [username]
  );
  return (rows[0] as AdminUserWithHash) ?? null;
}

export async function createAdminUser(
  username: string,
  password: string,
  displayName?: string,
  role: AdminRole = "SUPERADMIN",
  departmentId: string | null = null
): Promise<AdminUser> {
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const { rows } = await sql.query(
    `INSERT INTO admin_users (id, username, password_hash, display_name, role, department_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${SELECT_FIELDS}`,
    [
      id,
      username.trim(),
      passwordHash,
      displayName?.trim() || null,
      role,
      role === "TEAM_ADMIN" ? departmentId : null,
    ]
  );
  return rows[0] as AdminUser;
}

/**
 * Change an account's role, team or display name.
 *
 * Clearing department_id when promoting to SUPERADMIN is not tidiness — the
 * CHECK constraint allows a team on a superadmin, and leaving one behind would
 * make "which team is this account scoped to" ambiguous for anything reading
 * the row later.
 */
export async function updateAdminUser(
  id: string,
  patch: { role: AdminRole; departmentId: string | null; displayName?: string | null }
): Promise<AdminUser | null> {
  const { rows } = await sql.query(
    `UPDATE admin_users
     SET role = $2,
         department_id = $3,
         display_name = COALESCE($4, display_name)
     WHERE id = $1
     RETURNING ${SELECT_FIELDS}`,
    [
      id,
      patch.role,
      patch.role === "TEAM_ADMIN" ? patch.departmentId : null,
      patch.displayName === undefined ? null : patch.displayName,
    ]
  );
  return (rows[0] as AdminUser) ?? null;
}

/**
 * How many superadmins exist. The tournament needs at least one at all times:
 * an instance with only team admins has nobody who can create a fixture,
 * manage groups, or make somebody a superadmin again.
 */
export async function countSuperadmins(): Promise<number> {
  noStore();
  const { rows } = await sql`
    SELECT COUNT(*)::int AS n FROM admin_users WHERE role = 'SUPERADMIN'
  `;
  return rows[0].n as number;
}

/** Team ids that already have an administrator, for the Teams page marker. */
export async function departmentsWithAdmins(): Promise<string[]> {
  noStore();
  const { rows } = await sql`
    SELECT DISTINCT department_id FROM admin_users WHERE department_id IS NOT NULL
  `;
  return rows.map((r) => r.department_id as string);
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
