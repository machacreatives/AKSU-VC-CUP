import { computeStandings, getDepartments, getMatches, getPlayers } from "@/lib/db/queries";
import { DataProvider } from "@/lib/data-context";
import AutoRefresh from "@/components/AutoRefresh";
import DbErrorNotice from "@/components/DbErrorNotice";
import HomeTabs from "./HomeTabs";

// Live scores must never be cached — read Postgres on every request.
export const dynamic = "force-dynamic";

export default async function Home() {
  let data;
  try {
    const [departments, matches, players] = await Promise.all([
      getDepartments(),
      getMatches(),
      getPlayers(),
    ]);
    data = { departments, matches, players, standings: computeStandings(matches, departments) };
  } catch (err) {
    return <DbErrorNotice message={err instanceof Error ? err.message : String(err)} />;
  }

  return (
    <DataProvider departments={data.departments} players={data.players} serverNow={Date.now()}>
      <AutoRefresh />
      <HomeTabs
        matches={data.matches}
        standings={data.standings}
        departments={data.departments}
        players={data.players}
      />
    </DataProvider>
  );
}
