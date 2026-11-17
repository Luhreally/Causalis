// Materials science (asked 2026-11-16: "dont forget materials science"): what a stuff can do, read from its atoms and the
// bonds between them, not looked up. An atom is known by what is the same on every world (its charge, its pull on electrons,
// its size, how fast it holds its neighbours, the heat it lets go at); a stuff by its formula and how it was worked. From
// those, by the same laws everywhere:
//   - its weight a cubic metre (its atoms' mass over the room their packing takes);
//   - its stiffness (the bond energy held in each atom's room);
//   - its strength: a pure metal's from its stiffness and how near its world's warmth is to its melting (tin is soft near
//     its melt, tungsten hard far below), more for each atom of another size and stiffness set among it (Labusch), more for
//     carbon held as carbide (pearlite), much more for carbon locked in by a quench (martensite), less where it breaks first;
//   - its hardness (from its flow stress, Tabor) and on the scratch scale;
//   - its toughness (the work its plastic zone takes, over the surface energy of a clean break), and so whether a blow
//     bends it or breaks it; a body-centred metal turns brittle below a point set by its melt and what is in it;
//   - how well it carries a current (its electrons scattered by its warmth, its open d shell and every foreign atom: Nordheim
//     and Linde);
//   - whether it is a magnet (its 3d shell's filling: Slater and Pauling), and how its oxide sits on it (the oxide's room
//     against the metal's, Pilling and Bedworth), so how fast it rusts under its world's air;
//   - a diamond-like crystal's band gap (its bond length and the pull between its two kinds of atom), and the purity a switch
//     of it needs at its world's warmth.
// And the ways a people may come to make stuffs it could not (heat treatment, alloys, ceramics, lime and cement, made
// polymers, composites, pure crystal, magnets, lossless wire), each asking the heat its own physics names, what its world's
// ground holds, and the tools its people know. Pure tables and arithmetic: sim/lore/materials.ts keeps what each land knows.
import { dmath } from "../kernel/index.ts";
import { findSubstance, molarMass } from "./matter.ts";
import { boundAtom } from "./laws.ts";

// —— Atoms ————————————————————————————————————————————————————————————————————————————————————————————————————

/** How an element's atoms pack when it stands pure. */
export type Lattice = "fcc" | "bcc" | "hcp" | "tetragonal" | "diamond" | "other" | "molecular";

/**
 * An atom as every world has it: its charge (Z), Pauling's electronegativity, its radius (pm: a metal's twelve-fold, else its
 * tetrahedral covalent one), its tetrahedral covalent radius (pm), its cohesive energy (eV an atom, Kittel), the melting point
 * of its pure solid (K), how its pure solid packs, whether it is a metal, the electrons it gives the sea of a metal, its d
 * electrons where its d shell is open (null: none, or full), and its usual cation in an oxide (charge, Shannon radius pm).
 */
export type Atom = {
  readonly z: number;
  readonly chi: number;
  readonly r: number;
  readonly cov: number;
  readonly ecoh: number;
  readonly meltK: number;
  readonly lattice: Lattice;
  readonly metal: boolean;
  readonly free: number;
  readonly d: number | null;
  readonly ion: { readonly charge: number; readonly r: number } | null;
};

const A = (
  z: number,
  chi: number,
  r: number,
  cov: number,
  ecoh: number,
  meltK: number,
  lattice: Lattice,
  metal: boolean,
  free: number,
  d: number | null,
  ion: [number, number] | null,
): Atom => ({
  z,
  chi,
  r,
  cov,
  ecoh,
  meltK,
  lattice,
  metal,
  free,
  d,
  ion: ion ? { charge: ion[0], r: ion[1] } : null,
});

/** The atoms the tables' stuffs are made of. */
export const ATOMS: Readonly<Record<string, Atom>> = {
  H: A(1, 2.2, 31, 32, 0.01, 14, "molecular", false, 1, null, null),
  B: A(5, 2.04, 84, 88, 5.81, 2349, "other", false, 3, null, [3, 27]),
  C: A(6, 2.55, 77, 77, 7.37, 3900, "diamond", false, 4, null, null),
  N: A(7, 3.04, 71, 70, 0.01, 63, "molecular", false, 5, null, null),
  O: A(8, 3.44, 66, 66, 0.01, 54, "molecular", false, 6, null, null),
  Na: A(11, 0.93, 186, 166, 1.113, 371, "bcc", true, 1, null, [1, 102]),
  Mg: A(12, 1.31, 160, 140, 1.51, 923, "hcp", true, 2, null, [2, 72]),
  Al: A(13, 1.61, 143, 126, 3.39, 933, "fcc", true, 3, null, [3, 53.5]),
  Si: A(14, 1.9, 117, 117, 4.63, 1687, "diamond", false, 4, null, [4, 40]),
  P: A(15, 2.19, 110, 110, 3.43, 317, "molecular", false, 5, null, [5, 38]),
  S: A(16, 2.58, 104, 104, 2.85, 388, "molecular", false, 6, null, null),
  Cl: A(17, 3.16, 99, 99, 1.4, 172, "molecular", false, 7, null, null),
  Ar: A(18, 3.2, 106, 106, 0.08, 84, "molecular", false, 0, null, null),
  K: A(19, 0.82, 227, 203, 0.934, 337, "bcc", true, 1, null, [1, 138]),
  Ca: A(20, 1.0, 197, 176, 1.84, 1115, "fcc", true, 2, null, [2, 100]),
  Ti: A(22, 1.54, 147, 136, 4.85, 1941, "hcp", true, 2, 2, [4, 60.5]),
  V: A(23, 1.63, 134, 125, 5.31, 2183, "bcc", true, 2, 3, [5, 54]),
  Fe: A(26, 1.83, 126, 117, 4.28, 1811, "bcc", true, 1, 6, [3, 64.5]),
  Ni: A(28, 1.91, 124, 115, 4.44, 1728, "fcc", true, 1, 8, [2, 69]),
  Cu: A(29, 1.9, 128, 135, 3.49, 1358, "fcc", true, 1, null, [2, 73]),
  Zn: A(30, 1.65, 134, 131, 1.35, 693, "hcp", true, 2, null, [2, 74]),
  Ga: A(31, 1.81, 135, 126, 2.81, 303, "other", true, 3, null, [3, 62]),
  Ge: A(32, 2.01, 122, 122, 3.85, 1211, "diamond", false, 4, null, [4, 53]),
  As: A(33, 2.18, 121, 118, 2.96, 1090, "other", false, 5, null, [5, 46]),
  Nb: A(41, 1.6, 146, 136, 7.57, 2750, "bcc", true, 1, 4, [5, 64]),
  Sn: A(50, 1.96, 151, 140, 3.14, 505, "tetragonal", true, 4, null, [4, 69]),
  W: A(74, 2.36, 139, 130, 8.9, 3695, "bcc", true, 2, 4, [6, 60]),
  Au: A(79, 2.54, 144, 136, 3.81, 1337, "fcc", true, 1, null, [3, 85]),
};

/** An atom by its symbol (null: one no table's stuff is made of). */
export const atomOf = (symbol: string): Atom | null => ATOMS[symbol] ?? null;

const BOUND = new Map<number, Readonly<Record<string, Atom>>>();
/** The atoms of a universe whose binding is so many times ours (rules/laws.ts boundAtom): ours at 1. */
export function boundAtoms(binding: number): Readonly<Record<string, Atom>> {
  if (binding === 1) return ATOMS;
  let t = BOUND.get(binding);
  if (!t) {
    if (BOUND.size >= 8) BOUND.clear();
    t = Object.fromEntries(Object.entries(ATOMS).map(([k, a]) => [k, boundAtom(a, binding)]));
    BOUND.set(binding, t);
  }
  return t;
}

/** The share of a sphere-packed solid its atoms fill, by how they pack. */
export const PACKING: Readonly<Record<Lattice, number>> = {
  fcc: 0.74,
  hcp: 0.74,
  bcc: 0.68,
  tetragonal: 0.535,
  other: 0.53,
  diamond: 0.34,
  molecular: 0.5,
};

/** Physics' constants: an atomic mass unit (kg), an electronvolt (J), Boltzmann's (eV a kelvin). */
export const AMU = 1.66054e-27,
  EV = 1.602177e-19,
  K_B = 8.617333e-5;

const sq = (x: number) => x * x;
const ball = (pm: number) => (4 / 3) * dmath.PI * sq(pm * 1e-12) * (pm * 1e-12);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** The room an atom takes in its own pure solid (m³). */
export function atomRoom(a: Atom): number {
  return ball(a.r) / PACKING[a.lattice];
}

/** An element's stiffness pure (GPa): the bond energy held in each atom's room, as a cohesive-energy density. */
export function stiffnessOf(a: Atom): number {
  return (MATERIAL_LAWS.stiffness * a.ecoh * EV) / atomRoom(a) / 1e9;
}

// —— The laws' figures ——————————————————————————————————————————————————————————————————————————————————————

/**
 * The few figures the laws are read with. Each is set once, so that the laws give Earth's metals near their handbook figures
 * (tests/rules/materials.test.ts says how near), and then hold for every stuff of every world alike.
 */
export const MATERIAL_LAWS = {
  /** Young's modulus against cohesive energy density (E ≈ 2.8 Ecoh/Ω: copper 132 GPa). */
  stiffness: 2.8,
  /** An annealed metal's tensile strength against its stiffness, at no warmth (σ ≈ 0.0024 E (1 − T/Tm)²). */
  pure: 0.0024,
  /** How much harder each packing is to slip, against a face-centred metal's: a body-centred one's lattice drag, a hexagonal one's few planes. */
  lattice: {
    fcc: 1,
    bcc: 1.4,
    hcp: 2,
    tetragonal: 1,
    other: 1,
    diamond: 1,
    molecular: 1,
  } as Readonly<Record<Lattice, number>>,
  /** Solid-solution strengthening (Labusch: Δσ = k E ε^4/3 c^2/3; bronze's tenth of tin adds 100 MPa to copper). */
  solution: 0.00464,
  /** Carbon held as carbide in iron (pearlite): MPa for each share of the atoms in cementite (1% carbon steel ≈ 800 MPa). */
  pearlite: 2400,
  /** Carbon set in another metal's gaps: E × this × √(share). */
  gaps: 0.02,
  /** The tensile strength against hardness (MPa against Vickers' kgf/mm²). */
  tabor: 3.3,
  /** Martensite's hardness by carbon (HV = 200 + 680 (1 − e^(−wt%/0.33)): 0.4% gives 680, 1% gives 850). */
  martensite: { base: 200, rise: 680, carbon: 0.33 },
  /** A temper at a third of iron's melt keeps this much of a quench's hardness. */
  temper: 0.8,
  /** How far a cold-worked face-centred metal is hardened, and more for its solutes (×1.6 + 2c); a body-centred one less. */
  worked: { fcc: 1.6, solute: 2, bcc: 1.4 },
  /** Ductility (elongation's share, 0 … 1) a pure solid shows, by its packing. */
  ductile: {
    fcc: 0.5,
    bcc: 0.35,
    hcp: 0.15,
    tetragonal: 0.4,
    other: 0.05,
    diamond: 0,
    molecular: 0,
  } as Readonly<Record<Lattice, number>>,
  /** The length the plastic zone at a crack's tip is reckoned over (m), and the flaw a worked piece holds (m). */
  zone: 1e-3,
  flaw: 1e-3,
  /** A clean break's surface energy against cohesion (γ ≈ Ecoh / 20 r²: iron 2.2 J/m², copper 1.7). */
  surface: 20,
  /** A body-centred metal turns brittle below this share of its melt (iron −20 °C, tungsten 240 °C), lowered by nickel, raised by carbide. */
  brittle: { share: 0.14, nickel: 4, carbide: 100 },
  /** Electrons scattered by warmth: ρ = K (T/Tm) Ω^2/3 (copper 1.7 µΩcm at 20 °C), by 1 + 1.6 for each hole of an open d shell. */
  phonon: 1.51e12,
  dHole: 1.6,
  /** Each foreign atom's scattering (µΩcm for a share x(1 − x)): 20 for each electron's difference squared, 100 for an open d shell; 150 a share set in the gaps. */
  linde: 20,
  lindeD: 100,
  gapScatter: 150,
  /** Charcoal's carbon taken up at a forged iron edge (wt%), and a bog iron's (its lean, wet ore gives a softer bloom). */
  forgeCarbon: 0.6,
  bogCarbon: 0.3,
} as const;

// —— A metal from its formula and how it was worked ———————————————————————————————————————————————————————————

/** How a metal was worked: as it set from the melt, softened by heat, hammered cold, forged hot, quenched, or quenched and tempered. */
export type Worked = "cast" | "annealed" | "hammered" | "forged" | "quenched" | "tempered";

/** What a metal is made of: its host atom, the others set in its sites (each a share of the sites), those in its gaps. */
export type MetalMake = {
  readonly host: string;
  readonly sites: readonly (readonly [string, number])[];
  readonly gaps: readonly (readonly [string, number])[];
};

/** The small atoms that sit in a metal's gaps rather than its sites (Hägg: under six tenths of its radius). */
const GAPS = new Set(["H", "B", "C", "N"]);
/** The half-metals that take a metal's sites as its own atoms do (arsenic in copper, silicon in iron). */
const SITE_METALLOIDS = new Set(["Si", "Ge", "As"]);

/** A metal's make-up from its formula: its host the most of its atoms that are a metal. */
export function metalMake(formula: Readonly<Record<string, number>>): MetalMake | null {
  // (A metal only: every atom known, none an oxide's, a sulphide's or a salt's, no diamond-like crystal, its gaps at most
  // cementite's quarter, its host at least half its sites.)
  if (
    Object.keys(formula).some(
      (e) => !ATOMS[e] || (!ATOMS[e].metal && !GAPS.has(e) && !SITE_METALLOIDS.has(e)),
    )
  )
    return null;
  if (tetrahedral(formula)) return null;
  const parts = Object.entries(formula);
  const metals = parts
    .filter(([e]) => ATOMS[e]!.metal)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  if (!metals.length) return null;
  const host = metals[0]![0],
    sitesN = parts.filter(([e]) => !GAPS.has(e)).reduce((s, [, n]) => s + n, 0),
    gapsN = parts.filter(([e]) => GAPS.has(e)).reduce((s, [, n]) => s + n, 0),
    all = sitesN + gapsN;
  if (sitesN <= 0 || gapsN / all > 0.26 || metals[0]![1] / sitesN < 0.5) return null;
  return {
    host,
    sites: parts
      .filter(([e]) => !GAPS.has(e))
      .map(([e, n]) => [e, n / sitesN] as const)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
    gaps: parts.filter(([e]) => GAPS.has(e)).map(([e, n]) => [e, n / all] as const),
  };
}

/** A metal's figures, as worked, at a warmth. */
export type MetalFigures = {
  /** kg/m³. */
  readonly density: number;
  /** °C. */
  readonly meltC: number;
  /** GPa. */
  readonly stiffness: number;
  /** Tensile strength as worked (MPa), and the stress it flows at. */
  readonly strength: number;
  readonly flows: number;
  /** Vickers (kgf/mm²), and the scratch scale (Mohs). */
  readonly hv: number;
  readonly mohs: number;
  /** Elongation's share before it breaks (0 … 1). */
  readonly ductility: number;
  /** Fracture toughness (MPa √m). */
  readonly toughness: number;
  /** Whether a blow breaks it before it bends (below its brittle point, or carbide all through). */
  readonly brittle: boolean;
  /** The warmth below which it turns brittle (°C; null: a packing that never does). */
  readonly brittleC: number | null;
  /** Million siemens a metre. */
  readonly conductivity: number;
  /** Bohr magnetons an atom (0: no magnet). */
  readonly moment: number;
  /** Carbon by weight (%), where it holds any. */
  readonly carbonWt: number;
};

const gapShare = (m: MetalMake, el: string) => m.gaps.find(([e]) => e === el)?.[1] ?? 0;
const siteShare = (m: MetalMake, el: string) => m.sites.find(([e]) => e === el)?.[1] ?? 0;

/** Carbon by weight (%) in a formula. */
export function carbonWtOf(formula: Readonly<Record<string, number>>): number {
  const c = formula.C ?? 0;
  return c > 0 ? (100 * c * 12.011) / molarMass(formula) : 0;
}

/** A formula with its carbon set to so much by weight (the rest as it was). */
function withCarbon(formula: Readonly<Record<string, number>>, wt: number): Record<string, number> {
  const rest = Object.entries(formula).filter(([e]) => e !== "C");
  const restMass = rest.reduce((s, [e, n]) => s + n * (findMass(e) ?? 0), 0);
  // (wt% = 100 c 12.011 / (c 12.011 + restMass): so c = wt restMass / (12.011 (100 − wt)).)
  const c = (wt * restMass) / (12.011 * (100 - wt));
  return { ...Object.fromEntries(rest), C: c };
}
const findMass = (e: string) => molarMass({ [e]: 1 });

/**
 * A metal's figures from its formula, worked so, at a warmth (K): each by its law, nothing looked up but its atoms.
 * Null where the formula holds no metal.
 */
export function metalFigures(
  formula: Readonly<Record<string, number>>,
  worked: Worked = "annealed",
  kelvin = 288,
  how: { readonly flaw?: number; readonly edgeCarbon?: number; readonly binding?: number } = {},
): MetalFigures | null {
  const L = MATERIAL_LAWS,
    // (Its universe's atoms: a Creator's binding scales how fast they hold and how hot they melt, rules/laws.ts.)
    AT = boundAtoms(how.binding ?? 1);
  // A forged iron edge takes up its hearth's carbon (charcoal's), where it held less.
  let f: Readonly<Record<string, number>> = formula;
  const isIron = metalMake(formula)?.host === "Fe";
  if (isIron && (worked === "forged" || worked === "quenched" || worked === "tempered")) {
    const want = how.edgeCarbon ?? L.forgeCarbon;
    if (carbonWtOf(formula) < want) f = withCarbon(formula, want);
  }
  const m = metalMake(f);
  if (!m) return null;
  const host = AT[m.host]!,
    lattice = host.lattice,
    hostE = stiffnessOf(host),
    // (Each atom set in the host's sites takes the room its size takes in the host's packing.)
    room = (a: Atom) => ball(a.r) / PACKING[lattice],
    siteRoom = m.sites.reduce((s, [e, x]) => s + x * room(AT[e]!), 0),
    sitesOfAll = 1 - m.gaps.reduce((s, [, x]) => s + x, 0),
    massSite =
      m.sites.reduce((s, [e, x]) => s + x * findMass(e), 0) +
      m.gaps.reduce((s, [e, x]) => s + (x / Math.max(1e-9, sitesOfAll)) * findMass(e), 0),
    density = (massSite * AMU) / siteRoom,
    carbonWt = carbonWtOf(f),
    // Its melt: its sites' by their shares, lowered by what sits in its gaps (iron's liquidus falls 91 K a % of carbon).
    meltK = m.sites.reduce((s, [e, x]) => s + x * AT[e]!.meltK, 0) - 91 * carbonWt,
    E = m.sites.reduce((s, [e, x]) => s + x * stiffnessOf(AT[e]!), 0),
    homologous = Math.min(0.98, kelvin / Math.max(1, meltK)),
    // Pure: from its stiffness, harder to slip in its packing, softer near its melt.
    pure = L.pure * E * 1000 * L.lattice[lattice] * sq(1 - homologous);
  // Atoms of another size and stiffness among its own (Labusch), and their share of its sites.
  let solution = 0,
    solutes = 0;
  for (const [e, c] of m.sites) {
    if (e === m.host) continue;
    const a = AT[e]!,
      delta = (a.r - host.r) / host.r,
      eta = Math.abs(stiffnessOf(a) - hostE) / hostE,
      eps = eta / (1 + eta / 2) + 3 * Math.abs(delta);
    solution += L.solution * E * 1000 * dmath.pow(eps, 4 / 3) * dmath.pow(c, 2 / 3);
    solutes += c;
  }
  // Carbon held: as carbide in iron (pearlite, cementite a quarter carbon), else in another metal's gaps.
  const carbon = gapShare(m, "C"),
    carbide = m.host === "Fe" ? Math.min(1, carbon / 0.25) : 0,
    gapHard =
      m.host === "Fe"
        ? L.pearlite * carbide
        : m.gaps.reduce((s, [, x]) => s + L.gaps * E * 1000 * dmath.sqrt(x), 0);
  let strength = pure + solution + gapHard,
    hv = strength / L.tabor;
  // Its ductility: its packing's, less for its solutes and its carbide, less again for how it was worked.
  let ductility =
    L.ductile[lattice] * Math.max(0.1, 1 - 1.5 * solutes) * sq(Math.max(0, 1 - carbide / 0.45));
  const marten = isIron && carbonWt > 0.1 && (worked === "quenched" || worked === "tempered");
  if (marten) {
    const q =
      L.martensite.base + L.martensite.rise * (1 - dmath.exp(-carbonWt / L.martensite.carbon));
    hv = worked === "tempered" ? q * L.temper : q;
    strength = hv * L.tabor;
    ductility *= worked === "tempered" ? 0.5 : 0.04;
  } else if (worked === "hammered") {
    const k = lattice === "fcc" ? L.worked.fcc + L.worked.solute * solutes : L.worked.bcc;
    strength *= k;
    hv = strength / L.tabor;
    ductility *= 0.3;
  } else if (worked === "forged") {
    strength *= 1.1;
    hv = strength / L.tabor;
    ductility *= 0.9;
  } else if (worked === "cast") {
    strength *= 0.95;
    hv = strength / L.tabor;
    ductility *= 0.8;
  }
  // A body-centred metal's brittle point: a share of its melt, lowered by nickel, raised by coarse carbide (a temper's fine
  // carbide does not raise it).
  const brittleK =
    lattice === "bcc"
      ? L.brittle.share * host.meltK * Math.max(0.2, 1 - L.brittle.nickel * siteShare(m, "Ni")) +
        (marten ? 0 : L.brittle.carbide * Math.min(carbide, 0.18))
      : null;
  const cold = brittleK !== null && kelvin < brittleK;
  if (cold) ductility *= 0.003;
  ductility = Math.max(0.0001, ductility);
  // Toughness: a clean break's (√(2Eγ)) and the work of its plastic zone.
  const gamma = (host.ecoh * EV) / (L.surface * sq(host.r * 1e-12)),
    k0 = dmath.sqrt(2 * E * 1e9 * gamma) / 1e6,
    flows = 0.8 * strength,
    toughness = dmath.sqrt(k0 * k0 + E * 1000 * flows * ductility * L.zone),
    // (It breaks before it is drawn out where its flaw opens first.)
    breaks = toughness / dmath.sqrt(dmath.PI * (how.flaw ?? L.flaw)),
    brittle = cold || ductility < 0.01;
  strength = Math.min(strength, breaks);
  // Its current: scattered by its warmth (more for each hole of an open d shell), by every foreign atom, by what is in its gaps.
  const dHoles = host.d === null ? 0 : 10 - host.d,
    phonon =
      L.phonon *
      (kelvin / host.meltK) *
      dmath.pow(atomRoom(host), 2 / 3) *
      (1 + L.dHole * dHoles) *
      1e8;
  let foreign = 0;
  for (const [e, c] of m.sites) {
    if (e === m.host) continue;
    const a = AT[e]!,
      dv = Math.abs(a.free - host.free);
    foreign += (L.linde * dv * dv + (a.d !== null ? L.lindeD : 0)) * c * (1 - c);
  }
  const gapScatter = m.gaps.reduce((s, [, x]) => s + L.gapScatter * x * (1 - x), 0),
    conductivity = 100 / (phonon + foreign + gapScatter);
  // A magnet: a late 3d host (Slater–Pauling: 10.6 less the electrons past argon, a site's average).
  const late3d = m.host === "Fe" || m.host === "Ni" || m.host === "Co",
    outer = m.sites.reduce((s, [e, x]) => s + x * (AT[e]!.z - 18), 0),
    moment = late3d ? Math.max(0, Math.min(2.6, 10.6 - outer)) : 0;
  return {
    density: Math.round(density),
    meltC: Math.round(meltK - 273.15),
    stiffness: Math.round(E),
    strength: Math.round(strength),
    flows: Math.round(Math.min(flows, strength)),
    hv: Math.round(hv),
    mohs: Math.round(10 * Math.min(10, Math.max(1, 0.53 * dmath.pow(Math.max(1, hv), 0.368)))) / 10,
    ductility: Math.round(1000 * ductility) / 1000,
    toughness: Math.round(10 * toughness) / 10,
    brittle,
    brittleC: brittleK === null ? null : Math.round(brittleK - 273.15),
    conductivity: Math.round(100 * conductivity) / 100,
    moment: Math.round(100 * moment) / 100,
    carbonWt: Math.round(100 * carbonWt) / 100,
  };
}

/** A substance's metal figures by its id (its formula from the tables). */
export function substanceFigures(
  id: string,
  worked: Worked = "annealed",
  kelvin = 288,
): MetalFigures | null {
  const s = findSubstance(id);
  return s ? metalFigures(s.formula, worked, kelvin) : null;
}

// —— An edge from its figures ————————————————————————————————————————————————————————————————————————————————

/**
 * How keen an edge a metal takes and holds (its hardness, on a log scale from lead-soft, Vickers 25, to a tempered blade,
 * 450, less what a brittle edge chips) and how well it bears a blow (its strength and its toughness, each on a log scale,
 * the weaker telling most): the Edge every quality is reckoned from (rules/stuffs.ts qualityOf).
 */
export function edgeFromFigures(f: Pick<MetalFigures, "hv" | "strength" | "toughness">): {
  readonly keen: number;
  readonly tough: number;
} {
  // (A brittle edge chips as it cuts: it keeps three quarters of its keenness at a toughness of 5, all of it from 50.)
  const chips = clamp01(0.75 + 0.25 * dmath.log10(Math.max(0.5, f.toughness) / 5)),
    keen = clamp01(dmath.log(Math.max(1, f.hv) / 25) / dmath.log(450 / 25)) * chips,
    s = clamp01(dmath.log(Math.max(1, f.strength) / 30) / dmath.log(50)),
    k = clamp01(dmath.log(Math.max(1, f.toughness)) / dmath.log(100)),
    tough = 0.85 * dmath.sqrt(s * k);
  return { keen: Math.round(100 * keen) / 100, tough: Math.round(100 * tough) / 100 };
}

/** A metal stuff as the tables name it: its formula (or its substance's), how it is worked, and its flaws. */
export type MetalRecipe = {
  readonly subst?: string;
  readonly formula?: Readonly<Record<string, number>>;
  readonly worked: Worked;
  readonly kelvin?: number;
  readonly flaw?: number;
  readonly edgeCarbon?: number;
  /** Its universe's binding (rules/laws.ts): 1, ours, unless said. */
  readonly binding?: number;
};

/** A metal stuff's figures, by its recipe. */
export function recipeFigures(r: MetalRecipe): MetalFigures {
  const formula = r.formula ?? findSubstance(r.subst ?? "")?.formula;
  if (!formula) throw new Error(`no formula for ${r.subst}`);
  const f = metalFigures(formula, r.worked, r.kelvin ?? 288, {
    ...(r.flaw !== undefined ? { flaw: r.flaw } : {}),
    ...(r.edgeCarbon !== undefined ? { edgeCarbon: r.edgeCarbon } : {}),
    ...(r.binding !== undefined ? { binding: r.binding } : {}),
  });
  if (!f) throw new Error(`no metal in ${r.subst}`);
  return f;
}

/** A metal stuff's edge, by its recipe. */
export const recipeEdge = (r: MetalRecipe) => edgeFromFigures(recipeFigures(r));

/**
 * The tables' metals as they are made: what each is of and how it is worked (rules/stuffs.ts METALS, rules/chem-ores.ts
 * NOVEL_METALS, rules/kind-ground.ts KIND_METALS take their edges from these). Bog iron's lean wet ore gives a bloom with
 * less carbon and more slag (a flaw three times a clean bloom's); meteoric iron is a twentieth nickel, hammered cold in an
 * ammonia world's cold (−70 °C) or broken in a methane world's (−180 °C).
 */
export const METAL_RECIPES: Readonly<Record<string, MetalRecipe>> = {
  copper: { subst: "copper", worked: "hammered" },
  bronze: { subst: "bronze", worked: "hammered" },
  "bog iron": { subst: "iron", worked: "forged", flaw: 3e-3, edgeCarbon: MATERIAL_LAWS.bogCarbon },
  iron: { subst: "iron", worked: "forged" },
  steel: { subst: "steel", worked: "tempered" },
  "arsenical copper": { subst: "arsenical-copper", worked: "hammered" },
  cupronickel: { subst: "cupronickel", worked: "hammered" },
  "telluric iron": { subst: "telluric-iron", worked: "forged", flaw: 2e-3 },
  "cohenite iron": { subst: "cohenite-iron", worked: "forged" },
  "cold copper": { subst: "native-copper", worked: "hammered" },
  "carbide iron": { formula: { Fe: 0.75, C: 0.25 }, worked: "cast" },
  "star iron": { formula: { Fe: 0.94, Ni: 0.06 }, worked: "hammered", kelvin: 203 },
  "brittle star iron": { formula: { Fe: 0.94, Ni: 0.06 }, worked: "hammered", kelvin: 93 },
};

/** A table metal's edge, derived (its recipe by name). */
export function metalEdge(name: string): { readonly keen: number; readonly tough: number } {
  const r = METAL_RECIPES[name];
  if (!r) throw new Error(`no recipe for ${name}`);
  return recipeEdge(r);
}

// —— Rust ——————————————————————————————————————————————————————————————————————————————————————————————————

/** The oxide ion's radius (pm, Shannon), and the share of an oxide's room its ions fill. */
const OXIDE_ION = 140,
  OXIDE_PACKING = 0.7;

/**
 * A metal's oxide's room against the metal's own (Pilling–Bedworth), from the ions' sizes: under 1 the oxide is torn open,
 * from 1 to 2 it closes over the metal and keeps the air off it, over 2 it swells and flakes away.
 */
export function oxideRatio(a: Atom): number | null {
  if (!a.ion) return null;
  const oxygens = a.ion.charge / 2;
  return (oxygens * ball(OXIDE_ION) + ball(a.ion.r)) / OXIDE_PACKING / atomRoom(a);
}

/** Micrometres a year bare iron loses in a temperate, wet air of Earth's oxygen (est: rural and town air, 10 to 50). */
export const RUST_IRON_UM = 30;

/**
 * How fast a metal rusts (µm a year), under an air of so much oxygen (its share) and wet or dry: by how far oxygen pulls on
 * its electrons past gold's (electronegativity), whether its oxide keeps the air off (Pilling–Bedworth), and its air.
 */
export function rustRate(symbol: string, o2: number, wet: boolean): number {
  const a = ATOMS[symbol];
  if (!a || !a.metal) return 0;
  const pull = 3.44 - a.chi - 1;
  if (pull <= 0) return 0;
  const pb = oxideRatio(a) ?? 2.5,
    kept = pb >= 1 && pb <= 2 ? 0.05 : pb < 1 ? 2 : 1;
  return RUST_IRON_UM * (pull / (3.44 - 1.83 - 1)) * kept * (o2 / 0.2095) * (wet ? 1 : 0.2);
}

// —— Crystals that switch ————————————————————————————————————————————————————————————————————————————————————

/** The diamond-like crystals the band-gap law reads (tetrahedral, of group 13 to 16, not an oxide). */
export function tetrahedral(
  formula: Readonly<Record<string, number>>,
): readonly [string, string] | null {
  const els = Object.keys(formula);
  if (els.length === 1 && ATOMS[els[0]!]?.lattice === "diamond") return [els[0]!, els[0]!];
  if (els.length !== 2 || els.includes("O")) return null;
  const [a, b] = els as [string, string];
  if (!ATOMS[a] || !ATOMS[b]) return null;
  // (Each atom gives on average four electrons to the bonds: 3 + 5, 2 + 6, 4 + 4.)
  const va = valenceOf(a),
    vb = valenceOf(b);
  return va !== null && vb !== null && va + vb === 8 && formula[a] === formula[b] ? [a, b] : null;
}
const VALENCE: Readonly<Record<string, number>> = {
  B: 3,
  Al: 3,
  Ga: 3,
  C: 4,
  Si: 4,
  Ge: 4,
  Sn: 4,
  N: 5,
  P: 5,
  As: 5,
  Zn: 2,
  O: 6,
  S: 6,
};
const valenceOf = (e: string) => VALENCE[e] ?? null;

/** The band-gap law: diamond's gap at its bond, falling as the 3.79th power of the bond's length, and Δχ² × 2.8 eV more for ionicity. */
export const GAP_LAW = { diamond: 5.47, bond: 1.54, power: 3.79, ionic: 2.8 } as const;

/** A diamond-like crystal's band gap (eV), from its bond's length and its two atoms' pull; null for any other stuff. */
export function bandGapOf(formula: Readonly<Record<string, number>>, binding = 1): number | null {
  const pair = tetrahedral(formula);
  if (!pair) return null;
  const a = ATOMS[pair[0]]!,
    b = ATOMS[pair[1]]!,
    bond = (a.cov + b.cov) / 100,
    chi = a.chi - b.chi;
  // (A Creator's binding widens every gap as it deepens every bond.)
  const g =
    binding *
    (GAP_LAW.diamond * dmath.pow(GAP_LAW.bond / bond, GAP_LAW.power) + GAP_LAW.ionic * chi * chi);
  return Math.round(100 * g) / 100;
}

/**
 * The least foreign atoms a switch's crystal must be clean of, in nines (9: one in a thousand million): a switch must be
 * doped past what its warmth itself frees (a hundredfold the crystal's own carriers, ni = 2.5×10²⁵ (T/300)^1.5 e^(−Eg/2kT)
 * a cubic metre) and past a thousand charges in a cubic micrometre, and what is in it unasked must be a hundredth of that.
 */
export function purityNeeded(gapEv: number, kelvin: number, atomsM3: number): number {
  const ni = 2.5e25 * dmath.pow(kelvin / 300, 1.5) * dmath.exp(-gapEv / (2 * K_B * kelvin)),
    doped = Math.max(1e21, 100 * ni),
    stray = 0.01 * doped;
  return Math.round(100 * dmath.log10(atomsM3 / stray)) / 100;
}

/** Atoms a cubic metre of a substance holds (its density over its atoms' mean mass). */
export function atomsPerM3(id: string): number {
  const s = findSubstance(id);
  if (!s) return 5e28;
  const atoms = Object.values(s.formula).reduce((n, x) => n + x, 0);
  return s.density / ((molarMass(s.formula) / atoms) * AMU);
}

// —— What a people may come to make ————————————————————————————————————————————————————————————————————————————

/** A way's class: what kind of stuff it makes. */
export type WayClass =
  | "treatment"
  | "alloy"
  | "ceramic"
  | "binder"
  | "polymer"
  | "composite"
  | "crystal"
  | "magnet"
  | "lossless";

/** What a land's world and its people hold, as a way is asked of: read by sim/lore/materials.ts. */
export type WayFacts = {
  /** The hottest its people can make (°C). */
  readonly heat: number;
  readonly knows: (principle: string) => boolean;
  readonly made: (way: string) => boolean;
  /** Parts a million of an element in its world's crust. */
  readonly ppm: (symbol: string) => number;
  /** Whether its world's rock holds a substance (any of its rocks and soils, rules/means.ts rockHolds). */
  readonly rock: (subst: string) => boolean;
  /** Whether its world's air holds a substance (a methane haze, its feedstock). */
  readonly air: (subst: string) => boolean;
  /** Whether its land has coal or oil within reach. */
  readonly fuel: boolean;
  /** The crystal its world switches a current with (null: none), its melt (°C). */
  readonly crystal: { readonly subst: string; readonly meltC: number } | null;
};

/** A way a land may come to make a stuff. */
export type MaterialWay = {
  readonly id: string;
  readonly name: string;
  readonly cls: WayClass;
  /** What it makes, in a few words (what and what it does, never how). */
  readonly words: string;
  /** The heat it wants (°C), by its own physics. */
  readonly heat: (f: WayFacts) => number;
  /** Why that heat, in words. */
  readonly heatWhy: string;
  /** Principles it asks: each entry met by any of its "a|b". */
  readonly tools: readonly string[];
  /** Ways it builds on. */
  readonly after: readonly string[];
  /** What the world must hold (null: met). */
  readonly holds: (f: WayFacts) => string | null;
  /** How much of its finding is inquiry's (0 … 1) rather than the craft's, and its pace where all is met. */
  readonly depth: number;
  readonly rate: number;
};

/** Iron's α→γ change (°C) and the eutectoid's (Fe–C: 912 pure, 727 at 0.77% carbon), iron's melt (1538), the eutectic's (1147 at 4.3%). */
export const IRON_CARBON = {
  a3: 912,
  a1: 727,
  eutectoid: 0.77,
  melt: 1538,
  eutectic: 1147,
  eutecticC: 4.3,
} as const;

/** Where a steel of so much carbon (wt%) turns to austenite, so a quench can harden it (°C). */
export function austeniteC(wt: number): number {
  const ic = IRON_CARBON;
  return Math.round(wt >= ic.eutectoid ? ic.a1 : ic.a3 - (ic.a3 - ic.a1) * (wt / ic.eutectoid));
}

/** Where a steel of so much carbon runs liquid (°C): iron's melt falling to the eutectic. */
export function liquidusC(wt: number): number {
  const ic = IRON_CARBON;
  return Math.round(
    ic.melt - ((ic.melt - ic.eutectic) * Math.min(wt, ic.eutecticC)) / ic.eutecticC,
  );
}

/** A carbonate's breaking point (°C): where its ΔH is paid by TΔS (calcite: 178 kJ, 160.6 J/K a mole). */
export function calcineC(dhKj: number, dsJ: number): number {
  return Math.round((1000 * dhKj) / dsJ - 273.15);
}

/** Where a ceramic body sinters to a glassy whole (°C): this share of its refractory phase's melt in kelvin (Tammann). */
export function vitrifyC(meltC: number, share: number): number {
  return Math.round(share * (meltC + 273.15) - 273.15);
}

/** Mullite's melt (°C), the phase a fired clay body grows. */
export const MULLITE_MELT_C = 1840;

/** Where a C–C chain breaks under heat at a useful pace (°C): its bond (3.6 eV) over some 52 kT (est from cracking at 450–500 °C). */
export const CRACK_C = Math.round(3.6 / (52 * K_B) - 273.15);

const any = (f: WayFacts, entry: string) => entry.split("|").some((p) => f.knows(p));
const DYNAMO = "electricity|sea-electricity|graphite-dynamos|ground-dynamos|polymer-wire";
/** The alloying atoms an arc's steel may take, the strengthening each brings for its least share (ppm wanted in the crust). */
export const ALLOYING: readonly (readonly [string, number])[] = [
  ["Ni", 20],
  ["V", 50],
  ["W", 1],
  ["Nb", 5],
  ["Ti", 1000],
];

/** The ways, in the order a land is offered them. */
export const MATERIAL_WAYS: readonly MaterialWay[] = [
  {
    id: "quench-hardening",
    name: "quench-hardened edges",
    cls: "treatment",
    words: "hardened iron edges: keen, and brittle until tempered",
    heat: () => austeniteC(MATERIAL_LAWS.forgeCarbon),
    heatWhy: "where a forged edge's carbon dissolves in its iron",
    tools: ["iron"],
    after: [],
    holds: () => null,
    depth: 0.1,
    rate: 0.03,
  },
  {
    id: "tempering",
    name: "tempered edges",
    cls: "treatment",
    words: "hardened edges eased: nearly as keen, and they bear a blow",
    heat: () => Math.round(0.32 * ATOMS.Fe!.meltK - 273.15),
    heatWhy: "a third of iron's melt, where the locked carbon begins to move",
    tools: ["iron"],
    after: ["quench-hardening"],
    holds: () => null,
    depth: 0.15,
    rate: 0.03,
  },
  {
    id: "crucible-steel",
    name: "crucible steel",
    cls: "alloy",
    words: "steel even in its carbon all through: the best of edges",
    heat: () => liquidusC(1.5),
    heatWhy: "where steel of a sixtieth carbon runs liquid",
    tools: ["iron"],
    after: ["tempering"],
    holds: () => null,
    depth: 0.2,
    rate: 0.02,
  },
  {
    id: "alloy-steel",
    name: "alloy steel",
    cls: "alloy",
    words: "steel with a little of a harder metal in it: stronger, tougher, and it hardens through",
    heat: () => IRON_CARBON.melt + 100,
    heatWhy: "past iron's melt, where another metal dissolves in it",
    tools: ["steel", DYNAMO],
    after: [],
    holds: (f) =>
      ALLOYING.some(([e, ppm]) => f.ppm(e) >= ppm)
        ? null
        : "no metal to alloy steel with in its crust",
    depth: 0.4,
    rate: 0.02,
  },
  {
    id: "light-alloy",
    name: "light alloys",
    cls: "alloy",
    words:
      "aluminium freed by current and alloyed: a third of steel's weight for much of its strength",
    heat: () => Math.round(ATOMS.Al!.meltK - 273.15 + 300),
    heatWhy: "a bath of molten salt above aluminium's melt",
    tools: [DYNAMO],
    after: [],
    holds: (f) => (f.ppm("Al") >= 10000 ? null : "too little aluminium in its crust"),
    depth: 0.5,
    rate: 0.015,
  },
  {
    id: "brass",
    name: "brass",
    cls: "alloy",
    words: "copper with zinc taken into it: gold-coloured, and it rings",
    heat: () => 907,
    heatWhy: "where zinc boils off its ore into the copper",
    tools: ["bronze|metalworking"],
    after: [],
    holds: (f) => (f.ppm("Zn") >= 20 ? null : "too little zinc in its crust"),
    depth: 0.1,
    rate: 0.01,
  },
  {
    id: "stoneware",
    name: "stoneware",
    cls: "ceramic",
    words: "clay fired until it closes into stone: holds water unglazed, and acid",
    heat: () => vitrifyC(MULLITE_MELT_C, 0.69),
    heatWhy: "some two thirds of mullite's melt, where a clay body runs together",
    tools: ["pottery"],
    after: [],
    holds: (f) =>
      f.rock("kaolinite") && f.rock("feldspar") ? null : "no clay and feldspar in its rock",
    depth: 0.1,
    rate: 0.02,
  },
  {
    id: "porcelain",
    name: "porcelain",
    cls: "ceramic",
    words: "white clay and feldspar fired to glass through: thin, hard and bright",
    heat: () => vitrifyC(MULLITE_MELT_C, 0.75),
    heatWhy: "three quarters of mullite's melt",
    tools: ["pottery"],
    after: ["stoneware"],
    holds: (f) =>
      f.rock("kaolinite") && f.rock("feldspar") && f.rock("quartz")
        ? null
        : "no white clay, feldspar and quartz",
    depth: 0.2,
    rate: 0.01,
  },
  {
    id: "lime-mortar",
    name: "lime mortar",
    cls: "binder",
    words: "burnt lime that sets back to stone in the air: walls of laid stone that hold",
    heat: () => calcineC(178.3, 160.6),
    heatWhy: "where calcite gives up its carbon dioxide",
    tools: ["pottery|masonry"],
    after: [],
    holds: (f) => (f.rock("calcite") || f.rock("dolomite") ? null : "no limestone in its rock"),
    depth: 0.05,
    rate: 0.03,
  },
  {
    id: "hydraulic-cement",
    name: "cement",
    cls: "binder",
    words: "a lime that sets under water: harbours, cisterns, domes",
    heat: (f) => (f.rock("obsidian") || f.rock("tachylite") ? calcineC(178.3, 160.6) : 1450),
    heatWhy: "lime with volcanic ash at lime's heat; else lime and clay burnt to clinker",
    tools: ["masonry"],
    after: ["lime-mortar"],
    holds: (f) =>
      f.rock("kaolinite") || f.rock("obsidian") || f.rock("tachylite") ? null : "no clay or ash",
    depth: 0.2,
    rate: 0.015,
  },
  {
    id: "concrete",
    name: "concrete",
    cls: "binder",
    words: "cement and gravel poured as one stone: walls, piers and roads cast whole",
    heat: () => 0,
    heatWhy: "it sets cold",
    tools: ["masonry"],
    after: ["hydraulic-cement"],
    holds: () => null,
    depth: 0.1,
    rate: 0.03,
  },
  {
    id: "reinforced-concrete",
    name: "reinforced concrete",
    cls: "composite",
    words: "concrete with steel bars in it: stone that also bears a pull, so it stands in a quake",
    heat: () => 0,
    heatWhy: "it sets cold",
    tools: ["steel"],
    after: ["concrete"],
    holds: () => null,
    depth: 0.3,
    rate: 0.02,
  },
  {
    id: "made-polymer",
    name: "made polymers",
    cls: "polymer",
    words: "long chains of carbon made from coal, oil or haze: plastics, rubbers, resins",
    heat: () => CRACK_C,
    heatWhy: "where carbon chains break and join at a useful pace",
    tools: ["factories", DYNAMO],
    after: [],
    holds: (f) =>
      f.fuel || f.air("methane") || f.air("ethane")
        ? null
        : "no coal, oil or carbon haze to make them of",
    depth: 0.5,
    rate: 0.015,
  },
  {
    id: "glass-fibre",
    name: "glass fibre",
    cls: "composite",
    words: "glass drawn to threads and set in resin: light, strong, never rusting",
    heat: () => 1100,
    heatWhy: "a lime glass drawn at its working heat",
    tools: ["glass"],
    after: ["made-polymer"],
    holds: () => null,
    depth: 0.3,
    rate: 0.02,
  },
  {
    id: "pure-crystal",
    name: "pure crystal",
    cls: "crystal",
    words: "its switching crystal made clean to one foreign atom in thousands of millions",
    heat: (f) => (f.crystal ? Math.max(0, f.crystal.meltC) : 99999),
    heatWhy: "its crystal's own melt",
    tools: ["electronics"],
    after: [],
    holds: (f) => (f.crystal ? null : "no crystal here switches a current"),
    depth: 0.7,
    rate: 0.03,
  },
  {
    id: "lodestone",
    name: "lodestone",
    cls: "magnet",
    words: "the stone that draws iron and points one way: a needle that finds north",
    heat: () => 0,
    heatWhy: "found, not made",
    tools: ["metalworking"],
    after: [],
    holds: (f) => (f.rock("magnetite") ? null : "no lodestone in its rock"),
    depth: 0.3,
    rate: 0.01,
  },
  {
    id: "made-magnets",
    name: "made magnets",
    cls: "magnet",
    words:
      "iron alloyed with nickel and aluminium and set in a field: magnets a hundred times a lodestone's",
    heat: () => IRON_CARBON.melt + 100,
    heatWhy: "past iron's melt",
    tools: [DYNAMO],
    after: ["light-alloy"],
    holds: (f) => (f.ppm("Ni") >= 20 ? null : "too little nickel in its crust"),
    depth: 0.5,
    rate: 0.015,
  },
  {
    id: "lossless-wire",
    name: "lossless wire",
    cls: "lossless",
    words:
      "wire that carries current without loss when cold enough: the strongest magnets, the finest measures",
    heat: () => 700,
    heatWhy: "where its two metals grow into one crystal",
    tools: ["solid-state"],
    after: ["pure-crystal"],
    holds: (f) =>
      (f.ppm("Nb") >= 5 && f.ppm("Sn") >= 1) || (f.ppm("Mg") >= 1000 && f.ppm("B") >= 5)
        ? null
        : "no niobium and tin, nor magnesium and boron",
    depth: 0.8,
    rate: 0.01,
  },
];

/** Each way's place (its bit in a land's row). */
export const WAY_INDEX: ReadonlyMap<string, number> = new Map(
  MATERIAL_WAYS.map((w, i) => [w.id, i]),
);

/** Whether a way is open to a land: its tools known, what it builds on made, its world holding what it asks, its heat reached. */
export function wayOpen(
  w: MaterialWay,
  f: WayFacts,
): { readonly open: boolean; readonly shut: string | null } {
  for (const t of w.tools) if (!any(f, t)) return { open: false, shut: `wants ${t.split("|")[0]}` };
  for (const a of w.after)
    if (!f.made(a)) return { open: false, shut: `wants ${wayById(a)?.name ?? a}` };
  const held = w.holds(f);
  if (held) return { open: false, shut: held };
  const heat = w.heat(f);
  if (heat > f.heat)
    return { open: false, shut: `wants ${heat} °C; its fire reaches ${Math.round(f.heat)}` };
  return { open: true, shut: null };
}

export const wayById = (id: string): MaterialWay | undefined =>
  MATERIAL_WAYS.find((w) => w.id === id);

/**
 * The purest a land can make (nines) by the methods it knows: a smelt's slag takes two decades of what is foreign, current
 * two more, distillation of what an industry makes three more, melting zone by zone five more (each pass leaves a
 * thousandth of most foreign atoms behind: germanium has been made clean to thirteen nines).
 */
export function purityCeiling(knows: (p: string) => boolean, made: (w: string) => boolean): number {
  if (made("pure-crystal")) return 12;
  if (made("made-polymer")) return 7;
  if (knows("electrochemistry") || knows("refined-metals")) return 4;
  if (knows("metalworking")) return 2;
  return 0;
}

/** Of the gap to its ceiling, the share a land's practice closes a year, by its inquiry (rules/letters.ts inquiryOf: 1 for one reader). */
export const PURITY_PACE = 0.04;

/** The principles a land can take up only once its stuffs meet them: a switch of crystal wants the crystal pure. */
export const ASKS_PURITY: ReadonlySet<string> = new Set(["solid-state"]);

// —— What a land's ways give its arms ————————————————————————————————————————————————————————————————————————

/** The best working a land's ways give a metal kit's role: iron and steel by their treatments and alloys; null: as the tables have it. */
export function treatedRecipe(role: string, made: (w: string) => boolean): MetalRecipe | null {
  if (role === "steel") {
    if (made("alloy-steel"))
      return { formula: { Fe: 0.94, C: 0.045, Ni: 0.015 }, worked: "tempered" };
    if (made("crucible-steel")) return { formula: { Fe: 0.935, C: 0.065 }, worked: "tempered" };
    return null;
  }
  if (role === "iron") {
    if (made("tempering")) return { subst: "iron", worked: "tempered" };
    if (made("quench-hardening")) return { subst: "iron", worked: "quenched" };
    return null;
  }
  return null;
}

// —— Smelting heats from the oxides' own free energies (Ellingham) ——————————————————————————————

/**
 * Each metal's last oxide to give up its oxygen, as its line on Ellingham's chart: ΔG° = ΔH − TΔS for so much metal
 * taking one mole of O₂ (kJ, and kJ a kelvin). Thermochemistry, the same on every world of our laws.
 */
export const OXIDE_LINES: Readonly<
  Record<string, { readonly oxide: string; readonly dH: number; readonly dS: number }>
> = {
  Cu: { oxide: "Cu₂O", dH: -338, dS: -0.144 },
  Sn: { oxide: "SnO₂", dH: -581, dS: -0.204 },
  Fe: { oxide: "FeO", dH: -528, dS: -0.13 },
  Zn: { oxide: "ZnO", dH: -701, dS: -0.201 },
  Ni: { oxide: "NiO", dH: -479, dS: -0.172 },
  As: { oxide: "As₂O₃", dH: -438, dS: -0.18 },
  Pb: { oxide: "PbO", dH: -438, dS: -0.2 },
  Si: { oxide: "SiO₂", dH: -911, dS: -0.182 },
  Ti: { oxide: "TiO₂", dH: -944, dS: -0.185 },
  Al: { oxide: "Al₂O₃", dH: -1117, dS: -0.209 },
  Mg: { oxide: "MgO", dH: -1203, dS: -0.217 },
  Cr: { oxide: "Cr₂O₃", dH: -753, dS: -0.17 },
  W: { oxide: "WO₃", dH: -561, dS: -0.18 },
};

/** What takes an oxide's oxygen, as its own line for one mole of O₂: carbon burning to CO (charcoal, coke), hydrogen to steam. */
export const REDUCERS = {
  // (2C + O₂ → 2CO: the one line that falls as it heats, so carbon in the end takes nearly every oxide's oxygen.)
  carbon: { dH: -221, dS: 0.179, words: "charcoal or coke" },
  hydrogen: { dH: -484, dS: -0.089, words: "hydrogen" },
} as const;
export type Reducer = keyof typeof REDUCERS;

/** The free energy a smelt must have to spare to go at a useful pace (kJ a mole of O₂, est). */
export const SMELT_SPARE = 20;
/** Where a slag of iron oxide and silica runs (the FeO–SiO₂ eutectic, °C): what a bloom or a matte is freed from. */
export const SLAG_C = 1177;

/** Where a reducer takes a metal's oxygen (°C; 0 where it does at any heat, null where it never does). */
export function reductionC(metal: string, by: Reducer): number | null {
  const ox = OXIDE_LINES[metal];
  if (!ox) return null;
  const r = REDUCERS[by],
    // (ΔG = (Hr − Hox + spare) − T (Sr − Sox) ≤ 0.)
    h = r.dH - ox.dH + SMELT_SPARE,
    s = r.dS - ox.dS;
  if (h <= 0) return s >= 0 ? 0 : Math.max(0, Math.round(h / s - 273.15));
  if (s <= 0) return null;
  return Math.max(0, Math.round(h / s - 273.15));
}

/** A smelt as the heat reads it: its metal, its ore, whether the ore's sulphur takes its own oxygen, whether a slag must run. */
export type SmeltRead = {
  readonly metal: string;
  readonly ore: string;
  readonly self: boolean;
  readonly slag: boolean;
};

type Reacting = {
  readonly inputs: readonly (readonly [string, number])[];
  readonly outputs: readonly (readonly [string, number])[];
};

/** What a reaction smelts, where it frees a pure metal from a compound of it (not a sulphate's, not an alloy's). */
export function smeltOf(r: Reacting): SmeltRead | null {
  const out = r.outputs
    .map(([id]) => findSubstance(id))
    .find(
      (s) => s && Object.keys(s.formula).length === 1 && ATOMS[Object.keys(s.formula)[0]!]?.metal,
    );
  if (!out) return null;
  const metal = Object.keys(out.formula)[0]!,
    ore = r.inputs
      .map(([id]) => findSubstance(id))
      .find((s) => s && s.formula[metal] !== undefined && Object.keys(s.formula).length > 1);
  if (!ore) return null;
  const f = ore.formula,
    sulphate = (f.S ?? 0) > 0 && (f.O ?? 0) >= 4 * (f.S ?? 0);
  if (sulphate || metalMake(f)) return null;
  return {
    metal,
    ore: ore.id,
    self: (f.S ?? 0) > 0 && r.inputs.some(([id]) => id === "oxygen"),
    slag: (metal !== "Fe" && (f.Fe ?? 0) > 0) || (f.Si ?? 0) > 0,
  };
}

/**
 * The heat a smelt wants (°C), from its oxide's free energy against its reducer's and from what must run: the heat where
 * the reducer takes the metal's oxygen with some to spare (a sulphide roasted burns its own sulphur, and wants none); the
 * heat where the metal is gathered (run out as a liquid where it melts below the slag, freed as a bloom from a running
 * slag where it melts above it); and a slag must run wherever the ore carries iron or silica to be rid of. A Creator's
 * binding (rules/laws.ts) moves every heat with it, in kelvin. Null for what is not a smelt, or a smelt nothing it has
 * reduces.
 */
export function smeltHeat(
  r: Reacting,
  reducers: readonly Reducer[] = ["carbon"],
  binding = 1,
): number | null {
  const s = smeltOf(r);
  if (!s || !OXIDE_LINES[s.metal]) return null;
  let reduce: number | null = s.self ? 0 : null;
  if (!s.self)
    for (const by of reducers) {
      const t = reductionC(s.metal, by);
      if (t !== null && (reduce === null || t < reduce)) reduce = t;
    }
  if (reduce === null) return null;
  const meltC = ATOMS[s.metal]!.meltK - 273.15,
    heat = Math.max(reduce, Math.min(meltC, SLAG_C), s.slag ? SLAG_C : 0);
  return Math.round((heat + 273.15) * binding - 273.15);
}

// —— Furnace linings ————————————————————————————————————————————————————————————————————————————

/**
 * What a furnace may be walled with, from what a world's rock holds: each the substances it is dug as, the refractory it
 * fires to and that refractory's melt (°C): graphite and carbide on a carbon world, magnesia from what holds magnesium,
 * alumina from corundum, mullite from clay, silica brick from quartz.
 */
export const LININGS: readonly {
  readonly from: readonly string[];
  readonly name: string;
  readonly meltC: number;
}[] = [
  { from: ["graphite"], name: "graphite", meltC: 3650 },
  { from: ["moissanite"], name: "carbide brick", meltC: 2730 },
  { from: ["dolomite", "olivine", "magnesite"], name: "magnesia brick", meltC: 2852 },
  { from: ["corundum"], name: "alumina brick", meltC: 2072 },
  { from: ["kaolinite", "clay"], name: "fireclay", meltC: MULLITE_MELT_C },
  { from: ["quartz"], name: "silica brick", meltC: 1713 },
];
/** The bare stone a furnace is walled with where its rock gives no refractory (a basalt melts near 1,200 °C). */
export const BARE_LINING = { name: "bare stone", meltC: 1200 } as const;
/** A lining serves to this share of its melt, in kelvin, before it slumps (est: a firebrick softens some 5% below it). */
export const LINING_SERVES = 0.95;

/**
 * The hottest a lined furnace holds (°C): the best lining its world's rock gives, to the share of its melt it serves. A
 * blown fire, a bloomery and a blast furnace are held to it; an arc's heat is in its arc, against cooled walls.
 */
export function liningOf(
  holds: (subst: string) => boolean,
  binding = 1,
): { readonly name: string; readonly meltC: number; readonly holdsC: number } {
  let best: { readonly name: string; readonly meltC: number } = BARE_LINING;
  for (const l of LININGS) if (l.meltC > best.meltC && l.from.some(holds)) best = l;
  const meltC = Math.round((best.meltC + 273.15) * binding - 273.15);
  return {
    name: best.name,
    meltC,
    holdsC: Math.round(LINING_SERVES * (meltC + 273.15) - 273.15),
  };
}

// —— Stones' edges ——————————————————————————————————————————————————————————————————————————————

/**
 * How a stone breaks, coarsely: as glass; as flint, the finest and purest of the silica that grows in grains too small to
 * see; as chert, the same with clay and carbon in it; as one crystal along its own planes; conchoidally though a crystal (a
 * carbide's, a diamond's); felted, its fibres matted (jade's); or along its grains.
 */
export type Fracture =
  "glassy" | "flinty" | "cherty" | "crystal" | "conchoidal" | "felted" | "grainy";

/**
 * What each fracture does to an edge: its sharpness against the hardness (a glass's edge is a molecule wide, a grainy one a
 * grain wide: est) and its toughness (MPa √m: glass 0.75; flint 1.6 and chert 1.7; quartz across its crystal 1.1, a hard
 * crystal's flaking edge 1.15; jade's felted fibres 8; a rock whose cracks turn at each grain 3.1).
 */
export const FRACTURES: Readonly<
  Record<Fracture, { readonly sharp: number; readonly k1c: number }>
> = {
  glassy: { sharp: 1.37, k1c: 0.75 },
  flinty: { sharp: 0.89, k1c: 1.6 },
  cherty: { sharp: 0.8, k1c: 1.7 },
  crystal: { sharp: 0.5, k1c: 1.1 },
  conchoidal: { sharp: 0.64, k1c: 1.15 },
  felted: { sharp: 0.58, k1c: 8 },
  grainy: { sharp: 0.55, k1c: 3.1 },
};

/** How each stone of the tables breaks, by its name (what it is, not where it is from). */
export const STONE_FRACTURE: Readonly<Record<string, Fracture>> = {
  obsidian: "glassy",
  tachylite: "glassy",
  flint: "flinty",
  novaculite: "flinty",
  chert: "cherty",
  lydite: "cherty",
  quartz: "crystal",
  corundum: "crystal",
  moissanite: "conchoidal",
  diamond: "conchoidal",
  nephrite: "felted",
  basalt: "grainy",
  tholeiite: "grainy",
  picrite: "grainy",
  quartzite: "grainy",
  greywacke: "grainy",
  fieldstone: "grainy",
};

/**
 * A stone's scratch hardness where it is a rock and not one substance: a fine igneous rock's feldspar and pyroxene (6), and
 * whatever cobble a field turns up, softer stone among the hard (est: 5).
 */
export const ROCK_MOHS = 6,
  COBBLE_MOHS = 5;
/** The toughness an edge's scale runs over (MPa √m): from under a glass's to a grainy rock's and past. */
const EDGE_K_LEAST = 0.5,
  EDGE_K_SPAN = 7.6;

/**
 * A stone's edge, coarsely: its keenness from its hardness (its substance's Mohs against quartz's 7, to the 1.3th power) by
 * its fracture's sharpness; its toughness from its fracture's, on a log scale. No texture is read.
 */
export function stoneEdge(
  name: string,
  subst: string | null,
): { readonly keen: number; readonly tough: number } {
  const f = FRACTURES[STONE_FRACTURE[name] ?? (subst ? "crystal" : "grainy")],
    mohs =
      (subst ? findSubstance(subst)?.hardness : null) ??
      (name === "fieldstone" ? COBBLE_MOHS : ROCK_MOHS),
    keen = clamp01(f.sharp * dmath.pow(mohs / 7, 1.3)),
    tough = clamp01(dmath.log(f.k1c / EDGE_K_LEAST) / dmath.log(EDGE_K_SPAN));
  return { keen: Math.round(100 * keen) / 100, tough: Math.round(100 * tough) / 100 };
}

// —— Frames that fly and climb ——————————————————————————————————————————————————————————————————

/** A stuff a frame is made of: its stiffness (GPa), strength (MPa) and weight (kg/m³). */
export type FrameStuff = {
  readonly id: string;
  readonly e: number;
  readonly strength: number;
  readonly density: number;
};

/** Glass drawn to a fibre, its flaws no wider than a tenth of a micrometre: Griffith's strength K/√(πa) (MPa). */
export const fibreStrength = (k1c: number, flawM = 1e-7): number =>
  k1c / dmath.sqrt(Math.PI * flawM);

/**
 * The frame stuffs a land may build in: steel (its figures, read), the light alloy of aluminium and magnesium hammered,
 * and glass fibre half in resin (glass 72 GPa, K 0.75; resin 3 GPa, 60 MPa: est).
 */
export function frameStuffs(binding = 1): Readonly<Record<string, FrameStuff>> {
  const steel = metalFigures({ Fe: 0.9551, C: 0.0449 }, "annealed", 288, { binding })!,
    alloy = metalFigures({ Al: 0.95, Mg: 0.05 }, "hammered", 288, { binding })!,
    fibre = fibreStrength(0.75) * binding;
  return {
    steel: { id: "steel", e: steel.stiffness, strength: steel.strength, density: steel.density },
    "light-alloy": {
      id: "light-alloy",
      e: alloy.stiffness,
      strength: alloy.strength,
      density: alloy.density,
    },
    "glass-fibre": {
      id: "glass-fibre",
      e: 0.5 * 72 * binding + 0.5 * 3,
      strength: 0.5 * fibre + 0.5 * 60,
      density: 1850,
    },
  };
}

/** A thin wall that must not buckle (a tank, a skin): its stiffness to the third over its weight (Ashby's panel index). */
export const panelIndex = (f: FrameStuff): number => dmath.pow(f.e, 1 / 3) / (f.density / 1000);
/** A spar that must not break: its strength to the two thirds over its weight (Ashby's beam index). */
export const beamIndex = (f: FrameStuff): number =>
  dmath.pow(f.strength, 2 / 3) / (f.density / 1000);

/** What of a rocket stage is its engines and fittings whatever its walls (est), and a steel stage's whole dry share. */
export const STAGE_FITTINGS = 0.04,
  STEEL_STAGE_DRY = 0.13;

/** A stage's dry share walled in a stuff: its fittings, and its walls as much lighter than steel's as its panel index is higher. */
export function stageDry(stuff: string, binding = 1): number {
  // (The same for a stuff and a binding always: kept once worked out, a realm's launcher asks it every year.)
  const key = `${stuff}|${binding}`,
    had = STAGE_DRY.get(key);
  if (had !== undefined) return had;
  const dry = stageDryOf(stuff, binding);
  if (STAGE_DRY.size < 64) STAGE_DRY.set(key, dry);
  return dry;
}
const STAGE_DRY = new Map<string, number>();
function stageDryOf(stuff: string, binding: number): number {
  const t = frameStuffs(binding),
    f = t[stuff] ?? t.steel!,
    walls = (STEEL_STAGE_DRY - STAGE_FITTINGS) * (panelIndex(t.steel!) / panelIndex(f));
  return Math.round(1000 * (STAGE_FITTINGS + walls)) / 1000;
}

/** A flying machine's frame share in a stuff, against the steel-tube frame its figures are reckoned for; never below a fifth. */
export function flyerFrame(share: number, stuff: string | null): number {
  if (!stuff) return share;
  const t = frameStuffs(),
    f = t[stuff];
  if (!f) return share;
  return Math.max(0.2, Math.min(share, share * (beamIndex(t.steel!) / beamIndex(f))));
}
