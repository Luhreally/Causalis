// Inside a building, in the town mode's inspector (O3): its plan on its grid of tiles, drawn to fit the inspector's
// width (its rooms walled, what stands in them by its sign, those here now as rings a tap opens), and under it, at a
// fingertip each, who is here and what stands here, with what each is. The street's side is at the top.
import type { PlaceInspectInside } from "../bridge/index.ts";
import { el } from "./why.ts";

const SVG = "http://www.w3.org/2000/svg";
/** The plan's widest and tallest (CSS pixels): it fits the inspector, docked or a phone's sheet. */
const PLAN_W = 320,
  PLAN_H = 300;
/** How far a tap on the plan reaches for one of those drawn on it (CSS pixels: half a fingertip). */
const TAP_REACH = 22;

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

/** Inside a lot, drawn: its plan, then who is here and what stands here, each a key. */
export function insideEl(x: PlaceInspectInside, onInspect: (ref: string) => void): HTMLElement[] {
  const s = Math.max(8, Math.min(PLAN_W / x.w, PLAN_H / x.d)),
    plan = svg("svg", {
      class: "place-inside-plan",
      viewBox: `0 0 ${x.w * s} ${x.d * s}`,
      width: x.w * s,
      height: x.d * s,
      role: "img",
      "aria-label": `The plan of ${x.name}: ${x.rooms.length} ${x.rooms.length === 1 ? "room" : "rooms"}, ${x.things.length} things, ${x.people.length} here now`,
    });
  // (Its tiles, faintly; its rooms walled and named.)
  for (let i = 1; i < x.w; i++)
    plan.append(
      svg("line", { class: "place-inside-tile", x1: i * s, y1: 0, x2: i * s, y2: x.d * s }),
    );
  for (let j = 1; j < x.d; j++)
    plan.append(
      svg("line", { class: "place-inside-tile", x1: 0, y1: j * s, x2: x.w * s, y2: j * s }),
    );
  for (const r of x.rooms) {
    plan.append(
      svg("rect", {
        class: "place-inside-room",
        x: r.x * s + 1,
        y: r.y * s + 1,
        width: r.w * s - 2,
        height: r.d * s - 2,
      }),
    );
  }
  const glyph = Math.max(10, Math.min(22, s * 0.8));
  for (const t of x.things) {
    plan.append(
      svg("rect", {
        class: `place-inside-thing place-inside-${t.kind}`,
        x: t.x * s + 2,
        y: t.y * s + 2,
        width: t.w * s - 4,
        height: t.d * s - 4,
        rx: 3,
      }),
      svg(
        "text",
        {
          x: (t.x + t.w / 2) * s,
          y: (t.y + t.d / 2) * s,
          "font-size": glyph,
          "text-anchor": "middle",
          "dominant-baseline": "central",
        },
        t.glyph,
      ),
    );
  }
  for (const q of x.people)
    plan.append(
      svg("circle", {
        class: "place-inside-person",
        cx: (q.x + 0.5) * s,
        cy: (q.y + 0.5) * s,
        r: Math.max(4, s * 0.32),
      }),
    );
  // (A tap on the plan opens the one drawn nearest it, within half a fingertip.)
  plan.addEventListener("click", (e) => {
    const box = plan.getBoundingClientRect(),
      k = box.width / (x.w * s),
      px = (e.clientX - box.left) / k,
      py = (e.clientY - box.top) / k;
    let best: string | null = null,
      near = (TAP_REACH / k) ** 2;
    for (const q of x.people) {
      const dx = (q.x + 0.5) * s - px,
        dy = (q.y + 0.5) * s - py;
      if (dx * dx + dy * dy < near) {
        near = dx * dx + dy * dy;
        best = q.ref;
      }
    }
    if (best) onInspect(best);
  });
  const box = el("div", "place-inside");
  box.append(plan);
  const out: HTMLElement[] = [box];
  // (Each room read, O4.)
  for (const r of x.rooms)
    if (r.words) out.push(el("p", "place-insp-why", `${r.name}: ${r.words}`));
  out.push(el("p", "place-insp-why", x.words));
  // Who is here now, and what stands here: a fingertip each.
  if (x.people.length) {
    const list = el("div", "place-insp-people");
    for (const q of x.people) {
      const b = el("button", "place-insp-person");
      b.append(el("span", "place-row-name", q.name), el("span", "place-row-what", q.words));
      b.onclick = () => onInspect(q.ref);
      list.append(b);
    }
    out.push(el("p", "place-insp-label", `Here now (${x.people.length})`), list);
  } else out.push(el("p", "place-insp-why", "No one is here now."));
  if (x.things.length) {
    const list = el("div", "place-inside-things");
    for (const t of x.things)
      list.append(
        el("p", "place-inside-row", `${t.glyph} ${t.name}${t.words ? `: ${t.words}` : ""}`),
      );
    out.push(el("p", "place-insp-label", "What stands here"), list);
  }
  return out;
}
