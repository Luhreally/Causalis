// Their own names (Phase 58, asked for 2026-10-26: "each people names its materials in its own
// language ... with the field guide giving the real chemistry, much like the original's field
// guide"): what a thing is like, in the meanings a people's names are made of — what kind of thing it
// is, its colour, how it behaves, where it lies, what it is for — read from the thing itself and the
// world it lies in. A name is two or three of these, the kind last: moissanite knapped for its edge
// is "black-edge-stone". The words are a tongue's own (gen/words.ts); these are only the meanings,
// the same for every people. Pure data and arithmetic, read by the host, never by the simulation.
import type { Substance } from "./matter.ts";

/**
 * Every meaning a name is made of, in the order a lexicon coins them: what a thing is, its colours,
 * then how it is, where it lies and what it is for.
 */
export const MEANINGS = [
  // What a thing is: the word its name ends in.
  "stone",
  "ore",
  "metal",
  "salt",
  "clay",
  "earth",
  "ice",
  "water",
  "oil",
  "tar",
  "coal",
  "air",
  "smoke",
  "mist",
  "glass",
  "ash",
  "dust",
  "lime",
  "wood",
  "horn",
  "hide",
  "bone",
  "blood",
  "flesh",
  "fat",
  "meal",
  "sweet",
  "dye",
  "bark",
  "skin",
  "stuff",
  // Its colour (as many as the tongue has words for: COLOUR_STAGES).
  "black",
  "white",
  "red",
  "green",
  "yellow",
  "blue",
  "brown",
  "grey",
  "orange",
  "purple",
  // How it is.
  "hard",
  "soft",
  "heavy",
  "light",
  "edge",
  "brittle",
  "tough",
  "bright",
  "clear",
  "flake",
  "slick",
  "sharp",
  "stink",
  "sour",
  "bitter",
  "strong",
  "poison",
  "cold",
  "fire",
  "burn",
  "idle",
  "choke",
  "breath",
  "false",
  "pull",
  "melt",
  "thunder",
  "rot",
  "glow",
  // Where it lies and what it comes of.
  "deep",
  "river",
  "bog",
  "hill",
  "field",
  "sky",
  "marsh",
  "sea",
  "vent",
  "shell",
  "seed",
  "leaf",
  "dung",
] as const;
export type Meaning = (typeof MEANINGS)[number];

export type Colour =
  "black" | "white" | "red" | "green" | "yellow" | "blue" | "brown" | "grey" | "orange" | "purple";

/**
 * The colours a tongue has words for, by how many it has (Berlin and Kay, 1969): dark and light
 * first, then red, then green or yellow, then both, then blue, brown, and the rest. A family's tongues
 * stand at one stage (gen/words.ts); `yellowFirst`, which of green and yellow came first.
 */
export function coloursAt(stage: number, yellowFirst: boolean): readonly Colour[] {
  const out: Colour[] = ["black", "white"];
  if (stage >= 3) out.push("red");
  if (stage >= 4) out.push(yellowFirst ? "yellow" : "green");
  if (stage >= 5) out.push(yellowFirst ? "green" : "yellow");
  if (stage >= 6) out.push("blue");
  if (stage >= 7) out.push("brown");
  if (stage >= 8) out.push("grey", "orange", "purple");
  return out;
}

/** Where a colour falls in a tongue without a word for it: the nearest it has, in order. */
const FOLDS: Readonly<Record<Colour, readonly Colour[]>> = {
  black: [],
  white: [],
  red: ["white"],
  yellow: ["green", "red", "white"],
  green: ["blue", "yellow", "black"],
  blue: ["green", "black"],
  brown: ["red", "black"],
  grey: ["black"],
  orange: ["red", "yellow", "white"],
  purple: ["blue", "red", "black"],
};

/** A colour as a tongue at `stage` says it. */
export function colourSaid(colour: Colour, have: readonly Colour[]): Colour {
  if (have.includes(colour)) return colour;
  for (const c of FOLDS[colour]) if (have.includes(c)) return c;
  return "black";
}

/** A colour's basic word (0 … 1 each): its lightness first, then its hue. */
export function colourOf(rgb: readonly [number, number, number]): Colour {
  const [r, g, b] = rgb,
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    light = (max + min) / 2,
    chroma = max - min;
  if (light < 0.16) return "black";
  if (chroma < 0.1) return light > 0.72 ? "white" : light > 0.3 ? "grey" : "black";
  const hue =
    max === r
      ? (((g - b) / chroma) % 6) * 60
      : max === g
        ? ((b - r) / chroma + 2) * 60
        : ((r - g) / chroma + 4) * 60;
  const h = (hue + 360) % 360;
  if (light > 0.85 && chroma < 0.25) return "white";
  if (h < 15 || h >= 335) return light < 0.3 ? "brown" : "red";
  if (h < 42) return light < 0.42 ? "brown" : "orange";
  if (h < 70) return light < 0.36 ? "brown" : "yellow";
  if (h < 165) return light < 0.2 ? "black" : "green";
  if (h < 255) return "blue";
  return light < 0.22 ? "black" : "purple";
}

/**
 * What each thing is like, by its substance: the kind of thing it is, then what tells it from its
 * kin, the most telling first. "~" stands for its colour, "@" for where it lies in its world (its
 * ores' lie), "!" for its use there (an edge, where it is the stone knapped; burning, where anything
 * burns). Read with the world's own roles laid over it (likenessOf).
 */
const LIKE: Readonly<Record<string, string>> = {
  copper: "metal ~ soft",
  tin: "metal ~ melt soft",
  bronze: "metal hard ~",
  iron: "metal hard ~ heavy",
  steel: "metal edge hard ~",
  gold: "metal ~ heavy bright",
  zinc: "metal ~ brittle",
  brass: "metal ~ bright",
  malachite: "ore ~ @ soft",
  chalcopyrite: "ore ~ @ bright",
  cassiterite: "ore ~ heavy river",
  hematite: "ore ~ @",
  magnetite: "ore ~ pull heavy",
  limonite: "ore bog ~",
  halite: "salt deep ~",
  pyrite: "stone ~ bright stink",
  sphalerite: "ore ~ deep",
  quartz: "stone clear hard ~",
  flint: "stone ! ~ hard",
  chert: "stone ! ~",
  obsidian: "glass ~ ! fire",
  feldspar: "stone ~",
  plagioclase: "stone ~ hard",
  pyroxene: "stone ~ heavy",
  olivine: "stone ~ deep",
  mica: "stone flake bright ~",
  kaolinite: "clay ~ soft",
  "fired-clay": "clay fire ~",
  calcite: "stone shell ~",
  quicklime: "lime fire ~",
  natron: "salt bitter ~",
  glass: "glass clear",
  potash: "ash ~",
  slag: "stone fire heavy",
  sulphur: "stone ~ burn stink",
  saltpetre: "salt dung ~",
  carbon: "coal ~ !",
  crude: "oil ~ deep !",
  cellulose: "wood ~",
  starch: "meal ~",
  sugar: "sweet ~",
  protein: "flesh ~",
  fat: "fat ~",
  keratin: "horn ~",
  collagen: "hide ~",
  humus: "earth ~ rot",
  apatite: "bone ~",
  tannin: "bark ~",
  leather: "hide bark ~",
  ethanol: "water fire",
  water: "water clear",
  steam: "mist ~",
  nitrogen: "air idle choke",
  oxygen: "air fire breath",
  argon: "air idle",
  co2: "air choke",
  so2: "smoke sour stink",
  "blue-vitriol": "salt ~ sour",
  vitriol: "oil sour",
  "zinc-oxide": "earth ~",
  "black-powder": "dust thunder ~",
  "potash-bisulphate": "salt sour ~",
  "nitric-acid": "water strong sour",
  nitrocellulose: "wood thunder",
  "potassium-sulphide": "salt stink",
  nickel: "metal ~ hard",
  arsenic: "metal ~ poison brittle",
  cupronickel: "metal ~ hard",
  "arsenical-copper": "metal hard ~ poison",
  "telluric-iron": "metal deep ~ heavy",
  cohenite: "stone ~ heavy brittle",
  "cohenite-iron": "metal hard ~ brittle",
  "native-copper": "metal ~ @ soft",
  chalcocite: "ore ~ heavy",
  siderite: "ore ~ bog",
  garnierite: "ore ~ soft",
  arsenopyrite: "ore ~ bright poison",
  "white-arsenic": "dust ~ poison",
  tennantite: "ore ~ poison",
  moissanite: "stone ~ ! hard",
  graphite: "stone ~ soft slick",
  nephrite: "stone ~ tough river",
  corundum: "stone hard ~ river",
  tachylite: "glass ~ fire",
  dolomite: "stone ~ shell",
  "water-ice": "ice hard ~",
  ammonia: "air sharp ~",
  "ammonia-water": "water sharp cold",
  "ammonia-hydrate": "ice cold sharp",
  methane: "air marsh !",
  ethane: "air sky !",
  acetylene: "air sky bright",
  hydrogen: "air light !",
  tholin: "tar ~ sky",
  polyacetylene: "tar bright ~",
  diamond: "stone hard clear !",
  "carbon-monoxide": "air poison idle",
  bitumen: "tar ~",
  "pitch-grit": "stone tar ~",
  "acid-water": "water sour",
  gypsum: "stone ~ soft",
  "sulfur-concrete": "stone ~ melt",
  opal: "stone ~ bright",
  greigite: "stone ~ pull",
  haem: "blood ~",
  haemocyanin: "blood ~",
  vanabin: "blood ~",
  ferredoxin: "blood ~",
  phospholipid: "fat skin",
  "kinked-phospholipid": "fat skin cold",
  caldarchaeol: "fat skin fire",
  acrylonitrile: "skin sharp cold",
  chlorophyll: "dye ~ leaf",
  carotene: "dye ~ leaf",
  phycocyanobilin: "dye ~ leaf",
  bacteriochlorophyll: "dye ~ leaf",
  polyimine: "wood ~ tar",
  squalene: "oil seed ~",
  glucosamine: "sweet ~ sharp",
  "glucosamine-starch": "meal ~ sharp",
  chitosan: "wood ~ sharp",
  "mirror-sugar": "sweet false ~",
  "mirror-starch": "meal false ~",
  "mirror-cellulose": "wood false ~",
  "mirror-protein": "flesh false ~",
  "mirror-keratin": "horn false ~",
  "mirror-collagen": "hide false ~",
  "mirror-glucosamine": "sweet false ~ sharp",
  "mirror-glucosamine-starch": "meal false ~ sharp",
  "mirror-chitosan": "wood false ~ sharp",
};

/** What an element is like, for its name: its own substance's (where it stands alone in one), or the stuff of what it is found in. */
export const ELEMENT_LIKE: Readonly<Record<string, string>> = {
  H: "=hydrogen",
  C: "=carbon",
  N: "=nitrogen",
  O: "=oxygen",
  Na: "stuff salt",
  Mg: "stuff bitter",
  Al: "stuff clay",
  Si: "stuff stone",
  P: "stuff glow",
  S: "=sulphur",
  Cl: "stuff green choke",
  Ar: "=argon",
  K: "stuff ash",
  Ca: "stuff shell",
  Fe: "=iron",
  Cu: "=copper",
  Zn: "=zinc",
  Sn: "=tin",
  Au: "=gold",
  As: "=arsenic",
  Ni: "=nickel",
  V: "stuff sea blood",
};

/** How an ore lies in the ground, as where a people finds it. */
const LIE_PLACE: Readonly<Record<string, Meaning>> = {
  deposit: "deep",
  surface: "field",
  bog: "bog",
  hill: "hill",
  vent: "vent",
  telluric: "deep",
};

/**
 * What a world gives its things: what its life is made of (null: none), its warmth, whether anything
 * burns, the stones its peoples knap (by substance: how keen), how its ores lie (by substance).
 */
export type NamingWorld = {
  /** Its life's liquid, the frozen form of it (null: none in the tables), stores, sugar, flesh, fibre, hair, bone, shell, blood and dye: substance ids. */
  readonly life: {
    readonly liquid: string;
    readonly frozen: string | null;
    readonly store: string;
    readonly sugar: string | null;
    readonly flesh: string;
    readonly fibre: string;
    readonly hair: string;
    readonly bone: string;
    readonly shell: string;
    readonly blood: string;
    readonly dye: string;
    /** Whether its life turns the other way from Earth's (its own are the "mirror-" substances). */
    readonly mirror: boolean;
  } | null;
  readonly burns: boolean;
  /** The stones knapped there, by substance id. */
  readonly stones: readonly string[];
  /** Its ores' lies, by substance id ("surface", "bog"). */
  readonly ores: Readonly<Record<string, string>>;
};

/**
 * A thing as a people would name it: the kind of thing it is, and what tells it from its kin, the
 * most telling first (colour as a colour, before a tongue folds it into the words it has). A thing so
 * near to hand it is named by its kind alone (water, bone, the meal its seeds store) is `bare`.
 */
export type Likeness = {
  readonly head: Meaning;
  readonly marks: readonly (Meaning | Colour)[];
  readonly bare: boolean;
};

const parse = (text: string) => text.split(" ").filter((x) => x.length > 0);

/** A substance as its world's peoples know it (rules first, then the world's own roles over it). */
export function likenessOf(s: Substance, w: NamingWorld): Likeness {
  const [head, ...rest] = parse(LIKE[s.id] ?? `${headOf(s)} ~`),
    colour = colourOf(s.colour),
    marks: (Meaning | Colour)[] = [];
  for (const m of rest) {
    if (m === "~") marks.push(colour);
    else if (m === "@") {
      const lie = w.ores[s.id];
      if (lie && LIE_PLACE[lie]) marks.push(LIE_PLACE[lie]);
    } else if (m === "!") {
      if (w.stones.includes(s.id)) marks.push("edge");
      else if ((s.kind === "fuel" || s.kind === "gas") && w.burns) marks.push("burn");
    } else marks.push(m as Meaning);
  }
  let h = head as Meaning,
    bare = false;
  const l = w.life;
  if (l) {
    // Its life's own: named by their kind alone (or marked as of bone, shell, leaf).
    if (s.id === l.liquid) [h, bare] = ["water", true];
    else if (s.id === l.frozen) [h, bare] = ["ice", true];
    else if (s.id === l.store) [h, bare] = ["meal", true];
    else if (s.id === l.sugar) [h, bare] = ["sweet", true];
    else if (s.id === l.flesh) [h, bare] = ["flesh", true];
    else if (s.id === l.fibre) [h, bare] = ["wood", true];
    else if (s.id === l.hair) [h, bare] = ["horn", true];
    else if (s.id === l.blood) [h, bare] = ["blood", true];
    else if (s.id === l.bone && s.kind === "living") [h, bare] = ["bone", true];
    else if (s.id === l.bone) marks.unshift("bone");
    else if (s.id === l.shell) marks.unshift("shell");
    else if (s.id === l.dye && !marks.includes("leaf")) marks.push("leaf");
    // (Where its life turns the other way, Earth's own are the strange ones: Earth's sugar is the false sweet.)
    if (l.mirror && !bare) {
      const f = marks.indexOf("false");
      if (s.id.startsWith("mirror-")) {
        if (f >= 0) marks.splice(f, 1);
      } else if (LIKE[`mirror-${s.id}`]) marks.unshift("false");
    }
  }
  // (Water where it is not the world's liquid: the warm water its ice melts to.)
  if (h === "water" && !bare && s.id === "water") marks.unshift("melt");
  if (s.id === "water" && !l) bare = true;
  return { head: h, marks: dedupe(marks), bare };
}

/** A stone of no one substance (basalt, fieldstone), as a people names it: its colour, its edge. */
export function stoneLikeness(colour: readonly [number, number, number]): Likeness {
  return { head: "stone", marks: [colourOf(colour), "edge", "hard"], bare: false };
}

/** An element as a people names it: its own substance's name ("=copper"), or the stuff of what holds it. */
export function elementLikeness(symbol: string): { readonly same: string } | Likeness | null {
  const like = ELEMENT_LIKE[symbol];
  if (!like) return null;
  if (like.startsWith("=")) return { same: like.slice(1) };
  const [head, ...marks] = parse(like);
  return { head: head as Meaning, marks: marks as Meaning[], bare: false };
}

/** A substance's kind of thing where the table has none (a substance added after Phase 58). */
function headOf(s: Substance): Meaning {
  if (s.kind === "metal") return "metal";
  if (s.kind === "ore") return "ore";
  if (s.kind === "gas") return "air";
  if (s.kind === "water") return "water";
  if (s.kind === "food") return "meal";
  if (s.kind === "fuel") return s.phase === "liquid" ? "oil" : "coal";
  if (s.kind === "living") return "wood";
  return s.phase === "liquid" ? "water" : "stone";
}

function dedupe<T>(xs: readonly T[]): T[] {
  return xs.filter((x, i) => xs.indexOf(x) === i);
}

/** A name's meaning in English, its marks first and its kind last: "black-edge-stone". */
export function glossOf(head: string, marks: readonly string[]): string {
  return [...marks, head].join("-");
}
