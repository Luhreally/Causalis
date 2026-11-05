import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { LIFE_QUERIES } from "../../src/host/life.ts";
import { villagePlan } from "../../src/host/village.ts";
import type { LifeCard, LifeNow, VillagePlan } from "../../src/bridge/index.ts";
import { makePopulationWorld, populationContext } from "../../src/sim/index.ts";
import { cradleCell } from "../cradle.ts";

// Lives L3: a life as the page reads it. Asking moves nothing; those about a life are drawn; their house is one home.
const world = makePopulationWorld(seedFromText("first light"));
world.runTo(245 * YEAR);
const town = populationContext(world).settlements.inProvince(cradleCell("first light"))[0]!;
world.runTo(world.submit("hand.lay", { village: town.ref }).t);
const ask = <T>(type: string, args?: unknown) => LIFE_QUERIES[type]!(world, args) as T;

test("lives are offered with why, and none is lived until one is chosen", () => {
  const cards = ask<LifeCard[]>("life.pick");
  assert.ok(cards.length >= 3, `${cards.length} lives`);
  for (const c of cards) assert.ok(c.hook.length > 8 && c.name.length > 0);
  assert.equal(ask("life.now"), null);
});

test("a life read: asking moves nothing, its tray says why, those about it are drawn in one home", () => {
  const card = ask<LifeCard[]>("life.pick").find((c) => c.kind === "craft" || c.kind === "farm")!;
  world.runTo(world.submit("life.begin", { agent: card.id, home: 2 }).t);
  world.runTo(world.now + 3600 * 5);
  const hash = JSON.stringify(world.domainHashes()),
    now = ask<LifeNow>("life.now")!;
  assert.equal(JSON.stringify(world.domainHashes()), hash);
  assert.equal(now.agent, card.id);
  assert.ok(now.offers.length >= 4);
  assert.ok(now.offers.every((o) => o.words.length > 0 && o.label.length > 0));
  assert.ok(now.fed >= 0 && now.fed <= 1 && now.purse >= 0);
  const plan = villagePlan(world, town.ref) as VillagePlan,
    drawn = new Map(plan.people.map((p) => [p.ref, p]));
  for (const id of now.about) assert.ok(drawn.has(`agent:${id}`), `agent ${id} is not drawn`);
  assert.equal(drawn.get(now.ref)!.home, 2);
  const wife = now.kin.find((k) => k.is === "wife" || k.is === "husband");
  if (wife) assert.equal(drawn.get(wife.ref)!.home, 2);
});
