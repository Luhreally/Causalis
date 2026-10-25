// A person's day told (Phase 45 M207; asked for 2026-10-25: "...and just actions of stuff yk"):
// what someone seen near is about from midnight to midnight, a line for each thing in turn — the
// lines gone by dimmed, the one now lit, and one still to come gone on to with a tap (the clock
// taken on to it, the eye kept on them).
import type { DayLine } from "../view/index.ts";
import { el } from "./why.ts";

/** "07:25". */
export const clockOf = (s: number): string =>
  `${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;

export class DayTold {
  readonly element = el("details", "day-told");
  private readonly list = el("ol", "day-lines");
  private key = "";
  /** Go on to a moment of the day (seconds into it): a line still to come, tapped. */
  onGo: (s: number) => void = () => {};

  constructor() {
    (this.element as HTMLDetailsElement).open = true;
    this.element.append(el("summary", "", "Their day"), this.list);
    this.element.hidden = true;
  }

  /**
   * The day's lines and the moment now (seconds into the day), or none; `key` names whose day it
   * is (redrawn only when it, or the line lit, changes).
   */
  show(lines: readonly DayLine[] | null, now: number, key: string): void {
    if (!lines?.length) {
      this.element.hidden = true;
      this.key = "";
      return;
    }
    this.element.hidden = false;
    const at = lines.findIndex((l) => now >= l.from && now < l.to),
      told = `${key}|${at}`;
    if (told === this.key) return;
    this.key = told;
    this.list.replaceChildren(
      ...lines.map((l, i) => {
        const li = el("li", i < at ? "gone" : i === at ? "now" : "next");
        li.append(
          el("span", "day-at", clockOf(l.from)),
          el("span", "day-words", l.times > 1 ? `${l.words} (×${l.times})` : l.words),
        );
        if (i > at) {
          li.title = "Go on to then";
          li.tabIndex = 0;
          li.onclick = () => this.onGo(l.from);
          li.onkeydown = (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            // (Its own press: not the list scrolled, nor the clock paused as Space does.)
            e.preventDefault();
            e.stopPropagation();
            this.onGo(l.from);
          };
        }
        return li;
      }),
    );
    // (The line now in sight, a little down the list.)
    const lit = this.list.children[at] as HTMLElement | undefined;
    if (lit) this.list.scrollTop = Math.max(0, lit.offsetTop - this.list.clientHeight / 3);
  }
}
