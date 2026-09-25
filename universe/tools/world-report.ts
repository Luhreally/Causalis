// node tools/world-report.ts [prior] [frequency] [seed…] — generate home worlds and
// report what came out: timing, the star and planet, land and sea, heights, the
// landmasses, temperatures, rain, biomes, rivers and deposits. The calibration
// tests hold the Earth prior to bands; this is for looking.
import { seedFromText } from "../src/kernel/index.ts";
import { PRIORS } from "../src/rules/index.ts";
import { BIOME_NAMES, generateHomeWorld, type HomeWorld } from "../src/gen/index.ts";

const args = process.argv.slice(2);
const prior = PRIORS[args[0] ?? "earthlike"] ?? PRIORS.earthlike!;
const frequency = Number(args[1] ?? 64);
const seeds = args.slice(2).length ? args.slice(2) : ["first light", "tolvey", "arren", "kestrel"];

function landmasses(w: HomeWorld): number[] {
  const g = w.grid,
    e = w.tectonics.elevation,
    seen = new Uint8Array(g.count),
    sizes: number[] = [];
  for (let c = 0; c < g.count; c++) {
    if (seen[c] || e[c]! <= 0) continue;
    let area = 0;
    const stack = [c];
    seen[c] = 1;
    while (stack.length) {
      const x = stack.pop()!;
      area += g.areas[x]!;
      for (let k = g.offsets[x]!; k < g.offsets[x + 1]!; k++) {
        const m = g.neighbours[k]!;
        if (!seen[m] && e[m]! > 0) {
          seen[m] = 1;
          stack.push(m);
        }
      }
    }
    sizes.push(area);
  }
  return sizes.sort((a, b) => b - a);
}

for (const text of seeds) {
  const t0 = performance.now(),
    w = generateHomeWorld(seedFromText(text), prior, frequency),
    ms = performance.now() - t0;
  const g = w.grid,
    e = w.tectonics.elevation,
    c = w.climate;
  let land = 0,
    maxH = -Infinity,
    minH = Infinity,
    tMean = 0,
    tMin = Infinity,
    tMax = -Infinity,
    rainLand = 0;
  const biomeArea = new Array<number>(BIOME_NAMES.length).fill(0);
  for (let i = 0; i < g.count; i++) {
    const a = g.areas[i]!;
    if (e[i]! > 0) {
      land += a;
      rainLand += c.precipitation[i]! * a;
    }
    maxH = Math.max(maxH, e[i]!);
    minH = Math.min(minH, e[i]!);
    tMean += c.temperature[i]! * a;
    tMin = Math.min(tMin, c.temperature[i]!);
    tMax = Math.max(tMax, c.temperature[i]!);
    biomeArea[c.biome[i]!] = biomeArea[c.biome[i]!]! + a;
  }
  const total = 4 * Math.PI,
    masses = landmasses(w),
    rivers = w.water.river.reduce((s, v) => s + v, 0),
    lakes = w.water.lake.reduce((s, v) => s + v, 0);
  const kinds = new Map<string, number>();
  for (const d of w.deposits) kinds.set(d.kind, (kinds.get(d.kind) ?? 0) + 1);
  console.log(
    `\n“${text}” (${prior.name}, ${g.count} cells) in ${ms.toFixed(0)} ms — digest ${w.digest}`,
  );
  console.log(
    `  star ${w.star.spectral} ${w.star.mass.toFixed(2)} M☉, L ${w.star.luminosity.toFixed(2)}, age ${w.star.ageGyr.toFixed(1)} Gyr · planet ${w.planet.mass.toFixed(2)} M⊕, g ${w.planet.gravity.toFixed(2)}, ${w.planet.orbitAu.toFixed(2)} AU, year ${w.planet.yearDays.toFixed(0)} d, day ${w.planet.dayHours.toFixed(1)} h, tilt ${w.planet.tilt.toFixed(1)}°, ${c.bands} bands`,
  );
  console.log(
    `  land ${((100 * land) / total).toFixed(1)}% in ${masses.length} masses (largest ${masses
      .slice(0, 4)
      .map((m) => ((100 * m) / land).toFixed(0) + "%")
      .join(
        ", ",
      )}) · heights ${Math.round(minH)} to ${Math.round(maxH)} m · ${w.tectonics.plates.length} plates (${w.tectonics.plates.filter((p) => p.continental).length} continental)`,
  );
  console.log(
    `  temperature mean ${(tMean / total).toFixed(1)} °C (${tMin.toFixed(0)} to ${tMax.toFixed(0)}) · land rain ${(rainLand / land).toFixed(0)} mm · ${rivers} river cells, ${lakes} lake cells`,
  );
  console.log(
    "  land biomes: " +
      biomeArea
        .map((a, i) => [BIOME_NAMES[i]!, a] as const)
        .filter(([, a], i) => i >= 4 && a > 0)
        .sort((x, y) => y[1] - x[1])
        .map(([n, a]) => `${n} ${((100 * a) / land).toFixed(0)}%`)
        .join(", "),
  );
  console.log(`  deposits: ${[...kinds].map(([k, n]) => `${k} ${n}`).join(", ")}`);
}
