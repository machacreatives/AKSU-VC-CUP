"use client";

import { useEffect, useRef, useState } from "react";
import { Department, Match } from "@/lib/types";

/**
 * The scoreline, editable.
 *
 * Goals recorded as events move this on their own, but the admin still needs to
 * be able to correct it — a goal given after a long VAR-style argument, a
 * fixture whose result was known before anyone was logging events. So this
 * stays available, and it lives wherever the match is being run from: the
 * dashboard card *and* the screen where events are being typed, which is where
 * whoever is watching the match actually is.
 *
 * Typing is debounced, so holding the + button is one write rather than eight.
 */
export default function ScoreControls({
  match,
  home,
  away,
  onSaved,
  onError,
  size = "compact",
}: {
  match: Match;
  home: Department;
  away: Department;
  onSaved?: (match: Match) => void;
  onError?: (message: string) => void;
  size?: "compact" | "large";
}) {
  const [scores, setScores] = useState({ home: match.home.score, away: match.away.score });
  const [saving, setSaving] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // A goal event elsewhere on the page changes the stored score. Adopt it,
  // unless there is an edit in flight that would be thrown away.
  useEffect(() => {
    if (dirty.current) return;
    setScores({ home: match.home.score, away: match.away.score });
  }, [match.home.score, match.away.score]);

  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(scores), 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores]);

  async function save(next: { home: number; away: number }) {
    setSaving(true);
    const res = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: match.id,
        home: { departmentId: match.home.departmentId, score: next.home },
        away: { departmentId: match.away.departmentId, score: next.away },
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    dirty.current = false;

    if (!res.ok) {
      onError?.(body.error ?? "The score was not saved.");
      setScores({ home: match.home.score, away: match.away.score });
      return;
    }
    if (body.match) onSaved?.(body.match);
  }

  function set(side: "home" | "away", value: number) {
    dirty.current = true;
    setScores((s) => ({ ...s, [side]: Math.max(0, Math.min(99, value)) }));
  }

  const big = size === "large";
  const stepBtn = `shrink-0 rounded-[6px] border border-line bg-surface2 font-bold text-white transition-colors hover:bg-surface3 active:bg-surface3 ${
    big ? "h-9 w-9 text-[17px]" : "h-8 w-8 text-[15px]"
  }`;
  const input = `tabular rounded-[6px] border border-line bg-surface2 text-center font-extrabold text-white outline-none focus:border-accent ${
    big ? "h-9 w-14 text-[17px]" : "h-8 w-12 text-[15px]"
  }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["home", "away"] as const).map((side) => {
        const team = side === "home" ? home : away;
        return (
          <div key={side} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: team.color }}
              aria-hidden
            />
            <span className="mr-1 text-[12.5px] font-semibold text-white">{team.shortName}</span>
            <button
              type="button"
              className={stepBtn}
              onClick={() => set(side, scores[side] - 1)}
              aria-label={`${team.shortName} score minus one`}
            >
              −
            </button>
            <input
              type="number"
              min={0}
              max={99}
              value={scores[side]}
              onChange={(e) => set(side, Number(e.target.value) || 0)}
              className={input}
              aria-label={`${team.shortName} score`}
            />
            <button
              type="button"
              className={stepBtn}
              onClick={() => set(side, scores[side] + 1)}
              aria-label={`${team.shortName} score plus one`}
            >
              +
            </button>
          </div>
        );
      })}
      <span className="text-[11.5px] text-white/70">{saving ? "Saving…" : ""}</span>
    </div>
  );
}
