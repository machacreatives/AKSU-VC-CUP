import { Department, TeamMatchStats } from "@/lib/types";

function StatRow({
  label,
  homeValue,
  awayValue,
  homeColor,
  awayColor,
  isPercent,
}: {
  label: string;
  homeValue: number;
  awayValue: number;
  homeColor: string;
  awayColor: string;
  isPercent?: boolean;
}) {
  const total = homeValue + awayValue || 1;
  const homePct = (homeValue / total) * 100;

  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between text-[15px] font-bold text-white">
        <span className="tabular w-10">{homeValue}{isPercent ? "%" : ""}</span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-white">{label}</span>
        <span className="tabular w-10 text-right">{awayValue}{isPercent ? "%" : ""}</span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface3">
        <div style={{ width: `${homePct}%`, backgroundColor: homeColor }} />
        <div style={{ width: `${100 - homePct}%`, backgroundColor: awayColor }} />
      </div>
    </div>
  );
}

export default function MatchStatsCard({
  home,
  away,
  homeStats,
  awayStats,
}: {
  home: Department;
  away: Department;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-1 shadow-premium">
      <StatRow label="Possession" homeValue={homeStats.possession} awayValue={awayStats.possession} homeColor={home.color} awayColor={away.color} isPercent />
      <div className="h-px bg-line" />
      <StatRow label="Shots" homeValue={homeStats.shots} awayValue={awayStats.shots} homeColor={home.color} awayColor={away.color} />
      <div className="h-px bg-line" />
      <StatRow label="Shots on target" homeValue={homeStats.shotsOnTarget} awayValue={awayStats.shotsOnTarget} homeColor={home.color} awayColor={away.color} />
      <div className="h-px bg-line" />
      <StatRow label="Corners" homeValue={homeStats.corners} awayValue={awayStats.corners} homeColor={home.color} awayColor={away.color} />
      <div className="h-px bg-line" />
      <StatRow label="Fouls" homeValue={homeStats.fouls} awayValue={awayStats.fouls} homeColor={home.color} awayColor={away.color} />
    </div>
  );
}
