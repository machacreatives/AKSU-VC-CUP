// Kickoff times.
//
// A fixture is scheduled at a moment in time, but the site shows a short human
// string ("Sat 16 Aug, 3:00 PM"). Both are stored: `kickoff_at` is the instant
// the admin picked and is what a date picker edits, `kickoff` is the rendered
// text that pages display.
//
// The text is generated once, on the server, at save time. Formatting it in
// the browser instead would make the markup depend on the viewer's clock
// settings, which is both a hydration mismatch and wrong: a match kicks off at
// three in the afternoon in Akwa Ibom whether you are reading it there or not.

/** Akwa Ibom is UTC+1 all year — Nigeria has no daylight saving. */
export const TOURNAMENT_UTC_OFFSET = "+01:00";

/**
 * Turn what `<input type="datetime-local">` produces ("2026-08-16T15:00") into
 * an instant, reading it as local tournament time.
 *
 * Returns null for anything unparseable, so a blank or half-typed field just
 * means "no date set" rather than an Invalid Date reaching the database.
 */
export function kickoffInputToIso(local: string): string | null {
  const trimmed = local.trim();
  if (!trimmed) return null;

  // The browser omits seconds when they are zero.
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/.exec(trimmed);
  if (!match) return null;

  const date = new Date(`${match[1]}T${match[2]}${match[3] ?? ":00"}${TOURNAMENT_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The inverse: an instant back into the picker's expected value. */
export function isoToKickoffInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const parts = tournamentParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * The text viewers read. Deliberately no year: every fixture is this season's.
 */
export function formatKickoff(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\s(am|pm)/i, (m) => m.toUpperCase());
}

/** Date-only, for grouping fixtures under a day heading. */
export function formatKickoffDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

// Intl is the only reliable way to read a date in a named timezone without
// pulling in a date library; getFullYear() and friends would answer in
// whatever zone the server happens to run in, which on Vercel is UTC.
function tournamentParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  // At midnight en-GB reports the hour as "24" rather than "00".
  const hour = get("hour") === "24" ? "00" : get("hour");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
  };
}
