"use client";

import { Match } from "@/lib/types";
import { useNow } from "@/lib/data-context";
import { computeClock } from "@/lib/match-clock";

// Renders the live match minute. It re-derives every second from the kickoff
// timestamp, so it keeps counting between page refreshes rather than sitting
// on whatever minute was last fetched.
export default function MatchClock({
  match,
  className = "",
  showPulse = true,
}: {
  match: Match;
  className?: string;
  showPulse?: boolean;
}) {
  const now = useNow();
  const clock = computeClock(match, now);

  if (!clock.running) {
    return <span className={className}>{clock.label}</span>;
  }

  return (
    <span className={`flex items-center gap-1 ${className}`}>
      {showPulse && <span className="pulse-live h-1.5 w-1.5 rounded-full bg-win" />}
      <span className="tabular">{clock.label}</span>
    </span>
  );
}
