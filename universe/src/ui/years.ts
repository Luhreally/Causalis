// The Years (A1, classic 55): a world's years as a scroll, each with its digest, filtered by kind; a person can go to
// a year, and every name opens its page. Read in pieces and drawn as they come near the eye, so a world of 3,000 years
// is a few dozen rows at a time, and the page's scrolling itself costs nothing.
import {
  ALL_LINES,
  ALL_WORTH,
  ANNAL_ALL,
  ANNAL_KINDS,
  KIND_LINES,
  KIND_WORTH,
  type AnnalYear,
  type AnnalsIndex,
  type Line,
} from "../bridge/index.ts";
import { YEAR } from "../kernel/index.ts";
import type { ToolContext } from "./tools.ts";
import { el } from "./why.ts";

/** How many years a piece holds, about how tall a year is at first, and how far from the eye a piece is drawn. */
const PIECE = 24,
  ROW_PX = 74,
  NEAR_PX = 900;

/** A year to go to as the tab opens (a note's "read those years"). */
let wanted: number | null = null;
export function readFrom(year: number): void {
  wanted = year;
}

/** A line's words, each name a link that opens its page and not the line's. */
export function lineInto(box: HTMLElement, line: Line, open: (ref: string) => void): void {
  for (const s of line) {
    if (typeof s === "string") box.append(s);
    else {
      const a = el("a", "ref-link", s.text);
      a.href = `#${s.ref}`;
      a.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        open(s.ref);
      };
      box.append(a);
    }
  }
}

/** The tab's tool: the bar, and the scroll. */
export function drawYears(into: HTMLElement, ctx: ToolContext): void {
  const box = el("div", "years"),
    bar = el("div", "years-bar"),
    chips = el("div", "years-chips"),
    goRow = el("div", "years-go"),
    input = el("input", "years-at") as HTMLInputElement,
    go = el("button", "years-to", "Go"),
    order = el("button", "years-order"),
    says = el("p", "muted years-says"),
    onward = el("button", "years-onward"),
    list = el("div", "years-list"),
    words = new Map<number, AnnalYear>();
  input.type = "number";
  input.inputMode = "numeric";
  input.placeholder = "A year";
  input.enterKeyHint = "go";
  input.setAttribute("aria-label", "A year to go to");
  onward.hidden = true;
  goRow.append(input, go, order);
  bar.append(chips, goRow, says, onward);
  box.append(bar, list);
  into.append(box);

  let index: AnnalsIndex | null = null,
    kind = -1,
    newest = true,
    shown: number[] = [],
    pieces: HTMLElement[] = [];
  const scroller = () => box.closest<HTMLElement>(".page-window") ?? document.documentElement;

  /** The years the filter leaves, in the order they are read. */
  const leave = () => {
    if (!index) return [];
    const bit = kind < 0 ? ANNAL_ALL : 1 << kind,
      out = index.years.filter((_, i) => index!.masks[i]! & bit);
    return newest ? out.reverse() : out;
  };
  /** What a year says under the filter. */
  const linesOf = (y: AnnalYear) =>
    kind < 0
      ? y.lines.filter((l) => l.worth >= ALL_WORTH).slice(0, ALL_LINES)
      : y.lines.filter((l) => l.kind === kind && l.worth >= KIND_WORTH).slice(0, KIND_LINES);

  const rowOf = (y: AnnalYear): HTMLElement => {
    const row = el("div", "years-row"),
      at = el("div", "years-year", String(y.year)),
      lines = el("div", "years-lines");
    row.dataset.year = String(y.year);
    for (const l of linesOf(y)) {
      const line = el("div", "line entry years-line");
      lineInto(line, l.line, ctx.open);
      line.onclick = () => ctx.open(l.ref);
      lines.append(line);
    }
    row.append(at, lines);
    return row;
  };

  /** Draw a piece, keeping the eye where it is if the piece lies above it. */
  const fill = (piece: HTMLElement, rows: readonly AnnalYear[]) => {
    const root = scroller(),
      top = root.getBoundingClientRect().top,
      was = piece.getBoundingClientRect(),
      above = was.top < top;
    piece.style.height = "";
    piece.replaceChildren(...rows.map(rowOf));
    piece.dataset.drawn = "1";
    if (above) root.scrollTop += piece.getBoundingClientRect().height - was.height;
  };

  /** Read a piece's years (those not read) and draw them. */
  const draw = async (piece: HTMLElement, years: readonly number[]) => {
    if (piece.dataset.drawn === "1" || piece.dataset.asked === "1") return;
    const missing = years.filter((y) => !words.has(y));
    if (missing.length) {
      piece.dataset.asked = "1";
      const got = await ctx.client.query<AnnalYear[]>({
        type: "annals.read",
        args: { years: missing },
      });
      for (const y of got) words.set(y.year, y);
      delete piece.dataset.asked;
    }
    if (!pieces.includes(piece) || !watching.has(piece)) return;
    fill(
      piece,
      years.flatMap((y) => {
        const w = words.get(y);
        return w ? [w] : [];
      }),
    );
  };

  const watching = new WeakSet<HTMLElement>();
  let seen: IntersectionObserver | null = null;
  /** Far from the eye, a piece keeps its height and nothing else. */
  const empty = (piece: HTMLElement) => {
    if (piece.dataset.drawn !== "1") return;
    const h = piece.getBoundingClientRect().height;
    piece.style.height = `${h}px`;
    piece.replaceChildren();
    delete piece.dataset.drawn;
  };

  /** The scroll, laid out afresh for the filter and the order. */
  const lay = () => {
    seen?.disconnect();
    shown = leave();
    pieces = [];
    const made: HTMLElement[] = [];
    for (let i = 0; i < shown.length; i += PIECE) {
      const years = shown.slice(i, i + PIECE),
        piece = el("div", "years-piece");
      piece.style.height = `${years.length * ROW_PX}px`;
      piece.dataset.at = String(i);
      made.push(piece);
      watching.add(piece);
    }
    pieces = made;
    list.replaceChildren(...made);
    seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const piece = entry.target as HTMLElement,
            at = Number(piece.dataset.at),
            years = shown.slice(at, at + PIECE);
          if (entry.isIntersecting) void draw(piece, years);
          else empty(piece);
        }
      },
      { root: scroller(), rootMargin: `${NEAR_PX}px 0px` },
    );
    for (const piece of made) seen.observe(piece);
    tell();
  };

  const tell = (extra = "") => {
    const n = index?.years.length ?? 0;
    says.textContent = extra
      ? extra
      : !index
        ? "Reading the years…"
        : !n
          ? "Nothing has happened here that anyone could tell."
          : !shown.length
            ? kind < 0
              ? "Nothing yet that a person would stop to read: the filters tell the small things."
              : `Nothing of ${ANNAL_KINDS[kind]!.words.toLowerCase()} yet, in ${index.now.toLocaleString("en")} years.`
            : `${shown.length.toLocaleString("en")} of ${index.now.toLocaleString("en")} years ${shown.length === 1 ? "has" : "have"} something told${kind < 0 ? "" : ` of ${ANNAL_KINDS[kind]!.words.toLowerCase()}`}.`;
  };

  const sayOrder = () => {
    order.textContent = newest ? "Newest first" : "Oldest first";
    order.setAttribute("aria-label", `Reading ${newest ? "newest" : "oldest"} first: change it`);
  };

  const chipOf = (i: number, label: string, title: string) => {
    const b = el("button", i === kind ? "years-chip on" : "years-chip", label);
    b.title = title;
    b.setAttribute("aria-label", title);
    b.setAttribute("aria-pressed", String(i === kind));
    b.onclick = () => {
      kind = i;
      for (const x of chips.children) {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      }
      lay();
      toTop();
    };
    return b;
  };
  chips.append(
    chipOf(-1, "All", "What a person would stop to read"),
    ...ANNAL_KINDS.map((k, i) => chipOf(i, `${k.icon} ${k.name}`, k.words)),
  );

  /** The start of the list, just under where the page's bar stands. */
  const toTop = () => {
    const root = scroller(),
      gap = list.getBoundingClientRect().top - root.getBoundingClientRect().top;
    root.scrollTop += gap - bar.offsetHeight - 2;
  };

  /** To a year, or the nearest with something told. */
  const toYear = async (year: number) => {
    if (!shown.length) return;
    let best = 0;
    for (let i = 0; i < shown.length; i++)
      if (Math.abs(shown[i]! - year) < Math.abs(shown[best]! - year)) best = i;
    const at = shown[best]!,
      i = Math.floor(best / PIECE) * PIECE,
      piece = pieces[i / PIECE]!,
      root = scroller();
    root.scrollTop +=
      piece.getBoundingClientRect().top - root.getBoundingClientRect().top - bar.offsetHeight;
    await draw(piece, shown.slice(i, i + PIECE));
    const row = list.querySelector<HTMLElement>(`[data-year="${at}"]`);
    if (row) {
      root.scrollTop +=
        row.getBoundingClientRect().top - root.getBoundingClientRect().top - bar.offsetHeight - 4;
      row.classList.add("here");
      setTimeout(() => row.classList.remove("here"), 2400);
    }
    tell(at === year ? "" : `Nothing is told of ${year}: the nearest is ${at}.`);
  };
  const goNow = () => {
    const y = Number(input.value);
    if (input.value.trim() && Number.isFinite(y)) void toYear(Math.round(y));
  };
  go.onclick = goNow;
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
      goNow();
    }
  };
  order.onclick = () => {
    newest = !newest;
    sayOrder();
    lay();
    toTop();
  };
  sayOrder();

  let first = true;
  /** Read which years there are (and any since), and lay them out. */
  const readIndex = async () => {
    const got = await ctx.client.query<AnnalsIndex>({ type: "annals.index" });
    index = got;
    words.clear();
    onward.hidden = true;
    lay();
    // (The years under the eye at once, the page's head above them.)
    if (first) toTop();
    first = false;
    if (wanted !== null) {
      const y = wanted;
      wanted = null;
      newest = false;
      sayOrder();
      lay();
      await toYear(y);
    }
  };
  // The world goes on while this is read: it reads on only when asked to.
  onward.onclick = () => void readIndex();
  const stop = ctx.client.onStatus((s) => {
    if (!index) return;
    if (!box.isConnected) {
      stop();
      seen?.disconnect();
      return;
    }
    const year = Math.floor(s.t / YEAR);
    if (year > index.now) {
      const words = `The world has gone on to ${year}: read on`;
      if (onward.textContent !== words) onward.textContent = words;
      onward.hidden = false;
    }
  });
  tell();
  void readIndex();
}
