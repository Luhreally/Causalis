// A town mode's overlay (N5): one reading of its lots laid on them, each lot's ground a tint from the reading's legend
// (good green, bad red; a plain ramp where neither end is the better), as a colony sim lays its overlays. Laid in the scene
// itself (render/towntint.ts), on the ground of each lot: what stands on a lot hides the tint under it, the fog takes it
// far off as it takes the ground, and it moves with nothing but the ground. Its words come up by the pointer on a desk.
import type { PlaceOverlay } from "../bridge/index.ts";
import type { VillageScene } from "../render/index.ts";

/** How many shades a reading is laid in (each a batch of the scene's: a dozen draws at most). */
export const OVERLAY_SHADES = 12;

type Rgb = readonly [number, number, number];

/** A reading's colour at v (0 … 1), with which end is the good one (hue, saturation and lightness, 0 … 1 each). */
function overlayHsl(v: number, good: PlaceOverlay["good"]): [number, number, number] {
  const t = Math.max(0, Math.min(1, v)),
    bad = good === "low" ? t : good === "high" ? 1 - t : -1;
  // (A plain ramp: pale to deep blue. Else green at the good end, through yellow, to red at the bad.)
  return bad < 0 ? [215 / 360, 0.8, (85 - 50 * t) / 100] : [(120 - 120 * bad) / 360, 0.85, 0.5];
}

function hslRgb([h, s, l]: [number, number, number]): Rgb {
  const k = (n: number) => (n + h * 12) % 12,
    a = s * Math.min(l, 1 - l),
    f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/** A reading's colour at v, for the legend (the same the ground is laid in). */
export function overlayColour(v: number, good: PlaceOverlay["good"]): string {
  const [h, s, l] = overlayHsl(v, good);
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

/** The shade a reading's v is laid in (0 … OVERLAY_SHADES - 1), and each shade's colour (its middle's). */
export const shadeOf = (v: number): number =>
  Math.max(0, Math.min(OVERLAY_SHADES - 1, Math.floor(Math.max(0, v) * OVERLAY_SHADES)));
export const overlayShades = (good: PlaceOverlay["good"]): Rgb[] =>
  Array.from({ length: OVERLAY_SHADES }, (_, k) =>
    hslRgb(overlayHsl((k + 0.5) / OVERLAY_SHADES, good)),
  );

type Village = Pick<VillageScene, "townLotBox" | "tintShow" | "tintPick">;

export class PlaceOverlayLayer {
  /** The words of the lot under the pointer (a desk's), by it. */
  readonly tip = document.createElement("div");
  private rows: { lot: number; v: number; words: string }[] = [];
  private reading: PlaceOverlay | null = null;
  private readonly village: Village;

  constructor(village: Village) {
    this.village = village;
    this.tip.className = "place-overlay-tip";
    this.tip.hidden = true;
  }

  get on(): boolean {
    return this.reading !== null;
  }
  /** How many lots are laid now. */
  get laid(): number {
    return this.rows.length;
  }

  /** The reading to lay (null: none). */
  set(o: PlaceOverlay | null): void {
    this.reading = o;
    this.tip.hidden = true;
    if (!o) {
      this.rows = [];
      this.village.tintShow([], []);
      return;
    }
    const rows: { lot: number; v: number; words: string }[] = [...o.lots];
    // (Danger: the lots within a cry of a fire, nearer the hotter; the fire's own lot burning.)
    if (o.fire) {
      const at = this.village.townLotBox(o.fire.lot);
      if (at)
        for (let k = 0; k < 20000; k++) {
          const b = this.village.townLotBox(k);
          if (!b) break;
          const m = Math.hypot(b.x - at.x, b.z - at.z);
          if (k === o.fire.lot || m > o.fire.reach) continue;
          rows.push({
            lot: k,
            v: 0.25 + 0.6 * (1 - m / o.fire.reach),
            words: `${Math.round(m)} m from the fire: within a cry of it (${Math.round(o.fire.reach)} m now)`,
          });
        }
    }
    const laid: typeof rows = [],
      lots: { x: number; z: number; yaw: number; w: number; d: number; shade: number }[] = [];
    for (const r of rows) {
      const box = this.village.townLotBox(r.lot);
      if (!box) continue;
      laid.push(r);
      lots.push({ ...box, shade: shadeOf(r.v) });
    }
    this.rows = laid;
    this.village.tintShow(lots, overlayShades(o.good));
  }

  /** The pointer at a point of the screen (a desk's; null: gone off the scene): the words of the lot under it. */
  hover(at: { x: number; y: number } | null): void {
    const i = at && this.reading ? this.village.tintPick(at.x, at.y) : null,
      row = i === null ? null : this.rows[i];
    if (!row || !at) {
      this.tip.hidden = true;
      return;
    }
    if (this.tip.textContent !== row.words) this.tip.textContent = row.words;
    this.tip.style.transform = `translate(${Math.round(at.x + 14)}px, ${Math.round(at.y + 12)}px)`;
    this.tip.hidden = false;
  }
}
