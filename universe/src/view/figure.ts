// A people's figure, as the microscope draws them (Phase 4 M42): their body plan as a
// few upright parts — a torso, a head, limbs, a shell or mantle, arms that radiate — so
// a village of upright apes, of feathered striders on their long legs, of many-armed
// swimmers under their mantles, reads at a glance. A pure function of the body; every
// person of a people shares it (sized for children), and the renderer instances each
// part. Units: a grown upright ape stands about 0.55 high; parts are placed around the
// figure's own middle, facing +z.

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
  /** 0 the body's own colour; 1 its limbs and features, a shade darker. */
  readonly tone: 0 | 1;
};

export type Figure = {
  readonly parts: readonly FigurePart[];
  /** The whole figure's scale against an upright ape's (bigger bodies, bigger figures). */
  readonly scale: number;
};

const part = (
  shape: PartShape,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  tone: 0 | 1 = 0,
): FigurePart => ({ shape, x, y, z, sx, sy, sz, tone });

/** Legs under a body: `n` of them, spread across its length. */
function legs(n: number, spread: number, length: number, high: number): FigurePart[] {
  const out: FigurePart[] = [];
  const pairs = Math.ceil(n / 2);
  for (let i = 0; i < pairs; i++) {
    const z = pairs === 1 ? 0 : -length / 2 + (length * i) / (pairs - 1);
    for (const side of [-1, 1])
      if (out.length < n)
        out.push(part("cylinder", side * spread, high / 2, z, 0.05, high, 0.05, 1));
  }
  return out;
}

/** How a people looks, from its body. */
export function figureOf(b: FigureBody | null): Figure {
  // Scale by the cube root of weight against an upright ape's (clamped for the eye).
  const scale = Math.min(2.4, Math.max(0.6, Math.cbrt((b?.size ?? 60) / 60)));
  if (!b || b.clade === "ape")
    // An upright ape: one standing body (as the microscope has always drawn them).
    return { parts: [part("capsule", 0, 0.28, 0, 1, 1, 1)], scale };
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
  // Four-handed climbers and the rest: a standing body with arms hanging.
  return {
    parts: [
      part("capsule", 0, 0.26, 0, 1, 0.9, 1),
      part("cylinder", -0.13, 0.26, 0, 0.04, 0.26, 0.04, 1),
      part("cylinder", 0.13, 0.26, 0, 0.04, 0.26, 0.04, 1),
    ],
    scale,
  };
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
