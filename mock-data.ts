import { Department, Match, Player, StandingsRow } from "./types";

export const tournamentName = "Vice-Chancellor's Cup";
export const season = "2025/26";

// Sourced from AKSU's own campus/faculty listing:
// Main Campus — Ikot Akpaden, Mkpat Enin LGA: Engineering, Physical Sciences,
//   Biological Sciences, Education, Law.
// Obio Akpa Campus — Oruk Anam LGA: Arts, Agriculture, Social Sciences,
//   Management Sciences.
export const departments: Department[] = [
  // Main Campus — Group A
  { id: "csc", name: "Computer Science", shortName: "CSC", faculty: "Physical Sciences", campus: "main", group: "A", color: "#FF6B4A" },
  { id: "eee", name: "Electrical/Electronic Eng.", shortName: "EEE", faculty: "Engineering", campus: "main", group: "A", color: "#C9A227" },
  { id: "mcb", name: "Microbiology", shortName: "MCB", faculty: "Biological Sciences", campus: "main", group: "A", color: "#2FBF71" },
  { id: "law", name: "Law", shortName: "LAW", faculty: "Law", campus: "main", group: "A", color: "#E0457B" },
  // Main Campus — Group B
  { id: "cve", name: "Civil Engineering", shortName: "CVE", faculty: "Engineering", campus: "main", group: "B", color: "#D96B2B" },
  { id: "mth", name: "Mathematics & Statistics", shortName: "MTH", faculty: "Physical Sciences", campus: "main", group: "B", color: "#8BC53F" },
  { id: "chm", name: "Chemistry", shortName: "CHM", faculty: "Physical Sciences", campus: "main", group: "B", color: "#C0392B" },
  { id: "zly", name: "Zoology", shortName: "ZLY", faculty: "Biological Sciences", campus: "main", group: "B", color: "#16A085" },
  // Obio Akpa Campus — Group C
  { id: "acc", name: "Accounting", shortName: "ACC", faculty: "Management Sciences", campus: "obioakpa", group: "C", color: "#F0A500" },
  { id: "mcm", name: "Mass Communication", shortName: "MCM", faculty: "Social Sciences", campus: "obioakpa", group: "C", color: "#A0623D" },
  { id: "eco", name: "Economics", shortName: "ECO", faculty: "Social Sciences", campus: "obioakpa", group: "C", color: "#E85D75" },
  { id: "eng", name: "English", shortName: "ENG", faculty: "Arts", campus: "obioakpa", group: "C", color: "#6FCF97" },
  // Obio Akpa Campus — Group D
  { id: "bus", name: "Business Administration", shortName: "BUS", faculty: "Management Sciences", campus: "obioakpa", group: "D", color: "#D4622F" },
  { id: "age", name: "Agricultural Economics", shortName: "AGE", faculty: "Agriculture", campus: "obioakpa", group: "D", color: "#B94592" },
  { id: "the", name: "Theatre Arts", shortName: "THE", faculty: "Arts", campus: "obioakpa", group: "D", color: "#E67E22" },
  { id: "pol", name: "Political Science", shortName: "POL", faculty: "Social Sciences", campus: "obioakpa", group: "D", color: "#27AE60" },
];

const dep = (id: string) => departments.find((d) => d.id === id)!;
export function getDepartment(id: string): Department {
  return dep(id);
}

export const players: Player[] = [
  // CSC — starting XI (home, match m1)
  { id: "csc-1", name: "Daniel Umoh", number: 1, position: "GK", departmentId: "csc", level: "300L", rating: 6.9, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: "csc-2", name: "Bright Sam", number: 2, position: "DF", departmentId: "csc", level: "200L", rating: 7.0, goals: 0, assists: 1, yellowCards: 1, redCards: 0 },
  { id: "csc-4", name: "Michael Okoro", number: 4, position: "DF", departmentId: "csc", level: "400L", rating: 6.8, goals: 0, assists: 0, yellowCards: 2, redCards: 0 },
  { id: "csc-5", name: "Wisdom Nya", number: 5, position: "DF", departmentId: "csc", level: "300L", rating: 6.7, goals: 0, assists: 0, yellowCards: 1, redCards: 0 },
  { id: "csc-3", name: "Chidi Nnamdi", number: 3, position: "DF", departmentId: "csc", level: "200L", rating: 6.9, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: "csc-6", name: "Frank Etuk", number: 6, position: "MF", departmentId: "csc", level: "300L", rating: 7.1, goals: 1, assists: 2, yellowCards: 0, redCards: 0 },
  { id: "csc-8", name: "Peter Effiong", number: 8, position: "MF", departmentId: "csc", level: "400L", rating: 7.0, goals: 0, assists: 1, yellowCards: 0, redCards: 0 },
  { id: "csc-7", name: "Joseph Akan", number: 7, position: "FW", departmentId: "csc", level: "200L", rating: 7.2, goals: 3, assists: 2, yellowCards: 0, redCards: 0 },
  { id: "csc-10", name: "Godwin Etim", number: 10, position: "MF", departmentId: "csc", level: "400L", rating: 7.6, goals: 2, assists: 4, yellowCards: 0, redCards: 0 },
  { id: "csc-11", name: "Iniobong Ben", number: 11, position: "FW", departmentId: "csc", level: "300L", rating: 7.3, goals: 4, assists: 1, yellowCards: 1, redCards: 0 },
  { id: "csc-9", name: "Emmanuel Udoh", number: 9, position: "FW", departmentId: "csc", level: "300L", rating: 8.6, goals: 13, assists: 3, yellowCards: 1, redCards: 0 },

  // EEE — starting XI (away, match m1)
  { id: "eee-1", name: "Aniekan Ntuk", number: 1, position: "GK", departmentId: "eee", level: "400L", rating: 7.1, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: "eee-2", name: "Ubong Frank", number: 2, position: "DF", departmentId: "eee", level: "300L", rating: 6.6, goals: 0, assists: 0, yellowCards: 1, redCards: 0 },
  { id: "eee-4", name: "Emem Peter", number: 4, position: "DF", departmentId: "eee", level: "200L", rating: 6.5, goals: 0, assists: 0, yellowCards: 2, redCards: 0 },
  { id: "eee-5", name: "Godwin Okoro", number: 5, position: "DF", departmentId: "eee", level: "300L", rating: 6.4, goals: 0, assists: 0, yellowCards: 1, redCards: 1 },
  { id: "eee-3", name: "Christopher John", number: 3, position: "DF", departmentId: "eee", level: "400L", rating: 6.7, goals: 0, assists: 1, yellowCards: 0, redCards: 0 },
  { id: "eee-6", name: "Enobong James", number: 6, position: "MF", departmentId: "eee", level: "300L", rating: 6.8, goals: 0, assists: 1, yellowCards: 1, redCards: 0 },
  { id: "eee-8", name: "Mfon Akpan", number: 8, position: "MF", departmentId: "eee", level: "200L", rating: 6.9, goals: 1, assists: 1, yellowCards: 0, redCards: 0 },
  { id: "eee-7", name: "Daniel Ukpong", number: 7, position: "FW", departmentId: "eee", level: "300L", rating: 6.9, goals: 2, assists: 2, yellowCards: 0, redCards: 0 },
  { id: "eee-10", name: "Praise Nya", number: 10, position: "MF", departmentId: "eee", level: "400L", rating: 7.2, goals: 3, assists: 5, yellowCards: 1, redCards: 0 },
  { id: "eee-11", name: "Samuel Ibe", number: 11, position: "FW", departmentId: "eee", level: "300L", rating: 6.8, goals: 2, assists: 1, yellowCards: 0, redCards: 0 },
  { id: "eee-9", name: "Ekpo Williams", number: 9, position: "FW", departmentId: "eee", level: "200L", rating: 7.4, goals: 8, assists: 2, yellowCards: 1, redCards: 0 },

  // Standout players from the rest of the league (for tables/leaderboards)
  { id: "mcb-9", name: "Daniel Etim", number: 9, position: "FW", departmentId: "mcb", level: "200L", rating: 7.9, goals: 9, assists: 4, yellowCards: 0, redCards: 0 },
  { id: "law-10", name: "Victor Akpan", number: 10, position: "MF", departmentId: "law", level: "400L", rating: 8.1, goals: 7, assists: 9, yellowCards: 2, redCards: 0 },
  { id: "law-5", name: "Kufre Essien", number: 5, position: "DF", departmentId: "law", level: "300L", rating: 7.0, goals: 1, assists: 2, yellowCards: 6, redCards: 0 },
  { id: "cve-8", name: "Ubong Ekong", number: 8, position: "MF", departmentId: "cve", level: "500L", rating: 8.3, goals: 5, assists: 10, yellowCards: 1, redCards: 0 },
  { id: "zly-3", name: "Ifiok James", number: 3, position: "DF", departmentId: "zly", level: "200L", rating: 6.5, goals: 0, assists: 1, yellowCards: 7, redCards: 1 },
  { id: "mcm-11", name: "Godswill Okon", number: 11, position: "FW", departmentId: "mcm", level: "200L", rating: 7.7, goals: 8, assists: 5, yellowCards: 1, redCards: 0 },
  { id: "eco-6", name: "Anietie Umoh", number: 6, position: "MF", departmentId: "eco", level: "300L", rating: 7.4, goals: 4, assists: 6, yellowCards: 3, redCards: 0 },
  { id: "acc-4", name: "Samuel Bassey", number: 4, position: "DF", departmentId: "acc", level: "300L", rating: 6.6, goals: 2, assists: 1, yellowCards: 5, redCards: 1 },
  { id: "bus-9", name: "Ekemini Sunday", number: 9, position: "FW", departmentId: "bus", level: "200L", rating: 7.5, goals: 6, assists: 3, yellowCards: 2, redCards: 0 },
  { id: "the-7", name: "Utibe Robson", number: 7, position: "FW", departmentId: "the", level: "300L", rating: 7.2, goals: 5, assists: 2, yellowCards: 4, redCards: 0 },
];

function findPlayer(id: string): Player {
  const p = players.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown player id: ${id}`);
  return p;
}
export { findPlayer };

export const matches: Match[] = [
  {
    id: "m1",
    status: "LIVE",
    minute: 63,
    kickoff: "Today, 4:00 PM",
    round: "Matchday 3",
    group: "A",
    venue: "AKSU Main Bowl, Ikot Akpaden",
    home: {
      departmentId: "csc",
      score: 2,
      formation: "4-2-3-1",
      startingXI: ["csc-1", "csc-2", "csc-4", "csc-5", "csc-3", "csc-6", "csc-8", "csc-7", "csc-10", "csc-11", "csc-9"],
      captainId: "csc-10",
      stats: { possession: 57, shots: 11, shotsOnTarget: 6, corners: 5, fouls: 7 },
    },
    away: {
      departmentId: "eee",
      score: 1,
      formation: "4-2-3-1",
      startingXI: ["eee-1", "eee-2", "eee-4", "eee-5", "eee-3", "eee-6", "eee-8", "eee-7", "eee-10", "eee-11", "eee-9"],
      captainId: "eee-10",
      stats: { possession: 43, shots: 7, shotsOnTarget: 3, corners: 2, fouls: 9 },
    },
    events: [
      { minute: 12, type: "GOAL", departmentId: "csc", playerName: "Emmanuel Udoh", detail: "Assist: Bright Sam" },
      { minute: 29, type: "YELLOW", departmentId: "eee", playerName: "Godwin Okoro" },
      { minute: 41, type: "GOAL", departmentId: "eee", playerName: "Ekpo Williams", detail: "Assist: Praise Nya" },
      { minute: 58, type: "GOAL", departmentId: "csc", playerName: "Emmanuel Udoh", detail: "Assist: Godwin Etim" },
      { minute: 61, type: "RED", departmentId: "eee", playerName: "Godwin Okoro", detail: "Second yellow" },
    ],
  },
  {
    id: "m2",
    status: "HT",
    minute: 45,
    kickoff: "Today, 4:00 PM",
    round: "Matchday 3",
    group: "A",
    venue: "Faculty of Science Field",
    home: { departmentId: "mcb", score: 1, stats: { possession: 52, shots: 6, shotsOnTarget: 3, corners: 3, fouls: 4 } },
    away: { departmentId: "law", score: 1, stats: { possession: 48, shots: 5, shotsOnTarget: 2, corners: 2, fouls: 6 } },
    events: [
      { minute: 8, type: "GOAL", departmentId: "mcb", playerName: "Daniel Etim" },
      { minute: 33, type: "GOAL", departmentId: "law", playerName: "Victor Akpan", detail: "Assist: Kufre Essien" },
      { minute: 38, type: "YELLOW", departmentId: "law", playerName: "Kufre Essien" },
    ],
  },
  {
    id: "m3",
    status: "UPCOMING",
    kickoff: "Tomorrow, 2:00 PM",
    round: "Matchday 3",
    group: "B",
    venue: "AKSU Main Bowl, Ikot Akpaden",
    home: { departmentId: "cve", score: 0 },
    away: { departmentId: "mth", score: 0 },
    events: [],
  },
  {
    id: "m4",
    status: "UPCOMING",
    kickoff: "Tomorrow, 4:00 PM",
    round: "Matchday 3",
    group: "B",
    venue: "Faculty of Science Field",
    home: { departmentId: "chm", score: 0 },
    away: { departmentId: "zly", score: 0 },
    events: [],
  },
  {
    id: "m5",
    status: "FT",
    kickoff: "Yesterday",
    round: "Matchday 2",
    group: "C",
    venue: "Obio Akpa Campus Field",
    home: { departmentId: "acc", score: 0, stats: { possession: 39, shots: 4, shotsOnTarget: 1, corners: 1, fouls: 8 } },
    away: { departmentId: "mcm", score: 3, stats: { possession: 61, shots: 13, shotsOnTarget: 7, corners: 6, fouls: 5 } },
    events: [
      { minute: 15, type: "GOAL", departmentId: "mcm", playerName: "Godswill Okon" },
      { minute: 52, type: "GOAL", departmentId: "mcm", playerName: "Godswill Okon" },
      { minute: 70, type: "GOAL", departmentId: "mcm", playerName: "Godswill Okon", detail: "Hat-trick" },
      { minute: 77, type: "RED", departmentId: "acc", playerName: "Samuel Bassey" },
    ],
  },
  {
    id: "m6",
    status: "FT",
    kickoff: "Yesterday",
    round: "Matchday 2",
    group: "C",
    venue: "Obio Akpa Campus Field",
    home: { departmentId: "eco", score: 2, stats: { possession: 50, shots: 9, shotsOnTarget: 5, corners: 4, fouls: 6 } },
    away: { departmentId: "eng", score: 2, stats: { possession: 50, shots: 8, shotsOnTarget: 4, corners: 3, fouls: 5 } },
    events: [
      { minute: 19, type: "GOAL", departmentId: "eco", playerName: "Anietie Umoh" },
      { minute: 44, type: "GOAL", departmentId: "eng", playerName: "Sunday Bassey" },
      { minute: 66, type: "GOAL", departmentId: "eco", playerName: "Anietie Umoh", detail: "Penalty" },
      { minute: 81, type: "GOAL", departmentId: "eng", playerName: "Sunday Bassey" },
    ],
  },
  {
    id: "m7",
    status: "UPCOMING",
    kickoff: "Sat, 3:00 PM",
    round: "Matchday 3",
    group: "D",
    venue: "Obio Akpa Campus Field",
    home: { departmentId: "bus", score: 0 },
    away: { departmentId: "age", score: 0 },
    events: [],
  },
  {
    id: "m8",
    status: "FT",
    kickoff: "2 days ago",
    round: "Matchday 2",
    group: "D",
    venue: "Obio Akpa Campus Field",
    home: { departmentId: "the", score: 1, stats: { possession: 55, shots: 8, shotsOnTarget: 3, corners: 4, fouls: 7 } },
    away: { departmentId: "pol", score: 1, stats: { possession: 45, shots: 6, shotsOnTarget: 3, corners: 2, fouls: 9 } },
    events: [
      { minute: 23, type: "GOAL", departmentId: "the", playerName: "Utibe Robson" },
      { minute: 68, type: "GOAL", departmentId: "pol", playerName: "Ememobong Udo" },
    ],
  },
];

export const standings: StandingsRow[] = [
  // Group A — Main Campus
  { departmentId: "csc", played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 6, goalsAgainst: 1, points: 6, form: ["W", "W"] },
  { departmentId: "mcb", played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 4, goalsAgainst: 2, points: 4, form: ["W", "D"] },
  { departmentId: "law", played: 2, won: 0, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 1, form: ["L", "D"] },
  { departmentId: "eee", played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 6, points: 0, form: ["L", "L"] },
  // Group B — Main Campus
  { departmentId: "cve", played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 5, goalsAgainst: 1, points: 6, form: ["W", "W"] },
  { departmentId: "chm", played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 3, goalsAgainst: 3, points: 3, form: ["W", "L"] },
  { departmentId: "zly", played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 3, goalsAgainst: 3, points: 3, form: ["L", "W"] },
  { departmentId: "mth", played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 5, points: 0, form: ["L", "L"] },
  // Group C — Obio Akpa Campus
  { departmentId: "mcm", played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 5, goalsAgainst: 1, points: 6, form: ["W", "W"] },
  { departmentId: "eco", played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 4, goalsAgainst: 2, points: 4, form: ["W", "D"] },
  { departmentId: "eng", played: 2, won: 0, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 4, points: 1, form: ["D", "L"] },
  { departmentId: "acc", played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 6, points: 0, form: ["L", "L"] },
  // Group D — Obio Akpa Campus
  { departmentId: "the", played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 3, goalsAgainst: 2, points: 4, form: ["W", "D"] },
  { departmentId: "pol", played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 3, goalsAgainst: 2, points: 4, form: ["D", "W"] },
  { departmentId: "bus", played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 3, goalsAgainst: 3, points: 3, form: ["W", "L"] },
  { departmentId: "age", played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 4, points: 0, form: ["L", "L"] },
];

export const topScorers = [...players].sort((a, b) => b.goals - a.goals);
export const topAssisters = [...players].sort((a, b) => b.assists - a.assists);
export const topRated = [...players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
export const mostCarded = [...players]
  .map((p) => ({ ...p, cardScore: p.redCards * 3 + p.yellowCards }))
  .sort((a, b) => b.cardScore - a.cardScore)
  .filter((p) => p.cardScore > 0);
