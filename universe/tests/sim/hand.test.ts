import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type World,
} from "../../src/kernel/index.ts";
import {
  BLESSING,
  COLS,
  LOCAL_ACT_EVENTS,
  PERSON_TRAITS,
  PIOUS_BLESSING,
  ROWS,
  handOf,
  makePopulationWorld,
  populationContext,
  traitWeight,
  workWeights,
  type Agent,
} from "../../src/sim/index.ts";
import { FEMALE, OCC } from "../../src/rules/index.ts";
import { cradleCell } from "../cradle.ts";

const seed = seedFromText("first light"),
  HOME = cradleCell("first light");
const build = () => makePopulationWorld(seed);

function firstVillage(world: World) {
  return populationContext(world).settlements.inProvince(HOME)[0]!;
}

const domain = (w: World, name: string) => w.domainHashes().find(([d]) => d === name)?.[1];

test("laying and lifting the hand with no time between leaves every aggregate exactly as it was", () => {
  const quiet = build(),
    touched = build();
  quiet.runTo(245 * YEAR);
  touched.runTo(245 * YEAR);
  const v = firstVillage(touched);
  touched.submit("hand.lay", { village: v.ref });
  touched.runTo(245 * YEAR + 1);
  const w = handOf(touched).resting!;
  assert.equal(w.agents.length, v.population, "everyone in the village, one by one");
  touched.submit("hand.lift", {});
  touched.runTo(245 * YEAR + 2);
  quiet.runTo(245 * YEAR + 2);
  assert.equal(handOf(touched).resting, null);
  for (const d of ["population", "economy", "planet"])
    assert.equal(domain(touched, d), domain(quiet, d), `${d} is as it was`);
});

test("while the hand rests, its people are born and die one by one, inside the counts", () => {
  const world = build();
  world.runTo(240 * YEAR);
  const v = firstVillage(world);
  world.submit("hand.lay", { village: v.ref });
  world.runTo(240 * YEAR + 1);
  const ctx = populationContext(world),
    hand = handOf(world);
  let born = 0,
    died = 0;
  for (let year = 241; year <= 270; year++) {
    const before = new Set(hand.resting!.agents.map((a) => a.id));
    world.runTo(year * YEAR);
    const now = hand.resting!.agents;
    born += now.filter((a) => !before.has(a.id)).length;
    died += [...before].filter((id) => !now.some((a) => a.id === id)).length;
    // The window's people are always among the counted.
    const within = hand.composition(HOME, year, ctx.life)!,
      p = ctx.provinces.get(HOME)!;
    for (let r = 0; r < ROWS; r++)
      for (let o = 0; o < COLS; o++)
        assert.ok(within[r * COLS + o]! <= p.counts.get(r, o), `year ${year} row ${r} work ${o}`);
    assert.equal(
      ctx.settlements.get(v.ref)!.population,
      now.length,
      "the village holds exactly its people",
    );
  }
  assert.ok(born > 10 && died > 10, `${born} born and ${died} died under the hand`);
  assert.ok(
    hand.resting!.agents.some((a) => a.occupation !== 0 && world.now / YEAR - a.birthYear < 30),
    "children grew up and took up work",
  );
});

test("one hand at a time; lifting needs a hand to lift", () => {
  const world = build();
  world.runTo(240 * YEAR);
  assert.throws(() => world.submit("hand.lift", {}), /rests on no village/);
  const [a, b] = populationContext(world).settlements.inProvince(HOME);
  world.submit("hand.lay", { village: a!.ref });
  world.runTo(240 * YEAR + 1);
  assert.throws(() => world.submit("hand.lay", { village: b!.ref }), /already rests/);
});

test("a world with a hand laid and lifted replays, and its save continues, bit for bit", () => {
  const world = build();
  world.runTo(238 * YEAR);
  world.submit("hand.lay", { village: firstVillage(world).ref });
  world.runTo(250 * YEAR);
  world.submit("hand.lift", {});
  world.runTo(252 * YEAR);
  world.submit("hand.lay", { village: firstVillage(world).ref });
  world.runTo(255 * YEAR);
  const ruleset = rulesetId(world, "test"),
    doc = saveWorld(world, ruleset);
  assert.deepEqual(verifyByReplay(doc, build), { ok: true, problem: null });
  const loaded = loadWorld(doc, build, ruleset).world;
  world.runTo(262 * YEAR);
  loaded.runTo(262 * YEAR);
  assert.deepEqual(
    loaded.checkpoints().map((c) => c.chain),
    world.checkpoints().map((c) => c.chain),
  );
});

test("under the hand, families: couples paired, children with their mothers and fathers, traits in the blood", () => {
  const world = build();
  world.runTo(240 * YEAR);
  world.submit("hand.lay", { village: firstVillage(world).ref });
  world.runTo(240 * YEAR + 1);
  const w = handOf(world).resting!,
    byId = new Map(w.agents.map((a) => [a.id, a])),
    grown = (a: Agent) => 240 - a.birthYear >= populationContext(world).life.adulthood;
  // Couples: each the other's partner, a woman and a man near in age.
  const paired = w.agents.filter((a) => a.partner !== undefined);
  assert.ok(paired.length >= 10, `${paired.length} paired`);
  for (const a of paired) {
    const b = byId.get(a.partner!)!;
    assert.equal(b.partner, a.id, "partners each other's");
    assert.notEqual(a.sex, b.sex);
    assert.ok(Math.abs(a.birthYear - b.birthYear) <= 12);
  }
  // Children, each with a mother who bore them young enough, and her husband.
  const children = w.agents.filter((a) => !grown(a));
  assert.ok(children.filter((c) => c.mother !== undefined).length >= children.length * 0.6);
  for (const c of children.filter((x) => x.mother !== undefined)) {
    const m = byId.get(c.mother!)!;
    assert.equal(m.sex, FEMALE);
    assert.ok(c.birthYear - m.birthYear >= 16 && c.birthYear - m.birthYear <= 44);
    if (c.father !== undefined) assert.equal(m.partner, c.father);
  }
  // Traits: some have some; none both hardy and frail.
  const traited = w.agents.filter((a) => a.traits?.length);
  assert.ok(traited.length > w.agents.length * 0.3, `${traited.length} of ${w.agents.length}`);
  assert.ok(!w.agents.some((a) => a.traits?.includes("hardy") && a.traits.includes("frail")));
  // Twenty years on: children born to known mothers and fathers, the dead remembered.
  world.runTo(260 * YEAR);
  const now = handOf(world).resting!,
    born = now.agents.filter((a) => a.birthYear > 240);
  assert.ok(born.length > 5, `${born.length} born`);
  const all = new Map([...(now.gone ?? []), ...now.agents].map((a) => [a.id, a]));
  for (const c of born) {
    assert.ok(c.mother !== undefined && all.get(c.mother)?.sex === FEMALE, "a mother");
    if (c.father !== undefined) assert.notEqual(all.get(c.father)?.sex, FEMALE, "a father");
    assert.ok(Array.isArray(c.traits));
  }
  assert.ok((now.gone ?? []).length > 5, "the dead remembered");
});

test("what a person is like weighs on their life, and the god may give it or take it", () => {
  const base = { id: 1, sex: 0, birthYear: 200, occupation: 1 } as Agent;
  assert.equal(traitWeight({ ...base, traits: ["hardy"] }, "death"), 0.75);
  assert.equal(traitWeight({ ...base, traits: ["frail"] }, "death"), 1.35);
  assert.equal(traitWeight({ ...base, traits: ["fertile"] }, "birth"), 1.4);
  assert.equal(traitWeight({ ...base, traits: ["clever"] }, "death"), 1);
  const world = build();
  world.runTo(240 * YEAR);
  world.submit("hand.lay", { village: firstVillage(world).ref });
  world.runTo(240 * YEAR + 1);
  const w = handOf(world).resting!,
    who = w.agents.find((a) => !a.traits?.includes("hardy") && !a.traits?.includes("frail"))!;
  const act = world.submit("act.trait", { agent: who.id, trait: "hardy", on: true });
  world.runTo(240 * YEAR + 2);
  assert.ok(who.traits!.includes("hardy"), "made hardy");
  const e = world.events.all().find((x) => x.type === LOCAL_ACT_EVENTS.traitOne.type)!;
  assert.equal(e.causes[0]!.ref, act.id);
  assert.throws(
    () => world.submit("act.trait", { agent: who.id, trait: "hardy", on: true }),
    /already/,
  );
  assert.throws(
    () => world.submit("act.trait", { agent: who.id, trait: "frail", on: true }),
    /hardy cannot be made frail/,
  );
  world.submit("act.trait", { agent: who.id, trait: "hardy", on: false });
  world.runTo(240 * YEAR + 3);
  assert.ok(!who.traits!.includes("hardy"), "no longer");
  assert.throws(
    () => world.submit("act.trait", { agent: who.id, trait: "tall", on: true }),
    /a trait is wanted/,
  );
  assert.equal(PERSON_TRAITS.length, 10);
});

test("what a person is like draws them to their work, keeps their young, holds the god's blessing", () => {
  const base = { id: 1, sex: FEMALE, birthYear: 200, occupation: OCC.dependent } as Agent,
    targets = [0, 10, 40, 10, 20, 15, 5];
  assert.deepEqual(workWeights(targets, base), targets, "none: their society's needs alone");
  assert.equal(workWeights(targets, { ...base, traits: ["clever"] })[OCC.crafter], 60);
  assert.equal(workWeights(targets, { ...base, traits: ["greedy"] })[OCC.trader], 45);
  assert.equal(workWeights(targets, { ...base, traits: ["wise"] })[OCC.leader], 15);
  const brave = workWeights(targets, { ...base, traits: ["brave"] });
  assert.deepEqual([brave[OCC.forager], brave[OCC.herder], brave[OCC.farmer]], [20, 20, 40]);
  // (No herders where none herd: what they are like cannot make work there is none of.)
  assert.equal(
    workWeights([0, 10, 40, 0, 20, 15, 5], { ...base, traits: ["brave"] })[OCC.herder],
    0,
  );
  assert.equal(traitWeight({ ...base, traits: ["kind"] }, "care"), 0.85);
  assert.equal(traitWeight({ ...base, traits: ["kind"] }, "death"), 1, "their own life as any");
  // The pious are blessed the longer.
  const world = build();
  world.runTo(240 * YEAR);
  world.submit("hand.lay", { village: firstVillage(world).ref });
  world.runTo(240 * YEAR + 1);
  const w = handOf(world).resting!,
    who = w.agents.find((a) => !a.traits?.includes("pious"))!,
    other = w.agents.find((a) => a !== who && !a.traits?.includes("pious"))!;
  world.submit("act.trait", { agent: who.id, trait: "pious", on: true });
  world.runTo(240 * YEAR + 2);
  world.submit("act.bless-one", { agent: who.id });
  world.runTo(240 * YEAR + 3);
  world.submit("act.bless-one", { agent: other.id });
  world.runTo(240 * YEAR + 4);
  assert.equal(who.blessedUntil, 240 + BLESSING * PIOUS_BLESSING);
  assert.equal(other.blessedUntil, 240 + BLESSING);
});
