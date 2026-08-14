import { Match } from "@/lib/types";

// The match clock is derived, never stored.
//
// Storing a ticking `minute` means somebody has to keep writing it, and every
// viewer sees whatever was last written. Instead the database records the
// instant each half kicked off; this turns that into a minute. Admin and
// public pages call the same function, so they cannot disagree.

export const REGULATION = { firstHalfEnd: 45, secondHalfEnd: 90 } as const;

export type Half = "first" | "second";

export type ClockState = {
  /** What to show on the badge: "63'", "45+2'", "HT", "FT", or the kickoff time. */
  label: string;
  /** Minutes played, counting stoppage. null before kickoff and after FT. */
  minute: number | null;
  /** Minutes past this half's regulation end, 0 when inside regulation. */
  overtime: number;
  running: boolean;
  half: Half | null;
  /**
   * True once regulation plus the announced added time has elapsed — the cue
   * to end the half. Must clear regulation first: with 0 added minutes,
   * "overtime >= added" would be true from the opening whistle.
   */
  readyToEnd: boolean;
};

const IDLE: ClockState = {
  label: "",
  minute: null,
  overtime: 0,
  running: false,
  half: null,
  readyToEnd: false,
};

function parse(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function elapsedMinutes(startedAt: number, now: number): number {
  // A half is in its 1st minute the instant it kicks off, so this floors the
  // elapsed time and the caller adds the offset.
  return Math.max(0, Math.floor((now - startedAt) / 60_000));
}

export function computeClock(match: Match, now: number): ClockState {
  if (match.status === "UPCOMING") {
    return { ...IDLE, label: match.kickoff };
  }
  if (match.status === "FT") {
    return { ...IDLE, label: "FT" };
  }
  if (match.status === "HT") {
    return { ...IDLE, label: "HT", half: "first" };
  }

  const secondStart = parse(match.secondHalfStartedAt);
  const firstStart = parse(match.firstHalfStartedAt);

  if (secondStart !== null) {
    const minute = REGULATION.firstHalfEnd + 1 + elapsedMinutes(secondStart, now);
    const overtime = Math.max(0, minute - REGULATION.secondHalfEnd);
    return {
      label: overtime > 0 ? `${REGULATION.secondHalfEnd}+${overtime}'` : `${minute}'`,
      minute,
      overtime,
      running: true,
      half: "second",
      readyToEnd: minute >= REGULATION.secondHalfEnd + (match.secondHalfAddedMinutes ?? 0),
    };
  }

  if (firstStart !== null) {
    const minute = 1 + elapsedMinutes(firstStart, now);
    const overtime = Math.max(0, minute - REGULATION.firstHalfEnd);
    return {
      label: overtime > 0 ? `${REGULATION.firstHalfEnd}+${overtime}'` : `${minute}'`,
      minute,
      overtime,
      running: true,
      half: "first",
      readyToEnd: minute >= REGULATION.firstHalfEnd + (match.firstHalfAddedMinutes ?? 0),
    };
  }

  // Marked live but no kickoff recorded — rows that predate the clock, or a
  // status set by hand. Fall back to whatever minute was stored.
  return {
    ...IDLE,
    label: match.minute ? `${match.minute}'` : "LIVE",
    minute: match.minute ?? null,
  };
}

/**
 * What minute to pre-fill when recording an event.
 *
 * `computeClock` returns a null minute at half time and full time, which is
 * correct — no clock is running. But events are very often typed up during the
 * interval or straight after the whistle, and a null minute rendered into an
 * empty field became `Number("") === 0`, which passed validation. A booking in
 * first-half stoppage time entered at half time was filed at 0' and sorted to
 * the top of the timeline.
 *
 * So at a break the suggestion is the end of the half just played, including
 * whatever stoppage time was announced. Still only a suggestion — the field
 * stays editable.
 */
export function suggestedEventMinute(match: Match, now: number): number | null {
  const clock = computeClock(match, now);
  if (clock.minute !== null) return clock.minute;

  if (match.status === "HT") {
    return REGULATION.firstHalfEnd + (match.firstHalfAddedMinutes ?? 0);
  }
  if (match.status === "FT") {
    // A match that reached full time without a second half was ended early;
    // the first half is the most it can have played.
    const played = match.secondHalfStartedAt
      ? REGULATION.secondHalfEnd + (match.secondHalfAddedMinutes ?? 0)
      : REGULATION.firstHalfEnd + (match.firstHalfAddedMinutes ?? 0);
    return played;
  }
  return null;
}

// Which control the admin should see next, derived from the same state so the
// buttons can never drift out of step with what the clock shows.
export type ClockPhase = "not-started" | "first-half" | "half-time" | "second-half" | "finished";

export function clockPhase(match: Match): ClockPhase {
  if (match.status === "FT") return "finished";
  if (match.status === "HT") return "half-time";
  if (match.status === "UPCOMING") return "not-started";
  if (match.secondHalfStartedAt) return "second-half";
  if (match.firstHalfStartedAt) return "first-half";
  return "not-started";
}
