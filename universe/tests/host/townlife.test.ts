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
  afterCourt,
  fightPeopleBlock,
  headLeader,
  heldReading,
  forgetTownLife,
  partOfStats,
  peopleHereBlock,
  townGoingsBlock,
  townLifeOf,
  townRolesOf,
} from "../../src/host/inspect/townlife.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { readingsOf } from "../../src/host/inspect/barread.ts";
import {
  casesOf,
  folkOf,
  forgetDockets,
  runningOf,
  type Case,
} from "../../src/host/inspect/justice.ts";
import { villagePlan } from "../../src/host/village.ts";
import { leadersOf, leadersOfTown, seatTownOf, withFigures } from "../../src/host/leaders.ts";
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
        // (Against another family than the one that holds the land: its own collector goes on as ever.)
        target: 8,
        name: "Grey",
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
    // (Its key figures are laid into the plan after: a group's head, who leads what it holds.)
    refs = new Set(withFigures(world, plan).people.flatMap((p) => [p.ref, p.figure ?? p.ref]));
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
  // (One who pays may be of a lawful group of the town besides: the line that says whom they pay, wherever it stands.)
  assert.ok(
    pays.some((x) => x.label === "Pays"),
    JSON.stringify(pays),
  );
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

test("a member stays the same one through a year's turn, a takeover and soldiers sent in; what they say changes with it", () => {
  ware(null);
  held(true);
  forgetTownLife(world);
  const rec = record();
  under.put(realm.ref, { ...rec, ops: [{ ...rec.ops![0]!, target: 7, name: "Varro" }] });
  forgetTownLife(world);
  const now = townLifeOf(world, town).goings.find((g) => g.kind === "collect")!;
  assert.equal(now.since, 40, "the family's since");
  // (Soldiers are in the land against the family: its collector lies low.)
  assert.match(
    now.quiet ?? "",
    /^Lying low while soldiers sent against the Varro family are in the streets/,
  );
  assert.match(JSON.stringify(partOfStats(world, town, now.who[0]!)), /lying low/);
  // The soldiers gone: collecting as ever, the same one; and the same one a year on.
  under.put(realm.ref, { ...rec, ops: [] });
  forgetTownLife(world);
  const free = townLifeOf(world, town).goings.find((g) => g.kind === "collect")!;
  assert.equal(free.quiet, undefined);
  assert.deepEqual(free.who, now.who);
  assert.deepEqual(
    townLifeOf(world, town, year + 1).goings.find((g) => g.kind === "collect")!.who,
    free.who,
    "the same collector the year after",
  );
  // Taken over: another family holds the land. The same one collects, now for the victor.
  under.put(realm.ref, {
    ...rec,
    ops: [],
    groups: [{ ...rec.groups[0]!, id: 7, name: "Grey", event: sent, since: year }],
  });
  forgetTownLife(world);
  const taken = townLifeOf(world, town).goings.find((g) => g.kind === "collect")!;
  assert.deepEqual(taken.who, free.who);
  assert.match(taken.doing, /^Collecting for the Grey family/);
  assert.equal(taken.since, year);
  // A group's page and its land's Underworld tab lead to its people in the town.
  const here = peopleHereBlock(world, taken.of.ref)!;
  assert.equal(here.type, "list");
  assert.match(JSON.stringify(here), /Its people here/);
  assert.ok(JSON.stringify(here).includes(taken.who[0]!));
  assert.match(JSON.stringify(pageOf(world, taken.of.ref)), /Its people here/);
  held(false);
  forgetTownLife(world);
  assert.equal(peopleHereBlock(world, taken.of.ref), null, "no group, no people of it");
});

test("one of a group brought before the court for what its people do here is the town's own named one of it, and never put to death", () => {
  ware("law");
  held(true);
  forgetDockets(world);
  forgetTownLife(world);
  let stood = 0;
  for (let y = year - 4; y <= year; y++) {
    const roles = townRolesOf(world, town, y),
      collectors = new Set(roles.goings.filter((g) => g.kind === "collect").flatMap((g) => g.who)),
      ofIt = new Set(roles.goings.flatMap((g) => g.who));
    for (const c of casesOf(world, town, y)) {
      if (!c.grave || c.accused.outside) continue;
      assert.notEqual(c.outcome, "death", `${c.ref}: one of the town's lines put to death`);
      if (c.offence !== "extort" || !ofIt.has(c.accused.ref)) continue;
      stood++;
      assert.ok(collectors.has(c.accused.ref), `${c.ref}: the one who collects answers for it`);
      assert.equal(c.group?.name, "the Varro family");
      // Their name leads what they did, as any case's does: a person, not "one of the family's own".
      assert.doesNotMatch(c.accused.name, /^one of/);
    }
  }
  assert.ok(stood > 0, "a collector stood for what was taken by threat in these years");
  // The same reading every time, whatever was read before it.
  const a = JSON.stringify(
    casesOf(world, town, year - 2).map((c) => [c.ref, c.accused.ref, c.sentence]),
  );
  forgetDockets(world);
  forgetTownLife(world);
  casesOf(world, town, year);
  assert.equal(
    JSON.stringify(casesOf(world, town, year - 2).map((c) => [c.ref, c.accused.ref, c.sentence])),
    a,
  );
  held(false);
  ware(null);
  forgetDockets(world);
  forgetTownLife(world);
});

test("one the court holds is off what they were at; another of the same part takes it up, saying from whom; one let go is back at it", () => {
  ware(null);
  held(true);
  forgetDockets(world);
  forgetTownLife(world);
  const roles = townRolesOf(world, town),
    s = populationContext(world).settlements.get(town as Ref)!,
    pool = folkOf(world, s, year).slots(96),
    collect = roles.goings.find((g) => g.kind === "collect")!,
    man = collect.who[0]!,
    gaol = { ref: "case:x:1", year: year - 1, came: "was locked up for four years" } as Case,
    none = afterCourt(roles, pool, () => null),
    off = afterCourt(roles, pool, (ref) => (ref === man ? gaol : null)),
    now = off.goings.find((g) => g.kind === "collect");
  assert.deepEqual(none.goings, roles.goings, "no one held: as it was");
  assert.equal(none.past.length, 0);
  assert.deepEqual(
    off.past.map((p) => [p.ref, p.going.kind, p.case.ref]),
    [[man, "collect", "case:x:1"]],
  );
  assert.ok(now && !now.who.includes(man), "the one held is not at it");
  const next = now.who.find((r) => !collect.who.includes(r))!;
  assert.ok(next, "another took it up");
  assert.match(now.took![next]!, new RegExp(`^took it up from .+ in year ${year - 1}$`));
  // Of the same part of the town's lines: no one who is another thing in its underworld.
  const others = new Set(roles.goings.filter((g) => g !== collect).flatMap((g) => g.who));
  assert.ok(!others.has(next));
  assert.ok(off.named.some((p) => p.ref === next) && off.named.some((p) => p.ref === man));
  // The same one each read; and everyone else's things are as they were.
  assert.deepEqual(
    afterCourt(roles, pool, (ref) => (ref === man ? gaol : null)).goings,
    off.goings,
  );
  for (const g of roles.goings)
    if (g.kind !== "collect")
      assert.deepEqual(off.goings.find((x) => x.key === g.key)!.who, g.who, g.kind);
  held(false);
  forgetDockets(world);
  forgetTownLife(world);
});

test("no one a sentence holds is brought again while it runs, no one has two running, and a year is the same book in any order", () => {
  ware(null);
  held(false);
  forgetDockets(world);
  forgetTownLife(world);
  const towns = populationContext(world)
    .settlements.all()
    .filter((t) => t.population > 0 && t.founded < year - 12)
    .slice(0, 40);
  let running = 0,
    longest = 0,
    one: { town: string; c: Case } | null = null;
  for (const t of towns)
    for (let y = year - 9; y <= year; y++) {
      const run = runningOf(world, t.ref, y),
        refs = run.map((c) => c.accused.ref);
      running += run.length;
      assert.equal(new Set(refs).size, refs.length, `${t.ref} ${y}: two sentences on one`);
      for (const c of run) {
        longest = Math.max(longest, c.days);
        assert.ok(c.day + c.days > y * 365 && c.year < y, `${c.ref} runs into ${y}`);
        if (y === year && !one && world.now < (c.day + c.days) * 86_400) one = { town: t.ref, c };
      }
      for (const c of casesOf(world, t.ref, y))
        assert.ok(
          c.accused.outside || !refs.includes(c.accused.ref),
          `${c.ref}: brought while held`,
        );
    }
  assert.ok(running > 0, "some sentence runs past its year in these towns");
  assert.ok(longest < 14 * 365, "none longer than the span its years are drawn over");
  // The same book whichever year is asked first.
  const t = towns[0]!.ref,
    told = (y: number) =>
      JSON.stringify(casesOf(world, t, y).map((c) => [c.ref, c.accused.ref, c.sentence, c.days]));
  const a = [year, year - 1, year - 6].map(told);
  forgetDockets(world);
  const b = [year - 6, year - 1, year].map(told).reverse();
  assert.deepEqual(b, a);
  // One held says so on the people bar's chip and their page, with until when.
  assert.ok(one, "someone is held as the year stands");
  const h = heldReading(world, one!.town, one!.c.accused.ref)!;
  assert.match(
    h.short,
    /^(in the cell|at the works|sent away|sent out of the realm|in the stocks)/,
  );
  assert.equal(h.case, one!.c.ref);
  const page = pageOf(world, one!.c.accused.ref),
    chip = readingsOf(world, one!.c.accused.ref, page)!;
  assert.equal(chip.doing.short, h.short);
});

test("a fight's page names those of its town who are of either side, while it is lately fought", () => {
  ware(null);
  held(true);
  forgetDockets(world);
  forgetTownLife(world);
  const roles = townRolesOf(world, town),
    mob = roles.goings.find((g) => g.kind === "collect")!.of,
    fight = {
      town,
      year,
      sides: [
        { ref: mob.ref, name: "the Varro family" },
        { ref: "mob:none", name: "the Grey family" },
      ],
    },
    block = fightPeopleBlock(world, fight)!;
  assert.equal(block.type, "list");
  const text = JSON.stringify(block);
  assert.match(text, /Of the town, on either side/);
  for (const g of roles.goings)
    if (g.kind === "collect" || g.kind === "guard")
      for (const who of g.who) assert.ok(text.includes(who), `${g.kind} ${who}`);
  assert.match(text, /of the Varro family: their collector in the town/);
  assert.doesNotMatch(text, /Grey/, "no one of the town is of the other side");
  assert.equal(
    fightPeopleBlock(world, { ...fight, year: year - 3 }),
    null,
    "long ago: who is of them now says nothing",
  );
  held(false);
  forgetTownLife(world);
  assert.equal(fightPeopleBlock(world, fight), null);
  // A soldier posted is gone to from the soldiers' page, which their ref leads to.
  held(true);
  forgetTownLife(world);
  const soldier = townRolesOf(world, town).outsiders.find((p) => p.host)!;
  assert.match(soldier.ref, new RegExp(`^out:${town}:uop:`));
  assert.deepEqual(pageOf(world, soldier.ref).place, {
    scale: "village",
    town,
    person: soldier.ref,
  });
  assert.match(JSON.stringify(townGoingsBlock(world, town)), /Go to .+a soldier of /);
  held(false);
  forgetDockets(world);
  forgetTownLife(world);
});

test("a group's head is one of their town's key figures: the same one their page is of, with a house, the way to them and the acts", () => {
  ware(null);
  held(true);
  forgetDockets(world);
  forgetTownLife(world);
  const boss = `boss:${realm.ref}:${rose}`,
    plan = withFigures(world, villagePlan(world, town as Ref, undefined, 120)),
    drawn = plan.people.filter((p) => p.ref === boss || p.figure === boss);
  assert.equal(drawn.length, 1, "one body, and only one");
  assert.equal(drawn[0]!.name, "Old Varro");
  assert.equal(drawn[0]!.figure, boss);
  assert.ok(plan.figures!.some((f) => f.ref === boss && f.home === drawn[0]!.home));
  // Every one a going names is among those drawn, the head too.
  const refs = new Set(plan.people.flatMap((p) => [p.ref, ...(p.figure ? [p.figure] : [])]));
  for (const g of plan.goings!)
    for (const r of [...g.who, ...(g.to ?? [])])
      if (!r.startsWith("folk:") || g.who.includes(r))
        assert.ok(refs.has(r) || !g.who.includes(r), `${g.kind}: ${r}`);
  // Their page: where they live, gone to as themself, followed, lived as, the god's acts.
  const page = pageOf(world, boss),
    tools = page.tabs.flatMap((t) => t.blocks.flatMap((b) => (b.type === "tool" ? [b.tool] : [])));
  assert.deepEqual(page.place, { scale: "village", town, person: boss });
  assert.ok(tools.includes("leader.card"), `the way to live as them: ${tools.join()}`);
  assert.ok(tools.includes("acts.god-person"), "the god's acts on them");
  assert.match(JSON.stringify(page), /Lives in/);
  const l = headLeader(world, boss)!;
  assert.equal(l.kind, "head");
  assert.deepEqual([l.town, l.cannot, l.as?.name], [town, null, "Old Varro"]);
  assert.ok(leadersOfTown(world, town).some((x) => x.ref === boss));
  assert.ok(
    leadersOf(world, realm.ref)!.leaders.some((x) => x.ref === boss),
    "on its realm's leaders",
  );
  // The guards are at that same house in the town's day, and the head before its door.
  const head = plan.people.findIndex((p) => p.figure === boss),
    guard = plan.people.findIndex(
      (p) => p.ref === plan.goings!.find((g) => g.kind === "guard")!.who[0],
    ),
    day = Math.floor(world.now / 86_400) + 1,
    a = momentOf(plan, head, day * 86_400 + 11 * 3600),
    b = momentOf(plan, guard, day * 86_400 + 11 * 3600),
    house = plan.homes[plan.people[head]!.home]!;
  assert.match(a.why ?? "", /^At home, where the Varro family is headed from/);
  assert.ok(Math.hypot(a.x - house.x, a.z - house.z) < 20 && Math.hypot(a.x - b.x, a.z - b.z) < 10);
  // Another heads it: the same page, the same body, another name; no second figure.
  const rec = record();
  under.put(realm.ref, {
    ...rec,
    groups: [{ ...rec.groups[0]!, boss: { name: "Young Varro", born: 30, since: year } }],
  });
  forgetTownLife(world);
  const next = withFigures(world, villagePlan(world, town as Ref, undefined, 120)).people.filter(
    (p) => p.figure === boss,
  );
  assert.deepEqual(
    next.map((p) => p.name),
    ["Young Varro"],
  );
  assert.match(pageOf(world, boss).title, /Young Varro/);
  // A head whose group's home has no town that shows them says where they are, and is gone to there.
  held(false);
  forgetTownLife(world);
  under.put(realm.ref, { ...rec, ops: [] });
  gangs.drop(cell);
  forgetTownLife(world);
  const far = pageOf(world, boss);
  assert.equal(headLeader(world, boss), null);
  assert.deepEqual(far.place, { scale: "region", cell });
  assert.match(JSON.stringify(far), /no town there is one whose days show them/);
  held(false);
  forgetDockets(world);
  forgetTownLife(world);
});

test("a ruler and their court are drawn at the realm's seat and nowhere else, holding court there every day", () => {
  ware(null);
  held(false);
  forgetDockets(world);
  forgetTownLife(world);
  const seat = seatTownOf(world, realm)!,
    ruler = `rule:${realm.ref}`,
    at = withFigures(world, villagePlan(world, seat.ref as Ref, undefined, 120)),
    other = populationContext(world)
      .settlements.all()
      .find(
        (t) =>
          t.population > 0 && t.ref !== seat.ref && politiesOf(world).of(t.cell)?.ref === realm.ref,
      )!,
    away = withFigures(world, villagePlan(world, other.ref as Ref, undefined, 120));
  assert.equal(at.people.filter((p) => p.figure === ruler).length, 1);
  assert.equal(away.people.filter((p) => p.figure === ruler).length, 0);
  assert.ok(!away.goings?.some((g) => g.key.endsWith("|court")));
  const court = at.goings!.find((g) => g.key === `${realm.ref}|court`)!;
  assert.equal(court.who[0], ruler);
  assert.equal(court.every, true);
  const i = at.people.findIndex((p) => p.figure === ruler),
    day = Math.floor(world.now / 86_400) + 1,
    m = momentOf(at, i, day * 86_400 + 10.5 * 3600),
    hall = at.homes[at.people[i]!.home]!;
  assert.equal(m.why, "Holding court at the seat");
  assert.equal(m.of?.ref, realm.ref);
  assert.ok(Math.hypot(m.x - hall.x, m.z - hall.z) < 22, "before their own hall");
  assert.deepEqual(pageOf(world, ruler).place, { scale: "village", town: seat.ref, person: ruler });
  assert.match(JSON.stringify(townGoingsBlock(world, seat.ref)), /holds court at the seat/);
});
