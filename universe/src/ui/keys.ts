// The keys a web game is played with, beside the camera's (asked for 2026-09-28): Space
// pauses and goes on again, 1, 2 and 3 set the speed (as the Sims' do), on whichever bar of
// speeds is shown (or the world's, where none is); and the words that tell how the view is
// steered, by a desk's keys and mouse or a phone's fingers.

/** Whether a key goes to a field being typed in (not to the game). */
export function typing(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  return (
    !!t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable)
  );
}

let installed = false,
  resume = 1,
  spaced = false;

/** Space and the numbers for time, once for the page. */
export function installTimeKeys(): void {
  if (installed) return;
  installed = true;
  addEventListener("keydown", (e) => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    // (The bar shown; where none is — over a land — the world's own, first made.)
    const bars = [...document.querySelectorAll<HTMLElement>(".speeds")],
      bar = bars.find((b) => b.offsetParent !== null) ?? bars[0],
      buttons = bar ? [...bar.querySelectorAll<HTMLButtonElement>("button")] : [];
    if (!buttons.length) return;
    if (e.code === "Space") {
      // (Not a button's own press either: a button last clicked keeps the focus.)
      e.preventDefault();
      spaced = true;
      if (e.repeat) return;
      const on = buttons.findIndex((b) => b.classList.contains("on"));
      if (on > 0) {
        resume = on;
        buttons[0]!.click();
      } else buttons[Math.min(resume, buttons.length - 1)]!.click();
      return;
    }
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code),
      b = digit ? buttons[Number(digit[1])] : undefined;
    if (b) {
      e.preventDefault();
      if (!e.repeat) b.click();
    }
  });
  addEventListener("keyup", (e) => {
    if (e.code === "Space" && spaced) {
      e.preventDefault();
      spaced = false;
    }
  });
}

/** Whether the page is touched rather than pointed at. */
export function touching(): boolean {
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}

/** How the view is steered over a flat land, about a globe, or among the stars. */
export function steerWords(scene: "flat" | "round" | "space"): string {
  if (touching())
    return scene === "flat"
      ? "Drag to move, pinch to zoom, twist to turn, two fingers up or down to tilt."
      : scene === "round"
        ? "Drag to turn it, pinch to zoom."
        : "Drag to turn, pinch to zoom.";
  return scene === "flat"
    ? "Drag to move, right-drag to turn; W A S D to go, Q E to turn, R F to tilt, scroll or + − to zoom."
    : scene === "round"
      ? "Drag to turn it, scroll or + − to zoom; W A S D to go round it."
      : "Drag to turn, scroll or + − to zoom.";
}

/** The keys, as the settings list them. */
export const KEY_LINES: readonly (readonly [string, string])[] = [
  ["W A S D, arrows", "go (over a land) or go round (a globe)"],
  ["Q E", "turn the view"],
  ["R F, Page Up and Down", "tilt it"],
  ["+ −, Z X, the wheel", "zoom in and out (on through to the next scale)"],
  ["Shift", "hurry"],
  ["Drag", "take hold of the land and move it; right-drag to turn and tilt"],
  ["Space", "pause, and go on"],
  ["1 2 3", "the speeds"],
  ["/ or Ctrl K", "find anything by name"],
  ["Esc", "put down what the hand holds; stop flying"],
];
