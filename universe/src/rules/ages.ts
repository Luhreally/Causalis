// What a people can do, measured, and the age a world stands at, read from those measures (Phase 65,
// docs/architecture/galaxy-plan.md: "Ages stop being a list"). Six measures, each a real figure read
// from what the world holds: the power each person has at their back, how strong and how hot its
// stuffs stand, how fine a thing it can make, how many sums a person has at hand, how far it has
// mastered life, how far it reaches. A world's age is read from its foremost land's figures, named after
// its own means (steel and steam, or worked ice and the ground's heat), and it falls as well as rises:
// a land that has lost its fuel, its machines or its last halls no longer has what they gave it. A reading
// only: nothing in history reads this. Past "Other stars" (Phase 66), each age is read the same way: from
// what a world's peoples came to by the road its own matter allows (rules/principles.ts, its last), named
// after what met it there. Pure tables and functions.
import type { Medium } from "./bodies.ts";
import { heatOf, metalOf, type WorldMetal } from "./chem-ores.ts";
import type { Chemistry } from "./chemistry.ts";
import { POWER } from "./goods.ts";
import { KINDS, type WorldKind } from "./kinds.ts";
import { reachIn, type Means } from "./means.ts";
import { PRINCIPLES, affordsPrinciple, needsMet, principle } from "./principles.ts";
import { PROPERTIES, matterShuts, type FunctionReading } from "./properties.ts";

/** The six measures. */
export type MeasureId = "energy" | "materials" | "precision" | "computing" | "life" | "reach";
export const MEASURE_IDS: readonly MeasureId[] = [
  "energy",
  "materials",
  "precision",
  "computing",
  "life",
  "reach",
];

/** A measure: its sign, its name, and what it measures and why that is what it is. */
export const MEASURES: Readonly<
  Record<
    MeasureId,
    {
      readonly icon: string;
      readonly name: string;
      readonly what: string;
      readonly read: string;
    }
  >
> = {
  energy: {
    icon: "⚡",
    name: "Power a head",
    what: "The kilowatts behind each person: their own strength (a tenth of a kilowatt), their beasts and mills, what their works' engines drive, a fusion flame held in a bottle, and the star's own light gathered in mirrors.",
    read: "Read from what the land's works burned or were given free last year, and what its mirrors gather now: when the fuel runs out or the mirrors drift, this falls.",
  },
  materials: {
    icon: "⚒️",
    name: "Limits of its stuffs",
    what: "The strongest stuff a people can make, in megapascals of tensile strength, and the hottest fire it can hold.",
    read: "Read from what the land knows and what its world's crust and air allow: its copper hardener, its iron, its furnaces.",
  },
  precision: {
    icon: "📏",
    name: "Precision",
    what: "The finest fit a people can make, in millimetres: a knapped edge is a millimetre out, a file's work a tenth, a machine's a fiftieth, a gyroscope's two thousandths, a mind's crystal drawn by light a fifty-thousandth.",
    read: "Read from the crafts the land knows.",
  },
  computing: {
    icon: "🧮",
    name: "Reckoning",
    what: "The sums each person has at hand, a second: a clerk with a tally does one in ten seconds; a valve machine thousands; a mind of crystal ten thousand million.",
    read: "Read from what the land knows, and past valves from how many machines it holds a head: when the machines go, so do the sums.",
  },
  life: {
    icon: "🧬",
    name: "Mastery of life",
    what: "How far a people commands what keeps it alive: gathering, sowing, fields that yield more, medicine, vaccines, air and water made in closed halls, sleep across the years, bodies written and grown, food with no field behind it.",
    read: "Read from what the land knows and how much its fields yield over the wild and its deaths are spared.",
  },
  reach: {
    icon: "🧭",
    name: "Reach",
    what: "How far from the cradle a people's hold runs: a day's walk, a realm's span, its ships' roads, the whole world from orbit, the halls on other worlds, the ships among the stars.",
    read: "Read from what stands now: a living realm's lands, a living flight program, halls that still have people in them.",
  },
};

/** A land's facts, as the world holds them (host/reading.ts). */
export type LandFacts = {
  readonly cell: number;
  readonly people: number;
  readonly farmers: number;
  readonly herders: number;
  readonly sown: boolean;
  /** What its works drove last year, in units of fuel or its like. */
  readonly driven: number;
  /** Machines held. */
  readonly machines: number;
  readonly knows: (id: string) => boolean;
};

/** What a world holds as a whole, as a reading reads it. */
export type WorldFacts = {
  readonly realms: number;
  readonly biggestRealm: number;
  readonly towns: number;
  readonly biggestTown: number;
  readonly sat: number;
  readonly crew: number;
  readonly station: number;
  /** The farthest body of its system with people on it (km; 0: none). */
  readonly colonyKm: number;
  /** The farthest star one of its ships has come to or sails for (light-years; 0: none). */
  readonly starLy: number;
  /** Whether a ship of theirs has come down under another star. */
  readonly arrived: boolean;
  /** Realms whose hosts bear arms of burning light. */
  readonly beams?: number;
  /** Other worlds made fit to walk on. */
  readonly remade?: number;
  /** The share of its peopled lands built on from edge to edge. */
  readonly cover?: number;
  /** The power its mirrors gather (kW), and how many times what falls on its whole world that is. */
  readonly mirrorKw?: number;
  readonly gathered?: number;
};

/** What the reading goes by on this world: its chemistry and kind, its people's medium, and fire. */
export type AgeWorld = {
  readonly chem: Chemistry;
  readonly kind: WorldKind;
  readonly medium: Medium;
  readonly fire: boolean;
  /** Home radii. */
  readonly radius: number;
  /** What its matter can and cannot do (rules/properties.ts), where it has been read. */
  readonly functions?: readonly FunctionReading[];
  /** Its star's class, for what its gathered light is named. */
  readonly spectral?: string;
  /** Its true warmth (°C), for what a cold world does for less. */
  readonly celsius?: number;
  /** Why its people's bodies cannot bear arms of light, where they cannot (Phase 66). */
  readonly noGrip?: string;
  /** What its world's numbers make of heat (rules/means.ts), where it has been read. */
  readonly means?: Means;
};

/** The heat a land can reach on this world. */
const reachOn = (w: AgeWorld, knows: (id: string) => boolean) =>
  w.means ? reachIn(w.means, knows) : w.fire;

/** A land counts toward its world's reading only with this share of the world's people (or a band's). */
export const LEAST_SHARE = 1 / 2000;
export const LEAST_PEOPLE = 25;

const anyKnown = (f: LandFacts, ids: readonly string[]) => ids.some((id) => f.knows(id));

/**
 * How many times what its fuel gave, a land's works have where they run on a held flame (Phase 66): with no
 * coal to dig or sky to choke, a people draws on all it can use, as it never could from fire.
 */
export const FLAME_GAIN = 10;

// —— Power ———————————————————————————————————————————————————————————————————————————————————————

/** The power behind each person of a land (kW): their strength, beasts and mills, and their works. */
export function energyOf(f: LandFacts): number {
  return (
    POWER.muscle +
    (f.knows("draught") ? POWER.beasts : 0) +
    (f.knows("mills") ? POWER.mills : 0) +
    (f.driven * POWER.perFuel * (f.knows("fusion-power") ? FLAME_GAIN : 1)) / Math.max(1, f.people)
  );
}

/** What drives a land's works, foremost first: the road each world's peoples come by. */
const ENGINES: readonly { id: string; age: string; words: string }[] = [
  { id: "fusion-power", age: "Fusion", words: "a fusion flame held in a bottle" },
  { id: "engines", age: "Oil and steam", words: "engines burning oil, and steam" },
  { id: "steam-engine", age: "Coal and steam", words: "steam, on coal" },
  { id: "vent-heat", age: "The vents' heat", words: "the heat of the sea floor's vents" },
  { id: "current-mills", age: "Tide mills", words: "mills turned by the tides" },
  { id: "sun-engines", age: "Sun engines", words: "engines the sun's heat drives" },
  { id: "heat-engines", age: "The ground's heat", words: "engines of the ground's heat" },
  { id: "cold-chemistry", age: "Cold chemistry", words: "acetylene joined with hydrogen" },
];

/** What gives a land its power, in words, and the principle behind it. */
function powerBy(f: LandFacts): { words: string; by: string | null; age: string | null } {
  if (f.driven > 0)
    for (const e of ENGINES) if (f.knows(e.id)) return { words: e.words, by: e.id, age: e.age };
  if (f.knows("mills")) return { words: "beasts, wind and water", by: "mills", age: null };
  if (f.knows("draught")) return { words: "beasts that pull", by: "draught", age: null };
  return { words: "their own strength", by: null, age: null };
}

// —— Stuffs ——————————————————————————————————————————————————————————————————————————————————————

/** A stuff a land can make. */
type StuffStep = {
  readonly by: readonly string[];
  readonly name: (chem: Chemistry) => string;
  readonly subst: (chem: Chemistry) => string;
  /** MPa as it is used here (where its table's figure is not what this way of working gives). */
  readonly strength?: number;
  /** A worked stuff that holds an edge better than stone: what the age of metal asks. */
  readonly edge?: boolean;
  /** The age's name, where it is named for this. */
  readonly age?: string;
};

const metalStep = (role: "copper" | "bronze" | "iron"): Pick<StuffStep, "name" | "subst"> => ({
  name: (chem) => (metalOf(chem, role) as WorldMetal).name,
  subst: (chem) => (metalOf(chem, role) as WorldMetal).subst,
});

/** What a people can make, the strongest last. */
const STUFFS: readonly StuffStep[] = [
  {
    by: ["ice-working"],
    name: () => "worked ice",
    subst: () => "water-ice",
    edge: true,
    age: "Worked ice",
  },
  { by: ["metalworking"], ...metalStep("copper") },
  { by: ["vent-working"], name: () => "metal from the vents", subst: () => "copper" },
  { by: ["acid-leaching"], name: () => "copper of blue vitriol", subst: () => "copper" },
  { by: ["bronze"], ...metalStep("bronze") },
  {
    by: ["set-edges"],
    name: () => "hard flakes set in a spine",
    subst: () => "flint",
    edge: true,
    age: "Set flakes",
  },
  {
    // (Cold-worked copper reaches some 350 MPa, as hard as iron's edge against rock of its world.)
    by: ["cold-hammering"],
    name: () => "native copper hammered cold",
    subst: () => "native-copper",
    strength: 350,
    edge: true,
    age: "Diamond and copper",
  },
  { by: ["iron"], ...metalStep("iron"), edge: true, age: "Iron" },
  {
    by: ["star-iron"],
    name: () => "iron fallen from the sky",
    subst: () => "telluric-iron",
    strength: 400,
  },
  {
    by: ["forged-star-iron"],
    name: () => "iron fallen from the sky, forged hot",
    subst: () => "iron",
  },
  {
    by: ["carbide-blades"],
    name: () => "carbide iron",
    subst: () => "cohenite-iron",
    edge: true,
    age: "Carbide iron",
  },
  {
    by: ["electrochemistry"],
    name: () => "metals parted by current",
    subst: () => "nickel",
    edge: true,
    age: "Parted metals",
  },
  {
    by: ["refined-metals"],
    name: () => "metals refined by current",
    subst: () => "nickel",
    strength: 650,
    edge: true,
    age: "Refined metals",
  },
  { by: ["steel"], name: () => "steel", subst: () => "steel", edge: true, age: "Steel" },
  {
    by: ["made-oxygen"],
    name: () => "steel of made oxygen",
    subst: () => "steel",
    edge: true,
    age: "Steel",
  },
  {
    // (What an electric furnace alloys, past what a blast furnace can hold.)
    by: ["electricity", "sea-electricity", "graphite-dynamos"],
    name: () => "alloys of the arc",
    subst: () => "steel",
    strength: 1200,
  },
  { by: ["drawn-carbon"], name: () => "woven carbon", subst: () => "carbon-weave" },
];

const strengthOf = (s: StuffStep, chem: Chemistry): number =>
  s.strength ?? PROPERTIES[s.subst(chem)]?.strength ?? 0;

/** The strongest stuff a land can make: its name, its substance, its strength. */
export function stuffOf(
  f: LandFacts,
  chem: Chemistry,
): { name: string; subst: string | null; strength: number; by: string | null } {
  let best: { name: string; subst: string | null; strength: number; by: string | null } = {
    name: "knapped stone",
    subst: null,
    strength: 50,
    by: null,
  };
  for (const s of STUFFS) {
    const by = s.by.find((id) => f.knows(id));
    if (!by) continue;
    const strength = strengthOf(s, chem);
    if (strength >= best.strength)
      best = { name: s.name(chem), subst: s.subst(chem), strength, by };
  }
  return best;
}

/** The worked stuff that holds its edge a land knows, foremost: what the age of metal is named for. */
function edgeOf(f: LandFacts): StuffStep | null {
  let best: StuffStep | null = null;
  for (const s of STUFFS) if (s.edge && s.by.some((id) => f.knows(id))) best = s;
  return best;
}

/** The hottest fire a land can hold in its world's air (°C; 0 where its people have none). */
export function fireOf(f: LandFacts, w: AgeWorld): number {
  if (w.fire) return heatOf(w.chem, (id) => f.knows(id));
  const r = reachOn(w, (id) => f.knows(id));
  return typeof r === "number" ? r : 0;
}

// —— Precision and reckoning ——————————————————————————————————————————————————————————————————————

/** What brings each finer fit (mm), the finest last. */
const FITS: readonly {
  readonly by: readonly string[];
  readonly mm: number;
  readonly words: string;
}[] = [
  {
    by: ["metalworking", "vent-working", "ice-working", "cold-hammering"],
    mm: 0.5,
    words: "cast and hammered",
  },
  { by: ["bronze", "pottery-wheel"], mm: 0.3, words: "moulded and turned" },
  {
    by: ["clockwork", "diamond-grit", "refined-metals"],
    mm: 0.1,
    words: "a file's or a grinder's work",
  },
  {
    by: [
      "factories",
      "sea-works",
      "sun-engines",
      "heat-engines",
      "cold-chemistry",
      "repeating-fire",
    ],
    mm: 0.05,
    words: "machined at a works",
  },
  {
    by: [
      "self-loading",
      "engines",
      "sea-electricity",
      "graphite-dynamos",
      "ground-dynamos",
      "polymer-wire",
    ],
    mm: 0.02,
    words: "gauged and machined fine",
  },
  { by: ["electronics"], mm: 0.01, words: "drawn fine for valves and wires" },
  { by: ["guidance"], mm: 0.002, words: "lapped for gyroscopes" },
  { by: ["machine-minds"], mm: 0.00002, words: "drawn by light, for minds of crystal" },
];

/** The finest fit a land can make (mm). */
export function fitOf(f: LandFacts): { mm: number; words: string; by: string | null } {
  let best: { mm: number; words: string; by: string | null } = {
    mm: 1,
    words: "knapped by eye",
    by: null,
  };
  for (const s of FITS) {
    const by = s.by.find((id) => f.knows(id));
    if (by && s.mm <= best.mm) best = { mm: s.mm, words: s.words, by };
  }
  return best;
}

/** What brings more sums a head (a second), the most last. */
const SUMS: readonly {
  readonly by: readonly string[];
  readonly sums: number;
  readonly words: string;
}[] = [
  { by: ["calendar"], sums: 0.05, words: "tallies and the reckoning of seasons" },
  { by: ["writing"], sums: 0.1, words: "writing" },
  { by: ["mathematics"], sums: 0.5, words: "reckoning on a board" },
  { by: ["clockwork"], sums: 2, words: "gears that add" },
  {
    by: ["electricity", "sea-electricity", "graphite-dynamos", "ground-dynamos", "polymer-wire"],
    sums: 20,
    words: "relays and the wire",
  },
  { by: ["electronics"], sums: 5000, words: "valves that reckon" },
  { by: ["guidance"], sums: 100000, words: "machines that steer themselves" },
  { by: ["machine-minds"], sums: 1e10, words: "minds of crystal" },
];

/** The sums a head a land has at hand, a second. */
export function sumsOf(f: LandFacts): { sums: number; words: string; by: string | null } {
  let best: { sums: number; words: string; by: string | null } = {
    sums: 0.02,
    words: "memory and the fingers",
    by: null,
  };
  for (const s of SUMS) {
    const by = s.by.find((id) => f.knows(id));
    if (by && s.sums >= best.sums) best = { sums: s.sums, words: s.words, by };
  }
  // Past valves, the machines a head hold the sums: from a tenth to three times what one machine a
  // head gives. A land that has lost its machines has lost its reckoning.
  if (best.sums >= 5000)
    best.sums *= Math.max(0.1, Math.min(3, (3 * f.machines) / Math.max(1, f.people)));
  return best;
}

// —— Life ————————————————————————————————————————————————————————————————————————————————————————

/** How far a people commands what keeps it alive, the furthest last. */
export const LIFE_STEPS: readonly {
  readonly by: readonly string[];
  readonly words: string;
}[] = [
  { by: [], words: "what the land gives" },
  { by: ["cultivation"], words: "sowing and herding" },
  { by: ["rotation", "shell-craft", "irrigation", "manuring"], words: "fields made to yield" },
  { by: ["medicine"], words: "medicine" },
  { by: ["germs", "vaccines"], words: "the seeds of sickness known and warded" },
  { by: ["life-support"], words: "air and water made in closed halls" },
  { by: ["long-sleep"], words: "sleep across the years" },
  { by: ["made-bodies"], words: "bodies written and grown" },
  { by: ["vat-food"], words: "food grown with no field behind it" },
];

/** A land's step of mastery of life (its index in LIFE_STEPS), and the principle that brought it. */
export function lifeOf(f: LandFacts): { level: number; by: string | null } {
  let level = 0,
    by: string | null = null;
  LIFE_STEPS.forEach((s, i) => {
    if (i === 0) return;
    const known =
      i === 1
        ? f.sown && f.farmers + f.herders > 0
          ? "cultivation"
          : undefined
        : s.by.find((id) => f.knows(id));
    if (known) {
      level = i;
      by = known;
    }
  });
  return { level, by };
}

// —— Reach ———————————————————————————————————————————————————————————————————————————————————————

/** Kilometres between a land and its neighbour, on a world of the home world's girth. */
const LAND_KM = 350;
/** A band's walk from its camp to the edge of what it knows. */
const WALK_KM = 30;
/** Kilometres a people's ships go, by what they know. */
const SHIP_KM: readonly { by: readonly string[]; km: number }[] = [
  { by: ["sailing"], km: 500 },
  { by: ["current-reading"], km: 1500 },
  { by: ["shipbuilding"], km: 2000 },
  { by: ["astronomy"], km: 4000 },
  { by: ["steamships"], km: 10000 },
];
const KM_A_LIGHT_YEAR = 9.46e12;

/** The kilometres a realm's rule spans. */
export function ruleKm(biggestRealm: number, radius: number): number {
  return biggestRealm > 0 ? LAND_KM * radius * Math.sqrt(biggestRealm) : 0;
}

/** Reach in words: kilometres, the world's girth, astronomical units or light-years. */
export function reachWords(km: number): string {
  if (km >= KM_A_LIGHT_YEAR * 0.05) return `${roundTo(km / KM_A_LIGHT_YEAR, 1)} light-years`;
  if (km >= 1.5e7) return `${roundTo(km / 1.496e8, 2)} AU`;
  return `${thousands(km)} km`;
}

const thousands = (n: number) => {
  const r = Math.round(n);
  return r >= 10000
    ? `${Math.round(r / 100) * 100}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : `${r}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
const roundTo = (x: number, digits: number) => {
  const k = digits >= 2 ? 100 : digits === 1 ? 10 : 1;
  return Math.round(x * k) / k;
};

// —— A world's reading ———————————————————————————————————————————————————————————————————————————

/** A measure as read: its figure and its words, what gives it, and where. */
export type MeasureReading = {
  readonly id: MeasureId;
  readonly value: number;
  /** "7.8 kW", "800 MPa". */
  readonly words: string;
  /** What gives it, in words. */
  readonly by: string;
  /** The principle behind it (its page). */
  readonly principle: string | null;
  /** The substance behind it (its page). */
  readonly subst: string | null;
  /** The land whose figure it is (null: the world's). */
  readonly land: number | null;
};

/** Everything an age may ask of a world, each a number. */
export type Figures = Readonly<Record<MeasureId, number>> & {
  readonly edge: number;
  readonly rule: number;
  readonly town: number;
  readonly towns: number;
  readonly fire: number;
  /** The kW a head from a held flame in its foremost land that has one. */
  readonly flame: number;
  readonly beams: number;
  readonly remade: number;
  readonly cover: number;
  readonly gathered: number;
};

/** What an age asks: a figure at or past a mark, in words. */
export type Ask = {
  readonly on: keyof Figures;
  readonly at: number;
  /** A figure that must lie below the mark (a fit: the finer the better). */
  readonly below?: boolean;
  readonly words: string;
  /** The principles that would bring it on this kind of world, the one its people can take first. */
  readonly road?: readonly string[];
};

/** An age of the ladder. Its id is its stage's (host/inspect/stage.ts), so the chronicle's years go with it. */
export type AgeDef = {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly asks: readonly Ask[];
};

const IRON_ROADS = [
  "iron",
  "electrochemistry",
  "cold-hammering",
  "carbide-blades",
  "ice-working",
  "set-edges",
];
const ENGINE_ROADS = [
  "steam-engine",
  "current-mills",
  "sun-engines",
  "heat-engines",
  "cold-chemistry",
];
const CURRENT_ROADS = [
  "electricity",
  "sea-electricity",
  "graphite-dynamos",
  "ground-dynamos",
  "polymer-wire",
];

/** The ladder, lowest first. A world stands at the highest whose asks it meets now. */
export const AGE_LADDER: readonly AgeDef[] = [
  { id: "bands", icon: "🔥", name: "Bands", asks: [] },
  {
    id: "villages",
    icon: "🏘️",
    name: "Villages",
    asks: [
      { on: "life", at: 1, words: "fields sown or flocks kept", road: ["cultivation"] },
      { on: "towns", at: 1, words: "a village that stands" },
    ],
  },
  {
    id: "realms",
    icon: "👑",
    name: "Realms",
    asks: [{ on: "rule", at: 1, words: "lands held under one rule" }],
  },
  {
    id: "cities",
    icon: "🏙️",
    name: "Cities",
    asks: [{ on: "town", at: 1000, words: "a town of a thousand, fed by the fields around it" }],
  },
  {
    id: "writing",
    icon: "📜",
    name: "Writing",
    asks: [
      { on: "computing", at: 0.1, words: "a tenth of a sum a second: writing", road: ["writing"] },
    ],
  },
  {
    id: "iron",
    icon: "⚔️",
    name: "Iron",
    asks: [
      { on: "edge", at: 1, words: "a stuff worked to hold an edge as iron does", road: IRON_ROADS },
    ],
  },
  {
    id: "engines",
    icon: "⚙️",
    name: "Engines",
    asks: [
      {
        on: "energy",
        at: 0.4,
        words: "0.4 kW behind each person, driven by more than muscle and mills",
        road: ENGINE_ROADS,
      },
    ],
  },
  {
    id: "electricity",
    icon: "⚡",
    name: "Electricity",
    asks: [
      { on: "energy", at: 1, words: "a kilowatt behind each person", road: ENGINE_ROADS },
      {
        on: "computing",
        at: 20,
        words: "twenty sums a second: relays and the wire",
        road: CURRENT_ROADS,
      },
    ],
  },
  {
    id: "orbit",
    icon: "🛰️",
    name: "Orbit",
    asks: [
      {
        on: "precision",
        at: 0.01,
        below: true,
        words: "a fit of a hundredth of a millimetre",
        road: ["electronics", "guidance"],
      },
      {
        on: "reach",
        at: 25000,
        words: "the whole world seen from orbit",
        road: ["orbital-flight"],
      },
    ],
  },
  {
    id: "worlds",
    icon: "🪐",
    name: "Other worlds",
    asks: [
      { on: "life", at: 5, words: "air and water made in closed halls", road: ["life-support"] },
      {
        on: "reach",
        at: 100000,
        words: "halls with people in them on another body",
        road: ["habitats"],
      },
    ],
  },
  {
    id: "stars",
    icon: "🌠",
    name: "Other stars",
    asks: [
      {
        on: "reach",
        at: KM_A_LIGHT_YEAR * 0.05,
        words: "a ship out among the stars",
        road: ["fusion-drive", "beamed-sails", "antimatter-drive"],
      },
    ],
  },
  // Ages past ours (Phase 66): each what history itself has come to, by a road its world's matter allows.
  {
    id: "fusion",
    icon: "🔆",
    name: "Fusion",
    asks: [
      {
        on: "flame",
        at: 20,
        words: "twenty kilowatts behind each person, from a flame held in a bottle",
        road: ["fusion-power"],
      },
    ],
  },
  {
    id: "minds",
    icon: "🧠",
    name: "Machine minds",
    asks: [
      {
        on: "computing",
        at: 1e8,
        words: "a hundred million sums a second a head: minds of crystal",
        road: ["machine-minds"],
      },
    ],
  },
  {
    id: "beams",
    icon: "🔦",
    name: "Beam arms",
    asks: [
      {
        on: "beams",
        at: 1,
        words: "a realm's host bearing arms of burning light",
        road: ["beam-arms"],
      },
    ],
  },
  {
    id: "bodies",
    icon: "🧬",
    name: "Made bodies",
    asks: [{ on: "life", at: 7, words: "bodies written and grown", road: ["made-bodies"] }],
  },
  {
    id: "remade",
    icon: "🌱",
    name: "Remade worlds",
    asks: [
      {
        on: "remade",
        at: 1,
        words: "another world made fit to walk on under its own sky",
        road: ["world-making"],
      },
    ],
  },
  {
    id: "covered",
    icon: "🌃",
    name: "Covered world",
    asks: [
      {
        on: "cover",
        at: 0.5,
        words: "half its lands built on from edge to edge",
        road: ["world-city"],
      },
    ],
  },
  {
    id: "gathered",
    icon: "☀️",
    name: "Gathered star",
    asks: [
      {
        on: "gathered",
        at: 1,
        words: "more of its star's light gathered than falls on its whole world",
        road: ["star-mirrors"],
      },
    ],
  },
];

/** A world's reading: its figures, each measure, and the age they make. */
export type WorldReading = {
  readonly figures: Figures;
  readonly measures: readonly MeasureReading[];
  readonly age: AgeDef;
  /** The age as this world names it. */
  readonly name: string;
  readonly icon: string;
  /** Why it is named so, in a few words. */
  readonly named: string;
  /** The principle it is named for, where one is. */
  readonly namedBy: string | null;
  /** The land whose figures carry it (the foremost that counts). */
  readonly land: number | null;
};

const numberWords = (x: number) =>
  x >= 100
    ? `${Math.round(x)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : x >= 10
      ? `${roundTo(x, 0)}`
      : `${roundTo(x, x >= 1 ? 1 : 2)}`;

/** A sums' figure in words. */
function sumsWords(sums: number): string {
  if (sums >= 1000) return `${numberWords(sums)} sums a second`;
  if (sums >= 1) return `${roundTo(sums, 1)} sums a second`;
  const every = Math.round(1 / sums);
  return every === 1 ? "a sum a second" : `a sum every ${every} seconds`;
}

/** Whether a figure meets an ask. */
export function askMet(a: Ask, figures: Figures): boolean {
  return a.below ? figures[a.on] <= a.at : figures[a.on] >= a.at;
}

/** The highest age whose asks a world's figures meet. */
export function ageOf(figures: Figures): AgeDef {
  for (let i = AGE_LADDER.length - 1; i > 0; i--)
    if (AGE_LADDER[i]!.asks.every((a) => askMet(a, figures))) return AGE_LADDER[i]!;
  return AGE_LADDER[0]!;
}

/**
 * The ages past ours are roads a world may never take, not steps it must climb: one that never held a flame
 * has not been through the age of fusion on its way to minds of crystal. So one is reached only where its
 * own asks have stood; those up to "Other stars" are passed on the way up (Phase 66).
 */
export function ageReached(i: number, standsAt: number, figures: Figures): boolean {
  if (i > standsAt) return false;
  const age = AGE_LADDER[i]!;
  return (
    i <= AGE_LADDER.findIndex((a) => a.id === "stars") || age.asks.every((a) => askMet(a, figures))
  );
}

/** What met a function on a world, where it has been read. */
const metBy = (w: AgeWorld, id: string): FunctionReading | undefined =>
  w.functions?.find((f) => f.id === id && f.met);

const STAR_WORDS: Readonly<Record<string, string>> = {
  M: "Gathered red star",
  K: "Gathered orange star",
  G: "Gathered star",
  F: "Gathered white star",
  A: "Gathered white star",
};

/** What a world's people call an age past ours: for what met what it asked (undefined: its plain name). */
function lateName(id: string, w: AgeWorld): { name: string; named: string } | undefined {
  switch (id) {
    case "fusion": {
      const wall = metBy(w, "wall-a-flame")?.subst,
        magnet = metBy(w, "hold-a-flame")?.subst;
      if (w.celsius !== undefined && w.celsius < -150)
        return {
          name: "Cold-held fusion",
          named: "named for the cold that does half its magnets' work",
        };
      if (w.medium === "water")
        return {
          name: "Sea-fed fusion",
          named: "named for the water its flame's light atoms are parted from",
        };
      if (wall === "moissanite")
        return {
          name: "Carbide-walled fusion",
          named: "named for the walls its flame stands within, its world's own carbide",
        };
      if (wall === "graphite")
        return {
          name: "Graphite-walled fusion",
          named: "named for the walls its flame stands within, where no tungsten lies",
        };
      if (magnet === "magnesium-diboride")
        return {
          name: "Salt-magnet fusion",
          named: "named for what holds its flame: magnets of a black salt, where no niobium lies",
        };
      return undefined;
    }
    case "minds": {
      const stuff = metBy(w, "think-in-crystal")?.subst;
      if (stuff === "gallium-arsenide")
        return {
          name: "Gallium minds",
          named: "named for the crystal it thinks in, where silicon is scarce",
        };
      if (stuff === "germanium")
        return {
          name: "Germanium minds",
          named: "named for the crystal it thinks in, where silicon is scarce",
        };
      return stuff === "silicon"
        ? { name: "Silicon minds", named: "named for the crystal it thinks in" }
        : undefined;
    }
    case "beams": {
      if (w.medium === "water")
        return { name: "Blue-green beams", named: "named for the one light that water lets pass" };
      const by = metBy(w, "beam-a-light")?.by ?? "";
      if (by.startsWith("ruby"))
        return { name: "Ruby beams", named: "named for the crystal it lases in" };
      if (by.startsWith("carbon"))
        return {
          name: "Gas beams",
          named: "named for the gas it lases in, where no ruby can be had",
        };
      return undefined;
    }
    case "bodies":
      return w.kind === "rocky"
        ? undefined
        : {
            name: `Bodies of ${KINDS[w.kind].liquid.name}`,
            named: `named for what its people's own bodies are written in: ${KINDS[w.kind].liquid.name}`,
          };
    case "remade":
      return w.medium === "water"
        ? {
            name: "Flooded worlds",
            named: "named for what a people of the water makes of a world: seas",
          }
        : undefined;
    case "covered":
      if (w.medium === "water")
        return {
          name: "Reef-city world",
          named: "named for the towers its people raise over its sea floors",
        };
      if (w.kind === "ammonia" || w.kind === "methane")
        return {
          name: "Ice-tower world",
          named: "named for what its towers stand on and are walled with",
        };
      return undefined;
    case "gathered": {
      const name = w.spectral ? STAR_WORDS[w.spectral] : undefined;
      return name && name !== "Gathered star"
        ? { name, named: "named for the star whose light it has gathered" }
        : undefined;
    }
    default:
      return undefined;
  }
}

/** The age's name on this world: its own means, read from its foremost land. */
function ownName(
  age: AgeDef,
  w: AgeWorld,
  energyLand: LandFacts | null,
  edge: StuffStep | null,
  edgeKnows: (id: string) => boolean,
): { name: string; icon: string; named: string; namedBy: string | null } {
  const plain = { name: age.name, icon: age.icon, named: "", namedBy: null };
  switch (age.id) {
    case "iron": {
      if (!edge) return plain;
      const words = edge.age ?? age.name;
      return {
        name: words,
        icon: KINDS[w.kind].burns || w.kind === "sulfur" ? age.icon : KINDS[w.kind].icon,
        named: `named for ${edge.name(w.chem)}, what its people's edges are made of`,
        namedBy: edge.by.find((id) => edgeKnows(id)) ?? edge.by[0]!,
      };
    }
    case "engines": {
      const by = energyLand ? powerBy(energyLand) : null;
      // (A flame is its own age's: engines as they were before it.)
      if (!by?.age || by.by === "fusion-power") return plain;
      return {
        name: by.age,
        icon: age.icon,
        named: `named for what drives its works: ${by.words}`,
        namedBy: by.by,
      };
    }
    case "electricity": {
      const own: Partial<Record<WorldKind, string>> = {
        carbon: "Graphite dynamos",
        ammonia: "Ground dynamos",
        methane: "Polymer wire",
      };
      const name = own[w.kind] ?? (w.medium === "water" ? "Sea electricity" : age.name);
      return {
        name,
        icon: age.icon,
        named: name === age.name ? "" : "named for how its people come by a current",
        namedBy: null,
      };
    }
    default: {
      const own = lateName(age.id, w);
      return own ? { ...plain, ...own } : plain;
    }
  }
}

/**
 * What a world's people would call an age they came to, given all they could come to know: the first of
 * its own means along the way (host/can.ts; undefined: the age's plain name).
 */
export function meansOfAge(
  id: string,
  knows: (id: string) => boolean,
  w: AgeWorld,
): string | undefined {
  // (Flakes name an age only where iron will not come.)
  if (id === "iron")
    return STUFFS.find(
      (s) => s.edge && s.by.some(knows) && !(s.by.includes("set-edges") && knows("iron")),
    )?.age;
  if (id === "engines") {
    // (In the order a people comes to them: steam before oil, tide mills before the vents.)
    const first = [
      "steam-engine",
      "current-mills",
      "vent-heat",
      "sun-engines",
      "heat-engines",
      "cold-chemistry",
    ].find(knows);
    return ENGINES.find((e) => e.id === first)?.age;
  }
  if (id === "electricity") {
    const own: Partial<Record<WorldKind, string>> = {
      carbon: "Graphite dynamos",
      ammonia: "Ground dynamos",
      methane: "Polymer wire",
    };
    return own[w.kind] ?? (w.medium === "water" ? "Sea electricity" : undefined);
  }
  return lateName(id, w)?.name;
}

/** A world's reading from its peopled lands and what it holds as a whole. */
export function readWorld(
  lands: readonly LandFacts[],
  facts: WorldFacts,
  w: AgeWorld,
): WorldReading {
  let total = 0;
  for (const f of lands) total += f.people;
  // (What its mirrors gather is the whole world's, among all its people.)
  const gatheredHead = (facts.mirrorKw ?? 0) / Math.max(1, total);
  const least = Math.max(LEAST_PEOPLE, total * LEAST_SHARE),
    counted = lands.filter((f) => f.people >= least),
    among = counted.length ? counted : lands;
  // Each measure's foremost land, of those that count.
  let energy = 0,
    energyLand: LandFacts | null = null,
    stuff: ReturnType<typeof stuffOf> = {
      name: "knapped stone",
      subst: null,
      strength: 0,
      by: null,
    },
    stuffLand: LandFacts | null = null,
    edge: StuffStep | null = null,
    edgeStrength = -1,
    fit: ReturnType<typeof fitOf> = { mm: Infinity, words: "", by: null },
    fitLand: LandFacts | null = null,
    sums: ReturnType<typeof sumsOf> = { sums: 0, words: "", by: null },
    sumsLand: LandFacts | null = null,
    life: ReturnType<typeof lifeOf> = { level: -1, by: null },
    lifeLand: LandFacts | null = null,
    fire = 0,
    sea = 0;
  let flame = 0;
  for (const f of among) {
    if (f.knows("fusion-power")) flame = Math.max(flame, energyOf(f));
    const e = energyOf(f) + gatheredHead;
    if (e > energy || (e === energy && energyLand && f.people > energyLand.people)) {
      energy = e;
      energyLand = f;
    }
    const s = stuffOf(f, w.chem);
    if (s.strength > stuff.strength || (s.strength === stuff.strength && !stuffLand)) {
      stuff = s;
      stuffLand = f;
    }
    const es = edgeOf(f);
    if (es && strengthOf(es, w.chem) > edgeStrength) {
      edge = es;
      edgeStrength = strengthOf(es, w.chem);
    }
    const ft = fitOf(f);
    if (ft.mm < fit.mm || !fitLand) {
      fit = ft;
      fitLand = f;
    }
    const n = sumsOf(f);
    if (n.sums > sums.sums || !sumsLand) {
      sums = n;
      sumsLand = f;
    }
    const l = lifeOf(f);
    if (l.level > life.level) {
      life = l;
      lifeLand = f;
    }
    fire = Math.max(fire, fireOf(f, w));
    for (const k of SHIP_KM) if (f.knows(k.by[0]!)) sea = Math.max(sea, k.km);
  }
  // Reach: what stands now.
  const rule = ruleKm(facts.biggestRealm, w.radius),
    girth = 40000 * w.radius,
    onWorld = Math.min(girth / 2, Math.max(WALK_KM, rule, sea)),
    orbit = facts.sat > 0 ? girth : 0,
    stars = facts.starLy * KM_A_LIGHT_YEAR,
    reach = Math.max(onWorld, orbit, facts.colonyKm, stars),
    reachBy =
      stars > 0
        ? facts.arrived
          ? "its ships, come down under another star"
          : "a ship of theirs, out among the stars"
        : facts.colonyKm > 0
          ? "halls with people in them on another body"
          : orbit > 0
            ? `${facts.sat} realm${facts.sat === 1 ? "" : "s"} flying to orbit`
            : onWorld === sea && sea > rule
              ? "its ships"
              : rule > 0
                ? `a realm of ${facts.biggestRealm} land${facts.biggestRealm === 1 ? "" : "s"}`
                : "a band's walk";
  const figures: Figures = {
    energy,
    materials: stuff.strength,
    precision: fit.mm === Infinity ? 1 : fit.mm,
    computing: sums.sums,
    life: Math.max(0, life.level),
    reach,
    edge: edge ? 1 : 0,
    rule,
    town: facts.biggestTown,
    towns: facts.towns,
    fire,
    flame,
    beams: facts.beams ?? 0,
    remade: facts.remade ?? 0,
    cover: facts.cover ?? 0,
    gathered: facts.gathered ?? 0,
  };
  const power =
    gatheredHead > energy / 2
      ? { words: "its star's light, gathered in mirrors", by: "star-mirrors" }
      : energyLand
        ? powerBy(energyLand)
        : { words: "", by: null };
  const measures: MeasureReading[] = [
    {
      id: "energy",
      value: energy,
      words: powerWords(energy),
      by: power.words || "their own strength",
      principle: power.by,
      subst: null,
      land: energyLand?.cell ?? null,
    },
    {
      id: "materials",
      value: stuff.strength,
      words: `${numberWords(stuff.strength)} MPa${fire ? `, fire to ${numberWords(fire)} °C` : ""}`,
      by: stuff.name,
      principle: stuff.by,
      subst: stuff.subst,
      land: stuffLand?.cell ?? null,
    },
    {
      id: "precision",
      value: figures.precision,
      words: `${figures.precision} mm`,
      by: fit.words,
      principle: fit.by,
      subst: null,
      land: fitLand?.cell ?? null,
    },
    {
      id: "computing",
      value: sums.sums,
      words: sumsWords(sums.sums),
      by: sums.words,
      principle: sums.by,
      subst: null,
      land: sumsLand?.cell ?? null,
    },
    {
      id: "life",
      value: figures.life,
      words: LIFE_STEPS[figures.life]!.words,
      by: LIFE_STEPS[figures.life]!.words,
      principle: life.by,
      subst: null,
      land: lifeLand?.cell ?? null,
    },
    {
      id: "reach",
      value: reach,
      words: reachWords(reach),
      by: reachBy,
      principle: null,
      subst: null,
      land: null,
    },
  ];
  const age = lands.length ? ageOf(figures) : AGE_LADDER[0]!,
    own = ownName(age, w, energyLand, edge, (id) => among.some((f) => f.knows(id)));
  return {
    figures,
    measures,
    age,
    ...own,
    land: energyLand?.cell ?? null,
  };
}

// —— What it lacks ———————————————————————————————————————————————————————————————————————————————

/** The road this world's peoples can take to an ask: the first they know, else the first open to them. */
export function roadOn(
  road: readonly string[],
  w: AgeWorld,
  knows: (id: string) => boolean = () => false,
): string | null {
  const open = road.filter((id) =>
    affordsPrinciple(principle(id), w.medium, reachOn(w, knows), w.means?.wants),
  );
  return open.find(knows) ?? open[0] ?? null;
}

/**
 * What stands between a people and a principle: those it has yet to find that it could set about now
 * (all it needs known), walking back through what it needs. "a|b" needs are met by any open to it.
 */
export function nextOnRoad(
  id: string,
  knows: (id: string) => boolean,
  w: AgeWorld,
  seen = new Set<string>(),
): string[] {
  if (seen.has(id) || knows(id)) return [];
  seen.add(id);
  const p = PRINCIPLES.find((x) => x.id === id);
  // (A root, known by the older systems: there is nothing behind it to find.)
  if (!p || p.rate <= 0) return [id];
  if (needsMet(p, knows)) return [id];
  const out: string[] = [];
  for (const need of p.needs) {
    const options = need.split("|");
    if (options.some(knows)) continue;
    const open = options.find((o) => {
      const q = PRINCIPLES.find((x) => x.id === o);
      return !q || affordsPrinciple(q, w.medium, reachOn(w, knows), w.means?.wants);
    });
    if (open) for (const n of nextOnRoad(open, knows, w, seen)) if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** One ask an age makes that a world does not meet: what it asks, what it has, what would bring it. */
export type Lack = {
  readonly words: string;
  readonly has: string;
  /** The principle that would bring it here, and what its people could set about now on the way there. */
  readonly road: string | null;
  readonly next: readonly string[];
  /** Its people know the way already: it is more than knowing that it wants. */
  readonly known: boolean;
  /** What its world's matter says of that way, where it never will be found here (Phase 66). */
  readonly shut?: string;
};

/**
 * Why a principle will never be found on a world, walking back through what it needs: what its matter
 * asks and cannot give (null: nothing of its matter stands in the way).
 */
export function shutOf(id: string, w: AgeWorld, seen = new Set<string>()): string | null {
  if (id === "beam-arms" && w.noGrip) return w.noGrip;
  if (!w.functions || seen.has(id)) return null;
  seen.add(id);
  const p = PRINCIPLES.find((x) => x.id === id);
  if (!p) return null;
  const f = matterShuts(p, w.functions);
  if (f) return `to ${f.name}: ${f.why}`;
  for (const need of p.needs) {
    const options = need.split("|"),
      shut = options.map((o) => shutOf(o, w, seen));
    if (shut.every((s) => s !== null)) return shut[0]!;
  }
  return null;
}

/** A power a head in the fewest words: kilowatts, and past them what a gathered star gives. */
function powerWords(kw: number): string {
  if (kw < 10_000) return `${numberWords(kw)} kW`;
  if (kw < 10_000_000) return `${numberWords(kw / 1000)} MW`;
  if (kw < 10_000_000_000) return `${numberWords(kw / 1_000_000)} GW`;
  return `${numberWords(kw / 1_000_000_000)} TW`;
}

/** A figure's reading in words, for what an age asks and what it lacks. */
export function hasWords(on: keyof Figures, figures: Figures): string {
  const x = figures[on];
  switch (on) {
    case "energy":
      return `${powerWords(x)} a head`;
    case "flame":
      return x > 0 ? `${powerWords(x)} a head from its flame` : "no flame held";
    case "materials":
      return `${numberWords(x)} MPa`;
    case "precision":
      return `${x} mm`;
    case "computing":
      return sumsWords(x);
    case "life":
      return LIFE_STEPS[Math.max(0, x)]!.words;
    case "reach":
      return reachWords(x);
    case "town":
      return x > 0 ? `its largest town, ${numberWords(x)}` : "no town yet";
    case "towns":
      return x > 0 ? `${numberWords(x)} towns` : "no town yet";
    case "rule":
      return x > 0 ? `a realm spanning ${numberWords(x)} km` : "no realm yet";
    case "edge":
      return `${numberWords(figures.materials)} MPa at its best`;
    case "beams":
      return x > 0 ? `${numberWords(x)} realms' hosts bearing them` : "no host bearing them";
    case "remade":
      return x > 0 ? `${numberWords(x)} worlds remade` : "no world remade yet";
    case "cover":
      return `${Math.round(x * 100)} in a hundred of its lands`;
    case "gathered":
      return x > 0
        ? `${x >= 1 ? numberWords(x) : Math.round(x * 1000) / 1000} times what falls on its world`
        : "no mirrors yet";
    default:
      return `${numberWords(x)}`;
  }
}

/** What a world lacks for the age after the one it stands at (null: it stands at the last). */
export function lacksForNext(
  reading: WorldReading,
  knows: (id: string) => boolean,
  w: AgeWorld,
): { age: AgeDef; lacks: Lack[] } | null {
  const at = AGE_LADDER.indexOf(reading.age),
    age = AGE_LADDER[at + 1];
  if (!age) return null;
  const lacks: Lack[] = [];
  for (const ask of age.asks) {
    if (askMet(ask, reading.figures)) continue;
    const road = ask.road ? roadOn(ask.road, w, knows) : null,
      shut = road ? shutOf(road, w) : null;
    lacks.push({
      words: ask.words,
      has: hasWords(ask.on, reading.figures),
      road,
      next: road ? nextOnRoad(road, knows, w) : [],
      known: !!road && knows(road),
      ...(shut ? { shut } : {}),
    });
  }
  return { age, lacks };
}

// —— Each measure's ladder, for its page —————————————————————————————————————————————————————————

/** A step of a measure: what brings it, its figure, and whether this people has come to it. */
export type MeasureStep = {
  readonly words: string;
  readonly figure: string;
  /** The principle that brings it (its page). */
  readonly by: string | null;
  /** The substance it is (its page). */
  readonly subst: string | null;
  readonly known: boolean;
  /** Whether a people of this world could come to it at all. */
  readonly open: boolean;
};

/** A measure's steps on this world, lowest first, those shut to its people marked. */
export function measureSteps(
  id: MeasureId,
  knows: (id: string) => boolean,
  w: AgeWorld,
): MeasureStep[] {
  const opens = (ids: readonly string[]) =>
      ids.some((x) => {
        const p = PRINCIPLES.find((q) => q.id === x);
        return (
          !p || (affordsPrinciple(p, w.medium, reachOn(w, knows), w.means?.wants) && !shutOf(x, w))
        );
      }),
    step = (
      words: string,
      figure: string,
      by: readonly string[],
      subst: string | null = null,
    ): MeasureStep => ({
      words,
      figure,
      by: by.find(knows) ?? by.find((x) => opens([x])) ?? by[0] ?? null,
      subst,
      known: !by.length || by.some(knows),
      open: !by.length || opens(by),
    });
  switch (id) {
    case "energy":
      return [
        step("their own strength", `${POWER.muscle} kW`, []),
        step("beasts that pull", `+${POWER.beasts} kW`, ["draught"]),
        step("mills of wind and water", `+${POWER.mills} kW`, ["mills"]),
        ...[...ENGINES]
          .reverse()
          .map((e) =>
            step(
              e.words,
              `+${POWER.perFuel * (e.id === "fusion-power" ? FLAME_GAIN : 1)} kW for each unit a head driven`,
              [e.id],
            ),
          ),
        step(
          "its star's light, gathered in mirrors",
          "as much as its mirrors gather, among all its people",
          ["star-mirrors"],
        ),
      ];
    case "materials":
      return [
        step("knapped stone", "50 MPa", []),
        ...STUFFS.map((s) =>
          step(s.name(w.chem), `${numberWords(strengthOf(s, w.chem))} MPa`, s.by, s.subst(w.chem)),
        ),
      ];
    case "precision":
      return [
        step("knapped by eye", "1 mm", []),
        ...FITS.map((f) => step(f.words, `${f.mm} mm`, f.by)),
      ];
    case "computing":
      return [
        step("memory and the fingers", sumsWords(0.02), []),
        ...SUMS.map((s) =>
          step(
            s.words,
            s.sums >= 5000 ? `${sumsWords(s.sums)} with a machine a head` : sumsWords(s.sums),
            s.by,
          ),
        ),
      ];
    case "life":
      return LIFE_STEPS.map((s, i) =>
        step(s.words, `step ${i}`, i === 0 ? [] : i === 1 ? ["cultivation"] : s.by),
      );
    case "reach":
      return [
        step("a band's walk", `${WALK_KM} km`, []),
        ...SHIP_KM.map((k) => step("its ships", reachWords(k.km), k.by)),
        step("a realm's lands", `${LAND_KM} km across each land`, []),
        step("the whole world, from orbit", reachWords(40000 * w.radius), ["orbital-flight"]),
        step("halls on another body", "as far as the body lies", ["habitats"]),
        step("a ship out among the stars", "light-years", [
          "fusion-drive",
          "beamed-sails",
          "antimatter-drive",
        ]),
      ];
  }
}
