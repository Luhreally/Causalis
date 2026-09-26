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
  type Factor,
  Hasher,
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
import type { LoreStore } from "../lore/lore.ts";
import { interestsOf, pressure } from "./interests.ts";

export const POLITY = defineKind("pol", "realm", "minted");

export const POLITY_EVENTS = {
  formed: defineEventType("polity.formed", 6),
  joined: defineEventType("polity.joined", 3),
  seceded: defineEventType("polity.seceded", 5),
  succession: defineEventType("polity.succession", 4),
  split: defineEventType("polity.split", 6),
  reformed: defineEventType("polity.reformed", 5),
  ended: defineEventType("polity.ended", 5),
  tithe: defineEventType("polity.tithe", 3),
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
  /** The event of its last change, if it has changed. */
  tithed?: Ref;
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
  /** The same realms by ref. */
  private readonly byRef = new Map<string, Polity>();
  private readonly member = new Map<number, Ref>();
  private readonly grievance = new Map<number, Discontent>();
  private readonly former = new Map<number, Ref>();
  /** Realms that ended are folded into a digest once, the year after, and not hashed again. */
  private digest = "";
  private readonly sealed = new Set<string>();

  /** Fold the realms that have ended into the digest (in ref order): they will not change again. */
  seal(): void {
    const ended = this.list
      .filter((p) => p.ended !== null && !this.sealed.has(p.ref))
      .sort((a, b) => (a.ref < b.ref ? -1 : 1));
    if (!ended.length) return;
    const h = new Hasher().string(this.digest);
    for (const p of ended) {
      h.value(p);
      this.sealed.add(p.ref);
    }
    this.digest = h.hex();
  }

  add(p: Polity): void {
    this.list.push(p);
    this.byRef.set(p.ref, p);
    for (const c of p.members) this.member.set(c, p.ref);
  }

  all(): readonly Polity[] {
    return this.list;
  }

  living(): Polity[] {
    return this.list.filter((p) => p.ended === null);
  }

  get(ref: Ref): Polity | undefined {
    return this.byRef.get(ref);
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
    this.former.set(cell, p.ref);
  }

  /** The realm a land last left, if any. */
  formerly(cell: number): Ref | null {
    return this.former.get(cell) ?? null;
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
    for (const p of this.list) {
      refs.push(p.event, p.ruler.event);
      if (p.tithed) refs.push(p.tithed);
    }
    for (const d of this.grievance.values()) if (d.cause) refs.push(d.cause);
    return refs;
  }

  hashInto(h: Hasher): void {
    h.string(this.digest).value(this.list.filter((p) => !this.sealed.has(p.ref)));
    h.value([...this.grievance.entries()].sort((a, b) => a[0] - b[0]));
    h.value([...this.former.entries()].sort((a, b) => a[0] - b[0]));
  }

  save(): unknown {
    return {
      polities: this.list,
      grievance: [...this.grievance.entries()].sort((a, b) => a[0] - b[0]),
      former: [...this.former.entries()].sort((a, b) => a[0] - b[0]),
      digest: this.digest,
      sealed: [...this.sealed].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    };
  }

  load(state: unknown): void {
    const s = state as {
      polities: Polity[];
      grievance: [number, Discontent][];
      former: [number, Ref][];
      digest?: string;
      sealed?: string[];
    };
    this.digest = s.digest ?? "";
    this.sealed.clear();
    for (const r of s.sealed ?? []) this.sealed.add(r);
    this.list = [];
    this.byRef.clear();
    this.member.clear();
    for (const p of s.polities) {
      const copy = { ...p, members: [...p.members] };
      this.list.push(copy);
      this.byRef.set(copy.ref, copy);
      if (copy.ended === null) for (const c of copy.members) this.member.set(c, copy.ref);
    }
    this.grievance.clear();
    for (const [c, d] of s.grievance) this.grievance.set(c, { ...d });
    this.former.clear();
    for (const [c, r] of s.former) this.former.set(c, r);
  }
}

/** The lore store, read without importing the lore module (which reads realms). */
function loreOf(world: World): LoreStore {
  return world.store<LoreStore>("lore.known");
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
export function institutionsOf(w: Ways, current?: Institutions, canWrite = true): Institutions {
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
    // Decree is written law: without writing, what is not sacred is custom.
    law = over(WAY.piety, 0.58, current?.law === 2)
      ? 2
      : over(WAY.tradition, 0.5, current?.law === 0) || !canWrite
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
  return stepsFrom(ctx, p.seat, new Set(p.members));
}

/** How many steps each of `lands` lies from `seat`, going only through `lands`. */
function stepsFrom(
  ctx: PopulationContext,
  seat: number,
  members: Set<number>,
): Map<number, number> {
  const g = ctx.generated,
    d = new Map([[seat, 0]]),
    queue = [seat];
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
    const chance = 0.02 * pull;
    if (!(world.rng.real(FORM, p.cell, t, 0) < chance)) continue;
    const inst = institutionsOf(ways, undefined, loreOf(world).effect(p.cell, "writing") > 0);
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
      // A realm reaches three steps from its seat, and further with writing and clerks.
      if ((reach(ctx, p).get(n) ?? 99) >= 3 + loreOf(world).effect(p.seat, "reach")) continue;
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
      data: { name: realmName(j.p), from: store.formerly(j.cell) },
    });
    store.join(j.p, j.cell);
  }

  // Grievance fades everywhere, in a realm or out of one.
  store.fadeGrievance(0.75);

  // The tithe, reconsidered every five years: the seat weighs what its people want — the
  // court and the temple more of it, those who work the land less — and sets it there.
  if (year % 5 === 0)
    for (const p of store.living()) {
      const interests = interestsOf(ctx, p, t),
        up = pressure(interests, "more tribute"),
        down = pressure(interests, "lighter tribute"),
        now = Math.round(p.tribute * 100),
        want = Math.round(
          100 * Math.min(0.15, Math.max(0.02, 0.05 + 0.2 * (up.total - down.total))),
        );
      // Only a real shift in what they want moves it (two parts in a hundred, or more).
      if (Math.abs(want - now) < 2) continue;
      const factors: Factor[] = interests
        .flatMap((i) =>
          i.demands
            .filter((d) => d.want === "more tribute" || d.want === "lighter tribute")
            .map((d) => ({ d, weight: i.sway * d.strength })),
        )
        .map(({ d, weight }) => ({
          name: d.name,
          value: d.strength,
          contribution: d.want === "more tribute" ? weight : -weight,
          source: d.source ? { ref: d.source, role: "pressure" as const, weight: 1 } : null,
        }));
      const decision = world.decisions.record({
        rule: "polity.tithe",
        subject: p.ref,
        outcome: { from: now, to: want },
        score: up.total - down.total,
        threshold: 0,
        factors,
      });
      p.tithed = world.events.emit({
        type: POLITY_EVENTS.tithe.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { name: realmName(p), from: now, to: want },
      });
      p.tribute = want / 100;
    }

  // 3. Tribute to the seat, and the discontent it and hard years breed.
  const faiths = world.storeNames().includes("belief.faiths")
    ? world.store<BeliefStore>("belief.faiths")
    : null;
  for (const p of store.living()) {
    const seatMarket = markets.of(p.seat),
      seatWays = culture.get(p.seat)!,
      steps = reach(ctx, p),
      // How far the seat can rule from: three steps, and further with writing and clerks.
      rules = 3 + loreOf(world).effect(p.seat, "reach");
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
          // A land held beyond the seat's reach is ruled by force alone, and chafes.
          0.08 * Math.max(0, far - rules) +
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
      const seceded = world.events.emit({
        type: POLITY_EVENTS.seceded.type,
        subjects: [p.ref, prov.ref],
        place: prov.ref,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { name: realmName(p) },
      });
      store.leave(p, c);
      cutOff(ctx, p, seceded);
    }
  }

  // 5. Rulers age and die; rule passes by the realm's rule, and sometimes breaks it.
  for (const p of store.living()) {
    const age = year - p.ruler.born,
      band = bandOfAge(age);
    if (!(world.rng.real(RULE, p.seat, t, 20) < HUMANLIKE.mortality[band]!)) continue;
    // Rule by birth passes to kin. At a death a realm's farthest lands may break away
    // together — the likelier the farther they lie from the seat and the more aggrieved
    // they are (rule by birth, fought over by kin, breaks more often).
    const ways = culture.get(p.seat)!,
      old = p.ruler,
      steps = p.members.length > 3 ? reach(ctx, p) : null,
      far = steps ? Math.max(...p.members.map((c) => steps.get(c) ?? 0)) : 0,
      edge = steps ? p.members.filter((c) => (steps.get(c) ?? far) >= Math.max(1, far)) : [],
      unrest = edge.length
        ? edge.reduce((s, c) => s + store.discontent(c).level, 0) / edge.length
        : 0,
      crisis =
        !!steps &&
        world.rng.real(RULE, p.seat, t, 21) <
          (p.succession === 0 ? 0.08 : 0.03) + 0.25 * unrest + 0.02 * Math.max(0, far - 2);
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
    if (crisis && edge.length && edge.length < p.members.length) {
      // The lands farthest from the seat break away together, and their grievance is why.
      const aggrieved = [...edge].sort(
          (x, y) => store.discontent(y).level - store.discontent(x).level || x - y,
        )[0]!,
        grievance = store.discontent(aggrieved).cause;
      const split = world.events.emit({
        type: POLITY_EVENTS.split.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)!.ref,
        causes: [
          { ref: event, role: "trigger", weight: 0.6 },
          ...(grievance ? [{ ref: grievance, role: "pressure" as const, weight: 0.4 }] : []),
        ],
        data: { name: realmName(p), lands: edge.length },
      });
      for (const c of edge) store.leave(p, c);
      // Where a market town lies among them, they raise their own realm there under a
      // rival claimant; else each goes its own way.
      const town = edge
        .flatMap((c) => ctx.settlements.inProvince(c).filter((s) => s.market))
        .sort((x, y) => y.population - x.population || (x.ref < y.ref ? -1 : 1))[0];
      const seatWays = town ? culture.get(town.cell) : undefined;
      if (town && seatWays) {
        const inst = institutionsOf(
            seatWays,
            undefined,
            loreOf(world).effect(town.cell, "writing") > 0,
          ),
          ref = world.minter.mint(POLITY),
          name = realmName({ ...inst, town: town.name }),
          formed = world.events.emit({
            type: POLITY_EVENTS.formed.type,
            subjects: [ref, town.ref],
            place: ctx.provinces.get(town.cell)!.ref,
            causes: [{ ref: split, role: "trigger", weight: 1 }],
            data: { name },
          });
        store.add({
          ref,
          town: town.name,
          seat: town.cell,
          founded: year,
          event: formed,
          members: [],
          ...inst,
          ruler: crown(world, seatWays, town.cell, t, formed, null),
          tribute: 0.05,
          ended: null,
        });
        // It holds what it can reach from its new seat; the rest go their own way.
        const theirs = stepsFrom(ctx, town.cell, new Set(edge)),
          limit = 3 + loreOf(world).effect(town.cell, "reach");
        for (const c of edge)
          if ((theirs.get(c) ?? limit + 1) <= limit) store.join(store.get(ref)!, c);
      }
    }
  }

  // 6. Institutions reform when the seat's ways have drifted from them.
  if (year % 10 === 0)
    for (const p of store.living()) {
      const ways = culture.get(p.seat)!,
        want = institutionsOf(ways, p, loreOf(world).effect(p.seat, "writing") > 0);
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
    endRealm(ctx, p, t, { ref: p.event, role: "enabler", weight: 1 });
  }
  // The realms that have ended will not change again: fold them into the digest.
  store.seal();
}

/** Lands no longer joined to their seat through the realm's own (the lands between were lost to `cause`) go their own way. */
export function cutOff(ctx: PopulationContext, p: Polity, cause: Ref): void {
  const world = ctx.world,
    store = politiesOf(world),
    linked = reach(ctx, p);
  for (const c of [...p.members]) {
    if (linked.has(c)) continue;
    const prov = ctx.provinces.get(c)!;
    const decision = world.decisions.record({
      rule: "polity.secede",
      subject: prov.ref,
      outcome: { from: p.ref },
      score: 1,
      threshold: 0,
      factors: [
        {
          name: "cut off from the seat",
          value: 1,
          contribution: 1,
          source: { ref: cause, role: "trigger", weight: 1 },
        },
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

/** A realm ends: its lands go free, and history records why. */
export function endRealm(ctx: PopulationContext, p: Polity, t: SimTime, cause: CauseRef): void {
  const store = politiesOf(ctx.world);
  ctx.world.events.emit({
    type: POLITY_EVENTS.ended.type,
    subjects: [p.ref],
    place: ctx.provinces.get(p.seat)?.ref ?? null,
    causes: [cause],
    data: { name: realmName(p) },
  });
  for (const c of [...p.members]) store.leave(p, c);
  p.ended = yearOfMoment(t);
}

/** Teach a peopled world its realms. */
export function installPolities(world: World, ctx: () => PopulationContext): PolityStore {
  const store = world.register(new PolityStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "170.polity.year", every: YEAR, run: (t) => polityYear(ctx(), t) });
  return store;
}
