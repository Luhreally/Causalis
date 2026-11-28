// Live a Line's civilization (S7, 2026-11-28): what came of the land a line's band was led in, read off the world as it
// stands. Its people, whether it sows, its first village and when it was founded, its market town, the realm that holds it.
// A pure reading, asked only by Live a Line (host/line.ts ask) and fetched with it.
import type { FightSide, Portrait, VillagePlan } from "../bridge/index.ts";
import { YEAR, hashString, type Ref, type World } from "../kernel/index.ts";
import { why } from "../causal/index.ts";
import { cellRef } from "../gen/index.ts";
import { SEXES, STAR_DRIVES, crossingClocks } from "../rules/index.ts";
import {
  ASKED_REASON,
  askedStar,
  clusterOf,
  landingWorld,
  lifeOf,
  row,
  politiesOf,
  populationContext,
  realmName,
  starSitesOf,
  starTaken,
  voyageReach,
} from "../sim/index.ts";
import { starWords } from "./inspect/sky.ts";
import { realmShips } from "./starfight.ts";
import { linesOf, townRoster } from "./roster.ts";

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

/** Live a Line's ride aboard a ship of its realm (2026-11-28): the crossing as the voyage rule keeps it, a year at a time. */
export type LineVoyage = {
  readonly land: string;
  readonly realm: string;
  /** Its realm's ships as the god game's fights draw them (render/fleet.ts): the hull ridden is of these. */
  readonly side: FightSide;
  readonly year: number;
  readonly departed: number;
  readonly arrives: number;
  readonly arrived: boolean;
  readonly star: string;
  readonly words: string;
  readonly distance: number;
  /** Its drive, in words; the years its people live aboard while home lives the crossing's (null: by a lane, none kept). */
  readonly drive: string;
  readonly aboardYears: number | null;
  /** By the lanes between the stars: how many, and where one threw it off its way (light-years short, years more). */
  readonly lanes: {
    readonly hops: number;
    readonly thrown: {
      readonly hop: number;
      readonly short: number;
      readonly years: number;
    } | null;
  } | null;
  /** Its people now, and of them the young (of the first of the ages). */
  readonly people: number;
  readonly young: number;
  /** Last month's food against need (1: enough), and the leanest month of the last year closed. */
  readonly fed: number;
  readonly leanest: number;
  /** The share of its people's work that keeps them alive aboard (on the world come to, what its halls keep out). */
  readonly keep: number;
  /** Grievance in its land (0 … 1), as the realm's order reads it. */
  readonly grievance: number;
  /** Born and died aboard in the last year closed. */
  readonly born: number;
  readonly died: number;
  /** What history tells of it since the year asked, oldest first, in plain words. */
  readonly told: readonly { readonly year: number; readonly words: string }[];
  /** One who sailed in her, as a town's roster holds them (history names no one aboard); asked once a ride. */
  readonly crew: { readonly name: string; readonly ref: string; readonly words: string } | null;
  readonly lands: LineLanding | null;
  /** Where it is on the map: from, to (light-years from home, in the disk's plane). */
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
};

/** How far back the ride reads history at most (events), each time it is asked. */
const RIDE_SCAN = 20000;

/** A ship of the realm holding the line's land, as it crosses: asked a year at a time while it is ridden. */
export function voyageOf(world: World, args: unknown): LineVoyage | null {
  const a = (args ?? {}) as {
      cell?: unknown;
      land?: string;
      since?: number;
      /** Who sailed in her and the world it comes down on, asked once a ride (they do not change as it sails). */
      once?: boolean;
    },
    ctx = populationContext(world),
    { cell: home } = landOf(world, a.cell),
    realm = politiesOf(world).of(home),
    sites = starSitesOf(world);
  if (!realm || !sites) return null;
  const hit = sites.all().find(([c]) => cellRef(0, c) === a.land);
  if (!hit) return null;
  const [cell, s] = hit,
    land = ctx.provinces.get(cell),
    year = Math.floor(world.now / YEAR),
    ref = cellRef(0, cell),
    placeOf = (r: string): readonly [number, number] => {
      const x = clusterOf(world).find((y) => y.ref === r);
      return x ? [Math.round(x.x * 10) / 10, Math.round(x.y * 10) / 10] : [0, 0];
    },
    to = clusterOf(world).find((x) => x.ref === s.star),
    was = sites.get(s.from),
    // (The last year closed: the ledger's line for it.)
    last = ctx.history.yearsOf(cell).at(-1),
    closed = year - 1;
  // What history tells of it since the year asked, walked back from the end of the log.
  const told: { year: number; words: string }[] = [],
    since = Math.max(s.departed, Math.floor(Number(a.since ?? s.departed))) * YEAR,
    log = world.events;
  for (let i = log.count - 1, seen = 0; i >= 0 && seen < RIDE_SCAN; i--, seen++) {
    const e = log.at(i);
    if (e.t < since) break;
    if (e.place !== ref && !e.subjects.includes(ref)) continue;
    // (Its year as its words give it: a year's reckoning is told as the next begins.)
    const claim = why(world, e.id as Ref).claim.replace(/^In (the )?year -?\d+,?\s*/i, ""),
      dated = /,? (in )?(the )?year (-?\d+)\.?$/.exec(claim),
      words = (dated ? claim.slice(0, dated.index) : claim).replace(/\.$/, "");
    told.push({
      year: dated ? Number(dated[3]) : Math.floor(e.t / YEAR),
      words: words.replace(/^./, (c) => c.toUpperCase()),
    });
    if (told.length >= 12) break;
  }
  told.reverse();
  let young = 0;
  if (land) for (let x = 0; x < SEXES; x++) young += land.counts.rowSum(row(x, 0));
  const drive = STAR_DRIVES.find((d) => d.id === s.drive),
    clocks = s.lane ? null : crossingClocks(s.distance, s.arrives - s.departed);
  return {
    land: ref,
    realm: realmName(realm),
    side: realmShips(world, realm.ref, s.departed),
    year,
    departed: s.departed,
    arrives: s.arrives,
    arrived: !!s.arrived || year >= s.arrives,
    star: s.star,
    words: to ? starText(to) : `a star ${s.distance.toFixed(1)} light-years out`,
    distance: Math.round(s.distance * 10) / 10,
    drive: drive?.words ?? "its drive",
    aboardYears: clocks ? Math.round(clocks.aboard * 10) / 10 : null,
    lanes: s.lane ? { hops: s.lane.hops, thrown: s.lane.thrown } : null,
    people: Math.round(land?.total() ?? 0),
    young: Math.round(young),
    fed: Math.round(land?.fed ?? 1000) / 1000,
    leanest: Math.round(last?.fed ?? 1000) / 1000,
    keep: Math.round((s.arrived ? s.there : s.aboard) * 100) / 100,
    grievance: Math.round(Math.min(1, politiesOf(world).discontent(cell).level) * 100) / 100,
    born: ctx.history.birthsIn(cell, closed),
    died: ctx.history.deathsIn(cell, closed),
    told,
    crew: a.once ? sailedIn(world, s.from, s.departed, hashString(`ride ${ref}`)) : null,
    lands: a.once ? landingOf(ctx, s.star, s.planet) : null,
    from: was ? placeOf(was.star) : [0, 0],
    to: placeOf(s.star),
  };
}

/** One grown of the town a ship sailed from, in the year it sailed, keyed to the ship (as host/starfight.ts crewOf reads a fleet's). */
function sailedIn(
  world: World,
  from: number,
  year: number,
  key: number,
): { name: string; ref: string; words: string } | null {
  const town = populationContext(world)
    .settlements.inProvince(from)
    .filter((t) => t.population > 0)
    .sort((x, y) => y.population - x.population || (x.ref < y.ref ? -1 : 1))[0];
  const lines = town ? linesOf(town.population) : 0;
  if (!town || !lines) return null;
  const then = townRoster(world, town.ref, year),
    now = townRoster(world, town.ref),
    grown = lifeOf(world).adulthood;
  for (let i = 0; i < 24; i++) {
    const h = then.holder((key + i * 7919) % lines);
    if (!h || year - h.born < grown) continue;
    const paged = now.holderOf(h.line, h.n);
    if (paged)
      return {
        name: now.nameOf(paged),
        ref: paged.ref,
        words: `of ${town.name}, ${year - h.born} when it sailed`,
      };
  }
  return null;
}
