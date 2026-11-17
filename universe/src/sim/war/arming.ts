// What each realm turns to arms, year by year (the last sweep, war; the rules are rules/arming.ts). 184.war.arming, a realm a
// year, before the war's year reads its host: its footing, moved a third of the way toward what it would have. At peace that is
// its answer to the rival it fears most, a race when the rival answers it in turn. At war it is what it stands to lose by how
// the war goes. What it sends into another's war is read here too: one side of a war gets arms from a realm that fears the
// other side. Its effects are read by sim/war/war.ts (the share it fields and what its arms are worth), by sim/money/money.ts
// (what its treasury pays) and by sim/war/bonds.ts (what a war costs it). No draws: a reckoning of numbers the world keeps.
// The levy reads here too what each realm can spare beyond its food and what its wars put at stake (war.ts fieldShare), and a
// peace has a beaten realm stand down part of its host for a term (bonds.ts bindPeace). One small row a living realm; none
// before the first realm, so the store is dormant until then.
import {
  defineEventType,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  ARMING,
  FOODS,
  G,
  GOODS,
  backingOf,
  fatigueOf,
  footingTerms,
  footingYear,
  peaceFooting,
  rivalLevel,
  warFooting,
  warReckoning,
} from "../../rules/index.ts";
import { marketsOf, mouths, type PopulationContext } from "../population/systems.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { RIVALRY, diplomacyOf } from "../diplomacy/diplomacy.ts";
import { fearOf } from "../finance/finance.ts";
import { holdsOf } from "../order/holds.ts";
import { strengthOf, warsOf } from "./war.ts";
import { aimOf, warCosts } from "./bonds.ts";

export const ARMING_EVENTS = {
  /** Two realms each arming against the other. */
  race: defineEventType("war.arms-race", 4),
  /** A realm sending arms into another's war, to the foe of one it fears. */
  backed: defineEventType("war.backed", 3),
};

/** A realm's arming, as kept. Shares are of what it makes in a year. */
export type Footing = {
  readonly realm: Ref;
  /** The share of what it makes turned to arms, and the share it would turn. */
  footing: number;
  wanted: number;
  /** The realm it arms against most at peace, its fear of it, that realm's strength over its own, and what arming costs it. */
  against: Ref | null;
  threat: number;
  ratio: number;
  fatigue: number;
  /** The war that asks most of it, if one does. */
  war: Ref | null;
  /** The war it sends arms into, the side it helps, and the share of what it makes that it sends. */
  backs: Ref | null;
  helps: Ref | null;
  sends: number;
  /** What those who back it send, as a share of what it makes. */
  gift: number;
  /** What it made last year (grain's worth): what its footing costs it. */
  made: number;
  /** The arms race it is in, and the backing it began, told. */
  race: Ref | null;
  backed: Ref | null;
  /** Of what it makes, the share beyond what its people eat; and of what it has, the most a war of its stands to take. */
  spare: number;
  stake: number;
  /** Of its host, the share a peace has it stand down, until which year, and the peace that asked it (0, 0, null: none). */
  disarm: number;
  disarmUntil: number;
  disarmEvent: Ref | null;
};

/** A row for a realm that has none yet. */
const fresh = (realm: Ref): Footing => ({
  realm,
  footing: 0,
  wanted: 0,
  against: null,
  threat: 0,
  ratio: 0,
  fatigue: 1,
  war: null,
  backs: null,
  helps: null,
  sends: 0,
  gift: 0,
  made: 0,
  race: null,
  backed: null,
  spare: SPARE_UNREAD,
  stake: 0,
  disarm: 0,
  disarmUntil: 0,
  disarmEvent: null,
});

/** What a realm not yet read is taken to have to spare beyond its food. */
export const SPARE_UNREAD = 0.3;

const r4 = (x: number) => Math.round(x * 10_000) / 10_000;

/** Fold numbers into a running digest (two 32-bit words): a checkpoint hashes this, not every row. */
function fold(d: [number, number], xs: readonly number[]): void {
  let a = d[0],
    b = d[1];
  for (const x of xs) {
    const lo = x | 0,
      hi = Math.floor(x / 4294967296) | 0;
    a = Math.imul(a ^ lo, 0x01000193) ^ hi;
    b = Math.imul(b + lo + 0x9e3779b9, 0x85ebca6b) ^ (b >>> 13);
  }
  d[0] = a;
  d[1] = b;
}

const refNumber = (r: Ref | null): number => {
  if (!r) return -1;
  const n = Number(r.split(":").at(-1));
  return Number.isFinite(n) ? n : r.length;
};

export class ArmingStore implements StateStore {
  readonly name = "war.arming";
  private readonly rows = new Map<Ref, Footing>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  private sets = 0;
  dormant(): boolean {
    return this.rows.size === 0;
  }
  of(realm: Ref): Readonly<Footing> | undefined {
    return this.rows.get(realm);
  }
  realms(): Ref[] {
    return [...this.rows.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  set(f: Footing): void {
    this.rows.set(f.realm, f);
    fold(this.digest, [
      refNumber(f.realm),
      Math.round(f.footing * 10_000),
      Math.round(f.wanted * 10_000),
      refNumber(f.against),
      refNumber(f.war),
      refNumber(f.backs),
      refNumber(f.helps),
      Math.round(f.sends * 10_000),
      Math.round(f.gift * 10_000),
      Math.round(f.spare * 10_000),
      Math.round(f.stake * 10_000),
      Math.round(f.disarm * 10_000),
      f.disarmUntil,
    ]);
    this.sets++;
  }
  drop(realm: Ref): void {
    this.rows.delete(realm);
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const f of this.rows.values()) {
      if (f.race) out.push(f.race);
      if (f.backed) out.push(f.backed);
      if (f.disarmEvent) out.push(f.disarmEvent);
    }
    return out;
  }
  hashInto(h: Hasher): void {
    h.int(this.rows.size).int(this.sets).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    return {
      rows: this.realms().map((r) => this.rows.get(r)),
      digest: [...this.digest],
      sets: this.sets,
    };
  }
  load(state: unknown): void {
    this.rows.clear();
    const s = state as { rows?: Footing[]; digest?: [number, number]; sets?: number } | null;
    // (A save from before the mobilisation and the disarming keeps none of their numbers: as a fresh row's.)
    for (const f of s?.rows ?? []) this.rows.set(f.realm, { ...fresh(f.realm), ...f });
    this.digest[0] = s?.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s?.digest?.[1] ?? 0;
    this.sets = s?.sets ?? 0;
  }
}

export function armingOf(world: World): ArmingStore | null {
  return world.hasStore("war.arming") ? world.store<ArmingStore>("war.arming") : null;
}

// —— What the other systems read ——————————————————————————————————————————————————————————————————————

/** A realm's footing: the share of what it makes it turns to arms (0 where it keeps none). */
export function footingOf(world: World, realm: Ref): number {
  return armingOf(world)?.of(realm)?.footing ?? 0;
}

/**
 * What a realm turns to arms for its wars, beyond what it would keep at peace against the rival it fears (0 where it keeps none):
 * what a war costs it a year in what it makes. What it keeps at peace it keeps whether it fights or not, and is no cost of a war.
 */
export function warFootingOf(world: World, realm: Ref): number {
  const f = armingOf(world)?.of(realm);
  if (!f || f.footing <= 0) return 0;
  const peace = peaceFooting({
    threat: f.threat,
    ratio: f.ratio,
    fatigue: Math.max(1e-6, f.fatigue),
  });
  return Math.max(0, f.footing - peace);
}

/** What its footing adds to the share of its men a realm fields (sim/war/war.ts fieldShare): 0 where it keeps none. */
export function footingFields(world: World, realm: Ref): number {
  const f = armingOf(world)?.of(realm);
  return f ? footingTerms(f.footing, f.gift).fields : 0;
}

/** What its footing and the arms it is sent multiply its host's arms by (sim/war/war.ts strengthOf), less what a peace has it stand down: 1 where it keeps none. */
export function footingPower(world: World, realm: Ref): number {
  const f = armingOf(world)?.of(realm);
  return f ? footingTerms(f.footing, f.gift).power * (1 - disarmed(world, f)) : 1;
}

/** Of a realm's host, the share a peace still has it stand down (0 where none, or its term is over). */
function disarmed(world: World, f: Readonly<Footing>): number {
  return f.disarm > 0 && yearOfMoment(world.now) <= f.disarmUntil ? f.disarm : 0;
}

/** What the levy reads of a realm (sim/war/war.ts fieldShare): what it can spare beyond its food, its stake, its host stood down. */
export function mobilising(
  world: World,
  realm: Ref,
): { spare: number; stake: number; footing: number; disarm: number } {
  const f = armingOf(world)?.of(realm);
  return f
    ? { spare: f.spare, stake: f.stake, footing: f.footing, disarm: disarmed(world, f) }
    : { spare: SPARE_UNREAD, stake: 0, footing: 0, disarm: 0 };
}

/**
 * A peace has a beaten realm stand down `share` of its host until `until` (sim/war/bonds.ts bindPeace). It turns nothing more to
 * arms while it does; a later peace asks it again only for more.
 */
export function disarmRealm(
  world: World,
  realm: Ref,
  share: number,
  until: number,
  event: Ref,
): void {
  const store = armingOf(world);
  if (!store || !(share > 0)) return;
  const f = { ...(store.of(realm) ?? fresh(realm)) };
  if (disarmed(world, f) >= share && f.disarmUntil >= until) return;
  f.disarm = r4(Math.max(share, disarmed(world, f)));
  f.disarmUntil = Math.max(until, f.disarmUntil);
  f.disarmEvent = event;
  store.set(f);
}

/** What its arming and what it sends abroad cost its treasury in a year (grain's worth): 0 where it keeps none. */
export function armingSpend(world: World, realm: Ref): number {
  const f = armingOf(world)?.of(realm);
  return f ? (f.footing + f.sends) * f.made : 0;
}

// —— The year ——————————————————————————————————————————————————————————————————————————————————————

/** What a realm made last year (grain's worth), and of it the share beyond what its people ate. */
export function madeAndSpare(ctx: PopulationContext, p: Polity): { made: number; spare: number } {
  const markets = marketsOf(ctx.world);
  let made = 0,
    eaten = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c),
      m = markets.get(c);
    if (!prov || !m || prov.total() <= 0) continue;
    for (let g = 0; g < GOODS.length; g++) made += m.book("made", g) * m.price[g]!;
    eaten += 12 * mouths(prov, ctx.life) * m.price[G.grain]!;
  }
  return { made, spare: made > 0 ? Math.max(0, 1 - eaten / made) : 0 };
}

/**
 * Whom each living realm fears, and how much (its kept fear of them or how far their regard is below rivalry, the greater), and
 * each pair's regard by "a|b". Read once a year by the arming and the fleets.
 */
export function rivalsOf(
  world: World,
  alive: ReadonlySet<Ref>,
): {
  rivals: Map<Ref, { of: Ref; level: number }[]>;
  opinions: Map<string, number>;
} {
  const rivals = new Map<Ref, { of: Ref; level: number }[]>(),
    opinions = new Map<string, number>();
  for (const r of diplomacyOf(world).all()) {
    if (!alive.has(r.a) || !alive.has(r.b)) continue;
    opinions.set(`${r.a}|${r.b}`, r.opinion);
    opinions.set(`${r.b}|${r.a}`, r.opinion);
    for (const [x, y] of [
      [r.a, r.b],
      [r.b, r.a],
    ] as const) {
      const level = rivalLevel(r.opinion, RIVALRY, fearOf(world, x, y));
      if (level > 0) (rivals.get(x) ?? rivals.set(x, []).get(x)!).push({ of: y, level });
    }
  }
  return { rivals, opinions };
}

/** Every realm's footing moved toward what it would have, what it sends into others' wars, and the races and backings told. */
export function armingYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = armingOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    wars = warsOf(world),
    diplomacy = diplomacyOf(world),
    living = realms.living(),
    alive = new Set(living.map((p) => p.ref));
  // (Gone realms' rows go with them.)
  for (const r of store.realms()) if (!alive.has(r)) store.drop(r);
  const strengths = new Map<Ref, number>(),
    strength = (p: Polity) => {
      let s = strengths.get(p.ref);
      if (s === undefined) strengths.set(p.ref, (s = strengthOf(ctx, p)));
      return s;
    };
  const { rivals, opinions } = rivalsOf(world, alive);
  // 1. Each realm's footing.
  const next = new Map<Ref, Footing>(),
    made = new Map<Ref, number>();
  for (const p of living) {
    const was = store.of(p.ref),
      { made: m, spare } = madeAndSpare(ctx, p),
      fatigue = fatigueOf(spare, holdsOf(world, p.ref)[1] ?? 0.5);
    made.set(p.ref, m);
    // (Its answer to the rival it fears most for its strength.)
    let against: Ref | null = null,
      threat = 0,
      ratio = 0,
      peace = 0;
    // (Against its own host as it would be without what it turns to arms: its own arming buys it no ease, the rival's is answered.)
    const own = Math.max(1, strength(p) / footingPower(world, p.ref));
    for (const r of rivals.get(p.ref) ?? []) {
      const q = realms.get(r.of);
      if (!q) continue;
      const rr = strength(q) / own,
        f = peaceFooting({ threat: r.level, ratio: rr, fatigue });
      if (f > peace || (f === peace && against !== null && r.of < against)) {
        peace = f;
        against = r.of;
        threat = r.level;
        ratio = rr;
      }
    }
    // (And what its wars ask of it: what it stands to lose by how each goes.)
    let war: Ref | null = null,
      atWar = 0,
      stake = 0;
    for (const w of wars.fighting(p.ref)) {
      const a = realms.get(w.attacker),
        b = realms.get(w.defender);
      if (!a || !b || a.ended !== null || b.ended !== null) continue;
      const c = warCosts(ctx, w, a, b, aimOf(world, w)?.aim, year),
        r = warReckoning({
          won: w.battles.filter((x) => x.won).length,
          fought: w.battles.length,
          ratio: strength(a) / Math.max(1, strength(b)),
          ...c,
        }),
        side = w.attacker === p.ref ? 0 : 1,
        f = warFooting(c.stakes[side]!, side === 0 ? r.chance : 1 - r.chance, fatigue);
      stake = Math.max(stake, c.stakes[side]!);
      if (f > atWar) {
        atWar = f;
        war = w.ref;
      }
    }
    // (A realm a peace has stand down its host turns nothing more to arms while it does.)
    const held = was ? disarmed(world, was) : 0,
      wanted = held > 0 ? 0 : Math.max(peace, atWar),
      footing = r4(footingYear(was?.footing ?? 0, wanted));
    next.set(p.ref, {
      ...fresh(p.ref),
      ...(was && held > 0
        ? { disarm: was.disarm, disarmUntil: was.disarmUntil, disarmEvent: was.disarmEvent }
        : {}),
      spare: r4(spare),
      stake: r4(stake),
      realm: p.ref,
      footing,
      wanted: r4(wanted),
      against,
      threat: r4(threat),
      ratio: r4(ratio),
      fatigue: r4(fatigue),
      war,
      backs: null,
      helps: null,
      sends: 0,
      gift: 0,
      made: Math.round(m),
      race: was?.race ?? null,
      backed: was?.backed ?? null,
    });
  }
  // 2. Arms sent into others' wars: by a realm that fears one side, to the other side, where it is no rival of it. Each sends
  // into the one war whose foe it fears most.
  for (const p of living) {
    const f = next.get(p.ref)!,
      was = store.of(p.ref);
    let best: { war: Ref; helps: Ref; foe: Ref; level: number } | null = null;
    if (!wars.fighting(p.ref).length)
      for (const r of rivals.get(p.ref) ?? []) {
        if (r.level < ARMING.backLeast) continue;
        for (const w of wars.fighting(r.of)) {
          if (w.civil || w.attacker === p.ref || w.defender === p.ref) continue;
          const helps = w.attacker === r.of ? w.defender : w.attacker,
            opinion = opinions.get(`${p.ref}|${helps}`);
          if (opinion === undefined || opinion <= RIVALRY || !alive.has(helps)) continue;
          if (
            !best ||
            r.level > best.level ||
            (r.level === best.level &&
              (w.ref < best.war || (w.ref === best.war && helps < best.helps)))
          )
            best = { war: w.ref, helps, foe: r.of, level: r.level };
        }
      }
    if (!best) continue;
    const sends = r4(backingOf(f.footing, best.level)),
      helped = next.get(best.helps);
    if (!(sends > 0) || !helped) continue;
    f.backs = best.war;
    f.helps = best.helps;
    f.sends = sends;
    const theirs = Math.max(1, made.get(best.helps) ?? 0);
    helped.gift = r4(
      Math.min(ARMING.giftMost, helped.gift + (sends * (made.get(p.ref) ?? 0)) / theirs),
    );
    // (Told once, as it begins: the foe remembers who armed its enemy, and the one helped remembers it too.)
    if (was?.backs !== best.war) {
      const foe = realms.get(best.foe)!,
        friend = realms.get(best.helps)!;
      f.backed = world.events.emit({
        type: ARMING_EVENTS.backed.type,
        subjects: [p.ref, friend.ref, foe.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [{ ref: wars.get(best.war)!.event, role: "trigger", weight: 1 }],
        data: {
          a: realmName(p),
          b: realmName(friend),
          foe: realmName(foe),
          sends,
          fear: best.level,
        },
      });
      diplomacy.remember(p.ref, foe.ref, {
        name: "arms sent to their foe",
        value: -0.2,
        year,
        source: f.backed,
      });
      diplomacy.remember(p.ref, friend.ref, {
        name: "arms sent in their war",
        value: 0.15,
        year,
        source: f.backed,
      });
    }
  }
  // 3. Races: two realms each arming against the other, both past the line. Told once as it begins; let go when either stands down.
  for (const p of living) {
    const f = next.get(p.ref)!,
      q = f.against ? next.get(f.against) : undefined,
      racing = !!q && q.against === p.ref && f.footing >= ARMING.race && q.footing >= ARMING.race,
      easing =
        !q || q.against !== p.ref || f.footing < ARMING.race / 2 || q.footing < ARMING.race / 2;
    if (f.race && easing) f.race = null;
    if (racing && !f.race && !q!.race && p.ref < q!.realm) {
      const other = realms.get(q!.realm)!,
        e = world.events.emit({
          type: ARMING_EVENTS.race.type,
          subjects: [p.ref, other.ref],
          place: ctx.provinces.get(p.seat)?.ref ?? null,
          causes: [],
          data: {
            a: realmName(p),
            b: realmName(other),
            footing: [f.footing, q!.footing],
          },
        });
      f.race = e;
      q!.race = e;
    }
  }
  // 4. Kept for every living realm: what it can spare and has at stake is what its levy reads (sim/war/war.ts fieldShare).
  for (const p of living) store.set(next.get(p.ref)!);
}
