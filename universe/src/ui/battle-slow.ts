// A battle drawn near in a land (Phase 40 M203): the land's clock slowed to a day a second for it,
// from its hosts drawn up to their rout, told under the bar with the way to go on at the speed
// chosen (choosing any speed goes on too).
import { el } from "./why.ts";

export class BattleSlowCaption {
  readonly element = el("div", "director-caption battle-slow");
  private readonly words = el("span", "director-words");
  private readonly go = el("button", "link director-stop", "⏩");
  /** Asked to go on at the speed chosen. */
  onGo: () => void = () => {};

  constructor(hud: HTMLElement) {
    this.go.append(el("span", "director-stop-words", " Go on"));
    this.go.setAttribute("aria-label", "Go on at the speed chosen");
    this.go.title = "Go on at the speed chosen";
    this.go.onclick = () => this.onGo();
    this.element.append(this.words, this.go);
    this.element.setAttribute("role", "status");
    this.element.hidden = true;
    hud.append(this.element);
  }

  /** What is told (null: nothing slowed, hidden). */
  show(words: string | null): void {
    const text = words ? `⏳ ${words}` : "";
    if (this.words.textContent !== text) this.words.textContent = text;
    if (this.element.hidden !== !words) this.element.hidden = !words;
  }

  /** The words told now (for the look tools). */
  get told(): string {
    return this.element.hidden ? "" : (this.words.textContent ?? "");
  }
}
