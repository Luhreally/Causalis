// Hold to read (town mode, U6): every key and line of the mode's chrome that carries a `title` tells it on a phone too,
// where no title is ever shown. A finger held still on it a moment (450 ms, as an alert's key: ui/place-hud.ts) shows its
// words in a tip, and lifting the finger then fires nothing; a tap still fires it, a drag still scrolls. On a desk the
// pointer rested on it shows the same tip in place of the browser's own, which lay over the key it told of.
//
// One listener for all of them, on the mode's chrome, read as a press comes: nothing per frame, nothing per key (the
// chrome is drawn anew every second, and its keys with it). The tip is laid clear of the key it tells of, above it where
// there is room (a finger covers what is under it), else under it, else beside it; always on the screen. It goes at the
// next press anywhere, a scroll, or after a few seconds.
import { el } from "./why.ts";

/** How long a finger is held still before the tip shows (ms), and how far it may wander meanwhile (px). */
const HOLD_MS = 450,
  HOLD_SLOP = 10,
  /** How long the pointer rests on a key on a desk before its tip shows (ms). */
  REST_MS = 500,
  /** How long a held finger's tip stays once shown (ms). */
  STAY_MS = 4000,
  /** Its gap from the key, and from the screen's edge (px). */
  GAP = 8,
  EDGE = 8;

/** Keys whose hold is their own already (an alert's tells its words in the notice line: ui/place-hud.ts). */
const OWN_HOLD = ".place-alert";

export class PlaceTips {
  private readonly tip = el("div", "place-holdtip");
  private readonly root: HTMLElement;
  /** The key a held finger showed the tip of: the click its lifting makes is not the key's. */
  private held: HTMLElement | null = null;
  private holding: ReturnType<typeof setTimeout> | null = null;
  private staying: ReturnType<typeof setTimeout> | null = null;
  /** The key the pointer rests on, on a desk, its title kept aside meanwhile (the browser's own tip not shown over it). */
  private resting: HTMLElement | null = null;
  private restTimer: ReturnType<typeof setTimeout> | null = null;
  /** Where the pointer was last met on the chrome: a move to where it is already is a key drawn anew under it. */
  private lastX = NaN;
  private lastY = NaN;
  private readonly desk =
    typeof matchMedia === "function" ? matchMedia("(hover: hover) and (pointer: fine)") : null;
  /** The key whose words are shown now (null: none; the look tools). */
  shownFor: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.tip.setAttribute("role", "tooltip");
    this.tip.hidden = true;
    root.append(this.tip);
    // (A press anywhere puts the tip away and lets go of what was rested on; a press on the chrome may start a hold.)
    addEventListener(
      "pointerdown",
      (e) => {
        this.hide();
        this.unrest();
        this.held = null;
        if (e.target instanceof Node && root.contains(e.target)) this.press(e);
      },
      true,
    );
    // (The click a held finger's lifting makes, and the long press's menu, are not the key's.)
    root.addEventListener(
      "click",
      (e) => {
        if (!this.held) return;
        this.held = null;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
    root.addEventListener(
      "contextmenu",
      (e) => {
        if (this.held || this.holding) e.preventDefault();
      },
      true,
    );
    for (const what of ["wheel", "scroll"] as const)
      addEventListener(
        what,
        () => {
          this.hide();
          this.unrest();
        },
        { passive: true, capture: true },
      );
    // On a desk: armed by the pointer moving onto a key (one drawn anew under a pointer left still is not rested on).
    root.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || !this.desk?.matches) return;
      // (By where it was, not by movementX: WebKit tells a pointer's move with none, U6's look on a desk.)
      if (e.clientX === this.lastX && e.clientY === this.lastY) return;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      // (Still on the key rested on, whose title is kept aside: the same key.)
      if (this.resting && e.target instanceof Node && this.resting.contains(e.target)) return;
      const key = this.keyOf(e.target);
      if (key === this.resting) return;
      this.unrest();
      if (!key) return;
      this.resting = key;
      // (Its title kept aside while it is rested on: the browser's own tip would lie over it.)
      key.dataset.tip = key.title;
      key.removeAttribute("title");
      this.restTimer = setTimeout(() => {
        this.restTimer = null;
        if (this.resting === key && key.isConnected) this.show(key, key.dataset.tip ?? "");
      }, REST_MS);
    });
    root.addEventListener("pointerout", (e) => {
      if (!this.resting) return;
      const to = e.relatedTarget;
      if (to instanceof Node && this.resting.contains(to)) return;
      this.unrest();
      this.hide();
    });
  }

  /** The key with words a press or a pointer is on (null: none, or one whose hold is its own). */
  private keyOf(target: EventTarget | null): HTMLElement | null {
    const key = target instanceof Element ? target.closest<HTMLElement>("[title]") : null;
    if (!key || !this.root.contains(key) || key.closest(OWN_HOLD) || !key.title.trim()) return null;
    return key;
  }

  /** A finger down on the chrome: held still long enough on a key with words, its tip; lifted or moved first, nothing. */
  private press(e: PointerEvent): void {
    if (e.pointerType === "mouse") return;
    const key = this.keyOf(e.target);
    if (!key) return;
    const from = { x: e.clientX, y: e.clientY },
      id = e.pointerId;
    const move = (m: PointerEvent): void => {
      if (m.pointerId === id && Math.hypot(m.clientX - from.x, m.clientY - from.y) >= HOLD_SLOP)
        done();
    };
    const done = (): void => {
      if (this.holding) clearTimeout(this.holding);
      this.holding = null;
      removeEventListener("pointermove", move, true);
      removeEventListener("pointerup", done, true);
      removeEventListener("pointercancel", done, true);
    };
    if (this.holding) clearTimeout(this.holding);
    this.holding = setTimeout(() => {
      done();
      if (!key.isConnected) return;
      this.held = key;
      navigator.vibrate?.(8);
      this.show(key, key.title);
      this.staying = setTimeout(() => this.hide(), STAY_MS);
    }, HOLD_MS);
    addEventListener("pointermove", move, true);
    addEventListener("pointerup", done, true);
    addEventListener("pointercancel", done, true);
  }

  /** The words shown, laid clear of the key: above it, else under it, else beside it; on the screen. */
  private show(key: HTMLElement, words: string): void {
    const said = words.trim();
    if (!said) return;
    if (this.tip.textContent !== said) this.tip.textContent = said;
    this.tip.style.maxWidth = `${Math.min(320, innerWidth - 2 * EDGE)}px`;
    this.tip.style.transform = "translate(-9999px, 0)";
    this.tip.hidden = false;
    const r = key.getBoundingClientRect(),
      w = this.tip.offsetWidth,
      h = this.tip.offsetHeight,
      clampX = (x: number) => Math.max(EDGE, Math.min(innerWidth - w - EDGE, x)),
      clampY = (y: number) => Math.max(EDGE, Math.min(innerHeight - h - EDGE, y));
    let x = clampX(r.left + r.width / 2 - w / 2),
      y: number;
    if (r.top - GAP - h >= EDGE) y = r.top - GAP - h;
    else if (r.bottom + GAP + h <= innerHeight - EDGE) y = r.bottom + GAP;
    else {
      // (A key too tall for a tip above or under it: beside it, on the side with more room.)
      const right = innerWidth - r.right >= r.left;
      x = right ? Math.min(innerWidth - w - EDGE, r.right + GAP) : Math.max(EDGE, r.left - GAP - w);
      y = clampY(r.top);
    }
    this.tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    this.shownFor = key;
  }

  /** The tip put away. */
  hide(): void {
    if (this.staying) clearTimeout(this.staying);
    this.staying = null;
    if (this.tip.hidden) return;
    this.tip.hidden = true;
    this.shownFor = null;
  }

  /** What was rested on let go of, its title given back (unless it was given another meanwhile). */
  private unrest(): void {
    if (this.restTimer) clearTimeout(this.restTimer);
    this.restTimer = null;
    const key = this.resting;
    this.resting = null;
    if (!key) return;
    if (!key.getAttribute("title") && key.dataset.tip) key.title = key.dataset.tip;
    delete key.dataset.tip;
  }
}
