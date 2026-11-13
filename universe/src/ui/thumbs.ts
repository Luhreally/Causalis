// Small pictures beside the things a page names (asked 2026-11-12): a specimen, a plant, a beast, a company's mark. Each is drawn only once
// its row comes on screen, once per picture and size (a canvas kept by its portrait), and copied from then on: a market's page opens with
// none drawn, and a long list draws only what is looked at. Nothing is drawn again as the world runs.
import type { Portrait } from "../bridge/index.ts";
import { drawPortrait } from "./portrait.ts";
import { drawThumb } from "./specimen.ts";

/** The pictures made so far, by portrait, size and pixel ratio: the oldest let go past this many. */
const PICS = new Map<string, HTMLCanvasElement>();
const PICS_MAX = 400;

/** Whether a portrait is a specimen's (drawn at the specimen's fixed three-quarter view). */
const specimen = (p: Portrait): boolean =>
  p.kind === "matter" || p.kind === "element" || p.kind === "thing" || p.kind === "plant";

/** Draw a small picture of any portrait into a canvas now, from the kept one where it was made before. */
export function paintThumb(canvas: HTMLCanvasElement, p: Portrait, size: number): void {
  if (specimen(p)) {
    drawThumb(canvas, p, size);
    return;
  }
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1),
    key = `${JSON.stringify(p)}|${size}|${dpr}`;
  let pic = PICS.get(key);
  if (!pic) {
    pic = document.createElement("canvas");
    // (A beast stands still at its three-quarter turn, as its page's picture starts.)
    drawPortrait(pic, p, size, size, 0);
    if (PICS.size >= PICS_MAX) PICS.delete(PICS.keys().next().value!);
    PICS.set(key, pic);
  }
  canvas.width = pic.width;
  canvas.height = pic.height;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(pic, 0, 0);
}

/** What each waiting canvas is to show, drawn as it comes on screen. */
const WAITING = new WeakMap<Element, { readonly p: Portrait; readonly size: number }>();
let watcher: IntersectionObserver | null = null;

/** Draws every picture times, for a gate to read: how many drawn, and how long they took (ms). */
export const THUMB_TIMES = { drawn: 0, ms: 0 };

function draw(canvas: HTMLCanvasElement, p: Portrait, size: number): void {
  const t0 = globalThis.performance?.now() ?? 0;
  paintThumb(canvas, p, size);
  THUMB_TIMES.drawn++;
  THUMB_TIMES.ms += (globalThis.performance?.now() ?? 0) - t0;
  canvas.dataset.drawn = "1";
}

/**
 * A small picture's canvas, drawn once it is on screen (at once where the browser cannot tell). It is the size of the picture from the
 * first, so a row does not move when it is drawn.
 */
export function lazyThumb(p: Portrait, size = 28, cls = "thumb"): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.className = cls;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  if (typeof IntersectionObserver === "undefined") {
    draw(canvas, p, size);
    return canvas;
  }
  watcher ??= new IntersectionObserver(
    (seen) => {
      for (const e of seen) {
        if (!e.isIntersecting) continue;
        const w = WAITING.get(e.target);
        watcher!.unobserve(e.target);
        if (w) draw(e.target as HTMLCanvasElement, w.p, w.size);
        WAITING.delete(e.target);
      }
    },
    { rootMargin: "120px 0px" },
  );
  WAITING.set(canvas, { p, size });
  watcher.observe(canvas);
  return canvas;
}
