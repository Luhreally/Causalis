// An orbit camera for mouse and touch: drag to turn, wheel or pinch to zoom, a
// tap (a press that barely moves) to pick. It drifts slowly when left alone. A zoom goes
// toward what is under the pointer (Phase 10 M95): a flat scene slides it toward the middle,
// a globe turns it there; and the zoom that goes on through to the next scale goes into it.
import * as pc from "playcanvas";
import { BEYOND, towardOnFlat, towardOnGlobe, zoomStep } from "../view/index.ts";
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

/** A point of the scene. */
type Point = { readonly x: number; readonly y: number; readonly z: number };

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
  /**
   * Called as the viewer pushes on past the nearest or the farthest view (M88): the zoom
   * goes through to the next scale in, or out.
   */
  onBeyond: ((way: "in" | "out") => void) | null = null;
  /** How far past an edge the viewer has pushed (the log of the zoom asked beyond it), and which. */
  private beyond = 0;
  private beyondWay: "in" | "out" = "out";
  /**
   * The point of the scene under a screen point (CSS pixels), for zooming toward it; null
   * where it has none (the sky past a globe's rim). Each scale sets its own.
   */
  anchor: ((x: number, y: number) => Point | null) | null = null;
  /** Whether the scene is a globe about the target (turned toward the point) or flat (slid). */
  round = false;
  /** How far from its middle the target may slide on a flat scene (x and z), if bounded. */
  bounds: { readonly x: number; readonly z: number; readonly reach: number } | null = null;
  /** The point the last zoom went toward (in the scene), for going through into what is there. */
  aimed: Point | null = null;
  /** And where on the screen (CSS pixels) it was aimed from. */
  pointer: { readonly x: number; readonly y: number } | null = null;
  /**
   * The shares of the screen's height covered from the top (a bar of buttons) and from the
   * bottom (a sheet): the subject is framed in the band between, as a phone's screen is
   * mostly bar and sheet.
   */
  covered: () => { top: number; bottom: number } = () => ({ top: 0, bottom: 0 });
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
        const spread = this.spread(),
          [a, b] = [...this.pointers.values()],
          rect = element.getBoundingClientRect();
        if (this.pinch > 0)
          this.zoom(
            this.pinch / spread,
            (a!.x + b!.x) / 2 - rect.left,
            (a!.y + b!.y) / 2 - rect.top,
          );
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
      const rect = element.getBoundingClientRect();
      this.zoom(Math.exp(e.deltaY * 0.001), e.clientX - rect.left, e.clientY - rect.top);
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
    this.aimed = null;
    this.pointer = null;
  }

  /** Turn to face a direction from the target (for a globe: a place by its latitude and longitude). */
  face(latDeg: number, lonDeg: number): void {
    this.yaw = lonDeg;
    this.pitch = Math.max(
      this.options.minPitch ?? -85,
      Math.min(this.options.maxPitch ?? -8, -latDeg),
    );
    this.idle = 0;
  }

  private spread(): number {
    const ps = [...this.pointers.values()];
    return ps.length < 2 ? 0 : Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y);
  }

  /**
   * How near its edges the view stands: -1 at its nearest, 1 at its farthest, 0 between
   * (by the log of the distance, over the last fifth of the range at each end).
   */
  get edge(): number {
    const lo = Math.log(this.options.minDistance),
      hi = Math.log(this.options.maxDistance),
      at = (Math.log(this.distance) - lo) / Math.max(1e-6, hi - lo);
    return at > 0.8 ? (at - 0.8) / 0.2 : at < 0.2 ? -(0.2 - at) / 0.2 : 0;
  }

  /** How far past the edge the viewer is pushing now (0 … 1: at one, it goes through). */
  get pushing(): number {
    return Math.min(1, this.beyond / BEYOND);
  }

  /** Zoom by `factor`, toward what is under a screen point (CSS pixels) when one is given. */
  zoom(factor: number, x?: number, y?: number): void {
    this.userZoomed = true;
    const lo = this.options.minDistance,
      hi = this.options.maxDistance,
      before = this.distance,
      at = x !== undefined && y !== undefined && this.anchor ? this.anchor(x, y) : null;
    this.aimed = at;
    this.pointer = x !== undefined && y !== undefined ? { x, y } : null;
    if (!this.onBeyond) {
      this.distance = Math.max(lo, Math.min(hi, this.distance * factor));
      this.toward(at, this.distance / before);
      return;
    }
    // Pushing on past an edge gathers, and goes through to the next scale (view/zoom.ts).
    const next = zoomStep(
      { distance: this.distance, beyond: this.beyond, way: this.beyondWay },
      factor,
      lo,
      hi,
    );
    this.distance = next.distance;
    this.beyond = next.beyond;
    this.beyondWay = next.way;
    this.toward(at, this.distance / before);
    if (next.through) this.onBeyond(next.through);
  }

  /** Move the view toward (or, drawing back, away from) a point as the distance goes by `k`. */
  private toward(at: Point | null, k: number): void {
    if (!at || k === 1) return;
    if (this.round) {
      const turned = towardOnGlobe(this.yaw, this.pitch, at, k);
      this.yaw = turned.yaw;
      this.pitch = Math.max(
        this.options.minPitch ?? -85,
        Math.min(this.options.maxPitch ?? -8, turned.pitch),
      );
      return;
    }
    const slid = towardOnFlat(this.target, at, k, this.bounds);
    this.target.x = slid.x;
    this.target.z = slid.z;
  }

  private update(stage: Stage, dt: number): void {
    this.idle += dt;
    // (A push past the edge let go of eases off.)
    this.beyond *= Math.exp(-dt * 1.5);
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
    // Framed below what covers the top: the camera lifted, looking on, so the subject sits
    // in the middle of what is left (the camera itself moves, so picking stays true).
    const c = this.covered(),
      shift = Math.max(-0.6, Math.min(0.6, c.top - c.bottom));
    if (shift) {
      const half = Math.tan(((stage.camera.camera!.fov / 2) * Math.PI) / 180) * d;
      stage.camera.translateLocal(0, half * shift, 0);
    }
  }

  destroy(): void {
    for (const [type, f] of this.listeners) this.element.removeEventListener(type, f);
  }
}
