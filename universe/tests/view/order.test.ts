// War past the line, W1: a host's order from the fire it stands against, one law, by numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BEAMS, FIREARMS, WATER_ARMS } from "../../src/rules/index.ts";
import {
  PLACED_MOST,
  armFire,
  commandOf,
  newBattle,
  hostOrder,
  orderFrom,
  orderPlaces,
  townDoingIcon,
  townWarScene,
  type TownWar,
} from "../../src/view/index.ts";
import type { BattleNear, BattleSideNear, VillagePlan } from "../../src/bridge/index.ts";
import { gapOf } from "../../src/view/battle.ts";
import { OCC } from "../../src/rules/index.ts";

const foot = (arm: string) => ({ arm, guard: "leather", mount: "foot" });
const against = (own: string, foe = own) => hostOrder(foot(own), foot(foe));

test("spears, swords, bows, muskets and rifles stand as they always stood: 3.2 m, a line, to the hand", () => {
  for (const arm of [
    "club",
    "spear",
    "axe",
    "sword",
    "bow",
    "horn-bow",
    "musket",
    "rifle",
    "gas-dart",
  ]) {
    const o = against(arm);
    assert.equal(o.line, true, arm);
    assert.ok(Math.abs(o.spacing - 3.2) < 0.05, `${arm} at ${o.spacing}`);
    assert.equal(o.standOff, 0);
    assert.equal(o.bounds, false);
    assert.equal(o.cover, false);
  }
});

test("past the rifle the law meets Dupuy's figures: 50 m for the magazine, the automatic between the Second World War's and the Cold War's end", () => {
  const repeater = against("repeater"),
    automatic = against("automatic");
  assert.ok(Math.abs(repeater.area - 2500) < 1, `${repeater.area}`);
  assert.ok(Math.abs(repeater.spacing - 50) < 0.5, `${repeater.spacing}`);
  assert.ok(automatic.area > 27500 && automatic.area < 50000, `${automatic.area}`);
  assert.ok(automatic.spacing > 165 && automatic.spacing < 224, `${automatic.spacing}`);
  for (const o of [repeater, automatic, against("autoloader")]) {
    assert.equal(o.line, false);
    assert.equal(o.bounds, true);
    assert.equal(o.cover, true);
    assert.ok(o.standOff > 0);
  }
  // In the order of what they loose.
  assert.ok(against("autoloader").spacing > repeater.spacing);
  assert.ok(automatic.spacing > against("autoloader").spacing);
});

test("the law reads numbers: any arm with a rate and a range, no name in it", () => {
  const made = (rate: number, range: number) =>
    orderFrom({ foe: { rate, range }, own: { rate, range }, command: 3000 });
  assert.equal(made(6, 400).line, true);
  assert.equal(made(6.01, 400).line, false);
  assert.equal(
    made(120, 900).spacing,
    orderFrom({ foe: armFire("automatic"), own: armFire("automatic"), command: 3000 }).spacing,
  );
  // Every arm the rules have goes through it.
  for (const f of [...FIREARMS, ...BEAMS]) assert.equal(armFire(f.id).rate, f.rate);
  for (const id of Object.keys(WATER_ARMS))
    assert.equal(armFire(id).rate, WATER_ARMS[id as keyof typeof WATER_ARMS].rate);
});

test("a host stands by the greater of its foe's fire and its own: spears against guns come on apart, and close", () => {
  const spears = against("spear", "automatic"),
    guns = against("automatic", "spear");
  assert.equal(spears.line, false);
  assert.equal(spears.standOff, 0, "nothing to stand off with");
  assert.equal(guns.line, false, "a host of guns does not bunch up for spears");
  assert.ok(guns.standOff > 100);
});

test("no further than command reaches: a voice holds a wide host in pairs, a wire or a link in full squads", () => {
  assert.equal(commandOf("spear"), 100);
  assert.ok(commandOf("automatic") > commandOf("rifle"));
  const voice = orderFrom({
      foe: armFire("automatic"),
      own: armFire("automatic"),
      command: 100,
    }),
    link = orderFrom({ foe: armFire("automatic"), own: armFire("automatic"), command: 3000 });
  assert.equal(voice.squad, 2);
  assert.equal(link.squad, 8);
  assert.equal(
    orderFrom({ foe: armFire("automatic"), own: armFire("spear"), command: 40 }).spacing,
    40,
  );
});

test("beams and sound through the same law; made soldiers stand closer, and neither hide nor bound", () => {
  assert.ok(Math.abs(against("beam-rifle").spacing - Math.sqrt(80000)) < 0.01);
  assert.equal(against("beam-rifle").squad, 8);
  assert.equal(against("beam-lance").line, false);
  assert.equal(against("sound-lance").line, false);
  const flesh = hostOrder(foot("beam-rifle"), foot("beam-rifle")),
    made = hostOrder({ arm: "beam-rifle", mount: "machine-host" }, foot("beam-rifle"));
  assert.ok(Math.abs(made.spacing - flesh.spacing / 2) < 0.01);
  assert.equal(made.cover, false);
  assert.equal(made.bounds, false);
});

test("drawn figures are squads staggered in depth, holding what the law gives, up to what a town has room for", () => {
  const places = orderPlaces(against("repeater"), 18, undefined, 7, 220),
    squads = new Set(places.map((p) => p.squad));
  assert.ok(squads.size >= 3);
  assert.ok(new Set(places.map((p) => Math.round(p.depth / 10))).size >= 3, "in depth");
  const xs = places.map((p) => p.across),
    ds = places.map((p) => p.depth),
    ground =
      ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ds) - Math.min(...ds))) / places.length;
  assert.ok(ground > 1200 && ground < 3500, `${ground} m² a figure`);
  // A team gun for so many of its host.
  const team = orderPlaces(against("automatic"), 18, 6, 7, 220).filter((p) => p.gun).length;
  assert.ok(team >= 2 && team <= 5, `${team} guns`);
});

const town: VillagePlan = {
  ref: "town:0:5",
  name: "Fieldham",
  population: 90,
  market: false,
  hand: false,
  districts: null,
  biome: 8,
  seed: 4,
  homes: Array.from({ length: 12 }, (_, k) => {
    const a = k * 2.399963,
      r = 16 + 8.5 * Math.sqrt(k);
    return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: null };
  }),
  fields: [],
  pasture: { x: -300, z: 0, r: 90 },
  wild: 400,
  water: null,
  house: { walls: "wattle", roof: "thatch", form: "round", pitch: 45, design: null },
  body: null,
  road: { x: 0, z: 1100 },
  people: [
    { ref: "prsn:0:1", name: "A B", home: 0, age: 30, occupation: OCC.farmer, child: false },
  ],
};
const warOf = (a: string, d: string, more: Partial<TownWar>, mount = "foot"): TownWar =>
  ({
    ref: "war:0:7",
    sides: [
      {
        ref: "a",
        name: "a",
        color: [1, 0, 0],
        fields: 1,
        arms: null,
        host: { arm: a, guard: "", mount },
      },
      {
        ref: "d",
        name: "d",
        color: [0, 0, 1],
        fields: 1,
        arms: null,
        host: { arm: d, guard: "", mount: "foot" },
      },
    ],
    hosts: [],
    fight: null,
    fought: null,
    placed: null,
    eve: false,
    siege: false,
    burning: 0,
    words: "",
    ...more,
  }) as TownWar;
const host = (side: 0 | 1, doing: TownWar["hosts"][number]["doing"], k = 1) => ({
  side,
  doing,
  k,
  gathered: 1,
  words: "",
});
const EACH = 18;
const living = (w: TownWar) =>
  townWarScene(town, w, EACH).soldiers.filter((q) => q.size > 0.5 && q.doing !== "fallen");

test("a modern host at a town, at every doing: nobody by the hand, no line, a storm by the streets", () => {
  const engaged = { stage: "engaged" as const, k: 0.6, key: "w:1" },
    drawn = { stage: "drawn" as const, k: 1, key: "w:1" },
    cases: readonly Partial<TownWar>[] = [
      { fight: drawn, hosts: [host(0, "drawn"), host(1, "drawn")] },
      { fight: engaged, hosts: [host(0, "engaged"), host(1, "engaged")] },
      { hosts: [host(1, "guard")] },
      { hosts: [host(0, "holding")] },
      { siege: true, hosts: [host(0, "besieging"), host(1, "besieged")] },
      { siege: true, fight: engaged, hosts: [host(0, "assaulting"), host(1, "besieged")] },
    ];
  for (const c of cases) {
    const s = townWarScene(town, warOf("automatic", "autoloader", c), EACH),
      all = s.soldiers.filter((q) => q.size > 0.5 && q.doing !== "fallen");
    assert.ok(all.length > 0);
    assert.ok(!all.some((q) => q.doing === "fight"), "no one by the hand");
    assert.equal(s.tents.length, 0, "no tents");
  }
  // Drawn up, the hosts well apart, in depth and not one thin line.
  const up = townWarScene(town, warOf("automatic", "autoloader", cases[0]!), EACH).soldiers.slice(
      0,
      EACH,
    ),
    road = up.map((q) => q.z);
  assert.ok(Math.max(...road) - Math.min(...road) > 60, "in depth");
  // The siege: guns standing off well past its homes, shells in its lots, some of it alight.
  const siege = townWarScene(town, warOf("automatic", "autoloader", cases[4]!), EACH);
  assert.ok((siege.battery?.length ?? 0) >= 3);
  for (const g of siege.battery ?? []) assert.ok(Math.hypot(g.x, g.z) > 150);
  assert.ok((siege.shells?.length ?? 0) > 0);
  assert.ok(siege.fires.length > 0);
});

test("a magazine rifle raises ladders still (the close field's rule): tents stand, but it stands apart", () => {
  const siege = townWarScene(
    town,
    warOf("repeater", "repeater", {
      siege: true,
      hosts: [host(0, "besieging"), host(1, "besieged")],
    }),
    EACH,
  );
  assert.equal(siege.tents.length, 12);
  assert.equal(siege.battery, undefined);
});

test("armoured hosts bring their cars; team guns are drawn with their gunners; bounds rush and rest", () => {
  const drawn = { stage: "drawn" as const, k: 1, key: "w:1" },
    s = townWarScene(
      town,
      warOf(
        "automatic",
        "autoloader",
        { fight: drawn, hosts: [host(0, "drawn"), host(1, "drawn")] },
        "armoured",
      ),
      EACH,
    );
  assert.ok((s.cars?.length ?? 0) >= 1);
  assert.ok((s.teamGuns?.length ?? 0) >= 1);
  const doings = new Set<string>();
  for (let k = 0.05; k < 1; k += 0.05)
    for (const q of living(
      warOf("autoloader", "autoloader", {
        fight: { stage: "engaged", k, key: "w:1" },
        hosts: [host(0, "engaged"), host(1, "engaged")],
      }),
    ))
      doings.add(q.doing);
  assert.ok(doings.has("advance") && doings.has("fire") && doings.has("prone"), [...doings].join());
});

test("spears against machine guns come on apart and fight by the hand at the end, the gunners firing", () => {
  const end = townWarScene(
      town,
      warOf("spear", "automatic", {
        fight: { stage: "engaged", k: 0.98, key: "w:1" },
        hosts: [host(0, "engaged"), host(1, "engaged")],
      }),
      EACH,
    ).soldiers,
    spears = end.slice(0, EACH).filter((q) => q.size > 0.5 && q.doing !== "fallen"),
    guns = end.slice(2 * EACH, 3 * EACH).filter((q) => q.size > 0.5 && q.doing !== "fallen");
  assert.ok(spears.some((q) => q.doing === "fight"));
  assert.ok(!guns.some((q) => q.doing === "fight"));
});

const fielded = (name: string, arm: string): BattleSideNear => ({
  ref: `realm:${name}`,
  name,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded: 4000,
  fallen: 400,
  wounded: 300,
  host: { arm, guard: "", mount: "" },
  kit: `${arm}s`,
});
const battleOf = (a: string, d: string): BattleNear => ({
  event: "ev:0:9:1",
  war: "war:1",
  title: "The battle at the test land",
  cell: 1,
  land: "The test land",
  year: 364,
  attacker: fielded("a", a),
  defender: fielded("d", d),
  won: true,
  outcome: "taken",
  civil: null,
  hills: false,
  river: false,
  walls: 0,
  town: null,
  figure: null,
  plan: { seed: "t", ages: [] as never, lineages: [] },
});

test("a battle fought in place stands by the same order past the rifle, as far as the field has room; the close field and the line unmoved", () => {
  const most = PLACED_MOST[0];
  // The line: as it was, placed or not.
  for (const arm of ["spear", "sword", "musket", "rifle"]) {
    const placed = newBattle(battleOf(arm, arm), most, true);
    assert.equal(placed.hosts[0].gaps, undefined, arm);
    assert.equal(placed.hosts[0].open, undefined, arm);
  }
  // The close field: open order's own 3 m and 4 m.
  const close = newBattle(battleOf("repeater", "repeater"), most);
  assert.equal(close.hosts[0].gaps, undefined);
  assert.equal(gapOf(close.hosts[0]).file, 3);
  // In place: wider, the law's for the magazine (50 m on the town's ground is 25 on the field) up to the field's room.
  const magazine = newBattle(battleOf("repeater", "repeater"), most, true),
    guns = newBattle(battleOf("automatic", "automatic"), most, true),
    m = gapOf(magazine.hosts[0]),
    g = gapOf(guns.hosts[0]);
  assert.ok(m.file > 3 && m.file <= Math.sqrt(2500) / 2 + 0.1, `${m.file} m`);
  assert.ok(g.file >= m.file);
  assert.ok(g.rank >= 4 && g.rank <= 30);
  // Every figure stands on the field.
  for (const t of guns.troopers) assert.ok(Math.abs(t.z) <= 45);
});

test("the words and signs say what is done: no tent or ladder for those who shell a town, as they were for those who camp", () => {
  assert.equal(townDoingIcon("besieging", "spear"), "⛺");
  assert.equal(townDoingIcon("besieging", "repeater"), "⛺");
  assert.equal(townDoingIcon("assaulting", "rifle"), "🪜");
  assert.equal(townDoingIcon("besieging", "automatic"), "💥");
  assert.equal(townDoingIcon("assaulting", "beam-rifle"), "💥");
  assert.equal(townDoingIcon("drawn", "automatic"), "🛡️");
});
