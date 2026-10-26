// Later arms traced (Phase 53): a machined arm and an armoured car traced to the works their machines
// came from and the oil that drives them; machines bought down a road; a trooper's arm in a battle as
// its realm armed it that day; and the army tab's line on machines. Reading any of it changes nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { cellRef } from "../../src/gen/index.ts";
import { G, principle, type Part } from "../../src/rules/index.ts";
import {
  LORE_EVENTS,
  fuelFor,
  loreOf,
  machinedFor,
  makePopulationWorld,
  marketsOf,
  politiesOf,
  populationContext,
  warsOf,
  type Polity,
} from "../../src/sim/index.ts";
import { armsMade, type Made } from "../../src/host/chain.ts";
import { armPage } from "../../src/host/inspect/arm.ts";
import { armyBlocks } from "../../src/host/inspect/army.ts";
import type { Block, Line, Stat } from "../../src/bridge/index.ts";

/** The principles of the later arms: the armoured car's last. */
const LATER = ["repeating-fire", "self-loading", "automatic-fire", "armoured-vehicles"];

/** A line in words: a link's text in place of the link. */
const text = (l: Line) => l.map((x) => (typeof x === "string" ? x : x.text)).join("");
/** A made thing's chain in words, a line each. */
const words = (made: Made | null) => (made ? made.chain.map(text).join(" | ") : "");
/** A part of a host, by its role, its realization and its stuff. */
const part = (role: Part["role"], id: string, material: Part["material"]): Part => ({
  role,
  id,
  material,
});
/** The rows of a block list's facts. */
const rows = (blocks: readonly Block[]): Stat[] =>
  blocks.flatMap((b) => (b.type === "facts" ? b.rows : []));

/** Teach a land principles outright (a fixture: the tree takes centuries to reach them). */
function teach(world: World, cell: number, list: string[]): void {
  const lore = loreOf(world);
  for (const id of list) {
    if (lore.get(cell, id)) continue;
    const event = world.events.emit({
      type: LORE_EVENTS.found.type,
      place: cellRef(0, cell),
      data: { principle: id },
    });
    lore.learn(cell, id, { year: Math.floor(world.now / YEAR), event }, principle(id));
  }
}

// The first light's world at year 80, and three of its realms of two lands or more.
const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(80 * YEAR);
const year = Math.floor(world.now / YEAR),
  ctx = populationContext(world),
  realms = politiesOf(world)
    .living()
    .filter((x) => x.members.length >= 2),
  p = realms[0]!,
  q = realms[1]!,
  s = realms[2]!;

test("a machined arm is traced to the works its machines came from, an armoured car to the oil that drives it", () => {
  assert.ok(realms.length >= 3, `${realms.length} realms of two lands or more`);
  teach(world, p.seat, [
    "bronze",
    "iron",
    "writing",
    "mathematics",
    "steel",
    "clockwork",
    "medicine",
    "gunpowder",
    "firearms",
    "rifling",
    ...LATER,
  ]);
  // Without works it can reach, its machined arms are still traced: from its seat.
  assert.equal(machinedFor(ctx, p), null);
  const seat = armsMade(world, p.ref, part("arm", "repeater", "machined"), year);
  assert.equal(seat?.stuff, "machined steel");
  assert.ok(!words(seat).includes("Bought from"));
  // Works in one of its lands, with machines made there.
  const land = [...p.members].sort((a, b) => a - b).at(-1)!,
    m = marketsOf(world).of(land),
    works = world.events.emit({ type: LORE_EVENTS.found.type, place: cellRef(0, land) }) as Ref;
  teach(world, land, ["steel"]);
  m.works = works;
  m.stock[G.machines] = 10;
  assert.equal(machinedFor(ctx, p), works);
  const repeater = armsMade(world, p.ref, part("arm", "repeater", "machined"), year),
    autoloader = armsMade(world, p.ref, part("arm", "autoloader", "machined"), year),
    armour = armsMade(world, p.ref, part("mount", "armoured", "machined"), year);
  assert.ok(repeater && autoloader && armour);
  assert.equal(repeater.stuff, "machined steel");
  const barrel = words(repeater);
  assert.match(barrel, /bored and rifled/);
  assert.match(barrel, /brass/);
  assert.match(barrel, /black powder/);
  assert.match(words(autoloader), /gun cotton/);
  assert.match(words(armour), /rolled steel/);
  assert.match(words(armour), /oil/);
  assert.ok(!barrel.includes("Bought from"), "its machines are its own works'");
  // Oil in store, drawn in the land's well.
  m.well = world.events.emit({ type: LORE_EVENTS.found.type, place: cellRef(0, land) }) as Ref;
  m.stock[G.oil] = 5;
  assert.equal(fuelFor(ctx, p), m.well);
  assert.match(
    words(armsMade(world, p.ref, part("mount", "armoured", "machined"), year)),
    /oil drawn in /,
  );
});

test("machines brought down a road are traced to the works they came from", () => {
  // Realm q has no works in its reach; its machines come down a road from a land of p.
  assert.equal(machinedFor(ctx, q), null);
  const from = [...p.members].sort((a, b) => a - b)[0]!,
    to = [...q.members].sort((a, b) => a - b)[0]!,
    road = world.events.emit({ type: LORE_EVENTS.found.type, place: cellRef(0, to) }) as Ref;
  marketsOf(world).openRoute(from, to, road);
  marketsOf(world).flows.push({ from, to, good: G.machines, count: 1 });
  assert.equal(machinedFor(ctx, q), road);
  const bought = armsMade(world, q.ref, part("arm", "autoloader", "machined"), year);
  assert.match(words(bought), /Bought from the works of .+, brought down the road$/);
});

test("the army tab tells where a realm's machined arms are cut, bought along a road, or nowhere it can reach", () => {
  const machined = (r: Polity) => rows(armyBlocks(world, r)).find((x) => x.label === "Machined");
  // (Only a realm whose seat knows the repeating fire has the line.)
  assert.equal(machined(s), undefined);
  teach(world, s.seat, ["repeating-fire"]);
  teach(world, q.seat, ["repeating-fire"]);
  teach(world, p.seat, ["repeating-fire"]);
  assert.equal(machinedFor(ctx, s), null, "nothing reaches it");
  assert.equal(
    text(machined(s)!.value),
    "nothing: none of its lands can cut a bolt, so it arms as it can",
  );
  assert.ok(text(machined(p)!.value).startsWith("at "), text(machined(p)!.value));
  assert.equal(text(machined(q)!.value), "bought along the road");
});

test("a trooper's arm in a battle is traced as its realm armed it that day", () => {
  const war = warsOf(world)
    .all()
    .find((w) => w.battles.length > 0);
  assert.ok(war, "a battle by year 80");
  const b = war.battles[0]!;
  for (const side of [0, 1]) {
    const page = armPage(world, `arm:${b.event}:${side}:3`);
    assert.match(page.title, / in the battle at /, page.title);
    // Its picture (Phase 54 M223) is a made thing's; a body's own arm has none.
    assert.ok(page.portrait === undefined || page.portrait.kind === "thing", page.title);
    const overview = page.tabs
      .find((t) => t.id === "overview")
      ?.blocks.find((x) => x.type === "list");
    assert.ok(overview && overview.type === "list" && overview.items.length >= 1, page.title);
  }
  assert.throws(() => armPage(world, `arm:${b.event}:2:3`));
});

test("reading the arms, a trooper's page and the army changes nothing", () => {
  const war = warsOf(world)
    .all()
    .find((w) => w.battles.length > 0)!;
  const before = JSON.stringify(world.domainHashes());
  armsMade(world, p.ref, part("arm", "repeater", "machined"), year);
  armsMade(world, q.ref, part("arm", "autoloader", "machined"), year);
  armsMade(world, p.ref, part("mount", "armoured", "machined"), year);
  for (const r of [p, q, s]) armyBlocks(world, r);
  armPage(world, `arm:${war.battles[0]!.event}:0:3`);
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
