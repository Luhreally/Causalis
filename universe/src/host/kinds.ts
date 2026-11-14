// A world's kind, told (Phase 56): what it is and why — its liquid and the warmth it is liquid
// between, its bedrock, its air, what burns and why nothing does, its tools and walls, the life in
// its liquid; why a principle is shut on it; its ages' words; the vessels its people make where no
// clay is fired, and where its smiths work; its warmth in true degrees, where its climate is read
// in its liquid's; why no life took hold on it.
import type { World } from "../kernel/index.ts";
import {
  climateMean,
  functionsOf,
  meansNumbers,
  meansOfWorld,
  worldChemistry,
  worldKindOf,
  type HomeWorld,
  type Planet,
} from "../gen/index.ts";
import {
  KINDS,
  KIND_AGES,
  KIND_AIR,
  KIND_SEAS,
  OWN_ENGINES,
  affordsPrinciple,
  burnlessName,
  earthDegrees,
  meansName,
  findSubstance,
  hottest,
  kindBurns,
  kindBiomeName,
  kelvinPerDegree,
  matterShuts,
  oresOn,
  reachIn,
  trueCelsius,
  type KindAge,
  type Ore,
  type Principle,
  type Recipe,
  type WorldKind,
} from "../rules/index.ts";
import { homePlanet, loreOf, populationContext } from "../sim/index.ts";
import { principleName } from "../causal/index.ts";
import type { Block, Line, Span } from "../bridge/index.ts";
import { count, item, link, sentence, stat } from "./inspect/words.ts";

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
    // (A true minus sign, as everywhere else a temperature is told.)
    t = Math.round(g.planet.meanTemperature).toString().replace("-", "−"),
    at = Math.round(climateMean(g.planet)),
    seas = kind === "rocky" ? "seas" : `${KIND_SEAS[kind].sea}s`;
  if (at < -15) return `its ${seas} froze over before life took hold (${t} °C on average)`;
  // (Hot for its own liquid: a methane sea at −160 °C is near its boiling.)
  if (at > 60)
    return `its ${seas} ran too near their boiling for life to take hold (${t} °C on average)`;
  return kind === "rocky" ? "no life took hold in its first seas" : KINDS[kind].life.barren;
}

/** A home world's kind, for the title's words of the world a seed makes (none for a rocky one). */
export function seedKind(g: HomeWorld): { kind?: string } {
  const kind = worldKindOf(g);
  return kind === "rocky" ? {} : { kind: `${KINDS[kind].icon} ${KINDS[kind].name}` };
}

/**
 * A town's plan's kind, for its colours and its fires (none for a rocky world). Where nothing
 * burns, its hearths smoke only where its land has a heat of its own to work with (F2).
 */
export function planKind(world: World, cell?: number): { kind?: string; fireless?: true } {
  const kind = kindOf(world);
  if (kind === "rocky") return {};
  if (kindBurns(kind)) return { kind };
  const m = meansOfWorld(homePlanet(world).generated),
    r = cell === undefined ? 0 : reachIn(m, (id) => !!loreOf(world).get(cell, id));
  return typeof r === "number" && r >= 700 ? { kind } : { kind, fireless: true };
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
 * Whether a people of this world could ever find a principle, as lore asks: the hottest its land's
 * means reach, its body's medium, and its matter can do what it asks. (Not whether what it needs
 * first can be had.)
 */
export function canBeFoundHere(world: World, p: Principle): boolean {
  const ctx = populationContext(world),
    m = meansOfWorld(ctx.generated),
    // (The hottest any means could get here, known or not.)
    reach = m.burns ? true : hottest(m).heat;
  return (
    affordsPrinciple(p, ctx.medium, reach, m.wants) && !matterShuts(p, functionsOf(ctx.generated))
  );
}

/**
 * Where nothing burns, what its works are driven by: the first engine of its own that a land has
 * found (F2).
 */
function doneHere(world: World): string {
  const id = OWN_ENGINES.find((x) => knownAnywhere(world, x));
  return id ? `Its works are driven by ${principleName(id, world)}.` : "";
}

/** Whether any land of a world has found a principle, by its lore. */
function knownAnywhere(world: World, id: string): boolean {
  const lore = loreOf(world),
    lands = populationContext(world).provinces.all();
  return lands.some((p) => !!lore.get(p.cell, id));
}

/**
 * Why a principle cannot be known on this world, as far as its world goes (null: it can): what its
 * matter asks that it cannot give, the heat it wants that no means here reaches, or the fire it
 * burns where nothing burns.
 */
export function shutWhy(world: World, p: Principle): string | null {
  const g = homePlanet(world).generated,
    m = meansOfWorld(g),
    kind = kindOf(world),
    f = matterShuts(p, functionsOf(g));
  if (f) return `it asks a people to ${f.name}. ${f.why}`;
  if (m.burns) return null;
  if (p.body?.burns) {
    // (Its air may burn, and its people live under water or cannot keep a fire: F4.)
    if (meansNumbers(g).freeOxygen) return `its people can keep no fire, so ${unfired(p.id)}.`;
    const works = [doneHere(world), KINDS[kind].fire].filter(Boolean).join(" ");
    return `nothing burns in its air, so ${unfired(p.id)}. ${works}`;
  }
  const want = m.wants[p.id] ?? p.body?.heat,
    top = hottest(m);
  if (want && top.heat < want)
    return `it wants ${count(want)} °C, and the hottest any means reaches here is ${count(top.heat)} °C, by ${top.name}`;
  return null;
}

/** A principle's name as its world's kind names it ("steamships": "engine-driven ships"), or its own. */
export function kindName(world: World, p: Principle): string {
  const kind = kindOf(world);
  // (How its world does it, F1: "the gun of hand-wound fibre, charged with solid acetylene".)
  const own = world.storeNames().includes("planet.home")
    ? meansName(p.id, meansOfWorld(homePlanet(world).generated))
    : null;
  if (own) return own;
  return kind === "rocky"
    ? p.name
    : (burnlessName(worldChemistry(homePlanet(world).generated), p.id) ?? p.name);
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

/**
 * A recipe's name on this world: where native copper is worked cold, not smelted, the recipe is
 * named so (F2).
 */
export function recipeName(world: World, r: Recipe): string {
  // (A toy world has no planet, and so no ores of its own.)
  if (r.id !== "copper-smelting" || !world.storeNames().includes("planet.home")) return r.name;
  const chem = worldChemistry(homePlanet(world).generated);
  return Object.values(oresOn(chem).copper ?? {}).some((o) => o?.worked)
    ? "native copper hammered cold"
    : r.name;
}

/**
 * Where a smith works on this world: at a hearth, or (where nothing burns) cold at an anvil stone,
 * unless the heat its land reaches is a thousand degrees or more (F2).
 */
export function smithAt(world: World, cell?: number): string {
  if (kindBurns(kindOf(world))) return "a smith's hearth";
  const m = meansOfWorld(homePlanet(world).generated),
    r = cell === undefined ? 0 : reachIn(m, (id) => !!loreOf(world).get(cell, id));
  return typeof r === "number" && r >= 1000 ? "a smith's hearth" : "a smith's anvil stone";
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

/**
 * The vessels of a world where nothing burns (null where clay is fired): a fired one of its means
 * where its land knows the wheel, else one of what its rock, air or ground holds (F2).
 */
export function kindVessel(world: World, cell?: number): Vessel | null {
  // (A toy world has no planet, and so no means of its own.)
  if (!world.storeNames().includes("planet.home")) return null;
  const g = homePlanet(world).generated,
    means = meansOfWorld(g),
    n = meansNumbers(g),
    v = means.vessel;
  if (means.burns) return null;
  if (v && cell !== undefined && loreOf(world).get(cell, "pottery-wheel"))
    return {
      ware: `fired ${v.name} pot`,
      of: v.name,
      subst: v.subst,
      from: v.from,
      how: `${v.how}, at ${v.heat} °C`,
      bench: "pot-firing",
      yard: "a pot-firer's yard",
      colour: v.colour,
    };
  if (n.rockHolds.includes("bitumen"))
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
  if (n.airHolds.includes("ammonia"))
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
  if (n.groundHolds.includes("water-ice"))
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
