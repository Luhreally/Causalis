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
  /**
   * What its streets were laid for, part by part as it grew, oldest first (absent: for those on foot, all of it): from which
   * block on, how broad a lane and a measured street were laid (metres) and how far each block was set back from the next
   * (its verge). A street is as broad as two of what goes down it need to pass: so a town's old heart keeps the lanes it was
   * walked in, and what was laid after its people took to engines is broad and set apart.
   */
  readonly laid?: readonly StreetsLaid[];
  /**
   * How far its realm's will was done on its land each time its ground was taken up anew, oldest first (absent: read by
   * `measured`, as a save from before they were kept is): from which block on, and how far (0 … 1). Ground is measured out
   * before it is built where someone can make a household build to a line: cut into equal blocks where the realm's will is
   * done (SURVEYED), its streets at least run straight where it is half done (STRAIGHT), and its lanes wander the more the
   * less it is.
   */
  readonly surveys?: readonly Survey[];
  /**
   * Its market place: the ground it would have taken next at its first market (block `at`), kept open, as great as its
   * people then asked (1: a block beside its main street; 2: one each side, the street through it; 3: two each side).
   */
  readonly place?: { readonly at: number; readonly size: number };
  /**
   * Its land's water about it, as its land's map draws it (absent: none near, or its people live in the water): the squares
   * between the middles of the map's tiles about its own, each `m` metres across on the town's ground (the map draws a town
   * LAND_SCALE times its size), `half` squares out each way, row by row from the north-west; each square's two facets (as
   * the map's mesh cuts it), bit 1 the one toward the north-west, bit 2 the other, set where two of the facet's three
   * tiles are water. Nothing of the town is laid there: no block, no sprawl; the land's map and the town read one water.
   */
  readonly wet?: { readonly m: number; readonly half: number; readonly cells: string };
};

/** How many times its size a town is drawn on its land's map (so a tile of the map is a fifth of its breadth on the town's ground). */
export const LAND_SCALE = 5;

/**
 * Whether a point of a town's ground (metres from its square) lies on its land's water (TownSite.wet): on a facet of its
 * land's map that is drawn as water.
 */
export function wetGround(site: TownSite | null | undefined, x: number, z: number): boolean {
  const w = site?.wet;
  if (!w) return false;
  const fx = x / w.m + w.half,
    fz = z / w.m + w.half,
    i = Math.floor(fx),
    j = Math.floor(fz),
    n = 2 * w.half;
  if (i < 0 || j < 0 || i >= n || j >= n) return false;
  const bits = w.cells.charCodeAt(j * n + i) - 48;
  return fx - i + (fz - j) <= 1 ? (bits & 1) !== 0 : (bits & 2) !== 0;
}

/** A part of a town's ground taken up under a realm's will (TownSite.surveys). */
export type Survey = { readonly from: number; readonly order: number };
/** From what reach a realm's clerks cut ground into equal blocks, and from what its streets are at least laid straight. */
export const SURVEYED = 0.45,
  STRAIGHT = 0.25;

/** How a part of a town's streets was laid (TownSite.laid). */
export type StreetsLaid = {
  readonly from: number;
  readonly lane: number;
  readonly street: number;
  readonly verge: number;
};

/** How a town's streets were laid at block `b` (null: for those on foot, as of old). */
export function laidAt(site: TownSite | null | undefined, b: number): StreetsLaid | null {
  const laid = site?.laid;
  if (!laid) return null;
  let at: StreetsLaid | null = null;
  for (const l of laid) if (b >= l.from) at = l;
  return at;
}

/** How broad the street about block `b` is (metres), as its ground is drawn. */
export function streetWide(site: TownSite | null | undefined, b: number): number {
  const l = laidAt(site, b);
  return l ? Math.max(l.lane, l.street) + 2 * l.verge : 8;
}

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

/**
 * Whether a home carries shops on its ground floor: a tenement or a block near the square, where those who pass buy (the
 * near third of the town, and its first three rounds at least). `lots`: the lots the town has taken.
 */
export function shopsBelow(lot: number, lots: number, level: number): boolean {
  return (
    (level === 3 || level === 4) &&
    Math.floor(lot / 8) < Math.max(HEART_BLOCKS * 3, Math.ceil(lots / 8) / 3)
  );
}

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
      // (The way in first: where a road runs to the water, the road keeps its bearing and the water quarter lies beside it.)
      [QUARTER.road, main ? main.bearing : zero],
      [QUARTER.water, water ? Math.atan2(water.z, water.x) : site.up + Math.PI],
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

/** How far off its road's bearing a block of a quarter down a road in may lie (against WEDGE for a quarter with none). */
const ROAD_WEDGE = 0.55;

/** What the going down a road in costs against a lane's, a metre. */
export const ROAD_GOING = 0.6;

/**
 * What the going costs toward bearing `a` from a town's square against level ground: more up or down its slope (by a
 * fifteenth for each metre it rises in a kilometre, as its land's map has it), nothing more along it.
 */
export function climb(site: TownSite, a: number): number {
  return 1 + (Math.min(30, site.rise) / 15) * Math.abs(Math.cos(a - site.up));
}

/**
 * How far out a town's ground is taken toward bearing `a`, of the furthest it goes (0.4 … 1): a finger down each road in,
 * the way it trades by, less between them, and less up and down its slope than along it. By this its sprawl past the lots
 * drawn is laid, as its blocks are by what the going to each costs.
 */
export function reachToward(site: TownSite | null | undefined, a: number): number {
  if (!site) return 1;
  let finger = 0;
  for (const r of site.roads) {
    const off = Math.atan2(Math.sin(a - r.bearing), Math.cos(a - r.bearing));
    finger = Math.max(finger, Math.exp(-((off / 0.24) ** 2)));
  }
  const open = site.roads.length ? 0.55 + 0.45 * finger : 1;
  return Math.max(0.4, open / (0.5 + 0.5 * climb(site, a)));
}

/** A street as it is laid: from where it leaves the one it branches from, slot by slot (a block each side of each). */
type Street = {
  readonly q: number;
  readonly depth: number;
  /** Its half breadth: a block's front stands so far from its middle line. */
  readonly half: number;
  /** Straight (a road, or measured ground): no wandering. */
  readonly straight: boolean;
  /** How much it wanders, of what a lane walked under no one's will does. */
  readonly loose: number;
  /** The breadth of the gaps along it, where its side streets cross (a lane's, or a measured street's, as it was laid). */
  readonly cross: number;
  /** How far each block along it keeps from the next (KEEP, and its verge). */
  readonly pad: number;
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
  /** A main street's: the first block that fronted each slot. */
  readonly since: number[];
};

/** Where a town's blocks stand, in the order it takes them, and which of them were measured out straight. */
export type GrownBlocks = {
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly yaw: Float32Array;
  readonly straight: Uint8Array;
  /** Its main streets: the first street of each quarter, out from its square (a road's along its road). */
  readonly mains: readonly MainStreet[];
  /** Its market place (absent: none, or no ground could be kept for it): its middle, its turn, how long and deep, and the block it was taken at. */
  readonly place?: MarketPlace;
};

/** A town's market place on its ground (GrownBlocks.place). */
export type MarketPlace = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly w: number;
  readonly d: number;
  readonly at: number;
  /** Its main street runs through its middle (else beside it). */
  readonly through: boolean;
};

/**
 * A main street of a town, length by length out from its square: each length's middle and heading, how long it is, and the
 * first block that fronted it (a town drawn to fewer blocks draws only the lengths fronted by then).
 */
export type MainStreet = {
  /** Its quarter (QUARTER), and the road in it runs along (an index into the site's roads; -1: none). */
  readonly q: number;
  readonly road: number;
  /** Half its breadth (metres). */
  readonly half: number;
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly h: Float32Array;
  readonly len: Float32Array;
  readonly since: Int32Array;
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
  // (Past the blocks asked, the ground kept open for its market place: four blocks' at the most.)
  const HELD = 4,
    x = new Float32Array(count + HELD),
    z = new Float32Array(count + HELD),
    yaw = new Float32Array(count + HELD),
    straight = new Uint8Array(count),
    { bearing, road } = quarterBearings(site, water, axis),
    lattice = site.roads[0]?.bearing ?? axis,
    flat = site.rise < STEEP,
    // (A people who pass over their town, swimming or on the wing, gain nothing by a road: theirs keeps no fingers.)
    over = !!site.laid?.length && site.laid[0]!.from === 0 && site.laid[0]!.street <= 3,
    // (Contour headings: across the slope.)
    along = site.up + Math.PI / 2,
    bendBy = Math.min(0.85, site.rise / 50),
    grade = (h: number) => (site.rise / 1000) * Math.abs(Math.cos(h - site.up)),
    // —— What stands: blocks by cells, for keeping apart ——
    CELL = 56,
    cells = new Map<number, number[]>(),
    cellKey = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096),
    wallBlock = site.walled !== null ? Math.ceil(site.walled / 8) : -1,
    // (How far its realm's will was done when block b's ground was taken up; of old, all or nothing from `measured`.)
    orderOf = (b: number): number => {
      if (!site.surveys) return site.measured >= 0 && b >= site.measured ? 1 : 0;
      let o = 0;
      for (const s of site.surveys) if (b >= s.from) o = s.order;
      return o;
    },
    measuredAt = (b: number) => orderOf(b) >= SURVEYED,
    straightAt = (b: number) => orderOf(b) >= STRAIGHT,
    // (How much a lane wanders: as it was walked where no one's will was done, less where some was.)
    looseAt = (b: number) => (site.surveys ? Math.max(0.25, 1 - orderOf(b) / STRAIGHT) : 1),
    // (What each part's streets were laid for: absent, for those on foot.)
    laneAt = (b: number) => laidAt(site, b)?.lane ?? LANE_W,
    streetAt = (b: number) => laidAt(site, b)?.street ?? STREET_W,
    vergeAt = (b: number) => laidAt(site, b)?.verge ?? 0,
    // (How far each block keeps from the next: half of it each; never more than its lane leaves.)
    padAt = (b: number) => Math.min(KEEP, laneAt(b) / 2 - 0.25) + vergeAt(b);
  let placed = 0,
    wallR = -1,
    place: MarketPlace | undefined;
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
    // The water and its shore; and its land's own water, as its map has it.
    if (water && Math.hypot(bx - water.x, bz - water.z) < water.r + SHORE_W + REACH) return false;
    // (Its middle and its four corners: no lot of it on a facet the map draws as water.)
    if (
      site.wet &&
      (wetGround(site, bx, bz) ||
        [-1, 1].some((u) =>
          [-1, 1].some((v) =>
            wetGround(
              site,
              bx + (u * c * BW) / 2 + (v * s * BD) / 2,
              bz - (u * s * BW) / 2 + (v * c * BD) / 2,
            ),
          ),
        ))
    )
      return false;
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
      // (And its market place, where it was kept before them.)
      if (place) r = Math.max(r, placeReach(place));
      wallR = r + 8;
    }
  };

  // —— Streets ——
  const streets: Street[] = [],
    heaps: MinHeap[] = Array.from({ length: QUARTERS }, () => new MinHeap()),
    gapOf = (st: Street, i: number) =>
      st.straight ? st.cross : st.cross + 3 * unit(seed, st.id * 131 + i, 3);
  const slot = (st: Street, i: number) => {
    while (st.xs.length <= i) {
      const k = st.xs.length;
      if (!st.straight) {
        // (A lane wanders a little as it was walked, and leans along the hillside.)
        st.wander = Math.max(
          -0.35 * st.loose,
          Math.min(0.35 * st.loose, st.wander + (unit(seed, st.id, k) - 0.5) * 0.22 * st.loose),
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
    // (What a block costs is the going to it from the square. Down a road in, the going is quick: its fronts are taken
    // half as far again as a lane's, and the town grows a finger along each way it trades by. Up or down its slope the
    // going is slow, along it easy: the town lies long across its hillside.)
    return (
      d *
        (st.depth === 0 && road[st.q]! >= 0 && !over ? ROAD_GOING : 1) *
        climb(site, Math.atan2(bz, bx)) *
        (1 + 4 * grade(st.hs[i]!)) +
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
    b = 0,
  ) => {
    const st: Street = {
      q,
      depth,
      half: half + vergeAt(b),
      straight: isStraight,
      loose: looseAt(b),
      cross: (isStraight ? streetAt(b) : laneAt(b)) + 2 * vergeAt(b),
      pad: padAt(b),
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
      since: [],
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
      // (Straight where its ground was measured out; a road's own side streets are lanes like any other's.)
      const half = (st.straight ? streetAt(b) : laneAt(b)) / 2;
      street(st.q, st.depth + 1, ox, oz, hb, half, straightAt(b), st.half + BD + g, b);
    }
  };
  // The first streets: one down each quarter from the square, a road's along its road.
  for (let q = 0; q < QUARTERS; q++) {
    const b = bearing[q]!,
      isRoad = road[q]! >= 0;
    street(q, 0, 0, 0, b, isRoad ? ROAD_HALF + 2 : laneAt(0) / 2, isRoad, SQUARE_R + 4);
  }

  // —— Measured ground: a lattice along the main road ——
  // (One lattice to each breadth of street its measured ground was laid with: what was cut for engines is cut wider.)
  type Lattice = {
    readonly PU: number;
    readonly PV: number;
    readonly pad: number;
    readonly cellHeaps: MinHeap[];
    readonly cellX: number[];
    readonly cellZ: number[];
    ring: number;
  };
  const lc = Math.cos(lattice),
    ls = Math.sin(lattice),
    lattices = new Map<number, Lattice>(),
    latticeAt = (b: number): Lattice => {
      const wide = streetAt(b) + 2 * vergeAt(b);
      let l = lattices.get(wide);
      if (!l)
        lattices.set(
          wide,
          (l = {
            PU: BW + wide,
            PV: BD + wide,
            pad: padAt(b),
            cellHeaps: Array.from({ length: QUARTERS }, () => new MinHeap()),
            cellX: [],
            cellZ: [],
            ring: -1,
          }),
        );
      return l;
    };
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
  const growLattice = (l: Lattice) => {
    const { PU, PV, cellX, cellZ, cellHeaps } = l,
      ring = ++l.ring;
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
    const l = latticeAt(b),
      { PU, PV, cellX, cellZ } = l,
      heap = l.cellHeaps[q]!;
    for (let tries = 0; tries < 4000; tries++) {
      while (!heap.size || heap.peekKey() > (l.ring + 0.5) * Math.min(PU, PV)) growLattice(l);
      const id = heap.pop(),
        bx = cellX[id]!,
        bz = cellZ[id]!;
      if (clear(bx, bz, -lattice, l.pad, b)) {
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
        if (!clear(bx, bz, t, padAt(b), b)) continue;
        put(b, bx, bz, t, false);
        street(q, 1, bx, bz, a, laneAt(b) / 2, false, REACH + laneAt(b), b);
        return;
      }
    put(b, r * Math.cos(bearing[q]!), r * Math.sin(bearing[q]!), -bearing[q]!, false);
  };

  // —— Its market place: the next ground along its main street, both sides of it where it is great, kept open ——
  const keepPlace = (b: number) => {
    const want = site.place!,
      st = streets[QUARTER.road]!,
      both = want.size >= 2,
      slots = want.size >= 3 ? 2 : 1,
      sides = both ? [-1, 1] : [1],
      first = Math.max(st.next[0], st.next[1]);
    for (let i = first; i < first + 6; i++) {
      let free = true;
      for (let k = 0; k < slots && free; k++)
        for (const side of sides) {
          const { bx, bz, t } = blockAt(st, i + k, side);
          if (!clear(bx, bz, t, Math.max(st.pad, padAt(b)), b)) free = false;
        }
      if (!free) continue;
      let n = 0,
        mx = 0,
        mz = 0;
      for (let k = 0; k < slots; k++) {
        for (const side of sides) {
          const { bx, bz, t } = blockAt(st, i + k, side),
            o = count + n++;
          x[o] = bx;
          z[o] = bz;
          yaw[o] = t;
          mx += bx;
          mz += bz;
          const key = cellKey(Math.floor(bx / CELL), Math.floor(bz / CELL)),
            list = cells.get(key);
          if (list) list.push(o);
          else cells.set(key, [o]);
        }
        // (Its main street goes on through it, and side streets leave it as they leave any block.)
        st.used.add(i + k);
        st.since[i + k] = b;
        branch(st, i + k, b);
      }
      st.next[0] = Math.max(st.next[0], i + slots);
      st.next[1] = Math.max(st.next[1], i + slots);
      const h = st.hs[i]!,
        last = st.hs[i + slots - 1]!;
      place = {
        x: mx / n,
        z: mz / n,
        yaw: -(slots > 1
          ? Math.atan2(Math.sin(h) + Math.sin(last), Math.cos(h) + Math.cos(last))
          : h),
        w: slots * BW + (slots - 1) * gapOf(st, i),
        d: both ? 2 * (st.half + BD) : BD,
        at: b,
        through: both,
      };
      return;
    }
  };

  for (let b = 0; b < count; b++) {
    const q = quarterOf(seed, b);
    if (site.place && b === site.place.at) keepPlace(b);
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
      // (A quarter down a road in keeps to its road: its blocks go out along it, not round about. A quarter with none
      // spreads as it will.)
      if (
        off > (road[q]! >= 0 && !over ? ROAD_WEDGE : WEDGE) + wide &&
        Math.hypot(bx, bz) > SQUARE_R + REACH * 2
      ) {
        st.done[s] = true;
        continue;
      }
      if (clear(bx, bz, t, Math.max(st.pad, padAt(b)), b)) {
        put(b, bx, bz, t, measuredAt(b));
        st.fails[s] = 0;
        if (!st.used.has(i)) {
          st.used.add(i);
          if (st.depth === 0) st.since[i] = b;
          branch(st, i, b);
        }
        push(st, side);
        done = true;
      } else if (++st.fails[s] >= 3) st.done[s] = true;
      else push(st, side);
    }
    if (!done) fallback(b, q);
  }
  // Its main streets, as far as each was fronted: the first of each quarter (they are the first eight laid).
  const mains: MainStreet[] = [];
  for (let q = 0; q < QUARTERS; q++) {
    const st = streets[q]!,
      at: number[] = [];
    for (let i = 0; i < st.xs.length; i++) if (st.since[i] !== undefined) at.push(i);
    mains.push({
      q: st.q,
      road: road[st.q]!,
      half: st.half,
      x: Float32Array.from(at, (i) => st.xs[i]!),
      z: Float32Array.from(at, (i) => st.zs[i]!),
      h: Float32Array.from(at, (i) => st.hs[i]!),
      len: Float32Array.from(at, (i) => BW + gapOf(st, i)),
      since: Int32Array.from(at, (i) => st.since[i]!),
    });
  }
  return {
    x: x.subarray(0, count),
    z: z.subarray(0, count),
    yaw: yaw.subarray(0, count),
    straight,
    mains,
    ...(place ? { place } : {}),
  };
}

/** How far out a market place reaches from its town's middle. */
export function placeReach(p: MarketPlace): number {
  return Math.hypot(p.x, p.z) + Math.hypot(p.w / 2, p.d / 2);
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

/** A town's streets in words, read off how they were laid (`measured`: GrownBlocks.straight): measured straight, or grown as walked. */
export function streetWords(measured: Uint8Array, site: TownSite): string {
  let n = 0;
  for (let b = 0; b < measured.length; b++) n += measured[b]!;
  const share = measured.length ? n / measured.length : 0,
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
      : share > 0.05
        ? "Its old heart grew lane by lane as it was walked; its newer quarters were measured out straight"
        : "Its lanes grew as its people walked them, out from its square";
  return `${how}${hill}${roads}${site.walled !== null ? "; a ring street runs where its walls were raised" : ""}.`;
}
