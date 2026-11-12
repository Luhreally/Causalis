// A world's life on one sheet (B1 of the life plan, for gate 108 and the owner's eye): its people's figure and its
// living beasts, each drawn as a page draws it (ui/portrait.ts, from the one builder), side by side over the screen,
// and each picture's outline read off its own pixels: what it covers, fitted into a small square grid, so two worlds'
// beasts can be told apart by what was drawn and not by what a list says.
import type { GenesisPlan, HostClient } from "../bridge/index.ts";
import { drawPortrait } from "./portrait.ts";

/** An outline: a GRID × GRID mask of what a picture covers, fitted to its bounds, as a string of 0s and 1s; and its bounds' proportions. */
export type Outline = { readonly mask: string; readonly aspect: number; readonly cover: number };

export const GRID = 20;

/** What a canvas's picture covers, fitted to its bounds (null: nothing drawn). */
export function outlineOf(canvas: HTMLCanvasElement): Outline | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width: w, height: h } = canvas,
    px = ctx.getImageData(0, 0, w, h).data,
    on = (x: number, y: number) => px[(y * w + x) * 4 + 3]! > 24;
  let x0 = w,
    x1 = -1,
    y0 = h,
    y1 = -1,
    cover = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (on(x, y)) {
        cover++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  let mask = "";
  const bw = x1 - x0 + 1,
    bh = y1 - y0 + 1;
  for (let j = 0; j < GRID; j++)
    for (let i = 0; i < GRID; i++) {
      // (A cell is covered where most of what it spans is.)
      const ax = x0 + Math.floor((i * bw) / GRID),
        bx = x0 + Math.max(Math.floor(((i + 1) * bw) / GRID), Math.floor((i * bw) / GRID) + 1),
        ay = y0 + Math.floor((j * bh) / GRID),
        by = y0 + Math.max(Math.floor(((j + 1) * bh) / GRID), Math.floor((j * bh) / GRID) + 1);
      let n = 0,
        all = 0;
      for (let y = ay; y < by; y++)
        for (let x = ax; x < bx; x++) {
          all++;
          if (on(x, y)) n++;
        }
      mask += n * 2 >= all ? "1" : "0";
    }
  return { mask, aspect: bw / bh, cover: cover / (w * h) };
}

/** How alike two outlines are: the share of cells covered by both of those covered by either (1: the same). */
export function alike(a: Outline, b: Outline): number {
  let both = 0,
    either = 0;
  for (let i = 0; i < a.mask.length; i++) {
    const x = a.mask[i] === "1",
      y = b.mask[i] === "1";
    if (x && y) both++;
    if (x || y) either++;
  }
  // (Bounds of other proportions are other outlines, whatever their masks.)
  const shape = Math.min(a.aspect, b.aspect) / Math.max(a.aspect, b.aspect);
  return either ? (both / either) * Math.min(1, 0.4 + 0.6 * shape) : 1;
}

/** What a sheet shows: each picture's outline, and a hash of each beast's pixels (to pin Earth's). */
export type LifeSheet = {
  readonly people: Outline | null;
  readonly beasts: readonly (Outline & {
    readonly name: string;
    readonly look: boolean;
    readonly hash: number;
  })[];
};

const CELL_W = 140,
  CELL_H = 104;

/** Show a world's life on a sheet over the screen (`close` takes it away): its people and up to `most` living beasts. */
export async function showLifeSheet(client: HostClient, most = 11): Promise<LifeSheet> {
  const plan = await client.query<GenesisPlan>({ type: "genesis" });
  document.getElementById("life-sheet")?.remove();
  const sheet = document.createElement("div");
  sheet.id = "life-sheet";
  sheet.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:#0c1022;display:flex;flex-wrap:wrap;align-content:flex-start;gap:4px;padding:6px;overflow:auto";
  document.body.append(sheet);
  const cell = (label: string) => {
    const box = document.createElement("div");
    box.style.cssText = `width:${CELL_W}px;color:#cfe;font:10px Verdana,sans-serif;text-align:center`;
    const canvas = document.createElement("canvas");
    box.append(canvas, Object.assign(document.createElement("div"), { textContent: label }));
    sheet.append(box);
    return canvas;
  };
  let people: Outline | null = null;
  const fig = plan.people?.figure;
  if (fig) {
    const canvas = cell(plan.people!.name);
    drawPortrait(
      canvas,
      {
        kind: "person",
        ref: "folk:sheet",
        age: 30,
        span: 70,
        occupation: 0,
        child: false,
        era: "forage",
        body: fig as never,
      },
      CELL_W,
      CELL_H,
      0,
    );
    people = outlineOf(canvas);
  }
  const beasts: (Outline & { name: string; look: boolean; hash: number })[] = [];
  for (const l of plan.lineages.filter((x) => x.body && x.died === null).slice(0, most)) {
    const canvas = cell(l.name);
    drawPortrait(
      canvas,
      { kind: "creature", body: l.body!, name: l.name, wool: l.body!.covering === "wool" },
      CELL_W,
      CELL_H,
      0,
    );
    const o = outlineOf(canvas),
      data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data[i]!, 16777619) >>> 0;
    if (o) beasts.push({ ...o, name: l.name, look: !!l.body!.look, hash });
  }
  return { people, beasts };
}

/** Take the sheet away. */
export function closeLifeSheet(): void {
  document.getElementById("life-sheet")?.remove();
}
