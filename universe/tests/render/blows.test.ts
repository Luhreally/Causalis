// The blows drawn (Phase 55): the poses of the struck and where their wounds go — geometry alone,
// no GPU needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FALL_LONG, figureOf, type FigureAnatomy, type TrooperNow } from "../../src/view/index.ts";
import {
  FALL_KEYS,
  STUMP,
  blowPose,
  clutchOf,
  fallPose,
  limbOfPose,
  looseOf,
  newPose,
  placeBit,
  placeMasks,
  posedAt,
  shaftWay,
  stumpOf,
  turned,
} from "../../src/render/blows.ts";

const near = (a: number, b: number, what = "") =>
  assert.ok(Math.abs(a - b) < 1e-9, `${what} ${a} ≈ ${b}`);
const one = (over: Partial<TrooperNow>): TrooperNow => ({
  id: 7,
  side: 0,
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  act: "stand",
  cycle: 0,
  down: 0,
  back: false,
  size: 1,
  bearer: false,
  crawl: 0,
  ...over,
});
// An upright ape at the finer setting (view/blows.ts's figureAnatomy of it, written out).
const APE = figureOf(null, 1).parts;
const ANATOMY: FigureAnatomy = {
  parts: {
    head: [1],
    trunk: [0],
    "arm-l": [3, 7],
    "arm-r": [2, 6],
    "hand-l": [7],
    "hand-r": [6],
    "leg-l": [5, 9],
    "leg-r": [4, 8],
  },
  on: {
    head: 1,
    trunk: 0,
    "arm-l": 3,
    "arm-r": 2,
    "hand-l": 7,
    "hand-r": 6,
    "leg-l": 5,
    "leg-r": 4,
  },
};

test("each fall goes from standing to its last pose over its time, a crumple onto the back where it lies so", () => {
  for (const fell of ["buckle", "crumple", "thrown", "blasted"] as const) {
    const keys = FALL_KEYS[fell],
      first = keys[0]!,
      last = keys[keys.length - 1]!,
      p0 = fallPose(fell, 0, false, newPose()),
      p1 = fallPose(fell, FALL_LONG[fell] + 5, false, newPose());
    assert.deepEqual(
      [p0.lean, p0.sink, p0.armR, p0.armL, p0.legR, p0.legL],
      first.slice(1),
      `${fell} at first`,
    );
    assert.deepEqual(
      [p1.lean, p1.sink, p1.armR, p1.armL, p1.legR, p1.legL],
      last.slice(1),
      `${fell} at last`,
    );
    // (Lying flat at the end: no sink, the body down.)
    assert.equal(last[2], 0);
    assert.ok(Math.abs(last[1]) > 1.4);
  }
  // A leg giving way: on the knees a third of the way down.
  const knees = fallPose("buckle", FALL_LONG.buckle * 0.35, false, newPose());
  assert.deepEqual([knees.lean, knees.sink, knees.legR, knees.legL], [0.25, 0.45, -0.99, 0.99]);
  // (Forward onto the face; a crumple onto the back when it lies on its back.)
  assert.ok(fallPose("buckle", 9, false, newPose()).lean > 0);
  near(fallPose("crumple", 9, true, newPose()).lean, -1.47);
  near(fallPose("crumple", 9, false, newPose()).lean, 1.47);
  assert.ok(fallPose("thrown", 9, false, newPose()).lean < 0);
});

test("the wounded who live are posed by what they are at, clutching where they were struck", () => {
  const p = newPose();
  assert.ok(blowPose(one({ act: "kneel", down: 1, hit: "trunk" }), p));
  assert.deepEqual(
    { ...p },
    { lean: 0.3, sink: 0.45, armR: -0.7, armL: -0.6, legR: -0.99, legL: 0.99 },
  );
  assert.ok(blowPose(one({ act: "sit", down: 1, hit: "head" }), p));
  assert.deepEqual(
    { ...p },
    {
      lean: -0.15,
      sink: 0.86,
      armR: -2.5,
      armL: -2.5,
      legR: -1.42,
      legL: -1.42,
    },
  );
  assert.deepEqual(clutchOf("arm-r"), [0.05, -0.75]);
  assert.deepEqual(clutchOf("hand-l"), [-0.75, 0.05]);
  // Reeling: back and up again over the stagger, the hands reaching the wound.
  assert.ok(blowPose(one({ act: "stagger", since: 0.3, hit: "trunk" }), p));
  near(p.lean, -0.35);
  assert.ok(blowPose(one({ act: "stagger", since: 0.6, hit: "trunk" }), p));
  near(p.lean, 0);
  near(p.armR, -0.7);
  // Propped: the left arm over the shoulders of the one who helps.
  assert.ok(blowPose(one({ act: "propped", hit: "leg-r", cycle: 0.1 }), p));
  assert.equal(p.armL, -2.3);
  assert.ok(Math.abs(p.legR) < Math.abs(p.legL), "a short step on the struck leg");
  assert.ok(blowPose(one({ act: "slump" }), p));
  assert.equal(p.lean, 0.65);
  // The battle's own poses serve the rest, and the fallen with no fall of their own.
  for (const act of ["stand", "march", "fight", "flee", "prone"] as const)
    assert.equal(blowPose(one({ act }), newPose()), false, act);
  assert.equal(blowPose(one({ act: "fall", down: 1 }), newPose()), false);
  assert.ok(blowPose(one({ act: "fall", down: 1, fell: "thrown", since: 9, back: true }), p));
  near(p.lean, -1.47);
  // (Each limb takes its side's swing: the figure's right is −x.)
  const kneel = newPose();
  blowPose(one({ act: "kneel", down: 1, hit: "arm-r" }), kneel);
  assert.equal(limbOfPose(APE[2]!, kneel), 0.05);
  assert.equal(limbOfPose(APE[3]!, kneel), -0.75);
  assert.equal(limbOfPose(APE[4]!, kneel), -0.99);
  assert.equal(limbOfPose(APE[9]!, kneel), 0.99);
});

test("a point of a part posed as the battle poses its limbs: an arm held out level puts the hand ahead at the shoulder", () => {
  const arm = APE[2]!,
    out = { x: 0, y: 0, z: 0 };
  // The arm's lower end, swung forward a right angle: level with the shoulder (0.42), 0.19 ahead.
  posedAt(arm, -Math.PI / 2, 0, 0, -0.1, 0, out);
  near(out.x, -0.105);
  near(out.y, 0.42);
  near(out.z, 0.19);
  // Unswung, its middle is where the part stands; the front of its face 0.025 ahead.
  posedAt(arm, 0, 0, 0, 0, 0.025, out);
  near(out.y, 0.33);
  near(out.z, 0.025);
  // The whole tipped forward a right angle about the feet: up becomes ahead.
  posedAt(APE[0]!, 0, Math.PI / 2, 0, 0, 0, out);
  near(out.y, 0);
  near(out.z, 0.335);
});

test("a stump where the part was cut off, and the part lying apart", () => {
  const parts = APE,
    stump = (lost: Parameters<typeof stumpOf>[2]) => {
      const st = stumpOf(ANATOMY, parts, lost)!;
      return { ...st, cut: Math.round(st.cut * 1e9) / 1e9 };
    };
  // A hand's at its arm's end, the whole arm left; a head's on the trunk's top.
  assert.deepEqual(stump("hand-r"), {
    part: 2,
    end: -1,
    cut: -0.1,
    keep: 1,
    wide: 0.045,
    deep: 0.05,
  });
  assert.deepEqual(stump("head"), { part: 0, end: 1, cut: 0.1, keep: 1, wide: 0.11, deep: 0.11 });
  // An arm's or a leg's: STUMP.keep of it left from the shoulder or the hip, its raw end below.
  assert.equal(STUMP.keep, 0.35);
  assert.deepEqual(stump("arm-l"), {
    part: 3,
    end: -1,
    cut: 0.03,
    keep: 0.35,
    wide: 0.045,
    deep: 0.05,
  });
  assert.deepEqual(stump("leg-r"), {
    part: 4,
    end: -1,
    cut: 0.036,
    keep: 0.35,
    wide: 0.065,
    deep: 0.07,
  });
  // The arm lying apart: the rest of it, and its hand, below the cut.
  const arm = looseOf(ANATOMY, parts, "arm-r")!;
  assert.deepEqual(arm.parts, [2, 6]);
  assert.equal(arm.short, 0.65);
  near(arm.from[0]![1], -0.065, "the rest of the arm's middle below the cut");
  near(arm.from[1]![1], -0.145, "the hand's");
  near(arm.lie, 0.0325);
  const head = looseOf(ANATOMY, parts, "head")!;
  assert.deepEqual(head.parts, [1]);
  assert.equal(head.short, 1);
  near(head.from[0]![1], 0.055, "the head's middle above the neck");
  // A figure with no arms has none to lose.
  const none: FigureAnatomy = {
    parts: { ...ANATOMY.parts, "arm-r": [], "hand-r": [] },
    on: { ...ANATOMY.on, "arm-r": -1, "hand-r": -1 },
  };
  assert.equal(stumpOf(none, parts, "arm-r"), null);
  assert.equal(looseOf(none, parts, "hand-r"), null);
});

test("which parts go with a place cut off", () => {
  const masks = placeMasks(ANATOMY, APE.length);
  assert.deepEqual([...masks], [2, 1, 8, 4, 128, 64, 40, 20, 128, 64]);
  assert.ok(
    masks[6]! & placeBit("hand-r") && masks[6]! & placeBit("arm-r"),
    "a hand goes with its arm",
  );
  assert.equal(masks[2]! & placeBit("hand-r"), 0, "an arm stays when its hand is cut off");
});

test("a shaft sticks out back along its flight, tipped and turned with the one it is in", () => {
  const d = shaftWay(Math.PI, 0, { x: 0, y: 0, z: 0 });
  near(d.x, 0);
  near(d.y, 0);
  near(d.z, 1);
  const up = shaftWay(Math.PI, 0.75, { x: 0, y: 0, z: 0 });
  near(up.y, Math.sin(0.75));
  // Facing +x (yaw a right angle): ahead of them is +x.
  const w = turned({ x: 0, y: 0, z: 1 }, 0, Math.PI / 2, { x: 0, y: 0, z: 0 });
  near(w.x, 1);
  near(w.z, 0);
  // Lying on their back (tipped back a right angle): what pointed ahead points up.
  const lying = turned({ x: 0, y: 0, z: 1 }, -Math.PI / 2, 0, {
    x: 0,
    y: 0,
    z: 0,
  });
  near(lying.y, 1);
});
