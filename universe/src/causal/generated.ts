// Explanations of generated facts (docs/architecture §12–13): a deposit is there
// because of a process at a boundary between two plates; a plate is one of those
// the planet's crust broke into; the planet orbits its star; the star is how this
// universe began. Each is answered from the generated world itself, on the basis
// "generated" — the last links of any chain that reaches down to geology.
import { kindCodeOf, parseRef, type Ref, type World } from "../kernel/index.ts";
import {
  BIOME_NAMES,
  BOUNDARY,
  DEPOSIT,
  PLANET,
  PLATE,
  STAR,
  SURFACE_CELL,
  cellRef,
} from "../gen/index.ts";
import { homePlanet } from "../sim/index.ts";
import { edges, registerExplainer, type Explanation } from "./why.ts";

const BOUNDARY_WORDS = ["", "converging", "spreading", "sliding"];

function deg(radians: number): string {
  return `${Math.abs((radians * 180) / Math.PI).toFixed(1)}°`;
}

function hasPlanet(world: World): boolean {
  return world.storeNames().includes("planet.home");
}

function generated(ref: Ref, claim: string, causes: Explanation["causes"]): Explanation {
  return { ref, claim, basis: "generated", t: null, causes };
}

registerExplainer(STAR.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const s = homePlanet(world).generated.star;
  return generated(
    ref,
    `A ${s.spectral} star of ${s.mass.toFixed(2)} suns, ${s.ageGyr.toFixed(1)} billion years old, shining ${s.luminosity.toFixed(2)} times as bright as the Sun`,
    [],
  );
});

registerExplainer(PLANET.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const { planet: p, star } = homePlanet(world).generated;
  return generated(
    ref,
    `A world of ${p.mass.toFixed(2)} Earth masses (gravity ${p.gravity.toFixed(2)} g) ${p.orbitAu.toFixed(2)} AU from its star, a year of ${Math.round(p.yearDays)} days and a day of ${p.dayHours.toFixed(1)} hours, tilted ${p.tilt.toFixed(1)}°`,
    edges(world, [{ ref: star.ref as Ref, role: "enabler", weight: 1 }]),
  );
});

registerExplainer(PLATE.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const g = homePlanet(world).generated,
    plate = g.tectonics.plates[parseRef(ref).b];
  if (!plate) return null;
  const share = ((100 * plate.area) / (4 * Math.PI)).toFixed(1);
  return generated(
    ref,
    `A ${plate.continental ? "continental" : "oceanic"} plate covering ${share}% of the world, one of ${g.tectonics.plates.length} its crust broke into, turning ${plate.speed.toFixed(1)}° every million years`,
    edges(world, [{ ref: g.planet.ref as Ref, role: "enabler", weight: 1 }]),
  );
});

registerExplainer(DEPOSIT.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const g = homePlanet(world).generated,
    d = g.deposits[parseRef(ref).b];
  if (!d) return null;
  const [own, other] = d.plates;
  const causes = [
    ...(other !== undefined
      ? [{ ref: g.tectonics.plates[other]!.ref as Ref, role: "trigger" as const, weight: 0.5 }]
      : []),
    {
      ref: g.tectonics.plates[own!]!.ref as Ref,
      role: "enabler" as const,
      weight: other !== undefined ? 0.3 : 0.7,
    },
    { ref: cellRef(0, d.cell), role: "constraint" as const, weight: 0.2 },
  ];
  return generated(
    ref,
    `${d.richness} units of ${d.kind}, laid down by ${d.process}`,
    edges(world, causes),
  );
});

registerExplainer(SURFACE_CELL.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const g = homePlanet(world).generated,
    c = parseRef(ref).b;
  if (c >= g.grid.count) return null;
  const e = g.tectonics.elevation[c]!,
    b = g.tectonics.boundary[c]!,
    near = b !== BOUNDARY.none && g.tectonics.toBoundary[c]! <= 3;
  return generated(
    ref,
    `${BIOME_NAMES[g.climate.biome[c]!]} at ${deg(g.grid.lat[c]!)}${g.grid.lat[c]! >= 0 ? "N" : "S"} ${deg(g.grid.lon[c]!)}${g.grid.lon[c]! >= 0 ? "E" : "W"}: ${Math.round(e)} m ${e >= 0 ? "above" : "below"} the sea, ${g.climate.temperature[c]!.toFixed(0)} °C, ${Math.round(g.climate.precipitation[c]!)} mm of rain a year${near ? `, near a ${BOUNDARY_WORDS[b]} plate boundary` : ""}`,
    edges(world, [
      { ref: g.tectonics.plates[g.tectonics.plate[c]!]!.ref as Ref, role: "enabler", weight: 1 },
    ]),
  );
});

/** A surface cell in words: "the temperate forest at 39.7°S 102.3°E". */
export function landWords(world: World, place: Ref | null): string {
  if (!place || kindCodeOf(place) !== SURFACE_CELL.code || !hasPlanet(world)) return "the land";
  const g = homePlanet(world).generated,
    c = parseRef(place).b;
  if (c >= g.grid.count) return "the land";
  const lat = g.grid.lat[c]!,
    lon = g.grid.lon[c]!;
  return `the ${BIOME_NAMES[g.climate.biome[c]!]} at ${deg(lat)}${lat >= 0 ? "N" : "S"} ${deg(lon)}${lon >= 0 ? "E" : "W"}`;
}

/** Whether a ref names a generated thing this module explains. */
export function isGenerated(ref: Ref): boolean {
  return [STAR.code, PLANET.code, PLATE.code, DEPOSIT.code, SURFACE_CELL.code].includes(
    kindCodeOf(ref),
  );
}
