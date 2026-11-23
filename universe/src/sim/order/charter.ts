// What a realm writes down of its rule, and what it does with it (the breadth round, 2026-11-23). A few numbers a realm, each
// read off forces the world already keeps, and nothing named in advance:
//   a charter (a constitution): written where the realm can write, its choices are carried by more than its great (voice past
//     CHARTER.voice) and it binds itself (trust), the sooner after its people's say was widened; entrenched as far as it
//     binds itself (CHARTER.bar). A charter makes a coup the harder; a coup that makes an army or a general its master tears it.
//   a referendum: under a charter, where the choices are carried by many (voice past REFERENDUM.voice), a change of the
//     realm's rule is put to all who have a say: each group's heads vote by whether what it has learned to want of the realm's
//     voice (sim/order/wants.ts) is moved its way by the change (more say for those who want more than the old rule gives); the
//     change is made only if more than the charter's bar say yes (polity.ts step 6 asks putToPeople).
//   emergency powers: a realm whose people have a say, losing its war or starving at its seat, may take powers past its say for
//     a time (its voice narrowed by EMERGENCY.narrow), the readier the more its seat keeps the arms; they lapse when the danger
//     has passed for EMERGENCY.calm years, or are kept for good where the seat keeps the arms and no charter binds it.
//   towns' own councils (local government): a seat leaves its far lands with towns of their own to rule themselves, as far as
//     they lie beyond a step of it and are towns, and the more as its choices are carried by many; a land that rules itself
//     chafes the less at a far seat (polity.ts step 3 reads localOf).
//   who has a say (sex and rule): of the grown, those of the sex that bears are given a say as far as their people's roles give
//     them a seat (sim/society roles: rules/roles.ts bearersRule, from the body's dimorphism and the people's norm; even odds
//     where no roles are kept, so a one-bodied people or one whose roles are even is heard whole); a realm's voice is never more
//     than the share of its grown who are heard.
// Each change is an event with its causes; nothing a person, nothing a tick: a record a realm, read every CHARTER.every years
// (emergencies yearly), dropped when the realm ends.
import {
  YEAR,
  defineEventType,
  defineStream,
  parseRef,
  yearOfMoment,
  type CauseRef,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { HOLD, HOLDING } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import {
  GENERAL,
  LEADERSHIP,
  politiesOf,
  reach,
  realmName,
  type Polity,
} from "../polity/polity.ts";
import { interestsOf } from "../polity/interests.ts";
import { orderOf } from "./order.ts";
import { holdsOf, setHeld } from "./holds.ts";
import { wantsOf } from "./wants.ts";
import { loreOf } from "../lore/lore.ts";
import { battlesOf, strifeOf } from "../strife/strife.ts";
import { warsOf } from "../war/war.ts";
import { bearerOddsOf } from "../society/kept.ts";

export const CHARTER_EVENTS = {
  /** A charter written, or torn. */
  charter: defineEventType("order.charter", 5),
  /** A change of rule put to the people. */
  referendum: defineEventType("order.referendum", 4),
  /** Powers past the people's say taken, lapsed, or kept. */
  emergency: defineEventType("order.emergency", 4),
  /** Its far towns given councils of their own, or taken back under the seat. */
  local: defineEventType("order.local", 4),
  /** Who of its grown is heard: a say given to, or kept from, those of the sex that bears. */
  heard: defineEventType("order.heard", 4),
};

export const CHARTER = {
  /** Years between a realm's readings (emergencies are read every year). */
  every: 5,
  /** Past this voice (its choices carried by more than its great), a realm that can write may write one: by `write` a reading
   * at a voice a tenth past it and a trust of a half, more as it binds itself. */
  voice: 0.5,
  write: 0.3,
  /** Within this many years of its voice being widened, the readier. */
  fresh: 10,
  freshBy: 0.25,
  /** The share of the say a change needs under a charter: a half, and as far again as the realm binds itself. */
  bar: 0.5,
  barBy: 0.3,
  /** A charter makes a coup this much the less likely at its barest (sim/strife coupDanger). */
  coup: 0.12,
} as const;
export const REFERENDUM = { voice: 0.55 } as const;
export const EMERGENCY = {
  /** The yearly chance at a full danger and a middling grip on the arms. */
  take: 0.08,
  narrow: 0.25,
  /** Years of calm before powers lapse; years held before they may be kept. */
  calm: 3,
  keptAfter: 10,
  keepForce: 0.6,
} as const;
export const LOCAL = {
  /** A land beyond this many steps of the seat with a town of this many is one that may rule itself. */
  steps: 2,
  town: 2000,
  /** Where its share passes one of these, it is told. */
  bands: [0.25, 0.5] as readonly number[],
  /** A land that rules itself chafes at distance this much the less (at a full share). */
  eases: 0.5,
} as const;
/** Of the grown, the share of the sex that bears: who are heard of them is read off their odds of a seat (even odds: all). */
export const BEARERS = 0.5;

/** What a realm has written and done with it. Hundredths where a share. */
export type Charter = {
  written: number | null;
  writ: Ref | null;
  bar: number;
  emergency: { since: number; event: Ref; voice: number; calm: number } | null;
  local: number;
  localEvent: Ref | null;
  heard: number;
  heardEvent: Ref | null;
};

const fresh = (): Charter => ({
  written: null,
  writ: null,
  bar: 50,
  emergency: null,
  local: 0,
  localEvent: null,
  heard: 100,
  heardEvent: null,
});

export class CharterStore implements StateStore {
  readonly name = "order.charters";
  private readonly byRealm = new Map<Ref, Charter>();
  dormant(): boolean {
    return this.byRealm.size === 0;
  }
  of(realm: Ref): Charter | undefined {
    return this.byRealm.get(realm);
  }
  ensure(realm: Ref): Charter {
    let c = this.byRealm.get(realm);
    if (!c) this.byRealm.set(realm, (c = fresh()));
    return c;
  }
  drop(realm: Ref): void {
    this.byRealm.delete(realm);
  }
  realms(): Ref[] {
    return [...this.byRealm.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const c of this.byRealm.values()) {
      if (c.writ) out.push(c.writ);
      if (c.emergency) out.push(c.emergency.event);
      if (c.localEvent) out.push(c.localEvent);
      if (c.heardEvent) out.push(c.heardEvent);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    for (const k of this.realms()) h.string(k).value(this.byRealm.get(k)!);
  }
  save(): unknown {
    return this.realms().map((k) => [k, this.byRealm.get(k)!]);
  }
  load(s: unknown): void {
    this.byRealm.clear();
    for (const [k, c] of (s as [Ref, Charter][]) ?? []) this.byRealm.set(k, { ...fresh(), ...c });
  }
}

export function chartersOf(world: World): CharterStore | null {
  return world.hasStore("order.charters") ? world.store<CharterStore>("order.charters") : null;
}

/** Whether a realm's seat holds powers past its people's say: its rule is not re-read while they last (polity.ts step 6). */
export function underEmergency(world: World, realm: Ref): boolean {
  return !!chartersOf(world)?.of(realm)?.emergency;
}

/** How far a realm's far lands rule themselves (0 … 1; none where nothing is kept): polity.ts eases their grievance by it. */
export function localOf(world: World, realm: Ref): number {
  return (chartersOf(world)?.of(realm)?.local ?? 0) / 100;
}

/** A realm's charter, as strife reads it against a coup: its factor, where one is written. */
export function charterAgainstCoup(
  world: World,
  realm: Ref,
): { name: string; value: number; contribution: number; source: CauseRef | null }[] {
  const c = chartersOf(world)?.of(realm);
  if (!c?.written || !c.writ) return [];
  return [
    {
      name: "a written charter",
      value: c.bar / 100,
      contribution: -CHARTER.coup * (c.bar / 100) * 2 * (c.emergency ? 0.5 : 1),
      source: { ref: c.writ, role: "constraint", weight: 1 },
    },
  ];
}

/** A coup that made an army or a general master of the realm tears its charter (sim/strife seize). */
export function charterTorn(ctx: PopulationContext, p: Polity, by: Ref): void {
  const c = chartersOf(ctx.world)?.of(p.ref);
  if (!c?.written) return;
  ctx.world.events.emit({
    type: CHARTER_EVENTS.charter.type,
    subjects: [p.ref],
    place: ctx.provinces.get(p.seat)?.ref ?? null,
    causes: [
      { ref: by, role: "trigger", weight: 1 },
      ...(c.writ ? [{ ref: c.writ, role: "enabler" as const, weight: 0.3 }] : []),
    ],
    data: { realm: realmName(p), how: "torn", since: c.written },
  });
  c.written = null;
  c.writ = null;
}

/** The voice each form of rule stands for (as a realm founded under it is first held: rules/holds.ts firstHolds). */
const FORM_VOICE = [0.12, 0.35, 0.7, 0.15, 0.08];

/**
 * A change of rule put to the people, where the realm has a charter and its choices are carried by many: null where it is
 * not (the change is the seat's to make); else whether more than its bar said yes, and the vote's event.
 */
export function putToPeople(
  ctx: PopulationContext,
  p: Polity,
  to: { leadership: number; succession: number; law: number },
  t: SimTime,
): { passed: boolean; event: Ref } | null {
  const { world } = ctx,
    c = chartersOf(world)?.of(p.ref);
  if (!c?.written || !c.writ || c.emergency) return null;
  const voice = holdsOf(world, p.ref)[HOLD.voice]!;
  if (voice < REFERENDUM.voice) return null;
  const learned = wantsOf(world),
    was = FORM_VOICE[p.leadership] ?? 0.3,
    now = FORM_VOICE[to.leadership] ?? 0.3,
    // (By choice is the more widely carried: as a council against a chief.)
    wasV = was + (p.succession === 1 ? 0.1 : 0),
    nowV = now + (to.succession === 1 ? 0.1 : 0);
  let yes = 0,
    all = 0;
  for (const i of interestsOf(ctx, p, t)) {
    if (!(i.people > 0)) continue;
    // (A head votes for the change where it moves the realm's say the way its group has learned to want it moved: more say for
    // one who wants more than the old rule gives, less for one who wants less.)
    const want = learned?.wantOf(p.ref, i.group)?.[HOLD.voice] ?? voice,
      d = Math.sign(nowV - wasV) * (want - wasV);
    all += i.people;
    yes += i.people * (d > 0.01 ? 1 : d < -0.01 ? 0 : 0.5);
  }
  if (!(all > 0)) return null;
  const share = yes / all,
    passed = share > c.bar / 100,
    event = world.events.emit({
      type: CHARTER_EVENTS.referendum.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: [{ ref: c.writ, role: "enabler", weight: 1 }],
      data: {
        realm: realmName(p),
        to: LEADERSHIP[to.leadership],
        yes: Math.round(share * 100),
        bar: c.bar,
        passed,
      },
    });
  return { passed, event };
}

/**
 * Its far towns' own councils, read in the realm's year (polity.ts step 3, which has its lands' steps from the seat at hand),
 * every CHARTER.every * 2 years: of its lands, those beyond LOCAL.steps of the seat with a town of LOCAL.town or more, the more
 * left to themselves as its choices are carried by many; under an army, little.
 */
export function setLocal(ctx: PopulationContext, p: Polity, far: number): void {
  const { world } = ctx,
    store = chartersOf(world);
  if (!store || p.members.length <= 3) return;
  const voice = holdsOf(world, p.ref)[HOLD.voice]!,
    junta = p.leadership === GENERAL,
    share = Math.round(
      100 * Math.min(1, (far / p.members.length) * (0.5 + voice) * (junta ? 0.3 : 1)),
    );
  let c = store.of(p.ref);
  const was = c?.local ?? 0,
    band = (x: number) => LOCAL.bands.filter((b) => x / 100 >= b).length;
  if (!(share > 0) && !c) return;
  c ??= store.ensure(p.ref);
  if (band(share) !== band(was))
    c.localEvent = world.events.emit({
      type: CHARTER_EVENTS.local.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: c.localEvent ? [{ ref: c.localEvent, role: "enabler", weight: 0.5 }] : [],
      data: { realm: realmName(p), share, was, lands: far },
    });
  c.local = share;
}

/** Whether this is a realm's year to read its far towns (polity.ts step 3). */
export function localYear(realm: Ref, year: number): boolean {
  return (year + (parseRef(realm).b >>> 0)) % (2 * CHARTER.every) === 0;
}

const NO_BATTLES = { won: 0, lost: 0, last: null, lastWon: null };
/** The danger a realm stands in this year: a war going against it, or its seat starving; with what tells it. */
function dangerOf(
  ctx: PopulationContext,
  p: Polity,
  year: number,
): { level: number; cause: Ref | null } {
  // (Battles are read only for a realm at war: the most of realms are not.)
  const fought =
      ctx.world.hasStore("war.wars") && warsOf(ctx.world).fighting(p.ref).length
        ? battlesOf(ctx.world, p, year)
        : NO_BATTLES,
    losing = fought.lost >= 2 && fought.lost > fought.won ? Math.min(1, fought.lost / 4) : 0,
    famine = ctx.provinces.get(p.seat)?.lastFamine ?? null,
    e = famine ? ctx.world.events.get(famine) : undefined,
    starving = e && ctx.world.now - e.t <= YEAR ? 0.6 : 0;
  return losing >= starving
    ? { level: losing, cause: losing > 0 ? fought.last : null }
    : { level: starving, cause: famine };
}

/** The year of realms' charters. */
export function charterYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = chartersOf(world),
    order = orderOf(world);
  if (!store || !order) return;
  const realms = politiesOf(world),
    year = yearOfMoment(t),
    strife = strifeOf(world),
    lore = loreOf(world);
  for (const ref of store.realms()) {
    const q = realms.get(ref);
    if (!q || q.ended !== null) store.drop(ref);
  }
  for (const p of realms.living()) {
    const o = order.of(p.ref);
    if (!o?.held) continue;
    const key = parseRef(p.ref).b >>> 0,
      held = o.held,
      voice = held[HOLD.voice]! / 100,
      force = held[HOLD.force]! / 100,
      trust = held[HOLD.trust]! / 100,
      place = ctx.provinces.get(p.seat)?.ref ?? null,
      junta = p.leadership === GENERAL || !!strife?.junta(p.ref);
    let c = store.of(p.ref);

    // Emergency powers, every year.
    if (c?.emergency) {
      const danger = dangerOf(ctx, p, year),
        em = c.emergency;
      em.calm = danger.level > 0 ? 0 : em.calm + 1;
      if (em.calm >= EMERGENCY.calm || junta) {
        const event = world.events.emit({
          type: CHARTER_EVENTS.emergency.type,
          subjects: [p.ref],
          place,
          causes: [{ ref: em.event, role: "enabler", weight: 1 }],
          data: { realm: realmName(p), how: "lapsed", years: year - em.since },
        });
        if (!junta) setHeld(o, "voice", em.voice / 100, "least", event);
        c.emergency = null;
      } else if (
        year - em.since >= EMERGENCY.keptAfter &&
        force >= EMERGENCY.keepForce &&
        !c.written
      ) {
        world.events.emit({
          type: CHARTER_EVENTS.emergency.type,
          subjects: [p.ref],
          place,
          causes: [{ ref: em.event, role: "trigger", weight: 1 }],
          data: { realm: realmName(p), how: "kept", years: year - em.since },
        });
        c.emergency = null;
      }
    } else if (!junta && voice >= HOLDING.voiceMid) {
      const danger = dangerOf(ctx, p, year),
        chance = EMERGENCY.take * danger.level * (0.5 + force);
      if (danger.level > 0 && world.rng.real(CHARTER_DRAW, key, t, 1) < chance) {
        c ??= store.ensure(p.ref);
        const decision = world.decisions.record({
          rule: "order.emergency",
          subject: p.ref,
          outcome: { taken: true },
          score: chance,
          threshold: 0,
          factors: [
            {
              name: "a danger to the realm",
              value: danger.level,
              contribution: danger.level,
              source: danger.cause ? { ref: danger.cause, role: "trigger", weight: 1 } : null,
            },
            {
              name: "arms kept by its seat",
              value: force,
              contribution: force - 0.5,
              source: null,
            },
          ],
        });
        const event = world.events.emit({
          type: CHARTER_EVENTS.emergency.type,
          subjects: [p.ref],
          place,
          causes: [{ ref: decision, role: "trigger", weight: 1 }],
          data: { realm: realmName(p), how: "taken" },
        });
        c.emergency = { since: year, event, voice: held[HOLD.voice]!, calm: 0 };
        setHeld(o, "voice", Math.max(0, voice - EMERGENCY.narrow), "most", event);
      }
    }

    // The rest, every CHARTER.every years, a realm's year by its number.
    if ((year + key) % CHARTER.every !== 0) continue;

    // Who of its grown is heard.
    const odds = bearerOddsOf(world, p.seat),
      heard = Math.round(100 * (1 - BEARERS * (1 - Math.min(1, odds / 0.5))));
    if (heard < 100 || c) {
      c ??= store.ensure(p.ref);
      const was = c.heard,
        // (Told where it changes who is heard by a tenth or more, and the first time only where it binds the realm's say.)
        tell = c.heardEvent ? Math.abs(heard - was) >= 10 : heard < 100 && voice * 100 > heard + 1;
      if (!tell) c.heard = c.heardEvent ? c.heard : heard;
      else {
        const event = world.events.emit({
          type: CHARTER_EVENTS.heard.type,
          subjects: [p.ref],
          place,
          causes: c.heardEvent ? [{ ref: c.heardEvent, role: "enabler", weight: 0.5 }] : [],
          data: { realm: realmName(p), heard, was, odds: Math.round(odds * 100) },
        });
        c.heard = heard;
        c.heardEvent = event;
      }
      if (voice * 100 > c.heard + 1 && c.heardEvent)
        setHeld(o, "voice", c.heard / 100, "most", c.heardEvent);
    }

    // A charter written.
    if (!c?.written && !junta && voice > CHARTER.voice && lore.effect(p.seat, "writing") > 0) {
      const widened = o.heldEvents?.[HOLD.voice] ?? null,
        we = widened ? world.events.get(widened) : undefined,
        recent = we && year - yearOfMoment(we.t) <= CHARTER.fresh,
        chance =
          CHARTER.write * (voice - CHARTER.voice) * (0.5 + trust) * 2 +
          (recent ? CHARTER.freshBy : 0);
      if (world.rng.real(CHARTER_DRAW, key, t, 2) < chance) {
        c ??= store.ensure(p.ref);
        const decision = world.decisions.record({
          rule: "order.charter",
          subject: p.ref,
          outcome: { written: true },
          score: chance,
          threshold: 0,
          factors: [
            {
              name: "a choice carried by many",
              value: voice,
              contribution: voice - CHARTER.voice,
              source: widened ? { ref: widened, role: "enabler", weight: 1 } : null,
            },
            {
              name: "a realm that binds itself",
              value: trust,
              contribution: trust - 0.5,
              source: null,
            },
            {
              name: "its people's say widened of late",
              value: recent ? 1 : 0,
              contribution: recent ? CHARTER.freshBy : 0,
              source: recent && widened ? { ref: widened, role: "trigger", weight: 1 } : null,
            },
          ],
        });
        c.written = year;
        c.bar = Math.round(100 * (CHARTER.bar + CHARTER.barBy * trust));
        c.writ = world.events.emit({
          type: CHARTER_EVENTS.charter.type,
          subjects: [p.ref],
          place,
          causes: [{ ref: decision, role: "trigger", weight: 1 }],
          data: { realm: realmName(p), how: "written", bar: c.bar },
        });
      }
    }
  }
}

const CHARTER_DRAW = defineStream("order.charter");

/** Teach a peopled world its charters. */
export function installCharters(world: World, ctx: () => PopulationContext): CharterStore {
  const store = world.register(new CharterStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "189.order.charter", every: YEAR, run: (t) => charterYear(ctx(), t) });
  return store;
}
