// Polities (docs/architecture §21): realms gathered around market towns. A realm
// forms where what the land spares can keep those who would lead, the likelier as its people
// keep to rank (FOUNDING); neighbours join it, the more readily the more alike their speech, the
// closer the road and the stronger the realm. Its institutions — who leads (a chief, a council
// of elders, an assembly, a priest-king), how rule passes (by birth, by choice, by acclaim),
// what law holds (custom, decree, the sacred) — are read off who holds which powers: at its
// founding, the force and voice of its people before any seat (foundingForm), thereafter its
// kept numbers and whose sway is greatest (formFromPowers), changing as those move.
// Members send a tithe of grain to the seat, as its interests and its ruler's temper ask.
// Discontent gathers from famine, tribute, distance and foreign speech; lands secede when it
// runs high. Rulers grow old and die; their successions follow the realm's rule, and break it
// where no choice binds the losers and arms lie in many hands (CONTEST). Every step is a
// decision whose factors cite what drove it.
import { inflationOf, intoxDependent, taxGrievance } from "../money/kept.ts";
import { idleChafesOf } from "../trade/kept.ts";
import { feastReliefOf } from "../society/kept.ts";
import { bearerOddsOf } from "../society/kept.ts";
import { streetGrievanceOf } from "../society/kept.ts";
import { strainIn } from "../society/strain-kept.ts";
import {
  YEAR,
  defineEventType,
  defineKind,
  defineStream,
  parseRef,
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
import {
  FOODS,
  G,
  HOLD,
  HOLDING,
  OCC,
  STRAIN,
  TEMPER,
  foundingHolds,
  slipsAway,
  temperCarries,
  temperOf,
  temperWords,
  type Temper,
} from "../../rules/index.ts";
import { pulpitIn } from "../belief/temple.ts";
import { mouths, spaceSteps, type PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf, type Ways } from "../culture/culture.ts";
import { bandOfAge } from "../hand/hand.ts";
import type { BeliefStore } from "../belief/belief.ts";
import type { LoreStore } from "../lore/lore.ts";
import { interestsOf, pressure } from "./interests.ts";
import { revolutionHolds } from "../strife/strife.ts";
import { holdOf, holdsOf, waysRead } from "../order/holds.ts";
import { courtClaimant, courtFollows } from "../court/court.ts";
import { claimAtDeath } from "../war/ties.ts";
import { heldAmongStars } from "../space/nation-store.ts";
import {
  LOCAL,
  localOf,
  localYear,
  putToPeople,
  setLocal,
  underEmergency,
} from "../order/charter.ts";
import { actOn, hazardBy, struckBy } from "../acts/person.ts";

export const POLITY = defineKind("pol", "realm", "minted");

export const POLITY_EVENTS = {
  formed: defineEventType("polity.formed", 6),
  joined: defineEventType("polity.joined", 3),
  seceded: defineEventType("polity.seceded", 5),
  // An ordinary succession is the realm's own story, kept while a ruler, a split or a
  // grievance cites it; the chronicle keeps the crises.
  succession: defineEventType("polity.succession", 3),
  split: defineEventType("polity.split", 6),
  reformed: defineEventType("polity.reformed", 5),
  ended: defineEventType("polity.ended", 5),
  tithe: defineEventType("polity.tithe", 3),
};

/** Who leads (a general only by the sword: Phase 22 M145). */
export const LEADERSHIP = [
  "chief",
  "council of elders",
  "assembly",
  "priest-king",
  "general",
] as const;
/** The general's rule, as a kind of rule (LEADERSHIP). */
export const GENERAL = 4;
/** How rule passes. */
export const SUCCESSION = ["by birth", "by choice", "by acclaim"] as const;
/** What law holds. */
export const LAW = ["custom", "decree", "the sacred"] as const;
/** What a realm is called, by who leads it. */
export const REALM_WORDS = [
  "chiefdom",
  "league",
  "commonwealth",
  "holy seat",
  "protectorate",
] as const;

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
  /** The realm it broke away from (a split, a rising, a revolt, a claim), if it did (M146). */
  from?: Ref;
};

/** A member land's grievance against its realm, and what caused the most of it. */
export type Discontent = { level: number; cause: Ref | null };

const FORM = defineStream("polity.form");
const JOIN = defineStream("polity.join");
const RULE = defineStream("polity.rule");

export class PolityStore implements StateStore {
  readonly name = "polity.states";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private list: Polity[] = [];
  /**
   * (Each realm's interests as weighed this moment, each kept with all it was read from: sim/polity/interests.ts. And the lands
   * that changed hands since, for it to let go what was read across their borders. Not state; let go on loading.)
   */
  weighed: {
    t: number;
    by: Map<string, unknown>;
    moved: number[];
  } | null = null;
  /** The same realms by ref. */
  private readonly byRef = new Map<string, Polity>();
  private readonly member = new Map<number, Ref>();
  /**
   * (The realm of each land that has one, as `member` and `byRef` give it, and the realms that have not ended, in the list's
   * order: asked tens of thousands of times a year, and found by ref and by sifting every realm that ever was they were a
   * hundredth of a late year. Not state: kept as lands join and leave, the living checked at each asking, made anew on loading.)
   */
  private readonly holder = new Map<number, Polity>();
  private alive: Polity[] | null = null;
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
    for (const c of p.members) {
      this.member.set(c, p.ref);
      this.holder.set(c, p);
    }
    this.alive = null;
    if (this.weighed) for (const c of p.members) this.weighed.moved.push(c);
  }

  all(): readonly Polity[] {
    return this.list;
  }

  living(): Polity[] {
    // (A realm is ended where it stands, sim/polity endRealm: one of those kept that has ended since, and they are sifted again.)
    let alive = this.alive;
    if (alive)
      for (let i = 0; i < alive.length; i++)
        if (alive[i]!.ended !== null) {
          alive = null;
          break;
        }
    alive ??= this.alive = this.list.filter((p) => p.ended === null);
    return alive.slice();
  }

  get(ref: Ref): Polity | undefined {
    return this.byRef.get(ref);
  }

  /** The realm a land belongs to, if any. */
  of(cell: number): Polity | undefined {
    const held = this.holder.get(cell);
    if (held) return held;
    const ref = this.member.get(cell);
    return ref ? this.get(ref) : undefined;
  }

  join(p: Polity, cell: number): void {
    p.members = [...p.members, cell].sort((a, b) => a - b);
    this.member.set(cell, p.ref);
    const kept = this.byRef.get(p.ref);
    if (kept) this.holder.set(cell, kept);
    else this.holder.delete(cell);
    this.weighed?.moved.push(cell);
  }

  /** A land leaves its realm; its grievance stays with it, and fades. */
  leave(p: Polity, cell: number): void {
    p.members = p.members.filter((c) => c !== cell);
    this.member.delete(cell);
    this.holder.delete(cell);
    this.former.set(cell, p.ref);
    this.weighed?.moved.push(cell);
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
    this.weighed = null;
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
    this.holder.clear();
    this.alive = null;
    for (const p of s.polities) {
      const copy = { ...p, members: [...p.members] };
      this.list.push(copy);
      this.byRef.set(copy.ref, copy);
      if (copy.ended === null)
        for (const c of copy.members) {
          this.member.set(c, copy.ref);
          this.holder.set(c, copy);
        }
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

/**
 * What being ruled from a seat of other people breeds of grievance in a land a year: by how far it counts the seat's people
 * strangers and how far its "us" reaches (sim/culture/folk.ts sets it); before any land has weighed who its own are, by how unlike
 * the seat's its speech is alone.
 */
let apartOf = (_world: World, _cell: number, foreign: number): number => 0.3 * foreign * foreign;
/** Set what a land's being of other people than its seat's breeds of grievance (sim/culture/folk.ts). */
export function readsApart(f: (world: World, cell: number, foreign: number) => number): void {
  apartOf = f;
}

export function politiesOf(world: World): PolityStore {
  return world.store<PolityStore>("polity.states");
}

/** Institutions: who leads, how rule passes, what law holds. */
export type Institutions = { leadership: number; succession: number; law: number };

/** How far ways must move past a threshold before a realm's institutions change. */
const SLACK = 0.05;

/**
 * A realm's rule read off who holds which powers (rules/holds.ts: force, voice), and whose sway is greatest among those who
 * do not choose by numbers (the court, the temple, those who keep its arms), not off its people's ways: one decides where its
 * choices are carried by few, a few in council where by more, an assembly where by many; where one decides and the temple
 * outweighs the court and the arms, a priest-king. Rule passes by choice where many choose, by acclaim where the arms are in
 * the people's hands, else by birth. Law is sacred where the temple outweighs the court and the arms, written where there is
 * writing and the seat's word is carried (by a host kept, or by many choosing), else custom. Given the rule a realm has, it
 * holds unless the numbers have moved clearly past what gave it (by SLACK). A general's rule is its own (M145): not read here.
 */
export function formFromPowers(
  held: readonly number[],
  sway: Readonly<Record<string, number>>,
  current: Institutions,
  canWrite: boolean,
): Institutions {
  const force = held[0] ?? 0.5,
    voice = held[1] ?? 0.5,
    // (A line eased in favour of what is: past it by SLACK to leave it.)
    past = (x: number, at: number, keeps: boolean, above = true) =>
      above ? x > at - (keeps ? SLACK : 0) : x < at + (keeps ? SLACK : 0),
    temple = sway["the temple"] ?? 0,
    others = Math.max(sway["the court"] ?? 0, sway["the army"] ?? 0),
    templeLeads = temple > others && temple > 0.1,
    leadership = past(voice, 0.6, current.leadership === 2)
      ? 2
      : past(voice, HOLDING.voiceMid, current.leadership === 1)
        ? 1
        : templeLeads
          ? 3
          : 0,
    succession = past(voice, 0.45, current.succession === 1)
      ? 1
      : past(force, 0.3, current.succession === 2, false)
        ? 2
        : 0,
    law = templeLeads
      ? 2
      : canWrite && (past(force, 0.5, current.law === 1) || voice >= 0.6)
        ? 1
        : 0;
  return { leadership, succession, law };
}

/** No rule yet: no line is eased in favour of what is. */
const UNRULED: Institutions = { leadership: -1, succession: -1, law: -1 };

/**
 * The rule a people raises at a seat (a realm founded, or raised of a split or a rising): read off who holds force and voice
 * among them (rules/holds.ts foundingHolds: how many lead for each head, rank, valour, their body), and whose word weighs most
 * among those who do not choose by numbers — those who lead, as far as their people keep to rank, against the temple, as far
 * as they are devout and their faith has clergy among them to speak for it (sim/belief/temple.ts pulpitIn) — by the same
 * reading a realm's reform makes of its kept numbers (formFromPowers). No line on its ways decides it.
 */
export function foundingForm(
  ctx: PopulationContext,
  cell: number,
  ways: Ways,
): Institutions & { readonly held: readonly [number, number] } {
  const world = ctx.world,
    prov = ctx.provinces.get(cell),
    grown = prov ? prov.total() - prov.occupation(OCC.dependent) : 0,
    leaders = prov && grown > 0 ? (100 * prov.occupation(OCC.leader)) / grown : HOLDING.leadersMid,
    held = foundingHolds(waysRead(ways), ctx.generated.life.people?.body, leaders, grown),
    faith = world.peek<BeliefStore>("belief.faiths")?.of(cell).faith ?? null,
    sway = {
      "the court": ways.traits[WAY.hierarchy]!,
      "the temple": faith ? FOUNDING.temple * ways.traits[WAY.piety]! * pulpitIn(world, cell) : 0,
      "the army": 0,
    };
  return {
    ...formFromPowers(held, sway, UNRULED, loreOf(world).effect(cell, "writing") > 0),
    held,
  };
}

/** A ruler's temper (rules/temper.ts): who they are, and their people's ways. Read, never kept. */
export function temperOfRuler(world: World, p: Polity): Temper {
  const w = cultureOf(world).get(p.seat);
  return temperOf(parseRef(p.ruler.event).b, p.ruler.born, {
    valour: w?.traits[WAY.valour] ?? 0.5,
    thrift: w?.traits[WAY.thrift] ?? 0.5,
    piety: w?.traits[WAY.piety] ?? 0.5,
  });
}

/**
 * How a realm comes to be at a market town (band to state): where those who would lead can be kept by what the land spares
 * (the first tithe of its grain, never below three months of its food, against a year's food for each who leads), and where its
 * people keep to rank. FOUNDING.rate a year where the tithe keeps its leaders once over at middling rank.
 */
export const FOUNDING = {
  /** The share of the year's grain a new seat asks (its first tribute). */
  tithe: 0.05,
  rate: 0.009,
  /** A land that keeps its leaders more than this many times over is no readier for it. */
  most: 2,
  /**
   * How far a devout people's piety weighs at a founding against its rank, where its faith has clergy among them (a priest's word
   * is heard by its flock as a chief's by his following, but the arms are the chief's).
   */
  temple: 0.85,
} as const;

/** At a ruler's death, how readily the throne is contested where no choice binds the losers and arms are in many hands. */
export const CONTEST = 0.1;

/** A government as a key: two realms with the same key are governed alike. */
export function governmentKey(p: Polity): string {
  return `${LEADERSHIP[p.leadership]} / ${SUCCESSION[p.succession]} / ${LAW[p.law]}`;
}

/** How far a realm's seat reaches each of its lands (0 … 1): sim/order/order.ts sets it at its loading; nothing before. */
let HELD: (ctx: PopulationContext, p: Polity) => ReadonlyMap<number, number> | null = () => null;
export function holdsLands(f: typeof HELD): void {
  HELD = f;
}

/** A realm's name: what it is, by who leads it now, and the town it is ruled from. */
export function realmName(p: { leadership: number; town: string }): string {
  return `the ${REALM_WORDS[p.leadership]} of ${p.town}`;
}

/** Steps from the seat to every member, over the realm's own land and the sea its ships have crossed. */
export function reach(ctx: PopulationContext, p: Polity): Map<number, number> {
  return stepsFrom(ctx, p.seat, new Set(p.members));
}

/** A crossing of the sea is as far to rule over as two steps by land. */
export const SEA_CROSSING = 2;

/**
 * How many steps each of `lands` lies from `seat`, going only through `lands`: a step
 * to a neighbour by land, or SEA_CROSSING to a land its ships trade with.
 */
function stepsFrom(
  ctx: PopulationContext,
  seat: number,
  members: Set<number>,
): Map<number, number> {
  const g = ctx.generated,
    markets = ctx.world.store<MarketStore>("economy.markets"),
    d = new Map([[seat, 0]]),
    levels: number[][] = [[seat]];
  const visit = (n: number, far: number) => {
    if (!members.has(n) || (d.get(n) ?? Infinity) <= far) return;
    d.set(n, far);
    (levels[far] ??= []).push(n);
  };
  // Lands on other bodies are reached from the seat across space, as far as the crossing takes.
  for (const m of members) {
    const crossing = spaceSteps(ctx, seat, m);
    if (crossing !== null) visit(m, crossing);
  }
  for (let far = 0; far < levels.length; far++)
    for (const c of levels[far] ?? []) {
      if (d.get(c) !== far) continue;
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++)
        visit(g.grid.neighbours[k]!, far + 1);
      for (const n of markets.seaPartners(c)) visit(n, far + SEA_CROSSING);
    }
  return d;
}

function recent(world: World, ref: Ref | null, t: number): Ref | null {
  const e = ref ? world.events.get(ref) : undefined;
  return e && t - e.t <= YEAR ? e.id : null;
}

/** A new ruler: named in the realm's tongue, grown, keyed by the realm and the moment. */
export function crown(
  world: World,
  ways: Ways,
  seq: number,
  t: number,
  event: Ref,
  heir: string | null,
  /** When their people come of age: a ruler crowned is grown, however long that takes them. */
  grown: number,
): Ruler {
  const u = (n: number) => world.rng.real(RULE, seq, t, n),
    // (A bearer (0) by the odds its people's roles give one of them a seat: the society sweep, rules/roles.ts bearersRule. The same
    // keyed draw as ever, so no stream moves; even odds where no roles are kept.)
    sex = u(1) < bearerOddsOf(world, ways.cell) ? 0 : 1,
    given = tonguePersonName(ways.tongue, Math.floor(u(2) * 1e6), sex),
    family =
      heir ??
      tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ 0x51f7 }, Math.floor(u(3) * 1e6)),
    age = Math.max(25, grown) + Math.floor(u(4) * 25),
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
      leaders = p.occupation(OCC.leader);
    if (leaders <= 0) continue;
    // (What the land spares a seat: its first tithe of the year's grain, never below three months of its food, against a year's
    // food for each who would lead.)
    const m = markets.get(p.cell),
      made = m?.years.at(-1)?.ledger[0]?.[G.grain] ?? 0,
      spare = m ? Math.max(0, m.food(FOODS) - mouths(p, ctx.life) * 3) : 0,
      keeps = Math.min(
        FOUNDING.most,
        Math.min(spare, made * FOUNDING.tithe) / Math.max(1, leaders * 12 * ctx.life.appetite),
      ),
      chance = FOUNDING.rate * keeps * (0.5 + rank);
    if (!(chance > 0) || !(world.rng.real(FORM, p.cell, t, 0) < chance)) continue;
    const inst = foundingForm(ctx, p.cell, ways);
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
          name: "what the land spares a seat",
          value: keeps,
          contribution: keeps,
          source: null,
        },
        {
          name: "a people who keep to rank",
          value: rank,
          contribution: 0.5 + rank,
          source: ways.nudges.find((n) => n.trait === WAY.hierarchy)
            ? {
                ref: ways.nudges.find((n) => n.trait === WAY.hierarchy)!.event,
                role: "pressure",
                weight: 1,
              }
            : null,
        },
        { name: "leaders", value: leaders, contribution: 0, source: null },
        // (Who holds force and voice among them, which their rule is read off: foundingForm.)
        { name: "arms kept by those who lead", value: inst.held[0], contribution: 0, source: null },
        { name: "a choice carried by many", value: inst.held[1], contribution: 0, source: null },
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
      leadership: inst.leadership,
      succession: inst.succession,
      law: inst.law,
      ruler: crown(world, ways, p.cell, t, event, null, ctx.life.adulthood),
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
    // Neighbours by land, and lands its ships trade with across the sea.
    const near: [number, number][] = [];
    for (let k = g.grid.offsets[q.cell]!; k < g.grid.offsets[q.cell + 1]!; k++)
      near.push([g.grid.neighbours[k]!, 1]);
    for (const n of markets.seaPartners(q.cell)) near.push([n, SEA_CROSSING]);
    for (const [n, step] of near) {
      const p = store.of(n);
      if (!p || p.ended !== null) continue;
      // A realm reaches three steps from its seat, and further with writing, clerks and roads.
      if ((reach(ctx, p).get(n) ?? 99) + step > 3 + loreOf(world).effect(p.seat, "reach")) continue;
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
        // (And what its ruler would have, as far as its choices are carried by few: rules/temper.ts.)
        temper = temperOfRuler(world, p),
        greed =
          2 *
          TEMPER.tithe *
          (temper.grasping - 0.5) *
          temperCarries(holdOf(world, p.ref, HOLD.voice)),
        want = Math.round(
          100 * Math.min(0.15, Math.max(0.02, 0.05 + 0.2 * (up.total - down.total) + greed)),
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
      if (Math.abs(greed) >= 0.005)
        factors.push({
          name: temperWords("grasping", temper.grasping),
          value: temper.grasping,
          contribution: greed / 0.2,
          source: { ref: p.ruler.event, role: "pressure", weight: 1 },
        });
      const decision = world.decisions.record({
        rule: "polity.tithe",
        subject: p.ref,
        outcome: { from: now, to: want },
        score: up.total - down.total + greed / 0.2,
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
  const faiths = world.peek<BeliefStore>("belief.faiths") ?? null;
  for (const p of store.living()) {
    // (Round B: what its treasury takes beyond the tithe, and prices rising faster than what its people are paid catch up.)
    // (What it takes beyond what its people have borne for a generation, and a share of that: money/kept.ts taxGrievance.)
    const taxed = taxGrievance(world, p.ref),
      dearer = Math.max(0, inflationOf(world, p.ref)),
      // (Hands idle for want of buyers: sim/trade, p87.)
      idle = idleChafesOf(world, p.ref);
    const seatMarket = markets.of(p.seat),
      seatWays = culture.get(p.seat)!,
      steps = reach(ctx, p),
      // How far the seat can rule from: three steps, and further with writing, clerks and roads.
      rules = 3 + loreOf(world).effect(p.seat, "reach"),
      // (Far lands whose towns rule themselves chafe the less at a far seat: sim/order/charter.ts. Exactly 1 where none do.)
      near = 1 - LOCAL.eases * localOf(world, p.ref),
      // (This its year to read which far lands have towns to rule themselves: sim/order/charter.ts setLocal.)
      reading = localYear(p.ref, year);
    let farTowns = 0;
    for (const c of p.members) {
      // (A world of another star is held or not by the rule of the stars: Phase 72.)
      if (c === p.seat || heldAmongStars(world, c)) continue;
      const prov = ctx.provinces.get(c),
        m = markets.get(c),
        ways = culture.get(c);
      if (!prov || !m || !ways) continue;
      if (reading && (steps.get(c) ?? 0) >= LOCAL.steps) {
        let town = 0;
        for (const st of ctx.settlements.inProvince(c)) town = Math.max(town, st.population);
        if (town >= LOCAL.town) farTowns++;
      }
      // The tithe: a share of the year's grain, never below three months of their food.
      const made = m.years.at(-1)?.ledger[0]?.[G.grain] ?? 0,
        spare = Math.max(0, m.food(FOODS) - mouths(prov, ctx.life) * 3),
        tithe = Math.min(m.stock[G.grain]!, Math.floor(Math.min(spare, made * p.tribute)));
      if (tithe > 0) seatMarket.move("in", G.grain, m.move("out", G.grain, tithe));
      const before = store.discontent(c),
        famine = recent(world, prov.lastFamine, t),
        far = steps.get(c) ?? 3,
        foreign = 1 - tongueLikeness(ways.tongue, seatWays.tongue),
        // Ruled across space, word comes late: orders a crossing old, help a crossing away.
        crossing = spaceSteps(ctx, p.seat, c) ?? 0;
      // Grievance settles low in good years (it fades each year) and spikes with famine —
      // the more so under a priest-king of their own faith, whose favour has failed them.
      const shared = faiths?.of(c).faith ?? null,
        sacred = p.leadership === 3 && shared !== null && shared === faiths?.of(p.seat).faith,
        level =
          before.level +
          (famine ? (sacred ? 0.8 : 0.5) : 0) +
          p.tribute * 0.8 +
          taxed * 0.8 +
          // (Those who need what they take, and their kin who bear it.)
          intoxDependent(world, c) * 0.5 +
          Math.min(0.3, dearer * 0.5) +
          idle * 0.6 +
          near * 0.02 * far +
          // A land held beyond the seat's reach is ruled by force alone, and chafes.
          near * 0.08 * Math.max(0, far - rules) +
          // (Its people on the street, left there by the realm: the society sweep, society/roofless.ts. Exactly 0 where none is kept.)
          streetGrievanceOf(world, c) +
          // (A land worn by its years blames its seat the more: its strain, sim/society/strain.ts. Exactly 0 where none is kept.)
          STRAIN.grieves * strainIn(world, c) +
          apartOf(world, c, foreign) +
          0.02 * crossing -
          // (A people who feast together hold together: the society sweep, society/everyday.ts. Exactly 0 where none is kept; never
          // below no grievance at all.)
          Math.min(before.level, feastReliefOf(world, c));
      store.setDiscontent(c, {
        level,
        cause: famine ?? (crossing && prov.arrival ? prov.arrival : before.cause),
      });
    }
    if (reading) setLocal(ctx, p, farTowns);
  }

  // 4. Lands whose discontent runs high secede: the likelier the higher it runs, and as far as the seat's hand is not in the land
  // to hold it (rules/capacity.ts slipsAway; the seat's reach there, sim/order/order.ts reachOver: read once for a realm with a
  // land past the line).
  for (const p of store.living()) {
    let held: ReadonlyMap<number, number> | null | undefined;
    for (const c of [...p.members]) {
      if (c === p.seat || heldAmongStars(world, c)) continue;
      const d = store.discontent(c);
      if (d.level < 0.9) continue;
      if (held === undefined) held = HELD(ctx, p);
      const hand = held?.get(c) ?? 0;
      if (!(world.rng.real(JOIN, c, t, 7) < 0.15 * (d.level - 0.8) * slipsAway(hand))) continue;
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
          { name: "the seat's hand in the land", value: hand, contribution: -hand, source: null },
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
      band = bandOfAge(age, ctx.life);
    // (The god may have blessed or cursed them, or struck them down: exactly as ever where no act holds, sim/acts/person.ts.)
    const by = hazardBy(world, `rule:${p.ref}`, p.ruler.event, year),
      smite = actOn(world, `rule:${p.ref}`, p.ruler.event, year, "smite");
    if (!(world.rng.real(RULE, p.seat, t, 20) < ctx.life.mortality[band]! * by) && !smite) continue;
    const struck = smite
      ? struckBy(world, smite, p.ref, ctx.provinces.get(p.seat)!.ref, {
          realm: realmName(p),
          age,
        })
      : null;
    rulerDies(ctx, p, t, struck);
  }

  // 6. Institutions reform when who holds which powers has moved from them (rules/holds.ts; not a general's rule, which
  // ends only when it is restored: M145).
  if (year % 10 === 0)
    for (const p of store.living()) {
      if (p.leadership === GENERAL || revolutionHolds(world, p.ref, year)) continue;
      // (Powers taken past its people's say suspend its rule; they do not remake it: sim/order/charter.ts.)
      if (underEmergency(world, p.ref)) continue;
      const ways = culture.get(p.seat)!,
        sway: Record<string, number> = {};
      for (const i of interestsOf(ctx, p, t)) sway[i.group] = i.sway;
      const want = formFromPowers(
        holdsOf(world, p.ref),
        sway,
        p,
        loreOf(world).effect(p.seat, "writing") > 0,
      );
      if (
        want.leadership === p.leadership &&
        want.succession === p.succession &&
        want.law === p.law
      )
        continue;
      // (Under a charter, where its choices are carried by many, the change is put to its people: sim/order/charter.ts.)
      const asked = putToPeople(ctx, p, want, t);
      if (asked && !asked.passed) continue;
      const causes: CauseRef[] = ways.nudges
        .slice(0, 3)
        .map((n) => ({ ref: n.event, role: "pressure", weight: 0.3 }));
      causes.push({ ref: p.event, role: "enabler", weight: 0.1 });
      if (asked) causes.unshift({ ref: asked.event, role: "trigger", weight: 1 });
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

/**
 * A ruler dead: rule passes by the realm's rule, and sometimes breaks it (polityYear's step 5, and the god striking one down at the
 * moment of the act: sim/acts/person.ts). `struck`: the god's event their death stands on.
 */
export function rulerDies(ctx: PopulationContext, p: Polity, t: SimTime, struck: Ref | null): void {
  const { world } = ctx,
    store = politiesOf(world),
    culture = cultureOf(world),
    year = yearOfMoment(t),
    age = year - p.ruler.born;
  // Rule by birth passes to kin. At a death a realm's farthest lands may break away
  // together — the likelier the farther they lie from the seat and the more aggrieved
  // they are (rule by birth, fought over by kin, breaks more often).
  const ways = culture.get(p.seat)!,
    old = p.ruler,
    // (Its lands here: a world of another star goes by the rule of the stars.)
    near = p.members.filter((c) => !heldAmongStars(world, c)),
    steps = near.length > 3 ? reach(ctx, p) : null,
    far = steps ? Math.max(...near.map((c) => steps.get(c) ?? 0)) : 0,
    edge = steps ? near.filter((c) => (steps.get(c) ?? far) >= Math.max(1, far)) : [],
    unrest = edge.length
      ? edge.reduce((s, c) => s + store.discontent(c).level, 0) / edge.length
      : 0,
    // (A throne is contested where no choice binds those who lose it (its voice), where arms lie in many hands to back a rival
    // (its force), and, where rule passes by birth, the more as its people count kin first: many kin, many claims. Then by the
    // grievance of its far lands, and how far they lie.)
    held = holdsOf(world, p.ref),
    contest =
      CONTEST *
      (1 - held[HOLD.voice]!) *
      (0.5 + (1 - held[HOLD.force]!)) *
      (p.succession === 0 ? 0.5 + (ways.traits[WAY.kinship] ?? 0.5) : 1),
    crisis =
      !!steps &&
      world.rng.real(RULE, p.seat, t, 21) < contest + 0.25 * unrest + 0.02 * Math.max(0, far - 2),
    // (Whoever the court names takes the seat, unless a claim made at this hour carries it: Lives L5.)
    next = courtFollows(ctx, p, t);
  const event = world.events.emit({
    type: POLITY_EVENTS.succession.type,
    subjects: [p.ref],
    place: ctx.provinces.get(p.seat)!.ref,
    // Rule passes within the realm (its founding is why there is a throne to pass): each
    // succession stands on the realm, not on the one before, so a long line of ordinary
    // reigns is not kept whole for ever.
    causes: [
      { ref: p.event, role: "enabler", weight: 1 },
      ...(struck ? [{ ref: struck, role: "trigger" as const, weight: 1 }] : []),
    ],
    data: {
      name: realmName(p),
      old: old.name,
      age,
      ...(next ? { to: next.name, how: next.how, fig: next.fig } : {}),
    },
  });
  p.ruler = next
    ? { name: next.name, sex: next.sex, born: next.born, since: year, event }
    : crown(
        world,
        ways,
        p.seat,
        t,
        event,
        p.succession === 0 ? old.name.split(" ").slice(1).join(" ") : null,
        ctx.life.adulthood,
      );
  // (A house with no one left: someone of a marriage may come forward, and the realm may pass with them: D1.)
  const claim = claimAtDeath(ctx, p, old, event, next !== null, t);
  if (claim?.ruler) p.ruler = { ...claim.ruler, since: year, event };
  if (p.ended !== null) return;
  if (crisis && edge.length && edge.length < near.length) {
    // The lands farthest from the seat break away together, and their grievance is why; the one who wanted the seat leads them.
    const aggrieved = [...edge].sort(
        (x, y) => store.discontent(y).level - store.discontent(x).level || x - y,
      )[0]!,
      grievance = store.discontent(aggrieved).cause,
      claimant = courtClaimant(world, p, next?.fig);
    const split = world.events.emit({
      type: POLITY_EVENTS.split.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)!.ref,
      causes: [
        { ref: event, role: "trigger", weight: 0.6 },
        ...(grievance ? [{ ref: grievance, role: "pressure" as const, weight: 0.4 }] : []),
      ],
      data: {
        name: realmName(p),
        lands: edge.length,
        ...(claimant ? { by: claimant.name, fig: claimant.fig } : {}),
      },
    });
    for (const c of edge) store.leave(p, c);
    // Where a market town lies among them, they raise their own realm there under a
    // rival claimant; else each goes its own way.
    const town = edge
      .flatMap((c) => ctx.settlements.inProvince(c).filter((s) => s.market))
      .sort((x, y) => y.population - x.population || (x.ref < y.ref ? -1 : 1))[0];
    const raised = town ? raiseRealm(ctx, town, edge, split, t, p.ref) : null;
    if (raised && claimant)
      raised.ruler = {
        ...raised.ruler,
        name: claimant.name,
        sex: claimant.sex,
        born: claimant.born,
      };
  }
}

/**
 * A realm raised at a town under a new ruler, for what broke away (`cause`: a split, a
 * rising): it holds those of `lands` it can reach from its new seat; the rest go their own
 * way. Null where the town's land has no ways to found it on.
 */
export function raiseRealm(
  ctx: PopulationContext,
  town: { readonly ref: Ref; readonly name: string; readonly cell: number },
  lands: readonly number[],
  cause: Ref,
  t: SimTime,
  from?: Ref,
): Polity | null {
  const world = ctx.world,
    store = politiesOf(world),
    seatWays = cultureOf(world).get(town.cell);
  if (!seatWays) return null;
  const inst = foundingForm(ctx, town.cell, seatWays),
    ref = world.minter.mint(POLITY),
    name = realmName({ ...inst, town: town.name }),
    formed = world.events.emit({
      type: POLITY_EVENTS.formed.type,
      subjects: [ref, town.ref],
      place: ctx.provinces.get(town.cell)!.ref,
      causes: [{ ref: cause, role: "trigger", weight: 1 }],
      data: { name },
    });
  store.add({
    ref,
    town: town.name,
    seat: town.cell,
    founded: yearOfMoment(t),
    event: formed,
    members: [],
    leadership: inst.leadership,
    succession: inst.succession,
    law: inst.law,
    ruler: crown(world, seatWays, town.cell, t, formed, null, ctx.life.adulthood),
    tribute: 0.05,
    ended: null,
    ...(from ? { from } : {}),
  });
  // It holds what it can reach from its new seat; the rest go their own way.
  const theirs = stepsFrom(ctx, town.cell, new Set(lands)),
    limit = 3 + loreOf(world).effect(town.cell, "reach"),
    realm = store.get(ref)!;
  for (const c of lands) if ((theirs.get(c) ?? limit + 1) <= limit) store.join(realm, c);
  return realm;
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
