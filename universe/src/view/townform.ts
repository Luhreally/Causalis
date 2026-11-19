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
  footprint,
  lotTier,
  quarterOf,
  tallShare,
  type MainStreet,
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
const TALL_STEPS = 8,
  TALL_LOW = 0.55,
  TALL_STEP = 0.1;

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
 * The look a lot's home stands in: its design's, as its ground's worth has it. By the square wall to wall and a floor higher
 * (a round house cannot stand wall to wall: higher only); at the edge apart; a tall home as high as its ground is dear.
 * One look to each design, tier and step, made once for the scene.
 */
export function formLook(scene: TownScene, p: number, index: number): HouseLook | undefined {
  const base = scene.looks[index] ?? scene.looks[0];
  if (!base || !scene.tiers) return base;
  const code = scene.tiers[p]!,
    key = (scene.looks[index] ? index : 0) * 64 + code;
  let look = scene.formLooks.get(key);
  if (!look) {
    const tier = code & 3,
      form = scene.plan.form!,
      tall = TALL_LOW + (code >> 2) * TALL_STEP,
      plain = base.tent || base.open || base.raised > 0;
    look = {
      ...base,
      tall,
      ...(form.own ? { own: true } : {}),
      ...(plain
        ? {}
        : tier === TIER.heart
          ? base.round
            ? { height: base.height * (form.winged ? 1.9 : 1.35) }
            : {
                joined: true,
                length: Math.max(base.length, 0.9),
                height: base.height * (form.winged ? 2.1 : 1.55),
              }
          : tier === TIER.edge
            ? { apart: true }
            : {}),
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
    shed = form.drive && Math.floor(p / BLOCK_LOTS) >= form.engines && share(p, 5) < form.rides;
  // (A cottage has one window where a house has two: what stands in its yard is drawn in the part that saves, and no more.)
  if (!shed && form.green >= 0.12 && share(p, 2) < form.green * 0.4) {
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
  if (share(p, 3) < form.green * 0.34) {
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
    if (share(p, 6) < 0.4) out.put("box", DRIVE, dx, 0.53, dz, 2.4, 0.06, LOT_D / 2 - 1.8, yaw);
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
 * A town's form on its ground: its main streets; and in a town that builds in stone a colonnade about its market square (posts
 * and awnings where it does not), the column of the realm seated in it, steps under its temple and the way to it. `ash`: the
 * lots the greatest fire took (none of it there).
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
      for (const i of drawnLengths(m, blocks, ashBlocks)) {
        const engines = form.engines >= 0 && (form.drive || road),
          c = engines ? TARMAC : plan.paved ? SETTS : TRACK;
        out.put("box", c, m.x[i]!, 0.33, m.z[i]!, m.len[i]! + 0.4, 0.06, wide, -m.h[i]!);
        if (engines && road)
          out.put("box", LINE, m.x[i]!, 0.365, m.z[i]!, m.len[i]! * 0.45, 0.02, 0.28, -m.h[i]!);
      }
    }
  if (ash > 0) return;
  const mouths = (mains ?? []).filter((m) => m.x.length).map((m) => Math.atan2(m.z[0]!, m.x[0]!));
  // Its market's cover about the square.
  if (form.forum) {
    const n = 26,
      r = SQUARE - 1.3,
      stands: boolean[] = [];
    for (let k = 0; k < n; k++) stands.push(!nearAny((k / n) * 2 * Math.PI, mouths, 0.13));
    for (let k = 0; k < n; k++) {
      if (!stands[k]) continue;
      const a = (k / n) * 2 * Math.PI,
        x = r * Math.cos(a),
        z = r * Math.sin(a);
      if (form.forum === 2) {
        out.put("cyl", STONE, x, 2.3, z, 0.8, 4.2, 0.8, 0);
        if (stands[(k + 1) % n]) {
          const b = ((k + 0.5) / n) * 2 * Math.PI;
          out.put(
            "box",
            STONE,
            r * Math.cos(b),
            4.65,
            r * Math.sin(b),
            2 * r * Math.sin(Math.PI / n) + 0.9,
            0.6,
            1.1,
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
  // The column of the realm seated here.
  if (form.column > 0) {
    const cx = -6.5,
      cz = 5.5,
      high = form.column;
    out.put("box", STONE, cx, 0.9, cz, 3.2, 1.2, 3.2, 0);
    out.put("cyl", STONE, cx, 1.5 + high / 2, cz, 1.3, high, 1.3, 0);
    out.put("box", plan.rank?.seat?.color ?? GOLD, cx, 1.5 + high + 0.9, cz, 1.1, 1.8, 1.1, 0);
  }
  // Steps under its temple, and the way kept broad to it: pillars along the main street of its quarter, as far as it lies.
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
    out.put("box", STONE, f.x, 0.4, f.z, f.w + 3.4, 0.8, f.d + 3.4, f.yaw);
    out.put("box", STONE, f.x, 0.6, f.z, f.w + 1.6, 1.2, f.d + 1.6, f.yaw);
    const q = quarterOf(plan.seed, Math.floor(temple.at / BLOCK_LOTS)),
      m = mains?.find((s) => s.q === q),
      far = Math.hypot(f.x, f.z) + 10;
    if (m && !form.over && (form.column > 0 || form.forum === 2))
      for (const i of drawnLengths(m, blocks, 0)) {
        if (Math.hypot(m.x[i]!, m.z[i]!) > far || i > 14) break;
        for (const side of [-1, 1]) {
          const off = side * Math.max(1.6, m.half - 0.5),
            px = m.x[i]! - Math.sin(m.h[i]!) * off,
            pz = m.z[i]! + Math.cos(m.h[i]!) * off;
          out.put("cyl", STONE, px, 1.9, pz, 0.6, 3.2, 0.6, 0);
        }
      }
  }
}
