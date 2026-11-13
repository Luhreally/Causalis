// A page's own art (asked 2026-11-13: "lowkey add more graphics and like icons and like stuff for the tabs ... make it generative and
// like derived from first principles ... but it shouldt make the game slower"): drawn of what the page's world is, as host/inspect/art.ts
// reads it, and of the page's own numbers.
//
// - Its colours are its world's: its star's light from the star's warmth (Planck's law at three wavelengths), its sky that light
//   scattered by its air (bluer light scattered the more, as the fourth power of its shortness), hazed where its air is smoky; its seas
//   its kind's liquid, its ground and what grows on it its kind's and its life's, as the globe draws them.
// - A tab's glyph says what the tab is of (people, years, goods, arms, the land, life...) in those colours.
// - A banner draws a land's ground west to east through it, with its woods, a home and its people; a town's skyline of its own homes and
//   buildings; a realm's arms over the shape of its lands; a war's two banners and the arms each host carries; a far world by its star;
//   a people by the ground and light they rose under.
// - A section's glyph is drawn of its own numbers: a chart's run, a breakdown's shares, a set of bars.
//
// Drawn once, as a page opens and only what it shows, then kept by what it was drawn of: nothing per tick, a page opened again copies
// what was drawn.
import type { BannerFigure, Block, PageArt, PageBanner, Portrait } from "../bridge/index.ts";
import { biomeColor, houseLook, kindWater } from "../view/index.ts";
import { drawArms } from "./arms.ts";
import { drawSolids, personSolids, starColor, surface } from "./portrait.ts";
import { drawSpecimen } from "./specimen.ts";

type Rgb = readonly [number, number, number];

const css = (c: Rgb, k = 1, a = 1) =>
  `rgba(${Math.round(Math.max(0, Math.min(1, c[0] * k)) * 255)},${Math.round(Math.max(0, Math.min(1, c[1] * k)) * 255)},${Math.round(Math.max(0, Math.min(1, c[2] * k)) * 255)},${a})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A keyed stream of numbers (0 … 1), the same each time for the same key. */
function stream(key: number): () => number {
  let k = key >>> 0 || 1;
  return () => (k = (Math.imul(k, 1664525) + 1013904223) >>> 0) / 4294967296;
}

// —— A world's colours ————————————————————————————————————————————————————————————————————

/** A world's colours, as its pages draw it. */
export type ArtPalette = {
  readonly light: Rgb;
  readonly zenith: Rgb;
  readonly horizon: Rgb;
  readonly sea: Rgb;
  readonly ground: Rgb;
  readonly leaf: Rgb;
  readonly ice: Rgb;
  readonly rock: Rgb;
  /** A metal as it shines under its light. */
  readonly metal: Rgb;
  readonly key: string;
  readonly kind: string;
  readonly look?: string;
};

/** Planck's law at a wavelength (m) and a warmth (K), to a constant. */
function planck(lambda: number, kelvin: number): number {
  return 1 / (lambda ** 5 * (Math.exp(1.4388e-2 / (lambda * kelvin)) - 1));
}
/** The wavelengths the three colours of a screen stand for (m). */
const RGB_NM = [610e-9, 550e-9, 465e-9] as const;
/** What a kind's air hazes its sky with: smoke of tholins, sulfur's yellow, soot (none: clear air). */
const HAZE: Readonly<Record<string, readonly [Rgb, number]>> = {
  methane: [[0.82, 0.56, 0.3], 0.55],
  sulfur: [[0.86, 0.8, 0.44], 0.4],
  carbon: [[0.5, 0.48, 0.46], 0.35],
  ammonia: [[0.78, 0.8, 0.84], 0.2],
};

const PALETTES = new Map<string, ArtPalette>();

/** A world's colours: its star's light, its sky scattered of it, its seas, ground, leaf, ice and rock. */
export function paletteOf(w: PageArt["world"]): ArtPalette {
  const key = `${w.kind}|${w.look ?? ""}|${Math.round(w.star / 50)}`,
    kept = PALETTES.get(key);
  if (kept) return kept;
  const t = Math.max(1200, w.star),
    lit = RGB_NM.map((l) => planck(l, t)),
    // (Scattered as the fourth power of the light's shortness: Rayleigh.)
    scattered = RGB_NM.map((l, i) => lit[i]! / (l / 550e-9) ** 4),
    norm = (v: number[]): Rgb => {
      const m = Math.max(...v);
      return [v[0]! / m, v[1]! / m, v[2]! / m];
    },
    light = mix(norm(lit), starColor(w.star), 0.5),
    haze = HAZE[w.kind];
  let zenith = mix(norm(scattered), [0.1, 0.12, 0.2], 0.35);
  if (haze) zenith = mix(zenith, haze[0], haze[1]);
  const horizon = mix(zenith, light, 0.55),
    p: ArtPalette = {
      light,
      zenith: [zenith[0] * 0.8, zenith[1] * 0.8, zenith[2] * 0.85],
      horizon,
      sea: kindWater(w.kind)?.sea ?? biomeColor(1, w.kind, w.look),
      ground: biomeColor(7, w.kind, w.look),
      leaf: biomeColor(9, w.kind, w.look),
      ice: biomeColor(4, w.kind, w.look),
      rock: biomeColor(15, w.kind, w.look),
      metal: mix([0.72, 0.74, 0.78], light, 0.25),
      key,
      kind: w.kind,
      ...(w.look ? { look: w.look } : {}),
    };
  PALETTES.set(key, p);
  return p;
}

// —— Glyphs ————————————————————————————————————————————————————————————————————————————————

/** What a glyph draws. */
type Glyph =
  | "eye"
  | "people"
  | "years"
  | "goods"
  | "arms"
  | "crown"
  | "land"
  | "life"
  | "sky"
  | "matter"
  | "words"
  | "coin"
  | "thread"
  | "house"
  | "heal"
  | "bond";

/** A tab's or a section's glyph by its words (none: no glyph). */
const GLYPHS: readonly (readonly [RegExp, Glyph])[] = [
  [/^(overview|here|what|each|listed|rest|measures?)$/, "eye"],
  [/sick|health|wound|heal/, "heal"],
  [/people|folk|famil|lives|leader|court|kin|townsfolk|who|ruler|met\b|crowd/, "people"],
  [/histor|year|story|event|record|first|fallen|course|annal|chronicle|time/, "years"],
  [/credit|debt|wealth|coin|lend|price|cost/, "coin"],
  [/thing|good|store|work|econom|market|trade|road|wares|made|board|compan|exchange/, "goods"],
  [/war|might|defend|attack|side|battle|strife|host|arm/, "arms"],
  [/realm|order|law|crown|reign|nation|bloc|league/, "crown"],
  [/bond|ties|relation|envoy|marriage/, "bond"],
  [/town|building|home|lot|fabric|wall/, "house"],
  [/land|ground|lode|deposit|plate|wood|field/, "land"],
  [/life|wild|herd|beast|species|tree|clade|lineage|ecolog/, "life"],
  [/sky|world|star|orbit|planet|moon|galax|colon/, "sky"],
  [/matter|element|substance|reaction|principle|chem|stuff/, "matter"],
  [/faith|song|tongue|language|memory|word|asks?|answer|justice|case/, "words"],
  [/origin|why|thread|cause/, "thread"],
];

/** The glyph a tab or a section of these words draws, if any. */
export function glyphOf(words: string): Glyph | null {
  const w = words.toLowerCase();
  for (const [re, g] of GLYPHS) if (re.test(w)) return g;
  return null;
}

/** Draw a glyph in the box (x, y, s × s) in a world's colours. */
function drawGlyph(g: CanvasRenderingContext2D, glyph: Glyph, p: ArtPalette, s: number): void {
  const u = s / 16,
    line = (c: Rgb, k = 0.45) => {
      g.strokeStyle = css(c, k, 0.95);
      g.lineWidth = Math.max(1, u);
    };
  g.lineJoin = "round";
  g.lineCap = "round";
  const disc = (x: number, y: number, r: number, c: Rgb, k = 1) => {
    g.beginPath();
    g.arc(x * u, y * u, r * u, 0, Math.PI * 2);
    g.fillStyle = css(c, k);
    g.fill();
  };
  const poly = (pts: readonly number[], c: Rgb, k = 1, stroke = true) => {
    g.beginPath();
    for (let i = 0; i < pts.length; i += 2)
      if (i) g.lineTo(pts[i]! * u, pts[i + 1]! * u);
      else g.moveTo(pts[i]! * u, pts[i + 1]! * u);
    g.closePath();
    g.fillStyle = css(c, k);
    g.fill();
    if (stroke) {
      line(c);
      g.stroke();
    }
  };
  switch (glyph) {
    case "eye": {
      // (The world's light seen: an eye, its iris the sky.)
      g.beginPath();
      g.moveTo(1.5 * u, 8 * u);
      g.quadraticCurveTo(8 * u, 1.5 * u, 14.5 * u, 8 * u);
      g.quadraticCurveTo(8 * u, 14.5 * u, 1.5 * u, 8 * u);
      g.fillStyle = css(mix(p.light, [1, 1, 1], 0.6));
      g.fill();
      line(p.zenith, 0.5);
      g.stroke();
      disc(8, 8, 3.2, p.zenith, 0.9);
      disc(8, 8, 1.4, [0.05, 0.05, 0.08]);
      return;
    }
    case "people": {
      const skin: Rgb = mix([0.86, 0.66, 0.5], p.light, 0.2);
      for (const [x, k, h] of [
        [5.2, 0.85, 1],
        [10.8, 1, 0.85],
      ] as const) {
        disc(x, 4.6 + (1 - h) * 3, 2.4 * h, skin, k);
        poly(
          [
            x - 3.4 * h,
            15,
            x - 2.6 * h,
            8.6 + (1 - h) * 3,
            x + 2.6 * h,
            8.6 + (1 - h) * 3,
            x + 3.4 * h,
            15,
          ],
          x < 8 ? p.leaf : p.sea,
          k,
        );
      }
      return;
    }
    case "years": {
      // (An hourglass, its sand the world's ground.)
      poly([3, 1.5, 13, 1.5, 13, 3, 3, 3], p.rock, 0.8);
      poly([3, 13, 13, 13, 13, 14.5, 3, 14.5], p.rock, 0.8);
      g.beginPath();
      g.moveTo(4 * u, 3 * u);
      g.lineTo(12 * u, 3 * u);
      g.lineTo(8.8 * u, 8 * u);
      g.lineTo(12 * u, 13 * u);
      g.lineTo(4 * u, 13 * u);
      g.lineTo(7.2 * u, 8 * u);
      g.closePath();
      g.fillStyle = css(mix(p.horizon, [1, 1, 1], 0.5), 1, 0.7);
      g.fill();
      line(p.rock, 0.5);
      g.stroke();
      poly([5, 13, 11, 13, 8, 10], p.ground, 1, false);
      poly([6.2, 4.6, 9.8, 4.6, 8, 7], p.ground, 1, false);
      return;
    }
    case "goods": {
      // (A crate of the world's wood, a sack of its ground's colour by it.)
      const wood: Rgb = [0.62, 0.44, 0.26];
      poly([2, 7, 10, 7, 10, 15, 2, 15], wood, 1);
      line(wood, 0.5);
      g.beginPath();
      g.moveTo(2 * u, 11 * u);
      g.lineTo(10 * u, 11 * u);
      g.moveTo(2 * u, 7 * u);
      g.lineTo(10 * u, 15 * u);
      g.stroke();
      g.beginPath();
      g.moveTo(11 * u, 15 * u);
      g.quadraticCurveTo(9.5 * u, 9 * u, 12 * u, 6.5 * u);
      g.lineTo(13.8 * u, 6.5 * u);
      g.quadraticCurveTo(16 * u, 9 * u, 15 * u, 15 * u);
      g.closePath();
      g.fillStyle = css(mix(p.ground, [0.9, 0.85, 0.7], 0.4));
      g.fill();
      line(p.ground);
      g.stroke();
      return;
    }
    case "arms": {
      // (Two blades crossed, of the metal its light shines on.)
      for (const s0 of [1, -1]) {
        g.save();
        g.translate(8 * u, 8 * u);
        g.rotate(s0 * 0.78);
        poly([-1, -7.5, 1, -7.5, 1, 4, 0, 5.4, -1, 4], p.metal, 1);
        g.restore();
        g.save();
        g.translate(8 * u, 8 * u);
        g.rotate(s0 * 0.78);
        g.fillStyle = css([0.5, 0.32, 0.18]);
        g.fillRect(-0.9 * u, 4.6 * u, 1.8 * u, 2.8 * u);
        g.fillStyle = css(p.light, 0.85);
        g.fillRect(-2.6 * u, 4 * u, 5.2 * u, 1.1 * u);
        g.restore();
      }
      return;
    }
    case "crown": {
      const gold: Rgb = mix([0.96, 0.78, 0.26], p.light, 0.2);
      poly([2, 13, 2, 5, 5.2, 9, 8, 3.2, 10.8, 9, 14, 5, 14, 13], gold, 1);
      disc(8, 10.6, 1.3, p.sea);
      disc(4.4, 11, 0.9, p.leaf);
      disc(11.6, 11, 0.9, p.leaf);
      return;
    }
    case "land": {
      // (Hills under its sky, its sea at their foot.)
      g.fillStyle = css(p.horizon);
      g.fillRect(1 * u, 2 * u, 14 * u, 12 * u);
      poly([1, 14, 1, 9, 5, 5, 8.5, 8.5, 11, 6, 15, 10, 15, 14], p.leaf, 0.95, false);
      poly([1, 14, 1, 11, 6, 9.4, 10, 12, 15, 11.4, 15, 14], p.ground, 1, false);
      g.fillStyle = css(p.sea);
      g.fillRect(1 * u, 12.6 * u, 14 * u, 1.6 * u);
      g.strokeStyle = css(p.rock, 0.5, 0.9);
      g.lineWidth = Math.max(1, u);
      g.strokeRect(1 * u, 2 * u, 14 * u, 12 * u);
      return;
    }
    case "life": {
      // (A leaf of what grows there.)
      g.beginPath();
      g.moveTo(2.5 * u, 13.5 * u);
      g.bezierCurveTo(2 * u, 5 * u, 7 * u, 2 * u, 14 * u, 2 * u);
      g.bezierCurveTo(14 * u, 9 * u, 10 * u, 14 * u, 2.5 * u, 13.5 * u);
      g.fillStyle = css(p.leaf, 1.1);
      g.fill();
      line(p.leaf, 0.5);
      g.stroke();
      g.beginPath();
      g.moveTo(2.5 * u, 13.5 * u);
      g.quadraticCurveTo(8 * u, 9 * u, 12.5 * u, 3.5 * u);
      g.stroke();
      return;
    }
    case "sky": {
      // (Its star, and a world going round it.)
      const glow = g.createRadialGradient(6 * u, 6 * u, 0, 6 * u, 6 * u, 6 * u);
      glow.addColorStop(0, css([1, 1, 1]));
      glow.addColorStop(0.45, css(p.light));
      glow.addColorStop(1, css(p.light, 1, 0));
      g.fillStyle = glow;
      g.fillRect(0, 0, 12 * u, 12 * u);
      g.beginPath();
      g.ellipse(8 * u, 8.5 * u, 7 * u, 3 * u, -0.35, 0, Math.PI * 2);
      g.strokeStyle = css(p.zenith, 1, 0.8);
      g.lineWidth = Math.max(1, u * 0.8);
      g.stroke();
      disc(13.4, 11.4, 2.2, p.sea);
      disc(12.9, 10.8, 0.9, p.leaf);
      return;
    }
    case "matter": {
      // (A flask of its seas' liquid.)
      g.beginPath();
      g.moveTo(6.2 * u, 1.5 * u);
      g.lineTo(9.8 * u, 1.5 * u);
      g.lineTo(9.8 * u, 6 * u);
      g.lineTo(14 * u, 14.5 * u);
      g.lineTo(2 * u, 14.5 * u);
      g.lineTo(6.2 * u, 6 * u);
      g.closePath();
      g.fillStyle = css(mix(p.horizon, [1, 1, 1], 0.6), 1, 0.65);
      g.fill();
      poly([4.3, 10, 11.7, 10, 14, 14.5, 2, 14.5], p.sea, 1.2, false);
      g.beginPath();
      g.moveTo(6.2 * u, 1.5 * u);
      g.lineTo(9.8 * u, 1.5 * u);
      g.lineTo(9.8 * u, 6 * u);
      g.lineTo(14 * u, 14.5 * u);
      g.lineTo(2 * u, 14.5 * u);
      g.lineTo(6.2 * u, 6 * u);
      g.closePath();
      line(p.rock, 0.55);
      g.stroke();
      disc(7, 12.4, 0.8, mix(p.sea, [1, 1, 1], 0.6));
      return;
    }
    case "words": {
      // (A scroll, written.)
      const page: Rgb = mix([0.92, 0.86, 0.7], p.light, 0.25);
      poly([3, 2.5, 13, 2.5, 13, 13.5, 3, 13.5], page, 1);
      line(p.rock, 0.4);
      for (const y of [5.4, 8, 10.6]) {
        g.beginPath();
        g.moveTo(5 * u, y * u);
        g.lineTo((y === 10.6 ? 8.6 : 11) * u, y * u);
        g.stroke();
      }
      disc(3, 2.5, 1.4, p.ground, 0.8);
      disc(13, 13.5, 1.4, p.ground, 0.8);
      return;
    }
    case "coin": {
      const gold: Rgb = mix([0.94, 0.76, 0.3], p.light, 0.2);
      disc(6, 10, 4.6, gold, 0.75);
      disc(10, 6.5, 4.8, gold, 1);
      g.beginPath();
      g.arc(10 * u, 6.5 * u, 3.2 * u, 0, Math.PI * 2);
      line(gold, 0.55);
      g.stroke();
      return;
    }
    case "thread": {
      // (A line back: a spiral from its middle out.)
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i * 0.42,
          r = 0.3 + i * 0.17;
        const x = 8 + Math.cos(a) * r,
          y = 8 + Math.sin(a) * r;
        if (i) g.lineTo(x * u, y * u);
        else g.moveTo(x * u, y * u);
      }
      g.strokeStyle = css(p.leaf, 0.8);
      g.lineWidth = Math.max(1, 1.4 * u);
      g.stroke();
      disc(8, 8, 1.4, p.light);
      return;
    }
    case "house": {
      poly([2.5, 8, 8, 2.5, 13.5, 8], [0.66, 0.3, 0.2], 1);
      poly([3.5, 8, 12.5, 8, 12.5, 14.5, 3.5, 14.5], mix([0.86, 0.78, 0.6], p.light, 0.2), 1);
      g.fillStyle = css(mix(p.light, [1, 0.9, 0.5], 0.5));
      g.fillRect(5 * u, 9.5 * u, 2.4 * u, 2.4 * u);
      g.fillStyle = css([0.4, 0.26, 0.16]);
      g.fillRect(9 * u, 10 * u, 2.4 * u, 4.5 * u);
      return;
    }
    case "heal": {
      poly(
        [6, 2, 10, 2, 10, 6, 14, 6, 14, 10, 10, 10, 10, 14, 6, 14, 6, 10, 2, 10, 2, 6, 6, 6],
        [0.84, 0.18, 0.2],
        1,
      );
      return;
    }
    case "bond": {
      for (const [x, c] of [
        [6, p.sea],
        [10, p.leaf],
      ] as const) {
        g.beginPath();
        g.arc(x * u, 8 * u, 3.8 * u, 0, Math.PI * 2);
        g.strokeStyle = css(c, 0.9);
        g.lineWidth = Math.max(1.2, 1.8 * u);
        g.stroke();
      }
      return;
    }
  }
}

const GLYPH_CACHE = new Map<string, HTMLCanvasElement>();

/** A glyph as a small canvas of `size` CSS pixels, drawn once a world's colours and copied after. */
export function glyphCanvas(glyph: Glyph, p: ArtPalette, size: number): HTMLCanvasElement {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1),
    key = `${glyph}|${p.key}|${size}|${dpr}`;
  let kept = GLYPH_CACHE.get(key);
  if (!kept) {
    kept = document.createElement("canvas");
    const g = surface(kept, size, size);
    drawGlyph(g, glyph, p, size);
    GLYPH_CACHE.set(key, kept);
  }
  const c = document.createElement("canvas");
  c.className = "art-glyph";
  c.width = kept.width;
  c.height = kept.height;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  c.dataset.glyph = glyph;
  c.setAttribute("aria-hidden", "true");
  c.getContext("2d")?.drawImage(kept, 0, 0);
  return c;
}

// —— A section's own numbers ————————————————————————————————————————————————————————————————

/** A section's glyph drawn of its own numbers (a chart's run, a breakdown's shares, bars), else by its title's words; none: neither. */
export function sectionGlyph(b: Block, p: ArtPalette, size = 16): HTMLCanvasElement | null {
  const run =
    b.type === "chart"
      ? b.points.map((q) => q.y)
      : b.type === "lines"
        ? (b.series[0]?.points.map((q) => q.y) ?? [])
        : null;
  if (run && run.length > 1) {
    const c = document.createElement("canvas"),
      w = size * 1.75,
      g = surface(c, w, size);
    c.className = "art-glyph art-spark";
    c.setAttribute("aria-hidden", "true");
    const lo = Math.min(...run),
      hi = Math.max(...run),
      n = Math.min(run.length, 40),
      at = (i: number) => run[Math.floor((i / (n - 1)) * (run.length - 1))]!,
      y = (v: number) => size - 2 - ((v - lo) / Math.max(1e-9, hi - lo)) * (size - 4);
    g.beginPath();
    g.moveTo(1, size - 1);
    for (let i = 0; i < n; i++) g.lineTo(1 + (i / (n - 1)) * (w - 2), y(at(i)));
    g.lineTo(w - 1, size - 1);
    g.closePath();
    g.fillStyle = css(p.leaf, 1, 0.35);
    g.fill();
    g.beginPath();
    for (let i = 0; i < n; i++)
      if (i) g.lineTo(1 + (i / (n - 1)) * (w - 2), y(at(i)));
      else g.moveTo(1, y(at(0)));
    const rising = run[run.length - 1]! >= run[0]!;
    g.strokeStyle = css(rising ? p.leaf : [0.8, 0.3, 0.22], rising ? 0.8 : 1);
    g.lineWidth = 1.4;
    g.stroke();
    return c;
  }
  const shares =
    b.type === "composition"
      ? b.parts.map((x) => [x.share, x.color] as const)
      : b.type === "bars"
        ? b.bars.slice(0, 6).map((x) => [Math.max(0, x.value), x.color ?? p.sea] as const)
        : null;
  if (shares && shares.length) {
    const c = document.createElement("canvas"),
      g = surface(c, size, size);
    c.className = "art-glyph art-shares";
    c.setAttribute("aria-hidden", "true");
    const total = shares.reduce((s, x) => s + x[0], 0) || 1;
    if (b.type === "composition") {
      // (Its shares round a ring.)
      let a = -Math.PI / 2;
      for (const [share, color] of shares) {
        const da = (share / total) * Math.PI * 2;
        g.beginPath();
        g.moveTo(size / 2, size / 2);
        g.arc(size / 2, size / 2, size / 2 - 1, a, a + da);
        g.closePath();
        g.fillStyle = css(color);
        g.fill();
        a += da;
      }
      g.beginPath();
      g.arc(size / 2, size / 2, size * 0.2, 0, Math.PI * 2);
      g.fillStyle = css(p.horizon);
      g.fill();
    } else {
      const top = Math.max(...shares.map((x) => x[0])) || 1,
        bw = (size - 2) / shares.length;
      shares.forEach(([v, color], i) => {
        const h = Math.max(1, (v / top) * (size - 2));
        g.fillStyle = css(color);
        g.fillRect(1 + i * bw, size - 1 - h, Math.max(1, bw - 1), h);
      });
    }
    return c;
  }
  const words = "title" in b && typeof b.title === "string" ? b.title : "",
    glyph = words ? glyphOf(words) : null;
  return glyph ? glyphCanvas(glyph, p, size) : null;
}

// —— Banners ———————————————————————————————————————————————————————————————————————————————

/** A sky in a world's light, its star low in it, from the top of the box to `ground`. */
function sky(g: CanvasRenderingContext2D, p: ArtPalette, w: number, h: number, sun: number): void {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, css(p.zenith));
  grad.addColorStop(1, css(p.horizon));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const x = w * sun,
    y = h * 0.34,
    r = h * 0.11,
    glow = g.createRadialGradient(x, y, r * 0.4, x, y, r * 5);
  glow.addColorStop(0, css(p.light, 1, 0.8));
  glow.addColorStop(1, css(p.light, 1, 0));
  g.fillStyle = glow;
  g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = css(mix(p.light, [1, 1, 1], 0.55));
  g.fill();
}

/** A person as their figure, standing with their feet at (x, y), `h` tall. */
function figure(
  g: CanvasRenderingContext2D,
  person: Extract<Portrait, { kind: "person" }>,
  x: number,
  y: number,
  h: number,
  turn: number,
): void {
  drawSolids(g, personSolids(person), { turn, tilt: 0.1 }, { x: x - h / 2, y: y - h, w: h, h });
}

/** A people's figures, as a banner stands them: of their body and their land's age. */
function folkFigures(
  folk: readonly BannerFigure[],
  body: Extract<Portrait, { kind: "person" }>["body"],
  era: Extract<Portrait, { kind: "person" }>["era"],
  ref: string,
): Extract<Portrait, { kind: "person" }>[] {
  return folk.map((f, i) => ({
    kind: "person",
    ref: `${ref}#${i}`,
    age: f.age,
    span: body?.span ?? 70,
    occupation: f.occupation,
    child: f.child,
    era,
    body,
  }));
}

/** A run of numbers smoothed through, `n` long (each a mean of the two it falls between). */
function resample(v: readonly number[], n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (v.length - 1),
      a = Math.floor(t),
      b = Math.min(v.length - 1, a + 1),
      f = t - a,
      s = f * f * (3 - 2 * f);
    out.push(v[a]! + (v[b]! - v[a]!) * s);
  }
  return out;
}

function landBanner(
  g: CanvasRenderingContext2D,
  b: Extract<PageBanner, { kind: "land" }>,
  p: ArtPalette,
  w: number,
  h: number,
  ref: string,
): void {
  const next = stream(b.key);
  sky(g, p, w, h, 0.18 + next() * 0.64);
  const n = Math.max(24, Math.round(w / 4)),
    base = resample(b.heights, n),
    // (Its ground's own roughness, keyed: a few hundred metres up and down within each stretch.)
    rough = base.map((_, i) => Math.sin(i * 0.9 + next() * 6) * 40 + (next() - 0.5) * 70),
    hi = Math.max(800, ...base.map((v) => Math.abs(v))),
    seaY = h * 0.72,
    y = (v: number) => seaY - (Math.max(-hi * 0.25, v) / hi) * h * 0.5,
    xs = (i: number) => (i / (n - 1)) * w;
  // A far ridge: the same ground, higher and paler, a little to the east.
  g.beginPath();
  g.moveTo(0, h);
  for (let i = 0; i < n; i++)
    g.lineTo(xs(i), y(Math.max(0, base[(i + 5) % n]!) * 1.25 + 200) - h * 0.08);
  g.lineTo(w, h);
  g.closePath();
  g.fillStyle = css(mix(p.rock, p.horizon, 0.55));
  g.fill();
  // Its seas, at their level.
  g.fillStyle = css(p.sea);
  g.fillRect(0, seaY, w, h - seaY);
  g.fillStyle = css(mix(p.sea, p.light, 0.35), 1, 0.6);
  g.fillRect(0, seaY, w, 1);
  // Its ground, each stretch in its biome's colour.
  const stretch = (i: number) =>
    b.biomes[Math.min(b.biomes.length - 1, Math.floor((i / n) * b.biomes.length))]!;
  for (let i = 0; i < n - 1; i++) {
    const v0 = base[i]! + rough[i]!,
      v1 = base[i + 1]! + rough[i + 1]!;
    if (v0 < 0 && v1 < 0) continue;
    const c = biomeColor(stretch(i), p.kind, p.look);
    g.beginPath();
    g.moveTo(xs(i), y(v0));
    g.lineTo(xs(i + 1) + 0.6, y(v1));
    g.lineTo(xs(i + 1) + 0.6, h);
    g.lineTo(xs(i), h);
    g.closePath();
    g.fillStyle = css(c, 0.92 + 0.12 * Math.sin(i * 1.7));
    g.fill();
    // (Snow where it stands high and cold.)
    if (Math.max(v0, v1) > hi * 0.72) {
      g.beginPath();
      g.moveTo(xs(i), y(v0));
      g.lineTo(xs(i + 1) + 0.6, y(v1));
      g.lineTo(xs(i + 1) + 0.6, y(v1) + 3);
      g.lineTo(xs(i), y(v0) + 3);
      g.fillStyle = css(p.ice);
      g.fill();
    }
  }
  const groundAt = (x: number) => {
    const i = clamp(Math.round((x / w) * (n - 1)), 0, n - 1);
    return { v: base[i]! + rough[i]!, y: y(base[i]! + rough[i]!), biome: stretch(i) };
  };
  // Its woods: as many trees as its share of woods, where it is land.
  const trees = Math.round(b.woods * w * 0.12);
  for (let t = 0; t < trees; t++) {
    const x = next() * w,
      at = groundAt(x);
    if (at.v < 5) continue;
    const s = h * (0.07 + next() * 0.05),
      conifer = at.biome === 6 || at.biome === 5 || at.biome === 15,
      leaf = mix(p.leaf, [0, 0, 0], 0.15 + next() * 0.2);
    g.fillStyle = css([0.36, 0.24, 0.14]);
    g.fillRect(x - 0.6, at.y - s * 0.4, 1.2, s * 0.45);
    g.beginPath();
    if (conifer) {
      g.moveTo(x, at.y - s * 1.3);
      g.lineTo(x + s * 0.4, at.y - s * 0.3);
      g.lineTo(x - s * 0.4, at.y - s * 0.3);
      g.closePath();
    } else g.arc(x, at.y - s * 0.75, s * 0.42, 0, Math.PI * 2);
    g.fillStyle = css(leaf);
    g.fill();
  }
  // Its home and its people, where it has them, standing at the land itself.
  const hx = w * b.here,
    spot = groundAt(hx),
    standY = Math.max(spot.y, h * 0.42);
  if (b.house && spot.v >= 0) {
    const look = houseLook(b.house, p.look),
      hw = h * 0.3 * look.length,
      hh = look.tent ? 0 : h * 0.16 * look.height,
      rise = Math.max(2, look.rise * hw * 0.32);
    g.fillStyle = css(look.wall);
    g.fillRect(hx - hw / 2, standY - hh, hw, hh);
    g.beginPath();
    if (look.round || look.tent) {
      g.moveTo(hx - hw * 0.56, standY - hh);
      g.quadraticCurveTo(hx, standY - hh - rise * 2.2, hx + hw * 0.56, standY - hh);
    } else {
      g.moveTo(hx - hw * 0.58, standY - hh);
      g.lineTo(hx, standY - hh - rise);
      g.lineTo(hx + hw * 0.58, standY - hh);
    }
    g.closePath();
    g.fillStyle = css(look.roof);
    g.fill();
    g.strokeStyle = css(look.roof, 0.6);
    g.lineWidth = 1;
    g.stroke();
    if (!look.tent) {
      g.fillStyle = css([0.25, 0.16, 0.1]);
      g.fillRect(hx - hw * 0.08, standY - hh * 0.62, hw * 0.16, hh * 0.62);
    }
  }
  if (spot.v >= 0) {
    const people = folkFigures(b.folk, b.body, b.era, ref),
      fh = h * 0.42;
    people.forEach((person, i) => {
      const fx = hx + (b.house ? h * 0.36 : 0) + (i - (people.length - 1) / 2) * fh * 0.5,
        fy = Math.max(groundAt(fx).y, h * 0.42);
      figure(g, person, fx, fy + 1, person.child ? fh * 0.66 : fh, 0.3 + i * 0.5);
    });
  }
}

/** A building of a town's skyline: how wide and tall, how it is roofed, its colours. */
type Tower = {
  w: number;
  h: number;
  roof: "gable" | "flat" | "dome" | "spire" | "stack" | "sails" | "crane" | "arch" | "torus";
  wall: Rgb;
  top: Rgb;
  lit: boolean;
};

/** Each other building's outline, as its kind is built (width and height in storeys' heights). */
const CIVIC_SHAPE: Readonly<Record<string, readonly [number, number, Tower["roof"]]>> = {
  shrine: [1, 1.2, "gable"],
  granary: [1, 1.6, "dome"],
  kiln: [0.9, 1, "stack"],
  smithy: [1.2, 1, "stack"],
  market: [2.6, 1, "gable"],
  mill: [1, 2, "sails"],
  temple: [1.8, 3, "spire"],
  hall: [2.2, 2, "gable"],
  school: [1.8, 1.6, "gable"],
  workshop: [1.4, 1.2, "flat"],
  docks: [1.6, 1.4, "crane"],
  academy: [2, 2.2, "dome"],
  baths: [1.8, 1.3, "dome"],
  observatory: [1.2, 2, "dome"],
  hospital: [2, 2.4, "flat"],
  factory: [2.6, 1.8, "stack"],
  station: [2.8, 1.6, "arch"],
  power: [1.8, 2.2, "stack"],
  offices: [1.4, 8, "flat"],
  fusion: [2, 1.8, "torus"],
  minds: [1.4, 6, "spire"],
  vats: [1.8, 1.4, "dome"],
};
const CONCRETE: Rgb = [0.7, 0.7, 0.72],
  GLASS: Rgb = [0.42, 0.56, 0.68];

function townBanner(
  g: CanvasRenderingContext2D,
  b: Extract<PageBanner, { kind: "town" }>,
  p: ArtPalette,
  w: number,
  h: number,
): void {
  const next = stream(b.key);
  sky(g, p, w, h, 0.12 + next() * 0.76);
  const groundY = h * 0.86,
    look = houseLook(b.house, p.look),
    storey = h * 0.07,
    homes = b.levels.reduce((s, v) => s + v, 0);
  // (As many homes drawn as the skyline holds, each level as often as it stands.)
  const room = Math.round(w / (h * 0.16)),
    shown = Math.min(room, Math.max(3, homes)),
    towers: Tower[] = [];
  const pick = () => {
    let r = next() * homes;
    for (let l = 0; l < b.levels.length; l++) {
      r -= b.levels[l]!;
      if (r < 0) return l;
    }
    return 0;
  };
  const STOREYS = [1, 1, 3, 5, 10, 24, 60];
  for (let i = 0; i < shown; i++) {
    const level = homes ? pick() : 0,
      tall = level >= 3,
      storeys = STOREYS[level]! * (0.8 + next() * 0.4);
    towers.push({
      w:
        h *
        (level >= 4 ? 0.2 : level >= 2 ? 0.16 : 0.13) *
        (0.85 + next() * 0.3) *
        (look.length / 0.7) ** 0.4,
      h: Math.min(
        h * 0.8,
        storey * (level >= 4 ? storeys ** 0.62 * 2 : storeys) * (look.tent ? 0.7 : look.height) +
          storey * 0.4,
      ),
      roof: tall ? "flat" : look.round || look.tent ? "dome" : look.rise < 0.15 ? "flat" : "gable",
      wall: tall ? mix(level >= 5 ? GLASS : CONCRETE, p.light, 0.12) : look.wall,
      top: tall ? mix(CONCRETE, [0, 0, 0], 0.2) : look.roof,
      lit: level >= 2,
    });
  }
  // Its other buildings, among them.
  for (const kind of b.civics) {
    const s = CIVIC_SHAPE[kind];
    if (!s) continue;
    const at = Math.floor(next() * (towers.length + 1));
    towers.splice(at, 0, {
      w: h * 0.12 * s[0],
      h: Math.min(h * 0.82, storey * s[1] * 1.3),
      roof: s[2],
      wall:
        kind === "temple" || kind === "shrine"
          ? mix([0.9, 0.86, 0.76], p.light, 0.15)
          : mix(CONCRETE, look.wall, 0.5),
      top:
        kind === "temple" || kind === "academy" || kind === "observatory"
          ? mix([0.86, 0.7, 0.3], p.light, 0.2)
          : look.roof,
      lit: false,
    });
  }
  // (Fitted to the banner's width, the widest last to give way.)
  const total = towers.reduce((s, t) => s + t.w, 0) + towers.length * 1.5,
    k = Math.min(1, (w * 0.96) / Math.max(1, total));
  let x = (w - total * k) / 2;
  // Its far half first: the same skyline paler behind.
  g.fillStyle = css(mix(p.rock, p.horizon, 0.6));
  for (const t of towers) {
    const tw = t.w * k * 0.8;
    g.fillRect(x + tw * 0.6, groundY - t.h * 0.7 - 4, tw, t.h * 0.7 + 4);
    x += (t.w + 1.5) * k;
  }
  g.fillStyle = css(biomeColor(b.biome, p.kind, p.look));
  g.fillRect(0, groundY, w, h - groundY);
  x = (w - total * k) / 2;
  for (const t of towers) {
    const tw = t.w * k,
      top = groundY - t.h;
    g.fillStyle = css(t.wall);
    g.fillRect(x, top, tw, t.h);
    g.strokeStyle = css(t.wall, 0.55);
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, top + 0.5, tw - 1, t.h - 1);
    // (Its windows lit with its world's light where it stands three storeys and more.)
    if (t.lit && tw > 4) {
      g.fillStyle = css(mix(p.light, [1, 0.86, 0.5], 0.5), 1, 0.85);
      for (let wy = top + 3; wy < groundY - 3; wy += storey * 0.7)
        for (let wx = x + 2; wx < x + tw - 2.5; wx += 3.2)
          if (next() < 0.55) g.fillRect(wx, wy, 1.4, 1.6);
    }
    g.fillStyle = css(t.top);
    g.strokeStyle = css(t.top, 0.55);
    switch (t.roof) {
      case "gable":
        g.beginPath();
        g.moveTo(x - 1, top);
        g.lineTo(x + tw / 2, top - Math.max(2, tw * 0.45 * Math.max(0.3, look.rise)));
        g.lineTo(x + tw + 1, top);
        g.closePath();
        g.fill();
        g.stroke();
        break;
      case "dome":
        g.beginPath();
        g.arc(x + tw / 2, top, tw / 2, Math.PI, 0);
        g.fill();
        g.stroke();
        break;
      case "spire":
        g.beginPath();
        g.moveTo(x + tw * 0.3, top);
        g.lineTo(x + tw / 2, top - t.h * 0.5);
        g.lineTo(x + tw * 0.7, top);
        g.closePath();
        g.fill();
        g.stroke();
        break;
      case "stack": {
        g.fillRect(x + tw * 0.65, top - t.h * 0.5, tw * 0.16, t.h * 0.5);
        // (Its smoke, drifting as its world's air carries it.)
        for (let s = 0; s < 4; s++) {
          g.beginPath();
          g.arc(
            x + tw * 0.73 + s * 3,
            top - t.h * 0.5 - 2 - s * 2.6,
            1.6 + s * 0.7,
            0,
            Math.PI * 2,
          );
          g.fillStyle = css(mix(p.horizon, [0.4, 0.4, 0.42], 0.5), 1, 0.55 - s * 0.1);
          g.fill();
        }
        break;
      }
      case "sails": {
        const cx = x + tw / 2,
          cy = top + 2;
        g.strokeStyle = css([0.4, 0.3, 0.2]);
        g.lineWidth = 1.4;
        for (let s = 0; s < 4; s++) {
          const a = s * (Math.PI / 2) + 0.4;
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(a) * t.h * 0.5, cy + Math.sin(a) * t.h * 0.5);
          g.stroke();
        }
        g.lineWidth = 1;
        break;
      }
      case "crane":
        g.strokeStyle = css([0.5, 0.3, 0.16]);
        g.beginPath();
        g.moveTo(x + tw * 0.2, top);
        g.lineTo(x + tw * 0.2, top - t.h * 0.7);
        g.lineTo(x + tw * 1.1, top - t.h * 0.6);
        g.lineTo(x + tw * 1.1, top - t.h * 0.2);
        g.stroke();
        break;
      case "arch":
        g.beginPath();
        g.ellipse(x + tw / 2, top, tw / 2, Math.max(2, t.h * 0.3), 0, Math.PI, 0);
        g.fill();
        g.stroke();
        break;
      case "torus":
        g.beginPath();
        g.ellipse(x + tw / 2, top - 3, tw * 0.45, 3, 0, 0, Math.PI * 2);
        g.lineWidth = 2.4;
        g.strokeStyle = css(mix(p.light, [1, 1, 1], 0.4));
        g.stroke();
        g.lineWidth = 1;
        break;
      case "flat":
        g.fillRect(x - 0.5, top - 1.5, tw + 1, 1.5);
        break;
    }
    x += (t.w + 1.5) * k;
  }
  // Its walls, where it has them, before it all.
  if (b.walls) {
    const wallY = groundY - h * 0.1,
      stone: Rgb = mix(p.rock, [0.72, 0.68, 0.6], 0.5);
    g.fillStyle = css(stone);
    g.fillRect(0, wallY, w, groundY - wallY + 1);
    for (let cx = 0; cx < w; cx += 6) g.fillRect(cx, wallY - 3, 3.4, 3);
    g.strokeStyle = css(stone, 0.6);
    g.beginPath();
    g.moveTo(0, wallY + 0.5);
    g.lineTo(w, wallY + 0.5);
    g.stroke();
  }
}

function realmBanner(
  g: CanvasRenderingContext2D,
  b: Extract<PageBanner, { kind: "realm" }>,
  p: ArtPalette,
  w: number,
  h: number,
): void {
  const field = b.arms.field[0],
    metal = b.arms.field[1];
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, css(mix(p.sea, [0, 0, 0], 0.25)));
  grad.addColorStop(1, css(mix(p.sea, p.light, 0.3)));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // Its lands, as they lie: each a round land's breadth, its edge dark, its seat a star of its metal.
  const box = { x: h * 1.05, y: 4, w: w - h * 1.05 - 6, h: h - 8 },
    k = Math.min(box.w, box.h) / 1000,
    ox = box.x + box.w / 2 - 500 * k,
    oy = box.y + box.h / 2 - 500 * k,
    r = Math.max(1.6, b.step * k * 0.62);
  for (const [pass, color, grow] of [
    [0, mix(field, [0, 0, 0], 0.55), 1.4],
    [1, field, 0],
  ] as const) {
    void pass;
    g.fillStyle = css(color);
    g.beginPath();
    for (let i = 0; i < b.lands.length; i += 2) {
      const x = ox + b.lands[i]! * k,
        y = oy + b.lands[i + 1]! * k;
      g.moveTo(x + r + grow, y);
      g.arc(x, y, r + grow, 0, Math.PI * 2);
    }
    g.fill();
  }
  if (b.lands.length >= 2) {
    const x = ox + b.lands[0]! * k,
      y = oy + b.lands[1]! * k,
      s = Math.max(3, r * 1.1);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        rr = i % 2 ? s * 0.45 : s;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = css(metal);
    g.fill();
    g.strokeStyle = css(metal, 0.4);
    g.lineWidth = 1;
    g.stroke();
  }
  drawArms(g, b.arms, h * 0.12, h * 0.08, h * 0.76, h * 0.84);
}

/** A side's banner on its pole, its arms on its cloth, flying toward the middle. */
function flag(
  g: CanvasRenderingContext2D,
  arms: Extract<PageBanner, { kind: "war" }>["sides"][number]["arms"],
  pole: number,
  way: 1 | -1,
  h: number,
): void {
  const top = h * 0.12,
    fw = h * 0.82,
    fh = h * 0.5;
  g.fillStyle = css([0.36, 0.25, 0.16]);
  g.fillRect(pole - 1, top - 2, 2.2, h * 0.84);
  g.beginPath();
  g.moveTo(pole, top);
  for (let i = 0; i <= 8; i++) g.lineTo(pole + way * (i / 8) * fw, top + Math.sin(i * 0.8) * 2.4);
  for (let i = 8; i >= 0; i--)
    g.lineTo(pole + way * (i / 8) * fw, top + fh + Math.sin(i * 0.8) * 2.4);
  g.closePath();
  g.fillStyle = css(arms.field[0]);
  g.fill();
  g.strokeStyle = css(arms.field[0], 0.5);
  g.lineWidth = 1;
  g.stroke();
  const s = fh * 0.8;
  drawArms(g, arms, pole + way * fw * 0.5 - s * 0.42, top + fh * 0.1, s * 0.84, s);
}

function warBanner(
  g: CanvasRenderingContext2D,
  b: Extract<PageBanner, { kind: "war" }>,
  p: ArtPalette,
  w: number,
  h: number,
): void {
  sky(g, { ...p, horizon: mix(p.horizon, [0.55, 0.5, 0.46], 0.35) }, w, h, 0.5);
  const groundY = h * 0.84;
  g.fillStyle = css(biomeColor(b.biome, p.kind, p.look), 0.9);
  g.fillRect(0, groundY, w, h - groundY);
  // (The smoke of the field between them.)
  const next = stream(b.sides.length * 977 + Math.round(w));
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    g.arc(
      w * (0.3 + next() * 0.4),
      groundY - next() * h * 0.35,
      h * (0.06 + next() * 0.08),
      0,
      Math.PI * 2,
    );
    g.fillStyle = css([0.62, 0.6, 0.58], 1, 0.22);
    g.fill();
  }
  const [a, d] = b.sides;
  if (a) flag(g, a.arms, w * 0.08, 1, h);
  if (d) flag(g, d.arms, w * 0.92, -1, h);
  // Each host's arm, leant toward the other's.
  for (const [side, x, turn] of [
    [a, w * 0.36, -0.5],
    [d, w * 0.64, 0.5],
  ] as const) {
    if (!side?.arm) continue;
    const s = h * 0.78;
    g.save();
    g.translate(x, groundY - s * 0.42);
    g.rotate(turn);
    drawSpecimen(g, side.arm, { x: -s / 2, y: -s / 2, w: s, h: s }, 0, "coarse");
    g.restore();
  }
}

function worldBanner(
  g: CanvasRenderingContext2D,
  star: number,
  portrait: Portrait | undefined,
  w: number,
  h: number,
  key: number,
): void {
  g.fillStyle = "#04050c";
  g.fillRect(0, 0, w, h);
  const next = stream(key);
  for (let i = 0; i < w / 6; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + next() * 0.6})`;
    g.fillRect(next() * w, next() * h, 1, 1);
  }
  const light = starColor(star),
    x = w * 0.14,
    y = h * 0.5,
    r = h * 0.18,
    glow = g.createRadialGradient(x, y, r * 0.3, x, y, r * 4);
  glow.addColorStop(0, css(light, 1, 0.9));
  glow.addColorStop(1, css(light, 1, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, x + r * 4, h);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = css(mix(light, [1, 1, 1], 0.5));
  g.fill();
  // Its world, lit from its star's side: its limb rising at the right.
  if (portrait?.kind === "world") {
    const pr = h * 1.2,
      cx = w - h * 0.7,
      cy = h * 1.25,
      sea: Rgb = portrait.sea > 0.3 ? [0.14, 0.34, 0.66] : [0.56, 0.46, 0.36],
      body = g.createRadialGradient(cx - pr * 0.6, cy - pr * 0.7, pr * 0.1, cx, cy, pr);
    body.addColorStop(0, css(mix(sea, light, 0.35), 1.15));
    body.addColorStop(0.75, css(sea));
    body.addColorStop(1, css(sea, 0.35));
    g.beginPath();
    g.arc(cx, cy, pr, 0, Math.PI * 2);
    g.fillStyle = body;
    g.fill();
    if (portrait.ice > 0.3) {
      g.save();
      g.clip();
      g.fillStyle = "rgba(240,246,255,0.75)";
      g.fillRect(cx - pr, cy - pr, pr * 2, pr * portrait.ice * 0.35);
      g.restore();
    }
    if (portrait.green > 0) {
      g.save();
      g.beginPath();
      g.arc(cx, cy, pr, 0, Math.PI * 2);
      g.clip();
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.ellipse(
          cx - pr + next() * pr * 2,
          cy - pr * (0.55 + next() * 0.4),
          pr * 0.18,
          pr * 0.07,
          next(),
          0,
          Math.PI * 2,
        );
        g.fillStyle = css([0.3, 0.52, 0.24], 1, 0.6 * portrait.green + 0.2);
        g.fill();
      }
      g.restore();
    }
    if (portrait.air) {
      g.beginPath();
      g.arc(cx, cy, pr * 1.02, 0, Math.PI * 2);
      g.strokeStyle = css(mix([0.55, 0.75, 1], light, 0.3), 1, 0.55);
      g.lineWidth = 3;
      g.stroke();
    }
  }
}

function peopleBanner(
  g: CanvasRenderingContext2D,
  b: Extract<PageBanner, { kind: "people" }>,
  portrait: Portrait | undefined,
  w: number,
  h: number,
  ref: string,
): void {
  const p = paletteOf({ kind: "rocky", star: b.star });
  sky(g, p, w, h, 0.85);
  const groundY = h * 0.86;
  g.fillStyle = css(biomeColor(b.biome));
  g.fillRect(0, groundY, w, h - groundY);
  if (portrait?.kind !== "person") return;
  const ages = [34, 8, 22, 61, 15] as const,
    n = Math.min(5, Math.max(3, Math.floor(w / (h * 0.62)))),
    fh = h * 0.72;
  for (let i = 0; i < n; i++) {
    const age = ages[i % ages.length]!,
      child = age < 12;
    figure(
      g,
      { ...portrait, ref: `${ref}#${i}`, age, child, occupation: child ? 0 : 1 + (i % 3) },
      w * ((i + 0.6) / (n + 0.2)),
      groundY + 1,
      child ? fh * 0.64 : age < 18 ? fh * 0.86 : fh,
      0.3 + i * 0.55,
    );
  }
}

/** The banner of a page, drawn into a canvas `w` × `h` CSS pixels. */
export function drawBanner(
  canvas: HTMLCanvasElement,
  art: PageArt,
  banner: PageBanner,
  portrait: Portrait | undefined,
  ref: string,
  w: number,
  h: number,
): void {
  const g = surface(canvas, w, h),
    p = paletteOf(art.world);
  switch (banner.kind) {
    case "land":
      landBanner(g, banner, p, w, h, ref);
      break;
    case "town":
      townBanner(g, banner, p, w, h);
      break;
    case "realm":
      realmBanner(g, banner, p, w, h);
      break;
    case "war":
      warBanner(g, banner, p, w, h);
      break;
    case "world":
      worldBanner(
        g,
        banner.star,
        portrait,
        w,
        h,
        ref.length * 131 + ref.charCodeAt(ref.length - 1),
      );
      break;
    case "people":
      peopleBanner(g, banner, portrait, w, h, ref);
      break;
  }
}

const BANNERS = new Map<string, HTMLCanvasElement>();
/** How many drawn banners are kept to be shown again. */
const BANNERS_KEPT = 24;

/**
 * A page's banner, `w` × `h` CSS pixels: drawn once by what it is drawn of and its size, and the same canvas given again after
 * (the oldest let go past BANNERS_KEPT).
 */
export function bannerCanvas(
  art: PageArt,
  portrait: Portrait | undefined,
  ref: string,
  w: number,
  h: number,
): HTMLCanvasElement | null {
  const banner = art.banner;
  if (!banner) return null;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1),
    key = `${ref}|${w}x${h}@${dpr}|${JSON.stringify(art)}`,
    kept = BANNERS.get(key);
  if (kept) {
    BANNERS.delete(key);
    BANNERS.set(key, kept);
    return kept;
  }
  const c = document.createElement("canvas");
  c.className = "page-banner";
  c.dataset.banner = banner.kind;
  c.setAttribute("aria-hidden", "true");
  drawBanner(c, art, banner, portrait, ref, w, h);
  c.dataset.drawn = "1";
  BANNERS.set(key, c);
  while (BANNERS.size > BANNERS_KEPT) BANNERS.delete(BANNERS.keys().next().value!);
  return c;
}
