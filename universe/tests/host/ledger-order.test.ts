// The ledger's Underworld, Groups and Houses tabs (2026-11-16): every crime group, group and great house of every realm in one
// table each, read off the order's stores. Rows written by hand into the stores of Juniper forty years on show up in the right
// table and columns, and are put back after; a system whose records are all set aside gives its one honest line.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Ref, World } from "../../src/kernel/index.ts";
import type { Block, Line, Row } from "../../src/bridge/index.ts";
import {
  SMUGGLE,
  SMUGGLE_STORE,
  housesOf,
  moneyStore,
  orgsOf,
  underworldOf,
  type Polity,
  type RealmHouses,
  type RealmOrgs,
  type RealmUnderworld,
} from "../../src/sim/index.ts";
import { ledgerCtx } from "../../src/host/inspect/ledger-kit.ts";
import {
  groupsLedger,
  housesLedger,
  underworldLedger,
} from "../../src/host/inspect/ledger-order.ts";
import { groupRef } from "../../src/host/underworld.ts";
import { orgRef } from "../../src/host/groups.ts";
import { houseRef } from "../../src/host/family.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 40, { start: "spread" });

const words = (l: Line): string => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const table = (blocks: Block[], title: string) => {
  const b = blocks.find((x) => x.type === "table" && x.title === title);
  assert.ok(b && b.type === "table", `a table "${title}"`);
  return b;
};
const rowOf = (rows: readonly Row[], ref: string): Row => {
  const r = rows.find((x) => x.ref === ref);
  assert.ok(r, `a row for ${ref}`);
  return r;
};
const text = (blocks: Block[]) =>
  blocks.flatMap((b) => (b.type === "text" ? b.lines.map(words) : [])).join("\n");

/** The most peopled standing realm. */
function realmOf(w: World): Polity {
  return ledgerCtx(w).standing[0]!;
}

/** A store's records set aside for a test, and put back after. */
function setAside<T>(
  store: {
    realmsKept(): Ref[];
    of(r: Ref): T | undefined;
    put(r: Ref, v: T): void;
    forget(r: Ref): void;
  },
  run: () => void,
) {
  const was = store.realmsKept().map((r) => [r, structuredClone(store.of(r)!)] as const);
  try {
    for (const [r] of was) store.forget(r);
    run();
  } finally {
    for (const [r, v] of was) store.put(r, v as T);
  }
}

/** One realm's record written by hand for a test, and put back after. */
function withRecord<T>(
  store: { of(r: Ref): T | undefined; put(r: Ref, v: T): void; forget(r: Ref): void },
  realm: Ref,
  v: T,
  run: () => void,
) {
  const was = store.of(realm);
  store.put(realm, v);
  try {
    run();
  } finally {
    if (was) store.put(realm, structuredClone(was) as T);
    else store.forget(realm);
  }
}

test("a world with no crime group, group or great house kept gives each tab its honest line", () => {
  const under = underworldOf(world),
    orgs = orgsOf(world),
    houses = housesOf(world),
    smuggle = moneyStore(world, SMUGGLE_STORE),
    bars = moneyStore(world, "money.prohibition");
  assert.ok(under && orgs && houses, "the order's stores stand on a peopled world");
  // (Round B's realm rows set aside too: with nothing kept at all, the underworld says so alone.)
  const kept = [smuggle, bars].flatMap((s) =>
    s ? s.keys().map((k) => [s, k, [...s.get(k)!]] as const) : [],
  );
  for (const [s, k] of kept) s.drop(k);
  try {
    setAside(under, () =>
      setAside(orgs, () =>
        setAside(houses, () => {
          const lc = ledgerCtx(world);
          assert.deepEqual(underworldLedger(world, lc), [
            { type: "text", lines: [["No crime group has formed in this world yet."]] },
          ]);
          assert.deepEqual(groupsLedger(world, lc), [
            { type: "text", lines: [["No group has formed in this world yet."]] },
          ]);
          assert.deepEqual(housesLedger(world, lc), [
            { type: "text", lines: [["No great house has risen in this world yet."]] },
          ]);
        }),
      ),
    );
  } finally {
    for (const [s, k, r] of kept) s.set(k, r);
  }
});

test("a crime group and a gang war written by hand show in the Underworld tab's tables, its realm's smuggling with them", () => {
  const under = underworldOf(world)!,
    realm = realmOf(world),
    event = world.events.at(0).id,
    cell = realm.members[0]!,
    was = under.of(realm.ref),
    rec: RealmUnderworld = {
      ...(was
        ? (structuredClone(was) as RealmUnderworld)
        : {
            last: 0,
            next: 0,
            want: 0,
            supply: 0,
            pool: 0,
            veterans: 0,
            protectRent: 0,
            banRent: 0,
            tariffRent: 0,
            borderRent: 0,
            captured: 0,
            smuggleRent: 0,
            bites: 0,
            cost: 0,
            seized: 0,
            badge: 0,
            extortion: 0,
            badgePull: 0,
            crackEvent: null,
            pactEvent: null,
            told: 0,
            feds: [],
            gone: [],
          }),
      crackdown: 0,
      collusion: 620,
      killings: 30,
      street: 4,
      badge: 0,
      groups: [
        {
          id: 9,
          name: "Varro",
          kind: 1,
          since: 31,
          event,
          home: cell,
          lands: [cell],
          boss: { name: "Tamsin Varro", born: 5, since: 31 },
          bosses: 1,
          members: 240,
          wealth: 98_765_432,
          income: 1000,
          share: 400,
          power: 700,
          rackets: 0b11,
          violence: 12,
          bribes: 50,
        },
      ],
      wars: [
        {
          a: 9,
          b: 10,
          names: ["Varro", "Ash"],
          kind: 1,
          since: 35,
          event,
          ended: null,
          fallen: 41,
        },
      ],
      gone: [
        {
          name: "Morrow",
          kind: 0,
          since: 12,
          year: 33,
          how: "absorbed",
          into: "Varro",
          rose: event,
          event,
        },
      ],
    };
  const smuggle = moneyStore(world, SMUGGLE_STORE)!,
    had = smuggle.get(realm.ref),
    row = new Array(6).fill(0);
  row[SMUGGLE.share] = 340;
  smuggle.set(realm.ref, row);
  try {
    withRecord(under, realm.ref, rec, () => {
      const blocks = underworldLedger(world, ledgerCtx(world)),
        groups = table(blocks, "Every crime group");
      assert.equal(groups.filter, 2);
      assert.deepEqual(groups.columns.slice(0, 3), ["Group", "Realm", "Kind"]);
      const g = rowOf(groups.rows, groupRef(realm.ref, event));
      assert.deepEqual(g.cells.map(words), [
        "The Varro cartel",
        realm.town,
        "cartel",
        "Tamsin Varro",
        "1",
        "240",
        words([g.cells[6]![0]!]),
        "protection, smuggling",
        "12",
        "bought 62%",
      ]);
      assert.equal(g.keys![2], "cartel");
      assert.equal(g.keys![6], 98_765_432);
      const realms = table(blocks, "Each realm under the law"),
        rr = rowOf(realms.rows, `${realm.ref}#underworld`);
      assert.equal(words(rr.cells[2]!), "34%", "its smuggled share");
      assert.equal(words(rr.cells[7]!), "62%", "its officers bought");
      assert.equal(words(rr.cells[8]!), "34", "its killing a year: of groups and street");
      const wars = table(blocks, "Wars between groups");
      assert.equal(words(wars.rows[0]!.cells[0]!), "The Varro cartel against the Ash cartel");
      assert.equal(words(wars.rows[0]!.cells[2]!), "35, still fought");
      assert.match(text(blocks), /Most smuggled past its borders: /);
      const ended = table(blocks, "Groups whose hold ended");
      // (Of the world's own ended groups too: the one written by hand, wherever it falls among them.)
      const morrow = ended.rows.find((x) => words(x.cells[0]!) === "The Morrow family");
      assert.ok(morrow, "the group written by hand is among those whose hold ended");
      assert.deepEqual(morrow.cells.map(words), [
        "The Morrow family",
        realm.town,
        "12–33",
        "taken into the Varro family",
      ]);
      const told = blocks.find((b) => b.type === "facts" && b.title === "All told");
      assert.ok(told && told.type === "facts");
      assert.ok(told.rows.some((s) => s.label === "Wars between them still fought"));
    });
  } finally {
    if (had) smuggle.set(realm.ref, [...had]);
    else smuggle.drop(realm.ref);
  }
});

test("a group written by hand shows in the Groups tab, by kind, with its standing and patron", () => {
  const orgs = orgsOf(world)!,
    ctx = ledgerCtx(world),
    realm = ctx.standing[0]!,
    payer = ctx.standing[1] ?? realm,
    event = world.events.at(1).id,
    cell = realm.members[0]!,
    was = orgs.of(realm.ref),
    rec: RealmOrgs = {
      ...(was
        ? (structuredClone(was) as RealmOrgs)
        : {
            last: 0,
            next: 0,
            stakes: [],
            gather: [],
            suppression: 0,
            killings: 0,
            taken: 0,
            pays: 0,
            rising: 0,
            plot: 0,
            feds: [],
            gone: [],
          }),
      orgs: [
        {
          id: 4,
          name: "Kesh",
          kind: 1,
          aim: 0,
          aims: [700, 0, 300, ...new Array(12).fill(0)],
          since: 22,
          event,
          home: cell,
          lands: [cell],
          basis: 0,
          identity: "",
          means: 0,
          standing: 0,
          leader: { name: "Orrin", born: 1, since: 22 },
          leaders: 1,
          members: 777_777,
          wealth: 10,
          income: 1,
          takes: 500,
          gives: 0,
          violence: 8,
          power: 900,
          patron: payer.ref,
        },
      ],
    };
  withRecord(orgs, realm.ref, rec, () => {
    const blocks = groupsLedger(world, ledgerCtx(world)),
      every = table(blocks, "Every group");
    assert.equal(every.filter, 1);
    const row = every.rows[0]!;
    assert.equal(row.ref, orgRef(realm.ref, event), "the most members first");
    assert.equal(words(row.cells[0]!), "The Kesh pirates");
    assert.equal(words(row.cells[1]!), "pirates");
    assert.equal(words(row.cells[2]!), realm.town);
    assert.equal(
      words(row.cells[3]!),
      "preying on trade (70%); guarding its own (30%)",
      "its two greatest aims",
    );
    assert.equal(words(row.cells[4]!), "777,777");
    assert.equal(words(row.cells[6]!), `hired by ${payer.town}`);
    assert.equal(row.keys![1], "pirates", "its kind is its filter's word");
    const kinds = table(blocks, "Groups by kind");
    assert.ok(kinds.rows.some((r) => words(r.cells[0]!) === "Pirates"));
    assert.match(text(blocks), /Most members: The Kesh pirates \(777,777 members\)/);
  });
});

test("a great house and an ended one written by hand show in the Houses tab", () => {
  const houses = housesOf(world)!,
    realm = realmOf(world),
    event = world.events.at(2).id,
    end = world.events.at(3).id,
    was = houses.of(realm.ref),
    rec: RealmHouses = {
      ...(was
        ? (structuredClone(was) as RealmHouses)
        : {
            last: 0,
            selectorate: 100,
            winning: 30,
            all: 1000,
            loyalty: 0,
            favours: 0,
            members: [],
            nepotism: 250,
            hereditary: 0,
            rival: 0,
            following: 0,
            grift: 0,
            parted: 0,
            skim: 0,
            rents: 0,
            burden: 0,
            crownEvent: null,
            next: 0,
          }),
      houses: [
        {
          id: 3,
          name: "Morrow",
          origin: 0,
          since: 12,
          seat: realm.seat,
          wealth: 987_654_321,
          land: 0,
          offices: 450,
          grants: 0,
          farm: 0,
          income: 0,
          power: 600,
          titled: 1,
          crown: 1,
          headBorn: 0,
          generation: 3,
          heirs: 2,
          event,
        },
      ],
      gone: [{ name: "Fallow", origin: 1, since: 5, year: 30, how: "purged", event: end }],
    };
  withRecord(houses, realm.ref, rec, () => {
    const blocks = housesLedger(world, ledgerCtx(world)),
      every = table(blocks, "Every great house"),
      row = every.rows[0]!;
    assert.equal(row.ref, houseRef(realm.ref, event), "the richest first");
    assert.deepEqual(
      [0, 1, 3, 5, 6, 7, 8].map((i) => words(row.cells[i]!)),
      ["Morrow 👑", realm.town, "60%", "45%", "yes", "3", "12"],
    );
    const ended = table(blocks, "Ended houses, the latest first"),
      e = ended.rows.find((r) => words(r.cells[0]!) === "the house of Fallow");
    assert.ok(e, "the ended house listed");
    assert.deepEqual(e.cells.slice(2).map(words), ["5", "30", "purged by the crown"]);
    assert.match(text(blocks), /Richest house: /);
  });
});
