// A town's life beyond its work, as its day shows it: what the plan's goings (bridge/village.ts TownGoing, read by the host from
// its land's kept rows) put each of their people to, when and where. A group's meeting at a member's home, its temple or the
// square; a society's bread given at the granary; a collector going round those who pay to be left to trade; a street's gang
// keeping a corner with one set to watch; what the realm bars sold in a back lane at dusk; a head's house guarded; soldiers posted
// in the streets. Pure: the same plan and day give the same parts; nothing is here the plan's goings do not name, so a town with
// none shows none. The day itself (the walk there, the walk home) is laid by view/village.ts, which reads these.
import { GOING_ICON, type TownGoing, type VillagePlan } from "../bridge/index.ts";

export { GOING_ICON };
import { isGun } from "./arms.ts";
import { hashText, unitOf } from "./draws.ts";
import { beside, civicDoors, storeSpots } from "./errands.ts";
import { feastOn, feastPlace, marketDay, marketScene, squareScale } from "./feast.ts";
import type { Ground } from "./ground.ts";
import { streetDoor } from "./streets.ts";
import type { Carry } from "./work.ts";

const DAY = 86_400,
  HOUR = 3_600;

type Point = { x: number; z: number };

/** When each kind of thing is seen in a day (hours). */
export const LIFE_HOURS = {
  meeting: [18, 20],
  closed: [19, 21.25],
  alms: [11.5, 13.25],
  collect: [8.75, 12],
  corner: [15, 21],
  seller: [17.5, 21],
  guard: [7, 21],
  patrol: [8, 18],
  /** One lying low is at their own door these hours of a morning. */
  quiet: [9, 11.5],
  /** A head is seen at their door these hours; indoors the rest. */
  head: [
    [9.5, 12],
    [15, 18],
  ],
} as const;

/** How long a collector stands with each who pays, and one who buys with a seller (seconds). */
export const CALL_S = 12 * 60,
  BUY_S = 8 * 60;

/** A stay a going puts one of its people to: from when to when (seconds into the day), where, facing which way, at what. */
export type LifeStay = {
  readonly from: number;
  readonly to: number;
  /** Where they stand (metres from the town's middle); absent: where their own day has them (`own`), or beside another (`by`). */
  readonly at?: Point;
  readonly face?: number;
  /** Where they are as their own day has them: only what they say of it changes. */
  readonly own?: true;
  /**
   * Beside one of the town (their place among those drawn), wherever that one's own day has them then. With `own`: the one
   * who comes to them there; if that one does not come (held, away, called elsewhere), nothing is done to them.
   */
  readonly by?: number;
  readonly task: "talk" | "haggle" | "watch" | "drill" | "pray" | "load" | null;
  readonly carry: Carry | null;
  readonly why: string;
  /** Gone in behind closed doors: not seen. */
  readonly within?: true;
};

/** One's part in a going on a day: the going, whether they are of it or it is done to them, and their stays in order. */
export type LifePart = {
  readonly going: TownGoing;
  readonly of: boolean;
  readonly stays: readonly LifeStay[];
  /** Posted the whole day and the night (soldiers): their day is nothing else. */
  readonly whole?: true;
};

/** A going as a day has it: from when to when, and where its people are to be found. */
export type GoingOn = {
  readonly going: TownGoing;
  readonly from: number;
  readonly to: number;
  readonly at: Point;
  /** One of its people to go to (their place among those drawn; -1: none of them is drawn). */
  readonly find: number;
};

const toward = (a: Point, b: Point) => Math.atan2(b.x - a.x, b.z - a.z);

/** One of `n` by a key and which draw of it this is, well mixed (a key's plain hash falls alike for keys that end alike). */
const drawn = (key: string, k: number, n: number): number =>
  Math.min(n - 1, Math.floor(unitOf(hashText(key), k, 3) * n));

/** Before a home's door: on its street in a town, on the open ground toward the middle in a village. */
function beforeHome(plan: VillagePlan, h: number, along = 0, out = 0): Point & { face: number } {
  const home = plan.homes[h] ?? plan.homes[0] ?? { x: 0, z: 0, yaw: 0 };
  if (plan.town) {
    const d = streetDoor(home, along, undefined, plan.town?.lotSize),
      n = Math.hypot(d.x - home.x, d.z - home.z) || 1,
      p = { x: d.x + ((d.x - home.x) / n) * out, z: d.z + ((d.z - home.z) / n) * out };
    return { ...p, face: toward(p, home) };
  }
  const r = Math.hypot(home.x, home.z) || 1,
    // (Toward the middle, and along the ring about it.)
    p = {
      x: home.x - (home.x / r) * (8 + out) - (home.z / r) * along,
      z: home.z - (home.z / r) * (8 + out) + (home.x / r) * along,
    };
  return { ...p, face: toward(p, home) };
}

/** The day of the week a going is held on (0 … 6), from its own key. */
export const dayOfGoing = (g: TownGoing): number => drawn(g.key, 7, 7);

/** Whether a going is seen on a day: a meeting and a giving one day in seven, a collector on the market's days, the rest every day; none of them on a feast day. */
export function goingHeld(plan: VillagePlan, g: TownGoing, day: number): boolean {
  // (Those lying low do so every day the soldiers are there.)
  if (g.kind === "posted" || g.kind === "guard" || g.quiet) return true;
  if (feastOn(plan, day)) return false;
  if (g.every) return true;
  if (g.market) return marketDay(plan, day);
  if (g.kind === "meeting" || g.kind === "alms") return day % 7 === dayOfGoing(g);
  if (g.kind === "collect")
    return plan.market ? marketDay(plan, day) : day % 6 === drawn(g.key, 6, 6);
  return true;
}

/** A home by a going's key: one a share of the way out from the middle (0 the innermost, 1 the outermost), where none drawn lives if any is. */
function homeBy(plan: VillagePlan, key: string, lo: number, hi: number): number {
  const n = plan.homes.length;
  if (!n) return 0;
  const lived = new Set(plan.people.map((p) => p.home)),
    by = plan.homes
      .map((h, i) => ({ i, r: Math.hypot(h.x, h.z) }))
      .sort((a, b) => a.r - b.r || a.i - b.i),
    from = Math.floor(lo * (n - 1)),
    to = Math.max(from, Math.floor(hi * (n - 1))),
    seed = hashText(key);
  for (let k = 0; k < 12; k++) {
    const pick = by[from + Math.floor(unitOf(seed, k, 1) * (to - from + 1))]!;
    if (!lived.has(pick.i)) return pick.i;
  }
  return by[from + Math.floor(unitOf(seed, 0, 1) * (to - from + 1))]!.i;
}

/** Where a going is held (its middle), and where the `k`-th of `n` come to it stands, facing which way. */
function placeOf(
  plan: VillagePlan,
  g: TownGoing,
  day: number,
  ground: Ground,
  host: number,
): { at: Point; spot: (k: number, n: number) => Point & { face: number }; door?: Point } {
  const ring = (c: Point, rad: number) => (k: number, n: number) => {
    const a = (k / Math.max(3, n)) * 2 * Math.PI + drawn(g.key, 8, 628) / 100,
      p = { x: c.x + rad * Math.sin(a), z: c.z + rad * Math.cos(a) };
    return { ...p, face: toward(p, c) };
  };
  const t = day * DAY,
    home = (h: number) => {
      const door = beforeHome(plan, h);
      // In a town, along the house's front in two close rows, off the roadway its carts and cars keep to; on a village's open
      // ground, a ring.
      if (plan.town) {
        const c = beforeHome(plan, h, 0, 0.7);
        return {
          at: { x: c.x, z: c.z },
          spot: (k: number, n: number) => {
            const q = beforeHome(plan, h, (k - (n - 1) / 2) * 1.25, 0.1 + (k % 2) * 1.2);
            return { x: q.x, z: q.z, face: toward(q, c) };
          },
          door: { x: door.x, z: door.z },
        };
      }
      const c = beforeHome(plan, h, 0, 2.6);
      return { at: { x: c.x, z: c.z }, spot: ring(c, 2.1), door: { x: door.x, z: door.z } };
    };
  if (g.where === "temple") {
    const doors = plan.town ? civicDoors(plan, t) : null,
      d = doors?.get("temple")?.[0] ?? doors?.get("shrine")?.[0];
    if (d)
      return {
        at: beside(d, 2, 1.3, 3, 5),
        spot: (k) => ({ ...beside(d, k, 1.3, 2.4, 5), face: d.yaw }),
      };
  }
  if (g.where === "granary") {
    const d = storeSpots(plan, ground, t).granary;
    return {
      at: beside(d, 1, 1.6, 1.2, 3),
      spot: (k) => ({ ...beside(d, k, 1.6, 1.2, 3), face: d.yaw + Math.PI }),
    };
  }
  if (g.where === "market") {
    const fronts = marketScene(plan).fronts;
    if (fronts.length) {
      const f = fronts[drawn(g.key, 9, fronts.length)]!;
      return { at: { x: f.x, z: f.z }, spot: ring({ x: f.x * 0.72, z: f.z * 0.72 }, 2.2) };
    }
  }
  if (g.where === "square" || g.where === "temple" || g.where === "market") {
    const s = squareScale(plan),
      a = drawn(g.key, 10, 628) / 100,
      c = { x: 8.5 * s * Math.cos(a), z: 8.5 * s * Math.sin(a) };
    return { at: c, spot: ring(c, 2.6) };
  }
  if (g.where === "works" || g.where === "school") {
    // (Before the building itself where the town has raised one; else a house toward its edge, or among its homes.)
    const doors = plan.town ? civicDoors(plan, t) : null,
      works = g.where === "works";
    for (const kind of works ? WORKS_DOORS : SCHOOL_DOORS) {
      const d = doors?.get(kind)?.[0];
      if (d)
        return {
          at: beside(d, 2, 1.3, 3, 5),
          spot: (k) => ({ ...beside(d, k, 1.3, 2.4, 5), face: d.yaw }),
        };
    }
    return home(homeBy(plan, g.key, works ? 0.7 : 0.2, works ? 1 : 0.6));
  }
  if (g.where === "corner") return home(homeBy(plan, g.key, 0.3, 0.6));
  if (g.where === "lane") return home(homeBy(plan, g.key, 0.7, 1));
  if (g.where === "house") return home(homeBy(plan, g.key, 0.05, 0.35));
  // (A member's home: the first of them drawn; a home by its key where none is.)
  return home(host >= 0 ? plan.people[host]!.home : homeBy(plan, g.key, 0.2, 0.7));
}

/** The buildings a works' people and a school's gather before, the first the town has. */
const WORKS_DOORS = ["factory", "workshop", "mill", "smithy", "kiln"] as const,
  SCHOOL_DOORS = ["academy", "school"] as const;

type Laid = { readonly parts: ReadonlyMap<number, LifePart[]>; readonly on: readonly GoingOn[] };
const LAID = new WeakMap<VillagePlan, Map<number, Laid>>();
const NO_PARTS: readonly LifePart[] = [];

/** A day's goings laid: each one's parts by their place among those drawn, and what is on. */
function laidOn(plan: VillagePlan, day: number, ground: Ground): Laid {
  let kept = LAID.get(plan);
  if (!kept) LAID.set(plan, (kept = new Map()));
  const hit = kept.get(day);
  if (hit) return hit;
  const parts = new Map<number, LifePart[]>(),
    on: GoingOn[] = [],
    indexOf = new Map([
      ...plan.people.flatMap((p, i) => (p.figure ? [[p.figure, i] as const] : [])),
      ...plan.people.map((p, i) => [p.ref, i] as const),
    ]),
    add = (i: number, part: LifePart) => {
      const l = parts.get(i);
      if (l) l.push(part);
      else parts.set(i, [part]);
    };
  for (const g of plan.goings ?? []) {
    if (!goingHeld(plan, g, day)) continue;
    const drawn = (refs: readonly string[] | undefined) =>
        (refs ?? [])
          .map((ref) => indexOf.get(ref))
          .filter((i): i is number => i !== undefined && !plan.people[i]!.child),
      who = drawn(g.who),
      to = drawn(g.to);
    if (!who.length) continue;
    // Lying low: each at their own door of a morning, saying why; nothing of what they would be at.
    if (g.quiet) {
      who.forEach((i) => {
        const d = beforeHome(plan, plan.people[i]!.home, 1.5, 0.2);
        add(i, {
          going: g,
          of: true,
          stays: [
            {
              from: LIFE_HOURS.quiet[0] * HOUR,
              to: LIFE_HOURS.quiet[1] * HOUR,
              at: d,
              face: d.face + Math.PI,
              task: null,
              carry: null,
              why: g.quiet!,
            },
          ],
        });
      });
      continue;
    }
    const place = placeOf(plan, g, day, ground, who[0]!),
      seed = hashText(`${g.key}|${day}`),
      late = (i: number, most: number) => unitOf(seed, i, 2) * most * HOUR;
    let from = 0,
      until = DAY;
    if (g.kind === "meeting") {
      const [a, b] = g.hours ?? (g.closed ? LIFE_HOURS.closed : LIFE_HOURS.meeting);
      from = a * HOUR;
      until = b * HOUR;
      const muster = /muster/.test(g.doing),
        // (At a works its hands carry what they make in and out; on strike they stand at its gate.)
        labour = g.where === "works" && !/strike/.test(g.doing);
      who.forEach((i, k) => {
        const s = place.spot(k, who.length),
          come = from + late(i, 0.3);
        add(i, {
          going: g,
          of: true,
          stays: g.closed
            ? [
                {
                  from: come,
                  to: until,
                  at: place.door ?? place.at,
                  task: null,
                  carry: null,
                  why: k === 0 ? (g.lead ?? g.doing) : g.doing,
                  within: true,
                },
              ]
            : [
                {
                  from: come,
                  to: until,
                  at: s,
                  face: s.face,
                  task: muster
                    ? "drill"
                    : g.where === "temple"
                      ? "pray"
                      : labour && k > 0
                        ? "load"
                        : "talk",
                  carry: muster ? "spear" : labour && k > 0 ? "sack" : null,
                  // (Who leads it says so: a meeting's head, a ruler holding court.)
                  why: k === 0 ? (g.lead ?? g.doing) : g.doing,
                },
              ],
        });
      });
    } else if (g.kind === "alms") {
      from = LIFE_HOURS.alms[0] * HOUR;
      until = LIFE_HOURS.alms[1] * HOUR;
      who.forEach((i, k) => {
        const s = place.spot(k, who.length);
        add(i, {
          going: g,
          of: true,
          stays: [
            { from, to: until, at: s, face: s.face, task: "load", carry: "sack", why: g.doing },
          ],
        });
      });
      to.forEach((i, k) => {
        // (Each in turn before those who give, a step out from them, and home with it.)
        const giver = place.spot(k % who.length, who.length),
          c = Math.sin(giver.face),
          s = Math.cos(giver.face),
          at = { x: giver.x + c * 1.7, z: giver.z + s * 1.7 },
          come = from + (0.2 + (k / Math.max(1, to.length)) * 1.1) * HOUR;
        add(i, {
          going: g,
          of: false,
          stays: [
            {
              from: come,
              to: come + 0.3 * HOUR,
              at,
              face: giver.face + Math.PI,
              task: "haggle",
              carry: null,
              why: g.toDoing ?? g.doing,
            },
          ],
        });
      });
    } else if (g.kind === "collect") {
      from = LIFE_HOURS.collect[0] * HOUR;
      until = LIFE_HOURS.collect[1] * HOUR;
      // (Each collector their share of those who pay, one after another through the morning.)
      who.forEach((i, c) => {
        const mine = to.filter((_, k) => k % who.length === c),
          gap = Math.min(0.5 * HOUR, (until - from) / Math.max(1, mine.length)),
          stays: LifeStay[] = [];
        mine.forEach((j, k) => {
          const at = from + k * gap;
          stays.push({
            from: at,
            to: at + CALL_S,
            by: j,
            task: "haggle",
            carry: "sack",
            why: g.doing,
          });
          add(j, {
            going: g,
            of: false,
            stays: [
              {
                from: at,
                to: at + CALL_S,
                own: true,
                by: i,
                task: null,
                carry: null,
                why: g.toDoing ?? g.doing,
              },
            ],
          });
        });
        // And then to the house of the one they collect for, where it stands in this town and is guarded.
        const house = (plan.goings ?? []).find(
          (x) => x.kind === "guard" && x.of.ref === g.of.ref.replace(/^mob:/, "boss:"),
        );
        if (stays.length && house) {
          const theirs = (house.to ?? [])
              .map((ref) => indexOf.get(ref))
              .find((x) => x !== undefined),
            d = beforeHome(
              plan,
              theirs !== undefined
                ? plan.people[theirs]!.home
                : homeBy(plan, house.key, 0.05, 0.35),
              0,
              1.4,
            ),
            at = stays[stays.length - 1]!.to + 0.35 * HOUR;
          stays.push({
            from: at,
            to: at + 0.4 * HOUR,
            at: d,
            face: d.face,
            task: null,
            carry: "sack",
            why: `Bringing what was collected to the house of ${house.of.name}`,
          });
        }
        if (stays.length) add(i, { going: g, of: true, stays });
      });
    } else if (g.kind === "corner") {
      from = LIFE_HOURS.corner[0] * HOUR;
      until = LIFE_HOURS.corner[1] * HOUR;
      const watch = beforeHome(plan, homeBy(plan, g.key, 0.3, 0.6), 11, 0.4);
      who.forEach((i, k) => {
        const come = from + late(i, 0.5);
        if (k === 0 && who.length >= 3) {
          // (One set apart down the street, looking out along it.)
          add(i, {
            going: g,
            of: true,
            stays: [
              {
                from: come,
                to: until,
                at: watch,
                face: toward(place.at, watch),
                task: "watch",
                carry: null,
                why: g.watch ?? g.doing,
              },
            ],
          });
          return;
        }
        const s = place.spot(k, who.length);
        add(i, {
          going: g,
          of: true,
          stays: [
            { from: come, to: until, at: s, face: s.face, task: "talk", carry: null, why: g.doing },
          ],
        });
      });
    } else if (g.kind === "seller") {
      from = LIFE_HOURS.seller[0] * HOUR;
      until = LIFE_HOURS.seller[1] * HOUR;
      who.forEach((i, k) => {
        const s = place.spot(k * 2, 4);
        add(i, {
          going: g,
          of: true,
          stays: [
            {
              from,
              to: until,
              at: s,
              face: s.face + Math.PI,
              task: null,
              carry: "pack",
              why: g.doing,
            },
          ],
        });
      });
      to.forEach((i, k) => {
        const s = place.spot(1 + k * 2, 4),
          come = from + (0.6 + k * 1.2 + unitOf(seed, i, 5) * 0.4) * HOUR;
        add(i, {
          going: g,
          of: false,
          stays: [
            {
              from: come,
              to: come + BUY_S,
              at: s,
              face: s.face,
              task: "haggle",
              carry: null,
              why: g.toDoing ?? g.doing,
            },
          ],
        });
      });
    } else if (g.kind === "patrol") {
      // A round of the square's four sides, side by side, an hour at each.
      from = LIFE_HOURS.patrol[0] * HOUR;
      until = LIFE_HOURS.patrol[1] * HOUR;
      const sc = squareScale(plan),
        fronts = marketScene(plan).fronts;
      who.forEach((i, k) => {
        const stays: LifeStay[] = [];
        for (let w = 0; from + w * HOUR < until; w++) {
          const a = ((w + ((hashText(g.key) >>> 5) % 4)) % 4) * (Math.PI / 2) + 0.6,
            at = {
              x: 19 * sc * Math.cos(a) + (k ? 1.5 : 0),
              z: 19 * sc * Math.sin(a) + (k ? 1.1 : 0),
            };
          // (At noon they eat as anyone does: no post then.)
          if (w === 4) continue;
          // (Mid-morning, where the crew is paid: before one of the market's stalls, the same one day on day.)
          const paid =
            w === 2 && g.toDoing ? fronts[(hashText(g.key) >>> 7) % fronts.length] : undefined;
          stays.push({
            from: from + w * HOUR,
            to: from + (w + 1) * HOUR,
            at: paid ? { x: paid.x + (k ? 1.4 : 0), z: paid.z + (k ? 1.0 : 0) } : at,
            face: paid ? paid.yaw : toward(at, { x: 0, z: 0 }),
            task: paid ? "haggle" : "watch",
            carry: null,
            why: paid ? g.toDoing! : g.doing,
          });
        }
        add(i, { going: g, of: true, stays });
      });
    } else if (g.kind === "guard") {
      from = LIFE_HOURS.guard[0] * HOUR;
      until = LIFE_HOURS.guard[1] * HOUR;
      // (The house is its head's own, where the head is one of those drawn; a house by its key where not.)
      const head = (g.to ?? []).map((ref) => indexOf.get(ref)).find((i) => i !== undefined),
        h = head !== undefined ? plan.people[head]!.home : homeBy(plan, g.key, 0.05, 0.35);
      // (Its head, before the door through the day, the guards either side; indoors by night as their own day has them.)
      // (On a market day the head goes out to the market mid-morning, one of the guards with them: the rest keep the door.)
      const fronts = plan.market && marketDay(plan, day) ? marketScene(plan).fronts : [],
        stall =
          head !== undefined && fronts.length
            ? fronts[(hashText(g.key) >>> 9) % fronts.length]
            : undefined,
        out = [10 * HOUR, 11.5 * HOUR] as const,
        through = (
          door: Point & { face: number },
          away: (Point & { face: number }) | undefined,
          task: LifeStay["task"],
          why: string,
          abroad: string,
        ): LifeStay[] =>
          away
            ? [
                { from, to: out[0], at: door, face: door.face + Math.PI, task, carry: null, why },
                {
                  from: out[0],
                  to: out[1],
                  at: away,
                  face: away.face,
                  task,
                  carry: null,
                  why: abroad,
                },
                {
                  from: out[1],
                  to: until,
                  at: door,
                  face: door.face + Math.PI,
                  task,
                  carry: null,
                  why,
                },
              ]
            : [{ from, to: until, at: door, face: door.face + Math.PI, task, carry: null, why }];
      if (head !== undefined) {
        const d = beforeHome(plan, h, 0, 0.9);
        add(head, {
          going: g,
          of: false,
          stays: through(
            d,
            stall ? { x: stall.x, z: stall.z, face: stall.yaw } : undefined,
            "talk",
            g.toDoing ?? g.doing,
            "At the market, a guard beside them",
          ),
        });
      }
      who.forEach((i, k) => {
        const s = beforeHome(plan, h, (k - (who.length - 1) / 2) * 3.2, 0.3);
        add(i, {
          going: g,
          of: true,
          // (Their back to the door, looking out along the street.)
          stays: through(
            s,
            k === 0 && stall ? { x: stall.x + 1.6, z: stall.z + 1.2, face: stall.yaw } : undefined,
            "watch",
            g.doing,
            `${g.doing}: out at the market beside them`,
          ),
        });
      });
    } else {
      // Posted: in twos at the ways into the square, clear of its stalls, changing places through the day and the night.
      const sc = squareScale(plan),
        road = Math.hypot(plan.road.x, plan.road.z) || 1,
        posts: Point[] = [
          { x: (plan.road.x / road) * 34 * sc, z: (plan.road.z / road) * 34 * sc },
          { x: (-plan.road.z / road) * 32 * sc, z: (plan.road.x / road) * 32 * sc },
          { x: (-plan.road.x / road) * 34 * sc, z: (-plan.road.z / road) * 34 * sc },
          { x: (plan.road.z / road) * 32 * sc, z: (-plan.road.x / road) * 32 * sc },
        ],
        WATCH = 3 * HOUR;
      who.forEach((i, k) => {
        const stays: LifeStay[] = [];
        for (let w = 0; w * WATCH < DAY; w++) {
          const post = posts[(Math.floor(k / 2) + w) % posts.length]!,
            r = Math.hypot(post.x, post.z) || 1,
            // (Two to a post, a few steps apart across the way.)
            side = (k % 2 ? 1 : -1) * 1.6,
            at = { x: post.x - (post.z / r) * side, z: post.z + (post.x / r) * side };
          stays.push({
            from: w * WATCH,
            to: Math.min(DAY, (w + 1) * WATCH),
            at,
            face: toward({ x: 0, z: 0 }, at),
            task: "watch",
            // (What their realm's host is fielded with: a gun shouldered, a spear upright; another arm is told, not drawn.)
            carry: isGun(plan.posted?.arm) ? "gun" : plan.posted?.arm === "spear" ? "spear" : null,
            why: g.doing,
          });
        }
        add(i, { going: g, of: true, stays, whole: true });
      });
    }
    // (The one to go to: of a corner, one of the knot, the one on watch standing apart from it.)
    on.push({
      going: g,
      from,
      to: until,
      at: place.at,
      find: g.kind === "corner" && who.length >= 3 ? who[1]! : who[0]!,
    });
  }
  // A feast day: those of standing in the town (its key figures) are at its tables with it of an evening.
  const feast = feastOn(plan, day);
  if (feast) {
    const going: TownGoing = {
      kind: "meeting",
      key: `feast|${day}`,
      of: { ref: feast.ref ?? plan.ref, name: feast.words },
      words: feast.words,
      doing: "At the feast: at the tables",
      why: "",
      who: [],
      where: "square",
    };
    plan.people.forEach((p, i) => {
      if (!p.figure) return;
      const at = feastPlace(plan, false, unitOf(hashText(p.ref), 0, 6));
      add(i, {
        going,
        of: false,
        stays: [
          {
            from: 17 * HOUR,
            to: 21 * HOUR,
            at: { x: at.x, z: at.z },
            face: at.yaw,
            task: "talk",
            carry: null,
            why: going.doing,
          },
        ],
      });
    });
  }
  if (kept.size > 40) kept.clear();
  const laid = { parts, on };
  kept.set(day, laid);
  return laid;
}

/**
 * Where a going is, held that day or not: its middle, the door of the house it is at where it is at one, and for a corner kept
 * where the one set apart to look out stands. For one who plays a part in it by the hand (view/lived.ts): the same places its
 * own people are seen at.
 */
export function goingPlace(
  plan: VillagePlan,
  g: TownGoing,
  day: number,
  ground: Ground,
): {
  readonly at: Point;
  readonly door: Point | null;
  readonly watch: (Point & { face: number }) | null;
} {
  const index = new Map(plan.people.map((p, i) => [p.ref, i] as const)),
    host = g.who.map((r) => index.get(r) ?? -1).find((i) => i >= 0) ?? -1,
    place = placeOf(plan, g, day, ground, host);
  if (g.kind !== "corner") return { at: place.at, door: place.door ?? null, watch: null };
  const w = beforeHome(plan, homeBy(plan, g.key, 0.3, 0.6), 11, 0.4);
  return {
    at: place.at,
    door: place.door ?? null,
    watch: { x: w.x, z: w.z, face: toward(place.at, w) },
  };
}

/** One's parts in a day's goings, in the order the plan has its goings (none: nothing asks them). */
export function lifeParts(
  plan: VillagePlan,
  index: number,
  day: number,
  ground: Ground,
): readonly LifePart[] {
  if (!plan.goings?.length) return NO_PARTS;
  return laidOn(plan, day, ground).parts.get(index) ?? NO_PARTS;
}

/** What is on in a town on a day: each going held, when, where, and one of its people to go to. */
export function goingsOn(plan: VillagePlan, day: number, ground: Ground): readonly GoingOn[] {
  if (!plan.goings?.length) return [];
  return laidOn(plan, day, ground).on;
}

/** What is on at a moment (world seconds), the soonest to end first. */
export function goingsNow(plan: VillagePlan, t: number, ground: Ground): readonly GoingOn[] {
  const day = Math.floor(t / DAY),
    s = t - day * DAY;
  return goingsOn(plan, day, ground)
    .filter((g) => s >= g.from && s < g.to)
    .sort((a, b) => a.to - b.to);
}
