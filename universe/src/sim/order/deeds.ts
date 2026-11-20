// Deeds (the rules are rules/deeds.ts): an organised group or body acting on someone or something the world keeps by name, for
// its own aim, at a cost, with a consequence that goes by the target's own rule. Nothing is kept here and nothing has a year of
// its own: each who can act is asked in its own reckoning (a realm's groups in theirs, sim/order/groups.ts; its underworld in
// its, sim/order/underworld.ts), so a deed costs a draw where no one acts and a search of one realm's few records where one
// does. What a deed finds:
//   - a realm's ruler (sim/polity: their death passes the seat by the realm's rule, and may break it);
//   - the head of a body that does a thing (sim/order/institutions.ts: another follows, its work shaken), who may be one the
//     world keeps by name (sim/notable: ended as their people keep them);
//   - one of name in a domain, in the lands the doer holds;
//   - a crime group's boss (sim/order/underworld.ts: another takes his place, a fifth of his men scatter).
// The god's protection on a ruler, a boss or one of name spares them a blow that would have killed (sim/acts/person.ts).
// Told as one event whose causes are the doer's own rising and the reckoning that weighed it; the target's ending stands on it.
import {
  defineEventType,
  defineStream,
  parseRef,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
} from "../../kernel/index.ts";
import {
  DOES,
  DOES_ROWS,
  DOMAIN,
  DEED,
  HOLD,
  JUSTICE,
  harshOf,
  sentenceOf,
  type Sentence,
  NOTE,
  GROUP_KINDS,
  guardOf,
  blowChance,
  strikeCost,
  strikeOutcome,
  strikeReach,
  type DeedAt,
  type StrikeOutcome,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { realmName, rulerDies, type Polity } from "../polity/polity.ts";
import { notableRef, notablesOf } from "../notable/kept.ts";
import { strikeNotable } from "../notable/notables.ts";
import { actOn, bossRef, sparedBy } from "../acts/person.ts";
import { bodiesOf, watchIn, type Body, type RealmBodies } from "./institutions-kept.ts";
import { holdOf } from "./holds.ts";
import { bodyHeadFalls, bodyHouseStruck, bodyTitle } from "./institutions.ts";
import { razeTown, townsOf } from "../town/fabric.ts";
import { grieve } from "../acts/disasters.ts";
import { underworldOf } from "./underworld-kept.ts";
import { bossFalls } from "./underworld.ts";

export const DEED_EVENTS = {
  /** A group struck at a place: a body's house (a works, a hall, a print-house) or a quarter of a town. */
  razed: defineEventType("groups.razed", 3),
  /** A court sentenced one known by name: fined, held, put to labour, put to death. */
  sentenced: defineEventType("bodies.sentenced", 3),
  /** A group struck at someone by name: killed, missed, found out, or spared by the god. */
  struck: defineEventType("groups.struck", 3),
  /** A crime group struck at one who hunts or tells of it. */
  crimeStruck: defineEventType("underworld.struck", 3),
};

const DRAW = defineStream("order.deeds");
const keyOf = (r: Ref) => parseRef(r).b >>> 0;
const r2 = (x: number) => Math.round(x * 100) / 100;
const factor = (name: string, value: number, contribution: number): Factor => ({
  name,
  value: r2(value),
  contribution,
  source: null,
});

/** One who may strike, as its own system knows it. */
export type Striker = {
  /** A crime group of the underworld (else a group of sim/order/groups.ts). */
  readonly crime: boolean;
  readonly id: number;
  readonly name: string;
  readonly kind: string;
  readonly event: Ref;
  readonly lands: readonly number[];
  readonly members: number;
  readonly armed: boolean;
  readonly hidden: boolean;
  /** A faith's group: its faith's ref (those of its own faith are not whom it strikes at); "" otherwise. */
  readonly identity: string;
  /** How far what it does is against each kind of target (rules againstOf, CRIME_AGAINST). */
  readonly against: readonly { at: DeedAt; weight: number }[];
};

type Found = {
  readonly at: DeedAt;
  readonly cell: number;
  readonly name: string;
  /** What they are, for the telling: "ruler of Sestey", "head of the Vav watch", "boss of the Kesh family". */
  readonly what: string;
  /** Their page. */
  readonly ref: string;
  /** Their own guard beyond the watch (a boss's armed men). */
  readonly own: number;
  readonly subject?: Ref;
  /** Whether the god guards them from a death by violence (the act, to be spent). */
  readonly guarded: ReturnType<typeof actOn>;
  readonly kept: boolean;
  readonly fall: (by: Ref) => void;
  /** The body they head, where they head one: its house may be struck in their place. */
  readonly house?: {
    readonly event: Ref;
    readonly name: string;
    readonly title: string;
    readonly place: string;
  };
};

/** The kinds of building a body's house is, by what the rules call its place (rules DOES_ROWS.place), greatest first. */
const HOUSES: Readonly<Record<string, readonly string[]>> = {
  works: ["factory", "workshop", "smithy", "kiln", "mill"],
  hall: ["hall", "offices", "market"],
  watch: ["hall", "offices"],
  court: ["hall", "offices"],
  school: ["academy", "school"],
  hospital: ["hospital"],
  temple: ["temple", "shrine"],
  "print-house": ["offices", "workshop", "hall"],
};

/**
 * A place struck (rules DEED.atPlace): a body's house, or with none a quarter of the land's first town. Of the town's homes
 * a few in a hundred about it come down, by the fabric's own razing (sim/town/fabric.ts razeTown, nearest the building where
 * the town has raised one of its kind); a house struck loses of its hands and its purse; its land grieves. Told; gives back
 * its event and the homes that came down (null: no town stands there to strike in).
 */
function strikePlace(
  ctx: PopulationContext,
  p: Polity,
  g: Striker,
  cell: number,
  house: Found["house"] | null,
  lost: number,
  cause: Ref,
  t: SimTime,
): Ref | null {
  const { world } = ctx,
    town = ctx.settlements
      .inProvince(cell)
      .filter((x) => x.population > 0)
      .sort(
        (a, b) =>
          (b.market ? 1 : 0) - (a.market ? 1 : 0) ||
          b.population - a.population ||
          (a.ref < b.ref ? -1 : 1),
      )[0];
  if (!town) return null;
  const f = townsOf(world).get(town.ref),
    kinds = house ? (HOUSES[house.place] ?? []) : [],
    at =
      f && kinds.length
        ? f.civics.find((c) => c.fell === null && kinds.includes(c.kind))
        : undefined,
    homes = razeTown(ctx, town.ref, DEED.razes, t, at?.at);
  if (house) bodyHouseStruck(ctx, p, house.event, DEED.houseHands, DEED.housePurse);
  const event = world.events.emit({
    type: DEED_EVENTS.razed.type,
    importance: homes >= 200 ? 4 : 3,
    subjects: [p.ref, town.ref],
    place: ctx.provinces.get(cell)?.ref ?? null,
    causes: [
      { ref: cause, role: "trigger", weight: 1 },
      { ref: g.event, role: "enabler", weight: 1 },
      ...(house ? [{ ref: house.event, role: "pressure" as const, weight: 1 }] : []),
    ],
    data: {
      realm: realmName(p),
      group: g.name,
      kind: g.kind,
      gids: [g.id],
      town: town.name,
      ...(house ? { body: house.name, title: house.title } : {}),
      homes,
      lost,
    },
  });
  grieve(world, cell, DEED.placeGrief, event);
  return event;
}

/** Whoever of a kind stands within a striker's reach in its realm (null: no one). */
function find(ctx: PopulationContext, p: Polity, g: Striker, at: DeedAt, t: SimTime): Found | null {
  const { world } = ctx,
    year = yearOfMoment(t);
  if (at.who === "ruler") {
    const ref = `rule:${p.ref}`;
    return {
      at,
      cell: p.seat,
      name: p.ruler.name,
      what: `ruler of ${realmName(p)}`,
      ref,
      own: 0,
      guarded: actOn(world, ref, p.ruler.event, year, "protect"),
      kept: false,
      fall: (by) => rulerDies(ctx, p, t, by),
    };
  }
  if (at.who === "head") {
    const does = DOES[at.does];
    let best: { id: number; staff: number; home: number; event: Ref } | null = null,
      near = false;
    const bodies = bodiesOf(world)?.of(p.ref)?.bodies ?? [];
    for (const b of bodies) {
      if (b.does !== does || b.since >= year) continue;
      // (A faith's group does not strike at its own faith's clergy; those outside the law strike at voices that are free.)
      if (at.does === "worship" && g.identity !== "" && b.keeper === g.identity) continue;
      if (at.does === "word" && b.standing === 0) continue;
      const here = b.lands.some((c) => g.lands.includes(c));
      if (near && !here) continue;
      if (
        !best ||
        (here && !near) ||
        b.staff > best.staff ||
        (b.staff === best.staff && b.id < best.id)
      ) {
        best = b;
        near = here;
      }
    }
    if (!best) return null;
    const b = bodies.find((x) => x.id === best!.id)!,
      named = /^note:named:(\d+)$/.exec(b.headId ?? ""),
      n = named ? notablesOf(world)?.get(Number(named[1])) : undefined,
      title = bodyTitle(ctx, b);
    return {
      at,
      cell: b.home,
      name: b.leader.name,
      what: `head of the ${b.name} ${title}`,
      ref: n ? `note:named:${n.id}` : `inst:${b.event}`,
      own: 0,
      ...(n ? { subject: notableRef(n.id) } : {}),
      guarded: null,
      kept: !!n && n.favour?.kind === "protect",
      fall: (by) => {
        if (n) strikeNotable(ctx, n.id, "killed", by, t);
        bodyHeadFalls(ctx, p, b.event, by, t, "killed", DEED.shakes);
      },
      house: { event: b.event, name: b.name, title, place: DOES_ROWS[at.does].place },
    };
  }
  if (at.who === "notable") {
    const store = notablesOf(world),
      d = DOMAIN[at.domain];
    if (!store) return null;
    let best: ReturnType<typeof store.get>;
    for (const c of g.lands) {
      if (!store.at(c, d)) continue;
      for (const n of store.in(c)) {
        const by = n.by[d] ?? 0;
        if (n.many || by < NOTE.line / 2) continue;
        if (at.domain === "faith" && g.identity !== "" && n.faith === g.identity) continue;
        if (!best || by > (best.by[d] ?? 0) || (by === (best.by[d] ?? 0) && n.id < best.id))
          best = n;
      }
    }
    if (!best) return null;
    const n = best;
    return {
      at,
      cell: n.home,
      name: n.name,
      what: `known for ${at.domain}`,
      ref: `note:named:${n.id}`,
      own: 0,
      subject: notableRef(n.id),
      guarded: null,
      kept: n.favour?.kind === "protect",
      fall: (by) => void strikeNotable(ctx, n.id, "killed", by, t),
    };
  }
  // A boss: the greatest crime group that holds any of its lands (not the seat's own crew).
  let boss:
    | NonNullable<ReturnType<NonNullable<ReturnType<typeof underworldOf>>["of"]>>["groups"][number]
    | null = null;
  for (const c of underworldOf(world)?.of(p.ref)?.groups ?? []) {
    if (GROUP_KINDS[c.kind] === "badge" || c.since >= year) continue;
    if (!c.lands.some((x) => g.lands.includes(x))) continue;
    if (!boss || c.power > boss.power || (c.power === boss.power && c.id < boss.id)) boss = c;
  }
  if (!boss) return null;
  const c = boss,
    ref = bossRef(p.ref, c.event);
  return {
    at,
    cell: c.home,
    name: c.boss.name,
    what: `boss of the ${c.name} ${GROUP_KINDS[c.kind] === "cartel" ? "cartel" : "family"}`,
    ref,
    own: ((c.means?.arms ?? 0) + (c.means?.armour ?? 0)) / 4000,
    guarded: actOn(world, ref, c.boss.name, year, "protect"),
    kept: false,
    fall: (by) => void bossFalls(ctx, p, c.event, by, t),
  };
}

/**
 * One who may strike, asked in its own reckoning: whether it strikes at someone within `span` years, at whom, and how it goes.
 * Told, and the target's ending done by their own rule. Gives back the men it lost in the answer (null: it did not strike).
 */
export function strikes(
  ctx: PopulationContext,
  p: Polity,
  /** Who would strike: its number among its realm's, whether of the underworld, how far what it does is against anyone,
   * its men; and itself, asked for only once the draw has fallen (nearly always it has not). */
  who: {
    readonly crime: boolean;
    readonly id: number;
    readonly will: number;
    readonly members: number;
    readonly striker: () => Striker;
  },
  facts: {
    /** How hard it is pressed (0 … 1), its realm's reach (0 … 1), a full crew, the years reckoned. */
    readonly pressed: number;
    readonly capacity: number;
    readonly crew: number;
    readonly span: number;
  },
  t: SimTime,
): { lost: number; outcome: StrikeOutcome; event: Ref } | null {
  const will = who.will,
    chance = blowChance(will, facts.pressed, who.members, facts.crew, facts.span);
  if (chance <= 0) return null;
  const { world } = ctx,
    key = keyOf(p.ref),
    salt = (who.crime ? 40_000 : 0) + who.id * 8,
    u = (k: number) => world.rng.real(DRAW, key, t, salt + k);
  if (u(0) >= chance) return null;
  const g = who.striker();
  // (At whom: among those of the kinds it is against who stand within its reach, by how far it is against each.)
  const found: [Found, number][] = [];
  let all = 0;
  for (const a of g.against) {
    const x = find(ctx, p, g, a.at, t);
    if (!x) continue;
    found.push([x, a.weight]);
    all += a.weight;
  }
  if (!found.length) {
    // (No one of name within its reach: an armed group's blow falls, some of the time, on a quarter of its land's town.)
    if (g.crime || !g.armed || u(3) >= DEED.atPlace || !g.lands.length) return null;
    const lost = Math.min(
        g.members,
        Math.round(g.members * strikeCost("survived", facts.capacity)),
      ),
      decision = world.decisions.record({
        rule: DEED_EVENTS.razed.type,
        subject: p.ref,
        outcome: { group: g.name },
        score: will,
        threshold: 0,
        factors: [
          factor("how far what it does is against them", will, will),
          factor("how hard it is pressed", facts.pressed, 0.6 * facts.pressed),
          factor("no one of name within its reach", 1, 0.2),
        ],
      }),
      event = strikePlace(ctx, p, g, g.lands[0]!, null, lost, decision, t);
    return event ? { lost, outcome: "survived", event } : null;
  }
  let pick = u(1) * all,
    target = found[0]![0];
  for (const [x, w] of found) {
    target = x;
    if ((pick -= w) < 0) break;
  }
  const near = g.lands.includes(target.cell),
    w = watchIn(world, target.cell),
    guard = guardOf(target.at.who, w.watch > 0 ? w : null, facts.capacity, target.own),
    reach = strikeReach(g.hidden, g.armed, near),
    drawn = strikeOutcome(reach, guard, u(2)),
    outcome: StrikeOutcome =
      drawn === "killed" && (target.guarded || target.kept) ? "spared" : drawn,
    lost = Math.min(g.members, Math.round(g.members * strikeCost(outcome, facts.capacity))),
    // (At the house, not the head: an armed group's blow at one who heads a body, some of the time.)
    atHouse = !!target.house && g.armed && drawn !== "foiled" && u(3) < DEED.atPlace,
    place = ctx.provinces.get(target.cell)?.ref ?? null,
    type = g.crime ? DEED_EVENTS.crimeStruck.type : DEED_EVENTS.struck.type,
    data = {
      realm: realmName(p),
      group: g.name,
      kind: g.kind,
      gids: [g.id],
      target: target.at.who,
      who: target.name,
      what: target.what,
      ref: target.ref,
      outcome,
      lost,
    },
    decision = world.decisions.record({
      rule: type,
      subject: p.ref,
      outcome: { group: g.name, who: target.name, outcome },
      score: reach * (1 - guard),
      threshold: 0,
      factors: [
        factor("how far what it does is against them", will, will),
        factor("how hard it is pressed", facts.pressed, 0.6 * facts.pressed),
        factor(g.hidden ? "its reach, hidden" : "its reach, in the open", reach, reach),
        factor(
          w.watch > 0 ? "an honest watch where they are" : "the seat's hand where they are",
          guard,
          -guard,
        ),
      ],
    }),
    razed = atHouse ? strikePlace(ctx, p, g, target.cell, target.house!, lost, decision, t) : null;
  if (razed) return { lost, outcome: "survived", event: razed };
  const event = world.events.emit({
    type,
    // (A ruler killed is the chronicle's; another killed is told above the ordinary years.)
    importance: outcome === "killed" ? (target.at.who === "ruler" ? 5 : 4) : 3,
    subjects: target.subject ? [p.ref, target.subject] : [p.ref],
    place,
    causes: [
      { ref: decision, role: "trigger", weight: 1 },
      { ref: g.event, role: "enabler", weight: 1 },
    ],
    data,
  });
  if (outcome === "spared" && target.guarded)
    sparedBy(world, target.guarded, p.ref, place, { group: g.name });
  if (outcome === "killed") target.fall(event);
  return { lost, outcome, event };
}

/**
 * Whom one who may strike stands against now, within its reach (for its page: a reading, no draw): each kind of target it is
 * against that someone holds, who they are, and how far what it does is against them.
 */
export function standsAgainst(
  ctx: PopulationContext,
  p: Polity,
  g: Striker,
): { name: string; what: string; ref: string; weight: number; near: boolean }[] {
  const out: { name: string; what: string; ref: string; weight: number; near: boolean }[] = [];
  for (const a of g.against) {
    const x = find(ctx, p, g, a.at, ctx.world.now),
      same = x ? out.find((o) => o.ref === x.ref) : undefined;
    // (One it is against on two counts is one person.)
    if (same) same.weight += a.weight;
    else if (x)
      out.push({
        name: x.name,
        what: x.what,
        ref: x.ref,
        weight: a.weight,
        near: g.lands.includes(x.cell),
      });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

// —— A court's sentence on one by name ————————————————————————————————————————————————————————————————————

/** One brought before a court. */
export type Accused = {
  readonly name: string;
  /** What they are: "head of the Asha insurgents", "boss of the Kesh family", "known for infamy". */
  readonly what: string;
  /** Their page; and their own ref where the world keeps them as a subject. */
  readonly ref: string;
  readonly subject?: Ref;
  /** What they are charged with, in a few words; how grave it is (0 … 1); whether they have a purse to buy judges with. */
  readonly charge: string;
  readonly grave: number;
  readonly purse: boolean;
};

/**
 * A court's sentence on one before it (the court's record is the caller's to keep: `sentence` below finds and keeps it).
 * Told; one held is kept by name on the court. `after` is given the sentence's event once told.
 */
export function sentenceBy(
  ctx: PopulationContext,
  p: Polity,
  court: Body,
  who: Accused,
  cause: Ref | null,
  t: SimTime,
  salt: number,
): { sentence: Sentence; event: Ref } {
  const { world } = ctx,
    year = yearOfMoment(t),
    key = keyOf(p.ref),
    u = (k: number) => world.rng.real(DRAW, key, t, 80_000 + salt * 4 + k),
    force = holdOf(world, p.ref, HOLD.force),
    harsh = harshOf(force, holdOf(world, p.ref, HOLD.voice)),
    bought = 1 - court.quality / 1000,
    // (A seat that rules alone puts those it holds to work: sim/order/order.ts reads the same of its law.)
    decree = p.law === 1,
    sentence = sentenceOf(u(0), { grave: who.grave, harsh, bought, purse: who.purse, decree }),
    years =
      sentence === "held" || sentence === "labour"
        ? Math.round(
            JUSTICE.termLeast +
              (JUSTICE.termMost - JUSTICE.termLeast) * who.grave * (0.4 + 0.6 * u(1)),
          )
        : 0,
    title = bodyTitle(ctx, court),
    event = world.events.emit({
      type: DEED_EVENTS.sentenced.type,
      // (One the world keeps by name put to death is told above the ordinary years; a group's head or a boss with them.)
      importance: sentence === "death" && who.subject ? 4 : 3,
      subjects: who.subject ? [p.ref, who.subject] : [p.ref],
      place: ctx.provinces.get(court.home)?.ref ?? null,
      causes: [
        ...(cause ? [{ ref: cause, role: "trigger" as const, weight: 1 }] : []),
        { ref: court.event, role: "enabler" as const, weight: 1 },
      ],
      data: {
        realm: realmName(p),
        body: court.name,
        title,
        who: who.name,
        what: who.what,
        ref: who.ref,
        charge: who.charge,
        sentence,
        ...(years ? { years } : {}),
        // (Told where it weighed: judges bought, a seat's harsh justice.)
        ...(sentence === "fined" && who.purse && bought >= 0.3 ? { bought: 1 } : {}),
        ...(harsh >= 0.6 ? { harsh: 1 } : {}),
      },
    });
  if (years)
    court.inmates = [
      ...(court.inmates ?? []).filter((x) => x.u > year),
      {
        n: who.name,
        r: who.ref,
        y: year,
        u: year + years,
        w: who.what,
        ...(sentence === "labour" ? { l: 1 } : {}),
      },
    ].slice(-JUSTICE.inmates);
  return { sentence, event };
}

/** The court a land's accused come before: the one that holds the land, else its realm's greatest (null: it keeps none). */
function courtFor(v: RealmBodies | undefined, cell: number, year: number): Body | null {
  let best: Body | null = null,
    here = false;
  for (const b of v?.bodies ?? []) {
    if (b.does !== DOES.judge || b.since >= year) continue;
    const holds = b.lands.includes(cell);
    if (here && !holds) continue;
    if (!best || (holds && !here) || b.staff > best.staff) {
      best = b;
      here = holds;
    }
  }
  return best;
}

/**
 * One taken by a realm's hand (a group's head, a boss) brought before the court of their land: sentenced, told, kept by name
 * where held. Null where the realm keeps no court (they are taken as before, and no more is told).
 */
export function sentence(
  ctx: PopulationContext,
  p: Polity,
  cell: number,
  who: Accused,
  cause: Ref | null,
  t: SimTime,
  salt: number,
): { sentence: Sentence; event: Ref } | null {
  const store = bodiesOf(ctx.world),
    v = store?.of(p.ref) as RealmBodies | undefined,
    court = courtFor(v, cell, yearOfMoment(t));
  if (!store || !v || !court) return null;
  const out = sentenceBy(ctx, p, court, who, cause, t, salt);
  store.put(p.ref, v);
  return out;
}

/**
 * A court's own reckoning (sim/order/institutions.ts, each of a realm's courts in its turn): one notorious in its lands is
 * tried, the likelier the better it is manned and the less it is bought; and under a harsh seat where word is not free, one
 * who speaks or inquires freely. One put to death is ended as their people keep them; one held for their word is known the
 * more for it. The court's record is the caller's to keep.
 */
export function trials(
  ctx: PopulationContext,
  p: Polity,
  court: Body,
  facts: {
    readonly manned: number;
    readonly word: number;
    readonly force: number;
    readonly seatFaith: Ref | null;
  },
  t: SimTime,
): void {
  const { world } = ctx,
    store = notablesOf(world);
  if (!store) return;
  const key = keyOf(p.ref),
    u = (k: number) => world.rng.real(DRAW, key, t, 120_000 + court.id * 8 + k),
    honest = court.quality / 1000,
    silences = facts.word < 0.25 && facts.force >= 0.6;
  let notorious: ReturnType<typeof store.get>, speaker: ReturnType<typeof store.get>;
  for (const c of court.lands)
    for (const n of store.in(c)) {
      if (n.many || n.favour?.kind === "protect" || n.post) continue;
      const bad = n.by[DOMAIN.infamy] ?? 0;
      if (bad >= NOTE.line / 2 && (!notorious || bad > (notorious.by[DOMAIN.infamy] ?? 0)))
        notorious = n;
      if (!silences) continue;
      const free = Math.max(
        n.by[DOMAIN.knowledge] ?? 0,
        n.faith !== facts.seatFaith ? (n.by[DOMAIN.faith] ?? 0) : 0,
      );
      if (free >= NOTE.line && (!speaker || n.standing > speaker.standing)) speaker = n;
    }
  if (notorious && u(0) < JUSTICE.tries * facts.manned * honest) {
    const n = notorious,
      out = sentenceBy(
        ctx,
        p,
        court,
        {
          name: n.name,
          what: "known for infamy",
          ref: `note:named:${n.id}`,
          subject: notableRef(n.id),
          charge: "the harm done in its lands",
          grave: 0.7,
          purse: (n.by[DOMAIN.wealth] ?? 0) > 0,
        },
        n.event ?? null,
        t,
        court.id * 2,
      );
    if (out.sentence === "death") strikeNotable(ctx, n.id, "executed", out.event, t);
  } else if (speaker && u(1) < JUSTICE.silences * facts.manned) {
    const n = speaker,
      out = sentenceBy(
        ctx,
        p,
        court,
        {
          name: n.name,
          what: `known for ${(n.by[DOMAIN.knowledge] ?? 0) >= (n.by[DOMAIN.faith] ?? 0) ? "knowledge" : "faith"}`,
          ref: `note:named:${n.id}`,
          subject: notableRef(n.id),
          charge: "what they said against the seat",
          grave: 0.4,
          purse: false,
        },
        n.event ?? null,
        t,
        court.id * 2 + 1,
      );
    if (out.sentence === "death") strikeNotable(ctx, n.id, "executed", out.event, t);
    else {
      // (Tried for their word, and known the more for it.)
      n.standing += JUSTICE.martyr;
      n.best = Math.max(n.best, n.standing);
    }
  }
}
