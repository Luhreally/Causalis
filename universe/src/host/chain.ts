// The chain from the ground to a thing (Phase 50 M212, asked for 2026-10-25: "mean crafting as the
// backbone of the whole game ... every made thing, at every age, is made by someone from what's
// actually around them, so the land decides what a people can make ... Tapping a thing traces it:
// an iron sword leads to the bog ore of some land, the bloomery that smelted it, the smith who
// forged it, and its quality"). For a thing made in a land in a year — a tool of a trade, a pot, a
// garment, a realm's arms — what it was made of there and then; where that came from: dug from a
// deposit or a showing of the land's own, of a neighbour's a few days' walk off, or brought down
// the road from another land; how it was smelted and worked, by whom (named in the land's tongue,
// so many years at the work) and where (the town's smithy, kiln or works, its page); and how good
// it is. Told by the very rules the simulation chose its stuff by — one ore rule and one metals rule
// for a land's tools and a realm's host alike, and the year's trade for what came down the road
// (Phase 52 M216) — never read by the simulation, never kept.
import { finish, hashString, mix, type Ref, type World } from "../kernel/index.ts";
import {
  BIOME,
  cradleTongue,
  personName,
  tongueName,
  tonguePersonName,
  type Species,
  worldChemistry,
  worldGroundStone,
} from "../gen/index.ts";
import {
  ARSENICAL_ORE,
  CLAYS_REDUCED,
  G,
  GOODS,
  METALS,
  OCC,
  SMELTING as SMELTS,
  WORKED,
  alloyOf,
  article,
  civic,
  clayOverride,
  coatColour,
  coatWord,
  designWords,
  findSubstance,
  firearm,
  gradeOf,
  machined,
  metalOf,
  oresOn,
  partWords,
  qualityOf,
  roleWord,
  worldOre,
  type Chemistry,
  type Edge,
  type Metal,
  type Ore,
  type OreLie,
  type Part,
  type Stone,
} from "../rules/index.ts";
import {
  cultureOf,
  designsOf,
  fuelFor,
  heatShortfall,
  homePlanet,
  loreOf,
  machinedFor,
  marketGoodRef,
  marketsOf,
  oreWorkable,
  politiesOf,
  populationContext,
  smeltable,
  tameNow,
  forgedMetal,
  toolMetal,
  townsOf,
  type ToolMetal,
} from "../sim/index.ts";
import type { Block, Line, Span, TownStuff } from "../bridge/index.ts";
import { soilOf } from "./inspect/ground.ts";
import { rxnRef, substRef } from "./inspect/matter.ts";
import { landLink, landTitle, realmLink, townLink } from "./inspect/names.ts";
import { item, link, sentence } from "./inspect/words.ts";
import { kindVessel, smithAt, workedBought, workedLine } from "./kinds.ts";
import { clothLife, millBlock, ropeLines } from "./biochem.ts";

type Rgb = readonly [number, number, number];

/** A keyed share (0 … 1) of words: the same words, the same share. */
const keyed = (words: string) => (hashString(words, 0x3a0c) >>> 0) / 2 ** 32;

// —— The land's own stuff ——————————————————————————————————————————————————————————

/** The wood of a land's shafts and hafts, the fibre of its cord, what binds a point on: by its biome. */
export const WOODS: Readonly<
  Record<number, readonly [wood: string, fibre: string, binding: string]>
> = {
  [BIOME.ice]: ["driftwood", "sinew", "sinew"],
  [BIOME.tundra]: ["dwarf willow", "sinew", "sinew and seal fat"],
  [BIOME.borealForest]: ["spruce", "spruce root", "sinew and birch pitch"],
  [BIOME.coldDesert]: ["tamarisk", "sagebrush bark", "sinew and pine gum"],
  [BIOME.steppe]: ["willow", "grass", "sinew and birch pitch"],
  [BIOME.temperateForest]: ["ash", "nettle", "sinew and birch pitch"],
  [BIOME.temperateRainforest]: ["yew", "cedar bark", "sinew and spruce gum"],
  [BIOME.hotDesert]: ["acacia", "palm fibre", "sinew and acacia gum"],
  [BIOME.savanna]: ["acacia", "bowstring hemp", "sinew and acacia gum"],
  [BIOME.tropicalDryForest]: ["ironwood", "bark", "sinew and resin"],
  [BIOME.tropicalRainforest]: ["bamboo", "palm fibre", "rattan and resin"],
  [BIOME.alpine]: ["juniper", "grass", "sinew and pine gum"],
};

/** A land's wood: its biome's. */
export function landWood(world: World, cell: number): string {
  const biome = populationContext(world).generated.climate.biome[cell] ?? -1;
  return WOODS[biome]?.[0] ?? "ash";
}

/** A land's clay: what it is called, the ware it fires to, its soil, its colour drying and fired. */
export type Clay = {
  readonly name: string;
  readonly ware: string;
  readonly soil: string;
  readonly raw: Rgb;
  readonly fired: Rgb;
};

/** Clays by what they fire to: iron-red, lime-buff, a little iron's orange, near none's pale. */
const CLAYS: Readonly<Record<string, Omit<Clay, "soil">>> = {
  red: {
    name: "red clay",
    ware: "red earthenware",
    raw: [0.5, 0.29, 0.21],
    fired: [0.62, 0.28, 0.17],
  },
  buff: {
    name: "yellow lime clay",
    ware: "buff earthenware",
    raw: [0.62, 0.58, 0.48],
    fired: [0.86, 0.75, 0.55],
  },
  brown: {
    name: "brown clay",
    ware: "terracotta",
    raw: [0.46, 0.38, 0.3],
    fired: [0.76, 0.46, 0.29],
  },
  pale: {
    name: "white clay",
    ware: "pale earthenware",
    raw: [0.66, 0.65, 0.62],
    fired: [0.9, 0.87, 0.8],
  },
};

/**
 * The clay a land's potters dig from its banks, by what its soil is made of (Phase 51 M214): of
 * what is left of it once fired — its water driven off, its humus burnt out — a twentieth of iron
 * or more fires it red; lime fires it buff, whatever iron it holds; a little iron fires it
 * orange; next to none, pale.
 */
export function landClay(world: World, cell: number): Clay {
  const chem = worldChemistry(homePlanet(world).generated),
    soil = soilOf(world, cell),
    share = (id: string) => soil.parts.find(([s]) => s === id)?.[1] ?? 0,
    body = Math.max(0.01, 1 - share("water") - share("humus")),
    // (On a reduced world its iron is black: the magnetite fires as Earth's hematite does.)
    iron = (share("hematite") + (chem.redox === "reduced" ? share("magnetite") : 0)) / body,
    lime = share("calcite") / body,
    // (Iron fired in an oxygen-poor kiln stays black or grey: a reduced world's own clays.)
    reducedKind = clayOverride(chem, iron, lime);
  if (reducedKind !== null) return { soil: soil.name, ...CLAYS_REDUCED[reducedKind] };
  const kind = iron >= 0.06 ? "red" : lime >= 0.05 ? "buff" : iron >= 0.02 ? "brown" : "pale";
  return { soil: soil.name, ...CLAYS[kind]! };
}

/**
 * The beast a land's flocks are of, where its herders keep any (null: none): its own that can be
 * tamed, else the one its herding was first found with, followed back through the lands that
 * taught it (else, if that history is forgotten, the first living beast the world could tame).
 */
export function flockOf(world: World, cell: number): Species | null {
  const land = populationContext(world).provinces.get(cell);
  if (!land?.herding || land.total() <= 0 || land.occupation(OCC.herder) <= 0) return null;
  return flockBeast(world, cell, land.herding);
}

/** The beast a land's flocks are of, its herding found as `herding` (see flockOf). */
export function flockBeast(world: World, cell: number, herding: Ref): Species | null {
  const life = populationContext(world).generated.life,
    own = life.herdBeast[cell] ?? -1;
  // (Its own, while it is tame: one the god has made wild was herded, if at all, before.)
  if (own >= 0 && tameNow(world, life.species[own]!)) return life.species[own]!;
  let ref: Ref | null = herding;
  for (let hops = 0; ref && hops < 64; hops++) {
    const e = world.events.get(ref);
    if (!e) break;
    const beast = (e.data as { beast?: unknown } | null)?.beast;
    if (typeof beast === "string") return life.species.find((s) => s.name === beast) ?? null;
    ref = (e.causes[0]?.ref as Ref | undefined) ?? null;
  }
  return life.species.find((s) => s.tame && s.niche === "grazer" && s.died === null) ?? null;
}

/** A land's plant fibres by their colour, undyed (any other a dry straw's). */
const FIBRE_COLOUR: Readonly<Record<string, Rgb>> = {
  nettle: [0.7, 0.68, 0.56],
  grass: [0.78, 0.74, 0.5],
  "palm fibre": [0.8, 0.68, 0.46],
  "bowstring hemp": [0.82, 0.78, 0.62],
  bark: [0.55, 0.4, 0.27],
  "cedar bark": [0.58, 0.4, 0.28],
  "spruce root": [0.6, 0.46, 0.32],
  "sagebrush bark": [0.62, 0.56, 0.44],
};

/** What a land's weavers weave: its cloth's name, its colour undyed, where its fibre came from. */
export type Cloth = {
  /** What a garment of it is called by: "woollen", "goat-hair", "nettle". */
  readonly kind: string;
  /** "woollen cloth", "goat-hair cloth", "nettle cloth". */
  readonly name: string;
  readonly colour: Rgb;
  /** Its fibre, from the land: "Dun woolly sheep wool, shorn from the flocks of [land]". */
  readonly from: Line;
  /** Woven of the land's plants, not its flocks' coats (Phase 57: of its world's own fibre). */
  readonly plant?: true;
};

/**
 * What a land's weavers weave (Phase 51 M214): the fibre its own flocks give — the wool of a
 * woolly beast, the hair of a furred one, the down of a feathered one, each its coat's colour —
 * else the fibre of its own plants, the same its cord is twisted of (sinew, where none grows,
 * given for grass).
 */
export function landCloth(world: World, cell: number): Cloth {
  const beast = flockOf(world, cell),
    covering = beast?.wool ? "wool" : (beast?.body?.covering ?? null),
    land = landLink(world, cell);
  if (beast && (covering === "wool" || covering === "fur" || covering === "feathers")) {
    // (The beast without its colour: "goat" of "black goat", "sheep" of "dun woolly sheep".)
    const word = coatWord(beast.name),
      noun =
        beast.name
          .split(" ")
          .filter((w) => w !== word && w !== "woolly")
          .join(" ") || beast.name,
      kind = covering === "wool" ? "woollen" : `${noun}-${covering === "fur" ? "hair" : "down"}`,
      fibre = covering === "wool" ? "wool" : covering === "fur" ? "hair" : "down",
      how = covering === "wool" ? "shorn" : covering === "fur" ? "combed" : "plucked";
    return {
      kind,
      name: `${kind} cloth`,
      colour: coatColour(beast.name, covering === "wool"),
      from: [link(sentence(beast.name), beast.ref), ` ${fibre}, ${how} from the flocks of `, land],
    };
  }
  const biome = populationContext(world).generated.climate.biome[cell] ?? -1,
    grown = WOODS[biome]?.[1] ?? "grass",
    plant = grown === "sinew" ? "grass" : grown;
  return {
    kind: plant,
    plant: true,
    name: `${plant} cloth`,
    colour: FIBRE_COLOUR[plant] ?? [0.74, 0.7, 0.56],
    from: [sentence(plant), " gathered in ", land, ", retted and beaten soft"],
  };
}

/**
 * The stone a land knaps: of its rocks (any that is a twenty-fifth of it or more, and the rock
 * under a spot of it if given), the one whose stone takes the keenest edge — they went far for
 * good stone. Its rock, and the stone. (gen/bedrock.ts: the simulation reads it alike.)
 */
export function landStone(
  world: World,
  cell: number,
  under?: string,
): { readonly rock: string; readonly stone: Stone } {
  return worldGroundStone(homePlanet(world).generated, cell, under);
}

// —— Who made it, and where ———————————————————————————————————————————————————————————

/** Someone who made a thing: named in their land's tongue, at their trade so many years then. */
export type Maker = {
  readonly name: string;
  /** "smith", "potter", "weaver", "tanner", "knapper", "hand at the works". */
  readonly trade: string;
  readonly years: number;
  /** Their town (null: a land without one). */
  readonly town: string | null;
};

/** Where a thing was worked: one of its town's buildings (its page), or words. */
export type Workshop = { readonly name: string; readonly ref: string | null };

/** What a thing is made of, where from, how, by whom, and how good. */
export type Made = {
  /** Its stuff as named on the thing: "bog iron", "flint", "bronze", "woven wool". */
  readonly stuff: string;
  readonly edge: Edge;
  readonly colour: Rgb;
  readonly quality: number;
  readonly grade: string;
  readonly maker: Maker | null;
  readonly workshop: Workshop;
  /** From the ground to the hand, a line each, each part its page. */
  readonly chain: readonly Line[];
};

/** The town a land's things are made in: its market town, else its greatest (null: none). */
export function makingTown(
  world: World,
  cell: number,
): { readonly ref: string; readonly name: string; readonly population: number } | null {
  const towns = populationContext(world).settlements.inProvince(cell);
  if (!towns.length) return null;
  return (
    towns.find((s) => s.market) ?? towns.reduce((a, b) => (b.population > a.population ? b : a))
  );
}

/** A town's building of a kind standing in a year — begun, done, and not yet fallen — as its page. */
export function workshopOf(
  world: World,
  town: string | null,
  kinds: readonly string[],
  year: number,
): Workshop | null {
  if (!town) return null;
  const f = townsOf(world).get(town as Ref),
    s = populationContext(world).settlements.get(town as Ref);
  if (!f || !s) return null;
  for (const kind of kinds) {
    const c = f.civics.find(
      (x) => x.kind === kind && x.end <= year && (x.fell === null || x.fell > year),
    );
    if (c)
      return {
        name: `the ${civic(c.kind).name.replace(/^(a|an) /, "")} of ${s.name}`,
        ref: `bldg:${town}:${c.at}:${c.start}`,
      };
  }
  return null;
}

/** How long one maker keeps a seat at a trade before another takes it (years). */
const TENURE = 28;

/**
 * One of a town's makers at a trade, who made the thing keyed `key` in `year`: which of the
 * trade's seats (by the key), who held it then (each seat passes on every TENURE years, at its own
 * phase), named in the land's tongue — a given name and a family's — and their years at it then.
 */
export function makerOf(
  world: World,
  cell: number,
  town: { readonly ref: string; readonly population: number } | null,
  trade: string,
  key: string,
  year: number,
): Maker {
  return makerAt(world, cell, town, trade, Math.floor(keyed(`${key}:seat`) * seatsOf(town)), year);
}

/** How many seats a town keeps at a trade: one, and one more for every six hundred of its people, up to six. */
export function seatsOf(town: { readonly population: number } | null): number {
  return Math.max(1, Math.min(6, 1 + Math.floor((town?.population ?? 0) / 600)));
}

/** Who held one of a town's seats at a trade in a year: named, and their years at it then. */
export function makerAt(
  world: World,
  cell: number,
  town: { readonly ref: string; readonly population: number } | null,
  trade: string,
  seat: number,
  year: number,
): Maker {
  const at = `${town?.ref ?? cell}:${trade}:${seat}`,
    phase = Math.floor(keyed(at) * TENURE),
    term = Math.floor((year + phase) / TENURE),
    years = 2 + ((((year + phase) % TENURE) + TENURE) % TENURE),
    who = finish(mix(hashString(`maker ${at}`), term), 7) >>> 0,
    sex = trade === "smith" || trade === "knapper" ? 1 : (who >>> 9) & 1,
    tongue = cultureOf(world).get(cell)?.tongue,
    culture = populationContext(world).culture,
    family = tongue ?? cradleTongue(culture);
  return {
    name: `${tongue ? tonguePersonName(tongue, who, sex) : personName(culture, who, sex)} ${tongueName({ ...family, seed: family.seed ^ 0xf00d }, who >>> 3)}`,
    trade,
    years,
    town: town?.ref ?? null,
  };
}

/**
 * Who holds one of a town's seats at a trade in a year, as makerAt names them: their key, whether a
 * man, and the year they took the seat (Phase 55 wave 5: their family and body, told on their page).
 */
export function makerKeyAt(
  town: { readonly ref: string } | null,
  cell: number,
  trade: string,
  seat: number,
  year: number,
): { readonly key: number; readonly sex: 0 | 1; readonly took: number } {
  const at = `${town?.ref ?? cell}:${trade}:${seat}`,
    phase = Math.floor(keyed(at) * TENURE),
    term = Math.floor((year + phase) / TENURE),
    who = finish(mix(hashString(`maker ${at}`), term), 7) >>> 0;
  return {
    key: who,
    sex: trade === "smith" || trade === "knapper" ? 1 : (((who >>> 9) & 1) as 0 | 1),
    took: term * TENURE - phase - 2,
  };
}

/** A maker in words: "Aldin Vorrane, a smith of Sairis, eleven years at the anvil". */
export function makerWords(world: World, m: Maker, bench: string): Line {
  const s = m.town ? populationContext(world).settlements.get(m.town as Ref) : undefined;
  return [
    `${m.name}, ${article(m.trade)} ${m.trade}${s ? " of " : ""}`,
    ...(s ? [townLink(world, s.ref)] : []),
    `, ${m.years} years at the ${bench}`,
  ];
}

// —— Where the stuff came from ———————————————————————————————————————————————————————

/** Where an ore was smelted, by how it lies. */
const SMELTED: Readonly<Record<OreLie, string>> = {
  deposit: "a furnace by the mine",
  surface: "a clay furnace by the diggings",
  bog: "a clay furnace by the marsh",
  hill: "a clay furnace in the hills",
  vent: "a furnace on the shore",
  telluric: "a smith's hearth by the lava field",
};

/** An ore dug, in words: its mineral (its page), how it lay, the land (and its deposit), how far. */
function oreLine(
  world: World,
  ore: Ore,
  at: number,
  deposit: string | null,
  far: string | null,
): Line {
  return [
    link(sentence(ore.name), substRef(ore.mineral)),
    ` — ${ore.words} — dug in `,
    landLink(world, at),
    ...(deposit ? [" (", link("its deposit", deposit), ")"] : []),
    ...(far ? [`, ${far}`] : []),
  ];
}

/** What is done to each ore, said: smelted, roasted first, smelted to a bloom. */
const SMELT_WORDS: Readonly<Record<string, string>> = {
  "smelt-malachite": "Smelted",
  "roast-chalcopyrite": "Roasted and smelted",
  "smelt-cassiterite": "Smelted",
  bloomery: "Smelted to a bloom",
  "bog-bloomery": "Roasted, then smelted to a bloom",
  // (A world of its own chemistry's ores, as their reactions name them.)
  "melt-native-copper": "Melted and poured",
  "smelt-chalcocite": "Melted and blown to copper",
  "smelt-garnierite": "Smelted at a bloomery's heat",
  "roast-arsenopyrite": "Roasted for its white arsenic",
  "roast-tennantite": "Roasted for its white arsenic, then smelted",
  "smelt-siderite": "Roasted, then smelted to a bloom",
  "smelt-magnetite": "Smelted to a bloom",
  "forge-telluric": "Forged from the lump at a red heat",
  "carbide-bloomery": "Smelted to a carbon-rich bloom",
  // (A sulfur world's: Phase 56.)
  "reduce-vitriol": "Reduced from its blue crust",
};

/** An ore smelted, in words: the reaction (its page), where, with what. */
function smeltLine(world: World, ore: Ore, lie: OreLie, at: number): Line {
  // (An ore worked where nothing burns says how, and why: Phase 56.)
  if (ore.worked) return workedLine(ore, ore.worked);
  return [
    link(SMELT_WORDS[ore.smelt] ?? "Smelted", rxnRef(ore.smelt)),
    ` in ${SMELTED[lie]}, with charcoal of ${landWood(world, at)}`,
  ];
}

/** A metal good by its ore's kind: copper, tin, iron. */
function goodOf(kind: string): number {
  return GOODS.findIndex((g) => g.id === kind);
}

/** A land's ore of a kind by the one rule (sim/economy/ore.ts): what it is, how it lies, whose land, its deposit. */
function oreOf(
  world: World,
  cell: number,
  kind: string,
): {
  readonly ore: Ore;
  readonly lie: OreLie;
  readonly cell: number;
  readonly deposit: string | null;
  /** Its copper hardened with its own arsenic, where a world's tin is worked so (Phase 54). */
  readonly arsenical?: boolean;
} | null {
  const chem = worldChemistry(homePlanet(world).generated),
    o = oreWorkable(populationContext(world), cell, kind);
  if (!o || o.lie === "seam") return null;
  const ore = o.arsenical
    ? ARSENICAL_ORE
    : (worldOre(chem, kind, o.lie) ?? worldOre(chem, kind, "deposit"));
  return ore
    ? {
        ore,
        lie: o.lie,
        cell: o.cell,
        deposit: o.lie === "deposit" ? o.ref : null,
        ...(chem.solar ? {} : { arsenical: !!o.arsenical }),
      }
    : null;
}

/** A land's ore of a kind, dug and smelted, in lines. (`near`: how a neighbour's is said.) */
function oreLines(
  world: World,
  cell: number,
  kind: string,
  near = "a few days' walk off",
): Line[] | null {
  const o = oreOf(world, cell, kind);
  if (!o) return null;
  return [
    oreLine(world, o.ore, o.cell, o.deposit, o.cell !== cell ? near : null),
    smeltLine(world, o.ore, o.lie, o.cell),
  ];
}

/**
 * Where a land's metal of a kind came from (Phase 52 M216), by the sim's own books for the year: the
 * roads it came down, its own land first, back to the land whose smelters won it from their ore
 * within reach (at most `hops` roads back); `smelted` null where it was bought in a market no
 * further told.
 */
function whence(
  world: World,
  cell: number,
  kind: string,
  hops = 4,
): { readonly roads: readonly number[]; readonly smelted: number | null } {
  const ctx = populationContext(world),
    markets = marketsOf(world),
    good = goodOf(kind),
    roads = [cell];
  for (let at = cell, hop = 0; ; hop++) {
    const can = smeltable(ctx, at, good) !== null,
      made = (markets.get(at)?.book("made", good) ?? 0) > 0,
      next =
        hop < hops
          ? markets.flows
              .filter((f) => f.to === at && f.good === good && !roads.includes(f.from))
              .sort((a, b) => b.count - a.count || a.from - b.from)[0]?.from
          : undefined;
    // Its own smelters' metal where they smelted it, or where none came in for them to buy.
    if (can && (made || next === undefined)) return { roads, smelted: at };
    if (next === undefined) return { roads, smelted: null };
    roads.push(next);
    at = next;
  }
}

/**
 * Where a land's metal of a kind came from, in lines: dug and smelted (its own land's ore, or a
 * neighbour's), then brought down each road to it; else bought in a market.
 */
function traced(world: World, cell: number, kind: string): Line[] {
  const chem = worldChemistry(homePlanet(world).generated),
    { roads, smelted } = whence(world, cell, kind),
    lines: Line[] =
      smelted !== null
        ? (oreLines(
            world,
            smelted,
            kind,
            smelted === cell
              ? "a few days' walk off"
              : `a few days' walk from ${landTitle(world, smelted)}`,
          ) ?? [])
        : (() => {
            // (Bought where no one can tell whose ore it was: smelted all the same, or worked
            // as its world works it where nothing burns — Phase 56.)
            const usual =
                worldOre(chem, kind, "deposit") ?? Object.values(oresOn(chem)[kind] ?? {})[0],
              smelted: Span[] = usual?.worked
                ? workedBought(usual, usual.worked)
                : usual
                  ? [
                      ", ",
                      link("smelted", rxnRef(usual.smelt)),
                      " from its ore in a land none can tell",
                    ]
                  : [];
            return [
              roads.length > 1
                ? [
                    sentence(roleWord(chem, kind)),
                    ...smelted,
                    ", bought in the market of ",
                    landLink(world, roads.at(-1)!),
                  ]
                : [
                    sentence(roleWord(chem, kind)),
                    ...smelted,
                    ", bought in the market from no road told",
                  ],
            ];
          })();
  for (let k = roads.length - 1; k > 0; k--)
    lines.push([
      "Brought down the road from ",
      landLink(world, roads[k]!),
      " to ",
      landLink(world, roads[k - 1]!),
    ]);
  return lines;
}

/**
 * Whether a land's tin is smelted from arsenical ore (Phase 54): the land that smelts it, as `whence`
 * finds it, and that land's ore of tin. The Sun's tin never is.
 */
function tinArsenical(world: World, cell: number): boolean {
  const chem = worldChemistry(homePlanet(world).generated);
  if (chem.solar) return false;
  const { smelted } = whence(world, cell, "tin");
  return smelted !== null && oreOf(world, smelted, "tin")?.arsenical === true;
}

/** What a tool or arm of a metal is worked from, each metal traced, then alloyed or steeled. */
function metalChain(world: World, cell: number, metal: Metal): Line[] {
  const chem = worldChemistry(homePlanet(world).generated),
    chain: Line[] = [];
  for (const good of WORKED[metal].from) chain.push(...traced(world, cell, GOODS[good]!.id));
  if (metal === "bronze") {
    // (Its alloy: the tin of the Sun's, or what its world's hardener makes of the copper.)
    const a = alloyOf(chem, tinArsenical(world, cell));
    chain.push([link("Alloyed", rxnRef(a.reaction)), `: ${a.words}`]);
  }
  if (metal === "steel")
    chain.push([link("Steeled", rxnRef("carburise")), ": the iron packed in charcoal and fired"]);
  return chain;
}

// —— A land's things ————————————————————————————————————————————————————————————————

/** Its land's craft at a work, 0 … 1 (what its lore teaches of it). */
function craftAt(world: World, cell: number, work: "tools" | "clothing" | "pottery"): number {
  return Math.min(1, loreOf(world).effect(cell, work));
}

/**
 * A tool's head, by the metal its land worked it of in the year it was made (`seat`: made by the
 * one who held that seat at the trade, Phase 51 M213 — a tool hung on the smithy's rack).
 */
export function toolMade(
  world: World,
  cell: number,
  key: string,
  year: number,
  home: boolean,
  town?: string | null,
  seat?: number,
  forged?: ToolMetal,
): Made {
  // (At the smithy, what its smiths forged that year; elsewhere what its land's tools were headed
  // with — Phase 52 M217.)
  const chem = worldChemistry(homePlanet(world).generated),
    metal: ToolMetal = forged ?? toolMetal(populationContext(world), cell, year),
    t = town
      ? (populationContext(world).settlements.get(town as Ref) ?? makingTown(world, cell))
      : makingTown(world, cell),
    craft = craftAt(world, cell, "tools");
  if (metal === "stone") {
    const { stone } = landStone(world, cell),
      maker = home ? null : makerOf(world, cell, t, "knapper", key, year),
      chain: Line[] = [
        [
          link(sentence(stone.name), stone.subst ? substRef(stone.subst) : null),
          ` — ${stone.from} — of `,
          landLink(world, cell),
        ],
        [
          // (A kind's stone says how it is edged: Phase 56.)
          stone.worked ?? "Knapped to an edge and hafted",
          ...(maker ? [" by ", ...makerWords(world, maker, "knapping stone")] : [" at home"]),
        ],
      ],
      quality = qualityOf(stone, craft, maker?.years ?? 6);
    return {
      stuff: stone.name,
      edge: stone,
      colour: stone.colour,
      quality,
      grade: gradeOf(quality),
      maker,
      workshop: { name: home ? "home" : "the knappers' ground", ref: null },
      chain,
    };
  }
  // Each metal it is worked from: its land's own ore or a neighbour's, else down the roads.
  const chain = metalChain(world, cell, metal as Metal),
    // (On a world of its own chemistry, the metal its ores and its hardener make: Phase 54.)
    w = chem.solar
      ? { name: metal, stuff: METALS[metal as Metal] }
      : metalOf(chem, metal as Metal, {
          arsenical: metal === "bronze" && tinArsenical(world, cell),
        });
  const works = workshopOf(world, t?.ref ?? null, ["factory"], year),
    smithy = works ?? workshopOf(world, t?.ref ?? null, ["smithy", "workshop"], year),
    trade = works ? "hand at the works" : "smith",
    maker =
      seat === undefined
        ? makerOf(world, cell, t, trade, key, year)
        : makerAt(world, cell, t, trade, seat, year),
    quality = qualityOf(w.stuff, craft + (works ? 0.3 : 0), maker.years);
  chain.push([
    sentence(works ? w.stuff.works : w.stuff.hand),
    " at ",
    smithy ? link(smithy.name, smithy.ref) : `${smithAt(world)}${t ? ` in ${t.name}` : ""}`,
    " by ",
    ...makerWords(world, maker, works ? "machines" : "anvil"),
  ]);
  return {
    stuff: w.name,
    edge: w.stuff,
    colour: w.stuff.colour,
    quality,
    grade: gradeOf(quality),
    maker,
    workshop: smithy ?? { name: `${smithAt(world)}${t ? ` in ${t.name}` : ""}`, ref: null },
    chain,
  };
}

// —— A town's stuff, as its scene draws it ——————————————————————————————————————————————

/** A substance's colour (grey for one not known). */
function substColour(id: string): Rgb {
  return findSubstance(id)?.colour ?? [0.5, 0.5, 0.5];
}

/** Where a land's metal of a kind comes from, in a few words: its own ore, a neighbour's, the road's. */
function metalFrom(world: World, cell: number, kind: "copper" | "iron" | "tin"): string {
  const chem = worldChemistry(homePlanet(world).generated),
    { roads, smelted } = whence(world, cell, kind),
    o = smelted === cell ? oreOf(world, cell, kind) : null,
    // (Native iron is forged from its lump at a red heat, not smelted.)
    cold = o?.lie === "telluric" ? ", forged from the lump" : "";
  if (o)
    return o.cell === cell
      ? `${o.ore.name} of its own ground${cold}`
      : `${o.ore.name} dug a few days' walk off${cold}`;
  return roads.length > 1
    ? `${roleWord(chem, kind)} brought down the road from ${landTitle(world, roads[1]!)}`
    : `${roleWord(chem, kind)} bought in the market`;
}

/** Where a town's iron is from, said: smelted to a bloom, or (native iron) forged from the lump. */
function ironFrom(world: World, cell: number, wood: string): string {
  const from = metalFrom(world, cell, "iron");
  return from.endsWith(", forged from the lump")
    ? `${from} in a hearth of charcoal of ${wood}`
    : `${from}, smelted to a bloom with charcoal of ${wood}`;
}

/**
 * The ore of its own ground a town's land smelts (Phase 52 M216): of the metals its smelters can
 * win from its own land's ore, the one they smelted most last year (the first, where they smelted
 * none); null where its own ground gives none it can smelt.
 */
function smeltedOre(world: World, cell: number, wood: string): TownStuff["ore"] {
  const chem = worldChemistry(homePlanet(world).generated),
    ctx = populationContext(world),
    m = marketsOf(world).get(cell);
  let best: { kind: string; ore: Ore; made: number } | null = null;
  for (const row of SMELTS) {
    const o = smeltable(ctx, cell, row.good);
    if (!o || o.cell !== cell || o.lie === "seam") continue;
    // (The ore the chain traces for it: its world's own, or the arsenical copper ore.)
    const ore = oreOf(world, cell, row.ore)?.ore;
    if (!ore) continue;
    const made = m?.book("made", row.good) ?? 0;
    if (!best || made > best.made) best = { kind: row.ore, ore, made };
  }
  return best
    ? {
        name: best.ore.name,
        colour: substColour(best.ore.mineral),
        fuel: `charcoal of ${wood}`,
        yields: roleWord(chem, best.kind),
      }
    : null;
}

/**
 * A smith's metal as a town's scene draws it: its name and colour, and on a world of its own
 * chemistry (Phase 54) what it is made of and what its smiths take from the yard to melt.
 */
function smithsOf(
  chem: Chemistry,
  metal: Metal,
  arsenical: boolean,
): NonNullable<TownStuff["metal"]> {
  const w = chem.solar
      ? { name: metal, stuff: METALS[metal] }
      : metalOf(chem, metal, { arsenical }),
    head = { name: w.name, colour: w.stuff.colour };
  if (chem.solar) return head;
  if (metal === "bronze") {
    const a = alloyOf(chem, arsenical);
    return { ...head, of: a.of, from: a.from };
  }
  if (chem.redox !== "reduced") return head;
  if (metal === "copper") return { ...head, of: "native copper melted and poured" };
  if (metal === "iron" || metal === "steel")
    return {
      ...head,
      of:
        chem.carbon === "carbon-rich"
          ? "black ore and charcoal, its bloom rich in carbon"
          : "black ore and charcoal in a bloomery",
    };
  return head;
}

/**
 * What a town's things are made of this year, as its scene draws them (Phase 51 M213): its tools'
 * heads, of its land's own stone or the metal it works, and how that came to it; the metal its
 * smiths work; and the copper ore of its own ground, which its works dig and smelt by the
 * diggings, burning charcoal of its land's wood.
 */
export function townStuff(world: World, cell: number, year: number): TownStuff {
  const chem = worldChemistry(homePlanet(world).generated),
    ctx = populationContext(world),
    metal = toolMetal(ctx, cell, year),
    // (What its smiths forge: its tools may still be mostly stone — Phase 52 M217.)
    forged = forgedMetal(ctx, cell, year),
    arsenical = tinArsenical(world, cell),
    smiths = forged === "stone" ? null : smithsOf(chem, forged as Metal, arsenical),
    wood = landWood(world, cell),
    ore = smeltedOre(world, cell, wood);
  const clay = landClay(world, cell),
    cloth = landCloth(world, cell),
    made = {
      clay: { name: clay.name, ware: clay.ware, raw: clay.raw, fired: clay.fired },
      // (Its colour as its world's life gives it, and dyed: Phase 57.)
      cloth: { name: cloth.name, colour: clothLife(world, cell, cloth).colour },
      wood,
    };
  if (metal === "stone") {
    const { stone } = landStone(world, cell);
    return {
      tool: { name: stone.name, colour: stone.colour, of: `${stone.from}, knapped to an edge` },
      metal: smiths,
      ore,
      ...made,
    };
  }
  const w = chem.solar
      ? { name: metal, stuff: METALS[metal as Metal] }
      : metalOf(chem, metal as Metal, { arsenical }),
    of =
      metal === "iron" || metal === "steel"
        ? ironFrom(world, cell, wood)
        : metal === "bronze"
          ? `${metalFrom(world, cell, "copper")} with ${alloyOf(chem, arsenical).with} (${metalFrom(world, cell, "tin")})`
          : `${metalFrom(world, cell, "copper")}, smelted with charcoal`;
  return {
    tool: { name: w.name, colour: w.stuff.colour, of: `${of}; ${w.stuff.hand}` },
    metal: smiths,
    ore,
    ...made,
  };
}

/**
 * A casting poured at the foundry by a town's works on a day (Phase 51 M215): the iron of its land's
 * ore (else a neighbour's, else the market's), smelted to pig iron with coke in the blast furnace,
 * remelted in the cupola and poured into a sand mould by the founder of that seat.
 */
export function castMade(
  world: World,
  cell: number,
  key: string,
  year: number,
  town: string,
  seat: number,
): Made {
  const ctx = populationContext(world),
    t = ctx.settlements.get(town as Ref) ?? makingTown(world, cell),
    works = workshopOf(world, t?.ref ?? null, ["factory"], year),
    maker = makerAt(world, cell, t, "founder", seat, year),
    o = oreOf(world, cell, "iron"),
    m = METALS.iron,
    quality = qualityOf(m, craftAt(world, cell, "tools") + 0.3, maker.years),
    at = works ? [link(works.name, works.ref)] : [`the works${t ? ` of ${t.name}` : ""}`];
  return {
    stuff: "cast iron",
    edge: m,
    colour: [0.3, 0.3, 0.32],
    quality,
    grade: gradeOf(quality),
    maker,
    workshop: works ?? { name: `the works${t ? ` of ${t.name}` : ""}`, ref: null },
    chain: [
      ...(o
        ? [
            oreLine(
              world,
              o.ore,
              o.cell,
              o.deposit,
              o.cell !== cell ? "a few days' walk off" : null,
            ),
            [
              link("Smelted", rxnRef(o.ore.smelt)),
              " to pig iron in a blast furnace, burning coke for charcoal",
            ] as Line,
          ]
        : [["Pig iron bought in the market of ", landLink(world, cell)] as Line]),
      [
        "Remelted in the cupola at ",
        ...at,
        " with coke and limestone, and poured into a sand mould by ",
        ...makerWords(world, maker, "cupola"),
      ],
    ],
  };
}

/**
 * A part finished at a town's works' machines on a day (Phase 51 M215): steel of its land's iron ore
 * (else the market's), the pig iron blown to steel in the converter, turned or pressed at the works
 * by the machinist of that seat.
 */
export function machinedMade(
  world: World,
  cell: number,
  key: string,
  year: number,
  town: string,
  seat: number,
): Made {
  const ctx = populationContext(world),
    t = ctx.settlements.get(town as Ref) ?? makingTown(world, cell),
    works = workshopOf(world, t?.ref ?? null, ["factory"], year),
    maker = makerAt(world, cell, t, "machinist", seat, year),
    o = oreOf(world, cell, "iron"),
    m = METALS.steel,
    quality = qualityOf(m, craftAt(world, cell, "tools") + 0.5, maker.years),
    at = works ? [link(works.name, works.ref)] : [`the works${t ? ` of ${t.name}` : ""}`];
  return {
    stuff: "steel",
    edge: m,
    colour: m.colour,
    quality,
    grade: gradeOf(quality),
    maker,
    workshop: works ?? { name: `the works${t ? ` of ${t.name}` : ""}`, ref: null },
    chain: [
      ...(o
        ? [
            oreLine(
              world,
              o.ore,
              o.cell,
              o.deposit,
              o.cell !== cell ? "a few days' walk off" : null,
            ),
            [
              link("Smelted", rxnRef(o.ore.smelt)),
              " to pig iron in a blast furnace, burning coke for charcoal",
            ] as Line,
          ]
        : [["Pig iron bought in the market of ", landLink(world, cell)] as Line]),
      [
        link("Blown to steel", rxnRef("carburise")),
        " in the converter, the air driven through the molten iron burning its carbon down",
      ],
      [
        "Turned and pressed at the machines of ",
        ...at,
        " by ",
        ...makerWords(world, maker, "machines"),
      ],
    ],
  };
}

/**
 * A machined part of a realm's host (Phase 53): its steel turned and cut at the works its machines
 * came from — a member land's own works, else the works at the far end of the road the machines came
 * down (else the seat's). For an arm, its barrel and bolt, its cartridge and charge; for an armoured
 * car, its rolled hull and the oil its engine burns. Null where nothing is machined for the realm.
 * `who`: the one who bore it (a man's page, Phase 55 M228), turned at the works by a hand of its
 * own (absent: the realm's).
 */
export function machinedArmsMade(
  world: World,
  realm: string,
  part: Part,
  year: number,
  who?: string,
): Made | null {
  const ctx = populationContext(world),
    p = politiesOf(world).get(realm as Ref);
  if (!p) return null;
  const markets = marketsOf(world),
    lands = [...p.members].sort((a, b) => a - b),
    // (Its machines are a member land's works, named by the event that made them; else they came
    // down a road, the flow that brought them in.)
    source = machinedFor(ctx, p),
    own = source ? lands.find((c) => markets.get(c)?.works === source) : undefined,
    flow =
      source && own === undefined
        ? markets.flows.find((f) => f.good === G.machines && lands.includes(f.to))
        : undefined,
    base = own ?? flow?.from ?? p.seat,
    t = makingTown(world, base),
    // (One man's: turned at a machine a hand of its own kept.)
    made = machinedMade(
      world,
      base,
      who === undefined ? `${realm}:${part.role}` : `${realm}:${part.role}:${who}`,
      year,
      t?.ref ?? "",
      who === undefined ? 0 : Math.floor(keyed(`${realm}:${part.role}:${who}:seat`) * seatsOf(t)),
    ),
    works: Span = made.workshop.ref
      ? link(made.workshop.name, made.workshop.ref)
      : made.workshop.name,
    chain: Line[] = [...made.chain],
    gun = firearm(part.id);
  if (gun && machined(gun)) {
    const tolerance = gun.tolerance === 0.05 ? "a twentieth" : "a fiftieth";
    chain.push([
      "Its barrel bored and rifled, its bolt cut true to ",
      tolerance,
      " of a millimetre at the machines of ",
      works,
    ]);
    if (gun.cartridge !== "paper")
      chain.push([
        link("Cartridges of drawn brass", rxnRef("alloy-brass")),
        ": copper with three tenths of ",
        link("zinc", rxnRef("smelt-zinc")),
        " smelted from zinc blende",
        ...(gun.cartridge === "belted brass" ? [", fed in belts of a hundred"] : []),
      ]);
    chain.push(
      gun.powder === "black"
        ? [
            "Charged with ",
            link("black powder", rxnRef("mix-black-powder")),
            ": saltpetre, charcoal and sulphur",
          ]
        : [
            "Charged with ",
            link("gun cotton", rxnRef("nitrate-cellulose")),
            ", the smokeless powder: cotton steeped in ",
            link("nitric acid", rxnRef("draw-nitric-acid")),
            " drawn from saltpetre",
          ],
    );
  }
  if (part.id === "armoured") {
    // (The oil drawn in a member land's well, else brought down a road, else kept in store.)
    const oil = fuelFor(ctx, p),
      well = oil ? lands.find((c) => markets.get(c)?.well === oil) : undefined,
      where: Line =
        well !== undefined
          ? [" drawn in ", landLink(world, well)]
          : oil && !lands.some((c) => ctx.provinces.get(c)?.ref === oil)
            ? [" brought down the road"]
            : [];
    chain.push(
      ["Its hull of rolled steel plate, riveted at ", works],
      ["Driven by an engine ", link("burning oil", rxnRef("burn-oil")), ...where],
      ["Its machine guns turned behind armour"],
    );
  }
  if (source && own === undefined && flow)
    chain.push([
      "Bought from the works of ",
      landLink(world, flow.from),
      ", ",
      link("brought down the road", source),
    ]);
  return { ...made, stuff: "machined steel", chain };
}

/**
 * A pot: the clay of its land's banks, thrown and fired at its town's kiln (or at home). `at`: made
 * by the potter of that seat at the town's kiln, and (`drying`) set on the boards by it today to
 * dry before its firing — a pot tapped there (Phase 51 M214).
 */
export function potMade(
  world: World,
  cell: number,
  key: string,
  year: number,
  home: boolean,
  town?: string | null,
  at?: { readonly seat: number; readonly drying?: boolean },
): Made {
  const ctx = populationContext(world),
    t = town
      ? (ctx.settlements.get(town as Ref) ?? makingTown(world, cell))
      : makingTown(world, cell),
    kiln = home
      ? null
      : workshopOf(world, t?.ref ?? null, at ? ["kiln"] : ["factory", "kiln"], year),
    trade = kiln?.name.startsWith("the factory") ? "hand at the works" : "potter",
    maker = home
      ? null
      : at
        ? makerAt(world, cell, t, trade, at.seat, year)
        : makerOf(world, cell, t, trade, key, year),
    clay = landClay(world, cell),
    water = ctx.generated.water.river[cell] ? "the river's banks" : "the lake's shore",
    edge: Edge = { keen: 0.25, tough: 0.45 },
    quality = qualityOf(edge, craftAt(world, cell, "pottery"), maker?.years ?? 6),
    fired = link("fired", rxnRef("fire-clay")),
    // (Where nothing burns no clay is fired: a vessel of its kind's own, and how: Phase 56.)
    vessel = kindVessel(world);
  if (vessel)
    return {
      stuff: vessel.ware,
      edge,
      colour: vessel.colour,
      quality,
      grade: gradeOf(quality),
      maker,
      workshop: { name: home ? "home" : `${vessel.yard}${t ? ` in ${t.name}` : ""}`, ref: null },
      chain: [
        [
          link(sentence(vessel.of), substRef(vessel.subst)),
          `, ${vessel.from} in `,
          landLink(world, cell),
        ],
        [
          vessel.how,
          ...(maker ? [" by ", ...makerWords(world, maker, vessel.bench)] : [" at home"]),
        ],
      ],
    };
  return {
    stuff: clay.ware,
    edge,
    colour: clay.fired,
    quality,
    grade: gradeOf(quality),
    maker,
    workshop: kiln ?? {
      name: home ? "home" : `a potter's yard${t ? ` in ${t.name}` : ""}`,
      ref: null,
    },
    chain: [
      [
        link(sentence(clay.name), substRef("kaolinite")),
        ` dug from ${water} in `,
        landLink(world, cell),
        `, its soil ${clay.soil}`,
      ],
      at?.drying && maker
        ? [
            "Thrown on the wheel by ",
            ...makerWords(world, maker, "wheel"),
            ", and set on the boards to dry before it is ",
            fired,
            ...(kiln ? [" at ", link(kiln.name, kiln.ref)] : []),
            ` in a fire of ${landWood(world, cell)}`,
          ]
        : [
            "Thrown and ",
            fired,
            kiln ? " at " : home ? " at home" : " in a pit of embers",
            ...(kiln ? [link(kiln.name, kiln.ref)] : []),
            ...(maker ? [" by ", ...makerWords(world, maker, "wheel")] : []),
          ],
    ],
  };
}

/**
 * A garment: woven of its land's own fibre (its flocks', else its plants'), or sewn of its hides
 * tanned, by its weavers or tanners. `at`: woven by the weaver of that seat at the town's workshop,
 * and (`loom`) on the loom there today — the cloth tapped on it (Phase 51 M214).
 */
export function clothMade(
  world: World,
  cell: number,
  key: string,
  year: number,
  leather: boolean,
  home: boolean,
  town?: string | null,
  at?: { readonly seat: number; readonly loom?: boolean },
): Made {
  const ctx = populationContext(world),
    t = town
      ? (ctx.settlements.get(town as Ref) ?? makingTown(world, cell))
      : makingTown(world, cell),
    shop = home
      ? null
      : workshopOf(world, t?.ref ?? null, at ? ["workshop"] : ["factory", "workshop"], year),
    works = !!shop?.name.startsWith("the factory"),
    trade = works ? "hand at the works" : leather ? "tanner" : "weaver",
    maker = home
      ? null
      : at
        ? makerAt(world, cell, t, trade, at.seat, year)
        : makerOf(world, cell, t, trade, key, year),
    cloth = landCloth(world, cell),
    // (Its fibre and its dye, as its world's life makes them: Phase 57.)
    life = clothLife(world, cell, cloth),
    edge: Edge = leather ? { keen: 0.2, tough: 0.8 } : { keen: 0.35, tough: 0.55 },
    quality = qualityOf(edge, craftAt(world, cell, "clothing"), maker?.years ?? 6),
    where: Span[] = shop ? [" at ", link(shop.name, shop.ref)] : home ? [" at home"] : [];
  return {
    stuff: leather ? "leather" : cloth.name,
    edge,
    colour: leather ? [0.45, 0.3, 0.18] : life.colour,
    quality,
    grade: gradeOf(quality),
    maker,
    workshop: shop ?? {
      name: home
        ? "home"
        : `a ${leather ? "tanner's" : "weaver's"} house${t ? ` in ${t.name}` : ""}`,
      ref: null,
    },
    chain: leather
      ? [
          ["Hides of the herds and the hunt of ", landLink(world, cell)],
          [
            link("Tanned", rxnRef("tan")),
            " in pits of bark, then cut and sewn",
            ...where,
            ...(maker ? [" by ", ...makerWords(world, maker, "tanning pits")] : []),
          ],
        ]
      : [
          cloth.from,
          ...life.lines,
          [
            works
              ? "Spun and woven on the works' machines"
              : at?.loom
                ? "Spun on the spindle, and woven today on the loom"
                : "Spun and woven on the loom",
            ...where,
            ...(maker ? [" by ", ...makerWords(world, maker, works ? "machines" : "loom")] : []),
          ],
        ],
  };
}

/** A thing of a stuff in words: "a terracotta pot", "a woollen tunic" (a garment by its cloth). */
function madeWords(stuff: string, form: string): string {
  const kind = stuff.endsWith(" cloth") ? stuff.slice(0, -" cloth".length) : stuff;
  return `${article(kind)} ${kind} ${form}`;
}

// —— A realm's arms ——————————————————————————————————————————————————————————————————

/** A part of a realm's host in words with its land's own stone ("obsidian-tipped spears"). */
export function armsWords(words: string, stone: string): string {
  return words.replace(/^stone-tipped/, `${stone}-tipped`);
}

/**
 * Bronze in words as its world makes it (Phase 54): "cupronickel", "arsenical copper". The Sun's
 * bronze is its own word.
 */
function bronzeWords(chem: Chemistry, words: string): string {
  return chem.solar ? words : words.replace(/\bbronze\b/g, metalOf(chem, "bronze").name);
}

/**
 * A realm's host in words, its stone points of its seat's own land's stone: "obsidian-tipped
 * spears and hide shields, on foot".
 */
export function hostWords(world: World, realm: string, parts: readonly Part[]): string {
  const chem = worldChemistry(homePlanet(world).generated),
    words = bronzeWords(chem, designWords(parts)),
    p = politiesOf(world).get(realm as Ref);
  return p && parts.some((x) => x.material === "stone")
    ? armsWords(words, landStone(world, p.seat).stone.name)
    : words;
}

/** One part of a realm's host in words, of its own land's stone: "obsidian-tipped spears". */
export function hostPartWords(world: World, realm: string, part: Part): string {
  const chem = worldChemistry(homePlanet(world).generated),
    words = bronzeWords(chem, partWords(part)),
    p = politiesOf(world).get(realm as Ref);
  return p && part.material === "stone"
    ? armsWords(words, landStone(world, p.seat).stone.name)
    : words;
}

/**
 * What one of a realm's host's parts is made of and where from (by the design's own rule, Phase 52
 * M216: the metals its seat holds — its own ore within reach, else down the roads), worked at its
 * seat town's smithy; a machined part (Phase 53) at the works its machines came from; null for a
 * part of no worked stuff (a body's own, on foot). `who`: the one who bore it (a man's page, Phase
 * 55 M228), made at one of its seat's benches as he would have had it, by its maker then (absent:
 * the realm's, as its host's page tells it).
 */
export function armsMade(
  world: World,
  realm: string,
  part: Part,
  year: number,
  who?: string,
): Made | null {
  const ctx = populationContext(world),
    p = politiesOf(world).get(realm as Ref);
  if (!p) return null;
  const chem = worldChemistry(homePlanet(world).generated),
    seat = p.seat,
    t = makingTown(world, seat),
    craft = craftAt(world, seat, "tools"),
    // (One man's: the seat a maker of his own held.)
    key = who === undefined ? `${realm}:${part.role}` : `${realm}:${part.role}:${who}`;
  if (part.material === "stone") {
    const { stone } = landStone(world, seat),
      maker = makerOf(world, seat, t, "knapper", key, year),
      quality = qualityOf(stone, craft, maker.years);
    return {
      stuff: stone.name,
      edge: stone,
      colour: stone.colour,
      quality,
      grade: gradeOf(quality),
      maker,
      workshop: { name: "the knappers' ground", ref: null },
      chain: [
        [
          link(sentence(stone.name), stone.subst ? substRef(stone.subst) : null),
          ` — ${stone.from} — of `,
          landLink(world, seat),
        ],
        [
          `Knapped to points and bound to shafts of ${landWood(world, seat)} by `,
          ...makerWords(world, maker, "knapping stone"),
        ],
      ],
    };
  }
  if (part.material === "machined") return machinedArmsMade(world, realm, part, year, who);
  if (!(part.material in METALS)) return null;
  // Each metal it is worked from, as its seat's smiths have it: their land's ore within reach,
  // else down the roads from the land that smelted it.
  const metal = part.material as Metal,
    chain = metalChain(world, seat, metal),
    // Bog iron, where the seat's own smelters won its iron from bog ore (native iron, where its lie
    // is telluric).
    iron =
      metal === "iron" && whence(world, seat, "iron").smelted === seat
        ? oreOf(world, seat, "iron")
        : null,
    w = metalOf(chem, metal, {
      lie: iron?.lie ?? null,
      arsenical: metal === "bronze" && tinArsenical(world, seat),
    }),
    works = workshopOf(world, t?.ref ?? null, ["factory"], year),
    smithy = works ?? workshopOf(world, t?.ref ?? null, ["smithy", "workshop"], year),
    maker = makerOf(world, seat, t, works ? "hand at the works" : "smith", key, year),
    quality = qualityOf(w.stuff, craft + (works ? 0.3 : 0), maker.years);
  chain.push([
    sentence(works ? w.stuff.works : w.stuff.hand),
    " at ",
    smithy ? link(smithy.name, smithy.ref) : `${smithAt(world)}${t ? ` in ${t.name}` : ""}`,
    " by ",
    ...makerWords(world, maker, works ? "machines" : "anvil"),
  ]);
  return {
    stuff: w.name,
    edge: w.stuff,
    colour: w.stuff.colour,
    quality,
    grade: gradeOf(quality),
    maker,
    workshop: smithy ?? { name: `${smithAt(world)}${t ? ` in ${t.name}` : ""}`, ref: null },
    chain,
  };
}

// —— A workshop's page ————————————————————————————————————————————————————————————————

/** Who works at each kind of a town's buildings, at what, and what it makes. */
const WORKED_AT: Readonly<
  Record<string, { trade: string; bench: string; good: number | null; noun: string }>
> = {
  smithy: { trade: "smith", bench: "anvil", good: G.tools, noun: "tools" },
  kiln: { trade: "potter", bench: "wheel", good: G.pottery, noun: "pots" },
  workshop: { trade: "weaver", bench: "loom", good: G.clothing, noun: "garments" },
  factory: { trade: "hand at the works", bench: "machines", good: G.machines, noun: "machines" },
  mill: { trade: "miller", bench: "millstones", good: null, noun: "" },
};

/**
 * Why a smithy forged no tools this year: its land has no ore within reach and none came down the
 * road, or it has ore it has not yet smelted — or what metal comes to it goes to its realm's host;
 * its tools still knapped from its own stone.
 */
function unforged(world: World, cell: number, arming: boolean): Line {
  const ctx = populationContext(world),
    { stone } = landStone(world, cell),
    ore = oreWorkable(ctx, cell, "copper") !== null || oreWorkable(ctx, cell, "iron") !== null,
    // Metal ore within reach that the land's furnace is too cool to work (Phase 54 M222).
    short = ore ? null : (heatShortfall(ctx, cell, "copper") ?? heatShortfall(ctx, cell, "iron")),
    knapped = [
      "knapped from its own ",
      link(stone.name, stone.subst ? substRef(stone.subst) : null),
    ] as Span[];
  return arming
    ? [
        "The tools of ",
        landLink(world, cell),
        " are still ",
        ...knapped,
        ": what metal comes to the smithy goes to its realm's host.",
      ]
    : [
        ...(ore
          ? [
              "Nothing was forged here this year: ",
              landLink(world, cell),
              " has ore within reach but has not yet smelted it.",
            ]
          : short
            ? [
                "Nothing was forged here this year: the ",
                short.ore.name,
                " within reach of ",
                landLink(world, cell),
                ` wants ${short.wanted} °C, and its ${short.furnace.name.replace(/^an? /, "")} reaches only ${short.reached} °C${
                  // (Thin air's want, which a blast driven by a mill's wheel makes up.)
                  short.reached < short.furnace.heat && short.wanted <= short.furnace.heat
                    ? " in its thin air: a blast driven by a mill's wheel would reach it"
                    : ""
                }.`,
              ]
            : [
                "Nothing was forged here this year: no copper or iron ore lies within reach of ",
                landLink(world, cell),
                ", and none came down the road.",
              ]),
        " Its tools are still ",
        ...knapped,
        ".",
      ];
}

/**
 * The arms made at a town's building this year for a realm's host: forged for each realm seated in
 * its land whose host's metal parts are made there, and machined at its works for each realm whose
 * machines come from them, seated wherever it is (Phase 53); each part traced from the ground.
 */
function armsForged(
  world: World,
  town: { readonly ref: string; readonly cell: number },
  building: string,
  year: number,
): Block[] {
  const blocks: Block[] = [],
    ctx = populationContext(world),
    works = marketsOf(world).get(town.cell)?.works ?? null;
  for (const p of politiesOf(world).all()) {
    if (p.ended !== null) continue;
    const seated = makingTown(world, p.seat)?.ref === town.ref,
      machinedHere = works !== null && machinedFor(ctx, p) === works;
    if (!seated && !machinedHere) continue;
    for (const part of designsOf(world).of(p.ref)?.parts ?? []) {
      const machined = part.material === "machined",
        made = (machined ? machinedHere : seated && part.material in METALS)
          ? armsMade(world, p.ref, part, year)
          : null;
      if (made?.workshop.ref !== building) continue;
      blocks.push({
        type: "list",
        // (A mount's words read "with armoured cars": as a thing made, the cars.)
        title: `${machined ? "Made at the works" : "Forged here"} this year for a realm's host: ${hostPartWords(world, p.ref, part).replace(/^with /, "")}, ${made.grade}`,
        items: [
          item(["For the host of ", realmLink(world, p.ref)]),
          ...made.chain.map((l) => item(l)),
        ],
      });
    }
  }
  return blocks;
}

/**
 * What a town's workshop does (Phase 50 M212): who works there now (each of its seats, named, so
 * many years at it), the market what they make goes to, and a thing made there this year traced
 * from the ground (or, at a smithy whose land has no metal yet, why nothing was forged). Empty for
 * a building that makes nothing.
 */
export function workshopBlocks(
  world: World,
  town: {
    readonly ref: string;
    readonly name: string;
    readonly cell: number;
    readonly population: number;
  },
  kind: string,
  building: string,
  year: number,
): Block[] {
  const w = WORKED_AT[kind];
  if (!w) return [];
  const seats = seatsOf(town),
    makers = Array.from({ length: seats }, (_, i) =>
      makerAt(world, town.cell, town, w.trade, i, year),
    ),
    blocks: Block[] = [
      {
        type: "list",
        title: "Who works here",
        items: makers.map((m) => item(makerWords(world, m, w.bench))),
      },
    ];
  // (What they make goes to their land's market: its page tells what was made and used.)
  if (w.good !== null)
    blocks.push({
      type: "text",
      lines: [
        [
          `What they make goes to the market of `,
          landLink(world, town.cell),
          ": ",
          link(`its ${w.noun}`, marketGoodRef(town.cell, w.good)),
          ".",
        ],
      ],
    });
  // A thing made here this year, from the ground to the hand. (A smithy raised once its land knew
  // the craft, its land's tools still of stone: nothing forged there yet, and why.)
  const forge = kind === "smithy" || (kind === "factory" && w.good === G.machines),
    arms = armsForged(world, town, building, year),
    forged = forgedMetal(populationContext(world), town.cell, year);
  if (forge && forged === "stone") {
    blocks.push({ type: "text", lines: [unforged(world, town.cell, arms.length > 0)] }, ...arms);
    return blocks;
  }
  const key = `${building}:now`,
    now = forge
      ? toolMade(world, town.cell, key, year, false, town.ref, undefined, forged)
      : kind === "kiln"
        ? potMade(world, town.cell, key, year, false, town.ref)
        : kind === "workshop"
          ? clothMade(world, town.cell, key, year, false, false, town.ref)
          : null;
  if (now)
    blocks.push({
      type: "list",
      title: `Made here this year: ${madeWords(now.stuff, kind === "kiln" ? "pot" : kind === "workshop" ? "tunic" : "tool")}, ${now.grade}`,
      items: now.chain.map((l) => item(l)),
    });
  // (Bread at the mill on every world; rope at the weavers' where its life is not Earth's, of its
  // own fibre: Phase 57.)
  if (kind === "mill") blocks.push(millBlock(world, town.cell));
  if (kind === "workshop") {
    const cord =
        WOODS[populationContext(world).generated.climate.biome[town.cell] ?? -1]?.[1] ?? "grass",
      rope = ropeLines(world, cord);
    if (rope.length) blocks.push({ type: "text", title: "Their rope and cord", lines: rope });
  }
  blocks.push(...arms);
  return blocks;
}
