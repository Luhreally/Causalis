// The controls of one of a town's people possessed (Phase 60), phone first: a stick that floats up
// where the left thumb lands (pushed to its rim, a run); four round acts under the right thumb, each
// in its own place, labelled for what is before the body now and acting as the thumb comes down;
// "Let go" apart at the top right; a strip at the top of who he is, his strength, what he carries
// and his body (its slot for the Body model, Phase 55 wave 5); the line of what the last act came
// to, and what the first would do or why it cannot be done here. Drag the right half to turn the
// eye, pinch to stand off, double tap to come behind again. Every touch tracked by its own pointer
// (no capture asked: WebKit refuses it for touches it did not make), nothing of the page's own
// gestures (no pinch-zoom, pull-to-refresh, selection or callout), all within the safe areas and
// laid out again as the phone turns. On a desk: W A S D or the arrows, Shift to run, Space, E, F
// and R the four acts, Esc to let go, a drag of the mouse to look and its wheel to stand off.
// A soldier or a beast possessed (Phase 61) the same, with what he bears and the battle's tally
// under the strip: each side's men standing and fallen, the last struck down named.
// The god's gifts (2026-11-21, rules/gifts.ts): ✨ Gifts opens their sheet (G), each put on or off with a press (1 … 9);
// held, 🏃 Sprint (or Shift) runs as the body can, its breath a bar on the strip while it is spent; with wings, ⤴ Rise
// (or Q) held flies up; with healing, a fifth act (H); a stroke chosen on the sheet falls where the world is next touched.
import type { HeldTally, PossessLive } from "../bridge/index.ts";
import { GIFTS, type Gift } from "../view/index.ts";
import { GiftsSheet } from "./gifts-sheet.ts";
import { el } from "./why.ts";

/** How far the stick reaches from where the thumb came down (CSS px); pushed this far out of it, a run. */
const STICK_R = 52,
  RUN_AT = 0.92;
/** A double tap: two taps this close in time (ms) and place (px); a tap: a press that barely moves, let go soon (ms). */
const DOUBLE_MS = 330,
  DOUBLE_PX = 44,
  TAP_PX = 10,
  TAP_MS = 350;
/** The keys of the acts, in their places (the fifth the healing touch's, while the gift is on). */
const ACT_KEYS = ["Space", "KeyE", "KeyF", "KeyR", "KeyH"];
const AHEAD: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** Each pace the world about him can be at: what its button says, and its title. */
const PACE_WORDS: readonly (readonly [number, string, string])[] = [
  [1, "1×", "The world at its own pace"],
  [0.5, "½×", "Slowed to half"],
  [0.25, "¼×", "Slow time: the world at a quarter, you at your own pace"],
  [0.125, "⅛×", "Slow time, and slowed to half again: the world at an eighth"],
  [0, "❚❚", "Held still"],
];

/**
 * Words, a title or a width set only where they change: the controls are set at every step of the
 * possession's clock, and a write the same as before still has the page laid out again before the
 * next frame is drawn.
 */
const put = (e: HTMLElement, text: string) => {
  if (e.textContent !== text) e.textContent = text;
};
const titled = (e: HTMLElement, title: string) => {
  if (e.title !== title) e.title = title;
};

type Held =
  | { kind: "stick"; x0: number; y0: number; fromX: number; fromY: number; at: number }
  | { kind: "look"; x: number; y: number; x0: number; y0: number; at: number };

export class PossessHud {
  readonly element = el("div", "possess-hud");
  /** The strip and (a soldier's) the battle's tally under it, at the top left: what is told comes under them. */
  private readonly head = el("div", "possess-head");
  private readonly strip = el("div", "possess-strip");
  private readonly who = el("strong", "possess-name");
  private readonly what = el("span", "possess-what");
  private readonly strength = el("span", "possess-strength");
  private readonly left = el("span", "possess-left");
  private readonly carries = el("span", "possess-carries");
  /** His body in a line: the slot the Body model (Phase 55 wave 5) draws into. */
  readonly body = el("span", "possess-body");
  private readonly told = el("div", "possess-told");
  /** The battle's tally while a soldier is held (Phase 61): each side's men, the last struck down. */
  private readonly tally = el("div", "possess-tally");
  private readonly sides = [el("span", "possess-side"), el("span", "possess-side")] as const;
  private readonly balance = el("span", "possess-balance");
  private readonly share = el("span", "possess-share");
  private readonly fallen = el("div", "possess-fallen");
  /** What the strip's carrying is shown with (a soldier's arm, a beast's ways). */
  carriesIcon = "🎒";
  private readonly hint = el("div", "possess-hint");
  private readonly letGo = el("button", "possess-letgo", "✋ Let go");
  /** Live their day (Lives L3): from a body held to their life. */
  private readonly liveDay = el("button", "possess-live", "🏠 Live their day");
  private readonly paces = el("div", "possess-paces");
  /** The pace pressed (1, ½, 0), and what the god's Slow time slows the world by (1: not). */
  private chosen = 1;
  private factor = 1;
  private readonly base = el("div", "possess-stick");
  private readonly knob = el("span", "possess-knob");
  private readonly actsBox = el("div", "possess-acts");
  private readonly acts: HTMLButtonElement[] = [];
  private readonly bubbles = el("div", "possess-bubbles");
  private readonly held = new Map<number, Held>();
  private push = { x: 0, y: 0 };
  private readonly keys = new Set<string>();
  private shift = false;
  /** The sprint held down (by its button: each finger on it), and Rise (its button, or Q). */
  private readonly sprintHeld = new Set<number>();
  private readonly sprint = el("button", "possess-sprint", "🏃 Sprint");
  private readonly riseHeld = new Set<number>();
  private riseKey = false;
  private readonly rise = el("button", "possess-rise", "⤴ Rise");
  /** The god's gifts: their button, their sheet, the stroke waiting for a touch (-1: none). */
  private readonly giftsButton = el("button", "possess-gifts", "✨ Gifts");
  readonly sheet: GiftsSheet;
  private stroke = -1;
  /** His breath for a sprint, on the strip while it is spent. */
  private readonly wind = el("span", "possess-wind");
  private readonly windLeft = el("span", "possess-wind-left");
  private pressed: number[] = [];
  private tapped = { t: -1e9, x: 0, y: 0 };
  private pinch = 0;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);
  private readonly onBlur = () => {
    this.keys.clear();
    this.shift = false;
    this.release();
  };
  private readonly onTurn = () => this.release();
  /** Let go, the eye turned (pixels), stood off (a factor: more than one, nearer), come behind, the clock's pace chosen. */
  onLetGo: () => void = () => {};
  onLive: () => void = () => {};
  onLook: (dx: number, dy: number) => void = () => {};
  onZoom: (factor: number) => void = () => {};
  onBehind: () => void = () => {};
  onPace: (pace: number) => void = () => {};
  /** A finger put down and lifted on one spot of the world (screen px): what stands there, touched. */
  onTap: (x: number, y: number) => void = () => {};
  /** The gifts put on or off (all of them now); a stroke called down at a spot of the world touched (screen px). */
  onGifts: (gifts: number) => void = () => {};
  onSmite: (kind: number, x: number, y: number) => void = () => {};

  constructor(parent: HTMLElement) {
    this.element.hidden = true;
    this.left.append(this.strength);
    this.wind.append(this.windLeft);
    this.wind.hidden = true;
    this.wind.title = "Breath for a sprint";
    const line = el("div", "possess-line");
    line.append(this.what, this.left, this.wind, this.carries, this.body);
    this.strip.append(this.who, line);
    this.balance.append(this.share);
    const sides = el("div", "possess-sides");
    sides.append(this.sides[0], this.balance, this.sides[1]);
    this.tally.append(sides, this.fallen);
    this.tally.hidden = true;
    this.head.append(this.strip, this.tally);
    // (What is told comes under the head however tall its lines make it: a long arm's maker wraps.)
    if (typeof ResizeObserver !== "undefined")
      new ResizeObserver(() => this.fitHead()).observe(this.head);
    this.base.append(this.knob);
    this.base.hidden = true;
    this.letGo.title = "Let go of them (Esc)";
    for (const pace of [1, 0.5, 0]) {
      const b = el("button", "possess-pace");
      b.dataset.pace = `${pace}`;
      this.press(b, () => {
        this.setPace(pace);
        this.onPace(this.pace);
      });
      this.paces.append(b);
    }
    this.slowBy(1);
    this.setPace(1);
    this.sprint.setAttribute("aria-pressed", "false");
    this.sprint.title = "Hold to sprint (Shift; the stick pushed to its rim also runs)";
    this.hold(this.sprint, this.sprintHeld);
    this.rise.setAttribute("aria-pressed", "false");
    this.rise.title = "Hold to fly up (Q); let go to glide down";
    this.rise.hidden = true;
    this.hold(this.rise, this.riseHeld);
    this.giftsButton.title = "The god's gifts (G)";
    this.giftsButton.setAttribute("aria-expanded", "false");
    this.sheet = new GiftsSheet((b, act) => this.press(b, act));
    this.press(this.giftsButton, () => this.toggleSheet());
    this.sheet.onClose = () => this.toggleSheet(false);
    this.sheet.onChange = (g) => this.giftsChanged(g);
    this.sheet.onStroke = (kind) => {
      this.arm(kind);
      this.toggleSheet(false);
    };
    for (let slot = 0; slot < 5; slot++) {
      const b = el("button", `possess-act possess-act-${slot}`);
      b.append(el("span", "possess-icon"), el("span", "possess-label"));
      this.press(b, () => {
        this.pressed.push(slot);
        b.classList.remove("struck");
        void b.offsetWidth;
        b.classList.add("struck");
      });
      this.acts.push(b);
      this.actsBox.append(b);
    }
    this.acts[4]!.hidden = true;
    this.press(this.letGo, () => this.onLetGo());
    this.press(this.liveDay, () => this.onLive());
    this.element.append(
      this.bubbles,
      this.head,
      this.told,
      this.paces,
      this.sprint,
      this.rise,
      this.giftsButton,
      this.letGo,
      this.liveDay,
      this.sheet.element,
      this.base,
      this.hint,
      this.actsBox,
    );
    const root = this.element;
    root.addEventListener("pointerdown", (e) => this.down(e));
    root.addEventListener("pointermove", (e) => this.move(e));
    for (const end of ["pointerup", "pointercancel"])
      root.addEventListener(end, (e) => this.up(e as PointerEvent));
    root.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.onZoom(Math.exp(-Math.sign(e.deltaY) * Math.min(1, Math.abs(e.deltaY) / 100) * 0.15));
      },
      { passive: false },
    );
    // (Nothing of the page's own: no menu on a long press, no gesture of Safari's.)
    root.addEventListener("contextmenu", (e) => e.preventDefault());
    root.addEventListener("gesturestart", (e) => e.preventDefault());
    parent.append(root);
  }

  /** A control held down (each finger on it, by its pointer), and let go as the finger lifts or leaves it. */
  private hold(b: HTMLButtonElement, held: Set<number>): void {
    const lit = () => b.setAttribute("aria-pressed", String(held.size > 0));
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      held.add(e.pointerId);
      lit();
    });
    for (const end of ["pointerup", "pointercancel", "pointerleave"])
      b.addEventListener(end, (e) => {
        e.stopPropagation();
        held.delete((e as PointerEvent).pointerId);
        lit();
      });
  }

  /** The gifts' sheet opened or closed (`open` absent: the other way); the acts and the stick wait under it. */
  private toggleSheet(open = !this.sheet.open): void {
    if (open) this.sheet.show();
    else this.sheet.hide();
    this.element.classList.toggle("gifting", open);
    this.giftsButton.setAttribute("aria-expanded", String(open));
  }

  /** The gifts now: Rise shown with wings, the healing touch with healing; a stroke waits no more without Smite. */
  private giftsChanged(gifts: number): void {
    const on = GIFTS.filter((g) => this.sheet.has(g));
    this.giftsButton.textContent = on.length ? `✨ Gifts ${on.length}` : "✨ Gifts";
    this.element.classList.toggle("gifted", on.length > 0);
    this.rise.hidden = !this.sheet.has("wings");
    if (this.rise.hidden) this.riseHeld.clear();
    if (!this.sheet.has("smite")) this.arm(-1);
    this.onGifts(gifts);
  }

  /** A stroke waiting for a touch on the world (-1: none). */
  private arm(kind: number): void {
    this.stroke = kind;
    this.sheet.armed(kind);
    this.element.classList.toggle("smiting", kind >= 0);
    if (kind >= 0) this.say("Touch the world where it is to fall (Esc: not now)");
  }

  /** The gifts on now (rules/gifts.ts GIFT_BIT), and those this body may be given (a beast none). */
  get gifts(): number {
    return this.sheet.on;
  }
  giftable(gifts: readonly Gift[]): void {
    this.sheet.offer(gifts);
    this.giftsButton.hidden = gifts.length === 0;
    if (!gifts.length && this.sheet.open) this.toggleSheet(false);
  }

  /** A control that acts as the press comes down, not on its release (no tap's wait). */
  private press(b: HTMLButtonElement, act: () => void): void {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      act();
    });
    // (Pressed by a key on a desk, as a click.)
    b.addEventListener("click", (e) => {
      if (e.detail === 0) act();
    });
  }

  get open(): boolean {
    return !this.element.hidden;
  }

  /** Shown, the page's own chrome put away; the keys its. */
  show(): void {
    this.element.hidden = false;
    document.body.classList.add("possessing");
    addEventListener("keydown", this.onKey, true);
    addEventListener("keyup", this.onKey, true);
    addEventListener("blur", this.onBlur);
    addEventListener("resize", this.onTurn);
    addEventListener("orientationchange", this.onTurn);
  }

  /** Put away, all it held let go. */
  hide(): void {
    this.element.hidden = true;
    document.body.classList.remove("possessing");
    removeEventListener("keydown", this.onKey, true);
    removeEventListener("keyup", this.onKey, true);
    removeEventListener("blur", this.onBlur);
    removeEventListener("resize", this.onTurn);
    removeEventListener("orientationchange", this.onTurn);
    this.release();
    this.onBlur();
    this.pressed = [];
    this.bubbles.replaceChildren();
    this.told.textContent = "";
    this.setTally(null);
    this.carriesIcon = "🎒";
    // (Each body taken comes to the hand without gifts.)
    this.toggleSheet(false);
    this.sheet.set(0);
    this.giftsChanged(0);
    this.slowBy(1);
  }

  /** Every touch let go (the phone turned: laid out again from nothing held). */
  private release(): void {
    this.sprintHeld.clear();
    this.riseHeld.clear();
    this.riseKey = false;
    this.sprint.setAttribute("aria-pressed", "false");
    this.rise.setAttribute("aria-pressed", "false");
    this.held.clear();
    this.push = { x: 0, y: 0 };
    this.base.hidden = true;
    this.pinch = 0;
  }

  /** The pace pressed (1, ½, 0 held), lit; the world's is it under Slow time's (`pace`). */
  setPace(pace: number): void {
    this.chosen = pace;
    for (const b of this.paces.children)
      (b as HTMLElement).classList.toggle("on", (b as HTMLElement).dataset.pace === `${pace}`);
  }

  /**
   * The world slowed under the god's Slow time (1: not): the paces then say the world's own, a quarter and an eighth,
   * and the one pressed stays lit — what is pressed is kept as the gift is put on and off.
   */
  slowBy(factor: number): void {
    this.factor = factor;
    for (const b of this.paces.children as HTMLCollectionOf<HTMLElement>) {
      const at = Number(b.dataset.pace) * factor,
        words = PACE_WORDS.find(([p]) => p === at);
      b.textContent = words?.[1] ?? `${at}×`;
      b.title = words?.[2] ?? "";
    }
  }

  /** The world's pace about him now: the one pressed, under Slow time's. */
  get pace(): number {
    return this.chosen * this.factor;
  }

  /** The stick's push now (x to the right, y ahead, each -1 … 1) and whether at a run: the thumb's, else the keys'. */
  stick(): { x: number; y: number; run: boolean; rise: boolean } {
    let { x, y } = this.push;
    if (!x && !y)
      for (const k of this.keys) {
        const a = AHEAD[k];
        if (a) {
          x += a[0];
          y += a[1];
        }
      }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return {
      x,
      y,
      run: this.sprintHeld.size > 0 || this.shift || Math.hypot(this.push.x, this.push.y) >= RUN_AT,
      rise: !this.rise.hidden && (this.riseHeld.size > 0 || this.riseKey),
    };
  }

  /** The acts pressed since last asked (their places), the first first. */
  takePressed(): number[] {
    const p = this.pressed;
    this.pressed = [];
    return p;
  }

  /** What the small world is now: the strip, the four acts, what the last came to. */
  set(live: Pick<PossessLive, "strip" | "offers" | "told">): void {
    const s = live.strip,
      strength = `${Math.round(s.strength * 100)}%`;
    put(this.who, s.name);
    put(this.what, s.what);
    if (this.strength.style.width !== strength) this.strength.style.width = strength;
    titled(this.left, `Strength left: ${strength}`);
    this.left.classList.toggle("low", s.strength < 0.35);
    // (His breath, shown only while a sprint has spent some of it.)
    const spent = s.wind !== undefined && s.wind < 0.995;
    if (this.wind.hidden === spent) this.wind.hidden = !spent;
    if (spent) {
      const w = `${Math.round(s.wind! * 100)}%`;
      if (this.windLeft.style.width !== w) this.windLeft.style.width = w;
      titled(this.wind, `Breath for a sprint: ${w}`);
      this.wind.classList.toggle("low", s.wind! < 0.25);
    }
    this.element.classList.toggle("aloft", (s.lift ?? 0) > 0.5);
    put(
      this.carries,
      s.carries === "empty-handed" ? "🤲 empty-handed" : `${this.carriesIcon} ${s.carries}`,
    );
    put(this.body, `🫀 ${s.body}`);
    const fifth = this.acts[4]!;
    if (fifth.hidden !== !live.offers[4]) fifth.hidden = !live.offers[4];
    live.offers.forEach((o, i) => {
      const b = this.acts[i];
      if (!b) return;
      put(b.firstElementChild as HTMLElement, o.icon);
      put(b.lastElementChild as HTMLElement, o.label);
      titled(b, `${o.words} (${ACT_KEYS[i] === "Space" ? "Space" : (ACT_KEYS[i] ?? "").slice(3)})`);
      if (b.getAttribute("aria-label") !== `${o.label}: ${o.words}`)
        b.setAttribute("aria-label", `${o.label}: ${o.words}`);
      b.classList.toggle("cannot", !o.can);
    });
    put(this.hint, live.offers[0]?.words ?? "");
    const t = live.told;
    if (t && this.told.dataset.step !== `${t.step}`) {
      this.told.dataset.step = `${t.step}`;
      this.told.textContent = t.words;
      this.told.classList.toggle("bad", !t.good);
      this.told.classList.remove("fresh");
      this.fitHead();
      void this.told.offsetWidth;
      this.told.classList.add("fresh");
    }
  }

  /**
   * What is told laid under the head as tall as it stands now: as it changes, and as a line is told
   * (laid out then anyway), so the first is under it too. Put away, the last height is kept.
   */
  private fitHead(): void {
    const px = Math.round(this.head.getBoundingClientRect().height);
    if (px <= 0) return;
    if (this.element.style.getPropertyValue("--possess-head") !== `${px}px`)
      this.element.style.setProperty("--possess-head", `${px}px`);
  }

  /**
   * A soldier's battle as it stands (null: none, put away): each side's realm and men standing (his
   * own lit), how the standing lie between them, the fallen of each and the last struck down named.
   */
  setTally(t: HeldTally | null): void {
    this.element.classList.toggle("tallied", !!t);
    if (this.tally.hidden !== !t) this.tally.hidden = !t;
    if (!t) return;
    const n = (v: number) => v.toLocaleString("en-US");
    t.sides.forEach((side, k) => {
      const e = this.sides[k as 0 | 1];
      const morale = side.morale === undefined ? "" : ` · morale ${Math.round(side.morale * 100)}%`;
      put(e, `${side.short} ${n(side.standing)}${morale}`);
      titled(e, `${side.realm}: ${n(side.standing)} standing, ${n(side.fallen)} fallen${morale}`);
      e.classList.toggle("mine", t.mine === k);
      e.classList.toggle("broken", t.broke === k);
    });
    const all = t.sides[0].standing + t.sides[1].standing,
      width = `${Math.round((all > 0 ? t.sides[0].standing / all : 0.5) * 100)}%`;
    if (this.share.style.width !== width) this.share.style.width = width;
    const last = t.named.at(-1),
      fell = `⚔️ ${n(t.sides[0].fallen)} · ${n(t.sides[1].fallen)} fallen`;
    put(
      this.fallen,
      last
        ? `${fell} — ${last.by} struck down ${last.name}${last.dead ? ", dead" : ""}${last.god ? " (by your hand)" : ""}`
        : fell,
    );
  }

  /** A line told at the top (a taking, a letting go, why one cannot be taken). */
  say(words: string, good = true): void {
    this.told.textContent = words;
    this.told.classList.toggle("bad", !good);
    this.told.classList.remove("fresh");
    this.fitHead();
    void this.told.offsetWidth;
    this.told.classList.add("fresh");
  }

  /** Words over the bodies that say something now (CSS px). */
  setBubbles(list: readonly { text: string; x: number; y: number }[]): void {
    while (this.bubbles.children.length < list.length)
      this.bubbles.append(el("span", "possess-bubble"));
    [...this.bubbles.children].forEach((c, i) => {
      const b = list[i],
        e = c as HTMLElement;
      if (e.hidden !== !b) e.hidden = !b;
      if (!b) return;
      put(e, b.text);
      const at = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px) translate(-50%, -100%)`;
      if (e.style.transform !== at) e.style.transform = at;
    });
  }

  private down(e: PointerEvent): void {
    e.preventDefault();
    const x = e.clientX,
      y = e.clientY;
    // A double tap anywhere off the controls: the eye behind him again.
    if (
      e.timeStamp - this.tapped.t < DOUBLE_MS &&
      Math.hypot(x - this.tapped.x, y - this.tapped.y) < DOUBLE_PX
    ) {
      this.tapped.t = -1e9;
      this.onBehind();
    }
    // The left half under a thumb: the stick, where it lands (kept within the half). A mouse looks.
    if (
      e.pointerType !== "mouse" &&
      x < innerWidth / 2 &&
      ![...this.held.values()].some((h) => h.kind === "stick")
    ) {
      const r = this.element.getBoundingClientRect(),
        x0 = Math.max(r.left + STICK_R + 8, Math.min(innerWidth / 2 - STICK_R, x)),
        y0 = Math.max(r.top + STICK_R + 90, Math.min(r.bottom - STICK_R - 8, y));
      this.held.set(e.pointerId, { kind: "stick", x0, y0, fromX: x, fromY: y, at: e.timeStamp });
      this.base.hidden = false;
      this.base.style.left = `${x0}px`;
      this.base.style.top = `${y0}px`;
      this.steer(e.pointerId, x, y);
      return;
    }
    this.held.set(e.pointerId, { kind: "look", x, y, x0: x, y0: y, at: e.timeStamp });
    this.pinch = this.spread();
  }

  private move(e: PointerEvent): void {
    const h = this.held.get(e.pointerId);
    if (!h) return;
    e.preventDefault();
    if (h.kind === "stick") return this.steer(e.pointerId, e.clientX, e.clientY);
    const looks = [...this.held.values()].filter((x) => x.kind === "look");
    if (looks.length >= 2) {
      // Two fingers: spread to come nearer, pinched to stand off.
      h.x = e.clientX;
      h.y = e.clientY;
      const s = this.spread();
      if (this.pinch > 0 && s > 0) this.onZoom(s / this.pinch);
      this.pinch = s;
      return;
    }
    this.onLook(e.clientX - h.x, e.clientY - h.y);
    h.x = e.clientX;
    h.y = e.clientY;
  }

  private up(e: PointerEvent): void {
    const h = this.held.get(e.pointerId);
    if (!h) return;
    this.held.delete(e.pointerId);
    const brief = e.type === "pointerup" && e.timeStamp - h.at < TAP_MS;
    if (h.kind === "stick") {
      this.push = { x: 0, y: 0 };
      this.base.hidden = true;
      this.knob.style.transform = "";
      // (A thumb lit and lifted on one spot meant what stands there: it did not mean to walk.)
      if (brief && Math.hypot(e.clientX - h.fromX, e.clientY - h.fromY) < TAP_PX)
        this.touched(e.clientX, e.clientY);
    } else if (Math.hypot(e.clientX - h.x0, e.clientY - h.y0) < TAP_PX) {
      this.tapped = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      if (brief) this.touched(e.clientX, e.clientY);
    }
    this.pinch = this.spread();
  }

  /** A spot of the world touched: a stroke waiting falls there; else what stands there is touched. */
  private touched(x: number, y: number): void {
    if (this.stroke >= 0) {
      const kind = this.stroke;
      this.arm(-1);
      this.onSmite(kind, x, y);
    } else this.onTap(x, y);
  }

  /** The stick pushed by the thumb at (x, y). */
  private steer(id: number, x: number, y: number): void {
    const h = this.held.get(id);
    if (!h || h.kind !== "stick") return;
    const dx = (x - h.x0) / STICK_R,
      dy = (y - h.y0) / STICK_R,
      l = Math.max(1, Math.hypot(dx, dy));
    this.push = { x: dx / l, y: -dy / l };
    this.knob.style.transform = `translate(${(dx / l) * STICK_R * 0.6}px, ${(dy / l) * STICK_R * 0.6}px)`;
  }

  /** How far apart two looking fingers are (0: not two). */
  private spread(): number {
    const looks = [...this.held.values()].filter(
      (x): x is Extract<Held, { kind: "look" }> => x.kind === "look",
    );
    return looks.length >= 2 ? Math.hypot(looks[0]!.x - looks[1]!.x, looks[0]!.y - looks[1]!.y) : 0;
  }

  /** A desk's keys, every one of them the possession's while it is shown (the clock's too). */
  private key(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    this.shift = e.shiftKey;
    if (e.code === "KeyQ") this.riseKey = e.type === "keydown";
    if (e.type === "keyup") {
      this.keys.delete(e.code);
      return;
    }
    if (e.repeat) return;
    // (Esc: the sheet closed, or a stroke not called; else let go.)
    if (e.code === "Escape") {
      if (this.sheet.open) return this.toggleSheet(false);
      if (this.stroke >= 0) return this.arm(-1);
      return this.onLetGo();
    }
    if (e.code === "KeyG" && !this.giftsButton.hidden) return this.toggleSheet();
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit && !this.giftsButton.hidden) {
      const g = GIFTS[Number(digit[1]) - 1];
      if (g) this.sheet.toggle(g);
      return;
    }
    const slot = ACT_KEYS.indexOf(e.code);
    if (slot >= 0 && !this.acts[slot]?.hidden) {
      this.pressed.push(slot);
      return;
    }
    if (AHEAD[e.code]) this.keys.add(e.code);
  }
}
