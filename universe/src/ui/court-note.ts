// The court sits (J1): a note that can be pressed while it does, saying who stands and for what, as a song's does at a feast.
import { el } from "./why.ts";

const LOOK_MS = 500;

type Sitting = { readonly ref: string; readonly title: string; readonly line: string };

export class CourtNote {
  readonly element = el("button", "sung-note court-note");
  private ref = "";

  constructor(
    parent: HTMLElement,
    open: (ref: string) => void,
    now: () => Sitting | null,
    busy: () => boolean,
  ) {
    parent.appendChild(this.element);
    this.element.style.display = "none";
    this.element.addEventListener("click", () => {
      if (this.ref) open(this.ref);
    });
    setInterval(() => this.show(busy() ? null : now()), LOOK_MS);
  }

  private show(s: Sitting | null): void {
    if (!s) {
      this.ref = "";
      this.element.style.display = "none";
      return;
    }
    this.element.style.display = "";
    if (s.ref === this.ref) return;
    this.ref = s.ref;
    const head = el("b", "sung-head"),
      line = el("span", "sung-line");
    head.textContent = `⚖️ ${s.title} sits`;
    line.textContent = s.line;
    this.element.replaceChildren(head, line);
  }
}
