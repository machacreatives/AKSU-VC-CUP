import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Resolved per request, matching the sitemap. Prerendered, this baked in the
// build machine's origin and pointed crawlers at a sitemap on the wrong host
// whenever NEXT_PUBLIC_SITE_URL was set at runtime only.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing under /admin is useful in an index, and it all redirects to a
        // login page anyway.
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
