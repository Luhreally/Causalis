import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { genesisPlan } from "../../src/host/genesis.ts";
import { homePlanet } from "../../src/sim/index.ts";
import type { Block, Line, PageModel } from "../../src/bridge/index.ts";

// B2: a world's Life page, its drops by what they run on, and the genesis told by its own dawn.

const plain = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const words = (p: PageModel) =>
  p.tabs
    .flatMap((t) => t.blocks)
    .flatMap((b): string[] => [
      ...("title" in b && b.title ? [b.title] : []),
      ...(b.type === "text"
        ? b.lines.map(plain)
        : b.type === "facts"
          ? b.rows.map((r) => `${r.label}: ${plain(r.value)}`)
          : b.type === "list"
            ? b.items.map((i) => plain(i.line))
            : b.type === "table"
              ? b.rows.map((r) => r.cells.map(plain).join(" | "))
              : b.type === "sides"
                ? b.rows.map(
                    (r) => `${r.label}: ${plain(r.cells[0].line)} | ${plain(r.cells[1].line)}`,
                  )
                : []),
    ])
    .join("\n");
const dropOf = (p: PageModel) =>
  p.tabs
    .flatMap((t) => t.blocks)
    .find((b): b is Extract<Block, { type: "drop" }> => b.type === "drop");

const earth = EARTH.build(seedFromText("first light")),
  alien = ALIEN.build(seedFromText("alien 3"));

test("a world's Life page: where life began and on what, when its air changed, its stocks, its roles, in words", () => {
  for (const world of [earth, alien]) {
    const before = JSON.stringify(world.domainHashes()),
      p = pageOf(world, "world:life"),
      text = words(p);
    assert.equal(p.kind, "life");
    assert.deepEqual(
      p.tabs.map((t) => t.id),
      ["dawn", "trades", "glass", "stocks", "roles", "beside"],
    );
    assert.match(text, /Where it began: /);
    assert.match(text, /What it first ran on: /);
    assert.match(text, /Its air: Free oxygen since about .* \(an estimate\)/);
    assert.match(text, /Where life could have begun/);
    assert.doesNotMatch(text, /\b(life|world|can|prin|cell):[a-z0-9]/i, "no raw ref");
    assert.doesNotMatch(
      text,
      /undefined|NaN|\[object|null\b|h2-|breathe-|split-water/,
      "no raw id",
    );
    assert.equal(JSON.stringify(world.domainHashes()), before, "asking moves nothing");
  }
  assert.match(words(pageOf(earth, "world:life")), /2\.4 billion years ago/);
  // (An alien world's stocks, a beast of each.)
  const stocks = pageOf(alien, "world:life#stocks").tabs.find((t) => t.id === "stocks")!.blocks;
  const lineup = stocks.find((b) => b.type === "lineup");
  assert.ok(lineup && lineup.type === "lineup" && lineup.items.length >= 3);
  assert.ok(
    lineup.items.every((i) => i.body && "look" in i.body),
    "each of its stock's look",
  );
});

test("its first seas' drop holds its own first life: on Earth, methane-makers on a crumb of vent chimney; a hot young world's, iron-eaters on rust", () => {
  const e = dropOf(pageOf(earth, "world:life"))!,
    a = dropOf(pageOf(alien, "world:life"))!;
  assert.ok(e.kinds.some((k) => k.way === "rock" && k.name === "methane-makers"));
  assert.match(e.grain?.name ?? "", /chimney/);
  assert.ok(a.kinds.some((k) => k.way === "rock" && k.name === "iron-eaters"));
  assert.notDeepEqual(
    e.kinds.map((k) => k.name),
    a.kinds.map((k) => k.name),
  );
  // (Earth's drops of today are as they always were: no rock-eaters, its four kinds at their usual pace.)
  const land = pageOf(earth, "world:tree#dawn")
    .tabs.flatMap((t) => t.blocks)
    .find((b) => b.type === "drop");
  assert.ok(land && land.type === "drop");
  assert.deepEqual(
    land.kinds.map((k) => [k.name, k.pace ?? 1, k.look ?? null]),
    [
      ["small cells", 1, null],
      ["light-eaters", 1, null],
      ["hunting cells", 1, null],
      ["cells together", 1, null],
    ],
  );
  assert.equal(land.grain, undefined);
});

test("two worlds' life side by side; a world beside itself", () => {
  const p = pageOf(earth, "lifewith:alien|alien%203"),
    sides = p.tabs.find((t) => t.id === "beside")!.blocks.find((b) => b.type === "sides");
  assert.equal(p.tab, "beside");
  assert.ok(sides && sides.type === "sides");
  assert.ok(sides.rows.filter((r) => r.parts).length >= 3, "they part");
  assert.match(words(pageOf(earth, "lifewith:earth|first%20light")), /That is this world/);
});

test("another world's Life page, and a lifeless one says what was missing", () => {
  const g = homePlanet(alien).generated,
    bodies = g.system.bodies.filter(
      (b) => b.kind !== "home" && b.kind !== "giant" && b.kind !== "ice giant",
    );
  assert.ok(bodies.length);
  for (const b of bodies) {
    const p = pageOf(alien, `life:${b.ref}`),
      text = words(p);
    assert.equal(p.kind, "life", `${b.ref}: ${p.title}`);
    if (/Why nothing lives/.test(p.title))
      assert.match(text, /What life needs to begin|was missing|Every need/);
    assert.doesNotMatch(text, /undefined|NaN|\[object/);
  }
  // (Its world's page links to it.)
  const home = pageOf(alien, g.planet.ref);
  assert.ok(JSON.stringify(home).includes('"ref":"world:life"'));
});

test("the genesis tells its own cradle and first life where it draws the first cells", () => {
  const e = genesisPlan(homePlanet(earth).generated, "first light"),
    a = genesisPlan(homePlanet(alien).generated, "alien 3");
  assert.match(e.origin?.title ?? "", /seafloor vents/);
  assert.match(e.origin?.words ?? "", /hydrogen with carbon dioxide/);
  assert.notEqual(e.origin?.words, a.origin?.words);
  assert.ok(e.drop?.kinds.some((k) => k.way === "rock"));
});

test("a warmth just under freezing is told as 0 °C, never −0", async () => {
  const { celsius } = await import("../../src/host/kinds.ts");
  assert.equal(celsius(-0.3), "0 °C");
  assert.equal(celsius(-0.6), "−1 °C");
});
