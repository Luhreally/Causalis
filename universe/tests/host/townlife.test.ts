// A town's life beyond its work (host/inspect/townlife.ts): what goes on in it is read from the rows its land and realm keep,
// and is not there where they hold nothing. Juniper sixty years on, its greatest realm's most peopled land: a market town of
// some hundreds and villages about it. Rows are set down by hand: a family holding the land, its street's gangs, soldiers sent
// in, a ware the realm forbids. A collector only where a racket holds the land; a back-lane seller only under a bar (not a
// tax); a village has none of it; the same people each read, and no one else moved by them.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Ref } from "../../src/kernel/index.ts";
import {
  CONTRA_STORE,
  GANG_ROW,
  gangsStore,
  moneyStore,
  politiesOf,
  populationContext,
  underworldOf,
  type Polity,
  type RealmUnderworld,
} from "../../src/sim/index.ts";
import { CONTRA_CAUSES } from "../../src/rules/index.ts";
import {
  forgetTownLife,
  partOfStats,
  townGoingsBlock,
  townLifeOf,
} from "../../src/host/inspect/townlife.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { villagePlan } from "../../src/host/village.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import { momentOf, villageSolids, goingsOn } from "../../src/view/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 60, { start: "spread" });

function chosen(): { realm: Polity; cell: number; town: string; village: string } {
  const ctx = populationContext(world),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    realm = [...politiesOf(world).living()].sort(
      (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
    )[0]!,
    cell = [...realm.members]
      .filter((c) => ctx.settlements.inProvince(c).some((t) => t.population > 0))
      .sort(
        (a, b) => (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0),
      )[0]!,
    towns = [...ctx.settlements.inProvince(cell)]
      .filter((t) => t.population > 0)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1));
  return { realm, cell, town: towns[0]!.ref as string, village: towns.at(-1)!.ref as string };
}

const { realm, cell, town, village } = chosen(),
  contra = moneyStore(world, CONTRA_STORE)!,
  gangs = gangsStore(world)!,
  under = underworldOf(world)!,
  year = yearNow(world),
  rose = world.events.at(0).id,
  sent = world.events.at(1).id,
  kinds = (ref: string) => {
    forgetTownLife(world);
    return townLifeOf(world, ref).goings.map((g) => g.kind);
  },
  UNDER = ["collect", "corner", "seller", "posted", "guard"];

/** A ware the realm keeps as smuggled, for a cause (the first slot of its row), or none. */
function ware(cause: (typeof CONTRA_CAUSES)[number] | null): void {
  const row = new Array<number>(21).fill(0);
  if (cause) {
    row[0] = 3 + 1;
    row[1] = 400;
    row[2] = CONTRA_CAUSES.indexOf(cause) + 1;
    row[3] = 5000;
    row[4] = 200;
  }
  contra.set(realm.ref, row);
}

/** A family holding the land with a fifth of its trade under it, five small gangs on its street, and soldiers sent against it. */
function held(on: boolean): void {
  if (!on) {
    gangs.drop(cell);
    under.put(realm.ref, { ...record(), groups: [], ops: [] });
    return;
  }
  const row = new Array<number>(15).fill(0);
  row[GANG_ROW.control] = 400;
  row[GANG_ROW.group] = 7 + 1;
  row[GANG_ROW.kind] = 0 + 1;
  row[GANG_ROW.protection] = 200;
  row[GANG_ROW.gangs] = 5;
  row[GANG_ROW.street] = 120;
  gangs.set(cell, row);
  under.put(realm.ref, record());
}

function record(): RealmUnderworld {
  return {
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
    crackdown: 0,
    collusion: 0,
    feds: [],
    gone: [],
    wars: [],
    groups: [
      {
        id: 7,
        name: "Varro",
        kind: 0,
        since: 40,
        event: rose,
        home: cell,
        lands: [cell],
        boss: { name: "Old Varro", born: 10, since: 40 },
        bosses: 1,
        members: 40,
        wealth: 900,
        income: 300,
        share: 600,
        power: 700,
        rackets: 1,
        violence: 3,
        bribes: 0,
      },
    ],
    ops: [
      {
        id: 1,
        target: 7,
        name: "Varro",
        kind: 0,
        lands: [cell],
        since: year,
        event: sent,
        soldiers: 600,
        fallen: 3,
        taken: 9,
        bystanders: 3,
        displaced: 0,
        spent: 0,
        bosses: 0,
        clashes: 1,
        ended: null,
      },
    ],
  };
}

test("a land that keeps nothing of an underworld shows none of it in its towns; its groups may still meet", () => {
  ware(null);
  held(false);
  for (const ref of [town, village])
    assert.deepEqual(
      kinds(ref).filter((k) => UNDER.includes(k)),
      [],
      `${ref} shows an underworld its land does not keep`,
    );
  const plan = villagePlan(world, town as Ref, undefined, 120);
  assert.ok(!plan.people.some((p) => p.outsider), "no one not of the town stands in it");
});

test("a seller stands in a back lane only where the realm bars a ware that crosses unseen: not for a tax, not in a village", () => {
  held(false);
  ware("tariff");
  assert.ok(!kinds(town).includes("seller"), "a tariff is a tax, not a bar");
  ware("excise");
  assert.ok(!kinds(town).includes("seller"));
  ware("law");
  assert.ok(kinds(town).includes("seller"), "forbidden, and crossing unseen: sold in a back lane");
  assert.ok(!kinds(village).includes("seller"), "not in a village of the same land");
  const g = townLifeOf(world, town).goings.find((x) => x.kind === "seller")!;
  assert.match(g.doing, /^Selling .+, which .+ forbids/);
  assert.match(g.why, /40% of what .+ crosses its borders unseen/);
  ware(null);
  assert.ok(!kinds(town).includes("seller"), "the bar gone, the seller is");
});

test("a collector, a corner kept, a head's house guarded and soldiers posted are there only while the land's rows hold them", () => {
  ware(null);
  held(true);
  const got = kinds(town);
  for (const k of ["collect", "corner", "guard", "posted"])
    assert.ok(got.includes(k as never), `${k} in the land's first town: ${got.join()}`);
  assert.deepEqual(
    kinds(village).filter((k) => UNDER.includes(k)),
    [],
    "a village of the same land has none of it",
  );
  const life = townLifeOf(world, town),
    by = (k: string) => life.goings.find((g) => g.kind === k)!;
  assert.match(by("collect").doing, /^Collecting for the Varro family/);
  assert.match(by("collect").toDoing!, /^Paying the Varro family's collector what is asked/);
  assert.match(by("collect").why, /20% of this land's trade is under its protection/);
  assert.equal(by("collect").of.ref, `mob:${realm.ref}:${rose}`);
  assert.match(by("guard").of.ref, /^boss:/);
  assert.match(by("posted").of.ref, /^uop:/);
  assert.ok(by("collect").who.length >= 1 && by("collect").to!.length >= 2);
  assert.ok(by("corner").who.length >= 3 && by("corner").who.length <= 6);
  assert.ok(life.outsiders.length >= 2 && life.outsiders.length <= 6, "soldiers, capped");
  // No word of how.
  for (const g of life.goings)
    assert.doesNotMatch(
      `${g.words} ${g.doing} ${g.toDoing ?? ""} ${g.why}`,
      /\b(knife|gun|rifle|poison|powder|recipe|dose|by (cutting|shooting|beating))\b/i,
    );
  held(false);
  assert.deepEqual(
    kinds(town).filter((k) => UNDER.includes(k)),
    [],
  );
});

test("the same people are of each thing every read, whatever else goes on, and are drawn as themselves", () => {
  ware(null);
  held(true);
  forgetTownLife(world);
  const a = townLifeOf(world, town);
  ware("law");
  forgetTownLife(world);
  const b = townLifeOf(world, town);
  for (const k of ["collect", "corner", "guard"] as const)
    assert.deepEqual(
      b.goings.find((g) => g.kind === k)!.who,
      a.goings.find((g) => g.kind === k)!.who,
      `${k}: the same people with a seller in the town as without`,
    );
  // Year on year: those still holding their lines are still of it.
  const next = townLifeOf(world, town, year + 1).goings.find((g) => g.kind === "corner")!.who,
    now = b.goings.find((g) => g.kind === "corner")!.who;
  assert.ok(now.filter((r) => next.includes(r)).length >= now.length - 2, `${now} then ${next}`);

  const plan = villagePlan(world, town as Ref, undefined, 120),
    refs = new Set(plan.people.map((p) => p.ref));
  for (const g of plan.goings!) for (const r of g.who) assert.ok(refs.has(r), `${g.kind}: ${r}`);
  // Those not of the town stand last, so no one's place among those drawn moves.
  const first = plan.people.findIndex((p) => p.outsider);
  assert.ok(first > 0 && plan.people.slice(first).every((p) => p.outsider));
  held(false);
  ware(null);
  forgetTownLife(world);
  const bare = villagePlan(world, town as Ref, undefined, 120);
  assert.deepEqual(
    plan.people.slice(0, bare.people.length).map((p) => p.ref),
    bare.people.map((p) => p.ref),
    "everyone drawn without it is drawn with it, in the same place",
  );
});

test("the town's page lists what goes on with whose it is and someone to go to; a member's page says what they are part of", () => {
  ware("law");
  held(true);
  forgetTownLife(world);
  const block = townGoingsBlock(world, town)!;
  assert.equal(block.type, "list");
  const text = JSON.stringify(block);
  assert.match(text, /The Varro family takes payment from those who trade here/);
  assert.match(text, /Go to /);
  assert.match(text, new RegExp(`mob:${realm.ref}`));
  const page = pageOf(world, town);
  assert.match(JSON.stringify(page.tabs[0]!.blocks), /Going on here/);
  const life = townLifeOf(world, town),
    collect = life.goings.find((g) => g.kind === "collect")!,
    mine = partOfStats(world, town, collect.who[0]!),
    pays = partOfStats(world, town, collect.to![0]!);
  assert.equal(mine[0]!.label, "Part of");
  assert.match(JSON.stringify(mine), /collecting for the Varro family/);
  assert.equal(pays[0]!.label, "Pays");
  assert.match(JSON.stringify(pageOf(world, collect.who[0]!)), /Part of/);
  assert.equal(townGoingsBlock(world, village)?.type ?? "list", "list");

  // And in the town's day: its collector is beside one who pays on a collecting day, and says whose it is.
  const plan = villagePlan(world, town as Ref, undefined, 120),
    ground = villageSolids(plan),
    day0 = Math.floor(world.now / 86_400);
  let seen = 0;
  for (let d = day0; d < day0 + 14 && !seen; d++) {
    const on = goingsOn(plan, d, ground).find((g) => g.going.kind === "collect");
    if (!on) continue;
    const i = plan.people.findIndex((p) => p.ref === collect.who[0]);
    for (let s = on.from; s < on.to; s += 240) {
      const m = momentOf(plan, i, d * 86_400 + s);
      if (m.of?.ref === collect.of.ref && /^Collecting for/.test(m.why ?? "")) seen++;
    }
  }
  assert.ok(seen > 0, "the collector is seen collecting on a collecting day");
  held(false);
  ware(null);
  forgetTownLife(world);
});
