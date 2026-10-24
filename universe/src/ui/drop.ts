// A drop under the glass (Phase 17 M131, the Observatory's smallest scale): a place's water as
// a microscope shows it, lit from the side so its lives glow on the dark. Small cells run and
// tumble after what floats; light-eaters drift up toward the light; hunting cells close on
// smaller ones and take them in; cells together turn as one. Each lives by its kind's way,
// spends as it lives and moves, and divides when it has eaten enough — its daughters a little
// unlike it, larger or smaller, quicker or slower. What the hunters take leaves fewer like it,
// so the drop's lives change as they are watched: its sizes are charted as the time passes.
// Tap a cell to follow it and its descendants.
//
// The drop runs here, in the view (it is no part of history): seeded by the place, the same
// drop shows the same lives; its steps are fixed, so a slow screen sees what a fast one does.
import type { Block, DropKind } from "../bridge/index.ts";
import { el } from "./why.ts";

type Drop = Extract<Block, { type: "drop" }>;
type Way = DropKind["way"];

/** The drop's field, micrometres across and down. */
export const FIELD_W = 180;
export const FIELD_H = 135;
/** A step of the drop's time (seconds). */
const STEP = 1 / 30;
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

type Mote = { x: number; y: number; vx: number; vy: number };

export type DropState = {
  readonly kinds: readonly DropKind[];
  readonly habitat: Drop["habitat"];
  cells: Cell[];
  motes: Mote[];
  next: number;
  /** Seconds of the drop's time. */
  t: number;
  light: number;
  food: number;
  /** How fast its lives go, by its warmth. */
  readonly pace: number;
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
function worth(size: number): number {
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
function gap(a: number, b: number, size: number): number {
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

/** A new drop: its lives by their kinds' shares, its motes. */
export function newDrop(b: Drop): DropState {
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
    };
  const n = 120;
  b.kinds.forEach((k, kind) => {
    const many = Math.max(1, Math.min(MOST_OF[k.way], Math.round(n * k.share)));
    for (let i = 0; i < many; i++)
      s.cells.push(born(s, kind, null, rnd() * FIELD_W, rnd() * FIELD_H));
  });
  for (let i = 0; i < 160 * b.food; i++)
    s.motes.push({ x: rnd() * FIELD_W, y: rnd() * FIELD_H, vx: 0, vy: 0 });
  record(s);
  return s;
}

/** A cell come into the drop: of its kind, or of its mother (a little unlike her). */
function born(s: DropState, kind: number, mother: Cell | null, x: number, y: number): Cell {
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
      if (!s.cells.some((c) => c.kind === kind) && s.cells.length < MOST)
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

// —— Drawing ————————————————————————————————————————————————————————————————————————————

const BACK: Readonly<Record<Drop["habitat"], [string, string]>> = {
  sea: ["#0b3a4a", "#03121c"],
  fresh: ["#123f33", "#041611"],
  soil: ["#3a2a18", "#120b05"],
  ice: ["#28465e", "#0a1622"],
};

function css(c: readonly number[], a = 1, hue = 0, light = 1): string {
  // (A cell's colour turned a little round the wheel by its line's drift.)
  let [r, g, b] = c as [number, number, number];
  if (hue) {
    const k = (hue * Math.PI) / 180,
      cos = Math.cos(k),
      sin = Math.sin(k),
      m = [
        0.299 + 0.701 * cos + 0.168 * sin,
        0.587 - 0.587 * cos + 0.33 * sin,
        0.114 - 0.114 * cos - 0.497 * sin,
        0.299 - 0.299 * cos - 0.328 * sin,
        0.587 + 0.413 * cos + 0.035 * sin,
        0.114 - 0.114 * cos + 0.292 * sin,
        0.299 - 0.3 * cos + 1.25 * sin,
        0.587 - 0.588 * cos - 1.05 * sin,
        0.114 + 0.886 * cos - 0.203 * sin,
      ];
    [r, g, b] = [
      m[0]! * r + m[1]! * g + m[2]! * b,
      m[3]! * r + m[4]! * g + m[5]! * b,
      m[6]! * r + m[7]! * g + m[8]! * b,
    ];
  }
  const f = (v: number) => Math.round(Math.min(1, Math.max(0, v * light)) * 255);
  return `rgba(${f(r)}, ${f(g)}, ${f(b)}, ${a})`;
}

/** Draw the drop as it stands into a 2D context w × h CSS pixels. */
function paint(
  ctx: CanvasRenderingContext2D,
  s: DropState,
  w: number,
  h: number,
  chosen: number | null,
): void {
  const k = w / FIELD_W,
    [lit, dark] = BACK[s.habitat],
    back = ctx.createRadialGradient(w / 2, h * 0.42, h * 0.1, w / 2, h / 2, Math.max(w, h) * 0.62);
  back.addColorStop(0, lit);
  back.addColorStop(1, dark);
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, w, h);
  // The light from above, where it is water.
  if (s.habitat !== "soil") {
    const sun = ctx.createLinearGradient(0, 0, 0, h);
    sun.addColorStop(0, `rgba(255, 250, 200, ${0.12 * s.light})`);
    sun.addColorStop(1, "rgba(255, 250, 200, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  }
  // Motes.
  ctx.fillStyle = s.habitat === "soil" ? "rgba(214, 186, 140, 0.55)" : "rgba(210, 230, 235, 0.45)";
  for (const m of s.motes) ctx.fillRect(m.x * k - 0.6, m.y * k - 0.6, 1.3, 1.3);
  const t = s.t;
  for (const c of s.cells) {
    const kind = s.kinds[c.kind]!,
      x = c.x * k,
      y = c.y * k,
      r = Math.max(1.6, (c.size / 2) * k),
      parts = c.dividing > 0 ? 2 : 1,
      split = c.dividing > 0 ? (1 - c.dividing / 0.6) * r * 0.9 : 0;
    for (let p = 0; p < parts; p++) {
      const ox = parts > 1 ? Math.cos(c.heading + Math.PI / 2) * split * (p ? -1 : 1) : 0,
        oy = parts > 1 ? Math.sin(c.heading + Math.PI / 2) * split * (p ? -1 : 1) : 0,
        cx = x + ox,
        cy = y + oy,
        rr = parts > 1 ? r * 0.8 : r;
      switch (c.way) {
        case "eater": {
          // A rod, its whip behind it.
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(c.heading);
          ctx.strokeStyle = css(kind.color, 0.45, c.hue);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) {
            const along = -rr * 1.1 - i * rr * 0.55,
              side = Math.sin(t * 18 + i * 1.3 + c.id) * rr * 0.35;
            if (i) ctx.lineTo(along, side);
            else ctx.moveTo(along, side);
          }
          ctx.stroke();
          ctx.fillStyle = css(kind.color, 0.9, c.hue);
          ctx.beginPath();
          ctx.ellipse(0, 0, rr * 1.3, rr * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "light": {
          ctx.fillStyle = css(kind.color, 0.28, c.hue);
          ctx.beginPath();
          ctx.arc(cx, cy, rr * 1.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = css(kind.color, 0.85, c.hue);
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.fill();
          if (rr > 3) {
            ctx.fillStyle = css(kind.color, 0.9, c.hue, 0.55);
            for (let i = 0; i < 3; i++) {
              const a = c.id + i * 2.1 + t * 0.3;
              ctx.beginPath();
              ctx.arc(
                cx + Math.cos(a) * rr * 0.45,
                cy + Math.sin(a) * rr * 0.45,
                rr * 0.22,
                0,
                Math.PI * 2,
              );
              ctx.fill();
            }
          }
          break;
        }
        case "hunter": {
          // A blob that reaches and draws in; its nucleus; what it took in lately.
          ctx.beginPath();
          for (let i = 0; i <= 18; i++) {
            const a = (i / 18) * Math.PI * 2,
              q = 1 + 0.09 * Math.sin(a * 3 + t * 1.7 + c.id) + 0.06 * Math.sin(a * 5 - t * 2.3);
            const px = cx + Math.cos(a) * rr * q,
              py = cy + Math.sin(a) * rr * q;
            if (i) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.fillStyle = css(kind.color, 0.22, c.hue);
          ctx.fill();
          ctx.strokeStyle = css(kind.color, 0.85, c.hue);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = css(kind.color, 0.6, c.hue, 0.7);
          ctx.beginPath();
          ctx.arc(cx + rr * 0.2, cy - rr * 0.15, rr * 0.28, 0, Math.PI * 2);
          ctx.fill();
          c.meals.forEach((m, i) => {
            const a = i * 2.4 + c.id;
            ctx.fillStyle = css(s.kinds[m.color]!.color, 0.75 * (1 - m.age / 8));
            ctx.beginPath();
            ctx.arc(
              cx + Math.cos(a) * rr * 0.5,
              cy + Math.sin(a) * rr * 0.5,
              Math.max(1, rr * 0.1 * (1 - m.age / 8)),
              0,
              Math.PI * 2,
            );
            ctx.fill();
          });
          break;
        }
        case "colony": {
          // A clear ball, its cells about its rim, turning.
          ctx.fillStyle = css(kind.color, 0.1, c.hue);
          ctx.strokeStyle = css(kind.color, 0.5, c.hue);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = css(kind.color, 0.9, c.hue);
          const n = 12;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + t * 0.4 + c.id;
            ctx.beginPath();
            ctx.arc(
              cx + Math.cos(a) * rr * 0.8,
              cy + Math.sin(a) * rr * 0.8,
              Math.max(1, rr * 0.11),
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          for (let i = 0; i < 3; i++) {
            const a = i * 2.1 + t * 0.2 + c.id;
            ctx.fillStyle = css(kind.color, 0.7, c.hue, 0.8);
            ctx.beginPath();
            ctx.arc(
              cx + Math.cos(a) * rr * 0.32,
              cy + Math.sin(a) * rr * 0.32,
              Math.max(1.2, rr * 0.16),
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          break;
        }
      }
    }
    if (c.marked || c.id === chosen) {
      ctx.strokeStyle = c.id === chosen ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = c.id === chosen ? 1.5 : 1;
      ctx.setLineDash(c.id === chosen ? [3, 2] : []);
      ctx.beginPath();
      ctx.arc(x, y, r * 1.5 + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // The glass: its round edge dark, a measure at its foot.
  const edge = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.42,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.66,
  );
  edge.addColorStop(0, "rgba(0, 0, 0, 0)");
  edge.addColorStop(1, "rgba(0, 0, 0, 0.85)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
  const bar = 20 * k;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, h - 12);
  ctx.lineTo(10 + bar, h - 12);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("20 µm", 10, h - 16);
}

/** What a cell is to the first the drop held: "one of the first you saw", "a daughter of them", "of the 5th generation since". */
function kin(generation: number): string {
  if (generation === 0) return "one of the first you saw";
  if (generation === 1) return "a daughter of the first you saw";
  if (generation === 2) return "a granddaughter of the first you saw";
  const tens = generation % 100,
    end = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][generation % 10] ?? "th");
  return `of the ${generation}${end} generation since you began`;
}

/** Minutes and seconds: "1:05". */
function clock(t: number): string {
  const m = Math.floor(t / 60),
    s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The mean sizes through the time watched, a line a kind, against where each began. */
function chart(svg: SVGSVGElement, s: DropState): void {
  const NS = "http://www.w3.org/2000/svg",
    W = 300,
    H = 54,
    h = s.history;
  svg.replaceChildren();
  if (h.length < 2) return;
  const t0 = h[0]!.t,
    t1 = h.at(-1)!.t;
  s.kinds.forEach((k, i) => {
    const pts = h.filter((x) => x.count[i]! > 0);
    if (pts.length < 2) return;
    // (Each kind's size as a share of what it began at: 1 is where it began.)
    const y = (v: number) => H / 2 - (v / k.size - 1) * H * 0.9,
      d = pts
        .map(
          (p, j) =>
            `${j ? "L" : "M"}${(((p.t - t0) / Math.max(1e-6, t1 - t0)) * W).toFixed(1)} ${Math.min(H, Math.max(0, y(p.size[i]!))).toFixed(1)}`,
        )
        .join(" "),
      path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "drop-line");
    path.style.stroke = css(k.color);
    svg.append(path);
  });
  const mid = document.createElementNS(NS, "line");
  mid.setAttribute("x1", "0");
  mid.setAttribute("x2", String(W));
  mid.setAttribute("y1", String(H / 2));
  mid.setAttribute("y2", String(H / 2));
  mid.setAttribute("class", "drop-mid");
  svg.prepend(mid);
}

/** The drop under the glass: its view, its kinds counted, its sizes charted, its buttons. */
export function dropView(
  b: Drop,
  options: { readonly label: (k: DropKind) => HTMLElement },
): HTMLElement {
  const box = el("div", "drop"),
    canvas = el("canvas", "drop-glass"),
    legend = el("div", "drop-legend"),
    bar = el("div", "drop-bar"),
    read = el("p", "drop-read muted"),
    card = el("p", "drop-card"),
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    figure = el("figure", "drop-chart"),
    caption = el(
      "figcaption",
      "muted",
      "Their sizes as you watch (the middle line: what each began at)",
    );
  svg.setAttribute("viewBox", "0 0 300 54");
  svg.setAttribute("preserveAspectRatio", "none");
  figure.append(caption, svg);
  let s = newDrop(b),
    chosen: number | null = null,
    running = false,
    paused = false,
    fast = 1,
    last = 0,
    owed = 0,
    frame = 0,
    shownAt = -1,
    width = 0;
  const counts = b.kinds.map((k) => {
    const row = el("span", "drop-kind"),
      dot = el("span", "drop-dot"),
      n = el("span", "drop-count", "0");
    dot.style.background = css(k.color);
    row.append(dot, options.label(k), n);
    row.title = `${k.name}: of the line of ${k.line}`;
    legend.append(row);
    return n;
  });
  const button = (text: string, title: string, act: (b: HTMLButtonElement) => void) => {
    const x = el("button", "drop-button", text);
    x.type = "button";
    x.title = title;
    x.setAttribute("aria-label", title);
    x.onclick = () => act(x);
    bar.append(x);
    return x;
  };
  button("⏸", "Pause", (x) => {
    paused = !paused;
    x.textContent = paused ? "▶" : "⏸";
    x.title = paused ? "Go on" : "Pause";
  });
  button("⏩", "Faster", (x) => {
    fast = fast === 1 ? 5 : 1;
    x.classList.toggle("on", fast > 1);
  });
  button("☀️", "Shade it", (x) => {
    const shaded = x.textContent === "☁️";
    s.light = shaded ? b.light : b.light * 0.25;
    x.textContent = shaded ? "☀️" : "☁️";
    x.title = shaded ? "Shade it" : "Light it";
  });
  button("🥄", "Stir it", () => {
    for (const c of s.cells) {
      c.heading = s.rnd() * Math.PI * 2;
      c.x = s.rnd() * FIELD_W;
      c.y = s.rnd() * FIELD_H;
    }
  });
  button("✚", "Feed it", () => {
    for (let i = 0; i < 80; i++)
      s.motes.push({ x: s.rnd() * FIELD_W, y: s.rnd() * FIELD_H, vx: 0, vy: 0 });
  });
  button("↺", "A fresh drop", () => {
    s = newDrop(b);
    chosen = null;
    card.textContent = "";
  });
  /** What the followed cell is, in words. */
  const tell = () => {
    if (chosen === null) return;
    const c = s.cells.find((x) => x.id === chosen),
      heirs = s.cells.filter((x) => x.marked && x.id !== chosen).length;
    if (!c) {
      card.textContent = heirs
        ? `The cell you followed divided or died; ${heirs} of its line live, ringed.`
        : "The cell you followed is gone, and none of its line lives.";
      return;
    }
    const k = s.kinds[c.kind]!;
    card.textContent = `One of the ${k.name}, ${kin(c.generation)}: ${c.size.toFixed(1)} µm across (its kind began at ${k.size}), going ${c.speed.toFixed(1)} µm a second, ${Math.round((c.energy / worth(c.size)) * 50)}% of the way to dividing.${heirs ? ` ${heirs} of its line live, ringed.` : ""}`;
  };
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * FIELD_W,
      y = ((e.clientY - r.top) / r.height) * FIELD_H;
    let best: Cell | null = null,
      bd = Infinity;
    for (const c of s.cells) {
      const dx = gap(x, c.x, FIELD_W),
        dy = gap(y, c.y, FIELD_H),
        d = Math.hypot(dx, dy) - c.size / 2;
      if (d < bd) [best, bd] = [c, d];
    }
    for (const c of s.cells) c.marked = false;
    if (best && bd < 8) {
      chosen = best.id;
      best.marked = true;
      tell();
    } else {
      chosen = null;
      card.textContent = "";
    }
  });
  const size = () => {
    // (Within its box, its border of a pixel each side and all.)
    const w = Math.max(240, Math.round((box.clientWidth || 320) - 2)),
      h = Math.round((w * FIELD_H) / FIELD_W),
      dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    if (w === width) return;
    width = w;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  };
  const draw = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !width) return;
    const dpr = canvas.width / width;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, s, width, canvas.height / dpr, chosen);
  };
  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused) {
      owed += dt * fast;
      let steps = 0;
      while (owed >= STEP && steps < 12) {
        stepDrop(s);
        owed -= STEP;
        steps++;
      }
      if (steps === 12) owed = 0;
    }
    draw();
    // (Its numbers, twice a second.)
    if (++frame % 15 === 0 || shownAt < 0) {
      shownAt = s.t;
      const n = b.kinds.map(() => 0);
      for (const c of s.cells) n[c.kind]!++;
      counts.forEach((x, i) => (x.textContent = String(n[i])));
      const gen = s.cells.reduce((a, c) => Math.max(a, c.generation), 0);
      read.textContent = `${clock(s.t)} watched · ${s.born.toLocaleString("en-US")} born · ${s.died.toLocaleString("en-US")} starved · ${s.eaten.toLocaleString("en-US")} taken in · ${gen} generations`;
      chart(svg, s);
      tell();
    }
    requestAnimationFrame(loop);
  };
  // It runs while it is seen, and rests when it is not (scrolled away, its tab left).
  const seen = new IntersectionObserver((entries) => {
    const on = entries.some((x) => x.isIntersecting);
    if (on && !running) {
      running = true;
      size();
      last = performance.now();
      requestAnimationFrame(loop);
    } else if (!on) running = false;
  });
  seen.observe(canvas);
  new ResizeObserver(() => {
    size();
    if (!running) draw();
  }).observe(box);
  box.append(canvas, bar, legend, read, card, figure);
  if (b.words) box.append(el("p", "muted drop-words", b.words));
  return box;
}
