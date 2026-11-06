// What a home holds (Lives L6, asked for 2026-11-04: "bringing back og causalis ... sims like game play"; Classic's cutaway
// homes, its section 32f): what its people need for what they do (sleep, cook, keep warm, keep what they have), made of what
// their land and market hold, and as much of it as they can pay for. Nothing here says a family at a level owns a thing: a need
// lists its ways, the best first, each with what it asks of the world and what it costs at the market; the first they can pay
// for is what stands there. A pure function of the facts given, so the same home holds the same things every time, and nothing
// here is kept or read by the simulation. Every number in it is a first guess. Sizes are a room's own metres: a figure, as the
// town draws it, stands ROOM_UNIT x 1.7 m high, so a room fits the bodies drawn in it.
import { GOODS, G } from "./goods.ts";
import type { Medium } from "./bodies.ts";

/** World units to a metre of a room, for a body of an upright ape's size: they stand 0.55 high as the town draws them. */
export const ROOM_UNIT = 0.32;
/** Coin to a unit of grain at its usual price: a unit feeds a person for a month, and a coin is a day's bread (Lives L3). */
export const COIN_A_UNIT = 30;
/** What the poorest have at least, in coin: what can be scraped together or made at home. */
export const POOREST = 60;
/** Days a year wages come in; how many years of what is left over a home's things stand for; how much of that goes on them. */
export const WORK_DAYS = 300,
  SAVED_YEARS = 10,
  SAVED_SHARE = 0.2;
/** What a land making so much a head a year, at its goods' usual worth, is reckoned against: wages as the L3 table has them. */
export const MADE_USUAL = 25;
/** The most and least a land's making moves its wages by. */
export const LAND_MOST = 12,
  LAND_LEAST = 0.3;
/** How far a family stands above or below their town's middle: e to the power of this, up and down. */
export const CLASS_SPREAD = 2;
/** The share of a family's standing that is their street (nearer the square), the rest what is keyed to them. */
export const HEART_SHARE = 0.35;
/** A ruler or a voice of a court: their wages again, so many times over. */
export const COURT_TIMES = 8;
/** Coin that buys the next room: the first at this, doubling. */
export const ROOM_COIN = 900;

/** What each level of home gives one family, at most: rooms, and how many floors they lie on. */
export const LEVEL_ROOMS: readonly { readonly rooms: number; readonly floors: number }[] = [
  { rooms: 1, floors: 1 },
  { rooms: 3, floors: 1 },
  { rooms: 8, floors: 3 },
  { rooms: 2, floors: 1 },
  { rooms: 3, floors: 1 },
  { rooms: 4, floors: 1 },
  { rooms: 6, floors: 1 },
];
/** A room's floor (square metres): the first holds what one room must, the rest are smaller. */
export const ROOM_AREA = 17;
/** How many families a home of each level holds: its share of a tall home is one flat. */
export const FAMILY_SIZE = 4.5;

export type DwellingStuff =
  | "wood"
  | "reed"
  | "hide"
  | "cloth"
  | "clay"
  | "metal"
  | "stone"
  | "earth"
  | "shell"
  | "glass"
  | "works"
  | "kelp"
  | "wax"
  | "none";
export type DwellingShape =
  | "bed"
  | "pallet"
  | "hollow"
  | "hearth"
  | "pit"
  | "stove"
  | "pot"
  | "jar"
  | "chest"
  | "table"
  | "mat"
  | "seat"
  | "longseat"
  | "lamp"
  | "bulb"
  | "loom"
  | "bench"
  | "wheel"
  | "tool"
  | "arm"
  | "shelf"
  | "rug"
  | "hanging"
  | "books"
  | "mirror"
  | "clock"
  | "screen"
  | "bath"
  | "basin"
  | "strongbox"
  | "coldbox"
  | "rubble"
  | "beam";
export type RoomUse = "all" | "hearth" | "sit" | "sleep" | "store" | "work" | "wash";

type GoodId = keyof typeof G;

/** What the facts of a home come to. */
export type DwellingFacts = {
  /** The home's own number: what is keyed to it. */
  readonly key: number;
  readonly level: number;
  /** Its design's shape ("round", "hive", "warren"), walls. */
  readonly form: string;
  readonly walls: string;
  /** Those who live there, known or reckoned (at least one is reckoned for its things). */
  readonly people: number;
  readonly medium: Medium;
  /** Limbs that can grip a tool or sit to a table. */
  readonly grips: boolean;
  /** How much larger than an upright ape's body theirs is (their rooms are as much larger). */
  readonly scale: number;
  /** Fuel burns here and a body can keep a fire. */
  readonly burns: boolean;
  /** A heat of the land's own they can work with, where nothing burns (null: none). */
  readonly heat: string | null;
  /** How warm its land is (°C). */
  readonly warmth: number;
  /** Their land knows this. */
  readonly knows: (id: string) => boolean;
  /** What they can spend on what they keep (coin), and a good's market price in grain. */
  readonly coin: number;
  readonly price: (good: number) => number;
  /** What the land holds. */
  readonly wood: boolean;
  readonly cloth: boolean;
  readonly vessel: string | null;
  readonly metal: string;
  /** What those who live there do (a trade's word), and whether one of them came home from war. */
  readonly work: readonly string[];
  readonly fought: boolean;
  /** One who rules or sits at a court lives here (they keep one room more than the level gives). */
  readonly court: boolean;
  /** Its people do not count kin (no one's home: a hall for those who sleep there). */
  readonly noHouses: boolean;
  /** It stands (0), was let fall (1), or was burnt or shaken down (2). */
  readonly ruin: 0 | 1 | 2;
};

/** A way of meeting a need. */
export type DwellingWay = {
  readonly id: string;
  readonly name: string;
  readonly stuff: DwellingStuff;
  readonly shape: DwellingShape;
  /** What it costs in goods, at the market's price (none: made at home, or free for the taking). */
  readonly cost: Partial<Record<GoodId, number>>;
  readonly asks: (f: DwellingFacts) => boolean;
};

/** A need of those who live in a home: what it is for, where it stands, how many, its share of what they can spend, its ways. */
export type DwellingNeed = {
  readonly id: string;
  readonly why: string;
  readonly room: RoomUse;
  readonly per: "home" | "person" | "room";
  readonly share: number;
  readonly ways: readonly DwellingWay[];
};

const WAY = (
  id: string,
  name: string,
  stuff: DwellingStuff,
  shape: DwellingShape,
  cost: DwellingWay["cost"],
  asks: DwellingWay["asks"] = () => true,
): DwellingWay => ({ id, name, stuff, shape, cost, asks });

const onLand = (f: DwellingFacts) => f.medium !== "water",
  inWater = (f: DwellingFacts) => f.medium === "water",
  hands = (f: DwellingFacts) => f.grips && onLand(f),
  joined = (f: DwellingFacts) => f.wood && hands(f) && (f.knows("carpentry") || f.metal !== "stone"),
  current = (f: DwellingFacts) =>
    f.knows("electricity") ||
    f.knows("sea-electricity") ||
    f.knows("graphite-dynamos") ||
    f.knows("ground-dynamos");

/** The table of needs, in the order they are met: first guesses, each a way of living from its body and its world. */
export const NEEDS: readonly DwellingNeed[] = [
  {
    id: "sleep",
    why: "Somewhere to sleep",
    room: "sleep",
    per: "person",
    share: 0.35,
    ways: [
      WAY("kelp-hammock", "a kelp hammock", "kelp", "pallet", { clothing: 0.1 }, inWater),
      WAY("shell-hollow", "a shell-lined hollow", "shell", "hollow", { pottery: 0.3 }, inWater),
      WAY("sand-hollow", "a hollow in the sand", "none", "hollow", {}, inWater),
      WAY(
        "sprung-bed",
        "a sprung bed",
        "metal",
        "bed",
        { machines: 0.08, clothing: 0.8 },
        (f) => hands(f) && f.cloth && f.knows("steam-engine") && current(f),
      ),
      WAY(
        "joined-bed",
        "a joined bed with its covers",
        "wood",
        "bed",
        { tools: 0.8, clothing: 0.8 },
        (f) => joined(f) && f.cloth && f.knows("carpentry"),
      ),
      WAY("plank-bed", "a plank bed", "wood", "bed", { tools: 0.3, clothing: 0.15 }, (f) =>
        joined(f),
      ),
      WAY("brick-bed", "a raised bench of brick", "earth", "bed", { pottery: 0.6, clothing: 0.3 }, (f) =>
        onLand(f) && !f.wood && f.vessel !== null,
      ),
      WAY("stuffed-pallet", "a stuffed pallet", "cloth", "pallet", { clothing: 0.12 }, (f) =>
        onLand(f) && f.cloth,
      ),
      WAY("hide-pallet", "a pallet of hides", "hide", "pallet", { hides: 0.2 }, onLand),
      WAY("grass-pallet", "a pallet of dry grass", "reed", "pallet", {}, onLand),
    ],
  },
  {
    id: "cook",
    why: "Somewhere to cook and keep warm",
    room: "hearth",
    per: "home",
    share: 0.2,
    ways: [
      WAY("current-stove", "a stove on the current", "works", "stove", { machines: 0.5 }, (f) =>
        hands(f) && current(f) && (f.knows("electronics") || f.knows("oil-drilling")),
      ),
      WAY(
        "iron-stove",
        "a stove of cast iron",
        "metal",
        "stove",
        { iron: 7 },
        (f) => hands(f) && f.burns && f.knows("coal-mining"),
      ),
      WAY(
        "brick-hearth",
        "a brick hearth under a flue",
        "earth",
        "hearth",
        { pottery: 3 },
        (f) => hands(f) && f.burns && f.knows("masonry"),
      ),
      WAY("stone-hearth", "a hearth of stones", "stone", "hearth", {}, (f) => hands(f) && f.burns),
      WAY("heat-stone", "a slab over the land's own heat", "stone", "hearth", {}, (f) => hands(f) && !f.burns && f.heat !== null),
      WAY("vent-stone", "a stone warmed at a vent", "stone", "hearth", {}, (f) =>
        inWater(f) && f.knows("vent-working"),
      ),
    ],
  },
  {
    id: "pot",
    why: "Something to cook in and eat from",
    room: "hearth",
    per: "home",
    share: 0.05,
    ways: [
      WAY("metal-pot", "a metal pot", "metal", "pot", { tools: 0.1 }, (f) => hands(f) && f.metal !== "stone"),
      WAY("fired-pot", "a fired pot", "clay", "pot", { pottery: 0.1 }, (f) => onLand(f) && f.vessel !== null),
      WAY("hide-bag", "a hide bag", "hide", "pot", {}, onLand),
      WAY("shell-bowl", "a shell bowl", "shell", "pot", {}, inWater),
    ],
  },
  {
    id: "water",
    why: "Something to keep water and food in",
    room: "hearth",
    per: "home",
    share: 0.05,
    ways: [
      WAY("tap", "a tap and basin", "works", "basin", { machines: 0.15 }, (f) =>
        hands(f) && f.knows("sanitation") && f.knows("steam-engine"),
      ),
      WAY("jar", "a storage jar", "clay", "jar", { pottery: 0.2 }, (f) => onLand(f) && f.vessel !== null),
      WAY("net", "a net of what they have gathered", "kelp", "jar", {}, inWater),
    ],
  },
  {
    id: "sit",
    why: "Somewhere to sit and eat together",
    room: "hearth",
    per: "home",
    share: 0.12,
    ways: [
      WAY("table-chairs", "a table and chairs", "wood", "table", { tools: 1.1 }, (f) =>
        joined(f) && f.knows("carpentry"),
      ),
      WAY("table-bench", "a table and benches", "wood", "table", { tools: 0.5 }, joined),
      WAY("woven-mat", "a woven mat", "reed", "mat", { clothing: 0.05 }, onLand),
      WAY("bare-floor", "the bare floor", "none", "mat", {}, () => false),
    ],
  },
  {
    id: "light",
    why: "Light after dark",
    room: "all",
    per: "room",
    share: 0.04,
    ways: [
      WAY("bulb", "an electric bulb", "works", "bulb", { machines: 0.01 }, (f) => current(f) && onLand(f)),
      WAY("oil-lamp", "an oil lamp", "clay", "lamp", { pottery: 0.05 }, (f) =>
        f.burns && hands(f) && f.vessel !== null,
      ),
    ],
  },
  {
    id: "keep",
    why: "Somewhere to keep what they have",
    room: "store",
    per: "home",
    share: 0.08,
    ways: [
      WAY("dresser", "a dresser of ware", "wood", "shelf", { tools: 0.6, pottery: 1 }, (f) =>
        joined(f) && f.knows("carpentry"),
      ),
      WAY("chest", "a chest", "wood", "chest", { tools: 0.3 }, joined),
    ],
  },
  {
    id: "cold",
    why: "Keeping food from spoiling",
    room: "hearth",
    per: "home",
    share: 0.15,
    ways: [
      WAY("cold-box", "a cold box", "works", "coldbox", { machines: 0.6 }, (f) => current(f) && f.knows("electronics")),
    ],
  },
  {
    id: "wash",
    why: "Washing",
    room: "wash",
    per: "home",
    share: 0.15,
    ways: [
      WAY("bath", "a bath", "clay", "bath", { pottery: 5 }, (f) =>
        onLand(f) && (f.knows("sanitation") || f.knows("aqueducts")),
      ),
    ],
  },
  {
    id: "rest",
    why: "Sitting at their ease",
    room: "sit",
    per: "home",
    share: 0.12,
    ways: [
      WAY("long-seat", "a long seat, stuffed", "cloth", "longseat", { tools: 0.5, clothing: 1.2 }, (f) =>
        joined(f) && f.cloth && f.knows("carpentry"),
      ),
    ],
  },
  {
    id: "rug",
    why: "A floor that is warm underfoot and good to see",
    room: "all",
    per: "room",
    share: 0.25,
    ways: [
      WAY("rug", "a dyed rug", "cloth", "rug", { clothing: 1.2 }, (f) =>
        onLand(f) && f.cloth && f.knows("dyeing"),
      ),
    ],
  },
  {
    id: "hanging",
    why: "A wall that is warm and good to see",
    room: "sit",
    per: "home",
    share: 0.1,
    ways: [
      WAY("hanging", "a dyed hanging", "cloth", "hanging", { clothing: 1.5 }, (f) =>
        onLand(f) && f.cloth && f.knows("dyeing"),
      ),
    ],
  },
  {
    id: "read",
    why: "What they read and reckon by",
    room: "sit",
    per: "home",
    share: 0.08,
    ways: [
      WAY("books", "a shelf of books", "wood", "books", { tools: 1.5 }, (f) =>
        hands(f) && f.wood && f.knows("writing"),
      ),
    ],
  },
  {
    id: "see",
    why: "Seeing themselves",
    room: "sleep",
    per: "home",
    share: 0.06,
    ways: [WAY("mirror", "a looking-glass", "glass", "mirror", { tools: 0.7 }, (f) => hands(f) && f.knows("glass"))],
  },
  {
    id: "time",
    why: "Telling the hour",
    room: "sit",
    per: "home",
    share: 0.06,
    ways: [WAY("clock", "a clock", "metal", "clock", { tools: 1.5 }, (f) => hands(f) && f.knows("clockwork"))],
  },
  {
    id: "news",
    why: "News and pictures from far off",
    room: "sit",
    per: "home",
    share: 0.08,
    ways: [WAY("screen", "a screen", "works", "screen", { machines: 0.3 }, (f) => current(f) && f.knows("electronics"))],
  },
  {
    id: "riches",
    why: "Keeping what is worth most",
    room: "store",
    per: "home",
    share: 0.2,
    ways: [WAY("strongbox", "a strongbox", "metal", "strongbox", { iron: 5 }, (f) => hands(f) && f.metal !== "stone" && f.metal !== "copper")],
  },
];

/** What a trade keeps at home, by its word: a person's work seen where they sleep. */
export const WORK_THINGS: Readonly<Record<string, DwellingWay>> = {
  farmer: WAY("hoe", "a hoe by the door", "metal", "tool", { tools: 0.15 }),
  herder: WAY("shears", "shears on a peg", "metal", "tool", { tools: 0.1 }),
  forager: WAY("basket", "a gathering basket", "reed", "pot", {}),
  crafter: WAY("workbench", "a workbench", "wood", "bench", { tools: 0.5 }),
  weaver: WAY("loom", "an upright loom", "wood", "loom", { tools: 0.9 }),
  potter: WAY("wheel", "a potter's wheel", "wood", "wheel", { tools: 0.5 }),
  smith: WAY("tongs", "tongs and a hammer", "metal", "tool", { tools: 0.2 }),
  trader: WAY("ledger", "a counting table", "wood", "bench", { tools: 0.4 }),
};
/** What one who came home from war keeps on the wall. */
export const WAR_THING: DwellingWay = WAY("arm", "the arm they carried home", "metal", "arm", {});
/** What is left where a home fell. */
export const RUIN_THINGS: readonly DwellingWay[] = [
  WAY("rubble", "fallen stones and earth", "stone", "rubble", {}),
  WAY("beam", "a fallen beam", "wood", "beam", {}),
  WAY("shards", "a broken pot", "clay", "pot", {}),
];

/** The size of a thing of a shape, in metres: along a wall, out from it, how high. */
export const SHAPE_SIZE: Readonly<Record<DwellingShape, readonly [number, number, number]>> = {
  bed: [2, 1, 0.55],
  pallet: [1.9, 0.85, 0.16],
  hollow: [1.9, 1, 0.08],
  hearth: [1.1, 1.1, 0.4],
  pit: [1, 1, 0.1],
  stove: [1, 0.7, 0.95],
  pot: [0.5, 0.5, 0.42],
  jar: [0.55, 0.55, 0.75],
  chest: [1.1, 0.6, 0.55],
  table: [1.7, 1, 0.75],
  mat: [1.8, 1.2, 0.03],
  seat: [0.5, 0.5, 0.45],
  longseat: [2, 0.85, 0.8],
  lamp: [0.3, 0.3, 0.9],
  bulb: [0.25, 0.25, 2.1],
  loom: [1.5, 0.6, 1.9],
  bench: [1.5, 0.7, 0.85],
  wheel: [0.8, 0.8, 0.7],
  tool: [0.3, 0.15, 1.3],
  arm: [0.9, 0.15, 1.35],
  shelf: [1.4, 0.45, 1.8],
  rug: [2.4, 1.7, 0.03],
  hanging: [1.5, 0.08, 1.5],
  books: [1.2, 0.35, 1.8],
  mirror: [0.7, 0.08, 1.5],
  clock: [0.5, 0.35, 1.8],
  screen: [1.2, 0.4, 0.95],
  bath: [1.7, 0.8, 0.6],
  basin: [0.8, 0.55, 0.9],
  strongbox: [0.8, 0.6, 0.7],
  coldbox: [0.75, 0.7, 1.7],
  rubble: [1.5, 1.2, 0.4],
  beam: [2.2, 0.3, 0.3],
};

export type DwellingRoom = {
  readonly use: RoomUse;
  /** Its middle and its measures (metres): round rooms are as wide as `w`. */
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly round: boolean;
  /** Which floor it lies on (0 the lowest). */
  readonly floor: number;
};

/** A length of wall within a home: where it runs (metres), and the door left in it. */
export type DwellingWall = {
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
};

export type DwellingThing = {
  /** Its number in the home: its page's. */
  readonly n: number;
  readonly need: string;
  readonly why: string;
  readonly way: string;
  readonly name: string;
  readonly stuff: DwellingStuff;
  readonly shape: DwellingShape;
  readonly cost: DwellingWay["cost"];
  readonly coin: number;
  readonly room: number;
  /** Where it stands (metres), which way it turns, its measures, and whether it stands off the floor (hung on a wall). */
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
};

export type Dwelling = {
  readonly rooms: readonly DwellingRoom[];
  readonly walls: readonly DwellingWall[];
  readonly things: readonly DwellingThing[];
  /** How far it spreads, each way from its middle (metres). */
  readonly halfW: number;
  readonly halfD: number;
  /** What was spent, and what was left unspent. */
  readonly spent: number;
};

/** A thing's price in coin at the market now. */
export function wayCoin(way: Pick<DwellingWay, "cost">, price: (good: number) => number): number {
  let coin = 0;
  for (const [good, n] of Object.entries(way.cost) as [GoodId, number][]) coin += n * price(G[good]) * COIN_A_UNIT;
  return coin;
}

/** A good's usual price, as a market with none to read has it. */
export const usualPrice = (good: number): number => GOODS[good]?.value ?? 1;

/** What a family can spend on what they keep (coin), from their wages against their bread, their land's making and their standing. */
export function coinOf(a: {
  /** A day's wages of those who earn, at their land's usual, in coin. */
  readonly wages: number;
  /** A person's bread for a day at the market, and how many eat. */
  readonly bread: number;
  readonly mouths: number;
  /** What their land made last year, a head, at its goods' usual worth. */
  readonly madeHead: number;
  /** Their standing in their town, 0 the lowest to 1 the highest. */
  readonly standing: number;
  readonly court: boolean;
  /** What they pay a day to live there. */
  readonly rent: number;
}): number {
  const land = Math.min(LAND_MOST, Math.max(LAND_LEAST, Math.sqrt(a.madeHead / MADE_USUAL))),
    rank = Math.exp(CLASS_SPREAD * (2 * a.standing - 1)),
    earned = a.wages * land * rank * (a.court ? COURT_TIMES : 1),
    over = Math.max(0, earned - a.bread * a.mouths - a.rent);
  return POOREST + over * WORK_DAYS * SAVED_YEARS * SAVED_SHARE;
}

/** How many rooms a family has: as many as they can pay for, and as a home of that level gives. */
export function roomsOf(f: Pick<DwellingFacts, "level" | "coin" | "court" | "form" | "noHouses">): number {
  const at = LEVEL_ROOMS[f.level] ?? LEVEL_ROOMS[0]!,
    can = 1 + Math.floor(Math.log2(1 + f.coin / ROOM_COIN));
  if (f.noHouses) return 1;
  return Math.max(1, Math.min(at.rooms + (f.court ? 2 : 0), can));
}

/** What each room of so many is for. */
export function roomUses(n: number, working: boolean, washing: boolean): RoomUse[] {
  if (n <= 1) return ["all"];
  const uses: RoomUse[] = ["hearth", "sleep"];
  if (n >= 3) uses.push(working ? "work" : "sleep");
  if (n >= 4) uses.push("sit");
  if (n >= 5) uses.push(working ? "sleep" : "store");
  if (n >= 6) uses.push(washing ? "wash" : "sleep");
  while (uses.length < n) uses.push(uses.length % 2 ? "store" : "sleep");
  return uses;
}

type Rect = { x: number; z: number; w: number; d: number };
const ROUND_FORMS: ReadonlySet<string> = new Set(["round", "hive", "nest", "warren", "shell-tower"]);
/** Whether its rooms are round chambers, its walls curved. */
export const isRound = (f: Pick<DwellingFacts, "form" | "walls">): boolean =>
  ROUND_FORMS.has(f.form) || f.walls === "tent" || f.walls === "burrow";
const unit = (key: number, i: number): number => {
  const v = Math.sin(key * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** Splits a floor into so many rooms, the walls between them going into `walls`, a door left in each. */
function split(r: Rect, n: number, key: number, out: Rect[], walls: DwellingWall[], door: number): void {
  if (n <= 1) {
    out.push(r);
    return;
  }
  const a = Math.floor(n / 2),
    share = (a / n) * (0.92 + 0.16 * unit(key, out.length + 3)),
    gap = door / 2,
    along = r.w >= r.d;
  if (along) {
    const left = r.w * share,
      x = r.x - r.w / 2 + left,
      at = r.z + (unit(key, out.length + 11) - 0.5) * (r.d - door * 2);
    walls.push(
      { ax: x, az: r.z - r.d / 2, bx: x, bz: at - gap },
      { ax: x, az: at + gap, bx: x, bz: r.z + r.d / 2 },
    );
    split({ x: x - left / 2, z: r.z, w: left, d: r.d }, a, key + 1, out, walls, door);
    split({ x: x + (r.w - left) / 2, z: r.z, w: r.w - left, d: r.d }, n - a, key + 2, out, walls, door);
  } else {
    const top = r.d * share,
      z = r.z - r.d / 2 + top,
      at = r.x + (unit(key, out.length + 17) - 0.5) * (r.w - door * 2);
    walls.push(
      { ax: r.x - r.w / 2, az: z, bx: at - gap, bz: z },
      { ax: at + gap, az: z, bx: r.x + r.w / 2, bz: z },
    );
    split({ x: r.x, z: z - top / 2, w: r.w, d: top }, a, key + 1, out, walls, door);
    split({ x: r.x, z: z + (r.d - top) / 2, w: r.w, d: r.d - top }, n - a, key + 2, out, walls, door);
  }
}

/** A home's rooms and the walls between them. Its floors stand in a row going back from the street, the lowest nearest. */
function layOut(f: DwellingFacts, uses: readonly RoomUse[]): { rooms: DwellingRoom[]; walls: DwellingWall[] } {
  const n = uses.length,
    round = isRound(f),
    rooms: DwellingRoom[] = [],
    walls: DwellingWall[] = [];
  if (round) {
    // Round chambers, each as wide as its share of the floor, side by side on a honeycomb, the first in front.
    const across = Math.max(3.8, Math.sqrt(((n > 1 ? ROOM_AREA * 0.75 : ROOM_AREA * (1 + f.people / 10)) * 4) / Math.PI));
    uses.forEach((use, i) => {
      const row = Math.floor(i / 2),
        side = i % 2 ? 0.55 : -0.55,
        x = n === 1 ? 0 : side * across + (row % 2 ? across * 0.28 : -across * 0.28),
        z = n === 1 ? 0 : (((n - 1) >> 1) / 2 - row) * across * 0.95;
      rooms.push({ use, x, z, w: across, d: across, round: true, floor: 0 });
    });
    return { rooms, walls };
  }
  const floors = Math.min(LEVEL_ROOMS[f.level]?.floors ?? 1, Math.ceil(n / 3)),
    gapBetween = 1.1;
  let start = 0,
    z0 = 0;
  const made: { rects: Rect[]; floor: number; first: number }[] = [];
  for (let k = 0; k < floors; k++) {
    const count = Math.ceil((n - start) / (floors - k)),
      area = ROOM_AREA * (count > 1 ? count * 0.8 : 1 + f.people / 12),
      w = Math.sqrt(area * 1.35),
      d = area / w,
      rects: Rect[] = [];
    split({ x: 0, z: z0 - d / 2, w, d }, count, f.key + k * 7, rects, walls, 1);
    made.push({ rects, floor: k, first: start });
    start += count;
    z0 -= d + gapBetween;
  }
  // (The whole set about its middle.)
  const middle = z0 / 2 + gapBetween / 2;
  for (const m of made)
    m.rects.forEach((r, i) => {
      rooms.push({
        use: uses[m.first + i] ?? "sleep",
        x: r.x,
        z: r.z - middle,
        w: r.w,
        d: r.d,
        round: false,
        floor: m.floor,
      });
    });
  return {
    rooms,
    walls: walls.map((l) => ({ ax: l.ax, az: l.az - middle, bx: l.bx, bz: l.bz - middle })),
  };
}

/** Where things stand about a room: along its walls in turn, the far one first; what fills its middle apart. */
class Walker {
  private wall = 0;
  private along = 0.15;
  private readonly hw: number;
  private readonly hd: number;
  private readonly r: DwellingRoom;
  constructor(r: DwellingRoom) {
    this.r = r;
    const k = r.round ? 0.68 : 0.98;
    this.hw = (r.w * k) / 2;
    this.hd = (r.d * k) / 2;
  }
  /** A place along the walls for something so long and so deep (null: no room left). */
  next(w: number, d: number, wide = false): { x: number; z: number; yaw: number } | null {
    for (; this.wall < 4; this.wall++, this.along = 0.15) {
      const len = this.wall % 2 === 0 ? this.hw * 2 : this.hd * 2;
      if (this.along + w > len - (this.wall === 2 && !wide ? 0.7 : 0)) continue;
      const u = -len / 2 + this.along + w / 2;
      this.along += w + 0.12;
      switch (this.wall) {
        case 0:
          return { x: this.r.x + u, z: this.r.z - this.hd + d / 2, yaw: 0 };
        case 1:
          return { x: this.r.x + this.hw - d / 2, z: this.r.z + u, yaw: -Math.PI / 2 };
        case 2:
          return { x: this.r.x - u, z: this.r.z + this.hd - d / 2, yaw: Math.PI };
        default:
          return { x: this.r.x - this.hw + d / 2, z: this.r.z - u, yaw: Math.PI / 2 };
      }
    }
    return null;
  }
}

/**
 * A home's insides: its rooms, the walls between them, and what stands in them, as a pure function of the facts: its needs met in
 * their order, each by the first way that its land allows and its people can pay for, each thing put along a wall of the room it
 * belongs in, or in its middle if that is what it is for.
 */
export function furnish(f: DwellingFacts): Dwelling {
  const scale = 1;
  void scale;
  const working = f.work.some((w) => WORK_THINGS[w]?.shape === "loom" || WORK_THINGS[w]?.shape === "bench" || WORK_THINGS[w]?.shape === "wheel"),
    n = f.ruin ? 1 : roomsOf(f),
    uses = roomUses(n, working, NEEDS.find((x) => x.id === "wash")!.ways.some((w) => w.asks(f))),
    { rooms, walls } = layOut(f, uses),
    walkers = rooms.map((r) => new Walker(r)),
    things: DwellingThing[] = [];
  let left = f.coin,
    spent = 0;
  const roomFor = (use: RoomUse, i: number): number => {
    const at: number[] = [];
    rooms.forEach((r, k) => {
      if (r.use === use) at.push(k);
    });
    if (at.length) return at[i % at.length]!;
    const hearth = rooms.findIndex((r) => r.use === "hearth" || r.use === "all");
    return Math.max(0, hearth);
  };
  const put = (need: { id: string; why: string }, way: DwellingWay, room: number, coin: number): void => {
    const r = rooms[room]!,
      [w, d, h] = SHAPE_SIZE[way.shape];
    // What fills the room's middle: a hearth in one room, a table, a rug. A bulb hangs there.
    const middle =
      way.shape === "rug" ||
      way.shape === "bulb" ||
      way.shape === "table" ||
      way.shape === "mat" ||
      way.shape === "rubble" ||
      way.shape === "beam" ||
      ((way.shape === "hearth" || way.shape === "pit") && r.use === "all");
    let at: { x: number; z: number; yaw: number } | null;
    if (middle) {
      const off = way.shape === "table" && r.use === "all" ? 0.9 : 0,
        rug = way.shape === "rug",
        // (A rug fits the room; a mat beside the fire.)
        sw = rug ? Math.min(r.w * 0.62, w * 1.2) : w,
        sd = rug ? Math.min(r.d * 0.62, d * 1.2) : d;
      things.push({
        n: things.length,
        need: need.id,
        why: need.why,
        way: way.id,
        name: way.name,
        stuff: way.stuff,
        shape: way.shape,
        cost: way.cost,
        coin,
        room,
        x: r.x + (way.shape === "mat" ? r.w * 0.16 : way.shape === "rubble" ? -r.w * 0.1 : 0),
        z: r.z + off + (way.shape === "mat" ? r.d * 0.2 : 0),
        yaw: way.shape === "beam" ? 0.5 : 0,
        w: sw,
        d: sd,
        h,
      });
      return;
    }
    at = walkers[room]!.next(w, d);
    if (!at) {
      // (No wall left for it here: any room with one.)
      for (let k = 0; k < rooms.length && !at; k++) {
        at = walkers[k]!.next(w, d);
        if (at) room = k;
      }
    }
    if (!at) return;
    things.push({
      n: things.length,
      need: need.id,
      why: need.why,
      way: way.id,
      name: way.name,
      stuff: way.stuff,
      shape: way.shape,
      cost: way.cost,
      coin,
      room,
      x: at.x,
      z: at.z,
      yaw: at.yaw,
      w,
      d,
      h,
    });
  };

  if (f.ruin) {
    const ruin = { id: "ruin", why: "What is left" };
    put(ruin, RUIN_THINGS[0]!, 0, 0);
    put(ruin, RUIN_THINGS[1]!, 0, 0);
    if (f.vessel && f.ruin === 1) put(ruin, RUIN_THINGS[2]!, 0, 0);
    return finish(rooms, walls, things, 0);
  }

  const people = Math.max(1, f.noHouses ? Math.max(f.people, 6) : f.people);
  for (const need of NEEDS) {
    // (Each of those it asks of, the same way: not one in a bed and one on the floor.)
    const many = need.per === "person" ? people : need.per === "room" ? rooms.length : 1,
      can = Math.min(left, f.coin * need.share),
      fits = need.ways.filter((w) => w.asks(f)),
      way =
        fits.find((w) => wayCoin(w, f.price) * many <= can) ??
        (need.per === "person" || need.id === "cook" || need.id === "pot"
          ? fits.findLast((w) => wayCoin(w, f.price) === 0)
          : undefined);
    if (!way) continue;
    const coin = wayCoin(way, f.price);
    left -= coin * many;
    spent += coin * many;
    for (let i = 0; i < many; i++)
      put(need, way, need.per === "room" ? i : roomFor(need.room, i), coin);
  }
  // What their work and their wars leave at home.
  const seen = new Set<string>();
  for (const w of f.work) {
    const way = WORK_THINGS[w];
    if (!way || seen.has(way.id)) continue;
    if ((way.stuff === "metal" && !f.grips) || (way.stuff === "wood" && !f.wood)) continue;
    if (!way.asks(f)) continue;
    seen.add(way.id);
    const coin = wayCoin(way, f.price);
    put({ id: "work", why: "Their work" }, way, roomFor("work", 0), coin);
    spent += coin;
  }
  if (f.fought && f.grips) put({ id: "war", why: "What they brought home from war" }, WAR_THING, roomFor("sit", 0), 0);
  return finish(rooms, walls, things, spent);
}

function finish(
  rooms: readonly DwellingRoom[],
  walls: readonly DwellingWall[],
  things: readonly DwellingThing[],
  spent: number,
): Dwelling {
  let halfW = 0,
    halfD = 0;
  for (const r of rooms) {
    halfW = Math.max(halfW, Math.abs(r.x) + r.w / 2);
    halfD = Math.max(halfD, Math.abs(r.z) + r.d / 2);
  }
  return { rooms, walls, things, halfW, halfD, spent };
}

/** The word for a family's standing against what they can spend: said, not told by history. */
export function standingWords(coin: number): string {
  return coin < 200 ? "very little" : coin < 1200 ? "little" : coin < 6000 ? "enough" : coin < 40000 ? "plenty" : "a great deal";
}
