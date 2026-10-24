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
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf, type Ways } from "../culture/culture.ts";
import { loreOf } from "../lore/lore.ts";
import {
  GENERAL,
  LEADERSHIP,
  POLITY_EVENTS,
  crown,
  institutionsOf,
  politiesOf,
  realmName,
  type Polity,
} from "../polity/polity.ts";
import { interestsOf, type Interest } from "../polity/interests.ts";
import { fieldedOf, warsOf } from "../war/war.ts";
import { capacityOf, orderOf, type RealmOrder } from "../order/order.ts";

export const STRIFE_EVENTS = {
  /** A general seizes the seat. */
  coup: defineEventType("strife.coup", 6),
  /** A coup foiled, its plotters purged. */
  foiled: defineEventType("strife.foiled", 5),
  /** The army's rule ends, and the realm's own is restored. */
  restored: defineEventType("strife.restored", 5),
};

/** The god's hand on a realm's army: stirred against its seat; its rule given back (M145). */
export const STRIFE_ACTS = {
  incite: defineEventType("act.incite", 5),
  restore: defineEventType("act.restore", 5),
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

const COUP = defineStream("strife.coup");

export class StrifeStore implements StateStore {
  readonly name = "strife.realms";
  realms = new Map<string, RealmStrife>();
  coups: Coup[] = [];
  restorations: Restoration[] = [];

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
    return out;
  }
  save(): unknown {
    return {
      realms: [...this.realms.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1)),
      coups: this.coups,
      restorations: this.restorations,
    };
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  load(state: unknown): void {
    const s = state as { realms: RealmStrife[]; coups: Coup[]; restorations: Restoration[] };
    this.realms = new Map(
      s.realms.map((r) => [r.realm, { ...r, junta: r.junta ? { ...r.junta } : null }]),
    );
    this.coups = [...s.coups];
    this.restorations = [...(s.restorations ?? [])];
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
export function foil(ctx: PopulationContext, p: Polity, causes: CauseRef[], t: SimTime): Ref {
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

    // 2. A coup weighed: an army with sway enough, uncowed, in a realm old enough to have a seat worth taking.
    if ((s?.purged ?? 0) > year || year - p.founded < 5) continue;
    const interests = interestsOf(ctx, p, t),
      army = interests.find((i) => i.group === "the army");
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
    else foil(ctx, p, [{ ref: decision, role: "trigger", weight: 1 }], t);
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
