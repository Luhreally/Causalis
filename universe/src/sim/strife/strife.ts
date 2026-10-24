// Strife (Phase 22, asked for 2026-10-23: "political violence — repression, coups, civil war",
// "legitimacy … interest groups … collapse"). M145, the army and its coups: a realm's army is one
// of its interest groups — its guard in peace, its levy in war, every man it fields where it keeps
// a standing army — heard the more under a chief, the least in an assembly, above all under a
// general; it wants its pay, and war on those its realm resents. Where a realm's rule is doubted,
// its battles lost, its army unpaid and much skimmed, a general may reach for the seat: seizing it
// (the realm becomes a protectorate, ruled by its army) or foiled (the plotters purged, the army
// cowed for a generation). A rule seized by the sword is held the less rightful for a generation;
// it ends when its standing returns, its people press for a voice, or a general dies and none is
// chosen to follow — and the realm's own rule, of its people's ways as they are now, is restored.
// M146, civil war and revolution: a realm split at a ruler's death fights for the throne, the more
// often where rule passes by birth; a foiled general may flee to the far lands and raise them; the
// god may raise a pretender; a realm whose bound rose free may be marched on by its old masters to
// take them back. A civil war won takes the throne; a rising beaten is put down and its lands
// returned; else the realm stays parted. Where a realm's rule is in crisis and its people press for
// a voice or the land, they may rise at its seat: a revolution won makes it a commonwealth, its
// court purged, one law for all (and the land to those who till it, if that was what they rose
// for) — and its old court may flee to the far lands and fight to return; a revolution lost is
// drowned in blood and remembered.
// Every step is a decision whose factors cite what drove it.
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
import { cellRef } from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf, pushWays, type Ways } from "../culture/culture.ts";
import { loreOf } from "../lore/lore.ts";
import {
  GENERAL,
  LEADERSHIP,
  POLITY_EVENTS,
  crown,
  cutOff,
  endRealm,
  institutionsOf,
  politiesOf,
  raiseRealm,
  reach,
  realmName,
  type Polity,
} from "../polity/polity.ts";
import { interestsOf, type Interest } from "../polity/interests.ts";
import {
  WAR,
  WAR_EVENTS,
  fieldedOf,
  strengthOf,
  warsOf,
  type CivilKind,
  type War,
} from "../war/war.ts";
import {
  BOND,
  capacityOf,
  landOf,
  orderOf,
  remember,
  type Movement,
  type RealmOrder,
} from "../order/order.ts";
import { LAW_OF } from "../order/laws.ts";
import { grieve, strike } from "../acts/disasters.ts";

export const STRIFE_EVENTS = {
  /** A general seizes the seat. */
  coup: defineEventType("strife.coup", 6),
  /** A coup foiled, its plotters purged. */
  foiled: defineEventType("strife.foiled", 5),
  /** The army's rule ends, and the realm's own is restored. */
  restored: defineEventType("strife.restored", 5),
  /** A civil war won: the claimant's host takes the realm's seat, and the throne (M146). */
  throne: defineEventType("strife.throne", 6),
  /** A rising beaten: its realm put down, its lands returned. */
  subdued: defineEventType("strife.subdued", 5),
  /** A civil war ended with neither the throne taken nor the rising put down: the realm parted. */
  parted: defineEventType("strife.parted", 4),
  /** The many overthrow the court. */
  revolution: defineEventType("strife.revolution", 7),
  /** A revolution drowned in blood. */
  repressed: defineEventType("strife.repressed", 5),
};

/** The god's hand on a realm's army: stirred against its seat; its rule given back (M145). */
export const STRIFE_ACTS = {
  incite: defineEventType("act.incite", 5),
  restore: defineEventType("act.restore", 5),
  /** A claimant raised in a land, with the lands about it, against its realm (M146). */
  pretender: defineEventType("act.pretender", 5),
};

export const STRIFE = {
  /** The share of the men it could field a realm keeps under arms in peace (a chief's band, a seat's guard), and in war without a standing army. */
  guard: 0.3,
  levy: 0.8,
  /** A coup is weighed above this; its yearly chance for each point above. */
  line: 0.38,
  chance: 0.07,
  /** An army must hold this share of its realm's sway to reach for the seat. */
  least: 0.03,
  /** Years after a coup foiled before its army dares again; after one won, while its general's own men hold every post. */
  purged: 20,
  grip: 8,
  /** How much less rightful a rule seized by the sword is held, at first; the years that fades over. */
  seized: 0.15,
  remembered: 30,
  /** The yearly chance of rule restored, at the least; at a general's death. */
  restore: 0.015,
  heirless: 0.35,
  /** How much more of its men a protectorate fields. */
  fields: 0.04,
  /** A split at a ruler's death is fought for, by how rule passes: by birth, by choice, by acclaim (M146). */
  contested: [0.7, 0.45, 0.3],
  /** A foiled general flees to the far lands and raises them, at least this often, more with the army's weight. */
  flees: 0.25,
  /** A rising is put down, at a civil war's end, this often at the least; the more if it was beaten back, the more
   * the realm's host outweighs its own, the less the less its seat reaches its lands. */
  putDown: 0.1,
  beaten: 0.3,
  might: 0.4,
  unreached: 0.3,
  /** A revolution is weighed above this line, its yearly chance for each point above; a movement this strong to begin. */
  rising: 0.3,
  revolts: 0.08,
  movement: 0.25,
  /** What ideas of a voice and of rights, and the many massed in workshops, add to a revolution's weight. */
  ideas: 0.12,
  workshops: 0.1,
  /** A revolution's rule holds this many years before its people's ways may reform it. */
  holds: 30,
} as const;

/** A coup: won (the realm a protectorate) or foiled. */
export type Coup = {
  readonly realm: Ref;
  readonly year: number;
  readonly event: Ref;
  readonly won: boolean;
  /** The realm's name before: a coup won renames it. */
  readonly was: string;
  /** Who reached for the seat. */
  readonly general: string;
};

/** A realm's rule by its army: since when, the coup, and its rule before (who led, how rule passed, what law held). */
export type Junta = {
  readonly since: number;
  readonly event: Ref;
  readonly was: readonly [number, number, number];
};

export type RealmStrife = {
  readonly realm: Ref;
  junta: Junta | null;
  /** After a coup foiled, its army is cowed until this year. */
  purged: number;
};

export type Restoration = {
  readonly realm: Ref;
  readonly year: number;
  readonly event: Ref;
  /** The years its army ruled. */
  readonly years: number;
};

/** A civil war (M146): who rose against whom, over what, and how it came out. */
export type CivilWar = {
  readonly war: Ref;
  readonly kind: CivilKind;
  readonly year: number;
  /** The realm that rose (for the freed: the freed), and the realm it rose from. */
  readonly rebel: Ref;
  readonly loyal: Ref;
  /** The throne taken; the rising put down; the realm left parted; overtaken by another's war; the freed kept free. */
  outcome: "throne" | "subdued" | "parted" | "overtaken" | "kept" | null;
  ended: number | null;
  /** The event that settled it, where one did. */
  settled: Ref | null;
};

/** A revolution: the many risen at a realm's seat, won or drowned in blood. */
export type Revolution = {
  readonly realm: Ref;
  readonly year: number;
  readonly event: Ref;
  readonly won: boolean;
  /** What they rose for. */
  readonly cause: Movement["cause"];
};

const COUP = defineStream("strife.coup");

export class StrifeStore implements StateStore {
  readonly name = "strife.realms";
  realms = new Map<string, RealmStrife>();
  coups: Coup[] = [];
  restorations: Restoration[] = [];
  civil: CivilWar[] = [];
  revolutions: Revolution[] = [];

  of(realm: Ref): RealmStrife | undefined {
    return this.realms.get(realm);
  }
  ensure(realm: Ref): RealmStrife {
    let s = this.realms.get(realm);
    if (!s) this.realms.set(realm, (s = { realm, junta: null, purged: 0 }));
    return s;
  }
  /** A realm's rule by its army, if it is so ruled. */
  junta(realm: Ref): Junta | null {
    return this.realms.get(realm)?.junta ?? null;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const s of this.realms.values()) if (s.junta) out.push(s.junta.event);
    for (const c of this.coups) out.push(c.event);
    for (const r of this.restorations) out.push(r.event);
    for (const c of this.civil) if (c.settled) out.push(c.settled);
    for (const r of this.revolutions) out.push(r.event);
    return out;
  }
  save(): unknown {
    return {
      realms: [...this.realms.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1)),
      coups: this.coups,
      restorations: this.restorations,
      civil: this.civil,
      revolutions: this.revolutions,
    };
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  load(state: unknown): void {
    const s = state as {
      realms: RealmStrife[];
      coups: Coup[];
      restorations: Restoration[];
      civil?: CivilWar[];
      revolutions?: Revolution[];
    };
    this.realms = new Map(
      s.realms.map((r) => [r.realm, { ...r, junta: r.junta ? { ...r.junta } : null }]),
    );
    this.coups = [...s.coups];
    this.restorations = [...(s.restorations ?? [])];
    this.civil = (s.civil ?? []).map((c) => ({ ...c }));
    this.revolutions = [...(s.revolutions ?? [])];
  }
  /** A realm's civil wars, as either side. */
  civilOf(realm: Ref): CivilWar[] {
    return this.civil.filter((c) => c.rebel === realm || c.loyal === realm);
  }
}

export function strifeOf(world: World): StrifeStore | null {
  return world.hasStore("strife.realms") ? world.store<StrifeStore>("strife.realms") : null;
}

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));
const trait = (w: Ways | undefined, k: number) => w?.traits[k] ?? 0.5;
/** The strongest push behind a people's way, as a factor's source. */
const nudged = (w: Ways | undefined, k: number): CauseRef | null => {
  const n = w?.nudges.find((x) => x.trait === k);
  return n ? { ref: n.event, role: "pressure", weight: 1 } : null;
};

/**
 * A realm's army: how many it keeps under arms — its guard in peace, its levy in war, all it
 * fields where it keeps a standing army — whether it keeps one, whether it is at war.
 */
export function armyOf(
  ctx: PopulationContext,
  p: Polity,
): { people: number; standing: boolean; atWar: boolean } {
  const standing = !!loreOf(ctx.world).get(p.seat, "standing-army"),
    atWar = ctx.world.hasStore("war.wars") && warsOf(ctx.world).fighting(p.ref).length > 0;
  return {
    people: Math.round(fieldedOf(ctx, p) * (standing ? 1 : atWar ? STRIFE.levy : STRIFE.guard)),
    standing,
    atWar,
  };
}

/** A realm's battles won and lost these five years, its last defeat and its last victory. */
function battlesOf(
  world: World,
  p: Polity,
  year: number,
): { won: number; lost: number; last: Ref | null; lastWon: Ref | null } {
  let won = 0,
    lost = 0,
    last: Ref | null = null,
    lastWon: Ref | null = null,
    lastYear = -Infinity,
    wonYear = -Infinity;
  for (const w of warsOf(world).all()) {
    const side = w.attacker === p.ref ? 0 : w.defender === p.ref ? 1 : -1;
    if (side < 0) continue;
    for (const b of w.battles) {
      if (b.year < year - 5) continue;
      if (b.won === (side === 0)) {
        won++;
        if (b.year >= wonYear) [lastWon, wonYear] = [b.event, b.year];
      } else {
        lost++;
        if (b.year >= lastYear) [last, lastYear] = [b.event, b.year];
      }
    }
  }
  return { won, lost, last, lastWon };
}

/**
 * How near a realm's army is to reaching for its seat (its score, against STRIFE.line), and
 * why: a rule doubted, the army's sway, battles lost, an army unpaid, what is skimmed, a daring
 * people, generals who rule already — against a seat that reaches its lands, an army of
 * citizens, a sacred throne, an old rule.
 */
export function coupDanger(
  ctx: PopulationContext,
  p: Polity,
  o: RealmOrder,
  interests: readonly Interest[] = interestsOf(ctx, p, ctx.world.now),
): { score: number; weight: number; doubt: number; cap: number; factors: Factor[] } {
  const { world } = ctx,
    year = yearOfMoment(world.now),
    seat = cultureOf(world).get(p.seat),
    army = interests.find((i) => i.group === "the army"),
    weight = Math.min(1, 3 * (army?.sway ?? 0)),
    doubt = clamp(0, 1, (0.62 - o.legitimacy) * 2),
    ruler = world.events.get(p.ruler.event),
    untried = year - p.ruler.since <= 2 && ruler?.type === POLITY_EVENTS.succession.type,
    fought = battlesOf(world, p, year),
    defeats = fought.lost ? fought.lost / (fought.won + fought.lost) : 0,
    famine = ctx.provinces.get(p.seat)?.lastFamine ?? null,
    hungry = famine ? world.events.get(famine) : undefined,
    unpaid = !!hungry && world.now - hungry.t <= 2 * YEAR,
    valour = trait(seat, WAY.valour),
    cap = capacityOf(ctx, p).value,
    junta = strifeOf(world)?.junta(p.ref) ?? null,
    old = Math.min(1, Math.max(0, year - p.founded) / 200),
    standing = loreOf(world).get(p.seat, "standing-army");
  const factors: Factor[] = [
    {
      name: "a rule doubted",
      value: o.legitimacy,
      contribution: 0.8 * doubt,
      source: o.crisis ? { ref: o.crisis, role: "pressure", weight: 1 } : null,
    },
    {
      name: "the army's sway",
      value: army?.sway ?? 0,
      contribution: 0.5 * weight,
      source: standing ? { ref: standing.event, role: "enabler", weight: 1 } : null,
    },
    {
      name: "battles lost",
      value: fought.lost,
      contribution: 0.35 * defeats,
      source: fought.last ? { ref: fought.last, role: "pressure", weight: 1 } : null,
    },
    {
      name: "a victorious general",
      value: fought.won,
      contribution: fought.won >= 2 && !junta ? 0.12 * Math.min(1, fought.won / 4) : 0,
      source: fought.lastWon ? { ref: fought.lastWon, role: "pressure", weight: 1 } : null,
    },
    {
      name: "an army unpaid",
      value: unpaid ? 1 : 0,
      contribution: unpaid ? 0.25 : 0,
      source: unpaid ? { ref: famine!, role: "pressure", weight: 1 } : null,
    },
    {
      name: "what is skimmed",
      value: o.corruption,
      contribution: 0.3 * o.corruption,
      source: null,
    },
    {
      name: "a people who prize valour",
      value: valour,
      contribution: 0.3 * (valour - 0.5),
      source: nudged(seat, WAY.valour),
    },
    {
      name: "a new ruler, untried",
      value: untried ? 1 : 0,
      contribution: untried ? 0.08 : 0,
      source: untried ? { ref: p.ruler.event, role: "pressure", weight: 1 } : null,
    },
    {
      name: "generals who rule already",
      value: junta ? 1 : 0,
      contribution: junta ? 0.1 : 0,
      source: junta ? { ref: junta.event, role: "enabler", weight: 1 } : null,
    },
    {
      name: "a seat that reaches its lands",
      value: cap,
      contribution: -0.25 * cap,
      source: null,
    },
    {
      name: "an army of citizens, a sacred throne",
      value: p.leadership,
      contribution: p.leadership === 2 ? -0.2 : p.leadership === 3 ? -0.15 : 0,
      source: null,
    },
    {
      name: "an old rule",
      value: old,
      contribution: -0.1 * old,
      source: { ref: p.event, role: "constraint", weight: 1 },
    },
  ];
  return {
    score: factors.reduce((s, f) => s + f.contribution, 0),
    weight,
    doubt,
    cap,
    factors,
  };
}

/** A ruler for a realm at a moment, drawn apart from its successions (a coup, a restoration). */
function newRuler(world: World, p: Polity, t: SimTime, event: Ref, salt: number) {
  const ways = cultureOf(world).get(p.seat)!;
  return crown(world, ways, p.seat + salt * 1_000_003, t, event, null);
}

/**
 * A general seizes a realm's seat: it becomes a protectorate, ruled by its army (rule chosen by
 * the army, its law as it was); the old court's skimmers are purged. Returns the coup.
 */
export function seize(ctx: PopulationContext, p: Polity, causes: CauseRef[], t: SimTime): Ref {
  const { world } = ctx,
    store = strifeOf(world)!,
    s = store.ensure(p.ref),
    o = orderOf(world)?.of(p.ref),
    year = yearOfMoment(t),
    was = realmName(p),
    // (Named before the event that crowns them, so the event can say who.)
    general = newRuler(world, p, t, p.event, 1).name,
    event = world.events.emit({
      type: STRIFE_EVENTS.coup.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes,
      data: { realm: was, general, from: LEADERSHIP[p.leadership] },
    });
  // (A coup among generals keeps the rule the first of them overthrew; the new general's own men
  // hold every post for a while.)
  s.junta ??= { since: year, event, was: [p.leadership, p.succession, p.law] };
  s.purged = year + STRIFE.grip;
  p.leadership = GENERAL;
  p.succession = 1;
  p.ruler = { ...newRuler(world, p, t, event, 1), event };
  if (o) {
    o.corruption *= 0.6;
    o.crisis = null;
  }
  store.coups.push({ realm: p.ref, year, event, won: true, was, general });
  return event;
}

/** A coup foiled: the plotters purged, the army cowed; the court stands the firmer for a while. */
export function foil(
  ctx: PopulationContext,
  p: Polity,
  causes: CauseRef[],
  t: SimTime,
  weight = 0,
): Ref {
  const { world } = ctx,
    store = strifeOf(world)!,
    o = orderOf(world)?.of(p.ref),
    year = yearOfMoment(t),
    general = newRuler(world, p, t, p.event, 3).name,
    event = world.events.emit({
      type: STRIFE_EVENTS.foiled.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes,
      data: { realm: realmName(p), general },
    });
  store.ensure(p.ref).purged = year + STRIFE.purged;
  if (o) o.legitimacy = clamp(0.02, 0.98, o.legitimacy + 0.03);
  store.coups.push({ realm: p.ref, year, event, won: false, was: realmName(p), general });
  // (The foiled general may flee to the far lands, raise them and march on the seat: M146.)
  if (world.rng.real(COUP, parseRef(p.ref).b >>> 0, t, 5) < STRIFE.flees + 0.5 * weight)
    breakAway(ctx, p, farLands(ctx, p), event, "general", t, general);
  return event;
}

/**
 * Where a revolt is raised: a realm's farthest land and the lands about it, two steps or more from
 * its seat (or cut off from it), out to a third of the realm — never its seat.
 */
export function farLands(ctx: PopulationContext, p: Polity): number[] {
  if (p.members.length < 3) return [];
  const steps = reach(ctx, p),
    far = Math.max(0, ...p.members.map((c) => steps.get(c) ?? 99));
  if (far < 2) return [];
  const g = ctx.generated,
    mine = new Set(p.members),
    away = (c: number) => c !== p.seat && (steps.get(c) ?? 99) >= 2,
    start = p.members.find((c) => (steps.get(c) ?? 99) === far)!,
    most = Math.max(1, Math.floor(p.members.length / 3)),
    out = [start],
    seen = new Set(out);
  for (let i = 0; i < out.length && out.length < most; i++)
    for (
      let k = g.grid.offsets[out[i]!]!;
      k < g.grid.offsets[out[i]! + 1]! && out.length < most;
      k++
    ) {
      const n = g.grid.neighbours[k]!;
      if (mine.has(n) && !seen.has(n) && away(n)) {
        seen.add(n);
        out.push(n);
      }
    }
  return out.sort((a, b) => a - b);
}

/** The town to raise a realm at among lands: a market town first, then the most peopled. */
function townAmong(ctx: PopulationContext, lands: readonly number[]) {
  return lands
    .flatMap((c) => ctx.settlements.inProvince(c))
    .sort(
      (x, y) =>
        (y.market ? 1 : 0) - (x.market ? 1 : 0) ||
        y.population - x.population ||
        (x.ref < y.ref ? -1 : 1),
    )[0];
}

/**
 * Lands break from a realm under a rival — a general, a pretender, an old court — raising their
 * own realm at their best town, which marches on the realm's seat: a civil war of `kind`. The
 * general's (and an old court's of a general) is ruled by its army. Null where none can be raised.
 */
export function breakAway(
  ctx: PopulationContext,
  p: Polity,
  lands: readonly number[],
  cause: Ref,
  kind: CivilKind,
  t: SimTime,
  leader: string | null = null,
): Polity | null {
  const { world } = ctx,
    realms = politiesOf(world),
    mine = lands.filter((c) => c !== p.seat && realms.of(c)?.ref === p.ref),
    town = townAmong(ctx, mine);
  if (!mine.length || !town) return null;
  for (const c of mine) realms.leave(p, c);
  const raised = raiseRealm(ctx, town, mine, cause, t, p.ref);
  cutOff(ctx, p, cause);
  if (!raised) return null;
  if (kind === "general") {
    strifeOf(world)!.ensure(raised.ref).junta = {
      since: yearOfMoment(t),
      event: cause,
      was: [raised.leadership, raised.succession, raised.law],
    };
    raised.leadership = GENERAL;
    raised.succession = 1;
  }
  if (leader) raised.ruler = { ...raised.ruler, name: leader };
  civilWar(ctx, raised, p, kind, [{ ref: cause, role: "trigger", weight: 1 }], t);
  return raised;
}

/**
 * A civil war declared: the realm that rose marches on the seat of the realm it rose from (for the
 * freed, their old masters march on theirs). Its prize is that seat; its why, `causes`.
 */
export function civilWar(
  ctx: PopulationContext,
  rebel: Polity,
  loyal: Polity,
  kind: CivilKind,
  causes: CauseRef[],
  t: SimTime,
): Ref {
  const { world } = ctx,
    year = yearOfMoment(t),
    ref = world.minter.mint(WAR),
    [a, b] = kind === "freed" ? [loyal, rebel] : [rebel, loyal],
    event = world.events.emit({
      type: WAR_EVENTS.declared.type,
      subjects: [ref, a.ref, b.ref],
      place: cellRef(0, b.seat),
      causes,
      data: { a: realmName(a), b: realmName(b), civil: kind },
    });
  warsOf(world).add({
    ref,
    attacker: a.ref,
    defender: b.ref,
    declared: year,
    event,
    prize: b.seat,
    battles: [],
    fallen: [0, 0],
    ended: null,
    peace: null,
    civil: kind,
  });
  strifeOf(world)!.civil.push({
    war: ref,
    kind,
    year,
    rebel: rebel.ref,
    loyal: loyal.ref,
    outcome: null,
    ended: null,
    settled: null,
  });
  return event;
}

/**
 * A civil war's end (called as its peace is made): the throne taken where the claimant's host took
 * the seat; a rising put down where it was beaten, or its host is far the weaker — its lands
 * returned, aggrieved; else the realm stays parted. The freed, marched on by their old masters:
 * taken back and bound again, or kept free.
 */
export function settleCivil(
  ctx: PopulationContext,
  w: War,
  won: boolean,
  repulsed: boolean,
  t: SimTime,
): void {
  const { world } = ctx,
    store = strifeOf(world),
    c = store?.civil.find((x) => x.war === w.ref);
  if (!store || !c || c.ended !== null) return;
  const realms = politiesOf(world),
    rebel = realms.get(c.rebel)!,
    loyal = realms.get(c.loyal)!,
    attacker = realms.get(w.attacker)!,
    defender = realms.get(w.defender)!,
    year = yearOfMoment(t),
    why: CauseRef[] = [{ ref: w.peace ?? w.event, role: "trigger", weight: 1 }];
  c.ended = year;
  if (won && defender.ended !== null) {
    c.outcome = "throne";
    c.settled = world.events.emit({
      type: STRIFE_EVENTS.throne.type,
      subjects: [attacker.ref, defender.ref],
      place: ctx.provinces.get(w.prize)?.ref ?? null,
      causes: why,
      data: {
        a: realmName(attacker),
        b: realmName(defender),
        ruler: attacker.ruler.name,
        kind: c.kind,
      },
    });
    // The freed taken back are bound again, where their old masters' law still binds.
    const order = orderOf(world);
    if (c.kind === "freed" && order && order.of(attacker.ref)?.abolished === null)
      for (const cell of attacker.members)
        if (realms.formerly(cell) === defender.ref) {
          const l = landOf(order, cell);
          l.shares[BOND.chattel] = Math.max(l.shares[BOND.chattel]!, 0.15);
          l.cause = c.settled;
        }
    return;
  }
  if (c.kind === "freed") {
    c.outcome = rebel.ended === null ? "kept" : "overtaken";
    return;
  }
  if (rebel.ended !== null || loyal.ended !== null) {
    c.outcome = "overtaken";
    return;
  }
  // Put down, or parted: a rising beaten back, the realm's host against the rising's, and how far
  // its seat reaches — a realm that could not hold its far lands seldom wins them back.
  const mine = strengthOf(ctx, loyal),
    theirs = strengthOf(ctx, rebel),
    might = 2 * Math.max(0, mine / Math.max(1, mine + theirs) - 0.5),
    cap = capacityOf(ctx, loyal).value,
    factors: Factor[] = [
      {
        name: "a rising beaten back",
        value: repulsed ? 1 : 0,
        contribution: repulsed ? STRIFE.beaten : 0,
        source: repulsed ? { ref: w.peace ?? w.event, role: "trigger", weight: 1 } : null,
      },
      {
        name: "the realm's host against the rising's",
        value: mine / Math.max(1, theirs),
        contribution: STRIFE.might * might,
        source: null,
      },
      {
        name: "a seat that cannot reach its far lands",
        value: cap,
        contribution: -STRIFE.unreached * (1 - cap),
        source: null,
      },
    ],
    chance = clamp(0.05, 0.9, STRIFE.putDown + factors.reduce((sum, f) => sum + f.contribution, 0)),
    down = world.rng.real(COUP, parseRef(rebel.ref).b >>> 0, t, 14) < chance,
    decision = world.decisions.record({
      rule: "strife.subdue",
      subject: loyal.ref,
      outcome: { subdued: down, rebel: rebel.ref },
      score: chance,
      threshold: 0,
      factors,
    }),
    causes: CauseRef[] = [...why, { ref: decision, role: "trigger", weight: 1 }];
  if (!down) {
    c.outcome = "parted";
    c.settled = world.events.emit({
      type: STRIFE_EVENTS.parted.type,
      subjects: [rebel.ref, loyal.ref],
      place: ctx.provinces.get(rebel.seat)?.ref ?? null,
      causes,
      data: { a: realmName(rebel), b: realmName(loyal), lands: rebel.members.length, kind: c.kind },
    });
    return;
  }
  const subdued = world.events.emit({
    type: STRIFE_EVENTS.subdued.type,
    subjects: [loyal.ref, rebel.ref],
    place: ctx.provinces.get(rebel.seat)?.ref ?? null,
    causes,
    data: { a: realmName(rebel), b: realmName(loyal), lands: rebel.members.length, kind: c.kind },
  });
  for (const cell of [...rebel.members]) {
    realms.leave(rebel, cell);
    realms.join(loyal, cell);
    realms.setDiscontent(cell, { level: 0.5, cause: subdued });
  }
  endRealm(ctx, rebel, t, { ref: subdued, role: "trigger", weight: 1 });
  cutOff(ctx, loyal, subdued);
  c.outcome = "subdued";
  c.settled = subdued;
}

/** Whether a realm's revolution is young enough that its rule holds against its people's ways. */
export function revolutionHolds(world: World, realm: Ref, year: number): boolean {
  return !!strifeOf(world)?.revolutions.some(
    (r) => r.realm === realm && r.won && year - r.year < STRIFE.holds,
  );
}

/**
 * How near a realm's people are to rising at its seat (its score, against STRIFE.rising), and
 * why: a rule doubted, a movement for a voice or the land, hunger at the seat, a seat that cannot
 * reach its lands — against an army loyal to the court, and rank set hard.
 */
export function revolutionDanger(
  ctx: PopulationContext,
  p: Polity,
  o: RealmOrder,
  interests: readonly Interest[] = interestsOf(ctx, p, ctx.world.now),
): { score: number; movement: Movement | null; weight: number; doubt: number; factors: Factor[] } {
  const { world } = ctx,
    movement =
      [...o.movements]
        .filter((m) => m.cause === "voice" || m.cause === "land")
        .sort((a, b) => b.strength - a.strength || (a.cause < b.cause ? -1 : 1))[0] ?? null,
    army = interests.find((i) => i.group === "the army"),
    weight = Math.min(1, 3 * (army?.sway ?? 0)),
    doubt = clamp(0, 1, (0.62 - o.legitimacy) * 2),
    famine = ctx.provinces.get(p.seat)?.lastFamine ?? null,
    hungry = famine ? world.events.get(famine) : undefined,
    starving = !!hungry && world.now - hungry.t <= 2 * YEAR,
    cap = capacityOf(ctx, p).value,
    lore = loreOf(world),
    thought = lore.get(p.seat, "philosophy"),
    works = lore.get(p.seat, "factories");
  const factors: Factor[] = [
    {
      name: "a rule doubted",
      value: o.legitimacy,
      contribution: 0.9 * doubt,
      source: o.crisis ? { ref: o.crisis, role: "pressure", weight: 1 } : null,
    },
    {
      name: movement?.cause === "land" ? "a people who want the land" : "a people who want a voice",
      value: movement?.strength ?? 0,
      contribution: 0.8 * (movement?.strength ?? 0),
      source: movement ? { ref: movement.event, role: "pressure", weight: 1 } : null,
    },
    {
      name: "hunger at the seat",
      value: starving ? 1 : 0,
      contribution: starving ? 0.25 : 0,
      source: starving ? { ref: famine!, role: "pressure", weight: 1 } : null,
    },
    {
      name: "a seat that cannot reach its lands",
      value: cap,
      contribution: 0.2 * (1 - cap),
      source: null,
    },
    {
      name: "an army loyal to the seat",
      value: army?.sway ?? 0,
      contribution: -(p.leadership === GENERAL ? 0.6 : 0.5) * weight,
      source: null,
    },
    { name: "rank set hard", value: o.caste, contribution: -0.15 * o.caste, source: null },
    {
      name: "ideas of a voice and of rights",
      value: thought ? 1 : 0,
      contribution: thought ? STRIFE.ideas : 0,
      source: thought ? { ref: thought.event, role: "enabler", weight: 1 } : null,
    },
    {
      name: "the many massed in workshops",
      value: works ? 1 : 0,
      contribution: works ? STRIFE.workshops : 0,
      source: works ? { ref: works.event, role: "enabler", weight: 1 } : null,
    },
  ];
  return {
    score: factors.reduce((s, f) => s + f.contribution, 0),
    movement,
    weight,
    doubt,
    factors,
  };
}

/**
 * The many overthrow the court: the realm a commonwealth, its rule by acclaim, one law for all (and
 * the land to those who till it, where that is what they rose for); its rank broken, its skimmers
 * gone, its standing renewed. Its old court may flee to the far lands and fight to return.
 */
export function revolt(
  ctx: PopulationContext,
  p: Polity,
  movement: Movement["cause"],
  causes: CauseRef[],
  t: SimTime,
  court = 0,
): Ref {
  const { world } = ctx,
    store = strifeOf(world)!,
    o = orderOf(world)?.of(p.ref),
    year = yearOfMoment(t),
    was = realmName(p),
    before = p.leadership,
    event = world.events.emit({
      type: STRIFE_EVENTS.revolution.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes,
      data: { realm: was, cause: movement, to: realmName({ leadership: 2, town: p.town }) },
    });
  p.leadership = 2;
  p.succession = 2;
  p.ruler = { ...newRuler(world, p, t, event, 4), event };
  const s = store.ensure(p.ref);
  s.junta = null;
  if (o) {
    o.caste = clamp(0, 1, o.caste - 0.3);
    o.corruption *= 0.3;
    o.legitimacy = Math.max(o.legitimacy, 0.55);
    o.crisis = null;
    o.laws[LAW_OF.justice] = 2;
    o.lawEvents[LAW_OF.justice] = event;
    if (movement === "land") {
      o.laws[LAW_OF.land] = 2;
      o.lawEvents[LAW_OF.land] = event;
    }
    for (const m of o.movements) if (m.cause === movement) m.strength *= 0.4;
  }
  const ways = cultureOf(world).get(p.seat);
  if (ways) {
    pushWays(ways, { event, year, trait: WAY.hierarchy, amount: -0.1 });
    pushWays(ways, { event, year, trait: WAY.openness, amount: 0.04 });
  }
  store.revolutions.push({ realm: p.ref, year, event, won: true, cause: movement });
  // (Its old court flees to the far lands, under the rule it had, and fights to return.)
  if (world.rng.real(COUP, parseRef(p.ref).b >>> 0, t, 7) < clamp(0, 0.6, 2 * court)) {
    const rump = breakAway(ctx, p, farLands(ctx, p), event, "revolution", t);
    if (rump && before !== 2) rump.leadership = before;
  }
  return event;
}

/** A revolution drowned in blood: its people struck down at the seat, its movement broken, its rank the harder, remembered. */
export function repress(
  ctx: PopulationContext,
  p: Polity,
  movement: Movement["cause"],
  causes: CauseRef[],
  t: SimTime,
): Ref {
  const { world } = ctx,
    o = orderOf(world)?.of(p.ref),
    year = yearOfMoment(t),
    dead = strike(ctx, p.seat, 0.02, t),
    event = world.events.emit({
      type: STRIFE_EVENTS.repressed.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes,
      data: { realm: realmName(p), cause: movement, dead },
    });
  if (o) {
    remember(o, { what: "massacre", year, cell: p.seat, event });
    o.caste = clamp(0, 1, o.caste + 0.05);
    for (const m of o.movements) if (m.cause === movement) m.strength *= 0.4;
  }
  grieve(world, p.seat, 0.3, event);
  strifeOf(world)!.revolutions.push({ realm: p.ref, year, event, won: false, cause: movement });
  return event;
}

/** The odds a coup tried is won: the army's weight and a rule doubted, against a seat that reaches its lands. */
function coupOdds(danger: { weight: number; doubt: number; cap: number }): number {
  return clamp(0.2, 0.85, 0.3 + 0.5 * danger.weight + 0.3 * danger.doubt - 0.2 * danger.cap);
}

/** The army's rule ends: the realm's own rule, of its people's ways as they are now, restored. */
export function restore(
  ctx: PopulationContext,
  p: Polity,
  causes: CauseRef[],
  t: SimTime,
): Ref | null {
  const { world } = ctx,
    store = strifeOf(world),
    s = store?.of(p.ref),
    ways = cultureOf(world).get(p.seat);
  if (!store || !s?.junta || !ways) return null;
  const year = yearOfMoment(t),
    inst = institutionsOf(ways, undefined, loreOf(world).effect(p.seat, "writing") > 0),
    was = realmName(p),
    event = world.events.emit({
      type: STRIFE_EVENTS.restored.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes,
      data: {
        realm: was,
        to: realmName({ ...inst, town: p.town }),
        years: year - s.junta.since,
      },
    });
  store.restorations.push({ realm: p.ref, year, event, years: year - s.junta.since });
  p.leadership = inst.leadership;
  p.succession = inst.succession;
  p.law = inst.law;
  p.ruler = { ...newRuler(world, p, t, event, 2), event };
  s.junta = null;
  return event;
}

/** The year of strife: rule restored where the army's rule ends; coups weighed, and tried. */
export function strifeYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = strifeOf(world),
    order = orderOf(world);
  if (!store || !order) return;
  const realms = politiesOf(world),
    year = yearOfMoment(t);

  // 0. Realms raised this year from another (M146): a split at a ruler's death fought for —
  // the more often where rule passes by birth; the freed marched on by their old masters, where
  // they still hold the bound and are the stronger.
  for (const q of realms.living()) {
    if (!q.from || q.founded !== year || store.civil.some((c) => c.rebel === q.ref)) continue;
    const old = realms.get(q.from),
      formed = world.events.get(q.event),
      why = formed?.causes[0] ? world.events.get(formed.causes[0].ref) : undefined;
    if (!old || old.ended !== null || !why) continue;
    const key = parseRef(q.ref).b >>> 0;
    if (why.type === POLITY_EVENTS.split.type) {
      const chance = STRIFE.contested[old.succession] ?? 0.45;
      if (!(world.rng.real(COUP, key, t, 8) < chance)) continue;
      const decision = world.decisions.record({
        rule: "strife.civil",
        subject: q.ref,
        outcome: { against: old.ref, kind: "succession" },
        score: chance,
        threshold: 0,
        factors: [
          {
            name: "a throne contested",
            value: old.succession,
            contribution: chance,
            source: { ref: why.id, role: "trigger", weight: 1 },
          },
          {
            name: "the claimant's host against the realm's",
            value: strengthOf(ctx, q) / Math.max(1, strengthOf(ctx, old)),
            contribution: 0,
            source: null,
          },
        ],
      });
      civilWar(ctx, q, old, "succession", [{ ref: decision, role: "trigger", weight: 1 }], t);
    } else if (why.type === "order.freed") {
      const oo = order.of(old.ref),
        hier = trait(cultureOf(world).get(old.seat), WAY.hierarchy),
        chance =
          oo && oo.abolished === null && strengthOf(ctx, old) > strengthOf(ctx, q)
            ? clamp(0, 0.8, 1.5 * (hier - 0.4) + 0.5 * oo.caste)
            : 0;
      if (!(chance > 0 && world.rng.real(COUP, key, t, 9) < chance)) continue;
      const decision = world.decisions.record({
        rule: "strife.civil",
        subject: old.ref,
        outcome: { against: q.ref, kind: "freed" },
        score: chance,
        threshold: 0,
        factors: [
          {
            name: "the bound who rose free",
            value: 1,
            contribution: 0.3,
            source: { ref: why.id, role: "trigger", weight: 1 },
          },
          {
            name: "a people who keep to rank",
            value: hier,
            contribution: 1.5 * (hier - 0.4),
            source: nudged(cultureOf(world).get(old.seat), WAY.hierarchy),
          },
          { name: "rank set hard", value: oo!.caste, contribution: 0.5 * oo!.caste, source: null },
        ],
      });
      civilWar(ctx, q, old, "freed", [{ ref: decision, role: "trigger", weight: 1 }], t);
    }
  }

  for (const p of realms.living()) {
    const o = order.of(p.ref);
    if (!o) continue;
    const s = store.of(p.ref),
      key = parseRef(p.ref).b >>> 0;

    // 1. Under its army's rule: restored, the likelier as its standing returns, its people press
    // for a voice, or at a general's death.
    if (s?.junta && p.leadership === GENERAL) {
      const voice = o.movements.find((m) => m.cause === "voice"),
        succeeded = world.events.get(p.ruler.event),
        heirless = p.ruler.since === year && succeeded?.type === POLITY_EVENTS.succession.type,
        standing = Math.max(0, o.legitimacy - 0.5),
        chance =
          STRIFE.restore +
          0.1 * standing +
          0.05 * (voice?.strength ?? 0) +
          (heirless ? STRIFE.heirless : 0);
      if (world.rng.real(COUP, key, t, 1) < chance) {
        const decision = world.decisions.record({
          rule: "strife.restore",
          subject: p.ref,
          outcome: { realm: p.ref },
          score: chance,
          threshold: 0,
          factors: [
            {
              name: "the army's rule",
              value: year - s.junta.since,
              contribution: STRIFE.restore,
              source: { ref: s.junta.event, role: "enabler", weight: 1 },
            },
            {
              name: "a rule held rightful again",
              value: o.legitimacy,
              contribution: 0.1 * standing,
              source: null,
            },
            {
              name: "a people who want a voice",
              value: voice?.strength ?? 0,
              contribution: 0.05 * (voice?.strength ?? 0),
              source: voice ? { ref: voice.event, role: "pressure", weight: 1 } : null,
            },
            {
              name: "a general dead, none chosen to follow",
              value: heirless ? 1 : 0,
              contribution: heirless ? STRIFE.heirless : 0,
              source: heirless ? { ref: p.ruler.event, role: "trigger", weight: 1 } : null,
            },
          ],
        });
        restore(ctx, p, [{ ref: decision, role: "trigger", weight: 1 }], t);
        continue;
      }
    }

    // 2. A revolution weighed (M146): a realm whose people press for a voice or the land.
    const interests = interestsOf(ctx, p, t);
    if (
      p.leadership !== 2 &&
      o.movements.some((m) => m.cause !== "abolition" && m.strength >= STRIFE.movement)
    ) {
      const danger = revolutionDanger(ctx, p, o, interests);
      if (
        danger.movement &&
        danger.score > STRIFE.rising &&
        world.rng.real(COUP, key, t, 10) < STRIFE.revolts * (danger.score - STRIFE.rising)
      ) {
        const odds = clamp(
            0.15,
            0.85,
            0.25 + 0.5 * danger.movement.strength + 0.3 * danger.doubt - 0.4 * danger.weight,
          ),
          won = world.rng.real(COUP, key, t, 11) < odds,
          decision = world.decisions.record({
            rule: "strife.revolution",
            subject: p.ref,
            outcome: { won, cause: danger.movement.cause },
            score: danger.score,
            threshold: STRIFE.rising,
            factors: danger.factors,
          }),
          causes: CauseRef[] = [{ ref: decision, role: "trigger", weight: 1 }];
        if (won)
          revolt(
            ctx,
            p,
            danger.movement.cause,
            causes,
            t,
            interests.find((i) => i.group === "the court")?.sway ?? 0,
          );
        else repress(ctx, p, danger.movement.cause, causes, t);
        continue;
      }
    }

    // 3. A coup weighed: an army with sway enough, uncowed, in a realm old enough to have a seat worth taking.
    if ((s?.purged ?? 0) > year || year - p.founded < 5) continue;
    const army = interests.find((i) => i.group === "the army");
    if (!army || army.sway < STRIFE.least) continue;
    const danger = coupDanger(ctx, p, o, interests);
    if (danger.score <= STRIFE.line) continue;
    const chance = STRIFE.chance * (danger.score - STRIFE.line);
    if (!(world.rng.real(COUP, key, t, 2) < chance)) continue;
    const won = world.rng.real(COUP, key, t, 3) < coupOdds(danger),
      decision = world.decisions.record({
        rule: "strife.coup",
        subject: p.ref,
        outcome: { won },
        score: danger.score,
        threshold: STRIFE.line,
        factors: danger.factors,
      });
    if (won) seize(ctx, p, [{ ref: decision, role: "trigger", weight: 1 }], t);
    else foil(ctx, p, [{ ref: decision, role: "trigger", weight: 1 }], t, danger.weight);
  }
}

/** A rule seized by the sword, as its people hold it (a factor of its legitimacy), while remembered. */
export function seizedFactor(world: World, p: Polity): Factor | null {
  const junta = strifeOf(world)?.junta(p.ref);
  if (!junta) return null;
  const fade = Math.max(0, 1 - (yearOfMoment(world.now) - junta.since) / STRIFE.remembered);
  return fade > 0
    ? {
        name: "a rule seized by the sword",
        value: fade,
        contribution: -STRIFE.seized * fade,
        source: { ref: junta.event, role: "pressure", weight: 1 },
      }
    : null;
}

/** The god's hand on a realm's army (M145): stirred against its seat; its rule given back. */
export function installStrifeActs(world: World, ctx: () => PopulationContext): void {
  const realmAt = (args: unknown): Polity | string => {
    const cell = (args as { cell?: unknown } | null)?.cell;
    if (!Number.isInteger(cell)) return "a land is wanted";
    if (!ctx().provinces.get(cell as number)) return "no one lives there";
    return politiesOf(world).of(cell as number) ?? "no realm holds it";
  };
  // Its army stirred against its seat: a coup tried now, the likelier won for the god's hand in it.
  world.defineCommand({
    type: "act.incite",
    validate: (args) => {
      if (!strifeOf(world) || !orderOf(world)) return "this world knows no strife";
      const p = realmAt(args);
      return typeof p === "string" ? p : null;
    },
    apply: (command, t) => {
      const c = ctx(),
        p = realmAt(command.args) as Polity,
        o = orderOf(world)!.of(p.ref),
        cell = (command.args as { cell: number }).cell,
        stirred = world.events.emit({
          type: STRIFE_ACTS.incite.type,
          subjects: [p.ref],
          place: c.provinces.get(cell)?.ref ?? null,
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { realm: realmName(p) },
        }),
        danger = o ? coupDanger(c, p, o) : { weight: 0.3, doubt: 0, cap: 0.5 },
        odds = Math.min(0.95, coupOdds(danger) + 0.3),
        causes: CauseRef[] = [{ ref: stirred, role: "trigger", weight: 1 }];
      if (world.rng.real(COUP, parseRef(p.ref).b >>> 0, t, 4) < odds) seize(c, p, causes, t);
      else foil(c, p, causes, t);
    },
  });
  // A pretender raised (M146): a claimant in a land, with the realm's lands about it, rises
  // against its seat and marches on it.
  world.defineCommand({
    type: "act.pretender",
    validate: (args) => {
      if (!strifeOf(world)) return "this world knows no strife";
      const p = realmAt(args);
      if (typeof p === "string") return p;
      const cell = (args as { cell: number }).cell;
      if (cell === p.seat) return "a realm's seat cannot rise against itself";
      return ctx().settlements.inProvince(cell).length
        ? null
        : "no town there to raise a claimant in";
    },
    apply: (command, t) => {
      const c = ctx(),
        p = realmAt(command.args) as Polity,
        cell = (command.args as { cell: number }).cell,
        g = c.generated,
        about = [cell];
      for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
        const n = g.grid.neighbours[k]!;
        if (n !== p.seat && p.members.includes(n)) about.push(n);
      }
      const raised = world.events.emit({
        type: STRIFE_ACTS.pretender.type,
        subjects: [p.ref],
        place: c.provinces.get(cell)?.ref ?? null,
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: { realm: realmName(p), lands: about.length },
      });
      breakAway(c, p, about, raised, "pretender", t);
    },
  });
  // Its own rule given back: the army's rule ends at once.
  world.defineCommand({
    type: "act.restore",
    validate: (args) => {
      if (!strifeOf(world)) return "this world knows no strife";
      const p = realmAt(args);
      if (typeof p === "string") return p;
      return strifeOf(world)!.junta(p.ref) && p.leadership === GENERAL
        ? null
        : "its army does not rule it";
    },
    apply: (command, t) => {
      const c = ctx(),
        p = realmAt(command.args) as Polity,
        cell = (command.args as { cell: number }).cell,
        given = world.events.emit({
          type: STRIFE_ACTS.restore.type,
          subjects: [p.ref],
          place: c.provinces.get(cell)?.ref ?? null,
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { realm: realmName(p) },
        });
      restore(c, p, [{ ref: given, role: "trigger", weight: 1 }], t);
    },
  });
}

/** Teach a peopled world its strife. */
export function installStrife(world: World, ctx: () => PopulationContext): StrifeStore {
  const store = world.register(new StrifeStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "189.strife.year", every: YEAR, run: (t) => strifeYear(ctx(), t) });
  return store;
}
