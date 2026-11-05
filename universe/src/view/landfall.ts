// A landing on a world of natives, as a script of the film's time (Phase 70, first slice): landers down on the natives'
// own ground, those who came out and into their order, the natives coming on from their camp or town, the fire between
// them, who falls where, and how it ends. A pure function of the plan (history's numbers, rules/landfall.ts) and the
// time, so it reads the same every time and nothing builds up. Metres, as a village's plan uses them. Their order comes
// from the foe's fire (view/order.ts), with one thing the town's war need not say: a people who have never faced a gun
// have no drill for it. They come on as they would against anyone, in a mass, and that is what is seen.
import type { LandfallPlan } from "../bridge/index.ts";
import { armFire, commandOf, hostOrder, orderFrom, orderPlaces } from "./order.ts";

type Flat = { readonly x: number; readonly z: number };

/** Where it is fought: the natives' edge, the way from it toward those who came, what may burn. */
export type LandfallGround = {
  readonly kind: "camp" | "town";
  readonly edge: Flat;
  readonly way: Flat;
  /** What stands to burn, where a camp is shown (a town's burns from its roofs). */
  readonly huts: readonly Flat[];
  /**
   * A camp's ground is a board of 140 by 90 m with figures drawn ten times larger than it (view/figure.ts): the most the
   * fight can spread on it (m). A town's ground has no such edge.
   */
  readonly most?: { readonly gap: number; readonly across: number; readonly deep: number };
};

export type LandfallStage = "down" | "out" | "come" | "hand" | "after" | "end";
export type LandfallFigure = {
  readonly i: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly size: number;
  readonly doing: "out" | "stand" | "run" | "strike" | "fallen" | "flee" | "back";
};
export type LandfallLander = {
  readonly j: number;
  readonly x: number;
  readonly z: number;
  readonly high: number;
  readonly burn: number;
  readonly ramp: number;
  readonly yaw: number;
};
export type LandfallBolt = {
  readonly side: 0 | 1;
  readonly ax: number;
  readonly ay: number;
  readonly az: number;
  readonly bx: number;
  readonly by: number;
  readonly bz: number;
};
export type LandfallNow = {
  readonly t: number;
  readonly stage: LandfallStage;
  readonly comers: readonly LandfallFigure[];
  readonly natives: readonly LandfallFigure[];
  readonly landers: readonly LandfallLander[];
  readonly bolts: readonly LandfallBolt[];
  /** Stones in the air: where, in metres. */
  readonly stones: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  /** What burns on a camp's ground, each at its size (0 … 1). */
  readonly fires: readonly { readonly x: number; readonly z: number; readonly size: number }[];
  /** How many of each still stand (as drawn). */
  readonly left: readonly [number, number];
};

/** The film's times (seconds), by what this landing's numbers make of it. */
export type LandfallTimes = {
  readonly land: number;
  readonly out: number;
  readonly come: number;
  /** When those who came on would reach the hand, or break; the fight's end; when it is told. */
  readonly reach: number;
  readonly rout: number;
  readonly end: number;
};

type Comer = {
  readonly i: number;
  readonly pad: Flat;
  readonly place: Flat;
  readonly made: boolean;
  readonly u: number;
  readonly fallAt: number;
};
type Native = {
  readonly i: number;
  readonly start: Flat;
  readonly from: Flat;
  readonly u: number;
  readonly fallAt: number;
  readonly pace: number;
};

export type LandfallScript = {
  readonly plan: LandfallPlan;
  readonly ground: LandfallGround;
  readonly times: LandfallTimes;
  readonly gap: number;
  readonly front: Flat;
  readonly across: Flat;
  readonly comers: readonly Comer[];
  readonly natives: readonly Native[];
  readonly pads: readonly Flat[];
  /** How far apart the natives' mass stands (m), and each host's drawn body's width. */
  readonly pitch: number;
  readonly room: readonly [number, number];
  /** Whether each host's order is shoulder to shoulder, and how far apart each stands (m). */
  readonly order: readonly [{ line: boolean; spacing: number }, { line: boolean; spacing: number }];
};

export type LandfallEye = {
  readonly e: { x: number; y: number; z: number };
  readonly at: { x: number; y: number; z: number };
};

const unit = (a: number, b: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const hashText = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
};
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const smooth = (k: number) => {
  const c = clamp01(k);
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const at = (o: Flat, w: Flat, a: Flat, along: number, side: number): Flat => ({
  x: o.x + w.x * along + a.x * side,
  z: o.z + w.z * along + a.z * side,
});

/** How many of each a detail level draws (0 … 3). */
export function landfallMost(detail: number): readonly [number, number] {
  const d = Math.max(0, Math.min(3, Math.round(detail) || 0));
  return [[24, 28, 36, 48][d]!, [40, 48, 72, 96][d]!];
}

/** How many of each are drawn: as many as there are, up to the most; the fewer at no less than a quarter of the more. */
export function drawnOf(
  fielded: readonly [number, number],
  most: readonly [number, number],
): readonly [number, number] {
  let c = Math.min(most[0], Math.max(1, Math.round(fielded[0]))),
    n = Math.min(most[1], Math.max(1, Math.round(fielded[1])));
  c = Math.min(Math.max(1, Math.round(fielded[0])), Math.max(c, Math.ceil(n / 4)));
  n = Math.min(Math.max(1, Math.round(fielded[1])), Math.max(n, Math.ceil(c / 4)));
  return [c, n];
}

/** The hand's clock, as the film's: from the fight's first moment to its last. */
function handClock(plan: LandfallPlan, reach: number): (at: number) => number {
  const first = plan.frames[0]?.at ?? 16,
    last = Math.max(first + 1, plan.frames[plan.frames.length - 1]?.at ?? first + 1);
  return (a) => reach + clamp01((a - first) / (last - first)) * HAND_LONG;
}
/** How long the hand's fight runs on the screen (s). */
const HAND_LONG = 16;

/** When a share of a host has fallen, along the fight's frames (film seconds), or null if never. */
function whenShare(
  plan: LandfallPlan,
  side: 0 | 1,
  from: number,
  share: number,
  clock: (at: number) => number,
  per: number,
): number | null {
  let was = plan.frames[0]?.at ?? 16;
  for (const f of plan.frames) {
    if (per * (f.dead[side] - from) >= share) return clock(Math.max(was, f.at));
    was = f.at;
  }
  return null;
}

/** The script of one landing on this ground: everyone's place and when they fall. */
export function landfallScript(
  plan: LandfallPlan,
  ground: LandfallGround,
  most: readonly [number, number],
  /** Each host's drawn body's width (m), that none stands in another. */
  room: readonly [number, number],
): LandfallScript {
  const seed = hashText(plan.id),
    [dc, dn] = drawnOf(plan.fielded, most),
    way = ground.way,
    across = { x: -way.z, z: way.x },
    // How far from the fire they are when it opens, as far as a screen holds.
    off = plan.off > 0 ? plan.off : 30,
    gap0 = plan.nativeOff > 0 ? Math.min(off, plan.nativeOff) : Math.max(40, off),
    gap = Math.min(gap0, ground.most?.gap ?? Infinity),
    front = at(ground.edge, way, across, gap, 0),
    own = { arm: plan.arm, mount: plan.mount },
    foe = { arm: plan.nativeArm, mount: "foot" },
    orderC = hostOrder(own, foe),
    // (A people who have never faced a gun drill for what they have met: their own fire.)
    fireN = armFire(plan.nativeArm),
    orderN =
      plan.nativeOff > 0
        ? hostOrder(foe, own)
        : orderFrom({ foe: fireN, own: fireN, command: commandOf(plan.nativeArm) }),
    // (Their ground here is no more than a screen's: the law's spacing, up to what can be seen.)
    deep = ground.most ? ground.most.deep : Math.min(100, Math.max(40, gap * 0.5)),
    places = orderPlaces(
      { ...orderC, area: Math.min(orderC.area, 26_000 / Math.max(1, dc)) },
      dc,
      undefined,
      seed & 0xffff,
      deep,
    ),
    widest = Math.max(1, ...places.map((p) => Math.abs(p.across))),
    deepest = Math.max(1, ...places.map((p) => p.depth)),
    // (The law's order, as far as its ground holds: squads apart still, closer than the law would have them.)
    squeeze = Math.min(1, (ground.most?.across ?? Infinity) / widest),
    squeezeDeep = Math.min(1, (ground.most?.deep ?? Infinity) / deepest),
    landers = Math.max(1, Math.min(4, Math.ceil((plan.flesh + plan.made) / 500))),
    pads = Array.from({ length: landers }, (_, j) =>
      at(
        front,
        way,
        across,
        deep + (ground.most ? 13 : 46),
        (j - (landers - 1) / 2) * (ground.most ? 24 : 62),
      ),
    ),
    // The times.
    land = 6,
    out = 11,
    come = 12.5,
    run = Math.max(1.5, 4 / Math.sqrt(Math.max(0.3, plan.gravity))),
    under = plan.nativeOff > 0 ? 0 : gap / run,
    // (A film's crossing: a fifth of a run's time, and long enough to see.)
    crossing = under > 0 ? Math.max(7, Math.min(13, under * 0.28)) : 0,
    broke = plan.how === "broke crossing",
    /** How far along their way they break: how soon the fire comes to the share they bear. */
    brokeAt = broke ? Math.max(0.55, Math.min(0.9, plan.brokeShare)) : 1,
    reach = come + crossing * (broke ? brokeAt : 1),
    clock = handClock(plan, reach),
    rout = broke ? reach + 1.5 : plan.rout !== null ? clock(plan.rout) : reach + HAND_LONG,
    end = rout + (plan.won ? 11 : 12),
    times: LandfallTimes = { land, out, come, reach, rout, end },
    // Who falls when: the struck on the way first, by each one's keyed place in it; the rest by the fight's clock.
    shareCross = plan.fielded[1] > 0 ? plan.crossed / plan.fielded[1] : 0,
    deadBefore = Math.round(plan.crossed * plan.killedShare),
    arrive = Math.max(1, plan.fielded[1] - plan.crossed),
    perN = 1 / Math.max(0.05, plan.killedShare) / arrive,
    perC = 1 / Math.max(0.05, plan.comerKilledShare) / Math.max(1, plan.fielded[0]),
    comers: Comer[] = [],
    natives: Native[] = [],
    fallShareC = Math.min(1, perC * plan.dead[0]),
    // (Any who fell is a figure seen to fall: figures stand for many.)
    fallC = plan.dead[0] > 0 ? Math.max(1 / dc, fallShareC) : 0,
    madeShare = plan.flesh + plan.made > 0 ? plan.made / (plan.flesh + plan.made) : 0,
    madeN = Math.round(dc * madeShare);
  for (let i = 0; i < dc; i++) {
    const p = places[i]!,
      u = unit(seed, 100 + i),
      when = u < fallC ? whenShare(plan, 0, 0, u, clock, perC) : null;
    comers.push({
      i,
      pad: pads[i % landers]!,
      place: at(front, way, across, p.depth * squeezeDeep, p.across * squeeze),
      made: i < madeN,
      u,
      fallAt: when ?? (u < fallC ? rout : Infinity),
    });
  }
  // The natives' mass: as close as their order stands and their bodies let them, a broad front, deep behind it.
  const pitch = Math.max(orderN.spacing, room[1]),
    placesN =
      plan.nativeOff > 0
        ? orderPlaces(
            { ...orderN, area: Math.min(orderN.area, 26_000 / Math.max(1, dn)) },
            dn,
            undefined,
            (seed >> 8) & 0xffff,
            deep,
          )
        : null,
    cols = Math.max(
      3,
      Math.min(
        ground.most ? Math.floor((2 * ground.most.across) / pitch) : 14,
        Math.ceil(Math.sqrt(dn * 2.2)),
      ),
    );
  for (let i = 0; i < dn; i++) {
    const row = Math.floor(i / cols),
      col = i % cols,
      inRow = Math.min(cols, dn - row * cols),
      j1 = unit(seed, 300 + i) - 0.5,
      j2 = unit(seed, 400 + i) - 0.5,
      u = unit(seed, 500 + i),
      p = placesN?.[i],
      start = p
        ? at(ground.edge, way, across, -p.depth, p.across)
        : at(
            ground.edge,
            way,
            across,
            -row * pitch * 0.92 + j2 * pitch * 0.35,
            (col - (inRow - 1) / 2) * pitch + j1 * pitch * 0.35,
          ),
      // (From about their fire, or out of their doors, to where they mass.)
      a = i * 2.399963,
      from = at(ground.edge, way, across, -28 - 14 * unit(seed, 600 + i), Math.cos(a) * 34);
    let fallAt = Infinity;
    if (u < shareCross) {
      const k = u / Math.max(1e-6, shareCross),
        span = broke ? 2 * (reach - come) : crossing;
      fallAt = come + 0.5 + k * Math.max(1, span - 0.5);
    } else {
      const r = (u - shareCross) / Math.max(1e-6, 1 - shareCross),
        when = !broke ? whenShare(plan, 1, deadBefore, r, clock, perN) : null;
      if (when !== null) fallAt = when;
    }
    natives.push({ i, start, from, u, fallAt, pace: 0.88 + 0.24 * unit(seed, 700 + i) });
  }
  return {
    plan,
    ground,
    times,
    gap,
    front,
    across,
    comers,
    natives,
    pads,
    pitch,
    room,
    order: [
      { line: orderC.line, spacing: orderC.spacing },
      { line: orderN.line, spacing: pitch },
    ],
  };
}

/** The stage at a time. */
export function landfallStage(s: LandfallScript, t: number): LandfallStage {
  const T = s.times;
  if (t < T.land) return "down";
  if (t < T.come) return "out";
  if (t < T.reach) return "come";
  if (t < T.rout) return "hand";
  return t < T.end ? "after" : "end";
}

/** Everything drawn at a time. */
export function landfallAt(s: LandfallScript, time: number): LandfallNow {
  const T = s.times,
    t = Math.max(0, Math.min(T.end, time)),
    plan = s.plan,
    way = s.ground.way,
    seed = hashText(plan.id),
    won = plan.won,
    faceN = Math.atan2(way.x, way.z),
    faceC = Math.atan2(-way.x, -way.z),
    lifting = won ? Infinity : T.rout + 7,
    landers: LandfallLander[] = s.pads.map((p, j) => {
      const land = T.land - (s.pads.length - 1 - j) * 0.4,
        k = clamp01(t / land);
      let high = t < land ? 160 * (1 - k) * (1 - k) : 0,
        burn = t < land ? 1 : Math.max(0, 1 - (t - land));
      const lift = lifting + j * 0.6;
      if (t > lift) {
        const r = t - lift;
        high = 3 * r * r;
        burn = 1;
      }
      return {
        j,
        x: p.x,
        z: p.z,
        high,
        burn,
        ramp: smooth((t - T.land) / 1.2) * (1 - smooth((t - (lifting - 2)) / 1.5)),
        yaw: unit(seed, 600 + j) * 6.283,
      };
    });
  const hand = plan.nativeOff > 0 ? 0 : s.gap - 4,
    reachAll =
      plan.how === "broke crossing"
        ? (T.reach - T.come) / Math.max(0.55, Math.min(0.9, plan.brokeShare))
        : T.reach - T.come,
    // How far they have come on by a time.
    along = (n: Native, x: number) =>
      plan.nativeOff > 0
        ? 0
        : Math.min(hand, hand * clamp01(((x - T.come) / Math.max(1, reachAll)) * n.pace));
  /**
   * At the hand: pressed toward one of those who came, no further than the room between them. Many more
   * come on than stand there, and a mass that closed on their places would stand in itself.
   */
  const pressed = (n: LandfallScript["natives"][number], x: number, z: number, k: number) => {
    const c = s.comers[n.i % s.comers.length]!,
      dx = c.place.x - x,
      dz = c.place.z - z,
      l = Math.hypot(dx, dz) || 1,
      by = Math.min(l, s.pitch * 0.8) * k;
    return { x: x + (dx / l) * by, z: z + (dz / l) * by };
  };
  const atHand = (x: number) => smooth((x - T.reach) / 3);
  // Those who came: out of their ramps to their places; down, and firing; back, or on over the ground.
  const comers: LandfallFigure[] = s.comers.map((c) => {
    const emerge = T.land + 0.6 + (c.i % 12) * 0.2,
      settle = emerge + 3.6;
    if (t < emerge)
      return { i: c.i, x: c.pad.x, z: c.pad.z, yaw: faceC, size: 0, doing: "out" as const };
    if (t >= c.fallAt) {
      const k = clamp01((c.fallAt - emerge) / (settle - emerge)),
        px = lerp(c.pad.x, c.place.x, k),
        pz = lerp(c.pad.z, c.place.z, k);
      return { i: c.i, x: px, z: pz, yaw: faceC, size: 1, doing: "fallen" as const };
    }
    if (t < settle) {
      const k = smooth((t - emerge) / (settle - emerge));
      return {
        i: c.i,
        x: lerp(c.pad.x, c.place.x, k),
        z: lerp(c.pad.z, c.place.z, k),
        yaw: faceC,
        size: 1,
        doing: "out" as const,
      };
    }
    if (t < T.rout)
      return { i: c.i, x: c.place.x, z: c.place.z, yaw: faceC, size: 1, doing: "stand" as const };
    if (won) {
      // On over the ground they have won, as far as their edge.
      const k = smooth((t - T.rout - 0.5 - c.u) / 7),
        d = s.gap * 0.72 * k;
      return {
        i: c.i,
        x: c.place.x - way.x * d,
        z: c.place.z - way.z * d,
        yaw: faceC,
        size: 1,
        doing: k > 0 && k < 1 ? ("out" as const) : ("stand" as const),
      };
    }
    // Back aboard, and gone.
    const k = smooth((t - T.rout) / 5.5);
    return {
      i: c.i,
      x: lerp(c.place.x, c.pad.x, k),
      z: lerp(c.place.z, c.pad.z, k),
      yaw: faceN,
      size: k >= 1 ? 0 : 1,
      doing: "back" as const,
    };
  });
  const standing = comers.filter((c) => c.size > 0 && c.doing !== "fallen");
  // Those who met them.
  const natives: LandfallFigure[] = s.natives.map((n) => {
    if (t < T.come) {
      const k = smooth((t - 0.5 - 2 * n.u) / 6);
      return {
        i: n.i,
        x: lerp(n.from.x, n.start.x, k),
        z: lerp(n.from.z, n.start.z, k),
        yaw: faceN,
        size: 1,
        doing: k > 0 && k < 1 ? ("run" as const) : ("stand" as const),
      };
    }
    const fell = t >= n.fallAt,
      d = fell ? along(n, Math.min(n.fallAt, T.reach)) : along(n, Math.min(t, T.reach));
    const fleeing = (won && t >= T.reach && plan.how === "broke crossing") || (won && t >= T.rout);
    if (fleeing) {
      // Back past where they came from, and out of sight.
      const from = plan.how === "broke crossing" ? T.reach : T.rout,
        at0 = along(n, from),
        speed = (s.ground.most ? 9 : 22) * n.pace,
        back = (t - from) * speed,
        dd = fell ? at0 - Math.min(back, (n.fallAt - from) * speed) : at0 - back;
      // (Those who were at the hand fall back out of it.)
      const q = pressed(
        n,
        n.start.x + way.x * dd,
        n.start.z + way.z * dd,
        plan.how === "broke crossing" ? 0 : fell ? atHand(n.fallAt) : 1 - smooth((t - from) / 1.2),
      );
      if (fell) return { i: n.i, x: q.x, z: q.z, yaw: faceC, size: 1, doing: "fallen" as const };
      return {
        i: n.i,
        x: q.x,
        z: q.z,
        yaw: faceC,
        size: t > from + (s.ground.most ? 6 : 9) ? 0 : 1,
        doing: "flee" as const,
      };
    }
    const x = n.start.x + way.x * d,
      z = n.start.z + way.z * d;
    if (fell) {
      const q = pressed(n, x, z, plan.nativeOff > 0 ? 0 : atHand(n.fallAt));
      return { i: n.i, x: q.x, z: q.z, yaw: faceN, size: 1, doing: "fallen" as const };
    }
    if (plan.nativeOff > 0) return { i: n.i, x, z, yaw: faceN, size: 1, doing: "stand" as const };
    if (t < T.reach) return { i: n.i, x, z, yaw: faceN, size: 1, doing: "run" as const };
    if (t < T.rout) {
      // At the hand: in among those who came.
      const q = pressed(n, x, z, atHand(t));
      return { i: n.i, x: q.x, z: q.z, yaw: faceN, size: 1, doing: "strike" as const };
    }
    // They hold the ground, and stand on it.
    const q = pressed(n, x, z, 1);
    return { i: n.i, x: q.x, z: q.z, yaw: faceN, size: 1, doing: "stand" as const };
  });
  const up = natives.filter((n) => n.size > 0 && n.doing !== "fallen" && n.doing !== "flee");
  const fleeing = natives.filter((n) => n.doing === "flee");
  // The fire: from those who stand at those who come on, then at those who run.
  const bolts: LandfallBolt[] = [],
    stones: { x: number; y: number; z: number }[] = [];
  const firing = t >= T.come && t < (won ? T.rout + 3.5 : T.rout);
  if (firing && plan.fire[0].rate > 0) {
    const targets = up.length ? up : fleeing;
    let shots = 0;
    for (const c of comers) {
      if (shots >= 28 || !targets.length) break;
      if (c.doing !== "stand") continue;
      const u = unit(seed, 1100 + c.i);
      if (Math.floor(t * 7 + u * 7) % 3 !== 0) continue;
      const q = targets[Math.floor(t * 3 + c.i * 7) % targets.length]!;
      bolts.push({ side: 0, ax: c.x, ay: 6, az: c.z, bx: q.x, by: 3.2, bz: q.z });
      shots++;
    }
  }
  if (firing && plan.nativeOff > 0 && standing.length) {
    let shots = 0;
    for (const n of natives) {
      if (shots >= 12) break;
      if (n.doing !== "stand" || Math.floor(t * 6 + unit(seed, 1300 + n.i) * 6) % 5 !== 0) continue;
      const q = standing[Math.floor(t * 2 + n.i * 5) % standing.length]!;
      bolts.push({ side: 1, ax: n.x, ay: 6, az: n.z, bx: q.x, by: 4, bz: q.z });
      shots++;
    }
  }
  // Thrown stones: from those close enough for an arm, at those who stand there.
  if (plan.nativeOff <= 0 && t >= T.come && t < T.rout && standing.length) {
    for (const n of natives) {
      if (stones.length >= 14) break;
      if (n.doing !== "run" && n.doing !== "strike") continue;
      const q = standing[n.i % standing.length]!,
        far = Math.hypot(q.x - n.x, q.z - n.z);
      if (far > 46) continue;
      const k = (t * 0.9 + unit(seed, 1500 + n.i)) % 1;
      stones.push({
        x: lerp(n.x, q.x, k),
        y: 6 + 26 * k * (1 - k),
        z: lerp(n.z, q.z, k),
      });
    }
  }
  // What burns, once it is theirs (where anything burns at all).
  const fires =
    won && plan.burns
      ? s.ground.huts.flatMap((h, i) => {
          const lit = T.rout + 1 + unit(seed, 1700 + i) * 4;
          return t >= lit ? [{ x: h.x, z: h.z, size: smooth((t - lit) / 2.5) }] : [];
        })
      : [];
  return {
    t,
    stage: landfallStage(s, t),
    comers,
    natives,
    landers,
    bolts,
    stones,
    fires,
    left: [standing.length, up.length + fleeing.length],
  };
}

/** The camera: what they saw come down; the two drawn up; the fire and who falls; how it ended. Pure in t. */
export function landfallEye(s: LandfallScript, time: number): LandfallEye {
  const T = s.times,
    t = Math.max(0, Math.min(T.end, time)),
    way = s.ground.way,
    across = s.across,
    edge = s.ground.edge,
    gap = s.gap,
    middle = at(edge, way, across, gap * 0.5, 0),
    pad = s.pads[0]!,
    // How far off the eye must be for the two hosts to be seen on a tall screen, and looking down enough that the ground fills it.
    far = s.ground.most ? 128 : Math.max(210, gap * 1.7),
    shot = (k: number, u: number): LandfallEye => {
      if (k === 0) {
        // From beside the ground, the landers coming down over it.
        const land = clamp01(u / T.land),
          high = 160 * (1 - land) * (1 - land),
          base = at(middle, way, across, far * 0.2, far * 0.3);
        return {
          e: { x: base.x, y: far * 0.72, z: base.z },
          at: { x: pad.x, y: high * 0.6 + 4, z: pad.z },
        };
      }
      if (k === 1) {
        // Behind those who came and over them, both hosts along the screen's length.
        const base = at(middle, way, across, far * 0.5, far * 0.08);
        return {
          e: { x: base.x, y: far * 0.84, z: base.z },
          at: { x: middle.x, y: 2, z: middle.z },
        };
      }
      if (k === 2) {
        // Closer as they come on: the eye goes with their front.
        const come = clamp01((u - T.come) / Math.max(1, T.reach - T.come)),
          target = at(edge, way, across, gap * (0.3 + 0.42 * come), 0),
          base = at(target, way, across, far * 0.42, far * 0.1);
        return {
          e: { x: base.x, y: far * 0.7, z: base.z },
          at: { x: target.x, y: 3, z: target.z },
        };
      }
      // Turned back: from among those who held, up at the ships going. (Over the ground it was fought
      // on, a short fight's eye stands over where they come down, and they would rise into it.)
      if (!s.plan.won) {
        const going = Math.max(0, u - T.rout - 7),
          from = at(pad, way, across, -220, 40);
        return {
          e: { x: from.x, y: 70, z: from.z },
          at: { x: pad.x, y: 12 + 3 * going * going * 0.28, z: pad.z },
        };
      }
      // The end: over the ground it was fought on, the place behind.
      const base = at(middle, way, across, far * 0.46, -far * 0.14);
      return {
        e: { x: base.x, y: far * 0.8, z: base.z },
        at: { x: edge.x + way.x * gap * 0.25, y: 2, z: edge.z + way.z * gap * 0.25 },
      };
    };
  const edges = [T.land + 0.8, T.come + 1.2, T.rout + 1.5];
  for (let b = 0; b < edges.length; b++) {
    const e = edges[b]!;
    if (t >= e - 1 && t < e + 1) {
      const k = smooth((t - (e - 1)) / 2),
        a = shot(b, t),
        c = shot(b + 1, t);
      return {
        e: { x: lerp(a.e.x, c.e.x, k), y: lerp(a.e.y, c.e.y, k), z: lerp(a.e.z, c.e.z, k) },
        at: { x: lerp(a.at.x, c.at.x, k), y: lerp(a.at.y, c.at.y, k), z: lerp(a.at.z, c.at.z, k) },
      };
    }
  }
  return shot(t < edges[0]! ? 0 : t < edges[1]! ? 1 : t < edges[2]! ? 2 : 3, t);
}

/** The words under the film at a time. */
export function landfallWords(s: LandfallScript, t: number): string {
  const p = s.plan,
    T = s.times;
  if (t < T.land)
    return `${p.landers} down on the ground of the ${p.natives}, who live here ${p.stageWords}.`;
  if (t < T.come) return p.cameWords;
  if (t < T.reach)
    return p.nativeOff > 0
      ? `The ${p.natives} stand and answer them, with ${p.nativeArmWords}.`
      : `The ${p.natives} have never faced this. They come on together, with ${p.nativeArmWords}.`;
  if (t < T.rout)
    return p.how === "broke crossing"
      ? `Struck down before they can reach them, the ${p.natives} break.`
      : `Those who get through are among them, at the hand.`;
  return p.endWords;
}
