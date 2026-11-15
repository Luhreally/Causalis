// How a realm is held (rules/holds.ts): its four numbers, force, voice, word and trust, kept as whole hundredths on its order. Each
// realm's are first read off the rule it was founded under, its people's ways and their body; every ten years (in the year it weighs
// its laws) each moves partway toward what is wanted of it: half what that rule, those ways and that body ask of it now, half what its
// interest groups want, by their sway; a movement for a voice, a massacre remembered, a rising crushed, a war waged, a host kept
// standing; how widely its choices are carried (word and arms follow it); and what it has learned. A number told in other words than
// it was (a band crossed: an arms ban, a vote given) is an event, with a decision whose factors name what moved it. And what it
// learns is no written lesson (rules/learn.ts): each year every realm's fortune is measured (its people, lands, standing, wealth,
// how it ate, against the year before); when something great befalls a realm, it and each realm that could know of it (its fastest
// word reaching that far within a season: rules/signals.ts) take how that realm stood and how it fared as a piece of evidence, by
// how near and how like them it is; each ten years a realm looks so at itself and its nearest; and what its evidence supports of
// each number pulls that number. Nothing a tick, nothing a person: a few numbers a realm a year, and a weighing every ten years.
import {
  defineEventType,
  dmath,
  parseRef,
  yearOfMoment,
  type Factor,
  type HistoryEvent,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import {
  FALLEN,
  GOODS,
  HOLD,
  HOLDING,
  HOLD_KINDS,
  HOLD_WANTS,
  LEARNING,
  OUTCOME,
  alikeInSize,
  OUTCOMES_OF,
  believeAfter,
  blameFrom,
  blameWords,
  cameOf,
  cameWords,
  chanceOf,
  evidenceKept,
  evidenceOf,
  leaningOf,
  faredBy,
  howWords,
  fortuneAfter,
  likeness,
  movedWords,
  noBelief,
  pullOf,
  seenWeight,
  SHARED,
  yearOf,
  stoodWords,
  tookWords,
  valuesOf,
  weighsFor,
  firstHolds,
  holdWords,
  wayName,
  wordPace,
  type Belief,
  type Blame,
  type Faring,
  type Hold,
  type HoldChange,
  type RuleOutcome,
  type WaysRead,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf, type Ways } from "../culture/culture.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import type { MarketStore } from "../economy/market.ts";
import { knows } from "../lore/lore.ts";
import { warsOf } from "../war/war.ts";
import { LAW_EVERY, swayOnLaws } from "./laws.ts";
import { orderOf, type RealmOrder } from "./order.ts";

export const HOLD_EVENTS = {
  /** A realm's number told in other words: arms banned, a vote given, word freed. */
  held: defineEventType("order.held", 5),
  /** A realm learned from what befell it, or another. */
  lesson: defineEventType("order.lesson", 4),
};

/**
 * One piece of evidence a realm keeps, for its page: what befell whom, when, the event that tells it, how the realm it befell
 * stood and fared, and what this realm made of it. `blame` is read off what it did with it (rules/learn.ts blameFrom).
 */
export type Taught = {
  readonly what: string;
  /** Whose fate it was, where another's: the realm's name then. */
  readonly of: string | null;
  readonly blame: Blame;
  readonly year: number;
  readonly event: Ref | null;
  /** The realm it befell, where another's. */
  readonly whose?: Ref;
  /** How the realm it befell stood then: its four numbers, hundredths; and how far each lay from what was usual among realms. */
  readonly stood?: readonly number[];
  readonly leaned?: readonly number[];
  /** How it fared as this realm counts it, and the parts that weighed most (rules/learn.ts cameOf). */
  readonly came?: readonly number[];
  /** What it did to this realm's beliefs, a number each (thousandths; above nothing: toward its high end). */
  readonly moved?: readonly number[];
  /** How much it weighed with this realm against a fate of its own (hundredths). */
  readonly weight?: number;
};

/** Where a number's words change (rules/holds.ts holdWords): its bands. */
const BANDS: Readonly<Record<Hold, readonly number[]>> = {
  force: [0.3, 0.65],
  voice: [0.2, 0.45, 0.7],
  word: [0.3, 0.65],
  trust: [0.3, 0.65],
};
const bandOf = (h: Hold, v: number) => BANDS[h].filter((b) => v >= b).length;

const trait = (w: Ways | undefined, k: number) => w?.traits[k] ?? 0.5;
/** A people's ways, as rules/holds.ts reads them. */
export function waysRead(w: Ways | undefined): WaysRead {
  return {
    kinship: trait(w, WAY.kinship),
    hierarchy: trait(w, WAY.hierarchy),
    openness: trait(w, WAY.openness),
    tradition: trait(w, WAY.tradition),
    valour: trait(w, WAY.valour),
    piety: trait(w, WAY.piety),
    trade: trait(w, WAY.trade),
    thrift: trait(w, WAY.thrift),
  };
}

/** A realm's four numbers (0 … 1), begun where they are not yet kept. */
export function heldOf(ctx: PopulationContext, p: Polity, o: RealmOrder): number[] {
  if (!o.held)
    o.held = firstHolds(
      p,
      waysRead(cultureOf(ctx.world).get(p.seat)),
      ctx.generated.life.people?.body,
    ).map((x) => Math.round(x * 100));
  return o.held.map((x) => x / 100);
}

/** A realm's numbers as kept (0 … 1), or the middle where it keeps none: for the systems that read them. Only reads. */
export function holdsOf(world: World, realm: Ref | null | undefined): readonly number[] {
  const o = realm ? orderOf(world)?.of(realm) : undefined;
  return o?.held ? o.held.map((x) => x / 100) : MIDDLE;
}
const MIDDLE: readonly number[] = [0.5, 0.5, 0.5, 0.5];
/** One of a realm's numbers as kept (0 … 1; the middle where it keeps none), read without making a list: for rules read often. */
export function holdOf(world: World, realm: Ref | null | undefined, k: number): number {
  const held = realm ? orderOf(world)?.of(realm)?.held : undefined;
  return held ? held[k]! / 100 : 0.5;
}

/**
 * What a realm blames on outsiders, where it does: the latest of its own woes, within a generation, that its ways laid at others' door
 * (rules/holds.ts blameOf "theirs"), and how fresh it is (1 … 0). Its neighbours read it as a grievance against them all
 * (sim/diplomacy/diplomacy.ts). Only reads.
 */
export function blamesOutsiders(
  world: World,
  realm: Ref,
  year: number,
): { taught: Taught; fresh: number } | null {
  const taught = orderOf(world)?.of(realm)?.taught;
  if (!taught) return null;
  for (const x of taught)
    if (!x.of && x.blame === "theirs" && year - x.year < HOLDING.grudge)
      return { taught: x, fresh: 1 - (year - x.year) / HOLDING.grudge };
  return null;
}

/** A number history sets at once (a revolution, a coup): to at least, or at most, a level, told by that event. */
export function setHeld(
  o: RealmOrder,
  h: Hold,
  level: number,
  way: "least" | "most",
  event: Ref,
): void {
  if (!o.held) return;
  const k = HOLD[h],
    v = Math.round(level * 100);
  if (way === "least" ? o.held[k]! >= v : o.held[k]! <= v) return;
  o.held[k] = v;
  (o.heldEvents ??= [null, null, null, null])[k] = event;
}

/** Every ten years (each realm in its own year of ten, with its laws), a realm weighs its four numbers. */
export function weighHolds(ctx: PopulationContext, p: Polity, o: RealmOrder, t: SimTime): void {
  const { world } = ctx,
    year = yearOfMoment(t);
  if ((year + (parseRef(p.ref).b % LAW_EVERY)) % LAW_EVERY !== 0) return;
  const now = heldOf(ctx, p, o),
    ways = cultureOf(world).get(p.seat),
    read = waysRead(ways),
    anchor = firstHolds(p, read, ctx.generated.life.people?.body),
    // (Whose wants weigh is itself how widely its choices are carried: the seat's few under one, the many under all.)
    sway = new Map(
      [...swayOnLaws(ctx, p, o, t)].map(([g, w]) => [g, w * weighsFor(g, now[HOLD.voice]!)]),
    ),
    total = [...sway.values()].reduce((s, x) => s + x, 0),
    voiceMoved = o.movements.find((m) => m.cause === "voice"),
    massacre = o.memory.filter((m) => m.what === "massacre").reduce((s, m) => s + m.weight, 0),
    risings = o.memory.filter((m) => m.what === "rising").reduce((s, m) => s + m.weight, 0),
    // (What it has seen go well and ill, itself and its nearest: rules/learn.ts.)
    pulls = looked(ctx, p, o, year),
    // (At war, choices fall to those who lead it; a host kept standing makes the arms the realm's, not the households'.)
    atWar = warsOf(world).fighting(p.ref).length ? 1 : 0,
    standing = knows(ctx, p.seat, "standing-army") ? 1 : 0;
  for (const h of HOLD_KINDS) {
    const k = HOLD[h],
      groups =
        total > 0
          ? [...sway].reduce((s, [g, w]) => s + w * (HOLD_WANTS[g]?.[k] ?? 0.5), 0) / total
          : anchor[k]!,
      // (A movement for a voice and a massacre remembered push toward a voice; risings of the bound remembered toward a tighter grip.)
      pressed =
        h === "voice"
          ? 0.3 * (voiceMoved?.strength ?? 0) + 0.15 * Math.min(1, massacre) - 0.12 * atWar
          : h === "force"
            ? 0.15 * Math.min(1, risings) + 0.2 * standing
            : h === "word"
              ? 0.1 * Math.min(1, massacre) - 0.1 * Math.min(1, risings)
              : 0,
      // (Who decides alone has the most to fear from word moving freely and from arms in many hands; where many decide, word must
      // move for them to: so how widely a choice is carried pulls on the others.)
      carried =
        h === "word"
          ? 0.3 * (now[HOLD.voice]! - 0.5)
          : h === "force"
            ? 0.2 * (0.5 - now[HOLD.voice]!)
            : 0,
      target = dmath.clamp(0.5 * anchor[k]! + 0.5 * groups + pressed + carried + pulls[k]!, 0, 1),
      gap = target - now[k]!;
    if (Math.abs(gap) < HOLDING.least) continue;
    const to = Math.round(
      dmath.clamp(now[k]! + HOLDING.pace * (1 - 0.5 * read.tradition) * gap, 0, 1) * 100,
    );
    if (to === o.held![k]) continue;
    const from = o.held![k]! / 100;
    o.held![k] = to;
    // (Told only when its words change, and past the line by a little: a number about a line is not told over and over.)
    const band = bandOf(h, to / 100);
    if (
      band === bandOf(h, from) ||
      band !== bandOf(h, to / 100 - 0.03 * Math.sign(to / 100 - from))
    )
      continue;
    // Told in other words: a decision whose factors name what moved it, and the event.
    const ranked = [...sway]
        .map(([g, w]) => ({
          g,
          c: total > 0 ? (w * ((HOLD_WANTS[g]?.[k] ?? 0.5) - from)) / total : 0,
        }))
        .sort((a, b) => Math.abs(b.c) - Math.abs(a.c) || (a.g < b.g ? -1 : 1))
        .slice(0, 3),
      factors: Factor[] = [
        ...ranked.map(({ g, c }) => ({
          name: `${g} ${c * gap >= 0 ? "want it" : "stand against it"}`,
          value: sway.get(g) ?? 0,
          contribution: c,
          source: null,
        })),
        {
          name: "what its rule and its people's ways ask",
          value: anchor[k]!,
          contribution: 0.5 * (anchor[k]! - from),
          source: null,
        },
        ...(pressed
          ? [
              {
                name:
                  h === "voice"
                    ? pressed < 0
                      ? "a war its leaders wage"
                      : "a people who want a voice, a massacre remembered"
                    : h === "force" && standing
                      ? "a host kept standing, risings remembered"
                      : "risings remembered",
                value: pressed,
                contribution: pressed,
                source:
                  h === "voice" && voiceMoved
                    ? { ref: voiceMoved.event, role: "pressure" as const, weight: 1 }
                    : null,
              },
            ]
          : []),
        ...(carried
          ? [
              {
                name: "how widely its choices are carried",
                value: now[HOLD.voice]!,
                contribution: carried,
                source: o.heldEvents?.[HOLD.voice]
                  ? { ref: o.heldEvents[HOLD.voice]!, role: "enabler" as const, weight: 1 }
                  : null,
              },
            ]
          : []),
        ...(Math.abs(pulls[k]!) >= 0.005
          ? [
              {
                name: "what it has seen go well and ill",
                value: pulls[k]!,
                contribution: pulls[k]!,
                source: taughtFor(o, k)?.event
                  ? { ref: taughtFor(o, k)!.event!, role: "pressure" as const, weight: 1 }
                  : null,
              },
            ]
          : []),
      ],
      decision = world.decisions.record({
        rule: "order.held",
        subject: p.ref,
        outcome: { hold: h, from: Math.round(from * 100), to },
        score: Math.abs(gap),
        threshold: HOLDING.least,
        factors,
      }),
      event = world.events.emit({
        type: HOLD_EVENTS.held.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [
          { ref: decision, role: "trigger", weight: 1 },
          ...(taughtFor(o, k)?.event && Math.abs(pulls[k]!) >= 0.005
            ? [{ ref: taughtFor(o, k)!.event!, role: "pressure" as const, weight: 0.6 }]
            : []),
        ],
        data: { realm: realmName(p), hold: h, from: Math.round(from * 100), to },
      });
    (o.heldEvents ??= [null, null, null, null])[k] = event;
  }
}

/** The words of a realm's number now, read off it, its people and its means (rules/holds.ts holdWords). Only reads. */
export function holdNow(
  ctx: PopulationContext,
  p: Polity,
  h: Hold,
  v: number,
  arm: string | null,
): string {
  const seat = p.seat,
    pace = wordPace((id) => knows(ctx, seat, id), ctx.medium);
  return holdWords(h, v, {
    body: ctx.generated.life.people?.body,
    arm,
    // (Named where it outruns any messenger: the wire, a voice through the deep.)
    far: pace.kmADay >= 20_000 ? wayName(pace.way, ctx.medium) : null,
  });
}

// —— How each realm fares, measured ————————————————————————————————————————————————————————————————————

/** How a realm stands now, as its fortune is measured: its people, lands, standing, what its lands hold a head, how they ate. */
function faringOf(ctx: PopulationContext, p: Polity, o: RealmOrder): Faring {
  const markets = ctx.world.store<MarketStore>("economy.markets");
  let people = 0,
    worth = 0,
    fed = 0;
  for (const c of p.members) {
    const land = ctx.provinces.get(c),
      n = land?.total() ?? 0,
      m = markets.get(c);
    people += n;
    fed += n * Math.min(1000, land?.leanest ?? 1000);
    if (m)
      for (let g = 0; g < GOODS.length; g++)
        worth += Math.max(0, m.stock[g] ?? 0) * GOODS[g]!.value;
  }
  return {
    people,
    lands: p.members.length,
    standing: o.legitimacy,
    wealth: people > 0 ? worth / people : 0,
    fed: people > 0 ? fed / people / 1000 : 1,
  };
}

/**
 * The year's measure of every living realm (sim/lore/lessons.ts calls it once a year, before the year's outcomes are read): its
 * fortune moved by what changed since it was last measured. A realm first measured has no fortune yet.
 */
export function fortunesYear(ctx: PopulationContext): void {
  const store = orderOf(ctx.world);
  if (!store) return;
  const years: { o: RealmOrder; year: number[] }[] = [];
  for (const p of politiesOf(ctx.world).living()) {
    const o = store.of(p.ref);
    if (!o) continue;
    const now = faringOf(ctx, p, o),
      was = o.was;
    if (was)
      years.push({
        o,
        year: yearOf(
          {
            people: was[0]!,
            lands: was[1]!,
            standing: was[2]! / 1000,
            wealth: was[3]!,
            fed: was[4]! / 1000,
          },
          now,
        ),
      });
    o.was = [
      Math.round(now.people),
      now.lands,
      Math.round(now.standing * 1000),
      Math.round(now.wealth),
      Math.round(now.fed * 1000),
    ];
  }
  // (What all share in is no one's fortune: each such part against the mean of the realms measured.)
  const mean = SHARED.map((shared, i) =>
    shared && years.length ? years.reduce((s, x) => s + x.year[i]!, 0) / years.length : 0,
  );
  for (const { o, year } of years)
    o.fortune = fortuneAfter(
      (o.fortune ?? []).map((x) => x / 100),
      year.map((x, i) => x - mean[i]!),
    ).map((x) => Math.round(x * 100));
}

/** The year's end: how each living realm stands on its numbers, kept as how it stood when next year's events befall it. */
export function stoodYear(ctx: PopulationContext): void {
  const store = orderOf(ctx.world);
  if (!store) return;
  for (const p of politiesOf(ctx.world).living()) {
    const o = store.of(p.ref);
    if (o?.held) o.stood = [...o.held];
  }
}

/**
 * A realm gone keeps no evidence: what it learned died with it. Its numbers and the last few pieces it kept stay, for its page
 * (LEARNING.gone of them: realms gone are as many as history is long).
 */
function letGo(o: RealmOrder): void {
  if (o.taught && o.taught.length > LEARNING.gone) o.taught = o.taught.slice(0, LEARNING.gone);
  delete o.fortune;
  delete o.was;
  delete o.stood;
  delete o.learnt;
  delete o.learntAt;
  delete o.from;
  delete o.pulls;
}

// —— What a realm believes, and the evidence for it ————————————————————————————————————————————————————

/** What a realm believes, as kept (rules/learn.ts Belief), or nothing yet. Only reads. */
export function learntOf(o: RealmOrder | undefined): Belief | undefined {
  const l = o?.learnt;
  return l
    ? {
        a: l.slice(0, 8).map((x) => x / 1000),
        n: l.slice(8).map((x) => x / 1000),
        at: o!.learntAt ?? 0,
      }
    : undefined;
}

/** The piece of evidence a realm keeps that moved a number most: what its belief of it stands on, for a why. */
function taughtFor(o: RealmOrder, k: number): Taught | undefined {
  let best: Taught | undefined;
  for (const x of o.taught ?? [])
    if (x.moved && Math.abs(x.moved[k] ?? 0) > Math.abs(best?.moved?.[k] ?? 0)) best = x;
  return best ?? o.taught?.[0];
}

/** The kinds of event a realm learns of rule from. */
export const HOLD_READ: readonly string[] = [...OUTCOMES_OF.keys()];

/** The great-circle distance between two lands, km. */
function kmBetween(ctx: PopulationContext, a: number, b: number): number {
  const p = ctx.generated.grid.positions,
    dx = p[3 * a]! - p[3 * b]!,
    dy = p[3 * a + 1]! - p[3 * b + 1]!,
    dz = p[3 * a + 2]! - p[3 * b + 2]!,
    chord = Math.min(2, Math.sqrt(dx * dx + dy * dy + dz * dz));
  return 2 * dmath.asin(chord / 2) * 6371 * ctx.generated.planet.radius;
}

/** How far a realm's word reaches within a season, km: the farther the more freely word moves among them. */
function reachOf(ctx: PopulationContext, q: Polity): number {
  return (
    wordPace((id) => knows(ctx, q.seat, id), ctx.medium).kmADay *
    HOLDING.newsDays *
    (0.5 + holdOf(ctx.world, q.ref, HOLD.word))
  );
}

/**
 * Where realms usually stand on each number (0 … 1): the mean of the living realms, each as it stood when its last year closed.
 * What a realm's standing is measured against, as evidence (rules/learn.ts leaningOf).
 */
function usualOf(ctx: PopulationContext): number[] {
  const store = orderOf(ctx.world),
    sum = [0, 0, 0, 0];
  let n = 0;
  for (const q of politiesOf(ctx.world).living()) {
    const stance = store?.of(q.ref)?.stood ?? store?.of(q.ref)?.held;
    if (!stance) continue;
    n++;
    for (let k = 0; k < 4; k++) sum[k]! += stance[k]! / 100;
  }
  return sum.map((x) => (n ? x / n : 0.5));
}

/** What a piece of evidence was, as a realm weighed it. */
type Weighed = {
  /** What it says of each number. */
  evidence: number[];
  /** How the realm it befell stood (hundredths), how far from the usual (hundredths), and how it fared as this one counts it. */
  stood: number[];
  leaned: number[];
  came: number[];
  weight: number;
  blame: Blame;
  /** How far it moved this realm's beliefs, in all. */
  moved: number;
};

/**
 * A realm takes a piece of evidence: how `whose` stood (as its last year closed) and how it has fared (its fortune, as this realm's
 * ways count it; a realm gone lost everything), by what it weighs with this realm: all, where it is its own, less what its people
 * put to the gods; another's by how near and like it is and how freely word leaves it (`near`: 1 at hand … 0 at the edge of its
 * word). Its belief of each number moves by it; those it learns from are kept, the few it has learned most from.
 */
function weigh(
  ctx: PopulationContext,
  p: Polity,
  o: RealmOrder,
  whose: Polity,
  near: number,
  year: number,
  usual: readonly number[],
): Weighed | null {
  const { world } = ctx,
    own = whose === p,
    theirs = own ? o : orderOf(world)!.of(whose.ref),
    stance = theirs?.stood ?? theirs?.held;
  if (!theirs || !stance) return null;
  const culture = cultureOf(world),
    ways = waysRead(culture.get(p.seat)),
    fortune = whose.ended !== null ? FALLEN : (theirs.fortune ?? []).map((x) => x / 100),
    values = valuesOf(ways),
    fared = faredBy(fortune, values),
    chance = chanceOf(ways),
    seen = own
      ? 1
      : seenWeight(
          near,
          // (How like it they are: in their ways, and in how great they are.)
          likeness(ways, waysRead(culture.get(whose.seat))) *
            alikeInSize(o.was?.[0] ?? 0, theirs.was?.[0] ?? 0),
          stance[HOLD.word]! / 100,
          ways.openness,
        ),
    weight = seen * (1 - chance),
    stood = stance.map((x) => x / 100),
    evidence = evidenceOf(stood, usual, fared, weight),
    moved = evidence.reduce((s, x) => s + Math.abs(x), 0);
  if (moved > 0) {
    const keep = evidenceKept(year - (o.learntAt ?? year)),
      b = believeAfter(learntOf(o) ?? noBelief(year), evidence, own, year);
    o.learnt = [...b.a, ...b.n].map((x) => Math.round(x * 1000));
    o.learntAt = b.at;
    // (Whom it learns from: each by how far their fates have moved it, faded as its evidence is.)
    const from = new Map((o.from ?? []).map(([ref, w]) => [ref, w * keep]));
    if (!own) from.set(whose.ref, (from.get(whose.ref) ?? 0) + moved * 1000);
    const kept = [...from.entries()]
      .map(([ref, w]) => [ref, Math.round(w)] as [string, number])
      .filter((x) => x[1] > 0)
      .sort((a, c) => c[1] - a[1] || (a[0] < c[0] ? -1 : 1))
      .slice(0, LEARNING.teachers);
    if (kept.length) o.from = kept;
    else delete o.from;
  }
  return {
    evidence,
    stood: [...stance],
    leaned: leaningOf(stood, usual).map((x) => Math.round(x * 100)),
    came: cameOf(fortune, values),
    weight,
    blame: blameFrom(evidence, chance, own, seen),
    moved,
  };
}

/**
 * Each ten years, as it weighs its numbers, a realm looks at how it has itself fared as it stands, and at the nearest few realms
 * its word reaches: evidence as any other, though nothing great befell them (a realm that prospers teaches too). What its beliefs
 * then ask of each of its numbers.
 */
function looked(ctx: PopulationContext, p: Polity, o: RealmOrder, year: number): number[] {
  heldOf(ctx, p, o);
  // (A save from before evidence: the pulls its written lessons left are let go.)
  delete o.pulls;
  const usual = usualOf(ctx);
  weigh(ctx, p, o, p, 1, year, usual);
  const reach = reachOf(ctx, p),
    seen: { q: Polity; km: number }[] = [];
  for (const q of politiesOf(ctx.world).living()) {
    if (q === p) continue;
    const km = kmBetween(ctx, q.seat, p.seat);
    if (km <= reach) seen.push({ q, km });
  }
  seen.sort((a, b) => a.km - b.km || (a.q.ref < b.q.ref ? -1 : 1));
  for (const { q, km } of seen.slice(0, LEARNING.look))
    weigh(ctx, p, o, q, 1 - km / reach, year, usual);
  const b = learntOf(o);
  return HOLD_KINDS.map((_, k) => pullOf(b, k, year));
}

/**
 * The year's outcomes, read off the events history wrote (sim/lore/lessons.ts reads them once): each realm it befell takes it as
 * evidence, and, where it is one others take note of, each realm whose fastest word reaches that far within a season. A realm
 * takes one piece a year of any one realm: the first great thing that befell it that year stands for the year.
 */
export function readOutcomes(
  ctx: PopulationContext,
  events: readonly HistoryEvent[],
  t: SimTime,
): void {
  const { world } = ctx,
    store = orderOf(world);
  if (!store) return;
  const realms = politiesOf(world),
    year = yearOfMoment(t),
    taken = new Set<string>(),
    gone: Polity[] = [];
  let living: Polity[] | null = null,
    reach: Map<Ref, number> | null = null,
    usual: number[] | null = null;
  for (const e of events) {
    const d = (e.data ?? {}) as Record<string, unknown>;
    for (const o of OUTCOMES_OF.get(e.type) ?? []) {
      if (o.when && !o.when(d)) continue;
      const at = typeof o.at === "number" ? o.at : o.at(d),
        who = e.subjects[at] as Ref | undefined,
        p = who ? realms.get(who) : undefined;
      if (!p) continue;
      if (p.ended !== null && !gone.includes(p)) gone.push(p);
      if (p.ended === null && !taken.has(`${p.ref}|${p.ref}`)) {
        taken.add(`${p.ref}|${p.ref}`);
        learn(ctx, p, o, null, 1, e, year, (usual ??= usualOf(ctx)));
      }
      if (!o.seen) continue;
      // Those who could know of it: their word reaching its seat within a season, the farther the more freely word moves among them.
      living ??= realms.living();
      reach ??= new Map(living.map((q) => [q.ref, reachOf(ctx, q)]));
      for (const q of living) {
        if (q === p || taken.has(`${q.ref}|${p.ref}`)) continue;
        const km = kmBetween(ctx, q.seat, p.seat),
          far = reach.get(q.ref)!;
        if (km > far) continue;
        taken.add(`${q.ref}|${p.ref}`);
        learn(ctx, q, o, p, 1 - km / far, e, year, (usual ??= usualOf(ctx)));
      }
    }
  }
  for (const p of gone) {
    const o = store.of(p.ref);
    if (o) letGo(o);
  }
  // (Once in ten years, any realm gone unnoticed lets go what it had learned.)
  if (year % 10 === 0)
    for (const o of store.realms.values())
      if (o.was && realms.get(o.realm as Ref)?.ended !== null) letGo(o);
}

/** A realm takes what befell it, or another, as evidence, keeps it for its page, and tells it where it moved it far. */
function learn(
  ctx: PopulationContext,
  p: Polity,
  o: RuleOutcome,
  other: Polity | null,
  near: number,
  e: HistoryEvent,
  year: number,
  usual: readonly number[],
): void {
  const { world } = ctx,
    order = orderOf(world)!.of(p.ref);
  if (!order) return;
  heldOf(ctx, p, order);
  const got = weigh(ctx, p, order, other ?? p, near, year, usual);
  // (Kept where it moved some belief of its far enough to tell.)
  if (!got || Math.max(...got.evidence.map(Math.abs)) < LEARNING.noted) return;
  // Told where it moved it far: its own fate, once in some years unless it was a great one; another's once in two generations,
  // and a realm's fall only where it was near (its seat within a few weeks' walk).
  const told =
    got.moved >= LEARNING.told &&
    (other
      ? (o.id !== "fell" || kmBetween(ctx, p.seat, other.seat) <= HOLDING.nearKm) &&
        (order.toldSeen === undefined || year - order.toldSeen >= 50)
      : got.moved >= LEARNING.great ||
        order.toldOwn === undefined ||
        year - order.toldOwn >= LEARNING.tellEvery);
  if (told && other) order.toldSeen = year;
  if (told && !other) order.toldOwn = year;
  const event = told
    ? world.events.emit({
        type: HOLD_EVENTS.lesson.type,
        subjects: other ? [p.ref, other.ref] : [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [{ ref: e.id, role: "trigger", weight: 1 }],
        data: {
          realm: realmName(p),
          outcome: o.id,
          blame: got.blame,
          ...(other ? { of: realmName(other) } : {}),
          // (As numbers, a few each, put into words where it is told: how it stood against the usual, how it fared, what it moved.)
          leaned: got.leaned,
          came: got.came,
          moved: got.evidence.map((x) => Math.round(x * 1000)),
        },
      })
    : null;
  order.taught = [
    {
      what: o.id,
      of: other ? realmName(other) : null,
      blame: got.blame,
      year,
      event: event ?? e.id,
      ...(other ? { whose: other.ref } : {}),
      stood: got.stood,
      leaned: got.leaned,
      came: got.came,
      moved: got.evidence.map((x) => Math.round(x * 1000)),
      weight: Math.round(got.weight * 100),
    },
    ...(order.taught ?? []),
  ].slice(0, LEARNING.taught);
}

/**
 * A piece of evidence in words, for a page or the annals, composed of what was kept of it: "Seeing the fall of the realm of X,
 * which stood with its choices in few hands and fared ill (lands lost), it took it as a warning to itself, and came to hold more
 * with its choices carried by many".
 */
export function taughtWords(x: Taught): string {
  const o = OUTCOME.get(x.what);
  if (!o) return "";
  const what = x.of ? (o.of ?? o.words).replace("{them}", x.of) : o.words,
    well = x.came ? x.came[0]! > 0 : undefined,
    how =
      x.leaned && x.came
        ? howWords(
            !!x.of,
            !!o.good,
            x.leaned.map((v) => v / 100),
            x.came,
          )
        : "",
    change = x.moved ? movedWords(x.moved.map((v) => v / 1000)) : "";
  // (A piece kept before evidence was measured says only whom it blamed.)
  const took =
    well === undefined ? blameWords(o, x.blame, !!x.of) : tookWords(x.blame, !!x.of, well);
  return `${x.of ? `Seeing ${what}` : `After ${what}`}${how}, it ${took}${change ? `, and ${change}` : ""}`;
}

/** What each number of a realm is now, in words, with the event that last moved it. Only reads. */
export function holdLines(
  ctx: PopulationContext,
  p: Polity,
  o: RealmOrder,
  arm: string | null,
): { hold: Hold; value: number; words: string; why: Ref | null }[] {
  const v = o.held ? o.held.map((x) => x / 100) : null;
  if (!v) return [];
  return HOLD_KINDS.map((h) => ({
    hold: h,
    value: v[HOLD[h]]!,
    words: holdNow(ctx, p, h, v[HOLD[h]]!, arm),
    why: o.heldEvents?.[HOLD[h]] ?? null,
  }));
}

export type { HoldChange };
