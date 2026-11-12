// A world's living things read from its own physics (B3 and B4 of the life plan, docs/architecture/
// asks-2026-11-12-plan.md Part B): the biosphere of every world but Earth's (gen/biosphere.ts keeps Earth's, and any
// world saved before, as they were). The places its numbers offer, the roles its energy fills in them (rules/
// grammar.ts), its founding stocks, and over its ages a lineage of a stock for each role, arising, dying in the great
// dyings and their roles filled again; its light-eaters as lineages (mats, grasses, trees, floaters, growths at its
// vents); each living lineage over the cells of its place its warmth suits; and last, of its lineages, the one that
// rose to thought, if any did (rules/rise.ts), its body plan read from its body.
//
// Keyed draws on the biosphere's own stream (never a sequence: no other draw of the world moves), each choice its
// own key; nothing stored but what the world already keeps of its biosphere.
import { defineStream, weightedKey, type Rng, type SphereGrid } from "../kernel/index.ts";
import {
  LEAST_RISE,
  LIFE_NICHES,
  PLACES,
  bodyFor,
  deepStockOf,
  growthFormOf,
  growthName,
  lineageName,
  noneRoseWhy,
  riseRead,
  risenBody,
  roleId,
  rolesOf,
  wetPlace,
  type CreatureBody,
  type DawnWay,
  type DeepStock,
  type LandShares,
  type LifeRole,
  type LifeWay,
  type LifeWorld,
  type Place,
  type RiseCandidate,
} from "../rules/index.ts";
import { BIOME, type Climate } from "./climate.ts";
import type { Hydrology } from "./hydrology.ts";
import { AGES, type DeepTime } from "./deeptime.ts";
import { BOUNDARY, type Tectonics } from "./plates.ts";
import { speciesRef } from "./kinds.ts";
import { MAX_SPECIES, SPECIES_WORDS, type Biosphere, type Species } from "./biosphere.ts";
import type { HomeWorld } from "./homeworld.ts";
import { protoLifeWorld, type ProtoWorld } from "./origin.ts";

const LIVING = defineStream("gen.living");

/** What the living world is read from. */
export type LivingInputs = {
  readonly grid: SphereGrid;
  readonly rng: Rng;
  readonly climate: Climate;
  readonly water: Hydrology;
  readonly elevation: Float32Array;
  readonly tectonics: Tectonics;
  readonly deep: DeepTime;
  /** Its numbers as life meets them (its land's shares are read here, from its cells). */
  readonly world: LifeWorld;
  /** What catches its light (its growths' colour). */
  readonly pigment: string;
  /** The ways the god's hand made prosper in its first seas and its ages, and where it bade the people rise. */
  readonly dawn?: DawnWay | null;
  readonly lives?: ReadonlyMap<number, LifeWay>;
  readonly cradle?: number | null;
};

const GRASS = new Set<number>([BIOME.steppe, BIOME.savanna]),
  WOOD = new Set<number>([BIOME.temperateForest, BIOME.borealForest, BIOME.tropicalDryForest]),
  TALL = new Set<number>([BIOME.tropicalRainforest, BIOME.temperateRainforest]),
  DESERT = new Set<number>([BIOME.hotDesert, BIOME.coldDesert]),
  COLD = new Set<number>([BIOME.tundra, BIOME.alpine]),
  ICE = new Set<number>([BIOME.ice, BIOME.seaIce]);

/** Which cells each place is: a test for each. */
export function placeCells(
  i: Pick<LivingInputs, "grid" | "climate" | "water" | "elevation" | "tectonics" | "world">,
): Readonly<Record<Place, (c: number) => boolean>> {
  const { grid, climate, water, elevation, tectonics, world } = i,
    land = (c: number) => elevation[c]! > 0,
    biome = (c: number) => climate.biome[c]!,
    coast = (c: number) => {
      for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++)
        if (land(grid.neighbours[k]!) !== land(c)) return true;
      return false;
    },
    sea = (c: number) => !land(c) && biome(c) !== BIOME.seaIce,
    mild = (c: number) => climate.temperature[c]! > -5 && climate.temperature[c]! < 32;
  return {
    "sunlit sea": sea,
    // (The deep, the floor and the vents lie under a sea's ice as under its open water.)
    deep: (c) => !land(c) && biome(c) !== BIOME.shelf,
    "sea floor": (c) => !land(c),
    vents: (c) =>
      !land(c) && tectonics.boundary[c] === BOUNDARY.divergent && tectonics.toBoundary[c]! <= 1,
    shore: (c) => land(c) && !ICE.has(biome(c)) && coast(c),
    river: (c) => land(c) && !ICE.has(biome(c)) && (water.river[c] === 1 || water.lake[c] === 1),
    grassland: (c) => land(c) && GRASS.has(biome(c)),
    woodland: (c) => land(c) && WOOD.has(biome(c)),
    canopy: (c) => land(c) && TALL.has(biome(c)),
    desert: (c) => land(c) && DESERT.has(biome(c)),
    "cold land": (c) => land(c) && COLD.has(biome(c)),
    underground: (c) => land(c) && !ICE.has(biome(c)),
    air: (c) => land(c) && !ICE.has(biome(c)),
    ice: (c) => ICE.has(biome(c)),
    twilight: (c) => world.locked && land(c) && !ICE.has(biome(c)) && mild(c),
  };
}

/** How a world's land divides, read from its cells. */
export function landShares(
  i: Pick<LivingInputs, "grid" | "climate" | "water" | "elevation" | "tectonics">,
): LandShares {
  const n = i.grid.count,
    count = {
      land: 0,
      grass: 0,
      wood: 0,
      tall: 0,
      desert: 0,
      cold: 0,
      rivers: 0,
      sea: 0,
      shelf: 0,
      vents: 0,
    };
  for (let c = 0; c < n; c++) {
    const b = i.climate.biome[c]!;
    if (i.elevation[c]! > 0) {
      if (ICE.has(b)) continue;
      count.land++;
      if (GRASS.has(b)) count.grass++;
      else if (WOOD.has(b)) count.wood++;
      else if (TALL.has(b)) count.tall++;
      else if (DESERT.has(b)) count.desert++;
      else if (COLD.has(b)) count.cold++;
      if (i.water.river[c] === 1 || i.water.lake[c] === 1) count.rivers++;
    } else {
      count.sea++;
      if (b === BIOME.shelf) count.shelf++;
      if (i.tectonics.boundary[c] === BOUNDARY.divergent && i.tectonics.toBoundary[c]! <= 1)
        count.vents++;
    }
  }
  const of = (x: number, all: number) => (all ? x / all : 0);
  return {
    grass: of(count.grass, count.land),
    wood: of(count.wood, count.land),
    tall: of(count.tall, count.land),
    desert: of(count.desert, count.land),
    cold: of(count.cold, count.land),
    rivers: of(count.rivers, count.land),
    shelf: of(count.shelf, count.sea),
    vents: of(count.vents, count.sea),
  };
}

/** The place a role's niche lives in for the god's hand's ways (its life acts), by its niche. */
const bentBy = (way: LifeWay | DawnWay, niche: string): number => {
  const lifeWays = LIFE_NICHES as Readonly<Record<string, readonly string[]>>;
  if (lifeWays[way]?.includes(niche)) return 1.8;
  const dawn: Readonly<Record<string, readonly string[]>> = {
    eaters: ["grazer", "seed-eater"],
    light: ["browser", "swimmer"],
    hunters: ["hunter", "small hunter"],
    together: ["great beast", "scavenger"],
  };
  return dawn[way]?.includes(niche) ? 1.5 : 1;
};

/** The most founding stocks a world has, and the fewest. */
const MOST_STOCKS = 6,
  FEWEST_STOCKS = 3;

/** A world's living things, read from its own physics. */
export function makeLivingBiosphere(i: LivingInputs): Biosphere {
  const { grid, rng, climate, water, elevation, deep } = i,
    n = grid.count,
    u = (a: number, b: number, c: number, d = 0) => rng.real(LIVING, a, b, c, d),
    lands = landShares(i),
    w: LifeWorld = { ...i.world, lands },
    read = rolesOf(w),
    roles = read.roles.slice(0, read.fills),
    cells = placeCells({ ...i, world: w }),
    land = (c: number) => elevation[c]! > 0,
    lifeActs = [...(i.lives ?? new Map<number, LifeWay>())];
  if (!roles.length) return emptyOf(n);
  // Its founding stocks.
  const stockCount = FEWEST_STOCKS + Math.floor(u(1, 0, 0) * (MOST_STOCKS - FEWEST_STOCKS + 1)),
    stocks: DeepStock[] = [];
  for (let s = 0; s < stockCount; s++) stocks.push(deepStockOf(w, (k) => u(2, s, k), s));
  // Each place's cells, once (where a lineage arises and how far it ranges).
  const placeList = [...new Set(roles.map((r) => r.place))],
    where = new Map<Place, number[]>();
  for (const p of placeList) {
    const fit = cells[p],
      list: number[] = [];
    for (let c = 0; c < n; c++) if (fit(c)) list.push(c);
    where.set(p, list);
  }
  // When each role first opens: the sea's first eaters early, the land's after; the hunters as their prey come; a
  // link more, an age later.
  const opens = roles.map((r, k) => {
    const sea = wetPlace(r.place),
      first = (sea ? 1 : 2) + (r.level - 2) + (r.place === "air" || r.place === "canopy" ? 1 : 0);
    return Math.min(AGES - 2, first + Math.floor(u(3, k, 0) * 3));
  });
  type Born = { s: Omit<Species, "died" | "index" | "ref">; died: number | null; role: number };
  const born: Born[] = [],
    names = new Set<string>(),
    living = roles.map(() => -1),
    tried = roles.map(() => 0);
  /** A body for a role: of the stocks that can do it, one weighed by how well its plan suits its place. */
  const bodyOfRole = (k: number, at: number): { body: CreatureBody; stock: number } | null => {
    const r = roles[k]!,
      medium = PLACES[r.place].medium,
      order = stocks
        .map((st) => {
          const sea = medium === "sea",
            suit =
              (sea ? (st.began === "water" ? 1.4 : 1) : st.symmetry === "radial" ? 0.35 : 1) *
              (medium === "air" ? (st.wing ? 1.5 : 0.4) : 1) *
              (medium === "under" ? (st.pairs === 0 || st.pairs >= 3 ? 1.4 : 0.7) : 1) *
              (r.place === "canopy" && st.pairs >= 2 ? 1.4 : 1);
          return { st, key: weightedKey(u(4, k, st.id, at), suit) };
        })
        .sort((a, b) => a.key - b.key);
    for (const { st } of order) {
      const body = bodyFor(st, r, w, (m) => u(5, k * 8 + st.id, m, at));
      if (body) return { body, stock: st.id };
    }
    return null;
  };
  const arise = (k: number, age: number) => {
    const r = roles[k]!,
      list = where.get(r.place) ?? [];
    if (!list.length || born.length >= 400) return;
    const made = bodyOfRole(k, age);
    if (!made) return;
    // Where it arose: a cell of its place, by keyed draw.
    let origin = -1,
      best = Infinity;
    for (let j = 0; j < list.length; j += list.length > 600 ? 3 : 1) {
      const c = list[j]!,
        key = weightedKey(u(6, c, k, age), 1);
      if (key < best) [best, origin] = [key, c];
    }
    if (origin < 0) return;
    const warm = climate.temperature[origin]!,
      rain = climate.precipitation[origin]!,
      sea = wetPlace(r.place) && !land(origin),
      body = made.body,
      grazes = r.level === 2 && !sea,
      herd =
        grazes && (r.food === "graze" || r.food === "browse")
          ? 0.4 + 0.6 * u(7, k, age)
          : 0.6 * u(7, k, age),
      docility = r.level >= 3 ? 0.1 * u(8, k, age) : u(8, k, age),
      growth = u(9, k, age),
      tame =
        grazes &&
        body.moves !== "fly" &&
        body.moves !== "float" &&
        herd > 0.5 &&
        docility > 0.4 &&
        growth > 0.3 &&
        body.size >= 25 &&
        body.size <= 900;
    let name = lineageName(body, r, u(10, k, age));
    for (let turn = 1; turn < 8 && names.has(name); turn++)
      name = lineageName(body, r, (u(10, k, age) + turn / 8) % 1);
    for (const q of KINDS) {
      if (!names.has(name)) break;
      name = `${q} ${lineageName(body, r, u(10, k, age))}`;
    }
    names.add(name);
    const open = r.food === "graze" || r.place === "air" || sea;
    living[k] = born.length;
    born.push({
      role: k,
      died: null,
      s: {
        name,
        niche: r.niche,
        arose: age,
        origin,
        warm: Math.round(warm),
        tolerance: (open ? 9 : 6) + Math.round(8 * u(11, k, age)),
        rainMin: sea ? 0 : Math.round(rain * (open ? 0.4 : 0.5)),
        rainMax: sea ? 100_000 : Math.round(rain * (open ? 2.2 : 1.8) + 100),
        size: body.size,
        herd: Math.round(herd * 100) / 100,
        docility: Math.round(docility * 100) / 100,
        growth: Math.round(growth * 100) / 100,
        wool: body.covering === "wool",
        seed: 0,
        tame,
        body,
        level: r.level,
        role: roleId(r),
        place: r.place,
      },
    });
  };
  // Its light-eaters: a lineage for each lit place they grow in (and the vents' rock-eaters), each arising early, the
  // grasses late, as the open country came.
  const growths: Born[] = [];
  read.places.forEach((p, k) => {
    if (p.shut || !p.links) return;
    const form = growthFormOf(p.place, w),
      list = where.get(p.place) ?? cellsOfPlace(cells[p.place], n);
    if (!form || !list.length || growths.length >= 8) return;
    let origin = list[Math.floor(u(12, k, 0) * list.length)]!;
    if (origin === undefined) origin = list[0]!;
    const seed = form === "grass" ? u(13, k, 0) : 0,
      warm = climate.temperature[origin]!,
      rain = climate.precipitation[origin]!,
      sea = !land(origin);
    let name = growthName(form, i.pigment, u(14, k, 0));
    for (const q of KINDS) {
      if (!names.has(name)) break;
      name = `${q} ${growthName(form, i.pigment, u(14, k, 0))}`;
    }
    names.add(name);
    growths.push({
      role: -1,
      died: null,
      s: {
        name,
        niche: form === "grass" ? "seed grass" : "growth",
        arose: form === "grass" ? AGES - 4 + Math.floor(u(15, k, 0) * 2) : sea ? 0 : 1,
        origin,
        warm: Math.round(warm),
        tolerance: 10 + Math.round(8 * u(16, k, 0)),
        rainMin: sea ? 0 : Math.round(rain * 0.4),
        rainMax: sea ? 100_000 : Math.round(rain * 2.2 + 100),
        size: 0,
        herd: 0,
        docility: 0,
        growth: 0,
        wool: false,
        seed: Math.round(seed * 100) / 100,
        tame: form === "grass" && seed > 0.45,
        body: null,
        level: 1,
        form,
        place: p.place,
      },
    });
  });
  // The ages: each role's first lineage when it opens; at each age's end the great events kill many (an icehouse the
  // warm-fitted, a hothouse the cold); a role left empty is filled again, now and then, an age or more after.
  const spared = (k: number, niche: string) =>
      lifeActs.some(
        ([a, way]) => a <= k && (LIFE_NICHES[way] as readonly string[]).includes(niche),
      ),
    bent = (k: number, niche: string) => {
      let m = i.dawn ? bentBy(i.dawn, niche) : 1;
      for (const [a, way] of lifeActs) if (a < k) m *= bentBy(way, niche);
      return m;
    };
  for (let age = 1; age < AGES; age++) {
    for (let k = 0; k < roles.length; k++) {
      if (living[k]! >= 0 || age < opens[k]!) continue;
      // (Its first lineage when it opens; after a lineage of it died, another with some chance each age.)
      const again = tried[k]! > 0;
      tried[k]!++;
      if (again && !(u(17, k, age) < Math.min(0.97, 0.9 * bent(age, roles[k]!.niche)))) continue;
      arise(k, age);
    }
    const kind = deep.ages[age]!.kind;
    for (const b of born) {
      if (b.died !== null || b.s.arose === age) continue;
      const risk =
        kind === "impact"
          ? 0.5
          : kind === "great volcanism"
            ? 0.3
            : kind === "icehouse" && b.s.warm > 18
              ? 0.4
              : kind === "hothouse" && b.s.warm < 5
                ? 0.4
                : 0.04;
      if (u(18, born.indexOf(b), age) < risk * (spared(age, b.s.niche) ? 0.5 : 1)) {
        b.died = age;
        if (living[b.role] === born.indexOf(b)) living[b.role] = -1;
      }
    }
    for (const g of growths)
      if (
        g.died === null &&
        g.s.arose < age &&
        kind === "impact" &&
        u(19, growths.indexOf(g), age) < 0.15
      )
        g.died = age;
  }
  // The living and the dead, in the order they arose (the growths first of their age).
  // (Of the dead, the world remembers as many as it has room for beside the living: those that died last.)
  const alive = [...growths, ...born].filter((a) => a.died === null),
    room = Math.max(0, MAX_SPECIES - 1 - alive.length),
    dead = born
      .filter((a) => a.died !== null)
      .sort((a, b) => b.died! - a.died! || b.s.arose - a.s.arose)
      .slice(0, room),
    all = [...alive.slice(0, MAX_SPECIES - 1), ...dead].sort(
      (a, b) => a.s.arose - b.s.arose || (a.role < b.role ? -1 : a.role > b.role ? 1 : 0),
    );
  const species: Species[] = all.map((a, index) => ({
    index,
    ref: speciesRef(0, index),
    ...a.s,
    died: a.died,
  }));
  // Each living lineage over the cells of its place its warmth (and on land its rain) suits, joined to where it arose.
  const present = new Uint32Array(SPECIES_WORDS * n),
    diversity = new Uint8Array(n),
    fitsAt = (s: Species, c: number) => {
      const p = s.place as Place;
      if (!cells[p](c)) return false;
      const t = climate.temperature[c]!;
      if (Math.abs(t - s.warm) > s.tolerance) return false;
      if (!land(c)) return true;
      const r = climate.precipitation[c]!;
      return r >= s.rainMin && r <= s.rainMax;
    };
  const set = (s: Species, c: number) =>
    (present[SPECIES_WORDS * c + (s.index >> 5)] =
      (present[SPECIES_WORDS * c + (s.index >> 5)]! | (1 << (s.index & 31))) >>> 0);
  const lives = (c: number, x: number) =>
    ((present[SPECIES_WORDS * c + (x >> 5)]! >>> (x & 31)) & 1) === 1;
  // The eaters and the growths first. Then the hunters, a link at a time: each roams the cells of its place joined to
  // where it arose, within a wider warmth than it thrives at (as Earth's follow their game), and lives wherever its
  // prey does there; one that finds none died out in the last age.
  const spread = (s: Species, roam: boolean, food: readonly Species[]) => {
    const seen = new Uint8Array(n),
      queue = [s.origin],
      fit = (c: number) =>
        roam
          ? cells[s.place as Place](c) &&
            Math.abs(climate.temperature[c]! - s.warm) <= s.tolerance + 14
          : fitsAt(s, c);
    if (!fit(s.origin)) return 0;
    seen[s.origin] = 1;
    let held = 0;
    for (let h = 0; h < queue.length; h++) {
      const c = queue[h]!;
      if (!roam || food.some((g) => lives(c, g.index))) {
        set(s, c);
        held++;
        if (s.body && land(c)) diversity[c] = Math.min(255, diversity[c]! + 1);
      }
      for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
        const m = grid.neighbours[k]!;
        if (!seen[m] && fit(m)) {
          seen[m] = 1;
          queue.push(m);
        }
      }
    }
    return held;
  };
  for (const s of species) if (s.died === null && s.level < 3) spread(s, false, []);
  for (const level of [3, 4, 5])
    for (const h of species) {
      if (h.died !== null || !h.body || h.level !== level) continue;
      const medium = PLACES[(h.place ?? "grassland") as Place].medium,
        food = species.filter(
          (g) =>
            g.died === null &&
            g.index !== h.index &&
            !!g.body &&
            g.level >= 2 &&
            g.level < h.level &&
            (g.level === h.level - 1 || h.level >= 4) &&
            // (A hunter of the air takes its prey on the land as well.)
            (PLACES[(g.place ?? "grassland") as Place].medium === medium ||
              (medium === "air" && PLACES[(g.place ?? "grassland") as Place].medium === "land")),
        );
      if (!spread(h, true, food)) species[h.index] = { ...h, died: AGES - 1 };
    }
  // What can be tamed or sown, cell by cell: the best of what lives there.
  const herdBeast = new Int16Array(n).fill(-1),
    seedGrass = new Int16Array(n).fill(-1);
  for (let c = 0; c < n; c++) {
    let beast = -1,
      beastWorth = -1,
      grass = -1,
      grassWorth = -1;
    for (const s of species) {
      if (!s.tame || s.died !== null || !lives(c, s.index)) continue;
      if (s.body && s.docility * s.growth > beastWorth)
        [beast, beastWorth] = [s.index, s.docility * s.growth];
      else if (!s.body && s.niche === "seed grass" && s.seed > grassWorth)
        [grass, grassWorth] = [s.index, s.seed];
    }
    herdBeast[c] = beast;
    seedGrass[c] = grass;
  }
  // Last, who rose to thought: of its living beasts, the one its body and life best fit, with chance.
  const candidates: RiseCandidate[] = species
      .filter((s) => (s.died !== null ? false : !!s.body))
      .map((s) => ({
        index: s.index,
        name: s.name,
        body: s.body!,
        herd: s.herd,
        growth: s.growth,
      })),
    reads = candidates.map((c) => riseRead(c, w));
  let pick = -1,
    key = Infinity;
  reads.forEach((r, j) => {
    if (r.score < LEAST_RISE) return;
    const k = weightedKey(u(20, r.index, 0), r.score);
    if (k < key) [pick, key] = [j, k];
  });
  const why = (j: number) => species[j]?.name ?? "beast";
  if (pick < 0)
    return {
      species,
      present,
      herdBeast,
      seedGrass,
      diversity,
      people: null,
      noPeople: noneRoseWhy(reads, why, w),
    };
  const from = candidates[pick]!,
    fore = species[from.index]!,
    rise = reads[pick]!,
    body = risenBody(from, w, (m) => u(21, from.index, m));
  // Their cradle: where their forebears lived, the most food about it and the mildest (or where the hand bade them).
  let cell = fore.origin,
    best = -Infinity;
  for (let c = 0; c < n; c++) {
    if (!lives(c, fore.index)) continue;
    const t = climate.temperature[c]!,
      mild = t > 10 && t < 30 ? 1 : 0.5,
      score =
        (1 + diversity[c]! + (seedGrass[c]! >= 0 ? 3 : 0) + (herdBeast[c]! >= 0 ? 2 : 0)) *
        mild *
        (water.river[c] ? 1.3 : 1) *
        (1 + 0.05 * u(22, c, 0));
    if (score > best) [best, cell] = [score, c];
  }
  const bidden = i.cradle ?? -1;
  if (bidden >= 0 && bidden < n && (land(bidden) === land(cell) || body.medium === "shore"))
    cell = bidden;
  const people: Species = {
    index: species.length,
    ref: speciesRef(0, species.length),
    name: body.name,
    niche: "upright ape",
    arose: AGES - 1,
    died: null,
    origin: cell,
    warm: Math.round(climate.temperature[cell]!),
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
  species.push(people);
  const because = `of the ${fore.name}, ${PLACES[fore.place as Place]?.words ?? "its land"}: its ${
    fore.body!.arms && fore.body!.arms > 1 ? `${fore.body!.arms} ` : ""
  }${graspWords(fore.body!.grasp)} free while it stood, it talked by ${rise.talks}, lived together, and its trade fed a brain`;
  return {
    species,
    present,
    herdBeast,
    seedGrass,
    diversity,
    people: { species: people.index, cell, body, because, forebear: fore.index },
  };
}

const KINDS = ["lesser", "greater", "highland", "lowland", "northern", "southern", "long-tailed"];

function graspWords(g: string | undefined): string {
  return g === "hand"
    ? "hands"
    : g === "pincer"
      ? "pincers"
      : g === "tentacle"
        ? "tentacles"
        : g === "trunk"
          ? "trunk"
          : g === "tail"
            ? "gripping tail"
            : "grasping lips";
}

function cellsOfPlace(fit: (c: number) => boolean, n: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < n; c++) if (fit(c)) out.push(c);
  return out;
}

function emptyOf(n: number): Biosphere {
  return {
    species: [],
    present: new Uint32Array(SPECIES_WORDS * n),
    herdBeast: new Int16Array(n).fill(-1),
    seedGrass: new Int16Array(n).fill(-1),
    diversity: new Uint8Array(n),
    people: null,
  };
}

/** The roles a world's living things were read for (its places and energy), for its pages. */
export function livingRoles(
  i: Pick<LivingInputs, "grid" | "climate" | "water" | "elevation" | "tectonics" | "world">,
): {
  readonly world: LifeWorld;
  readonly roles: readonly LifeRole[];
  readonly read: ReturnType<typeof rolesOf>;
} {
  const lands = landShares(i),
    world: LifeWorld = { ...i.world, lands },
    read = rolesOf(world);
  return { world, roles: read.roles.slice(0, read.fills), read };
}

/** A home world's roles as its living things were read for (null: Earth's, a world kept as it was made, or none). */
export function homeLifeRoles(g: HomeWorld): ReturnType<typeof livingRoles> | null {
  if (!g.physical) return null;
  return livingRoles({
    grid: g.grid,
    climate: g.climate,
    water: g.water,
    elevation: g.tectonics.elevation,
    tectonics: g.tectonics,
    world: protoLifeWorld(g as unknown as ProtoWorld),
  });
}
