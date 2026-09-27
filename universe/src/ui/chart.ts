// Time-series charts from the macro history (docs/architecture §31): a line over
// the years with its range and latest value in words. Plain SVG, sized by its
// container, coloured by the page's tokens so it follows light and dark.
import { el } from "./why.ts";

const SVG = "http://www.w3.org/2000/svg";

export type ChartPoint = { readonly x: number; readonly y: number };

export type ChartOptions = {
  /** What the line is: "People". */
  readonly label: string;
  /** The value in words: 1234 → "1,234". */
  readonly format?: (y: number) => string;
  /** A line to draw across, such as "usual worth" at 1. */
  readonly guide?: number;
  /** Start the scale at zero (counts), or fit it to the line (ratios). */
  readonly zero?: boolean;
  /** Its own colour (a thing's), rather than the page's. */
  readonly color?: readonly [number, number, number];
};

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** A small line chart of a series over the years. */
export function lineChart(points: readonly ChartPoint[], options: ChartOptions): HTMLElement {
  const box = el("figure", "chart"),
    format = options.format ?? ((y: number) => Math.round(y).toLocaleString());
  const last = points.at(-1);
  const head = el("figcaption");
  head.append(
    el("span", undefined, options.label),
    el("strong", undefined, last ? format(last.y) : "—"),
  );
  box.append(head);
  if (points.length < 2) {
    box.append(el("p", "muted", "Not enough years yet."));
    return box;
  }
  const W = 300,
    H = 70,
    pad = 2,
    xs = points.map((p) => p.x),
    ys = points.map((p) => p.y).concat(options.guide !== undefined ? [options.guide] : []);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = options.zero ? 0 : Math.min(...ys),
    y1 = Math.max(...ys, y0 + 1e-9);
  const X = (x: number) => pad + ((x - x0) / Math.max(1e-9, x1 - x0)) * (W - 2 * pad),
    Y = (y: number) => H - pad - ((y - y0) / (y1 - y0)) * (H - 2 * pad);
  const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", role: "img" });
  chart.setAttribute(
    "aria-label",
    `${options.label}: from ${format(points[0]!.y)} in year ${x0} to ${format(last!.y)} in year ${x1}`,
  );
  if (options.guide !== undefined)
    chart.append(
      svg("line", {
        x1: 0,
        x2: W,
        y1: Y(options.guide),
        y2: Y(options.guide),
        class: "chart-guide",
      }),
    );
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`)
    .join(" ");
  const area = svg("path", {
      d: `${d} L${X(x1).toFixed(1)} ${H} L${X(x0).toFixed(1)} ${H} Z`,
      class: "chart-area",
    }),
    line = svg("path", { d, class: "chart-line" });
  if (options.color) {
    const c = options.color.map((v) => Math.round(v * 255)).join(", ");
    area.style.fill = `rgb(${c})`;
    line.style.stroke = `rgb(${c})`;
  }
  chart.append(area, line);
  box.append(chart);
  const axis = el("div", "axis");
  axis.append(
    el("span", undefined, `year ${x0}`),
    el("span", undefined, `${format(y0)} – ${format(y1)}`),
    el("span", undefined, `year ${x1}`),
  );
  box.append(axis);
  return box;
}

type Rgb = readonly [number, number, number];

const rgb = (c: Rgb, a = 1) =>
  `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${a})`;

/** A thing's line on a chart of several: its name (as the key draws it), colour and points. */
export type Series = {
  readonly name: string;
  readonly color: Rgb;
  readonly points: readonly ChartPoint[];
};

/**
 * Several things' lines over the same years (Phase 10 M96b), each its own colour, with a key
 * of their names — `key` draws each (a name that opens its page) — and, under the pointer, the
 * year there and each line's value at it.
 */
export function linesChart(
  series: readonly Series[],
  options: ChartOptions & { readonly key: (s: Series, i: number) => HTMLElement },
): HTMLElement {
  const box = el("figure", "chart chart-lines"),
    format = options.format ?? ((y: number) => Math.round(y).toLocaleString("en-US")),
    drawn = series.filter((s) => s.points.length > 1);
  box.append(el("figcaption", undefined, options.label));
  if (!drawn.length) {
    box.append(el("p", "muted", "Not enough years yet."));
    return box;
  }
  const W = 300,
    H = 120,
    pad = 3,
    xs = drawn.flatMap((s) => s.points.map((p) => p.x)),
    ys = drawn.flatMap((s) => s.points.map((p) => p.y)),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = options.zero ? 0 : Math.min(...ys),
    y1 = Math.max(...ys, y0 + 1e-9),
    X = (x: number) => pad + ((x - x0) / Math.max(1e-9, x1 - x0)) * (W - 2 * pad),
    Y = (y: number) => H - pad - ((y - y0) / (y1 - y0)) * (H - 2 * pad);
  const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", role: "img" });
  chart.setAttribute(
    "aria-label",
    `${options.label}: ${drawn.map((s) => `${s.name} ${format(s.points.at(-1)!.y)}`).join(", ")}`,
  );
  // The scale's quarters, faint.
  for (const k of [0.25, 0.5, 0.75])
    chart.append(
      svg("line", {
        x1: 0,
        x2: W,
        y1: Y(y0 + (y1 - y0) * k),
        y2: Y(y0 + (y1 - y0) * k),
        class: "chart-grid",
      }),
    );
  drawn.forEach((s) => {
    const d = s.points
      .map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`)
      .join(" ");
    const path = svg("path", { d, class: "chart-series" });
    path.style.stroke = rgb(s.color);
    chart.append(path);
  });
  const cursor = svg("line", { x1: 0, x2: 0, y1: 0, y2: H, class: "chart-cursor" });
  cursor.style.display = "none";
  chart.append(cursor);
  box.append(chart);
  const axis = el("div", "axis");
  axis.append(
    el("span", undefined, `year ${x0}`),
    el("span", undefined, `${format(y0)} – ${format(y1)}`),
    el("span", undefined, `year ${x1}`),
  );
  const readout = el("div", "chart-readout");
  const key = el("div", "chart-key");
  drawn.forEach((s, i) => {
    const k = el("span", "key"),
      dot = el("span", "swatch");
    dot.style.background = rgb(s.color);
    k.append(dot, options.key(s, i), el("span", "key-value", format(s.points.at(-1)!.y)));
    key.append(k);
  });
  box.append(axis, key, readout);
  // Under the pointer: the year there, each line's value at it.
  const at = (e: PointerEvent) => {
    const r = chart.getBoundingClientRect();
    if (!r.width) return;
    const year = Math.round(x0 + ((e.clientX - r.left) / r.width) * (x1 - x0));
    cursor.style.display = "";
    cursor.setAttribute("x1", String(X(year)));
    cursor.setAttribute("x2", String(X(year)));
    const values = drawn.map((s) => {
      let v: number | null = null;
      for (const p of s.points) {
        if (p.x > year) break;
        v = p.y;
      }
      return `${s.name} ${v === null ? "—" : format(v)}`;
    });
    readout.textContent = `Year ${year}: ${values.join(" · ")}`;
  };
  chart.addEventListener("pointermove", at);
  chart.addEventListener("pointerdown", at);
  chart.addEventListener("pointerleave", () => {
    cursor.style.display = "none";
    readout.textContent = "";
  });
  return box;
}

/** A bar of a chart of things side by side. */
export type Bar = {
  readonly label: HTMLElement;
  readonly value: number;
  readonly color?: Rgb;
  readonly open?: () => void;
};

/** Things side by side as bars (Phase 10 M96b): each its name, its bar and its amount. */
export function barsChart(bars: readonly Bar[], format?: (y: number) => string): HTMLElement {
  const box = el("div", "bars"),
    f = format ?? ((y: number) => Math.round(y).toLocaleString("en-US")),
    most = Math.max(1e-9, ...bars.map((b) => b.value));
  for (const b of bars) {
    const row = el("div", b.open ? "bar-row entry" : "bar-row"),
      name = el("span", "bar-name"),
      track = el("span", "bar-track"),
      fill = el("span", "bar-fill");
    name.append(b.label);
    fill.style.width = `${Math.max(1.5, (b.value / most) * 100).toFixed(1)}%`;
    if (b.color) {
      const c = b.color,
        up = (x: number) => Math.min(1, x * 1.35 + 0.12),
        light = rgb([up(c[0]), up(c[1]), up(c[2])]),
        dark = rgb([c[0] * 0.72, c[1] * 0.72, c[2] * 0.72]);
      fill.style.background = `linear-gradient(180deg, ${light} 0%, ${rgb(c)} 55%, ${dark} 100%)`;
    }
    track.append(fill);
    row.append(name, track, el("span", "bar-value", f(b.value)));
    if (b.open) {
      const open = b.open;
      row.onclick = (e) => {
        if ((e.target as HTMLElement).closest(".ref-link")) return;
        open();
      };
    }
    box.append(row);
  }
  return box;
}

/** A thing's span on a timeline. */
export type Span = {
  readonly label: HTMLElement;
  readonly from: number;
  /** Its end, or null while it lasts. */
  readonly to: number | null;
  readonly color?: Rgb;
  readonly words?: string;
  readonly open?: () => void;
};

/**
 * Things through the years (Phase 10 M96b): each a bar from its beginning to its end, one
 * still lasting running on to now, over a scale of the years with its centuries marked.
 */
export function timelineChart(spans: readonly Span[], from: number, to: number): HTMLElement {
  const box = el("div", "timeline"),
    width = Math.max(1, to - from),
    at = (y: number) => `${(((Math.min(to, Math.max(from, y)) - from) / width) * 100).toFixed(2)}%`;
  // The centuries (or decades, on a short span) as faint marks.
  const step = width > 600 ? 200 : width > 250 ? 100 : width > 60 ? 25 : 10,
    marks = el("div", "timeline-marks");
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) {
    const m = el("span", "timeline-mark", String(y));
    m.style.left = at(y);
    marks.append(m);
  }
  for (const s of spans) {
    const row = el("div", s.open ? "timeline-row entry" : "timeline-row"),
      name = el("span", "timeline-name"),
      track = el("span", "timeline-track"),
      bar = el("span", s.to === null ? "timeline-bar lasting" : "timeline-bar");
    name.append(s.label);
    const end = s.to ?? to;
    bar.style.left = at(s.from);
    bar.style.width = `max(3px, ${(((Math.min(to, end) - Math.max(from, s.from)) / width) * 100).toFixed(2)}%)`;
    if (s.color) bar.style.setProperty("--bar", rgb(s.color));
    bar.title = `year ${s.from} – ${s.to === null ? "now" : `year ${s.to}`} (${end - s.from} years)${s.words ? `, ${s.words}` : ""}`;
    track.append(bar);
    // Its words beside it: after its end, or before its start when it ends near now.
    if (s.words) {
      const words = el("span", "timeline-words", s.words),
        start = (Math.max(from, s.from) - from) / width,
        stop = (Math.min(to, end) - from) / width;
      if (stop < 0.66) words.style.left = `calc(${(stop * 100).toFixed(2)}% + 5px)`;
      else words.style.right = `calc(${((1 - start) * 100).toFixed(2)}% + 5px)`;
      track.append(words);
    }
    row.append(name, track);
    if (s.open) {
      const open = s.open;
      row.onclick = (e) => {
        if ((e.target as HTMLElement).closest(".ref-link")) return;
        open();
      };
    }
    box.append(row);
  }
  const axis = el("div", "timeline-axis");
  axis.append(el("span", "timeline-name"), marks);
  box.append(axis);
  return box;
}
