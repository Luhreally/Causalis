// Free roam's controls (Phase 10 M98): a button to take the camera and give it back, one to
// walk among a village's people rather than fly, a line of how to steer it, and on a phone
// a stick to push and buttons up and down. The era's glossy buttons, over the scene.
import { el } from "./why.ts";

export type FreeMode = "orbit" | "fly" | "walk";

export class FreeControls {
  readonly element = el("div", "free-controls");
  private readonly fly = el("button", "free-fly", "🎥");
  private readonly walk = el("button", "free-walk", "🚶");
  private readonly hint = el("div", "free-hint");
  private readonly pad = el("div", "free-pad");
  private readonly knob = el("span", "free-knob");
  private mode: FreeMode = "orbit";
  /** Asked for a mode (the page decides whether it can be had here). */
  onMode: (mode: FreeMode) => void = () => {};
  /** The stick's push: -1 … 1 ahead and aside, and up (the buttons). */
  onStick: (stick: { ahead: number; aside: number; up: number }) => void = () => {};
  private stick = { ahead: 0, aside: 0, up: 0 };

  constructor(parent: HTMLElement) {
    this.fly.title = "Free camera: fly where you will";
    this.fly.setAttribute("aria-label", "Free camera");
    this.walk.title = "Walk among the people";
    this.walk.setAttribute("aria-label", "Walk among the people");
    this.fly.onclick = () => this.onMode(this.mode === "fly" ? "orbit" : "fly");
    this.walk.onclick = () => this.onMode(this.mode === "walk" ? "orbit" : "walk");
    // The phone's stick: a pad and its knob; and up and down beside it.
    this.pad.append(this.knob);
    const rise = el("button", "free-up", "▲"),
      sink = el("button", "free-down", "▼"),
      heights = el("div", "free-heights");
    heights.append(rise, sink);
    const hold = (b: HTMLElement, up: number) => {
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.push({ up });
      });
      for (const end of ["pointerup", "pointercancel", "pointerleave"])
        b.addEventListener(end, () => this.push({ up: 0 }));
    };
    hold(rise, 1);
    hold(sink, -1);
    let pressing: number | null = null;
    const steer = (e: PointerEvent) => {
      const r = this.pad.getBoundingClientRect(),
        dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2),
        dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2),
        l = Math.max(1, Math.hypot(dx, dy)),
        x = dx / l,
        y = dy / l;
      this.knob.style.transform = `translate(${(x * r.width) / 3}px, ${(y * r.height) / 3}px)`;
      this.push({ ahead: -y, aside: x });
    };
    this.pad.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      pressing = e.pointerId;
      try {
        this.pad.setPointerCapture(e.pointerId);
      } catch {
        // (A pointer not seen going down: steered without capture.)
      }
      steer(e);
    });
    this.pad.addEventListener("pointermove", (e) => {
      if (pressing === e.pointerId) steer(e);
    });
    const letGo = (e: PointerEvent) => {
      if (pressing !== e.pointerId) return;
      pressing = null;
      this.knob.style.transform = "";
      this.push({ ahead: 0, aside: 0 });
    };
    this.pad.addEventListener("pointerup", letGo);
    this.pad.addEventListener("pointercancel", letGo);
    const buttons = el("div", "free-buttons");
    buttons.append(this.fly, this.walk);
    const steering = el("div", "free-steer");
    steering.append(this.pad, heights);
    this.element.append(buttons, this.hint, steering);
    parent.append(this.element);
    this.set("orbit", false);
  }

  private push(p: Partial<{ ahead: number; aside: number; up: number }>): void {
    this.stick = { ...this.stick, ...p };
    this.onStick(this.stick);
  }

  /** Show the mode taken, and whether walking can be had here (a village). */
  set(mode: FreeMode, canWalk: boolean): void {
    this.mode = mode;
    this.fly.classList.toggle("on", mode === "fly");
    this.walk.classList.toggle("on", mode === "walk");
    this.walk.hidden = !canWalk;
    this.element.classList.toggle("roaming", mode !== "orbit");
    this.element.classList.toggle("walking", mode === "walk");
    const touch = matchMedia("(pointer: coarse)").matches;
    this.hint.textContent =
      mode === "orbit"
        ? ""
        : touch
          ? `${mode === "walk" ? "Walking" : "Flying"}: push the stick to go, drag to look${mode === "fly" ? ", ▲ ▼ to rise and sink" : ""}`
          : `${mode === "walk" ? "Walking" : "Flying"}: W A S D to go, drag to look${mode === "fly" ? ", E and Q to rise and sink" : ""}, Shift to hurry, Esc to stop`;
    this.hint.hidden = mode === "orbit";
  }
}
