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
const HEADER_ALIASES: Record<string, string> = {
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

export function normaliseHeader(cell: string): string | null {
  return HEADER_ALIASES[cell.trim().toLowerCase()] ?? null;
}

/** Maps a parsed CSV into objects keyed by our field names. */
export function toRecords(rows: CsvRow[]): { line: number; record: Record<string, string> }[] {
  if (rows.length === 0) return [];

  const headers = rows[0].values.map(normaliseHeader);
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
