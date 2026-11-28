// A cell of the drop held by hand (Live a Line, S1), in the style of the meadow's beast held (view/meadow.ts holdMeadow):
// the drop's other lives go on by its own step (view/drop.ts stepDrop, untouched: a drop no hand is in lives exactly as
// before), and the cell held is stepped here by the stick. It goes as far as it is pushed and no farther: at a Reynolds
// number far under one, a cell has no way on, and stops the moment it stops pushing. It takes in the food it swims into;
// lives by light while it basks, where its line can; takes in a cell under half its size, where its line has a nucleus;
// and darts, at five times the cost. The drop's hunting cells hunt it as they hunt any cell small enough to take in.
// It divides when it has gathered twice its worth and the hand asks it to; which daughter it lives on in is the hand's
// choice (view/line.ts daughtersOf), the other swims off as one of its line. Kept apart from view/drop.ts so that the god
// game's own pages carry none of it: it comes with the mode's chunk alone (app/line.ts).
import {
  DIGEST,
  FIELD_H,
  FIELD_W,
  MOST,
  MOTE,
  ROCK,
  ROCK_REACH,
  SPEED,
  STEP,
  SUN,
  UPKEEP,
  born,
  gap,
  gapY,
  lightAt,
  placeY,
  stepDrop,
  worth,
  wrap,
  type Cell,
  type DropState,
} from "./drop.ts";
import { wayOf, type Traits } from "./line.ts";

/** How long a dart lasts (seconds of the drop's time), how much faster it goes, and how far a cell may reach to take one in (µm). */
const DART = 1.2,
  DART_FASTER = 2.2,
  REACH = 2,
  /** How far a hunting cell senses one it could take in (µm): the drop's own (view/drop.ts). */
  SENSED = 26;

export type DropHand = {
  readonly id: number;
  /** The stick: its push across the drop and down it (each -1 … 1). */
  mx: number;
  my: number;
  /** The act pressed and not yet done. */
  act: "divide" | "dart" | "engulf" | "bask" | null;
  /** Seconds of a dart left; whether it basks. */
  dart: number;
  bask: boolean;
  /** Its speed in its world's liquid (µm a second: view/line.ts swimSpeed), as its line and its world make it. */
  speed: number;
  traits: Traits;
  /** What the last act came to. */
  told: { words: string; t: number; good: boolean } | null;
  /** What it has done under the hand: food taken, cells taken in, seconds steered, worth gathered since last read. */
  ate: number;
  engulfed: number;
  steered: number;
  gained: number;
  /** Divide was pressed with enough gathered: its daughters wait to be chosen. */
  dividing: boolean;
  /** How its life ended ("": it lives), and by what. */
  ended: "" | "taken" | "starved";
  by: string | null;
};

/** The drop's kind a way is drawn and lived as (its first kind where the drop has none of that way). */
export function kindFor(s: DropState, t: Traits): number {
  const k = s.kinds.findIndex((x) => x.way === wayOf(t));
  if (k >= 0) return k;
  const b = s.kinds.findIndex((x) => x.way === t.base);
  return b >= 0 ? b : 0;
}

/** A cell of the line put into the drop, and the hand in it: where it is asked, else the drop's middle. */
export function holdDrop(
  s: DropState,
  t: Traits,
  speed: number,
  at: { x: number; y: number } | null = null,
  energy: number | null = null,
): DropHand {
  const kind = kindFor(s, t),
    c = born(s, kind, null, at?.x ?? FIELD_W / 2, at?.y ?? FIELD_H * 0.45);
  c.size = t.size;
  c.speed = speed;
  c.energy = energy ?? worth(t.size) * 0.6;
  c.marked = true;
  s.cells.push(c);
  return {
    id: c.id,
    mx: 0,
    my: 0,
    act: null,
    dart: 0,
    bask: false,
    speed,
    traits: t,
    told: null,
    ate: 0,
    engulfed: 0,
    steered: 0,
    gained: 0,
    dividing: false,
    ended: "",
    by: null,
  };
}

export function heldCell(s: DropState, h: DropHand): Cell | null {
  return s.cells.find((c) => c.id === h.id) ?? null;
}

/** The cell nearest the one held that it could take in now (null: none within reach). */
export function preyOf(s: DropState, c: Cell): Cell | null {
  let best: Cell | null = null,
    bd = Infinity;
  for (const o of s.cells) {
    if (o === c || o.size >= c.size * 0.5 || o.dividing > 0) continue;
    const dx = gap(c.x, o.x, FIELD_W),
      dy = gapY(s, c.y, o.y),
      d = Math.sqrt(dx * dx + dy * dy) - (c.size + o.size) / 2;
    if (d < REACH && d < bd) [best, bd] = [o, d];
  }
  return best;
}

/** A hunting cell near enough and large enough to take the one held: how far it is (µm; null: none). */
export function threatOf(s: DropState, c: Cell): number | null {
  let best: number | null = null;
  for (const o of s.cells) {
    if (o.way !== "hunter" || o === c || c.size >= o.size * 0.5) continue;
    const d = Math.hypot(gap(c.x, o.x, FIELD_W), gapY(s, c.y, o.y));
    if (d < SENSED * 1.6 && (best === null || d < best)) best = d;
  }
  return best;
}

/** The nearest food to the one held: how far, and which way (µm; null: none within sight). */
export function foodOf(
  s: DropState,
  c: Cell,
): { d: number; dx: number; dy: number } | null {
  let best: { d: number; dx: number; dy: number } | null = null;
  for (const m of s.motes) {
    const dx = gap(c.x, m.x, FIELD_W),
      dy = gap(c.y, m.y, FIELD_H),
      d = Math.hypot(dx, dy);
    if (d < 60 && (!best || d < best.d)) best = { d, dx, dy };
  }
  return best;
}

/**
 * A step of the drop with a cell held: the rest by its own step, then the one held by the hand — moved as the stick
 * pushes it, fed, taxed for living and for its speed, taken where a hunter reaches it, its act done if it can be.
 */
export function stepHeld(s: DropState, h: DropHand): void {
  const at = s.cells.findIndex((c) => c.id === h.id);
  if (at < 0 || h.ended) {
    stepDrop(s);
    return;
  }
  const c = s.cells[at]!;
  // (The rest of the drop goes on by its own step, the one held set aside while it does: nothing of it moves by itself.)
  s.cells.splice(at, 1);
  stepDrop(s);
  const dt = STEP * s.pace,
    kp = s.paces[c.kind] ?? 1,
    cdt = dt * kp,
    w = worth(c.size),
    way = c.way,
    told = (words: string, good = true) => (h.told = { words, t: s.t, good });
  if (h.dividing) {
    // (Its daughters waiting to be chosen: it stays as it is.)
    s.cells.push(c);
    return;
  }
  h.dart = Math.max(0, h.dart - dt);
  // —— Its act.
  const act = h.act;
  h.act = null;
  if (act === "divide") {
    if (c.energy >= 2 * w) h.dividing = true;
    else told(`Not yet: ${Math.round((c.energy / (2 * w)) * 100)}% of the way to dividing`, false);
  } else if (act === "dart") {
    if (c.energy > w * 0.05) {
      h.dart = DART;
      h.bask = false;
    } else told("Too little left in you to dart", false);
  } else if (act === "engulf") {
    const prey = h.traits.nucleus ? preyOf(s, c) : null;
    if (!prey) told(h.traits.nucleus ? "None near small enough to take in" : "Your line has no nucleus to take in another", false);
    else {
      s.cells.splice(s.cells.indexOf(prey), 1);
      const gain = worth(prey.size) * DIGEST;
      c.energy += gain;
      h.gained += gain;
      h.engulfed++;
      c.meals.push({ color: prey.kind, age: 0 });
      if (c.meals.length > 6) c.meals.shift();
      s.eaten++;
      told(`You took in one of the ${s.kinds[prey.kind]?.name ?? "cells"}`);
    }
  } else if (act === "bask") {
    if (!h.traits.light) told("Your line cannot live by light", false);
    else {
      h.bask = !h.bask;
      if (h.bask) h.dart = 0;
    }
  }
  // —— It moves as far as it is pushed: at its size no way is kept (inertia is nothing to it).
  const push = Math.min(1, Math.hypot(h.mx, h.my)),
    v = h.speed * push * (h.dart > 0 ? DART_FASTER : 1) * (h.bask ? 0.3 : 1);
  if (push > 0.05) {
    c.heading = Math.atan2(h.my, h.mx);
    h.steered += dt;
  }
  c.x = wrap(c.x + Math.cos(c.heading) * v * dt, FIELD_W);
  const y = c.y + Math.sin(c.heading) * v * dt;
  c.y = s.habitat === "soil" ? wrap(y, FIELD_H) : placeY(s, y);
  // —— What it takes in: the food it touches; light while it basks; its grain's chemistry, where its line lives by the rock.
  let gain = 0;
  const reach = (c.size / 2 + 1) ** 2;
  for (let i = s.motes.length - 1; i >= 0; i--) {
    const m = s.motes[i]!,
      dx = gap(c.x, m.x, FIELD_W),
      dy = gap(c.y, m.y, FIELD_H);
    if (dx * dx + dy * dy < reach) {
      s.motes.splice(i, 1);
      gain += MOTE;
      h.ate++;
    }
  }
  if (h.traits.light && h.bask) gain += SUN.light * w * lightAt(s, c.y) * cdt;
  if (h.traits.base === "rock" && s.grain) {
    const g = s.grain,
      d = Math.hypot(gap(c.x, g.x, FIELD_W), gapY(s, c.y, g.y));
    gain += ROCK * w * Math.max(0, 1 - Math.max(0, d - g.r) / ROCK_REACH) * cdt;
  }
  c.energy += gain;
  h.gained += gain;
  // —— What it spends: to keep alive, by its size, and to go, as its speed's square against its way's usual.
  const base = SPEED[way] * kp;
  c.energy -= (UPKEEP[way] * w + 0.002 * w * (v / Math.max(0.1, base)) ** 2) * cdt;
  c.age += cdt;
  for (const m of c.meals) m.age += dt;
  c.meals = c.meals.filter((m) => m.age < 8);
  // —— A hunting cell that reaches it takes it in; one that senses it closes on it, as it would on any cell it could take.
  for (const o of s.cells) {
    if (o.way !== "hunter" || o.dividing > 0 || c.size >= o.size * 0.5) continue;
    const dx = gap(o.x, c.x, FIELD_W),
      dy = gapY(s, o.y, c.y),
      d2 = dx * dx + dy * dy;
    if (d2 < (o.size / 2) ** 2 && o.full <= 0) {
      h.ended = "taken";
      h.by = s.kinds[o.kind]?.name ?? "a hunting cell";
      o.energy += w * DIGEST;
      o.full = w * 0.3;
      o.meals.push({ color: c.kind, age: 0 });
      s.eaten++;
      return;
    }
    if (d2 < SENSED * SENSED && o.full <= 0) o.heading = Math.atan2(dy, dx);
  }
  if (c.energy <= 0) {
    h.ended = "starved";
    s.died++;
    return;
  }
  s.cells.push(c);
}

/**
 * The cell held divided, its daughters' traits as drawn and the one chosen: the hand goes on in the chosen, the others swim
 * off as cells of its line, what it gathered shared among them all (two halves, or three thirds).
 */
export function divideHeld(
  s: DropState,
  h: DropHand,
  daughters: readonly Traits[],
  chosen: number,
  speedOf: (t: Traits) => number,
): DropHand | null {
  const c = heldCell(s, h);
  if (!c || !daughters.length) return null;
  const share = c.energy / daughters.length,
    t = daughters[chosen] ?? daughters[0]!;
  s.cells.splice(s.cells.indexOf(c), 1);
  s.born += daughters.length;
  daughters.forEach((d, i) => {
    if (i === chosen) return;
    if (s.cells.length >= MOST) return;
    const away = c.heading + Math.PI / 2 + i,
      o = born(s, kindFor(s, d), c, 0, 0);
    o.x = wrap(c.x - Math.cos(away) * c.size * 0.6, FIELD_W);
    o.y = placeY(s, c.y - Math.sin(away) * c.size * 0.6);
    o.size = d.size;
    o.speed = speedOf(d);
    o.energy = share;
    o.marked = true;
    o.heading = away;
    s.cells.push(o);
  });
  const next = holdDrop(s, t, speedOf(t), { x: c.x, y: c.y }, share),
    n = heldCell(s, next)!;
  n.generation = c.generation + 1;
  n.heading = c.heading;
  next.ate = h.ate;
  next.engulfed = h.engulfed;
  next.steered = h.steered;
  return next;
}

/**
 * The drop as the eye sees it about the cell held: every cell and speck put across the drop's wrap as near the held one
 * as they truly are, so the eye can follow it round with nothing leaping from one side to the other (a soil's crumb wraps
 * down as well). For view/drop.ts roundDrop, which draws what it is given.
 */
export function aboutHeld(s: DropState, h: DropHand): DropState {
  const c = heldCell(s, h);
  if (!c) return s;
  const cx = c.x,
    cy = c.y,
    soil = s.habitat === "soil",
    x = (v: number) => FIELD_W / 2 + gap(cx, v, FIELD_W),
    y = (v: number) => (soil ? FIELD_H / 2 + gap(cy, v, FIELD_H) : v);
  return {
    ...s,
    cells: s.cells.map((o) => ({ ...o, x: x(o.x), y: y(o.y) })),
    motes: s.motes.map((m) => ({ ...m, x: x(m.x), y: y(m.y) })),
    grain: s.grain ? { ...s.grain, x: x(s.grain.x), y: y(s.grain.y) } : null,
  };
}
