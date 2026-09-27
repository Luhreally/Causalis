// Free roam's camera (Phase 10 M98): the keys and the mouse on a desk — W A S D (or the
// arrows) to go ahead, back and aside, Q and E down and up, Shift to hurry, a drag to look
// about, the wheel to go ahead and back — and on a phone a stick to push and a drag to look.
// It moves by view/free.ts and stands the stage's camera where it is; a tap still picks.
import * as pc from "playcanvas";
import { freeLook, freeStep, type FreeRules, type FreeState } from "../view/index.ts";
import type { Stage } from "./stage.ts";

/** The keys that steer it: which way each pushes (ahead, aside, up). */
const KEYS: Readonly<Record<string, readonly [number, number, number]>> = {
  KeyW: [1, 0, 0],
  ArrowUp: [1, 0, 0],
  KeyS: [-1, 0, 0],
  ArrowDown: [-1, 0, 0],
  KeyA: [0, -1, 0],
  ArrowLeft: [0, -1, 0],
  KeyD: [0, 1, 0],
  ArrowRight: [0, 1, 0],
  KeyE: [0, 0, 1],
  Space: [0, 0, 1],
  KeyQ: [0, 0, -1],
  KeyC: [0, 0, -1],
};

export class FreeRig {
  state: FreeState = { x: 0, y: 10, z: 0, yaw: 0, pitch: -20 };
  rules: FreeRules = { speed: 1, height: 10, clearance: 0.5 };
  /** The ground's height under a point of the scene (null: none, as among the stars). */
  ground: (x: number, z: number) => number | null = () => null;
  /** What the scene keeps it out of (a village's walls, a globe's face): where it may stand instead. */
  keep: ((s: FreeState) => FreeState) | null = null;
  /** A tap (a press that barely moves): what is there is picked, as the orbit picks it. */
  onTap: (x: number, y: number) => void = () => {};
  /** Told each step, after it moved (to go on through the scales by height). */
  onMoved: (s: FreeState) => void = () => {};
  private readonly held = new Set<string>();
  private fast = false;
  /** The stick's push (a phone's): -1 … 1 ahead and aside. */
  stick = { ahead: 0, aside: 0, up: 0 };
  private active = false;
  private drag: { id: number; x: number; y: number; startX: number; startY: number } | null = null;
  private readonly element: HTMLElement;
  private readonly stage: Stage;

  constructor(stage: Stage, element: HTMLElement) {
    this.stage = stage;
    this.element = element;
    addEventListener("keydown", (e) => {
      if (!this.active || isTyping(e)) return;
      if (e.code in KEYS) {
        this.held.add(e.code);
        e.preventDefault();
      }
      this.fast = e.shiftKey;
    });
    addEventListener("keyup", (e) => {
      this.held.delete(e.code);
      this.fast = e.shiftKey;
    });
    addEventListener("blur", () => this.held.clear());
    element.addEventListener("pointerdown", (e) => {
      if (!this.active || this.drag) return;
      this.drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      };
    });
    element.addEventListener("pointermove", (e) => {
      const d = this.drag;
      if (!this.active || !d || d.id !== e.pointerId) return;
      // Looking about: the drag turns the view (as a head turns), not the world.
      const s = this.state;
      this.state = {
        ...s,
        yaw: s.yaw + (e.clientX - d.x) * 0.25,
        pitch: Math.max(-88, Math.min(70, s.pitch - (e.clientY - d.y) * 0.2)),
      };
      d.x = e.clientX;
      d.y = e.clientY;
    });
    const up = (e: PointerEvent) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (this.active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) {
        const rect = element.getBoundingClientRect();
        this.onTap(e.clientX - rect.left, e.clientY - rect.top);
      }
    };
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", (e) => {
      if (this.drag?.id === e.pointerId) this.drag = null;
    });
    element.addEventListener(
      "wheel",
      (e) => {
        if (!this.active) return;
        e.preventDefault();
        // The wheel goes ahead and back, a step at a time.
        this.state = freeStep(
          this.state,
          { ahead: -Math.sign(e.deltaY), aside: 0, up: 0, fast: e.shiftKey },
          0.35,
          this.rules,
          this.ground,
        );
      },
      { passive: false },
    );
    stage.onUpdate((dt) => this.update(dt));
  }

  get on(): boolean {
    return this.active;
  }

  /** Take the camera: from `from`, or from where it stands, looking where it looks. */
  start(rules: FreeRules, from?: FreeState): void {
    this.rules = rules;
    if (from) this.state = from;
    else {
      const cam = this.stage.camera,
        p = cam.getPosition(),
        f = cam.forward;
      this.state = {
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: (Math.atan2(-f.x, -f.z) * 180) / Math.PI,
        pitch: (Math.asin(Math.max(-1, Math.min(1, f.y))) * 180) / Math.PI,
      };
    }
    this.active = true;
  }

  /** Give the camera back; `passing` on to another scale, the keys held stay held. */
  stop(passing = false): void {
    this.active = false;
    this.drag = null;
    if (passing) return;
    this.held.clear();
    this.stick = { ahead: 0, aside: 0, up: 0 };
  }

  private update(dt: number): void {
    if (!this.active) return;
    let ahead = this.stick.ahead,
      aside = this.stick.aside,
      up = this.stick.up;
    for (const k of this.held) {
      const [a, s, u] = KEYS[k]!;
      ahead += a;
      aside += s;
      up += u;
    }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    if (ahead || aside || up)
      this.state = freeStep(
        this.state,
        { ahead: clamp(ahead), aside: clamp(aside), up: clamp(up), fast: this.fast },
        Math.min(dt, 0.1),
        this.rules,
        this.ground,
      );
    if (this.keep) this.state = this.keep(this.state);
    const s = this.state,
      look = freeLook(s.yaw, s.pitch),
      cam = this.stage.camera;
    cam.setPosition(s.x, s.y, s.z);
    cam.lookAt(new pc.Vec3(s.x + look.x, s.y + look.y, s.z + look.z));
    this.onMoved(s);
  }
}

/** Whether a key goes to a field being typed in (not to the camera). */
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}
