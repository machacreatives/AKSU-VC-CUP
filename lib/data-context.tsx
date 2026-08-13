"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Department, Player } from "@/lib/types";

// Every card, table and pitch needs to turn a departmentId / playerId into a
// full record. That used to be a module-level lookup into mock-data; now the
// server pages load both lists from Postgres and hand them down through here.

type Data = {
  departments: Department[];
  players: Player[];
  departmentsById: Map<string, Department>;
  playersById: Map<string, Player>;
  /** Server time when the page was rendered, in ms. Anchors the match clock. */
  serverNow: number;
};

const DataContext = createContext<Data | null>(null);

export function DataProvider({
  departments,
  players,
  serverNow,
  children,
}: {
  departments: Department[];
  players: Player[];
  serverNow: number;
  children: React.ReactNode;
}) {
  const value = useMemo<Data>(
    () => ({
      departments,
      players,
      serverNow,
      departmentsById: new Map(departments.map((d) => [d.id, d])),
      playersById: new Map(players.map((p) => [p.id, p])),
    }),
    [departments, players, serverNow]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function useData(): Data {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}

export function useDepartments(): Department[] {
  return useData().departments;
}

export function usePlayers(): Player[] {
  return useData().players;
}

// A match can reference a department that was deleted in admin. Render a
// neutral placeholder instead of crashing the whole page.
const unknownDepartment = (id: string): Department => ({
  id,
  name: "Unknown",
  shortName: "???",
  faculty: "",
  campus: "main",
  group: "A",
  color: "#6B7280",
});

export function useDepartment(id: string): Department {
  return useData().departmentsById.get(id) ?? unknownDepartment(id);
}

// For components that look up inside a .map() — a hook can't be called in a
// loop, so take the lookup function once and call it freely.
export function useDepartmentLookup(): (id: string) => Department {
  const { departmentsById } = useData();
  return (id) => departmentsById.get(id) ?? unknownDepartment(id);
}

const unknownPlayer = (id: string): Player => ({
  id,
  name: "Unknown",
  number: 0,
  position: "MF",
  departmentId: "",
  level: "",
  goals: 0,
  assists: 0,
  yellowCards: 0,
  redCards: 0,
});

export function usePlayer(id: string): Player {
  return useData().playersById.get(id) ?? unknownPlayer(id);
}

export function usePlayerLookup(): (id: string) => Player {
  const { playersById } = useData();
  return (id) => playersById.get(id) ?? unknownPlayer(id);
}

/**
 * A clock that ticks every second, anchored to the server.
 *
 * The first value is exactly the server's timestamp, so the initial client
 * render matches what was server-rendered and React has nothing to complain
 * about. After mount it switches to real time, corrected by the offset between
 * this device's clock and the server's — a viewer whose laptop is five minutes
 * fast should still see the right match minute.
 */
export function useNow(tickMs = 1000): number {
  const { serverNow } = useData();
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const skew = Date.now() - serverNow;
    const tick = () => setNow(Date.now() - skew);
    tick();
    const id = setInterval(tick, tickMs);
    return () => clearInterval(id);
  }, [serverNow, tickMs]);

  return now;
}
