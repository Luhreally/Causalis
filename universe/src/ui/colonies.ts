// The worlds settled (Phase 64): a button in the corner's row once there are any, a sheet of them newest
// first, each a tap from its landing watched and from going down to its ground; and news of one newly
// come, whichever scale the eye is at, for as long as it takes to read. A ship still sailing is listed
// too, with when it comes. Nothing is asked that history does not hold already (host/colony.ts).
import type { ColonyEntry, FillPlan, HostClient } from "../bridge/index.ts";
import { el } from "./why.ts";

const POLL_MS = 4000,
  /** How long news of a landing stays, and how long its button glows. */
  NEWS_MS = 16000;

/** Where a colony stands, in words: a world of the home star's by its name, another star's as that. */
const whereOf = (c: ColonyEntry) =>
  c.star ? "a world of another star" : (c.body ?? "another world");

export class Colonies {
  /** Told aloud, or only listed (quiet under a gate that has not asked to see it, as event windows are). */
  toldAloud = true;
  /** The corner's button (hidden while no one has gone anywhere). */
  readonly button = el("button", "colonies-button");
  private readonly count = el("span", "colonies-count");
  private readonly sheet = el("div", "colony-sheet");
  private readonly rows = el("div", "colony-rows");
  private readonly news = el("div", "colony-news");
  private list: readonly ColonyEntry[] = [];
  /** The colonies no land holds, sent when every kept land was taken (Worlds filled). */
  private far: readonly FillPlan[] = [];
  private known: Set<number> | null = null;
  private newsTimer: ReturnType<typeof setTimeout> | null = null;
  /** Watch its landing played again. */
  onLanding: (cell: number) => void = () => {};
  /** Down to its ground. */
  onDown: (cell: number) => void = () => {};
  /** A thing's page (a ship's voyage; a colony's land). */
  onPage: (ref: string) => void = () => {};
  /** Out to its world seen whole, its settled ground lit. */
  onWorld: (cell: number) => void = () => {};
  /** Out to a world no land holds, by its key. */
  onFar: (key: string) => void = () => {};
  /** Asked before a list is shown: whether anything else is on the screen's bottom edge to put away. */
  onShown: () => void = () => {};

  constructor(hud: HTMLElement, client: HostClient) {
    this.button.append(el("span", undefined, "🚀"), this.count);
    this.button.title = "The worlds settled: watch a landing, or go down to their ground";
    this.button.setAttribute("aria-label", "The worlds settled");
    this.button.hidden = true;
    this.button.onclick = () => {
      this.button.classList.remove("new");
      this.show(!this.shown);
    };
    const head = el("div", "colony-sheet-head"),
      why = el("button", "speed", "?"),
      every = el("button", "speed colony-filled-all", "🌆"),
      close = el("button", "speed", "✕");
    every.title = "Every world settled: how far each is filled, and why no further";
    every.setAttribute("aria-label", "Every world settled");
    every.onclick = () => this.onPage("world:filled");
    why.title = "What a landing is, and why its halls are as they are";
    why.setAttribute("aria-label", "What a colony is");
    why.onclick = () => this.onPage("concept:colonies");
    close.setAttribute("aria-label", "Close the worlds settled");
    close.onclick = () => this.show(false);
    head.append(el("span", "colony-sheet-title", "🚀 The worlds settled"), every, why, close);
    this.sheet.append(head, this.rows);
    this.sheet.hidden = true;
    this.news.hidden = true;
    hud.append(this.sheet, this.news);
    client.subscribe<ColonyEntry[]>({ type: "colony.list" }, POLL_MS, (list) => {
      if (Array.isArray(list)) this.set(list);
    });
    client.subscribe<FillPlan[]>({ type: "filled.far" }, POLL_MS, (far) => {
      if (!Array.isArray(far)) return;
      this.far = far;
      this.button.hidden = this.list.length === 0 && far.length === 0;
      if (!this.list.length) this.count.textContent = String(far.length);
      if (!this.sheet.hidden) this.draw();
    });
  }

  /** The list open or shut. */
  show(on: boolean): void {
    this.sheet.hidden = !on;
    if (on) {
      this.onShown();
      this.draw();
    }
  }

  get shown(): boolean {
    return !this.sheet.hidden;
  }

  /** The newest: the first shown and the first offered. */
  get newest(): ColonyEntry | null {
    return this.list.find((c) => c.town !== null) ?? null;
  }

  private set(list: readonly ColonyEntry[]): void {
    this.list = list;
    const landed = list.filter((c) => !c.sailing);
    this.button.hidden = list.length === 0 && this.far.length === 0;
    this.count.textContent = String(
      landed.length + this.far.filter((p) => !p.sailing).length || list.length || this.far.length,
    );
    // News of what was not here at the last look; and when a world opens with worlds settled already,
    // of how many, and the newest, a tap away.
    if (this.known) {
      const come = landed.find((c) => !this.known!.has(c.cell) && c.town);
      if (come)
        this.tell(
          come,
          `🚀 Year ${come.founded}: a landing on ${whereOf(come)}. ${come.name ?? "Its halls"} is founded.`,
        );
    } else if (landed[0]?.town)
      this.tell(
        landed[0],
        `🚀 ${landed.length} ${landed.length === 1 ? "world" : "worlds"} settled. The newest: ${landed[0].name ?? "halls"} on ${whereOf(landed[0])}, year ${landed[0].founded}.`,
      );
    this.known = new Set(landed.map((c) => c.cell));
    if (!this.sheet.hidden) this.draw();
  }

  /** A word on the same card, nothing to tap. */
  say(words: string): void {
    this.news.replaceChildren(el("span", undefined, words));
    this.news.hidden = false;
    if (this.newsTimer) clearTimeout(this.newsTimer);
    this.newsTimer = setTimeout(() => {
      this.news.hidden = true;
    }, NEWS_MS);
  }

  /** What was being said, said no longer. */
  hush(): void {
    this.news.hidden = true;
  }

  /** News of a landing, with the way to it. */
  private tell(c: ColonyEntry, words: string): void {
    if (!this.toldAloud) return;
    const watch = el("button", undefined, "▶ Watch it");
    watch.onclick = () => {
      this.news.hidden = true;
      this.onLanding(c.cell);
    };
    this.news.replaceChildren(el("span", undefined, words), watch);
    this.news.hidden = false;
    this.button.classList.add("new");
    if (this.newsTimer) clearTimeout(this.newsTimer);
    this.newsTimer = setTimeout(() => {
      this.news.hidden = true;
      this.button.classList.remove("new");
    }, NEWS_MS);
  }

  /** A world no land holds: how far it is settled, and out to it. */
  private farRow(p: FillPlan): HTMLElement {
    const row = el("div", "colony-row"),
      name = el("button", "colony-row-name", p.sailing ? "⛴️ A ship under way" : "🌆 A world of another star"),
      acts = el("div", "colony-row-acts");
    name.onclick = () => this.onPage(p.ref);
    row.append(
      name,
      el(
        "div",
        "colony-row-facts",
        p.sailing
          ? `Comes in year ${p.year}; sent by ${p.who}`
          : `Since year ${p.year}; sent by ${p.who}. ${p.head}`,
      ),
    );
    if (!p.sailing) {
      const whole = el("button", "colony-watch colony-world", "🪐 Its world");
      whole.dataset.key = p.key;
      whole.onclick = () => {
        this.show(false);
        this.onFar(p.key);
      };
      acts.append(whole);
      row.append(acts);
    }
    return row;
  }

  private draw(): void {
    // (A world remade, or being remade, first among them: the rest as history has them. Phase 66.)
    const rank = (c: ColonyEntry) => (c.remade >= 1 ? 2 : c.remade > 0 ? 1 : 0);
    this.rows.replaceChildren(
      ...this.far.map((p) => this.farRow(p)),
      ...[...this.list]
        .sort((a, b) => rank(b) - rank(a))
        .map((c) => {
          const row = el("div", "colony-row"),
            name = el(
              "button",
              "colony-row-name",
              c.sailing ? `⛴️ A ship under way` : `🏛️ ${c.name ?? "Its halls"} on ${whereOf(c)}`,
            ),
            acts = el("div", "colony-row-acts");
          name.onclick = () => {
            this.onPage(c.sailing && c.event ? c.event : `cell:0:${c.cell}`);
          };
          const facts = c.sailing
            ? `Sailed year ${c.sailed ?? "?"}, comes in year ${c.arrives ?? "?"}${c.founder ? `; sent by ${c.founder}` : ""}`
            : `${c.people.toLocaleString("en")} people; since year ${c.founded}${c.founder ? `; sent by ${c.founder}` : ""}${
                c.remade >= 1
                  ? "; its world remade, its air breathed open"
                  : c.remade > 0
                    ? `; its world ${Math.round(c.remade * 100)}% remade`
                    : ""
              }${c.settled >= 0.001 ? `; ${c.settled < 0.095 ? (c.settled * 100).toFixed(1) : Math.round(c.settled * 100)}% of its world settled, ${c.onWorld.toLocaleString("en")} on it` : ""}`;
          row.append(
            name,
            el(
              "div",
              "colony-row-facts",
              c.gone
                ? `No one is here now: its world was unmade in year ${c.gone.year}, by ${c.gone.by ?? "the god's hand"}.`
                : facts,
            ),
          );
          if (c.gone) {
            const whole = el("button", "colony-watch colony-world", "🌑 What is left of it");
            whole.dataset.cell = String(c.cell);
            whole.onclick = () => {
              this.show(false);
              this.onWorld(c.cell);
            };
            acts.append(whole);
            row.append(acts);
          } else if (!c.sailing && c.town) {
            const watch = el("button", "colony-watch", "▶ Watch the landing"),
              whole = el("button", "colony-watch colony-world", "🪐 Its world"),
              down = el("button", "colony-down", "⬇ Go down");
            watch.dataset.cell = down.dataset.cell = whole.dataset.cell = String(c.cell);
            whole.onclick = () => {
              this.show(false);
              this.onWorld(c.cell);
            };
            watch.onclick = () => {
              this.show(false);
              this.onLanding(c.cell);
            };
            down.onclick = () => {
              this.show(false);
              this.onDown(c.cell);
            };
            acts.append(watch, whole, down);
            row.append(acts);
          }
          return row;
        }),
    );
  }
}
