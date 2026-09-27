// Explanations of generated facts (docs/architecture §12–13): a deposit is there
// because of a process at a boundary between two plates; a plate is one of those
// the planet's crust broke into; the planet orbits its star; the star is how this
// universe began. Each is answered from the generated world itself, on the basis
// "generated" — the last links of any chain that reaches down to geology.
import { bodyWords } from "../rules/index.ts";
import { kindCodeOf, parseRef, type Ref, type World } from "../kernel/index.ts";
import {
  AGE,
  AGES,
  SPECIES,
  BIOME_NAMES,
  BOUNDARY,
  DEPOSIT,
  CIVILIZATION,
  MOON,
  PLANET,
  PLATE,
  STAR,
  SURFACE_CELL,
  SPOT,
  isProvinceWorld,
  offworldSite,
  ageRef,
  cellRef,
  pastLatitude,
  surfaceCopper,
  type SystemBody,
} from "../gen/index.ts";
import { civilizationsNear, clusterOf, homePlanet, starSitesOf } from "../sim/index.ts";
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
  // Another star of the cluster: what it is and how far.
  if (ref !== homePlanet(world).generated.star.ref) {
    const o = clusterOf(world).find((x) => x.ref === ref);
    if (!o) return null;
    return generated(
      ref,
      o.remnant
        ? `A white dwarf ${o.distance.toFixed(1)} light-years from home: a star that burned out, ${o.mass.toFixed(2)} of the Sun's mass left`
        : `A ${o.spectral} star ${o.distance.toFixed(1)} light-years from home, of ${o.mass.toFixed(2)} suns, ${o.ageGyr.toFixed(1)} billion years old, shining ${o.luminosity < 0.01 ? o.luminosity.toExponential(1) : o.luminosity.toFixed(2)} times as bright as the Sun`,
      [],
    );
  }
  const s = homePlanet(world).generated.star;
  return generated(
    ref,
    `A ${s.spectral} star of ${s.mass.toFixed(2)} suns, ${s.ageGyr.toFixed(1)} billion years old, shining ${s.luminosity.toFixed(2)} times as bright as the Sun`,
    [],
  );
});

registerExplainer(PLANET.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const { planet: p, star, system } = homePlanet(world).generated,
    ordinal = parseRef(ref).b;
  // The star's other worlds: what they are, and why, from the laws that made them.
  if (ordinal > 0) {
    const b = system.bodies.find((x) => x.ref === ref);
    return b ? otherBody(world, b) : null;
  }
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
  // Coal and oil: the age that buried them, and where this land lay then.
  const age = typeof d.detail.age === "number" && d.detail.age < 255 ? d.detail.age : null;
  if (age !== null) {
    const a = g.deep.ages[age]!,
      lat = pastLatitude(g.grid, g.tectonics, d.cell, (a.from + a.to) / 2);
    return generated(
      ref,
      `${d.richness} units of ${d.kind}, laid down by ${d.process} in the ${ordinal(age + 1)} age, ${a.from}–${a.to} million years ago, when this land lay at ${deg(lat)}${lat >= 0 ? "N" : "S"}`,
      edges(world, [
        { ref: ageRef(0, age), role: "trigger", weight: 0.6 },
        { ref: g.tectonics.plates[own!]!.ref as Ref, role: "enabler", weight: 0.3 },
        { ref: cellRef(0, d.cell), role: "constraint", weight: 0.1 },
      ]),
    );
  }
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

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
];
function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

const AGE_WORDS: Readonly<Record<string, string>> = {
  quiet: "a quiet age",
  hothouse: "a hothouse",
  icehouse: "an icehouse, the poles under ice",
  "great volcanism": "an age of great volcanism, floods of lava pouring out",
  impact: "an age in which a great stone fell from the sky",
};

registerExplainer(AGE.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const g = homePlanet(world).generated,
    a = g.deep.ages[parseRef(ref).b];
  if (!a) return null;
  const warmer =
      a.warmth >= 0 ? `${a.warmth.toFixed(1)} °C warmer` : `${(-a.warmth).toFixed(1)} °C colder`,
    seas = a.seaLevel >= 0 ? `${a.seaLevel} m higher` : `${-a.seaLevel} m lower`;
  return generated(
    ref,
    `The ${ordinal(a.index + 1)} of the world's ${AGES} ages, ${a.from}–${a.to} million years ago: ${AGE_WORDS[a.kind]}, ${warmer} than now, the seas ${seas}${a.forests ? "; forests grew on the land" : "; nothing yet grew on the land"}`,
    edges(world, [{ ref: g.planet.ref as Ref, role: "enabler", weight: 1 }]),
  );
});

registerExplainer(SPECIES.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const g = homePlanet(world).generated,
    s = g.life.species[parseRef(ref).b];
  if (!s) return null;
  // Where it arose: a spot of the fine world; the province that holds it.
  const origin = isProvinceWorld(g) ? g.provinceOf[s.origin]! : s.origin;
  if (s.niche === "upright ape") {
    // The people: where they arose, and the body their clade grew into there, and why.
    const c = origin,
      people = g.life.people;
    return generated(
      ref,
      `The ${s.name}, the people: they arose in the last age at ${deg(g.grid.lat[c]!)}${g.grid.lat[c]! >= 0 ? "N" : "S"}, where ${g.life.diversity[c]} kinds of beast lived${g.life.seedGrass[c]! >= 0 ? ` and the ${g.life.species[g.life.seedGrass[c]!]!.name} grew wild` : ""}${g.water.river[c] ? ", by a river" : ""}${people ? ` — ${people.because}. ${cap(bodyWords(people.body))}` : ""}`,
      edges(world, [
        { ref: cellRef(0, c), role: "enabler", weight: 0.6 },
        { ref: ageRef(0, s.arose), role: "enabler", weight: 0.4 },
      ]),
    );
  }
  let range = 0,
    land = 0;
  for (let c = 0; c < g.grid.count; c++)
    if (g.tectonics.elevation[c]! > 0) {
      land++;
      if (
        s.died === null &&
        ((g.life.present[2 * c + (s.index >> 5)]! >>> (s.index & 31)) & 1) === 1
      )
        range++;
    }
  const body =
    s.niche === "seed grass"
      ? `a grass${s.seed > 0.45 ? " whose seed is heavy enough to sow" : " of light seed"}`
      : `a ${s.niche} of ${s.size} kg${s.herd > 0.5 ? ", living in herds" : ""}${s.docility > 0.4 ? ", docile" : ", wild-tempered"}${s.wool ? ", woolly" : ""}${s.tame ? ": a beast that can be tamed" : ""}`;
  const life =
    s.died === null
      ? `it ranges over ${Math.max(1, Math.round((100 * range) / Math.max(1, land)))}% of the land`
      : `it died out in the ${ordinal(s.died + 1)} age`;
  return generated(
    ref,
    `The ${s.name}: ${body}; it arose in the ${ordinal(s.arose + 1)} age, and ${life}`,
    edges(world, [
      {
        ref: ageRef(0, s.died ?? s.arose),
        role: s.died === null ? "enabler" : "trigger",
        weight: 0.7,
      },
      { ref: cellRef(0, origin), role: "enabler", weight: 0.3 },
    ]),
  );
});

// A spot of the fine grid: its own ground, and the province it is part of.
registerExplainer(SPOT.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const pw = homePlanet(world).generated,
    g = pw.fine,
    c = parseRef(ref).b;
  if (c >= g.grid.count) return null;
  const e = g.tectonics.elevation[c]!,
    b = g.tectonics.boundary[c]!,
    near = b !== BOUNDARY.none && g.tectonics.toBoundary[c]! <= 3;
  return generated(
    ref,
    `${BIOME_NAMES[g.climate.biome[c]!]} at ${deg(g.grid.lat[c]!)}${g.grid.lat[c]! >= 0 ? "N" : "S"} ${deg(g.grid.lon[c]!)}${g.grid.lon[c]! >= 0 ? "E" : "W"}: ${Math.round(e)} m ${e >= 0 ? "above" : "below"} the sea, ${g.climate.temperature[c]!.toFixed(0)} °C, ${Math.round(g.climate.precipitation[c]!)} mm of rain a year${near ? `, near a ${BOUNDARY_WORDS[b]} plate boundary` : ""}`,
    edges(world, [
      { ref: g.tectonics.plates[g.tectonics.plate[c]!]!.ref as Ref, role: "enabler", weight: 0.7 },
      { ref: cellRef(0, pw.provinceOf[c]!), role: "constraint", weight: 0.3 },
    ]),
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
    `${BIOME_NAMES[g.climate.biome[c]!]} at ${deg(g.grid.lat[c]!)}${g.grid.lat[c]! >= 0 ? "N" : "S"} ${deg(g.grid.lon[c]!)}${g.grid.lon[c]! >= 0 ? "E" : "W"}: ${Math.round(e)} m ${e >= 0 ? "above" : "below"} the sea, ${g.climate.temperature[c]!.toFixed(0)} °C, ${Math.round(g.climate.precipitation[c]!)} mm of rain a year${near ? `, near a ${BOUNDARY_WORDS[b]} plate boundary` : ""}${surfaceCopper(g, c) ? "; copper ores lie at the surface" : ""}`,
    edges(world, [
      { ref: g.tectonics.plates[g.tectonics.plate[c]!]!.ref as Ref, role: "enabler", weight: 1 },
    ]),
  );
});

/** Another body of the star's system: its kind, orbit and ground, and why. */
function otherBody(world: World, b: SystemBody): Explanation {
  const g = homePlanet(world).generated,
    kind =
      b.kind === "moon"
        ? "A moon"
        : b.kind === "giant"
          ? "A giant of gas"
          : b.kind === "ice giant"
            ? "A giant of ice"
            : "A world of rock";
  return generated(
    b.ref,
    `${kind}, ${b.designation}: ${b.gravity.toFixed(2)} g, ${Math.round(b.temperature)} °C, ${b.air === "none" ? "airless" : `${b.air} air`}${b.water === "none" ? "" : b.water === "ice" ? ", its water ice" : ", with seas"} — ${b.because.join("; ")}`,
    edges(world, [
      { ref: (b.kind === "moon" ? b.orbit.around : g.star.ref) as Ref, role: "enabler", weight: 1 },
    ]),
  );
}

registerExplainer(CIVILIZATION.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const c = civilizationsNear(world).find((x) => x.ref === ref);
  if (!c) return null;
  return generated(
    ref,
    `A people of ${c.clade}s on a world of seas ${c.distance.toFixed(1)} light-years from home (${c.gravity.toFixed(2)} g): their chronicle began ${c.offset < 0 ? `${-c.offset} years before ours` : `in our year ${c.offset}`}, and they came to electronics in our year ${c.electronics}`,
    edges(world, [{ ref: c.star, role: "enabler", weight: 1 }]),
  );
});

registerExplainer(MOON.code, (world, ref) => {
  if (!hasPlanet(world)) return null;
  const b = homePlanet(world).generated.system.bodies.find((x) => x.ref === ref);
  return b ? otherBody(world, b) : null;
});

/** A surface cell in words: "the temperate forest at 39.7°S 102.3°E"; halls on another body by it. */
export function landWords(world: World, place: Ref | null): string {
  if (!place || kindCodeOf(place) !== SURFACE_CELL.code || !hasPlanet(world)) return "the land";
  const g = homePlanet(world).generated,
    c = parseRef(place).b,
    site = offworldSite(g, c);
  if (site && site.body < 0) {
    const ship = starSitesOf(world)?.get(c);
    if (!ship) return "a ship";
    const star = clusterOf(world).find((x) => x.ref === ship.star),
      where = `${star ? starKind(star) : "a star"} ${ship.distance.toFixed(1)} light-years out`;
    return ship.arrived ? `the halls on a world of ${where}` : `the ship bound for ${where}`;
  }
  if (site) return `the halls on ${g.system.bodies[site.body]!.designation}`;
  if (c >= g.grid.count) return "the land";
  const lat = g.grid.lat[c]!,
    lon = g.grid.lon[c]!;
  return `the ${BIOME_NAMES[g.climate.biome[c]!]} at ${deg(lat)}${lat >= 0 ? "N" : "S"} ${deg(lon)}${lon >= 0 ? "E" : "W"}`;
}

/** A star of the cluster in plain words, by its light: a red dwarf, a yellow star, a white dwarf. */
export function starKind(s: { spectral: string; remnant: boolean }): string {
  if (s.remnant) return "a white dwarf";
  switch (s.spectral[0]) {
    case "O":
    case "B":
      return "a blue star";
    case "A":
      return "a white star";
    case "F":
      return "a yellow-white star";
    case "G":
      return "a yellow star";
    case "K":
      return "an orange star";
    default:
      return "a red dwarf";
  }
}

/** Whether a ref names a generated thing this module explains. */
export function isGenerated(ref: Ref): boolean {
  return [
    STAR.code,
    PLANET.code,
    MOON.code,
    CIVILIZATION.code,
    PLATE.code,
    DEPOSIT.code,
    SURFACE_CELL.code,
  ].includes(kindCodeOf(ref));
}

function cap(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
