// The biosphere and its clades (docs/architecture §18): life's history over the ages
// of deep time, and the living world it left. In each age after land plants arose,
// lineages radiate into niches — heavy-seeded grasses, grazers, browsers, great
// beasts, hunters — each arising somewhere and fitted to the climate it arose in;
// in the ages of great volcanism or a falling stone many die, and in an icehouse or a
// hothouse those fitted to the other extreme. Those alive today range over the land
// connected to where they arose, as far as the climate suits them: so continents
// differ in what lives on them. Last of all, where the most kinds of beast lived on
// warm, watered land, the upright apes arose — the people — and that is the cradle.
// Some grazers are docile, herd-living and quick to grow, and can be tamed (under the
// Earthlike prior, always one in the people's own country); some grasses bear seed heavy
// enough to sow: where they live, herding and sowing can be found; elsewhere they must
// be learned. The hunters range wherever their game lives on land they can cross.
import { defineStream, weightedKey, type Rng, type SphereGrid } from "../kernel/index.ts";
import {
  CLADES,
  FOOD_WEB,
  bodyOf,
  creatureBody,
  creatureName,
  type BodyPlan,
  type Clade,
  type Conditions,
  type CreatureBody,
  type CreatureNiche,
  type Medium,
} from "../rules/index.ts";
import { BIOME, type Climate } from "./climate.ts";
import type { Hydrology } from "./hydrology.ts";
import { AGES, type DeepTime } from "./deeptime.ts";
import { speciesRef } from "./kinds.ts";

const BIO = defineStream("gen.biosphere");

export const NICHES = [
  "seed grass",
  "grazer",
  "browser",
  "great beast",
  "hunter",
  "upright ape",
  // The web's newer niches (Phase 9 M83), drawn after the rest.
  "seed-eater",
  "swimmer",
  "small hunter",
  "scavenger",
] as const;
export type Niche = (typeof NICHES)[number];
/** The niches the ages first filled (their lineages drawn first, as they always were). */
type ClassicNiche = "seed grass" | "grazer" | "browser" | "great beast" | "hunter";
/** The web's newer niches. */
type WebNiche = "seed-eater" | "swimmer" | "small hunter" | "scavenger";

/** At most this many lineages ever (one bit each in a cell's mask), in words of 32 a cell. */
export const MAX_SPECIES = 96;
export const SPECIES_WORDS = MAX_SPECIES / 32;
/** At most this many of the ages' first niches (as it always was: the rest are the web's). */
const CLASSIC = 64;

export type Species = {
  readonly index: number;
  readonly ref: string;
  readonly name: string;
  readonly niche: Niche;
  /** The age it arose in, and the age it died out in (null: it lives). */
  readonly arose: number;
  readonly died: number | null;
  /** Where it arose (a cell of today's land). */
  readonly origin: number;
  /** Its climate: the warmth it thrives at and how far from it it can live, °C; the rain it needs, mm. */
  readonly warm: number;
  readonly tolerance: number;
  readonly rainMin: number;
  readonly rainMax: number;
  /** Body and ways (animals): weight in kg, herding (0..1), docility (0..1), growth (0..1), wool. */
  readonly size: number;
  readonly herd: number;
  readonly docility: number;
  readonly growth: number;
  readonly wool: boolean;
  /** Grasses: how heavy their seed (0..1). */
  readonly seed: number;
  /** Whether it can be tamed (a herd beast) or sown (a grass). */
  readonly tame: boolean;
  /** Its body (M83: a beast's; null for a grass and for the people, whose body is their own). */
  readonly body: CreatureBody | null;
  /** Its level in the web of eating (1 a plant, 2 a plant-eater, 3 and 4 the hunters; 0 the people). */
  readonly level: number;
};

export type Biosphere = {
  /** Every lineage that ever arose, living and dead. */
  readonly species: readonly Species[];
  /** Per cell, a mask of the living lineages found there (SPECIES_WORDS words of 32 bits). */
  readonly present: Uint32Array;
  /** Per cell, the tamest herd beast and the best seed grass living there (-1: none). */
  readonly herdBeast: Int16Array;
  readonly seedGrass: Int16Array;
  /** Per cell, how many kinds of beast live there. */
  readonly diversity: Uint8Array;
  /**
   * The people: the lineage that rose to thought, where it arose, its body, and the
   * clade it came of and why that clade (null on a world with no place for any).
   */
  readonly people: {
    readonly species: number;
    readonly cell: number;
    readonly body: BodyPlan;
    readonly because: string;
  } | null;
};

/** The media a people can live in: land, the shore, and the shallow seas (M38). */
export const LIVABLE: readonly Medium[] = ["land", "shore", "water"];

/**
 * The clade that rises to thought on a world: the upright apes under the Earthlike prior
 * (Earth's own); otherwise, of the clades whose medium a people can live in, the one the
 * world's conditions favour, with chance.
 */
export function riseOf(
  prior: string,
  conditions: (medium: Medium) => Conditions | null,
  u: (i: number) => number,
): Clade | null {
  if (prior === "earthlike") return conditions("land") ? CLADES.find((c) => c.id === "ape")! : null;
  let best: Clade | null = null,
    key = Infinity;
  CLADES.forEach((c, i) => {
    const at = LIVABLE.includes(c.body.medium) ? conditions(c.body.medium) : null;
    if (!at) return;
    const k = weightedKey(u(i), c.fit(at));
    if (k < key) [best, key] = [c, k];
  });
  return best;
}

/** Whether a living lineage is found in a cell. */
export function lives(b: Biosphere, cell: number, species: number): boolean {
  return ((b.present[SPECIES_WORDS * cell + (species >> 5)]! >>> (species & 31)) & 1) === 1;
}

/** The living lineages found in a cell. */
export function livingIn(b: Biosphere, cell: number): Species[] {
  return b.species.filter((s) => s.died === null && lives(b, cell, s.index));
}

const HABITAT: Readonly<Record<Exclude<Niche, "upright ape">, readonly number[]>> = {
  "seed-eater": [
    BIOME.steppe,
    BIOME.savanna,
    BIOME.temperateForest,
    BIOME.tropicalDryForest,
    BIOME.borealForest,
    BIOME.coldDesert,
  ],
  // (A swimmer's water — a river, a lake, a coast — is asked of the cell too.)
  swimmer: [
    BIOME.steppe,
    BIOME.savanna,
    BIOME.temperateForest,
    BIOME.tropicalDryForest,
    BIOME.tropicalRainforest,
    BIOME.temperateRainforest,
    BIOME.borealForest,
    BIOME.tundra,
    BIOME.coldDesert,
    BIOME.hotDesert,
  ],
  "small hunter": [
    BIOME.temperateForest,
    BIOME.borealForest,
    BIOME.tropicalDryForest,
    BIOME.tropicalRainforest,
    BIOME.steppe,
    BIOME.savanna,
    BIOME.tundra,
  ],
  scavenger: [BIOME.savanna, BIOME.steppe, BIOME.hotDesert, BIOME.coldDesert, BIOME.tundra],
  "seed grass": [BIOME.steppe, BIOME.savanna, BIOME.temperateForest, BIOME.tropicalDryForest],
  grazer: [BIOME.steppe, BIOME.savanna, BIOME.coldDesert, BIOME.tundra, BIOME.temperateForest],
  browser: [
    BIOME.temperateForest,
    BIOME.borealForest,
    BIOME.tropicalDryForest,
    BIOME.tropicalRainforest,
    BIOME.temperateRainforest,
  ],
  "great beast": [BIOME.steppe, BIOME.savanna, BIOME.tundra, BIOME.borealForest],
  hunter: [
    BIOME.steppe,
    BIOME.savanna,
    BIOME.temperateForest,
    BIOME.borealForest,
    BIOME.tropicalDryForest,
    BIOME.tundra,
  ],
};

const COLOURS = ["dun", "red", "grey", "black", "pale", "brindled", "spotted", "golden"];
/** Told apart further, when every colour of a kind is taken. */
const KINDS = ["lesser", "greater", "highland", "lowland", "northern", "southern", "long-horned"];

function nameOf(
  niche: ClassicNiche | "upright ape",
  warm: number,
  rain: number,
  size: number,
  wool: boolean,
  u: number,
): string {
  const colour = COLOURS[Math.floor(u * COLOURS.length)]!;
  switch (niche) {
    case "seed grass":
      return warm < 12
        ? `${colour} bearded grass`
        : rain > 1100
          ? `${colour} water grass`
          : warm > 22
            ? `${colour} millet`
            : `${colour} wild grain`;
    case "grazer":
      if (size < 90) return wool ? `${colour} woolly sheep` : `${colour} goat`;
      if (size > 450) return `${colour} buffalo`;
      if (rain < 350 && warm > 12) return `${colour} camel`;
      return u < 0.5 ? `${colour} ox` : `${colour} horse`;
    case "browser":
      return warm < 5 ? `${colour} elk` : rain > 1500 ? `${colour} tapir` : `${colour} deer`;
    case "great beast":
      return warm < 5
        ? `${colour} woolly giant`
        : u < 0.5
          ? `${colour} great tusker`
          : `${colour} great sloth`;
    case "hunter":
      return warm < 5 ? `${colour} wolf` : u < 0.5 ? `${colour} cat` : `${colour} bear`;
    case "upright ape":
      return "upright apes";
  }
}

/**
 * A body for a lineage of the Earthlike prior, to match the Earth name it bears: drawn as
 * any body is, then given what its name says it has (an ox its horns, a horse its mane and
 * no horns, a camel its hump, a tusker its tusks and trunk) and its own weight.
 */
function earthBody(
  niche: CreatureNiche,
  home: { warm: number; rain: number },
  name: string,
  size: number,
  wool: boolean,
  u: (k: number) => number,
): CreatureBody {
  const b = creatureBody(niche, { gravity: 1, ocean: 0.7, pressure: 1, earthlike: true }, home, u),
    has = (w: string) => new RegExp(`\\b${w}\\b`).test(name),
    features = b.features.filter(
      (f) => !["horns", "wide-horns", "hump", "mane", "antlers", "tusks", "trunk"].includes(f),
    );
  if (has("ox") || has("goat") || has("sheep")) features.push("horns");
  if (has("buffalo")) features.push("wide-horns");
  if (has("camel")) features.push("hump");
  if (has("horse")) features.push("mane");
  if (has("deer") || has("elk")) features.push("antlers");
  if (has("tusker") || has("giant")) features.push("tusks", "trunk");
  if (has("cat") && u(12) < 0.4) features.push("mane");
  // Its shape, as its name says: a tapir's and a bear's short neck, a camel's long one; a
  // bear's stub of a tail, a cat's long one.
  const neck =
      has("tapir") || has("bear") || has("ox") || has("buffalo")
        ? 0.25
        : has("camel")
          ? 0.9
          : has("horse") || has("deer") || has("elk")
            ? Math.max(0.6, b.neck)
            : b.neck,
    tail =
      has("bear") || has("tapir") || has("goat") || has("sheep") || has("deer") || has("elk")
        ? 0.12
        : has("cat")
          ? 0.8
          : has("horse") || has("wolf")
            ? 0.55
            : b.tail;
  return {
    ...b,
    size,
    covering: wool || has("sheep") || has("giant") ? "wool" : b.covering,
    moves: has("bear") ? "walk" : b.moves,
    neck,
    tail,
    features,
  };
}

export function makeBiosphere(
  grid: SphereGrid,
  rng: Rng,
  climate: Climate,
  water: Hydrology,
  elevation: Float32Array,
  deep: DeepTime,
  world: {
    readonly prior: string;
    readonly gravity: number;
    readonly ocean: number;
    /** Its air at the ground, bar (1 if not said): a thicker one bears more fliers. */
    readonly pressure?: number;
  } = {
    prior: "earthlike",
    gravity: 1,
    ocean: 0.7,
  },
): Biosphere {
  const n = grid.count,
    earthlike = world.prior === "earthlike",
    worldBeasts = {
      gravity: world.gravity,
      ocean: world.ocean,
      pressure: world.pressure ?? 1,
      earthlike,
    },
    land = (c: number) => elevation[c]! > 0,
    alive: {
      s: Omit<Species, "died" | "index" | "ref">;
      died: number | null;
    }[] = [];

  // Lineages radiate age by age, into niches the age's climate favours; the ages' great
  // events and extremes kill many.
  for (let k = 1; k < AGES; k++) {
    const age = deep.ages[k]!,
      count = 2 + Math.floor(rng.real(BIO, k, 0, 0) * 3);
    for (let i = 0; i < count && alive.length < CLASSIC - 1; i++) {
      const cool = age.warmth < 1,
        // Grasses spread late, as the world cooled and dried into open country.
        late = k >= AGES - 4,
        weights: Record<ClassicNiche, number> = {
          "seed grass": (cool ? 1.4 : 0.8) * (late ? 2 : 1),
          grazer: cool ? 1.6 : 1,
          browser: cool ? 0.8 : 1.4,
          "great beast": 0.5,
          hunter: 0.7,
        };
      const niches = Object.keys(weights) as ClassicNiche[],
        pick = rng.real(BIO, k, 1, i) * niches.reduce((a, x) => a + weights[x], 0);
      let acc = 0,
        niche = niches[0]!;
      for (const x of niches) {
        acc += weights[x];
        if (pick < acc) {
          niche = x;
          break;
        }
      }
      // Where it arose: a land cell whose climate is of its habitat, by keyed draw.
      let origin = -1,
        best = Infinity;
      for (let c = 0; c < n; c += 3) {
        if (!land(c) || !HABITAT[niche].includes(climate.biome[c]!)) continue;
        const key = weightedKey(rng.real(BIO, c, k, 10 + i), 1);
        if (key < best) {
          best = key;
          origin = c;
        }
      }
      if (origin < 0) continue;
      const u = (m: number) => rng.real(BIO, k, 2 + m, i),
        warm = climate.temperature[origin]!,
        rain = climate.precipitation[origin]!,
        animal = niche !== "seed grass",
        size =
          niche === "great beast"
            ? 2000 + 4000 * u(0)
            : niche === "grazer"
              ? 30 + 700 * u(0) * u(0)
              : niche === "browser"
                ? 40 + 400 * u(0)
                : niche === "hunter"
                  ? 30 + 250 * u(0)
                  : 0,
        herd = animal ? (niche === "grazer" ? 0.4 + 0.6 * u(1) : 0.5 * u(1)) : 0,
        docility = animal ? (niche === "hunter" ? 0.1 * u(2) : u(2)) : 0,
        growth = animal ? u(3) : 0,
        wool = niche === "grazer" && warm < 14 && u(4) < 0.5,
        seed = niche === "seed grass" ? u(5) : 0,
        tame =
          (niche === "grazer" &&
            herd > 0.5 &&
            docility > 0.4 &&
            growth > 0.3 &&
            size >= 25 &&
            size <= 900) ||
          (niche === "seed grass" && seed > 0.45),
        // Grasses and grazers of the open country range widely; the rest keep closer to home.
        open = niche === "seed grass" || niche === "grazer";
      // Its body (M83), on draws of its own, so the ages' other draws are as they were.
      const b = (m: number) => rng.real(BIO, k, 30 + m, i),
        body = animal
          ? earthlike
            ? null
            : { ...creatureBody(niche as CreatureNiche, worldBeasts, { warm, rain }, b), size }
          : null;
      // Each lineage its own name: another colour if its first is taken. Under the
      // Earthlike prior, Earth's own names (and bodies to match); elsewhere, from its body.
      const named = (v: number) =>
        body
          ? creatureName(body, niche as CreatureNiche, { warm, rain }, false, v)
          : nameOf(niche, warm, rain, size, wool, v);
      let name = named(u(6));
      for (let turn = 1; turn < COLOURS.length && alive.some((a) => a.s.name === name); turn++)
        name = named((u(6) + turn / COLOURS.length) % 1);
      for (let q = 0; q < KINDS.length && alive.some((a) => a.s.name === name); q++)
        name = `${KINDS[q]} ${named(u(6))}`;
      alive.push({
        s: {
          name,
          niche,
          arose: k,
          origin,
          warm: Math.round(warm),
          tolerance: (open ? 8 : 5) + Math.round(8 * u(7)),
          rainMin: Math.round(rain * (open ? 0.4 : 0.5)),
          rainMax: Math.round(rain * (open ? 2.2 : 1.8) + 100),
          size: Math.round(size),
          herd: Math.round(herd * 100) / 100,
          docility: Math.round(docility * 100) / 100,
          growth: Math.round(growth * 100) / 100,
          wool,
          seed: Math.round(seed * 100) / 100,
          tame,
          body: !animal
            ? null
            : (body ??
              earthBody(niche as CreatureNiche, { warm, rain }, name, Math.round(size), wool, b)),
          level: FOOD_WEB[niche].level,
        },
        died: null,
      });
    }
    // The age's end: great events kill many; an icehouse the warm-fitted, a hothouse the cold.
    alive.forEach((a, j) => {
      if (a.died !== null || a.s.arose === k) return;
      const warmFit = a.s.warm > 18,
        coldFit = a.s.warm < 5,
        risk =
          age.kind === "impact"
            ? 0.5
            : age.kind === "great volcanism"
              ? 0.3
              : age.kind === "icehouse" && warmFit
                ? 0.4
                : age.kind === "hothouse" && coldFit
                  ? 0.4
                  : 0.04;
      // Plants weather the worst better than beasts: their seed waits in the ground.
      if (rng.real(BIO, j, k, 90) < risk * (a.s.niche === "seed grass" ? 0.5 : 1)) a.died = k;
    });
  }

  // The living range over the land joined to where they arose, as far as the climate suits them.
  const present = new Uint32Array(SPECIES_WORDS * n),
    diversity = new Uint8Array(n),
    species: Species[] = alive.map((a, index) => ({
      index,
      ref: speciesRef(0, index),
      ...a.s,
      died: a.died,
    }));
  const fits = (s: Species, c: number) =>
    land(c) &&
    climate.biome[c] !== BIOME.ice &&
    Math.abs(climate.temperature[c]! - s.warm) <= s.tolerance &&
    climate.precipitation[c]! >= s.rainMin &&
    climate.precipitation[c]! <= s.rainMax;
  const spread = (s: Species) => {
    if (!fits(s, s.origin)) return;
    const seen = new Uint8Array(n),
      queue = [s.origin];
    seen[s.origin] = 1;
    for (let h = 0; h < queue.length; h++) {
      const c = queue[h]!;
      present[SPECIES_WORDS * c + (s.index >> 5)]! |= 1 << (s.index & 31);
      if (s.niche !== "seed grass") diversity[c] = Math.min(255, diversity[c]! + 1);
      for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
        const m = grid.neighbours[k]!;
        if (!seen[m] && fits(s, m)) {
          seen[m] = 1;
          queue.push(m);
        }
      }
    }
  };
  for (const s of species) if (s.died === null) spread(s);

  // What can be tamed or sown, cell by cell: the best of what lives there.
  const herdBeast = new Int16Array(n).fill(-1),
    seedGrass = new Int16Array(n).fill(-1);
  for (let c = 0; c < n; c++) {
    let beast = -1,
      beastWorth = -1,
      grass = -1,
      grassWorth = -1;
    for (const s of species) {
      if (!s.tame || s.died !== null || !lives({ present } as Biosphere, c, s.index)) continue;
      if (s.niche === "grazer" && s.docility * s.growth > beastWorth) {
        beast = s.index;
        beastWorth = s.docility * s.growth;
      } else if (s.niche === "seed grass" && s.seed > grassWorth) {
        grass = s.index;
        grassWorth = s.seed;
      }
    }
    herdBeast[c] = beast;
    seedGrass[c] = grass;
  }
  // Last, the people: where the most kinds of beast live, and grasses whose seed can be
  // gathered, on warm, watered land; the clade that rises there is the one the world
  // favours (under the Earthlike prior, always the upright apes).
  let apesAt = -1,
    apesScore = -Infinity;
  // Open country and woodland edge first; on a world without any, whatever land is green.
  const edge = (b: number) =>
      b === BIOME.savanna ||
      b === BIOME.tropicalDryForest ||
      b === BIOME.temperateForest ||
      b === BIOME.steppe,
    green = (b: number) => b !== BIOME.ice && b !== BIOME.alpine && b !== BIOME.hotDesert,
    some = (fit: (b: number) => boolean) => {
      for (let c = 0; c < n; c++) if (land(c) && fit(climate.biome[c]!)) return true;
      return false;
    },
    // (A world of rock and ice alone still has its hardiest land.)
    cradleFit = some(edge) ? edge : some(green) ? green : (b: number) => b !== BIOME.ice;
  for (let c = 0; c < n; c++) {
    if (!land(c)) continue;
    const b = climate.biome[c]!;
    if (!cradleFit(b)) continue;
    const t = climate.temperature[c]!,
      mild = t > 14 && t < 28 ? 1 : 0.4,
      wet = water.river[c] ? 1.5 : 1,
      food = 1 + diversity[c]! + (seedGrass[c]! >= 0 ? 3 : 0) + (herdBeast[c]! >= 0 ? 2 : 0),
      score = food * mild * wet * (1 + 0.05 * rng.real(BIO, c, 0, 99));
    if (score > apesScore) {
      apesScore = score;
      apesAt = c;
    }
  }
  // Earth's own (the Earthlike prior): its first farmers found beasts to tame in their own
  // country — the land nearest the cradle, a twentieth of the world — as Earth's found
  // their sheep, goats and cattle. If no grazer there can be tamed, the herd-living one
  // found nearest the cradle can; if none lives there at all, one arose nearby in the
  // last age. (The cradle stands as the wild beasts chose it.)
  if (world.prior === "earthlike" && apesAt >= 0) {
    const seen = new Uint8Array(n),
      near = [apesAt];
    seen[apesAt] = 1;
    for (let h = 0; h < near.length; h++)
      for (let k = grid.offsets[near[h]!]!; k < grid.offsets[near[h]! + 1]!; k++) {
        const m = grid.neighbours[k]!;
        if (!seen[m] && land(m)) {
          seen[m] = 1;
          near.push(m);
        }
      }
    const grazing = (c: number, tame: boolean) =>
      species.find(
        (s) =>
          s.niche === "grazer" &&
          s.died === null &&
          (tame ? s.tame : s.size >= 25 && s.size <= 900) &&
          lives({ present } as Biosphere, c, s.index),
      );
    const country = near.slice(0, Math.ceil(n / 20));
    let herd: Species | undefined;
    if (!country.some((c) => grazing(c, true))) {
      for (const c of country) if ((herd = grazing(c, false))) break;
      if (herd) species[herd.index] = herd = { ...herd, tame: true };
      else if (species.length < CLASSIC - 1) {
        const origin = near.find((c) => HABITAT.grazer.includes(climate.biome[c]!));
        if (origin !== undefined) {
          const u = (m: number) => rng.real(BIO, AGES, 200 + m, 0),
            warm = climate.temperature[origin]!,
            rain = climate.precipitation[origin]!,
            size = 40 + 200 * u(0),
            wool = warm < 14 && u(4) < 0.5;
          let name = nameOf("grazer", warm, rain, size, wool, u(6));
          for (let turn = 1; turn < COLOURS.length && species.some((x) => x.name === name); turn++)
            name = nameOf("grazer", warm, rain, size, wool, (u(6) + turn / COLOURS.length) % 1);
          for (let q = 0; q < KINDS.length && species.some((x) => x.name === name); q++)
            name = `${KINDS[q]} ${nameOf("grazer", warm, rain, size, wool, u(6))}`;
          herd = {
            index: species.length,
            ref: speciesRef(0, species.length),
            name,
            niche: "grazer",
            arose: AGES - 1,
            died: null,
            origin,
            warm: Math.round(warm),
            tolerance: 8 + Math.round(8 * u(7)),
            rainMin: Math.round(rain * 0.4),
            rainMax: Math.round(rain * 2.2 + 100),
            size: Math.round(size),
            herd: Math.round((0.6 + 0.4 * u(1)) * 100) / 100,
            docility: Math.round((0.5 + 0.4 * u(2)) * 100) / 100,
            growth: Math.round((0.4 + 0.5 * u(3)) * 100) / 100,
            wool,
            seed: 0,
            tame: true,
            body: earthBody("grazer", { warm, rain }, name, Math.round(size), wool, (m) =>
              rng.real(BIO, AGES, 230 + m, 0),
            ),
            level: FOOD_WEB.grazer.level,
          };
          species.push(herd);
          spread(herd);
        }
      }
    }
    if (herd)
      for (let c = 0; c < n; c++)
        if (herdBeast[c]! < 0 && lives({ present } as Biosphere, c, herd.index))
          herdBeast[c] = herd.index;
  }
  // A people of the water arise on a warm reef shelf by a coast; one of the shore on warm
  // land where such a shelf meets it.
  const shelfBy = (c: number) => {
    let reef = 0;
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++)
      if (climate.biome[grid.neighbours[k]!] === BIOME.shelf) reef++;
    return reef;
  };
  const coastOf = (c: number) => {
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++)
      if (land(grid.neighbours[k]!) !== land(c)) return true;
    return false;
  };
  let seaAt = -1,
    seaScore = -Infinity,
    shoreAt = -1,
    shoreScore = -Infinity;
  for (let c = 0; c < n; c++) {
    const t = climate.temperature[c]!,
      mild = t > 14 && t < 30 ? 1 : t > 4 ? 0.4 : 0;
    if (!mild || !coastOf(c)) continue;
    const u = 1 + 0.05 * rng.real(BIO, c, 0, 98);
    if (climate.biome[c] === BIOME.shelf) {
      const score = mild * (1 + shelfBy(c)) * u;
      if (score > seaScore) [seaAt, seaScore] = [c, score];
    } else if (land(c) && shelfBy(c) > 0 && climate.biome[c] !== BIOME.ice) {
      const score = mild * (1 + shelfBy(c) + diversity[c]!) * u;
      if (score > shoreScore) [shoreAt, shoreScore] = [c, score];
    }
  }
  // The hunters follow their prey (Phase 8 M77): beyond the country that suits them best,
  // a hunting lineage crosses the land joined to its own, within a wider warmth than it
  // thrives at, and lives wherever its game lives there — so most lands with game have
  // their hunters, and a land no hunter can reach has none. (Reckoned after the cradle,
  // which the beasts chose where they first lived, and leaving the count of kinds as it was.)
  const preyMask = new Uint32Array(SPECIES_WORDS);
  for (const s of species)
    if (
      s.died === null &&
      (s.niche === "grazer" || s.niche === "browser" || s.niche === "great beast")
    )
      preyMask[s.index >> 5] = (preyMask[s.index >> 5]! | (1 << (s.index & 31))) >>> 0;
  const hasPrey = (c: number) => {
    for (let w = 0; w < SPECIES_WORDS; w++)
      if ((present[SPECIES_WORDS * c + w]! & preyMask[w]!) !== 0) return true;
    return false;
  };
  for (const s of species) {
    if (s.died !== null || s.niche !== "hunter") continue;
    const roams = (c: number) =>
        land(c) &&
        climate.biome[c] !== BIOME.ice &&
        Math.abs(climate.temperature[c]! - s.warm) <= s.tolerance + 14,
      bit = 1 << (s.index & 31),
      word = s.index >> 5,
      seen = new Uint8Array(n),
      queue: number[] = [];
    for (let c = 0; c < n; c++)
      if ((present[SPECIES_WORDS * c + word]! & bit) !== 0) {
        seen[c] = 1;
        queue.push(c);
      }
    // (A lineage whose best country held no cell of its own starts where it arose.)
    if (!queue.length && roams(s.origin)) {
      seen[s.origin] = 1;
      queue.push(s.origin);
    }
    for (let h = 0; h < queue.length; h++) {
      const c = queue[h]!;
      // (Passing through where there is no game; living where there is.)
      if (hasPrey(c))
        present[SPECIES_WORDS * c + word] = (present[SPECIES_WORDS * c + word]! | bit) >>> 0;
      for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
        const m = grid.neighbours[k]!;
        if (!seen[m] && roams(m)) {
          seen[m] = 1;
          queue.push(m);
        }
      }
    }
  }
  const cradleOf: Record<Medium, number> = { land: apesAt, water: seaAt, shore: shoreAt };
  const conditionsIn = (medium: Medium): Conditions | null => {
    const c = cradleOf[medium];
    return c < 0
      ? null
      : {
          warmth: climate.temperature[c]!,
          rain: climate.precipitation[c]!,
          gravity: world.gravity,
          ocean: world.ocean,
        };
  };
  /**
   * The web's newer niches (M83): seed-eaters, swimmers, small hunters and scavengers,
   * drawn age by age on streams of their own and added after all the rest — the ages'
   * first lineages, the cradle and the people are as they were — each living where its
   * climate suits it (a swimmer only by a river, a lake or a coast), dying in the ages'
   * great deaths as the rest do.
   */
  function web(): void {
    const later: { s: Omit<Species, "died" | "index" | "ref">; died: number | null }[] = [],
      wet = (c: number) => {
        if (water.river[c] || water.lake[c]) return true;
        for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++)
          if (!land(grid.neighbours[k]!)) return true;
        return false;
      },
      weights: Record<WebNiche, number> = {
        "seed-eater": 1,
        swimmer: 0.9,
        "small hunter": 0.7,
        scavenger: 0.45,
      },
      kinds = Object.keys(weights) as WebNiche[],
      total = kinds.reduce((a, x) => a + weights[x], 0);
    for (let k = 1; k < AGES; k++) {
      const age = deep.ages[k]!,
        count = 1 + Math.floor(rng.real(BIO, k, 60, 0) * 3);
      for (let i = 0; i < count && species.length + later.length < MAX_SPECIES; i++) {
        let pick = rng.real(BIO, k, 61, i) * total,
          niche: WebNiche = kinds[0]!;
        for (const x of kinds) {
          if (pick < weights[x]) {
            niche = x;
            break;
          }
          pick -= weights[x];
        }
        let origin = -1,
          best = Infinity;
        for (let c = 0; c < n; c++) {
          if (!land(c) || !HABITAT[niche].includes(climate.biome[c]!)) continue;
          if (niche === "swimmer" && !wet(c)) continue;
          const key = weightedKey(rng.real(BIO, c, k, 70 + i), 1);
          if (key < best) {
            best = key;
            origin = c;
          }
        }
        if (origin < 0) continue;
        const u = (m: number) => rng.real(BIO, k, 80 + m, i),
          warm = climate.temperature[origin]!,
          rain = climate.precipitation[origin]!,
          body = creatureBody(niche, worldBeasts, { warm, rain }, u),
          taken = (x: string) =>
            species.some((s) => s.name === x) || later.some((a) => a.s.name === x);
        let name = creatureName(body, niche, { warm, rain }, earthlike, u(20));
        for (let turn = 1; turn < COLOURS.length && taken(name); turn++)
          name = creatureName(
            body,
            niche,
            { warm, rain },
            earthlike,
            (u(20) + turn / COLOURS.length) % 1,
          );
        for (let q = 0; q < KINDS.length && taken(name); q++)
          name = `${KINDS[q]} ${creatureName(body, niche, { warm, rain }, earthlike, u(20))}`;
        later.push({
          s: {
            name,
            niche,
            arose: k,
            origin,
            warm: Math.round(warm),
            tolerance: 6 + Math.round(9 * u(21)),
            rainMin: Math.round(rain * 0.4),
            rainMax: Math.round(rain * 2 + 100),
            size: body.size,
            herd: Math.round(u(22) * 100) / 100,
            docility: Math.round(0.1 * u(23) * 100) / 100,
            growth: Math.round(u(24) * 100) / 100,
            wool: body.covering === "wool",
            seed: 0,
            tame: false,
            body,
            level: FOOD_WEB[niche].level,
          },
          died: null,
        });
      }
      // The age's end, as for the rest.
      later.forEach((a, j) => {
        if (a.died !== null || a.s.arose === k) return;
        const risk =
          age.kind === "impact"
            ? 0.5
            : age.kind === "great volcanism"
              ? 0.3
              : age.kind === "icehouse" && a.s.warm > 18
                ? 0.4
                : age.kind === "hothouse" && a.s.warm < 5
                  ? 0.4
                  : 0.04;
        if (rng.real(BIO, j, k, 95) < risk) a.died = k;
      });
    }
    const added: Species[] = [];
    for (const a of later) {
      const s: Species = {
        index: species.length,
        ref: speciesRef(0, species.length),
        ...a.s,
        died: a.died,
      };
      species.push(s);
      added.push(s);
      if (s.died !== null || !fits(s, s.origin)) continue;
      // Over the land joined to where it arose, as far as its climate suits it (not counted
      // among the kinds of beast the people's cradle was chosen by: that was chosen first).
      const seen = new Uint8Array(n),
        queue = [s.origin];
      seen[s.origin] = 1;
      for (let h = 0; h < queue.length; h++) {
        const c = queue[h]!;
        if (s.niche !== "swimmer" || wet(c))
          present[SPECIES_WORDS * c + (s.index >> 5)]! |= 1 << (s.index & 31);
        for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
          const m = grid.neighbours[k]!;
          if (!seen[m] && fits(s, m)) {
            seen[m] = 1;
            queue.push(m);
          }
        }
      }
    }
    fed(added);
  }

  /**
   * A hunter of the web's newer niches lives only where its food does: a small hunter where
   * small game lives (seed-eaters, the lesser grazers and browsers, swimmers), a scavenger
   * where the hunters kill or the great herds die.
   */
  function fed(added: readonly Species[]): void {
    const eats = (h: Species, g: Species) =>
      g.died === null &&
      g.index !== h.index &&
      (h.niche === "small hunter"
        ? g.level === 2 && g.size < 120
        : h.niche === "scavenger"
          ? g.level === 4 || (g.level === 2 && g.size >= 60)
          : false);
    for (const h of added) {
      if (h.died !== null || (h.niche !== "small hunter" && h.niche !== "scavenger")) continue;
      const food = species.filter((g) => eats(h, g)),
        word = h.index >> 5,
        bit = 1 << (h.index & 31);
      let left = 0;
      for (let c = 0; c < n; c++) {
        const at = SPECIES_WORDS * c + word;
        if ((present[at]! & bit) === 0) continue;
        if (!food.some((g) => lives({ present } as Biosphere, c, g.index)))
          present[at] = (present[at]! & ~bit) >>> 0;
        else left++;
      }
      // Nothing it could eat lived anywhere it could: it died out in the last age.
      if (!left) species[h.index] = { ...h, died: AGES - 1 };
    }
  }

  const clade = riseOf(world.prior, conditionsIn, (i) =>
    rng.real(BIO, Math.max(0, apesAt), 0, 101, i),
  );
  if (!clade) {
    web();
    return { species, present, herdBeast, seedGrass, diversity, people: null };
  }
  const home = cradleOf[clade.body.medium],
    conditions = conditionsIn(clade.body.medium)!,
    body =
      world.prior === "earthlike"
        ? { ...clade.body }
        : bodyOf(
            clade,
            conditions,
            [0, 1, 2].map((i) => rng.real(BIO, home, 0, 102, i)),
          );
  const apes: Species = {
    index: species.length,
    ref: speciesRef(0, species.length),
    name: body.name,
    niche: "upright ape",
    arose: AGES - 1,
    died: null,
    origin: home,
    warm: Math.round(climate.temperature[home]!),
    tolerance: 30,
    rainMin: 0,
    rainMax: 10000,
    size: body.size,
    herd: 0.8,
    docility: 0.4,
    growth: 0.1,
    wool: false,
    seed: 0,
    tame: false,
    body: null,
    level: 0,
  };
  species.push(apes);
  web();

  return {
    species,
    present,
    herdBeast,
    seedGrass,
    diversity,
    people: { species: apes.index, cell: home, body, because: clade.because(conditions) },
  };
}
