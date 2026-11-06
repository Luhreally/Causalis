// Who sings at the feast (T1, classic 58): a small note, while they sing and the eye is free, that says who and what, with the song's first line.
// Pressed, the song's page. It stands aside for any film, window, page, life, possession or reign, and comes back after.
import { el } from "./why.ts";

/** How often it looks (ms). */
const LOOK_MS = 700;

type Sung = {
  readonly ref: string;
  readonly title: string;
  readonly line: string;
  readonly who: string | null;
};

export class SungNote {
  readonly element = el("button", "sung-note");
  private ref = "";

  constructor(
    parent: HTMLElement,
    open: (ref: string) => void,
    now: () => Sung | null,
    busy: () => boolean,
  ) {
    parent.appendChild(this.element);
    this.element.style.display = "none";
    this.element.addEventListener("click", () => {
      if (this.ref) open(this.ref);
    });
    setInterval(() => this.show(busy() ? null : now()), LOOK_MS);
  }

  private show(s: Sung | null): void {
    if (!s) {
      this.ref = "";
      this.element.style.display = "none";
      return;
    }
    this.element.style.display = "";
    if (s.ref === this.ref && this.element.dataset.who === (s.who ?? "")) return;
    this.ref = s.ref;
    this.element.dataset.who = s.who ?? "";
    const head = el("b", "sung-head"),
      line = el("span", "sung-line");
    head.textContent = `🎵 ${s.who ? `${s.who} sings ` : "They sing "}${s.title}`;
    line.textContent = s.line;
    this.element.replaceChildren(head, line);
  }
}
