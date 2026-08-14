export type Campus = "main" | "obioakpa";

export type GroupId = "A" | "B" | "C" | "D";

// Which groups belong to which campus is fixed by the tournament format. This
// used to be duplicated inside app/HomeTabs.tsx, where the Table tab filtered
// by group alone — so a team whose campus and group disagreed rendered under
// the wrong campus. One definition, used by the UI and the API validation.
export const CAMPUS_GROUPS: Record<Campus, GroupId[]> = {
  main: ["A", "B"],
  obioakpa: ["C", "D"],
};

export const GROUP_CAMPUS: Record<GroupId, Campus> = {
  A: "main",
  B: "main",
  C: "obioakpa",
  D: "obioakpa",
};

export const CAMPUS_LABELS: Record<Campus, string> = {
  main: "Main Campus",
  obioakpa: "Obio Akpa Campus",
};

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
export type SquadRole = "CAPTAIN" | "VICE_CAPTAIN" | "PLAYER";
export type PlayerStatus = "ACTIVE" | "INJURED" | "SUSPENDED";

export const POSITIONS: PlayerPosition[] = ["GK", "DF", "MF", "FW"];
export const SQUAD_ROLES: SquadRole[] = ["CAPTAIN", "VICE_CAPTAIN", "PLAYER"];
export const PLAYER_STATUSES: PlayerStatus[] = ["ACTIVE", "INJURED", "SUSPENDED"];

export const SQUAD_ROLE_LABELS: Record<SquadRole, string> = {
  CAPTAIN: "Captain",
  VICE_CAPTAIN: "Vice-captain",
  PLAYER: "Player",
};

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  ACTIVE: "Active",
  INJURED: "Injured",
  SUSPENDED: "Suspended",
};

/**
 * The squad record an administrator actually owns and edits.
 *
 * Deliberately separate from `Player`: the write path takes this type, so it
 * is a compile error for a squad edit to carry goals or cards. Saving a player
 * form from stale state used to overwrite whatever had been scored since the
 * page loaded, because upsertPlayer wrote the counters too.
 */
export type PlayerProfile = {
  id: string;
  name: string;
  number: number;
  position: PlayerPosition;
  departmentId: string;
  squadRole: SquadRole;
  status: PlayerStatus;
};

/** Read model: the profile plus everything counted from match events. */
export type Player = PlayerProfile & {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating?: number;
};

export type MatchEvent = {
  id?: number;
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
  /**
   * Legacy manual minute. The live clock is derived from the kickoff
   * timestamps below (see lib/match-clock.ts); this is only a fallback for
   * rows recorded before the clock existed.
   */
  minute?: number;
  /** Set when the referee starts each half — the clock counts from these. */
  firstHalfStartedAt?: string | null;
  secondHalfStartedAt?: string | null;
  /** Announced stoppage time, set by the admin. */
  firstHalfAddedMinutes: number;
  secondHalfAddedMinutes: number;
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
