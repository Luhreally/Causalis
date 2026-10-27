// Matter (Phase 15 M122, asked for 2026-09-28: "the detail … it breaks down inventory and
// chemistry"): the elements and substances things are made of, the reactions that turn one
// into another, and what each good is made of — as data, and balanced. Real substances with
// real formulas (malachite, cassiterite, charcoal, bronze): a world's own geology sets how
// much of each it holds, not what they are. A formula is counted in atoms (fractions where a
// substance is a blend, as bronze is copper with a little tin); a reaction in moles of each
// substance, and it balances atom for atom (tests/rules/matter.test.ts says so).

/** An element: its symbol, its name, its atomic mass (grams a mole). */
export type Element = { readonly symbol: string; readonly name: string; readonly mass: number };

export const ELEMENTS: readonly Element[] = [
  { symbol: "H", name: "hydrogen", mass: 1.008 },
  { symbol: "C", name: "carbon", mass: 12.011 },
  { symbol: "N", name: "nitrogen", mass: 14.007 },
  { symbol: "O", name: "oxygen", mass: 15.999 },
  { symbol: "Na", name: "sodium", mass: 22.99 },
  { symbol: "Mg", name: "magnesium", mass: 24.305 },
  { symbol: "Al", name: "aluminium", mass: 26.982 },
  { symbol: "Si", name: "silicon", mass: 28.085 },
  { symbol: "P", name: "phosphorus", mass: 30.974 },
  { symbol: "S", name: "sulphur", mass: 32.06 },
  { symbol: "Cl", name: "chlorine", mass: 35.45 },
  { symbol: "Ar", name: "argon", mass: 39.948 },
  { symbol: "K", name: "potassium", mass: 39.098 },
  { symbol: "Ca", name: "calcium", mass: 40.078 },
  { symbol: "Fe", name: "iron", mass: 55.845 },
  { symbol: "Cu", name: "copper", mass: 63.546 },
  { symbol: "Zn", name: "zinc", mass: 65.38 },
  { symbol: "Sn", name: "tin", mass: 118.71 },
  { symbol: "Au", name: "gold", mass: 196.97 },
];

/**
 * Elements Earth's tables never needed, found on worlds of their own chemistry (Phase 54): beside
 * Earth's, so Earth's pages and counts stay as they were.
 */
export const NOVEL_ELEMENTS: readonly Element[] = [
  { symbol: "As", name: "arsenic", mass: 74.922 },
  { symbol: "Ni", name: "nickel", mass: 58.693 },
];

const MASS: Readonly<Record<string, number>> = Object.fromEntries(
  [...ELEMENTS, ...NOVEL_ELEMENTS].map((e) => [e.symbol, e.mass]),
);

/** What kind of matter a substance is (for the words and the colour of its bars). */
export type MatterKind =
  "metal" | "ore" | "mineral" | "fuel" | "made" | "food" | "living" | "water" | "gas";

/** A substance: what it is, its formula (atoms of each element), and how it is. */
export type Substance = {
  readonly id: string;
  readonly name: string;
  /** Its formula as it is written ("Cu₂CO₃(OH)₂"), for the words. */
  readonly written: string;
  /** Atoms of each element in one of it (fractions for a blend). */
  readonly formula: Readonly<Record<string, number>>;
  readonly kind: MatterKind;
  /** At 15 °C. */
  readonly phase: "solid" | "liquid" | "gas";
  /** Kilograms a cubic metre. */
  readonly density: number;
  /** °C it melts at (null: it breaks down first, or has no single point). */
  readonly melts: number | null;
  /** Mohs hardness, for solids that have one. */
  readonly hardness: number | null;
  /** Its colour (0 … 1 each). */
  readonly colour: readonly [number, number, number];
  /** One sentence. */
  readonly words: string;
};

const S = (
  id: string,
  name: string,
  written: string,
  formula: Record<string, number>,
  kind: MatterKind,
  phase: Substance["phase"],
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
  phase,
  density,
  melts,
  hardness,
  colour,
  words,
});

// Proteins by their make-up by mass (per 100 g: C, H, N, O, S), as a formula of so many atoms.
const byMass = (shares: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(shares).map(([e, m]) => [e, (m * 100) / MASS[e]!]));
const PROTEIN = byMass({ C: 0.53, H: 0.07, N: 0.16, O: 0.23, S: 0.01 }),
  KERATIN = byMass({ C: 0.5, H: 0.07, N: 0.17, O: 0.22, S: 0.04 }),
  COLLAGEN = byMass({ C: 0.5, H: 0.066, N: 0.18, O: 0.25, S: 0.004 }),
  TANNIN = { C: 76, H: 52, O: 46 },
  /** Leather: collagen with about a sixth of its weight of tannin taken up. */
  LEATHER_TANNIN = 0.0104,
  /** Bronze: copper with a tenth and more of tin, by weight (atoms: 93.2 to 6.8). */
  BRONZE = { Cu: 0.932, Sn: 0.068 },
  /** Brass: copper with three tenths of zinc, by weight (atoms: 70.6 to 29.4). */
  BRASS = { Cu: 0.706, Zn: 0.294 },
  /** Steel: iron with a hundredth of carbon, by weight. */
  STEEL = { Fe: 0.9551, C: 0.0449 },
  /** Cupronickel: copper with a quarter of nickel, by weight (atoms: 73.5 to 26.5). */
  CUPRONICKEL = { Cu: 0.73481, Ni: 0.26519 },
  /** Arsenical copper: copper with four hundredths of arsenic, by weight (atoms: 96.6 to 3.4). */
  ARSENICAL = { Cu: 0.96587, As: 0.03413 },
  /** Telluric iron: native iron, a tenth of its atoms carbon. */
  TELLURIC = { Fe: 0.9, C: 0.1 },
  /** Cohenite iron: iron with three hundredths of carbon, by weight (atoms: 87.4 to 12.6). */
  COHENITE_IRON = { Fe: 0.87428, C: 0.12572 },
  /**
   * Black powder: per 100 g, three parts saltpetre in four, three in twenty charcoal, one in ten
   * sulphur; the atoms of each, in moles.
   */
  BLACK_POWDER = { K: 0.7418, N: 0.7418, O: 2.2254, C: 1.2489, S: 0.3119 };
const plus = (a: Record<string, number>, b: Record<string, number>, k: number) => {
  const out = { ...a };
  for (const [e, n] of Object.entries(b)) out[e] = (out[e] ?? 0) + n * k;
  return out;
};

export const SUBSTANCES: readonly Substance[] = [
  // Metals.
  S(
    "copper",
    "copper",
    "Cu",
    { Cu: 1 },
    "metal",
    "solid",
    8960,
    1085,
    3,
    [0.78, 0.45, 0.22],
    "The first metal worked: soft, red, and found now and then lying free in the ground.",
  ),
  S(
    "tin",
    "tin",
    "Sn",
    { Sn: 1 },
    "metal",
    "solid",
    7265,
    232,
    1.5,
    [0.78, 0.78, 0.8],
    "A soft white metal, rare, that hardens copper into bronze.",
  ),
  S(
    "bronze",
    "bronze",
    "Cu + Sn",
    BRONZE,
    "metal",
    "solid",
    8800,
    950,
    3.5,
    [0.8, 0.56, 0.26],
    "Copper with a tenth of tin: harder than either, and it pours sharp into a mould.",
  ),
  S(
    "iron",
    "iron",
    "Fe",
    { Fe: 1 },
    "metal",
    "solid",
    7874,
    1538,
    4,
    [0.55, 0.55, 0.58],
    "The common metal: its ores are everywhere, but it wants a hotter fire.",
  ),
  S(
    "steel",
    "steel",
    "Fe + C",
    STEEL,
    "metal",
    "solid",
    7850,
    1450,
    5.5,
    [0.64, 0.66, 0.7],
    "Iron with a hundredth of carbon: it takes an edge and keeps it.",
  ),
  S(
    "gold",
    "gold",
    "Au",
    { Au: 1 },
    "metal",
    "solid",
    19300,
    1064,
    2.5,
    [0.95, 0.78, 0.2],
    "It never rusts, and it lies free in streams: worth much, good for little.",
  ),
  S(
    "zinc",
    "zinc",
    "Zn",
    { Zn: 1 },
    "metal",
    "solid",
    7140,
    420,
    2.5,
    [0.74, 0.77, 0.8],
    "A bluish-white metal that boils off in the furnace before it can run: caught in a closed retort, it turns copper into brass.",
  ),
  S(
    "brass",
    "brass",
    "Cu + Zn",
    BRASS,
    "metal",
    "solid",
    8530,
    930,
    3.5,
    [0.86, 0.7, 0.32],
    "Copper with zinc: yellow, and drawn cold into a cartridge's thin case without splitting.",
  ),
  // Ores.
  S(
    "malachite",
    "malachite",
    "Cu₂CO₃(OH)₂",
    { Cu: 2, C: 1, O: 5, H: 2 },
    "ore",
    "solid",
    3950,
    null,
    3.75,
    [0.1, 0.6, 0.36],
    "Green copper ore near the surface: charcoal's fire gives up its copper.",
  ),
  S(
    "chalcopyrite",
    "chalcopyrite",
    "CuFeS₂",
    { Cu: 1, Fe: 1, S: 2 },
    "ore",
    "solid",
    4190,
    950,
    3.75,
    [0.82, 0.72, 0.22],
    "Brassy copper ore of the deep and of the sea's vents: it must be roasted first.",
  ),
  S(
    "cassiterite",
    "cassiterite",
    "SnO₂",
    { Sn: 1, O: 2 },
    "ore",
    "solid",
    6950,
    1630,
    6.5,
    [0.35, 0.25, 0.2],
    "Heavy black tin ore, washed out of granite into the streams.",
  ),
  S(
    "hematite",
    "hematite",
    "Fe₂O₃",
    { Fe: 2, O: 3 },
    "ore",
    "solid",
    5260,
    1565,
    5.5,
    [0.56, 0.16, 0.13],
    "Red iron ore, the rust of the world.",
  ),
  S(
    "magnetite",
    "magnetite",
    "Fe₃O₄",
    { Fe: 3, O: 4 },
    "ore",
    "solid",
    5170,
    1597,
    6,
    [0.15, 0.15, 0.17],
    "Black iron ore that draws iron to it.",
  ),
  S(
    "limonite",
    "bog ore",
    "FeO(OH)",
    { Fe: 1, O: 2, H: 1 },
    "ore",
    "solid",
    3800,
    null,
    4.5,
    [0.58, 0.38, 0.16],
    "Iron rusted out of the ground water into lumps in marsh and lake bed: dug with a spade, soft to smelt, its iron uneven.",
  ),
  S(
    "halite",
    "rock salt",
    "NaCl",
    { Na: 1, Cl: 1 },
    "mineral",
    "solid",
    2170,
    801,
    2.5,
    [0.95, 0.95, 0.95],
    "Salt: in dried seas under the ground, and in the sea itself.",
  ),
  S(
    "pyrite",
    "pyrite",
    "FeS₂",
    { Fe: 1, S: 2 },
    "mineral",
    "solid",
    5010,
    1177,
    6.5,
    [0.85, 0.75, 0.3],
    "Fool's gold, in coal and shale: burned, it sours the air.",
  ),
  S(
    "sphalerite",
    "sphalerite",
    "ZnS",
    { Zn: 1, S: 1 },
    "ore",
    "solid",
    4050,
    null,
    3.75,
    [0.42, 0.3, 0.16],
    "Zinc blende: brown-black crystals with a resinous shine, found in the veins with lead and copper.",
  ),
  // Minerals of rock, soil and craft.
  S(
    "quartz",
    "quartz",
    "SiO₂",
    { Si: 1, O: 2 },
    "mineral",
    "solid",
    2650,
    1713,
    7,
    [0.92, 0.9, 0.86],
    "The commonest mineral of the land's face: sand, and the stuff of glass.",
  ),
  S(
    "flint",
    "flint",
    "SiO₂",
    { Si: 1, O: 2 },
    "mineral",
    "solid",
    2600,
    1713,
    7,
    [0.35, 0.31, 0.28],
    "Quartz grown fine in chalk: it breaks to an edge sharper than steel.",
  ),
  // The other stones knapped to an edge (Phase 50 M212): chert of the shale's beds, the black
  // glass of old lava.
  S(
    "chert",
    "chert",
    "SiO₂",
    { Si: 1, O: 2 },
    "mineral",
    "solid",
    2650,
    1713,
    7,
    [0.2, 0.2, 0.23],
    "Quartz grown fine in beds among shale and limestone: flint's duller kin, as keen once knapped.",
  ),
  S(
    "obsidian",
    "obsidian",
    "SiO₂ + Al, Na, K",
    { Si: 1, O: 2.295, Al: 0.16, Na: 0.06, K: 0.05 },
    "mineral",
    "solid",
    2400,
    null,
    5.5,
    [0.06, 0.06, 0.09],
    "Lava cooled too fast to grow crystals: black glass that knaps to the keenest edge any stone takes, and the most brittle.",
  ),
  S(
    "feldspar",
    "feldspar",
    "KAlSi₃O₈",
    { K: 1, Al: 1, Si: 3, O: 8 },
    "mineral",
    "solid",
    2560,
    1200,
    6,
    [0.9, 0.72, 0.66],
    "Half of granite: weathered, it becomes clay.",
  ),
  S(
    "plagioclase",
    "plagioclase",
    "CaAl₂Si₂O₈",
    { Ca: 1, Al: 2, Si: 2, O: 8 },
    "mineral",
    "solid",
    2730,
    1550,
    6,
    [0.86, 0.86, 0.9],
    "The commonest mineral of the crust: pale and blocky, in basalt and andesite.",
  ),
  S(
    "pyroxene",
    "pyroxene",
    "CaMgSi₂O₆",
    { Ca: 1, Mg: 1, Si: 2, O: 6 },
    "mineral",
    "solid",
    3300,
    1390,
    6,
    [0.2, 0.3, 0.22],
    "Dark and heavy: the black of basalt.",
  ),
  S(
    "olivine",
    "olivine",
    "Mg₂SiO₄",
    { Mg: 2, Si: 1, O: 4 },
    "mineral",
    "solid",
    3270,
    1890,
    6.5,
    [0.55, 0.7, 0.2],
    "Green grains of the deep, brought up in basalt.",
  ),
  S(
    "mica",
    "mica",
    "KMg₃AlSi₃O₁₀(OH)₂",
    { K: 1, Mg: 3, Al: 1, Si: 3, O: 12, H: 2 },
    "mineral",
    "solid",
    2850,
    1300,
    2.5,
    [0.36, 0.28, 0.2],
    "Flakes that split to thin sheets: the glitter of granite.",
  ),
  S(
    "kaolinite",
    "clay",
    "Al₂Si₂O₅(OH)₄",
    { Al: 2, Si: 2, O: 9, H: 4 },
    "mineral",
    "solid",
    2650,
    null,
    2,
    [0.86, 0.8, 0.7],
    "Clay: weathered rock that holds water and takes a shape.",
  ),
  S(
    "fired-clay",
    "fired clay",
    "Al₂Si₂O₇",
    { Al: 2, Si: 2, O: 7 },
    "made",
    "solid",
    2200,
    null,
    5.5,
    [0.74, 0.42, 0.26],
    "Clay the fire has driven the water out of: it will not soften again.",
  ),
  S(
    "calcite",
    "limestone",
    "CaCO₃",
    { Ca: 1, C: 1, O: 3 },
    "mineral",
    "solid",
    2710,
    null,
    3,
    [0.9, 0.9, 0.84],
    "The shells of old seas, turned to stone.",
  ),
  S(
    "quicklime",
    "quicklime",
    "CaO",
    { Ca: 1, O: 1 },
    "made",
    "solid",
    3340,
    2613,
    3.5,
    [0.96, 0.96, 0.94],
    "Burned limestone: with water and sand, mortar.",
  ),
  S(
    "natron",
    "soda",
    "Na₂CO₃",
    { Na: 2, C: 1, O: 3 },
    "mineral",
    "solid",
    2540,
    851,
    2.5,
    [0.97, 0.97, 0.97],
    "Soda from dry lakes and burned sea plants: it lets sand melt low.",
  ),
  S(
    "glass",
    "glass",
    "Na₂CaSi₆O₁₄",
    { Na: 2, Ca: 1, Si: 6, O: 14 },
    "made",
    "solid",
    2500,
    1000,
    5.5,
    [0.72, 0.86, 0.82],
    "Sand, soda and lime melted together: it cools clear.",
  ),
  S(
    "potash",
    "ash",
    "K₂CO₃",
    { K: 2, C: 1, O: 3 },
    "mineral",
    "solid",
    2430,
    891,
    null,
    [0.75, 0.75, 0.72],
    "What is left of a plant when it burns: the salts it drew from the ground.",
  ),
  S(
    "slag",
    "slag",
    "FeO",
    { Fe: 1, O: 1 },
    "made",
    "solid",
    5740,
    1377,
    5,
    [0.2, 0.18, 0.17],
    "What the smelter's fire leaves of an ore that is not its metal.",
  ),
  S(
    "sulphur",
    "sulphur",
    "S",
    { S: 1 },
    "mineral",
    "solid",
    2070,
    115,
    2,
    [0.95, 0.86, 0.2],
    "Yellow brimstone from the vents of fire-mountains: it burns blue, with a choking smoke.",
  ),
  S(
    "saltpetre",
    "saltpetre",
    "KNO₃",
    { K: 1, N: 1, O: 3 },
    "mineral",
    "solid",
    2109,
    334,
    2,
    [0.96, 0.96, 0.95],
    "White crystals that grow where dung and earth lie long together: the fire in black powder.",
  ),
  // Fuels.
  S(
    "carbon",
    "charcoal",
    "C",
    { C: 1 },
    "fuel",
    "solid",
    1800,
    null,
    1.5,
    [0.1, 0.1, 0.1],
    "Wood charred without air: it burns hot and clean. Coal is most of it too.",
  ),
  S(
    "crude",
    "crude oil",
    "C₁₂H₂₆",
    { C: 12, H: 26 },
    "fuel",
    "liquid",
    800,
    -10,
    null,
    [0.12, 0.1, 0.08],
    "The drowned life of old seas, pressed and warmed to oil.",
  ),
  // What lives, and what feeds.
  S(
    "cellulose",
    "wood fibre",
    "(C₆H₁₀O₅)ₙ",
    { C: 6, H: 10, O: 5 },
    "living",
    "solid",
    1500,
    null,
    null,
    [0.78, 0.66, 0.46],
    "What wood, straw and cotton are made of.",
  ),
  S(
    "starch",
    "starch",
    "(C₆H₁₀O₅)ₙ",
    { C: 6, H: 10, O: 5 },
    "food",
    "solid",
    1500,
    null,
    null,
    [0.96, 0.94, 0.86],
    "What grain and roots store their sunlight as.",
  ),
  S(
    "sugar",
    "sugar",
    "C₆H₁₂O₆",
    { C: 6, H: 12, O: 6 },
    "food",
    "solid",
    1540,
    146,
    null,
    [0.97, 0.96, 0.92],
    "Sweetness: in fruit and honey, and in milk.",
  ),
  S(
    "protein",
    "protein",
    "C₄.₄H₆.₉N₁.₁O₁.₄",
    PROTEIN,
    "food",
    "solid",
    1350,
    null,
    null,
    [0.86, 0.62, 0.52],
    "What flesh is built of, and what the body must eat to build its own.",
  ),
  S(
    "fat",
    "fat",
    "C₅₇H₁₀₄O₆",
    { C: 57, H: 104, O: 6 },
    "food",
    "solid",
    920,
    5,
    null,
    [0.97, 0.92, 0.66],
    "Stored food, in flesh, milk and seed: twice the burning of starch.",
  ),
  S(
    "keratin",
    "keratin",
    "C₄.₂H₆.₉N₁.₂O₁.₄S₀.₁",
    KERATIN,
    "living",
    "solid",
    1300,
    null,
    null,
    [0.92, 0.9, 0.84],
    "What wool, hair, horn and hoof are made of.",
  ),
  S(
    "collagen",
    "collagen",
    "C₄.₂H₆.₅N₁.₃O₁.₆",
    COLLAGEN,
    "living",
    "solid",
    1350,
    null,
    null,
    [0.9, 0.8, 0.7],
    "What skin and sinew are made of.",
  ),
  S(
    "humus",
    "humus",
    "C₅₇H₅O₃₄N₄ (by weight)",
    byMass({ C: 0.57, H: 0.05, O: 0.34, N: 0.04 }),
    "living",
    "solid",
    1300,
    null,
    null,
    [0.2, 0.14, 0.08],
    "What is left of dead leaves and roots when the worms are done: the dark of good earth.",
  ),
  S(
    "apatite",
    "bone mineral",
    "Ca₁₀(PO₄)₆(OH)₂",
    { Ca: 10, P: 6, O: 26, H: 2 },
    "living",
    "solid",
    3160,
    1670,
    5,
    [0.94, 0.92, 0.86],
    "What bones and teeth are made hard with: lime and phosphorus.",
  ),
  S(
    "tannin",
    "tannin",
    "C₇₆H₅₂O₄₆",
    TANNIN,
    "living",
    "solid",
    2120,
    null,
    null,
    [0.55, 0.35, 0.2],
    "From oak bark and galls: it binds skin so it will not rot.",
  ),
  S(
    "leather",
    "leather",
    "collagen + tannin",
    plus(COLLAGEN, TANNIN, LEATHER_TANNIN),
    "made",
    "solid",
    860,
    null,
    null,
    [0.55, 0.36, 0.22],
    "Skin tanned so it will not rot, and stays supple.",
  ),
  S(
    "ethanol",
    "alcohol",
    "C₂H₅OH",
    { C: 2, H: 6, O: 1 },
    "made",
    "liquid",
    789,
    -114,
    null,
    [0.96, 0.9, 0.7],
    "What yeast makes of sugar: in beer and wine.",
  ),
  // Water and the air.
  S(
    "water",
    "water",
    "H₂O",
    { H: 2, O: 1 },
    "water",
    "liquid",
    1000,
    0,
    null,
    [0.4, 0.62, 0.92],
    "The solvent of all that lives here.",
  ),
  S(
    "steam",
    "water vapour",
    "H₂O",
    { H: 2, O: 1 },
    "gas",
    "gas",
    0.6,
    null,
    null,
    [0.9, 0.92, 0.96],
    "Water as air.",
  ),
  S(
    "nitrogen",
    "nitrogen",
    "N₂",
    { N: 2 },
    "gas",
    "gas",
    1.25,
    -210,
    null,
    [0.8, 0.84, 0.95],
    "Four fifths of the air, and slow to join with anything.",
  ),
  S(
    "oxygen",
    "oxygen",
    "O₂",
    { O: 2 },
    "gas",
    "gas",
    1.43,
    -218,
    null,
    [0.72, 0.84, 1],
    "What fire and breath take from the air: a fifth of it.",
  ),
  S(
    "argon",
    "argon",
    "Ar",
    { Ar: 1 },
    "gas",
    "gas",
    1.78,
    -189,
    null,
    [0.84, 0.8, 0.95],
    "A hundredth of the air, and joins with nothing.",
  ),
  S(
    "co2",
    "carbon dioxide",
    "CO₂",
    { C: 1, O: 2 },
    "gas",
    "gas",
    1.98,
    null,
    null,
    [0.72, 0.72, 0.72],
    "What burning and breath give back to the air: it keeps the world warm.",
  ),
  S(
    "so2",
    "sulphur dioxide",
    "SO₂",
    { S: 1, O: 2 },
    "gas",
    "gas",
    2.62,
    -72,
    null,
    [0.86, 0.84, 0.6],
    "The sour smoke of roasted ores and burned coal.",
  ),
  // The works of the age of current.
  S(
    "blue-vitriol",
    "blue vitriol",
    "CuSO₄",
    { Cu: 1, S: 1, O: 4 },
    "made",
    "solid",
    3600,
    110,
    2.5,
    [0.2, 0.45, 0.85],
    "Copper dissolved in acid: a current parts the metal out pure.",
  ),
  S(
    "vitriol",
    "oil of vitriol",
    "H₂SO₄",
    { H: 2, S: 1, O: 4 },
    "made",
    "liquid",
    1830,
    10,
    null,
    [0.9, 0.88, 0.7],
    "The acid of the chemists' works.",
  ),
  S(
    "zinc-oxide",
    "zinc oxide",
    "ZnO",
    { Zn: 1, O: 1 },
    "made",
    "solid",
    5610,
    1975,
    4.5,
    [0.96, 0.96, 0.94],
    "What roasting leaves of zinc blende: a white earth.",
  ),
  S(
    "black-powder",
    "black powder",
    "KNO₃ + C + S",
    BLACK_POWDER,
    "made",
    "solid",
    1700,
    null,
    null,
    [0.16, 0.16, 0.17],
    "Saltpetre, charcoal and sulphur ground wet together: lit, it burns all at once into hot gas and white smoke.",
  ),
  S(
    "potash-bisulphate",
    "bisulphate of potash",
    "KHSO₄",
    { K: 1, H: 1, S: 1, O: 4 },
    "made",
    "solid",
    2245,
    197,
    null,
    [0.95, 0.95, 0.93],
    "What is left in the retort when the acid is drawn from saltpetre.",
  ),
  S(
    "nitric-acid",
    "nitric acid",
    "HNO₃",
    { H: 1, N: 1, O: 3 },
    "made",
    "liquid",
    1510,
    -42,
    null,
    [0.95, 0.93, 0.8],
    "Aqua fortis: it eats copper and silver, and makes cotton into gun cotton.",
  ),
  S(
    "nitrocellulose",
    "gun cotton",
    "C₆H₇(NO₂)₃O₅",
    { C: 6, H: 7, N: 3, O: 11 },
    "made",
    "solid",
    1500,
    null,
    null,
    [0.94, 0.93, 0.88],
    "Cotton steeped in nitric acid: smokeless powder, burning three times as strong as black and leaving no smoke to give a rifleman away.",
  ),
  S(
    "potassium-sulphide",
    "sulphide of potash",
    "K₂S",
    { K: 2, S: 1 },
    "made",
    "solid",
    1740,
    840,
    null,
    [0.8, 0.72, 0.5],
    "Part of the foul white smoke a black-powder gun leaves hanging.",
  ),
];

export const SUBSTANCE: Readonly<Record<string, number>> = Object.fromEntries(
  SUBSTANCES.map((s, i) => [s.id, i]),
);

/**
 * Substances of worlds of their own chemistry (Phase 54): their ores, metals and stones Earth's
 * tables never held, beside Earth's (a world's own lists say which of them it has).
 */
export const NOVEL_SUBSTANCES: readonly Substance[] = [
  // Metals and their alloys, with the native iron and the carbide that give them.
  S(
    "nickel",
    "nickel",
    "Ni",
    { Ni: 1 },
    "metal",
    "solid",
    8908,
    1455,
    4,
    [0.72, 0.71, 0.66],
    "A hard silvery metal won from green ore at a bloomery's heat: a quarter of it in copper makes a white alloy that does not rust.",
  ),
  S(
    "arsenic",
    "arsenic",
    "As",
    { As: 1 },
    "metal",
    "solid",
    5727,
    null,
    3.5,
    [0.45, 0.46, 0.47],
    "Grey and brittle, it smells of garlic when heated and goes off as a poisonous smoke: of no use alone, and kept well away from food.",
  ),
  S(
    "cupronickel",
    "cupronickel",
    "Cu + Ni",
    CUPRONICKEL,
    "metal",
    "solid",
    8940,
    1210,
    3.5,
    [0.78, 0.76, 0.72],
    "Copper and nickel melted as one: a white metal, harder than copper, that keeps its shine in damp air.",
  ),
  S(
    "arsenical-copper",
    "arsenical copper",
    "Cu + As",
    ARSENICAL,
    "metal",
    "solid",
    8800,
    1060,
    3,
    [0.8, 0.6, 0.45],
    "Copper with four parts in a hundred of arsenic, where there is no tin: harder than copper, and it casts sharp into a mould.",
  ),
  S(
    "telluric-iron",
    "telluric iron",
    "Fe + C",
    TELLURIC,
    "ore",
    "solid",
    7800,
    1400,
    4.5,
    [0.48, 0.48, 0.5],
    "Native iron of the ground itself, where basalt flowed through buried coal and was robbed of its oxygen: lumps of metal no smith had to smelt.",
  ),
  S(
    "cohenite",
    "cohenite",
    "(Fe,Ni)₃C",
    { Fe: 2.85, Ni: 0.15, C: 1 },
    "mineral",
    "solid",
    7200,
    null,
    5.5,
    [0.6, 0.6, 0.55],
    "A carbide of iron and nickel, hard and brittle, that holds its carbon fast in the rock: it breaks down before it will melt.",
  ),
  S(
    "cohenite-iron",
    "cohenite iron",
    "Fe + C",
    COHENITE_IRON,
    "metal",
    "solid",
    7600,
    1250,
    5.5,
    [0.42, 0.42, 0.45],
    "Iron that has drunk three parts in a hundred of carbon from a rich charcoal fire: it pours into moulds, but shatters under the hammer.",
  ),
  // Ores of copper, iron, nickel and arsenic, and what their roasts leave.
  S(
    "native-copper",
    "native copper",
    "Cu",
    { Cu: 1 },
    "ore",
    "solid",
    8960,
    1085,
    3,
    [0.72, 0.42, 0.24],
    "Copper lying in lumps and threads in the rock, the metal itself and no ore: it wants melting, not smelting.",
  ),
  S(
    "chalcocite",
    "chalcocite",
    "Cu₂S",
    { Cu: 2, S: 1 },
    "ore",
    "solid",
    5600,
    1130,
    2.75,
    [0.2, 0.2, 0.22],
    "Dark, heavy copper glance, with its sulphur still bound in: it must be run molten and blown before it gives up its copper.",
  ),
  S(
    "siderite",
    "siderite",
    "FeCO₃",
    { Fe: 1, C: 1, O: 3 },
    "ore",
    "solid",
    3960,
    null,
    4,
    [0.55, 0.47, 0.35],
    "Brown iron carbonate settled out of marsh water or laid in beds among the shales: it calcines in a fire and gives up its iron more easily than the black ore does.",
  ),
  S(
    "garnierite",
    "garnierite",
    "(Ni,Mg)₃Si₂O₅(OH)₄",
    { Ni: 1.5, Mg: 1.5, Si: 2, O: 9, H: 4 },
    "ore",
    "solid",
    2700,
    null,
    2.5,
    [0.3, 0.62, 0.38],
    "Soft green earth of weathered rock, rich in nickel: its silica must be broken down by a bloomery's heat before the metal comes.",
  ),
  S(
    "arsenopyrite",
    "arsenopyrite",
    "FeAsS",
    { Fe: 1, As: 1, S: 1 },
    "ore",
    "solid",
    6070,
    null,
    5.75,
    [0.75, 0.74, 0.7],
    "Silvery mineral of iron, arsenic and sulphur: roasted in air it smokes out its arsenic and sulphur, and leaves iron behind.",
  ),
  S(
    "white-arsenic",
    "white arsenic",
    "As₂O₃",
    { As: 2, O: 3 },
    "made",
    "solid",
    3740,
    312,
    1.5,
    [0.95, 0.95, 0.93],
    "The white powder a roast drives up into the cooler flues: a deadly poison, and used to clear glass.",
  ),
  S(
    "tennantite",
    "tennantite",
    "Cu₁₂As₄S₁₃",
    { Cu: 12, As: 4, S: 13 },
    "ore",
    "solid",
    4620,
    null,
    3.75,
    [0.25, 0.26, 0.28],
    "Grey copper ore with arsenic and sulphur bound in: heavy, and roasted in air it gives copper and poisonous smoke.",
  ),
  // Stones and minerals of the other rocks.
  S(
    "moissanite",
    "moissanite",
    "SiC",
    { Si: 1, C: 1 },
    "mineral",
    "solid",
    3210,
    null,
    9.25,
    [0.18, 0.3, 0.26],
    "Crystals of silicon and carbon, found in the hot deep and in fallen stars: nearly as hard as diamond, and it cuts glass.",
  ),
  S(
    "graphite",
    "graphite",
    "C",
    { C: 1 },
    "mineral",
    "solid",
    2260,
    null,
    1.5,
    [0.15, 0.15, 0.16],
    "Soft black carbon in flakes that mark the hand and slide over one another: it draws a grey line, and greases what rubs on it.",
  ),
  S(
    "nephrite",
    "nephrite",
    "Ca₂Mg₅Si₈O₂₂(OH)₂",
    { Ca: 2, Mg: 5, Si: 8, O: 24, H: 2 },
    "mineral",
    "solid",
    3000,
    null,
    6.25,
    [0.36, 0.52, 0.38],
    "Tough green stone of the rivers, knit so close that a blow will not chip it: the axe-stone of a people with no metal.",
  ),
  S(
    "corundum",
    "corundum",
    "Al₂O₃",
    { Al: 2, O: 3 },
    "mineral",
    "solid",
    4020,
    2044,
    9,
    [0.48, 0.47, 0.5],
    "Alumina in hard grey-blue crystals, found in river gravels and old lava: it cuts and grinds every stone but the diamond.",
  ),
  S(
    "tachylite",
    "tachylite",
    "basaltic glass",
    { Si: 1, Al: 0.3, Mg: 0.25, Fe: 0.2, Ca: 0.2, Na: 0.05, O: 3.125 },
    "mineral",
    "solid",
    2800,
    1100,
    5.5,
    [0.08, 0.07, 0.07],
    "Black glass of basalt, chilled in a moment at the edge of a flow: it breaks like obsidian, and less keenly.",
  ),
  S(
    "dolomite",
    "dolomite",
    "CaMg(CO₃)₂",
    { Ca: 1, Mg: 1, C: 2, O: 6 },
    "mineral",
    "solid",
    2840,
    null,
    3.75,
    [0.88, 0.86, 0.8],
    "Limestone with magnesia in it: a pale stone of old reefs that fizzes only slowly in acid, where limestone fizzes at once.",
  ),
];

/** A substance's weight a mole (grams). */
export function molarMass(formula: Readonly<Record<string, number>>): number {
  let m = 0;
  for (const [e, n] of Object.entries(formula)) m += n * MASS[e]!;
  return m;
}

/** A substance's elements, each as a share of its weight. */
export function elementShares(s: Substance): [string, number][] {
  const m = molarMass(s.formula);
  return Object.entries(s.formula)
    .map(([e, n]) => [e, (n * MASS[e]!) / m] as [string, number])
    .sort((a, b) => b[1] - a[1]);
}

/** A reaction: what goes in and comes out (moles of each substance), and what it takes. */
export type Reaction = {
  readonly id: string;
  readonly name: string;
  readonly inputs: readonly (readonly [string, number])[];
  readonly outputs: readonly (readonly [string, number])[];
  /** The heat it wants (°C), and what gives it (a substance burned), if any. */
  readonly heat: number | null;
  readonly fuel: string | null;
  /** The principle that teaches it (null: known from the first). */
  readonly principle: string | null;
  /** The recipe that works it (rules/goods.ts), if one does. */
  readonly recipe: string | null;
  readonly words: string;
};

export const REACTIONS: readonly Reaction[] = [
  {
    id: "smelt-malachite",
    name: "smelting malachite",
    inputs: [
      ["malachite", 1],
      ["carbon", 1],
    ],
    outputs: [
      ["copper", 2],
      ["co2", 2],
      ["steam", 1],
    ],
    heat: 1100,
    fuel: "carbon",
    principle: "metalworking",
    recipe: "copper-smelting",
    words:
      "Green ore and charcoal in a hot fire: the charcoal takes the ore's oxygen, and copper runs out.",
  },
  {
    id: "roast-chalcopyrite",
    name: "roasting chalcopyrite",
    inputs: [
      ["chalcopyrite", 2],
      ["oxygen", 5],
    ],
    outputs: [
      ["copper", 2],
      ["slag", 2],
      ["so2", 4],
    ],
    heat: 1200,
    fuel: "carbon",
    principle: "metalworking",
    recipe: "copper-smelting",
    words:
      "Brassy ore roasted in air: its sulphur goes up as sour smoke, its iron into slag, and copper is left.",
  },
  {
    id: "smelt-cassiterite",
    name: "smelting cassiterite",
    inputs: [
      ["cassiterite", 1],
      ["carbon", 1],
    ],
    outputs: [
      ["tin", 1],
      ["co2", 1],
    ],
    heat: 1000,
    fuel: "carbon",
    principle: "bronze",
    recipe: "tin-smelting",
    words: "Black tin ore and charcoal: tin, at a heat a copper-smith's fire already gives.",
  },
  {
    id: "alloy-bronze",
    name: "alloying bronze",
    inputs: [
      ["copper", BRONZE.Cu],
      ["tin", BRONZE.Sn],
    ],
    outputs: [["bronze", 1]],
    heat: 950,
    fuel: "carbon",
    principle: "bronze",
    recipe: "bronze-tools",
    words: "A tenth of tin melted into copper: bronze, harder than either.",
  },
  {
    id: "bloomery",
    name: "the bloomery",
    inputs: [
      ["hematite", 2],
      ["carbon", 3],
    ],
    outputs: [
      ["iron", 4],
      ["co2", 3],
    ],
    heat: 1200,
    fuel: "carbon",
    principle: "iron",
    recipe: "iron-smelting",
    words:
      "Red ore and charcoal in a clay stack blown by bellows: a spongy bloom of iron, hammered free of slag.",
  },
  {
    id: "bog-bloomery",
    name: "smelting bog ore",
    inputs: [
      ["limonite", 4],
      ["carbon", 3],
    ],
    outputs: [
      ["iron", 4],
      ["co2", 3],
      ["steam", 2],
    ],
    heat: 1150,
    fuel: "carbon",
    principle: "iron",
    recipe: "iron-smelting",
    words:
      "Bog ore roasted, then smelted with charcoal in a clay furnace by the marsh: a small bloom of soft iron, hammered and folded to drive its slag out.",
  },
  {
    id: "smelt-magnetite",
    name: "smelting magnetite",
    inputs: [
      ["magnetite", 1],
      ["carbon", 2],
    ],
    outputs: [
      ["iron", 3],
      ["co2", 2],
    ],
    heat: 1250,
    fuel: "carbon",
    principle: "iron",
    recipe: "iron-smelting",
    words: "Black ore and charcoal: iron, as from the red.",
  },
  {
    id: "carburise",
    name: "steeling iron",
    inputs: [
      ["iron", STEEL.Fe],
      ["carbon", STEEL.C],
    ],
    outputs: [["steel", 1]],
    heat: 1100,
    fuel: "carbon",
    principle: "steel",
    recipe: "steel-tools",
    words:
      "Iron kept hot in charcoal takes a little carbon into itself: steel, to be quenched hard.",
  },
  // Later arms (Phase 53 M219): brass for cartridges, powders for their charge.
  {
    id: "roast-sphalerite",
    name: "roasting zinc blende",
    inputs: [
      ["sphalerite", 2],
      ["oxygen", 3],
    ],
    outputs: [
      ["zinc-oxide", 2],
      ["so2", 2],
    ],
    heat: 900,
    fuel: "carbon",
    principle: "repeating-fire",
    recipe: null,
    words: "Zinc blende roasted in air: its sulphur goes up as smoke and a white earth is left.",
  },
  {
    id: "smelt-zinc",
    name: "smelting zinc",
    inputs: [
      ["zinc-oxide", 2],
      ["carbon", 1],
    ],
    outputs: [
      ["zinc", 2],
      ["co2", 1],
    ],
    heat: 1100,
    fuel: "carbon",
    principle: "repeating-fire",
    recipe: null,
    words:
      "The white earth and charcoal shut in a retort: the zinc boils off and is caught as it cools.",
  },
  {
    id: "alloy-brass",
    name: "alloying brass",
    inputs: [
      ["copper", BRASS.Cu],
      ["zinc", BRASS.Zn],
    ],
    outputs: [["brass", 1]],
    heat: 950,
    fuel: "carbon",
    principle: "repeating-fire",
    recipe: null,
    words: "Copper melted and zinc stirred in under charcoal, before it can burn away.",
  },
  {
    id: "mix-black-powder",
    name: "milling black powder",
    inputs: [
      ["saltpetre", 0.7418],
      ["carbon", 1.2489],
      ["sulphur", 0.3119],
    ],
    outputs: [["black-powder", 1]],
    heat: null,
    fuel: null,
    principle: "gunpowder",
    recipe: null,
    words:
      "Saltpetre, charcoal and sulphur ground together wet, pressed into cake and broken into grains.",
  },
  {
    id: "fire-black-powder",
    name: "black powder burning",
    inputs: [
      ["saltpetre", 2],
      ["sulphur", 1],
      ["carbon", 3],
    ],
    outputs: [
      ["potassium-sulphide", 1],
      ["nitrogen", 1],
      ["co2", 3],
    ],
    heat: 300,
    fuel: null,
    principle: "gunpowder",
    recipe: null,
    words:
      "Lit in the breech, it turns in an instant to gas that drives the ball, and the white smoke hangs over the line.",
  },
  {
    id: "burn-sulphur",
    name: "burning sulphur",
    inputs: [
      ["sulphur", 1],
      ["oxygen", 1],
    ],
    outputs: [["so2", 1]],
    heat: 250,
    fuel: null,
    principle: "self-loading",
    recipe: null,
    words: "Brimstone burned in a draught.",
  },
  {
    id: "lead-chamber",
    name: "making oil of vitriol",
    inputs: [
      ["so2", 2],
      ["oxygen", 1],
      ["water", 2],
    ],
    outputs: [["vitriol", 2]],
    heat: null,
    fuel: null,
    principle: "self-loading",
    recipe: null,
    words:
      "Sulphur's smoke with steam and air in chambers lined with lead: the acid gathers on the floor.",
  },
  {
    id: "draw-nitric-acid",
    name: "drawing nitric acid",
    inputs: [
      ["saltpetre", 1],
      ["vitriol", 1],
    ],
    outputs: [
      ["nitric-acid", 1],
      ["potash-bisulphate", 1],
    ],
    heat: 120,
    fuel: "carbon",
    principle: "self-loading",
    recipe: null,
    words: "Saltpetre warmed with oil of vitriol: nitric acid distils over.",
  },
  {
    id: "nitrate-cellulose",
    name: "making gun cotton",
    inputs: [
      ["cellulose", 1],
      ["nitric-acid", 3],
    ],
    outputs: [
      ["nitrocellulose", 1],
      ["water", 3],
    ],
    heat: null,
    fuel: null,
    principle: "self-loading",
    recipe: null,
    words: "Cotton steeped in nitric acid and washed: gun cotton, the smokeless powder.",
  },
  {
    id: "char-wood",
    name: "charring wood",
    inputs: [["cellulose", 1]],
    outputs: [
      ["carbon", 6],
      ["steam", 5],
    ],
    heat: 400,
    fuel: null,
    principle: "metalworking",
    recipe: null,
    words: "Wood smothered in a mound of earth and let smoulder: its water goes, its carbon stays.",
  },
  {
    id: "burn-carbon",
    name: "burning charcoal or coal",
    inputs: [
      ["carbon", 1],
      ["oxygen", 1],
    ],
    outputs: [["co2", 1]],
    heat: null,
    fuel: null,
    principle: null,
    recipe: null,
    words: "Carbon and the air's oxygen: heat, and carbon dioxide into the air.",
  },
  {
    id: "burn-wood",
    name: "burning wood",
    inputs: [
      ["cellulose", 1],
      ["oxygen", 6],
    ],
    outputs: [
      ["co2", 6],
      ["steam", 5],
    ],
    heat: null,
    fuel: null,
    principle: null,
    recipe: null,
    words: "The first fire: wood and air to heat, smoke and ash.",
  },
  {
    id: "burn-oil",
    name: "burning oil",
    inputs: [
      ["crude", 2],
      ["oxygen", 37],
    ],
    outputs: [
      ["co2", 24],
      ["steam", 26],
    ],
    heat: null,
    fuel: null,
    principle: "engines",
    recipe: null,
    words: "What drives the engine: oil and air, to heat and carbon dioxide.",
  },
  {
    id: "burn-lime",
    name: "burning lime",
    inputs: [["calcite", 1]],
    outputs: [
      ["quicklime", 1],
      ["co2", 1],
    ],
    heat: 900,
    fuel: "carbon",
    principle: "masonry",
    recipe: null,
    words: "Limestone burned in a kiln: quicklime for mortar, and the stone's carbon to the air.",
  },
  {
    id: "fire-clay",
    name: "firing clay",
    inputs: [["kaolinite", 1]],
    outputs: [
      ["fired-clay", 1],
      ["steam", 2],
    ],
    heat: 800,
    fuel: "cellulose",
    principle: null,
    recipe: "pottery",
    words:
      "Clay shaped and fired: the water bound in it is driven out, and it cannot soften again.",
  },
  {
    id: "melt-glass",
    name: "melting glass",
    inputs: [
      ["quartz", 6],
      ["natron", 1],
      ["calcite", 1],
    ],
    outputs: [
      ["glass", 1],
      ["co2", 2],
    ],
    heat: 1100,
    fuel: "carbon",
    principle: "glass",
    recipe: null,
    words: "Sand with soda and lime, melted: glass.",
  },
  {
    id: "tan",
    name: "tanning",
    inputs: [
      ["collagen", 1],
      ["tannin", LEATHER_TANNIN],
    ],
    outputs: [["leather", 1]],
    heat: null,
    fuel: null,
    principle: "tanning",
    recipe: "leatherwork",
    words: "Hides steeped for months in bark-water: the tannin binds the skin so it will not rot.",
  },
  {
    id: "ferment",
    name: "fermenting",
    inputs: [["sugar", 1]],
    outputs: [
      ["ethanol", 2],
      ["co2", 2],
    ],
    heat: null,
    fuel: null,
    principle: "brewing",
    recipe: null,
    words: "Yeast in sweet mash or juice: alcohol, and bubbles of carbon dioxide.",
  },
  {
    id: "boil-brine",
    name: "boiling brine",
    inputs: [
      ["halite", 1],
      ["water", 10],
    ],
    outputs: [
      ["halite", 1],
      ["steam", 10],
    ],
    heat: 100,
    fuel: "cellulose",
    principle: "salting",
    recipe: null,
    words: "Sea water or a salt spring boiled down in pans: salt, to keep meat through the winter.",
  },
  {
    id: "part-copper",
    name: "parting copper by current",
    inputs: [
      ["blue-vitriol", 1],
      ["water", 1],
    ],
    outputs: [
      ["copper", 1],
      ["vitriol", 1],
      ["oxygen", 0.5],
    ],
    heat: null,
    fuel: null,
    principle: "electrochemistry",
    recipe: null,
    words: "A current through copper in acid lays down copper pure on the plate.",
  },
  {
    id: "photosynthesis",
    name: "the green leaf's making",
    inputs: [
      ["co2", 6],
      ["water", 6],
    ],
    outputs: [
      ["sugar", 1],
      ["oxygen", 6],
    ],
    heat: null,
    fuel: null,
    principle: "cultivation",
    recipe: null,
    words: "Sunlight on a leaf: the air's carbon and water made into sugar, and oxygen given back.",
  },
  {
    id: "breath",
    name: "the body's burning",
    inputs: [
      ["sugar", 1],
      ["oxygen", 6],
    ],
    outputs: [
      ["co2", 6],
      ["water", 6],
    ],
    heat: null,
    fuel: null,
    principle: null,
    recipe: null,
    words: "What every body does with its food: burns it slowly, for its warmth and its work.",
  },
];

export const REACTION: Readonly<Record<string, number>> = Object.fromEntries(
  REACTIONS.map((r, i) => [r.id, i]),
);

/** Reactions of worlds of their own chemistry (Phase 54): working the ores Earth's never held. */
export const NOVEL_REACTIONS: readonly Reaction[] = [
  // Copper from its native metal and its glance; nickel and the alloys of copper with it.
  {
    id: "melt-native-copper",
    name: "melting native copper",
    inputs: [["native-copper", 1]],
    outputs: [["copper", 1]],
    heat: 1085,
    fuel: "carbon",
    principle: "metalworking",
    recipe: "copper-smelting",
    words:
      "Lumps of native copper melted in a clay crucible: the metal runs out clean, with no ore to roast first.",
  },
  {
    id: "smelt-chalcocite",
    name: "smelting copper glance",
    inputs: [
      ["chalcocite", 1],
      ["oxygen", 1],
    ],
    outputs: [
      ["copper", 2],
      ["so2", 1],
    ],
    heat: 1150,
    fuel: "carbon",
    principle: "metalworking",
    recipe: "copper-smelting",
    words:
      "Copper glance roasted in a blast: its sulphur goes up as sour smoke, and the copper runs out molten.",
  },
  {
    id: "smelt-garnierite",
    name: "smelting garnierite",
    inputs: [
      ["garnierite", 1],
      ["carbon", 0.75],
    ],
    outputs: [
      ["nickel", 1.5],
      ["co2", 0.75],
      ["steam", 2],
      ["olivine", 0.75],
      ["quartz", 1.25],
    ],
    heat: 1250,
    fuel: "carbon",
    principle: "bronze",
    recipe: "tin-smelting",
    words:
      "Green nickel earth and charcoal in a bloomery's heat: the nickel runs free, and its silica and magnesia are left as stone.",
  },
  {
    id: "alloy-cupronickel",
    name: "alloying cupronickel",
    inputs: [
      ["copper", CUPRONICKEL.Cu],
      ["nickel", CUPRONICKEL.Ni],
    ],
    outputs: [["cupronickel", 1]],
    heat: 1250,
    fuel: "carbon",
    principle: "bronze",
    recipe: "bronze-tools",
    words:
      "Copper and nickel melted together in a crucible: cupronickel, white and bright, with no tin needed.",
  },
  // Arsenic from the roasts of its ores, and copper hardened with it.
  {
    id: "roast-arsenopyrite",
    name: "roasting arsenopyrite",
    inputs: [
      ["arsenopyrite", 2],
      ["oxygen", 5],
    ],
    outputs: [
      ["white-arsenic", 1],
      ["hematite", 1],
      ["so2", 2],
    ],
    heat: 700,
    fuel: "carbon",
    principle: "bronze",
    recipe: "tin-smelting",
    words:
      "Arsenopyrite roasted in a draught: its arsenic goes off as white poison, its sulphur as sour smoke, and its iron is left as red ore.",
  },
  {
    id: "alloy-arsenical",
    name: "alloying arsenical copper",
    inputs: [
      ["copper", ARSENICAL.Cu],
      ["white-arsenic", ARSENICAL.As / 2],
      ["carbon", 0.75 * ARSENICAL.As],
    ],
    outputs: [
      ["arsenical-copper", 1],
      ["co2", 0.75 * ARSENICAL.As],
    ],
    heat: 1100,
    fuel: "carbon",
    principle: "bronze",
    recipe: "bronze-tools",
    words:
      "Copper melted with white arsenic and charcoal: the charcoal takes the arsenic's oxygen away, and the arsenic stays in the copper.",
  },
  {
    id: "roast-tennantite",
    name: "roasting tennantite",
    inputs: [
      ["tennantite", 1],
      ["oxygen", 16],
    ],
    outputs: [
      ["copper", 12],
      ["white-arsenic", 2],
      ["so2", 13],
    ],
    heat: 1100,
    fuel: "carbon",
    principle: "bronze",
    recipe: "tin-smelting",
    words:
      "Grey copper ore roasted in a draught: the copper is left, and its arsenic and sulphur go up as smoke.",
  },
  // Iron from carbonate and native ores, and the carbon-rich bloom.
  {
    id: "smelt-siderite",
    name: "smelting siderite",
    inputs: [
      ["siderite", 2],
      ["carbon", 1],
    ],
    outputs: [
      ["iron", 2],
      ["co2", 3],
    ],
    heat: 1150,
    fuel: "carbon",
    principle: "iron",
    recipe: "iron-smelting",
    words:
      "Brown iron carbonate calcined and burned with charcoal: its iron is left, and its carbon goes up with the smoke.",
  },
  {
    id: "forge-telluric",
    name: "forging native iron",
    inputs: [
      ["telluric-iron", 1],
      ["oxygen", 0.1],
    ],
    outputs: [
      ["iron", 0.9],
      ["co2", 0.1],
    ],
    heat: 1000,
    fuel: "carbon",
    principle: "iron",
    recipe: "iron-smelting",
    words:
      "Native iron worked in a hearth with a breath of air: the coal's carbon burns out of it, and soft iron is left.",
  },
  {
    id: "carbide-bloomery",
    name: "the carbon-rich bloomery",
    inputs: [
      ["magnetite", 1],
      ["carbon", 2 + (3 * COHENITE_IRON.C) / COHENITE_IRON.Fe],
    ],
    outputs: [
      ["cohenite-iron", 3 / COHENITE_IRON.Fe],
      ["co2", 2],
    ],
    heat: 1250,
    fuel: "carbon",
    principle: "iron",
    recipe: "iron-smelting",
    words:
      "Black ore smelted with more charcoal than the iron can hold: the metal drinks the carbon and runs out pouring like water.",
  },
];

// —— The kinds' matter (Phase 56) ————————————————————————————————————————————————————————

/** A blend of so many grams of each formula, as the atoms of the hundred grams it makes. */
const blend = (
  parts: readonly (readonly [Readonly<Record<string, number>>, number])[],
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [f, grams] of parts) {
    const moles = grams / molarMass(f);
    for (const [e, n] of Object.entries(f)) out[e] = (out[e] ?? 0) + n * moles;
  }
  return out;
};
const SIC = { Si: 1, C: 1 },
  QUARTZ = { Si: 1, O: 2 },
  /** Pitch: about one carbon to one and a half hydrogen. */
  BITUMEN = { C: 1, H: 1.5 },
  /** Acid water: a tenth of sulfuric acid in water, by weight. */
  ACID_WATER = blend([
    [{ H: 2, S: 1, O: 4 }, 10],
    [{ H: 2, O: 1 }, 90],
  ]),
  /** Sulfur concrete: a quarter sulfur, three quarters quartz grit, by weight. */
  SULFUR_CONCRETE = blend([
    [{ S: 1 }, 25],
    [QUARTZ, 75],
  ]),
  /** Pitch and grit: carborundum grit with six hundredths of pitch, by weight. */
  PITCH_GRIT = blend([
    [BITUMEN, 6],
    [SIC, 94],
  ]),
  /** What blowing carbide iron with oxygen burns out of it, a mole of it to steel (as carbon monoxide). */
  BURNT_OUT = COHENITE_IRON.C - (STEEL.C * COHENITE_IRON.Fe) / STEEL.Fe;

/**
 * Substances of the kinds of world (Phase 56): their liquids and airs, their ices and tars, the
 * stones and walls they are worked into — beside Earth's and Phase 54's (a world's own lists say
 * which of them it has).
 */
export const KIND_SUBSTANCES: readonly Substance[] = [
  // Ices and the cold worlds' liquids.
  S(
    "water-ice",
    "ice",
    "H₂O",
    { H: 2, O: 1 },
    "mineral",
    "solid",
    917,
    0,
    2,
    [0.84, 0.92, 0.98],
    "Water frozen, soft at its melting but harder the colder it is: about Mohs 6 at −78 °C, and as hard as granite at −180 °C.",
  ),
  S(
    "ammonia",
    "ammonia",
    "NH₃",
    { N: 1, H: 3 },
    "gas",
    "gas",
    0.73,
    -78,
    null,
    [0.92, 0.95, 0.98],
    "A sharp-smelling gas of nitrogen and hydrogen, which water takes up so that the two stay liquid far below water's freezing.",
  ),
  S(
    "ammonia-water",
    "ammonia water",
    "NH₃·2H₂O",
    { N: 1, H: 7, O: 2 },
    "water",
    "liquid",
    930,
    -97,
    null,
    [0.72, 0.84, 0.9],
    "Water a third of whose weight is ammonia: it freezes only at −97 °C, and fills the seas of an ice-and-ammonia world.",
  ),
  S(
    "ammonia-hydrate",
    "ammonia ice",
    "NH₃·H₂O",
    { N: 1, H: 5, O: 1 },
    "mineral",
    "solid",
    960,
    -79,
    2,
    [0.86, 0.9, 0.93],
    "Ammonia and water frozen together: the pale beds an ammonia sea leaves where it freezes.",
  ),
  S(
    "methane",
    "methane",
    "CH₄",
    { C: 1, H: 4 },
    "gas",
    "gas",
    0.68,
    -182,
    null,
    [0.86, 0.88, 0.9],
    "The simplest of the hydrocarbons, a gas on Earth, which on a world at −180 °C rains, runs in rivers and fills seas.",
  ),
  S(
    "ethane",
    "ethane",
    "C₂H₆",
    { C: 2, H: 6 },
    "gas",
    "gas",
    1.28,
    -183,
    null,
    [0.84, 0.86, 0.88],
    "Methane's next of kin, made of it by sunlight high in a cold world's air: it gathers in the seas and does not dry away.",
  ),
  S(
    "acetylene",
    "acetylene",
    "C₂H₂",
    { C: 2, H: 2 },
    "gas",
    "gas",
    1.1,
    -81,
    null,
    [0.9, 0.9, 0.86],
    "A gas sunlight makes of methane high in the air, which joined with hydrogen gives back methane and heat: a cold world's fuel.",
  ),
  S(
    "hydrogen",
    "hydrogen",
    "H₂",
    { H: 2 },
    "gas",
    "gas",
    0.084,
    -259,
    null,
    [0.95, 0.95, 1],
    "The lightest gas, which sunlight splits from methane to drift in a cold world's air.",
  ),
  S(
    "tholin",
    "tholin",
    "about (C₄H₄N₂)ₙ",
    { C: 4, H: 4, N: 2 },
    "mineral",
    "solid",
    1350,
    null,
    1.5,
    [0.66, 0.4, 0.18],
    "The orange-brown tar sunlight makes of methane and nitrogen high in a cold world's air, which falls as dust, drifts into dunes and can be worked into a tough polymer.",
  ),
  S(
    "polyacetylene",
    "conducting polymer",
    "(C₂H₂)ₙ",
    { C: 2, H: 2 },
    "made",
    "solid",
    1200,
    null,
    1.5,
    [0.3, 0.3, 0.36],
    "Acetylene joined end to end into long chains and doped, which carries a current as a metal wire does (Shirakawa, MacDiarmid and Heeger, 1977).",
  ),
  // A carbon world's.
  S(
    "diamond",
    "diamond",
    "C",
    { C: 1 },
    "mineral",
    "solid",
    3510,
    null,
    10,
    [0.9, 0.92, 0.95],
    "Carbon pressed deep below a carbon world's crust into the hardest of all stones, whose grit grinds every other edge keen.",
  ),
  S(
    "carbon-monoxide",
    "carbon monoxide",
    "CO",
    { C: 1, O: 1 },
    "gas",
    "gas",
    1.25,
    -205,
    null,
    [0.82, 0.82, 0.84],
    "Carbon holding one oxygen: on a carbon world nearly all its oxygen is held so, and none is left to burn with.",
  ),
  S(
    "bitumen",
    "pitch",
    "about (CH₁.₅)ₙ",
    BITUMEN,
    "fuel",
    "solid",
    1050,
    null,
    1,
    [0.08, 0.08, 0.08],
    "The black tar of a carbon world's seeps, which softens in the sun and binds grit into walls.",
  ),
  S(
    "pitch-grit",
    "pitch and grit",
    "SiC + (CH₁.₅)ₙ",
    PITCH_GRIT,
    "made",
    "solid",
    2450,
    null,
    3,
    [0.2, 0.2, 0.21],
    "Carborundum grit bound in six hundredths of pitch, worked warm in the sun: a carbon world's walls and roads.",
  ),
  // A sulfur world's.
  S(
    "acid-water",
    "acid water",
    "H₂SO₄ + H₂O",
    ACID_WATER,
    "water",
    "liquid",
    1066,
    -5,
    null,
    [0.74, 0.84, 0.56],
    "Water soured with a tenth of sulfuric acid: the seas of a sulfur-volcano world, which eat limestone and leave gypsum.",
  ),
  S(
    "gypsum",
    "gypsum",
    "CaSO₄·2H₂O",
    { Ca: 1, S: 1, O: 6, H: 4 },
    "mineral",
    "solid",
    2320,
    null,
    2,
    [0.94, 0.92, 0.88],
    "Calcium sulfate with water in it: the white beds acid seas leave where they dry, too soft to take an edge.",
  ),
  S(
    "sulfur-concrete",
    "sulfur concrete",
    "S + SiO₂",
    SULFUR_CONCRETE,
    "made",
    "solid",
    2450,
    119,
    3,
    [0.82, 0.78, 0.48],
    "Grit stirred into sulfur melted at 140 °C, which sets hard as it cools and which acid does not eat.",
  ),
];

/** The kinds' reactions (Phase 56): what each kind does in place of what it cannot. */
export const KIND_REACTIONS: readonly Reaction[] = [
  {
    id: "cold-hammer-copper",
    name: "hammering native copper cold",
    inputs: [["native-copper", 1]],
    outputs: [["copper", 1]],
    heat: null,
    fuel: null,
    principle: "cold-hammering",
    recipe: "copper-smelting",
    words:
      "Native copper beaten into shape cold on an anvil stone and never heated, since nothing burns in a carbon world's air.",
  },
  {
    id: "reduce-vitriol",
    name: "reducing blue vitriol",
    inputs: [
      ["blue-vitriol", 1],
      ["carbon", 1],
    ],
    outputs: [
      ["copper", 1],
      ["so2", 1],
      ["co2", 1],
    ],
    heat: 650,
    fuel: "carbon",
    principle: "acid-leaching",
    recipe: "copper-smelting",
    words:
      "Blue vitriol, left by acid springs running over copper ore, heated with charcoal in an open fire (some 650 °C, within reach of a fire in thin air): its sulfur and oxygen go up as smoke and a spongy copper is left, with no smelting furnace.",
  },
  {
    id: "acetylene-hydrogen",
    name: "joining acetylene with hydrogen",
    inputs: [
      ["acetylene", 1],
      ["hydrogen", 3],
    ],
    outputs: [["methane", 2]],
    heat: null,
    fuel: null,
    principle: "cold-chemistry",
    recipe: null,
    words:
      "Acetylene and hydrogen from the air joined over grit of nickel-iron fallen from the sky (as Sabatier joined them over nickel) into methane, giving about 377 kJ for each mole of acetylene: the energy of a world with no oxygen (McKay & Smith 2005).",
  },
  {
    id: "haze-tholin",
    name: "the haze's tholin",
    inputs: [
      ["methane", 4],
      ["nitrogen", 1],
    ],
    outputs: [
      ["tholin", 1],
      ["hydrogen", 6],
    ],
    heat: null,
    fuel: null,
    principle: null,
    recipe: null,
    words:
      "Sunlight breaks methane and nitrogen apart high in the air, and they join again as tholin, the orange haze that falls as dust and drifts into dunes.",
  },
  {
    id: "haze-acetylene",
    name: "the haze's acetylene",
    inputs: [["methane", 2]],
    outputs: [
      ["acetylene", 1],
      ["hydrogen", 3],
    ],
    heat: null,
    fuel: null,
    principle: null,
    recipe: null,
    words:
      "Sunlight high in the air takes hydrogen from methane, leaving acetylene to fall to the ground below.",
  },
  {
    id: "freeze-ice",
    name: "setting ice",
    inputs: [["water", 1]],
    outputs: [["water-ice", 1]],
    heat: null,
    fuel: null,
    principle: "ice-working",
    recipe: null,
    words:
      "Blocks of ice cut and set with water that freezes as it is poured, and blades split from the ice and edged by melting: in the cold, ice is as hard as stone.",
  },
  {
    id: "polymerise-acetylene",
    name: "drawing acetylene into a conducting polymer",
    inputs: [["acetylene", 1]],
    outputs: [["polyacetylene", 1]],
    heat: null,
    fuel: null,
    principle: "polymer-wire",
    recipe: null,
    words:
      "Acetylene joined end to end into long chains over a catalyst, drawn into fibres and doped: a wire that carries a current with no metal in it.",
  },
  {
    id: "sulfur-concrete",
    name: "pouring sulfur concrete",
    inputs: [
      ["sulphur", SULFUR_CONCRETE.S!],
      ["quartz", SULFUR_CONCRETE.Si!],
    ],
    outputs: [["sulfur-concrete", 1]],
    heat: 140,
    fuel: "carbon",
    principle: "sulfur-concrete",
    recipe: null,
    words:
      "Sulfur melted at 140 °C, grit stirred into it and poured into forms: a wall that sets as it cools.",
  },
  {
    id: "pitch-grit",
    name: "binding grit in pitch",
    inputs: [
      ["bitumen", 6 / molarMass(BITUMEN)],
      ["moissanite", 94 / molarMass(SIC)],
    ],
    outputs: [["pitch-grit", 1]],
    heat: null,
    fuel: null,
    principle: "diamond-grit",
    recipe: null,
    words:
      "Carborundum grit stirred into pitch softened in the sun, thinned with the world's own light oil: it sets into walls and roads.",
  },
  {
    id: "made-oxygen",
    name: "parting water by current",
    inputs: [["water", 2]],
    outputs: [
      ["hydrogen", 2],
      ["oxygen", 1],
    ],
    heat: null,
    fuel: null,
    principle: "made-oxygen",
    recipe: null,
    words:
      "Water parted by a current into hydrogen and oxygen: on a carbon world the only oxygen to burn with is what is made so.",
  },
  {
    id: "oxygen-steel",
    name: "blowing carbide iron with made oxygen",
    inputs: [
      ["cohenite-iron", 1],
      ["oxygen", BURNT_OUT / 2],
    ],
    outputs: [
      ["steel", COHENITE_IRON.Fe / STEEL.Fe],
      ["carbon-monoxide", BURNT_OUT],
    ],
    heat: 1550,
    fuel: null,
    principle: "made-oxygen",
    recipe: null,
    words:
      "Carbide iron melted in an arc and blown with made oxygen, its carbon burning out as carbon monoxide: the first fire a carbon world makes leaves its iron tough.",
  },
];

/** A substance by its id: Earth's first, then those of other chemistries, then the kinds' (Phase 56). */
export function findSubstance(id: string): Substance | undefined {
  const i = SUBSTANCE[id];
  return i === undefined
    ? (NOVEL_SUBSTANCES.find((s) => s.id === id) ?? KIND_SUBSTANCES.find((s) => s.id === id))
    : SUBSTANCES[i];
}

/** A reaction by its id: Earth's first, then those of other chemistries, then the kinds' (Phase 56). */
export function findReaction(id: string): Reaction | undefined {
  const i = REACTION[id];
  return i === undefined
    ? (NOVEL_REACTIONS.find((r) => r.id === id) ?? KIND_REACTIONS.find((r) => r.id === id))
    : REACTIONS[i];
}

/** An element by its symbol: Earth's first, then those of other chemistries. */
export function findElement(symbol: string): Element | undefined {
  return (
    ELEMENTS.find((e) => e.symbol === symbol) ?? NOVEL_ELEMENTS.find((e) => e.symbol === symbol)
  );
}

/** How far a reaction is from balancing: the largest difference in any element's atoms. */
export function imbalance(r: Reaction): number {
  const count = (side: readonly (readonly [string, number])[]) => {
    const out: Record<string, number> = {};
    for (const [id, n] of side) {
      const s = findSubstance(id)!;
      for (const [e, k] of Object.entries(s.formula)) out[e] = (out[e] ?? 0) + k * n;
    }
    return out;
  };
  const a = count(r.inputs),
    b = count(r.outputs);
  let worst = 0;
  for (const e of new Set([...Object.keys(a), ...Object.keys(b)]))
    worst = Math.max(worst, Math.abs((a[e] ?? 0) - (b[e] ?? 0)));
  return worst;
}

/** A reaction's sides in kilograms for each kilogram of its first output. */
export function reactionKg(r: Reaction): {
  inputs: [string, number][];
  outputs: [string, number][];
} {
  const kg = ([id, n]: readonly [string, number]): [string, number] => [
      id,
      (n * molarMass(findSubstance(id)!.formula)) / 1000,
    ],
    first = kg(r.outputs[0]!)[1],
    per = (x: [string, number]): [string, number] => [x[0], x[1] / first];
  return { inputs: r.inputs.map(kg).map(per), outputs: r.outputs.map(kg).map(per) };
}

/** What a good is made of, one way it is made: substances, each a share of its weight. */
export type MakeUp = {
  readonly id: string;
  readonly name: string;
  readonly parts: readonly (readonly [string, number])[];
};

/** A good as matter: the weight of a unit of it, and its make-up by each way it is made. */
export type GoodMatter = { readonly unitKg: number; readonly ways: readonly MakeUp[] };

/** Food's own make-up: water, starch, sugar, protein, fat, fibre and ash. */
const food = (w: number, st: number, su: number, p: number, f: number, fi: number, a: number) =>
  [
    ["water", w],
    ["starch", st],
    ["sugar", su],
    ["protein", p],
    ["fat", f],
    ["cellulose", fi],
    ["potash", a],
  ].filter(([, v]) => (v as number) > 0) as [string, number][];

/** A tool: its head of stone or metal on a haft of wood (two kilograms, a third of it wood). */
const tool = (id: string, name: string, head: string): MakeUp => ({
  id,
  name,
  parts: [
    [head, 0.65],
    ["cellulose", 0.35],
  ],
});

/** By the goods' ids (rules/goods.ts). */
export const GOOD_MATTER: Readonly<Record<string, GoodMatter>> = {
  // A unit of food is a person's food for a month.
  grain: {
    unitKg: 18,
    ways: [{ id: "grain", name: "grain", parts: food(0.12, 0.7, 0.01, 0.11, 0.02, 0.03, 0.01) }],
  },
  meat: {
    unitKg: 30,
    ways: [{ id: "meat", name: "meat and milk", parts: food(0.72, 0, 0.03, 0.14, 0.1, 0, 0.01) }],
  },
  wild: {
    unitKg: 26,
    ways: [
      {
        id: "wild",
        name: "roots, fruit, nuts and game",
        parts: food(0.62, 0.14, 0.07, 0.08, 0.04, 0.04, 0.01),
      },
    ],
  },
  wool: {
    unitKg: 2,
    ways: [
      {
        id: "fleece",
        name: "a fleece",
        parts: [
          ["keratin", 0.84],
          ["fat", 0.11],
          ["water", 0.05],
        ],
      },
    ],
  },
  hides: {
    unitKg: 10,
    ways: [
      {
        id: "hide",
        name: "a raw hide",
        parts: [
          ["water", 0.6],
          ["collagen", 0.33],
          ["fat", 0.07],
        ],
      },
    ],
  },
  copper: { unitKg: 5, ways: [{ id: "copper", name: "copper", parts: [["copper", 1]] }] },
  // Tin and iron as bars and blooms, a unit as heavy as copper's (Phase 52 M216).
  tin: { unitKg: 5, ways: [{ id: "tin", name: "tin", parts: [["tin", 1]] }] },
  iron: { unitKg: 5, ways: [{ id: "iron", name: "iron", parts: [["iron", 1]] }] },
  tools: {
    unitKg: 2,
    ways: [
      tool("stone", "stone tools", "flint"),
      tool("copper", "copper tools", "copper"),
      tool("bronze", "bronze tools", "bronze"),
      tool("iron", "iron tools", "iron"),
      tool("steel", "steel tools", "steel"),
    ],
  },
  clothing: {
    unitKg: 2,
    ways: [
      {
        id: "woven",
        name: "woven wool",
        parts: [
          ["keratin", 0.93],
          ["water", 0.07],
        ],
      },
      { id: "leather", name: "leather", parts: [["leather", 1]] },
    ],
  },
  pottery: { unitKg: 6, ways: [{ id: "pot", name: "fired clay", parts: [["fired-clay", 1]] }] },
  coal: {
    unitKg: 50,
    ways: [
      {
        id: "coal",
        name: "coal",
        parts: [
          ["carbon", 0.8],
          ["water", 0.06],
          ["kaolinite", 0.1],
          ["pyrite", 0.04],
        ],
      },
    ],
  },
  oil: {
    unitKg: 50,
    ways: [
      {
        id: "crude",
        name: "crude oil",
        parts: [
          ["crude", 0.97],
          ["water", 0.02],
          ["pyrite", 0.01],
        ],
      },
    ],
  },
  machines: {
    unitKg: 400,
    ways: [
      {
        id: "iron",
        name: "iron machines",
        parts: [
          ["iron", 0.8],
          ["copper", 0.08],
          ["cellulose", 0.08],
          ["crude", 0.02],
          ["glass", 0.02],
        ],
      },
      {
        id: "steel",
        name: "steel machines",
        parts: [
          ["steel", 0.84],
          ["copper", 0.1],
          ["crude", 0.03],
          ["glass", 0.03],
        ],
      },
    ],
  },
};

// —— The ground (Phase 15 M124): rocks, soils, and what an ore holds ——————————————

/** A rock: its name, what it is made of (substances, by weight), a sentence, a colour. */
export type Rock = {
  readonly id: string;
  readonly name: string;
  readonly parts: readonly (readonly [string, number])[];
  readonly words: string;
  readonly colour: readonly [number, number, number];
};

export const ROCKS: readonly Rock[] = [
  {
    id: "granite",
    name: "granite",
    parts: [
      ["feldspar", 0.6],
      ["quartz", 0.3],
      ["mica", 0.1],
    ],
    words: "The roots of old mountains, cooled slowly deep down: pink and grey, and hard.",
    colour: [0.86, 0.62, 0.6],
  },
  {
    id: "basalt",
    name: "basalt",
    parts: [
      ["plagioclase", 0.5],
      ["pyroxene", 0.38],
      ["olivine", 0.08],
      ["magnetite", 0.04],
    ],
    words: "Dark lava cooled fast: the floor of the oceans, and of the lands a hotspot flooded.",
    colour: [0.22, 0.22, 0.24],
  },
  {
    id: "andesite",
    name: "andesite",
    parts: [
      ["plagioclase", 0.58],
      ["pyroxene", 0.25],
      ["quartz", 0.1],
      ["magnetite", 0.04],
      ["mica", 0.03],
    ],
    words: "The grey lava of the volcanoes where one plate goes down under another.",
    colour: [0.52, 0.48, 0.56],
  },
  {
    id: "gneiss",
    name: "gneiss",
    parts: [
      ["feldspar", 0.48],
      ["quartz", 0.3],
      ["mica", 0.2],
      ["magnetite", 0.02],
    ],
    words: "The oldest rock of a continent's heart, banded by heat and weight over ages.",
    colour: [0.6, 0.58, 0.56],
  },
  {
    id: "limestone",
    name: "limestone",
    parts: [
      ["calcite", 0.92],
      ["quartz", 0.05],
      ["kaolinite", 0.03],
    ],
    words: "The shells of warm shallow seas, laid down and turned to stone.",
    colour: [0.9, 0.88, 0.76],
  },
  {
    id: "sandstone",
    name: "sandstone",
    parts: [
      ["quartz", 0.85],
      ["feldspar", 0.1],
      ["kaolinite", 0.03],
      ["hematite", 0.02],
    ],
    words: "Old sand bound into stone: of deserts, beaches and rivers long gone.",
    colour: [0.82, 0.62, 0.4],
  },
  {
    id: "shale",
    name: "shale",
    parts: [
      ["kaolinite", 0.55],
      ["quartz", 0.28],
      ["feldspar", 0.1],
      ["calcite", 0.03],
      ["pyrite", 0.02],
      ["carbon", 0.02],
    ],
    words: "Old mud pressed to thin dark layers: of lakes and quiet seas.",
    colour: [0.3, 0.32, 0.38],
  },
  {
    id: "coal-measures",
    name: "coal measures",
    parts: [
      ["quartz", 0.4],
      ["kaolinite", 0.35],
      ["carbon", 0.18],
      ["feldspar", 0.04],
      ["pyrite", 0.03],
    ],
    words:
      "Sandstone and shale with seams of coal between: the swamp forests of a warm age, buried.",
    colour: [0.12, 0.11, 0.1],
  },
];

/** A soil's make-up (substances, by weight, with its water), by the land's biome. */
export const SOILS: Readonly<
  Record<string, { name: string; parts: readonly (readonly [string, number])[] }>
> = {
  tundra: {
    name: "a peaty tundra soil",
    parts: [
      ["humus", 0.25],
      ["quartz", 0.3],
      ["kaolinite", 0.1],
      ["feldspar", 0.1],
      ["water", 0.25],
    ],
  },
  borealForest: {
    name: "a pale, sour forest soil (podzol)",
    parts: [
      ["quartz", 0.55],
      ["humus", 0.12],
      ["feldspar", 0.1],
      ["kaolinite", 0.08],
      ["water", 0.15],
    ],
  },
  coldDesert: {
    name: "a stony cold-desert soil",
    parts: [
      ["quartz", 0.7],
      ["feldspar", 0.15],
      ["calcite", 0.08],
      ["kaolinite", 0.04],
      ["water", 0.03],
    ],
  },
  steppe: {
    name: "a black grassland earth (chernozem)",
    parts: [
      ["quartz", 0.35],
      ["kaolinite", 0.2],
      ["humus", 0.12],
      ["feldspar", 0.1],
      ["calcite", 0.05],
      ["water", 0.18],
    ],
  },
  temperateForest: {
    name: "a brown forest earth",
    parts: [
      ["quartz", 0.4],
      ["kaolinite", 0.2],
      ["feldspar", 0.12],
      ["humus", 0.08],
      ["hematite", 0.02],
      ["water", 0.18],
    ],
  },
  temperateRainforest: {
    name: "a deep, wet forest earth",
    parts: [
      ["quartz", 0.3],
      ["kaolinite", 0.22],
      ["humus", 0.15],
      ["feldspar", 0.08],
      ["water", 0.25],
    ],
  },
  hotDesert: {
    name: "desert sand",
    parts: [
      ["quartz", 0.82],
      ["feldspar", 0.08],
      ["calcite", 0.05],
      ["hematite", 0.03],
      ["water", 0.02],
    ],
  },
  savanna: {
    name: "a red savanna soil",
    parts: [
      ["quartz", 0.5],
      ["kaolinite", 0.22],
      ["hematite", 0.06],
      ["feldspar", 0.06],
      ["humus", 0.04],
      ["water", 0.12],
    ],
  },
  tropicalDryForest: {
    name: "a red earth",
    parts: [
      ["quartz", 0.4],
      ["kaolinite", 0.28],
      ["hematite", 0.08],
      ["humus", 0.06],
      ["feldspar", 0.04],
      ["water", 0.14],
    ],
  },
  tropicalRainforest: {
    name: "a leached red clay (laterite)",
    parts: [
      ["kaolinite", 0.4],
      ["water", 0.22],
      ["quartz", 0.18],
      ["hematite", 0.14],
      ["humus", 0.06],
    ],
  },
  alpine: {
    name: "a thin mountain soil",
    parts: [
      ["quartz", 0.35],
      ["feldspar", 0.25],
      ["kaolinite", 0.1],
      ["mica", 0.1],
      ["water", 0.15],
      ["humus", 0.05],
    ],
  },
  ice: { name: "ice over the rock", parts: [["water", 1]] },
  sea: {
    name: "sea-floor mud",
    parts: [
      ["kaolinite", 0.5],
      ["calcite", 0.2],
      ["water", 0.2],
      ["quartz", 0.1],
    ],
  },
};

/** How much of a deposit's ore is its metal (or its fuel, or its salt), by weight. */
export const ORE_GRADE: Readonly<Record<string, { of: string; share: number }>> = {
  copper: { of: "copper", share: 0.02 },
  tin: { of: "tin", share: 0.006 },
  iron: { of: "iron", share: 0.45 },
  gold: { of: "gold", share: 0.00001 },
  coal: { of: "carbon", share: 0.8 },
  oil: { of: "crude", share: 1 },
  salt: { of: "halite", share: 0.95 },
};

/** Tonnes of ore (or coal, oil, salt) a unit of a deposit's richness stands for. */
export const TONNES_A_UNIT = 1000;

/**
 * What a living body of the people is made of, by weight (Phase 15 M125): water, protein, fat
 * (more in the warm-blooded, and in women), what hardens it (bone, or a shell of lime), its
 * salts and its sugar.
 */
export function bodyMakeUp(woman: boolean, skin: string, warm: boolean): [string, number][] {
  const shell = skin === "shell",
    fat = warm ? (woman ? 0.24 : 0.15) : 0.08,
    protein = woman ? 0.15 : 0.17,
    hard = shell ? 0.12 : 0.05,
    salts = 0.01,
    sugar = 0.01;
  return [
    ["water", 1 - fat - protein - hard - salts - sugar],
    ["protein", protein],
    ["fat", fat],
    [shell ? "calcite" : "apatite", hard],
    ["halite", salts / 2],
    ["potash", salts / 2],
    ["sugar", sugar],
  ];
}

/** Food's energy, kilocalories a gram, by what it is made of (water and minerals give none). */
export const KCAL: Readonly<Record<string, number>> = {
  starch: 4,
  sugar: 4,
  protein: 4,
  fat: 9,
  cellulose: 2,
};

/**
 * What each of the design grammar's materials is made of (Phase 15 M125): stone is the land's
 * own bedrock where a design stands on a land, else granite; the body's own parts are left out.
 */
export const MATERIAL_MATTER: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  wood: [
    ["cellulose", 0.88],
    ["water", 0.12],
  ],
  reed: [
    ["cellulose", 0.85],
    ["water", 0.15],
  ],
  hide: [
    ["leather", 0.9],
    ["water", 0.1],
  ],
  earth: [
    ["quartz", 0.5],
    ["kaolinite", 0.3],
    ["water", 0.15],
    ["humus", 0.05],
  ],
  mud: [
    ["kaolinite", 0.45],
    ["quartz", 0.45],
    ["water", 0.05],
    ["cellulose", 0.05],
  ],
  sod: [
    ["quartz", 0.4],
    ["humus", 0.2],
    ["water", 0.2],
    ["kaolinite", 0.15],
    ["cellulose", 0.05],
  ],
  "fired clay": [["fired-clay", 1]],
  copper: [["copper", 1]],
  bronze: [["bronze", 1]],
  iron: [["iron", 1]],
  steel: [["steel", 1]],
  coal: [
    ["carbon", 0.8],
    ["kaolinite", 0.14],
    ["water", 0.06],
  ],
  oil: [["crude", 1]],
  coral: [
    ["calcite", 0.95],
    ["protein", 0.05],
  ],
  shell: [
    ["calcite", 0.95],
    ["protein", 0.05],
  ],
  kelp: [
    ["water", 0.65],
    ["cellulose", 0.3],
    ["halite", 0.05],
  ],
  // Parts machined at a works (Phase 53 M219): steel, cut to a fiftieth of a millimetre.
  machined: [["steel", 1]],
  // The kinds' (Phase 56): bedrock ice, carbide grit in pitch, sulfur concrete.
  ice: [["water-ice", 1]],
  "pitch grit": [["pitch-grit", 1]],
  "sulfur concrete": [["sulfur-concrete", 1]],
};

/** What a part of each role weighs: a house's walls, roof and frame; a warrior's arm and guard; a works' hall and drive. */
export const ROLE_KG: Readonly<Record<string, number>> = {
  walls: 18000,
  roof: 2500,
  form: 1500,
  arm: 2,
  guard: 6,
  mount: 0,
  hall: 60000,
  drive: 3000,
};
