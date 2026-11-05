// What matter can do (Phase 65, asked for 2026-11-03: "get down to first principles of many things so
// the alien worlds happen and ... the ages past the ages humans experienced can still emerge ... with
// logic there for it to emerge if present for that world"). Until now a substance knew its density,
// melting point and hardness. Here it also knows what later steps ask of it, in real figures: how
// strong it is drawn out, how well it carries a current, how wide its band gap, how cold it must be to
// carry current without loss. And a step asks for a function, not a principle: "carry a current" is
// met by whatever a world's own crust holds that conducts; "switch a current" by whatever holds a gap
// a current can be made to jump. Each world's crust is its own (rules/crust.ts), so one world's way to
// a function is not another's, and some worlds' matter does not meet it at all. What is asked only by
// ages past ours (Phase 66: rules/principles.ts, its last) is met here or never found. Pure tables and
// functions.
import { crustMultiplier, crustOf } from "./crust.ts";
import type { Chemistry } from "./chemistry.ts";
import { KINDS, type WorldKind } from "./kinds.ts";
import { findSubstance, knowLaterSubstances, type Substance } from "./matter.ts";

/** What a substance can do, beyond what it weighs and where it melts. */
export type Properties = {
  /** Tensile strength as it would be used (MPa). */
  readonly strength?: number;
  /** Electrical conductivity near 20 °C (million siemens a metre). */
  readonly conductivity?: number;
  /** Band gap (electronvolts): how far a charge must be lifted before it can move. */
  readonly bandGap?: number;
  /** The temperature below which it carries current without loss (kelvin). */
  readonly superconductsK?: number;
  /** Where it is said to come apart in fire, where it has no melting point of its own (°C). */
  readonly sublimes?: number;
};

/** Handbook figures, for the form each is worked in (an alloy's typical grade, a wire, a crystal). */
export const PROPERTIES: Readonly<Record<string, Properties>> = {
  copper: { strength: 210, conductivity: 59.6 },
  "native-copper": { strength: 210, conductivity: 58 },
  tin: { strength: 15, conductivity: 9.1 },
  bronze: { strength: 300, conductivity: 7.4 },
  "arsenical-copper": { strength: 280, conductivity: 12 },
  cupronickel: { strength: 340, conductivity: 4.4 },
  iron: { strength: 370, conductivity: 10 },
  "telluric-iron": { strength: 300, conductivity: 7 },
  "cohenite-iron": { strength: 400, conductivity: 3 },
  steel: { strength: 800, conductivity: 6 },
  gold: { strength: 130, conductivity: 45 },
  zinc: { strength: 110, conductivity: 17 },
  brass: { strength: 340, conductivity: 16 },
  nickel: { strength: 460, conductivity: 14 },
  graphite: { strength: 30, conductivity: 0.2, sublimes: 3650 },
  moissanite: { strength: 400, bandGap: 3.26, sublimes: 2700 },
  diamond: { strength: 2800, bandGap: 5.47 },
  corundum: { strength: 400, bandGap: 8.8 },
  quartz: { strength: 50, bandGap: 8.9 },
  glass: { strength: 50, bandGap: 9 },
  flint: { strength: 50, bandGap: 8.9 },
  chert: { strength: 50, bandGap: 8.9 },
  obsidian: { strength: 40 },
  "fired-clay": { strength: 10 },
  "water-ice": { strength: 5, bandGap: 7.6 },
  tholin: { bandGap: 2.2 },
  polyacetylene: { strength: 150, conductivity: 1, bandGap: 1.5 },
  chalcocite: { bandGap: 1.2, conductivity: 0.001 },
  pyrite: { bandGap: 0.95 },
  sphalerite: { bandGap: 3.54 },
  "zinc-oxide": { bandGap: 3.37 },
  magnetite: { conductivity: 0.025 },
  hematite: { bandGap: 2.1 },
  sulphur: { bandGap: 2.6 },
  silicon: { strength: 120, bandGap: 1.12 },
  germanium: { strength: 100, bandGap: 0.67 },
  "gallium-arsenide": { strength: 85, bandGap: 1.42 },
  cuprite: { bandGap: 2.1 },
  aluminium: { strength: 300, conductivity: 37.7 },
  titanium: { strength: 900, conductivity: 2.4 },
  tungsten: { strength: 1000, conductivity: 18 },
  "niobium-tin": { conductivity: 5, superconductsK: 18 },
  "magnesium-diboride": { conductivity: 3, superconductsK: 39 },
  "carbon-weave": { strength: 5000, conductivity: 0.07, sublimes: 3650 },
};

const later = (
  id: string,
  name: string,
  written: string,
  formula: Record<string, number>,
  kind: Substance["kind"],
  density: number,
  melts: number | null,
  hardness: number | null,
  colour: [number, number, number],
  words: string,
): Substance => ({
  id,
  name,
  written,
  formula,
  kind,
  phase: "solid",
  density,
  melts,
  hardness,
  colour,
  words,
});

/**
 * Stuffs what later steps ask for (no world's people has made these yet; a world's crust may hold what
 * they would be made of). Beside Earth's and the kinds' own, so every list of those stays what it was.
 */
export const LATER_SUBSTANCES: readonly Substance[] = [
  later(
    "silicon",
    "silicon",
    "Si",
    { Si: 1 },
    "made",
    2329,
    1414,
    6.5,
    [0.45, 0.45, 0.52],
    "A dark crystal won from quartz or carbide at some 1,900 °C and refined far past anything a furnace alone can do; its band gap suits it to switching a current.",
  ),
  later(
    "germanium",
    "germanium",
    "Ge",
    { Ge: 1 },
    "made",
    5323,
    938,
    6,
    [0.6, 0.6, 0.62],
    "A rare grey crystal, scarcer than tin, that switches a current at a lower heat than silicon and holds it less well when warm.",
  ),
  later(
    "gallium-arsenide",
    "gallium arsenide",
    "GaAs",
    { Ga: 1, As: 1 },
    "made",
    5316,
    1238,
    4.5,
    [0.4, 0.42, 0.46],
    "A crystal of a rare metal and arsenic, faster than silicon and turning a current into light.",
  ),
  later(
    "cuprite",
    "cuprite",
    "Cu₂O",
    { Cu: 2, O: 1 },
    "ore",
    6000,
    1235,
    3.5,
    [0.6, 0.12, 0.1],
    "Red copper oxide, whose skin on copper lets a current pass one way: the first rectifiers were made of it.",
  ),
  later(
    "aluminium",
    "aluminium",
    "Al",
    { Al: 1 },
    "metal",
    2700,
    660,
    2.75,
    [0.82, 0.83, 0.85],
    "The crust's commonest metal, locked so fast to oxygen that only a great current frees it: light, and strong when alloyed.",
  ),
  later(
    "titanium",
    "titanium",
    "Ti",
    { Ti: 1 },
    "metal",
    4506,
    1668,
    6,
    [0.7, 0.7, 0.72],
    "A light metal as strong as steel that holds its strength when hot, and is hard to win.",
  ),
  later(
    "tungsten",
    "tungsten",
    "W",
    { W: 1 },
    "metal",
    19300,
    3422,
    7.5,
    [0.55, 0.56, 0.58],
    "The metal that melts hottest of all: what a flame hotter than a furnace would be walled with.",
  ),
  later(
    "niobium-tin",
    "niobium-tin",
    "Nb₃Sn",
    { Nb: 3, Sn: 1 },
    "made",
    8900,
    2130,
    null,
    [0.5, 0.5, 0.55],
    "A brittle alloy that carries current without loss below eighteen degrees above the coldest there is, in the strongest fields.",
  ),
  later(
    "magnesium-diboride",
    "magnesium diboride",
    "MgB₂",
    { Mg: 1, B: 2 },
    "made",
    2570,
    830,
    null,
    [0.25, 0.25, 0.28],
    "A cheap black salt-like solid that carries current without loss below 39 kelvin.",
  ),
  later(
    "carbon-weave",
    "woven carbon",
    "C",
    { C: 1 },
    "made",
    1800,
    null,
    null,
    [0.12, 0.12, 0.14],
    "Carbon drawn into threads finer than a hair and woven: stronger than any metal for its weight, and what a tower of many kilometres is hung from.",
  ),
];

knowLaterSubstances(LATER_SUBSTANCES);

/** The elements only those stuffs hold: Earth's crust (ppm: Rudnick & Gao 2003), never in its table. */
export const LATER_CRUST: Readonly<Record<string, number>> = {
  Ge: 1.4,
  Ga: 17.5,
  W: 1.9,
  Nb: 12,
  B: 17,
};

/** What a substance can do, where it is known. */
export function propertiesOf(id: string): Properties | undefined {
  return PROPERTIES[id];
}

/** A substance's name (a later stuff's or any other's). */
function nameOf(id: string): string {
  return findSubstance(id)?.name ?? id;
}

/**
 * A world as its matter is asked of: its chemistry, its kind, its warmth (true °C), its pull, the other
 * bodies its system holds, how long its star has left, whether anything lives on it, and whether its
 * peoples could come to a thing (the reading: host/can.ts; those measured: what they know now).
 */
export type MatterWorld = {
  readonly chem: Chemistry;
  readonly kind: WorldKind;
  readonly celsius: number;
  readonly gravity: number;
  /** Bodies of its system with ground to dig (its moons, its small rocky neighbours). */
  readonly rockBodies: number;
  readonly giants: number;
  /** Billions of years its star has left. */
  readonly starLeftGyr: number;
  readonly peopled: boolean;
};

/** Parts a million of an element in a world's crust (a later stuff's: Earth's, moved as its heavies are). */
export function crustPpm(chem: Chemistry, symbol: string): number {
  if (Object.hasOwn(LATER_CRUST, symbol)) {
    // (Boron, germanium, gallium, niobium and tungsten follow the star's metals as tin does.)
    return LATER_CRUST[symbol]! * crustMultiplier(chem, "Sb");
  }
  for (const r of crustOf(chem)) if (r.symbol === symbol) return r.ppm;
  return 0;
}

/** Whether a world's rock lies within reach: an ice world's lies under its ice, out of any mine's reach. */
export function rockUnderfoot(kind: WorldKind): boolean {
  return kind !== "ammonia" && kind !== "methane";
}

/** A stuff that might meet a function, and what it takes. */
type Stuff = {
  readonly subst: string;
  /** Least parts a million of each element to make it in the amount asked. */
  readonly needs: Readonly<Record<string, number>>;
  /** Only on these kinds' worlds (haze, carbide: what their air or bedrock is). */
  readonly kinds?: readonly WorldKind[];
  /** Whether it is won from rock (no rock underfoot: only with bodies to mine). */
  readonly rock?: boolean;
  /** Whether what falls from the sky is enough (iron for wire, stones for a few valves). */
  readonly fallen?: boolean;
  /** What it does here, and how well. */
  readonly words?: (w: MatterWorld) => string;
};

/** Whether a world's matter meets all a principle asks of it, and what shuts it if not. */
export function matterShuts(
  p: { readonly asks?: readonly string[] },
  functions: readonly FunctionReading[],
): FunctionReading | null {
  for (const id of p.asks ?? []) {
    const f = functions.find((x) => x.id === id);
    if (f && !f.met) return f;
  }
  return null;
}

/** What a function's asking comes to on a world. */
export type FunctionReading = {
  readonly id: string;
  readonly icon: string;
  /** "switch a current" */
  readonly name: string;
  /** What it asks, in physics. */
  readonly asks: string;
  /** Asked only by ages past ours. */
  readonly later: boolean;
  readonly met: boolean;
  /** What meets it, in a few words with its figures (null: nothing here). */
  readonly by: string | null;
  /** The substance that meets it, for its page. */
  readonly subst: string | null;
  /** Why it is met or is not, in a sentence. */
  readonly why: string;
};

const thousands = (n: number) => `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const ppmWords = (ppm: number): string =>
  ppm >= 10000
    ? `${Math.round(ppm / 1000) / 10}% of its crust`
    : ppm >= 10
      ? `${thousands(ppm)} parts a million of its crust`
      : `${Math.round(ppm * 10) / 10} parts a million of its crust`;

/** How a stuff stands on a world: whether it can be had, and what limits it. */
function stuffStands(s: Stuff, w: MatterWorld): { ok: boolean; because: string; ppm: number } {
  if (s.kinds && !s.kinds.includes(w.kind))
    return { ok: false, because: `not on ${KINDS[w.kind].name}`, ppm: 0 };
  const needs = Object.entries(s.needs);
  let leastPpm = Infinity;
  for (const [el, want] of needs) {
    const ppm = crustPpm(w.chem, el);
    leastPpm = Math.min(leastPpm, ppm);
    if (ppm < want)
      return {
        ok: false,
        because: `its crust holds ${Math.round(ppm * 10) / 10} parts a million of ${el}; it would take ${want}`,
        ppm,
      };
  }
  if (s.rock && !rockUnderfoot(w.kind) && !s.fallen && w.rockBodies === 0)
    return {
      ok: false,
      because: "its rock lies under its ice, and its system has no ground to mine",
      ppm: leastPpm,
    };
  return { ok: true, because: "", ppm: needs.length ? leastPpm : 0 };
}

/** The ground it is won from, where that is not simply its crust. */
function whence(s: Stuff, w: MatterWorld, ppm: number): string {
  if (s.rock && !rockUnderfoot(w.kind))
    return s.fallen ? "what falls from the sky" : "the rock of its moons and neighbours";
  if (!Object.keys(s.needs).length) return KINDS[w.kind].air;
  return ppmWords(ppm);
}

/** A function met by the first of its stuffs that a world can have, best first. */
function byStuffs(
  base: Omit<FunctionReading, "met" | "by" | "subst" | "why">,
  stuffs: readonly Stuff[],
  w: MatterWorld,
  figure: (s: Stuff) => string,
): FunctionReading {
  const shut: string[] = [];
  for (const s of stuffs) {
    const stands = stuffStands(s, w);
    if (stands.ok) {
      const name = nameOf(s.subst),
        from = whence(s, w, stands.ppm),
        said = s.words?.(w);
      return {
        ...base,
        met: true,
        by: `${name}, ${figure(s)}`,
        subst: s.subst,
        why: `${name[0]!.toUpperCase()}${name.slice(1)} (${figure(s)}), from ${from}${said ? `: ${said}` : ""}.`,
      };
    }
    if (!s.kinds) shut.push(`${nameOf(s.subst)}: ${stands.because}`);
  }
  return {
    ...base,
    met: false,
    by: null,
    subst: null,
    why: `Nothing here meets it. ${shut.slice(0, 3).join("; ")}.`,
  };
}

const CONDUCTORS: readonly Stuff[] = [
  { subst: "copper", needs: { Cu: 5 }, rock: true },
  { subst: "aluminium", needs: { Al: 5000 }, rock: true },
  {
    subst: "polyacetylene",
    needs: {},
    kinds: ["methane", "carbon"],
    words: () => "a polymer of its haze, doped till it carries",
  },
  { subst: "iron", needs: {}, rock: true, fallen: true },
];

const SWITCHES: readonly Stuff[] = [
  { subst: "silicon", needs: { Si: 1000 }, rock: true },
  { subst: "gallium-arsenide", needs: { Ga: 5, As: 1 }, rock: true },
  { subst: "germanium", needs: { Ge: 0.5 }, rock: true },
  {
    subst: "polyacetylene",
    needs: {},
    kinds: ["methane", "carbon"],
    words: (w) =>
      w.celsius < -100 ? "slow in its cold, where charges barely move" : "slow, and cheap",
  },
  {
    subst: "moissanite",
    needs: { Si: 1000 },
    kinds: ["carbon"],
    words: () => "a wide gap: it switches at a red heat",
  },
  { subst: "cuprite", needs: { Cu: 5 }, rock: true },
  // (Where no rock can be dug: enough for a few crystals, from the stones that fall.)
  { subst: "silicon", needs: { Si: 1000 }, rock: true, fallen: true },
];

const MIND_STUFFS: readonly Stuff[] = [
  { subst: "silicon", needs: { Si: 10000 }, rock: true },
  { subst: "gallium-arsenide", needs: { Ga: 5, As: 1 }, rock: true },
  { subst: "germanium", needs: { Ge: 0.5 }, rock: true },
];

const WALLS: readonly Stuff[] = [
  { subst: "tungsten", needs: { W: 1 }, rock: true },
  { subst: "graphite", needs: { C: 300 }, rock: true },
  { subst: "moissanite", needs: { Si: 1000, C: 1000 }, kinds: ["carbon"] },
];

const MAGNETS: readonly Stuff[] = [
  { subst: "niobium-tin", needs: { Nb: 6, Sn: 0.5 }, rock: true },
  { subst: "magnesium-diboride", needs: { Mg: 5000, B: 10 }, rock: true },
];

const FIBRES: readonly Stuff[] = [
  { subst: "carbon-weave", needs: { C: 100 } },
  // (Where its crust is ice, or tar: carbon from its haze or its own black rock.)
  { subst: "carbon-weave", needs: {}, kinds: ["carbon", "methane"] },
];

const num = (x: number, digits = 2) => {
  const k = digits >= 2 ? 100 : 10;
  return `${Math.round(x * k) / k}`;
};

/** The strongest walling-stuff of a world for its own pull: how tall a tower it can stand. */
function towerKm(s: string, gravity: number): number {
  const p = PROPERTIES[s],
    d = findSubstance(s)?.density ?? 7800;
  return ((p?.strength ?? 0) * 1e6) / (d * 9.81 * gravity) / 1000;
}

/**
 * What a world's matter can and cannot do, function by function. Two are asked by steps of every age
 * since electricity (a current carried, a current switched); the rest only by ages past ours, and a
 * principle that asks one is never found where it is not met.
 */
export function readFunctions(w: MatterWorld): FunctionReading[] {
  const carry = byStuffs(
      {
        id: "carry-current",
        icon: "🔌",
        name: "carry a current",
        asks: "a wire that conducts at least a million siemens a metre",
        later: false,
      },
      CONDUCTORS,
      w,
      (s) => `${num(PROPERTIES[s.subst]!.conductivity!, 1)} MS/m`,
    ),
    swap = byStuffs(
      {
        id: "switch-current",
        icon: "🔀",
        name: "switch a current",
        asks: "a crystal or chain with a band gap of a third to three and a half electronvolts",
        later: false,
      },
      SWITCHES,
      w,
      (s) => `a band gap of ${num(PROPERTIES[s.subst]!.bandGap!)} eV`,
    ),
    mind = byStuffs(
      {
        id: "think-in-crystal",
        icon: "🧠",
        name: "think in crystal",
        asks: "a crystal of half to two electronvolts, won by the tonne: a mind's billions of switches",
        later: true,
      },
      MIND_STUFFS,
      w,
      (s) => `a band gap of ${num(PROPERTIES[s.subst]!.bandGap!)} eV`,
    ),
    wall = byStuffs(
      {
        id: "wall-a-flame",
        icon: "🧱",
        name: "wall a fusion flame",
        asks: "a wall that stands above 2,500 °C",
        later: true,
      },
      WALLS,
      w,
      (s) =>
        findSubstance(s.subst)?.melts
          ? `melting at ${thousands(findSubstance(s.subst)!.melts!)} °C`
          : `standing to ${thousands(PROPERTIES[s.subst]!.sublimes ?? 0)} °C`,
    ),
    magnet = byStuffs(
      {
        id: "hold-a-flame",
        icon: "🧲",
        name: "hold a fusion flame",
        asks: "a wire that carries current without loss, for a field no wall could stand",
        later: true,
      },
      MAGNETS,
      w,
      (s) => `lossless below ${PROPERTIES[s.subst]!.superconductsK} K`,
    ),
    fibre = byStuffs(
      {
        id: "draw-a-fibre",
        icon: "🧵",
        name: "draw a fibre",
        asks: "carbon by the tonne, drawn into threads in a furnace past 2,500 °C",
        later: true,
      },
      FIBRES,
      w,
      (s) => `${thousands(PROPERTIES[s.subst]!.strength!)} MPa`,
    ),
    // (A cold world keeps its magnets cold for less: its cold does part of the work.)
    frozen = w.celsius < -150;
  const lastGyr = w.starLeftGyr,
    towerStuff = rockUnderfoot(w.kind)
      ? "steel"
      : w.rockBodies > 0
        ? "steel"
        : w.kind === "methane" || w.kind === "ammonia"
          ? "water-ice"
          : "steel",
    tower = towerKm(towerStuff, w.gravity),
    laser =
      crustPpm(w.chem, "Cr") >= 20 && crustPpm(w.chem, "Al") >= 1000 && rockUnderfoot(w.kind)
        ? "ruby: corundum with a little chromium"
        : w.chem.redox === "oxidised" || w.kind === "carbon"
          ? "carbon gases in a tube"
          : w.rockBodies > 0
            ? "ruby, from the rock of its moons and neighbours"
            : null;
  return [
    carry,
    swap,
    mind,
    fibre,
    wall,
    frozen && magnet.met
      ? { ...magnet, why: `${magnet.why} Its own cold keeps them nearly cold enough for free.` }
      : magnet,
    {
      id: "gather-a-star",
      icon: "☀️",
      name: "gather a star's light",
      asks: "bodies to build mirrors from, and a star that will last",
      later: true,
      met: lastGyr >= 1 && w.rockBodies >= 2,
      by: lastGyr >= 1 && w.rockBodies >= 2 ? `${w.rockBodies} bodies to build from` : null,
      subst: null,
      why:
        lastGyr < 1
          ? `Its star has only ${num(lastGyr, 1)} billion years left.`
          : w.rockBodies >= 2
            ? `${w.rockBodies} rocky bodies to dismantle, and ${num(lastGyr, 1)} billion years of light.`
            : "Too little ground in its system to build so many mirrors from.",
    },
    {
      id: "beam-a-light",
      icon: "🔦",
      name: "beam a light to burn",
      asks: "a crystal or gas that lases",
      later: true,
      met: laser !== null,
      by: laser,
      subst: laser?.startsWith("ruby") ? "corundum" : null,
      why: laser
        ? `It can lase with ${laser}.`
        : "No chromium within reach and no carbon gas to lase with.",
    },
    {
      id: "write-a-body",
      icon: "🧬",
      name: "write a body",
      asks: "a life of its own to read the writing of",
      later: true,
      met: w.peopled,
      by: w.peopled ? `its own life, in ${KINDS[w.kind].liquid.name}` : null,
      subst: null,
      why: w.peopled
        ? `Its people can read and rewrite the chemistry they themselves are made of, in ${KINDS[w.kind].liquid.name}.`
        : "No people to read it.",
    },
    {
      id: "remake-a-world",
      icon: "🌱",
      name: "remake a world",
      asks: "a body to remake, and giants to draw air and water from",
      later: true,
      met: w.rockBodies >= 1 && w.giants >= 1,
      by: w.rockBodies >= 1 && w.giants >= 1 ? `its neighbours, and ${w.giants} giants` : null,
      subst: null,
      why:
        w.rockBodies < 1
          ? "No other ground in its system to remake."
          : w.giants < 1
            ? "No giant to draw air and water from."
            : `${w.rockBodies} bodies to remake, ${w.giants} giants to draw air and water from.`,
    },
    {
      id: "roof-a-world",
      icon: "🏙️",
      name: "roof a world with towers",
      asks: "a stuff that stands three kilometres tall under its own pull",
      later: true,
      met: tower >= 3,
      by: `${nameOf(towerStuff)}: ${num(tower, 1)} km`,
      subst: towerStuff,
      why: `${nameOf(towerStuff)[0]!.toUpperCase()}${nameOf(towerStuff).slice(1)} stands ${num(tower, 1)} km under ${num(w.gravity)} g.`,
    },
  ];
}
