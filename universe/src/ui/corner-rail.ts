// The corner's rail kept to its room (asked 2026-11-11: "no panels should ever overlap or cover
// another one like rn theres so many icon notifs that its blocking the lens selection buttons"). Its
// tools stand one under another from under the scale's bar down to the first window under them (the
// people bar, the map modes on a desk, the god's hand), on a desk in a second column at the left of
// the first if they must; what would not fit folds behind a ⋯ at the rail's foot — the alerts first,
// the last of them first, then the tools from the foot up — and the ⋯'s sheet names each, a tap on
// one a tap on it. Where the rail ends at the left is `--rail-left`, for the windows beside it. Of
// what the rail opens beside it (search, what is followed, an alert's cases, the ⋯'s sheet) one is
// open at a time.
//
// And the foot of the screen, read for the windows that stand over it: how much of it the windows
// standing there take (the map modes, the god's hand, the people bar), as `--rail-foot` (under the
// rail), `--right-foot` (beside it, as wide as a scale's card) and `--left-foot` (under the news, at
// the left), so a card, a sheet, the news or what the rail opens ends above them, never over them.
import { el } from "./why.ts";

/** The rail's tools, each a button that folds alone. */
const TOOLS =
  ".colonies-button, .strikes-button, .free-buttons > button, .alert, .search-open, .outliner-open, .log-open, .brush-toggle, .sound-button";
/** What stands at the screen's foot: the rail, the news and the windows at the right end above it. */
const FEET = "#hud > .people-bar, .mapmodes, #hud > .palette, #hud > .palette-toggle";
/**
 * Where the shown scale's bar ends, read from the bar itself (as main.ts marks `--bar-bottom`): a
 * foot measured before that is marked took the lens row under the bar for the screen's foot, and a
 * landing's card told as a world opened stood over the bar.
 */
function barBottom(): number {
  const b = [...document.querySelectorAll<HTMLElement>(".panel > header.bar")].find(
    (x) => x.offsetParent !== null,
  );
  return b
    ? Math.round(b.getBoundingClientRect().bottom)
    : parseFloat(document.documentElement.style.getPropertyValue("--bar-bottom")) || 0;
}

/** The gap kept between a window and what it ends above (px). */
const GAP = 8;

const strip = (c: string | null) =>
  (c ?? "")
    .split(/\s+/)
    .filter((x) => x && x !== "folded")
    .sort()
    .join(" ");
const shown = (e: Element) => e.getClientRects().length > 0;

export class CornerRail {
  readonly more = el("button", "corner-more");
  readonly sheet = el("div", "corner-more-sheet");
  private readonly wrap = el("div", "corner-more-wrap");
  private readonly count = el("span", "outliner-count");
  private readonly pops: { readonly element: HTMLElement; readonly close: () => void }[] = [];
  private folded: HTMLElement[] = [];
  private sign = "";
  private dirty = true;

  readonly element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
    this.more.setAttribute("aria-label", "More tools");
    this.more.title = "More tools";
    this.more.hidden = true;
    this.sheet.hidden = true;
    this.sheet.setAttribute("role", "menu");
    this.more.onclick = () => (this.sheet.hidden ? this.open() : this.close());
    this.wrap.append(this.more, this.sheet);
    element.append(this.wrap);
    this.popover(this.sheet, () => this.close());
    // (Laid out again whenever a tool comes, goes or changes, but not for its own folding.)
    new MutationObserver((records) => {
      for (const r of records) {
        if (this.wrap.contains(r.target)) continue;
        if (r.type === "attributes" && r.attributeName === "class") {
          if (strip(r.oldValue) === strip((r.target as Element).getAttribute("class"))) continue;
        }
        this.dirty = true;
        requestAnimationFrame(() => this.layout());
        return;
      }
    }).observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "class"],
      attributeOldValue: true,
    });
    addEventListener("resize", () => this.layout());
    // (And read four times a second for what moves it from outside: the bar's height, a window come
    // to the foot, a mode of the body's. An observer of sizes trips WebKit's loop check here.)
    setInterval(() => this.layout(), 250);
    requestAnimationFrame(() => this.layout());
  }

  /** One of what the rail opens beside it: as it opens, the others close. */
  popover(element: HTMLElement, close: () => void): void {
    this.pops.push({ element, close });
    new MutationObserver(() => {
      if (element.hidden) return;
      for (const p of this.pops) if (p.element !== element && !p.element.hidden) p.close();
    }).observe(element, { attributes: true, attributeFilter: ["hidden"] });
  }

  private open(): void {
    this.draw();
    this.sheet.hidden = false;
    this.more.classList.add("on");
  }

  close(): void {
    this.sheet.hidden = true;
    this.more.classList.remove("on");
  }

  /** How far from the screen's foot the windows there reach, over a span of the screen's width. */
  private foot(x0: number, x1: number, below: number): number {
    const H = innerHeight;
    let foot = GAP;
    for (const f of document.querySelectorAll<HTMLElement>(FEET)) {
      if (!shown(f) || f.closest(".corner-tools")) continue;
      const r = f.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right <= x0 || r.left >= x1 || r.top < below) continue;
      foot = Math.max(foot, H - r.top + GAP);
    }
    return Math.round(foot);
  }

  /** The rail laid out: as many tools as its room holds, in a column (two on a desk, the second
   * to the left of the first), the rest behind the ⋯. */
  layout(): void {
    const root = document.documentElement,
      W = innerWidth,
      H = innerHeight,
      cols = W <= 640 ? 1 : 2,
      rem = parseFloat(getComputedStyle(root).fontSize),
      bar = barBottom(),
      railFoot = this.foot(W - 8 - cols * 52, W, bar),
      top = Math.round(this.element.getBoundingClientRect().top),
      sign = `${W}x${H} ${top} ${railFoot} ${document.body.className} ${shown(this.element)}`;
    if (this.dirty || sign !== this.sign) {
      this.sign = sign;
      this.dirty = false;
      this.fold(H - railFoot - top, cols);
    }
    // (Where the rail ends at the left, for the windows that stand beside it; and the feet.)
    const r = this.element.getBoundingClientRect(),
      left = shown(this.element) && r.width > 0 ? Math.max(60, Math.round(W - r.left + 8)) : 60,
      rightFoot = this.foot(W - left - 22 * rem - 4, W - left, bar),
      leftFoot = this.foot(8, Math.min(8 + 20 * rem, W - left), bar);
    for (const [name, v] of [
      ["--rail-foot", railFoot],
      ["--rail-left", left],
      ["--right-foot", rightFoot],
      ["--left-foot", leftFoot],
    ] as const)
      if (root.style.getPropertyValue(name) !== `${v}px`) root.style.setProperty(name, `${v}px`);
  }

  /** The tools put in `cols` columns of the rows that `room` holds; those past it folded. */
  private fold(room: number, cols: number): void {
    // (The ⋯ at the rail's foot, whatever was put in the rail after it.)
    if (this.element.lastElementChild !== this.wrap) this.element.append(this.wrap);
    for (const t of this.folded) t.classList.remove("folded");
    this.folded = [];
    this.more.hidden = true;
    const tools = shown(this.element)
      ? [...this.element.querySelectorAll<HTMLElement>(TOOLS)].filter(
          (t) => !this.wrap.contains(t) && shown(t),
        )
      : [];
    if (!tools.length) {
      this.element.style.removeProperty("--rail-rows");
      return this.draw();
    }
    const gap = parseFloat(getComputedStyle(this.element).rowGap) || 0,
      tall = Math.max(...tools.map((t) => t.offsetHeight)),
      rows = Math.max(1, Math.floor((room + gap) / (tall + gap))),
      holds = rows * cols;
    if (tools.length > holds) {
      this.more.hidden = false;
      const alerts = tools.filter((t) => t.classList.contains("alert")).reverse(),
        rest = tools.filter((t) => !t.classList.contains("alert")).reverse();
      for (const t of [...alerts, ...rest].slice(0, tools.length - (holds - 1))) {
        t.classList.add("folded");
        this.folded.push(t);
      }
    }
    // (As many rows as there are tools, up to what the room holds: a short rail is one column.)
    const n = tools.length - this.folded.length + (this.more.hidden ? 0 : 1);
    this.element.style.setProperty("--rail-rows", String(Math.min(rows, n)));
    this.draw();
  }

  /** The ⋯'s count, and its sheet: each tool folded, by its sign and its name. */
  private draw(): void {
    this.count.textContent = String(this.folded.length);
    this.more.replaceChildren(el("span", undefined, "⋯"), this.count);
    this.more.setAttribute(
      "aria-label",
      this.folded.length ? `More tools: ${this.folded.length}` : "More tools",
    );
    // (In the rail's own order.)
    this.folded.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    if (!this.folded.length) {
      this.close();
      this.sheet.replaceChildren();
      return;
    }
    this.sheet.replaceChildren(
      ...this.folded.map((t) => {
        const row = el("button", "corner-more-row"),
          words = (t.getAttribute("aria-label") ?? t.title ?? t.textContent ?? "").trim(),
          sign = t.classList.contains("alert")
            ? (t.querySelector(".alert-icon")?.textContent ?? "")
            : t.classList.contains("brush-toggle")
              ? "🖌️"
              : (t.querySelector("span")?.textContent ?? t.textContent ?? "")
                  .trim()
                  .split(/\s+/)[0]!;
        row.setAttribute("role", "menuitem");
        row.dataset.tool = [...t.classList]
          .filter((c) => !["folded", "on", "new"].includes(c))
          .join(" ");
        row.classList.toggle("on", t.classList.contains("on"));
        if (t.classList.contains("alert"))
          row.classList.add(...[...t.classList].filter((c) => c.startsWith("tone-")));
        row.append(el("span", "corner-more-sign", sign), el("span", "corner-more-words", words));
        row.onclick = () => {
          this.close();
          t.click();
        };
        return row;
      }),
    );
  }
}
