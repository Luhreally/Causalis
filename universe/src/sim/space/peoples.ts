// Peoples among the stars (Phase 18 M133; asked for 2026-10: "i should see them landing on
// planets tryna socialize and like the different reactions and wars and exchanges"). The
// cluster's other civilizations (gen/civilizations.ts) no longer only are: once one comes to
// the stars it sends ships of its own — settlers to the nearest worlds its bodies could live
// on, envoys to the living world it sees, and again to the people it hears. Where its ships
// come down by another people — on the home world, by a realm's halls at another star, or by
// another people of the stars — the two meet, each as its nature and the odds between them
// say: in wonder, in fear, to trade, or for war. What passes after follows from it: knowledge
// taught, goods given, ways that rub off; or fleets, halls burned and holds taken.
//
// A people's nature and the stars it could live about are drawn from it alone; its ships,
// holds and meetings are history, each an event whose why is the decision that chose it.
import {
  YEAR,
  defineEventType,
  defineStream,
  parseRef,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  cellRef,
  civName,
  worldKindOf,
  type Civilization,
  type GalaxyStar,
} from "../../gen/index.ts";
import {
  CLADES,
  G,
  PRINCIPLES,
  affordsPrinciple,
  habitability,
  needsMet,
  starDriveFor,
  type BodyPlan,
  type Principle,
} from "../../rules/index.ts";
import { WAY, cultureOf, pushWays } from "../culture/culture.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { LORE_EVENTS, knows, loreOf } from "../lore/lore.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { grieve, raze, strike } from "../acts/disasters.ts";
import { civilizationsNear } from "./contact.ts";
import { clusterOf, worldsOf } from "./voyages.ts";
import { machinesOfRealm, spaceOf } from "./space.ts";
import { starSitesOf } from "./stars.ts";

export const PEOPLES_EVENTS = {
  sailed: defineEventType("peoples.sailed", 3),
  settled: defineEventType("peoples.settled", 4),
  landed: defineEventType("peoples.landed", 7),
  /** The home world's peoples meet a people of the stars. */
  met: defineEventType("contact.met", 7),
  /** Two peoples of the stars meet each other. */
  among: defineEventType("peoples.met", 4),
  exchange: defineEventType("contact.exchange", 4),
  raid: defineEventType("peoples.raid", 6),
};

const NATURE = defineStream("peoples.nature");
const SAIL = defineStream("peoples.sail");
const MEET = defineStream("peoples.meet");
const TRADE = defineStream("peoples.trade");
const RAID = defineStream("peoples.raid");

/** The most stars a people holds, and its ships out at once. */
export const MOST_HOLDS = 8;
export const MOST_SHIPS = 2;
/** How far a people's settlers go from the nearest of its holds (light-years). */
export const REACH_LY = 30;
/** The longest crossing a people sends its own on (years). */
export const LONGEST_CROSSING = 300;
/** Two peoples whose holds lie this near hear each other, and meet (light-years). */
export const HEAR_LY = 20;
/** Years between a people's settler ships, at home's pace. */
export const SETTLE_GAP = 160;
/** Years between one fleet a people sends against another and its next. */
export const FLEET_GAP = 80;
/** What a gift of goods brings a realm's seat, in machines. */
export const GIFT_MACHINES = 600_000;

/** How a people meets another: in wonder, in fear, to trade, or for war. */
export type Reaction = "wonder" | "fear" | "trade" | "war";
export const REACTIONS: readonly Reaction[] = ["wonder", "fear", "trade", "war"];
/** What each reaction does to the regard between the two. */
export const REACTION_REGARD: Readonly<Record<Reaction, number>> = {
  wonder: 0.4,
  fear: -0.3,
  trade: 0.6,
  war: -0.9,
};

/** A people's nature, drawn from it alone (0 … 1 each). */
export type Nature = {
  readonly curious: number;
  readonly wary: number;
  readonly bold: number;
  readonly trading: number;
};

/** A star a people holds: its own, or one its settlers came to (or its fleets took). */
export type Hold = {
  readonly star: Ref;
  readonly year: number;
  /** The event of its settling or taking (null: its own star, or held before the chronicle). */
  readonly event: Ref | null;
  /** The people it was taken from, if taken. */
  readonly from: Ref | null;
};

export type PeopleShip = {
  readonly id: number;
  readonly civ: Ref;
  readonly kind: "settlers" | "envoys" | "fleet";
  /** The stars it sailed from and for (envoys to the home world: the home star). */
  readonly from: Ref;
  readonly to: Ref;
  readonly sailed: number;
  readonly arrives: number;
  readonly event: Ref;
  /** A fleet's foe: a realm of the home world or another people of the stars. */
  readonly toward: Ref | null;
  /** Envoys sent because they heard the home world (not only saw that it lives). */
  readonly heard: boolean;
  arrived: Ref | null;
  /** The land the god called them down to (M142), if the god called them. */
  readonly cell?: number;
};

/** Two peoples met: where and when, how each met the other, and what has passed since. */
export type Meeting = {
  readonly civ: Ref;
  /** The other: a realm of the home world, a land of it with no realm, or another people. */
  readonly other: Ref;
  readonly with: "realm" | "land" | "people";
  readonly star: Ref;
  /** The land they met in (on the home world or by a realm's halls), else -1. */
  readonly cell: number;
  readonly year: number;
  readonly event: Ref;
  readonly theirs: Reaction;
  readonly ours: Reaction;
  /** Whether the two can speak (not yet, where the home world met them before it had signals). */
  talking: boolean;
  regard: number;
  exchanges: number;
  last: number;
  lastEvent: Ref | null;
  raids: number;
  lastRaid: number;
  lastRaidEvent: Ref | null;
};

/** What passed between two peoples once. */
export type Exchange = {
  readonly civ: Ref;
  readonly other: Ref;
  readonly year: number;
  readonly what: "knowledge" | "goods" | "ways";
  /** The principle taught, the machines given, or the way pushed. */
  readonly detail: string;
  readonly event: Ref;
};

export type Landing = {
  readonly civ: Ref;
  readonly cell: number;
  readonly year: number;
  readonly omen: boolean;
  readonly event: Ref;
};

export type Raid = {
  readonly civ: Ref;
  readonly other: Ref;
  readonly star: Ref;
  /** The land struck (a realm's), else -1. */
  readonly cell: number;
  readonly year: number;
  readonly won: boolean;
  readonly dead: number;
  /** A hold taken from another people. */
  readonly taken: boolean;
  readonly event: Ref;
};

const KEEP = { exchanges: 160, raids: 80, landings: 60, arrived: 48, seen: 64 } as const;

export class PeoplesStore implements StateStore {
  readonly name = "space.peoples";
  holds = new Map<string, Hold[]>();
  next = new Map<string, number>();
  ships: PeopleShip[] = [];
  meetings: Meeting[] = [];
  exchanges: Exchange[] = [];
  landings: Landing[] = [];
  raids: Raid[] = [];
  /** The year the home world's first signals left it (a realm came to electronics). */
  homeSignals: number | null = null;
  /** The home world's arrivals at other stars already reckoned with (their arrival events). */
  seen: Ref[] = [];
  count = 0;
  /** The peoples with no star left to settle within reach of their holds: pressing on their neighbours. */
  crowded: Ref[] = [];

  holdsOf(civ: Ref): readonly Hold[] {
    return this.holds.get(civ) ?? [];
  }
  /** The people that holds a star, if any. */
  holder(star: Ref): Ref | null {
    let found: Ref | null = null;
    for (const [civ, hs] of this.holds)
      if (hs.some((h) => h.star === star) && (found === null || civ < found)) found = civ as Ref;
    return found;
  }
  meetingOf(civ: Ref, other: Ref): Meeting | undefined {
    return this.meetings.find(
      (m) => (m.civ === civ && m.other === other) || (m.civ === other && m.other === civ),
    );
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const hs of this.holds.values()) for (const h of hs) if (h.event) out.push(h.event);
    for (const s of this.ships) {
      out.push(s.event);
      if (s.arrived) out.push(s.arrived);
    }
    for (const m of this.meetings) {
      out.push(m.event);
      if (m.lastEvent) out.push(m.lastEvent);
      if (m.lastRaidEvent) out.push(m.lastRaidEvent);
    }
    for (const x of this.exchanges) out.push(x.event);
    for (const x of this.landings) out.push(x.event);
    for (const x of this.raids) out.push(x.event);
    return out;
  }
  save(): unknown {
    const sorted = <V>(m: Map<string, V>) =>
      [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return {
      holds: sorted(this.holds),
      next: sorted(this.next),
      ships: this.ships,
      meetings: this.meetings,
      exchanges: this.exchanges,
      landings: this.landings,
      raids: this.raids,
      homeSignals: this.homeSignals,
      seen: this.seen,
      crowded: this.crowded,
      count: this.count,
    };
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  load(state: unknown): void {
    const s = state as {
      holds: [string, Hold[]][];
      next: [string, number][];
      ships: PeopleShip[];
      meetings: Meeting[];
      exchanges: Exchange[];
      landings: Landing[];
      raids: Raid[];
      homeSignals: number | null;
      seen: Ref[];
      crowded?: Ref[];
      count: number;
    };
    this.holds = new Map(s.holds.map(([k, v]) => [k, v.map((h) => ({ ...h }))]));
    this.next = new Map(s.next);
    this.ships = s.ships.map((x) => ({ ...x }));
    this.meetings = s.meetings.map((x) => ({ ...x }));
    this.exchanges = s.exchanges.map((x) => ({ ...x }));
    this.landings = s.landings.map((x) => ({ ...x }));
    this.raids = s.raids.map((x) => ({ ...x }));
    this.homeSignals = s.homeSignals;
    this.seen = [...s.seen];
    this.crowded = [...(s.crowded ?? [])];
    this.count = s.count;
  }
}

export function peoplesOf(world: World): PeoplesStore | null {
  return world.hasStore("space.peoples") ? world.store<PeoplesStore>("space.peoples") : null;
}

const keyOf = (ref: Ref) => {
  const { a, b } = parseRef(ref);
  return (a * 4096 + b) >>> 0;
};

const bodyOf = (civ: Civilization): BodyPlan | null =>
  (CLADES.find((c) => c.id === civ.clade)?.body as BodyPlan | undefined) ?? null;

/** What a people calls itself, and what it is ("the Kaari, trunked giants"). */
export function peopleWords(world: World, civ: Civilization): { name: string; kind: string } {
  return {
    name: civName(world.rng, civ),
    kind: CLADES.find((c) => c.id === civ.clade)?.body.name ?? civ.clade,
  };
}

/** A people's nature: curious, wary, bold and given to trade, by a draw keyed to it. */
export function peopleNature(world: World, civ: Civilization): Nature {
  const k = keyOf(civ.ref),
    u = (n: number) => world.rng.real(NATURE, k, 0, 0, n),
    body = CLADES.find((c) => c.id === civ.clade)?.body,
    social = body?.social ?? 0.6,
    hunter = body?.diet === "flesh" ? 0.15 : 0;
  return {
    curious: 0.3 + 0.6 * u(0),
    wary: 0.15 + 0.6 * u(1),
    bold: Math.min(1, 0.1 + 0.6 * u(2) + hunter),
    trading: Math.min(1, 0.15 + 0.5 * u(3) + 0.3 * social),
  };
}

/** How strong a people is among the stars in a year: little before it reaches them, five at most. */
export function peopleStrength(civ: Civilization, year: number): number {
  if (year < civ.stars) return year < civ.electronics ? 0.3 : 0.6;
  const x = (year - civ.stars) / (300 * civ.pace);
  return 1 + (4 * x) / (x + 1);
}

/** How fast a people's ships go (light-years a year): faster as its drives improve. */
export function speedOf(civ: Civilization, year: number): number {
  return 0.05 + 0.25 * Math.max(0, Math.min(1, (year - civ.stars) / (500 * civ.pace)));
}

/** A realm's strength among the stars: what it has put up, its drives and its machines (five at most). */
export function realmStrength(ctx: PopulationContext, p: Polity): number {
  const prog = spaceOf(ctx.world).of(p.ref),
    drive = starDriveFor((id) => knows(ctx, p.seat, id));
  return (
    1 +
    (prog?.satellite ? 0.5 : 0) +
    (prog?.station ? 0.5 : 0) +
    (drive ? 1 : 0) +
    Math.min(2, machinesOfRealm(ctx, p) / 2e7)
  );
}

type Point = { readonly x: number; readonly y: number; readonly z: number };
const ORIGIN: Point = { x: 0, y: 0, z: 0 };
const apart = (a: Point, b: Point) => {
  const x = a.x - b.x,
    y = a.y - b.y,
    z = a.z - b.z;
  return Math.sqrt(x * x + y * y + z * z);
};

/** Where a star lies: a star of the cluster by its ref; the home star at the middle. */
const STAR_AT = new Map<string, Map<string, GalaxyStar>>();
export function starPoint(world: World, ref: Ref): Point {
  return starByRef(world, ref) ?? ORIGIN;
}

function starByRef(world: World, ref: Ref): GalaxyStar | undefined {
  const key = world.seed.text;
  let byRef = STAR_AT.get(key);
  if (!byRef) {
    if (STAR_AT.size > 8) STAR_AT.clear();
    STAR_AT.set(key, (byRef = new Map(clusterOf(world).map((s) => [s.ref as string, s]))));
  }
  return byRef.get(ref);
}

/**
 * The world a people lives about at a star it holds (Phase 18 M136): its own world at its own
 * star; elsewhere the first, outward from the star, its bodies could live on; or none.
 */
const HOLD_WORLDS = new Map<string, number | null>();
export function holdWorld(world: World, civ: Civilization, star: Ref): number | null {
  if (star === civ.star) return civ.planet;
  const key = `${world.seed.text} ${civ.ref} ${star}`;
  const known = HOLD_WORLDS.get(key);
  if (known !== undefined) return known;
  if (HOLD_WORLDS.size > 512) HOLD_WORLDS.clear();
  const s = starByRef(world, star),
    body = bodyOf(civ),
    found = s && worldsOf(world, s).find((p) => habitability(p, body, civ.gravity).livable),
    index = found ? found.index : null;
  HOLD_WORLDS.set(key, index);
  return index;
}

/** The stars a people's bodies could live about, nearest its own first (a pure function of the world). */
const SETTLEABLE = new Map<string, readonly GalaxyStar[]>();
export function settleableBy(world: World, civ: Civilization): readonly GalaxyStar[] {
  const key = `${world.seed.text} ${civ.ref}`;
  let out = SETTLEABLE.get(key);
  if (out) return out;
  if (SETTLEABLE.size > 96) SETTLEABLE.clear();
  const own = starPoint(world, civ.star),
    body = bodyOf(civ),
    near = clusterOf(world)
      .filter((s) => s.ref !== civ.star && !s.remnant)
      .map((s) => ({ s, d: apart(own, s) }))
      .filter((x) => x.d <= 2 * REACH_LY)
      .sort((a, b) => a.d - b.d || (a.s.ref < b.s.ref ? -1 : 1)),
    found: GalaxyStar[] = [];
  for (const { s } of near) {
    if (found.length >= 32) break;
    if (worldsOf(world, s).some((p) => habitability(p, body, civ.gravity).livable)) found.push(s);
  }
  SETTLEABLE.set(key, (out = found));
  return out;
}

/** The hold of a people nearest a star (its own star first of all). */
function nearestHold(world: World, store: PeoplesStore, civ: Civilization, to: Ref): Ref {
  const at = starPoint(world, to);
  let best = civ.star,
    d = apart(starPoint(world, civ.star), at);
  for (const h of store.holdsOf(civ.ref)) {
    const x = apart(starPoint(world, h.star), at);
    if (x < d) [best, d] = [h.star, x];
  }
  return best;
}

const crossing = (world: World, from: Ref, to: Ref, speed: number) =>
  Math.max(1, Math.ceil(apart(starPoint(world, from), starPoint(world, to)) / speed));

/** The nearest star a people could live about that none holds or sails for, within reach of a hold. */
function nextSpot(
  world: World,
  store: PeoplesStore,
  civ: Civilization,
  civs: readonly Civilization[],
  home: Ref,
): GalaxyStar | null {
  const taken = new Set<string>([home, ...civs.map((c) => c.star as string)]);
  for (const hs of store.holds.values()) for (const h of hs) taken.add(h.star);
  for (const s of store.ships) if (!s.arrived) taken.add(s.to);
  const holds = store.holdsOf(civ.ref).map((h) => starPoint(world, h.star));
  return (
    settleableBy(world, civ).find(
      (s) => !taken.has(s.ref) && holds.some((h) => apart(h, s) <= REACH_LY),
    ) ?? null
  );
}

/** A people seen for the first time at the stars: what it held before the chronicle began. */
function firstSight(
  world: World,
  store: PeoplesStore,
  civ: Civilization,
  civs: readonly Civilization[],
  home: Ref,
  year: number,
): void {
  const holds: Hold[] = [{ star: civ.star, year: civ.stars, event: null, from: null }];
  store.holds.set(civ.ref, holds);
  const gap = SETTLE_GAP * civ.pace,
    before = Math.min(MOST_HOLDS - 1, Math.floor((year - civ.stars) / gap));
  for (let i = 0; i < before; i++) {
    const spot = nextSpot(world, store, civ, civs, home);
    if (!spot) break;
    holds.push({
      star: spot.ref,
      year: Math.round(civ.stars + (i + 1) * gap),
      event: null,
      from: null,
    });
  }
  const u = world.rng.real(SAIL, keyOf(civ.ref), year, 0);
  store.next.set(civ.ref, year + Math.round((40 + 80 * u) * civ.pace));
}

/** The land a people's envoys come down in: the greatest realm's seat, else the most peopled land. */
function landingPlace(ctx: PopulationContext): { cell: number; realm: Polity | null } | null {
  let best: Polity | null = null,
    most = -1;
  for (const p of politiesOf(ctx.world).living()) {
    let people = 0;
    for (const c of p.members) people += ctx.provinces.get(c)?.total() ?? 0;
    if (people > most || (people === most && best !== null && p.ref < best.ref))
      [best, most] = [p, people];
  }
  if (best) return { cell: best.seat, realm: best };
  let cell = -1,
    top = 0;
  for (const p of ctx.provinces.all())
    if (p.total() > top || (p.total() === top && cell >= 0 && p.cell < cell))
      [cell, top] = [p.cell, p.total()];
  return cell >= 0 && top > 0 ? { cell, realm: null } : null;
}

/** The land the god called strangers down to, while anyone lives there; else where they would come. */
function calledTo(
  ctx: PopulationContext,
  cell: number,
): { cell: number; realm: Polity | null } | null {
  if (!((ctx.provinces.get(cell)?.total() ?? 0) > 0)) return landingPlace(ctx);
  const realm = politiesOf(ctx.world).of(cell);
  return { cell, realm: realm && realm.ended === null ? realm : null };
}

type Side =
  | { readonly kind: "home"; readonly cell: number; readonly realm: Polity | null }
  | { readonly kind: "people"; readonly civ: Civilization };

type Weighed = { reaction: Reaction; factors: Factor[] };

/** One side's reaction to the other: weighed by its nature (or its ways) and the odds between them. */
function react(
  ctx: PopulationContext,
  me: Side,
  them: Side,
  year: number,
  key: number,
  purpose: number,
  omen: boolean,
): Weighed {
  const world = ctx.world,
    strength = (s: Side) =>
      s.kind === "people"
        ? peopleStrength(s.civ, year)
        : s.realm
          ? realmStrength(ctx, s.realm)
          : 0.3,
    mine = strength(me),
    yours = strength(them);
  let weights: number[], factors: Factor[];
  if (me.kind === "people") {
    const n = peopleNature(world, me.civ);
    weights = [
      0.3 + n.curious,
      n.wary * (yours > mine ? 1.4 : 0.5),
      1.2 * n.trading * (them.kind === "home" && omen ? 0.3 : 1),
      n.bold * n.wary * (mine > yours ? 1.3 : 0.4),
    ];
    factors = [
      { name: "their curiosity", value: n.curious, contribution: weights[0]!, source: null },
      {
        name: "their wariness of strangers",
        value: n.wary,
        contribution: weights[1]!,
        source: null,
      },
      { name: "their love of trade", value: n.trading, contribution: weights[2]!, source: null },
      { name: "their boldness", value: n.bold, contribution: weights[3]!, source: null },
      {
        name: "their strength against the other's",
        value: Math.round((mine / Math.max(0.1, yours)) * 100) / 100,
        contribution: 0,
        source: null,
      },
    ];
  } else {
    const ways = cultureOf(world).get(me.cell)?.traits ?? [],
      t = (k: keyof typeof WAY) => ways[WAY[k]] ?? 0.5,
      awed = yours > 2 * mine,
      who: CauseRef | null = me.realm ? { ref: me.realm.ref, role: "agent", weight: 1 } : null;
    weights = [
      0.2 + 0.5 * t("openness") + 0.4 * t("piety") + (omen ? 0.3 : 0),
      0.3 * t("tradition") + 0.3 * (1 - t("openness")) + (awed ? 0.3 : 0),
      (1.1 * t("trade") + 0.2 * t("openness")) * (omen ? 0.5 : 1),
      t("valour") * (1 - t("openness")) * (mine >= yours ? 1.2 : 0.5),
    ];
    factors = [
      {
        name: "its people's openness to strangers",
        value: t("openness"),
        contribution: weights[0]!,
        source: who,
      },
      {
        name: "its people's piety",
        value: t("piety"),
        contribution: 0.4 * t("piety"),
        source: null,
      },
      {
        name: "its love of the old ways",
        value: t("tradition"),
        contribution: weights[1]!,
        source: null,
      },
      { name: "its traders", value: t("trade"), contribution: weights[2]!, source: null },
      { name: "its valour", value: t("valour"), contribution: weights[3]!, source: null },
      {
        name: "the strangers' strength against its own",
        value: Math.round((yours / Math.max(0.1, mine)) * 100) / 100,
        contribution: 0,
        source: null,
      },
    ];
  }
  const total = weights.reduce((a, b) => a + b, 0),
    u = world.rng.real(MEET, key, year, purpose) * total;
  let at = 0,
    reaction: Reaction = "war";
  for (let i = 0; i < weights.length; i++)
    if (u < (at += weights[i]!)) {
      reaction = REACTIONS[i]!;
      break;
    }
  return { reaction, factors };
}

const sideRef = (s: Side): Ref =>
  s.kind === "people" ? s.civ.ref : s.realm ? s.realm.ref : cellRef(0, s.cell);

/** Two peoples meet: each one's reaction chosen and recorded with its reasons; the meeting an event. */
function meet(
  ctx: PopulationContext,
  store: PeoplesStore,
  civ: Civilization,
  other: Side,
  star: Ref,
  cell: number,
  year: number,
  t: SimTime,
  cause: Ref,
  omen: boolean,
): Meeting {
  const world = ctx.world,
    me: Side = { kind: "people", civ },
    key = keyOf(civ.ref),
    purpose = 2 * store.meetings.length,
    theirs = react(ctx, me, other, year, key, purpose, omen),
    ours = react(ctx, other, me, year, key, purpose + 1, omen),
    otherRef = sideRef(other),
    decide = (subject: Ref, w: Weighed, toward: Ref) =>
      world.decisions.record({
        rule: "contact.react",
        subject,
        outcome: { reaction: w.reaction, toward },
        score: REACTION_REGARD[w.reaction],
        threshold: 0,
        factors: w.factors,
      }),
    theirsWhy = decide(civ.ref, theirs, otherRef),
    oursWhy = decide(otherRef, ours, civ.ref),
    words = peopleWords(world, civ),
    them = other.kind === "people" ? peopleWords(world, other.civ) : null,
    event = world.events.emit({
      type: other.kind === "home" ? PEOPLES_EVENTS.met.type : PEOPLES_EVENTS.among.type,
      place: cell >= 0 ? cellRef(0, cell) : null,
      subjects: [civ.ref, otherRef],
      causes: [
        { ref: cause, role: "trigger", weight: 1 },
        { ref: theirsWhy, role: "agent", weight: 0.8 },
        { ref: oursWhy, role: "agent", weight: 0.8 },
      ],
      data: {
        name: words.name,
        kind: words.kind,
        realm: other.kind === "home" ? (other.realm?.town ?? null) : null,
        other: them?.name ?? null,
        otherKind: them?.kind ?? null,
        theirs: theirs.reaction,
        ours: ours.reaction,
        omen,
        far: other.kind === "home" && star !== ctx.generated.star.ref,
        year,
      },
    }),
    m: Meeting = {
      civ: civ.ref,
      other: otherRef,
      with: other.kind === "people" ? "people" : other.realm ? "realm" : "land",
      star,
      cell,
      year,
      event,
      theirs: theirs.reaction,
      ours: ours.reaction,
      talking: !omen,
      regard: (REACTION_REGARD[theirs.reaction] + REACTION_REGARD[ours.reaction]) / 2,
      exchanges: 0,
      last: year,
      lastEvent: null,
      raids: 0,
      lastRaid: year,
      lastRaidEvent: null,
    };
  store.meetings.push(m);
  // How a land of the home world met them stays in its ways.
  if (other.kind === "home") {
    const ways = cultureOf(world).get(cell),
      trait =
        ours.reaction === "wonder"
          ? omen
            ? WAY.piety
            : WAY.openness
          : ours.reaction === "fear"
            ? WAY.tradition
            : ours.reaction === "trade"
              ? WAY.trade
              : WAY.valour;
    if (ways) pushWays(ways, { event, year, trait: trait!, amount: 0.06 });
    // Met in war, they strike before they go: a few dead, and the grief of it.
    if (theirs.reaction === "war") {
      strike(ctx, cell, 0.01, t);
      grieve(world, cell, 0.15, event);
    }
  }
  return m;
}

/** Below this regard a people at the stars sends fleets against the other. */
export const WAR_REGARD = -0.25;
/** How hard a crowded people presses on its neighbours, at its boldest. */
export const CROWDED_PRESS = 0.5;

/**
 * How hard a people with no star left to settle presses on a neighbour it has met: its
 * boldness, where the neighbour holds a star (or a realm's halls stand) within reach of its own.
 */
function pressing(
  world: World,
  store: PeoplesStore,
  civ: Civilization,
  other: Civilization | null,
  realm: Polity | null,
): number {
  const press = (who: Civilization, them: readonly Ref[]) => {
    if (!store.crowded.includes(who.ref) || !them.length) return 0;
    const mine = store.holdsOf(who.ref).map((h) => starPoint(world, h.star)),
      near = them.some((st) => mine.some((p) => apart(p, starPoint(world, st)) <= REACH_LY));
    return near ? CROWDED_PRESS * peopleNature(world, who).bold : 0;
  };
  if (other)
    return (
      press(
        civ,
        store.holdsOf(other.ref).map((h) => h.star),
      ) +
      press(
        other,
        store.holdsOf(civ.ref).map((h) => h.star),
      )
    );
  if (!realm) return 0;
  const halls = (starSitesOf(world)?.all() ?? [])
    .filter(([cell, s]) => s.arrived && politiesOf(world).of(cell)?.ref === realm.ref)
    .map(([, s]) => s.star);
  return press(civ, halls);
}

/** How fast first feelings settle toward what two peoples are (a share a year). */
export const REGARD_SETTLES = 0.01;
/** How far a year's unrecorded slights and kindnesses move it, at most. */
export const REGARD_STIRS = 0.06;

/**
 * Where two peoples' regard tends when nothing passes between them: toward each other as both
 * are given to trade and curious, away as they are wary and bold — or, for a land of the home
 * world, as its people are open and trading, or valiant and bound to the old ways.
 */
export function leaning(
  world: World,
  civ: Civilization,
  other: Civilization | null,
  cell: number,
): number {
  const lean = (n: Nature) => 0.6 * n.trading + 0.3 * n.curious - 0.5 * n.wary - 0.4 * n.bold;
  let theirs: number;
  if (other) theirs = lean(peopleNature(world, other));
  else {
    const ways = cultureOf(world).get(cell)?.traits ?? [],
      t = (k: keyof typeof WAY) => ways[WAY[k]!] ?? 0.5;
    theirs =
      0.5 * t("openness") + 0.5 * t("trade") - 0.4 * t("valour") - 0.3 * t("tradition") - 0.15;
  }
  return Math.max(-0.9, Math.min(0.9, 0.75 * (lean(peopleNature(world, civ)) + theirs)));
}

/** The principles a people of the stars could teach a realm's seat: what it lacks and is ready for. */
function lessonsFor(ctx: PopulationContext, seat: number): Principle[] {
  const k = (id: string) => knows(ctx, seat, id);
  return PRINCIPLES.filter(
    (p) =>
      p.rate > 0 &&
      !k(p.id) &&
      needsMet(p, k) &&
      affordsPrinciple(p, ctx.medium, ctx.affords.fire, worldKindOf(ctx.generated)),
  );
}

function told(
  store: PeoplesStore,
  m: Meeting,
  other: Ref,
  what: Exchange["what"],
  detail: string,
  year: number,
  event: Ref,
): void {
  store.exchanges.push({ civ: m.civ, other, year, what, detail, event });
  m.exchanges++;
  m.last = year;
  m.lastEvent = event;
  m.regard = Math.min(1, m.regard + 0.05);
}

/** What passes between two peoples who met well: knowledge, goods, or ways. */
function exchange(
  ctx: PopulationContext,
  store: PeoplesStore,
  m: Meeting,
  civ: Civilization,
  realm: Polity | null,
  other: Civilization | null,
  year: number,
): void {
  const world = ctx.world,
    u = world.rng.real(TRADE, keyOf(civ.ref), year, store.meetings.indexOf(m)),
    words = peopleWords(world, civ),
    causes: CauseRef[] = [{ ref: m.lastEvent ?? m.event, role: "trigger", weight: 1 }];
  if (m.lastEvent) causes.push({ ref: m.event, role: "enabler", weight: 0.5 });
  if (other) {
    // Between two peoples of the stars what passes is theirs: told here, not lived.
    const what: Exchange["what"] = u < 0.45 ? "knowledge" : u < 0.85 ? "goods" : "ways",
      event = world.events.emit({
        type: PEOPLES_EVENTS.exchange.type,
        place: null,
        subjects: [civ.ref, other.ref],
        causes,
        data: { name: words.name, other: peopleWords(world, other).name, what, year },
      });
    told(store, m, other.ref, what, "", year, event);
    return;
  }
  if (!realm) return;
  const lessons = year >= civ.stars ? lessonsFor(ctx, realm.seat) : [],
    what: Exchange["what"] =
      u < 0.45 && lessons.length
        ? "knowledge"
        : u < 0.8 && year >= civ.electronics
          ? "goods"
          : "ways",
    place = cellRef(0, realm.seat),
    lesson = what === "knowledge" ? lessons[0]! : null,
    event = world.events.emit({
      type: PEOPLES_EVENTS.exchange.type,
      place,
      subjects: [civ.ref, realm.ref],
      causes,
      data: {
        name: words.name,
        kind: words.kind,
        realm: realm.town,
        what,
        principle: lesson?.name ?? null,
        machines: what === "goods" ? GIFT_MACHINES : 0,
        year,
      },
    });
  if (lesson) {
    const learned = world.events.emit({
      type: LORE_EVENTS.learned.type,
      place,
      causes: [{ ref: event, role: "trigger", weight: 1 }],
      data: { principle: lesson.id },
    });
    loreOf(world).learn(realm.seat, lesson.id, { year, event: learned }, lesson);
    told(store, m, realm.ref, what, lesson.id, year, event);
    return;
  }
  if (what === "goods") {
    marketsOf(world).get(realm.seat)?.move("in", G.machines, GIFT_MACHINES);
    told(store, m, realm.ref, what, String(GIFT_MACHINES), year, event);
    return;
  }
  const ways = cultureOf(world).get(m.cell >= 0 ? m.cell : realm.seat);
  if (ways) pushWays(ways, { event, year, trait: WAY.openness!, amount: 0.04 });
  told(store, m, realm.ref, "ways", "openness", year, event);
}

/** Where a fleet strikes a realm: its halls among the stars nearest the foe, else its seat. */
function strikeAt(
  world: World,
  store: PeoplesStore,
  civ: Civilization,
  realm: Polity,
  home: Ref,
): Ref {
  let best = home,
    d = Infinity;
  for (const [cell, s] of starSitesOf(world)?.all() ?? []) {
    if (!s.arrived || politiesOf(world).of(cell)?.ref !== realm.ref) continue;
    const x = apart(
      starPoint(world, nearestHold(world, store, civ, s.star)),
      starPoint(world, s.star),
    );
    if (x < d) [best, d] = [s.star, x];
  }
  return best;
}

/** A people sends a fleet against a foe it is at odds with. */
function sendFleet(
  ctx: PopulationContext,
  store: PeoplesStore,
  m: Meeting,
  civ: Civilization,
  foe: Ref,
  to: Ref,
  year: number,
): void {
  const world = ctx.world,
    from = nearestHold(world, store, civ, to),
    years = crossing(world, from, to, speedOf(civ, year));
  m.lastRaid = year;
  if (years > LONGEST_CROSSING) return;
  const realm = politiesOf(world).get(foe),
    event = world.events.emit({
      type: PEOPLES_EVENTS.sailed.type,
      place: null,
      subjects: [civ.ref, foe],
      causes: [
        { ref: m.lastRaidEvent ?? m.event, role: "trigger", weight: 1 },
        ...(m.lastRaidEvent ? [{ ref: m.event, role: "enabler" as const, weight: 0.5 }] : []),
      ],
      data: {
        name: peopleWords(world, civ).name,
        kind: "fleet",
        realm: realm?.town ?? null,
        years,
        year,
      },
    });
  store.ships.push({
    id: store.count++,
    civ: civ.ref,
    kind: "fleet",
    from,
    to,
    sailed: year,
    arrives: year + years,
    event,
    toward: foe,
    heard: false,
    arrived: null,
  });
}

/** A fleet arrives: its strength against its foe's; won, it burns a realm's halls or takes a people's hold. */
function fleetArrives(
  ctx: PopulationContext,
  store: PeoplesStore,
  civ: Civilization,
  ship: PeopleShip,
  civs: readonly Civilization[],
  year: number,
  t: SimTime,
): void {
  const world = ctx.world,
    foe = ship.toward!,
    them = civs.find((c) => c.ref === foe),
    realm = them ? undefined : politiesOf(world).get(foe),
    held = them ? store.holdsOf(them.ref).some((h) => h.star === ship.to) : false;
  if (them ? !held : !realm || realm.ended !== null) {
    ship.arrived = ship.event;
    return;
  }
  const m = store.meetingOf(civ.ref, foe),
    words = peopleWords(world, civ),
    n = peopleNature(world, civ),
    theirs = peopleStrength(civ, year) * (0.5 + n.bold),
    ours = them ? peopleStrength(them, year) : realmStrength(ctx, realm!),
    won = world.rng.real(RAID, keyOf(civ.ref), year, 0x10000 + ship.id) < theirs / (theirs + ours),
    site = realm
      ? (starSitesOf(world)
          ?.all()
          .find(
            ([c, s]) => s.star === ship.to && politiesOf(world).of(c)?.ref === realm.ref,
          )?.[0] ?? null)
      : null,
    cell = realm ? (site ?? realm.seat) : -1,
    far = site !== null,
    taken = !!them && won && ship.to !== them.star;
  const event = world.events.emit({
    type: PEOPLES_EVENTS.raid.type,
    place: cell >= 0 ? cellRef(0, cell) : null,
    subjects: [civ.ref, foe],
    causes: [
      { ref: ship.event, role: "trigger", weight: 1 },
      ...(m ? [{ ref: m.event, role: "enabler" as const, weight: 0.6 }] : []),
    ],
    data: {
      name: words.name,
      kind: words.kind,
      realm: realm?.town ?? null,
      other: them ? peopleWords(world, them).name : null,
      won,
      far,
      taken,
      strength: Math.round(theirs * 10) / 10,
      defence: Math.round(ours * 10) / 10,
      year,
    },
  });
  ship.arrived = event;
  let dead = 0;
  if (won && realm) {
    dead = strike(ctx, cell, far ? 0.25 : 0.03, t);
    raze(ctx, cell, far ? 0.4 : 0.1, t);
    grieve(world, cell, far ? 0.4 : 0.2, event);
  }
  if (taken && them) {
    store.holds.set(
      them.ref,
      store.holdsOf(them.ref).filter((h) => h.star !== ship.to),
    );
    store.holds.get(civ.ref)!.push({ star: ship.to, year, event, from: them.ref });
  }
  store.raids.push({
    civ: civ.ref,
    other: foe,
    star: ship.to,
    cell,
    year,
    won,
    dead,
    taken,
    event,
  });
  if (m) {
    m.raids++;
    m.lastRaidEvent = event;
    // Beaten off, a people thinks again; unanswered, the feud deepens.
    m.regard = Math.max(-1, Math.min(1, m.regard + (won ? -0.05 : 0.15)));
  }
}

/** The year of the peoples among the stars: arrivals, meetings, exchanges, fleets and sailings. */
export function peoplesYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = peoplesOf(world)!,
    year = yearOfMoment(t),
    civs = civilizationsNear(world),
    realms = politiesOf(world),
    home = ctx.generated.star.ref as Ref;
  if (!civs.length) return;
  const byRef = new Map(civs.map((c) => [c.ref as string, c]));
  if (store.homeSignals === null && realms.living().some((p) => knows(ctx, p.seat, "electronics")))
    store.homeSignals = year;

  // —— Ships that arrive.
  for (const ship of store.ships) {
    if (ship.arrived || year < ship.arrives) continue;
    const civ = byRef.get(ship.civ)!,
      words = peopleWords(world, civ);
    if (ship.kind === "fleet") {
      fleetArrives(ctx, store, civ, ship, civs, year, t);
      continue;
    }
    if (ship.kind === "envoys") {
      // They come down where the most people are ruled from (or where the god called them
      // down); before the home world can speak across the dark they look, and are seen, and go.
      const at = ship.cell !== undefined ? calledTo(ctx, ship.cell) : landingPlace(ctx);
      if (!at) {
        ship.arrived = ship.event;
        continue;
      }
      const omen = store.homeSignals === null,
        landed = world.events.emit({
          type: PEOPLES_EVENTS.landed.type,
          place: cellRef(0, at.cell),
          subjects: [civ.ref, ...(at.realm ? [at.realm.ref] : [])],
          causes: [{ ref: ship.event, role: "trigger", weight: 1 }],
          data: {
            name: words.name,
            kind: words.kind,
            realm: at.realm?.town ?? null,
            omen,
            heard: ship.heard,
            year,
            ...(ship.cell !== undefined ? { called: true } : {}),
          },
        });
      ship.arrived = landed;
      store.landings.push({ civ: civ.ref, cell: at.cell, year, omen, event: landed });
      const before = store.meetings.find((m) => m.civ === civ.ref && m.star === home);
      if (!before) {
        const side: Side = { kind: "home", cell: at.cell, realm: at.realm };
        meet(ctx, store, civ, side, home, at.cell, year, t, landed, omen);
      } else if (!omen && !before.talking) {
        // They come again, and now the two can speak.
        before.talking = true;
        before.last = year;
        before.lastEvent = landed;
      }
      continue;
    }
    // Settlers come down about their star: a hold of theirs.
    const settled = world.events.emit({
      type: PEOPLES_EVENTS.settled.type,
      place: null,
      subjects: [civ.ref, ship.to],
      causes: [{ ref: ship.event, role: "trigger", weight: 1 }],
      data: {
        name: words.name,
        kind: words.kind,
        distance:
          Math.round(apart(starPoint(world, civ.star), starPoint(world, ship.to)) * 10) / 10,
        year,
      },
    });
    ship.arrived = settled;
    store.holds.get(civ.ref)!.push({ star: ship.to, year, event: settled, from: null });
    // The home world's halls already there: the two meet.
    for (const [cell, site] of starSitesOf(world)?.all() ?? []) {
      const realm = realms.of(cell);
      if (site.star !== ship.to || !site.arrived || !realm || realm.ended !== null) continue;
      if (!store.meetingOf(civ.ref, realm.ref))
        meet(
          ctx,
          store,
          civ,
          { kind: "home", cell, realm },
          ship.to,
          cell,
          year,
          t,
          settled,
          false,
        );
    }
  }

  // —— The home world's ships come down about a star a people holds: the two meet there.
  for (const [cell, site] of starSitesOf(world)?.all() ?? []) {
    if (!site.arrived || store.seen.includes(site.arrived)) continue;
    store.seen.push(site.arrived);
    const holder =
        civs.find((c) => c.star === site.star) ?? byRef.get(store.holder(site.star) ?? ""),
      realm = realms.of(cell);
    if (!holder || !realm || realm.ended !== null || store.meetingOf(holder.ref, realm.ref))
      continue;
    const side: Side = { kind: "home", cell, realm },
      m = meet(ctx, store, holder, side, site.star, cell, year, t, site.arrived, false);
    m.talking = year >= holder.electronics;
  }

  // —— Peoples come near enough to hear each other meet: one of them at the stars, the other at
  // the stars too or at least speaking across the dark (its signals out).
  const reachOf = (c: Civilization): readonly Hold[] =>
    store.holds.has(c.ref)
      ? store.holdsOf(c.ref)
      : year >= c.electronics
        ? [{ star: c.star, year: c.electronics, event: null, from: null }]
        : [];
  for (let i = 0; i < civs.length; i++)
    for (let j = i + 1; j < civs.length; j++) {
      const a = civs[i]!,
        b = civs[j]!,
        aOut = store.holds.has(a.ref),
        bOut = store.holds.has(b.ref);
      if ((!aOut && !bOut) || store.meetingOf(a.ref, b.ref)) continue;
      let close: { hold: Hold; by: Civilization; d: number } | null = null;
      for (const ha of reachOf(a))
        for (const hb of reachOf(b)) {
          const d = apart(starPoint(world, ha.star), starPoint(world, hb.star));
          if (d > HEAR_LY || (close && d >= close.d)) continue;
          // The one that came: the one at the stars, or of two, the one whose hold is the younger.
          close =
            aOut && (!bOut || ha.year > hb.year) ? { hold: ha, by: a, d } : { hold: hb, by: b, d };
        }
      if (!close) continue;
      const found = close.by === a ? b : a;
      meet(
        ctx,
        store,
        close.by,
        { kind: "people", civ: found },
        close.hold.star,
        -1,
        year,
        t,
        close.hold.event ?? close.by.ref,
        false,
      );
    }

  // —— Meeting by meeting: first feelings settle toward what the two are; exchanges where they
  // stand well, fleets where they stand ill.
  for (const m of store.meetings) {
    const civ = byRef.get(m.civ)!,
      n = peopleNature(world, civ),
      other = m.with === "people" ? byRef.get(m.other)! : null,
      met = other ? undefined : realms.get(m.other),
      realm = other
        ? null
        : met && met.ended === null
          ? met
          : m.cell >= 0
            ? (realms.of(m.cell) ?? null)
            : null;
    // (A people with nowhere left to settle presses on neighbours it has met: the bold the more.)
    const aim =
      leaning(world, civ, other, m.cell >= 0 ? m.cell : (realm?.seat ?? -1)) -
      pressing(world, store, civ, other, realm);
    // (And what passes unrecorded between them — a slight, a kindness — moves it a little.)
    const stir = world.rng.real(MEET, keyOf(civ.ref), year, 0x20000 + store.meetings.indexOf(m));
    m.regard = Math.max(
      -1,
      Math.min(1, m.regard + (aim - m.regard) * REGARD_SETTLES + REGARD_STIRS * (stir - 0.5)),
    );
    if (!m.talking || (!other && !realm)) continue;
    // (Between two peoples of the stars, a crossing's worth of years between one and the next.)
    const every = Math.round((other ? 90 : 30) / (0.4 + n.trading)),
      index = store.meetings.indexOf(m);
    if (m.regard > 0 && year - m.last >= every) exchange(ctx, store, m, civ, realm, other, year);
    if (
      m.regard < WAR_REGARD &&
      year >= civ.stars &&
      year - m.lastRaid >= FLEET_GAP &&
      !store.ships.some((s) => s.kind === "fleet" && s.civ === civ.ref && !s.arrived) &&
      world.rng.real(RAID, keyOf(civ.ref), year, index) < 0.03 * (0.5 + n.bold)
    ) {
      if (realm)
        sendFleet(ctx, store, m, civ, realm.ref, strikeAt(world, store, civ, realm, home), year);
      else if (other) {
        // Against another people: its hold nearest the fleet's, never its own star.
        let pick: Ref | null = null,
          d = Infinity;
        for (const h of store.holdsOf(other.ref)) {
          if (h.star === other.star) continue;
          const x = apart(
            starPoint(world, nearestHold(world, store, civ, h.star)),
            starPoint(world, h.star),
          );
          if (x < d) [pick, d] = [h.star, x];
        }
        if (pick) sendFleet(ctx, store, m, civ, other.ref, pick, year);
      }
    }
  }

  // —— Ships that sail: envoys to the home world, settlers to the nearest world they could live on.
  for (const civ of civs) {
    if (year < civ.stars) continue;
    if (!store.holds.has(civ.ref)) firstSight(world, store, civ, civs, home, year);
    const out = store.ships.filter((s) => s.civ === civ.ref && !s.arrived).length;
    if (out >= MOST_SHIPS) continue;
    const n = peopleNature(world, civ),
      key = keyOf(civ.ref),
      speed = speedOf(civ, year),
      words = peopleWords(world, civ),
      sent = store.ships.filter((s) => s.civ === civ.ref && s.kind === "envoys"),
      ever = sent.length > 0 || store.landings.some((l) => l.civ === civ.ref),
      hears =
        store.homeSignals !== null &&
        year >= store.homeSignals + Math.ceil(apart(starPoint(world, civ.star), ORIGIN)),
      // A people at the stars sees that the home world lives (its air); a curious one goes to look.
      chance =
        hears && !sent.some((s) => s.heard)
          ? 0.05 + 0.15 * n.curious
          : !ever
            ? 0.002 + 0.01 * n.curious
            : 0;
    if (chance > 0 && world.rng.real(SAIL, key, year, 1) < chance) {
      const from = nearestHold(world, store, civ, home),
        years = crossing(world, from, home, speed);
      if (years <= LONGEST_CROSSING) {
        const event = world.events.emit({
          type: PEOPLES_EVENTS.sailed.type,
          place: null,
          subjects: [civ.ref],
          causes: [{ ref: civ.ref, role: "trigger", weight: 1 }],
          data: { name: words.name, kind: "envoys", heard: hears, years, year },
        });
        store.ships.push({
          id: store.count++,
          civ: civ.ref,
          kind: "envoys",
          from,
          to: home,
          sailed: year,
          arrives: year + years,
          event,
          toward: null,
          heard: hears,
          arrived: null,
        });
        continue;
      }
    }
    if (year < (store.next.get(civ.ref) ?? 0) || store.holdsOf(civ.ref).length >= MOST_HOLDS)
      continue;
    store.next.set(
      civ.ref,
      year + Math.round(SETTLE_GAP * civ.pace * (0.6 + 0.8 * world.rng.real(SAIL, key, year, 2))),
    );
    const spot = nextSpot(world, store, civ, civs, home),
      crowded = store.crowded.includes(civ.ref);
    if (!spot && !crowded) store.crowded.push(civ.ref);
    if (spot && crowded) store.crowded = store.crowded.filter((c) => c !== civ.ref);
    if (!spot) continue;
    const from = nearestHold(world, store, civ, spot.ref),
      years = crossing(world, from, spot.ref, speed);
    if (years > LONGEST_CROSSING) continue;
    const event = world.events.emit({
      type: PEOPLES_EVENTS.sailed.type,
      place: null,
      subjects: [civ.ref, spot.ref],
      causes: [{ ref: civ.ref, role: "trigger", weight: 1 }],
      data: { name: words.name, kind: "settlers", years, year },
    });
    store.ships.push({
      id: store.count++,
      civ: civ.ref,
      kind: "settlers",
      from,
      to: spot.ref,
      sailed: year,
      arrives: year + years,
      event,
      toward: null,
      heard: false,
      arrived: null,
    });
  }

  // —— What is kept: the latest of each.
  const trim = <T>(list: T[], keep: number) => {
    if (list.length > keep) list.splice(0, list.length - keep);
  };
  trim(store.exchanges, KEEP.exchanges);
  trim(store.raids, KEEP.raids);
  trim(store.landings, KEEP.landings);
  trim(store.seen, KEEP.seen);
  const arrived = store.ships.filter((s) => s.arrived);
  if (arrived.length > KEEP.arrived) {
    const gone = new Set(arrived.slice(0, arrived.length - KEEP.arrived));
    store.ships = store.ships.filter((s) => !gone.has(s));
  }
}

export function installPeoples(world: World, ctx: () => PopulationContext): PeoplesStore {
  const store = world.register(new PeoplesStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "201.space.peoples", every: YEAR, run: (t) => peoplesYear(ctx(), t) });
  return store;
}
