// A town's fields and its flock, in the town mode's inspector (O6): its fields as its plan lays them, each its crop as it
// stands at the place's hour (as its land's map and its 3D draw it: view/fields.ts fieldLook), its pasture and its flock,
// how many are out on each; under it the year in them, its crops by how they stand, its flock and what is after it, and
// who is out in them now, a fingertip each. The town's square is the plan's mark; its fields lie about it.
import type { PlaceInspectFields, VillagePlan } from "../bridge/index.ts";
import {
  cropsOf,
  fieldLook,
  fieldsNow,
  fieldsWords,
  grownAt,
  mannerOf,
  reapedAt,
  SOWING,
} from "../view/index.ts";
import { el } from "./why.ts";

const SVG = "http://www.w3.org/2000/svg";
/** The plan's widest and tallest (CSS pixels), as a room's inside. */
const PLAN_W = 320,
  PLAN_H = 300;
/** How far a tap on the plan reaches for a field (CSS pixels: half a fingertip); the least a field is drawn to bear a count. */
const TAP_REACH = 22,
  COUNTED = 16;
const YEAR = 365 * 86_400;

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
const rgb = (c: readonly [number, number, number]): string =>
  `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)).join(",")})`;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
type Field = VillagePlan["fields"][number];
/** A point of a field by its own ways, u across its width and v along its depth (−½ … ½), as view/country.ts lays it. */
const fieldAt = (f: Field, u: number, v: number): { x: number; z: number } => {
  const c = Math.cos(f.yaw),
    s = Math.sin(f.yaw),
    a = u * f.w,
    b = v * f.d;
  return { x: f.x + c * a + s * b, z: f.z - s * a + c * b };
};

/** How a field of a plan stands at t, in words: its crop and where in its year it is. */
export function fieldStands(plan: VillagePlan, k: number, t: number): string {
  const { orchard, crop } = cropsOf(plan),
    c = crop[k],
    d = (((t % YEAR) + YEAR) % YEAR) / YEAR;
  if (orchard[k]) return "an orchard";
  if (!c) return "bare ground";
  if (!mannerOf(plan)) return `foraging ground, ${c}`;
  if (c === "fallow") return "fallow, its grass grazed";
  const grown = grownAt(c, d);
  if (c === "greens")
    return grown <= 0
      ? d >= 0.5
        ? "greens lifted: bare"
        : "greens, not yet up"
      : grown < 1
        ? "greens, growing"
        : "greens, grown";
  const reaped = reapedAt(plan, k, t);
  if (reaped >= 1)
    return grown <= 0
      ? "grain, its stubble turned in: bare till the sowing"
      : "grain, reaped: stubble";
  if (reaped > 0) return `grain, being reaped (${Math.round(reaped * 100)}%)`;
  if (grown <= 0)
    return d > 0.5 || d < SOWING[0]
      ? "grain, bare till the sowing"
      : d < SOWING[1]
        ? "grain, being sown"
        : "grain, sown, not yet up";
  if (grown < 1) return "grain, growing";
  return d >= 0.6 ? "grain, ripe" : "grain, grown green";
}

/** A town's fields drawn and told: its plan, then the year, its crops, its flock and who is out in them, each a key. */
export function fieldsEl(
  x: PlaceInspectFields,
  plan: VillagePlan | null,
  onInspect: (ref: string) => void,
): HTMLElement[] {
  const out: HTMLElement[] = [],
    fields = plan?.fields ?? [];
  if (plan && fields.length) {
    const year = fieldsNow(plan, x.t),
      corners = fields.map((f) => [
        fieldAt(f, -0.5, -0.5),
        fieldAt(f, 0.5, -0.5),
        fieldAt(f, 0.5, 0.5),
        fieldAt(f, -0.5, 0.5),
      ]),
      pa = plan.pasture,
      xs = [0, ...corners.flat().map((q) => q.x), pa.x - pa.r, pa.x + pa.r],
      zs = [0, ...corners.flat().map((q) => q.z), pa.z - pa.r, pa.z + pa.r],
      x0 = Math.min(...xs),
      z0 = Math.min(...zs),
      W = Math.max(1, Math.max(...xs) - x0),
      D = Math.max(1, Math.max(...zs) - z0),
      s = Math.min(PLAN_W / W, PLAN_H / D),
      at = (q: { x: number; z: number }) => [(q.x - x0) * s, (q.z - z0) * s] as const,
      box = svg("svg", {
        class: "place-inside-plan place-fields-plan",
        viewBox: `0 0 ${W * s} ${D * s}`,
        width: W * s,
        height: D * s,
        role: "img",
        "aria-label": `The plan of the town's ${fields.length} fields and its pasture`,
      });
    // (Each field in its crop's colour at the hour; its pasture; the square marked.)
    corners.forEach((c, k) => {
      box.append(
        svg("polygon", {
          class: "place-fields-field",
          points: c.map((q) => at(q).join(",")).join(" "),
          fill: rgb(fieldLook(plan, k, x.t, year, fields[k]!)),
        }),
      );
    });
    const [px, pz] = at(pa),
      [sx, sz] = at({ x: 0, z: 0 });
    box.append(
      svg("circle", { class: "place-fields-pasture", cx: px, cy: pz, r: pa.r * s }),
      svg("rect", { class: "place-fields-square", x: sx - 5, y: sz - 5, width: 10, height: 10 }),
    );
    // (How many are on each field big enough on the plan to bear its count, and with the flock.)
    const centre = fields.map((f) => at(f));
    centre.forEach(([cx, cz], k) => {
      const n = x.onField[k] ?? 0,
        f = fields[k]!;
      if (n > 0 && Math.min(f.w, f.d) * s >= COUNTED)
        box.append(
          svg(
            "text",
            {
              class: "place-fields-count",
              x: cx,
              y: cz,
              "text-anchor": "middle",
              "dominant-baseline": "central",
            },
            String(n),
          ),
        );
    });
    const flock = plan.fauna?.flock;
    box.append(
      svg(
        "text",
        {
          class: "place-fields-count",
          x: px,
          y: pz,
          "text-anchor": "middle",
          "dominant-baseline": "central",
        },
        `${flock ? (flock.wool ? "🐑" : "🐄") : "🌿"}${x.atPasture ? ` ${x.atPasture}` : ""}`,
      ),
    );
    // (A tap on the plan: the field under it, else the nearest within half a fingertip, told under the plan.)
    const picked = el(
      "p",
      "place-insp-why place-fields-picked",
      "Tap a field to see how it stands.",
    );
    box.addEventListener("click", (e) => {
      const r = box.getBoundingClientRect(),
        k = r.width / (W * s),
        qx = (e.clientX - r.left) / k,
        qz = (e.clientY - r.top) / k,
        // (Where the tap is in the land's metres, and in a field's own frame: across its width, along its depth.)
        mx = qx / s + x0,
        mz = qz / s + z0,
        within = (j: number) => {
          const f = fields[j]!,
            dx = mx - f.x,
            dz = mz - f.z,
            c = Math.cos(f.yaw),
            sn = Math.sin(f.yaw),
            a = c * dx - sn * dz,
            b = sn * dx + c * dz;
          return Math.abs(a) <= f.w / 2 && Math.abs(b) <= f.d / 2;
        };
      let best = fields.findIndex((_, j) => within(j));
      if (best < 0) {
        let near = (TAP_REACH / k) ** 2;
        centre.forEach(([cx, cz], j) => {
          const d2 = (cx - qx) ** 2 + (cz - qz) ** 2;
          if (d2 < near) {
            near = d2;
            best = j;
          }
        });
      }
      if (best < 0) return;
      const n = x.onField[best] ?? 0,
        f = fields[best]!;
      picked.textContent = `Field ${best + 1}: ${fieldStands(plan, best, x.t)}; ${Math.round(f.w)} by ${Math.round(f.d)} metres; ${n ? `${n} at work on it now` : "none on it now"}.`;
    });
    const wrap = el("div", "place-inside");
    wrap.append(box);
    out.push(wrap, picked);
    // The year in them, and its crops by how they stand.
    out.push(
      el(
        "p",
        "place-insp-why",
        fieldsWords(plan, x.t) ?? "A fair year in the fields: nothing to tell of it.",
      ),
    );
    const stands = new Map<string, number>();
    fields.forEach((_, k) => {
      const w = fieldStands(plan, k, x.t).replace(/ \(\d+%\)$/, "");
      stands.set(w, (stands.get(w) ?? 0) + 1);
    });
    out.push(
      el("p", "place-insp-label", `Its ${fields.length} fields`),
      el(
        "p",
        "place-insp-why",
        [...stands]
          .sort((a, b) => b[1] - a[1])
          .map(([w, n]) => `${n} ${w}`)
          .join(" · "),
      ),
    );
  } else out.push(el("p", "place-insp-why", "Its plan lays no fields to show."));
  // Its flock, and what is after it; the wild about it.
  const fauna = plan?.fauna;
  if (fauna?.flock) {
    const f = fauna.flock,
      h = x.working.herders;
    out.push(
      el("p", "place-insp-label", "Its flock"),
      el(
        "p",
        "place-insp-why",
        `${cap(f.name)}, kept by ${h} ${h === 1 ? "herder" : "herders"}${x.atPasture ? `, ${x.atPasture} out with it now` : ", none out with it now"}${f.gone?.length ? `; ${f.gone.length} lost this year past` : ""}${fauna.raided ? "; raided by the wild this year" : ""}.`,
      ),
    );
  }
  if (fauna?.after) {
    const a = fauna.after,
      b = el(
        "button",
        "place-insp-person place-inside-key",
        `${a.known ? "🐾" : "⚠️"} ${cap(a.name)}${a.known ? `, a ${a.kind}` : ""}: after the town's beasts`,
      );
    b.onclick = () => onInspect(a.ref);
    out.push(b);
  }
  if (fauna?.wild.length)
    out.push(
      el(
        "p",
        "place-insp-why",
        `In the wild about it: ${[...fauna.wild]
          .sort((a, b) => b.stock - a.stock)
          .slice(0, 5)
          .map((w) => w.name)
          .join(", ")}.`,
      ),
    );
  // Who is out in them now: a fingertip each.
  out.push(
    el(
      "p",
      "place-insp-why",
      `${x.working.farmers} farm them, ${x.working.herders} herd, ${x.working.foragers} forage or hunt.`,
    ),
  );
  if (x.people.length) {
    const list = el("div", "place-insp-people");
    for (const q of x.people) {
      const b = el("button", "place-insp-person");
      b.append(
        el("span", "place-row-name", q.name),
        el(
          "span",
          "place-row-what",
          `${q.field < 0 ? "With the flock" : `Field ${q.field + 1}`}: ${q.words}`,
        ),
      );
      b.onclick = () => onInspect(q.ref);
      list.append(b);
    }
    out.push(el("p", "place-insp-label", `Out in them now (${x.people.length + x.more})`), list);
    if (x.more) out.push(el("p", "place-insp-why", `And ${x.more} more.`));
  } else out.push(el("p", "place-insp-why", "No one is out in them now."));
  return out;
}
