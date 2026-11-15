// A world of another star entered (asked 2026-11-13: "i should lowkey be able to play the alien worlds too, like when in
// the galaxy its other species"). From the home world, the way in: what is read of a people and its world (sim/space/
// natives.ts, the galaxy's own stars and planets) gathered into the seed of a world of its own (rules/far.ts), which the
// page then opens as it opens any world: made whole, run to the age its people were read at, kept under its own name. On
// the world entered, what it says of itself: whom it was made from, and whether it has come as far as they were read.
//
// Pure reads. Asking changes nothing: the home world's history never learns a world was entered, and the world entered
// keeps what is done on it to itself.
import { Rng, type World } from "../kernel/index.ts";
import { foreignPlanets, handDraw } from "../gen/index.ts";
import {
  FAR_STAGE_AGE,
  FAR_STAGE_USUAL,
  FAR_STAGE_YEARS,
  MAKINGS,
  farMade,
  farSeed,
  makingAct,
  makingsOf,
  type FarMade,
  type FarStage,
} from "../rules/index.ts";
import {
  STAGE_WORDS,
  clusterOf,
  folkGroundDraws,
  folkOf,
  folkStage,
  homePlanet,
} from "../sim/index.ts";
import type { EnterPlan, Entered } from "../bridge/index.ts";
import { foreignGlobe } from "./galaxy.ts";
import { folkFactsOf } from "./natives.ts";
import { stageOf } from "./inspect/stage.ts";
import type { QueryHandler } from "./host.ts";

/** The universe a world entered runs in: every world not ours is of the open one. */
const ENTERED_UNIVERSE = "alien";

/** What is found as it was seen, on any world entered. */
const KEPT: readonly string[] = [
  "Its star, and its own pull, warmth, air and share of sea, are the ones seen from afar.",
  "The chemistry of its ground and of its life is the one read there.",
  "Its people are the people seen: the same bodies, the same look.",
];

/** What cannot be, said plainly. */
function freshWords(name: string, stage: FarStage, wider = false): string[] {
  return [
    ...(wider
      ? [
          "Its lands are reckoned fewer and wider than the home world's, so that its long history can be run in minutes and not the better part of an hour.",
        ]
      : []),
    "Its coasts and lands are made in full here. The globe seen from afar was a sketch of them, and they differ from it.",
    `Its realms, towns and persons name themselves in their own tongues. “${name}” is what they are called from afar.`,
    stage === "camps"
      ? "It opens in its first year, its people in bands."
      : `Its history is run from its first bands until it reaches the age they were read at (${STAGE_WORDS[stage]}), or as near as its own rules bring it. Its years are its own count.`,
    "What happens here stays here. The home world's history goes on as it would have, and its stars' peoples are still read as before.",
    "Its night sky here is its own, not the home world's stars seen from the other side.",
  ];
}

const yearOf = (world: World) => Math.floor(world.now / (365 * 86400));

/** The lands' grid of each size (rules/making.ts: the usual is 20), and the lands a grid has over a whole globe. */
const GRID: Readonly<Record<string, number>> = {
  standard: 20,
  medium: MAKINGS.size.medium[0],
  small: MAKINGS.size.small[0],
};
const cellsOf = (grid: number) => 10 * grid * grid + 2;

/**
 * Whether a people's world can be entered from this one, and the seed of the world it makes. Its lands' grid is the
 * home world's, or the one asked for where that is smaller (`size`: its history is quicker to run over fewer lands).
 */
export function enterPlan(
  world: World,
  star: string,
  index: number,
  universe: string,
  size?: string,
): EnterPlan {
  if (!world.storeNames().includes("planet.home"))
    return { ok: false, why: "No stars are known from here." };
  if (farMade(world.seed.text))
    return {
      ok: false,
      why: "This world was itself entered from another. Go back to the galaxy it was seen from to enter one more.",
    };
  const parts = star.split(":"),
    s = clusterOf(world).find(
      (x) =>
        x.ref === star ||
        (parts[0] === "star" && x.sector === Number(parts[1]) && x.k === Number(parts[2])),
    );
  if (!s) return { ok: false, why: "That star is past the ones followed from here." };
  const f = folkOf(world, s, index),
    p = foreignPlanets(new Rng(world.seed), s)[index];
  if (!f || !p) return { ok: false, why: "No people live on that world." };
  const year = yearOf(world),
    stage = folkStage(f, year);
  if (stage === "ruins")
    return {
      ok: false,
      why: `The ${f.name} are gone${f.fell !== null ? ` since year ${f.fell}` : ""}: only their ruins are left, and no one to live as.`,
    };
  // (The share of its face under sea, as the far sight draws it; and the shares of it open ground and open sea, not ice.)
  const globe = foreignGlobe(world, s.ref, index),
    cells = Math.max(1, globe.elevation.length);
  let low = 0,
    ground = 0,
    sea = 0;
  for (let c = 0; c < globe.elevation.length; c++) {
    if (globe.elevation[c]! <= 0) low++;
    if (globe.cover[c] === 0) ground++;
    else if (globe.cover[c] === 1) sea++;
  }
  const made: FarMade = {
      v: 1,
      name: f.name,
      civ: f.ref,
      followed: !!f.followed,
      from: { universe, seed: world.seed.text },
      year,
      stage,
      star: {
        ref: `star:${s.sector}:${s.k}`,
        mass: s.mass,
        luminosity: s.luminosity,
        temperature: s.temperature,
        spectral: s.spectral,
        ageGyr: s.ageGyr,
        distance: s.distance,
      },
      planet: {
        index,
        a: p.a,
        mass: p.mass,
        radius: p.radius,
        gravity: p.gravity,
        temperature: p.temperature,
        pressure: p.pressure,
        seas: globe.elevation.length ? low / cells : 0.5,
      },
      chem: folkGroundDraws(world, s, index),
      hand: handDraw(f.ref),
      body: f.body,
      look: folkFactsOf(f, s),
    },
    // (The laws of its universe and its lands' grid as the home world's are; its own sky kept small.)
    home = makingsOf(world.seed.text),
    homeSize = home.size ?? "standard",
    asked = size && GRID[size] !== undefined && GRID[size]! < GRID[homeSize]! ? size : homeSize,
    acts = [
      makingAct("sky", "small"),
      ...(asked !== "standard" ? [makingAct("size", asked)] : []),
      ...(home.lanes ? [makingAct("lanes", home.lanes)] : []),
    ],
    // (About how many lands they will live over: the share of its face that is open ground as the far sight draws it;
    // for a people of the water, the shallows of its open seas. Est.)
    lands = Math.max(
      4,
      Math.round(
        cellsOf(GRID[asked]!) * (f.body.medium === "water" ? (0.12 * sea) / cells : ground / cells),
      ),
    );
  return {
    ok: true,
    universe: ENTERED_UNIVERSE,
    seed: farSeed(made, acts),
    name: f.name,
    kind: f.body.name,
    stage,
    stageWords: STAGE_WORDS[stage],
    mostYears: FAR_STAGE_YEARS[stage],
    usualYears: FAR_STAGE_USUAL[stage],
    lands,
    size: asked,
    kept: KEPT,
    fresh: freshWords(f.name, stage, asked !== homeSize),
  };
}

/** What a world entered says of itself (null: a world of its own seed). */
export function enteredHere(world: World): Entered | null {
  const far = world.storeNames().includes("planet.home")
    ? homePlanet(world).generated.far
    : undefined;
  if (!far) return null;
  const now = stageOf(world),
    want = FAR_STAGE_AGE[far.stage],
    at = now.stages.findIndex((x) => x.id === want),
    // (Come as far as they were read: that step's own first reached, or the age its peoples stand at now that far on.
    // A later step's first alone does not count: a world may write before it builds a city.)
    arrived =
      at <= 0 ||
      now.stages[at]!.year !== null ||
      now.stages.findIndex((x) => x.id === now.id) >= at;
  return {
    name: far.name,
    kind: far.body.name,
    from: far.from,
    star: far.star.ref,
    index: far.planet.index,
    distance: far.star.distance,
    year: far.year,
    stage: far.stage,
    stageWords: STAGE_WORDS[far.stage],
    mostYears: FAR_STAGE_YEARS[far.stage],
    arrived,
    age: now.name,
    kept: KEPT,
    fresh: freshWords(far.name, far.stage),
  };
}

export const ENTER_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** Whether a people's world can be entered from here, and the world it makes. */
  "enter.plan": (world, args) => {
    const a = args as { star: string; index: number; universe: string; size?: string };
    return enterPlan(world, a.star, a.index, a.universe, a.size);
  },
  /** What a world entered says of itself. */
  "enter.here": (world) => enteredHere(world),
};
