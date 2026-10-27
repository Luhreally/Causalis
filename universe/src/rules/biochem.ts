// What a world's life is made of (Phase 57, asked for 2026-10-26: "alien biochemistry for their life:
// different fibres, dyes, foods and body matter"). The same chemistry everywhere, each world's own
// share of it: life is dissolved in its world's liquid (Phase 56: water, acid water, ammonia water,
// oil, liquid methane), and its sugars and fibres are what chemistry builds in that liquid; it hardens
// its bones of what its seas hold and let stand; its blood carries its breath on the metal that holds
// it there; it catches its star's light with the pigment that light favours (Kiang and others, 2007);
// and its sugars and proteins turn one way or the other, as its first chemistry happened to turn.
// Earth's own is EARTH_LIFE: bones of calcium phosphate, red blood of iron, proteins of left-handed
// amino acids and right-handed sugars, green with chlorophyll. What one life can eat of another
// follows: the same liquid, the same sugars, and the same hand where what it eats turns at all.
import type { CarbonClass, MetalsClass, SilicaClass } from "./chemistry.ts";
import type { WorldKind } from "./kinds.ts";

/** The liquid a life is dissolved in, and so the chemistry it is built of. */
export type LifeFamily = "water" | "ammonia" | "oil" | "methane";
/** Which way its proteins turn: Earth's left (its sugars right), or the mirror of it. */
export type Hand = "left" | "right";
/** What its bones (and its shells) are hardened with. */
export type Bone = "apatite" | "calcite" | "opal" | "greigite" | "ice";
/** What it breathes: oxygen, or (where its air has none) hydrogen. */
export type Breath = "oxygen" | "hydrogen";
/** What its blood carries its breath on. */
export type Blood = "iron" | "copper" | "vanadium" | "iron-sulfur";
/** What the skins of its cells are. */
export type Membrane = "bilayer" | "tetraether" | "supple" | "inverted" | "azotosome";
/** What catches its star's light (methane life lives where too little light reaches: its own colour). */
export type Pigment =
  "chlorophyll" | "carotene" | "phycocyanin" | "bacteriochlorophyll" | "polyimine";

/** A world's life by what it is made of. */
export type LifeChemistry = {
  /** Its world's kind (whose seas it was born in). */
  readonly kind: WorldKind;
  readonly family: LifeFamily;
  readonly hand: Hand;
  readonly bone: Bone;
  readonly shell: Bone;
  readonly breath: Breath;
  readonly blood: Blood;
  readonly membrane: Membrane;
  readonly pigment: Pigment;
  /**
   * Its substances (rules/matter.ts ids): the liquid of its bodies, its sugar (null: it makes none),
   * what its seeds and roots store, the fibre of its stalks, its beasts' hair and flesh, its dye.
   */
  readonly liquid: string;
  readonly sugar: string | null;
  readonly store: string;
  readonly fibre: string;
  readonly hair: string;
  readonly flesh: string;
  readonly dye: string;
  /** Earth's own (EARTH_LIFE), and only it. */
  readonly earth: boolean;
};

/** What a world's life is read from: its kind and chemistry's classes, its star, its warmth, a draw of its ground. */
export type LifeInputs = {
  readonly kind: WorldKind;
  readonly carbon: CarbonClass;
  readonly metals: MetalsClass;
  readonly silica: SilicaClass;
  /** Its star's warmth (K). */
  readonly star: number;
  /** Its world's mean warmth (true °C). */
  readonly mean: number;
  /** A draw in [0, 1) of its ground: which way its first chemistry turned. */
  readonly hand: number;
};

/** Earth's life, frozen: Earth's tables, exactly. */
export const EARTH_LIFE: LifeChemistry = Object.freeze({
  kind: "rocky",
  family: "water",
  hand: "left",
  bone: "apatite",
  shell: "calcite",
  breath: "oxygen",
  blood: "iron",
  membrane: "bilayer",
  pigment: "chlorophyll",
  liquid: "water",
  sugar: "sugar",
  store: "starch",
  fibre: "cellulose",
  hair: "keratin",
  flesh: "protein",
  dye: "chlorophyll",
  earth: true,
});

/** Where a pigment's light begins (K, the star's warmth): the hotter, the bluer its light. */
export const PIGMENT_EDGES = { carotene: 6300, chlorophyll: 5300, phycocyanin: 3900 } as const;

/** Below this mean warmth (°C) a water world's blood is copper's: oxygen dissolves freely in the cold. */
export const COLD_BLOOD = 0;

const FAMILY_OF: Readonly<Record<WorldKind, LifeFamily>> = {
  rocky: "water",
  sulfur: "water",
  ammonia: "ammonia",
  carbon: "oil",
  methane: "methane",
};

const MEMBRANE_OF: Readonly<Record<WorldKind, Membrane>> = {
  rocky: "bilayer",
  sulfur: "tetraether",
  ammonia: "supple",
  carbon: "inverted",
  methane: "azotosome",
};

/**
 * What its bones are hardened with (the first that holds): ice where water ice is as hard as granite;
 * iron sulfide where oxygen is scarce in its seas' salts (a carbon world's, or a carbon-rich rock's);
 * glass where acid eats lime and phosphate; lime in alkaline ammonia water; on a water world poor in
 * metals (and so in phosphorus, made in the same stars) glass where its rock is rich in silica, else
 * lime; lime where its rock is poor in silica (its seas alkaline); else phosphate, as Earth's.
 */
export function boneOf(i: Pick<LifeInputs, "kind" | "carbon" | "metals" | "silica">): Bone {
  if (i.kind === "methane") return "ice";
  if (i.kind === "carbon" || (i.kind === "rocky" && i.carbon === "carbon-rich")) return "greigite";
  if (i.kind === "sulfur") return "opal";
  if (i.kind === "ammonia") return "calcite";
  if (i.metals === "poor") return i.silica === "high" ? "opal" : "calcite";
  if (i.silica === "low") return "calcite";
  return "apatite";
}

/** What catches its light, by its star's warmth (methane life lives under a haze too thick to live by light). */
export function pigmentOf(kind: WorldKind, star: number): Pigment {
  if (kind === "methane") return "polyimine";
  if (star >= PIGMENT_EDGES.carotene) return "carotene";
  if (star >= PIGMENT_EDGES.chlorophyll) return "chlorophyll";
  if (star >= PIGMENT_EDGES.phycocyanin) return "phycocyanin";
  return "bacteriochlorophyll";
}

/** Each pigment's substance. */
const PIGMENT_SUBST: Readonly<Record<Pigment, string>> = {
  chlorophyll: "chlorophyll",
  carotene: "carotene",
  phycocyanin: "phycocyanobilin",
  bacteriochlorophyll: "bacteriochlorophyll",
  polyimine: "polyimine",
};

/** A world's life from its kind, its chemistry, its star and its warmth (never Earth's own: that is EARTH_LIFE). */
export function lifeChemistryOf(i: LifeInputs): LifeChemistry {
  const family = FAMILY_OF[i.kind],
    hand: Hand = i.hand < 0.5 ? "left" : "right",
    m = hand === "right" ? "mirror-" : "",
    bone = boneOf(i),
    breath: Breath = i.kind === "rocky" || i.kind === "sulfur" ? "oxygen" : "hydrogen",
    blood: Blood =
      breath === "hydrogen"
        ? "iron-sulfur"
        : i.kind === "sulfur"
          ? "vanadium"
          : i.mean < COLD_BLOOD
            ? "copper"
            : "iron",
    pigment = pigmentOf(i.kind, i.star);
  const own =
    family === "water"
      ? {
          liquid: "water",
          sugar: `${m}sugar`,
          store: `${m}starch`,
          fibre: `${m}cellulose`,
          hair: `${m}keratin`,
          flesh: `${m}protein`,
        }
      : family === "ammonia"
        ? {
            liquid: "ammonia-water",
            sugar: `${m}glucosamine`,
            store: `${m}glucosamine-starch`,
            fibre: `${m}chitosan`,
            hair: `${m}keratin`,
            flesh: `${m}protein`,
          }
        : family === "oil"
          ? {
              liquid: "crude",
              sugar: null,
              store: "squalene",
              fibre: "polyimine",
              hair: "polyimine",
              flesh: `${m}protein`,
            }
          : {
              liquid: "methane",
              sugar: null,
              store: "acetylene",
              fibre: "polyimine",
              hair: "polyimine",
              flesh: "polyimine",
            };
  return {
    kind: i.kind,
    family,
    hand,
    bone,
    shell: bone === "apatite" ? "calcite" : bone,
    breath,
    blood,
    membrane: MEMBRANE_OF[i.kind],
    pigment,
    ...own,
    dye: PIGMENT_SUBST[pigment],
    earth: false,
  };
}

/** Whether a life is made as Earth's is in every way (Earth's own, or a world's that came out the same). */
export function earthMade(l: LifeChemistry): boolean {
  return (
    l.family === "water" &&
    l.hand === "left" &&
    l.bone === "apatite" &&
    l.blood === "iron" &&
    l.membrane === "bilayer" &&
    l.pigment === "chlorophyll"
  );
}

// —— What eats what ——————————————————————————————————————————————————————————————————————

/** Stores that turn neither way (no hand): squalene's and acetylene's. */
const UNHANDED: ReadonlySet<string> = new Set(["squalene", "acetylene"]);

/**
 * Whether a body of one life can live on another's: dissolved in the same liquid and built of the
 * same sugars, and turning the same way, where what it would eat turns at all (a body's enzymes fit
 * only sugars and proteins of their own hand, as a right glove fits only a right hand).
 */
export function eats(eater: LifeChemistry, food: LifeChemistry): boolean {
  if (eater.family !== food.family) return false;
  return eater.hand === food.hand || UNHANDED.has(food.store);
}

// —— Words ————————————————————————————————————————————————————————————————————————————————

/** Each family: its liquid in words, its sugars, and what its stalks are built of. */
export const FAMILY_WORDS: Readonly<
  Record<LifeFamily, { readonly liquid: string; readonly sugars: string; readonly why: string }>
> = {
  water: {
    liquid: "water",
    sugars: "sugars of carbon, hydrogen and oxygen",
    why: "water dissolves salts and sugars and holds them apart, and its life is built of what it dissolves",
  },
  ammonia: {
    liquid: "ammonia water",
    sugars: "sugars that carry nitrogen (glucosamine)",
    why: "in ammonia water the sugars' oxygen gives way to nitrogen, as an -OH gives way to an -NH₂, and its life is built of sugars that carry it",
  },
  oil: {
    liquid: "oil",
    sugars: "no sugars: oil cannot dissolve them",
    why: "oil dissolves what is like it and nothing that loves water, so its life stores its strength in oils and builds its stalks of chains of carbon and nitrogen that oil cannot dissolve",
  },
  methane: {
    liquid: "liquid methane",
    sugars: "no sugars: at −180 °C they would be stone",
    why: "at −180 °C only small molecules move at all, so its life lives on acetylene and hydrogen and builds of chains of carbon and nitrogen that stay supple in the cold",
  },
};

/** Each hand in words: which way its proteins and its sugars turn. */
export const HAND_WORDS: Readonly<
  Record<Hand, { readonly proteins: string; readonly sugars: string; readonly as: string }>
> = {
  left: {
    proteins: "left-handed amino acids",
    sugars: "right-handed sugars",
    as: "as Earth's",
  },
  right: {
    proteins: "right-handed amino acids",
    sugars: "left-handed sugars",
    as: "the mirror of Earth's",
  },
};

/** Each bone: its substance, its name, and why its life hardens itself with it. */
export const BONE_WORDS: Readonly<
  Record<Bone, { readonly subst: string; readonly name: string; readonly why: string }>
> = {
  apatite: {
    subst: "apatite",
    name: "calcium phosphate",
    why: "of the lime and phosphate its seas hold, as Earth's bones are",
  },
  calcite: {
    subst: "calcite",
    name: "calcium carbonate",
    why: "of lime, as Earth's shells are: its seas give lime where phosphate is scarce (a world poor in metals is poor in phosphorus, made in the same stars) or where they are alkaline",
  },
  opal: {
    subst: "opal",
    name: "silica",
    why: "of glass, as Earth's diatoms and glass sponges build: silica stands where acid eats lime and phosphate away, and where seas rich in it give little else",
  },
  greigite: {
    subst: "greigite",
    name: "iron sulfide",
    why: "of iron and sulfur, as the scaly-foot snail of Earth's deep vents armours itself: where little oxygen is bound in its seas' salts, no lime or phosphate is there to harden with",
  },
  ice: {
    subst: "water-ice",
    name: "ice",
    why: "of grains of water ice bound in its own polymer, as a caddisfly binds sand in silk: at −180 °C ice is as hard as granite",
  },
};

/** Each blood: its carrier's substance, its metal, its colour, and why it carries its breath so. */
export const BLOOD_WORDS: Readonly<
  Record<
    Blood,
    { readonly subst: string; readonly name: string; readonly colour: string; readonly why: string }
  >
> = {
  iron: {
    subst: "haem",
    name: "iron",
    colour: "red",
    why: "iron held in haem takes up oxygen and gives it up again, as Earth's blood does",
  },
  copper: {
    subst: "haemocyanin",
    name: "copper",
    colour: "blue",
    why: "in its cold seas oxygen dissolves freely, and copper, which gives it up best in the cold, carries it (as the blue blood of Earth's octopuses does in the Antarctic's)",
  },
  vanadium: {
    subst: "vanabin",
    name: "vanadium",
    colour: "green",
    why: "in acid, iron slips out of haem and holds no breath, but vanadium stays dissolved and holds it; Earth's sea squirts gather vanadium so, in cells of acid",
  },
  "iron-sulfur": {
    subst: "ferredoxin",
    name: "iron and sulfur",
    colour: "brown",
    why: "it breathes hydrogen, not oxygen, and clusters of iron and sulfur take it up and pass it on, as in Earth's hydrogen-eating cells",
  },
};

/** Each membrane: its substance, the skin of its first cells in a few words, and why. */
export const MEMBRANE_WORDS: Readonly<
  Record<
    Membrane,
    { readonly subst: string; readonly name: string; readonly skin: string; readonly why: string }
  >
> = {
  bilayer: {
    subst: "phospholipid",
    name: "a sheet of fat two molecules thick",
    skin: "fat",
    why: "fats with a head that loves water and tails that shun it lie tail to tail in water, as Earth's cells' skins do",
  },
  tetraether: {
    subst: "caldarchaeol",
    name: "one sheet of fats bound end to end",
    skin: "fat that acid cannot part",
    why: "fats bound end to end across the skin, which acid cannot part, as the skins of Earth's acid-loving archaea are",
  },
  supple: {
    subst: "kinked-phospholipid",
    name: "a sheet of short, kinked fats",
    skin: "fat that keeps supple in the cold",
    why: "fats short and kinked enough to stay supple far below where a straight one sets like wax",
  },
  inverted: {
    subst: "phospholipid",
    name: "a sheet of fat turned inside out",
    skin: "fat turned inside out",
    why: "in oil the same fats lie heads together and tails out, the sheet Earth's cells use turned inside out",
  },
  azotosome: {
    subst: "acrylonitrile",
    name: "a film of acrylonitrile (an azotosome)",
    skin: "acrylonitrile",
    why: "small molecules of carbon, hydrogen and nitrogen might close into a film in liquid methane (Stevenson, Lunine and Clancy, 2015) — offered as a possibility; later reckoning doubts they would gather so",
  },
};

/** Each pigment: its substance, its name, its colour as its life shows it, and why its light favours it. */
export const PIGMENT_WORDS: Readonly<
  Record<
    Pigment,
    { readonly subst: string; readonly name: string; readonly colour: string; readonly why: string }
  >
> = {
  chlorophyll: {
    subst: "chlorophyll",
    name: "chlorophyll",
    colour: "green",
    why: "a yellow star's light is strongest in the middle of the rainbow, and chlorophyll drinks its red and blue and gives back the green, as Earth's leaves do",
  },
  carotene: {
    subst: "carotene",
    name: "carotene",
    colour: "golden",
    why: "a hot white star's light is bluest, and life catches the blue and gives back gold and orange (Kiang and others, 2007)",
  },
  phycocyanin: {
    subst: "phycocyanobilin",
    name: "phycocyanin",
    colour: "blue",
    why: "an orange star's light is reddest, and life drinks the orange and red and gives back blue, as Earth's blue-green cells do",
  },
  bacteriochlorophyll: {
    subst: "bacteriochlorophyll",
    name: "bacteriochlorophyll",
    colour: "black",
    why: "a dim red star's light is mostly heat past the red, and life drinks all it can, the near-infrared with it, and is all but black (Kiang and others, 2007)",
  },
  polyimine: {
    subst: "polyimine",
    name: "polyimine",
    colour: "amber",
    why: "too little light reaches through its haze to live by, so its life lives on what the light makes high in the air (acetylene and hydrogen, McKay and Smith 2005), and is the dark amber of what it is built of",
  },
};

/** Why one life could feed on another, or not, in a sentence's words (`food` the life eaten). */
export function eatsWords(eater: LifeChemistry, food: LifeChemistry): string {
  if (eater.family !== food.family)
    return `its life is dissolved in ${FAMILY_WORDS[food.family].liquid}, theirs in ${FAMILY_WORDS[eater.family].liquid}: nothing of it can feed them`;
  if (eater.hand === food.hand)
    return "its sugars and proteins turn as theirs do: its life could feed them";
  if (UNHANDED.has(food.store))
    return "its proteins turn the other way, but its stores turn neither way: they could live on those";
  return food.sugar
    ? "its sugars turn the other way: nothing of it feeds them"
    : "its proteins turn the other way: nothing of it feeds them";
}

/** The dawn of life as a world's life tells it (the tree of life's first rungs, Phase 17). */
export type DawnWords = {
  readonly replicators: string;
  readonly cells: string;
  /** The light-eaters: what they were, their rung's name, what they came to do and why. */
  readonly light: string;
  readonly lightName: string;
  readonly lightHow: string;
  readonly lightWhy: string;
  readonly nucleus: string;
  /** The weed of the shallows: its name, what it was, why it grew so, and where. */
  readonly weed: string;
  readonly weedWords: string;
  readonly weedWhy: string;
  readonly weedWay: string;
  readonly air: string;
  readonly airWords: string;
};

/** What its first life lived in, as the dawn tells it. */
const DAWN_SEA: Readonly<Record<WorldKind, { readonly sea: string; readonly fill: string }>> = {
  rocky: { sea: "warm water", fill: "water" },
  sulfur: { sea: "warm acid water", fill: "water" },
  ammonia: { sea: "cold ammonia water", fill: "ammonia water" },
  carbon: { sea: "still oil", fill: "oil" },
  methane: { sea: "cold liquid methane", fill: "methane" },
};

/**
 * The dawn's words by a world's life: Earth's own where it is made as Earth's (and its iron rusts),
 * else its own liquid, its cells' skins, its pigment and its breath. `rusts`: its iron rusts in its air.
 */
export function dawnWords(l: LifeChemistry, rusts: boolean): DawnWords {
  const sea = DAWN_SEA[l.kind],
    p = PIGMENT_WORDS[l.pigment],
    hydrogen = l.breath === "hydrogen",
    unlit = l.pigment === "polyimine",
    green = l.pigment === "chlorophyll";
  return {
    replicators: `chains of matter that copied themselves, in the ${sea.sea} of the young world`,
    cells: `replicators inside a skin of ${MEMBRANE_WORDS[l.membrane].skin}: the first cells, dividing to fill the ${sea.fill}`,
    light: unlit
      ? "cells that fed on what the star's light made high in the air, acetylene and hydrogen falling through the haze"
      : `cells that made their food from the star's light${green ? "" : ` with ${p.name}, ${p.colour}`}, breathing out ${hydrogen ? "hydrogen" : "a gas the air had never held"}`,
    // (Under a haze too thick to live by, life eats what the light makes high in the air.)
    lightName: unlit ? "Life eats what the light makes" : "Life eats light",
    lightHow: unlit ? "it came to eat what the light makes in the air" : "it came to eat light",
    lightWhy: unlit
      ? "where what fell from the haze fed none"
      : "where the sunlit water had food for none",
    nucleus: hydrogen
      ? `joining its food with the hydrogen ${unlit ? "of the air" : "the light-eaters had made"}`
      : "burning its food in the air the light-eaters had made",
    weed: `${unlit ? "dark" : p.colour} weed of the shallows`,
    weedWords: `the light-eaters' cells together: weeds swaying in the ${unlit ? "dim shallows under the haze" : "sunlit shallows"}`,
    weedWhy: unlit ? "to catch what falls from the haze" : "to reach the light",
    weedWay: unlit ? "growing under the haze" : "growing in the light",
    air: hydrogen
      ? unlit
        ? "The haze feeds life"
        : "The air fills with hydrogen"
      : "The air fills with oxygen",
    airWords: hydrogen
      ? unlit
        ? "acetylene and hydrogen drifted down from the haze, and life breathed the hydrogen with them"
        : "the light-eaters' hydrogen gathered in the seas and the air, for the cells that came after to breathe"
      : rusts
        ? "the light-eaters' breath gathered in the seas and the air, and the world's iron rusted red"
        : "the light-eaters' breath gathered in the seas and the air, too thin to rust all the world's iron",
  };
}
