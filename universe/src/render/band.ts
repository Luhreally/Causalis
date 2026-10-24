// A band drawn (Phase 28 M158): the first people of the peopling's near view on the last age's
// land, among its beasts — each in the parts of their people's own figure, walking, gathering,
// cutting up a kill, at play, talking by the fire or asleep about it; what they carry on their
// backs, the hunters' spears; their shelters, the fire, its smoke and its light on the ground at
// night, and the kill they cut up. Units as the meadow's: a tenth of a unit to the metre.
import * as pc from "playcanvas";
import {
  FIGURE_CAPSULE,
  bandHour,
  bobOf,
  limbPitch,
  type BandPerson,
  type BandState,
  type Figure,
  type PartShape,
  type Task,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, capsuleMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { billboard, glowMaterial } from "./glow.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

const M = 0.1;
/** The most people a band's batches hold. */
const MOST = 32;
/** The figure's tones: hide and cloth, legs, skin, hair, eyes. */
const TONES: readonly Rgb[] = [
  [0.62, 0.46, 0.3],
  [0.42, 0.3, 0.2],
  [0.82, 0.6, 0.45],
  [0.18, 0.12, 0.08],
  [0.07, 0.06, 0.06],
];
/** How tall a grown one stands, in units: as large against life as the meadow draws its beasts (3.2 times). */
const STANDS = 0.55;
const KIN_SCALE = { grown: 1, old: 0.94, child: 0.66 } as const;

/** What a person's hands are at, as the village's figures move them. */
function taskOf(p: BandPerson): Task | null {
  switch (p.doing) {
    case "gathering":
      return "gather";
    case "butchering":
      return "dig";
    case "playing":
      return "play";
    case "tending":
    case "resting":
      return "talk";
    default:
      return null;
  }
}

export class BandLayer {
  readonly root = new pc.Entity("band");
  private readonly stage: Stage;
  private readonly shapes: Record<PartShape, pc.Mesh>;
  private figure: { f: Figure; batches: InstancedBatch[] } | null = null;
  private readonly sleepers: InstancedBatch;
  /** What they carry: an armful gathered, meat, the camp packed. */
  private readonly loads: Record<"food" | "meat" | "bundle", InstancedBatch>;
  private readonly spears: InstancedBatch;
  private readonly shelters: InstancedBatch;
  private readonly logs: InstancedBatch;
  private readonly flames: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly kill: InstancedBatch;
  private readonly light: pc.Entity;
  /** The fire's own glow, turned to the eye: seen from afar at night. */
  private readonly blaze: pc.Entity;
  private shown = 0;

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    const box = keptMesh(boxMesh(stage)),
      cone = keptMesh(coneMesh(stage, 0.5, 1, 9)),
      cyl = keptMesh(cylinderMesh(stage, 0.5, 1, 8));
    this.shapes = {
      box,
      capsule: keptMesh(capsuleMesh(stage, FIGURE_CAPSULE.radius, FIGURE_CAPSULE.height)),
      cylinder: cyl,
      cone,
    };
    const batch = (mesh: pc.Mesh, color: Rgb, n: number, material?: pc.Material) =>
      new InstancedBatch(stage, mesh, color, n, this.root, material);
    this.sleepers = batch(keptMesh(capsuleMesh(stage, 0.5, 2)), TONES[0]!, MOST);
    this.loads = {
      food: batch(box, [0.66, 0.5, 0.26], MOST),
      meat: batch(box, [0.58, 0.2, 0.16], MOST),
      bundle: batch(box, [0.56, 0.44, 0.32], MOST),
    };
    this.spears = batch(cyl, [0.48, 0.36, 0.22], MOST);
    this.shelters = batch(cone, [0.6, 0.47, 0.33], 12);
    this.logs = batch(box, [0.3, 0.2, 0.12], 4);
    const fire = new pc.StandardMaterial();
    fire.useLighting = false;
    fire.diffuse = new pc.Color(0, 0, 0);
    fire.emissive = new pc.Color(1, 0.52, 0.12);
    fire.update();
    this.flames = batch(cone, [1, 0.5, 0.1], 3, fire);
    this.smoke = batch(box, [0.62, 0.62, 0.64], 8, flatMaterial([0.62, 0.62, 0.64], 0.55));
    this.kill = batch(box, [0.5, 0.3, 0.26], 1);
    // (The firelight on the ground about it, brighter at night: a flat disc, added to the ground.)
    this.light = new pc.Entity("firelight");
    this.light.addComponent("render", {
      meshInstances: [
        new pc.MeshInstance(
          pc.Mesh.fromGeometry(
            stage.device,
            new pc.PlaneGeometry({ halfExtents: new pc.Vec2(0.5, 0.5) }),
          ),
          glowMaterial(stage, [
            [0, "rgba(255,170,80,0.85)"],
            [0.45, "rgba(255,120,40,0.35)"],
            [1, "rgba(255,90,20,0)"],
          ]),
        ),
      ],
    });
    this.root.addChild(this.light);
    this.blaze = billboard(
      stage,
      glowMaterial(stage, [
        [0, "rgba(255,210,120,0.95)"],
        [0.3, "rgba(255,140,40,0.45)"],
        [1, "rgba(255,90,20,0)"],
      ]),
      0.5,
      this.root,
    );
    parent.addChild(this.root);
  }

  /** The people's figure (null: none), drawn part by part in their tones. */
  people(f: Figure | null): void {
    for (const b of this.figure?.batches ?? []) b.destroy();
    this.figure = f
      ? {
          f,
          batches: f.parts.map(
            (part) =>
              new InstancedBatch(
                this.stage,
                this.shapes[part.shape],
                TONES[part.tone]!,
                MOST,
                this.root,
              ),
          ),
        }
      : null;
  }

  /** The band as it stands at screen time `s` (null: none drawn). */
  update(b: BandState | null, s: number): void {
    const fig = this.figure;
    if (!b || !fig) {
      this.root.enabled = false;
      return;
    }
    this.root.enabled = true;
    const awake = b.people.filter((p) => p.doing !== "sleeping"),
      asleep = b.people.filter((p) => p.doing === "sleeping"),
      size = (p: BandPerson) => (STANDS / 0.55) * fig.f.scale * KIN_SCALE[p.kin];
    // Each awake one in the parts of the figure, limbs swinging as they go or work.
    fig.f.parts.forEach((part, i) => {
      fig.batches[i]!.set(awake.length, (j, out) => {
        const p = awake[j]!,
          k = size(p),
          task = taskOf(p),
          walking = p.speed > 0.1,
          pitch = limbPitch(part, task, walking, walking ? p.phase : s + p.id * 0.37, p.id),
          hinge = part.pivot ?? 0,
          py = part.y + hinge - hinge * Math.cos(pitch),
          pz = part.z - hinge * Math.sin(pitch),
          c = Math.cos(p.heading),
          sn = Math.sin(p.heading),
          // (Bent to the work: those gathering and cutting stoop a little.)
          bob = bobOf(task, s, p.id);
        out[0] = p.x * M + (part.x * c + pz * sn) * k;
        out[1] = (py + bob) * k;
        out[2] = p.z * M + (-part.x * sn + pz * c) * k;
        out[3] = part.sx * k;
        out[4] = part.sy * k;
        out[5] = part.sz * k;
        out[6] = p.heading;
        out[7] = pitch;
      });
    });
    // The sleeping, lying about the fire.
    this.sleepers.set(asleep.length, (j, out) => {
      const p = asleep[j]!,
        k = size(p);
      out[0] = p.x * M;
      out[1] = 0.05 * k;
      out[2] = p.z * M;
      out[3] = 0.17 * k;
      out[4] = 0.25 * k;
      out[5] = 0.12 * k;
      out[6] = p.heading + Math.PI / 2;
      out[7] = Math.PI / 2;
    });
    // What they carry, on their backs.
    for (const what of ["food", "meat", "bundle"] as const) {
      const laden = awake.filter((p) => p.carrying === what);
      this.loads[what].set(laden.length, (j, out) => {
        const p = laden[j]!,
          k = size(p),
          big = what === "bundle" ? 1.35 : what === "meat" ? 1.1 : 0.85;
        out[0] = p.x * M - Math.sin(p.heading) * 0.075 * k;
        out[1] = 0.36 * k;
        out[2] = p.z * M - Math.cos(p.heading) * 0.075 * k;
        out[3] = 0.15 * k * big;
        out[4] = 0.13 * k * big;
        out[5] = 0.09 * k * big;
        out[6] = p.heading;
      });
    }
    // The hunters' spears: aslant as they go, levelled as they run.
    const armed = awake.filter(
      (p) =>
        p.hunter &&
        (p.doing === "stalking" ||
          p.doing === "chasing" ||
          p.doing === "butchering" ||
          (p.doing === "walking" && b.quarry >= 0)),
    );
    this.spears.set(armed.length, (j, out) => {
      const p = armed[j]!,
        k = size(p),
        c = Math.cos(p.heading),
        sn = Math.sin(p.heading),
        side = 0.13 * k;
      out[0] = p.x * M + c * side;
      out[1] = 0.3 * k;
      out[2] = p.z * M - sn * side;
      out[3] = 0.016 * k;
      out[4] = 0.62 * k;
      out[5] = 0.016 * k;
      out[6] = p.heading;
      out[7] = p.doing === "chasing" ? 1.3 : 0.35;
    });
    // The camp: its shelters, the fire, its smoke; packed away while they walk on.
    const camp = b.going ? null : b.camp,
      hour = bandHour(b),
      night = hour >= 19.5 || hour < 6.5 ? 1 : hour >= 18 || hour < 7.5 ? 0.5 : 0;
    this.shelters.set(b.shelters.length, (j, out) => {
      const h = b.shelters[j]!;
      out[0] = h.x * M;
      out[1] = 0.4;
      out[2] = h.z * M;
      out[3] = 0.76;
      out[4] = 0.8;
      out[5] = 0.76;
      out[6] = h.yaw;
    });
    this.logs.set(camp ? 3 : 0, (j, out) => {
      out[0] = camp!.x * M;
      out[1] = 0.012;
      out[2] = camp!.z * M;
      out[3] = 0.03;
      out[4] = 0.025;
      out[5] = 0.17;
      out[6] = (j * Math.PI) / 3;
    });
    this.flames.set(camp ? 3 : 0, (j, out) => {
      const flick = 0.75 + 0.25 * Math.sin(s * (9 + j * 3.1) + j * 2),
        tall = (0.22 + 0.08 * night) * flick * (1 - j * 0.22);
      out[0] = camp!.x * M + 0.03 * Math.sin(j * 2.1);
      out[1] = tall / 2 + 0.01;
      out[2] = camp!.z * M + 0.03 * Math.cos(j * 2.1);
      out[3] = 0.13 * (1 - j * 0.25);
      out[4] = tall;
      out[5] = 0.13 * (1 - j * 0.25);
      out[6] = j + s * 0.5;
    });
    this.smoke.set(camp ? 8 : 0, (j, out) => {
      const u = (s * 0.18 + j / 8) % 1,
        r = 0.035 + 0.09 * u;
      out[0] = camp!.x * M + 0.12 * u + 0.02 * Math.sin(s + j);
      out[1] = 0.2 + 1.3 * u;
      out[2] = camp!.z * M + 0.05 * u;
      out[3] = r;
      out[4] = r;
      out[5] = r;
      out[6] = j * 0.9 + s * 0.2;
    });
    this.light.enabled = !!camp;
    this.blaze.enabled = !!camp && night > 0;
    if (camp) {
      const reach = 0.6 + 0.9 * night,
        flick = 0.92 + 0.08 * Math.sin(s * 7.3);
      this.light.setLocalPosition(camp.x * M, 0.008, camp.z * M);
      this.light.setLocalScale(reach * 2 * flick, 1, reach * 2 * flick);
      this.blaze.setLocalPosition(camp.x * M, 0.2, camp.z * M);
      const glow = (0.55 + 0.45 * night) * flick;
      this.blaze.setLocalScale(glow, glow, glow);
    }
    // The kill they cut up: smaller as it goes.
    const kill = b.kill;
    this.kill.set(kill ? 1 : 0, (_, out) => {
      const l = kill!.length * M * 0.6 * (0.35 + 0.65 * kill!.meat);
      out[0] = kill!.x * M;
      out[1] = l * 0.12;
      out[2] = kill!.z * M;
      out[3] = l * 0.4;
      out[4] = l * 0.24;
      out[5] = l;
      out[6] = kill!.yaw;
    });
    this.shown = awake.length * fig.f.parts.length + asleep.length;
  }

  /** How many parts are drawn (the look tools). */
  count(): number {
    return this.shown;
  }

  /** Where each of the band's names goes on the screen, over their heads (null: behind the eye). */
  namesOnScreen(b: BandState): { id: number; at: { x: number; y: number } | null }[] {
    const scale = this.figure?.f.scale ?? 1,
      world = this.root.getWorldTransform(),
      at = new pc.Vec3(),
      out = new pc.Vec3();
    return b.people.map((p) => {
      const lying = p.doing === "sleeping" ? 0.35 : 1,
        up = (STANDS * lying + 0.12) * scale * KIN_SCALE[p.kin];
      world.transformPoint(new pc.Vec3(p.x * M, up, p.z * M), at);
      this.stage.camera.camera!.worldToScreen(at, out);
      return { id: p.id, at: out.z > 0 ? { x: out.x, y: out.y } : null };
    });
  }

  /** Where a person of the band is on the screen (the look tools). */
  onScreen(b: BandState, id: number): { x: number; y: number } | null {
    const p = b.people.find((q) => q.id === id);
    if (!p) return null;
    const at = new pc.Vec3(),
      out = new pc.Vec3();
    this.root.getWorldTransform().transformPoint(new pc.Vec3(p.x * M, 0.3, p.z * M), at);
    this.stage.camera.camera!.worldToScreen(at, out);
    return { x: out.x, y: out.y };
  }
}
