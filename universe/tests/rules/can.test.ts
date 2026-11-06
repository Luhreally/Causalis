// F5 (docs/architecture/first-principles-plan.md): the tree of what can be done. Whether a step is open and why it is
// shut are one reading, so they cannot disagree; a why is a fact about the world it is said of; and the reading of
// whether a body can come to a principle is the one history's own yes or no is taken from.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAN_FUNCTIONS,
  PRINCIPLES,
  SOLAR,
  affordsPrinciple,
  asLandsStand,
  bodyStop,
  causeOf,
  causesOf,
  meansOf,
  meansWorldOf,
  oddNumbers,
  openSteps,
  ownRoadOf,
  readCan,
  readFunctions,
  stopWords,
  whyShut,
  type CanWorld,
  type LandStop,
  type MeansWorld,
} from "../../src/rules/index.ts";

/** A made-up world: its kind and numbers, its lands stopping what `land` says. */
function worldOf(
  kind: "rocky" | "methane",
  o: {
    celsius?: number;
    gravity?: number;
    medium?: MeansWorld["medium"];
    bodyFire?: boolean;
    grips?: boolean;
    peopled?: boolean;
    land?: (id: string) => LandStop | null;
  } = {},
): CanWorld {
  const numbers = meansWorldOf({
      chem: SOLAR,
      kind,
      celsius: o.celsius ?? 15,
      gravity: o.gravity ?? 1,
      medium: o.medium ?? "land",
      bodyFire: o.bodyFire ?? true,
      insolation: 1,
      grips: o.grips ?? true,
    }),
    functions = readFunctions({
      chem: SOLAR,
      kind,
      celsius: o.celsius ?? 15,
      gravity: o.gravity ?? 1,
      rockBodies: 8,
      giants: 4,
      starLeftGyr: 5,
      peopled: true,
      means: numbers,
    });
  return {
    numbers,
    means: meansOf(numbers),
    chem: SOLAR,
    functions,
    medium: o.medium ?? "land",
    fire: numbers.freeOxygen && (o.bodyFire ?? true),
    lanes: true,
    peopled: o.peopled ?? true,
    sows: true,
    orbitKms: 9.4 * Math.sqrt(o.gravity ?? 1),
    land: (p) => o.land?.(p.id) ?? null,
    copper: () => null,
  };
}

const WORLDS: readonly (readonly [string, CanWorld])[] = [
  ["Earth", worldOf("rocky")],
  ["a heavy world", worldOf("rocky", { gravity: 2.3 })],
  ["a light world", worldOf("rocky", { gravity: 0.4 })],
  ["a people of the water", worldOf("rocky", { medium: "water", bodyFire: false })],
  ["a people who keep no fire", worldOf("rocky", { bodyFire: false })],
  ["a people who cannot grip", worldOf("rocky", { grips: false })],
  ["a methane world", worldOf("methane", { celsius: -178, gravity: 1.2 })],
  ["a people of the shore", worldOf("rocky", { medium: "shore" })],
  [
    "a land with no coal",
    worldOf("rocky", {
      land: (id) => (id === "coal-mining" ? { on: "ore", ore: "coal", lies: false } : null),
    }),
  ],
];

test("a step is open or says why: never both, never neither", () => {
  for (const [name, w] of WORLDS) {
    const open = openSteps(w);
    for (const p of PRINCIPLES) {
      const why = whyShut(p.id, w, open);
      assert.equal(why === null, open.has(p.id), `${name}: ${p.id}`);
      if (why) assert.ok(stopWords(why, w).length > 8, `${name}: ${p.id} says nothing`);
    }
  }
});

test("whether a body can come to a principle is its stop's yes or no", () => {
  for (const p of PRINCIPLES)
    for (const medium of ["land", "shore", "water"] as const)
      for (const reach of [true, false, 400, 1000, 3000] as const)
        assert.equal(
          affordsPrinciple(p, medium, reach),
          bodyStop(p, medium, reach) === null,
          `${p.id} ${medium} ${reach}`,
        );
});

test("what history knows stands open whatever the reading says", () => {
  const w = worldOf("methane", { celsius: -178 }),
    shut = openSteps(w);
  assert.ok(!shut.has("steam-engine"));
  assert.ok(openSteps(w, ["steam-engine"]).has("steam-engine"));
});

test("no people: nothing open, and it says so", () => {
  const w = worldOf("rocky", { peopled: false }),
    open = openSteps(w);
  assert.equal(open.size, 0);
  assert.equal(stopWords(whyShut("iron", w, open)!, w), "No people stand on this world to do it.");
  assert.ok(readCan(w, open, () => false).every((f) => f.words === "No one here to do it."));
});

test("where nothing burns the why is its air, and what burns stays shut", () => {
  const w = worldOf("methane", { celsius: -178 }),
    open = openSteps(w),
    why = whyShut("steam-engine", w, open)!;
  assert.equal(causeOf(why, w), "burns");
  assert.match(stopWords(why, w), /no free oxygen/);
  assert.ok(causesOf(w, open).some((c) => c.key === "burns" && c.steps.includes("engines")));
  const heat = readCan(w, open, () => false).find((f) => f.id === "heat")!;
  assert.ok(heat.rungs.some((r) => r.name === "burning a fuel" && r.state === "shut"));
  assert.ok(ownRoadOf(open).includes("joined-hearth"));
});

test("Earth has nothing odd, and no road of its own", () => {
  const w = worldOf("rocky"),
    open = openSteps(w);
  assert.equal(causesOf(w, open).length, 0);
  assert.deepEqual(ownRoadOf(open), []);
  assert.deepEqual(oddNumbers(w), []);
});

test("a heavy world's pull is told with what it means, at its own figure", () => {
  const heavy = worldOf("rocky", { gravity: 2.3 }),
    pull = oddNumbers(heavy).find((n) => n.key === "pull")!;
  assert.match(pull.words, /2\.3 g/);
  assert.match(pull.words, /230%/);
  assert.equal(
    oddNumbers(worldOf("rocky", { gravity: 1.1 })).filter((n) => n.key === "pull").length,
    0,
  );
});

test("a people of the water: land's rows come down to one fact", () => {
  const w = worldOf("rocky", { medium: "water", bodyFire: false }),
    open = openSteps(w),
    causes = causesOf(w, open);
  assert.equal(causes[0]!.key, "sea");
  assert.ok(causes[0]!.steps.length > 10);
  const far = readCan(w, open, () => false).find((f) => f.id === "far")!;
  assert.ok(far.rungs.every((r) => !/muskets?|rifle/.test(r.name)));
  assert.match(far.top?.name ?? "", /sound|dart/i);
});

test("what a land lacks is told as its lands stand, what a world lacks as never", () => {
  const w = worldOf("rocky", {
      land: (id) => (id === "coal-mining" ? { on: "ore", ore: "coal", lies: false } : null),
    }),
    open = openSteps(w),
    why = whyShut("steam-engine", w, open)!;
  assert.equal(causeOf(why, w), "ore:coal");
  assert.ok(asLandsStand("ore:coal"));
  assert.ok(!asLandsStand("burns"));
  assert.match(stopWords(why, w), /No coal lies within reach/);
});

test("a step known is told as had, its next as wanting what comes first", () => {
  const w = worldOf("rocky"),
    open = openSteps(w),
    known = new Set(["cultivation", "metalworking", "bronze", "calendar"]),
    read = readCan(w, open, (id) => known.has(id)),
    edge = read.find((f) => f.id === "edge")!;
  assert.equal(edge.now?.by, "bronze");
  assert.equal(edge.next?.by, "iron");
  assert.deepEqual(edge.next?.missing, ["iron"]);
  assert.match(edge.words, /^Bronze: 70% of steel's edge/);
  const heat = read.find((f) => f.id === "heat")!;
  assert.match(heat.words, /^Gets to 1,200 °C/);
});

test("the seven asked for stand first, and no line says how a charge is made", () => {
  assert.deepEqual(
    CAN_FUNCTIONS.filter((f) => f.main).map((f) => f.id),
    ["edge", "heat", "charge", "far", "engine", "flight", "word"],
  );
  for (const [name, w] of WORLDS) {
    const said = JSON.stringify(readCan(w, openSteps(w), () => true));
    assert.ok(!/saltpetre|charcoal|nitric|steeped/.test(said), name);
  }
});
