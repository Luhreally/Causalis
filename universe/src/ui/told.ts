// A year told (asked 2026-11-19: "whats a good way to like absorb everything thats going on like a summary of the year"): the
// page's tool. A headline and a few sentences of what the year was, its picture, the numbers that moved, the year's map, and
// what each side of life saw, each line a way to its happening's page. Back and on a year keep the reader where they were, in
// the section they were reading; a decade and a century are told the same way, by their years' leads.
//
// It reads when a reader asks and at no other time: nothing as the world runs, nothing while its page is shut. Its pictures are
// drawn once they are scrolled into sight, on canvases lent again from year to year (ui/told-art.ts).
import type {
  Line,
  ToldFigure,
  ToldItem,
  ToldLead,
  ToldMapBase,
  ToldSection,
  YearTold,
} from "../bridge/index.ts";
import { YEAR } from "../kernel/index.ts";
import { phoneSized } from "./keys.ts";
import type { ToolContext } from "./tools.ts";
import { drawSpark, drawVignette, drawYearMap, markCanvas } from "./told-art.ts";
import { lineInto } from "./years.ts";
import { el } from "./why.ts";

/** The ref that opens a year told (or a run of years), of the world or of a realm. */
export function toldRef(year: number, to = year, realm: string | null = null): string {
  return `told:${year}${to > year ? `..${to}` : ""}${realm ? `:${realm}` : ""}`;
}

/** How it stood when its page was left: the years told, and the part under the eye with how far under the window's top. */
interface ToldKept {
  readonly year: number;
  readonly to: number;
  readonly part: string | null;
  readonly off: number;
}

/** A world's lands as the map draws them: asked once a world, the last two kept. */
const BASES = new Map<string, ToldMapBase>();

/** A run of this many years or more is read a piece at a time. */
const LONG_RUN = 30;

/** How many of these stand in a page now: when the last is shut, the host lets go of what it kept for them. */
let standing = 0;

/** How long the last telling took to draw (ms), and its pictures: for a gate to weigh. */
export const TOLD_COST = { read: 0, draw: 0, art: 0, drawn: 0 };

const comma = (n: number) => n.toLocaleString("en-US");

export function drawTold(
  into: HTMLElement,
  args: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): void {
  const realm = typeof args.realm === "string" ? args.realm : null,
    was = (ctx.kept as ToldKept | undefined) ?? null,
    box = el("div", "told"),
    nav = el("div", "told-nav"),
    back = el("button", "told-step told-back"),
    on = el("button", "told-step told-on"),
    kicker = el("div", "told-kicker"),
    spans = el("div", "told-spans"),
    body = el("div", "told-body"),
    foot = el("div", "told-nav told-foot"),
    back2 = el("button", "told-step told-back"),
    on2 = el("button", "told-step told-on"),
    onward = el("button", "told-onward"),
    input = el("input", "told-at") as HTMLInputElement,
    go = el("button", "told-to", "Go");
  let year = was?.year ?? (Number(args.year) || 0),
    to = was?.to ?? (Number(args.to) || year),
    told: YearTold | null = null,
    token = 0,
    first = true;
  input.type = "number";
  input.inputMode = "numeric";
  input.placeholder = "A year";
  input.enterKeyHint = "go";
  input.setAttribute("aria-label", "A year to go to");
  onward.hidden = true;
  nav.append(back, kicker, on);
  foot.append(back2, on2);
  box.append(nav, spans, onward, body, foot);
  into.append(box);
  const scroller = () => box.closest<HTMLElement>(".page-window") ?? document.documentElement;

  // —— Pictures: drawn once in sight, on canvases lent again ——
  const draws = new Map<HTMLCanvasElement, { draw: () => void; seen: boolean; dirty: boolean }>(),
    pool: HTMLCanvasElement[] = [];
  let watch: IntersectionObserver | null = null;
  const paint = (c: HTMLCanvasElement) => {
    const d = draws.get(c);
    if (!d || !d.dirty || !d.seen || !c.isConnected) return;
    d.dirty = false;
    const t = performance.now();
    d.draw();
    TOLD_COST.art += performance.now() - t;
    TOLD_COST.drawn++;
    c.dataset.drawn = "1";
    box.dataset.art = TOLD_COST.art.toFixed(1);
  };
  const lend = (cls: string, draw: (c: HTMLCanvasElement) => void): HTMLCanvasElement => {
    const c = pool.pop() ?? document.createElement("canvas");
    c.className = cls;
    c.setAttribute("aria-hidden", "true");
    delete c.dataset.drawn;
    draws.set(c, { draw: () => draw(c), seen: false, dirty: true });
    return c;
  };
  const watchAll = () => {
    watch?.disconnect();
    watch = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const c = e.target as HTMLCanvasElement,
            d = draws.get(c);
          if (!d) continue;
          d.seen = e.isIntersecting;
          if (d.seen && d.dirty) requestAnimationFrame(() => paint(c));
        }
      },
      {
        root: scroller() === document.documentElement ? null : scroller(),
        rootMargin: "120px 0px",
      },
    );
    for (const c of draws.keys()) watch.observe(c);
  };
  /** Every canvas taken back, to be lent to the next telling. */
  const takeBack = () => {
    watch?.disconnect();
    for (const c of draws.keys()) if (pool.length < 24) pool.push(c);
    draws.clear();
  };

  // —— Its parts ——
  const width = () => Math.max(200, Math.floor(body.clientWidth || box.clientWidth || 320));
  const lineOf = (item: ToldItem, cls: string): HTMLElement => {
    const row = el(item.ref ? "div" : "p", item.ref ? `line entry ${cls}` : cls);
    lineInto(row, item.line, ctx.open);
    if (item.ref) {
      const ref = item.ref;
      row.onclick = () => ctx.open(ref);
      row.title = "What happened, and why";
    }
    return row;
  };
  const part = (id: string, cls: string): HTMLElement => {
    const s = el("section", `told-part ${cls}`);
    s.dataset.part = id;
    return s;
  };

  const leadPart = (lead: ToldLead, i: number, t: YearTold): HTMLElement => {
    const s = part(`lead${i}`, "told-lead");
    s.append(el(i ? "h4" : "h3", "told-headline", lead.headline));
    if (lead.vignette && t.art) {
      const v = lead.vignette,
        art = t.art,
        h = phoneSized() ? 84 : 96,
        w = width(),
        c = lend("told-vignette", (x) => drawVignette(x, v, art, w, h));
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      c.dataset.motif = v.motif;
      s.append(c);
    }
    for (const l of lead.lines) s.append(lineOf(l, "told-lead-line"));
    const ways = (title: string, items: readonly ToldItem[], cls: string) => {
      if (!items.length) return;
      const more = el("details", `told-ways ${cls}`),
        sum = el("summary", undefined, title);
      more.append(sum, ...items.map((x) => lineOf(x, "told-way")));
      s.append(more);
    };
    ways("What led to this", lead.before, "told-before");
    ways("What came of this", lead.after, "told-after");
    // Read when either is opened, once: what lies behind a happening may be a far year's.
    if (lead.ways) {
      const asked = lead.ways,
        boxes = (["before", "after"] as const).map((side) => {
          const more = el("details", `told-ways told-${side}`);
          more.append(
            el("summary", undefined, side === "before" ? "What led to this" : "What came of this"),
          );
          s.append(more);
          return more;
        });
      let got = false;
      const open = async () => {
        if (got) return;
        got = true;
        for (const b of boxes) b.append(el("p", "muted told-note", "Reading…"));
        let w: { before: ToldItem[]; after: ToldItem[] } = { before: [], after: [] };
        try {
          w = await ctx.client.query({ type: "told.ways", args: { ...asked, realm } });
        } catch {
          // (Nothing to show of it.)
        }
        boxes.forEach((b, i) => {
          const items = i ? w.after : w.before;
          b.replaceChildren(
            b.firstElementChild!,
            ...(items.length
              ? items.map((x) => lineOf(x, "told-way"))
              : [
                  el(
                    "p",
                    "muted told-note",
                    i
                      ? "History holds nothing yet that names it as its cause."
                      : "History holds no happening behind it: it began with those who did it.",
                  ),
                ]),
          );
        });
      };
      for (const b of boxes) b.addEventListener("toggle", () => b.open && void open());
    }
    return s;
  };

  const figurePart = (figures: readonly ToldFigure[]): HTMLElement => {
    const s = part("figures", "told-figures");
    for (const f of figures) {
      const tile = el(f.ref ? "button" : "div", "told-figure"),
        change = (c: ToldFigure["year1"]) => {
          if (!c) return null;
          const tone = !c.way || !f.good ? "same" : c.way * f.good > 0 ? "good" : "bad",
            x = el("span", `told-change told-${tone}`, c.words);
          return x;
        },
        c1 = change(f.year1),
        c10 = change(f.year10);
      tile.append(
        el("span", "told-figure-label", f.label),
        el("span", "told-figure-value", f.value),
      );
      if (f.points.length > 1) {
        const c = lend("told-spark", (x) => drawSpark(x, f, 76, 24));
        c.style.width = "76px";
        c.style.height = "24px";
        tile.append(c);
      }
      if (c1) tile.append(c1);
      if (c10) tile.append(c10);
      if (!c1 && !c10 && !f.label.endsWith("in all"))
        tile.append(el("span", "told-change told-same", "not kept by the year"));
      if (f.ref) {
        const ref = f.ref;
        tile.onclick = () => ctx.open(ref);
      }
      s.append(tile);
    }
    return s;
  };

  const mapPart = (t: YearTold): HTMLElement | null => {
    const map = t.map,
      art = t.art;
    if (!map || !art || (!map.lands.length && !map.marks.length)) return null;
    const s = part("map", "told-map"),
      w = width(),
      c = lend("told-map-canvas", (x) => {
        const base = BASES.get(map.base);
        if (!base) return;
        const h = drawYearMap(x, base, map, art, w);
        x.style.height = `${h}px`;
      });
    c.style.width = `${w}px`;
    c.style.height = `${Math.round(w * (map.focus?.length ? 0.52 : 0.5))}px`;
    s.append(
      el(
        "h3",
        "told-h",
        t.subject
          ? "Its lands and those about them"
          : t.to > t.year
            ? "Who held what over these years"
            : "Who held what that year",
      ),
      c,
    );
    if (map.legend.length) {
      const key = el("div", "told-legend");
      for (const k of map.legend) {
        const one = el("span", "told-legend-one");
        one.append(markCanvas(k.kind), k.words);
        key.append(one);
      }
      s.append(key);
    }
    if (map.note) s.append(el("p", "muted told-note", map.note));
    // (Its lands' places are asked once a world, and the map drawn when they have come.)
    if (!BASES.has(map.base))
      void ctx.client.query<ToldMapBase | null>({ type: "told.base" }).then((base) => {
        if (!base) return;
        BASES.set(base.key, base);
        while (BASES.size > 2) BASES.delete(BASES.keys().next().value!);
        const d = draws.get(c);
        if (d) {
          d.dirty = true;
          requestAnimationFrame(() => paint(c));
        }
      });
    return s;
  };

  const sectionPart = (sec: ToldSection): HTMLElement => {
    const s = part(sec.id, "told-section");
    s.append(el("h3", "told-h", `${sec.icon} ${sec.name}`));
    if (sec.text.length) {
      const p = el("p", "told-text");
      lineInto(p, sec.text, ctx.open);
      s.append(p);
    }
    for (const item of sec.items) s.append(lineOf(item, "told-line"));
    if (sec.more) {
      const more = el(
        "button",
        "told-more",
        `${comma(sec.more)} more ${sec.more === 1 ? "line" : "lines"} in The Years`,
      );
      more.onclick = () => ctx.open("world:chronicle#years");
      s.append(more);
    }
    return s;
  };

  const yearsPart = (t: YearTold): HTMLElement | null => {
    if (!t.years.length) return null;
    const s = part("years", "told-years");
    s.append(el("h3", "told-h", "Year by year, the greatest first"));
    for (const y of t.years) {
      const row = el("button", "told-year-row");
      row.append(
        el("span", "told-year-at", String(y.year)),
        el("span", "told-year-says", y.headline),
      );
      row.onclick = () => void read(y.year, y.year, null);
      s.append(row);
    }
    if (t.moreYears)
      s.append(
        el(
          "p",
          "muted told-note",
          `and ${comma(t.moreYears)} more ${t.moreYears === 1 ? "year" : "years"}, each its own telling: step to any of them.`,
        ),
      );
    return s;
  };

  // —— Where the reader is ——
  /** The part under the window's top, and how far under it. */
  const where = (): { part: string | null; off: number } => {
    const root = scroller(),
      top = root === document.documentElement ? 0 : root.getBoundingClientRect().top;
    for (const p of body.querySelectorAll<HTMLElement>("[data-part]")) {
      const r = p.getBoundingClientRect();
      if (r.bottom > top + 1) return { part: p.dataset.part!, off: r.top - top };
    }
    return { part: null, off: 0 };
  };
  /** The same part put back where it stood (or the part before it, where the year has none of it). */
  const settle = (at: { part: string | null; off: number }) => {
    if (!at.part) return;
    const all = [...body.querySelectorAll<HTMLElement>("[data-part]")],
      order = [
        "lead0",
        "lead1",
        "lead2",
        "years",
        "figures",
        "map",
        "power",
        "war",
        "money",
        "people",
        "minds",
        "bodies",
        "nature",
        "far",
      ],
      want = order.indexOf(at.part);
    let best: HTMLElement | null = null;
    for (const p of all) if (order.indexOf(p.dataset.part!) <= want) best = p;
    if (!best) return;
    const root = scroller(),
      top = root === document.documentElement ? 0 : root.getBoundingClientRect().top;
    root.scrollTop +=
      best.getBoundingClientRect().top - top - (best.dataset.part === at.part ? at.off : 8);
  };

  const spanOf = (y: number, size: number): [number, number] => {
    if (size <= 1) return [y, y];
    const from = Math.floor(y / size) * size;
    return [from, from + size - 1];
  };
  const size = () => (to - year >= 50 ? 100 : to > year ? 10 : 1);

  const fill = (t: YearTold, at: { part: string | null; off: number } | null) => {
    const began = performance.now();
    told = t;
    year = t.year;
    to = t.to;
    takeBack();
    const run = t.to > t.year,
      step = size(),
      label = (y: number) => (step > 1 ? `${y}s` : String(y)),
      canBack = t.year > 0,
      canOn = t.to < t.now;
    for (const [b, way] of [
      [back, -1],
      [back2, -1],
      [on, 1],
      [on2, 1],
    ] as const) {
      const target = way < 0 ? t.year - step : t.year + step;
      b.textContent = way < 0 ? `◀ ${label(Math.max(0, target))}` : `${label(target)} ▶`;
      b.disabled = way < 0 ? !canBack : !canOn;
      b.setAttribute("aria-label", way < 0 ? "The years before" : "The years after");
    }
    kicker.replaceChildren(
      el("span", "told-kicker-year", t.kicker),
      ...(t.subject ? [el("span", "told-kicker-of", ` · ${t.subject.name}`)] : []),
    );
    // The way to a decade, a century, a year, and for a realm, to the world's own.
    const chip = (words: string, onNow: boolean, act: () => void) => {
      const b = el("button", onNow ? "told-span on" : "told-span", words);
      b.setAttribute("aria-pressed", String(onNow));
      b.onclick = act;
      return b;
    };
    input.value = "";
    const goRow = el("span", "told-go");
    goRow.append(input, go);
    spans.replaceChildren(
      chip("Year", !run, () => void read(t.to >= t.now ? t.now : t.year, undefined, null)),
      chip("Decade", step === 10, () => void read(...spanOf(t.year, 10), null)),
      chip("Century", step === 100, () => void read(...spanOf(t.year, 100), null)),
      goRow,
      ...(t.subject ? [chip("🌍 The world's", false, () => ctx.open(toldRef(t.year, t.to)))] : []),
    );
    const parts: (HTMLElement | null)[] = [];
    t.leads.forEach((l, i) => parts.push(leadPart(l, i, t)));
    if (t.less && !t.partial) {
      const less = el("p", "told-less");
      lineInto(less, t.less, ctx.open);
      parts.push(less);
      // (How many of its decade's lesser things history has let go: asked after the page stands, and said when it comes.)
      const mine = token;
      void ctx.client.query<number>({ type: "told.gone", args: { year: t.year } }).then((n) => {
        if (mine !== token || !n || !less.isConnected) return;
        less.append(
          ` Of its decade, ${comma(n)} lesser happenings are counted and no longer told.`,
        );
      });
    }
    parts.push(yearsPart(t));
    if (t.figures.length) parts.push(figurePart(t.figures));
    parts.push(mapPart(t));
    for (const s of t.sections) parts.push(sectionPart(s));
    body.replaceChildren(...parts.filter((p): p is HTMLElement => !!p));
    foot.hidden = t.sections.length + t.leads.length < 3;
    if (at) settle(at);
    watchAll();
    TOLD_COST.draw = performance.now() - began;
    box.dataset.year = String(t.year);
    box.dataset.to = String(t.to);
    box.dataset.read = String(t.ms);
    box.dataset.drew = TOLD_COST.draw.toFixed(1);
  };

  /** Read a year (or a run) and draw it, the reader kept where they were. */
  const read = async (
    y: number,
    end = y,
    at: { part: string | null; off: number } | null = where(),
  ) => {
    const mine = ++token,
      t0 = performance.now();
    box.classList.add("reading");
    let t: YearTold,
      longest = 0;
    /** One asking of the host, and how long the longest of this reading took. */
    const ask = async <T>(type: string, args: Record<string, unknown>): Promise<T> => {
      const a0 = performance.now(),
        got = await ctx.client.query<T>({ type, args });
      longest = Math.max(longest, performance.now() - a0);
      return got;
    };
    try {
      if (end - y >= LONG_RUN) {
        // A long run of years is read a stretch an asking, so the host is never held long; its lead is drawn as soon as
        // its years are read, and its sections, numbers and map when they come.
        kicker.replaceChildren(el("span", "told-kicker-year", `Reading ${y} to ${end}…`));
        for (let next: number | null = y; next !== null;) {
          next = await ask<number | null>("told.warm", { year: next, to: end });
          if (mine !== token || !box.isConnected) return;
        }
        const lead = await ask<YearTold>("told.read", { year: y, to: end, realm, lead: true });
        if (mine !== token || !box.isConnected) return;
        fill(lead, at);
        body.append(
          el("p", "muted told-note told-coming", "Its years, numbers and map are being read…"),
        );
        at = where();
      }
      t = await ask<YearTold>("told.read", { year: y, to: end, realm });
    } catch {
      box.classList.remove("reading");
      return;
    }
    if (mine !== token || !box.isConnected) return;
    box.dataset.longest = longest.toFixed(1);
    TOLD_COST.read = performance.now() - t0;
    TOLD_COST.art = 0;
    TOLD_COST.drawn = 0;
    box.dataset.asked = TOLD_COST.read.toFixed(1);
    box.classList.remove("reading");
    onward.hidden = true;
    fill(t, at);
    if (first) {
      first = false;
      if (was?.part) {
        ctx.placed?.();
        settle({ part: was.part, off: was.off });
      }
    }
  };

  const step = (way: -1 | 1) => {
    if (!told) return;
    const n = size(),
      from = Math.max(0, told.year + way * n);
    if (from > told.now) return;
    void read(from, n > 1 ? from + n - 1 : from);
  };
  back.onclick = back2.onclick = () => step(-1);
  on.onclick = on2.onclick = () => step(1);
  const goNow = () => {
    const y = Number(input.value);
    if (!input.value.trim() || !Number.isFinite(y)) return;
    const n = size(),
      [a, b] = spanOf(Math.max(0, Math.round(y)), n);
    void read(a, b, null);
  };
  go.onclick = goNow;
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
      goNow();
    }
  };
  // How it stands, asked as its page is left.
  ctx.keep?.((): ToldKept => ({ year, to, ...where() }));
  // The world goes on while this is read: the year open now is read again only when asked.
  onward.onclick = () => {
    if (told)
      void read(told.to >= told.now ? Math.max(year, told.now) : year, to > year ? to : undefined);
  };
  standing++;
  const stop = ctx.client.onStatus((s) => {
    if (!box.isConnected) {
      stop();
      watch?.disconnect();
      // (Its page shut and no other open: what the host kept for it is let go.)
      if (--standing <= 0) {
        standing = 0;
        void ctx.client.query({ type: "told.forget" }).catch(() => {});
      }
      return;
    }
    if (!told || told.to < told.now) return;
    const now = Math.floor(s.t / YEAR);
    if (now > told.now) {
      const words = `The world has gone on to ${now}: read it again`;
      if (onward.textContent !== words) onward.textContent = words;
      onward.hidden = false;
    }
  });
  void read(year, to, null);
}
