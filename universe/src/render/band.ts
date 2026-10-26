// A band drawn (Phase 28 M158): the first people of the peopling's near view on the last age's
// land, among its beasts — each in the parts of their people's own figure, walking, gathering,
// cutting up a kill, at play, talking by the fire or asleep about it; what they carry on their
// backs, the hunters' spears; their shelters, the fire, its smoke and its light on the ground at
// night, and the kill they cut up. Units as the meadow's: a tenth of a unit to the metre.
import * as pc from "playcanvas";
import {
  FIGURE_CAPSULE,
  SEATED,
  bandHour,
  bobOf,
  limbPitch,
  meadowCellAt,
  madeShare,
  seatedSink,
  type BandPerson,
  type BandState,
  figurePaint,
  partExtent,
  type Figure,
  type FigureBody,
  type MeadowState,
  type PartShape,
  type Task,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, capsuleMesh, coneMesh, cylinderMesh, keptMesh } from "./batch.ts";
import { billboard, glowMaterial } from "./glow.ts";
import { grassDrawn } from "./meadow.ts";
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
    // Their crafts (Phase 49 M211).
    case "knapping":
      return "knap";
    case "cording":
      return "twist";
    case "hafting":
      return "bind";
    case "scraping":
      return "scrape";
    case "sewing":
      return "sew";
    case "grinding":
      return "grind";
    case "kindling":
      return "kindle";
    default:
      return null;
  }
}

/** A hide's colour: raw, and scraped pale. */
const HIDE: Rgb = [0.5, 0.32, 0.22],
  SCRAPED: Rgb = [0.84, 0.76, 0.6];
/** How many of the band's spears lean by the shelters at most. */
const RACKED = 10;

export class BandLayer {
  readonly root = new pc.Entity("band");
  private readonly stage: Stage;
  private readonly shapes: Record<PartShape, pc.Mesh>;
  /** The figure drawn, its batches, and how high it stands against an upright ape (what it carries rides so high). */
  private figure: { f: Figure; batches: InstancedBatch[]; lift: number } | null = null;
  private readonly sleepers: InstancedBatch;
  /** What they carry: an armful gathered, meat, the camp packed. */
  private readonly loads: Record<"food" | "meat" | "bundle", InstancedBatch>;
  private readonly spears: InstancedBatch;
  private readonly shelters: InstancedBatch;
  private readonly logs: InstancedBatch;
  private readonly flames: InstancedBatch;
  private readonly smoke: InstancedBatch;
  private readonly kill: InstancedBatch;
  /**
   * Their crafts (Phase 49 M211): the work ground's stone, the flakes knapped off about it, the
   * colour ground on it; the frame a hide is stretched on, and the hide; the spears leaning by
   * the shelters.
   */
  private readonly workStone: InstancedBatch;
  private readonly flakes: InstancedBatch;
  private readonly ochre: InstancedBatch;
  private readonly frame: InstancedBatch;
  private readonly hide: InstancedBatch;
  private readonly racked: InstancedBatch;
  /** The colours the flakes and the ground colour were last drawn in. */
  private stoneTone = "";
  private ochreTone = "";
  private hideTone = "";
  private drawnCrafts = { flakes: 0, frame: 0, hide: 0, racked: 0 };
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
    this.workStone = batch(box, [0.46, 0.44, 0.42], 1);
    this.flakes = batch(box, [0.42, 0.38, 0.34], 64);
    this.ochre = batch(box, [0.62, 0.2, 0.12], 1);
    this.frame = batch(box, [0.4, 0.29, 0.18], 3);
    this.hide = batch(box, HIDE, 1);
    this.racked = batch(cyl, [0.48, 0.36, 0.22], RACKED);
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

  /**
   * The people's figure (null: none), drawn part by part in their tones: in hides, or in a
   * people's own look (Phase 34), their hide and a wrap of hide over it; the sleepers under
   * their hides' colour.
   */
  people(f: Figure | null, body: FigureBody | null = null): void {
    for (const b of this.figure?.batches ?? []) b.destroy();
    const paint = figurePaint(body, "forage", 0),
      tones: readonly Rgb[] = paint.folk ? paint.tones : [...TONES, TONES[0]!];
    this.sleepers.recolor(paint.folk ? paint.tones[0] : TONES[0]!);
    this.figure = f
      ? {
          f,
          batches: f.parts.map(
            (part) =>
              new InstancedBatch(
                this.stage,
                this.shapes[part.shape],
                tones[part.tone]!,
                MOST,
                this.root,
              ),
          ),
          lift: Math.max(...f.parts.map((p) => p.y + partExtent(p)[1] / 2)) / 0.55,
        }
      : null;
  }

  /**
   * The band as it stands at screen time `s` (null: none drawn), on its meadow (what lies on the
   * ground lies on its grass).
   */
  update(b: BandState | null, s: number, m: MeadowState | null = null): void {
    const fig = this.figure;
    if (!b || !fig) {
      this.root.enabled = false;
      return;
    }
    this.root.enabled = true;
    const awake = b.people.filter((p) => p.doing !== "sleeping"),
      asleep = b.people.filter((p) => p.doing === "sleeping"),
      size = (p: BandPerson) => (STANDS / 0.55) * fig.f.scale * KIN_SCALE[p.kin],
      tasks = awake.map(taskOf),
      // (Sat on the ground at a craft, Phase 49 M211: sunk to their hips, the legs out before
      // them; a figure with no pair of legs to sit on works standing.)
      sinks = tasks.map((task) => seatedSink(fig.f.parts, task));
    // Each awake one in the parts of the figure, limbs swinging as they go or work.
    fig.f.parts.forEach((part, i) => {
      fig.batches[i]!.set(awake.length, (j, out) => {
        const p = awake[j]!,
          k = size(p),
          task = tasks[j]!,
          sink = sinks[j]!,
          walking = p.speed > 0.1,
          pitch = limbPitch(
            part,
            part.role === "leg" && !sink && task && SEATED.has(task) ? null : task,
            walking,
            walking ? p.phase : s + p.id * 0.37,
            p.id,
          ),
          hinge = part.pivot ?? 0,
          py = part.y + hinge - hinge * Math.cos(pitch),
          pz = part.z - hinge * Math.sin(pitch),
          c = Math.cos(p.heading),
          sn = Math.sin(p.heading),
          // (Bent to the work: those gathering and cutting stoop a little.)
          bob = bobOf(task, s, p.id);
        out[0] = p.x * M + (part.x * c + pz * sn) * k;
        out[1] = (py + bob - sink) * k;
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
        out[1] = 0.36 * k * fig.lift;
        out[2] = p.z * M - Math.cos(p.heading) * 0.075 * k;
        out[3] = 0.15 * k * big;
        out[4] = 0.13 * k * big;
        out[5] = 0.09 * k * big;
        out[6] = p.heading;
      });
    }
    // The hunters' spears: aslant as they go, levelled as they run.
    const armed = awake.filter((p) => this.armed(b, p));
    this.spears.set(armed.length, (j, out) => {
      const p = armed[j]!,
        k = size(p),
        c = Math.cos(p.heading),
        sn = Math.sin(p.heading),
        side = 0.13 * k;
      out[0] = p.x * M + c * side;
      out[1] = 0.3 * k * fig.lift;
      out[2] = p.z * M - sn * side;
      out[3] = 0.016 * k;
      out[4] = 0.62 * k;
      out[5] = 0.016 * k;
      out[6] = p.heading;
      out[7] = p.doing === "chasing" ? 1.3 : 0.35;
    });
    // The camp: its shelters, the fire, its smoke; packed away while they walk on. (At a fresh camp
    // the fire is drawn once it is made — till then, a thread of smoke at the drill: Phase 49 M211.)
    const pitched = b.going ? null : b.camp,
      camp = b.lit ? pitched : null,
      kindling = !!pitched && !b.lit && b.people.some((p) => p.doing === "kindling"),
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
    this.logs.set(pitched ? 3 : 0, (j, out) => {
      out[0] = pitched!.x * M;
      out[1] = 0.012;
      out[2] = pitched!.z * M;
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
    const wisp = camp ? 1 : 0.3;
    this.smoke.set(camp ? 8 : kindling ? 3 : 0, (j, out) => {
      const u = (s * 0.18 + j / 8) % 1,
        r = (0.035 + 0.09 * u) * wisp;
      out[0] = pitched!.x * M + 0.12 * u * wisp + 0.02 * Math.sin(s + j);
      out[1] = (0.2 + 1.3 * u) * wisp;
      out[2] = pitched!.z * M + 0.05 * u * wisp;
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
    this.crafts(b, pitched, fig.f.scale, armed.length, m);
    this.shown = awake.length * fig.f.parts.length + asleep.length;
  }

  /** Whether a hunter carries their spear now (drawn in their hand, not by the shelters). */
  private armed(b: BandState, p: BandPerson): boolean {
    return (
      p.hunter &&
      (p.doing === "stalking" ||
        p.doing === "chasing" ||
        p.doing === "butchering" ||
        (p.doing === "walking" && b.quarry >= 0))
    );
  }

  /**
   * Their crafts (Phase 49 M211), drawn as large against life as they are: the work ground's flat
   * stone with the flakes knapped off about it in their stone's own colour, and the colour they
   * grind; the frame a hide is stretched on, the hide going pale as it is scraped; the spears not
   * in a hunter's hand stood together by the work ground.
   */
  private crafts(
    b: BandState,
    camp: { x: number; z: number } | null,
    scale: number,
    carried: number,
    m: MeadowState | null,
  ): void {
    const k = b.kit,
      cr = b.craft,
      // (Units to a metre, at the figures' size.)
      u = (STANDS / 1.6) * scale,
      w = b.work,
      stoneTone = cr.stone.colour.join();
    if (stoneTone !== this.stoneTone) {
      this.stoneTone = stoneTone;
      this.flakes.recolor(cr.stone.colour as Rgb);
    }
    // (Drawn larger than life, as the figures are, to be seen among them: the stone they work on
    // and the flakes struck off about it, under where they sit.)
    this.workStone.set(camp ? 1 : 0, (_, out) => {
      out[0] = w.x * M;
      out[1] = 0.11 * u;
      out[2] = w.z * M;
      out[3] = 0.7 * u;
      out[4] = 0.22 * u;
      out[5] = 0.5 * u;
      out[6] = 0.4;
    });
    this.flakes.set(camp ? Math.min(64, k.flakes) : 0, (j, out) => {
      const a = j * 2.39996,
        r = (0.45 + 0.75 * Math.sqrt((j + 0.5) / 64)) * u,
        x = w.x * M + Math.sin(a) * r,
        z = w.z * M + Math.cos(a) * r;
      // (On the grass where they fell, not lost in it.)
      out[0] = x;
      out[1] = (m ? grassDrawn(m.grass[meadowCellAt(x / M, z / M)] ?? 0) : 0) + 0.02 * u;
      out[2] = z;
      out[3] = (0.12 + 0.08 * (((j * 7) % 5) / 4)) * u;
      out[4] = 0.03 * u;
      out[5] = 0.08 * u;
      out[6] = j * 1.3;
    });
    const pigment = cr.pigment,
      ochreTone = pigment?.colour.join() ?? "";
    if (pigment && ochreTone !== this.ochreTone) {
      this.ochreTone = ochreTone;
      this.ochre.recolor(pigment.colour as Rgb);
    }
    // (The colour ground on the stone, a heap of it on its top.)
    this.ochre.set(camp && pigment && k.ochre > 0 ? 1 : 0, (_, out) => {
      out[0] = w.x * M + 0.12 * u;
      out[1] = 0.23 * u;
      out[2] = w.z * M + 0.04 * u;
      out[3] = (0.2 + 0.03 * Math.min(6, k.ochre)) * u;
      out[4] = 0.03 * u;
      out[5] = (0.16 + 0.02 * Math.min(6, k.ochre)) * u;
      out[6] = 0.4;
    });
    // The frame: two posts and a bar across, standing across the way out from the fire.
    const f = b.frame,
      cx = Math.cos(f.yaw),
      sx = Math.sin(f.yaw);
    this.frame.set(camp ? 3 : 0, (j, out) => {
      const side = j === 2 ? 0 : (j === 0 ? -1 : 1) * 0.75 * u;
      out[0] = f.x * M + cx * side;
      out[1] = j === 2 ? 1.62 * u : 0.83 * u;
      out[2] = f.z * M - sx * side;
      out[3] = j === 2 ? 1.62 * u : 0.07 * u;
      out[4] = j === 2 ? 0.07 * u : 1.66 * u;
      out[5] = 0.07 * u;
      out[6] = f.yaw;
    });
    // The hide on it: one waiting to be scraped, or being scraped — paler the further it has gone.
    const scraper = b.people.find((p) => p.making?.what === "hide"),
      onFrame = !!camp && (k.hides > 0 || !!scraper),
      gone = scraper ? Math.floor(madeShare(scraper.making!) * 4) / 4 : 0,
      tone: Rgb = [
        HIDE[0] + (SCRAPED[0] - HIDE[0]) * gone,
        HIDE[1] + (SCRAPED[1] - HIDE[1]) * gone,
        HIDE[2] + (SCRAPED[2] - HIDE[2]) * gone,
      ],
      hideTone = tone.join();
    if (hideTone !== this.hideTone) {
      this.hideTone = hideTone;
      this.hide.recolor(tone);
    }
    this.hide.set(onFrame ? 1 : 0, (_, out) => {
      out[0] = f.x * M;
      out[1] = 0.86 * u;
      out[2] = f.z * M;
      out[3] = 1.28 * u;
      out[4] = 1.2 * u;
      out[5] = 0.03 * u;
      out[6] = f.yaw;
    });
    // The spears not in a hunter's hand, stood together beside the work ground, their points
    // leaning in to meet.
    const leaning = camp ? Math.max(0, Math.min(RACKED, k.spears - carried)) : 0,
      length = 2.1 * u,
      tilt = 0.24,
      across = camp ? Math.atan2(w.x - camp.x, w.z - camp.z) + Math.PI / 2 : 0,
      sx0 = w.x * M + Math.sin(across) * 1.5 * u,
      sz0 = w.z * M + Math.cos(across) * 1.5 * u;
    this.racked.set(leaning, (j, out) => {
      const a = (2 * Math.PI * j) / leaning + 0.4,
        r = (length / 2) * Math.sin(tilt),
        inward = a + Math.PI;
      // (Its foot out on a ring, leaning in: its middle half way in, and half its height up.)
      out[0] = sx0 + Math.sin(a) * r;
      out[1] = (length / 2) * Math.cos(tilt);
      out[2] = sz0 + Math.cos(a) * r;
      out[3] = 0.05 * u;
      out[4] = length;
      out[5] = 0.05 * u;
      out[6] = inward;
      out[7] = tilt;
    });
    this.drawnCrafts = {
      flakes: camp ? Math.min(64, k.flakes) : 0,
      frame: camp ? 3 : 0,
      hide: onFrame ? 1 : 0,
      racked: leaning,
    };
  }

  /** How many parts are drawn (the look tools). */
  count(): number {
    return this.shown;
  }

  /** Their crafts as drawn (the look tools): the flakes, the frame and its hide, the spears leaning. */
  craftsDrawn(): { flakes: number; frame: number; hide: number; racked: number } {
    return { ...this.drawnCrafts };
  }

  /** Where each of the band's names goes on the screen, over their heads (null: behind the eye). */
  namesOnScreen(b: BandState): { id: number; at: { x: number; y: number } | null }[] {
    const scale = this.figure?.f.scale ?? 1,
      lift = this.figure?.lift ?? 1,
      world = this.root.getWorldTransform(),
      at = new pc.Vec3(),
      out = new pc.Vec3();
    return b.people.map((p) => {
      const lying = p.doing === "sleeping" ? 0.35 : 1,
        up = (STANDS * lying * lift + 0.12) * scale * KIN_SCALE[p.kin];
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
