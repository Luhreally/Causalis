// A creature built from its body plan (Phase 9 M85): no fixed shapes — each lineage's body
// is made of what its plan says it has. Its segments in a row (a torso; a fore and hind body;
// three for a many-legged body), its legs in pairs along it (splayed wide on a crawler, under
// the hind body of a two-legged strider), its neck and head, its tail, its wings or fins, its
// covering (wool fluffs it, a shell domes it, plates ridge it), and what it grows — horns,
// antlers, tusks, a trunk, a hump, a mane, a crest, spines, claws, a beak. It moves as it
// moves: a walker's legs in diagonal pairs, a crawler's in a wave, a hopper bounding, a
// slitherer's body waving side to side, a flier's wings beating, a swimmer's tail sweeping.
// Built of boxes, the art track's low-poly, in a village's units and drawn as much larger than
// life as its people are (the smallest larger still, to be seen at all).
import type { CreatureBody } from "../rules/index.ts";

/** A part of a creature as it stands this moment, in its own frame (facing +z), drawn units. */
export type BeastPart = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  /** Tipped about its own x axis, after turned `yaw` about its up axis from the beast's facing. */
  pitch: number;
  yaw: number;
  /** 0 its coat, 1 its dark features (hooves, claws, manes, markings), 2 horn, tusk and beak. */
  tone: 0 | 1 | 2;
};

/** How a creature holds itself now: its gait (0 still, 1 moving, 2 fast), stride phase, head (0 up … 1 down to its food), crouch (0 … 1). */
export type Pose = { gait: 0 | 1 | 2; phase: number; head: number; crouch: number };

/** The drawing's scale: a grown upright ape (1.7 m) stands 0.55 high, so a metre is this. */
export const BEAST_SCALE = 0.55 / 1.7;

/** The most parts any creature is drawn with in any pose, all told and of each tone (so batches can be sized). */
export const MOST_PARTS = 48;
export const MOST_OF_TONE = [40, 30, 12] as const;

/** A creature's body as built from its plan: its measures (metres) and what it has. */
export type Built = {
  readonly plan: CreatureBody;
  /** Metres to drawn units. */
  readonly k: number;
  /** Body length, height and width; leg length; neck and head; tail. */
  readonly length: number;
  readonly height: number;
  readonly width: number;
  readonly leg: number;
  readonly neck: number;
  readonly head: number;
  readonly tail: number;
  /** How finely it is built (the setting's detail, 0 … 3). */
  readonly detail: number;
  /** Its pattern's marks, if its coat is spotted or brindled (body-box units). */
  readonly marks: readonly (readonly [number, number, number])[];
  readonly pattern: "spots" | "stripes" | null;
};

const unit = (key: number, i: number, j: number) => {
  // (A small keyed hash, for the marks' places.)
  let h = (key ^ (i * 0x9e3779b1) ^ (j * 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Strides a second at its easy pace, by how it moves (smaller bodies step quicker). */
export function strideOf(b: Built): number {
  const base =
    b.plan.moves === "crawl"
      ? 2.2
      : b.plan.moves === "hop"
        ? 1.7
        : b.plan.moves === "fly"
          ? 3
          : b.plan.moves === "swim"
            ? 1.2
            : b.plan.moves === "slither"
              ? 0.8
              : b.plan.moves === "run"
                ? 1.4
                : 1.2;
  return base * Math.min(1.8, Math.max(0.55, Math.pow(b.plan.size / 200, -0.12)));
}

/** Build a creature from its plan: its measures, finer at a finer `detail`. */
export function buildBody(
  plan: CreatureBody,
  detail: number,
  pattern: "spots" | "stripes" | null = null,
  key = 0,
): Built {
  // Length by weight (a 200 kg beast some 1.5 m long); the smallest drawn as a hare at least.
  const s = Math.max(0.26, Math.cbrt(plan.size / 200)),
    swim = plan.moves === "swim",
    many = plan.legs >= 6,
    stocky = plan.level >= 3 && plan.moves === "walk",
    length = 1.5 * s * (swim ? 1.15 : plan.moves === "slither" ? 1.8 : 1),
    height =
      length *
      (swim ? 0.3 : many ? 0.28 : plan.moves === "slither" ? 0.16 : 0.42) *
      (stocky ? 1.15 : 1),
    width =
      length *
      (swim ? 0.22 : many ? 0.5 : plan.moves === "slither" ? 0.16 : 0.36) *
      (stocky ? 1.25 : 1),
    leg =
      plan.legs === 0
        ? 0
        : length *
          (plan.legs === 2 ? (plan.moves === "fly" ? 0.18 : 0.62) : many ? 0.34 : 0.55) *
          (plan.moves === "run" ? 1.1 : stocky ? 0.7 : 1),
    marks: [number, number, number][] = [];
  if (pattern && detail >= 2)
    for (let i = 0; i < (pattern === "spots" ? 6 : 4); i++)
      marks.push([
        unit(key, i, 1) < 0.5 ? -1 : 1,
        (unit(key, i, 2) - 0.5) * 0.6,
        pattern === "stripes" ? -0.35 + (0.7 * i) / 3 : (unit(key, i, 3) - 0.5) * 0.8,
      ]);
  return {
    plan,
    k: BEAST_SCALE,
    length,
    height,
    width,
    leg,
    neck: length * plan.neck * 0.8,
    head: length * (plan.level >= 3 ? 0.3 : 0.26),
    tail: length * plan.tail * 0.8,
    detail,
    marks,
    pattern,
  };
}

/** Where each foot came down, as the legs were posed (reused: posing allocates nothing). */
const FEET = Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0, t: 0 }));

/**
 * Pose a creature: its parts this moment, written into `out` (reused; returns how many).
 * Its body first (a chest and a haunch; a row of segments; a fish's body tapering to its
 * tail), then its legs (jointed at the knee, the foot lifted as it swings forward; a
 * crawler's up from its side and down to the ground, as a spider's), wings, fins and tail,
 * its neck and head and what grows on them, and last its finest touches — hooves, ears,
 * eyes, a tail's tuft, the marks of its coat.
 */
export function posed(b: Built, pose: Pose, out: BeastPart[]): number {
  const p = b.plan,
    k = b.k,
    has = (x: string) => p.features.includes(x as never);
  let n = 0;
  const put = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    pitch: number,
    tone: 0 | 1 | 2,
    yaw = 0,
  ) => {
    if (n >= MOST_PARTS) return;
    const o =
      out[n] ?? (out[n] = { x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0, pitch: 0, yaw: 0, tone: 0 });
    o.x = x * k;
    o.y = y * k;
    o.z = z * k;
    o.sx = sx * k;
    o.sy = sy * k;
    o.sz = sz * k;
    o.pitch = pitch;
    o.yaw = yaw;
    o.tone = tone;
    n++;
  };
  const L = b.length,
    wool = p.covering === "wool",
    furred = wool || p.covering === "fur",
    W = b.width + (wool ? 0.12 * L : 0),
    H = b.height + (wool ? 0.1 * L : 0),
    fly = p.moves === "fly",
    swim = p.moves === "swim",
    slither = p.moves === "slither",
    many = p.legs >= 6,
    fine = b.detail >= 1,
    finer = b.detail >= 2,
    moving = pose.gait > 0,
    bob =
      pose.gait === 2 || (p.moves === "hop" && moving)
        ? 0.12 * H * Math.abs(Math.sin(pose.phase))
        : 0,
    sink = pose.crouch * b.leg * 0.35,
    // (A crawler's body hangs low between its legs.)
    belly = (fly || swim ? 0 : many ? b.leg * 0.55 : b.leg) - sink + bob,
    cy = belly + H / 2;

  // A radial body: a disc and its arms.
  if (p.symmetry === "radial") {
    put(0, cy, 0, L * 0.6, H, L * 0.6, 0, 0);
    for (let a = 0; a < 5; a++) {
      const turn = (a / 5) * 2 * Math.PI + 0.2 * Math.sin(pose.phase + a);
      put(
        Math.sin(turn) * L * 0.45,
        cy,
        Math.cos(turn) * L * 0.45,
        W * 0.3,
        H * 0.6,
        L * 0.5,
        0,
        0,
        turn,
      );
    }
    return n;
  }

  // The body.
  if (slither) {
    // A row of segments, narrowing to the tail, waving from side to side as it goes.
    const segs = finer ? 6 : 4;
    for (let i = 0; i < segs; i++) {
      const len = L / segs,
        taper = 1 - (0.4 * i) / (segs - 1),
        wave =
          Math.sin(pose.phase * (moving ? 1 : 0.2) + i * 1.1) *
          W *
          1.2 *
          (0.35 + (0.65 * i) / (segs - 1));
      put(
        wave,
        belly + (H * taper) / 2,
        L / 2 - len * (i + 0.5),
        W * taper,
        H * taper,
        len * 1.05,
        0,
        0,
      );
    }
  } else if (swim) {
    // Deep at the shoulders, tapering to the tail.
    put(0, cy, L * 0.2, W, H, L * 0.6, 0, 0);
    put(0, cy + H * 0.04, -L * 0.25, W * 0.58, H * 0.66, L * 0.5, 0, 0);
  } else if (p.segments === 1 && fine && !fly) {
    // A chest and a haunch.
    put(0, cy + H * 0.03, L * 0.21, W, H, L * 0.58, 0, 0);
    put(0, cy - H * 0.02, -L * 0.25, W * 0.94, H * 0.92, L * 0.5, 0, 0);
  } else {
    const segs = p.segments,
      shares = segs === 1 ? [1] : segs === 2 ? [0.42, 0.58] : [0.26, 0.3, 0.44];
    let at = L / 2;
    shares.forEach((share, i) => {
      const len = L * share,
        bulk = segs === 1 ? 1 : 0.85 + 0.3 * (i / Math.max(1, segs - 1)),
        shell = p.covering === "shell" && i === segs - 1;
      put(
        0,
        cy + (shell ? H * 0.1 : 0),
        at - len / 2,
        W * bulk,
        H * bulk * (shell ? 1.3 : 1),
        len * 0.96,
        0,
        0,
      );
      at -= len;
    });
  }
  // Plates ridge its back; spines stand along it; a hump.
  if (fine && p.covering === "plates")
    for (let i = 0; i < 3; i++)
      put(0, cy + H * 0.55, L * (0.3 - 0.3 * i), W * 0.7, H * 0.18, L * 0.22, 0.2, 1);
  if (fine && has("spines"))
    for (let i = 0; i < 4; i++)
      put(0, cy + H * 0.7, L * (0.3 - 0.2 * i), W * 0.08, H * 0.5, L * 0.05, -0.3, 2);
  if (has("hump")) put(0, belly + H + 0.1 * L, 0, W * 0.55, H * 0.5, L * 0.35, 0, 0);

  // The legs, in pairs along the body.
  const pairs = p.legs / 2,
    swing = fly ? 0 : pose.gait === 2 ? 0.75 : pose.gait === 1 ? 0.4 : 0,
    legTone: 0 | 1 = wool ? 1 : 0;
  let nf = 0;
  for (let i = 0; i < pairs; i++) {
    const along =
      pairs === 1 ? (fly ? 0 : -L * 0.12) : L * (0.36 - (0.72 * i) / Math.max(1, pairs - 1));
    for (const side of [-1, 1]) {
      const ph = many
        ? pose.phase + i * 0.9 + (side > 0 ? Math.PI : 0)
        : p.moves === "hop"
          ? pose.phase
          : pose.phase + (side === (i % 2 ? 1 : -1) ? 0 : Math.PI);
      if (many) {
        // Up from its side to the knee, and down to the ground: swept fore and aft as it
        // goes, lifted as it swings forward.
        const lean = 0.55 * (along / (L / 2)) + (moving ? 0.35 * Math.sin(ph) : 0),
          yaw = side * (Math.PI / 2 - lean),
          ox = Math.sin(yaw),
          oz = Math.cos(yaw),
          lift = moving ? 0.35 * b.leg * Math.max(0, Math.cos(ph)) : 0,
          rise = 0.75,
          femur = b.leg * 0.95,
          thick = Math.min(W * 0.18, 0.04 * L + 0.02),
          hx = side * W * 0.42,
          hy = cy,
          kx = hx + ox * femur * Math.cos(rise),
          ky = hy + femur * Math.sin(rise) + lift,
          kz = along + oz * femur * Math.cos(rise),
          drop = Math.max(0.02, ky - lift * 0.8),
          reach = drop * 0.35,
          tibia = Math.hypot(drop, reach),
          fx = kx + ox * reach,
          fz = kz + oz * reach;
        put(
          (hx + kx) / 2,
          (hy + ky) / 2,
          (along + kz) / 2,
          thick * 1.2,
          femur,
          thick * 1.2,
          Math.PI / 2 - rise,
          0,
          yaw,
        );
        put(
          (kx + fx) / 2,
          (ky + lift * 0.8) / 2,
          (kz + fz) / 2,
          thick,
          tibia,
          thick,
          -Math.atan2(reach, drop),
          1,
          yaw,
        );
        continue;
      }
      const a = swing * Math.sin(ph),
        // (The foot tucks back as the leg swings forward.)
        lift = moving && !fly ? (pose.gait === 2 ? 1.1 : 0.8) * Math.max(0, -Math.cos(ph)) : 0,
        x = side * (W / 2 - Math.min(W, 0.09 * L) * 0.6),
        hipY = fly ? belly + H * 0.3 : belly + H * 0.2,
        reach = fly ? b.leg + H * 0.3 : Math.max(0.02, hipY),
        thick =
          Math.min(W * 0.28, 0.05 * L + 0.02) *
          (p.size > 2000 ? 1.6 : 1) *
          (fly ? 0.5 : p.level >= 3 && p.moves === "walk" ? 1.5 : 1);
      if (!fine || fly) {
        const tuck = fly ? 0.7 : 0;
        put(
          x,
          hipY - (reach / 2) * Math.cos(a + tuck),
          along - (reach / 2) * Math.sin(a + tuck),
          thick,
          reach,
          thick,
          a + tuck,
          legTone,
        );
        continue;
      }
      const upper = reach * 0.48,
        lower = reach * 0.52,
        ky = hipY - upper * Math.cos(a),
        kz = along - upper * Math.sin(a),
        c = a + lift;
      put(
        x,
        hipY - (upper / 2) * Math.cos(a),
        along - (upper / 2) * Math.sin(a),
        thick * 1.45,
        upper + thick * 0.5,
        thick * 1.3,
        a,
        legTone,
      );
      put(
        x,
        ky - (lower / 2) * Math.cos(c),
        kz - (lower / 2) * Math.sin(c),
        thick,
        lower,
        thick,
        c,
        legTone,
      );
      const foot = FEET[nf++]!;
      foot.x = x;
      foot.y = ky - lower * Math.cos(c);
      foot.z = kz - lower * Math.sin(c);
      foot.t = thick;
    }
  }

  // Wings: an inner and an outer part each, beating (the outer bending further), or held
  // out still as it glides.
  if (p.wings) {
    const beat = moving ? 0.5 * Math.sin(pose.phase * 3) - 0.05 : -0.12,
      span = L * 1.4,
      inner = fine ? span * 0.48 : span,
      chord = L * 0.5,
      shoulder = cy + H * 0.25;
    for (const side of [-1, 1])
      for (let w = 0; w < p.wings / 2; w++) {
        const z0 = L * (0.1 - 0.3 * w),
          yaw = (side * Math.PI) / 2,
          ex = W / 2 + Math.cos(beat) * inner,
          ey = shoulder - Math.sin(beat) * inner;
        put(
          side * (W / 2 + (Math.cos(beat) * inner) / 2),
          shoulder - (Math.sin(beat) * inner) / 2,
          z0,
          chord,
          0.04 * L,
          inner,
          beat,
          0,
          yaw,
        );
        if (fine) {
          const bend = beat * 1.3,
            outer = span * 0.55;
          put(
            side * (ex + (Math.cos(bend) * outer) / 2),
            ey - (Math.sin(bend) * outer) / 2,
            z0 - chord * 0.08,
            chord * 0.78,
            0.035 * L,
            outer,
            bend,
            0,
            yaw,
          );
        }
      }
  }
  // Fins at a swimmer's sides.
  if (p.fins)
    for (let i = 0; i < p.fins / 2; i++)
      for (const side of [-1, 1])
        put(
          side * (W / 2 + L * 0.08),
          cy - H * 0.2,
          L * (0.15 - 0.3 * i),
          L * 0.18,
          0.03 * L,
          L * 0.14,
          0,
          1,
          side * 0.5,
        );

  // The tail: a swimmer's fin sweeping, a flier's fan behind it, a walker's hanging, a
  // two-legged strider's held out to balance.
  if (swim) {
    const sway = 0.5 * Math.sin(pose.phase * 2);
    put(
      Math.sin(sway) * L * 0.1,
      cy + H * 0.04,
      -L / 2 - L * 0.1,
      0.03 * L,
      H * 1.15,
      L * 0.26,
      0,
      0,
      sway,
    );
    if (fine) put(0, cy + H * 0.62, L * 0.02, 0.02 * L, H * 0.4, L * 0.3, -0.35, 1);
  } else if (fly) {
    if (fine) put(0, cy + H * 0.1, -L / 2 - b.tail * 0.4, W * 0.9, 0.03 * L, b.tail, 0.12, 0);
  } else if (fine && b.tail > 0.02 && !slither) {
    const sway = slither ? 0 : 0.15 * Math.sin(pose.phase),
      lift = p.legs === 2 ? Math.PI * 0.62 : Math.PI + 0.4 + (pose.gait === 2 ? 0.4 : 0),
      base = { y: cy + H * 0.2, z: -L / 2 },
      thick = Math.max(0.03 * L, W * 0.12);
    put(
      0,
      base.y + (Math.cos(lift) * b.tail) / 2,
      base.z + (Math.sin(lift) * b.tail) / 2,
      thick,
      b.tail,
      thick,
      lift,
      1,
      sway,
    );
    if (finer && furred && !slither)
      put(
        0,
        base.y + Math.cos(lift) * b.tail,
        base.z + Math.sin(lift) * b.tail,
        thick * 1.8,
        0.14 * L,
        thick * 1.8,
        lift,
        1,
        sway,
      );
  }

  // The neck and head: bowed to its food as it grazes, lifted as it watches, low as it stalks.
  const flat = swim || slither,
    neck = b.neck,
    head = b.head,
    baseY = cy + H * 0.12,
    baseZ = L / 2 - Math.min(neck, W) * 0.2,
    lean = flat
      ? Math.PI / 2
      : 0.5 +
        (Math.min(2.6, 0.9 + (b.leg + H) / Math.max(0.05, neck + head)) - 0.5) * pose.head -
        pose.crouch * 0.3,
    ny = Math.cos(lean),
    nz = Math.sin(lean);
  if (neck > 0.02 && !flat)
    put(
      0,
      baseY + (ny * neck) / 2,
      baseZ + (nz * neck) / 2,
      W * 0.4,
      neck + W * 0.2,
      W * 0.4,
      lean,
      0,
    );
  const topY = flat ? (slither ? belly + H / 2 : cy) : baseY + ny * neck,
    topZ = flat ? L / 2 : baseZ + nz * neck,
    tip = flat ? Math.PI / 2 : 0.3 + 1.1 * pose.head + pose.crouch * 0.2,
    hy = topY - (Math.sin(tip - (flat ? Math.PI / 2 : 0)) * head) / 2,
    hz = topZ + (Math.cos(tip - (flat ? Math.PI / 2 : 0)) * head) / 2,
    hw = W * (swim ? 0.8 : p.level >= 3 ? 0.62 : 0.5),
    hh = H * (swim ? 0.8 : 0.55),
    pitchHead = flat ? 0 : tip;
  put(0, hy, hz, hw, hh, head, pitchHead, 0);
  /** A part fixed to the head: (x, y, z) in the head's frame, turned as it is. */
  const onHead = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    pitch: number,
    tone: 0 | 1 | 2,
  ) =>
    put(
      x,
      hy + y * Math.cos(pitchHead) - z * Math.sin(pitchHead),
      hz + y * Math.sin(pitchHead) + z * Math.cos(pitchHead),
      sx,
      sy,
      sz,
      pitchHead + pitch,
      tone,
    );
  if (fine && !has("beak") && !swim)
    onHead(0, -hh * 0.12, head * 0.42, hw * 0.8, hh * 0.6, head * 0.22, 0, 1);
  if (has("horns"))
    for (const s of [-1, 1])
      onHead(s * hw * 0.32, hh * 0.62, -head * 0.2, 0.05 * L, hh * 0.7, 0.05 * L, -0.5, 2);
  if (has("wide-horns")) onHead(0, hh * 0.45, -head * 0.15, hw * 2.4, 0.06 * L, 0.08 * L, 0, 2);
  if (has("antlers"))
    for (const s of [-1, 1]) {
      onHead(s * hw * 0.35, hh * 0.9, -head * 0.15, 0.03 * L, hh * 1.4, 0.03 * L, -0.25, 2);
      onHead(s * hw * 0.6, hh * 1.4, -head * 0.2, 0.03 * L, hh * 0.7, 0.03 * L, 0.3, 2);
    }
  if (has("tusks"))
    for (const s of [-1, 1])
      onHead(s * hw * 0.3, -hh * 0.35, head * 0.55, 0.06 * L, 0.06 * L, head * 1.1, 0.5, 2);
  if (has("trunk")) onHead(0, -hh * 0.6, head * 0.45, hw * 0.24, hh * 1.3, hw * 0.24, 0.2, 0);
  if (has("beak")) onHead(0, -hh * 0.1, head * 0.62, hw * 0.3, hh * 0.25, head * 0.45, 0.15, 2);
  if (has("crest")) onHead(0, hh * 0.7, -head * 0.1, 0.03 * L, hh * 0.8, head * 0.8, -0.2, 1);
  if (finer && has("mane") && neck > 0.02)
    put(
      0,
      baseY + (ny * neck) / 2 + W * 0.18,
      baseZ + (nz * neck) / 2 - W * 0.12,
      W * 0.3,
      neck,
      W * 0.45,
      lean,
      1,
    );
  if (finer && has("mane") && neck <= 0.02)
    onHead(0, hh * 0.2, -head * 0.5, hw * 1.4, hh * 1.3, head * 0.3, 0, 1);

  // The finest touches: hooves and paws, ears, eyes, the marks of its coat.
  if (finer)
    for (let i = 0; i < nf; i++) {
      const f = FEET[i]!;
      put(f.x, f.y + 0.03 * L, f.z + f.t * 0.15, f.t * 1.25, 0.06 * L, f.t * 1.35, 0, 1);
    }
  if (fine && furred && !fly)
    for (const s of [-1, 1])
      onHead(s * hw * 0.4, hh * 0.62, -head * 0.3, hw * 0.26, hh * 0.45, 0.05 * L, -0.25, 0);
  if (finer)
    for (const s of [-1, 1])
      onHead(
        s * (hw / 2 + 0.004 * L),
        hh * 0.15,
        head * 0.18,
        0.02 * L,
        hh * 0.2,
        head * 0.14,
        0,
        1,
      );
  if (finer)
    for (const [side, v, w] of b.marks)
      put(
        side * (W / 2 + 0.01),
        cy + v * H,
        w * L,
        0.02,
        b.pattern === "stripes" ? H * 0.8 : H * 0.22,
        b.pattern === "stripes" ? 0.07 : H * 0.22,
        0,
        1,
      );
  return n;
}
