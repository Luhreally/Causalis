// Whole people from a rate: a group's killing, its losses and its men, carried from one reckoning to the next.
//
// A group's killing is a rate (so many a year, by its men and what it does), and a reckoning tells it in whole people. Rounded
// each time, a group whose rate is under one a year (under a hundred men, in peace) killed no one in all its history, and a
// crackdown that took one in ten of a gang of four took no one: the small were never touched. Instead what a reckoning comes to
// through the years it stands for is made whole, and the part of one left over is kept on the group (thousandths) to be added to
// the next: a group at 0.4 a year kills two in five years, four in ten. No draw: the same on any machine, and after a save.

/** What a rate a year comes to through `span` years, with the part of one carried in (`owed`, thousandths): whole, and carried on. */
export function wholeOver(
  perYear: number,
  span: number,
  owed = 0,
): { whole: number; owed: number } {
  const t = Math.max(0, perYear) * Math.max(1, span) + owed / 1000,
    whole = Math.floor(t + 1e-9);
  return { whole, owed: Math.max(0, Math.min(999, Math.round((t - whole) * 1000))) };
}

/** A group's men as it last was, the part of a man carried with them (thousandths). */
export const menOf = (g: { members: number; menPart?: number }): number =>
  g.members + (g.menPart ?? 0) / 1000;

/** A group's men set to `exact`: its whole men, and the part of one kept for the next time they change. */
export function setMen(g: { members: number; menPart?: number }, exact: number): void {
  const x = Math.max(0, exact),
    m = Math.floor(x + 1e-9),
    part = Math.round((x - m) * 1000);
  g.members = m;
  if (part > 0 && part < 1000) g.menPart = part;
  else delete g.menPart;
}
