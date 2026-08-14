"use client";

import { Player } from "@/lib/types";
import { useDepartmentLookup } from "@/lib/data-context";
import DeptBadge from "./DeptBadge";
import RatingPill from "./RatingPill";

type Metric = "goals" | "assists" | "rating" | "cards";

function MetricValue({ player, metric }: { player: Player; metric: Metric }) {
  if (metric === "rating") return <RatingPill rating={player.rating ?? 0} />;
  if (metric === "goals")
    return <span className="tabular text-[18px] font-extrabold text-white">{player.goals}</span>;
  if (metric === "assists")
    return <span className="tabular text-[18px] font-extrabold text-white">{player.assists}</span>;
  return (
    <span className="flex items-center gap-2">
      {player.yellowCards > 0 && (
        <span className="flex items-center gap-1 text-[13.5px] font-bold text-white">
          <span className="h-3.5 w-2.5 rounded-[1.5px] bg-gold" />
          {player.yellowCards}
        </span>
      )}
      {player.redCards > 0 && (
        <span className="flex items-center gap-1 text-[13.5px] font-bold text-white">
          <span className="h-3.5 w-2.5 rounded-[1.5px] bg-loss" />
          {player.redCards}
        </span>
      )}
    </span>
  );
}

const PUBLIC_LIMIT = 12;

export default function StatList({
  players,
  metric,
  limit = PUBLIC_LIMIT,
}: {
  players: Player[];
  metric: Metric;
  /** The public tabs show a top 12; admin passes Infinity to see everyone. */
  limit?: number;
}) {
  const getDepartment = useDepartmentLookup();

  if (players.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface px-4 py-6 text-center text-[14px] text-white shadow-premium">
        No player stats yet.
      </div>
    );
  }

  const shown = Number.isFinite(limit) ? players.slice(0, limit) : players;

  return (
    // A single list at every width, so second place is always directly under
    // first. This used to flow into two columns on a large screen to fill the
    // page, which put rank 2 beside rank 1 and rank 7 back at the top — the
    // reading order stopped matching the ranking. Capped instead, so the row
    // stays a readable length rather than stretching a name and a number to
    // opposite edges of a wide monitor.
    <div className="mx-auto w-full overflow-hidden rounded-card border border-line bg-surface shadow-premium lg:max-w-3xl">
      {shown.map((p, i) => {
        const d = getDepartment(p.departmentId);
        const isLast = i === shown.length - 1;
        return (
          <div
            key={p.id}
            className={`flex items-center gap-3 px-3 py-2.5 lg:px-4 lg:py-3 ${
              isLast ? "" : "border-b border-line"
            }`}
          >
            <span className="tabular w-4 text-[13.5px] font-bold text-white">{i + 1}</span>
            <DeptBadge department={d} size={22} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-white">{p.name}</p>
              <p className="truncate text-[12.5px] text-white">{d.name}</p>
            </div>
            <MetricValue player={p} metric={metric} />
          </div>
        );
      })}
    </div>
  );
}
