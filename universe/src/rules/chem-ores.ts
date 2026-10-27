// The ores of a world's chemistry, by the role each plays in its metals (Phase 54, A3): copper, the
// world's hardener (the "tin" of D6) and iron. A role's lies are Earth's where the world's chemistry is
// Earth's; otherwise its redox, carbon and hardener name them. A reduced world's metals do not rust, so
// its copper lies native or as glance and its iron as black ore. The Sun's own chemistry keeps Earth's
// tables exactly: nothing new may appear on Earth.
import { METALS, ORES, type Metal, type Ore, type OreLie } from "./stuffs.ts";
import {
  KIND_REACTIONS,
  NOVEL_REACTIONS,
  REACTIONS,
  findReaction,
  type Reaction,
} from "./matter.ts";
import { KIND_METALS, KIND_ORES, KIND_REACTION_IDS } from "./kind-ground.ts";
import { KIND_PRINCIPLE_NAMES, kindBurns } from "./kinds.ts";
import { chemistryKey, type AirClass, type Chemistry } from "./chemistry.ts";
import { principle } from "./principles.ts";

/** A furnace: the heat it reaches (°C), and the process that brings it (null: a fire needs none). */
export type Furnace = {
  readonly id: "fire" | "kiln" | "bloomery" | "blast" | "arc";
  readonly name: string;
  readonly heat: number;
  readonly by: string | null;
};

/** The furnaces a people can run, each brought by a process it has learnt. */
export const FURNACES: readonly Furnace[] = [
  // An open charcoal fire tops out near 800 °C.
  { id: "fire", name: "an open fire", heat: 800, by: null },
  // A closed, blown hearth or crucible reaches 1,100–1,200 °C. It comes with metalworking, not
  // pottery (D7), so chalcopyrite's 1200 is not blocked before a kiln exists.
  { id: "kiln", name: "a kiln-furnace", heat: 1200, by: "metalworking" },
  // A bellows-blown shaft reaches 1,200–1,300 °C.
  { id: "bloomery", name: "a bloomery", heat: 1250, by: "iron" },
  // A hot blast runs iron liquid.
  { id: "blast", name: "a blast furnace", heat: 1500, by: "steel" },
  // An electric arc passes 3,000 °C.
  { id: "arc", name: "an arc furnace", heat: 3000, by: "electricity" },
];

/**
 * The air's part in a furnace's heat: heat per volume of air scales with its oxygen. A thin air's
 * fire (15–17.6% oxygen) burns 110 °C cooler, so a bloomery blown by hand falls short of bog iron
 * until a mill's wheel drives its blast (DRIVEN_BLAST); a rich air's burns 60 °C hotter.
 */
export const AIR_OFFSET: Readonly<Record<AirClass, number>> = { thin: -110, solar: 0, rich: 60 };

/**
 * The principle whose wheel drives a furnace's blast: air forced in makes up a thin air's want, as
 * water-driven bellows first took furnaces past what a hand-blown draught could reach.
 */
export const DRIVEN_BLAST = "mills";

/** The sim's shares of a grade: the arsenical ore's of its copper's, and native iron's. */
export const ARSENICAL_GRADE = 0.5,
  TELLURIC_GRADE = 0.5;

/**
 * Grey copper ore, roasted for the white arsenic that hardens its copper. In the sim its grade is the
 * copper's times ARSENICAL_GRADE.
 */
export const ARSENICAL_ORE: Ore = {
  mineral: "tennantite",
  name: "grey copper ore",
  words:
    "grey copper ore with arsenic in it, roasted for the white arsenic that hardens its copper",
  smelt: "roast-tennantite",
  grade: 1,
};

/** A metal's stuff, as METALS holds it: its edge, its hand and its works, its colour. */
export type MetalStuff = (typeof METALS)[keyof typeof METALS];

/** A role a metal is asked for: METALS' metals, with bog iron on its own. */
export type MetalRole = Metal | "bog iron";

/** A world's metal: its name, the substance it is, and its stuff. */
export type WorldMetal = {
  readonly name: string;
  readonly subst: string;
  readonly stuff: MetalStuff;
};

/**
 * The metals of worlds of their own chemistry, with exactly METALS' fields. Arsenical copper
 * work-hardens almost to tin bronze, and arsenic embrittles it above ~4%.
 */
export const NOVEL_METALS: Readonly<
  Record<"arsenical copper" | "cupronickel" | "telluric iron" | "cohenite iron", MetalStuff>
> = {
  "arsenical copper": {
    keen: 0.62,
    tough: 0.7,
    colour: [0.8, 0.6, 0.45],
    hand: "cast in a mould, its edge hammered hard",
    works: "cast at the foundry",
  },
  // A softer, more ductile fcc solid solution.
  cupronickel: {
    keen: 0.64,
    tough: 0.78,
    colour: [0.78, 0.76, 0.72],
    hand: "cast and hammered, its edge cold-worked hard",
    works: "cast at the foundry",
  },
  // Uneven, with carbide inclusions.
  "telluric iron": {
    keen: 0.66,
    tough: 0.5,
    colour: [0.48, 0.48, 0.5],
    hand: "hammered at a red heat from lumps of native iron",
    works: "rolled at the works",
  },
  // About 3% carbon behaves like white iron.
  "cohenite iron": {
    keen: 0.84,
    tough: 0.5,
    colour: [0.42, 0.42, 0.45],
    hand: "forged from a carbon-rich bloom, its brittle edge ground keen",
    works: "rolled at the works",
  },
};

/** An alloy: the reaction that makes it, and its words, what it is with, from what, and of what. */
export type Alloy = {
  readonly reaction: string;
  readonly words: string;
  readonly with: string;
  readonly from: string;
  readonly of: string;
};

// Earth's own alloys, exactly.
const TIN_ALLOY: Alloy = {
  reaction: "alloy-bronze",
  words: "a tenth of tin melted into the copper",
  with: "a tenth of tin",
  from: "copper and tin",
  of: "copper with a tenth of tin, melted together",
};

// Copper hardened with arsenic: the arsenic stays in the copper after the charcoal takes its oxygen.
const ARSENICAL_ALLOY: Alloy = {
  reaction: "alloy-arsenical",
  words: "white arsenic stirred into the molten copper under charcoal",
  with: "a little white arsenic",
  from: "copper and white arsenic",
  of: "copper with a twenty-fifth of arsenic, stirred in under charcoal",
};

// Copper and nickel: cupronickel, white and bright, with no tin needed.
const NICKEL_ALLOY: Alloy = {
  reaction: "alloy-cupronickel",
  words: "a quarter of nickel melted into the copper",
  with: "a quarter of nickel",
  from: "copper and nickel",
  of: "copper with a quarter of nickel, melted together",
};

/** A role's ores, lie by lie. */
type Role = Partial<Record<OreLie, Ore>>;

/** The ores of a world, kind by kind (each kind's role). */
type OreTable = Readonly<Record<string, Role>>;

// Reduced copper does not rust green: it lies as glance in the deep veins, or native where old
// mountains are worn open.
const CHALCOCITE: Ore = {
  mineral: "chalcocite",
  name: "copper glance",
  words: "sooty black copper glance of the deep veins, never rusted green",
  smelt: "smelt-chalcocite",
  grade: 1,
};
const NATIVE_COPPER: Ore = {
  mineral: "native-copper",
  name: "native copper",
  words: "native copper lying free where old mountains are worn open, unrusted under its air",
  smelt: "melt-native-copper",
  grade: 1,
};

// Arsenic and nickel hardeners, by their tin role. The arsenic veins run 1–5% arsenic; the laterites
// 1–3% nickel.
const ARSENIC_DEPOSIT: Ore = {
  mineral: "arsenopyrite",
  name: "mispickel",
  words: "silver-white mispickel in the veins of old granites",
  smelt: "roast-arsenopyrite",
  grade: 1,
};
const ARSENIC_SURFACE: Ore = {
  mineral: "arsenopyrite",
  name: "arsenic stone",
  words: "silver-white arsenic ore weathered out of the granite's veins",
  smelt: "roast-arsenopyrite",
  grade: 1,
};
const NICKEL_DEPOSIT: Ore = {
  mineral: "garnierite",
  name: "nickel ore",
  words: "green nickel ore of the serpentine slivers along an old suture",
  smelt: "smelt-garnierite",
  grade: 1,
};
const NICKEL_SURFACE: Ore = {
  mineral: "garnierite",
  name: "garnierite",
  words: "green garnierite weathered out of serpentine",
  smelt: "smelt-garnierite",
  grade: 1,
};

// Native iron in basalt that flowed through buried coal.
const TELLURIC_IRON: Ore = {
  mineral: "telluric-iron",
  name: "native iron",
  words: "lumps of native iron in basalt that flowed through buried coal",
  smelt: "forge-telluric",
  grade: TELLURIC_GRADE,
};

// The minerals a deposit holds, where the world's chemistry differs from Earth's.
const COPPER_MINERALS: readonly string[] = ["chalcocite", "native-copper"];
const IRON_MINERALS: readonly string[] = ["magnetite", "siderite"];
const ARSENIC_MINERALS: readonly string[] = ["arsenopyrite"];
const NICKEL_MINERALS: readonly string[] = ["garnierite"];

// Tin ore's shares of a second metal: arsenic in the arsenopyrite veins, nickel in the laterites.
const ARSENIC_SHARE = { of: "arsenic", share: 0.03 };
const NICKEL_SHARE = { of: "nickel", share: 0.015 };

const oreMemo = new Map<string, OreTable>();
const reactionMemo = new Map<string, readonly Reaction[]>();

/** Earth's ores under one kind (ORES names copper, tin and iron). */
function earthRole(kind: string): Role {
  return ORES[kind] ?? {};
}

/** Copper: Earth's, unless the world is reduced; then deposit and surface change, and the vent stays Earth's. */
function copperOn(chem: Chemistry): Role {
  return chem.redox === "oxidised"
    ? earthRole("copper")
    : { ...earthRole("copper"), deposit: CHALCOCITE, surface: NATIVE_COPPER };
}

/** The hardener's ores in the tin role: Earth's tin, or the arsenic or nickel that hardens the world's copper. */
function tinOn(chem: Chemistry): Role {
  if (chem.hardener === "arsenic") return { deposit: ARSENIC_DEPOSIT, surface: ARSENIC_SURFACE };
  if (chem.hardener === "nickel") return { deposit: NICKEL_DEPOSIT, surface: NICKEL_SURFACE };
  return earthRole("tin");
}

/** Iron: Earth's, unless the world is reduced, when its black ore and native iron do not rust. */
function ironOn(chem: Chemistry): Role {
  if (chem.redox === "oxidised") return earthRole("iron");
  // A carbon-rich world's black ore takes more charcoal than the iron can hold: the carbide bloomery.
  const magnetite = chem.carbon === "carbon-rich" ? "carbide-bloomery" : "smelt-magnetite";
  return {
    deposit: {
      mineral: "magnetite",
      name: "iron ore",
      words: "the banded black ore of an ancient craton, never rusted red",
      smelt: magnetite,
      grade: 1,
    },
    bog: {
      mineral: "siderite",
      name: "bog ore",
      words: "brown siderite settled out of the marsh water, unrusted",
      smelt: "smelt-siderite",
      grade: 0.7,
    },
    hill: {
      mineral: "magnetite",
      name: "ironstone",
      words: "black ironstone of the hills",
      smelt: magnetite,
      grade: 0.9,
    },
    telluric: TELLURIC_IRON,
  };
}

/**
 * The ores of a world's chemistry, by kind and lie. The Sun's own are ORES, the same object. A
 * world's table is built once per class key.
 */
export function oresOn(chem: Chemistry): Readonly<Record<string, Partial<Record<OreLie, Ore>>>> {
  if (chem.solar) return ORES;
  const key = chemistryKey(chem);
  const known = oreMemo.get(key);
  if (known !== undefined) return known;
  const table: OreTable = kindOres(chem) ?? {
    ...ORES,
    copper: copperOn(chem),
    tin: tinOn(chem),
    iron: ironOn(chem),
  };
  oreMemo.set(key, table);
  return table;
}

/**
 * A kind's ores (Phase 56), where its kind has its own: a carbon world's native copper and carbide
 * iron, and no hardener; a sulfur world's blue vitriol beside its crust's copper; an ice world none,
 * every ore under its ice. Null for a rocky world.
 */
function kindOres(chem: Chemistry): OreTable | null {
  if (chem.kind === "ammonia" || chem.kind === "methane")
    return { ...ORES, copper: {}, tin: {}, iron: {} };
  if (chem.kind === "carbon")
    return { ...ORES, copper: KIND_ORES.carbon.copper!, tin: {}, iron: KIND_ORES.carbon.iron! };
  if (chem.kind === "sulfur")
    return {
      ...ORES,
      copper: { ...copperOn(chem), ...KIND_ORES.sulfur.copper },
      tin: tinOn(chem),
      iron: ironOn(chem),
    };
  return null;
}

/** The ore of one kind as it lies on a world, or undefined if the world has no such lie. */
export function worldOre(chem: Chemistry, kind: string, lie: string): Ore | undefined {
  return oresOn(chem)[kind]?.[lie as OreLie];
}

/** The heat an ore's smelt wants (°C), from its reaction (0 if the reaction is not known). */
export function reductionHeat(ore: Ore): number {
  return findReaction(ore.smelt)?.heat ?? 0;
}

/**
 * The hottest furnace the people can run: one that needs no process, one whose process they bring,
 * or one whose process they know. The world's chemistry does not change which furnace is hottest;
 * its air does, in heatOf.
 */
export function furnaceOf(
  chem: Chemistry,
  known: (p: string) => boolean,
  bringing?: string,
): Furnace {
  return FURNACES.filter((f) => f.by === null || f.by === bringing || known(f.by)).reduce(
    (hot, f) => (f.heat > hot.heat ? f : hot),
  );
}

/**
 * The heat a furnace reaches on this world: the furnace's own, moved by the world's air. A thin air's
 * want is made up where the blast is driven by a mill's wheel; a rich air's gain is kept.
 */
export function heatOf(chem: Chemistry, known: (p: string) => boolean, bringing?: string): number {
  const offset = AIR_OFFSET[chem.air],
    driven = offset < 0 && (bringing === DRIVEN_BLAST || known(DRIVEN_BLAST));
  return furnaceOf(chem, known, bringing).heat + (driven ? 0 : offset);
}

/** Whether a furnace of this heat works an ore: it reaches the ore's smelt. */
export function canWork(heat: number, ore: Ore): boolean {
  return heat >= reductionHeat(ore);
}

/**
 * Whether a nickel world's copper is hardened with arsenic instead: its garnierite wants 1250 °C,
 * past a kiln on thin or solar air. The Sun's own is never so.
 */
export function arsenicalFallback(chem: Chemistry): boolean {
  return !chem.solar && chem.hardener === "nickel";
}

/** The principles that are a metal's, and the metal each names (Phase 54 M222). */
export const METAL_PRINCIPLES: ReadonlyMap<string, Metal> = new Map<string, Metal>([
  ["bronze", "bronze"],
  ["iron", "iron"],
]);

/**
 * A principle's name on this world: a metal's principle is named as the world's chemistry names
 * that metal ("arsenical copper" for bronze on an arsenic world); the Sun's chemistry keeps the
 * names the principles have. A kind names some of Earth's its own way (Phase 56: "engine-driven
 * ships" where nothing burns), and where nothing burns a metal's keeps Earth's name: none is
 * smelted there, and its page says why.
 */
export function principleNameOn(chem: Chemistry, id: string): string {
  const own = chem.kind && KIND_PRINCIPLE_NAMES[chem.kind][id];
  if (own) return own;
  if (chem.kind && !kindBurns(chem.kind)) return principle(id).name;
  const metal = METAL_PRINCIPLES.get(id);
  return chem.solar || !metal ? principle(id).name : metalOf(chem, metal).name;
}

/**
 * A metal a role asks for on this world. The Sun's own metals are Earth's, whatever is asked of
 * them. Bog iron is its own role, and a bog lie gives it.
 */
export function metalOf(
  chem: Chemistry,
  role: MetalRole,
  how: { readonly lie?: string | null; readonly arsenical?: boolean } = {},
): WorldMetal {
  const novel = !chem.solar;
  // (A carbon world's copper is native copper beaten cold, its iron ground from carbide: Phase 56.)
  if (chem.kind === "carbon" && role === "copper")
    return { name: "native copper", subst: "copper", stuff: KIND_METALS["cold copper"] };
  if (chem.kind === "carbon" && (role === "iron" || role === "bog iron"))
    return { name: "carbide iron", subst: "cohenite-iron", stuff: KIND_METALS["carbide iron"] };
  if (role === "copper" || role === "steel")
    return { name: role, subst: role, stuff: METALS[role] };
  if (role === "bronze") {
    // Copper hardened with arsenic, or asked for as arsenical.
    if (novel && (how.arsenical === true || chem.hardener === "arsenic"))
      return {
        name: "arsenical copper",
        subst: "arsenical-copper",
        stuff: NOVEL_METALS["arsenical copper"],
      };
    if (novel && chem.hardener === "nickel")
      return { name: "cupronickel", subst: "cupronickel", stuff: NOVEL_METALS.cupronickel };
    return { name: "bronze", subst: "bronze", stuff: METALS.bronze };
  }
  const lie = role === "bog iron" ? "bog" : (how.lie ?? null);
  if (novel && lie === "telluric")
    return { name: "telluric iron", subst: "telluric-iron", stuff: NOVEL_METALS["telluric iron"] };
  if (lie === "bog") return { name: "bog iron", subst: "iron", stuff: METALS["bog iron"] };
  // Carbon-rich iron is cohenite: about 3% carbon, behaving like white iron.
  if (novel && chem.carbon === "carbon-rich")
    return { name: "cohenite iron", subst: "cohenite-iron", stuff: NOVEL_METALS["cohenite iron"] };
  return { name: "iron", subst: "iron", stuff: METALS.iron };
}

/**
 * The alloy the copper is made into. The arsenical flag is the caller's fallback choice; an arsenic
 * hardener is arsenical whatever the flag says. The Sun's own is Earth's tin bronze.
 */
export function alloyOf(chem: Chemistry, arsenical = false): Alloy {
  if (chem.solar) return TIN_ALLOY;
  if (arsenical || chem.hardener === "arsenic") return ARSENICAL_ALLOY;
  if (chem.hardener === "nickel") return NICKEL_ALLOY;
  return TIN_ALLOY;
}

/** A role's word on this world: its tin is the world's hardener; other kinds pass through. */
export function roleWord(chem: Chemistry, kind: string): string {
  return kind === "tin" ? chem.hardener : kind;
}

/** The minerals a deposit of this kind holds on this world; null where it is as Earth's. */
export function depositMineralsOn(chem: Chemistry, kind: string): readonly string[] | null {
  if (chem.solar) return null;
  // (A carbon world's copper lies native and its iron as carbide: Phase 56.)
  if (chem.kind === "carbon" && (kind === "copper" || kind === "iron"))
    return kind === "copper" ? ["native-copper"] : ["cohenite"];
  if (kind === "copper") return chem.redox === "reduced" ? COPPER_MINERALS : null;
  if (kind === "iron") return chem.redox === "reduced" ? IRON_MINERALS : null;
  if (kind === "tin") {
    if (chem.hardener === "arsenic") return ARSENIC_MINERALS;
    if (chem.hardener === "nickel") return NICKEL_MINERALS;
  }
  return null;
}

/** The second metal in a tin ore on this world, and its share; null where the tin is Earth's. */
export function oreGradeOn(
  chem: Chemistry,
  kind: string,
): { readonly of: string; readonly share: number } | null {
  if (chem.solar || kind !== "tin") return null;
  if (chem.hardener === "arsenic") return ARSENIC_SHARE;
  if (chem.hardener === "nickel") return NICKEL_SHARE;
  return null;
}

/** How a deposit of this kind is made on this world, where it differs from Earth's. */
export function depositProcessOn(chem: Chemistry, kind: string): string | null {
  // (An ice world's deposits lie in the rock under its ice crust: Phase 56.)
  if (chem.kind === "ammonia" || chem.kind === "methane")
    return "in the rock under its ice crust, beyond any digging";
  // Sutures carry both collision granites and obducted ophiolite, so the tin keeps its places.
  return !chem.solar && kind === "tin" && chem.hardener === "nickel"
    ? "serpentine slivers of an old suture"
    : null;
}

/**
 * The reactions a world knows: Earth's, and the novel ones its ores, its alloy and its fallback use,
 * in the novel order.
 */
export function reactionsOn(chem: Chemistry): readonly Reaction[] {
  if (chem.solar) return REACTIONS;
  const key = chemistryKey(chem);
  const known = reactionMemo.get(key);
  if (known !== undefined) return known;
  const used = new Set<string>([alloyOf(chem).reaction]);
  for (const role of Object.values(oresOn(chem)))
    for (const ore of Object.values(role)) if (ore) used.add(ore.smelt);
  // A nickel world's fallback: its arsenic ore and its arsenical alloy.
  if (arsenicalFallback(chem)) {
    used.add(ARSENICAL_ORE.smelt);
    used.add(ARSENICAL_ALLOY.reaction);
  }
  // (A kind's own after them: what it does in place of what it cannot, Phase 56.)
  const own = chem.kind ? KIND_REACTION_IDS[chem.kind] : [],
    list: readonly Reaction[] = [
      ...REACTIONS,
      ...NOVEL_REACTIONS.filter((r) => used.has(r.id)),
      ...KIND_REACTIONS.filter((r) => own.includes(r.id)),
    ];
  reactionMemo.set(key, list);
  return list;
}
