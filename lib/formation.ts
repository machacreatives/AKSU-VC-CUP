export type Slot = { x: number; y: number };

/** Offered in the teamsheet editor. Every one of these adds up to ten outfield. */
export const FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "4-1-4-1",
  "4-5-1",
  "3-5-2",
  "3-4-3",
  "5-3-2",
  "5-4-1",
  "4-4-1-1",
] as const;

export const DEFAULT_FORMATION = "4-4-2";

/**
 * Turns "4-2-3-1" into row sizes [1, 4, 2, 3, 1] — GK row first, then
 * one row per formation block, back to front.
 *
 * Exported because the teamsheet editor builds one picker per slot in exactly
 * this order: the starting XI is stored as an ordered array, and slot n of the
 * array is slot n on the pitch. Nothing else keeps those two in step.
 */
export function rowsFromFormation(formation: string): number[] {
  const blocks = formation.split("-").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n) && n > 0);
  return [1, ...blocks];
}

/** True when a formation names exactly ten outfield players. */
export function isValidFormation(formation: string): boolean {
  const rows = rowsFromFormation(formation);
  return rows.length >= 3 && rows.reduce((sum, n) => sum + n, 0) === 11;
}

/**
 * A label per row: goalkeeper, then defence at the back and attack at the
 * front, with everything between called midfield.
 */
export function rowLabels(formation: string): string[] {
  const rows = rowsFromFormation(formation);
  return rows.map((_, i) => {
    if (i === 0) return "Goalkeeper";
    if (i === 1) return "Defence";
    if (i === rows.length - 1) return "Attack";
    return "Midfield";
  });
}

/**
 * Computes evenly-spaced, non-overlapping slot positions for a team given
 * a formation string. Home teams are laid out in the bottom half attacking
 * up; away teams are mirrored into the top half attacking down — exactly
 * like a real tactical broadcast graphic.
 *
 * Row width scales with how many players are in that row (a 2-man pivot
 * stays tucked centrally; a back four spans wider) instead of stretching
 * every row to the same full width — that mismatch was what made rows
 * like a double pivot look scattered out toward the touchlines.
 */
export function layoutFormation(formation: string, side: "home" | "away"): Slot[] {
  const rows = rowsFromFormation(formation);
  const rowCount = rows.length;

  const yGK = side === "home" ? 95 : 5;
  const yAttack = side === "home" ? 56 : 44;
  const spacing = 20; // % width between adjacent players in the same row

  const slots: Slot[] = [];
  rows.forEach((count, rowIndex) => {
    const y = rowCount === 1 ? yGK : yGK + (yAttack - yGK) * (rowIndex / (rowCount - 1));
    const rowWidth = (count - 1) * spacing;
    const xStart = 50 - rowWidth / 2;
    for (let c = 0; c < count; c++) {
      const x = count === 1 ? 50 : xStart + c * spacing;
      slots.push({ x: Math.max(5, Math.min(95, x)), y });
    }
  });

  return slots;
}
