// Phase 65: what a world can do, read from the world. Reading never moves history; a world's raw record
// and the world itself read alike; a seed's reading allows what its world holds and no more; a catalogue
// names the rules it was run under, and holds up against them.
import { test } from "node:test";
import { keptLife } from "../../src/rules/kinds.ts";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { YEAR, rulesetId, seedFromText } from "../../src/kernel/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { generateHomeWorld, provinceWorld, type ProvinceWorld } from "../../src/gen/index.ts";
import { OPEN, readWorld } from "../../src/rules/index.ts";
import { loreOf, populationContext } from "../../src/sim/index.ts";
import {
  ageWorldOf,
  factsOfRaw,
  historyCheck,
  lacksNow,
  rawReading,
  readingMark,
  worldReadingOf,
} from "../../src/host/reading.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { stageOf } from "../../src/host/inspect/stage.ts";

const SMALL = "kestrel 557";

const seedOf = (t: string) => seedFromText(t);

test("reading a world, its stage and its pages, moves nothing of its history", () => {
  const read = ALIEN.build(seedOf(keptLife(SMALL))),
    left = ALIEN.build(seedOf(keptLife(SMALL)));
  for (const y of [20, 40, 60]) {
    read.runTo(y * YEAR);
    left.runTo(y * YEAR);
    worldReadingOf(read);
    stageOf(read);
    lacksNow(read);
    pageOf(read, "world:means");
    pageOf(read, "world:means#matter");
    for (const id of ["energy", "materials", "precision", "computing", "life", "reach"])
      pageOf(read, `means:${id}`);
    rawReading(read);
  }
  assert.deepEqual(read.domainHashes(), left.domainHashes());
});

test("a world's raw record reads as the world itself does", () => {
  const world = ALIEN.build(seedOf(keptLife(SMALL)));
  world.runTo(200 * YEAR);
  const g = populationContext(world).generated,
    lore = loreOf(world),
    { lands, facts } = factsOfRaw(
      rawReading(world),
      g as ProvinceWorld,
      (cell, id) => !!lore.get(cell, id),
    ),
    fromRecord = readWorld(lands, facts, ageWorldOf(g)),
    live = worldReadingOf(world).reading;
  assert.equal(fromRecord.age.id, live.age.id);
  assert.equal(fromRecord.name, live.name);
  assert.deepEqual(fromRecord.figures, live.figures);
  assert.deepEqual(
    fromRecord.measures.map((m) => m.words),
    live.measures.map((m) => m.words),
  );
});

test("a world's page of what it can do: why it stands here, what it lacks, each measure a page", () => {
  const world = ALIEN.build(seedOf(keptLife(SMALL)));
  world.runTo(200 * YEAR);
  const page = pageOf(world, "world:means"),
    tabs = page.tabs.map((t) => t.id);
  assert.deepEqual(tabs, ["why", "measures", "road", "matter", "works"]);
  assert.equal(page.stats.length, 6);
  const why = page.tabs[0]!.blocks,
    titles = why.map((b) => ("title" in b ? b.title : ""));
  assert.ok(
    titles.some((t) => t?.startsWith("What it lacks for")),
    `${titles}`,
  );
  const measure = pageOf(world, "means:energy"),
    w = worldReadingOf(world).reading;
  assert.ok(
    measure.stats.some((s) => s.value.join("") === w.measures[0]!.words),
    "the measure's page says what the reading does",
  );
  // What it would take is told with what it stands at.
  const lacks = lacksNow(world)!;
  assert.ok(lacks.lacks.length > 0);
});

test("the stage is the measured age, its firsts stay the chronicle's", () => {
  const world = ALIEN.build(seedOf(keptLife(SMALL)));
  world.runTo(200 * YEAR);
  const s = stageOf(world),
    { reading } = worldReadingOf(world);
  assert.equal(s.id, reading.age.id);
  assert.equal(s.name, reading.name);
  assert.ok(
    s.stages.some((x) => x.id === "stars"),
    "the stars are a stage",
  );
  assert.equal(s.stages.find((x) => x.id === "stars")!.first, "✨ A ship to the stars");
  assert.equal(s.stages.at(-1)!.first, "☀️ A star gathered");
  assert.equal(s.fell, undefined);
  // A people of the water's stages are its own.
  assert.equal(s.stages.find((x) => x.id === "iron")!.name, "Parted metals");
  assert.equal(s.stages.find((x) => x.id === "engines")!.name, "Tide mills");
});

test("a seed read: what it allows, with no history run", () => {
  const t0 = performance.now(),
    earth = EARTH.reading!(seedOf("first light")),
    ms = performance.now() - t0;
  assert.equal(earth.furthest, "gathered", JSON.stringify(earth.ages.filter((a) => !a.allowed)));
  assert.ok(earth.ages.every((a) => a.allowed && a.why));
  assert.ok(ms < 20000, `${ms} ms`);
  // An Earth-like world whose people's lands have no coal: its road stops at steam, and it says so.
  const noCoal = EARTH.reading!(seedOf("kestrel 154")),
    engines = noCoal.ages.find((a) => a.id === "engines")!;
  assert.equal(engines.allowed, false);
  assert.match(engines.why, /coal/);
  assert.equal(noCoal.furthest, "iron");
  // A people of the water has its own roads to the same ages, and its name for them.
  const water = ALIEN.reading!(seedOf(keptLife("alien 41")));
  assert.equal(water.medium, "water");
  assert.equal(water.ages.find((a) => a.id === "engines")!.name, "Tide mills");
  assert.equal(water.ages.find((a) => a.id === "engines")!.allowed, true);
  assert.equal(water.functions.find((f) => f.id === "switch-current")!.met, true);
});

test("a seed where nothing rises allows nothing, and says why", () => {
  // (The nearest seed with no people, looked for: about one in ten open seeds has none.)
  for (let i = 1; i < 60; i++) {
    const seed = seedOf(`gale ${i}`),
      g = generateHomeWorld(seed, OPEN, 8);
    if (g.life.people) continue;
    const r = ALIEN.reading!(seed);
    if (r.peopled) continue;
    assert.equal(r.furthest, null);
    assert.ok(r.ages.every((a) => !a.allowed && a.why));
    assert.equal(r.lands, 0);
    return;
  }
  assert.fail("no peopleless seed among those looked at");
});

test("the rules a universe runs by are told by a small world as by a full one", () => {
  for (const [u, seed] of [
    [EARTH, "first light"],
    [ALIEN, SMALL],
  ] as const) {
    const t0 = performance.now(),
      small = u.ruleset!(),
      ms = performance.now() - t0;
    assert.equal(small, rulesetId(u.build(seedOf(seed)), u.version));
    assert.ok(ms < 5000, `${ms} ms`);
  }
});

type Agreed = { allowed: number; reached: number; shutReached: number; shut: number };
type Catalogue = {
  rulesets: Record<string, string>;
  versions: Record<string, string>;
  lastYear: number;
  agreement: Record<string, Agreed>;
  agreementOf: Record<string, Record<string, Agreed>>;
  seeds: {
    universe: string;
    seed: string;
    check: string;
    marks: Record<string, string>;
    lands: number;
    ages: Record<string, { year: number; name: string }>;
    falls: unknown[];
  }[];
};

const FILE = new URL("../../public/catalogue.json", import.meta.url);

test("the catalogue: about 24 to 40 worlds, the same world made, no reading ever wrong about a shut age", () => {
  assert.ok(existsSync(FILE), "public/catalogue.json");
  const c = JSON.parse(readFileSync(FILE, "utf8")) as Catalogue;
  assert.ok(c.seeds.length >= 24 && c.seeds.length <= 40, `${c.seeds.length} worlds`);
  assert.ok(c.seeds.some((s) => s.universe === "earth"));
  assert.ok(c.seeds.some((s) => s.universe === "alien"));
  for (const s of c.seeds) {
    assert.ok(s.check, `${s.seed} has its check`);
    assert.deepEqual(Object.keys(s.marks), ["500", "1500", "3000"], `${s.seed} has its marks`);
    assert.ok(s.lands > 0, s.seed);
    assert.ok(s.ages.villages!.year >= 0, `${s.seed} came to villages`);
  }
  // (What the title tells of each universe adds up to what was run.)
  for (const [id, a] of Object.entries(c.agreement))
    assert.equal(
      c.agreementOf.earth![id]!.allowed + c.agreementOf.alien![id]!.allowed,
      a.allowed,
      `${id}: each universe's own count`,
    );
  for (const [id, a] of Object.entries(c.agreement))
    assert.equal(a.shutReached, 0, `${id}: a reading shut what a run reached`);
});

test("the catalogue's worlds are still the worlds this history makes", () => {
  const c = JSON.parse(readFileSync(FILE, "utf8")) as Catalogue;
  // (Each small enough to run to year 20 in a moment. Under other rules it is passed over: nothing to hold it to.)
  for (const u of [EARTH, ALIEN]) {
    if (c.rulesets[u.name] !== u.ruleset!()) continue;
    const small = c.seeds
        .filter((s) => s.universe === u.name)
        .sort((a, b) => a.lands - b.lands)[0]!,
      world = u.build(seedOf(small.seed));
    world.runTo(20 * YEAR);
    assert.equal(
      historyCheck(world.domainHashes()),
      small.check,
      `${small.seed} at year 20: history moved under the same rules, without its version moving`,
    );
  }
});

test("the catalogue's smallest world keeps to its record, to its last year", () => {
  const c = JSON.parse(readFileSync(FILE, "utf8")) as Catalogue;
  if (c.rulesets[ALIEN.name] !== ALIEN.ruleset!()) return;
  const small = c.seeds
      .filter((s) => s.universe === ALIEN.name)
      .sort((a, b) => a.lands - b.lands)[0]!,
    world = ALIEN.build(seedOf(small.seed));
  for (const [year, mark] of Object.entries(small.marks)) {
    world.runTo(Number(year) * YEAR);
    assert.equal(
      readingMark(rawReading(world)),
      mark,
      `${small.seed} at year ${year}: history moved, and the catalogue's years no longer hold. Run tools/catalogue-run.ts again.`,
    );
  }
});

test("a province world and its reading agree on what a land is", () => {
  const g = provinceWorld(generateHomeWorld(seedOf(SMALL), OPEN));
  assert.equal(ageWorldOf(g).medium, ageWorldOf(g.fine).medium);
  assert.equal(ageWorldOf(g).kind, ageWorldOf(g.fine).kind);
});
