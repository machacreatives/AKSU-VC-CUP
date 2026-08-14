"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { Department, Match, Player, Venue } from "@/lib/types";

// Every client-side read goes through here, so caching, keys and invalidation
// live in one place rather than being re-implemented per page.

export const queryKeys = {
  departments: ["departments"] as const,
  players: ["players"] as const,
  matches: ["matches"] as const,
  match: (id: string) => ["matches", id] as const,
  venues: ["venues"] as const,
  adminUsers: ["admin", "users"] as const,
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not read from the database.");
  }
  return res.json();
}

/** Teams and squads barely change during a match, so they can sit longer. */
const REFERENCE_DATA = { staleTime: 5 * 60_000 };

export function useDepartments(options?: Partial<UseQueryOptions<Department[], Error>>) {
  return useQuery({
    queryKey: queryKeys.departments,
    queryFn: () => getJson<Department[]>("/api/departments"),
    ...REFERENCE_DATA,
    ...options,
  });
}

export function usePlayers(options?: Partial<UseQueryOptions<Player[], Error>>) {
  return useQuery({
    queryKey: queryKeys.players,
    queryFn: () => getJson<Player[]>("/api/players"),
    ...REFERENCE_DATA,
    ...options,
  });
}

export function useVenues(options?: Partial<UseQueryOptions<Venue[], Error>>) {
  return useQuery({
    queryKey: queryKeys.venues,
    queryFn: () => getJson<Venue[]>("/api/admin/venues"),
    ...REFERENCE_DATA,
    ...options,
  });
}

// How often live data is re-read.
//
// One interval for everything was the wrong shape: 20 seconds is far too slow
// for a match in progress — a viewer watching the stats could sit most of half
// a minute behind whatever the admin had just typed — and far too eager for a
// fixture list that will not change until someone kicks off. So the rate
// follows the state of the data itself.
const LIVE_POLL_MS = 4_000;
const IDLE_POLL_MS = 60_000;

const isLive = (m: Match) => m.status === "LIVE" || m.status === "HT";

/**
 * Live data. Polls in the background so a scoreline updates without anyone
 * reloading, and `initialData` lets a server-rendered page hand over its own
 * first result instead of fetching it a second time on the client.
 *
 * Polling pauses while the tab is hidden (React Query's default) and a refetch
 * fires the moment it is focused again, so a phone in a pocket is not making
 * requests every four seconds all afternoon.
 */
export function useMatches(options?: Partial<UseQueryOptions<Match[], Error>>) {
  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: () => getJson<Match[]>("/api/matches"),
    staleTime: 0,
    refetchInterval: (query) =>
      (query.state.data ?? []).some(isLive) ? LIVE_POLL_MS : IDLE_POLL_MS,
    ...options,
  });
}

export function useMatch(id: string, options?: Partial<UseQueryOptions<Match, Error>>) {
  return useQuery({
    queryKey: queryKeys.match(id),
    queryFn: () => getJson<Match>(`/api/matches/${id}`),
    staleTime: 0,
    refetchInterval: (query) => {
      const match = query.state.data;
      return match && isLive(match) ? LIVE_POLL_MS : IDLE_POLL_MS;
    },
    ...options,
  });
}

async function sendJson(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}

/**
 * Writes go through here so the affected caches are invalidated centrally —
 * the failure mode otherwise is a page that saves successfully and then keeps
 * showing the old value from cache.
 */
export function useAdminMutation<TVars>(
  request: (vars: TVars) => Promise<unknown>,
  invalidate: readonly (readonly unknown[])[]
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => {
      invalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

export const api = { getJson, sendJson };
