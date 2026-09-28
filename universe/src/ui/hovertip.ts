// Tooltips that break things down (Phase 10 M97): a grand strategy game's tooltip on a
// number or a name — what makes the number, part by part, or the thing in a few words. It
// holds still as the pointer moves into it, so a name inside it can be rested on in turn and
// open a tooltip of its own, and that one another. On a desk only: a phone taps instead.
import type { Breakdown, HostClient, Line, Tip } from "../bridge/index.ts";
import { el } from "./why.ts";

/** How long the pointer rests before a tip opens, and how long one lingers once left (ms). */
const REST_MS = 260,
  LINGER_MS = 240,
  /** How long a thing's tip is kept for the next time (ms). */
  KEEP_MS = 8000;

/** What a tip shows, or nothing (then no tip opens). */
export type TipContent = () => Node[] | null | Promise<Node[] | null>;

export class HoverTips {
  private readonly layer = el("div", "hovertips");
  private readonly client: HostClient;
  /** The tips open, each over the one it was opened from. */
  private readonly open: { box: HTMLElement; owner: HTMLElement }[] = [];
  private readonly known = new Map<string, { tip: Tip; at: number }>();
  private waiting: ReturnType<typeof setTimeout> | null = null;
  private lingering: ReturnType<typeof setTimeout> | null = null;
  private readonly desk = matchMedia("(hover: hover) and (pointer: fine)");
  /** Open a thing's page (a name in a tip clicked). */
  onOpen: (ref: string) => void = () => {};

  constructor(parent: HTMLElement, client: HostClient) {
    this.client = client;
    parent.append(this.layer);
    // A press anywhere but in a tip, a turn of the wheel or Esc puts them all away.
    addEventListener(
      "pointerdown",
      (e) => {
        if (!(e.target instanceof Node && this.layer.contains(e.target))) this.closeFrom(0);
      },
      true,
    );
    addEventListener("wheel", () => this.closeFrom(0), { passive: true, capture: true });
    addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeFrom(0);
    });
  }

  /** Whether a tip is open (a page is not read again from under it). */
  get showing(): boolean {
    return this.open.length > 0;
  }

  /** Rest the pointer on `target` a moment and `content` shows beside it. */
  attach(target: HTMLElement, content: TipContent): void {
    target.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || !this.desk.matches) return;
      this.stopLingering();
      if (this.waiting) clearTimeout(this.waiting);
      this.waiting = setTimeout(() => {
        this.waiting = null;
        void this.show(target, content);
      }, REST_MS);
    });
    target.addEventListener("pointerleave", () => {
      if (this.waiting) clearTimeout(this.waiting);
      this.waiting = null;
      this.linger();
    });
  }

  /** A thing's name as a link: a click opens its page, resting on it tells of it in a few words. */
  link(text: string, ref: string, cls = "ref-link"): HTMLElement {
    const a = el("a", cls, text);
    a.href = `#${ref}`;
    a.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeFrom(0);
      this.onOpen(ref);
    };
    this.attach(a, () => this.tipOf(ref));
    return a;
  }

  /** A line of words and names, each name a link. */
  line(line: Line, cls?: string): HTMLElement {
    const box = el("span", cls);
    for (const s of line) box.append(typeof s === "string" ? s : this.link(s.text, s.ref));
    return box;
  }

  /** A thing in a few words: its icon and name, the line under it, its first numbers. */
  async tipOf(ref: string): Promise<Node[] | null> {
    let kept = this.known.get(ref);
    if (!kept || performance.now() - kept.at > KEEP_MS) {
      try {
        kept = {
          tip: await this.client.query<Tip>({ type: "tip", args: { ref } }),
          at: performance.now(),
        };
      } catch {
        return null;
      }
      this.known.set(ref, kept);
      if (this.known.size > 200) this.known.delete(this.known.keys().next().value!);
    }
    return tipCard(kept.tip, "Click to open its page");
  }

  /** Put every tip away. */
  close(): void {
    this.closeFrom(0);
  }

  private async show(owner: HTMLElement, content: TipContent): Promise<void> {
    const nodes = await content();
    // (Shown only while the pointer is still on what asked for it.)
    if (!nodes?.length || !owner.isConnected || !owner.matches(":hover")) return;
    this.closeFrom(this.levelOf(owner));
    const box = el("div", "hovertip");
    box.setAttribute("role", "tooltip");
    box.append(...nodes);
    box.addEventListener("pointerenter", () => this.stopLingering());
    box.addEventListener("pointerleave", () => this.linger());
    this.layer.append(box);
    this.open.push({ box, owner });
    this.place(box, owner);
  }

  /** The level a tip of `owner` opens at: over the tip `owner` stands in, if in one. */
  private levelOf(owner: HTMLElement): number {
    for (let i = this.open.length - 1; i >= 0; i--)
      if (this.open[i]!.box.contains(owner)) return i + 1;
    return 0;
  }

  private closeFrom(level: number): void {
    while (this.open.length > level) this.open.pop()!.box.remove();
  }

  /** Soon, put away each tip the pointer is on neither in nor on the name of. */
  private linger(): void {
    this.stopLingering();
    this.lingering = setTimeout(() => {
      this.lingering = null;
      let keep = 0;
      this.open.forEach(({ box, owner }, i) => {
        if (box.matches(":hover") || (owner.isConnected && owner.matches(":hover"))) keep = i + 1;
      });
      this.closeFrom(keep);
    }, LINGER_MS);
  }

  private stopLingering(): void {
    if (this.lingering) clearTimeout(this.lingering);
    this.lingering = null;
  }

  /** Under what it tells of (over it, if there is no room under), kept on the screen. */
  private place(box: HTMLElement, owner: HTMLElement): void {
    const r = owner.getBoundingClientRect(),
      w = box.offsetWidth,
      h = box.offsetHeight,
      x = Math.max(8, Math.min(innerWidth - w - 8, r.left)),
      y = r.bottom + 6 + h > innerHeight - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6;
    box.style.transform = `translate(${x}px, ${y}px)`;
  }
}

/** A thing's tip as a card: its icon and name, the line under it, its first numbers, a hint. */
export function tipCard(tip: Tip, hint: string): Node[] {
  const head = el("div", "tip-head");
  head.append(el("span", "tip-icon", tip.icon), el("span", "tip-title", tip.title));
  const parts: Node[] = [head];
  if (tip.line) parts.push(el("div", "tip-line", tip.line));
  if (tip.stats.length) {
    const stats = el("div", "tip-stats");
    for (const s of tip.stats)
      stats.append(el("span", "tip-label", s.label), el("span", "tip-value", s.value));
    parts.push(stats);
  }
  parts.push(el("div", "tip-more", hint));
  return parts;
}

/**
 * One of the top bar's numbers broken down: the number in words, then its greatest parts,
 * each a line whose names are links that tell of their things in turn, and what a click does.
 */
export function breakdownCard(
  tips: HoverTips,
  b: Breakdown,
  summary: string,
  hint: string,
): Node[] {
  const head = el("div", "tip-head"),
    rows = el("div", "tip-rows");
  head.append(el("span", "tip-title", summary));
  for (const l of b.lines) rows.append(tips.line(l, "tip-row"));
  return [
    head,
    ...(b.lines.length ? [el("div", "tip-sub", b.title), rows] : []),
    ...(b.more ? [el("div", "tip-line", b.more)] : []),
    el("div", "tip-more", hint),
  ];
}
