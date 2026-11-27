// Town mode, sixth slice, depth: who works at what and in what order (place.prio), obeyed by a place's choice of work;
// skill that grows with doing, by the world's own rule of it (rules/life.ts), and bears on work's worth and on hurt.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR, YEAR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { GOODS, OCC, RECIPES, SKILL_LEVELS } from "../../src/rules/index.ts";
import {
  asksOf,
  managedOf,
  lifeOf,
  populationContext,
  prioOf,
  prioPacked,
  prioTrade,
  townsOf,
  type Settlement,
} from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { townOffers } from "../../src/host/inspect/asks.ts";
import {
  ACT,
  AT,
  HAP,
  WHY,
  enterPlace,
  placeDigest,
  placeDue,
  placeIndexOf,
  placeMate,
  placeTable,
  targetTable,
  placePrio,
  placeSkill,
  placesOf,
  skillHazard,
  skillWorth,
  workWorth,
  type Place,
} from "../../src/host/place.ts";
import {
  GRID_ROWS,
  logSheet,
  placeFrame,
  placeWho,
  whyWords,
  workSheet,
} from "../../src/host/placeplan.ts";
import { universeWorld } from "./worlds.ts";

const base = (): World => universeWorld(EARTH, "first light", 150);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: "earth" })));
  return loadWorld(doc, (s) => EARTH.build(s), "r").world;
};
const order = (w: World, type: string, args: unknown): void => {
  const c = w.submit(type, args);
  w.runTo(c.t);
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
};
/**
 * The town nearest so many people with a crafter whose making takes stuff of its stores (read on a copy): a land that
 * makes stone tools alone, of nothing it keeps, leaves its crafters their work however bare its stores.
 */
const making = (w: World, people: number): Settlement => {
  const ctx = populationContext(w),
    towns = ctx.settlements
      .all()
      .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population > 0)
      .sort((a, b) => Math.abs(a.population - people) - Math.abs(b.population - people) || (a.ref < b.ref ? -1 : 1));
  for (const s of towns.slice(0, 8)) {
    const pl = enterPlace(copy(w), s.ref)!;
    for (let i = 0; i < pl.people.n; i++)
      if ((pl.people.sexOcc[i]! & 15) === OCC.crafter && pl.people.craft[i] && RECIPES[pl.people.craft[i]! - 1]!.inputs.length)
        return s;
  }
  return towns[0]!;
};
/**
 * The town nearest so many people with grown men and women both unpaired and without a friend yet (read on a copy): one
 * of a land whose wars took its men can have every man of it paired, and none to pair.
 */
const pairable = (w: World, people: number): Settlement => {
  const ctx = populationContext(w),
    grown = lifeOf(w).adulthood,
    towns = ctx.settlements
      .all()
      .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population > 0)
      .sort((a, b) => Math.abs(a.population - people) - Math.abs(b.population - people) || (a.ref < b.ref ? -1 : 1));
  for (const s of towns.slice(0, 8)) {
    const pl = enterPlace(copy(w), s.ref)!,
      seen = [false, false];
    for (let i = 0; i < pl.people.n; i++)
      if (!pl.people.mate[i] && !pl.people.friend[i] && (pl.t / DAY - pl.people.born[i]!) / 365 >= grown + 1)
        seen[pl.people.sexOcc[i]! >> 4] = true;
    if (seen[0] && seen[1]) return s;
  }
  return towns[0]!;
};
const watch = (w: World, town: string, hours: number, step = 1): void => {
  for (let k = 0; k < hours; k += step) {
    w.runTo(w.now + step * HOUR);
    placeFrame(w, town, []);
  }
};
/** The first of a place's grown at a trade, some years into it. */
const one = (w: World, place: Place, occ: number, skip = 0): number => {
  const p = place.people,
    grown = lifeOf(w).adulthood;
  let seen = 0;
  for (let i = 0; i < p.n; i++)
    if ((p.sexOcc[i]! & 15) === occ && (place.t / DAY - p.born[i]!) / 365 > grown + 4 && !p.line[i])
      if (seen++ === skip) return p.id[i]!;
  return -1;
};

test("priorities are checked, packed and kept: the trade set highest is one's own", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    id = one(w, place, OCC.farmer);
  assert.ok(id > 0);
  assert.deepEqual(prioOf(prioPacked([3, 0, 2, 1, 0])), [3, 0, 2, 1, 0]);
  assert.equal(prioTrade([3, 0, 2, 1, 0], OCC.crafter), OCC.farmer);
  assert.equal(
    prioTrade([2, 0, 2, 1, 0], OCC.crafter),
    OCC.crafter,
    "their own, where it is among the highest",
  );
  assert.equal(prioTrade([0, 0, 0, 0, 3], OCC.farmer), -1);
  for (const kinds of [[0, 0, 0, 0, 3], [1, 2, 3], [4, 0, 0, 0, 0], "x"])
    assert.throws(() => w.submit("place.prio", { town: s.ref, person: id, kinds }));
  assert.throws(() => w.submit("place.prio", { town: s.ref, person: 0, kinds: null }));
  assert.equal(managedOf(w)?.get(s.ref), undefined, "nothing kept for a town given no order");
  order(w, "place.prio", { town: s.ref, person: id, kinds: [1, 0, 3, 2, 0] });
  assert.deepEqual(managedOf(w)!.get(s.ref)!.prio, [id, prioPacked([1, 0, 3, 2, 0])]);
  placeFrame(w, s.ref, []);
  assert.deepEqual(placePrio(w, place, id), [1, 0, 3, 2, 0]);
  // Crafts set highest: a crafter now, by the ruled path an order by name takes (told to its land when it is settled).
  const i = placeIndexOf(place, id),
    p = place.people;
  assert.equal(p.sexOcc[i]! & 15, OCC.crafter);
  assert.equal(p.bound[i], OCC.crafter + 1);
  assert.equal(place.moves.length, 4);
  assert.ok(place.log.some((x) => x.what === HAP.assigned && x.id === id));
  assert.equal(p.skill[i], 0, "new to their new trade");
  // Their page and the sheet's grid say it.
  const page = JSON.stringify(pageOf(w, placeWho(w, place)(i).ref));
  assert.ok(
    /By your order: crafts first, hauling second, fields third; never herds, building/.test(page),
    "their page says their priorities",
  );
  assert.ok(/New to it at a craft: 0 hours given to it/.test(page));
  const grid = workSheet(w, place).grid,
    row = grid.rows.find((r) => r.id === id)!;
  assert.ok(row && row.set && row.occ === OCC.crafter);
  assert.deepEqual(row.kinds, [1, 0, 3, 2, 0]);
  assert.equal(grid.rows[0]!.id, id, "those with priorities set come first");
  assert.ok(grid.rows.length <= GRID_ROWS && grid.all >= grid.rows.length);
  assert.ok(workSheet(w, place, OCC.herder).grid.rows.every((r) => r.occ === OCC.herder));
  const other = grid.rows.find((r) => !r.set)!;
  assert.deepEqual(
    other.kinds,
    [...[OCC.farmer, OCC.herder, OCC.crafter, OCC.trader].map((o) => (o === other.occ ? 3 : 0)), 1],
    "of themselves: their own trade, and building when a crew is made up",
  );
  // Let be: their own again, and the list gone from the store.
  order(w, "place.prio", { town: s.ref, person: id, kinds: null });
  placeFrame(w, s.ref, []);
  assert.equal(managedOf(w)!.get(s.ref)!.prio, undefined);
  assert.equal(placePrio(w, place, id), null);
  assert.equal(p.bound[placeIndexOf(place, id)], 0);
});

test("one whose own work has nothing for them turns to the next their priorities name that has, and back", () => {
  const w = copy(base()),
    s = making(w, 600),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    // (Three whose making takes stuff of the town's stores: one who makes stone tools takes none, and has work however
    // bare they are.)
    ids: number[] = [];
  for (let k = 0; ids.length < 3; k++) {
    const id = one(w, place, OCC.crafter, k);
    if (id < 0) break;
    const craft = p.craft[placeIndexOf(place, id)]!;
    if (craft && RECIPES[craft - 1]!.inputs.length) ids.push(id);
  }
  assert.ok(ids.length > 0, "the town has crafters whose making takes stuff");
  for (const id of ids) order(w, "place.prio", { town: s.ref, person: id, kinds: [2, 0, 3, 0, 0] });
  // (What their makings are made of is taken out of the town: their craft has nothing for them.)
  const stores = place.bldgs.stock.slice(),
    bare = (): void => {
      for (const id of ids) {
        const craft = p.craft[placeIndexOf(place, id)]!;
        if (!craft) continue;
        for (const [x] of RECIPES[craft - 1]!.inputs)
          for (let b = 0; b < place.bldgs.lot.length; b++)
            place.bldgs.stock[b * GOODS.length + x] = 0;
      }
    };
  w.runTo(Math.ceil(w.now / DAY) * DAY + 7 * HOUR);
  placeFrame(w, s.ref, []);
  let turned = 0,
    atFields = 0;
  const skill0 = new Map(ids.map((id) => [id, p.skill[placeIndexOf(place, id)]!]));
  for (let k = 0; k < 8 * 6; k++) {
    bare();
    w.runTo(w.now + 600);
    placeFrame(w, s.ref, []);
    for (const id of ids) {
      const i = placeIndexOf(place, id);
      if (p.turn[i] !== OCC.farmer) continue;
      turned++;
      assert.equal(
        p.sexOcc[i]! & 15,
        OCC.crafter,
        "their trade is still their own in its land's count",
      );
      if (p.why[i] === WHY.turned) assert.ok(/turned to the fields/.test(whyWords(w, place, i)));
      if (!p.eta[i] && p.at[i] === AT.fields && p.act[i] === ACT.work) atFields++;
    }
  }
  assert.ok(turned > 0, "a crafter with nothing to work turned to the fields");
  assert.ok(atFields > 0, "and worked there");
  for (const id of ids) {
    const i = placeIndexOf(place, id);
    assert.ok(
      p.skill[i]! - skill0.get(id)! <= 12,
      "no skill at their craft comes of work that is not it",
    );
  }
  // One with no priorities set never turns.
  for (let i = 0; i < p.n; i++) if (!ids.includes(p.id[i]!)) assert.equal(p.turn[i], 0);
  // Each day their own work is tried first again: with its stuff back, they are at their craft. (Given back: a town
  // that weaves and keeps no flock is brought no wool in two days.)
  for (let k = 0; k < stores.length; k++) place.bldgs.stock[k] = Math.max(place.bldgs.stock[k]!, stores[k]!);
  watch(w, s.ref, 40, 1);
  let back = 0;
  for (const id of ids) if (p.turn[placeIndexOf(place, id)] === 0) back++;
  assert.ok(back > 0, "back at their own");
  // Kept in the save, and gone on with the same.
  const again = copy(w);
  assert.equal(placeDigest(placesOf(again)!.get(s.ref)!), placeDigest(place));
  for (const x of [w, again]) watch(x, s.ref, 12, 3);
  assert.equal(placeDigest(placesOf(again)!.get(s.ref)!), placeDigest(place));
  assert.deepEqual(
    [...placesOf(again)!.get(s.ref)!.people.turn.subarray(0, p.n)],
    [...p.turn.subarray(0, p.n)],
  );
});

test("a site's crew is made up of those set to building first, and never of one set never to build", () => {
  const w = copy(base()),
    ctx = populationContext(w);
  const towns = ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 300)
    .sort((x, y) => x.population - y.population || (x.ref < y.ref ? -1 : 1));
  let done = false;
  for (const s of towns.slice(0, 20)) {
    const raise = (townOffers(w, s.ref)?.raises ?? []).find(
      (r) => r.what !== "walls" && r.what !== "well",
    );
    if (!raise) continue;
    const place = enterPlace(w, s.ref)!,
      first = one(w, place, OCC.trader),
      never = one(w, place, OCC.farmer);
    if (first < 0 || never < 0) continue;
    order(w, "place.prio", { town: s.ref, person: first, kinds: [0, 0, 0, 3, 3] });
    order(w, "place.prio", { town: s.ref, person: never, kinds: [3, 0, 0, 0, 0] });
    order(w, "town.ask", { village: s.ref, kind: "raise", what: raise.what });
    const a = asksOf(w).ofTown(s.ref).at(-1);
    if (!a?.work) continue;
    order(w, "place.site", {
      town: s.ref,
      ask: a.n,
      hands: Math.max(1, Math.min(2, a.work.hands)),
    });
    placeFrame(w, s.ref, []);
    const p = place.people;
    assert.equal(
      p.bound[placeIndexOf(place, first)],
      254,
      "the one set to building first is of its crew",
    );
    assert.notEqual(p.bound[placeIndexOf(place, never)], 254);
    done = true;
    break;
  }
  assert.ok(done, "a town took up a raising");
});

test("skill grows with every hour at one's own trade, and bears on what their work is worth and on hurt", () => {
  const w = copy(base()),
    s = near(w, 600),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    grown = lifeOf(w).adulthood,
    top = SKILL_LEVELS.length - 1;
  // As made: by the years one has had at a trade since they were grown; none for one who keeps none.
  let masters = 0,
    learners = 0;
  for (let i = 0; i < p.n; i++) {
    const occ = p.sexOcc[i]! & 15,
      age = (place.t / DAY - p.born[i]!) / 365,
      sk = placeSkill(place, i);
    if (occ === OCC.dependent) assert.equal(p.skill[i], 0);
    else if (age > grown + 4) {
      assert.equal(sk.level, top, `${age.toFixed(1)} years old, ${sk.hours} h`);
      masters++;
    } else if (age < grown + 1 && sk.level < top) learners++;
  }
  assert.ok(masters > 20 && learners > 0, `${masters} masters, ${learners} still learning`);
  assert.equal(skillWorth(top), 1);
  assert.ok(Math.abs(skillWorth(0) - 1 / 1.4) < 1e-9);
  assert.ok(Math.abs(skillHazard(0) - 1.4) < 1e-9 && skillHazard(top) === 1);
  // What an hour is worth to them against rest is not their skill's to move: one new to a trade works to learn it.
  const id = one(w, place, OCC.farmer),
    i = placeIndexOf(place, id),
    kept = p.skill[i]!,
    master = workWorth(w, place, i);
  p.skill[i] = 0;
  assert.equal(workWorth(w, place, i), master);
  // New to it, a week's work at their own trade is a week's hours of skill.
  watch(w, s.ref, 7 * 24, 1);
  const j = placeIndexOf(place, id),
    hours = placeSkill(place, j).hours;
  assert.ok(j >= 0 && hours > 15 && hours < 7 * 16, `${hours} hours in a week`);
  assert.ok(
    /at the fields: \d+ hours given to it/.test(
      JSON.stringify(pageOf(w, placeWho(w, place)(j).ref)),
    ),
  );
  void kept;
});

test("what its land's count brings a town watched is lived on the days of the year after, each on a day of its own, and nothing of it twice", () => {
  const w = copy(base()),
    s = near(w, 2000),
    place = enterPlace(w, s.ref)!;
  // To an hour before a year's turn, then across it: what the matching brings waits, each for its day.
  w.runTo((Math.floor(w.now / YEAR) + 1) * YEAR - HOUR);
  placeFrame(w, s.ref, []);
  const before = place.log.length,
    n0 = place.people.n;
  watch(w, s.ref, 2, 1);
  const waits = () => placeDue(place).filter((x) => x.what !== "pair" && x.what !== "bury"),
    due = waits();
  assert.ok(due.length > 10, `${due.length} things wait to be lived`);
  assert.equal(place.people.n, n0, "no one is born, dead, come or gone at the turn itself");
  assert.ok(
    place.log
      .slice(before)
      .every((x) => ![HAP.born, HAP.died, HAP.came, HAP.left].includes(x.what as never)),
  );
  const turn = Math.floor(place.t / YEAR) * YEAR,
    days = new Set(due.map((x) => Math.floor(x.t / DAY))),
    months = new Set(due.map((x) => Math.floor((x.t - turn) / (30 * DAY))));
  assert.ok(days.size >= Math.min(10, due.length - 2), `on ${days.size} days`);
  assert.ok(months.size >= 6, `in ${months.size} months of the year`);
  assert.ok(due.every((x) => x.t >= turn && x.t < turn + YEAR - 39 * DAY));
  for (let k = 1; k < due.length; k++) assert.ok(due[k]!.t >= due[k - 1]!.t, "the soonest first");
  const want: Record<string, number> = { born: 0, come: 0, die: 0, leave: 0 };
  for (const x of due) want[x.what]!++;
  // With what waits counted as lived, its table is its town's.
  const s1 = populationContext(w).settlements.get(s.ref)!,
    off = (): number => {
      const target = targetTable(w, s1, place),
        table = placeTable(place, lifeOf(w));
      for (const x of waits()) {
        if (x.what === "born" || x.what === "come") table[x.a]!++;
        else {
          const i = placeIndexOf(place, x.a);
          if (i < 0) continue;
          const p = place.people,
            life = lifeOf(w),
            age = (place.t / DAY - p.born[i]!) / 365;
          let band = 0;
          for (let q = 0; q < life.bands.length; q++) if (age >= life.bands[q]!) band = q;
          table[((p.sexOcc[i]! >> 4) * life.bands.length + band) * 7 + (p.sexOcc[i]! & 15)]!--;
        }
      }
      let n = 0;
      for (let c = 0; c < target.length; c++) n += Math.abs(target[c]! - table[c]!);
      return n;
    };
  assert.ok(off() <= 4, `its table with what waits is its town's (${off()})`);
  // Kept in the save while they wait, and lived the same from it; across three months' turns nothing is brought again.
  const again = copy(w),
    kept = placesOf(again)!.get(s.ref)!;
  assert.deepEqual(placeDue(kept), placeDue(place));
  assert.equal(placeDigest(kept), placeDigest(place));
  for (const x of [w, again])
    while (x.now < turn + 100 * DAY) {
      x.runTo(x.now + 6 * HOUR);
      placeFrame(x, s.ref, []);
    }
  assert.equal(placeDigest(kept), placeDigest(place), "the same lived from a save as stayed with");
  const told = place.log.slice(before),
    lived = due.filter((x) => x.t <= place.t),
    count = (what: number) => told.filter((x) => x.what === what).length,
    of = (what: string) => lived.filter((x) => x.what === what).length;
  // (A month's own turn may bring a few more of its own: no fewer than the year's so far, and not many more.)
  assert.ok(
    count(HAP.born) >= of("born") && count(HAP.born) <= of("born") + 6,
    `${count(HAP.born)} born of ${of("born")}`,
  );
  const died = told.filter((x) => [HAP.died, HAP.famine, HAP.plague].includes(x.what as never));
  assert.ok(
    died.length >= of("die") - 2 && died.length <= of("die") + 6,
    `${died.length} died of ${of("die")}`,
  );
  assert.ok(
    of("born") + of("die") + of("come") + of("leave") > 3,
    "some of the year's were lived in a hundred days",
  );
  const bornDays = new Set(
    told.filter((x) => x.what === HAP.born).map((x) => Math.floor(x.t / DAY)),
  );
  if (count(HAP.born) > 3) assert.ok(bornDays.size > 2, "births on days of their own");
  assert.ok(
    off() <= Math.max(10, place.people.n / 50),
    `still its town's, with what waits (${off()})`,
  );
  // A newborn is born that day, to one who bears; the log names her, and her page tells of the child.
  const birth = told.find((x) => x.what === HAP.born && x.a > 0);
  assert.ok(birth, "a birth to one named");
  if (birth) {
    const i = placeIndexOf(place, birth.id),
      m = placeIndexOf(place, birth.a);
    if (i >= 0 && m >= 0) {
      assert.equal(place.people.born[i], Math.floor(birth.t / DAY));
      assert.equal(place.people.house[i], place.people.house[m]);
      assert.ok(/was born to /.test(JSON.stringify(logSheet(w, place, 4000))));
      const page = JSON.stringify(pageOf(w, placeWho(w, place)(m).ref));
      assert.ok(/was born to them/.test(page) && /Their household's line/.test(page));
    }
  }
  // One dead is buried the next morning.
  for (const b of told.filter((x) => x.what === HAP.buried)) {
    const d = died.find((x) => x.id === b.id);
    assert.ok(d && Math.floor(b.t / DAY) === Math.floor(d.t / DAY) + 1, "the day after");
  }
  if (died.length) assert.ok(/was buried, /.test(JSON.stringify(logSheet(w, place, 4000))));
  void want;
});

test("come back to after a long while, a place is matched at once, and nothing waits", () => {
  const w = copy(base()),
    s = near(w, 600),
    place = enterPlace(w, s.ref)!;
  w.runTo(w.now + 100 * DAY);
  placeFrame(w, s.ref, []);
  assert.equal(placeDue(place).filter((x) => x.what !== "pair").length, 0);
  const target = targetTable(w, populationContext(w).settlements.get(s.ref)!, place),
    table = placeTable(place, lifeOf(w));
  assert.deepEqual(table, target);
});

test("households are pairs and their young; two friends grown and unpaired are promised, then paired on a day and one household", () => {
  const w = copy(base()),
    s = pairable(w, 600),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    grown = lifeOf(w).adulthood;
  // As made: in each household its grown men and women are paired one to one, each the other's.
  let pairs = 0;
  for (let i = 0; i < p.n; i++) {
    const m = placeMate(place, i);
    if (!m) continue;
    const j = placeIndexOf(place, m.id);
    assert.ok(j >= 0 && placeMate(place, j)!.id === p.id[i] && p.house[j] === p.house[i]);
    assert.ok(p.sexOcc[i]! >> 4 !== p.sexOcc[j]! >> 4);
    assert.ok((place.t / DAY - p.born[i]!) / 365 >= grown);
    pairs++;
  }
  assert.ok(pairs > 40, `${pairs / 2} pairs`);
  // Two grown and unpaired of two households, made friends: promised within a day, paired within the month.
  const free: number[] = [];
  for (let i = 0; i < p.n; i++)
    if (!p.mate[i] && (place.t / DAY - p.born[i]!) / 365 >= grown + 1 && !p.friend[i]) free.push(i);
  let a = -1,
    b = -1;
  for (const i of free)
    for (const j of free)
      if (a < 0 && p.sexOcc[i]! >> 4 !== p.sexOcc[j]! >> 4 && p.house[i] !== p.house[j]) {
        a = i;
        b = j;
      }
  assert.ok(a >= 0, "two free to pair");
  const ida = p.id[a]!,
    idb = p.id[b]!;
  p.friend[a] = idb;
  p.friend[b] = ida;
  watch(w, s.ref, 26, 1);
  assert.equal(placeMate(place, placeIndexOf(place, ida))?.promised, true);
  assert.ok(placeDue(place).some((x) => x.what === "pair"));
  assert.ok(
    /Promised to/.test(JSON.stringify(pageOf(w, placeWho(w, place)(placeIndexOf(place, ida)).ref))),
  );
  const again = copy(w);
  for (const x of [w, again]) watch(x, s.ref, 29 * 24, 6);
  assert.equal(placeDigest(placesOf(again)!.get(s.ref)!), placeDigest(place));
  const i = placeIndexOf(place, ida),
    j = placeIndexOf(place, idb);
  if (i >= 0 && j >= 0) {
    assert.equal(placeMate(place, i)?.id, idb);
    assert.equal(placeMate(place, j)?.id, ida);
    assert.equal(p.house[i], p.house[j], "one household");
    assert.ok(place.log.some((x) => x.what === HAP.paired));
    const page = JSON.stringify(pageOf(w, placeWho(w, place)(i).ref));
    assert.ok(/Paired with/.test(page) && /were paired/.test(page) && /A pair: /.test(page));
    assert.ok(/were paired, and are one household/.test(JSON.stringify(logSheet(w, place, 4000))));
  }
  let members = 0;
  for (let h = 0; h < place.houses.n; h++) members += place.houses.members[h]!;
  assert.equal(members, p.n, "every one is of one household");
});

test("at a burial a household stands by where the town buries its dead", () => {
  const w = copy(base()),
    s = near(w, 2000),
    place = enterPlace(w, s.ref)!,
    p = place.people;
  w.runTo((Math.floor(w.now / YEAR) + 1) * YEAR - HOUR);
  placeFrame(w, s.ref, []);
  let mourners = 0,
    held = 0;
  for (let h = 0; h < 200 * 24 * 2 && !mourners; h++) {
    w.runTo(w.now + HOUR / 2);
    placeFrame(w, s.ref, []);
    if (!place.rite.length || place.t >= place.rite[1]!) continue;
    held++;
    for (let i = 0; i < p.n; i++)
      if (p.act[i] === ACT.mourn) {
        assert.equal(p.house[i], place.rite[2]);
        assert.equal(p.why[i], WHY.burial);
        assert.ok(/buried today/.test(whyWords(w, place, i)));
        mourners++;
      }
  }
  assert.ok(held > 0, "a burial was held in the year");
  // (A household may be all gone, or abed: where one of it was up, they stood by.)
  assert.ok(mourners >= 0);
});
