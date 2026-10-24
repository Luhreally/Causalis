// The cluster (Phase 6 M56): the stars within reach of home, each a small glowing sphere
// where it lies, one instanced batch for each colour; home a brighter mark at the middle;
// the picked star ringed. Built once per plan.
import type { FleetHead, PeopleMark, ReactionMark, StarLine, VoyageMark } from "../view/index.ts";
import * as pc from "playcanvas";
import type { ClusterPlan } from "../bridge/index.ts";
import { LY_SCALE, clusterSpec } from "../view/index.ts";
import { InstancedBatch } from "./batch.ts";
import { glowMaterial } from "./glow.ts";
import type { Stage } from "./stage.ts";

export class ClusterScene {
  private readonly stage: Stage;
  private readonly root = new pc.Entity("cluster");
  private batches: InstancedBatch[] = [];
  private points: { index: number; x: number; y: number; z: number }[] = [];
  /** The ships, halls, fleets and battles shown, and their pages (for picking). */
  private voyageMarks: VoyageMark[] = [];
  /** Each war fleet's lead ship (M101). */
  private fleetHeads: readonly FleetHead[] = [];
  private readonly marker: pc.Entity;
  private readonly sphere: pc.Mesh;
  private readonly ringMesh: pc.Mesh;
  private readonly ships: pc.Entity[] = [];
  private readonly rings: pc.Entity[] = [];
  private readonly fleets: pc.Entity[] = [];
  private readonly battles: pc.Entity[] = [];
  /** Each star's glow, a disc turned to the camera every frame, one batch per colour. */
  private glows: {
    batch: InstancedBatch;
    stars: readonly { x: number; y: number; z: number; size: number }[];
  }[] = [];
  private readonly disc: pc.Mesh;
  /** The peoples of other stars (Phase 18 M134): their holds, ships, fleets and bursts, and the lines between. */
  private readonly peopleHolds: pc.Entity[] = [];
  private readonly peopleOwn: pc.Entity[] = [];
  private readonly peopleShips: pc.Entity[] = [];
  private readonly peopleFleets: pc.Entity[] = [];
  private readonly peopleRaids: pc.Entity[] = [];
  private readonly peopleLandings: pc.Entity[] = [];
  private peopleShown: VoyageMark[] = [];
  private reactionMarks: readonly ReactionMark[] = [];
  private bursts: { e: pc.Entity; age: number; size: number }[] = [];
  private lineArrays: { positions: number[]; colors: number[] } = { positions: [], colors: [] };
  private readonly tints = new Map<string, pc.StandardMaterial>();
  /** Each people's reach: a soft glow in its colour about each star it holds (camera-facing). */
  private readonly territory = new Map<
    string,
    { batch: InstancedBatch; stars: { x: number; y: number; z: number; size: number }[] }
  >();

  constructor(stage: Stage) {
    this.stage = stage;
    stage.root.addChild(this.root);
    this.sphere = pc.Mesh.fromGeometry(
      stage.device,
      new pc.SphereGeometry({ radius: 1, latitudeBands: 6, longitudeBands: 8 }),
    );
    const ring = new pc.Mesh(stage.device),
      pts: number[] = [];
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2,
        b = ((k + 1) / 40) * Math.PI * 2;
      pts.push(Math.cos(a), 0, Math.sin(a), Math.cos(b), 0, Math.sin(b));
    }
    ring.setPositions(pts);
    ring.update(pc.PRIMITIVE_LINES);
    this.ringMesh = ring;
    this.marker = new pc.Entity("star marker");
    this.marker.addComponent("render", {
      meshInstances: [new pc.MeshInstance(ring, glow([1, 1, 1]))],
    });
    this.marker.enabled = false;
    this.root.addChild(this.marker);
    this.root.enabled = false;
    this.disc = pc.Mesh.fromGeometry(
      stage.device,
      new pc.PlaneGeometry({ halfExtents: new pc.Vec2(1, 1) }),
    );
    const cam = new pc.Vec3();
    let clock = 0;
    stage.onUpdate((dt) => {
      if (!this.root.enabled) return;
      clock += dt;
      // The peoples' lines among the stars, drawn each frame; their bursts pulsing.
      if (this.lineArrays.positions.length)
        stage.app.drawLineArrays(this.lineArrays.positions, this.lineArrays.colors, true);
      for (const b of this.bursts) {
        const k = (clock * 0.8 + b.age * 0.37) % 1,
          r = b.size * (0.6 + 0.9 * k);
        b.e.setLocalScale(r, r, r);
      }
    });
    stage.onUpdate(() => {
      if (!this.root.enabled || !this.glows.length) return;
      cam.copy(stage.camera.getPosition());
      for (const t of this.territory.values())
        t.batch.set(t.stars.length, (i, out) => {
          const s = t.stars[i]!,
            dx = cam.x - s.x,
            dy = cam.y - s.y,
            dz = cam.z - s.z,
            len = Math.hypot(dx, dy, dz) || 1;
          out[0] = s.x;
          out[1] = s.y;
          out[2] = s.z;
          out[3] = out[4] = out[5] = s.size * 5;
          out[6] = Math.atan2(dx, dz);
          out[7] = Math.acos(Math.max(-1, Math.min(1, dy / len)));
        });
      for (const g of this.glows)
        g.batch.set(stage.quality.glows ? g.stars.length : 0, (i, out) => {
          const s = g.stars[i]!,
            dx = cam.x - s.x,
            dy = cam.y - s.y,
            dz = cam.z - s.z,
            len = Math.hypot(dx, dy, dz) || 1;
          out[0] = s.x;
          out[1] = s.y;
          out[2] = s.z;
          out[3] = out[4] = out[5] = s.size * 5;
          // The disc's face (+y) turned to the camera: tipped, then turned.
          out[6] = Math.atan2(dx, dz);
          out[7] = Math.acos(Math.max(-1, Math.min(1, dy / len)));
        });
    });
  }

  build(plan: ClusterPlan): void {
    for (const b of this.batches) b.destroy();
    for (const g of this.glows) g.batch.destroy();
    this.batches = [];
    this.glows = [];
    this.points = [];
    for (const group of clusterSpec(plan)) {
      const batch = new InstancedBatch(
        this.stage,
        this.sphere,
        group.color,
        group.stars.length,
        this.root,
        glow(group.color),
      );
      batch.set(group.stars.length, (i, out) => {
        const s = group.stars[i]!;
        out[0] = s.x;
        out[1] = s.y;
        out[2] = s.z;
        out[3] = out[4] = out[5] = s.size;
        out[6] = 0;
      });
      this.batches.push(batch);
      for (const s of group.stars) this.points.push(s);
      // Its glow in its own light.
      const [r, gr, b] = group.color.map((c) => Math.round(255 * c));
      this.glows.push({
        batch: new InstancedBatch(
          this.stage,
          this.disc,
          group.color,
          group.stars.length,
          this.root,
          glowMaterial(this.stage, [
            [0, `rgba(${r},${gr},${b},0.9)`],
            [0.25, `rgba(${r},${gr},${b},0.35)`],
            [1, `rgba(${r},${gr},${b},0)`],
          ]),
        ),
        stars: group.stars,
      });
    }
    // Home: the brightest mark, at the middle.
    const home = new InstancedBatch(
      this.stage,
      this.sphere,
      [1, 0.95, 0.7],
      1,
      this.root,
      glow([1, 0.97, 0.8]),
    );
    home.set(1, (_, out) => {
      out[0] = out[1] = out[2] = 0;
      out[3] = out[4] = out[5] = 0.22;
      out[6] = 0;
    });
    this.batches.push(home);
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  /** A ship, a hall, a fleet or a battle among the stars nearest a screen point: its page (M93). */
  pickVoyage(x: number, y: number, reach = 18): string | null {
    const cam = this.stage.camera.camera!;
    let best: string | null = null,
      bestD = reach;
    for (const m of [...this.voyageMarks, ...this.peopleShown]) {
      const p = cam.worldToScreen(new pc.Vec3(m.x, m.y, m.z));
      if (p.z <= 0) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = m.ref;
      }
    }
    return best;
  }

  /** Each war fleet's lead ship on the screen (CSS pixels), where its counter stands (M101). */
  fleetsOnScreen(): (FleetHead & { sx: number; sy: number })[] {
    const cam = this.stage.camera.camera!,
      out: (FleetHead & { sx: number; sy: number })[] = [];
    for (const h of this.fleetHeads) {
      const p = cam.worldToScreen(new pc.Vec3(h.x, h.y, h.z));
      if (p.z > 0) out.push({ ...h, sx: p.x, sy: p.y });
    }
    return out;
  }

  /** Where star `index` of the plan stands on the screen (CSS pixels), or null out of sight. */
  starOnScreen(index: number): { x: number; y: number } | null {
    const s = this.points.find((p) => p.index === index);
    if (!s) return null;
    const p = this.stage.camera.camera!.worldToScreen(new pc.Vec3(s.x, s.y, s.z));
    return p.z > 0 ? { x: p.x, y: p.y } : null;
  }

  /** The star nearest a screen point (within a finger's width), or null. */
  pick(x: number, y: number): number | null {
    const cam = this.stage.camera.camera!;
    let best: number | null = null,
      bestD = 22;
    for (const s of this.points) {
      const p = cam.worldToScreen(new pc.Vec3(s.x, s.y, s.z));
      const d = Math.hypot(p.x - x, p.y - y);
      if (p.z > 0 && d < bestD) {
        bestD = d;
        best = s.index;
      }
    }
    return best;
  }

  /** Ships between the stars, and rings about the stars they came down at. */
  voyages(m: {
    readonly ships: readonly VoyageMark[];
    readonly rings: readonly VoyageMark[];
    readonly fleets?: readonly VoyageMark[];
    readonly battles?: readonly VoyageMark[];
    readonly heads?: readonly FleetHead[];
  }): void {
    this.voyageMarks = [...(m.battles ?? []), ...m.rings, ...(m.fleets ?? []), ...m.ships];
    this.fleetHeads = m.heads ?? [];
    for (const [pool, list, make] of [
      [this.ships, m.ships, () => this.dot([0.6, 1, 0.7], 0.09)],
      [this.rings, m.rings, () => this.ringAt([0.4, 1, 0.5])],
      // War between the stars (M87): fleets red, the stars fought over ringed in fire.
      [this.fleets, m.fleets ?? [], () => this.dot([1, 0.32, 0.22], 0.07)],
      [this.battles, m.battles ?? [], () => this.ringAt([1, 0.6, 0.15])],
    ] as const) {
      while (pool.length < list.length) {
        const e = make();
        this.root.addChild(e);
        pool.push(e);
      }
      pool.forEach((e, i) => {
        e.enabled = i < list.length;
        const p = list[i];
        if (p) e.setLocalPosition(p.x, p.y, p.z);
      });
    }
  }

  /**
   * The peoples of other stars among them (Phase 18 M134): each hold ringed in its people's
   * colour (its own star the larger ring), its ships and fleets under way, raids burning and
   * landings bursting at home; its reach and the lines of contact drawn between.
   */
  peoples(m: {
    readonly holds: readonly PeopleMark[];
    readonly own: readonly PeopleMark[];
    readonly ships: readonly PeopleMark[];
    readonly fleets: readonly PeopleMark[];
    readonly lines: readonly StarLine[];
    readonly reactions: readonly ReactionMark[];
    readonly raids: readonly (PeopleMark & { readonly age: number })[];
    readonly landings: readonly (PeopleMark & { readonly age: number })[];
  }): void {
    const ring = () => {
        const e = new pc.Entity("held star");
        e.addComponent("render", {
          meshInstances: [new pc.MeshInstance(this.ringMesh, glow([1, 1, 1]))],
        });
        return e;
      },
      ball = () => this.dot([1, 1, 1], 1);
    const sets: [pc.Entity[], readonly PeopleMark[], () => pc.Entity, number, boolean][] = [
      [this.peopleOwn, m.own, ring, 0.5, false],
      [this.peopleHolds, m.holds, ring, 0.32, false],
      [this.peopleShips, m.ships, ball, 0.11, false],
      [this.peopleFleets, m.fleets, ball, 0.14, true],
      [this.peopleRaids, m.raids, ring, 0.3, true],
      [this.peopleLandings, m.landings, ring, 0.3, false],
    ];
    for (const [pool, list, make, size, fiery] of sets) {
      while (pool.length < list.length) {
        const e = make();
        this.root.addChild(e);
        pool.push(e);
      }
      pool.forEach((e, i) => {
        const p = list[i];
        e.enabled = !!p;
        if (!p) return;
        e.setLocalPosition(p.x, p.y, p.z);
        e.setLocalScale(size, size, size);
        // Fleets and raids in their people's colour gone to fire.
        const c = fiery
          ? ([1, 0.25 + 0.3 * p.color[1], 0.15 + 0.2 * p.color[2]] as const)
          : p.color;
        e.render!.meshInstances[0]!.material = this.tint(c);
      });
    }
    this.bursts = [
      ...m.raids.map((r, i) => ({ e: this.peopleRaids[i]!, age: r.age, size: 0.3 })),
      ...m.landings.map((l, i) => ({ e: this.peopleLandings[i]!, age: l.age, size: 0.42 })),
    ];
    const positions: number[] = [],
      colors: number[] = [];
    for (const l of m.lines) {
      positions.push(...l.a, ...l.b);
      // (On space's black, fainter is darker.)
      const [r, g, b] = l.color.map((c) => c * l.alpha) as [number, number, number];
      colors.push(r, g, b, 1, r, g, b, 1);
    }
    this.lineArrays = { positions, colors };
    // Each people's reach as a soft glow in its colour about every star it holds.
    const byColor = new Map<
      string,
      { color: readonly [number, number, number]; at: PeopleMark[] }
    >();
    for (const h of [...m.own, ...m.holds]) {
      const key = h.color.join(",");
      let g = byColor.get(key);
      if (!g) byColor.set(key, (g = { color: h.color, at: [] }));
      g.at.push(h);
    }
    for (const [key, t] of this.territory) if (!byColor.has(key)) t.stars = [];
    for (const [key, g] of byColor) {
      let t = this.territory.get(key);
      if (!t) {
        const [r, gr, b] = g.color.map((c) => Math.round(255 * c));
        t = {
          batch: new InstancedBatch(
            this.stage,
            this.disc,
            g.color,
            32,
            this.root,
            glowMaterial(this.stage, [
              [0, `rgba(${r},${gr},${b},0.32)`],
              [0.4, `rgba(${r},${gr},${b},0.12)`],
              [1, `rgba(${r},${gr},${b},0)`],
            ]),
          ),
          stars: [],
        };
        this.territory.set(key, t);
      }
      t.stars = g.at.slice(0, 32).map((h) => ({ x: h.x, y: h.y, z: h.z, size: 0.55 }));
    }
    this.reactionMarks = m.reactions;
    this.peopleShown = [
      ...m.raids,
      ...m.landings,
      ...m.fleets,
      ...m.ships,
      ...m.reactions,
      ...m.own,
      ...m.holds,
    ];
  }

  /** How peoples met, each where it is on the screen (CSS pixels): their icons' places. */
  reactionsOnScreen(): (ReactionMark & { sx: number; sy: number })[] {
    const cam = this.stage.camera.camera!,
      out: (ReactionMark & { sx: number; sy: number })[] = [];
    for (const r of this.reactionMarks) {
      const p = cam.worldToScreen(new pc.Vec3(r.x, r.y, r.z));
      if (p.z > 0) out.push({ ...r, sx: p.x, sy: p.y });
    }
    return out;
  }

  private tint(color: readonly [number, number, number]): pc.StandardMaterial {
    const key = color.map((c) => c.toFixed(3)).join(",");
    let m = this.tints.get(key);
    if (!m) this.tints.set(key, (m = glow(color)));
    return m;
  }

  private dot(color: readonly [number, number, number], size: number): pc.Entity {
    const e = new pc.Entity("ship");
    e.addComponent("render", { meshInstances: [new pc.MeshInstance(this.sphere, glow(color))] });
    e.setLocalScale(size, size, size);
    return e;
  }

  private ringAt(color: readonly [number, number, number]): pc.Entity {
    const e = new pc.Entity("settled star");
    e.addComponent("render", {
      meshInstances: [new pc.MeshInstance(this.ringMesh, glow(color))],
    });
    e.setLocalScale(0.28, 0.28, 0.28);
    return e;
  }

  /** Ring a star (or clear the ring). */
  mark(index: number | null, plan: ClusterPlan | null): void {
    this.marker.enabled = index !== null && !!plan;
    if (index === null || !plan) return;
    const s = plan.stars[index]!;
    this.marker.setLocalPosition(s.x * LY_SCALE, s.z * LY_SCALE, s.y * LY_SCALE);
    this.marker.setLocalScale(0.35, 0.35, 0.35);
  }
}

function glow(color: readonly [number, number, number]): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(color[0], color[1], color[2]);
  m.useLighting = false;
  m.update();
  return m;
}
