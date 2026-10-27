// Phase 56: a world's kind told. Its field guide says what it is and why, and that no furnace can be
// built where nothing burns; a principle that wants fire says why it is shut there; its ages are its
// own; what is made says what it is made of and why (copper hammered cold at an anvil stone, a
// moissanite edge ground with diamond, a basket sealed with pitch); its land is told in true degrees
// and its seas by their liquid; and a world saved before its seed made another kind is kept as it
// was made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, loadWorld, rulesetId, saveWorld, seedFromText } from "../../src/kernel/index.ts";
import { ALIEN, seedLife, tile } from "../../src/host/planet.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { stageOf } from "../../src/host/inspect/stage.ts";
import { loadKept } from "../../src/host/host.ts";
import { potMade, toolMade } from "../../src/host/chain.ts";
import { landEra, villagePlan } from "../../src/host/village.ts";
import { generateHomeWorld, planetRef, worldKindOf } from "../../src/gen/index.ts";
import { KINDS, OPEN, keptRocky } from "../../src/rules/index.ts";
import { homePlanet, knows, oreWithin, populationContext } from "../../src/sim/index.ts";
import type { Block, Line, PageModel, Span } from "../../src/bridge/index.ts";

const words = (l: Line | string): string =>
  typeof l === "string" ? l : l.map((s: Span) => (typeof s === "string" ? s : s.text)).join("");

/** A page's block of a type and title, on any of its tabs. */
function block<K extends Block["type"]>(
  p: PageModel,
  type: K,
  title: string,
): Extract<Block, { type: K }> {
  const b = p.tabs
    .flatMap((t) => t.blocks)
    .find((x) => x.type === type && "title" in x && x.title === title);
  assert.ok(b, `a ${type} titled "${title}"`);
  return b as Extract<Block, { type: K }>;
}

/** Each fact on a page, by its label (the first of each). */
function facts(p: PageModel): Map<string, string> {
  const out = new Map<string, string>();
  for (const b of p.tabs.flatMap((t) => t.blocks))
    if (b.type === "facts")
      for (const r of b.rows) if (!out.has(r.label)) out.set(r.label, words(r.value));
  return out;
}

const carbon = ALIEN.build(seedFromText("alien 20"));
carbon.runTo(150 * YEAR);
const ctx = populationContext(carbon),
  lands = ctx.provinces
    .all()
    .filter((p) => p.total() > 0)
    .sort((a, b) => b.total() - a.total() || a.cell - b.cell)
    .map((p) => p.cell);

test("a carbon world's field guide says what it is and why, and that no furnace can be built", () => {
  assert.equal(worldKindOf(homePlanet(carbon).generated), "carbon");
  const p = pageOf(carbon, "world:matter#world"),
    kind = block(p, "facts", "💎 A carbon world"),
    row = (label: string) => words(kind.rows.find((r) => r.label === label)!.value);
  assert.match(row("What made it"), /more carbon than oxygen/);
  assert.equal(row("Its seas"), "Oil, liquid from 0 °C to 100 °C under its air");
  assert.equal(row("What burns"), KINDS.carbon.fire);
  assert.match(row("Its bedrock"), /^Carbide and graphite/);
  assert.deepEqual(block(p, "text", "Its furnaces").lines.map(words), [
    "None: nothing burns in its air, so no furnace can be built.",
  ]);
  const metals = block(p, "list", "Its metals").items.map((i) => words(i.line));
  assert.ok(
    metals.some((m) => /carbide iron/i.test(m)),
    metals.join(" | "),
  );
  assert.ok(!metals.some((m) => /bronze/i.test(m)), metals.join(" | "));
  // (Its air: carbon monoxide a tenth of it, almost no oxygen.)
  const gases = new Map(
    block(p, "composition", "The air (by volume)").parts.map((x) => [words(x.name), x.share]),
  );
  assert.ok(Math.abs(gases.get("carbon monoxide")! - 0.1) < 0.005, `${[...gases]}`);
  assert.ok(gases.get("oxygen")! < 0.001);
  const air = block(p, "list", "Its air and seas are made of").items.map((i) => i.ref);
  assert.ok(air.includes("subst:carbon-monoxide") && air.includes("subst:diamond"), `${air}`);
  // The home world's own page says so too.
  assert.ok(
    pageOf(carbon, planetRef(0))
      .tabs.flatMap((t) => t.blocks)
      .some((b) => "title" in b && b.title === "💎 A carbon world"),
  );
});

test("a principle that wants fire is shut where nothing burns, and says why", () => {
  assert.match(
    facts(pageOf(carbon, "prin:bronze")).get("On this world")!,
    /^shut: nothing burns in its air, so no furnace can be built\. Fuel is everywhere/,
  );
  assert.match(
    facts(pageOf(carbon, "prin:pottery-wheel")).get("On this world")!,
    /no kiln can be fired/,
  );
  assert.equal(facts(pageOf(carbon, "prin:cold-hammering")).get("On this world"), undefined);
  // (Its copper is worked cold: the root of metal is open on it, by its own name.)
  const root = pageOf(carbon, "prin:metalworking");
  assert.equal(root.title, "Working native copper cold");
  assert.equal(facts(root).get("On this world"), undefined);
  // Another kind's road is not this world's.
  assert.match(
    facts(pageOf(carbon, "prin:ice-working")).get("On this world")!,
    /^shut: known only on an ice-and-ammonia world or a methane world/,
  );
});

test("its ages are its own: diamond and copper in place of iron, and its lands in that age", () => {
  const stage = stageOf(carbon),
    metal = stage.stages.find((s) => s.id === "iron")!;
  assert.equal(metal.name, "Diamond and copper");
  assert.equal(metal.icon, "💎");
  assert.equal(metal.first, "💡 Native copper hammered cold");
  assert.ok(metal.year !== null && metal.year <= 150, `reached in ${metal.year}`);
  assert.equal(stage.stages.find((s) => s.id === "engines")!.name, "Sun engines");
  assert.ok(lands.some((c) => landEra(carbon, c) === "metal"));
});

test("what is made says what it is made of, and why: copper beaten cold, diamond, pitch", () => {
  // (Its lands that work copper, with native copper within reach.)
  const copper = lands.filter(
    (c) => knows(ctx, c, "metalworking") && oreWithin(ctx, c, "copper") !== null,
  );
  assert.ok(copper.length > 0, "some land works native copper within reach");
  let cold = 0;
  for (const cell of copper.slice(0, 8)) {
    const made = toolMade(carbon, cell, `alien:${cell}`, 150, false, null, undefined, "copper"),
      text = made.chain.map(words),
      shown = text.join(" | ");
    assert.ok(!text.some((l) => /smelted|furnace|hearth/i.test(l)), shown);
    if (
      text.some(
        (l) => l === "Hammered cold, on an anvil stone, never heated: nothing burns in its air",
      )
    )
      cold++;
    if (made.workshop.name !== "home") assert.match(made.workshop.name, /^a smith's anvil stone/);
  }
  assert.equal(cold, copper.slice(0, 8).length, "each one's copper is its own, hammered cold");
  assert.equal(
    facts(pageOf(carbon, "rxn:cold-hammer-copper")).get("Worked as"),
    "native copper hammered cold",
  );
  for (const cell of lands.slice(0, 8)) {
    const stone = toolMade(carbon, cell, `alien:${cell}`, 150, false, null, undefined, "stone")
      .chain.map(words)
      .join(" | ");
    assert.match(stone, /ground keen with diamond grit|diamond points in pitch/, stone);
    const pot = potMade(carbon, cell, `alien:${cell}`, 150, false),
      chain = pot.chain.map(words);
    assert.equal(pot.stuff, "pitch-sealed basket");
    assert.match(chain[0]!, /^Pitch, gathered where the oil seeps from the ground in /);
    assert.match(chain[1]!, /^Woven of reed and sealed inside and out with pitch/);
    assert.ok(!chain.some((l) => /fired|kiln|clay/i.test(l)), chain.join(" | "));
  }
});

test("a town's plan says its world's kind, and that nothing burns there", () => {
  const town = ctx.settlements.all()[0]!,
    plan = villagePlan(carbon, town.ref);
  assert.equal(plan.kind, "carbon");
  assert.equal(plan.fireless, true);
});

test("an ice world's land is told in true degrees, and its seas by their liquid", () => {
  const methane = ALIEN.build(seedFromText("alien 1429")),
    c = populationContext(methane),
    centre = c.provinces.all()[0]!.cell;
  let seas = 0;
  for (let t = 0; t < 64 * 64; t += 37) {
    let spot;
    try {
      spot = tile(methane, centre, t);
    } catch {
      break;
    }
    assert.ok(spot.temperature < -120 && spot.temperature > -230, `${spot.temperature} °C`);
    assert.ok(!/ocean|^sea ice$/.test(spot.biome ?? ""), spot.biome);
    if (/methane sea/.test(spot.biome ?? "")) seas++;
  }
  assert.ok(seas > 0, "its seas are methane");
  // Its air is nitrogen with methane; its carbon dioxide lies frozen as frost.
  const air = block(pageOf(methane, "world:matter#world"), "composition", "The air (by volume)"),
    gases = air.parts.map((x) => words(x.name));
  assert.ok(gases.includes("methane") && !gases.includes("carbon dioxide"), `${gases}`);
  assert.ok(!gases.includes("oxygen"));
  assert.match(air.note!, /frozen on the ground as frost/);
  // No metal is smelted on it: bronze keeps Earth's name, shut; so is the root of metal, its ice
  // holding no ore to work cold.
  const bronze = pageOf(methane, "prin:bronze");
  assert.equal(bronze.title, "Bronze");
  assert.match(facts(bronze).get("On this world")!, /^shut: nothing burns in its air/);
  assert.match(
    facts(pageOf(methane, "prin:metalworking")).get("On this world")!,
    /^shut: nothing burns in its air, so no furnace can be built, and no ore lies in its ice/,
  );
  // Its one metal fell from its sky, and in its cold breaks as glass does.
  const metals = block(pageOf(methane, "world:matter#world"), "list", "Its metals");
  assert.deepEqual(
    metals.items.map((i) => words(i.line)),
    ["Iron fallen from the sky — keen 0.6, tough 0.1"],
  );
});

test("the world a seed makes says its kind, and why no life took hold on it", () => {
  const life = (seed: string) => seedLife(generateHomeWorld(seedFromText(seed), OPEN)),
    barren = life("alien 34");
  assert.equal(barren.world?.kind, "🟠 a methane world");
  assert.equal(barren.words, KINDS.methane.life.barren);
  const rocky = life("alien 16");
  assert.ok(rocky.world && !("kind" in rocky.world));
});

test("a world saved before its seed made another kind is kept as it was made", () => {
  const seed = "alien 428",
    twin = ALIEN.build(seedFromText(keptRocky(seed)));
  twin.runTo(3 * YEAR);
  const ruleset = rulesetId(ALIEN.build(seedFromText(seed)), ALIEN.version),
    // (As it was saved before Phase 56: its seed's text as it was typed.)
    old = { ...saveWorld(twin, ruleset), seed };
  assert.equal(worldKindOf(homePlanet(ALIEN.build(seedFromText(seed))).generated), "ammonia");
  assert.throws(
    () => loadWorld(old, ALIEN.build, ruleset, { allowRulesetChange: true }),
    /this game regenerates/,
  );
  const { world } = loadKept(old, ALIEN.build, ruleset);
  assert.equal(world.seed.text, keptRocky(seed));
  assert.equal(worldKindOf(homePlanet(world).generated), "rocky");
  assert.deepEqual(world.domainHashes(), twin.domainHashes());
  world.runTo(4 * YEAR);
  twin.runTo(4 * YEAR);
  assert.deepEqual(world.domainHashes(), twin.domainHashes(), "and goes on as it would have");
});
