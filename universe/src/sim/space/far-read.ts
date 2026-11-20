// What is read of a people's world from afar, gathered as the seed of a world of its own (rules/far.ts), and what that
// world, made whole, lets its people come to (gen/far.ts). One reading for the way in (host/enter.ts) and for the
// galaxy's own account of a followed people (natives.ts, contact.ts): so what the galaxy says of them and the world
// played agree. Pure: of the home world's seed and its stars alone; nothing here enters history.
import { Rng, seedFromText, type Hasher, type StateStore, type World } from "../../kernel/index.ts";
import { worldLaws } from "../planet/store.ts";
import {
  farCrafts,
  farShut,
  machinesRoad,
  foreignBody,
  foreignPlanets,
  generateHomeWorld,
  handDraw,
  otherWorld,
  provinceWorld,
  type FarShut,
  type ForeignPlanet,
  type GalaxyStar,
} from "../../gen/index.ts";
import {
  AGE_LADDER,
  FAR_STAGE_AGE,
  MAKINGS,
  OPEN,
  farSeed,
  landsOf,
  makingAct,
  makingsOf,
  type BodyPlan,
  type FarMade,
  type FarStage,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import type { HomeWorld } from "../../gen/index.ts";

/**
 * The lands a world's people open its chronicle on (sim/population/world.ts seatedCells, which gives itself here as it
 * loads: the peopled world is made of much that reads the stars, so it is not asked for by name from among them).
 */
type Seats = (g: HomeWorld, text: string) => number[];
type Most = (g: HomeWorld, text: string) => number;
export function seatsBy(read: Seats, most: Most): void {
  (seatsBy as { read?: Seats; most?: Most }).read = read;
  (seatsBy as { read?: Seats; most?: Most }).most = most;
}
function seatedCells(g: HomeWorld, text: string): number[] {
  const read = (seatsBy as { read?: Seats }).read;
  if (!read) throw new Error("the peopled world is not loaded");
  return read(g, text);
}
function seatsAtMost(g: HomeWorld, text: string): number {
  const most = (seatsBy as { most?: Most }).most;
  if (!most) throw new Error("the peopled world is not loaded");
  return most(g, text);
}

/** The lands' grid of each size (rules/making.ts: the usual is 20). */
const GRID: Readonly<Record<string, number>> = {
  standard: 20,
  medium: MAKINGS.size.medium[0],
  small: MAKINGS.size.small[0],
};

/** A far world's face as the far sight draws it: its cells, those under sea level, those open ground, those open sea. */
export function farFace(
  world: World,
  s: GalaxyStar,
  p: ForeignPlanet,
): { cells: number; low: number; ground: number; sea: number } {
  const digest = homePlanet(world).generated.digest,
    key = `${digest} ${s.sector}:${s.k}/${p.index}`,
    known = FACES.get(key);
  if (known) return known;
  const w = otherWorld(foreignBody(s, p, p.index), s, p.a, digest);
  let low = 0,
    ground = 0,
    sea = 0;
  for (let c = 0; c < w.elevation.length; c++) {
    if (w.elevation[c]! <= 0) low++;
    if (w.cover[c] === 0) ground++;
    else if (w.cover[c] === 1) sea++;
  }
  const face = { cells: Math.max(1, w.elevation.length), low, ground, sea };
  if (FACES.size >= 32) FACES.delete(FACES.keys().next().value!);
  FACES.set(key, face);
  return face;
}
const FACES = new Map<string, { cells: number; low: number; ground: number; sea: number }>();

/** Who is read: what the way in and the galaxy's account both take of a people. */
export type FarRead = {
  readonly name: string;
  readonly ref: string;
  readonly followed: boolean;
  /** Their body as their pages show it from afar. */
  readonly body: BodyPlan;
  readonly chem: readonly [number, number, number];
};

/**
 * The world a people's is made as: what was read (rules/far.ts FarMade), the acts laid on its dawn, its seed, and the
 * size of its lands' grid (the home world's, or the one asked for where that is smaller).
 */
export function farReadWorld(
  world: World,
  s: GalaxyStar,
  p: ForeignPlanet,
  who: FarRead,
  at: { year: number; stage: FarStage; people: number; universe: string; look: unknown },
  size?: string,
): { made: FarMade; acts: string[]; seed: string; asked: string; homeSize: string } {
  const face = farFace(world, s, p),
    made: FarMade = {
      v: 1,
      name: who.name,
      civ: who.ref,
      followed: who.followed,
      from: { universe: at.universe, seed: world.seed.text },
      year: at.year,
      stage: at.stage,
      people: at.people,
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
        index: p.index,
        a: p.a,
        mass: p.mass,
        radius: p.radius,
        gravity: p.gravity,
        temperature: p.temperature,
        pressure: p.pressure,
        seas: face.cells > 1 ? face.low / face.cells : 0.5,
      },
      chem: who.chem,
      hand: handDraw(who.ref),
      body: who.body,
      look: at.look,
    },
    // (The laws of its universe and its lands' grid as the home world's are; its own sky kept small.)
    home = makingsOf(world.seed.text),
    homeSize = home.size ?? "standard",
    asked = size && GRID[size] !== undefined && GRID[size]! < GRID[homeSize]! ? size : homeSize,
    acts = [
      makingAct("sky", "small"),
      ...(asked !== "standard" ? [makingAct("size", asked)] : []),
      ...(home.lanes ? [makingAct("lanes", home.lanes)] : []),
    ];
  return { made, acts, seed: farSeed(made, acts), asked, homeSize };
}

/** The first road shut to a people on the world made for a reading, with the lands it is seated on there (null: none). */
export function farShutOn(seed: string, made: FarMade): FarShut | null {
  if (made.stage === "camps") return null;
  const g = provinceWorld(generateHomeWorld(seedFromText(seed), OPEN), landsOf(seed));
  return farShut(g, made, undefined, seatedCells(g, seed));
}

/** The stages past camps, in the order a people comes to them. */
const STAGES: readonly FarStage[] = [
  "villages",
  "towns",
  "cities",
  "works",
  "signals",
  "orbit",
  "stars",
];

/**
 * How far a followed people's world lets it come, and what shuts the next step (null: nothing does); and the most of
 * them it holds, seated as the way in seats them (sim/population/world.ts seatsAtMost): a people read as more than its
 * world feeds is as many as it feeds.
 */
export type FarCeiling = {
  readonly ceiling: FarStage;
  readonly shut: FarShut | null;
  readonly holds: number;
  /**
   * How much longer than by fuel it takes them from the electron to what flies, where their works are driven by
   * another road (gen/far.ts machinesRoad: their rivers' fall, wind, hot ground or the atom; 1 by fuel).
   */
  readonly slow: number;
  /** The road their works are driven by, where they come to what flies (null: they do not). */
  readonly road: string | null;
};

/**
 * What was read of each followed people's ceiling, kept beside the world: a reading of its seed alone (its far
 * worlds made whole, some half a second each), so saved with it and no part of its rules or its hash. A save made
 * without it loads, and reads them again.
 */
export class FarReadStore implements StateStore {
  readonly name = "readings.far";
  readonly outsideRules = true;
  private readonly read = new Map<string, FarCeiling>();
  /** `seed`: its world's seed's text (what was read of it in this sitting, by any world of that seed, is its own too). */
  private readonly seed: string;
  constructor(seed: string) {
    this.seed = seed;
  }
  of(civ: string): FarCeiling | undefined {
    const c = this.read.get(civ) ?? CEILINGS.get(`${this.seed} ${civ}`);
    // (A save made before the most a world holds was kept beside its ceiling reads it again.)
    return c && c.holds !== undefined && c.slow !== undefined ? c : undefined;
  }
  set(civ: string, c: FarCeiling): void {
    this.read.set(civ, c);
  }
  hashInto(_h: Hasher): void {}
  save(): unknown {
    const all = new Map(this.read),
      own = `${this.seed} `;
    for (const [key, c] of CEILINGS) if (key.startsWith(own)) all.set(key.slice(own.length), c);
    return [...all].sort(([a], [b]) => (a < b ? -1 : 1));
  }
  load(state: unknown): void {
    this.read.clear();
    for (const [civ, c] of state as [string, FarCeiling][]) this.read.set(civ, c);
  }
}
const kept = (world: World): FarReadStore | null =>
  world.peek<FarReadStore>("readings.far") ?? null;

const CEILINGS = new Map<string, FarCeiling>();

/**
 * How far a followed people can come on its own world, as that world is made when it is entered at the home world's
 * size: the last stage at which no road to its age is shut to its limbs, by its world's matter, or (for an age that is
 * flown) for want of fuel under the lands it is then seated on. The same reading the way in makes, stage by stage, on
 * one making of its ground (a world's ground is its seed's name's, whatever stage it is entered at). `peopleAt`: how
 * many they are read as at a stage. Kept while the world is the same.
 */
export function farCeiling(
  world: World,
  s: GalaxyStar,
  who: FarRead,
  planet: number,
  peopleAt: (stage: FarStage) => number,
): FarCeiling {
  const key = `${world.seed.text} ${who.ref}`,
    known = CEILINGS.get(key) ?? kept(world)?.of(who.ref);
  if (known) return known;
  const p = foreignPlanets(new Rng(world.seed), s, worldLaws(world)?.gravity)[planet]!,
    reading = (stage: FarStage) =>
      farReadWorld(world, s, p, who, {
        year: 0,
        stage,
        people: peopleAt(stage),
        universe: "",
        look: null,
      }),
    top = reading("stars"),
    ground = provinceWorld(generateHomeWorld(seedFromText(top.seed), OPEN), landsOf(top.seed));
  let ceiling: FarStage = "stars",
    shut: FarShut | null = null,
    before: FarStage = "camps",
    // (The most it holds, read at the furthest it comes to: seated in the lands it is seated on there.)
    last: ReturnType<typeof reading> | null = null;
  for (const stage of STAGES) {
    const r = reading(stage),
      g = { ...ground, far: r.made },
      closed = farShut(g, r.made, undefined, seatedCells(g, r.seed));
    if (closed) {
      ceiling = before;
      shut = closed;
      break;
    }
    before = stage;
    last = r;
  }
  const at = last ?? reading("villages"),
    g = { ...ground, far: at.made },
    // (Where they come to what flies, by which road their works were driven when they first flew: with the crafts of
    // orbit, before the minds and drives of the stars, in the lands they are seated on at the furthest they come to.)
    flown = ceiling === "orbit" || ceiling === "stars",
    crafts = flown ? new Set(farCrafts(g, "orbit")) : null,
    driven = crafts
      ? machinesRoad(g, (id) => crafts.has(id), seatedCells(g, at.seed), at.made.people)
      : null,
    made: FarCeiling = {
      ceiling,
      shut,
      holds: seatsAtMost(g, at.seed),
      slow: driven?.slow ?? 1,
      road: driven?.road ?? null,
    };
  if (CEILINGS.size >= 64) CEILINGS.delete(CEILINGS.keys().next().value!);
  CEILINGS.set(key, made);
  kept(world)?.set(who.ref, made);
  return made;
}

/** The age before the one a road is shut at, by name ("the age of engines"). */
export function ageBefore(shut: FarShut): string {
  const at = AGE_LADDER.findIndex((a) => a.id === shut.age);
  return AGE_LADDER[Math.max(0, at - 1)]!.name;
}

/** Whether a stage is at or past the age a road is shut at. */
export function pastShut(stage: FarStage, shut: FarShut): boolean {
  const age = (id: string) => AGE_LADDER.findIndex((a) => a.id === id);
  return age(FAR_STAGE_AGE[stage]) >= age(shut.age);
}
