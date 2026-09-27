// A short guided walk of the observatory (Phase 7 M71): after the first welcome, a card
// at the foot of the screen shows one thing at a time, and moves on when the viewer has
// done it (or taps Next). It can be skipped, and "Help" walks it again. It only watches
// what the viewer does; it never touches the world.
import { el } from "./why.ts";

/** What the viewer did, as the walk listens for it. */
export type WalkCue = "land" | "why" | "lens" | "scale";

type Step = { text: string; until: WalkCue | null };

const STEPS: readonly Step[] = [
  { text: "This is the world, turning in its year. Tap any land to look at it.", until: "land" },
  {
    text: "Every line here stands for something. Tap one to ask why it is so — each answer opens onto its causes.",
    until: "why",
  },
  {
    text: "The buttons along the top are lenses: they colour the world by people, food, trade, tongues, realms, life. Try one.",
    until: "lens",
  },
  {
    text: "“Look closer” goes down to a land's villages and its people; “The sky” goes out to the star's worlds, and on to the stars.",
    until: "scale",
  },
  {
    text: "Time runs on its own; pause it or speed it along from the top. That is all — the rest is there to be found.",
    until: null,
  },
];

const KEY = "causalis.walked";

export class GuidedWalk {
  readonly element = el("aside", "walk");
  private readonly text = el("p");
  private readonly count = el("span", "muted");
  private at = -1;

  /** Shown within `root` (the bar at the top: it covers nothing the steps ask for). */
  constructor(root: HTMLElement) {
    const next = el("button", "walk-next", "Next"),
      skip = el("button", "link", "Skip");
    next.onclick = () => this.step(this.at + 1);
    skip.onclick = () => this.end();
    const row = el("div", "walk-row");
    row.append(this.count, skip, next);
    this.element.append(this.text, row);
    this.element.hidden = true;
    this.element.setAttribute("role", "status");
    root.append(this.element);
  }

  /** Whether the walk has been taken (or skipped) in this browser. */
  static walked(): boolean {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return true;
    }
  }

  /** Begin the walk from its first step. */
  start(): void {
    this.step(0);
  }

  /** The viewer did something: if it is what the step waits for, move on. */
  saw(cue: WalkCue): void {
    if (this.at >= 0 && STEPS[this.at]?.until === cue) this.step(this.at + 1);
  }

  /** The step shown (from 0), or -1 when the walk is not showing. */
  get current(): number {
    return this.at;
  }

  private step(i: number): void {
    if (i >= STEPS.length) return this.end();
    this.at = i;
    this.text.textContent = STEPS[i]!.text;
    this.count.textContent = `${i + 1} of ${STEPS.length}`;
    this.element.hidden = false;
  }

  private end(): void {
    this.at = -1;
    this.element.hidden = true;
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Nothing to remember it in: fine.
    }
  }
}
