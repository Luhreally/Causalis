// The town mode's lessons (G1, asked 2026-11-27: "have it have some built in guide and helper too ... cause it gets real
// confusing"), as RimWorld's learning helper has them: a small card of things to learn, each ticked off by itself as it is
// done, each in a sentence or two with a Show me that lights the real key. It is put away for good with ×, and what is
// done and whether it is put away is kept for the player (in the browser: lost with it, and nothing breaks). On a desk it
// stands at the foot of the right-hand column, the alerts above it kept clear of it; on a phone it stays hidden until it
// is asked for (the menu's Lessons), and then takes the sheet's place, nothing under it.
import { el } from "./why.ts";

/** A lesson: what it is called, what to do in a sentence or two, the key Show me lights, and what to do first where that key is not out. */
export type Lesson = {
  readonly id: string;
  readonly title: string;
  readonly words: string;
  readonly show: string;
  readonly first: string;
};

export const LESSONS: readonly Lesson[] = [
  {
    id: "enter",
    title: "Enter a town",
    words:
      "You are in. Its people go about their day by themselves; you can look, and give orders.",
    show: ".place-name",
    first: "",
  },
  {
    id: "person",
    title: "Open a person",
    words:
      "Tap anyone walking about, or open People at the foot and tap a name. Their page tells what they are doing and why.",
    show: '.place-tab[data-tab="people"]',
    first: "",
  },
  {
    id: "back",
    title: "Go back",
    words: "‹ at the top of a page goes back to what you looked at before, as a browser does.",
    show: ".place-insp-back",
    first: "Open a person or a building first: Back is at the top of its page.",
  },
  {
    id: "mood",
    title: "Read a mood",
    words:
      "On a person's page, Mood lists what cheers them and what weighs on them, and for how long. Below the line, they stop heeding orders.",
    show: '.place-insp-tab[data-tab="mood"]',
    first: "Open a person first: Mood is among the tabs on their page.",
  },
  {
    id: "zone",
    title: "Set a zone",
    words:
      "On a building's page, make it a meeting place for those near, or keep it clear so no one goes there.",
    show: ".place-insp-zones",
    first: "Tap a building in the town first: its zone keys are on its page.",
  },
  {
    id: "build",
    title: "Put up a building",
    words:
      "Build at the foot lists what the town could raise and what it would take. Ask for one, and its people start on it.",
    show: '.place-tab[data-tab="build"]',
    first: "",
  },
  {
    id: "follow",
    title: "Follow someone",
    words:
      "🎯 on a person's page keeps the view on them as they go. Tap it again, or drag the town, to let them go.",
    show: ".place-insp-follow",
    first: "Open a person first: 🎯 is at the top of their page.",
  },
  {
    id: "inside",
    title: "Look inside",
    words: "On a building's page, Inside ▸ shows its rooms and who is in them.",
    show: ".place-insp-inside",
    first: "Tap a building in the town first: Inside ▸ is on its page.",
  },
  {
    id: "alert",
    title: "Answer an alert",
    words:
      "The signs down the right are what needs you: hunger, sickness, danger. Tap one to go to it.",
    show: ".place-alert",
    first: "No alert is up now: when one is, it stands down the right.",
  },
];

/** Where what is learned is kept for the player. */
const KEPT = "causalis.town.lessons";
type Kept = { done: string[]; away: boolean; folded: boolean; welcomed: boolean };

const read = (): Kept => {
  try {
    const k = JSON.parse(localStorage.getItem(KEPT) ?? "null") as Partial<Kept> | null;
    return {
      done: Array.isArray(k?.done) ? k!.done.filter((x) => typeof x === "string") : [],
      away: k?.away === true,
      folded: k?.folded === true,
      welcomed: k?.welcomed === true,
    };
  } catch {
    return { done: [], away: false, folded: false, welcomed: false };
  }
};

/** The lessons' card. */
export class PlaceGuide {
  readonly element = el("section", "place-guide");
  private readonly head = el("header", "place-guide-head");
  private readonly title = el("button", "place-guide-title");
  private readonly shut = el("button", "place-guide-shut", "×");
  private readonly list = el("div", "place-guide-list");
  private readonly said = el("p", "place-guide-said");
  /** Keys the card carries besides its lessons (What now?, G3). */
  readonly extra = el("div", "place-guide-extra");
  private kept: Kept = read();
  /** Asked for on a phone (where it is hidden until it is). */
  private asked = false;
  /** Its height changed: the column above it kept clear of it. */
  onLaid: () => void = () => {};

  constructor() {
    this.shut.setAttribute(
      "aria-label",
      "Put the lessons away (the menu's Lessons brings them back)",
    );
    this.shut.title = this.shut.getAttribute("aria-label")!;
    this.title.onclick = () => {
      this.kept.folded = !this.kept.folded;
      this.save();
      this.draw();
    };
    this.shut.onclick = () => {
      this.kept.away = true;
      this.asked = false;
      this.save();
      this.draw();
    };
    this.head.append(this.title, this.shut);
    this.element.append(this.head, this.list, this.said, this.extra);
    this.draw();
  }

  /** Whether a lesson is done. */
  isDone(id: string): boolean {
    return this.kept.done.includes(id);
  }
  /** A lesson done: ticked off, and kept. */
  done(id: string): void {
    if (this.isDone(id) || !LESSONS.some((l) => l.id === id)) return;
    this.kept.done.push(id);
    this.save();
    this.draw();
  }
  /** Whether it is the player's first time in a town (G4), and that they have been welcomed. */
  get welcomed(): boolean {
    return this.kept.welcomed;
  }
  welcome(): void {
    this.kept.welcomed = true;
    this.save();
  }
  /** Brought out again (the menu's Lessons): on a phone, in the sheet's place. */
  ask(on = true): void {
    this.asked = on;
    if (on) {
      this.kept.away = false;
      this.kept.folded = false;
      this.save();
    }
    this.draw();
  }
  /** Whether it is out on a phone, asked for. */
  get askedFor(): boolean {
    return this.asked && !this.kept.away;
  }
  /** Whether it is out where it docks (a desk), unless put away. */
  get out(): boolean {
    return !this.kept.away;
  }
  /** Every lesson done and the record let go (the look tools; a player's fresh start). */
  reset(): void {
    this.kept = { done: [], away: false, folded: false, welcomed: false };
    this.save();
    this.draw();
  }

  private save(): void {
    try {
      localStorage.setItem(KEPT, JSON.stringify(this.kept));
    } catch {
      // (Kept nowhere: the lessons start again next time.)
    }
  }
  /** Show me: the real key lit for a while and brought into view; else what to do first. */
  private showMe(l: Lesson): void {
    const key = [...document.querySelectorAll<HTMLElement>(l.show)].find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!key) {
      this.said.textContent = l.first || "It is not out now.";
      return;
    }
    this.said.textContent = "";
    key.scrollIntoView({ block: "nearest", inline: "nearest" });
    key.classList.add("place-glow");
    setTimeout(() => key.classList.remove("place-glow"), 4000);
  }
  private draw(): void {
    const n = LESSONS.filter((l) => this.isDone(l.id)).length;
    this.title.textContent = `🎓 Lessons · ${n} of ${LESSONS.length} ${this.kept.folded ? "▸" : "▾"}`;
    this.title.setAttribute("aria-expanded", String(!this.kept.folded));
    this.element.classList.toggle("folded", this.kept.folded);
    this.element.classList.toggle("asked", this.askedFor);
    this.element.hidden = this.kept.away;
    const rows: HTMLElement[] = [];
    for (const l of LESSONS) {
      const row = el("div", `place-guide-lesson${this.isDone(l.id) ? " done" : ""}`);
      row.dataset.lesson = l.id;
      const words = el("div", "place-guide-words");
      words.append(
        el("b", "", `${this.isDone(l.id) ? "✓" : "○"} ${l.title}`),
        el("span", "", ` ${l.words}`),
      );
      row.append(words);
      if (!this.isDone(l.id) && l.id !== "enter") {
        const show = el("button", "place-guide-show", "Show me");
        show.setAttribute("aria-label", `Show me: ${l.title}`);
        show.onclick = () => this.showMe(l);
        row.append(show);
      }
      rows.push(row);
    }
    this.list.replaceChildren(...rows);
    this.onLaid();
  }
}
