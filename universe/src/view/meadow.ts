// The living world of an age, played (Phase 27 M155, asked for 2026-10-24: "i should be able to
// be in my game and see the cell stage and every stage like spore i would just watch it emerge and
// be able to pause and influence and all that"): a stretch of the age's land, and on it the beasts
// of its living lineages, each a life of its own. The grass and the woods grow back as they are
// eaten; grazers go in herds after the grass and run from what hunts them; browsers keep to the
// woods, great beasts take both; hunters stalk and run down what they can take, small hunters the
// small; those that eat the dead come to the fallen; swimmers keep to the pool. Each spends what it
// ate as it goes, bears young when well fed, and dies hungry, old or taken. As the ages pass its
// lineages come and go: those that died out at an age's end fall, those newly arisen walk in.
// The god's hand may green the land or parch it, hearten the hunters or shelter the hunted; what
// prospered under it, against the same land left alone beside it, bends the ages after it. Pure.
import type { MeadowPlan } from "../bridge/index.ts";
import type { LifeWay } from "../rules/index.ts";

/** The stretch of land, metres across and deep (the beasts drawn on it as the village draws them). */
export const MEADOW_W = 140;
export const MEADOW_H = 90;
/** Its grass in cells of this many metres a side. */
const CELL = 5;
const COLS = Math.round(MEADOW_W / CELL);
const ROWS = Math.round(MEADOW_H / CELL);
/** One step of its time, seconds. */
export const MEADOW_STEP = 1 / 20;
/** A drawn beast's metres to the sim's (the village draws its beasts a little larger than life). */
const DRAWN = 3.2;

/** How a beast of the meadow lives: by its niche. */
export type Feed = "graze" | "peck" | "browse" | "great" | "hunt" | "small" | "scavenge" | "swim";
const FEED_OF: Readonly<Record<string, Feed>> = {
  grazer: "graze",
  "seed-eater": "peck",
  browser: "browse",
  "great beast": "great",
  hunter: "hunt",
  "small hunter": "small",
  scavenger: "scavenge",
  swimmer: "swim",
};
/**
 * Each way of feeding: how many a lineage brings, how much faster it runs than it walks, how well
 * fed it must be to bear young (the small bear the more readily), and the way it is of.
 */
const FEEDS: Readonly<
  Record<Feed, { many: number; run: number; breed: number; way: LifeWay | null }>
> = {
  graze: { many: 9, run: 3.0, breed: 0.8, way: "grazers" },
  peck: { many: 8, run: 3.4, breed: 0.7, way: "grazers" },
  browse: { many: 5, run: 2.5, breed: 0.8, way: "browsers" },
  great: { many: 3, run: 1.7, breed: 0.9, way: "browsers" },
  hunt: { many: 3, run: 3.5, breed: 0.85, way: "hunters" },
  small: { many: 4, run: 3.1, breed: 0.8, way: "hunters" },
  scavenge: { many: 3, run: 2.6, breed: 0.8, way: "hunters" },
  swim: { many: 6, run: 2.2, breed: 0.85, way: null },
};
/** At most this many of a way's lineages in the meadow at once (the newest), and beasts in all. */
const KINDS_OF: Readonly<Record<Feed, number>> = {
  graze: 2,
  peck: 1,
  browse: 2,
  great: 1,
  hunt: 2,
  small: 1,
  scavenge: 1,
  swim: 1,
};
const MOST = 130;

/** What an act of the god's hand does, and for how long (seconds of the meadow's time). */
export type MeadowAct = "green" | "parch" | "hunters" | "hunted";
const HAND = 25;

/** A lineage in the meadow: its beasts' way of living and their measures. */
export type MeadowKind = {
  /** Its index among the plan's lineages. */
  readonly lineage: number;
  readonly ref: string;
  readonly name: string;
  readonly niche: string;
  readonly feed: Feed;
  readonly flies: boolean;
  /** Weight (kg), and length as drawn (the sim's metres). */
  readonly size: number;
  readonly length: number;
  /** Its easy pace and its run (m/s); how long it lives (s of the meadow's time); when grown. */
  readonly walk: number;
  readonly run: number;
  readonly life: number;
  readonly grown: number;
  /** The most of it the meadow holds. */
  readonly most: number;
  /** How close it keeps to its own (0 … 1). */
  readonly herd: number;
  /** Died out at an age's end: its last fall and no more are born. */
  gone: boolean;
  /** A band's own flock (Phase 29 M160): its hunters leave it be. */
  tame?: boolean;
};

export type Beast = {
  id: number;
  kind: number;
  x: number;
  z: number;
  heading: number;
  /** Its pace now (m/s). */
  speed: number;
  energy: number;
  age: number;
  generation: number;
  doing:
    | "grazing"
    | "browsing"
    | "walking"
    | "fleeing"
    | "stalking"
    | "chasing"
    | "resting"
    | "eating"
    | "swimming"
    | "coming";
  /** The beast it hunts or flees, the shrub or carcass it goes to (-1: none). */
  target: number;
  /** Seconds before it chooses its way again; of the chase; of rest after a meal. */
  think: number;
  chase: number;
  full: number;
  /** Where its legs are in their stride. */
  phase: number;
  marked: boolean;
  meals: number;
  young: number;
  fled: number;
};

export type Shrub = { x: number; z: number; leaf: number; r: number };
export type Carcass = { x: number; z: number; meat: number; size: number; kind: number };

/** How a followed beast's life ended, if it has. */
export type Fate = {
  readonly how: "taken" | "starved" | "old";
  readonly by: string | null;
  readonly at: number;
};

export type MeadowState = {
  readonly age: number;
  /** The age's kind and whether its land is wooded: its look and its growth. */
  kindOfAge: string;
  forests: boolean;
  kinds: MeadowKind[];
  beasts: Beast[];
  readonly grass: Float32Array;
  readonly shrubs: Shrub[];
  carcasses: Carcass[];
  /** Its pool (none where nothing swims). */
  pond: { x: number; z: number; r: number; food: number } | null;
  next: number;
  t: number;
  /** How fast its growth comes back, by the age (the hand may hasten it or slow it). */
  growth: number;
  /** Seconds left of each act of the hand. */
  lush: number;
  dry: number;
  bold: number;
  shelter: number;
  readonly rnd: () => number;
  born: number;
  died: number;
  taken: number;
  /** The beast followed, and its line; how its life ended. */
  chosen: number | null;
  fate: Fate | null;
  /** Each kind's number, every second. */
  history: { t: number; count: number[] }[];
  /** People about on the land, where a band lives on it (Phase 28): the hunting, running. */
  folk?: { x: number; z: number; hunting: boolean }[];
  /** The band's fire, where it is camped: the beasts keep from it. */
  fire?: { x: number; z: number } | null;
};

/** A small fast seeded source of numbers in [0, 1). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** How fast an age's growth comes back: a hothouse's quickly, an icehouse's or a burned land's slowly. */
const GROWTH: Readonly<Record<string, number>> = {
  quiet: 1,
  hothouse: 1.35,
  icehouse: 0.5,
  "great volcanism": 0.65,
  impact: 0.4,
};

/** A lineage of the plan as a kind of the meadow (null: no beast of it walks the land). */
function kindOf(plan: MeadowPlan, lineage: number): MeadowKind | null {
  const l = plan.lineages[lineage];
  if (!l?.body) return null;
  const feed = FEED_OF[l.niche];
  if (!feed) return null;
  const size = Math.max(0.05, l.body.size || l.size || 1),
    length = DRAWN * 1.5 * Math.max(0.26, Math.cbrt(size / 200)),
    walk = 1.4 + 0.42 * length,
    f = FEEDS[feed];
  return {
    lineage,
    ref: l.ref,
    name: l.name,
    niche: l.niche,
    feed,
    flies: l.body.moves === "fly",
    size,
    length,
    walk,
    run: walk * f.run,
    life: 60 + 22 * Math.log10(size + 1),
    grown: 0.2 * (60 + 22 * Math.log10(size + 1)),
    most: Math.round(f.many * 2.4),
    herd:
      feed === "graze"
        ? 0.7
        : feed === "great" || feed === "browse"
          ? 0.4
          : feed === "peck"
            ? 0.5
            : 0.1,
    gone: false,
  };
}

/** The lineages living in an age that walk the meadow: the newest of each way, as many as it holds. */
export function meadowLineages(plan: MeadowPlan, age: number): number[] {
  const taken: Partial<Record<Feed, number>> = {};
  return plan.lineages
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.body && l.arose <= age && (l.died === null || l.died >= age))
    .sort((a, b) => b.l.arose - a.l.arose || a.i - b.i)
    .filter(({ l }) => {
      const feed = FEED_OF[l.niche];
      if (!feed) return false;
      taken[feed] = (taken[feed] ?? 0) + 1;
      return taken[feed]! <= KINDS_OF[feed];
    })
    .map(({ i }) => i)
    .sort((a, b) => a - b);
}

/** Where on the meadow a point is: a grass cell's index. */
function cellAt(x: number, z: number): number {
  const c = Math.max(0, Math.min(COLS - 1, Math.floor((x + MEADOW_W / 2) / CELL))),
    r = Math.max(0, Math.min(ROWS - 1, Math.floor((z + MEADOW_H / 2) / CELL)));
  return r * COLS + c;
}

/** A grass cell's middle. */
export function cellMiddle(i: number): { x: number; z: number } {
  return {
    x: (i % COLS) * CELL + CELL / 2 - MEADOW_W / 2,
    z: Math.floor(i / COLS) * CELL + CELL / 2 - MEADOW_H / 2,
  };
}
export const MEADOW_CELLS = { cols: COLS, rows: ROWS, size: CELL } as const;

function inPond(s: MeadowState, x: number, z: number, margin = 0): boolean {
  const p = s.pond;
  return !!p && Math.hypot(x - p.x, z - p.z) < p.r + margin;
}

/**
 * The meadow of an age: its ground as the age has it, its grass and woods, its pool if anything
 * swims, and the beasts of its living lineages, each lineage as many as it brings. (Bare in the
 * first age, before life came ashore — unless it is a land of now, Phase 29 M160.)
 */
export function newMeadow(
  plan: MeadowPlan,
  age: number,
  seedText = plan.seed,
  ashore = age > 0,
): MeadowState {
  const a = plan.ages[age],
    rnd = seeded(hashText(`${seedText} meadow ${age}`)),
    s: MeadowState = {
      age,
      kindOfAge: a?.kind ?? "quiet",
      forests: a?.forests ?? true,
      kinds: [],
      beasts: [],
      grass: new Float32Array(COLS * ROWS),
      shrubs: [],
      carcasses: [],
      pond: null,
      next: 1,
      t: 0,
      growth: GROWTH[a?.kind ?? "quiet"] ?? 1,
      lush: 0,
      dry: 0,
      bold: 0,
      shelter: 0,
      rnd,
      born: 0,
      died: 0,
      taken: 0,
      chosen: null,
      fate: null,
      history: [],
    };
  // The pool, at one side.
  s.pond = { x: MEADOW_W * 0.28, z: -MEADOW_H * 0.18, r: 13, food: 1 };
  // (Before life came ashore the land is bare: it greens in the age the first beasts walk it.)
  for (let i = 0; i < s.grass.length; i++) {
    const m = cellMiddle(i);
    s.grass[i] = inPond(s, m.x, m.z, 1) || !ashore ? 0 : 0.55 + 0.4 * rnd();
  }
  if (ashore) woods(s);
  for (const lineage of meadowLineages(plan, age)) arrive(s, plan, lineage, false);
  if (!s.kinds.some((k) => k.feed === "swim")) s.pond = s.pond && { ...s.pond, r: 9 };
  record(s);
  return s;
}

/** The woods: in clumps, more where the age is wooded. */
function woods(s: MeadowState): void {
  const rnd = s.rnd,
    clumps = s.forests ? 5 : 2;
  for (let c = 0; c < clumps; c++) {
    const cx = (rnd() - 0.5) * MEADOW_W * 0.8,
      cz = (rnd() - 0.5) * MEADOW_H * 0.8;
    for (let k = 0; k < 7; k++) {
      const x = cx + (rnd() - 0.5) * 22,
        z = cz + (rnd() - 0.5) * 16;
      if (inPond(s, x, z, 3) || Math.abs(x) > MEADOW_W / 2 - 3 || Math.abs(z) > MEADOW_H / 2 - 3)
        continue;
      s.shrubs.push({ x, z, leaf: 0.6 + 0.4 * rnd(), r: 1.6 + 2.2 * rnd() });
    }
  }
}

/** A lineage come into the meadow: its beasts about the meadow, or walking in from its edge. */
function arrive(s: MeadowState, plan: MeadowPlan, lineage: number, walkIn: boolean): void {
  const kind = kindOf(plan, lineage);
  if (!kind) return;
  const k = s.kinds.length;
  s.kinds.push(kind);
  const r = s.rnd,
    many = Math.min(FEEDS[kind.feed].many, Math.max(0, MOST - s.beasts.length)),
    side = Math.floor(r() * 4),
    // (A herd comes together; the rest scattered.)
    cx = (r() - 0.5) * MEADOW_W * 0.7,
    cz = (r() - 0.5) * MEADOW_H * 0.7;
  for (let i = 0; i < many; i++) {
    let x: number, z: number;
    if (kind.feed === "swim" && s.pond) {
      const a = r() * Math.PI * 2,
        d = r() * (s.pond.r - 2);
      x = s.pond.x + Math.cos(a) * d;
      z = s.pond.z + Math.sin(a) * d;
    } else if (walkIn) {
      // In from an edge, a little apart (on the earth about the meadow, not off it).
      const along = (r() - 0.5) * 0.8,
        out = 1.5 + (i % 3) * 1.4;
      x = side < 2 ? (side ? 1 : -1) * (MEADOW_W / 2 + out) : along * MEADOW_W;
      z = side >= 2 ? (side === 3 ? 1 : -1) * (MEADOW_H / 2 + out) : along * MEADOW_H;
    } else {
      const spread = kind.herd > 0.5 ? 14 : 50;
      x = Math.max(-MEADOW_W / 2 + 3, Math.min(MEADOW_W / 2 - 3, cx + (r() - 0.5) * spread));
      z = Math.max(-MEADOW_H / 2 + 3, Math.min(MEADOW_H / 2 - 3, cz + (r() - 0.5) * spread));
      if (inPond(s, x, z, 2)) x = -x;
    }
    s.beasts.push(born(s, k, null, x, z, walkIn));
  }
}

function born(
  s: MeadowState,
  kind: number,
  mother: Beast | null,
  x: number,
  z: number,
  walkIn = false,
): Beast {
  const r = s.rnd,
    k = s.kinds[kind]!;
  return {
    id: s.next++,
    kind,
    x,
    z,
    heading: walkIn ? Math.atan2(-x, -z) : r() * Math.PI * 2,
    speed: 0,
    energy: mother ? 0.45 : 0.55 + 0.4 * r(),
    age: mother ? 0 : k.grown + r() * k.life * 0.35,
    generation: mother ? mother.generation + 1 : 0,
    doing: walkIn ? "coming" : "walking",
    target: -1,
    think: r() * 2,
    chase: 0,
    full: 0,
    phase: r(),
    marked: mother?.marked ?? false,
    meals: 0,
    young: 0,
    fled: 0,
  };
}

/** The age come on: lineages that died out fall, the newly arisen walk in, the land as the age has it. */
export function meadowAge(s: MeadowState, plan: MeadowPlan, age: number): MeadowState {
  const a = plan.ages[age],
    wanted = new Set(meadowLineages(plan, age)),
    out: MeadowState = { ...s, age };
  out.kindOfAge = a?.kind ?? "quiet";
  out.forests = a?.forests ?? true;
  out.growth = GROWTH[out.kindOfAge] ?? 1;
  // Life come ashore: the bare land greens, its woods spring up.
  if (age > 0 && !out.shrubs.length) {
    woods(out);
    for (const sh of out.shrubs) sh.leaf = 0.3;
    for (let i = 0; i < out.grass.length; i++)
      if (!inPondCell(out, i)) out.grass[i] = Math.max(out.grass[i]!, 0.35 + 0.3 * out.rnd());
  }
  // (Lineages gone in an age before, none of them left, let go: the beasts' kinds counted anew.)
  const living = new Set(out.beasts.map((b) => b.kind)),
    kept = out.kinds.map((k, i) => !k.gone || living.has(i));
  if (kept.some((x) => !x)) {
    const to: number[] = [];
    let j = 0;
    out.kinds = out.kinds.filter((_, i) => {
      if (!kept[i]) return false;
      to[i] = j++;
      return true;
    });
    for (const b of out.beasts) b.kind = to[b.kind]!;
    for (const c of out.carcasses) c.kind = to[c.kind] ?? 0;
  }
  const here = new Set<number>();
  out.kinds.forEach((k, i) => {
    if (k.gone) return;
    if (wanted.has(k.lineage)) here.add(k.lineage);
    else {
      k.gone = true;
      // (Its last die where they stand, the age's end upon them.)
      for (const b of out.beasts) if (b.kind === i) b.energy = -1;
    }
  });
  for (const lineage of wanted) if (!here.has(lineage)) arrive(out, plan, lineage, true);
  // A great death from the sky: many fall at once.
  if (out.kindOfAge === "impact") for (const b of out.beasts) if (out.rnd() < 0.45) b.energy = -1;
  return out;
}

/** Each kind's numbers, now. */
function counts(s: MeadowState): number[] {
  const n = s.kinds.map(() => 0);
  for (const b of s.beasts) n[b.kind]!++;
  return n;
}

function record(s: MeadowState): void {
  s.history.push({ t: s.t, count: counts(s) });
  if (s.history.length > 240) s.history.shift();
}

/**
 * What a hunter of a kind may take: the eaters of grass and leaf, no greater than it can master
 * (a hunter's prey worth the run, a small hunter's the small); never another that eats flesh.
 */
function prey(h: MeadowKind, p: MeadowKind): boolean {
  if (p === h || p.feed === "hunt" || p.feed === "small" || p.feed === "scavenge") return false;
  if (p.feed === "swim") return false;
  if (h.feed === "hunt")
    return p.feed !== "peck" && p.size <= h.size * 2.5 && p.size >= h.size * 0.04;
  if (h.feed === "small") return p.size <= h.size * 0.9 && (p.feed === "peck" || p.size < 30);
  return false;
}

/** Whether a beast of a kind fears another's. */
function fears(p: MeadowKind, h: MeadowKind): boolean {
  return (h.feed === "hunt" || h.feed === "small") && prey(h, p);
}

/** Turn toward a heading by at most `most` radians. */
function turn(from: number, to: number, most: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return from + Math.max(-most, Math.min(most, d));
}

/** The meadow a step on: each beast eats, goes, flees or hunts, spends, bears young or dies; its growth comes back. */
export function stepMeadow(s: MeadowState): void {
  const dt = MEADOW_STEP,
    r = s.rnd;
  s.t += dt;
  for (const key of ["lush", "dry", "bold", "shelter"] as const) s[key] = Math.max(0, s[key] - dt);
  // The grass and the woods come back.
  const grow = 0.0012 * s.growth * (s.lush > 0 ? 3 : 1) * (s.dry > 0 ? 0.15 : 1);
  for (let i = 0; i < s.grass.length; i++) {
    const g = s.grass[i]!;
    if (g < 1 && !(s.pond && inPondCell(s, i)))
      s.grass[i] = Math.min(1, g + grow * (0.15 + g) * (1 - g) * 4 * dt);
  }
  for (const sh of s.shrubs) sh.leaf = Math.min(1, sh.leaf + grow * 5 * (1 - 0.5 * sh.leaf) * dt);
  if (s.pond) s.pond.food = Math.min(1, s.pond.food + 0.01 * dt);
  for (const c of s.carcasses) c.meat -= 0.006 * dt;
  s.carcasses = s.carcasses.filter((c) => c.meat > 0);
  // Where each kind's herd is (its middle), for keeping together.
  const mid = s.kinds.map(() => ({ x: 0, z: 0, n: 0 }));
  for (const b of s.beasts) {
    const m = mid[b.kind]!;
    m.x += b.x;
    m.z += b.z;
    m.n++;
  }
  const byId = new Map(s.beasts.map((b) => [b.id, b]));
  const dead = new Set<number>();
  const counted = counts(s);
  // (How much game each hunting kind has about it: they bear young only where it is plentiful.)
  const game = s.kinds.map((h) =>
    h.feed === "hunt" || h.feed === "small"
      ? s.kinds.reduce((n, p, j) => n + (prey(h, p) ? counted[j]! : 0), 0)
      : 0,
  );
  for (const b of s.beasts) {
    if (dead.has(b.id)) continue;
    const k = s.kinds[b.kind]!;
    b.age += dt;
    b.think -= dt;
    b.full = Math.max(0, b.full - dt);
    let want = b.heading,
      pace = 0;
    if (b.doing === "coming") {
      // Walking in from the edge until it is in the meadow.
      want = Math.atan2(-b.x, -b.z);
      pace = k.walk;
      if (Math.abs(b.x) < MEADOW_W / 2 - 4 && Math.abs(b.z) < MEADOW_H / 2 - 4) b.doing = "walking";
    } else if (k.feed === "swim") {
      const p = s.pond;
      b.doing = "swimming";
      if (p) {
        if (b.think <= 0) {
          b.think = 1.5 + 2 * r();
          b.heading += (r() - 0.5) * 2;
        }
        const d = Math.hypot(b.x - p.x, b.z - p.z);
        if (d > p.r - 2) want = Math.atan2(p.x - b.x, p.z - b.z);
        pace = k.walk * 0.6;
        if (p.food > 0.15 && b.energy < 0.98) {
          b.energy += 0.03 * p.food * dt;
          p.food -= 0.0015 * dt;
        }
      }
    } else if (k.feed === "hunt" || k.feed === "small") {
      // A hunter: resting full, else hunting when hungry, else about.
      const sight = 48 * (s.bold > 0 ? 1.3 : 1);
      if (b.full > 0) {
        b.doing = "resting";
        b.target = -1;
      } else if (b.energy < 0.75) {
        let q = b.target >= 0 ? byId.get(b.target) : undefined;
        if (q && b.chase > (s.shelter > 0 ? 4 : k.feed === "small" ? 5 : 8)) {
          // Given up: it rests before it hunts again.
          b.full = 3;
          b.chase = 0;
          b.target = -1;
          q = undefined;
        } else if (!q || dead.has(q.id) || (b.chase === 0 && b.think <= 0)) {
          // (Chosen again now and then while it stalks: the nearest, the young and the weak first.)
          b.think = 2 + 2 * r();
          let best = Infinity;
          q = undefined;
          for (const o of s.beasts) {
            const ok = s.kinds[o.kind]!;
            if (dead.has(o.id) || o.doing === "coming" || !prey(k, ok)) continue;
            const d = Math.hypot(o.x - b.x, o.z - b.z);
            if (d > sight) continue;
            const score = d * (0.5 + o.energy) * (0.5 + 0.5 * Math.min(1, o.age / ok.grown));
            if (score < best) {
              best = score;
              q = o;
            }
          }
          b.target = q ? q.id : -1;
          b.chase = 0;
        }
        if (q) {
          const d = Math.hypot(q.x - b.x, q.z - b.z);
          want = Math.atan2(q.x - b.x, q.z - b.z);
          // Stalking near at a trot, then the run.
          const running = d < (k.feed === "small" ? 14 : 24) || b.chase > 0;
          pace = running ? k.run * (s.bold > 0 ? 1.25 : 1) : k.walk * 1.3;
          b.doing = running ? "chasing" : "stalking";
          if (running) b.chase += dt;
          if (d < (k.length + s.kinds[q.kind]!.length) * 0.5 + 0.8) {
            // Taken.
            dead.add(q.id);
            s.taken++;
            const p = s.kinds[q.kind]!;
            s.carcasses.push({ x: q.x, z: q.z, meat: 1, size: p.length, kind: q.kind });
            b.energy = Math.min(1, b.energy + 0.65);
            b.meals++;
            b.full = 8;
            b.chase = 0;
            b.target = -1;
            if (q.marked && q.id === s.chosen) s.fate = { how: "taken", by: k.name, at: s.t };
          }
        } else if (b.think <= 0) {
          b.think = 2 + 3 * r();
          b.heading += (r() - 0.5) * 2;
          b.doing = "walking";
        } else pace = k.walk * 0.7;
      } else {
        b.doing = "walking";
        if (b.think <= 0) {
          b.think = 2 + 3 * r();
          b.heading += (r() - 0.5) * 2;
        }
        pace = k.walk * 0.6;
      }
    } else if (k.feed === "scavenge") {
      // To the fallen, when hungry.
      let best = Infinity,
        c: Carcass | undefined;
      if (b.energy < 0.85)
        for (const x of s.carcasses) {
          const d = Math.hypot(x.x - b.x, x.z - b.z);
          if (d < best) {
            best = d;
            c = x;
          }
        }
      if (c) {
        want = Math.atan2(c.x - b.x, c.z - b.z);
        if (best < c.size * 0.6 + k.length * 0.5 + 0.5) {
          if (b.doing !== "eating") b.meals++;
          b.doing = "eating";
          b.energy = Math.min(1, b.energy + 0.12 * dt);
          c.meat -= 0.03 * dt;
        } else {
          b.doing = "walking";
          pace = k.walk * 2;
        }
      } else {
        b.doing = "walking";
        if (b.think <= 0) {
          b.think = 2 + 3 * r();
          b.heading += (r() - 0.5) * 2;
        }
        pace = k.walk * 0.7;
        // (A little from the living as well: a scavenger lives lean.)
        b.energy = Math.min(1, b.energy + 0.004 * dt);
      }
    } else {
      // The eaten: from what hunts them first.
      let threat: { x: number; z: number } | undefined,
        near = (s.shelter > 0 ? 30 : 19) * (k.flies ? 0.7 : 1);
      for (const o of s.beasts) {
        const h = s.kinds[o.kind]!;
        if (dead.has(o.id) || !fears(k, h) || o.full > 0) continue;
        const d = Math.hypot(o.x - b.x, o.z - b.z);
        if (d < near && (o.doing === "chasing" || d < near * 0.5)) {
          near = d;
          threat = o;
        }
      }
      // (And from people, where a band lives on the land: from the hunters' run, or any too near.)
      if (s.folk)
        for (const f of s.folk) {
          const d = Math.hypot(f.x - b.x, f.z - b.z);
          if (d < near && (f.hunting || d < near * 0.45)) {
            near = d;
            threat = f;
          }
        }
      if (threat) {
        if (b.doing !== "fleeing") b.fled++;
        b.doing = "fleeing";
        want = Math.atan2(b.x - threat.x, b.z - threat.z);
        // (A flier takes to the air: away the faster. The young, and the hungry, run slower:
        // it is they the hunters take.)
        pace =
          k.run *
          (s.shelter > 0 ? 1.15 : 1) *
          (k.flies ? 1.4 : 1) *
          (0.7 + 0.3 * Math.min(1, b.age / k.grown)) *
          (0.6 + 0.4 * Math.min(1, b.energy / 0.6));
      } else {
        // (A great beast at the woods while it has them in sight, or the grass under it is poor.)
        const browses =
          k.feed === "browse" ||
          (k.feed === "great" && (b.target >= 0 || s.grass[cellAt(b.x, b.z)]! < 0.3));
        if (browses) {
          // To the woods: the nearest shrub in leaf.
          let sh = b.target >= 0 ? s.shrubs[b.target] : undefined;
          if (!sh || sh.leaf < 0.15 || b.think <= 0) {
            b.think = 3 + 2 * r();
            let best = Infinity;
            b.target = -1;
            s.shrubs.forEach((x, i) => {
              if (x.leaf < 0.2) return;
              const d = Math.hypot(x.x - b.x, x.z - b.z) / (0.3 + x.leaf);
              if (d < best) {
                best = d;
                b.target = i;
              }
            });
            sh = b.target >= 0 ? s.shrubs[b.target] : undefined;
          }
          if (sh) {
            const d = Math.hypot(sh.x - b.x, sh.z - b.z);
            if (d < sh.r + k.length * 0.5 + 0.6) {
              b.doing = "browsing";
              if (b.energy < 0.99) {
                b.energy = Math.min(1, b.energy + 0.055 * rich(s) * sh.leaf * dt);
                sh.leaf = Math.max(0, sh.leaf - 0.02 * (k.length / 4) * dt);
              }
            } else {
              b.doing = "walking";
              want = Math.atan2(sh.x - b.x, sh.z - b.z);
              pace = k.walk;
            }
          } else grazeOr(s, b, k, dt);
        } else grazeOr(s, b, k, dt);
        if (b.doing === "walking" && pace === 0) {
          pace = k.walk;
          want = b.heading;
        }
        // Keeping with its own.
        const m = mid[b.kind]!;
        if (m.n > 1 && k.herd > 0) {
          const hx = m.x / m.n - b.x,
            hz = m.z / m.n - b.z,
            d = Math.hypot(hx, hz);
          if (d > 10 + 3 * Math.sqrt(m.n) && b.doing !== "grazing" && b.doing !== "browsing") {
            want = Math.atan2(hx, hz);
            pace = k.walk;
          } else if (d > 18 + 4 * Math.sqrt(m.n) && r() < k.herd * dt)
            b.heading = Math.atan2(hx, hz);
        }
        if (b.doing === "walking") want = turn(b.heading, want, Math.PI);
      }
    }
    // (Kept from a band's fire, where one burns on the land.)
    const fire = s.fire;
    if (fire && k.feed !== "swim" && b.doing !== "coming") {
      const d = Math.hypot(b.x - fire.x, b.z - fire.z);
      if (d < 12 + k.length * 0.5 && d > 1e-6) {
        want = Math.atan2(b.x - fire.x, b.z - fire.z);
        pace = Math.max(pace, k.walk);
        if (b.doing !== "fleeing" && b.doing !== "chasing") b.doing = "walking";
      }
    }
    // Go, kept to the meadow and out of the pool (a swimmer in it).
    b.heading = turn(b.heading, want, 3.2 * dt * (pace > k.walk * 1.5 ? 1.6 : 1));
    b.speed = pace;
    b.x += Math.sin(b.heading) * pace * dt;
    b.z += Math.cos(b.heading) * pace * dt;
    if (b.doing !== "coming") {
      const hw = MEADOW_W / 2 - 1.5,
        hh = MEADOW_H / 2 - 1.5;
      if (Math.abs(b.x) > hw) {
        b.x = Math.sign(b.x) * hw;
        b.heading = -b.heading;
      }
      if (Math.abs(b.z) > hh) {
        b.z = Math.sign(b.z) * hh;
        b.heading = Math.PI - b.heading;
      }
    }
    const p = s.pond;
    if (p && k.feed !== "swim" && !k.flies) {
      const d = Math.hypot(b.x - p.x, b.z - p.z),
        edge = p.r + k.length * 0.3;
      if (d < edge && d > 1e-6) {
        b.x = p.x + ((b.x - p.x) / d) * edge;
        b.z = p.z + ((b.z - p.z) / d) * edge;
      }
    }
    b.phase += dt * (0.6 + pace / Math.max(0.5, k.length * 0.45));
    // Spent as it goes: more running, less standing; the great spend slowly.
    const spend =
      0.01 * Math.pow(k.size / 100, -0.06) * (pace > k.walk * 1.5 ? 3 : pace > 0 ? 1.5 : 1);
    b.energy -= spend * dt;
    // Young, when well fed and grown, where its kind has room.
    if (
      !k.gone &&
      b.energy > FEEDS[k.feed].breed &&
      b.age > k.grown &&
      counted[b.kind]! < k.most &&
      s.beasts.length < MOST &&
      ((k.feed !== "hunt" && k.feed !== "small") || game[b.kind]! >= 4 * counted[b.kind]!) &&
      // (Swimmers spawn only while the pool feeds them well.)
      (k.feed !== "swim" || (s.pond?.food ?? 0) > 0.7) &&
      r() < 0.35 * dt
    ) {
      b.energy -= FEEDS[k.feed].breed * 0.45;
      b.young++;
      counted[b.kind]!++;
      const young = born(
        s,
        b.kind,
        b,
        b.x - Math.sin(b.heading) * k.length,
        b.z - Math.cos(b.heading) * k.length,
      );
      young.heading = b.heading;
      s.beasts.push(young);
      byId.set(young.id, young);
      s.born++;
    }
    // Death: hungry, or old.
    if (b.energy <= 0 || b.age > k.life * (0.9 + 0.4 * ((b.id * 0.618) % 1))) {
      dead.add(b.id);
      if (b.id === s.chosen) s.fate = { how: b.energy <= 0 ? "starved" : "old", by: null, at: s.t };
      if (k.feed !== "swim")
        s.carcasses.push({ x: b.x, z: b.z, meat: 0.7, size: k.length, kind: b.kind });
    }
  }
  if (dead.size) {
    s.died += dead.size;
    s.beasts = s.beasts.filter((b) => !dead.has(b.id));
  }
  if (Math.floor(s.t) !== Math.floor(s.t - dt)) {
    record(s);
    wander(s);
  }
}

/**
 * The land beyond the meadow: a lineage of the age not died out, with hardly any of it left here,
 * now and then has a few of its own walk in from an edge (the meadow is a stretch of a wider land,
 * not the whole of it), or, a swimmer, come down into the pool from the waters it joins. Once a
 * second.
 */
function wander(s: MeadowState): void {
  const r = s.rnd,
    n = counts(s);
  s.kinds.forEach((k, i) => {
    if (k.gone || n[i]! >= 2 || s.beasts.length > MOST - 4 || r() > 0.08) return;
    if (k.feed === "swim") {
      const p = s.pond;
      if (!p || p.food < 0.5) return;
      for (let j = 0; j < 2; j++) {
        const a = r() * Math.PI * 2,
          d = p.r - 2.5;
        s.beasts.push(born(s, i, null, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d));
      }
      return;
    }
    const side = Math.floor(r() * 4),
      along = (r() - 0.5) * 0.8,
      few =
        k.feed === "hunt" || k.feed === "small" ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2);
    for (let j = 0; j < few; j++) {
      const out = 1.5 + j * 1.4,
        x = side < 2 ? (side ? 1 : -1) * (MEADOW_W / 2 + out) : along * MEADOW_W,
        z = side >= 2 ? (side === 3 ? 1 : -1) * (MEADOW_H / 2 + out) : along * MEADOW_H;
      s.beasts.push(born(s, i, null, x, z, true));
    }
  });
}

/** How much the grass and leaf feed, the hand's greening richer, its parching thinner. */
function rich(s: MeadowState): number {
  return s.lush > 0 ? 1.6 : s.dry > 0 ? 0.6 : 1;
}

function inPondCell(s: MeadowState, i: number): boolean {
  const m = cellMiddle(i);
  return inPond(s, m.x, m.z, 1);
}

/** A grazer or a seed-eater at the grass: on it where it is good, else walking to better near by. */
function grazeOr(s: MeadowState, b: Beast, k: MeadowKind, dt: number): void {
  const c = cellAt(b.x, b.z),
    g = s.grass[c]!,
    r = s.rnd;
  if (b.energy >= 0.99 && b.doing !== "walking") {
    b.doing = "resting";
    return;
  }
  // (On good grass it stays at it; on poor, it looks about now and then for better.)
  if (g > 0.2 && (b.doing === "grazing" || b.doing === "resting") && (b.think > 0 || g > 0.45)) {
    b.doing = "grazing";
    if (b.energy < 0.99) {
      b.energy = Math.min(1, b.energy + 0.05 * rich(s) * g * dt);
      s.grass[c] = Math.max(0, g - 0.05 * (k.length / 4) * (k.feed === "peck" ? 0.3 : 1) * dt);
    }
    return;
  }
  if (b.think <= 0) {
    // A look about for better grass.
    b.think = 2 + 2 * r();
    let best = g,
      to = -1;
    for (let i = 0; i < 6; i++) {
      const x = b.x + (r() - 0.5) * 40,
        z = b.z + (r() - 0.5) * 40;
      if (Math.abs(x) > MEADOW_W / 2 - 2 || Math.abs(z) > MEADOW_H / 2 - 2) continue;
      const q = s.grass[cellAt(x, z)]!;
      if (q > best + 0.1) {
        best = q;
        to = cellAt(x, z);
      }
    }
    if (to >= 0) {
      const m = cellMiddle(to);
      b.heading = Math.atan2(m.x - b.x, m.z - b.z);
      b.doing = "walking";
    } else b.doing = g > 0.2 ? "grazing" : "walking";
    return;
  }
  if (b.doing !== "walking") b.doing = g > 0.2 ? "grazing" : "walking";
}

/** The god's hand on the meadow: its land greened or parched, its hunters heartened or the hunted sheltered. */
export function touchMeadow(s: MeadowState, act: MeadowAct): void {
  if (act === "green") {
    s.lush = HAND;
    s.dry = 0;
    for (let i = 0; i < s.grass.length; i++)
      if (!(s.pond && inPondCell(s, i))) s.grass[i] = Math.min(1, s.grass[i]! + 0.35);
    for (const sh of s.shrubs) sh.leaf = Math.min(1, sh.leaf + 0.3);
  } else if (act === "parch") {
    s.dry = HAND;
    s.lush = 0;
    for (let i = 0; i < s.grass.length; i++) s.grass[i] = s.grass[i]! * 0.3;
    for (const sh of s.shrubs) sh.leaf *= 0.5;
  } else if (act === "hunters") {
    s.bold = HAND;
    for (const b of s.beasts) {
      const k = s.kinds[b.kind]!;
      if (k.feed === "hunt" || k.feed === "small") b.energy = Math.max(b.energy, 0.9);
    }
  } else s.shelter = HAND;
}

/** What each way of the meadow's beasts is worth now: their numbers, the greater counting for more. */
export function meadowWays(s: MeadowState): Map<LifeWay, number> {
  const out = new Map<LifeWay, number>([
    ["grazers", 0],
    ["browsers", 0],
    ["hunters", 0],
  ]);
  for (const b of s.beasts) {
    const k = s.kinds[b.kind]!,
      way = FEEDS[k.feed].way;
    if (way) out.set(way, out.get(way)! + Math.sqrt(k.length));
  }
  return out;
}

/** How much better than the land left alone a way must fare for it to be said to have prospered. */
const PROSPERED = 1.08;

/**
 * Which way fared best under the hand, against the same meadow left alone (`twin`); null where none
 * fared much better than it would have.
 */
export function meadowProspered(s: MeadowState, twin: MeadowState): LifeWay | null {
  const a = meadowWays(s),
    b = meadowWays(twin);
  let best: LifeWay | null = null,
    most = PROSPERED;
  for (const [way, v] of a) {
    const ratio = (v + 1) / (b.get(way)! + 1);
    if (ratio >= most + 1e-9) {
      most = ratio;
      best = way;
    }
  }
  return best;
}

/** What fared best, in words: the way, and how many of it there were against the land left alone. */
export function meadowProsperedWords(
  s: MeadowState,
  twin: MeadowState,
): { way: LifeWay | null; words: string } {
  const way = meadowProspered(s, twin);
  if (!way)
    return {
      way,
      words: `Under your hand no way of age ${s.age + 1}'s beasts fared much better than the land left alone: the ages after are as they would have been.`,
    };
  const n = (m: MeadowState) =>
    m.beasts.filter((b) => FEEDS[m.kinds[b.kind]!.feed].way === way).length;
  return {
    way,
    words: `Under your hand the ${LIFE_WAY_WORDS[way]} of age ${s.age + 1} fared best — ${n(s)} of them, where the land left alone held ${n(twin)} — and the ages after run the more to their kind.`,
  };
}

const LIFE_WAY_WORDS: Readonly<Record<LifeWay, string>> = {
  grazers: "grazers and seed-eaters",
  browsers: "browsers and great beasts",
  hunters: "hunters and those that eat the dead",
};

/** The god's hand on an age's living world, as its buttons say it. */
export const MEADOW_ACT_WORDS: Readonly<Record<MeadowAct, readonly [string, string]>> = {
  green: ["🌿", "Green the land"],
  parch: ["🏜️", "Parch it"],
  hunters: ["🐾", "Hearten the hunters"],
  hunted: ["🛡️", "Shelter the hunted"],
};

/** Follow a beast: it and every young of its line marked (null: none followed). */
export function followBeast(s: MeadowState, id: number | null): void {
  s.chosen = id;
  s.fate = null;
  for (const b of s.beasts) b.marked = b.id === id;
}

/** A followed beast's life, in words: what it is doing, its years, its meals, its young; or how it ended. */
export function followedLife(s: MeadowState): string {
  const line = s.beasts.filter((b) => b.marked).length;
  if (s.chosen === null) return "";
  const b = s.beasts.find((x) => x.id === s.chosen);
  if (!b) {
    const f = s.fate,
      end = !f
        ? "is gone"
        : f.how === "taken"
          ? `was taken by ${f.by ? `a ${f.by}` : "a hunter"}`
          : f.how === "starved"
            ? "starved"
            : "died old";
    return `The one you followed ${end}${line ? `; ${line} of its line live on` : ", and its line with it"}.`;
  }
  const k = s.kinds[b.kind]!;
  return `The ${k.name} you follow is ${b.doing}${b.generation ? `, ${b.generation === 1 ? "a daughter" : `of the ${ordinal(b.generation)} generation`} of the one first followed` : ""}: ${b.meals ? `${b.meals} meal${b.meals === 1 ? "" : "s"} taken, ` : ""}${b.young ? `${b.young} young borne, ` : ""}${b.fled ? `${b.fled} time${b.fled === 1 ? "" : "s"} fled, ` : ""}${Math.round(100 * b.energy)}% fed${line > 1 ? `; ${line} of its line` : ""}.`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** The meadow's lineages and how many of each, in a line. */
export function meadowCounts(s: MeadowState): string {
  const n = counts(s);
  return s.kinds
    .map((k, i) => (n[i] ? `${k.name} ${n[i]}` : ""))
    .filter(Boolean)
    .join(" · ");
}

/** A beast's pose now: its gait by its pace, its head down at the grass, crouched as it stalks. */
export function beastPose(
  s: MeadowState,
  b: Beast,
): { gait: 0 | 1 | 2; phase: number; head: number; crouch: number } {
  const k = s.kinds[b.kind]!;
  return {
    gait: b.speed <= 0.05 ? 0 : b.speed > k.walk * 1.5 ? 2 : 1,
    phase: b.phase * 2 * Math.PI,
    head: b.doing === "grazing" || b.doing === "eating" ? -0.6 : b.doing === "browsing" ? 0.5 : 0.2,
    crouch: b.doing === "chasing" && b.speed <= k.walk * 1.01 ? 0.5 : 0,
  };
}
