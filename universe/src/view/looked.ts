// An alien beast built and posed from its plan and its stock's look (B1 of the life plan, docs/architecture/
// asks-2026-11-12-plan.md Part B): the one builder's second half, for every beast with a look (view/creature.ts
// draws Earth's, with none, as it always did). Its facts are its plan's, every one kept: its legs, fins and wings
// as many as it has, its covering (wool fluffs it, a shell domes its hind body, plates ridge its back, fur gives it
// ears), its weight, how it moves, its neck and tail as long as they are, and each thing it grows. What its facts
// leave open is its stock's: its segments' shape, how its legs attach and joint and so how it walks (straight
// under it, its legs swinging in diagonal pairs; sprawled, its body swaying as each leg reaches round; arched high,
// in a wave down each side; back-kneed, stepping), its head, its eyes, its mouthparts, its tail, and what it
// bears that it does not walk on. Its proportions and colours are its own (rules/stocks.ts lookOf).
//
// Parts go in the order they matter, so a body at the cap of parts loses its finest touches first: its body, its
// legs, its wings and fins, its tail, its neck and head, what it grows, its mouth and eyes, what else it bears,
// its markings. How many parts it has never hangs on its pose, so its batches are sized once (Built.uses).
import type { BeastLook, CreatureBody } from "../rules/index.ts";
import {
  BEAST_SCALE,
  JOBS,
  MOST_PARTS,
  SHAPES,
  type BeastPart,
  type BeastShape,
  type Built,
  type Pose,
} from "./creature.ts";

const HALF = Math.PI / 2;
/** Each job's number (made at first use: creature.ts and this module import each other). */
let JOB: Readonly<Record<string, number>> | null = null;
const S = { box: 0, taper: 1, dome: 2, tube: 3, membrane: 4, bag: 5 } as const;

const unit = (key: number, i: number, j: number) => {
  let h = (key ^ (i * 0x9e3779b1) ^ (j * 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Build a beast from its plan and its look: its measures, finer at a finer `detail`, and how many parts of each tone and shape it is drawn with. */
export function buildLooked(
  plan: CreatureBody,
  look: BeastLook,
  detail: number,
  pattern: "spots" | "stripes" | null,
  key: number,
): Built {
  const s = Math.max(0.26, Math.cbrt(plan.size / 200)),
    swim = plan.moves === "swim",
    slither = plan.moves === "slither",
    many = plan.legs >= 6,
    length = 1.5 * s * (swim ? 1.15 : slither ? 1.8 : 1) * look.long,
    height =
      length *
      (swim ? 0.3 : many ? 0.28 : slither ? 0.16 : 0.42) *
      look.deep *
      (look.limbs === "sprawl" ? 0.85 : 1),
    width =
      length *
      (swim ? 0.22 : many ? 0.5 : slither ? 0.16 : 0.36) *
      look.wide *
      (look.limbs === "sprawl" ? 1.15 : 1),
    leg =
      plan.legs === 0
        ? 0
        : length *
          (plan.legs === 2 ? (plan.moves === "fly" ? 0.18 : 0.62) : many ? 0.34 : 0.55) *
          (plan.moves === "run" ? 1.1 : 1) *
          look.legLen *
          (look.limbs === "sprawl" ? 0.8 : look.limbs === "arch" ? 1.15 : 1),
    marks: [number, number, number][] = [],
    // (Its markings: as its name has them, else as its line's genome has them.)
    pat: "spots" | "stripes" | "bands" | null =
      pattern ?? (look.marks === "plain" ? null : look.marks),
    count = pat === "spots" ? 5 : pat === "stripes" ? 4 : pat === "bands" ? 3 : 0;
  for (let i = 0; i < count && detail >= 2; i++)
    marks.push([
      unit(key, i, 1) < 0.5 ? -1 : 1,
      (unit(key, i, 2) - 0.5) * 0.6,
      pat === "spots" ? (unit(key, i, 3) - 0.5) * 0.8 : -0.32 + (0.64 * i) / Math.max(1, count - 1),
    ]);
  const built: Built = {
    plan,
    look,
    uses: new Uint8Array(3 * SHAPES),
    k: BEAST_SCALE,
    length,
    height,
    width,
    leg,
    neck: length * plan.neck * 0.8,
    head: length * (plan.level >= 3 ? 0.3 : 0.26) * look.headSize,
    tail: length * plan.tail * 0.8,
    detail,
    marks,
    pattern: pat === "bands" ? null : pat,
  };
  // How many parts of each tone and shape: posed once (the count never hangs on the pose).
  const parts: BeastPart[] = [],
    n = posedLooked(built, look, { gait: 1, phase: 0.4, head: 0.3, crouch: 0 }, parts),
    uses = built.uses as Uint8Array;
  for (let i = 0; i < n; i++) uses[parts[i]!.tone * SHAPES + parts[i]!.shape]!++;
  return built;
}

/** Pose a beast of a look: its parts this moment, written into `out` (reused; returns how many). */
export function posedLooked(b: Built, look: BeastLook, pose: Pose, out: BeastPart[]): number {
  const p = b.plan,
    k = b.k,
    has = (x: string) => p.features.includes(x as never),
    bears = (x: string) => look.extras.includes(x as never);
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
    yaw: number,
    shape: BeastShape,
    job: string,
  ) => {
    if (n >= MOST_PARTS) return;
    const o =
      out[n] ??
      (out[n] = {
        x: 0,
        y: 0,
        z: 0,
        sx: 0,
        sy: 0,
        sz: 0,
        pitch: 0,
        yaw: 0,
        tone: 0,
        shape: 0,
        job: 0,
      });
    o.x = x * k;
    o.y = y * k;
    o.z = z * k;
    o.sx = Math.max(1e-4, sx) * k;
    o.sy = Math.max(1e-4, sy) * k;
    o.sz = Math.max(1e-4, sz) * k;
    o.pitch = pitch;
    o.yaw = yaw;
    o.tone = tone;
    o.shape = shape;
    o.job = (JOB ??= Object.fromEntries(JOBS.map((j, i) => [j, i])))[job] ?? 0;
    n++;
  };
  /**
   * A part lying along the body (its length `len` along z, `w` across, `h` high), of a shape: a taper narrows
   * toward the tail (`ahead`: toward the head), a dome sits on its base, a tube lies along it, a disc stands on end.
   */
  const lying = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    len: number,
    shape: BeastShape,
    tone: 0 | 1 | 2,
    job: string,
    yaw = 0,
    ahead = false,
  ) => {
    if (shape === S.taper || shape === S.tube)
      put(x, y, z, w, len, h, ahead ? HALF : -HALF, tone, yaw, shape, job);
    else put(x, y, z, w, h, len, 0, tone, yaw, shape, job);
  };
  /** A limb part from (y, z) along a direction `a` (0 down, rising toward +z), its thickness `t`, of the stock's limb shape; a taper narrowing to its end. */
  const limbShape: BeastShape =
    look.limbShape === "tube" ? S.tube : look.limbShape === "taper" ? S.taper : S.box;
  const L = b.length,
    wool = p.covering === "wool",
    furred = wool || p.covering === "fur",
    W = b.width + (wool ? 0.12 * L : 0),
    H = b.height + (wool ? 0.1 * L : 0),
    fly = p.moves === "fly",
    swim = p.moves === "swim",
    slither = p.moves === "slither",
    detail = b.detail,
    fine = detail >= 1,
    finer = detail >= 2,
    moving = pose.gait > 0,
    sprawls = (look.limbs === "sprawl" || look.limbs === "arch" || p.legs >= 6) && p.legs > 2,
    bob =
      pose.gait === 2 || (p.moves === "hop" && moving)
        ? 0.12 * H * Math.abs(Math.sin(pose.phase))
        : 0,
    sink = pose.crouch * b.leg * 0.35,
    belly =
      (fly || swim
        ? 0
        : sprawls
          ? b.leg * (look.limbs === "arch" ? 0.62 : look.limbs === "sprawl" ? 0.32 : 0.55)
          : b.leg) -
      sink +
      bob,
    cy = belly + H / 2,
    seg: BeastShape =
      look.seg === "taper"
        ? S.taper
        : look.seg === "dome"
          ? S.dome
          : look.seg === "bag"
            ? S.bag
            : look.seg === "disc"
              ? S.tube
              : S.box,
    // (A sprawler's body sways from side to side as each leg reaches round.)
    sway = moving && look.limbs === "sprawl" ? 0.14 * W * Math.sin(pose.phase) : 0;

  // A radial body: its middle and its arms, as many as its stock's plan has.
  if (p.symmetry === "radial") {
    const arms =
        look.eyeCount >= 6
          ? 8
          : look.joints === 3
            ? 6
            : look.seg === "taper"
              ? 3
              : look.seg === "box"
                ? 4
                : 5,
      bell = seg === S.dome || seg === S.bag;
    put(0, cy, 0, L * 0.6, H * (bell ? 1.4 : 1), L * 0.6, 0, 0, 0, bell ? seg : S.tube, "body");
    for (let a = 0; a < arms; a++) {
      const turn = (a / arms) * 2 * Math.PI + 0.2 * Math.sin(pose.phase + a);
      if (bell) {
        // (A bell's arms hang below it, trailing.)
        const swing = 0.25 * Math.sin(pose.phase * 1.5 + a);
        put(
          Math.sin(turn) * L * 0.2,
          cy - H * 0.9,
          Math.cos(turn) * L * 0.2,
          W * 0.12,
          H * 2.2,
          W * 0.12,
          swing,
          1,
          turn,
          S.tube,
          "arm",
        );
      } else
        lying(
          Math.sin(turn) * L * 0.45,
          cy,
          Math.cos(turn) * L * 0.45,
          W * 0.3,
          H * 0.6,
          L * 0.5,
          limbShape === S.box ? S.box : S.taper,
          0,
          "arm",
          turn,
        );
    }
    if (finer && bears("plumes"))
      for (let a = 0; a < 3; a++)
        put(
          0,
          cy + H * 0.6,
          0,
          W * 0.05,
          H * 1.2,
          W * 0.05,
          -0.4 + 0.4 * a,
          1,
          0,
          S.tube,
          "plumes",
        );
    return n;
  }

  // The body.
  if (slither) {
    const segs = finer ? 6 : 4;
    for (let i = 0; i < segs; i++) {
      const len = L / segs,
        taper = 1 - (0.4 * i) / (segs - 1),
        wave =
          Math.sin(pose.phase * (moving ? 1 : 0.2) + i * 1.1) *
          W *
          1.2 *
          (0.35 + (0.65 * i) / (segs - 1));
      lying(
        wave,
        belly + (H * taper) / 2,
        L / 2 - len * (i + 0.5),
        W * taper,
        H * taper,
        len * (seg === S.bag || seg === S.dome ? 1.25 : 1.05),
        i === segs - 1 && seg === S.box ? S.taper : seg,
        0,
        "body",
      );
    }
  } else if (swim) {
    // Deep at the shoulders, tapering to the tail (as its stock's segments are shaped).
    lying(0, cy, L * 0.2, W, H, L * 0.6, seg === S.taper ? S.box : seg, 0, "body");
    lying(
      0,
      cy + H * 0.04,
      -L * 0.25,
      W * 0.58,
      H * 0.66,
      L * 0.5,
      seg === S.box ? S.taper : seg === S.tube ? S.tube : S.taper,
      0,
      "body",
    );
  } else {
    const segs = p.segments === 1 && fine && !fly ? 2 : p.segments,
      shares = segs === 1 ? [1] : segs === 2 ? [0.46, 0.54] : [0.26, 0.3, 0.44];
    let at = L / 2;
    shares.forEach((share, i) => {
      const len = L * share,
        bulk = segs === 1 ? 1 : 0.85 + 0.3 * (i / Math.max(1, segs - 1)),
        shell = p.covering === "shell" && i === segs - 1,
        last = i === segs - 1,
        shape: BeastShape = shell ? S.dome : seg,
        over = shape === S.bag || shape === S.dome ? 1.12 : 1;
      lying(
        sway * (i / Math.max(1, segs - 1) - 0.5),
        cy + (shell ? H * 0.1 : 0) - (shape === S.dome ? H * 0.12 : 0),
        at - len / 2,
        W * bulk,
        H * bulk * (shell ? 1.3 : 1) * (shape === S.dome ? 1.15 : 1),
        len * 0.96 * over,
        shape,
        0,
        "body",
        0,
        // (A tapering body is a spindle: its fore part narrows toward its neck, its hind toward its tail.)
        shape === S.taper && i === 0 && segs > 1,
      );
      at -= len;
    });
  }
  // Plates ridge its back; spines stand along it; a hump; scutes in a row; a sail down its back.
  if (fine && p.covering === "plates")
    for (let i = 0; i < 3; i++)
      put(
        0,
        cy + H * 0.55,
        L * (0.3 - 0.3 * i),
        W * 0.7,
        H * 0.18,
        L * 0.22,
        0.2,
        1,
        0,
        S.box,
        "body",
      );
  if (fine && has("spines"))
    for (let i = 0; i < 4; i++)
      put(
        0,
        cy + H * 0.62 + H * 0.25,
        L * (0.3 - 0.2 * i),
        W * 0.12,
        H * 0.5,
        W * 0.12,
        -0.3,
        2,
        0,
        S.taper,
        "growth",
      );
  if (has("hump"))
    put(0, belly + H + 0.06 * L, 0, W * 0.6, H * 0.55, L * 0.38, 0, 0, 0, S.bag, "growth");
  if (bears("sail") && !slither)
    put(
      sway * 0.2,
      cy + H * 0.45 + H * 0.45,
      -L * 0.04,
      L * 0.72,
      0.03 * L,
      H * 0.95,
      -HALF,
      1,
      HALF,
      S.membrane,
      "sail",
    );

  // The legs, in pairs along the body.
  const pairs = p.legs / 2,
    swing = fly ? 0 : pose.gait === 2 ? 0.75 : pose.gait === 1 ? 0.4 : 0,
    legTone: 0 | 1 = wool ? 1 : 0,
    stout = look.stout,
    joints = fine && !fly ? look.joints : 1,
    rake = look.limbs === "rake" || (look.limbs === "arch" && p.legs === 2);
  for (let i = 0; i < pairs; i++) {
    const along =
      pairs === 1 ? (fly ? 0 : -L * 0.12) : L * (0.36 - (0.72 * i) / Math.max(1, pairs - 1));
    for (const side of [-1, 1]) {
      // The gait follows where the legs are: a sprawler's and a high-kneed walker's go in a wave down each side; one
      // under its body in diagonal pairs; a hopper's together; a back-kneed one's in turn.
      const ph = sprawls
        ? pose.phase + i * 0.9 + (side > 0 ? Math.PI : 0)
        : p.moves === "hop"
          ? pose.phase
          : pose.phase + (side === (i % 2 ? 1 : -1) ? 0 : Math.PI);
      if (sprawls && !fly) {
        // Out from its side to the knee (level with the hip, sprawled; high above it, arched), and down to the ground.
        const reachOut = look.limbs === "sprawl" ? 1.25 : 1,
          lean = 0.55 * (along / (L / 2)) + (moving ? 0.35 * Math.sin(ph) : 0),
          yaw = side * (HALF - lean),
          ox = Math.sin(yaw),
          oz = Math.cos(yaw),
          lift = moving ? 0.35 * b.leg * Math.max(0, Math.cos(ph)) : 0,
          rise = look.limbs === "sprawl" ? 0.12 + 0.2 * (1 - look.splay) : 0.75,
          femur = b.leg * 0.95 * reachOut,
          thick = Math.min(W * 0.18, 0.04 * L + 0.02) * stout,
          hx = side * W * 0.42 + sway * (along / L),
          hy = cy - (look.limbs === "sprawl" ? H * 0.15 : 0),
          kx = hx + ox * femur * Math.cos(rise),
          ky = hy + femur * Math.sin(rise) + lift,
          kz = along + oz * femur * Math.cos(rise),
          drop = Math.max(0.02, ky - lift * 0.8),
          reach = drop * (look.limbs === "sprawl" ? 0.15 : 0.35),
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
          HALF - rise,
          0,
          yaw,
          limbShape,
          "walking leg",
        );
        if (fine)
          put(
            (kx + fx) / 2,
            (ky + lift * 0.8) / 2,
            (kz + fz) / 2,
            thick,
            tibia,
            thick,
            -Math.atan2(reach, drop) + (limbShape === S.taper ? Math.PI : 0),
            1,
            yaw,
            limbShape,
            "walking leg",
          );
        if (joints === 3)
          put(
            fx + ox * thick,
            lift * 0.4 + thick * 0.3,
            fz + oz * thick,
            thick * 0.9,
            thick * 0.6,
            thick * 3,
            0,
            1,
            yaw,
            S.box,
            "walking leg",
          );
        continue;
      }
      const a = swing * Math.sin(ph),
        lift = moving && !fly ? (pose.gait === 2 ? 1.1 : 0.8) * Math.max(0, -Math.cos(ph)) : 0,
        x = side * (W / 2 - Math.min(W, 0.09 * L) * 0.6) * (1 + 0.25 * look.splay),
        hipY = fly ? belly + H * 0.3 : belly + H * 0.2,
        reach = fly ? b.leg + H * 0.3 : Math.max(0.02, hipY),
        thick =
          Math.min(W * 0.28, 0.05 * L + 0.02) * (p.size > 2000 ? 1.6 : 1) * (fly ? 0.5 : stout);
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
          0,
          limbShape === S.taper ? S.box : limbShape,
          "walking leg",
        );
        continue;
      }
      // Straight under it (the knee forward), or bent back at the knee as a bird's; a foot besides on three joints.
      const bend = rake ? 0.55 : 0.12,
        footLen = joints === 3 ? reach * 0.16 : 0,
        rest = reach - footLen * 0.3,
        upper = (rest * 0.5) / Math.cos(bend),
        lower = (rest * 0.5) / Math.cos(bend),
        ua = a + (rake ? bend : -bend * 0.4),
        ky = hipY - upper * Math.cos(ua),
        kz = along - upper * Math.sin(ua),
        c = a + lift - (rake ? bend : -bend * 0.4),
        fy = ky - lower * Math.cos(c),
        fz = kz - lower * Math.sin(c);
      put(
        x,
        hipY - (upper / 2) * Math.cos(ua),
        along - (upper / 2) * Math.sin(ua),
        thick * 1.45,
        upper + thick * 0.5,
        thick * 1.3,
        ua,
        legTone,
        0,
        limbShape === S.taper ? S.box : limbShape,
        "walking leg",
      );
      put(
        x,
        ky - (lower / 2) * Math.cos(c),
        kz - (lower / 2) * Math.sin(c),
        thick,
        lower,
        thick,
        c + (limbShape === S.taper ? Math.PI : 0),
        legTone,
        0,
        limbShape,
        "walking leg",
      );
      if (joints === 3)
        put(
          x,
          Math.max(thick * 0.3, fy + thick * 0.2),
          fz + footLen * 0.35,
          thick * 1.1,
          thick * 0.5,
          footLen * 1.4,
          0.15,
          1,
          0,
          S.box,
          "walking leg",
        );
    }
  }

  // Wings: feathered as a bird's (boxes); else membranes, an inner and an outer, beating.
  if (p.wings) {
    const feathered = p.covering === "feathers",
      beat = moving ? 0.5 * Math.sin(pose.phase * 3) - 0.05 : -0.12,
      span = L * 1.4,
      inner = fine ? span * 0.48 : span,
      chord = L * 0.5,
      shoulder = cy + H * 0.25,
      wing: BeastShape = feathered ? S.box : S.membrane;
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
          chord * (feathered ? 1 : 1.25),
          0.04 * L,
          inner,
          beat,
          0,
          yaw,
          wing,
          "wing",
        );
        if (fine) {
          const bend = beat * 1.3,
            outer = span * 0.55;
          put(
            side * (ex + (Math.cos(bend) * outer) / 2),
            ey - (Math.sin(bend) * outer) / 2,
            z0 - chord * 0.08,
            chord * (feathered ? 0.78 : 1),
            0.035 * L,
            outer,
            bend,
            0,
            yaw,
            wing,
            "wing",
          );
        }
      }
  }
  // Fins at a swimmer's sides: membranes, swept back.
  if (p.fins)
    for (let i = 0; i < p.fins / 2; i++)
      for (const side of [-1, 1])
        put(
          side * (W / 2 + L * 0.08),
          cy - H * 0.2,
          L * (0.15 - 0.3 * i),
          L * 0.22,
          0.03 * L,
          L * 0.18,
          0,
          1,
          side * (HALF + 0.5),
          S.membrane,
          "fin",
        );

  // The tail, of its stock's kind: a taper, a whip of links, a club, a fan, a fork, a chain of segments.
  if (swim) {
    const sway2 = 0.5 * Math.sin(pose.phase * 2),
      tx = Math.sin(sway2) * L * 0.1,
      tz = -L / 2 - L * 0.12;
    if (look.tail === "fan" || look.tail === "club")
      // (A fluke, flat, its wide edge behind.)
      put(tx, cy, tz, L * 0.42, 0.03 * L, L * 0.3, 0, 0, sway2 + Math.PI, S.membrane, "tail");
    else if (look.tail === "whip" || look.tail === "chain") {
      for (let i = 0; i < 3; i++)
        lying(
          Math.sin(sway2 * (1 + i * 0.5)) * L * 0.1 * (1 + i),
          cy,
          -L / 2 - L * (0.08 + 0.16 * i),
          W * 0.3 * (1 - 0.25 * i),
          H * 0.3 * (1 - 0.25 * i),
          L * 0.17,
          S.tube,
          0,
          "tail",
        );
    } else {
      // (Two lobes, one up and one down, as a fork; one up as a taper's sail.)
      put(
        tx,
        cy + H * 0.42,
        tz,
        L * 0.3,
        0.03 * L,
        H * 0.85,
        -HALF,
        0,
        HALF + sway2,
        S.membrane,
        "tail",
      );
      if (look.tail === "fork" || look.tail === "taper")
        put(
          tx,
          cy - H * 0.42,
          tz,
          L * 0.3,
          0.03 * L,
          H * 0.85,
          HALF,
          0,
          HALF + sway2,
          S.membrane,
          "tail",
        );
    }
    if (fine)
      put(
        0,
        cy + H * 0.62,
        L * 0.02,
        L * 0.32,
        0.02 * L,
        H * 0.45,
        -HALF,
        1,
        HALF,
        S.membrane,
        "fin",
      );
  } else if (fly) {
    if (fine) {
      if (look.tail === "fork")
        for (const side of [-1, 1])
          put(
            side * W * 0.18,
            cy + H * 0.1,
            -L / 2 - b.tail * 0.4,
            W * 0.18,
            0.03 * L,
            b.tail,
            0.12,
            0,
            side * 0.3,
            S.box,
            "tail",
          );
      else
        put(
          0,
          cy + H * 0.1,
          -L / 2 - b.tail * 0.4,
          W * 1.1,
          0.03 * L,
          b.tail,
          0.12,
          0,
          Math.PI,
          look.tail === "fan" ? S.membrane : S.box,
          "tail",
        );
    }
  } else if (b.tail > 0.02 && !slither) {
    const sway2 = 0.15 * Math.sin(pose.phase),
      lift = p.legs === 2 ? Math.PI * 0.62 : Math.PI + 0.4 + (pose.gait === 2 ? 0.4 : 0),
      by = cy + H * 0.2,
      bz = -L / 2,
      thick = Math.max(0.03 * L, W * 0.12),
      dy = Math.cos(lift),
      dz = Math.sin(lift),
      t = b.tail;
    if (look.tail === "whip" || look.tail === "chain") {
      // Links, each thinner than the last, curling as it goes.
      const links = fine ? 3 : 1,
        len = t / links;
      let y = by,
        z = bz;
      for (let i = 0; i < links; i++) {
        const curl = lift + (look.tail === "whip" ? 0.25 * i : 0) + sway2 * i,
          cy2 = Math.cos(curl),
          cz2 = Math.sin(curl),
          th = thick * (look.tail === "chain" ? 1.3 - 0.25 * i : 1 - 0.28 * i);
        put(
          0,
          y + (cy2 * len) / 2,
          z + (cz2 * len) / 2,
          th,
          len * 1.05,
          th,
          curl,
          i ? 1 : 0,
          sway2,
          look.tail === "chain" ? (seg === S.tube ? S.tube : S.bag) : S.tube,
          "tail",
        );
        y += cy2 * len;
        z += cz2 * len;
      }
    } else if (look.tail === "fork") {
      put(
        0,
        by + (dy * t) / 4,
        bz + (dz * t) / 4,
        thick,
        t / 2,
        thick,
        lift,
        1,
        sway2,
        S.taper,
        "tail",
      );
      for (const s2 of [-1, 1])
        put(
          s2 * thick * 1.2,
          by + dy * t * 0.7,
          bz + dz * t * 0.7,
          thick * 0.7,
          t * 0.5,
          thick * 0.7,
          lift,
          1,
          sway2 + s2 * 0.45,
          S.taper,
          "tail",
        );
    } else {
      put(
        0,
        by + (dy * t) / 2,
        bz + (dz * t) / 2,
        thick * (look.tail === "taper" ? 1.5 : 1),
        t,
        thick * (look.tail === "taper" ? 1.5 : 1),
        lift,
        1,
        sway2,
        look.tail === "taper" ? S.taper : S.tube,
        "tail",
      );
      if (look.tail === "club")
        put(
          0,
          by + dy * t,
          bz + dz * t,
          thick * 3,
          thick * 3,
          thick * 3.4,
          lift,
          2,
          sway2,
          S.bag,
          "tail",
        );
      else if (look.tail === "fan")
        put(
          0,
          by + dy * t,
          bz + dz * t,
          thick * 5,
          0.025 * L,
          t * 0.5,
          lift + HALF,
          1,
          sway2,
          S.membrane,
          "tail",
        );
    }
    if (finer && furred && look.tail === "taper")
      put(
        0,
        by + dy * t,
        bz + dz * t,
        thick * 1.8,
        0.14 * L,
        thick * 1.8,
        lift,
        1,
        sway2,
        S.bag,
        "tail",
      );
  }

  // The neck and head: bowed to its food as it grazes, lifted as it watches, low as it stalks.
  const flat = swim || slither,
    neck = b.neck,
    head = b.head,
    baseY = cy + H * 0.12,
    baseZ = L / 2 - Math.min(neck, W) * 0.2,
    lean = flat
      ? HALF
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
      W * 0.4 * Math.sqrt(look.stout),
      neck + W * 0.2,
      W * 0.4 * Math.sqrt(look.stout),
      lean,
      0,
      0,
      limbShape === S.tube ? S.tube : S.box,
      "neck",
    );
  const topY = flat ? (slither ? belly + H / 2 : cy) : baseY + ny * neck,
    topZ = flat ? L / 2 : baseZ + nz * neck,
    tip = flat ? HALF : 0.3 + 1.1 * pose.head + pose.crouch * 0.2,
    hy = topY - (Math.sin(tip - (flat ? HALF : 0)) * head) / 2,
    hz = topZ + (Math.cos(tip - (flat ? HALF : 0)) * head) / 2,
    hammer = look.head === "hammer",
    hw =
      W *
      (swim ? 0.8 : p.level >= 3 ? 0.62 : 0.5) *
      (hammer ? 2.1 : look.head === "disc" ? 1.35 : 1),
    hh = H * (swim ? 0.8 : 0.55) * (look.head === "disc" ? 0.55 : look.head === "dome" ? 1.1 : 1),
    hl = head * (hammer ? 0.6 : look.head === "wedge" ? 1.25 : 1),
    pitchHead = flat ? 0 : tip;
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
    shape: BeastShape,
    job: string,
    yaw = 0,
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
      yaw,
      shape,
      job,
    );
  if (look.head === "wedge") onHead(0, 0, 0, hw, hl, hh, HALF, 0, S.taper, "head");
  else if (look.head === "dome") onHead(0, -hh * 0.1, 0, hw, hh, hl, 0, 0, S.dome, "head");
  else if (look.head === "bag") onHead(0, 0, 0, hw * 1.1, hh * 1.1, hl * 1.1, 0, 0, S.bag, "head");
  else if (look.head === "disc") onHead(0, 0, 0, hw, hh, hl, 0, 0, S.tube, "head");
  else onHead(0, 0, 0, hw, hh, hl, 0, 0, S.box, "head");

  // What it grows (its facts), in its own shapes.
  if (has("horns"))
    for (const s2 of [-1, 1])
      onHead(
        s2 * hw * 0.32,
        hh * 0.62 + hh * 0.3,
        -hl * 0.2,
        0.06 * L,
        hh * 0.8,
        0.06 * L,
        -0.5,
        2,
        S.taper,
        "growth",
      );
  if (has("wide-horns"))
    onHead(0, hh * 0.45, -hl * 0.15, hw * 2.4, 0.06 * L, 0.08 * L, 0, 2, S.box, "growth");
  if (has("antlers"))
    for (const s2 of [-1, 1]) {
      onHead(
        s2 * hw * 0.35,
        hh * 0.9,
        -hl * 0.15,
        0.03 * L,
        hh * 1.4,
        0.03 * L,
        -0.25,
        2,
        S.tube,
        "growth",
      );
      onHead(
        s2 * hw * 0.6,
        hh * 1.4,
        -hl * 0.2,
        0.03 * L,
        hh * 0.7,
        0.03 * L,
        0.3,
        2,
        S.tube,
        "growth",
      );
    }
  if (has("tusks"))
    for (const s2 of [-1, 1])
      onHead(
        s2 * hw * 0.3,
        -hh * 0.35,
        hl * 0.55,
        0.07 * L,
        hl * 1.1,
        0.07 * L,
        HALF + 0.5,
        2,
        S.taper,
        "growth",
      );
  if (has("trunk")) {
    onHead(0, -hh * 0.4, hl * 0.5, hw * 0.26, hh * 0.8, hw * 0.26, 0.4, 0, S.tube, "growth");
    onHead(0, -hh * 1.05, hl * 0.62, hw * 0.2, hh * 0.7, hw * 0.2, 0.1, 0, S.tube, "growth");
  }
  if (has("beak"))
    onHead(
      0,
      -hh * 0.1,
      hl * 0.62,
      hw * 0.34,
      hl * 0.5,
      hh * 0.28,
      HALF + 0.15,
      2,
      S.taper,
      "growth",
    );
  if (has("crest"))
    onHead(0, hh * 0.7, -hl * 0.1, 0.03 * L, hh * 0.9, hl * 0.85, -0.2, 1, S.box, "growth");
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
      0,
      S.box,
      "growth",
    );
  if (finer && has("mane") && neck <= 0.02)
    onHead(0, hh * 0.2, -hl * 0.5, hw * 1.4, hh * 1.3, hl * 0.3, 0, 1, S.bag, "growth");

  // Its mouthparts (a beak, where it grows one, is its mouth).
  if (fine && !has("beak")) {
    if (look.mouth === "mandibles")
      for (const s2 of [-1, 1])
        onHead(
          s2 * hw * 0.22,
          -hh * 0.25,
          hl * 0.6,
          hw * 0.16,
          hl * 0.45,
          hw * 0.16,
          HALF + 0.2,
          2,
          S.taper,
          "mouthparts",
          -s2 * 0.35,
        );
    else if (look.mouth === "proboscis")
      onHead(
        0,
        -hh * 0.35,
        hl * 0.75,
        hw * 0.12,
        hl * 0.9,
        hw * 0.12,
        HALF + 0.5,
        1,
        S.tube,
        "mouthparts",
      );
    else if (look.mouth === "tendrils")
      for (let i = 0; i < 3; i++)
        onHead(
          (i - 1) * hw * 0.22,
          -hh * 0.7,
          hl * 0.42,
          hw * 0.07,
          hh * 0.9,
          hw * 0.07,
          0.25,
          1,
          S.tube,
          "mouthparts",
        );
    else if (look.mouth === "sucker")
      onHead(0, -hh * 0.05, hl * 0.52, hw * 0.6, 0.06 * L, hh * 0.6, HALF, 1, S.tube, "mouthparts");
    else if (!swim)
      onHead(0, -hh * 0.12, hl * 0.42, hw * 0.8, hh * 0.6, hl * 0.22, 0, 1, S.box, "mouthparts");
  }
  // Its eyes, as many as its line has and set as its stock sets them, larger where light is poor.
  if (fine && look.eyeCount > 0) {
    const e = 0.035 * L * look.eyeSize,
      count = look.eyeCount;
    if (look.eyes === "stalks")
      for (const s2 of [-1, 1]) {
        onHead(
          s2 * hw * 0.3,
          hh * 0.5 + hh * 0.45,
          hl * 0.1,
          e * 0.4,
          hh * 0.9,
          e * 0.4,
          -0.3,
          0,
          S.tube,
          "eye",
        );
        onHead(
          s2 * hw * 0.3,
          hh * 0.5 + hh * 1.0,
          hl * 0.25,
          e * 1.3,
          e * 1.3,
          e * 1.3,
          0,
          1,
          S.bag,
          "eye",
        );
      }
    else if (look.eyes === "band")
      onHead(0, hh * 0.18, hl * 0.5, hw * 0.9, e * 0.9, e * 0.6, 0, 1, S.box, "eye");
    else if (look.eyes === "cluster")
      for (let i = 0; i < count; i++) {
        const a = (i / count) * 2 * Math.PI;
        onHead(
          Math.cos(a) * hw * 0.22,
          hh * 0.5,
          hl * 0.1 + Math.sin(a) * hl * 0.2,
          e,
          e,
          e,
          0,
          1,
          S.bag,
          "eye",
        );
      }
    else if (look.eyes === "row")
      for (let i = 0; i < count; i++)
        onHead(
          (i / Math.max(1, count - 1) - 0.5) * hw * 0.8,
          hh * 0.3,
          hl * 0.48,
          e * 0.8,
          e * 0.8,
          e * 0.5,
          0,
          1,
          S.bag,
          "eye",
        );
    else
      for (let i = 0; i < Math.min(6, count); i += 2)
        for (const s2 of [-1, 1])
          onHead(
            s2 * (hw / 2 + 0.004 * L),
            hh * (0.15 - 0.22 * (i / 2)),
            hl * (0.18 - 0.12 * (i / 2)),
            0.02 * L,
            e,
            e,
            0,
            1,
            S.bag,
            "eye",
          );
  }
  // What else it bears that it does not walk on.
  if (bears("frill") && !swim)
    onHead(0, hh * 0.1, -hl * 0.55, hw * 2.3, 0.03 * L, hh * 2.2, HALF, 1, S.tube, "frill");
  if (fine && bears("feelers"))
    for (const s2 of [-1, 1])
      onHead(
        s2 * hw * 0.25,
        hh * 0.6 + hl * 0.45,
        hl * 0.45,
        0.02 * L,
        hl * 1.4,
        0.02 * L,
        0.7,
        1,
        S.tube,
        "feeler",
        s2 * 0.3,
      );
  if (fine && bears("plumes"))
    for (let i = 0; i < 3; i++)
      onHead(
        (i - 1) * hw * 0.3,
        hh * 0.5 + hl * 0.3,
        -hl * 0.4,
        0.025 * L,
        hl * 0.9,
        0.025 * L,
        -0.9 - 0.25 * Math.abs(i - 1),
        1,
        S.tube,
        "plumes",
      );
  if (fine && bears("graspers") && !fly && !swim)
    for (const s2 of [-1, 1]) {
      const gx = s2 * W * 0.32,
        gy = cy - H * 0.05,
        gz = L * 0.47,
        reachG = (b.leg + H) * 0.35,
        fold = moving ? 0.15 * Math.sin(pose.phase + s2) : 0;
      put(
        gx,
        gy - reachG * 0.25,
        gz + reachG * 0.25,
        W * 0.09,
        reachG,
        W * 0.09,
        2.4 + fold,
        1,
        0,
        S.tube,
        "grasper",
      );
      if (finer)
        put(
          gx,
          gy - reachG * 0.35,
          gz + reachG * 0.62,
          W * 0.08,
          reachG * 0.8,
          W * 0.08,
          0.5 + fold,
          1,
          0,
          S.taper,
          "grasper",
        );
    }
  if (fine && bears("scutes"))
    for (let i = 0; i < 4; i++)
      put(
        0,
        cy + H * 0.47 * (seg === S.dome || seg === S.bag ? 1.15 : 1),
        L * (0.32 - 0.21 * i),
        W * 0.32,
        H * 0.22,
        L * 0.14,
        0,
        2,
        0,
        S.dome,
        "scutes",
      );
  if (fine && bears("fringe") && !slither)
    for (let i = 0; i < 3; i++)
      for (const s2 of [-1, 1])
        put(
          s2 * (W / 2 + L * 0.05),
          cy - H * 0.3,
          L * (0.26 - 0.26 * i),
          L * 0.18,
          0.02 * L,
          L * 0.12,
          0,
          1,
          s2 * HALF,
          S.membrane,
          "fringe",
        );
  if (finer && bears("spurs") && p.legs > 0 && !fly)
    for (const s2 of [-1, 1])
      put(
        s2 * W * 0.5,
        cy - H * 0.05,
        -L * 0.3,
        0.035 * L,
        H * 0.5,
        0.035 * L,
        -2.4,
        2,
        0,
        S.taper,
        "spur",
      );

  // The finest touches: a furred beast's ears, the marks of its coat.
  if (fine && furred && !fly && look.eyes !== "stalks")
    for (const s2 of [-1, 1])
      onHead(
        s2 * hw * 0.4,
        hh * 0.62,
        -hl * 0.3,
        hw * 0.26,
        hh * 0.45,
        0.05 * L,
        -0.25,
        0,
        look.head === "dome" || look.head === "bag" ? S.dome : S.taper,
        "head",
      );
  if (finer)
    for (const [side, v, w] of b.marks)
      if (!b.pattern)
        // (Bands round its body.)
        lying(
          0,
          cy,
          w * L,
          W * 1.05,
          H * 1.03,
          0.06 * L,
          seg === S.box ? S.box : S.tube,
          1,
          "body",
        );
      else
        put(
          side * (W / 2 + 0.01),
          cy + v * H,
          w * L,
          0.02,
          b.pattern === "stripes" ? H * 0.8 : H * 0.22,
          b.pattern === "stripes" ? 0.07 : H * 0.22,
          0,
          1,
          0,
          b.pattern === "spots" ? S.bag : S.box,
          "body",
        );
  return n;
}
