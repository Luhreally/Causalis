import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLOCK_D,
  BLOCK_W,
  TIER,
  formWhys,
  grownBlocks,
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
  // (As many blocks on less ground.)
  const reach = (b: { x: Float32Array; z: Float32Array }) =>
    Math.max(...[...b.x].map((x, i) => Math.hypot(x, b.z[i]!)));
  assert.ok(reach(swim) < reach(walk) - 10, `${reach(swim)} against ${reach(walk)}`);
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
    walls = heights(tall, (k) => k === "box|0.700|0.690|0.650");
  assert.ok(walls.length >= 800);
  assert.ok(walls.at(-1)! > 30 && walls[0]! < 26, `${walls[0]} to ${walls.at(-1)}`);
  const scene = townScene(planOf(FOOT, 800, 4), t),
    near = scene.formLooks,
    high = (p: number) => 0.55 + (scene.tiers![p]! >> 2) * 0.1;
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
