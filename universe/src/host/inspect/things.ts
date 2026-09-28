// A household's and a person's things (Phase 15 M125, Classic's person inventory and its
// artifact pages): what each of the people met holds — the tools of their trade, the clothes
// they wear — and what their household keeps: its pots and its food; what a person eats in a
// day, and what their body is made of. Watched, not kept: a pure function of the household,
// its people and its land's history, never read by the simulation and never in the world's
// hash. Each thing was made in a year and wears out over its good's life, and then the next is
// made — a tool of the metal its land knew that year; where the land's crafters could not make
// enough, a slot is empty, and its page says why.
import {
  FEMALE,
  FOODS,
  GOODS,
  GOOD_MATTER,
  HOME_MADE,
  KCAL,
  OCC,
  REACTIONS,
  WANTS,
  bodyMakeUp,
  type MakeUp,
} from "../../rules/index.ts";
import { hashString, type Ref, type World } from "../../kernel/index.ts";
import {
  agentName,
  handOf,
  lifeOf,
  loreOf,
  populationContext,
  toolMetal,
  type Agent,
  type MarketStore,
  type Window,
} from "../../sim/index.ts";
import { observer, type Household, type Person } from "../../causal/index.ts";
import type { Block, Item, PageModel } from "../../bridge/index.ts";
import { count, item, link, share, stat, yearNow } from "./words.ts";
import { landLink, landTitle } from "./names.ts";
import { goodHere, makeUpBlock, prinRef, rxnRef, substRef, weight } from "./matter.ts";

/** The tools each trade that wears them out works with, and what each weighs (kg). */
const TOOLS: Readonly<Partial<Record<number, readonly (readonly [string, number])[]>>> = {
  [OCC.farmer]: [
    ["hoe", 1.5],
    ["sickle", 0.6],
  ],
  [OCC.herder]: [
    ["shears", 0.4],
    ["knife", 0.3],
  ],
  [OCC.crafter]: [
    ["hammer", 1],
    ["chisel", 0.3],
  ],
};

/** Whoever holds things: a person met, or one of the people under the hand (`agent:<id>`). */
export type Holder = Pick<Person, "ref" | "occupation" | "sex" | "birthYear" | "cell" | "alive">;

/** One of the people under the hand, as a holder of things. */
export function agentHolder(w: Window, a: Agent): Holder {
  return {
    ref: `agent:${a.id}` as Ref,
    occupation: a.occupation,
    sex: a.sex,
    birthYear: a.birthYear,
    cell: w.cell,
    alive: true,
  };
}

/** What a thing is: a tool of a trade, a garment, a pot. */
export type Thing = {
  readonly ref: string;
  readonly holder: string;
  readonly slot: string;
  readonly good: "tools" | "clothing" | "pottery";
  readonly name: string;
  readonly way: MakeUp;
  readonly kg: number;
  /** The year it was made (null: there is none — the land's crafters fell short). */
  readonly made: number | null;
  /** The years it lasts. */
  readonly life: number;
  readonly cell: number;
  readonly homeMade: boolean;
  /** Why there is none (null: there is one). */
  readonly missing: string | null;
};

/** A keyed share (0 … 1) of words: the same words, the same share. */
const keyed = (words: string) => (hashString(words, 0x7a11) >>> 0) / 2 ** 32;

/** How much of a good its land had of what it wanted last year (0 … 1). */
function cover(world: World, cell: number, good: Thing["good"]): number {
  const m = world.store<MarketStore>("economy.markets").get(cell);
  if (!m) return 1;
  const c = good === "tools" ? m.toolCover : good === "clothing" ? m.clothingCover : m.potteryCover;
  return Math.min(1, c / 1000);
}

/** The share of a good its households make for themselves, by the recipe it is made by. */
function homeShare(good: Thing["good"], way: string): number {
  const recipe =
    good === "tools" && way === "stone"
      ? "stone-tools"
      : good === "clothing" && way === "leather"
        ? "leatherwork"
        : good === "pottery"
          ? "pottery"
          : null;
  return HOME_MADE.find((h) => h.recipe === recipe)?.share ?? 0;
}

/** One thing in a slot: the one made last in its turn, its make-up, or why there is none. */
function slotThing(
  world: World,
  holder: string,
  slot: string,
  good: Thing["good"],
  kg: number,
  life: number,
  cell: number,
  name: (way: MakeUp) => string,
): Thing {
  const now = yearNow(world),
    phase = keyed(`${holder}:${slot}`) * life,
    made = Math.floor(phase + Math.floor((now - phase) / life) * life),
    ctx = populationContext(world),
    way =
      good === "tools"
        ? GOOD_MATTER.tools!.ways.find((w) => w.id === toolMetal(ctx, cell, made))!
        : goodHere(world, cell, good),
    had = cover(world, cell, good),
    short = had < 1 && keyed(`${holder}:${slot}:short`) > had,
    homeMade = keyed(`${holder}:${slot}:home`) < homeShare(good, way.id),
    goodName = GOODS.find((g) => g.id === good)!.name;
  return {
    ref: `thing:${holder}:${slot}`,
    holder,
    slot,
    good,
    name: name(way),
    way,
    kg,
    made: short ? null : made,
    life,
    cell,
    homeMade,
    missing: short
      ? `none: ${landTitle(world, cell)} had ${share(had)} of the ${goodName} it wanted last year`
      : null,
  };
}

/** What a person holds: the tools of their trade (if it wears them), and what they wear. */
export function personThings(world: World, p: Holder): Thing[] {
  if (!p.alive) return [];
  const ctx = populationContext(world),
    cell = p.cell,
    cold = (ctx.generated.climate.temperature[cell] ?? 15) < 5,
    tools = TOOLS[p.occupation] ?? [],
    out: Thing[] = [];
  for (const [slot, kg] of tools)
    out.push(
      slotThing(world, p.ref, slot, "tools", kg, tools.length / WANTS.toolsPerWorker, cell, (w) =>
        w.id === "stone" ? `a flint ${slot}` : `a ${w.id} ${slot}`,
      ),
    );
  // (In the cold, a cloak besides; each garment then lasts the longer.)
  const garments: [string, number][] = cold
      ? [
          ["tunic", 1.2],
          ["cloak", 2],
        ]
      : [["tunic", 1.2]],
    wears = garments.length / WANTS.clothingPerPerson;
  for (const [slot, kg] of garments)
    out.push(
      slotThing(world, p.ref, slot, "clothing", kg, wears, cell, (w) =>
        w.id === "leather" ? `a leather ${slot}` : `a woven wool ${slot}`,
      ),
    );
  return out;
}

/** What a household keeps: a pot for each of its people, jars besides. */
export function householdThings(world: World, h: Household): Thing[] {
  const ledger = observer(world),
    alive = h.members.filter((m) => ledger.person(m)?.alive).length,
    pots = Math.max(1, alive),
    life = pots / (WANTS.potteryPerPerson * Math.max(1, alive));
  return Array.from({ length: pots }, (_, i) =>
    slotThing(world, h.ref, `pot${i + 1}`, "pottery", i % 2 ? 5 : 3, life, h.cell, () =>
      i % 2 ? "a storage jar" : "a cooking pot",
    ),
  );
}

/** A household's food in store: its share of its land's, by what each food is made of. */
function foodStore(
  world: World,
  h: Household,
): { units: number; kg: number; parts: [string, number][] } {
  const ledger = observer(world),
    alive = h.members.filter((m) => ledger.person(m)?.alive).length,
    m = world.store<MarketStore>("economy.markets").get(h.cell),
    people = populationContext(world).provinces.get(h.cell)?.total() ?? 0;
  if (!m || !people || !alive) return { units: 0, kg: 0, parts: [] };
  const out = new Map<string, number>();
  let units = 0,
    kg = 0;
  for (const f of FOODS) {
    const u = (m.stock[f]! / people) * alive,
      good = GOODS[f]!,
      w = u * GOOD_MATTER[good.id]!.unitKg;
    units += u;
    kg += w;
    for (const [s, k] of GOOD_MATTER[good.id]!.ways[0]!.parts)
      out.set(s, (out.get(s) ?? 0) + w * k);
  }
  return { units, kg, parts: [...out].map(([s, w]) => [s, kg ? w / kg : 0] as [string, number]) };
}

/** What things are made of, summed by weight. */
function thingsMakeUp(things: readonly Thing[]): { kg: number; parts: [string, number][] } {
  const out = new Map<string, number>();
  let kg = 0;
  for (const t of things) {
    if (t.made === null) continue;
    kg += t.kg;
    for (const [s, k] of t.way.parts) out.set(s, (out.get(s) ?? 0) + t.kg * k);
  }
  return { kg, parts: [...out].map(([s, w]) => [s, kg ? w / kg : 0] as [string, number]) };
}

function thingItem(t: Thing): Item {
  return item(
    [
      link(t.name, t.ref),
      t.made === null ? ` — ${t.missing}` : ` — made in year ${t.made}, ${weight(t.kg)}`,
    ],
    t.ref,
  );
}

/** A household's Things tab: its pots, each of its people's things, its store of food. */
export function householdThingsBlocks(world: World, h: Household): Block[] {
  const ledger = observer(world),
    pots = householdThings(world, h),
    people = h.members.map((m) => ledger.person(m)).filter((p): p is Person => !!p?.alive),
    theirs = people.flatMap((p) => personThings(world, p)),
    all = [...pots, ...theirs],
    made = thingsMakeUp(all),
    food = foodStore(world, h);
  const blocks: Block[] = [
    { type: "list", title: "What it keeps", items: pots.map(thingItem) },
    ...people.map((p): Block => ({
      type: "list",
      title: `What ${p.name} holds`,
      items: personThings(world, p).map(thingItem),
    })),
  ];
  if (made.kg) blocks.push(makeUpBlock(made.parts, made.kg, "What its things are made of"));
  if (food.units)
    blocks.push(
      makeUpBlock(
        food.parts,
        food.kg,
        "Its store of food",
        `${food.units.toFixed(1)} months of food for its ${people.length} (${weight(food.kg)}): its share of what its land has put by.`,
      ),
    );
  return blocks;
}

/** A person's body weight now: their people's, grown to it from birth. */
function bodyKg(world: World, p: Holder): number {
  const b = populationContext(world).generated.life.people?.body,
    size = b?.size ?? 65,
    adult = lifeOf(world).adulthood,
    age = Math.max(0, yearNow(world) - p.birthYear),
    grown = Math.min(1, 0.06 + 0.94 * Math.pow(Math.min(1, age / Math.max(1, adult)), 1.2));
  return size * (p.sex === FEMALE ? 0.9 : 1.05) * grown;
}

/** A person's Things tab: what they hold, what they eat in a day, what their body is made of. */
export function personThingsBlocks(world: World, p: Holder): Block[] {
  const things = personThings(world, p),
    made = thingsMakeUp(things),
    blocks: Block[] = [];
  if (things.length)
    blocks.push({ type: "list", title: "What they hold", items: things.map(thingItem) });
  if (made.kg) blocks.push(makeUpBlock(made.parts, made.kg, "What their things are made of"));
  if (!p.alive) return blocks;
  // A day's food: a unit a month, in the land's mix of foods, and its energy against their need.
  const m = world.store<MarketStore>("economy.markets").get(p.cell),
    total = m ? FOODS.reduce((s, f) => s + m.stock[f]!, 0) : 0,
    day = new Map<string, number>();
  let kg = 0;
  if (m && total)
    for (const f of FOODS) {
      const good = GOODS[f]!,
        k = (m.stock[f]! / total) * (GOOD_MATTER[good.id]!.unitKg / 30);
      kg += k;
      for (const [s, x] of GOOD_MATTER[good.id]!.ways[0]!.parts)
        day.set(s, (day.get(s) ?? 0) + k * x);
    }
  if (kg) {
    const kcal = [...day].reduce((s, [sub, k]) => s + k * 1000 * (KCAL[sub] ?? 0), 0),
      body = bodyKg(world, p),
      need = 2400 * Math.pow(body / 65, 0.75);
    blocks.push(
      makeUpBlock(
        [...day].map(([s, k]) => [s, k / kg] as [string, number]),
        kg,
        "What they eat in a day",
        `${weight(kg)} of food, about ${count(kcal)} kcal, against the ${count(need)} kcal a body of ${weight(body)} burns in a day.`,
      ),
    );
  }
  const body = populationContext(world).generated.life.people?.body,
    kgBody = bodyKg(world, p);
  blocks.push(
    makeUpBlock(
      bodyMakeUp(p.sex === FEMALE, body?.skin ?? "skin", body?.warm ?? true),
      kgBody,
      "What their body is made of",
      `${weight(kgBody)}, as their people's bodies go at their age.`,
    ),
  );
  return blocks;
}

/** Where a thing's stuff comes from: its metal's ore, the reaction, the principle that taught it. */
function chainOf(t: Thing): Item[] {
  const main = t.way.parts[0]![0],
    makes = REACTIONS.filter((r) => r.outputs[0]![0] === main && r.principle !== "cultivation"),
    out: Item[] = [];
  for (const r of makes.slice(0, 2)) {
    const ins = r.inputs.map(([s]) => s).filter((s) => s !== "oxygen");
    out.push(
      item([
        link(ins.join(" and ").replace(/-/g, " "), substRef(ins[0]!)),
        " → ",
        link(r.name, rxnRef(r.id)),
        ...(r.principle
          ? [", taught by ", link(r.principle.replace(/-/g, " "), prinRef(r.principle))]
          : []),
      ]),
    );
  }
  return out;
}

/** A thing's page (`thing:<holder>:<slot>`): what it is, what it is made of, where, when and by whom, how worn. */
export function thingPage(world: World, ref: string): PageModel {
  const rest = ref.slice("thing:".length),
    at = rest.lastIndexOf(":"),
    holder = rest.slice(0, at),
    slot = rest.slice(at + 1),
    ledger = observer(world),
    person = holder.startsWith("prsn:") ? ledger.person(holder as Ref) : undefined,
    house = holder.startsWith("hhold:") ? ledger.household(holder as Ref) : undefined,
    // (One of the people under the hand holds things as a person met does.)
    hand = handOf(world).resting,
    agent = holder.startsWith("agent:")
      ? hand?.agents.find((a) => `agent:${a.id}` === holder)
      : undefined,
    list = person
      ? personThings(world, person)
      : house
        ? householdThings(world, house)
        : agent && hand
          ? personThings(world, agentHolder(hand, agent))
          : [],
    t = list.find((x) => x.slot === slot);
  if (!t) throw new Error(`no thing ${ref}`);
  const now = yearNow(world),
    worn = t.made === null ? 0 : Math.min(1, (now - t.made) / t.life),
    by = person
      ? [link(`${person.name} ${person.surname}`, person.ref)]
      : house
        ? [link(`the ${house.surname} household`, house.ref)]
        : agent && hand
          ? [
              link(
                agentName(
                  populationContext(world),
                  agent,
                  populationContext(world).settlements.get(hand.village)!,
                ),
                holder,
              ),
            ]
          : [],
    known =
      t.good === "tools" && t.way.id !== "stone" ? loreOf(world).get(t.cell, t.way.id) : undefined;
  const blocks: Block[] =
    t.made === null
      ? [{ type: "text", lines: [[`There is ${t.missing}.`]] }]
      : [
          makeUpBlock(t.way.parts, t.kg, `What it is made of: ${t.way.name}`),
          {
            type: "facts",
            rows: [
              stat("Made in", [landLink(world, t.cell)]),
              stat("In the year", `${t.made}`),
              stat(
                "By",
                t.homeMade ? "its household, at home" : `a crafter of ${landTitle(world, t.cell)}`,
              ),
              stat("It lasts", `${t.life.toFixed(t.life < 10 ? 1 : 0)} years`),
              stat(
                "Worn",
                `${Math.round(worn * 100)}% (${Math.max(0, now - t.made)} of its ${Math.round(t.life)} years)`,
              ),
              ...(known ? [stat("Its metal known there since", `year ${known.year}`)] : []),
            ],
          },
          { type: "list", title: "Where its stuff comes from", items: chainOf(t) },
        ];
  return {
    ref,
    kind: "thing",
    icon: t.good === "tools" ? "🔨" : t.good === "clothing" ? "👕" : "🏺",
    title: t.name[0]!.toUpperCase() + t.name.slice(1),
    subtitle: [house ? "Kept by " : "Held by ", ...by],
    color: null,
    place: null,
    stats:
      t.made === null
        ? [stat("There is", "none")]
        : [stat("Made", `year ${t.made}`), stat("Weighs", weight(t.kg)), stat("Worn", share(worn))],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year: now,
  };
}
