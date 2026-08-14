"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api";
import { tieOutcome } from "@/lib/knockout";
import { Department, Match, STAGE_LABELS } from "@/lib/types";
import { Banner, btnOutline, btnPrimary, field } from "../../ui";

/**
 * How a knockout tie was decided.
 *
 * A tie that finished level had no way to record who went through — the bracket
 * showed a completed match with no winner, permanently. Extra time and a
 * shoot-out are recorded here; the scoreline itself stays the score of the
 * match, extra time included, the way a result is normally written.
 */
export default function TieResolution({
  match,
  home,
  away,
}: {
  match: Match;
  home: Department;
  away: Department;
}) {
  const queryClient = useQueryClient();
  const [aet, setAet] = useState(Boolean(match.wentToExtraTime));
  const [homePens, setHomePens] = useState(
    match.homePenalties == null ? "" : String(match.homePenalties)
  );
  const [awayPens, setAwayPens] = useState(
    match.awayPenalties == null ? "" : String(match.awayPenalties)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const level = match.home.score === match.away.score;
  const outcome = tieOutcome(match);

  async function save(clearPenalties = false) {
    setError("");
    setSaving(true);
    const res = await fetch(`/api/admin/matches/${match.id}/resolution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wentToExtraTime: aet,
        homePenalties: clearPenalties ? null : homePens === "" ? null : Number(homePens),
        awayPenalties: clearPenalties ? null : awayPens === "" ? null : Number(awayPens),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) return setError(body.error ?? "Could not save how the tie was decided.");
    if (clearPenalties) {
      setHomePens("");
      setAwayPens("");
    }
    setNotice("Saved.");
    queryClient.setQueryData(queryKeys.match(match.id), body.match);
    queryClient.invalidateQueries({ queryKey: queryKeys.matches });
  }

  const winnerName =
    outcome.winner === "home" ? home.name : outcome.winner === "away" ? away.name : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">
          {STAGE_LABELS[match.stage ?? "QF"]} result
        </h2>
        {winnerName && (
          <span className="rounded-full border border-win/40 bg-win/15 px-2.5 py-0.5 text-[11.5px] font-bold text-win">
            {winnerName} go through
          </span>
        )}
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {notice && !error && <Banner tone="success">{notice}</Banner>}

      {outcome.unresolved && (
        <Banner tone="info">
          This tie finished level and nothing records who went through. Enter the shoot-out below —
          until then the bracket cannot advance anyone.
        </Banner>
      )}

      <div className="space-y-3 rounded-card border border-line bg-surface p-3">
        <label className="flex items-center gap-2 text-[13.5px] text-white">
          <input
            type="checkbox"
            checked={aet}
            onChange={(e) => setAet(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Went to extra time
        </label>
        <p className="text-[11.5px] text-white/70">
          The scoreline above is the score of the match including extra time.
        </p>

        <div className="border-t border-line pt-3">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/70">
            Penalty shoot-out
          </p>

          {!level ? (
            <p className="text-[12.5px] text-white/70">
              Not needed — this tie was won {match.home.score}-{match.away.score}.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold text-white">{home.shortName}</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={homePens}
                  onChange={(e) => setHomePens(e.target.value)}
                  className={`${field} w-16 text-center`}
                  aria-label={`${home.shortName} penalties`}
                />
                <span className="text-white/60">-</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={awayPens}
                  onChange={(e) => setAwayPens(e.target.value)}
                  className={`${field} w-16 text-center`}
                  aria-label={`${away.shortName} penalties`}
                />
                <span className="text-[12.5px] font-semibold text-white">{away.shortName}</span>
              </div>
              <p className="mt-1.5 text-[11.5px] text-white/70">
                A shoot-out cannot end level — one side has to go through.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <button onClick={() => save()} disabled={saving} className={btnPrimary}>
            {saving ? "Saving…" : "Save result"}
          </button>
          {(match.homePenalties != null || match.wentToExtraTime) && (
            <button onClick={() => save(true)} disabled={saving} className={btnOutline}>
              Clear shoot-out
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
