import { notFound } from "next/navigation";
import { matches, getDepartment } from "@/lib/mock-data";
import DeptBadge from "@/components/DeptBadge";
import MatchDetailTabs from "@/components/MatchDetailTabs";
import ScorersLine from "@/components/ScorersLine";

export function generateStaticParams() {
  return matches.map((m) => ({ id: m.id }));
}

export default function MatchPage({ params }: { params: { id: string } }) {
  const match = matches.find((m) => m.id === params.id);
  if (!match) return notFound();

  const home = getDepartment(match.home.departmentId);
  const away = getDepartment(match.away.departmentId);
  const isLive = match.status === "LIVE" || match.status === "HT";
  const isFT = match.status === "FT";
  const homeWon = isFT && match.home.score > match.away.score;
  const awayWon = isFT && match.away.score > match.home.score;
  const scoreClass = (won: boolean, lost: boolean) => (won ? "text-win" : lost ? "text-loss" : "text-white");

  return (
    <div>
      <div className="border-b border-line px-4 py-6">
        <div className="mb-3 flex items-center justify-center gap-2 text-[13px] font-semibold text-white">
          <span className="rounded-full bg-surface2 px-2 py-0.5 text-white">GROUP {match.group}</span>
          <span>{match.round}</span>
          <span>&middot;</span>
          <span>{match.venue}</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex flex-1 flex-col items-center gap-2">
            <DeptBadge department={home} size={44} />
            <span className="text-center text-[15px] font-bold text-white">{home.name}</span>
            <ScorersLine match={match} departmentId={home.id} align="left" />
          </div>

          <div className="flex flex-col items-center gap-1 px-3 pt-1">
            {isLive && (
              <span className="flex items-center gap-1 text-[13px] font-bold text-win">
                <span className="pulse-live h-1.5 w-1.5 rounded-full bg-win" />
                {match.status === "HT" ? "HT" : `${match.minute}'`}
              </span>
            )}
            <div className="tabular font-score text-[36px] font-extrabold">
              {match.status === "UPCOMING" ? (
                <span className="text-white">vs</span>
              ) : (
                <>
                  <span className={isLive ? "text-win" : scoreClass(homeWon, awayWon)}>{match.home.score}</span>
                  <span className="text-white"> - </span>
                  <span className={isLive ? "text-win" : scoreClass(awayWon, homeWon)}>{match.away.score}</span>
                </>
              )}
            </div>
            {match.status === "UPCOMING" && <span className="text-[13px] text-white">{match.kickoff}</span>}
          </div>

          <div className="flex flex-1 flex-col items-center gap-2">
            <DeptBadge department={away} size={44} />
            <span className="text-center text-[15px] font-bold text-white">{away.name}</span>
            <ScorersLine match={match} departmentId={away.id} align="right" />
          </div>
        </div>
      </div>

      <MatchDetailTabs match={match} />
    </div>
  );
}
