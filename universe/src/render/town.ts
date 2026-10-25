// A town's fabric drawn (Phase 23 M149): the parts the view lays out, in batches by mesh and
// colour — its ground and what stands all year in one set, put once as the year's plan comes;
// what rises through the year (homes climbing in their scaffolds, buildings, walls) in another,
// put again as it climbs. One unit is ten metres, as in the village.
import * as pc from "playcanvas";
import { LOT, civicMoments, footprint, progress, type TownPlan } from "../bridge/index.ts";
import {
  TownParts,
  blazeNow,
  civicChimneys,
  civicMotions,
  civicsActive,
  lotNear,
  roofTop,
  townCivics,
  townGround,
  townHomes,
  townScene,
  townThingAt,
  townWalls,
  strikeSpan,
  strikeTurned,
  type BlazeNow,
  type CivicMotion,
  type PartMesh,
  type TownScene,
  type TownThing,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, gableMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1;
/** How often what rises is put again (moments of the sim apart, at the least): a few times a day. */
const RISE_EVERY = 6 * 3600,
  /** ... and while what struck it plays out — homes catching, burning, falling in (Phase 42 M201). */
  STRUCK_EVERY = 60;

/** Batches of parts by mesh and colour, kept and refilled (made anew only when one outgrows itself). */
class PartBatches {
  private readonly batches = new Map<string, InstancedBatch>();
  private readonly stage: Stage;
  private readonly root: pc.Entity;
  private readonly meshes: Readonly<Record<PartMesh, pc.Mesh>>;
  /** The windows' glass, lit at night (its batch made anew when it changes). */
  lamps: pc.Material | null = null;
  private lampsIn: pc.Material | null = null;
  /** Each batch's own colour, and whether it is a roof (snow lies on it: Phase 30 M164). */
  private readonly bases = new Map<string, { color: Rgb; roof: boolean }>();
  private snow = 0;
  constructor(stage: Stage, root: pc.Entity, meshes: Readonly<Record<PartMesh, pc.Mesh>>) {
    this.stage = stage;
    this.root = root;
    this.meshes = meshes;
  }
  show(parts: TownParts): void {
    for (const [key, g] of parts.groups) {
      const n = g.data.length / 7;
      let b = this.batches.get(key);
      if (n === 0) {
        b?.set(0, () => {});
        continue;
      }
      if (!b || b.capacity < n || (g.lamp && this.lampsIn !== this.lamps)) {
        b?.destroy();
        b = new InstancedBatch(
          this.stage,
          this.meshes[g.mesh],
          [g.color[0], g.color[1], g.color[2]],
          Math.max(16, Math.ceil(n * 1.3)),
          this.root,
          g.lamp ? (this.lamps ?? undefined) : undefined,
        );
        if (g.lamp) this.lampsIn = this.lamps;
        this.batches.set(key, b);
        this.bases.set(key, {
          color: [g.color[0], g.color[1], g.color[2]],
          roof: !g.lamp && (g.mesh === "gable" || g.mesh === "cone"),
        });
        if (this.snow > 0) this.tint(key, b);
      }
      const d = g.data;
      b.set(n, (i, out) => {
        const o = i * 7;
        out[0] = d[o]! * M;
        out[1] = d[o + 1]! * M;
        out[2] = d[o + 2]! * M;
        out[3] = d[o + 3]! * M;
        out[4] = d[o + 4]! * M;
        out[5] = d[o + 5]! * M;
        out[6] = d[o + 6]!;
      });
    }
    for (const [key, b] of this.batches) if (!parts.groups.has(key)) b.set(0, () => {});
  }
  /** Snow lying on the roofs (0 … 1). */
  season(snow: number): void {
    if (snow === this.snow) return;
    this.snow = snow;
    for (const [key, b] of this.batches) this.tint(key, b);
  }

  private tint(key: string, b: InstancedBatch): void {
    const base = this.bases.get(key);
    if (!base?.roof) return;
    const c = base.color,
      k = this.snow * 0.8;
    b.recolor([c[0] + (0.93 - c[0]) * k, c[1] + (0.95 - c[1]) * k, c[2] + (0.98 - c[2]) * k]);
  }

  destroy(): void {
    for (const b of this.batches.values()) b.destroy();
    this.batches.clear();
    this.bases.clear();
  }
}

export class TownLayer {
  readonly root = new pc.Entity("town");
  private readonly settled: PartBatches;
  private readonly rising: PartBatches;
  private readonly parts = new TownParts();
  private scene: TownScene | null = null;
  private key = "";
  private drawnAt = -Infinity;
  /** Whether anything rises or falls this year (else the rising set is put once). */
  private busy = false;

  constructor(stage: Stage, parent: pc.Entity) {
    parent.addChild(this.root);
    const meshes: Record<PartMesh, pc.Mesh> = {
      box: keptMesh(boxMesh(stage)),
      gable: keptMesh(gableMesh(stage)),
      cone: keptMesh(coneMesh(stage, 0.5, 1, 8)),
      cyl: keptMesh(cylinderMesh(stage, 0.5, 1, 10)),
    };
    this.settled = new PartBatches(stage, this.root, meshes);
    this.rising = new PartBatches(stage, this.root, meshes);
  }

  get visible(): boolean {
    return this.root.enabled;
  }

  /** Snow lying on the town's roofs (Phase 30 M164; 0 … 1). */
  season(snow: number): void {
    this.settled.season(snow);
    this.rising.season(snow);
  }
  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /**
   * A year's plan of the town (the same town's carried on: its lots are not laid out again), its
   * windows' glass in `lamps` (lit at night).
   */
  build(plan: TownPlan | null, ref: string, t: number, lamps: pc.Material | null = null): void {
    this.settled.lamps = this.rising.lamps = lamps;
    if (!plan) {
      this.scene = null;
      this.parts.clear();
      this.settled.show(this.parts);
      this.rising.show(this.parts);
      this.visible = false;
      return;
    }
    this.visible = true;
    const same = this.key === ref && this.scene !== null;
    this.key = ref;
    this.scene = townScene(plan, t, same ? this.scene!.lots : undefined);
    // What stands all year: the ground, the homes done, the ruins.
    this.parts.clear();
    townGround(this.scene, this.parts);
    townHomes(this.scene, this.scene.settled, t, this.parts);
    this.settled.show(this.parts);
    this.busy = this.scene.active.length > 0 || civicsActive(plan, t) || !!plan.walls;
    this.drawnAt = -Infinity;
    this.update(t);
  }

  /** What rises through the year, put again as it climbs. */
  update(t: number): void {
    const scene = this.scene;
    if (!scene) return;
    // (Finely while a strike plays out between the last drawing and now, either way of the clock;
    // at once where a home of it caught or fell meanwhile.)
    const span = strikeSpan(scene),
      every =
        span &&
        Math.min(t, this.drawnAt) <= span.until &&
        Math.max(t, this.drawnAt) >= span.from - 2 * STRUCK_EVERY
          ? strikeTurned(scene, this.drawnAt, t)
            ? 0
            : STRUCK_EVERY
          : RISE_EVERY;
    if (Math.abs(t - this.drawnAt) < every || (!this.busy && this.drawnAt > -Infinity)) return;
    this.drawnAt = t;
    this.parts.clear();
    townHomes(scene, scene.active, t, this.parts);
    // (A mill's sails turning are drawn by themselves: render/trades.ts.)
    townCivics(scene, t, this.parts, false);
    townWalls(scene, t, this.parts);
    this.rising.show(this.parts);
  }

  /** What of it is alight, smoking and in dust at moment t, and how the ground shakes (Phase 42 M201). */
  blaze(t: number): BlazeNow {
    return blazeNow(this.visible ? this.scene : null, t);
  }

  /** Where its buildings smoke at moment t (Phase 41 M199): their chimneys' tops (metres). */
  chimneys(t: number): { x: number; y: number; z: number }[] {
    return this.scene ? civicChimneys(this.scene, t) : [];
  }

  /** Its mills, kilns and smithies standing at moment t, for their work drawn moving (Phase 41 M199). */
  motions(t: number): CivicMotion[] {
    return this.scene ? civicMotions(this.scene, t) : [];
  }

  /**
   * Where a home's hearth smokes, at the lot nearest (x, z) (metres): its roof's top, or null where
   * no home stands whole there.
   */
  hearth(x: number, z: number, t: number): { x: number; y: number; z: number } | null {
    const s = this.scene;
    if (!s) return null;
    const p = lotNear(s, x, z, 1);
    if (p < 0) return null;
    const top = roofTop(s, p, t);
    return top === null ? null : { x: s.lots.x[p]!, y: top + 0.5, z: s.lots.z[p]! };
  }

  /** What of the town stands at a point (metres from its middle) at moment t, for a tap. */
  thingAt(x: number, z: number, t: number): TownThing | null {
    return this.scene && this.visible ? townThingAt(this.scene, x, z, t) : null;
  }

  /**
   * Where one of its buildings stands whole, one of its homes stands done and a length of its
   * walls (metres from the middle), at moment t: for the look tools.
   */
  spots(t: number): {
    civic: { at: number; start: number; x: number; z: number } | null;
    lot: { lot: number; x: number; z: number } | null;
    walls: { x: number; z: number } | null;
  } {
    const s = this.scene;
    if (!s) return { civic: null, lot: null, walls: null };
    const c = s.plan.civics.find(
        (x) => x.fell === null && civicMoments(x).done <= t && x.at + x.lots <= s.lots.x.length,
      ),
      f = c ? footprint(s.lots, c.at, c.lots) : null;
    let lot = -1;
    for (let p = 0; p < s.plan.lots && lot < 0; p++)
      if (s.states.what[p] === LOT.home && progress(s.states.began[p]!, s.states.takes[p]!, t) >= 1)
        lot = p;
    const w = s.walls?.lengths.find((l) => !l.gate);
    return {
      civic: c && f ? { at: c.at, start: c.start, x: f.x, z: f.z } : null,
      lot: lot >= 0 ? { lot, x: s.lots.x[lot]!, z: s.lots.z[lot]! } : null,
      walls: w && t >= (s.plan.walls!.start + 1) * 365 * 86_400 ? { x: w.x, z: w.z } : null,
    };
  }

  /** The town's homes standing at moment t, the first `most` of its lots (the look tools). */
  homes(t: number, most = 40): { lot: number; x: number; z: number }[] {
    const s = this.scene,
      out: { lot: number; x: number; z: number }[] = [];
    if (!s) return out;
    for (let p = 0; p < s.plan.lots && out.length < most; p++)
      if (s.states.what[p] === LOT.home && progress(s.states.began[p]!, s.states.takes[p]!, t) >= 1)
        out.push({ lot: p, x: s.lots.x[p]!, z: s.lots.z[p]! });
    return out;
  }

  /** The lot of its plan nearest a point (metres from the middle), within a lot and a half (-1: none). */
  lotOf(x: number, z: number): number {
    return this.scene && this.visible ? lotNear(this.scene, x, z, 14) : -1;
  }

  /** Where a lot is (metres from the middle), or null. */
  lotAt(p: number): { x: number; z: number } | null {
    const s = this.scene;
    return s && p >= 0 && p < s.lots.x.length ? { x: s.lots.x[p]!, z: s.lots.z[p]! } : null;
  }

  /** How far out its lots reach (metres), for the eye. */
  reach(): number {
    const s = this.scene;
    if (!s) return 0;
    let r = 0;
    for (let p = 0; p < s.plan.lots; p++) r = Math.max(r, Math.hypot(s.lots.x[p]!, s.lots.z[p]!));
    return r + 14;
  }

  destroy(): void {
    this.settled.destroy();
    this.rising.destroy();
    this.root.destroy();
  }
}
