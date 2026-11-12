// How life began on a world, what it runs on, and when its air changed (B2 of the life plan,
// docs/architecture/asks-2026-11-12-plan.md Part B, primitives 1 and 2). A reading of a world's own numbers, and
// only of them: never of its kind's name, never a draw. It agrees with what the world already is (whether it lives,
// whether its life eats light, whether its air holds free oxygen now) and says why each is so.
//
// 1. Where life began. Six places gather the first chemistry, each at a rate from the world's numbers: seafloor
//    vents (the heat through its ground, hydrogen from wet rock, a sea floor of rock), tide pools and shores that wet
//    and dry (its moons' and star's tides, its coasts), brine veins in ice (its ice, the cold that concentrates),
//    hot springs and clays on land (its land, its heat), sunlit films on minerals in the shallows (its light, its
//    shallows) and hazes that rain out (a reducing air under light). The likeliest it allows is named.
// 2. What it runs on. Sixteen trades of energy, each open only where the world holds both halves, each with its
//    yield from the chemistry (ΔG) and the power it gives a kilogram of living body: breathing oxygen about fifteen
//    times what fermenting gives, rock chemistry a tenth of that again, life in −180 °C methane a millionth.
// 3. When its air changed: when its light-eaters, splitting water, freed oxygen faster than what soaks it up (iron in
//    its seas, gases from its volcanoes, both falling as its insides cool) could take it.
// 4. Its small lives, by what they run on: what the drop under the glass shows.
//
// Figures are real chemistry where chemistry gives them (ΔG of each reaction, the photons a fixing takes); the power
// a kilogram gets and the rates of the places are estimates, scaled to Earth's own, and said to be.
import { dmath } from "../kernel/index.ts";
import type { LifeFamily, Pigment } from "./biochem.ts";

/** What a world offers its first life, as its own numbers say. */
export type OriginGround = {
  /** What its life is (or would be) dissolved in, and whether its seas are sour with sulfuric acid. */
  readonly family: LifeFamily;
  readonly acid: boolean;
  /** The liquid's name, in words ("water", "ammonia water", "oil", "liquid methane"). */
  readonly liquid: string;
  /** The share of its face under its liquid, and under ice; whether its liquid lies only under an ice crust. */
  readonly sea: number;
  readonly ice: number;
  readonly underIce: boolean;
  /** Its sea floor is ice, not rock (an ice-crusted world's). */
  readonly iceFloor: boolean;
  /** Its mean warmth (true °C), its air's weight (bar), its pull (g). */
  readonly celsius: number;
  readonly pressure: number;
  readonly gravity: number;
  /** The heat coming up through its ground now, Earth's 1 (an estimate from its pull, its age and its tides). */
  readonly heat: number;
  /** Its tides' rise and fall, Earth's 1 (its moons' and its star's; a face locked to its star has none of the star's). */
  readonly tides: number;
  /** Its star's light at its top of air (Earth's 1) and at its ground; its star's warmth (K). */
  readonly light: number;
  readonly ground: number;
  readonly starK: number;
  /** Its pigment, where its life catches light (biochem's). */
  readonly pigment: Pigment | null;
  /** How old it is (billions of years). */
  readonly ageGyr: number;
  /** Iron in its first seas (Earth's 1), sulfur from below (Earth's 1). */
  readonly iron: number;
  readonly sulfur: number;
  /** What its air and seas hold: carbon dioxide, ammonia, a haze of the light's making, hydrogen in its air. */
  readonly co2: boolean;
  readonly ammonia: boolean;
  readonly haze: boolean;
  readonly hydrogenAir: boolean;
  /** Its air's oxygen now (a share of it; 0: none). */
  readonly o2: number;
  /** What is so already: how far its life came, whether it eats light, whether its air holds free oxygen now. */
  readonly level: "none" | "chemistry" | "cells" | "bodies";
  readonly eatsLight: boolean;
  readonly oxygen: boolean;
  /** Its small lives' ways, where they are known already (a world elsewhere's): hunters and cells together only where it says. */
  readonly ways?: readonly string[];
};

export type CradleId = "vents" | "pools" | "brine" | "springs" | "films" | "haze";
export type TradeId =
  | "split-water"
  | "strip"
  | "light-sulfur"
  | "light-iron"
  | "light-hydrogen"
  | "dim-red"
  | "h2-co2"
  | "h2-sulfur"
  | "h2-iron"
  | "ammonia-iron"
  | "acetylene"
  | "breathe-o2"
  | "breathe-nitrate"
  | "breathe-sulfate"
  | "breathe-h2"
  | "ferment";
/** How a trade gets its energy: from light, from the rock's chemistry, or from eating what others made. */
export type TradeKind = "light" | "rock" | "eat";

/** A place life could begin, as this world offers it. */
export type CradleRead = {
  readonly id: CradleId;
  readonly name: string;
  readonly icon: string;
  /** How fast it gathers the first chemistry, against Earth's own vents (1); 0 where the world shuts it. */
  readonly rate: number;
  /** What makes its rate here, in words with figures; or what shuts it. */
  readonly why: string;
  readonly shut: boolean;
};

/** A trade of energy, as this world offers it. */
export type TradeRead = {
  readonly id: TradeId;
  readonly kind: TradeKind;
  readonly name: string;
  /** Its two halves, in words: what gives and what takes. */
  readonly halves: string;
  readonly reaction: string;
  /** Its yield, in words ("−2,870 kJ for each sugar burned"). */
  readonly yields: string;
  /** Power a kilogram of living body gets of it at 15 °C (W), and here, at its world's warmth. */
  readonly power15: number;
  readonly power: number;
  /** Whether the world holds both halves; what is missing where it does not. */
  readonly open: boolean;
  readonly missing: string | null;
  /** Its figures are estimates (life in methane is one, and every power a kilogram gets). */
  readonly estimate: boolean;
};

/** When a world's air changed, if it did. */
export type AirRead = {
  /** Its air holds free oxygen now (as the world is). */
  readonly oxygen: boolean;
  /** When its oxygen came (millions of years ago; null: never). */
  readonly at: number | null;
  /** The reckoning would put it later than its tree allows: held at its first cells together. */
  readonly held: boolean;
  /** Its light-eaters' oxygen against what soaked it up, at the light-eaters' coming (Earth's 1 each). */
  readonly made: number;
  readonly soaked: number;
  readonly words: string;
};

/** A small life of the drop, by what it runs on. */
export type SmallLife = {
  readonly way: "eater" | "light" | "hunter" | "colony" | "rock";
  /** The step of the dawn it came of. */
  readonly rung: "cells" | "light" | "nucleus" | "together";
  readonly name: string;
  readonly color: readonly [number, number, number];
  /** How fast it lives against Earth's own of its way (1), from the power its trade gives. */
  readonly pace: number;
  /** How it is drawn: a rod, a ball of two or four, a spiral, a comma; a ball, a flat disc, a chain; a crust. */
  readonly look:
    "rod" | "coccus" | "spiral" | "comma" | "ball" | "disc" | "chain" | "crust" | "blob";
  readonly size: number;
  readonly share: number;
  /** What it runs on. */
  readonly trade: TradeId;
};

/** One of the five needs of life's start, met or not. */
export type LifeNeed = {
  readonly need: "a liquid that lasts" | "a flow of energy" | "ingredients" | "a place" | "time";
  readonly met: boolean;
  readonly words: string;
};

/** A world's life's beginning, read. */
export type Origin = {
  /** The six places, the likeliest first; the one its life began in (null: none it allows, or no life). */
  readonly cradles: readonly CradleRead[];
  readonly cradle: CradleRead | null;
  /** Every trade, those it holds first; the one its first life ran on; its light-eaters' and its eaters'. */
  readonly trades: readonly TradeRead[];
  readonly first: TradeRead | null;
  readonly light: TradeRead | null;
  readonly eaters: TradeRead | null;
  /** How much slower its life's chemistry runs at its warmth than at 15 °C (1: as fast). */
  readonly slow: number;
  readonly needs: readonly LifeNeed[];
  readonly small: readonly SmallLife[];
};

// —— Numbers ——————————————————————————————————————————————————————————————————————————————

const clamp = (lo: number, hi: number, x: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number, d = 2) => Math.round(x * dmath.pow(10, d)) / dmath.pow(10, d);

/**
 * How much faster life's chemistry runs at a warmth than at 15 °C: doubling with every ten degrees (Q10 of 2, the
 * rule of thumb biology's rates keep), past 40 °C no faster (its proteins come apart).
 */
export function warmthPace(celsius: number): number {
  return dmath.pow(2, (Math.min(40, celsius) - 15) / 10);
}

/** Power a kilogram of active living body gets of breathing oxygen at 15 °C (W): an estimate, a warm body's own. */
export const POWER_OXYGEN = 4;
/** ΔG of burning one sugar in oxygen (kJ): C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O. */
export const SUGAR_BURNED = 2870;

/** A trade's facts: its name, halves, reaction, yield and power a kilogram at 15 °C (at Earth's light, for light). */
type TradeFacts = {
  readonly kind: TradeKind;
  readonly name: string;
  readonly halves: string;
  readonly reaction: string;
  readonly yields: string;
  readonly power: number;
  readonly estimate: boolean;
};

/** Power of a meal's trade from its ΔG for each sugar's worth (kJ), against burning it in oxygen. */
const meal = (kj: number) => (POWER_OXYGEN * kj) / SUGAR_BURNED;
/** Power of a rock trade from its ΔG for each electron moved (kJ): breathing oxygen moves 24 for 2,870 kJ. */
const rock = (kjPerElectron: number) => (POWER_OXYGEN * kjPerElectron) / (SUGAR_BURNED / 24);

export const TRADES: Readonly<Record<TradeId, TradeFacts>> = {
  "split-water": {
    kind: "light",
    name: "light that splits water",
    halves: "the star's light, and water to take hydrogen from",
    reaction: "CO₂ + H₂O + light → sugar + O₂",
    yields:
      "480 kJ kept for each carbon fixed, from eight or more catches of light; it frees oxygen",
    power: 2,
    estimate: true,
  },
  strip: {
    kind: "light",
    name: "light that splits its liquid for hydrogen",
    halves: "the star's light, and a liquid that gives up hydrogen",
    reaction: "2 NH₃ + light → N₂ + 3 H₂, the hydrogen fixing carbon",
    yields: "about 300 kJ kept for each carbon fixed; it frees hydrogen, which burns nothing",
    power: 1.2,
    estimate: true,
  },
  "light-sulfur": {
    kind: "light",
    name: "light on sulfide",
    halves: "the star's light, and sulfide from below",
    reaction: "CO₂ + 2 H₂S + light → sugar + 2 S + H₂O",
    yields: "four catches of light for each carbon fixed; it frees sulfur, not oxygen",
    power: 1.4,
    estimate: true,
  },
  "light-iron": {
    kind: "light",
    name: "light on iron",
    halves: "the star's light, and iron dissolved in seas with no oxygen",
    reaction: "CO₂ + 4 Fe²⁺ + light → sugar + 4 Fe³⁺ (rust)",
    yields: "it fixes carbon slowly, the rust it makes falling as banded iron",
    power: 0.8,
    estimate: true,
  },
  "light-hydrogen": {
    kind: "light",
    name: "light on hydrogen",
    halves: "the star's light, and hydrogen in the air or seas",
    reaction: "CO₂ + 2 H₂ + light → sugar + H₂O",
    yields: "the easiest fixing of all, where hydrogen lasts",
    power: 1.6,
    estimate: true,
  },
  "dim-red": {
    kind: "light",
    name: "dim red light",
    halves: "a red star's light past the red, and sulfide or hydrogen",
    reaction: "CO₂ + 2 H₂S + light past 800 nm → sugar + 2 S + H₂O",
    yields:
      "a catch past the red carries too little to move an electron alone: three or more for each, so it is slow",
    power: 0.5,
    estimate: true,
  },
  "h2-co2": {
    kind: "rock",
    name: "hydrogen with carbon dioxide",
    halves: "hydrogen from wet rock, and carbon dioxide",
    reaction: "4 H₂ + CO₂ → CH₄ + 2 H₂O",
    yields: "−131 kJ for each methane made (about −40 kJ where the vents' water meets the sea)",
    power: rock(40 / 8),
    estimate: false,
  },
  "h2-sulfur": {
    kind: "rock",
    name: "hydrogen with sulfur",
    halves: "hydrogen from wet rock, and sulfur from below",
    reaction: "H₂ + S → H₂S",
    yields: "about −33 kJ for each sulfur",
    power: rock(33 / 2),
    estimate: false,
  },
  "h2-iron": {
    kind: "rock",
    name: "hydrogen with rust",
    halves: "hydrogen from wet rock, and iron the light has rusted",
    reaction: "H₂ + 2 Fe(OH)₃ → 2 Fe²⁺ + 4 OH⁻ + 2 H₂O",
    yields: "about −50 kJ for each hydrogen",
    power: rock(50 / 2),
    estimate: true,
  },
  "ammonia-iron": {
    kind: "rock",
    name: "ammonia with rust",
    halves: "ammonia in its liquid, and iron in its rock",
    reaction: "2 NH₃ + 6 Fe(OH)₃ → N₂ + 6 Fe²⁺ + …",
    yields: "about −160 kJ for each ammonia",
    power: rock(160 / 3),
    estimate: true,
  },
  acetylene: {
    kind: "rock",
    name: "acetylene with hydrogen",
    halves: "acetylene the light makes high in the air, and hydrogen",
    reaction: "C₂H₂ + 3 H₂ → 2 CH₄",
    yields: "−334 kJ for each acetylene (McKay and Smith 2005)",
    power: rock(334 / 6),
    estimate: true,
  },
  "breathe-o2": {
    kind: "eat",
    name: "eating others and breathing oxygen",
    halves: "food others made, and free oxygen",
    reaction: "sugar + 6 O₂ → 6 CO₂ + 6 H₂O",
    yields: "−2,870 kJ for each sugar burned: about 32 of the cell's coins of energy (ATP)",
    power: meal(2870),
    estimate: false,
  },
  "breathe-nitrate": {
    kind: "eat",
    name: "eating others and breathing nitrate",
    halves: "food others made, and nitrate (nitrogen its oxygen or its lightning has burned)",
    reaction: "5 sugar + 24 NO₃⁻ → 30 CO₂ + 12 N₂ + …",
    yields: "about −2,670 kJ for each sugar burned",
    power: meal(2670),
    estimate: false,
  },
  "breathe-sulfate": {
    kind: "eat",
    name: "eating others and breathing sulfate",
    halves: "food others made, and sulfate (sulfur burned)",
    reaction: "sugar + 3 SO₄²⁻ → 6 HCO₃⁻ + 3 HS⁻ + 3 H⁺",
    yields: "about −450 kJ for each sugar burned",
    power: meal(450),
    estimate: false,
  },
  "breathe-h2": {
    kind: "eat",
    name: "eating others and joining them with hydrogen",
    halves: "food others made, and hydrogen",
    reaction: "food + H₂ → CH₄ + H₂O",
    yields: "about −800 kJ for each sugar's worth",
    power: meal(800),
    estimate: true,
  },
  ferment: {
    kind: "eat",
    name: "eating others with nothing to breathe",
    halves: "food others made, alone",
    reaction: "sugar → 2 lactic acid",
    yields:
      "−196 kJ for each sugar: two coins of energy (ATP) where breathing oxygen gets about 32",
    power: meal(196),
    estimate: false,
  },
};

/** How well a star's light splits water: Earth's sunlight 1; a red star's needs more catches for each fixing. */
export function splitBand(starK: number): number {
  return clamp(0.4, 1, 0.4 + (0.6 * (starK - 2600)) / 1900);
}

// —— Where life began ———————————————————————————————————————————————————————————————————————

export const CRADLES: Readonly<Record<CradleId, { readonly name: string; readonly icon: string }>> =
  {
    vents: { name: "seafloor vents", icon: "🌋" },
    pools: { name: "tide pools and shores that wet and dry", icon: "🌊" },
    brine: { name: "brine veins in ice", icon: "🧊" },
    springs: { name: "hot springs and clays on land", icon: "♨️" },
    films: { name: "sunlit films on the shallows' minerals", icon: "☀️" },
    haze: { name: "a haze that rains out", icon: "🌫️" },
  };

/** Hydrogen its rock gives its liquid (Earth's 1): wet rock giving it off, more with more heat; none from an ice floor. */
function hydrogenOf(o: OriginGround): number {
  const wet = o.sea > 0.02 || o.underIce;
  return (wet ? o.heat * (o.iceFloor ? 0.15 : 1) : 0) + (o.hydrogenAir ? 1 : 0);
}

/** The share of its face that is coast (Earth's 0.82: four times sea times land). */
function coastOf(o: OriginGround): number {
  return 4 * o.sea * Math.max(0, 1 - o.sea - o.ice);
}

/** Its six places, each with its rate and its why. */
export function cradlesOf(o: OriginGround): CradleRead[] {
  const liquid = o.sea > 0.02 || o.underIce,
    land = Math.max(0, 1 - o.sea - o.ice),
    h2 = hydrogenOf(o),
    pace = (c: number) => warmthPace(c) / warmthPace(15),
    f = (x: number) => (x >= 10 ? Math.round(x) : x >= 1 ? x.toFixed(1) : x.toFixed(2)),
    out: CradleRead[] = [];
  const add = (id: CradleId, rate: number, why: string, shut: string | null) =>
    out.push({
      id,
      ...CRADLES[id],
      rate: shut ? 0 : Math.max(0, rate),
      why: shut ?? why,
      shut: !!shut,
    });
  // Vents: the ground's heat and the rock's hydrogen into a sea floor; their water warmer than the sea.
  const ventChem = (o.co2 ? 1 : 0.4) * Math.min(1.5, 0.4 + 0.6 * h2),
    vent = o.heat * Math.min(1, (o.sea + (o.underIce ? 0.5 : 0)) / 0.3) * ventChem;
  add(
    "vents",
    vent * (o.iceFloor ? 0.15 : 1) * pace(o.celsius + 50) * (warmthPace(15) / warmthPace(65)),
    `heat through its ground ${f(o.heat)}× Earth's${o.iceFloor ? ", but its sea floor is ice, and little of the rock's hydrogen reaches it" : ", and hydrogen from its wet rock"}`,
    !liquid
      ? "no liquid lies over its rock"
      : o.heat < 0.05
        ? "its insides are cold: no vents"
        : null,
  );
  // Pools: coasts that the tides wet and dry, concentrating what the sea holds.
  const coast = coastOf(o);
  add(
    "pools",
    0.8 * coast * (0.3 + 0.7 * Math.min(3, o.tides)) * pace(o.celsius),
    `coasts ${Math.round(coast * 25)}% of its face, tides ${f(o.tides)}× Earth's`,
    o.underIce || o.sea <= 0.02
      ? "no open shore: its liquid lies under ice"
      : land < 0.02
        ? "no land to make a shore"
        : null,
  );
  // Brine veins: freezing drives what the liquid holds into veins between the crystals, concentrated.
  const ice = o.underIce ? Math.max(0.6, o.ice) : o.ice;
  add(
    "brine",
    0.5 * ice * 8 * pace(Math.min(o.celsius, -5)),
    `ice over ${Math.round(ice * 100)}% of it, its brine some eight times as strong as its liquid`,
    ice < 0.02 ? "no ice" : !liquid ? "no liquid to freeze into brine" : null,
  );
  // Hot springs and clays: the ground's heat on land, pools in it wetting and drying, its clays holding the chemistry
  // together; the more of its face is land, the more springs.
  add(
    "springs",
    1.1 *
      land *
      o.heat *
      (o.iceFloor ? 0.2 : 1) *
      pace(o.celsius + 40) *
      (warmthPace(15) / warmthPace(55)),
    `land ${Math.round(land * 100)}% of its face, its heat ${f(o.heat)}× Earth's`,
    land < 0.02
      ? "no land"
      : o.heat < 0.05
        ? "its insides are cold: no springs"
        : !liquid
          ? "no liquid"
          : null,
  );
  // Sunlit films: light on minerals in the shallows driving the first chemistry.
  add(
    "films",
    0.5 * o.ground * Math.min(1, o.sea / 0.3) * Math.min(1, o.starK / 4500) * pace(o.celsius),
    `light at its ground ${f(o.ground)}× Earth's`,
    o.underIce || o.sea <= 0.02
      ? "no light reaches its liquid"
      : o.ground < 0.01
        ? "too little light reaches its ground"
        : null,
  );
  // A haze that rains out: light making the stuff of life high in a reducing air, raining it into the seas.
  const hazy = o.haze ? 1 : 0.15;
  add(
    "haze",
    1.2 *
      hazy *
      Math.sqrt(Math.min(1, o.light)) *
      Math.min(3, o.pressure) *
      Math.sqrt(pace(o.celsius)),
    o.haze
      ? "a haze its star's light makes of its air, raining into its seas"
      : "a little haze its star's light made of its first air",
    !liquid || o.underIce
      ? "nothing for a haze to rain into"
      : o.pressure < 0.1
        ? "too little air"
        : null,
  );
  return out.sort((a, b) => b.rate - a.rate || (a.id < b.id ? -1 : 1));
}

// —— What it runs on ————————————————————————————————————————————————————————————————————————

/** Every trade as this world holds it (or not), with its power here. */
export function tradesOf(o: OriginGround): TradeRead[] {
  const h2 = hydrogenOf(o),
    water = o.family === "water",
    lit = o.ground >= 0.005 && !o.underIce,
    red = o.starK < 3900,
    slow = warmthPace(o.celsius),
    sulfide = o.sulfur >= 0.6,
    iron = o.iron >= 0.5,
    out: TradeRead[] = [];
  const add = (id: TradeId, missing: string | null, scale = 1) => {
    const t = TRADES[id],
      p15 = t.power * scale;
    out.push({
      id,
      kind: t.kind,
      name: t.name,
      halves: t.halves,
      // (An oil's life strips hydrogen from the oil's own chains.)
      reaction:
        id === "strip" && o.family === "oil"
          ? "oil's chains + light → H₂ + tar, the hydrogen fixing carbon"
          : t.reaction,
      yields: t.yields,
      power15: round(p15, 4),
      power: round(p15 * slow, 9),
      open: missing === null,
      missing,
      estimate: t.estimate,
    });
  };
  const noLight = !lit ? (o.underIce ? "no light under its ice" : "too little light") : null;
  add(
    "split-water",
    noLight ??
      (!water
        ? `no water: its life is of ${o.liquid}`
        : !o.eatsLight
          ? "its life never came to eat light"
          : null),
    o.ground * splitBand(o.starK),
  );
  add(
    "strip",
    noLight ??
      (water
        ? "water is split for oxygen instead"
        : o.family === "methane"
          ? "too little light through its haze to live by"
          : !o.eatsLight
            ? "its life never came to eat light"
            : null),
    o.ground,
  );
  add(
    "light-sulfur",
    noLight ??
      (!sulfide
        ? "too little sulfide from below"
        : o.family === "methane"
          ? "too little light through its haze"
          : null),
    o.ground,
  );
  add(
    "light-iron",
    noLight ??
      (!water ? "no water to hold its iron" : !iron ? "too little iron in its seas" : null),
    o.ground,
  );
  add(
    "light-hydrogen",
    noLight ??
      (h2 < 0.3
        ? "too little hydrogen"
        : o.family === "methane"
          ? "too little light through its haze"
          : null),
    o.ground,
  );
  add(
    "dim-red",
    noLight ??
      (!red
        ? "its star is not red: its light is caught within the rainbow"
        : !(sulfide || h2 >= 0.3)
          ? "nothing to give the electrons"
          : null),
    o.ground,
  );
  add("h2-co2", h2 < 0.05 ? "no hydrogen from its rock" : !o.co2 ? "no carbon dioxide" : null);
  add("h2-sulfur", h2 < 0.05 ? "no hydrogen from its rock" : !sulfide ? "too little sulfur" : null);
  add(
    "h2-iron",
    h2 < 0.05 ? "no hydrogen from its rock" : !iron || o.iceFloor ? "no rust within reach" : null,
  );
  add(
    "ammonia-iron",
    !o.ammonia ? "no ammonia" : o.iceFloor ? "its floor is ice: no iron within reach" : null,
  );
  add(
    "acetylene",
    !o.haze || o.family !== "methane"
      ? "no acetylene: only a cold haze over methane makes it last"
      : null,
  );
  const living = o.level !== "none" && o.level !== "chemistry";
  add("breathe-o2", !o.oxygen ? "no free oxygen" : null);
  add("breathe-nitrate", !o.oxygen ? "no oxygen to burn its nitrogen to nitrate" : null);
  add(
    "breathe-sulfate",
    !sulfide
      ? "too little sulfur"
      : !(o.oxygen || (living && lit))
        ? "nothing has burned its sulfur to sulfate"
        : null,
  );
  add(
    "breathe-h2",
    o.oxygen ? "oxygen is breathed instead" : h2 < 0.3 ? "too little hydrogen" : null,
  );
  add("ferment", null);
  return out;
}

/**
 * How much of a trade's food its cradle had (1: plenty): carbon dioxide is in every wet world's water, but sulfur and
 * rust are plentiful only where its ground gives more than Earth's.
 */
function supplyOf(id: TradeId, o: OriginGround): number {
  switch (id) {
    case "h2-sulfur":
      return Math.max(0, o.sulfur - 1);
    case "h2-iron":
      return Math.max(0, o.iron - 1);
    default:
      return 1;
  }
}

/** The trade the first life ran on at its cradle: of those it held there, the most power its supply gave. */
function firstOf(
  cradle: CradleId,
  trades: readonly TradeRead[],
  o: OriginGround,
): TradeRead | null {
  const open = (ids: readonly TradeId[]) =>
    ids
      .map((id) => trades.find((t) => t.id === id)!)
      .filter((t) => t.open && supplyOf(t.id, o) > 0)
      .sort((a, b) => b.power15 * supplyOf(b.id, o) - a.power15 * supplyOf(a.id, o))[0] ?? null;
  const rockIds: TradeId[] = ["acetylene", "ammonia-iron", "h2-iron", "h2-sulfur", "h2-co2"];
  switch (cradle) {
    case "vents":
    case "springs":
    case "brine":
      return open(rockIds) ?? open(["ferment"]);
    case "pools":
      return open(["ferment"]);
    case "films":
      return open(["light-hydrogen", "light-sulfur", "light-iron", "dim-red"]) ?? open(["ferment"]);
    case "haze":
      return open(["acetylene"]) ?? open(["ferment"]);
  }
}

// —— When its air changed ——————————————————————————————————————————————————————————————————

/** Earth's sinks at the light-eaters' coming, against what they made: set so its oxygen comes about 2.4 billion years ago. */
const SINK = 0.1715;
/** The time over which what soaks oxygen up falls by e (billions of years): its insides cooling, its volcanoes' gases falling, its seas' iron rusted and buried as banded stone. */
const COOLING = 1.5;

/**
 * When a world's air came to hold free oxygen: once its light-eaters split water faster than what soaks the oxygen
 * up. What they make is its light at its ground, how well its star's light splits water and how much of it is sea;
 * what soaks it up is the heat through its ground (its volcanoes' gases), its seas' iron and its sulfur, and falls
 * as its insides cool. `light` is when its water-splitting light-eaters came, `floor` the latest it can have been
 * (its first cells together, too large to live without it), both in millions of years ago.
 */
export function airChange(o: OriginGround, light: number | null, floor: number): AirRead {
  const made = o.ground * splitBand(o.starK) * dmath.pow(Math.min(1, o.sea / 0.71), 0.7),
    soaksNow = SINK * o.heat * (0.5 + 0.5 * o.iron) * (0.7 + 0.3 * Math.min(3, o.sulfur)),
    soaked = light === null ? soaksNow : soaksNow * dmath.exp(light / 1000 / COOLING),
    // (When what they make first outruns what soaks it up, the sinks falling as the world cools.)
    outran = made > 0 && soaksNow > 0 ? COOLING * dmath.log(made / soaksNow) * 1000 : -Infinity;
  if (!o.oxygen) {
    const words =
      o.level === "none" || o.level === "chemistry"
        ? "no life came to change it"
        : o.family !== "water"
          ? o.family === "methane"
            ? "its life eats what the light makes in its haze, and frees no oxygen"
            : `its light-eaters split ${o.liquid} for hydrogen, which frees no oxygen`
          : !o.eatsLight
            ? o.underIce
              ? "no light reaches the water under its ice, so nothing there splits water"
              : "too little of its star's light reaches its seas for anything to split water"
            : "what soaks oxygen up still outruns its light-eaters";
    return {
      oxygen: false,
      at: null,
      held: false,
      made: round(made),
      soaked: round(soaked),
      words,
    };
  }
  // (Oxygen with no light-eaters to have made it: of no life's making, and undated.)
  if (light === null)
    return {
      oxygen: true,
      at: null,
      held: false,
      made: round(made),
      soaked: round(soaked),
      words: "its oxygen is of no life's making",
    };
  const start = light,
    // (It takes a while to fill the seas and the air: about fifty million years at the least.)
    reckoned = Math.min(start - 50, outran),
    at = Math.round(Math.max(floor + 1, Math.min(start - 1, reckoned))),
    held = reckoned < floor + 1;
  return {
    oxygen: true,
    at,
    held,
    made: round(made),
    soaked: round(soaked),
    words: held
      ? "its light-eaters came to outrun what soaked their oxygen up"
      : made >= soaked
        ? "its light-eaters made oxygen faster than anything could soak it up, from the first"
        : "its light-eaters made oxygen, and for a long while its seas' iron and its volcanoes' gases soaked it all up; as its insides cooled and its seas' iron was rusted and buried they soaked less, until the oxygen won",
  };
}

// —— Its small lives ——————————————————————————————————————————————————————————————————————

type Rgb = readonly [number, number, number];

/** A pigment's colour in the drop. */
const PIGMENT_RGB: Readonly<Record<Pigment, Rgb>> = {
  chlorophyll: [0.38, 0.88, 0.42],
  carotene: [0.96, 0.66, 0.22],
  phycocyanin: [0.3, 0.64, 0.95],
  bacteriochlorophyll: [0.34, 0.22, 0.4],
  polyimine: [0.78, 0.55, 0.25],
};

/** A trade's pace in the drop, against breathing oxygen's (eaters, hunters) or Earth's light (light-eaters). */
const paceOf = (power: number, against: number) =>
  round(clamp(0.25, 1.6, dmath.pow(power / against, 0.4)), 2);

/** A world's small lives, by what they run on: each the drop's kind of its step of the dawn. */
export function smallLives(
  o: OriginGround,
  origin: Pick<Origin, "first" | "light" | "eaters" | "cradle">,
  dawn = false,
): SmallLife[] {
  if (o.level === "none" || o.level === "chemistry") return [];
  const out: SmallLife[] = [],
    e = origin.eaters,
    l = origin.light,
    first = origin.first,
    o2 = Math.sqrt(Math.max(0.5, Math.min(1.6, o.o2 / 0.2095)));
  // What breathes, eats what floats.
  const eater: Omit<SmallLife, "share" | "rung" | "way" | "size"> =
    o.family === "methane"
      ? {
          name: "acetylene-eaters",
          color: [0.72, 0.88, 0.98],
          pace: 0.4,
          look: "coccus",
          trade: e?.id ?? "acetylene",
        }
      : !e || e.id === "breathe-o2" || e.id === "breathe-nitrate"
        ? {
            name: "small cells",
            color: [0.95, 0.77, 0.42],
            pace: 1,
            look: "rod",
            trade: e?.id ?? "breathe-o2",
          }
        : e.id === "breathe-h2"
          ? {
              name: "hydrogen-breathing cells",
              color: [0.62, 0.84, 0.7],
              pace: paceOf(e.power15, POWER_OXYGEN),
              look: "spiral",
              trade: e.id,
            }
          : e.id === "breathe-sulfate"
            ? {
                name: "sulfate-breathing cells",
                color: [0.66, 0.66, 0.72],
                pace: paceOf(e.power15, POWER_OXYGEN),
                look: "comma",
                trade: e.id,
              }
            : {
                name: "fermenting cells",
                color: [0.86, 0.7, 0.52],
                pace: paceOf(e.power15, POWER_OXYGEN),
                look: "coccus",
                trade: e.id,
              };
  out.push({ ...eater, way: "eater", rung: "cells", size: 2, share: 0.58 });
  // Rock-eaters on a grain: where the first life was, at its dawn; and where nothing breathes oxygen, always.
  const rockTrade =
    first && first.kind === "rock" && first.id !== "acetylene" && (dawn || !o.oxygen)
      ? first
      : null;
  if (rockTrade) {
    const look: Record<string, [string, Rgb]> = {
      "h2-co2": ["methane-makers", [0.86, 0.88, 0.74]],
      "h2-sulfur": ["sulfur-eaters", [0.97, 0.86, 0.3]],
      "h2-iron": ["iron-eaters", [0.9, 0.52, 0.3]],
      "ammonia-iron": ["ammonia-eaters", [0.76, 0.64, 0.94]],
    };
    const [name, color] = look[rockTrade.id] ?? ["rock-eaters", [0.8, 0.8, 0.7]];
    out.push({
      way: "rock",
      rung: "cells",
      name,
      color,
      pace: paceOf(rockTrade.power15, POWER_OXYGEN),
      look: "crust",
      size: 2.5,
      share: dawn ? 0.4 : 0.3,
      trade: rockTrade.id,
    });
  }
  // Light-eaters, by what they catch it with and on.
  if (l) {
    const pig = o.pigment ?? "chlorophyll",
      base: Omit<SmallLife, "share" | "rung" | "way" | "size"> =
        l.id === "split-water"
          ? pig === "chlorophyll"
            ? {
                name: "light-eaters",
                color: PIGMENT_RGB.chlorophyll,
                pace: 1,
                look: "ball",
                trade: l.id,
              }
            : pig === "bacteriochlorophyll"
              ? {
                  name: "dark light-eaters",
                  color: PIGMENT_RGB[pig],
                  pace: paceOf(l.power15, 2),
                  look: "disc",
                  trade: l.id,
                }
              : {
                  name: pig === "carotene" ? "golden light-eaters" : "blue light-eaters",
                  color: PIGMENT_RGB[pig],
                  pace: paceOf(l.power15, 2),
                  look: pig === "carotene" ? "ball" : "chain",
                  trade: l.id,
                }
          : l.id === "dim-red"
            ? {
                name: "dark light-eaters",
                color: [0.26, 0.17, 0.3],
                pace: paceOf(l.power15, 2),
                look: "disc",
                trade: l.id,
              }
            : l.id === "light-sulfur"
              ? {
                  name: "purple sulfur cells",
                  color: [0.78, 0.36, 0.72],
                  pace: paceOf(l.power15, 2),
                  look: "ball",
                  trade: l.id,
                }
              : l.id === "light-iron"
                ? {
                    name: "rust-making light-eaters",
                    color: [0.88, 0.54, 0.3],
                    pace: paceOf(l.power15, 2),
                    look: "chain",
                    trade: l.id,
                  }
                : l.id === "light-hydrogen"
                  ? {
                      name: "hydrogen light-eaters",
                      color: [0.42, 0.82, 0.76],
                      pace: paceOf(l.power15, 2),
                      look: "ball",
                      trade: l.id,
                    }
                  : {
                      name: "hydrogen-making light-eaters",
                      color: PIGMENT_RGB[pig],
                      pace: paceOf(l.power15, 2),
                      look: "chain",
                      trade: l.id,
                    };
    out.push({ ...base, way: "light", rung: "light", size: 5, share: 0.32 });
  }
  if (o.ways ? o.ways.includes("hunter") : o.level === "bodies" || dawn) {
    // Hunting cells: as fast as their breath allows, quicker in a richer air.
    const breath = e?.id ?? "ferment",
      oxygen = breath === "breathe-o2" || breath === "breathe-nitrate";
    out.push({
      way: "hunter",
      rung: "nucleus",
      name: oxygen ? (o2 > 1.08 ? "swift hunting cells" : "hunting cells") : "slow hunting cells",
      color: oxygen ? (o2 > 1.08 ? [0.92, 0.56, 0.86] : [0.8, 0.64, 1]) : [0.6, 0.66, 0.86],
      pace: oxygen ? round(o2, 2) : paceOf(e?.power15 ?? TRADES.ferment.power, POWER_OXYGEN),
      look: "blob",
      size: 24,
      share: 0.05,
      trade: breath,
    });
    // Cells together, of the light-eaters' colour where they are not Earth's own.
    const lit = out.find((s) => s.way === "light");
    if (!o.ways || o.ways.includes("colony"))
      out.push({
        way: "colony",
        rung: "together",
        name: "cells together",
        color: !lit ? out[0]!.color : lit.name === "light-eaters" ? [0.46, 0.84, 0.6] : lit.color,
        pace: lit ? lit.pace : out[0]!.pace,
        look: "ball",
        size: 34,
        share: 0.05,
        trade: lit?.trade ?? breath,
      });
  }
  return out;
}

// —— The reading ———————————————————————————————————————————————————————————————————————————

/** The five needs: a liquid that lasts, a flow of energy, ingredients, a place, time. */
function needsOf(o: OriginGround, cradle: CradleRead | null, liquidWhy: string | null): LifeNeed[] {
  const liquid = (o.sea > 0.02 || o.underIce) && !liquidWhy,
    energy = o.heat >= 0.05 || o.ground >= 0.005,
    young = o.ageGyr < 0.7;
  return [
    {
      need: "a liquid that lasts",
      met: liquid,
      words: liquid
        ? `${o.liquid}${o.underIce ? " under its ice" : ` over ${Math.round(o.sea * 100)}% of it`}`
        : (liquidWhy ?? `no ${o.liquid} lies on it`),
    },
    {
      need: "a flow of energy",
      met: energy,
      words: energy
        ? `heat through its ground ${round(o.heat, 1)}× Earth's, light at its ground ${round(o.ground, 2)}× Earth's`
        : "no heat from below and no light worth having",
    },
    {
      need: "ingredients",
      met: o.family !== "oil" || o.level !== "none",
      words:
        o.family === "oil"
          ? "carbon everywhere, but water too scarce, and oil too poor a solvent, to gather the rest"
          : "carbon, nitrogen and the rest, dissolved in its liquid",
    },
    {
      need: "a place",
      met: !!cradle,
      words: cradle ? `${cradle.name}, the likeliest` : "nowhere that gathers the first chemistry",
    },
    {
      need: "time",
      met: !young,
      words: young
        ? `only ${Math.round(o.ageGyr * 1000)} million years since it formed`
        : `${round(o.ageGyr, 1)} billion years`,
    },
  ];
}

/**
 * A world's origin, read: the place its life began, what its first life ran on, what its light-eaters and eaters run
 * on now, its five needs, and its small lives. `liquidWhy`: why no liquid lasts there, where the world says so.
 */
export function readOrigin(o: OriginGround, liquidWhy: string | null = null, dawn = false): Origin {
  const cradles = cradlesOf(o),
    trades = tradesOf(o),
    alive = o.level !== "none",
    open = cradles.filter((c) => !c.shut && c.rate > 0),
    cradle = alive && !liquidWhy ? (open[0] ?? null) : null,
    living = o.level === "cells" || o.level === "bodies",
    first = cradle && living ? firstOf(cradle.id, trades, o) : null,
    pick = (ids: readonly TradeId[]) =>
      ids.map((id) => trades.find((t) => t.id === id)!).find((t) => t.open) ?? null,
    light =
      living && o.eatsLight
        ? pick(
            o.oxygen
              ? ["split-water"]
              : o.family === "water"
                ? ["light-hydrogen", "light-sulfur", "light-iron", "dim-red"]
                : ["strip", "light-hydrogen", "light-sulfur", "dim-red"],
          )
        : null,
    eaters = living
      ? pick(
          o.oxygen
            ? ["breathe-o2"]
            : o.family === "methane"
              ? ["acetylene", "breathe-h2", "ferment"]
              : ["breathe-h2", "breathe-sulfate", "ferment"],
        )
      : null;
  const read = { first, light, eaters, cradle };
  return {
    cradles,
    cradle,
    trades: [...trades].sort((a, b) => Number(b.open) - Number(a.open) || b.power15 - a.power15),
    first,
    light,
    eaters,
    slow: round(warmthPace(o.celsius) / warmthPace(15), 9),
    needs: needsOf(o, alive ? cradle : (open[0] ?? null), liquidWhy),
    small: smallLives(o, read, dawn),
  };
}

/** A power a kilogram in words: "4 W", "0.17 W", "a millionth of a watt". */
export function powerWords(w: number): string {
  if (w >= 10) return `${Math.round(w)} W`;
  if (w >= 0.1) return `${round(w, w >= 1 ? 1 : 2)} W`;
  if (w >= 0.001) return `${round(w * 1000, 0)} mW`;
  const exp = Math.floor(dmath.log10(w)),
    sup = String(exp).replace(/[-0-9]/g, (d) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(d)]!);
  return `about 10${sup} W`;
}
