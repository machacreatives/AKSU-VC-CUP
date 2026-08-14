"use client";

import { Match, MatchEvent } from "@/lib/types";
import { useDepartment } from "@/lib/data-context";

function EventIcon({ type }: { type: MatchEvent["type"] }) {
  if (type === "GOAL")
    return <span className="text-[14px] leading-none">⚽</span>;
  if (type === "YELLOW") return <span className="h-3.5 w-2.5 rounded-[1.5px] bg-gold" />;
  if (type === "RED") return <span className="h-3.5 w-2.5 rounded-[1.5px] bg-loss" />;
  return <span className="text-[13px] font-bold text-white">SUB</span>;
}

export default function EventTimeline({ match }: { match: Match }) {
  const home = useDepartment(match.home.departmentId);
  const events = [...match.events].sort((a, b) => a.minute - b.minute);

  if (events.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface px-4 py-6 text-center text-[14px] text-white shadow-premium">
        No events yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-line rounded-card border border-line bg-surface shadow-premium">
      {events.map((e, i) => {
        const isHome = e.departmentId === home.id;
        return (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-2.5 text-[14px] ${isHome ? "" : "flex-row-reverse text-right"}`}
          >
            <span className="tabular w-8 shrink-0 font-semibold text-white">{e.minute}&apos;</span>
            <EventIcon type={e.type} />
            <div className="min-w-0 flex-1">
              {/* A substitution reads from the player coming on, the way a
                  broadcast graphic does — the arrow off is the detail. */}
              <p className="truncate font-semibold text-white">
                {e.type === "SUB" && e.subInPlayerName ? e.subInPlayerName : e.playerName}
              </p>
              {e.type === "SUB" && e.subInPlayerName && (
                <p className="truncate text-[12.5px] text-white/70">↓ {e.playerName}</p>
              )}
              {e.assistPlayerName && (
                <p className="truncate text-[12.5px] text-white/70">assist {e.assistPlayerName}</p>
              )}
              {e.detail && <p className="truncate text-[12.5px] text-white/70">{e.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
