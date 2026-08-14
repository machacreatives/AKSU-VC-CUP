"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/components/ConfirmDialog";
import { queryKeys } from "@/lib/api";
import { Department, Match, TeamMatchStats } from "@/lib/types";
import { Banner, btnOutline, field } from "../../ui";

const EMPTY: TeamMatchStats = { possession: 50, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0 };

const COUNTERS: { key: keyof Omit<TeamMatchStats, "possession">; label: string }[] = [
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "Shots on target" },
  { key: "corners", label: "Corners" },
  { key: "fouls", label: "Fouls" },
];

const stepBtn =
  "h-8 w-8 shrink-0 rounded-[6px] border border-line bg-surface2 text-[15px] font-bold text-white transition-colors hover:bg-surface3 disabled:opacity-40";

export default function MatchStatsControls({
  match,
  home,
  away,
  ownSide = null,
}: {
  match: Match;
  home: Department;
  away: Department;
  /** Null for a superadmin, who edits both sides and the possession split. */
  ownSide?: "home" | "away" | null;
}) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [homeStats, setHomeStats] = useState<TeamMatchStats>(match.home.stats ?? EMPTY);
  const [awayStats, setAwayStats] = useState<TeamMatchStats>(match.away.stats ?? { ...EMPTY });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // Recording a goal or a card moves these counters server-side, so the panel
  // has to adopt what came back. Without this it would keep showing the numbers
  // it was mounted with and the next tap would save them straight back over the
  // event's contribution.
  //
  // Skipped while an edit is pending, so a background refresh cannot yank the
  // value out from under someone mid-tap.
  // Compared by value, not identity: every poll hands back a fresh object, so
  // depending on the object itself would re-render this panel every few seconds
  // for nothing.
  const storedStats = JSON.stringify([match.home.stats ?? null, match.away.stats ?? null]);

  useEffect(() => {
    if (dirty.current) return;
    const [home, away] = JSON.parse(storedStats) as (TeamMatchStats | null)[];
    setHomeStats(home ?? EMPTY);
    setAwayStats(away ?? { ...EMPTY });
  }, [storedStats]);

  // Taps come in bursts while watching a match, so the write is debounced —
  // five quick presses on "Shots" is one request, not five.
  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(homeStats, awayStats), 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeStats, awayStats]);

  async function save(h: TeamMatchStats, a: TeamMatchStats) {
    setStatus("saving");
    setError("");
    // A team admin sends only their own side; the server merges it into what
    // is stored rather than replacing both, and keeps the possession split.
    const payload = ownSide === "home" ? { home: h } : ownSide === "away" ? { away: a } : { home: h, away: a };
    const res = await fetch(`/api/admin/matches/${match.id}/stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("idle");
      setError(body.error ?? "Could not save the stats.");
      return;
    }
    dirty.current = false;
    setStatus("saved");
    queryClient.invalidateQueries({ queryKey: queryKeys.match(match.id) });
    setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
  }

  function bump(side: "home" | "away", key: keyof Omit<TeamMatchStats, "possession">, delta: number) {
    dirty.current = true;
    const apply = (s: TeamMatchStats) => ({ ...s, [key]: Math.max(0, Math.min(999, s[key] + delta)) });
    if (side === "home") setHomeStats(apply);
    else setAwayStats(apply);
  }

  // Possession is one number, not two: the pair has to total 100, and asking
  // for both invites a 60/60 that the server would just reject.
  function setPossession(value: number) {
    const homePct = Math.max(0, Math.min(100, Math.round(value)));
    dirty.current = true;
    setHomeStats((s) => ({ ...s, possession: homePct }));
    setAwayStats((s) => ({ ...s, possession: 100 - homePct }));
  }

  async function clearStats() {
    const ok = await confirm({
      title: "Clear match stats?",
      body: <p>The Stats tab disappears from the public match page until stats are recorded again.</p>,
      confirmLabel: "Clear stats",
      busyLabel: "Clearing…",
      tone: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/matches/${match.id}/stats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clear: true }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not clear the stats.");
      },
    });
    if (!ok) return;
    dirty.current = false;
    setHomeStats(EMPTY);
    setAwayStats({ ...EMPTY });
    queryClient.invalidateQueries({ queryKey: queryKeys.match(match.id) });
  }

  const onTargetTooHigh =
    homeStats.shotsOnTarget > homeStats.shots || awayStats.shotsOnTarget > awayStats.shots;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-white">Match stats</h2>
        <span className="text-[12px] text-white">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Saves as you tap"}
        </span>
        {!ownSide && (
          <button onClick={clearStats} className={`${btnOutline} ml-auto py-1 text-[12px]`}>
            Clear
          </button>
        )}
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {ownSide && (
        <Banner tone="info">
          You record your own side&apos;s numbers. Possession is one figure shared by both teams, so
          it stays with the organisers.
        </Banner>
      )}
      {onTargetTooHigh && (
        <Banner tone="info">Shots on target is higher than total shots — worth a second look.</Banner>
      )}

      <div className="space-y-3 rounded-card border border-line bg-surface p-3">
        <div className="flex items-center justify-between text-[13px] font-bold text-white">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: home.color }} />
            {home.shortName}
          </span>
          <span className="text-[12px] font-semibold uppercase tracking-wide text-white">Possession</span>
          <span className="flex items-center gap-1.5">
            {away.shortName}
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: away.color }} />
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="tabular w-12 text-[16px] font-extrabold text-white">
            {homeStats.possession}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={homeStats.possession}
            onChange={(e) => setPossession(Number(e.target.value))}
            disabled={ownSide !== null}
            className="h-1.5 min-w-0 flex-1 appearance-none rounded-full bg-surface3 accent-accent enabled:cursor-pointer disabled:opacity-50"
            aria-label="Home possession percentage"
          />
          <span className="tabular w-12 text-right text-[16px] font-extrabold text-white">
            {awayStats.possession}%
          </span>
        </div>

        {COUNTERS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2 border-t border-line pt-3">
            <div className="flex items-center gap-1.5">
              <button className={stepBtn} disabled={ownSide === "away"} onClick={() => bump("home", key, -1)} aria-label={`${home.shortName} ${label} minus`}>
                −
              </button>
              <input
                type="number"
                min={0}
                max={999}
                value={homeStats[key]}
                onChange={(e) => {
                  dirty.current = true;
                  setHomeStats((s) => ({ ...s, [key]: Math.max(0, Number(e.target.value) || 0) }));
                }}
                disabled={ownSide === "away"}
                className={`${field} w-14 text-center disabled:opacity-50`}
                aria-label={`${home.shortName} ${label}`}
              />
              <button className={stepBtn} disabled={ownSide === "away"} onClick={() => bump("home", key, 1)} aria-label={`${home.shortName} ${label} plus`}>
                +
              </button>
            </div>

            <span className="min-w-0 flex-1 text-center text-[12px] font-semibold uppercase tracking-wide text-white">
              {label}
            </span>

            <div className="flex items-center gap-1.5">
              <button className={stepBtn} disabled={ownSide === "home"} onClick={() => bump("away", key, -1)} aria-label={`${away.shortName} ${label} minus`}>
                −
              </button>
              <input
                type="number"
                min={0}
                max={999}
                value={awayStats[key]}
                onChange={(e) => {
                  dirty.current = true;
                  setAwayStats((s) => ({ ...s, [key]: Math.max(0, Number(e.target.value) || 0) }));
                }}
                disabled={ownSide === "home"}
                className={`${field} w-14 text-center disabled:opacity-50`}
                aria-label={`${away.shortName} ${label}`}
              />
              <button className={stepBtn} disabled={ownSide === "home"} onClick={() => bump("away", key, 1)} aria-label={`${away.shortName} ${label} plus`}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
