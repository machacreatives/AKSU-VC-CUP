import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { unstable_noStore as noStore } from "next/cache";
import type { AdminUser } from "@/lib/db/users";

/**
 * The administrative actions worth a permanent record.
 *
 * Deliberately not every write. A goal typed in and corrected ten seconds later
 * is ordinary work, and a log that records all of it buries the one line
 * someone is actually looking for. What is here is the destructive set: things
 * that remove data or change who can reach the dashboard, where the question
 * afterwards is "who did that, and when".
 */
export type AuditAction =
  | "match.delete"
  | "match.reset"
  | "match.recalculate_score"
  | "event.delete"
  | "player.delete"
  | "squad.bulk_replace"
  | "department.delete"
  | "department.bulk_import"
  | "group.delete"
  | "venue.delete"
  | "user.create"
  | "user.delete"
  | "user.role_change"
  | "user.password_reset"
  | "schema.run"
  | "database.reset";

export type AuditTargetType =
  | "match"
  | "event"
  | "player"
  | "department"
  | "group"
  | "venue"
  | "user"
  | "system";

export type AuditEntry = {
  id: string;
  actorId: string | null;
  actorUsername: string;
  actorRole: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string | null;
  targetLabel: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
};

/**
 * Write one line to the log.
 *
 * Never throws. A failure to record an action must not fail the action itself:
 * refusing to delete a match because the log was unreachable would turn an
 * accountability feature into an outage, and the alternative — a swallowed
 * error and a console line — leaves the actual work done.
 *
 * That means the log is best-effort by design, not by accident.
 */
export async function recordAudit(input: {
  actor: Pick<AdminUser, "id" | "username" | "role">;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  targetLabel?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO admin_audit_log
        (id, actor_id, actor_username, actor_role, action, target_type, target_id, target_label, detail)
      VALUES (
        ${crypto.randomUUID()},
        ${input.actor.id},
        ${input.actor.username},
        ${input.actor.role},
        ${input.action},
        ${input.targetType},
        ${input.targetId ?? null},
        ${input.targetLabel ?? null},
        ${JSON.stringify(input.detail ?? {})}::jsonb
      )`;
  } catch (err) {
    console.error(
      `audit: could not record ${input.action}:`,
      err instanceof Error ? err.message : err
    );
  }
}

/** Newest first. Capped so one query cannot pull an unbounded table. */
export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  noStore();
  const capped = Math.min(Math.max(Math.trunc(limit) || 0, 1), 500);
  const { rows } = await sql`
    SELECT id,
           actor_id AS "actorId",
           actor_username AS "actorUsername",
           actor_role AS "actorRole",
           action,
           target_type AS "targetType",
           target_id AS "targetId",
           target_label AS "targetLabel",
           detail,
           created_at AS "createdAt"
    FROM admin_audit_log
    ORDER BY created_at DESC, id DESC
    LIMIT ${capped}`;
  return rows as AuditEntry[];
}
