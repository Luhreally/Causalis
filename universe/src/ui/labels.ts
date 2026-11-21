// Names over the scene: a pool of small labels placed at screen positions the
// renderer computes each frame. Labels are reused, never rebuilt per frame.
import { el } from "./why.ts";
import type { ArmsBook } from "./arms.ts";

export type Label = {
  readonly key: string;
  readonly text: string;
  readonly at: { x: number; y: number } | null;
  /** Larger first: a label that would overlap one already placed is hidden. */
  readonly priority?: number;
  /**
   * A host's counter (Phase 11 M101): the realm whose arms it bears, and how it stands to what
   * is followed — its own ("ours"), or against it ("foe").
   */
  readonly badge?: { readonly realm: string; readonly stance?: "ours" | "foe" };
};

const WIDTH_PER_CHAR = 7,
  HEIGHT = 18,
  /** How far a name keeps from the screen's edge (px). */
  EDGE = 4;

/** How often the panels' places are read again (ms): each read makes the page lay itself out. */
const READ_EVERY = 200;
/**
 * How long a name takes to come or go (s): faded in and out where it stands, never shown or hidden within a frame (the
 * owner's rule, 2026-11-21: nothing in view pops as the eye moves). A name one that it would overlap keeps it hidden
 * until clear of it by GIVE px, and one showing keeps showing while it overlaps another by no more than GIVE (no flicker
 * where two names meet).
 */
const FADE = 0.2,
  GIVE = 3;

export class LabelLayer {
  private readonly root: HTMLElement;
  private readonly pool = new Map<string, HTMLSpanElement>();
  private blocking: HTMLElement[] = [];
  /** Where the panels stood when last read, about this layer; and when that was. */
  private blocked: { x0: number; x1: number; y0: number; y1: number }[] = [];
  private readAt = -Infinity;
  /** The layer's size when last read (0: not laid out yet): a name is kept within it. */
  private width = 0;
  private height = 0;
  /** Where the layer stood on the screen when last read, and each name showing, about it. */
  private left = 0;
  private top = 0;
  private readonly shown = new Map<string, { x0: number; x1: number; y0: number; y1: number }>();
  /** How much each name in the pool shows (0 … 1), and where it was last put (to fade out in place). */
  private readonly alpha = new Map<string, number>();
  private readonly lastAt = new Map<string, { x: number; y: number }>();
  /** When the last update was (performance.now ms). */
  private lastUpdate = -Infinity;

  /**
   * Bars along the top of the scene (each scale's own): a name is kept below the one showing, as
   * within the screen's edges (a name under it could be neither read nor tapped).
   */
  ceilings: () => Iterable<HTMLElement> = () => [];
  /** How far down the bar showing reaches, about this layer, when last read (0: none). */
  private ceiling = 0;
  /**
   * Buttons standing down the scene's right edge (the corner's rail): a name level with one is kept to the left of
   * it, as within the screen's edge (a town's name ran under the rail's first button, in a land of any world).
   */
  walls: () => Iterable<HTMLElement> = () => [];
  /** Where each stood when last read, about this layer: its left edge, and from where to where down the screen. */
  private walled: { x: number; y0: number; y1: number }[] = [];

  /** Panels over the scene: a label that would fall under one is hidden. */
  get blockers(): HTMLElement[] {
    return this.blocking;
  }
  set blockers(panels: HTMLElement[]) {
    this.blocking = panels;
    this.readAt = -Infinity;
  }

  private readonly kind: "label" | "bubble";
  /** Realms' arms, for the counters' badges. */
  arms: ArmsBook | null = null;

  /** `kind` names the labels' look: names over homes ("label"), or what people say ("bubble"). */
  constructor(parent: HTMLElement, kind: "label" | "bubble" = "label") {
    this.kind = kind;
    this.root = el("div", `${kind}s`);
    parent.prepend(this.root);
  }

  update(labels: readonly Label[]): void {
    const now = performance.now();
    if (now - this.readAt >= READ_EVERY) {
      // (Read now and then, not every frame: a read after the last frame's writes makes the
      // page lay itself out again before it can go on.)
      this.readAt = now;
      const origin = this.root.getBoundingClientRect();
      this.width = origin.width;
      this.height = origin.height;
      this.left = origin.left;
      this.top = origin.top;
      this.ceiling = 0;
      for (const c of this.ceilings()) {
        const r = c.getBoundingClientRect();
        // (One showing along the top, across the most of it.)
        if (r.height > 0 && r.top - origin.top < HEIGHT && r.width > origin.width / 2)
          this.ceiling = Math.max(this.ceiling, r.bottom - origin.top);
      }
      this.walled = [];
      for (const b of this.walls()) {
        const r = b.getBoundingClientRect();
        // (One showing, in the right half: what stands on the left is no edge to keep names from.)
        if (r.width > 0 && r.height > 0 && r.left - origin.left > origin.width / 2)
          this.walled.push({
            x: r.left - origin.left,
            y0: r.top - origin.top,
            y1: r.bottom - origin.top,
          });
      }
      this.blocked = [];
      for (const b of this.blocking)
        for (const r of b.getClientRects())
          this.blocked.push({
            x0: r.left - origin.left,
            x1: r.right - origin.left,
            y0: r.top - origin.top,
            y1: r.bottom - origin.top,
          });
    }
    const seen = new Set<string>(),
      placed = this.blocked.slice(),
      step = Math.min(0.1, Math.max(0, (now - this.lastUpdate) / 1000)) / FADE;
    this.lastUpdate = now;
    const wasShown = new Set(this.shown.keys());
    this.shown.clear();
    const order = [...labels].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.key < b.key ? -1 : 1),
    );
    for (const l of order) {
      seen.add(l.key);
      let span = this.pool.get(l.key);
      if (!span) {
        span = el("span", this.kind, l.badge ? "" : l.text);
        // (A counter: its realm's arms, and the men it fields beside them.)
        if (l.badge) {
          span.classList.add("counter");
          span.append(
            this.arms ? this.arms.shield(l.badge.realm, 14) : el("span", undefined, "🛡️"),
            el("b", "counter-value", l.text),
          );
        }
        this.pool.set(l.key, span);
        this.root.append(span);
      }
      if (l.badge) {
        const value = span.lastElementChild!;
        if (value.textContent !== l.text) value.textContent = l.text;
        span.classList.toggle("ours", l.badge.stance === "ours");
        span.classList.toggle("foe", l.badge.stance === "foe");
      } else if (span.textContent !== l.text) span.textContent = l.text;
      let at = l.at;
      const w = ((l.badge ? l.text.length + 3 : l.text.length) * WIDTH_PER_CHAR) / 2 + 8;
      // (A name whose place is off the screen is hidden; one at its edge, or under the bar along
      // its top, moved within it.)
      if (at && this.width > 0 && this.height > 0) {
        if (at.x < 0 || at.x > this.width || at.y < 0 || at.y > this.height) at = null;
        else {
          const y = Math.max(at.y, this.ceiling + HEIGHT + EDGE);
          // (The right edge it keeps within: the screen's, or a rail button's it is level with.)
          let right = this.width;
          for (const wall of this.walled)
            if (wall.y0 < y && y - HEIGHT < wall.y1) right = Math.min(right, wall.x);
          at = { x: Math.max(Math.min(at.x, right - w - EDGE), w + EDGE), y };
        }
      }
      // (Hidden by another, it fades out where it stands now, still on what it names.)
      const pos = at;
      if (at) {
        const box = { x0: at.x - w, x1: at.x + w, y0: at.y - HEIGHT, y1: at.y },
          // (Showing: kept while it overlaps by no more than GIVE; hidden: back only once GIVE clear.)
          g = wasShown.has(l.key) ? -GIVE : GIVE;
        if (
          placed.some(
            (p) => p.x0 < box.x1 + g && box.x0 - g < p.x1 && p.y0 < box.y1 + g && box.y0 - g < p.y1,
          )
        )
          at = null;
        else {
          placed.push(box);
          this.shown.set(l.key, box);
        }
      }
      this.fade(l.key, span, pos, at !== null, step);
    }
    for (const [key, span] of this.pool)
      if (!seen.has(key)) {
        // (Gone from the list: faded out where it last stood, then let go.)
        if (this.fade(key, span, null, false, step) > 0) continue;
        span.remove();
        this.pool.delete(key);
        this.alpha.delete(key);
        this.lastAt.delete(key);
      }
  }

  /**
   * A name's showing stepped toward shown or not, put where it stands now (`at`: null, off the screen or gone from the
   * list: where it last stood); how much it shows now.
   */
  private fade(
    key: string,
    span: HTMLSpanElement,
    at: { x: number; y: number } | null,
    show: boolean,
    step: number,
  ): number {
    const was = this.alpha.get(key) ?? 0,
      a = show ? Math.min(1, was + step) : Math.max(0, was - step),
      put = at ?? this.lastAt.get(key);
    this.alpha.set(key, a);
    const hide = a <= 0 || !put;
    if (span.hidden !== hide) span.hidden = hide;
    if (hide) return 0;
    if (at) this.lastAt.set(key, at);
    const o = a >= 1 ? "" : a.toFixed(2);
    if (span.style.opacity !== o) span.style.opacity = o;
    if (at && (at.x !== put!.x || at.y !== put!.y || span.style.transform === ""))
      span.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -100%)`;
    return a;
  }

  /**
   * The key of the name shown at a point of the screen (client px), if one is: a tap on a name
   * moved in from the edge, or from under the bar, is a tap on what it names.
   */
  keyAt(x: number, y: number): string | null {
    const px = x - this.left,
      py = y - this.top;
    for (const [key, b] of this.shown)
      if (px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1) return key;
    return null;
  }

  /** Whether any name is up or fading (its updates must go on, an empty list among them, until none is). */
  get busy(): boolean {
    return this.pool.size > 0;
  }

  /** All names gone at once (the scale they stood over is gone). */
  clear(): void {
    for (const span of this.pool.values()) span.remove();
    this.pool.clear();
    this.alpha.clear();
    this.lastAt.clear();
    this.shown.clear();
  }
}
