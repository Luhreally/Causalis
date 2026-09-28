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
  { symbol: "Sn", name: "tin", mass: 118.71 },
  { symbol: "Au", name: "gold", mass: 196.97 },
];

const MASS: Readonly<Record<string, number>> = Object.fromEntries(
  ELEMENTS.map((e) => [e.symbol, e.mass]),
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
  /** Steel: iron with a hundredth of carbon, by weight. */
  STEEL = { Fe: 0.9551, C: 0.0449 };
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
];

export const SUBSTANCE: Readonly<Record<string, number>> = Object.fromEntries(
  SUBSTANCES.map((s, i) => [s.id, i]),
);

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
    recipe: null,
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
    recipe: null,
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
    recipe: null,
    words:
      "Red ore and charcoal in a clay stack blown by bellows: a spongy bloom of iron, hammered free of slag.",
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
    recipe: null,
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
    recipe: null,
    words:
      "Iron kept hot in charcoal takes a little carbon into itself: steel, to be quenched hard.",
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

/** How far a reaction is from balancing: the largest difference in any element's atoms. */
export function imbalance(r: Reaction): number {
  const count = (side: readonly (readonly [string, number])[]) => {
    const out: Record<string, number> = {};
    for (const [id, n] of side) {
      const s = SUBSTANCES[SUBSTANCE[id]!]!;
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
      (n * molarMass(SUBSTANCES[SUBSTANCE[id]!]!.formula)) / 1000,
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
