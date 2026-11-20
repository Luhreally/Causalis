import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIELD_KEEP,
  QUARTER,
  QUARTERS,
  fieldHold,
  grownBlocks,
  outlineAt,
  outlineOf,
  quarterBearings,
  quarterOf,
  townLots,
  type GrownBlocks,
  type LandTown,
  formWhys,
  townForm,
  type FormFacts,
  type TownSite,
} from "../../src/bridge/index.ts";
import { LAND_ACROSS, landFields, type LandGround } from "../../src/view/index.ts";

// Asked 2026-11-20: the fields a town lives on hold it back. A field close in between its roads is worth the walk it saves,
// so the town builds along its roads before it builds over one: green reaches in toward its square between its fingers
// while it is young or middling, and is built over only once its roads are built along far past it, or its food comes by
// engine. Every block still falls in the quarter its turn gives it, and no block moves as the town grows.

const SITE: TownSite = {
  up: 0.6,
  rise: 3,
  lee: 2.4,
  roads: [
    { bearing: 0.3, busy: 4, rails: false, to: 1 },
    { bearing: 0.3 + Math.PI, busy: 1, rails: false, to: 2 },
  ],
  measured: -1,
  walled: null,
  dry: false,
};
const TILLED: TownSite = { ...SITE, tilled: { until: -1 } };
const SEED = 77;
/** A people on foot, as tests/view/town-form.test.ts has them. */
const FORM_FOOT: FormFacts = {
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

const grown = (site: TownSite, blocks: number) => grownBlocks(SEED, site, blocks, null, 0.3);
/** How far a block lies from the nearest of a site's roads in (metres from the road's own line; past its square). */
function offRoad(site: TownSite, x: number, z: number): number {
  let best = Infinity;
  for (const r of site.roads) {
    const along = x * Math.cos(r.bearing) + z * Math.sin(r.bearing);
    if (along > 0)
      best = Math.min(best, Math.abs(-x * Math.sin(r.bearing) + z * Math.cos(r.bearing)));
  }
  return best;
}
/**
 * Of a town's blocks: how many front a road in; how far its furthest ground lies, and its middling reach (of 72 bearings); and
 * the share of the round of its furthest reach that is not built on (`green`).
 */
function shape(site: TownSite, b: GrownBlocks) {
  let fronts = 0,
    far = 0;
  for (let k = 0; k < b.x.length; k++) {
    if (offRoad(site, b.x[k]!, b.z[k]!) < 30) fronts++;
    far = Math.max(far, Math.hypot(b.x[k]!, b.z[k]!));
  }
  const lots = townLots("lanes", SEED, 0.3, b.x.length * 8, null, site),
    outline = [...outlineOf(lots, b.x.length * 8)],
    most = Math.max(...outline);
  far = most;
  return {
    fronts,
    far,
    mid: [...outline].sort((p, q) => p - q)[36]!,
    green: 1 - outline.reduce((sum, r) => sum + r * r, 0) / outline.length / (most * most),
  };
}

test("a field's hold: the whole of it on level ground while food is walked in, less up a slope, none once engines carry it", () => {
  assert.equal(fieldHold(SITE, 40, 0), 0, "a land that sows none holds nothing");
  assert.equal(fieldHold({ ...TILLED, rise: 0 }, 40, 1), FIELD_KEEP);
  // (Up or down its slope a field is poorer: it holds less; along it, the whole.)
  const steep = { ...TILLED, rise: 30, up: 0 };
  assert.ok(fieldHold(steep, 40, 0) < 0.5 * FIELD_KEEP);
  assert.ok(Math.abs(fieldHold(steep, 40, Math.PI / 2) - FIELD_KEEP) < 1e-6);
  const engines = { ...TILLED, tilled: { until: 30 } };
  assert.ok(fieldHold(engines, 29, 0) > 0);
  assert.equal(fieldHold(engines, 30, 0), 0);
});

test("a young town whose land sows is built along its roads, green between them; one that sows none is as it was", () => {
  const bare = shape(SITE, grown(SITE, 30)),
    held = shape(TILLED, grown(TILLED, 30));
  assert.ok(
    held.fronts >= bare.fronts + 6,
    `${held.fronts} fronts on its roads against ${bare.fronts}`,
  );
  assert.ok(held.far > bare.far * 1.12, `its fingers reach ${held.far} m against ${bare.far}`);
  assert.ok(held.mid < bare.mid, `between them it reaches ${held.mid} m against ${bare.mid}`);
  assert.ok(
    held.green > bare.green + 0.12,
    `${held.green} of its round green against ${bare.green}`,
  );
  // Nothing moves where no field holds: the same site said again, a people who pass over their town.
  assert.deepEqual([...grown({ ...SITE }, 30).x], [...grown(SITE, 30).x]);
  const over = [{ from: 0, lane: 3, street: 3, verge: 0 }];
  assert.deepEqual(
    [...grown({ ...TILLED, laid: over }, 30).x],
    [...grown({ ...SITE, laid: over }, 30).x],
  );
});

test("held or not, a block falls in its turn's quarter and never moves as the town grows", () => {
  const b = grown(TILLED, 60),
    more = grown(TILLED, 140),
    { bearing, road } = quarterBearings(TILLED, null, 0.3);
  assert.deepEqual([...more.x.subarray(0, 60)], [...b.x]);
  assert.deepEqual([...more.z.subarray(0, 60)], [...b.z]);
  // The quarters with a meaning of their own (toward its water, its lee, its high ground) keep to their own ground: what
  // stands in them is read there (a mill by the water, a smithy in the lee). The rest may front its roads.
  let lent = 0;
  for (let k = 8; k < 140; k++) {
    const q = quarterOf(SEED, k),
      a = Math.atan2(more.z[k]!, more.x[k]!),
      off = Math.abs(Math.atan2(Math.sin(a - bearing[q]!), Math.cos(a - bearing[q]!)));
    if (q === QUARTER.water || q === QUARTER.lee || q === QUARTER.high || road[q]! >= 0)
      assert.ok(off < Math.PI / 8 + 0.85, `block ${k} of quarter ${q} lies ${off} off its bearing`);
    else if (offRoad(TILLED, more.x[k]!, more.z[k]!) < 30) lent++;
  }
  assert.ok(lent > 10, `${lent} blocks of the quarters between front a road`);
  // (No two blocks on one ground.)
  for (let i = 0; i < 140; i++)
    for (let j = i + 1; j < 140; j++)
      assert.ok(
        Math.hypot(more.x[i]! - more.x[j]!, more.z[i]! - more.z[j]!) > 27,
        `blocks ${i} and ${j} on one ground`,
      );
  assert.equal(QUARTERS, 8);
});

test("its fields are built over as its roads are built along far past them: a great town is filled, and one fed by engine fills at once", () => {
  const young = shape(TILLED, grown(TILLED, 30)),
    great = shape(TILLED, grown(TILLED, 600));
  // The ground built over off its roads lies nearer than its fingers by the field's worth: 0.6 of a finger's reach, less
  // FIELD_KEEP; so the share of its round a great town fills is the greater, and the nearer what it filled with none.
  const middling = shape(TILLED, grown(TILLED, 120)),
    bare = shape(SITE, grown(SITE, 600));
  assert.ok(middling.green > 0.7, `${middling.green} of a middling town's round is green`);
  assert.ok(
    great.green < middling.green - 0.03,
    `${great.green}, great, against ${middling.green}`,
  );
  assert.ok(
    great.mid / great.far > middling.mid / middling.far + 0.05,
    `${great.mid / great.far} against ${middling.mid / middling.far}`,
  );
  assert.ok(young.green > 0.6, `${young.green} of a young town's round is green`);
  assert.ok(Math.abs(great.mid - bare.mid) < 0.05 * bare.mid, `${great.mid} m against ${bare.mid}`);
  // Engines at its 30th block: what it takes after stands on fields no longer worth the walk.
  const fed: TownSite = { ...TILLED, tilled: { until: 30 } },
    walked = shape(TILLED, grown(TILLED, 120)),
    carried = shape(fed, grown(fed, 120));
  assert.deepEqual([...grown(fed, 30).x], [...grown(TILLED, 30).x], "the same until they come");
  assert.ok(carried.far < walked.far * 0.9, `${carried.far} m against ${walked.far}`);
  assert.ok(carried.green < walked.green - 0.08, `${carried.green} green against ${walked.green}`);
});

test("what its walls came to hold was built close: its fingers go out from its gates", () => {
  const walled: TownSite = { ...TILLED, walled: 240 },
    b = grown(walled, 90),
    open = grown(TILLED, 90),
    close = grown({ ...SITE, walled: 240 }, 90);
  // The blocks walled lie where they would with no field to hold them; what came after is held as any town's.
  assert.deepEqual([...b.x.subarray(0, 30)], [...close.x.subarray(0, 30)]);
  const far = (g: GrownBlocks, from: number, to: number) => {
    let r = 0;
    for (let k = from; k < to; k++) r = Math.max(r, Math.hypot(g.x[k]!, g.z[k]!));
    return r;
  };
  assert.ok(
    far(b, 0, 30) < far(open, 0, 30) - 20,
    `${far(b, 0, 30)} m against ${far(open, 0, 30)}`,
  );
  assert.ok(
    far(b, 30, 90) > far(close, 30, 90) * 1.15,
    `${far(b, 30, 90)} against ${far(close, 30, 90)}`,
  );
});

test("ground cut into equal blocks is no one's field: its measured blocks are not held back, and its page says so", () => {
  // (Measured from its founding: the lattice its realm's clerks cut is taken nearest the square first, fields or none.)
  const surveys = [{ from: 0, order: 0.6 }],
    cut: TownSite = { ...TILLED, surveys },
    bare: TownSite = { ...SITE, surveys },
    a = grown(cut, 80),
    b = grown(bare, 80);
  let measured = 0;
  for (let k = 0; k < 80; k++)
    if (a.straight[k]) {
      measured++;
      assert.equal(a.x[k], b.x[k], `measured block ${k} where it would stand with no field`);
      assert.equal(a.z[k], b.z[k]);
    }
  assert.ok(measured > 40, `${measured} measured blocks`);
  const form = townForm(FORM_FOOT),
    said = (see: Parameters<typeof formWhys>[2]) => formWhys(form, undefined, see).join(" ");
  assert.match(
    said({ walled: false, surveys, tilled: { fed: -1, roads: 2 } }),
    /no field holds its measured streets back/,
  );
  assert.doesNotMatch(
    said({ walled: false, surveys: [{ from: 0, order: 0.1 }], tilled: { fed: -1, roads: 2 } }),
    /measured streets/,
  );
  assert.doesNotMatch(
    said({ walled: false, surveys }),
    /measured streets/,
    "no fields, nothing to say",
  );
});

test("the land's map lays its fields in the green between its fingers, nearer its square than its fingers reach", () => {
  const size = 16,
    n = size * size,
    g: LandGround = {
      size,
      tileKm: 1,
      heights: new Float32Array(n).fill(0.1),
      water: new Uint8Array(n),
      fertility: new Uint8Array(n).fill(160),
    },
    b = grown(TILLED, 40),
    lots = townLots("lanes", SEED, 0.3, 320, null, TILLED),
    outline = outlineOf(lots, 320),
    edge = (a: number) => outlineAt(outline, a) * LAND_ACROSS,
    far = Math.max(...outline) * LAND_ACROSS,
    town = {
      ref: "town:0:1",
      name: "T",
      tile: 8 * size + 8,
      population: 2400,
      founded: 1,
      city: false,
      fields: true,
      plan: null,
      key: 1,
    } as LandTown,
    fields = landFields(g, town, 8.5, 8.5, far, [], new Map(), edge),
    within = fields.filter((f) => Math.hypot(f.x - 8.5, f.z - 8.5) < 0.7 * far);
  assert.equal(b.x.length, 40);
  assert.ok(fields.length > 20, `${fields.length} fields`);
  assert.ok(
    within.length >= 8,
    `${within.length} fields within seven tenths of its fingers' reach`,
  );
  // None on its ground: each past its outline toward its own bearing.
  for (const f of fields) {
    const dx = f.x - 8.5,
      dz = f.z - 8.5;
    assert.ok(Math.hypot(dx, dz) >= edge(Math.atan2(dz, dx)), "a field on its lots");
  }
});
