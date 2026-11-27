// What lies below a town, in the town mode's inspector (O8): its ground cut through, its soil over its rocks each as
// thick as its share, the shafts of its lodes down to the depth each is dug and its wells into the ground, its water at
// hand drawn at the top; under it, each in words. Each shaft has its own place across the cut, so none lies over another.
import type { PlaceInspectBelow } from "../bridge/index.ts";
import { el } from "./why.ts";

const SVG = "http://www.w3.org/2000/svg";
/** The cut's width and depth (CSS pixels); its soil's depth, and how far down each of a lode's depths is drawn. */
const CUT_W = 320,
  CUT_H = 220,
  TOP = 24,
  SOIL = 18,
  TIER_Y = [0.22, 0.45, 0.7, 0.96] as const;
/** Rock colours, one after another (its first rock the most of it). */
const ROCK_FILL = ["#9b8a74", "#7f7466", "#a89a82", "#6e6558", "#b3a58f"] as const;
/** The most wells drawn (the rest counted). */
const WELLS_DRAWN = 4;

const svg = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  at: Record<string, string | number>,
  text?: string,
): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(at)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
};

/** Below a town, drawn and told. */
export function belowEl(x: PlaceInspectBelow): HTMLElement[] {
  const cut = svg("svg", {
    class: "place-inside-plan place-below-cut",
    viewBox: `0 0 ${CUT_W} ${CUT_H}`,
    width: CUT_W,
    height: CUT_H,
    role: "img",
    "aria-label": `The ground below the town cut through: ${x.soil} over ${x.rocks.map((r) => r.name).join(", ") || "its rock"}`,
  });
  // (The sky, and its water at hand at the top's right.)
  cut.append(svg("rect", { class: "place-below-sky", x: 0, y: 0, width: CUT_W, height: TOP }));
  if (x.water)
    cut.append(
      svg("rect", {
        class: "place-below-water",
        x: CUT_W * 0.72,
        y: TOP - 6,
        width: CUT_W * 0.28,
        height: 10,
      }),
    );
  // (Its soil, then its rocks each as thick as its share.)
  cut.append(svg("rect", { class: "place-below-soil", x: 0, y: TOP, width: CUT_W, height: SOIL }));
  const rockH = CUT_H - TOP - SOIL,
    total = x.rocks.reduce((a, r) => a + r.share, 0) || 1;
  let y = TOP + SOIL;
  x.rocks.forEach((r, k) => {
    const h = (r.share / total) * rockH;
    cut.append(
      svg("rect", { x: 0, y, width: CUT_W, height: h, fill: ROCK_FILL[k % ROCK_FILL.length]! }),
    );
    y += h;
  });
  // (Its shafts, each its own place across: its wells at the left, its lodes after them.)
  const wells = Math.min(WELLS_DRAWN, x.wells),
    shafts = wells + x.lodes.length,
    gap = CUT_W / (shafts + 1);
  for (let k = 0; k < shafts; k++) {
    const sx = gap * (k + 1),
      well = k < wells,
      lode = well ? null : x.lodes[k - wells]!,
      depth = well ? TOP + SOIL + rockH * 0.18 : TOP + SOIL + rockH * TIER_Y[lode!.tier]!;
    cut.append(
      svg("line", {
        class: well
          ? "place-below-well"
          : lode!.out !== null
            ? "place-below-shaft out"
            : "place-below-shaft",
        x1: sx,
        y1: TOP,
        x2: sx,
        y2: depth,
      }),
      svg(
        "text",
        { x: sx, y: TOP - 8, "text-anchor": "middle", "font-size": 14 },
        well ? "💧" : "⛏️",
      ),
    );
  }
  const box = el("div", "place-inside");
  box.append(cut);
  const out: HTMLElement[] = [box, el("p", "place-insp-why", x.words)];
  out.push(
    el("p", "place-insp-label", "Its ground"),
    el(
      "p",
      "place-insp-why",
      `${x.soil.charAt(0).toUpperCase()}${x.soil.slice(1)}, over ${
        x.rocks.length
          ? x.rocks.map((r) => `${r.name} (${Math.round(r.share * 100)}%)`).join(", ")
          : "rock its world does not tell"
      }.`,
    ),
    el("p", "place-insp-label", "Dug from it"),
    el(
      "p",
      "place-insp-why",
      x.lodes.length
        ? x.lodes.map((l) => l.words).join(". ") + "."
        : "Nothing has been dug from its land.",
    ),
  );
  if (x.wells > WELLS_DRAWN) out.push(el("p", "place-insp-why", `${x.wells} wells in all.`));
  return out;
}
