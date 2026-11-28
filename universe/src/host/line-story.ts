// Live a Line's civilization (S7, 2026-11-28): what came of the land a line's band was led in, read off the world as it
// stands. Its people, whether it sows, its first village and when it was founded, its market town, the realm that holds it.
// A pure reading, asked only by Live a Line (host/line.ts ask) and fetched with it.
import { YEAR, type World } from "../kernel/index.ts";
import { politiesOf, populationContext, realmName } from "../sim/index.ts";

export type LineStory = {
  readonly people: number;
  readonly sows: boolean;
  /** The world's year now. */
  readonly year: number;
  /** Its first village (the oldest standing), its market town, the realm holding the land; null: none yet. */
  readonly village: {
    readonly ref: string;
    readonly name: string;
    readonly founded: number;
    readonly people: number;
  } | null;
  readonly town: { readonly ref: string; readonly name: string; readonly people: number } | null;
  readonly realm: {
    readonly ref: string;
    readonly name: string;
    readonly founded: number;
    readonly lands: number;
  } | null;
  /** Lands that sow and have no village yet, the world over: a land's first village waits its turn among them. */
  readonly waiting: number;
};

export function storyOf(world: World, cell: number): LineStory | null {
  const ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p) return null;
  const villages = ctx.settlements
      .inProvince(cell)
      .filter((v) => v.population > 0)
      .sort((a, b) => a.founded - b.founded),
    first = villages[0],
    town = villages.find((v) => v.market),
    realm = politiesOf(world).of(cell),
    living = realm && realm.ended === null ? realm : undefined;
  let waiting = 0;
  for (const q of ctx.provinces.all())
    if (q.knowsCultivation && q.total() > 0 && !ctx.settlements.inProvince(q.cell).length)
      waiting++;
  return {
    people: Math.round(p.total()),
    sows: p.knowsCultivation,
    year: Math.floor(world.now / YEAR),
    village: first
      ? { ref: first.ref, name: first.name, founded: first.founded, people: first.population }
      : null,
    town: town ? { ref: town.ref, name: town.name, people: town.population } : null,
    realm: living
      ? {
          ref: living.ref,
          name: realmName(living),
          founded: living.founded,
          lands: living.members.length,
        }
      : null,
    waiting,
  };
}
