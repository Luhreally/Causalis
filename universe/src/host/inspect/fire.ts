// The greatest fire on the pages (War past the line, W5): what it is, who chose it, what it cost, what it did. Never how. A pure
// reading of how near the world stands, for its panel; the works on a realm's page; the fall on its town's, its land's and its war's;
// and on a world without it, why no one there ever has it. Asking moves nothing.
import { yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import {
  FIRE,
  coldDegrees,
  fireLots,
  fireName,
  fireShutBy,
  shadowOf,
  unmakeMj,
} from "../../rules/index.ts";
import {
  diplomacyOf,
  fireOf,
  politiesOf,
  populationContext,
  realmName,
  warGoing,
  warsOf,
  type FireCrisis,
} from "../../sim/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import { farLadderStats, farLandStats, farRealmStats } from "../far.ts";
import { matterWorldOf } from "../reading.ts";
import { count, item, link, many, stat } from "./words.ts";

const nameOf = (world: World, ref: Ref): string => {
  const p = politiesOf(world).get(ref);
  return p ? realmName(p) : "a realm now gone";
};
const townOf = (world: World, ref: Ref): string =>
  populationContext(world).settlements.get(ref)?.name ?? "a town";

/** How near the world stands, read off what it holds now: nothing is kept for it. */
export type FireShadow = {
  /** 0 … 100; 0: no one holds it. */
  readonly near: number;
  readonly holders: number;
  readonly crises: number;
  readonly atOdds: number;
  readonly words: string;
  /** The dark years: how cold now (degrees), and the event behind them. */
  readonly cold: number;
  readonly dark: string | null;
  /** The year the first fell (null: none has). */
  readonly first: number | null;
  readonly falls: number;
};

/** The reading, then who holds what, if anyone does. */
const worksWords = (lead: string, parts: readonly string[]): string => {
  const rest = parts.filter(Boolean).join(" ");
  return rest ? `${lead} ${rest}.` : lead;
};

export function fireShadow(world: World): FireShadow {
  const store = fireOf(world),
    s = store.state,
    held = store.holders(),
    regard = diplomacyOf(world),
    realms = politiesOf(world);
  let atOdds = 0,
    wars = 0,
    worst = 0;
  for (let i = 0; i < held.length; i++) {
    for (let j = i + 1; j < held.length; j++)
      if ((regard.get(held[i]!.realm, held[j]!.realm)?.opinion ?? 0) < -0.4) atOdds++;
    const p = realms.get(held[i]!.realm);
    if (!p) continue;
    for (const w of warsOf(world).hotOf(p.ref)) {
      if (w.ended !== null || w.civil) continue;
      wars++;
      worst = Math.max(
        worst,
        warGoing(populationContext(world), w, w.attacker === p.ref ? 0 : 1, p),
      );
    }
  }
  // (And across the stars, W6: a far crisis is as much a year the world holds its breath, a far works as much a shadow.)
  const far = s.far,
    farCrises = far?.crises.filter((c) => c.ended === null).length ?? 0,
    farHeld = far?.works.filter((w) => w.done !== null && w.gone === undefined).length ?? 0,
    crises = store.open().length + farCrises,
    near = shadowOf({
      holders: held.length + farHeld,
      atOdds,
      wars,
      worst,
      crises,
      dread: s.dread,
    }),
    cold = Math.round(coldDegrees(s.soot) * 10) / 10,
    gone = far?.falls.some((f) => f.rung === "world"),
    words =
      !held.length && !farHeld && !farCrises
        ? gone
          ? "A world has been unmade. Everyone in reach of the stars remembers it."
          : far?.falls.length || s.falls.length
            ? "No one holds the greatest fire now. The world remembers it."
            : "No one holds the greatest fire."
        : worksWords(
            farCrises
              ? "Everyone in reach of the stars is holding their breath: a fleet is a year from a world, with what could end it."
              : crises
                ? "The whole world is holding its breath."
                : near >= 45
                  ? "The world stands in its shadow."
                  : "It lies far off, for now.",
            [
              held.length
                ? `${many(held.length, "realm holds", "realms hold")} the greatest fire`
                : "",
              atOdds ? `and ${many(atOdds, "pair of them is", "pairs of them are")} at odds` : "",
              wars ? `with ${many(wars, "war", "wars")} under way` : "",
              farHeld
                ? `${held.length ? "and " : ""}${many(farHeld, "realm can", "realms can")} turn its star's light on a far mark`
                : "",
            ],
          );
  return {
    near,
    holders: held.length,
    crises,
    atOdds,
    words,
    cold,
    dark: s.dark,
    first: s.falls[0]?.year ?? null,
    falls: s.falls.length,
  };
}

/** A realm's works, on its page: where, since when, what it has cost. */
export function fireRealmStats(world: World, realm: Ref): Stat[] {
  const store = fireOf(world),
    w = store.worksOf(realm),
    out: Stat[] = [];
  if (w) {
    const year = yearOfMoment(world.now);
    out.push(
      w.done === null
        ? stat(
            "A great works",
            `at ${w.place}, since year ${count(w.begun)}: ${count(year - w.begun)} of ${count(FIRE.worksYears)} years, ${count(Math.round(w.paid))} machines gone into it, ${Math.round(FIRE.worksShare * 100)} in a hundred of its machines, iron and fuel a year`,
            { why: w.event },
          )
        : stat(
            "Holds the greatest fire",
            w.given
              ? `By the god's hand, since year ${count(w.done)}: ${many(store.loadsOf(realm, year), "stands ready", "stand ready")}`
              : `Since year ${count(w.done)}: ${count(w.done - w.begun)} years at ${w.place}, ${count(Math.round(w.paid))} machines; ${many(store.loadsOf(realm, year), "stands ready", "stand ready")}, and each year's keeping costs ${Math.round(FIRE.keepShare * 1000) / 10} in a hundred`,
            { why: w.held },
          ),
    );
  }
  const fell = store.state.falls.filter((f) => f.by === realm);
  if (fell.length)
    out.push(
      stat(
        "Loosed it",
        `${many(fell.length, "time", "times")}: ${fell.map((f) => `${townOf(world, f.town)} in year ${count(f.year)}, ${count(f.dead)} dead`).join("; ")}`,
        { why: fell.at(-1)!.decision },
      ),
    );
  out.push(...farRealmStats(world, realm));
  return out;
}

/** It fell here, on a town's page. */
export function fireTownStats(world: World, town: Ref): Stat[] {
  return fireOf(world)
    .state.falls.filter((f) => f.town === town)
    .map((f) =>
      stat(
        "The greatest fire fell on it",
        `Year ${count(f.year)}, by ${nameOf(world, f.by)}: ${count(f.dead)} dead, ${count(f.homes)} homes gone, and the wind carried it over ${many(f.wind.length, "land", "lands")}`,
        { why: f.event },
      ),
    );
}

/** On a land's page: it fell here, or the wind carried it here. */
export function fireLandStats(world: World, cell: number): Stat[] {
  const store = fireOf(world),
    out: Stat[] = [];
  for (const f of store.state.falls) {
    if (f.cell === cell)
      out.push(
        stat(
          "The greatest fire fell here",
          `On ${townOf(world, f.town)} in year ${count(f.year)}, by ${nameOf(world, f.by)}: ${count(f.dead)} dead, ${count(f.homes)} homes gone`,
          { why: f.event },
        ),
      );
    else if (f.wind.includes(cell))
      out.push(
        stat(
          "The wind carried it here",
          `From ${townOf(world, f.town)}, year ${count(f.year)}: its people sickened and its fields lay sick`,
          { why: f.event },
        ),
      );
  }
  out.push(...farLandStats(world, cell));
  const sick = store.state.sick.find(([land]) => land === cell);
  if (sick)
    out.push(
      stat(
        "Its fields lie sick",
        `Until year ${count(sick[1])}: they yield ${Math.round(sick[2] * 100)} in a hundred`,
      ),
    );
  return out;
}

const endWords = (world: World, c: FireCrisis): string =>
  c.end === "fell"
    ? `${c.ruler} of ${nameOf(world, c.holder)} loosed it`
    : c.end === "stepped"
      ? c.who === "foe"
        ? `${nameOf(world, c.foe)} stepped back`
        : `${c.ruler} of ${nameOf(world, c.holder)} held their hand`
      : c.ended === null
        ? "the world holds its breath"
        : "it passed";

/** A war's page: the year it came to the brink, and what fell. */
export function fireWarBlocks(world: World, war: Ref): Block[] {
  const store = fireOf(world),
    crises = store.state.crises.filter((c) => c.war === war),
    falls = store.state.falls.filter((f) => f.war === war),
    out: Block[] = [];
  if (falls.length)
    out.push({
      type: "list",
      title: `The greatest fire fell ${many(falls.length, "time", "times")}: ${count(falls.reduce((n, f) => n + f.dead, 0))} dead, ${count(falls.reduce((n, f) => n + f.windDead, 0))} more where the wind took it`,
      items: falls.map((f) =>
        item(
          [
            link(townOf(world, f.town), f.town),
            `, by ${nameOf(world, f.by)}, year ${count(f.year)}: ${count(f.dead)} dead, ${count(f.homes)} homes gone`,
          ],
          f.event,
        ),
      ),
    });
  if (crises.length)
    out.push({
      type: "list",
      title: "The years the world held its breath",
      items: crises.map((c) =>
        item(`Year ${count(c.year)}: ${endWords(world, c)}`, c.endEvent ?? c.event),
      ),
    });
  return out;
}

/** The principle's page: what it is here, or why no one here ever has it; who holds it; what they have come to; what lies past it. */
export function firePrincipleStats(world: World): Stat[] {
  const n = matterWorldOf(world).means,
    shut = fireShutBy(n),
    store = fireOf(world),
    s = store.state;
  if (shut !== null)
    return [
      stat(
        "Why no one here ever has it",
        shut === "sea"
          ? "Its people live in its seas: no great works can be raised there."
          : shut === "ice"
            ? "Its rock lies under its ice, and the heaviest stuff lies in rock."
            : shut === "poor"
              ? `Its star has ${Math.round(n.metalShare * 100)}% of the Sun's metals: too little of the heaviest stuff ever gathered in its ground.`
              : "Nothing here could carry it: no wing lifts a load and no rocket lands past a gun's reach.",
      ),
      ...farLadderStats(world),
    ];
  const held = store.holders(),
    fell = s.falls.reduce((sum, f) => sum + f.dead, 0),
    stepped = s.crises.filter((c) => c.end === "stepped").length,
    commanded = held.reduce(
      (sum, h) => sum + store.loadsOf(h.realm, yearOfMoment(world.now)) * FIRE.mj,
      0,
    ),
    unmake = unmakeMj(n);
  return [
    stat(
      "What it is here",
      `They call it ${fireName(n)}: the densest store of energy this world's matter allows, carried by what already carries a load. One flattens some ${count(Math.round(fireLots()))} lots and burns ${FIRE.fireReach} times that, and half of those in its ground die (a game's estimates).`,
    ),
    stat(
      "What it takes",
      `A great works at a realm's seat: ${FIRE.worksYears} years, ${Math.round(FIRE.worksShare * 100)} in a hundred of its machines, iron and fuel in each. Only a realm with a quarter of the machines of the world's richest can pay for one.`,
    ),
    stat("Held by", held.length ? held.map((h) => nameOf(world, h.realm)).join(", ") : "No one"),
    stat(
      "What it has come to",
      `${many(s.crises.length, "year", "years")} the world held its breath, ${count(stepped)} of them ending with someone stepping back; ${many(s.falls.length, "fall", "falls")}, ${count(fell)} dead by them`,
    ),
    stat(
      "Beside what would unmake this world",
      `All that is held here comes to ${commanded.toExponential(1)} MJ. To unmake this world, its binding energy, would take ${unmake.toExponential(1)} MJ: ${unmake / Math.max(FIRE.mj, commanded) >= 1e6 ? "more than this fire could ever bring" : "far past what they hold"}. Energy goes on past this.`,
    ),
    ...farLadderStats(world),
  ];
}
