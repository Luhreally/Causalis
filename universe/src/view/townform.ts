// A town's form drawn (bridge/form.ts says the rule; asked 2026-11-19): its main streets out from its square, set and marked
// for what goes down them; each lot's home as its ground's worth has it — wall to wall and a floor higher by the square, as
// its land builds between, apart in its yard at the edge (a garden where rain grows one, a shed and a drive where the
// household keeps an engine); its tall homes highest where ground is dearest; and what a market, a realm's seat and a temple
// put in a town that builds in stone: a colonnade about its square, a column in it, steps under its temple and a way kept
// broad to it between pillars. The same parts every home is drawn in, a few more of them: no mesh or batch of its own.
import {
  BLOCK_LOTS,
  LOT_D,
  LOT_W,
  SQUARE,
  TIER,
  PAINTED_FROM,
  STACKS,
  footprint,
  heightHeld,
  wallWalk,
  wallWet,
  lotTier,
  measuredBlocks,
  quarterOf,
  tallShare,
  type MainStreet,
  type MarketPlace,
  type TownPlan,
} from "../bridge/index.ts";
import { lifeTint } from "./biochem.ts";
import type { HouseLook } from "./village.ts";
import type { TownParts, TownScene } from "./town.ts";

type Rgb = readonly [number, number, number];

const STONE: Rgb = [0.74, 0.72, 0.66],
  GOLD: Rgb = [0.98, 0.8, 0.25],
  TIMBER: Rgb = [0.55, 0.38, 0.22],
  SETTS: Rgb = [0.8, 0.78, 0.72],
  TARMAC: Rgb = [0.25, 0.26, 0.29],
  ENGINE_STREET: Rgb = [0.4, 0.41, 0.44],
  TILE: Rgb = [0.74, 0.3, 0.2],
  TRACK: Rgb = [0.76, 0.68, 0.52],
  LINE: Rgb = [0.92, 0.9, 0.8],
  GARDEN: Rgb = [0.3, 0.56, 0.26],
  LEAF: Rgb = [0.16, 0.42, 0.2],
  SHED: Rgb = [0.62, 0.6, 0.56],
  DRIVE: Rgb = [0.4, 0.4, 0.42],
  AWNINGS: readonly Rgb[] = [
    [0.72, 0.22, 0.2],
    [0.2, 0.46, 0.3],
    [0.82, 0.62, 0.2],
    [0.24, 0.36, 0.62],
  ];

/** The steps a tall home's height is told in (of its kind's own height): a few, so its windows' bands stay a few batches. */
const TALL_STEPS = 12,
  TALL_LOW = 0.45,
  TALL_STEP = 0.1;

const LIME_Q: Rgb = [0.95, 0.93, 0.86],
  OCHRE_Q: Rgb = [0.86, 0.66, 0.3];

/** How dark a block's walls and roofs have weathered, oldest first; and what a quarter's roofing leans to. */
const WEATHERED = [0.72, 0.86, 1, 1.09],
  ROOF_WARM: Rgb = [0.72, 0.5, 0.24],
  ROOF_DARK: Rgb = [0.3, 0.22, 0.2],
  ROOF_FINE: Rgb = [0.86, 0.3, 0.16],
  ROOF_GREY: Rgb = [0.45, 0.5, 0.52],
  SOOT: Rgb = [0.3, 0.29, 0.28],
  DAMP: Rgb = [0.58, 0.66, 0.7],
  EARTHY: Rgb = [0.75, 0.6, 0.45],
  /**
   * What each quarter's walls and roofs lean to, by what the quarter is (bridge/sites.ts QUARTER: toward its water, its
   * lee, its high ground, its busiest way in; four more about them): [the walls' lean and how far, the roofs']. In the
   * lee stand its smithies and kilns, and soot lies on everything; on the high ground its well-off, limed and under
   * the best roofing; down its road its traders, their fronts washed to be seen; by its water the damp greys both.
   */
  QUARTER_TONE: readonly (readonly [Rgb, number, Rgb, number])[] = [
    [DAMP, 0.2, ROOF_GREY, 0.34],
    [SOOT, 0.34, ROOF_DARK, 0.4],
    [LIME_Q, 0.3, ROOF_FINE, 0.45],
    [OCHRE_Q, 0.26, ROOF_WARM, 0.3],
    [EARTHY, 0, ROOF_WARM, 0.12],
    [EARTHY, 0.14, ROOF_DARK, 0.14],
    [EARTHY, 0, ROOF_DARK, 0],
    [EARTHY, 0.14, ROOF_WARM, 0.2],
  ],
  GLASS_BLUE: Rgb = [0.44, 0.58, 0.7],
  GLASS_GREEN: Rgb = [0.4, 0.62, 0.62],
  GLASS_GREY: Rgb = [0.56, 0.6, 0.66];

/** Lime, and the washes a front is painted in where there is something to spare. */
const LIME: Rgb = [0.95, 0.93, 0.86],
  OCHRE: Rgb = [0.86, 0.66, 0.3],
  BRICK: Rgb = [0.66, 0.32, 0.24],
  CONCRETE: Rgb = [0.7, 0.69, 0.65],
  SLATE: Rgb = [0.34, 0.36, 0.42];
const mixed = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

/** A whole number's share in [0, 1), a lot's own. */
function share(p: number, k: number): number {
  let h = (Math.imul(p + 1, 0x9e3779b1) ^ Math.imul(k + 3, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/**
 * Each drawn lot's ground and how high a tall home stands on it (null: the plan carries no form): its tier (TIER) in the low
 * two bits, its height's step above them. The walls counted are those that still stand about it.
 */
export function formTiers(plan: TownPlan, walled: boolean): Uint8Array | null {
  const form = plan.form;
  if (!form || plan.sealed) return null;
  const n = plan.lots,
    out = new Uint8Array(n),
    within = walled && plan.walls ? plan.walls.reach : 0;
  for (let p = 0; p < n; p++) {
    const tall = tallShare(form, p, plan.whole) * (0.86 + 0.28 * share(p, 1)),
      step = Math.max(0, Math.min(TALL_STEPS - 1, Math.round((tall - TALL_LOW) / TALL_STEP)));
    out[p] = lotTier(form, p, plan.whole, within) | (step << 2);
  }
  return out;
}

/** A lot's tier (TIER.town where the plan carries no form). */
export function tierOf(scene: TownScene, p: number): number {
  return scene.tiers ? scene.tiers[p]! & 3 : TIER.town;
}

/**
 * The look a lot's home stands in: its design's, as its ground's worth, its weather and its people have it. By the square
 * wall to wall and a floor higher (a round house cannot stand wall to wall: higher only); at the edge apart; a tall home as
 * high as its ground is dear. Its walls washed pale where the sun is the enemy, its front painted in one of a few washes
 * where its land has something to spare; its roof steeper where it sheds snow; its floors as high as its people are; its
 * tall homes in what its land stacks (stone, brick, sun-dried brick), in fired brick where it builds in what cannot be
 * stacked. One look to each design, tier, step and wash, made once for the scene.
 */
export function formLook(scene: TownScene, p: number, index: number): HouseLook | undefined {
  const base = scene.looks[index] ?? scene.looks[0];
  if (!base || !scene.tiers) return base;
  const code = scene.tiers[p]!,
    form = scene.plan.form!,
    // (Two washes: one front in three painted, the rest in its land's own stuff. Each wash is a batch more to a design.)
    wash = form.spare >= PAINTED_FROM && share(p, 7) < 0.34 ? 1 : 0,
    // (Its block's age and quarter: the older the block the more its walls have weathered, and each quarter roofs a little
    // its own way. A tone to each of four ages and three roofings: every one rides in its instance, no batch more.)
    block = p >> 3,
    aged = Math.min(
      3,
      Math.floor(4 * Math.sqrt((p + 0.5) / Math.max(1, scene.plan.whole))) +
        (share(block, 9) < 0.3 ? 1 : 0),
    ),
    quarter = quarterOf(scene.plan.seed, block),
    roofing = (quarter + (share(block, 11) < 0.4 ? 1 : 0)) % 3,
    key = (((scene.looks[index] ? index : 0) * 64 + code) * 4 + wash) * 32 + aged * 8 + quarter;
  let look = scene.formLooks.get(key);
  if (!look) {
    const tier = code & 3,
      storey = Math.max(0.75, Math.min(1.5, form.body)),
      tall = (TALL_LOW + (code >> 2) * TALL_STEP) * storey,
      plain = base.tent || base.open || base.raised > 0,
      walls = scene.plan.designs[scene.looks[index] ? index : 0]?.walls ?? "",
      limed = form.pale > 0 && !plain ? mixed(base.wall, LIME, form.pale) : base.wall,
      weather = WEATHERED[aged]!,
      toned = (c: Rgb): Rgb => [c[0] * weather, c[1] * weather, c[2] * weather],
      lean = QUARTER_TONE[quarter]!,
      wall = plain
        ? base.wall
        : toned(mixed(wash === 1 ? mixed(limed, OCHRE, 0.4) : limed, lean[0], lean[1])),
      roofed = plain ? base.roof : toned(mixed(base.roof, lean[2], lean[3])),
      stuff = form.own
        ? mixed(wall, [0, 0, 0], 0.15)
        : STACKS.has(walls)
          ? mixed(wall, [0.3, 0.26, 0.24], 0.18)
          : form.pale > 0
            ? mixed(BRICK, LIME, form.pale * 0.7)
            : BRICK,
      steep = base.rise >= 0.1 ? form.steep : 1;
    look = {
      ...base,
      wall,
      roof: roofed,
      glass: toned(roofing === 1 ? GLASS_GREEN : roofing === 2 ? GLASS_GREY : GLASS_BLUE),
      tall,
      // (Those who fly lose nothing by a floor more: their townhouses by the square stand half as high again.)
      storey: storey * (form.winged && tier === TIER.heart && !plain ? 1.45 : 1),
      stuff,
      block: mixed(CONCRETE, form.own ? wall : stuff, form.own ? 0.5 : 0.22),
      // (A roof that sheds snow is laid dark, in slate or shingle; one pitched for rain keeps its land's roofing.)
      ...(steep > 1
        ? {
            rise: base.rise * steep,
            steep,
            ...(steep >= 1.5 ? { roof: mixed(roofed, SLATE, 0.45) } : {}),
          }
        : {}),
      ...(form.own ? { own: true } : {}),
      ...(plain
        ? {}
        : tier === TIER.heart
          ? base.round
            ? { height: base.height * storey * (form.winged ? 1.9 : 1.35) }
            : {
                joined: true,
                length: Math.max(base.length, 0.9),
                height: base.height * storey * (form.winged ? 2.1 : 1.55),
              }
          : tier === TIER.edge
            ? { apart: true, height: base.height * storey }
            : { height: base.height * storey }),
    };
    scene.formLooks.set(key, look);
  }
  return look;
}

/** A part placed by an offset in a turned frame: (u along, v across) from (x, z), turned by yaw. */
function at(x: number, z: number, yaw: number, u: number, v: number): [number, number] {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [x + u * c + v * s, z - u * s + v * c];
}

/**
 * What stands in a home's yard. At the edge: a garden behind it and a tree where its land's rain grows them (the
 * drier the fewer), a shed and a drive beside it where the household keeps an engine (as many as do).
 */
export function edgeYard(
  scene: TownScene,
  out: TownParts,
  p: number,
  x: number,
  z: number,
  yaw: number,
  deep: number,
): void {
  const form = scene.plan.form;
  if (!form) return;
  if (tierOf(scene, p) !== TIER.edge) {
    // Between the heart and the edge a yard is small, and smaller the nearer the square: a tree in some, more of them
    // the further out (as the ground grows cheaper).
    const out01 = Math.sqrt((p + 0.5) / Math.max(1, scene.plan.whole)),
      far = Math.max(0, (out01 - form.heart) / Math.max(0.05, form.edge - form.heart));
    if (tierOf(scene, p) === TIER.town && share(p, 3) < form.green * 0.3 * far * far) {
      const [tx, tz] = at(x, z, yaw, -LOT_W / 2 + 1.4, LOT_D / 2 - 1.8),
        high = 3.6 + 3 * share(p, 4);
      out.put(
        "cone",
        lifeTint(LEAF, scene.plan.lifeLook),
        tx,
        high / 2 + 0.4,
        tz,
        high * 0.6,
        high,
        high * 0.6,
        0,
      );
    }
    return;
  }
  const back = Math.min(LOT_D / 2 - 1.6, deep / 2 + 2.4),
    // (A shed to one household in three of those that keep an engine: the rest stand theirs in the street.)
    shed = form.drive && share(p, 5) < form.rides / 3;
  // (A cottage has one window where a house has two: what stands in its yard is drawn in the part that saves, and no more.)
  if (!shed && form.green >= 0.12 && share(p, 2) < form.green * 0.3) {
    const [gx, gz] = at(x, z, yaw, -0.8, back);
    out.put(
      "box",
      lifeTint(GARDEN, scene.plan.lifeLook),
      gx,
      0.66,
      gz,
      LOT_W - 3.4,
      0.34,
      LOT_D / 2 - deep / 2 - 1,
      yaw,
    );
  }
  // (A tree in one part: its crown down to the ground, as a child draws one.)
  if (share(p, 3) < form.green * 0.28) {
    const [tx, tz] = at(x, z, yaw, -LOT_W / 2 + 1.6, back + 0.4),
      high = 4.2 + 3.4 * share(p, 4);
    out.put(
      "cone",
      lifeTint(LEAF, scene.plan.lifeLook),
      tx,
      high / 2 + 0.4,
      tz,
      high * 0.62,
      high,
      high * 0.62,
      0,
    );
  }
  if (shed) {
    // (Its shed at the head of its drive, the drive one slab from the street to it.)
    const [sx, sz] = at(x, z, yaw, LOT_W / 2 - 1.7, 0.6),
      [dx, dz] = at(x, z, yaw, LOT_W / 2 - 1.7, -LOT_D / 4 - 0.4);
    out.put("box", SHED, sx, 1.6, sz, 2.8, 2.2, 4.6, yaw);
    if (share(p, 6) < 0.25) out.put("box", DRIVE, dx, 0.53, dz, 2.4, 0.06, LOT_D / 2 - 1.8, yaw);
  }
}

/** Whether an angle lies within `off` of any of a list. */
function nearAny(a: number, list: readonly number[], off: number): boolean {
  for (const b of list) {
    const d = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    if (d < off) return true;
  }
  return false;
}

/** The lengths of a main street drawn: those fronted by the blocks drawn, clear of the greatest fire's ash. */
function drawnLengths(m: MainStreet, blocks: number, ashBlocks: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < m.since.length; i++)
    if (m.since[i]! < blocks && m.since[i]! >= ashBlocks) out.push(i);
  return out;
}

/**
 * The ground of the street about block `b`, as its age has it: laid for engines, tarred; measured out before it was built,
 * set evener and a shade paler than a lane; else `lane`, the town's own (trodden, or paved as its city paves).
 */
export function streetOf(scene: TownScene, b: number, lane: Rgb): Rgb {
  const form = scene.plan.form;
  if (!form || form.over) return lane;
  if (form.engines >= 0 && b >= form.engines) return ENGINE_STREET;
  return measuredBlocks(scene.lots.blocks)?.[b] ? mixed(lane, SETTS, 0.45) : lane;
}

/** A yard trodden to its earth; how much lighter or darker one block's ground is than the next (by its number). */
const EARTH: Rgb = [0.6, 0.53, 0.4],
  BLOCK_SHADES = [0.92, 0.97, 1.02, 1.07] as const;
type GroundTones = { readonly yard: Rgb; readonly yards: Rgb[]; readonly verge: Rgb };
const groundTones = new WeakMap<TownScene, GroundTones>();

function tonesOf(scene: TownScene, yard: Rgb): GroundTones {
  const had = groundTones.get(scene);
  if (had && had.yard === yard) return had;
  const { plan } = scene,
    green = plan.form?.green ?? 0.5,
    lush = lifeTint(GARDEN, plan.lifeLook),
    shaded = (c: Rgb, k: number): Rgb => [
      Math.min(1, c[0] * k),
      Math.min(1, c[1] * k),
      Math.min(1, c[2] * k),
    ],
    // (By tier: trodden by the square, worn between as little grows there, lawns and gardens at the edge as green as its land grows.)
    byTier: Rgb[] = [
      mixed(yard, EARTH, 0.45),
      mixed(yard, EARTH, Math.max(0.08, 0.36 - 0.3 * green)),
      mixed(yard, lush, 0.15 + 0.4 * green),
    ],
    yards: Rgb[] = [];
  for (const c of byTier) for (const k of BLOCK_SHADES) yards.push(shaded(c, k));
  const tones = { yard, yards, verge: shaded(mixed(yard, lush, 0.55), 1.1) };
  groundTones.set(scene, tones);
  return tones;
}

/**
 * The ground of block `b`'s yards, as its plan has it (`yard`, its land's grass): trodden by the square, worn between where
 * little grows, lawns and gardens at its edge as green as its land grows them; and each block a shade its own of four, so
 * one block's ground is told from the next even from afar. The same few colours over the whole town (a batch's own tones).
 */
export function yardTone(scene: TownScene, b: number, yard: Rgb): Rgb {
  const form = scene.plan.form,
    p = b * BLOCK_LOTS,
    // (Its own lots' tiers know its walls; those past them are out where no wall stood.)
    tier =
      scene.tiers && p < scene.tiers.length
        ? tierOf(scene, p)
        : form
          ? lotTier(form, p, scene.plan.whole)
          : TIER.town;
  return tonesOf(scene, yard).yards[tier * 4 + Math.floor(share(b, 9) * 4)]!;
}

/** The grass of the verges a street laid for engines keeps along its blocks (sites.ts StreetsLaid), mown and fresher than a yard. */
export function vergeTone(scene: TownScene, yard: Rgb): Rgb {
  return tonesOf(scene, yard).verge;
}

/** A column: its base, its shaft, its head, and what stands on it. */
function column(out: TownParts, x: number, z: number, high: number, top: Rgb): void {
  const wide = 1.5 + high / 22;
  out.put("box", STONE, x, 1.2, z, wide * 2.8, 2, wide * 2.8, 0);
  out.put("cyl", STONE, x, 2.2 + high / 2, z, wide, high, wide, 0);
  out.put("box", STONE, x, 2.2 + high + 0.3, z, wide * 1.5, 0.6, wide * 1.5, 0);
  out.put("box", top, x, 2.2 + high + 1.9, z, wide * 0.8, 2.6, wide * 0.8, 0);
}

/**
 * A town's market place on the ground kept for it: set (trodden where its town does not pave), its market under cover down
 * its long sides (a colonnade roofed in tile where its land builds in stone, posts and awnings where it does not), stalls
 * in the open, and the realm's column where one is seated here (a well else).
 */
function marketPlace(scene: TownScene, out: TownParts, place: MarketPlace): void {
  const { plan } = scene,
    form = plan.form!,
    { x, z, yaw, w, d } = place,
    high = form.cover,
    put = (
      mesh: "box" | "cyl" | "gable" | "cone",
      c: Rgb,
      u: number,
      y: number,
      v: number,
      su: number,
      sy: number,
      sv: number,
    ) => {
      const [px, pz] = at(x, z, yaw, u, v);
      out.put(mesh, c, px, y, pz, su, sy, sv, yaw);
    };
  put("box", plan.paved || form.stone ? SETTS : TRACK, 0, 0.3, 0, w + 3, 0.3, d + 3);
  // Its cover down each long side (a place beside its street has one, at its back).
  const sides = place.through ? [-1, 1] : [1],
    deep = 4.4,
    n = Math.max(4, Math.round(w / 9));
  for (const side of sides) {
    const v = side * (d / 2 - deep / 2 + 1);
    if (form.forum === 2) {
      // (A wall at its back, columns to the place, a roof of tile over.)
      put("box", STONE, 0, high / 2, v + side * (deep / 2 - 0.3), w, high, 0.6);
      for (let k = 0; k < n; k++)
        put(
          "cyl",
          STONE,
          ((k + 0.5) / n - 0.5) * w,
          high / 2,
          v - side * (deep / 2 - 0.4),
          0.9,
          high,
          0.9,
        );
      put("gable", TILE, 0, high + 0.9, v, w + 0.8, 1.8, deep + 1);
    } else if (form.forum === 1)
      for (let k = 0; k < n; k += 2) {
        const u = ((k + 0.5) / n - 0.5) * w;
        put("box", TIMBER, u, 1.5, v, 0.3, 3, 0.3);
        put("box", AWNINGS[(k >> 1) % 2]!, u, 3.1, v - side * 0.8, 4.4, 0.2, 3.6);
      }
  }
  // Stalls in the open while it holds a market: rows of them, each under its own cloth.
  if (form.forum) {
    const rows = place.through ? [-1, 1] : [0],
      stalls = Math.max(2, Math.round(w / 24));
    for (const row of rows)
      for (let k = 0; k < stalls; k++)
        put(
          "box",
          AWNINGS[(k + (row > 0 ? 1 : 0)) % 2]!,
          ((k + 0.5) / stalls - 0.5) * (w - 6),
          2.5,
          row * (d / 4 + 1.5) - (place.through ? 0 : 2.5),
          3.6,
          0.2,
          2.8,
        );
  }
  // What stands at its middle (beside the street, where the street runs through it).
  const [cx, cz] = at(x, z, yaw, 0, place.through ? d / 4 - 4 : -d / 4);
  if (form.column > 0) column(out, cx, cz, form.column, plan.rank?.seat?.color ?? GOLD);
  else out.put("cyl", STONE, cx, 0.8, cz, 3, 1.2, 3, 0);
}

/** The height a town holds as its view draws it (bridge/form.ts heightHeld; null: none). */
export function heightOf(
  scene: TownScene,
): { x: number; z: number; yaw: number; keep: boolean } | null {
  const { plan } = scene,
    ring = scene.walls;
  if (!plan.site || !ring || !plan.walls || plan.sealed) return null;
  return heightHeld(
    plan.site,
    ring.line,
    plan.water,
    !!plan.rank?.seat,
    plan.civics.some((c) => c.kind === "temple" && c.fell === null && c.end <= plan.year),
  );
}

/** The height a town holds: a keep in the realm's colours where one rules from here, else a shrine; on a mound, towers at its corners. */
function height(
  scene: TownScene,
  out: TownParts,
  h: { x: number; z: number; yaw: number; keep: boolean },
): void {
  const { plan } = scene,
    form = plan.form!,
    c = plan.rank?.seat?.color ?? GOLD,
    rock = STONE,
    wall = form.stone ? STONE : TIMBER;
  out.put("cyl", rock, h.x, 2.2, h.z, 34, 4.4, 34, 0);
  out.put("cyl", rock, h.x, 5.4, h.z, 24, 2.4, 24, 0);
  if (h.keep) {
    const tall = 13 + 6 * form.spare;
    out.put("box", wall, h.x, 6.6 + tall / 2, h.z, 11, tall, 11, h.yaw);
    out.put("box", wall, h.x, 6.6 + 3, h.z, 19, 6, 19, h.yaw);
    for (const [du, dv] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const [tx, tz] = at(h.x, h.z, h.yaw, du * 9.5, dv * 9.5);
      out.put("cyl", wall, tx, 6.6 + 5, tz, 4.2, 10, 4.2, 0);
    }
    out.put("cone", c, h.x, 6.6 + tall + 2.5, h.z, 13, 5, 13, h.yaw);
  } else {
    // (A shrine on the height: a drum of columns under a dome, gilded where there is something to spare.)
    out.put("cyl", STONE, h.x, 7.1, h.z, 15, 1, 15, 0);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * 2 * Math.PI;
      out.put("cyl", STONE, h.x + 5.6 * Math.cos(a), 10.6, h.z + 5.6 * Math.sin(a), 1, 6, 1, 0);
    }
    out.put("dome", form.spare >= 0.5 ? GOLD : STONE, h.x, 13.6, h.z, 13, 5, 13, 0);
  }
}

/**
 * A town's form on its ground: its main streets; the ring street where its walls stood; its market place (about its square,
 * where no ground was kept for one), the column of the realm seated in it, steps under its temple and the way to it, and
 * the height it holds. `ash`: the lots the greatest fire took (none of it there).
 */
export function formGround(scene: TownScene, out: TownParts, ash: number): void {
  const { plan, lots } = scene,
    form = plan.form,
    mains = lots.blocks.mains;
  if (!form || plan.sealed) return;
  const blocks = Math.ceil(plan.lots / BLOCK_LOTS),
    ashBlocks = Math.ceil(ash / BLOCK_LOTS);
  // Its main streets, out from the square: set where it paves, tarred where engines run, a trodden track else. A people
  // who pass over their town keep none.
  if (mains && !form.over)
    for (const m of mains) {
      const road = m.road >= 0,
        wide = 2 * m.half + (road ? 0 : 0.6);
      // (A quarter's first lane with no road down it is drawn apart from its blocks' own ground only once the town paves.)
      if (!road && !plan.paved && form.engines < 0) continue;
      for (const i of drawnLengths(m, blocks, ashBlocks)) {
        const engines = form.engines >= 0 && (form.drive || road),
          c = engines ? TARMAC : plan.paved ? SETTS : TRACK;
        out.put("box", c, m.x[i]!, 0.33, m.z[i]!, m.len[i]! + 0.4, 0.06, wide, -m.h[i]!);
        if (engines && road && i % 2 === 0)
          out.put("box", LINE, m.x[i]!, 0.365, m.z[i]!, m.len[i]! * 0.45, 0.02, 0.28, -m.h[i]!);
      }
    }
  if (ash > 0) return;
  // The ring street where its walls stood, once they are down: as broad as the ground they kept clear, a tree to each
  // length where its land's rain grows them.
  const ring = scene.walls,
    walls = plan.walls;
  if (
    ring &&
    walls &&
    !ring.lengths.length &&
    plan.whole >= 3 * walls.reach &&
    plan.site &&
    !form.over
  ) {
    // (Along the line they stood on, as its later blocks kept clear of it: bridge/wall.ts.)
    // (In lengths as long as the walls' were: a longer one would cut the line's corners.)
    const n = ring.n,
      c = form.engines >= 0 ? TARMAC : plan.paved ? SETTS : TRACK,
      leaf = lifeTint(LEAF, plan.lifeLook),
      wet = wallWet(plan.water, plan.site);
    for (const l of wallWalk(ring.line, n)) {
      if (wet && wet(l.x, l.z)) continue;
      out.put("box", c, l.x, 0.34, l.z, l.len + 0.6, 0.06, 9, l.yaw);
      if (form.green >= 0.2 && l.k % 8 === 0) {
        // (A tree on its inner side.)
        const d = Math.max(1e-6, Math.hypot(l.x, l.z));
        out.put("cone", leaf, l.x * (1 - 6.5 / d), 3.9, l.z * (1 - 6.5 / d), 4.4, 7, 4.4, 0);
      }
    }
  }
  const mouths = (mains ?? []).filter((m) => m.x.length).map((m) => Math.atan2(m.z[0]!, m.x[0]!)),
    place = lots.blocks.place;
  if (place) marketPlace(scene, out, place);
  // Its market's cover about the square, where no ground was kept for a place.
  else if (form.forum) {
    const n = 16,
      r = SQUARE - 1.3,
      high = form.cover,
      stands: boolean[] = [];
    for (let k = 0; k < n; k++) stands.push(!nearAny((k / n) * 2 * Math.PI, mouths, 0.13));
    for (let k = 0; k < n; k++) {
      if (!stands[k]) continue;
      const a = (k / n) * 2 * Math.PI,
        x = r * Math.cos(a),
        z = r * Math.sin(a);
      if (form.forum === 2) {
        out.put("cyl", STONE, x, high / 2 + 0.2, z, 0.9, high, 0.9, 0);
        if (stands[(k + 1) % n]) {
          const b = ((k + 0.5) / n) * 2 * Math.PI;
          out.put(
            "box",
            STONE,
            r * Math.cos(b),
            high + 0.5,
            r * Math.sin(b),
            2 * r * Math.sin(Math.PI / n) + 0.9,
            0.7,
            1.2,
            -(b + Math.PI / 2),
          );
        }
      } else if (k % 2 === 0) {
        out.put("box", TIMBER, x, 1.5, z, 0.3, 2.8, 0.3, 0);
        out.put(
          "box",
          AWNINGS[(k >> 1) % AWNINGS.length]!,
          (r - 1.4) * Math.cos(a),
          2.9,
          (r - 1.4) * Math.sin(a),
          3.6,
          0.18,
          3,
          -(a + Math.PI / 2),
        );
      }
    }
  }
  // The column of the realm seated here, in its square where it has no market place.
  if (form.column > 0 && !place)
    column(out, -6.5, 5.5, form.column, plan.rank?.seat?.color ?? GOLD);
  // Steps under its temple, broad toward its street, and the way kept to it from the square: pillars along the main street
  // of its quarter, as far as it lies, as high as its market's cover.
  const temple = form.stone
    ? plan.civics.find(
        (c) =>
          c.kind === "temple" &&
          c.fell === null &&
          c.end <= plan.year &&
          c.at + c.lots <= plan.lots,
      )
    : undefined;
  if (temple) {
    const f = footprint(lots, temple.at, temple.lots);
    for (const [more, high] of [
      [7, 0.4],
      [4, 0.8],
      [1.6, 1.2],
    ] as const) {
      const [sx, sz] = at(f.x, f.z, f.yaw, 0, -(more - 1.6) / 2);
      out.put("box", STONE, sx, high / 2, sz, f.w + more, high, f.d + more, f.yaw);
    }
    const q = quarterOf(plan.seed, Math.floor(temple.at / BLOCK_LOTS)),
      m = mains?.find((s) => s.q === q),
      far = Math.hypot(f.x, f.z) + 10,
      high = form.cover + 1,
      cap = form.spare >= 0.5 ? GOLD : STONE;
    // (Two tall stones before its doors.)
    for (const side of [-1, 1]) {
      const [ox, oz] = at(f.x, f.z, f.yaw, side * (f.w / 2 + 1.2), -f.d / 2 - 3.6);
      out.put("box", STONE, ox, high, oz, 1.5, 2 * high, 1.5, f.yaw);
      out.put("cone", cap, ox, 2 * high + 0.9, oz, 1.9, 1.8, 1.9, f.yaw);
    }
    if (m && !form.over && (form.column > 0 || form.forum === 2))
      for (const i of drawnLengths(m, blocks, 0)) {
        if (Math.hypot(m.x[i]!, m.z[i]!) > far || i > 3) break;
        for (const side of [-1, 1]) {
          const off = side * Math.max(1.6, m.half - 0.5),
            px = m.x[i]! - Math.sin(m.h[i]!) * off,
            pz = m.z[i]! + Math.cos(m.h[i]!) * off;
          out.put("cyl", STONE, px, high / 2 + 0.2, pz, 0.8, high, 0.8, 0);
        }
      }
  }
  const held = heightOf(scene);
  if (held) height(scene, out, held);
}
