// A camp seen near (Phase 29 M160): the bar over a band of a land's camp watched — back to the
// land, whose camp it is, the clock at the band's own speeds (a day of theirs in two minutes, in
// one, in forty seconds) — and what the band is at now, in a line under it.
import { el } from "./why.ts";
import { steerWords } from "./keys.ts";

export class CampPanel {
  readonly element = el("div", "panel");
  /** Where the clock's bar goes in this bar. */
  readonly timeSlot = el("span", "time-slot");
  private readonly where = el("span", "clock");
  private readonly doing = el("span", "camp-doing");
  /** What the band keeps (Phase 49 M211): its spears, blades, cord, hides, cloaks, colour. */
  private readonly kept = el("span", "camp-kit");
  private readonly back = el("button", "speed", "‹ The land");
  private readonly page = el("button", "speed", "⛺ The camp");
  onBack: () => void = () => {};
  /** The camp's page. */
  onPage: () => void = () => {};

  constructor(root: HTMLElement) {
    const bar = el("header", "bar");
    this.back.onclick = () => this.onBack();
    this.page.onclick = () => this.onPage();
    this.page.title = "The camp's page: who they are, how they live, how far they range";
    this.doing.title = steerWords("flat");
    this.kept.title = "What the band keeps: what they have made";
    bar.append(this.back, this.where, this.timeSlot, this.page, this.doing, this.kept);
    this.element.append(bar);
    root.append(this.element);
    this.visible = false;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  /** Whose camp it is, in the bar. */
  show(where: string): void {
    this.where.textContent = where;
  }

  /** What the band is at now. */
  say(words: string): void {
    if (this.doing.textContent !== words) this.doing.textContent = words;
  }

  /** What the band keeps. */
  kit(words: string): void {
    if (this.kept.textContent !== words) this.kept.textContent = words;
  }
}
