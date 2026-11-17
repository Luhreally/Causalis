// The Years' search (asked 2026-11-16: "let me type events or names or cities or realms and a lot more on the
// years tab"): a field at the head of the Years, what it finds read from the whole log by the host
// (host/inspect/annals-search.ts), a page at a time. Typed: free words, realm:Asha, kind:war, only firsts,
// 1200-1500. A name tapped in a line found is a filter; the line itself opens what it tells, as a year's lines do.
// Everything here flows in the bar and the scroll: nothing stands over anything else (the owner's rule).
import {
  ANNAL_KEYS,
  ANNAL_KINDS,
  askAnything,
  filterText,
  joinAsks,
  keyOfRef,
  marksIn,
  parseAsk,
  type AnnalFilter,
  type AnnalFound,
  type AnnalKey,
  type AnnalName,
  type AnnalsAsk,
  type AnnalsFound,
  type Line,
} from "../bridge/index.ts";
import type { ToolContext } from "./tools.ts";
import { el } from "./why.ts";

/** How long the field waits after a key before it asks, and how many lines a page of what is found holds. */
const WAIT_MS = 220,
  PAGE = 30,
  SUGGESTED = 6;

/** What a search was, to be had again: per world, for this sitting of the page and (where it may) the next. */
type Kept = {
  readonly typed: string;
  readonly chips: readonly AnnalFilter[];
  readonly kind: number;
};
const KEPT = new Map<string, Kept>();
let worldKey = "";
const STORE = "causalis.years.search:";

/** Which world the page is of: a search is remembered by it. */
export function yearsWorld(key: string): void {
  worldKey = key;
}

function keptSearch(): Kept | null {
  const here = KEPT.get(worldKey);
  if (here) return here;
  try {
    const got = JSON.parse(localStorage.getItem(STORE + worldKey) ?? "null") as Kept | null;
    if (got && typeof got.typed === "string" && Array.isArray(got.chips)) return got;
  } catch {
    // (Nothing kept, or nowhere to keep it.)
  }
  return null;
}

function keepSearch(k: Kept | null): void {
  if (k) KEPT.set(worldKey, k);
  else KEPT.delete(worldKey);
  try {
    if (k) localStorage.setItem(STORE + worldKey, JSON.stringify(k));
    else localStorage.removeItem(STORE + worldKey);
  } catch {
    // (Kept for this sitting, then.)
  }
}

/** What the field says empty, and the ways of asking, said under it while it is empty and in hand. */
const HINT = "🔎 Search history",
  WAYS =
    "Names, events, any words. Or realm:Asha, town:…, person:…, house:…, faith:…, kind:war; only firsts, only wars, only sorrows; a year (1250) or years (1200-1500). Tap a name in a line to keep to it.";

/** The word being typed at the field's end, and the key before it if any: what suggestions answer. */
export function typingNow(
  typed: string,
): { key: AnnalKey | null; part: string; at: number } | null {
  const m = /(?:^|\s)(([^\s:"]+):"?|")?([^\s:"]*)$/.exec(typed);
  if (!m) return null;
  const key = m[2] ? (ANNAL_KEYS[m[2].toLowerCase()] ?? null) : null;
  if (m[2] && !key) return null;
  const at = m.index + (m[0].length - m[0].trimStart().length);
  return { key, part: m[3] ?? "", at };
}

/** A line's words with what was asked for marked; each name a filter when tapped. */
function lineMarked(
  box: HTMLElement,
  line: Line,
  terms: readonly string[],
  onName: (text: string, ref: string) => void,
): void {
  const marked = (into: HTMLElement, text: string) => {
    let from = 0;
    for (const [a, b] of marksIn(text, terms)) {
      if (a > from) into.append(text.slice(from, a));
      into.append(el("mark", "years-mark", text.slice(a, b)));
      from = b;
    }
    if (from < text.length) into.append(text.slice(from));
  };
  for (const s of line) {
    if (typeof s === "string") {
      marked(box, s);
      continue;
    }
    const a = el("a", "ref-link years-name");
    a.href = `#${s.ref}`;
    a.title = `Only what tells of ${s.text}`;
    marked(a, s.text);
    a.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onName(s.text, s.ref);
    };
    box.append(a);
  }
}

export type YearsSearchParts = {
  readonly ctx: ToolContext;
  /** The row the field leads (the way to a year), and where its filters and what it offers go, under it. */
  readonly row: HTMLElement;
  readonly head: HTMLElement;
  /** What is shown in place of the scroll while a search is on. */
  readonly found: HTMLElement;
  /** The annals' kind chosen by the bar's chips (-1: all): under a search, only lines of that kind. */
  readonly kind: () => number;
  readonly setKind: (kind: number) => void;
  readonly newest: () => boolean;
  /** Told when a search comes on or goes off, and what to say of it. */
  readonly changed: (on: boolean) => void;
  readonly say: (words: string) => void;
  readonly toTop: () => void;
  /** Whether the world's last search is had again as the tab opens. */
  readonly restore: boolean;
};

export type YearsSearch = {
  readonly on: () => boolean;
  /** Ask again (the order or the kind changed, or the world has gone on). */
  readonly again: (fresh?: boolean) => void;
};

/** The search's field, its filters and suggestions in `head`, and what it finds in `found`. */
export function drawYearsSearch(p: YearsSearchParts): YearsSearch {
  const field = el("input", "years-find") as HTMLInputElement,
    clear = el("button", "years-clear", "✕"),
    filters = el("div", "years-filters"),
    suggest = el("div", "years-suggest"),
    ways = el("p", "muted years-ways", WAYS),
    more = el("button", "years-more");
  field.type = "text";
  field.inputMode = "search";
  field.enterKeyHint = "search";
  field.autocomplete = "off";
  field.spellcheck = false;
  field.placeholder = HINT;
  field.title = WAYS;
  ways.hidden = true;
  field.setAttribute("aria-label", "Search all of history");
  clear.title = "Clear the search";
  clear.setAttribute("aria-label", "Clear the search");
  filters.hidden = true;
  suggest.hidden = true;
  more.hidden = true;
  clear.hidden = true;
  p.row.prepend(field, clear);
  p.head.append(filters, suggest, ways);

  let chips: AnnalFilter[] = [],
    session = Math.floor(Math.random() * 2 ** 31),
    asked = 0,
    named = 0,
    waiting: ReturnType<typeof setTimeout> | null = null,
    on = false,
    terms: readonly string[] = [],
    last: AnnalsFound | null = null,
    lastAsk: AnnalsAsk | null = null,
    rows = new Map<number, HTMLElement>();

  const askNow = (): AnnalsAsk => {
    const k = p.kind();
    return joinAsks(
      { words: [], filters: chips, only: k < 0 ? [] : [k], from: null, to: null },
      parseAsk(field.value),
    );
  };
  /** Whether anything is asked past the kind chosen, which alone is the Years' own filter. */
  const asking = () =>
    askAnything(
      joinAsks(
        { words: [], filters: chips, only: [], from: null, to: null },
        parseAsk(field.value),
      ),
    );

  const drawChips = () => {
    filters.replaceChildren(
      ...chips.map((c, i) => {
        const chip = el("span", "years-filter"),
          words = `${c.key}: ${c.value}`,
          label = c.ref
            ? el("button", "years-filter-name", words)
            : el("span", "years-filter-name", words),
          off = el("button", "years-filter-off", "✕");
        label.title = c.ref ? `Open the page of ${c.value}` : filterText(c);
        const ref = c.ref;
        if (ref) label.onclick = () => p.ctx.open(ref);
        off.title = `No longer only ${c.value}`;
        off.setAttribute("aria-label", `Take off the filter ${filterText(c)}`);
        off.onclick = () => {
          chips = chips.filter((_, j) => j !== i);
          drawChips();
          run(true);
        };
        chip.append(label, off);
        return chip;
      }),
    );
    filters.hidden = !chips.length;
  };

  const addChip = (f: AnnalFilter) => {
    if (!chips.some((c) => c.key === f.key && c.value === f.value && c.ref === f.ref))
      chips = [...chips, f];
    drawChips();
    run(true);
  };

  /** A year's row among what is found: made once a search, lines added to it as pages come. */
  const rowFor = (year: number): HTMLElement => {
    const had = rows.get(year);
    if (had) return had.querySelector<HTMLElement>(".years-lines")!;
    const r = el("div", "years-row"),
      at = el("div", "years-year", String(year)),
      lines = el("div", "years-lines");
    r.dataset.year = String(year);
    r.append(at, lines);
    p.found.insertBefore(r, more);
    rows.set(year, r);
    return lines;
  };

  const lineOf = (l: AnnalFound): HTMLElement => {
    const line = el("div", `line entry years-line${l.minor ? " minor" : ""}`),
      what = el("span", "years-what muted");
    line.title = `${ANNAL_KINDS[l.kind]?.words ?? ""}${l.minor ? ": too small for the annals, found in the whole log" : ""}`;
    lineMarked(what, [l.what], terms, () => {});
    line.append(what);
    lineMarked(line, l.line, terms, (text, ref) =>
      addChip({ key: keyOfRef(ref), value: text, ref }),
    );
    line.onclick = () => p.ctx.open(l.ref);
    return line;
  };

  const sayFound = () => {
    if (!last) return;
    const n = last.matched,
      count = `${n.toLocaleString("en")}${last.whole ? "" : "+"}`;
    p.say(
      !n
        ? last.whole
          ? "Nothing in all of history answers that."
          : `Nothing yet, read ${p.newest() ? "back" : "on"} to year ${last.reached ?? "?"}: read on for more.`
        : `${count} ${n === 1 && last.whole ? "line answers" : "lines answer"}${last.whole ? ", in all of history" : `, counted ${p.newest() ? "back" : "on"} to year ${last.reached}`}.`,
    );
    more.hidden = last.next === null;
    more.textContent =
      rows.size || !last.next ? "More" : `Read on, past year ${last.reached ?? "?"}`;
  };

  const show = (got: AnnalsFound, append: boolean) => {
    if (!append) {
      rows = new Map();
      p.found.replaceChildren(more);
      last = got;
      terms = got.terms;
    } else if (last) last = { ...last, next: got.next, reached: got.reached };
    for (const y of got.years) {
      const lines = rowFor(y.year);
      for (const l of y.lines) lines.append(lineOf(l));
    }
    sayFound();
  };

  const ask = async (append: boolean) => {
    const a = append && lastAsk ? lastAsk : askNow(),
      mine = ++asked;
    lastAsk = a;
    if (!append) p.say("Searching all of history…");
    more.disabled = true;
    try {
      const got = await p.ctx.client.query<AnnalsFound>({
        type: "annals.search",
        args: {
          ...a,
          session,
          newest: p.newest(),
          limit: PAGE,
          after: append ? (last?.next ?? null) : null,
        },
      });
      if (mine !== asked || !on) return;
      show(got, append);
    } catch (error) {
      if (mine === asked) p.say(`The search could not be read: ${(error as Error).message}`);
    } finally {
      more.disabled = false;
    }
  };

  /** Ask for what is typed now (at once, or once the keys rest), and keep it as the world's last search. */
  const run = (now = false) => {
    if (waiting) clearTimeout(waiting);
    waiting = null;
    const was = on;
    on = asking();
    clear.hidden = !field.value && !chips.length;
    keepSearch(on ? { typed: field.value, chips, kind: p.kind() } : null);
    if (on !== was) p.changed(on);
    if (!on) {
      asked++;
      last = null;
      p.found.replaceChildren();
      return;
    }
    if (now) {
      p.toTop();
      void ask(false);
    } else
      waiting = setTimeout(() => {
        waiting = null;
        p.toTop();
        void ask(false);
      }, WAIT_MS);
  };

  /** Things by their names as the last word is typed: a tap makes it a filter. */
  const offer = async () => {
    const now = typingNow(field.value),
      mine = ++named;
    if (!now || now.part.length < (now.key ? 1 : 2)) {
      suggest.hidden = true;
      suggest.replaceChildren();
      return;
    }
    const got = await p.ctx.client.query<AnnalName[]>({
      type: "annals.names",
      args: { session, text: now.part, key: now.key, most: SUGGESTED },
    });
    // (Not once the field is left: what it offers would stand where no one is typing.)
    if (mine !== named || document.activeElement !== field) return;
    suggest.replaceChildren(
      ...got.map((n) => {
        const b = el("button", "years-suggestion"),
          note = el("span", "years-suggestion-note", ` ${n.key}`);
        b.append(`${n.icon} ${n.title}`, note);
        b.title = `${n.title}: ${n.note}. Only what tells of it.`;
        b.onclick = () => {
          field.value = field.value.slice(0, now.at).trimEnd();
          if (field.value) field.value += " ";
          suggest.hidden = true;
          suggest.replaceChildren();
          addChip({ key: n.key, value: n.name, ...(n.ref ? { ref: n.ref } : {}) });
        };
        return b;
      }),
    );
    suggest.hidden = !got.length;
  };

  // (What it offers goes as the field is left, once a tap on one of them has landed.)
  field.onblur = () =>
    setTimeout(() => {
      if (document.activeElement !== field) suggest.hidden = ways.hidden = true;
    }, 300);
  field.onfocus = () => {
    ways.hidden = !!field.value;
    void offer();
  };
  field.oninput = () => {
    ways.hidden = !!field.value;
    run();
    void offer();
  };
  field.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      suggest.hidden = true;
      field.blur();
      run(true);
    } else if (e.key === "Escape") {
      suggest.hidden = true;
    }
  };
  clear.onclick = () => {
    field.value = "";
    chips = [];
    drawChips();
    suggest.hidden = true;
    suggest.replaceChildren();
    run(true);
  };
  more.onclick = () => void ask(true);

  // The world's last search, had again.
  const kept = p.restore ? keptSearch() : null;
  if (kept) {
    field.value = kept.typed;
    chips = kept.chips.filter((c) => typeof c?.key === "string" && typeof c?.value === "string");
    if (kept.kind >= -1 && kept.kind < ANNAL_KINDS.length) p.setKind(kept.kind);
    drawChips();
  }

  return {
    on: () => on,
    again: (fresh = false) => {
      if (fresh) session = Math.floor(Math.random() * 2 ** 31);
      if (on || asking()) run(true);
    },
  };
}
