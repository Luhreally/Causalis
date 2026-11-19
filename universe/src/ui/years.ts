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
import { drawWritten } from "./written.ts";
import { drawYearsSearch } from "./years-search.ts";
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

/**
 * How the scroll stood when its page was left (ui/inspector.ts keeps it across back and forward): its filter, its order,
 * and the year under the bar with how far under it (none where the bar had not yet come to the window's top: the
 * window's own place says it all there). Years far from the eye keep a guessed height until they are drawn, so how far
 * down the window was scrolled does not say which year was read.
 */
interface YearsKept {
  readonly kind: number;
  readonly newest: boolean;
  readonly year: number | null;
  readonly off: number;
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
    written = el("div", "years-written"),
    list = el("div", "years-list"),
    found = el("div", "years-found"),
    find = el("div", "years-find-head"),
    words = new Map<number, AnnalYear>();
  input.type = "number";
  input.inputMode = "numeric";
  input.placeholder = "A year";
  input.enterKeyHint = "go";
  input.setAttribute("aria-label", "A year to go to");
  onward.hidden = true;
  goRow.append(input, go, order);
  // (What stays over the years as they go under it is the filter and what it says: a phone has little room to give.)
  bar.append(chips, says, onward);
  found.hidden = true;
  // (The search's field leads the way to a year, its filters and what it offers under it: no taller than before.)
  box.append(bar, goRow, find, written, list, found);
  into.append(box);
  // (The whole of it written out as a file a person can keep: B1.)
  drawWritten(written, ctx.client);

  // (Come back to, not opened to read a year: as it was left.)
  const was = wanted === null ? ((ctx.kept as YearsKept | undefined) ?? null) : null;
  let index: AnnalsIndex | null = null,
    kind = was?.kind ?? -1,
    newest = was?.newest ?? true,
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
      // (The year itself opens that year told: what it was, whole. ui/told.ts.)
      at = el("button", "years-year", String(y.year)),
      lines = el("div", "years-lines");
    at.title = "This year told: what it was, whole";
    at.setAttribute("aria-label", `Year ${y.year}, told whole`);
    at.onclick = () => ctx.open(`told:${y.year}`);
    row.dataset.year = String(y.year);
    for (const l of linesOf(y)) {
      const line = el("div", "line entry years-line");
      lineInto(line, l.line, ctx.open);
      line.onclick = () => ctx.open(l.ref);
      // (A fight of the underworld: watched from its line, 2026-11-16.)
      if (l.watch && ctx.fight) {
        const play = el("button", "years-watch", "▶");
        play.title = "Watch it, in the streets of its town";
        play.onclick = (e) => {
          e.stopPropagation();
          ctx.fight!(l.watch!);
        };
        line.append(" ", play);
      }
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
    if (search.on()) return;
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
      pick(i);
      if (search.on()) search.again();
      else {
        lay();
        toTop();
      }
    };
    return b;
  };
  /** The kind the chips show as chosen. */
  const pick = (i: number) => {
    kind = i;
    [...chips.children].forEach((x, j) => {
      x.classList.toggle("on", j - 1 === i);
      x.setAttribute("aria-pressed", String(j - 1 === i));
    });
  };
  chips.append(
    chipOf(-1, "📜\nAll", "What a person would stop to read"),
    ...ANNAL_KINDS.map((k, i) => chipOf(i, `${k.icon}\n${k.name}`, k.words)),
  );

  /** The bar at the top of the window, with the way to a year under it and then the years. */
  const toTop = () => {
    // (To where the bar sticks: inside the window's padding and under its title, or the way to a year would lie under it.)
    scroller().scrollTop += box.getBoundingClientRect().top - sticks();
  };
  /**
   * Where on the screen the bar's top stands once it sticks: under the window's edge, its padding and its title. (Reckoned
   * from the window's outer top alone, a year gone to stood some 10px behind the bar: its edge and padding were left out.)
   */
  const sticks = () => {
    const root = scroller();
    if (root === document.documentElement) return 0;
    const pad = parseFloat(getComputedStyle(root).paddingTop) || 0;
    return root.getBoundingClientRect().top + root.clientTop + pad + under();
  };
  /** How far under the window's padding the bar sticks: the window's title stays over it (ui/inspector.ts). */
  const under = () => {
    const root = scroller();
    if (root === document.documentElement) return 0;
    const title = root.querySelector<HTMLElement>(":scope > h2"),
      pad = parseFloat(getComputedStyle(root).paddingTop) || 0;
    return title && getComputedStyle(title).position === "sticky"
      ? Math.max(0, title.offsetHeight - pad)
      : 0;
  };

  /** To a year, or the nearest with something told. */
  const toYear = async (year: number, back?: number) => {
    if (!shown.length) return;
    let best = 0;
    for (let i = 0; i < shown.length; i++)
      if (Math.abs(shown[i]! - year) < Math.abs(shown[best]! - year)) best = i;
    const at = shown[best]!,
      i = Math.floor(best / PIECE) * PIECE,
      piece = pieces[i / PIECE]!,
      root = scroller();
    root.scrollTop += piece.getBoundingClientRect().top - sticks() - bar.offsetHeight;
    await draw(piece, shown.slice(i, i + PIECE));
    const row = list.querySelector<HTMLElement>(`[data-year="${at}"]`);
    if (row && back !== undefined) {
      // (Come back to: the year where it stood under the bar, and nothing said of it.)
      root.scrollTop += row.getBoundingClientRect().top - bar.getBoundingClientRect().bottom - back;
      return;
    }
    if (row) {
      // (Whole under the bar, a hair of the year before it showing that it is the one come to.)
      root.scrollTop += row.getBoundingClientRect().top - sticks() - bar.offsetHeight - 4;
      row.classList.add("here");
      setTimeout(() => row.classList.remove("here"), 2400);
    }
    tell(at === year ? "" : `Nothing is told of ${year}: the nearest is ${at}.`);
  };
  // How it stands, asked as its page is left.
  ctx.keep?.((): YearsKept => {
    const edge = bar.getBoundingClientRect().bottom;
    let year: number | null = null,
      off = 0;
    if (!list.hidden && list.getBoundingClientRect().top < edge)
      for (const row of list.querySelectorAll<HTMLElement>("[data-year]")) {
        const r = row.getBoundingClientRect();
        if (r.bottom <= edge) continue;
        year = Number(row.dataset.year);
        off = r.top - edge;
        break;
      }
    return { kind, newest, year, off };
  });
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
    if (search.on()) search.again();
    else {
      lay();
      toTop();
    }
  };
  sayOrder();

  // The search (2026-11-16): while it is on, what it finds stands in place of the scroll, and the way to a year,
  // which the search says in its own words (1200-1500), steps aside.
  const search = drawYearsSearch({
    ctx,
    row: goRow,
    head: find,
    found,
    kind: () => kind,
    setKind: pick,
    newest: () => newest,
    changed: (on) => {
      found.hidden = !on;
      list.hidden = on;
      input.hidden = on;
      go.hidden = on;
      if (!on) tell();
    },
    say: (words) => {
      says.textContent = words;
    },
    toTop,
    restore: wanted === null,
  });

  let first = true;
  /** Read which years there are (and any since), and lay them out. */
  const readIndex = async () => {
    const got = await ctx.client.query<AnnalsIndex>({ type: "annals.index" });
    index = got;
    words.clear();
    onward.hidden = true;
    lay();
    // (The years under the eye at once, the page's head above them; come back to, the year that was under the eye, or
    // where the window stood above them.)
    if (first && was) {
      first = false;
      if (was.year !== null && wanted === null) {
        ctx.placed?.();
        await toYear(was.year, was.off);
      }
    } else if (first) toTop();
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
  onward.onclick = () => {
    void readIndex();
    search.again(true);
  };
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
  // (The world's last search, had again; not when the tab was opened to read a year.)
  if (wanted === null) search.again();
}
