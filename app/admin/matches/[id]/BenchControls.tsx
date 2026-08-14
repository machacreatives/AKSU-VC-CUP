"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, usePlayers } from "@/lib/api";
import { Department, Match, Player } from "@/lib/types";
import { Banner, btnOutline, btnSm } from "../../ui";

const POSITION_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 } as const;

/**
 * Who is on the bench for each side.
 *
 * A substitution needs a player coming on, and offering the whole squad for
 * that is wrong: the eleven who started are already on the pitch. Naming the
 * substitutes here is what makes the "coming on" picker mean something, and it
 * is also just the teamsheet — the thing an administrator has in their hand at
 * kickoff.
 *
 * Nothing is required. With no bench named, the picker falls back to the full
 * squad rather than blocking a substitution that really happened.
 */
export default function BenchControls({
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
  const [savingSide, setSavingSide] = useState<"home" | "away" | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function toggle(side: "home" | "away", player: Player) {
    const current = match[side].bench ?? [];
    const next = current.includes(player.id)
      ? current.filter((id) => id !== player.id)
      : [...current, player.id];

    setSavingSide(side);
    setError("");
    const res = await fetch(`/api/admin/matches/${match.id}/bench`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side, playerIds: next }),
    });
    const body = await res.json().catch(() => ({}));
    setSavingSide(null);

    if (!res.ok) return setError(body.error ?? "Could not save the bench.");
    queryClient.setQueryData(queryKeys.match(match.id), body.match);
    queryClient.invalidateQueries({ queryKey: queryKeys.matches });
  }

  const sides = [
    { key: "home" as const, team: home, departmentId: match.home.departmentId },
    { key: "away" as const, team: away, departmentId: match.away.departmentId },
  ];

  const totalNamed = (match.home.bench?.length ?? 0) + (match.away.bench?.length ?? 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Substitutes</h2>
        <span className="text-[12px] text-white/70">
          {totalNamed === 0 ? "None named yet" : `${totalNamed} named`}
        </span>
        <button onClick={() => setOpen((v) => !v)} className={`${btnOutline} ${btnSm} ml-auto`}>
          {open ? "Done" : totalNamed === 0 ? "Name the bench" : "Change"}
        </button>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      {!open && totalNamed > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {sides.map(({ key, team }) => {
            const bench = (match[key].bench ?? [])
              .map((id) => allPlayers.find((p) => p.id === id))
              .filter(Boolean) as Player[];
            return (
              <div key={key} className="rounded-card border border-line bg-surface p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-white">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: team.color }}
                    aria-hidden
                  />
                  {team.shortName}
                </p>
                {bench.length === 0 ? (
                  <p className="text-[12.5px] text-white/70">No substitutes named.</p>
                ) : (
                  <p className="text-[12.5px] text-white">
                    {bench.map((p) => `#${p.number} ${p.name}`).join(", ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="grid gap-3 sm:grid-cols-2">
          {sides.map(({ key, team, departmentId }) => {
            const squad = allPlayers
              .filter((p) => p.departmentId === departmentId)
              .sort(
                (a, b) =>
                  POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.number - b.number
              );
            const bench = match[key].bench ?? [];

            return (
              <div key={key} className="space-y-2 rounded-card border border-line bg-surface p-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-white">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: team.color }}
                      aria-hidden
                    />
                    {team.shortName}
                  </p>
                  <span className="text-[11.5px] text-white/70">
                    {savingSide === key ? "Saving…" : `${bench.length} on the bench`}
                  </span>
                </div>

                {squad.length === 0 ? (
                  <p className="text-[12.5px] text-white/70">No squad recorded for this team.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {squad.map((p) => {
                      const on = bench.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggle(key, p)}
                          aria-pressed={on}
                          className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                            on
                              ? "border-accent bg-accent/15 text-white"
                              : "border-line bg-surface2 text-white/80 hover:bg-surface3"
                          }`}
                        >
                          #{p.number} {p.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
