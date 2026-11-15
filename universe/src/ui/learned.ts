// What a realm believes of how to hold itself, drawn (asked 2026-11-14: "the learned tab should have more visuals"): each of its
// numbers as a track between its two ends with where it stands, the end its evidence favours and how surely, and both through the
// years; the evidence itself on the years, each piece a small sign drawn of what it was; and whom it learned from and who from it.
// Every mark is drawn of the numbers a page gives; none is a picture chosen for a lesson.
import type { BeliefRow, EvidenceMark, TaughtBy } from "../bridge/index.ts";
import { el } from "./why.ts";

type Rgb = readonly [number, number, number];
const rgb = (c: Rgb, a = 1) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
/** A realm's colour lightened, to stand out on a dark page however deep it is. */
const lit = (c: Rgb): Rgb => [0.35 + c[0] * 0.65, 0.35 + c[1] * 0.65, 0.35 + c[2] * 0.65];
const NS = "http://www.w3.org/2000/svg";
function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}
/** The colours of having fared well, and ill. */
const WELL = "#7dffb0",
  ILL = "#ff7a5a";

function surface(c: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  c.setAttribute("aria-hidden", "true");
  const g = c.getContext("2d");
  g?.scale(dpr, dpr);
  return g;
}

/**
 * A belief's sign, drawn of its numbers: a ring as full as its evidence, the part of it that is the realm's own drawn solid and
 * what it saw befall others drawn fainter; a needle leaning to the end it favours, as far as it favours it; a dot where it stands.
 */
export function beliefGlyph(row: BeliefRow, size = 26): HTMLCanvasElement {
  const c = document.createElement("canvas"),
    g = surface(c, size, size);
  c.className = "belief-glyph";
  if (!g) return c;
  const m = size / 2,
    r = m - 2.5,
    top = -Math.PI / 2,
    all = Math.PI * 2 * Math.max(0, Math.min(1, row.sure)),
    own = all * Math.max(0, Math.min(1, row.own)),
    hue = row.lean >= 0 ? "111,231,255" : "255,196,92";
  g.lineWidth = 3;
  g.strokeStyle = "rgba(255,255,255,0.12)";
  g.beginPath();
  g.arc(m, m, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = `rgba(${hue},1)`;
  g.beginPath();
  g.arc(m, m, r, top, top + own);
  g.stroke();
  g.strokeStyle = `rgba(${hue},0.45)`;
  g.beginPath();
  g.arc(m, m, r, top + own, top + all);
  g.stroke();
  // The needle: straight up where nothing says either way, toward the high end to the right, the low to the left.
  const a = top + row.lean * (Math.PI / 2) * 0.95,
    len = r - 3;
  g.strokeStyle = "#fff";
  g.lineWidth = 1.8;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(m, m);
  g.lineTo(m + Math.cos(a) * len, m + Math.sin(a) * len);
  g.stroke();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(m, m, 1.8, 0, Math.PI * 2);
  g.fill();
  return c;
}

/**
 * A piece of evidence's sign, drawn of what it was: four petals, one a number (arms up, choices right, word down, bonds left),
 * each as long as the piece moved that belief, filled where it moved it toward the number's high end and hollow toward its low;
 * its heart green where the realm it befell fared well and red where ill, as large as it weighed; ringed in that realm's colour.
 */
export function evidenceGlyph(mark: EvidenceMark, size = 24): HTMLCanvasElement {
  const c = document.createElement("canvas"),
    g = surface(c, size, size);
  c.className = "evidence-glyph";
  if (!g) return c;
  const m = size / 2,
    reach = m - 1.5,
    core = 2 + 2.5 * Math.max(0, Math.min(1, mark.weight)),
    col = rgb(lit(mark.color));
  const dirs: readonly [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  dirs.forEach(([dx, dy], k) => {
    const v = mark.moved[k] ?? 0,
      len = core + (reach - core) * Math.min(1, Math.abs(v));
    if (Math.abs(v) < 0.08) return;
    const px = -dy,
      py = dx,
      w = 2.8;
    g.beginPath();
    g.moveTo(m + px * w, m + py * w);
    g.lineTo(m + dx * len, m + dy * len);
    g.lineTo(m - px * w, m - py * w);
    g.closePath();
    g.lineWidth = 1.2;
    g.strokeStyle = col;
    g.fillStyle = v > 0 ? col : "rgba(6,16,42,0.9)";
    g.fill();
    g.stroke();
  });
  g.beginPath();
  g.arc(m, m, core, 0, Math.PI * 2);
  g.fillStyle = mark.fared >= 0 ? WELL : ILL;
  g.fill();
  g.lineWidth = 1.2;
  g.strokeStyle = col;
  g.stroke();
  return c;
}

/** A small run of numbers through the years, between `lo` and `hi`, with a line at `mid` if given. */
function spark(
  points: readonly { x: number; y: number }[],
  lo: number,
  hi: number,
  cls: string,
  from: number,
  to: number,
  mid?: number,
): SVGSVGElement {
  const W = 100,
    H = 24,
    X = (x: number) => ((x - from) / Math.max(1, to - from)) * W,
    Y = (y: number) => H - 2 - ((Math.max(lo, Math.min(hi, y)) - lo) / (hi - lo)) * (H - 4),
    chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", class: cls });
  if (mid !== undefined)
    chart.append(svg("line", { x1: 0, x2: W, y1: Y(mid), y2: Y(mid), class: "spark-mid" }));
  // (A number that stands until it changes: drawn as steps.)
  let d = "";
  points.forEach((p, i) => {
    const x = X(p.x).toFixed(1),
      y = Y(p.y).toFixed(1);
    d += i ? `H${x} V${y}` : `M${x} ${y}`;
  });
  if (points.length) d += `H${W}`;
  chart.append(svg("path", { d, class: "spark-line" }));
  return chart;
}

/**
 * What a realm believes of each of its numbers: a row a number. Its sign; what it asks; a track from its low end to its high with
 * a marker where the realm stands and an arrow from there toward the end its evidence favours, as long as it favours it and as
 * bright as the evidence is much; its two ends named in this people's words; the belief in words (its links opened by `line`);
 * and two small runs through the years: where it stood, and what it believed.
 */
export function beliefsChart(
  rows: readonly BeliefRow[],
  line: (words: BeliefRow["words"]) => HTMLElement,
  note?: string,
): HTMLElement {
  const box = el("div", "beliefs");
  const xs = rows.flatMap((r) => [...r.stood, ...r.leans].map((p) => p.x)),
    from = Math.min(...xs),
    to = Math.max(...xs);
  for (const r of rows) {
    const row = el("div", "belief"),
      head = el("div", "belief-head"),
      track = el("div", "belief-track"),
      ends = el("div", "belief-ends"),
      at = Math.max(0, Math.min(1, r.now)),
      // (The arrow: from where it stands toward the end favoured, at most to that end.)
      reach = r.lean >= 0 ? (1 - at) * Math.min(1, r.lean * 1.6) : -at * Math.min(1, -r.lean * 1.6),
      arrow = el("span", r.lean >= 0 ? "belief-arrow up" : "belief-arrow down"),
      mark = el("span", "belief-now");
    head.append(beliefGlyph(r), el("strong", "belief-label", r.label));
    arrow.style.left = `${(Math.min(at, at + reach) * 100).toFixed(1)}%`;
    arrow.style.width = `${(Math.abs(reach) * 100).toFixed(1)}%`;
    arrow.style.opacity = String(0.35 + 0.65 * Math.max(0, Math.min(1, r.sure)));
    mark.style.left = `${(at * 100).toFixed(1)}%`;
    mark.title = `${Math.round(at * 100)} of 100`;
    track.append(el("span", "belief-mid"));
    if (Math.abs(reach) > 0.01) track.append(arrow);
    track.append(mark);
    track.setAttribute("role", "img");
    track.setAttribute(
      "aria-label",
      `${r.label}: stands at ${Math.round(at * 100)} of 100; its evidence favours ${r.lean >= 0 ? r.high : r.low}`,
    );
    ends.append(el("span", "belief-end low", r.low), el("span", "belief-end high", r.high));
    const words = line(r.words);
    words.classList.add("belief-words");
    row.append(head, track, ends, words);
    if (to > from && (r.stood.length > 1 || r.leans.length > 1)) {
      const runs = el("div", "belief-runs"),
        a = el("span", "belief-run"),
        b = el("span", "belief-run");
      a.append(
        el("span", "belief-run-name", "stood"),
        spark(r.stood, 0, 1, "spark stood", from, to),
      );
      b.append(
        el("span", "belief-run-name", "believed"),
        spark(r.leans, -0.5, 0.5, "spark leans", from, to, 0),
      );
      runs.append(a, b);
      row.append(runs);
    }
    box.append(row);
  }
  if (to > from) {
    const axis = el("div", "belief-axis");
    axis.append(el("span", undefined, `year ${from}`), el("span", undefined, `year ${to}`));
    box.append(axis);
  }
  const key = el("div", "belief-key");
  key.append(
    el("span", "key-now", "where it stands"),
    el("span", "key-arrow", "the end its evidence favours"),
    el("span", "key-ring", "ring: how much evidence, its own solid"),
  );
  box.append(key);
  if (note) box.append(el("p", "series-note", note));
  return box;
}

/**
 * The evidence on the years: its own fates in the upper lane, what it saw befall others in the lower; each piece its sign
 * (evidenceGlyph), a realm's arms beside another's, tapped to open the event that tells it. A piece rested on or tapped once
 * tells itself in the line below; `open` opens its event.
 */
export function evidenceChart(
  b: { readonly from: number; readonly to: number; readonly marks: readonly EvidenceMark[] },
  open: (ref: string) => void,
  shield?: (ref: string, size: number) => HTMLElement,
): HTMLElement {
  const box = el("div", "evidence"),
    width = Math.max(1, b.to - b.from),
    readout = el("div", "chart-readout evidence-readout muted", "Tap a sign: what it was"),
    lanes: [string, boolean][] = [
      ["Its own", true],
      ["Seen", false],
    ];
  let picked: EvidenceMark | null = null;
  for (const [name, own] of lanes) {
    const marks = b.marks.filter((m) => m.own === own);
    if (!marks.length) continue;
    const lane = el("div", "evidence-lane"),
      track = el("div", "evidence-track");
    lane.append(el("span", "evidence-name", name), track);
    // (Pieces of the same years stand side by side, never one on another: each at its year where there is room, else pushed
    // along, and all pushed back from the end. A lane holds as many as a realm keeps, a seventh of its width apart.)
    const sorted = [...marks].sort((a, c) => a.year - c.year),
      gap = 1 / 7,
      places = sorted.map((m) => (m.year - b.from) / width);
    for (let i = 1; i < places.length; i++) places[i] = Math.max(places[i]!, places[i - 1]! + gap);
    if (places.length) places[places.length - 1] = Math.min(1, places.at(-1)!);
    for (let i = places.length - 2; i >= 0; i--)
      places[i] = Math.min(places[i]!, places[i + 1]! - gap);
    sorted.forEach((m, i) => {
      const at = Math.max(0, places[i]!);
      const button = el("button", "evidence-mark");
      button.type = "button";
      button.style.left = `${(at * 100).toFixed(1)}%`;
      button.title = m.words;
      button.setAttribute("aria-label", m.words);
      button.append(evidenceGlyph(m));
      if (m.realm && shield) button.append(shield(m.realm, 9));
      button.onclick = (e) => {
        e.stopPropagation();
        // (A first tap tells it; a second opens the event that tells it. On a desk it is told when rested on.)
        if (picked === m) return open(m.ref);
        picked = m;
        for (const x of box.querySelectorAll(".evidence-mark.on")) x.classList.remove("on");
        button.classList.add("on");
        readout.classList.remove("muted");
        readout.replaceChildren(m.words, " ");
        const go = el("a", "ref-link", "Open it");
        go.href = `#${m.ref}`;
        go.onclick = (ev) => {
          ev.preventDefault();
          open(m.ref);
        };
        readout.append(go);
      };
      track.append(button);
    });
    box.append(lane);
  }
  const axis = el("div", "evidence-lane evidence-axis"),
    years = el("div", "evidence-years");
  years.append(el("span", undefined, `year ${b.from}`), el("span", undefined, `year ${b.to}`));
  axis.append(el("span", "evidence-name"), years);
  const key = el("div", "belief-key");
  key.append(
    el("span", "key-well", "fared well"),
    el("span", "key-ill", "fared ill"),
    el(
      "span",
      undefined,
      "petals: arms up, choices right, word down, bonds left; filled toward the high end",
    ),
  );
  box.append(axis, readout, key);
  return box;
}

/**
 * Whom a realm learned from, and who from it: those it learned from down the left, itself in the middle, those who learned from
 * it down the right, each band as wide as its share and in the colour of the realm it comes from. Names open their realms.
 */
export function taughtChart(
  b: {
    readonly self: { readonly name: string; readonly ref: string; readonly color: Rgb };
    readonly from: readonly TaughtBy[];
    readonly to: readonly TaughtBy[];
  },
  name: (text: string, ref: string) => HTMLElement,
): HTMLElement {
  const box = el("div", "taught"),
    rows = Math.max(1, b.from.length, b.to.length),
    ROW = 26,
    H = rows * ROW,
    W = 100,
    flows = svg("svg", {
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: "none",
      class: "taught-flows",
    }),
    left = el("div", "taught-side from"),
    right = el("div", "taught-side to"),
    mid = el("div", "taught-self");
  const side = (
    list: readonly TaughtBy[],
    into: HTMLElement,
    x0: number,
    x1: number,
    own: boolean,
  ) => {
    // (Each band leaves its name's row and meets the middle stacked by share.)
    let stack =
      (H -
        Math.min(
          H - 4,
          list.reduce((s, r) => s + 3 + r.share * 14, 0),
        )) /
      2;
    list.forEach((r, i) => {
      const row = el("div", "taught-row"),
        y = i * ROW + ROW / 2,
        w = 3 + r.share * 14,
        ym = stack + w / 2;
      stack += w;
      row.append(name(r.name, r.ref), el("span", "taught-share", `${Math.round(r.share * 100)}%`));
      into.append(row);
      const path = svg("path", {
        d: `M${x0} ${y} C${(x0 + x1) / 2} ${y} ${(x0 + x1) / 2} ${ym} ${x1} ${ym}`,
        class: "taught-flow",
      });
      path.style.stroke = rgb(lit(own ? b.self.color : r.color), 0.85);
      path.style.strokeWidth = `${w}px`;
      flows.append(path);
    });
    if (!list.length) into.append(el("div", "taught-row muted", own ? "no one yet" : "no one yet"));
  };
  side(b.from, left, 0, 50, false);
  side(b.to, right, 100, 50, true);
  mid.append(name(b.self.name, b.self.ref));
  mid.style.setProperty("--self", rgb(lit(b.self.color)));
  const heads = el("div", "taught-heads");
  heads.append(el("span", undefined, "It learned from"), el("span", undefined, "Learned from it"));
  const body = el("div", "taught-body"),
    middle = el("div", "taught-middle");
  middle.style.height = `${H}px`;
  middle.append(flows, mid);
  left.style.minHeight = right.style.minHeight = `${H}px`;
  body.append(left, middle, right);
  box.append(heads, body);
  return box;
}
