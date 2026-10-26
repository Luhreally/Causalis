// The blows drawn (Phase 55, asked for 2026-10-26: "and like even in the sim battles where its
// like reenactted or wtv it should be more graphic, and realistic where ever they are getting
// damaged yk"): how one struck is posed — reeling from the blow, down on one knee clutching the
// wound, limping or propped back, sitting behind the lines, slumped in the saddle, one helping
// them; the dead going down as their wound throws them (a leg giving way, folding where they
// stood, thrown back, knocked off their feet) — and where on the figure a wound, the stump of a
// part cut off and a shaft stuck in them are drawn, posed with the part as it swings and the body
// as it leans; and a part cut off, lying apart. Pure: render/battle.ts's BattleLayer poses and
// draws each one struck by these. Units: the figure's own (as its parts'), radians.
import {
  BLOW_PLACES,
  FALL_LONG,
  STAGGER,
  STRIDES,
  partExtent,
  type BlowFall,
  type BlowLost,
  type BlowPlace,
  type FigureAnatomy,
  type FigurePart,
  type TrooperNow,
} from "../view/index.ts";

/**
 * A fall's poses: at (a share of its time, FALL_LONG), lean (rad: + forward onto the face, −
 * back), sink (a share of the hips' height), and the right and left arms' and legs' swings (rad:
 * − forward and up, + back). A crumple goes down onto the back where its `back` says, its leans
 * turned about.
 */
export type FallKey = readonly [
  at: number,
  lean: number,
  sink: number,
  armR: number,
  armL: number,
  legR: number,
  legL: number,
];
export const FALL_KEYS: Readonly<Record<BlowFall, readonly FallKey[]>> = {
  // A leg gives way: down onto the knees, then forward onto the face, the arms out to break it.
  buckle: [
    [0, 0, 0, -0.15, 0, 0, 0],
    [0.35, 0.25, 0.45, -0.6, -0.5, -0.99, 0.99],
    [1, 1.47, 0, -2.4, -2.2, 0.2, -0.2],
  ],
  // Folding where they stood: the knees go, the arms drop, then down.
  crumple: [
    [0, 0, 0, -0.15, 0, 0, 0],
    [0.5, 0.3, 0.55, 0.1, -0.1, -1.1, 1.1],
    [1, 1.47, 0, 0.9, -0.6, -0.25, 0.25],
  ],
  // Thrown back by the blow, the arms flung up.
  thrown: [
    [0, 0, 0, -0.15, 0, 0, 0],
    [0.3, -0.6, 0, -2.2, -1.9, -0.3, 0.2],
    [1, -1.47, 0, -2.6, -2.4, -0.3, -0.1],
  ],
  // Knocked off their feet (the view lifts them and throws them back): sprawled on the back.
  blasted: [
    [0, 0, 0, -0.15, 0, 0, 0],
    [0.4, -1.2, 0, -2.8, -2.6, -0.8, -0.6],
    [1, -1.47, 0, -2.6, 2.2, -0.4, 0.3],
  ],
};

/** A pose of one struck, as it is worked out (kept and filled again: nothing made each frame). */
export type BlowPose = {
  lean: number;
  sink: number;
  armR: number;
  armL: number;
  legR: number;
  legL: number;
};
export const newPose = (): BlowPose => ({
  lean: 0,
  sink: 0,
  armR: 0,
  armL: 0,
  legR: 0,
  legL: 0,
});

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** A fall's pose `since` seconds in (onto the back for a crumple where `back`), into `out`. */
export function fallPose(fell: BlowFall, since: number, back: boolean, out: BlowPose): BlowPose {
  const keys = FALL_KEYS[fell],
    at = clamp01(since / FALL_LONG[fell]);
  let i = 0;
  while (i < keys.length - 2 && at > keys[i + 1]![0]) i++;
  const a = keys[i]!,
    b = keys[i + 1]!,
    f = smooth((at - a[0]) / Math.max(1e-6, b[0] - a[0])),
    turn = fell === "crumple" && back ? -1 : 1;
  // (Weighted so each key is met exactly.)
  out.lean = (a[1] * (1 - f) + b[1] * f) * turn;
  out.sink = a[2] * (1 - f) + b[2] * f;
  out.armR = a[3] * (1 - f) + b[3] * f;
  out.armL = a[4] * (1 - f) + b[4] * f;
  out.legR = a[5] * (1 - f) + b[5] * f;
  out.legL = a[6] * (1 - f) + b[6] * f;
  return out;
}

/** The arms of one clutching their wound (right, left), kept: nothing made each frame. */
const CLUTCH = {
  head: [-2.5, -2.5],
  armR: [0.05, -0.75],
  armL: [-0.75, 0.05],
  leg: [-0.35, -0.35],
  body: [-0.7, -0.6],
} as const satisfies Record<string, readonly [number, number]>;
/** The arms of one clutching their wound (right, left): hands to the head, to the belly, to the struck arm, down to the leg. */
export function clutchOf(hit: BlowPlace | undefined): readonly [number, number] {
  switch (hit) {
    case "head":
      return CLUTCH.head;
    case "arm-r":
    case "hand-r":
      return CLUTCH.armR;
    case "arm-l":
    case "hand-l":
      return CLUTCH.armL;
    case "leg-r":
    case "leg-l":
      return CLUTCH.leg;
    default:
      return CLUTCH.body;
  }
}

/** Their stride's phase (rad): render/battle.ts's for one walking. */
const stride = (t: TrooperNow) => t.cycle * 2 * Math.PI * STRIDES + t.id * 1.7;

/**
 * The pose of one struck, by what they are at (the wounded who live, one who helps, the dead with
 * a fall of their own), into `out`; false where the battle's own poses serve (and `out` is as it
 * was). Their stride's phase is `t.cycle`. (Most of those drawn are not struck: they are let go at
 * once, nothing worked out for them.)
 */
export function blowPose(t: TrooperNow, out: BlowPose): boolean {
  switch (t.act) {
    case "fall":
      if (!t.fell) return false;
      fallPose(t.fell, t.since ?? 0, t.back, out);
      return true;
    case "stagger": {
      // Reeling back from the blow, a step back, the hands going to it.
      const clutch = clutchOf(t.hit),
        e = clamp01((t.since ?? 0) / STAGGER),
        rock = Math.sin(Math.PI * e),
        h = smooth(e * 2);
      out.lean = -0.35 * rock;
      out.sink = 0;
      out.armR = -0.15 + (clutch[0] + 0.15) * h;
      out.armL = clutch[1] * h;
      out.legR = 0.3 * rock;
      out.legL = -0.15 * rock;
      return true;
    }
    case "kneel": {
      // Down on one knee, hunched over the wound, clutching it.
      const clutch = clutchOf(t.hit),
        d = t.down;
      out.lean = 0.3 * d;
      out.sink = 0.45 * d;
      out.armR = clutch[0];
      out.armL = clutch[1];
      out.legR = -0.99 * d;
      out.legL = 0.99 * d;
      return true;
    }
    case "sit": {
      // Sitting behind the lines, the legs out before them, holding the wound.
      const clutch = clutchOf(t.hit);
      out.lean = -0.15;
      out.sink = 0.86;
      out.armR = clutch[0];
      out.armL = clutch[1];
      out.legR = -1.42;
      out.legL = -1.42;
      return true;
    }
    case "limp":
    case "propped": {
      // A short step on the struck leg, a long one on the other; the body dipping onto it.
      const ph = stride(t),
        clutch = clutchOf(t.hit),
        leg = t.hit === "leg-r" || t.hit === "leg-l",
        r = t.hit === "leg-r" ? 0.15 : 0.45,
        l = t.hit === "leg-l" ? 0.15 : 0.45;
      out.lean = t.act === "propped" ? 0.15 : 0.12;
      out.sink = 0.06 * Math.max(0, Math.sin(ph));
      out.legR = -r * Math.sin(ph);
      out.legL = l * Math.sin(ph);
      // (Propped: the left arm over the shoulders of the one who helps them, on their left.)
      out.armR = leg ? -0.2 : clutch[0];
      out.armL = t.act === "propped" ? -2.3 : leg ? 0.2 : clutch[1];
      return true;
    }
    case "help": {
      // Walking a wounded one back: the right arm about them, a short careful step.
      const ph = stride(t);
      out.lean = 0.08;
      out.sink = 0;
      out.armR = -1;
      out.armL = 0.25 * Math.sin(ph);
      out.legR = -0.35 * Math.sin(ph);
      out.legL = 0.35 * Math.sin(ph);
      return true;
    }
    case "slump":
      // Slumped over their mount's neck, the arms hanging.
      out.lean = 0.65;
      out.sink = 0;
      out.armR = 0.1;
      out.armL = 0.1;
      out.legR = 0;
      out.legL = 0;
      return true;
    default:
      return false;
  }
}

/** A limb's swing in a pose: its side by where it hangs (the figure's right is −x). */
export function limbOfPose(part: FigurePart, p: BlowPose): number {
  const right = part.x < 0;
  return part.role === "arm" ? (right ? p.armR : p.armL) : right ? p.legR : p.legL;
}

/**
 * A point of a part, posed: (dx, dy, dz) from its middle, its limb turned `lp` about its hinge
 * and the whole tipped `lean` about the feet (render/battle.ts's posedPoint for any point), into
 * `out` (x across, y up, z forward; the figure's own units, before its turn and scale).
 */
export function posedAt(
  part: FigurePart,
  lp: number,
  lean: number,
  dx: number,
  dy: number,
  dz: number,
  out: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const hinge = part.pivot ?? 0,
    ry = dy - hinge,
    cy = Math.cos(lp),
    sy = Math.sin(lp),
    py = part.y + hinge + ry * cy - dz * sy,
    pz = part.z + ry * sy + dz * cy;
  out.x = part.x + dx;
  out.y = py * Math.cos(lean) - pz * Math.sin(lean);
  out.z = py * Math.sin(lean) + pz * Math.cos(lean);
  return out;
}

/** Of an arm or a leg cut off, the share of it left on them from its hinge: the stump. */
export const STUMP = { keep: 0.35 } as const;

/**
 * Where the stump of a part cut off is drawn: on which part, which way its raw end faces along
 * it (1 up, −1 down), how far up the part from its middle the raw end is, how much of the part is
 * left (1: all of it; less: an arm's or a leg's stump, drawn so short from its hinge), how wide and
 * deep (the figure's units): a limb's below its shoulder or hip, a hand's at its arm's end, a
 * head's on the trunk's top (null: the figure draws no such part). (A limb hinges above its middle.)
 */
export type Stump = {
  readonly part: number;
  readonly end: 1 | -1;
  readonly cut: number;
  readonly keep: number;
  readonly wide: number;
  readonly deep: number;
};
export function stumpOf(
  a: FigureAnatomy,
  parts: readonly FigurePart[],
  lost: BlowLost,
): Stump | null {
  const group = a.parts[lost];
  if (!group.length) return null;
  if (lost === "head") {
    const trunk = a.on.trunk,
      head = parts[a.on.head] ?? parts[group[0]!]!;
    if (trunk < 0) return null;
    const e = partExtent(head);
    return {
      part: trunk,
      end: 1,
      cut: partExtent(parts[trunk]!)[1] / 2,
      keep: 1,
      wide: e[0],
      deep: e[2],
    };
  }
  const hand = lost === "hand-l" || lost === "hand-r",
    arm = hand ? a.parts[lost === "hand-l" ? "arm-l" : "arm-r"][0] : group[0];
  if (arm === undefined) return null;
  const e = partExtent(parts[arm]!);
  return hand
    ? { part: arm, end: -1, cut: -e[1] / 2, keep: 1, wide: e[0], deep: e[2] }
    : {
        part: arm,
        end: -1,
        cut: (0.5 - STUMP.keep) * e[1],
        keep: STUMP.keep,
        wide: e[0],
        deep: e[2],
      };
}

/**
 * A part cut off, as it lies: its parts (indices) and each one's middle from the cut (dx, dy,
 * dz: the figure's units, the part upright), how high its cut end lies off the ground when laid
 * along it, how wide and deep its cut is, and how much of its first part lies apart (an arm's or
 * a leg's: what its stump did not keep). The cut: below a limb's hinge by its stump, a hand's
 * wrist, a head's neck.
 */
export type LooseLook = {
  readonly parts: readonly number[];
  readonly from: readonly (readonly [number, number, number])[];
  readonly lie: number;
  readonly wide: number;
  readonly deep: number;
  readonly short: number;
};
export function looseOf(
  a: FigureAnatomy,
  parts: readonly FigurePart[],
  lost: BlowLost,
): LooseLook | null {
  const group = a.parts[lost];
  if (!group.length) return null;
  const first = parts[group[0]!]!,
    e0 = partExtent(first),
    limb = lost !== "head" && lost !== "hand-l" && lost !== "hand-r",
    cut =
      lost === "head"
        ? (() => {
            const head = parts[a.on.head] ?? first,
              e = partExtent(head);
            return [head.x, head.y - e[1] / 2, head.z] as const;
          })()
        : !limb
          ? ([first.x, first.y + e0[1] / 2, first.z] as const)
          : ([first.x, first.y + (0.5 - STUMP.keep) * e0[1], first.z] as const),
    from = group.map((i, k) => {
      const p = parts[i]!,
        // (A limb's first part, shorn of its stump: its middle the lower.)
        down = limb && k === 0 ? (STUMP.keep * e0[1]) / 2 : 0;
      return [p.x - cut[0], p.y - down - cut[1], p.z - cut[2]] as const;
    }),
    lie = Math.max(...group.map((i, k) => partExtent(parts[i]!)[2] / 2 + Math.abs(from[k]![2]))),
    s = lost === "head" ? partExtent(parts[a.on.head] ?? first) : e0;
  return { parts: group, from, lie, wide: s[0], deep: s[2], short: limb ? 1 - STUMP.keep : 1 };
}

/** Each part's places as a mask (bit i: BLOW_PLACES[i]): which parts go with a place cut off. */
export function placeMasks(a: FigureAnatomy, count: number): Uint8Array {
  const masks = new Uint8Array(count);
  BLOW_PLACES.forEach((p, bit) => {
    for (const i of a.parts[p]) masks[i] = masks[i]! | (1 << bit);
  });
  return masks;
}
/** A place's bit in placeMasks. */
export function placeBit(p: BlowPlace): number {
  return 1 << BLOW_PLACES.indexOf(p);
}

/**
 * Of a shaft stuck in one, its way out of them in the figure's frame (a unit: back along its
 * flight, up as steeply as it came down), into `out`.
 */
export function shaftWay(
  yaw: number,
  dip: number,
  out: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const back = yaw + Math.PI;
  out.x = Math.sin(back) * Math.cos(dip);
  out.y = Math.sin(dip);
  out.z = Math.cos(back) * Math.cos(dip);
  return out;
}

/** A direction in the figure's frame, tipped `pitch` about x (the part's swing and lean) and turned `yaw`: in the world's. */
export function turned(
  d: { x: number; y: number; z: number },
  pitch: number,
  yaw: number,
  out: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    y = d.y * cp - d.z * sp,
    z = d.y * sp + d.z * cp,
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    x = d.x;
  out.x = x * c + z * s;
  out.y = y;
  out.z = -x * s + z * c;
  return out;
}
