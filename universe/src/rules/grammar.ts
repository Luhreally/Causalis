// Roles and bodies from a world's own physics (B3 of the life plan, docs/architecture/asks-2026-11-12-plan.md Part B).
// A part says what it does; the world's physics says what can do it and what it costs; selection picks; nobody writes
// a creature.
//
// - The places a world offers are read from its numbers: its sunlit sea and the deep under it, its sea floor and the
//   vents in it, its shores and rivers, each kind of its land, the ground under it, the canopy where growths stand
//   tall, the air itself where it is thick enough to bear a flier, its ice, a locked world's twilight belt. Each has
//   its share of the world's face and the energy fixed there: by its light-eaters (the light at its ground, how well
//   its star's light is caught, how fast life's chemistry runs at its warmth) and by its rock-eaters (the heat
//   through its ground, where its rock gives them food).
// - A role is a place, a food and a size. How many links the chain of eating has in a place follows the energy fixed
//   there, about a tenth passing up each link where its eaters breathe oxygen and far less where they ferment (their
//   meals give a fifteenth as much). How many roles a world fills follows how much it fixes in all: a rich one forty
//   and more, five links deep; a dim cold one a dozen, with no great hunters.
// - A world's founding stocks (three to six) are its first bodies' deep plans: their symmetry, what holds their shape
//   (of what its seas hold), how many pairs of limbs they have, what their graspers and wings would be. Every lineage
//   descends from one of them, so one world's beasts are kin and unlike another's.
// - A lineage's body is its stock's plan put to its role's work, each limb a job (a strut, a paddle, a wing, a
//   grasper), and pruned by the checks of rules/physiology.ts: no flier where lift is less than weight, no frame
//   bearing more than it can under the pull, no warm blood on a weak trade or in a cold its coat cannot keep out, no
//   giant on a trade too weak to feed it.
//
// Pure: `u(k)` keyed draws in [0, 1) from the caller. Under the Earthlike prior none of it is read: Earth's beasts are
// Earth's own (rules/creatures.ts creatureBody, as ever).
import { dmath } from "../kernel/index.ts";
import {
  breathingCeiling,
  flight,
  frameBears,
  gasDensity,
  keepsWarm,
  largestFrame,
  sensesOf,
  wingsFor,
} from "./physiology.ts";
import type {
  Covering,
  CreatureBody,
  CreatureNiche,
  Eats,
  Feature,
  Frame,
  Grasp,
  Locomotion,
} from "./creatures.ts";

// —— The world as life reads it ————————————————————————————————————————————————————————————————

/** A world's numbers as its life meets them. */
export type LifeWorld = {
  /** Its pull (Earth's 1), its air at the ground (bar) and what a mole of it weighs (g), its free oxygen (bar). */
  readonly gravity: number;
  readonly pressure: number;
  readonly airMolar: number;
  readonly o2: number;
  /** Its mean warmth (true °C). */
  readonly celsius: number;
  /** Its face's shares: sea, ice, land. */
  readonly sea: number;
  readonly ice: number;
  readonly land: number;
  /** Its star's warmth (K), the light at its ground (Earth's 1), the heat through its ground (Earth's 1). */
  readonly starK: number;
  readonly light: number;
  readonly heat: number;
  /** Whether one face is locked to its star. */
  readonly locked: boolean;
  /** What its life is dissolved in; whether that carries a current; its density (kg/m³). */
  readonly liquid: string;
  readonly conducts: boolean;
  readonly liquidDensity: number;
  /** What hardens its bones and its shells (rules/biochem.ts). */
  readonly bone: string;
  readonly shell: string;
  /** Power a kilogram of its light-eaters fix (W, at its warmth; 0: none eat light), and its rock-eaters'. */
  readonly lightPower: number;
  readonly rockPower: number;
  /** Power a kilogram of its eaters get, at 15 °C and at its warmth (W), and the trade they run on. */
  readonly eatPower15: number;
  readonly eatPower: number;
  readonly eatTrade: string;
  /** How fast life's chemistry runs at its warmth against 15 °C (1: as fast). */
  readonly pace: number;
  /** How much of its land is of each kind (shares of its land, each 0 … 1), and of its sea is shallow shelf. */
  readonly lands: LandShares;
};

/** How a world's land divides: open grass, woods, the tall wet forest, desert, cold land; with rivers through it. */
export type LandShares = {
  readonly grass: number;
  readonly wood: number;
  readonly tall: number;
  readonly desert: number;
  readonly cold: number;
  readonly rivers: number;
  readonly shelf: number;
  /** Its sea floor near where its plates part (the vents' share of its sea). */
  readonly vents: number;
};

/** The air's density at the ground, kg/m³. */
export function airDensity(w: Pick<LifeWorld, "pressure" | "airMolar" | "celsius">): number {
  return gasDensity(w.pressure, w.airMolar, w.celsius + 273.15);
}

// —— Places ————————————————————————————————————————————————————————————————————————————————————

export type Place =
  | "sunlit sea"
  | "deep"
  | "sea floor"
  | "vents"
  | "shore"
  | "river"
  | "grassland"
  | "woodland"
  | "desert"
  | "cold land"
  | "underground"
  | "canopy"
  | "air"
  | "ice"
  | "twilight";

/** What a place is: in its liquid or on land or in the air or under the ground; lit or dark; its words. */
export const PLACES: Readonly<
  Record<
    Place,
    {
      readonly medium: "sea" | "land" | "air" | "under";
      readonly lit: boolean;
      readonly icon: string;
      readonly words: string;
    }
  >
> = {
  "sunlit sea": { medium: "sea", lit: true, icon: "🌊", words: "the sunlit sea" },
  deep: { medium: "sea", lit: false, icon: "🌑", words: "the deep, below the light" },
  "sea floor": { medium: "sea", lit: false, icon: "🪨", words: "the sea floor" },
  vents: { medium: "sea", lit: false, icon: "♨️", words: "the vents in its sea floor" },
  shore: { medium: "land", lit: true, icon: "🏝️", words: "its shores, where tide and land meet" },
  river: { medium: "sea", lit: true, icon: "🏞️", words: "its rivers and lakes" },
  grassland: { medium: "land", lit: true, icon: "🌾", words: "its open grassland" },
  woodland: { medium: "land", lit: true, icon: "🌳", words: "its woods" },
  desert: { medium: "land", lit: true, icon: "🏜️", words: "its deserts" },
  "cold land": { medium: "land", lit: true, icon: "🧊", words: "its cold lands" },
  underground: { medium: "under", lit: false, icon: "🕳️", words: "the ground under it" },
  canopy: { medium: "land", lit: true, icon: "🌴", words: "the canopy of its tall forests" },
  air: { medium: "air", lit: true, icon: "🪽", words: "the air itself" },
  ice: { medium: "land", lit: true, icon: "❄️", words: "its ice" },
  twilight: {
    medium: "land",
    lit: true,
    icon: "🌗",
    words: "the twilight belt between its day side and its night side",
  },
};
export const PLACE_LIST = Object.keys(PLACES) as readonly Place[];

/** Whether a place is lived in within the liquid. */
export function wetPlace(p: string): boolean {
  return (PLACES as Record<string, { medium: string }>)[p]?.medium === "sea";
}

/** A place as a world offers it: its share of the face, the energy fixed there a unit of it (Earth's land 1), and why. */
export type PlaceRead = {
  readonly place: Place;
  readonly share: number;
  readonly energy: number;
  /** The share times the energy: what the place fixes in all (Earth's whole land about 0.3). */
  readonly fixed: number;
  /** How many links its chain of eating has: 1 its growths alone … 5. */
  readonly links: number;
  readonly why: string;
  /** Why it is not offered (null: it is). */
  readonly shut: string | null;
};

/** The least energy a link of eating lives on, a world's whole face against Earth's land (an estimate). */
export const LEAST_FIXED = 2e-5;

/** How much of what one link eats passes up to the next: a tenth where its eaters breathe oxygen, less on a weaker trade. */
export function passedUp(w: Pick<LifeWorld, "eatPower15">): number {
  return 0.1 * Math.min(1, Math.sqrt(Math.max(0, w.eatPower15) / 4));
}

/** How many links a chain of eating on `fixed` has (its growths the first). */
export function linksOn(fixed: number, w: Pick<LifeWorld, "eatPower15">): number {
  if (fixed < LEAST_FIXED) return fixed > 0 ? 1 : 0;
  const f = passedUp(w);
  return Math.max(1, Math.min(5, 1 + Math.floor(dmath.log(fixed / LEAST_FIXED) / -dmath.log(f))));
}

/** The light a light-eater fixes, against Earth's sunlit land (its trade's power at its warmth, Earth's being 2 W a kilogram). */
function lightFixed(w: LifeWorld): number {
  return w.lightPower / 2;
}

/** What rock-eaters fix where the heat comes up, against Earth's sunlit land (an estimate: Earth's vents a hundredth of its land, a unit of each). */
function rockFixed(w: LifeWorld): number {
  if (w.rockPower <= 0) return 0;
  return 0.011 * Math.min(3, w.heat) * Math.min(2, Math.sqrt(w.rockPower / 0.17));
}

/** Whether a body of a weight can fly in a world's air: lift against weight at the power its trade gives its muscle. */
export function canFly(
  mass: number,
  w: Pick<LifeWorld, "pressure" | "airMolar" | "celsius" | "gravity" | "eatPower15">,
): boolean {
  if (w.pressure < 0.01) return false;
  const f = flight(mass, wingsFor(mass), airDensity(w), w.gravity),
    muscle = Math.min(1.2, w.eatPower15 / 4);
  return f.gives * muscle >= f.needs;
}

/** The heaviest flier a world's air bears (kg; 0: none), bisected. */
export function heaviestFlier(
  w: Pick<LifeWorld, "pressure" | "airMolar" | "celsius" | "gravity" | "eatPower15">,
): number {
  if (!canFly(0.002, w)) return 0;
  let lo = 0.002,
    hi = 1e5;
  if (canFly(hi, w)) return hi;
  for (let i = 0; i < 50; i++) {
    const mid = Math.sqrt(lo * hi);
    if (canFly(mid, w)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Whether a bag of the lightest gas life makes (hydrogen, 2 g a mole) floats in its air: the air must weigh far more. */
export function canFloat(w: Pick<LifeWorld, "pressure" | "airMolar" | "celsius">): boolean {
  const k = w.celsius + 273.15;
  return (
    w.pressure >= 0.3 && gasDensity(w.pressure, w.airMolar, k) - gasDensity(w.pressure, 2, k) >= 0.5
  );
}

/** The places a world offers, each with its share, its energy and its links of eating; the shut ones with why. */
export function placesOf(w: LifeWorld): PlaceRead[] {
  const L = lightFixed(w),
    rock = rockFixed(w),
    lit = L > 0,
    seaLit = L * 0.5,
    landShare = Math.max(0, w.land),
    lands = w.lands,
    out: PlaceRead[] = [];
  const add = (place: Place, share: number, energy: number, why: string, shut: string | null) => {
    const ok = !shut && share > 0.0005 && energy > 0,
      fixed = ok ? share * energy : 0;
    out.push({
      place,
      share: ok ? share : 0,
      energy: ok ? energy : 0,
      fixed,
      links: ok ? linksOn(fixed, w) : 0,
      why,
      shut: ok
        ? null
        : (shut ?? (share <= 0.0005 ? "too little of it" : "nothing fixes energy there")),
    });
  };
  const pct = (x: number) => `${Math.round(x * 100)}%`,
    wet = w.sea > 0.01,
    light = lit
      ? `its light-eaters fix ${fig(L)}× what Earth's land does`
      : "nothing there eats light";
  add(
    "sunlit sea",
    w.sea * (1 - lands.shelf),
    seaLit,
    `${pct(w.sea)} of its face is sea; ${light}`,
    !wet ? "it has no sea" : !lit ? "nothing in its sea eats light" : null,
  );
  add(
    "deep",
    w.sea * (1 - lands.shelf) * 0.8,
    seaLit * 0.1 + rock * 0.05,
    "what dies in the light above sinks into it, a tenth of what is fixed there",
    !wet ? "it has no sea" : w.sea < 0.2 ? "its seas are too shallow for a deep" : null,
  );
  add(
    "sea floor",
    w.sea,
    (lit ? seaLit * 0.2 : 0) + rock * 0.3,
    lit ? "the dead fall to it, and its shallows are lit" : "only the heat from below feeds it",
    !wet ? "it has no sea" : null,
  );
  add(
    "vents",
    w.sea * lands.vents,
    rock * 25,
    rock > 0
      ? `heat ${fig(w.heat)}× Earth's comes up where its plates part, and its rock-eaters live on what the water brings up`
      : "",
    !wet ? "it has no sea" : rock <= 0 ? "nothing there lives on the rock's chemistry" : null,
  );
  add(
    "shore",
    Math.min(0.08, 4 * w.sea * landShare * 0.02),
    L * 1.3,
    "tide and river bring food to where sea meets land",
    !wet || landShare < 0.01 ? "it has no coasts" : !lit ? "nothing there eats light" : null,
  );
  add(
    "river",
    landShare * lands.rivers * 0.1,
    L * 0.9,
    `rivers run through ${pct(lands.rivers)} of its land`,
    lands.rivers < 0.01 ? "no rivers run on it" : !lit ? "nothing there eats light" : null,
  );
  add(
    "grassland",
    landShare * lands.grass,
    L * 0.6,
    `${pct(lands.grass)} of its land is open, grown low`,
    !lit ? "nothing there eats light" : null,
  );
  add(
    "woodland",
    landShare * lands.wood,
    L * 1.0,
    `${pct(lands.wood)} of its land is wooded`,
    !lit
      ? "nothing there eats light"
      : !standsTall(w)
        ? "nothing can grow tall enough under its pull"
        : null,
  );
  add(
    "canopy",
    landShare * lands.tall,
    L * 0.8,
    `${pct(lands.tall)} of its land is tall wet forest`,
    !lit
      ? "nothing there eats light"
      : !standsTall(w)
        ? "nothing can grow tall enough under its pull"
        : null,
  );
  add(
    "desert",
    landShare * lands.desert,
    L * 0.1,
    `${pct(lands.desert)} of its land is desert`,
    !lit ? "nothing there eats light" : null,
  );
  add(
    "cold land",
    landShare * lands.cold,
    L * 0.2,
    `${pct(lands.cold)} of its land is cold`,
    !lit ? "nothing there eats light" : null,
  );
  add(
    "underground",
    landShare * 0.6,
    (lit ? L * 0.15 : 0) + rock * 0.02,
    "roots and the dead feed what lives in the soil",
    landShare < 0.01 ? "it has no land" : null,
  );
  const flier = heaviestFlier(w);
  add(
    "air",
    landShare + w.sea * 0.2,
    flier > 0 || canFloat(w) ? L * 0.08 : 0,
    flier > 0
      ? `its air (${fig(w.pressure)} bar under ${fig(w.gravity)} g) bears a flier of up to ${massFig(flier)}`
      : "its air bears a bag of lifting gas, but no wing",
    w.pressure < 0.05
      ? `its air is too thin (${fig(w.pressure)} bar) to bear anything`
      : flier <= 0 && !canFloat(w)
        ? `its air (${fig(w.pressure)} bar under ${fig(w.gravity)} g) bears no flier on what its eaters' trade gives`
        : null,
  );
  add(
    "ice",
    w.ice,
    L * 0.03,
    "light through its ice feeds a film of growth",
    w.ice < 0.01 ? "it has no ice" : !lit ? "nothing there eats light" : null,
  );
  add(
    "twilight",
    w.locked ? landShare * 0.25 : 0,
    L * 0.5,
    "its star stands low on the horizon there, always, and the land is neither burned nor frozen",
    !w.locked ? "it turns, and has no twilight belt" : !lit ? "nothing there eats light" : null,
  );
  return out;
}

/**
 * Whether its growths can stand tall: a stalk lifts its liquid against the pull by its pores' pull (an estimate: Earth's
 * tallest trees 115 m, the height as one over the pull), and a stalk taller than a few metres stands only under a pull
 * that lets it (under 3 g).
 */
export function standsTall(w: Pick<LifeWorld, "gravity" | "pressure">): boolean {
  return tallestGrowth(w) >= 3;
}

/** The tallest a growth stands, m (an estimate: Earth's 115 m, as one over the pull; in a near vacuum, low). */
export function tallestGrowth(w: Pick<LifeWorld, "gravity" | "pressure">): number {
  return (115 / Math.max(0.1, w.gravity)) * Math.min(1, w.pressure / 0.05);
}

// —— Roles ——————————————————————————————————————————————————————————————————————————————————————

/** What a role eats. */
export type Food =
  | "light"
  | "graze"
  | "browse"
  | "seeds"
  | "filter"
  | "rot"
  | "roots"
  | "chase"
  | "ambush"
  | "scavenge";

export const FOOD_WORDS: Readonly<Record<Food, string>> = {
  light: "eats light",
  graze: "grazes low growth",
  browse: "browses tall growth",
  seeds: "eats seeds and fruit",
  filter: "sifts small life from the water or the air",
  rot: "eats the dead and the rot",
  roots: "digs for roots",
  chase: "runs its prey down",
  ambush: "lies in wait for its prey",
  scavenge: "eats what the hunters leave",
};

export type SizeClass = "small" | "mid" | "large" | "giant";
/** Each size class's weights, kg. */
export const SIZE_RANGE: Readonly<Record<SizeClass, readonly [number, number]>> = {
  small: [0.02, 2],
  mid: [2, 100],
  large: [100, 1500],
  giant: [1500, 40_000],
};

/** A role: a place, a food, a size, its link in the chain, the energy it lives on, and the niche the simulation knows it by. */
export type Role = {
  readonly place: Place;
  readonly food: Food;
  readonly size: SizeClass;
  readonly level: number;
  readonly energy: number;
  readonly niche: CreatureNiche;
  /** In words: "a large grazer of its open grassland". */
  readonly words: string;
};

/** What each place's first eaters eat, the share of what is fixed there each gets. */
const PLACE_FOODS: Readonly<Record<Place, readonly (readonly [Food, number])[]>> = {
  "sunlit sea": [
    ["filter", 0.6],
    ["graze", 0.4],
  ],
  deep: [
    ["filter", 0.5],
    ["rot", 0.5],
  ],
  "sea floor": [
    ["rot", 0.5],
    ["graze", 0.3],
    ["filter", 0.2],
  ],
  vents: [
    ["graze", 0.6],
    ["filter", 0.4],
  ],
  shore: [
    ["graze", 0.5],
    ["filter", 0.3],
    ["rot", 0.2],
  ],
  river: [
    ["filter", 0.4],
    ["graze", 0.6],
  ],
  grassland: [
    ["graze", 0.7],
    ["seeds", 0.3],
  ],
  woodland: [
    ["browse", 0.5],
    ["seeds", 0.3],
    ["graze", 0.2],
  ],
  canopy: [
    ["browse", 0.6],
    ["seeds", 0.4],
  ],
  desert: [
    ["graze", 0.6],
    ["seeds", 0.4],
  ],
  "cold land": [
    ["graze", 0.8],
    ["seeds", 0.2],
  ],
  underground: [
    ["roots", 0.6],
    ["rot", 0.4],
  ],
  air: [
    ["seeds", 0.6],
    ["filter", 0.4],
  ],
  ice: [["graze", 1]],
  twilight: [
    ["graze", 0.6],
    ["browse", 0.4],
  ],
};

/** The sizes a food's eaters come in, with how much each is weighed. */
const FOOD_SIZES: Readonly<Record<Food, readonly (readonly [SizeClass, number])[]>> = {
  light: [],
  graze: [
    ["mid", 1],
    ["large", 0.8],
    ["giant", 0.25],
    ["small", 0.4],
  ],
  browse: [
    ["mid", 1],
    ["large", 0.7],
    ["giant", 0.3],
  ],
  seeds: [
    ["small", 1],
    ["mid", 0.3],
  ],
  filter: [
    ["small", 1],
    ["mid", 0.4],
    ["giant", 0.15],
  ],
  rot: [
    ["small", 1],
    ["mid", 0.2],
  ],
  roots: [
    ["small", 1],
    ["mid", 0.4],
  ],
  chase: [
    ["mid", 1],
    ["large", 0.5],
    ["small", 0.5],
  ],
  ambush: [
    ["mid", 0.8],
    ["small", 0.8],
    ["large", 0.3],
  ],
  scavenge: [
    ["mid", 1],
    ["small", 0.3],
  ],
};

/**
 * The heaviest an active body grows on its eaters' trade, kg (an estimate: on breathing oxygen Earth's whales', on
 * fermenting a few tens of kilograms, as the cube of the power it gives).
 */
export function heaviestOnTrade(w: Pick<LifeWorld, "eatPower15">): number {
  return 1.9e5 * dmath.pow(Math.min(1, Math.max(0, w.eatPower15) / 4), 3);
}

/** The niche the simulation knows a role by (its herds, hunts and catches). */
export function nicheOf(place: Place, food: Food, size: SizeClass, level: number): CreatureNiche {
  const medium = PLACES[place].medium;
  if (medium === "sea") return "swimmer";
  if (level >= 4) return "hunter";
  if (level === 3)
    return food === "scavenge" ? "scavenger" : size === "large" ? "hunter" : "small hunter";
  if (medium === "air") return "seed-eater";
  if (food === "graze")
    return size === "giant" ? "great beast" : size === "small" ? "seed-eater" : "grazer";
  if (food === "browse") return size === "giant" ? "great beast" : "browser";
  return "seed-eater";
}

/** A role in words: "a large grazer of its open grassland". */
export function roleWords(r: Pick<Role, "place" | "food" | "size" | "level">): string {
  const who =
      r.food === "chase" || r.food === "ambush"
        ? r.level >= 4
          ? "great hunter"
          : "hunter"
        : r.food === "scavenge"
          ? "scavenger"
          : r.food === "graze"
            ? "grazer"
            : r.food === "browse"
              ? "browser"
              : r.food === "seeds"
                ? "seed-eater"
                : r.food === "filter"
                  ? "sifter"
                  : r.food === "rot"
                    ? "rot-eater"
                    : r.food === "roots"
                      ? "root-digger"
                      : "light-eater",
    size = r.size === "mid" ? "" : `${r.size} `,
    words = `${size}${who} of ${PLACES[r.place].words}`;
  return `${/^[aeiou]/.test(words) ? "an" : "a"} ${words}`;
}

/** The roles a world can fill, the richest first, and how many it fills. */
export type RolesRead = {
  readonly places: readonly PlaceRead[];
  /** Every role its energy and physics allow, the richest first. */
  readonly roles: readonly Role[];
  /** How many of them it fills (the richest), from all it fixes. */
  readonly fills: number;
  /** All it fixes, its whole face against Earth's land. */
  readonly fixed: number;
  /** Its longest chain of eating. */
  readonly links: number;
};

const SIZE_ORDER: readonly SizeClass[] = ["small", "mid", "large", "giant"];
/**
 * The largest a place's beasts grow (the canopy's as Earth's largest climbers, under a hundred kilograms; the soil's and
 * the vents' as small; the sea's and the land's to giants).
 */
const PLACE_LARGEST: Readonly<Record<Place, SizeClass>> = {
  "sunlit sea": "giant",
  deep: "giant",
  "sea floor": "large",
  vents: "mid",
  shore: "large",
  river: "large",
  grassland: "giant",
  woodland: "giant",
  canopy: "mid",
  desert: "giant",
  "cold land": "giant",
  underground: "mid",
  air: "large",
  ice: "large",
  twilight: "giant",
};

/** The most roles a world fills (one lineage each, living, and room for the dead and its growths). */
export const MOST_ROLES = 44;

/**
 * The roles a world can fill: in each place it offers, its first eaters by what its growths give, their hunters to as
 * many links as its energy carries, each in the sizes its physics allows; how many it fills from all it fixes.
 */
export function rolesOf(w: LifeWorld): RolesRead {
  const places = placesOf(w),
    f = passedUp(w),
    heaviest = heaviestOnTrade(w),
    flier = heaviestFlier(w),
    floats = canFloat(w),
    roles: Role[] = [];
  for (const p of places) {
    if (p.shut || p.links < 2) continue;
    const air = p.place === "air",
      sea = PLACES[p.place].medium === "sea",
      bound = (s: SizeClass) => {
        const [lo] = SIZE_RANGE[s];
        if (lo > heaviest || SIZE_ORDER.indexOf(s) > SIZE_ORDER.indexOf(PLACE_LARGEST[p.place]))
          return false;
        // (A flier as heavy as the air bears; a floater of any weight its bag lifts, to a large one.)
        if (air) return lo <= flier || (floats && s !== "giant");
        // (A giant on land needs bones to bear it: a stock may yet have them; the sea bears more.)
        if (s === "giant" && !sea) return largestFrame("bones", w.gravity) >= lo;
        return true;
      };
    const firsts = PLACE_FOODS[p.place];
    for (const [food, share] of firsts) {
      const e = p.fixed * share * f;
      for (const [size, weigh] of FOOD_SIZES[food])
        if (
          bound(size) &&
          (size !== "giant" || p.fixed > 0.01) &&
          (size !== "large" || p.fixed > 0.002)
        )
          roles.push(role(p.place, food, size, 2, e * weigh));
    }
    // The hunters, a link at a time, while its energy carries them.
    for (let level = 3; level <= p.links; level++) {
      const e = p.fixed * dmath.pow(f, level - 1),
        sizes: SizeClass[] =
          level === 3 ? ["small", "mid", "large"] : level === 4 ? ["mid", "large"] : ["large"];
      for (const food of ["chase", "ambush"] as const)
        for (const size of sizes)
          if (bound(size) && (size !== "large" || e > 2e-4))
            roles.push(
              role(
                p.place,
                food,
                size,
                level,
                e * (food === "chase" ? 0.6 : 0.4) * (size === "large" ? 0.6 : 1),
              ),
            );
      // (Where great beasts die, something eats what the hunters leave.)
      if (level === 3 && !sea && !air && p.fixed > 0.005 && bound("mid"))
        roles.push(role(p.place, "scavenge", "mid", 3, e * 0.3));
    }
  }
  // How many it fills, from all it fixes; then which: each place its share by what it fixes there (the root of it, so
  // a poor place still has its first eaters), and within a place its links in the shares a chain of eating keeps
  // (about half as many kinds at each link as at the one below, as on Earth), the richest of each link first.
  roles.sort((a, b) => b.energy - a.energy || (roleKey(a) < roleKey(b) ? -1 : 1));
  const fixed = places.reduce((a, p) => a + p.fixed, 0),
    rich = Math.max(0, Math.min(1, dmath.log10(Math.max(1e-9, fixed) / 0.004) / 2)),
    fills = Math.min(
      MOST_ROLES,
      roles.filter((r) => r.energy >= LEAST_FIXED * 0.02).length,
      Math.round(10 + 34 * rich),
    ),
    chosen = chooseRoles(roles, places, fills);
  return {
    places,
    roles: [...chosen, ...roles.filter((r) => !chosen.includes(r))],
    fills: chosen.length,
    fixed,
    links: places.reduce((a, p) => Math.max(a, p.links), 0),
  };
}

/** Which roles a world fills: each place its share, each link its share within it (see rolesOf). */
function chooseRoles(roles: readonly Role[], places: readonly PlaceRead[], fills: number): Role[] {
  const open = places.filter((p) => roles.some((r) => r.place === p.place)),
    weight = new Map(open.map((p) => [p.place, Math.sqrt(p.fixed)])),
    all = [...weight.values()].reduce((a, x) => a + x, 0),
    budget = new Map<Place, number>(),
    out: Role[] = [];
  if (!all || fills <= 0) return out;
  // (Each place its share, at least one; what rounding leaves over to the richest.)
  let given = 0;
  for (const p of open) {
    const k = Math.max(1, Math.floor((fills * weight.get(p.place)!) / all));
    budget.set(p.place, k);
    given += k;
  }
  const byRich = [...open].sort((a, b) => b.fixed - a.fixed);
  for (let i = 0; given < fills && i < 400; i++) {
    const p = byRich[i % byRich.length]!;
    budget.set(p.place, budget.get(p.place)! + 1);
    given++;
  }
  for (let i = 0; given > fills && i < 400; i++) {
    const p = byRich[byRich.length - 1 - (i % byRich.length)]!;
    if (budget.get(p.place)! > 1) {
      budget.set(p.place, budget.get(p.place)! - 1);
      given--;
    }
  }
  // Within each place, a link at a time where it is shortest of its share.
  const picked: { r: Role; place: number; turn: number }[] = [];
  byRich.forEach((p, pi) => {
    const mine = roles.filter((r) => r.place === p.place),
      levels = [...new Set(mine.map((r) => r.level))].sort((a, b) => a - b),
      share = (l: number) => dmath.pow(0.5, l - 2),
      total = levels.reduce((a, l) => a + share(l), 0),
      taken = new Map(levels.map((l) => [l, 0])),
      want = budget.get(p.place)!;
    for (let t = 0; t < want; t++) {
      let best = -1,
        gap = -Infinity;
      for (const l of levels) {
        if (!mine.some((r) => r.level === l && !picked.some((x) => x.r === r))) continue;
        const g = (share(l) / total) * (t + 1) - taken.get(l)!;
        if (g > gap + 1e-9) [best, gap] = [l, g];
      }
      if (best < 0) break;
      const r = mine.find((x) => x.level === best && !picked.some((y) => y.r === x))!;
      picked.push({ r, place: pi, turn: t });
      taken.set(best, taken.get(best)! + 1);
    }
  });
  // (In the order a world's ages fill them: every place's first, then its second, …)
  picked.sort((a, b) => a.turn - b.turn || a.place - b.place);
  for (const x of picked) out.push(x.r);
  return out.slice(0, fills);
}

function role(place: Place, food: Food, size: SizeClass, level: number, energy: number): Role {
  return {
    place,
    food,
    size,
    level,
    energy,
    niche: nicheOf(place, food, size, level),
    words: roleWords({ place, food, size, level }),
  };
}

const roleKey = (r: Role) => `${r.place}|${r.food}|${r.size}|${r.level}`;

/** A role's key, as a lineage's body carries it ("grassland graze mid 2"). */
export function roleId(r: Pick<Role, "place" | "food" | "size" | "level">): string {
  return `${r.place}|${r.food}|${r.size}|${r.level}`;
}

// —— Founding stocks' deep plans ——————————————————————————————————————————————————————————————

/** A founding stock's deep plan: what every lineage of it inherits. */
export type DeepStock = {
  readonly id: number;
  readonly symmetry: "bilateral" | "radial";
  /** A radial body's arms (3 … 8); a two-sided body's pairs of limbs (0 … 6). */
  readonly rays: number;
  readonly pairs: number;
  readonly frame: Frame;
  /** Its graspers, where it grows any; its wings, where it grows any (feathered, of skin, of plates beside its legs). */
  readonly grasp: Grasp;
  readonly wing: "feather" | "skin" | "plate" | null;
  /** Body regions (1 … 3). */
  readonly segments: 1 | 2 | 3;
  /** Where it began: in the open water, or on the floor. */
  readonly began: "water" | "floor";
  readonly why: string;
};

function pick<T extends string | number>(w: readonly (readonly [T, number])[], u: number): T {
  let all = 0;
  for (const [, x] of w) all += Math.max(0, x);
  let at = u * all;
  for (const [k, x] of w) {
    at -= Math.max(0, x);
    if (at < 0) return k;
  }
  return w[w.length - 1]![0];
}

/** Whether a stuff makes a hard frame: lime, phosphate, glass, iron sulfide, ice where it is as hard as rock. */
const HARD: ReadonlySet<string> = new Set(["calcite", "apatite", "opal", "greigite", "ice"]);

/**
 * A founding stock's deep plan, drawn under a world's numbers: a heavy pull favours more pairs of limbs and shells
 * spread low; a liquid thin and cold favours bodies held by their own pressure; glass in its seas a mesh of needles.
 */
export function deepStockOf(w: LifeWorld, u: (k: number) => number, id: number): DeepStock {
  const heavy = Math.max(0, Math.min(1, (w.gravity - 1) / 1.5)),
    radial = u(0) < 0.2 + 0.1 * Math.min(1, w.sea),
    hardBone = HARD.has(w.bone),
    hardShell = HARD.has(w.shell),
    frame: Frame = radial
      ? pick<Frame>(
          [
            ["none", 1.4],
            ["shell", hardShell ? 0.6 : 0.1],
            ["needles", w.bone === "opal" || w.shell === "opal" ? 0.8 : 0.1],
          ],
          u(1),
        )
      : pick<Frame>(
          [
            ["bones", hardBone ? 1.3 : 0.3],
            ["shell", hardShell ? 1.2 + 0.6 * heavy : 0.2],
            ["none", 0.6],
            ["needles", w.bone === "opal" || w.shell === "opal" ? 0.5 : 0.05],
          ],
          u(1),
        );
  const rays = radial
      ? pick<number>(
          [
            [3, 1],
            [4, 1.2],
            [5, 1.6],
            [6, 0.9],
            [8, 0.9],
          ],
          u(2),
        )
      : 0,
    pairs = radial
      ? 0
      : frame === "shell"
        ? pick<number>(
            [
              [2, 0.4],
              [3, 1.3],
              [4, 1.2 + heavy],
              [5, 0.6 + heavy],
              [6, 0.5 + heavy],
            ],
            u(2),
          )
        : frame === "bones"
          ? pick<number>(
              [
                [1, 0.3],
                [2, 1.5 - 0.5 * heavy],
                [3, 0.9 + heavy],
                [4, 0.4 + heavy],
              ],
              u(2),
            )
          : frame === "needles"
            ? pick<number>(
                [
                  [0, 0.6],
                  [2, 1],
                  [3, 0.8],
                  [4, 0.4],
                ],
                u(2),
              )
            : pick<number>(
                [
                  [0, 1.3],
                  [1, 0.4],
                  [2, 0.5],
                  [3, 0.3],
                  [5, 0.3],
                ],
                u(2),
              );
  const grasp: Grasp = radial
      ? "tentacle"
      : frame === "bones"
        ? pick<Grasp>(
            [
              ["hand", 1.2],
              ["trunk", 0.25],
              ["lip", 0.2],
              ["tail", 0.2],
            ],
            u(3),
          )
        : frame === "shell" || frame === "needles"
          ? pick<Grasp>(
              [
                ["pincer", 1.2],
                ["lip", 0.4],
              ],
              u(3),
            )
          : pick<Grasp>(
              [
                ["tentacle", 1.2],
                ["lip", 0.4],
                ["trunk", 0.2],
              ],
              u(3),
            ),
    wing: DeepStock["wing"] = radial
      ? null
      : frame === "bones"
        ? u(4) < 0.5
          ? "feather"
          : "skin"
        : frame === "shell"
          ? "plate"
          : frame === "none" && u(4) < 0.4
            ? "skin"
            : null,
    segments = (pairs >= 4 ? 3 : pairs >= 3 ? (u(5) < 0.5 ? 2 : 3) : u(5) < 0.2 ? 2 : 1) as
      1 | 2 | 3,
    began: DeepStock["began"] = radial || u(6) < 0.6 ? "water" : "floor";
  const why =
    frame === "shell" && heavy > 0.2
      ? `a shell spread low on many legs bears its pull (${fig(w.gravity)} g)`
      : frame === "bones"
        ? `${w.bone} hardened its bones`
        : frame === "shell"
          ? `${w.shell} hardened its shell`
          : frame === "needles"
            ? "glass in its seas grew into a mesh of needles"
            : radial
              ? "a body open to every side, drifting"
              : "a body held by its own pressure";
  return {
    id,
    symmetry: radial ? "radial" : "bilateral",
    rays,
    pairs,
    frame,
    grasp,
    wing,
    segments,
    began,
    why,
  };
}

// —— Bodies ——————————————————————————————————————————————————————————————————————————————————

/** A world's checks a body broke (none: it is possible there), in words. */
export function bodyBreaks(b: CreatureBody, w: LifeWorld): string[] {
  const out: string[] = [],
    inLiquid =
      wetPlace(b.place ?? "") || b.moves === "swim" || b.moves === "jet" || b.moves === "drift",
    frame = b.frame ?? "bones";
  if ((b.moves === "fly" || b.wings > 0) && b.moves !== "glide" && !canFly(b.size, w))
    out.push(`a flier of ${massFig(b.size)} where its air bears less`);
  if (b.moves === "float" && !canFloat(w)) out.push("a floater where no gas lifts it");
  if (
    !inLiquid &&
    b.moves !== "float" &&
    !frameBears(frame === "gas" ? "gas" : frame, b.size, w.gravity).ok
  )
    out.push(
      `a body of ${massFig(b.size)} on a frame of ${frame} that bears less under ${fig(w.gravity)} g`,
    );
  if (b.size > heaviestOnTrade(w) * 1.0001)
    out.push(`a body of ${massFig(b.size)} on a trade that feeds less`);
  if (b.warm && w.eatPower15 < 2) out.push("warm blood on a weak trade");
  if (b.breath && w.eatTrade === "breathe-o2" && b.size > breathingCeiling(b.breath, w.o2) * 1.0001)
    out.push(`breathing by ${b.breath} a body too large for its oxygen`);
  return out;
}

/** A body's senses as its world allows them: an electric sense only in a liquid that carries a current. */
export function bodySenses(b: CreatureBody, w: LifeWorld): string[] {
  const s = sensesOf({
      star: w.starK,
      pressure: w.pressure,
      liquid: w.conducts ? "water" : "oil",
    }),
    inLiquid = wetPlace(b.place ?? ""),
    out: string[] = [];
  if (PLACES[(b.place ?? "grassland") as Place]?.lit !== false) out.push("sight");
  if (s.hearing) out.push("hearing");
  out.push("smell");
  if (inLiquid && w.conducts) out.push("electric");
  return out;
}

/** What draws a body's limbs to each job, for a role. */
type Plan = { legs: number; arms: number; fins: number; wings: number; moves: Locomotion };

/**
 * A lineage's body: its stock's plan put to its role's work under its world's physics. `u(k)` keyed on the lineage.
 * Null where the stock can do nothing in the role (a body held by its own pressure cannot bear a land giant; a radial
 * bell cannot fly).
 */
export function bodyFor(
  stock: DeepStock,
  r: Role,
  w: LifeWorld,
  u: (k: number) => number,
): CreatureBody | null {
  const medium = PLACES[r.place].medium,
    sea = medium === "sea",
    air = medium === "air",
    under = medium === "under",
    [lo, hi] = SIZE_RANGE[r.size],
    pull = Math.max(0.3, w.gravity),
    radial = stock.symmetry === "radial",
    hunter = r.food === "chase" || r.food === "ambush",
    // (A frame bears this much under its pull on land; in the liquid far more.)
    frame: Frame = stock.frame,
    inLiquid = sea,
    bear =
      frame === "gas" ? largestFrame("gas", w.gravity) : largestFrame(frame, w.gravity, inLiquid),
    flier = heaviestFlier(w),
    trade = heaviestOnTrade(w);
  // Its weight: within its size class, smaller under a heavy pull, never more than its frame, its trade and (for a
  // flier) its air bear.
  let top = Math.min(hi, bear * 0.9, trade);
  if (air && !(canFloat(w) && (radial || frame === "none" || !stock.wing)))
    top = Math.min(top, flier * 0.9);
  if (top < lo) return null;
  const size = round3(
    Math.max(
      lo,
      Math.min(top, lo * dmath.pow(hi / lo, 0.15 + 0.7 * u(0) * u(0)) * dmath.pow(pull, -0.5)),
    ),
  );
  // Its limbs, each to a job.
  const plan = limbPlan(stock, r, w, size, u);
  if (!plan) return null;
  // What covers it, whether its blood is warm, how it breathes.
  const warmTrade = w.eatPower15 >= 2,
    cold = w.celsius < 5,
    hot = w.celsius > 24;
  let covering: Covering;
  if (frame === "shell") covering = u(10) < 0.6 ? "shell" : "plates";
  else if (frame === "needles") covering = "plates";
  else if (frame === "none" || radial) covering = "slick";
  else if (plan.wings > 0 && stock.wing === "feather") covering = "feathers";
  else if (sea) covering = u(10) < 0.65 ? "scales" : "slick";
  else if (cold && warmTrade)
    covering =
      stock.wing === "feather" && u(10) < 0.4
        ? "feathers"
        : r.food === "graze" && u(11) < 0.4
          ? "wool"
          : "fur";
  else if (hot)
    covering =
      u(10) < 0.5 ? "scales" : u(10) < 0.7 ? "plates" : warmTrade && u(10) < 0.85 ? "fur" : "slick";
  else
    covering =
      warmTrade && u(10) < 0.5
        ? stock.wing === "feather"
          ? "feathers"
          : "fur"
        : u(10) < 0.5
          ? "scales"
          : "slick";
  const coat =
      covering === "fur" || covering === "wool"
        ? "fur"
        : covering === "feathers"
          ? "feathers"
          : "bare",
    warm =
      warmTrade && coat !== "bare" && !sea && keepsWarm(size, Math.min(w.celsius, 10), coat) >= 1;
  const breath: CreatureBody["breath"] = sea
    ? radial || frame === "none"
      ? "skin"
      : "gills"
    : frame === "shell" && size < 2
      ? "tubes"
      : frame === "none" && size < 0.5
        ? "skin"
        : "lungs";
  // A body too large for how it breathes its oxygen is held to what it can feed.
  let kg = size;
  if (w.eatTrade === "breathe-o2") kg = Math.min(kg, breathingCeiling(breath, w.o2) * 0.95);
  if (kg < lo * 0.5) return null;
  kg = round3(kg);
  // What it grows: horns and crests for a grazer's contests, claws or spines for a hunter, a beak on a feathered
  // flier, tusks on a giant, a trunk where its stock's grasper is one.
  const features: Feature[] = [];
  if (!sea && !radial) {
    if (r.food === "graze" && r.size !== "small" && u(12) < 0.5)
      features.push(kg > 450 ? "wide-horns" : "horns");
    if (r.food === "browse" && u(12) < 0.5) features.push("crest");
    if (r.size === "giant") features.push("tusks");
    if (plan.arms > 0 && stock.grasp === "trunk") features.push("trunk");
    if (hunter) features.push(frame === "shell" ? "spines" : "claws");
    if (plan.wings > 0 && stock.wing === "feather") features.push("beak");
    if (r.place === "desert" && kg > 200 && u(13) < 0.4) features.push("hump");
  }
  if (
    (covering === "plates" || covering === "shell") &&
    u(14) < 0.4 &&
    !features.includes("spines")
  )
    features.push("spines");
  const eats: Eats =
    r.food === "chase" || r.food === "ambush"
      ? "flesh"
      : r.food === "scavenge" || r.food === "rot"
        ? "carrion"
        : r.food === "seeds"
          ? "seeds"
          : r.food === "filter"
            ? "plankton"
            : r.food === "browse"
              ? "leaves"
              : "grass";
  const swims = plan.moves === "swim" || plan.moves === "jet",
    many = plan.legs >= 6,
    body: CreatureBody = {
      symmetry: radial ? "radial" : "bilateral",
      segments: radial ? 1 : stock.segments,
      legs: plan.legs,
      fins: plan.fins as 0 | 2 | 4,
      wings: plan.wings as 0 | 2 | 4,
      covering,
      size: kg,
      moves: plan.moves,
      eats,
      level: r.level,
      neck: radial
        ? 0
        : r.food === "browse"
          ? round2(0.4 + 0.5 * u(15))
          : r.food === "graze" && !many
            ? round2(0.3 + 0.4 * u(15))
            : round2(0.1 + 0.25 * u(15)),
      tail: radial ? 0 : swims ? 0.8 : many ? round2(0.2 * u(16)) : round2(0.15 + 0.65 * u(16)),
      features,
      warm,
      ...(radial ? { rays: stock.rays } : {}),
      ...(plan.arms > 0 ? { arms: plan.arms, grasp: radial ? "tentacle" : stock.grasp } : {}),
      frame,
      place: r.place,
      food: r.food,
      stock: stock.id,
      breath,
    };
  return bodyBreaks(body, w).length ? null : body;
}

/** What its limbs do, for its role: struts, paddles, wings, graspers; and so how it goes. Null: none the stock can do. */
function limbPlan(
  stock: DeepStock,
  r: Role,
  w: LifeWorld,
  size: number,
  u: (k: number) => number,
): Plan | null {
  const medium = PLACES[r.place].medium,
    radial = stock.symmetry === "radial",
    hunter = r.food === "chase" || r.food === "ambush",
    handy =
      r.place === "canopy" ||
      r.food === "browse" ||
      r.food === "roots" ||
      (hunter && r.food === "ambush") ||
      r.place === "shore" ||
      r.place === "river" ||
      r.place === "sea floor";
  if (radial) {
    // A body open to every side: its arms about it, to grasp and to go.
    if (medium === "sea")
      return {
        legs: 0,
        arms: r.food === "filter" && size < 1 ? 0 : stock.rays,
        fins: 0,
        wings: 0,
        moves: floorMoves(r, size),
      };
    if (medium === "air")
      return canFloat(w) ? { legs: 0, arms: 0, fins: 0, wings: 0, moves: "float" } : null;
    if (medium === "under")
      return size < 2 ? { legs: 0, arms: 0, fins: 0, wings: 0, moves: "burrow" } : null;
    // On land: on its arms tip to tip, or rolling where the land is open and flat.
    const open = r.place === "grassland" || r.place === "desert" || r.place === "ice";
    if (open && size < 30 && u(20) < 0.45)
      return { legs: 0, arms: 0, fins: 0, wings: 0, moves: "roll" };
    return { legs: stock.rays, arms: 0, fins: 0, wings: 0, moves: "crawl" };
  }
  const pairs = stock.pairs;
  if (medium === "sea") {
    if (pairs === 0)
      return {
        legs: 0,
        arms: 0,
        fins: 0,
        wings: 0,
        moves: stock.frame === "none" && u(21) < 0.4 ? "jet" : "swim",
      };
    // On the floor, walking on its limbs, its front pair grasping; in the open water, its limbs paddles.
    if (r.place === "sea floor" || r.place === "vents" || (r.place === "river" && u(21) < 0.3)) {
      const arms = pairs >= 2 && (handy || u(22) < 0.5) ? 2 : 0;
      return { legs: 2 * pairs - arms, arms, fins: 0, wings: 0, moves: "crawl" };
    }
    // In the open water: a boned body's limbs its fins, two pairs at most, a third pair grasping where it hunts; a
    // shelled body paddles with its hindmost pair, its other legs folded under it (as the sea scorpions did) or its front
    // pair pincers; a body held by its own pressure swims on its fins or by a jet of its liquid.
    if (stock.frame === "shell" || stock.frame === "needles") {
      const arms = pairs >= 3 && (hunter || u(22) < 0.4) ? 2 : 0;
      return { legs: Math.max(0, 2 * pairs - 2 - arms), arms, fins: 2, wings: 0, moves: "swim" };
    }
    if (stock.frame === "none")
      return {
        legs: 0,
        arms: pairs >= 2 && hunter ? 2 : 0,
        fins: (Math.min(2, pairs) * 2) as 0 | 2 | 4,
        wings: 0,
        moves: u(22) < 0.45 ? "jet" : "swim",
      };
    const arms = pairs >= 3 && (hunter || u(22) < 0.3) ? 2 : 0,
      fins = Math.min(4, 2 * pairs - arms) as 0 | 2 | 4;
    return { legs: Math.max(0, 2 * pairs - arms - fins), arms, fins, wings: 0, moves: "swim" };
  }
  if (medium === "air") {
    if (!stock.wing)
      return canFloat(w) && size < 300
        ? { legs: 0, arms: 0, fins: 0, wings: 0, moves: "float" }
        : null;
    if (pairs === 0)
      return canFloat(w) ? { legs: 0, arms: 0, fins: 0, wings: 0, moves: "float" } : null;
    // Plate wings grow beside its legs; feathered and skin wings are a pair of its limbs.
    const wings = stock.wing === "plate" ? (u(23) < 0.4 ? 4 : 2) : 2,
      left = stock.wing === "plate" ? pairs : pairs - 1,
      arms = left >= 3 && u(24) < 0.4 ? 2 : 0;
    return { legs: Math.max(0, 2 * left - arms), arms, fins: 0, wings, moves: "fly" };
  }
  if (medium === "under") {
    const legs = pairs >= 3 ? 2 * pairs : pairs > 0 && u(25) < 0.6 ? 2 * pairs : 0;
    return { legs, arms: 0, fins: 0, wings: 0, moves: "burrow" };
  }
  // On land.
  if (pairs === 0) return { legs: 0, arms: 0, fins: 0, wings: 0, moves: "slither" };
  // Its front limbs freed to grasp, where its role handles things and it has limbs to spare (or a trunk or a tail).
  const spare = pairs >= 3 ? 1 : 0,
    second = pairs >= 5 && handy && u(26) < 0.35 ? 1 : 0,
    frees =
      stock.grasp === "trunk" || stock.grasp === "lip" || stock.grasp === "tail"
        ? handy && u(27) < 0.6
          ? 1
          : 0
        : (pairs >= 3 && (handy || u(27) < 0.35)) || (pairs === 2 && handy && u(27) < 0.45)
          ? 1
          : 0,
    // (A trunk, lips or a tail grasp without a pair of limbs given up.)
    armPairs =
      stock.grasp === "trunk" || stock.grasp === "lip" || stock.grasp === "tail"
        ? 0
        : frees + (frees ? second : 0),
    arms =
      stock.grasp === "trunk" || stock.grasp === "lip" || stock.grasp === "tail"
        ? frees
        : 2 * armPairs,
    legs = 2 * (pairs - armPairs),
    // Skin stretched between its limbs carries a climber from tree to tree where its air is thick enough.
    glides =
      r.place === "canopy" &&
      stock.wing === "skin" &&
      w.pressure >= 0.5 &&
      size < 20 &&
      u(28) < 0.5;
  void spare;
  if (legs === 0) return { legs: 0, arms, fins: 0, wings: 0, moves: "slither" };
  const moves: Locomotion = glides
    ? "glide"
    : r.place === "canopy" ||
        (arms >= 2 && r.food === "browse" && r.place === "woodland" && u(29) < 0.3)
      ? "climb"
      : legs >= 6
        ? hunter && r.food === "chase"
          ? "run"
          : u(29) < 0.25
            ? "walk"
            : "crawl"
        : legs === 2 && size < 40
          ? "hop"
          : hunter && r.food === "chase"
            ? "run"
            : r.food === "graze" && r.size !== "giant" && u(29) < 0.4
              ? "run"
              : "walk";
  return { legs, arms, fins: 0, wings: 0, moves };
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const round3 = (x: number) =>
  x >= 10 ? Math.round(x) : x >= 0.1 ? Math.round(x * 100) / 100 : Math.round(x * 10000) / 10000;

/** A figure in words: 1.6, 0.42, 12. */
export function fig(x: number): string {
  return x >= 10 ? `${Math.round(x)}` : x >= 1 ? x.toFixed(1) : x.toFixed(2);
}

/** A weight in words: 3 g, 12 kg, 4.2 tonnes. */
export function massFig(kg: number): string {
  return kg >= 1000
    ? `${(kg / 1000).toFixed(1)} tonnes`
    : kg >= 1
      ? `${Math.round(kg)} kg`
      : `${Math.max(1, Math.round(kg * 1000))} g`;
}

/** How a radial body goes in its liquid: fixed to the rock where it sifts at a vent or on the floor, walking the floor on its arms, drifting where it is small or sifts, else by a jet of its liquid. */
function floorMoves(r: Pick<Role, "place" | "food">, size: number): Locomotion {
  const floor = r.place === "sea floor" || r.place === "vents";
  if (floor && (r.food === "filter" || r.place === "vents")) return "rooted";
  if (floor) return "crawl";
  return size < 1 || r.food === "filter" ? "drift" : "jet";
}

// —— Names ———————————————————————————————————————————————————————————————————————————————————

const COLOURS = ["dun", "red", "grey", "black", "pale", "brindled", "spotted", "golden"];
const COUNT = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/**
 * A lineage's name, from its body and its role and a colour (one of rules/creatures.ts's, which its coat is drawn by):
 * "dun six-legged pincer-walker", "grey five-armed jet-star", "black vent-fan".
 */
export function lineageName(
  b: CreatureBody,
  r: Pick<Role, "place" | "food" | "size">,
  u: number,
): string {
  const colour = COLOURS[Math.floor(u * COLOURS.length)]!,
    has = (f: Feature) => b.features.includes(f),
    hunter = r.food === "chase" || r.food === "ambush",
    arms = b.arms ?? 0,
    look = has("spines")
      ? "spined"
      : has("crest")
        ? "crested"
        : has("horns") || has("wide-horns")
          ? "horned"
          : has("tusks")
            ? "tusked"
            : b.covering === "plates"
              ? "plated"
              : b.covering === "shell"
                ? "shelled"
                : b.covering === "slick"
                  ? "slick"
                  : b.covering === "scales"
                    ? "scaled"
                    : b.covering === "feathers"
                      ? "plumed"
                      : b.covering === "wool"
                        ? "woolly"
                        : "shaggy",
    rays = b.rays ?? 0,
    deep = r.place === "deep" ? "deep-" : r.place === "vents" ? "vent-" : "";
  let noun: string;
  if (b.symmetry === "radial")
    noun =
      b.moves === "drift"
        ? `${deep}bell`
        : b.moves === "jet"
          ? `${COUNT[rays]}-armed ${deep}jetter`
          : b.moves === "rooted"
            ? `${deep}fan`
            : b.moves === "roll"
              ? `${COUNT[rays]}-spoked roller`
              : b.moves === "float"
                ? "sky-bell"
                : b.moves === "burrow"
                  ? "star-delver"
                  : `${COUNT[rays]}-armed ${hunter ? "star-hunter" : "star-walker"}`;
  else if (b.moves === "fly")
    noun =
      b.wings === 4
        ? hunter
          ? "four-winged hawker"
          : "four-wing"
        : arms
          ? "hand-wing"
          : r.food === "scavenge"
            ? "carrion-glider"
            : hunter
              ? "sky-hunter"
              : r.food === "filter"
                ? "air-sifter"
                : "wing-seeder";
  else if (b.moves === "float") noun = hunter ? "sky-trailer" : "sky-bladder";
  else if (b.moves === "glide") noun = "glider";
  else if (b.moves === "climb")
    noun = arms >= 4 ? "four-handed climber" : arms ? "brachiator" : "climber";
  else if (b.moves === "burrow") noun = b.legs ? "digger" : "delver";
  else if (b.moves === "jet") noun = `${deep}jetter`;
  else if (b.moves === "swim")
    noun = hunter
      ? `${deep}fin-hunter`
      : r.food === "filter" && b.size > 500
        ? "great sifter"
        : b.size > 8
          ? `${deep}finner`
          : `${deep}fin-darter`;
  else if (b.moves === "slither")
    noun = hunter ? "coil-hunter" : arms ? "grasping slither" : "slither";
  else if (
    b.moves === "crawl" &&
    (r.place === "sea floor" || r.place === "vents" || r.place === "deep")
  )
    noun = arms ? `${deep}pincer-crawler` : `${deep}floor-crawler`;
  else if (b.legs >= 10) noun = `${COUNT[b.legs]}-legged ${hunter ? "stalker" : "crawler"}`;
  else if (b.legs === 8)
    noun = hunter ? "spinner" : arms ? "eight-legged grasper" : "eight-strider";
  else if (b.legs === 6)
    noun = arms
      ? b.grasp === "pincer"
        ? "pincer-walker"
        : "six-legged grasper"
      : hunter
        ? "six-stalker"
        : r.food === "graze"
          ? "crawler"
          : "sixleg";
  else if (arms && b.grasp === "trunk")
    noun = r.size === "giant" ? "trunked colossus" : "trunk-walker";
  else if (arms)
    noun = b.grasp === "pincer" ? "pincer-walker" : b.legs === 2 ? "upright grasper" : "grasper";
  else if (r.size === "giant") noun = "colossus";
  else if (hunter)
    noun = b.legs === 2 ? "strider-hunter" : r.size === "small" ? "skulker" : "prowler";
  else if (r.food === "scavenge") noun = "bone-picker";
  else if (r.food === "browse") noun = "leaf-reacher";
  else if (r.food === "seeds" || r.food === "roots")
    noun = b.legs === 2 ? "hopper" : "seed-nibbler";
  else noun = b.legs === 2 ? "stilt-grazer" : "grazer";
  return `${colour} ${look} ${noun}`;
}

/** A light-eater's form, by where it grows: mats, grasses, trees, floaters, growths at vents. */
export type GrowthForm =
  "mat" | "grass" | "tree" | "tall tree" | "floater" | "stalk" | "vent growth" | "film";

/** The form a place's light-eaters (or a vent's rock-eaters) take there; null where none grows. */
export function growthFormOf(
  p: Place,
  w: Pick<LifeWorld, "gravity" | "pressure">,
): GrowthForm | null {
  switch (p) {
    case "sunlit sea":
      return "floater";
    case "shore":
    case "river":
      return "stalk";
    case "vents":
      return "vent growth";
    case "grassland":
      return "grass";
    case "woodland":
    case "twilight":
      return standsTall(w) ? "tree" : "mat";
    case "canopy":
      return standsTall(w) ? "tall tree" : null;
    case "desert":
    case "cold land":
      return "mat";
    case "ice":
      return "film";
    default:
      return null;
  }
}

/** A light-eater's colour word by what catches its light (rules/biochem.ts pigments): green, russet, blue, near black. */
export function growthColour(pigment: string): string {
  return pigment === "carotene"
    ? "russet"
    : pigment === "phycocyanin"
      ? "blue"
      : pigment === "bacteriochlorophyll"
        ? "black"
        : pigment === "polyimine"
          ? "amber"
          : "green";
}

const FORM_WORDS: Readonly<Record<GrowthForm, readonly string[]>> = {
  mat: ["mat", "crust", "moss"],
  grass: ["grass", "bearded grass", "reed"],
  tree: ["tree", "fern-tree", "spire"],
  "tall tree": ["forest", "canopy-tree", "great spire"],
  floater: ["drift-weed", "floating mat", "raft-weed"],
  stalk: ["sea-stalk", "reed-weed", "wrack"],
  "vent growth": ["vent mat", "chimney-crust", "vent plume"],
  film: ["snow-film", "ice-bloom", "frost-crust"],
};

/** A light-eater's name: its colour and its form ("black forest", "russet raft-weed"). */
export function growthName(form: GrowthForm, pigment: string, u: number): string {
  const words = FORM_WORDS[form];
  return `${form === "vent growth" ? "pale" : growthColour(pigment)} ${words[Math.floor(u * words.length)]!}`;
}
