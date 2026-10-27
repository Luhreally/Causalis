// What matter, elements and made things look like (Phase 54 M223, asked for 2026-10-26: "for the
// tools and elements it should have procedurally item drawings for them, like when I click on the tab
// for it I should see the unique matter, tool or whatever"): each substance's specimen (its form, its
// habit, its lustre, how clear it is), each element as it stands pure, and each made thing by its form
// and the way it was made. The host only says what each looks like, as a Portrait on a page or a
// thumbnail in a list; the canvas draws it. Pure data and arithmetic, never read by the simulation.
import { hashString } from "../kernel/index.ts";
import {
  CARBON_STONES,
  FIELDSTONE,
  KIND_STONES,
  REDUCED_STONES,
  SILICA_HIGH_STONES,
  SILICA_LOW_STONES,
  STONES,
  findElement,
  type Substance,
} from "../rules/index.ts";
import type { Habit, Lustre, MadeHow, MatterForm, Portrait } from "../bridge/index.ts";

/** What a substance's specimen looks like: its form, how its crystals or grains grow, its lustre, its clarity. */
export type MatterLook = {
  readonly form: MatterForm;
  readonly habit: Habit | null;
  readonly lustre: Lustre;
  /** How much light passes through it (0 opaque … 1 clear as glass). */
  readonly clarity: number;
};

type LookRow = readonly [
  id: string,
  form: MatterForm,
  habit: Habit | null,
  lustre: Lustre,
  clarity: number,
];

/** Every substance of Earth's and of the novel chemistries, as the rows of its specimen. */
const LOOK_ROWS: readonly LookRow[] = [
  // Metals.
  ["copper", "ingot", null, "metallic", 0],
  ["tin", "ingot", null, "metallic", 0],
  ["bronze", "ingot", null, "metallic", 0],
  ["iron", "ingot", null, "metallic", 0],
  ["steel", "ingot", null, "metallic", 0],
  ["gold", "lump", "nugget", "metallic", 0],
  ["zinc", "ingot", null, "metallic", 0],
  ["brass", "ingot", null, "metallic", 0],
  ["nickel", "ingot", null, "metallic", 0],
  ["arsenic", "lump", "massive", "submetallic", 0],
  ["cupronickel", "ingot", null, "metallic", 0],
  ["arsenical-copper", "ingot", null, "metallic", 0],
  ["telluric-iron", "lump", "nugget", "metallic", 0],
  ["cohenite", "crystal", "granular", "metallic", 0],
  ["cohenite-iron", "ingot", null, "metallic", 0],
  ["native-copper", "crystal", "dendritic", "metallic", 0],
  // Ores.
  ["malachite", "crystal", "botryoidal", "silky", 0],
  ["chalcopyrite", "crystal", "tetrahedral", "metallic", 0],
  ["cassiterite", "crystal", "prismatic", "adamantine", 0.1],
  ["hematite", "crystal", "botryoidal", "submetallic", 0],
  ["magnetite", "crystal", "octahedral", "metallic", 0],
  ["limonite", "lump", "earthy", "dull", 0],
  ["pyrite", "crystal", "cubic", "metallic", 0],
  ["sphalerite", "crystal", "tetrahedral", "resinous", 0.2],
  ["chalcocite", "lump", "massive", "metallic", 0],
  ["siderite", "crystal", "rhombic", "pearly", 0.2],
  ["garnierite", "lump", "earthy", "dull", 0],
  ["arsenopyrite", "crystal", "prismatic", "metallic", 0],
  ["tennantite", "crystal", "tetrahedral", "metallic", 0],
  // Minerals and stones.
  ["halite", "crystal", "cubic", "vitreous", 0.6],
  ["quartz", "crystal", "hexagonal", "vitreous", 0.85],
  ["flint", "lump", "nodular", "waxy", 0.1],
  ["chert", "lump", "conchoidal", "waxy", 0.05],
  ["obsidian", "glass", "conchoidal", "vitreous", 0.2],
  ["feldspar", "crystal", "prismatic", "vitreous", 0.15],
  ["plagioclase", "crystal", "bladed", "vitreous", 0.15],
  ["pyroxene", "crystal", "prismatic", "vitreous", 0.05],
  ["olivine", "crystal", "granular", "vitreous", 0.4],
  ["mica", "crystal", "platy", "pearly", 0.3],
  ["kaolinite", "lump", "earthy", "dull", 0],
  ["fired-clay", "lump", "massive", "dull", 0],
  ["calcite", "crystal", "rhombic", "vitreous", 0.5],
  ["dolomite", "crystal", "rhombic", "pearly", 0.25],
  ["apatite", "crystal", "hexagonal", "vitreous", 0.3],
  ["moissanite", "crystal", "hexagonal", "adamantine", 0.7],
  ["graphite", "crystal", "platy", "submetallic", 0],
  ["nephrite", "lump", "massive", "silky", 0.1],
  ["corundum", "crystal", "hexagonal", "adamantine", 0.45],
  ["tachylite", "glass", "conchoidal", "vitreous", 0.05],
  ["sulphur", "crystal", "prismatic", "resinous", 0.3],
  ["saltpetre", "crystal", "acicular", "vitreous", 0.4],
  ["blue-vitriol", "crystal", "prismatic", "vitreous", 0.55],
  ["white-arsenic", "crystal", "octahedral", "vitreous", 0.35],
  // The kinds' (Phase 56): ices, tars and their stones.
  ["water-ice", "crystal", "hexagonal", "vitreous", 0.8],
  ["ammonia-hydrate", "crystal", "granular", "vitreous", 0.55],
  ["diamond", "crystal", "octahedral", "adamantine", 0.92],
  ["bitumen", "lump", "massive", "greasy", 0],
  ["tholin", "powder", "granular", "dull", 0],
  ["gypsum", "crystal", "bladed", "pearly", 0.45],
  ["pitch-grit", "lump", "granular", "greasy", 0],
  ["sulfur-concrete", "lump", "massive", "resinous", 0],
  ["polyacetylene", "sheet", null, "submetallic", 0],
  // Made, fuel and kitchen.
  ["glass", "glass", "conchoidal", "vitreous", 0.9],
  ["slag", "lump", "conchoidal", "vitreous", 0.05],
  ["quicklime", "powder", null, "dull", 0],
  ["natron", "powder", "granular", "dull", 0],
  ["potash", "powder", null, "dull", 0],
  ["carbon", "lump", "massive", "dull", 0],
  ["crude", "liquid", null, "greasy", 0.1],
  ["cellulose", "fibre", "fibrous", "silky", 0],
  ["starch", "powder", null, "dull", 0],
  ["sugar", "crystal", "granular", "vitreous", 0.5],
  ["protein", "flesh", null, "waxy", 0],
  ["fat", "flesh", null, "greasy", 0.15],
  ["keratin", "sheet", null, "waxy", 0.2],
  ["collagen", "sheet", null, "waxy", 0.25],
  ["humus", "lump", "earthy", "dull", 0],
  ["tannin", "powder", null, "dull", 0],
  ["leather", "sheet", null, "waxy", 0],
  ["ethanol", "liquid", null, "vitreous", 0.9],
  ["water", "liquid", null, "vitreous", 0.95],
  ["zinc-oxide", "powder", null, "dull", 0],
  ["black-powder", "powder", "granular", "dull", 0],
  ["potash-bisulphate", "crystal", "granular", "vitreous", 0.3],
  ["potassium-sulphide", "lump", "massive", "resinous", 0],
  ["nitrocellulose", "fibre", "fibrous", "silky", 0],
  ["vitriol", "liquid", null, "greasy", 0.8],
  ["nitric-acid", "liquid", null, "vitreous", 0.8],
  // The kinds' seas (Phase 56).
  ["ammonia-water", "liquid", null, "vitreous", 0.95],
  ["acid-water", "liquid", null, "vitreous", 0.85],
  // Gases (habit null, lustre dull).
  ["steam", "gas", null, "dull", 0.8],
  ["nitrogen", "gas", null, "dull", 0.9],
  ["oxygen", "gas", null, "dull", 0.9],
  ["argon", "gas", null, "dull", 0.9],
  ["co2", "gas", null, "dull", 0.9],
  ["so2", "gas", null, "dull", 0.9],
  // The kinds' (Phase 56).
  ["ammonia", "gas", null, "dull", 0.9],
  ["methane", "gas", null, "dull", 0.9],
  ["ethane", "gas", null, "dull", 0.9],
  ["acetylene", "gas", null, "dull", 0.9],
  ["hydrogen", "gas", null, "dull", 0.9],
  ["carbon-monoxide", "gas", null, "dull", 0.9],
];

/**
 * Every substance's look by its id (Earth's, the novel ones' and the kinds' — Phase 56; a substance
 * not here is `lookOf`'s).
 */
export const LOOKS: Readonly<Record<string, MatterLook>> = Object.fromEntries(
  LOOK_ROWS.map(([id, form, habit, lustre, clarity]): [string, MatterLook] => [
    id,
    { form, habit, lustre, clarity },
  ]),
);

/** A gas: clear, dull to the eye (the table's own). */
const GAS_LOOK: MatterLook = { form: "gas", habit: null, lustre: "dull", clarity: 0.9 };

/**
 * A substance's look from first principles, for one that is not in LOOKS: by its phase, its kind and
 * its formula (a metal is a bar; a silicate a clear crystal; a mineral of Mohs 6 or more a prism).
 */
export function lookOf(s: Substance): MatterLook {
  const keys = Object.keys(s.formula),
    has = (e: string) => keys.includes(e);
  if (s.phase === "gas" || s.kind === "gas") return GAS_LOOK;
  // (Water is the one liquid of its kind: it is always as clear as it is.)
  if (s.kind === "water") return { form: "liquid", habit: null, lustre: "vitreous", clarity: 0.95 };
  if (s.phase === "liquid")
    return {
      form: "liquid",
      habit: null,
      lustre: "vitreous",
      clarity: Math.min(...s.colour) > 0.75 ? 0.9 : 0.5,
    };
  if (s.kind === "metal") return { form: "ingot", habit: null, lustre: "metallic", clarity: 0 };
  if (s.kind === "ore") {
    // (A sulphide of a metal shines like one.)
    const metalSulphide = has("S") && ["Fe", "Cu", "Zn", "Ni", "As"].some(has);
    return {
      form: "crystal",
      habit: "massive",
      lustre: metalSulphide ? "metallic" : "submetallic",
      clarity: 0,
    };
  }
  if (s.kind === "mineral") {
    if (s.hardness !== null && s.hardness >= 6)
      return { form: "crystal", habit: "prismatic", lustre: "vitreous", clarity: 0.3 };
    if (keys.length === 2 && has("Si") && has("O"))
      return { form: "crystal", habit: "hexagonal", lustre: "vitreous", clarity: 0.7 };
    return { form: "lump", habit: "massive", lustre: "vitreous", clarity: 0.1 };
  }
  if (s.kind === "fuel") return { form: "lump", habit: "massive", lustre: "dull", clarity: 0 };
  if (s.kind === "food") return { form: "powder", habit: null, lustre: "dull", clarity: 0 };
  if (s.kind === "living") return { form: "flesh", habit: null, lustre: "waxy", clarity: 0 };
  // (The made: a lump, massive and dull.)
  return { form: "lump", habit: "massive", lustre: "dull", clarity: 0 };
}

/** A substance's look: its row in LOOKS, else `lookOf` (from first principles). */
export function substanceLook(s: Substance): MatterLook {
  return LOOKS[s.id] ?? lookOf(s);
}

/** A substance as a specimen (`kind: "matter"`): cut as it grows, coloured and lit as it shines. */
export function matterPortrait(s: Substance): Portrait {
  const look = substanceLook(s);
  return {
    kind: "matter",
    form: look.form,
    habit: look.habit,
    color: s.colour,
    lustre: look.lustre,
    clarity: look.clarity,
    hardness: s.hardness,
    key: hashString(s.id),
  };
}

/** An element as it stands pure: its state at 15 °C, its sort, its colour, whether it is kept under something. */
export type ElementNature = {
  readonly state: "solid" | "liquid" | "gas";
  readonly sort: "metal" | "metalloid" | "nonmetal" | "noble";
  readonly color: readonly [number, number, number];
  /** Kept under oil (or water, for phosphorus): it burns in the air. */
  readonly kept: boolean;
};

/** Every element of Earth's and the novel ones, by its symbol. */
export const ELEMENT_NATURE: Readonly<Record<string, ElementNature>> = {
  H: { state: "gas", sort: "nonmetal", color: [0.9, 0.6, 0.85], kept: false },
  C: { state: "solid", sort: "nonmetal", color: [0.12, 0.12, 0.13], kept: false },
  N: { state: "gas", sort: "nonmetal", color: [0.75, 0.7, 0.95], kept: false },
  O: { state: "gas", sort: "nonmetal", color: [0.7, 0.8, 1], kept: false },
  Na: { state: "solid", sort: "metal", color: [0.82, 0.82, 0.8], kept: true },
  Mg: { state: "solid", sort: "metal", color: [0.78, 0.78, 0.8], kept: false },
  Al: { state: "solid", sort: "metal", color: [0.82, 0.84, 0.87], kept: false },
  Si: { state: "solid", sort: "metalloid", color: [0.45, 0.48, 0.56], kept: false },
  P: { state: "solid", sort: "nonmetal", color: [0.95, 0.93, 0.8], kept: true },
  S: { state: "solid", sort: "nonmetal", color: [0.95, 0.85, 0.2], kept: false },
  Cl: { state: "gas", sort: "nonmetal", color: [0.8, 0.9, 0.4], kept: false },
  Ar: { state: "gas", sort: "noble", color: [0.75, 0.6, 0.95], kept: false },
  K: { state: "solid", sort: "metal", color: [0.8, 0.8, 0.78], kept: true },
  Ca: { state: "solid", sort: "metal", color: [0.85, 0.85, 0.82], kept: true },
  Fe: { state: "solid", sort: "metal", color: [0.56, 0.56, 0.6], kept: false },
  Cu: { state: "solid", sort: "metal", color: [0.85, 0.5, 0.3], kept: false },
  Zn: { state: "solid", sort: "metal", color: [0.7, 0.73, 0.77], kept: false },
  Sn: { state: "solid", sort: "metal", color: [0.8, 0.8, 0.83], kept: false },
  Au: { state: "solid", sort: "metal", color: [0.95, 0.78, 0.3], kept: false },
  As: { state: "solid", sort: "metalloid", color: [0.55, 0.55, 0.57], kept: false },
  Ni: { state: "solid", sort: "metal", color: [0.75, 0.73, 0.68], kept: false },
};

/** An element missing from ELEMENT_NATURE: a solid, not a metal, grey, kept under nothing. */
const GREY_NATURE: ElementNature = {
  state: "solid",
  sort: "nonmetal",
  color: [0.6, 0.6, 0.6],
  kept: false,
};

/** An element's nature by its symbol (grey, a solid non-metal, where the table has no row). */
export function elementNature(symbol: string): ElementNature {
  return ELEMENT_NATURE[symbol] ?? GREY_NATURE;
}

/** An element as it stands pure (`kind: "element"`), or null where there is no such element. */
export function elementPortrait(symbol: string): Portrait | null {
  if (!findElement(symbol)) return null;
  const n = elementNature(symbol);
  return {
    kind: "element",
    symbol,
    state: n.state,
    sort: n.sort,
    color: n.color,
    kept: n.kept,
    key: hashString(symbol),
  };
}

/** The forms a made thing takes, in the order their names are looked for (the first the name holds). */
const THING_FORMS: readonly string[] = [
  "storage jar",
  "cooking pot",
  "plough share",
  "spearhead",
  "horn-bow",
  "autoloader",
  "automatic",
  "repeater",
  "musket",
  "rifle",
  "sword",
  "spear",
  "club",
  "bow",
  "axe",
  "adze",
  "hoe",
  "sickle",
  "shears",
  "hammer",
  "chisel",
  "knife",
  "jug",
  "bowl",
  "jar",
  "pot",
  "tunic",
  "shirt",
  "coat",
  "cloak",
  "dress",
  "gown",
  "cloth",
  "piston",
  "shaft",
  "axle",
  "bolt",
  "gear",
  "wheel",
  "casting",
];
const THING_FORM_WORDS: readonly (readonly [string, RegExp])[] = THING_FORMS.map(
  (f): readonly [string, RegExp] => [f, new RegExp(`\\b${f}\\b`)],
);

/** The form word in a thing's name ("a bronze sickle" is a sickle), or "thing" where no form word is. */
export function thingForm(name: string): string {
  const n = name.toLowerCase();
  return THING_FORM_WORDS.find(([, re]) => re.test(n))?.[0] ?? "thing";
}

/**
 * The names of stones a people knap an edge to: flint and the rest, and every stone of the crusts'
 * tables (and the kinds' own: moissanite, diamond, ice — Phase 56).
 */
const STONE_NAMES: ReadonlySet<string> = new Set<string>([
  "flint",
  "chert",
  "obsidian",
  "quartzite",
  "jasper",
  "lydite",
  ...[STONES, SILICA_HIGH_STONES, SILICA_LOW_STONES, REDUCED_STONES, CARBON_STONES].flatMap(
    (table) => Object.values(table).map((s) => s.name),
  ),
  FIELDSTONE.name,
  ...Object.values(KIND_STONES).flatMap((table) => Object.values(table).map((s) => s.name)),
]);

/** The materials a thing is carved from. */
const CARVED: ReadonlySet<string> = new Set([
  "wood",
  "reed",
  "hide",
  "horn",
  "bone",
  "shell",
  "coral",
]);

/**
 * How a made thing was made, which says how it is drawn: from its stuff, the good it is, and its
 * material where the arm or the tool says it (stone, machined, wood, a body's own).
 */
export function madeHowOf(
  stuff: string,
  good: "tools" | "clothing" | "pottery" | "arms" | "machines",
  material?: string,
): MadeHow {
  if (material === "stone" || STONE_NAMES.has(stuff)) return "knapped";
  if (material === "machined" || (good === "machines" && stuff.includes("steel")))
    return "machined";
  if (good === "machines") return "cast";
  // (A kind's vessels, where no clay is fired: a basket woven and pitched, ice cut hollow: Phase 56.)
  if (good === "pottery")
    return /basket/.test(stuff) ? "woven" : /\bice\b/.test(stuff) ? "carved" : "thrown";
  if (good === "clothing") return /leather|hide/.test(stuff) ? "sewn" : "woven";
  // A body's own claws, horns or shell are grown, whatever they are of.
  if (material === "body") return "grown";
  // Wood, bone, horn and shell are worked by cutting and scraping: a horn-bow, a shell's darts.
  if (CARVED.has(material ?? "") || /wood|bone|horn|shell/.test(stuff)) return "carved";
  // (A carbon world's native copper is beaten cold, its carbide iron ground keen: Phase 56.)
  if (/native copper/.test(stuff)) return "forged";
  if (/carbide/.test(stuff)) return "machined";
  if (/bronze|copper|brass|cupronickel|arsenical/.test(stuff)) return "cast";
  // Iron, steel, nickel, and any metal not cast: forged.
  return "forged";
}

/** Each way of making's lustre, where the thing does not say its own. */
const LUSTRE_OF: Readonly<Record<MadeHow, Lustre>> = {
  forged: "metallic",
  cast: "metallic",
  machined: "metallic",
  knapped: "waxy",
  thrown: "dull",
  woven: "dull",
  sewn: "dull",
  carved: "dull",
  grown: "waxy",
};

/** A made thing as it is drawn: its form, how it was made, its colour and lustre, its haft, its quality and wear. */
export function thingPortrait(t: {
  readonly form: string;
  readonly made: MadeHow;
  readonly color: readonly [number, number, number];
  readonly lustre?: Lustre;
  readonly haft?: readonly [number, number, number] | null;
  readonly quality: number;
  readonly worn: number;
  readonly key: number;
}): Portrait {
  return {
    kind: "thing",
    form: t.form,
    made: t.made,
    color: t.color,
    lustre: t.lustre ?? LUSTRE_OF[t.made],
    haft: t.haft ?? null,
    quality: Math.min(100, Math.max(0, t.quality)),
    worn: Math.min(1, Math.max(0, t.worn)),
    key: t.key,
  };
}
