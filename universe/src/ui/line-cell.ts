// A cell of a line drawn small, with its parts (Live a Line, 2026-11-28): for the daughters' cards, so the change a
// daughter carries is seen on her, the part new to her lit. Our own look: a round cell, its parts as simple strokes (a
// whip of a flagellum, a fringe of cilia, spines, a thick wall, a poison's dotted halo, an eyespot, a mouth's notch, a
// filter's comb). Drawn as SVG, nothing fetched.
import type { PartId, Traits } from "../view/line.ts";

const NS = "http://www.w3.org/2000/svg";

/** The cell drawn (`size` px square), its body coloured `fill`, the part `lit` drawn in the light of the new. */
export function cellPicture(t: Traits, lit: PartId | null, fill = "#8fd6c0", size = 64): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg"),
    c = size / 2,
    r = size * 0.24,
    p = t.parts ?? {},
    on = (id: PartId) => p[id] ?? 0,
    tone = (id: PartId) => (id === lit ? "#ffd75a" : "#e8f4ff"),
    add = (tag: string, at: Record<string, string | number>) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(at)) e.setAttribute(k, String(v));
      svg.append(e);
      return e;
    };
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("line-cell-pic");
  if (on("toxin"))
    add("circle", { cx: c, cy: c, r: r + 7, fill: "none", stroke: tone("toxin"), "stroke-width": 1.5, "stroke-dasharray": "2 3", opacity: 0.8 });
  if (on("flagellum")) {
    const len = 10 + 8 * on("flagellum");
    add("path", {
      d: `M ${c - r} ${c} q ${-len / 4} ${-5} ${-len / 2} 0 t ${-len / 2} 0`,
      fill: "none",
      stroke: tone("flagellum"),
      "stroke-width": 2,
      "stroke-linecap": "round",
    });
  }
  if (on("cilia"))
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2,
        l = 3 + on("cilia");
      add("line", {
        x1: c + Math.cos(a) * r,
        y1: c + Math.sin(a) * r,
        x2: c + Math.cos(a) * (r + l),
        y2: c + Math.sin(a) * (r + l),
        stroke: tone("cilia"),
        "stroke-width": 1,
      });
    }
  if (on("spike"))
    for (let i = 0; i < 6 + 2 * on("spike"); i++) {
      const a = (i / (6 + 2 * on("spike"))) * Math.PI * 2 + 0.3,
        b = 0.18;
      add("path", {
        d: `M ${c + Math.cos(a - b) * r} ${c + Math.sin(a - b) * r} L ${c + Math.cos(a) * (r + 7)} ${c + Math.sin(a) * (r + 7)} L ${c + Math.cos(a + b) * r} ${c + Math.sin(a + b) * r} Z`,
        fill: tone("spike"),
      });
    }
  add("circle", {
    cx: c,
    cy: c,
    r,
    fill,
    "fill-opacity": 0.85,
    stroke: on("wall") ? tone("wall") : "#d8fff4",
    "stroke-width": on("wall") ? 2 + 1.5 * on("wall") : 1,
  });
  if (t.nucleus) add("circle", { cx: c + r * 0.15, cy: c + r * 0.1, r: r * 0.35, fill: "#5b3b8a", opacity: 0.8 });
  if (t.light) add("circle", { cx: c - r * 0.35, cy: c + r * 0.3, r: r * 0.2, fill: "#4caf50" });
  if (on("eyespot")) add("circle", { cx: c + r * 0.55, cy: c - r * 0.35, r: 2 + on("eyespot"), fill: tone("eyespot") === "#ffd75a" ? "#ffd75a" : "#e5432f" });
  if (on("mouth"))
    add("path", {
      d: `M ${c + r} ${c - 4 - on("mouth")} L ${c + r * 0.55} ${c} L ${c + r} ${c + 4 + on("mouth")}`,
      fill: "#0b1b33",
      stroke: tone("mouth"),
      "stroke-width": 1.2,
    });
  if (on("filter"))
    for (let i = -2; i <= 2; i++)
      add("line", {
        x1: c + r * 0.9,
        y1: c + i * 3,
        x2: c + r + 5 + 2 * on("filter"),
        y2: c + i * 3.6,
        stroke: tone("filter"),
        "stroke-width": 1,
      });
  return svg;
}
