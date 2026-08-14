import MatchGone from "@/components/MatchGone";

// Rendered by notFound() in page.tsx. Without this file Next serves its own
// bare "404 | This page could not be found" — no header, no way back, and no
// hint that the fixture was removed rather than the site being broken.
export default function MatchNotFound() {
  return <MatchGone reason="missing" />;
}
