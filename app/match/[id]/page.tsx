import { notFound } from "next/navigation";
import { getDepartments, getMatch, getPlayers } from "@/lib/db/queries";
import { DataProvider } from "@/lib/data-context";
import AutoRefresh from "@/components/AutoRefresh";
import DbErrorNotice from "@/components/DbErrorNotice";
import DeptBadge from "@/components/DeptBadge";
import MatchClock from "@/components/MatchClock";
import MatchDetailTabs from "@/components/MatchDetailTabs";
import ScorersLine from "@/components/ScorersLine";
import { Department } from "@/lib/types";

export const dynamic = "force-dynamic";

const unknownDepartment = (id: string): Department => ({
  id,
  name: "Unknown",
  shortName: "???",
  faculty: "",
  campus: "main",
  group: "A",
  color: "#6B7280",
});

export default async function MatchPage({ params }: { params: { id: string } }) {
  let match, departments, players;
  try {
    [match, departments, players] = await Promise.all([
      getMatch(params.id),
      getDepartments(),
      getPlayers(),
    ]);
  } catch (err) {
    return <DbErrorNotice message={err instanceof Error ? err.message : String(err)} />;
  }

  if (!match) return notFound();

  const byId = new Map(departments.map((d) => [d.id, d]));
  const home = byId.get(match.home.departmentId) ?? unknownDepartment(match.home.departmentId);
  const away = byId.get(match.away.departmentId) ?? unknownDepartment(match.away.departmentId);

  const isLive = match.status === "LIVE" || match.status === "HT";
  const isFT = match.status === "FT";
  const homeWon = isFT && match.home.score > match.away.score;
  const awayWon = isFT && match.away.score > match.home.score;
  const scoreClass = (won: boolean, lost: boolean) => (won ? "text-win" : lost ? "text-loss" : "text-white");

  return (
    <DataProvider departments={departments} players={players} serverNow={Date.now()}>
      <AutoRefresh />
      <div>
        <div className="border-b border-line px-4 py-6 lg:py-8">
          <div className="mx-auto mb-3 flex max-w-3xl items-center justify-center gap-2 text-[13px] font-semibold text-white lg:text-[14px]">
            <span className="rounded-full bg-surface2 px-2 py-0.5 text-white">GROUP {match.group}</span>
            <span>{match.round}</span>
            <span>&middot;</span>
            <span>{match.venue}</span>
          </div>

          <div className="mx-auto flex max-w-3xl items-start justify-between">
            <div className="flex flex-1 flex-col items-center gap-2">
              <DeptBadge department={home} size={44} />
              <span className="text-center text-[15px] font-bold text-white lg:text-[18px]">{home.name}</span>
              <ScorersLine match={match} departmentId={home.id} align="left" />
            </div>

            <div className="flex flex-col items-center gap-1 px-3 pt-1">
              {isLive && (
                <MatchClock match={match} className="text-[13px] font-bold text-win" />
              )}
              <div className="tabular font-score text-[36px] font-extrabold lg:text-[52px]">
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
              <span className="text-center text-[15px] font-bold text-white lg:text-[18px]">{away.name}</span>
              <ScorersLine match={match} departmentId={away.id} align="right" />
            </div>
          </div>
        </div>

        <MatchDetailTabs match={match} />
      </div>
    </DataProvider>
  );
}
