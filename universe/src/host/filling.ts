// A world filled, told (galaxy-plan.md, "Worlds filled"): how much of it is settled, why no more, and what stopped it, in
// words read off its own numbers; what the globe draws of it; and every world so settled, for a page. Pure reads.
import type { World } from "../kernel/index.ts";
import { cannotRemake, yearsToFill, type FillReading } from "../rules/index.ts";
import {
  STAGE_WORDS,
  bodyKey,
  clusterOf,
  filledOf,
  fillGround,
  folkOf,
  folkPeople,
  folkStage,
  homePlanet,
  lateOf,
  peopleOn,
  populationContext,
  readingOf,
  remakeKey,
  starKey,
  type FilledWorld,
} from "../sim/index.ts";
import type { Block, FillPlan, PageModel } from "../bridge/index.ts";
import type { QueryHandler } from "./host.ts";
import { count, item, many, stat } from "./inspect/words.ts";
import { landfallPlans } from "./landfall.ts";

/** People a town of a world filling holds (est.): how many towns its towns are read as. */
const TOWN_PEOPLE = 30_000;

/** A large number, as far as it is worth reading. */
export function peopleWords(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million`;
  return count(n);
}

const pct = (x: number) =>
  x < 0.001 ? "Under 0.1" : x < 0.095 ? (x * 100).toFixed(1) : String(Math.round(x * 100));

/** Why it is no more than it is, each from its numbers. */
function whyOf(world: World, w: FilledWorld, r: FillReading, people: number, year: number): string[] {
  const out: string[] = [],
    ground = fillGround(world, w),
    remade =
      w.body >= 0
        ? lateOf(world)?.share(remakeKey(w.body, 0))
        : w.cell !== null
          ? lateOf(world)?.share(remakeKey(-1, w.cell))
          : 0;
  if (r.open)
    out.push(
      (remade ?? 0) >= 1
        ? "Its air has been remade, and its people walk out under it: it can be filled to its edges."
        : "Its people can walk out under its sky, with nothing kept out: it can be filled to its edges.",
    );
  else {
    const cant = ground ? cannotRemake(ground) : null,
      most = Math.round(r.top * 100);
    out.push(
      `No one can live on it under the open sky: ${r.because.slice(0, 3).join("; ")}. That costs ${r.upkeep.toFixed(1)} machines a settler a year, ${Math.round(r.kept * 100)}% of every hand's work.`,
    );
    if (w.filled === null || r.top < 0.999)
      out.push(
        cant
          ? `So it will never fill: its people can keep roofs over ${most}% of its ground and no more, and it cannot be remade (${cant}).`
          : (remade ?? 0) > 0
            ? `So its people hold ${most}% of its ground at most as yet. It is ${Math.round(remade! * 100)}% remade, and as that goes on the most they can hold goes up.`
            : `So its people can keep roofs over ${most}% of its ground and no more. Only remaking its air would open the rest, and no one has begun.`,
      );
  }
  if (w.held)
    out.push(
      `The land its comers want is not theirs to take: those who were here first threw back their landing, and the comers keep to ${Math.round(r.top * 100)}% of it.`,
    );
  if (w.filled !== null) {
    out.push(
      r.top >= 0.999
        ? `All of it has been settled since year ${w.filledYear}.`
        : `All it can hold of its ground has been settled since year ${w.filledYear}.`,
    );
    out.push(
      people >= r.holds * 0.98
        ? `It holds ${peopleWords(r.holds)} at most, as high as its people know how to build, and it is full: no more can come until they know more.`
        : `It can hold ${peopleWords(r.holds)} as high as its people know how to build: its towns go on rising, not spreading.`,
    );
    return out;
  }
  const left = yearsToFill(people, r, w.comers);
  out.push(
    left === null
      ? `Too few of them, too slowly: at ${(r.rate * 100).toFixed(1)}% a year it will not come to that in five thousand years.`
      : `Too few years yet: they came in ${w.arrives} and grow by ${(r.rate * 100).toFixed(1)}% a year, with ${count(w.comers)} more coming; at that pace all it can hold is settled about year ${year + left}.`,
  );
  if (w.lanes)
    out.push(
      `A way by ${many(w.lanes, "lane", "lanes")} runs here: more come than ever could on a drive alone.`,
    );
  return out;
}

/** How a world is filling, as a plan (null: it has no reading: a ship still sailing for a world gone). */
export function fillPlanOf(world: World, w: FilledWorld): FillPlan | null {
  // (Unmade: nothing fills there now: W6.)
  if (w.gone !== undefined) return null;
  const ctx = populationContext(world),
    r = readingOf(ctx, w);
  if (!r) return null;
  const g = homePlanet(world).generated,
    year = Math.floor(world.now / (365 * 86400)),
    people = peopleOn(ctx, w),
    sailing = !w.arrived,
    share = Math.min(r.top, people / Math.max(1, r.usable * r.base)),
    folk = (() => {
      if (!w.star) return null;
      const star = clusterOf(world).find((s) => s.ref === w.star);
      return star ? folkOf(world, star, w.planet) : null;
    })(),
    land = folk ? landfallPlans(world, folk).at(-1) : undefined,
    natives = folk
      ? `The ${folk.name} were here first: ${STAGE_WORDS[folkStage(folk, year)]}, ${count(folkPeople(folk, year))} of them (est.). ${land ? land.holdsWords : "No one has fought them for it yet."}`
      : null,
    towns = Math.max(sailing ? 0 : 1, Math.round(people / TOWN_PEOPLE));
  return {
    key: w.key,
    ref: w.star ? `${w.star}/${w.planet}` : (g.system.bodies[w.body]?.ref ?? ""),
    who: w.name,
    year: w.arrives,
    sailing,
    share,
    top: r.top,
    people,
    holds: r.holds,
    open: r.open,
    sea: g.life.people?.body?.medium === "water",
    towns,
    filled: w.filledYear,
    whole: w.filled !== null && r.top >= 0.999,
    cell: w.cell,
    star: w.star,
    planet: w.planet,
    body: w.body,
    head: sailing
      ? `A ship of ${w.name} is on its way here, to come in year ${w.arrives}.`
      : `${pct(share)}% of its ground is settled: ${peopleWords(people)} people, in about ${peopleWords(towns)} ${towns === 1 ? "town" : "towns"}.`,
    why: sailing ? [] : whyOf(world, w, r, people, year),
    natives,
  };
}

/** The store's entry for a world, by where it is. */
function entryOf(
  world: World,
  where: { readonly star: string | null; readonly planet: number; readonly body: number },
): FilledWorld | undefined {
  return filledOf(world)?.get(where.star ? starKey(where.star, where.planet) : bodyKey(where.body));
}

/** How far a colony's world is settled, for its row in a list. */
export function settledOf(
  world: World,
  star: string | null,
  planet: number,
  body: number,
): { readonly settled: number; readonly onWorld: number } {
  const w = entryOf(world, { star, planet, body });
  if (!w) return { settled: 0, onWorld: 0 };
  const ctx = populationContext(world),
    r = readingOf(ctx, w),
    people = peopleOn(ctx, w);
  return {
    settled: r ? Math.min(r.top, people / Math.max(1, r.usable * r.base)) : 0,
    onWorld: people,
  };
}

/** What a world's page says of it. */
export function fillBlocks(
  world: World,
  where: { readonly star: string | null; readonly planet: number; readonly body: number },
): Block[] {
  const w = entryOf(world, where),
    plan = w && fillPlanOf(world, w);
  if (!plan) return [];
  return [
    {
      type: "text",
      title: "How far it is settled",
      lines: [[plan.head], ...plan.why.map((l) => [l]), ...(plan.natives ? [[plan.natives]] : [])],
    },
  ];
}

/** Every world being filled, the fullest and most peopled first. */
export function filledList(world: World): FillPlan[] {
  return (filledOf(world)?.all() ?? [])
    .flatMap((w) => fillPlanOf(world, w) ?? [])
    .sort((a, b) => b.people - a.people || (a.key < b.key ? -1 : 1));
}

const rowOf = (p: FillPlan) =>
  item(
    `${p.star ? "A world of another star" : `Body ${p.body}`}, first settled by ${p.who || "those long gone"} in ${p.year}: ${p.sailing ? "a ship under way" : `${pct(p.share)}% settled, ${peopleWords(p.people)} people${p.filled !== null ? (p.whole ? "; filled" : "; all it can hold") : ""}`}${p.natives ? "; it had a people on it" : ""}`,
    p.ref,
  );

/** What the list of peoples says of the worlds being filled. */
export function fillingBlocks(world: World): Block[] {
  const list = filledList(world).filter((p) => p.natives);
  return list.length
    ? [
        {
          type: "list",
          title: "Comers filling a people's world",
          items: list.slice(0, 12).map(rowOf),
          ...(list.length > 12 ? { more: list.length - 12 } : {}),
        },
      ]
    : [];
}

/** The page of every world settled. */
export function filledPage(world: World): PageModel {
  const list = filledList(world),
    landed = list.filter((p) => !p.sailing),
    whole = landed.filter((p) => p.whole).length,
    top = landed.filter((p) => p.filled !== null && !p.whole).length,
    sum = landed.reduce((n, p) => n + p.people, 0),
    year = Math.floor(world.now / (365 * 86400));
  return {
    ref: "world:filled",
    kind: "world",
    icon: "🌆",
    title: "The worlds settled",
    subtitle: [`${many(landed.length, "world", "worlds")} with people on them, in year ${year}.`],
    color: null,
    place: null,
    stats: [
      stat("People on them", peopleWords(sum)),
      stat("Filled to their edges", count(whole)),
      stat("Holding all they can", count(top)),
      stat("Ships under way", count(list.length - landed.length)),
    ],
    tabs: [
      {
        id: "all",
        name: "All of them",
        blocks: [
          {
            type: "list",
            title: "The most peopled first",
            items: list.slice(0, 60).map(rowOf),
            ...(list.length > 60 ? { more: list.length - 60 } : {}),
          },
        ],
      },
    ],
    followable: false,
    year,
  };
}

export const FILLING_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** How far a world is filled (null: no one has come to it). */
  "filled.world": (world, args) => {
    const where = args as { star: string | null; planet: number; body: number },
      w = entryOf(world, where);
    return w ? fillPlanOf(world, w) : null;
  },
  /** The world an event of its filling tells of. */
  "filled.ofEvent": (world, args) => {
    const { ref } = args as { ref: string },
      w = filledOf(world)
        ?.all()
        .find((x) => x.filled === ref || x.arrived === ref || x.voyage === ref);
    return w ? fillPlanOf(world, w) : null;
  },
  /** Every world being filled. */
  "filled.list": (world) => filledList(world),
  /** The colonies no land holds, the most peopled first: as many as a list wants to show. */
  "filled.far": (world) =>
    (filledOf(world)?.all() ?? [])
      .filter((w) => w.cell === null)
      .flatMap((w) => fillPlanOf(world, w) ?? [])
      .sort((a, b) => b.people - a.people || (a.key < b.key ? -1 : 1))
      .slice(0, 24),
};
