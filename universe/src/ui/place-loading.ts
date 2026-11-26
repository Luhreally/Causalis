// A town being entered (town mode, O1 of the design review's order): a screen of its own while the mode's chrome and
// scene come, its people are read one by one and laid where they are. Its banner, its name, its year and season, its
// air, two facts of it, and each step as it is truly under way and done (no bar that moves by itself); and a key to
// turn back. It covers the god game's chrome while it stands (body.place-loading), so nothing lies over anything.
import { el } from "./why.ts";

/** The steps of entering, in their order: the mode's own code, its people read, where each of them is. */
export const LOADING_STEPS = [
  "The town mode's chrome and scene",
  "Its people, read one by one",
  "Where each of them is now",
] as const;

export type PlaceLoadingFacts = {
  readonly name: string;
  readonly year: number;
  /** Its air as the god game's bar tells it (null: none told). */
  readonly air: string | null;
  readonly facts: readonly string[];
};

export class PlaceLoading {
  readonly element = el("div", "place-load");
  private readonly title = el("h2", "place-load-name");
  private readonly when = el("p", "place-load-when");
  private readonly facts = el("ul", "place-load-facts");
  private readonly steps = el("ol", "place-load-steps");
  private readonly cancel = el("button", "place-load-cancel", "Turn back");
  private season: string | null = null;
  private year = 0;
  private began = 0;
  /** Turned back before it was entered. */
  onCancel: () => void = () => {};

  constructor(parent: HTMLElement) {
    const card = el("div", "place-load-card"),
      banner = el("div", "place-load-banner");
    banner.setAttribute("aria-hidden", "true");
    this.cancel.onclick = () => this.onCancel();
    card.append(banner, this.title, this.when, this.facts, this.steps, this.cancel);
    this.element.append(card);
    this.element.hidden = true;
    this.element.setAttribute("role", "status");
    this.element.setAttribute("aria-live", "polite");
    parent.append(this.element);
  }

  get shown(): boolean {
    return !this.element.hidden;
  }

  /** Shown for a town: its words, and its steps all still to come. */
  show(x: PlaceLoadingFacts): void {
    this.began = performance.now();
    this.year = x.year;
    this.season = null;
    this.title.textContent = x.name;
    this.said(x.air);
    this.facts.replaceChildren(...x.facts.slice(0, 2).map((f) => el("li", "", f)));
    this.steps.replaceChildren(
      ...LOADING_STEPS.map((words, k) => {
        const li = el("li", "place-load-step");
        li.dataset.step = String(k);
        li.append(el("span", "place-load-mark", "·"), el("span", "", words));
        return li;
      }),
    );
    this.element.hidden = false;
    document.body.classList.add("place-loading");
  }
  private said(air: string | null): void {
    this.when.textContent = [`Year ${this.year}`, this.season, air].filter(Boolean).join(" · ");
  }
  /** Its season, once its place has told it. */
  seasonIs(words: string, air: string | null): void {
    if (this.season === words) return;
    this.season = words;
    this.said(air);
  }
  /** A step begun, or done. */
  step(k: number, done: boolean): void {
    const li = this.steps.querySelector<HTMLElement>(`[data-step="${k}"]`);
    if (!li) return;
    li.classList.toggle("doing", !done);
    li.classList.toggle("done", done);
    li.querySelector(".place-load-mark")!.textContent = done ? "✓" : "…";
  }
  /** Gone: the town is entered, or turned back from. How long it stood (ms). */
  hide(): number {
    if (this.element.hidden) return 0;
    this.element.hidden = true;
    document.body.classList.remove("place-loading");
    return performance.now() - this.began;
  }
}
