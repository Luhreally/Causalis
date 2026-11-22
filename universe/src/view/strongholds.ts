// A town's strongholds and seats drawn (bridge/strongholds.ts says the rule, bridge/holdplaces.ts where each stands; asked
// 2026-11-21): an earth mound and its palisade; a stone keep in its curtain; a curtain flanked by towers; rings within rings;
// low bastions in a star; a country house in its park, an avenue of trees to its door; offices of state under a dome. Each
// raised on the rise an attacker must climb to it; manned with its holder's banner, or lived in and gardened once its threat
// went, or a ruin. Of the land's own stuff (its homes' walls) where it builds in stone, else earth and timber. The same few
// plain parts every building is drawn in, drawn once with the town's ground: no mesh or batch of its own, the same at
// every distance, on both the town's view and its land's map.
import { HAMLET_RING, holdPlaces, type HoldPlace, type TownPlan } from "../bridge/index.ts";
import { lifeTint } from "./biochem.ts";
import { biomeColor } from "./globe.ts";
import type { HouseLook } from "./village.ts";
import type { PartMesh, TownParts, TownScene } from "./town.ts";

type Rgb = readonly [number, number, number];

const EARTH: Rgb = [0.5, 0.42, 0.3],
  DITCH: Rgb = [0.3, 0.27, 0.22],
  TIMBER: Rgb = [0.5, 0.35, 0.2],
  STONE: Rgb = [0.72, 0.7, 0.64],
  GRASS: Rgb = [0.34, 0.54, 0.26],
  LAWN: Rgb = [0.36, 0.6, 0.28],
  LEAF: Rgb = [0.18, 0.44, 0.22],
  GRAVEL: Rgb = [0.78, 0.74, 0.64],
  SLATE: Rgb = [0.3, 0.33, 0.4],
  ROOF: Rgb = [0.55, 0.3, 0.22],
  WHITE: Rgb = [0.92, 0.9, 0.85],
  DOME: Rgb = [0.6, 0.66, 0.62],
  MAST: Rgb = [0.3, 0.26, 0.22],
  RUBBLE: Rgb = [0.5, 0.48, 0.44];

const mixed = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

/** A share in [0, 1) of a whole number, a place's own. */
function share(a: number, k: number): number {
  let h = (Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** How a place's parts are put: in its own frame (u across its front, v out from the town), lifted by its rise, worn if a ruin. */
type Put = (
  mesh: PartMesh,
  c: Rgb,
  u: number,
  y: number,
  v: number,
  su: number,
  sy: number,
  sv: number,
  turn?: number,
  /** Part of what a ruin loses: drawn lower and broken, or gone. */
  wall?: boolean,
) => void;

/** What a place is built of: its walls' stuff, the dressed stone of its keep, its roofs. */
type Stuff = { wall: Rgb; keep: Rgb; roof: Rgb; grass: Rgb; leaf: Rgb };

/** A ring of `n` lengths of wall about (0, cv), `r` out, `high` and `thick`; a tower at each corner (`tower` its breadth; 0 none). */
function ring(
  put: Put,
  s: Stuff,
  n: number,
  r: number,
  cv: number,
  high: number,
  thick: number,
  tower: number,
  c: Rgb = s.wall,
  turn = Math.PI / n,
): void {
  const side = 2 * r * Math.sin(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const a = turn + ((k + 0.5) / n) * 2 * Math.PI,
      m = r * Math.cos(Math.PI / n);
    put(
      "box",
      c,
      m * Math.cos(a),
      high / 2,
      cv + m * Math.sin(a),
      side + thick * 0.2,
      high,
      thick,
      -a + Math.PI / 2,
      true,
    );
    if (tower > 0) {
      const b = turn + (k / n) * 2 * Math.PI;
      put(
        "cyl",
        c,
        r * Math.cos(b),
        (high + 3) / 2,
        cv + r * Math.sin(b),
        tower,
        high + 3,
        tower,
        0,
        true,
      );
    }
  }
}

/** A banner on a mast, in its holder's colour. */
function banner(put: Put, u: number, y0: number, v: number, high: number, c: Rgb): void {
  put("box", MAST, u, y0 + high / 2, v, 0.3, high, 0.3);
  put("box", c, u + 1.4, y0 + high - 1.2, v, 2.6, 1.7, 0.14);
}

/** A tree: its trunk and its crown. */
function tree(put: Put, s: Stuff, u: number, v: number, high: number): void {
  put("cyl", [0.36, 0.26, 0.16], u, high * 0.2, v, 0.5, high * 0.4, 0.5);
  put("cone", s.leaf, u, high * 0.66, v, high * 0.55, high * 0.72, high * 0.55);
}

/** An earth mound and its palisade, a ditch about them, a bailey before it, a timber tower on its top. */
function mound(put: Put, s: Stuff, r: number, c: Rgb, kept: boolean): void {
  put("cyl", DITCH, 0, 0.12, 0, r * 2, 0.24, r * 2);
  put("cyl", s.grass, 0, 0.4, -r * 0.25, r * 1.5, 0.6, r * 1.35);
  ring(put, s, 14, r * 0.66, -r * 0.25, 3.2, 0.5, 0, TIMBER);
  // (Its motte: the mound at the back, its own palisade about its top.)
  put("cyl", EARTH, 0, 3.5, r * 0.36, r * 0.62, 7, r * 0.62);
  put("dome", s.grass, 0, 7, r * 0.36, r * 0.56, 1.6, r * 0.56);
  ring(put, s, 9, r * 0.25, r * 0.36, 2.6, 0.4, 0, TIMBER);
  put("box", TIMBER, 0, 7 + 3.5, r * 0.36, 5, 7, 5, 0, true);
  put("gable", kept ? ROOF : TIMBER, 0, 7 + 7 + 1.2, r * 0.36, 5.6, 2.4, 5.6, 0, true);
  // (Its gate toward the town.)
  put("box", TIMBER, 0, 2.4, -r * 0.25 - r * 0.66, 4.4, 4.8, 2, 0, true);
  if (!kept) banner(put, 1.8, 14, r * 0.36, 6, c);
}

/** A stone keep, square, its turrets at its corners. */
function keep(put: Put, s: Stuff, v: number, w: number, high: number, c: Rgb, kept: boolean): void {
  put("box", s.keep, 0, high / 2, v, w, high, w, 0, true);
  for (const [du, dv] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    put("box", s.keep, (du * w) / 2, (high + 3) / 2, v + (dv * w) / 2, 2.4, high + 3, 2.4, 0, true);
  if (kept) put("gable", s.roof, 0, high + 1.6, v, w * 0.96, 3.2, w * 0.96, 0, true);
  banner(put, 0, high + (kept ? 3.2 : 0), v, 7, c);
}

/** A curtain about a bailey: square with its towers (a keep), or of eight lengths flanked by round towers (towers). */
function curtain(
  put: Put,
  s: Stuff,
  r: number,
  sides: number,
  high: number,
  thick: number,
  tower: number,
  c: Rgb,
): void {
  put("cyl", DITCH, 0, 0.12, 0, r * 2.05, 0.24, r * 2.05);
  put("cyl", s.grass, 0, 0.36, 0, r * 1.78, 0.5, r * 1.78);
  ring(
    put,
    s,
    sides,
    r * 0.84,
    0,
    high,
    thick,
    tower,
    s.wall,
    sides === 4 ? Math.PI / 4 : Math.PI / sides,
  );
  // (Its gatehouse toward the town: two towers and the arch between.)
  const gv = -r * 0.84 * Math.cos(Math.PI / sides);
  for (const side of [-1, 1])
    put("cyl", s.wall, side * 3.4, (high + 4) / 2, gv, 4, high + 4, 4, 0, true);
  put("box", s.wall, 0, high * 0.8, gv, 5, high * 0.4, thick + 1, 0, true);
  void c;
}

/** Low thick earth-backed walls in a star, an angled bastion at each point, the glacis sloping off before them. */
function bastions(put: Put, s: Stuff, r: number, c: Rgb, kept: boolean): void {
  const n = 5,
    inner = r * 0.56,
    point = r * 0.86;
  // (The glacis: a broad low slope of earth, the ditch inside it.)
  put("cyl", s.grass, 0, 0.3, 0, r * 2, 0.6, r * 2);
  put("cyl", DITCH, 0, 0.66, 0, point * 2.02, 0.2, point * 2.02);
  put("cyl", s.grass, 0, 1.2, 0, inner * 2.1, 1.6, inner * 2.1);
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k / n) * 2 * Math.PI,
      b = a + Math.PI / n,
      // (Each bastion's two faces, from where the curtain meets it to its point.)
      px = point * Math.cos(a),
      pz = point * Math.sin(a);
    for (const side of [-1, 1]) {
      const fa = a + side * 0.42,
        fx = inner * 0.9 * Math.cos(fa),
        fz = inner * 0.9 * Math.sin(fa),
        mx = (px + fx) / 2,
        mz = (pz + fz) / 2,
        long = Math.hypot(px - fx, pz - fz);
      // (A face of masonry, the earth of its rampart behind it, grassed: it is low and thick, to take shot.)
      put("box", s.wall, mx, 3, mz, long, 6, 6, -Math.atan2(pz - fz, px - fx), true);
      put("box", s.grass, mx, 6.15, mz, long * 0.94, 0.3, 4.4, -Math.atan2(pz - fz, px - fx));
    }
    // (The curtain between two bastions.)
    const cx = inner * 0.95 * Math.cos(b),
      cz = inner * 0.95 * Math.sin(b),
      side = 2 * inner * 0.95 * Math.sin(Math.PI / n) * 0.62;
    put("box", s.wall, cx, 2.8, cz, side, 5.6, 6, -b + Math.PI / 2, true);
    put("box", s.grass, cx, 5.75, cz, side * 0.94, 0.3, 4.4, -b + Math.PI / 2);
  }
  // (Within: barracks, a magazine, the flag.)
  for (const side of [-1, 1])
    put("box", s.roof, side * inner * 0.34, 2.6 + 2, 0, inner * 0.36, 4, inner * 0.9, 0, true);
  put("box", s.keep, 0, 4, inner * 0.3, 7, 4, 6, 0, true);
  if (!kept) banner(put, 0, 2, -inner * 0.2, 14, c);
}

/** A country house: its body, its two wings, the portico at its door, a hipped roof; its lawn, its avenue, its garden behind. */
function countryHouse(put: Put, s: Stuff, r: number, c: Rgb, hamlet: number): void {
  const at = hamlet ? r - HAMLET_RING : r;
  put("cyl", s.grass, 0, 0.32, 0, at * 2, 0.4, at * 2);
  put("box", GRAVEL, 0, 0.56, -at * 0.12, 18, 0.1, 10);
  const w = 24,
    d = 11,
    h = 10;
  put("box", s.wall, 0, h / 2, at * 0.12, w, h, d, 0, true);
  put("gable", s.roof, 0, h + 1.8, at * 0.12, w * 1.04, 3.6, d * 1.1, 0, true);
  for (const side of [-1, 1]) {
    put("box", s.wall, side * (w / 2 + 4), h * 0.36, at * 0.12 + 1.5, 8, h * 0.72, 8, 0, true);
    put(
      "gable",
      s.roof,
      side * (w / 2 + 4),
      h * 0.72 + 1.2,
      at * 0.12 + 1.5,
      8.4,
      2.4,
      8.6,
      0,
      true,
    );
  }
  // (Its portico: four columns and the pediment over them.)
  for (const u of [-3.6, -1.2, 1.2, 3.6])
    put("cyl", WHITE, u, h * 0.4, at * 0.12 - d / 2 - 1.6, 0.8, h * 0.8, 0.8);
  put("gable", WHITE, 0, h * 0.8 + 0.8, at * 0.12 - d / 2 - 1.6, 9, 1.6, 3.4);
  // (Its avenue of trees from the road toward the town to its door.)
  for (let k = 0; k < 6; k++) {
    const v = -at * 0.25 - ((at * 0.72) / 6) * k;
    for (const side of [-1, 1]) tree(put, s, side * 5.5, v, 8 + 2 * share(k, side + 3));
  }
  // (Its garden behind: hedged beds, a pool.)
  for (const u of [-1, 1])
    for (const v of [1, 2])
      put("box", s.leaf, u * 8, 0.9, at * 0.12 + d / 2 + 4 + v * 6, 10, 1.1, 4.4);
  put("cyl", [0.42, 0.6, 0.74], 0, 0.6, at * 0.12 + d / 2 + 16, 6, 0.12, 6);
  // (Trees of its park about it.)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * 2 * Math.PI + 0.3;
    if (Math.abs(Math.sin(a)) < 0.35 && Math.cos(a) < 0) continue;
    tree(put, s, at * 0.78 * Math.sin(a), at * 0.78 * Math.cos(a), 9 + 3 * share(k, 9));
  }
  banner(put, w / 2 + 1, h, at * 0.12, 5, c);
}

/** Offices of state: a long body, a colonnade along its front, a dome on its drum, its square paved before it, its flag. */
function offices(put: Put, s: Stuff, r: number, c: Rgb): void {
  put("cyl", s.grass, 0, 0.32, 0, r * 2, 0.4, r * 2);
  put("box", GRAVEL, 0, 0.56, -r * 0.4, r * 1.2, 0.1, r * 0.6);
  const w = r * 1.1,
    d = 16,
    h = 14;
  put("box", WHITE, 0, h / 2, r * 0.15, w, h, d, 0, true);
  put("box", mixed(WHITE, SLATE, 0.3), 0, h + 0.4, r * 0.15, w * 1.02, 0.8, d * 1.02, 0, true);
  for (let k = 0; k < 8; k++)
    put("cyl", WHITE, (k / 7 - 0.5) * w * 0.5, h * 0.42, r * 0.15 - d / 2 - 2, 1, h * 0.84, 1);
  put("gable", WHITE, 0, h * 0.84 + 1, r * 0.15 - d / 2 - 2, w * 0.56, 2, 4.4);
  put("cyl", WHITE, 0, h + 3.5, r * 0.15, 13, 6, 13);
  put("dome", DOME, 0, h + 6.5, r * 0.15, 13, 8, 13);
  put("box", MAST, 0, h + 16, r * 0.15, 0.3, 4, 0.3);
  banner(put, -w * 0.4, 0, -r * 0.62, 14, c);
}

/** Ruined rubble heaped where walls fell. */
function rubble(put: Put, r: number, k0: number): void {
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * 2 * Math.PI + share(k0, k) * 0.8,
      d = r * (0.5 + 0.35 * share(k0, k + 9));
    put("box", RUBBLE, d * Math.cos(a), 0.7, d * Math.sin(a), 3 + 2 * share(k, k0), 1.4, 2.4, a);
  }
}

/** One place drawn. */
function placeDrawn(
  scene: TownScene,
  out: TownParts,
  p: HoldPlace,
  look: HouseLook | undefined,
  k: number,
): void {
  const { plan } = scene,
    h = p.hold,
    state = p.show ? "held" : h.hold.state,
    ruin = state === "ruin",
    kept = state === "kept",
    // (Up the rise an attacker would climb to it: its ground raised as high as the climb, a little.)
    lift = Math.max(0, Math.min(8, p.climb * 0.45)),
    land = look?.wall ?? STONE,
    grass: Rgb = plan.kind ? biomeColor(8, plan.kind) : GRASS,
    stone = h.hold.stone,
    wall = stone ? mixed(land, STONE, 0.45) : TIMBER,
    s: Stuff = {
      wall: ruin ? mixed(wall, [0.35, 0.34, 0.32], 0.35) : wall,
      keep: ruin ? mixed(wall, [0.35, 0.34, 0.32], 0.4) : mixed(wall, [0.95, 0.94, 0.9], 0.12),
      roof: look?.roof ? mixed(look.roof, SLATE, 0.4) : ROOF,
      // (Its grass the world's own grassland, as its town's yards are: view/town.ts townGround.)
      grass: lifeTint(
        ruin
          ? mixed(grass, EARTH, 0.3)
          : kept
            ? plan.kind
              ? mixed(grass, [1, 1, 1], 0.12)
              : LAWN
            : grass,
        plan.lifeLook,
      ),
      leaf: lifeTint(LEAF, plan.lifeLook),
    },
    cos = Math.cos(p.yaw),
    sin = Math.sin(p.yaw),
    put: Put = (mesh, c, u, y, v, su, sy, sv, turn = 0, isWall = false) => {
      if (ruin && isWall) {
        // (A ruin: one length in three gone, the rest half fallen.)
        const g = share(k * 977 + Math.round(u * 7 + v * 13), 3);
        if (g < 0.33 || mesh === "gable" || mesh === "cone") return;
        const keepH = sy * (0.35 + 0.4 * g);
        y = y - sy / 2 + keepH / 2;
        sy = keepH;
      }
      out.put(
        mesh,
        c,
        p.x + u * cos + v * sin,
        y + lift,
        p.z - u * sin + v * cos,
        su,
        sy,
        sv,
        p.yaw + turn,
      );
    };
  if (lift > 0.5)
    out.put("cyl", mixed(EARTH, s.grass, 0.5), p.x, lift / 2, p.z, p.r * 2.1, lift, p.r * 2.1, 0);
  const c = h.color,
    r = p.r - (h.hamlet && p === lastOf(scene, h) ? HAMLET_RING : 0);
  switch (p.what) {
    case "mound":
      mound(put, s, r, c, kept);
      break;
    case "keep":
      curtain(put, s, r, 4, 6.5, 2, 4.2, c);
      keep(put, s, r * 0.18, 12, 16, c, kept);
      break;
    case "towers":
      curtain(put, s, r, 8, 8.5, 3, 5.2, c);
      keep(put, s, r * 0.2, 13, 18, c, kept);
      break;
    case "rings":
      curtain(put, s, r, 8, 6.5, 3, 5, c);
      ring(put, s, 6, r * 0.5, 0.06 * r, 11, 3.4, 6);
      keep(put, s, r * 0.06, 14, 22, c, kept);
      break;
    case "bastions":
      bastions(put, s, r, c, kept);
      break;
    case "house":
      countryHouse(put, s, p.r, c, h.hamlet && p === lastOf(scene, h) ? 1 : 0);
      break;
    case "offices":
      offices(put, s, r, c);
      break;
  }
  if (ruin) rubble(put, r, k);
  else if (kept && !p.show) {
    // (Lived in: its bailey a lawn, a garden laid out in it, its windows lit.)
    put("box", s.leaf, -r * 0.3, 0.8, -r * 0.1, r * 0.3, 1, r * 0.16);
    put("box", s.leaf, r * 0.3, 0.8, -r * 0.1, r * 0.3, 1, r * 0.16);
  }
  if (h.hamlet && p === lastOf(scene, h)) hamlet(put, s, p.r - HAMLET_RING * 0.55, h.hamlet, look);
}

/** Its tenants' cottages in a hamlet, on the side of its ground away from the town. */
function hamlet(put: Put, s: Stuff, r: number, n: number, look: HouseLook | undefined): void {
  const wall = look?.wall ?? [0.8, 0.74, 0.62],
    roof = look?.roof ?? ROOF;
  for (let k = 0; k < n; k++) {
    const a = Math.PI / 2 + ((k - (n - 1) / 2) / Math.max(1, n)) * 1.9,
      u = r * Math.cos(a),
      v = r * Math.sin(a);
    put("box", wall, u, 1.3, v, 5.4, 2.6, 4.2, -a + Math.PI / 2);
    put("gable", roof, u, 2.6 + 1, v, 6, 2, 4.8, -a + Math.PI / 2);
    if (k % 2 === 0) put("box", s.leaf, u * 1.12, 0.5, v * 1.12, 4, 0.5, 3, -a + Math.PI / 2);
  }
}

/** A holder's last place (its tenants' hamlet stands about it). */
function lastOf(scene: TownScene, h: HoldPlace["hold"]): HoldPlace | undefined {
  const all = holdPlaces(scene.plan, scene.lots);
  for (let i = all.length - 1; i >= 0; i--) if (all[i]!.hold === h) return all[i];
  return undefined;
}

/** A town's strongholds and seats, each where it stands, as they stand now. */
export function townHolds(scene: TownScene, out: TownParts, look: HouseLook | undefined): void {
  const places = holdPlaces(scene.plan, scene.lots);
  places.forEach((p, k) => placeDrawn(scene, out, p, look, k));
}

/** Whether a plan has strongholds or seats about it. */
export function hasHolds(plan: TownPlan): boolean {
  return !!plan.rank?.holds?.length;
}
