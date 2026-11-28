// The guide of a line lived (Live a Line, built with the mode): a welcome the first time the mode is entered (what it is,
// and how to leave it), skipped with a press; then its lessons one at a time in the top's column, each ticking itself off
// as it is done (to steer, to eat, to divide, to choose a daughter, to read the cell's page, to wake), each with a Show me
// that lights what it speaks of; and the whole list on its own panel, to read again, hide, or begin again. What a player
// has done of it is kept in their browser (shown once and remembered), and it can always be opened again by its button.
import { LESSONS, type LessonId } from "../view/line.ts";
import { el } from "./why.ts";

const KEY = "causalis-line-guide";

type Kept = { done: LessonId[]; welcomed: boolean; hidden: boolean; seen: string[] };

function read(): Kept {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const k = JSON.parse(raw) as Partial<Kept>;
      return {
        done: (k.done ?? []).filter((d) => LESSONS.some((l) => l.id === d)),
        welcomed: !!k.welcomed,
        hidden: !!k.hidden,
        seen: Array.isArray(k.seen) ? k.seen.filter((x) => typeof x === "string").slice(0, 64) : [],
      };
    }
  } catch {
    // (For this visit only: a browser that keeps nothing.)
  }
  return { done: [], welcomed: false, hidden: false, seen: [] };
}

export class LineGuide {
  private kept = read();
  private shown: Element | null = null;
  private shownTimer = 0;
  /** A lesson just ticked off, said for a moment before the next. */
  private ticked: string | null = null;
  private tickedTimer = 0;
  /** A help page asked for ("help:guide"). */
  onHelp: (ref: string) => void = () => {};
  /** The guide's panel or the welcome opened over the drop (null: closed). */
  onLayer: (e: HTMLElement | null) => void = () => {};

  private readonly coach: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly root: HTMLElement;

  constructor(coach: HTMLElement, button: HTMLButtonElement, root: HTMLElement) {
    this.coach = coach;
    this.button = button;
    this.root = root;
    this.draw();
  }

  private keep(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.kept));
    } catch {
      // (Kept for this visit only.)
    }
  }

  get welcomed(): boolean {
    return this.kept.welcomed;
  }
  get done(): readonly LessonId[] {
    return this.kept.done;
  }
  get hidden(): boolean {
    return this.kept.hidden;
  }

  /** Whether a new thing (`id`) is met for the first time (then remembered as met): its guide line said once. */
  first(id: string): boolean {
    if (this.kept.hidden || this.kept.seen.includes(id)) return false;
    this.kept.seen.push(id);
    this.keep();
    return true;
  }

  /** A lesson done: ticked off, said, the next one shown. */
  did(id: LessonId): void {
    if (this.kept.done.includes(id)) return;
    this.kept.done.push(id);
    this.keep();
    const l = LESSONS.find((x) => x.id === id);
    if (l && !this.kept.hidden) {
      this.ticked = `✓ ${l.title}`;
      clearTimeout(this.tickedTimer);
      this.tickedTimer = window.setTimeout(() => {
        this.ticked = null;
        this.draw();
      }, 2200);
    }
    this.draw();
  }

  /** The lesson now: the first not yet done (null: all done). */
  get next(): (typeof LESSONS)[number] | null {
    return LESSONS.find((l) => !this.kept.done.includes(l.id)) ?? null;
  }

  /** Whether the lessons, the cell's, are put by: a body lived (their words of specks and dividing are not its). */
  private by = false;
  set away(on: boolean) {
    if (this.by === on) return;
    this.by = on;
    this.coach.dataset.lesson = "";
    this.draw();
  }

  /** The lesson now in the top's column (or what was just done), and the guide's button with how far it has come. */
  draw(): void {
    const n = this.kept.done.length,
      all = LESSONS.length;
    this.button.textContent = n >= all ? "📘 Guide ✓" : `📘 Guide ${n}/${all}`;
    this.button.setAttribute("aria-label", `The guide: ${n} of ${all} done`);
    const next = this.next;
    if (this.kept.hidden || this.by || (!next && !this.ticked)) {
      this.coach.hidden = true;
      this.coach.replaceChildren();
      return;
    }
    this.coach.hidden = false;
    if (this.ticked && (!next || this.coach.dataset.lesson !== next.id)) {
      this.coach.dataset.lesson = "";
      this.coach.replaceChildren(el("p", "line-coach-done", this.ticked));
      return;
    }
    if (!next) return;
    if (this.coach.dataset.lesson === next.id) return;
    this.coach.dataset.lesson = next.id;
    const head = el("div", "line-coach-head"),
      show = el("button", "line-coach-show", "👉 Show me"),
      hide = el("button", "line-coach-hide", "Hide");
    show.onclick = () => this.show(next.show);
    hide.title = "Hide the guide (its button brings it back)";
    hide.onclick = () => this.setHidden(true);
    head.append(
      el("strong", "line-coach-title", `${LESSONS.indexOf(next) + 1}. ${next.title}`),
      show,
      hide,
    );
    this.coach.replaceChildren(head, el("p", "line-coach-words", next.words));
  }

  /** What a lesson speaks of, lit for a few seconds. */
  show(selector: string): void {
    this.shown?.classList.remove("line-shown");
    const e = this.root.querySelector(selector) ?? document.querySelector(selector);
    if (!e) return;
    e.classList.add("line-shown");
    this.shown = e;
    clearTimeout(this.shownTimer);
    this.shownTimer = window.setTimeout(() => e.classList.remove("line-shown"), 3600);
  }

  setHidden(on: boolean): void {
    this.kept.hidden = on;
    this.keep();
    this.coach.dataset.lesson = "";
    this.draw();
  }

  /** Every lesson again, from the first. */
  again(): void {
    this.kept.done = [];
    this.kept.hidden = false;
    this.keep();
    this.coach.dataset.lesson = "";
    this.draw();
  }

  /** The welcome, the first time (skippable): what this mode is, and how to leave it. `begin` once it is passed. */
  welcome(begin: () => void): HTMLElement {
    const card = el("div", "line-card line-welcome"),
      go = el("button", "line-card-go", "Begin"),
      skip = el("button", "line-card-other", "Skip the guide"),
      help = el("button", "line-help", "?");
    help.setAttribute("aria-label", "More about this mode");
    help.onclick = () => this.onHelp("help:mode");
    const head = el("div", "line-card-head");
    head.append(el("h3", "", "Live a Line"), help);
    const done = (guide: boolean) => {
      this.kept.welcomed = true;
      if (!guide) this.kept.hidden = true;
      this.keep();
      this.coach.dataset.lesson = "";
      this.draw();
      this.onLayer(null);
      begin();
    };
    go.onclick = () => done(true);
    skip.onclick = () => done(false);
    const row = el("div", "line-card-row");
    row.append(skip, go);
    card.append(
      head,
      el(
        "p",
        "",
        "You are one cell in your world's first seas. Swim, eat, and divide; at each division choose the daughter you live on in. What your cell can do comes from your world: how thick its seas are, what light reaches them, what its life is made of.",
      ),
      el(
        "p",
        "",
        "Your world waits, held still, exactly where you left it. Press ☀️ Wake at the top right whenever you like: you are back in your world, and nothing you did here has changed it. Your line is kept, to go on with later.",
      ),
      el(
        "p",
        "line-card-small",
        "A short guide shows you each step as you go. You can hide it, and its 📘 button brings it back.",
      ),
      row,
    );
    return card;
  }

  /** The guide's own panel: every lesson, ticked or not, each with Show me; hide it or begin again. */
  panel(close: () => void): HTMLElement {
    const box = el("div", "line-card line-guide-panel"),
      head = el("div", "line-card-head"),
      help = el("button", "line-help", "?"),
      shut = el("button", "line-page-close", "✕ Close");
    help.setAttribute("aria-label", "How the guide works");
    help.onclick = () => this.onHelp("help:guide");
    shut.onclick = close;
    const keys = el("span", "line-page-keys");
    keys.append(help, shut);
    head.append(el("h3", "", "The guide"), keys);
    const list = el("ol", "line-lessons");
    for (const l of LESSONS) {
      const li = el("li", this.kept.done.includes(l.id) ? "line-lesson done" : "line-lesson"),
        top = el("div", "line-lesson-head"),
        show = el("button", "line-coach-show", "👉 Show me");
      show.onclick = () => {
        close();
        this.show(l.show);
      };
      top.append(el("strong", "", `${this.kept.done.includes(l.id) ? "✓" : "○"} ${l.title}`), show);
      li.append(top, el("p", "", l.words));
      list.append(li);
    }
    const row = el("div", "line-card-row"),
      toggle = el(
        "button",
        "line-card-other",
        this.kept.hidden ? "Show the guide" : "Hide the guide",
      ),
      again = el("button", "line-card-other", "Begin the lessons again");
    toggle.onclick = () => {
      this.setHidden(!this.kept.hidden);
      close();
    };
    again.onclick = () => {
      this.again();
      close();
    };
    row.append(toggle, again);
    box.append(head, list, row);
    return box;
  }
}
