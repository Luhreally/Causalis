// An orbit camera for mouse and touch: drag to turn, wheel or pinch to zoom, a
// tap (a press that barely moves) to pick. It drifts slowly when left alone.
import * as pc from "playcanvas";
import type { Stage } from "./stage.ts";

export type OrbitOptions = {
  readonly distance: number;
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly pitch: number;
  /** Pitch limits in degrees (defaults: looking down at a table, -85 to -8). */
  readonly minPitch?: number;
  readonly maxPitch?: number;
  /** Degrees per second the camera drifts when left alone. */
  readonly drift?: number;
  readonly onTap: (x: number, y: number) => void;
};

export class OrbitRig {
  yaw = 30;
  pitch: number;
  distance: number;
  readonly target = new pc.Vec3(0, 0, 0);
  private options: OrbitOptions;
  private readonly pointers = new Map<
    number,
    { x: number; y: number; startX: number; startY: number }
  >();
  private pinch = 0;
  /** True once the viewer has zoomed by hand; fitting then leaves the distance alone. */
  userZoomed = false;
  private idle = 0;
  private readonly element: HTMLElement;
  private readonly listeners: [string, (e: Event) => void][] = [];

  constructor(stage: Stage, element: HTMLElement, options: OrbitOptions) {
    this.options = options;
    this.pitch = options.pitch;
    this.distance = options.distance;
    this.element = element;
    element.style.touchAction = "none";
    const on = <E extends Event>(type: string, fn: (e: E) => void) => {
      const f = fn as (e: Event) => void;
      element.addEventListener(type, f, { passive: false });
      this.listeners.push([type, f]);
    };
    on<PointerEvent>("pointerdown", (e) => {
      element.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      });
      this.pinch = this.spread();
      this.idle = 0;
    });
    on<PointerEvent>("pointermove", (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x,
        dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 1) {
        this.yaw -= dx * 0.3;
        this.pitch = Math.max(
          this.options.minPitch ?? -85,
          Math.min(this.options.maxPitch ?? -8, this.pitch - dy * 0.25),
        );
      } else if (this.pointers.size === 2) {
        const spread = this.spread();
        if (this.pinch > 0) this.zoom(this.pinch / spread);
        this.pinch = spread;
      }
      this.idle = 0;
    });
    const up = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (
        p &&
        this.pointers.size === 0 &&
        Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < 6
      ) {
        const rect = element.getBoundingClientRect();
        this.options.onTap(e.clientX - rect.left, e.clientY - rect.top);
      }
      this.pinch = this.spread();
    };
    on<PointerEvent>("pointerup", up);
    on<PointerEvent>("pointercancel", (e) => this.pointers.delete(e.pointerId));
    on<WheelEvent>("wheel", (e) => {
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY * 0.001));
      this.idle = 0;
    });
    stage.onUpdate((dt) => this.update(stage, dt));
  }

  /** Move to another scale: new limits, a new target and distance, zoom state reset. */
  configure(options: Partial<OrbitOptions> & { target?: [number, number, number] }): void {
    this.options = { ...this.options, ...options };
    if (options.distance !== undefined) this.distance = options.distance;
    if (options.pitch !== undefined) this.pitch = options.pitch;
    if (options.target) this.target.set(options.target[0], options.target[1], options.target[2]);
    this.userZoomed = false;
    this.idle = 0;
  }

  private spread(): number {
    const ps = [...this.pointers.values()];
    return ps.length < 2 ? 0 : Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y);
  }

  private zoom(factor: number): void {
    this.userZoomed = true;
    this.distance = Math.max(
      this.options.minDistance,
      Math.min(this.options.maxDistance, this.distance * factor),
    );
  }

  private update(stage: Stage, dt: number): void {
    this.idle += dt;
    if (this.idle > 4 && this.pointers.size === 0) this.yaw += dt * (this.options.drift ?? 2.5);
    const yaw = (this.yaw * Math.PI) / 180,
      pitch = (this.pitch * Math.PI) / 180,
      d = this.distance;
    stage.camera.setPosition(
      this.target.x + d * Math.cos(pitch) * Math.sin(yaw),
      this.target.y - d * Math.sin(pitch),
      this.target.z + d * Math.cos(pitch) * Math.cos(yaw),
    );
    stage.camera.lookAt(this.target);
  }

  destroy(): void {
    for (const [type, f] of this.listeners) this.element.removeEventListener(type, f);
  }
}
