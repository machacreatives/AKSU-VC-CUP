"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/components/ConfirmDialog";
import { useDepartments, useMatches, usePlayers } from "@/lib/api";
import { Banner, btnDanger } from "./ui";

/**
 * Empty the tournament and start again.
 *
 * This replaced an "Update database" button that only ever added missing
 * tables and columns. The reset still does that — it re-applies the schema
 * after clearing the rows — so nothing was lost by turning it into this.
 *
 * The counts in the warning are read live rather than described in the
 * abstract: "this deletes 8 teams and 160 players" stops a reflex click in a
 * way that "this deletes everything" does not.
 */
export default function DatabaseSection() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { data: departments = [] } = useDepartments();
  const { data: players = [] } = usePlayers();
  const { data: matches = [] } = useMatches();

  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const empty = departments.length === 0 && players.length === 0 && matches.length === 0;

  async function reset() {
    setError("");
    setResult("");

    const ok = await confirm({
      title: "Reset the database?",
      tone: "danger",
      confirmLabel: "Reset everything",
      busyLabel: "Resetting…",
      requireText: "RESET",
      body: (
        <>
          <p>
            This permanently deletes <strong>{departments.length}</strong> team
            {departments.length === 1 ? "" : "s"}, <strong>{players.length}</strong> player
            {players.length === 1 ? "" : "s"} and <strong>{matches.length}</strong> match
            {matches.length === 1 ? "" : "es"}, along with every recorded event, group and venue.
          </p>
          <p className="font-bold text-loss">There is no undo. Nothing is backed up first.</p>
          <p>
            Team administrator accounts are removed with their teams — the same rule as deleting a
            single team. <strong>Superadmin accounts are kept</strong>, so you stay signed in, and
            the activity log is kept so this reset stays on the record.
          </p>
          <p className="text-white/70">
            The database structure is re-applied afterwards, so you are left with an empty, ready
            tournament rather than a broken one.
          </p>
        </>
      ),
      onConfirm: async () => {
        const res = await fetch("/api/admin/reset", { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not reset the database.");
        const r = body.removed ?? {};
        setResult(
          `Database reset — removed ${r.departments ?? 0} teams, ${r.players ?? 0} players, ` +
            `${r.matches ?? 0} matches, ${r.events ?? 0} events, ${r.groups ?? 0} groups, ` +
            `${r.venues ?? 0} venues and ${r.teamAdmins ?? 0} team admin accounts.`
        );
      },
    });

    if (!ok) return;
    // Everything on screen is now stale, including this section's own counts.
    queryClient.clear();
  }

  return (
    <section className="space-y-2 border-t border-line pt-4">
      <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">Database</h2>

      {error && <Banner tone="error">{error}</Banner>}
      {result && <Banner tone="success">{result}</Banner>}

      <div className="rounded-card border border-loss/40 bg-loss/[0.07] px-3.5 py-3">
        <p className="text-[13.5px] font-bold text-white">Reset the database</p>
        <p className="mt-1 text-[13px] leading-relaxed text-white/80">
          Deletes every team, squad, fixture, event, group and venue, then re-applies the database
          structure so you are left with a clean slate. Superadmin accounts and the activity log
          survive; team administrator accounts go with their teams.
        </p>
        <p className="mt-1.5 text-[12.5px] text-white/60">
          {empty
            ? "Nothing to clear — the tournament is already empty. Running it still refreshes the structure."
            : `Currently holding ${departments.length} teams, ${players.length} players and ${matches.length} matches.`}
        </p>
        <button onClick={reset} className={`${btnDanger} mt-2.5`}>
          Reset database
        </button>
      </div>
    </section>
  );
}
