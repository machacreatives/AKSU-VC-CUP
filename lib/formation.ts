export type Slot = { x: number; y: number };

/**
 * Turns "4-2-3-1" into row sizes [1, 4, 2, 3, 1] — GK row first, then
 * one row per formation block, back to front.
 */
function rowsFromFormation(formation: string): number[] {
  const blocks = formation.split("-").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n) && n > 0);
  return [1, ...blocks];
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
