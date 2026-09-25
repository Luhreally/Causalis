// Names over the scene: a pool of small labels placed at screen positions the
// renderer computes each frame. Labels are reused, never rebuilt per frame.
import { el } from "./why.ts";

export type Label = {
  readonly key: string;
  readonly text: string;
  readonly at: { x: number; y: number } | null;
  /** Larger first: a label that would overlap one already placed is hidden. */
  readonly priority?: number;
};

const WIDTH_PER_CHAR = 7,
  HEIGHT = 18;

export class LabelLayer {
  private readonly root = el("div", "labels");
  private readonly pool = new Map<string, HTMLSpanElement>();
  /** Panels over the scene: a label that would fall under one is hidden. */
  blockers: HTMLElement[] = [];

  constructor(parent: HTMLElement) {
    parent.prepend(this.root);
  }

  update(labels: readonly Label[]): void {
    const seen = new Set<string>(),
      placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const origin = this.root.getBoundingClientRect();
    for (const b of this.blockers)
      for (const r of b.getClientRects())
        placed.push({
          x0: r.left - origin.left,
          x1: r.right - origin.left,
          y0: r.top - origin.top,
          y1: r.bottom - origin.top,
        });
    const order = [...labels].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.key < b.key ? -1 : 1),
    );
    for (const l of order) {
      seen.add(l.key);
      let span = this.pool.get(l.key);
      if (!span) {
        span = el("span", "label", l.text);
        this.pool.set(l.key, span);
        this.root.append(span);
      }
      if (span.textContent !== l.text) span.textContent = l.text;
      let at = l.at;
      if (at) {
        const w = (l.text.length * WIDTH_PER_CHAR) / 2 + 8,
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
