// A town's fabric drawn (Phase 23 M149): the parts the view lays out, in batches by mesh and
// colour — its ground and what stands all year in one set, put once as the year's plan comes;
// what rises through the year (homes climbing in their scaffolds, buildings, walls) in another,
// put again as it climbs. One unit is ten metres, as in the village.
import * as pc from "playcanvas";
import {
  LOT,
  askedGrown,
  civicMoments,
  footprint,
  progress,
  type TownPlan,
} from "../bridge/index.ts";
import {
  TownParts,
  blazeNow,
  raidNow,
  type RaidNow,
  homesAlong,
  civicChimneys,
  civicMotions,
  civicsActive,
  siteFlagAt,
  homeBox,
  lotNear,
  roofTop,
  townCivics,
  ashGone,
  townAsh,
  townGround,
  townHomes,
  townScene,
  homesSeen,
  townDetail,
  townDetailSteps,
  farOf,
  farSteps,
  DETAIL_HYSTERESIS,
  type TownDetail,
  townBuildingAt,
  townThingAt,
  townWalls,
  strikeSpan,
  strikeTurned,
  partBatch,
  isCompound,
  SHAPE_TONES,
  type CompoundMesh,
  type LampMesh,
  type TownGroup,
  type BlazeNow,
  type CivicMotion,
  type PartMesh,
  layTown,
  type Laid,
  type TownScene,
  type TownThing,
  type Burnable,
} from "../view/index.ts";
import {
  InstancedBatch,
  boxMesh,
  coneMesh,
  cylinderMesh,
  gableMesh,
  keptMesh,
  placeInstance,
} from "./batch.ts";
import { domeMesh } from "./colony.ts";
import { compoundMeshes, roofCode, shapeLamps, shapeMaterial } from "./compound.ts";
import { tonedMaterial, type Rgb, type Stage } from "./stage.ts";
import { TownNetsLayer } from "./townnets.ts";
import { townNetsSteps, wornOf, type NetsClear, type TownNets } from "../view/index.ts";

const M = 0.1;
/**
 * How long a frame draws a new choosing of a town's homes whole (ms: TownLayer.look). At 4 ms, panning over a great city
 * missed its frame one time in twenty more than standing still (p95 20 ms against 18: 2026-11-21); its steps are each a
 * millisecond or less.
 */
const CHOOSE_BUDGET = 2;
/** How many parts' matrices a choosing works out between looks at the clock (PartBatches.showOver). */
const SHOW_STEP = 512;
/** How often what rises is put again (moments of the sim apart, at the least): a few times a day. */
const RISE_EVERY = 6 * 3600,
  /** ... and while what struck it plays out — homes catching, burning, falling in (Phase 42 M201). */
  STRUCK_EVERY = 60;

type Group = TownGroup;
type AnyMesh = PartMesh | CompoundMesh | LampMesh;
/** A piece of one kind of part (PartBatches.showOver), where its parts stand: its batch's key, its matrices, its bounds. */
type Chunk = {
  key: string;
  kind: { mesh: AnyMesh; lamp: boolean; roof: boolean; shape: boolean; groups: Group[] };
  n: number;
  i: number;
  m: Float32Array | null;
  lo: number[];
  hi: number[];
};
/**
 * How broad a piece of a town's parts is (metres a side), and how many parts of a kind are cut so: a great city some five
 * kilometres across in a few dozen batches of each kind; a town of fewer parts drawn whole as before.
 */
const CHUNK = 1024,
  CHUNK_MIN = 2048,
  /** How far a shape drawn as one may stand past its walls' box (metres: a roof, a tower's mast). */
  SHAPE_OVER = 12;
/** Which piece a part standing at (x, z) metres from the square is in. */
function cellOf(x: number, z: number): number {
  const u = Math.max(0, Math.min(127, Math.floor(x / CHUNK) + 64)),
    v = Math.max(0, Math.min(127, Math.floor(z / CHUNK) + 64));
  return u * 128 + v;
}

/** Batches of parts by mesh, each part in its own colour, kept and refilled (made anew only when one outgrows itself). */
class PartBatches {
  private readonly batches = new Map<string, InstancedBatch>();
  private readonly stage: Stage;
  private readonly root: pc.Entity;
  private readonly meshes: Readonly<Record<AnyMesh, pc.Mesh>>;
  /** The windows' glass, lit at night (its batch made anew when it changes). */
  lamps: pc.StandardMaterial | null = null;
  private lampsIn: pc.StandardMaterial | null = null;
  /**
   * The walls' material and the roofs' (snow lies on these alone), shared by every batch of them made: one made for each
   * batch first come as the eye moved (a tank once a tenement was drawn whole) was a program built in that frame, half a
   * second of WebKit's (2026-11-21).
   */
  private toned: { wall: pc.StandardMaterial; roof: pc.StandardMaterial } | null = null;
  private snow = 0;
  /** Its batches of roofs (snow lies on these). */
  private readonly roofs = new Set<string>();
  constructor(stage: Stage, root: pc.Entity, meshes: Readonly<Record<AnyMesh, pc.Mesh>>) {
    this.stage = stage;
    this.root = root;
    this.meshes = meshes;
  }
  /** Where showOver works its instances out before they are put, kept from one showing to the next. */
  private readonly staged = new Map<string, Float32Array>();
  show(...all: TownParts[]): void {
    const run = this.showOver(Infinity, ...all);
    while (!run.next().done);
  }
  /**
   * As show(), its instances' matrices worked out a `step` at a time (yielding between), and all put in the one step
   * at its end: what stands is replaced in one frame, whole, and that frame only copies and sends. (Worked out in the
   * frame it was shown, a great city's 30,000 parts and more cost that frame 6 ms here and four times that on a phone,
   * at every choosing of what stands whole near the eye: 2026-11-21.)
   */
  *showOver(step: number, ...all: TownParts[]): Generator<void, void> {
    // (One batch to a mesh, its roofs apart for the snow that lies on them: every colour of wall, roof and ground rides in
    // its instance. The windows keep theirs, lit at night.)
    const kinds = new Map<
      string,
      { mesh: AnyMesh; lamp: boolean; roof: boolean; shape: boolean; n: number; groups: Group[] }
    >();
    for (const parts of all)
      for (const [key, g] of parts.groups) {
        const n = g.data.length / 7;
        if (n === 0) continue;
        const k = partBatch(key, g);
        let kind = kinds.get(k);
        if (!kind)
          kinds.set(
            k,
            (kind = {
              mesh: g.mesh,
              lamp: !!g.lamp,
              roof: k.endsWith("|roof"),
              shape: isCompound(g.mesh),
              n: 0,
              groups: [],
            }),
          );
        kind.n += n;
        kind.groups.push(g);
      }
    // (A kind of many parts is cut by where they stand, CHUNK metres a side, each piece its own batch bounded by what it
    // holds, so a piece out of the eye's sight is not drawn at all: at the owner's look over a great city half of it stands
    // behind the eye or off to the side, and every part of it went through a phone's GPU each frame (2026-11-21).)
    const sets: Chunk[] = [],
      chunkOf = new Map<string, Map<number, Chunk>>();
    for (const [k, kind] of kinds) {
      const cut = kind.n >= CHUNK_MIN,
        byCell = new Map<number, Chunk>();
      chunkOf.set(k, byCell);
      for (const g of kind.groups) {
        const d = g.data;
        for (let o = 0; o < d.length; o += 7) {
          const cell = cut ? cellOf(d[o]!, d[o + 2]!) : 0;
          let c = byCell.get(cell);
          if (!c) {
            byCell.set(
              cell,
              (c = {
                key: cut ? `${k}#${cell}` : k,
                kind,
                n: 0,
                i: 0,
                m: null,
                lo: [Infinity, Infinity, Infinity],
                hi: [-Infinity, -Infinity, -Infinity],
              }),
            );
            sets.push(c);
          }
          c.n++;
        }
      }
    }
    for (const c of sets) {
      let m = this.staged.get(c.key);
      if (!m || m.length < c.n * 16) {
        m = new Float32Array(Math.ceil(c.n * 1.3) * 16);
        this.staged.set(c.key, m);
      }
      c.m = m;
    }
    const t = [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1];
    let since = 0;
    for (const [k, kind] of kinds) {
      const byCell = chunkOf.get(k)!,
        cut = kind.n >= CHUNK_MIN,
        toned = !kind.lamp;
      // (Group by group, in the order they were gathered.)
      for (const g of kind.groups) {
        const d = g.data,
          extra = g.extra,
          roof = g.roof ? roofCode(g.roof) : 1;
        t[8] = g.color[0];
        t[9] = g.color[1];
        t[10] = g.color[2];
        for (let o = 0, e = 0; o < d.length; o += 7, e += 3) {
          const c = byCell.get(cut ? cellOf(d[o]!, d[o + 2]!) : 0)!,
            at = c.i * 16;
          t[0] = d[o]! * M;
          t[1] = d[o + 1]! * M;
          t[2] = d[o + 2]! * M;
          t[3] = d[o + 3]! * M;
          t[4] = d[o + 4]! * M;
          t[5] = d[o + 5]! * M;
          t[6] = d[o + 6]!;
          placeInstance(c.m!, at, t, toned);
          c.i++;
          // (A home drawn as one: its roof's breadth, height and depth and its colour where a plain part's matrix has
          // nothing (render/compound.ts).)
          if (extra) {
            const m = c.m!;
            m[at + 1] = extra[e]! * M;
            m[at + 4] = extra[e + 1]! * M;
            m[at + 9] = extra[e + 2]! * M;
            m[at + 15] = roof;
          }
          // (Its bounds: as far each way as the part could reach, however it is turned; a shape's roof, a tower's mast,
          // over it.)
          const r =
            (Math.abs(t[3]) + Math.abs(t[4]) + Math.abs(t[5])) / 2 +
            (kind.shape ? SHAPE_OVER * M : 0);
          for (let a = 0; a < 3; a++) {
            if (t[a]! - r < c.lo[a]!) c.lo[a] = t[a]! - r;
            if (t[a]! + r > c.hi[a]!) c.hi[a] = t[a]! + r;
          }
          if (++since >= step) {
            since = 0;
            yield;
          }
        }
      }
    }
    const shown = new Set<string>();
    for (const c of sets) {
      const { kind } = c;
      shown.add(c.key);
      let b = this.batches.get(c.key);
      if (!b || b.capacity < c.n || (kind.lamp && this.lampsIn !== this.lamps)) {
        b?.destroy();
        this.toned ??= {
          wall: shapeMaterial(M, SHAPE_TONES.frame, SHAPE_TONES.tar),
          roof: tonedMaterial(),
        };
        if (kind.lamp && this.lamps) shapeLamps(this.lamps, M);
        const color = kind.groups[0]!.color;
        b = new InstancedBatch(
          this.stage,
          this.meshes[kind.mesh],
          [color[0], color[1], color[2]],
          Math.max(16, Math.ceil(c.n * 1.3)),
          this.root,
          kind.lamp ? (this.lamps ?? undefined) : kind.roof ? this.toned.roof : this.toned.wall,
          !kind.lamp,
        );
        if (kind.lamp) this.lampsIn = this.lamps;
        this.batches.set(c.key, b);
        if (kind.roof) this.roofs.add(c.key);
        if (this.snow > 0 && kind.roof) b.toneSnow(this.snow * 0.8);
        if (this.snow > 0) this.toned.wall.setParameter("uRoofSnow", this.snow * 0.8);
      }
      const m = c.m!;
      b.setMatrices(c.n, (out) => out.set(m.subarray(0, c.n * 16)));
      b.bound(c.lo, c.hi);
    }
    for (const [key, b] of this.batches) if (!shown.has(key)) b.set(0, () => {});
  }
  /** How many batches hold anything (for a measure). */
  get drawn(): number {
    let n = 0;
    for (const b of this.batches.values()) if (b.size) n++;
    return n;
  }
  /** How many parts they hold (for a measure). */
  get parts(): number {
    let n = 0;
    for (const b of this.batches.values()) n += b.size;
    return n;
  }
  /** Snow lying on the roofs (0 … 1). */
  season(snow: number): void {
    if (snow === this.snow) return;
    this.snow = snow;
    for (const [key, b] of this.batches) if (this.roofs.has(key)) b.toneSnow(snow * 0.8);
    // (The roofs of homes drawn as one lie in the walls' batches: render/compound.ts.)
    this.toned?.wall.setParameter("uRoofSnow", snow * 0.8);
  }

  destroy(): void {
    for (const b of this.batches.values()) b.destroy();
    this.batches.clear();
  }
}

/** The shapes a home is drawn as one in (render/compound.ts), made once a stage and kept. */
const SHAPES = new WeakMap<Stage, Record<CompoundMesh | LampMesh, pc.Mesh>>();
function shapesOf(stage: Stage): Record<CompoundMesh | LampMesh, pc.Mesh> {
  let kept = SHAPES.get(stage);
  if (!kept) {
    kept = compoundMeshes(stage.device);
    for (const m of Object.values(kept)) keptMesh(m);
    SHAPES.set(stage, kept);
  }
  return kept;
}

export class TownLayer {
  readonly root = new pc.Entity("town");
  private readonly settled: PartBatches;
  private readonly rising: PartBatches;
  private readonly parts = new TownParts();
  /** Its ground as drawn this year, and its homes standing done as drawn from where the eye last chose (townDetail). */
  private ground = new TownParts();
  /**
   * Its own lots' homes, drawn once a year (whole wherever the eye is), and those past them as last chosen, and the parts
   * the next choosing fills (the two kept and filled again in turn: a great city's choosing made all its homes' parts
   * anew, some 35,000, and the page swept up after it half a second at a time in WebKit; 2026-11-21).
   */
  private ownParts = new TownParts();
  private farParts = new TownParts();
  private spare = new TownParts();
  /** Where the eye looks (metres from its square), and the choosing its homes are drawn by; one being drawn over frames. */
  private eye = { x: 0, z: 0 };
  private detail: TownDetail | null = null;
  private choosing: Generator<void, void> | null = null;
  private seenAt = 0;
  private scene: TownScene | null = null;
  private key = "";
  private drawnAt = -Infinity;
  /** Whether anything rises or falls this year (else the rising set is put once). */
  private busy = false;
  /** Where a siege has its walls open (view/siegeworks.ts SiegeWorks.open; null: they stand whole). */
  private open: { readonly mid: number; readonly wide: number } | null = null;

  /** Its water, drains and power laid along its streets (render/townnets.ts; 2026-11-22). */
  readonly nets: TownNetsLayer;
  /** The places the village holds in its streets (its memorials, court, works, doors), for its networks to keep off. */
  netsKeep: NetsClear["keep"] = [];
  /** Its civics and walls as they stood when it was built, for its networks to keep off. */
  private standing = new TownParts();
  /**
   * A year's plan worked out ahead of its building (prepare), into parts of its own (`ground`, `own`, `far`: those the last
   * building drew, kept to be filled again): its scene, its ground, its homes as the eye would choose them, its civics and
   * walls, its networks. build() puts them in place of what it would work out, the same.
   */
  private prepared: {
    plan: TownPlan;
    ref: string;
    t: number;
    scene: TownScene;
    eye: { x: number; z: number };
    detail: TownDetail;
    ground: TownParts;
    own: TownParts;
    far: TownParts;
    standing: TownParts;
    nets: TownNets | null;
  } | null = null;
  private prepGround = new TownParts();
  private prepOwn = new TownParts();
  private prepFar = new TownParts();

  constructor(stage: Stage, parent: pc.Entity) {
    parent.addChild(this.root);
    this.nets = new TownNetsLayer(stage, this.root);
    const meshes: Record<AnyMesh, pc.Mesh> = {
      ...shapesOf(stage),
      dome: keptMesh(domeMesh(stage)),
      box: keptMesh(boxMesh(stage)),
      gable: keptMesh(gableMesh(stage)),
      cone: keptMesh(coneMesh(stage, 0.5, 1, 8)),
      cyl: keptMesh(cylinderMesh(stage, 0.5, 1, 10)),
    };
    this.settled = new PartBatches(stage, this.root, meshes);
    this.rising = new PartBatches(stage, this.root, meshes);
    // (Its homes standing done drawn each as one: view/compound.ts.)
    this.ownParts.compound = this.farParts.compound = this.spare.compound = true;
    this.prepOwn.compound = this.prepFar.compound = true;
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
  build(
    plan: TownPlan | null,
    ref: string,
    t: number,
    lamps: pc.StandardMaterial | null = null,
  ): void {
    const run = this.buildSteps(plan, ref, t, lamps);
    while (!run.next().done);
  }

  /** build() a few hundred parts at a step, between which it may be put off (render/village.ts buildOver); the same town. */
  *buildSteps(
    plan: TownPlan | null,
    ref: string,
    t: number,
    lamps: pc.StandardMaterial | null = null,
  ): Generator<void, void, void> {
    this.settled.lamps = this.rising.lamps = lamps;
    if (!plan) {
      this.scene = null;
      this.nets.build(null);
      this.parts.clear();
      this.settled.show(this.parts);
      this.rising.show(this.parts);
      this.visible = false;
      return;
    }
    this.visible = true;
    const t0 = performance.now(),
      ready = this.prepared,
      p = ready && ready.plan === plan && ready.ref === ref && ready.t === t ? ready : null;
    this.prepared = null;
    if (!p) {
      const run = this.prepareSteps(plan, ref, t, false);
      while (!run.next().done);
    }
    const made = p ?? this.prepared!;
    this.prepared = null;
    // What stands all year: the ground, the homes done, the ruins; those nearest the eye whole, the rest as seen from
    // afar, the city's lots past those drawn on their own blocks (view/town.ts townDetail): as worked out (prepareSteps),
    // the parts drawn before kept to be filled again.
    this.key = ref;
    this.scene = made.scene;
    this.eye = made.eye;
    this.detail = made.detail;
    if (made.ground !== this.ground) {
      [this.ground, this.prepGround] = [made.ground, this.ground];
      [this.ownParts, this.prepOwn] = [made.own, this.ownParts];
      [this.farParts, this.prepFar] = [made.far, this.farParts];
    }
    this.standing = made.standing;
    this.choosing = null;
    this.seenAt = t;
    yield* this.settled.showOver(SHOW_STEP, this.ground, this.ownParts, this.farParts);
    // (Its networks keep off what else stands in its streets: its ground as laid, its civics and walls as they stand now.)
    this.nets.build(this.scene!, this.eye, this.netsClear(), made.nets);
    performance.measure("town.built", { start: t0 });
    yield;
    this.busy = this.scene.active.length > 0 || civicsActive(plan, t) || !!plan.walls;
    this.drawnAt = -Infinity;
    this.update(t);
  }

  /**
   * A year's plan worked out ahead of its building, a step at a time (render/village.ts prepare), into the parts the last
   * building drew before it (kept to be filled again); `ahead`: while that building still stands, so its spare parts are
   * filled, not those drawn. build() takes what this leaves, or works it out whole.
   */
  *prepareSteps(
    plan: TownPlan,
    ref: string,
    t: number,
    ahead = true,
    /** The places the village holds in its streets as that plan has them (netsKeep). */
    keep: NetsClear["keep"] = this.netsKeep,
  ): Generator<void, void, void> {
    const same = this.key === ref && this.scene !== null,
      scene = townScene(plan, t, same ? this.scene!.lots : undefined);
    yield;
    // (Its lots past those drawn, and its worn ways: each read once, kept for the plan; its far blocks grown a step at a time.)
    yield* farSteps(scene);
    yield;
    wornOf(scene);
    yield;
    const ground = ahead ? this.prepGround : this.ground;
    ground.clear();
    townGround(scene, ground);
    yield;
    const eye = same ? { ...this.eye } : { x: 0, z: 0 },
      detail = yield* townDetailSteps(scene, eye);
    const own = ahead ? this.prepOwn : this.ownParts,
      far = ahead ? this.prepFar : this.farParts;
    own.clear();
    far.clear();
    yield* homesSeen(scene, detail, t, own, "own");
    yield* homesSeen(scene, detail, t, far, "far");
    const standing = new TownParts();
    townCivics(scene, t, standing, false);
    townWalls(scene, t, standing, this.open);
    yield;
    const nets = yield* townNetsSteps(scene, eye, {
      parts: [ground, own, far, standing],
      keep,
    });
    this.prepared = { plan, ref, t, scene, eye, detail, ground, own, far, standing, nets };
  }

  /** Built afresh at the next building, as a town come to (its lots, the eye at its square). */
  forget(): void {
    this.key = "";
    this.scene = null;
  }

  /** A hash (FNV) of each of its parts as drawn (ground, own, far, civics and walls) and its networks as laid (the look tools). */
  partsHash(): string {
    const hashOf = (each: (mix: (v: number) => void) => void) => {
      let h = 2166136261;
      each((v) => (h = Math.imul(h ^ Math.round(v * 1e4), 16777619) >>> 0));
      return h.toString(16);
    };
    const ofParts = (parts: TownParts) =>
      hashOf((mix) => {
        for (const [key, g] of [...parts.groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
          if (!g.data.length) continue;
          for (let i = 0; i < key.length; i++) mix(key.charCodeAt(i));
          for (const v of g.data) mix(v);
        }
      });
    return [
      ofParts(this.ground),
      ofParts(this.ownParts),
      ofParts(this.farParts),
      ofParts(this.standing),
      hashOf((mix) => {
        for (const v of this.nets.laidHash()) mix(v);
      }),
    ].join(".");
  }

  /** What its networks keep off: its ground as laid, its homes as drawn, its civics and walls, the places the village holds. */
  private netsClear(): NetsClear {
    return {
      parts: [this.ground, this.ownParts, this.farParts, this.standing],
      keep: this.netsKeep,
    };
  }

  /** Where a siege has opened its walls (null: whole): those lengths are put again only when the breach changes. */
  breach(open: { readonly mid: number; readonly wide: number } | null): void {
    const was = this.open;
    if (
      was === open ||
      (was && open && Math.abs(was.mid - open.mid) < 1e-3 && Math.abs(was.wide - open.wide) < 1e-3)
    )
      return;
    this.open = open;
    this.drawnAt = -Infinity;
  }

  /**
   * Where the eye looks (metres from its square), each frame: once it has moved half DETAIL_HYSTERESIS from where its homes were
   * last chosen by, they are chosen again and drawn over the frames that follow, a few milliseconds a frame, the old
   * standing till the new is drawn.
   */
  look(x: number, z: number): void {
    const scene = this.scene;
    if (!scene) return;
    this.eye = { x, z };
    this.nets.look(x, z);
    const was = this.detail?.focus;
    if (!this.choosing && was && Math.hypot(x - was.x, z - was.z) > DETAIL_HYSTERESIS / 2)
      this.choosing = this.choose(scene, { x, z });
    if (!this.choosing) return;
    const t0 = performance.now();
    while (performance.now() - t0 < CHOOSE_BUDGET)
      if (this.choosing.next().done) {
        this.choosing = null;
        break;
      }
  }

  private *choose(scene: TownScene, eye: { x: number; z: number }): Generator<void, void> {
    const t0 = performance.now(),
      detail = yield* townDetailSteps(scene, eye, undefined, this.detail);
    if (this.scene !== scene) return;
    const homes = this.spare;
    homes.clear();
    yield* homesSeen(scene, detail, this.seenAt, homes, "far");
    // (Its year turned meanwhile: the new year's homes are drawn by that year's choosing.)
    if (this.scene !== scene) return;
    // (Worked out over the frames that follow, put in the last of them; the old standing till then.)
    const show = this.settled.showOver(SHOW_STEP, this.ground, this.ownParts, homes);
    let t1 = performance.now();
    for (;;) {
      t1 = performance.now();
      if (show.next().done) break;
      yield;
      if (this.scene !== scene) return;
    }
    this.detail = detail;
    this.spare = this.farParts;
    this.farParts = homes;
    // (Its networks keep off the homes as now drawn: those drawn before are drawn over by the next choosing.)
    this.nets.keepOff(this.netsClear());
    // (From its choosing begun to its drawing shown, over frames; and the last step, which puts it.)
    performance.measure("town.chosen", { start: t0 });
    performance.measure("town.shown", { start: t1 });
  }

  /**
   * For a check: where each of its lots stands (metres; its own, then those past them), and which way each is drawn as last
   * chosen (townDetail's: 1 whole, 2 as seen from afar, 3 in its row, 4 not drawn, thinned out; 0 drawn as ever).
   */
  lotsDrawn(): { x: Float32Array; z: Float32Array; drawn: Uint8Array; own: number } | null {
    const scene = this.scene;
    if (!scene || !this.detail) return null;
    const far = farOf(scene),
      n = scene.plan.lots + (far?.count ?? 0),
      x = new Float32Array(n),
      z = new Float32Array(n);
    x.set(scene.lots.x.subarray(0, scene.plan.lots));
    z.set(scene.lots.z.subarray(0, scene.plan.lots));
    if (far) {
      x.set(far.x, far.from);
      z.set(far.z, far.from);
    }
    return { x, z, drawn: this.detail.drawn, own: scene.plan.lots };
  }

  /** For a check: its homes chosen from a spot (metres) and drawn at once, as the eye there would have them. */
  chooseNow(x: number, z: number): void {
    const scene = this.scene;
    if (!scene) return;
    this.choosing = null;
    const run = this.choose(scene, { x, z });
    while (!run.next().done);
  }

  /** What it draws (for a check): its parts and batches, all year and rising, and how many of its homes stand whole, and where they were chosen from (metres). */
  counts(): {
    parts: number;
    batches: number;
    whole: number;
    focus: { x: number; z: number } | null;
    choosing: boolean;
  } {
    let whole = 0;
    for (const v of this.detail?.drawn ?? []) if (v === 1) whole++;
    return {
      parts: this.settled.parts + this.rising.parts,
      batches: this.settled.drawn + this.rising.drawn,
      whole,
      focus: this.detail?.focus ?? null,
      choosing: !!this.choosing,
    };
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
    townWalls(scene, t, this.parts, this.open);
    townAsh(scene, t, this.parts);
    this.rising.show(this.parts);
  }

  /** What its land's signals put in it as drawn (signals; null: no town). */
  signalsDrawn(): { poles: number; wires: number; mast: boolean } | null {
    return this.scene ? (this.scene.signals ?? { poles: 0, wires: 0, mast: false }) : null;
  }

  /** How far out the greatest fire's ash lies at moment t (metres; 0: none). */
  ashGone(t: number): number {
    return this.scene ? ashGone(this.scene, t) : 0;
  }

  /** What of it is alight, smoking and in dust at moment t, and how the ground shakes (Phase 42 M201). */
  blaze(t: number): BlazeNow {
    return blazeNow(this.visible ? this.scene : null, t);
  }

  /** What of a raid is over it at moment t (W2). */
  raid(t: number): RaidNow {
    return raidNow(this.visible ? this.scene : null, t);
  }

  /** Where its buildings smoke at moment t (Phase 41 M199): their chimneys' tops (metres). */
  chimneys(t: number): { x: number; y: number; z: number }[] {
    return this.scene && !this.scene.plan.sealed ? civicChimneys(this.scene, t) : [];
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

  /** Where what the town was asked to raise stands (H1): a building, or the length its walls have come to. */
  askedSpot(
    ref: string,
    t: number,
  ): { x: number; z: number; size: number; flag?: { x: number; z: number } } | null {
    const s = this.scene;
    if (!s) return null;
    for (const c of s.plan.civics)
      if (c.asked?.ref === ref && c.at + c.lots <= s.lots.x.length) {
        const f = footprint(s.lots, c.at, c.lots);
        return { x: f.x, z: f.z, size: Math.max(f.w, f.d), flag: siteFlagAt(f) };
      }
    // (A building by its page's ref: `bldg:<town>:<its lot>:<the year it was begun>`.)
    const m = /^bldg:.*:(\d+):(-?\d+)$/.exec(ref);
    if (m)
      for (const c of s.plan.civics)
        if (c.at === Number(m[1]) && c.start === Number(m[2]) && c.at + c.lots <= s.lots.x.length) {
          const f = footprint(s.lots, c.at, c.lots);
          return { x: f.x, z: f.z, size: Math.max(f.w, f.d) };
        }
    const w = s.plan.walls?.asked;
    if (w?.ref === ref && s.walls?.lengths.length) {
      const l =
        s.walls.lengths[Math.floor(Math.min(0.999, askedGrown(w, t)) * s.walls.lengths.length)]!;
      return { x: l.x, z: l.z, size: 24 };
    }
    return null;
  }

  /** What of the town stands at a point (metres from its middle) at moment t, for a tap. */
  thingAt(x: number, z: number, t: number): TownThing | null {
    return this.scene && this.visible ? townThingAt(this.scene, x, z, t) : null;
  }

  /** The building of it a point lies within (view/town.ts townBuildingAt; null: none, or no town drawn). */
  buildingAt(x: number, z: number, t: number): ReturnType<typeof townBuildingAt> {
    return this.scene && this.visible ? townBuildingAt(this.scene, x, z, t) : null;
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

  /** The homes standing at moment t nearest a way through the town, for a film's burning (none: no fabric). */
  homesAlong(
    t: number,
    way: readonly { readonly x: number; readonly z: number }[],
    most: number,
  ): Burnable[] {
    return this.scene ? homesAlong(this.scene, t, way, most) : [];
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

  /** A home's box as it stands at moment t (metres), for what is laid over it; null: no such lot. */
  homeBox(p: number, t: number): ReturnType<typeof homeBox> {
    return this.scene ? homeBox(this.scene, p, t) : null;
  }

  /**
   * What it has laid on its ground (metres from its square), into `laid` (view/shore.ts: its water keeps off it): each of its
   * blocks, drawn or not (its lots past those drawn stand on them), its ground's parts (yards, streets, its square, its sprawl's
   * ground and roofs, its ways), its strongholds' ground and its walls' line.
   */
  laidOn(laid: Laid): void {
    if (this.scene)
      layTown(laid, this.scene, this.ground, [this.ownParts, this.farParts, this.parts]);
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
