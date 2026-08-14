import { notFound } from "next/navigation";
import { getDepartments, getMatch, getPlayersWithRatings } from "@/lib/db/queries";
import { DataProvider } from "@/lib/data-context";
import DbErrorNotice from "@/components/DbErrorNotice";
import MatchLive from "./MatchLive";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: { id: string } }) {
  let match, departments, players;
  try {
    [match, departments, players] = await Promise.all([
      getMatch(params.id),
      getDepartments(),
      getPlayersWithRatings(),
    ]);
  } catch (err) {
    return <DbErrorNotice message={err instanceof Error ? err.message : String(err)} />;
  }

  if (!match) return notFound();

  // Rendered on the server for the first paint, then handed to MatchLive, which
  // keeps it current through React Query instead of re-running this whole
  // component on a timer.
  return (
    <DataProvider departments={departments} players={players} serverNow={Date.now()}>
      <MatchLive initialMatch={match} departments={departments} />
    </DataProvider>
  );
}
