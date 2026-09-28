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
  HEIGHT = 18;

/** How often the panels' places are read again (ms): each read makes the page lay itself out. */
const READ_EVERY = 200;

export class LabelLayer {
  private readonly root: HTMLElement;
  private readonly pool = new Map<string, HTMLSpanElement>();
  private blocking: HTMLElement[] = [];
  /** Where the panels stood when last read, about this layer; and when that was. */
  private blocked: { x0: number; x1: number; y0: number; y1: number }[] = [];
  private readAt = -Infinity;

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
      placed = this.blocked.slice();
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
      if (at) {
        const w = ((l.badge ? l.text.length + 3 : l.text.length) * WIDTH_PER_CHAR) / 2 + 8,
          box = { x0: at.x - w, x1: at.x + w, y0: at.y - HEIGHT, y1: at.y };
        if (placed.some((p) => p.x0 < box.x1 && box.x0 < p.x1 && p.y0 < box.y1 && box.y0 < p.y1))
          at = null;
        else placed.push(box);
      }
      span.hidden = at === null;
      if (at)
        span.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -100%)`;
    }
    for (const [key, span] of this.pool)
      if (!seen.has(key)) {
        span.remove();
        this.pool.delete(key);
      }
  }

  clear(): void {
    this.update([]);
  }
}
