import { test } from "node:test";
import assert from "node:assert/strict";
import type { CampCraft, GenesisPlan } from "../../src/bridge/index.ts";
import {
  BAND_DAY,
  CRAFT_DOINGS,
  MEADOW_STEP,
  PLAIN_CRAFT,
  bandHour,
  bandKitWords,
  bandPersonWords,
  bandWords,
  limbPitch,
  newBand,
  newMeadow,
  seatedSink,
  stepBand,
  stepMeadow,
  type BandDoing,
  type BandState,
  type FigurePart,
  type MeadowState,
} from "../../src/view/index.ts";

// Phase 49 M211 (asked for 2026-10-25: "bring back og causlaiss like primitve crafting"): a band at
// its crafts — stone knapped into blades and points, fibre twisted into cord, points bound to
// their shafts, the kills' hides scraped on a frame and sewn into cloaks, colour ground, and fire
// made at each fresh camp — each of what the ground under the camp gives. A made-up land.

const body = (size: number) => ({
  symmetry: "bilateral" as const,
  segments: 1 as const,
  legs: 4 as const,
  fins: 0 as const,
  wings: 0 as const,
  covering: "fur",
  size,
  moves: "walk",
  eats: "grass",
  level: 2,
  neck: 0.4,
  tail: 0.3,
  features: [],
  warm: true,
});
let n = 0;
const lineage = (name: string, niche: string, size: number) => ({
  ref: `spec:0:${n++}`,
  name,
  niche,
  arose: 1,
  died: null,
  size,
  level: niche.includes("hunt") ? 3 : 2,
  body: body(size),
  words: `a ${niche}`,
});
const age = (index: number) => ({
  index,
  from: 400 - index * 50,
  to: 350 - index * 50,
  kind: "quiet",
  seaLevel: 0,
  warmth: 1,
  forests: true,
});
const PLAN = {
  seed: "craft test",
  name: "craft test",
  worldAge: 4500,
  rungs: [],
  drop: null,
  acts: { ages: [], dawn: null, lives: [], peopling: { seasLow: false, age: null, cradle: null } },
  peopling: null,
  ages: [age(0), age(1), age(2)],
  lineages: [
    lineage("grey ox", "grazer", 300),
    lineage("dun deer", "browser", 90),
    lineage("red cat", "hunter", 150),
    lineage("pale hare", "seed-eater", 3),
  ],
  people: null,
} as unknown as GenesisPlan;

/** Chert from the shale, struck on pyrite for fire; spruce, spruce root, birch pitch. */
const CHERT: CampCraft = {
  stone: {
    name: "chert",
    from: "black beds among the shale",
    keen: 0.8,
    tough: 0.6,
    colour: [0.2, 0.2, 0.23],
  },
  wood: "spruce",
  fibre: "spruce root",
  binding: "sinew and birch pitch",
  pigment: { name: "yellow ochre", colour: [0.8, 0.6, 0.2] },
  fire: "strike-a-light",
};

/** A band on the made-up land, played for so many of its days. */
const played = (
  days: number,
  craft: CampCraft = PLAIN_CRAFT,
  each?: (b: BandState, m: MeadowState) => void,
  set?: (b: BandState) => void,
) => {
  const m = newMeadow(PLAN, 2, PLAN.seed),
    b = newBand(m, 14, "the Ana", PLAN.seed, 6.5, [], 1, craft);
  set?.(b);
  for (let i = 0; i < (days * BAND_DAY) / MEADOW_STEP; i++) {
    stepMeadow(m);
    stepBand(b, m);
    each?.(b, m);
  }
  return { b, m };
};

test("a band at its crafts: of an evening by turns, the old by day, each at a craft of what the land gives", () => {
  const seen = new Map<BandDoing, string>(),
    byHour = new Map<string, number>();
  const { b } = played(4, CHERT, (b, m) => {
    const h = bandHour(b);
    for (const p of b.people) {
      if (!CRAFT_DOINGS.includes(p.doing)) continue;
      if (!seen.has(p.doing)) seen.set(p.doing, bandPersonWords(b, m, p.id));
      // (Who is at it, and when: the old by day, the grown of an evening.)
      const when = h >= 7.5 && h < 18 ? "day" : h >= 18 && h < 20.5 ? "evening" : "other";
      byHour.set(`${p.kin}:${when}`, (byHour.get(`${p.kin}:${when}`) ?? 0) + 1);
      assert.notEqual(p.kin, "child", "a child at a craft");
    }
  });
  for (const d of ["knapping", "cording", "hafting"] as const)
    assert.ok(seen.has(d), `no one ${d} (${[...seen.keys()].join(", ")})`);
  // Their words name what they work: the land's stone, its fibre, its wood and binding.
  assert.match(seen.get("knapping")!, /knapping chert into (a blade|a spear point)/);
  assert.match(seen.get("cording")!, /twisting spruce root into cord/);
  assert.match(
    seen.get("hafting")!,
    /binding a chert point to a shaft of spruce with sinew and birch pitch/,
  );
  assert.ok((byHour.get("old:day") ?? 0) > 0, "the old by day");
  assert.ok((byHour.get("grown:evening") ?? 0) > 0, "the grown of an evening");
  assert.ok(b.made >= 10, `${b.made} things made in four days`);
  assert.ok(b.kit.flakes > 0, "flakes about the work ground");
  // (The band told in a line counts those at their crafts, of an evening.)
});

test("their things kept: broken spears made again, a point knapped and bound to a shaft with cord", () => {
  const { b } = played(4, PLAIN_CRAFT, undefined, (b) => {
    b.kit.spears = 0;
    b.kit.points = 0;
    b.kit.cord = 0;
  });
  assert.ok(b.kit.spears >= 2, `${b.kit.spears} spears made again`);
  assert.ok(b.kit.cord >= 1 || b.kit.spears >= 2, "cord twisted for the binding");
  // (Never more than a band would keep: two to each hunter, and one over.)
  const hunters = b.people.filter((p) => p.hunter).length;
  assert.ok(b.kit.spears <= 2 * hunters + 1, `${b.kit.spears} spears for ${hunters} hunters`);
  assert.ok(b.kit.blades <= b.people.length + 6);
});

test("a kill's hide comes home to the frame: scraped there, and sewn into a cloak", () => {
  let scraping = "",
    sewing = false;
  const { b } = played(
    6,
    PLAIN_CRAFT,
    (b, m) => {
      for (const p of b.people) {
        if (p.doing === "scraping" && !scraping) scraping = bandPersonWords(b, m, p.id);
        if (p.doing === "sewing") sewing = true;
      }
    },
    (b) => {
      // (Two hides in from yesterday's kills.)
      b.kit.hides = 2;
      b.hidesOf = ["dun deer", "dun deer"];
    },
  );
  assert.match(scraping, /scraping a dun deer's hide on its frame/);
  assert.ok(sewing, "no one sewing");
  assert.ok(b.kit.cloaks > 7, `${b.kit.cloaks} cloaks`);
  assert.equal(b.kit.hides, 0, "a hide left unscraped");
});

test("at a fresh camp the fire is made before it burns: the eldest at it, then lit, and told", () => {
  let arrived = -1,
    litAt = -1,
    kindler = "";
  const news: string[] = [];
  const { b } = played(9, CHERT, (b, m) => {
    news.push(...b.news);
    b.news.length = 0;
    if (b.camps >= 2 && arrived < 0) {
      arrived = b.t;
      assert.equal(b.lit, false, "lit as they came");
      assert.equal(m.fire, null, "a fire before it is made");
    }
    if (arrived >= 0 && litAt < 0) {
      const k = b.people.find((p) => p.doing === "kindling");
      if (k && !kindler) kindler = bandPersonWords(b, m, k.id);
      if (b.lit) litAt = b.t;
    }
  });
  assert.ok(arrived >= 0, `the band never moved on (${b.camps} camps)`);
  assert.ok(litAt > arrived, "the fire never made");
  // (Struck within the hour of their coming, as long as it takes to walk to it and strike it.)
  assert.ok(
    litAt - arrived < BAND_DAY / 12,
    `the fire made ${(((litAt - arrived) / BAND_DAY) * 24).toFixed(2)} h after they came`,
  );
  assert.match(kindler, /striking chert on pyrite for a spark, to make the fire/);
  assert.match(kindler, /one of the old/);
  assert.ok(
    news.some((x) => / struck fire from chert on pyrite at the new camp\.$/.test(x)),
    news.join(" | "),
  );
});

test("the same land and seed, the same crafts; their things told in a line, and the band's", () => {
  const a = played(3, CHERT).b,
    again = played(3, CHERT).b;
  assert.deepEqual(again.kit, a.kit);
  assert.equal(again.made, a.made);
  const kit = bandKitWords(a);
  assert.match(kit, /^🗡️ \d+ spears?/);
  assert.match(kit, /🔪 \d+ chert blades?/);
  assert.match(kit, /🧵 \d+ spans? of cord/);
  assert.match(kit, /🧥 \d+ cloaks?/);
  // Of an evening, the band's line counts those at their crafts.
  let told = "";
  played(2, CHERT, (b) => {
    const h = bandHour(b);
    if (!told && h > 18.5 && h < 20 && !b.going && b.lit) told = bandWords(b);
  });
  assert.match(told, /\d+ at their crafts/);
});

test("at a craft they sit on the ground, legs out before them, and work it with their hands", () => {
  const parts: readonly FigurePart[] = [
    { shape: "capsule", x: 0, y: 0.4, z: 0, sx: 1, sy: 1, sz: 1, tone: 0 },
    {
      shape: "capsule",
      x: -0.05,
      y: 0.12,
      z: 0,
      sx: 0.4,
      sy: 0.45,
      sz: 0.4,
      tone: 1,
      swing: 0.5,
      pivot: 0.12,
      role: "leg",
    },
    {
      shape: "capsule",
      x: 0.05,
      y: 0.12,
      z: 0,
      sx: 0.4,
      sy: 0.45,
      sz: 0.4,
      tone: 1,
      swing: -0.5,
      pivot: 0.12,
      role: "leg",
    },
    {
      shape: "capsule",
      x: 0.12,
      y: 0.42,
      z: 0,
      sx: 0.35,
      sy: 0.4,
      sz: 0.35,
      tone: 1,
      swing: 0.6,
      pivot: 0.1,
      role: "arm",
    },
  ];
  // (Sat: sunk to the hips, the legs out level before them.)
  assert.ok(Math.abs(seatedSink(parts, "knap") - 0.24 * 0.92) < 1e-9);
  assert.equal(seatedSink(parts, "scrape"), 0, "a hide is scraped standing");
  assert.equal(seatedSink(parts, null), 0);
  assert.equal(
    seatedSink(
      parts.filter((p) => p.role !== "leg"),
      "knap",
    ),
    0,
    "no legs to sit on",
  );
  assert.ok(limbPitch(parts[1]!, "knap", false, 0.3, 1) < -1.3, "legs out before them");
  // (The hammerstone's quick blows: the arm goes up and down within a second.)
  const arm = [0, 0.1, 0.2, 0.3, 0.4].map((t) => limbPitch(parts[3]!, "knap", false, t, 1));
  assert.ok(Math.max(...arm) - Math.min(...arm) > 0.2, `the arm still (${arm.join(" ")})`);
});
