// A year told, drawn (ui/told.ts): a lead's picture, the year's map, a number's last years. Each is drawn of facts the page was
// already sent and a number, on a 2D canvas, in a few milliseconds, only once it is scrolled into sight, on canvases lent again
// from year to year. No picture is fetched or shipped.
//
// A lead's picture is a page's banner (ui/page-art.ts: the two sides' arms against each other, a land's own ground and people in
// their own body, a town's skyline, a realm's arms over its lands) with what happened there drawn over it by its kind.
import type {
  PageArt,
  ToldFigure,
  ToldMap,
  ToldMapBase,
  ToldMark,
  ToldMotif,
  ToldVignette,
} from "../bridge/index.ts";
import { biomeColor } from "../view/index.ts";
import {
  artCss as css,
  artMix as mix,
  artSky,
  artStream,
  drawBanner,
  paletteOf,
  type ArtPalette,
} from "./page-art.ts";
import { surface } from "./portrait.ts";

type Rgb = readonly [number, number, number];
type G = CanvasRenderingContext2D;

const WHITE: Rgb = [1, 1, 1],
  DARK: Rgb = [0.08, 0.08, 0.1],
  FLAME: Rgb = [0.98, 0.56, 0.14],
  EMBER: Rgb = [0.86, 0.2, 0.1],
  GOLD: Rgb = [0.96, 0.78, 0.26];

/** A filled shape of straight edges: the low-poly brush everything here is drawn with. */
function poly(g: G, pts: readonly number[], fill: string, stroke?: string): void {
  g.beginPath();
  g.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = 1;
    g.stroke();
  }
}

/** A flame of three facets, its foot at (x, y), `s` tall. */
function flame(g: G, x: number, y: number, s: number, lean = 0): void {
  poly(
    g,
    [x - s * 0.34, y, x + lean * s, y - s, x + s * 0.34, y, x, y + s * 0.08],
    css(EMBER, 1, 0.92),
  );
  poly(g, [x - s * 0.2, y, x + lean * s * 0.6, y - s * 0.66, x + s * 0.2, y], css(FLAME, 1, 0.95));
  poly(g, [x - s * 0.09, y, x, y - s * 0.34, x + s * 0.09, y], css([1, 0.92, 0.55]));
}

/** Smoke: a few soft facets rising from (x, y). */
function smoke(g: G, x: number, y: number, s: number, next: () => number, tone: Rgb): void {
  for (let i = 0; i < 6; i++) {
    const r = s * (0.16 + i * 0.07),
      cx = x + (next() - 0.4) * s * 0.5 + i * s * 0.12,
      cy = y - i * s * 0.2;
    poly(
      g,
      [cx - r, cy, cx - r * 0.3, cy - r * 0.8, cx + r * 0.7, cy - r * 0.6, cx + r, cy + r * 0.2],
      css(tone, 1, 0.34 - i * 0.03),
    );
  }
}

/** A banner on its pole, flying: a side's colour where there is one. */
function pennant(g: G, x: number, y: number, s: number, tint: Rgb, lean = 0): void {
  g.save();
  g.translate(x, y);
  g.rotate(lean);
  g.fillStyle = css([0.3, 0.22, 0.15]);
  g.fillRect(-1, -s, 2, s);
  poly(
    g,
    [1, -s, s * 0.62, -s * 0.9, s * 0.5, -s * 0.74, s * 0.66, -s * 0.58, 1, -s * 0.52],
    css(tint),
    css(tint, 0.55),
  );
  poly(g, [1, -s * 0.76, s * 0.5, -s * 0.74, s * 0.66, -s * 0.58, 1, -s * 0.52], css(tint, 0.78));
  g.restore();
}

/** What happened, drawn over its scene: by its kind, in the two sides' colours and the world's light. */
function motif(
  g: G,
  kind: ToldMotif,
  p: ArtPalette,
  w: number,
  h: number,
  key: number,
  tints: readonly Rgb[],
  /** The scene it is drawn over: a land's ground has its house and its people at the middle and right, so it stands to the left. */
  over: "war" | "land" | "town" | "realm" | "none",
): void {
  const plain = over !== "war",
    next = artStream(key),
    gy = h * 0.84,
    cx =
      w *
      (over === "land"
        ? kind === "crown"
          ? 0.66
          : kind === "sickness" || kind === "flood" || kind === "star"
            ? 0.5
            : 0.2
        : over === "realm"
          ? 0.74
          : 0.5),
    a = tints[0] ?? ([0.72, 0.2, 0.18] as Rgb),
    b = tints[1] ?? ([0.2, 0.34, 0.66] as Rgb),
    s = h * 0.62;
  switch (kind) {
    case "battle": {
      // (Two sides' banners already stand in a war's scene: only the field between them is drawn over.)
      if (plain) {
        pennant(g, w * 0.3, gy, s, a, -0.12);
        pennant(g, w * 0.7, gy, s, b, 0.12);
      }
      const mx = w * 0.5;
      g.lineCap = "round";
      for (const way of [-1, 1]) {
        g.strokeStyle = css(p.metal, 1.05);
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(mx - way * s * 0.34, gy - s * 0.06);
        g.lineTo(mx + way * s * 0.3, gy - s * 0.78);
        g.stroke();
        poly(
          g,
          [
            mx + way * s * 0.3,
            gy - s * 0.78,
            mx + way * s * 0.36,
            gy - s * 0.94,
            mx + way * s * 0.22,
            gy - s * 0.84,
          ],
          css(WHITE, 0.92),
        );
      }
      for (let i = 0; i < 5; i++)
        poly(
          g,
          [
            mx + (next() - 0.5) * s,
            gy,
            mx + (next() - 0.5) * s,
            gy - 3 - next() * 4,
            mx + (next() - 0.5) * s,
            gy,
          ],
          css(DARK, 1, 0.55),
        );
      break;
    }
    case "peace": {
      // A bow of light over the field, and the smoke gone white.
      const mx = w * 0.5;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(mx, gy, s * (0.92 - i * 0.09), Math.PI, 0);
        g.strokeStyle = css(mix([GOLD, WHITE, p.light][i]!, p.light, 0.3), 1, 0.5);
        g.lineWidth = 3;
        g.stroke();
      }
      if (plain) {
        pennant(g, mx - s * 0.2, gy, s * 0.8, a, -0.06);
        pennant(g, mx + s * 0.06, gy, s * 0.8, b, 0.06);
      }
      break;
    }
    case "fall": {
      // A banner down, its pole broken, and the dust of it.
      g.save();
      g.translate(cx, gy);
      g.rotate(1.05);
      g.fillStyle = css([0.3, 0.22, 0.15]);
      g.fillRect(-1, -s * 0.9, 2, s * 0.9);
      poly(
        g,
        [1, -s * 0.9, s * 0.5, -s * 0.84, s * 0.38, -s * 0.66, s * 0.5, -s * 0.5, 1, -s * 0.46],
        css(a, 0.8),
        css(a, 0.45),
      );
      g.restore();
      poly(
        g,
        [cx - 6, gy, cx - 2, gy - s * 0.22, cx + 3, gy - s * 0.18, cx + 5, gy],
        css(p.rock, 0.8),
      );
      smoke(g, cx + s * 0.2, gy - 2, s * 0.6, next, [0.6, 0.56, 0.5]);
      break;
    }
    case "rise": {
      // A banner raised, and the light behind it.
      for (let i = 0; i < 7; i++) {
        const t = -Math.PI * (0.12 + (i / 6) * 0.76);
        poly(
          g,
          [
            cx,
            gy - s * 0.7,
            cx + Math.cos(t - 0.05) * s * 1.1,
            gy - s * 0.7 + Math.sin(t - 0.05) * s * 1.1,
            cx + Math.cos(t + 0.05) * s * 1.1,
            gy - s * 0.7 + Math.sin(t + 0.05) * s * 1.1,
          ],
          css(p.light, 1, 0.16),
        );
      }
      pennant(g, cx, gy, s * 1.05, a);
      break;
    }
    case "crown": {
      const y = h * 0.16,
        r = h * 0.2,
        x = cx;
      g.fillStyle = css(GOLD, 1, 0.18);
      g.beginPath();
      g.arc(x, y + r * 0.6, r * 1.7, 0, Math.PI * 2);
      g.fill();
      poly(
        g,
        [
          x - r,
          y + r,
          x - r,
          y + r * 0.1,
          x - r * 0.5,
          y + r * 0.56,
          x,
          y - r * 0.1,
          x + r * 0.5,
          y + r * 0.56,
          x + r,
          y + r * 0.1,
          x + r,
          y + r,
        ],
        css(GOLD),
        css(GOLD, 0.6),
      );
      poly(g, [x - r, y + r, x - r, y + r * 0.7, x + r, y + r * 0.7, x + r, y + r], css(GOLD, 0.8));
      poly(g, [x - 2, y + r * 0.5, x, y + r * 0.34, x + 2, y + r * 0.5, x, y + r * 0.66], css(a));
      break;
    }
    case "strife": {
      // Torches in a crowd's hands, and a crown struck sideways.
      for (let i = 0; i < 6; i++) {
        const x = cx - s * 0.7 + i * s * 0.26 + (next() - 0.5) * 4,
          top = gy - s * (0.4 + next() * 0.22);
        g.fillStyle = css(DARK, 1, 0.8);
        g.fillRect(x - 0.8, top, 1.6, gy - top);
        flame(g, x, top, s * 0.2, (next() - 0.5) * 0.4);
      }
      g.save();
      g.translate(cx + s * 0.86, gy - s * 0.12);
      g.rotate(0.7);
      poly(g, [-7, 5, -7, -2, -3, 2, 0, -4, 3, 2, 7, -2, 7, 5], css(GOLD, 0.9), css(GOLD, 0.5));
      g.restore();
      break;
    }
    case "sickness": {
      // The light dimmed, markers on the ground, and what hangs in the air.
      g.fillStyle = css([0.3, 0.42, 0.24], 1, 0.26);
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const x = cx - s * 0.8 + i * s * 0.4 + (next() - 0.5) * 5,
          t = s * (0.2 + next() * 0.1);
        g.fillStyle = css(DARK, 1, 0.78);
        g.fillRect(x - 1, gy - t, 2, t);
        g.fillRect(x - t * 0.3, gy - t * 0.72, t * 0.6, 2);
      }
      for (let i = 0; i < 22; i++) {
        const x = cx + (next() - 0.5) * s * 2.4,
          y = gy - next() * h * 0.7,
          r = 1 + next() * 1.6;
        poly(g, [x - r, y, x, y - r, x + r, y, x, y + r], css([0.62, 0.78, 0.36], 1, 0.6));
      }
      break;
    }
    case "famine": {
      // The ground cracked, and the rows withered on it.
      g.fillStyle = css([0.72, 0.6, 0.36], 1, 0.3);
      g.fillRect(0, gy - 2, w, h - gy + 2);
      g.strokeStyle = css(DARK, 1, 0.6);
      g.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        let x = cx - s * 1.1 + next() * s * 2.2,
          y = gy;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 3; k++) {
          x += (next() - 0.5) * 7;
          y += (h - gy) / 3;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const x = cx - s * 0.9 + i * s * 0.22,
          t = s * (0.16 + next() * 0.1),
          lean = (next() - 0.3) * t;
        g.strokeStyle = css([0.62, 0.5, 0.22]);
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(x, gy);
        g.quadraticCurveTo(x, gy - t, x + lean, gy - t * 0.7);
        g.stroke();
      }
      break;
    }
    case "woods": {
      // A wood cut back: its stumps, and what still stands.
      for (let i = 0; i < 7; i++) {
        const x = cx - s * 1.0 + i * s * 0.3 + (next() - 0.5) * 5,
          t = s * 0.12;
        poly(g, [x - 3, gy, x - 2.4, gy - t, x + 2.4, gy - t, x + 3, gy], css([0.42, 0.3, 0.2]));
        poly(g, [x - 2.4, gy - t, x, gy - t - 1.4, x + 2.4, gy - t], css([0.8, 0.68, 0.48]));
      }
      for (const dx of [0.95, 1.25]) {
        const x = cx + dx * s * 0.8,
          t = s * (0.6 + next() * 0.2);
        g.fillStyle = css([0.36, 0.25, 0.16]);
        g.fillRect(x - 1.2, gy - t * 0.4, 2.4, t * 0.4);
        poly(
          g,
          [x - t * 0.24, gy - t * 0.34, x, gy - t, x + t * 0.24, gy - t * 0.34],
          css(p.leaf, 0.9),
        );
        poly(g, [x, gy - t, x + t * 0.24, gy - t * 0.34, x, gy - t * 0.34], css(p.leaf, 0.66));
      }
      break;
    }
    case "dig": {
      // A pit's head over its shaft, and what was brought up.
      const x = cx,
        top = gy - s * 0.74;
      poly(
        g,
        [
          x - s * 0.34,
          gy,
          x - s * 0.05,
          top,
          x + s * 0.05,
          top,
          x + s * 0.34,
          gy,
          x + s * 0.26,
          gy,
          x,
          top + s * 0.14,
          x - s * 0.26,
          gy,
        ],
        css([0.3, 0.24, 0.2]),
      );
      g.strokeStyle = css(p.metal, 1.1);
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(x, top + s * 0.06, s * 0.1, 0, Math.PI * 2);
      g.moveTo(x, top + s * 0.16);
      g.lineTo(x, gy);
      g.stroke();
      poly(
        g,
        [
          x - s * 0.1,
          gy,
          x - s * 0.1,
          gy + (h - gy) * 0.7,
          x + s * 0.1,
          gy + (h - gy) * 0.7,
          x + s * 0.1,
          gy,
        ],
        css(DARK, 1, 0.8),
      );
      for (let i = 0; i < 3; i++) {
        const hx = x + s * (0.5 + i * 0.22),
          r = s * (0.16 - i * 0.03);
        poly(
          g,
          [hx - r, gy, hx - r * 0.3, gy - r * 0.9, hx + r * 0.6, gy - r * 0.7, hx + r, gy],
          css(mix(p.rock, DARK, 0.3 + i * 0.1)),
        );
      }
      break;
    }
    case "fire": {
      smoke(g, cx - s * 0.1, gy - s * 0.4, s, next, [0.24, 0.22, 0.22]);
      for (let i = 0; i < 7; i++)
        flame(
          g,
          cx - s * 0.8 + i * s * 0.27 + (next() - 0.5) * 4,
          gy + 1,
          s * (0.3 + next() * 0.36),
          (next() - 0.5) * 0.3,
        );
      break;
    }
    case "eruption": {
      // A mountain burning: its cone, the fire out of it, the ash above.
      const x = cx,
        top = gy - s * 0.74;
      smoke(g, x, top, s * 0.9, next, [0.26, 0.24, 0.25]);
      poly(
        g,
        [x - s * 0.9, gy, x - s * 0.14, top, x + s * 0.14, top, x + s * 0.9, gy],
        css(p.rock, 0.62),
      );
      poly(g, [x, top, x + s * 0.14, top, x + s * 0.9, gy, x + s * 0.2, gy], css(p.rock, 0.42));
      flame(g, x, top + 1, s * 0.42);
      poly(g, [x - 2, top, x + 3, top, x + s * 0.3, gy, x + s * 0.18, gy], css(FLAME, 1, 0.9));
      for (let i = 0; i < 8; i++) {
        const ex = x + (next() - 0.5) * s * 1.1,
          ey = top - next() * s * 0.5;
        poly(g, [ex - 1.4, ey, ex, ey - 1.6, ex + 1.4, ey, ex, ey + 1.4], css(FLAME));
      }
      break;
    }
    case "quake": {
      // The ground split, and what stood on it leaning.
      g.strokeStyle = css(DARK, 1, 0.85);
      g.lineWidth = 2.4;
      g.lineJoin = "miter";
      g.beginPath();
      let x = cx - s * 0.9,
        y = gy - 3;
      g.moveTo(x, y);
      for (let i = 0; i < 9; i++) {
        x += s * 0.2;
        y = gy + (i % 2 ? -5 : 5) * (0.5 + next()) + (i / 9) * (h - gy) * 0.4;
        g.lineTo(x, y);
      }
      g.stroke();
      for (const [dx, lean] of [
        [-0.5, -0.22],
        [0.1, 0.3],
        [0.6, -0.12],
      ] as const) {
        g.save();
        g.translate(cx + dx * s, gy - 2);
        g.rotate(lean);
        const bw = s * 0.2,
          bh = s * (0.3 + next() * 0.2);
        poly(
          g,
          [-bw / 2, 0, -bw / 2, -bh, bw / 2, -bh, bw / 2, 0],
          css(p.rock, 0.9),
          css(DARK, 1, 0.5),
        );
        poly(g, [-bw / 2, -bh, 0, -bh - bw * 0.5, bw / 2, -bh], css(a, 0.7));
        g.restore();
      }
      break;
    }
    case "flood": {
      // The water over the land, and what still stands in it.
      const top = gy - s * 0.3;
      for (let k = 0; k < 3; k++) {
        const y = top + k * s * 0.14;
        g.beginPath();
        g.moveTo(0, h);
        g.lineTo(0, y);
        for (let x = 0; x <= w; x += 12) g.lineTo(x, y + ((x / 12 + k) % 2 ? -2.4 : 2.4));
        g.lineTo(w, h);
        g.closePath();
        g.fillStyle = css(mix(p.sea, WHITE, 0.12 * k), 1, 0.62);
        g.fill();
      }
      poly(g, [cx - 8, top + 3, cx, top - s * 0.24, cx + 8, top + 3], css(a, 0.7));
      break;
    }
    case "faith": {
      // A shrine, and the light it stands in.
      const x = cx,
        top = gy - s * 0.86;
      g.fillStyle = css(p.light, 1, 0.22);
      g.beginPath();
      g.arc(x, top + s * 0.1, s * 0.5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = css(GOLD, 1, 0.9);
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x, top + s * 0.1, s * 0.22, 0, Math.PI * 2);
      g.stroke();
      poly(
        g,
        [
          x - s * 0.34,
          gy,
          x - s * 0.34,
          gy - s * 0.4,
          x + s * 0.34,
          gy - s * 0.4,
          x + s * 0.34,
          gy,
        ],
        css(p.rock, 1.05),
      );
      poly(
        g,
        [x - s * 0.42, gy - s * 0.4, x, gy - s * 0.66, x + s * 0.42, gy - s * 0.4],
        css(p.rock, 0.8),
      );
      for (const dx of [-0.24, 0, 0.24])
        poly(
          g,
          [
            x + dx * s - 2,
            gy,
            x + dx * s - 2,
            gy - s * 0.38,
            x + dx * s + 2,
            gy - s * 0.38,
            x + dx * s + 2,
            gy,
          ],
          css(p.rock, 0.66),
        );
      break;
    }
    case "coin": {
      // Coin, stacked and falling.
      const coin = (x: number, y: number, r: number, k: number) => {
        g.beginPath();
        g.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
        g.fillStyle = css(GOLD, k);
        g.fill();
        g.strokeStyle = css(GOLD, 0.5);
        g.lineWidth = 1;
        g.stroke();
      };
      for (let stack = 0; stack < 3; stack++) {
        const n = 2 + Math.floor(next() * 4);
        for (let i = 0; i < n; i++)
          coin(cx - s * 0.5 + stack * s * 0.4, gy - 2 - i * 3.4, s * 0.17, 0.82 + i * 0.04);
      }
      for (let i = 0; i < 5; i++)
        coin(cx + (next() - 0.3) * s * 1.2, gy - s * (0.36 + next() * 0.6), s * 0.11, 1);
      break;
    }
    case "ship": {
      // A ship under sail, on its sea.
      const y = gy - 2,
        x = cx;
      g.fillStyle = css(p.sea, 1, 0.72);
      g.fillRect(0, y, w, h - y);
      poly(
        g,
        [
          x - s * 0.5,
          y - s * 0.08,
          x + s * 0.5,
          y - s * 0.08,
          x + s * 0.34,
          y + s * 0.1,
          x - s * 0.36,
          y + s * 0.1,
        ],
        css([0.36, 0.24, 0.16]),
      );
      g.fillStyle = css([0.3, 0.22, 0.15]);
      g.fillRect(x - 1, y - s * 0.84, 2, s * 0.78);
      poly(
        g,
        [x + 2, y - s * 0.8, x + s * 0.42, y - s * 0.2, x + 2, y - s * 0.16],
        css(WHITE, 0.94),
      );
      poly(g, [x - 2, y - s * 0.7, x - s * 0.34, y - s * 0.2, x - 2, y - s * 0.16], css(a, 0.92));
      break;
    }
    case "star": {
      // The night, its stars, and a craft going out among them.
      g.fillStyle = css([0.03, 0.04, 0.1], 1, 0.62);
      g.fillRect(0, 0, w, h * 0.7);
      for (let i = 0; i < 44; i++) {
        const x = next() * w,
          y = next() * h * 0.66,
          r = 0.5 + next() * 1.1;
        poly(
          g,
          [x - r, y, x, y - r, x + r, y, x, y + r],
          css(mix(WHITE, p.light, next() * 0.5), 1, 0.5 + next() * 0.5),
        );
      }
      const x = cx,
        y = h * 0.3;
      g.strokeStyle = css(FLAME, 1, 0.7);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - s * 0.7, y + s * 0.3);
      g.lineTo(x - s * 0.12, y + s * 0.05);
      g.stroke();
      poly(
        g,
        [x + s * 0.22, y - s * 0.1, x - s * 0.12, y - s * 0.02, x - s * 0.12, y + s * 0.12],
        css(p.metal, 1.1),
        css(DARK, 1, 0.5),
      );
      poly(
        g,
        [x - s * 0.12, y - s * 0.02, x - s * 0.22, y - s * 0.1, x - s * 0.12, y + s * 0.05],
        css(a, 0.9),
      );
      break;
    }
    case "beast": {
      // Eyes in the dark of the trees, and its tracks.
      const x = cx,
        y = gy - s * 0.3;
      poly(
        g,
        [
          x - s * 0.5,
          gy,
          x - s * 0.42,
          y,
          x - s * 0.2,
          y - s * 0.2,
          x + s * 0.24,
          y - s * 0.18,
          x + s * 0.42,
          y - s * 0.4,
          x + s * 0.58,
          y - s * 0.3,
          x + s * 0.5,
          y,
          x + s * 0.4,
          gy,
          x + s * 0.3,
          gy,
          x + s * 0.26,
          y + s * 0.1,
          x - s * 0.3,
          y + s * 0.1,
          x - s * 0.36,
          gy,
        ],
        css(DARK, 1, 0.86),
      );
      poly(
        g,
        [x + s * 0.42, y - s * 0.4, x + s * 0.4, y - s * 0.54, x + s * 0.48, y - s * 0.4],
        css(DARK, 1, 0.86),
      );
      poly(
        g,
        [x + s * 0.46, y - s * 0.3, x + s * 0.5, y - s * 0.33, x + s * 0.5, y - s * 0.28],
        css(GOLD),
      );
      for (let i = 0; i < 4; i++) {
        const tx = x - s * 0.7 - i * s * 0.22;
        poly(g, [tx - 1.6, gy + 4, tx, gy + 2, tx + 1.6, gy + 4, tx, gy + 6], css(DARK, 1, 0.5));
      }
      break;
    }
    case "found": {
      // A lamp lit, and its light.
      const x = cx,
        y = gy - s * 0.46;
      for (let i = 0; i < 10; i++) {
        const t = (i / 10) * Math.PI * 2;
        poly(
          g,
          [
            x + Math.cos(t) * s * 0.2,
            y + Math.sin(t) * s * 0.2,
            x + Math.cos(t - 0.07) * s * 0.52,
            y + Math.sin(t - 0.07) * s * 0.52,
            x + Math.cos(t + 0.07) * s * 0.52,
            y + Math.sin(t + 0.07) * s * 0.52,
          ],
          css(GOLD, 1, 0.42),
        );
      }
      poly(
        g,
        [x - s * 0.16, gy, x - s * 0.1, y + s * 0.14, x + s * 0.1, y + s * 0.14, x + s * 0.16, gy],
        css(p.metal, 0.8),
        css(DARK, 1, 0.4),
      );
      flame(g, x, y + s * 0.14, s * 0.3);
      break;
    }
    case "quiet": {
      // Birds over a land at rest.
      g.strokeStyle = css(DARK, 1, 0.6);
      g.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        const x = w * (0.2 + next() * 0.6),
          y = h * (0.14 + next() * 0.3),
          r = 3 + next() * 3;
        g.beginPath();
        g.moveTo(x - r, y - r * 0.3);
        g.lineTo(x, y);
        g.lineTo(x + r, y - r * 0.4);
        g.stroke();
      }
      break;
    }
  }
}

/** A lead's picture, `w` × `h` CSS pixels: its scene, and what happened there over it. */
export function drawVignette(
  canvas: HTMLCanvasElement,
  v: ToldVignette,
  world: PageArt["world"],
  w: number,
  h: number,
): void {
  const p = paletteOf(world);
  let g: G;
  if (v.scene) {
    drawBanner(canvas, { world, banner: v.scene }, v.scene, undefined, `told:${v.key}`, w, h);
    g = canvas.getContext("2d")!;
  } else {
    g = surface(canvas, w, h);
    artSky(g, p, w, h, 0.24);
    poly(
      g,
      [0, h, 0, h * 0.84, w * 0.3, h * 0.8, w * 0.62, h * 0.86, w, h * 0.8, w, h],
      css(p.ground, 0.9),
    );
  }
  const kind = v.scene?.kind;
  motif(
    g,
    v.motif,
    p,
    w,
    h,
    v.key,
    v.tints,
    kind === "war" || kind === "land" || kind === "town" || kind === "realm" ? kind : "none",
  );
}

// —— The map ——————————————————————————————————————————————————————————————————————————————

/** A mark of the map, at (x, y): what fell there, by its kind. */
export function drawMark(
  g: G,
  kind: ToldMark["kind"] | "gained" | "lost",
  x: number,
  y: number,
  s: number,
): void {
  g.lineCap = "round";
  g.lineJoin = "round";
  const ring = (fill: string) => {
    g.lineWidth = 3;
    g.strokeStyle = css(DARK, 1, 0.85);
    g.stroke();
    g.lineWidth = 1.5;
    g.strokeStyle = fill;
    g.stroke();
  };
  switch (kind) {
    case "battle":
      g.beginPath();
      g.moveTo(x - s, y - s);
      g.lineTo(x + s, y + s);
      g.moveTo(x + s, y - s);
      g.lineTo(x - s, y + s);
      ring(css(WHITE));
      break;
    case "strike":
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const t = (i / 4) * Math.PI;
        g.moveTo(x - Math.cos(t) * s, y - Math.sin(t) * s);
        g.lineTo(x + Math.cos(t) * s, y + Math.sin(t) * s);
      }
      ring(css(FLAME));
      break;
    case "sickness":
      g.beginPath();
      g.arc(x, y, s * 0.8, 0, Math.PI * 2);
      ring(css([0.62, 0.9, 0.3]));
      break;
    case "famine":
      poly(
        g,
        [x - s, y - s * 0.7, x + s, y - s * 0.7, x, y + s],
        css([0.86, 0.68, 0.22]),
        css(DARK, 1, 0.85),
      );
      break;
    case "quake":
      g.beginPath();
      g.moveTo(x - s, y - s * 0.6);
      g.lineTo(x - s * 0.3, y + s * 0.4);
      g.lineTo(x + s * 0.3, y - s * 0.4);
      g.lineTo(x + s, y + s * 0.6);
      ring(css([0.95, 0.9, 0.5]));
      break;
    case "fire":
      poly(
        g,
        [x - s * 0.7, y + s * 0.7, x, y - s, x + s * 0.7, y + s * 0.7],
        css(FLAME),
        css(DARK, 1, 0.85),
      );
      break;
    case "flood":
      g.beginPath();
      g.moveTo(x - s, y);
      g.quadraticCurveTo(x - s * 0.5, y - s, x, y);
      g.quadraticCurveTo(x + s * 0.5, y + s, x + s, y);
      ring(css([0.45, 0.75, 1]));
      break;
    case "town":
      poly(
        g,
        [
          x - s * 0.7,
          y + s * 0.7,
          x - s * 0.7,
          y - s * 0.2,
          x,
          y - s,
          x + s * 0.7,
          y - s * 0.2,
          x + s * 0.7,
          y + s * 0.7,
        ],
        css(WHITE),
        css(DARK, 1, 0.85),
      );
      break;
    case "gained":
      hatch(g, x - s, y - s, 2 * s, 2 * s, css(WHITE, 1, 0.95));
      g.strokeStyle = css(WHITE);
      g.lineWidth = 1;
      g.strokeRect(x - s, y - s, 2 * s, 2 * s);
      break;
    case "lost":
      g.setLineDash([2, 2]);
      g.strokeStyle = css(WHITE, 1, 0.9);
      g.lineWidth = 1;
      g.strokeRect(x - s, y - s, 2 * s, 2 * s);
      g.setLineDash([]);
      break;
  }
}

/** Slanted lines across a square: a land that changed hands. */
function hatch(g: G, x: number, y: number, w: number, h: number, stroke: string): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = stroke;
  g.lineWidth = 1;
  g.beginPath();
  for (let d = -h; d < w; d += 3) {
    g.moveTo(x + d, y + h);
    g.lineTo(x + d + h, y);
  }
  g.stroke();
  g.restore();
}

/**
 * A year's map, `w` CSS pixels wide (its height comes back): every land a square where it lies, sea and ground in its world's
 * colours, a held land in its realm's, a land that changed hands hatched, and where the year's great things fell marked. Of a
 * realm, drawn near: its own lands and those about them.
 */
export function drawYearMap(
  canvas: HTMLCanvasElement,
  base: ToldMapBase,
  map: ToldMap,
  world: PageArt["world"],
  w: number,
): number {
  const p = paletteOf(world),
    n = base.lon.length,
    focus = map.focus?.length ? map.focus : null,
    // (What it frames: a realm's lands; else the lands that are held, where they lie in one part of the world.)
    frame = focus ?? (map.lands.length ? map.lands : null);
  // Where it looks: the whole world, or about a realm's lands, or about the peopled part of a world mostly empty.
  let lon0 = 0,
    lat0 = 0,
    k = w / (2 * Math.PI),
    h = Math.round(w / 2),
    squash = 1,
    near = false;
  if (frame) {
    let sx = 0,
      sy = 0,
      sl = 0;
    for (const c of frame) {
      sx += Math.cos(base.lon[c]! / 1000);
      sy += Math.sin(base.lon[c]! / 1000);
      sl += base.lat[c]! / 1000;
    }
    const mid = Math.atan2(sy, sx),
      midLat = sl / frame.length,
      narrow = Math.max(0.2, Math.cos(midLat));
    let reach = base.step * 3;
    for (const c of frame) {
      let dl = base.lon[c]! / 1000 - mid;
      if (dl > Math.PI) dl -= 2 * Math.PI;
      if (dl < -Math.PI) dl += 2 * Math.PI;
      reach = Math.max(
        reach,
        Math.abs(dl) * narrow * 1.0,
        Math.abs(base.lat[c]! / 1000 - midLat) * 1.9,
      );
    }
    reach = Math.min(Math.PI, reach + base.step * 2.5);
    // (A people spread about most of the world are drawn on the whole of it.)
    if (focus || reach < Math.PI * 0.8) {
      near = true;
      lon0 = mid;
      lat0 = midLat;
      squash = narrow;
      k = w / (2 * reach);
      h = Math.round(w * 0.52);
    }
  }
  const g = surface(canvas, w, h),
    at = (c: number): [number, number] | null => {
      let dl = base.lon[c]! / 1000 - lon0;
      if (dl > Math.PI) dl -= 2 * Math.PI;
      if (dl < -Math.PI) dl += 2 * Math.PI;
      const x = w / 2 + dl * k * squash,
        y = h / 2 - (base.lat[c]! / 1000 - lat0) * k;
      return x < -20 || x > w + 20 || y < -20 || y > h + 20 ? null : [x, y];
    },
    side = Math.max(2, base.step * k * 1.04),
    // (On a map of the whole world a land nearer a pole is drawn as wide as the map stretches it.)
    // (And a little over, the more the nearer a pole: its few lands leave no gaps between them.)
    wide = (c: number) => {
      const cos = Math.max(0.03, Math.cos(base.lat[c]! / 1000));
      // (Drawn near, as wide as its own latitude is against the middle's, within bounds.)
      if (near) return side * Math.max(1, Math.min(4, squash / cos));
      return (side / cos) * (1 + 0.7 * (1 - cos));
    },
    owner = new Map<number, number>();
  map.lands.forEach((c, i) => owner.set(c, map.owner[i]!));
  g.fillStyle = css(p.sea, 0.5);
  g.fillRect(0, 0, w, h);
  const mine = new Set(focus ?? []);
  for (let c = 0; c < n; c++) {
    const q = at(c);
    if (!q) continue;
    const b = base.biome[c]!,
      o = owner.get(c),
      sea = b <= 3,
      ground = sea ? mix(p.sea, biomeColor(b, p.kind, p.look), 0.4) : biomeColor(b, p.kind, p.look),
      muted: Rgb = sea
        ? [ground[0] * 0.62, ground[1] * 0.62, ground[2] * 0.62]
        : mix(ground, [0.36, 0.36, 0.36], 0.45),
      tone =
        o === undefined
          ? muted
          : mix(muted, map.realms[o]!.color, focus && !mine.has(c) ? 0.5 : 0.82),
      ww = wide(c);
    g.fillStyle = css(tone);
    g.fillRect(q[0] - ww / 2, q[1] - side / 2, ww + 0.5, side + 0.5);
  }
  // A realm's own lands, edged; what changed hands, hatched; what fell to no one, dashed.
  if (focus) {
    g.strokeStyle = css(WHITE, 1, 0.5);
    g.lineWidth = 1;
    for (const c of focus) {
      const q = at(c);
      if (q) g.strokeRect(q[0] - side / 2 + 0.5, q[1] - side / 2 + 0.5, side - 1, side - 1);
    }
  }
  const box = Math.max(side, 5);
  for (const c of map.gained) {
    const q = at(c);
    if (!q) continue;
    hatch(g, q[0] - box / 2, q[1] - box / 2, box, box, css(WHITE, 1, 0.92));
    g.strokeStyle = css(WHITE);
    g.lineWidth = 1.2;
    g.strokeRect(q[0] - box / 2, q[1] - box / 2, box, box);
  }
  g.setLineDash([2, 2]);
  g.strokeStyle = css(WHITE, 1, 0.9);
  for (const c of map.lost) {
    const q = at(c);
    if (q) g.strokeRect(q[0] - box / 2, q[1] - box / 2, box, box);
  }
  g.setLineDash([]);
  for (const m of map.marks) {
    const q = at(m.cell);
    if (q) drawMark(g, m.kind, q[0], q[1], Math.max(4, Math.min(6.5, w / 120)));
  }
  canvas.dataset.near = near ? "1" : "0";
  return h;
}

/** What a mark means, as a small picture beside its words. */
export function markCanvas(kind: string): HTMLCanvasElement {
  const c = document.createElement("canvas"),
    g = surface(c, 16, 16);
  c.className = "told-key";
  c.setAttribute("aria-hidden", "true");
  if (kind === "gained" || kind === "lost") {
    g.fillStyle = "rgba(120,120,130,0.9)";
    g.fillRect(3, 3, 10, 10);
  }
  drawMark(g, kind as ToldMark["kind"], 8, 8, kind === "gained" || kind === "lost" ? 5 : 4.5);
  return c;
}

// —— A number's last years ————————————————————————————————————————————————————————————————

/** A number's years as a small line, its last year a dot: lit by whether its way is good. */
export function drawSpark(canvas: HTMLCanvasElement, f: ToldFigure, w: number, h: number): void {
  const g = surface(canvas, w, h),
    pts = f.points;
  if (pts.length < 2) return;
  let lo = Infinity,
    hi = -Infinity;
  for (const q of pts) {
    lo = Math.min(lo, q.y);
    hi = Math.max(hi, q.y);
  }
  // (A number that barely moved is a level line, not a cliff.)
  const mid = (lo + hi) / 2,
    span = Math.max(hi - lo, Math.abs(mid) * 0.04, 1e-9),
    x0 = pts[0]!.x,
    x1 = pts.at(-1)!.x,
    px = (x: number) => 2 + ((x - x0) / Math.max(1, x1 - x0)) * (w - 6),
    py = (y: number) => h - 3 - ((y - (mid - span / 2)) / span) * (h - 6),
    way = f.year10?.way ?? f.year1?.way ?? 0,
    tone: Rgb =
      !way || !f.good ? [0.62, 0.72, 1] : way * f.good > 0 ? [0.46, 0.86, 0.52] : [0.96, 0.5, 0.42];
  g.beginPath();
  pts.forEach((q, i) => (i ? g.lineTo(px(q.x), py(q.y)) : g.moveTo(px(q.x), py(q.y))));
  g.strokeStyle = css(tone);
  g.lineWidth = 1.5;
  g.lineJoin = "round";
  g.stroke();
  g.lineTo(px(x1), h);
  g.lineTo(px(x0), h);
  g.closePath();
  g.fillStyle = css(tone, 1, 0.16);
  g.fill();
  g.beginPath();
  g.arc(px(x1), py(pts.at(-1)!.y), 2.2, 0, Math.PI * 2);
  g.fillStyle = css(WHITE);
  g.fill();
}
