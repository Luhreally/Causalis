// 2026-11-14 ("the god's hand must really do what its sliders say"): the greatest drought or blight held five years
// starves a land that keeps two years' bread and buys from its neighbours (its dead and the children it puts off), the faintest does not, and one year of the
// greatest is lived through; a realm stirred to the most loses lands, one stirred a little loses none; a town asked for
// stands on the land, with a page, and is kept. Each on first light at 220, forked from one build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, loadWorld, saveWorld, seedFromText, type World } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  ACT_REACH,
  COLS,
  GOD_EVENTS,
  POPULATION_EVENTS,
  STIR_DEEP,
  blightRot,
  godProblem,
  godTownSite,
  marketsOf,
  politiesOf,
  populationContext,
  stirDepth,
  watered,
  type Act,
  type Polity,
} from "../../src/sim/index.ts";
import { FOODS } from "../../src/rules/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { universeWorld } from "../host/worlds.ts";

const AT = 220;
const fork = (() => {
  let doc: ReturnType<typeof saveWorld> | null = null;
  return (): World => {
    if (!doc) {
      const w = universeWorld(EARTH, "first light", AT);
      doc = saveWorld(w, "r");
    }
    return loadWorld(doc, (s) => EARTH.build(s), "r").world;
  };
})();
const realmsBySize = (world: World): Polity[] =>
  [...politiesOf(world).living()].sort(
    (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
  );

test("what a strength reaches: nothing at the strength of old or under an act of the world's own", () => {
  const act = (strength?: number, sign: 1 | -1 = -1) =>
    ({ kind: "harvest", sign, ...(strength === undefined ? {} : { strength }) }) as Act;
  assert.equal(blightRot(null), 0);
  assert.equal(blightRot(act()), 0);
  assert.equal(blightRot(act(0.5)), 0);
  assert.equal(blightRot(act(1)), 0);
  assert.equal(blightRot(act(3, 1)), 0, "a blessing rots nothing");
  assert.ok(blightRot(act(1.5)) > 0 && blightRot(act(1.5)) < blightRot(act(2)));
  assert.ok(Math.abs(blightRot(act(3)) - 2 * ACT_REACH.rot) < 1e-9);
  // (No natural year's rain is under the wells' line: weatherYear clamps it there.)
  assert.equal(watered(ACT_REACH.wells, 5), 1000);
  assert.equal(watered(1, 5), 1000);
  assert.equal(watered(0.1, 0), 1000, "the wells hold on the day a drought is laid");
  assert.ok(watered(0.1, 1) > watered(0.1, 2) && watered(0.1, 2) > watered(0.1, 3));
  assert.equal(watered(0.1, 3), watered(0.1, 30), "as dry as they get once ground water is gone");
  assert.ok(watered(0.3, 5) > watered(0.15, 5));
  assert.equal(watered(0, 5), 0);
  // (Stirring: the grievance asked up to three parts in four, deeper past it.)
  for (const v of [0.25, 0.5, STIR_DEEP.from]) assert.equal(stirDepth(v), v);
  assert.equal(stirDepth(1), 2);
});

test("the greatest drought or blight held five years starves a well-stocked land; the faintest does not", () => {
  const base = fork(),
    now = base.now,
    c0 = populationContext(base),
    r0 = realmsBySize(base)[0]!,
    months = (w: World, k: number) =>
      (marketsOf(w).get(k)?.food(FOODS) ?? 0) /
      Math.max(1, populationContext(w).provinces.get(k)?.total() ?? 0),
    // (The best-stocked land of the largest realm with a few thousand in it, and no realm's seat: the held a realm's foes give
    // up at a peace come home to its seat, sim/war/held.ts, and a peace the act hastens is no part of the act's toll. First
    // light's largest realm's seat was this land till 2026-11-25: a blight's peace brought 4,036 of its own home to it in 222,
    // in the years a land let be was still at war.)
    seats = new Set([...politiesOf(base).living()].map((p) => p.seat)),
    land = r0.members
      .filter((k) => (c0.provinces.get(k)?.total() ?? 0) > 3000 && !seats.has(k))
      .sort((a, b) => months(base, b) - months(base, a) || a - b)[0]!;
  assert.ok(months(base, land) > 18, `the land keeps ${months(base, land)} months' food`);
  const run = (cmd: string | null, strength: number, years: number) => {
    const w = fork(),
      c = populationContext(w),
      p = c.provinces.get(land)!;
    if (cmd) w.submit(cmd, { cell: land, sign: -1, years, strength });
    let dead = 0,
      least = p.total();
    for (let y = 1; y <= 6; y++) {
      w.runTo(now + y * YEAR);
      dead += c.history.deathsIn(land, AT + y - 1);
      least = Math.min(least, p.total());
    }
    const famines = w.events
      .all()
      .filter((e) => e.t > now && e.type === POPULATION_EVENTS.famine.type && e.place === p.ref);
    return { people: p.total(), least, dead, famines };
  };
  const none = run(null, 1, 1);
  assert.equal(none.famines.length, 0);
  for (const cmd of ["act.rain", "act.harvest"]) {
    const faint = run(cmd, 0.5, 5),
      short = run(cmd, 3, 1),
      most = run(cmd, 3, 5),
      say = `${cmd}: people after six years / dead in them: none ${none.people}/${none.dead}, faint for five ${faint.people}/${faint.dead}, a year of the greatest ${short.people}/${short.dead}, five of it ${most.people}/${most.dead} (fewest ${most.least}, ${most.famines.length} famines)`;
    console.log(say);
    assert.ok(Math.abs(faint.people - none.people) < none.people * 0.03, say);
    assert.equal(faint.famines.length, 0, say);
    assert.ok(most.famines.length >= 2, say);
    // (Where a land's births answer to the bread it has put by, rules/seasons.ts, one starved has fewer children as
    // well as more dead: its toll is the people it lacks against a land let be, a fifth of them at the least at the
    // end of the six years, more of them dead than in a land let be, and fewer at their fewest. On first light at
    // 220, 2026-11-15: the drought's 42 in a hundred lacked and 1.75 times the dead, the blight's 35 and 1.17. With the rounds
    // merged a blight leaves 18 in a hundred lacked and 1.37 times the dead (16,377 let be, 13,377 after five years of it),
    // the drought still over a fifth. Measured on a land that is no realm's seat at the release pass, 2026-11-25: the
    // drought 30 in a hundred lacked, 1.89 times the dead, its fewest 70 in a hundred of a land let be; the blight 17,
    // 1.67 and 81. With the world's own blows ranked by what they did to their land (rules/nature.ts, 2026-11-26): the drought
    // 28 in a hundred lacked, 1.87 times the dead, its fewest 72; the blight 10.5, 1.57 and 81. A blight rots a share of each
    // harvest and the stores carry a land through part of it, so its fewest is held to nine tenths and its lack to a
    // twelfth, the drought's to four fifths and a fifth.)
    const blight = cmd === "act.harvest";
    assert.ok(none.people - most.people > none.people * (blight ? 0.08 : 0.2), say);
    assert.ok(most.dead > none.dead * 1.1, say);
    assert.ok(most.least < none.people * (blight ? 0.9 : 0.8), say);
    // (Each famine cites the act that made it.)
    assert.ok(
      most.famines[0]!.causes.some((x) => x.role === "agent"),
      "the famine does not cite the god's act",
    );
    // (A year of the greatest is hard and lived through: stores buy time.)
    assert.ok(short.dead > none.dead, say);
    assert.ok(short.people > none.people * 0.85, say);
    assert.ok(short.people > most.least, say);
  }
});

test("a realm stirred to the most loses lands over the years; stirred a little, none", () => {
  const base = fork(),
    now = base.now,
    top = realmsBySize(base).slice(0, 3);
  let lostMost = 0,
    lostLittle = 0,
    lostNone = 0;
  for (const r0 of top) {
    const run = (level: number | null) => {
      const w = fork(),
        r = politiesOf(w).get(r0.ref)!,
        by = [...politiesOf(w).living()].find((q) => q.ref !== r.ref)!;
      if (level !== null)
        w.submit("reign.god", {
          realm: by.ref,
          ruler: by.ruler.name,
          channel: true,
          what: "stir",
          to: r.ref,
          level,
        });
      w.runTo(now + 4 * YEAR);
      return w.events
        .all()
        .filter(
          (e) =>
            e.t > now &&
            (e.type === "polity.seceded" || e.type === "polity.split") &&
            e.subjects.includes(r.ref),
        ).length;
    };
    lostNone += run(null);
    lostLittle += run(0.25);
    lostMost += run(1);
  }
  console.log(
    `stir: breakaways in four years over three realms: unstirred ${lostNone}, a little ${lostLittle}, the most ${lostMost}`,
  );
  assert.equal(lostLittle, lostNone, "a little stirring broke lands away");
  assert.ok(lostMost >= lostNone + 5, `the most broke ${lostMost} away, unstirred ${lostNone}`);
});

test("a town asked for stands on the empty land that feeds the most, has a page, and is kept", () => {
  const w = fork(),
    now = w.now,
    c = populationContext(w),
    realms = politiesOf(w),
    r = realmsBySize(w)[0]!,
    god = { realm: r.ref, ruler: r.ruler.name, channel: true, what: "town" };
  // (First light at 220 has no empty land beside any realm: two lands of this one are emptied and left, as lands their
  // people died out of are.)
  assert.match(String(godProblem(w, c, god)), /No empty land/);
  const emptied = r.members.filter((k) => k !== r.seat).slice(0, 2);
  for (const k of emptied) {
    const p = c.provinces.get(k)!;
    for (let row = 0; row < p.counts.rows; row++)
      for (let o = 0; o < COLS; o++) p.counts.add(row, o, -p.counts.get(row, o));
    realms.leave(r, k);
  }
  assert.equal(godProblem(w, c, god), null);
  const site = godTownSite(c, r)!,
    lands = r.members.length;
  assert.ok(emptied.includes(site.cell));
  const had = c.settlements.inProvince(site.cell).length;
  w.submit("reign.god", { ...god, people: 10_000 });
  w.runTo(now + 2);
  const did = w.events.all().find((e) => e.type === GOD_EVENTS.did.type && e.t > now)!,
    d = did.data as { cell: number; people: number; feeds: number };
  assert.equal(d.cell, site.cell);
  assert.equal(d.feeds, site.feeds);
  const p = c.provinces.get(site.cell)!,
    towns = c.settlements.inProvince(site.cell),
    town = towns.find((s) => s.market)!;
  assert.ok(p.total() > 9_500 && p.total() <= 10_000, `${p.total()} people`);
  assert.equal(realms.of(site.cell)?.ref, r.ref);
  assert.equal(r.members.length, lands + 1);
  assert.ok(town, "no market town stands on the land");
  assert.equal(towns.length, Math.max(1, had));
  assert.ok(town.population > 9_500, `the town holds ${town.population}`);
  assert.equal(pageOf(w, town.ref).kind, "town");
  assert.equal(pageOf(w, `cell:0:${site.cell}`).kind, "land");
  // (A year on it is there still, peopled and of the realm; and a save keeps it.)
  w.runTo(now + YEAR + 2);
  assert.ok(p.total() > 8_000, `${p.total()} people a year on`);
  assert.ok(c.settlements.inProvince(site.cell).some((s) => s.ref === town.ref && s.market));
  assert.ok(town.population > 0);
  const back = loadWorld(
      JSON.parse(JSON.stringify(saveWorld(w, "r"))) as ReturnType<typeof saveWorld>,
      (s) => EARTH.build(s),
      "r",
    ).world,
    cb = populationContext(back);
  assert.deepEqual(back.domainHashes(), w.domainHashes());
  assert.equal(cb.provinces.get(site.cell)!.total(), p.total());
  assert.ok(cb.settlements.inProvince(site.cell).some((s) => s.ref === town.ref && s.market));
});
