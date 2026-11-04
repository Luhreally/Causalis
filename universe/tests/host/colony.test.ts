import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  yearOfMoment,
  type World,
} from "../../src/kernel/index.ts";
import { G, principle } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { townPlan } from "../../src/host/town.ts";
import {
  colonyGrowth,
  colonyList,
  colonyLook,
  colonyMoments,
  colonyTownCell,
  colonyTownRef,
  colonyVoyage,
} from "../../src/host/colony.ts";
import {
  COLS,
  ROWS,
  handOf,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  siteGround,
  siteRegion,
  spaceOf,
  townsOf,
} from "../../src/sim/index.ts";

const ROAD = [
  "mathematics",
  "astronomy",
  "medicine",
  "steel",
  "engines",
  "electricity",
  "electronics",
  "rocketry",
  "guidance",
  "orbital-flight",
  "life-support",
  "stations",
  "transfer-flight",
  "habitats",
];

/** Earth grown a while, its largest realm taught the road to the other worlds, a colony founded and grown on a few years. */
function withColony(read: boolean): { world: World; cell: number; year: number } {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(80 * YEAR);
  const realm = [...politiesOf(world).living()].sort(
    (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
  )[0]!;
  for (const id of ROAD)
    loreOf(world).learn(realm.seat, id, { year: 80, event: realm.event }, principle(id));
  marketsOf(world).of(realm.seat).move("made", G.machines, 60_000_000);
  spaceOf(world).program(realm.ref).station = realm.event;
  let y = 80;
  while (!spaceOf(world).of(realm.ref)!.colonies.length && y < 200) world.runTo(++y * YEAR);
  const cell = spaceOf(world).of(realm.ref)!.colonies[0]!.cell;
  // (Its town read along the way, or never: it must make no difference.)
  for (let i = 0; i < 12; i++) {
    world.runTo(++y * YEAR);
    if (read) {
      colonyList(world);
      colonyLook(world, cell);
      townPlan(world, colonyTownRef(cell), 0);
      populationContext(world).settlements.seenIn(cell);
    }
  }
  return { world, cell, year: y };
}

test("a colony's town is read from history and put nothing into it", () => {
  const { world, cell, year } = withColony(true),
    twin = withColony(false).world,
    ctx = populationContext(world),
    ref = colonyTownRef(cell);
  assert.equal(colonyTownCell(ref), cell);
  assert.equal(colonyTownCell("town:0:7"), null, "a town of the home world's is no colony's");

  // Read at every turn of its years, the world is the very world that never read it.
  assert.deepEqual(world.domainHashes(), twin.domainHashes());
  assert.equal(
    JSON.stringify(saveWorld(world, "r", { universe: "earth" })),
    JSON.stringify(saveWorld(twin, "r", { universe: "earth" })),
    "and its save the very same",
  );

  // History's own lists never hold it; only the view's reads do.
  assert.ok(![...ctx.settlements.all()].some((t) => t.ref === ref), "not among the world's towns");
  assert.deepEqual(ctx.settlements.inProvince(cell), [], "none on its land that history knows of");
  assert.equal(ctx.settlements.seenIn(cell)[0]?.ref, ref, "yet the view reads it there");
  assert.equal(ctx.settlements.get(ref)?.cell, cell);
  assert.ok(townsOf(world).get(ref)!.next > 0, "its lots laid out");
  assert.ok(![...townsOf(world).all()].some((f) => f.town === ref), "in no fabric of history's");

  // Its ground and sky, from its own world's numbers; how they came there.
  const look = colonyLook(world, cell)!,
    voyage = colonyVoyage(world, cell)!,
    list = colonyList(world);
  assert.ok(look.body.length > 0 && look.bodyRef.length > 0);
  assert.ok(look.gravity > 0 && look.star.light > 0 && look.day > 0);
  assert.ok(look.founded >= 80 && look.founded < year);
  assert.ok(look.keeps.length > 0, "what its halls keep against");
  assert.equal(voyage.kind, "system");
  assert.ok(voyage.days > 0 && voyage.speed! > 0);
  const entry = list.find((c) => c.cell === cell)!;
  assert.equal(entry.town, ref);
  assert.ok(entry.name!.length > 0 && look.hall >= 0);
  assert.equal(entry.sky, look.over?.degrees ?? 0);
  assert.equal(entry.founded, look.founded);

  // Its land's ground: its own world's, never the home world's.
  const ground = siteGround(world, cell)!,
    region = siteRegion(world, cell)!;
  assert.equal(ground.body.designation, look.body);
  assert.equal(region.center, cell);
  assert.ok(region.elevation.length === region.size * region.size);

  // Its plan: sealed, on its own rock.
  const plan = townPlan(world, ref, 0)!;
  assert.ok(plan.sealed, "drawn sealed");
  assert.ok(plan.lots > 0);

  // A land of the home world has none of this.
  assert.equal(colonyLook(world, 0), null);
  assert.equal(colonyVoyage(world, 0), null);

  // What would not stay done is not done: acts on a town history keeps, refused on one it only reads.
  for (const act of ["act.fire", "act.shrine", "act.spring"])
    assert.throws(() => world.submit(act, { village: ref }), /sealed halls/, act);

  // Its people gone: its land's list and its town still read, with no one in them.
  const land = ctx.provinces.get(cell)!;
  for (let r = 0; r < ROWS; r++)
    for (let o = 0; o < COLS; o++) land.counts.add(r, o, -land.counts.get(r, o));
  assert.equal(land.total(), 0);
  assert.equal(colonyList(world).find((c) => c.cell === cell)?.people, 0);
  assert.ok(townPlan(world, ref, 0), "its empty town still drawn");
});

test("a colony's town as it stood grows with its years, read again without touching what stands", () => {
  const { world, cell, year } = withColony(false),
    before = world.domainHashes(),
    founded = colonyLook(world, cell)!.founded,
    last = yearOfMoment(world.now),
    years = [founded, Math.floor((founded + year) / 2), last],
    frames = colonyGrowth(world, cell, years, (ref, fabric) =>
      townPlan(world, ref, 0, Infinity, null, fabric),
    );
  assert.equal(frames.length, 3);
  assert.deepEqual(
    frames.map((f) => f.year),
    years,
  );
  assert.ok(frames[0]!.people > 0, "its first settlers");
  assert.ok(frames[2]!.homes >= frames[0]!.homes, "no smaller for its years");
  // Its last year is the town as it stands.
  const now = townPlan(world, colonyTownRef(cell), 0)!;
  assert.deepEqual(frames[2]!.town.runs, now.runs);
  assert.deepEqual(frames[2]!.town.civics, now.civics);
  assert.deepEqual(world.domainHashes(), before, "the world as it was");

  // The years it is best drawn at: from its first to now, no more than asked, in order.
  const moments = colonyMoments(world, cell, 6);
  assert.equal(moments[0], founded);
  assert.equal(moments.at(-1), last);
  assert.ok(moments.length >= 2 && moments.length <= 7, `moments ${moments.join()}`);
  for (let i = 1; i < moments.length; i++) assert.ok(moments[i]! > moments[i - 1]!);
  assert.deepEqual(colonyMoments(world, 0, 6), [], "no moments of a home land");
});

test("the god's hand on a colony's town: the same whether it was read before, and its save continues bit for bit", () => {
  const { world, cell, year } = withColony(false),
    read = withColony(true).world,
    ref = colonyTownRef(cell);
  for (const w of [world, read]) w.runTo(w.submit("hand.lay", { village: ref }).t);
  const hand = handOf(world).resting!;
  assert.equal(hand.village, ref);
  assert.ok(hand.agents.length > 0, "its people, met");
  assert.deepEqual(read.domainHashes(), world.domainHashes());
  world.runTo((year + 2) * YEAR);
  const ruleset = rulesetId(world, "test"),
    doc = saveWorld(world, ruleset, { universe: "earth" }),
    loaded = loadWorld(doc, (s) => EARTH.build(s), ruleset).world;
  // (Its town read afresh from the save: the same town, and the hand still on it.)
  assert.equal(
    populationContext(loaded).settlements.get(ref)?.name,
    populationContext(world).settlements.get(ref)?.name,
  );
  assert.equal(handOf(loaded).resting?.village, ref);
  world.runTo((year + 6) * YEAR);
  loaded.runTo((year + 6) * YEAR);
  assert.deepEqual(
    loaded.checkpoints().map((c) => c.chain),
    world.checkpoints().map((c) => c.chain),
  );
  assert.deepEqual(loaded.domainHashes(), world.domainHashes());
  for (const w of [world, loaded]) w.runTo(w.submit("hand.lift", {}).t);
  assert.equal(handOf(world).resting, null);
  assert.deepEqual(loaded.domainHashes(), world.domainHashes());
});
