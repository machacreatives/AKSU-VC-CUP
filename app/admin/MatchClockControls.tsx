"use client";

import { useEffect, useState } from "react";
import { Match } from "@/lib/types";
import { clockPhase, computeClock, REGULATION } from "@/lib/match-clock";
import { useConfirm } from "@/components/ConfirmDialog";

// Referee controls. The admin starts and ends each half; the minute counts
// itself. The only number anyone types is the announced added time.

const btn =
  "rounded-[6px] px-3 py-1.5 text-[13px] font-bold transition-opacity disabled:opacity-50";
const primary = `${btn} bg-accent text-white hover:opacity-90`;
const outline = `${btn} border border-line text-white hover:bg-surface2`;

export default function MatchClockControls({
  match,
  onChange,
}: {
  match: Match;
  onChange: (m: Match) => void;
}) {
  const confirm = useConfirm();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Local tick. The admin page is client-rendered, so there is no server
  // timestamp to anchor to here; the timestamps themselves come from the
  // database, so only this device's offset can drift and only visually.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = computeClock(match, now);
  const phase = clockPhase(match);

  async function send(
    action: string,
    extra: Record<string, unknown> = {},
    { throwOnError = false }: { throwOnError?: boolean } = {}
  ) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/matches/${match.id}/clock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (res.ok && body.match) {
      onChange(body.match);
      return;
    }

    const message = body.error ?? "Could not update the clock.";
    // When the confirmation dialog is driving this, let it own the error so the
    // message appears next to the button that failed.
    if (throwOnError) throw new Error(message);
    setError(message);
  }

  const addedForCurrentHalf =
    phase === "second-half" ? match.secondHalfAddedMinutes : match.firstHalfAddedMinutes;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* live readout */}
        <span
          className={`tabular inline-flex min-w-[3.6rem] items-center justify-center rounded-[6px] px-2 py-1 text-[14px] font-extrabold ${
            clock.running ? "bg-win/15 text-win" : "bg-surface2 text-white"
          }`}
        >
          {clock.running && <span className="pulse-live mr-1 h-1.5 w-1.5 rounded-full bg-win" />}
          {clock.label || "—"}
        </span>

        {phase === "not-started" && (
          <button className={primary} disabled={busy} onClick={() => send("start-first-half")}>
            Kick off
          </button>
        )}

        {phase === "first-half" && (
          <button
            className={clock.readyToEnd ? primary : outline}
            disabled={busy}
            onClick={() => send("end-first-half")}
          >
            End first half
          </button>
        )}

        {phase === "half-time" && (
          <button className={primary} disabled={busy} onClick={() => send("start-second-half")}>
            Start second half
          </button>
        )}

        {phase === "second-half" && (
          <button
            className={clock.readyToEnd ? primary : outline}
            disabled={busy}
            onClick={() => send("end-match")}
          >
            End match
          </button>
        )}

        {phase === "finished" && <span className="text-[13px] font-bold text-white">Full time</span>}

        {phase !== "not-started" && (
          <button
            className={`${outline} text-[12px]`}
            disabled={busy}
            onClick={() =>
              confirm({
                title: "Clear the clock?",
                body: (
                  <>
                    <p>This sets the match back to not started and clears both half timers.</p>
                    <p>
                      Scores and events are kept — use <strong>Reset match</strong> to clear those
                      too.
                    </p>
                  </>
                ),
                confirmLabel: "Clear clock",
                busyLabel: "Clearing…",
                onConfirm: () => send("reset", {}, { throwOnError: true }),
              })
            }
          >
            Reset clock
          </button>
        )}
      </div>

      {/* announced stoppage time */}
      <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-white">
        <label className="flex items-center gap-1.5">
          <span>Added 1st</span>
          <input
            type="number"
            min={0}
            max={30}
            value={match.firstHalfAddedMinutes}
            onChange={(e) => send("set-added-time", { half: "first", minutes: Number(e.target.value) })}
            className="w-14 rounded-[6px] border border-line bg-surface2 px-2 py-1 text-center text-[13px] text-white"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span>Added 2nd</span>
          <input
            type="number"
            min={0}
            max={30}
            value={match.secondHalfAddedMinutes}
            onChange={(e) => send("set-added-time", { half: "second", minutes: Number(e.target.value) })}
            className="w-14 rounded-[6px] border border-line bg-surface2 px-2 py-1 text-center text-[13px] text-white"
          />
        </label>

        {clock.running && (
          <span className={clock.readyToEnd ? "font-bold text-win" : ""}>
            {clock.readyToEnd
              ? "Added time complete — you can end the half."
              : `Ends at ${
                  clock.half === "first" ? REGULATION.firstHalfEnd : REGULATION.secondHalfEnd
                }${addedForCurrentHalf > 0 ? `+${addedForCurrentHalf}` : ""}`}
          </span>
        )}
      </div>

      {error && <p className="text-[12.5px] font-medium text-loss">{error}</p>}
    </div>
  );
}
