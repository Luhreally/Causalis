// Names written on the map (Phase 10 M96): a realm's across its lands, turned along them and
// as large as they are, in the spaced capitals of a grand strategy map; a star at its seat.
// Spans kept from frame to frame, moved by transform only (no layout), never under the pointer.
import { el } from "./why.ts";

export type MapName = {
  readonly key: string;
  readonly text: string;
  /** Where its middle falls (CSS pixels), its turn (degrees) and its letters' size (px). */
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly size: number;
  /** A seat's star, not a name. */
  readonly seat?: boolean;
  /** How strongly it shows (0 … 1): fainter toward the globe's rim. */
  readonly alpha: number;
};

export class MapLabels {
  private readonly root: HTMLElement;
  private readonly pool = new Map<string, HTMLSpanElement>();

  constructor(parent: HTMLElement) {
    this.root = el("div", "mapnames");
    parent.prepend(this.root);
  }

  update(names: readonly MapName[]): void {
    const seen = new Set<string>();
    for (const n of names) {
      seen.add(n.key);
      let span = this.pool.get(n.key);
      if (!span) {
        span = el("span", n.seat ? "mapseat" : "mapname", n.text);
        this.pool.set(n.key, span);
        this.root.append(span);
      }
      if (span.textContent !== n.text) span.textContent = n.text;
      span.style.transform = `translate(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px) translate(-50%, -50%) rotate(${n.angle.toFixed(1)}deg)`;
      span.style.fontSize = `${n.size.toFixed(1)}px`;
      span.style.opacity = n.alpha.toFixed(2);
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
