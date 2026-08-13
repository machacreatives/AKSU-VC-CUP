import { Player } from "@/lib/types";
import { getDepartment } from "@/lib/mock-data";
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

export default function StatList({ players, metric }: { players: Player[]; metric: Metric }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-premium">
      {players.slice(0, 8).map((p, i) => {
        const d = getDepartment(p.departmentId);
        return (
          <div
            key={p.id}
            className={`flex items-center gap-3 px-3 py-2.5 ${
              i !== players.length - 1 ? "border-b border-line" : ""
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
