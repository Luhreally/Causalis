import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { sideColors } from "../../src/host/battle.ts";
import { WAR_EVENTS, warsOf } from "../../src/sim/index.ts";
import type { BattleNear, Block, Campaign, PageModel } from "../../src/bridge/index.ts";
import { campaignAt, campaignSpan } from "../../src/view/index.ts";

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
    // (A battle of this world knows its hosts' strength in the field — and, where more fell than
    // a host had, the men who rose with it: a remnant of them all is left standing.)
    [n.attacker, n.defender].forEach((s, i) => {
      assert.equal(s.fielded - (s.risen ?? 0), b.fielded![i], `${b.event} fielded`);
      assert.equal(!!s.risen, s.fallen > b.fielded![i]! * 0.9, `${b.event} risen`);
      assert.ok(s.fallen <= s.fielded * 0.9, `${b.event} a remnant`);
    });
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

test("the ledger's wars offer the bloodiest battles watched; a war's page its bloodiest as well as its last", () => {
  const fell = (b: (typeof battles)[number]["b"]) => b.fallen[0] + b.fallen[1],
    bloodiest = [...battles].sort((p, q) => fell(q.b) - fell(p.b) || q.b.year - p.b.year),
    tab = ask<PageModel>("page", { ref: "world:ledger" }).tabs.find((t) => t.id === "wars")!,
    watch = tab.blocks.filter(
      (b): b is Extract<Block, { type: "tool" }> => b.type === "tool" && b.tool === "watch.battle",
    );
  assert.deepEqual(
    watch.map((t) => t.args.event),
    bloodiest.slice(0, 3).map(({ b }) => b.event),
  );
  assert.match(
    String(watch[0]!.args.label),
    /^⚔️ Watch the battle at .+ \(year \d+\): [\d,]+ fell$/,
  );
  assert.ok(
    tab.blocks.some((b) => b.type === "bars" && b.title === "The bloodiest battles"),
    "the bloodiest battles charted",
  );
  // (A war of more than one battle, whose bloodiest was not its last.)
  const war = wars.find((w) => {
    const most = [...w.battles].sort((p, q) => fell(q) - fell(p) || q.year - p.year)[0];
    return !!most && most !== w.battles.at(-1) && fell(most) > 0;
  });
  assert.ok(war, "a war whose bloodiest battle was not its last");
  const offered = tools(ask<PageModel>("page", { ref: war.ref })).filter(
    (t) => t.tool === "watch.battle",
  );
  assert.ok(
    offered.some((t) =>
      /^⚔️ Watch its bloodiest \(year \d+: [\d,]+ fell\)$/.test(String(t.args.label)),
    ),
    "its bloodiest offered",
  );
});

test("a war's course is told to be watched unfolding: its sides, its host's way, each battle in turn (Phase 38 M193)", () => {
  for (const w of wars) {
    const c = ask<Campaign | null>("war.campaign", { ref: w.ref });
    assert.ok(c, w.ref);
    assert.equal(c.attacker.ref, w.attacker);
    assert.equal(c.defender.ref, w.defender);
    assert.equal(c.declared, w.declared);
    assert.equal(c.ended, w.ended);
    assert.match(c.title, /^The war of .+ upon .+$/);
    assert.ok(c.from >= 0 && c.to >= 0, `${w.ref} its way`);
    assert.deepEqual(
      c.battles.map((b) => [b.event, b.year, b.cell, b.won, b.fallen[0], b.fallen[1]]),
      w.battles.map((b) => [b.event, b.year, b.land, b.won, b.fallen[0], b.fallen[1]]),
    );
    // Played through, its tallies come to the battles' own.
    const end = campaignAt(c, campaignSpan(c).to),
      sum = (i: 0 | 1) => w.battles.reduce((n, b) => n + b.fallen[i], 0);
    assert.deepEqual(end.fallen, [sum(0), sum(1)]);
    assert.deepEqual(end.won, [
      w.battles.filter((b) => b.won).length,
      w.battles.filter((b) => !b.won).length,
    ]);
  }
  // What came of each battle is as it is seen near.
  for (const { war, b } of battles.slice(0, 8)) {
    const c = ask<Campaign>("war.campaign", { ref: war.ref }),
      n = ask<BattleNear>("battle.near", { event: b.event });
    assert.equal(c.battles.find((x) => x.event === b.event)!.outcome, n.outcome);
  }
  assert.equal(ask("war.campaign", { ref: "war:0:999999999" }), null);
  // (A war is found by the events that began and ended it too: its tidings'.)
  const ended = wars.find((w) => w.peace)!;
  assert.ok(ended, "a war ended in peace");
  assert.equal(ask<Campaign>("war.campaign", { ref: ended.peace! }).ref, ended.ref);
  assert.equal(ask<Campaign>("war.campaign", { ref: ended.event }).ref, ended.ref);
});

test("a war's page offers it watched unfolding, and the ledger its bloodiest", () => {
  const war = wars.find((w) => w.battles.length > 1)!,
    watch = tools(ask<PageModel>("page", { ref: war.ref })).find((t) => t.tool === "watch.war");
  assert.ok(watch, "the war's page has its watch");
  assert.equal(watch.args.ref, war.ref);
  assert.match(String(watch.args.label), /^▶ Watch the war unfold \([\d,]+ battles\)$/);
  const fell = (w: (typeof wars)[number]) => w.fallen[0] + w.fallen[1],
    bloodiest = [...wars]
      .filter((w) => w.battles.length > 0 && fell(w) > 0)
      .sort((a, b) => fell(b) - fell(a) || (a.ref < b.ref ? -1 : 1))[0]!,
    tab = ask<PageModel>("page", { ref: "world:ledger" }).tabs.find((t) => t.id === "wars")!,
    ledger = tab.blocks.find(
      (b): b is Extract<Block, { type: "tool" }> => b.type === "tool" && b.tool === "watch.war",
    );
  assert.ok(ledger, "the ledger has the bloodiest war's watch");
  assert.equal(ledger.args.ref, bloodiest.ref);
  assert.match(
    String(ledger.args.label),
    /^▶ Watch the bloodiest war unfold: .+ upon .+ \([\d,]+ fell\)$/,
  );
});
