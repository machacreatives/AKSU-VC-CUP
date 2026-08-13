"use client";

import Link from "next/link";
import { Match } from "@/lib/types";
import { useDepartment } from "@/lib/data-context";
import DeptBadge from "./DeptBadge";

export default function MatchCard({ match }: { match: Match }) {
  const home = useDepartment(match.home.departmentId);
  const away = useDepartment(match.away.departmentId);
  const isLive = match.status === "LIVE" || match.status === "HT";
  const isFT = match.status === "FT";

  const homeWon = isFT && match.home.score > match.away.score;
  const awayWon = isFT && match.away.score > match.home.score;

  const scoreClass = (won: boolean, lost: boolean) =>
    won ? "text-win" : lost ? "text-loss" : "text-white";

  return (
    <Link
      href={`/match/${match.id}`}
      className="group relative flex items-center gap-3 overflow-hidden rounded-card border border-line bg-surface py-3 pl-4 pr-3 shadow-premium transition-colors hover:bg-surface2"
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `linear-gradient(180deg, ${home.color}, ${away.color})` }}
      />
      {/* status column */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5">
        {isLive ? (
          <span className="flex items-center gap-1 text-[13px] font-bold text-win">
            <span className="pulse-live h-1.5 w-1.5 rounded-full bg-win" />
            {match.status === "HT" ? "HT" : `${match.minute}'`}
          </span>
        ) : match.status === "UPCOMING" ? (
          <span className="text-[14.5px] font-medium text-white">
            {match.kickoff.split(",")[1] ?? match.kickoff}
          </span>
        ) : (
          <span className="text-[13px] font-bold text-white">FT</span>
        )}
        <span className="rounded-[4px] bg-surface3 px-1.5 py-0.5 text-[10px] font-bold text-white">
          GRP {match.group}
        </span>
      </div>

      {/* teams */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <DeptBadge department={home} size={20} />
          <span className="truncate text-[14.5px] font-medium text-white">{home.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <DeptBadge department={away} size={20} />
          <span className="truncate text-[14.5px] font-medium text-white">{away.name}</span>
        </div>
      </div>

      {/* score */}
      <div className="flex shrink-0 flex-col items-end gap-1.5 font-score">
        <span className={`tabular text-[19px] font-bold ${isLive ? "text-win" : scoreClass(homeWon, awayWon)}`}>
          {match.status === "UPCOMING" ? "–" : match.home.score}
        </span>
        <span className={`tabular text-[19px] font-bold ${isLive ? "text-win" : scoreClass(awayWon, homeWon)}`}>
          {match.status === "UPCOMING" ? "–" : match.away.score}
        </span>
      </div>
    </Link>
  );
}
