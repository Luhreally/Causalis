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
import { generationYears } from "./lineage.ts";
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
/** The beasts of a town are drawn so many times larger than life (view/fauna.ts's: true, as its people are), their paces with them. */
export const WILD_DRAWN = 1;

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

/** A kind of beast in the small world: its body's frame and its way of life, and its temper (absent: read off its frame). */
export type WildKind = {
  readonly frame: WildFrame;
  readonly niche: string;
  readonly temper?: WildTemper;
};

/**
 * A kind's temper, what weighs its needs one against another: how wary (how far off a hunter starts it, how hard it is
 * to spring on), how much it keeps to its herd, how its coat sits with the ground's warmth (spreads too thick for it:
 * it thirsts and tires the sooner; too thin, the cold is hunger), and how fast its body burns and breeds.
 */
export type WildTemper = {
  readonly wary: number;
  readonly social: number;
  readonly heat: number;
  /** Hunger and the urge to breed a second (0 … 1 of the way), by its weight (Kleiber's quarter power) and its generations. */
  readonly burn: number;
  readonly breed: number;
};

/**
 * A kind's temper from its body: the small and the hunted start soonest, a hunter least (it is the threat); a herd beast
 * keeps to its herd; the small burn fast and breed young. `wary` and `heat` are its stock's evolved wariness and its
 * coat against its ground, in spreads (sim/ecology/lineage.ts traitsAt; 0: the kind as made).
 */
export function wildTemper(frame: WildFrame, wary = 0, heat = 0): WildTemper {
  const kg = Math.max(0.05, frame.size),
    base = frame.hunts ? 0.35 : dmath.clamp(1.5 - 0.2 * dmath.log10(kg), 0.6, 1.8);
  return {
    wary: base * dmath.exp(0.25 * dmath.clamp(wary, -3, 3)),
    social: frame.herds ? 1 : 0.25,
    heat: dmath.clamp(heat, -3, 3),
    burn: WILD_PACE.hunger * dmath.pow(kg, -0.25),
    breed: WILD_PACE.urge / generationYears(kg),
  };
}
const temperOf = (k: WildKind): WildTemper => k.temper ?? wildTemper(k.frame);

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
  "rest",
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
  /** Its needs, each 0 … 1 (WILD_NEEDS): they rise and fall by its body and what is about it, and what it does is the most pressing. */
  hunger: number;
  thirst: number;
  fear: number;
  tired: number;
  urge: number;
  /** The drive it acts on (WILD_DRIVES' index), and the body it flees (-1: none). */
  drive: number;
  foe: number;
};

/** A beast's needs, as its body keeps them (the page reads them of the one held: what it wants, and how badly). */
export const WILD_NEEDS = ["hunger", "thirst", "fear", "tired", "urge"] as const;
export type WildNeed = (typeof WILD_NEEDS)[number];

/** What a beast can be driven to: roam about its herd, eat, drink, flee, rest, court, keep to its herd, come when called. */
export const WILD_DRIVES = [
  "roam",
  "eat",
  "drink",
  "flee",
  "rest",
  "court",
  "herd",
  "follow",
] as const;
export type WildDrive = (typeof WILD_DRIVES)[number];
const D = { roam: 0, eat: 1, drink: 2, flee: 3, rest: 4, court: 5, herd: 6, follow: 7 } as const;

/**
 * How its needs move, a second: hunger for a beast of 1 kg at rest (its weight's quarter power slows it), so many times
 * that running; a grazing's and a kill's fill; thirst and a drink's; fear's fading (half in so many seconds); weariness
 * running and walking, and resting's ease; the urge to breed for a beast breeding yearly, and a courting's ease.
 */
export const WILD_PACE = {
  hunger: 1 / 200,
  hard: 3,
  graze: 1 / 25,
  meal: 1 / 8,
  thirst: 1 / 600,
  drink: 1 / 6,
  fearHalf: 4,
  run: 1 / 25,
  walk: 1 / 900,
  rest: 1 / 40,
  urge: 1 / 900,
  court: 1 / 5,
} as const;

/**
 * What each need weighs against the rest when a beast chooses (its utility: the need's urgency, its square, times its
 * weight, times its temper's where one bears on it; fear is urgency itself): fear the most; thirst a little over hunger;
 * weariness; the urge to breed, the less where none of its kind is in sight; straying from its herd, by how far; a call
 * heard; and roaming, the floor any need must pass. A drive acted on is kept until another passes it by `hold` (no
 * dithering), and a need being met (drinking, grazing, resting, courting) until it is `sated`, unless something weighs
 * past `breaks` (a threat, a call).
 */
export const WILD_WEIGH = {
  flee: 3,
  drink: 1.1,
  eat: 1,
  rest: 0.9,
  court: 0.6,
  unseen: 0.3,
  herd: 0.8,
  follow: 2,
  roam: 0.1,
  hold: 0.08,
  sated: 0.08,
  breaks: 0.9,
} as const;

/** A number 0 … 1 kept by a body's id: where its needs stand when it is first taken. */
function spread(id: number, j: number): number {
  return (Math.imul((id | 0) ^ Math.imul(j + 1, 0x9e3779b1), 0x85ebca6b) >>> 0) / 4294967296;
}
/** A body's needs as first taken (and filled in on one kept before beasts had them). */
function needsAt(b: { id: number }) {
  return {
    hunger: 0.15 + 0.5 * spread(b.id, 1),
    thirst: 0.1 + 0.4 * spread(b.id, 2),
    fear: 0,
    tired: 0.3 * spread(b.id, 3),
    urge: 0.6 * spread(b.id, 4),
    drive: 0,
    foe: -1,
  };
}

/** A body's needs, as the page shows them (0 … 1 each, in WILD_NEEDS's order). */
export function wildNeeds(b: WildBody): Record<WildNeed, number> {
  return { hunger: b.hunger, thirst: b.thirst, fear: b.fear, tired: b.tired, urge: b.urge };
}

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
/** How much a mouthful, a meal of a kill, a drink fills (0 … 1); how much a drink slakes, a courting eases. */
export const WILD_FILL = { graze: 0.04, kill: 0.5, drink: 0.02, thirst: 0.3, urge: 0.5 } as const;

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
    ...needsAt({ id }),
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
    // (A body kept before beasts had needs is given them as first taken.)
    bodies: w.bodies.map((b) => (b.hunger === undefined ? { ...b, ...needsAt(b) } : { ...b })),
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

/** Which bodies threaten the beasts that do not hunt, this step: the possessed hunter come at a run, a hunter stalking. */
function threatsNow(scene: WildScene, w: WildWorld): number[] {
  const out: number[] = [];
  if (threatens(scene, w)) out.push(0);
  for (let j = 1; j < w.bodies.length; j++) {
    const o = w.bodies[j]!;
    if (o.doing === "hunt" && scene.kinds[o.kind]!.frame.hunts) out.push(j);
  }
  return out;
}

/** How much fear fades a step. */
const FADE = dmath.pow(0.5, DT / WILD_PACE.fearHalf);
const unit = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * A body's needs moved by a step: hunger by its body's burning (the harder for running, and for a coat too thin for the
 * cold), thirst (the faster running, and in a coat too thick), weariness by its pace (resting eases it), the urge to
 * breed by its generations, and fear fading, or rising toward how near a threat has come within its wariness's reach.
 */
function feel(scene: WildScene, w: WildWorld, i: number, threats: readonly number[]): void {
  const b = w.bodies[i]!,
    k = scene.kinds[b.kind]!,
    f = k.frame,
    t = temperOf(k),
    pace = Math.sqrt(b.vx * b.vx + b.vz * b.vz),
    hard = pace > f.walk * 1.2,
    hot = t.heat > 0 ? t.heat : 0,
    cold = t.heat < 0 ? -t.heat : 0;
  b.hunger = unit(b.hunger + t.burn * (hard ? WILD_PACE.hard : 1) * (1 + 0.15 * cold) * DT);
  b.thirst = unit(b.thirst + WILD_PACE.thirst * (hard ? 2 : 1) * (1 + 0.25 * hot) * DT);
  b.tired = unit(
    b.tired +
      (hard
        ? WILD_PACE.run * (1 + 0.2 * hot)
        : pace > 0.05
          ? WILD_PACE.walk
          : -WILD_PACE.rest * (b.doing === "rest" ? 1 : 0.4)) *
        DT,
  );
  b.urge = unit(b.urge + t.breed * DT);
  b.fear *= FADE;
  if (f.hunts) return;
  for (const j of threats) {
    if (j === i) continue;
    const o = w.bodies[j]!,
      reach = WILD_NEAR.startle * t.wary * (j === 0 ? 1 : 0.6),
      d = distance(o, b);
    if (d >= reach) continue;
    const near = 1 - d / reach;
    if (near > b.fear) {
      b.fear = near;
      b.foe = j;
    }
  }
}

/** The nearest body that may be eaten (dead), taken (alive, not a hunter), or courted (its kind) by `b`; -1 none. */
const deadNear = (w: WildWorld, b: WildBody) => nearest(w, b, (o) => o.doing === "dead");
const preyNear = (scene: WildScene, w: WildWorld, b: WildBody) =>
  nearest(
    w,
    b,
    (o) => alive(o) && !scene.kinds[o.kind]!.frame.hunts && distance(o, b) < WILD_NEAR.call * 2,
  );
const mateNear = (w: WildWorld, b: WildBody) =>
  nearest(w, b, (o) => alive(o) && o.kind === b.kind && distance(o, b) < WILD_NEAR.call);

/** Where a body's herd keeps (its middle at the taking; a band's beast, where it stands). */
const homeOf = (scene: WildScene, b: WildBody): { x: number; z: number } =>
  b.herd >= 0 ? scene.herds[b.herd]! : b;

/**
 * What each drive weighs for a body now (WILD_DRIVES' order): its need times the need's weight, where it can be met here
 * (water in the scene, something to eat, one of its kind in sight), fear weighed by its wariness, its herd by how much it
 * keeps to one. The general rule a beast of any body chooses by: the most pressing wins (exported for the page's "why").
 */
export function wildDrives(scene: WildScene, w: WildWorld, i: number): number[] {
  const b = w.bodies[i]!,
    k = scene.kinds[b.kind]!,
    f = k.frame,
    t = temperOf(k),
    me = w.bodies[0]!,
    out = [WILD_WEIGH.roam, 0, 0, 0, 0, 0, 0, 0];
  if (b.hunger === undefined) Object.assign(b, needsAt(b));
  // Something to eat: the ground for a plant-eater; a kill, or prey to stalk, for a hunter; a kill for a carrion-eater.
  const canEat =
    f.eats === "flesh"
      ? deadNear(w, b) >= 0 || preyNear(scene, w, b) >= 0
      : f.eats === "carrion"
        ? deadNear(w, b) >= 0
        : true;
  if (canEat) out[D.eat] = b.hunger * b.hunger * WILD_WEIGH.eat;
  if (scene.water) out[D.drink] = b.thirst * b.thirst * WILD_WEIGH.drink;
  if (!f.hunts) out[D.flee] = b.fear * WILD_WEIGH.flee;
  out[D.rest] = b.tired * b.tired * WILD_WEIGH.rest * (1 - b.fear);
  // (Courting is looked for only where it could win: the search is the dearest.)
  const court = b.urge * b.urge * WILD_WEIGH.court;
  let most = 0;
  for (const x of out) if (x > most) most = x;
  if (court > most - WILD_WEIGH.hold)
    out[D.court] = court * (mateNear(w, b) >= 0 ? 1 : WILD_WEIGH.unseen);
  if (b.herd >= 0) {
    const far = distance(b, homeOf(scene, b));
    out[D.herd] = t.social * WILD_WEIGH.herd * dmath.clamp((far - 20) / 40, 0, 1.5);
    if (
      i !== 0 &&
      b.herd === me.herd &&
      w.step - w.called < WILD_TAKES.follow &&
      distance(b, me) < WILD_NEAR.call * 2
    )
      out[D.follow] = WILD_WEIGH.follow * t.social;
  }
  return out;
}

/** The drive a body acts on: the most pressing, unless the one it acts on is near enough to it (`hold`). */
function choose(scene: WildScene, w: WildWorld, i: number): number {
  const b = w.bodies[i]!,
    sc = wildDrives(scene, w, i);
  let best = 0;
  for (let d = 1; d < sc.length; d++) if (sc[d]! > sc[best]!) best = d;
  const was = b.drive;
  // (A need being met is met to the full, unless something comes that must break it off.)
  const meeting =
    was === D.drink
      ? b.doing === "drink" && b.thirst > WILD_WEIGH.sated
      : was === D.eat
        ? (b.doing === "graze" || b.doing === "eat") && b.hunger > WILD_WEIGH.sated
        : was === D.rest
          ? b.doing === "rest" && b.tired > WILD_WEIGH.sated
          : was === D.court && b.doing === "court" && b.urge > WILD_WEIGH.sated;
  if (meeting && sc[best]! < WILD_WEIGH.breaks) return was;
  return was !== best && sc[was]! > 0 && sc[was]! + WILD_WEIGH.hold >= sc[best]! ? was : best;
}

const still = (b: WildBody) => {
  b.vx = 0;
  b.vz = 0;
};

/** One of the bodies the small world moves: its needs moved, the most pressing chosen, and done. */
function think(
  scene: WildScene,
  w: WildWorld,
  i: number,
  draw: LocalDraw,
  threats: readonly number[],
): void {
  const b = w.bodies[i]!,
    s = w.step,
    k = scene.kinds[b.kind]!,
    f = k.frame,
    me = w.bodies[0]!;
  if (!alive(b)) return;
  if (b.hunger === undefined) Object.assign(b, needsAt(b));
  feel(scene, w, i, threats);
  // (Bolting is kept for its while: a beast started does not stop to graze at once.)
  const was = b.drive,
    drive = was === D.flee && s < b.until ? D.flee : choose(scene, w, i);
  b.drive = drive;
  switch (drive) {
    case D.flee: {
      if (was !== D.flee || s >= b.until) b.until = s + WILD_TAKES.flee;
      const from = w.bodies[b.foe] ?? me,
        dx = b.x - from.x,
        dz = b.z - from.z,
        far = Math.sqrt(dx * dx + dz * dz) || 1;
      b.doing = "flee";
      go(b, b.x + (dx / far) * 10, b.z + (dz / far) * 10, f.run);
      return;
    }
    case D.follow: {
      // Called: about the one possessed of its herd, a little apart.
      b.doing = "follow";
      const d = distance(b, me);
      if (d > 4 + (b.id % 7)) go(b, me.x, me.z, d > 12 ? f.run * 0.6 : f.walk);
      else still(b);
      return;
    }
    case D.drink: {
      const water = scene.water!,
        d = distance(b, water) || 1;
      if (d <= water.r + WILD_NEAR.water * 0.5) {
        b.doing = "drink";
        b.thirst = unit(b.thirst - WILD_PACE.drink * DT);
        still(b);
      } else {
        b.doing = "walk";
        go(
          b,
          water.x + ((b.x - water.x) / d) * water.r,
          water.z + ((b.z - water.z) / d) * water.r,
          f.walk,
        );
      }
      return;
    }
    case D.rest: {
      b.doing = "rest";
      still(b);
      return;
    }
    case D.court: {
      const mate = mateNear(w, b);
      if (mate < 0) break;
      const o = w.bodies[mate]!;
      if (distance(o, b) <= WILD_NEAR.court) {
        b.doing = "court";
        b.urge = unit(b.urge - WILD_PACE.court * DT);
        still(b);
      } else {
        b.doing = "walk";
        go(b, o.x, o.z, f.walk);
      }
      return;
    }
    case D.herd: {
      const h = homeOf(scene, b);
      b.doing = "walk";
      go(b, h.x, h.z, f.walk);
      return;
    }
    case D.eat: {
      if (f.eats !== "flesh" && f.eats !== "carrion") break;
      // A hunter or a carrion-eater at a kill; a hunter with none stalks the nearest it could take (its spring is the hand's).
      const kill = deadNear(w, b);
      if (kill >= 0) {
        const o = w.bodies[kill]!;
        if (distance(o, b) <= WILD_NEAR.kill + f.reach) {
          b.doing = "eat";
          b.hunger = unit(b.hunger - WILD_PACE.meal * DT);
          still(b);
        } else {
          b.doing = "walk";
          go(b, o.x, o.z, f.walk);
        }
        return;
      }
      const prey = preyNear(scene, w, b);
      if (prey < 0) break;
      const o = w.bodies[prey]!;
      b.doing = "hunt";
      if (distance(o, b) > f.reach * 2) go(b, o.x, o.z, f.walk * 0.8);
      else still(b);
      return;
    }
  }
  // Grazing (or browsing, pecking) about its herd's middle, a spot and then another; roaming, the same at its leisure.
  const h = homeOf(scene, b),
    band = b.herd < 0;
  if (s >= b.until) {
    // (Its spots as far apart as its body is long: an ox's a dozen metres off, a crawler's a few.)
    const r = band ? 1.5 + 2 * draw(b.id, s, P.spot) : (2 + 3.3 * draw(b.id, s, P.spot)) * f.reach;
    const a = draw(b.id, s, P.spotZ) * dmath.TAU;
    b.tx = h.x + r * dmath.sin(a);
    b.tz = h.z + r * dmath.cos(a);
    b.until = s + WILD_TAKES.graze + Math.floor(draw(b.id, s, P.spot, 1) * WILD_TAKES.graze);
  }
  // (There within its reach: the others about it push it a little, and it grazes on.)
  const there = distance(b, { x: b.tx, z: b.tz }) < Math.max(0.5, f.reach * 0.5);
  b.doing = there ? "graze" : "walk";
  if (!there) go(b, b.tx, b.tz, f.walk * 0.7);
  else still(b);
  // (Hungry it eats where it stands and browses on the way; roaming it nibbles.)
  if (f.eats !== "flesh" && f.eats !== "carrion")
    b.hunger = unit(
      b.hunger - WILD_PACE.graze * DT * (drive === D.eat ? 1 : 0.3) * (there ? 1 : 0.3),
    );
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
      b.thirst = unit((b.thirst ?? 0) - WILD_FILL.thirst);
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
        // (The larger it is against its prey, the surer; a running beast the harder, a wary kind the harder still.)
        takes = dmath.clamp(
          (0.4 *
            dmath.sqrt(f.might / Math.max(0.05, ok.might)) *
            (o.doing === "flee" || o.doing === "run" ? 0.6 : 1)) /
            dmath.sqrt(temperOf(scene.kinds[o.kind]!).wary / wildTemper(ok).wary),
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
      b.urge = unit((b.urge ?? 0) - WILD_FILL.urge);
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
  const threats = threatsNow(scene, w);
  // (The possessed's needs move as the rest's: its hunger is its fullness's other side.)
  const held = w.bodies[0]!;
  if (alive(held)) {
    if (held.hunger === undefined) Object.assign(held, needsAt(held));
    held.hunger = 1 - w.fed;
    feel(scene, w, 0, threats);
    w.fed = 1 - held.hunger;
  }
  for (let i = 1; i < w.bodies.length; i++) think(scene, w, i, draw, threats);
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
