import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLOCK_D,
  BLOCK_W,
  TIER,
  formWhys,
  grownBlocks,
  reachToward,
  climb,
  lotTier,
  streetsLaid,
  tallShare,
  townForm,
  walkBlocks,
  type FormFacts,
  type TownPlan,
  type TownSite,
} from "../../src/bridge/index.ts";
import { TownParts, townGround, townHomes, townScene } from "../../src/view/index.ts";
import { heightOf, streetOf } from "../../src/view/townform.ts";
import { YEAR } from "../../src/kernel/index.ts";

// Asked 2026-11-19: a town's form from what moving, building and holding ground cost its people here (bridge/form.ts). The same
// facts give the same plan; ground is cut straight only where it was measured; a home stands high only where its people can
// raise it so and the ground is dear; those who walk lay narrower streets than those who drive, and what was laid before
// engines keeps its lanes; a people of the water's town is laid another way, for a reason its page says.

const SITE: TownSite = {
  up: 0.6,
  rise: 14,
  lee: 2.4,
  roads: [
    { bearing: 0.3, busy: 4, rails: false, to: 1 },
    { bearing: 2.9, busy: 1, rails: false, to: 2 },
  ],
  measured: -1,
  walled: null,
  dry: false,
};
const FOOT: FormFacts = {
  how: "feet",
  share: 0,
  mass: 70,
  winged: false,
  water: false,
  social: 0.6,
  engines: -1,
  rain: 800,
  warm: 12,
  reach: 0.5,
  spare: 0.2,
  stone: true,
  market: true,
  seat: 0,
  people: 4000,
  own: false,
};
const DRIVES: FormFacts = { ...FOOT, how: "wheels", share: 0.5, engines: 40 },
  SWIMS: FormFacts = { ...FOOT, how: "swim", water: true, mass: 31, social: 0.4, own: true },
  FLIES: FormFacts = { ...FOOT, winged: true, mass: 20 };

/** The mean way from each of blocks [from, to) to the nearest other block (metres). */
function nearest(b: { x: Float32Array; z: Float32Array }, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) {
    let near = Infinity;
    for (let j = 0; j < b.x.length; j++)
      if (j !== i) near = Math.min(near, Math.hypot(b.x[i]! - b.x[j]!, b.z[i]! - b.z[j]!));
    sum += near;
  }
  return sum / (to - from);
}

/** A plan of `lots` homes all of one level, on a site, with a form. */
function planOf(facts: FormFacts, lots: number, level: number, site: TownSite = SITE): TownPlan {
  const laid = streetsLaid(facts);
  return {
    family: "lanes",
    site: laid ? { ...site, laid } : site,
    form: townForm(facts),
    seed: 77,
    axis: 0.3,
    lots,
    whole: lots,
    runs: [[0, 0, lots, 10, 12, level, -1]],
    civics: [],
    walls: null,
    months: [1, 2, 4, 8, 12, 24, 36],
    designs: [{ since: -1, walls: "timber", roof: "thatch", form: "", pitch: 40 }],
    paved: false,
    water: null,
    year: 12,
  };
}

/** The tallest and lowest wall of a colour drawn (metres; a box's height is its fifth number). */
function heights(parts: TownParts, match: (key: string) => boolean): number[] {
  const out: number[] = [];
  for (const [key, g] of parts.groups)
    if (match(key)) for (let i = 0; i < g.data.length; i += 7) out.push(g.data[i + 4]!);
  return out.sort((a, b) => a - b);
}

/** The heights of the boxes drawn `wide` along their street (a level's walls), lowest first. */
function wallsOf(parts: TownParts, wide: number): number[] {
  const out: number[] = [];
  for (const [key, g] of parts.groups)
    if (key.startsWith("box|"))
      for (let i = 0; i < g.data.length; i += 7)
        if (Math.abs(g.data[i + 3]! - wide) < 1e-3 && g.data[i + 4]! > 3) out.push(g.data[i + 4]!);
  return out.sort((a, b) => a - b);
}

test("the same facts give the same form and the same streets", () => {
  assert.deepEqual(townForm(DRIVES), townForm({ ...DRIVES }));
  assert.deepEqual(streetsLaid(DRIVES), streetsLaid({ ...DRIVES }));
  const laid = streetsLaid(DRIVES)!,
    a = grownBlocks(77, { ...SITE, laid }, 160, null, 0.3),
    b = grownBlocks(77, { ...SITE, laid }, 160, null, 0.3);
  assert.deepEqual([...a.x], [...b.x]);
  assert.deepEqual([...a.yaw], [...b.yaw]);
  // (And a town grown further keeps every block it had.)
  const more = grownBlocks(77, { ...SITE, laid }, 240, null, 0.3);
  assert.deepEqual([...more.x.subarray(0, 160)], [...a.x]);
});

test("our own on foot lay their streets as they always have: nothing said, nothing moved", () => {
  assert.equal(streetsLaid(FOOT), undefined);
  const old = grownBlocks(77, SITE, 120, null, 0.3),
    now = grownBlocks(77, { ...SITE, laid: undefined }, 120, null, 0.3);
  assert.deepEqual([...old.x], [...now.x]);
});

test("a grid needs its ground measured out: lanes wander where none measured it", () => {
  const walked = grownBlocks(77, { ...SITE, rise: 4 }, 120, null, 0.3),
    measured = grownBlocks(77, { ...SITE, rise: 4, measured: 0 }, 120, null, 0.3),
    turns = (b: { yaw: Float32Array }) => new Set([...b.yaw].map((t) => t.toFixed(2))).size;
  assert.equal(
    walked.straight.reduce((a, s) => a + s, 0),
    0,
  );
  assert.ok(measured.straight.reduce((a, s) => a + s, 0) > 100);
  assert.ok(turns(measured) < turns(walked) / 3, `${turns(measured)} against ${turns(walked)}`);
});

test("a people who walk lay their blocks closer than a people who drive; what was laid before engines keeps its lanes", () => {
  const laid = streetsLaid(DRIVES)!,
    walk = grownBlocks(77, SITE, 200, null, 0.3),
    drive = grownBlocks(77, { ...SITE, laid }, 200, null, 0.3);
  assert.equal(laid.at(-1)!.from, 40);
  assert.ok(laid.at(-1)!.street > 8 && laid.at(-1)!.verge > 0);
  // (The heart, laid before: block for block the same.)
  assert.deepEqual([...drive.x.subarray(0, 40)], [...walk.x.subarray(0, 40)]);
  // (What was laid since: further apart.)
  const near = nearest(walk, 60, 200),
    far = nearest(drive, 60, 200);
  assert.ok(far > near + 4, `${far.toFixed(1)} m against ${near.toFixed(1)} m`);
  // (No two blocks overlap: their middles never nearer than a block is deep.)
  for (let i = 0; i < 200; i++)
    for (let j = i + 1; j < 200; j++)
      assert.ok(
        Math.hypot(drive.x[i]! - drive.x[j]!, drive.z[i]! - drive.z[j]!) >= BLOCK_D,
        `${i} on ${j}`,
      );
  assert.ok(BLOCK_W > BLOCK_D);
});

test("a people of the water's town is laid another way, and says why", () => {
  const laid = streetsLaid(SWIMS)!,
    swim = grownBlocks(77, { ...SITE, laid }, 200, null, 0.3),
    walk = grownBlocks(77, SITE, 200, null, 0.3),
    form = townForm(SWIMS);
  assert.ok(form.over && form.heart === 0 && form.edge === 1 && form.green === 0 && form.own);
  assert.ok(laid[0]!.lane < 6);
  // (As many blocks on less ground: each nearer its neighbour.)
  const close = nearest(swim, 0, 200),
    apart = nearest(walk, 0, 200);
  assert.ok(close < apart - 1, `${close.toFixed(1)} m against ${apart.toFixed(1)} m`);
  // (No ground dearer than the rest: every lot the town's own.)
  for (const p of [0, 50, 400, 1599]) assert.equal(lotTier(form, p, 1600), TIER.town);
  const whys = formWhys(form, laid, false).join(" ");
  assert.match(whys, /pass over their town, swimming/);
  assert.match(whys, /built alike from end to end/);
  // (Those who fly: close too, and high by the square.)
  const wing = townForm(FLIES);
  assert.ok(wing.over && wing.heart > townForm(FOOT).heart);
  assert.match(
    formWhys(wing, streetsLaid(FLIES), false).join(" "),
    /Nothing is lost by living high/,
  );
});

test("ground is dear by the square and cheap at the edge; engines flatten it", () => {
  const foot = townForm(FOOT),
    drive = townForm(DRIVES);
  assert.equal(lotTier(foot, 3, 1600), TIER.heart);
  assert.equal(lotTier(foot, 600, 1600), TIER.town);
  assert.equal(lotTier(foot, 1590, 1600), TIER.edge);
  // (Within standing walls, close to the last lot.)
  assert.equal(lotTier(foot, 600, 1600, 800), TIER.heart);
  const edge = (f: typeof foot) => {
    let n = 0;
    for (let p = 0; p < 1600; p++) if (lotTier(f, p, 1600) === TIER.edge) n++;
    return n;
  };
  assert.ok(edge(drive) > 2 * edge(foot), `${edge(drive)} against ${edge(foot)}`);
  // (A tall home's height falls outward, and falls less where households drive.)
  assert.ok(tallShare(foot, 0, 1600) > tallShare(foot, 1500, 1600) + 0.3);
  assert.ok(
    tallShare(foot, 0, 1600) - tallShare(foot, 800, 1600) >
      tallShare(drive, 0, 1600) - tallShare(drive, 800, 1600) - 1e-9,
  );
});

test("height needs the craft: houses stay low whatever the ground, tall homes stand highest by the square", () => {
  const t = 40 * YEAR,
    draw = (level: number) => {
      const plan = planOf(FOOT, 800, level),
        scene = townScene(plan, t),
        parts = new TownParts();
      townHomes(scene, scene.settled, t, parts);
      townHomes(scene, scene.active, t, parts);
      return parts;
    };
  // Houses (what a people without the craft raise): none over two floors, by the square or not.
  const low = heights(draw(1), (k) => k.startsWith("box|"));
  assert.ok(low.at(-1)! < 7, `a house ${low.at(-1)} m high`);
  // Blocks of ten storeys: brick is not theirs, concrete is; highest at the heart, lowest at the edge.
  const tall = draw(4),
    walls = wallsOf(tall, 8.8);
  assert.ok(walls.length >= 800);
  assert.ok(walls.at(-1)! > 30 && walls[0]! < 26, `${walls[0]} to ${walls.at(-1)}`);
  const scene = townScene(planOf(FOOT, 800, 4), t),
    near = scene.formLooks,
    high = (p: number) => 0.45 + (scene.tiers![p]! >> 2) * 0.1;
  assert.equal(near.size, 0);
  let heart = 0,
    rim = 0;
  for (let p = 0; p < 80; p++) heart += high(p) / 80;
  for (let p = 720; p < 800; p++) rim += high(p) / 80;
  assert.ok(heart > rim + 0.25, `${heart.toFixed(2)} against ${rim.toFixed(2)}`);
});

test("a town's form draws a few parts more, in the batches it had, and says itself", () => {
  const t = 40 * YEAR,
    count = (plan: TownPlan) => {
      const scene = townScene(plan, t),
        parts = new TownParts();
      townGround(scene, parts);
      townHomes(scene, scene.settled, t, parts);
      townHomes(scene, scene.active, t, parts);
      let batches = 0;
      for (const g of parts.groups.values()) if (g.data.length) batches++;
      return { parts: parts.count, batches };
    },
    plan = planOf({ ...DRIVES, seat: 2 }, 1600, 1),
    bare: TownPlan = { ...plan, form: undefined, site: SITE },
    a = count(plan),
    b = count(bare);
  assert.ok(a.parts < b.parts * 1.06, `${a.parts} parts against ${b.parts}`);
  assert.ok(a.batches <= b.batches + 12, `${a.batches} batches against ${b.batches}`);
  const whys = formWhys(plan.form!, plan.site!.laid, false);
  assert.ok(whys.length >= 4);
  for (const w of whys) assert.doesNotMatch(w, /undefined|NaN|null/);
  assert.match(whys.join(" "), /only engines make ground worth holding/);
  assert.match(
    formWhys(
      townForm({ ...DRIVES, engines: 0 }),
      streetsLaid({ ...DRIVES, engines: 0 }),
      false,
    ).join(" "),
    /founded after engines came/,
  );
  // (How far a household walks: a heavier people a little further, never a block fewer for the years gone by.)
  assert.ok(walkBlocks(70) > 1500 && walkBlocks(70) < 3000, `${walkBlocks(70)}`);
  assert.ok(walkBlocks(700) > walkBlocks(70) && walkBlocks(20) < walkBlocks(70));
  assert.match(whys.join(" "), /colonnade of stone/);
  assert.match(whys.join(" "), /A column \d+ m high/);
});

// —— What a town's form turns on, kept (sim/town/fabric.ts): its ages, its market place, the height it holds ——

test("ground is cut into equal blocks only where a realm's will is done; half done, its streets run straight; no block laid before moves", () => {
  const flat = { ...SITE, rise: 4 },
    turns = (b: { yaw: Float32Array }, from = 0) =>
      new Set([...b.yaw.subarray(from)].map((t) => t.toFixed(2))).size,
    sum = (a: Uint8Array) => a.reduce((x, s) => x + s, 0),
    lanes = grownBlocks(77, { ...flat, surveys: [{ from: 0, order: 0.1 }] }, 160, null, 0.3),
    straight = grownBlocks(77, { ...flat, surveys: [{ from: 0, order: 0.3 }] }, 160, null, 0.3),
    grid = grownBlocks(77, { ...flat, surveys: [{ from: 0, order: 0.6 }] }, 160, null, 0.3);
  assert.equal(sum(lanes.straight), 0);
  assert.equal(sum(straight.straight), 0);
  assert.ok(sum(grid.straight) > 140);
  assert.ok(
    turns(grid) < turns(straight) && turns(straight) < turns(lanes),
    `the surer, the straighter: ${turns(grid)}, ${turns(straight)}, ${turns(lanes)}`,
  );
  // An old heart of lanes, measured out from its fortieth block: every part as it was laid.
  const old = { ...flat, walled: 320 },
    ages = grownBlocks(
      77,
      {
        ...old,
        surveys: [
          { from: 0, order: 0 },
          { from: 40, order: 0.7 },
        ],
      },
      160,
      null,
      0.3,
    ),
    heart = grownBlocks(77, { ...old, surveys: [{ from: 0, order: 0 }] }, 160, null, 0.3);
  assert.deepEqual([...ages.x.subarray(0, 40)], [...heart.x.subarray(0, 40)]);
  assert.equal(sum(ages.straight.subarray(0, 40)), 0);
  assert.ok(sum(ages.straight.subarray(40)) > 100);
  assert.ok(turns(ages, 40) < turns(heart, 40) / 3);
});

test("a market place is the ground a town would have taken next at its first market, kept open; nothing laid before it moves", () => {
  const none = grownBlocks(77, SITE, 200, null, 0.3);
  assert.equal(none.place, undefined);
  for (const size of [1, 2, 3]) {
    const site = { ...SITE, place: { at: 24, size } },
      g = grownBlocks(77, site, 200, null, 0.3),
      place = g.place!;
    assert.ok(place, `a place of size ${size}`);
    assert.equal(place.at, 24);
    assert.deepEqual([...g.x.subarray(0, 24)], [...none.x.subarray(0, 24)]);
    assert.equal(place.through, size >= 2);
    assert.ok(size < 3 ? place.w === BLOCK_W : place.w > 2 * BLOCK_W - 1);
    assert.ok(size === 1 ? place.d === BLOCK_D : place.d > 2 * BLOCK_D);
    // No block stands on it: none has its middle within the place.
    const c = Math.cos(place.yaw),
      s = Math.sin(place.yaw);
    for (let b = 0; b < 200; b++) {
      const dx = g.x[b]! - place.x,
        dz = g.z[b]! - place.z,
        along = Math.abs(dx * c - dz * s),
        across = Math.abs(dx * s + dz * c);
      assert.ok(along > place.w / 2 + 6 || across > place.d / 2 + 6, `block ${b} on the place`);
    }
    // Grown further it is where it was; a town drawn to fewer blocks than it had then has none yet.
    assert.deepEqual(grownBlocks(77, site, 320, null, 0.3).place, place);
    assert.equal(grownBlocks(77, site, 20, null, 0.3).place, undefined);
  }
});

test("a town's ages are told on its ground: lanes, measured streets, streets laid for engines, the ring where its walls stood, its market place", () => {
  const t = 40 * YEAR,
    facts: FormFacts = { ...DRIVES, engines: 120, seat: 2, reach: 0.8, spare: 0.7 },
    laid = streetsLaid(facts)!,
    plan: TownPlan = {
      ...planOf(facts, 1600, 2),
      site: {
        ...SITE,
        rise: 20,
        laid,
        walled: 320,
        surveys: [
          { from: 0, order: 0 },
          { from: 40, order: 0.7 },
        ],
        place: { at: 12, size: 2 },
      },
      walls: { start: 2, end: 6, reach: 320 },
      rank: {
        gini: 0.2,
        drives: true,
        seat: { realm: "r", name: "n", ruler: "x", color: [0.2, 0.3, 0.8], grade: 1 },
      },
    },
    scene = townScene(plan, t),
    parts = new TownParts();
  townGround(scene, parts);
  const has = (key: string) => (parts.groups.get(key)?.data.length ?? 0) / 7;
  // (Grown to five times what its walls rang: they are down, a ring street where they stood.)
  assert.equal(scene.walls?.lengths.length, 0);
  assert.ok(scene.lots.blocks.place, "its market place");
  const streets = new Map<string, number>();
  for (let b = 0; b < 200; b++) {
    const c = streetOf(scene, b, [0.5, 0.5, 0.5])
      .map((v) => v.toFixed(2))
      .join(",");
    streets.set(c, (streets.get(c) ?? 0) + 1);
  }
  assert.equal(streets.size, 3, "three ages of street");
  assert.equal(streets.get("0.50,0.50,0.50"), 40, "its heart's lanes");
  assert.equal(streets.get("0.40,0.41,0.44"), 80, "what was laid for engines");
  // The column on its place and the keep on its height are drawn; the column is as high as the form says.
  const form = plan.form!;
  assert.ok(form.column >= 25, `a column ${form.column} m high`);
  assert.ok(heightOf(scene)?.keep, "a keep on its height");
  assert.ok(has("cone|0.200|0.300|0.800") >= 1, "the keep's roof in the realm's colours");
  const shafts = [...parts.groups].flatMap(([k, g]) =>
    k.startsWith("cyl|") ? [...g.data].filter((_, i) => i % 7 === 4) : [],
  );
  assert.equal(Math.max(...shafts), form.column, "its column's shaft");
  // And said, each of them.
  const whys = formWhys(form, laid, {
    walled: false,
    kept: true,
    surveys: plan.site!.surveys,
    place: scene.lots.blocks.place,
    ring: true,
    height: "keep",
    temple: true,
    tall: true,
    stacks: false,
  }).join(" ");
  for (const said of [
    /What it has taken since engines came/,
    /When it was founded no one here could hold a household to a line/,
    /Where it grew on from its 40th block its realm's will was done here 7 parts in 10/,
    /a ring street runs there now they are down/,
    /Its market place is the ground it would have built on next/,
    /colonnade of stone on its market place/,
    /A column \d+ m high stands there/,
    /Its temple stands on steps/,
    /a keep on the line of its walls/,
    /one front in three is painted/,
    /Its tall homes are of fired brick/,
  ])
    assert.match(whys, said);
  assert.doesNotMatch(whys, /undefined|NaN|null/);
});

test("a home is built against its weather and to its people's measure: pale and close in the heat, steep in the snow, high for the tall", () => {
  const t = 40 * YEAR,
    draw = (facts: FormFacts, level: number) => {
      const scene = townScene(planOf(facts, 800, level), t),
        parts = new TownParts();
      townHomes(scene, scene.settled, t, parts);
      townHomes(scene, scene.active, t, parts);
      return { scene, parts };
    },
    mild = townForm(FOOT),
    hot = townForm({ ...FOOT, warm: 27, rain: 200 }),
    cold = townForm({ ...FOOT, warm: -2, rain: 600 }),
    wet = townForm({ ...FOOT, warm: 22, rain: 2400 });
  assert.ok(hot.courts && hot.pale >= 0.5 && hot.heart > mild.heart + 0.2);
  assert.ok(!mild.courts && mild.pale === 0 && mild.steep === 1);
  assert.ok(cold.steep === 1.5 && wet.steep === 1.25 && !wet.courts);
  // Pale walls in the heat: its walls are lighter than the mild town's.
  const wallKey = (d: ReturnType<typeof draw>) =>
      [...d.parts.groups].filter(
        ([k, g]) => k.startsWith("box|") && g.data.length > 7 * 200,
      )[0]![0],
    a = wallKey(draw(FOOT, 2)),
    b = wallKey(draw({ ...FOOT, warm: 27, rain: 200 }, 2));
  const light = (k: string) =>
    k
      .split("|")
      .slice(1)
      .reduce((x, v) => x + Number(v), 0);
  assert.ok(light(b) > light(a) + 0.3, `${b} paler than ${a}`);
  // Steeper roofs in the snow.
  const roofs = (d: ReturnType<typeof draw>) =>
    Math.max(
      ...[...d.parts.groups].flatMap(([k, g]) => (k.startsWith("gable|") ? [g.data[4]!] : [])),
    );
  assert.ok(roofs(draw({ ...FOOT, warm: -2, rain: 600 }, 2)) > roofs(draw(FOOT, 2)) * 1.4);
  // Floors as high as its people: a heavy people's townhouse stands higher than ours, a slight people's lower.
  const top = (f: FormFacts) => wallsOf(draw(f, 2).parts, 8.4).at(-1)!;
  assert.ok(top({ ...FOOT, mass: 200 }) > top(FOOT) * 1.2);
  assert.ok(top({ ...FOOT, mass: 25 }) < top(FOOT) * 0.85);
  // Fronts painted where there is something to spare: more colours of wall, no more parts.
  const plain = draw(FOOT, 2),
    rich = draw({ ...FOOT, spare: 0.8 }, 2),
    walls = (d: ReturnType<typeof draw>) =>
      [...d.parts.groups].filter(([k, g]) => k.startsWith("box|") && g.data.length > 7 * 50).length;
  assert.equal(rich.parts.count, plain.parts.count);
  assert.ok(walls(rich) >= walls(plain) + 1);
});

test("all of it within a few parts and batches of the town drawn with no form", () => {
  const t = 40 * YEAR,
    count = (plan: TownPlan) => {
      const scene = townScene(plan, t),
        parts = new TownParts();
      townGround(scene, parts);
      townHomes(scene, scene.settled, t, parts);
      townHomes(scene, scene.active, t, parts);
      let batches = 0;
      for (const g of parts.groups.values()) if (g.data.length) batches++;
      return { parts: parts.count, batches };
    };
  for (const level of [1, 2, 4]) {
    const facts: FormFacts = {
        ...DRIVES,
        engines: 60,
        seat: 2,
        reach: 0.8,
        spare: 0.8,
        warm: 24,
        rain: 300,
      },
      plan: TownPlan = {
        ...planOf(facts, 1600, level),
        site: {
          ...SITE,
          rise: 20,
          laid: streetsLaid(facts)!,
          walled: 320,
          surveys: [{ from: 0, order: 0.6 }],
          place: { at: 12, size: 3 },
        },
        walls: { start: 2, end: 6, reach: 320 },
      },
      bare: TownPlan = { ...plan, form: undefined, site: SITE, walls: null },
      a = count(plan),
      b = count(bare);
    assert.ok(a.parts < b.parts * 1.08, `level ${level}: ${a.parts} parts against ${b.parts}`);
    assert.ok(
      // (Every form at once on a town of one design and no other building: each a colour of its own, sixteen at the most.
      // A lived world's towns are held to the greater of fifteen in the hundred and twelve: town-form-world.test.ts.)
      a.batches <= b.batches + 16,
      `level ${level}: ${a.batches} batches against ${b.batches}`,
    );
  }
});

test("a town is no disc: it reaches furthest down its roads in, less between them and less up its slope", () => {
  const site: TownSite = { ...SITE, rise: 2 },
    g = grownBlocks(77, site, 400, null, 0.3),
    reach = (a: number) => {
      let r = 0;
      for (let b = 0; b < 400; b++) {
        const off = Math.atan2(g.z[b]!, g.x[b]!) - a;
        if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < 0.2)
          r = Math.max(r, Math.hypot(g.x[b]!, g.z[b]!));
      }
      return r;
    },
    roads = Math.min(reach(0.3), reach(2.9)),
    between = Math.max(reach(1.6), reach(-1.6));
  assert.ok(
    roads > between * 1.3,
    `${roads.toFixed(0)} m down its roads, ${between.toFixed(0)} m between`,
  );
  // (Its sprawl past the lots drawn is laid the same way.)
  assert.ok(reachToward(site, 0.3) > reachToward(site, 1.6) * 1.5);
  assert.equal(reachToward(null, 1), 1);
  const steep: TownSite = { ...SITE, roads: [], rise: 20, up: 0 };
  assert.ok(
    reachToward(steep, Math.PI / 2) > reachToward(steep, 0) * 1.4,
    "long across its hillside",
  );
  assert.ok(climb(steep, 0) > climb(steep, Math.PI / 2));
});
