// Principles (docs/architecture §22): what a people can come to know, as data. Each
// has what it needs known first, what drives its finding (the people who would find
// it, the pressures that would push them, what the land must hold), and what it
// changes once known. Effects are keyed numbers the owning systems read; some wait
// for systems still to come (war, buildings) and are recorded now so the tree is
// whole. Two roots are known by the older systems: cultivation and metalworking.

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
};

export type Principle = {
  readonly id: string;
  readonly name: string;
  readonly needs: readonly string[];
  /** How likely finding is in a year, before the drivers. */
  readonly rate: number;
  readonly drivers: Drivers;
  readonly effects: Partial<Record<Effect, number>>;
};

const P = (
  id: string,
  name: string,
  needs: string[],
  rate: number,
  drivers: Drivers,
  effects: Partial<Record<Effect, number>>,
): Principle => ({ id, name, needs, rate, drivers, effects });

export const PRINCIPLES: readonly Principle[] = [
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
    ["plough", "iron"],
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
  P("beekeeping", "keeping bees", ["pottery-wheel"], 0.01, { farmers: 0.5 }, { forageYield: 0.05 }),
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
    ["pottery-wheel"],
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
  P("brewing", "brewing and wine", ["pottery-wheel"], 0.01, { farmers: 0.3 }, {}),
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
    ["bronze"],
    0.008,
    { crafters: 1, ore: "iron" },
    { tools: 0.5, farmYield: 0.05, arms: 1 },
  ),
  P(
    "steel",
    "steel",
    ["iron", "mathematics"],
    0.005,
    { crafters: 1 },
    { tools: 0.2, arms: 1, armour: 1 },
  ),
  P("carpentry", "joinery", ["bronze"], 0.015, { crafters: 1 }, { building: 1 }),
  P("glass", "glass", ["pottery-wheel", "metalworking"], 0.006, { crafters: 1 }, {}),
  // Moving and trading.
  P(
    "wheel",
    "the wheel",
    ["pottery-wheel", "draught"],
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
    ["writing", "metalworking"],
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
  // Building.
  P(
    "masonry",
    "building in stone",
    ["bronze"],
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
    ["wheel", "riding", "bronze"],
    0.008,
    { leaders: 1, herders: 0.5 },
    { mounts: 1, arms: 1 },
  ),
  P(
    "standing-army",
    "a standing army",
    ["bureaucracy", "bronze"],
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
    ["riding", "iron"],
    0.006,
    { leaders: 1, herders: 1 },
    { mounts: 1, arms: 1 },
  ),
];

export const PRINCIPLE_INDEX: ReadonlyMap<string, number> = new Map(
  PRINCIPLES.map((p, i) => [p.id, i]),
);

/** A principle by id. */
export function principle(id: string): Principle {
  const i = PRINCIPLE_INDEX.get(id);
  if (i === undefined) throw new Error(`no principle ${id}`);
  return PRINCIPLES[i]!;
}
