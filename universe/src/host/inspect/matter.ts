// Matter's pages (Phase 15 M122, asked for 2026-09-28: Classic's detail — "it breaks down
// inventory and chemistry"): a substance (what it is, its elements, its properties, where it
// lies in this world, what it becomes and what makes it, the goods that hold it); a reaction
// (what goes in and comes out by weight, its heat and fuel, what teaches it and who knows it);
// a principle (what it needs, what drives its finding, what it changes, the reactions it
// teaches, the lands that know it); a good (a unit's weight, what it is made of each way it is
// made, how it is made and what wears it out, the world's stock and who holds it). And a good
// in a land: what it is made of there, and how it is made there — or why it is not. Pure reads.
// A world of another chemistry (Phase 54) has its own substances, reactions and elements, and a
// "This world" tab of what it is made of: its air, crust, rocks, ores, metals and furnaces.
import {
  AIR_OFFSET,
  ARSENICAL_ORE,
  CLASS_WORDS,
  EFFECTS,
  ELEMENTS,
  FURNACES,
  GOODS,
  GOOD_MATTER,
  NOVEL_ELEMENTS,
  NOVEL_SUBSTANCES,
  PRINCIPLES,
  REACTIONS,
  SUBSTANCES,
  WANTS,
  arsenicalFallback,
  chemistryKey,
  crustOf,
  depositMineralsOn,
  elementShares,
  findElement,
  findReaction,
  findSubstance,
  metalOf,
  molarMass,
  oresOn,
  principle,
  reactionKg,
  reactionsOn,
  reductionHeat,
  roleWord,
  RECIPES,
  stonesFor,
  SUBSTANCE,
  usualStone,
  worldRocks,
  type Chemistry,
  type Element,
  type MakeUp,
  type MatterKind,
  type Ore,
  type Principle,
  type Recipe,
  type Stone,
  type Substance,
} from "../../rules/index.ts";
import { hashString, yearOfMoment, type World } from "../../kernel/index.ts";
import {
  homePlanet,
  loreOf,
  populationContext,
  toolMetal,
  whyNot,
  type MarketStore,
} from "../../sim/index.ts";
import {
  cradleTongue,
  isProvinceWorld,
  nativeIronLands,
  starAgeGyr,
  tongueName,
  worldChemistry,
} from "../../gen/index.ts";
import type { Block, Item, Line, PageModel, Tab } from "../../bridge/index.ts";
import { count, item, link, share, stat, yearNow } from "./words.ts";
import { landLink, landTitle } from "./names.ts";
import { airBlock } from "./ground.ts";

export const substRef = (id: string) => `subst:${id}`,
  rxnRef = (id: string) => `rxn:${id}`,
  prinRef = (id: string) => `prin:${id}`,
  goodRef = (id: string) => `good:${id}`;

const KIND_ICON: Readonly<Record<MatterKind, string>> = {
  metal: "⚙️",
  ore: "🪨",
  mineral: "💎",
  fuel: "🔥",
  made: "🧪",
  food: "🌾",
  living: "🌿",
  water: "💧",
  gas: "💨",
};
const KIND_WORDS: Readonly<Record<MatterKind, string>> = {
  metal: "a metal",
  ore: "an ore",
  mineral: "a mineral",
  fuel: "a fuel",
  made: "made by hand and fire",
  food: "food",
  living: "the stuff of living things",
  water: "water",
  gas: "a gas",
};
const GOOD_ICON: Readonly<Record<string, string>> = {
  grain: "🌾",
  meat: "🥩",
  wild: "🍄",
  wool: "🐑",
  hides: "🟫",
  copper: "🟠",
  tools: "🔨",
  clothing: "👕",
  pottery: "🏺",
  coal: "⚫",
  oil: "🛢️",
  machines: "⚙️",
  tin: "⚪",
  iron: "🔩",
};
/** Each element's colour in a make-up (by what it is most seen as). */
const ELEMENT_COLOUR: Readonly<Record<string, readonly [number, number, number]>> = {
  H: [0.9, 0.9, 0.96],
  C: [0.2, 0.2, 0.2],
  N: [0.46, 0.56, 0.9],
  O: [0.9, 0.3, 0.26],
  Na: [0.7, 0.5, 0.95],
  Mg: [0.55, 0.85, 0.4],
  Al: [0.75, 0.66, 0.68],
  Si: [0.94, 0.78, 0.62],
  P: [1, 0.55, 0.1],
  S: [0.95, 0.9, 0.2],
  Cl: [0.2, 0.9, 0.3],
  Ar: [0.5, 0.82, 0.9],
  K: [0.56, 0.25, 0.83],
  Ca: [0.3, 0.9, 0.65],
  Fe: [0.6, 0.35, 0.25],
  Cu: [0.78, 0.45, 0.22],
  Sn: [0.4, 0.5, 0.5],
  Au: [0.95, 0.78, 0.2],
  As: [0.45, 0.46, 0.47],
  Ni: [0.72, 0.71, 0.66],
};
const EFFECT_WORDS: Readonly<Record<(typeof EFFECTS)[number], string>> = {
  farmYield: "fields give more",
  herdYield: "flocks give more",
  forageYield: "the wild gives more",
  storage: "food keeps for more months",
  keeping: "stores spoil less",
  tools: "crafters make more tools",
  clothing: "crafters make more clothing",
  pottery: "crafters make more pottery",
  haul: "carrying costs less",
  carrying: "carriers move more",
  health: "fewer die",
  reach: "a realm reaches further from its seat",
  learning: "learning from others comes faster",
  writing: "law can be written",
  arms: "better arms",
  armour: "better armour",
  mounts: "mounts for war",
  walls: "walls",
  sieges: "siege-craft",
  ships: "ships",
  building: "building in stone and high",
  power: "engines to drive",
  industry: "crafts done in works",
  renewable: "power without fuel",
};

/** A weight in words: tonnes, kilograms or grams. */
export function weight(kg: number): string {
  if (kg >= 1e9) return `${(kg / 1e9).toFixed(kg >= 1e11 ? 0 : 1)} Mt`;
  if (kg >= 1000) return `${count(kg / 1000)} t`;
  if (kg >= 10) return `${Math.round(kg)} kg`;
  if (kg >= 1) return `${kg.toFixed(1)} kg`;
  return `${Math.max(1, Math.round(kg * 1000))} g`;
}

/** The ore minerals each kind of deposit holds. */
export const DEPOSIT_MINERALS: Readonly<Record<string, readonly string[]>> = {
  copper: ["malachite", "chalcopyrite"],
  tin: ["cassiterite"],
  iron: ["hematite", "magnetite"],
  gold: ["gold"],
  coal: ["carbon", "pyrite"],
  oil: ["crude"],
  salt: ["halite"],
};

// (Earth's substances first, then those of worlds of their own chemistry: Phase 54.)
const substanceOf = (id: string): Substance => findSubstance(id)!;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** The chemistry of a world: the Sun's own on an Earth-like one, else its own (Phase 54). */
const chemOf = (world: World): Chemistry => worldChemistry(homePlanet(world).generated);

/** A number with its sign, and a real minus below nothing: −0.51, +0.12. */
const signed = (x: number): string => {
  const r = Math.round(x * 100) / 100;
  return r === 0 ? "0.00" : `${r < 0 ? "−" : "+"}${Math.abs(r).toFixed(2)}`;
};

/** An edge's keenness or toughness (0 … 1), in two figures at most: 0.8, 1. */
const edge = (x: number): string => String(Math.round(x * 100) / 100);

/** A quantity in parts a million: whole where it is large, two figures where it is small. */
const ppmWords = (x: number): string => (x >= 10 ? count(x) : String(Number(x.toPrecision(2))));

const substanceMemo = new Map<string, readonly Substance[]>(),
  elementMemo = new Map<string, readonly Element[]>();

/**
 * The substances of a world's chemistry: Earth's, and the novel ones its reactions, its rocks, its
 * stones and its hardener use. Telluric iron is among them, since a reduced world always has
 * forge-telluric. The Sun's own chemistry keeps SUBSTANCES itself; each other is made once per
 * chemistry.
 */
export function substancesOn(chem: Chemistry): readonly Substance[] {
  if (chem.solar) return SUBSTANCES;
  const key = chemistryKey(chem);
  const known = substanceMemo.get(key);
  if (known !== undefined) return known;
  const used = new Set<string>([chem.hardener]);
  for (const r of reactionsOn(chem)) {
    for (const [id] of [...r.inputs, ...r.outputs]) used.add(id);
    if (r.fuel) used.add(r.fuel);
  }
  for (const rock of worldRocks(chem)) for (const [id] of rock.parts) used.add(id);
  for (const stone of Object.values(stonesFor(chem))) if (stone.subst) used.add(stone.subst);
  const list = [...SUBSTANCES, ...NOVEL_SUBSTANCES.filter((s) => used.has(s.id))];
  substanceMemo.set(key, list);
  return list;
}

/** A world's elements: Earth's, and the novel ones its substances' formulas hold. */
export function elementsOn(chem: Chemistry): readonly Element[] {
  if (chem.solar) return ELEMENTS;
  const key = chemistryKey(chem);
  const known = elementMemo.get(key);
  if (known !== undefined) return known;
  const used = new Set(substancesOn(chem).flatMap((s) => Object.keys(s.formula)));
  const list = [...ELEMENTS, ...NOVEL_ELEMENTS.filter((e) => used.has(e.symbol))];
  elementMemo.set(key, list);
  return list;
}

/**
 * What something is made of, as a composition block: each part a link to its substance, with
 * its weight where the whole is weighed.
 */
export function makeUpBlock(
  parts: readonly (readonly [string, number])[],
  totalKg: number | null,
  title?: string,
  note?: string,
): Block {
  return {
    type: "composition",
    ...(title ? { title } : {}),
    parts: [...parts]
      .sort((a, b) => b[1] - a[1])
      .map(([id, s]) => {
        const sub = substanceOf(id);
        return {
          name: [link(sub.name, substRef(id))],
          share: s,
          ...(totalKg !== null ? { amount: weight(totalKg * s) } : {}),
          color: sub.colour,
        };
      }),
    ...(note ? { note } : {}),
  };
}

/** A make-up down to its elements: each substance's elements, weighed by its share. */
export function elementsOf(parts: readonly (readonly [string, number])[]): [string, number][] {
  const out = new Map<string, number>();
  for (const [id, s] of parts)
    for (const [e, k] of elementShares(substanceOf(id))) out.set(e, (out.get(e) ?? 0) + s * k);
  return [...out].sort((a, b) => b[1] - a[1]);
}

function elementsBlock(shares: readonly [string, number][], totalKg: number | null): Block {
  return {
    type: "composition",
    title: "Its elements",
    parts: shares.map(([e, s]) => {
      const el = findElement(e)!;
      return {
        name: [`${cap(el.name)} (${e})`],
        share: s,
        ...(totalKg !== null ? { amount: weight(totalKg * s) } : {}),
        color: ELEMENT_COLOUR[e] ?? [0.6, 0.6, 0.6],
      };
    }),
  };
}

/** The lands that know a principle now, with the year each came to (earliest first). */
function knowers(world: World, id: string): { cell: number; year: number | null }[] {
  const ctx = populationContext(world),
    lore = loreOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    out: { cell: number; year: number | null }[] = [];
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    if (id === "cultivation") {
      if (p.knowsCultivation) out.push({ cell: p.cell, year: null });
    } else if (id === "metalworking") {
      const e = markets.get(p.cell)?.metalworking,
        at = e ? world.events.get(e) : undefined;
      if (e) out.push({ cell: p.cell, year: at ? yearOfMoment(at.t) : null });
    } else {
      const k = lore.get(p.cell, id);
      if (k) out.push({ cell: p.cell, year: k.year });
    }
  }
  return out.sort((a, b) => (a.year ?? -1) - (b.year ?? -1) || a.cell - b.cell);
}

function knowersBlock(world: World, id: string, title: string): Block {
  const all = knowers(world, id);
  return {
    type: "list",
    title,
    items: all
      .slice(0, 12)
      .map((k) =>
        item(
          [landLink(world, k.cell), k.year !== null ? ` — since year ${k.year}` : ""],
          null,
          k.year ?? undefined,
        ),
      ),
    ...(all.length > 12 ? { more: all.length - 12 } : {}),
  };
}

/** A reaction in words: "2 malachite + 1 charcoal → …", each a link. */
function equation(r: (typeof REACTIONS)[number]): Line {
  const side = (xs: readonly (readonly [string, number])[]): Line =>
    xs.flatMap(([id, n], i) => [
      ...(i ? [" + "] : []),
      `${Number.isInteger(n) ? n : n.toFixed(3)} `,
      link(substanceOf(id).name, substRef(id)),
    ]);
  return [...side(r.inputs), " → ", ...side(r.outputs)];
}

/**
 * Where a substance lies in this world: the deposits that hold it, richest first. Each deposit is
 * named by its role on this world (its tin is the world's hardener); the minerals a role holds are
 * the world's own.
 */
function whereItLies(world: World, id: string): { items: Item[]; more: number } {
  const g = homePlanet(world).generated,
    chem = chemOf(world),
    fine = isProvinceWorld(g) ? g.fine : g,
    landOf = (spot: number) => (isProvinceWorld(g) ? g.provinceOf[spot]! : spot),
    kinds = Object.entries(DEPOSIT_MINERALS)
      .filter(([kind, minerals]) => (depositMineralsOn(chem, kind) ?? minerals).includes(id))
      .map(([k]) => k),
    found = fine.deposits
      .filter((d) => kinds.includes(d.kind))
      .sort((a, b) => b.richness - a.richness || a.index - b.index);
  return {
    items: found
      .slice(0, 10)
      .map((d) =>
        item(
          [
            link(`${roleWord(chem, d.kind)} in ${landTitle(world, landOf(d.cell), true)}`, d.ref),
            ` — ${count(d.richness)} units`,
          ],
          d.ref,
        ),
      ),
    more: Math.max(0, found.length - 10),
  };
}

/** A substance's page (`subst:<id>`). */
export function substancePage(world: World, ref: string): PageModel {
  const id = ref.slice(ref.indexOf(":") + 1),
    s = findSubstance(id);
  if (!s) throw new Error(`no substance ${ref}`);
  const mass = molarMass(s.formula),
    lies = whereItLies(world, id),
    rxns = reactionsOn(chemOf(world)),
    becomes = rxns.filter((r) => r.inputs.some(([x]) => x === id)),
    madeBy = rxns.filter((r) => r.outputs.some(([x]) => x === id)),
    held = GOODS.flatMap((g) =>
      GOOD_MATTER[g.id]!.ways.flatMap((w) =>
        w.parts.filter(([x]) => x === id).map(([, k]) => ({ g, w, k })),
      ),
    ),
    properties = [
      stat("Formula", s.written),
      stat("What it is", KIND_WORDS[s.kind]),
      stat("A mole weighs", `${mass.toFixed(mass < 100 ? 2 : 1)} g`),
      stat("At 15 °C", s.phase),
      stat("Density", `${count(s.density)} kg/m³`),
      ...(s.melts !== null ? [stat("Melts at", `${count(s.melts)} °C`)] : []),
      ...(s.hardness !== null ? [stat("Hardness", `${s.hardness} (Mohs)`)] : []),
    ];
  const blocks: Block[] = [
    { type: "text", lines: [[s.words]] },
    elementsBlock(elementShares(s), null),
    { type: "facts", title: "How it is", rows: properties },
  ];
  if (lies.items.length || DEPOSIT_MINERALS[id] === undefined)
    blocks.push({
      type: "list",
      title: "Where it lies in this world",
      items: lies.items,
      ...(lies.more ? { more: lies.more } : {}),
    });
  const tabs: Tab[] = [{ id: "overview", name: "Overview", blocks }];
  const reactions: Block[] = [
    {
      type: "list",
      title: "What it becomes",
      items: becomes.map((r) =>
        item([link(r.name, rxnRef(r.id)), " — ", ...equation(r)], rxnRef(r.id)),
      ),
    },
    {
      type: "list",
      title: "What makes it",
      items: madeBy.map((r) =>
        item([link(r.name, rxnRef(r.id)), " — ", ...equation(r)], rxnRef(r.id)),
      ),
    },
  ];
  if (becomes.length || madeBy.length)
    tabs.push({ id: "reactions", name: "Reactions", blocks: reactions });
  if (held.length)
    tabs.push({
      id: "goods",
      name: "In goods",
      blocks: [
        {
          type: "list",
          title: "The goods it is in",
          items: held.map(({ g, w, k }) =>
            item([link(w.name, goodRef(g.id)), ` — ${share(k)} of it by weight`], goodRef(g.id)),
          ),
        },
      ],
    });
  return {
    ref,
    kind: "substance",
    icon: KIND_ICON[s.kind],
    title: cap(s.name),
    subtitle: [`${s.written} · ${KIND_WORDS[s.kind]}`],
    color: s.colour,
    place: null,
    stats: [
      stat("Formula", s.written),
      stat("Density", `${count(s.density)} kg/m³`),
      ...(s.melts !== null ? [stat("Melts at", `${count(s.melts)} °C`)] : []),
    ],
    tabs,
    followable: false,
    year: yearNow(world),
  };
}

/** A reaction's page (`rxn:<id>`). */
export function reactionPage(world: World, ref: string): PageModel {
  const id = ref.slice(ref.indexOf(":") + 1),
    r = findReaction(id);
  if (!r) throw new Error(`no reaction ${ref}`);
  const kg = reactionKg(r),
    made = substanceOf(r.outputs[0]![0]),
    teacher = r.principle ? principle(r.principle) : null,
    recipe = r.recipe ? RECIPES.find((x) => x.id === r.recipe) : undefined,
    side = (xs: [string, number][]): Item[] =>
      xs.map(([s, k]) =>
        item([link(substanceOf(s).name, substRef(s)), ` — ${weight(k)}`], substRef(s)),
      );
  const blocks: Block[] = [
    { type: "text", lines: [[r.words], ["In moles: ", ...equation(r)]] },
    {
      type: "list",
      title: `What goes in, for each kilogram of ${made.name}`,
      items: side(kg.inputs),
    },
    { type: "list", title: "What comes out", items: side(kg.outputs) },
    {
      type: "facts",
      title: "What it takes",
      rows: [
        stat("Heat", r.heat !== null ? `${count(r.heat)} °C` : "none beyond its own"),
        ...(r.fuel ? [stat("Burning", [link(substanceOf(r.fuel).name, substRef(r.fuel))])] : []),
        stat(
          "Taught by",
          teacher ? [link(teacher.name, prinRef(teacher.id))] : "known from the first",
        ),
        ...(recipe ? [stat("Worked as", recipe.name)] : []),
      ],
    },
  ];
  if (teacher) blocks.push(knowersBlock(world, teacher.id, "The lands that know it"));
  return {
    ref,
    kind: "reaction",
    icon: "⚗️",
    title: cap(r.name),
    subtitle: [...equation(r)],
    color: made.colour,
    place: null,
    stats: [
      stat("Heat", r.heat !== null ? `${count(r.heat)} °C` : "—"),
      stat("Makes", [link(made.name, substRef(made.id))]),
      ...(teacher ? [stat("Lands that know it", count(knowers(world, teacher.id).length))] : []),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: yearNow(world),
  };
}

/** What drives a principle's finding, in words. */
function driverWords(p: Principle): string[] {
  const d = p.drivers,
    out: string[] = [];
  if (d.crafters) out.push("crafters");
  if (d.farmers) out.push("farmers");
  if (d.herders) out.push("herders");
  if (d.traders) out.push("traders");
  if (d.leaders) out.push("those who lead");
  if (d.famine) out.push("a famine in the last few years");
  if (d.town) out.push("a market town");
  if (d.river) out.push("only where a river runs");
  if (d.coast) out.push("only by the sea");
  if (d.hills) out.push("only in the hills");
  if (d.ore) out.push(`only with ${d.ore} within reach`);
  return out;
}

/** A principle's page (`prin:<id>`). */
export function principlePage(world: World, ref: string): PageModel {
  const id = ref.slice(ref.indexOf(":") + 1),
    p = PRINCIPLES.find((x) => x.id === id);
  if (!p) throw new Error(`no principle ${ref}`);
  const all = knowers(world, p.id),
    first = all.find((k) => k.year !== null),
    teaches = reactionsOn(chemOf(world)).filter((r) => r.principle === p.id),
    opens = PRINCIPLES.filter((q) => q.needs.some((n) => n.split("|").includes(p.id))),
    effects = Object.entries(p.effects).map(
      ([e, v]) => `${EFFECT_WORDS[e as (typeof EFFECTS)[number]]} (${v > 1 ? v : share(v)})`,
    ),
    drivers = driverWords(p);
  const blocks: Block[] = [
    {
      type: "facts",
      rows: [
        stat(
          "Needs first",
          p.needs.length
            ? p.needs.flatMap((n, i) => [
                ...(i ? [", "] : []),
                ...n
                  .split("|")
                  .flatMap((x, j) => [...(j ? [" or "] : []), link(principle(x).name, prinRef(x))]),
              ])
            : "nothing: it is a root",
        ),
        stat("Found by", drivers.length ? drivers.join(", ") : "the older systems"),
        stat("It brings", effects.length ? effects.join("; ") : "what it makes possible"),
        ...(p.body?.fire ? [stat("Wants", "fire")] : []),
      ],
    },
  ];
  if (teaches.length)
    blocks.push({
      type: "list",
      title: "The reactions it teaches",
      items: teaches.map((r) =>
        item([link(r.name, rxnRef(r.id)), " — ", ...equation(r)], rxnRef(r.id)),
      ),
    });
  if (opens.length)
    blocks.push({
      type: "list",
      title: "What it opens the way to",
      items: opens.map((q) => item([link(q.name, prinRef(q.id))], prinRef(q.id))),
    });
  return {
    ref,
    kind: "principle",
    icon: "📜",
    title: cap(p.name),
    subtitle: ["A principle a people may come to know"],
    color: null,
    place: first ? { scale: "region", cell: first.cell } : null,
    stats: [
      stat("Lands that know it", count(all.length)),
      stat(
        "First known",
        first ? [landLink(world, first.cell), `, year ${first.year}`] : "not yet",
      ),
    ],
    tabs: [
      { id: "overview", name: "Overview", blocks },
      {
        id: "lands",
        name: "Who knows it",
        blocks: [knowersBlock(world, p.id, "The lands that know it")],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** What wears a good out, in words (rules/goods.ts WANTS). */
const WEARS: Readonly<Record<string, string>> = {
  tools: `each farmer, herder and crafter wears out ${WANTS.toolsPerWorker} a year`,
  clothing: `each person wears out ${WANTS.clothingPerPerson} a year`,
  pottery: `each person breaks ${WANTS.potteryPerPerson} a year`,
  machines: `each worker who works with them wears out ${WANTS.machinesPerWorker} a year`,
  coal: `engines burn ${WANTS.fuelPerCrafter} for each crafter in works, and the cold ${WANTS.heatPerPerson} a person`,
  oil: `engines burn ${WANTS.fuelPerCrafter} for each crafter in works`,
};

function recipeWords(r: Recipe): Line {
  const ins = r.inputs.map(([g, n]) => `${n} ${GOODS[g]!.name}`);
  return [
    `${r.name}: `,
    ins.length ? `${ins.join(" and ")} into ` : "",
    `${r.output[1]} ${GOODS[r.output[0]]!.name} a crafter-year`,
  ];
}

/** A good's page, the world over (`good:<id>`). */
export function goodKindPage(world: World, ref: string): PageModel {
  const id = ref.slice(ref.indexOf(":") + 1),
    gi = GOODS.findIndex((x) => x.id === id);
  if (gi < 0) throw new Error(`no good ${ref}`);
  const g = GOODS[gi]!,
    m = GOOD_MATTER[g.id]!,
    markets = world.store<MarketStore>("economy.markets").all(),
    stock = markets.reduce((s, x) => s + x.stock[gi]!, 0),
    holders = markets
      .filter((x) => x.stock[gi]! > 0)
      .sort((a, b) => b.stock[gi]! - a.stock[gi]! || a.cell - b.cell),
    recipes = RECIPES.filter((r) => r.output[0] === gi);
  const blocks: Block[] = [
    {
      type: "facts",
      rows: [
        stat("A unit", `${weight(m.unitKg)}${g.food ? ": a person's food for a month" : ""}`),
        stat("Worth", `${g.value} grain a unit`),
        stat("Spoils", g.spoil ? `${share(g.spoil)} of a store a month` : "never"),
        stat("To carry", `${g.bulk} as heavy as grain`),
        ...(WEARS[g.id] ? [stat("Worn out", WEARS[g.id]!)] : []),
      ],
    },
    ...m.ways.map((w) =>
      makeUpBlock(
        w.parts,
        m.unitKg,
        m.ways.length > 1 ? `A unit, as ${w.name}` : "What a unit is made of",
      ),
    ),
  ];
  const tabs: Tab[] = [{ id: "overview", name: "Overview", blocks }];
  if (recipes.length)
    tabs.push({
      id: "making",
      name: "How it is made",
      blocks: [
        {
          type: "list",
          title: "The ways it is made",
          items: recipes.map((r) => {
            const rx = REACTIONS.find((x) => x.recipe === r.id);
            return item([...recipeWords(r), ...(rx ? [" — ", link(rx.name, rxnRef(rx.id))] : [])]);
          }),
        },
      ],
    });
  tabs.push({
    id: "holders",
    name: "Who holds it",
    blocks: [
      {
        type: "list",
        title: `The world holds ${count(stock)} units (${weight(stock * m.unitKg)})`,
        items: holders
          .slice(0, 15)
          .map((x) =>
            item([landLink(world, x.cell), ` — ${count(x.stock[gi]!)}`], `mkt:${x.cell}:${gi}`),
          ),
        ...(holders.length > 15 ? { more: holders.length - 15 } : {}),
      },
    ],
  });
  return {
    ref,
    kind: "goods",
    icon: GOOD_ICON[g.id] ?? "📦",
    title: cap(g.name),
    subtitle: ["A good, the world over"],
    color: null,
    place: null,
    stats: [
      stat("A unit", weight(m.unitKg)),
      stat("Worth", `${g.value} grain`),
      stat("The world holds", count(stock)),
    ],
    tabs,
    followable: false,
    year: yearNow(world),
  };
}

/** The way a good is made in a land, as matter: tools by its metal, clothing by what it can make. */
export function goodHere(world: World, cell: number, goodId: string): MakeUp {
  const m = GOOD_MATTER[goodId]!,
    ctx = populationContext(world),
    way = (id: string) => m.ways.find((w) => w.id === id) ?? m.ways[0]!;
  if (goodId === "tools") return way(toolMetal(ctx, cell));
  if (goodId === "machines") return way(loreOf(world).get(cell, "steel") ? "steel" : "iron");
  if (goodId === "clothing") {
    const market = world.store<MarketStore>("economy.markets").get(cell);
    if (!market) return way("woven");
    const weaving = RECIPES.find((r) => r.id === "weaving")!,
      open = whyNot(ctx, cell, market, weaving) === null;
    return way(open ? "woven" : "leather");
  }
  return m.ways[0]!;
}

/** How a good is made in a land: each recipe for it, open (✓) or why not. */
export function howMadeHere(world: World, cell: number, goodId: string): Item[] {
  const gi = GOODS.findIndex((x) => x.id === goodId),
    ctx = populationContext(world),
    market = world.store<MarketStore>("economy.markets").get(cell);
  if (!market) return [];
  return RECIPES.filter((r) => r.output[0] === gi).map((r) => {
    const no = whyNot(ctx, cell, market, r),
      rx = REACTIONS.find((x) => x.recipe === r.id);
    return item([
      no ? "✗ " : "✓ ",
      ...recipeWords(r),
      ...(no ? [` — not here: ${no}`] : []),
      ...(rx ? [" · ", link(rx.name, rxnRef(rx.id))] : []),
    ]);
  });
}

/** The kinds of matter, in the order the field guide tells them. */
const KIND_ORDER: readonly MatterKind[] = [
  "metal",
  "ore",
  "mineral",
  "fuel",
  "made",
  "food",
  "living",
  "water",
  "gas",
];
const KIND_TITLE: Readonly<Record<MatterKind, string>> = {
  metal: "Metals",
  ore: "Ores",
  mineral: "Minerals",
  fuel: "Fuels",
  made: "Made by hand and fire",
  food: "What food is made of",
  living: "The stuff of living things",
  water: "Water",
  gas: "The air's gases",
};

/**
 * A world's ore in words: its name (a link to its mineral), its role, its words, and the reaction
 * that smelts it, at what heat.
 */
function oreItem(chem: Chemistry, kind: string, ore: Ore): Item {
  const ref = substRef(ore.mineral),
    smelt = findReaction(ore.smelt)!;
  return item(
    [
      link(cap(ore.name), ref),
      ` (${roleWord(chem, kind)}) — ${ore.words}; `,
      link(smelt.name, rxnRef(ore.smelt)),
      ` at ${count(reductionHeat(ore))} °C`,
    ],
    ref,
  );
}

/**
 * The "This world" tab (Phase 54 C4), on a world not of the Sun's chemistry: what it is made of,
 * its air, its crust against Earth's, its rocks and the edges they give, its ores, its metals, its
 * furnaces, and (where it has a people) the names they give what they work.
 */
function worldBlocks(world: World, chem: Chemistry): Block[] {
  const g = homePlanet(world).generated,
    star = g.star,
    nativeIron = nativeIronLands(g).size > 0,
    table = oresOn(chem),
    // A kind's ores on this world; the native iron's only where native iron lies.
    lies = (kind: string): Ore[] =>
      Object.entries(table[kind] ?? {}).flatMap(([lie, ore]) =>
        ore && (lie !== "telluric" || nativeIron) ? [ore] : [],
      ),
    // Each stone once by its name (lydite is one stone whatever its rock).
    stones: Stone[] = [];
  for (const s of Object.values(stonesFor(chem)))
    if (!stones.some((x) => x.name === s.name)) stones.push(s);
  const blocks: Block[] = [
    {
      type: "facts",
      title: "What this world is made of",
      rows: [
        stat(
          "Its star",
          `${count(star.temperature)} K, ${starAgeGyr(star).toFixed(1)} billion years old`,
        ),
        stat("Metals", `${signed(chem.feH)} against the Sun: ${CLASS_WORDS.metals[chem.metals]}`),
        stat("Carbon to oxygen", `${chem.cO.toFixed(2)}: ${CLASS_WORDS.carbon[chem.carbon]}`),
        stat("Magnesium to silicon", `${chem.mgSi.toFixed(2)}: ${CLASS_WORDS.silica[chem.silica]}`),
        stat("Oxygen", `${(chem.o2 * 100).toFixed(1)}% of the air: ${CLASS_WORDS.air[chem.air]}`),
        stat("Its ground", CLASS_WORDS.redox[chem.redox]),
        stat("Its hardener", roleWord(chem, "tin")),
      ],
    },
    airBlock(world),
    {
      type: "table",
      title: "Its crust, against Earth's",
      columns: ["Element", "Here (ppm)", "Earth (ppm)"],
      rows: crustOf(chem).map((r) => ({
        cells: [[`${cap(r.name)} (${r.symbol})`], [ppmWords(r.ppm)], [ppmWords(r.earth)]],
        keys: [r.name, r.ppm, r.earth],
      })),
    },
    {
      type: "list",
      title: "Its rocks",
      items: worldRocks(chem).map((r) => item([`${cap(r.name)} — ${r.words}`])),
    },
    {
      type: "list",
      title: "Its stones",
      items: stones.map((s) => {
        const ref = s.subst ? substRef(s.subst) : null;
        return item(
          [link(cap(s.name), ref), ` — ${s.from}; keen ${edge(s.keen)}, tough ${edge(s.tough)}`],
          ref,
        );
      }),
    },
    {
      type: "list",
      title: "Its ores",
      items: [
        ...lies("copper").map((o) => oreItem(chem, "copper", o)),
        // (A nickel world's copper, hardened with arsenic where its garnierite will not smelt.)
        ...(arsenicalFallback(chem) ? [oreItem(chem, "copper", ARSENICAL_ORE)] : []),
        ...lies("tin").map((o) => oreItem(chem, "tin", o)),
        ...lies("iron").map((o) => oreItem(chem, "iron", o)),
      ],
    },
    {
      type: "list",
      title: "Its metals",
      items: [
        metalOf(chem, "copper"),
        metalOf(chem, "bronze"),
        metalOf(chem, "iron"),
        metalOf(chem, "steel"),
        ...(table.iron?.bog ? [metalOf(chem, "bog iron")] : []),
        ...(nativeIron ? [metalOf(chem, "iron", { lie: "telluric" })] : []),
      ].map((m) => {
        const ref = substRef(m.subst);
        return item(
          [link(cap(m.name), ref), ` — keen ${edge(m.stuff.keen)}, tough ${edge(m.stuff.tough)}`],
          ref,
        );
      }),
    },
    {
      type: "table",
      title: "Its furnaces",
      columns: ["Furnace", "Heat here", "Comes with"],
      rows: FURNACES.map((f) => {
        const heat = f.heat + AIR_OFFSET[chem.air];
        return {
          cells: [
            [cap(f.name)],
            [`${count(heat)} °C`],
            f.by ? [link(principle(f.by).name, prinRef(f.by))] : ["nothing: known from the first"],
          ],
          keys: [f.name, heat],
        };
      }),
    },
  ];
  if (g.life.people) {
    // The people's own words: the same tongue names each thing, whatever it is called here.
    const t = cradleTongue(populationContext(world).culture),
      called = (id: string) =>
        tongueName({ ...t, seed: t.seed ^ 0x6d61 }, hashString("called " + id) >>> 0).toLowerCase(),
      said = (english: string, id: string, ref: string | null): Item =>
        item([link(cap(english), ref), ` — they call it ${called(id)}`], ref);
    const named: Item[] = [said(roleWord(chem, "tin"), chem.hardener, substRef(chem.hardener))],
      surface = table.copper?.surface,
      bog = table.iron?.bog,
      stone = usualStone(chem);
    if (surface) named.push(said(surface.name, surface.mineral, substRef(surface.mineral)));
    if (bog) named.push(said(bog.name, bog.mineral, substRef(bog.mineral)));
    named.push(
      said(stone.name, stone.subst ?? stone.name, stone.subst ? substRef(stone.subst) : null),
    );
    blocks.push({ type: "list", title: "In their own words", items: named });
  }
  return blocks;
}

/**
 * The field guide to matter (`world:matter`, Phase 15, after Classic's): every substance by
 * its kind, every reaction with what goes in and comes out, every element — each a page. A world
 * of another chemistry lists its own (Phase 54), and tells what it is made of in "This world".
 */
export function matterGuidePage(world: World, tab?: string): PageModel {
  const chem = chemOf(world),
    subs = substancesOn(chem),
    rxns = reactionsOn(chem),
    els = elementsOn(chem);
  const substances: Block[] = KIND_ORDER.map((k) => ({
      type: "list" as const,
      title: KIND_TITLE[k],
      items: subs
        .filter((s) => s.kind === k)
        .map((s) => item([link(cap(s.name), substRef(s.id)), ` — ${s.written}`], substRef(s.id))),
    })),
    reactions: Block = {
      type: "list",
      title: "What turns into what",
      items: rxns.map((r) =>
        item([link(cap(r.name), rxnRef(r.id)), " — ", ...equation(r)], rxnRef(r.id)),
      ),
    },
    elements: Block = {
      type: "table",
      title: "The elements",
      columns: ["Element", "Symbol", "A mole weighs"],
      rows: els.map((e) => ({
        cells: [[cap(e.name)], [e.symbol], [`${e.mass} g`]],
        keys: [e.name, e.symbol, e.mass],
      })),
    };
  return {
    ref: "world:matter",
    kind: "matter",
    icon: "🧪",
    title: "Matter",
    subtitle: ["What everything in the world is made of, and what turns into what"],
    color: null,
    place: null,
    stats: [
      stat("Substances", count(subs.length)),
      stat("Reactions", count(rxns.length)),
      stat("Elements", count(els.length)),
    ],
    tabs: [
      { id: "substances", name: "Substances", blocks: substances },
      { id: "reactions", name: "Reactions", blocks: [reactions] },
      { id: "elements", name: "Elements", blocks: [elements] },
      ...(chem.solar
        ? []
        : [{ id: "world", name: "This world", blocks: worldBlocks(world, chem) }]),
    ],
    ...(tab ? { tab } : {}),
    followable: false,
    year: yearNow(world),
  };
}
