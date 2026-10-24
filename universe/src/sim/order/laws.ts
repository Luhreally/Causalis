// A realm's laws (Phase 19 M139, asked for 2026-10-23: "law … rights … legal status … interest
// groups … ideologies … imperialism"): who owns the land — its lord, those who lease it, those
// who till it; what strangers are under it — subjects, the faithful, citizens; what its faith
// asks of other faiths — one faith, others tolerated, free conscience; and its justice — custom
// and vengeance, the ruler's courts, one law for all. A realm's first laws come of its people's
// ways and its rule; every ten years it weighs each law against what its interest groups want,
// by their sway (the court's the less as its rule is doubted), what its movements and its
// people's ways push for, and how hard old ways hold. A law moves a step at a time, and each step
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
import type { PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf, type Ways } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { loreOf } from "../lore/lore.ts";
import { realmName, type Polity } from "../polity/polity.ts";
import { interestsOf, type Group } from "../polity/interests.ts";
import type { RealmOrder } from "./order.ts";

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

export const LAW_EVENTS = { changed: defineEventType("order.law", 5) };

/** A realm weighs its laws once in this many years; a law moves when its next step is wanted this much more. */
export const LAW_EVERY = 10;
export const REFORM_LINE = 0.12;

/** What each interest group wants of each law, position by position (-1 … 1). */
const WANTS: Readonly<Record<Law, Readonly<Record<Group, readonly [number, number, number]>>>> = {
  land: {
    farmers: [-1, 0, 1],
    herders: [-0.5, 0, 0.5],
    crafters: [0, 0.3, 0.3],
    traders: [-0.3, 0.6, 0.2],
    "the court": [1, 0.3, -0.8],
    "the temple": [0.6, 0.2, -0.4],
    "the army": [0.6, 0.2, -0.4],
  },
  strangers: {
    farmers: [0.2, 0, -0.1],
    herders: [0.2, 0, 0],
    crafters: [-0.2, 0, 0.4],
    traders: [-0.6, -0.2, 1],
    "the court": [0.8, 0.2, -0.6],
    "the temple": [0, 1, -0.4],
    "the army": [0.6, 0.2, -0.4],
  },
  faith: {
    farmers: [0.2, 0.2, 0],
    herders: [0, 0.2, 0],
    crafters: [-0.2, 0.4, 0.4],
    traders: [-0.6, 0.6, 0.6],
    "the court": [0.4, 0.4, -0.2],
    "the temple": [1, -0.2, -1],
    "the army": [0.2, 0.2, 0],
  },
  justice: {
    farmers: [0.2, 0, 0.4],
    herders: [0.3, 0, 0.2],
    crafters: [-0.2, 0.2, 0.8],
    traders: [-0.6, 0.2, 1],
    "the court": [-0.2, 1, -0.4],
    "the temple": [0.4, 0.4, -0.2],
    "the army": [-0.4, 0.8, -0.2],
  },
};

const trait = (w: Ways | undefined, k: number) => w?.traits[k] ?? 0.5;
/** The strongest push behind a people's way, as a factor's source. */
const nudged = (w: Ways | undefined, k: number): CauseRef | null => {
  const n = w?.nudges.find((x) => x.trait === k);
  return n ? { ref: n.event, role: "pressure", weight: 1 } : null;
};
/** From the old order (-1) through the middle (0) to the new (1), by position. */
const NEWER = [-1, 0, 1] as const;

/** A realm's first laws: of its people's ways and its rule. */
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

/** The law of a kind a realm keeps (its position), with its words. */
export function lawOf(o: RealmOrder, law: Law): { position: number; words: string } {
  const position = o.laws[LAW_OF[law]] ?? 1;
  return { position, words: LAW_POSITIONS[law][position]! };
}

/**
 * How far a realm's laws are what its powerful want (-1 … 1): over its laws, each group's want
 * of the law it keeps, by the group's sway.
 */
function approvalOf(laws: readonly number[], sway: ReadonlyMap<Group, number>): number {
  let sum = 0;
  LAWS.forEach((law, k) => {
    for (const [g, s] of sway) sum += s * WANTS[law][g][laws[k]!]!;
  });
  return Math.max(-1, Math.min(1, sum / LAWS.length));
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
    moved = (cause: "land" | "voice") => o.movements.find((m) => m.cause === cause);
  for (const law of LAWS) {
    const k = LAW_OF[law],
      now = o.laws[k]!;
    if (law === "faith" && !faith) continue;
    // What moves each position: the groups by their sway, a movement, the people's ways, a rule
    // doubted (toward the new) and old ways (toward what stands).
    const groups = (pos: number) => [...sway].reduce((s, [g, w]) => s + w * WANTS[law][g][pos]!, 0),
      movement =
        law === "land"
          ? moved("land")
          : law === "strangers" || law === "justice"
            ? moved("voice")
            : undefined,
      push = movement ? (law === "land" ? 1 : 0.6) * movement.strength : 0,
      waysPull =
        law === "land"
          ? -0.5 * (hier - 0.5)
          : law === "strangers"
            ? 0.5 * (open - 0.5) - 0.3 * (hier - 0.5)
            : law === "faith"
              ? 0.4 * (open - 0.5) - 0.5 * (piety - 0.5)
              : 0.3 * (open - 0.5),
      support = (pos: number) =>
        groups(pos) +
        (push + waysPull + 0.15 * doubted) * NEWER[pos]! +
        (pos === now ? 0.25 * tradition : 0);
    let best = now;
    for (let pos = 0; pos < 3; pos++) if (support(pos) > support(best) + 1e-9) best = pos;
    if (best === now) continue;
    const to = now + Math.sign(best - now);
    // (One law for all is a written law; so is a land of free conscience.)
    if (!writing && ((law === "justice" && to === 2) || (law === "faith" && to === 2))) continue;
    const score = support(to) - support(now);
    if (score < REFORM_LINE) continue;
    const toward = NEWER[to]! - NEWER[now]!,
      ranked = [...sway]
        .map(([g, w]) => ({ g, c: w * (WANTS[law][g][to]! - WANTS[law][g][now]!) }))
        .sort((a, b) => Math.abs(b.c) - Math.abs(a.c) || (a.g < b.g ? -1 : 1))
        .slice(0, 3),
      factors: Factor[] = [
        ...ranked.map(({ g, c }) => ({
          name: `${g} ${c >= 0 ? "want it" : "stand against it"}`,
          value: sway.get(g) ?? 0,
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
      ],
      decision = world.decisions.record({
        rule: "order.law",
        subject: p.ref,
        outcome: { law, from: LAW_POSITIONS[law][now]!, to: LAW_POSITIONS[law][to]! },
        score,
        threshold: REFORM_LINE,
        factors,
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
  o.approval = approvalOf(o.laws, sway);
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
