// Guest workers and what they send home (the last breadth gaps, 2026-11-24). A people abroad was a share of a land's
// people, kin who carried trade. Here those of them who went for the wage work as guests and send pay home.
// - Who are guests: those of a land's people come from another land (sim/culture/abroad.ts), while a year's work is worth
//   more where they are than where they came from (the wage gap that keeps them there), and as far as the gates between the
//   two realms let people and what they carry pass (rules/borders.ts: a realm's bar on coming in, the other's on leaving).
// - What they send: of what a guest's year earns above his own keep, a share (REMIT.sent) goes to the hearth he left; the less
//   the longer since they came (their children are of the new land), nothing after a generation of theirs.
// - What it does: that much of the host land's grain goes to the home land each year (never more than a share of what the
//   host has in store), where it feeds the hearths that sent them.
// Pure functions.
import { dmath } from "../kernel/index.ts";

export const REMIT = {
  /** Of what a guest earns above his keep, the share sent home (est: a seventh, as migrants' remittances run on Earth). */
  sent: 0.15,
  /** The most of a host land's grain in store that leaves it this way in a year. */
  storeMost: 0.05,
  /** The least sent, as a share of the home land's year of food, that is told. */
  told: 0.002,
} as const;

/** How far those who came `years` ago still send home (1 … 0 over a `generation` of theirs). */
export function remitTie(years: number, generation: number): number {
  return generation > 0 ? dmath.clamp(1 - Math.max(0, years) / generation, 0, 1) : 0;
}

/**
 * What a land's guests send home a year (grain): `workers` of them, a year's work worth `wageThere` where they are and
 * `wageHome` where they came from, `living` what keeps one of them a year, `tie` how far they still send (remitTie), `gates`
 * how far the borders between let it pass (0 … 1). Nothing where the work is worth no more there.
 */
export function remitted(
  workers: number,
  wageThere: number,
  wageHome: number,
  living: number,
  tie: number,
  gates: number,
): number {
  if (!(workers > 0) || !(wageThere > wageHome)) return 0;
  return (
    workers *
    Math.max(0, wageThere - living) *
    REMIT.sent *
    dmath.clamp(tie, 0, 1) *
    dmath.clamp(gates, 0, 1)
  );
}
