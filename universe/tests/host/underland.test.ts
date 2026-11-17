// A land's Underworld tab and what the land view draws of it (host/inspect/underland.ts): one honest line where nothing is kept;
// and, rows and records written by hand, its towns each a press from its law page, who holds it with its boss and killing, the
// realm's own crew, brigands on its roads and pirates off its coast, its numbers and what its realm does; the land view's holder in
// its own colour, its killing and its crew, and the groups who prey. Juniper sixty years on, everything put back after.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Block, Line } from "../../src/bridge/index.ts";
import type { Ref } from "../../src/kernel/index.ts";
import {
  GANG_ROW,
  ORG_ROW,
  gangsStore,
  orgLandsStore,
  orgsOf,
  politiesOf,
  populationContext,
  underworldOf,
  type Polity,
  type RealmOrgs,
  type RealmUnderworld,
  type RowStore,
} from "../../src/sim/index.ts";
import { ORG_KINDS } from "../../src/rules/index.ts";
import { landUnderworld, landUnderworldBlocks } from "../../src/host/inspect/underland.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { groupRef, opRef } from "../../src/host/underworld.ts";
import { orgRef } from "../../src/host/groups.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import { turfTiles, underworldMarkPage, underworldMarks } from "../../src/view/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 60, { start: "spread" });

const plain = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const refsOf = (l: Line) => l.flatMap((s) => (typeof s === "string" || !s.ref ? [] : [s.ref]));

/** The most peopled living realm, and its most peopled land that has a town a year old. */
function chosen(): { realm: Polity; cell: number } {
  const ctx = populationContext(world),
    year = yearNow(world),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    realm = [...politiesOf(world).living()].sort(
      (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
    )[0]!,
    cell = [...realm.members]
      .filter((c) =>
        ctx.settlements.inProvince(c).some((t) => t.population > 0 && t.founded < year),
      )
      .sort(
        (a, b) => (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0),
      )[0]!;
  return { realm, cell };
}

test("a land with nothing kept says so in one line, after its towns", () => {
  const { cell } = chosen(),
    rows = [gangsStore(world), orgLandsStore(world)].map((s) => [s, s?.get(cell)] as const);
  for (const [s] of rows) s?.drop(cell);
  try {
    const blocks = landUnderworldBlocks(world, cell),
      text = blocks.filter((b) => b.type === "text");
    // (Its realm's records may hold groups elsewhere; this land's own rows are gone.)
    if (!blocks.some((b) => b.type === "facts" && b.title !== "Its towns, and the law in each")) {
      assert.equal(text.length, 1);
      assert.match(
        plain((text[0] as Extract<Block, { type: "text" }>).lines[0]!),
        /No group holds/,
      );
    }
    const towns = blocks.find((b) => b.type === "facts" && b.title?.startsWith("Its towns"));
    assert.ok(towns && towns.type === "facts");
    // (Each town a press from its law page.)
    for (const r of towns.rows.filter((x) => x.label !== "Smaller towns"))
      assert.ok(
        refsOf(r.value).some((ref) => ref.endsWith("#law")),
        r.label,
      );
  } finally {
    for (const [s, r] of rows) if (s && r) s.set(cell, [...r]);
  }
});

test("written by hand: who holds it, the realm's crew, brigands and pirates, its numbers, and the land view's marks", () => {
  const { realm, cell } = chosen(),
    gangs = gangsStore(world)!,
    orgRows = orgLandsStore(world)!,
    under = underworldOf(world)!,
    orgs = orgsOf(world)!,
    event = world.events.at(0).id,
    other = world.events.at(1).id,
    wasUnder = under.of(realm.ref),
    wasOrgs = orgs.of(realm.ref),
    wasRows = [
      [gangs, gangs.get(cell)],
      [orgRows, orgRows.get(cell)],
    ] as const;
  const u: RealmUnderworld = {
    ...(wasUnder
      ? (structuredClone(wasUnder) as RealmUnderworld)
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
          killings: 0,
          street: 0,
          badge: 0,
          extortion: 0,
          badgePull: 0,
          crackEvent: null,
          pactEvent: null,
          told: 0,
          wars: [],
          gone: [],
        }),
    crackdown: 400,
    bites: 300,
    collusion: 50,
    feds: [],
    ops: [
      {
        id: 1,
        target: 7,
        name: "Varro",
        kind: 0,
        lands: [cell, cell + 1],
        since: 58,
        event: other,
        soldiers: 600,
        fallen: 3,
        taken: 9,
        bystanders: 2,
        displaced: 40,
        spent: 100,
        bosses: 0,
        clashes: 2,
        ended: null,
      },
      {
        id: 2,
        target: 8,
        name: "Grey",
        kind: 2,
        lands: [cell],
        since: 52,
        event,
        soldiers: 900,
        fallen: 0,
        taken: 0,
        bystanders: 0,
        displaced: 0,
        spent: 0,
        bosses: 0,
        clashes: 0,
        ended: 56,
      },
    ],
    groups: [
      {
        id: 7,
        name: "Varro",
        kind: 0,
        since: 50,
        event,
        home: cell,
        lands: [cell],
        boss: { name: "Old Varro", born: 10, since: 50 },
        bosses: 1,
        members: 40,
        wealth: 900,
        income: 300,
        share: 600,
        power: 700,
        rackets: 1,
        violence: 3,
        bribes: 20,
        means: { arms: 400, armour: 0, hidden: 0, word: 200, cost: 50 },
      },
      {
        id: 8,
        name: "Grey",
        kind: 2,
        since: 55,
        event: other,
        home: cell,
        lands: [],
        boss: { name: "Captain Grey", born: 20, since: 55 },
        bosses: 1,
        members: 12,
        wealth: 100,
        income: 50,
        share: 0,
        power: 200,
        rackets: 0,
        violence: 1,
        bribes: 0,
      },
    ],
  };
  const org = (id: number, name: string, kind: string, ev: Ref) => ({
      id,
      name,
      kind: ORG_KINDS.indexOf(kind as (typeof ORG_KINDS)[number]),
      aim: 0,
      aims: [1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      since: 50,
      event: ev,
      home: cell,
      lands: [cell],
      basis: 0,
      identity: "",
      means: 1,
      standing: 0,
      leader: { name: "Red", born: 10, since: 50 },
      leaders: 1,
      members: 30,
      wealth: 100,
      income: 50,
      takes: 40,
      gives: 0,
      violence: 2,
      power: 500,
    }),
    o: RealmOrgs = {
      ...(wasOrgs
        ? (structuredClone(wasOrgs) as RealmOrgs)
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
      orgs: [org(3, "Ash", "brigands", event), org(4, "Gull", "pirates", other)],
    };
  const g = new Array<number>(15).fill(0);
  g[GANG_ROW.control] = 450;
  g[GANG_ROW.group] = 8;
  g[GANG_ROW.kind] = 1;
  g[GANG_ROW.killings] = 125;
  g[GANG_ROW.protection] = 350;
  g[GANG_ROW.badge] = 200;
  const r = new Array<number>(21).fill(0);
  r[ORG_ROW.group] = 4;
  r[ORG_ROW.kind] = 1;
  r[ORG_ROW.hold] = 300;
  r[ORG_ROW.prey] = 80;
  r[ORG_ROW.seaPrey] = 40;
  r[ORG_ROW.killings] = 20;
  r[ORG_ROW.groups] = 2;
  under.put(realm.ref, u);
  orgs.put(realm.ref, o);
  gangs.set(cell, g);
  orgRows.set(cell, r);
  try {
    const blocks = landUnderworldBlocks(world, cell),
      facts = (title: string) => {
        const b = blocks.find((x) => x.type === "facts" && x.title === title);
        assert.ok(b && b.type === "facts", title);
        return b;
      };
    const held = facts("Who holds it").rows[0]!;
    assert.equal(held.label, "The Varro family");
    assert.ok(refsOf(held.value).includes(groupRef(realm.ref, event)));
    const parts = Object.fromEntries((held.parts ?? []).map((p) => [plain(p.label), p.value]));
    assert.equal(parts["its hold here"], "45%");
    assert.equal(parts["its boss"], "Old Varro, since year 50");
    assert.equal(parts["killed here"], "12.5 a year in 100,000");
    assert.equal(parts["of the trade under its protection"], "35%");
    assert.equal(parts["its means"], "arms, guarded word");
    // (The soldiers sent against them: the half of the one under way that is here; the ended one not.)
    const sent = facts("Soldiers sent against them").rows;
    assert.deepEqual(
      sent.map((x) => [x.label, plain(x.value)]),
      [
        ["Here now", "300 soldiers"],
        ["Since year 58", "against the Varro family"],
      ],
    );
    assert.ok(refsOf(sent[1]!.value).includes(opRef(realm.ref, other)));
    const crew = facts("The realm's own enforcers").rows[0]!;
    assert.ok(refsOf(crew.value).includes(groupRef(realm.ref, other)));
    const others = facts("Other groups in it").rows;
    assert.deepEqual(
      others.map((x) => x.label),
      ["The Ash brigands", "The Gull pirates"],
    );
    const ash = Object.fromEntries((others[0]!.parts ?? []).map((p) => [plain(p.label), p.value]));
    assert.equal(ash["its hold here"], "30%");
    assert.equal(
      ash["what it does here"],
      "8% of its road trade taken a year, 4% of its sea trade",
    );
    assert.ok(refsOf(others[0]!.value).includes(orgRef(realm.ref, event)));
    const stance = facts("Its numbers").rows.find((x) => x.label === "What its realm does")!;
    assert.match(plain(stance.value), /^a crackdown of 40%, biting 30%/);
    assert.ok(refsOf(stance.value).includes(`${realm.ref}#underworld`));
    // (The land's page carries the tab.)
    assert.ok(pageOf(world, `cell:0:${cell}`).tabs.some((t) => t.id === "underworld"));

    const view = landUnderworld(world, cell)!;
    assert.equal(view.holder?.ref, groupRef(realm.ref, event));
    assert.equal(view.holder?.hold, 0.45);
    assert.equal(view.killing, 12.5 + 2);
    assert.equal(view.badge, 0.2);
    assert.equal(view.badgeRef, groupRef(realm.ref, other));
    assert.equal(view.brigands?.ref, orgRef(realm.ref, event));
    assert.equal(view.pirates?.ref, orgRef(realm.ref, other));
    assert.equal(view.soldiers, 300);
    assert.equal(view.soldiersRef, opRef(realm.ref, other));
  } finally {
    if (wasUnder) under.put(realm.ref, structuredClone(wasUnder) as RealmUnderworld);
    else under.forget(realm.ref);
    if (wasOrgs) orgs.put(realm.ref, structuredClone(wasOrgs) as RealmOrgs);
    else orgs.forget(realm.ref);
    for (const [s, row] of wasRows)
      if (row) (s as RowStore).set(cell, [...row]);
      else (s as RowStore).drop(cell);
  }
});

test("a town's turf is drawn in its holder's colour within its reach, and nowhere else", () => {
  const size = 9,
    colors = new Uint8Array(size * size * 4).fill(100),
    out = turfTiles(colors, size, 1, [{ x: 0, z: 0, r: 0.5 }], [1, 0, 0], 0.5),
    at = (i: number, j: number) => out[(j * size + i) * 4]!;
  assert.equal(at(4, 4), Math.round(100 * 0.5 + 255 * 0.5));
  assert.equal(at(5, 4), Math.round(100 * 0.5 + 255 * 0.5));
  assert.equal(at(0, 0), 100);
  assert.equal(out[(4 * size + 4) * 4 + 1], 50);
  assert.equal(turfTiles(colors, size, 1, [], [1, 0, 0], 0.5), colors);
});

test("the land view's marks: killing and a crew over the greatest towns, brigands and pirates, each keyed by its page", () => {
  const u = {
      cell: 3,
      holder: {
        ref: "mob:pol:0:1:ev:0:9",
        name: "The Varro family",
        color: [1, 0, 0] as const,
        hold: 0.5,
      },
      killing: 12.5,
      badge: 0.2,
      badgeRef: "mob:pol:0:1:ev:0:10",
      prey: 0.08,
      seaPrey: 0.04,
      brigands: { ref: "org:pol:0:1:ev:0:11", name: "The Ash brigands" },
      pirates: { ref: "org:pol:0:1:ev:0:12", name: "The Gull pirates" },
      soldiers: 340,
      soldiersRef: "uop:pol:0:1:ev:0:13",
    },
    towns = [
      { ref: "town:0:1", population: 100, at: { x: 10, y: 50 } },
      { ref: "town:0:2", population: 900, at: { x: 20, y: 60 } },
      { ref: "town:0:3", population: 500, at: null },
      { ref: "town:0:4", population: 300, at: { x: 40, y: 80 } },
      { ref: "town:0:5", population: 50, at: { x: 50, y: 90 } },
    ],
    marks = underworldMarks(u, towns, { x: 5, y: 5 }, { x: 7, y: 7 });
  // (The three greatest, one of them out of sight: two marks; the least towns none.)
  assert.deepEqual(
    marks.map((m) => [m.text, underworldMarkPage(m.key)]),
    [
      ["🔴 12.5 killed in 100k · 🔵 the realm's own crew", u.holder.ref],
      ["🔴 12.5 killed in 100k · 🔵 the realm's own crew", u.holder.ref],
      ["🪖 340 soldiers against them", u.soldiersRef],
      ["🗡️ The Ash brigands", u.brigands.ref],
      ["🏴 The Gull pirates", u.pirates.ref],
    ],
  );
  assert.deepEqual(marks[0]!.at, { x: 20, y: 36 });
  // (The soldiers under the greatest town's name.)
  assert.deepEqual(marks[2]!.at, { x: 20, y: 82 });
  // (No killing, no crew, no one holding it: no mark over a town; a crew alone opens the crew's page.)
  assert.equal(
    underworldMarks(
      { ...u, killing: 0, badge: 0, brigands: null, pirates: null, soldiers: 0 },
      towns,
      null,
      null,
    ).length,
    0,
  );
  const crew = underworldMarks(
    { ...u, killing: 0.5, holder: null, brigands: null, pirates: null, soldiers: 0 },
    towns,
    null,
    null,
  );
  assert.equal(underworldMarkPage(crew[0]!.key), u.badgeRef);
  // (Killing where no one holds it: the town's law.)
  const law = underworldMarks(
    { ...u, holder: null, badge: 0, brigands: null, pirates: null, soldiers: 0 },
    towns,
    null,
    null,
  );
  assert.equal(underworldMarkPage(law[0]!.key), "town:0:2#law");
});
