// A tooltip over the scene (Phase 10 M93): what the pointer rests on, in a few words — its
// icon and name, the line under its name, its first numbers — as a grand strategy game tells
// of what lies under the mouse. Read from the host once the pointer has rested on a thing a
// moment, kept a while for the next time; a tap still opens its page.
import type { HostClient, Tip } from "../bridge/index.ts";
import { el } from "./why.ts";
import { tipCard } from "./hovertip.ts";

/** How long the pointer rests before the tip is asked (ms), and how long a tip is kept. */
const REST_MS = 140,
  KEEP_MS = 8000;

export class Tooltip {
  readonly element = el("div", "tooltip");
  private readonly client: HostClient;
  private readonly known = new Map<string, { tip: Tip; at: number }>();
  private showing: string | null = null;
  private waiting: ReturnType<typeof setTimeout> | null = null;
  private at = { x: 0, y: 0 };

  constructor(parent: HTMLElement, client: HostClient) {
    this.client = client;
    this.element.hidden = true;
    this.element.setAttribute("role", "tooltip");
    parent.append(this.element);
  }

  /** The pointer at (x, y) on the screen, resting on `ref` (null: on nothing). */
  point(ref: string | null, x: number, y: number): void {
    this.at = { x, y };
    if (ref !== this.showing) {
      this.showing = ref;
      if (this.waiting) clearTimeout(this.waiting);
      this.waiting = null;
      if (!ref) {
        this.element.hidden = true;
        return;
      }
      const kept = this.known.get(ref);
      if (kept && performance.now() - kept.at < KEEP_MS) this.draw(kept.tip);
      else {
        this.element.hidden = true;
        this.waiting = setTimeout(() => void this.ask(ref), REST_MS);
      }
    }
    this.place();
  }

  hide(): void {
    this.point(null, 0, 0);
  }

  private async ask(ref: string): Promise<void> {
    try {
      const tip = await this.client.query<Tip>({ type: "tip", args: { ref } });
      this.known.set(ref, { tip, at: performance.now() });
      if (this.known.size > 200) this.known.delete(this.known.keys().next().value!);
      if (this.showing === ref) this.draw(tip);
    } catch {
      // (A thing gone: no tip.)
    }
  }

  private draw(tip: Tip): void {
    this.element.replaceChildren(...tipCard(tip, "Tap to open its page"));
    this.element.hidden = false;
    this.place();
  }

  /** Beside the pointer, kept on the screen. */
  private place(): void {
    if (this.element.hidden) return;
    const w = this.element.offsetWidth,
      h = this.element.offsetHeight,
      x = Math.min(innerWidth - w - 8, this.at.x + 16),
      y = this.at.y + 18 + h > innerHeight - 8 ? this.at.y - h - 12 : this.at.y + 18;
    this.element.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  }
}
