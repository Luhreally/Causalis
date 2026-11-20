// Interest groups (docs/architecture §21): within a realm, those who live alike want
// alike — the farmers (and those who still gather), the herders, the crafters, the
// traders, the court (those who lead), where the seat holds a faith, the temple, and its
// army (Phase 22 M145: its guard, its levy, its standing army; heard above all under a
// general, and wanting its pay and war on those its realm resents).
// Each holds sway by its numbers and its wealth, weighed by the realm's institutions:
// an assembly hears the many, a council of elders the few who lead, a priest-king the
// temple. Each makes demands that rest on something in the world — lighter tribute
// after a famine, peace with the realms they trade with, more tribute while the realm
// is at war, war on unbelievers across the border. The seat's decisions (its tithe,
// its wars) read those demands as factors, so their why runs through the people who
// pressed them, and on to what moved those people.
import { YEAR, type Ref, type SimTime } from "../../kernel/index.ts";
import { GOODS, HOLD, OCC, templeSway } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { pulpitIn } from "../belief/temple.ts";
import type { WarStore } from "../war/war.ts";
import { TRADE_TIE, diplomacyOf, tradeTie } from "../diplomacy/diplomacy.ts";
import { armyOf, strifeOf } from "../strife/strife.ts";
import { GENERAL, LAW, politiesOf, type Polity } from "./polity.ts";
import { holdOf } from "../order/holds.ts";

export const GROUPS = [
  "farmers",
  "herders",
  "crafters",
  "traders",
  "the court",
  "the temple",
  "the army",
] as const;
export type Group = (typeof GROUPS)[number];

/** What a group wants, how much, of whom (a realm, for peace or war), and what it rests on. */
export type Demand = {
  readonly group: Group;
  readonly want: "lighter tribute" | "more tribute" | "peace" | "war";
  readonly name: string;
  readonly strength: number;
  readonly toward: Ref | null;
  readonly source: Ref | null;
};

export type Interest = {
  readonly group: Group;
  /** Its share of the realm's sway, 0..1 (the groups' shares sum to one). */
  readonly sway: number;
  readonly people: number;
  readonly demands: readonly Demand[];
};

/**
 * The most of a realm's sway those who keep its arms hold where it keeps them all (force 1), and the most its temple holds
 * where every one of its people is devout and its law is sacred: what is left is carried by its choices, by how widely.
 */
export const SWAY_OF = { arms: 0.4, faith: 0.4 } as const;

/**
 * Each group's sway in a realm, read off who holds which powers (rules/holds.ts) and not off a named kind of rule: those
 * who keep its arms hold as much as it keeps them from its people (force); the temple as much as its people are devout and
 * its law sacred; and the rest is carried by its choices, the court's (those who lead) as much as they are carried by few,
 * the many's as much as by many (voice), each head of them by what its year of work is worth (`wealth`: a wage a head, by
 * group; where the many have no say, only wealth buys it). Shares summing to one.
 */
export function swayOf(
  people: Readonly<Record<Exclude<Group, "the temple">, number>>,
  held: readonly number[],
  piety: number,
  faith: boolean,
  sacred: boolean,
  wealth: Readonly<Partial<Record<Exclude<Group, "the temple">, number>>> = {},
  /** How far the seat's faith has the houses to speak for its piety (rules/temple.ts templeSway; 1: wholly). */
  houses = 1,
): Record<Group, number> {
  const force = held[0] ?? 0.5,
    voice = held[1] ?? 0.5,
    arms = people["the army"] > 0 ? SWAY_OF.arms * force : 0,
    temple = faith
      ? SWAY_OF.faith * Math.max(0, piety - 0.35) * (sacred ? 1 : 0.5) * Math.max(0, houses)
      : 0,
    rest = Math.max(0, 1 - arms - temple),
    court = people["the court"] > 0 ? rest * (1 - voice) : 0,
    many = rest - court,
    commons = ["farmers", "herders", "crafters", "traders"] as const,
    // (A head's weight among the many: an equal one as far as its choices are carried by all, the rest by its wealth.)
    mean =
      commons.reduce((s, g) => s + people[g] * (wealth[g] ?? 1), 0) /
      Math.max(
        1,
        commons.reduce((s, g) => s + people[g], 0),
      ),
    weight = (g: (typeof commons)[number]) =>
      people[g] * (voice + (1 - voice) * ((wealth[g] ?? 1) / Math.max(1e-9, mean))),
    all = commons.reduce((s, g) => s + weight(g), 0),
    raw: Record<Group, number> = {
      farmers: 0,
      herders: 0,
      crafters: 0,
      traders: 0,
      "the court": court,
      "the army": arms,
      "the temple": temple,
    };
  for (const g of commons) raw[g] = all > 0 ? (many * weight(g)) / all : 0;
  const total = GROUPS.reduce((s, g) => s + raw[g], 0);
  for (const g of GROUPS) raw[g] = total > 0 ? raw[g] / total : 0;
  return raw;
}

/**
 * Of what a year of the many's work is worth over a realm's lands (each head by its wage, as its markets paid it), the share
 * that is its crafters' and traders' (0 … 1): wealth made away from the fields, which a seat that rules alone needs and has
 * no hold over. Nothing where no land of it has a market. Only reads.
 */
export function makersWorth(ctx: PopulationContext, p: Polity): number {
  const markets = ctx.world.store<MarketStore>("economy.markets");
  let makers = 0,
    all = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c),
      w = prov ? markets.wagesOf(c) : undefined;
    if (!prov || !w) continue;
    const made =
      prov.occupation(OCC.crafter) * (w[OCC.crafter] ?? 0) +
      prov.occupation(OCC.trader) * (w[OCC.trader] ?? 0);
    makers += made;
    all +=
      made +
      prov.occupation(OCC.farmer) * (w[OCC.farmer] ?? 0) +
      prov.occupation(OCC.herder) * (w[OCC.herder] ?? 0);
  }
  return all > 0 ? makers / all : 0;
}

type Count = Record<Exclude<Group, "the temple">, number>;
/** Of a reading's marks, the first that say whose lands and what trade and roads were read; the one after, its relations. */
const ACROSS = 4;
const COMMONS = ["farmers", "herders", "crafters", "traders"] as const;

/**
 * All a realm's interests are read from, but what lies across its borders: its own lands' people by their work and what the
 * year's work paid them, their last famines, how it is ruled (who leads, its law, its tithe, who holds its arms and its
 * choices, whether an army took its seat), its seat's ways and faith and that faith's houses, its army, its wars; and how its
 * relations, the year's trade and the roads stand (their stores' counts of writes). `mark` is every one of them in a fixed
 * order: two readings with the same marks weigh the same.
 */
type Reading = {
  readonly mark: unknown[];
  /** Its people who farm (and gather), herd, craft, trade, lead, and its army; the first four's pay summed, and their heads. */
  readonly count: readonly number[];
  readonly paid: readonly number[];
  readonly heads: readonly number[];
  readonly famines: readonly (Ref | null)[];
  readonly force: number;
  readonly voice: number;
  readonly piety: number;
  readonly valour: number;
  readonly seatFaith: ReturnType<ReturnType<typeof beliefOf>["of"]>;
  readonly pulpit: number;
  readonly sacred: boolean;
  readonly atWar: ReturnType<WarStore["fighting"]>;
  readonly junta: Ref | null;
  /** What its lands used in the year, all goods in grain's worth. */
  readonly used: number;
};

function readingOf(ctx: PopulationContext, p: Polity): Reading {
  const { world } = ctx,
    markets = world.store<MarketStore>("economy.markets"),
    ways = cultureOf(world).get(p.seat),
    piety = ways?.traits[WAY.piety] ?? 0.5,
    valour = ways?.traits[WAY.valour] ?? 0.5,
    seatFaith = beliefOf(world).of(p.seat),
    // (Read here, not at load: this module and the realms' import each other.)
    sacred = p.law === LAW.indexOf("the sacred"),
    force = holdOf(world, p.ref, HOLD.force),
    voice = holdOf(world, p.ref, HOLD.voice),
    pulpit = pulpitIn(world, p.seat),
    atWar = world.hasStore("war.wars") ? world.store<WarStore>("war.wars").fighting(p.ref) : [],
    junta = strifeOf(world)?.junta(p.ref)?.event ?? null,
    army = armyOf(ctx, p).people,
    famines: (Ref | null)[] = [];
  // (Its people by their work, and what a year of each group's work is worth over its lands: OCC's wages, as its markets
  // paid them, by the heads of the lands that have a market. Asked at every asking: plain sums, no lists.)
  let farmers = 0,
    herders = 0,
    crafters = 0,
    traders = 0,
    court = 0,
    paidF = 0,
    paidH = 0,
    paidC = 0,
    paidT = 0,
    headsF = 0,
    headsH = 0,
    headsC = 0,
    headsT = 0,
    // (What its lands used in the year, in grain's worth: what its trade with another is weighed against, see `want` below.)
    used = 0;
  for (const c of p.members) {
    const m = markets.get(c);
    if (m) for (let k = 0; k < GOODS.length; k++) used += m.book("used", k) * GOODS[k]!.value;
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    const f = prov.occupation(OCC.farmer),
      h = prov.occupation(OCC.herder),
      k = prov.occupation(OCC.crafter),
      tr = prov.occupation(OCC.trader);
    farmers += f + prov.occupation(OCC.forager);
    herders += h;
    crafters += k;
    traders += tr;
    court += prov.occupation(OCC.leader);
    famines.push(prov.lastFamine);
    const w = markets.wagesOf(c);
    if (!w) continue;
    paidF += f * (w[OCC.farmer] ?? 0);
    paidH += h * (w[OCC.herder] ?? 0);
    paidC += k * (w[OCC.crafter] ?? 0);
    paidT += tr * (w[OCC.trader] ?? 0);
    headsF += f;
    headsH += h;
    headsC += k;
    headsT += tr;
  }
  const mark: unknown[] = [
    // (ACROSS of them say how what lies across its borders was read, the next its relations: interestsNow.)
    p.members,
    markets.flows,
    markets.flows.length,
    markets.roadsOpened,
    diplomacyOf(world).writtenOf(p.ref),
    p.seat,
    p.leadership,
    p.law,
    p.tribute,
    p.tithed,
    p.event,
    junta,
    force,
    voice,
    piety,
    valour,
    seatFaith.faith,
    seatFaith.event,
    pulpit,
    atWar.length,
    atWar[0]?.event,
    // (Whether it keeps an army at all: its count moves with its people through a year, and is told as it stands, interestsOf.)
    army > 0,
    farmers,
    herders,
    crafters,
    traders,
    court,
    paidF,
    paidH,
    paidC,
    paidT,
    headsF,
    headsH,
    headsC,
    headsT,
    used,
  ];
  for (const f of famines) mark.push(f);
  return {
    mark,
    count: [farmers, herders, crafters, traders, court, army],
    paid: [paidF, paidH, paidC, paidT],
    heads: [headsF, headsH, headsC, headsT],
    famines,
    force,
    voice,
    piety,
    valour,
    seatFaith,
    pulpit,
    sacred,
    atWar,
    junta,
    used,
  };
}

type Rival = { readonly q: Polity; readonly opinion: number; readonly source: Ref | null };
/**
 * What is kept of a realm's weighing: all it was read from; what it found across its borders (those it trades with, in the
 * order of their refs, its neighbours and their seats' faiths, the neighbour it resents most: not looked for, undefined) and
 * its lands' freshest famine, each of which stands while its own part of the marks does; and the weighing.
 */
type Weighed = {
  readonly mark: readonly unknown[];
  readonly trade: readonly (readonly [Ref, { worth: number; road: Ref | null }])[];
  readonly near: readonly Polity[];
  readonly theirs: readonly (Ref | null)[];
  readonly rival: Rival | null | undefined;
  readonly famine: Ref | null;
  /** Its army's count as the interests kept tell it. */
  readonly army: number;
  readonly interests: readonly Interest[];
};

/**
 * A realm's interest groups now: their sway and their demands, each resting on its source. Weighed once a moment for a realm as it
 * stands: a dozen of a year's systems ask it of every realm, and weighed afresh for each it was a twentieth of a year at
 * 1,500. What is kept is kept by ALL it was read from (`Reading`'s marks, read again at each asking; its neighbours' seats'
 * faiths), and let go for every realm at a border where a land changed hands or that trades with it: a seat seized, a law
 * changed, a tithe raised, men lost in a battle are seen by whoever asks next in the same moment. (Kept by moment, lands, wars
 * and seat alone, a coup of the year was not seen by what asked after it that year, nor a hand's act by a page opened at rest.)
 * Kept by the realms' own store, never past the moment, and let go on loading.
 */
export function interestsOf(ctx: PopulationContext, p: Polity, t: SimTime): readonly Interest[] {
  const { world } = ctx,
    realms = politiesOf(world);
  let memo = realms.weighed;
  if (!memo || memo.t !== t) realms.weighed = memo = { t, by: new Map(), moved: [] };
  if (memo.moved.length) {
    // (A land that changed hands: whoever holds it or a land beside it now, or trades with it, read who held it.)
    const { grid } = ctx.generated,
      markets = world.store<MarketStore>("economy.markets"),
      by = memo.by,
      drop = (c: number) => {
        const r = realms.of(c);
        if (r) by.delete(r.ref);
      };
    for (const c of memo.moved) {
      drop(c);
      for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) drop(grid.neighbours[k]!);
      for (const f of markets.flowsOf([c])) {
        drop(f.from);
        drop(f.to);
      }
    }
    memo.moved.length = 0;
  }
  const reading = readingOf(ctx, p),
    had = memo.by.get(p.ref) as Weighed | undefined;
  if (had && sameMarks(had.mark, reading.mark)) {
    const faiths = beliefOf(world);
    let same = true;
    for (let i = 0; i < had.near.length && same; i++)
      same = faiths.of(had.near[i]!.seat).faith === had.theirs[i];
    if (same) {
      // (Its army's count alone moved, as its people did: nothing is weighed by it but that there is an army, so the same
      // weighing with the count as it stands. Weighed again for it, 170 of a year's 410 weighings at 1,500 were the count's.)
      const army = reading.count[5]!;
      if (had.army === army) return had.interests;
      const interests = had.interests.map((i) =>
        i.group === "the army" ? { ...i, people: army } : i,
      );
      memo.by.set(p.ref, { ...had, army, interests });
      return interests;
    }
  }
  const weighed = interestsNow(ctx, p, t, reading, had);
  memo.by.set(p.ref, weighed);
  return weighed.interests;
}

function sameMarks(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * The weighing, of a reading. `had`: the realm's last this moment, where it has one whose marks differ (a land changed hands at
 * its borders: none). What it found across the borders is found again only where those marks moved: most of a weighing, and a
 * realm whose army's count or tithe alone moved in the year is weighed again from its sums.
 */
function interestsNow(
  ctx: PopulationContext,
  p: Polity,
  t: SimTime,
  reading: Reading,
  had: Weighed | undefined,
): Weighed {
  const { world, generated: g } = ctx,
    faiths = beliefOf(world),
    { mark, paid, heads, piety, valour, seatFaith, sacred, atWar } = reading,
    count: Count = {
      farmers: reading.count[0]!,
      herders: reading.count[1]!,
      crafters: reading.count[2]!,
      traders: reading.count[3]!,
      "the court": reading.count[4]!,
      "the army": reading.count[5]!,
    };
  let across = had !== undefined;
  for (let i = 0; i < ACROSS && across; i++) across = had!.mark[i] === mark[i];
  let sameFamines = across && had!.mark.length === mark.length;
  for (let i = mark.length - reading.famines.length; i < mark.length && sameFamines; i++)
    sameFamines = had!.mark[i] === mark[i];
  let famine: Ref | null = sameFamines ? had!.famine : null;
  if (!sameFamines) {
    let faminAt = -Infinity;
    for (const last of reading.famines) {
      const f = last ? world.events.get(last) : undefined;
      if (f && t - f.t <= 3 * YEAR && f.t > faminAt) {
        famine = f.id;
        faminAt = f.t;
      }
    }
  }
  const wealth: Partial<Count> = {};
  COMMONS.forEach((group, i) => {
    if (heads[i]! > 0 && paid[i]! > 0) wealth[group] = paid[i]! / heads[i]!;
  });
  const sway = swayOf(
    count,
    [reading.force, reading.voice],
    piety,
    seatFaith.faith !== null,
    sacred,
    wealth,
    // (The temple weighs as far as its faith's clergy are many to its faithful: sim/belief/temple.ts.)
    templeSway(reading.pulpit),
  );

  // The realms it meets: those it trades with (and down which road), and those of another faith.
  // (Only the flows out of or into its own lands can be its trade: a land is a realm's only
  // while among its members.)
  let trade = across ? had!.trade : null,
    near = across ? had!.near : null;
  if (!trade || !near) {
    const realms = politiesOf(world),
      markets = world.store<MarketStore>("economy.markets"),
      met = new Map<Ref, { worth: number; road: Ref | null }>();
    for (const i of markets.flowsAt(p.members)) {
      const f = markets.flows[i]!,
        from = realms.of(f.from),
        to = realms.of(f.to);
      if (!from || !to || from === to || (from !== p && to !== p)) continue;
      const other = from === p ? to : from,
        tr = met.get(other.ref) ?? { worth: 0, road: null };
      tr.worth += markets.boundAt(i) * GOODS[f.good]!.value;
      tr.road ??= markets.route(f.from, f.to) ?? null;
      met.set(other.ref, tr);
    }
    trade = [...met.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const neighbours = new Set<Polity>();
    for (const c of p.members)
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
        const q = realms.of(g.grid.neighbours[k]!);
        if (q && q !== p && q.ended === null) neighbours.add(q);
      }
    near = [...neighbours].sort((a, b) => (a.ref < b.ref ? -1 : 1));
  }
  // (The neighbour its realm resents most, and what their rivalry rests on most: looked for only where it has an army.)
  let rival = across && had!.mark[ACROSS] === mark[ACROSS] ? had!.rival : undefined;

  const demands: Demand[] = [];
  const want = (d: Omit<Demand, "strength"> & { strength: number }) => {
    if (d.strength > 0.02) demands.push({ ...d, strength: Math.min(1, d.strength) });
  };
  // Those who work the land: lighter tribute — the more after a famine; else it rests on
  // the tithe they bear (its last raising, if it was raised).
  for (const group of ["farmers", "herders"] as const)
    want({
      group,
      want: "lighter tribute",
      name: `${group} want lighter tribute`,
      strength: (p.tribute * 5 + (famine ? 0.6 : 0)) * (group === "herders" ? 0.6 : 1),
      toward: null,
      source: famine ?? p.tithed ?? null,
    });
  // Traders (and crafters, whose goods go down the roads): peace with those they trade with, as far as that trade is of their
  // own realm's living (sim/diplomacy/diplomacy.ts tradeTie's share: it stood as units of goods against a fixed 400).
  for (const [other, tr] of trade)
    for (const group of ["traders", "crafters"] as const)
      want({
        group,
        want: "peace",
        name: `${group} want peace with those they trade with`,
        strength:
          (tradeTie(tr.worth, reading.used) / TRADE_TIE.most) * (group === "crafters" ? 0.5 : 1),
        toward: other,
        source: tr.road,
      });
  // The court: more tribute, the more while the realm is at war.
  want({
    group: "the court",
    want: "more tribute",
    name: "the court wants more tribute",
    strength: 0.3 + (atWar.length ? 0.5 : 0),
    toward: null,
    source: atWar[0]?.event ?? p.event,
  });
  // The army: its pay — the more at war, the more again where it rules — and, the more where
  // its people prize valour and it rules, war on the neighbour its realm resents most (M145).
  if (count["the army"] > 0) {
    want({
      group: "the army",
      want: "more tribute",
      name: "the army wants its pay",
      strength: 0.2 + (atWar.length ? 0.3 : 0) + (p.leadership === GENERAL ? 0.3 : 0),
      toward: null,
      source: atWar[0]?.event ?? reading.junta ?? p.event,
    });
    if (rival === undefined) {
      const relations = diplomacyOf(world),
        worst = near
          .map((q) => ({ q, relation: relations.get(p.ref, q.ref) }))
          .filter((x) => (x.relation?.opinion ?? 0) < 0)
          .sort(
            (a, b) => a.relation!.opinion - b.relation!.opinion || (a.q.ref < b.q.ref ? -1 : 1),
          )[0];
      rival = worst
        ? {
            q: worst.q,
            opinion: worst.relation!.opinion,
            source:
              [...worst.relation!.terms]
                .filter((x) => x.value < 0 && x.source)
                .sort((x, y) => x.value - y.value || (x.name < y.name ? -1 : 1))[0]?.source ?? null,
          }
        : null;
    }
    if (rival)
      want({
        group: "the army",
        want: "war",
        name: "the army wants war on its rivals",
        strength:
          (valour - 0.4) *
          2 *
          Math.min(1, -2 * rival.opinion) *
          (p.leadership === GENERAL ? 1.5 : 1),
        toward: rival.q.ref,
        source: rival.source,
      });
  }
  // The temple: its tithe, and war on unbelievers across the border.
  if (seatFaith.faith) {
    want({
      group: "the temple",
      want: "more tribute",
      name: "the temple wants its tithe",
      strength: sacred ? 0.5 : 0.2,
      toward: null,
      source: seatFaith.event,
    });
    for (const q of near) {
      const theirs = faiths.of(q.seat).faith;
      if (!theirs || theirs === seatFaith.faith) continue;
      want({
        group: "the temple",
        want: "war",
        name: "the temple wants war on the unbelievers",
        strength: (piety - 0.5) * 2,
        toward: q.ref,
        source: seatFaith.event,
      });
    }
  }
  return {
    mark,
    trade,
    near,
    theirs: near.map((q) => faiths.of(q.seat).faith),
    rival,
    famine,
    army: count["the army"],
    interests: GROUPS.map((group) => ({
      group,
      sway: sway[group],
      people: group === "the temple" ? 0 : count[group],
      demands: demands.filter((d) => d.group === group),
    })),
  };
}

/** How hard a realm's groups press, weighed by their sway, for one kind of want (toward one realm, if given). */
export function pressure(
  interests: readonly Interest[],
  want: Demand["want"],
  toward: Ref | null = null,
): { total: number; strongest: (Demand & { sway: number }) | null } {
  let total = 0,
    strongest: (Demand & { sway: number }) | null = null;
  for (const i of interests)
    for (const d of i.demands) {
      if (d.want !== want || (toward !== null && d.toward !== toward)) continue;
      const w = i.sway * d.strength;
      total += w;
      if (!strongest || w > strongest.sway * strongest.strength) strongest = { ...d, sway: i.sway };
    }
  return { total, strongest };
}
