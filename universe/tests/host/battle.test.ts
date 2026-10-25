import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { sideColors } from "../../src/host/battle.ts";
import { WAR_EVENTS, warsOf } from "../../src/sim/index.ts";
import type { BattleNear, Block, PageModel } from "../../src/bridge/index.ts";

// Phase 37 M183/M186: a battle seen near — what history says of it, for the eye to watch it
// fought: its hosts as they were in the field, who won and what came of it, the ground it was
// fought on; and the way to it from its page and its war's.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const wars = [...warsOf(world).all()],
  battles = wars.flatMap((w) => w.battles.map((b) => ({ war: w, b })));

test("there are battles to watch", () => {
  assert.ok(battles.length >= 10, `${battles.length} battles`);
});

test("every battle is seen near as history has it: its hosts, its fallen, what it won", () => {
  const outcomes = new Set<string>();
  for (const { war, b } of battles) {
    const n = ask<BattleNear | null>("battle.near", { event: b.event });
    assert.ok(n, b.event);
    outcomes.add(n.outcome);
    assert.equal(n.war, war.ref);
    assert.equal(n.year, b.year);
    assert.equal(n.cell, b.land);
    assert.match(n.title, /^The battle at /);
    assert.equal(n.attacker.ref, war.attacker);
    assert.equal(n.defender.ref, war.defender);
    assert.equal(n.attacker.fallen, b.fallen[0]);
    assert.equal(n.defender.fallen, b.fallen[1]);
    // (A battle of this world knows its hosts' strength in the field.)
    assert.deepEqual([n.attacker.fielded, n.defender.fielded], b.fielded);
    assert.equal(n.won, b.won);
    assert.equal(n.outcome === "held", !b.won);
    // A seat fought at stands behind its walls; the land taken is told by its taking.
    assert.equal(n.walls > 0, b.seat === true, `${b.event} walls`);
    const taken = world.events
      .all()
      .some(
        (e) =>
          e.type === WAR_EVENTS.taken.type &&
          e.t === world.events.get(b.event as Ref)!.t &&
          e.causes.some((c) => c.ref === b.event),
      );
    assert.equal(n.outcome === "taken" || n.outcome === "stormed", taken, `${b.event} taken`);
    assert.ok(n.attacker.kit.length > 0 && n.defender.kit.length > 0);
    // (Each side its own colour on the field, told apart.)
    const [p, q] = [n.attacker.color, n.defender.color];
    assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) >= 0.42, `${b.event} colours`);
    assert.equal(n.plan.ages.length, 1);
    assert.equal(n.plan.lineages.length, 0);
  }
  assert.ok(
    outcomes.has("held") && (outcomes.has("field") || outcomes.has("taken")),
    [...outcomes].join(),
  );
});

test("what is not a battle is not seen as one", () => {
  assert.equal(ask("battle.near", { event: wars[0]!.event }), null);
  assert.equal(ask("battle.near", { event: "ev:0:999999999" }), null);
});

const tools = (p: PageModel) =>
  p.tabs
    .flatMap((t) => t.blocks)
    .filter((b): b is Extract<Block, { type: "tool" }> => b.type === "tool");

test("a battle's page offers it watched; a war's page its last battle", () => {
  const { b } = battles.at(-1)!;
  const page = ask<PageModel>("page", { ref: b.event }),
    watch = tools(page).find((t) => t.tool === "watch.battle");
  assert.ok(watch, "the battle's page has its watch");
  assert.equal(watch.args.event, b.event);
  const war = battles.at(-1)!.war,
    warPage = ask<PageModel>("page", { ref: war.ref }),
    last = tools(warPage).find((t) => t.tool === "watch.battle");
  assert.ok(last, "the war's page has its last battle's watch");
  assert.equal(last.args.event, war.battles.at(-1)!.event);
  assert.match(String(last.args.label), /last battle \(year \d+\)/);
});

test("two hosts too alike in colour are told apart, and none is drawn in the grass's", () => {
  const red = [0.8, 0.2, 0.2] as const,
    [a, d] = sideColors(red, [0.78, 0.22, 0.2]);
  assert.deepEqual(a, red);
  assert.ok(Math.hypot(a[0] - d[0], a[1] - d[1], a[2] - d[2]) >= 0.42);
  // (Far enough apart already: each its own.)
  assert.deepEqual(sideColors(red, [0.1, 0.2, 0.8]), [red, [0.1, 0.2, 0.8]]);
  const [g] = sideColors([0.3, 0.55, 0.2], [0.1, 0.2, 0.8]);
  assert.ok(Math.hypot(g[0] - 0.3, g[1] - 0.55, g[2] - 0.2) >= 0.22, "not the grass's green");
});
