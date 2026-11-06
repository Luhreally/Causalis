// What happened while you ran (A1, classic 159): a world run fast or jumped, and back at a pace a person can read, a
// small note of what those years came to, read as the Years read them. It waits for any film, window or page to be
// done, comes once for a run, says nothing where nothing happened, and goes by itself.
import type { RunTold } from "../bridge/index.ts";
import type { TimeBar } from "./timebar.ts";
import { TIME_LADDERS } from "../view/index.ts";
import { lineInto, readFrom } from "./years.ts";
import { el } from "./why.ts";
import { YEAR } from "../kernel/index.ts";
import type { HostClient, Status } from "../bridge/index.ts";

/** Fewer years than this is no run; how long a slower pace must hold; how long the note stays; how often it looks. */
const LEAST_YEARS = 5,
  SETTLE_MS = 1200,
  STAYS_MS = 20000,
  LOOK_MS = 700;

/** A pace a person can't read at: ten years a second anywhere, or years a second where the scale's own pace is slower. */
export function runsFast(speed: number, scale: keyof typeof TIME_LADDERS): boolean {
  return speed >= 10 * YEAR || (speed >= YEAR && speed > TIME_LADDERS[scale].start);
}

export class RunNote {
  readonly element = el("div", "ran-note");
  private readonly parent: HTMLElement;
  private readonly client: HostClient;
  private readonly time: TimeBar;
  private readonly open: (ref: string) => void;
  private readonly busy: () => boolean;
  /** The moment the run began; the moment it stood at last; when the pace last fell. */
  private from: number | null = null;
  private last: number | null = null;
  private fellAt = 0;
  /** A run over, waiting for the eye to be free. */
  private ready: { from: number; to: number; words: string } | null = null;
  private left = 0;
  private looked = 0;
  private stands = false;

  constructor(
    parent: HTMLElement,
    client: HostClient,
    time: TimeBar,
    open: (ref: string) => void,
    busy: () => boolean,
  ) {
    this.client = client;
    this.time = time;
    this.open = open;
    this.busy = busy;
    this.parent = parent;
    client.onStatus((s) => this.saw(s));
    setInterval(() => this.look(), LOOK_MS);
  }

  /** A world taken up again in place: what it was running from is no run. */
  fromNow(): void {
    this.from = null;
    this.ready = null;
    this.close();
  }

  /** The world jumped to where it stands, behind the screen, from its beginning. */
  jumped(): void {
    this.ready = { from: 0, to: -1, words: "While it ran" };
  }

  private saw(s: Status): void {
    const t = s.t,
      fast = runsFast(this.time.speed, this.time.scale);
    // (Held by a window on the way, the run is not over: the viewer has not slowed it.)
    const held = this.time.stopped && !this.time.paused;
    if (fast) {
      // (A run not yet told, and on again: one run.)
      this.from ??= this.ready?.from ?? this.last ?? t;
      this.ready = null;
      this.fellAt = 0;
    } else if (this.from !== null && !held) {
      const now = performance.now();
      if (!this.fellAt) this.fellAt = now;
      else if (now - this.fellAt >= SETTLE_MS) {
        if (t < this.from) this.from = null;
        else {
          const years = (t - this.from) / YEAR;
          if (years >= LEAST_YEARS) this.ready = { from: this.from, to: t, words: "While you ran" };
          this.from = null;
        }
        this.fellAt = 0;
      }
    }
    // (Going back in time, or a world loaded at speed: there was no such run.)
    if (this.from !== null && t < this.from) this.from = null;
    this.last = t;
  }

  /** While a note stands, or waits to. */
  private look(): void {
    const now = performance.now();
    if (this.stands) {
      const busy = this.busy();
      this.element.hidden = busy;
      if (!busy) {
        this.left -= now - this.looked;
        if (this.left <= 0) this.close();
      }
    } else if (this.ready && this.last !== null && !this.busy()) {
      const run = this.ready;
      this.ready = null;
      void this.tell(run);
    }
    this.looked = now;
  }

  private async tell(run: { from: number; to: number; words: string }): Promise<void> {
    let told: RunTold | null = null;
    try {
      told = await this.client.query<RunTold | null>({
        type: "annals.run",
        args: { from: run.from, to: run.to < 0 ? this.last : run.to },
      });
    } catch {
      return;
    }
    if (!told || !told.lines.length) return;
    const head = el("div", "ran-head"),
      close = el("button", "ran-close", "×"),
      lines = el("div", "ran-lines"),
      read = el("button", "ran-read", "📜 Read them");
    close.setAttribute("aria-label", "Put it by");
    close.onclick = () => this.close();
    head.append(
      el(
        "span",
        "ran-title",
        `⏩ ${run.words}, ${told.years.toLocaleString("en")} year${told.years === 1 ? "" : "s"}`,
      ),
      read,
      close,
    );
    for (const l of told.lines) {
      const line = el("div", "ran-line");
      lineInto(line, l.line, (ref) => this.go(ref));
      if (l.ref) {
        const ref = l.ref;
        line.onclick = () => this.go(ref);
      }
      lines.append(line);
    }
    read.onclick = () => {
      readFrom(told.from);
      this.go("world:chronicle#years");
    };
    this.element.replaceChildren(head, lines);
    this.element.hidden = false;
    this.parent.prepend(this.element);
    this.left = STAYS_MS;
    this.stands = true;
  }

  private go(ref: string): void {
    this.close();
    this.open(ref);
  }

  private close(): void {
    this.stands = false;
    this.element.remove();
    this.element.replaceChildren();
  }
}
