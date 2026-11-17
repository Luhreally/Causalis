// The ledger's realm-by-realm tables (2026-11-16): Trade, Society, Culture and Powers. Rows written by hand into the stores show
// in the right table and column, each realm's name a link to its page; a system that keeps nothing says so in one honest line.
// Juniper forty years on, its rows set down by hand and put back after.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Block, Line, Row } from "../../src/bridge/index.ts";
import {
  CAPITAL_STORE,
  CARTEL_STORE,
  CYCLE_STORE,
  EXCHANGE_STORE,
  LAW_STORE,
  LEISURE_STORE,
  PLAN_STORE,
  RENT_STORE,
  ROOFLESS_STORE,
  SMOKE_STORE,
  TEMPLE_STORE,
  VOICE_STORE,
  ART_STORE,
  ACADEMY_STORE,
  URBAN_STORE,
  FOLK_STORE,
  CY,
  EX,
  PL,
  SM,
  CAP,
  RT,
  CT,
  LAW_ROW,
  LEISURE_ROW,
  ROOF_ROW,
  cartelKey,
  beliefOf,
  cultureRows,
  occupationOf,
  politiesOf,
  refNumber,
  societyStore,
  spiesOf,
  tradeStore,
  type Polity,
  type RowStore,
} from "../../src/sim/index.ts";
import { GOODS } from "../../src/rules/index.ts";
import { ledgerCtx } from "../../src/host/inspect/ledger-kit.ts";
import {
  cultureLedger,
  powersLedger,
  societyLedger,
  tradeLedger,
} from "../../src/host/inspect/ledger-realm.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 40, { start: "spread" });

const said = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const tableOf = (blocks: Block[], title: string) => {
  const t = blocks.find((b) => b.type === "table" && b.title === title);
  assert.ok(t && t.type === "table", `no table "${title}"`);
  return t;
};
/** A row's cells as words, by its column's heading. */
function cellsOf(blocks: Block[], title: string, ref: string): Record<string, string> {
  const t = tableOf(blocks, title),
    row = t.rows.find((r: Row) => r.ref === ref);
  assert.ok(row, `no row ${ref} in "${title}"`);
  assert.equal(row.keys?.length, t.columns.length, "every column sorts");
  return Object.fromEntries(t.columns.map((c, i) => [c, said(row.cells[i]!)]));
}
const textOf = (blocks: Block[]) => JSON.stringify(blocks);

/** The most peopled living realm, and another. */
function realms(): [Polity, Polity] {
  const lc = ledgerCtx(world);
  assert.ok(lc.standing.length >= 2, "two realms stand forty years on");
  return [lc.standing[0]!, lc.standing[1]!];
}

/** Set rows down for a test, and put back what was there after it. */
function withRows(
  rows: readonly (readonly [RowStore, string | number, number[]])[],
  run: () => void,
): void {
  const was = rows.map(([s, k]) => [s, k, s.get(k)] as const);
  try {
    for (const [s, k, r] of rows) s.set(k, r);
    run();
  } finally {
    for (const [s, k, r] of [...was].reverse())
      if (r) s.set(k, [...r]);
      else s.drop(k);
  }
}

/** Empty stores for a test, and fill them again after it. */
function emptied(stores: readonly (RowStore | null)[], run: () => void): void {
  const kept = stores.map(
    (s) => [s, s ? s.keys().map((k) => [k, s.get(k)!] as const) : []] as const,
  );
  try {
    for (const s of stores) for (const k of s?.keys() ?? []) s!.drop(k);
    run();
  } finally {
    for (const [s, rows] of kept) for (const [k, r] of rows) s?.set(k, [...r]);
  }
}

const row = (width: number, at: Record<number, number>) => {
  const r = new Array<number>(width).fill(0);
  for (const [i, v] of Object.entries(at)) r[Number(i)] = v;
  return r;
};

test("trade: a realm's slump, exchange, plan, smoke, machines and ground rent, and a cartel among realms", () => {
  const [r] = realms(),
    cy = tradeStore(world, CYCLE_STORE)!,
    ex = tradeStore(world, EXCHANGE_STORE)!,
    pl = tradeStore(world, PLAN_STORE)!,
    sm = tradeStore(world, SMOKE_STORE)!,
    cap = tradeStore(world, CAPITAL_STORE)!,
    rent = tradeStore(world, RENT_STORE)!,
    cart = tradeStore(world, CARTEL_STORE)!;
  assert.ok(cy && ex && pl && sm && cap && rent && cart, "trade's stores stand on a peopled world");
  withRows(
    [
      [cy, r.ref, row(13, { [CY.slack]: 120, [CY.usual]: 1000, [CY.food]: 900 })],
      [ex, r.ref, row(10, { [EX.worth]: 5000, [EX.bubble]: 140, [EX.crash]: 30, [EX.fell]: 800 })],
      [pl, r.ref, row(8, { [PL.planned]: 250 })],
      [sm, r.ref, row(9, { [SM.price]: 400, [SM.abated]: 100 })],
      ...r.members.map((c) => [cap, c, row(7, { [CAP.share]: 500 })] as const),
      ...r.members.map((c) => [rent, c, row(5, { [RT.rent]: 100 })] as const),
      [
        cart,
        cartelKey(0),
        row(12, {
          [CT.share]: 600,
          [CT.cohesion]: 700,
          [CT.markup]: 300,
          [CT.members]: refNumber(r.ref) + 1,
          [CT.since]: 33,
        }),
      ],
    ],
    () => {
      const blocks = tradeLedger(world, ledgerCtx(world)),
        c = cellsOf(blocks, "Each realm's trade", `${r.ref}#treasury`);
      assert.equal(c.Realm, r.town);
      assert.equal(c["Plenty or want"], "slump, 12% idle");
      assert.equal(c.Harvest, "90% of its usual");
      assert.equal(c.Exchange, "5,000 grain's worth");
      assert.equal(c["Bid past"], "40% past");
      assert.equal(c["Last crash"], "year 30, 800 grain's worth gone");
      assert.equal(c.Planned, "25%");
      assert.equal(c.Smoke, "40% of its harm, 10% cut");
      assert.equal(c.Machines, "50%");
      assert.equal(
        c["Ground rent"],
        `${(100 * r.members.length).toLocaleString("en-US")} grain's worth`,
      );
      const g = cellsOf(blocks, "Cartels among realms", `good:${GOODS[0]!.id}`);
      assert.equal(g.Good, GOODS[0]!.name);
      assert.match(g.Realms ?? "", new RegExp(r.town));
      assert.equal(g.Asks, "30% above");
      assert.equal(g["Of the making"], "60%");
      assert.match(textOf(blocks), /Idle for want of buyers|Realms reckoned/);
    },
  );
  emptied([cy, ex, pl, sm, cap, rent, cart], () =>
    assert.deepEqual(tradeLedger(world, ledgerCtx(world)), [
      { type: "text", lines: [["No realm keeps a trade reckoning yet."]] },
    ]),
  );
});

test("society: a realm's street, its law and its working day", () => {
  const [r] = realms(),
    roof = societyStore(world, ROOFLESS_STORE)!,
    law = societyStore(world, LAW_STORE)!,
    rest = societyStore(world, LEISURE_STORE)!;
  assert.ok(roof && law && rest, "the society's stores stand on a peopled world");
  withRows(
    [
      ...r.members.map(
        (c) =>
          [roof, c, row(roof.width, { [ROOF_ROW.street]: 100, [ROOF_ROW.town]: 1000 })] as const,
      ),
      ...r.members.map(
        (c) =>
          [rest, c, row(rest.width, { [LEISURE_ROW.hours]: 95, [LEISURE_ROW.holy]: 10 })] as const,
      ),
      [
        law,
        r.ref,
        row(law.width, { [LAW_ROW.written]: 700, [LAW_ROW.secure]: 600, [LAW_ROW.deals]: 500 }),
      ],
    ],
    () => {
      const blocks = societyLedger(world, ledgerCtx(world)),
        c = cellsOf(blocks, "Each realm's people", `${r.ref}#laws`);
      assert.equal(c["On the street"], "10%");
      assert.equal(c["Law written"], "70%");
      assert.equal(c["A holding safe"], "60%");
      assert.equal(c["Deals held"], "50%");
      assert.equal(c["Working day"], "9.5 hours");
      // (The most on the street stands first.)
      assert.equal(tableOf(blocks, "Each realm's people").rows[0]!.ref, `${r.ref}#laws`);
      // (Its lands' street, a tenth of a thousand town folk each, counted in the world's whole.)
      const told = blocks.find((b) => b.type === "facts" && b.title === "All told");
      assert.ok(told && told.type === "facts");
      const street = told.rows.find((x) => x.label === "On the street, the world over")!;
      assert.ok(Number(said(street.value).replace(/\D/g, "")) >= 100 * r.members.length);
    },
  );
  const all = [
    "society.roofless",
    "society.care",
    "society.old",
    "society.provision",
    "society.law",
    "society.leisure",
    "society.roles",
  ].map((n) => societyStore(world, n));
  emptied(all, () =>
    assert.deepEqual(societyLedger(world, ledgerCtx(world)), [
      { type: "text", lines: [["No realm keeps a reckoning of its people's lives yet."]] },
    ]),
  );
});

test("culture: who a realm's lands count their own, what its seat tells, its art; and a faith's temples", () => {
  const [r] = realms(),
    folk = cultureRows(world, FOLK_STORE)!,
    voice = cultureRows(world, VOICE_STORE)!,
    art = cultureRows(world, ART_STORE)!,
    temples = cultureRows(world, TEMPLE_STORE)!,
    faith = beliefOf(world).all()[0];
  assert.ok(folk && voice && art && temples, "the culture sweep's stores stand on a peopled world");
  assert.ok(faith, "a faith is held forty years on");
  const year = yearNow(world);
  withRows(
    [
      ...r.members.map(
        (c) => [folk, c, row(5, { 0: 300, 1: 400, 2: refNumber(r.ref), 3: 10, 4: year })] as const,
      ),
      [voice, refNumber(r.ref), row(9, { 0: 1, 1: 20, 2: 600, 3: 800 })],
      ...r.members.map((c) => [art, c, row(7, { 0: 100, 2: 300 })] as const),
      [
        temples,
        refNumber(faith.ref),
        row(8, { 0: 50, 1: 900, 3: 40, 4: 250, 5: 5000, 6: 3, 7: 12 }),
      ],
    ],
    () => {
      const blocks = cultureLedger(world, ledgerCtx(world)),
        c = cellsOf(blocks, "Each realm's people and its word", `${r.ref}#culture`);
      assert.equal(c["Its seat's people"], "strangers (30%)");
      assert.equal(c["Its “us” reaches"], "40%");
      assert.equal(c["Lands apart"], String(r.members.length));
      assert.equal(c["Its seat tells"], "its rule is rightful");
      assert.equal(c.Believed, "80%");
      assert.equal(c.Heard, "60%");
      assert.equal(c["Art's renown"], "30%");
      const t = cellsOf(blocks, "Each faith's temples", faith.ref);
      assert.equal(t.Clergy, "50");
      assert.equal(t.Faithful, "5,000");
      assert.equal(t.Granary, "900 grain");
      assert.equal(t["To the hungry"], "40 grain");
      assert.equal(t.Teach, "25%");
      assert.equal(t.Since, "year 12");
    },
  );
  const all = [FOLK_STORE, VOICE_STORE, ART_STORE, URBAN_STORE, ACADEMY_STORE, TEMPLE_STORE].map(
    (n) => cultureRows(world, n),
  );
  emptied(all, () =>
    assert.deepEqual(cultureLedger(world, ledgerCtx(world)), [
      { type: "text", lines: [["No realm's culture has been weighed yet."]] },
    ]),
  );
});

test("powers: spies kept, and a land held by force from another realm", () => {
  const [r, other] = realms(),
    spies = spiesOf(world)!,
    occ = occupationOf(world)!;
  assert.ok(spies && occ, "the spies' and the occupations' stores stand on a peopled world");
  const cell = other.members.find((c) => !occ.of(c))!,
    before = cellsOf(
      powersLedger(world, ledgerCtx(world)),
      "Each realm's powers",
      `${r.ref}#powers`,
    ),
    was = [...spies.of(r.ref)];
  assert.ok(cell !== undefined);
  spies.set(r.ref, [...was, { in: other.ref, since: 30 }]);
  occ.begin(cell, r.ref, other.ref, 35);
  try {
    const blocks = powersLedger(world, ledgerCtx(world)),
      c = cellsOf(blocks, "Each realm's powers", `${r.ref}#powers`),
      o = cellsOf(blocks, "Each realm's powers", `${other.ref}#powers`);
    assert.equal(Number(c["Spies abroad"]), Number(before["Spies abroad"]) + 1);
    assert.equal((c["Held by force"] ?? "").split(",")[0], String(occ.heldBy(r.ref).length));
    assert.notEqual(o["Its lands held"], "none");
    assert.ok(Number(o["Spies within"]) >= 1);
    // (The realm holding the most by force stands first.)
    assert.equal(
      politiesOf(world).get(
        tableOf(blocks, "Each realm's powers").rows[0]!.ref!.split("#")[0] as never,
      )?.ended,
      null,
    );
  } finally {
    occ.end(cell);
    spies.set(r.ref, was);
  }
  assert.deepEqual(powersLedger(world, { ...ledgerCtx(world), standing: [] }), [
    { type: "text", lines: [["No realm's powers are reckoned yet."]] },
  ]);
});
