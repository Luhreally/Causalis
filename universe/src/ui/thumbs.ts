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
export function lazyThumb(
  p: Portrait,
  size = 28,
  cls = "thumb",
  label?: () => string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  // (Its class first: the press's own class is added to it, not written over.)
  canvas.className = cls;
  zoomable(canvas, p, label);
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

/** What each small picture shows, for its tap to draw it large. */
const SHOWS = new WeakMap<Element, Portrait>();

/**
 * A small picture's tap (asked 2026-11-12: "how do i see bigger more detailed photos of the stuff"): the same portrait drawn
 * large in a window over the page, turning slowly, with all the detail a thumbnail leaves out (its shadow, a break's
 * ripples, a bow's string). Drawn only while it is open; shut by its ✕, a tap outside it, or Escape.
 */
function zoomable(canvas: HTMLCanvasElement, p: Portrait, label?: () => string): void {
  SHOWS.set(canvas, p);
  canvas.classList.add("thumb-zoomable");
  canvas.setAttribute("role", "button");
  canvas.setAttribute("aria-label", "See it larger");
  canvas.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    openZoom(p, (label ? label() : rowWords(canvas)).replace(/\s+/g, " ").trim().slice(0, 90));
  });
}

/** What a row says of its thing, without its numbers: its share, its amount, a price, a trend. */
const NUMBERS = ".makeup-share, .makeup-amount, .makeup-swatch, .board-price, .board-tag";
function rowWords(canvas: HTMLCanvasElement): string {
  const row = canvas.closest(".entry, .board-row, li, tr, .makeup-row");
  if (!row) return "";
  const copy = row.cloneNode(true) as Element;
  for (const e of copy.querySelectorAll(NUMBERS)) e.remove();
  // (A board line's name and what it makes are two lines; said as one, with a comma between.)
  for (const e of copy.querySelectorAll("small")) e.prepend(", ");
  return copy.textContent ?? "";
}

let zoom: { readonly root: HTMLElement; frame: number } | null = null;

function closeZoom(): void {
  if (!zoom) return;
  cancelAnimationFrame(zoom.frame);
  zoom.root.remove();
  zoom = null;
  removeEventListener("keydown", onKey);
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape") closeZoom();
}

/** A picture drawn large over the page at its fine level, turning, captioned (a thumbnail's press, a page's own picture's). */
export function openZoom(p: Portrait, label: string): void {
  closeZoom();
  const root = document.createElement("div"),
    card = document.createElement("div"),
    shut = document.createElement("button"),
    big = document.createElement("canvas"),
    words = document.createElement("div"),
    side = Math.round(Math.max(160, Math.min(420, innerWidth - 48, innerHeight - 200)));
  root.className = "thumb-zoom";
  card.className = "thumb-zoom-card";
  shut.className = "thumb-zoom-close";
  shut.textContent = "✕";
  shut.setAttribute("aria-label", "Close");
  words.className = "thumb-zoom-words";
  words.textContent = label;
  big.style.width = `${side}px`;
  big.style.height = `${side}px`;
  card.append(shut, big, words);
  root.append(card);
  root.addEventListener("click", (e) => {
    if (e.target === root) closeZoom();
  });
  card.addEventListener("click", (e) => e.stopPropagation());
  shut.addEventListener("click", closeZoom);
  addEventListener("keydown", onKey);
  document.body.append(root);
  const state = { root, frame: 0 },
    start = performance.now();
  let last = -1;
  const tick = (now: number) => {
    // (A slow turn at some 30 frames a second: one canvas, while it is open.)
    if (now - last >= 33) {
      last = now;
      drawPortrait(big, p, side, side, (now - start) / 1000);
    }
    state.frame = requestAnimationFrame(tick);
  };
  state.frame = requestAnimationFrame(tick);
  zoom = state;
}
