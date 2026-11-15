// 2026-11-14: what the god's hand lays can last a thousand years ("be able to last for way longer like up to 1000
// years"), read no slower in its last year than its first and kept through a save; and a world warmed or cooled, for
// years or for good, turns its ground by the rule that named its biomes, opening land to live on and closing it ("heat
// or cool the world ... make more habitable land sometimes"). Each on first light at 220, forked from one build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, loadWorld, saveWorld, seedFromText, type World } from "../../src/kernel/index.ts";
import { planetRef } from "../../src/gen/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  ACT_REACH,
  ActStore,
  EVER,
  FORTUNE_YEARS,
  GOD_AMOUNTS,
  GROUND,
  SPAN_MOST,
  SPAN_STOPS,
  WARM_DEGREES,
  actsOf,
  biomeUnder,
  capacity,
  divineWarming,
  fortunesOf,
  greatActsOf,
  groundWarming,
  homePlanet,
  livable,
  livableFor,
  politiesOf,
  populationContext,
  provinceCapacity,
  warmDegrees,
  type Act,
  type Polity,
} from "../../src/sim/index.ts";
import type { Ref } from "../../src/kernel/index.ts";
import {
  FOR_GOOD,
  PALETTE_FORCE,
  PALETTE_WARM,
  SPAN_STOPS as PALETTE_SPANS,
} from "../../src/ui/palette.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { warmthMap, warmthRead } from "../../src/host/inspect/warmth.ts";
import { warmedFrame } from "../../src/view/index.ts";

const AT = 220;
const fork = (() => {
  let doc: ReturnType<typeof saveWorld> | null = null;
  return (): World => {
    if (!doc) {
      const w = EARTH.build(seedFromText("first light"));
      w.runTo(AT * YEAR);
      doc = saveWorld(w, "r");
    }
    return loadWorld(doc, (s) => EARTH.build(s), "r").world;
  };
})();
const again = (w: World): World =>
  loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "r"))) as ReturnType<typeof saveWorld>,
    (s) => EARTH.build(s),
    "r",
  ).world;
const biggest = (world: World): Polity =>
  [...politiesOf(world).living()].sort(
    (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
  )[0]!;
const PLANET = planetRef(0);

test("the palette's spans and degrees are the world's, and every span goes to a thousand years", () => {
  assert.deepEqual([...PALETTE_SPANS], [...SPAN_STOPS]);
  assert.equal(SPAN_STOPS.at(-1), SPAN_MOST);
  assert.equal(SPAN_MOST, 1000);
  assert.equal(FORTUNE_YEARS, 1000);
  // (One, five and ten are each a stop of their own.)
  for (const y of [1, 5, 10, 100, 1000]) assert.ok((SPAN_STOPS as readonly number[]).includes(y));
  assert.deepEqual(PALETTE_WARM, WARM_DEGREES);
  assert.equal(PALETTE_FORCE.rot, ACT_REACH.rot);
  assert.equal(PALETTE_FORCE.wells, ACT_REACH.wells);
  assert.equal(PALETTE_FORCE.wellYears, ACT_REACH.wellYears);
  assert.equal(FOR_GOOD, 0);
  assert.equal(warmDegrees(undefined), 1.5);
  assert.equal(warmDegrees(1), 1.5);
  assert.equal(warmDegrees(3), 12);
  assert.equal(GOD_AMOUNTS.peace.stops.at(-1), 1000);
  assert.equal(GOD_AMOUNTS.swear.stops.at(-1), 1000);
  const w = fork(),
    r = biggest(w),
    land = r.seat,
    star = homePlanet(w).generated.star.ref;
  for (const [type, args] of [
    ["act.rain", { cell: land, sign: -1 }],
    ["act.harvest", { cell: land, sign: 1 }],
    ["act.plague", { cell: land, sign: 1 }],
    ["act.bless", { realm: r.ref, strength: 0.5 }],
    ["act.curse", { realm: r.ref, strength: 0.5 }],
    ["act.warm", { sign: 1 }],
    ["act.flare", { star, sign: 1 }],
  ] as const) {
    assert.throws(() => w.submit(type, { ...args, years: 1001 }), /year/, `${type} for 1001 years`);
    assert.throws(() => w.submit(type, { ...args, years: 0 }), /year/, `${type} for no years`);
    assert.doesNotThrow(() => w.submit(type, { ...args, years: 1000 }), `${type} for 1000 years`);
  }
  assert.throws(() => w.submit("act.warm", { sign: 1, ever: true, years: 5 }), /for good/);
  assert.throws(() => w.submit("act.warm", { sign: 1, ever: 1 }), /ever/);
  w.runTo(w.now + 2);
  // (Nothing clamps: each holds until the day a thousand years on.)
  const from = AT * YEAR;
  for (const kind of ["rain", "harvest", "plague"] as const) {
    const a = actsOf(w).at(land, kind, w.now)!;
    assert.equal(a.until - a.from, 1000 * YEAR, kind);
    assert.ok(actsOf(w).at(land, kind, from + 999 * YEAR), `${kind} in its last year`);
    assert.equal(actsOf(w).at(land, kind, from + 1001 * YEAR), null);
  }
  for (const f of fortunesOf(w)!.over(r.ref)) {
    assert.equal(f.years, 1000);
    assert.equal(f.until - f.from, 1000 * YEAR);
  }
  assert.equal(fortunesOf(w)!.over(r.ref).length, 2);
  const warm = greatActsOf(w)!.at("warm", PLANET, w.now)!,
    flare = greatActsOf(w)!.at("flare", star as Ref, w.now)!;
  assert.equal(warm.until - warm.from, 1000 * YEAR);
  assert.equal(flare.until - flare.from, 1000 * YEAR);
  assert.ok(Number.isSafeInteger(warm.until) && Number.isSafeInteger(warm.from + EVER));
});

test("a word laid again each year is one act, a year longer: a land's acts do not pile up", () => {
  const store = new ActStore(),
    act = (over: Partial<Act>): Act => ({
      command: "cmd:0:1" as Ref,
      event: "evt:0:1" as Ref,
      kind: "harvest",
      cell: 7,
      sign: -1,
      from: 0,
      until: YEAR,
      ...over,
    });
  store.add(act({}));
  for (let y = 1; y < 1000; y++)
    store.add(act({ event: `evt:0:${y + 1}` as Ref, from: y * YEAR, until: (y + 1) * YEAR }));
  assert.equal(store.all().length, 1);
  assert.equal(store.all()[0]!.until, 1000 * YEAR);
  assert.equal(store.all()[0]!.event, "evt:0:1");
  assert.ok(store.at(7, "harvest", 999 * YEAR));
  assert.equal(store.at(7, "harvest", 1000 * YEAR), null);
  // (Another's word, a gap, or another strength is its own act; ended acts are let go of where acts are read.)
  store.add(act({ command: "cmd:0:2" as Ref, from: 1000 * YEAR, until: 1001 * YEAR }));
  store.add(act({ command: "cmd:0:2" as Ref, from: 1003 * YEAR, until: 1004 * YEAR }));
  store.add(act({ command: "cmd:0:2" as Ref, from: 1004 * YEAR, until: 1005 * YEAR, strength: 3 }));
  assert.equal(store.all().length, 4);
  assert.equal(store.at(7, "harvest", 1004.5 * YEAR)!.strength, 3);
  assert.equal(store.latest(7, "harvest", 2000 * YEAR)!.strength, 3);
  assert.equal(store.latest(7, "rain", 2000 * YEAR), null);
  // (Kept and read back as it was.)
  const back = new ActStore();
  back.load(JSON.parse(JSON.stringify(store.save())));
  assert.deepEqual(back.all(), store.all());
  assert.equal(back.at(7, "harvest", 1004.5 * YEAR)!.strength, 3);
});

test("a curse laid for a thousand years holds year on year, through a save, and its numbers stay numbers", () => {
  const w = fork(),
    r = biggest(w),
    start = w.now,
    lands = r.members.length;
  w.submit("act.curse", { realm: r.ref, strength: 3, years: 1000 });
  w.submit("act.rain", { cell: r.seat, sign: 1, years: 1000, strength: 3 });
  w.runTo(start + 6 * YEAR + 2);
  const f = fortunesOf(w)!.over(r.ref)[0];
  if (politiesOf(w).get(r.ref)!.ended === null) {
    assert.ok(f, "the curse lifted early");
    assert.equal(f.laid, 7);
    assert.equal(f.until - f.from, 1000 * YEAR);
  } else assert.equal(f, undefined, "a fallen realm's curse lifts with it");
  // (Seven years of blight and sickness on its lands: one act a land and kind, not seven.)
  const laid = actsOf(w)
    .all()
    .filter((a) => a.from >= start && (a.kind === "harvest" || a.kind === "plague"));
  assert.ok(laid.length > 0);
  assert.ok(laid.length <= lands * 4 + 4, `${laid.length} acts kept for ${lands} lands`);
  const c = populationContext(w);
  for (const p of c.provinces.all()) {
    assert.ok(Number.isFinite(p.total()) && p.total() >= 0);
    assert.ok(Number.isFinite(p.rain) && p.rain >= 0 && p.rain < 10_000, `rain ${p.rain}`);
    assert.ok(p.fed >= 0 && p.fed <= 1000);
  }
  // (Saved mid-spell and read back, it goes on the same.)
  const back = again(w);
  assert.deepEqual(back.domainHashes(), w.domainHashes());
  w.runTo(start + 8 * YEAR + 2);
  back.runTo(start + 8 * YEAR + 2);
  assert.deepEqual(back.domainHashes(), w.domainHashes());
  assert.ok(
    actsOf(back).at(r.seat, "rain", back.now),
    "the rain sent for a thousand years stopped",
  );
});

test("a world no god warms is as it was made; warmed or cooled, its biomes turn by the rule that named them", () => {
  const w = fork(),
    c = populationContext(w),
    g = homePlanet(w).generated,
    n = g.offworld.base;
  assert.equal(groundWarming(w, PLANET), 0);
  assert.equal(divineWarming(w, PLANET), 0);
  assert.deepEqual(warmthMap(w), { warm: 0 });
  assert.equal(warmthRead(w), null);
  let ice = 0;
  for (let i = 0; i < g.fine.grid.count; i++) {
    assert.equal(biomeUnder(g.fine, i, 0), g.fine.climate.biome[i]);
    if (g.fine.climate.biome[i] === 4) ice++;
  }
  assert.ok(ice > 0, "first light has no ice to thaw");
  const count = (warm: number) => {
    let lands = 0,
      farm = 0;
    for (let i = 0; i < n; i++) {
      if (livable(g, i, c.medium, warm)) lands++;
      farm += capacity(g, i, c.medium, warm).farm;
    }
    return { lands, farm };
  };
  const made = count(0),
    warmer = count(12),
    colder = count(-12);
  console.log(
    `first light as made: ${made.lands} lands livable; 12 degrees warmer ${warmer.lands}; 12 colder ${colder.lands}`,
  );
  assert.ok(warmer.lands > made.lands, "warming opened no land");
  assert.ok(colder.lands < made.lands, "cooling closed no land");
  assert.ok(colder.lands > 0 && Number.isFinite(warmer.farm) && Number.isFinite(colder.farm));
  // (A little moves a little: no step across the whole world.)
  assert.ok(Math.abs(count(0.25).lands - made.lands) <= 5);
});

test("warmed for good, the ground follows over a generation: land opens, the page and the globe say so, a save keeps it", () => {
  const w = fork(),
    start = w.now,
    c = populationContext(w),
    g = homePlanet(w).generated,
    n = g.offworld.base,
    livableNow = () => {
      let k = 0;
      for (let i = 0; i < n; i++) if (livableFor(c, i)) k++;
      return k;
    },
    made = livableNow();
  w.submit("act.warm", { sign: 1, ever: true, strength: 3 });
  w.runTo(start + 2);
  assert.equal(divineWarming(w, PLANET), 12);
  assert.equal(groundWarming(w, PLANET), 0, "the ground turned the day the air did");
  assert.equal(livableNow(), made);
  w.runTo(start + (GROUND.years / 2) * YEAR);
  const half = groundWarming(w, PLANET);
  assert.ok(half >= 5.5 && half <= 6.25, `half way: ${half}`);
  w.runTo(start + (GROUND.years + 1) * YEAR);
  assert.equal(groundWarming(w, PLANET), 12);
  const now = livableNow(),
    read = warmthRead(w)!;
  console.log(
    `first light warmed 12 degrees for good, ${GROUND.years + 1} years on: livable lands ${made} -> ${now} (${read.opened} opened, ${read.closed} closed), could feed ${read.feeds.made} -> ${read.feeds.now}`,
  );
  assert.ok(now > made, `${now} livable lands where ${made} were`);
  assert.deepEqual(read.livable, { made, now });
  assert.equal(read.opened - read.closed, now - made);
  assert.equal(read.until, null);
  assert.equal(read.ground, 12);
  // (A land's yield is the warmed ground's.)
  const land = c.provinces.all().find((p) => p.total() > 0)!.cell;
  assert.deepEqual(provinceCapacity(c, land), capacity(g, land, c.medium, 12));
  assert.deepEqual(provinceCapacity(c, land, 0), capacity(g, land, c.medium));
  // (The home world's page and the act's say what changed; the globe is handed the spots that turned.)
  const said = (ref: string) => JSON.stringify(pageOf(w, ref));
  assert.match(said(g.planet.ref), /Warmed by the god's hand/);
  assert.match(said(g.planet.ref), /Lands that can be lived on/);
  assert.match(said(greatActsOf(w)!.all()[0]!.event), /It does not lift/);
  const map = warmthMap(w);
  assert.equal(map.warm, 12);
  assert.ok(map.turned!.length > 0 && map.turned!.length % 2 === 0);
  assert.deepEqual(warmthMap(w, 12), { warm: 12 });
  const frame = {
      arrays: {
        biome: Uint8Array.from(g.fine.climate.biome),
        temperature: Float32Array.from(g.fine.climate.temperature),
      },
    } as unknown as Parameters<typeof warmedFrame>[0],
    drawn = warmedFrame(frame, map.warm, map.turned!);
  assert.equal(warmedFrame(frame, 0, []), frame);
  assert.equal((drawn.arrays.biome as Uint8Array)[map.turned![0]!], map.turned![1]);
  assert.ok(
    Math.abs(
      (drawn.arrays.temperature as Float32Array)[0]! - (g.fine.climate.temperature[0]! + 12),
    ) < 1e-3,
  );
  assert.equal(
    (frame.arrays.biome as Uint8Array)[map.turned![0]!],
    g.fine.climate.biome[map.turned![0]!],
  );
  // (For good is kept through a save, and goes on the same.)
  const back = again(w);
  assert.deepEqual(back.domainHashes(), w.domainHashes());
  assert.equal(groundWarming(back, PLANET), 12);
  w.runTo(w.now + 2 * YEAR);
  back.runTo(back.now + 2 * YEAR);
  assert.deepEqual(back.domainHashes(), w.domainHashes());
  assert.equal(groundWarming(w, PLANET), 12);
});

test("cooled for ten years, land closes; when it lifts the ground eases back to what it was", () => {
  const w = fork(),
    start = w.now,
    c = populationContext(w),
    n = homePlanet(w).generated.offworld.base,
    livableNow = () => {
      let k = 0;
      for (let i = 0; i < n; i++) if (livableFor(c, i)) k++;
      return k;
    },
    made = livableNow();
  w.submit("act.warm", { sign: -1, years: 10, strength: 3 });
  w.runTo(start + 10 * YEAR - 2);
  const cold = groundWarming(w, PLANET),
    least = livableNow(),
    read = warmthRead(w)!;
  console.log(
    `first light cooled 12 degrees for ten years: ground ${cold} at its end, livable lands ${made} -> ${least}`,
  );
  assert.ok(cold <= -3.5 && cold >= -4, `the ground came to ${cold}`);
  assert.ok(least < made, "cooling closed no land");
  assert.equal(read.until, AT + 10);
  assert.equal(read.lifted, false);
  w.runTo(start + 15 * YEAR);
  assert.equal(divineWarming(w, PLANET), 0);
  const easing = groundWarming(w, PLANET);
  assert.ok(easing < 0 && easing > cold, `easing back: ${easing}`);
  assert.equal(warmthRead(w)!.lifted, true);
  w.runTo(start + (10 + GROUND.years + 1) * YEAR);
  assert.equal(groundWarming(w, PLANET), 0);
  assert.equal(livableNow(), made);
  assert.equal(warmthRead(w), null);
});
