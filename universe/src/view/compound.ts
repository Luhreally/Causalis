// A home drawn as one part (asked 2026-11-21: "far and thinned homes as one-part merged meshes"): its walls and roof, a
// tower's frames, tar and mast, a block's tar, each home's bands of windows, laid out once in a unit shape that is drawn as
// one instance. The same building as its parts drawn each alone (homeAt, rowAt): each piece where that part stood, as a
// share of the home's breadth, height and depth, and in metres up where a part is as thick wherever it stands (a frame of a
// floor, a roof's tar, a mast). The renderer builds each shape's mesh from these (render/compound.ts); a check lays them out
// again as parts (compoundParts), to hold them to the parts they stand for.

type Rgb = readonly [number, number, number];

/** The shapes drawn as one instance: a home's walls and pitched roof, or flat; a tall home's walls and tar; a tower whole. */
export type CompoundMesh = "house" | "houseFlat" | "block" | "tower" | "plot" | "plotCar";
/** The windows drawn as one instance, lit at night: a townhouse's storeys, a tenement's and a block's bands, a tower's. */
export type LampMesh = "bands3" | "bands2" | "bands5" | "bands6";

/** Whose colour a piece is drawn in: the instance's, its roof's, a tower's frames', a flat roof's tar. */
export const TONE = { own: 0, roof: 1, frame: 2, tar: 3 } as const;

/**
 * A piece of a shape: its mesh; its colour (TONE); its middle (c) and size (s) as shares of the instance's breadth, height
 * and depth about the instance's middle, and `dy`, `hy` metres more up and high (a part as thick wherever it stands). A
 * roof's piece is laid by the instance's roof (its own breadth, height and depth, on the walls' top), its c and s unused.
 * `skip`: a box's faces never seen (under a roof, on the ground), left out.
 */
export type CompoundPiece = {
  readonly mesh: "box" | "gable";
  readonly tone: number;
  readonly c: readonly [number, number, number];
  readonly s: readonly [number, number, number];
  readonly dy: number;
  readonly hy: number;
  readonly roof?: boolean;
  readonly skip?: readonly ("top" | "bottom")[];
};

const piece = (
  mesh: "box" | "gable",
  tone: number,
  c: readonly [number, number, number],
  s: readonly [number, number, number],
  dy = 0,
  hy = 0,
  skip: readonly ("top" | "bottom")[] = [],
  roof = false,
): CompoundPiece => ({ mesh, tone, c, s, dy, hy, skip, roof });

const WALLS = piece("box", TONE.own, [0, 0, 0], [1, 1, 1], 0, 0, ["top", "bottom"]);
/** A tall home's tar: 2% broader than its walls, half a metre thick, on their top. */
const TAR_PIECE = piece("box", TONE.tar, [0, 0.5, 0], [1.02, 0, 1.02], 0.25, 0.5, ["bottom"]);
/** A tower's bands (view/town.ts towerBand): six, each a frame and under it its windows. */
const TOWER_BANDS = 6;

/**
 * A home's own plot where its town sprawls (bridge/districts.ts): a hedge or fence down each side and across its back, its
 * drive paved before it; and the engine its household rides, standing on its drive. Laid on a lot (PLOT: its breadth,
 * the hedge's height, its depth, metres), its pieces in shares of those.
 */
export const PLOT = { w: 9, h: 1.1, d: 14 } as const;
const PLOT_PIECES: readonly CompoundPiece[] = [
  piece("box", TONE.own, [-4.2 / PLOT.w, 0, 0], [0.6 / PLOT.w, 1, 13.2 / PLOT.d], 0, 0, ["bottom"]),
  piece("box", TONE.own, [4.2 / PLOT.w, 0, 0], [0.6 / PLOT.w, 1, 13.2 / PLOT.d], 0, 0, ["bottom"]),
  piece("box", TONE.own, [0, 0, 6.7 / PLOT.d], [7.8 / PLOT.w, 1, 0.6 / PLOT.d], 0, 0, ["bottom"]),
  // (Its drive: before the house, the street side, a hand thick on the ground.)
  piece(
    "box",
    TONE.tar,
    [1.5 / PLOT.w, -0.5, -5.15 / PLOT.d],
    [5 / PLOT.w, 0, 3.5 / PLOT.d],
    0.04,
    0.08,
    ["bottom"],
  ),
];
const CAR_PIECES: readonly CompoundPiece[] = [
  // (Its body along the street on its drive, and its cabin on it.)
  piece(
    "box",
    TONE.frame,
    [1.5 / PLOT.w, -0.5, -5.15 / PLOT.d],
    [4.2 / PLOT.w, 0, 1.8 / PLOT.d],
    0.58,
    0.8,
    ["bottom"],
  ),
  piece(
    "box",
    TONE.frame,
    [1.3 / PLOT.w, -0.5, -5.15 / PLOT.d],
    [2.2 / PLOT.w, 0, 1.6 / PLOT.d],
    1.28,
    0.6,
    ["bottom"],
  ),
];

export const COMPOUNDS: Readonly<Record<CompoundMesh, readonly CompoundPiece[]>> = {
  house: [WALLS, piece("gable", TONE.roof, [0, 0, 0], [1, 1, 1], 0, 0, [], true)],
  houseFlat: [WALLS, piece("box", TONE.roof, [0, 0, 0], [1, 1, 1], 0, 0, ["bottom"], true)],
  block: [WALLS, TAR_PIECE],
  tower: [
    WALLS,
    ...Array.from({ length: TOWER_BANDS }, (_, k) =>
      piece("box", TONE.frame, [0, (k + 0.6) / TOWER_BANDS - 0.5, 0], [1.01, 0, 1.01], 0, 0.5, [
        "top",
        "bottom",
      ]),
    ),
    TAR_PIECE,
    // (Its mast: 0.4 m square on a tower's 7.8 by 11, ten metres up from its roof.)
    piece("box", TONE.frame, [0, 0.5, 0], [0.4 / 7.8, 0, 0.4 / 11], 5, 10, ["bottom"]),
  ],
  plot: PLOT_PIECES,
  plotCar: [...PLOT_PIECES, ...CAR_PIECES],
};

/** Bands of windows, a share of the home's height apart, each `high` metres, `wide` and `deep` of the home. */
function bands(n: number, at: number, high: number, wide: number, deep: number): CompoundPiece[] {
  return Array.from({ length: n }, (_, k) =>
    piece("box", TONE.own, [0, (k + at) / n - 0.5, 0], [wide, 0, deep], 0, high),
  );
}

export const LAMP_COMPOUNDS: Readonly<Record<LampMesh, readonly CompoundPiece[]>> = {
  // (A townhouse's storeys: three, front and back, 78% of its breadth.)
  bands3: bands(3, 0.55, 0.9, 0.78, 1.02),
  bands2: bands(2, 0.6, 0.8, 1.01, 1.01),
  bands5: bands(5, 0.6, 0.8, 1.01, 1.01),
  // (A tower's: under each frame, half a band's height down.)
  bands6: bands(TOWER_BANDS, 0.6 - 0.5, 1.2, 1.005, 1.005),
};

/** Whether a group's mesh is a shape drawn as one (not a plain part). */
export function isCompound(mesh: string): mesh is CompoundMesh | LampMesh {
  return mesh in COMPOUNDS || mesh in LAMP_COMPOUNDS;
}

/** A shape's frame of reference in the colours it is drawn in (TONE). */
export type CompoundTones = readonly [Rgb, Rgb, Rgb, Rgb];

/**
 * The parts an instance of a shape stands for (x, y, z, sx, sy, sz, yaw, each with its colour), as its pieces lie: for a
 * check that a home drawn as one is the home drawn part by part. `roof`: its roof's breadth, height and depth (metres).
 */
export function compoundParts(
  mesh: CompoundMesh | LampMesh,
  tones: CompoundTones,
  at: readonly number[],
  roof: readonly [number, number, number] | null = null,
): { mesh: "box" | "gable"; color: Rgb; at: number[] }[] {
  const [x, y, z, sx, sy, sz, yaw] = at as [number, number, number, number, number, number, number],
    pieces =
      (COMPOUNDS as Record<string, readonly CompoundPiece[]>)[mesh] ??
      LAMP_COMPOUNDS[mesh as LampMesh],
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    out: { mesh: "box" | "gable"; color: Rgb; at: number[] }[] = [];
  for (const p of pieces) {
    if (p.roof) {
      if (!roof) continue;
      out.push({
        mesh: p.mesh,
        color: tones[p.tone]!,
        at: [x, y + sy / 2 + roof[1] / 2, z, roof[0], roof[1], roof[2], yaw],
      });
      continue;
    }
    // (Along the home's breadth and depth as turned: x' = x + u·cos + v·sin, z' = z − u·sin + v·cos.)
    const u = p.c[0] * sx,
      v = p.c[2] * sz;
    out.push({
      mesh: p.mesh,
      color: tones[p.tone]!,
      at: [
        x + u * c + v * s,
        y + p.c[1] * sy + p.dy,
        z - u * s + v * c,
        p.s[0] * sx,
        p.s[1] * sy + p.hy,
        p.s[2] * sz,
        yaw,
      ],
    });
  }
  return out;
}
