"use client";

import { useState } from "react";
import { Match } from "@/lib/types";
import { useDepartment } from "@/lib/data-context";
import TabBar from "./TabBar";
import FormationPitch from "./FormationPitch";
import EventTimeline from "./EventTimeline";
import MatchStatsCard from "./MatchStatsCard";

type TabId = "lineups" | "stats" | "events";

export default function MatchDetailTabs({ match }: { match: Match }) {
  const hasLineups = !!(match.home.startingXI && match.away.startingXI);
  const hasStats = !!(match.home.stats && match.away.stats);
  const [tab, setTab] = useState<TabId>(hasLineups ? "lineups" : hasStats ? "stats" : "events");
  const home = useDepartment(match.home.departmentId);
  const away = useDepartment(match.away.departmentId);

  const tabs = [
    ...(hasLineups ? [{ id: "lineups" as TabId, label: "Lineups" }] : []),
    ...(hasStats ? [{ id: "stats" as TabId, label: "Stats" }] : []),
    { id: "events" as TabId, label: "Events" },
  ];

  return (
    <div>
      <TabBar tabs={tabs} active={tab} onChange={setTab} />
      <div className="px-4 py-4 lg:px-6 lg:py-6">
        {/* The pitch is portrait (68:100), so on a wide screen it must be
            capped and centred or it becomes absurdly tall. */}
        {tab === "lineups" && hasLineups && (
          <div className="mx-auto w-full sm:max-w-md">
          <FormationPitch
            home={home}
            away={away}
            homeXI={match.home.startingXI!}
            awayXI={match.away.startingXI!}
            homeFormation={match.home.formation ?? "4-4-2"}
            awayFormation={match.away.formation ?? "4-4-2"}
            homeCaptainId={match.home.captainId}
            awayCaptainId={match.away.captainId}
          />
          </div>
        )}
        {tab === "stats" && hasStats && (
          <div className="mx-auto w-full lg:max-w-2xl">
            <MatchStatsCard home={home} away={away} homeStats={match.home.stats!} awayStats={match.away.stats!} />
          </div>
        )}
        {tab === "events" && (
          <div className="mx-auto w-full lg:max-w-2xl">
            <EventTimeline match={match} />
          </div>
        )}
      </div>
    </div>
  );
}
