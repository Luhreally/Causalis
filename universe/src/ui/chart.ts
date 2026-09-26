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
  chart.append(
    svg("path", {
      d: `${d} L${X(x1).toFixed(1)} ${H} L${X(x0).toFixed(1)} ${H} Z`,
      class: "chart-area",
    }),
  );
  chart.append(svg("path", { d, class: "chart-line" }));
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
