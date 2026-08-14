export type Campus = "main" | "obioakpa";

export const CAMPUSES: Campus[] = ["main", "obioakpa"];

export const CAMPUS_LABELS: Record<Campus, string> = {
  main: "Main Campus",
  obioakpa: "Obio Akpa Campus",
};

/**
 * The id stored on a team or a fixture. Just a string now.
 *
 * This was a union of "A" | "B" | "C" | "D", which meant the tournament format
 * was a compile-time fact: adding a group was a code change, a deploy, and two
 * database constraints. Groups are rows in the `groups` table now, so the type
 * cannot enumerate them and every list of groups comes from the data.
 */
export type GroupId = string;

export type Group = {
  id: string;
  /** What the admin typed — usually a letter. Rendered as "Group {name}". */
  name: string;
  campus: Campus;
  /** Display order within a campus. Ties fall back to name. */
  sortOrder: number;
};

/**
 * Groups on one campus, in display order.
 *
 * Replaces the old CAMPUS_GROUPS constant. Every caller now passes the list it
 * already loaded, which also removes the old trap where the public table
 * filtered by group alone and a team whose campus and group disagreed rendered
 * under the wrong heading.
 */
export function groupsForCampus(groups: Group[], campus: Campus): Group[] {
  return groups
    .filter((g) => g.campus === campus)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function sortGroups(groups: Group[]): Group[] {
  return [...groups].sort(
    (a, b) =>
      CAMPUSES.indexOf(a.campus) - CAMPUSES.indexOf(b.campus) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name)
  );
}

export function findGroup(groups: Group[], id: string | null | undefined): Group | undefined {
  return groups.find((g) => g.id === id);
}

/** "Group A". Kept in one place so the word "Group" is never hand-typed. */
export function groupLabel(group: Group | undefined, fallbackId?: string): string {
  return `Group ${group?.name ?? fallbackId ?? "?"}`;
}

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

/**
 * How a goal was scored.
 *
 * Structured rather than left in the free-text `detail` field, because the
 * lineup graphic marks a penalty and a free kick differently and nothing can
 * reliably read "pen." or "Penalty!!" out of a note somebody typed.
 */
export type GoalType = "OPEN_PLAY" | "PENALTY" | "FREE_KICK";

export const GOAL_TYPES: GoalType[] = ["OPEN_PLAY", "PENALTY", "FREE_KICK"];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  OPEN_PLAY: "Open play",
  PENALTY: "Penalty",
  FREE_KICK: "Free kick",
};

/** Where a fixture sits in the tournament. Only GROUP counts toward a table. */
export type MatchStage = "GROUP" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";

export const MATCH_STAGES: MatchStage[] = ["GROUP", "R16", "QF", "SF", "THIRD", "FINAL"];

export const STAGE_LABELS: Record<MatchStage, string> = {
  GROUP: "Group stage",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  THIRD: "Third place",
  FINAL: "Final",
};

/** The bracket, in order, excluding the group stage. */
export const KNOCKOUT_STAGES: MatchStage[] = ["R16", "QF", "SF", "THIRD", "FINAL"];

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
  /** GOAL only. Absent on goals recorded before this was captured. */
  goalType?: GoalType;
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
  /** Null on a knockout tie, which belongs to the bracket rather than a group. */
  group: GroupId | null;
  stage: MatchStage;
  /** Chosen by the admin once the match is done. */
  manOfTheMatchId?: string | null;
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
