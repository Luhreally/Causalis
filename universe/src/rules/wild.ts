// A beast possessed (Phase 61; asked for 2026-10-27: "add in functionality to possess anything like
// worldbox/worldfall mod ... make sure it works right in mobile"): one of a town's flock, of the game
// about it or of the beasts that hunt them taken over and steered by hand, its moves its body's own —
// how fast it walks and runs by its size and how it goes (legs, wings, a slither, a crawl), how far
// its bite or its horns reach and what they do, what it eats, whether it hunts, whether it keeps a
// herd — and the beasts about it moved by a small world of their own at the possession's step: its
// herd grazing about its middle, starting off where a hunter comes at a run, gathering about it where
// it calls them. A creature of the meadow's ages takes its moves from the same body (view/meadow.ts
// steps it in its own small world). Metres of the town's ground (or the meadow's). Pure: the scene,
// the bids and the world's keyed draws step it the same on every machine. The sim keeps it and writes
// back what lasts (sim/hand/wild.ts): a kill a death in the flock or in the wild's count, a beast run
// off lost to its herd.
import { dmath } from "../kernel/index.ts";
import type { CreatureBody } from "./creatures.ts";
import { POSSESS_HZ, type HandBid, type LocalDraw } from "./possess.ts";
import type { Blow } from "./wounds.ts";

const DT = 1 / POSSESS_HZ;

/**
 * What a beast is bid to do (codes past Phase 60's and the soldier's: flight shares his fly's code):
 * bolt from what threatens it, eat (graze, browse, peck, or at a kill), drink, hunt (spring on its
 * prey), call its herd about it, court one of its kind.
 */
export const WILD_ACT = { flee: 10, eat: 11, drink: 12, hunt: 13, herd: 14, court: 15 } as const;

/** How a beast's feeding makes it run against its walk (view/meadow.ts FEEDS' run, by niche). */
export const WILD_RUN: Readonly<Record<string, number>> = {
  grazer: 3,
  "seed-eater": 3.4,
  browser: 2.5,
  "great beast": 1.7,
  hunter: 3.5,
  "small hunter": 3.1,
  scavenger: 2.6,
  swimmer: 2.2,
};
/** How each way of going paces it against a walker's (a slither, a crawl the slower; a flier skims low). */
export const WILD_GAIT: Readonly<Record<string, number>> = {
  walk: 1,
  run: 1.1,
  hop: 1.05,
  crawl: 0.65,
  slither: 0.55,
  swim: 0.4,
  fly: 1.35,
};
/** The beasts of a town are drawn so many times larger than life (view/creature.ts's), their paces with them. */
export const WILD_DRAWN = 3.2;

/** What a beast's body gives it to move and act by. */
export type WildFrame = {
  /** Its walk and run (metres a second of the ground it is drawn on). */
  readonly walk: number;
  readonly run: number;
  /** How far its bite, horns or claws reach (metres), and what they deal. */
  readonly reach: number;
  readonly bite: Blow;
  /** What it eats, and whether it hunts (flesh), keeps a herd, flies. */
  readonly eats: CreatureBody["eats"];
  readonly hunts: boolean;
  readonly herds: boolean;
  readonly flies: boolean;
  /** Its weight (kg), and its might against another by it (the root of its weight's cube root). */
  readonly size: number;
  readonly might: number;
};

/** A beast's moves from its body and its way of life (`niche`: rules/creatures.ts FOOD_WEB's). */
export function wildFrame(body: CreatureBody, niche: string): WildFrame {
  const size = Math.max(0.05, body.size),
    length = WILD_DRAWN * 1.5 * Math.max(0.26, dmath.cbrt(size / 200)),
    gait = WILD_GAIT[body.moves] ?? 1,
    walk = (1.1 + 0.3 * length) * gait,
    feats = body.features,
    bite: Blow =
      feats.includes("tusks") || feats.includes("horns") || feats.includes("antlers")
        ? "point"
        : feats.includes("claws")
          ? "edge"
          : feats.includes("beak")
            ? "point"
            : feats.includes("trunk") || feats.includes("wide-horns")
              ? "blunt"
              : "crush";
  return {
    walk,
    run: walk * (WILD_RUN[niche] ?? 2.5) * 0.75,
    reach: 0.45 * length + 0.6,
    bite,
    eats: body.eats,
    hunts: body.eats === "flesh",
    herds:
      niche === "grazer" ||
      niche === "browser" ||
      niche === "great beast" ||
      niche === "seed-eater",
    flies: body.moves === "fly",
    size,
    might: dmath.cbrt(size),
  };
}

/** A kind of beast in the small world: its body's frame and its way of life. */
export type WildKind = { readonly frame: WildFrame; readonly niche: string };

/** Where the beasts were taken: their kinds, their herds' middles, the water near, the flock's pasture. */
export type WildScene = {
  readonly kinds: readonly WildKind[];
  /** Each herd's middle at the taking, and whether it is a town's flock. */
  readonly herds: readonly { readonly x: number; readonly z: number; readonly flock: boolean }[];
  readonly water: { readonly x: number; readonly z: number; readonly r: number } | null;
  readonly pasture: { readonly x: number; readonly z: number; readonly r: number } | null;
  /** Where the possessed was taken (metres): it goes no farther than WILD_BOUNDS from it. */
  readonly x: number;
  readonly z: number;
};

/** What a beast is doing: grazing (or browsing, pecking) about its herd, walking, running, fleeing, drinking, eating at a kill, springing on prey, dead, gathered to the one possessed. */
export const WILD_DOINGS = [
  "graze",
  "walk",
  "run",
  "flee",
  "drink",
  "eat",
  "hunt",
  "dead",
  "follow",
  "court",
] as const;
export type WildDoing = (typeof WILD_DOINGS)[number];

export type WildBody = {
  /** Who: its herd and place in it (view/fauna.ts's: herd × 1000 + member; a band's 900000 + band × 100 + member). */
  readonly id: number;
  /** Its kind (an index into the scene's kinds), its herd (an index; -1: a band's). */
  readonly kind: number;
  readonly herd: number;
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  doing: WildDoing;
  until: number;
  /** Where it means to go (its grazing's next spot). */
  tx: number;
  tz: number;
};

/** What the possessed did that lasts or is told: a kill (whom), eaten, drunk, called, courted. */
export type WildDeed = {
  readonly step: number;
  readonly kind: "killed" | "ate" | "drank" | "called" | "courted" | "missed";
  readonly id: number;
};

/**
 * What the small world tells of the possessed (the host words them); of "nothing", why (more): no
 * foe, no kill near, no water, it hunts no one, none near enough to take, it keeps no herd, none of
 * its kind near, its spring under way.
 */
export const WILD_TOLD = [
  "",
  "grazed",
  "ate",
  "drank",
  "killed",
  "missed",
  "called",
  "courted",
  "fled",
  "nothing",
] as const;
export type WildTold = (typeof WILD_TOLD)[number];

export type WildWorld = {
  step: number;
  bodies: WildBody[];
  deeds: WildDeed[];
  /** The step the herd was last called at (it follows him a while after). */
  called: number;
  /** How full he is (0 … 1), from his eating. */
  fed: number;
  told: [number, number, number, number];
  /** Why it ended ("": it goes on): gone too far from where he was taken. */
  ended: "" | "far";
};

/** How far the possessed beast may go from where it was taken (metres). */
export const WILD_BOUNDS = 400;
/** How far its herd starts at a hunter running at it, how far a call is heard, how near a mate must be; what eating and drinking reach. */
export const WILD_NEAR = { startle: 26, call: 45, court: 6, water: 10, kill: 3 } as const;
/** How long things take (steps): a grazing spot kept, a start, a call followed, a spring, a kill eaten, a drink. */
export const WILD_TAKES = { graze: 120, flee: 60, follow: 400, spring: 16, eat: 40, drink: 40 };
/** How much a mouthful, a meal of a kill, a drink fills (0 … 1). */
export const WILD_FILL = { graze: 0.04, kill: 0.5, drink: 0.02 } as const;

/** A body as it is taken: where the view drew it. */
export function wildBody(
  id: number,
  kind: number,
  herd: number,
  at: { x: number; z: number; yaw: number },
): WildBody {
  return {
    id,
    kind,
    herd,
    x: at.x,
    z: at.z,
    yaw: at.yaw,
    vx: 0,
    vz: 0,
    doing: "graze",
    until: 0,
    tx: at.x,
    tz: at.z,
  };
}

/** The most bodies a beast's small world holds: it and the nearest about it. */
export const WILD_MOST = 120;
/** The numbers a body is sent as: its id, its kind, its herd (-1: a band's), where it stands (x, z, yaw). */
export const WILD_PACKED = 6;

/** The bodies sent packed (WILD_PACKED numbers each), as the small world takes them. */
export function unpackWild(packed: readonly number[]): WildBody[] {
  const out: WildBody[] = [];
  for (let i = 0; i + WILD_PACKED <= packed.length; i += WILD_PACKED)
    out.push(
      wildBody(packed[i]!, packed[i + 1]!, packed[i + 2]!, {
        x: packed[i + 3]!,
        z: packed[i + 4]!,
        yaw: packed[i + 5]!,
      }),
    );
  return out;
}

/** A fresh small world: the possessed first. */
export function wildWorld(bodies: WildBody[]): WildWorld {
  return {
    step: 0,
    bodies,
    deeds: [],
    called: -WILD_TAKES.follow,
    fed: 0.5,
    told: [0, 0, -1, 0],
    ended: "",
  };
}

/** A copy to step ahead without touching the kept one. */
export function copyWild(w: WildWorld): WildWorld {
  return {
    step: w.step,
    bodies: w.bodies.map((b) => ({ ...b })),
    deeds: [...w.deeds],
    called: w.called,
    fed: w.fed,
    told: [...w.told],
    ended: w.ended,
  };
}

/** What each draw is for. */
const P = { spot: 1, spotZ: 2, kill: 3, court: 4 };
const told = (w: WildWorld, what: WildTold, id = -1, more = 0) => {
  w.told = [WILD_TOLD.indexOf(what), w.step, id, more];
};

/** Turn `from` toward `to` by at most `most` (radians). */
function turned(from: number, to: number, most: number): number {
  let d = (to - from) % dmath.TAU;
  if (d > dmath.PI) d -= dmath.TAU;
  if (d < -dmath.PI) d += dmath.TAU;
  return from + Math.max(-most, Math.min(most, d));
}

/** Go toward (tx, tz) at `pace`, no farther than it is (true: there). */
function go(b: WildBody, tx: number, tz: number, pace: number): boolean {
  const dx = tx - b.x,
    dz = tz - b.z,
    far = Math.sqrt(dx * dx + dz * dz);
  if (far < 0.05) {
    b.vx = 0;
    b.vz = 0;
    return true;
  }
  const step = Math.min(far, pace * DT);
  b.x += (dx / far) * step;
  b.z += (dz / far) * step;
  b.vx = (dx / far) * step * POSSESS_HZ;
  b.vz = (dz / far) * step * POSSESS_HZ;
  b.yaw = turned(b.yaw, dmath.atan2(dx, dz), 0.3);
  return step >= far;
}

/** The nearest other body of the small world to `b` that `keep` keeps (-1: none). */
function nearest(w: WildWorld, b: WildBody, keep: (o: WildBody) => boolean): number {
  let best = -1,
    bestD = Infinity;
  for (let j = 0; j < w.bodies.length; j++) {
    const o = w.bodies[j]!;
    if (o === b || !keep(o)) continue;
    const d = (o.x - b.x) * (o.x - b.x) + (o.z - b.z) * (o.z - b.z);
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  }
  return best;
}

const alive = (b: WildBody) => b.doing !== "dead";
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z));

/** Whether the possessed, a hunter, comes at a run: its herd's beasts start off from it. */
function threatens(scene: WildScene, w: WildWorld): boolean {
  const me = w.bodies[0]!,
    k = scene.kinds[me.kind]!;
  return k.frame.hunts && (me.doing === "run" || me.doing === "hunt");
}

/** One of the bodies the small world moves. */
function think(scene: WildScene, w: WildWorld, i: number, draw: LocalDraw): void {
  const b = w.bodies[i]!,
    s = w.step,
    k = scene.kinds[b.kind]!,
    me = w.bodies[0]!;
  if (!alive(b)) return;
  // Starting off from a hunter come at a run, away from it a while.
  if (b.doing === "flee" && s < b.until) {
    const dx = b.x - me.x,
      dz = b.z - me.z,
      far = Math.sqrt(dx * dx + dz * dz) || 1;
    go(b, b.x + (dx / far) * 10, b.z + (dz / far) * 10, k.frame.run);
    return;
  }
  if (i !== 0 && threatens(scene, w) && !k.frame.hunts && distance(b, me) < WILD_NEAR.startle) {
    b.doing = "flee";
    b.until = s + WILD_TAKES.flee;
    return;
  }
  // Called: about the one possessed of its herd, a little apart.
  if (
    b.herd >= 0 &&
    b.herd === me.herd &&
    s - w.called < WILD_TAKES.follow &&
    distance(b, me) < WILD_NEAR.call * 2
  ) {
    b.doing = "follow";
    const d = distance(b, me);
    if (d > 4 + (b.id % 7)) go(b, me.x, me.z, d > 12 ? k.frame.run * 0.6 : k.frame.walk);
    else {
      b.vx = 0;
      b.vz = 0;
    }
    return;
  }
  // A band's beasts stand where they were (their hunts are the views').
  if (b.herd < 0) {
    b.doing = "graze";
    b.vx = 0;
    b.vz = 0;
    return;
  }
  // Grazing about its herd's middle: a spot, then another.
  const h = scene.herds[b.herd]!;
  if (s >= b.until) {
    const r = 6 + 10 * draw(b.id, s, P.spot);
    const a = draw(b.id, s, P.spotZ) * dmath.TAU;
    b.tx = h.x + r * dmath.sin(a);
    b.tz = h.z + r * dmath.cos(a);
    b.until = s + WILD_TAKES.graze + Math.floor(draw(b.id, s, P.spot, 1) * WILD_TAKES.graze);
  }
  const there = distance(b, { x: b.tx, z: b.tz }) < 0.5;
  b.doing = there ? "graze" : "walk";
  if (!there) go(b, b.tx, b.tz, k.frame.walk * 0.7);
  else {
    b.vx = 0;
    b.vz = 0;
  }
}

/** The possessed, by his bid: about the ground at a walk or a run, and his act. */
function hand(scene: WildScene, w: WildWorld, bid: HandBid, draw: LocalDraw): void {
  const b = w.bodies[0]!,
    s = w.step,
    k = scene.kinds[b.kind]!,
    f = k.frame,
    m = Math.min(1, Math.sqrt(bid.mx * bid.mx + bid.mz * bid.mz) / 31);
  if (!alive(b)) return;
  const fleeing = b.doing === "flee" && s < b.until;
  if (m > 0.05) {
    go(b, b.x + bid.mx, b.z + bid.mz, (bid.run || fleeing ? f.run : f.walk) * m);
    if (!fleeing) b.doing = bid.run ? "run" : "walk";
  } else {
    b.vx = 0;
    b.vz = 0;
    if (!fleeing && (b.doing === "walk" || b.doing === "run")) b.doing = "graze";
  }
  switch (bid.act) {
    case WILD_ACT.flee: {
      b.doing = "flee";
      b.until = s + WILD_TAKES.flee;
      told(w, "fled");
      break;
    }
    case WILD_ACT.eat: {
      // A hunter eats at a kill near; the rest graze, browse or peck where they stand.
      if (f.eats === "flesh" || f.eats === "carrion") {
        const kill = nearest(
          w,
          b,
          (o) => o.doing === "dead" && distance(o, b) <= WILD_NEAR.kill + f.reach,
        );
        if (kill < 0) {
          told(w, "nothing", -1, 1);
          break;
        }
        b.doing = "eat";
        b.until = s + WILD_TAKES.eat;
        w.fed = Math.min(1, w.fed + WILD_FILL.kill);
        w.deeds.push({ step: s, kind: "ate", id: w.bodies[kill]!.id });
        told(w, "ate", w.bodies[kill]!.id);
      } else {
        b.doing = "graze";
        b.until = s + WILD_TAKES.eat;
        w.fed = Math.min(1, w.fed + WILD_FILL.graze);
        w.deeds.push({ step: s, kind: "ate", id: -1 });
        told(w, "grazed");
      }
      break;
    }
    case WILD_ACT.drink: {
      const water = scene.water;
      if (!water || distance(b, water) > water.r + WILD_NEAR.water) {
        told(w, "nothing", -1, 2);
        break;
      }
      b.doing = "drink";
      b.until = s + WILD_TAKES.drink;
      w.fed = Math.min(1, w.fed + WILD_FILL.drink);
      w.deeds.push({ step: s, kind: "drank", id: -1 });
      told(w, "drank");
      break;
    }
    case WILD_ACT.hunt: {
      if (!f.hunts) {
        told(w, "nothing", -1, 3);
        break;
      }
      // (One spring at a time: not another while it is under way.)
      if (b.doing === "hunt" && s < b.until) {
        told(w, "nothing", -1, 7);
        break;
      }
      // A spring at the nearest beast it may take, within a bound of its reach.
      const prey = nearest(
        w,
        b,
        (o) => alive(o) && !scene.kinds[o.kind]!.frame.hunts && distance(o, b) <= f.reach * 3,
      );
      if (prey < 0) {
        told(w, "nothing", -1, 4);
        break;
      }
      const o = w.bodies[prey]!,
        ok = scene.kinds[o.kind]!.frame,
        // (The larger it is against its prey, the surer; a running beast the harder.)
        takes = dmath.clamp(
          0.4 *
            dmath.sqrt(f.might / Math.max(0.05, ok.might)) *
            (o.doing === "flee" || o.doing === "run" ? 0.6 : 1),
          0.05,
          0.85,
        );
      b.doing = "hunt";
      b.until = s + WILD_TAKES.spring;
      b.yaw = dmath.atan2(o.x - b.x, o.z - b.z);
      go(b, o.x, o.z, f.run);
      if (draw(b.id, s, P.kill) < takes) {
        o.doing = "dead";
        o.vx = 0;
        o.vz = 0;
        w.deeds.push({ step: s, kind: "killed", id: o.id });
        told(w, "killed", o.id);
      } else {
        // (Missed: it bolts.)
        if (!ok.hunts) {
          o.doing = "flee";
          o.until = s + WILD_TAKES.flee;
        }
        w.deeds.push({ step: s, kind: "missed", id: o.id });
        told(w, "missed", o.id);
      }
      break;
    }
    case WILD_ACT.herd: {
      if (!f.herds || b.herd < 0) {
        told(w, "nothing", -1, 5);
        break;
      }
      w.called = s;
      let n = 0;
      for (const o of w.bodies)
        if (o !== b && o.herd === b.herd && alive(o) && distance(o, b) < WILD_NEAR.call * 2) n++;
      w.deeds.push({ step: s, kind: "called", id: -1 });
      told(w, "called", -1, n);
      break;
    }
    case WILD_ACT.court: {
      const mate = nearest(
        w,
        b,
        (o) => alive(o) && o.kind === b.kind && distance(o, b) <= WILD_NEAR.court,
      );
      if (mate < 0) {
        told(w, "nothing", -1, 6);
        break;
      }
      b.doing = "court";
      b.until = s + WILD_TAKES.eat;
      w.deeds.push({ step: s, kind: "courted", id: w.bodies[mate]!.id });
      told(w, "courted", w.bodies[mate]!.id);
      break;
    }
  }
  // (Its act held a while: grazing, drinking, eating, a spring.)
  if (
    m <= 0.05 &&
    (b.doing === "eat" || b.doing === "drink" || b.doing === "hunt" || b.doing === "court") &&
    s >= b.until
  )
    b.doing = "graze";
}

/** The beasts kept off each other (the dead not). */
function apart(scene: WildScene, w: WildWorld): void {
  const n = w.bodies.length;
  for (let a = 0; a < n; a++) {
    const p = w.bodies[a]!;
    if (!alive(p)) continue;
    const rp = scene.kinds[p.kind]!.frame.reach * 0.6;
    for (let c = a + 1; c < n; c++) {
      const q = w.bodies[c]!;
      if (!alive(q)) continue;
      const room = rp + scene.kinds[q.kind]!.frame.reach * 0.6,
        dx = q.x - p.x,
        dz = q.z - p.z,
        d2 = dx * dx + dz * dz;
      if (d2 >= room * room || d2 < 1e-12) continue;
      const d = Math.sqrt(d2),
        push = (room - d) / 2 / d;
      // (The possessed is not pushed: the rest give way.)
      if (a !== 0) {
        p.x -= dx * push;
        p.z -= dz * push;
      }
      q.x += dx * push * (a === 0 ? 2 : 1);
      q.z += dz * push * (a === 0 ? 2 : 1);
    }
  }
}

/** The small world stepped by one bid of the possessed. It ends where he goes too far. */
export function stepWild(scene: WildScene, w: WildWorld, bid: HandBid, draw: LocalDraw): void {
  if (w.ended) return;
  hand(scene, w, bid, draw);
  for (let i = 1; i < w.bodies.length; i++) think(scene, w, i, draw);
  apart(scene, w);
  w.step++;
  const me = w.bodies[0]!;
  if (distance(me, scene) > WILD_BOUNDS) w.ended = "far";
}

/** One of the four acts before a beast: which, whether it can now, and why not (WILD_TOLD's "nothing" more). */
export type WildOffer = {
  readonly act: number;
  readonly kind: "eat" | "graze" | "drink" | "hunt" | "herd" | "court" | "flee";
  readonly can: boolean;
};

/**
 * The four acts before the possessed beast, as its body allows: a hunter's hunt, its eating at a
 * kill, a drink, flight; a herd beast's grazing, a drink, its herd called, flight; any other's
 * eating, a drink, courting, flight.
 */
export function wildOffers(scene: WildScene, w: WildWorld): WildOffer[] {
  const b = w.bodies[0]!,
    f = scene.kinds[b.kind]!.frame,
    water = scene.water,
    drink: WildOffer = {
      act: WILD_ACT.drink,
      kind: "drink",
      can: !!water && distance(b, water) <= water.r + WILD_NEAR.water,
    },
    flee: WildOffer = { act: WILD_ACT.flee, kind: "flee", can: true };
  if (f.hunts) {
    const prey = nearest(
        w,
        b,
        (o) => alive(o) && !scene.kinds[o.kind]!.frame.hunts && distance(o, b) <= f.reach * 3,
      ),
      kill = nearest(w, b, (o) => o.doing === "dead" && distance(o, b) <= WILD_NEAR.kill + f.reach);
    return [
      {
        act: WILD_ACT.hunt,
        kind: "hunt",
        can: prey >= 0 && !(b.doing === "hunt" && w.step < b.until),
      },
      { act: WILD_ACT.eat, kind: "eat", can: kill >= 0 },
      drink,
      flee,
    ];
  }
  const graze: WildOffer = {
    act: WILD_ACT.eat,
    kind: f.eats === "carrion" ? "eat" : "graze",
    can: true,
  };
  if (f.herds && b.herd >= 0)
    return [graze, drink, { act: WILD_ACT.herd, kind: "herd", can: true }, flee];
  const mate = nearest(
    w,
    b,
    (o) => alive(o) && o.kind === b.kind && distance(o, b) <= WILD_NEAR.court,
  );
  return [graze, drink, { act: WILD_ACT.court, kind: "court", can: mate >= 0 }, flee];
}

/** Whether the possessed has strayed from its herd: farther than this from its middle (metres; a flock's pasture's edge and more). */
export const WILD_STRAY = 70;

/** Where its herd's living others stand now (their middle; the herd's at the taking where none is in the small world). */
export function herdMiddle(scene: WildScene, w: WildWorld): { x: number; z: number } | null {
  const me = w.bodies[0]!;
  if (me.herd < 0) return null;
  let x = 0,
    z = 0,
    n = 0;
  for (let i = 1; i < w.bodies.length; i++) {
    const o = w.bodies[i]!;
    if (o.herd !== me.herd || !alive(o)) continue;
    x += o.x;
    z += o.z;
    n++;
  }
  if (n) return { x: x / n, z: z / n };
  const h = scene.herds[me.herd];
  return h ? { x: h.x, z: h.z } : null;
}

/** Whether the possessed is lost to its herd: strayed from its middle (a beast of no herd never is). */
export function strayed(scene: WildScene, w: WildWorld): boolean {
  const m = herdMiddle(scene, w);
  return !!m && distance(w.bodies[0]!, m) > WILD_STRAY;
}
