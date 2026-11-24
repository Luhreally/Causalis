// A realm's laws (Phase 19 M139, asked for 2026-10-23: "law … rights … legal status … interest
// groups … ideologies … imperialism"): who owns the land — its lord, those who lease it, those
// who till it; what strangers are under it — subjects, the faithful, citizens; what its faith
// asks of other faiths — one faith, others tolerated, free conscience; and its justice — custom
// and vengeance, the ruler's courts, one law for all. What each group wants of each law is what
// each position would leave it, reckoned from its realm's own numbers (rules/lawgain.ts, the
// breadth round: before it, 84 numbers said so alike in every realm). A realm's first laws are
// those its groups and its people's ways would have; every ten years it weighs each law against
// what its interest groups gain by it, by their sway (the court's the less as its rule is
// doubted), what its movements and its people's ways push for, and how hard old ways hold. A law moves a step at a time, and each step
// is a decision whose factors cite what drove it. Laws do things (in the order's year): serfs
// bound under the lord's land and freed under the tiller's own; lands of another tongue or faith
// aggrieved as subjects or as unbelievers; captives seldom carried off where strangers are citizens;
// less skimmed under courts, and less again where one law holds for all; and a realm whose laws
// its powerful want stands the firmer for it.
import {
  defineEventType,
  parseRef,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
} from "../../kernel/index.ts";
import {
  GOODS,
  HOLD,
  OCC,
  TREASURY,
  clerkGains,
  lawGains,
  lawWritten,
  type LawFacts,
} from "../../rules/index.ts";
import { tongueLikeness } from "../../gen/index.ts";
import { mouths, type PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf, type Ways } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { loreOf } from "../lore/lore.ts";
import { LAW, politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { interestsOf, type Group } from "../polity/interests.ts";
import { capacityOf, type RealmOrder } from "./order.ts";
import { holdsOf } from "./holds.ts";
import { readersOf } from "../lore/letters.ts";
import {
  FISC,
  TREASURY_STORE,
  bindOf,
  deficitOf,
  moneyStore,
  refNumber,
  revenueOf,
} from "../money/kept.ts";
import { TEMPLE_ROW, TEMPLE_STORE, cultureRows } from "../culture/rows.ts";
import { whisperIn } from "../acts/person.ts";
import { pullOnLaw, schoolOver } from "../ideas/kept.ts";

export const LAWS = ["land", "strangers", "faith", "justice"] as const;
export type Law = (typeof LAWS)[number];
export const LAW_OF: Readonly<Record<Law, number>> = {
  land: 0,
  strangers: 1,
  faith: 2,
  justice: 3,
};

/** Each law's positions, the oldest order first. */
export const LAW_POSITIONS: Readonly<Record<Law, readonly [string, string, string]>> = {
  land: ["the lord's", "leased", "the tiller's own"],
  strangers: ["subjects", "the faithful", "citizens"],
  faith: ["one faith", "others tolerated", "free conscience"],
  justice: ["custom and vengeance", "the ruler's courts", "one law for all"],
};

export const LAW_EVENTS = {
  changed: defineEventType("order.law", 5),
  /** A reform its groups would have carried, held back by its clerks, whose offices it would close. */
  held: defineEventType("order.law-held", 3),
};

/** A realm weighs its laws once in this many years; a law moves when its next step is wanted this much more. */
export const LAW_EVERY = 10;
export const REFORM_LINE = 0.12;

/** What each group gains by each position of each law (-1 … 1), by law, group, position: rules/lawgain.ts. */
export type LawGainsTable = ReturnType<typeof lawGains>;

/**
 * All a realm's laws are weighed from (rules/lawgain.ts LawFacts), read off its lands: its people by what they live by and
 * what their work brought them, as its markets paid it; what keeps a worker; its lands of another tongue or faith than its
 * seat's, by their people; its trade across its borders against what its lands use, and the share of it with realms of
 * another faith; its seat's faith and clergy; how it is held and judged. Only reads.
 */
export function lawFactsOf(ctx: PopulationContext, p: Polity, o: RealmOrder, t: SimTime): LawFacts {
  const { world } = ctx,
    markets = world.store<MarketStore>("economy.markets"),
    culture = cultureOf(world),
    faiths = beliefOf(world),
    lore = loreOf(world),
    seatWays = culture.get(p.seat),
    seatFaith = faiths.of(p.seat).faith,
    realms = politiesOf(world),
    interests = interestsOf(ctx, p, t),
    count = (g: Group) => interests.find((i) => i.group === g)?.people ?? 0,
    swayOf = (g: Group) => interests.find((i) => i.group === g)?.sway ?? 0;
  let people = 0,
    foreign = 0,
    unbelief = 0,
    used = 0,
    kept = 0,
    workers = 0,
    // (How far its arms hold its tillers to the land, by them, where it was reckoned: sim/money/money.ts.)
    held = 0,
    open = 0,
    heldOver = 0;
  // (Pay, by OCC: farmers (and those who gather), herders, crafters, traders; and their heads, where a market paid them.)
  const paid = [0, 0, 0, 0],
    paidHeads = [0, 0, 0, 0];
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    const n = prov.total();
    people += n;
    if (c !== p.seat) {
      const ways = culture.get(c);
      if (seatWays && ways) foreign += n * (1 - tongueLikeness(seatWays.tongue, ways.tongue));
      const theirs = faiths.of(c).faith;
      if (seatFaith !== null && theirs !== null && theirs !== seatFaith) unbelief += n;
    }
    const m = markets.get(c);
    if (m) for (let k = 0; k < GOODS.length; k++) used += m.book("used", k) * GOODS[k]!.value;
    const w = markets.wagesOf(c);
    if (!w) continue;
    const at = [
      prov.occupation(OCC.farmer) + prov.occupation(OCC.forager),
      prov.occupation(OCC.herder),
      prov.occupation(OCC.crafter),
      prov.occupation(OCC.trader),
    ];
    paid[0] = paid[0]! + at[0]! * (w[OCC.farmer] ?? 0);
    paid[1] = paid[1]! + at[1]! * (w[OCC.herder] ?? 0);
    paid[2] = paid[2]! + at[2]! * (w[OCC.crafter] ?? 0);
    paid[3] = paid[3]! + at[3]! * (w[OCC.trader] ?? 0);
    for (let k = 0; k < 4; k++) paidHeads[k] = paidHeads[k]! + at[k]!;
    kept += 12 * mouths(prov, ctx.life);
    const tilling = at[0]! + at[1]!,
      bound = bindOf(world, c);
    if (bound) {
      held += bound.hold * tilling;
      open += Math.min(2, bound.open) * tilling;
      heldOver += tilling;
    }
    workers += Math.max(1, n - prov.occupation(OCC.dependent));
  }
  let trade = 0,
    otherFaiths = 0;
  for (const i of markets.flowsAt(p.members)) {
    const f = markets.flows[i]!,
      from = realms.of(f.from),
      to = realms.of(f.to);
    if (!from || !to || from === to || (from !== p && to !== p)) continue;
    const other = from === p ? to : from,
      worth = markets.boundAt(i) * GOODS[f.good]!.value;
    trade += worth;
    const theirs = faiths.of(other.seat).faith;
    if (seatFaith !== null && theirs !== null && theirs !== seatFaith) otherFaiths += worth;
  }
  // (Its clergy: as many to its faithful as its seat's faith keeps over all its lands.)
  const row = seatFaith ? cultureRows(world, TEMPLE_STORE)?.get(refNumber(seatFaith)) : undefined,
    clergy =
      row && row[TEMPLE_ROW.faithful]! > 0
        ? (row[TEMPLE_ROW.clergy]! / row[TEMPLE_ROW.faithful]!) * Math.max(0, people - unbelief)
        : 0,
    payOf = (k: number) => (paidHeads[k]! > 0 ? paid[k]! / paidHeads[k]! : 0),
    numbers = holdsOf(world, p.ref),
    capacity = capacityOf(ctx, p).value,
    revenue = revenueOf(world, p.ref),
    trait = (k: number) => seatWays?.traits[k] ?? 0.5;
  return {
    heads: {
      farmers: count("farmers"),
      herders: count("herders"),
      crafters: count("crafters"),
      traders: count("traders"),
      "the court": count("the court"),
      "the temple": clergy,
      "the army": count("the army"),
    },
    pay: { farmers: payOf(0), herders: payOf(1), crafters: payOf(2), traders: payOf(3) },
    living: workers > 0 ? kept / workers : 0,
    hold: heldOver > 0 ? held / heldOver : 1,
    open: heldOver > 0 ? open / heldOver : 0,
    sway: {
      farmers: swayOf("farmers"),
      herders: swayOf("herders"),
      crafters: swayOf("crafters"),
      traders: swayOf("traders"),
      "the court": swayOf("the court"),
      "the temple": swayOf("the temple"),
      "the army": swayOf("the army"),
    },
    foreign: people > 0 ? foreign / people : 0,
    unbelief: people > 0 ? unbelief / people : 0,
    trade: used > 0 ? Math.min(1, trade / used) : 0,
    otherFaiths: trade > 0 ? otherFaiths / trade : 0,
    faith: seatFaith !== null,
    piety: trait(WAY.piety),
    sacred: p.law === LAW.indexOf("the sacred"),
    force: numbers[HOLD.force]!,
    voice: numbers[HOLD.voice]!,
    trust: numbers[HOLD.trust]!,
    kinship: trait(WAY.kinship),
    corruption: o.corruption,
    written: lawWritten(
      !!lore.get(p.seat, "law-codes"),
      lore.effect(p.seat, "writing") > 0,
      capacity,
      readersOf(world, p.seat),
    ),
    capacity,
    short: revenue > 0 ? deficitOf(world, p.ref) / revenue : 0,
    tribute: p.tribute,
    land: o.laws[LAW_OF.land] ?? 1,
    justice: o.laws[LAW_OF.justice] ?? 1,
  };
}

/** What each of a realm's groups gains by each position of each law now (rules/lawgain.ts). Only reads. */
export function lawGainsOf(
  ctx: PopulationContext,
  p: Polity,
  o: RealmOrder,
  t: SimTime,
): LawGainsTable {
  return lawGains(lawFactsOf(ctx, p, o, t));
}

/**
 * A realm's clerks as a group of their own (rules/lawgain.ts clerkGains): where its seat's officers keep accounts (its people
 * know bureaucracy) and its treasury pays them. Their heads are those who lead at its seat; what they are paid, a head's
 * living there by what the treasury pays an officer (rules TREASURY.clerks). Their sway is the court's own, as far as the
 * seat's will is done through paid office: the share of those who lead who sit at the seat, by how far its hand reaches
 * (its capacity); that much the less is the court's. Null where it keeps none. Only reads.
 */
export function clerksOf(
  ctx: PopulationContext,
  p: Polity,
  f: LawFacts,
): { readonly share: number; readonly gains: [number, number, number][] } | null {
  const { world } = ctx;
  if (!loreOf(world).get(p.seat, "bureaucracy")) return null;
  const fisc = moneyStore(world, TREASURY_STORE)?.get(p.ref);
  if (!fisc || !(fisc[FISC.clerks]! > 0)) return null;
  const heads = ctx.provinces.get(p.seat)?.occupation(OCC.leader) ?? 0,
    court = f.heads["the court"];
  if (!(heads > 0) || !(court > 0)) return null;
  let made = 0,
    commons = 0;
  for (const g of ["farmers", "herders", "crafters", "traders"] as const) {
    made += f.heads[g] * f.pay[g];
    commons += f.heads[g];
  }
  if (!(made > 0)) return null;
  return {
    share: Math.min(1, heads / court) * Math.max(0, Math.min(1, f.capacity)),
    gains: clerkGains(f, heads * (made / commons) * TREASURY.clerks),
  };
}

/** The position of a law (0 … 2) a group gains most by (the older of equals): what a school that speaks for it teaches (sim/ideas). */
export function lawWanted(gains: LawGainsTable, group: Group, law: Law): number {
  const w = gains[LAW_OF[law]]![group];
  return w[2] > w[1] && w[2] > w[0] ? 2 : w[1] > w[0] ? 1 : 0;
}

const trait = (w: Ways | undefined, k: number) => w?.traits[k] ?? 0.5;
/** The strongest push behind a people's way, as a factor's source. */
const nudged = (w: Ways | undefined, k: number): CauseRef | null => {
  const n = w?.nudges.find((x) => x.trait === k);
  return n ? { ref: n.event, role: "pressure", weight: 1 } : null;
};
/** From the old order (-1) through the middle (0) to the new (1), by position. */
const NEWER = [-1, 0, 1] as const;

/**
 * A realm's first laws where its lands cannot be read (an order begun by a hand before the realm's first year of order: every
 * realm's is begun at its year's start, by lawsFounded): of its people's ways and its rule.
 */
export function firstLaws(p: Polity, ways: Ways | undefined, faith: boolean): number[] {
  const hier = trait(ways, WAY.hierarchy),
    open = trait(ways, WAY.openness),
    piety = trait(ways, WAY.piety),
    trade = trait(ways, WAY.trade);
  return [
    hier >= 0.6 ? 0 : hier <= 0.35 && trade < 0.6 ? 2 : 1,
    open < 0.45 ? 0 : open > 0.65 ? 2 : faith ? 1 : 0,
    !faith ? 1 : piety > 0.6 && open < 0.5 ? 0 : open > 0.65 ? 2 : 1,
    p.law === 0 ? 0 : 1,
  ];
}

/**
 * A realm's first laws: of each, the position its groups gain most by, by their sway, with what its people's ways lean to (as
 * weighLaws weighs them, no old ways yet to hold). One law for all and a land of free conscience are written laws; where its
 * seat keeps no faith, the middle. `o` is its order as begun.
 */
export function lawsFounded(
  ctx: PopulationContext,
  p: Polity,
  o: RealmOrder,
  t: SimTime,
): number[] {
  const { world } = ctx,
    ways = cultureOf(world).get(p.seat),
    faith = beliefOf(world).of(p.seat).faith !== null,
    writing = loreOf(world).effect(p.seat, "writing") > 0,
    gains = lawGainsOf(ctx, p, o, t),
    sway = swayOnLaws(ctx, p, o, t);
  return LAWS.map((law, k) => {
    if (law === "faith" && !faith) return 1;
    const lean = waysPullOn(law, ways);
    let best = 1,
      bestAt = -Infinity;
    for (let pos = 0; pos < 3; pos++) {
      if (!writing && pos === 2 && (law === "justice" || law === "faith")) continue;
      let at = lean * NEWER[pos]!;
      for (const [g, w] of sway) at += w * gains[k]![g][pos]!;
      if (at > bestAt + 1e-9) {
        best = pos;
        bestAt = at;
      }
    }
    return best;
  });
}

/** What a people's ways lean a law toward (from the old order, -, to the new, +). */
function waysPullOn(law: Law, ways: Ways | undefined): number {
  const hier = trait(ways, WAY.hierarchy),
    open = trait(ways, WAY.openness),
    piety = trait(ways, WAY.piety);
  return law === "land"
    ? -0.5 * (hier - 0.5)
    : law === "strangers"
      ? 0.5 * (open - 0.5) - 0.3 * (hier - 0.5)
      : law === "faith"
        ? 0.4 * (open - 0.5) - 0.5 * (piety - 0.5)
        : 0.3 * (open - 0.5);
}

/** The law of a kind a realm keeps (its position), with its words. */
export function lawOf(o: RealmOrder, law: Law): { position: number; words: string } {
  const position = o.laws[LAW_OF[law]] ?? 1;
  return { position, words: LAW_POSITIONS[law][position]! };
}

/**
 * How far a realm's laws are what its powerful want (-1 … 1): over its laws, each group's want
 * of the law it keeps, by the group's sway.
 */
export function approvalOf(
  laws: readonly number[],
  sway: ReadonlyMap<Group, number>,
  gains: LawGainsTable,
): number {
  let sum = 0;
  LAWS.forEach((_, k) => {
    for (const [g, s] of sway) sum += s * gains[k]![g][laws[k]!]!;
  });
  return Math.max(-1, Math.min(1, sum / LAWS.length));
}

/** Each group's sway as a law is weighed: the court's the less as its rule is doubted. */
export function swayOnLaws(
  ctx: PopulationContext,
  p: Polity,
  o: RealmOrder,
  t: SimTime,
): Map<Group, number> {
  const doubted = o.legitimacy < 0.45 ? (0.45 - o.legitimacy) / 0.45 : 0;
  return new Map<Group, number>(
    interestsOf(ctx, p, t).map((i) => [
      i.group,
      i.sway * (i.group === "the court" ? 1 - 0.5 * doubted : 1),
    ]),
  );
}

/** Who is for a step of a law and who against, by their sway and how much they want it (Lives L4). */
export function stepVoices(
  sway: ReadonlyMap<Group, number>,
  gains: LawGainsTable,
  law: Law,
  from: number,
  to: number,
): {
  readonly forIt: number;
  readonly against: number;
  readonly groups: readonly { readonly group: Group; readonly by: number }[];
} {
  let forIt = 0,
    against = 0;
  const groups: { group: Group; by: number }[] = [];
  for (const [group, s] of sway) {
    const w = gains[LAW_OF[law]]![group],
      by = s * (w[to]! - w[from]!);
    if (by > 0) forIt += by;
    else against -= by;
    groups.push({ group, by });
  }
  return { forIt, against, groups };
}

/** Every ten years (each realm in its own year of ten), a realm weighs its laws. */
export function weighLaws(ctx: PopulationContext, p: Polity, o: RealmOrder, t: SimTime): void {
  const { world } = ctx,
    year = yearOfMoment(t);
  if ((year + (parseRef(p.ref).b % LAW_EVERY)) % LAW_EVERY !== 0) return;
  const ways = cultureOf(world).get(p.seat),
    hier = trait(ways, WAY.hierarchy),
    open = trait(ways, WAY.openness),
    piety = trait(ways, WAY.piety),
    tradition = trait(ways, WAY.tradition),
    faith = beliefOf(world).of(p.seat).faith !== null,
    writing = loreOf(world).effect(p.seat, "writing") > 0,
    // (A rule doubted gives ground: the court's wants count the less, the people's the more.)
    doubted = o.legitimacy < 0.45 ? (0.45 - o.legitimacy) / 0.45 : 0,
    sway = new Map<Group, number>(
      interestsOf(ctx, p, t).map((i) => [
        i.group,
        i.sway * (i.group === "the court" ? 1 - 0.5 * doubted : 1),
      ]),
    ),
    moved = (cause: "land" | "voice") => o.movements.find((m) => m.cause === cause),
    // (The school most of its lands hold draws each law the way it teaches: sim/ideas. Nothing where none is held.)
    school = schoolOver(world, p.members, p.seat, year, ctx.generated.life.people?.body.span ?? 70),
    // (What each group gains by each position, reckoned once for all four laws; and its clerks, where it keeps them: of the
    // court's sway, theirs is the part done through paid office.)
    facts = lawFactsOf(ctx, p, o, t),
    gains = lawGains(facts),
    clerks = clerksOf(ctx, p, facts),
    courtSway = sway.get("the court") ?? 0,
    clerkSway = clerks ? courtSway * clerks.share : 0;
  for (const law of LAWS) {
    const k = LAW_OF[law],
      now = o.laws[k]!;
    if (law === "faith" && !faith) continue;
    // What moves each position: the groups by their sway, a movement, the people's ways, a rule
    // doubted (toward the new) and old ways (toward what stands).
    const gain = gains[k]!,
      clerkGain = clerks ? clerks.gains[k]! : null,
      // (With its clerks, the court's own sway is the less by theirs; `apart`: as it would be weighed were they not a group.)
      groups = (pos: number, apart = false) =>
        [...sway].reduce((s, [g, w]) => s + w * gain[g][pos]!, 0) +
        (clerkGain && !apart ? clerkSway * (clerkGain[pos]! - gain["the court"][pos]!) : 0),
      movement =
        law === "land"
          ? moved("land")
          : law === "strangers" || law === "justice"
            ? moved("voice")
            : undefined,
      push = movement ? (law === "land" ? 1 : 0.6) * movement.strength : 0,
      waysPull = waysPullOn(law, ways),
      taught = pullOnLaw(school, k),
      support = (pos: number, apart = false) =>
        groups(pos, apart) +
        (push + waysPull + taught + 0.15 * doubted) * NEWER[pos]! +
        (pos === now ? 0.25 * tradition : 0),
      // (One law for all is a written law; so is a land of free conscience.)
      stepOf = (apart: boolean): { to: number; score: number } | null => {
        let best = now;
        for (let pos = 0; pos < 3; pos++)
          if (support(pos, apart) > support(best, apart) + 1e-9) best = pos;
        if (best === now) return null;
        const to = now + Math.sign(best - now);
        if (!writing && ((law === "justice" && to === 2) || (law === "faith" && to === 2)))
          return null;
        return { to, score: support(to, apart) - support(now, apart) };
      },
      step = stepOf(false),
      apart = clerkGain ? stepOf(true) : null,
      // (A god's whisper to its ruler: to reform, half the line is enough; to hold, no law moves. Exactly the line where none.)
      whispered =
        step || apart ? whisperIn(world, `rule:${p.ref}`, p.ruler.event, year, "law") : null,
      line = whispered
        ? whispered.aim === "law:reform"
          ? REFORM_LINE / 2
          : Infinity
        : REFORM_LINE;
    if (!step || step.score < line) {
      // (A reform its groups would have carried, were its clerks not a group of their own: held back by them.)
      if (clerkGain && apart && apart.score >= line) {
        const took = clerkSway * (clerkGain[apart.to]! - clerkGain[now]!),
          standing = o.lawEvents[k] ?? null,
          decision = world.decisions.record({
            rule: "order.clerks",
            subject: p.ref,
            outcome: {
              law,
              kept: LAW_POSITIONS[law][now]!,
              against: LAW_POSITIONS[law][apart.to]!,
            },
            score: apart.score - (step && step.to === apart.to ? step.score : 0),
            threshold: apart.score - line,
            factors: [
              {
                name: "what its clerks would lose of their offices by it",
                value: Math.round(clerkSway * 100) / 100,
                contribution: -took,
                source: standing ? { ref: standing, role: "enabler", weight: 1 } : null,
              },
              {
                name: "how far the step was wanted without them",
                value: Math.round(apart.score * 100) / 100,
                contribution: -(apart.score - line),
                source: null,
              },
              {
                name: "how far its seat's will is done through paid office",
                value: Math.round(clerks!.share * 100) / 100,
                contribution: 0,
                source: null,
              },
            ],
          });
        world.events.emit({
          type: LAW_EVENTS.held.type,
          subjects: [p.ref],
          place: ctx.provinces.get(p.seat)?.ref ?? null,
          causes: [
            { ref: decision, role: "trigger", weight: 1 },
            ...(standing ? [{ ref: standing, role: "enabler" as const, weight: 0.4 }] : []),
          ],
          data: { realm: realmName(p), law, from: now, to: apart.to },
        });
      }
      continue;
    }
    const { to, score } = step,
      clerkBy = clerkGain ? clerkSway * (clerkGain[to]! - clerkGain[now]!) : 0,
      toward = NEWER[to]! - NEWER[now]!,
      ranked = [
        ...[...sway].map(([g, w]) => ({
          g: g as string,
          w: g === "the court" && clerkGain ? w - clerkSway : w,
          c: (g === "the court" && clerkGain ? w - clerkSway : w) * (gain[g][to]! - gain[g][now]!),
        })),
        ...(clerkGain ? [{ g: "its clerks", w: clerkSway, c: clerkBy }] : []),
      ]
        .sort((a, b) => Math.abs(b.c) - Math.abs(a.c) || (a.g < b.g ? -1 : 1))
        .slice(0, 3),
      factors: Factor[] = [
        ...ranked.map(({ g, w, c }) => ({
          name: `${g} ${c >= 0 ? "gain by it" : "lose by it"}`,
          value: w,
          contribution: c,
          source: null,
        })),
        ...(movement
          ? [
              {
                name: law === "land" ? "the movement for the land" : "the movement for a voice",
                value: movement.strength,
                contribution: push * toward,
                source: { ref: movement.event, role: "pressure" as const, weight: 1 },
              },
            ]
          : []),
        {
          name: "its people's ways",
          value: law === "land" ? hier : law === "faith" ? piety : open,
          contribution: waysPull * toward,
          source: nudged(
            ways,
            law === "land" ? WAY.hierarchy : law === "faith" ? WAY.piety : WAY.openness,
          ),
        },
        {
          name: doubted > 0 ? "a rule doubted gives ground" : "old ways hold",
          value: doubted > 0 ? o.legitimacy : tradition,
          contribution: doubted > 0 ? 0.15 * doubted * toward : -0.25 * tradition,
          source: doubted > 0 && o.crisis ? { ref: o.crisis, role: "pressure", weight: 1 } : null,
        },
        ...(taught
          ? [
              {
                name: `what ${school!.school.name} teaches`,
                value: school!.hold,
                contribution: taught * toward,
                source: { ref: school!.school.event, role: "pressure" as const, weight: 1 },
              },
            ]
          : []),
      ],
      decision = world.decisions.record({
        rule: "order.law",
        subject: p.ref,
        outcome: { law, from: LAW_POSITIONS[law][now]!, to: LAW_POSITIONS[law][to]! },
        score,
        threshold: line,
        factors: whispered
          ? [
              ...factors,
              {
                name: "the god's whisper to their ruler",
                value: 1,
                contribution: REFORM_LINE / 2,
                source: { ref: whispered.event, role: "trigger", weight: 1 },
              },
            ]
          : factors,
      }),
      event = world.events.emit({
        type: LAW_EVENTS.changed.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [
          { ref: decision, role: "trigger", weight: 1 },
          ...(movement ? [{ ref: movement.event, role: "pressure" as const, weight: 0.6 }] : []),
        ],
        data: { realm: realmName(p), law, from: now, to },
      });
    o.laws[k] = to;
    o.lawEvents[k] = event;
  }
  o.approval = approvalOf(o.laws, sway, gains);
}

/** What a law asks of a land's people, as grievance a year: strangers held as subjects, unbelievers. */
export function lawGrievance(
  o: RealmOrder,
  foreign: number,
  unbeliever: boolean,
): { add: number; cause: Ref | null } {
  const strangers = o.laws[LAW_OF.strangers]!,
    faith = o.laws[LAW_OF.faith]!,
    asSubjects = strangers === 0 ? 0.03 * foreign : strangers === 1 && unbeliever ? 0.03 : 0,
    asUnbelievers = unbeliever ? [0.04, 0.01, 0][faith]! : 0;
  return {
    add: asSubjects + asUnbelievers,
    cause:
      asUnbelievers >= asSubjects
        ? (o.lawEvents[LAW_OF.faith] ?? null)
        : (o.lawEvents[LAW_OF.strangers] ?? null),
  };
}
