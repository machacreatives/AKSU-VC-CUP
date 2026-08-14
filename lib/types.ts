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

export type MatchEventType = "GOAL" | "YELLOW" | "RED" | "SUB";

export type MatchEvent = {
  id?: number;
  minute: number;
  type: MatchEventType;
  departmentId: string;
  /** The squad member this is recorded against. Absent only on legacy rows. */
  playerId?: string;
  /** Kept alongside the id so the timeline survives a player being deleted. */
  playerName: string;
  /** GOAL only. */
  assistPlayerId?: string;
  assistPlayerName?: string;
  /** SUB only — the player coming on. `playerId` is the one going off. */
  subInPlayerId?: string;
  subInPlayerName?: string;
  detail?: string; // e.g. "Penalty"
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
  /** Named substitutes for this match — who the "coming on" picker offers. */
  bench?: string[];
  captainId?: string;
  stats?: TeamMatchStats;
};

/** A ground a fixture can be played at. Managed under admin settings. */
export type Venue = {
  id: string;
  name: string;
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
  /**
   * Display text — what a viewer reads on the card.
   *
   * Derived from `kickoffAt` and written at save time rather than formatted in
   * the browser, so the server and client render the same characters and there
   * is no hydration mismatch from a viewer in another timezone. Fixtures
   * created before the date picker existed keep whatever was typed.
   */
  kickoff: string;
  /** The actual scheduled instant, ISO-8601. Null on hand-typed legacy rows. */
  kickoffAt?: string | null;
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
