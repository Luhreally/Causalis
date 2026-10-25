// A people's figure, as the microscope draws them (Phase 4 M42): their body plan as a
// few upright parts — a torso, a head, limbs, a shell or mantle, arms that radiate — so
// a village of upright apes, of feathered striders on their long legs, of many-armed
// swimmers under their mantles, reads at a glance. A pure function of the body; every
// person of a people shares it (sized for children), and the renderer instances each
// part. Units: a grown upright ape stands about 0.55 high; parts are placed around the
// figure's own middle, facing +z.

import type { FolkFacts } from "../bridge/index.ts";
import { folkLook, type FolkLook } from "./folk.ts";

/** What of a body the figure needs (a subset of rules' BodyPlan, as the plan carries it). */
export type FigureBody = {
  readonly clade: string;
  readonly medium: "land" | "shore" | "water";
  readonly symmetry: "bilateral" | "radial";
  readonly manipulators: string;
  readonly limbs: number;
  readonly skin: string;
  readonly size: number;
  readonly span?: number;
  /** What their own look is made of (Phase 34; none: their kind's plain figure, or Earth's apes). */
  readonly folk?: FolkFacts | null;
};

export type PartShape = "capsule" | "box" | "cylinder" | "cone";

export type FigurePart = {
  readonly shape: PartShape;
  /** Where the part's middle stands, and its extent (x across, y up, z forward). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  /**
   * 0 the body's own colour; 1 its limbs and features, a shade darker; 2 bare skin; 3 hair; 4
   * eyes. A people's own look (Phase 34): 0 their hide, 1 its darker limbs, 2 its lighter face
   * and underside, 3 their markings (crest, horns, feelers, spots), 4 eyes, 5 the cloth they wear
   * over it, in their group's colour.
   */
  readonly tone: 0 | 1 | 2 | 3 | 4 | 5;
  /**
   * A limb that swings as they walk (art track A2): how far, in radians, and which way
   * (the sign: a left leg and a right arm forward together); it hinges `pivot` above its
   * middle (a hip, a shoulder).
   */
  readonly swing?: number;
  readonly pivot?: number;
  /** Which limb it is (M86), for the motions of work: an arm or a leg. */
  readonly role?: "arm" | "leg";
};

export type Figure = {
  readonly parts: readonly FigurePart[];
  /** The whole figure's scale against an upright ape's (bigger bodies, bigger figures). */
  readonly scale: number;
};

/** The capsule every capsule part is drawn from (its radius, its height): a part's sizes multiply it. */
export const FIGURE_CAPSULE = { radius: 0.11, height: 0.55 } as const;

/** A part's true extent (across, up, forward): a capsule's sizes are multiples of FIGURE_CAPSULE's. */
export function partExtent(p: FigurePart): readonly [number, number, number] {
  return p.shape === "capsule"
    ? [
        2 * FIGURE_CAPSULE.radius * p.sx,
        FIGURE_CAPSULE.height * p.sy,
        2 * FIGURE_CAPSULE.radius * p.sz,
      ]
    : [p.sx, p.sy, p.sz];
}

const part = (
  shape: PartShape,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  tone: FigurePart["tone"] = 0,
): FigurePart => ({ shape, x, y, z, sx, sy, sz, tone });

/** A limb: a part that swings about a hinge `pivot` above its middle as they walk. */
const limb = (
  p: FigurePart,
  swing: number,
  pivot: number,
  role: "arm" | "leg" = "leg",
): FigurePart => ({
  ...p,
  swing,
  pivot,
  role,
});

/** Legs under a body: `n` of them, spread across its length; each pair steps in turn. */
function legs(n: number, spread: number, length: number, high: number): FigurePart[] {
  const out: FigurePart[] = [];
  const pairs = Math.ceil(n / 2);
  for (let i = 0; i < pairs; i++) {
    const z = pairs === 1 ? 0 : -length / 2 + (length * i) / (pairs - 1);
    for (const side of [-1, 1])
      if (out.length < n)
        out.push(
          limb(
            part("cylinder", side * spread, high / 2, z, 0.05, high, 0.05, 1),
            0.45 * side * (i % 2 ? -1 : 1),
            high / 2,
          ),
        );
  }
  return out;
}

/**
 * An upright ape (and any body the grammar leaves standing on two legs with two hands):
 * a figure of the era's games — a boxy body in its clothes, bare arms and head, legs in
 * a darker cloth — that swings its arms and legs as it walks. About 0.55 high.
 */
function upright(detail = 0): FigurePart[] {
  const parts = [
    part("box", 0, 0.335, 0, 0.17, 0.2, 0.11),
    part("box", 0, 0.49, 0, 0.11, 0.11, 0.11, 2),
    limb(part("box", -0.105, 0.33, 0, 0.045, 0.2, 0.05, 2), 0.55, 0.09, "arm"),
    limb(part("box", 0.105, 0.33, 0, 0.045, 0.2, 0.05, 2), -0.55, 0.09, "arm"),
    limb(part("box", -0.045, 0.12, 0, 0.065, 0.24, 0.07, 1), -0.5, 0.12),
    limb(part("box", 0.045, 0.12, 0, 0.065, 0.24, 0.07, 1), 0.5, 0.12),
  ];
  // Finer at a finer setting (M79): hands at the arms' ends and shoes at the legs', swinging
  // with them; hair over the head and eyes in the face; a belt.
  if (detail >= 1)
    parts.push(
      limb(part("box", -0.105, 0.215, 0.005, 0.05, 0.04, 0.055, 2), 0.55, 0.205, "arm"),
      limb(part("box", 0.105, 0.215, 0.005, 0.05, 0.04, 0.055, 2), -0.55, 0.205, "arm"),
      limb(part("box", -0.045, 0.0125, 0.015, 0.07, 0.025, 0.1, 1), -0.5, 0.2275),
      limb(part("box", 0.045, 0.0125, 0.015, 0.07, 0.025, 0.1, 1), 0.5, 0.2275),
    );
  if (detail >= 2)
    parts.push(
      part("box", 0, 0.54, -0.012, 0.118, 0.035, 0.12, 3),
      part("box", 0, 0.5, -0.05, 0.116, 0.07, 0.03, 3),
      part("box", -0.025, 0.5, 0.056, 0.018, 0.018, 0.01, 4),
      part("box", 0.025, 0.5, 0.056, 0.018, 0.018, 0.01, 4),
    );
  if (detail >= 3) parts.push(part("box", 0, 0.245, 0, 0.176, 0.025, 0.116, 1));
  return parts;
}

/** How a people looks, from its body — the upright apes built more finely at a finer `detail` (0 … 3). */
export function figureOf(b: FigureBody | null, detail = 0): Figure {
  // Scale by the cube root of weight against an upright ape's (clamped for the eye).
  const scale = Math.min(2.4, Math.max(0.6, Math.cbrt((b?.size ?? 60) / 60)));
  // A people of a world not Earth, in their own look (Phase 34).
  const look = folkLook(b);
  if (b && look) return { parts: folkParts(b, look, detail), scale };
  if (!b || b.clade === "ape")
    // An upright ape: body, head, two arms and two legs.
    return { parts: upright(detail), scale };
  if (b.symmetry === "radial" || b.manipulators === "tentacles")
    // A mantle above a ring of arms.
    return {
      parts: [
        part("capsule", 0, 0.34, 0, 0.9, 0.6, 0.9),
        ...Array.from({ length: Math.min(8, b.limbs) }, (_, i) => {
          const a = (2 * Math.PI * i) / Math.min(8, b.limbs);
          return part(
            "cylinder",
            0.09 * Math.cos(a),
            0.1,
            0.09 * Math.sin(a),
            0.035,
            0.2,
            0.035,
            1,
          );
        }),
      ],
      scale,
    };
  if (b.manipulators === "trunk")
    // A great body on four legs, its trunk hanging before it.
    return {
      parts: [
        part("box", 0, 0.32, 0, 0.3, 0.22, 0.42),
        ...legs(4, 0.1, 0.28, 0.22),
        part("cylinder", 0, 0.24, 0.24, 0.05, 0.2, 0.05, 1),
      ],
      scale,
    };
  if (b.skin === "shell" && b.manipulators === "mandibles")
    // A low shelled body on six legs, mandibles before it.
    return {
      parts: [
        part("cone", 0, 0.14, 0, 0.36, 0.16, 0.46),
        ...legs(6, 0.14, 0.3, 0.08),
        part("box", 0, 0.08, 0.26, 0.12, 0.05, 0.1, 1),
      ],
      scale,
    };
  if (b.skin === "shell")
    // A flat shelled body on legs, a claw on either side.
    return {
      parts: [
        part("box", 0, 0.12, 0, 0.34, 0.1, 0.26),
        ...legs(4, 0.13, 0.18, 0.07),
        part("box", -0.2, 0.12, 0.16, 0.1, 0.06, 0.12, 1),
        part("box", 0.2, 0.12, 0.16, 0.1, 0.06, 0.12, 1),
      ],
      scale,
    };
  if (b.skin === "scales")
    // A long low body on four legs, and a tail.
    return {
      parts: [
        part("box", 0, 0.12, 0, 0.16, 0.1, 0.46),
        ...legs(4, 0.1, 0.3, 0.08),
        part("cone", 0, 0.1, -0.34, 0.08, 0.2, 0.08, 1),
      ],
      scale,
    };
  if (b.skin === "feathers")
    // An egg of a body on two long legs, a neck and head before it.
    return {
      parts: [
        part("capsule", 0, 0.34, 0, 0.8, 0.45, 0.9),
        ...legs(2, 0.05, 0, 0.24),
        part("capsule", 0, 0.46, 0.1, 0.35, 0.35, 0.35, 1),
      ],
      scale,
    };
  // Four-handed climbers and the rest: a standing body with long arms swinging.
  return {
    parts: [
      part("capsule", 0, 0.26, 0, 1, 0.9, 1),
      limb(part("cylinder", -0.13, 0.26, 0, 0.04, 0.26, 0.04, 1), 0.6, 0.12, "arm"),
      limb(part("cylinder", 0.13, 0.26, 0, 0.04, 0.26, 0.04, 1), -0.6, 0.12, "arm"),
    ],
    scale,
  };
}

/**
 * A people's figure in their own look (Phase 34 M177): built of the parts their stance has — an
 * upright or stooped body on two legs with two arms or four; a low body on four legs or six, with
 * a raised front and claws, a trunk, a shell's claws or mandibles; a mantle over its ring of arms;
 * an egg of a body on two long legs — drawn out or broadened by their build, and what they bear:
 * a head of their own shape, a snout or a beak, eyes as many as they have, a crest, horns or
 * tusks, feelers, ears, a tail, their hide's markings; and the cloth they wear over it. The same
 * limbs swing as an upright ape's do (arms and legs, by role), so their days move as everyone's.
 */
function folkParts(b: FigureBody, look: FolkLook, detail: number): FigurePart[] {
  switch (look.stance) {
    case "mantle":
      return mantle(b, look, detail);
    case "strider":
      return strider(look, detail);
    case "low":
      return low(b, look, detail);
    default:
      return standing(look, detail);
  }
}

/** A head and what is on it, its middle at (0, y, z), `hs` across: snout or beak, eyes, crest, horns, feelers, ears. */
function headParts(look: FolkLook, y: number, z: number, hs: number, detail: number): FigurePart[] {
  const out: FigurePart[] = [];
  const long = look.headShape === "long",
    depth = long ? hs * 1.45 : hs,
    cz = long ? z + hs * 0.2 : z;
  if (look.headShape === "round")
    out.push(part("capsule", 0, y, cz, (hs * 1.05) / 0.22, (hs * 1.1) / 0.55, (hs * 1.05) / 0.22));
  else out.push(part("box", 0, y, cz, long ? hs * 0.9 : hs, long ? hs * 0.85 : hs, depth));
  const front = cz + depth / 2,
    top = y + hs / 2;
  // The face: a snout or a beak before it.
  if (look.snout > 0.12) {
    const len = 0.012 + hs * 0.6 * look.snout;
    out.push(
      part(
        look.beak ? "cone" : "box",
        0,
        y - hs * 0.18,
        front + len / 2 - 0.004,
        hs * (look.beak ? 0.42 : 0.55),
        look.beak ? len : hs * 0.45,
        look.beak ? hs * 0.42 : len,
        look.beak ? 3 : 2,
      ),
    );
  }
  // Eyes, as many as they have (drawn from a balanced setting up).
  if (detail >= 1) {
    const e = look.eyes === 1 ? 0.034 : 0.022,
      ey = y + hs * 0.12,
      at: [number, number][] =
        look.eyes === 1
          ? [[0, ey]]
          : look.eyes === 2
            ? [
                [-hs * 0.24, ey],
                [hs * 0.24, ey],
              ]
            : look.eyes === 3
              ? [
                  [-hs * 0.26, ey],
                  [hs * 0.26, ey],
                  [0, ey + hs * 0.25],
                ]
              : [
                  [-hs * 0.24, ey + hs * 0.13],
                  [hs * 0.24, ey + hs * 0.13],
                  [-hs * 0.17, ey - hs * 0.09],
                  [hs * 0.17, ey - hs * 0.09],
                ];
    for (const [x, yy] of at) out.push(part("box", x, yy, front + 0.003, e, e * 0.9, 0.01, 4));
  }
  // A crest from the brow back over the head.
  if (look.crest > 0)
    out.push(
      part(
        "box",
        0,
        top + (0.025 + 0.07 * look.crest) / 2 - 0.008,
        cz - hs * 0.05,
        0.022,
        0.025 + 0.07 * look.crest,
        depth * 0.95,
        3,
      ),
    );
  // Horns: a pair at the sides of the head, or one before the crest.
  const hh = 0.05 + 0.04 * look.girth;
  if (look.horns === 2)
    for (const side of [-1, 1])
      out.push(part("cone", side * hs * 0.32, top + hh / 2 - 0.005, cz, 0.026, hh, 0.026, 3));
  else if (look.horns === 1)
    out.push(part("cone", 0, top + hh / 2 - 0.005, cz + hs * 0.25, 0.03, hh * 1.2, 0.03, 3));
  // Feelers up and forward from the brow, a knob at each tip from a finer setting up.
  if (look.feelers)
    for (const side of [-1, 1]) {
      out.push(
        part("cylinder", side * hs * 0.22, top + 0.05, cz + hs * 0.25, 0.012, 0.11, 0.012, 3),
      );
      if (detail >= 2)
        out.push(part("box", side * hs * 0.22, top + 0.11, cz + hs * 0.25, 0.022, 0.022, 0.022, 3));
    }
  // Ears at the top of the head's sides.
  if (look.ears > 0)
    for (const side of [-1, 1]) {
      const eh = 0.03 + 0.05 * look.ears;
      out.push(
        part(
          "box",
          side * (hs / 2 + 0.006),
          top - 0.01 + eh / 2,
          cz - hs * 0.1,
          0.022,
          eh,
          0.035,
          1,
        ),
      );
    }
  return out;
}

/** Their hide's markings on a body box of this size at this height (from a finer setting up). */
function markings(
  look: FolkLook,
  y: number,
  w: number,
  h: number,
  d: number,
  detail: number,
): FigurePart[] {
  if (detail < 2 || look.pattern === "plain") return [];
  if (look.pattern === "stripes")
    return [-0.3, 0, 0.3].map((k) => part("box", 0, y + k * h, 0, w * 1.03, h * 0.08, d * 1.03, 3));
  return [
    [-0.5, 0.2, 0.2],
    [0.5, -0.15, -0.1],
    [-0.5, -0.25, -0.25],
    [0.5, 0.25, 0.25],
  ].map(([sx, sy, sz]) =>
    part("box", sx! * w * 1.01, y + sy! * h, sz! * d, 0.012, 0.035, 0.035, 3),
  );
}

/** An upright body on two legs (stooped, for climbers: shorter legs, a heavier body, the head sunk forward, long arms), two arms or four. */
function standing(look: FolkLook, detail: number): FigurePart[] {
  const stooped = look.stance === "stooped",
    T = look.tall,
    G = look.girth * (stooped ? 1.1 : 1),
    L = 0.24 * T * (stooped ? 0.78 : 1),
    tor = 0.2 * T,
    w = 0.17 * G,
    d = 0.11 * G,
    hs = 0.11 * look.head,
    neck = stooped ? 0 : 0.08 * look.neck,
    shoulder = L + tor - 0.01,
    A = 0.2 * T * (stooped ? 1.32 : 1),
    out: FigurePart[] = [];
  // The body, its lighter belly, and the cloth over it (a kilt; a strap from a finer setting up).
  out.push(part("box", 0, L + tor / 2, 0, w, tor, d));
  if (detail >= 1)
    out.push(part("box", 0, L + tor * 0.45, d / 2 + 0.003, w * 0.66, tor * 0.66, 0.008, 2));
  out.push(part("box", 0, L + tor * 0.2, 0, w * 1.08, tor * 0.42, d * 1.1, 5));
  if (detail >= 1)
    out.push(part("box", w * 0.2, L + tor * 0.62, 0, w * 0.26, tor * 0.82, d * 1.12, 5));
  out.push(...markings(look, L + tor / 2, w, tor, d, detail));
  // Legs, swinging as they walk.
  for (const side of [-1, 1])
    out.push(
      limb(part("box", side * 0.045 * G, L / 2, 0, 0.065 * G, L, 0.07, 1), 0.5 * side, L / 2),
    );
  // A neck, and the head (sunk forward on a climber's shoulders).
  if (neck > 0.012)
    out.push(part("cylinder", 0, L + tor + neck / 2, 0.01, 0.05 * G, neck + 0.02, 0.05 * G));
  const hy = stooped ? L + tor * 0.94 + hs / 2 : L + tor + neck + hs / 2,
    hz = stooped ? d * 0.5 : 0;
  out.push(...headParts(look, hy, hz, hs, detail));
  // Arms: a pair from the shoulders, a second below them for the four-handed; hands at their ends.
  const pairs: [number, number, number][] = [[shoulder, A, 0.55]];
  if (look.arms === 4) pairs.push([shoulder - tor * 0.42, A * 0.85, 0.45]);
  for (const [top, len, swing] of pairs)
    for (const side of [-1, 1]) {
      const x = side * (w / 2 + 0.025);
      out.push(
        limb(
          part("box", x, top - len / 2, 0, 0.045 * look.girth, len, 0.05, 1),
          -side * swing,
          len / 2 - 0.01,
          "arm",
        ),
      );
      if (detail >= 1)
        out.push(
          limb(
            part("box", x, top - len - 0.012, 0.005, 0.05, 0.04, 0.055, 2),
            -side * swing,
            len + 0.002,
            "arm",
          ),
        );
    }
  // A tail out behind.
  if (look.tail > 0.12) {
    const tl = 0.05 + 0.25 * look.tail;
    out.push(part("box", 0, L + 0.01, -(d / 2 + tl / 2), 0.04 * G, 0.04 * G, tl, 1));
    if (detail >= 2) out.push(part("box", 0, L + 0.01, -(d / 2 + tl), 0.055, 0.055, 0.05, 3));
  }
  return out;
}

/** An egg of a body on two long legs, a neck up to the head, small arms before, a tail fan behind. */
function strider(look: FolkLook, detail: number): FigurePart[] {
  const T = look.tall,
    G = look.girth,
    L = 0.24 * T,
    by = L + 0.1,
    out: FigurePart[] = [];
  out.push(part("capsule", 0, by, 0, 0.8 * G, 0.42, 0.9 * G));
  out.push(part("box", 0, by - 0.02, 0, 0.19 * G, 0.07, 0.21 * G, 5));
  out.push(...markings(look, by, 0.17 * G, 0.16, 0.18 * G, detail));
  for (const side of [-1, 1]) {
    out.push(limb(part("cylinder", side * 0.05, L / 2, 0, 0.03, L, 0.03, 1), 0.45 * side, L / 2));
    // Small arms with hands before the body.
    out.push(
      limb(
        part("box", side * 0.09 * G, by - 0.02, 0.07, 0.035, 0.12, 0.04, 1),
        -side * 0.45,
        0.05,
        "arm",
      ),
    );
  }
  // The neck up and forward, and the head.
  const nl = 0.06 + 0.12 * look.neck,
    hs = 0.1 * look.head;
  out.push(part("cylinder", 0, by + 0.08 + nl / 2, 0.08, 0.04, nl + 0.03, 0.04));
  out.push(...headParts(look, by + 0.08 + nl + hs / 2, 0.1, hs, detail));
  // A tail fan.
  if (look.tail > 0.12)
    out.push(
      part(
        "box",
        0,
        by + 0.02,
        -0.12 - 0.05 * look.tail,
        0.14 * G,
        0.1 + 0.08 * look.tail,
        0.02,
        3,
      ),
    );
  return out;
}

/** A mantle over a ring of arms (the front half reaching, the back half striding); eyes about its brow, a fin of a crest, a collar of cloth. */
function mantle(b: FigureBody, look: FolkLook, detail: number): FigurePart[] {
  const T = look.tall,
    G = look.girth,
    my = 0.34 * T,
    out: FigurePart[] = [part("capsule", 0, my, 0, 0.9 * G, 0.6 * T, 0.9 * G)],
    n = Math.max(4, Math.min(8, b.limbs));
  out.push(part("cylinder", 0, 0.14, 0, 0.2 * G, 0.05, 0.2 * G, 5));
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n,
      x = 0.09 * G * Math.cos(a),
      z = 0.09 * G * Math.sin(a);
    out.push(
      limb(
        part("cylinder", x, 0.1, z, 0.035, 0.2, 0.035, 1),
        (i % 2 ? 1 : -1) * 0.35,
        0.09,
        z > 0 ? "arm" : "leg",
      ),
    );
  }
  // (The mantle's middle up: its brow, where the eyes are.)
  const hs = 0.1 * G * look.head,
    front = 0.1 * G;
  if (detail >= 1) {
    const at =
      look.eyes === 1
        ? [0]
        : look.eyes === 2
          ? [-1, 1]
          : look.eyes === 3
            ? [-1, 0, 1]
            : [-1.5, -0.5, 0.5, 1.5];
    for (const k of at) {
      const a = k * 0.32;
      out.push(
        part("box", Math.sin(a) * front, my + 0.02, Math.cos(a) * front, 0.026, 0.024, 0.012, 4),
      );
    }
  }
  if (look.crest > 0)
    out.push(part("box", 0, my + 0.16 * T, -0.02, 0.02, 0.05 + 0.06 * look.crest, 0.14 * G, 3));
  if (look.feelers)
    for (const side of [-1, 1])
      out.push(part("cylinder", side * hs * 0.4, my + 0.2 * T, 0.03, 0.012, 0.1, 0.012, 3));
  out.push(...markings(look, my, 0.18 * G, 0.12, 0.18 * G, detail));
  return out;
}

/**
 * A low body on its legs: a trunked giant (four legs, a trunk that works for them, great ears);
 * a scaled crawler (four legs splayed, a raised front with clawed arms, a long tail); a shelled
 * shore-walker (a flat shell on four legs, two great claws, eyes on stalks); a burrower (a domed
 * shell on six legs, mandibles, long feelers). Each with a cloth over its back.
 */
function low(b: FigureBody, look: FolkLook, detail: number): FigurePart[] {
  const T = look.tall,
    G = look.girth,
    out: FigurePart[] = [];
  if (b.manipulators === "trunk") {
    const by = 0.32 * T;
    out.push(part("box", 0, by, 0, 0.3 * G, 0.22, 0.42 * T));
    out.push(part("box", 0, by + 0.115, -0.02, 0.3 * G * 1.03, 0.03, 0.24 * T, 5));
    out.push(...markings(look, by, 0.3 * G, 0.22, 0.42 * T, detail));
    out.push(...legs(4, 0.1 * G, 0.28 * T, 0.22 * T));
    const hs = 0.15 * look.head,
      hy = by + 0.06,
      hz = 0.21 * T + hs / 2;
    out.push(part("box", 0, hy, hz, hs, hs, hs));
    // The trunk, which works for them as hands do.
    out.push(
      limb(
        part("cylinder", 0, hy - 0.14, hz + hs / 2 + 0.01, 0.05, 0.22, 0.05, 1),
        0.35,
        0.1,
        "arm",
      ),
    );
    if (look.tusks)
      for (const side of [-1, 1])
        out.push(
          part("box", side * hs * 0.32, hy - hs * 0.42, hz + hs / 2 + 0.03, 0.02, 0.02, 0.09, 3),
        );
    for (const side of [-1, 1]) {
      const eh = 0.06 + 0.1 * look.ears;
      if (look.ears > 0)
        out.push(part("box", side * (hs / 2 + 0.01), hy + 0.01, hz - 0.01, 0.015, eh, eh * 0.8, 1));
      if (detail >= 1)
        out.push(
          part("box", side * hs * 0.3, hy + hs * 0.15, hz + hs / 2 + 0.003, 0.02, 0.02, 0.01, 4),
        );
    }
    if (look.crest > 0)
      out.push(part("box", 0, by + 0.13, 0, 0.02, 0.03 + 0.04 * look.crest, 0.3 * T, 3));
    if (look.tail > 0.12)
      out.push(part("box", 0, by, -(0.21 * T + 0.06), 0.02, 0.02, 0.06 + 0.1 * look.tail, 1));
    return out;
  }
  if (b.skin === "shell" && b.manipulators === "mandibles") {
    out.push(part("cone", 0, 0.14, 0, 0.36 * G, 0.16 * T, 0.46 * T));
    out.push(part("box", 0, 0.11, 0, 0.37 * G, 0.03, 0.12, 5));
    out.push(...legs(6, 0.14 * G, 0.3 * T, 0.08));
    const hs = 0.11 * look.head;
    out.push(
      ...headParts(
        { ...look, feelers: true, crest: 0, ears: 0, snout: 0 },
        0.1,
        0.24 * T,
        hs,
        detail,
      ),
    );
    for (const side of [-1, 1])
      out.push(
        limb(
          part("box", side * 0.035, 0.08, 0.24 * T + hs / 2 + 0.03, 0.025, 0.03, 0.07, 1),
          -side * 0.3,
          0.02,
          "arm",
        ),
      );
    return out;
  }
  if (b.skin === "shell") {
    out.push(part("box", 0, 0.12, 0, 0.34 * G, 0.1, 0.26 * T));
    if (look.crest > 0)
      out.push(part("box", 0, 0.18, 0, 0.03, 0.03 + 0.03 * look.crest, 0.2 * T, 3));
    out.push(part("box", 0, 0.172, -0.03, 0.18 * G, 0.012, 0.16 * T, 5));
    out.push(...markings(look, 0.12, 0.34 * G, 0.1, 0.26 * T, detail));
    out.push(...legs(4, 0.13 * G, 0.18 * T, 0.07));
    // Great claws, which work for them; eyes on stalks.
    for (const side of [-1, 1]) {
      out.push(
        limb(
          part("box", side * 0.2 * G, 0.13, 0.16 * T, 0.1, 0.06, 0.12, 1),
          -side * 0.4,
          0.02,
          "arm",
        ),
      );
      out.push(part("cylinder", side * 0.05, 0.22, 0.11 * T, 0.012, 0.1, 0.012, 3));
      out.push(part("box", side * 0.05, 0.28, 0.11 * T, 0.03, 0.03, 0.03, 4));
    }
    return out;
  }
  // A scaled crawler (and any other low body): four legs splayed under a long body, a raised
  // front with its clawed arms, its head on it, and a long tail.
  const by = 0.14;
  out.push(part("box", 0, by, -0.04, 0.16 * G, 0.1, 0.42 * T));
  out.push(...markings(look, by, 0.16 * G, 0.1, 0.42 * T, detail));
  out.push(...legs(4, 0.11 * G, 0.3 * T, 0.12));
  const fy = by + 0.12,
    fz = 0.15 * T;
  out.push(part("box", 0, fy, fz, 0.12 * G, 0.16, 0.08));
  out.push(part("box", 0, fy - 0.03, fz, 0.13 * G, 0.06, 0.09, 5));
  const hs = 0.1 * look.head;
  out.push(...headParts(look, fy + 0.08 + hs / 2, fz + 0.02, hs, detail));
  for (const side of [-1, 1]) {
    out.push(
      limb(
        part("box", side * (0.06 * G + 0.022), fy - 0.02, fz + 0.01, 0.04, 0.13, 0.045, 1),
        -side * 0.5,
        0.055,
        "arm",
      ),
    );
    if (detail >= 1)
      out.push(
        limb(
          part("cone", side * (0.06 * G + 0.022), fy - 0.1, fz + 0.03, 0.035, 0.04, 0.035, 3),
          -side * 0.5,
          0.135,
          "arm",
        ),
      );
  }
  const tl = 0.12 + 0.25 * look.tail;
  out.push(part("box", 0, by - 0.02, -0.25 * T - tl / 2 + 0.04, 0.06, 0.05, tl, 1));
  if (look.crest > 0)
    for (const k of [0, 1, 2])
      out.push(
        part("cone", 0, by + 0.07, -0.12 + k * 0.1, 0.03, 0.05 * look.crest + 0.03, 0.03, 3),
      );
  return out;
}

/**
 * How fast a people goes about its day, metres a second: an upright ape's easy walk;
 * long-legged striders faster, giants and low shelled bodies slower, swimmers gliding.
 */
export function paceOf(b: FigureBody | null): number {
  if (!b || b.clade === "ape") return 1.25;
  if (b.medium === "water") return 1.4;
  if (b.skin === "feathers") return 2;
  if (b.manipulators === "trunk") return 1;
  if (b.skin === "shell") return 0.75;
  if (b.skin === "scales") return 0.9;
  return 1.15;
}
