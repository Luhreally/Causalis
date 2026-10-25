import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { folkFacts } from "../../src/host/folk.ts";
import { populationContext } from "../../src/sim/index.ts";
import type { PageModel } from "../../src/bridge/index.ts";

// Phase 35 M179–M181: a world never seen as the hand made it — its star, its pull, its orbit, its
// seas, its air — told before it is begun, on its page, and in its people's look.

const madeText = "violet hollow ~pull heavy ~star red";

test("the world a seed makes is told before it is begun, as made", () => {
  const plain = ALIEN.life!(seedFromText("violet hollow")),
    made = ALIEN.life!(seedFromText(madeText));
  assert.ok(plain.world && made.world);
  assert.match(made.world.star, /^M/, "a dim red star");
  assert.ok(made.world.kelvin < 3900 && plain.world.kelvin > 5000);
  assert.ok(made.world.gravity > 1.4 && plain.world.gravity < 1);
  // (The rest as the seed falls.)
  assert.equal(made.world.seas, plain.world.seas);
  // A world like ours is not remade.
  assert.deepEqual(
    EARTH.life!(seedFromText("first light ~star red")).world,
    EARTH.life!(seedFromText("first light")).world,
  );
});

test("a world made by the hand says so on its page, and its people are of it", () => {
  const world = ALIEN.build(seedFromText(madeText));
  world.runTo(YEAR / 8);
  const g = populationContext(world).generated,
    page = (ALIEN.queries["page"]!(world, { ref: g.planet.ref }) as PageModel).tabs[0]!.blocks,
    made = page.find((b) => b.type === "text" && b.title === "Made by your hand");
  assert.ok(made, "told on its page");
  assert.match(JSON.stringify(made), /a dim red star · a great world, its pull heavy/);
  // Their look is of the world so made: its red star, its heavy pull.
  const folk = folkFacts(g);
  assert.ok(folk && folk.star < 3900 && folk.gravity > 1.4, JSON.stringify(folk));
  // Unmade, nothing told.
  const plain = ALIEN.build(seedFromText("violet hollow"));
  plain.runTo(YEAR / 8);
  const pg = populationContext(plain).generated,
    blocks = (ALIEN.queries["page"]!(plain, { ref: pg.planet.ref }) as PageModel).tabs[0]!.blocks;
  assert.ok(!blocks.some((b) => b.type === "text" && b.title === "Made by your hand"));
});
