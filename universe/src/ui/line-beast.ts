// A body of a line drawn small, side on (Live a Line, 2026-11-28): for the young's cards, so the change one of them
// carries is seen on it. Our own simple look, from its body's plan as the world grows it (its parts in a row, its legs,
// fins and wings by their pairs, its neck and tail, its skin, what grows on it): the part new to it lit. SVG, nothing
// fetched.
import type { BeastPlan } from "../bridge/index.ts";

const NS = "http://www.w3.org/2000/svg";
const SKIN: Readonly<Record<string, string>> = {
  fur: "#b08a5a",
  wool: "#e8dcc2",
  feathers: "#c9b27a",
  scales: "#6f9a6a",
  shell: "#b9a58a",
  plates: "#8a8f99",
  slick: "#8fc6c8",
};

/** The body drawn (`w` × `h` px), what is new to it against `mother` lit. */
export function beastPicture(
  b: BeastPlan,
  mother: BeastPlan | null,
  w = 96,
  h = 56,
): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg"),
    add = (tag: string, at: Record<string, string | number>) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(at)) e.setAttribute(k, String(v));
      svg.append(e);
      return e;
    },
    lit = (k: keyof BeastPlan) => !!mother && JSON.stringify(mother[k]) !== JSON.stringify(b[k]),
    tone = (k: keyof BeastPlan, base: string) => (lit(k) ? "#ffd75a" : base),
    skin = SKIN[b.covering] ?? "#9ab",
    segs = Math.max(1, Math.min(3, b.segments)),
    bodyW = w * 0.46,
    bodyH = h * (b.legs ? 0.3 : 0.36),
    cx = w * 0.5,
    cy = h * (b.legs ? 0.42 : 0.5);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("line-beast-pic");
  // Its tail behind, its legs below, its body in its segments, its neck and head before.
  if (b.tail > 0.05)
    add("path", {
      d: `M ${cx - bodyW / 2} ${cy} q ${-w * 0.12} ${-h * 0.05} ${-w * (0.08 + 0.2 * b.tail)} ${h * 0.08}`,
      fill: "none",
      stroke: tone("tail", skin),
      "stroke-width": 3,
      "stroke-linecap": "round",
    });
  for (let i = 0; i < Math.min(4, b.legs); i++) {
    const x = cx - bodyW * 0.35 + (i * bodyW * 0.7) / Math.max(1, Math.min(4, b.legs) - 1 || 1);
    add("line", {
      x1: x,
      y1: cy + bodyH * 0.4,
      x2: x,
      y2: h * 0.92,
      stroke: tone("legs", "#5c4a3a"),
      "stroke-width": 2.5,
      "stroke-linecap": "round",
    });
  }
  for (let i = 0; i < segs; i++) {
    const sw = bodyW / segs;
    add("ellipse", {
      cx: cx - bodyW / 2 + sw * (i + 0.5),
      cy,
      rx: sw * 0.62,
      ry: bodyH / 2,
      fill: tone("covering", skin),
      stroke: lit("segments") ? "#ffd75a" : "rgba(0,0,0,0.25)",
      "stroke-width": 1,
    });
  }
  for (let i = 0; i < Math.min(2, b.fins); i++)
    add("path", {
      d: `M ${cx - bodyW * 0.1 + i * bodyW * 0.3} ${cy + bodyH * 0.3} l ${-w * 0.06} ${h * 0.14} l ${w * 0.1} ${-h * 0.04} Z`,
      fill: tone("fins", "#7fb6c8"),
    });
  for (let i = 0; i < Math.min(2, b.wings); i++)
    add("path", {
      d: `M ${cx - bodyW * 0.05 + i * bodyW * 0.2} ${cy - bodyH * 0.4} l ${-w * 0.14} ${-h * 0.28} l ${w * 0.2} ${h * 0.18} Z`,
      fill: tone("wings", "#d8cfb8"),
      opacity: 0.9,
    });
  const neck = b.neck * w * 0.16,
    hx = cx + bodyW / 2 + neck * 0.8,
    hy = cy - bodyH * 0.3 - neck * 0.5;
  if (neck > 1)
    add("line", {
      x1: cx + bodyW / 2 - 2,
      y1: cy - bodyH * 0.2,
      x2: hx,
      y2: hy,
      stroke: tone("neck", skin),
      "stroke-width": 4,
      "stroke-linecap": "round",
    });
  add("circle", {
    cx: hx,
    cy: hy,
    r: Math.max(4, bodyH * 0.38),
    fill: skin,
    stroke: "rgba(0,0,0,0.25)",
    "stroke-width": 1,
  });
  add("circle", { cx: hx + 2, cy: hy - 1, r: 1.6, fill: "#111" });
  if (b.features.length)
    add("path", {
      d: `M ${hx - 2} ${hy - bodyH * 0.35} l 3 -6 l 3 6`,
      fill: "none",
      stroke: tone("features", "#e8e0d0"),
      "stroke-width": 2,
    });
  return svg;
}
