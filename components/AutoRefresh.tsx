"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Scores change while people are watching, so re-run the server component on a
// timer. router.refresh() re-fetches from Postgres and patches the tree in
// place, keeping the active tab and scroll position.
export default function AutoRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
