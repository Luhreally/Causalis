// A world's life by what it is made of, told (Phase 57): what its life is dissolved in and which
// way it turns, its sugars, stores and fibres, its bones, shells and blood, its cells' skins and its
// colour, each with why; what a lineage's body and a people's are made of; whether a people of the
// stars could eat its life or share its sickness; what its goods and bodies are made of where its
// life is not Earth's; and its colours for the globe, the land and its towns. Pure reads of the
// world as it was made: never read by the simulation, never kept.
import type { World } from "../kernel/index.ts";
import { civLife, worldKindOf, worldLife, type HomeWorld, type Species } from "../gen/index.ts";
import {
  BLOOD_WORDS,
  BONE_WORDS,
  EARTH_LIFE,
  FAMILY_WORDS,
  HAND_WORDS,
  LIFE_ELEMENTS,
  MATERIAL_MATTER,
  MEMBRANE_WORDS,
  PIGMENT_WORDS,
  eats,
  findSubstance,
  kindBurns,
  type Element,
  type LifeChemistry,
  type MakeUp,
  type Substance,
} from "../rules/index.ts";
import {
  clusterOf,
  homePlanet,
  loreOf,
  populationContext,
  sharesStarSickness,
} from "../sim/index.ts";
import type { Block, Line, Stat } from "../bridge/index.ts";
import { item, link, sentence, stat } from "./inspect/words.ts";
import { landLink } from "./inspect/names.ts";

/** A world's life (Earth's on a world with no home planet: a toy world). */
export function lifeHere(world: World): LifeChemistry {
  return world.storeNames().includes("planet.home")
    ? worldLife(homePlanet(world).generated)
    : EARTH_LIFE;
}

/**
 * A world's life's colours, where they are not Earth's green: its pigment's name, or "bare" where
 * nothing took hold (none: Earth's green, chlorophyll's).
 */
export function lifeLook(g: HomeWorld): string | undefined {
  if (!g.life.species.length) return "bare";
  const pigment = worldLife(g).pigment;
  return pigment === "chlorophyll" ? undefined : pigment;
}

/** A frame's or a plan's life's colours, to spread into it (nothing where they are Earth's green). */
export function lookMeta(g: HomeWorld): { lifeLook?: string } {
  const look = lifeLook(g);
  return look ? { lifeLook: look } : {};
}

/** The same, of a world (nothing on a toy world). */
export function worldLook(world: World): { lifeLook?: string } {
  return world.storeNames().includes("planet.home") ? lookMeta(homePlanet(world).generated) : {};
}

/**
 * What a people's look is made of, of their life (Phase 57): their blood, where it is not iron's;
 * their world's shells, where they are not lime; their world's colours.
 */
export function folkLife(g: HomeWorld): { blood?: string; shell?: string; lifeLook?: string } {
  const l = worldLife(g);
  return {
    ...(l.blood === "iron" ? {} : { blood: l.blood }),
    ...(l.shell === "calcite" ? {} : { shell: l.shell }),
    ...lookMeta(g),
  };
}

/** A substance's name, linked to its page. */
function named(id: string): Line {
  return [link(findSubstance(id)?.name ?? id, `subst:${id}`)];
}

/**
 * Why its bones or its shells are what they are (shells of lime beside bones of bone mineral are as
 * Earth's are, whatever makes a world's bones of lime).
 */
function hardWhy(l: LifeChemistry, which: "bone" | "shell"): string {
  return which === "shell" && l.shell !== l.bone
    ? "of lime, as Earth's shells are beside its bones"
    : BONE_WORDS[which === "bone" ? l.bone : l.shell].why;
}

/** Its bones or its shells in words: "silica (opal)", and why where they are not Earth's. */
function boneLine(l: LifeChemistry, which: "bone" | "shell"): Line {
  const b = BONE_WORDS[which === "bone" ? l.bone : l.shell];
  return [`${sentence(b.name)} (`, ...named(b.subst), l.earth ? ")" : `), ${hardWhy(l, which)}`];
}

/** Its blood in words: "red, of iron (haem)", and why where it is not Earth's. */
function bloodLine(l: LifeChemistry): Line {
  const b = BLOOD_WORDS[l.blood];
  return [
    `${sentence(b.colour)}, its breath carried on ${b.name} (`,
    ...named(b.subst),
    l.earth ? ")" : `): ${b.why}`,
  ];
}

/** Which way its life turns, in words. */
function handWords(l: LifeChemistry): string {
  const h = HAND_WORDS[l.hand];
  return `${sentence(h.proteins)} and ${h.sugars}${l.earth ? "" : `, ${h.as}`}: which way its first chemistry happened to turn`;
}

/** What a world's life is made of, row by row: its liquid, its hand, its sugars, stores and fibres, bones, blood, skins, colour. */
export function lifeRows(l: LifeChemistry): Stat[] {
  const f = FAMILY_WORDS[l.family],
    m = MEMBRANE_WORDS[l.membrane],
    p = PIGMENT_WORDS[l.pigment];
  return [
    stat("Its liquid", [...named(l.liquid), `: ${f.why}`]),
    stat("Its hand", handWords(l)),
    stat("Its sugars", l.sugar ? [...named(l.sugar), `: ${f.sugars}`] : sentence(f.sugars)),
    stat("What its seeds store", named(l.store)),
    stat("Its stalks and fibres", named(l.fibre)),
    stat("Its bones", boneLine(l, "bone")),
    ...(l.shell !== l.bone ? [stat("Its shells", boneLine(l, "shell"))] : []),
    stat("Its blood", bloodLine(l)),
    stat("What it breathes", l.breath),
    stat("Its cells' skins", [`${sentence(m.name)} (`, ...named(m.subst), `): ${m.why}`]),
    stat("Its colour", [`${sentence(p.colour)}, with `, ...named(p.subst), `: ${p.why}`]),
  ];
}

/** What a world's life is made of, as a page's block (where none took hold, that nothing is). */
export function lifeBlock(world: World): Block {
  const lifeless =
    world.storeNames().includes("planet.home") && !homePlanet(world).generated.life.species.length;
  return lifeless
    ? {
        type: "text",
        title: "What its life is made of",
        lines: [["Nothing: no life took hold on it."]],
      }
    : { type: "facts", title: "What its life is made of", rows: lifeRows(lifeHere(world)) };
}

/** What a lineage's body is made of: a plant's stalks and seed, a beast's bones or shell, blood and coat. */
export function speciesMatter(world: World, s: Species): Stat[] {
  const l = lifeHere(world);
  if (s.niche === "seed grass")
    return [
      stat("Made of", [...named(l.fibre), " stalks, its seed stored as ", ...named(l.store)]),
    ];
  const shelled = s.body?.covering === "shell";
  return [
    shelled ? stat("Its shell", boneLine(l, "shell")) : stat("Its bones", boneLine(l, "bone")),
    stat("Its blood", bloodLine(l)),
    ...(s.wool || s.body?.covering === "fur" ? [stat("Its coat", named(l.hair))] : []),
  ];
}

/**
 * What a line of the tree of life is made of: a plant's stalks, a body's bones (or shell) and blood
 * — none for the dawn's lines, before bodies hardened themselves.
 */
export function lineMatter(
  world: World,
  line: { readonly kind: string; readonly body: { readonly covering: string } | null },
): Stat[] {
  const l = lifeHere(world);
  if (line.kind === "plant") return [stat("Made of", [...named(l.fibre), " stalks"])];
  if (!line.body || line.kind === "dawn") return [];
  return [
    line.body.covering === "shell"
      ? stat("Its shell", boneLine(l, "shell"))
      : stat("Its bones", boneLine(l, "bone")),
    stat("Its blood", bloodLine(l)),
  ];
}

/**
 * What a body of the world's people is made of: its bones (a people in a shell, its shell, as a
 * shelled lineage's page tells it) and its blood.
 */
export function bodyMatter(world: World, skin?: string): Stat[] {
  const l = lifeHere(world);
  return [
    skin === "shell" ? stat("Shell", boneLine(l, "shell")) : stat("Bones", boneLine(l, "bone")),
    stat("Blood", bloodLine(l)),
  ];
}

/** Whether two lives could feed each other, in words: ours and theirs. */
function betweenWords(ours: LifeChemistry, theirs: LifeChemistry): string {
  if (ours.family !== theirs.family)
    return `nothing of either feeds the other: their life is of ${FAMILY_WORDS[theirs.family].liquid}, ours of ${FAMILY_WORDS[ours.family].liquid}`;
  if (eats(ours, theirs) && eats(theirs, ours))
    return ours.hand === theirs.hand
      ? "each could live on the other's life: its sugars and proteins turn as ours do"
      : "each could live on the other's stores, which turn neither way, but not on its flesh";
  return "neither could live on the other's life: their sugars turn the other way, and nothing of it feeds us, nor ours them";
}

/**
 * A people of the stars' life and ours (Phase 57): what theirs is (of water, as every world they
 * rose on), whether each could live on the other's, and whether a sickness could pass between them.
 */
export function starLifeBlock(
  world: World,
  civ: { readonly ref: string; readonly star: string },
): Block {
  const star = clusterOf(world).find((s) => s.ref === civ.star)?.temperature ?? 5778,
    theirs = civLife(civ, star),
    ours = lifeHere(world),
    p = PIGMENT_WORDS[theirs.pigment],
    g = homePlanet(world).generated;
  return {
    type: "facts",
    title: "Their life and ours",
    rows: [
      stat("Their life", [
        `Of water, of ${HAND_WORDS[theirs.hand].proteins} and ${HAND_WORDS[theirs.hand].sugars}; ${p.colour} with `,
        ...named(p.subst),
      ]),
      stat("Food", sentence(betweenWords(ours, theirs))),
      stat(
        "Sickness",
        sharesStarSickness(g)
          ? "A sickness of theirs can live in us, and ours in them: both are of water"
          : `No sickness of theirs can live in a body of ${FAMILY_WORDS[ours.family].liquid}, nor ours in theirs: a sickness is a life that lives on its host`,
      ),
    ],
  };
}

/** Earth's goods whose water is their life's own (food, fleece, hide, cloth). */
const LIVING_GOODS: ReadonlySet<string> = new Set([
  "grain",
  "meat",
  "wild",
  "wool",
  "hides",
  "clothing",
]);

/**
 * A make-up's parts of Earth's life as this world's life makes them: its sugar, store, fibre, hair
 * and flesh for Earth's (its hides and leather of its own flesh); its fats where it has fats, else
 * its store; in a body, its bones and shells; in a body or a food, the liquid it is dissolved in for
 * water. Earth's as they are.
 */
export function lifeParts(
  l: LifeChemistry,
  parts: readonly (readonly [string, number])[],
  whose: "made" | "food" | "body",
): [string, number][] {
  if (l.earth) return parts.map(([s, k]) => [s, k]);
  const hide =
      l.flesh === "protein"
        ? "collagen"
        : l.flesh === "mirror-protein"
          ? "mirror-collagen"
          : l.flesh,
    swap: Readonly<Record<string, string>> = {
      starch: l.store,
      sugar: l.sugar ?? l.store,
      protein: l.flesh,
      cellulose: l.fibre,
      keratin: l.hair,
      collagen: hide,
      // (Leather is a hide's collagen tanned: of its own flesh's, where that is not Earth's protein.)
      ...(l.flesh === "protein" ? {} : { leather: hide }),
      fat: l.family === "water" || l.family === "ammonia" ? "fat" : l.store,
      ...(whose === "made" ? {} : { water: l.liquid }),
      ...(whose === "body"
        ? { apatite: BONE_WORDS[l.bone].subst, calcite: BONE_WORDS[l.shell].subst }
        : {}),
    },
    out = new Map<string, number>();
  for (const [s, k] of parts) {
    const to = swap[s] ?? s;
    out.set(to, (out.get(to) ?? 0) + k);
  }
  return [...out];
}

/** A good's way as this world's life makes it (Earth's as it is). */
export function lifeWay(world: World, goodId: string, way: MakeUp): MakeUp {
  const l = lifeHere(world);
  return l.earth
    ? way
    : { ...way, parts: lifeParts(l, way.parts, LIVING_GOODS.has(goodId) ? "food" : "made") };
}

/** A building material as this world's life makes it: its wood its fibre, its shell its shell (Earth's as it is). */
export function lifeMaterial(
  world: World,
  material: string,
): readonly (readonly [string, number])[] | undefined {
  const m = MATERIAL_MATTER[material],
    l = lifeHere(world);
  if (!m || l.earth) return m;
  return lifeParts(l, m, material === "shell" || material === "coral" ? "body" : "made");
}

/**
 * What a garment woven of a land's plant fibre is made of (its stalks' fibre, with a little of the
 * air's water held in it), where its cloth is no flock's: the wool's keratin is no tunic of nettle's.
 */
export function plantCloth(world: World): MakeUp {
  const l = lifeHere(world);
  return {
    id: "woven",
    name: "woven plant fibre",
    parts: [
      [l.fibre, 0.93],
      [l.earth || l.family === "water" ? "water" : l.liquid, 0.07],
    ],
  };
}

/** Why each of a life's own stuffs is what it is, where it is not Earth's (a mirror's from its own). */
const STUFF_WHY: Readonly<Record<string, string>> = {
  glucosamine:
    "a sugar that carries nitrogen: in ammonia water the sugars' oxygen gives way to nitrogen",
  "glucosamine-starch":
    "a starch of sugars that carry nitrogen: in ammonia water the sugars' oxygen gives way to nitrogen",
  chitosan:
    "chains of sugars that carry nitrogen, as the shells of Earth's crabs are: in ammonia water the sugars' oxygen gives way to nitrogen",
  polyimine:
    "chains of carbon and nitrogen, which neither oil nor liquid methane dissolves: no sugar dissolves in them to build of",
  squalene: "an oil, as the livers of Earth's sharks store: oil dissolves no sugar or starch",
  acetylene:
    "acetylene, gathered as it falls from the haze: at −180 °C its life lives on it and the hydrogen it breathes",
};

/** Why a stuff of a life is what it is, in words (null: it is Earth's own). */
export function stuffWhy(id: string): string | null {
  if (id.startsWith("mirror-")) {
    const own = STUFF_WHY[id.slice("mirror-".length)];
    return `${own ? `${own}; ` : "Earth's own, "}turned the other way, as its life's sugars and proteins turn`;
  }
  return STUFF_WHY[id] ?? null;
}

/** The substances a world's life is made of, beside its world's tables (none on Earth: Earth's are its tables'). */
export function lifeSubstances(world: World): Substance[] {
  const l = lifeHere(world);
  if (l.earth) return [];
  const ids = [
    l.liquid,
    l.sugar,
    l.store,
    l.fibre,
    l.hair,
    l.flesh,
    l.dye,
    BONE_WORDS[l.bone].subst,
    BONE_WORDS[l.shell].subst,
    BLOOD_WORDS[l.blood].subst,
    MEMBRANE_WORDS[l.membrane].subst,
  ];
  return [...new Set(ids)].flatMap((id) => {
    const s = id === null ? undefined : findSubstance(id);
    return s ? [s] : [];
  });
}

/** A world's substances with its life's own beside them, those its tables lack (the same list on Earth). */
export function withLifeSubstances(world: World, subs: readonly Substance[]): readonly Substance[] {
  const own = lifeSubstances(world).filter((s) => !subs.some((x) => x.id === s.id));
  return own.length ? [...subs, ...own] : subs;
}

/** A world's elements with those its life's own substances hold beside them (vanadium, in a green blood). */
export function withLifeElements(
  world: World,
  els: readonly Element[],
  subs: readonly Substance[],
): readonly Element[] {
  const used = new Set(subs.flatMap((s) => Object.keys(s.formula))),
    own = LIFE_ELEMENTS.filter(
      (e) => used.has(e.symbol) && !els.some((x) => x.symbol === e.symbol),
    );
  return own.length ? [...els, ...own] : els;
}

/**
 * What a substance is in its world's life, in words, where that life is not Earth's (null: nothing
 * of it): what of its life is made of it — its liquid, sugar, store, fibre, hair or flesh — told
 * once with why; what of its bodies and its colour, each with its own why.
 */
export function lifeUseBlock(world: World, id: string): Block | null {
  const l = lifeHere(world);
  if (l.earth) return null;
  const stuffs: string[] = [
      ...(l.liquid === id ? ["the liquid its life is dissolved in"] : []),
      ...(l.sugar === id ? ["its sugar"] : []),
      ...(l.store === id ? ["what its seeds and roots store"] : []),
      ...(l.fibre === id ? ["the fibre of its stalks"] : []),
      ...(l.hair === id ? ["its beasts' hair and wool"] : []),
      ...(l.flesh === id ? ["its flesh"] : []),
    ],
    why = stuffWhy(id),
    said = stuffs.length > 1 ? `${stuffs.slice(0, -1).join(", ")} and ${stuffs.at(-1)}` : stuffs[0],
    lines: Line[] = said ? [[`${sentence(said)}${why ? `: ${why}` : ""}.`]] : [];
  if (BONE_WORDS[l.bone].subst === id) lines.push([`Its bones, ${hardWhy(l, "bone")}.`]);
  if (l.shell !== l.bone && BONE_WORDS[l.shell].subst === id)
    lines.push([`Its shells, ${hardWhy(l, "shell")}.`]);
  if (BLOOD_WORDS[l.blood].subst === id)
    lines.push([`What its blood carries its breath on: ${BLOOD_WORDS[l.blood].why}.`]);
  if (MEMBRANE_WORDS[l.membrane].subst === id)
    lines.push([`The skins of its cells: ${MEMBRANE_WORDS[l.membrane].why}.`]);
  if (l.dye === id)
    lines.push([`Its colour, and the dye pressed from it: ${PIGMENT_WORDS[l.pigment].why}.`]);
  return lines.length ? { type: "text", title: "In this world's life", lines } : null;
}

// —— What is made of it ————————————————————————————————————————————————————————————————

type Rgb = readonly [number, number, number];

/** Two colours mixed: `k` of the second. */
const mixed = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

/**
 * A land's cloth as its world's life makes it (Phase 57), its fibre undyed: of its plants' fibre or
 * its flocks' hair, and why, where that is not Earth's; dyed its plants' own colour where its land
 * knows dyeing (the pigment that catches its star's light: Earth's green, chlorophyll, fades in the
 * sun and washes out, and Earth's dyers went to madder, woad and weld). Earth's as it is.
 */
export function clothLife(
  world: World,
  cell: number,
  cloth: { readonly colour: Rgb; readonly plant?: true },
): { readonly colour: Rgb; readonly lines: readonly Line[] } {
  const l = lifeHere(world);
  if (l.earth) return { colour: cloth.colour, lines: [] };
  const fibre = cloth.plant ? l.fibre : l.hair,
    why = stuffWhy(fibre),
    stuff = findSubstance(fibre),
    // (Undyed, a fibre not of Earth's chains is its own colour, half and half with the land's.)
    own =
      why && stuff && !fibre.startsWith("mirror-")
        ? mixed(cloth.colour, stuff.colour, 0.5)
        : cloth.colour,
    p = PIGMENT_WORDS[l.pigment],
    dye = findSubstance(l.dye),
    dyes =
      l.pigment !== "chlorophyll" &&
      l.dye !== fibre &&
      !!dye &&
      loreOf(world).get(cell, "dyeing") !== undefined;
  return {
    colour: dyes ? mixed(own, dye.colour, 0.6) : own,
    lines: [
      ...(why ? [["Its fibre is ", ...named(fibre), `: ${why}`] as Line] : []),
      ...(dyes
        ? [
            [
              `Dyed ${p.colour} with `,
              ...named(l.dye),
              " pressed from its own plants: the colour of the light they catch",
            ] as Line,
          ]
        : []),
    ],
  };
}

/**
 * Its rope and cord, where its world's life is not Earth's (Phase 57): twisted of its plants' stalks
 * (`cord`, as the land calls them), and what those are made of, and why. None on Earth.
 */
export function ropeLines(world: World, cord: string): Line[] {
  const l = lifeHere(world),
    why = stuffWhy(l.fibre);
  if (l.earth || !why) return [];
  return [
    [
      `Their rope and cord are twisted of ${cord === "sinew" ? "sinew and grass" : cord}, whose fibre is `,
      ...named(l.fibre),
      `: ${why}.`,
    ],
  ];
}

/** What a land's seed is ground to, by what it stores: flour of a starch, an oily meal of an oil, a frozen meal of acetylene. */
function mealOf(store: string): string {
  return store === "squalene" ? "an oily meal" : store === "acetylene" ? "a frozen meal" : "flour";
}

/**
 * What a town's mill grinds and its ovens bake (Phase 57): its land's own sown seed, stored as its
 * life stores it, ground to flour (an oily meal where it stores oil, a frozen one where it stores
 * acetylene) and baked into bread, or pressed into cakes where nothing burns; why, where its life is
 * not Earth's. On every world: Earth's bread is the same chain.
 */
export function millBlock(world: World, cell: number): Block {
  const l = lifeHere(world),
    g = populationContext(world).generated,
    sown = g.life.seedGrass[cell] ?? -1,
    grass = sown >= 0 ? g.life.species[sown] : undefined,
    why = stuffWhy(l.store),
    meal = mealOf(l.store),
    bakes = kindBurns(worldKindOf(g)),
    made = bakes ? "bread" : "cakes";
  return {
    type: "list",
    title: `Ground here this year: ${meal}, for ${made}`,
    items: [
      item([
        "Seed of ",
        ...(grass ? [link(grass.name, grass.ref), " from "] : []),
        "the fields of ",
        landLink(world, cell),
        ", stored as ",
        ...named(l.store),
        why ? `: ${why}` : "",
      ]),
      item([`Ground between the millstones to ${meal}`]),
      item([
        bakes
          ? "Baked into bread in the town's ovens"
          : "Pressed into cakes: nothing burns in its air to bake them",
      ]),
    ],
  };
}
