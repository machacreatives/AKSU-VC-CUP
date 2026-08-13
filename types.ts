export type Campus = "main" | "obioakpa";

export type GroupId = "A" | "B" | "C" | "D";

export type Department = {
  id: string;
  name: string;
  shortName: string; // 3-letter code, e.g. "CSC"
  faculty: string;
  campus: Campus;
  group: GroupId;
  color: string; // hex, badge + jersey accent
};

export type MatchStatus = "LIVE" | "UPCOMING" | "FT" | "HT";

export type PlayerPosition = "GK" | "DF" | "MF" | "FW";

export type Player = {
  id: string;
  name: string;
  number: number;
  position: PlayerPosition;
  departmentId: string;
  level: string; // e.g. "300L"
  rating?: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
};

export type MatchEvent = {
  minute: number;
  type: "GOAL" | "YELLOW" | "RED" | "SUB";
  departmentId: string;
  playerName: string;
  detail?: string; // e.g. assist name, or "Pen"
};

export type TeamMatchStats = {
  possession: number; // 0-100, home+away should sum to 100
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
};

export type MatchSide = {
  departmentId: string;
  score: number;
  formation?: string; // e.g. "4-2-3-1" — drives auto-layout, see lib/formation.ts
  startingXI?: string[]; // ordered playerIds: GK, then row by row, back to front
  captainId?: string;
  stats?: TeamMatchStats;
};

export type Match = {
  id: string;
  status: MatchStatus;
  minute?: number; // for LIVE / HT
  kickoff: string; // display string
  round: string; // e.g. "Matchday 3"
  group: GroupId;
  venue: string;
  home: MatchSide;
  away: MatchSide;
  events: MatchEvent[];
};

export type StandingsRow = {
  departmentId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: ("W" | "D" | "L")[];
};
