// The square's days, as Classic kept them (Phase 33 M174–M175, asked for 2026-10-24: "i cant see
// the cities form and evolve and get that type of detail i got from the og causalisis"): the
// feasts a town keeps — the harvest home once its grain is in and its land fed, a peace its realm
// made, its realm's new ruler crowned, the holy day of its faith — when bunting is strung about the
// square, long tables set with bread and pots, and at dusk a bonfire lit, the town eating at the
// tables and dancing in a ring about the fire until late; and the market day, once a week in a
// town with a market, its stalls under striped awnings about the square of a morning. Pure: the
// square's pieces (metres from its middle) and which days are which; the people's own part in
// them is their day's (village.ts).
import type { Feast, VillagePlan } from "../bridge/index.ts";
import { buryingDay } from "./graveyard.ts";

const DAY = 86_400,
  HOUR = 3_600;

/** A piece of the square's dressing: its middle (metres; y up), its size, its turn. */
export type SquarePiece = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly yaw: number;
};

/** A place in the square: where, and which way it faces. */
type Spot = { readonly x: number; readonly z: number; readonly yaw: number };

/**
 * Where the feast is laid out: its fire and the ring danced about it, its tables (a town's
 * square's two; an old village's one, nearer in), its bunting's poles about the square and how
 * high it is strung — over the townsfolk's heads, as they are drawn (three times their size).
 */
export const FEAST = {
  fire: { x: -9, z: -2 },
  ring: 6.5,
  tables: [
    { x: 3, z: 7, len: 14 },
    { x: 3, z: 14, len: 14 },
  ],
  villageTable: { x: 2, z: 5.5, len: 9 },
  poles: 8,
  reach: 15.5,
  high: 8.5,
  sag: 1.2,
} as const;

/**
 * A table and a market stall at the townsfolk's own size as drawn: a table's breadth, the height
 * of its board and the board's thickness; a stall's counter (its breadth, height and depth) and
 * the height of its awning.
 */
const TABLE = { w: 2.6, top: 2, board: 0.26 } as const,
  STALL = { w: 4.4, h: 2.2, d: 2.4, roof: 6.4 } as const;

/**
 * How near the square's middle its dressing is drawn: a town's square is forty metres across; an
 * old village's homes ring its middle from sixteen metres out, and a city's middle is the crossing
 * of its streets, so there the fire, the ring, the poles and the stalls are drawn in.
 */
export function squareScale(plan: Pick<VillagePlan, "town">): number {
  return plan.town ? 1 : 0.65;
}

/** When the feast is kept: the square dressed from the morning, the fire lit at dusk, all over late. */
export const FEAST_HOURS = { dressed: 8, gather: 16.5, lit: 18, over: 23 } as const;

/** Each feast's sign, and its words in the bar. */
export const FEAST_SIGNS: Readonly<Record<Feast["occasion"], string>> = {
  harvest: "🌾",
  peace: "🕊️",
  crowning: "👑",
  holy: "🙏",
};

/** The feast kept on `day` (days since the world began), if one is. */
export function feastOn(plan: Pick<VillagePlan, "life" | "town">, day: number): Feast | null {
  // (Put off the day the town buries those a fire or a quake killed: Phase 43 M205.)
  if (buryingDay(plan, day)) return null;
  return plan.life?.feasts?.find((f) => f.day === day) ?? null;
}

/** Whether the square is dressed for a feast at moment t, and whether its fire burns. */
export function feastAt(
  plan: Pick<VillagePlan, "life" | "town" | "fireless">,
  t: number,
): { readonly feast: Feast; readonly dressed: boolean; readonly lit: boolean } | null {
  const day = Math.floor(t / DAY),
    feast = feastOn(plan, day);
  if (!feast) return null;
  const hour = (t - day * DAY) / HOUR;
  return {
    feast,
    dressed: hour >= FEAST_HOURS.dressed && hour < FEAST_HOURS.over + 1,
    // (Where nothing burns no bonfire is lit: Phase 56.)
    lit: !plan.fireless && hour >= FEAST_HOURS.lit && hour < FEAST_HOURS.over + 1,
  };
}

/**
 * A town's market day: once a week where it keeps a market (never its day of rest, nor a feast
 * day, nor the day it buries those a fire or a quake killed).
 */
export function marketDay(
  plan: Pick<VillagePlan, "market" | "seed" | "life" | "town">,
  day: number,
): boolean {
  return (
    plan.market &&
    (day + (plan.seed % 7)) % 7 === 3 &&
    !feastOn(plan, day) &&
    !buryingDay(plan, day)
  );
}

/** When the market stands: its stalls set up early, the buying of a morning, packed away late in the afternoon. */
export const MARKET_HOURS = { set: 7, buy: 8.5, done: 12, packed: 17.5 } as const;

/** Whether the market stands in the square at moment t. */
export function marketAt(
  plan: Pick<VillagePlan, "market" | "seed" | "life" | "town">,
  t: number,
): boolean {
  const day = Math.floor(t / DAY),
    hour = (t - day * DAY) / HOUR;
  return marketDay(plan, day) && hour >= MARKET_HOURS.set && hour < MARKET_HOURS.packed;
}

/** Where a market town's hall stands by its square (metres), to be kept clear of: its middle and half-size. */
const HALL = { x: 14, z: -10, hx: 10, hz: 6.5 } as const;

/** Whether a point of the square is `margin` clear of the market hall (where the town keeps a market). */
function clearOfHall(
  plan: Pick<VillagePlan, "market">,
  x: number,
  z: number,
  margin = 1.5,
): boolean {
  return (
    !plan.market ||
    Math.abs(x - HALL.x) > HALL.hx + margin ||
    Math.abs(z - HALL.z) > HALL.hz + margin
  );
}

/** The bunting's poles about the square, clear of the market hall. */
function poles(plan: Pick<VillagePlan, "market" | "town">): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [],
    reach = FEAST.reach * squareScale(plan);
  for (let k = 0; k < FEAST.poles; k++) {
    const a = ((k + 0.5) / FEAST.poles) * 2 * Math.PI,
      x = reach * Math.cos(a),
      z = reach * Math.sin(a);
    if (clearOfHall(plan, x, z)) out.push({ x, z });
  }
  return out;
}

/** The feast's tables in this square: a town's two, an old village's one. */
function tablesOf(
  plan: Pick<VillagePlan, "town">,
): readonly { readonly x: number; readonly z: number; readonly len: number }[] {
  return plan.town ? FEAST.tables : [FEAST.villageTable];
}

/** The colours the bunting's flags come in, in turn. */
export const FLAG_COLORS: readonly (readonly [number, number, number])[] = [
  [0.9, 0.2, 0.18],
  [0.98, 0.8, 0.2],
  [0.2, 0.45, 0.9],
  [0.25, 0.7, 0.35],
  [0.96, 0.95, 0.92],
];

/**
 * The feast's dressing of the square: the bunting's poles and its flags (a list for each colour,
 * strung pole to pole, sagging between), the tables on their trestles and what is set on them,
 * and the bonfire's logs. Pure: the same plan, the same square.
 */
export function feastScene(plan: Pick<VillagePlan, "market" | "town">): {
  readonly poles: readonly SquarePiece[];
  readonly flags: readonly (readonly SquarePiece[])[];
  readonly tables: readonly SquarePiece[];
  readonly trestles: readonly SquarePiece[];
  readonly food: readonly SquarePiece[];
  readonly logs: SquarePiece;
} {
  const k0 = squareScale(plan),
    at = poles(plan),
    flags: SquarePiece[][] = FLAG_COLORS.map(() => []);
  let n = 0;
  at.forEach((p, k) => {
    // (Strung to the next pole round, unless the hall stands between.)
    const q = at[(k + 1) % at.length]!,
      len = Math.hypot(q.x - p.x, q.z - p.z);
    if (at.length < 2 || len > FEAST.reach * k0 * 1.2) return;
    const yaw = Math.atan2(q.x - p.x, q.z - p.z);
    for (let d = 1; d < len - 0.6; d += 1.5) {
      const k2 = d / len,
        sag = 4 * FEAST.sag * k2 * (1 - k2);
      flags[n++ % FLAG_COLORS.length]!.push({
        x: p.x + (q.x - p.x) * k2,
        y: FEAST.high - sag - 0.45,
        z: p.z + (q.z - p.z) * k2,
        sx: 0.06,
        sy: 0.85,
        sz: 0.75,
        yaw,
      });
    }
  });
  const tables: SquarePiece[] = [],
    trestles: SquarePiece[] = [],
    food: SquarePiece[] = [];
  for (const t of tablesOf(plan)) {
    // (Along the square's x, as the places about them are.)
    tables.push({
      x: t.x,
      y: TABLE.top - TABLE.board / 2,
      z: t.z,
      sx: t.len,
      sy: TABLE.board,
      sz: TABLE.w,
      yaw: 0,
    });
    for (const end of [-1, 1])
      trestles.push({
        x: t.x + end * (t.len / 2 - 0.9),
        y: (TABLE.top - TABLE.board) / 2,
        z: t.z,
        sx: 0.36,
        sy: TABLE.top - TABLE.board,
        sz: TABLE.w * 0.85,
        yaw: 0,
      });
    for (let i = 0; i < 8; i++)
      food.push({
        x: t.x - t.len / 2 + 1.4 + i * ((t.len - 2.8) / 7),
        y: TABLE.top + 0.27,
        z: t.z + (i % 2 ? 0.5 : -0.5),
        sx: 1.2,
        sy: 0.55,
        sz: 0.85,
        yaw: i * 0.7,
      });
  }
  return {
    poles: at.map((p) => ({
      x: p.x,
      y: FEAST.high / 2,
      z: p.z,
      sx: 0.26,
      sy: FEAST.high + 0.3,
      sz: 0.26,
      yaw: 0,
    })),
    flags,
    tables,
    trestles,
    food,
    logs: { ...fireOf(plan), y: 1.2, sx: 4, sy: 2.4, sz: 4, yaw: 0 },
  };
}

/** Where the bonfire is laid in this square. */
export function fireOf(plan: Pick<VillagePlan, "town">): {
  readonly x: number;
  readonly z: number;
} {
  const k = squareScale(plan);
  return { x: FEAST.fire.x * k, z: FEAST.fire.z * k };
}

/** The fire's flames now (by the screen's clock): a few tongues, each its height flickering. */
export function flamesAt(plan: Pick<VillagePlan, "town">, clock: number): SquarePiece[] {
  const fire = fireOf(plan);
  return [0, 1, 2, 3].map((k) => {
    const flick = 0.75 + 0.25 * Math.sin(clock * (7 + k * 2.3) + k * 1.9),
      a = k * 1.7 + clock * 0.4,
      r = k ? 1 : 0;
    return {
      x: fire.x + Math.cos(a) * r,
      // (Rising out of the pile of logs.)
      y: 1.2 + (k ? 1.6 : 2.3) * flick,
      z: fire.z + Math.sin(a) * r,
      sx: k ? 1.6 : 2.6,
      sy: (k ? 3.2 : 4.6) * flick,
      sz: k ? 1.6 : 2.6,
      yaw: a,
    };
  });
}

/**
 * The market's stalls about the square — each a counter with its goods, its awning (a colour each
 * in turn) on four posts — clear of the hall; where a buyer stands before each, facing it, and
 * where its trader stands behind, facing the square.
 */
export function marketScene(plan: Pick<VillagePlan, "market" | "town">): {
  readonly stalls: readonly SquarePiece[];
  readonly awnings: readonly (readonly SquarePiece[])[];
  readonly posts: readonly SquarePiece[];
  readonly goods: readonly SquarePiece[];
  readonly fronts: readonly Spot[];
  readonly backs: readonly Spot[];
} {
  const stalls: SquarePiece[] = [],
    awnings: SquarePiece[][] = [[], [], [], []],
    posts: SquarePiece[] = [],
    goods: SquarePiece[] = [],
    fronts: Spot[] = [],
    backs: Spot[] = [];
  const count = plan.town ? 10 : 7,
    R = plan.town ? 11.5 : 7.4;
  for (let k = 0; k < count; k++) {
    const a = (k / count) * 2 * Math.PI + 0.3,
      x = R * Math.cos(a),
      z = R * Math.sin(a);
    if (!clearOfHall(plan, x, z, STALL.w / 2 + 1)) continue;
    // (Each facing the square's middle: ahead is inward, `along` its counter's length.)
    const yaw = Math.atan2(-x, -z),
      c = Math.cos(yaw),
      s = Math.sin(yaw),
      local = (along: number, ahead: number) => ({
        x: x + c * along + s * ahead,
        z: z - s * along + c * ahead,
      });
    stalls.push({ x, y: STALL.h / 2, z, sx: STALL.w, sy: STALL.h, sz: STALL.d, yaw });
    awnings[k % 4]!.push({
      x,
      y: STALL.roof,
      z,
      sx: STALL.w + 0.6,
      sy: 0.25,
      sz: STALL.d + 1.2,
      yaw,
    });
    for (const along of [-1, 1])
      for (const ahead of [-1, 1])
        posts.push({
          ...local((along * STALL.w) / 2, (ahead * STALL.d) / 2),
          y: STALL.roof / 2,
          sx: 0.22,
          sy: STALL.roof,
          sz: 0.22,
          yaw,
        });
    for (const along of [-1.3, 0, 1.3])
      goods.push({ ...local(along, 0.3), y: STALL.h + 0.25, sx: 1.1, sy: 0.5, sz: 0.9, yaw });
    fronts.push({ ...local(0, STALL.d / 2 + 1), yaw: Math.atan2(x, z) });
    backs.push({ ...local(0, -(STALL.d / 2 + 0.9)), yaw });
  }
  return { stalls, awnings, posts, goods, fronts, backs };
}

/** Where a person keeps the feast: at a table facing across it, or in the ring about the fire facing it. */
export function feastPlace(plan: Pick<VillagePlan, "town">, dance: boolean, u: number): Spot {
  if (dance) {
    const a = u * 2 * Math.PI,
      fire = fireOf(plan),
      r = FEAST.ring * squareScale(plan);
    return {
      x: fire.x + r * Math.cos(a),
      z: fire.z + r * Math.sin(a),
      yaw: Math.atan2(-Math.cos(a), -Math.sin(a)),
    };
  }
  // (A place every two metres along each side of each table.)
  const tables = tablesOf(plan),
    each = tables.map((t) => Math.max(3, Math.floor(t.len / 2))),
    seats = each.reduce((a, n) => a + 2 * n, 0);
  let seat = Math.min(seats - 1, Math.floor(u * seats)),
    i = 0;
  while (seat >= 2 * each[i]!) seat -= 2 * each[i++]!;
  const t = tables[i]!,
    n = each[i]!,
    side = seat < n ? -1 : 1;
  return {
    x: t.x - t.len / 2 + (((seat % n) + 0.5) / n) * t.len,
    z: t.z + side * (TABLE.w / 2 + 0.75),
    // (Facing across the table.)
    yaw: side < 0 ? 0 : Math.PI,
  };
}

/**
 * A feast in the bar's words: what it is, where, and how far it has come. `wet`: a downpour falls on
 * the town, and those at their ease are in out of it (Phase 30), the feast with them till it passes.
 */
export function feastWords(
  at: { readonly feast: Feast; readonly lit: boolean },
  town: string,
  wet = false,
): string {
  if (wet) return `${at.feast.words} in ${town}: the town in out of the downpour till it passes`;
  return `${at.feast.words} in ${town}: the town feasts in its square${at.lit ? " by its bonfire" : " this evening"}`;
}

/**
 * What the square of a town seen near shows at moment t, for the bar: its feast while dressed, else
 * its market. `wet`: a downpour falls on it, those at their ease in out of it.
 */
export function squareNow(
  plan: Pick<VillagePlan, "life" | "market" | "seed" | "name">,
  t: number,
  wet = false,
): { readonly icon: string; readonly words: string } | null {
  const f = feastAt(plan, t);
  if (f?.dressed)
    return { icon: `${FEAST_SIGNS[f.feast.occasion]}🎉`, words: feastWords(f, plan.name, wet) };
  if (marketAt(plan, t))
    return {
      icon: "🛒",
      words: wet
        ? `Market day in ${plan.name}: its stalls stand in the rain, those come to buy gone in out of it`
        : `Market day in ${plan.name}: its stalls stand in the square`,
    };
  return null;
}

/** How fast the ring goes round its fire: radians a second of the screen's clock (once round in half a minute). */
export const RING_TURN = 0.2;

/** A dancer carried round the ring by the screen's clock: where they are now, facing the fire. */
export function ringTurn(
  plan: Pick<VillagePlan, "town">,
  at: { readonly x: number; readonly z: number },
  clock: number,
): { x: number; z: number; yaw: number } {
  const fire = fireOf(plan),
    dx = at.x - fire.x,
    dz = at.z - fire.z,
    r = Math.hypot(dx, dz),
    a = Math.atan2(dz, dx) + clock * RING_TURN,
    x = fire.x + r * Math.cos(a),
    z = fire.z + r * Math.sin(a);
  return { x, z, yaw: Math.atan2(fire.x - x, fire.z - z) };
}
