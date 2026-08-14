"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Created inside the component, not at module scope: a module-level client
  // would be shared across every request on the server and leak one visitor's
  // data into another's.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is served from cache for this long without a network trip,
            // which is what stops every navigation showing a loading state.
            staleTime: 30_000,
            // Keep it around after the last component unmounts, so going back
            // to a page you just left is instant.
            gcTime: 5 * 60_000,
            // Scores move while people watch, so coming back to the tab should
            // quietly bring it up to date.
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
