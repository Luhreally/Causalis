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
  normal,
  placeY,
  stepDrop,
  worth,
  wrap,
  type Cell,
  type DropState,
} from "./drop.ts";
import { wayOf, type Traits } from "./line.ts";

/**
 * Where the food of the drop about a held cell comes from, and how much (Live a Line, its food made playable from first
 * principles, 2026-11-28). Specks of food are not made out of the water: they come from a supply the world has. Where the
 * drop has a mineral grain, its vent: what wells up there is fed on and broken down into specks about it. Where it has
 * none, its lit water: what its light-eaters leak and shed, thickest nearest the light. The specks well up there at the
 * rate the drop's own food sets (DropBlock.food, read off its world: host/inspect/small.ts), as many again as the whole
 * drop's water brings, and drift off as every speck does; a held cell begins at that supply's edge, where the food is
 * thick and the rivals that crowd the open water are few. Its rivals eat as they always did, each by its size and pace,
 * sensing a speck only within 10 µm (view/drop.ts): no further than the one held can see one.
 */
export type Supply = { readonly x: number; readonly y: number; readonly r: number; readonly how: "vent" | "light" };
export function supplyOf(s: DropState): Supply {
  const g = s.grain;
  if (g) return { x: g.x, y: g.y, r: g.r + 14, how: "vent" };
  return { x: FIELD_W * 0.2, y: s.habitat === "soil" ? FIELD_H * 0.5 : FIELD_H * 0.12, r: 26, how: "light" };
}
/**
 * Crumbs a second at the supply, for each of the drop's own food (its whole water brings six whole specks), and what a
 * crumb is worth against a whole speck: what wells up is fine, broken down small.
 */
export const SUPPLY = 5,
  CRUMB = 1 / 6;
/** How near the supply's edge a held cell begins (µm), and how far from it the rivals keep at the start. */
const START_OFF = 6,
  CLEAR = 45;
/** What the held cell spends to keep alive, against its kind's in the drop (a held cell is one of a line that has come through; it keeps for a minute or so unfed). */
const HELD_UPKEEP = 0.4;

/**
 * How long a hunting cell must hold the cell held to take it in (s): a cell is wrapped and swallowed, not taken at a touch
 * (engulfing takes the better part of a second at this size); pulled free first, it lives, hurt. How much faster a hunter
 * that senses it closes on it (its lunge, as a hunter of the drop closes on its prey there), and how much slower the one
 * held goes while it is gripped.
 */
export const ENGULF = 0.9,
  LUNGE = 0.5,
  GRIPPED = 0.55;

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
  /** Seconds it has been held in a hunter's grip (ENGULF: taken), and how fresh its last hurt is (1 … 0). */
  caught: number;
  hurt: number;
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
  // (A drop with a cell held is watched at a second of its own time a second: a cold world's chemistry, slower than a warm
  // one's, is not played slower for it. Its kinds keep their paces against one another, as its world sets them.)
  s.pace = 1;
  const kind = kindFor(s, t),
    sup = supplyOf(s),
    start = at ?? { x: wrap(sup.x + sup.r + START_OFF, FIELD_W), y: placeY(s, sup.y) },
    c = born(s, kind, null, start.x, start.y);
  if (!at)
    // (At the supply's edge the rivals are few: those of the open water that crowd it are elsewhere in the drop.)
    for (const o of s.cells) {
      if (o.way !== "eater" && o.way !== "hunter") continue;
      const dx = gap(o.x, start.x, FIELD_W),
        dy = gapY(s, o.y, start.y);
      if (dx * dx + dy * dy < CLEAR * CLEAR) o.x = wrap(o.x + FIELD_W / 2, FIELD_W);
    }
  c.size = t.size;
  c.speed = speed;
  // (As a daughter newly divided: half of the twice its worth its mother gathered.)
  c.energy = energy ?? worth(t.size);
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
    caught: 0,
    hurt: 0,
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

/** The supply's specks for a step: welling up about it, as the drop's own food sets. */
function supply(s: DropState): void {
  // (Every speck of the drop about a held cell is as small as what wells up: a sixth of a small cell's worth, to its
  // rivals as to it. A speck the drop's water brings, or a cell falling apart, is the same.)
  for (const m of s.motes) m.worth ??= MOTE * CRUMB;
  const sup = supplyOf(s),
    r = s.rnd,
    n = s.food * SUPPLY * STEP * s.pace,
    count = Math.floor(n) + (r() < n % 1 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2,
      d = sup.r * Math.sqrt(r());
    s.motes.push({
      x: wrap(sup.x + Math.cos(a) * d, FIELD_W),
      y: placeY(s, sup.y + Math.sin(a) * d * (sup.how === "light" ? 0.5 : 1)),
      vx: normal(r) * 0.3,
      vy: normal(r) * 0.3,
      worth: MOTE * CRUMB,
    });
  }
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
  supply(s);
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
    v =
      h.speed * push * (h.dart > 0 ? DART_FASTER : 1) * (h.bask ? 0.3 : 1) * (h.caught > 0 ? GRIPPED : 1);
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
      gain += m.worth ?? MOTE;
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
  c.energy -= (HELD_UPKEEP * UPKEEP[way] * w + 0.002 * w * (v / Math.max(0.1, base)) ** 2) * cdt;
  c.age += cdt;
  for (const m of c.meals) m.age += dt;
  c.meals = c.meals.filter((m) => m.age < 8);
  // —— A hunting cell that reaches it takes it in; one that senses it closes on it, as it would on any cell it could take.
  let gripped = false;
  h.hurt = Math.max(0, h.hurt - dt * 1.5);
  for (const o of s.cells) {
    if (o.way !== "hunter" || o.dividing > 0 || c.size >= o.size * 0.5) continue;
    const dx = gap(o.x, c.x, FIELD_W),
      dy = gapY(s, o.y, c.y),
      d2 = dx * dx + dy * dy;
    if (d2 < (o.size / 2) ** 2 && o.full <= 0) {
      // (In its grip: wrapped a little more each moment, hurt; held long enough, taken in.)
      gripped = true;
      h.caught += cdt;
      h.hurt = 1;
      if (h.caught >= ENGULF) {
        h.ended = "taken";
        h.by = s.kinds[o.kind]?.name ?? "a hunting cell";
        o.energy += w * DIGEST;
        o.full = w * 0.3;
        o.meals.push({ color: c.kind, age: 0 });
        s.eaten++;
        return;
      }
      continue;
    }
    if (d2 < SENSED * SENSED && o.full <= 0) {
      // (It has sensed the one held: it turns to it, and closes.)
      o.heading = Math.atan2(dy, dx);
      const d = Math.sqrt(d2) || 1,
        step = Math.min(d, LUNGE * o.speed * dt);
      o.x = wrap(o.x + (dx / d) * step, FIELD_W);
      o.y = placeY(s, o.y + (dy / d) * step);
    }
  }
  // (Pulled free, the grip loosens again.)
  if (!gripped) h.caught = Math.max(0, h.caught - dt * 0.6);
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
