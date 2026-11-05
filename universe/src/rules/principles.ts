// Principles (docs/architecture §22): what a people can come to know, as data. Each
// has what it needs known first, what drives its finding (the people who would find
// it, the pressures that would push them, what the land must hold), and what it
// changes once known. Effects are keyed numbers the owning systems read; some wait
// for systems still to come (war, buildings) and are recorded now so the tree is
// whole. Two roots are known by the older systems: cultivation and metalworking.

import type { Medium } from "./bodies.ts";

/** What a principle changes, as keyed amounts (added to a land's totals). */
export const EFFECTS = [
  /** Fields give this much more. */
  "farmYield",
  /** Flocks give this much more. */
  "herdYield",
  /** The wild gives this much more. */
  "forageYield",
  /** Months more of food can be kept. */
  "storage",
  /** Stores spoil this share less. */
  "keeping",
  /** Crafters make this much more of each. */
  "tools",
  "clothing",
  "pottery",
  /** Carrying costs this share less. */
  "haul",
  /** Carriers move this much more. */
  "carrying",
  /** Deaths this share fewer. */
  "health",
  /** A realm reaches this many steps further from its seat. */
  "reach",
  /** Learning from others comes this much faster. */
  "learning",
  /** Law can be written (decree becomes possible). */
  "writing",
  /** For war (M22): arms, armour, mounts, walls, sieges, ships. */
  "arms",
  "armour",
  "mounts",
  "walls",
  "sieges",
  "ships",
  /** For cities (M23): building in stone, building high, water brought. */
  "building",
  /** Engines a people can drive (Phase 3 M32): steam, then electricity, then the oil engine. */
  "power",
  /** How much of their crafts is done in works with engines, fed by fuel. */
  "industry",
  /** How much of that power comes from the tides, currents and the earth's heat, without fuel. */
  "renewable",
] as const;
export type Effect = (typeof EFFECTS)[number];

/** Who and what drives a principle's finding: occupation counts, pressures, the land. */
export type Drivers = {
  readonly crafters?: number;
  readonly farmers?: number;
  readonly herders?: number;
  readonly traders?: number;
  readonly leaders?: number;
  /** A famine in the last few years. */
  readonly famine?: number;
  /** A market town. */
  readonly town?: number;
  /** Only where a river runs, the sea is near, the land is high. */
  readonly river?: boolean;
  readonly coast?: boolean;
  readonly hills?: boolean;
  /** Only with this ore within reach. */
  readonly ore?: string;
  /** On a world that burns, only by a land that wants it: a stand-in for metal or for coal (F4: rules/means.ts, turnsAside). */
  readonly lacks?: "metal" | "coal";
};

/** What a body must be able to do for a principle to be open to its people (Phase 4 M39). */
export type BodyNeeds = {
  /** The heat it wants (°C): whatever on this world reaches it (F2). */
  readonly heat?: number;
  /** It burns a fuel in air, and has no other way. */
  readonly burns?: boolean;
  /** Only a people of these media can use it (wheels and sails are for the land and shore; the vents for the sea). */
  readonly media?: readonly Medium[];
  /** It flies on an engine: only a land that knows one that lifts a machine on its world (W2: rules/reach.ts). */
  readonly lifts?: boolean;
};

export type Principle = {
  readonly id: string;
  readonly name: string;
  readonly needs: readonly string[];
  /** How likely finding is in a year, before the drivers. */
  readonly rate: number;
  readonly drivers: Drivers;
  readonly effects: Partial<Record<Effect, number>>;
  readonly body?: BodyNeeds;
  /**
   * What it asks of its world's matter (Phase 66): functions (rules/properties.ts) that world's crust,
   * bodies and star must meet, whatever its people know. Unmet, it is never found there.
   */
  readonly asks?: readonly string[];
};

/**
 * Whether what a land knows meets a principle's needs: every need, where a need written
 * "a|b" is met by either (the sky is reached by the land's road or the sea's).
 */
export function needsMet(
  p: { readonly needs: readonly string[] },
  knows: (id: string) => boolean,
): boolean {
  return p.needs.every((n) => (n.includes("|") ? n.split("|").some(knows) : knows(n)));
}

/** Whether a body can come to know a principle, at the heat its land can reach: true no limit, false none, or °C. */
export function affordsPrinciple(
  p: Principle,
  medium: Medium,
  reach: number | boolean,
  wants?: Readonly<Record<string, number>>,
): boolean {
  const heat = p.body?.heat === undefined ? undefined : (wants?.[p.id] ?? p.body.heat);
  if (heat !== undefined && !(reach === true || (typeof reach === "number" && reach >= heat)))
    return false;
  if (p.body?.burns && reach !== true) return false;
  return !p.body?.media || p.body.media.includes(medium);
}

const P = (
  id: string,
  name: string,
  needs: string[],
  rate: number,
  drivers: Drivers,
  effects: Partial<Record<Effect, number>>,
  body?: BodyNeeds,
): Principle => ({ id, name, needs, rate, drivers, effects, ...(body ? { body } : {}) });

/**
 * What a need names when it names a function, not an invention (F1; F3 grows from this): expanded
 * when PRINCIPLES is built.
 */
export const FUNCTIONS: Readonly<Record<string, readonly string[]>> = {
  "@tough-stuff": ["iron", "carbide-blades", "diamond-grit", "ice-working", "set-edges"],
  "@engine": ["steam-engine", "sun-engines", "heat-engines", "cold-chemistry"],
  "@polished": ["bronze", "cold-hammering", "star-iron"],
  "@edge": ["bronze", "carbide-blades", "ice-working", "set-edges"],
  "@works": ["factories", "sea-works", "sun-engines", "heat-engines", "cold-chemistry"],
  "@current": [
    "electricity",
    "sea-electricity",
    "graphite-dynamos",
    "ground-dynamos",
    "polymer-wire",
  ],
};
const expand = (n: string) =>
  n
    .split("|")
    .flatMap((x) => FUNCTIONS[x] ?? [x])
    .join("|");

const TREE: readonly Principle[] = [
  // The roots, known by the older systems.
  P("cultivation", "sowing and reaping", [], 0, {}, {}),
  P("metalworking", "smelting copper", [], 0, {}, {}),
  // Farm and herd.
  P("dairying", "milk and cheese", ["cultivation"], 0.02, { herders: 1 }, { herdYield: 0.2 }),
  P(
    "draught",
    "beasts that pull",
    ["dairying"],
    0.015,
    { herders: 1, farmers: 0.5 },
    { haul: 0.15 },
  ),
  P(
    "irrigation",
    "watering the fields",
    ["cultivation"],
    0.02,
    { farmers: 1, famine: 1, river: true },
    { farmYield: 0.2 },
  ),
  P("plough", "the plough", ["cultivation", "draught"], 0.02, { farmers: 1 }, { farmYield: 0.25 }),
  P(
    "calendar",
    "the reckoning of seasons",
    ["cultivation"],
    0.012,
    { leaders: 1, farmers: 0.3 },
    { farmYield: 0.05 },
  ),
  P(
    "rotation",
    "resting the fields in turn",
    ["plough", "calendar"],
    0.012,
    { farmers: 1, famine: 1 },
    { farmYield: 0.15 },
  ),
  P(
    "terracing",
    "terraced slopes",
    ["irrigation", "masonry"],
    0.01,
    { farmers: 1, hills: true },
    { farmYield: 0.12 },
  ),
  P(
    "manuring",
    "dunging the fields",
    ["dairying", "plough"],
    0.012,
    { farmers: 1, herders: 0.5 },
    { farmYield: 0.1 },
  ),
  P(
    "heavy-plough",
    "the heavy plough",
    ["plough", "iron|carbide-blades|ice-working"],
    0.01,
    { farmers: 1 },
    { farmYield: 0.2 },
  ),
  P(
    "mills",
    "mills of wind and water",
    ["wheel", "masonry"],
    0.008,
    { crafters: 1, farmers: 0.5 },
    { farmYield: 0.08, keeping: 0.1 },
  ),
  P(
    "beekeeping",
    "keeping bees",
    ["pottery-wheel|pitch-ware|ice-ware"],
    0.01,
    { farmers: 0.5 },
    { forageYield: 0.05 },
  ),
  P("fishing", "boats for fishing", ["sailing"], 0.015, { coast: true }, { forageYield: 0.15 }),
  P("archery", "the bow", [], 0.01, {}, { forageYield: 0.05, arms: 1 }),
  // Stores and keeping.
  P(
    "pottery-wheel",
    "the potter's wheel",
    ["cultivation"],
    0.02,
    { crafters: 1 },
    { pottery: 0.5 },
  ),
  P(
    "granaries",
    "granaries",
    ["pottery-wheel|pitch-ware|ice-ware"],
    0.015,
    { leaders: 0.5, famine: 1 },
    { storage: 6, keeping: 0.2 },
  ),
  P(
    "salting",
    "salting meat",
    ["cultivation"],
    0.01,
    { herders: 0.5, ore: "salt" },
    { keeping: 0.2 },
  ),
  P(
    "brewing",
    "brewing and wine",
    ["pottery-wheel|pitch-ware|ice-ware"],
    0.01,
    { farmers: 0.3 },
    {},
  ),
  // Crafts.
  P("loom", "the loom", ["cultivation"], 0.02, { crafters: 1 }, { clothing: 0.4 }),
  P("dyeing", "dyes", ["loom"], 0.01, { crafters: 1, traders: 0.5 }, {}),
  P("tanning", "tanning", [], 0.01, { crafters: 1, herders: 0.5 }, { clothing: 0.15 }),
  P(
    "bronze",
    "bronze",
    ["metalworking"],
    0.015,
    { crafters: 1, ore: "tin" },
    { tools: 0.4, arms: 1, armour: 1 },
  ),
  P(
    "iron",
    "iron",
    ["bronze|set-edges"],
    0.008,
    { crafters: 1, ore: "iron" },
    { tools: 0.5, farmYield: 0.05, arms: 1 },
  ),
  P(
    "steel",
    "steel",
    ["iron|made-oxygen", "mathematics"],
    0.005,
    { crafters: 1 },
    { tools: 0.2, arms: 1, armour: 1 },
  ),
  P("carpentry", "joinery", ["@edge"], 0.015, { crafters: 1 }, { building: 1 }),
  P(
    "glass",
    "glass",
    ["pottery-wheel|ice-ware|pitch-ware", "metalworking|set-edges"],
    0.006,
    { crafters: 1 },
    {},
  ),
  // Moving and trading.
  P(
    "wheel",
    "the wheel",
    ["pottery-wheel|pitch-ware|ice-ware", "draught"],
    0.012,
    { crafters: 1, traders: 0.5 },
    { carrying: 0.3, haul: 0.1 },
  ),
  P("cart", "the cart", ["wheel"], 0.02, { traders: 1 }, { haul: 0.15, carrying: 0.2 }),
  P("riding", "riding", ["draught"], 0.01, { herders: 1 }, { haul: 0.05, mounts: 1 }),
  P(
    "sailing",
    "sails",
    [],
    0.01,
    { crafters: 0.5, traders: 1, coast: true },
    { carrying: 0.1, ships: 1 },
  ),
  P(
    "shipbuilding",
    "ships of planks",
    ["sailing", "carpentry"],
    0.01,
    { crafters: 1, coast: true },
    { carrying: 0.2, ships: 1 },
  ),
  P(
    "roads",
    "paved roads",
    ["masonry", "currency"],
    0.01,
    { leaders: 1, traders: 0.5 },
    { haul: 0.25, reach: 1 },
  ),
  P(
    "bridges",
    "bridges",
    ["masonry", "carpentry"],
    0.01,
    { crafters: 1, river: true },
    { haul: 0.1 },
  ),
  P(
    "currency",
    "coin",
    ["writing", "metalworking|ice-working|set-edges"],
    0.01,
    { traders: 1, town: 1 },
    { carrying: 0.15 },
  ),
  P(
    "banking",
    "lending",
    ["currency", "mathematics"],
    0.006,
    { traders: 1, town: 1 },
    { carrying: 0.1 },
  ),
  // Knowing and ruling.
  P(
    "writing",
    "writing",
    ["calendar"],
    0.008,
    { leaders: 1, traders: 0.5, town: 1 },
    { writing: 1, learning: 0.5, reach: 1 },
  ),
  P("mathematics", "reckoning", ["writing"], 0.01, { traders: 1, leaders: 0.5 }, { carrying: 0.1 }),
  P(
    "astronomy",
    "the stars' courses",
    ["calendar", "writing"],
    0.008,
    { leaders: 1 },
    { ships: 1 },
  ),
  P("law-codes", "written law", ["writing"], 0.012, { leaders: 1, town: 1 }, {}),
  P(
    "bureaucracy",
    "clerks and tallies",
    ["writing", "law-codes"],
    0.008,
    { leaders: 1, town: 1 },
    { reach: 1 },
  ),
  P(
    "philosophy",
    "philosophy",
    ["writing", "astronomy"],
    0.005,
    { leaders: 1, traders: 0.5 },
    { learning: 0.3 },
  ),
  P("herbalism", "herb-lore", [], 0.015, { famine: 0.5 }, { health: 0.05 }),
  P(
    "medicine",
    "medicine",
    ["herbalism", "writing"],
    0.008,
    { leaders: 0.5, crafters: 0.5 },
    { health: 0.06 },
  ),
  P(
    "sanitation",
    "drains and clean water",
    ["masonry", "medicine"],
    0.006,
    { town: 1 },
    { health: 0.05 },
  ),
  // Sickness understood (Phase 20 M140): its small seeds seen through glass; the young given a
  // mild form so they are spared the sickness; the sick kept apart and the gates shut.
  P(
    "germs",
    "the seeds of sickness",
    ["medicine", "glass|diamond-grit|ice-working", "writing"],
    0.004,
    { leaders: 0.5, crafters: 0.5, town: 1 },
    { health: 0.04 },
  ),
  P("vaccines", "vaccination", ["germs"], 0.004, { leaders: 0.5, town: 1 }, { health: 0.03 }),
  P("quarantine", "keeping the sick apart", ["germs"], 0.005, { leaders: 1, town: 1 }, {}),
  // Building.
  P(
    "masonry",
    "building in stone",
    ["@edge"],
    0.012,
    { crafters: 1, town: 1 },
    { building: 1, walls: 1 },
  ),
  P("arches", "the arch", ["masonry", "mathematics"], 0.008, { crafters: 1 }, { building: 1 }),
  P(
    "aqueducts",
    "aqueducts",
    ["arches"],
    0.006,
    { leaders: 1, town: 1 },
    { building: 1, health: 0.03 },
  ),
  // War (for M22).
  P("fortification", "walls and ditches", ["masonry"], 0.01, { leaders: 1 }, { walls: 1 }),
  P(
    "chariots",
    "the chariot",
    ["wheel", "riding", "@edge"],
    0.008,
    { leaders: 1, herders: 0.5 },
    { mounts: 1, arms: 1 },
  ),
  P(
    "standing-army",
    "a standing army",
    ["bureaucracy", "@edge"],
    0.006,
    { leaders: 1 },
    { arms: 1 },
  ),
  P(
    "siege-craft",
    "siege-craft",
    ["masonry", "wheel"],
    0.006,
    { leaders: 1, crafters: 0.5 },
    { sieges: 1 },
  ),
  P(
    "cavalry",
    "horsemen",
    ["riding", "iron|carbide-blades|ice-working|set-edges"],
    0.006,
    { leaders: 1, herders: 1 },
    { mounts: 1, arms: 1 },
  ),
  // Power and industry (Phase 3 M32): each fuel only where deep time buried it.
  P("coal-mining", "digging coal", ["iron"], 0.008, { crafters: 1, ore: "coal" }, {}),
  P(
    "clockwork",
    "gears and clocks",
    ["mathematics", "@tough-stuff"],
    0.006,
    { crafters: 1, traders: 0.3 },
    {},
  ),
  P(
    "steam-engine",
    "the steam engine",
    ["coal-mining", "steel", "clockwork"],
    0.005,
    { crafters: 1, ore: "coal" },
    { power: 1, industry: 0.3 },
  ),
  P(
    "factories",
    "the factory",
    ["@engine", "banking"],
    0.006,
    { crafters: 1, traders: 0.5, town: 1 },
    { industry: 0.7 },
  ),
  P(
    "railways",
    "railways",
    ["steam-engine|sun-engines|heat-engines|cold-chemistry", "roads"],
    0.006,
    { traders: 1, leaders: 0.5 },
    { haul: 0.3, carrying: 0.3, reach: 1 },
  ),
  P(
    "steamships",
    "steamships",
    ["steam-engine|sun-engines|heat-engines|cold-chemistry", "shipbuilding"],
    0.006,
    { traders: 1, coast: true },
    { ships: 1, carrying: 0.2 },
  ),
  P(
    "electricity",
    "electricity",
    ["factories", "philosophy"],
    0.004,
    { crafters: 1, leaders: 0.5 },
    { power: 1, industry: 0.5 },
  ),
  P("oil-drilling", "drilling for oil", ["steam-engine"], 0.005, { crafters: 1, ore: "oil" }, {}),
  P(
    "engines",
    "the engine that burns oil",
    ["oil-drilling", "factories"],
    0.004,
    { crafters: 1, traders: 0.5 },
    { power: 1, haul: 0.2 },
  ),
  // The sea's own road (Phase 4 M39): for a people of the water, who have no fire — metal
  // from the vents, parted and refined by currents; power from the tides and the vents' heat.
  P(
    "vent-working",
    "metal from the vents",
    [],
    0.012,
    { crafters: 1, ore: "vent" },
    { tools: 0.3 },
    { media: ["water"] },
  ),
  P(
    "shell-craft",
    "vessels of shell",
    ["cultivation"],
    0.02,
    { crafters: 1 },
    { pottery: 0.5, storage: 3, keeping: 0.1 },
    { media: ["water"] },
  ),
  P(
    "current-reading",
    "riding the currents",
    ["calendar"],
    0.01,
    { traders: 1 },
    { ships: 1, haul: 0.2, carrying: 0.2 },
    { media: ["water"] },
  ),
  P(
    "reef-building",
    "reefs grown into walls",
    ["cultivation"],
    0.012,
    { crafters: 1, town: 1 },
    { building: 1, walls: 1 },
    { media: ["water"] },
  ),
  P(
    "electrochemistry",
    "parting metals with currents",
    ["vent-working", "writing"],
    0.008,
    { crafters: 1 },
    { tools: 0.4, arms: 1, armour: 1 },
    { media: ["water"] },
  ),
  P(
    "refined-metals",
    "metals refined by current",
    ["electrochemistry", "mathematics"],
    0.006,
    { crafters: 1 },
    { tools: 0.5, arms: 1, armour: 1 },
    { media: ["water"] },
  ),
  P(
    "current-mills",
    "mills turned by the tides",
    ["refined-metals", "mathematics"],
    0.005,
    { crafters: 1, traders: 0.3 },
    { power: 1, industry: 0.4, renewable: 1 },
    { media: ["water"] },
  ),
  P(
    "sea-works",
    "works driven by currents",
    ["current-mills", "banking"],
    0.006,
    { crafters: 1, traders: 0.5, town: 1 },
    { industry: 0.7 },
    { media: ["water"] },
  ),
  P(
    "vent-heat",
    "power from the vents' heat",
    ["sea-works"],
    0.005,
    { crafters: 1, ore: "vent" },
    { power: 1, industry: 0.3, renewable: 1 },
    { media: ["water"] },
  ),
  P(
    "sea-electricity",
    "electricity under the sea",
    ["current-mills", "philosophy"],
    0.004,
    { crafters: 1, leaders: 0.5 },
    { power: 1, industry: 0.5, renewable: 1 },
    { media: ["water"] },
  ),
  // The sky (Phase 5 M47): past power, the road to orbit and to the other worlds — by the
  // land's electricity or the sea's; a need written "a|b" is met by either. (Found at seven tenths
  // of their first pace since Phase 52, when metal spreading along its trade roads brought industry
  // a century sooner: so the first satellite comes about 1000, not before 950.)
  P(
    "electronics",
    "valves and wires that reckon",
    ["electricity|sea-electricity|graphite-dynamos|ground-dynamos|polymer-wire", "mathematics"],
    0.0042,
    { crafters: 1, traders: 0.3 },
    { learning: 0.3 },
  ),
  P(
    "rocketry",
    "the rocket",
    ["electricity|sea-electricity|graphite-dynamos|ground-dynamos|polymer-wire", "astronomy"],
    0.0035,
    { crafters: 1, leaders: 0.3 },
    { arms: 1 },
  ),
  P(
    "guidance",
    "machines that steer",
    ["electronics", "clockwork|current-reading"],
    0.0035,
    { crafters: 1 },
    {},
  ),
  P(
    "orbital-flight",
    "flight to orbit",
    ["rocketry", "guidance"],
    0.0028,
    { crafters: 1, leaders: 0.5 },
    {},
  ),
  P(
    "life-support",
    "air and water made in closed halls",
    ["orbital-flight", "medicine"],
    0.0028,
    { crafters: 1 },
    { health: 0.05 },
  ),
  P(
    "stations",
    "halls in orbit",
    ["life-support", "factories|sea-works|sun-engines|heat-engines|cold-chemistry"],
    0.0028,
    { crafters: 1, leaders: 0.3 },
    {},
  ),
  P(
    "transfer-flight",
    "flight between worlds",
    ["orbital-flight", "mathematics"],
    0.0028,
    { crafters: 1, traders: 0.3 },
    {},
  ),
  P(
    "habitats",
    "halls on other worlds",
    ["life-support", "transfer-flight"],
    0.0021,
    { crafters: 1, leaders: 0.3 },
    {},
  ),
  P(
    "nuclear-drive",
    "the atom's fire as a drive",
    ["electronics", "transfer-flight"],
    0.0021,
    { crafters: 1 },
    {},
  ),
  // Between the stars (Phase 6 M57): drives that reach a hundredth of light's speed and
  // more, and ships that keep a crew alive — asleep or born on the way — for the crossing.
  P(
    "fusion-drive",
    "the fusing of light atoms as a drive",
    ["nuclear-drive", "stations"],
    0.0014,
    { crafters: 1, leaders: 0.3 },
    {},
  ),
  P(
    "long-sleep",
    "keeping a crew asleep for years",
    ["life-support", "medicine"],
    0.0014,
    { crafters: 0.5, leaders: 0.3 },
    { health: 0.03 },
  ),
  P(
    "beamed-sails",
    "sails driven by beams of light",
    ["fusion-drive", "electronics"],
    0.00105,
    { crafters: 1, traders: 0.3 },
    {},
  ),
  P(
    "antimatter-drive",
    "the annihilation of matter as a drive",
    ["fusion-drive", "mathematics"],
    0.0007,
    { crafters: 1, leaders: 0.3 },
    {},
  ),
  // Powder and shot (Phase 37 M188): found where those who seek cures mix salts and charcoal
  // and burn them; then the hand-gun its works and its locks make a weapon of; then the rifled
  // barrel its factories bore true. (At the tree's end: what was found before is found as it was.)
  P(
    "gunpowder",
    "black powder",
    ["medicine", "@tough-stuff"],
    0.006,
    { crafters: 1, leaders: 0.5 },
    { sieges: 1 },
  ),
  P(
    "firearms",
    "the musket",
    ["gunpowder", "clockwork"],
    0.006,
    { crafters: 1, leaders: 1 },
    { arms: 1 },
  ),
  P(
    "rifling",
    "the rifle",
    ["firearms", "@works"],
    0.006,
    { crafters: 1, leaders: 0.5 },
    { arms: 1 },
  ),
  // Later arms (Phase 53 M219): the magazine and the drawn-brass cartridge; the rifle that loads
  // itself, on smokeless powder from acids made at scale; the gun that fires while the trigger is
  // held; machine guns in rolled steel on an oil engine. (They count through the host's design,
  // not its field share; at the tree's end, so what was found before is found as it was.)
  P("repeating-fire", "the repeating rifle", ["rifling"], 0.006, { crafters: 1, leaders: 0.5 }, {}),
  P(
    "self-loading",
    "the self-loading rifle",
    ["repeating-fire", "@current"],
    0.005,
    { crafters: 1, leaders: 0.5 },
    {},
  ),
  P(
    "automatic-fire",
    "the machine gun",
    ["self-loading"],
    0.005,
    { crafters: 1, leaders: 0.5 },
    {},
  ),
  P(
    "armoured-vehicles",
    "the armoured car",
    ["automatic-fire", "engines"],
    0.004,
    { crafters: 1, leaders: 0.5 },
    {},
  ),
];

// The kinds' own roads (Phase 56): what a world of each kind does in place of what it cannot. Where
// nothing burns — a carbon world, an ice world — no kiln, furnace or engine that burns can be built;
// its people come to vessels, blades, works and power another way, and Earth's later principles
// open by either road ("a|b"). Each asks its world's matter (ROW_ASKS), not its kind (F3).
// Appended after the rest, so every land's draws to find the others (keyed by a principle's
// place) stay what they were.
const KIND_TREE: readonly Principle[] = [
  // A carbon world: diamond and carbide, its native copper beaten cold, the sun's heat gathered in
  // mirrors (no fuel burns), then dynamos, then oxygen made by current, which at last burns the
  // carbon out of its iron.
  P("diamond-grit", "grinding with diamond grit", [], 0.012, { crafters: 1 }, { tools: 0.15 }),
  P(
    "pitch-ware",
    "vessels sealed with pitch",
    ["cultivation"],
    0.02,
    { crafters: 1 },
    { pottery: 0.5 },
  ),
  P(
    "cold-hammering",
    "native copper hammered cold",
    ["cultivation"],
    0.015,
    { crafters: 1, ore: "copper" },
    { tools: 0.2 },
  ),
  P(
    "carbide-blades",
    "carbide iron ground keen",
    ["cold-hammering", "diamond-grit"],
    0.01,
    { crafters: 1, ore: "iron" },
    { tools: 0.5, arms: 1, armour: 1 },
  ),
  P(
    "sun-engines",
    "engines driven by the sun's heat",
    ["mills", "@tough-stuff", "mathematics"],
    0.005,
    { crafters: 1, lacks: "coal" },
    { power: 1, industry: 0.3, renewable: 2 },
  ),
  P(
    "graphite-dynamos",
    "dynamos of copper and graphite",
    ["sun-engines|heat-engines|cold-chemistry", "philosophy"],
    0.004,
    { crafters: 1, leaders: 0.5 },
    { power: 1, industry: 0.5, renewable: 1 },
  ),
  P(
    "made-oxygen",
    "oxygen made by current",
    ["@current", "mathematics"],
    0.004,
    { crafters: 1 },
    { tools: 0.2, arms: 1, armour: 1 },
  ),
  // A sulfur-volcano world: copper from the blue vitriol its acid springs leave, reduced in an open
  // fire with no furnace; walls of grit bound with molten sulfur.
  P(
    "acid-leaching",
    "copper from blue vitriol",
    ["cultivation"],
    0.015,
    { crafters: 1, ore: "copper" },
    { tools: 0.1 },
  ),
  P(
    "sulfur-concrete",
    "sulfur concrete",
    ["masonry"],
    0.01,
    { crafters: 1, town: 1 },
    { building: 1, walls: 1 },
    { heat: 140 },
  ),
  // An ice world: vessels, blades and walls of the ice that is its bedrock.
  P("ice-ware", "vessels cut from ice", ["cultivation"], 0.02, { crafters: 1 }, { pottery: 0.4 }),
  P(
    "ice-working",
    "ice cut and set",
    ["cultivation"],
    0.015,
    { crafters: 1 },
    { tools: 0.3, arms: 1 },
  ),
  // An ammonia world: engines run between the ground's heat and the cold (no fire: a heat engine
  // wants only warmth and cold, and metal to hold its working fluid: iron fallen from the sky, its
  // last principle, below), then electricity of them, in dynamos wound with the same iron.
  P(
    "heat-engines",
    "engines of the ground's heat",
    ["mills", "@tough-stuff", "star-iron|cold-hammering|metalworking", "mathematics"],
    0.005,
    { crafters: 1, lacks: "coal" },
    { power: 1, industry: 0.3, renewable: 2 },
  ),
  P(
    "ground-dynamos",
    "electricity from the ground's heat",
    ["heat-engines", "star-iron|cold-hammering|metalworking", "philosophy"],
    0.004,
    { crafters: 1, leaders: 0.5 },
    { power: 1, industry: 0.5, renewable: 1 },
  ),
  // A methane world: the acetylene and hydrogen its haze makes in sunlight, joined again for their
  // energy (McKay & Smith 2005) over a catalyst of nickel (Sabatier's), the nickel of iron fallen
  // from the sky; then wires of polyacetylene, a polymer that carries current, in dynamos whose
  // magnets are the same iron.
  P(
    "cold-chemistry",
    "acetylene joined with hydrogen",
    ["mills", "ice-working", "star-iron", "mathematics"],
    0.005,
    { crafters: 1 },
    { power: 1, industry: 0.3, renewable: 2 },
  ),
  P(
    "polymer-wire",
    "wires of polyacetylene",
    ["sun-engines|heat-engines|cold-chemistry", "philosophy"],
    0.004,
    { crafters: 1, leaders: 0.5 },
    { power: 1, industry: 0.5, renewable: 1 },
  ),
  // An ice world's only metal: iron fallen from the sky, gathered where its ice strands it (as
  // Antarctica's ice strands meteorites). An ammonia world's is hammered cold (as the Cape York iron
  // was), its nickel keeping it tough in the cold: too little to edge a people's tools, enough for
  // the hearts of their engines and the wire of their dynamos. In a methane world's cold it is as
  // brittle as glass and is never hammered: broken to grit, its nickel is the catalyst its engines
  // join acetylene and hydrogen on, and whole it is the magnet of a dynamo (as tetrataenite, the
  // meteorites' own iron and nickel, is a magnet). Last, so that the kinds' others keep their places.
  P("star-iron", "iron fallen from the sky", ["ice-working"], 0.01, { crafters: 1 }, {}),
];

// Ages past ours (Phase 66, asked for 2026-11-03: "the ages past the ages humans experienced can still
// emerge ... with logic there for it to emerge if present for that world"). Each asks a function of its
// world's matter (rules/properties.ts) as well as what its people know: a flame held only where a crust
// holds what carries a current without loss, a mind of crystal only where one can be had by the tonne.
// Appended last, so that every land's draws to find the others stay what they were, and each opens only
// once the sky's road has been walked: until then no history can tell they are here. (Where a road has
// another way round, "a|b": a world with no flame to hold may yet gather its star's light.)
export const LATE_TREE: readonly Principle[] = [
  {
    ...P(
      "fusion-power",
      "a fusion flame held in a bottle",
      ["fusion-drive", "electronics"],
      0.0009,
      { crafters: 1, leaders: 0.3 },
      { power: 1, industry: 0.3, renewable: 2 },
    ),
    asks: ["wall-a-flame", "hold-a-flame"],
  },
  {
    ...P(
      "machine-minds",
      "minds of crystal",
      ["guidance", "nuclear-drive"],
      0.0005,
      { crafters: 1, traders: 0.3 },
      { learning: 0.5, industry: 0.2 },
    ),
    asks: ["think-in-crystal"],
  },
  {
    ...P(
      "drawn-carbon",
      "carbon drawn and woven",
      ["machine-minds"],
      0.0006,
      { crafters: 1 },
      { tools: 0.2, building: 1 },
    ),
    asks: ["draw-a-fibre"],
  },
  {
    ...P(
      "beam-arms",
      "arms of burning light",
      ["guidance", "nuclear-drive", "fusion-power|machine-minds"],
      0.0004,
      { crafters: 1, leaders: 1 },
      { arms: 1 },
    ),
    asks: ["beam-a-light"],
  },
  {
    ...P(
      "made-bodies",
      "bodies written and grown",
      ["machine-minds", "long-sleep"],
      0.00025,
      { crafters: 0.5, leaders: 0.5, town: 0.5 },
      { health: 0.08 },
    ),
    asks: ["write-a-body"],
  },
  P(
    "machine-soldiers",
    "soldiers of made limbs",
    ["machine-minds", "beam-arms"],
    0.0004,
    { crafters: 1, leaders: 1 },
    { arms: 1 },
  ),
  {
    ...P(
      "star-mirrors",
      "mirrors gathered about the star",
      ["machine-minds", "fusion-drive", "stations"],
      0.0002,
      { crafters: 1, leaders: 0.5 },
      {},
    ),
    asks: ["gather-a-star"],
  },
  P(
    "vat-food",
    "food grown in vats",
    ["made-bodies", "fusion-power|star-mirrors"],
    0.0003,
    { crafters: 1, famine: 1, town: 0.5 },
    { storage: 3, keeping: 0.1 },
  ),
  {
    ...P(
      "world-making",
      "a world's air and water remade",
      ["habitats", "machine-minds", "fusion-power|star-mirrors"],
      0.00025,
      { crafters: 1, leaders: 0.5 },
      {},
    ),
    asks: ["remake-a-world"],
  },
  {
    ...P(
      "world-city",
      "towers from shore to shore",
      ["vat-food", "drawn-carbon"],
      0.0002,
      { crafters: 1, leaders: 0.3, town: 1 },
      { building: 1 },
    ),
    asks: ["roof-a-world"],
  },
];

/** The principles that bring metal to a land, as the vents' does a people of the water (F3: by function, not kind). */
export const METAL_ROOTS: readonly string[] = [
  "vent-working",
  "cold-hammering",
  "acid-leaching",
  "forged-star-iron",
];
/** The engines that are not steam's, whose works want machines as steam's do (F3: by function, not kind). */
export const OWN_ENGINES: readonly string[] = ["sun-engines", "heat-engines", "cold-chemistry"];

/**
 * What each of the land's principles asks of a body (Phase 4 M39): the heat of kilns and
 * smelting (F2), a burning for fuel; the land or the shore for what rolls, sails, is ridden,
 * ploughed, paved or hunted with the bow.
 */
const ASKS: Readonly<Record<string, BodyNeeds>> = {
  "pottery-wheel": { heat: 800 },
  gunpowder: { media: ["land", "shore"] },
  firearms: { media: ["land", "shore"] },
  rifling: { media: ["land", "shore"] },
  "repeating-fire": { media: ["land", "shore"] },
  "self-loading": { media: ["land", "shore"] },
  "automatic-fire": { media: ["land", "shore"] },
  "armoured-vehicles": { media: ["land", "shore"] },
  bronze: { heat: 950 },
  iron: { heat: 1200 },
  steel: { heat: 1100 },
  glass: { heat: 1100 },
  "coal-mining": { burns: true, media: ["land", "shore"] },
  "steam-engine": { burns: true },
  "oil-drilling": { burns: true },
  engines: { burns: true },
  dairying: { media: ["land", "shore"] },
  tanning: { media: ["land", "shore"] },
  draught: { media: ["land", "shore"] },
  plough: { media: ["land", "shore"] },
  irrigation: { media: ["land", "shore"] },
  terracing: { media: ["land", "shore"] },
  riding: { media: ["land", "shore"] },
  wheel: { media: ["land", "shore"] },
  cart: { media: ["land", "shore"] },
  chariots: { media: ["land", "shore"] },
  cavalry: { media: ["land", "shore"] },
  sailing: { media: ["land", "shore"] },
  shipbuilding: { media: ["land", "shore"] },
  steamships: { media: ["land", "shore"] },
  roads: { media: ["land", "shore"] },
  bridges: { media: ["land", "shore"] },
  railways: { media: ["land", "shore"] },
  archery: { media: ["land", "shore"] },
  fishing: { media: ["land", "shore"] },
  mills: { media: ["land", "shore"] },
  aqueducts: { media: ["land", "shore"] },
};

// Arms by what they do (F1): after all others, so every land's draws to find the others stay what they
// were. Long blades of hard flakes set in a spine, and plates bound in fibre; then, for a people of the
// water, darts driven by gas and lances of sound (water stops a ball within metres).
export const MEANS_TREE: readonly Principle[] = [
  {
    ...P(
      "set-edges",
      "long blades set with hard flakes",
      ["ice-working|carbide-blades|diamond-grit|shell-craft|writing", "loom"],
      0.012,
      { crafters: 1, lacks: "metal" },
      { tools: 0.1, arms: 1 },
    ),
    asks: ["edge-without-metal"],
  },
  {
    ...P(
      "bound-plates",
      "plates bound in fibre",
      ["set-edges"],
      0.01,
      { crafters: 1 },
      { armour: 1 },
    ),
    asks: ["edge-without-metal"],
  },
  {
    ...P(
      "gas-darts",
      "long darts driven by gas",
      ["electrochemistry", "mathematics"],
      0.006,
      { crafters: 1, leaders: 0.5 },
      { arms: 1 },
      { media: ["water"] },
    ),
    asks: ["make-gas-fast"],
  },
  P(
    "sound-lances",
    "lances of sound",
    ["gas-darts", "@current"],
    0.005,
    { crafters: 1, leaders: 0.5 },
    { arms: 1 },
    { media: ["water"] },
  ),
];
/** What each row asks of its world's matter (rules/properties.ts): F1's, and those that were one kind's (F3). */
const ROW_ASKS: Readonly<Record<string, readonly string[]>> = {
  gunpowder: ["make-gas-fast"],
  firearms: ["make-gas-fast"],
  rifling: ["make-gas-fast"],
  "repeating-fire": ["make-gas-fast"],
  "self-loading": ["make-gas-fast"],
  "automatic-fire": ["make-gas-fast"],
  "pottery-wheel": ["fire-a-vessel"],
  glass: ["melt-a-glass"],
  bronze: ["harden-copper"],
  iron: ["bloom-an-iron"],
  "diamond-grit": ["grind-with-grit"],
  "pitch-ware": ["seal-with-pitch"],
  "cold-hammering": ["hammer-native-copper"],
  "carbide-blades": ["work-carbide-iron"],
  "sun-engines": ["engine-by-mirror"],
  riding: ["ride-a-beast"],
  "graphite-dynamos": ["wind-dynamo"],
  "made-oxygen": ["work-carbide-iron"],
  "acid-leaching": ["leach-with-acid"],
  "sulfur-concrete": ["bind-with-sulfur"],
  "ice-ware": ["work-cold-ice"],
  "ice-working": ["work-cold-ice"],
  "star-iron": ["work-fallen-iron"],
  "heat-engines": ["engine-from-ground"],
  "ground-dynamos": ["engine-from-ground"],
  "cold-chemistry": ["join-gases"],
  "polymer-wire": ["draw-polymer"],
};
/** The means of heat (F2), and what only some worlds' numbers open (F3). After all others, so every land's draws stay. */
export const HEAT_TREE: readonly Principle[] = [
  {
    ...P(
      "ground-furnace",
      "hearths over the ground's heat",
      ["masonry"],
      0.01,
      { crafters: 1, hills: true },
      {},
    ),
    asks: ["heat-from-ground"],
  },
  {
    ...P(
      "sun-furnace",
      "mirrors that gather the sun's heat",
      ["mathematics", "@polished"],
      0.008,
      { crafters: 1 },
      {},
    ),
    asks: ["heat-by-mirror"],
  },
  {
    ...P(
      "joined-hearth",
      "a hearth of joined acetylene",
      ["star-iron"],
      0.012,
      { crafters: 1 },
      {},
    ),
    asks: ["join-gases"],
  },
  {
    ...P(
      "forged-star-iron",
      "iron fallen from the sky, forged hot",
      ["star-iron"],
      0.01,
      { crafters: 1 },
      { tools: 0.1 },
      { heat: 1000 },
    ),
    asks: ["work-fallen-iron"],
  },
  {
    ...P(
      "wings",
      "wings of fibre and cane",
      ["loom", "mathematics"],
      0.006,
      { crafters: 1, leaders: 0.5 },
      { haul: 0.1, reach: 1 },
      { media: ["land", "shore"] },
    ),
    asks: ["fly-on-wings"],
  },
  {
    ...P(
      "tall-frames",
      "towers of light frames",
      ["arches"],
      0.008,
      { crafters: 1, town: 1 },
      { building: 1 },
    ),
    asks: ["build-high"],
  },
  // Wings an engine drives, then loads dropped from them (War past the line, W2). Last, so every land's
  // draws stay at their places until the first is found. What it flies on is its world's and its land's
  // (rules/reach.ts): the least engine that lifts a machine there.
  {
    ...P(
      "powered-wings",
      "wings an engine drives",
      ["steam-engine", "factories"],
      0.005,
      { crafters: 1, leaders: 0.5 },
      {},
      { burns: true, media: ["land", "shore"], lifts: true },
    ),
    asks: ["fly-under-power"],
  },
  {
    ...P(
      "dropped-loads",
      "loads dropped from wings",
      ["powered-wings", "gunpowder"],
      0.006,
      { crafters: 1, leaders: 0.5 },
      {},
      { burns: true, media: ["land", "shore"] },
    ),
    asks: ["fly-under-power", "make-gas-fast"],
  },
  // Rockets that carry a load to a far town (War past the line, W3). Last again, so every land's draws stay at
  // their places until the first is found. What shuts it is its world's numbers (throw-far: rules/reach.ts).
  {
    ...P(
      "thrown-loads",
      "loads a rocket carries to a far town",
      ["rocketry", "gunpowder"],
      0.006,
      { crafters: 1, leaders: 0.5 },
      {},
      { media: ["land", "shore"] },
    ),
    asks: ["throw-far", "make-gas-fast"],
  },
];

export const PRINCIPLES: readonly Principle[] = [
  ...TREE,
  ...KIND_TREE,
  ...LATE_TREE,
  ...MEANS_TREE,
  ...HEAT_TREE,
].map((p) => {
  const q = ASKS[p.id] ? { ...p, body: ASKS[p.id] } : p,
    r = q.needs.some((n) => n.includes("@")) ? { ...q, needs: q.needs.map(expand) } : q;
  return ROW_ASKS[r.id] ? { ...r, asks: ROW_ASKS[r.id]! } : r;
});

export const PRINCIPLE_INDEX: ReadonlyMap<string, number> = new Map(
  PRINCIPLES.map((p, i) => [p.id, i]),
);

/** A principle by id. */
export function principle(id: string): Principle {
  const i = PRINCIPLE_INDEX.get(id);
  if (i === undefined) throw new Error(`no principle ${id}`);
  return PRINCIPLES[i]!;
}
