// The town mode's lessons (G1, asked 2026-11-27: "have it have some built in guide and helper too ... cause it gets real
// confusing"), as RimWorld's learning helper has them: a small card of things to learn, each ticked off by itself as it is
// done, each in a sentence or two with a Show me that lights the real key. It is put away for good with ×, and what is
// done and whether it is put away is kept for the player (in the browser: lost with it, and nothing breaks). On a desk it
// stands at the foot of the right-hand column, the alerts above it kept clear of it; on a phone it stays hidden until it
// is asked for (the menu's Lessons), and then takes the sheet's place, nothing under it.
//
// Each way of playing has its own track (U6): by hand, the orders (priorities, bills, the draft, the gate); run by its
// head, what the head does and what taking a matter over means; watched, going with someone, Why?, Stay and Next. A lesson
// of more than one way is done once for all of them. The first time each way is taken up its welcome heads the card, out
// in the sheet's place on a phone: what the way is and what to try first, shown once; the menu's Show the guide again
// brings them back.
import type { PlaceMode } from "../bridge/index.ts";
import { el } from "./why.ts";

/**
 * A lesson: what it is called, what to do in a sentence or two (by the way played, where it differs), the key Show me
 * lights, what to do first where that key is not out, and the ways of playing whose track it is on.
 */
export type Lesson = {
  readonly id: string;
  readonly title: string;
  readonly words: string;
  readonly wordsBy?: Partial<Readonly<Record<PlaceMode, string>>>;
  readonly show: string;
  readonly first: string;
  readonly ways: readonly PlaceMode[];
};

const ALL: readonly PlaceMode[] = ["hand", "steward", "watch"],
  HAND: readonly PlaceMode[] = ["hand"],
  RUN: readonly PlaceMode[] = ["hand", "steward"],
  HEAD: readonly PlaceMode[] = ["steward"],
  WATCH: readonly PlaceMode[] = ["watch"];

export const LESSONS: readonly Lesson[] = [
  {
    id: "enter",
    title: "Enter a town",
    words:
      "You are in. Its people go about their day by themselves; you can look, and give orders.",
    wordsBy: {
      steward:
        "You are in. Its people go about their day by themselves, and its head gives their orders; you can look, and take over.",
      watch:
        "You are in. Its people go about their day by themselves; no order is given, and the eye is led to what happens.",
    },
    show: ".place-name",
    first: "",
    ways: ALL,
  },
  {
    id: "watchwith",
    title: "Go with someone",
    words:
      "Tap anyone walking about: the eye goes with them, and the line at the foot says what they are at.",
    show: ".place-watch-text",
    first: "Tap anyone walking about in the town.",
    ways: WATCH,
  },
  {
    id: "headlog",
    title: "See what the head did",
    words:
      "Log at the foot tells each order the head gave, under their name, and why: what pressed them, and how hard.",
    show: '.place-tab[data-tab="log"]',
    first: "",
    ways: HEAD,
  },
  {
    id: "person",
    title: "Open a person",
    words:
      "Tap anyone walking about, or open People at the foot and tap a name. Their page tells what they are doing and why.",
    wordsBy: {
      watch:
        "Tap anyone walking about: their page opens with the eye on them, and tells what they are doing and why.",
    },
    show: '.place-tab[data-tab="people"]',
    first: "",
    ways: ALL,
  },
  {
    id: "head",
    title: "Meet the head",
    words:
      "Tap the head's name in the Log: their page says who runs the town, and what they are like (bold or cautious, thrifty or open-handed).",
    show: '.place-tab[data-tab="log"]',
    first: "",
    ways: HEAD,
  },
  {
    id: "watchwhy",
    title: "Ask why",
    words:
      "Why? on the line at the foot tells why the one the eye is with does what they do, step by step.",
    show: ".place-watch-why",
    first: "The eye is with no one yet: tap anyone first.",
    ways: WATCH,
  },
  {
    id: "back",
    title: "Go back",
    words: "‹ at the top of a page goes back to what you looked at before, as a browser does.",
    show: ".place-insp-back",
    first: "Open a person or a building first: Back is at the top of its page.",
    ways: ALL,
  },
  {
    id: "takeover",
    title: "Take a matter over",
    words:
      "Any order of yours overrules the head's: they leave that matter to you from then on, and say so in the Log. To give it all back, choose ✋ Run it, then 🏛 again.",
    show: '.place-tab[data-tab="dangers"]',
    first: "",
    ways: HEAD,
  },
  {
    id: "watchstay",
    title: "Stay with them",
    words:
      "📌 Stay keeps the eye with the one it is with, whatever else happens; tap it again to be led to what happens.",
    show: ".place-watch-stay",
    first: "The eye is with no one yet: tap anyone first.",
    ways: WATCH,
  },
  {
    id: "mood",
    title: "Read a mood",
    words:
      "On a person's page, Mood lists what cheers them and what weighs on them, and for how long. Below the red tick on its bar, they stop heeding orders.",
    show: '.place-insp-tab[data-tab="mood"]',
    first: "Open a person first: Mood is among the tabs on their page.",
    ways: ALL,
  },
  {
    id: "watchnext",
    title: "On to another",
    words: "⏭ Next takes the eye on to another of the town, and what they are at.",
    show: ".place-watch-next",
    first: "",
    ways: WATCH,
  },
  {
    id: "zone",
    title: "Set a zone",
    words:
      "On a building's page, make it a meeting place for those near, or keep it clear so no one goes there.",
    show: ".place-insp-zones",
    first: "Tap a building in the town first: its zone keys are on its page.",
    ways: HAND,
  },
  {
    id: "build",
    title: "Put up a building",
    words:
      "Build at the foot lists what the town could raise and what it would take. Ask for one, and its people start on it.",
    show: '.place-tab[data-tab="build"]',
    first: "",
    ways: HAND,
  },
  {
    id: "prio",
    title: "Say who works first",
    words:
      "On Work, open the grid: each person's priorities, 1 first, 3 last, – never. Tap a number to change it.",
    show: ".place-grid-open",
    first: "Open Work at the foot first: the grid's key is on it.",
    ways: HAND,
  },
  {
    id: "bills",
    title: "Keep things made",
    words:
      "On Work, under the grid, Bills say how much of each good the town keeps made; its makers stop there and turn to the next.",
    show: ".place-bill-keys",
    first: "Open Work at the foot first: its bills are under the grid.",
    ways: HAND,
  },
  {
    id: "draft",
    title: "Draft someone",
    words:
      "On a person's page, Orders ▾ then ⚔️ Draft puts them under arms by name, where you choose; Stand down lets them go. Pick many on People drafts many at once.",
    show: ".place-insp-order",
    first: "Open a person first: Orders ▾ is on their page.",
    ways: HAND,
  },
  {
    id: "gate",
    title: "Answer the gate",
    words:
      "🏘️ Town, then At the gate: who has come and who comes. Shut it to newcomers, or open it again.",
    show: ".place-insp-gate-key",
    first: "Open 🏘️ Town at the foot first, then At the gate.",
    ways: HAND,
  },
  {
    id: "follow",
    title: "Follow someone",
    words:
      "🎯 Follow on a person's page keeps the view on them as they go, and has their day worked out in full. Tap it again to let them go; dragging the town only moves the view.",
    show: ".place-insp-follow",
    first: "Open a person first: 🎯 is at the top of their page.",
    ways: RUN,
  },
  {
    id: "inside",
    title: "Look inside",
    words: "On a building's page, Inside ▸ shows its rooms and who is in them.",
    show: ".place-insp-inside",
    first: "Tap a building in the town first: Inside ▸ is on its page.",
    ways: ALL,
  },
  {
    id: "town",
    title: "The town's own pages",
    words:
      "🏘️ Town at the foot lists the town's own pages: below ground, its legends, its gate, its bound, its faith, what it lives on, its works and orders, its beasts. Each is a tap away.",
    wordsBy: {
      watch:
        "The town's own pages, in ≡: below ground, its legends, its gate, its bound, its faith, what it lives on, its works and orders, its beasts. Each is a tap away.",
    },
    show: '.place-tab[data-tab="town"], .place-menu-key',
    first:
      "Town is at the foot when the town is run by hand or by its head; when it is watched, it is in ≡.",
    ways: ALL,
  },
  {
    id: "pick",
    title: "Give many one order",
    words:
      "On People, tap Pick many, then tap each one you want (or Pick all on this page), and choose one order for all of them. It says how many took it, and why any did not.",
    show: ".place-pick-key",
    first: "Open People at the foot first: Pick many is beside its name box.",
    ways: HAND,
  },
  {
    id: "alert",
    title: "Answer an alert",
    words:
      "The signs down the right are what needs you: hunger, sickness, danger. Tap one to go to it.",
    wordsBy: {
      watch:
        "The signs down the right are what is happening: hunger, sickness, danger. Tap one to go and see it.",
    },
    show: ".place-alert",
    first: "No alert is up now: when one is, it stands down the right.",
    ways: ALL,
  },
  {
    id: "whatnow",
    title: "Ask what now",
    words:
      "💡 What now?, on this card or in ≡, lists the few things most worth doing next, each a tap from where it is.",
    wordsBy: {
      steward:
        "💡 What now?, on this card or in ≡, says what the head is about to do, and what you might take over.",
      watch:
        "💡 What now?, on this card or in ≡, lists what is most worth seeing now, each with a Go to.",
    },
    show: ".place-guide-now",
    first: "",
    ways: ALL,
  },
];

/** Each way's welcome (U6): its name, what it is, what to try first, and the key its Show me lights. */
export const WELCOMES: Readonly<
  Record<
    PlaceMode,
    { readonly title: string; readonly what: string; readonly first: string; readonly show: string }
  >
> = {
  hand: {
    title: "✋ You run the town",
    what: "Every order is yours: who works at what, what is built, how the town meets a fire or a raid. Left alone, its people still live their day by themselves.",
    first:
      "Try first: open People at the foot and tap a name, then Orders ▾ on their page. Hold a finger on any key to read what it does.",
    show: '.place-tab[data-tab="people"]',
  },
  steward: {
    title: "🏛 Its head runs the town",
    what: "One of its own people gives the orders a player would: an answer to what threatens, a crew for what is going up, work for idle hands. Any order of yours overrules theirs, and they leave that matter to you.",
    first:
      "Try first: open the Log at the foot to see what the head did and why, then 💡 What now? for what they are about to do.",
    show: '.place-tab[data-tab="log"]',
  },
  watch: {
    title: "👁 You watch the town",
    what: "No order is given: the eye is led to what happens (a fire, a birth, a quarrel), and the line at the foot says who it is with.",
    first:
      "Try first: tap anyone to go with them, then Why? at the foot for their reason, and 📌 Stay to keep with them.",
    show: ".place-watch-why",
  },
};

/** Where what is learned is kept for the player. */
const KEPT = "causalis.town.lessons";
type Kept = {
  done: string[];
  away: boolean;
  folded: boolean;
  welcomed: boolean;
  /** The ways whose welcome has been shown (U6). */
  ways: string[];
};

const read = (): Kept => {
  try {
    const k = JSON.parse(localStorage.getItem(KEPT) ?? "null") as Partial<Kept> | null;
    return {
      done: Array.isArray(k?.done) ? k!.done.filter((x) => typeof x === "string") : [],
      away: k?.away === true,
      folded: k?.folded === true,
      welcomed: k?.welcomed === true,
      ways: Array.isArray(k?.ways) ? k!.ways.filter((x) => typeof x === "string") : [],
    };
  } catch {
    return { done: [], away: false, folded: false, welcomed: false, ways: [] };
  }
};

/** The lessons' card. */
export class PlaceGuide {
  readonly element = el("section", "place-guide");
  private readonly head = el("header", "place-guide-head");
  private readonly title = el("button", "place-guide-title");
  private readonly shut = el("button", "place-guide-shut", "×");
  /** A way's welcome, heading the card the first time the way is taken up (U6). */
  private readonly greeting = el("div", "place-guide-welcome");
  private readonly list = el("div", "place-guide-list");
  private readonly said = el("p", "place-guide-said");
  /** Keys the card carries besides its lessons (What now?, G3). */
  readonly extra = el("div", "place-guide-extra");
  private kept: Kept = read();
  /** Asked for on a phone (where it is hidden until it is). */
  private asked = false;
  /** The way of playing whose track it shows (U6), and the way whose welcome heads it now (null: none). */
  private way: PlaceMode = "hand";
  private greeted: PlaceMode | null = null;
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
      this.greeted = null;
      this.save();
      this.draw();
    };
    this.greeting.hidden = true;
    this.head.append(this.title, this.shut);
    this.element.append(this.head, this.greeting, this.list, this.said, this.extra);
    this.draw();
  }

  /** The lessons of the way played now (U6). */
  get track(): readonly Lesson[] {
    return LESSONS.filter((l) => l.ways.includes(this.way));
  }
  /** The way of playing whose track the card shows. */
  setWay(way: PlaceMode): void {
    if (way === this.way) return;
    this.way = way;
    if (this.greeted && this.greeted !== way) this.greeted = null;
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
  /**
   * A way's welcome (U6), the first time it is taken up: the card brought out with it at its head (on a phone in the
   * sheet's place). Shown once, kept as shown at once: a player who goes straight on is not asked again. Whether it
   * was shown now.
   */
  greet(way: PlaceMode): boolean {
    this.setWay(way);
    if (this.kept.ways.includes(way)) return false;
    this.kept.ways.push(way);
    this.save();
    this.greeted = way;
    this.draw();
    return true;
  }
  /** The way whose welcome heads the card now (null: none; the look tools). */
  get greetingWay(): PlaceMode | null {
    return this.greeted;
  }
  /** The guide shown again (the menu's): every welcome let go of, to be shown anew; lessons done stay done. */
  again(): void {
    this.kept.welcomed = false;
    this.kept.ways = [];
    this.kept.away = false;
    this.kept.folded = false;
    this.save();
  }
  /** Brought out again (the menu's Lessons): on a phone, in the sheet's place. Put back (false): its welcome with it. */
  ask(on = true): void {
    this.asked = on;
    if (on) {
      this.kept.away = false;
      this.kept.folded = false;
      this.save();
    } else this.greeted = null;
    this.draw();
  }
  /** Whether it is out on a phone, asked for, or heading a way's welcome. */
  get askedFor(): boolean {
    return (this.asked && !this.kept.away) || this.greeted !== null;
  }
  /** Whether it is out where it docks (a desk), unless put away; a welcome brings it out even so. */
  get out(): boolean {
    return !this.kept.away || this.greeted !== null;
  }
  /** Every lesson done and the record let go (the look tools; a player's fresh start). */
  reset(): void {
    this.kept = { done: [], away: false, folded: false, welcomed: false, ways: [] };
    this.greeted = null;
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
  private showMe(show: string, first: string): void {
    const key = [...document.querySelectorAll<HTMLElement>(show)].find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!key) {
      this.said.textContent = first || "It is not out now.";
      return;
    }
    this.said.textContent = "";
    key.scrollIntoView({ block: "nearest", inline: "nearest" });
    key.classList.add("place-glow");
    setTimeout(() => key.classList.remove("place-glow"), 4000);
  }
  /** The welcome heading the card, for the way greeted (none: hidden). */
  private drawGreeting(): void {
    const way = this.greeted;
    this.greeting.hidden = way === null;
    if (!way) return void this.greeting.replaceChildren();
    const w = WELCOMES[way],
      keys = el("div", "place-guide-welcome-keys"),
      show = el("button", "place-guide-welcome-show", "Show me"),
      ok = el("button", "place-guide-welcome-ok", "Got it");
    this.greeting.dataset.way = way;
    show.setAttribute("aria-label", `Show me where to start: ${w.title}`);
    show.onclick = () => this.showMe(w.show, "");
    // (Got it: the welcome let go; on a phone the card goes back with it, as it came out for it.)
    ok.setAttribute(
      "aria-label",
      "Got it: put the welcome away (≡ Show the guide again brings it back)",
    );
    ok.onclick = () => this.ask(false);
    keys.append(show, ok);
    this.greeting.replaceChildren(
      el("b", "place-guide-welcome-title", w.title),
      el("span", "place-guide-welcome-what", w.what),
      el("span", "place-guide-welcome-first", w.first),
      keys,
    );
  }
  private draw(): void {
    const track = this.track,
      n = track.filter((l) => this.isDone(l.id)).length;
    this.title.textContent = `🎓 Lessons · ${n} of ${track.length} ${this.kept.folded ? "▸" : "▾"}`;
    this.title.setAttribute("aria-expanded", String(!this.kept.folded));
    this.element.classList.toggle("folded", this.kept.folded && this.greeted === null);
    this.element.classList.toggle("asked", this.askedFor);
    this.element.classList.toggle("greeting", this.greeted !== null);
    this.element.dataset.way = this.way;
    this.element.hidden = !this.out;
    this.drawGreeting();
    const rows: HTMLElement[] = [];
    for (const l of track) {
      const row = el("div", `place-guide-lesson${this.isDone(l.id) ? " done" : ""}`);
      row.dataset.lesson = l.id;
      const words = el("div", "place-guide-words");
      words.append(
        el("b", "", `${this.isDone(l.id) ? "✓" : "○"} ${l.title}`),
        el("span", "", ` ${l.wordsBy?.[this.way] ?? l.words}`),
      );
      row.append(words);
      if (!this.isDone(l.id) && l.id !== "enter") {
        const show = el("button", "place-guide-show", "Show me");
        show.setAttribute("aria-label", `Show me: ${l.title}`);
        show.onclick = () => this.showMe(l.show, l.first);
        row.append(show);
      }
      rows.push(row);
    }
    this.list.replaceChildren(...rows);
    this.onLaid();
    // (The first lesson not yet done brought wholly into view in the list, above the card's footer, not left cut at its
    // edge where it looked to lie under the What now? key: U2.)
    requestAnimationFrame(() => {
      const row = this.list.querySelector<HTMLElement>(".place-guide-lesson:not(.done)"),
        h = this.list.clientHeight;
      if (!row || !h) return;
      const top = row.offsetTop - this.list.offsetTop,
        bottom = top + row.offsetHeight;
      if (top < this.list.scrollTop || bottom > this.list.scrollTop + h)
        this.list.scrollTop = Math.min(top, Math.max(0, bottom - h));
    });
  }
}

/**
 * The game's words (U6) as the glossary's page lays them: each word and its line, the one it was opened at lit and
 * marked for bringing into view.
 */
export function glossaryEl(
  words: readonly { readonly key: string; readonly word: string; readonly line: string }[],
  lit: string | null,
): HTMLElement {
  const box = el("dl", "place-glossary");
  for (const w of words) {
    const term = el("dt", `place-glossary-word${w.key === lit ? " lit" : ""}`, w.word),
      line = el("dd", `place-glossary-line${w.key === lit ? " lit" : ""}`, w.line);
    term.dataset.word = w.key;
    box.append(term, line);
  }
  return box;
}

/**
 * A help page's foot (U6): the few game's words it uses, each a key to its line in the glossary, and the glossary
 * itself. `open` is given the glossary's topic ("glossary", or "glossary#bills" at a word).
 */
export function helpFootEl(
  glossed: readonly { readonly key: string; readonly word: string }[],
  open: (topic: string) => void,
): HTMLElement {
  const foot = el("div", "place-help-foot");
  if (glossed.length) {
    foot.append(el("span", "place-help-foot-words", "Words here:"));
    for (const g of glossed) {
      const b = el("button", "place-chip place-help-word", g.word);
      b.dataset.word = g.key;
      b.setAttribute("aria-label", `What "${g.word}" means, in the game's words`);
      b.onclick = () => open(`glossary#${g.key}`);
      foot.append(b);
    }
  }
  const all = el("button", "place-help-glossary", "📖 The game's words");
  all.setAttribute(
    "aria-label",
    "The game's words: each word of the town's pages in one plain line",
  );
  all.onclick = () => open("glossary");
  foot.append(all);
  return foot;
}
