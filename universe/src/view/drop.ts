// A drop under the glass (Phase 17 M131, the Observatory's smallest scale): its life, as a pure
// step of its state — small cells running and tumbling after what floats, light-eaters drifting
// up toward the light, hunting cells closing on smaller ones and taking them in, cells together
// turning as one; each living by its kind's way, spending as it lives and moves, dividing when
// it has eaten enough, its daughters a little unlike it. The page's glass draws it (ui/drop.ts);
// the genesis (Phase 24) watches the first seas' drop in the round, its kinds arising as the
// dawn's clock comes to them, the god's hand feeding, shading, warming and stirring it.
//
// Seeded by the place, the same drop shows the same lives; its steps are fixed, so a slow screen
// sees what a fast one does. It is no part of history.
import type { Block, DropKind } from "../bridge/index.ts";
import type { DawnWay } from "../rules/index.ts";
import type { CellPart } from "./genesis.ts";

export type DropBlock = Extract<Block, { type: "drop" }>;
type Way = DropKind["way"];

/** The drop's field, micrometres across and down. */
export const FIELD_W = 180;
export const FIELD_H = 135;
/** A step of the drop's time (seconds). */
export const STEP = 1 / 30;
/** The most lives a drop holds (crowded, none divides), and the most of the larger kinds. */
const MOST = 240;
const MOST_OF: Readonly<Record<Way, number>> = { eater: 160, light: 110, hunter: 7, colony: 8 };
const MOST_MOTES = 360;

/** How fast each kind moves (µm a second) and what it spends to keep alive, by its size. */
const SPEED: Readonly<Record<Way, number>> = { eater: 14, light: 3, hunter: 7, colony: 4 };
const UPKEEP: Readonly<Record<Way, number>> = {
  eater: 0.03,
  light: 0.025,
  hunter: 0.01,
  colony: 0.02,
};
/** What a light-eater makes of full light, a second, by its own worth. */
const SUN: Readonly<Record<Way, number>> = { eater: 0, light: 0.16, hunter: 0, colony: 0.05 };
/** A mote's worth to the cell that eats it; what a hunter makes of a cell it takes in, by its worth. */
const MOTE = 1.5;
const DIGEST = 1.6;
/** How far each kind's daughters may drift from it, a generation (size, speed). */
const DRIFT: Readonly<Record<Way, number>> = {
  eater: 0.03,
  light: 0.07,
  hunter: 0.05,
  colony: 0.04,
};

export type Cell = {
  id: number;
  kind: number;
  way: Way;
  x: number;
  y: number;
  heading: number;
  /** Its size across (µm), and how fast it moves at most (µm a second). */
  size: number;
  speed: number;
  /** Its colour's turn from its kind's (degrees). */
  hue: number;
  energy: number;
  age: number;
  generation: number;
  /** Seconds left of its dividing (0: not dividing). */
  dividing: number;
  /** Seconds before a hunter that has eaten hunts again (it digests). */
  full: number;
  /** Followed: the cell tapped, and every cell come of it. */
  marked: boolean;
  /** What it has taken in lately, fading (a hunter's). */
  meals: { color: number; age: number }[];
};

export type Mote = { x: number; y: number; vx: number; vy: number };

export type DropState = {
  readonly kinds: readonly DropKind[];
  readonly habitat: DropBlock["habitat"];
  cells: Cell[];
  motes: Mote[];
  next: number;
  /** Seconds of the drop's time. */
  t: number;
  light: number;
  food: number;
  /** How fast its lives go, by its warmth (the god's hand may warm it or cool it). */
  pace: number;
  /** Which of its kinds have arisen (the dawn's drop holds only those its clock has come to). */
  readonly risen: boolean[];
  readonly rnd: () => number;
  born: number;
  died: number;
  eaten: number;
  /** Each kind's number and mean size, every two seconds. */
  history: { t: number; count: number[]; size: number[] }[];
};

/** A small fast seeded source of numbers in [0, 1): the same drop shows the same lives. */
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

/** About normal, mean 0 and spread 1. */
function normal(rnd: () => number): number {
  return (rnd() + rnd() + rnd() - 1.5) * 2;
}

/** What a cell of a size is worth: what it took to make, and what a hunter gains of it. */
export function worth(size: number): number {
  return size * Math.sqrt(size);
}

/** The light where a cell is: the drop's own, brighter toward its top where it is water. */
function lightAt(s: DropState, y: number): number {
  return s.habitat === "soil" ? s.light : s.light * (1 - 0.6 * (y / FIELD_H));
}

function wrap(v: number, size: number): number {
  return v < 0 ? v + size : v >= size ? v - size : v;
}

/** The shortest way from a to b across a field that wraps. */
export function gap(a: number, b: number, size: number): number {
  let d = b - a;
  if (d > size / 2) d -= size;
  else if (d < -size / 2) d += size;
  return d;
}

/** The way down from a to b: across the wrap in soil; in water, between its surface and floor. */
function gapY(s: DropState, a: number, b: number): number {
  return s.habitat === "soil" ? gap(a, b, FIELD_H) : b - a;
}

/** Where a cell may stand down the drop. */
function placeY(s: DropState, y: number): number {
  return s.habitat === "soil" ? wrap(y, FIELD_H) : Math.min(FIELD_H - 0.5, Math.max(0.5, y));
}

/**
 * A new drop: its lives by their kinds' shares, its motes; only the kinds `risen` says have
 * arisen (every kind, unless it says).
 */
export function newDrop(
  b: DropBlock,
  risen: readonly boolean[] = b.kinds.map(() => true),
): DropState {
  const rnd = seeded(b.seed),
    s: DropState = {
      kinds: b.kinds,
      habitat: b.habitat,
      cells: [],
      motes: [],
      next: 1,
      t: 0,
      light: b.light,
      food: b.food,
      pace: Math.min(1.5, Math.max(0.25, 0.35 + b.warmth / 25)) * (b.habitat === "ice" ? 0.5 : 1),
      rnd,
      born: 0,
      died: 0,
      eaten: 0,
      history: [],
      risen: b.kinds.map((_, i) => risen[i] ?? true),
    };
  // (Those risen share the drop between them.)
  const n = 120,
    whole = b.kinds.reduce((a, k, i) => a + (s.risen[i] ? k.share : 0), 0) || 1;
  b.kinds.forEach((k, kind) => {
    if (!s.risen[kind]) return;
    const many = Math.max(1, Math.min(MOST_OF[k.way], Math.round((n * k.share) / whole)));
    for (let i = 0; i < many; i++)
      s.cells.push(born(s, kind, null, rnd() * FIELD_W, rnd() * FIELD_H));
  });
  for (let i = 0; i < 160 * b.food; i++)
    s.motes.push({ x: rnd() * FIELD_W, y: rnd() * FIELD_H, vx: 0, vy: 0 });
  record(s);
  return s;
}

/** A cell come into the drop: of its kind, or of its mother (a little unlike her). */
export function born(s: DropState, kind: number, mother: Cell | null, x: number, y: number): Cell {
  const k = s.kinds[kind]!,
    r = s.rnd,
    size = mother
      ? Math.min(
          k.size * 2.5,
          Math.max(
            k.size * (k.way === "eater" ? 0.8 : 0.6),
            mother.size * Math.exp(DRIFT[k.way] * normal(r)),
          ),
        )
      : k.size * Math.exp(0.04 * normal(r)),
    speed = mother
      ? Math.min(
          SPEED[k.way] * 3,
          Math.max(SPEED[k.way] * 0.3, mother.speed * Math.exp(0.08 * normal(r))),
        )
      : SPEED[k.way] * Math.exp(0.05 * normal(r));
  return {
    id: s.next++,
    kind,
    way: k.way,
    x,
    y,
    heading: r() * Math.PI * 2,
    size,
    speed,
    hue: mother ? mother.hue + 8 * normal(r) : 10 * normal(r),
    energy: mother ? 0 : worth(size) * (1 + 0.6 * r()),
    age: mother ? 0 : r() * 20,
    generation: mother ? mother.generation + 1 : 0,
    dividing: 0,
    full: 0,
    marked: mother?.marked ?? false,
    meals: [],
  };
}

/** The motes near a spot, by the cell of a coarse grid they lie in. */
class Motes {
  private readonly cols = 15;
  private readonly rows = 12;
  private readonly buckets: number[][] = [];
  constructor(motes: readonly Mote[]) {
    for (let i = 0; i < this.cols * this.rows; i++) this.buckets.push([]);
    motes.forEach((m, i) => this.buckets[this.at(m.x, m.y)]!.push(i));
  }
  private at(x: number, y: number): number {
    const c = Math.min(this.cols - 1, Math.floor((x / FIELD_W) * this.cols)),
      r = Math.min(this.rows - 1, Math.floor((y / FIELD_H) * this.rows));
    return r * this.cols + c;
  }
  /** The motes in the grid's cells about a spot. */
  near(x: number, y: number): number[] {
    const c = Math.floor((x / FIELD_W) * this.cols),
      r = Math.floor((y / FIELD_H) * this.rows),
      out: number[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const cc = (c + dc + this.cols) % this.cols,
          rr = (r + dr + this.rows) % this.rows;
        out.push(...this.buckets[rr * this.cols + cc]!);
      }
    return out;
  }
}

/** The drop a step on: each cell moves, eats, spends, divides or dies; motes fall and drift. */
export function stepDrop(s: DropState): void {
  const dt = STEP * s.pace,
    r = s.rnd,
    grid = new Motes(s.motes),
    gone = new Set<number>(),
    eatenMotes = new Set<number>(),
    newborn: Cell[] = [],
    counts = new Map<Way, number>();
  for (const c of s.cells) counts.set(c.way, (counts.get(c.way) ?? 0) + 1);
  const hunters = s.cells.filter((c) => c.way === "hunter");
  for (const c of s.cells) {
    if (gone.has(c.id)) continue;
    c.age += dt;
    const w = worth(c.size);
    let pace = 1;
    if (c.dividing > 0) {
      // (Dividing, it stays: two when it is done.)
      c.dividing -= dt;
      if (c.dividing <= 0) {
        c.dividing = 0;
        const a = born(s, c.kind, c, c.x, c.y),
          b = born(s, c.kind, c, c.x, c.y),
          away = c.heading + Math.PI / 2;
        a.x = wrap(c.x + Math.cos(away) * c.size * 0.4, FIELD_W);
        a.y = placeY(s, c.y + Math.sin(away) * c.size * 0.4);
        b.x = wrap(c.x - Math.cos(away) * c.size * 0.4, FIELD_W);
        b.y = placeY(s, c.y - Math.sin(away) * c.size * 0.4);
        a.energy = b.energy = c.energy / 2;
        a.heading = c.heading;
        b.heading = c.heading + Math.PI;
        newborn.push(a, b);
        gone.add(c.id);
        s.born += 2;
      }
      continue;
    }
    switch (c.way) {
      case "eater": {
        // Away from a hunter close by; else to the nearest mote it senses; else on, now and
        // then tumbling to a new way.
        // (It feels a hunter only when it is all but upon it, and not always then.)
        let fled = false;
        for (const h of hunters) {
          if (gone.has(h.id) || h.size * 0.5 <= c.size) continue;
          const dx = gap(h.x, c.x, FIELD_W),
            dy = gapY(s, h.y, c.y),
            d2 = dx * dx + dy * dy,
            near = h.size / 2 + 4;
          if (d2 < near * near && r() < 0.5) {
            c.heading = Math.atan2(dy, dx);
            fled = true;
            break;
          }
        }
        if (!fled) {
          let best = -1,
            bd = 100;
          for (const i of grid.near(c.x, c.y)) {
            if (eatenMotes.has(i)) continue;
            const m = s.motes[i]!,
              dx = gap(c.x, m.x, FIELD_W),
              dy = gap(c.y, m.y, FIELD_H),
              d2 = dx * dx + dy * dy;
            if (d2 < bd) [best, bd] = [i, d2];
          }
          if (best >= 0) {
            const m = s.motes[best]!;
            if (bd < (c.size / 2 + 1) ** 2) {
              eatenMotes.add(best);
              c.energy += MOTE;
            } else c.heading = Math.atan2(gap(c.y, m.y, FIELD_H), gap(c.x, m.x, FIELD_W));
          } else if (r() < 0.6 * dt) c.heading = r() * Math.PI * 2;
        }
        break;
      }
      case "light":
      case "colony": {
        // By the light; toward it, slowly, where the water is lit from above.
        c.energy += SUN[c.way] * w * lightAt(s, c.y) * dt;
        if (r() < 0.4 * dt)
          c.heading = s.habitat === "soil" ? r() * Math.PI * 2 : -Math.PI / 2 + (r() - 0.5) * 2.4;
        pace = 0.6;
        break;
      }
      case "hunter": {
        // To the best cell small enough to take in that it senses (the larger and nearer, the
        // better), lunging when it is close; taking it in where it is reached.
        let prey: Cell | null = null,
          pd = 0,
          score = 0;
        if (c.full > 0) c.full -= dt;
        else
          for (const o of s.cells) {
            if (o === c || gone.has(o.id) || o.dividing > 0 || o.size >= c.size * 0.5) continue;
            const dx = gap(c.x, o.x, FIELD_W),
              dy = gapY(s, c.y, o.y),
              d2 = dx * dx + dy * dy;
            if (d2 > 26 * 26) continue;
            const v = worth(o.size) / (Math.sqrt(d2) + 6);
            if (v > score) [prey, pd, score] = [o, d2, v];
          }
        if (prey) {
          if (pd < 12 * 12 + (c.size / 2) ** 2) pace = 1.5;
          if (pd < (c.size / 2) ** 2) {
            gone.add(prey.id);
            c.energy += worth(prey.size) * DIGEST;
            c.full = worth(prey.size) * 0.3;
            c.meals.push({ color: prey.kind, age: 0 });
            if (c.meals.length > 6) c.meals.shift();
            s.eaten++;
          } else c.heading = Math.atan2(gapY(s, c.y, prey.y), gap(c.x, prey.x, FIELD_W));
        } else if (r() < 0.3 * dt)
          // (It keeps to the drop's floor, where what dies sinks; the lit water above is the
          // light-eaters' own.)
          c.heading =
            s.habitat !== "soil" && c.y < FIELD_H * 0.55
              ? Math.PI / 2 + (r() - 0.5) * 2
              : r() * Math.PI * 2;
        for (const m of c.meals) m.age += dt;
        c.meals = c.meals.filter((m) => m.age < 8);
        break;
      }
    }
    // It moves, and spends for living and for its speed.
    const v = c.speed * pace;
    c.x = wrap(c.x + Math.cos(c.heading) * v * dt, FIELD_W);
    const y = c.y + Math.sin(c.heading) * v * dt;
    if (s.habitat === "soil") c.y = wrap(y, FIELD_H);
    else {
      // (The water's surface above, the slide's floor below: it turns back from either.)
      c.y = placeY(s, y);
      if (c.y !== y) c.heading = -c.heading;
    }
    c.energy -= (UPKEEP[c.way] * w + 0.002 * w * (c.speed / SPEED[c.way]) ** 2) * dt;
    if (c.energy <= 0) {
      gone.add(c.id);
      s.died++;
      // (What it was made of falls apart into motes.)
      for (let i = 0; i < Math.min(6, Math.ceil(w / 4)); i++)
        s.motes.push({
          x: wrap(c.x + normal(r) * c.size * 0.3, FIELD_W),
          y: wrap(c.y + normal(r) * c.size * 0.3, FIELD_H),
          vx: 0,
          vy: 0,
        });
      continue;
    }
    // Fed enough, and room, it divides.
    if (
      c.energy >= 2 * w &&
      s.cells.length + newborn.length < MOST &&
      (counts.get(c.way) ?? 0) < MOST_OF[c.way]
    ) {
      c.dividing = 0.6;
      counts.set(c.way, (counts.get(c.way) ?? 0) + 1);
    }
  }
  s.cells = s.cells.filter((c) => !gone.has(c.id)).concat(newborn);
  // Motes drift and sink; new ones come with the water.
  s.motes = s.motes.filter((_, i) => !eatenMotes.has(i));
  for (const m of s.motes) {
    m.vx = m.vx * 0.9 + normal(r) * 0.4;
    m.vy = m.vy * 0.9 + normal(r) * 0.4 + (s.habitat === "soil" ? 0 : 0.03);
    m.x = wrap(m.x + m.vx * dt, FIELD_W);
    m.y = wrap(m.y + m.vy * dt, FIELD_H);
  }
  const fresh = s.food * 6 * dt;
  for (let i = 0; i < Math.floor(fresh) + (r() < fresh % 1 ? 1 : 0); i++)
    if (s.motes.length < MOST_MOTES)
      s.motes.push({ x: r() * FIELD_W, y: r() * FIELD_H, vx: 0, vy: 0 });
  if (s.motes.length > MOST_MOTES) s.motes.splice(0, s.motes.length - MOST_MOTES);
  // (A kind gone from the drop comes back now and then, as the water brings it.)
  if (r() < 0.02 * dt)
    s.kinds.forEach((k, kind) => {
      if (s.risen[kind] && !s.cells.some((c) => c.kind === kind) && s.cells.length < MOST)
        s.cells.push(born(s, kind, null, r() * FIELD_W, 0));
    });
  const before = Math.floor(s.t / 2);
  s.t += dt;
  if (Math.floor(s.t / 2) !== before) record(s);
}

/** Each kind's number and mean size, kept for the chart. */
function record(s: DropState): void {
  const count = s.kinds.map(() => 0),
    size = s.kinds.map(() => 0);
  for (const c of s.cells) {
    count[c.kind]!++;
    size[c.kind]! += c.size;
  }
  s.history.push({ t: s.t, count, size: size.map((v, i) => (count[i] ? v / count[i]! : 0)) });
  if (s.history.length > 300) s.history.splice(0, s.history.length - 300);
}

// —— The dawn's drop (Phase 24) ———————————————————————————————————————————————————————————

/**
 * A kind arisen in the drop: a few of it come, as the water brings them (however crowded the
 * drop: they are new in the world, and none of the rest divides until there is room).
 */
export function arise(s: DropState, kind: number, many = 5): void {
  if (s.risen[kind] || !s.kinds[kind]) return;
  s.risen[kind] = true;
  for (let i = 0; i < many; i++)
    s.cells.push(born(s, kind, null, s.rnd() * FIELD_W, s.rnd() * FIELD_H));
}

/** What the god's hand may do to a drop. */
export type DropAct = "feed" | "shade" | "light" | "warm" | "cool" | "stir";

/** The god's hand on a drop: food poured in, its light shaded or let in, warmed or cooled, stirred. */
export function touchDrop(s: DropState, act: DropAct, b: DropBlock): void {
  const r = s.rnd;
  if (act === "feed")
    for (let i = 0; i < 80; i++) s.motes.push({ x: r() * FIELD_W, y: r() * FIELD_H, vx: 0, vy: 0 });
  else if (act === "shade") s.light = b.light * 0.25;
  // (Let in, the light is as bright as a sunlit shallow's at noon: half again a drop's.)
  else if (act === "light") s.light = Math.min(1.6, Math.max(1, b.light * 1.6));
  else if (act === "warm") s.pace = Math.min(2.2, s.pace * 1.5);
  else if (act === "cool") s.pace = Math.max(0.15, s.pace / 1.5);
  else
    for (const c of s.cells) {
      c.heading = r() * Math.PI * 2;
      c.x = r() * FIELD_W;
      c.y = r() * FIELD_H;
    }
}

/** Each way's share of the drop's living worth (what its cells took to make). */
export function waysWorth(s: DropState): Map<DropKind["way"], number> {
  const out = new Map<DropKind["way"], number>();
  let whole = 0;
  for (const c of s.cells) {
    const w = worth(c.size);
    out.set(c.way, (out.get(c.way) ?? 0) + w);
    whole += w;
  }
  for (const [k, v] of out) out.set(k, whole > 0 ? v / whole : 0);
  return out;
}

const DAWN_OF: Readonly<Record<DropKind["way"], DawnWay>> = {
  eater: "eaters",
  light: "light",
  hunter: "hunters",
  colony: "together",
};

/**
 * The way that prospered in the drop: the one whose share of its living worth stands highest
 * against the share it would have had (`expected`, each way's share where the hand had not
 * been laid on it) — a twentieth of the drop's life added to both, so that a kind of a few
 * cells, one more or fewer, is not judged to have prospered or failed by it.
 */
export function prospered(s: DropState, expected: ReadonlyMap<DropKind["way"], number>): DawnWay {
  const now = waysWorth(s);
  let best: DropKind["way"] = "eater",
    gain = -Infinity;
  for (const way of ["eater", "light", "hunter", "colony"] as const) {
    const g = ((now.get(way) ?? 0) + 0.05) / ((expected.get(way) ?? 0) + 0.05);
    if (g > gain) [best, gain] = [way, g];
  }
  return DAWN_OF[best];
}

/** What prospered under the hand, in words: its share of the drop's life, and left alone. */
export function prosperedWords(
  s: DropState,
  expected: ReadonlyMap<DropKind["way"], number>,
): { way: DawnWay; words: string } {
  const way = prospered(s, expected),
    of = (Object.keys(DAWN_OF) as DropKind["way"][]).find((w) => DAWN_OF[w] === way)!,
    name = s.kinds.find((k) => k.way === of)?.name ?? way,
    pct = (v: number) => `${Math.round(v * 100)}%`;
  return {
    way,
    words: `Under your hand the ${name} came to make up ${pct(waysWorth(s).get(of) ?? 0)} of the drop's life; left alone, they would have made up ${pct(expected.get(of) ?? 0)}.`,
  };
}

/** What a cell is to the first the drop held: "one of the first you saw", "a daughter of them", "of the 5th generation since". */
export function kin(generation: number): string {
  if (generation === 0) return "one of the first you saw";
  if (generation === 1) return "a daughter of the first you saw";
  if (generation === 2) return "a granddaughter of the first you saw";
  const tens = generation % 100,
    end = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][generation % 10] ?? "th");
  return `of the ${generation}${end} generation since you began`;
}

/** What a followed cell is, in words (or what became of it and its line). */
export function followWords(s: DropState, chosen: number): string {
  const c = s.cells.find((x) => x.id === chosen),
    heirs = s.cells.filter((x) => x.marked && x.id !== chosen).length;
  if (!c)
    return heirs
      ? `The cell you followed divided or died; ${heirs} of its line live, ringed.`
      : "The cell you followed is gone, and none of its line lives.";
  const k = s.kinds[c.kind]!;
  return `One of the ${k.name}, ${kin(c.generation)}: ${c.size.toFixed(1)} µm across (its kind began at ${k.size}), going ${c.speed.toFixed(1)} µm a second, ${Math.round((c.energy / worth(c.size)) * 50)}% of the way to dividing.${heirs ? ` ${heirs} of its line live, ringed.` : ""}`;
}

/** Follow a cell and its line (null: none). */
export function follow(s: DropState, chosen: number | null): void {
  for (const c of s.cells) c.marked = c.id === chosen;
}

// —— The drop in the round ——————————————————————————————————————————————————————————————

/** The drop's width in the round (its field across, in the scene's units). */
export const ROUND_W = 12;
const K = ROUND_W / FIELD_W;
/** How much larger than life its cells are drawn, to be seen among the rest. */
const LOOK = 1.7;
/** How deep the water's slab is, before and behind (the scene's units). */
const DEPTH = 2.4;

const unit = (id: number, salt: number) => {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** Where a cell is in the round: across, up (its surface above), and before or behind. */
export function roundOf(c: { id: number; x: number; y: number }): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: (c.x - FIELD_W / 2) * K,
    y: (FIELD_H / 2 - c.y) * K,
    z: (unit(c.id, 3) - 0.5) * DEPTH,
  };
}

/** The drop in the round, by what each part is drawn with. */
export type RoundDrop = {
  /** Each kind's cells and parts, in its own colour (by the drop's kinds, in order). */
  readonly kinds: readonly CellPart[][];
  /** The hunting cells' and the cells together's nuclei. */
  readonly nuclei: readonly CellPart[];
  /** What floats in the water. */
  readonly motes: readonly CellPart[];
  /** A ring about each cell followed, the one tapped the brightest. */
  readonly marks: readonly CellPart[];
};

const part = (
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  yaw = 0,
  pitch = 0,
): CellPart => ({ x, y, z, sx, sy, sz, yaw, pitch });

/**
 * The drop in the round at its own time: a slab of water seen from the side, its surface lit
 * above, its floor below. Small cells are rods along their way; light-eaters round, their
 * green bodies within; a hunting cell a large clear ball, its nucleus and what it took in
 * lately inside it; cells together a ball of cells turning; a cell dividing two halves parting.
 */
export function roundDrop(s: DropState, chosen: number | null = null): RoundDrop {
  const kinds: CellPart[][] = s.kinds.map(() => []),
    nuclei: CellPart[] = [],
    motes: CellPart[] = [],
    marks: CellPart[] = [],
    t = s.t;
  for (const m of s.motes) {
    // (Before or behind as it lies, smoothly: a mote drifting does not leap to and fro.)
    const z = Math.sin(m.x * 0.37 + m.y * 0.11) * Math.cos(m.y * 0.29) * DEPTH * 0.45;
    motes.push(part((m.x - FIELD_W / 2) * K, (FIELD_H / 2 - m.y) * K, z, 0.05, 0.05, 0.05));
  }
  for (const c of s.cells) {
    const at = roundOf(c),
      d = Math.max(0.12, c.size * K * LOOK),
      list = kinds[c.kind]!,
      halves = c.dividing > 0 ? 2 : 1,
      apart = c.dividing > 0 ? (1 - c.dividing / 0.6) * d * 0.45 : 0,
      // (Its way across and up: the drop's down is the round's down.)
      ax = Math.cos(c.heading),
      ay = -Math.sin(c.heading);
    for (let h = 0; h < halves; h++) {
      const side = halves > 1 ? (h ? -1 : 1) : 0,
        x = at.x - ay * apart * side,
        y = at.y + ax * apart * side,
        dd = halves > 1 ? d * 0.8 : d;
      if (c.way === "eater")
        // A rod along its way.
        list.push(part(x, y, at.z, dd * 0.7, dd * 0.7, dd * 1.5, Math.PI / 2, c.heading));
      else if (c.way === "light") {
        list.push(part(x, y, at.z, dd, dd, dd));
        for (let i = 0; i < 3 && dd > 0.3; i++) {
          const a = c.id + i * 2.1 + t * 0.3;
          list.push(
            part(
              x + Math.cos(a) * dd * 0.22,
              y + Math.sin(a) * dd * 0.22,
              at.z,
              dd * 0.24,
              dd * 0.24,
              dd * 0.24,
            ),
          );
        }
      } else if (c.way === "hunter") {
        // (Its skin heaving as it reaches.)
        const q = 1 + 0.06 * Math.sin(t * 1.7 + c.id);
        list.push(part(x, y, at.z, dd * q, dd / q, dd));
        nuclei.push(part(x + dd * 0.12, y + dd * 0.1, at.z, dd * 0.3, dd * 0.3, dd * 0.3));
        c.meals.forEach((m, i) => {
          const a = i * 2.4 + c.id,
            r = Math.max(0.05, dd * 0.12 * (1 - m.age / 8));
          kinds[m.color]?.push(
            part(x + Math.cos(a) * dd * 0.25, y + Math.sin(a) * dd * 0.25, at.z + 0.05, r, r, r),
          );
        });
      } else {
        // A ball of cells, turning.
        const n = 14,
          r = dd * 0.42,
          turn = t * 0.4 + c.id;
        for (let i = 0; i < n; i++) {
          const v = 1 - (2 * (i + 0.5)) / n,
            w = Math.sqrt(1 - v * v),
            a = i * 2.399963 + turn;
          list.push(
            part(
              x + r * w * Math.cos(a),
              y + r * v,
              at.z + r * w * Math.sin(a),
              dd * 0.2,
              dd * 0.2,
              dd * 0.2,
            ),
          );
        }
        nuclei.push(part(x, y, at.z, dd * 0.22, dd * 0.22, dd * 0.22));
      }
    }
    if (c.marked || c.id === chosen) {
      const r = d * (c.id === chosen ? 1.7 : 1.45);
      marks.push(part(at.x, at.y, at.z, r, r, r));
    }
  }
  return { kinds, nuclei, motes, marks };
}
