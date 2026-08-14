import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDepartments, getMatch, getPlayersWithRatings } from "@/lib/db/queries";
import { STAGE_LABELS } from "@/lib/types";
import { DataProvider } from "@/lib/data-context";
import DbErrorNotice from "@/components/DbErrorNotice";
import MatchLive from "./MatchLive";

export const dynamic = "force-dynamic";

/**
 * What a shared match link looks like.
 *
 * There was one site-wide title and no Open Graph tags, so ten different match
 * URLs pasted into a group chat produced ten identical previews reading
 * "AKSU Score — Vice-Chancellor's Cup". On a campus tournament that spreads by
 * link-sharing, the preview *is* the product.
 */
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const [match, departments] = await Promise.all([getMatch(params.id), getDepartments()]);
    if (!match) return { title: "Match not found" };

    const name = (id: string) => departments.find((d) => d.id === id)?.shortName ?? "???";
    const home = name(match.home.departmentId);
    const away = name(match.away.departmentId);

    const state =
      match.status === "UPCOMING"
        ? match.kickoff
        : match.status === "FT"
        ? "FT"
        : match.status === "HT"
        ? "HT"
        : "LIVE";

    const title =
      match.status === "UPCOMING"
        ? `${home} v ${away}`
        : `${home} ${match.home.score} - ${match.away.score} ${away}`;

    const where = [
      match.stage && match.stage !== "GROUP"
        ? STAGE_LABELS[match.stage]
        : match.group
        ? `Group ${match.group}`
        : null,
      match.round,
      match.venue,
    ]
      .filter(Boolean)
      .join(" · ");

    const description = `${state}${where ? ` · ${where}` : ""}`;

    return {
      title,
      description,
      openGraph: { title: `${title} · ${state}`, description, type: "article" },
      twitter: { card: "summary_large_image", title: `${title} · ${state}`, description },
    };
  } catch {
    // A metadata failure must never take the page down with it.
    return {};
  }
}

export default async function MatchPage({ params }: { params: { id: string } }) {
  let match, departments, players;
  try {
    [match, departments, players] = await Promise.all([
      getMatch(params.id),
      getDepartments(),
      getPlayersWithRatings(),
    ]);
  } catch (err) {
    // Logged here, never sent to the browser in production — the driver
    // message carries table names and the database hostname.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("database read failed:", detail);
    return <DbErrorNotice message={detail} />;
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
