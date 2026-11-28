// Live a Line's civilization (S7, 2026-11-28): what came of the land a line's band was led in, read off the world as it
// stands. Its people, whether it sows, its first village and when it was founded, its market town, the realm that holds it.
// A pure reading, asked only by Live a Line (host/line.ts ask) and fetched with it.
import { YEAR, type World } from "../kernel/index.ts";
import {
  askedStar,
  clusterOf,
  politiesOf,
  populationContext,
  realmName,
  starSitesOf,
  voyageReach,
} from "../sim/index.ts";
import { starWords } from "./inspect/sky.ts";

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

/** Live a Line's space (S8): the realm holding the line's land at the stars, what it lacks to sail, its ships, the stars in reach. */
export type LineStars = {
  readonly realm: { readonly ref: string; readonly name: string } | null;
  /** What it lacks to send a ship (none: it can, when its own time comes). */
  readonly wants: readonly string[];
  /** The star its next ship was asked to sail for. */
  readonly asked: { readonly ref: string; readonly words: string } | null;
  /** Its ships: the land each is, bound where, arriving or come. */
  readonly ships: readonly {
    readonly land: string;
    readonly words: string;
    readonly arrives: number;
    readonly arrived: boolean;
  }[];
  readonly stars: readonly {
    readonly ref: string;
    readonly words: string;
    readonly distance: number;
    readonly years: number;
    readonly upkeep: number;
    readonly taken: boolean;
  }[];
};

const starText = (s: { spectral: string; remnant?: boolean; distance: number }) =>
  `${starWords(s)} ${s.distance.toFixed(1)} light-years out`;

export function starsOf(world: World, cell: number): LineStars | null {
  const ctx = populationContext(world);
  if (!ctx.provinces.get(cell)) return null;
  const realm = politiesOf(world).of(cell);
  if (!realm || realm.ended !== null)
    return { realm: null, wants: [], asked: null, ships: [], stars: [] };
  const reach = voyageReach(ctx, realm),
    asked = askedStar(world, realm.ref),
    star = asked ? clusterOf(world).find((s) => s.ref === asked) : undefined,
    year = Math.floor(world.now / YEAR);
  return {
    realm: { ref: realm.ref, name: realmName(realm) },
    wants: reach.wants,
    asked: asked && star ? { ref: asked, words: starText(star) } : null,
    ships: (starSitesOf(world)?.all() ?? [])
      .filter(([, s]) => s.realm === realm.ref)
      .map(([c, s]) => {
        const to = clusterOf(world).find((x) => x.ref === s.star);
        return {
          land: ctx.provinces.get(c)?.ref ?? "",
          words: to ? starText(to) : `a star ${s.distance.toFixed(1)} light-years out`,
          arrives: s.arrives,
          arrived: !!s.arrived || year >= s.arrives,
        };
      })
      .filter((s) => s.land),
    stars: reach.stars.map((r) => ({
      ref: r.star.ref,
      words: starText(r.star),
      distance: Math.round(r.star.distance * 10) / 10,
      years: Math.round(r.years),
      upkeep: Math.round(r.upkeep * 10) / 10,
      taken: r.taken,
    })),
  };
}
