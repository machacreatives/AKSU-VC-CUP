// A small CSV reader for the squad importer.
//
// Written by hand rather than pulling in a parser: the project has three
// runtime dependencies and this is the only screen that needs one. It handles
// what a spreadsheet export actually produces — a UTF-8 BOM, CRLF endings,
// quoted fields containing commas or newlines, and doubled quotes as escapes.

export type CsvRow = { line: number; values: string[] };

export function parseCsv(input: string): CsvRow[] {
  const text = input.replace(/^﻿/, ""); // Excel writes a BOM
  const rows: CsvRow[] = [];

  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;

  const endField = () => {
    record.push(field.trim());
    field = "";
  };
  const endRecord = () => {
    endField();
    // Skip rows that are entirely empty — trailing newlines are normal.
    if (record.some((v) => v !== "")) rows.push({ line: recordStartLine, values: record });
    record = [];
    recordStartLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line++;
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\r") {
      // handled by the \n that follows
    } else if (char === "\n") {
      line++;
      endRecord();
    } else {
      field += char;
    }
  }

  if (field !== "" || record.length > 0) endRecord();

  return rows;
}

// Spreadsheet headers are typed by people, so accept the obvious variants
// rather than failing on "No." or "Full Name".
export const PLAYER_HEADERS: Record<string, string> = {
  name: "name",
  "full name": "name",
  player: "name",
  "player name": "name",
  number: "number",
  no: "number",
  "no.": "number",
  shirt: "number",
  "shirt number": "number",
  jersey: "number",
  position: "position",
  pos: "position",
  squad_role: "squadRole",
  "squad role": "squadRole",
  role: "squadRole",
  status: "status",
};

export const TEAM_HEADERS: Record<string, string> = {
  name: "name",
  team: "name",
  "team name": "name",
  department: "name",
  "department name": "name",
  short_name: "shortName",
  "short name": "shortName",
  short: "shortName",
  code: "shortName",
  abbr: "shortName",
  abbreviation: "shortName",
  badge: "shortName",
  faculty: "faculty",
  school: "faculty",
  campus: "campus",
  group: "group",
  "group name": "group",
  pool: "group",
  color: "color",
  colour: "color",
  "team color": "color",
  "team colour": "color",
};

export function normaliseHeader(
  cell: string,
  aliases: Record<string, string> = PLAYER_HEADERS
): string | null {
  return aliases[cell.trim().toLowerCase()] ?? null;
}

/** Maps a parsed CSV into objects keyed by our field names. */
export function toRecords(
  rows: CsvRow[],
  aliases: Record<string, string> = PLAYER_HEADERS
): { line: number; record: Record<string, string> }[] {
  if (rows.length === 0) return [];

  const headers = rows[0].values.map((cell) => normaliseHeader(cell, aliases));
  return rows.slice(1).map(({ line, values }) => {
    const record: Record<string, string> = {};
    headers.forEach((key, i) => {
      if (key) record[key] = values[i] ?? "";
    });
    return { line, record };
  });
}

export const CSV_TEMPLATE = `name,number,position,squad_role,status
Udo Effiong,9,FW,captain,active
Emem Bassey,1,GK,player,active
Aniekan Peter,4,DF,vice_captain,injured
`;

// Colour is optional in the template on purpose: filling sixteen hex codes by
// hand is the sort of thing that stops a bulk import being worth doing, and a
// blank one gets a distinct colour assigned automatically.
export const TEAM_CSV_TEMPLATE = `name,short_name,faculty,campus,group,color
Computer Science,CSC,Physical Sciences,main,A,#F2661F
Law,LAW,Law,main,A,
Accounting,ACC,Management Sciences,obioakpa,C,
`;
