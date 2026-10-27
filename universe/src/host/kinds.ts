// A world's kind, told (Phase 56): what it is and why — its liquid and the warmth it is liquid
// between, its bedrock, its air, what burns and why nothing does, its tools and walls, the life in
// its liquid; why a principle is shut on it; its ages' words; the vessels its people make where no
// clay is fired, and where its smiths work; its warmth in true degrees, where its climate is read
// in its liquid's; why no life took hold on it.
import type { World } from "../kernel/index.ts";
import { climateMean, worldKindOf, type HomeWorld, type Planet } from "../gen/index.ts";
import {
  KINDS,
  KIND_AGES,
  KIND_AIR,
  KIND_METAL_ROOTS,
  KIND_PRINCIPLE_NAMES,
  KIND_SEAS,
  NOVEL_KINDS,
  earthDegrees,
  findSubstance,
  kindAllows,
  kindBurns,
  kindBiomeName,
  kelvinPerDegree,
  principle,
  trueCelsius,
  type KindAge,
  type Ore,
  type Principle,
  type Recipe,
  type WorldKind,
} from "../rules/index.ts";
import { homePlanet } from "../sim/index.ts";
import type { Block, Line, Span } from "../bridge/index.ts";
import { item, link, sentence, stat } from "./inspect/words.ts";

type Rgb = readonly [number, number, number];

/** A world's kind (rocky for a world with no home planet: a toy world). */
export function kindOf(world: World): WorldKind {
  return world.storeNames().includes("planet.home")
    ? worldKindOf(homePlanet(world).generated)
    : "rocky";
}

/** A kind's own age for a land's age, where its kind has one (null: the age as Earth's is told). */
export function kindAge(world: World, era: string): KindAge | null {
  const kind = kindOf(world);
  return kind !== "rocky" && (era === "metal" || era === "industry" || era === "modern")
    ? KIND_AGES[kind][era]
    : null;
}

/** A generated world's kind (its frames say it: the globe's and a land's colours are its kind's). */
export function kindOn(g: { readonly planet: Planet }): WorldKind {
  return worldKindOf(g);
}

/** A spot's warmth, as its climate keeps it (degrees of its liquid's band), in true °C. */
export function spotWarmth(g: { readonly planet: Planet }, degrees: number): number {
  return trueCelsius(worldKindOf(g), degrees);
}

/** A spot's swing of warmth through its year, as its climate keeps it, in true degrees. */
export function spotSwing(g: { readonly planet: Planet }, degrees: number): number {
  return degrees * kelvinPerDegree(worldKindOf(g));
}

/** A biome's name where its world's seas are its liquid's ("ocean": "methane sea"). */
export function spotBiome(g: { readonly planet: Planet }, name: string): string {
  return kindBiomeName(worldKindOf(g), name);
}

/**
 * Why no life took hold on a home world, in a few words: its seas froze over or were too hot (read
 * in its liquid's degrees, told in true ones), or a kind's liquid never quickened. A rocky world's
 * words as they were.
 */
export function lifelessWhy(g: HomeWorld): string {
  const kind = worldKindOf(g),
    t = Math.round(g.planet.meanTemperature),
    at = Math.round(climateMean(g.planet)),
    seas = kind === "rocky" ? "seas" : `${KIND_SEAS[kind].sea}s`;
  if (at < -15) return `its ${seas} froze over before life took hold (${t} °C on average)`;
  if (at > 60) return `too hot for life to take hold in its ${seas} (${t} °C on average)`;
  return kind === "rocky" ? "no life took hold in its first seas" : KINDS[kind].life.barren;
}

/** A home world's kind, for the title's words of the world a seed makes (none for a rocky one). */
export function seedKind(g: HomeWorld): { kind?: string } {
  const kind = worldKindOf(g);
  return kind === "rocky" ? {} : { kind: `${KINDS[kind].icon} ${KINDS[kind].name}` };
}

/** A town's plan's kind, for its colours and its fires (none for a rocky world). */
export function planKind(world: World): { kind?: string; fireless?: true } {
  const kind = kindOf(world);
  if (kind === "rocky") return {};
  return kindBurns(kind) ? { kind } : { kind, fireless: true };
}

/** A warmth of its climate (degrees of its liquid's band) in true °C. */
export function realWarmth(world: World, degrees: number): number {
  return trueCelsius(kindOf(world), degrees);
}

/** How many true degrees one degree of its climate is (a season's swing, a spread). */
export function warmthScale(world: World): number {
  return kelvinPerDegree(kindOf(world));
}

/**
 * How a land's sky tells its warmth in true degrees, where its climate keeps them in its liquid's
 * (none where they are Earth's): true °C at its liquid's 0, and for each degree.
 */
export function skyDegrees(world: World): { degrees?: { at0: number; per: number } } {
  const kind = kindOf(world);
  return earthDegrees(kind)
    ? {}
    : { degrees: { at0: trueCelsius(kind, 0), per: kelvinPerDegree(kind) } };
}

/** A biome's name on this world: its seas its liquid's ("ocean": "methane sea"). */
export function biomeWords(world: World, name: string): string {
  return kindBiomeName(kindOf(world), name);
}

/** A warmth in words, with a true minus sign: "−182 °C". */
export function celsius(c: number): string {
  return `${signed(c)} °C`;
}

/** A number in words with a true minus sign: "−3". */
function signed(n: number): string {
  const r = Math.round(n);
  return `${r < 0 ? "−" : ""}${Math.abs(r)}`;
}

/** The warmth its liquid is liquid between, in words. */
function band(kind: WorldKind): string {
  const l = KINDS[kind].liquid;
  return `liquid from ${celsius(l.freezeK - 273.15)} to ${celsius(l.boilK - 273.15)} under its air`;
}

/** What a principle that wants fire would need, where nothing burns. */
function unfired(id: string): string {
  if (id === "metalworking")
    return "no furnace can be built, and no ore lies in its ice to work cold";
  if (id === "pottery-wheel") return "no kiln can be fired";
  if (id === "bronze" || id === "iron" || id === "steel" || id === "glass")
    return "no furnace can be built";
  if (
    id === "gunpowder" ||
    id === "firearms" ||
    id === "rifling" ||
    id === "repeating-fire" ||
    id === "self-loading" ||
    id === "automatic-fire" ||
    id === "armoured-vehicles"
  )
    return "no powder can burn";
  return "no engine that burns its fuel can be driven";
}

/**
 * Why a principle cannot be known on this world, as far as its world goes (null: it can): it is
 * another kind's, or it wants fire where nothing burns.
 */
export function shutWhy(world: World, p: Principle): string | null {
  const kind = kindOf(world);
  if (!kindAllows(p, kind)) {
    const on = NOVEL_KINDS.filter((k) => p.body?.kinds?.includes(k)).map((k) => KINDS[k].name);
    return `known only on ${on.join(" or ")}: what such a world does in place of what it cannot`;
  }
  // (The root of metal too, where its kind has no metal of its own to work: an ice world's.)
  const metalless =
    p.id === "metalworking" && !KIND_METAL_ROOTS.some((id) => kindAllows(principle(id), kind));
  if ((p.body?.fire || metalless) && !kindBurns(kind))
    return `nothing burns in its air, so ${unfired(p.id)}. ${KINDS[kind].fire}`;
  return null;
}

/** A principle's name as its world's kind names it ("steamships": "engine-driven ships"), or its own. */
export function kindName(world: World, p: Principle): string {
  const kind = kindOf(world);
  return kind === "rocky" ? p.name : (KIND_PRINCIPLE_NAMES[kind][p.id] ?? p.name);
}

/** What tells how an ore is worked where it is not smelted: its reaction, or the principle that teaches it. */
function workedRef(ore: Ore, worked: NonNullable<Ore["worked"]>): string {
  return worked.by ? `prin:${worked.by}` : `rxn:${ore.smelt}`;
}

/** An ore worked where it is not smelted, in a line: "Hammered cold, on an anvil stone, never heated: …". */
export function workedLine(ore: Ore, worked: NonNullable<Ore["worked"]>): Line {
  return [link(sentence(worked.how), workedRef(ore, worked)), `, ${worked.at}`];
}

/** How an ore is worked where it is not smelted, in words: "hammered cold, on an anvil stone, …". */
export function workedWords(ore: Ore, worked: NonNullable<Ore["worked"]>): Span[] {
  return [link(worked.how, workedRef(ore, worked)), `, ${worked.at}`];
}

/** The same, of metal bought where none can tell whose ore it was: ", hammered cold in a land none can tell". */
export function workedBought(ore: Ore, worked: NonNullable<Ore["worked"]>): Span[] {
  return [", ", link(worked.how, workedRef(ore, worked)), " in a land none can tell"];
}

/** The recipes a kind works its own way: a carbon world's copper is hammered cold, not smelted. */
const KIND_RECIPE_NAMES: Partial<Record<WorldKind, Readonly<Record<string, string>>>> = {
  carbon: { "copper-smelting": "native copper hammered cold" },
};

/** A recipe's name on this world: its kind's, where its kind works it its own way, or its own. */
export function recipeName(world: World, r: Recipe): string {
  return KIND_RECIPE_NAMES[kindOf(world)]?.[r.id] ?? r.name;
}

/** Where a smith works on this world: at a hearth, or (where nothing burns) cold at an anvil stone. */
export function smithAt(world: World): string {
  return kindBurns(kindOf(world)) ? "a smith's hearth" : "a smith's anvil stone";
}

/** A vessel of a kind's own, where no clay is fired: what it is, of what, how it is made. */
export type Vessel = {
  readonly ware: string;
  /** What it is made of (a substance and its page), and where that is had. */
  readonly of: string;
  readonly subst: string;
  readonly from: string;
  readonly how: string;
  /** What its maker is at, in words ("eleven years at the …"), and the yard they work in. */
  readonly bench: string;
  readonly yard: string;
  readonly colour: Rgb;
};

/** The vessels of a world where nothing burns (null where clay is fired). */
export function kindVessel(world: World): Vessel | null {
  const kind = kindOf(world);
  if (kind === "carbon")
    return {
      ware: "pitch-sealed basket",
      of: "pitch",
      subst: "bitumen",
      from: "gathered where the oil seeps from the ground",
      how: "Woven of reed and sealed inside and out with pitch, warmed in the sun until it runs",
      bench: "basket-weaving",
      yard: "a basket-weaver's yard",
      colour: [0.14, 0.11, 0.08],
    };
  if (kind === "ammonia")
    return {
      ware: "ice vessel",
      of: "ice",
      subst: "water-ice",
      from: "cut from the bedrock",
      how: "Cut from a block of ice and hollowed by wetting it with ammonia water, which melts ice as salt does",
      bench: "ice-cutting",
      yard: "an ice-cutter's yard",
      colour: [0.8, 0.88, 0.95],
    };
  if (kind === "methane")
    return {
      ware: "ice vessel",
      of: "ice",
      subst: "water-ice",
      from: "cut from the bedrock",
      how: "Cut from a block of ice and knapped hollow, the ice as brittle as glass at −180 °C",
      bench: "ice-cutting",
      yard: "an ice-cutter's yard",
      colour: [0.78, 0.8, 0.82],
    };
  return null;
}

/**
 * A world's kind told, for its pages (none for a rocky world): what makes it, its seas and the
 * warmth they are liquid between, its warmth, bedrock and air, what burns and why not, its tools
 * and walls, the life in its liquid; and what its air and seas are made of.
 */
export function kindBlocks(world: World): Block[] {
  const kind = kindOf(world);
  if (kind === "rocky") return [];
  const k = KINDS[kind],
    g = homePlanet(world).generated,
    mean = celsius(g.planet.meanTemperature),
    // (Read in its liquid's degrees as Earth's warmth is in water's, where the two are not one.)
    warmth = earthDegrees(kind)
      ? `${mean} on average`
      : `${mean} on average: ${signed(climateMean(g.planet))} on its liquid's scale (0 where it freezes, 100 where it boils under its air), as Earth's is 15 on water's`,
    life = g.life.species.length ? k.life.words : `${k.life.words}; but ${k.life.barren}`,
    air = KIND_AIR[kind].flatMap((id) => {
      const s = findSubstance(id);
      return s ? [item([link(sentence(s.name), `subst:${id}`)], `subst:${id}`)] : [];
    });
  return [
    {
      type: "facts",
      title: `${k.icon} ${sentence(k.name)}`,
      rows: [
        stat("What made it", sentence(k.why)),
        stat("Its seas", [
          link(sentence(k.liquid.name), `subst:${k.liquid.subst}`),
          `, ${band(kind)}`,
        ]),
        stat("Its warmth", warmth),
        stat("Its bedrock", sentence(k.bedrock)),
        stat("Its air", sentence(k.air)),
        stat("What burns", k.fire),
        stat("Its tools", sentence(k.tools)),
        stat("Its walls", sentence(k.walls)),
        stat("Life", sentence(life)),
      ],
    },
    { type: "list", title: "Its air and seas are made of", items: air },
  ];
}
