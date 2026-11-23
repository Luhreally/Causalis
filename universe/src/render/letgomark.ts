// The one let go marked (asked 2026-11-23: at night, from where the camera lands, he was hard to pick out): the gold ring
// about his feet and the point of light over his head that a soldier held wears (render/battle.ts MARKED), kept on a
// townsman, a soldier or a beast as the camera flies out from where his eye stood, then faded out over LET_GO_FADE seconds
// once it lands. By degrees, never at once.
import * as pc from "playcanvas";
import { MARKED, MARK_LIGHT } from "./battle.ts";
import { coneMesh, ringMesh } from "./batch.ts";
import type { Stage } from "./stage.ts";

/** Seconds the mark takes to fade once the camera lands. */
export const LET_GO_FADE = 2;
/** Seconds a mark not worn while held (a townsman's, a beast's) takes to come on as the camera sets out. */
export const LET_GO_IN = 0.4;
/**
 * At least how big the mark is drawn, of its distance from the eye (as a body's height): from as far as the camera lands, a
 * man's own ring is a dot; drawn so, it reads the same on the screen however far off it is.
 */
const LET_GO_SEEN = 0.08;
/** How much bigger than a held soldier's the point of light over the head is drawn (seen from as far as the camera lands). */
const POINT_BIGGER = 1.6;

/** Where the one let go stands now (metres from the scene's middle, units per metre `metre`), and how tall (metres). */
export type LetGoAt = {
  readonly x: number;
  readonly z: number;
  readonly lift?: number;
  readonly tall: number;
};

export class LetGoMark {
  private readonly stage: Stage;
  /** Its own root (a village's rebuild keeps it: render/village.ts buildSteps). */
  readonly root = new pc.Entity("let-go");
  private readonly ring: pc.Entity;
  private readonly point: pc.Entity;
  private readonly materials: pc.StandardMaterial[] = [];
  /** Where it stands, how it is followed, whether the camera still flies; null: none marked. */
  private on: {
    at: () => LetGoAt | null;
    flying: () => boolean;
    landed: number | null;
    last: LetGoAt | null;
    /** When it was put on (the app's clock), and whether it comes on by degrees from then. */
    since: number;
    gentle: boolean;
  } | null = null;

  /** The app's own clock (seconds: held when it is held), which the fade goes by. */
  private clock = 0;

  /** Under `parent`, its scene `metre` units to the metre; it moves itself each frame. */
  constructor(stage: Stage, parent: pc.Entity, metre: number) {
    this.stage = stage;
    // (Lit by nothing but itself, as bright in the shade and at night as in the sun; drawn over all before it, the ring
    // about his feet too: from as high as the camera lands, a street's walls stand about it.)
    const light = (over: boolean) => {
      const m = new pc.StandardMaterial();
      m.useLighting = false;
      m.diffuse = new pc.Color(0, 0, 0);
      m.emissive = new pc.Color(...MARK_LIGHT);
      m.blendType = pc.BLEND_NORMAL;
      m.opacity = 1;
      m.depthWrite = false;
      m.depthTest = !over;
      m.update();
      this.materials.push(m);
      return m;
    };
    this.ring = new pc.Entity("let-go-ring");
    this.ring.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(ringMesh(stage, MARKED.inner, MARKED.outer), light(true)),
      ],
      castShadows: false,
    });
    this.point = new pc.Entity("let-go-mark");
    this.point.addComponent("render", {
      meshInstances: [new pc.MeshInstance(coneMesh(stage, 0.5, 1, 4), light(true))],
      castShadows: false,
    });
    this.ring.enabled = this.point.enabled = false;
    parent.addChild(this.root);
    this.root.addChild(this.ring);
    this.root.addChild(this.point);
    stage.onUpdate((dt) => {
      this.clock += dt;
      this.update(metre);
    });
  }

  /**
   * Mark one let go: where they stand, read each frame (null: not seen now, where last seen), whether the camera still flies
   * out, where they stood as let go (null: none marked), and whether it comes on by degrees (`gentle`: one who did not wear
   * it while held) or at once (a soldier, whose own it takes over).
   */
  show(
    at: (() => LetGoAt | null) | null,
    flying: () => boolean = () => false,
    first: LetGoAt | null = null,
    gentle = true,
  ): void {
    this.on = at ? { at, flying, landed: null, last: first, since: this.clock, gentle } : null;
    if (!at) this.ring.enabled = this.point.enabled = false;
  }

  /** Whether one is marked now (the look tools), and how much of the mark is drawn. */
  get shown(): number {
    return this.ring.enabled ? (this.materials[0]?.opacity ?? 0) : 0;
  }

  /** The mark at the frame's moment (`metre`: the scene's units per metre). */
  private update(metre: number): void {
    const now = this.clock;
    const on = this.on;
    if (!on) return;
    if (on.flying()) on.landed = null;
    else on.landed ??= now;
    const u = on.landed === null ? 0 : Math.min(1, (now - on.landed) / LET_GO_FADE),
      v = on.gentle ? Math.min(1, (now - on.since) / LET_GO_IN) : 1,
      alpha = Math.min(1 - u * u * (3 - 2 * u), v * v * (3 - 2 * v)),
      // (Gone in somewhere meanwhile, or no longer drawn: where it was last seen, fading as it would.)
      at = u < 1 ? (on.last = on.at() ?? on.last) : null;
    if (!at) {
      this.show(null);
      return;
    }
    if (this.materials[0]!.opacity !== alpha)
      for (const m of this.materials) {
        m.opacity = alpha;
        m.update();
      }
    const tall = at.tall * metre,
      foot = (at.lift ?? 0) * metre;
    this.ring.enabled = this.point.enabled = true;
    this.ring.setLocalPosition(at.x * metre, foot + 0.006, at.z * metre);
    // (As big as he is near the eye; far off, as big as it must be to be seen.)
    const far = this.ring.getPosition().distance(this.stage.camera.getPosition()),
      big = Math.max(tall, far * LET_GO_SEEN);
    this.ring.setLocalScale(big, 1, big);
    this.point.setLocalPosition(
      at.x * metre,
      foot + tall + big * (MARKED.over + (POINT_BIGGER * MARKED.tall) / 2),
      at.z * metre,
    );
    this.point.setLocalEulerAngles(180, 0, 0);
    const p = POINT_BIGGER * big;
    this.point.setLocalScale(2 * MARKED.wide * p, MARKED.tall * p, 2 * MARKED.wide * p);
  }
}
