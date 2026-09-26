// Polities (docs/architecture §21): realms gathered around market towns. A realm
// forms where a people keep to rank or have leaders enough, around their market
// town; neighbours join it, the more readily the more alike their speech, the
// closer the road and the stronger the realm. Its institutions come from its
// founders' ways — who leads (a chief, a council of elders, an assembly, a
// priest-king), how rule passes (by birth, by choice, by acclaim), what law holds
// (custom, decree, the sacred) — and change when those ways drift from them.
// Members send a tithe of grain to the seat. Discontent gathers from famine,
// tribute, distance and foreign speech; lands secede when it runs high. Rulers
// grow old and die; their successions follow the realm's rule, and sometimes
// break it. Every step is a decision whose factors cite what drove it.
import {
  YEAR,
  defineEventType,
  defineKind,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { tongueLikeness, tongueName, tonguePersonName } from "../../gen/index.ts";
import { FOODS, G, HUMANLIKE, OCC } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf, type Ways } from "../culture/culture.ts";
import { bandOfAge } from "../hand/hand.ts";
import type { BeliefStore } from "../belief/belief.ts";

export const POLITY = defineKind("pol", "realm", "minted");

export const POLITY_EVENTS = {
  formed: defineEventType("polity.formed", 6),
  joined: defineEventType("polity.joined", 3),
  seceded: defineEventType("polity.seceded", 5),
  succession: defineEventType("polity.succession", 4),
  split: defineEventType("polity.split", 6),
  reformed: defineEventType("polity.reformed", 5),
  ended: defineEventType("polity.ended", 5),
};

/** Who leads. */
export const LEADERSHIP = ["chief", "council of elders", "assembly", "priest-king"] as const;
/** How rule passes. */
export const SUCCESSION = ["by birth", "by choice", "by acclaim"] as const;
/** What law holds. */
export const LAW = ["custom", "decree", "the sacred"] as const;
/** What a realm is called, by who leads it. */
export const REALM_WORDS = ["chiefdom", "league", "commonwealth", "holy seat"] as const;

export type Ruler = {
  readonly name: string;
  readonly sex: number;
  readonly born: number;
  readonly since: number;
  /** The event of their coming to rule. */
  readonly event: Ref;
};

export type Polity = {
  readonly ref: Ref;
  /** The seat's town: the realm is named for it. */
  readonly town: string;
  readonly seat: number;
  readonly founded: number;
  readonly event: Ref;
  members: number[];
  leadership: number;
  succession: number;
  law: number;
  ruler: Ruler;
  /** The share of each member's grain sent to the seat each year. */
  tribute: number;
  ended: number | null;
};

/** A member land's grievance against its realm, and what caused the most of it. */
export type Discontent = { level: number; cause: Ref | null };

const FORM = defineStream("polity.form");
const JOIN = defineStream("polity.join");
const RULE = defineStream("polity.rule");

export class PolityStore implements StateStore {
  readonly name = "polity.states";
  private list: Polity[] = [];
  private readonly member = new Map<number, Ref>();
  private readonly grievance = new Map<number, Discontent>();

  add(p: Polity): void {
    this.list.push(p);
    for (const c of p.members) this.member.set(c, p.ref);
  }

  all(): readonly Polity[] {
    return this.list;
  }

  living(): Polity[] {
    return this.list.filter((p) => p.ended === null);
  }

  get(ref: Ref): Polity | undefined {
    return this.list.find((p) => p.ref === ref);
  }

  /** The realm a land belongs to, if any. */
  of(cell: number): Polity | undefined {
    const ref = this.member.get(cell);
    return ref ? this.get(ref) : undefined;
  }

  join(p: Polity, cell: number): void {
    p.members = [...p.members, cell].sort((a, b) => a - b);
    this.member.set(cell, p.ref);
  }

  /** A land leaves its realm; its grievance stays with it, and fades. */
  leave(p: Polity, cell: number): void {
    p.members = p.members.filter((c) => c !== cell);
    this.member.delete(cell);
  }

  fadeGrievance(keep: number): void {
    for (const [c, d] of [...this.grievance.entries()]) {
      const level = d.level * keep;
      if (level < 0.02) this.grievance.delete(c);
      else this.grievance.set(c, { level, cause: d.cause });
    }
  }

  discontent(cell: number): Discontent {
    return this.grievance.get(cell) ?? { level: 0, cause: null };
  }

  setDiscontent(cell: number, d: Discontent): void {
    this.grievance.set(cell, d);
  }

  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const p of this.list) refs.push(p.event, p.ruler.event);
    for (const d of this.grievance.values()) if (d.cause) refs.push(d.cause);
    return refs;
  }

  hashInto(h: Hasher): void {
    h.value(this.list);
    h.value([...this.grievance.entries()].sort((a, b) => a[0] - b[0]));
  }

  save(): unknown {
    return {
      polities: this.list,
      grievance: [...this.grievance.entries()].sort((a, b) => a[0] - b[0]),
    };
  }

  load(state: unknown): void {
    const s = state as { polities: Polity[]; grievance: [number, Discontent][] };
    this.list = [];
    this.member.clear();
    for (const p of s.polities) {
      const copy = { ...p, members: [...p.members] };
      this.list.push(copy);
      if (copy.ended === null) for (const c of copy.members) this.member.set(c, copy.ref);
    }
    this.grievance.clear();
    for (const [c, d] of s.grievance) this.grievance.set(c, { ...d });
  }
}

export function politiesOf(world: World): PolityStore {
  return world.store<PolityStore>("polity.states");
}

/** Institutions from a people's ways: who leads, how rule passes, what law holds. */
type Institutions = { leadership: number; succession: number; law: number };

/** How far ways must move past a threshold before a realm's institutions change. */
const SLACK = 0.05;

/**
 * Institutions from a people's ways: who leads, how rule passes, what law holds.
 * Given the institutions a realm has, they hold unless the ways have moved clearly
 * past what gave them (by SLACK), so a realm does not reform at every flicker.
 */
export function institutionsOf(w: Ways, current?: Institutions): Institutions {
  const t = w.traits,
    // A threshold eased in favour of what is.
    over = (trait: number, at: number, keeps: boolean) => t[trait]! > at - (keeps ? SLACK : 0),
    priestly = current?.leadership === 3,
    leadership =
      over(WAY.piety, 0.58, priestly) && over(WAY.hierarchy, 0.5, priestly)
        ? 3
        : over(WAY.hierarchy, 0.54, current?.leadership === 0)
          ? 0
          : over(WAY.kinship, 0.52, current?.leadership === 1)
            ? 1
            : 2,
    succession = over(WAY.kinship, 0.52, current?.succession === 0)
      ? 0
      : over(WAY.openness, 0.5, current?.succession === 1)
        ? 1
        : 2,
    law = over(WAY.piety, 0.58, current?.law === 2)
      ? 2
      : over(WAY.tradition, 0.5, current?.law === 0)
        ? 0
        : 1;
  return { leadership, succession, law };
}

/** A government as a key: two realms with the same key are governed alike. */
export function governmentKey(p: Polity): string {
  return `${LEADERSHIP[p.leadership]} / ${SUCCESSION[p.succession]} / ${LAW[p.law]}`;
}

/** A realm's name: what it is, by who leads it now, and the town it is ruled from. */
export function realmName(p: { leadership: number; town: string }): string {
  return `the ${REALM_WORDS[p.leadership]} of ${p.town}`;
}

/** Steps over peopled land from the seat to every member (members only). */
function reach(ctx: PopulationContext, p: Polity): Map<number, number> {
  const g = ctx.generated,
    members = new Set(p.members),
    d = new Map([[p.seat, 0]]),
    queue = [p.seat];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!;
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (!d.has(n) && members.has(n)) {
        d.set(n, d.get(c)! + 1);
        queue.push(n);
      }
    }
  }
  return d;
}

function recent(world: World, ref: Ref | null, t: number): Ref | null {
  const e = ref ? world.events.get(ref) : undefined;
  return e && t - e.t <= YEAR ? e.id : null;
}

/** A new ruler: named in the realm's tongue, grown, keyed by the realm and the moment. */
function crown(
  world: World,
  ways: Ways,
  seq: number,
  t: number,
  event: Ref,
  heir: string | null,
): Ruler {
  const u = (n: number) => world.rng.real(RULE, seq, t, n),
    sex = u(1) < 0.5 ? 0 : 1,
    given = tonguePersonName(ways.tongue, Math.floor(u(2) * 1e6), sex),
    family =
      heir ??
      tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ 0x51f7 }, Math.floor(u(3) * 1e6)),
    age = 25 + Math.floor(u(4) * 25),
    year = yearOfMoment(t);
  return { name: `${given} ${family}`, sex, born: year - age, since: year, event };
}

/** The realms' year. */
export function polityYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = politiesOf(world),
    culture = cultureOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    year = yearOfMoment(t),
    provinces = ctx.provinces.all();
  const pop = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    power = (p: Polity) => p.members.reduce((s, c) => s + pop(c), 0);

  // 1. Realms form around market towns where people keep to rank or have leaders enough.
  for (const p of provinces) {
    if (store.of(p.cell)) continue;
    const town = ctx.settlements.inProvince(p.cell).find((s) => s.market),
      ways = culture.get(p.cell);
    if (!town || !ways) continue;
    const rank = ways.traits[WAY.hierarchy]!,
      leaders = p.occupation(OCC.leader),
      pull = Math.max(0, rank - 0.45) * 2 + Math.min(1, leaders / 60);
    const chance = 0.04 * pull;
    if (!(world.rng.real(FORM, p.cell, t, 0) < chance)) continue;
    const inst = institutionsOf(ways);
    const decision = world.decisions.record({
      rule: "polity.form",
      subject: p.ref,
      outcome: { seat: town.ref, leadership: LEADERSHIP[inst.leadership] },
      score: chance,
      threshold: 0,
      factors: [
        {
          name: "a market town to rule from",
          value: town.population,
          contribution: 0.5,
          source: { ref: town.market!, role: "enabler", weight: 1 },
        },
        {
          name: "a people who keep to rank",
          value: rank,
          contribution: Math.max(0, rank - 0.45) * 2,
          source: ways.nudges.find((n) => n.trait === WAY.hierarchy)
            ? {
                ref: ways.nudges.find((n) => n.trait === WAY.hierarchy)!.event,
                role: "pressure",
                weight: 1,
              }
            : null,
        },
        { name: "leaders", value: leaders, contribution: Math.min(1, leaders / 60), source: null },
      ],
    });
    const ref = world.minter.mint(POLITY),
      name = realmName({ ...inst, town: town.name });
    const event = world.events.emit({
      type: POLITY_EVENTS.formed.type,
      subjects: [ref, town.ref],
      place: p.ref,
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: { name },
    });
    store.add({
      ref,
      town: town.name,
      seat: p.cell,
      founded: year,
      event,
      members: [p.cell],
      ...inst,
      ruler: crown(world, ways, p.cell, t, event, null),
      tribute: 0.05,
      ended: null,
    });
  }

  // 2. Neighbours join: plans from the year's opening map, then made.
  const joins: {
    p: Polity;
    cell: number;
    via: number;
    like: number;
    road: boolean;
    strength: number;
    chance: number;
  }[] = [];
  for (const q of provinces) {
    if (store.of(q.cell) || !q.total()) continue;
    // A land still aggrieved will not bow to a realm.
    if (store.discontent(q.cell).level > 0.4) continue;
    const mine = culture.get(q.cell);
    if (!mine) continue;
    let best: (typeof joins)[number] | null = null;
    for (let k = g.grid.offsets[q.cell]!; k < g.grid.offsets[q.cell + 1]!; k++) {
      const n = g.grid.neighbours[k]!,
        p = store.of(n);
      if (!p || p.ended !== null) continue;
      if ((reach(ctx, p).get(n) ?? 99) >= 3) continue; // a realm reaches three steps from its seat
      const theirs = culture.get(p.seat)!,
        like = tongueLikeness(mine.tongue, theirs.tongue),
        road = !!markets.route(q.cell, n),
        strength = Math.min(3, power(p) / Math.max(1, 3 * q.total())),
        chance = 0.06 * like * like * (road ? 1.6 : 1) * strength;
      if (!best || chance > best.chance || (chance === best.chance && p.ref < best.p.ref))
        best = { p, cell: q.cell, via: n, like, road, strength, chance };
    }
    if (best && world.rng.real(JOIN, q.cell, t, 0) < best.chance) joins.push(best);
  }
  for (const j of joins) {
    if (store.of(j.cell)) continue;
    const decision = world.decisions.record({
      rule: "polity.join",
      subject: ctx.provinces.get(j.cell)!.ref,
      outcome: { realm: j.p.ref },
      score: j.chance,
      threshold: 0,
      factors: [
        { name: "alike speech", value: j.like, contribution: j.like, source: null },
        {
          name: "a road between them",
          value: j.road ? 1 : 0,
          contribution: j.road ? 0.4 : 0,
          source: j.road
            ? { ref: markets.route(j.cell, j.via)!, role: "enabler", weight: 1 }
            : null,
        },
        {
          name: "the realm's strength",
          value: j.strength,
          contribution: j.strength / 3,
          source: { ref: j.p.event, role: "pressure", weight: 1 },
        },
      ],
    });
    world.events.emit({
      type: POLITY_EVENTS.joined.type,
      subjects: [j.p.ref, ctx.provinces.get(j.cell)!.ref],
      place: ctx.provinces.get(j.cell)!.ref,
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: { name: realmName(j.p) },
    });
    store.join(j.p, j.cell);
  }

  // Grievance fades everywhere, in a realm or out of one.
  store.fadeGrievance(0.75);

  // 3. Tribute to the seat, and the discontent it and hard years breed.
  const faiths = world.storeNames().includes("belief.faiths")
    ? world.store<BeliefStore>("belief.faiths")
    : null;
  for (const p of store.living()) {
    const seatMarket = markets.of(p.seat),
      seatWays = culture.get(p.seat)!,
      steps = reach(ctx, p);
    for (const c of p.members) {
      if (c === p.seat) continue;
      const prov = ctx.provinces.get(c),
        m = markets.get(c),
        ways = culture.get(c);
      if (!prov || !m || !ways) continue;
      // The tithe: a share of the year's grain, never below three months of their food.
      const made = m.years.at(-1)?.ledger[0]?.[G.grain] ?? 0,
        spare = Math.max(0, m.food(FOODS) - prov.total() * 3),
        tithe = Math.min(m.stock[G.grain]!, Math.floor(Math.min(spare, made * p.tribute)));
      if (tithe > 0) seatMarket.move("in", G.grain, m.move("out", G.grain, tithe));
      const before = store.discontent(c),
        famine = recent(world, prov.lastFamine, t),
        far = steps.get(c) ?? 3,
        foreign = 1 - tongueLikeness(ways.tongue, seatWays.tongue);
      // Grievance settles low in good years (it fades each year) and spikes with famine —
      // the more so under a priest-king of their own faith, whose favour has failed them.
      const shared = faiths?.of(c).faith ?? null,
        sacred = p.leadership === 3 && shared !== null && shared === faiths?.of(p.seat).faith,
        level =
          before.level +
          (famine ? (sacred ? 0.8 : 0.5) : 0) +
          p.tribute * 0.8 +
          0.02 * far +
          0.3 * foreign * foreign;
      store.setDiscontent(c, { level, cause: famine ?? before.cause });
    }
  }

  // 4. Lands whose discontent runs high secede.
  for (const p of store.living()) {
    for (const c of [...p.members]) {
      if (c === p.seat) continue;
      const d = store.discontent(c);
      if (d.level < 0.9 || !(world.rng.real(JOIN, c, t, 7) < 0.15 * (d.level - 0.8))) continue;
      const prov = ctx.provinces.get(c)!;
      const decision = world.decisions.record({
        rule: "polity.secede",
        subject: prov.ref,
        outcome: { from: p.ref },
        score: d.level,
        threshold: 0.9,
        factors: [
          {
            name: "grievance",
            value: d.level,
            contribution: d.level,
            source: d.cause ? { ref: d.cause, role: "pressure", weight: 1 } : null,
          },
          { name: "tribute", value: p.tribute, contribution: p.tribute * 1.5, source: null },
        ],
      });
      world.events.emit({
        type: POLITY_EVENTS.seceded.type,
        subjects: [p.ref, prov.ref],
        place: prov.ref,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { name: realmName(p) },
      });
      store.leave(p, c);
    }
  }

  // 5. Rulers age and die; rule passes by the realm's rule, and sometimes breaks it.
  for (const p of store.living()) {
    const age = year - p.ruler.born,
      band = bandOfAge(age);
    if (!(world.rng.real(RULE, p.seat, t, 20) < HUMANLIKE.mortality[band]!)) continue;
    const ways = culture.get(p.seat)!,
      old = p.ruler,
      // Rule by birth passes to kin; a realm with far, discontented lands may break at a death.
      crisis =
        p.members.length > 3 &&
        world.rng.real(RULE, p.seat, t, 21) < (p.succession === 0 ? 0.12 : 0.05);
    const event = world.events.emit({
      type: POLITY_EVENTS.succession.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)!.ref,
      causes: [{ ref: old.event, role: "enabler", weight: 1 }],
      data: { name: realmName(p), old: old.name, age },
    });
    p.ruler = crown(
      world,
      ways,
      p.seat,
      t,
      event,
      p.succession === 0 ? old.name.split(" ").slice(1).join(" ") : null,
    );
    if (crisis) {
      // The lands farthest from the seat break away together.
      const steps = reach(ctx, p),
        far = Math.max(...p.members.map((c) => steps.get(c) ?? 0));
      const leaving = p.members.filter((c) => (steps.get(c) ?? far) >= Math.max(1, far));
      if (leaving.length && leaving.length < p.members.length) {
        world.events.emit({
          type: POLITY_EVENTS.split.type,
          subjects: [p.ref],
          place: ctx.provinces.get(p.seat)!.ref,
          causes: [{ ref: event, role: "trigger", weight: 1 }],
          data: { name: realmName(p), lands: leaving.length },
        });
        for (const c of leaving) store.leave(p, c);
      }
    }
  }

  // 6. Institutions reform when the seat's ways have drifted from them.
  if (year % 10 === 0)
    for (const p of store.living()) {
      const ways = culture.get(p.seat)!,
        want = institutionsOf(ways, p);
      if (
        want.leadership === p.leadership &&
        want.succession === p.succession &&
        want.law === p.law
      )
        continue;
      const causes: CauseRef[] = ways.nudges
        .slice(0, 3)
        .map((n) => ({ ref: n.event, role: "pressure", weight: 0.3 }));
      causes.push({ ref: p.event, role: "enabler", weight: 0.1 });
      world.events.emit({
        type: POLITY_EVENTS.reformed.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)!.ref,
        causes,
        data: {
          name: realmName(p),
          from: governmentKey(p),
          to: `${LEADERSHIP[want.leadership]} / ${SUCCESSION[want.succession]} / ${LAW[want.law]}`,
        },
      });
      p.leadership = want.leadership;
      p.succession = want.succession;
      p.law = want.law;
    }

  // 7. A realm whose seat is empty, or which has lost every land, ends.
  for (const p of store.living()) {
    if (pop(p.seat) > 0 && p.members.includes(p.seat)) continue;
    world.events.emit({
      type: POLITY_EVENTS.ended.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: [{ ref: p.event, role: "enabler", weight: 1 }],
      data: { name: realmName(p) },
    });
    for (const c of [...p.members]) store.leave(p, c);
    p.ended = year;
  }
}

/** Teach a peopled world its realms. */
export function installPolities(world: World, ctx: () => PopulationContext): PolityStore {
  const store = world.register(new PolityStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "170.polity.year", every: YEAR, run: (t) => polityYear(ctx(), t) });
  return store;
}
