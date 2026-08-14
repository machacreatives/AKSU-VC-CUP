import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDepartments, getMatches, getPlayersWithRatings } from "@/lib/db/queries";
import { DataProvider } from "@/lib/data-context";
import { buildTeamProfile } from "@/lib/team-profile";
import DbErrorNotice from "@/components/DbErrorNotice";
import TeamProfileView from "./TeamProfileView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const team = (await getDepartments()).find((d) => d.id === params.id);
    if (!team) return { title: "Team not found" };

    const where = team.group ? `Group ${team.group}` : team.faculty;
    return {
      title: `${team.name} (${team.shortName})`,
      description: `Squad, form, results and stats for ${team.name} in the AKSU Vice-Chancellor's Cup. ${where}.`,
      openGraph: {
        title: `${team.name} · AKSU Score`,
        description: `Squad, form and stats — ${where}.`,
      },
    };
  } catch {
    // A metadata failure must never take the page down with it.
    return {};
  }
}

export default async function TeamPage({ params }: { params: { id: string } }) {
  let departments, matches, players;
  try {
    [departments, matches, players] = await Promise.all([
      getDepartments(),
      getMatches(),
      getPlayersWithRatings(),
    ]);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("database read failed:", detail);
    return <DbErrorNotice message={detail} />;
  }

  const team = departments.find((d) => d.id === params.id);
  if (!team) return notFound();

  // Built once on the server for the first paint; TeamProfileView rebuilds it
  // from the React Query cache as scores move, so a live match on this page
  // updates without a reload.
  const initialProfile = buildTeamProfile(team, matches, players, departments);

  return (
    <DataProvider departments={departments} players={players} serverNow={Date.now()}>
      <TeamProfileView
        teamId={team.id}
        initialProfile={initialProfile}
        initialMatches={matches}
        initialPlayers={players}
        initialDepartments={departments}
      />
    </DataProvider>
  );
}
