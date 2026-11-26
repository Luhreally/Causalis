// A town mode's overlay (N5): one reading of its lots laid over them on the screen, each lot's ground a tint from the
// reading's legend (good green, bad red; a plain ramp where neither end is the better), as a colony sim lays its overlays.
// Drawn as an SVG under the ring and name of whom is chosen, in the scene's labels (no window of the HUD, taken by no
// tap); its corners put on the screen again only when the eye has moved or the reading changed.
import type { PlaceOverlay } from "../bridge/index.ts";
import type { VillageScene } from "../render/index.ts";

const SVG = "http://www.w3.org/2000/svg";
type Box = { x: number; z: number; yaw: number; w: number; d: number };
type Laid = { box: Box; v: number; words: string; shape: SVGPolygonElement };

/** A reading's colour at v (0 … 1), with which end is the good one. */
export function overlayColour(v: number, good: PlaceOverlay["good"]): string {
  const t = Math.max(0, Math.min(1, v)),
    bad = good === "low" ? t : good === "high" ? 1 - t : -1;
  if (bad < 0) {
    // (A plain ramp: pale to deep blue.)
    const l = 85 - 50 * t;
    return `hsl(215, 80%, ${l.toFixed(0)}%)`;
  }
  // (Green at the good end, through yellow, to red at the bad.)
  return `hsl(${(120 - 120 * bad).toFixed(0)}, 85%, 50%)`;
}

export class PlaceOverlayLayer {
  readonly svg = document.createElementNS(SVG, "svg");
  private laid: Laid[] = [];
  private pool: SVGPolygonElement[] = [];
  private key = "";
  private reading: PlaceOverlay | null = null;

  private readonly village: Pick<VillageScene, "townLotBox" | "screenOf">;

  constructor(village: Pick<VillageScene, "townLotBox" | "screenOf">) {
    this.village = village;
    this.svg.setAttribute("class", "place-overlay");
    this.svg.style.display = "none";
  }

  get on(): boolean {
    return this.reading !== null;
  }

  /** The reading to lay (null: none). */
  set(o: PlaceOverlay | null): void {
    this.reading = o;
    this.key = "";
    if (!o) {
      this.svg.style.display = "none";
      this.laid = [];
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
    const laid: Laid[] = [];
    for (const r of rows) {
      const box = this.village.townLotBox(r.lot);
      if (!box) continue;
      const shape = this.pool[laid.length] ?? this.made(laid.length);
      shape.setAttribute("fill", overlayColour(r.v, o.good));
      const title = shape.firstChild as SVGTitleElement;
      if (title.textContent !== r.words) title.textContent = r.words;
      laid.push({ box, v: r.v, words: r.words, shape });
    }
    for (let k = laid.length; k < this.pool.length; k++) this.pool[k]!.style.display = "none";
    for (const x of laid) x.shape.style.display = "";
    this.laid = laid;
    this.svg.style.display = "";
  }

  private made(k: number): SVGPolygonElement {
    const shape = document.createElementNS(SVG, "polygon");
    shape.append(document.createElementNS(SVG, "title"));
    this.svg.append(shape);
    this.pool[k] = shape;
    return shape;
  }

  /** Each frame: the lots' corners on the screen, again only where the eye has moved. */
  frame(): void {
    if (!this.reading || !this.laid.length) return;
    const a = this.village.screenOf(0, 0, 0),
      b = this.village.screenOf(25, 25, 0),
      key =
        a && b ? `${a.x.toFixed(1)},${a.y.toFixed(1)},${b.x.toFixed(1)},${b.y.toFixed(1)}` : "-";
    if (key === this.key) return;
    this.key = key;
    for (const x of this.laid) {
      const { box } = x,
        c = Math.cos(box.yaw),
        s = Math.sin(box.yaw),
        pts: string[] = [];
      for (const [u, v] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        const du = (u * box.w) / 2,
          dv = (v * box.d) / 2,
          p = this.village.screenOf(box.x + du * c + dv * s, box.z - du * s + dv * c, 0.05);
        if (!p) break;
        pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
      if (pts.length === 4) {
        x.shape.setAttribute("points", pts.join(" "));
        x.shape.style.display = "";
      } else x.shape.style.display = "none";
    }
  }
}
