// A town managed (town mode, second slice): every order is a command that is checked; an order moves real hands, and its
// land is told, never more than it has; those who die of want leave its land's count; a world given no order hashes as
// it did, and one given orders moves; the god game's named townsfolk are the place's own, with one page; goods flow from
// where they are made to the market; and every building's page says what it holds.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DAY,
  HOUR,
  MONTH,
  YEAR,
  loadWorld,
  saveWorld,
  type World,
} from "../../src/kernel/index.ts";
import { GOODS, OCC, OCCUPATIONS } from "../../src/rules/index.ts";
import {
  MANAGED_TRADES,
  healthOf,
  lifeOf,
  managedOf,
  populationContext,
  type Settlement,
} from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import {
  ACT,
  AT,
  HAP,
  MOOD,
  MOOD_UNHEEDING,
  PERSON_BYTES,
  PLACES_MOST,
  hazardOf,
  workWorth,
  advancePlace,
  enterPlace,
  placeDigest,
  placeStocks,
  placeTemper,
  placeTable,
  placesOf,
  settleOf,
  streetLength,
  targetTable,
  type Place,
} from "../../src/host/place.ts";
import {
  logSheet,
  peopleSheet,
  placeFrame,
  placePlan,
  placeWho,
  stocksSheet,
  workSheet,
} from "../../src/host/placeplan.ts";
import {
  placeLotRef,
  placePersonRef,
  streetDoor,
  streetsOf,
  townLots,
  type VillagePlan,
} from "../../src/bridge/index.ts";
import { townPlan } from "../../src/host/town.ts";
import { townSite } from "../../src/host/village.ts";
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

test("a managed town with doings untold is never let go of; told, it can be", () => {
  const w = copy(base()),
    ctx = populationContext(w),
    towns = ctx.settlements
      .all()
      .filter((s) => ctx.settlements.held(s.ref) && s.population > 100)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
      .slice(40, 40 + PLACES_MOST + 3),
    first = towns[0]!,
    store = placesOf(w)!,
    place = enterPlace(w, first.ref)!;
  order(w, "place.work", { town: first.ref, shares: [300, 100, 500, 100] });
  w.runTo(w.now + HOUR);
  advancePlace(w, place);
  assert.ok(place.moves.length > 0);
  for (const s of towns.slice(1)) enterPlace(w, s.ref);
  assert.equal(store.get(first.ref), place, "kept, though the least lately entered");
  assert.ok(settle(w, first.ref) > 0);
  enterPlace(w, towns[1]!.ref);
  enterPlace(w, towns[2]!.ref);
  for (const s of towns.slice(3)) enterPlace(w, s.ref);
  assert.ok(store.places.length <= PLACES_MOST);
});

test("a walk is reckoned by the town's streets between where its plan lays its lots", () => {
  const w = copy(base()),
    s = near(w, 2500),
    place = enterPlace(w, s.ref)!,
    homes = [...new Set(place.houses.home)].filter((lot) => lot >= 0);
  assert.ok(homes.length > 20);
  let longer = 0;
  for (let k = 0; k + 1 < 20; k++) {
    const a = homes[k]!,
      b = homes[homes.length - 1 - k]!,
      d = streetLength(place, a, b);
    assert.equal(streetLength(place, a, a), 0);
    assert.equal(d, streetLength(place, b, a));
    // (Round the blocks: never shorter than by way of the square, and no shorter than straight.)
    // (Each length is told to a whole metre.)
    assert.ok(d <= streetLength(place, a, AT.square) + streetLength(place, AT.square, b) + 2);
    if (d > 0) longer++;
  }
  assert.ok(longer >= 18);
  // Between the lots nearest its square it is the very way its view walks: door to door by its streets' own graph
  // (bridge/streets.ts, the one the town drawn walks its people by), never shorter than straight.
  let most = 0;
  for (const lot of [...place.houses.home, ...place.bldgs.lot]) most = Math.max(most, lot + 1);
  const site = townSite(w, s.ref)!,
    plan = townPlan(w, s.ref, site.axis, Math.min(most, 1536), site.water)!,
    lots = townLots(
      plan.family,
      plan.seed,
      plan.axis,
      plan.lots,
      plan.water,
      plan.site ?? null,
      plan.lotSize ?? 1,
    ),
    streets = streetsOf(
      plan,
      plan.water ? { x: plan.water.x, z: plan.water.z, r: plan.water.r } : null,
    ),
    door = (lot: number) =>
      streetDoor(
        { x: lots.x[lot]!, z: lots.z[lot]!, yaw: lots.yaw[lot]! },
        0,
        undefined,
        plan.lotSize ?? 1,
      ),
    nearLots = homes.filter((lot) => lot < plan.lots);
  assert.ok(nearLots.length > 10);
  let round = 0;
  for (let k = 0; k + 1 < Math.min(nearLots.length, 24); k++) {
    const a = Math.min(nearLots[k]!, nearLots[nearLots.length - 1 - k]!),
      b = Math.max(nearLots[k]!, nearLots[nearLots.length - 1 - k]!);
    if (a === b) continue;
    const way = streets.route(door(a), door(b), 0.5),
      straight = Math.hypot(door(a).x - door(b).x, door(a).z - door(b).z);
    let far = 0;
    for (let q = 0; q + 1 < way.length; q++)
      far += Math.hypot(way[q + 1]!.x - way[q]!.x, way[q + 1]!.z - way[q]!.z);
    // (Or by way of its square, where that is nearer than the way found.)
    assert.equal(
      streetLength(place, a, b),
      Math.min(
        Math.round(far),
        streetLength(place, a, AT.square) + streetLength(place, AT.square, b),
      ),
    );
    assert.ok(streetLength(place, a, b) >= Math.floor(straight) - 1);
    if (far > straight + 1) round++;
  }
  assert.ok(round > 0, "some walks go round a block");
  // Its people's walks take the ticks that length takes at a walk.
  w.runTo(w.now + 9 * HOUR);
  advancePlace(w, place);
  const p = place.people;
  let walking = 0;
  for (let i = 0; i < p.n; i++)
    if (p.eta[i]! > 0) {
      walking++;
      assert.equal(
        p.trip[i],
        Math.max(1, Math.round(streetLength(place, p.at[i]!, p.to[i]!, i) / 720)),
      );
    }
  assert.ok(walking > 0, "some are walking");
  // Out to the fields each goes to a field of their own, where its plan means it to lie: no two alike, none nearer than
  // straight from the square's edge, and a herder to the pasture.
  const out = new Set<number>();
  for (let i = 0; i < p.n; i++) {
    const occ = p.sexOcc[i]! & 15;
    if (occ !== OCC.farmer && occ !== OCC.herder) continue;
    const far = streetLength(place, place.houses.home[p.house[i]!]!, AT.fields, i);
    assert.ok(far > 20 && far < 20_000, `${far} m out to the fields`);
    assert.equal(far, streetLength(place, AT.fields, place.houses.home[p.house[i]!]!, i));
    out.add(far);
  }
  assert.ok(out.size > 3, "they go to fields of their own");
});

test("a realm's key figure living in the town is one of the place's people, with needs", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    figure = "rule:realm:0:1",
    plan = {
      ref: s.ref,
      name: s.name,
      homes: [...new Set(place.houses.home)].map((lot) => ({
        x: lot,
        z: 0,
        yaw: 0,
        household: null,
        lot,
      })),
      people: [
        {
          ref: "agent:1",
          name: "Ruler of the test",
          home: 0,
          age: 44,
          occupation: 6,
          child: false,
          sex: 1,
          figure,
        },
      ],
    } as unknown as VillagePlan,
    placed = placePlan(w, plan, place, 480),
    at = placed.people.findIndex((q) => q.figure === figure),
    id = placed.placed![at]!;
  assert.ok(at >= 0 && id > 0, "the figure is one of the place's own");
  assert.equal(placed.people[at]!.name, "Ruler of the test");
  assert.equal(placed.people.filter((q) => q.figure === figure).length, 1);
  assert.equal(placed.placed!.filter((x) => x === id).length, 1, "and is drawn once");
  const i = [...place.people.id.subarray(0, place.people.n)].indexOf(id);
  assert.deepEqual(placeWho(w, place)(i), { ref: figure, name: "Ruler of the test" });
  const frame = placeFrame(w, s.ref, [id])!;
  assert.ok(
    frame.why[0]!.length > 0 && frame.at[0] !== AT.none,
    "with needs and a place, as anyone's",
  );
  // The same one, however often the plan is read.
  assert.equal(placePlan(w, plan, place, 480).placed![at], id);
});

test("one put to a trade by name stays at it; let be, they are their own again", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    grown = lifeOf(w).adulthood,
    i0 = [...Array(p.n).keys()].find(
      (k) => (p.sexOcc[k]! & 15) === OCC.farmer && (place.t / DAY - p.born[k]!) / 365 > grown + 2,
    )!,
    id = p.id[i0]!,
    at = () => [...p.id.subarray(0, p.n)].indexOf(id);
  assert.throws(() =>
    w.submit("place.assign", { town: s.ref, person: id, trade: OCC.leader, post: null }),
  );
  assert.throws(() =>
    w.submit("place.assign", { town: s.ref, person: 0, trade: null, post: null }),
  );
  order(w, "place.assign", { town: s.ref, person: id, trade: OCC.crafter, post: null });
  enterPlace(w, s.ref);
  assert.equal(p.sexOcc[at()]! & 15, OCC.crafter);
  assert.equal(p.bound[at()], OCC.crafter + 1);
  assert.equal(place.moves.length, 4);
  assert.ok(place.log.some((x) => x.what === HAP.assigned && x.id === id));
  // An order by share for every hand to the fields leaves them at their craft.
  order(w, "place.work", { town: s.ref, shares: [1000, 0, 0, 0] });
  w.runTo(w.now + HOUR);
  enterPlace(w, s.ref);
  assert.equal(p.sexOcc[at()]! & 15, OCC.crafter);
  settle(w, s.ref);
  w.runTo(w.now + MONTH + DAY);
  enterPlace(w, s.ref);
  assert.equal(p.sexOcc[at()]! & 15, OCC.crafter, "through its land's own reckoning too");
  const page = JSON.stringify(pageOf(w, placeWho(w, place)(at()).ref));
  assert.ok(page.includes("By your order"), "their page says so");
  assert.ok(peopleSheet(w, place, OCC.crafter, 500).rows.find((r) => r.id === id)?.bound);
  order(w, "place.assign", { town: s.ref, person: id, trade: null, post: null });
  enterPlace(w, s.ref);
  assert.equal(p.bound[at()], 0);
});

test("a building's work stopped sends its workers home; a household given a home moves to it", () => {
  const w = copy(base()),
    s = near(w, 2500),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    sheet = workSheet(w, place),
    b = [...sheet.buildings].sort((x, y) => y.working - x.working)[0]!;
  assert.ok(b.working > 0, "a building where work is done");
  order(w, "place.shut", { town: s.ref, lot: b.lot, on: true });
  for (let h = 0; h < 30; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
    for (let i = 0; i < p.n; i++)
      if (p.work[i] === b.lot) assert.notEqual(p.act[i], ACT.work, "no one works there");
  }
  assert.ok(workSheet(w, place).buildings.find((x) => x.lot === b.lot)?.shut);
  assert.ok(JSON.stringify(pageOf(w, placeLotRef(s.ref, b.lot))).includes("stopped by your order"));
  order(w, "place.shut", { town: s.ref, lot: b.lot, on: false });
  let worked = false;
  for (let h = 0; h < 30 && !worked; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
    for (let i = 0; i < p.n; i++) if (p.work[i] === b.lot && p.act[i] === ACT.work) worked = true;
  }
  assert.ok(worked, "let go on, they work there again");
  // A household given another home that stands.
  const house = p.house[0]!,
    old = place.houses.home[house]!,
    lot = place.houses.home.find((x) => x >= 0 && x !== old)!;
  assert.throws(() => w.submit("place.house", { town: s.ref, house: -1, lot }));
  order(w, "place.house", { town: s.ref, house: place.houses.key[house]!, lot });
  enterPlace(w, s.ref);
  assert.equal(place.houses.home[house], lot);
  assert.ok(place.log.some((x) => x.what === HAP.moved));
  w.runTo(w.now + 2 * DAY);
  enterPlace(w, s.ref);
  let glad = 0;
  for (let i = 0; i < p.n; i++) if (p.house[i] === house && p.moodWhy[i]! & MOOD.home) glad++;
  assert.ok(glad > 0, "a new home lifts their mood");
});

test("mood follows needs met and what befell the household, moves work's worth, and too low heeds no order", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    mean = () => {
      let sum = 0;
      for (let i = 0; i < p.n; i++) sum += p.mood[i]!;
      return sum / p.n;
    };
  for (let d = 0; d < 6; d += 2) {
    w.runTo(w.now + 2 * DAY);
    enterPlace(w, s.ref);
  }
  const fed = mean();
  assert.ok(fed > 0, `fed and housed, their mood is up (${fed.toFixed(1)})`);
  // Worth follows mood: the same one, glad and low.
  const i = [...Array(p.n).keys()].find((k) => (p.sexOcc[k]! & 15) === OCC.farmer)!,
    was = p.mood[i]!;
  p.mood[i] = 80;
  const glad = workWorth(w, place, i);
  p.mood[i] = -80;
  assert.ok(workWorth(w, place, i) < glad);
  p.mood[i] = was;
  order(w, "place.hold", { town: s.ref, months: 24 });
  order(w, "place.work", { town: s.ref, shares: [0, 0, 500, 500] });
  for (let d = 0; d < 80; d += 2) {
    w.runTo(w.now + 2 * DAY);
    enterPlace(w, s.ref);
  }
  assert.ok(mean() < fed - 20, `in want, it falls (${mean().toFixed(1)} from ${fed.toFixed(1)})`);
  const low = [...Array(p.n).keys()].filter((k) => p.mood[k]! < MOOD_UNHEEDING);
  assert.ok(low.length > 0, "some are too low to heed an order");
  const page = JSON.stringify(pageOf(w, placeWho(w, place)(low[0]!).ref));
  assert.ok(page.includes("Mood") && page.includes("days gone hungry"), "their page says why");
  assert.ok(workSheet(w, place).unheeding >= low.length);
  // An order to change work is not heeded by them, and that is told.
  order(w, "place.work", { town: s.ref, shares: [900, 0, 50, 50] });
  w.runTo(w.now + HOUR);
  enterPlace(w, s.ref);
  assert.ok(place.log.some((x) => x.what === HAP.unheeded));
  const log = logSheet(w, place);
  assert.ok(
    log.rows.length > 0 &&
      log.rows.every(
        (r) => r.words.length > 0 && r.day && (r.ref || /^and \d+ more /.test(r.words)),
      ),
  );
  assert.ok(log.rows[0]!.t >= log.rows.at(-1)!.t, "the latest first");
});

test("work harms some by their trade's own wear; the hurt lie abed at home and are well again", () => {
  const w = copy(base()),
    s = near(w, 2500),
    place = enterPlace(w, s.ref)!;
  // (Its people's columns are made again larger as the town grows: read afresh each day, never held from its entering.)
  let p = place.people;
  assert.equal(hazardOf(place, OCC.leader, 0), 0);
  assert.ok(hazardOf(place, OCC.farmer, 0) > 0 && hazardOf(place, OCC.farmer, 0) < 0.2);
  let hurt = 0,
    well = 0,
    abedAtHome = 0;
  // (Until all three are seen: some hurt, one well again, and one of the hurt abed at home, read once a day.)
  for (let d = 0; d < 150 && (hurt < 2 || well < 1 || abedAtHome === 0); d++) {
    w.runTo(w.now + DAY);
    enterPlace(w, s.ref);
    p = place.people;
    hurt += place.log.filter((x) => x.what === HAP.hurt && x.t > place.t - DAY).length;
    well += place.log.filter((x) => x.what === HAP.well && x.t > place.t - DAY).length;
    for (let i = 0; i < p.n; i++)
      if (p.ill[i]! > 0 && !p.eta[i] && p.act[i] === ACT.abed) {
        assert.equal(p.at[i], place.houses.home[p.house[i]!]);
        abedAtHome++;
        if (abedAtHome === 1) {
          const page = JSON.stringify(pageOf(w, placeWho(w, place)(i).ref));
          assert.ok(
            page.includes("Hurt at their work") || page.includes("Sick of"),
            "their page says what ails them",
          );
        }
      }
  }
  assert.ok(hurt >= 2, `some were hurt at their work (${hurt})`);
  assert.ok(well >= 1, "and were well again");
  assert.ok(abedAtHome > 0);
  assert.ok(PERSON_BYTES <= 100, `${PERSON_BYTES} bytes a person`);
  // Where its land's own reckoning has no sickness come this year or last, no one of the place is sick.
  const sick = [...Array(p.n).keys()].filter((i) => p.health[i] === 2).length,
    last = healthOf(w)?.land(s.cell)?.last;
  if (!last || Math.floor(w.now / YEAR) - last.year > 1) assert.equal(sick, 0);
});

test("the People sheet carries what its keys need: buildings to put one at, homes with room, each one's household", () => {
  const w = copy(base()),
    s = near(w, 2500),
    place = enterPlace(w, s.ref)!,
    sheet = peopleSheet(w, place, null),
    p = place.people;
  assert.ok(sheet.posts.length > 0, "its buildings standing");
  assert.ok(sheet.homes.length > 0 && sheet.homes.every((h) => h.room > 0));
  // One put at a building by its key works there; a household given a home by its key lives there.
  const row = sheet.rows.find((r) => r.occ !== 0 && r.occ !== OCC.leader)!,
    post = sheet.posts[0]!,
    home = sheet.homes[0]!;
  order(w, "place.assign", { town: s.ref, person: row.id, trade: null, post: post.lot });
  order(w, "place.house", { town: s.ref, house: row.house, lot: home.lot });
  placeFrame(w, s.ref, []);
  const i = [...p.id.subarray(0, p.n)].indexOf(row.id);
  assert.equal(p.work[i], post.lot);
  assert.equal(place.houses.home[p.house[i]!], home.lot);
  const again = peopleSheet(w, place, null).rows.find((r) => r.id === row.id);
  if (again) assert.equal(again.post, post.lot);
});

test("each has a temper of their own, half their people's ways, and it weighs what moves their mood", () => {
  const w = copy(base()),
    s = near(w, 2500),
    place = enterPlace(w, s.ref)!,
    p = place.people;
  assert.equal(place.matched.ways?.length, 8);
  let low = 1,
    high = 0;
  const sums = [0, 0];
  for (let i = 0; i < p.n; i++) {
    const t = placeTemper(place, i);
    for (const x of Object.values(t)) assert.ok(x >= 0 && x <= 1);
    assert.deepEqual(placeTemper(place, i), t, "the same on every reading");
    low = Math.min(low, t.kin);
    high = Math.max(high, t.kin);
    sums[0]! += t.kin;
    sums[1]! += t.bold;
  }
  // (Half their own: they differ by up to half; half their people's: about their land's way.)
  assert.ok(high - low > 0.3 && high - low <= 0.5 + 1e-9, `${low} to ${high}`);
  const ways = place.matched.ways!;
  assert.ok(Math.abs(sums[0]! / p.n - (0.5 * ways[0]! + 0.25)) < 0.05);
  assert.ok(Math.abs(sums[1]! / p.n - (0.5 * ways[3]! + 0.25)) < 0.05);
  const page = JSON.stringify(pageOf(w, placePersonRef(s.ref, p.id[0]!)));
  assert.ok(/Temper/.test(page) && /half their people's ways, half their own nature/.test(page));
  assert.ok(!/undefined|NaN/.test(page));
});
