// The living world about a village, as the microscope shows it (Phase 8 M77, Phase 9 M85):
// the land's own lineages, each at its place in the web of eating — herds of grazers on the
// open ground, browsers at the wood's edge, great beasts in their few, small game about the
// fields' edges; the hunters that live on them stalking and running at the herds, the small
// hunters after the small game, the scavengers trailing the hunts on foot or circling over
// them; the people's flocks in their pasture; the land's fliers wheeling over the fields and
// its swimmers leaping in the water. Who lives there, how many and whether the hunters raid
// the flocks are the world's (the plan's); where each beast stands and how it moves is a
// look, a pure function of the plan and the screen's clock, so the same moment always looks
// the same and watching never touches what happens.
//
// Every creature is built from its lineage's body (view/creature.ts) of boxes, the art
// track's low-poly, in the same units as a village's people and drawn as much larger than
// life as they are, so a sheep stands knee-high to a herder and a great tusker towers over
// a house.
import { finish, hashString, mix } from "../kernel/index.ts";
import type { VillagePlan } from "../bridge/index.ts";
import type { CreatureBody } from "../rules/index.ts";
import { buildBody, strideOf, type Built, type Pose } from "./creature.ts";
import { dryAt, keepOut, villageGround, type Ground } from "./ground.ts";
import { treesOf } from "./village.ts";
import { travellerAt, type Road } from "./work.ts";

export type Rgb = readonly [number, number, number];

/** Coats by the colour a lineage is named for: the coat, and a pattern over it. */
const COATS: Readonly<Record<string, Rgb>> = {
  dun: [0.7, 0.58, 0.4],
  red: [0.62, 0.31, 0.17],
  grey: [0.54, 0.54, 0.52],
  black: [0.17, 0.16, 0.15],
  pale: [0.88, 0.85, 0.76],
  brindled: [0.5, 0.37, 0.24],
  spotted: [0.84, 0.74, 0.52],
  golden: [0.87, 0.67, 0.28],
};

export type Coat = {
  readonly coat: Rgb;
  /** Its features: manes, tails, muzzles, hooves (and the pattern's marks). */
  readonly dark: Rgb;
  /** Horn, tusk and antler. */
  readonly horn: Rgb;
  readonly pattern: "spots" | "stripes" | null;
};

export function coatOf(name: string, wool: boolean): Coat {
  const word = Object.keys(COATS).find((c) => new RegExp(`\\b${c}\\b`).test(name.toLowerCase())),
    base = COATS[word ?? "dun"]!,
    // Wool is paler than the hide beneath it.
    coat: Rgb = wool ? [base[0] * 0.55 + 0.42, base[1] * 0.55 + 0.4, base[2] * 0.55 + 0.36] : base,
    dark: Rgb =
      word === "black"
        ? [0.07, 0.06, 0.06]
        : [base[0] * 0.38 + 0.02, base[1] * 0.34 + 0.02, base[2] * 0.3 + 0.02];
  return {
    coat,
    dark,
    horn: [0.86, 0.82, 0.7],
    pattern: word === "spotted" ? "spots" : word === "brindled" ? "stripes" : null,
  };
}

/**
 * A body for a lineage whose plan carries none (a plan made before bodies were drawn):
 * four legs, furred, walking — or running, a hunter.
 */
export function defaultBody(niche: string, size: number, wool: boolean): CreatureBody {
  const hunter = niche === "hunter" || niche === "small hunter";
  return {
    symmetry: "bilateral",
    segments: 1,
    legs: 4,
    fins: 0,
    wings: 0,
    covering: wool ? "wool" : "fur",
    size,
    moves: hunter ? "run" : "walk",
    eats: hunter ? "flesh" : "grass",
    level: hunter ? 4 : 2,
    neck: niche === "browser" ? 0.6 : niche === "great beast" ? 0.1 : 0.4,
    tail: 0.4,
    features: niche === "great beast" ? ["tusks", "trunk"] : hunter ? ["claws"] : [],
    warm: true,
  };
}

const unit = (key: number, i: number, j: number) =>
  (finish(mix(mix(key, i), j), 23) >>> 0) / 4294967296;

// —— The herds and their day ——————————————————————————————————————————————————————

export type FaunaSpecies = {
  readonly ref: string;
  readonly name: string;
  readonly niche: string;
  readonly coat: Coat;
  /** Its body, built from its plan (M85). */
  readonly body: Built;
  /** Whether these are the people's own flocks; whether its kind carries and draws. */
  readonly flock: boolean;
  readonly burden: boolean;
  /** Half its length as drawn, in the ground's metres: how far it keeps off walls and others. */
  readonly reach: number;
};

type Herd = {
  readonly species: number;
  readonly home: { x: number; z: number };
  /** Each member's place in the herd, metres from its middle, and its own clock. */
  readonly members: readonly { dx: number; dz: number; period: number; phase: number }[];
  /** How far it runs from the hunters; how far each wanders from its place. */
  readonly flight: number;
  readonly wander: number;
};

type Pack = {
  readonly species: number;
  readonly members: number;
  readonly herd: number;
  readonly period: number;
  readonly offset: number;
  readonly key: number;
  /** A scavenger's band follows another band (its index), for what it leaves; -1 none. */
  readonly follows: number;
};

/** The road's traffic (M78): porters, pack beasts, carts or lorries, by the era and the beasts of burden. */
export type Traffic = {
  readonly kind: "porter" | "pack" | "cart" | "lorry";
  /** The beast that carries or draws (a lineage of the flocks, by its index), else -1. */
  readonly species: number;
  readonly count: number;
  readonly way: Road;
};

/** How fast each kind of traffic goes, metres a second. */
export const TRAFFIC_PACE: Readonly<Record<Traffic["kind"], number>> = {
  porter: 1.25,
  pack: 1.2,
  cart: 1.5,
  lorry: 11,
};

export type Fauna = {
  readonly species: readonly FaunaSpecies[];
  /** The ground's solid things: the water and the homes. */
  readonly ground: Ground;
  readonly herds: readonly Herd[];
  readonly packs: readonly Pack[];
  readonly road: Traffic;
  /** The land's fliers over the village: seed-eaters wheeling low over the fields, scavengers high over the hunts. */
  readonly birds: readonly {
    species: number;
    cx: number;
    cz: number;
    r: number;
    high: number;
    speed: number;
    phase: number;
    big: boolean;
  }[];
  /** The land's swimmers leaping in its water, if it has water. */
  readonly fish: readonly {
    species: number;
    x: number;
    z: number;
    period: number;
    phase: number;
    yaw: number;
  }[];
};

/** What a village's plan says lives about it, as the view needs it (bridge's shape). */
type PlanFauna = NonNullable<VillagePlan["fauna"]>;

/**
 * Lay out the living world about a village: at most `cap` beasts, shared among the flocks
 * (if the people keep any), the herds by how much of the wild still stands, and the hunters
 * by how many the game keeps; `detail` builds their bodies, `ambient` adds the birds and fish.
 */
export function faunaOf(plan: VillagePlan, cap: number, detail: number, ambient: boolean): Fauna {
  const f: PlanFauna = plan.fauna ?? { wild: [], flock: null, raided: false },
    seed = hashString(`fauna ${plan.ref}`),
    u = (i: number, j: number) => unit(seed, i, j),
    species: FaunaSpecies[] = [],
    herds: Herd[] = [],
    packs: Pack[] = [];
  const speciesOf = (
    s: {
      ref: string;
      name: string;
      niche: string;
      size: number;
      wool: boolean;
      body?: unknown;
    },
    flock: boolean,
  ) => {
    const coat = coatOf(s.name, s.wool),
      plan = (s.body as CreatureBody | null | undefined) ?? defaultBody(s.niche, s.size, s.wool),
      body = buildBody(plan, detail, coat.pattern, hashString(s.ref));
    species.push({
      ref: s.ref,
      name: s.name,
      niche: s.niche,
      coat,
      body,
      reach: (body.length * body.k) / M / 2,
      flock,
      // A big four-legged grazer carries and draws (a horse, an ox, a camel).
      burden:
        s.niche === "grazer" &&
        plan.legs >= 4 &&
        plan.size >= 150 &&
        (plan.moves === "walk" || plan.moves === "run"),
    });
    return species.length - 1;
  };
  // The open ground the herds keep to: away from the fields' side, beyond the homes.
  let fx = 0,
    fz = 0;
  for (const fl of plan.fields) {
    fx += fl.x;
    fz += fl.z;
  }
  // Between the homes and the wild's edge, where they can be seen from the village.
  let homes = 40;
  for (const h of plan.homes) homes = Math.max(homes, Math.hypot(h.x, h.z));
  const fieldWay = plan.fields.length ? Math.atan2(fz, fx) : 0,
    near = homes + 60,
    far = Math.max(near + 120, plan.wild + 60),
    // Browsers keep to the woods: a tree near the ring, where there are trees.
    ground = villageGround(plan),
    woods = treesOf(plan).filter((t) => {
      const r = Math.hypot(t.x, t.z);
      return r > near && r < far + 150 && t.kind !== "shrub" && dryAt(ground, t.x, t.z, 150);
    }),
    // Clear of the pasture, and far enough from the water that no run takes a herd into it.
    clearOfPasture = (x: number, z: number) =>
      Math.hypot(x - plan.pasture.x, z - plan.pasture.z) > plan.pasture.r + 45 &&
      dryAt(ground, x, z, 150);
  let budget = cap,
    flockIndex = -1;
  // The flocks, in their pasture: as many as their herders keep, to a third of what is drawn.
  if (f.flock && f.flock.herders > 0) {
    const n = Math.max(3, Math.min(Math.round(cap * 0.35), Math.round(f.flock.herders * 6)));
    const sp = (flockIndex = speciesOf({ ...f.flock, niche: "grazer" }, true));
    herds.push({
      species: sp,
      home: { x: plan.pasture.x, z: plan.pasture.z },
      members: membersOf(
        n,
        Math.min(plan.pasture.r * 0.7, Math.max(8 + 4 * Math.sqrt(n), room(sp, n))),
        0,
      ),
      flight: 40,
      wander: wanderOf(sp),
    });
    budget -= n;
  }
  // The hunters, as many as the game keeps: a pair or three of each lineage.
  const moves = (s: PlanFauna["wild"][number]) => s.body?.moves ?? "walk",
    hunters = f.wild.filter((s) => s.niche === "hunter" && s.stock > 0.08),
    prey = f.wild.filter(
      (s) =>
        (s.niche === "grazer" || s.niche === "browser" || s.niche === "great beast") &&
        s.stock > 0.05,
    ),
    smallGame = f.wild.filter(
      (s) => s.niche === "seed-eater" && moves(s) !== "fly" && s.stock > 0.05,
    ),
    lesser = f.wild.filter((s) => s.niche === "small hunter" && s.stock > 0.08),
    walkingScavengers = f.wild.filter(
      (s) => s.niche === "scavenger" && moves(s) !== "fly" && s.stock > 0.08,
    ),
    fliers = f.wild.filter(
      (s) => (s.niche === "seed-eater" || s.niche === "scavenger") && moves(s) === "fly",
    ),
    swimmers = f.wild.filter((s) => s.niche === "swimmer" && s.stock > 0.05);
  const hunterShare = hunters.reduce((a, s) => a + Math.min(3, 1 + Math.round(s.stock * 2)), 0);
  budget -= Math.min(hunterShare, Math.round(cap * 0.1));
  // The small game and those that live after the hunts take shares of their own.
  const smallShare =
      smallGame.length && plan.fields.length ? Math.max(3, Math.round(cap * 0.12)) : 0,
    followShare =
      lesser.length + walkingScavengers.length ? Math.max(1, Math.round(cap * 0.05)) : 0;
  let followLeft = followShare;
  budget -= smallShare + followShare;
  // The wild herds, by lineage: grazers in herds, browsers in small bands, great beasts few.
  const weight = (s: PlanFauna["wild"][number]) =>
    s.stock * (s.niche === "grazer" ? 1 : s.niche === "browser" ? 0.5 : 0.22);
  const total = prey.reduce((a, s) => a + weight(s), 0);
  prey.forEach((s, i) => {
    const want = total > 0 ? Math.round((Math.max(0, budget) * weight(s)) / total) : 0,
      band = s.niche === "grazer" ? 14 : s.niche === "browser" ? 5 : 4,
      n = Math.max(s.niche === "great beast" ? 1 : 2, Math.min(want, band * 3));
    if (want < 1) return;
    const sp = speciesOf(s, false);
    for (let left = n, h = 0; left > 0; h++) {
      const size = Math.min(left, band),
        tree =
          s.niche === "browser" && woods.length
            ? woods[Math.floor(u(30 + i, h) * woods.length)]!
            : null;
      let a = fieldWay + 1.1 + (2 * Math.PI - 2.2) * u(10 + i, h),
        r = near + (far - near) * u(20 + i, h);
      // (Turned about the village until clear; nearer in, where the water is all about.)
      for (let turn = 0; turn < 24 && !clearOfPasture(r * Math.cos(a), r * Math.sin(a)); turn++) {
        a += 0.5;
        if (turn % 12 === 11) r = near + (r - near) * 0.5;
      }
      if (tree) {
        a = Math.atan2(tree.z, tree.x);
        r = Math.hypot(tree.x, tree.z);
      }
      herds.push({
        species: sp,
        home: { x: r * Math.cos(a), z: r * Math.sin(a) },
        members: membersOf(
          size,
          Math.max(6 + 3.5 * Math.sqrt(size) * (s.niche === "great beast" ? 2 : 1), room(sp, size)),
          100 * i + h,
        ),
        flight: s.niche === "great beast" ? 40 : 85,
        wander: wanderOf(sp),
      });
      left -= size;
    }
  });
  // Each hunting band hunts the herd nearest its own ground — or, where the hunters raid
  // the flocks, the flock.
  hunters.forEach((s, i) => {
    const sp = speciesOf(s, false),
      bands = s.stock > 0.7 && herds.length > 2 ? 2 : 1;
    for (let b = 0; b < bands; b++) {
      const wildHerds = herds.map((h, k) => ({ h, k })).filter((x) => !species[x.h.species]!.flock),
        flock = herds.findIndex((h) => species[h.species]!.flock),
        target =
          f.raided && flock >= 0 && b === 0
            ? flock
            : (wildHerds[Math.floor(u(40 + i, b) * wildHerds.length)]?.k ?? flock);
      if (target < 0) continue;
      packs.push({
        species: sp,
        members: Math.min(3, 1 + Math.round(s.stock * 1.6)),
        herd: target,
        period: 70 + 40 * u(50 + i, b),
        offset: 1000 * u(60 + i, b),
        key: hashString(`${s.ref} ${b}`),
        follows: -1,
      });
    }
  });
  // Small game about the fields' edges, pecking at what the harvest leaves.
  smallGame.forEach((s, i) => {
    let left =
      Math.floor(smallShare / smallGame.length) + (i < smallShare % smallGame.length ? 1 : 0);
    if (left < 1) return;
    const sp = speciesOf(s, false),
      bands = Math.min(3, 1 + Math.round(s.stock * 2));
    for (let b = 0; b < bands && left > 0; b++) {
      const fl = plan.fields[Math.floor(u(110 + i, b) * plan.fields.length)]!,
        size = Math.min(left, 3 + Math.floor(5 * u(113 + i, b)));
      left -= size;
      herds.push({
        species: sp,
        home: {
          x: fl.x + (u(111 + i, b) - 0.5) * fl.w,
          z: fl.z + (u(112 + i, b) - 0.5) * fl.d,
        },
        members: membersOf(size, Math.max(7, room(sp, size)), 300 + 10 * i + b),
        flight: 22,
        wander: wanderOf(sp),
      });
    }
  });
  // The small hunters, after the small game (or the game's young, where there is none).
  lesser.forEach((s, i) => {
    const members = 1 + (s.stock > 0.7 ? 1 : 0);
    if (members > followLeft) return;
    followLeft -= members;
    const sp = speciesOf(s, false),
      small = herds
        .map((h, k) => ({ h, k }))
        .filter((x) => species[x.h.species]!.niche === "seed-eater"),
      any = herds.map((h, k) => ({ h, k })).filter((x) => !species[x.h.species]!.flock),
      pool = small.length ? small : any,
      target = pool[Math.floor(u(120 + i, 0) * pool.length)]?.k ?? -1;
    if (target < 0) return;
    packs.push({
      species: sp,
      members,
      herd: target,
      period: 45 + 30 * u(121 + i, 0),
      offset: 1000 * u(122 + i, 0),
      key: hashString(`${s.ref} lesser`),
      follows: -1,
    });
  });
  // The scavengers on foot, trailing a band of hunters for what it leaves.
  walkingScavengers.forEach((s, i) => {
    const bands = packs
        .map((p, k) => ({ p, k }))
        .filter((x) => species[x.p.species]!.niche === "hunter"),
      after = bands[Math.floor(u(130 + i, 0) * bands.length)],
      members = Math.min(followLeft, 1 + Math.floor(2 * u(131 + i, 0)));
    if (!after || members < 1) return;
    followLeft -= members;
    const sp = speciesOf(s, false);
    packs.push({
      species: sp,
      members,
      herd: after.p.herd,
      period: after.p.period,
      offset: after.p.offset,
      key: hashString(`${s.ref} trailing`),
      follows: after.k,
    });
  });
  // Life in the air and the water — the land's own: its seed-eaters wheeling low over the
  // fields, its scavengers high over the hunts, its swimmers leaping in the water.
  const birds: Fauna["birds"][number][] = [];
  if (ambient)
    fliers.forEach((s, i) => {
      const sp = speciesOf(s, false),
        scavenger = s.niche === "scavenger",
        hunted = herds.find((h, k) => packs.some((p) => p.herd === k && p.follows < 0)),
        n = scavenger
          ? 1 + Math.floor(2 * s.stock)
          : Math.max(2, Math.min(14, Math.round((cap / 12) * Math.min(1, s.stock)))),
        cx = scavenger && hunted ? hunted.home.x : plan.fields[0] ? plan.fields[0].x * 0.6 : 60,
        cz = scavenger && hunted ? hunted.home.z : plan.fields[0] ? plan.fields[0].z * 0.6 : 40;
      for (let k = 0; k < n; k++)
        birds.push({
          species: sp,
          cx: cx + (scavenger ? 0 : (u(70 + i, k) - 0.5) * 20),
          cz: cz + (scavenger ? 0 : (u(71 + i, k) - 0.5) * 20),
          r: scavenger ? 50 + 30 * u(72 + i, k) : 30 + 25 * u(72 + i, k),
          high: scavenger ? 55 + 15 * u(73 + i, k) : 16 + 12 * u(73 + i, k),
          speed: scavenger ? 0.08 + 0.03 * u(74 + i, k) : 0.22 + 0.05 * u(74 + i, k),
          phase: scavenger ? (2 * Math.PI * k) / n : 0.35 * k + u(75 + i, k) * 0.3,
          big: scavenger,
        });
    });
  const fish: Fauna["fish"][number][] = [];
  if (ambient && plan.water)
    swimmers.forEach((s, i) => {
      const sp = speciesOf(s, false),
        n = Math.max(1, Math.min(6, Math.round(4 * s.stock)));
      for (let k = 0; k < n; k++) {
        const a = u(80 + i, k) * 2 * Math.PI,
          r = 150 * Math.sqrt(u(81 + i, k));
        fish.push({
          species: sp,
          x: plan.water!.x + r * Math.cos(a),
          z: plan.water!.z + r * Math.sin(a),
          period: 7 + 9 * u(82 + i, k),
          phase: u(83 + i, k),
          yaw: u(84 + i, k) * 2 * Math.PI,
        });
      }
    });
  // The road's traffic: lorries in the modern world, carts in the engines' age, pack beasts
  // where the flocks carry, porters otherwise (a market town's road busier).
  const burden = flockIndex >= 0 && species[flockIndex]!.burden ? flockIndex : -1,
    busy = Math.min([1, 2, 4, 6][detail] ?? 2, plan.market ? 6 : 3),
    kind: Traffic["kind"] =
      plan.era === "modern"
        ? "lorry"
        : plan.era === "industry"
          ? "cart"
          : plan.era !== "forage" && burden >= 0
            ? "pack"
            : "porter",
    road: Traffic = {
      kind,
      species: kind === "pack" || kind === "cart" ? burden : -1,
      count: plan.era === "forage" ? Math.min(1, busy) : busy,
      way: { ref: plan.ref, to: plan.road },
    };
  return { species, ground, herds, packs, road, birds, fish };

  /** How wide a herd of `n` must be for its beasts to stand apart (a body and a half each). */
  function room(sp: number, n: number): number {
    return 3 * species[sp]!.reach * 0.564 * Math.sqrt(n);
  }
  function wanderOf(sp: number): number {
    return Math.min(4.5, 0.6 * species[sp]!.reach);
  }

  function membersOf(n: number, radius: number, key: number): Herd["members"] {
    return Array.from({ length: n }, (_, m) => {
      const a = m * 2.399963 + u(90 + key, m),
        r = radius * Math.sqrt((m + 0.5) / n);
      return {
        dx: r * Math.cos(a),
        dz: r * Math.sin(a),
        period: 13 + 9 * u(91 + key, m),
        phase: u(92 + key, m),
      };
    });
  }
}

/** What a beast is doing, in words, from how it holds itself now (and its work, if it has one). */
export function doingOf(sp: FaunaSpecies, pose: Pose, task: 0 | 1 | 2 = 0): string {
  if (task === 1) return "carrying packs along the road";
  if (task === 2) return "drawing a cart along the road";
  if (sp.niche === "hunter")
    return pose.gait === 2
      ? "running at the herd"
      : pose.crouch > 0
        ? "stalking the herd"
        : pose.gait
          ? "prowling"
          : "resting after the chase";
  if (sp.niche === "small hunter")
    return pose.gait === 2
      ? "darting at small game"
      : pose.crouch > 0
        ? "creeping up on small game"
        : pose.gait
          ? "slinking about the fields' edges"
          : "waiting, watching";
  if (sp.niche === "scavenger")
    return sp.body.plan.moves === "fly"
      ? "circling over the hunt"
      : pose.gait
        ? "trailing the hunters for what they leave"
        : pose.head > 0.5
          ? "feeding where the hunters killed"
          : "watching the hunt from afar";
  if (sp.niche === "swimmer") return "leaping from the water";
  if (sp.niche === "seed-eater" && sp.body.plan.moves === "fly") return "wheeling over the fields";
  if (sp.niche === "seed-eater" && pose.gait !== 2)
    return pose.gait ? "hopping about" : "pecking at the fields";
  if (pose.gait === 2) return "running from the hunters";
  if (pose.gait) return sp.flock ? "moving with the flock" : "wandering with the herd";
  if (pose.head < 0.5) return "watching, head up";
  return sp.flock
    ? "grazing in the pasture"
    : sp.niche === "browser"
      ? "browsing at the wood's edge"
      : "grazing";
}

/** A beast where it is now: metres from the village's middle, facing `yaw`, holding `pose`. */
export type BeastNow = {
  species: number;
  x: number;
  z: number;
  yaw: number;
  pose: Pose;
  /** Its work (M78): 0 none, 1 carrying packs on the road, 2 drawing a cart. */
  task: 0 | 1 | 2;
};

/** How far off the hunt a band that lives after it waits (metres from the herd). */
const WATCH = 70;

/** Metres to a village's drawn units. */
const M = 0.1;

/**
 * Push the beasts `from` … `to` of `out` apart where they stand nearer than `room` (each
 * half the way): a herd's beasts never stand in one another.
 */
function apart(out: BeastNow[], from: number, to: number, room: number): void {
  for (let a = from; a < to; a++)
    for (let b = a + 1; b < to; b++) {
      const p = out[a]!,
        q = out[b]!,
        dx = q.x - p.x,
        dz = q.z - p.z,
        d2 = dx * dx + dz * dz;
      if (d2 >= room * room || d2 < 1e-12) continue;
      const d = Math.sqrt(d2),
        push = (room - d) / 2 / d;
      p.x -= dx * push;
      p.z -= dz * push;
      q.x += dx * push;
      q.z += dz * push;
    }
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Where every beast is at screen time `s` (seconds), written into `out` (reused; returns how
 * many). Herds graze and wander a little, each beast on its own clock; a hunting band
 * prowls, stalks its herd, and runs at it; the herd lifts its heads, then flees, and drifts
 * back to its grazing when the hunters have given up.
 */
export function beastsAt(fauna: Fauna, s: number, out: BeastNow[]): number {
  let n = 0;
  const next = (): BeastNow => {
    const o =
      out[n] ??
      (out[n] = {
        species: 0,
        x: 0,
        z: 0,
        yaw: 0,
        pose: { gait: 0, phase: 0, head: 0, crouch: 0 },
        task: 0,
      });
    o.task = 0;
    return o;
  };
  // Each herd's middle drifts on a slow loop; the hunters' runs push it away and it comes back.
  const drift = (i: number, t: number) => {
    const h = fauna.herds[i]!,
      w = 0.021 + 0.004 * (i % 3),
      r = species(h).flock ? 6 : 26;
    return {
      x: h.home.x + r * Math.cos(t * w + i),
      z: h.home.z + r * Math.sin(t * w * 0.8 + 2 * i),
    };
  };
  const middles = fauna.herds.map((_, i) => ({
    ...drift(i, s),
    fx: 0,
    fz: 0,
    alert: 0,
    running: false,
  }));
  function species(h: Herd) {
    return fauna.species[h.species]!;
  }
  // The hunts: where each band is, and how its herd answers; a band that lives after
  // another's hunts watches them from afar and comes in to the kill when they have gone.
  const bands = fauna.packs.map((p) => {
    if (p.follows >= 0) return { p, ...trailAt(fauna.packs[p.follows]!, s) };
    const b = bandAt(p, s),
      h = fauna.herds[p.herd]!,
      herd = middles[p.herd]!,
      // The herd: heads up as the hunters creep in, away at the run, back as they rest.
      phi = b.phi,
      flee = b.angle + Math.PI,
      away = phi < 0.72 ? 0 : phi < 0.86 ? smooth(0.72, 0.86, phi) : 1 - (phi - 0.86) / 0.54,
      lastAway = phi < 0.4 ? Math.max(0, 1 - (phi + 0.14) / 0.54) : 0,
      last = b.last + Math.PI;
    herd.fx += h.flight * (away * Math.cos(flee) + lastAway * Math.cos(last));
    herd.fz += h.flight * (away * Math.sin(flee) + lastAway * Math.sin(last));
    // (Alarm comes over a herd, and leaves it, over a few seconds.)
    herd.alert = Math.max(herd.alert, smooth(0.5, 0.58, phi) * (1 - smooth(0.86, 0.95, phi)));
    herd.running = herd.running || (phi >= 0.72 && phi < 0.86);
    return { p, ...b };
  });
  /**
   * Where a band that lives after the hunts of `lead` is at time `t0`: waiting off to the
   * side of the hunt (the side the hunters will not prowl next), in at the kill once they
   * have left it, feeding, then off to watch the next.
   */
  function trailAt(lead: Pack, t0: number) {
    const t = t0 + lead.offset,
      cycle = Math.floor(t / lead.period),
      phi = t / lead.period - cycle,
      herd = drift(lead.herd, t0),
      angle = (c: number) => unit(lead.key, c, 7) * 2 * Math.PI,
      kill = (c: number) => ({
        x: herd.x - 18 * Math.cos(angle(c)),
        z: herd.z - 18 * Math.sin(angle(c)),
      }),
      watch = (c: number) => {
        const a = angle(c),
          next = angle(c + 1),
          off = (x: number) => Math.abs(Math.atan2(Math.sin(x - next), Math.cos(x - next))),
          w = a + (off(a + Math.PI / 2) >= off(a - Math.PI / 2) ? 1 : -1) * (Math.PI / 2);
        return { x: herd.x + WATCH * Math.cos(w), z: herd.z + WATCH * Math.sin(w) };
      },
      go = (from: { x: number; z: number }, to: { x: number; z: number }, a: number, b: number) => {
        const k = smooth(a, b, phi),
          far = Math.hypot(to.x - from.x, to.z - from.z);
        return {
          x: from.x + (to.x - from.x) * k,
          z: from.z + (to.z - from.z) * k,
          gait: (far / ((b - a) * lead.period) > 2.5 ? 2 : 1) as 0 | 1 | 2,
          crouch: 0,
          head: 0.3,
          yaw: Math.atan2(to.x - from.x, to.z - from.z),
        };
      },
      still = (at: { x: number; z: number }, head: number) => ({
        ...at,
        gait: 0 as 0 | 1 | 2,
        crouch: 0,
        head,
        yaw: Math.atan2(herd.x - at.x, herd.z - at.z),
      });
    const b =
      phi < 0.1
        ? still(watch(cycle - 1), 0)
        : phi < 0.25
          ? go(watch(cycle - 1), kill(cycle - 1), 0.1, 0.25)
          : phi < 0.45
            ? still(kill(cycle - 1), 1)
            : phi < 0.7
              ? go(kill(cycle - 1), watch(cycle), 0.45, 0.7)
              : still(watch(cycle), 0);
    return { ...b, phi, angle: angle(cycle), last: angle(cycle - 1) };
  }

  /** Where a band is at time `t` and how it holds itself, in its hunt's round. */
  function bandAt(p: Pack, t0: number) {
    const t = t0 + p.offset,
      cycle = Math.floor(t / p.period),
      phi = t / p.period - cycle,
      herd = drift(p.herd, t0),
      angle = (c: number) => unit(p.key, c, 7) * 2 * Math.PI,
      a = angle(cycle),
      out = (c: number, d: number) => ({
        x: herd.x + d * Math.cos(angle(c)),
        z: herd.z + d * Math.sin(angle(c)),
      }),
      // The run ends short of where the herd fled to: it got away.
      end = (c: number) => ({
        x: herd.x - 18 * Math.cos(angle(c)),
        z: herd.z - 18 * Math.sin(angle(c)),
      }),
      prowl = out(cycle, 115),
      stalk = out(cycle, 42);
    let x: number,
      z: number,
      gait: 0 | 1 | 2,
      crouch: number,
      head: number,
      yaw: number | null = null;
    if (phi < 0.5) {
      const from = end(cycle - 1),
        k = smooth(0, 0.5, phi);
      x = from.x + (prowl.x - from.x) * k;
      z = from.z + (prowl.z - from.z) * k;
      gait = phi > 0.04 && phi < 0.48 ? 1 : 0;
      crouch = 0;
      head = 0.3;
      // (Prowling, they face the way they go.)
      yaw = Math.atan2(prowl.x - from.x, prowl.z - from.z);
    } else if (phi < 0.72) {
      const k = smooth(0.5, 0.72, phi);
      x = prowl.x + (stalk.x - prowl.x) * k;
      z = prowl.z + (stalk.z - prowl.z) * k;
      gait = 1;
      crouch = 1;
      head = 0.5;
    } else if (phi < 0.84) {
      const e = end(cycle),
        k = smooth(0.72, 0.84, phi);
      x = stalk.x + (e.x - stalk.x) * k;
      z = stalk.z + (e.z - stalk.z) * k;
      gait = 2;
      crouch = 0;
      head = 0.2;
    } else {
      const e = end(cycle);
      x = e.x;
      z = e.z;
      gait = 0;
      crouch = 0;
      head = 0.7;
    }
    return {
      x,
      z,
      gait,
      crouch,
      head,
      // Facing the herd while they close on it; the way they walk while they prowl.
      yaw: yaw ?? Math.atan2(herd.x - x, herd.z - z),
      phi,
      angle: a,
      last: angle(cycle - 1),
    };
  }
  // The herds' beasts.
  fauna.herds.forEach((h, i) => {
    const m = middles[i]!,
      sp = species(h),
      stride = strideOf(sp.body),
      first = n;
    h.members.forEach((b, j) => {
      const t = s / b.period + b.phase,
        c = Math.floor(t),
        f = t - c,
        spot = (q: number) => ({
          x: b.dx + (unit(h.species * 977 + i, j, q) - 0.5) * 2 * h.wander,
          z: b.dz + (unit(h.species * 977 + i, j + 500, q) - 0.5) * 2 * h.wander,
        }),
        a = spot(c),
        z2 = spot(c + 1),
        k = smooth(0.7, 1, f),
        // (Alarmed, a herd bunches together.)
        tight = 1 - 0.35 * m.alert,
        x = m.x + m.fx + (a.x + (z2.x - a.x) * k) * tight,
        z = m.z + m.fz + (a.z + (z2.z - a.z) * k) * tight,
        o = next();
      o.species = h.species;
      o.x = x;
      o.z = z;
      if (m.running) {
        o.yaw = Math.atan2(m.fx, m.fz);
        o.pose.gait = 2;
        o.pose.head = 0;
      } else {
        o.yaw = Math.atan2(z2.x - a.x, z2.z - a.z);
        o.pose.gait = f > 0.72 && f < 0.98 ? 1 : 0;
        o.pose.head = m.alert > 0.5 ? 0 : o.pose.gait ? 0.25 : 1;
      }
      o.pose.crouch = 0;
      o.pose.phase = s * stride * (o.pose.gait === 2 ? 2.2 : 1) * 2 * Math.PI + j * 1.3;
      n++;
    });
    // Each keeps its body's room from the others, and out of the water and the homes.
    apart(out, first, n, sp.reach * 1.7);
    for (let j = first; j < n; j++) keepOut(fauna.ground, out[j]!, sp.reach);
  });
  // The hunters, a few paces apart, facing their way; the scavengers on their track.
  bands.forEach((b, i) => {
    const sp = fauna.species[b.p.species]!,
      toward = b.yaw;
    for (let j = 0; j < b.p.members; j++) {
      // Each keeps its own place in the band (fixed on the ground, so a turn is no jump).
      const o = next(),
        a = j * 2.399963 + unit(b.p.key, j, 9) * 6.283,
        r = j ? 6 + 2 * j : 0;
      o.species = b.p.species;
      o.x = b.x + r * Math.cos(a);
      o.z = b.z + r * Math.sin(a);
      keepOut(fauna.ground, o, sp.reach);
      o.yaw = toward;
      o.pose.gait = b.gait;
      o.pose.crouch = b.crouch;
      o.pose.head = b.head;
      o.pose.phase = s * strideOf(sp.body) * (b.gait === 2 ? 2.4 : 1) * 2 * Math.PI + i + j * 1.7;
      n++;
    }
  });
  // The beasts of the road's traffic, a few paces ahead of what they carry or draw.
  const road = fauna.road;
  if (road.species >= 0) {
    const sp = fauna.species[road.species]!,
      lead = road.kind === "cart" ? 6 : 3.5;
    for (let k = 0; k < road.count; k++) {
      const t = travellerAt(road.way, k, s, TRAFFIC_PACE[road.kind]),
        o = next();
      o.species = road.species;
      o.x = t.x + Math.sin(t.yaw) * lead;
      o.z = t.z + Math.cos(t.yaw) * lead;
      o.yaw = t.yaw;
      o.pose.gait = 1;
      o.pose.head = 0.2;
      o.pose.crouch = 0;
      o.pose.phase = s * strideOf(sp.body) * 2 * Math.PI + k * 2.1;
      o.task = road.kind === "cart" ? 2 : 1;
      n++;
    }
  }
  return n;
}

/** A bird now: where (metres), how high, which way, and its wings' beat (radians). */
export type BirdNow = {
  species: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  wing: number;
  /** Riding the air on still wings. */
  glide: boolean;
  big: boolean;
};

export function birdsAt(fauna: Fauna, s: number, out: BirdNow[]): number {
  fauna.birds.forEach((b, i) => {
    const a = s * b.speed + b.phase,
      o =
        out[i] ??
        (out[i] = { species: 0, x: 0, y: 0, z: 0, yaw: 0, wing: 0, glide: false, big: false });
    o.species = b.species;
    o.x = b.cx + b.r * Math.cos(a);
    o.z = b.cz + b.r * Math.sin(a);
    o.y = b.high + 3 * Math.sin(s * 0.5 + i);
    // Flying the circle's way (counter-clockwise seen from above).
    o.yaw = Math.atan2(-Math.sin(a), Math.cos(a));
    // Beating, then gliding a while: the big birds mostly glide.
    const beat = Math.sin(s * (b.big ? 3 : 9) + i * 1.9),
      glide = Math.sin(s * 0.7 + i) > (b.big ? -0.2 : 0.4);
    o.wing = glide ? 0.12 : 0.6 * beat;
    o.glide = glide;
    o.big = b.big;
  });
  return fauna.birds.length;
}

/** A fish now, if it is in the air: where (metres), how high, which way, its tip. */
export type FishNow = {
  species: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
};

export function fishAt(fauna: Fauna, s: number, out: FishNow[]): number {
  let n = 0;
  for (const f of fauna.fish) {
    const t = s / f.period + f.phase,
      c = Math.floor(t),
      // A leap takes a tenth of its while; the rest of the time it is under the water.
      q = (t - c) / 0.1;
    if (q >= 1) continue;
    const o = out[n] ?? (out[n] = { species: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }),
      yaw = f.yaw + c * 2.1,
      d = (q - 0.5) * 6;
    o.species = f.species;
    o.x = f.x + d * Math.sin(yaw);
    o.z = f.z + d * Math.cos(yaw);
    o.y = 5 * q * (1 - q);
    o.yaw = yaw;
    o.pitch = (q - 0.5) * 2.2 + Math.PI / 2;
    n++;
  }
  return n;
}
