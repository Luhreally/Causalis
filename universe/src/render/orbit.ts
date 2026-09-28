// An orbit camera for mouse, touch and keys, steered as a builder's camera is (asked for
// 2026-09-28: "like the Sims 3"). Over a flat land a drag takes hold of the ground and moves
// it (one finger, or the left button); the right or middle button (or Alt or Ctrl with the
// left) turns and tilts; two fingers pinch to zoom, twist to turn and move up or down
// together to tilt. About a globe a drag turns it, held as its face is held. W A S D (or the
// arrows) go, Q and E turn, R and F tilt, + and − (or Z and X) zoom, Shift hurries (view/
// steer.ts). A tap (a press that barely moves) picks. A zoom goes toward what is under the
// pointer (Phase 10 M95), and the zoom that goes on through to the next scale goes into it.
// It turns by itself when left alone only if asked to (its drift).
import * as pc from "playcanvas";
import {
  BEYOND,
  STILL,
  asked,
  ease,
  flightAt,
  globeDrag,
  grabbed,
  steerKey,
  steerView,
  still,
  towardOnFlat,
  towardOnGlobe,
  zoomStep,
  type OrbitView,
  type Steer,
  type SteerAction,
} from "../view/index.ts";
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
  /** Each pointer down: where it was and began, and whether it turns (else it takes hold of the ground). */
  private readonly pointers = new Map<
    number,
    { x: number; y: number; startX: number; startY: number; turn: boolean }
  >();
  private pinch = 0;
  /** Two fingers' angle and middle height, last seen (a twist turns; moved up or down together, a tilt). */
  private twist: { angle: number; midY: number } | null = null;
  /** The keys held (what each asks), whether Shift is, and the velocity eased toward them. */
  private readonly held = new Set<SteerAction>();
  private hurry = false;
  private velocity: Steer = STILL;
  /** Whether the keys steer it (a page may keep them for itself). */
  keys = true;
  /** Told when the viewer moves the view on (a person followed is let go). */
  onLetGo: (() => void) | null = null;
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
  /** Whether it has the camera (free roam takes it, Phase 10 M98: then it neither moves nor listens). */
  enabled = true;
  /** Something kept in the middle as it moves (a person followed, M94); null: nothing. */
  follow: (() => Point | null) | null = null;
  /** A flight under way (M94): from where to where, how far along, how long it takes. */
  private flight: { from: OrbitView; to: OrbitView; t: number; seconds: number } | null = null;
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
      const f = (e: Event) => {
        if (this.enabled) (fn as (e: Event) => void)(e);
      };
      element.addEventListener(type, f, { passive: false });
      this.listeners.push([type, f]);
    };
    on<PointerEvent>("pointerdown", (e) => {
      this.flight = null;
      element.setPointerCapture(e.pointerId);
      // (Over a flat land a first finger or the left button takes hold of the ground; the
      // right or middle button, Alt or Ctrl with the left, or a person followed, turns.)
      const turn =
        !this.bounds ||
        e.button === 1 ||
        e.button === 2 ||
        e.altKey ||
        e.ctrlKey ||
        this.follow !== null;
      this.pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        turn,
      });
      this.pinch = this.spread();
      this.twist = this.fingers();
      this.idle = 0;
    });
    // (The middle button would scroll the page by itself; the right, open a menu.)
    on<MouseEvent>("mousedown", (e) => {
      if (e.button === 1) e.preventDefault();
    });
    on<MouseEvent>("contextmenu", (e) => e.preventDefault());
    on<PointerEvent>("pointermove", (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const fromX = p.x,
        fromY = p.y,
        dx = e.clientX - p.x,
        dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 1) {
        if (p.turn) this.turnBy(dx, dy);
        else this.grab(fromX, fromY, e.clientX, e.clientY);
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
        // A twist turns the view with the fingers; both moved up or down (the fingers not
        // spreading) tilt a flat land's.
        const f = this.fingers();
        if (f && this.twist) {
          let turned = f.angle - this.twist.angle;
          if (turned > Math.PI) turned -= 2 * Math.PI;
          else if (turned < -Math.PI) turned += 2 * Math.PI;
          this.yaw -= (turned * 180) / Math.PI;
          const rise = f.midY - this.twist.midY;
          if (this.bounds && Math.abs(spread - this.pinch) < Math.abs(rise) * 0.5)
            this.pitch = this.tilted(this.pitch - rise * 0.3);
        }
        this.twist = f;
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
      this.twist = this.fingers();
    };
    on<PointerEvent>("pointerup", up);
    on<PointerEvent>("pointercancel", (e) => {
      this.pointers.delete(e.pointerId);
      this.twist = this.fingers();
    });
    on<WheelEvent>("wheel", (e) => {
      e.preventDefault();
      this.flight = null;
      const rect = element.getBoundingClientRect();
      this.zoom(Math.exp(e.deltaY * 0.001), e.clientX - rect.left, e.clientY - rect.top);
      this.idle = 0;
    });
    // The keys: held, each asks a way; Shift hurries. (Not while a field is typed in, nor with
    // Ctrl or the command key — those are the browser's — nor the arrows over a page read.)
    const key = (e: KeyboardEvent, down: boolean) => {
      const a = steerKey(e);
      this.hurry = e.shiftKey;
      if (!a) return;
      if (!down) {
        this.held.delete(a);
        return;
      }
      if (!this.enabled || !this.keys || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (/^(Arrow|Page)/.test(e.code) && t?.closest?.(".inspector, .page-window, .palette"))
        return;
      this.held.add(a);
      this.flight = null;
      this.idle = 0;
      e.preventDefault();
    };
    const down = (e: Event) => key(e as KeyboardEvent, true),
      lift = (e: Event) => key(e as KeyboardEvent, false),
      blur = () => this.held.clear();
    addEventListener("keydown", down);
    addEventListener("keyup", lift);
    addEventListener("blur", blur);
    this.windowListeners.push(["keydown", down], ["keyup", lift], ["blur", blur]);
    stage.onUpdate((dt) => this.update(stage, dt));
  }

  private readonly windowListeners: [string, EventListener][] = [];

  /** Turn and tilt by a drag of so many pixels (about a globe, less the nearer its face). */
  private turnBy(dx: number, dy: number): void {
    const k = this.round ? globeDrag(this.distance) : 0.3;
    this.yaw -= dx * k;
    this.pitch = this.tilted(this.pitch - dy * k * (this.round ? 1 : 0.83));
  }

  private tilted(pitch: number): number {
    return Math.max(this.options.minPitch ?? -85, Math.min(this.options.maxPitch ?? -8, pitch));
  }

  /**
   * The ground under a pointer taken hold of, moved from one screen point to another: the
   * point that was under it comes under it again (past the horizon, where nothing is under
   * it, the land slides by the screen's own measure).
   */
  private grab(fromX: number, fromY: number, toX: number, toY: number): void {
    const rect = this.element.getBoundingClientRect(),
      a = this.anchor?.(fromX - rect.left, fromY - rect.top) ?? null,
      b = this.anchor?.(toX - rect.left, toY - rect.top) ?? null;
    let t: { x: number; y: number; z: number };
    if (a && b) t = grabbed(this.target, a, b, this.bounds);
    else {
      const k = (this.distance * 1.4) / Math.max(1, rect.height),
        yaw = (this.yaw * Math.PI) / 180,
        dx = (toX - fromX) * k,
        dy = (toY - fromY) * k;
      // (Dragged right, the land goes right: the middle goes left; dragged down, it comes near.)
      t = grabbed(
        this.target,
        { x: 0, y: 0, z: 0 },
        {
          x: Math.cos(yaw) * dx - Math.sin(yaw) * dy,
          y: 0,
          z: -Math.sin(yaw) * dx - Math.cos(yaw) * dy,
        },
        this.bounds,
      );
    }
    this.target.set(t.x, t.y, t.z);
  }

  /** Two fingers' angle and the height of their middle (null: not two). */
  private fingers(): { angle: number; midY: number } | null {
    const ps = [...this.pointers.values()];
    if (ps.length !== 2) return null;
    const [a, b] = ps as [(typeof ps)[number], (typeof ps)[number]];
    return { angle: Math.atan2(b.y - a.y, b.x - a.x), midY: (a.y + b.y) / 2 };
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
    // (A flight of the scale left behind ends with it.)
    this.flight = null;
  }

  /** End a flight under way (the view is being set outright). */
  halt(): void {
    this.flight = null;
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

  /** Where it stands now: its target, turn, tilt and distance. */
  get view(): OrbitView {
    return {
      target: { x: this.target.x, y: this.target.y, z: this.target.z },
      yaw: this.yaw,
      pitch: this.pitch,
      distance: this.distance,
    };
  }

  /**
   * Fly to a view (M94) over `seconds`: eased, turning the short way, drawing back and in
   * again on a long way (view/zoom.ts flightAt). What is not asked stays as it is; the
   * viewer's touch ends it.
   */
  flyTo(to: Partial<OrbitView>, seconds = 1.1): void {
    const from = this.view,
      l = this.limits;
    this.flight = {
      from,
      to: {
        target: to.target ?? from.target,
        yaw: to.yaw ?? from.yaw,
        pitch: Math.max(l.minPitch, Math.min(l.maxPitch, to.pitch ?? from.pitch)),
        distance: Math.max(l.min, Math.min(l.max, to.distance ?? from.distance)),
      },
      t: 0,
      seconds,
    };
    this.userZoomed = true;
    this.idle = 0;
  }

  /** Whether the keys are steering it now (or it is coming to rest from them). */
  get steering(): boolean {
    return !still(this.velocity);
  }

  /** Whether a flight is under way. */
  get flying(): boolean {
    return this.flight !== null;
  }

  /** A tap at a point of the screen, as if pressed there (free roam's taps pick as the orbit's do). */
  tap(x: number, y: number): void {
    this.options.onTap(x, y);
  }

  /** How near and far it goes, and how low and high it tilts. */
  get limits(): { min: number; max: number; minPitch: number; maxPitch: number } {
    return {
      min: this.options.minDistance,
      max: this.options.maxDistance,
      minPitch: this.options.minPitch ?? -85,
      maxPitch: this.options.maxPitch ?? -8,
    };
  }

  private update(stage: Stage, dt: number): void {
    // (Its camera taken, a flight under way ends: it would fly on from where it was, later.)
    if (!this.enabled) {
      this.flight = null;
      return;
    }
    this.idle += dt;
    const f = this.flight;
    if (f) {
      f.t = Math.min(1, f.t + dt / f.seconds);
      const v = flightAt(f.from, f.to, f.t);
      this.target.set(v.target.x, v.target.y, v.target.z);
      this.yaw = v.yaw;
      this.pitch = v.pitch;
      this.distance = v.distance;
      this.idle = 0;
      if (f.t >= 1) this.flight = null;
    } else if (this.follow) {
      // Kept in the middle: the view eases after it, a little behind, as a camera follows.
      const p = this.follow();
      if (p) {
        const k = 1 - Math.exp(-dt * 4);
        this.target.set(
          this.target.x + (p.x - this.target.x) * k,
          this.target.y + (p.y - this.target.y) * k,
          this.target.z + (p.z - this.target.z) * k,
        );
      }
    }
    // The keys: the view steered by the velocity eased toward what they ask. (Going on over
    // the land lets a person followed go; zooming toward the middle of the screen.)
    this.velocity = ease(this.velocity, asked(this.held), dt);
    if (!still(this.velocity)) {
      if (this.follow && (this.velocity.ahead || this.velocity.aside)) {
        this.follow = null;
        this.onLetGo?.();
      }
      const scene = this.round ? "round" : this.bounds ? "flat" : "space",
        next = steerView(this.view, this.velocity, dt, scene, this.hurry, this.limits, this.bounds);
      this.target.set(next.target.x, next.target.y, next.target.z);
      this.yaw = next.yaw;
      this.pitch = next.pitch;
      if (next.zoom !== 1) {
        const rect = this.element.getBoundingClientRect();
        this.zoom(next.zoom, rect.width / 2, rect.height / 2);
      }
      this.idle = 0;
    }
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
    for (const [type, f] of this.windowListeners) removeEventListener(type, f);
  }
}

/** Whether a key goes to a field being typed in (not to the camera). */
function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return (
    !!t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable)
  );
}
