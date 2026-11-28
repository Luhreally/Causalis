// The chrome of a line lived (Live a Line), phone first: along the top, the cell's name (pressed: its page), when in its
// world's dawn it is, a ? that tells what this mode is, the guide, and Wake; under them the deep clock's way to the first
// bodies, the cell's strip (its size, its speed, how thick its world's liquid is to it, and how near it is to dividing),
// what the last thing done came to, and the guide's lesson now. A stick that floats up where the left thumb lands; four
// round acts under the right thumb; What now? beside the stick. Nothing lies over anything: the top's parts are a column,
// and whatever opens over the drop (a page, the daughters, a card, the guide) opens under it and puts the foot away.
// On a desk: W A S D or the arrows, Space, E, F and R the four acts, Esc to close what is open. Comes with the mode's chunk.
import { el } from "./why.ts";

const STICK_R = 52;
const AHEAD: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};
const ACT_KEYS = ["Space", "KeyE", "KeyF", "KeyR"];

/** Words set only where they change (the chrome is set many times a second). */
export const put = (e: HTMLElement, text: string): void => {
  if (e.textContent !== text) e.textContent = text;
};

export type HudOffer = { icon: string; label: string; can: boolean; words: string };

export class LineHud {
  readonly element = el("div", "line-hud");
  readonly top = el("div", "line-top");
  readonly bar = el("div", "line-bar");
  readonly name = el("button", "line-name");
  readonly when = el("span", "line-when");
  readonly help = el("button", "line-help", "?");
  readonly guideButton = el("button", "line-guide-button", "📘 Guide");
  readonly wake = el("button", "line-wake", "☀️ Wake");
  readonly clock = el("div", "line-clock");
  private readonly clockFill = el("span", "line-clock-fill");
  private readonly clockWords = el("span", "line-clock-words");
  readonly strip = el("div", "line-strip");
  private readonly stripWords = el("span", "line-strip-words");
  private readonly full = el("span", "line-full");
  private readonly fullFill = el("span", "line-full-fill");
  readonly stripHelp = el("button", "line-help line-strip-help", "?");
  readonly told = el("div", "line-told");
  /** The guide's lesson now, in the top's column (ui/line-guide.ts fills it). */
  readonly coach = el("div", "line-coach");
  readonly foot = el("div", "line-foot");
  readonly zone = el("div", "line-stick-zone");
  private readonly hint = el("span", "line-stick-hint", "Drag here to swim");
  readonly now = el("button", "line-now", "💡 What now?");
  readonly nowSaid = el("div", "line-now-said");
  private readonly base = el("div", "line-stick");
  private readonly knob = el("span", "line-knob");
  readonly acts: HTMLButtonElement[] = [];
  private readonly actsBox = el("div", "line-acts");
  /** Whatever opens over the drop: a page, the daughters, a card, the guide's list. */
  readonly layer = el("div", "line-layer");
  private push = { x: 0, y: 0 };
  private held: { id: number; x0: number; y0: number } | null = null;
  private readonly keys = new Set<string>();
  private pressed: number[] = [];
  private pinch = 1;
  onWake: () => void = () => {};
  onHelp: () => void = () => {};
  onName: () => void = () => {};
  onGuide: () => void = () => {};
  onNow: () => void = () => {};
  onStripHelp: () => void = () => {};
  /** A key while the mode is on that is not the stick's or an act's (Escape, a ? …): true if taken. */
  onKey: (code: string) => boolean = () => false;
  private readonly key = (e: KeyboardEvent) => {
    if (this.element.hidden) return;
    // (Nothing of the god game's keys while a line is lived: its clock and its scales wait as they were.)
    e.stopImmediatePropagation();
    const down = e.type === "keydown";
    if (AHEAD[e.code]) {
      e.preventDefault();
      if (down) this.keys.add(e.code);
      else this.keys.delete(e.code);
      return;
    }
    if (!down) return;
    const slot = ACT_KEYS.indexOf(e.code);
    if (slot >= 0) {
      e.preventDefault();
      if (!e.repeat && !this.element.classList.contains("modal")) this.strike(slot);
      return;
    }
    if (this.onKey(e.code)) e.preventDefault();
  };
  private readonly blur = () => {
    this.keys.clear();
    this.release();
  };

  constructor(parent: HTMLElement) {
    this.element.hidden = true;
    this.name.title = "Your cell's page";
    this.help.title = "What this mode is";
    this.help.setAttribute("aria-label", "What this mode is");
    this.guideButton.title = "The guide: what to do, step by step";
    this.wake.title = "Wake: back to your world, exactly as you left it";
    this.stripHelp.title = "What these numbers mean";
    this.stripHelp.setAttribute("aria-label", "What these numbers mean");
    const right = el("span", "line-bar-keys");
    right.append(this.help, this.guideButton, this.wake);
    const who = el("span", "line-who");
    who.append(this.name, this.when);
    this.bar.append(who, right);
    this.clock.append(this.clockFill, this.clockWords);
    this.full.append(this.fullFill);
    const stripLine = el("span", "line-strip-line");
    stripLine.append(this.stripWords, this.full);
    this.strip.append(stripLine, this.stripHelp);
    this.coach.hidden = true;
    this.top.append(this.bar, this.clock, this.strip, this.told, this.coach);
    for (let slot = 0; slot < 4; slot++) {
      const b = el("button", `line-act line-act-${slot}`);
      b.append(el("span", "line-act-icon"), el("span", "line-act-label"));
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.strike(slot);
      });
      b.addEventListener("click", (e) => {
        if (e.detail === 0) this.strike(slot);
      });
      this.acts.push(b);
      this.actsBox.append(b);
    }
    this.base.append(this.knob);
    this.base.hidden = true;
    this.zone.append(this.hint);
    this.nowSaid.hidden = true;
    this.foot.append(this.zone, this.now, this.nowSaid, this.actsBox, this.base);
    this.layer.hidden = true;
    this.element.append(this.top, this.foot, this.layer);
    this.wake.onclick = () => this.onWake();
    this.help.onclick = () => this.onHelp();
    this.name.onclick = () => this.onName();
    this.guideButton.onclick = () => this.onGuide();
    this.now.onclick = () => this.onNow();
    this.stripHelp.onclick = () => this.onStripHelp();
    // The stick: where the thumb comes down in its zone, a knob pushed as far as it is dragged.
    this.zone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (this.held) return;
      this.held = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
      this.base.hidden = false;
      this.base.style.transform = `translate(${e.clientX - STICK_R}px, ${e.clientY - STICK_R}px)`;
      this.knob.style.transform = "";
      this.hint.hidden = true;
    });
    const move = (e: PointerEvent) => {
      if (!this.held || e.pointerId !== this.held.id) return;
      const dx = e.clientX - this.held.x0,
        dy = e.clientY - this.held.y0,
        l = Math.hypot(dx, dy),
        k = l > STICK_R ? STICK_R / l : 1;
      this.push = { x: (dx * k) / STICK_R, y: (dy * k) / STICK_R };
      this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    };
    const up = (e: PointerEvent) => {
      if (this.held && e.pointerId === this.held.id) this.release();
    };
    this.element.addEventListener("pointermove", move);
    for (const end of ["pointerup", "pointercancel"])
      this.element.addEventListener(end, (e) => up(e as PointerEvent));
    // (A wheel, or two fingers, stand the eye off or draw it near.)
    this.element.addEventListener(
      "wheel",
      (e) => {
        if ((e.target as HTMLElement).closest(".line-layer")) return;
        e.preventDefault();
        this.pinch = Math.max(0.55, Math.min(1.8, this.pinch * Math.exp(Math.sign(e.deltaY) * 0.12)));
      },
      { passive: false },
    );
    this.element.addEventListener("contextmenu", (e) => e.preventDefault());
    parent.append(this.element);
    // (How tall the top's column stands: what opens over the drop opens under it.)
    if (typeof ResizeObserver !== "undefined")
      new ResizeObserver(() =>
        this.element.style.setProperty("--line-top", `${Math.ceil(this.top.getBoundingClientRect().bottom)}px`),
      ).observe(this.top);
  }

  private strike(slot: number): void {
    this.pressed.push(slot);
    const b = this.acts[slot]!;
    b.classList.remove("struck");
    void b.offsetWidth;
    b.classList.add("struck");
  }

  private release(): void {
    this.held = null;
    this.push = { x: 0, y: 0 };
    this.base.hidden = true;
  }

  show(): void {
    this.element.hidden = false;
    addEventListener("keydown", this.key, true);
    addEventListener("keyup", this.key, true);
    addEventListener("blur", this.blur);
  }

  hide(): void {
    this.element.hidden = true;
    removeEventListener("keydown", this.key, true);
    removeEventListener("keyup", this.key, true);
    removeEventListener("blur", this.blur);
    this.blur();
    this.pressed = [];
    this.layerOpen(null);
  }

  /** How far the eye is stood off, by the wheel (1: as it was set). */
  get zoom(): number {
    return this.pinch;
  }

  /** The stick's push now (x to the right, y down the screen, each -1 … 1): the thumb's, else the keys'. */
  stick(): { x: number; y: number } {
    let { x, y } = this.push;
    if (!x && !y)
      for (const k of this.keys) {
        const a = AHEAD[k]!;
        x += a[0];
        y += a[1];
      }
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }

  /** The acts pressed since last asked (their places), the first first. */
  takePressed(): number[] {
    const p = this.pressed;
    this.pressed = [];
    return p;
  }

  /** The four acts as they stand: each its icon, label, whether it can be done, and what it would do or why not. */
  offers(list: readonly HudOffer[]): void {
    list.forEach((o, i) => {
      const b = this.acts[i];
      if (!b) return;
      put(b.firstElementChild as HTMLElement, o.icon);
      put(b.lastElementChild as HTMLElement, o.label);
      if (b.title !== o.words) b.title = o.words;
      b.setAttribute("aria-label", `${o.label}: ${o.words}`);
      b.classList.toggle("cannot", !o.can);
    });
  }

  /** The top's words: the cell's name, when it is, the clock's way (0 … 1) to the first bodies and its words. */
  head(name: string, when: string, through: number, clockWords: string): void {
    put(this.name, `🧬 ${name} ›`);
    put(this.when, when);
    const w = `${Math.round(Math.max(0, Math.min(1, through)) * 1000) / 10}%`;
    if (this.clockFill.style.width !== w) this.clockFill.style.width = w;
    put(this.clockWords, clockWords);
  }

  /** The strip: its words, and how near it is to dividing (0 … 1). */
  cell(words: string, full: number): void {
    put(this.stripWords, words);
    const w = `${Math.round(Math.max(0, Math.min(1, full)) * 100)}%`;
    if (this.fullFill.style.width !== w) this.fullFill.style.width = w;
    this.full.classList.toggle("ready", full >= 1);
    this.full.title = full >= 1 ? "Full: you can divide" : `${w} of the way to dividing`;
  }

  say(words: string, good = true): void {
    put(this.told, words);
    this.told.classList.toggle("bad", !good);
  }

  /** What What now? said (null: put away). */
  nowWords(words: string | null): void {
    this.nowSaid.hidden = words === null;
    if (words !== null) put(this.nowSaid, words);
  }

  /** Something opened over the drop (null: closed): the foot put away while it stands. */
  layerOpen(e: HTMLElement | null): void {
    this.layer.hidden = !e;
    this.layer.replaceChildren(...(e ? [e] : []));
    this.element.classList.toggle("modal", !!e);
    if (e) this.release();
  }

  get modal(): boolean {
    return !this.layer.hidden;
  }

  /** Words under the stick's zone (empty: none, once it has been used). */
  hintWords(words: string): void {
    put(this.hint, words);
    this.hint.hidden = !words;
  }
}
