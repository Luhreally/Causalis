// Phase 65: what a people can do, measured, and the age it makes. An age is the highest whose asks all
// stand met now, named after a world's own means, and it falls when what it stood on goes.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AGE_LADDER,
  LEAST_SHARE,
  MEASURE_IDS,
  MEASURES,
  PRINCIPLES,
  SOLAR,
  affordsPrinciple,
  energyOf,
  fitOf,
  lacksForNext,
  lifeOf,
  measureSteps,
  nextOnRoad,
  readWorld,
  ruleKm,
  stuffOf,
  sumsOf,
  type AgeWorld,
  type LandFacts,
  type WorldFacts,
} from "../../src/rules/index.ts";

const EARTH: AgeWorld = { chem: SOLAR, kind: "rocky", medium: "land", fire: true, radius: 1 };
const OCEAN: AgeWorld = { ...EARTH, medium: "water", fire: false };

function land(known: readonly string[], more: Partial<LandFacts> = {}): LandFacts {
  const set = new Set(known);
  return {
    cell: 1,
    people: 1_000_000,
    farmers: 500_000,
    herders: 10_000,
    sown: known.includes("cultivation"),
    driven: 0,
    machines: 0,
    knows: (id) => set.has(id),
    ...more,
  };
}

const WORLD: WorldFacts = {
  realms: 5,
  biggestRealm: 9,
  towns: 40,
  biggestTown: 5000,
  sat: 0,
  crew: 0,
  station: 0,
  colonyKm: 0,
  starLy: 0,
  arrived: false,
};

/** Everything a people of the land knows on the way to steam. */
const TO_IRON = ["cultivation", "metalworking", "writing", "bronze", "iron"];
const TO_STEEL = [...TO_IRON, "steel", "clockwork", "mills"];
const TO_STEAM = [...TO_STEEL, "coal-mining", "steam-engine", "factories"];
const TO_WIRE = [...TO_STEAM, "electricity"];
const TO_ORBIT = [...TO_WIRE, "electronics", "guidance", "rocketry", "orbital-flight"];

test("each measure has its name and its why, and each of its steps a figure", () => {
  for (const id of MEASURE_IDS) {
    const m = MEASURES[id];
    assert.ok(m.name && m.what && m.read && m.icon, id);
    const steps = measureSteps(id, () => false, EARTH);
    assert.ok(steps.length >= 4, `${id} has its steps`);
    for (const s of steps) assert.ok(s.words && s.figure, `${id}: ${s.words}`);
  }
});

test("the ladder rises: nothing, then each age as its asks are met", () => {
  const read = (l: LandFacts, w: Partial<WorldFacts> = {}) =>
    readWorld([l], { ...WORLD, ...w }, EARTH);
  const bands = readWorld(
    [land([], { farmers: 0, herders: 0 })],
    { ...WORLD, realms: 0, biggestRealm: 0, towns: 0, biggestTown: 0 },
    EARTH,
  );
  assert.equal(bands.age.id, "bands");
  assert.equal(
    read(land(["cultivation"]), { biggestRealm: 0, biggestTown: 500 }).age.id,
    "villages",
  );
  assert.equal(read(land(["cultivation"]), { biggestRealm: 3, biggestTown: 500 }).age.id, "realms");
  assert.equal(read(land(["cultivation"])).age.id, "cities");
  assert.equal(read(land(["cultivation", "writing"])).age.id, "writing");
  assert.equal(read(land(TO_IRON)).age.id, "iron");
  // Knowing steam is not having it: it is what the works drive.
  assert.equal(read(land(TO_STEAM, { driven: 0 })).age.id, "iron");
  const engines = read(land(TO_STEAM, { driven: 100_000 }));
  assert.equal(engines.age.id, "engines");
  assert.equal(engines.name, "Coal and steam");
  assert.equal(read(land(TO_WIRE, { driven: 400_000 })).age.id, "electricity");
  const orbit = read(land(TO_ORBIT, { driven: 2_000_000, machines: 500_000 }), { sat: 2 });
  assert.equal(orbit.age.id, "orbit");
  const worlds = read(
    land([...TO_ORBIT, "life-support", "habitats"], { driven: 2_000_000, machines: 500_000 }),
    { sat: 2, colonyKm: 8e7 },
  );
  assert.equal(worlds.age.id, "worlds");
  const stars = read(
    land([...TO_ORBIT, "life-support", "habitats", "fusion-drive"], {
      driven: 2_000_000,
      machines: 500_000,
    }),
    { sat: 2, colonyKm: 8e7, starLy: 4.2 },
  );
  assert.equal(stars.age.id, "stars");
  assert.match(stars.measures.find((m) => m.id === "reach")!.words, /4\.2 light-years/);
});

test("it falls: fuel gone, power falls; machines gone, reckoning falls; flights and halls gone, reach falls", () => {
  const known = [...TO_ORBIT, "life-support", "habitats"],
    high = readWorld(
      [land(known, { driven: 2_000_000, machines: 500_000 })],
      { ...WORLD, sat: 2, colonyKm: 8e7 },
      EARTH,
    );
  assert.equal(high.age.id, "worlds");
  // The halls empty: what they asked no longer stands.
  const noHalls = readWorld(
    [land(known, { driven: 2_000_000, machines: 500_000 })],
    { ...WORLD, sat: 2 },
    EARTH,
  );
  assert.equal(noHalls.age.id, "orbit");
  // The last realm that flew is gone.
  const noFlights = readWorld(
    [land(known, { driven: 2_000_000, machines: 500_000 })],
    WORLD,
    EARTH,
  );
  assert.equal(noFlights.age.id, "electricity");
  // The fuel is gone: no knowledge brings the power back.
  const noFuel = readWorld([land(known, { driven: 0, machines: 500_000 })], WORLD, EARTH);
  assert.equal(noFuel.age.id, "iron");
  assert.equal(noFuel.name, "Steel");
  assert.ok(noFuel.figures.energy < 0.4);
  // Machines gone: past valves, the sums fall with them.
  const many = sumsOf(land(known, { machines: 1_000_000 })).sums,
    none = sumsOf(land(known, { machines: 0 })).sums;
  assert.ok(many >= none * 10, `${many} against ${none}`);
});

test("a land of a few who hold what the world has lost does not carry the world's reading", () => {
  const many = land(TO_IRON, { cell: 2, people: 10_000_000 }),
    relic = land(TO_WIRE, {
      cell: 3,
      people: Math.floor(10_000_000 * LEAST_SHARE) - 1,
      driven: 1000,
    });
  assert.equal(readWorld([many, relic], WORLD, EARTH).age.id, "iron");
  const counts = land(TO_WIRE, {
    cell: 3,
    people: Math.ceil(10_000_000 * LEAST_SHARE) + 100,
    driven: 10_000,
  });
  assert.equal(readWorld([many, counts], WORLD, EARTH).age.id, "electricity");
});

test("each world names an age for its own means", () => {
  const water = readWorld(
    [
      land(["cultivation", "writing", "vent-working", "electrochemistry", "current-mills"], {
        driven: 100_000,
      }),
    ],
    WORLD,
    OCEAN,
  );
  assert.equal(water.age.id, "engines");
  assert.equal(water.name, "Tide mills");
  const parted = readWorld(
    [land(["cultivation", "writing", "vent-working", "electrochemistry"])],
    WORLD,
    OCEAN,
  );
  assert.equal(parted.age.id, "iron");
  assert.equal(parted.name, "Parted metals");
  const ice = { ...EARTH, kind: "ammonia", fire: false } as AgeWorld;
  const iceAge = readWorld(
    [land(["cultivation", "writing", "ice-working", "heat-engines"], { driven: 100_000 })],
    WORLD,
    ice,
  );
  assert.equal(iceAge.name, "The ground's heat");
  const worked = readWorld([land(["cultivation", "writing", "ice-working"])], WORLD, ice);
  assert.equal(worked.name, "Worked ice");
  const carbon = { ...EARTH, kind: "carbon", fire: false } as AgeWorld;
  const hammered = readWorld([land(["cultivation", "writing", "cold-hammering"])], WORLD, carbon);
  assert.equal(hammered.name, "Diamond and copper");
  // Steel on the land's road.
  assert.equal(readWorld([land(TO_STEEL)], WORLD, EARTH).name, "Steel");
});

test("what a world lacks for the next age: what's asked, what it has, what it could set about", () => {
  const known = TO_STEEL,
    knows = (id: string) => known.includes(id),
    r = readWorld([land(known)], WORLD, EARTH),
    got = lacksForNext(r, knows, EARTH)!;
  assert.equal(got.age.id, "engines");
  assert.equal(got.lacks.length, 1);
  assert.equal(got.lacks[0]!.road, "steam-engine");
  assert.equal(got.lacks[0]!.known, false);
  assert.match(got.lacks[0]!.has, /kW/);
  assert.ok(got.lacks[0]!.next.includes("coal-mining"), `${got.lacks[0]!.next}`);
  // A world that knows the way is told so, not sent to find it again.
  const steam = lacksForNext(
    readWorld([land(TO_STEAM)], WORLD, EARTH),
    (id) => TO_STEAM.includes(id),
    EARTH,
  )!;
  assert.equal(steam.lacks[0]!.known, true);
  // Past its stars it is told what comes next.
  const stars = readWorld(
    [
      land([...TO_ORBIT, "life-support", "habitats", "fusion-drive"], {
        driven: 2_000_000,
        machines: 500_000,
      }),
    ],
    { ...WORLD, sat: 2, colonyKm: 8e7, starLy: 4.2 },
    EARTH,
  );
  // (Past the stars lie the ages past ours: the next is a flame held, and what stands between.)
  assert.equal(lacksForNext(stars, () => true, EARTH)?.age.id, "fusion");
});

test("each road an age asks for is a principle, and a people of any kind has a road up to orbit", () => {
  const ids = new Set(PRINCIPLES.map((p) => p.id));
  for (const a of AGE_LADDER)
    for (const ask of a.asks)
      for (const id of ask.road ?? [])
        if (id !== "cultivation") assert.ok(ids.has(id), `${a.id} asks for ${id}`);
  for (const [kind, medium, fire] of [
    ["rocky", "land", true],
    ["rocky", "water", false],
    ["carbon", "land", false],
    ["ammonia", "land", false],
    ["methane", "land", false],
  ] as const) {
    const w: AgeWorld = { ...EARTH, kind, medium, fire };
    for (const id of ["engines", "electricity"]) {
      const ask = AGE_LADDER.find((a) => a.id === id)!.asks.flatMap((a) => a.road ?? []);
      assert.ok(
        ask.some((p) =>
          affordsPrinciple(
            PRINCIPLES.find((x) => x.id === p)!,
            medium,
            fire,
            kind,
          ),
        ),
        `${kind} ${medium}: a road to ${id}`,
      );
    }
    assert.deepEqual(
      nextOnRoad("orbital-flight", () => true, w),
      [],
    );
  }
});

test("each measure's own figure, from what a land knows", () => {
  assert.equal(energyOf(land([])), 0.1);
  assert.ok(Math.abs(energyOf(land(["draught", "mills"])) - 0.2) < 1e-9);
  assert.ok(energyOf(land(["steam-engine"], { driven: 250_000 })) >= 1);
  assert.equal(stuffOf(land([]), SOLAR).name, "knapped stone");
  assert.equal(stuffOf(land(["steel"]), SOLAR).name, "steel");
  assert.equal(stuffOf(land(["iron"]), SOLAR).strength, 370);
  assert.equal(fitOf(land([])).mm, 1);
  assert.equal(fitOf(land(["guidance"])).mm, 0.002);
  assert.equal(lifeOf(land([], { sown: false })).level, 0);
  assert.equal(lifeOf(land(["cultivation"])).level, 1);
  assert.equal(lifeOf(land(["long-sleep"])).level, 6);
  assert.equal(ruleKm(0, 1), 0);
  assert.ok(ruleKm(16, 1) > ruleKm(4, 1));
});
