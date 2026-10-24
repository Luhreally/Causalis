// A drop under the glass (Phase 17 M131, the Observatory's smallest scale): a place's water as
// a microscope shows it, lit from the side so its lives glow on the dark. Small cells run and
// tumble after what floats; light-eaters drift up toward the light; hunting cells close on
// smaller ones and take them in; cells together turn as one. Each lives by its kind's way,
// spends as it lives and moves, and divides when it has eaten enough — its daughters a little
// unlike it, larger or smaller, quicker or slower. What the hunters take leaves fewer like it,
// so the drop's lives change as they are watched: its sizes are charted as the time passes.
// Tap a cell to follow it and its descendants.
//
// The drop's life is the view's (view/drop.ts): seeded by the place, the same drop shows the same
// lives; its steps are fixed, so a slow screen sees what a fast one does.
import type { Block, DropKind } from "../bridge/index.ts";
import {
  FIELD_H,
  FIELD_W,
  STEP,
  follow,
  followWords,
  gap,
  newDrop,
  stepDrop,
  touchDrop,
  type Cell,
  type DropState,
} from "../view/index.ts";
import { el } from "./why.ts";

type Drop = Extract<Block, { type: "drop" }>;

// —— Drawing ————————————————————————————————————————————————————————————————————————————

const BACK: Readonly<Record<Drop["habitat"], [string, string]>> = {
  sea: ["#0b3a4a", "#03121c"],
  fresh: ["#123f33", "#041611"],
  soil: ["#3a2a18", "#120b05"],
  ice: ["#28465e", "#0a1622"],
};

function css(c: readonly number[], a = 1, hue = 0, light = 1): string {
  // (A cell's colour turned a little round the wheel by its line's drift.)
  let [r, g, b] = c as [number, number, number];
  if (hue) {
    const k = (hue * Math.PI) / 180,
      cos = Math.cos(k),
      sin = Math.sin(k),
      m = [
        0.299 + 0.701 * cos + 0.168 * sin,
        0.587 - 0.587 * cos + 0.33 * sin,
        0.114 - 0.114 * cos - 0.497 * sin,
        0.299 - 0.299 * cos - 0.328 * sin,
        0.587 + 0.413 * cos + 0.035 * sin,
        0.114 - 0.114 * cos + 0.292 * sin,
        0.299 - 0.3 * cos + 1.25 * sin,
        0.587 - 0.588 * cos - 1.05 * sin,
        0.114 + 0.886 * cos - 0.203 * sin,
      ];
    [r, g, b] = [
      m[0]! * r + m[1]! * g + m[2]! * b,
      m[3]! * r + m[4]! * g + m[5]! * b,
      m[6]! * r + m[7]! * g + m[8]! * b,
    ];
  }
  const f = (v: number) => Math.round(Math.min(1, Math.max(0, v * light)) * 255);
  return `rgba(${f(r)}, ${f(g)}, ${f(b)}, ${a})`;
}

/** Draw the drop as it stands into a 2D context w × h CSS pixels. */
function paint(
  ctx: CanvasRenderingContext2D,
  s: DropState,
  w: number,
  h: number,
  chosen: number | null,
): void {
  const k = w / FIELD_W,
    [lit, dark] = BACK[s.habitat],
    back = ctx.createRadialGradient(w / 2, h * 0.42, h * 0.1, w / 2, h / 2, Math.max(w, h) * 0.62);
  back.addColorStop(0, lit);
  back.addColorStop(1, dark);
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, w, h);
  // The light from above, where it is water.
  if (s.habitat !== "soil") {
    const sun = ctx.createLinearGradient(0, 0, 0, h);
    sun.addColorStop(0, `rgba(255, 250, 200, ${0.12 * s.light})`);
    sun.addColorStop(1, "rgba(255, 250, 200, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  }
  // Motes.
  ctx.fillStyle = s.habitat === "soil" ? "rgba(214, 186, 140, 0.55)" : "rgba(210, 230, 235, 0.45)";
  for (const m of s.motes) ctx.fillRect(m.x * k - 0.6, m.y * k - 0.6, 1.3, 1.3);
  const t = s.t;
  for (const c of s.cells) {
    const kind = s.kinds[c.kind]!,
      x = c.x * k,
      y = c.y * k,
      r = Math.max(1.6, (c.size / 2) * k),
      parts = c.dividing > 0 ? 2 : 1,
      split = c.dividing > 0 ? (1 - c.dividing / 0.6) * r * 0.9 : 0;
    for (let p = 0; p < parts; p++) {
      const ox = parts > 1 ? Math.cos(c.heading + Math.PI / 2) * split * (p ? -1 : 1) : 0,
        oy = parts > 1 ? Math.sin(c.heading + Math.PI / 2) * split * (p ? -1 : 1) : 0,
        cx = x + ox,
        cy = y + oy,
        rr = parts > 1 ? r * 0.8 : r;
      switch (c.way) {
        case "eater": {
          // A rod, its whip behind it.
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(c.heading);
          ctx.strokeStyle = css(kind.color, 0.45, c.hue);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) {
            const along = -rr * 1.1 - i * rr * 0.55,
              side = Math.sin(t * 18 + i * 1.3 + c.id) * rr * 0.35;
            if (i) ctx.lineTo(along, side);
            else ctx.moveTo(along, side);
          }
          ctx.stroke();
          ctx.fillStyle = css(kind.color, 0.9, c.hue);
          ctx.beginPath();
          ctx.ellipse(0, 0, rr * 1.3, rr * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "light": {
          ctx.fillStyle = css(kind.color, 0.28, c.hue);
          ctx.beginPath();
          ctx.arc(cx, cy, rr * 1.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = css(kind.color, 0.85, c.hue);
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.fill();
          if (rr > 3) {
            ctx.fillStyle = css(kind.color, 0.9, c.hue, 0.55);
            for (let i = 0; i < 3; i++) {
              const a = c.id + i * 2.1 + t * 0.3;
              ctx.beginPath();
              ctx.arc(
                cx + Math.cos(a) * rr * 0.45,
                cy + Math.sin(a) * rr * 0.45,
                rr * 0.22,
                0,
                Math.PI * 2,
              );
              ctx.fill();
            }
          }
          break;
        }
        case "hunter": {
          // A blob that reaches and draws in; its nucleus; what it took in lately.
          ctx.beginPath();
          for (let i = 0; i <= 18; i++) {
            const a = (i / 18) * Math.PI * 2,
              q = 1 + 0.09 * Math.sin(a * 3 + t * 1.7 + c.id) + 0.06 * Math.sin(a * 5 - t * 2.3);
            const px = cx + Math.cos(a) * rr * q,
              py = cy + Math.sin(a) * rr * q;
            if (i) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.fillStyle = css(kind.color, 0.22, c.hue);
          ctx.fill();
          ctx.strokeStyle = css(kind.color, 0.85, c.hue);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = css(kind.color, 0.6, c.hue, 0.7);
          ctx.beginPath();
          ctx.arc(cx + rr * 0.2, cy - rr * 0.15, rr * 0.28, 0, Math.PI * 2);
          ctx.fill();
          c.meals.forEach((m, i) => {
            const a = i * 2.4 + c.id;
            ctx.fillStyle = css(s.kinds[m.color]!.color, 0.75 * (1 - m.age / 8));
            ctx.beginPath();
            ctx.arc(
              cx + Math.cos(a) * rr * 0.5,
              cy + Math.sin(a) * rr * 0.5,
              Math.max(1, rr * 0.1 * (1 - m.age / 8)),
              0,
              Math.PI * 2,
            );
            ctx.fill();
          });
          break;
        }
        case "colony": {
          // A clear ball, its cells about its rim, turning.
          ctx.fillStyle = css(kind.color, 0.1, c.hue);
          ctx.strokeStyle = css(kind.color, 0.5, c.hue);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = css(kind.color, 0.9, c.hue);
          const n = 12;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + t * 0.4 + c.id;
            ctx.beginPath();
            ctx.arc(
              cx + Math.cos(a) * rr * 0.8,
              cy + Math.sin(a) * rr * 0.8,
              Math.max(1, rr * 0.11),
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          for (let i = 0; i < 3; i++) {
            const a = i * 2.1 + t * 0.2 + c.id;
            ctx.fillStyle = css(kind.color, 0.7, c.hue, 0.8);
            ctx.beginPath();
            ctx.arc(
              cx + Math.cos(a) * rr * 0.32,
              cy + Math.sin(a) * rr * 0.32,
              Math.max(1.2, rr * 0.16),
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          break;
        }
      }
    }
    if (c.marked || c.id === chosen) {
      ctx.strokeStyle = c.id === chosen ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = c.id === chosen ? 1.5 : 1;
      ctx.setLineDash(c.id === chosen ? [3, 2] : []);
      ctx.beginPath();
      ctx.arc(x, y, r * 1.5 + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // The glass: its round edge dark, a measure at its foot.
  const edge = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.42,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.66,
  );
  edge.addColorStop(0, "rgba(0, 0, 0, 0)");
  edge.addColorStop(1, "rgba(0, 0, 0, 0.85)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
  const bar = 20 * k;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, h - 12);
  ctx.lineTo(10 + bar, h - 12);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("20 µm", 10, h - 16);
}

/** Minutes and seconds: "1:05". */
function clock(t: number): string {
  const m = Math.floor(t / 60),
    s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The mean sizes through the time watched, a line a kind, against where each began. */
function chart(svg: SVGSVGElement, s: DropState): void {
  const NS = "http://www.w3.org/2000/svg",
    W = 300,
    H = 54,
    h = s.history;
  svg.replaceChildren();
  if (h.length < 2) return;
  const t0 = h[0]!.t,
    t1 = h.at(-1)!.t;
  s.kinds.forEach((k, i) => {
    const pts = h.filter((x) => x.count[i]! > 0);
    if (pts.length < 2) return;
    // (Each kind's size as a share of what it began at: 1 is where it began.)
    const y = (v: number) => H / 2 - (v / k.size - 1) * H * 0.9,
      d = pts
        .map(
          (p, j) =>
            `${j ? "L" : "M"}${(((p.t - t0) / Math.max(1e-6, t1 - t0)) * W).toFixed(1)} ${Math.min(H, Math.max(0, y(p.size[i]!))).toFixed(1)}`,
        )
        .join(" "),
      path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "drop-line");
    path.style.stroke = css(k.color);
    svg.append(path);
  });
  const mid = document.createElementNS(NS, "line");
  mid.setAttribute("x1", "0");
  mid.setAttribute("x2", String(W));
  mid.setAttribute("y1", String(H / 2));
  mid.setAttribute("y2", String(H / 2));
  mid.setAttribute("class", "drop-mid");
  svg.prepend(mid);
}

/** The drop under the glass: its view, its kinds counted, its sizes charted, its buttons. */
export function dropView(
  b: Drop,
  options: { readonly label: (k: DropKind) => HTMLElement },
): HTMLElement {
  const box = el("div", "drop"),
    canvas = el("canvas", "drop-glass"),
    legend = el("div", "drop-legend"),
    bar = el("div", "drop-bar"),
    read = el("p", "drop-read muted"),
    card = el("p", "drop-card"),
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    figure = el("figure", "drop-chart"),
    caption = el(
      "figcaption",
      "muted",
      "Their sizes as you watch (the middle line: what each began at)",
    );
  svg.setAttribute("viewBox", "0 0 300 54");
  svg.setAttribute("preserveAspectRatio", "none");
  figure.append(caption, svg);
  let s = newDrop(b),
    chosen: number | null = null,
    running = false,
    paused = false,
    fast = 1,
    last = 0,
    owed = 0,
    frame = 0,
    shownAt = -1,
    width = 0;
  const counts = b.kinds.map((k) => {
    const row = el("span", "drop-kind"),
      dot = el("span", "drop-dot"),
      n = el("span", "drop-count", "0");
    dot.style.background = css(k.color);
    row.append(dot, options.label(k), n);
    row.title = `${k.name}: of the line of ${k.line}`;
    legend.append(row);
    return n;
  });
  const button = (text: string, title: string, act: (b: HTMLButtonElement) => void) => {
    const x = el("button", "drop-button", text);
    x.type = "button";
    x.title = title;
    x.setAttribute("aria-label", title);
    x.onclick = () => act(x);
    bar.append(x);
    return x;
  };
  button("⏸", "Pause", (x) => {
    paused = !paused;
    x.textContent = paused ? "▶" : "⏸";
    x.title = paused ? "Go on" : "Pause";
  });
  button("⏩", "Faster", (x) => {
    fast = fast === 1 ? 5 : 1;
    x.classList.toggle("on", fast > 1);
  });
  button("☀️", "Shade it", (x) => {
    const shaded = x.textContent === "☁️";
    s.light = shaded ? b.light : b.light * 0.25;
    x.textContent = shaded ? "☀️" : "☁️";
    x.title = shaded ? "Shade it" : "Light it";
  });
  button("🥄", "Stir it", () => touchDrop(s, "stir", b));
  button("✚", "Feed it", () => touchDrop(s, "feed", b));
  button("↺", "A fresh drop", () => {
    s = newDrop(b);
    chosen = null;
    card.textContent = "";
  });
  /** What the followed cell is, in words. */
  const tell = () => {
    if (chosen !== null) card.textContent = followWords(s, chosen);
  };
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * FIELD_W,
      y = ((e.clientY - r.top) / r.height) * FIELD_H;
    let best: Cell | null = null,
      bd = Infinity;
    for (const c of s.cells) {
      const dx = gap(x, c.x, FIELD_W),
        dy = gap(y, c.y, FIELD_H),
        d = Math.hypot(dx, dy) - c.size / 2;
      if (d < bd) [best, bd] = [c, d];
    }
    chosen = best && bd < 8 ? best.id : null;
    follow(s, chosen);
    if (chosen !== null) {
      tell();
    } else {
      chosen = null;
      card.textContent = "";
    }
  });
  const size = () => {
    // (Within its box, its border of a pixel each side and all.)
    const w = Math.max(240, Math.round((box.clientWidth || 320) - 2)),
      h = Math.round((w * FIELD_H) / FIELD_W),
      dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    if (w === width) return;
    width = w;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  };
  const draw = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !width) return;
    const dpr = canvas.width / width;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, s, width, canvas.height / dpr, chosen);
  };
  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused) {
      owed += dt * fast;
      let steps = 0;
      while (owed >= STEP && steps < 12) {
        stepDrop(s);
        owed -= STEP;
        steps++;
      }
      if (steps === 12) owed = 0;
    }
    draw();
    // (Its numbers, twice a second.)
    if (++frame % 15 === 0 || shownAt < 0) {
      shownAt = s.t;
      const n = b.kinds.map(() => 0);
      for (const c of s.cells) n[c.kind]!++;
      counts.forEach((x, i) => (x.textContent = String(n[i])));
      const gen = s.cells.reduce((a, c) => Math.max(a, c.generation), 0);
      read.textContent = `${clock(s.t)} watched · ${s.born.toLocaleString("en-US")} born · ${s.died.toLocaleString("en-US")} starved · ${s.eaten.toLocaleString("en-US")} taken in · ${gen} generations`;
      chart(svg, s);
      tell();
    }
    requestAnimationFrame(loop);
  };
  // It runs while it is seen, and rests when it is not (scrolled away, its tab left).
  const seen = new IntersectionObserver((entries) => {
    const on = entries.some((x) => x.isIntersecting);
    if (on && !running) {
      running = true;
      size();
      last = performance.now();
      requestAnimationFrame(loop);
    } else if (!on) running = false;
  });
  seen.observe(canvas);
  new ResizeObserver(() => {
    size();
    if (!running) draw();
  }).observe(box);
  box.append(canvas, bar, legend, read, card, figure);
  if (b.words) box.append(el("p", "muted drop-words", b.words));
  return box;
}
