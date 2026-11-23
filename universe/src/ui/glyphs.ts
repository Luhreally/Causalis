// The fonts the screen's words fall back to found ahead (2026-11-23). A glyph none of a word's own fonts holds (an emoji, a
// sign, a letter of another script) is looked for in the system's other fonts the first time it is laid out, and that font is
// read then, and read again at each size it is first laid out at: a tenth of a second at four times the desk in one frame for
// a new font, a thirtieth for each new size of the emoji's, the first coming to a great city (its people bar's signs and its
// labels laid out where nothing had shown them yet). So every glyph the game's own words hold (__HUD_GLYPHS__, read from its
// sources as it is built: vite.config.ts) is laid out once in each of the screen's fonts, and once at each size its styles
// set, a step a frame, out of sight.

declare const __HUD_GLYPHS__: string | undefined;

/** The screen's fonts (the HUD's styles), plain and bold. */
const FACES = [
  'Verdana, Tahoma, "Trebuchet MS", "DejaVu Sans", Geneva, sans-serif',
  '"Trebuchet MS", Verdana, Tahoma, sans-serif',
  '"Lucida Console", "Courier New", monospace',
  '"Courier New", ui-monospace, monospace',
];
const WEIGHTS = ["400", "700"];
/** How long a step may take (ms) before the next is put off to the next frame (one at least a step); glyphs laid out a step. */
const STEP_MS = 4;
const PER_STEP = 16;
/** A glyph of each font the screen's signs fall back to (its emoji's, its signs'), laid out at each size (and in the people bar). */
export const FALLEN = "🌾⚔⏳▲✋";

/** Every glyph the game's words hold past plain ASCII (none where it was not built: the tests). */
export function hudGlyphs(): string[] {
  return typeof __HUD_GLYPHS__ === "string" ? [...__HUD_GLYPHS__] : [];
}

/**
 * Every font size the page's styles set (px; rem by the page's own; em left out, as it is read from what it is in), and the
 * whole sizes from 9 to 20 besides.
 */
export function styleSizes(doc: Document = document): number[] {
  const root = parseFloat(getComputedStyle(doc.documentElement).fontSize) || 16,
    sizes = new Set<number>();
  for (let px = 9; px <= 20; px++) sizes.add(px);
  const read = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if ("cssRules" in r && (r as CSSGroupingRule).cssRules) read((r as CSSGroupingRule).cssRules);
      const size = (r as CSSStyleRule).style?.fontSize;
      const m = size && /^([\d.]+)(px|rem)$/.exec(size.trim());
      if (m) sizes.add(Math.round(parseFloat(m[1]!) * (m[2] === "rem" ? root : 1) * 100) / 100);
    }
  };
  for (const sheet of Array.from(doc.styleSheets))
    try {
      read(sheet.cssRules);
    } catch {
      // (A sheet from elsewhere does not let its rules be read.)
    }
  return [...sizes].sort((a, b) => a - b);
}

/**
 * Lay out `glyphs` (by default the game's own) in `host`: in each of the screen's fonts, then at each size its styles set, a
 * step a frame; done once all are.
 */
export function warmGlyphs(host: HTMLElement, glyphs = hudGlyphs()): Promise<void> {
  if (!glyphs.length) return Promise.resolve();
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  box.className = "glyph-warm";
  // (Out of sight and of everything's way: its size its own, nothing else laid out again for it.)
  Object.assign(box.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "200px",
    height: "20px",
    overflow: "hidden",
    visibility: "hidden",
    pointerEvents: "none",
    contain: "strict",
  });
  host.append(box);
  // (Each of the fonts at one size, a few glyphs a step, their fallbacks found; then the fonts fallen back to at each size the
  // styles set, in each weight: a font come to at a size is read whole the first time, its glyphs a little each after.)
  const steps: { font: string; text: string }[][] = [];
  for (let i = 0; i < glyphs.length; i += PER_STEP) {
    const text = glyphs.slice(i, i + PER_STEP).join(" ");
    steps.push(FACES.flatMap((face) => WEIGHTS.map((w) => ({ font: `${w} 14px ${face}`, text }))));
  }
  // (Each font its own: what a word falls back to is read for its own fonts, size and weight.)
  for (const px of styleSizes())
    for (const face of FACES)
      steps.push(WEIGHTS.map((w) => ({ font: `${w} ${px}px ${face}`, text: FALLEN })));
  let at = 0;
  return new Promise((done) => {
    const step = () => {
      const t0 = performance.now();
      do {
        box.replaceChildren(
          ...steps[at++]!.map(({ font, text }) => {
            const s = document.createElement("span");
            s.style.font = font;
            s.textContent = text;
            return s;
          }),
        );
        // (Laid out now, its fonts found.)
        void box.firstElementChild?.getBoundingClientRect();
      } while (at < steps.length && performance.now() - t0 < STEP_MS);
      if (at < steps.length) requestAnimationFrame(step);
      else {
        box.remove();
        done();
      }
    };
    requestAnimationFrame(step);
  });
}

/**
 * `el` laid out once out of sight as it is now, and hidden again as it was: what it says is read at its sizes then, not in
 * the frame it is first shown (render/village.ts: a town's panel, a twenty-fifth of a second at four times the desk).
 */
export function layOutUnseen(el: HTMLElement): void {
  if (!el.hidden) return;
  const was = el.style.visibility;
  el.style.visibility = "hidden";
  el.hidden = false;
  void el.getBoundingClientRect();
  el.hidden = true;
  el.style.visibility = was;
}
