import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { cellRef } from "../../src/gen/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { levyPlaces } from "../../src/host/fallen.ts";
import { FELL_ROWS } from "../../src/host/inspect/realm.ts";
import { count } from "../../src/host/inspect/words.ts";
import { warsOf, type Battle } from "../../src/sim/index.ts";
import type { Block, PageModel, Stat, Tab } from "../../src/bridge/index.ts";

// Phase 55 M224 (T7): the pages tell the wounded and the fallen by place. A battle's page tells its
// wounded and the places its fallen came from (at most FELL_ROWS, the rest counted); a war's page
// tells its wounded in its stat, its battles and its tally; a battle kept without its record tells
// neither.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const page = (ref: string) => ask<PageModel>("page", { ref });
const before = JSON.stringify(world.domainHashes());
const Y = Math.floor(world.now / YEAR);
const battles = [...warsOf(world).all()].flatMap((war) => war.battles.map((b) => ({ war, b })));

/** Every place a battle's men came from, both sides' (none for a battle before Phase 55). */
const placesOf = (b: Battle) =>
  ([0, 1] as const).flatMap((side) => levyPlaces(world, b, side, Infinity));
/** A page's headline number, by its label, if it has one. */
const statOf = (p: PageModel, label: string): Stat | undefined =>
  p.stats.find((s) => s.label === label);
/** A page's tab, by its id, if it has one. */
const tabOf = (p: PageModel, id: string): Tab | undefined => p.tabs.find((t) => t.id === id);
/** The table a tab opens with. */
function tableOf(tab: Tab | undefined): Extract<Block, { type: "table" }> {
  const block = tab?.blocks.find((x) => x.type === "table");
  assert.ok(block && block.type === "table", "a tab with a table");
  return block;
}
/** The sum of one column of a table's keys. */
const keySum = (rows: readonly { readonly keys?: readonly (number | string)[] }[], i: number) =>
  rows.reduce((n, r) => n + Number(r.keys?.[i]), 0);

test("there are battles to watch", () => {
  assert.ok(battles.length >= 10, `${battles.length} battles`);
});

test("a recent battle's page tells its wounded and its fallen by place", () => {
  // (Of the last forty years, a battle whose places all fit on its tab: its sums are the whole.)
  const pick = battles.find(
    ({ b }) => b.year >= Y - 39 && placesOf(b).length > 0 && placesOf(b).length <= FELL_ROWS,
  );
  assert.ok(pick, "a recent battle with places, all of them on its tab");
  const { b } = pick,
    p = page(b.event),
    wounded = statOf(p, "Wounded"),
    [w0, w1] = b.wounded!,
    [m0, m1] = b.maimed!;
  assert.ok(wounded, "a Wounded stat");
  assert.deepEqual(wounded.value, [count(w0 + w1)]);
  assert.deepEqual(
    wounded.parts?.map((x) => x.value),
    [count(w0), count(w1), count(m0 + m1)],
  );
  assert.equal(tabOf(p, "fallen")?.name, "The fallen");
  const table = tableOf(tabOf(p, "fallen"));
  assert.deepEqual(table.columns, ["From", "Side", "Sent", "Fell", "Wounded"]);
  assert.equal(keySum(table.rows, 3), b.fallen[0] + b.fallen[1], "the fallen, by place");
  assert.equal(keySum(table.rows, 4), w0 + w1, "the wounded, by place");
});

test("every battle's fallen tab lists its places, at most FELL_ROWS, and counts the rest", () => {
  for (const { b } of battles) {
    const places = placesOf(b).length,
      tab = tabOf(page(b.event), "fallen");
    assert.equal(tab !== undefined, places > 0, `${b.event}: a fallen tab, if a place sent men`);
    if (!tab) continue;
    const { rows } = tableOf(tab);
    assert.equal(rows.length, Math.min(places, FELL_ROWS), `${b.event}: its rows`);
    // (The most dead first.)
    for (let k = 1; k < rows.length; k++)
      assert.ok(
        Number(rows[k - 1]!.keys?.[3]) >= Number(rows[k]!.keys?.[3]),
        `${b.event}: by dead`,
      );
    if (places > FELL_ROWS)
      assert.deepEqual(tab.blocks[1], {
        type: "text",
        lines: [[`And ${count(places - FELL_ROWS)} more places.`]],
      });
  }
});

test("an old battle's fallen tab names its lands, each by its cell ref", () => {
  let seen = 0;
  for (const { b } of battles.filter((x) => x.b.year < Y - 41)) {
    const tab = tabOf(page(b.event), "fallen"),
      places = placesOf(b);
    if (!tab) continue;
    seen++;
    assert.ok(
      places.every((x) => x.kind === "land"),
      `${b.event}: told by its lands whole`,
    );
    const cells = new Set<string>(places.map((x) => cellRef(0, x.cell)));
    for (const row of tableOf(tab).rows)
      assert.ok(cells.has(row.ref!), `${b.event}: ${row.ref} is one of its lands' cell refs`);
  }
  assert.ok(seen > 0, "an old battle with places");
});

test("a war's page tells its wounded: its stat, its battles and its tally", () => {
  const war = battles[0]!.war,
    sum = (i: 0 | 1) => war.battles.reduce((n, b) => n + (b.wounded?.[i] ?? 0), 0),
    sides: [number, number] = [sum(0), sum(1)],
    p = page(war.ref);
  assert.deepEqual(statOf(p, "Wounded")?.value, [count(sides[0] + sides[1])]);
  const table = tableOf(tabOf(p, "battles"));
  assert.deepEqual(table.columns, ["When", "Where", "Won by", "Fallen", "Wounded"]);
  assert.equal(keySum(table.rows, 4), sides[0] + sides[1], "the wounded, battle by battle");
  const tally = p.tabs[0]?.blocks.find((x) => x.type === "tally");
  assert.ok(tally && tally.type === "tally", "a tally");
  const row = tally.rows.find((r) => r.label === "Wounded");
  assert.deepEqual([row?.a, row?.b], sides);
});

test("reading the pages changes no domain hash", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});

test("a battle kept without its record tells neither its wounded nor its fallen", () => {
  const { war, b } = battles.find((x) => placesOf(x.b).length > 0)!,
    at = war.battles.indexOf(b);
  assert.ok(
    statOf(page(b.event), "Wounded") && tabOf(page(b.event), "fallen"),
    "a battle with both, to begin with",
  );
  // (Its record is taken off for the look, and put back after.)
  const { wounded, maimed, bore, fell, ...plain } = b;
  void [wounded, maimed, bore, fell];
  try {
    war.battles[at] = plain;
    const p = page(b.event);
    assert.equal(statOf(p, "Wounded"), undefined);
    assert.equal(tabOf(p, "fallen"), undefined);
    assert.ok(page(war.ref).tabs.length > 0, "the war's page still builds");
  } finally {
    war.battles[at] = b;
  }
  assert.equal(JSON.stringify(world.domainHashes()), before, "put back as it was");
});
