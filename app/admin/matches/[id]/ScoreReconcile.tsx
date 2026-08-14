"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/components/ConfirmDialog";
import { queryKeys } from "@/lib/api";
import { scoreDisagreesWithEvents, scoreFromEvents } from "@/lib/ratings";
import { Department, Match } from "@/lib/types";
import { Banner, btnOutline, btnSm } from "../../ui";

/**
 * Says so when the scoreline and the recorded goals disagree.
 *
 * The two are allowed to differ — a result known before anyone was logging
 * events is a real situation, and deriving the score automatically would wipe
 * it. What was missing is anyone being told: type a 3-1, record one goal, and
 * the match page showed a scoreline no goalscorer explained while Top Scorers
 * stayed empty. Nothing pointed at the gap.
 */
export default function ScoreReconcile({
  match,
  home,
  away,
  canRecalculate,
}: {
  match: Match;
  home: Department;
  away: Department;
  canRecalculate: boolean;
}) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [error, setError] = useState("");

  if (!scoreDisagreesWithEvents(match)) return null;

  const derived = scoreFromEvents(match);
  const goals = derived.home + derived.away;
  const shown = match.home.score + match.away.score;

  async function recalculate() {
    const ok = await confirm({
      title: "Set the score from the recorded goals?",
      body: (
        <>
          <p>
            The scoreline becomes{" "}
            <strong>
              {home.shortName} {derived.home} - {derived.away} {away.shortName}
            </strong>
            , matching the {goals} goal{goals === 1 ? "" : "s"} recorded against players.
          </p>
          <p>Nothing else changes — the events themselves are untouched.</p>
        </>
      ),
      confirmLabel: "Use the recorded goals",
      busyLabel: "Updating…",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/matches/${match.id}/recalculate-score`, {
          method: "POST",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not recalculate the score.");
      },
    });
    if (!ok) return;
    setError("");
    queryClient.invalidateQueries({ queryKey: queryKeys.match(match.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.matches });
  }

  return (
    <div className="space-y-2">
      {error && <Banner tone="error">{error}</Banner>}
      <div className="rounded-card border border-gold/40 bg-gold/10 px-3 py-2.5">
        <p className="text-[13.5px] font-medium text-white">
          The score reads{" "}
          <strong>
            {match.home.score} - {match.away.score}
          </strong>
          , but {goals === 0 ? "no goals have" : `only ${goals} goal${goals === 1 ? " has" : "s have"}`}{" "}
          been recorded against a player
          {goals > 0 && (
            <>
              {" "}
              ({derived.home} - {derived.away})
            </>
          )}
          .
        </p>
        <p className="mt-1 text-[12px] text-white/70">
          {shown > goals
            ? "Goalscorers are missing, so Top Scorers and the lineup board will not show them."
            : "There are more recorded goals than the scoreline shows."}
        </p>
        {canRecalculate && (
          <button onClick={recalculate} className={`${btnOutline} ${btnSm} mt-2`}>
            Set score from recorded goals
          </button>
        )}
      </div>
    </div>
  );
}
