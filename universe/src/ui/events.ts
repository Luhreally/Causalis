// Event windows (Phase 11 M100): a great happening to what is followed told as a grand
// strategy game tells its events — a window in the middle of the screen with the thing's
// picture, the happening in a few words and why, and what may be done: go to it, read its
// page, let it be, or, where the god's hand can answer, answer it. One at a time; the rest
// wait their turn. The clock may wait while one is open. How they are told, and whether the
// clock waits, are kept in this browser.
import type { Answer, HostClient, PageModel } from "../bridge/index.ts";
import type { Tiding } from "./tidings.ts";
import { WhyTree, el } from "./why.ts";
import { drawPortrait } from "./portrait.ts";

/** How great happenings are told: as windows, as cards among the rest, or not at all. */
export type EventMode = "window" | "card" | "none";

const MODE_KEY = "causalis.events",
  PAUSE_KEY = "causalis.events.pause",
  /** The picture's size (CSS pixels). */
  PICTURE = 104;

function kept(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function keep(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // (A private window: the choice lasts this sitting.)
  }
}

/** What history counts great (a war, a realm split, a faith founded, a first into the sky). */
const GREAT = 6;
/** Great whatever history counts them: a famine where one follows, a realm's fall, a life's end. */
const ALWAYS: ReadonlySet<string> = new Set(["people.famine", "polity.ended", "life.died"]);

/** Whether a tiding is great enough for a window. */
export function isGreat(t: Tiding): boolean {
  return t.importance >= GREAT || ALWAYS.has(t.type);
}

/** A claim without the year it ends on (the window says its year apart). */
function bare(claim: string): string {
  return claim.replace(/,? (?:in )?year -?\d+$/, "");
}

export class EventWindows {
  readonly element = el("section", "event-window");
  private readonly client: HostClient;
  private readonly why: WhyTree;
  private readonly queue: Tiding[] = [];
  private showing: Tiding | null = null;
  /** The clock's speed when a window stopped it (null: no window stopped it). */
  private resumeTo: number | null = null;
  private lastSpeed = 0;
  /** Go to where a happening is to be seen; open a page. */
  onGoTo: (ref: string) => void = () => {};
  onOpen: (ref: string) => void = () => {};

  /** How great happenings are told when the viewer has not chosen: in windows, or as cards. */
  private readonly fallback: EventMode;

  /**
   * `machine`: a machine drives the page (a check or a gate), which windows would stand in the
   * way of: great happenings come as cards unless it asks for windows (as the guided walk
   * keeps away from one).
   */
  constructor(parent: HTMLElement, client: HostClient, machine = false) {
    this.client = client;
    this.fallback = machine ? "card" : "window";
    this.why = new WhyTree(client);
    this.why.onOpen = (ref) => {
      this.onOpen(ref);
      this.letBe();
    };
    this.element.hidden = true;
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-label", "A great happening");
    parent.append(this.element);
    // (The speed to give back: the one it ran at before a window stopped it.)
    client.onStatus((s) => {
      if (this.resumeTo === null) this.lastSpeed = s.speed;
    });
  }

  /** How great happenings are told. */
  get mode(): EventMode {
    const m = kept(MODE_KEY);
    return m === "window" || m === "card" || m === "none" ? m : this.fallback;
  }
  set mode(m: EventMode) {
    keep(MODE_KEY, m);
  }
  /** Whether the clock waits while a window is open. */
  get pauses(): boolean {
    return kept(PAUSE_KEY) !== "no";
  }
  set pauses(on: boolean) {
    keep(PAUSE_KEY, on ? "yes" : "no");
  }

  /** Whether a window is open. */
  get open(): boolean {
    return this.showing !== null;
  }

  /** A great happening: shown now, or when those before it are let be. */
  tell(t: Tiding): void {
    if (this.showing?.ref === t.ref || this.queue.some((q) => q.ref === t.ref)) return;
    this.queue.push(t);
    if (!this.showing) void this.next();
    else this.drawWaiting();
  }

  /** Put this one away, and show the next if one waits. */
  letBe(): void {
    void this.next();
  }

  private async next(): Promise<void> {
    const t = this.queue.shift() ?? null;
    this.showing = t;
    if (!t) {
      this.element.hidden = true;
      this.element.replaceChildren();
      // (The clock given back as it was.)
      if (this.resumeTo !== null) this.client.setSpeed(this.resumeTo);
      this.resumeTo = null;
      return;
    }
    if (this.pauses && this.resumeTo === null && this.lastSpeed > 0) {
      this.resumeTo = this.lastSpeed;
      this.client.setSpeed(0);
    }
    await this.draw(t);
  }

  private readonly waiting = el("span", "event-more");
  private drawWaiting(): void {
    this.waiting.textContent = this.queue.length ? `${this.queue.length} more waiting` : "";
  }

  private async draw(t: Tiding): Promise<void> {
    // Read together: the happening's page (its name and icon), the page of what is followed
    // (its picture), and what the hand may answer.
    const [event, followed, answers] = await Promise.all([
      this.client.query<PageModel>({ type: "page", args: { ref: t.ref } }).catch(() => null),
      this.client.query<PageModel>({ type: "page", args: { ref: t.watch } }).catch(() => null),
      this.client
        .query<Answer[]>({ type: "event.answers", args: { ref: t.ref, watch: t.watch } })
        .catch(() => [] as Answer[]),
    ]);
    if (this.showing !== t) return;
    const head = el("h2", "event-title");
    head.append(
      el("span", "event-icon", event?.icon ?? "📜"),
      el("span", "event-name", event?.title ?? "A great happening"),
    );
    const words = el("div", "event-words"),
      whyBox = el("div", "why event-why");
    words.append(
      el("p", "event-claim", bare(t.claim)),
      el("p", "event-when", `Year ${t.year} · news of ${t.label}`),
      el("h3", undefined, "Why it came to pass"),
      whyBox,
    );
    // (Its first cause opened: why it came to pass, said, not only asked.)
    void this.why
      .show(t.ref, whyBox)
      .then(() => whyBox.querySelector<HTMLButtonElement>("button.cause")?.click());
    const body = el("div", "event-body");
    if (followed?.portrait) {
      const picture = el("canvas", "event-picture");
      body.append(picture);
      drawPortrait(picture, followed.portrait, PICTURE, PICTURE, 0);
    }
    body.append(words);
    // The hand's answers, where it has them.
    const note = el("p", "note"),
      acts: HTMLElement[] = answers.length
        ? [
            el("h3", undefined, "Your hand may answer"),
            ...answers.map((a) => {
              const b = el("button", "act", a.label);
              b.onclick = async () => {
                for (const x of this.element.querySelectorAll<HTMLButtonElement>(".act"))
                  x.disabled = true;
                try {
                  await this.client.command(a.act, a.args);
                  note.textContent = "Done: it is in the chronicle, and its why is yours.";
                  setTimeout(() => {
                    if (this.showing === t) this.letBe();
                  }, 1400);
                } catch (error) {
                  note.textContent = (error as Error).message;
                  for (const x of this.element.querySelectorAll<HTMLButtonElement>(".act"))
                    x.disabled = false;
                }
              };
              return b;
            }),
            note,
          ]
        : [];
    // What may be done besides: go to it, read its page, let it be.
    const go = el("button", "event-go", "⌖ Go to it"),
      page = el("button", "event-page", "Its page"),
      be = el("button", "event-be", "Let it be");
    go.onclick = () => {
      this.onGoTo(t.ref);
      this.letBe();
    };
    page.onclick = () => {
      this.onOpen(t.ref);
      this.letBe();
    };
    be.onclick = () => this.letBe();
    this.drawWaiting();
    const buttons = el("div", "event-buttons");
    buttons.append(go, page, be, this.waiting);
    this.element.replaceChildren(head, body, ...acts, buttons, this.settings());
    this.element.hidden = false;
    be.focus({ preventScroll: true });
  }

  /** How such happenings are told, and whether the clock waits: kept in this browser. */
  private settings(): HTMLElement {
    const box = el("div", "event-settings"),
      how = el("select", "event-mode"),
      wait = el("input"),
      label = el("label", "event-pause");
    for (const [value, words] of [
      ["window", "in windows"],
      ["card", "as cards"],
      ["none", "not at all"],
    ] as const) {
      const o = el("option", undefined, words);
      o.value = value;
      how.append(o);
    }
    how.value = this.mode;
    how.onchange = () => {
      this.mode = how.value as EventMode;
    };
    how.setAttribute("aria-label", "Tell great happenings");
    wait.type = "checkbox";
    wait.checked = this.pauses;
    wait.onchange = () => {
      this.pauses = wait.checked;
    };
    label.append(wait, " The clock waits");
    box.append(el("span", undefined, "Great happenings told "), how, label);
    return box;
  }
}
