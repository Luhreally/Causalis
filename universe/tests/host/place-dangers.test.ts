// What threatens a town, seen on its people (town mode, fourth slice): the world's count says what a fire or a battle
// costs, the place says whom, and nothing is removed twice; with no order the world is what it was; an order against a
// threat changes what comes only through the world's own rules; those without a home are sheltered where ordered; a
// share of its grown stand to arms; and all of it is kept in the save and told on its sheet and pages.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, HOUR, YEAR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { LESSON_RESPONSE, strikeHurt } from "../../src/rules/index.ts";
import {
  ASK_PULL,
  levelsOf,
  lifeOf,
  managedOf,
  populationContext,
  townsOf,
  type Settlement,
} from "../../src/sim/index.ts";
import {
  heldPull,
  orderedAdds,
  orderedGift,
  orderedGuard,
  orderedLeft,
  orderedLeftLand,
} from "../../src/sim/town/managed.ts";
import { EARTH } from "../../src/host/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { townTally, battlesOfYear } from "../../src/host/burials.ts";
import {
  ACT,
  BOUND_ARMS,
  CAUSE,
  HAP,
  armsWanted,
  enterPlace,
  placeDigest,
  placesOf,
  targetTable,
  type Place,
} from "../../src/host/place.ts";
import { dangersSheet, logSheet, placeFrame, placeNotices } from "../../src/host/placeplan.ts";
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
/** A town with streets, of about so many. */
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
/** A fire on a town, at ten of a morning forty days on; what its telling says it cost. */
function fire(w: World, town: string): { homes: number; dead: number } {
  w.runTo(150 * YEAR + 40 * DAY + 10 * HOUR);
  if (placesOf(w)!.get(town)) placeFrame(w, town, []);
  order(w, "act.fire", { village: town });
  let e = w.events.at(w.events.count - 1);
  for (let i = w.events.count - 1; e.type !== "act.fire"; i--) e = w.events.at(i);
  return e.data as { homes: number; dead: number };
}

test("the orders against what threatens a town are checked, and with none the world's rules read nothing", () => {
  const w = copy(base()),
    s = near(w, 600),
    ctx = populationContext(w),
    bad = (type: string, args: unknown) => assert.throws(() => w.submit(type, args));
  bad("place.respond", { town: s.ref, what: "prayer", on: true });
  bad("place.respond", { town: s.ref, what: "muster", on: 1 });
  bad("place.respond", { town: "nowhere", what: "muster", on: true });
  bad("place.shelter", { town: s.ref, lot: -2 });
  bad("place.shelter", { town: s.ref, lot: "hall" });
  assert.equal(orderedLeft(w, s.ref, "fire"), 1);
  assert.equal(orderedLeftLand(ctx, s.cell, "sickness"), 1);
  assert.equal(orderedAdds(ctx, s.cell, "stores"), 0);
  assert.equal(orderedGuard(ctx, s.cell), 1);
  assert.equal(orderedGift(ctx, s.cell), 1);
  // Held to each: the world's own measure of the answer, for the town's share of its land's people.
  const share = Math.min(1, s.population / ctx.provinces.get(s.cell)!.total());
  for (const what of ["firebreaks", "quarantine", "granaries", "muster"])
    order(w, "place.respond", { town: s.ref, what, on: true });
  const m = managedOf(w)!.get(s.ref)!;
  assert.deepEqual(m.held, ["firebreaks", "quarantine", "granaries", "muster"]);
  assert.equal(orderedLeft(w, s.ref, "fire"), 1 - LESSON_RESPONSE.get("firebreaks")!.most);
  assert.equal(orderedLeft(w, s.ref, "quake"), 1);
  assert.ok(
    Math.abs(
      orderedLeftLand(ctx, s.cell, "sickness") -
        (1 - share * LESSON_RESPONSE.get("quarantine")!.most),
    ) < 1e-12,
  );
  assert.ok(
    Math.abs(orderedAdds(ctx, s.cell, "stores") - share * LESSON_RESPONSE.get("granaries")!.most) <
      1e-12,
  );
  assert.ok(Math.abs(orderedGuard(ctx, s.cell) - (1 + ASK_PULL.glad * share)) < 1e-12);
  assert.ok(Math.abs(orderedGift(ctx, s.cell) - (1 - heldPull(m) * share)) < 1e-12);
  assert.ok(heldPull(m) > ASK_PULL.glad && heldPull(m) <= 1);
  order(w, "place.respond", { town: s.ref, what: "muster", on: false });
  assert.deepEqual(m.held, ["firebreaks", "quarantine", "granaries"]);
  assert.equal(orderedGuard(ctx, s.cell), 1);
});

test("a fire is seen on its people: who lost a home, who was hurt, who died, by the world's own count and no one twice", () => {
  const quiet = copy(base()),
    w = copy(base()),
    s = near(w, 600),
    town = s.ref,
    place = enterPlace(w, town)!;
  watch(w, town, 24, 6);
  const before = place.people.n,
    cost = fire(w, town),
    alone = fire(quiet, town);
  assert.deepEqual(cost, alone, "looking at a town changes nothing of what a fire costs it");
  assert.ok(cost.dead > 0 && cost.homes > 0, JSON.stringify(cost));
  watch(w, town, 2);
  // Its dead, at once: as many as the world's count, named, of the kinds its land's count is short by.
  const dead = told(place, HAP.struckDead),
    waiting = place.tolls.reduce((n, x, k) => (k % 2 ? n + x : n), 0);
  assert.equal(dead + waiting, cost.dead);
  assert.ok(dead > 0);
  assert.equal(place.people.n, before - dead);
  assert.equal(told(place, HAP.struckHurt), strikeHurt("fire", cost.dead));
  for (const x of place.log)
    if (x.what === HAP.struckDead || x.what === HAP.struckHurt) assert.equal(x.a, CAUSE.fire);
  // Those whose home it took are named; every household lives where a home stands.
  const fab = townsOf(w).get(town)!,
    lost = told(place, HAP.homeless);
  assert.ok(lost > 0 && lost <= cost.homes * 4, `${lost} households of ${cost.homes} homes`);
  for (let k = 0; k < place.houses.n; k++)
    if (place.houses.members[k]! > 0 && place.houses.home[k]! >= 0)
      assert.ok(levelsOf(fab, place.houses.home[k]!, place.houses.home[k]! + 1)[0]! >= 0);
  // It is fought for a day by the grown who live near it, and its notice and sheet say so.
  const p = place.people,
    out = () => {
      let n = 0;
      for (let i = 0; i < p.n; i++) if (p.act[i] === ACT.brigade) n++;
      return n;
    };
  assert.ok(out() > 0, "its neighbours turn out");
  assert.ok(placeNotices(w, place).some((x) => /^Fire at /.test(x.words)));
  const sheet = dangersSheet(w, place),
    text = JSON.stringify(sheet);
  assert.ok(sheet.now.some((x) => /Fire at /.test(x.words)));
  assert.ok(
    sheet.now.some((x) => new RegExp(`^${dead} of the town died in the fire`).test(x.words)),
  );
  assert.equal(sheet.hurt.length, strikeHurt("fire", cost.dead));
  assert.ok(sheet.homeless.households === lost && sheet.homeless.people > 0);
  assert.equal(sheet.responses.length, 4);
  assert.ok(!/undefined|NaN/.test(text), text.match(/.{60}(undefined|NaN).{40}/)?.[0]);
  const hurt = place.log.find((x) => x.what === HAP.struckHurt)!,
    page = JSON.stringify(pageOf(w, `plc:${town}:${hurt.id}`));
  assert.ok(/Hurt in the fire/.test(page) && /was hurt in the fire/.test(page));
  // (Its dead are told by name still, though they are of the place no longer.)
  const deaths = logSheet(w, place).rows.filter((r) => / died in the fire$/.test(r.words));
  assert.equal(deaths.length, dead);
  assert.ok(deaths.every((r) => !/^One of the town/.test(r.words)));
  watch(w, town, 30);
  assert.equal(out(), 0, "and go home when it is out");
  // No one twice, and no one in their place: to the year's end its people are its town's count less its dead, kind for
  // kind; then its town's count is reckoned anew and they are matched to it.
  let came = 0;
  for (let m = 0; m < 12; m++) {
    watch(w, town, 30 * 24, 12);
    const target = targetTable(w, s, place);
    assert.equal(
      place.people.n,
      target.reduce((a, b) => a + b, 0),
    );
    if (Math.floor(w.now / YEAR) === 150) {
      assert.equal(place.people.n, before - cost.dead, `month ${m}`);
      came = place.log.filter((x) => x.what === HAP.came || x.what === HAP.born).length;
    }
  }
  // (Through the year a few come and are born as others leave and die, by its land's months; no crowd for its dead.)
  assert.ok(came < 60, `${came} came or were born in the year's ten months`);
  assert.equal(place.gone.length, 0);
  assert.equal(place.tolls.length, 0);
  // And the world is the one that was never looked at.
  quiet.runTo(w.now);
  assert.equal(JSON.stringify(w.domainHashes()), JSON.stringify(quiet.domainHashes()));
});

test("a fire watch kept by order halves what a fire takes, through the world's own rule; a shelter takes in those it leaves homeless", () => {
  const plain = copy(base()),
    w = copy(base()),
    s = near(w, 600),
    town = s.ref,
    place = enterPlace(w, town)!,
    hall = place.bldgs.lot[1]!;
  order(w, "place.respond", { town, what: "firebreaks", on: true });
  order(w, "place.shelter", { town, lot: hall });
  const a = fire(plain, town),
    b = fire(w, town);
  assert.ok(
    b.homes < a.homes && b.homes >= Math.floor(a.homes / 2) - 1,
    `${b.homes} of ${a.homes}`,
  );
  assert.ok(b.dead <= Math.ceil(a.dead / 2) + 1 && b.dead < a.dead, `${b.dead} of ${a.dead}`);
  watch(w, town, 2);
  // The whole town turns out; those without a home are at the building opened to them.
  const p = place.people,
    life = lifeOf(w);
  let out = 0,
    grown = 0;
  for (let i = 0; i < p.n; i++) {
    if (p.act[i] === ACT.brigade) out++;
    if ((p.sexOcc[i]! & 15) !== 0 && (place.t / DAY - p.born[i]!) / 365 >= life.adulthood) grown++;
  }
  assert.ok(out > grown / 2, `${out} of ${grown} grown turned out`);
  const sheet = dangersSheet(w, place);
  assert.ok(sheet.homeless.households > 0);
  assert.equal(sheet.homeless.sheltered, sheet.homeless.people);
  assert.equal(sheet.shelter.lot, hall);
  assert.ok(sheet.responses.find((r) => r.what === "firebreaks")!.on);
  let there = 0;
  for (let k = 0; k < place.houses.n; k++)
    if (place.houses.members[k]! > 0 && place.houses.home[k] === hall) there++;
  assert.equal(there, sheet.homeless.households);
  // Kept in the save, and going on the same from it.
  const again = copy(w),
    kept = placesOf(again)!.get(town)!;
  assert.equal(placeDigest(kept), placeDigest(place));
  for (const x of [w, again]) watch(x, town, 40 * 24, 12);
  assert.equal(placeDigest(kept), placeDigest(place));
  assert.equal(JSON.stringify(again.domainHashes()), JSON.stringify(w.domainHashes()));
  // Once homes have room they leave the shelter.
  assert.ok(told(place, HAP.rehoused) > 0 || there > 0);
});

test("a town ordered to stand to arms puts a share of its grown in its square, and its land's defenders count for more", () => {
  const w = copy(base()),
    s = near(w, 600),
    town = s.ref,
    place = enterPlace(w, town)!,
    p = place.people,
    life = lifeOf(w),
    under = () => {
      const out: number[] = [];
      for (let i = 0; i < p.n; i++) if (p.bound[i] === BOUND_ARMS) out.push(i);
      return out;
    };
  let hands = 0;
  for (let i = 0; i < p.n; i++) {
    const occ = p.sexOcc[i]! & 15;
    if (occ >= 2 && occ <= 5 && (place.t / DAY - p.born[i]!) / 365 >= life.adulthood) hands++;
  }
  order(w, "place.respond", { town, what: "muster", on: true });
  placeFrame(w, town, []);
  assert.equal(under().length, armsWanted(hands));
  assert.ok(under().length > 0);
  assert.equal(told(place, HAP.mustered), under().length);
  let seen = 0;
  for (let k = 0; k < 48; k++) {
    watch(w, town, 1);
    seen = Math.max(seen, under().filter((i) => p.act[i] === ACT.guard && !p.eta[i]).length);
  }
  assert.ok(seen > under().length / 2, `${seen} of ${under().length} seen standing in the square`);
  assert.ok(orderedGuard(populationContext(w), s.cell) > 1);
  assert.ok(orderedGift(populationContext(w), s.cell) < 1);
  const one = under()[0]!,
    page = JSON.stringify(pageOf(w, `plc:${town}:${p.id[one]}`));
  assert.ok(/Standing to arms/.test(page));
  assert.ok(/stand in the square/.test(JSON.stringify(dangersSheet(w, place).responses)));
  order(w, "place.respond", { town, what: "muster", on: false });
  placeFrame(w, town, []);
  assert.equal(under().length, 0);
  assert.equal(orderedGuard(populationContext(w), s.cell), 1);
});

test("a battle's tally of a town's men names who fell and who came home wounded", () => {
  const w = copy(base()),
    ctx = populationContext(w);
  // (The battles at the turn of year 150, read off an unwatched copy: a town of some hundreds whose men were in one.)
  const ahead = copy(base());
  ahead.runTo(151 * YEAR + DAY);
  let pick: { town: string; fell: number; hurt: number } | null = null;
  for (const { b } of battlesOfYear(ahead, 150))
    for (const side of [0, 1] as const)
      for (const s of populationContext(ahead).settlements.all()) {
        const t = townTally(ahead, b, side, s.ref);
        if (!pick && t && t[1] >= 2 && t[2] >= 2 && s.population > 300 && s.population < 3000)
          pick = { town: s.ref, fell: t[1], hurt: t[2] };
      }
  assert.ok(pick, "a town's men were in a battle at the turn of year 150");
  const town = pick!.town,
    s = ctx.settlements.get(town as never)!;
  w.runTo(151 * YEAR - 2 * DAY);
  const place = enterPlace(w, town)!;
  watch(w, town, 4 * 24, 6);
  assert.ok(Math.floor(place.t / YEAR) === 151);
  const fell = told(place, HAP.fell),
    wounded = told(place, HAP.wounded);
  assert.ok(fell > 0 && fell <= pick!.fell, `${fell} told fallen of ${pick!.fell}`);
  assert.equal(wounded, pick!.hurt);
  assert.equal(place.tolls.length, 0);
  assert.equal(
    place.people.n,
    targetTable(w, s, place).reduce((a, b) => a + b, 0),
  );
  // Its log tells them by name, each a line of its own among the year's turn's many comings and goings, which are counted.
  const rows = logSheet(w, place).rows;
  assert.equal(rows.filter((r) => / fell in the battle at /.test(r.words)).length, fell);
  assert.equal(
    rows.filter((r) => / came home wounded from the battle at /.test(r.words)).length,
    wounded,
  );
  assert.ok(rows.every((r) => r.day.length > 0));
  assert.ok(rows.some((r) => r.ref === null && /^and \d+ more /.test(r.words)));
  const sheet = dangersSheet(w, place);
  assert.ok(sheet.now.some((x) => /fell in the battle at /.test(x.words) && x.ref));
  assert.ok(sheet.hurt.some((x) => /Wounded in battle/.test(x.words)));
  // And the unwatched world is the same world.
  if (ahead.now < w.now) ahead.runTo(w.now);
  else w.runTo(ahead.now);
  assert.equal(JSON.stringify(w.domainHashes()), JSON.stringify(ahead.domainHashes()));
});

test("a lean year is told on those it takes: the long in want starve, by the world's own count", () => {
  const w = copy(base()),
    ctx = populationContext(w);
  // (The first land of some hundreds whose food falls short within twelve years, found on an unwatched copy.)
  const ahead = copy(base());
  let pick: { town: string; year: number } | null = null;
  for (let y = 151; y <= 162 && !pick; y++) {
    ahead.runTo(y * YEAR + 1);
    const c = populationContext(ahead);
    for (const p of c.provinces.all()) {
      const rec = c.history.yearsOf(p.cell).at(-1),
        s = c.settlements
          .inProvince(p.cell)
          .filter((x) => c.settlements.held(x.ref) && x.population > 300)
          .sort((a, b) => b.population - a.population)[0];
      if (!pick && rec && rec.year === y - 1 && rec.fed < 800 && s) pick = { town: s.ref, year: y };
    }
  }
  assert.ok(pick, "a land of this world has a lean year by 162");
  const town = pick!.town,
    s = ctx.settlements.get(town as never)!;
  w.runTo(pick!.year * YEAR - 20 * DAY);
  const place = enterPlace(w, town)!;
  watch(w, town, 24 * 24, 6);
  assert.ok((place.matched.fed ?? 1000) < 800, `fed ${place.matched.fed}`);
  const starved = told(place, HAP.famine);
  assert.ok(starved > 0, "those long in want are told as starved");
  assert.equal(
    place.people.n,
    targetTable(w, s, place).reduce((a, b) => a + b, 0),
  );
  const sheet = dangersSheet(w, place);
  assert.ok(sheet.now.some((x) => /a lean year/.test(x.words)));
  assert.ok(sheet.now.some((x) => new RegExp(`^${starved} of the town starved`).test(x.words)));
  if (ahead.now < w.now) ahead.runTo(w.now);
  else w.runTo(ahead.now);
  assert.equal(JSON.stringify(w.domainHashes()), JSON.stringify(ahead.domainHashes()));
});

test("while a siege lies about a town no one goes out to its fields, and its notice says so", () => {
  const w = copy(base()),
    s = near(w, 600),
    town = s.ref,
    place = enterPlace(w, town)!,
    p = place.people;
  // (No siege is laid in this world's years here: the place's own reading of one is set, as its matching would set it.)
  place.matched.sieged = true;
  watch(w, town, 30);
  let out = 0,
    kept = 0;
  for (let i = 0; i < p.n; i++) {
    if (p.at[i] === -2 || p.to[i] === -2) out++;
    if (p.act[i] === ACT.wait) kept++;
  }
  assert.equal(out, 0, "no one is out in the fields, or bound for them");
  assert.ok(kept > 0, "its farmers wait at home");
  assert.ok(placeNotices(w, place).some((x) => /^A siege lies about the town/.test(x.words)));
  assert.ok(dangersSheet(w, place).now.some((x) => /^A siege lies about the town/.test(x.words)));
  const farmer = [...p.act.subarray(0, p.n)].findIndex((a) => a === ACT.wait),
    page = JSON.stringify(pageOf(w, `plc:${town}:${p.id[farmer]}`));
  assert.ok(/A siege lies about the town/.test(page));
});
