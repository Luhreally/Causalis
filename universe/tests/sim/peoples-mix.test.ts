import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime } from "../../src/kernel/index.ts";
import { PRINCIPLES, raisedBody } from "../../src/rules/index.ts";
import {
  MixStore,
  addKind,
  broughtIn,
  carriedOf,
  engineeredOf,
  heredityOf,
  kinshipOf,
  COLS,
  CarriedStore,
  ROWS,
  kindsInPlayOf,
  livableFor,
  loreOf,
  mixFactors,
  mixOf,
  mostRaisable,
  nativesDown,
  peopleKin,
  politiesOf,
  populationContext,
  setDown,
  takenIn,
  upliftOf,
  upliftYear,
} from "../../src/sim/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("first light", 30, { start: "spread" });
const ctx = populationContext(world);
const g = ctx.generated;

test("a world of one people holds no shares, and no land of it is weighed", () => {
  assert.equal(mixOf(world), null);
  assert.ok(world.peek<MixStore>("population.mix")?.dormant());
  for (const p of ctx.provinces.all().slice(0, 20)) assert.equal(mixFactors(world, p.cell), null);
  assert.ok(heredityOf(world)?.dormant());
});

test("the lands a chronicle opens on are their people's; no land of our ages writes its bodies", () => {
  const year = Math.floor(world.now / YEAR),
    generation = peopleKin(g).generation;
  let opening = 0;
  for (const p of ctx.provinces.all()) {
    const t = takenIn(ctx, p, year, generation);
    for (const v of [t.cold, t.heat, t.air]) assert.ok(v >= 0 && v <= 1);
    if (p.settledYear <= 0) {
      opening++;
      assert.deepEqual(t, { cold: 1, heat: 1, air: 1 });
    }
    assert.equal(engineeredOf(world, p.cell, ctx.life, generation), null);
  }
  assert.ok(opening > 0);
});

test("a second people set down on a land: its births, deaths and mouths are weighed, its shares move, and it is kept", () => {
  const beast = mostRaisable(ctx, new Set())!,
    makers = g.life.people!.body,
    land = ctx.provinces
      .all()
      .filter((p) => p.cell < g.grid.count && p.total() > 500)
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!,
    kind = addKind(world, {
      key: `raised:${beast.ref}`,
      name: `the ${beast.name}`,
      body: raisedBody(makers, { name: beast.name, size: beast.size, warm: beast.body!.warm }),
      species: beast.index,
      of: null,
      blend: 0,
      since: 30,
      event: null,
    });
  assert.equal(kind, 1);
  setDown(world, land.cell, kind, land.total(), land.total());
  const store = mixOf(world)!;
  assert.deepEqual(store.shares(land.cell), [500, 500]);
  const f = mixFactors(world, land.cell)!;
  assert.ok(f.births > 0 && f.appetite > 0 && f.deaths.length === ctx.life.bands.length);
  assert.ok(f.appetite !== 1 || f.births !== 1);
  // A beast of the world is of its people's tree, and millions of generations from them: no young together.
  const kin = kinshipOf(g, store, 0, kind);
  assert.ok(kin.sameTree && kin.generations > 1e5, `${kin.generations}`);
  world.runTo(world.now + 6 * YEAR);
  const after = store.shares(land.cell);
  assert.equal(after[0]! + after[1]!, 1000);
  assert.notDeepEqual(after, [500, 500]);
  assert.ok(store.tally.moved >= 1);
  assert.deepEqual(
    store.crossings.map((c) => [c.a, c.b, c.fertility]),
    [[0, 1, 0]],
  );
  assert.equal(store.kinds.length, 1);
  // Saved and loaded, it is the same.
  const again = new MixStore();
  again.load(JSON.parse(JSON.stringify(store.save())));
  assert.deepEqual(again.save(), store.save());
  assert.deepEqual(again.shares(land.cell), after);
});

test("hunters and their prey are kept as races once the kinds' turns have come", () => {
  const lin = kindsInPlayOf(world)!;
  assert.ok(lin.races.size > 0, "no race is kept");
  for (const r of lin.races.values()) {
    assert.ok(g.life.species[r.hunter]!.level >= 3 && g.life.species[r.prey]!.level === 2);
    assert.equal(lin.races.get(r.prey), r);
    assert.ok(Math.abs(r.y) <= 3000, JSON.stringify(r));
  }
});

test("a beast raised to thought is a people of its own on its land from the raising", () => {
  const w = peopledWorld("first light", 30, { start: "spread" }),
    c = populationContext(w),
    lore = loreOf(w);
  assert.equal(mixOf(w), null);
  for (const p of politiesOf(w).living())
    for (const id of ["made-bodies", "writing"])
      if (!lore.get(p.seat, id))
        lore.learn(
          p.seat,
          id,
          { year: 30, event: c.provinces.get(p.seat)!.ref },
          PRINCIPLES.find((x) => x.id === id)!,
        );
  // (A raising wants an empty land beside the realm, and this world's are all peopled: one such land is emptied.)
  const realms = politiesOf(w),
    grid = c.generated.grid;
  let emptied = -1;
  for (const p of realms.living()) {
    for (const from of p.members)
      for (let k = grid.offsets[from]!; k < grid.offsets[from + 1]! && emptied < 0; k++) {
        const m = grid.neighbours[k]!,
          land = c.provinces.get(m);
        if (!land || realms.of(m) || !livableFor(c, m)) continue;
        for (let r = 0; r < ROWS; r++)
          for (let o = 0; o < COLS; o++) land.counts.add(r, o, -land.counts.get(r, o));
        emptied = m;
      }
    if (emptied >= 0) break;
  }
  assert.ok(emptied >= 0, "no land beside a realm to empty");
  // (A year's chance in a hundred a realm: the years are tried until one raises.)
  let t = w.now;
  for (let i = 0; i < 4000 && !upliftOf(w)!.raisings.length; i++)
    upliftYear(c, (t = (t + YEAR) as SimTime));
  const raising = upliftOf(w)!.raisings[0];
  assert.ok(raising, "no realm raised a beast");
  const store = mixOf(w)!;
  assert.equal(store.kinds.length, 1);
  assert.equal(store.kinds[0]!.key, `raised:${raising.species}`);
  assert.equal(store.kinds[0]!.event, raising.event);
  assert.deepEqual(store.shares(raising.cell), [0, 1000]);
  const f = mixFactors(w, raising.cell)!;
  assert.ok(f.births > 0 && f.appetite > 0);
});

test("natives set down in a colony's land are a people of no tree its settlers are of; settlers bring what they had taken to", () => {
  const w = peopledWorld("first light", 30, { start: "spread" }),
    c = populationContext(w),
    gw = c.generated,
    land = c.provinces
      .all()
      .filter((p) => p.cell < gw.grid.count && p.total() > 500)
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!,
    before = land.total(),
    body = { ...gw.life.people!.body, clade: "far", name: "reed folk", size: 30, span: 40 },
    down = nativesDown(c, land, { ref: "folk:test", name: "the reed folk", body }, 400.7, 30, null);
  assert.equal(down, 400);
  assert.equal(land.total(), before + 400);
  const store = mixOf(w)!,
    shares = store.shares(land.cell);
  assert.equal(shares[0]! + shares[1]!, 1000);
  assert.ok(Math.abs(shares[1]! - (1000 * 400) / (before + 400)) <= 1);
  assert.deepEqual(kinshipOf(gw, store, 0, 1), { sameTree: false, generations: Infinity });
  w.runTo(w.now + 2 * YEAR);
  assert.deepEqual(
    store.crossings.map((x) => [x.a, x.b, x.fertility]),
    [[0, 1, 0]],
  );
  // What settlers bring: a cold land come to ten years since, half of whose cold its people could bear already.
  const cold = c.provinces
      .all()
      .filter((p) => gw.climate.temperature[p.cell]! < 5 && p.total() > 0)
      .sort((a, b) => a.cell - b.cell)[0]!,
    year = Math.floor(w.now / YEAR),
    generation = peopleKin(gw).generation,
    ask = Math.min(1, (10 - gw.climate.temperature[cold.cell]!) / 10);
  cold.settledYear = year - 10;
  const bare = takenIn(c, cold, year, generation).cold;
  assert.ok(bare > 0 && bare < 0.05, `${bare}`);
  carriedOf(w)!.set(cold.cell, [0.5 * ask, 0, 0]);
  const with_ = takenIn(c, cold, year, generation).cold;
  assert.ok(Math.abs(with_ - bare - 0.5) < 0.01, `${with_} ${bare}`);
  assert.ok(Math.abs(broughtIn(c, cold, year, generation).cold - 0.5) < 0.01);
  const again = new CarriedStore();
  again.load(JSON.parse(JSON.stringify(carriedOf(w)!.save())));
  assert.deepEqual(again.save(), carriedOf(w)!.save());
});
