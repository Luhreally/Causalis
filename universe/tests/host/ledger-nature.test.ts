// The ledger's Arms, Nature and Making tabs (asked 2026-11-16): a world that keeps nothing of them says so in one honest line;
// and rows written by hand into the stores (a realm's footing, a fleet, a sea fought for, a siege, an eruption and a flood, a
// land's material ways) show in the right table and column. Juniper forty years on, its rows set down by hand and put back after.
import { test } from "node:test";
import assert from "node:assert/strict";
import { World, seedFromText, type Ref } from "../../src/kernel/index.ts";
import type { Block, Line } from "../../src/bridge/index.ts";
import {
  armingOf,
  firesOf,
  floodsOf,
  materialsOf,
  navyOf,
  siegesOf,
  type Footing,
} from "../../src/sim/index.ts";
import { MATERIAL_WAYS } from "../../src/rules/index.ts";
import { armsLedger, makingLedger, natureLedger } from "../../src/host/inspect/ledger-nature.ts";
import { ledgerCtx, type LedgerCtx } from "../../src/host/inspect/ledger-kit.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 40, { start: "spread" });

const said = (l: Line): string => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const words = (bs: readonly Block[]): string =>
  bs.flatMap((b) => (b.type === "text" ? b.lines.map(said) : [])).join(" | ");
function table(bs: readonly Block[], title: string) {
  const t = bs.find((b) => b.type === "table" && b.title === title);
  assert.ok(
    t && t.type === "table",
    `no table "${title}" in ${bs.map((b) => ("title" in b ? b.title : b.type)).join(", ")}`,
  );
  return t;
}
/** A row's cells, said, by its column's heading. */
function cellsOf(t: Extract<Block, { type: "table" }>, ref: string): Record<string, string> {
  const row = t.rows.find((r) => r.ref === ref);
  assert.ok(row, `no row ${ref} in "${t.title}"`);
  return Object.fromEntries(t.columns.map((c, i) => [c, said(row.cells[i]!)]));
}

test("a world that keeps none of it says so in one honest line, and draws no empty table", () => {
  const bare = new World(seedFromText("nothing kept")),
    none: LedgerCtx = { now: 0, standing: [], people: new Map(), peopleOf: () => 0 };
  for (const [tab, line] of [
    [armsLedger(bare, none), "No realm has armed against another yet."],
    [natureLedger(bare, none), "Nothing of the land's fires, floods or crops is kept yet."],
    [makingLedger(bare, none), "No realm makes a material way of its own yet."],
  ] as const) {
    assert.equal(words(tab), line);
    assert.ok(!tab.some((b) => b.type === "table"));
  }
});

test("a realm's footing, its fleet, a sea fought for and a siege, written by hand, show in the Arms tab", () => {
  const lc = ledgerCtx(world),
    [realm, other] = lc.standing;
  assert.ok(realm && other, "two realms stand at forty years");
  const arming = armingOf(world)!,
    navy = navyOf(world)!,
    sieges = siegesOf(world)!,
    event = world.events.at(0).id,
    war = "war:0:9999" as Ref,
    wasFooting = arming.of(realm.ref),
    wasFleet = navy.of(realm.ref);
  const footing: Footing = {
    realm: realm.ref,
    footing: 0.12,
    wanted: 0.2,
    against: other.ref,
    threat: 0.5,
    ratio: 1.3,
    fatigue: 1,
    war: null,
    backs: war,
    helps: other.ref,
    sends: 0.05,
    gift: 0,
    made: 1000,
    race: event,
    backed: event,
    spare: 0.3,
    stake: 0,
    disarm: 0.25,
    disarmUntil: lc.now + 10,
    disarmEvent: event,
  };
  arming.set(footing);
  navy.set({
    realm: realm.ref,
    tons: 5000,
    built: 200,
    sunk: 0,
    wanted: 6000,
    quality: 1.25,
    merchant: 800,
    coast: 0.4,
    blockaded: 0.3,
    cost: 900,
  });
  navy.setSea({ war, command: [0.7, 0.3], sunk: [100, 400], won: event, blockade: null });
  sieges.set({
    war,
    land: realm.seat,
    seat: true,
    since: lc.now - 2,
    months: 7.4,
    breach: 0.25,
    campDead: 120,
    townDead: 340,
    relief: 0.1,
    event,
  });
  try {
    const tab = armsLedger(world, lc),
      foot = cellsOf(table(tab, "War footing"), `${realm.ref}#army`);
    assert.equal(foot.Footing, "12%");
    assert.equal(foot.Wants, "20%");
    assert.match(foot["Arms against"]!, new RegExp(`${other.town}.*\\(a race\\)`));
    assert.match(foot["Sends arms"]!, /^5% to /);
    assert.equal(foot["Stood down"], `25% until ${lc.now + 10}`);
    const fleet = cellsOf(table(tab, "Fleets"), `${realm.ref}#army`);
    assert.deepEqual(
      [fleet.Warships, fleet["Worth a tonne"], fleet["Merchant ships"], fleet.Blockaded],
      ["5,000 t", "1.25", "800 t", "30% cut"],
    );
    const sea = cellsOf(table(tab, "Seas fought for"), war);
    assert.deepEqual(
      [sea["Its sea held"], sea["Ships sunk"], sea.Now],
      ["70% · 30%", "100 t · 400 t", "the sea won"],
    );
    const siege = cellsOf(table(tab, "Sieges laid now"), event);
    assert.match(siege.Land!, /\(its seat\)$/);
    assert.deepEqual(
      [siege["Food left"], siege["Walls broken"], siege.Dead, siege["By sea"]],
      ["7 months", "25%", "120 camp · 340 town", "10%"],
    );
    // (Every column sorts.)
    for (const b of tab)
      if (b.type === "table")
        for (const r of b.rows) assert.equal(r.keys?.length, b.columns.length, b.title);
    assert.match(words(tab), /Most armed: /);
  } finally {
    if (wasFooting) arming.set({ ...wasFooting });
    else arming.drop(realm.ref);
    if (wasFleet) navy.set({ ...wasFleet });
    else navy.drop(realm.ref);
    navy.dropSea(war);
    sieges.end(war);
  }
});

test("an eruption and a flood, written by hand, show among the fires below and floods, under the realm that holds the land", () => {
  const lc = ledgerCtx(world),
    realm = lc.standing[0]!,
    fires = firesOf(world)!,
    floods = floodsOf(world)!,
    event = world.events.at(0).id;
  fires.eruptions.push({
    cell: realm.seat,
    year: lc.now,
    vei: 4,
    kind: "arc",
    dead: 77,
    sulphur: 0,
    tephra: 0,
    event: null,
  });
  floods.floods.push({ cell: realm.seat, year: lc.now, size: 250, dead: 12, fields: 100, event });
  try {
    const tab = natureLedger(world, lc),
      struck = table(tab, "Fires below and floods, newest first");
    const rows = struck.rows;
    assert.ok(
      rows.some((r) => said(r.cells[1]!) === "An eruption of 4" && said(r.cells[4]!) === "77"),
    );
    assert.ok(rows.some((r) => r.ref === event && said(r.cells[1]!) === "A great flood"));
    const byRealm = table(tab, "Crops, herds and want, realm by realm"),
      own = byRealm.rows.find((r) => r.ref === realm.ref);
    assert.ok(own, "the realm has its row");
    assert.match(said(own.cells[7]!), /^\d+ \(\d+ dead\) · \d+ \(\d+ drowned\)$/);
    assert.ok(tab.some((b) => b.type === "facts" && b.title === "The world beyond"));
  } finally {
    fires.eruptions.pop();
    floods.floods.pop();
  }
});

test("a land's material ways, written by hand, show under its realm and in each way's row", () => {
  const lc = ledgerCtx(world),
    realm = lc.standing[0]!,
    store = materialsOf(world)!,
    was = store.get(realm.seat),
    steel = MATERIAL_WAYS.findIndex((w) => w.id === "alloy-steel"),
    concrete = MATERIAL_WAYS.findIndex((w) => w.id === "concrete"),
    years = MATERIAL_WAYS.map(() => 0);
  years[steel] = lc.now - 5;
  years[concrete] = lc.now + 1;
  store.set({
    cell: realm.seat,
    made: (1 << steel) | (1 << concrete),
    purity: 9990,
    year: lc.now - 1,
    event: null,
    years,
  });
  try {
    const tab = makingLedger(world, lc),
      row = cellsOf(table(tab, "What each makes, and its fire"), realm.ref);
    assert.ok(Number(row.Ways!.split(" ")[0]) >= 2, row.Ways);
    assert.match(row["Of kinds"]!, /alloys/);
    assert.match(row["Of kinds"]!, /binders/);
    assert.equal(row.Newest, `concrete (${lc.now + 1})`);
    assert.equal(row.Purity, "99.9 nines");
    assert.match(row["Hottest fire"]!, /°C|no fire/);
    const ways = table(tab, "Each way, where it is made"),
      names = ways.rows.map((r) => said(r.cells[0]!));
    assert.ok(names.includes("Alloy steel") && names.includes("Concrete"), names.join(", "));
    assert.ok(!words(tab).includes("No realm makes"));
  } finally {
    store.set(
      was
        ? { ...was, years: [...was.years] }
        : {
            cell: realm.seat,
            made: 0,
            purity: 0,
            year: 0,
            event: null,
            years: MATERIAL_WAYS.map(() => 0),
          },
    );
  }
});
