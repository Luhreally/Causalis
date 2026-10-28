// Sparse, saved departures from generated ground. The generation digest and random keys stay put.
import {
  SPECIES_WORDS,
  classify,
  depositRef,
  type Deposit,
  type HomeWorld,
  type ProvinceWorld,
} from "../../gen/index.ts";

export type SurfacePatch = {
  cell: number;
  elevation: number;
  temperature: number;
  precipitation: number;
  seasonality: number;
  biome: number;
  river: number;
  lake: number;
  filled: number;
  discharge: number;
  present: number[];
  beast: number;
  grass: number;
  diversity: number;
  ore?: { kind: Deposit["kind"]; richness: number; index: number };
};

export function readSurface(f: HomeWorld, cell: number): SurfacePatch {
  return {
    cell,
    elevation: f.tectonics.elevation[cell]!,
    temperature: f.climate.temperature[cell]!,
    precipitation: f.climate.precipitation[cell]!,
    seasonality: f.climate.seasonality[cell]!,
    biome: f.climate.biome[cell]!,
    river: f.water.river[cell]!,
    lake: f.water.lake[cell]!,
    filled: f.water.filled[cell]!,
    discharge: f.water.discharge[cell]!,
    present: [...f.life.present.subarray(cell * SPECIES_WORDS, (cell + 1) * SPECIES_WORDS)],
    beast: f.life.herdBeast[cell]!,
    grass: f.life.seedGrass[cell]!,
    diversity: f.life.diversity[cell]!,
  };
}

export function writeSurface(f: HomeWorld, p: SurfacePatch): void {
  const c = p.cell;
  f.tectonics.elevation[c] = p.elevation;
  f.climate.temperature[c] = p.temperature;
  f.climate.precipitation[c] = p.precipitation;
  f.climate.seasonality[c] = p.seasonality;
  f.climate.biome[c] = p.biome;
  f.water.river[c] = p.river;
  f.water.lake[c] = p.lake;
  f.water.filled[c] = p.filled;
  f.water.discharge[c] = p.discharge;
  f.life.present.set(p.present, c * SPECIES_WORDS);
  f.life.herdBeast[c] = p.beast;
  f.life.seedGrass[c] = p.grass;
  f.life.diversity[c] = p.diversity;
}

/** Refresh only touched provinces; offworld halls and every untouched province remain exact. */
export function refreshSurface(g: ProvinceWorld, cells: readonly number[]): void {
  const f = g.fine;
  for (const p of new Set(cells.map((c) => g.provinceOf[c]!))) {
    const kids = [...g.children.subarray(g.childOffsets[p]!, g.childOffsets[p + 1]!)];
    const area = (cs: number[]) => cs.reduce((n, c) => n + f.grid.areas[c]!, 0);
    const land = kids.filter((c) => f.tectonics.elevation[c]! > 0),
      own =
        area(land) >= area(kids) / 2 ? land : kids.filter((c) => f.tectonics.elevation[c]! <= 0),
      total = area(own),
      mean = (a: Float32Array) => own.reduce((n, c) => n + a[c]! * f.grid.areas[c]!, 0) / total;
    g.tectonics.elevation[p] = mean(f.tectonics.elevation);
    g.climate.temperature[p] = mean(f.climate.temperature);
    g.climate.precipitation[p] = mean(f.climate.precipitation);
    g.climate.seasonality[p] = mean(f.climate.seasonality);
    const biomes = new Map<number, number>();
    for (const c of own)
      biomes.set(f.climate.biome[c]!, (biomes.get(f.climate.biome[c]!) ?? 0) + f.grid.areas[c]!);
    g.climate.biome[p] = [...biomes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
    g.water.river[p] = own.some((c) => f.water.river[c]) ? 1 : 0;
    g.water.lake[p] = own.some((c) => f.water.lake[c]) ? 1 : 0;
    g.water.filled[p] = Math.max(...own.map((c) => f.water.filled[c]!));
    g.water.discharge[p] = Math.max(...own.map((c) => f.water.discharge[c]!));
    g.life.present.fill(0, p * SPECIES_WORDS, (p + 1) * SPECIES_WORDS);
    g.life.diversity[p] = 0;
    g.life.herdBeast[p] = -1;
    g.life.seedGrass[p] = -1;
    let beastWorth = -1,
      grassWorth = -1,
      best = own[0]!,
      bestDot = -Infinity;
    for (const c of kids) {
      for (let w = 0; w < SPECIES_WORDS; w++)
        g.life.present[p * SPECIES_WORDS + w] =
          g.life.present[p * SPECIES_WORDS + w]! | f.life.present[c * SPECIES_WORDS + w]!;
      g.life.diversity[p] = Math.max(g.life.diversity[p]!, f.life.diversity[c]!);
      const b = f.life.herdBeast[c]!,
        s = f.life.seedGrass[c]!;
      if (b >= 0 && f.life.species[b]!.docility * f.life.species[b]!.growth > beastWorth) {
        beastWorth = f.life.species[b]!.docility * f.life.species[b]!.growth;
        g.life.herdBeast[p] = b;
      }
      if (s >= 0 && f.life.species[s]!.seed > grassWorth) {
        grassWorth = f.life.species[s]!.seed;
        g.life.seedGrass[p] = s;
      }
    }
    for (const c of own) {
      let dot = 0;
      for (let i = 0; i < 3; i++)
        dot += g.grid.positions[p * 3 + i]! * f.grid.positions[c * 3 + i]!;
      if (dot > bestDot) {
        best = c;
        bestDot = dot;
      }
    }
    g.centre[p] = best;
  }
}

export function surfaceBiome(p: SurfacePatch, rain: number): void {
  p.biome = classify(p.elevation, p.temperature, rain);
  if (p.elevation <= 0) {
    p.river = 0;
    p.lake = 0;
    p.discharge = 0;
  }
}

/** Stable deposit indices across repainting: at most one extra deposit per fine cell. */
export function surfaceDeposits(
  g: ProvinceWorld,
  patches: readonly SurfacePatch[],
  base: number,
): void {
  const fine = g.fine.deposits as Deposit[],
    coarse = g.deposits as Deposit[];
  fine.length = base;
  coarse.length = base;
  for (const p of patches.filter((p) => p.ore).sort((a, b) => a.ore!.index - b.ore!.index))
    if (p.ore) {
      const index = fine.length,
        d: Deposit = {
          index,
          ref: depositRef(0, index),
          kind: p.ore.kind,
          cell: p.cell,
          richness: p.ore.richness,
          process: "the god's hand",
          plates: [g.fine.tectonics.plate[p.cell]!],
          detail: { hand: 1 },
        };
      fine.push(d);
      coarse.push({ ...d, cell: g.provinceOf[p.cell]! });
    }
}
