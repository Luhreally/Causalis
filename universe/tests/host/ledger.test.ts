// The ledger in sections (asked 2026-11-16: "add the underworld to ledger and whatever else is relevant"): every tab stands in one of
// six sections, in their order, a tab asked by its id opens with its section; and its Treasury tab, Round B's money and the state
// realm beside realm, shows rows set down by hand in the columns they belong to, and one honest line where no realm keeps a
// treasury. Juniper forty years on, its rows put back after.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Block, Line, PageModel } from "../../src/bridge/index.ts";
import {
  COIN,
  COIN_STORE,
  FISC,
  TREASURY_STORE,
  moneyStore,
  type RowStore,
} from "../../src/sim/index.ts";
import { LEDGER_SECTIONS, ledgerPage } from "../../src/host/inspect/world.ts";
import { ledgerCtx } from "../../src/host/inspect/ledger-kit.ts";
import { treasuryLedger } from "../../src/host/inspect/ledger-money.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 40, { start: "spread" });

const words = (l: Line): string => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const tableOf = (blocks: readonly Block[], title: string) => {
  const t = blocks.find((b) => b.type === "table" && b.title === title);
  return t?.type === "table" ? t : undefined;
};

test("every tab of the ledger stands in a section, the sections in their order, the underworld among them", () => {
  const p: PageModel = ledgerPage(world);
  const ids = p.tabs.map((t) => t.id);
  assert.deepEqual(
    ids,
    LEDGER_SECTIONS.flatMap(([, x]) => x),
    "the tabs in their sections' order",
  );
  assert.equal(new Set(ids).size, ids.length, "no tab twice");
  for (const t of p.tabs) assert.ok(t.group, `${t.id} stands in a section`);
  assert.deepEqual(
    [...new Set(p.tabs.map((t) => t.group))],
    ["Realms", "Wealth", "War", "Order", "Culture", "Nature"],
  );
  for (const id of [
    "realms",
    "wealth",
    "might",
    "towns",
    "wars",
    "bonds",
    "alliances",
    "sickness",
    "credit",
    "money",
    "camps",
    "strife",
    "faiths",
    "tongues",
    "life",
    "sky",
    "underworld",
    "groups",
    "houses",
    "treasury",
    "trade",
    "society",
    "culture",
    "powers",
    "arms",
    "nature",
    "making",
    "tastes",
    "intox",
  ])
    assert.ok(ids.includes(id), `the ${id} tab is kept`);
  assert.equal(p.tabs[0]!.id, "realms", "it opens on its realms");
  // (No section is a lone tab, nor so many a phone's row of them crowds.)
  for (const [name, x] of LEDGER_SECTIONS)
    assert.ok(x.length >= 2 && x.length <= 6, `${name} holds ${x.length}`);
  // A tab asked by its id opens with its section (the top bar's chips and the lenses open a tab so).
  const under = pageOf(world, "world:ledger#underworld");
  assert.equal(under.tab, "underworld");
  assert.equal(under.tabs.find((t) => t.id === "underworld")?.group, "Order");
  // The newer world-wide tables are read only while open: the page as it opens holds none of them, keeps their tabs (the page
  // window's tidying included), and a tab asked for holds its own and leaves the others for later.
  const later = p.tabs.filter((t) => t.later).map((t) => t.id);
  assert.deepEqual(later.sort(), [
    "arms",
    "culture",
    "groups",
    "houses",
    "intox",
    "making",
    "nature",
    "powers",
    "society",
    "tastes",
    "trade",
    "treasury",
    "underworld",
  ]);
  for (const t of p.tabs)
    if (t.later) assert.equal(t.blocks.length, 0, `${t.id} waits to be opened`);
    else assert.ok(t.blocks.length > 0, `${t.id} says something`);
  assert.deepEqual(
    pageOf(world, "world:ledger")
      .tabs.filter((t) => t.later)
      .map((t) => t.id)
      .sort(),
    later,
  );
  const opened = under.tabs.find((t) => t.id === "underworld")!;
  assert.ok(!opened.later && opened.blocks.length > 0, "the underworld, asked for, is read");
  assert.ok(under.tabs.find((t) => t.id === "groups")?.later, "the groups wait");
  for (const id of later) {
    const t = ledgerPage(world, id).tabs.find((x) => x.id === id)!;
    assert.ok(!t.later && t.blocks.length > 0, `${id}, asked for, says something`);
  }
  // (The whole page stays far within the memory gate's bound.)
  assert.ok(JSON.stringify(p).length < 1_000_000);
});

/** Set rows down for a test, and put back what was there after it. */
function withRows(
  rows: readonly (readonly [RowStore, string | number, number[] | null])[],
  run: () => void,
) {
  const was = rows.map(([s, k]) => [s, k, s.get(k)] as const);
  try {
    for (const [s, k, r] of rows) {
      if (r) s.set(k, r);
      else s.drop(k);
    }
    run();
  } finally {
    for (const [s, k, r] of was)
      if (r) s.set(k, [...r]);
      else s.drop(k);
  }
}

test("the Treasury tab shows each realm's money and treasury as its rows were set down", () => {
  const lc = ledgerCtx(world),
    realm = lc.standing[0]!,
    coins = moneyStore(world, COIN_STORE)!,
    fiscs = moneyStore(world, TREASURY_STORE)!;
  assert.ok(coins && fiscs, "Round B's stores stand on a peopled world");
  const coin = new Array<number>(coins.width).fill(0),
    fisc = new Array<number>(fiscs.width).fill(0);
  coin[COIN.form] = 2; // notes
  coin[COIN.inflation] = 500; // prices up 5%
  fisc[FISC.take] = 30_000;
  fisc[FISC.take + 1] = 12_345;
  fisc[FISC.arms] = 9_000;
  fisc[FISC.relief] = 1_500;
  fisc[FISC.deficit] = 700;
  fisc[FISC.burden] = 125;
  withRows(
    [
      [coins, realm.ref, coin],
      [fiscs, realm.ref, fisc],
    ],
    () => {
      const blocks = treasuryLedger(world, ledgerCtx(world)),
        t = tableOf(blocks, "Each realm's money and treasury");
      assert.ok(t, "a table of every realm's treasury");
      const row = t.rows.find((r) => r.ref === `${realm.ref}#treasury`);
      assert.ok(row, "its row, a tap from its Treasury tab");
      const cell = (name: string) => words(row.cells[t.columns.indexOf(name)]!);
      assert.equal(cell("Realm"), realm.town);
      assert.equal(cell("Money"), "notes");
      assert.equal(cell("Prices"), "+5%");
      assert.equal(cell("Took in"), "42,345");
      assert.equal(cell("Arms"), "9,000");
      assert.equal(cell("Relief"), "1,500");
      assert.equal(cell("Kept"), "short 700");
      assert.equal(cell("Tax burden"), "13%");
      // (Every column sorts.)
      for (const r of t.rows) assert.equal(r.keys?.length, t.columns.length);
      // The same in the ledger itself.
      const tab = ledgerPage(world, "treasury").tabs.find((x) => x.id === "treasury")!;
      assert.equal(tab.group, "Wealth");
      assert.ok(tableOf(tab.blocks, "Each realm's money and treasury"));
    },
  );
});

test("where no realm keeps a treasury, the Treasury tab says so in one line", () => {
  const coins = moneyStore(world, COIN_STORE)!,
    fiscs = moneyStore(world, TREASURY_STORE)!,
    gone = [
      ...coins.keys().map((k) => [coins, k, null] as const),
      ...fiscs.keys().map((k) => [fiscs, k, null] as const),
    ];
  withRows(gone, () => {
    const blocks = treasuryLedger(world, ledgerCtx(world));
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]!.type, "text");
    assert.match(JSON.stringify(blocks[0]), /No realm keeps a treasury yet/);
  });
});
