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
  DETAIL_HYSTERESIS,
  type TownDetail,
  townBuildingAt,
  townThingAt,
  townWalls,
  strikeSpan,
  strikeTurned,
  partBatch,
  type BlazeNow,
  type CivicMotion,
  type PartMesh,
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
import type { Rgb, Stage } from "./stage.ts";

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

type Group = { mesh: PartMesh; color: Rgb; data: number[]; lamp?: boolean };

/** Batches of parts by mesh, each part in its own colour, kept and refilled (made anew only when one outgrows itself). */
class PartBatches {
  private readonly batches = new Map<string, InstancedBatch>();
  private readonly stage: Stage;
  private readonly root: pc.Entity;
  private readonly meshes: Readonly<Record<PartMesh, pc.Mesh>>;
  /** The windows' glass, lit at night (its batch made anew when it changes). */
  lamps: pc.Material | null = null;
  private lampsIn: pc.Material | null = null;
  private snow = 0;
  constructor(stage: Stage, root: pc.Entity, meshes: Readonly<Record<PartMesh, pc.Mesh>>) {
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
    const sets = new Map<string, { mesh: PartMesh; lamp: boolean; n: number; groups: Group[] }>();
    for (const parts of all)
      for (const [key, g] of parts.groups) {
        const n = g.data.length / 7;
        if (n === 0) continue;
        const k = partBatch(key, g);
        let set = sets.get(k);
        if (!set) sets.set(k, (set = { mesh: g.mesh, lamp: !!g.lamp, n: 0, groups: [] }));
        set.n += n;
        set.groups.push(g);
      }
    const t = [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1];
    let since = 0;
    for (const [key, set] of sets) {
      let m = this.staged.get(key);
      if (!m || m.length < set.n * 16) {
        m = new Float32Array(Math.ceil(set.n * 1.3) * 16);
        this.staged.set(key, m);
      }
      const toned = !set.lamp;
      let i = 0;
      // (Group by group, in the order they were gathered.)
      for (const g of set.groups) {
        const d = g.data;
        t[8] = g.color[0];
        t[9] = g.color[1];
        t[10] = g.color[2];
        for (let o = 0; o < d.length; o += 7, i++) {
          t[0] = d[o]! * M;
          t[1] = d[o + 1]! * M;
          t[2] = d[o + 2]! * M;
          t[3] = d[o + 3]! * M;
          t[4] = d[o + 4]! * M;
          t[5] = d[o + 5]! * M;
          t[6] = d[o + 6]!;
          placeInstance(m, i * 16, t, toned);
          if (++since >= step) {
            since = 0;
            yield;
          }
        }
      }
    }
    for (const [key, set] of sets) {
      let b = this.batches.get(key);
      if (!b || b.capacity < set.n || (set.lamp && this.lampsIn !== this.lamps)) {
        b?.destroy();
        b = new InstancedBatch(
          this.stage,
          this.meshes[set.mesh],
          [set.groups[0]!.color[0], set.groups[0]!.color[1], set.groups[0]!.color[2]],
          Math.max(16, Math.ceil(set.n * 1.3)),
          this.root,
          set.lamp ? (this.lamps ?? undefined) : undefined,
          !set.lamp,
        );
        if (set.lamp) this.lampsIn = this.lamps;
        this.batches.set(key, b);
        if (this.snow > 0 && key.endsWith("|roof")) b.toneSnow(this.snow * 0.8);
      }
      const m = this.staged.get(key)!;
      b.setMatrices(set.n, (out) => out.set(m.subarray(0, set.n * 16)));
    }
    for (const [key, b] of this.batches) if (!sets.has(key)) b.set(0, () => {});
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
    for (const [key, b] of this.batches) if (key.endsWith("|roof")) b.toneSnow(snow * 0.8);
  }

  destroy(): void {
    for (const b of this.batches.values()) b.destroy();
    this.batches.clear();
  }
}

export class TownLayer {
  readonly root = new pc.Entity("town");
  private readonly settled: PartBatches;
  private readonly rising: PartBatches;
  private readonly parts = new TownParts();
  /** Its ground as drawn this year, and its homes standing done as drawn from where the eye last chose (townDetail). */
  private readonly ground = new TownParts();
  private homesSeenParts = new TownParts();
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

  constructor(stage: Stage, parent: pc.Entity) {
    parent.addChild(this.root);
    const meshes: Record<PartMesh, pc.Mesh> = {
      dome: keptMesh(domeMesh(stage)),
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
    const t0 = performance.now(),
      same = this.key === ref && this.scene !== null;
    this.key = ref;
    this.scene = townScene(plan, t, same ? this.scene!.lots : undefined);
    // What stands all year: the ground, the homes done, the ruins; those nearest the eye whole, the rest as seen from
    // afar, the city's lots past those drawn on their own blocks (view/town.ts townDetail).
    this.ground.clear();
    townGround(this.scene, this.ground);
    if (!same) this.eye = { x: 0, z: 0 };
    this.detail = townDetail(this.scene, this.eye);
    this.homesSeenParts = new TownParts();
    const run = homesSeen(this.scene, this.detail, t, this.homesSeenParts);
    while (!run.next().done);
    this.choosing = null;
    this.seenAt = t;
    this.settled.show(this.ground, this.homesSeenParts);
    performance.measure("town.built", { start: t0 });
    this.busy = this.scene.active.length > 0 || civicsActive(plan, t) || !!plan.walls;
    this.drawnAt = -Infinity;
    this.update(t);
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
      detail = yield* townDetailSteps(scene, eye);
    if (this.scene !== scene) return;
    const homes = new TownParts();
    yield* homesSeen(scene, detail, this.seenAt, homes);
    // (Its year turned meanwhile: the new year's homes are drawn by that year's choosing.)
    if (this.scene !== scene) return;
    // (Worked out over the frames that follow, put in the last of them; the old standing till then.)
    const show = this.settled.showOver(SHOW_STEP, this.ground, homes);
    let t1 = performance.now();
    for (;;) {
      t1 = performance.now();
      if (show.next().done) break;
      yield;
      if (this.scene !== scene) return;
    }
    this.detail = detail;
    this.homesSeenParts = homes;
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
