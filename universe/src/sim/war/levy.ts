// The levy (Phase 55 M224b, D2): a realm raises its host from all its lands on its home world, each
// land sending men by its fighting men, as the Anglo-Saxon fyrd sent a man for each five hides
// (Domesday) and the county muster rolls drew in the same way. No land is spared for being far from
// the seat: there is no falloff by distance. A land's men who could fall are its grown men of
// fighting age at work (not its dependents), less the hand's own: the god's village sends no one.
// Its lands on the system's other bodies send no one either. No draws: who of the sent fall is the
// war's to draw (war.ts, by FALL_PURPOSE).
import { offworldSite } from "../../gen/index.ts";
import { BANDS, MALE, apportionCapped, type LifeHistory } from "../../rules/index.ts";
import { handOf } from "../hand/hand.ts";
import { COLS, row } from "../population/model.ts";
import type { Polity } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";

/** The first draw purpose of a side's fall (FIGHT stream): its k-th land draws by FALL_PURPOSE + k. */
export const FALL_PURPOSE = 32;

/** Whether an age band fights: the grown, before the last third of life (fifteen to fifty, for upright apes). */
export function fighting(life: LifeHistory, band: number): boolean {
  return life.bands[band]! >= life.adulthood && life.bands[band]! < life.bands[7]!;
}

/** A land's men who could fall: grown men of fighting age at work (not dependents), less the hand's own. */
export type Pool = {
  readonly cell: number;
  /** Each count's place in the land's table: row × COLS + occupation. */
  readonly rows: readonly number[];
  readonly counts: readonly number[];
  /** Σ counts. */
  readonly men: number;
};

/** A land's pool in a year (a land with no people: an empty pool). */
export function poolOf(ctx: PopulationContext, cell: number, year: number): Pool {
  const prov = ctx.provinces.get(cell),
    rows: number[] = [],
    counts: number[] = [];
  let men = 0;
  if (prov) {
    const windowed = handOf(ctx.world).composition(cell, year, ctx.life);
    for (let b = 0; b < BANDS; b++)
      if (fighting(ctx.life, b))
        for (let o = 1; o < COLS; o++) {
          const r = row(MALE, b),
            n = Math.max(0, prov.counts.get(r, o) - (windowed ? windowed[r * COLS + o]! : 0));
          rows.push(r * COLS + o);
          counts.push(n);
          men += n;
        }
  }
  return { cell, rows, counts, men };
}

/** A realm's levy: its home-world lands (by cell, ascending), their pools, and the men each sends of `fielded`. */
export type Levy = { readonly pools: readonly Pool[]; readonly sent: readonly number[] };

/**
 * A realm's host of `fielded` raised from its home-world lands, each sending by its fighting men
 * (never more than it has); lands that send no one are left out.
 */
export function levyOf(ctx: PopulationContext, p: Polity, fielded: number, year: number): Levy {
  const all = p.members
      .filter((c) => !offworldSite(ctx.generated, c))
      .sort((a, b) => a - b)
      .map((c) => poolOf(ctx, c, year)),
    men = all.map((x) => x.men),
    shares = apportionCapped(Math.max(0, Math.round(fielded)), men, men),
    pools: Pool[] = [],
    sent: number[] = [];
  all.forEach((pool, k) => {
    if (shares[k]! <= 0) return;
    pools.push(pool);
    sent.push(shares[k]!);
  });
  return { pools, sent };
}
