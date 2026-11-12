// Every strike from the air, to be played again (asked 2026-11-11: "make it option just like watching
// landing or past war"): a button in the corner's row once there are any, a sheet of them newest first —
// the raids of machines, the rockets thrown, the greatest fire — each a tap from being watched again in
// its town, and its town's and its war's pages. Nothing is asked that history does not hold already.
import type { HostClient, StrikeEntry } from "../bridge/index.ts";
import { el } from "./why.ts";

const POLL_MS = 5000;
const ICON: Readonly<Record<StrikeEntry["kind"], string>> = {
  raid: "✈️",
  rocket: "🚀",
  great: "☢️",
};
const WHAT: Readonly<Record<StrikeEntry["kind"], string>> = {
  raid: "A raid",
  rocket: "Rockets",
  great: "The greatest fire",
};
/** Which of them the sheet shows. */
type Filter = "all" | StrikeEntry["kind"];

export class Strikes {
  /** The corner's button (hidden while nothing has struck from the air). */
  readonly button = el("button", "strikes-button");
  private readonly count = el("span", "colonies-count");
  private readonly sheet = el("div", "colony-sheet strike-sheet");
  private readonly rows = el("div", "colony-rows");
  private readonly filters = el("div", "strike-filters");
  private list: readonly StrikeEntry[] = [];
  private filter: Filter = "all";
  /** Played again in its town (false: it could not be). */
  onWatch: (event: string) => Promise<boolean> = () => Promise.resolve(false);
  /** A thing's page (its town, its war). */
  onPage: (ref: string) => void = () => {};
  /** Asked before it is shown: whatever else lies on the screen's foot put away. */
  onShown: () => void = () => {};

  constructor(hud: HTMLElement, client: HostClient) {
    this.button.append(el("span", undefined, "💥"), this.count);
    this.button.title =
      "Strikes from the air: watch a raid, the rockets or the greatest fire again";
    this.button.setAttribute("aria-label", "Strikes from the air");
    this.button.hidden = true;
    this.button.onclick = () => this.show(!this.shown);
    const head = el("div", "colony-sheet-head"),
      close = el("button", "speed", "✕");
    close.setAttribute("aria-label", "Close the strikes from the air");
    close.onclick = () => this.show(false);
    head.append(el("span", "colony-sheet-title", "💥 Strikes from the air"), close);
    this.sheet.append(head, this.filters, this.rows);
    this.sheet.hidden = true;
    hud.append(this.sheet);
    client.subscribe<StrikeEntry[]>({ type: "strike.list" }, POLL_MS, (list) => {
      if (!Array.isArray(list)) return;
      this.list = list;
      this.button.hidden = list.length === 0;
      this.count.textContent = String(list.length);
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

  private draw(): void {
    // (Only the kinds there are: a world of raids alone has no row of choices.)
    const kinds = (["raid", "rocket", "great"] as const).filter((k) =>
      this.list.some((s) => s.kind === k),
    );
    if (this.filter !== "all" && !kinds.includes(this.filter)) this.filter = "all";
    this.filters.replaceChildren(
      ...(kinds.length > 1
        ? (["all", ...kinds] as Filter[]).map((f) => {
            const b = el(
              "button",
              `speed${f === this.filter ? " on" : ""}`,
              f === "all" ? "All" : `${ICON[f]} ${WHAT[f]}`,
            );
            b.setAttribute("aria-pressed", String(f === this.filter));
            b.onclick = () => {
              this.filter = f;
              this.draw();
            };
            return b;
          })
        : []),
    );
    const shown = this.list.filter((s) => this.filter === "all" || s.kind === this.filter);
    this.rows.replaceChildren(
      ...(shown.length
        ? shown.map((s) => this.row(s))
        : [el("div", "colony-row-facts", "Nothing has struck from the air yet.")]),
    );
  }

  private row(s: StrikeEntry): HTMLElement {
    const row = el("div", "colony-row"),
      name = el("button", "colony-row-name", `${ICON[s.kind]} ${s.name}, year ${s.year}`),
      acts = el("div", "colony-row-acts"),
      said = el("div", "colony-row-facts"),
      watch = el("button", "colony-watch", "▶ Watch it again"),
      war = el("button", "colony-watch", "⚔️ Its war");
    name.onclick = () => this.onPage(s.town);
    const n = (k: number, one: string, many: string) =>
      `${k.toLocaleString("en-US")} ${k === 1 ? one : many}`;
    said.textContent = `${WHAT[s.kind]} by ${s.by} on ${s.on}: ${n(s.dead, "dead", "dead")}, ${n(s.homes, "home", "homes")} down${s.kind === "great" ? "" : `, ${s.kind === "rocket" ? `${s.flyers} thrown` : n(s.flyers, "machine", "machines")}`}.`;
    watch.disabled = !s.watchable;
    watch.dataset.event = s.event;
    if (!s.watchable) watch.title = "Its town keeps it no longer";
    watch.onclick = async () => {
      this.show(false);
      if (!(await this.onWatch(s.event))) {
        this.show(true);
        said.textContent = "It could not be played again: its town keeps it no longer.";
      }
    };
    war.onclick = () => this.onPage(s.war);
    acts.append(watch, war);
    row.append(name, said, acts);
    return row;
  }
}
