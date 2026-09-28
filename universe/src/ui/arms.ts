// Heraldry drawn (Phase 11 M102): a realm's arms on a heater shield, glossy as the era drew
// them — its field parted, its charge in the middle, a dark rim, a shine across the top. The
// arms are asked of the host once for each realm and kept; a shield asked for before they
// come is drawn as they come.
import type { Arms, Charge, HostClient } from "../bridge/index.ts";

type Rgb = readonly [number, number, number];

const css = (c: Rgb) =>
  `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
const RIM = "rgba(10,14,30,0.9)";

/** The shield's outline in a w×h box at (x, y): a flat top, straight sides, a point below. */
function shieldPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  g.lineTo(x + w, y + h * 0.45);
  g.quadraticCurveTo(x + w, y + h * 0.84, x + w / 2, y + h);
  g.quadraticCurveTo(x, y + h * 0.84, x, y + h * 0.45);
  g.closePath();
}

/** A realm's arms drawn in the w×h box at (x, y). */
export function drawArms(
  g: CanvasRenderingContext2D,
  a: Arms,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  g.save();
  shieldPath(g, x, y, w, h);
  g.clip();
  // The field, parted.
  g.fillStyle = css(a.field[0]);
  g.fillRect(x, y, w, h);
  g.fillStyle = css(a.field[1]);
  g.beginPath();
  const band = (x0: number, y0: number, x1: number, y1: number, width: number) => {
    const dx = x1 - x0,
      dy = y1 - y0,
      l = Math.hypot(dx, dy) || 1,
      nx = (-dy / l) * (width / 2),
      ny = (dx / l) * (width / 2);
    g.moveTo(x0 + nx, y0 + ny);
    g.lineTo(x1 + nx, y1 + ny);
    g.lineTo(x1 - nx, y1 - ny);
    g.lineTo(x0 - nx, y0 - ny);
    g.closePath();
  };
  switch (a.division) {
    case "pale":
      g.rect(x + w / 2, y, w / 2, h);
      break;
    case "fess":
      g.rect(x, y + h / 2, w, h / 2);
      break;
    case "quarterly":
      g.rect(x + w / 2, y, w / 2, h / 2);
      g.rect(x, y + h / 2, w / 2, h / 2);
      break;
    case "bend":
      band(x, y, x + w, y + h, w * 0.34);
      break;
    case "chief":
      g.rect(x, y, w, h * 0.3);
      break;
    case "chevron":
      g.moveTo(x, y + h * 0.78);
      g.lineTo(x + w / 2, y + h * 0.36);
      g.lineTo(x + w, y + h * 0.78);
      g.lineTo(x + w, y + h);
      g.lineTo(x + w / 2, y + h * 0.58);
      g.lineTo(x, y + h);
      g.closePath();
      break;
    case "saltire":
      band(x, y, x + w, y + h, w * 0.24);
      band(x + w, y, x, y + h, w * 0.24);
      break;
    case "plain":
      break;
  }
  g.fill("nonzero");
  // The charge, a little above the middle (a shield's heart).
  drawCharge(g, a.charge, x + w / 2, y + h * 0.45, Math.min(w, h) * 0.27, a.tincture);
  // The shine: light across the top left, fading.
  const shine = g.createLinearGradient(x, y, x + w * 0.7, y + h * 0.7);
  shine.addColorStop(0, "rgba(255,255,255,0.55)");
  shine.addColorStop(0.42, "rgba(255,255,255,0.1)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = shine;
  g.fillRect(x, y, w, h);
  g.restore();
  shieldPath(g, x, y, w, h);
  g.lineWidth = Math.max(1, w * 0.07);
  g.strokeStyle = RIM;
  g.stroke();
}

/** A charge of radius r about (cx, cy), in its tincture with a dark edge. */
function drawCharge(
  g: CanvasRenderingContext2D,
  charge: Charge,
  cx: number,
  cy: number,
  r: number,
  tincture: Rgb,
): void {
  g.fillStyle = css(tincture);
  g.strokeStyle = RIM;
  g.lineWidth = Math.max(0.8, r * 0.11);
  g.lineJoin = "round";
  g.beginPath();
  switch (charge) {
    case "star":
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          k = i % 2 ? r * 0.42 : r;
        if (i) g.lineTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
        else g.moveTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
      }
      g.closePath();
      break;
    case "sun":
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12,
          k = i % 2 ? r * 0.62 : r;
        if (i) g.lineTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
        else g.moveTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
      }
      g.closePath();
      break;
    case "moon":
      g.arc(cx, cy, r * 0.8, 0.35 * Math.PI, 1.65 * Math.PI, false);
      g.arc(cx + r * 0.38, cy, r * 0.62, 1.52 * Math.PI, 0.48 * Math.PI, true);
      g.closePath();
      break;
    case "tower": {
      const w = r * 1.1,
        top = cy - r * 0.8,
        bottom = cy + r * 0.9;
      g.moveTo(cx - w / 2, bottom);
      g.lineTo(cx - w / 2, top);
      // Three merlons.
      for (let i = 0; i < 3; i++) {
        const x0 = cx - w / 2 + (i * w) / 2.5;
        g.lineTo(x0, top - r * 0.28);
        g.lineTo(x0 + w / 5, top - r * 0.28);
        g.lineTo(x0 + w / 5, top);
        if (i < 2) g.lineTo(x0 + w / 2.5, top);
      }
      g.lineTo(cx + w / 2, top - r * 0.28);
      g.lineTo(cx + w / 2, bottom);
      g.closePath();
      break;
    }
    case "crown": {
      const w = r * 1.6,
        base = cy + r * 0.45;
      g.moveTo(cx - w / 2, base);
      g.lineTo(cx - w / 2, cy - r * 0.5);
      g.lineTo(cx - w / 4, cy);
      g.lineTo(cx, cy - r * 0.75);
      g.lineTo(cx + w / 4, cy);
      g.lineTo(cx + w / 2, cy - r * 0.5);
      g.lineTo(cx + w / 2, base);
      g.closePath();
      break;
    }
    case "tree":
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r * 0.75, cy + r * 0.35);
      g.lineTo(cx + r * 0.14, cy + r * 0.35);
      g.lineTo(cx + r * 0.14, cy + r * 0.95);
      g.lineTo(cx - r * 0.14, cy + r * 0.95);
      g.lineTo(cx - r * 0.14, cy + r * 0.35);
      g.lineTo(cx - r * 0.75, cy + r * 0.35);
      g.closePath();
      break;
    case "mountain":
      g.moveTo(cx - r, cy + r * 0.75);
      g.lineTo(cx - r * 0.3, cy - r * 0.55);
      g.lineTo(cx, cy - r * 0.05);
      g.lineTo(cx + r * 0.35, cy - r * 0.8);
      g.lineTo(cx + r, cy + r * 0.75);
      g.closePath();
      break;
    case "waves":
      for (let row = 0; row < 3; row++) {
        const y0 = cy - r * 0.55 + row * r * 0.55;
        g.moveTo(cx - r, y0);
        for (let i = 1; i <= 8; i++)
          g.lineTo(cx - r + (i * r) / 4, y0 + (i % 2 ? -r * 0.18 : r * 0.18));
        g.lineTo(cx + r, y0 + r * 0.2);
        for (let i = 7; i >= 0; i--)
          g.lineTo(cx - r + (i * r) / 4, y0 + r * 0.2 + (i % 2 ? -r * 0.18 : r * 0.18));
        g.closePath();
      }
      break;
    case "ring":
      g.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
      g.moveTo(cx + r * 0.45, cy);
      g.arc(cx, cy, r * 0.45, 0, Math.PI * 2, true);
      break;
    case "flame":
      // A flame: a tongue of fire, its tip leaning.
      g.moveTo(cx, cy + r);
      g.bezierCurveTo(
        cx - r * 0.95,
        cy + r * 0.6,
        cx - r * 0.55,
        cy - r * 0.2,
        cx + r * 0.05,
        cy - r,
      );
      g.bezierCurveTo(
        cx + r * 0.1,
        cy - r * 0.35,
        cx + r * 0.85,
        cy - r * 0.1,
        cx + r * 0.6,
        cy + r * 0.55,
      );
      g.bezierCurveTo(cx + r * 0.45, cy + r * 0.9, cx + r * 0.15, cy + r, cx, cy + r);
      g.closePath();
      break;
    case "sheaf":
      // A sheaf: stalks bound at the waist, their ears spread above.
      for (let i = -2; i <= 2; i++) {
        const top = cx + i * r * 0.28;
        g.moveTo(cx + i * r * 0.08 - r * 0.05, cy + r);
        g.lineTo(top - r * 0.07, cy - r * 0.45);
        g.lineTo(top, cy - r * 0.95);
        g.lineTo(top + r * 0.07, cy - r * 0.45);
        g.lineTo(cx + i * r * 0.08 + r * 0.05, cy + r);
        g.closePath();
      }
      g.rect(cx - r * 0.42, cy + r * 0.12, r * 0.84, r * 0.2);
      break;
    case "drop":
      // A drop of rain.
      g.moveTo(cx, cy - r);
      g.bezierCurveTo(
        cx + r * 0.2,
        cy - r * 0.45,
        cx + r * 0.75,
        cy + r * 0.05,
        cx + r * 0.62,
        cy + r * 0.45,
      );
      g.arc(cx, cy + r * 0.38, r * 0.62, 0.1, Math.PI - 0.1);
      g.bezierCurveTo(cx - r * 0.75, cy + r * 0.05, cx - r * 0.2, cy - r * 0.45, cx, cy - r);
      g.closePath();
      break;
    case "cross": {
      const t = r * 0.3;
      g.moveTo(cx - t, cy - r);
      g.lineTo(cx + t, cy - r);
      g.lineTo(cx + t, cy - t);
      g.lineTo(cx + r, cy - t);
      g.lineTo(cx + r, cy + t);
      g.lineTo(cx + t, cy + t);
      g.lineTo(cx + t, cy + r);
      g.lineTo(cx - t, cy + r);
      g.lineTo(cx - t, cy + t);
      g.lineTo(cx - r, cy + t);
      g.lineTo(cx - r, cy - t);
      g.lineTo(cx - t, cy - t);
      g.closePath();
      break;
    }
  }
  // (Nonzero: overlapping strokes of a charge fill whole; a ring's inner circle, drawn the
  // other way round, is left open.)
  g.fill("nonzero");
  g.stroke();
}

/** Paint a canvas with arms, filling it (its drawn size in CSS pixels, at the screen's density). */
export function paintArms(canvas: HTMLCanvasElement, a: Arms): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  const pad = canvas.width * 0.06;
  g.clearRect(0, 0, canvas.width, canvas.height);
  drawArms(g, a, pad, pad, canvas.width - pad * 2, canvas.height - pad * 2);
}

/**
 * Realms' arms, asked of the host once each and kept: a small shield for a realm, drawn now if
 * its arms are known, else as soon as they come (asked together, a moment later).
 */
export class ArmsBook {
  private readonly client: HostClient;
  private readonly known = new Map<string, Arms | null>();
  private readonly waiting = new Map<string, HTMLCanvasElement[]>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(client: HostClient) {
    this.client = client;
  }

  /** A shield `size` CSS pixels wide for a realm's ref. */
  shield(ref: string, size = 14): HTMLCanvasElement {
    const c = document.createElement("canvas"),
      dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    c.className = "arms";
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * 1.2 * dpr);
    c.style.width = `${size}px`;
    c.style.height = `${size * 1.2}px`;
    c.setAttribute("aria-hidden", "true");
    const a = this.known.get(ref);
    if (a) paintArms(c, a);
    else if (a === undefined) {
      const list = this.waiting.get(ref) ?? [];
      list.push(c);
      this.waiting.set(ref, list);
      this.timer ??= setTimeout(() => void this.ask(), 30);
    }
    return c;
  }

  private async ask(): Promise<void> {
    this.timer = null;
    const refs = [...this.waiting.keys()];
    if (!refs.length) return;
    let arms: (Arms | null)[];
    try {
      arms = await this.client.query<(Arms | null)[]>({ type: "arms", args: { refs } });
    } catch {
      // (No world yet: those shields stay bare, and the arms are asked again when next wanted.)
      for (const ref of refs) this.waiting.delete(ref);
      return;
    }
    refs.forEach((ref, i) => {
      const a = arms[i] ?? null,
        list = this.waiting.get(ref) ?? [];
      this.waiting.delete(ref);
      this.known.set(ref, a);
      if (a) for (const c of list) paintArms(c, a);
    });
  }
}
