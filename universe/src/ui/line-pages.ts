// The pages of a line lived (Live a Line): the cell's own, its line generation by generation, the world it lives in, the
// drop about it, and the plain-words help of each panel. One window over the drop, opened under the mode's top column, with
// Back and Forward through what was read (ui/page-history.ts: each page as it was left, read down as far as it was), and
// links from page to page. Its words are the mode's (app/line.ts gives each page as its parts).
import { PageHistory } from "./page-history.ts";
import { el } from "./why.ts";

/** A page: its title, its parts, and the help page its ? opens (none: no ?). */
export type LinePage = { readonly title: string; readonly parts: readonly HTMLElement[]; readonly help?: string };

export class LinePages {
  readonly element = el("div", "line-page");
  private readonly head = el("div", "line-page-head");
  private readonly back = el("button", "line-page-back", "‹ Back");
  private readonly ahead = el("button", "line-page-ahead", "Forward ›");
  private readonly help = el("button", "line-help line-page-help", "?");
  private readonly close = el("button", "line-page-close", "✕ Close");
  private readonly title = el("h3", "line-page-title");
  private readonly body = el("div", "line-page-body");
  private readonly history = new PageHistory<{ scroll: number }>(48);
  /** The page shown now (null: closed). */
  ref: string | null = null;
  /** What the pages read so far (the look tools, and the guide's lesson). */
  opened = 0;
  onClose: () => void = () => {};

  private readonly pageOf: (ref: string) => LinePage;

  constructor(pageOf: (ref: string) => LinePage) {
    this.pageOf = pageOf;
    this.back.title = "Back to the page before";
    this.ahead.title = "Forward to the page after";
    this.close.title = "Close the page (Esc)";
    this.help.setAttribute("aria-label", "How these pages work");
    this.help.title = "How these pages work";
    const nav = el("span", "line-page-nav");
    nav.append(this.back, this.ahead);
    const keys = el("span", "line-page-keys");
    keys.append(this.help, this.close);
    this.head.append(nav, keys);
    this.element.append(this.head, this.title, this.body);
    this.back.onclick = () => this.step(-1);
    this.ahead.onclick = () => this.step(1);
    this.close.onclick = () => this.onClose();
    this.help.onclick = () => this.open(this.helpRef);
  }

  private helpRef = "help:pages";

  /** A link to another page, as a button in the words. */
  link(text: string, ref: string): HTMLButtonElement {
    const b = el("button", "line-link", text);
    b.onclick = () => this.open(ref);
    return b;
  }

  /** A page opened after the one open (what was ahead let go): the same page again keeps its place. */
  open(ref: string): void {
    const { visit, again } = this.history.open(ref, this.ref ? { scroll: this.body.scrollTop } : null);
    this.draw(visit.ref, again ? (visit.view?.scroll ?? this.body.scrollTop) : 0);
  }

  private step(way: -1 | 1): void {
    const v = this.history.step(way, { scroll: this.body.scrollTop });
    if (v) this.draw(v.ref, v.view?.scroll ?? 0);
  }

  /** The page open drawn again as the line now is (its place on it kept). */
  redraw(): void {
    if (this.ref) this.draw(this.ref, this.body.scrollTop);
  }

  private draw(ref: string, scroll: number): void {
    const p = this.pageOf(ref);
    this.ref = ref;
    this.opened++;
    this.title.textContent = p.title;
    this.body.replaceChildren(...p.parts);
    this.helpRef = p.help ?? "help:pages";
    this.help.hidden = ref === this.helpRef;
    this.back.disabled = !this.history.canBack;
    this.ahead.disabled = !this.history.canForward;
    this.body.scrollTop = scroll;
  }

  /** Back and Forward as they stand (the look tools). */
  get nav(): { back: boolean; forward: boolean; at: number; length: number } {
    return {
      back: this.history.canBack,
      forward: this.history.canForward,
      at: this.history.index,
      length: this.history.length,
    };
  }
}

/** A paragraph of plain words. */
export const para = (text: string, className = "line-para"): HTMLElement => el("p", className, text);

/** A row of a fact: its label and its words (each part a string or a link). */
export function fact(label: string, ...value: (string | HTMLElement)[]): HTMLElement {
  const row = el("div", "line-fact"),
    v = el("span", "line-fact-value");
  v.append(...value);
  row.append(el("span", "line-fact-label", label), v);
  return row;
}
