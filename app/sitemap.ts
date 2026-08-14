import type { MetadataRoute } from "next";
import { getMatches } from "@/lib/db/queries";
import { siteUrl } from "@/lib/site-url";

// The match list is read with noStore(), so Next cannot prerender this at
// build time. Saying so explicitly avoids a build-time "Dynamic server usage"
// error that looks like a failure but is only the sitemap doing its job.
export const dynamic = "force-dynamic";

/**
 * The home page plus every match.
 *
 * Wrapped in a try/catch on purpose: a sitemap that throws when the database is
 * briefly unreachable takes the whole route down, and an empty sitemap is a far
 * better failure than a 500 served to a crawler.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
  ];

  try {
    for (const match of await getMatches()) {
      entries.push({
        url: `${base}/match/${match.id}`,
        lastModified: match.kickoffAt ? new Date(match.kickoffAt) : undefined,
        changeFrequency: match.status === "FT" ? "monthly" : "hourly",
        priority: 0.7,
      });
    }
  } catch (err) {
    console.error("sitemap could not read matches:", err instanceof Error ? err.message : err);
  }

  return entries;
}
