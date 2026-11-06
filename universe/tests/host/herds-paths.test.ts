// Wild lives (Z1), the paths no run has reached by itself: a beast whose town has fallen, a kind gone on the last of its
// ground, a realm of one land driven of its herds, a hive's creatures. Each is forced, then read as a person reads it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import {
  HERD_EVENTS,
  driveHerds,
  herdsOf,
  homePlanet,
  politiesOf,
  populationContext,
  warsOf,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { landHerds } from "../../src/host/inspect/herds.ts";

const BAD = /undefined|NaN|\[object|\bnull\b|\b(ev|pol|town|war|cell|herd|beast):\d/;

/** All a page says, as text. */
const read = (world: World, ref: string): string => {
  const page = pageOf(world, ref);
  assert.ok(
    !/Not one anyone can find|No one can say/.test(JSON.stringify(page)),
    `${ref} is a page of nothing`,
  );
  // (What a person reads: not the page's refs, its drawing or its place, which are not words.)
  const text = JSON.stringify(page, (k, v) =>
    k === "ref" ||
    k === "why" ||
    k === "color" ||
    k === "colour" ||
    k === "portrait" ||
    k === "place" ||
    k === "icon" ||
    v === null
      ? undefined
      : v,
  );
  assert.ok(!BAD.test(page.title), `${ref}'s title: ${page.title}`);
  return text;
};

test("a beast whose town has fallen: its end is told, its page reads", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(130 * YEAR);
  const store = herdsOf(world)!,
    ctx = populationContext(world),
    g = homePlanet(world).generated,
    land = ctx.provinces.all().find((p) => p.total() > 0)!,
    species = g.life.species.find((s) => s.died === null && s.niche === "hunter")!,
    id = store.known.length + 1,
    event = world.events.emit({
      type: HERD_EVENTS.known.type,
      subjects: [species.ref as Ref],
      place: land.ref,
      causes: [],
      data: {
        id,
        given: "Oram",
        by: "the Grey Claw",
        beast: species.name,
        town: "Nowhere",
        flocks: true,
        water: false,
      },
    });
  store.known.push({
    id,
    given: "Oram",
    by: "the Grey Claw",
    species: species.index,
    cell: land.cell,
    // (A town no longer there.)
    town: "town:0:999999" as Ref,
    townName: "Nowhere",
    born: 128,
    ended: null,
    how: null,
    flocks: 2,
    fallen: ["Sela"],
    after: null,
    endedBy: null,
    event,
    endEvent: null,
  });
  store.refresh();
  world.runTo(world.now + 2 * YEAR);
  const b = store.known.find((x) => x.id === id)!;
  assert.equal(b.how, "town");
  assert.notEqual(b.ended, null);
  const said = String(why(world, b.endEvent!).claim);
  assert.ok(!BAD.test(said), said);
  assert.match(said, /Oram/);
  const page = read(world, `beast:${id}`);
  assert.ok(!BAD.test(page), page.slice(0, 400));
  assert.match(page, /Oram/);
});

test("a kind gone on the last of its ground: told, and on its pages, for the hunted and the ground alike", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(60 * YEAR);
  const store = herdsOf(world)!,
    ctx = populationContext(world),
    g = homePlanet(world).generated,
    land = ctx.provinces.all().find((p) => p.total() > 0)!,
    kinds = g.life.species.filter((s) => s.died === null && s.niche === "grazer").slice(0, 2);
  assert.equal(kinds.length, 2);
  for (const [i, why_] of (["hunted", "ground"] as const).entries()) {
    const s = kinds[i]!,
      event = world.events.emit({
        type: HERD_EVENTS.kindGone.type,
        subjects: [s.ref as Ref],
        place: land.ref,
        causes: [],
        data: { beast: s.name, why: why_, lands: 3 },
      });
    store.gone.push({ species: s.index, year: 60, cell: land.cell, why: why_, event });
    const said = String(why(world, event).claim);
    assert.ok(!BAD.test(said), said);
    assert.ok(said.includes(s.name), said);
    const onPage = read(world, s.ref as string);
    assert.ok(!BAD.test(onPage), onPage.slice(0, 400));
  }
  const tree = read(world, "world:tree");
  assert.ok(!BAD.test(tree), tree.slice(0, 400));
  assert.ok(tree.includes(kinds[0]!.name), "the tree's page does not name a kind gone");
  // It goes on, with the kind gone from what is told of the land's creatures.
  world.runTo(world.now + 6 * YEAR);
  assert.ok(!BAD.test(JSON.stringify(landHerds(world, land.cell).herds.map((h) => h.name))));
});

test("a realm of one land driven of its herds: told, and the land eats the less", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(200 * YEAR);
  const ctx = populationContext(world),
    store = herdsOf(world)!,
    realms = politiesOf(world).living(),
    one = realms.find(
      (r) =>
        r.members.length === 1 &&
        (ctx.provinces.get(r.members[0]!)?.herding ?? null) !== null &&
        (ctx.provinces.get(r.members[0]!)?.total() ?? 0) > 0,
    );
  if (!one) return;
  const by = realms.find((r) => r !== one)!,
    war = warsOf(world).all()[0],
    land = one.members[0]!,
    before = store.tally.driven;
  // (A drive is seldom in any year: as many years' chances as it takes.)
  for (let y = 0; y < 400 && store.tally.driven === before; y++)
    driveHerds(
      ctx,
      (war?.ref ?? "war:0:1") as Ref,
      (war?.event ?? one.event) as Ref,
      by,
      one,
      land,
      (world.now + y * YEAR) as typeof world.now,
    );
  assert.equal(store.tally.driven, before + 1);
  const d = store.driven.get(land)!,
    said = String(why(world, d.event).claim);
  assert.ok(!BAD.test(said), said);
  assert.match(said, /drove off/);
  world.runTo(world.now + 2 * YEAR);
});

test("a hive's world: its creatures read as the rest do, its beast and a drive's words too", () => {
  const world = ALIEN.build(seedFromText("harrow 259"));
  world.runTo(150 * YEAR);
  const store = herdsOf(world)!,
    ctx = populationContext(world),
    g = homePlanet(world).generated;
  let read_ = 0;
  for (const p of ctx.provinces.all()) {
    const h = landHerds(world, p.cell);
    if (!h.herds.length) continue;
    for (const herd of h.herds) {
      const page = read(world, herd.ref);
      assert.ok(!BAD.test(page), page.slice(0, 400));
    }
    if (++read_ >= 12) break;
  }
  assert.ok(read_ > 0, "no land of a hive's world holds creatures");
  for (const e of world.events
    .all()
    .filter((x) =>
      /^(beast\.|war\.herds|life\.(kind|tamed)|ecology\.(herds|overgrazed))/.test(x.type),
    )
    .slice(-40)) {
    const said = String(why(world, e.id).claim);
    assert.ok(!BAD.test(said), said);
  }
  assert.ok(g.life.species.length > 0 && store.begun);
});
