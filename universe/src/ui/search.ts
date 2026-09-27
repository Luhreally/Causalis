// Search (Phase 10 M96): a field under a 🔍 — "/" or Ctrl+K to reach it from anywhere —
// and as the words are typed, every named thing that answers them: its icon, its name and a
// few words, the best first. A tap (or Enter on the first) opens its page.
import type { HostClient } from "../bridge/index.ts";
import { el } from "./why.ts";

type Found = { ref: string; icon: string; title: string; subtitle: string };

export class SearchBox {
  readonly element = el("div", "search");
  private readonly button = el("button", "search-open", "🔍");
  private readonly box = el("div", "search-box");
  private readonly field = el("input", "search-field");
  private readonly results = el("div", "search-results");
  private readonly client: HostClient;
  private asked = 0;
  private found: Found[] = [];
  /** Open a thing's page. */
  onOpen: (ref: string) => void = () => {};

  constructor(parent: HTMLElement, client: HostClient) {
    this.client = client;
    this.button.title = "Search (/)";
    this.button.setAttribute("aria-label", "Search");
    this.field.type = "search";
    this.field.placeholder = "A realm, a town, a faith, a tongue, a war, a beast, someone…";
    this.field.setAttribute("aria-label", "Search for anything by its name");
    this.box.append(this.field, this.results);
    this.box.hidden = true;
    this.element.append(this.button, this.box);
    parent.append(this.element);
    this.button.onclick = () => (this.box.hidden ? this.open() : this.close());
    this.field.oninput = () => void this.ask();
    this.field.onkeydown = (e) => {
      if (e.key === "Escape") this.close();
      if (e.key === "Enter" && this.found[0]) this.choose(this.found[0].ref);
    };
    addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "/" || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        this.open();
      }
    });
  }

  open(): void {
    this.box.hidden = false;
    this.button.classList.add("on");
    this.field.focus();
    this.field.select();
  }

  close(): void {
    this.box.hidden = true;
    this.button.classList.remove("on");
    this.field.blur();
  }

  private choose(ref: string): void {
    this.close();
    this.onOpen(ref);
  }

  private async ask(): Promise<void> {
    const text = this.field.value,
      token = ++this.asked;
    if (text.trim().length < 2) {
      this.found = [];
      this.results.replaceChildren();
      return;
    }
    const found = await this.client.query<Found[]>({ type: "search", args: { text, most: 24 } });
    if (token !== this.asked) return;
    this.found = found;
    this.results.replaceChildren(
      ...(found.length
        ? found.map((f) => {
            const b = el("button", "search-result");
            b.append(
              el("span", "search-icon", f.icon),
              el("span", "search-title", f.title),
              el("span", "search-sub", f.subtitle),
            );
            b.onclick = () => this.choose(f.ref);
            return b;
          })
        : [el("p", "muted", "Nothing by that name.")]),
    );
  }
}
