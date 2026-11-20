// Things of the mind (sim/ideas, rules/ideas.ts), peoples abroad (sim/culture/abroad.ts) and land set aside (rules/lessons.ts
// kept-woods, kept-wild): the rules as numbers, then each forced on a real world, since a run of four centuries may meet none.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hasher, YEAR, type Ref, type SimTime } from "../../src/kernel/index.ts";
import {
  ABROAD,
  IDEA,
  LESSON_RESPONSE,
  NOTE,
  PILGRIM,
  WORK,
  abroadAfter,
  creditLeft,
  ideaApart,
  ideaCreed,
  ideaLeads,
  ideaSpreads,
  ideaUnmet,
  kinTrade,
  pilgrimsFeed,
  pilgrimsFrom,
  workForm,
  workRenownNow,
} from "../../src/rules/index.ts";
import {
  AbroadStore,
  PilgrimsStore,
  SchoolsStore,
  WorksStore,
  abroadOf,
  abroadYear,
  asideIn,
  ideasYear,
  kinAcross,
  lessonsOf,
  memoryLost,
  patronCredit,
  pilgrimFeed,
  pilgrimsOf,
  pilgrimsYear,
  politiesOf,
  populationContext,
  pullOnHold,
  pullOnLaw,
  schoolOver,
  schoolRef,
  schoolsOf,
  strangersIn,
  worksOf,
  worksRenown,
  worksYear,
} from "../../src/sim/index.ts";
import { eventHasWords, schoolWords, why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

test("a school's leanings are what a group wants and is not given; its name is what it presses hardest", () => {
  // (Held by one, wanted carried by many; the land its lord's, wanted the tiller's.)
  const creed = ideaCreed([0.5, 0.6, 0.5, 0.5], [0.5, 0.15, 0.5, 0.45], [2, 1, 1, 1], [0, 1, 1, 1]);
  assert.equal(creed.length, 8);
  assert.equal(creed[1], IDEA.lean, "a gap past the bound is the bound");
  assert.equal(creed[0], 0);
  assert.equal(creed[4], IDEA.lawLean);
  assert.equal(creed[5], 0, "a law wanted in the middle leans nowhere");
  assert.deepEqual(ideaLeads(creed), { part: 1, end: 1 });
  assert.deepEqual(ideaLeads([0, 0, -9, 0, 0, 0, 0, 0]), { part: 2, end: 0 });
  // (A law that already stands where it is wanted is pressed half as hard.)
  assert.ok(
    Math.abs(
      ideaCreed([0.5, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5], [2, 1, 1, 0], [2, 1, 1, 1])[4]!,
    ) < IDEA.lawLean,
  );
  assert.equal(ideaUnmet(IDEA.unmet), 0);
  assert.equal(ideaUnmet(4 * IDEA.unmet), 1);
  // (A teaching near what a land already holds is no school of its own.)
  assert.equal(ideaApart(creed, creed), 0);
  assert.ok(
    ideaApart(
      creed,
      creed.map((v) => -v),
    ) >= IDEA.apart,
  );
  assert.ok(
    ideaApart(
      creed,
      creed.map((v) => v + 2),
    ) < IDEA.apart,
  );
});

test("a school spreads by speech alike, a road, a body that teaches and higher learning, less where word is watched", () => {
  const base = ideaSpreads(0.9, false, false, 0, 0.5, false);
  assert.ok(base > 0 && base < IDEA.spread);
  assert.ok(ideaSpreads(0.9, true, false, 0, 0.5, false) > base);
  assert.ok(ideaSpreads(0.9, false, true, 0, 0.5, false) > base);
  assert.ok(ideaSpreads(0.9, false, false, 1, 0.5, false) > base);
  assert.ok(ideaSpreads(0.9, false, false, 0, 0.1, false) < base);
  assert.ok(ideaSpreads(0.5, false, false, 0, 0.5, false) < base);
  assert.ok(ideaSpreads(0.9, false, false, 0, 0.5, true) < base);
});

test("works, pilgrims and peoples abroad as numbers", () => {
  assert.equal(workForm(0, 0, 0, false), "told");
  assert.equal(workForm(1, 0, 0, false), "written");
  assert.equal(workForm(1, 1, 0, true), "raised");
  assert.equal(workForm(1, 1, 1, true), "sent");
  assert.equal(workRenownNow(3000, 0), 3000);
  assert.ok(workRenownNow(3000, 100) < 3000 && workRenownNow(3000, 5000) === 1000);
  assert.equal(creditLeft(0), 1);
  assert.equal(creditLeft(WORK.fresh), 1);
  assert.equal(creditLeft(2 * WORK.fresh), 0);
  // (Half as many for each PILGRIM.half kilometres; none of the undevout.)
  const near = pilgrimsFrom(1e6, 0.5, 0);
  assert.equal(near, 1e6 * PILGRIM.share * 0.5);
  assert.ok(Math.abs(pilgrimsFrom(1e6, 0.5, PILGRIM.half) - near / 2) <= 1);
  assert.equal(pilgrimsFrom(1e6, 0, 100), 0);
  assert.equal(pilgrimsFeed(1e9, 1000), PILGRIM.most);
  assert.equal(pilgrimsFeed(100, 0), 0);
  // (A people abroad halves in a generation at speech wholly unlike, sooner at speech alike and where the land reads.)
  assert.ok(Math.abs(abroadAfter(400, 25, 25, 0) - 200) < 1e-6);
  assert.ok(abroadAfter(400, 25, 25, 0.9) < 150);
  assert.ok(abroadAfter(400, 25, 25, 0, 1) < abroadAfter(400, 25, 25, 0));
  assert.equal(kinTrade(0), 1);
  assert.equal(kinTrade(0.5), 1 + ABROAD.trade);
  assert.ok(kinTrade(0.05) > 1 && kinTrade(0.05) < 1.05);
});

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world),
  // (A realm of several lands none of which yet holds a school or keeps a work: what is forced on it is then all it has.)
  realm = politiesOf(world)
    .living()
    .filter(
      (r) =>
        r.members.length >= 2 &&
        r.members.every((c) => !schoolsOf(world)!.of(c) && !worksOf(world)!.in(c).length) &&
        !worksOf(world)!.carries(r.event) &&
        !worksOf(world)!.for("seat", r.ref).length,
    )
    .sort((a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1))[0]!,
  year = 400,
  anEvent = realm.event;

test("a world of four centuries has schools, works and peoples abroad of its own", () => {
  const schools = schoolsOf(world)!.all(),
    works = worksOf(world)!.all();
  assert.ok(schools.length >= 1, `${schools.length} schools`);
  for (const s of schools) {
    assert.equal(s.creed.length, 8);
    assert.ok(s.creed.some((v) => v !== 0) && s.creed.every((v) => Math.abs(v) <= IDEA.lean));
    assert.ok(s.name.length > 0 && s.founded <= 400);
  }
  assert.ok(works.length >= 1, `${works.length} works`);
  for (const w of works) {
    assert.ok(w.renown >= NOTE.line / 2 && w.ofYear <= w.year && w.year - w.ofYear <= WORK.back);
    assert.ok(worksOf(world)!.in(w.land).length <= WORK.keepLand);
  }
  for (const c of abroadOf(world)!.lands()) {
    const list = abroadOf(world)!.of(c)!;
    assert.ok(list.length <= ABROAD.keep);
    for (const e of list) assert.ok(e[1] >= ABROAD.least && e[1] <= ABROAD.most);
  }
});

test("the new stores are a world's, and every new kind of event is said in words", () => {
  assert.ok(schoolsOf(world) && worksOf(world) && pilgrimsOf(world) && abroadOf(world));
  for (const t of [
    "ideas.founded",
    "ideas.taken",
    "ideas.split",
    "ideas.work",
    "ideas.pilgrimage",
    "people.abroad",
  ])
    assert.ok(eventHasWords(t), t);
});

test("a school most of a realm's lands hold draws its numbers and its laws the way it teaches, the more the longer held", () => {
  const store = schoolsOf(world)!;
  assert.equal(schoolOver(world, realm.members, realm.seat, year, 70), null, "none held: no pull");
  assert.equal(pullOnHold(null, 1), 0);
  const id = store.mint();
  store.add({
    id,
    name: "the Many Voices of Testing",
    founded: year - 60,
    event: anEvent,
    seat: realm.seat,
    from: null,
    creed: [0, 20, 10, 0, 15, 0, -15, 0],
    founder: 0,
    by: "Someone",
    speaks: "farmers",
    realm: realm.ref,
    holy: false,
  });
  store.set(realm.seat, { school: id, since: year - 60, via: realm.seat });
  const one = schoolOver(world, realm.members, realm.seat, year, 70)!;
  assert.equal(one.school.id, id);
  assert.ok(one.hold > 0 && one.hold < 1);
  for (const c of realm.members) store.set(c, { school: id, since: year - 60, via: realm.seat });
  const all = schoolOver(world, realm.members, realm.seat, year, 70)!;
  assert.ok(all.hold > one.hold && all.hold <= 1);
  assert.ok(pullOnHold(all, 1) > 0 && pullOnHold(all, 1) <= (20 / 100) * IDEA.pull);
  assert.equal(pullOnHold(all, 0), 0);
  assert.ok(pullOnLaw(all, 0) > 0 && pullOnLaw(all, 2) < 0);
  // (Held a year, it draws far less than held two generations.)
  for (const c of realm.members) store.set(c, { school: id, since: year - 1, via: realm.seat });
  assert.ok(schoolOver(world, realm.members, realm.seat, year, 70)!.hold < all.hold / 5);
  assert.equal(store.landsOf(id), realm.members.length);
  assert.match(
    schoolWords(store.get(id)!),
    /Many Voices of Testing, which teaches choices carried by many/,
  );
  assert.match(why(world, schoolRef(id)).claim, /Someone founded it/);
  // (Saved and loaded, the same.)
  const again = new SchoolsStore();
  again.load(JSON.parse(JSON.stringify(store.save())));
  const a = new Hasher(),
    b = new Hasher();
  store.hashInto(a);
  again.hashInto(b);
  assert.equal(a.hex(), b.hex());
  assert.equal(again.landsOf(id), realm.members.length);
});

test("a work carries its memory, adds to its land's renown and credits its patron, for a time", () => {
  const store = worksOf(world)!;
  assert.equal(memoryLost(world, anEvent), 1);
  assert.equal(worksRenown(world, realm.seat, year), 1);
  assert.equal(patronCredit(world, "seat", realm.ref, year), 0);
  store.add({
    id: store.mint(),
    title: "Testing",
    form: 0,
    year: year - 5,
    land: realm.seat,
    maker: 0,
    by: "Someone",
    patron: { kind: "seat", ref: realm.ref, name: "Seat", realm: realm.ref },
    of: anEvent,
    theme: "polity.formed",
    ofYear: year - 20,
    renown: 3 * NOTE.line,
    event: anEvent,
  });
  assert.equal(memoryLost(world, anEvent), 1 - WORK.remembers);
  const renown = worksRenown(world, realm.seat, year);
  assert.ok(renown > 1 && renown <= 1 + WORK.renown);
  assert.ok(patronCredit(world, "seat", realm.ref, year) > 0.9);
  assert.equal(patronCredit(world, "seat", realm.ref, year + 3 * WORK.fresh), 0);
  assert.equal(patronCredit(world, "house", realm.ruler.event, year), 0);
  const again = new WorksStore();
  again.load(JSON.parse(JSON.stringify(store.save())));
  assert.equal(again.in(realm.seat).length, 1);
  assert.ok(again.carries(anEvent));
});

test("a people abroad is read by trade, by who a land counts its own, and goes with the generations", () => {
  const store = abroadOf(world)!,
    [a, b] = realm.members as [number, number];
  // (Whatever the world's own moves left in the two is put by: what is forced is then all they keep.)
  store.set(a, []);
  store.set(b, []);
  assert.equal(strangersIn(world, a), 0);
  assert.equal(kinAcross(world, a, b), 1);
  store.set(a, [[0, 250, b, year - 10]]);
  assert.equal(strangersIn(world, a), 0.25);
  assert.equal(kinAcross(world, a, b), kinTrade(0.25));
  assert.equal(kinAcross(world, b, a), kinTrade(0.25), "kin carry trade both ways");
  assert.equal(kinAcross(world, a, a + 1 === b ? a + 2 : a + 1), 1);
  const again = new AbroadStore();
  again.load(JSON.parse(JSON.stringify(store.save())));
  assert.deepEqual(again.of(a), [[0, 250, b, year - 10]]);
  // (Fifty years on with no one new come, fewer are counted abroad there, or none.)
  let t = world.now as SimTime;
  for (let y = 0; y < 50; y++) abroadYear(ctx, (t = (t + YEAR) as SimTime));
  const left = store.of(a)?.find((e) => e[2] === b)?.[1] ?? 0;
  assert.ok(left < 250, `${left}`);
});

test("land set aside is what a people learned to keep, and hunger breaks it", () => {
  const lessons = lessonsOf(world)!,
    cell = realm.seat,
    h = lessons.holder(ctx.provinces.get(cell)!.ref);
  // (Whatever hunger the world's own years left on it is put by, and given back after.)
  const hunger = h.causes.get("famine"),
    had = h.uses.get("kept-woods");
  h.causes.delete("famine");
  h.uses.delete("kept-woods");
  assert.equal(asideIn(h, "aside:woods", year), 0);
  h.uses.set("kept-woods", { w: 1, at: year, ref: null } as never);
  const kept = asideIn(h, "aside:woods", year);
  assert.equal(kept, LESSON_RESPONSE.get("kept-woods")!.most * (1 - 0));
  assert.ok(asideIn(h, "aside:wild", year) >= 0);
  h.causes.set("famine", { cost: 1, at: year } as never);
  assert.ok(
    asideIn(h, "aside:woods", year) < kept / 10,
    "a people going hungry clears what it spared",
  );
  h.uses.delete("kept-woods");
  h.causes.delete("famine");
  if (hunger) h.causes.set("famine", hunger);
  if (had) h.uses.set("kept-woods", had);
});

test("the years run on a world with all of it, and a seat pilgrims come to draws more to its town", () => {
  const pilgrims = pilgrimsOf(world)!;
  assert.equal(pilgrimFeed(world, realm.seat), 0);
  let t = world.now as SimTime;
  for (let y = 0; y < 10; y++) {
    t = (t + YEAR) as SimTime;
    ideasYear(ctx, t);
    worksYear(ctx, t);
    pilgrimsYear(ctx, t);
  }
  // (The school set over the realm above has a seat others hold it far from: whether a pilgrimage stands is the world's.)
  for (const p of pilgrims.all()) {
    // (One that no longer comes is kept stilled, so that its coming again is not told as its first.)
    if (!p.pilgrims) {
      assert.equal(pilgrimFeed(world, p.seat) > PILGRIM.most, false);
      continue;
    }
    assert.ok(p.pilgrims >= PILGRIM.least / 4 && p.lands >= 1 && p.ways.length <= PILGRIM.ways);
    assert.ok(pilgrimFeed(world, p.seat) > 0 && pilgrimFeed(world, p.seat) <= PILGRIM.most);
  }
  const again = new PilgrimsStore();
  again.load(JSON.parse(JSON.stringify(pilgrims.save())));
  assert.equal(again.all().length, pilgrims.all().length);
  assert.ok((anEvent as Ref).length > 0);
});

test("a wood stands where no field can go, a thing stands out the less the oftener a land has known it, and kept minds sit at court", async () => {
  const { fieldsTake, courtYear, courtOf, mindsOf } = await import("../../src/sim/index.ts"),
    { standsOut } = await import("../../src/rules/index.ts");
  // (A land a third of whose ground can be tilled, all of it wooded: its fields take a third of its woods at the most.)
  assert.ok(
    Math.abs(fieldsTake({ forage: 0, farm: 40 * 100 * 0.3, pasture: 0, areaKm2: 100 }, 1) - 0.3) <
      1e-9,
  );
  assert.equal(fieldsTake({ forage: 0, farm: 1e9, pasture: 0, areaKm2: 100 }, 0.5), 1);
  assert.equal(standsOut(5, 0), 5);
  assert.ok(standsOut(5, 9) < 1 && standsOut(6, 1) === 3);
  const minds = mindsOf(world)!,
    court = courtOf(world)!;
  minds.rows.set(realm.ref, {
    realm: realm.ref,
    begun: year - 40,
    past: 150,
    passed: realm.event,
    free: null,
    name: "Testmind",
  });
  let t = world.now as SimTime;
  for (let y = 0; y < 12; y++) courtYear(ctx, (t = (t + YEAR) as SimTime));
  const sits = court.of(realm.ref)?.figures.find((f) => f.seat === "minds");
  assert.ok(sits && sits.name === "Testmind", "the kept minds sit at court by their name");
  assert.notEqual(court.of(realm.ref)!.heir, sits!.id);
  assert.notEqual(court.of(realm.ref)!.rival, sits!.id);
  // (Gone their own way, they leave it.)
  minds.rows.get(realm.ref)!.free = realm.event;
  for (let y = 0; y < 12; y++) courtYear(ctx, (t = (t + YEAR) as SimTime));
  assert.ok(!court.of(realm.ref)?.figures.some((f) => f.seat === "minds"));
  minds.rows.delete(realm.ref);
});
