// What opening places over real worlds found (town mode, fifth slice), kept from coming back: a town eats what its land's
// reckoning counts it to eat, of what its own hands win and what its land brings in; its people live in all its homes; a
// strike that comes at a month's turn is read before the matching; a sickness's dead are named, as many as the world's
// count; who turns out to a fire is who is near, and a watch is so many; those left without a roof live in the weather;
// a site's hands are bounded by its town's own answer.
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
import { FOODS, G, HOLDS, OCC } from "../../src/rules/index.ts";
import {
  asksOf,
  healthOf,
  levelsOf,
  lifeOf,
  marketsOf,
  populationContext,
  townsOf,
  type Settlement,
} from "../../src/sim/index.ts";
import { handsFor } from "../../src/sim/town/asks.ts";
import { siteMostHands } from "../../src/sim/town/managed.ts";
import { EARTH } from "../../src/host/index.ts";
import { townOffers } from "../../src/host/inspect/asks.ts";
import {
  ACT,
  AT,
  CAUSE,
  FIRE_CRY,
  HAP,
  MICRO,
  PLACE_TICK,
  enterPlace,
  placeCold,
  placeTable,
  streetLength,
  targetTable,
  watchWanted,
  type Place,
} from "../../src/host/place.ts";
import { dangersSheet, logSheet, placeFrame, stocksSheet } from "../../src/host/placeplan.ts";
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
const watch = (w: World, town: string, hours: number, step = 1): void => {
  for (let k = 0; k < hours; k += step) {
    w.runTo(w.now + step * HOUR);
    placeFrame(w, town, []);
  }
};
const told = (place: Place, what: number): number =>
  place.log.filter((x) => x.what === what).length;
const inWant = (place: Place): number => {
  let n = 0;
  for (let i = 0; i < place.people.n; i++) if (place.people.lack[i]! >= 144) n++;
  return n;
};

test("a town eats what its land's reckoning counts a mouth to eat, of what its own hands win and what its land brings in", () => {
  const w = copy(base()),
    s = near(w, 600),
    ctx = populationContext(w),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    m = marketsOf(w).get(s.cell)!,
    land = ctx.provinces.get(s.cell)!.total(),
    life = lifeOf(w);
  // What comes to its stores and what its own hands win come to its share by head of what its land wins, food by food.
  const own = [0, 0];
  for (let i = 0; i < p.n; i++) {
    const occ = p.sexOcc[i]! & 15;
    if (occ === OCC.farmer) own[0]!++;
    else if (occ === OCC.herder) own[1]!++;
  }
  const win = place.matched.win!,
    bring = place.matched.bring!;
  FOODS.forEach((g, k) => {
    const share = (Math.max(0, m.book("made", g)) * p.n) / land,
      won = g === G.grain ? own[0]! * win[0]! : g === G.meat ? own[1]! * win[1]! : 0,
      came = (bring[k]! * (YEAR / PLACE_TICK)) / MICRO;
    assert.ok(
      won <= share + 1e-6,
      `its own hands win no more of a food than its share: ${won} of ${share}`,
    );
    assert.ok(
      Math.abs(won + came - share) <= Math.max(1, share * 0.01),
      `${won} + ${came} of ${share}`,
    );
  });
  // Over a week no one goes a day in want, and what it eats in a day is what its land counts its mouths to eat, as near
  // as their sleep lets them.
  let ate = 0,
    days = 0;
  for (let d = 0; d < 7; d++) {
    watch(w, s.ref, 23, 1);
    w.runTo(w.now + HOUR - 600);
    placeFrame(w, s.ref, []);
    let used = 0;
    for (const g of FOODS) used += place.usedDay[g]!;
    if (d >= 2) {
      ate += used / MICRO;
      days++;
    }
    w.runTo(w.now + 600);
    placeFrame(w, s.ref, []);
  }
  assert.equal(inWant(place), 0);
  const need = (p.n * life.appetite) / 30,
    share = ate / days / need;
  assert.ok(share > 0.6 && share < 1.05, `it ate ${share.toFixed(2)} of its mouths' need a day`);
  // Its stocks sheet says what came in, and nothing of it is nonsense.
  const text = JSON.stringify(stocksSheet(w, place));
  assert.ok(!/undefined|NaN/.test(text));
});

test("a town's people live in all its homes, each as full as the town is of its beds", () => {
  const w = copy(base()),
    s = near(w, 600),
    place = enterPlace(w, s.ref)!,
    f = townsOf(w).get(s.ref)!,
    h = place.houses,
    living = new Map<number, number>();
  for (let k = 0; k < h.n; k++)
    if (h.members[k]! > 0) living.set(h.home[k]!, (living.get(h.home[k]!) ?? 0) + h.members[k]!);
  let beds = 0,
    homes = 0;
  f.homes.forEach((n, level) => {
    beds += n * (HOLDS[level] ?? 5);
    homes += n;
  });
  const full = Math.min(1, place.people.n / beds);
  // (No home holds a crowd while others stand empty: none more than its beds' share and two households over.)
  for (const [lot, n] of living) {
    assert.ok(lot >= 0);
    const holds = HOLDS[levelsOf(f, lot, lot + 1)[0]!] ?? 5;
    assert.ok(n <= holds * full + 12, `${n} live on lot ${lot}, which holds ${holds}`);
  }
  assert.ok(living.size >= Math.min(homes, h.n) * 0.6, `${living.size} of ${homes} homes lived in`);
});

test("a household with no one grown and well fetches for itself, and no one goes a day hungry beside a full store", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    p = place.people,
    grown = lifeOf(w).adulthood;
  // A household with a child, its grown laid abed for a week and its pantry emptied.
  let house = -1;
  for (let i = 0; i < p.n && house < 0; i++)
    if ((place.t / DAY - p.born[i]!) / 365 < grown && (place.t / DAY - p.born[i]!) / 365 > 4)
      house = p.house[i]!;
  assert.ok(house >= 0);
  for (let i = 0; i < p.n; i++)
    if (p.house[i] === house && (place.t / DAY - p.born[i]!) / 365 >= grown) {
      p.health[i] = 1;
      p.cause[i] = CAUSE.accident;
      p.ill[i] = 7 * 144;
    }
  for (let k = 0; k < FOODS.length; k++) place.houses.pantry[house * FOODS.length + k] = 0;
  let fetched = false;
  for (let k = 0; k < 4 * 24; k++) {
    watch(w, s.ref, 1);
    for (let i = 0; i < p.n; i++)
      if (p.house[i] === house && (p.act[i] === ACT.fetch || p.act[i] === ACT.carry))
        fetched = true;
  }
  assert.ok(fetched, "one of its children went to the store");
  for (let i = 0; i < p.n; i++) if (p.house[i] === house) assert.ok(p.lack[i]! < 144);
});

test("what strikes a town at a month's turn is read before the matching: its homeless lost their homes to it, and its fire is fought where it burned", () => {
  const w = copy(base()),
    s = near(w, 600),
    town = s.ref,
    place = enterPlace(w, town)!;
  w.runTo(150 * YEAR + 2 * MONTH - 300);
  placeFrame(w, town, []);
  order(w, "act.fire", { village: town });
  watch(w, town, 3);
  assert.ok(Math.floor(place.t / MONTH) > Math.floor((150 * YEAR + 2 * MONTH - 300) / MONTH));
  const lost = place.log.filter((x) => x.what === HAP.homeless);
  assert.ok(lost.length > 0);
  assert.ok(
    lost.every((x) => x.a === CAUSE.fire),
    "each lost their home in the fire",
  );
  assert.ok(place.fire[0]! >= 0, "it is fought at a lot of the town, not in its square");
  // Who turns out: the grown who live within a cry of it, less one of each household with young.
  const p = place.people;
  let out = 0;
  for (let i = 0; i < p.n; i++) {
    if (p.act[i] !== ACT.brigade) continue;
    out++;
    const home = place.houses.home[p.house[i]!]!;
    assert.ok(streetLength(place, home < 0 ? AT.square : home, place.fire[0]!) <= FIRE_CRY);
  }
  assert.ok(out > 0);
  // Those who lost a home are under another's roof where one had room, else in the square, and its sheet says so.
  const f = townsOf(w).get(town)!,
    living = new Map<number, number>();
  let roofless = 0;
  for (let k = 0; k < place.houses.n; k++) {
    if (place.houses.members[k]! <= 0) continue;
    const home = place.houses.home[k]!;
    if (home < 0) roofless += place.houses.members[k]!;
    else living.set(home, (living.get(home) ?? 0) + place.houses.members[k]!);
  }
  for (const x of lost) {
    const lot = x.b;
    if (lot < 0) continue;
    const level = levelsOf(f, lot, lot + 1)[0]!;
    assert.ok(level >= 0 && (living.get(lot) ?? 0) <= (HOLDS[level] ?? 5));
  }
  const sheet = dangersSheet(w, place);
  assert.equal(sheet.homeless.roofless, roofless);
  assert.ok(sheet.homeless.cold >= 0 && sheet.homeless.cold <= 1);
  assert.equal(sheet.homeless.cold, placeCold(w, place));
  // Out of doors one grows no colder than the air is.
  const cold = placeCold(w, place);
  for (let i = 0; i < p.n; i++)
    if (place.houses.home[p.house[i]!]! < 0 && !p.eta[i] && p.at[i] === AT.square)
      assert.ok(p.needs[i * 4 + 2]! / 65535 <= Math.max(cold, 0.2) + 0.3);
  // A building opened takes them in at once.
  if (roofless > 0) {
    order(w, "place.shelter", { town, lot: place.bldgs.lot[1]! });
    placeFrame(w, town, []);
    assert.equal(dangersSheet(w, place).homeless.roofless, 0);
    assert.ok(told(place, HAP.sheltered) > 0);
  }
});

test("a watch kept is so many of its grown as the order takes from its fields, from anywhere in the town", () => {
  const w = copy(base()),
    s = near(w, 600),
    town = s.ref,
    place = enterPlace(w, town)!,
    p = place.people,
    grown = lifeOf(w).adulthood;
  order(w, "place.respond", { town, what: "firebreaks", on: true });
  w.runTo(150 * YEAR + 40 * DAY + 10 * HOUR);
  placeFrame(w, town, []);
  order(w, "act.fire", { village: town });
  watch(w, town, 2);
  let hands = 0,
    far = 0,
    out = 0;
  for (let i = 0; i < p.n; i++) {
    const occ = p.sexOcc[i]! & 15;
    if (occ >= 2 && occ <= 5 && (place.t / DAY - p.born[i]!) / 365 >= grown) hands++;
    if (p.act[i] !== ACT.brigade) continue;
    out++;
    const home = place.houses.home[p.house[i]!]!;
    if (streetLength(place, home < 0 ? AT.square : home, place.fire[0]!) > FIRE_CRY) far++;
  }
  assert.ok(out > 0);
  assert.ok(
    far <= watchWanted(hands),
    `${far} from beyond a cry, a watch of ${watchWanted(hands)}`,
  );
  assert.ok(watchWanted(hands) >= 1 && watchWanted(hands) < hands / 10);
});

test("a sickness that comes: its dead are named, as many as its land's count takes of the town, and those who lived lie abed", () => {
  const quiet = copy(base()),
    w = copy(base()),
    s = near(w, 600),
    town = s.ref,
    place = enterPlace(w, town)!,
    loose = (x: World) => {
      x.runTo(150 * YEAR + 20 * DAY);
      order(x, "act.loose", { cell: s.cell });
    };
  watch(w, town, 12, 6);
  loose(w);
  loose(quiet);
  const last = healthOf(w)!.land(s.cell)!.last!,
    sickness = healthOf(w)!.get(last.sickness)!,
    before = place.people.n,
    dead = Math.round(last.share * before);
  assert.ok(last.dead > 0 && dead > 0, `${last.dead} of its land, ${dead} of the town`);
  // Read at the month's turn after it came.
  watch(w, town, 12 * 24, 6);
  assert.equal(told(place, HAP.plague), dead);
  assert.equal(place.plague, last.event);
  // (No one stands in for its dead till its town's count is reckoned anew: its people are its town's count less them.)
  const target = targetTable(w, s, place).reduce((a, b) => a + b, 0);
  assert.equal(place.people.n, target);
  assert.deepEqual(placeTable(place, lifeOf(w)).length, targetTable(w, s, place).length);
  const counted = place.counts.filter((_, k) => k % 4 === 1);
  assert.ok(counted.includes(HAP.plague));
  const sheet = dangersSheet(w, place),
    text = JSON.stringify(sheet);
  assert.ok(new RegExp(`${dead} of the town died of ${sickness.name} this year`).test(text), text);
  assert.ok(!/undefined|NaN/.test(text));
  let sick = 0;
  for (let i = 0; i < place.people.n; i++) if (place.people.health[i] === 2) sick++;
  assert.ok(sick > 0 || /took .* and lived/.test(text));
  // Its log names them, counting past a dozen of a day.
  const rows = logSheet(w, place).rows.filter((r) =>
    new RegExp(`died of ${sickness.name}`).test(r.words),
  );
  assert.ok(rows.length > 0 && rows.length <= 13);
  // And the world is the one that was never looked at.
  quiet.runTo(w.now);
  assert.equal(JSON.stringify(w.domainHashes()), JSON.stringify(quiet.domainHashes()));
});

test("the hands a town can put to a site are what its own answer to the asking spares", () => {
  const w = copy(base()),
    ctx = populationContext(w),
    towns = ctx.settlements
      .all()
      .filter((s) => ctx.settlements.held(s.ref) && s.population > 300)
      .sort((x, y) => x.population - y.population || (x.ref < y.ref ? -1 : 1));
  let seen = 0;
  for (const s of towns.slice(0, 40)) {
    for (const r of townOffers(w, s.ref)?.raises ?? []) {
      if (r.what === "walls" || r.what === "well") continue;
      order(w, "town.ask", { village: s.ref, kind: "raise", what: r.what });
      const a = asksOf(w).ofTown(s.ref).at(-1);
      if (!a?.work) break;
      const f = townsOf(w).get(s.ref),
        most = siteMostHands(ctx, a),
        glad = handsFor(s.population, a.what as never, a.work.lots, f?.next ?? 0, "glad");
      assert.equal(
        most,
        handsFor(s.population, a.what as never, a.work.lots, f?.next ?? 0, a.answer),
      );
      assert.ok(most <= glad);
      assert.throws(() => w.submit("place.site", { town: s.ref, ask: a.n, hands: most + 1 }));
      seen++;
      break;
    }
    if (seen >= 6) break;
  }
  assert.ok(seen > 0);
});
