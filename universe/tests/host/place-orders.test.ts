// A town managed (town mode, second slice): every order is a command that is checked; an order moves real hands, and its
// land is told, never more than it has; those who die of want leave its land's count; a world given no order hashes as
// it did, and one given orders moves; the god game's named townsfolk are the place's own, with one page; goods flow from
// where they are made to the market; and every building's page says what it holds.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR, MONTH, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { GOODS, OCC, OCCUPATIONS } from "../../src/rules/index.ts";
import {
  MANAGED_TRADES,
  lifeOf,
  managedOf,
  populationContext,
  type Settlement,
} from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import {
  ACT,
  HAP,
  advancePlace,
  enterPlace,
  placeDigest,
  placeStocks,
  placeTable,
  placesOf,
  settleOf,
  targetTable,
  type Place,
} from "../../src/host/place.ts";
import {
  peopleSheet,
  placeFrame,
  placePlan,
  placeWho,
  stocksSheet,
  workSheet,
} from "../../src/host/placeplan.ts";
import { placeLotRef, placePersonRef, type VillagePlan } from "../../src/bridge/index.ts";
import { universeWorld } from "./worlds.ts";

const base = (): World => universeWorld(EARTH, "first light", 150);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: "earth" })));
  return loadWorld(doc, (s) => EARTH.build(s), "r").world;
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
};
/** A command given and taken, as the host takes it. */
const order = (w: World, type: string, args: unknown): void => {
  const c = w.submit(type, args);
  w.runTo(c.t);
};
/** What a managed town did told to its land, as the host tells it when the command is taken. */
const settle = (w: World, town: string): number => {
  const told = settleOf(w, town);
  if (!told) return 0;
  order(w, "place.settle", told);
  return told.moves.reduce((n, m) => n + m[3], 0) + told.dead.reduce((n, d) => n + d[2], 0);
};
const hands = (w: World, place: Place): number[] => workSheet(w, place).hands.slice();
const landByTrade = (w: World, cell: number): number[] =>
  OCCUPATIONS.map((_, o) => populationContext(w).provinces.get(cell)!.occupation(o));

test("every order is checked before it is taken", () => {
  const w = copy(base()),
    town = near(w, 400).ref;
  assert.ok(managedOf(w)!.dormant(), "nothing is kept before an order");
  const bad: [string, unknown][] = [
    ["place.work", { town: "town:0:999999", shares: [250, 250, 250, 250] }],
    ["place.work", { town, shares: [500, 500] }],
    ["place.work", { town, shares: [500, 500, 500, 500] }],
    ["place.work", { town, shares: [1000.5, 0, 0, -0.5] }],
    ["place.hold", { town, months: 99 }],
    ["place.hold", { town, months: 1.5 }],
    ["place.forbid", { town, good: GOODS.length, on: true }],
    ["place.forbid", { town, good: 0, on: "yes" }],
    // (A town given no order has nothing to settle.)
    ["place.settle", { town, moves: [[0, 2, 4, 1]] }],
  ];
  for (const [type, args] of bad)
    assert.throws(() => w.submit(type, args), `${type} ${JSON.stringify(args)}`);
  assert.ok(managedOf(w)!.dormant());
  order(w, "place.hold", { town, months: 2 });
  order(w, "place.forbid", { town, good: 0, on: true });
  order(w, "place.forbid", { town, good: 0, on: true });
  const m = managedOf(w)!.get(town)!;
  assert.equal(m.hold, 2);
  assert.deepEqual(m.forbidden, [0]);
  order(w, "place.forbid", { town, good: 0, on: false });
  assert.deepEqual(m.forbidden, []);
  for (const args of [
    { town, moves: [[99, 2, 4, 1]] },
    { town, moves: [[0, 2, 4]] },
    { town, dead: [[0, 99, 1]] },
  ])
    assert.throws(() => w.submit("place.settle", args));
});

test("an order to work moves real hands, its land is told, and nothing is made from nothing", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    land = populationContext(w).provinces.get(s.cell)!,
    was = hands(w, place),
    all = was.reduce((a, b) => a + b, 0),
    landWas = landByTrade(w, s.cell),
    total = land.total(),
    people = place.people.n;
  order(w, "place.work", { town: s.ref, shares: [300, 100, 500, 100] });
  w.runTo(w.now + HOUR);
  advancePlace(w, place);
  const now = hands(w, place);
  assert.equal(
    now.reduce((a, b) => a + b, 0),
    all,
    "the same hands, put to other trades",
  );
  assert.equal(place.people.n, people);
  assert.ok(Math.abs(now[2]! - all / 2) <= 1, `half its hands at crafts (${now})`);
  assert.ok(place.moves.length > 0);
  assert.ok(place.log.some((x) => x.what === HAP.ordered));
  assert.deepEqual(landByTrade(w, s.cell), landWas, "its land is not told until it is settled");
  // Settled: its land's counts move by exactly those hands, trade to trade, and by no one more.
  const moved = settle(w, s.ref);
  assert.ok(moved > 0);
  assert.equal(place.moves.length, 0);
  assert.equal(land.total(), total, "no one made, no one lost");
  const landNow = landByTrade(w, s.cell);
  MANAGED_TRADES.forEach((occ, k) =>
    assert.equal(landNow[occ]! - landWas[occ]!, now[k]! - was[k]!, OCCUPATIONS[occ]),
  );
  const own = managedOf(w)!.get(s.ref)!.own;
  for (let r = 0; r < own.length / OCCUPATIONS.length; r++)
    assert.equal(
      own.slice(r * OCCUPATIONS.length, (r + 1) * OCCUPATIONS.length).reduce((a, b) => a + b, 0),
      0,
      "each sex and band keeps its number",
    );
  // A settling asking for more than its land has is given what there is.
  const few = land.counts.get(15, OCC.leader);
  order(w, "place.settle", { town: s.ref, moves: [[15, OCC.leader, OCC.farmer, few + 50]] });
  assert.equal(land.counts.get(15, OCC.leader), 0);
  assert.equal(land.total(), total);
  order(w, "place.settle", { town: s.ref, moves: [[15, OCC.farmer, OCC.leader, few]] });
  // Its hands stay as ordered through its land's own reckonings: the place is matched to its town's own table.
  for (let k = 0; k < 3; k++) {
    w.runTo(w.now + MONTH + DAY);
    enterPlace(w, s.ref);
    assert.deepEqual(placeTable(place, lifeOf(w)), targetTable(w, s, place));
    const kept = hands(w, place),
      sum = kept.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(kept[2]! / sum - 0.5) < 0.08, `still half at crafts (${kept})`);
  }
  assert.ok(placeStocks(place).every((x, g) => x === place.base[g]! + place.flow[g]!));
});

test("a world given no order hashes as it did; a town given orders moves its world", () => {
  const quiet = copy(base()),
    looked = copy(base()),
    ordered = copy(base()),
    town = near(quiet, 400).ref;
  for (const w of [looked, ordered]) enterPlace(w, town);
  order(ordered, "place.work", { town, shares: [300, 100, 500, 100] });
  for (const w of [quiet, looked, ordered]) {
    w.runTo(quiet === w ? w.now + 2 * MONTH + 1 : Math.max(w.now, quiet.now));
    if (w !== quiet) {
      enterPlace(w, town);
      placeFrame(w, town, [1, 2, 3]);
    }
  }
  quiet.runTo(looked.now);
  ordered.runTo(looked.now);
  settle(ordered, town);
  for (const w of [quiet, looked, ordered]) w.runTo(looked.now + 13 * MONTH);
  assert.ok(managedOf(looked)!.dormant());
  assert.equal(JSON.stringify(looked.domainHashes()), JSON.stringify(quiet.domainHashes()));
  assert.deepEqual(
    looked.checkpoints().map((c) => c.chain),
    quiet.checkpoints().map((c) => c.chain),
  );
  assert.notEqual(JSON.stringify(ordered.domainHashes()), JSON.stringify(quiet.domainHashes()));
  // And a world with orders comes back from its save as it was, and goes on the same.
  const again = copy(ordered),
    a = placesOf(again)!.get(town)!,
    b = placesOf(ordered)!.get(town)!;
  assert.equal(placeDigest(a), placeDigest(b));
  for (const w of [again, ordered]) {
    w.runTo(w.now + 2 * DAY);
    enterPlace(w, town);
  }
  assert.equal(placeDigest(a), placeDigest(b));
  assert.equal(JSON.stringify(again.domainHashes()), JSON.stringify(ordered.domainHashes()));
});

test("food held back leaves households in want: they sicken, some die, and its land's count is theirs less", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    land = populationContext(w).provinces.get(s.cell)!;
  // (All its food held back, and its fields and herds left: no one brings any in.)
  order(w, "place.hold", { town: s.ref, months: 24 });
  order(w, "place.work", { town: s.ref, shares: [0, 0, 500, 500] });
  let told = 0,
    starved = 0;
  const total = land.total();
  for (let day = 0; day < 120 && starved < 3; day += 2) {
    w.runTo(w.now + 2 * DAY);
    enterPlace(w, s.ref);
    starved = place.log.filter((x) => x.what === HAP.starved).length + told;
    assert.ok(placeStocks(place).every((x, g) => x === place.base[g]! + place.flow[g]!));
  }
  assert.ok(starved >= 3, "some died of want");
  const sheet = peopleSheet(w, place, null),
    frame = placeFrame(w, s.ref, [])!;
  assert.ok(sheet.rows[0]!.lack > 0, "the most pressed lead the sheet");
  assert.ok(frame.notices.some((n) => n.key === "want"));
  // Told to its land: its count falls by exactly those dead, of the kinds they were.
  const before = land.total(),
    dead = place.dead.length / 3;
  assert.ok(dead > 0);
  told = settle(w, s.ref);
  assert.ok(told >= dead);
  assert.equal(before - land.total(), dead, "its land's count is less by its dead, no more");
  assert.ok(total >= land.total());
  assert.equal(place.dead.length, 0);
  // An unmanaged town's people do not die of want in the place: its land's own reckoning says who dies.
  const other = near(w, 250),
    free = enterPlace(w, other.ref)!;
  assert.equal(free.dead.length, 0);
});

test("the god game's named townsfolk are the place's own people, with one page", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    who = placeWho(w, place),
    linked: number[] = [];
  for (let i = 0; i < p.n; i++) if (p.line[i]) linked.push(i);
  assert.ok(linked.length >= p.n / 30, `${linked.length} of ${p.n} hold a line of its roster`);
  assert.equal(new Set(linked.map((i) => p.line[i])).size, linked.length, "no line held twice");
  const i = linked[0]!,
    named = who(i);
  assert.ok(named.ref.startsWith(`folk:${s.ref}:`));
  const page = pageOf(w, named.ref),
    text = JSON.stringify(page);
  assert.equal(page.kind, "person");
  assert.equal(page.title, named.name);
  for (const word of ["Hunger", "Tiredness", "Cold", "Why", "In hand"])
    assert.ok(text.includes(word), word);
  // The place's own name for them leads to the same page.
  assert.equal(pageOf(w, placePersonRef(s.ref, p.id[i]!)).title, page.title);
  // And they are the same in the plan drawn.
  const plan = {
    ref: s.ref,
    name: s.name,
    homes: [...new Set(place.houses.home)].map((lot) => ({
      x: lot,
      z: 0,
      yaw: 0,
      household: null,
      lot,
    })),
    people: [],
  } as unknown as VillagePlan;
  const placed = placePlan(w, plan, place, 480);
  assert.equal(placed.placed!.length, placed.people.length);
  const at = placed.placed!.indexOf(p.id[i]!);
  assert.ok(at >= 0);
  assert.equal(placed.people[at]!.ref, named.ref);
  assert.equal(placed.people[at]!.name, named.name);
  // One not of the roster has a page of the place's own, leading with their needs and the why.
  const j = [...Array(p.n).keys()].find((k) => !p.line[k])!,
    own = pageOf(w, placePersonRef(s.ref, p.id[j]!));
  assert.equal(own.kind, "person");
  assert.deepEqual(
    own.stats.slice(0, 4).map((x) => x.label),
    ["Hunger", "Tiredness", "Cold", "Want of company"],
  );
  assert.equal(own.tabs[0]!.blocks[0]!.type, "facts");
  assert.equal((own.tabs[0]!.blocks[1] as { title?: string }).title, "Why");
});

test("goods flow from where they are made to the market, and every building's page says what it holds", () => {
  const w = copy(base()),
    s = near(w, 2500),
    place = enterPlace(w, s.ref)!,
    seen = new Set<number>(),
    kinds = place.bldgs.kind.length;
  assert.ok(kinds > 2, "the town has buildings");
  for (let h = 0; h < 36; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
    for (let i = 0; i < place.people.n; i++) seen.add(place.people.act[i]!);
  }
  assert.ok(seen.has(ACT.carry), "loads are carried");
  const sheet = stocksSheet(w, place);
  assert.ok(
    sheet.rows.some((r) => r.made > 0),
    "something was made today",
  );
  assert.ok(
    sheet.rows.some((r) => r.used > 0),
    "something was used today",
  );
  for (const r of sheet.rows)
    assert.ok(
      Math.abs(r.where.reduce((n, x) => n + x.n, 0) - r.held) < 1e-6,
      `${r.name} lies where the sheet says`,
    );
  assert.ok(
    sheet.rows.some((r) => r.stuff),
    "what a made thing is made of is told",
  );
  // Every building of it that holds anything says so first, good by good; a home says what its pantries hold.
  let told = 0;
  for (let b = 1; b < place.bldgs.lot.length; b++) {
    const page = pageOf(w, placeLotRef(s.ref, place.bldgs.lot[b]!)),
      holds = place.bldgs.stock.slice(b * GOODS.length, (b + 1) * GOODS.length),
      first = page.tabs[0]!.blocks[0]! as {
        type: string;
        title?: string;
        rows?: { label: string }[];
      };
    assert.equal(first.title, "Holds");
    holds.forEach((x, g) => {
      if (x <= 0) return;
      told++;
      const name = GOODS[g]!.name;
      assert.ok(
        first.rows?.some((row) => row.label.toLowerCase() === name),
        `${page.title} lists its ${name}`,
      );
    });
  }
  assert.ok(told > 0, "some building holds something");
  const home = pageOf(w, placeLotRef(s.ref, place.houses.home[place.people.house[0]!]!)),
    pantry = home.tabs[0]!.blocks[0]! as { title?: string; rows?: unknown[] };
  assert.equal(pantry.title, "Pantries hold");
  assert.ok((pantry.rows?.length ?? 0) > 0);
  // What its market will not let go is said on the sheet, and no one takes it from there.
  order(w, "place.forbid", { town: s.ref, good: 0, on: true });
  assert.ok(stocksSheet(w, place).rows.find((r) => r.good === 0)?.forbidden);
});
