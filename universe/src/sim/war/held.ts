// People out of their place (2026-11-19; the rules are rules/held.ts): one store, three readings of one thing.
//   THE HELD. After a battle the victors take of the beaten host's living as many as its rout gives up (caughtOf), and they
//     are really moved: out of the lands that sent them, into the holder's seat, where they work and eat until the peace. Those
//     a host carries off from a land it took (sim/order takeCaptives) are held with them, not bound at once. One row a war's
//     side. At the peace (reckoned here, the year the war ends, with the peace as its cause): man for man first; the beaten
//     give up what they hold; a realm buys back as many of its own as its seat can spare bread for, and that grain moves; the
//     rest are bound to their holder's work where its people bind those they take, and remembered, or let go. Level: a number
//     a war's side (who they are by land is not kept: those sent home are drawn from the holder's seat as they were taken).
//   NO QUARTER. Whether the beaten are taken or put to death is the victors' choice, by who the beaten are to them, whether
//     their host can feed them, an old wrong unanswered, and who answers at home (rules quarterScore; no draw). It has a doer:
//     whoever commanded the host (a notable; else its ruler), on whose name it is a deed. A town stormed after a siege's dying
//     may be put to the sword the same way. At the peace the doer of the beaten side is handed over and dies for it; the
//     victors' goes unanswered, and that is remembered between the realms. Level: a record a wrong, with a named person.
//   THE FLED. Of those who leave a land in a year (sim/population migrateYear), the part that left for what struck it (a
//     battle, a strike from the air, a quake, a fire, a stone; or hunger in a famine's years) is kept by where they came to and
//     whence, with what drove them. A share settle each year; many among strangers weigh on the land that shelters them.
//     Level: a number a pair of lands, with its cause. They are not held back or sent home by this rule.
// The year (187.war.zheld) touches only the rows there are: nothing in a world at peace where no one has fled.
import {
  YEAR,
  defineEventType,
  defineStream,
  drawWithoutReplacement,
  yearOfMoment,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, tongueLikeness } from "../../gen/index.ts";
import {
  BANDS,
  DOMAIN,
  FLED,
  FLED_KINDS,
  G,
  HELD,
  HOLD,
  NOTE,
  apportionCapped,
  caughtOf,
  quarterParts,
  quarterScore,
  settleHeld,
  type FledKind,
} from "../../rules/index.ts";
import { COLS, ROWS } from "../population/model.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { diplomacyOf } from "../diplomacy/diplomacy.ts";
import { holdOf } from "../order/holds.ts";
import { LAW_OF } from "../order/laws.ts";
import { bindCarried, bindsTaken, orderOf } from "../order/order.ts";
import { grieve } from "../acts/disasters.ts";
import { handOf } from "../hand/hand.ts";
import { notablesOf } from "../notable/kept.ts";
import { notableDeed, strikeNotable, type Command } from "../notable/notables.ts";
import { landSpare } from "./bonds.ts";
import { poolOf, type Levy } from "./levy.ts";
import type { Take } from "./fell.ts";
import { warsOf, type War } from "./war.ts";

export const HELD_EVENTS = {
  /** What became of those a war's sides held, at its peace. */
  settled: defineEventType("held.settled", 4),
  /** The beaten put to death, or a stormed town put to the sword. */
  crime: defineEventType("held.crime", 5),
  /** Its doer answered for it at the peace, or did not. */
  reckoned: defineEventType("held.reckoned", 4),
  /** Many who fled what struck their land came over a border. */
  fled: defineEventType("held.fled", 3),
};

const STREAM = defineStream("war.held");

/** Those one side of a war holds of the other's people. */
export type Captives = {
  readonly war: Ref;
  /** Who holds them, whose they are, and the land they are kept in (the holder's seat when first taken). */
  readonly by: Ref;
  readonly of: Ref;
  readonly at: number;
  /** Taken in the field; carried off from lands taken. */
  men: number;
  folk: number;
  readonly since: number;
  /** The battle they were first taken at. */
  readonly cause: Ref;
};

/** Those who fled to a land from another, and have not yet settled into it. */
export type Camp = {
  readonly at: number;
  readonly from: number;
  /** What drove them (by FLED_KINDS), and the event of it. */
  kind: number;
  cause: Ref;
  count: number;
  readonly since: number;
  /** The year more last came. */
  last: number;
  /** The event they were told by, once many had come over a border. */
  told: Ref | null;
  /** How like their tongue is to that of the land they came to, when they came (0 … 1; thousandths kept). */
  readonly like: number;
};

/** A wrong done in a war, and who did it. */
export type Crime = {
  readonly war: Ref;
  readonly year: number;
  readonly land: number;
  /** Whose host did it, and to whose people. */
  readonly by: Ref;
  readonly on: Ref;
  /** "quarter": the beaten put to death; "sword": a stormed town's people. */
  readonly kind: "quarter" | "sword";
  readonly dead: number;
  /** Who ordered it: a notable's id (0: the realm's ruler, not kept apart), and their name. */
  readonly doer: number;
  readonly name: string;
  readonly event: Ref;
  /** What came of it at the peace: "tried" (handed over, and died for it), "dead" (already), "unanswered". */
  reckoned?: {
    readonly year: number;
    readonly how: "tried" | "dead" | "unanswered";
    readonly event: Ref;
  };
};

const campKey = (at: number, from: number) => at * 131072 + from;

export class DisplacedStore implements StateStore {
  readonly name = "war.held";
  /** By war, each side's (0: held by its attacker). */
  private readonly holds = new Map<Ref, [Captives | null, Captives | null]>();
  private readonly camps = new Map<number, Camp>();
  /** By the land sheltering them (a cache: made again as camps come and go). */
  private byLand: Map<number, Camp[]> | null = null;
  private crimes: Crime[] = [];
  /** What the year has seen in all (pages; hashed). */
  tally = { taken: 0, died: 0, exchanged: 0, given: 0, bought: 0, bound: 0, freed: 0, fled: 0 };

  dormant(): boolean {
    return !this.holds.size && !this.camps.size && !this.crimes.length;
  }
  heldIn(war: Ref): readonly [Captives | null, Captives | null] | undefined {
    return this.holds.get(war);
  }
  wars(): Ref[] {
    return [...this.holds.keys()];
  }
  /** Those a realm holds, and those of its people held. */
  heldBy(realm: Ref): Captives[] {
    const out: Captives[] = [];
    for (const pair of this.holds.values()) for (const h of pair) if (h?.by === realm) out.push(h);
    return out;
  }
  heldFrom(realm: Ref): Captives[] {
    const out: Captives[] = [];
    for (const pair of this.holds.values()) for (const h of pair) if (h?.of === realm) out.push(h);
    return out;
  }
  hold(w: War, side: 0 | 1, at: number, men: number, folk: number, year: number, cause: Ref): void {
    const pair = this.holds.get(w.ref) ?? [null, null],
      was = pair[side];
    if (was) {
      was.men += men;
      was.folk += folk;
    } else
      pair[side] = {
        war: w.ref,
        by: side === 0 ? w.attacker : w.defender,
        of: side === 0 ? w.defender : w.attacker,
        at,
        men,
        folk,
        since: year,
        cause,
      };
    this.holds.set(w.ref, pair);
    this.tally.taken += men + folk;
  }
  release(war: Ref): void {
    this.holds.delete(war);
  }

  campsAt(cell: number): readonly Camp[] {
    if (!this.byLand) {
      this.byLand = new Map();
      for (const c of this.camps.values()) {
        const l = this.byLand.get(c.at);
        if (l) l.push(c);
        else this.byLand.set(c.at, [c]);
      }
    }
    return this.byLand.get(cell) ?? NONE;
  }
  allCamps(): IterableIterator<Camp> {
    return this.camps.values();
  }
  campCount(): number {
    return this.camps.size;
  }
  flee(
    at: number,
    from: number,
    kind: number,
    count: number,
    year: number,
    cause: Ref,
    like: () => number,
  ): void {
    const key = campKey(at, from),
      was = this.camps.get(key);
    this.tally.fled += count;
    if (was) {
      // (What drove the most of them is what they are told by.)
      if (count > was.count) {
        was.kind = kind;
        was.cause = cause;
      }
      was.count += count;
      was.last = year;
      return;
    }
    this.camps.set(key, {
      at,
      from,
      kind,
      cause,
      count,
      since: year,
      last: year,
      told: null,
      like: Math.round(like() * 1000) / 1000,
    });
    this.byLand = null;
  }
  dropCamp(c: Camp): void {
    this.camps.delete(campKey(c.at, c.from));
    this.byLand = null;
  }

  allCrimes(): readonly Crime[] {
    return this.crimes;
  }
  crimesOf(war: Ref): Crime[] {
    return this.crimes.filter((c) => c.war === war);
  }
  addCrime(c: Crime): void {
    this.crimes.push(c);
  }
  forgetCrimes(before: number): void {
    if (this.crimes.length && this.crimes[0]!.year < before)
      this.crimes = this.crimes.filter((c) => c.year >= before);
  }

  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const pair of this.holds.values()) for (const h of pair) if (h) out.push(h.cause);
    for (const c of this.camps.values()) {
      out.push(c.cause);
      if (c.told) out.push(c.told);
    }
    for (const c of this.crimes) {
      out.push(c.event);
      if (c.reckoned) out.push(c.reckoned.event);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    if (this.dormant() && !this.tally.taken && !this.tally.fled) return;
    h.int(this.holds.size);
    for (const [war, pair] of this.holds) {
      h.string(war);
      for (const x of pair) h.int(x ? x.men : -1).int(x ? x.folk : -1);
    }
    h.int(this.camps.size);
    let sum = 0,
      mix = 0;
    // (Order does not matter to a sum and an xor: a land's camps come and go in any order.)
    for (const c of this.camps.values()) {
      sum += c.count;
      mix ^= Math.imul(campKey(c.at, c.from) | 0, 0x9e3779b1) ^ Math.imul(c.count, 0x85ebca6b);
    }
    h.int(sum).int(mix);
    h.int(this.crimes.length);
    for (const c of this.crimes) h.string(c.event).string(c.reckoned?.how ?? "");
    h.value(this.tally);
  }
  save(): unknown {
    return {
      holds: [...this.holds.values()],
      camps: [...this.camps.values()].map((c) => [
        c.at,
        c.from,
        c.kind,
        c.count,
        c.since,
        c.last,
        c.cause,
        c.told,
        c.like,
      ]),
      crimes: this.crimes,
      tally: this.tally,
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as {
      holds?: [Captives | null, Captives | null][];
      camps?: [number, number, number, number, number, number, Ref, Ref | null, number?][];
      crimes?: Crime[];
      tally?: DisplacedStore["tally"];
    };
    this.holds.clear();
    for (const pair of s.holds ?? []) {
      const any = pair[0] ?? pair[1];
      if (any)
        this.holds.set(any.war, [pair[0] ? { ...pair[0] } : null, pair[1] ? { ...pair[1] } : null]);
    }
    this.camps.clear();
    this.byLand = null;
    for (const [at, from, kind, count, since, last, cause, told, like] of s.camps ?? [])
      this.camps.set(campKey(at, from), {
        at,
        from,
        kind,
        count,
        since,
        last,
        cause,
        told,
        like: like ?? 1,
      });
    this.crimes = (s.crimes ?? []).map((c) => ({ ...c }));
    this.tally = { ...this.tally, ...(s.tally ?? {}) };
  }
}

const NONE: readonly Camp[] = [];

export function displacedOf(world: World): DisplacedStore | null {
  return world.peek<DisplacedStore>("war.held") ?? null;
}

// —— Moving and losing them ——————————————————————————————————————————————————————————————————————————

/** `n` of a land's people of the given rows (all, where null) drawn by this rule's stream, never the hand's own: how many of each. */
function drawFrom(
  ctx: PopulationContext,
  cell: number,
  rows: readonly number[] | null,
  n: number,
  t: SimTime,
  key: number,
  purpose: number,
): { at: number[]; drawn: number[] } | null {
  const prov = ctx.provinces.get(cell);
  if (!prov || !(n > 0)) return null;
  const windowed = handOf(ctx.world).composition(cell, yearOfMoment(t), ctx.life),
    at: number[] = [],
    counts: number[] = [];
  const each = (i: number) => {
    at.push(i);
    counts.push(
      Math.max(0, prov.counts.get(Math.floor(i / COLS), i % COLS) - (windowed ? windowed[i]! : 0)),
    );
  };
  if (rows) for (const i of rows) each(i);
  else for (let i = 0; i < ROWS * COLS; i++) each(i);
  const drawn = drawWithoutReplacement(Math.round(n), counts, (i) =>
    ctx.world.rng.real(STREAM, key, t, purpose, i),
  );
  return { at, drawn };
}

/** Move `n` of a land's people (of `rows`) to another land: how many went. */
function move(
  ctx: PopulationContext,
  from: number,
  to: number,
  rows: readonly number[] | null,
  n: number,
  t: SimTime,
  key: number,
  purpose: number,
): number {
  const src = ctx.provinces.get(from),
    dest = ctx.provinces.get(to),
    d = src && dest && from !== to ? drawFrom(ctx, from, rows, n, t, key, purpose) : null;
  if (!d) return 0;
  let went = 0;
  d.drawn.forEach((k, i) => {
    if (!k) return;
    const r = Math.floor(d.at[i]! / COLS),
      o = d.at[i]! % COLS;
    src!.counts.add(r, o, -k);
    dest!.counts.add(r, o, k);
    went += k;
  });
  return went;
}

/** `n` of a land's people (of `rows`) dead, written into its ledger: how many. */
export function killOf(
  ctx: PopulationContext,
  cell: number,
  rows: readonly number[] | null,
  n: number,
  t: SimTime,
  key: number,
  purpose: number,
): number {
  const prov = ctx.provinces.get(cell),
    d = drawFrom(ctx, cell, rows, n, t, key, purpose);
  if (!prov || !d) return 0;
  const year = yearOfMoment(t);
  let dead = 0;
  d.drawn.forEach((k, i) => {
    if (!k) return;
    const r = Math.floor(d.at[i]! / COLS),
      o = d.at[i]! % COLS;
    prov.counts.add(r, o, -k);
    ctx.history.addDeaths(cell, year, r % BANDS, k);
    dead += k;
  });
  return dead;
}

const serial = (r: Ref): number => Number(r.split(":").at(-1)) || 0;

// —— After a battle (sim/war/war.ts) ————————————————————————————————————————————————————————————————————

/** What a battle left, as the war's year hands it over. */
export type Fought = {
  readonly won: boolean;
  readonly land: number;
  readonly battle: Ref;
  readonly levies: readonly [Levy, Levy];
  readonly takes: readonly [readonly Take[], readonly Take[]];
  readonly fallen: readonly [number, number];
  readonly led: readonly [Command, Command];
  /** Whether the attacker's host went hungry; whether the land was stormed after a siege, and taken. */
  readonly hungry: boolean;
  readonly stormed: boolean;
};

/** How a host's people would deal with the beaten: the score, and its parts as factors. */
function quarter(
  ctx: PopulationContext,
  store: DisplacedStore,
  v: Polity,
  b: Polity,
  hungry: boolean,
  year: number,
): { score: number; factors: Factor[] } {
  const { world } = ctx,
    culture = cultureOf(world),
    mine = culture.get(v.seat),
    theirs = culture.get(b.seat),
    faiths = beliefOf(world),
    ours = faiths.of(v.seat).faith,
    other = faiths.of(b.seat).faith,
    // (A wrong of theirs against this people, not answered for: within a lifetime.)
    grudge = store
      .allCrimes()
      .some(
        (c) =>
          c.by === b.ref && c.on === v.ref && c.reckoned?.how !== "tried" && year - c.year <= 60,
      ),
    read = {
      strange: mine && theirs ? 1 - tongueLikeness(mine.tongue, theirs.tongue) : 0,
      unbelief: ours !== null && other !== null && ours !== other ? 1 : 0,
      closed: 1 - (mine?.traits[WAY.openness] ?? 0.5),
      valour: mine?.traits[WAY.valour] ?? 0.5,
      hungry: hungry ? 1 : 0,
      grudge: grudge ? 1 : 0,
      voice: holdOf(world, v.ref, HOLD.voice),
      citizens: orderOf(world)?.realms.get(v.ref)?.laws[LAW_OF.strangers] === 2 ? 1 : 0,
    };
  return {
    score: quarterScore(read),
    factors: quarterParts(read)
      .filter((p) => p.by !== 0)
      .map((p) => ({ name: p.name, value: p.value, contribution: p.by, source: null })),
  };
}

/** A wrong done: recorded with its why, told, laid on its doer's name, remembered between the realms. */
function wrong(
  ctx: PopulationContext,
  store: DisplacedStore,
  w: War,
  v: Polity,
  b: Polity,
  kind: Crime["kind"],
  land: number,
  dead: number,
  led: Command,
  q: { score: number; factors: Factor[] },
  cause: Ref,
  t: SimTime,
): void {
  const { world } = ctx,
    year = yearOfMoment(t),
    decision = world.decisions.record({
      rule: "held.quarter",
      subject: v.ref,
      outcome: { kind, land: cellRef(0, land), dead },
      score: q.score,
      threshold: HELD.line,
      factors: q.factors,
    }),
    name = led?.name ?? v.ruler.name,
    town = ctx.settlements.inProvince(land)[0]?.name ?? "",
    event = world.events.emit({
      type: HELD_EVENTS.crime.type,
      importance: dead >= 2000 ? 5 : 4,
      subjects: [w.ref, v.ref, b.ref],
      place: cellRef(0, land),
      causes: [
        { ref: decision, role: "trigger", weight: 1 },
        { ref: cause, role: "enabler", weight: 1 },
      ],
      data: { a: realmName(v), b: realmName(b), kind, dead, by: name, doer: led?.id ?? 0, town },
    });
  store.addCrime({
    war: w.ref,
    year,
    land,
    by: v.ref,
    on: b.ref,
    kind,
    dead,
    doer: led?.id ?? 0,
    name,
    event,
  });
  if (led)
    notableDeed(world, led.id, {
      y: year,
      d: DOMAIN.infamy,
      w: HELD_EVENTS.crime.type,
      e: event,
      g: Math.round(NOTE.line * Math.min(1.5, 0.3 + dead / 5000)),
      n: town || realmName(b),
    });
  diplomacyOf(world).remember(v.ref, b.ref, {
    name: "a massacre of the beaten",
    value: HELD.wrong,
    year,
    source: event,
  });
}

/**
 * A battle fought: the beaten host's living taken as its rout gives them up, and held at the victors' seat, or put to death
 * where the victors give no quarter; a town stormed put to the sword likewise. The dead are added to the war's fallen.
 */
export function heldAfter(
  ctx: PopulationContext,
  w: War,
  a: Polity,
  b: Polity,
  f: Fought,
  t: SimTime,
): void {
  const store = displacedOf(ctx.world);
  if (!store || w.civil) return;
  const year = yearOfMoment(t),
    s = f.won ? 1 : 0,
    victor = s === 1 ? a : b,
    beaten = s === 1 ? b : a,
    levy = f.levies[s]!,
    takes = f.takes[s]!,
    living = levy.sent.map((sent, k) => Math.max(0, sent - (takes[k]?.[2] ?? 0))),
    caught = caughtOf(
      living.reduce((n, x) => n + x, 0),
      f.fallen[s]!,
      f.fallen[1 - s]!,
    ),
    key = serial(w.ref) * 4 + s,
    led = f.led[1 - s]!;
  let q: ReturnType<typeof quarter> | null = null;
  if (caught > 0) {
    q = quarter(ctx, store, victor, beaten, f.hungry && victor === a, year);
    const each = apportionCapped(caught, living, living),
      none = q.score >= HELD.line;
    let n = 0;
    levy.pools.forEach((pool, k) => {
      if (!each[k]) return;
      n += none
        ? killOf(ctx, pool.cell, pool.rows, each[k]!, t, key, 40 + k)
        : move(ctx, pool.cell, victor.seat, pool.rows, each[k]!, t, key, 40 + k);
    });
    if (n > 0 && none) {
      w.fallen[s] = w.fallen[s]! + n;
      store.tally.died += n;
      wrong(ctx, store, w, victor, beaten, "quarter", f.land, n, led, q, f.battle, t);
    } else if (n > 0) store.hold(w, (1 - s) as 0 | 1, victor.seat, n, 0, year, f.battle);
  }
  // A town stormed: its people at the mercy of those who lost their own before its walls.
  if (f.stormed && f.won) {
    q ??= quarter(ctx, store, a, b, f.hungry, year);
    const score = q.score + HELD.storm;
    if (score >= HELD.line) {
      const people = ctx.provinces.get(f.land)?.total() ?? 0,
        dead = killOf(
          ctx,
          f.land,
          null,
          Math.floor(people * Math.min(HELD.swordMost, HELD.sword * (1 + 4 * (score - HELD.line)))),
          t,
          key,
          7,
        );
      if (dead > 0) {
        w.fallen[1] = w.fallen[1] + dead;
        store.tally.died += dead;
        grieve(ctx.world, f.land, 0.3, f.battle);
        wrong(
          ctx,
          store,
          w,
          a,
          b,
          "sword",
          f.land,
          dead,
          f.led[0],
          {
            score,
            factors: [
              ...q.factors,
              {
                name: "a town stormed after a long siege",
                value: 1,
                contribution: HELD.storm,
                source: null,
              },
            ],
          },
          f.battle,
          t,
        );
      }
    }
  }
}

/** Whether those a host carries off in a war are held until its peace: a war between two realms, the taker its attacker. */
export function holdsCarried(world: World, w: War | undefined, a: Polity): w is War {
  return (
    !!w && !w.civil && w.attacker === a.ref && w.attacker !== w.defender && !!displacedOf(world)
  );
}

/** Those a host carried off from a land it took (sim/order takeCaptives), already moved to its seat: held until the peace. */
export function holdCarried(
  world: World,
  w: War,
  a: Polity,
  n: number,
  year: number,
  cause: Ref,
): void {
  displacedOf(world)!.hold(w, 0, a.seat, 0, n, year, cause);
}

/** Those who left a land for another, the part that fled what struck it or its hunger (sim/population migrateYear). */
export function noteFled(
  world: World,
  from: number,
  to: number,
  count: number,
  kind: FledKind,
  cause: Ref,
  year: number,
): void {
  if (!(count >= 1)) return;
  displacedOf(world)?.flee(
    to,
    from,
    FLED_KINDS.indexOf(kind),
    Math.round(count),
    year,
    cause,
    () => {
      const culture = cultureOf(world),
        here = culture.get(to),
        there = culture.get(from);
      return here && there ? tongueLikeness(here.tongue, there.tongue) : 1;
    },
  );
}

/** What kind of flight an event set off: a battle or a strike from the air is war's; the rest, ruin. */
export function fledKind(world: World, cause: Ref): FledKind {
  return world.events.get(cause)?.type.startsWith("war.") ? "war" : "ruin";
}

// —— The year ——————————————————————————————————————————————————————————————————————————————————————

/** A war over: what becomes of those its sides hold, and of the wrongs done in it. */
function settle(ctx: PopulationContext, store: DisplacedStore, w: War, t: SimTime): void {
  const { world } = ctx,
    realms = politiesOf(world),
    year = yearOfMoment(t),
    sides = [realms.get(w.attacker), realms.get(w.defender)] as const,
    pair = store.heldIn(w.ref),
    peace = w.peace ? world.events.get(w.peace) : undefined,
    wins = w.battles.filter((x) => x.won).length,
    got = (peace?.data as { won?: boolean } | undefined)?.won === true,
    victor: 0 | 1 | null =
      got || 2 * wins > w.battles.length ? 0 : 2 * wins < w.battles.length ? 1 : null,
    alive = sides.map((p) => !!p && p.ended === null) as [boolean, boolean],
    cause = w.peace ?? w.event;
  if (pair) {
    const held: [number, number] = [0, 1].map((s) => {
        const h = pair[s];
        // (A holder that is no more holds no one: they are where they are, among its people.)
        return h && alive[s] ? h.men + h.folk : 0;
      }) as [number, number],
      // (What one of them costs to buy back, and how many their realm's seat can spare bread for.)
      price = HELD.price * 12 * ctx.life.appetite,
      afford = [0, 1].map((s) =>
        alive[s] ? (HELD.gives * landSpare(ctx, sides[s]!.seat)) / Math.max(1e-9, price) : 0,
      ) as [number, number],
      out = settleHeld({
        held,
        victor,
        binds: [
          alive[0] && bindsTaken(world, w.attacker),
          alive[1] && bindsTaken(world, w.defender),
        ],
        afford,
      }),
      markets = marketsOf(world);
    let grain = 0;
    for (const s of [0, 1] as const) {
      const h = pair[s];
      if (!h || !held[s]) continue;
      const by = sides[s]!,
        of = sides[1 - s],
        home = out.exchanged + out.given[s] + out.bought[s] + out.freed[s],
        key = serial(w.ref) * 4 + 2 + s;
      // (Whose realm is no more have no home to be sent to: they stay, bound or free, where they are.)
      if (of && alive[1 - s] && home > 0) {
        const men = Math.min(home, h.men);
        if (men > 0) move(ctx, h.at, of.seat, poolOf(ctx, h.at, year).rows, men, t, key, 1);
        if (home > men) move(ctx, h.at, of.seat, null, home - men, t, key, 2);
      }
      if (out.bought[s] > 0 && of) {
        const from = markets.get(of.seat),
          into = markets.get(by.seat),
          n = Math.min(Math.floor(out.bought[s] * price), Math.floor(from?.stock[G.grain] ?? 0));
        if (from && into && n > 0) grain += into.move("in", G.grain, from.move("out", G.grain, n));
      }
    }
    const a = sides[0],
      b = sides[1],
      event = world.events.emit({
        type: HELD_EVENTS.settled.type,
        importance: held[0] + held[1] >= 5000 ? 4 : 3,
        subjects: [w.ref, w.attacker, w.defender],
        place: a ? (ctx.provinces.get(a.seat)?.ref ?? null) : null,
        causes: [{ ref: cause, role: "trigger", weight: 1 }],
        data: {
          a: a ? realmName(a) : "a realm that is no more",
          b: b ? realmName(b) : "a realm that is no more",
          held,
          exchanged: out.exchanged,
          given: out.given,
          bought: out.bought,
          bound: out.bound,
          freed: out.freed,
          grain: Math.round(grain),
        },
      });
    for (const s of [0, 1] as const) {
      const by = sides[s],
        of = sides[1 - s];
      if (!by || !alive[s]) continue;
      if (out.bound[s] > 0) {
        bindCarried(ctx, by, pair[s]!.at, out.bound[s], event, of ?? null, year);
        if (of && alive[1 - s])
          diplomacyOf(world).remember(by.ref, of.ref, {
            name: "their people kept in bondage",
            value: HELD.kept,
            year,
            source: event,
          });
      } else if (
        of &&
        alive[1 - s] &&
        out.freed[s] + out.given[s] + out.bought[s] > 0 &&
        !out.bound[1 - s]
      )
        diplomacyOf(world).remember(by.ref, of.ref, {
          name: "their people sent home",
          value: HELD.home,
          year,
          source: event,
        });
    }
    const y = store.tally;
    y.exchanged += 2 * out.exchanged;
    y.given += out.given[0] + out.given[1];
    y.bought += out.bought[0] + out.bought[1];
    y.bound += out.bound[0] + out.bound[1];
    y.freed += out.freed[0] + out.freed[1];
    store.release(w.ref);
  }
  // The wrongs done in it: the beaten side's doer is handed over; the victors' goes unanswered.
  for (const c of store.crimesOf(w.ref)) {
    if (c.reckoned) continue;
    const side = c.by === w.attacker ? 0 : 1,
      by = sides[side],
      on = sides[1 - side],
      living = c.doer ? notablesOf(world)?.get(c.doer) : undefined,
      how: NonNullable<Crime["reckoned"]>["how"] =
        victor === 1 - side && alive[1 - side]
          ? living
            ? "tried"
            : c.doer
              ? "dead"
              : "unanswered"
          : "unanswered",
      event = world.events.emit({
        type: HELD_EVENTS.reckoned.type,
        importance: how === "tried" ? 4 : 3,
        subjects: [w.ref, c.by, c.on],
        place: cellRef(0, c.land),
        causes: [
          { ref: c.event, role: "trigger", weight: 1 },
          { ref: cause, role: "enabler", weight: 1 },
        ],
        data: {
          a: by ? realmName(by) : "a realm that is no more",
          b: on ? realmName(on) : "a realm that is no more",
          how,
          by: c.name,
          doer: c.doer,
          kind: c.kind,
          dead: c.dead,
          year: c.year,
        },
      });
    c.reckoned = { year, how, event };
    if (how === "tried") {
      strikeNotable(ctx, c.doer, "killed", event, t);
      if (by && on && alive[side])
        diplomacyOf(world).remember(by.ref, on.ref, {
          name: "a wrong answered for",
          value: HELD.answered,
          year,
          source: event,
        });
    }
  }
}

/** The year of the held and the fled: wars over are settled, the held waste, the fled settle in or weigh. */
export function displacedYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = displacedOf(world);
  if (!store || store.dormant()) return;
  const year = yearOfMoment(t),
    wars = warsOf(world),
    realms = politiesOf(world);
  // 1. The wars that are over (with those held in them, or a wrong not yet reckoned).
  const over = new Set<Ref>();
  for (const r of store.wars()) {
    const w = wars.get(r);
    if (!w) store.release(r);
    else if (w.ended !== null) over.add(r);
    else
      for (const h of store.heldIn(r)!) {
        if (!h) continue;
        // (Their keeping wastes them; the count follows, their deaths are their land's own.)
        h.men = Math.floor(h.men * (1 - HELD.wasted));
        h.folk = Math.floor(h.folk * (1 - HELD.wasted));
      }
  }
  for (const c of store.allCrimes()) {
    if (c.reckoned || over.has(c.war)) continue;
    const w = wars.get(c.war);
    if (w && w.ended !== null) over.add(c.war);
  }
  for (const r of [...over].sort((x, y) => serial(x) - serial(y)))
    settle(ctx, store, wars.get(r)!, t);
  store.forgetCrimes(year - HELD.years);
  // 2. The fled: a share settle; many among strangers weigh on the land that shelters them, and are told once.
  if (!store.campCount()) return;
  const gone: Camp[] = [];
  for (const c of store.allCamps()) {
    const like = c.like;
    if (c.last < year) c.count = Math.floor(c.count * (1 - FLED.settle * (1 + like)));
    if (c.count < FLED.least) {
      gone.push(c);
      continue;
    }
    // (Only many are weighed or told: a few hundred among a land's people are neither.)
    if (c.count < FLED.camp || (c.told && like >= 0.999)) continue;
    const host = realms.of(c.at),
      home = realms.of(c.from),
      people = ctx.provinces.get(c.at)?.total() ?? 0;
    if (!host || people <= 0) continue;
    if (like < 0.999 && c.count > 0.002 * people)
      grieve(
        world,
        c.at,
        Math.min(FLED.strainMost, FLED.strain * (1 - like) * (c.count / people)),
        c.cause,
      );
    if (!c.told && c.count >= FLED.told && home && home !== host)
      c.told = world.events.emit({
        type: HELD_EVENTS.fled.type,
        subjects: [host.ref, home.ref],
        place: cellRef(0, c.at),
        causes: [{ ref: c.cause, role: "trigger", weight: 1 }],
        data: {
          a: realmName(host),
          b: realmName(home),
          count: c.count,
          kind: FLED_KINDS[c.kind],
          from: c.from,
        },
      });
  }
  for (const c of gone) store.dropCamp(c);
}

/** Teach a peopled world its held and its fled. */
export function installDisplaced(world: World, ctx: () => PopulationContext): DisplacedStore {
  const store = world.register(new DisplacedStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "187.war.zheld", every: YEAR, run: (t) => displacedYear(ctx(), t) });
  return store;
}
