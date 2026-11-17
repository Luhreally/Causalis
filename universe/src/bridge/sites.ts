// Where a town's streets go (asked 2026-11-16: "is there a lightweight way to get the placement of homes in towns and
// businesses ... with like what makes sense of the environment allows", and "can u just use the simple first principles
// humans do"). No family of plan is chosen. A town's first streets are the ways its people walk: out from its square along
// each road in, the road's own bearing (the land's map draws the same road coming in on it), and out toward its water, its
// high ground, its lee. Each block is taken where it is cheapest to walk to from the square (its rent), along the street it
// fronts; a street runs along the hillside rather than up it, and new streets branch from the old into the ground the town
// grows over, quarter by quarter. Where someone measures the ground out before it is built (a realm's clerks, who can write
// and record a plot), it is cut into equal straight blocks, as equal lots are the cheapest to measure, record and sell: but
// only where the ground lies flat enough; on a slope even a measured street bends with it. A wall leaves a ring: what is
// built after it keeps off its line, which is a ring street once the wall is down.
//
// Every block is laid in the order the town takes it, each by the blocks before it and the town's ground alone, so a block
// never moves as the town grows. Pure: what the eye is given, read from what history keeps; nothing here is kept.
import { MinHeap, mix } from "../kernel/index.ts";

/** A road into a town, as its streets meet it. */
export type TownRoad = {
  /** The bearing it leaves the town by (radians, in the town's frame: x east, z south, as the land's map is laid). */
  readonly bearing: number;
  /** How busy it is: the carts on it at once (the land's road's traffic). */
  readonly busy: number;
  /** Whether rails are laid along it. */
  readonly rails: boolean;
  /** The tile of the land's map its far end lies at (by which the land's map knows it). */
  readonly to: number;
};

/** A town's ground and the ways into it, as its streets are laid by them (read from what the world keeps; never kept). */
export type TownSite = {
  /** The bearing its ground rises toward, and how much it rises in a kilometre that way (metres). */
  readonly up: number;
  readonly rise: number;
  /** The bearing its prevailing wind blows toward: its smoke goes that way. */
  readonly lee: number;
  /** Its roads in, the busiest first. */
  readonly roads: readonly TownRoad[];
  /** The first block of its plan whose ground was measured out before it was built (-1: none ever was). */
  readonly measured: number;
  /** The lots its walls were raised about (null: it was never walled). */
  readonly walled: number | null;
  /** It raises no new homes toward its water: it has flooded, and learned from it. */
  readonly dry: boolean;
};

/**
 * The quarters a town's blocks are taken in, eight to each round of its growth: toward its water, its lee, its high ground,
 * its busiest way in, and four more about it. A pure function of the town's seed and the block (sim/town/sites.ts reckons
 * the same, by which a mill is begun on a block toward the water and a smithy on one in the lee).
 */
export const QUARTER = { water: 0, lee: 1, high: 2, road: 3 } as const;
export const QUARTERS = 8;
const PATTERN = [3, 4, 0, 5, 1, 6, 2, 7] as const;

/** Which quarter a block of a town's plan is taken in (see QUARTER). */
export function quarterOf(seed: number, block: number): number {
  const round = Math.floor(block / QUARTERS),
    turn = (mix(mix(0x51ed270b, seed), round) >>> 0) % QUARTERS;
  return PATTERN[(block + turn) % QUARTERS]!;
}

/** The blocks about a town's square that are its heart: none of them is given up to the floods. */
export const HEART_BLOCKS = 8;

// —— Measures (metres; bridge/town.ts's lots and blocks) ——————————————————————————————————————
const BW = 36,
  BD = 28,
  REACH = Math.hypot(BW / 2, BD / 2),
  /** A street's breadth, a lane's, half a road's. */
  STREET_W = 8,
  LANE_W = 6,
  ROAD_HALF = 3.5,
  /** How far apart two blocks keep at the least (each keeps half of it). */
  KEEP = 2,
  /** The square at the heart (radius) and the shore kept along water. */
  SQUARE_R = 20,
  SHORE_W = 10,
  /** Over this rise a kilometre (metres) the ground is too steep to cut straight. */
  STEEP = 40,
  /** How far off its quarter's bearing a block may lie. */
  WEDGE = Math.PI / 8 + 0.6;

const unit = (a: number, b: number, c = 0) =>
  (mix(mix(mix(0x2545f491, a), b), c) >>> 0) / 4294967296;
/** The angle from b to a, within ±π. */
const turnTo = (a: number, b: number) => {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

/** Where each quarter lies: its bearing, and whether it runs down a road (its main street the road's own bearing). */
export function quarterBearings(
  site: TownSite,
  water: { readonly x: number; readonly z: number } | null,
  axis: number,
): { bearing: Float64Array; road: Int8Array } {
  const main = site.roads.find((r) => r.rails) ?? site.roads[0],
    zero = site.roads[0]?.bearing ?? axis,
    want: [number, number][] = [
      [QUARTER.water, water ? Math.atan2(water.z, water.x) : site.up + Math.PI],
      [QUARTER.road, main ? main.bearing : zero],
      [QUARTER.lee, site.lee],
      [QUARTER.high, site.up],
    ],
    slotOf = new Int8Array(QUARTERS).fill(-1),
    taken = new Uint8Array(QUARTERS);
  for (const [q, b] of want) {
    let best = -1,
      off = Infinity;
    for (let k = 0; k < QUARTERS; k++) {
      if (taken[k]) continue;
      const o = Math.abs(turnTo(b, zero + (k * Math.PI) / 4));
      if (o < off - 1e-9) {
        off = o;
        best = k;
      }
    }
    taken[best] = 1;
    slotOf[q] = best;
  }
  for (let q = 0, k = 0; q < QUARTERS; q++) {
    if (slotOf[q]! >= 0) continue;
    while (taken[k]) k++;
    taken[k] = 1;
    slotOf[q] = k;
  }
  const bearing = new Float64Array(QUARTERS),
    road = new Int8Array(QUARTERS).fill(-1);
  for (let q = 0; q < QUARTERS; q++) {
    const b = zero + (slotOf[q]! * Math.PI) / 4;
    bearing[q] = b;
    // (A road within the quarter: its main street runs down it.)
    let near = Math.PI / 8 + 1e-6;
    site.roads.forEach((r, i) => {
      const o = Math.abs(turnTo(r.bearing, b));
      if (o < near && ![...road].includes(i)) {
        near = o;
        road[q] = i;
      }
    });
    if (road[q]! >= 0) bearing[q] = site.roads[road[q]!]!.bearing;
  }
  return { bearing, road };
}

/** A street as it is laid: from where it leaves the one it branches from, slot by slot (a block each side of each). */
type Street = {
  readonly q: number;
  readonly depth: number;
  /** Its half breadth: a block's front stands so far from its middle line. */
  readonly half: number;
  /** Straight (a road, or measured ground): no wandering. */
  readonly straight: boolean;
  readonly id: number;
  /** Each slot's middle and heading, laid as far as asked: x, z, h, the start of the next. */
  readonly xs: number[];
  readonly zs: number[];
  readonly hs: number[];
  ex: number;
  ez: number;
  h: number;
  /** Its heading's wandering so far (off its first). */
  wander: number;
  readonly h0: number;
  /** The next slot each side will try, how many tries in a row have failed, and whether it is done. */
  readonly next: [number, number];
  readonly fails: [number, number];
  readonly done: [boolean, boolean];
  /** The slots that have had a block on either side (where branches leave from). */
  readonly used: Set<number>;
};

/** Where a town's blocks stand, in the order it takes them, and which of them were measured out straight. */
export type GrownBlocks = {
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly yaw: Float32Array;
  readonly straight: Uint8Array;
};

/**
 * The first `count` blocks of a town grown along its streets (see above): each the same whatever the count. `water`: the
 * lake or sea's edge beside it, laid about; `axis`: its streets' heading where it has no road in.
 */
export function grownBlocks(
  seed: number,
  site: TownSite,
  count: number,
  water: { readonly x: number; readonly z: number; readonly r: number } | null,
  axis: number,
): GrownBlocks {
  const x = new Float32Array(count),
    z = new Float32Array(count),
    yaw = new Float32Array(count),
    straight = new Uint8Array(count),
    { bearing, road } = quarterBearings(site, water, axis),
    lattice = site.roads[0]?.bearing ?? axis,
    flat = site.rise < STEEP,
    // (Contour headings: across the slope.)
    along = site.up + Math.PI / 2,
    bendBy = Math.min(0.85, site.rise / 50),
    grade = (h: number) => (site.rise / 1000) * Math.abs(Math.cos(h - site.up)),
    // —— What stands: blocks by cells, for keeping apart ——
    CELL = 56,
    cells = new Map<number, number[]>(),
    cellKey = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096),
    wallBlock = site.walled !== null ? Math.ceil(site.walled / 8) : -1,
    measuredAt = (b: number) => site.measured >= 0 && b >= site.measured;
  let placed = 0,
    wallR = -1;
  const roadX = site.roads.map((r) => Math.cos(r.bearing)),
    roadZ = site.roads.map((r) => Math.sin(r.bearing));
  const clear = (bx: number, bz: number, t: number, pad: number, b: number): boolean => {
    // (The block's axes in the town's frame: along it u = (c, -s), across it v = (s, c).)
    const c = Math.cos(t),
      s = Math.sin(t);
    // The square: the rectangle's nearest point to its middle.
    {
      const du = Math.max(0, Math.abs(bx * c - bz * s) - BW / 2),
        dv = Math.max(0, Math.abs(bx * s + bz * c) - BD / 2);
      if (du * du + dv * dv < (SQUARE_R + 2) ** 2) return false;
    }
    // The water and its shore.
    if (water && Math.hypot(bx - water.x, bz - water.z) < water.r + SHORE_W + REACH) return false;
    // The roads in: a block never stands across one.
    for (let k = 0; k < roadX.length; k++) {
      const rx = roadX[k]!,
        rz = roadZ[k]!,
        across = bx * -rz + bz * rx,
        wide = (BW / 2) * Math.abs(c * -rz - s * rx) + (BD / 2) * Math.abs(s * -rz + c * rx),
        long = (BW / 2) * Math.abs(c * rx - s * rz) + (BD / 2) * Math.abs(s * rx + c * rz);
      if (bx * rx + bz * rz + long > 0 && Math.abs(across) < wide + ROAD_HALF) return false;
    }
    // Where its walls stood.
    if (wallR > 0 && b >= wallBlock) {
      const r = Math.hypot(bx, bz);
      if (Math.abs(r - wallR) < REACH + 4) return false;
    }
    // The blocks before it.
    const ci = Math.floor(bx / CELL),
      cj = Math.floor(bz / CELL);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const list = cells.get(cellKey(ci + di, cj + dj));
        if (!list) continue;
        for (const o of list) if (overlaps(bx, bz, t, x[o]!, z[o]!, yaw[o]!, pad)) return false;
      }
    return true;
  };
  const put = (b: number, bx: number, bz: number, t: number, measured: boolean) => {
    x[b] = bx;
    z[b] = bz;
    yaw[b] = t;
    straight[b] = measured ? 1 : 0;
    const key = cellKey(Math.floor(bx / CELL), Math.floor(bz / CELL)),
      list = cells.get(key);
    if (list) list.push(b);
    else cells.set(key, [b]);
    placed = b + 1;
    // (The walls' line, once every block they were raised about stands: as wallRing reads it.)
    if (b + 1 === wallBlock) {
      // (A lot's middle lies at most some 15 m from its block's.)
      let r = SQUARE_R + 10;
      for (let o = 0; o <= b; o++) r = Math.max(r, Math.hypot(x[o]!, z[o]!) + 15.2 + 14);
      wallR = r + 8;
    }
  };

  // —— Streets ——
  const streets: Street[] = [],
    heaps: MinHeap[] = Array.from({ length: QUARTERS }, () => new MinHeap()),
    gapOf = (st: Street, i: number) =>
      st.straight ? STREET_W : LANE_W + 3 * unit(seed, st.id * 131 + i, 3);
  const slot = (st: Street, i: number) => {
    while (st.xs.length <= i) {
      const k = st.xs.length;
      if (!st.straight) {
        // (A lane wanders a little as it was walked, and leans along the hillside.)
        st.wander = Math.max(
          -0.35,
          Math.min(0.35, st.wander + (unit(seed, st.id, k) - 0.5) * 0.22),
        );
        const lean = turnTo(nearestAlong(st.h0 + st.wander), st.h0 + st.wander) * bendBy * 0.5;
        st.h = st.h0 + st.wander + lean;
      }
      const cx = st.ex + (Math.cos(st.h) * BW) / 2,
        cz = st.ez + (Math.sin(st.h) * BW) / 2;
      st.xs.push(cx);
      st.zs.push(cz);
      st.hs.push(st.h);
      const g = gapOf(st, k);
      st.ex = cx + Math.cos(st.h) * (BW / 2 + g);
      st.ez = cz + Math.sin(st.h) * (BW / 2 + g);
    }
  };
  /** Of the two contour headings, the one nearer h. */
  const nearestAlong = (h: number) =>
    Math.abs(turnTo(along, h)) <= Math.PI / 2 ? along : along + Math.PI;
  const blockAt = (st: Street, i: number, side: number) => {
    slot(st, i);
    const h = st.hs[i]!,
      off = st.half + BD / 2;
    return {
      bx: st.xs[i]! - Math.sin(h) * off * side,
      bz: st.zs[i]! + Math.cos(h) * off * side,
      t: -h,
    };
  };
  const costOf = (st: Street, i: number, side: number) => {
    const { bx, bz } = blockAt(st, i, side),
      d = Math.hypot(bx, bz);
    return (
      d * (1 + 4 * grade(st.hs[i]!)) -
      (st.straight && st.depth === 0 && road[st.q]! >= 0 ? 10 : 0) +
      3 * unit(seed, st.id * 7 + side, i)
    );
  };
  const push = (st: Street, side: number) => {
    const s = side < 0 ? 0 : 1;
    if (st.done[s]) return;
    heaps[st.q]!.push(costOf(st, st.next[s], side), st.id * 2 + s);
  };
  const street = (
    q: number,
    depth: number,
    ox: number,
    oz: number,
    h: number,
    half: number,
    isStraight: boolean,
    from: number,
  ) => {
    const st: Street = {
      q,
      depth,
      half,
      straight: isStraight,
      id: streets.length,
      xs: [],
      zs: [],
      hs: [],
      ex: ox + Math.cos(h) * from,
      ez: oz + Math.sin(h) * from,
      h,
      wander: 0,
      h0: h,
      next: [0, 0],
      fails: [0, 0],
      done: [false, false],
      used: new Set(),
    };
    streets.push(st);
    push(st, -1);
    push(st, 1);
    return st;
  };
  /** Branches leave a street at a slot taken: across it, leaning along the hillside. */
  const branch = (st: Street, i: number, b: number) => {
    if (st.depth >= 4 || i < 1 || (st.depth > 0 && (i + st.id) % 2 !== 0)) return;
    slot(st, i);
    const h = st.hs[i]!,
      // (From the gap before slot i: the cross street.)
      g = gapOf(st, i - 1),
      ox = st.xs[i]! - Math.cos(h) * (BW / 2 + g / 2),
      oz = st.zs[i]! - Math.sin(h) * (BW / 2 + g / 2);
    for (const side of [-1, 1]) {
      let hb = h + (side * Math.PI) / 2;
      if (!st.straight || !flat) hb += turnTo(nearestAlong(hb), hb) * bendBy;
      const half = st.straight ? STREET_W / 2 : LANE_W / 2;
      // (Straight where its ground was measured out; a road's own side streets are lanes like any other's.)
      street(st.q, st.depth + 1, ox, oz, hb, half, measuredAt(b), st.half + BD + g);
    }
  };
  // The first streets: one down each quarter from the square, a road's along its road.
  for (let q = 0; q < QUARTERS; q++) {
    const b = bearing[q]!,
      isRoad = road[q]! >= 0;
    street(q, 0, 0, 0, b, isRoad ? ROAD_HALF + 2 : LANE_W / 2, isRoad, SQUARE_R + 4);
  }

  // —— Measured ground: a lattice along the main road ——
  const PU = BW + STREET_W,
    PV = BD + STREET_W,
    lc = Math.cos(lattice),
    ls = Math.sin(lattice),
    cellHeaps: MinHeap[] = Array.from({ length: QUARTERS }, () => new MinHeap()),
    cellX: number[] = [],
    cellZ: number[] = [];
  let ring = -1;
  const quarterNear = (bx: number, bz: number) => {
    const a = Math.atan2(bz, bx);
    let best = 0,
      off = Infinity;
    for (let q = 0; q < QUARTERS; q++) {
      const o = Math.abs(turnTo(a, bearing[q]!));
      if (o < off) {
        off = o;
        best = q;
      }
    }
    return best;
  };
  const growLattice = () => {
    ring++;
    for (let i = -ring - 1; i <= ring; i++)
      for (let j = -ring - 1; j <= ring; j++) {
        if (Math.max(Math.abs(i + 0.5), Math.abs(j + 0.5)) !== ring + 0.5) continue;
        const u = (i + 0.5) * PU,
          v = (j + 0.5) * PV,
          // (Along the road u, across it v: as a block's own frame.)
          bx = u * lc + v * ls,
          bz = u * ls - v * lc;
        const id = cellX.push(bx) - 1;
        cellZ.push(bz);
        cellHeaps[quarterNear(bx, bz)]!.push(Math.hypot(bx, bz), id);
      }
  };
  const takeCell = (b: number, q: number): boolean => {
    const heap = cellHeaps[q]!;
    for (let tries = 0; tries < 4000; tries++) {
      while (!heap.size || heap.peekKey() > (ring + 0.5) * Math.min(PU, PV)) growLattice();
      const id = heap.pop(),
        bx = cellX[id]!,
        bz = cellZ[id]!;
      if (clear(bx, bz, -lattice, KEEP, b)) {
        put(b, bx, bz, -lattice, true);
        return true;
      }
    }
    return false;
  };

  // —— A block a street can't give: the nearest open ground in its quarter, a new street from it ——
  const fallback = (b: number, q: number) => {
    let r = SQUARE_R + REACH;
    for (let o = 0; o < placed; o++) r = Math.max(r, Math.hypot(x[o]!, z[o]!) * 0.6);
    for (let step = 0; step < 400; step++, r += 10)
      for (let k = 0; k <= 12; k++) {
        const a = bearing[q]! + ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8)) / 6,
          bx = r * Math.cos(a),
          bz = r * Math.sin(a),
          t = -(a + Math.PI / 2);
        if (!clear(bx, bz, t, KEEP, b)) continue;
        put(b, bx, bz, t, false);
        street(q, 1, bx, bz, a, LANE_W / 2, false, REACH + LANE_W);
        return;
      }
    put(b, r * Math.cos(bearing[q]!), r * Math.sin(bearing[q]!), -bearing[q]!, false);
  };

  for (let b = 0; b < count; b++) {
    const q = quarterOf(seed, b);
    if (measuredAt(b) && flat && takeCell(b, q)) continue;
    const heap = heaps[q]!;
    let done = false;
    for (let tries = 0; tries < 600 && heap.size && !done; tries++) {
      const id = heap.pop(),
        st = streets[id >> 1]!,
        s = (id & 1) as 0 | 1,
        side = s ? 1 : -1,
        i = st.next[s];
      if (st.done[s]) continue;
      st.next[s] = i + 1;
      const { bx, bz, t } = blockAt(st, i, side),
        off = Math.abs(turnTo(Math.atan2(bz, bx), bearing[q]!)),
        wide = st.depth === 0 ? 0.2 : 0;
      if (off > WEDGE + wide && Math.hypot(bx, bz) > SQUARE_R + REACH * 2) {
        st.done[s] = true;
        continue;
      }
      if (clear(bx, bz, t, KEEP, b)) {
        put(b, bx, bz, t, measuredAt(b));
        st.fails[s] = 0;
        if (!st.used.has(i)) {
          st.used.add(i);
          branch(st, i, b);
        }
        push(st, side);
        done = true;
      } else if (++st.fails[s] >= 3) st.done[s] = true;
      else push(st, side);
    }
    if (!done) fallback(b, q);
  }
  return { x, z, yaw, straight };
}

/** Whether two blocks overlap, each kept `pad` clear about it (their sides apart, by their axes). */
function overlaps(
  ax: number,
  az: number,
  at: number,
  bx: number,
  bz: number,
  bt: number,
  pad: number,
): boolean {
  const dx = bx - ax,
    dz = bz - az;
  if (dx * dx + dz * dz > (2 * (REACH + pad)) ** 2) return false;
  const hw = BW / 2 + pad,
    hd = BD / 2 + pad,
    ac = Math.cos(at),
    as = Math.sin(at),
    bc = Math.cos(bt),
    bs = Math.sin(bt);
  // (Each block's axes: along (c, -s), across (s, c).)
  const apart = (nx: number, nz: number) =>
    Math.abs(dx * nx + dz * nz) >=
    hw * Math.abs(ac * nx - as * nz) +
      hd * Math.abs(as * nx + ac * nz) +
      hw * Math.abs(bc * nx - bs * nz) +
      hd * Math.abs(bs * nx + bc * nz);
  return !(apart(ac, -as) || apart(as, ac) || apart(bc, -bs) || apart(bs, bc));
}

/** A town's streets in words, read off how they were laid: measured straight, or grown as they were walked. */
export function streetWords(blocks: GrownBlocks, site: TownSite): string {
  let measured = 0;
  for (let b = 0; b < blocks.straight.length; b++) measured += blocks.straight[b]!;
  const n = blocks.straight.length,
    share = n ? measured / n : 0,
    hill = site.rise >= STEEP ? ", bending along its hillside" : "",
    roads =
      site.roads.length > 1
        ? `; its main streets are its ${site.roads.length} roads in, meeting at its square`
        : site.roads.length === 1
          ? "; its main street is its road in"
          : "";
  const how =
    share > 0.6
      ? "Its ground was measured out before it was built: straight streets and blocks cut alike"
      : share > 0.15
        ? "Its old heart grew lane by lane as it was walked; its newer quarters were measured out straight"
        : "Its lanes grew as its people walked them, out from its square";
  return `${how}${hill}${roads}.`;
}
