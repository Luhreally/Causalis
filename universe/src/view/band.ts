// A band watched (Phase 28 M158): the first people's band on the land of the last age, seen up
// close — the peopling's near view, the tribal stage of a world's beginning. They camp about a
// fire, their shelters round it. By day the grown go out to gather from the woods and the grass
// and to hunt the age's beasts — a few together, creeping near, then running one down and spearing
// it — and come home laden; the children play about the fire and the old tend it; at dusk all come
// in, and by night they sleep about it. When the land about the camp is eaten bare they pack up and
// walk on to camp on fresh ground: the bands going out over the land, one band seen near. Pure, and
// the same for the same land and seed.
import type { CampCraft } from "../bridge/index.ts";
import { MEADOW_H, MEADOW_STEP, MEADOW_W, type Beast, type MeadowState } from "./meadow.ts";

/** A day of the band's, in seconds of the meadow's time. */
export const BAND_DAY = 120;
/** The hours they are out (dawn to dusk), and asleep. */
const RISE = 6.5,
  OUT = 7.5,
  HOME = 18,
  SLEEP = 20.5;
/** How fast they walk and run (m/s, as the meadow's beasts are drawn). */
const WALK = 2.6,
  RUN = 6.2;
/**
 * A body's room on a ring about the fire, and how far each ring lies past the one inside it (m):
 * drawn larger than life, as the meadow's beasts are, a band many to a fire stands in rings, not
 * shoulder to shoulder in one.
 */
const ROOM = 2.1,
  ROW = 2.6;

/** The i-th of n's place in rings about a fire: as many on the first ring as it has room for, the rest farther out, each ring's seats set between those of the ring inside. */
function ringOf(i: number, n: number): { row: number; a: number } {
  for (let row = 0, first = 0; ; row++) {
    const here = Math.min(
      Math.max(1, Math.floor((2 * Math.PI * (3.2 + ROW * row)) / ROOM)),
      n - first,
    );
    if (i < first + here) return { row, a: (2 * Math.PI * (i - first + (row % 2) * 0.5)) / here };
    first += here;
  }
}

/** Where one sits about a fire (the camp's, or the fresh ground's): on their ring, the first `from` out. */
function seatOf(b: BandState, p: BandPerson, from: number, at = b.camp): { x: number; z: number } {
  const r = (from + ROW * p.row) * b.spread;
  return { x: at.x + Math.sin(p.seat) * r, z: at.z + Math.cos(p.seat) * r };
}
/** How far from the camp they go to gather and to hunt (m). */
const GATHER_REACH = 46,
  HUNT_REACH = 64;

export type BandKin = "grown" | "child" | "old";
export type BandDoing =
  | "resting"
  | "sleeping"
  | "walking"
  | "gathering"
  | "carrying"
  | "stalking"
  | "chasing"
  | "butchering"
  | "playing"
  | "tending"
  | "moving"
  // Their crafts (Phase 49 M211): stone knapped into blades and points; fibre twisted into cord; a
  // point bound to its shaft; a hide scraped on its frame, and sewn; ochre ground; fire made.
  | "knapping"
  | "cording"
  | "hafting"
  | "scraping"
  | "sewing"
  | "grinding"
  | "kindling";

/** The crafts, as what they are at. */
export const CRAFT_DOINGS: readonly BandDoing[] = [
  "knapping",
  "cording",
  "hafting",
  "scraping",
  "sewing",
  "grinding",
  "kindling",
];

/**
 * What a band makes its things of, and how (Phase 49 M211, asked for 2026-10-25: "bring back og
 * causlaiss like primitve crafting"): from the ground its camp stands on and the land about it.
 */
export type BandCraft = CampCraft;

/** A band's crafts where nothing is known of its ground (the creature stage's first people). */
export const PLAIN_CRAFT: BandCraft = {
  stone: {
    name: "flint",
    from: "cobbles from the stream",
    keen: 0.85,
    tough: 0.55,
    colour: [0.42, 0.38, 0.34],
  },
  wood: "ash",
  fibre: "bark",
  binding: "sinew",
  pigment: { name: "red ochre", colour: [0.62, 0.2, 0.12] },
  fire: "bow drill",
};

/** A band's things (Phase 49 M211): what they have made and keep, and the work ground's waste. */
export type BandKit = {
  /** Spears hafted; points knapped, waiting for a shaft; blades and scrapers. */
  spears: number;
  points: number;
  blades: number;
  /** Cord, in arm-spans. */
  cord: number;
  /** Hides come in from the kills, scraped, and sewn into cloaks and bags. */
  hides: number;
  scraped: number;
  cloaks: number;
  /** Handfuls of ground colour. */
  ochre: number;
  /** The flakes struck off about the work ground. */
  flakes: number;
};

/** What one of them is making, and how long it has had. */
export type Making = {
  readonly doing: BandDoing;
  /** What comes of it ("a point", "a blade", "cord", …). */
  readonly what: "point" | "blade" | "cord" | "spear" | "hide" | "cloak" | "ochre" | "fire";
  /** The beast a hide being scraped was ("" not known). */
  readonly of?: string;
  done: number;
};

export type BandPerson = {
  readonly id: number;
  /** Their name, in their land's tongue (Phase 29 M161; empty where none was given). */
  readonly name: string;
  readonly kin: BandKin;
  /** Goes out to hunt, when grown (else to gather). */
  readonly hunter: boolean;
  x: number;
  z: number;
  heading: number;
  speed: number;
  doing: BandDoing;
  /** The shrub it gathers from (-1 none); the grass cell, if it digs roots instead. */
  target: number;
  timer: number;
  /** What it brings home: an armful of what was gathered, meat, or the camp packed. */
  carry: number;
  carrying: "food" | "meat" | "bundle" | null;
  /** Its place about the fire (an angle, and which ring out from it), and where its legs are in their stride. */
  readonly seat: number;
  readonly row: number;
  phase: number;
  /** What it is making (Phase 49 M211; null: nothing now). */
  making: Making | null;
};

export type BandState = {
  /** The people's name, as the world calls them. */
  readonly name: string;
  people: BandPerson[];
  camp: { x: number; z: number };
  /** The fresh ground they walk to, packed up (null: camped). */
  going: { x: number; z: number } | null;
  shelters: { x: number; z: number; yaw: number }[];
  /** Days of food in store for the band. */
  food: number;
  /** Seconds into the day (0 at midnight), and the days gone. */
  clock: number;
  day: number;
  /** Days at this camp; camps made; hunts gone out on, beasts taken; armfuls gathered. */
  here: number;
  camps: number;
  hunts: number;
  kills: number;
  gathered: number;
  /** The beast the hunters are after (its id; -1 none), how long they have run it, and the kill being cut. */
  quarry: number;
  chase: number;
  /** Hunts gone out on today. */
  tries: number;
  /** The kill being cut up: where, how much of it is left, what it was (its kind on the meadow), so many days' food, how long it lies (m). */
  kill: {
    x: number;
    z: number;
    meat: number;
    name: string;
    kind: number;
    worth: number;
    length: number;
    yaw: number;
  } | null;
  /** What came to pass, to be told. */
  news: string[];
  /**
   * Their crafts (Phase 49 M211): what they make their things of; what they keep; whether the
   * fire is made at this camp yet; the work ground by the fire where they sit at them, and the
   * frame a hide is stretched on; the beasts the hides waiting for it were, first in first.
   */
  readonly craft: BandCraft;
  kit: BandKit;
  lit: boolean;
  work: { x: number; z: number };
  frame: { x: number; z: number; yaw: number };
  hidesOf: string[];
  /** Things made since they were watched. */
  made: number;
  t: number;
  /** How far apart they stand and sit: as much larger than an upright ape as their figures are drawn. */
  readonly spread: number;
  readonly rnd: () => number;
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

/** The hour of the band's day (0 … 24). */
export function bandHour(b: BandState): number {
  return (b.clock / BAND_DAY) * 24;
}

/** Whether the shrubs and grass about a point would feed a band: their leaf and grass, near. */
function plenty(m: MeadowState, x: number, z: number, reach: number): number {
  let leaf = 0,
    n = 0;
  for (const sh of m.shrubs)
    if (Math.hypot(sh.x - x, sh.z - z) < reach) {
      leaf += sh.leaf;
      n++;
    }
  let grass = 0,
    cells = 0;
  const cols = Math.round(MEADOW_W / 5),
    rows = Math.round(MEADOW_H / 5);
  for (let i = 0; i < m.grass.length; i++) {
    const cx = (i % cols) * 5 + 2.5 - MEADOW_W / 2,
      cz = Math.floor(i / cols) * 5 + 2.5 - MEADOW_H / 2;
    if (Math.hypot(cx - x, cz - z) < reach && i < cols * rows) {
      grass += m.grass[i]!;
      cells++;
    }
  }
  return (n ? leaf / n : 0) * 0.6 + (cells ? grass / cells : 0) * 0.4 + Math.min(1, n / 6) * 0.2;
}

function inPond(m: MeadowState, x: number, z: number, margin: number): boolean {
  return !!m.pond && Math.hypot(x - m.pond.x, z - m.pond.z) < m.pond.r + margin;
}

/** The best ground near a point to camp on: dry, in from the edge, with the most about it. */
function campGround(
  m: MeadowState,
  rnd: () => number,
  from: { x: number; z: number },
  near: number,
  far: number,
): { x: number; z: number } {
  let best = { x: from.x, z: from.z },
    most = -Infinity;
  for (let k = 0; k < 16; k++) {
    const a = rnd() * 2 * Math.PI,
      d = near + (far - near) * rnd(),
      x = from.x + Math.sin(a) * d,
      z = from.z + Math.cos(a) * d;
    if (Math.abs(x) > MEADOW_W / 2 - 12 || Math.abs(z) > MEADOW_H / 2 - 10) continue;
    if (inPond(m, x, z, 6) || m.shrubs.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 3))
      continue;
    const v = plenty(m, x, z, 32) + 0.05 * rnd();
    if (v > most) {
      most = v;
      best = { x, z };
    }
  }
  return best;
}

/**
 * Their shelters about the fire: one to every four or five of them, beyond where they sleep; the
 * work ground in the gap after the first, between where they sleep and the shelters, and the hide
 * frame in the gap after the next (Phase 49 M211).
 */
function pitch(b: BandState): void {
  const many = b.people.length,
    n = Math.max(2, Math.round(many / 4.5)),
    rows = ringOf(Math.max(0, many - 1), Math.max(1, many)).row,
    r = Math.max(8.5, 7.8 + ROW * rows) * b.spread;
  b.shelters = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * (i + 0.3)) / n;
    return { x: b.camp.x + Math.sin(a) * r, z: b.camp.z + Math.cos(a) * r, yaw: a };
  });
  const inner = (3.2 + ROW * rows + 1.4) * b.spread,
    mid = (inner + r) / 2,
    gap = (k: number) => (2 * Math.PI * (k + 0.8)) / n;
  b.work = { x: b.camp.x + Math.sin(gap(0)) * mid, z: b.camp.z + Math.cos(gap(0)) * mid };
  b.frame = {
    x: b.camp.x + Math.sin(gap(1)) * mid,
    z: b.camp.z + Math.cos(gap(1)) * mid,
    yaw: gap(1),
  };
}

/**
 * A band of `size` on a meadow (the last age's land), camped where the land would feed them,
 * a few days' food in store: at the start of a morning, or at the hour given (a land's camp seen
 * near at the world's own hour, Phase 29 M160).
 */
export function newBand(
  m: MeadowState,
  size: number,
  name: string,
  seedText: string,
  hour = RISE,
  names: readonly string[] = [],
  spread = 1,
  craft: BandCraft = PLAIN_CRAFT,
): BandState {
  const rnd = seeded(hashText(`${seedText} band`)),
    b: BandState = {
      name,
      people: [],
      camp: { x: -MEADOW_W * 0.2, z: MEADOW_H * 0.08 },
      going: null,
      shelters: [],
      food: 3,
      clock: ((((hour % 24) + 24) % 24) / 24) * BAND_DAY,
      day: 0,
      here: 0,
      camps: 1,
      hunts: 0,
      kills: 0,
      gathered: 0,
      quarry: -1,
      chase: 0,
      tries: 0,
      kill: null,
      news: [],
      craft,
      // (What a band has about it when first seen: a spear to each hunter and one over, a blade
      // to each of them, some cord, a cloak to every other one, a little colour; the waste of
      // days' knapping about the work ground.)
      kit: {
        spears: 0,
        points: 1,
        blades: size,
        cord: 4,
        hides: 0,
        scraped: 0,
        cloaks: Math.round(size / 2),
        ochre: craft.pigment ? 1 : 0,
        flakes: 14,
      },
      // (Where nothing burns, no fire is ever made: Phase 56.)
      lit: craft.fire !== "none",
      work: { x: 0, z: 0 },
      frame: { x: 0, z: 0, yaw: 0 },
      hidesOf: [],
      made: 0,
      t: 0,
      spread: Math.max(1, spread),
      rnd,
    };
  b.camp = campGround(m, rnd, b.camp, 0, 18);
  const old = Math.max(1, Math.round(size * 0.12)),
    young = Math.max(2, Math.round(size * 0.3));
  for (let i = 0; i < size; i++) {
    const kin: BandKin = i < old ? "old" : i < old + young ? "child" : "grown",
      ring = ringOf(i, size),
      seat = ring.a + 0.12 * (rnd() - 0.5),
      r = 3.2 + ROW * ring.row;
    b.people.push({
      id: i + 1,
      name: names[i] ?? "",
      kin,
      // (Of the grown, about half go out to hunt, the rest to gather.)
      hunter: kin === "grown" && (i - old - young) % 2 === 0,
      x: b.camp.x + Math.sin(seat) * r * b.spread,
      z: b.camp.z + Math.cos(seat) * r * b.spread,
      heading: seat + Math.PI,
      speed: 0,
      doing: "resting",
      target: -1,
      timer: rnd() * 2,
      carry: 0,
      carrying: null,
      seat,
      row: ring.row,
      phase: rnd(),
      making: null,
    });
  }
  b.kit.spears = b.people.filter((p) => p.hunter).length + 1;
  pitch(b);
  return b;
}

function turn(from: number, to: number, most: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return from + Math.max(-most, Math.min(most, d));
}

/** A person headed to a point at a pace: there yet (within `near`)? */
function goTo(p: BandPerson, x: number, z: number, pace: number, near: number): boolean {
  const d = Math.hypot(x - p.x, z - p.z);
  if (d <= near) {
    p.speed = 0;
    return true;
  }
  p.heading = turn(
    p.heading,
    Math.atan2(x - p.x, z - p.z),
    4 * MEADOW_STEP * (pace > WALK ? 2 : 1),
  );
  p.speed = pace;
  return false;
}

// —— Their crafts (Phase 49 M211) ——————————————————————————————————————————————————

/** A band's hour, in its seconds. */
const HOUR_S = BAND_DAY / 24;
/** How long each thing takes to make, in hours of their day. */
const CRAFT_HOURS: Readonly<Record<Making["what"], number>> = {
  point: 0.6,
  blade: 0.45,
  cord: 1,
  spear: 1.2,
  hide: 2.2,
  cloak: 2.6,
  ochre: 0.5,
  fire: 0.3,
};
const CRAFT_DOING: Readonly<Record<Making["what"], BandDoing>> = {
  point: "knapping",
  blade: "knapping",
  cord: "cording",
  spear: "hafting",
  hide: "scraping",
  cloak: "sewing",
  ochre: "grinding",
  fire: "kindling",
};
/** The most flakes left about a work ground (drawn). */
const FLAKES = 60;

/** How many spears a band would keep: two to each hunter, and one over. */
function spearsWanted(b: BandState): number {
  return 2 * b.people.filter((p) => p.hunter).length + 1;
}

/**
 * What one of them takes up next, by what the band is short of — the hunters to their spears and
 * points, the gatherers to the hides, the cord and the colour, the old to the cord, the cloaks and
 * the blades — its makings taken from the band's things as it is begun (null: nothing wants
 * making). (The fire is the kindler's alone.)
 */
function chooseCraft(b: BandState, p: BandPerson): Making | null {
  const k = b.kit,
    at = (what: Making["what"]) => b.people.filter((q) => q.making?.what === what).length,
    can: Readonly<Record<Making["what"], boolean>> = {
      fire: false,
      hide: k.hides >= 1,
      cloak: k.scraped >= 1 && k.cloaks < b.people.length,
      spear: k.points >= 1 && k.cord >= 1 && k.spears + at("spear") < spearsWanted(b),
      point: k.points + k.spears + at("point") + at("spear") < spearsWanted(b) + 2,
      cord: k.cord + 2 * at("cord") < 10,
      blade: k.blades + at("blade") < b.people.length + 6,
      ochre: !!b.craft.pigment && k.ochre + at("ochre") < 6,
    },
    order: readonly Making["what"][] = p.hunter
      ? ["spear", "point", "hide", "blade", "cord", "cloak", "ochre"]
      : p.kin === "old"
        ? ["cord", "cloak", "blade", "ochre", "hide", "point", "spear"]
        : ["hide", "cloak", "cord", "ochre", "blade", "point", "spear"],
    what = order.find((w) => can[w]);
  if (!what) return null;
  if (what === "hide") {
    k.hides--;
    return { doing: CRAFT_DOING[what], what, of: b.hidesOf.shift() ?? "", done: 0 };
  }
  if (what === "cloak") k.scraped--;
  else if (what === "spear") {
    k.points--;
    k.cord--;
  }
  return { doing: CRAFT_DOING[what], what, done: 0 };
}

/** How far a thing being made has gone (0 … 1). */
export function madeShare(mk: Making): number {
  return Math.min(1, mk.done / (CRAFT_HOURS[mk.what] * HOUR_S));
}

/** A thing left off unmade: its makings back with the band's things. */
function leaveOff(b: BandState, p: BandPerson): void {
  const mk = p.making;
  p.making = null;
  if (!mk) return;
  const k = b.kit;
  if (mk.what === "hide") {
    k.hides++;
    b.hidesOf.unshift(mk.of ?? "");
  } else if (mk.what === "cloak") k.scraped++;
  else if (mk.what === "spear") {
    k.points++;
    k.cord++;
  }
}

/** A thing made: with the band's things (and its flakes about the work ground). */
function made(b: BandState, p: BandPerson, mk: Making): void {
  const k = b.kit;
  b.made++;
  switch (mk.what) {
    case "point":
      k.points++;
      k.flakes = Math.min(FLAKES, k.flakes + 3);
      break;
    case "blade":
      k.blades++;
      k.flakes = Math.min(FLAKES, k.flakes + 2);
      break;
    case "cord":
      k.cord += 2;
      break;
    case "spear":
      k.spears++;
      break;
    case "hide":
      k.scraped++;
      break;
    case "cloak":
      k.cloaks++;
      break;
    case "ochre":
      k.ochre++;
      break;
    case "fire":
      b.lit = true;
      b.news.push(
        `${p.name || "One of them"} ${b.craft.fire === "strike-a-light" ? `struck fire from ${b.craft.stone.name} on pyrite` : `made fire with a ${b.craft.fire}`} at the new camp.`,
      );
      break;
  }
}

/** Where one sits or stands at a craft, and what they face: the fire, the hide's frame, the work ground. */
function craftSpot(
  b: BandState,
  p: BandPerson,
  what: Making["what"],
): { x: number; z: number; face: { x: number; z: number } } {
  if (what === "fire") {
    const r = 1.4 * b.spread;
    return { x: b.camp.x + Math.sin(p.seat) * r, z: b.camp.z + Math.cos(p.seat) * r, face: b.camp };
  }
  if (what === "hide") {
    // (Before the frame, on the fire's side of it; a second one beside the first.)
    const f = b.frame,
      side = (p.id % 2 ? 1 : -1) * 0.7 * b.spread,
      back = 1.3 * b.spread;
    return {
      x: f.x - Math.sin(f.yaw) * back + Math.cos(f.yaw) * side,
      z: f.z - Math.cos(f.yaw) * back - Math.sin(f.yaw) * side,
      face: f,
    };
  }
  // (About the work ground, each at their own place on a ring about it.)
  const a = p.seat * 5 + p.id * 0.9,
    r = 1.7 * b.spread;
  return { x: b.work.x + Math.sin(a) * r, z: b.work.z + Math.cos(a) * r, face: b.work };
}

/**
 * One of them at a craft: what they take up (if nothing, null — they sit by the fire instead), to
 * its place, and at it until it is made; their pace.
 */
function craftAt(b: BandState, p: BandPerson, dt: number): number | null {
  if (!p.making) p.making = chooseCraft(b, p);
  const mk = p.making;
  if (!mk) return null;
  const spot = craftSpot(b, p, mk.what);
  if (!goTo(p, spot.x, spot.z, WALK, 0.5)) {
    p.doing = "walking";
    return p.speed;
  }
  p.doing = mk.doing;
  p.heading = turn(p.heading, Math.atan2(spot.face.x - p.x, spot.face.z - p.z), 0.3);
  mk.done += dt;
  if (mk.done >= CRAFT_HOURS[mk.what] * HOUR_S) {
    p.making = null;
    made(b, p, mk);
  }
  return 0;
}

/** What a band's hunters may take: the age's beasts that eat grass and leaf, not too small to be worth it nor too great (nor their own flock). */
export function bandQuarry(m: MeadowState, beast: Beast): boolean {
  const k = m.kinds[beast.kind]!;
  return (
    !k.tame &&
    (k.feed === "graze" || k.feed === "browse" || k.feed === "great" || k.feed === "peck") &&
    k.size >= 8 &&
    k.size <= 1200 &&
    beast.doing !== "coming"
  );
}

/**
 * The band a step on (one MEADOW_STEP, after the meadow's own): the day's hour; each person at
 * what the hour and the band's needs set them to; the hunters after their quarry; what was
 * brought home put by and eaten; the camp moved on when the land about it is bare.
 */
export function stepBand(b: BandState, m: MeadowState): void {
  const dt = MEADOW_STEP,
    r = b.rnd;
  b.t += dt;
  b.clock += dt;
  if (b.clock >= BAND_DAY) {
    b.clock -= BAND_DAY;
    b.day++;
    b.here++;
    b.tries = 0;
  }
  const hour = bandHour(b),
    out = hour >= OUT && hour < HOME,
    night = hour >= SLEEP || hour < RISE,
    // (Eaten as the day goes: a day's food a day.)
    // (The hunters go out most days, three times at most, unless the store is full.)
    hunting = b.food < 6 && b.tries < 3,
    // (With the store full, the grown not out after a beast stay about the fire.)
    full = b.food >= 7,
    // Whether, setting out for home from a point now (with so many hours' work left there first),
    // they would come in after dusk.
    late = (x: number, z: number, work = 0) =>
      hour + work + (Math.hypot(x - b.camp.x, z - b.camp.z) / (WALK * 0.9) / BAND_DAY) * 24 >= HOME;
  b.food = Math.max(0, b.food - dt / BAND_DAY);
  // What is left of a kill when the hunters must go home, or the band walks on: the scavengers'.
  const leave = () => {
    const k = b.kill;
    if (k && k.meat > 0.05 && m.kinds[k.kind])
      m.carcasses.push({ x: k.x, z: k.z, meat: Math.min(1, k.meat), size: k.length, kind: k.kind });
    b.kill = null;
  };
  if (b.kill && (!out || late(b.kill.x, b.kill.z, 0.3))) leave();

  // Packing up, at the morning: when the land about the camp is bare, or they have long been there.
  if (
    !b.going &&
    hour >= RISE &&
    hour < OUT &&
    b.here >= 2 &&
    (plenty(m, b.camp.x, b.camp.z, 30) < 0.32 || b.here >= 5)
  ) {
    b.going = campGround(m, r, b.camp, 30, 58);
    b.shelters = [];
    b.quarry = -1;
    leave();
    for (const p of b.people) {
      leaveOff(b, p);
      p.doing = "moving";
      p.carrying = p.kin === "child" ? null : "bundle";
      p.carry = 0;
    }
  }

  // The hunt: chosen in the morning when the store runs low; run until taken, given up or dusk.
  if (!b.going && out && hunting && b.quarry < 0 && !b.kill && b.people.some((p) => p.hunter)) {
    let best = Infinity;
    // (Where the land's own hunters are about: what they are after is not to be had.)
    const prowling = m.beasts.filter((q) => {
      const f = m.kinds[q.kind]!.feed;
      return f === "hunt" || f === "small";
    });
    for (const q of m.beasts) {
      if (!bandQuarry(m, q) || q.doing === "fleeing") continue;
      const d = Math.hypot(q.x - b.camp.x, q.z - b.camp.z);
      // (Not so far that, run down and cut up, it could not be carried home by dusk.)
      if (d > HUNT_REACH || late(q.x, q.z, 2)) continue;
      if (prowling.some((h) => Math.hypot(h.x - q.x, h.z - q.z) < 20)) continue;
      // (The young, the weak and the near first; the great ones are worth the more.)
      const score = (d * (0.6 + q.energy)) / Math.sqrt(Math.min(400, m.kinds[q.kind]!.size) / 40);
      if (score < best) {
        best = score;
        b.quarry = q.id;
      }
    }
    if (b.quarry >= 0) {
      b.hunts++;
      b.tries++;
      b.chase = 0;
    }
  }
  const quarry = b.quarry >= 0 ? m.beasts.find((q) => q.id === b.quarry) : undefined;
  if (b.quarry >= 0 && (!quarry || !out || b.chase > 30 || late(quarry.x, quarry.z, 1))) {
    // Got away, or run too far, or the day is done: home.
    b.quarry = -1;
    b.chase = 0;
  }

  const folk: { x: number; z: number; hunting: boolean }[] = [];
  // (At a fresh camp the fire is made before anything: by the eldest, else the first of the grown.)
  const kindler =
    b.going || b.lit || b.craft.fire === "none"
      ? -1
      : ((b.people.find((q) => q.kin === "old") ?? b.people.find((q) => q.kin === "grown"))?.id ??
        -1);
  for (const p of b.people) {
    p.timer -= dt;
    let pace = 0,
      // (Whether they are at a craft this step: one who is not leaves what they were making.)
      crafting = false;
    /** At their crafts, if there is anything to make (else false: they rest). */
    const craft = (): boolean => {
      const at = craftAt(b, p, dt);
      if (at === null) return false;
      pace = at;
      crafting = true;
      return true;
    };
    if (b.going) {
      // Walking on to the fresh ground, the camp on their backs.
      p.doing = "moving";
      const spot = seatOf(b, p, 3.2, b.going);
      if (!goTo(p, spot.x, spot.z, WALK * (p.kin === "old" ? 0.8 : 1), 1)) pace = p.speed;
    } else if (p.id === kindler && !p.carrying) {
      // Making the fire at the fresh camp: the bow drill's string sawn back and forth, the stick
      // spun in the hands, or a stone struck on pyrite, until the tinder catches.
      if (p.making?.what !== "fire") {
        leaveOff(b, p);
        p.making = { doing: "kindling", what: "fire", done: 0 };
      }
      craft();
    } else if (night && p.carrying) {
      // Come in late, laden.
      p.doing = "carrying";
      if (goTo(p, b.camp.x, b.camp.z, WALK, 3)) home(b, p);
      else pace = p.speed;
    } else if (night) {
      // By night about the fire: asleep, but for one who keeps it (a night's watch, dusk to dawn).
      const keeper =
        p.id === 1 + ((b.day + (hour >= SLEEP ? 1 : 0)) % Math.max(1, b.people.length));
      const spot = keeper
        ? {
            x: b.camp.x + Math.sin(p.seat) * 2.4 * b.spread,
            z: b.camp.z + Math.cos(p.seat) * 2.4 * b.spread,
          }
        : seatOf(b, p, 4.2);
      if (goTo(p, spot.x, spot.z, WALK, 0.6)) {
        p.doing = keeper ? "tending" : "sleeping";
        p.heading = turn(p.heading, Math.atan2(b.camp.x - p.x, b.camp.z - p.z), 0.2);
      } else {
        p.doing = "walking";
        pace = p.speed;
      }
    } else if (
      !out ||
      (p.kin === "grown" && (late(p.x, p.z) || (full && !(p.hunter && (b.quarry >= 0 || b.kill)))))
    ) {
      // Morning and evening (the far out set off home in time to come in by dusk), or a day's
      // rest with the store full: about the fire, the day's carrying brought in; of an evening
      // half of them at their crafts by turns, and all on a day of rest (Phase 49 M211).
      if (p.carrying) {
        if (goTo(p, b.camp.x, b.camp.z, WALK, 3)) home(b, p);
        else {
          p.doing = "carrying";
          pace = p.speed;
        }
      } else if (
        p.kin !== "child" &&
        (out ? full : hour >= HOME && (p.id + b.day) % 2 === 0) &&
        craft()
      ) {
        // (At it.)
      } else {
        const spot = seatOf(b, p, 3.2);
        if (goTo(p, spot.x, spot.z, WALK, 0.6)) {
          p.doing = p.kin === "old" ? "tending" : "resting";
          p.heading = turn(p.heading, Math.atan2(b.camp.x - p.x, b.camp.z - p.z), 0.2);
        } else {
          p.doing = "walking";
          pace = p.speed;
        }
      }
    } else if (p.kin === "child") {
      // Play about the camp.
      p.doing = "playing";
      if (p.timer <= 0) {
        p.timer = 1 + 2 * r();
        p.heading += (r() - 0.5) * 3;
      }
      const away = Math.hypot(p.x - b.camp.x, p.z - b.camp.z);
      if (away > 9) p.heading = turn(p.heading, Math.atan2(b.camp.x - p.x, b.camp.z - p.z), 0.4);
      pace = 1.8 + 1.2 * Math.max(0, Math.sin(b.t * 2 + p.id));
    } else if (p.kin === "old" && (Math.floor(b.t / (BAND_DAY / 8)) + p.id) % 3 !== 0 && craft()) {
      // The old by day at their crafts, two spells of three (Phase 49 M211) …
    } else if (p.kin === "old") {
      // … and between, keeping the fire and the camp.
      const spot = seatOf(b, p, 2.4);
      if (goTo(p, spot.x, spot.z, WALK * 0.7, 0.6)) p.doing = "tending";
      else {
        p.doing = "walking";
        pace = p.speed;
      }
    } else if (p.carrying) {
      // Laden: home.
      p.doing = "carrying";
      if (goTo(p, b.camp.x, b.camp.z, WALK * 0.9, 3)) home(b, p);
      else pace = p.speed;
    } else if (p.hunter && b.kill) {
      // At the kill: cutting it up, then home with the meat.
      const k = b.kill;
      const about = 1.6 * b.spread;
      if (
        goTo(p, k.x + Math.sin(p.seat) * about, k.z + Math.cos(p.seat) * about, WALK * 1.4, 0.8)
      ) {
        p.doing = "butchering";
        if (p.timer <= 0 && k.meat > 0) {
          p.timer = 1.2 + r();
          const cut = Math.min(k.meat, 0.25 + 0.1 * r());
          k.meat -= cut;
          p.carry = 1;
          p.carrying = "meat";
          // (So many days' food for the band, as great as the beast was.)
          p.target = Math.round(cut * k.worth * 100);
        }
      } else {
        p.doing = "walking";
        pace = p.speed;
      }
      if (k.meat <= 0.02) {
        // (Cut up: its hide brought home with the meat, for the frame.)
        b.kill = null;
        b.kit.hides++;
        b.hidesOf.push(k.name);
      }
    } else if (p.hunter && quarry) {
      // After the quarry: creeping near together, then the run and the spear.
      const d = Math.hypot(quarry.x - p.x, quarry.z - p.z),
        running = d < 10 || b.chase > 0;
      p.doing = running ? "chasing" : "stalking";
      p.heading = turn(
        p.heading,
        Math.atan2(quarry.x - p.x, quarry.z - p.z),
        4 * dt * (running ? 2 : 1),
      );
      pace = running ? RUN : WALK * 0.9;
      if (running && d < 16 && r() < 0.25 * dt) {
        // Speared: thrown as it bolts, or thrust as they close.
        const k = m.kinds[quarry.kind]!;
        m.beasts = m.beasts.filter((q) => q.id !== quarry.id);
        m.died++;
        m.taken++;
        if (quarry.id === m.chosen) m.fate = { how: "taken", by: b.name, at: m.t };
        b.kill = {
          x: quarry.x,
          z: quarry.z,
          meat: 1,
          name: k.name,
          kind: quarry.kind,
          worth: Math.max(0.6, Math.min(4, k.size / 90)),
          length: k.length,
          yaw: quarry.heading,
        };
        b.kills++;
        b.quarry = -1;
        b.chase = 0;
        b.news.push(`The hunters ran down a ${k.name}, and carried it home.`);
        // (A point snaps on a bone, now and then, or a shaft on the fall: another to be made.)
        if (b.kit.spears > 1 && r() < 0.3) {
          b.kit.spears--;
          b.news.push(`A spear broke on the ${k.name}.`);
        }
      }
    } else if (p.hunter) {
      // No hunt today: they gather with the rest.
      gather(b, m, p, dt);
      pace = p.speed;
    } else {
      gather(b, m, p, dt);
      pace = p.speed;
    }
    if (!crafting && p.making) leaveOff(b, p);
    p.speed = pace;
    p.x += Math.sin(p.heading) * pace * dt;
    p.z += Math.cos(p.heading) * pace * dt;
    // Kept to the land, and out of the pool.
    p.x = Math.max(-MEADOW_W / 2 + 1.5, Math.min(MEADOW_W / 2 - 1.5, p.x));
    p.z = Math.max(-MEADOW_H / 2 + 1.5, Math.min(MEADOW_H / 2 - 1.5, p.z));
    const pond = m.pond;
    if (pond) {
      const d = Math.hypot(p.x - pond.x, p.z - pond.z);
      if (d < pond.r + 0.6 && d > 1e-6) {
        p.x = pond.x + ((p.x - pond.x) / d) * (pond.r + 0.6);
        p.z = pond.z + ((p.z - pond.z) / d) * (pond.r + 0.6);
      }
    }
    p.phase += dt * (0.5 + pace / 1.6);
    // (Stalking, they creep: only the run is seen from afar.)
    if (p.doing === "chasing") folk.push({ x: p.x, z: p.z, hunting: true });
    else if (p.doing !== "sleeping") folk.push({ x: p.x, z: p.z, hunting: false });
  }
  if (quarry && b.quarry >= 0 && b.people.some((p) => p.doing === "chasing")) b.chase += dt;
  // The meadow's beasts see them: they run from the hunters, and from any who come too near.
  m.folk = folk;
  m.fire = b.going || !b.lit ? null : b.camp;

  // Come to the fresh ground: camp pitched, the fire to be made (Phase 49 M211), a fresh work ground.
  const g = b.going;
  if (
    g &&
    b.people.every((p) => Math.hypot(p.x - g.x, p.z - g.z) < (3.2 + ROW * p.row) * b.spread + 2.8)
  ) {
    b.camp = g;
    b.going = null;
    b.here = 0;
    b.camps++;
    b.lit = false;
    b.kit.flakes = 0;
    pitch(b);
    for (const p of b.people) {
      p.carrying = null;
      p.carry = 0;
      p.doing = "resting";
    }
    b.news.push(
      `The land about the camp eaten bare, the band walked on to fresh ground — their ${ordinal(b.camps)} camp.`,
    );
  }
}

/** What a person brings home put by: an armful of what was gathered, or so much meat. */
function home(b: BandState, p: BandPerson): void {
  if (p.carrying === "meat") b.food += Math.max(0.1, p.target / 100);
  else if (p.carrying === "food") {
    b.food += 0.045;
    b.gathered++;
  }
  p.carry = 0;
  p.carrying = null;
  p.target = -1;
}

/** Out gathering: to the nearest woods in leaf (or, with none, roots and seed from the grass), then home laden. */
function gather(b: BandState, m: MeadowState, p: BandPerson, dt: number): void {
  const r = b.rnd;
  let sh = p.target >= 0 ? m.shrubs[p.target] : undefined;
  if (!sh || sh.leaf < 0.2) {
    let best = Infinity;
    p.target = -1;
    m.shrubs.forEach((s, i) => {
      if (s.leaf < 0.3) return;
      const fromCamp = Math.hypot(s.x - b.camp.x, s.z - b.camp.z);
      if (fromCamp > GATHER_REACH) return;
      const d = (Math.hypot(s.x - p.x, s.z - p.z) + 0.3 * fromCamp) / (0.3 + s.leaf) + 4 * r();
      if (d < best) {
        best = d;
        p.target = i;
      }
    });
    sh = p.target >= 0 ? m.shrubs[p.target] : undefined;
  }
  if (sh) {
    const a = p.seat + p.id,
      x = sh.x + Math.sin(a) * (sh.r + 0.8),
      z = sh.z + Math.cos(a) * (sh.r + 0.8);
    if (goTo(p, x, z, WALK, 0.7)) {
      p.doing = "gathering";
      p.heading = turn(p.heading, Math.atan2(sh.x - p.x, sh.z - p.z), 0.3);
      sh.leaf = Math.max(0, sh.leaf - 0.012 * dt);
      p.carry += 0.2 * dt;
      if (p.carry >= 1) {
        p.carry = 1;
        p.carrying = "food";
        p.target = -1;
      }
    } else p.doing = "walking";
    return;
  }
  // No woods in leaf near: roots and seed from the best grass about the camp.
  if (p.timer <= 0) {
    p.timer = 3 + 3 * r();
    p.heading = Math.atan2(b.camp.x - p.x, b.camp.z - p.z) + (r() - 0.5) * 4;
  }
  const cols = Math.round(MEADOW_W / 5),
    c =
      Math.max(0, Math.min(Math.round(MEADOW_H / 5) - 1, Math.floor((p.z + MEADOW_H / 2) / 5))) *
        cols +
      Math.max(0, Math.min(cols - 1, Math.floor((p.x + MEADOW_W / 2) / 5)));
  const g = m.grass[c] ?? 0;
  if (g > 0.4 && Math.hypot(p.x - b.camp.x, p.z - b.camp.z) > 8) {
    p.doing = "gathering";
    p.speed = 0;
    m.grass[c] = Math.max(0, g - 0.03 * dt);
    p.carry += 0.12 * dt;
    if (p.carry >= 1) {
      p.carry = 1;
      p.carrying = "food";
    }
  } else {
    p.doing = "walking";
    p.speed = WALK * 0.8;
    if (Math.hypot(p.x - b.camp.x, p.z - b.camp.z) > GATHER_REACH)
      p.heading = Math.atan2(b.camp.x - p.x, b.camp.z - p.z);
  }
}

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
];

function ordinal(n: number): string {
  return (
    ORDINALS[n - 1] ??
    `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`
  );
}

const COUNTS = ["", "one", "two", "three", "four", "five", "six"];

/** A pace of the band's (1 the slowest) as its button says it, and in words. */
export function bandPace(pace: number): { label: string; words: string } {
  const secs = BAND_DAY / pace,
    long =
      secs % 60 === 0
        ? secs === 60
          ? "a minute"
          : `${COUNTS[secs / 60] ?? secs / 60} minutes`
        : `${Math.round(secs)} seconds`;
  return { label: `${pace}×`, words: `A day of theirs in ${long}` };
}

/** One of the band in a line (Phase 29 M161): who they are, and what they are at now. */
export function bandPersonWords(b: BandState, m: MeadowState, id: number): string {
  const p = b.people.find((q) => q.id === id);
  if (!p) return "";
  const who =
      p.kin === "child"
        ? "a child"
        : p.kin === "old"
          ? "one of the old"
          : p.hunter
            ? "a hunter"
            : "a gatherer",
    beast = (kind: number | undefined) => m.kinds[kind ?? -1]?.name ?? "a beast",
    quarry = b.quarry >= 0 ? m.beasts.find((q) => q.id === b.quarry) : undefined,
    c = b.craft,
    doing = ((): string => {
      switch (p.doing) {
        case "sleeping":
          return "asleep by the fire";
        case "resting":
          return "resting by the fire";
        case "tending":
          return "keeping the fire";
        case "playing":
          return "at play about the camp";
        case "gathering":
          return p.target >= 0 ? "gathering from the brush" : "digging roots in the grass";
        case "carrying":
          return p.carrying === "meat"
            ? "carrying meat home"
            : p.carrying === "bundle"
              ? "carrying the camp"
              : "carrying home what was gathered";
        case "stalking":
          return `creeping up on a ${beast(quarry?.kind)}`;
        case "chasing":
          return `running down a ${beast(quarry?.kind)}`;
        case "butchering":
          return `cutting up the ${b.kill?.name ?? "kill"}`;
        case "moving":
          return "carrying the camp on to fresh ground";
        // Their crafts (Phase 49 M211), each of what the land gives them.
        case "knapping":
          return `knapping ${c.stone.name} into ${p.making?.what === "point" ? "a spear point" : "a blade"}`;
        case "cording":
          return `twisting ${c.fibre} into cord`;
        case "hafting":
          return `binding a ${c.stone.name} point to a shaft of ${c.wood} with ${c.binding}`;
        case "scraping":
          return `scraping ${p.making?.of ? `a ${p.making.of}'s` : "a"} hide on its frame`;
        case "sewing":
          return "sewing hides into a cloak with a bone awl and sinew";
        case "grinding":
          return `grinding ${c.pigment?.name ?? "colour"} on a flat stone`;
        case "kindling":
          return c.fire === "strike-a-light"
            ? `striking ${c.stone.name} on pyrite for a spark, to make the fire`
            : `making fire with a ${c.fire}`;
        default:
          return b.going
            ? "walking on with the band to fresh ground"
            : p.carrying
              ? "walking home, laden"
              : "walking out from the camp";
      }
    })();
  return `${p.name || "One of them"}, ${who} — ${doing}.`;
}

/** The band in a line: how many, what they are at, the hour, their store. */
export function bandWords(b: BandState): string {
  const hour = bandHour(b),
    count = (d: BandDoing) => b.people.filter((p) => p.doing === d).length,
    part = (n: number, words: string) => (n ? `${n} ${words}` : ""),
    when =
      hour >= SLEEP || hour < RISE
        ? "night"
        : hour < OUT
          ? "morning"
          : hour < 12
            ? "forenoon"
            : hour < HOME
              ? "afternoon"
              : "evening";
  if (b.going)
    return `The band of ${b.people.length} walks on to fresh ground, the camp on their backs — ${when}, day ${b.day + 1}.`;
  if (count("kindling"))
    return `The band of ${b.people.length} at fresh ground: one making the fire — ${when}, day ${b.day + 1}, their ${ordinal(b.camps)} camp.`;
  if (when === "night")
    return `Night: the band of ${b.people.length} sleeps about its fire${count("tending") ? ", one keeping it" : ""} — day ${b.day + 1}, their ${ordinal(b.camps)} camp.`;
  const hunting = count("chasing") + count("stalking"),
    crafting = b.people.filter((p) => CRAFT_DOINGS.includes(p.doing)).length,
    doing = [
      part(count("gathering"), "gathering"),
      part(hunting, "hunting"),
      part(count("butchering"), "cutting up a kill"),
      part(count("carrying"), "carrying home"),
      part(crafting, "at their crafts"),
      part(
        count("playing"),
        b.people.filter((p) => p.kin === "child").length === 1
          ? "child at play"
          : "children at play",
      ),
      part(count("tending") + count("resting"), "by the fire"),
      part(count("walking"), "walking"),
    ].filter(Boolean);
  return `The band of ${b.people.length}: ${doing.join(", ")} — ${when}, day ${b.day + 1}; ${b.food < 0.5 ? "hungry" : `${b.food.toFixed(1)} days' food put by`}; ${b.kills === 1 ? "a beast" : `${b.kills} beasts`} taken.`;
}

/** What the band keeps, in a line of signs (Phase 49 M211): spears, blades, cord, hides, cloaks, colour. */
export function bandKitWords(b: BandState): string {
  const k = b.kit,
    hides = k.hides + k.scraped + b.people.filter((p) => p.making?.what === "hide").length;
  return [
    `🗡️ ${k.spears} spear${k.spears === 1 ? "" : "s"}${k.points ? ` (+${k.points} point${k.points === 1 ? "" : "s"})` : ""}`,
    `🔪 ${k.blades} ${b.craft.stone.name} blade${k.blades === 1 ? "" : "s"}`,
    `🧵 ${k.cord} span${k.cord === 1 ? "" : "s"} of cord`,
    ...(hides ? [`🟫 ${hides} hide${hides === 1 ? "" : "s"}`] : []),
    `🧥 ${k.cloaks} cloak${k.cloaks === 1 ? "" : "s"}`,
    ...(b.craft.pigment && k.ochre ? [`🔴 ${k.ochre} of ${b.craft.pigment.name}`] : []),
  ].join(" · ");
}
