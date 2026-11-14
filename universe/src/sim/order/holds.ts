// How a realm is held (rules/holds.ts): its four numbers, force, voice, word and trust, kept as whole hundredths on its order. Each
// realm's are first read off the rule it was founded under, its people's ways and their body; every ten years (in the year it weighs
// its laws) each moves partway toward what is wanted of it: half what that rule, those ways and that body ask of it now, half what its
// interest groups want, by their sway; a movement for a voice, a massacre remembered, a rising crushed, a war waged, a host kept
// standing; how widely its choices are carried (word and arms follow it); and what it has learned. A number told in other words than
// it was (a band crossed: an arms ban, a vote given) is an event, with a decision whose factors name what moved it. And what it learns is one rule, read off events history already writes: an outcome that befell it or another it
// could know of (its fastest word reaching that far within a season: rules/signals.ts), the blame its ways put on it, and a pull on
// its numbers that follows. Nothing a tick, nothing a person: a reading of the year's few great events, and a weighing every ten years.
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
  HOLD,
  HOLDING,
  HOLD_KINDS,
  HOLD_WANTS,
  OUTCOME,
  OUTCOMES_OF,
  blameOf,
  blameWords,
  changeOf,
  weighsFor,
  changeWords,
  firstHolds,
  holdWords,
  wayName,
  wordPace,
  type Blame,
  type Hold,
  type HoldChange,
  type RuleOutcome,
  type WaysRead,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf, type Ways } from "../culture/culture.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { RIVALRY, diplomacyOf } from "../diplomacy/diplomacy.ts";
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

/** One lesson of rule a realm keeps, for its page: what befell whom, who it blamed, when, and the event that tells it. */
export type Taught = {
  readonly what: string;
  /** Whose fate it was, where another's: the realm's name then. */
  readonly of: string | null;
  readonly blame: Blame;
  readonly year: number;
  readonly event: Ref | null;
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
    pulls = (o.pulls ?? [0, 0, 0, 0]).map((x) => x / 100),
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
        ...(pulls[k]
          ? [
              {
                name: "what it has learned",
                value: pulls[k]!,
                contribution: pulls[k]!,
                source: o.taught?.[0]?.event
                  ? { ref: o.taught[0].event, role: "pressure" as const, weight: 1 }
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
          ...(o.taught?.[0]?.event && pulls[k]
            ? [{ ref: o.taught[0].event, role: "pressure" as const, weight: 0.6 }]
            : []),
        ],
        data: { realm: realmName(p), hold: h, from: Math.round(from * 100), to },
      });
    (o.heldEvents ??= [null, null, null, null])[k] = event;
  }
  // What it learned weighs the less each ten years.
  if (o.pulls) {
    o.pulls = o.pulls.map((x) => Math.trunc(x * HOLDING.pullKept));
    if (o.pulls.every((x) => x === 0)) delete o.pulls;
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

// —— What a realm learns of rule ——————————————————————————————————————————————————————————————————————

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

/**
 * The year's outcomes, read off the events history wrote (sim/lore/lessons.ts reads them once): each realm it befell weighs it,
 * and, where it is one others take note of, each realm whose fastest word reaches that far within a season.
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
    year = yearOfMoment(t);
  let living: Polity[] | null = null,
    reach: Map<Ref, number> | null = null;
  for (const e of events) {
    const d = (e.data ?? {}) as Record<string, unknown>;
    for (const o of OUTCOMES_OF.get(e.type) ?? []) {
      if (o.when && !o.when(d)) continue;
      const at = typeof o.at === "number" ? o.at : o.at(d),
        who = e.subjects[at] as Ref | undefined,
        p = who ? realms.get(who) : undefined;
      if (!p) continue;
      if (p.ended === null) learn(ctx, p, o, null, e, year);
      if (!o.seen) continue;
      // Those who could know of it: their word reaching its seat within a season, the farther the more freely word moves among them.
      living ??= realms.living();
      reach ??= new Map(
        living.map((q) => [
          q.ref,
          wordPace((id) => knows(ctx, q.seat, id), ctx.medium).kmADay *
            HOLDING.newsDays *
            (0.5 + holdOf(world, q.ref, HOLD.word)),
        ]),
      );
      for (const q of living)
        if (q !== p && kmBetween(ctx, q.seat, p.seat) <= reach.get(q.ref)!)
          learn(ctx, q, o, p, e, year);
    }
  }
}

/** A realm weighs an outcome: whom it blames, by its ways, and what follows for its numbers. */
function learn(
  ctx: PopulationContext,
  p: Polity,
  o: RuleOutcome,
  other: Polity | null,
  e: HistoryEvent,
  year: number,
): void {
  const { world } = ctx,
    order = orderOf(world)!.of(p.ref);
  if (!order) return;
  const rel = other ? diplomacyOf(world).get(p.ref, other.ref) : undefined,
    rival = !!rel && rel.opinion < RIVALRY,
    blame = blameOf(waysRead(cultureOf(world).get(p.seat)), !other, rival),
    change = changeOf(o, blame, other ? HOLDING.seen : 1);
  heldOf(ctx, p, order);
  const pulls = (order.pulls ??= [0, 0, 0, 0]);
  // Lessons the same way do not heap up: the strongest stands; a lesson the other way weighs against it.
  for (const h of HOLD_KINDS) {
    const c = change[h];
    if (!c) continue;
    const was = pulls[HOLD[h]]!,
      add = c * 100;
    pulls[HOLD[h]] = Math.round(
      dmath.clamp(
        was * add > 0 ? Math.sign(add) * Math.max(Math.abs(was), Math.abs(add)) : was + add,
        -60,
        60,
      ),
    );
  }
  if (pulls.every((x) => x === 0)) delete order.pulls;
  // Told where it is one of the great ones: what befell it at home; another's fate where it took it as a warning or scorned it, once
  // in two generations, and a realm's fall only where it was near (its seat within a few weeks' walk).
  const told = !other
    ? o.event.startsWith("strife.") || o.id === "defaulted"
    : (blame === "ours" || blame === "weakness") &&
      (o.id !== "fell" || kmBetween(ctx, p.seat, other.seat) <= HOLDING.nearKm) &&
      (order.toldSeen === undefined || year - order.toldSeen >= 50);
  if (told && other) order.toldSeen = year;
  const event = told
    ? world.events.emit({
        type: HOLD_EVENTS.lesson.type,
        subjects: other ? [p.ref, other.ref] : [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [{ ref: e.id, role: "trigger", weight: 1 }],
        data: {
          realm: realmName(p),
          outcome: o.id,
          blame,
          ...(other ? { of: realmName(other) } : {}),
          change: changeWords(change),
        },
      })
    : null;
  order.taught = [
    { what: o.id, of: other ? realmName(other) : null, blame, year, event: event ?? e.id },
    ...(order.taught ?? []),
  ].slice(0, HOLDING.kept);
}

/** A lesson of rule in words, for a page or the annals: "Seeing the fall of the realm of X, it held them weak: it would not happen to it". */
export function taughtWords(x: Taught): string {
  const o = OUTCOME.get(x.what);
  if (!o) return "";
  const what = x.of ? (o.of ?? o.words).replace("{them}", x.of) : o.words,
    change = changeWords(changeOf(o, x.blame, x.of ? HOLDING.seen : 1));
  return `${x.of ? `Seeing ${what}` : `After ${what}`}, it ${blameWords(o, x.blame, !!x.of)}${change ? `, and ${change}` : ""}`;
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
