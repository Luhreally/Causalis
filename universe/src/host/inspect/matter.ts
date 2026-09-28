// Matter's pages (Phase 15 M122, asked for 2026-09-28: Classic's detail — "it breaks down
// inventory and chemistry"): a substance (what it is, its elements, its properties, where it
// lies in this world, what it becomes and what makes it, the goods that hold it); a reaction
// (what goes in and comes out by weight, its heat and fuel, what teaches it and who knows it);
// a principle (what it needs, what drives its finding, what it changes, the reactions it
// teaches, the lands that know it); a good (a unit's weight, what it is made of each way it is
// made, how it is made and what wears it out, the world's stock and who holds it). And a good
// in a land: what it is made of there, and how it is made there — or why it is not. Pure reads.
import {
  EFFECTS,
  ELEMENTS,
  GOODS,
  GOOD_MATTER,
  PRINCIPLES,
  REACTIONS,
  RECIPES,
  SUBSTANCE,
  SUBSTANCES,
  WANTS,
  elementShares,
  molarMass,
  principle,
  reactionKg,
  type MakeUp,
  type MatterKind,
  type Principle,
  type Recipe,
  type Substance,
} from "../../rules/index.ts";
import { yearOfMoment, type World } from "../../kernel/index.ts";
import {
  homePlanet,
  loreOf,
  populationContext,
  toolMetal,
  whyNot,
  type MarketStore,
} from "../../sim/index.ts";
import { isProvinceWorld } from "../../gen/index.ts";
import type { Block, Item, Line, PageModel, Tab } from "../../bridge/index.ts";
import { count, item, link, share, stat, yearNow } from "./words.ts";
import { landLink, landTitle } from "./names.ts";

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

const substanceOf = (id: string): Substance => SUBSTANCES[SUBSTANCE[id]!]!;
/** A land's title within a sentence ("the alpine at …", not "The alpine at …"). */
const inWords = (title: string) => (title.startsWith("The ") ? `the ${title.slice(4)}` : title);
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

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
      const el = ELEMENTS.find((x) => x.symbol === e)!;
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

/** Where a substance lies in this world: the deposits that hold it, richest first. */
function whereItLies(world: World, id: string): { items: Item[]; more: number } {
  const g = homePlanet(world).generated,
    fine = isProvinceWorld(g) ? g.fine : g,
    landOf = (spot: number) => (isProvinceWorld(g) ? g.provinceOf[spot]! : spot),
    kinds = Object.entries(DEPOSIT_MINERALS)
      .filter(([, ms]) => ms.includes(id))
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
            link(`${d.kind} in ${inWords(landTitle(world, landOf(d.cell)))}`, d.ref),
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
    i = SUBSTANCE[id];
  if (i === undefined) throw new Error(`no substance ${ref}`);
  const s = SUBSTANCES[i]!,
    mass = molarMass(s.formula),
    lies = whereItLies(world, id),
    becomes = REACTIONS.filter((r) => r.inputs.some(([x]) => x === id)),
    madeBy = REACTIONS.filter((r) => r.outputs.some(([x]) => x === id)),
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
    r = REACTIONS.find((x) => x.id === id);
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
    teaches = REACTIONS.filter((r) => r.principle === p.id),
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
