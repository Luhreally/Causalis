// The wars among the stars (Phase 67): a sheet of the fights among the stars, newest first. Each
// row names the fight and says who won and what came of it on the ground. Its name opens its page,
// and "Watch it" plays the fight. The first row is the world's wars of the last hundred years, the
// old action of the wars button. The list is read from history (host/starfight.ts); nothing here is kept.
import type { StarFightEntry, StarFightList } from "../bridge/index.ts";
import { el } from "./why.ts";

const NO_FIGHTS: StarFightList = {
  fights: [],
  total: 0,
  open: 0,
  best: null,
  first: null,
  firstYear: null,
};

/** A fight's record in a few lines: who won, the strengths, the town it came down on, its dead. */
const recordOf = (f: StarFightEntry): string => {
  let words = `${f.won ? f.attacker : f.defender} won. Strength ${f.strength} against ${f.defence}.`;
  if (f.town) words += ` Came down on ${f.town}: ${f.dead.toLocaleString("en")} dead.`;
  if (!f.ships) words += " No ship rose to meet them.";
  return words;
};

export class StarWars {
  /** Its fight watched, from its row's "Watch it". */
  onWatch: (id: string) => void = () => {};
  /** A page to open: a fight's, a war's, or the concept's. */
  onPage: (ref: string) => void = () => {};
  /** The world's wars of the last hundred years watched, as the button did before. */
  onAge: () => void = () => {};
  /** Asked before the sheet is shown: whether anything else on the bottom edge is to be put away. */
  onShown: () => void = () => {};
  private list: StarFightList = NO_FIGHTS;
  private readonly sheet = el("div", "colony-sheet star-sheet");
  private readonly rows = el("div", "colony-rows");

  constructor(hud: HTMLElement) {
    const head = el("div", "colony-sheet-head"),
      why = el("button", "speed", "?"),
      close = el("button", "speed", "✕");
    why.title = "What a war among the stars is";
    why.setAttribute("aria-label", "What a war among the stars is");
    why.onclick = () => this.onPage("concept:starwars");
    close.setAttribute("aria-label", "Close the wars among the stars");
    close.onclick = () => this.show(false);
    head.append(el("span", "colony-sheet-title", "🌌 The wars among the stars"), why, close);
    this.sheet.append(head, this.rows);
    this.sheet.hidden = true;
    hud.append(this.sheet);
  }

  /** The sheet open or shut; given a list, it shows that one. */
  show(on: boolean, list?: StarFightList): void {
    if (list) this.list = list;
    this.sheet.hidden = !on;
    if (on) {
      this.onShown();
      this.draw();
    }
  }

  get shown(): boolean {
    return !this.sheet.hidden;
  }

  private draw(): void {
    const { fights, total, open } = this.list;
    const age = el("div", "colony-row star-age-row"),
      ageWatch = el(
        "button",
        "colony-watch star-age",
        "⚔️ The world's wars of the last hundred years",
      ),
      ageFacts = el("div", "colony-row-facts", `${total} fought; ${open} fleets still under way.`);
    ageWatch.onclick = () => {
      this.show(false);
      this.onAge();
    };
    age.append(ageWatch, ageFacts);
    this.rows.replaceChildren(
      age,
      ...fights.map((f) => {
        const row = el("div", "colony-row star-row"),
          name = el("button", "colony-row-name", `${f.year}: ${f.attacker} against ${f.defender}`),
          acts = el("div", "colony-row-acts"),
          watch = el("button", "colony-watch star-watch", "▶ Watch it");
        row.dataset.id = f.id;
        watch.dataset.id = f.id;
        name.onclick = () => this.onPage(f.page);
        watch.onclick = () => {
          this.show(false);
          this.onWatch(f.id);
        };
        acts.append(watch);
        row.append(name, el("div", "colony-row-facts", recordOf(f)), acts);
        return row;
      }),
    );
  }
}
