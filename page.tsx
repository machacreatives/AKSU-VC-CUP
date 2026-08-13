"use client";

import { useState } from "react";
import TabBar from "@/components/TabBar";
import MatchCard from "@/components/MatchCard";
import StandingsTable from "@/components/StandingsTable";
import StatList from "@/components/StatList";
import KnockoutBracket from "@/components/KnockoutBracket";
import {
  matches,
  standings,
  departments,
  topScorers,
  topAssisters,
  topRated,
  mostCarded,
} from "@/lib/mock-data";
import { Campus, GroupId } from "@/lib/types";

type TabId = "matches" | "table" | "knockout" | "scorers" | "assists" | "ratings" | "cards";

const tabs: { id: TabId; label: string }[] = [
  { id: "matches", label: "Matches" },
  { id: "table", label: "Table" },
  { id: "knockout", label: "Knockout" },
  { id: "scorers", label: "Top Scorers" },
  { id: "assists", label: "Top Assists" },
  { id: "ratings", label: "Best Rated" },
  { id: "cards", label: "Cards" },
];

const campusGroups: Record<Campus, GroupId[]> = {
  main: ["A", "B"],
  obioakpa: ["C", "D"],
};

function rowsForGroup(group: GroupId) {
  return standings
    .filter((row) => departments.find((d) => d.id === row.departmentId)?.group === group)
    .sort((a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst));
}

export default function Home() {
  const [tab, setTab] = useState<TabId>("matches");
  const [campus, setCampus] = useState<Campus>("main");

  const live = matches.filter((m) => m.status === "LIVE" || m.status === "HT");
  const upcoming = matches.filter((m) => m.status === "UPCOMING");
  const finished = matches.filter((m) => m.status === "FT");

  return (
    <div>
      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      <div className="space-y-5 px-4 py-4">
        {tab === "matches" && (
          <>
            {live.length > 0 && (
              <section className="space-y-2">
                <h2 className="flex items-center gap-1.5 px-1 text-[13px] font-bold uppercase tracking-wide text-win">
                  <span className="pulse-live h-1.5 w-1.5 rounded-full bg-win" /> Live now
                </h2>
                <div className="space-y-2">
                  {live.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              </section>
            )}
            {upcoming.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">Upcoming</h2>
                <div className="space-y-2">
                  {upcoming.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              </section>
            )}
            {finished.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-white">Full time</h2>
                <div className="space-y-2">
                  {finished.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {tab === "table" && (
          <section className="space-y-3">
            <div className="flex gap-2">
              {(["main", "obioakpa"] as Campus[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCampus(c)}
                  className={`flex-1 rounded-card border px-3 py-2 text-[13.5px] font-bold transition-colors ${
                    campus === c
                      ? "border-accent bg-accent/15 text-white"
                      : "border-line bg-surface text-white"
                  }`}
                >
                  {c === "main" ? "Main Campus" : "Obio Akpa Campus"}
                </button>
              ))}
            </div>
            {campusGroups[campus].map((g) => (
              <StandingsTable key={g} rows={rowsForGroup(g)} title={`Group ${g}`} />
            ))}
          </section>
        )}

        {tab === "knockout" && <KnockoutBracket />}

        {tab === "scorers" && <StatList players={topScorers} metric="goals" />}
        {tab === "assists" && <StatList players={topAssisters} metric="assists" />}
        {tab === "ratings" && <StatList players={topRated} metric="rating" />}
        {tab === "cards" && <StatList players={mostCarded} metric="cards" />}
      </div>
    </div>
  );
}
