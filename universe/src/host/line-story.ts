// Live a Line's civilization (S7, 2026-11-28): what came of the land a line's band was led in, read off the world as it
// stands. Its people, whether it sows, its first village and when it was founded, its market town, the realm that holds it.
// A pure reading, asked only by Live a Line (host/line.ts ask) and fetched with it.
import type { Portrait, VillagePlan } from "../bridge/index.ts";
import { YEAR, hashString, type World } from "../kernel/index.ts";
import {
  ASKED_REASON,
  askedStar,
  clusterOf,
  landingWorld,
  politiesOf,
  populationContext,
  realmName,
  starSitesOf,
  starTaken,
  voyageReach,
} from "../sim/index.ts";
import { starWords } from "./inspect/sky.ts";

export type LineStory = {
  /** Whose land: the band's the hand led, or (none led) the cradle, where the world's people rose. */
  readonly from: "band" | "cradle";
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
    /** Who rules it now (its year is ruled in their name: app/line-realm.ts). */
    readonly ruler: string;
  } | null;
  /** Lands that sow and have no village yet, the world over: a land's first village waits its turn among them. */
  readonly waiting: number;
};

/** The land a story follows: the band's, or with none led the world's people's cradle. */
function landOf(world: World, cell: unknown): { cell: number; from: "band" | "cradle" } {
  return typeof cell === "number"
    ? { cell, from: "band" }
    : { cell: populationContext(world).generated.life.people?.cell ?? -1, from: "cradle" };
}

export function storyOf(world: World, asked: unknown): LineStory | null {
  const ctx = populationContext(world),
    { cell, from } = landOf(world, asked),
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
    from,
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
          ruler: living.ruler.name,
        }
      : null,
    waiting,
  };
}

/** A world a ship of the realm comes down on (the voyage's own choice at its star): in words, and drawn as the god game's pages draw one. */
export type LineLanding = { readonly words: string; readonly portrait: Portrait };

/** Live a Line's space (S8, and played: its map, 2026-11-28): the realm holding the line's land at the stars, what it lacks to sail, its ships, the stars in reach. */
export type LineStars = {
  readonly realm: { readonly ref: string; readonly name: string } | null;
  /** The world's year now. */
  readonly year: number;
  /** What it lacks to send a ship (none: it can, when its own time comes). */
  readonly wants: readonly string[];
  /** The star its next ship was asked to sail for. */
  readonly asked: {
    readonly ref: string;
    readonly words: string;
    /** Another's ship or colony took it first: the ask is spent when the realm next sails, elsewhere. */
    readonly taken: boolean;
  } | null;
  /** Its ships: the land each is, bound where, arriving or come. */
  readonly ships: readonly {
    readonly land: string;
    readonly star: string;
    readonly words: string;
    readonly departed: number;
    readonly arrives: number;
    readonly arrived: boolean;
    /** Sailed for the star it was asked to (its sailing's decision says so). */
    readonly asked: boolean;
    /** Where it sailed from and to on the map (light-years from home, in the disk's plane). */
    readonly from: readonly [number, number];
    readonly to: readonly [number, number];
    /** Its people now (aboard, or on the world), and the world it comes down on. */
    readonly people: number;
    readonly lands: LineLanding | null;
  }[];
  readonly stars: readonly {
    readonly ref: string;
    readonly words: string;
    readonly distance: number;
    readonly years: number;
    readonly upkeep: number;
    readonly taken: boolean;
    /** Where it is on the map (light-years from home, in the disk's plane). */
    readonly at: readonly [number, number];
    /** The world a ship of the realm would come down on there. */
    readonly lands: LineLanding | null;
  }[];
};

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];

/** A star's world a ship would come down on, as the voyage chooses it: in words, and its picture. */
function landingOf(
  ctx: ReturnType<typeof populationContext>,
  star: string,
  planet?: number,
): LineLanding | null {
  const w = landingWorld(ctx, star),
    p = w && (planet === undefined || w.planet.index === planet) ? w.planet : null;
  if (!p) return null;
  return {
    words: `its ${ORDINALS[p.index] ?? `${p.index + 1}th`} world out, ${p.gravity.toFixed(1)} g, ${Math.round(p.temperature)} °C${p.water === "seas" ? ", with seas" : /ice/.test(p.water) ? ", its water ice" : ""}`,
    portrait: {
      kind: "world",
      look: (p.kind === "moon" || p.kind === "giant" || p.kind === "ice giant"
        ? p.kind
        : "rocky") as "rocky",
      sea: p.water === "seas" ? 0.55 : 0,
      ice: /ice/.test(p.water) ? 0.7 : p.temperature < -30 ? 0.35 : 0,
      green: 0,
      air: p.pressure > 0.05,
      key: hashString(`${star}:${p.index}`),
    },
  };
}

const starText = (s: { spectral: string; remnant?: boolean; distance: number }) =>
  `${starWords(s)} ${s.distance.toFixed(1)} light-years out`;

export function starsOf(world: World, at: unknown): LineStars | null {
  const ctx = populationContext(world),
    { cell } = landOf(world, at);
  if (!ctx.provinces.get(cell)) return null;
  const realm = politiesOf(world).of(cell);
  if (!realm || realm.ended !== null)
    return {
      realm: null,
      year: Math.floor(world.now / YEAR),
      wants: [],
      asked: null,
      ships: [],
      stars: [],
    };
  const reach = voyageReach(ctx, realm),
    asked = askedStar(world, realm.ref),
    star = asked ? clusterOf(world).find((s) => s.ref === asked) : undefined,
    year = Math.floor(world.now / YEAR),
    sites = starSitesOf(world),
    placeOf = (ref: string): readonly [number, number] => {
      const s = clusterOf(world).find((x) => x.ref === ref);
      return s ? [Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10] : [0, 0];
    };
  return {
    realm: { ref: realm.ref, name: realmName(realm) },
    year,
    wants: reach.wants,
    asked:
      asked && star ? { ref: asked, words: starText(star), taken: starTaken(world, asked) } : null,
    ships: (starSitesOf(world)?.all() ?? [])
      .filter(([, s]) => s.realm === realm.ref)
      .map(([c, s]) => {
        const to = clusterOf(world).find((x) => x.ref === s.star),
          why = world.events.get(s.voyage)?.causes[0]?.ref,
          decision = why ? world.decisions.get(why) : undefined;
        // (From home, or from the world of its realm's it sailed from.)
        const was = sites?.get(s.from);
        return {
          land: ctx.provinces.get(c)?.ref ?? "",
          star: s.star,
          departed: s.departed,
          from: was ? placeOf(was.star) : ([0, 0] as const),
          to: placeOf(s.star),
          people: Math.round(ctx.provinces.get(c)?.total() ?? 0),
          lands: landingOf(ctx, s.star, s.planet),
          asked: !!decision?.factors.some((f) => f.name === ASKED_REASON),
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
      at: [Math.round(r.star.x * 10) / 10, Math.round(r.star.y * 10) / 10] as const,
      lands: landingOf(ctx, r.star.ref),
    })),
  };
}

/** What rose in a world made so (S5): its people of your line, named for it, or why they could not, and who rose instead. */
export type LineRises = {
  readonly risen: boolean;
  /** Whether the hand named them (else they bear the name the world gives their kind). */
  readonly named: boolean;
  /** Not risen: why not, by the world's own rule. */
  readonly why: string | null;
  /** Its people: their name, their clade's name, weight (kg), what they handle things with, and why they rose. */
  readonly people: {
    readonly name: string;
    readonly clade: string;
    readonly size: number;
    readonly hold: string;
    readonly because: string;
    /** How one of them is drawn (the god game's own figure of a world's people: host/folk.ts). */
    readonly figure: VillagePlan["body"];
  } | null;
  /** The clade your line is of, in words (null: no body made so). */
  readonly lineClade: string | null;
};
