// Live a Line's space played (2026-11-28, the last flat stage): the stars about home as a map, from the cluster's own
// places (light-years from home, in the disk's plane), with the realm's ships drawn along their crossings at how far they
// have come, the worlds it settled, the star its next ship was asked for, and the stars in its reach to choose among.
// Choosing on the map is the same ask as on the list (space.ask): the realm still sails in its own time, by its own
// voyage rule. Fetched with Live a Line only.
import type { LineStars } from "../host/line-story.ts";

const NS = "http://www.w3.org/2000/svg";
/** The map's size in its own units, a pixel each at a desk's width; a star's touch ring (50 across, some 44 pixels on a phone). */
const W = 400,
  H = 260,
  HIT = 25;

const make = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

/**
 * The map: home in the middle, the stars in reach (taken ones grey), the worlds settled (green), the star asked for (a
 * gold ring), the one picked (a white ring), each ship a dot along its crossing. A star pressed is picked (`onPick`).
 */
export function starMap(
  st: LineStars,
  picked: string | null,
  onPick: (ref: string) => void,
  /** A ship under way pressed: ridden (app/line-ride.ts). */
  onRide: (land: string) => void,
): SVGSVGElement {
  const svg = make("svg", {
    viewBox: `${-W / 2} ${-H / 2} ${W} ${H}`,
    class: "line-star-map",
    role: "img",
    "aria-label": "The stars about home, and your realm's ships",
  });
  // (A fisheye about home: a star's place drawn at d / (d + k) of the way to the edge, k the middle distance of the stars
  // in reach, so the near stars stand apart and the far ones (a lane's, an old colony's) still fit, nearer the rim.)
  const RX = W / 2 - HIT,
    RY = H / 2 - HIT,
    ds = st.stars.map((s) => Math.hypot(s.at[0], s.at[1])).sort((a, b) => a - b),
    k = Math.max(1, ds[Math.floor(ds.length / 2)] ?? 5),
    f = (d: number) => d / (d + k),
    at = ([x, y]: readonly [number, number]) => {
      const d = Math.hypot(x, y);
      if (d < 1e-6) return [0, 0] as const;
      return [(x / d) * f(d) * RX, (-y / d) * f(d) * RY] as const;
    };
  // (Rings of distance, faint, each told in light-years.)
  const nice = (v: number) => {
    const p = 10 ** Math.floor(Math.log10(v)),
      m = v / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  };
  for (const r of new Set([nice(k / 2), nice(k), nice(k * 3)])) {
    svg.append(make("ellipse", { rx: f(r) * RX, ry: f(r) * RY, class: "line-star-ring" }));
    const t = make("text", {
      x: f(r) * RX * 0.71 + 2,
      y: -f(r) * RY * 0.71 - 2,
      class: "line-star-ly",
    });
    t.textContent = `${r} ly`;
    svg.append(t);
  }
  const settled = new Set(st.ships.filter((s) => s.arrived).map((s) => s.star)),
    ships: { land: string; x: number; y: number }[] = [];
  // —— The ships: a line from where each sailed to where it goes, a dot where it is now.
  for (const sh of st.ships) {
    const [x0, y0] = at(sh.from),
      [x1, y1] = at(sh.to),
      span = Math.max(1, sh.arrives - sh.departed),
      f = sh.arrived ? 1 : Math.max(0, Math.min(1, (st.year - sh.departed) / span));
    svg.append(
      make("line", {
        x1: x0,
        y1: y0,
        x2: x1,
        y2: y1,
        class: sh.arrived ? "line-star-way come" : "line-star-way",
      }),
    );
    if (!sh.arrived) ships.push({ land: sh.land, x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f });
  }
  // —— Home.
  svg.append(make("circle", { r: 6, class: "line-star-home" }));
  const home = make("text", { x: 0, y: 18, class: "line-star-label" });
  home.textContent = "home";
  svg.append(home);
  // —— The stars in reach, and the worlds settled.
  const drawn = new Set<string>();
  for (const s of st.stars) {
    drawn.add(s.ref);
    const [x, y] = at(s.at),
      g = make("g", { class: "line-star", "data-star": s.ref });
    g.append(
      make("circle", {
        cx: x,
        cy: y,
        r: 4,
        class: settled.has(s.ref)
          ? "line-star-dot settled"
          : s.taken
            ? "line-star-dot taken"
            : "line-star-dot",
      }),
    );
    if (st.asked?.ref === s.ref)
      g.append(make("circle", { cx: x, cy: y, r: 10, class: "line-star-asked" }));
    if (picked === s.ref)
      g.append(make("circle", { cx: x, cy: y, r: 14, class: "line-star-picked" }));
    // (Its touch ring, a fingertip across, unseen.)
    const hit = make("circle", { cx: x, cy: y, r: HIT, class: "line-star-hit" });
    hit.addEventListener("click", () => onPick(s.ref));
    g.append(hit);
    svg.append(g);
  }
  for (const sh of st.ships)
    if (sh.arrived && !drawn.has(sh.star)) {
      drawn.add(sh.star);
      const [x, y] = at(sh.to);
      svg.append(make("circle", { cx: x, cy: y, r: 5, class: "line-star-dot settled" }));
    }
  // —— Each ship under way, over the stars (pressed: ridden), its own touch ring a fingertip across.
  for (const sh of ships) {
    const g = make("g", { class: "line-star-ship-at", "data-ship": sh.land });
    g.append(
      make("circle", { cx: sh.x, cy: sh.y, r: 9, class: "line-star-ship-ring" }),
      make("circle", { cx: sh.x, cy: sh.y, r: 4, class: "line-star-ship" }),
    );
    const hit = make("circle", { cx: sh.x, cy: sh.y, r: HIT, class: "line-star-hit" });
    hit.addEventListener("click", () => onRide(sh.land));
    g.append(hit);
    svg.append(g);
  }
  return svg;
}
