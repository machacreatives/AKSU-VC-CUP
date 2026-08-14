/**
 * The public origin of the site.
 *
 * Where share cards, robots.txt and the sitemap all get their absolute URLs.
 * Read per call rather than captured in a module constant: robots.txt is a
 * static route, so a constant would bake in whatever the build machine had and
 * then disagree with the sitemap, which is dynamic. One function, read at
 * request time, keeps the two saying the same thing.
 *
 * NEXT_PUBLIC_SITE_URL wins when set — it is the only one that can name a
 * custom domain. VERCEL_URL is the per-deployment hostname Vercel always
 * supplies, which is right for previews and correct-if-ugly in production.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
