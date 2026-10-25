// The eye that watches by itself (Phase 31 M168): its button among the corner's tools (beside the
// free camera's), and while it watches, a caption under the bar telling what is being watched,
// with the way to take the eye back. Any touch of the viewer's on the world takes it back too
// (the page listens for that); a moment's word then says the eye is theirs again.
import { el } from "./why.ts";

/**
 * How long the word that the eye is the viewer's again stays (ms), and over at the least how many
 * frames drawn (on a machine slow to draw, it is still seen).
 */
const LET_GO_MS = 6000,
  LET_GO_FRAMES = 90;

export class DirectorControls {
  readonly button = el("button", "director-button", "🎬");
  readonly caption = el("div", "director-caption");
  private readonly words = el("span", "director-words");
  /** (On a phone, only its hand.) */
  private readonly stop = el("button", "link director-stop", "✋");
  private on = false;
  private letGoFrame = 0;
  /** Asked to watch, or to stop watching. */
  onToggle: (on: boolean) => void = () => {};

  constructor(corner: HTMLElement, hud: HTMLElement) {
    this.button.title =
      "Watch it emerge: the eye goes by itself to each first in the world as it comes, and round the world's life between";
    this.button.setAttribute("aria-label", "Watch it emerge");
    this.button.setAttribute("aria-pressed", "false");
    this.button.onclick = () => this.onToggle(!this.on);
    this.stop.append(el("span", "director-stop-words", " Take the eye"));
    this.stop.setAttribute("aria-label", "Take the eye");
    this.stop.onclick = () => this.onToggle(false);
    this.caption.append(this.words, this.stop);
    this.caption.setAttribute("role", "status");
    this.caption.hidden = true;
    // (Beside the free camera's buttons where they are; else first in the corner.)
    const row = corner.querySelector(".free-buttons");
    if (row) row.prepend(this.button);
    else corner.prepend(this.button);
    hud.append(this.caption);
  }

  get watching(): boolean {
    return this.on;
  }

  /** Watching or not: the button lit, the caption shown while it watches. */
  set watching(on: boolean) {
    this.on = on;
    this.button.classList.toggle("on", on);
    this.button.setAttribute("aria-pressed", String(on));
    cancelAnimationFrame(this.letGoFrame);
    this.stop.hidden = !on;
    if (on) {
      this.caption.hidden = false;
      this.caption.classList.remove("let-go");
    } else {
      this.words.textContent = "✋ The eye is yours again — 🎬 to watch it emerge";
      this.caption.classList.add("let-go");
      // (Gone once it has stood its time over as many frames drawn.)
      const from = performance.now();
      let frames = 0;
      const wait = () => {
        if (++frames >= LET_GO_FRAMES && performance.now() - from >= LET_GO_MS)
          this.caption.hidden = true;
        else this.letGoFrame = requestAnimationFrame(wait);
      };
      this.letGoFrame = requestAnimationFrame(wait);
    }
  }

  /** What is being watched now, in a few words. */
  tell(words: string): void {
    const text = `🎬 ${words}`;
    if (this.words.textContent !== text) this.words.textContent = text;
  }

  /** The caption's words now (for the look tools). */
  get told(): string {
    return this.caption.hidden ? "" : (this.words.textContent ?? "");
  }
}
