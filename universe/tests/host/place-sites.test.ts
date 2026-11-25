// Sites worked in place (town mode, fourth slice): a building a town was asked to raise is a site of its place. Left
// alone it goes up by its land's month and the world is what it was; taken in hand, a crew of the place's own people
// carries to it and builds it, what they did is told to its land, and nothing is raised twice; finished, it stands by the
// world's own rule; given back, the land's month takes it up again; kept in the save; and its lot's page says all of it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY, MONTH, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import {
  asksOf,
  managedOf,
  populationContext,
  siteInHand,
  siteMostHands,
  siteOwed,
  type Ask,
} from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { townOffers } from "../../src/host/inspect/asks.ts";
import {
  ACT,
  AT,
  BOUND_SITE,
  TICKS_PM,
  enterPlace,
  placeDigest,
  placeSites,
  placesOf,
  settleOf,
  type Place,
} from "../../src/host/place.ts";
import { placeFrame, placePlan, workSheet } from "../../src/host/placeplan.ts";
import { placeLotRef, type VillagePlan } from "../../src/bridge/index.ts";
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
const settle = (w: World, town: string): number => {
  const told = settleOf(w, town);
  if (!told) return 0;
  order(w, "place.settle", told);
  return told.built.reduce((n, b) => n + b[1], 0);
};

/** A town of a world that takes up the raising of a building, and the asking: the same in every copy of the world. */
function asked(w: World): { town: string; ask: Ask } {
  const ctx = populationContext(w),
    towns = ctx.settlements
      .all()
      .filter((s) => ctx.settlements.held(s.ref) && s.population >= 200 && s.population <= 3000)
      .sort((a, b) => a.population - b.population || (a.ref < b.ref ? -1 : 1));
  for (const s of towns) {
    for (const r of townOffers(w, s.ref)?.raises ?? []) {
      if (r.what === "walls" || r.what === "well") continue;
      order(w, "town.ask", { village: s.ref, kind: "raise", what: r.what });
      const a = asksOf(w).ofTown(s.ref).at(-1)!;
      if (a.work && a.work.effort >= 60) return { town: s.ref, ask: a };
    }
  }
  throw new Error("no town of this world takes up a building");
}
/** The place watched as the page watches it: a frame a few times a day, its doings told at each month's turn. */
function watch(w: World, town: string, days: number, tell = true): number {
  let told = 0,
    month = Math.floor(w.now / MONTH);
  for (let k = 0; k < days * 4; k++) {
    w.runTo(w.now + DAY / 4);
    placeFrame(w, town, []);
    const m = Math.floor(w.now / MONTH);
    if (m !== month) {
      month = m;
      if (tell) told += settle(w, town);
    }
  }
  return told;
}

test("a site left alone goes up by its land's month, and a world that only looks is the world it was", () => {
  const quiet = copy(base()),
    looked = copy(base()),
    { town, ask } = asked(quiet),
    again = asked(looked);
  assert.equal(again.town, town);
  const place = enterPlace(looked, town)!,
    sites = placeSites(looked, place);
  assert.equal(sites.length, 1);
  assert.equal(sites[0]!.lot, ask.work!.at);
  assert.equal(sites[0]!.inHand, false);
  assert.equal(sites[0]!.crew.length, 0);
  // (A site is no building to work in or keep food in until it stands.)
  assert.ok(place.bldgs.site.some((n) => n === ask.n + 1));
  for (let i = 0; i < place.people.n; i++) assert.notEqual(place.people.work[i], ask.work!.at);
  watch(looked, town, 75, false);
  quiet.runTo(looked.now);
  assert.ok(managedOf(looked)!.dormant());
  assert.equal(again.ask.work!.worked, ask.work!.worked);
  assert.ok(ask.work!.worked >= 2 * ask.work!.hands, "its land's month worked it");
  assert.equal(JSON.stringify(looked.domainHashes()), JSON.stringify(quiet.domainHashes()));
  assert.deepEqual(
    looked.checkpoints().map((c) => c.chain),
    quiet.checkpoints().map((c) => c.chain),
  );
  const now = placeSites(looked, placesOf(looked)!.get(town)!)[0]!;
  assert.ok(Math.abs(now.share - ask.work!.worked / ask.work!.effort) < 1e-9);
});

test("the order to take a site in hand is checked", () => {
  const w = copy(base()),
    { town, ask } = asked(w),
    most = siteMostHands(populationContext(w), ask),
    bad = (args: unknown) => assert.throws(() => w.submit("place.site", args));
  bad({ town, ask: 99, hands: 2 });
  bad({ town, ask: ask.n, hands: 0 });
  bad({ town, ask: ask.n, hands: most + 1 });
  bad({ town, ask: ask.n, hands: 1.5 });
  bad({ town: "nowhere", ask: ask.n, hands: 2 });
  order(w, "place.site", { town, ask: ask.n, hands: most });
  assert.ok(siteInHand(managedOf(w)!.get(town), ask.n));
  assert.equal(ask.work!.hands, most);
  order(w, "place.site", { town, ask: ask.n, hands: null });
  assert.ok(!siteInHand(managedOf(w)!.get(town), ask.n));
});

test("a site in hand is carried to and built by a crew of the place's own, told to its land, and never raised twice", () => {
  const w = copy(base()),
    alone = copy(base()),
    { town, ask } = asked(w),
    other = asked(alone),
    work = ask.work!,
    hands = Math.min(siteMostHands(populationContext(w), ask), work.hands + 2);
  order(w, "place.site", { town, ask: ask.n, hands });
  order(alone, "place.site", { town, ask: other.ask.n, hands });
  const place = enterPlace(w, town)!,
    p = place.people,
    crew = () => {
      const out: number[] = [];
      for (let i = 0; i < p.n; i++) if (p.bound[i] === BOUND_SITE) out.push(i);
      return out;
    };
  assert.equal(crew().length, hands, "a crew of as many as ordered");
  for (const i of crew()) assert.equal(p.work[i], work.at);
  assert.equal(placeSites(w, place)[0]!.inHand, true);
  const before = work.worked,
    t0 = w.now,
    seen = new Set<number>();
  let told = 0,
    month = Math.floor(w.now / MONTH),
    turns = 0;
  for (let k = 0; k < 70 * 8; k++) {
    w.runTo(w.now + DAY / 8);
    placeFrame(w, town, []);
    for (const i of crew()) seen.add(p.act[i]!);
    const m = Math.floor(w.now / MONTH);
    if (m !== month) {
      month = m;
      turns++;
      told += settle(w, town);
    }
  }
  told += settle(w, town);
  assert.ok(seen.has(ACT.build), "they build");
  assert.ok(seen.has(ACT.stuff), "and carry what it is built of");
  const site = placeSites(w, place)[0]!;
  assert.ok(site.brought > 0 && site.brought >= site.stuff);
  assert.ok(told > 0, "what they did was told");
  // Nothing raised twice: all its land's count holds is what the place told, and its land's month's hands for the time
  // no telling covered; what it still runs ahead by (told late) is owed, and no more than a month of its hands.
  const months = (w.now - t0) / MONTH,
    owed = siteOwed(w, ask),
    done = work.worked - before - owed;
  assert.ok(owed <= hands, `owed ${owed}`);
  assert.ok(done <= told + 1, `done ${done} of ${told} told`);
  assert.ok(done >= told - 1, `done ${done} of ${told} told`);
  // (Left to its land's month, the same hands do so much in the same time: the place's crew are of that order.)
  alone.runTo(w.now);
  const byMonth = other.ask.work!.worked - before;
  assert.equal(byMonth, hands * turns);
  assert.ok(told > byMonth * 0.4 && told < byMonth * 2.5, `${told} told, ${byMonth} by the month`);
  assert.ok(months > 2);
  // Its sheet and its lot's page say how far it has got and what it wants.
  const row = workSheet(w, place).sites[0]!;
  assert.equal(row.inHand, true);
  assert.equal(row.hands, hands);
  assert.ok(row.share > 0 && row.share < 1);
  const page = pageOf(w, placeLotRef(town, work.at)),
    text = JSON.stringify(page);
  assert.ok(
    /Going up/.test(text) && /tonnes still wanted/.test(text) && /by your order/.test(text),
  );
  assert.ok(!/undefined|NaN/.test(text), text.match(/.{40}(undefined|NaN).{40}/)?.[0]);
  // One of its crew says why.
  const builder = crew()[0]!,
    person = JSON.stringify(pageOf(w, `plc:${town}:${p.id[builder]}`));
  assert.ok(/One of the crew at /.test(person), "a builder's page says whose crew they are of");
  assert.ok(/'s site/.test(person) && !/going up by your order/.test(person));
});

test("a site in hand is finished by the world's own rule, then stands, and its crew go back to their work", () => {
  const w = copy(base()),
    { town, ask } = asked(w),
    work = ask.work!;
  order(w, "place.site", { town, ask: ask.n, hands: siteMostHands(populationContext(w), ask) });
  const place = enterPlace(w, town)!;
  let days = 0;
  while (work.done === null && days < 3000) {
    watch(w, town, 10);
    days += 10;
    // (All it wants done here: told at once, as the page does.)
    if (placeSites(w, place)[0]?.raised) settle(w, town);
  }
  assert.ok(work.done !== null, `done in ${days} days`);
  assert.ok(work.worked >= work.effort);
  assert.ok(work.worked <= work.effort + work.hands, "and not by more than a month's hands over");
  assert.ok(work.doneEvent, "told as raised");
  placeFrame(w, town, []);
  assert.equal(placeSites(w, place).length, 0);
  const b = place.bldgs.lot.indexOf(work.at);
  assert.ok(b > 0 && place.bldgs.site[b] === 0, "it stands");
  for (let i = 0; i < place.people.n; i++) assert.notEqual(place.people.bound[i], BOUND_SITE);
  // (Its orders hold it no longer once its land is next told anything: finished by a telling, it is let go in that
  // telling; finished by its land's month between two, its five numbers wait for the next, with its asking done.)
  const kept = managedOf(w)!.get(town)!.sites;
  assert.ok(kept.length === 0 || (kept.length === 5 && kept[0] === ask.n && work.done !== null));
  assert.equal(place.sites.length, 0);
});

test("a site given back, or its town left unwatched, goes up by its land's month again", () => {
  const w = copy(base()),
    { town, ask } = asked(w),
    work = ask.work!;
  order(w, "place.site", { town, ask: ask.n, hands: work.hands });
  const place = enterPlace(w, town)!;
  watch(w, town, 40);
  settle(w, town);
  // Unwatched: nothing is told, and its land's month works it, less only what was told of the months before.
  const at = work.worked;
  w.runTo(w.now + 4 * MONTH);
  assert.ok(work.worked - at >= 2 * work.hands, `${work.worked - at} in four unwatched months`);
  assert.ok(work.worked - at <= 4 * work.hands);
  assert.equal(siteOwed(w, ask), 0);
  // Come back to after long: its crew is still its crew, and what was done unwatched is not told again.
  placeFrame(w, town, []);
  assert.equal(place.sites.length, 1);
  assert.equal(place.sites[0]!.ticks, 0);
  // Given back: the crew go back to their work, and its land's month has it alone.
  settle(w, town);
  order(w, "place.site", { town, ask: ask.n, hands: null });
  placeFrame(w, town, []);
  assert.equal(place.sites.length, 0);
  for (let i = 0; i < place.people.n; i++) assert.notEqual(place.people.bound[i], BOUND_SITE);
  const then = work.worked;
  w.runTo(w.now + 3 * MONTH);
  if (work.done === null) assert.ok(work.worked - then >= 2 * work.hands);
  assert.ok(!siteInHand(managedOf(w)!.get(town), ask.n));
});

test("a place with a site in hand is kept in the save and goes on from it the same", () => {
  const a = copy(base()),
    { town, ask } = asked(a);
  order(a, "place.site", { town, ask: ask.n, hands: ask.work!.hands });
  const pa = enterPlace(a, town)!;
  watch(a, town, 12);
  const b = copy(a),
    pb = placesOf(b)!.get(town)!;
  assert.equal(placeDigest(pb), placeDigest(pa));
  assert.equal(pb.sites.length, 1);
  assert.ok(pb.sites[0]!.ticks > 0 || pb.sites[0]!.brought > 0);
  for (const w of [a, b]) {
    watch(w, town, 25);
    settle(w, town);
  }
  assert.equal(placeDigest(pb), placeDigest(pa));
  assert.equal(JSON.stringify(b.domainHashes()), JSON.stringify(a.domainHashes()));
  assert.equal(asksOf(b).ofTown(town)[ask.n]!.work!.worked, ask.work!.worked);
});

test("the plan of a town entered draws a site in hand as far as its own people have got it", () => {
  const w = copy(base()),
    { town, ask } = asked(w),
    work = ask.work!;
  order(w, "place.site", { town, ask: ask.n, hands: work.hands });
  const place: Place = enterPlace(w, town)!;
  watch(w, town, 20, false);
  const site = placeSites(w, place)[0]!,
    read = { ref: "x", share: 0, read: 0, done: 1, stopped: false, hands: 1, crew: ["a"] },
    plan = {
      name: "T",
      homes: [],
      people: [],
      town: {
        civics: [
          {
            kind: site.kind,
            at: work.at,
            lots: 1,
            start: work.start,
            end: 0,
            fell: null,
            asked: read,
          },
          { kind: "hall", at: work.at + 50, lots: 1, start: 0, end: 0, fell: null },
        ],
      },
    } as unknown as VillagePlan,
    out = placePlan(w, plan, place, 60),
    drawn = out.town!.civics[0]!.asked!;
  assert.equal(drawn.share, site.share);
  assert.equal(drawn.read, place.t);
  assert.ok(drawn.done > place.t);
  assert.deepEqual(drawn.crew, []);
  assert.equal(out.town!.civics[1]!.asked, undefined);
  assert.ok(site.share * work.effort >= work.worked - siteOwed(w, ask));
  assert.ok(TICKS_PM > 1000 && AT.fields < 0);
});
