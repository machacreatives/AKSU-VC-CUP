import {
  computeStandings,
  getDepartments,
  getGroups,
  getMatches,
  getPlayersWithRatings,
} from "@/lib/db/queries";
import { DataProvider } from "@/lib/data-context";
import DbErrorNotice from "@/components/DbErrorNotice";
import HomeTabs from "./HomeTabs";

// Live scores must never be cached — read Postgres on every request.
export const dynamic = "force-dynamic";

export default async function Home() {
  let data;
  try {
    const [departments, matches, players, groups] = await Promise.all([
      getDepartments(),
      getMatches(),
      getPlayersWithRatings(),
      getGroups(),
    ]);
    data = {
      departments,
      matches,
      players,
      groups,
      standings: computeStandings(matches, departments),
    };
  } catch (err) {
    // Logged here, never sent to the browser in production — the driver
    // message carries table names and the database hostname.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("database read failed:", detail);
    return <DbErrorNotice message={detail} />;
  }

  return (
    <DataProvider departments={data.departments} players={data.players} serverNow={Date.now()}>
      <HomeTabs
        matches={data.matches}
        standings={data.standings}
        departments={data.departments}
        players={data.players}
        groups={data.groups}
      />
    </DataProvider>
  );
}
