// Culture and language (docs/architecture §19): each peopled land has its ways — a handful of traits between two poles
// (rules/ways.ts) — and its tongue. A people's first ways are read off what it is and where it lives: its body (how fast it
// lives, how closely, how it bears its young, what it eats, its medium, blood, size and senses) and each land's seasons,
// plenty, rain, fevers, ground, shore and river; so no two peoples begin alike, and no two lands of one people. What a land
// lives through presses its ways year by year as deep as it went: hunger, a god seen to act, each new thing known. Ways
// drift a little each year, are drawn toward the lands they deal with (neighbours, roads, trade), relax toward what their
// body, land, lessons and faith make them, at the pace their generations turn over; and once in ten years each land weighs
// how it and those it deals with stood on each way and how they fared, and is drawn toward what it has seen go well (the
// evidence a realm learns by, rules/learn.ts, eight ways wide). Each land keeps the strongest of the presses on it, so the
// explainer can say why a people are as they are. Tongues lose and gain sounds and borrow from their neighbours', so names
// near each other sound alike and names far apart drift apart. A newly peopled land takes the ways of those who came, drawn
// to what the new land makes of them.
import {
  YEAR,
  defineEventType,
  defineStream,
  dmath,
  gaussian,
  yearOfMoment,
  type Hasher,
  type Ref,
  type Rng,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  keptKey,
  borrowSound,
  cradleTongue,
  offworldSite,
  shiftTongue,
  type HomeWorld,
  type Tongue,
} from "../../gen/index.ts";
import {
  BODY_PARTS,
  soundChange,
  HOLD,
  LAND_PARTS,
  LIVED,
  WAY,
  WAYS_LEARNING,
  WAYS_RELAX,
  WAY_TRAITS,
  bodyReading,
  chanceOf,
  faredBy,
  hungerOf,
  landReading,
  leansOf,
  likeness,
  noWaysBelief,
  seenWeight,
  valuesOf,
  waysBelieveAfter,
  waysEvidence,
  waysFrom,
  waysPace,
  waysPull,
  type BodyPlan,
  type LandReading,
  type Medium,
  type WaysBelief,
  type WaysRead,
  type WayTrait,
} from "../../rules/index.ts";
import { spaceSteps, type PopulationContext } from "../population/systems.ts";
import { capacity, livable } from "../population/model.ts";
import { politiesOf } from "../polity/polity.ts";
import type { MarketStore } from "../economy/market.ts";
import type { OrderStore } from "../order/order.ts";
import { readersOf } from "../lore/letters.ts";

export { WAY, WAY_TRAITS, type WayTrait };

export const CULTURE_EVENTS = {
  /** A land drawn to some way by what it has seen go well, or away from what it has seen go ill. */
  learned: defineEventType("culture.learned", 3),
};

/** One push on a people's ways, and the event that gave it. */
export type Nudge = {
  readonly event: Ref;
  readonly year: number;
  readonly trait: number;
  readonly amount: number;
};

export type Ways = {
  readonly cell: number;
  traits: number[];
  /**
   * The ways a people return to when nothing presses them: what their body and their land make of them, as they had them
   * when the chronicle opened, or brought when they came and the new land drew them to.
   */
  base: number[];
  tongue: Tongue;
  /** The strongest pushes, strongest first. */
  nudges: Nudge[];
  /** Where these ways came from: the event that brought the first of these people. */
  readonly from: Ref | null;
  /**
   * What it believes of each way, as kept (rules/ways.ts WaysBelief): its evidence for standing high on each, then how much
   * evidence that is, in thousandths; and the year it was faded to. Absent: it has weighed nothing yet.
   */
  learnt?: number[];
  learntAt?: number;
};

/** How many pushes a people remember. */
const KEPT_NUDGES = 6;

const DRIFT = defineStream("culture.drift");
const SPEECH = defineStream("culture.speech");

export class CultureStore implements StateStore {
  readonly name = "culture.ways";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly map = new Map<number, Ways>();

  get(cell: number): Ways | undefined {
    return this.map.get(cell);
  }

  set(w: Ways): void {
    this.map.set(w.cell, w);
  }

  all(): Ways[] {
    return [...this.map.values()].sort((a, b) => a.cell - b.cell);
  }

  /** The events a people's ways answer to must stay in history. */
  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const w of this.map.values()) {
      for (const n of w.nudges) refs.push(n.event);
      if (w.from) refs.push(w.from);
    }
    return refs;
  }

  hashInto(h: Hasher): void {
    h.value(this.all());
  }

  save(): unknown {
    return { ways: this.all() };
  }

  load(state: unknown): void {
    this.map.clear();
    for (const w of (state as { ways: Ways[] }).ways)
      this.map.set(w.cell, {
        ...w,
        traits: [...w.traits],
        base: [...w.base],
        nudges: [...w.nudges],
        ...(w.learnt ? { learnt: [...w.learnt] } : {}),
      });
  }
}

export function cultureOf(world: World): CultureStore {
  return world.store<CultureStore>("culture.ways");
}

// —— What a body and a land make of a people's ways —————————————————————————————————————————————————————

/** What a people's body presses each of their ways to (an offset each): the same in every land of theirs. */
export function bodyWays(body: BodyPlan | null | undefined): number[] {
  return leansOf(BODY_PARTS, bodyReading(body));
}

/** The mean rain of the lands a people of a medium could live in, on a world as made (a pure reading, kept). */
const MEAN_RAIN = new Map<string, number>();
function meanRain(g: HomeWorld, medium: Medium): number {
  const key = `${keptKey(g)}:${medium}`;
  let m = MEAN_RAIN.get(key);
  if (m === undefined) {
    let sum = 0,
      n = 0;
    const cells = g.climate.precipitation.length;
    for (let c = 0; c < cells; c++)
      if (livable(g, c, medium)) {
        sum += g.climate.precipitation[c]!;
        n++;
      }
    m = n ? sum / n : 1000;
    if (MEAN_RAIN.size > 64) MEAN_RAIN.clear();
    MEAN_RAIN.set(key, m);
  }
  return m;
}

/** A land as its people's ways read it, as it was made (rules/ways.ts LandReading). */
export function landRead(
  g: HomeWorld,
  cell: number,
  medium: Medium,
  appetite: number,
): LandReading {
  if (offworldSite(g, cell))
    return { seasonality: 0, gives: 0, rain: 1, relief: 0, shore: 0, river: false, sealed: true };
  const elev = g.tectonics.elevation,
    here = elev[cell] ?? 0,
    from = g.grid.offsets[cell] ?? 0,
    to = g.grid.offsets[cell + 1] ?? from;
  let relief = 0,
    other = 0;
  for (let k = from; k < to; k++) {
    const e = elev[g.grid.neighbours[k]!] ?? here;
    relief += Math.abs(e - here);
    if (e > 0 !== here > 0) other++;
  }
  const n = Math.max(1, to - from),
    cap = capacity(g, cell, medium);
  return {
    seasonality: g.climate.seasonality[cell] ?? 0,
    gives: cap.areaKm2 > 0 ? cap.forage / cap.areaKm2 / Math.max(0.05, appetite) : 0,
    rain: (g.climate.precipitation[cell] ?? 0) / Math.max(1, meanRain(g, medium)),
    relief: relief / n,
    shore: other / n,
    river: g.water.river[cell] === 1,
    sealed: false,
  };
}

/** What a land presses its people's ways to (an offset each), as it was made. */
export function landWays(g: HomeWorld, cell: number, medium: Medium, appetite: number): number[] {
  return leansOf(LAND_PARTS, landReading(landRead(g, cell, medium, appetite)));
}

/** How far moving from one land to another draws a people's ways: what the new land makes of them, less what the old did. */
export function landShift(
  g: HomeWorld,
  from: number,
  to: number,
  medium: Medium,
  appetite: number,
): number[] {
  const a = landWays(g, from, medium, appetite),
    b = landWays(g, to, medium, appetite);
  return b.map((x, k) => x - a[k]!);
}

/** The first people's ways: as their body and their cradle make them; the cradle's tongue. */
export function cradleWays(
  cell: number,
  culture: number,
  from: Ref | null,
  /** What their body and land make of each way (an offset each; absent: nothing, every way at its middle). */
  lean?: readonly number[],
): Ways {
  const traits = lean
    ? waysFrom(
        lean,
        WAY_TRAITS.map(() => 0),
      )
    : WAY_TRAITS.map(() => 0.5);
  return {
    cell,
    traits,
    base: [...traits],
    tongue: cradleTongue(culture),
    nudges: [],
    from,
  };
}

/**
 * Ways that have drifted for `steps` generations of the prehistory away from those of the people who came (`cradle`): traits
 * wander, sounds are lost and gained, and the land they came to draws them (`shift`: what it makes of each way, less what the
 * land they left did). Keyed by the land.
 */
/** How far a people's ways wander in a generation of the prehistory, at the most likely (a normal spread's width). */
const DRIFT_WIDTH = 0.035;
/**
 * Of how far a people's ways stand from what their body and land make of them, what a generation of the prehistory keeps: half
 * of it is left after sixteen generations (est, four centuries of an upright ape's; no source gives a rate: what is known is
 * that the ways of peoples without writing outlast many lifetimes, and that neighbours come of one stock are alike). The wander
 * had nothing drawing it back, as the ways of the chronicle have: over the two hundred generations to a world's far side it came
 * to a walk half the scale wide, every land's ways its forebears' chance (0.20 to 0.29 from what body and land make at the
 * root mean square on three worlds, where a body's whole lean is 0.2 at most and a land's 0.1; 25 to 50 lands of 500 at an
 * end of a way's scale), and the first rings' chance was every later land's: first light's lands stood at valour 0.67 at the
 * mean from a cradle at 0.47, harrow 348's at 0.38 from 0.49. Drawn back so, a walk of DRIFT_WIDTH a generation settles at a
 * spread of 0.12 about what body and land make (the width over the root of one less the square of what is kept): peoples
 * still differ by their forebears' chance as much as by their bodies, and near kin are alike, but no world is all one way by
 * its first few rings. (Drawn back at the chronicle's own rate, WAYS_RELAX a year, the spread is 0.044 and every rule with a
 * line on a way, war games past valour 0.6, zeal past piety 0.55, falls silent on a world of one body: tried, not kept.)
 */
const DRIFT_KEEPS = dmath.pow(0.5, 1 / 16);

export function driftedWays(
  world: { readonly rng: Rng },
  cradle: Ways,
  cell: number,
  steps: number,
  from: Ref | null,
  shift?: readonly number[],
  /** What their body and the land they LEFT make of each way (0 … 1): what their ways were drawn back to there (absent: nothing drew them). */
  made?: readonly number[],
): Ways {
  // Ways wander as a walk does (by the root of the distance); speech shifts at every step. (The wander is a founders' chance,
  // not what makes a people what it is: half as wide since ways are drawn from body and land, so that what a body and a land
  // make of a people shows through it; and drawn back each generation toward what they make.)
  const kept = made ? dmath.pow(DRIFT_KEEPS, steps) : 1,
    // (A walk's spread over the steps: their root where nothing draws it back, less where each step keeps a part of the last.)
    walked = made
      ? dmath.sqrt((1 - kept * kept) / (1 - DRIFT_KEEPS * DRIFT_KEEPS))
      : dmath.sqrt(steps);
  const traits = cradle.traits.map((v, i) =>
    dmath.clamp(
      (made ? made[i]! + kept * (v - made[i]!) : v) +
        (shift?.[i] ?? 0) +
        DRIFT_WIDTH *
          walked *
          gaussian(world.rng.real(DRIFT, cell, 0, 1, i), world.rng.real(DRIFT, cell, 0, 2, i)),
      0.05,
      0.95,
    ),
  );
  let tongue = cradle.tongue;
  for (let k = 0; k < Math.round(steps * 2); k++)
    tongue = shiftTongue(tongue, world.rng.real(SPEECH, cell, 0, 1, k));
  return { cell, traits, base: [...traits], tongue, nudges: [], from };
}

/** Push a people's ways (a nudge kept among their strongest, the trait moved by it). */
export function pushWays(w: Ways, nudge: Nudge): void {
  push(w, nudge);
}

function push(w: Ways, nudge: Nudge): void {
  w.traits[nudge.trait] = dmath.clamp(w.traits[nudge.trait]! + nudge.amount, 0.02, 0.98);
  noteWays(w, nudge);
}

/** Keep a nudge among a people's strongest, the trait not moved by it here (what moved it is told where it moved). */
export function noteWays(w: Ways, nudge: Nudge): void {
  w.nudges.push(nudge);
  w.nudges.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || b.year - a.year);
  if (w.nudges.length > KEPT_NUDGES) w.nudges.length = KEPT_NUDGES;
}

/** A people's ways, as rules/holds.ts and rules/learn.ts read them. */
export function waysReading(w: Ways | undefined): WaysRead {
  const t = (k: number) => w?.traits[k] ?? 0.5;
  return {
    kinship: t(WAY.kinship),
    hierarchy: t(WAY.hierarchy),
    openness: t(WAY.openness),
    tradition: t(WAY.tradition),
    valour: t(WAY.valour),
    piety: t(WAY.piety),
    trade: t(WAY.trade),
    thrift: t(WAY.thrift),
  };
}

/** What a land believes of its ways, as kept, or nothing yet. Only reads. */
export function waysBeliefOf(w: Ways | undefined): WaysBelief | undefined {
  const l = w?.learnt;
  return l
    ? {
        a: l.slice(0, 8).map((x) => x / 1000),
        n: l.slice(8).map((x) => x / 1000),
        at: w!.learntAt ?? 0,
      }
    : undefined;
}

/** What a land's lessons draw each way to now (an offset each), as its evidence stands. Only reads. */
export function waysLearned(w: Ways | undefined, year: number): number[] {
  return waysPull(waysBeliefOf(w), year);
}

/** What else draws a land's ways while it holds to it (an offset each, or nothing): read by `waysTarget`. */
export type HeldLean = (world: World, cell: number, year: number) => readonly number[] | null;
const HELD: HeldLean[] = [];
/** A thing a land holds to that draws its ways (its faith: sim/belief/belief.ts), read wherever a land's ways are drawn. */
export function drawsWays(f: HeldLean): void {
  if (!HELD.includes(f)) HELD.push(f);
}

/** Where a land's ways are drawn to now: what its body and land made of them, what it has learned, and its faith. Only reads. */
export function waysTarget(world: World, w: Ways, year: number): number[] {
  const learned = waysLearned(w, year),
    held = HELD.map((f) => f(world, w.cell, year));
  return w.base.map((b, k) =>
    dmath.clamp(b + learned[k]! + held.reduce((s, x) => s + (x?.[k] ?? 0), 0), 0.02, 0.98),
  );
}

/** The kinds of event through which a land comes to know a thing (sim/lore, sim/population): each loosens custom. */
const KNOWN_TYPES: ReadonlySet<string> = new Set([
  "lore.found",
  "lore.learned",
  "lore.read",
  "lore.brought",
  "knowledge.cultivation",
  "knowledge.cultivation-spread",
  "knowledge.herding",
  "knowledge.herding-spread",
  "knowledge.metalworking",
  "knowledge.metalworking-spread",
]);

/** Whether an event is a god's own act seen in a land: an act or a hand of the god's, and not the world acting on its own. */
export function isSign(type: string, data: unknown): boolean {
  return (
    (type.startsWith("act.") || type.startsWith("hand.")) &&
    !(data as { natural?: unknown } | null)?.natural
  );
}

/** Who a land deals with, and how much: its peopled neighbours, the more where a road runs between them. */
type Near = { readonly w: Ways; readonly weight: number };

/** How a land has fared over the last ten years, as kept by the ledger: its people's growth a year and how it ate (null: too new). */
export function decadeOf(
  ctx: PopulationContext,
  cell: number,
): { grown: number; fed: number } | null {
  const lines = ctx.history.yearsOf(cell),
    n = lines.length;
  if (n < 2) return null;
  const last = lines[n - 1]!,
    first = lines[Math.max(0, n - 11)]!;
  if (last.year - first.year < 2 || first.population <= 0 || last.population <= 0) return null;
  let fed = 0,
    years = 0;
  for (let i = Math.max(0, n - 10); i < n; i++) {
    fed += Math.min(1000, lines[i]!.fed);
    years++;
  }
  return {
    grown: dmath.log(last.population / first.population) / (last.year - first.year),
    fed: fed / years / 1000,
  };
}

/** The fortune a realm's lands share in (rules/learn.ts FORTUNES): its lands, its standing and its wealth, as last measured. */
function realmShare(world: World, cell: number): readonly number[] | null {
  if (!world.hasStore("order.bonds") || !world.hasStore("polity.states")) return null;
  const realm = politiesOf(world).of(cell),
    f = realm ? world.store<OrderStore>("order.bonds").of(realm.ref)?.fortune : undefined;
  return f ? [(f[1] ?? 0) / 100, (f[2] ?? 0) / 100, (f[3] ?? 0) / 100] : null;
}

/** The word a land's realm lets move (rules/holds.ts word; the middle where it keeps none). */
function wordOf(world: World, cell: number): number {
  if (!world.hasStore("order.bonds") || !world.hasStore("polity.states")) return 0.5;
  const realm = politiesOf(world).of(cell),
    held = realm ? world.store<OrderStore>("order.bonds").of(realm.ref)?.held : undefined;
  return held ? held[HOLD.word]! / 100 : 0.5;
}

/** How a land's year of a decade's faring is scaled, against a realm's: a decade's growth a year, and its leanest months. */
const GROWN_WEIGHS = 20,
  FED_WEIGHS = 6;

/**
 * Once in ten years (each land in its own year), a land weighs how it stood on each way against where lands usually stand, and
 * how it then fared; and so of the few lands it deals with most, by how much it deals with them, how like it they are, how
 * freely their word moves and how far it heeds outsiders; less what its people put to the gods. What its evidence then
 * supports draws each way. Told where it moved some way's pull far.
 */
function weighWays(
  ctx: PopulationContext,
  w: Ways,
  near: readonly Near[],
  usual: readonly number[],
  grownMean: number,
  fedMean: number,
  t: SimTime,
): void {
  const { world } = ctx,
    year = yearOfMoment(t),
    read = waysReading(w),
    values = valuesOf(read),
    chance = chanceOf(read),
    // (How a land fared, as these ways count it: its people and how it ate against most lands', its realm's lands, standing, wealth.)
    faredOf = (cell: number): number | null => {
      const d = decadeOf(ctx, cell);
      if (!d) return null;
      const realm = realmShare(world, cell) ?? [0, 0, 0];
      return faredBy(
        [
          dmath.clamp(GROWN_WEIGHS * (d.grown - grownMean), -1, 1),
          realm[0]!,
          realm[1]!,
          realm[2]!,
          dmath.clamp(FED_WEIGHS * (d.fed - fedMean), -1, 1),
        ],
        values,
      );
    };
  const own = faredOf(w.cell);
  if (own === null) return;
  const was = waysLearned(w, year);
  let b = waysBeliefOf(w) ?? noWaysBelief(year);
  b = waysBelieveAfter(b, waysEvidence(w.traits, usual, own, 1 - chance), year);
  // (The lands it deals with most, the most first: a road counts for more than a border.)
  let teacher: { cell: number; moved: number } | null = null;
  const most = Math.max(1, ...near.map((x) => x.weight));
  for (const x of [...near]
    .sort((a, c) => c.weight - a.weight || a.w.cell - c.w.cell)
    .slice(0, WAYS_LEARNING.look)) {
    const fared = faredOf(x.w.cell);
    if (fared === null) continue;
    const seen =
        seenWeight(
          x.weight / most,
          likeness(read, waysReading(x.w)),
          wordOf(world, x.w.cell),
          read.openness,
        ) *
        (1 - chance),
      e = waysEvidence(x.w.traits, usual, fared, seen),
      moved = e.reduce((s, v) => s + Math.abs(v), 0);
    b = waysBelieveAfter(b, e, year);
    if (!teacher || moved > teacher.moved) teacher = { cell: x.w.cell, moved };
  }
  w.learnt = [...b.a, ...b.n].map((x) => Math.round(x * 1000) || 0);
  w.learntAt = b.at;
  // Told where some way's pull moved far: the way moved most, whom it learned it from, how it fared.
  const now = waysLearned(w, year),
    moved = now.map((x, k) => x - was[k]!),
    k = moved.reduce((m, x, i) => (Math.abs(x) > Math.abs(moved[m]!) ? i : m), 0);
  if (Math.abs(moved[k]!) < WAYS_LEARNING.told) return;
  const event = world.events.emit({
    type: CULTURE_EVENTS.learned.type,
    place: ctx.provinces.get(w.cell)?.ref ?? null,
    causes: [],
    data: {
      way: WAY_TRAITS[k],
      moved: moved.map((x) => Math.round(x * 1000) || 0),
      fared: Math.round(own * 100) || 0,
      ...(teacher && teacher.moved > 0 ? { from: teacher.cell } : {}),
    },
  });
  noteWays(w, { event, year, trait: k, amount: moved[k]! });
}

/**
 * The yearly work of culture: new lands take their founders' ways, drawn to what the new land makes of them; what each land
 * lived through presses its ways; lands weigh what they have seen go well; ways drift, draw together and relax toward what
 * they are drawn to; tongues change.
 */
export function cultureYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = cultureOf(world),
    year = yearOfMoment(t),
    markets = world.store<MarketStore>("economy.markets"),
    provinces = ctx.provinces.all(),
    body = g.life.people?.body,
    // (Ways are learned anew by each generation: the quicker they turn over, the faster ways move.)
    pace = waysPace(body?.span ?? 70);
  // A land newly peopled takes the ways of those who came (or, failing that, the cradle's), and what they believed; the new
  // land draws them as the old did not.
  for (const p of provinces) {
    if (store.get(p.cell)) continue;
    const flow = ctx.history.flows().find((f) => f.to === p.cell && f.event === p.arrival),
      source = flow ? store.get(flow.from) : undefined,
      base = source ?? store.all()[0]!,
      shift = landShift(g, base.cell, p.cell, ctx.medium, ctx.life.appetite);
    store.set({
      cell: p.cell,
      traits: [...base.traits],
      base: base.base.map((v, k) => dmath.clamp(v + shift[k]!, 0.02, 0.98)),
      tongue: base.tongue,
      nudges: [],
      from: p.arrival,
      ...(base.learnt ? { learnt: [...base.learnt], learntAt: base.learntAt ?? year } : {}),
    });
  }
  // This year's happenings press the ways of the land they happened in: a god seen to act, each new thing come to.
  const start = Math.max(0, t - YEAR);
  const events = world.events;
  for (let i = events.count - 1; i >= 0 && events.at(i).t > start; i--) {
    const e = events.at(i);
    if (!e.place) continue;
    const sign = isSign(e.type, e.data);
    if (!sign && !KNOWN_TYPES.has(e.type)) continue;
    const w = store.get(Number(e.place.split(":")[2]));
    if (!w) continue;
    if (sign)
      push(w, {
        event: e.id,
        year,
        trait: WAY.piety,
        amount: LIVED.sign * pace * (1 - w.traits[WAY.piety]!),
      });
    // (Each is small, and a land comes to many: told by what it came to know, on its page, not as a push of its own.)
    else
      w.traits[WAY.tradition] = dmath.clamp(
        w.traits[WAY.tradition]! + LIVED.known * pace,
        0.02,
        0.98,
      );
  }
  // Hunger presses as deep as it went in the land's leanest month: thrift, piety, wariness; told by its famine, where it had one.
  for (const p of provinces) {
    if (!p.total()) continue;
    const h = hungerOf(p.leanest),
      w = store.get(p.cell);
    if (!h || !w) continue;
    const famine = p.lastFamine ? world.events.get(p.lastFamine) : undefined,
      told = famine && t - famine.t <= YEAR ? famine.id : null;
    for (let k = 0; k < WAY_TRAITS.length; k++) {
      const amount = LIVED.hunger[k]! * h * pace;
      if (!amount) continue;
      if (told) push(w, { event: told, year, trait: k, amount });
      else w.traits[k] = dmath.clamp(w.traits[k]! + amount, 0.02, 0.98);
    }
  }
  // Who each land deals with, read from the year's ways so far.
  const nears = new Map<number, Near[]>();
  for (const p of provinces) {
    const near: Near[] = [];
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!,
        other = store.get(n);
      if (!other || !ctx.provinces.get(n)?.total()) continue;
      near.push({ w: other, weight: 1 + (markets.route(p.cell, n) ? 1.5 : 0) });
    }
    // A land on another body still hears from its realm's seat while it is ruled from there: word from home pulls its ways,
    // the less the farther the crossing.
    if (offworldSite(g, p.cell)) {
      const realm = politiesOf(world).of(p.cell),
        steps = realm && realm.seat !== p.cell ? spaceSteps(ctx, realm.seat, p.cell) : null,
        home = realm ? store.get(realm.seat) : undefined;
      if (steps !== null && home) near.push({ w: home, weight: 1 / steps });
    }
    nears.set(p.cell, near);
  }
  // Each land in its year of ten weighs what it has seen go well, against where lands usually stand and how most fared.
  const weighing = provinces.filter(
    (p) => p.total() > 0 && store.get(p.cell) && (year + p.cell) % WAYS_LEARNING.every === 0,
  );
  if (weighing.length) {
    const usual = WAY_TRAITS.map(() => 0);
    let lands = 0,
      grown = 0,
      fed = 0,
      measured = 0;
    for (const p of provinces) {
      const w = store.get(p.cell);
      if (!w || !p.total()) continue;
      lands++;
      for (let k = 0; k < usual.length; k++) usual[k]! += w.traits[k]!;
    }
    // (How most fared, read off the lands weighing this year: a tenth of the world, by their number, as good a reading of it
    // as the whole and a tenth of the reading.)
    for (const p of weighing) {
      const d = decadeOf(ctx, p.cell);
      if (d) {
        grown += d.grown;
        fed += d.fed;
        measured++;
      }
    }
    for (let k = 0; k < usual.length; k++) usual[k] = lands ? usual[k]! / lands : 0.5;
    if (measured)
      for (const p of weighing)
        weighWays(
          ctx,
          store.get(p.cell)!,
          nears.get(p.cell) ?? [],
          usual,
          grown / measured,
          fed / measured,
          t,
        );
  }
  // Drift and contact, planned from the year's ways so far, then made.
  const plans = new Map<number, { traits: number[]; tongue: Tongue }>(),
    // (Ways relax toward what they are drawn to in each land's year of ten, ten years' relaxing at once: as slow a thing as a
    // generation's turning needs no yearly step.)
    relaxed = 1 - dmath.pow(1 - Math.min(1, WAYS_RELAX * pace), WAYS_LEARNING.every);
  for (const p of provinces) {
    const w = store.get(p.cell)!,
      near = nears.get(p.cell) ?? [],
      target = (year + p.cell) % WAYS_LEARNING.every === 0 ? waysTarget(world, w, year) : null;
    const total = near.reduce((s, x) => s + x.weight, 0);
    const traits = w.traits.map((v, i) => {
      const pull = total ? near.reduce((s, x) => s + x.w.traits[i]! * x.weight, 0) / total - v : 0,
        wander =
          0.006 *
          gaussian(world.rng.real(DRIFT, p.cell, t, 1, i), world.rng.real(DRIFT, p.cell, t, 2, i));
      // What is not pressed again fades: ways relax toward what they are drawn to, as fast as their generations turn.
      const relax = target ? relaxed * (target[i]! - v) : 0;
      return dmath.clamp(v + 0.01 * pull + relax + wander, 0.02, 0.98);
    });
    let tongue = w.tongue;
    // (Speech changes as each generation learns it anew, the faster the sooner they are grown (an upright ape's, grown at fifteen,
    // a change in thirty years), and the slower as its people read a written standard: the society sweep.)
    if (
      world.rng.real(SPEECH, p.cell, t, 1) <
      soundChange(ctx.life.adulthood, readersOf(world, p.cell))
    )
      tongue = shiftTongue(tongue, world.rng.real(SPEECH, p.cell, t, 2));
    if (near.length && world.rng.real(SPEECH, p.cell, t, 3) < Math.min(0.5, total / 60)) {
      const most = [...near].sort((a, b) => b.weight - a.weight || a.w.cell - b.w.cell)[0]!;
      tongue = borrowSound(tongue, most.w.tongue, world.rng.real(SPEECH, p.cell, t, 4));
    }
    plans.set(p.cell, { traits, tongue });
  }
  for (const [cell, plan] of plans) {
    const w = store.get(cell)!;
    w.traits = plan.traits;
    w.tongue = plan.tongue;
  }
}
