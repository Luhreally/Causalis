// The tree of life drawn (Phase 17 M129, the Observatory): lines of descent through time,
// each a bar from when it arose to its end, hung from its mother's bar where it branched
// off — a cross where one died out, a bar running on to now where one lives still. The long
// dawn of single cells is folded small at the left; the ages since the first bodies stand
// wide to its right. And a line's forebears in a row: each its body, drawn, and its name.
import type { Block, PhyloLine } from "../bridge/index.ts";
import { drawPortrait } from "./portrait.ts";
import { el } from "./why.ts";

type Phylo = Extract<Block, { type: "phylo" }>;
type Lineup = Extract<Block, { type: "lineup" }>;
type Rgb = readonly [number, number, number];

/** How much of the scale the dawn's long ages take when the chart is folded. */
const DAWN_SHARE = 0.22;
/** A row's height (px): the branches between rows are drawn by it. */
const ROW = 17;
/** A forebear's picture in a line-up (CSS px). */
const CARD_W = 76;
const CARD_H = 54;

const css = (c: Rgb) =>
  `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

/** Where a moment (millions of years ago) stands across the chart: 0 at its oldest, 1 now. */
function scaleOf(b: Phylo): (my: number) => number {
  const from = Math.max(1, b.from),
    fold = b.fold;
  if (fold === undefined || fold <= 0 || fold >= from)
    return (my) => 1 - Math.min(from, Math.max(0, my)) / from;
  return (my) => {
    const m = Math.min(from, Math.max(0, my));
    return m >= fold
      ? ((from - m) / (from - fold)) * DAWN_SHARE
      : DAWN_SHARE + (1 - m / fold) * (1 - DAWN_SHARE);
  };
}

/** A moment in a few words: "3.9 bn", "540 m", "now". */
function short(my: number): string {
  if (my <= 0) return "now";
  if (my >= 1000) return `${(my / 1000).toFixed(my >= 10_000 ? 0 : 1)} bn`;
  return `${Math.round(my)} m`;
}

/** A moment in full words: "540 million years ago". */
function ago(my: number): string {
  if (my <= 0) return "now";
  if (my >= 1000) return `${(my / 1000).toFixed(my >= 10_000 ? 0 : 1)} billion years ago`;
  return `${Math.round(my).toLocaleString("en-US")} million years ago`;
}

/**
 * The order the lines are drawn in: each mother above her daughters, her youngest daughter
 * first and her eldest last, each followed by its own — so no branch crosses another's bars.
 */
function ordered(lines: readonly PhyloLine[]): PhyloLine[] {
  const byId = new Map(lines.map((l) => [l.id, l])),
    kids = new Map<number, PhyloLine[]>(),
    roots: PhyloLine[] = [];
  for (const l of lines) {
    if (l.parent >= 0 && l.parent !== l.id && byId.has(l.parent)) {
      const k = kids.get(l.parent);
      if (k) k.push(l);
      else kids.set(l.parent, [l]);
    } else roots.push(l);
  }
  for (const k of kids.values()) k.sort((a, b) => a.from - b.from || a.id - b.id);
  roots.sort((a, b) => b.from - a.from || a.id - b.id);
  const out: PhyloLine[] = [],
    seen = new Set<number>();
  const visit = (l: PhyloLine) => {
    if (seen.has(l.id)) return;
    seen.add(l.id);
    out.push(l);
    for (const c of kids.get(l.id) ?? []) visit(c);
  };
  for (const r of roots) visit(r);
  return out;
}

/** A line's years in words, for its row's tip. */
function lifeWords(l: PhyloLine): string {
  const arose = `arose ${ago(l.from)}`;
  switch (l.fate) {
    case "lives":
      return `${arose}; lives still`;
    case "died":
      return `${arose}; died out ${ago(l.end)}`;
    default:
      return `${arose}; lives on in the lines that came of it`;
  }
}

/** The tree of life as a chart: its lines in rows, its branches, its scale of the ages. */
export function phyloChart(
  b: Phylo,
  options: {
    /** A line's name as the page draws it (a link to its page). */
    readonly label: (l: PhyloLine) => HTMLElement;
    readonly open: (ref: string) => void;
  },
): HTMLElement {
  const box = el("div", "phylo"),
    x = scaleOf(b),
    pc = (my: number) => `${(x(my) * 100).toFixed(2)}%`,
    rows = ordered(b.lines),
    at = new Map(rows.map((l, i) => [l.id, i])),
    byId = new Map(rows.map((l) => [l.id, l]));
  box.style.setProperty("--row", `${ROW}px`);
  if (b.fold !== undefined) box.style.setProperty("--fold", pc(b.fold));
  else box.classList.add("unfolded");
  // The page's own line and its forebears, lit; the rest dimmed.
  const lit = new Set<number>();
  if (b.focus !== undefined)
    for (let id = b.focus; id >= 0 && byId.has(id) && !lit.has(id); id = byId.get(id)!.parent)
      lit.add(id);
  rows.forEach((l, i) => {
    const row = el("div", "phylo-row"),
      name = el("span", "phylo-name"),
      track = el("span", "phylo-track"),
      bar = el("span", `phylo-bar fate-${l.fate}`),
      left = x(l.from),
      right = l.fate === "lives" ? 1 : x(l.end);
    if (b.focus !== undefined) row.classList.add(lit.has(l.id) ? "lit" : "dim");
    if (l.id === b.focus) row.classList.add("self");
    name.append(options.label(l));
    bar.style.left = pc(l.from);
    bar.style.width = `max(3px, ${(Math.max(0, right - left) * 100).toFixed(2)}%)`;
    bar.style.setProperty("--bar", css(l.color));
    track.append(bar);
    // Its branch: down from its mother's row to its own, where it arose.
    const m = at.get(l.parent);
    if (m !== undefined && m < i) {
      const branch = el("span", "phylo-branch");
      branch.style.left = pc(l.from);
      branch.style.height = `${(i - m) * ROW}px`;
      branch.style.setProperty("--bar", css(l.color));
      track.append(branch);
    }
    if (l.fate === "died") {
      const cross = el("span", "phylo-end", "✝");
      cross.style.left = pc(l.end);
      track.append(cross);
    }
    row.title = `${l.name}: ${lifeWords(l)}${l.words ? `. ${l.words}` : ""}`;
    row.append(name, track);
    row.onclick = (e) => {
      if ((e.target as HTMLElement).closest(".ref-link")) return;
      options.open(l.ref);
    };
    box.append(row);
  });
  // The scale of the ages: the dawn's start, the fold, then even steps to now.
  const axis = el("div", "phylo-axis"),
    marks = el("div", "phylo-marks"),
    near = b.fold ?? b.from,
    step = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find((s) => near / s <= 5) ?? 5000,
    mark = (my: number, cls = "phylo-mark") => {
      const m = el("span", cls, short(my));
      m.style.left = pc(my);
      marks.append(m);
    };
  mark(b.from, "phylo-mark first");
  if (b.fold !== undefined) mark(b.fold, "phylo-mark at-fold");
  for (let my = Math.floor((near - 1) / step) * step; my > 0; my -= step)
    if (x(my) - x(near) > 0.07 && 1 - x(my) > 0.07) mark(my);
  mark(0, "phylo-mark now");
  axis.append(el("span", "phylo-name"), marks);
  box.append(axis);
  box.append(
    el(
      "p",
      "muted phylo-key",
      `Years ago, from ${ago(b.from)} to now${
        b.fold !== undefined
          ? `; the long dawn before ${ago(b.fold)} is folded small at the left`
          : ""
      }. Each bar is a line of descent from when it arose, hung from the line it came of; ✝ where one died out; a bar running on to now lives still.`,
    ),
  );
  return box;
}

/**
 * A line of forebears in a row: each its body drawn (or its sign), its name, an arrow on to
 * the next (bodies side by side that are no line, none).
 */
export function lineupStrip(b: Lineup, open: (ref: string) => void): HTMLElement {
  const box = el("div", b.apart ? "lineup apart" : "lineup");
  b.items.forEach((item, i) => {
    if (i && !b.apart) box.append(el("span", "lineup-arrow", "→"));
    const card = el("button", `lineup-card${item.self ? " self" : ""}`);
    card.type = "button";
    card.title = `${item.name}: ${item.words}`;
    if (item.body) {
      const canvas = el("canvas", "lineup-body");
      drawPortrait(
        canvas,
        {
          kind: "creature",
          body: item.body,
          name: item.name,
          wool: item.body.covering === "wool",
        },
        CARD_W,
        CARD_H,
        0,
      );
      card.append(canvas);
    } else card.append(el("span", "lineup-icon", item.icon ?? "🧬"));
    card.append(el("span", "lineup-name", item.name));
    card.onclick = () => open(item.ref);
    box.append(card);
  });
  return box;
}
