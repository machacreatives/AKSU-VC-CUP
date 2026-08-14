"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { AuditEntry } from "@/lib/db/audit";
import { AdminRole, ROLE_LABELS } from "@/lib/types";
import { btnOutline, btnSm, EmptyState } from "./ui";

/**
 * Every recorded action reads as one sentence.
 *
 * A raw dotted action name plus a uuid is a log only its author can read. The
 * point of this screen is that the tournament organiser — not a developer —
 * can answer "who reset the semi-final", so each line is written out in words.
 */
const PHRASING: Record<string, { verb: string; tone: "danger" | "warn" | "plain" }> = {
  "match.delete": { verb: "deleted the fixture", tone: "danger" },
  "match.reset": { verb: "reset the match", tone: "danger" },
  "match.recalculate_score": { verb: "recalculated the score of", tone: "warn" },
  "event.delete": { verb: "removed the event", tone: "warn" },
  "player.delete": { verb: "removed the player", tone: "warn" },
  "squad.bulk_replace": { verb: "replaced the whole squad of", tone: "danger" },
  "department.delete": { verb: "deleted the team", tone: "danger" },
  "department.bulk_import": { verb: "imported", tone: "plain" },
  "group.delete": { verb: "deleted the group", tone: "danger" },
  "venue.delete": { verb: "deleted the venue", tone: "warn" },
  "user.create": { verb: "created the account", tone: "plain" },
  "user.delete": { verb: "deleted the account", tone: "danger" },
  "user.role_change": { verb: "changed the permissions of", tone: "danger" },
  "user.password_reset": { verb: "changed the password of", tone: "warn" },
  "schema.run": { verb: "updated", tone: "plain" },
  "database.reset": { verb: "reset", tone: "danger" },
};

const TONE_CLASS = {
  danger: "border-loss/40 bg-loss/10 text-loss",
  warn: "border-gold/40 bg-gold/10 text-gold",
  plain: "border-line bg-surface2 text-white/80",
} as const;

/** "14 Aug, 5:39 PM" — the tournament runs over a fortnight, so the day matters. */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "TEAM_ADMIN" is a database value; the rest of the dashboard says "Team admin". */
function roleLabel(value: unknown): string {
  return typeof value === "string" && value in ROLE_LABELS
    ? ROLE_LABELS[value as AdminRole]
    : String(value ?? "");
}

/** The interesting bits of `detail`, as "cleared 6 events · was LIVE". */
function summarise(detail: Record<string, unknown>): string {
  const parts: string[] = [];
  const d = detail ?? {};

  if (typeof d.clearedScore === "string") parts.push(`was ${d.clearedScore}`);
  if (typeof d.score === "string") parts.push(`score ${d.score}`);
  if (typeof d.clearedEvents === "number" && d.clearedEvents > 0) {
    parts.push(`${d.clearedEvents} event${d.clearedEvents === 1 ? "" : "s"} cleared`);
  }
  if (typeof d.events === "number" && d.events > 0) parts.push(`${d.events} events`);
  if (typeof d.squadSize === "number" && d.squadSize > 0) {
    parts.push(`${d.squadSize} player${d.squadSize === 1 ? "" : "s"}`);
  }
  if (typeof d.adminsRemoved === "number" && d.adminsRemoved > 0) {
    parts.push(`${d.adminsRemoved} admin account${d.adminsRemoved === 1 ? "" : "s"}`);
  }
  if (typeof d.imported === "number") parts.push(`${d.imported} imported`);
  if (typeof d.created === "number" || typeof d.updated === "number") {
    parts.push(`${d.created ?? 0} new, ${d.updated ?? 0} updated`);
  }
  if (typeof d.movedTo === "string") parts.push(`teams moved to ${d.movedTo}`);
  if (typeof d.removedFromTeamsheets === "number" && d.removedFromTeamsheets > 0) {
    parts.push(`taken off ${d.removedFromTeamsheets} teamsheet(s)`);
  }
  if (d.from && d.to && typeof d.from === "object") {
    const from = d.from as Record<string, unknown>;
    const to = d.to as Record<string, unknown>;
    if (from.role || to.role) parts.push(`${roleLabel(from.role)} to ${roleLabel(to.role)}`);
  }
  if (typeof d.role === "string" && !d.from) parts.push(roleLabel(d.role));

  // The reset stores what it emptied, which is the only surviving trace of it.
  if (d.removed && typeof d.removed === "object") {
    const r = d.removed as Record<string, number>;
    const bits = [
      r.departments ? `${r.departments} teams` : "",
      r.players ? `${r.players} players` : "",
      r.matches ? `${r.matches} matches` : "",
      r.teamAdmins ? `${r.teamAdmins} team admins` : "",
    ].filter(Boolean);
    if (bits.length) parts.push(`removed ${bits.join(", ")}`);
  }

  return parts.join(" · ");
}

export default function AuditSection() {
  const [limit, setLimit] = useState(50);

  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "audit", limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit?limit=${limit}`);
      if (!res.ok) throw new Error("Could not read the activity log.");
      return (await res.json()) as { entries: AuditEntry[]; unavailable?: boolean };
    },
    staleTime: 15_000,
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);

  return (
    <section className="space-y-2 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Activity log</h2>
        <span className="text-[12px] text-white/60">
          {entries.length > 0 && `${entries.length} most recent`}
        </span>
      </div>
      <p className="px-1 text-[13px] text-white/70">
        Deletions, resets and account changes, with who made them. Ordinary edits — a goal, a
        substitution, a formation — are not listed.
      </p>

      {isPending && (
        <div className="space-y-1.5" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[52px] animate-pulse rounded-card bg-surface2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-card border border-line bg-surface px-3 py-2.5 text-[13.5px] text-white">
          Could not read the activity log.
        </p>
      )}

      {!isPending && !isError && entries.length === 0 && (
        <EmptyState
          title="Nothing recorded yet"
          body={
            data?.unavailable
              ? "Run Update database below to create the log, then destructive actions will appear here."
              : "Deletions and account changes will appear here as they happen."
          }
        />
      )}

      {entries.length > 0 && (
        <ul className="space-y-1.5">
          {entries.map((entry) => {
            const phrase = PHRASING[entry.action] ?? { verb: entry.action, tone: "plain" as const };
            const extra = summarise(entry.detail);
            return (
              <li
                key={entry.id}
                className="rounded-card border border-line bg-surface px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13.5px] text-white">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                      TONE_CLASS[phrase.tone]
                    }`}
                  >
                    {entry.targetType}
                  </span>
                  <strong className="font-bold">{entry.actorUsername}</strong>
                  <span className="text-white/80">{phrase.verb}</span>
                  {entry.targetLabel && (
                    <strong className="font-bold">{entry.targetLabel}</strong>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-white/60">
                  <time dateTime={entry.createdAt}>{when(entry.createdAt)}</time>
                  {extra && <span>· {extra}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length >= limit && limit < 500 && (
        <button onClick={() => setLimit((n) => Math.min(n + 100, 500))} className={`${btnOutline} ${btnSm}`}>
          Show more
        </button>
      )}
    </section>
  );
}
