// The kind of a world (Phase 56, asked for at Phase 54's end: "whole new kinds of worlds: carbon
// worlds, ice and ammonia worlds, sulfur-volcano worlds, methane worlds, each with its own liquids,
// materials and path through the ages"). Rocky, watery, oxygen-breathing worlds are as Earth and
// Phase 54's worlds have always been. Four kinds go beside them, each made by what made its world
// (its star, its orbit: rules/making.ts) and two inputs of its own: the carbon to oxygen of the disk
// it formed in, and the volatiles it gathered. A kind sets its world's liquid, its bedrock, its air
// and what burns. Its tables go beside Earth's and Phase 54's, never in their place. Nothing a
// world does breaks physics: where nothing burns, nothing is burned, and its people find what the
// world does instead.
import { finish, hashString, mix, seedActs, seedName, seedWithAct } from "../kernel/index.ts";
import { MAKINGS, makingsOf } from "./making.ts";

/** What kind of world it is. */
export type WorldKind = "rocky" | "carbon" | "sulfur" | "ammonia" | "methane";
/** A kind Phase 56 brings: every kind but the rocky. */
export type NovelKind = Exclude<WorldKind, "rocky">;
export const WORLD_KINDS: readonly WorldKind[] = [
  "rocky",
  "carbon",
  "sulfur",
  "ammonia",
  "methane",
];
export const NOVEL_KINDS: readonly NovelKind[] = ["carbon", "sulfur", "ammonia", "methane"];

/** What a world gathered past its star's snow line: water as Earth, or sulfur, ammonia, methane. */
export type Volatile = "water" | "sulfur" | "ammonia" | "methane";

/**
 * A world's liquid: its substance (rules/matter.ts), its name, and the band it is liquid in under its
 * air (kelvin). A world's warmth is read between its liquid's freezing and boiling as Earth's is
 * between water's: its climate, its seas, its ice and where its life can live are its liquid's, and
 * so are the degrees its pages give.
 */
export type Liquid = {
  readonly subst: string;
  readonly name: string;
  readonly freezeK: number;
  readonly boilK: number;
};

/** A kind: its liquid, what makes it, its bedrock, its air, what burns, its tools and walls, its life. */
export type KindFacts = {
  /** "a methane world" */
  readonly name: string;
  readonly icon: string;
  readonly liquid: Liquid;
  /** What makes a world of this kind. */
  readonly why: string;
  readonly bedrock: string;
  readonly air: string;
  /** Whether anything burns in its air: an oxidant to burn with. */
  readonly burns: boolean;
  /** What burns, or why nothing does and what gives heat and work instead. */
  readonly fire: string;
  readonly tools: string;
  readonly walls: string;
  /**
   * The liquid life arises in and what it is made of (Phase 57's seam: its biochemistry reads this,
   * and the liquid's band sets where life can live); how often life takes hold in it, of the worlds
   * whose climate would let it (a world's own keyed draw), and why it did not where it did not.
   */
  readonly life: {
    readonly solvent: string;
    readonly words: string;
    readonly odds: number;
    readonly barren: string;
  };
  /** Its home body in its system (gen/system.ts): its air, where its water lies, its air's weight (bar). */
  readonly body: {
    readonly air: "thick" | "breathable";
    readonly water: "none" | "ice" | "seas";
    readonly pressure: number;
  };
};

const WATER: Liquid = { subst: "water", name: "water", freezeK: 273.15, boilK: 373.15 };

export const KINDS: Readonly<Record<WorldKind, KindFacts>> = {
  rocky: {
    name: "a rocky world",
    icon: "🌍",
    liquid: WATER,
    why: "rock of oxygen, as the Sun's: its disk held more oxygen than carbon, and it gathered water",
    bedrock: "silicate rock: granite, basalt, sandstone and the rest",
    air: "nitrogen and the oxygen its life gives",
    burns: true,
    fire: "Wood and coal burn in its oxygen.",
    tools: "stone, then copper, bronze, iron and steel",
    walls: "earth, wood, brick and stone",
    life: {
      solvent: "water",
      words: "in water, between its freezing and its boiling",
      odds: 1,
      barren: "no life took hold in its first seas",
    },
    body: { air: "breathable", water: "seas", pressure: 1 },
  },
  carbon: {
    name: "a carbon world",
    icon: "💎",
    // (Light oils and tars: a crude's lighter part sets to wax about where water freezes.)
    liquid: { subst: "crude", name: "oil", freezeK: 273.15, boilK: 373.15 },
    why: "its disk held more carbon than oxygen (C/O of 1 or more, Kuchner & Seager 2005): every oxygen went into carbon monoxide, and the rest of the carbon condensed as graphite and carbides",
    bedrock: "carbide and graphite, with diamond below",
    air: "carbon monoxide and methane, with almost no free oxygen",
    burns: false,
    fire: "Fuel is everywhere and nothing burns it: what oxygen it had is bound up in carbon monoxide. Heat is the sun's, gathered in mirrors, until oxygen is made by current.",
    tools:
      "moissanite knapped like flint and ground keen with diamond grit; native copper hammered cold; carbide iron ground to an edge",
    walls: "carbide grit bound in pitch",
    life: {
      solvent: "oil",
      words: "in oil, between its waxing and its boiling, where water is scarce",
      odds: 0.6,
      barren: "water was too scarce, and oil too poor a solvent, for life's chemistry to take hold",
    },
    body: { air: "thick", water: "none", pressure: 1.2 },
  },
  sulfur: {
    name: "a sulfur-volcano world",
    icon: "🌋",
    liquid: { subst: "acid-water", name: "acid water", freezeK: 273.15, boilK: 373.15 },
    why: "its rock is kept molten by tides from a near red star, or by its youth (as Io's is by Jupiter's): its volcanoes pour out sulfur",
    bedrock: "sulfide-rich lava crusted yellow with sulfur, and gypsum where its acid seas dried",
    air: "nitrogen and oxygen, with the sulfur dioxide of its volcanoes",
    burns: true,
    fire: "Wood burns in its thin oxygen, and so does sulfur itself, with a blue flame and choking smoke.",
    tools:
      "stone, then copper won from the blue vitriol its acid springs leave, then bronze and iron",
    walls: "sulfur concrete: grit bound with molten sulfur",
    life: {
      solvent: "acid-water",
      words: "in water sour with sulfuric acid",
      odds: 0.85,
      barren: "its acid seas ate the first films of life away before they could take hold",
    },
    body: { air: "breathable", water: "seas", pressure: 1 },
  },
  ammonia: {
    name: "an ice-and-ammonia world",
    icon: "🧊",
    // (Water with about a third of ammonia freezes only at −97 °C, the eutectic.)
    liquid: { subst: "ammonia-water", name: "ammonia water", freezeK: 176, boilK: 300 },
    why: "it gathered ammonia with its water past the snow line, and goes round its star far out, where ammonia water stays liquid",
    bedrock: "water ice, as hard as rock in its cold (at −78 °C ice is about Mohs 6)",
    air: "nitrogen with ammonia",
    burns: false,
    fire: "No fire: nothing in its air can burn anything. Heat comes from the ground and the tides, kept, not made.",
    tools:
      "blades of hard cold ice, edged by wetting them with ammonia water, which melts ice as salt does, and letting them freeze sharp; iron fallen from the sky, hammered cold, too little for blades but enough for its engines' hearts and its dynamos' wire",
    walls: "blocks of ice, set with water that freezes",
    life: {
      solvent: "ammonia-water",
      words: "in ammonia water, some eighty degrees below water's freezing",
      odds: 0.7,
      barren:
        "in its cold ammonia water life's chemistry ran ten thousand times slower than in warm water, and none took hold",
    },
    body: { air: "thick", water: "seas", pressure: 1.5 },
  },
  methane: {
    name: "a methane world",
    icon: "🟠",
    liquid: { subst: "methane", name: "liquid methane and ethane", freezeK: 90, boilK: 125 },
    why: "it is cold and far out, past the snow line, under a thick nitrogen air: its methane rains into seas, and sunlight makes an orange haze of it (as on Titan)",
    bedrock: "water ice as hard as granite at −180 °C, with dunes of tholin",
    air: "thick nitrogen with methane, under an orange haze of tholins",
    burns: false,
    fire: "Nothing burns: there is no oxygen. Energy comes from acetylene joined with hydrogen over nickel, giving methane (McKay & Smith 2005).",
    tools:
      "ice knapped as flint is, and the tholin of its haze made into polymers; iron fallen from the sky, too brittle in its cold to hammer, broken to grit whose nickel its engines join acetylene and hydrogen on, and set whole as its dynamos' magnets",
    walls: "blocks of ice",
    life: {
      solvent: "methane",
      words: "in liquid methane at −180 °C: cells of films that hold together in it, if any can",
      odds: 0.35,
      barren:
        "at −180 °C life's chemistry runs untold times slower than in warm water, and none took hold in its methane seas",
    },
    body: { air: "thick", water: "ice", pressure: 1.5 },
  },
};

/** Whether anything burns on a world of this kind. */
export function kindBurns(kind: WorldKind): boolean {
  return KINDS[kind].burns;
}

// —— The kind a seed falls as ——————————————————————————————————————————————————————————

/**
 * The key of a world's own draws of its kind: a hash of its seed's name, never the seed's stream,
 * so a world that stays rocky keeps every draw it had. (Of the keys tried, the first under which
 * every open seed the tests and gates name stays rocky, so they read the worlds they were written
 * for: `node tools/chem-survey.ts --kinds` checks it.)
 */
export const KIND_KEY = "kind 6287";

/**
 * How readily each comes about. Methane and ammonia: gathered past the snow line. Sulfur: a world's
 * rock kept molten, by the tides of a near red dwarf (masses 0.6 down to 0.35) or by its youth (under
 * 1.5 billion years). A carbon disk: by the star's carbon, which rises with its metals (the age slope
 * of bulkOf, without its scatter), from a C/O of 0.5 to 0.8 and over.
 */
export const KIND_ODDS = {
  methane: 0.05,
  ammonia: 0.06,
  sulfur: 0.04,
  tides: 0.25,
  youth: 0.1,
  carbon: 0.2,
} as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A keyed draw in [0, 1): the n-th of a world's own, by its seed's name. */
function kindDraw(name: string, n: number): number {
  return finish(mix(hashString(`${KIND_KEY} ${name}`), n), 11) / 4294967296;
}

/**
 * What a world's kind is drawn from: its seed's text, its star's mass, its star's age (billions of
 * years, as told).
 */
export type KindInputs = {
  readonly text: string;
  readonly mass: number;
  readonly ageGyr: number;
};

/**
 * The kind its makings and its drawn inputs make, where any make one: the cold liquid first, then
 * carbon, then sulfur.
 */
function kindFrom(carbonDisk: boolean, volatile: Volatile | undefined): NovelKind | null {
  if (volatile === "methane" || volatile === "ammonia") return volatile;
  if (carbonDisk) return "carbon";
  return volatile === "sulfur" ? "sulfur" : null;
}

/**
 * A world's kind. Each input is as the hand made it ("~carbon carbon", "~volatiles methane") or as
 * its seed falls; a made input outranks a drawn one, so a dial makes the kind it says. Between
 * inputs alike made or alike drawn, the cold liquid comes first (it lies over all), then a carbon
 * disk, then sulfur.
 */
export function worldKind(i: KindInputs): WorldKind {
  const made = makingsOf(i.text),
    madeCarbon = made.carbon === undefined ? undefined : made.carbon === "carbon",
    madeVolatile = made.volatiles as Volatile | undefined,
    byHand = kindFrom(madeCarbon === true, madeVolatile);
  if (byHand) return byHand;
  const name = seedName(i.text),
    age = Math.min(i.ageGyr, 12.6),
    tides = clamp01((0.6 - i.mass) / 0.25),
    youth = clamp01((1.5 - age) / 1.2),
    feH = Math.min(0.5, Math.max(-1, 0.3 - 0.065 * age)),
    cO = 0.55 + 0.8 * feH,
    sulfur = KIND_ODDS.sulfur + KIND_ODDS.tides * tides + KIND_ODDS.youth * youth,
    v = kindDraw(name, 1),
    drawn: Volatile =
      v < KIND_ODDS.methane
        ? "methane"
        : v < KIND_ODDS.methane + KIND_ODDS.ammonia
          ? "ammonia"
          : v < KIND_ODDS.methane + KIND_ODDS.ammonia + sulfur
            ? "sulfur"
            : "water",
    disk = kindDraw(name, 2) < KIND_ODDS.carbon * clamp01((cO - 0.5) / 0.3);
  return kindFrom(madeCarbon ?? disk, madeVolatile ?? drawn) ?? "rocky";
}

/**
 * Whether life can take hold in a kind's liquid on this world, where its climate would let it: a
 * keyed draw of its own against its kind's odds (always on a rocky world). A slower chemistry, a
 * scarcer or a harsher solvent takes hold less often.
 */
export function kindLives(text: string, kind: WorldKind): boolean {
  return kind === "rocky" || kindDraw(seedName(text), 3) < KINDS[kind].life.odds;
}

/** A carbon world's C/O, from a draw in [-1, 1): within the making's range for a carbon disk. */
export function carbonRatio(u: number): number {
  const [lo, hi] = MAKINGS.carbon.carbon;
  return lo + ((hi - lo) * (u + 1)) / 2;
}

/**
 * A seed's text with its kind pinned rocky ("~carbon oxygen ~volatiles water"), for a world saved
 * before Phase 56 that its seed now makes another kind: kept as it was made. The text itself where it
 * already makes both.
 */
export function keptRocky(text: string): string {
  const acts = seedActs(text),
    has = (subject: string) => acts.some((a) => a.split(" ")[0] === subject);
  let out = text;
  if (!has("carbon")) out = seedWithAct(out, "carbon oxygen");
  if (!has("volatiles")) out = seedWithAct(out, "volatiles water");
  return out;
}

// —— Warmth read by a world's liquid ————————————————————————————————————————————————————

/** Degrees of a liquid's band (0 at its freezing, 100 at its boiling) for each kelvin. */
function scale(l: Liquid): number {
  return (l.boilK - l.freezeK) / 100;
}

/** Whether a kind's warmth is read as Earth's (its liquid's band is water's). */
export function earthDegrees(kind: WorldKind): boolean {
  const l = KINDS[kind].liquid;
  return l.freezeK === WATER.freezeK && l.boilK === WATER.boilK;
}

/**
 * A warmth of its climate (degrees of its liquid's band, as Earth's °C are of water's) in true
 * degrees Celsius. A world of Earth's degrees, as it is.
 */
export function trueCelsius(kind: WorldKind, degrees: number): number {
  if (earthDegrees(kind)) return degrees;
  const l = KINDS[kind].liquid;
  return l.freezeK + scale(l) * degrees - 273.15;
}

/** A true warmth (°C) as its climate reads it: degrees of its liquid's band. */
export function liquidDegrees(kind: WorldKind, celsius: number): number {
  if (earthDegrees(kind)) return celsius;
  const l = KINDS[kind].liquid;
  return (celsius + 273.15 - l.freezeK) / scale(l);
}

/** How many true kelvin a degree of a kind's climate is (1 where its degrees are Earth's). */
export function kelvinPerDegree(kind: WorldKind): number {
  return earthDegrees(kind) ? 1 : scale(KINDS[kind].liquid);
}

/**
 * Earth's principles a kind names as its own (Phase 56): a carbon world's copper is worked cold, and
 * where nothing burns a ship is driven by engines of the kind's own, not by steam.
 */
export const KIND_PRINCIPLE_NAMES: Readonly<Record<NovelKind, Readonly<Record<string, string>>>> = {
  carbon: { metalworking: "working native copper cold", steamships: "engine-driven ships" },
  sulfur: {},
  ammonia: { steamships: "engine-driven ships" },
  methane: { steamships: "engine-driven ships" },
};

// —— Its seas and its ages, in words ———————————————————————————————————————————————————

/** The words for a kind's seas and its frozen sea, in place of "ocean" and "sea ice". */
export const KIND_SEAS: Readonly<
  Record<NovelKind, { readonly sea: string; readonly frozen: string }>
> = {
  carbon: { sea: "oil sea", frozen: "waxen sea" },
  sulfur: { sea: "acid sea", frozen: "frozen acid sea" },
  ammonia: { sea: "ammonia sea", frozen: "frozen ammonia sea" },
  methane: { sea: "methane sea", frozen: "frozen methane" },
};

/** A biome's name on a world of a kind: its seas are its liquid's ("ocean": "methane sea"). */
export function kindBiomeName(kind: WorldKind, name: string): string {
  if (kind === "rocky") return name;
  const s = KIND_SEAS[kind];
  if (name === "deep ocean") return `deep ${s.sea}`;
  if (name === "ocean") return s.sea;
  if (name === "shallow sea") return `shallow ${s.sea}`;
  return name === "sea ice" ? s.frozen : name;
}

/**
 * One of a kind's own ages: the principles that bring it (any one), its sign, its name, its words,
 * what opens it.
 */
export type KindAge = {
  readonly by: readonly string[];
  readonly icon: string;
  /** Its name in "the age of …" ("electricity": the modern age). */
  readonly name: string;
  /** A land's age in a few words, with its sign. */
  readonly words: string;
  /** What opens it, for the age not yet come. */
  readonly next: string;
};

/**
 * A kind's own ages: the principles that bring each of the three that follow farming (any one of
 * them), and the age told. A sulfur world's are Earth's, and its vitriol's copper besides; a kind
 * where nothing burns climbs its own ladder (rules/principles.ts, the kinds' own roads).
 */
export const KIND_AGES: Readonly<
  Record<NovelKind, Readonly<Record<"metal" | "industry" | "modern", KindAge>>>
> = {
  carbon: {
    metal: {
      by: ["cold-hammering", "carbide-blades"],
      icon: "💎",
      name: "diamond and copper",
      words: "💎 diamond and copper",
      next: "a people who farm first hammer native copper cold",
    },
    industry: {
      by: ["sun-engines"],
      icon: "☀️",
      name: "sun engines",
      words: "☀️ sun engines",
      next: "a people first builds an engine the sun's heat drives",
    },
    modern: {
      by: ["graphite-dynamos"],
      icon: "⚡",
      name: "electricity",
      words: "⚡ modern",
      next: "a people first makes electricity, with dynamos of copper and graphite",
    },
  },
  sulfur: {
    metal: {
      by: ["acid-leaching"],
      icon: "⚒️",
      name: "metal",
      words: "⚒️ metal",
      next: "a people who farm first smelt metal, or win copper from blue vitriol",
    },
    industry: {
      by: [],
      icon: "🏭",
      name: "industry",
      words: "🏭 industry",
      next: "a people first builds a steam engine",
    },
    modern: {
      by: [],
      icon: "⚡",
      name: "electricity",
      words: "⚡ modern",
      next: "a people first makes electricity",
    },
  },
  ammonia: {
    metal: {
      by: ["ice-working"],
      icon: "🧊",
      name: "worked ice",
      words: "🧊 worked ice",
      next: "a people who farm first cut and set ice",
    },
    industry: {
      by: ["heat-engines"],
      icon: "♨️",
      name: "the ground's heat",
      words: "♨️ the ground's heat",
      next: "a people first builds an engine run between the ground's heat and the cold, its heart of iron fallen from the sky",
    },
    modern: {
      by: ["ground-dynamos"],
      icon: "⚡",
      name: "electricity",
      words: "⚡ modern",
      next: "a people first makes electricity of the ground's heat, in dynamos wound with iron fallen from the sky",
    },
  },
  methane: {
    metal: {
      by: ["ice-working"],
      icon: "🧊",
      name: "worked ice",
      words: "🧊 worked ice",
      next: "a people who farm first cut and set ice",
    },
    industry: {
      by: ["cold-chemistry"],
      icon: "🧪",
      name: "cold chemistry",
      words: "🧪 cold chemistry",
      next: "a people first joins acetylene with hydrogen for power, over the nickel of iron fallen from the sky",
    },
    modern: {
      by: ["polymer-wire"],
      icon: "⚡",
      name: "electricity",
      words: "⚡ modern",
      next: "a people first carries current on wires of polyacetylene, in dynamos whose magnets are iron fallen from the sky",
    },
  },
};
