// The edge stones of a world's crust (Phase 54 M221): the stone a people knaps where its land's
// rock is each rock, as the crust sets it. A crust poor or rich in silica, one where nothing rusts
// (reduced), or one that is carbon-rich gives the same rock another edge. Earth's own crust is
// STONES, exactly; every other crust is STONES with its overrides laid over it, in order: silica,
// then reduced, then carbon-rich. Nine crusts in all, one table each.
import { STONES, type Stone } from "./stuffs.ts";
import type { Chemistry } from "./chemistry.ts";

/**
 * Where a crust has no flint (no biogenic silica, so no chalk nodules to weather out): the hard cobble
 * the fields turn up, ground to an edge. It is limestone's stone where the crust is poor in silica.
 */
export const FIELDSTONE: Stone = {
  name: "fieldstone",
  from: "whatever hard cobble the fields turn up, ground to an edge",
  keen: 0.35,
  tough: 0.8,
  colour: [0.55, 0.53, 0.5],
  subst: null,
};

/**
 * A silica-rich crust (pale, quartz-rich rock). Novaculite is the fine microcrystalline chert of
 * silica-rich sediments. Tholeiite takes basalt's own edge, so a basalt seat's edge is the same
 * whatever its silica.
 */
export const SILICA_HIGH_STONES: Readonly<Record<string, Stone>> = {
  shale: {
    name: "novaculite",
    from: "white beds of the silica-rich shale",
    keen: 0.9,
    tough: 0.5,
    colour: [0.86, 0.85, 0.8],
    subst: "chert",
  },
  basalt: {
    name: "tholeiite",
    from: "the dark olivine-free lava, flaked coarse and ground to an edge",
    keen: 0.45,
    tough: 0.9,
    colour: [0.24, 0.24, 0.26],
    subst: null,
  },
  andesite: {
    name: "obsidian",
    from: "the black glass of dacite flows",
    keen: 1,
    tough: 0.2,
    colour: [0.06, 0.06, 0.09],
    subst: "obsidian",
  },
  granite: {
    name: "quartz",
    from: "the white veins of the leucogranite",
    keen: 0.5,
    tough: 0.4,
    colour: [0.9, 0.9, 0.88],
    subst: "quartz",
  },
  sandstone: {
    name: "quartzite",
    from: "cobbles of the clean quartz sandstone",
    keen: 0.55,
    tough: 0.85,
    colour: [0.86, 0.83, 0.76],
    subst: "quartz",
  },
};

/**
 * A silica-poor crust (dark, magnesium-rich rock). Tachylite is basaltic glass: knappable but brittle.
 * Nephrite is the toughest natural stone. Corundum forms where quartz cannot, so it is ground, not
 * knapped. Picrite takes basalt's own edge.
 */
export const SILICA_LOW_STONES: Readonly<Record<string, Stone>> = {
  andesite: {
    name: "tachylite",
    from: "the black glass of its low-silica lavas",
    keen: 0.9,
    tough: 0.25,
    colour: [0.08, 0.07, 0.07],
    subst: "tachylite",
  },
  gneiss: {
    name: "nephrite",
    from: "green jade where the old hills' serpentine was altered",
    keen: 0.5,
    tough: 1,
    colour: [0.36, 0.52, 0.38],
    subst: "nephrite",
  },
  granite: {
    name: "corundum",
    from: "grey corundum of the quartz-poor tonalite, ground to an edge",
    keen: 0.7,
    tough: 0.6,
    colour: [0.48, 0.47, 0.5],
    subst: "corundum",
  },
  sandstone: {
    name: "greywacke",
    from: "hard grey cobbles of the gritty sandstone",
    keen: 0.5,
    tough: 0.8,
    colour: [0.42, 0.43, 0.42],
    subst: null,
  },
  limestone: FIELDSTONE,
  basalt: {
    name: "picrite",
    from: "the green-black olivine lava, flaked coarse and ground to an edge",
    keen: 0.45,
    tough: 0.9,
    colour: [0.2, 0.24, 0.2],
    subst: "olivine",
  },
};

/**
 * Where nothing rusts (the crust is reduced), the shale's and the coal measures' chert is black:
 * lydite.
 */
export const REDUCED_STONES: Readonly<Record<string, Stone>> = {
  shale: {
    name: "lydite",
    from: "black chert beds of the unrusted shale",
    keen: 0.8,
    tough: 0.6,
    colour: [0.1, 0.1, 0.11],
    subst: "chert",
  },
  "coal-measures": {
    name: "lydite",
    from: "black chert bands in the coal country's shale",
    keen: 0.8,
    tough: 0.6,
    colour: [0.1, 0.1, 0.11],
    subst: "chert",
  },
};

/** A carbon-rich crust. Moissanite is SiC: Mohs 9.25 and brittle. */
export const CARBON_STONES: Readonly<Record<string, Stone>> = {
  basalt: {
    name: "moissanite",
    from: "green-black carbide grains of the lava, ground to an edge",
    keen: 0.92,
    tough: 0.35,
    colour: [0.18, 0.3, 0.26],
    subst: "moissanite",
  },
  "coal-measures": {
    name: "lydite",
    from: "black chert bands of the graphite schist",
    keen: 0.8,
    tough: 0.6,
    colour: [0.1, 0.1, 0.11],
    subst: "chert",
  },
};

/**
 * A chemistry's crust as a key: its silica, then its redox, or "carbon" where the rock is
 * carbon-rich (a carbon-rich rock is reduced too, but its carbon names it). Earth's is
 * "solar/oxidised".
 */
export function stonesKey(chem: Chemistry): string {
  return `${chem.silica}/${chem.carbon === "carbon-rich" ? "carbon" : chem.redox}`;
}

/** Each crust's table, made once and kept by its key. */
const tables = new Map<string, Readonly<Record<string, Stone>>>();

/**
 * The edge table of a crust: STONES itself for the Sun's own chemistry and for Earth's crust (silica
 * solar, oxidised, not carbon-rich); else STONES with the overrides laid over it in order: silica, then
 * reduced, then carbon-rich. A carbon-rich crust is reduced too (nothing rusts in it), so it takes both.
 */
export function stonesFor(chem: Chemistry): Readonly<Record<string, Stone>> {
  if (chem.solar) return STONES;
  const key = stonesKey(chem);
  if (key === "solar/oxidised") return STONES;
  let table = tables.get(key);
  if (table === undefined) {
    const silica =
        chem.silica === "high"
          ? SILICA_HIGH_STONES
          : chem.silica === "low"
            ? SILICA_LOW_STONES
            : {},
      carbonRich = chem.carbon === "carbon-rich",
      reduced = chem.redox === "reduced" || carbonRich;
    table = {
      ...STONES,
      ...silica,
      ...(reduced ? REDUCED_STONES : {}),
      ...(carbonRich ? CARBON_STONES : {}),
    };
    tables.set(key, table);
  }
  return table;
}

/**
 * Of a land's rocks, the one whose stone in this table takes the keenest edge (the first of them, on a
 * tie): keenestRock's rule over any table. As keenestRock, it needs at least one rock.
 */
export function keenestIn(
  stones: Readonly<Record<string, Stone>>,
  rocks: readonly string[],
): string {
  return rocks.reduce((best, rock) =>
    (stones[rock]?.keen ?? 0) > (stones[best]?.keen ?? 0) ? rock : best,
  );
}

/** The stone a people knaps where its land's rock is limestone (every table holds all eight rocks). */
export function usualStone(chem: Chemistry): Stone {
  return stonesFor(chem).limestone!;
}
