// A far people's life as it is read off its own world (round F; the rules are rules/farlife.ts). What a far world and its people's
// bodies are, read once into the few facts its life steps by; and its life read from its first year out of camps to any year asked,
// a decade at a time, its draws keyed to it: the same world always reads the same life, and reading it changes nothing. History
// takes a people's life up from this reading in the year it first matters (sim/space/farlife.ts) and lives it on from there.
//
// A people history does not follow is read whole here: the years its rungs came and went, the year it fell and why. natives.ts
// gives a people its life as it reads it (livedFolk), so where it stands in a year is what its own numbers say, not a clock.
import { Rng, dmath, hashString, type World } from "../../kernel/index.ts";
import {
  civBody,
  foreignPlanets,
  type Civilization,
  type ForeignPlanet,
  type GalaxyStar,
} from "../../gen/index.ts";
import {
  FAR_LIFE,
  FAR_RUNGS,
  GATE_WORDS,
  STARS_RUNG,
  affordancesOf,
  farBegins,
  farStep,
  farStrength,
  gateOf,
  hottest,
  seaFlows,
  toOrbit,
  type BodyPlan,
  type FarFacts,
  type FarState,
} from "../../rules/index.ts";
import type { Folk, FolkStage } from "./natives.ts";
import { clusterOf } from "./stars.ts";
import { lawlessSeed } from "./lanes.ts";
import { farLifeOf, ringOf, unpack, type FarRow } from "./farlife-store.ts";

/** A whole world's face, km², by its radius (Earth's 1). */
const faceKm2 = (radius: number) => 4 * Math.PI * (6371 * radius) * (6371 * radius);

/** Fuel buried under a km² of a world like home's whose bodies came ashore 0.45 thousand million years ago (MJ, est.: Earth's coal, oil and gas in place). */
const FUEL_MJ_KM2 = 3e9;

/** A keyed draw of the reading's own (0 … 1). */
const drawOf = (key: string, n: number | string) => (hashString(`${key} ${n}`) >>> 0) / 4294967296;

/** How far a world's uranium has decayed since home's (its fissile share against home's now: U-235's half-life 0.704 thousand million years). */
const fissileOf = (ageGyr: number) => dmath.pow(2, -(ageGyr - 4.6) / 0.704);

/** The facts a world gives any people's life on it, whatever their body. */
function worldFacts(
  key: string,
  s: GalaxyStar,
  p: ForeignPlanet,
  body: BodyPlan,
  oxygen: boolean,
): Omit<FarFacts, "sows" | "stores" | "heat" | "metals" | "fire" | "grips" | "fuelMJ" | "ceiling"> {
  const sea = body.medium === "water",
    face = faceKm2(p.radius),
    wet = p.water === "seas",
    // (Of a world with seas, some three in ten of its face is land and seven in ten of that will bear a people; of a dry one, more
    // land and less of it kind. A people of the sea works its shelves and vent fields: a tenth of its seas.)
    area = sea ? face * 0.7 * 0.1 : face * (wet ? 0.3 * 0.7 : 0.6 * 0.3),
    flows = seaFlows({
      radius: p.radius,
      ageGyr: s.ageGyr,
      starMass: s.mass,
      au: p.a,
      moon: drawOf(key, "moon"),
      lifeDraw: drawOf(key, "current"),
    }),
    hotGround =
      500 * dmath.sqrt(Math.max(0.1, p.radius)) * dmath.sqrt(4.6 / Math.max(0.5, s.ageGyr));
  return {
    key,
    sea,
    areaKm2: area,
    warmth: p.temperature,
    gravity: p.gravity,
    pressure: p.pressure,
    oxygen,
    light: s.luminosity / Math.max(1e-6, p.a * p.a),
    bodyKg: body.size,
    span: body.span,
    social: body.social,
    flesh: body.diet === "flesh",
    // (Rain falling from its heights at its own pull; the wind its warmth's contrast drives, as thick as its air; est.)
    river: wet ? 3000 * p.gravity : 600 * p.gravity,
    wind: 20_000,
    hot: hotGround,
    vents: sea ? flows.vents : 0,
    tides: wet ? flows.tides : 0,
    bioCurrent: flows.bioCurrent,
    fissile: fissileOf(s.ageGyr),
    orbitKms: toOrbit({ gravity: p.gravity, radius: p.radius, pressure: p.pressure }).total,
  };
}

/** The rung a reading's stage stands for. */
export const rungOfStage = (stage: FolkStage): number => {
  const i = FAR_RUNGS.indexOf(stage as (typeof FAR_RUNGS)[number]);
  return i < 0 ? 0 : i;
};

/** What a people's life steps by, from what is read of it on its world (natives.ts' reading). */
export function folkFacts(seed: string, s: GalaxyStar, p: ForeignPlanet, f: Folk): FarFacts {
  const key = `${seed} farlife ${f.ref}`,
    base = worldFacts(key, s, p, f.body, f.oxygen),
    heat = hottest(f.means).heat,
    // (A people of the sea is held by no fire: its own road, read by its gates. Else what the far reading found shut.)
    ceiling = base.sea ? (f.body.social < 0.3 ? 0 : 4) : rungOfStage(f.ceiling);
  return {
    ...base,
    sows: base.sea ? f.body.social >= 0.3 : ceiling >= 1,
    stores: base.sea ? f.body.social >= 0.45 : !!f.means.vessel && heat >= f.means.vessel.heat,
    heat,
    metals: heat >= 1000 && f.means.hardens,
    fire: f.means.burns,
    grips: f.means.grips,
    fuelMJ:
      f.means.burns && !base.sea && f.bodiesAgo >= 0.15
        ? FUEL_MJ_KM2 * Math.min(2.5, f.bodiesAgo / 0.45)
        : 0,
    ceiling,
  };
}

/** What a followed people's life steps by: its world, and its body (gen/civilizations.ts' own). Its rungs are history's. */
export function civFacts(world: World, civ: Civilization): FarFacts | null {
  const s = clusterOf(world).find((x) => civ.star.endsWith(`:${x.sector}:${x.k}`)),
    p = s ? foreignPlanets(new Rng(world.seed), s)[civ.planet] : undefined,
    body = civBody(civ);
  if (!s || !p || !body) return null;
  const oxygen = p.air === "breathable",
    a = affordancesOf(body),
    base = worldFacts(`${lawlessSeed(world.seed.text)} farlife ${civ.ref}`, s, p, body, oxygen),
    burns = a.fire && oxygen,
    // (How long its bodies have had ashore, from its star's age: Earth's came out some 4.1 thousand million years after its sun. Est.)
    ashore = Math.max(0, s.ageGyr - 4.15);
  return {
    ...base,
    sows: true,
    stores: true,
    heat: burns ? 1500 : 400,
    metals: burns || base.sea,
    fire: burns,
    grips: a.dexterity >= 0.5,
    fuelMJ: burns && !base.sea ? FUEL_MJ_KM2 * Math.min(2.5, Math.max(0.3, ashore / 0.45)) : 0,
    ceiling: STARS_RUNG,
  };
}

/** The rung history holds a followed people at in a year: its climb, then its signals, orbit and stars (gen/civilizations.ts). */
const CLIMB_YEARS = [0, 130, 300, 500, 720];
export function clockRung(civ: Civilization, year: number): number {
  if (year >= civ.stars) return 7;
  if (year >= civ.orbit) return 6;
  if (year >= civ.electronics) return 5;
  const climb = (year - civ.offset) / civ.pace;
  let r = 0;
  for (let i = 1; i < CLIMB_YEARS.length; i++) if (climb >= CLIMB_YEARS[i]!) r = i;
  return r;
}

/** A followed people's step: its own numbers lived, its rung history's; it does not fall from history's view, but breaks. */
export function heldTo(s: FarState, next: FarState, rung: number): FarState {
  const people = next.fell !== null ? Math.max(s.people * 0.5, 0.2 * s.peak) : next.people;
  return {
    ...next,
    people,
    rung,
    know: Math.max(next.know, rung),
    top: Math.max(next.top, rung),
    fell: null,
  };
}

/** Why a people fell, read off what pressed on it most when it did. */
export function fellWords(s: FarState, top: number): string {
  if (s.warmed >= 2 && top >= 4)
    return "Their fields baked and blew away as the fuel they burned warmed their air.";
  if (s.fuel < 0.1 && top >= 4)
    return "Their fuel ran out under their works, and the fields their works had fed fed no one.";
  if (s.sick >= 0.3)
    return "A sickness went through them, with no one left unhurt to tend the rest.";
  if (s.war >= 0.4) return "Their wars burned what their towns lived on, and the towns went after.";
  if (s.worn >= 0.45) return "Their fields gave out under them, faster than they could learn why.";
  if (s.broken) return "They turned on one another, and what held their towns together let go.";
  return "Hunger came in a run of bad years, and their towns emptied.";
}

// —— A life read through the years ————————————————————————————————————————————————————————————

/** One year's numbers as a chart reads them. */
export type FarSample = {
  readonly year: number;
  readonly people: number;
  readonly made: number;
  readonly letters: number;
  readonly cohesion: number;
  readonly fear: number;
  readonly rung: number;
};

export const sampleOf = (year: number, s: FarState): FarSample => ({
  year,
  people: s.people,
  made: s.made,
  letters: s.letters,
  cohesion: s.cohesion,
  fear: s.fear,
  rung: s.rung,
});

/** A people's life as read, kept as far as it has been asked. */
export type FarReading = {
  readonly facts: FarFacts;
  readonly from: number;
  /** Its numbers every hundred years from its first (checkpoints), and as far as read. */
  readonly kept: FarState[];
  at: number;
  state: FarState;
  /** The years its rung changed, and to what (year, rung, year, rung …): its first is its first year. */
  readonly rungs: number[];
  /** Every fifty years, for its chart. */
  readonly samples: FarSample[];
  /** Why it fell, where it did. */
  fellWhy: string | null;
  /** Its rung by a year history holds (null: its own, as its numbers say). */
  readonly clock: ((year: number) => number) | null;
};

const KEPT_EVERY = 100;
const SAMPLE_EVERY = 50;

export function beginReading(
  facts: FarFacts,
  from: number,
  clock: ((year: number) => number) | null,
): FarReading {
  const first = farBegins(facts),
    state = clock ? { ...first, rung: clock(from), know: clock(from), top: clock(from) } : first;
  return {
    facts,
    from,
    kept: [state],
    at: from,
    state,
    rungs: [from, state.rung],
    samples: [sampleOf(from, state)],
    fellWhy: null,
    clock,
  };
}

/** The step's draw of a reading: keyed to the people and the step, the same each time it is read. */
export const stepDraw = (facts: FarFacts, year: number) => drawOf(facts.key, year);

/** Read a people's life on to `year` (a step at a time; nothing once it fell). */
export function readOn(r: FarReading, year: number): void {
  while (r.at + FAR_LIFE.step <= year && r.state.fell === null) {
    const to = r.at + FAR_LIFE.step,
      lived = farStep(r.facts, r.state, FAR_LIFE.step, stepDraw(r.facts, to), to),
      next = r.clock ? heldTo(r.state, lived, r.clock(to)) : lived;
    if (next.fell !== null && r.fellWhy === null) r.fellWhy = fellWords(r.state, r.state.top);
    r.state = next;
    r.at = to;
    if (next.rung !== r.rungs[r.rungs.length - 1]) r.rungs.push(to, next.rung);
    if ((to - r.from) % KEPT_EVERY === 0) r.kept.push(next);
    if ((to - r.from) % SAMPLE_EVERY === 0) r.samples.push(sampleOf(to, next));
  }
}

/** A people's numbers in a year, as read (from the nearest kept hundred years before it, read on). */
export function readAt(r: FarReading, year: number): FarState {
  if (year < r.from) return r.kept[0]!;
  if (year >= r.at) {
    readOn(r, year);
    return r.state;
  }
  const k = Math.min(r.kept.length - 1, Math.floor((year - r.from) / KEPT_EVERY));
  let s = r.kept[k]!,
    at = r.from + k * KEPT_EVERY;
  while (at + FAR_LIFE.step <= year && s.fell === null) {
    const to = at + FAR_LIFE.step,
      lived = farStep(r.facts, s, FAR_LIFE.step, stepDraw(r.facts, to), to);
    s = r.clock ? heldTo(s, lived, r.clock(to)) : lived;
    at = to;
  }
  return s;
}

/** How far ahead of its first year a people's life is read for its rungs: past this it is taken to stand as it stood. */
export const READ_AHEAD = 6000;

/** The stage of a reading's rung change points in a year ("ruins" from its fall). */
export function stageByRungs(
  rungs: readonly number[],
  fell: number | null,
  year: number,
): FolkStage {
  if (fell !== null && year >= fell) return "ruins";
  let r = 0;
  for (let i = 0; i < rungs.length; i += 2) {
    if (rungs[i]! > year) break;
    r = rungs[i + 1]!;
  }
  return FAR_RUNGS[r]! as FolkStage;
}

/** The highest rung a reading stood at before a year. */
export function topByRungs(rungs: readonly number[], year: number): number {
  let top = 0;
  for (let i = 0; i < rungs.length; i += 2) {
    if (rungs[i]! > year) break;
    top = Math.max(top, rungs[i + 1]!);
  }
  return top;
}

/** The readings of peoples' lives, kept while asked of (a world's few dozen). */
const READINGS = new Map<string, FarReading>();
export function readingKept(key: string, make: () => FarReading): FarReading {
  let r = READINGS.get(key);
  if (!r) {
    if (READINGS.size >= 256) READINGS.delete(READINGS.keys().next().value!);
    READINGS.set(key, (r = make()));
  }
  return r;
}

/**
 * A people history does not follow, with its life as its own numbers read it: the years its rungs came and went, the year it fell
 * and why; and for a people of the sea, a road of its own and not the fire's (natives.ts asks this of every people it reads).
 */
export function livedFolk(
  world: World,
  s: GalaxyStar,
  p: ForeignPlanet,
  f: Folk | null,
): Folk | null {
  if (!f || f.followed) return f;
  const seed = lawlessSeed(world.seed.text),
    r = readingKept(`${seed} ${f.ref}`, () =>
      beginReading(folkFacts(seed, s, p, f), f.arose, null),
    );
  readOn(r, f.arose + READ_AHEAD);
  const sea = r.facts.sea,
    top = r.state.fell !== null ? topByRungs(r.rungs, r.state.fell) : r.state.top,
    // (What holds a people of the sea is what its own road's next gate asks, not a fire it never had.)
    next = top < STARS_RUNG ? gateOf(r.facts, top + 1, r.state) : "open";
  return {
    ...f,
    ...(sea
      ? {
          ceiling: FAR_RUNGS[Math.min(4, Math.max(top, 0))]! as FolkStage,
          shut: next === "open" || top >= 4 ? null : `Under the water: ${GATE_WORDS[next]}.`,
        }
      : {}),
    lived: r,
    fell: r.state.fell,
    fellWhy: r.state.fell !== null ? r.fellWhy : null,
  };
}

// —— A followed people's life, as history holds it or as read ——————————————————————————————————————

/** A followed people's life as read from its first year (its rungs history's). */
export function civReading(world: World, civ: Civilization): FarReading | null {
  const facts = civFacts(world, civ);
  if (!facts) return null;
  return readingKept(`${lawlessSeed(world.seed.text)} civ ${civ.ref}`, () =>
    beginReading(facts, civ.offset, (y) => clockRung(civ, y)),
  );
}

/**
 * A followed people's numbers in a year: as history holds them from the year it took them up (its last step's; a year before it,
 * the nearest of its samples, with its weariness and strife as they stand), else as read off its world.
 */
export function livedState(world: World, civ: Civilization, year: number): FarState | null {
  const row = farLifeOf(world)?.get(civ.ref);
  if (row && year >= row.since) {
    const now = unpack(row);
    if (year >= row.last) return now;
    const past = ringOf(row)
      .filter((x) => x.year <= year)
      .at(-1);
    return past
      ? { ...now, people: past.people, made: past.made, cohesion: past.cohesion, rung: past.rung }
      : now;
  }
  const r = civReading(world, civ);
  return r ? readAt(r, year) : null;
}

/** How strong a followed people is among the stars in a year, by its numbers (rules/farlife.ts farStrength; 0.3 where none are read). */
export function livedStrength(world: World, civ: Civilization, year: number): number {
  const s = livedState(world, civ, year);
  return s ? farStrength(s) : 0.3;
}

// —— A people come down on: its life as history holds it from then ————————————————————————————————

/**
 * A people history does not follow, as history holds it: where history has taken its life up (a landing on it), where it stands
 * from then is history's, and whether and when it fell (natives.ts folkOf gives every people it reads through this).
 */
export function heldFolk(world: World, f: Folk | null): Folk | null {
  if (!f || f.followed || !f.lived) return f;
  const row = farLifeOf(world)?.get(f.ref);
  if (!row) return f;
  return { ...f, held: row, fell: row.fell, fellWhy: row.fell !== null ? row.why : null };
}

/** Where a people whose life is read stands in a year: history's from the year it took it up, else as its numbers read. */
export function livedStage(f: Folk, year: number): FolkStage {
  const held = (f as { held?: FarRow }).held;
  if (held && year >= held.since) return stageByRungs(held.rungs, f.fell, year);
  return stageByRungs(f.lived!.rungs, held ? null : f.fell, year);
}

/** The highest a people whose life is read stood before it fell. */
export function livedPeak(f: Folk): FolkStage {
  const held = (f as { held?: FarRow }).held,
    before = f.fell! - 1,
    top = Math.max(
      topByRungs(f.lived!.rungs, held ? Math.min(before, held.since) : before),
      held ? topByRungs(held.rungs, before) : 0,
    );
  return FAR_RUNGS[top]! as FolkStage;
}
