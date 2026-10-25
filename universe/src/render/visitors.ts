// Visitors from another star, drawn (Phase 18 M134): over a village where a people of the
// stars came down, its ship — a low-poly saucer of the era's games, its hull ringed with lights
// in its people's colour — hovering in a beam of light as it lands, set down on its legs as an
// embassy, or circling high and red over a land its fleet struck — out past the homes (past a
// city's quarters, and as much the larger), a ring of lights chasing about the ground where it
// comes down; and about it, unless in war, a few of them in their own bodies (view/figure.ts,
// as the home world's people are drawn, but faintly aglow), strolling slowly among the people,
// now and then a sign over them of how they came (in wonder, in fear, to trade). The village
// opens facing them. A handful of draw calls a group.
import * as pc from "playcanvas";
import type { VillagePlan, Visitor } from "../bridge/index.ts";
import { figureOf, figurePaint, limbPitch, type Figure, type PartShape } from "../view/index.ts";
import { InstancedBatch, boxMesh, capsuleMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1; // units per metre, as the village's
const LIGHTS = 12; // landing lights about where a ship comes down

/** A group of visitors as built: its ship's parts, its beam, its figures' batches, its place. */
type Group = {
  readonly v: Visitor;
  readonly ship: pc.Entity;
  readonly beam: pc.Entity | null;
  readonly lights: InstancedBatch | null;
  readonly figure: Figure;
  readonly batches: InstancedBatch[];
  /** Where the ship stands over (metres from the middle), how high it hovers and how wide (units). */
  readonly x: number;
  readonly z: number;
  readonly hover: number;
  readonly size: number;
};

/** The sign over a visitor for how they came. */
const CAME: Readonly<Record<string, string>> = {
  wonder: "✨",
  fear: "😨",
  trade: "🤝",
  war: "⚔️",
};

/** A visitor's own colour, lit as anything is, and a little aglow besides. */
function aglow(color: Rgb): pc.StandardMaterial {
  const m = flatMaterial(color);
  m.emissive = new pc.Color(color[0] * 0.35, color[1] * 0.35, color[2] * 0.35);
  m.update();
  return m;
}

function glowing(color: Rgb): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(color[0], color[1], color[2]);
  m.useLighting = false;
  m.update();
  return m;
}

/** Light laid over what is behind it: a beam (its outer face only, so it is not doubled), a ring. */
function lightMaterial(color: Rgb, strength: number): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(color[0] * strength, color[1] * strength, color[2] * strength);
  m.useLighting = false;
  m.opacity = 1;
  m.blendType = pc.BLEND_ADDITIVE;
  m.depthWrite = false;
  m.cull = pc.CULLFACE_BACK;
  m.update();
  return m;
}

export class VisitorsLayer {
  readonly root = new pc.Entity("visitors");
  private readonly stage: Stage;
  private groups: Group[] = [];
  private readonly meshes: Record<PartShape, pc.Mesh>;
  private readonly disc: pc.Mesh;
  private readonly dome: pc.Mesh;
  private readonly cone: pc.Mesh;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.meshes = {
      capsule: keptMesh(capsuleMesh(stage, 0.11, 0.55)),
      box: keptMesh(boxMesh(stage)),
      cylinder: keptMesh(cylinderMesh(stage, 0.5, 1, 8)),
      cone: keptMesh(coneMesh(stage, 0.5, 1, 8)),
    };
    this.disc = keptMesh(cylinderMesh(stage, 1, 1, 12));
    this.dome = keptMesh(
      pc.Mesh.fromGeometry(
        stage.device,
        new pc.SphereGeometry({ radius: 1, latitudeBands: 5, longitudeBands: 10 }),
      ),
    );
    this.cone = keptMesh(coneMesh(stage, 1, 1, 12));
    parent.addChild(this.root);
  }

  /** How many groups are shown, and of them how many of their people stand about (for the gate). */
  get shown(): { groups: number; figures: number; whys: string[] } {
    return {
      groups: this.groups.length,
      figures: this.groups.reduce((n, g) => n + g.v.count, 0),
      whys: this.groups.map((g) => g.v.why),
    };
  }

  /** Lay out the visitors of a village: its ship (or, in war, its fleet) and its people. */
  build(plan: VillagePlan, detail: number): void {
    for (const g of this.groups) {
      g.ship.destroy();
      g.beam?.destroy();
      g.lights?.destroy();
      for (const b of g.batches) b.destroy();
    }
    this.groups = [];
    const visitors = plan.visitors ?? [];
    if (!visitors.length) return;
    // Out past the homes (a city's quarters), on the side away from the fields: open ground to
    // come down on. Over a city, as much the larger, as a city is seen from further off.
    const quarters = plan.districts,
      grand = quarters ? 1.8 : 1;
    // (How far out a city's built quarters reach, its open blocks aside.)
    let city = 0;
    quarters?.uses.forEach((use, k) => {
      if (!use) return;
      const half = (quarters.blocks - 1) / 2,
        bx = ((k % quarters.blocks) - half) * quarters.blockM,
        bz = (Math.floor(k / quarters.blocks) - half) * quarters.blockM;
      city = Math.max(city, Math.hypot(bx, bz) + quarters.blockM * 0.71);
    });
    let homes = 40,
      fx = 0,
      fz = 0;
    for (const h of plan.homes) homes = Math.max(homes, Math.hypot(h.x, h.z));
    for (const f of plan.fields) {
      fx += f.x;
      fz += f.z;
    }
    const away = plan.fields.length ? Math.atan2(fz, fx) + Math.PI : 0;
    visitors.forEach((v, k) => {
      const angle = away + (k - (visitors.length - 1) / 2) * 0.7,
        raid = v.why === "raid",
        landed = v.why === "embassy",
        size = (raid ? 0.8 : 1.5) * grand,
        // (Clear of the homes by the ship's own width; a city's, past its corner.)
        reach = Math.max(Math.min(homes * 0.75 + 20, 140), city + 10) + (size / M) * 0.6,
        x = reach * Math.cos(angle),
        z = reach * Math.sin(angle),
        // Set down on its legs, hovering in its beam, or high over the land it struck.
        hover = raid ? 4.6 * size + 3.3 : landed ? 0.58 * size : 2.1 * size,
        ship = this.saucer(v.color, size, landed, raid);
      ship.setLocalPosition(x * M, hover, z * M);
      this.root.addChild(ship);
      // A faint beam to the ground as they come down (and as the omen was seen); lights
      // chasing about the ground where they set down, or came down.
      let beam: pc.Entity | null = null;
      if (v.why === "landing" || v.why === "omen") {
        beam = new pc.Entity("visitor beam");
        beam.addComponent("render", {
          meshInstances: [new pc.MeshInstance(this.cone, lightMaterial(v.color, 0.07))],
          castShadows: false,
        });
        // (The cone's point up in the hull, its wide foot on the ground.)
        beam.setLocalPosition(x * M, hover / 2, z * M);
        beam.setLocalScale(size * 0.9, hover, size * 0.9);
        this.root.addChild(beam);
      }
      const lights = raid
        ? null
        : new InstancedBatch(this.stage, this.dome, v.color, LIGHTS, this.root, glowing(v.color));
      // Their people, in their own colours a little aglow (as things from the stars are).
      const figure = figureOf(v.body, detail),
        [r, g, b] = v.color,
        body: Rgb = [0.25 + 0.5 * r, 0.25 + 0.5 * g, 0.25 + 0.5 * b],
        dark: Rgb = [0.15 + 0.35 * r, 0.15 + 0.35 * g, 0.15 + 0.35 * b],
        skin: Rgb = [0.45 + 0.45 * r, 0.45 + 0.45 * g, 0.45 + 0.45 * b],
        // (In their own look, Phase 34: their hide, and their people's colour on what they wear.)
        paint = figurePaint(v.body, "modern", 0),
        batches =
          v.count > 0
            ? figure.parts.map((part) => {
                const tone: Rgb = paint.folk
                  ? part.tone === 5
                    ? body
                    : paint.tones[part.tone]
                  : part.tone === 4
                    ? [0.04, 0.04, 0.06]
                    : part.tone === 2
                      ? skin
                      : part.tone === 1 || part.tone === 3
                        ? dark
                        : body;
                return new InstancedBatch(
                  this.stage,
                  this.meshes[part.shape],
                  tone,
                  v.count,
                  this.root,
                  aglow(tone),
                );
              })
            : [];
      this.groups.push({ v, ship, beam, lights, figure, batches, x, z, hover, size });
    });
  }

  /** A saucer: a disc hull, a dome, a ring of lights in its people's colour; legs if set down. */
  private saucer(color: Rgb, size: number, landed: boolean, raid: boolean): pc.Entity {
    const ship = new pc.Entity("visitor ship"),
      hull = flatMaterial(raid ? [0.42, 0.38, 0.4] : [0.66, 0.7, 0.76], 1, 0.7, 0.6),
      lights = glowing(raid ? [1, 0.3, 0.2] : color),
      add = (mesh: pc.Mesh, material: pc.Material, p: readonly number[], s: readonly number[]) => {
        const e = new pc.Entity("part");
        e.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)] });
        e.setLocalPosition(p[0]!, p[1]!, p[2]!);
        e.setLocalScale(s[0]!, s[1]!, s[2]!);
        ship.addChild(e);
        return e;
      };
    add(this.disc, hull, [0, 0, 0], [size, 0.16 * size, size]);
    add(this.disc, hull, [0, -0.12 * size, 0], [0.62 * size, 0.1 * size, 0.62 * size]);
    add(
      this.dome,
      glowing([0.55 + 0.4 * color[0], 0.6 + 0.35 * color[1], 0.65 + 0.3 * color[2]]),
      [0, 0.12 * size, 0],
      [0.42 * size, 0.3 * size, 0.42 * size],
    );
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      add(
        this.dome,
        lights,
        [Math.cos(a) * 0.9 * size, 0, Math.sin(a) * 0.9 * size],
        [0.08 * size, 0.08 * size, 0.08 * size],
      );
    }
    if (landed)
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.5;
        add(
          this.meshes.box,
          hull,
          [Math.cos(a) * 0.55 * size, -0.32 * size, Math.sin(a) * 0.55 * size],
          [0.06 * size, 0.5 * size, 0.06 * size],
        );
      }
    return ship;
  }

  /**
   * The way to turn the eye (its yaw, in degrees) to face the first of them across the village
   * (the eye on the far side from them, they beyond the homes), or null with none here.
   */
  facing(): number | null {
    const g = this.groups[0];
    if (!g) return null;
    const d = Math.hypot(g.x, g.z) || 1;
    return (Math.atan2(-g.x / d, -g.z / d) * 180) / Math.PI;
  }

  /** The ships turn and bob; their people stroll about them, by the screen's clock. */
  update(clock: number): void {
    for (const g of this.groups) {
      const raid = g.v.why === "raid",
        bob = g.v.why === "embassy" ? 0 : 0.08 * g.size * Math.sin(clock * 0.9 + g.x),
        // In war the fleet circles the land it struck.
        cx = raid ? g.x * M + 2.8 * g.size * Math.cos(clock * 0.25) : g.x * M,
        cz = raid ? g.z * M + 2.8 * g.size * Math.sin(clock * 0.25) : g.z * M;
      g.ship.setLocalPosition(cx, g.hover + bob, cz);
      g.ship.setLocalEulerAngles(0, (clock * (raid ? 40 : 14)) % 360, 0);
      // The landing lights chase about the ground under it.
      g.lights?.set(LIGHTS, (k, out) => {
        const a = (k / LIGHTS) * Math.PI * 2,
          lit = (((clock * 6 - k) % LIGHTS) + LIGHTS) % LIGHTS,
          s = 0.02 * g.size * (lit < 2 ? 1.5 : 1);
        out[0] = g.x * M + 1.25 * g.size * Math.cos(a);
        out[1] = 0.05;
        out[2] = g.z * M + 1.25 * g.size * Math.sin(a);
        out[3] = out[4] = out[5] = s;
        out[6] = 0;
        out[7] = 0;
      });
      if (!g.batches.length) continue;
      const parts = g.figure.parts,
        n = g.v.count,
        scale = g.figure.scale * 1.05;
      g.batches.forEach((batch, pi) =>
        batch.set(n, (k, out) => {
          // Each on a slow round about the ship, a little apart, facing the way it walks.
          const turn = clock * 0.05 * (k % 2 ? 1 : -1) + (k / n) * Math.PI * 2,
            r = g.size + (6 + 5 * (k % 3)) * M,
            x = g.x * M + r * Math.cos(turn),
            z = g.z * M + r * Math.sin(turn),
            yaw = turn + (k % 2 ? Math.PI : 0),
            part = parts[pi]!,
            pitch = limbPitch(part, null, true, clock * 0.8 + k, k),
            hinge = part.pivot ?? 0,
            py = part.y + hinge - hinge * Math.cos(pitch),
            pz = part.z - hinge * Math.sin(pitch),
            c = Math.cos(yaw),
            sn = Math.sin(yaw);
          out[0] = x + (part.x * c + pz * sn) * scale;
          out[1] = py * scale;
          out[2] = z + (-part.x * sn + pz * c) * scale;
          out[3] = part.sx * scale;
          out[4] = part.sy * scale;
          out[5] = part.sz * scale;
          out[6] = yaw;
          out[7] = pitch;
        }),
      );
    }
  }

  /**
   * The visitors nearest a screen point (their ship): the event to open, and where to look from
   * (in units, and the eye's pitch) to see it and its people.
   */
  pick(
    x: number,
    y: number,
    reach = 40,
  ): {
    event: string;
    at: { x: number; y: number; z: number };
    distance: number;
    pitch: number;
  } | null {
    const cam = this.stage.camera.camera!;
    let best: Group | null = null,
      bestD = reach;
    for (const g of this.groups) {
      const p = cam.worldToScreen(g.ship.getPosition().clone());
      if (p.z <= 0) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) [best, bestD] = [g, d];
    }
    return best ? this.lookAt(best) : null;
  }

  /** Where to look from to see the first of them and their people, as a tap on their ship does. */
  view(): ReturnType<VisitorsLayer["pick"]> {
    const g = this.groups[0];
    return g ? this.lookAt(g) : null;
  }

  private lookAt(g: Group): {
    event: string;
    at: { x: number; y: number; z: number };
    distance: number;
    pitch: number;
  } {
    // (From low down, a little way up toward the ship: it overhead, its people below it.)
    const at = g.ship.getPosition();
    return {
      event: g.v.event,
      at: { x: at.x, y: g.hover * (g.v.why === "raid" ? 0.5 : 0.3), z: at.z },
      distance: Math.max(7, 1.5 * g.hover + 3 * g.size),
      pitch: -16,
    };
  }

  /**
   * Signs over the visitors near the eye (as over the people, M86): how they came, in turns of
   * a few seconds each, by the screen's clock.
   */
  bubbles(
    clock: number,
  ): { key: string; text: string; at: { x: number; y: number } | null; priority: number }[] {
    const cam = this.stage.camera.camera!,
      eye = this.stage.camera.getPosition(),
      head = new pc.Vec3(),
      out: { key: string; text: string; at: { x: number; y: number } | null; priority: number }[] =
        [];
    for (const g of this.groups) {
      const sign = CAME[g.v.theirs ?? ""];
      if (!sign || !g.batches.length) continue;
      const n = g.v.count,
        tall = 0.75 * g.figure.scale;
      for (let k = 0; k < n; k++) {
        // (Each speaks a third of the time, in its turn.)
        if ((Math.floor(clock / 2.6) + k) % 3) continue;
        const turn = clock * 0.05 * (k % 2 ? 1 : -1) + (k / n) * Math.PI * 2,
          r = g.size + (6 + 5 * (k % 3)) * M;
        head.set(g.x * M + r * Math.cos(turn), tall, g.z * M + r * Math.sin(turn));
        const d = head.distance(eye);
        if (d > 14 * Math.max(1, g.size / 1.5)) continue;
        const at = cam.worldToScreen(head);
        out.push({
          key: `visitor:${g.v.civ}:${k}`,
          text: sign,
          at: at.z > 0 ? { x: at.x, y: at.y } : null,
          priority: -d,
        });
      }
    }
    return out;
  }

  /** Where each group's ship stands on the screen, for its name over it. */
  onScreen(): { key: string; text: string; x: number; y: number }[] {
    const cam = this.stage.camera.camera!,
      out: { key: string; text: string; x: number; y: number }[] = [];
    for (const g of this.groups) {
      // (Over the top of its dome, however near.)
      const top = g.ship.getPosition().clone();
      top.y += 0.5 * g.size;
      const p = cam.worldToScreen(top);
      if (p.z <= 0) continue;
      out.push({
        key: `visitors:${g.v.civ}`,
        text: `${g.v.why === "raid" ? "⚔️" : "🛸"} ${g.v.name}${g.v.theirs && g.v.ours && g.v.why !== "raid" ? ` · ${CAME[g.v.theirs] ?? ""}${CAME[g.v.ours] ?? ""}` : ""}`,
        x: p.x,
        y: p.y - 12,
      });
    }
    return out;
  }
}
