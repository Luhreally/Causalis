// Lives L6: what a home holds, read off what its people need, what their land allows and what they can pay for.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coinOf,
  furnish,
  isRound,
  LEVEL_ROOMS,
  NEEDS,
  POOREST,
  RUIN_THINGS,
  roomsOf,
  roomUses,
  SHAPE_SIZE,
  usualPrice,
  WAR_THING,
  wayCoin,
  WORK_THINGS,
  type DwellingFacts,
} from "../../src/rules/dwelling.ts";

const knowing =
  (...ids: string[]) =>
  (id: string): boolean =>
    ids.includes(id);

const facts = (over: Partial<DwellingFacts> = {}): DwellingFacts => ({
  key: 7,
  level: 1,
  form: "house",
  walls: "wood",
  people: 4,
  medium: "land",
  grips: true,
  scale: 1,
  burns: true,
  heat: null,
  warmth: 15,
  knows: knowing(),
  coin: POOREST,
  price: usualPrice,
  wood: true,
  cloth: true,
  vessel: "clay",
  metal: "stone",
  work: [],
  fought: false,
  court: false,
  noHouses: false,
  ruin: 0,
  ...over,
});

const LATE = knowing(
  "carpentry",
  "masonry",
  "coal-mining",
  "steam-engine",
  "electricity",
  "electronics",
  "oil-drilling",
  "sanitation",
  "dyeing",
  "writing",
  "glass",
  "clockwork",
);
const ways = (f: DwellingFacts) => new Set(furnish(f).things.map((t) => t.way));
const needs = (f: DwellingFacts) => new Set(furnish(f).things.map((t) => t.need));

test("the same facts make the same home, thing for thing", () => {
  const f = facts({ coin: 9000, level: 2, knows: LATE, metal: "iron", people: 6 });
  assert.deepEqual(furnish(f), furnish({ ...f }));
});

test("every way, trade's thing and ruin's thing has a size to be drawn at", () => {
  const all = [
    ...NEEDS.flatMap((n) => n.ways),
    ...Object.values(WORK_THINGS),
    WAR_THING,
    ...RUIN_THINGS,
  ];
  for (const w of all) assert.ok(SHAPE_SIZE[w.shape], `${w.id} has no size`);
  const ids = NEEDS.flatMap((n) => n.ways.map((w) => w.id));
  assert.equal(new Set(ids).size, ids.length, "two ways share a name");
});

test("every way can be taken by someone: none is written off", () => {
  const worlds: DwellingFacts[] = [
    facts({ coin: 1e7, level: 2, knows: LATE, metal: "iron" }),
    facts({ coin: 1e7, level: 2, knows: knowing("carpentry", "masonry"), metal: "iron" }),
    facts({ coin: 1e7, level: 2, metal: "bronze" }),
    facts({ coin: 1e7, wood: false }),
    facts({ coin: 1e7, wood: false, cloth: false, vessel: null, metal: "stone" }),
    facts({ coin: 1e7, grips: false }),
    facts({ burns: false, heat: "the land's own", coin: 1e7, wood: false, cloth: false }),
    facts({
      medium: "water",
      coin: 1e7,
      burns: false,
      wood: false,
      cloth: false,
      knows: knowing("vent-working"),
    }),
  ];
  for (const n of NEEDS)
    for (const w of n.ways)
      assert.ok(
        worlds.some((f) => w.asks(f)),
        `no world allows ${w.id}`,
      );
});

test("the poorest still sleep, cook and eat, on what can be made at home", () => {
  const f = facts({ coin: POOREST }),
    home = furnish(f);
  assert.equal(home.rooms.length, 1);
  assert.equal(home.rooms[0]!.use, "all");
  assert.equal(home.things.filter((t) => t.need === "sleep").length, f.people);
  const got = needs(f);
  for (const need of ["sleep", "cook", "pot"]) assert.ok(got.has(need), `no way to ${need}`);
});

test("they never spend past what they have on what they keep", () => {
  for (const coin of [0, 30, POOREST, 300, 1200, 6000, 40000, 300000]) {
    const f = facts({ coin, level: 2, knows: LATE, metal: "iron", people: 5 }),
      home = furnish(f);
    assert.ok(home.spent <= Math.max(coin, 0) + 1e-9, `spent ${home.spent} of ${coin}`);
  }
});

test("more coin, more of a home: it never takes a room or a need away", () => {
  let rooms = 0,
    held = 0;
  for (const coin of [POOREST, 300, 1200, 6000, 40000, 300000, 3000000]) {
    const f = facts({ coin, level: 2, knows: LATE, metal: "iron" }),
      home = furnish(f),
      got = needs(f).size;
    assert.ok(home.rooms.length >= rooms, `${coin}: fewer rooms`);
    assert.ok(got >= held, `${coin}: fewer needs met`);
    rooms = home.rooms.length;
    held = got;
  }
  assert.ok(rooms >= 4, "a great fortune still lives in a small home");
  assert.ok(held >= 12, `a great fortune meets ${held} needs`);
});

test("the level of a home holds what a family can pay for to what it gives", () => {
  for (let level = 0; level < LEVEL_ROOMS.length; level++) {
    const most = LEVEL_ROOMS[level]!.rooms,
      f = { level, coin: 1e12, court: false, form: "house", noHouses: false };
    assert.equal(roomsOf(f), most);
    assert.equal(roomsOf({ ...f, court: true }), most + 2);
    assert.equal(roomsOf({ ...f, coin: 0 }), 1);
    assert.equal(roomsOf({ ...f, noHouses: true }), 1);
  }
});

test("a way is taken only where the world allows it, however much they have", () => {
  const rich = { coin: 1e7, level: 2 };
  // No wood: nothing joined.
  const bare = ways(facts({ ...rich, wood: false, knows: LATE, metal: "iron" }));
  for (const w of ["plank-bed", "joined-bed", "table-chairs", "table-bench", "chest", "dresser"])
    assert.ok(!bare.has(w), `${w} with no wood`);
  // Nothing burns: no lamp or hearth by fire; the land's own heat where it has one.
  const noFire = ways(facts({ ...rich, burns: false, heat: "the land's own" }));
  for (const w of ["stone-hearth", "brick-hearth", "iron-stove", "oil-lamp"])
    assert.ok(!noFire.has(w), `${w} where nothing burns`);
  assert.ok(noFire.has("heat-stone"));
  // Nothing known: no book, no clock, no glass, no screen, for any money.
  const unlettered = ways(facts({ ...rich, metal: "iron" }));
  for (const w of ["books", "clock", "mirror", "screen", "bulb"])
    assert.ok(!unlettered.has(w), `${w} with no one knowing how`);
});

test("a water people keeps a home of its own: no bed, no hearth by fire, no table", () => {
  const f = facts({
      medium: "water",
      burns: false,
      wood: false,
      cloth: false,
      vessel: null,
      coin: 1e7,
      form: "shell-tower",
      knows: knowing("vent-working"),
    }),
    got = furnish(f);
  assert.ok(isRound(f));
  assert.ok(got.rooms.every((r) => r.round));
  assert.equal(got.walls.length, 0, "round chambers have no straight walls");
  const shapes = new Set(got.things.map((t) => t.shape));
  for (const s of ["bed", "table", "stove", "lamp", "rug"] as const)
    assert.ok(!shapes.has(s), `${s} under water`);
  const w = new Set(got.things.map((t) => t.way));
  assert.ok(w.has("kelp-hammock"), "they sleep in nothing");
  assert.ok(w.has("vent-stone"), "they keep no heat");
  assert.ok(w.has("cache"), "they keep nothing");
});

test("no grip, no joinery: a body that cannot hold a tool does not sit to a table", () => {
  const got = ways(facts({ grips: false, coin: 1e7, knows: LATE, metal: "iron" }));
  for (const w of ["plank-bed", "joined-bed", "table-chairs", "stone-hearth", "metal-pot"])
    assert.ok(!got.has(w), `${w} with no grip`);
  // (They still eat cooked, press a switch, turn a tap with what they have, and keep what they own.)
  assert.ok(got.has("current-stove"), "no stove can be worked with no grip");
  assert.ok(got.has("tap"), "no tap can be worked with no grip");
  assert.ok(got.has("niche"), "no grip, nowhere to keep things");
  const early = ways(facts({ grips: false, coin: 1e7 }));
  assert.ok(early.has("fire-pit"), "no grip, no fire");
});

test("what a thing costs follows its market: a dear good is gone without", () => {
  const f = facts({ coin: 4000, knows: knowing("carpentry"), metal: "iron", level: 2 }),
    cheap = ways(f),
    dear = ways({ ...f, price: (g) => usualPrice(g) * 40 });
  assert.ok(cheap.has("joined-bed"), "a family with coin sleeps on the floor");
  assert.ok(!dear.has("joined-bed"), "the market's price moved nothing");
  const plank = NEEDS.find((n) => n.id === "sleep")!.ways.find((w) => w.id === "plank-bed")!;
  assert.equal(
    wayCoin(plank, (g) => usualPrice(g) * 2),
    2 * wayCoin(plank, usualPrice),
  );
});

test("their work and their wars come home with them", () => {
  const got = furnish(
    facts({ coin: 1e6, level: 2, work: ["weaver", "weaver", "smith"], fought: true }),
  );
  assert.equal(got.things.filter((t) => t.way === "loom").length, 1, "one loom for two weavers");
  assert.ok(got.things.some((t) => t.way === "tongs"));
  assert.ok(got.things.some((t) => t.need === "war"));
  const none = ways(facts({ coin: 1e6, level: 2, work: ["ghost-trade"], fought: false }));
  assert.ok(!none.has("arm"));
});

test("a kelp bed is not hoed: a water people's work comes home as theirs", () => {
  const got = ways(
    facts({ medium: "water", burns: false, wood: false, work: ["farmer"], coin: 1e6 }),
  );
  assert.ok(got.has("kelp-knife"));
  assert.ok(!got.has("hoe"));
  const works = ways(
    facts({ medium: "water", burns: false, wood: false, work: ["crafter", "weaver"], coin: 1e6 }),
  );
  assert.ok(works.has("work-slab") && works.has("kelp-frame"));
});

test("a home of a people who keep no houses is one room for all who sleep there", () => {
  const home = furnish(facts({ noHouses: true, people: 0, coin: 1e7, level: 2 }));
  assert.equal(home.rooms.length, 1);
  assert.ok(home.things.filter((t) => t.need === "sleep").length >= 6, "a hall for no one");
  // (All of them, and what they keep besides: not a wall of beds with nowhere to put a thing.)
  const rich = furnish(
    facts({ noHouses: true, people: 6, coin: 1e7, level: 2, knows: LATE, metal: "iron" }),
  );
  for (const way of ["tap", "dresser", "clock", "mirror", "strongbox", "screen"])
    assert.ok(
      rich.things.some((t) => t.way === way),
      `no room in a hall for ${way}`,
    );
});

test("a ruin holds what is left, and nothing was spent on it", () => {
  const fell = furnish(facts({ ruin: 1, coin: 1e6 })),
    razed = furnish(facts({ ruin: 2, coin: 1e6 }));
  assert.equal(fell.spent, 0);
  assert.equal(fell.rooms.length, 1);
  assert.ok(fell.things.every((t) => t.need === "ruin"));
  assert.ok(fell.things.some((t) => t.way === "shards"));
  assert.ok(!razed.things.some((t) => t.way === "shards"), "a pot came through the fire");
});

test("everything stands in the home's own bounds, on a wall of its room or in its middle", () => {
  const cases = [
    facts({ coin: POOREST }),
    facts({ coin: 3000, level: 1, knows: knowing("carpentry"), metal: "iron" }),
    facts({ coin: 1e7, level: 2, knows: LATE, metal: "iron", people: 8 }),
    facts({ coin: 1e7, level: 6, knows: LATE, metal: "iron", people: 5, court: true }),
    facts({ coin: 1e7, form: "hive", burns: false, heat: "the land's own", people: 9 }),
  ];
  for (const f of cases) {
    const h = furnish(f);
    for (const t of h.things) {
      assert.ok(Number.isFinite(t.x) && Number.isFinite(t.z), `${t.way} is nowhere`);
      assert.ok(
        Math.abs(t.x) <= h.halfW + 0.01 && Math.abs(t.z) <= h.halfD + 0.01,
        `${t.way} at ${t.x},${t.z} outside ${h.halfW},${h.halfD}`,
      );
      assert.ok(t.room >= 0 && t.room < h.rooms.length);
    }
    h.things.forEach((t, i) => assert.equal(t.n, i, "a thing's page is its number"));
  }
});

test("each of so many rooms has a use; one room is all of them", () => {
  assert.deepEqual(roomUses(1, false, false), ["all"]);
  for (let n = 2; n <= 12; n++) {
    assert.equal(roomUses(n, true, true).length, n);
    assert.equal(roomUses(n, false, false).length, n);
    assert.deepEqual(roomUses(n, false, true).slice(0, 2), ["hearth", "sleep"]);
  }
  assert.ok(roomUses(3, true, false).includes("work"));
  assert.ok(roomUses(6, false, true).includes("wash"));
});

test("what a family can spend climbs with their standing, their land and a court's seat", () => {
  const base = {
    wages: 2,
    bread: 0.4,
    mouths: 2,
    madeHead: 25,
    standing: 0.5,
    court: false,
    rent: 0,
  };
  const low = coinOf({ ...base, standing: 0 }),
    mid = coinOf(base),
    high = coinOf({ ...base, standing: 1 });
  assert.ok(low < mid && mid < high, `${low} ${mid} ${high}`);
  assert.ok(coinOf({ ...base, madeHead: 2500 }) > mid, "a rich land pays no better");
  assert.ok(coinOf({ ...base, madeHead: 0.1 }) < mid, "a poor land pays no worse");
  assert.ok(coinOf({ ...base, court: true }) > mid * 2, "a court's seat is worth nothing");
  assert.ok(coinOf({ ...base, rent: 1 }) < mid, "rent is paid out of nothing");
});

test("those who earn less than their bread still have the least there is, no less", () => {
  const coin = coinOf({
    wages: 0.1,
    bread: 5,
    mouths: 8,
    madeHead: 1,
    standing: 0,
    court: false,
    rent: 3,
  });
  assert.equal(coin, POOREST);
});
