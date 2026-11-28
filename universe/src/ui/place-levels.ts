// The town's ground level by level, in the town mode's inspector (R8): one level at a time, stepped up and down as
// Dwarf Fortress's are, drawn from above under the town (its homes ghosted where they stand over it, its square at the
// middle): its graves and wells at their lots, its workings at the town's mine with their galleries as far as they are
// dug at that level; and under the drawing, what is dug there, each with where the eye can go for it.
import type { PlaceInspectLevels, VillagePlan } from "../bridge/index.ts";
import { el } from "./why.ts";
import { captioned } from "./place-hud.ts";

const SVG = "http://www.w3.org/2000/svg";
const W = 320,
  H = 200;
/** A level's stuff by what it is (the soil, the water, rock), its fill. */
const FILL = ["#5d4630", "#2f4f63", "#6e6558", "#7f7466", "#8a7d6b", "#5f5850"] as const;

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

export type LevelGo = { id: null; lot: number | null; at?: { x: number; z: number } };

/** One level of the town's ground, drawn from above and told; its stepper above it. */
export function levelsEl(
  x: PlaceInspectLevels,
  k: number,
  plan: VillagePlan | null,
  lotAt: (lot: number) => { x: number; z: number } | null,
  onLevel: (k: number) => void,
  onGo: (g: LevelGo) => void,
): HTMLElement[] {
  const n = Math.max(0, Math.min(x.levels.length - 1, k)),
    level = x.levels[n]!,
    step = el("div", "place-levels-step"),
    up = captioned(el("button", "place-levels-up"), "▲", "Up"),
    down = captioned(el("button", "place-levels-down"), "▼", "Down"),
    label = el("span", "place-levels-label", `${n + 1} of ${x.levels.length} · ${level.name}`);
  up.disabled = n === 0;
  down.disabled = n === x.levels.length - 1;
  up.setAttribute("aria-label", "The level above");
  down.setAttribute("aria-label", "The level below");
  up.onclick = () => onLevel(n - 1);
  down.onclick = () => onLevel(n + 1);
  step.append(up, label, down);
  // (From above: what stands over it ghosted, the town's square at the middle, fitted to what is drawn.)
  const mine = plan?.works?.mine ?? null,
    pts: { x: number; z: number }[] = [
      { x: 0, z: 0 },
      ...(plan?.homes ?? []).map((h) => ({ x: h.x, z: h.z })),
    ];
  if (mine) pts.push(mine);
  const places = level.dug
    .map((d) => (d.works ? mine : d.lot !== null ? lotAt(d.lot) : null))
    .filter((p): p is { x: number; z: number } => !!p);
  pts.push(...places);
  const reach = Math.max(20, ...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.z)))) * 1.1,
    s = Math.min(W, H) / 2 / reach,
    px = (p: { x: number; z: number }) => ({ x: W / 2 + p.x * s, y: H / 2 + p.z * s });
  const cut = svg("svg", {
    class: "place-inside-plan place-levels-plan",
    viewBox: `0 0 ${W} ${H}`,
    width: W,
    height: H,
    role: "img",
    "aria-label": `${level.name}, under the town from above: ${level.stuff}; ${level.dug.length} dug here`,
  });
  cut.append(
    svg("rect", { x: 0, y: 0, width: W, height: H, fill: FILL[Math.min(n, FILL.length - 1)]! }),
  );
  if (!level.reached)
    cut.append(svg("rect", { class: "place-levels-unreached", x: 0, y: 0, width: W, height: H }));
  for (const h of plan?.homes ?? []) {
    const p = px(h);
    cut.append(
      svg("rect", { class: "place-levels-ghost", x: p.x - 2, y: p.y - 2, width: 4, height: 4 }),
    );
  }
  const sq = px({ x: 0, z: 0 });
  cut.append(svg("circle", { class: "place-levels-ghost", cx: sq.x, cy: sq.y, r: 5 }));
  // (What is dug at this level, at its place: the workings with their galleries, wells and graves at their lots.)
  for (const d of level.dug) {
    const at = d.works ? mine : d.lot !== null ? lotAt(d.lot) : null;
    if (!at) continue;
    const p = px(at);
    if (d.works) {
      const long = d.state === "digging" ? 14 : 26;
      for (let a = 0; a < 4; a++) {
        const r = (a * Math.PI) / 2 + 0.4;
        cut.append(
          svg("line", {
            class: `place-levels-gallery ${d.state}`,
            x1: p.x,
            y1: p.y,
            x2: p.x + long * Math.cos(r),
            y2: p.y + long * Math.sin(r),
          }),
        );
      }
    }
    cut.append(
      svg("text", { x: p.x, y: p.y + 5, "text-anchor": "middle", "font-size": 14 }, d.icon),
    );
  }
  const box = el("div", "place-inside");
  box.append(cut);
  const out: HTMLElement[] = [step, box];
  out.push(
    el(
      "p",
      "place-insp-why",
      `${level.depth}: ${level.stuff}.${level.reached ? "" : " Deeper than its land's means reach."}`,
    ),
  );
  if (level.dug.length) {
    const list = el("div", "place-levels-dug");
    for (const d of level.dug) {
      const row = el("div", "place-levels-row");
      row.append(el("span", "place-levels-icon", d.icon), el("span", "place-insp-fact", d.words));
      const at = d.works ? mine : null;
      if (d.lot !== null || at) {
        const go = captioned(el("button", "place-insp-go"), "📍", "Go to");
        go.title = d.works ? "Go to its workings" : "Go there";
        go.setAttribute("aria-label", go.title);
        go.onclick = () => onGo(at ? { id: null, lot: null, at } : { id: null, lot: d.lot });
        row.append(go);
      }
      list.append(row);
    }
    out.push(list);
  } else out.push(el("p", "place-insp-why", "Nothing is dug at this level."));
  out.push(el("p", "place-insp-why", x.words));
  return out;
}
