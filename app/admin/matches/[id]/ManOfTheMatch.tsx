"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, usePlayers } from "@/lib/api";
import { Department, Match, Player } from "@/lib/types";
import { Banner, btnOutline, btnSm, field } from "../../ui";

/**
 * The player of the match.
 *
 * Restricted to the two teamsheets rather than the whole database — the award
 * only means anything about someone who was on the pitch. Shown as a star on
 * the public lineup graphic.
 */
export default function ManOfTheMatch({
  match,
  home,
  away,
}: {
  match: Match;
  home: Department;
  away: Department;
}) {
  const queryClient = useQueryClient();
  const { data: allPlayers = [] } = usePlayers();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const named = (side: Match["home"]) => [...(side.startingXI ?? []), ...(side.bench ?? [])];

  const options = (["home", "away"] as const).map((key) => {
    const side = match[key];
    const team = key === "home" ? home : away;
    const ids = named(side);
    // Before a teamsheet exists, fall back to the squad so the award is not
    // blocked on a fixture whose lineups were never recorded.
    const players = (
      ids.length > 0
        ? (ids.map((id) => allPlayers.find((p) => p.id === id)).filter(Boolean) as Player[])
        : allPlayers.filter((p) => p.departmentId === side.departmentId)
    ).sort((a, b) => a.number - b.number);
    return { team, players };
  });

  const current = allPlayers.find((p) => p.id === match.manOfTheMatchId);

  async function choose(playerId: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/matches/${match.id}/motm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: playerId || null }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) return setError(body.error ?? "Could not save the award.");
    queryClient.setQueryData(queryKeys.match(match.id), body.match);
    queryClient.invalidateQueries({ queryKey: queryKeys.matches });
  }

  const nobodyAvailable = options.every((o) => o.players.length === 0);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">
          Man of the match
        </h2>
        {saving && <span className="text-[12px] text-white/70">Saving…</span>}
        {current && !saving && (
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[11.5px] font-bold text-gold">
            ⭐ {current.name}
          </span>
        )}
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-3">
        {nobodyAvailable ? (
          <p className="text-[13px] text-white/70">
            No players recorded for either team yet.
          </p>
        ) : (
          <>
            <select
              value={match.manOfTheMatchId ?? ""}
              onChange={(e) => choose(e.target.value)}
              className={`${field} min-w-[220px] flex-1`}
              aria-label="Man of the match"
            >
              <option value="">Not awarded</option>
              {options.map(({ team, players }) => (
                <optgroup key={team.id} label={team.name}>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.number} {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {match.manOfTheMatchId && (
              <button onClick={() => choose("")} className={`${btnOutline} ${btnSm}`}>
                Clear
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-[11.5px] text-white/70">
        Shown with a star on the public lineup board.
      </p>
    </section>
  );
}
