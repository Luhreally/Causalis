// The chain from the ground to a thing (Phase 50 M212, asked for 2026-10-25: "mean crafting as the
// backbone of the whole game ... every made thing, at every age, is made by someone from what's
// actually around them, so the land decides what a people can make ... Tapping a thing traces it:
// an iron sword leads to the bog ore of some land, the bloomery that smelted it, the smith who
// forged it, and its quality"). For a thing made in a land in a year — a tool of a trade, a pot, a
// garment, a realm's arms — what it was made of there and then; where that came from: dug from a
// deposit or a showing of the land's own, of a neighbour's a few days' walk off, or brought down
// the road from another land; how it was smelted and worked, by whom (named in the land's tongue,
// so many years at the work) and where (the town's smithy, kiln or works, its page); and how good
// it is. Told by the very rules the simulation chose its stuff by — the economy's ore within reach
// for a land's tools, the ores within two steps of a realm for its host — never read by the
// simulation, never kept.
import { finish, hashString, mix, type Ref, type World } from "../kernel/index.ts";
import {
  BIOME,
  cradleTongue,
  ironShowing,
  personName,
  surfaceCopper,
  surfaceOre,
  tongueName,
  tonguePersonName,
} from "../gen/index.ts";
import {
  G,
  METALS,
  ORES,
  STONES,
  SUBSTANCE,
  SUBSTANCES,
  article,
  civic,
  designWords,
  gradeOf,
  partWords,
  keenestRock,
  qualityOf,
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
  hostOre,
  landOre,
  loreOf,
  marketGoodRef,
  marketsOf,
  politiesOf,
  populationContext,
  toolMetal,
  townsOf,
  type ToolMetal,
} from "../sim/index.ts";
import type { Block, Line, Span, TownStuff } from "../bridge/index.ts";
import { bedrockOf } from "./inspect/ground.ts";
import { rxnRef, substRef } from "./inspect/matter.ts";
import { landLink, landTitle, realmLink, townLink } from "./inspect/names.ts";
import { item, link, sentence } from "./inspect/words.ts";

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

/** The least share of a land a rock must have for its people to go out to it for their stone. */
const SOUGHT = 0.04;

/**
 * The stone a land knaps: of its rocks (any that is a twenty-fifth of it or more, and the rock
 * under a spot of it if given), the one whose stone takes the keenest edge — they went far for
 * good stone. Its rock, and the stone.
 */
export function landStone(
  world: World,
  cell: number,
  under?: string,
): { readonly rock: string; readonly stone: Stone } {
  const rocks = [
      ...(under ? [under] : []),
      ...bedrockOf(world, cell).flatMap(([rock, k]) => (k >= SOUGHT ? [rock] : [])),
    ],
    rock = rocks.length ? keenestRock(rocks) : "limestone";
  return { rock, stone: STONES[rock] ?? STONES.limestone! };
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
const SMELTING: Readonly<Record<string, string>> = {
  "smelt-malachite": "Smelted",
  "roast-chalcopyrite": "Roasted and smelted",
  "smelt-cassiterite": "Smelted",
  bloomery: "Smelted to a bloom",
  "bog-bloomery": "Roasted, then smelted to a bloom",
};

/** An ore smelted, in words: the reaction (its page), where, with what. */
function smeltLine(world: World, ore: Ore, lie: OreLie, at: number): Line {
  return [
    link(SMELTING[ore.smelt] ?? "Smelted", rxnRef(ore.smelt)),
    ` in ${SMELTED[lie]}, with charcoal of ${landWood(world, at)}`,
  ];
}

/**
 * A metal's ore by the economy's reach (a land's own, else a neighbour's): its lie, place, lines.
 * (`near`: how a neighbour's is said, from the land whose ore it is.)
 */
function economyOre(
  world: World,
  cell: number,
  kind: string,
  near = "a few days' walk off",
): Line[] | null {
  const o = economyOreOf(world, cell, kind);
  if (!o) return null;
  return [
    oreLine(world, o.ore, o.cell, o.deposit, o.cell !== cell ? near : null),
    smeltLine(world, o.ore, o.lie, o.cell),
  ];
}

/** A metal's ore by the economy's reach: what it is, how it lies, whose land, its deposit. */
function economyOreOf(
  world: World,
  cell: number,
  kind: string,
): {
  readonly ore: Ore;
  readonly lie: OreLie;
  readonly cell: number;
  readonly deposit: string | null;
} | null {
  const ctx = populationContext(world),
    o = landOre(ctx, cell, kind);
  if (!o) return null;
  const deposit = o.ref.startsWith("depo") ? o.ref : null,
    lie: OreLie = deposit
      ? "deposit"
      : kind === "copper" && !surfaceCopper(ctx.generated, o.cell) && ctx.medium === "water"
        ? "vent"
        : "surface",
    ore = ORES[kind]?.[lie] ?? ORES[kind]?.deposit;
  return ore ? { ore, lie, cell: o.cell, deposit } : null;
}

/** Copper brought down the road (the land it came from most last year), and where that land dug it. */
function tradedCopper(world: World, cell: number): Line[] {
  const flows = marketsOf(world)
      .flows.filter((f) => f.to === cell && f.good === G.copper)
      .sort((a, b) => b.count - a.count || a.from - b.from),
    from = flows[0]?.from;
  if (from === undefined) return [["Copper bought in the market, from no road told"]];
  const there = economyOre(
    world,
    from,
    "copper",
    `a few days' walk from ${landTitle(world, from)}`,
  );
  return [
    ...(there ?? []),
    ["Brought down the road from ", landLink(world, from), " to ", landLink(world, cell)],
  ];
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
): Made {
  const metal: ToolMetal = toolMetal(populationContext(world), cell, year),
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
          "Knapped to an edge and hafted",
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
  const chain: Line[] = [];
  // The copper, its own land's or a neighbour's ore, else down the road.
  chain.push(...(economyOre(world, cell, "copper") ?? tradedCopper(world, cell)));
  if (metal === "bronze") {
    chain.push(...(economyOre(world, cell, "tin") ?? []));
    chain.push([
      link("Alloyed", rxnRef("alloy-bronze")),
      ": a tenth of tin melted into the copper",
    ]);
  }
  if (metal === "iron" || metal === "steel") {
    chain.splice(0, chain.length, ...(economyOre(world, cell, "iron") ?? []));
    if (metal === "steel")
      chain.push([link("Steeled", rxnRef("carburise")), ": the iron packed in charcoal and fired"]);
  }
  const works = workshopOf(world, t?.ref ?? null, ["factory"], year),
    smithy = works ?? workshopOf(world, t?.ref ?? null, ["smithy", "workshop"], year),
    trade = works ? "hand at the works" : "smith",
    maker =
      seat === undefined
        ? makerOf(world, cell, t, trade, key, year)
        : makerAt(world, cell, t, trade, seat, year),
    m = METALS[metal as Metal],
    quality = qualityOf(m, craft + (works ? 0.3 : 0), maker.years);
  chain.push([
    sentence(works ? m.works : m.hand),
    " at ",
    smithy ? link(smithy.name, smithy.ref) : `a smith's hearth${t ? ` in ${t.name}` : ""}`,
    " by ",
    ...makerWords(world, maker, works ? "machines" : "anvil"),
  ]);
  return {
    stuff: metal,
    edge: m,
    colour: m.colour,
    quality,
    grade: gradeOf(quality),
    maker,
    workshop: smithy ?? { name: `a smith's hearth${t ? ` in ${t.name}` : ""}`, ref: null },
    chain,
  };
}

// —— A town's stuff, as its scene draws it ——————————————————————————————————————————————

/** A substance's colour (grey for one not known). */
function substColour(id: string): Rgb {
  return SUBSTANCES[SUBSTANCE[id] ?? -1]?.colour ?? [0.5, 0.5, 0.5];
}

/** Where a land's metal of a kind comes from, in a few words: its own ore, a neighbour's, the road's. */
function metalFrom(world: World, cell: number, kind: "copper" | "iron" | "tin"): string {
  const o = economyOreOf(world, cell, kind);
  if (o)
    return o.cell === cell
      ? `${o.ore.name} of its own ground`
      : `${o.ore.name} dug a few days' walk off`;
  const from = marketsOf(world)
    .flows.filter((f) => f.to === cell && f.good === G.copper)
    .sort((a, b) => b.count - a.count || a.from - b.from)[0]?.from;
  return from === undefined
    ? `${kind} bought in the market`
    : `${kind} brought down the road from ${landTitle(world, from)}`;
}

/**
 * What a town's things are made of this year, as its scene draws them (Phase 51 M213): its tools'
 * heads, of its land's own stone or the metal it works, and how that came to it; the metal its
 * smiths work; and the copper ore of its own ground, which its works dig and smelt by the
 * diggings, burning charcoal of its land's wood.
 */
export function townStuff(world: World, cell: number, year: number): TownStuff {
  const metal = toolMetal(populationContext(world), cell, year),
    own = economyOreOf(world, cell, "copper"),
    wood = landWood(world, cell),
    ore =
      own && own.cell === cell
        ? { name: own.ore.name, colour: substColour(own.ore.mineral), fuel: `charcoal of ${wood}` }
        : null;
  if (metal === "stone") {
    const { stone } = landStone(world, cell);
    return {
      tool: { name: stone.name, colour: stone.colour, of: `${stone.from}, knapped to an edge` },
      metal: null,
      ore,
    };
  }
  const m = METALS[metal as Metal],
    of =
      metal === "iron" || metal === "steel"
        ? `${metalFrom(world, cell, "iron")}, smelted to a bloom with charcoal of ${wood}`
        : metal === "bronze"
          ? `${metalFrom(world, cell, "copper")} with a tenth of tin (${metalFrom(world, cell, "tin")})`
          : `${metalFrom(world, cell, "copper")}, smelted with charcoal`;
  return {
    tool: { name: metal, colour: m.colour, of: `${of}; ${m.hand}` },
    metal: { name: metal, colour: m.colour },
    ore,
  };
}

/** A pot: the clay of its land's banks, thrown and fired at its town's kiln (or at home). */
export function potMade(
  world: World,
  cell: number,
  key: string,
  year: number,
  home: boolean,
  town?: string | null,
): Made {
  const ctx = populationContext(world),
    t = town
      ? (ctx.settlements.get(town as Ref) ?? makingTown(world, cell))
      : makingTown(world, cell),
    kiln = home ? null : workshopOf(world, t?.ref ?? null, ["factory", "kiln"], year),
    maker = home
      ? null
      : makerOf(
          world,
          cell,
          t,
          kiln?.name.startsWith("the factory") ? "hand at the works" : "potter",
          key,
          year,
        ),
    water = ctx.generated.water.river[cell] ? "the river's banks" : "the lake's shore",
    edge: Edge = { keen: 0.25, tough: 0.45 },
    quality = qualityOf(edge, craftAt(world, cell, "pottery"), maker?.years ?? 6);
  return {
    stuff: "fired clay",
    edge,
    colour: [0.66, 0.4, 0.28],
    quality,
    grade: gradeOf(quality),
    maker,
    workshop: kiln ?? {
      name: home ? "home" : `a potter's yard${t ? ` in ${t.name}` : ""}`,
      ref: null,
    },
    chain: [
      [link("Clay", substRef("kaolinite")), ` dug from ${water} in `, landLink(world, cell)],
      [
        "Thrown and ",
        link("fired", rxnRef("fire-clay")),
        kiln ? " at " : home ? " at home" : " in a pit of embers",
        ...(kiln ? [link(kiln.name, kiln.ref)] : []),
        ...(maker ? [" by ", ...makerWords(world, maker, "wheel")] : []),
      ],
    ],
  };
}

/** A garment: woven of its land's flocks' wool, or sewn of its hides tanned, by its weavers or tanners. */
export function clothMade(
  world: World,
  cell: number,
  key: string,
  year: number,
  leather: boolean,
  home: boolean,
  town?: string | null,
): Made {
  const ctx = populationContext(world),
    t = town
      ? (ctx.settlements.get(town as Ref) ?? makingTown(world, cell))
      : makingTown(world, cell),
    shop = home ? null : workshopOf(world, t?.ref ?? null, ["factory", "workshop"], year),
    works = !!shop?.name.startsWith("the factory"),
    maker = home
      ? null
      : makerOf(
          world,
          cell,
          t,
          works ? "hand at the works" : leather ? "tanner" : "weaver",
          key,
          year,
        ),
    edge: Edge = leather ? { keen: 0.2, tough: 0.8 } : { keen: 0.35, tough: 0.55 },
    quality = qualityOf(edge, craftAt(world, cell, "clothing"), maker?.years ?? 6),
    at: Span[] = shop ? [" at ", link(shop.name, shop.ref)] : home ? [" at home"] : [];
  return {
    stuff: leather ? "leather" : "woven wool",
    edge,
    colour: leather ? [0.45, 0.3, 0.18] : [0.72, 0.68, 0.6],
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
            ...at,
            ...(maker ? [" by ", ...makerWords(world, maker, "tanning pits")] : []),
          ],
        ]
      : [
          ["Wool shorn from the flocks of ", landLink(world, cell)],
          [
            works ? "Spun and woven on the works' machines" : "Spun and woven on the loom",
            ...at,
            ...(maker ? [" by ", ...makerWords(world, maker, works ? "machines" : "loom")] : []),
          ],
        ],
  };
}

// —— A realm's arms ——————————————————————————————————————————————————————————————————

/** A part of a realm's host in words with its land's own stone ("obsidian-tipped spears"). */
export function armsWords(words: string, stone: string): string {
  return words.replace(/^stone-tipped/, `${stone}-tipped`);
}

/**
 * A realm's host in words, its stone points of its seat's own land's stone: "obsidian-tipped
 * spears and hide shields, on foot".
 */
export function hostWords(world: World, realm: string, parts: readonly Part[]): string {
  const words = designWords(parts),
    p = politiesOf(world).get(realm as Ref);
  return p && parts.some((x) => x.material === "stone")
    ? armsWords(words, landStone(world, p.seat).stone.name)
    : words;
}

/** One part of a realm's host in words, of its own land's stone: "obsidian-tipped spears". */
export function hostPartWords(world: World, realm: string, part: Part): string {
  const words = partWords(part),
    p = politiesOf(world).get(realm as Ref);
  return p && part.material === "stone"
    ? armsWords(words, landStone(world, p.seat).stone.name)
    : words;
}

/**
 * What one of a realm's host's parts is made of and where from (by the design's own rule: the
 * ores within two steps of its lands), worked at its seat town's smithy; null for a part of no
 * worked stuff (a body's own, on foot).
 */
export function armsMade(world: World, realm: string, part: Part, year: number): Made | null {
  const ctx = populationContext(world),
    p = politiesOf(world).get(realm as Ref);
  if (!p) return null;
  const seat = p.seat,
    t = makingTown(world, seat),
    craft = craftAt(world, seat, "tools"),
    key = `${realm}:${part.role}`;
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
  if (!(part.material in METALS)) return null;
  // (The design asks only that an ore show within two steps of the realm's lands: told, its own
  // lands' first, the lowest first, else the land the design's rule found.)
  const realmOre = (kind: string): number | null =>
      [...p.members].sort((a, b) => a - b).find((c) => surfaceOre(ctx.generated, c, kind)) ??
      hostOre(ctx, p, kind),
    metal = part.material as Metal,
    dug = (kind: string): Line[] => {
      const c = realmOre(kind);
      if (c === null) return [];
      const lie: OreLie = kind === "iron" ? (ironShowing(ctx.generated, c) ?? "hill") : "surface",
        ore = ORES[kind]?.[lie];
      if (!ore) return [];
      const theirs = p.members.includes(c);
      return [
        oreLine(world, ore, c, null, theirs ? null : "beyond its borders, traded for"),
        smeltLine(world, ore, lie, c),
      ];
    },
    // (Its ore within two steps of its lands now; else, its lands having changed since the host was
    // armed, where its lands' smiths get the metal: their own ore within reach, or the road's.)
    kept = (kind: string): Line[] => {
      const now = dug(kind);
      if (now.length) return now;
      for (const c of p.members) {
        const theirs = economyOre(world, c, kind);
        if (theirs) return theirs;
      }
      return kind === "copper" ? tradedCopper(world, seat) : [];
    },
    chain: Line[] = metal === "iron" || metal === "steel" ? kept("iron") : kept("copper");
  if (metal === "bronze") {
    chain.push(...kept("tin"));
    chain.push([
      link("Alloyed", rxnRef("alloy-bronze")),
      ": a tenth of tin melted into the copper",
    ]);
  }
  if (metal === "steel")
    chain.push([link("Steeled", rxnRef("carburise")), ": the iron packed in charcoal and fired"]);
  const lie = metal === "iron" ? ironShowing(ctx.generated, realmOre("iron") ?? -1) : null,
    stuff = lie === "bog" ? "bog iron" : metal,
    m = METALS[stuff as Metal | "bog iron"],
    works = workshopOf(world, t?.ref ?? null, ["factory"], year),
    smithy = works ?? workshopOf(world, t?.ref ?? null, ["smithy", "workshop"], year),
    maker = makerOf(world, seat, t, works ? "hand at the works" : "smith", key, year),
    quality = qualityOf(m, craft + (works ? 0.3 : 0), maker.years);
  chain.push([
    sentence(works ? m.works : m.hand),
    " at ",
    smithy ? link(smithy.name, smithy.ref) : `a smith's hearth${t ? ` in ${t.name}` : ""}`,
    " by ",
    ...makerWords(world, maker, works ? "machines" : "anvil"),
  ]);
  return {
    stuff,
    edge: m,
    colour: m.colour,
    quality,
    grade: gradeOf(quality),
    maker,
    workshop: smithy ?? { name: `a smith's hearth${t ? ` in ${t.name}` : ""}`, ref: null },
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
    ore = landOre(ctx, cell, "copper") !== null || landOre(ctx, cell, "iron") !== null,
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
 * The arms forged at a town's building this year for a realm's host: each realm seated in its
 * land whose host's metal parts are made there, each part traced from the ground.
 */
function armsForged(
  world: World,
  town: { readonly ref: string; readonly cell: number },
  building: string,
  year: number,
): Block[] {
  const blocks: Block[] = [];
  for (const p of politiesOf(world).all()) {
    if (p.ended !== null || makingTown(world, p.seat)?.ref !== town.ref) continue;
    for (const part of designsOf(world).of(p.ref)?.parts ?? []) {
      const made = part.material in METALS ? armsMade(world, p.ref, part, year) : null;
      if (made?.workshop.ref !== building) continue;
      blocks.push({
        type: "list",
        title: `Forged here this year for a realm's host: ${hostPartWords(world, p.ref, part)}, ${made.grade}`,
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
    arms = armsForged(world, town, building, year);
  if (forge && toolMetal(populationContext(world), town.cell, year) === "stone") {
    blocks.push({ type: "text", lines: [unforged(world, town.cell, arms.length > 0)] }, ...arms);
    return blocks;
  }
  const key = `${building}:now`,
    now = forge
      ? toolMade(world, town.cell, key, year, false, town.ref)
      : kind === "kiln"
        ? potMade(world, town.cell, key, year, false, town.ref)
        : kind === "workshop"
          ? clothMade(world, town.cell, key, year, false, false, town.ref)
          : null;
  if (now)
    blocks.push({
      type: "list",
      title: `Made here this year: ${article(now.stuff)} ${now.stuff} ${kind === "kiln" ? "pot" : kind === "workshop" ? "tunic" : "tool"}, ${now.grade}`,
      items: now.chain.map((l) => item(l)),
    });
  blocks.push(...arms);
  return blocks;
}
