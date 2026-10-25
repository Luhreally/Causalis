// The countryside about a town, drawn (Phase 32 M170–M172): its fields' bounds and the crop's
// rows, its orchards in blossom and in fruit, barns, silos, hay and scarecrows, its windmills or
// wind turbines, its tractors and its pasture's fence. Placed once from the view's pure
// countryside (view/country.ts); what the year shows — hay in the stubble, scarecrows over the
// corn, blossom, fruit, the hedges turning — set as the season turns; what moves, the sails and
// the tractors, posed each frame by the screen's clock. The crop stands in its rows as the year
// in the fields has it (Phase 44 M206, view/fields.ts): growing, gold, cut to stubble row by row
// at the reaping with stooks behind the reapers, short and pale in a dry year, withered where a
// blight has taken, and the blighted crop burning at the fields' corners where it is pulled.
import * as pc from "playcanvas";
import type { VillagePlan } from "../bridge/index.ts";
import {
  BLIGHTED,
  blightFires,
  blossomOf,
  boatAt,
  countryOf,
  reapingsOf,
  rowNow,
  stooksOf,
  stubbleTint,
  type FieldsNow,
  fruitHangs,
  hayStands,
  sailTurn,
  scarecrowsStand,
  seasonGround,
  seasonKey,
  seasonLeaf,
  tractorAt,
  type Boat,
  type Country,
  type CountryPiece,
  type Crop,
  type GroundSeason,
  type HouseLook,
  type Manner,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, cylinderMesh, gableMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

const M = 0.1; // units per metre, as the village's

/** The bounds' colours, by the land's manner. */
const BOUND_COLOR: Readonly<Record<Manner, Rgb>> = {
  hedge: [0.2, 0.42, 0.16],
  wall: [0.66, 0.65, 0.6],
  bank: [0.5, 0.4, 0.26],
  ridge: [0.56, 0.44, 0.34],
  fence: [0.52, 0.37, 0.22],
  hurdle: [0.58, 0.44, 0.26],
};
const WOOD: Rgb = [0.46, 0.33, 0.2],
  CROWN: Rgb = [0.28, 0.54, 0.2],
  BLOSSOM: Rgb = [0.98, 0.9, 0.92],
  FRUIT: Rgb = [0.88, 0.22, 0.12],
  HAY: Rgb = [0.88, 0.74, 0.38],
  STOOK: Rgb = [0.84, 0.7, 0.36],
  FLAME: Rgb = [1, 0.46, 0.1],
  SMOKE: Rgb = [0.32, 0.3, 0.28],
  WHITE: Rgb = [0.93, 0.94, 0.95],
  TRACTOR_PAINT: readonly Rgb[] = [
    [0.78, 0.16, 0.12],
    [0.22, 0.5, 0.2],
    [0.2, 0.32, 0.7],
  ];

/** A boat's parts by its kind: its hull, and what stands on it (a mast and sail, a cabin and funnel). */
const BOAT_PARTS: Readonly<
  Record<
    Boat,
    readonly {
      readonly mesh: "box" | "cyl";
      readonly color: Rgb;
      /** Where on the boat (ahead, up, aside; metres) and its size. */
      readonly at: readonly [number, number, number, number, number, number];
    }[]
  >
> = {
  row: [{ mesh: "box", color: [0.5, 0.34, 0.2], at: [0, 0.35, 0, 4.6, 0.6, 1.4] }],
  sail: [
    { mesh: "box", color: [0.55, 0.38, 0.22], at: [0, 0.45, 0, 7, 0.9, 2.2] },
    { mesh: "cyl", color: [0.42, 0.3, 0.18], at: [0.6, 3.8, 0, 0.2, 6.4, 0.2] },
    { mesh: "box", color: [0.95, 0.92, 0.84], at: [-0.7, 3.6, 0, 3.2, 4.6, 0.08] },
  ],
  steam: [
    { mesh: "box", color: [0.2, 0.22, 0.26], at: [0, 0.55, 0, 9, 1.1, 2.6] },
    { mesh: "box", color: [0.86, 0.83, 0.76], at: [-0.8, 1.9, 0, 3.4, 1.6, 2] },
    { mesh: "cyl", color: [0.62, 0.16, 0.1], at: [0.4, 3.3, 0, 0.7, 2.6, 0.7] },
  ],
  motor: [
    { mesh: "box", color: [0.94, 0.95, 0.96], at: [0, 0.45, 0, 7, 0.9, 2.4] },
    { mesh: "box", color: [0.26, 0.42, 0.62], at: [0.6, 1.4, 0, 2.4, 1.1, 1.8] },
  ],
};

/** The flames and the smoke puffs over a fire of the blighted crop; the most fires drawn. */
const FLAMES = 3,
  PUFFS = 4,
  MOST_FIRES = 8;

/** A material glowing of itself, unlit (a flame). */
function glowing(c: Rgb): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.useLighting = false;
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(c[0], c[1], c[2]);
  m.update();
  return m;
}

/** Blends two colours. */
function mix(a: Rgb, b: Rgb, k: number): Rgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** A piece's eight numbers into a batch's slot (metres to units). */
function put(out: number[], p: CountryPiece, pitch = 0): void {
  out[0] = p.x * M;
  out[1] = p.y * M;
  out[2] = p.z * M;
  out[3] = p.sx * M;
  out[4] = p.sy * M;
  out[5] = p.sz * M;
  out[6] = p.yaw;
  out[7] = pitch;
}

/** A piece at a spot's place, by the spot's own ways (lx ahead, lz aside; metres). */
function at(
  spot: { readonly x: number; readonly z: number; readonly yaw: number },
  lx: number,
  y: number,
  lz: number,
  sx: number,
  sy: number,
  sz: number,
  yaw = spot.yaw,
): CountryPiece {
  const c = Math.cos(spot.yaw),
    s = Math.sin(spot.yaw);
  return { x: spot.x + c * lx + s * lz, y, z: spot.z - s * lx + c * lz, sx, sy, sz, yaw };
}

/** Pieces shown only in their season: their batch, and whether they show now. */
type Seasonal = {
  /** What it is, for the look tools ("": a part counted with another). */
  readonly name: "fruit" | "hay" | "scarecrows" | "";
  readonly batch: InstancedBatch;
  readonly pieces: readonly CountryPiece[];
  readonly pitch: number;
  readonly when: (t: number) => boolean;
  shown: boolean | null;
};

export class CountryLayer {
  private readonly stage: Stage;
  readonly root = new pc.Entity("country");
  private batches: InstancedBatch[] = [];
  private readonly box: pc.Mesh;
  private readonly gable: pc.Mesh;
  private readonly cone: pc.Mesh;
  private readonly cyl: pc.Mesh;
  private readonly ball: pc.Mesh;
  private plan: VillagePlan | null = null;
  private country: Country | null = null;
  private motion = true;
  /** What the season dresses: the hedges, walls and banks; the orchards' grass; the crowns. */
  private dressed: { kind: "leaf" | "snow" | "ground"; base: Rgb; batch: InstancedBatch }[] = [];
  private crowns: InstancedBatch | null = null;
  /**
   * The crop in its rows (Phase 44 M206): a batch for each crop's standing rows, one for the rows a
   * blight has taken, one for the stubble, one for the stooks; the fires the blighted crop burns
   * on; how each was last laid out and coloured.
   */
  private cropRows: {
    readonly grain: InstancedBatch;
    readonly greens: InstancedBatch;
    readonly withered: InstancedBatch;
    readonly stubble: InstancedBatch;
    readonly stooks: InstancedBatch;
    readonly flames: InstancedBatch;
    readonly smoke: InstancedBatch;
  } | null = null;
  private cropAs = "";
  private tinted = { grain: "", greens: "", stubble: "" };
  /** The blighted crop's fires now (where), and what was last laid out (the look tools). */
  private fires: { x: number; z: number }[] = [];
  private laid = { standing: 0, withered: 0, stubble: 0, stooks: 0, high: 0 };
  /** What shows only in its season, with what it holds then: set again only as that changes. */
  private seasonal: Seasonal[] = [];
  private sails: { batch: InstancedBatch; blades: number } | null = null;
  private tractors: { body: InstancedBatch; cab: InstancedBatch; wheels: InstancedBatch } | null =
    null;
  /** The boats: a batch for each of their parts. */
  private boats: InstancedBatch[] = [];
  private afloat = 0;
  private seasonNow: GroundSeason | null = null;
  private dressedAs = "";

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    this.gable = keptMesh(gableMesh(stage));
    this.cone = keptMesh(coneMesh(stage, 0.5, 1, 7));
    this.cyl = keptMesh(cylinderMesh(stage, 0.5, 1, 10));
    this.ball = keptMesh(
      pc.Mesh.fromGeometry(
        stage.device,
        new pc.SphereGeometry({ radius: 0.5, latitudeBands: 4, longitudeBands: 7 }),
      ),
    );
    parent.addChild(this.root);
  }

  private batch(mesh: pc.Mesh, color: Rgb, count: number): InstancedBatch {
    const b = new InstancedBatch(this.stage, mesh, color, Math.max(1, count), this.root);
    this.batches.push(b);
    return b;
  }

  /** Pieces placed once in a batch of their own (none: no batch). */
  private placed(mesh: pc.Mesh, color: Rgb, pieces: readonly CountryPiece[], pitch = 0) {
    if (!pieces.length) return null;
    const b = this.batch(mesh, color, pieces.length);
    b.set(pieces.length, (i, out) => put(out, pieces[i]!, pitch));
    return b;
  }

  /** Pieces shown only while `when` holds at the moment drawn. */
  private inSeason(
    name: Seasonal["name"],
    mesh: pc.Mesh,
    color: Rgb,
    pieces: CountryPiece[],
    when: (t: number) => boolean,
    pitch = 0,
  ): void {
    if (!pieces.length) return;
    this.seasonal.push({
      name,
      batch: this.batch(mesh, color, pieces.length),
      pieces,
      pitch,
      when,
      shown: null,
    });
  }

  /** Lay out a town's countryside from its plan and how its homes are built. */
  build(
    plan: VillagePlan,
    look: HouseLook,
    q: { readonly detail: number; readonly motion: boolean },
  ): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
    this.dressed = [];
    this.seasonal = [];
    this.crowns = null;
    this.cropRows = null;
    this.cropAs = "";
    this.tinted = { grain: "", greens: "", stubble: "" };
    this.fires = [];
    this.sails = null;
    this.tractors = null;
    this.boats = [];
    this.plan = plan;
    this.motion = q.motion;
    const c = countryOf(plan, q.detail);
    this.country = c;
    const engines = plan.era === "industry" || plan.era === "modern";
    // The fields' bounds and posts; the crop's rows.
    if (c.manner) {
      const bounds = this.placed(this.box, BOUND_COLOR[c.manner], c.bounds);
      if (bounds)
        this.dressed.push({
          kind: c.manner === "hedge" ? "leaf" : c.manner === "wall" ? "snow" : "ground",
          base: BOUND_COLOR[c.manner],
          batch: bounds,
        });
    }
    this.placed(this.box, WOOD, c.posts);
    // The crop's rows, laid out as the year stands them (in update): each row's standing crop and
    // its stubble where it is being cut; the stooks as many as a rich year's along every row of
    // the fields reaped.
    if (c.rows.length) {
      const reaped = reapingsOf(plan),
        stooks = c.rows.reduce((n, r) => n + (reaped[r.field] ? Math.ceil(r.sx / 5) + 1 : 0), 0),
        flames = new InstancedBatch(
          this.stage,
          this.cone,
          FLAME,
          MOST_FIRES * FLAMES,
          this.root,
          glowing(FLAME),
        );
      this.batches.push(flames);
      this.cropRows = {
        grain: this.batch(this.box, [0.34, 0.58, 0.24], c.rows.length),
        greens: this.batch(this.box, [0.2, 0.44, 0.24], c.rows.length),
        withered: this.batch(this.box, BLIGHTED, c.rows.length),
        stubble: this.batch(this.box, [0.74, 0.65, 0.42], c.rows.length),
        stooks: this.batch(this.cone, STOOK, Math.max(1, stooks)),
        flames,
        smoke: this.batch(this.ball, SMOKE, MOST_FIRES * PUFFS),
      };
    }
    // The orchards: their grass, their trees in rows, their fruit in its season.
    const grassBase: Rgb = [0.36, 0.56, 0.24],
      grass = this.placed(
        this.box,
        grassBase,
        plan.fields
          .filter((_, k) => c.orchard[k])
          .map((f) => ({ x: f.x, y: 0.02, z: f.z, sx: f.w, sy: 0.04, sz: f.d, yaw: f.yaw })),
      );
    if (grass) this.dressed.push({ kind: "ground", base: grassBase, batch: grass });
    this.placed(
      this.cyl,
      [0.42, 0.29, 0.17],
      c.trees.map((t) => ({
        x: t.x,
        y: 0.9 * t.size,
        z: t.z,
        sx: 0.36,
        sy: 1.8 * t.size,
        sz: 0.36,
        yaw: 0,
      })),
    );
    this.crowns = this.placed(
      this.ball,
      CROWN,
      c.trees.map((t) => ({
        x: t.x,
        y: (1.8 + 1.5) * t.size,
        z: t.z,
        sx: 4.2 * t.size,
        sy: 3.4 * t.size,
        sz: 4.2 * t.size,
        yaw: t.x + t.z,
      })),
    );
    if (q.detail)
      this.inSeason(
        "fruit",
        this.ball,
        FRUIT,
        c.trees.flatMap((t) =>
          [0, 2.1, 4.2].map((a) => ({
            x: t.x + Math.cos(a + t.x) * 1.9 * t.size,
            y: (3 + Math.sin(a * 3) * 0.6) * t.size,
            z: t.z + Math.sin(a + t.x) * 1.9 * t.size,
            sx: 0.5,
            sy: 0.5,
            sz: 0.5,
            yaw: 0,
          })),
        ),
        fruitHangs,
      );
    // Barns by the far fields, their doors toward the town; silos beside them.
    const barnWall: Rgb = engines ? [0.62, 0.2, 0.15] : [0.56, 0.4, 0.25],
      barnRoof: Rgb = engines ? [0.5, 0.52, 0.55] : [...look.roof];
    this.placed(
      this.box,
      barnWall,
      c.barns.map((b) => at(b, 0, b.h / 2, 0, b.w, b.h, b.d)),
    );
    this.placed(
      this.gable,
      barnRoof,
      c.barns.map((b) => at(b, 0, b.h + 1.3, 0, b.w * 1.08, 2.6, b.d * 1.12)),
    );
    if (q.detail)
      this.placed(
        this.box,
        [0.24, 0.16, 0.1],
        c.barns.map((b) => at(b, 0, 1.6, b.d / 2 + 0.08, 3.2, 3.2, 0.16)),
      );
    for (const blue of [false, true]) {
      const silos = c.silos.filter((s) => s.blue === blue);
      this.placed(
        this.cyl,
        blue ? [0.18, 0.28, 0.48] : [0.76, 0.78, 0.8],
        silos.map((s) => at(s, 0, s.h / 2, 0, s.r * 2, s.h, s.r * 2)),
      );
    }
    this.placed(
      this.cone,
      [0.6, 0.62, 0.66],
      c.silos.map((s) => at(s, 0, s.h + 1.1, 0, s.r * 2.2, 2.2, s.r * 2.2)),
    );
    // Hay after the reaping: stacks, or round bales lying in the stubble.
    this.inSeason(
      "hay",
      c.bales ? this.cyl : this.cone,
      HAY,
      c.hay.map((h) =>
        c.bales ? at(h, 0, 0.8, 0, 1.7, 1.3, 1.7) : at(h, 0, 1.7, 0, 3.6, 3.4, 3.6),
      ),
      hayStands,
      c.bales ? Math.PI / 2 : 0,
    );
    // Scarecrows over the corn: a post and a crossbar, a coat, a head, a hat.
    this.inSeason(
      "",
      this.box,
      [0.42, 0.3, 0.18],
      c.scarecrows.flatMap((s) => [
        at(s, 0, 1.2, 0, 0.18, 2.4, 0.18),
        at(s, 0, 1.85, 0, 0.14, 0.14, 1.9),
      ]),
      scarecrowsStand,
    );
    this.inSeason(
      "",
      this.box,
      [0.58, 0.24, 0.16],
      c.scarecrows.map((s) => at(s, 0, 1.55, 0, 0.36, 0.9, 0.7)),
      scarecrowsStand,
    );
    this.inSeason(
      "scarecrows",
      this.ball,
      [0.92, 0.8, 0.5],
      c.scarecrows.map((s) => at(s, 0, 2.45, 0, 0.5, 0.5, 0.5)),
      scarecrowsStand,
    );
    if (q.detail)
      this.inSeason(
        "",
        this.cone,
        [0.3, 0.24, 0.18],
        c.scarecrows.map((s) => at(s, 0, 2.85, 0, 0.8, 0.45, 0.8)),
        scarecrowsStand,
      );
    // Windmills: a white tower, its cap, its sails; turbines: a tall white mast, its housing.
    const mills = c.mills.filter((m) => m.kind === "mill"),
      turbines = c.mills.filter((m) => m.kind === "turbine");
    this.placed(
      this.cyl,
      [0.92, 0.9, 0.84],
      mills.map((m) => at(m, 0, 5.5, 0, 6.4, 11, 6.4)),
    );
    this.placed(
      this.cone,
      [0.46, 0.3, 0.2],
      mills.map((m) => at(m, 0, 12.6, 0, 7.4, 3.2, 7.4)),
    );
    this.placed(
      this.cyl,
      WHITE,
      turbines.map((m) => at(m, 0, 22, 0, 2.2, 44, 2.2)),
    );
    this.placed(
      this.box,
      WHITE,
      turbines.map((m) => at(m, 0.8, 45, 0, 5.4, 2.4, 2.4)),
    );
    const blades = mills.length * 4 + turbines.length * 3;
    if (blades) this.sails = { batch: this.batch(this.box, [0.95, 0.93, 0.88], blades), blades };
    // Tractors, each a body in its paint, a cab, and four wheels.
    if (c.tractors.length) {
      const paint = TRACTOR_PAINT[c.tractors[0]!.paint]!;
      this.tractors = {
        body: this.batch(this.box, paint, c.tractors.length),
        cab: this.batch(this.box, [0.22, 0.27, 0.32], c.tractors.length),
        wheels: this.batch(this.cyl, [0.1, 0.1, 0.1], c.tractors.length * 4),
      };
    }
    // The jetty and the boats.
    if (c.water) {
      this.placed(this.box, [0.5, 0.38, 0.24], c.water.pier);
      this.boats = BOAT_PARTS[c.water.boat].map((part) =>
        this.batch(part.mesh === "cyl" ? this.cyl : this.box, part.color, c.water!.boats.length),
      );
    }
    // The pasture's fence, its trough with water in it, and its rack of hay.
    this.placed(this.box, WOOD, [...c.pen.rails, ...c.pen.posts]);
    if (c.pen.trough) {
      const tr = c.pen.trough;
      this.placed(this.box, [0.42, 0.31, 0.19], [at(tr, 0, 0.3, 0, 0.9, 0.6, 3.2)]);
      this.placed(this.box, [0.3, 0.5, 0.72], [at(tr, 0, 0.62, 0, 0.6, 0.04, 2.8)]);
    }
    if (c.pen.rack) {
      const r = c.pen.rack;
      this.placed(this.box, WOOD, [at(r, 0, 0.8, 0, 1.2, 1.6, 2.4)]);
      this.placed(this.box, HAY, [at(r, 0, 1.75, 0, 1.1, 0.5, 2.2)]);
    }
    this.dressedAs = "";
    this.dress();
  }

  /** The season on the ground (null: none told): the hedges turned or bare, snow on the walls. */
  season(s: GroundSeason | null): void {
    this.seasonNow = s;
    this.dress();
  }

  private dress(): void {
    const s = this.seasonNow,
      key = s ? seasonKey(s) : "";
    if (key === this.dressedAs) return;
    this.dressedAs = key;
    for (const d of this.dressed)
      d.batch.recolor(
        !s
          ? d.base
          : d.kind === "leaf"
            ? seasonLeaf(d.base, s)
            : d.kind === "snow"
              ? seasonGround(d.base, { ...s, snow: s.snow * 0.8 })
              : seasonGround(d.base, s),
      );
    this.crownsAs = "";
  }

  private crownsAs = "";

  /** What each of the plan's fields grows (null: an orchard, drawn here). */
  get crop(): readonly (Crop | null)[] {
    return this.country?.crop ?? [];
  }

  /** Whether the fields are sown in rows (else their crop is the colour of the field itself). */
  get sown(): boolean {
    return !!this.cropRows;
  }

  /**
   * The countryside at moment t: the crop standing in its rows as `year` has it (`field`, a
   * crop's colour now), what shows in its season, the crowns in blossom or turned; the sails,
   * the tractors and the blighted crop's fires by the screen's `clock`.
   */
  update(t: number, clock: number, field: (crop: Crop) => Rgb, year: FieldsNow): void {
    const plan = this.plan,
      c = this.country;
    if (!plan || !c) return;
    if (this.cropRows) {
      // (Laid out again each few minutes of the world's clock, and as the year moves the crop.)
      const key = `${Math.floor(t / 300)}|${year.growth.toFixed(2)}|${year.blight.toFixed(2)}`;
      if (key !== this.cropAs) {
        this.cropAs = key;
        this.lay(t, year);
      }
      const tint = (name: "grain" | "greens" | "stubble", color: Rgb) => {
        const k = color.map((x) => x.toFixed(3)).join();
        if (k === this.tinted[name]) return;
        this.tinted[name] = k;
        this.cropRows![name].recolor(color);
      };
      tint("grain", field("grain"));
      tint("greens", field("greens"));
      tint("stubble", stubbleTint(year));
      this.burn(clock);
    }
    for (const s of this.seasonal) {
      const shown = s.when(t);
      if (shown === s.shown) continue;
      s.shown = shown;
      s.batch.set(shown ? s.pieces.length : 0, (i, out) => put(out, s.pieces[i]!, s.pitch));
    }
    if (this.crowns) {
      const bloom = Math.round(blossomOf(t) * 10) / 10,
        key = `${this.dressedAs}|${bloom}`;
      if (key !== this.crownsAs) {
        this.crownsAs = key;
        const leaf = this.seasonNow ? seasonLeaf(CROWN, this.seasonNow) : CROWN;
        this.crowns.recolor(mix(leaf, BLOSSOM, bloom * 0.85));
        this.bloom = bloom;
      }
    }
    // The sails turning (held still where small motions are not drawn).
    const turning = this.motion ? clock : 0;
    if (this.sails) {
      const list: { piece: CountryPiece; pitch: number }[] = [];
      c.mills.forEach((m, k) => {
        const turbine = m.kind === "turbine",
          high = turbine ? 45 : 11.2,
          off = turbine ? 3.8 : 4,
          length = turbine ? 20 : 10,
          hub = { x: m.x + Math.cos(m.yaw) * off, z: m.z - Math.sin(m.yaw) * off },
          spin = sailTurn(k, turning, m.kind),
          n = turbine ? 3 : 4;
        if (k === 0) this.spin = spin;
        for (let b = 0; b < n; b++) {
          const p = spin + (b * 2 * Math.PI) / n,
            r = length / 2 + 0.4;
          list.push({
            piece: {
              x: hub.x + Math.sin(m.yaw) * Math.sin(p) * r,
              y: high + Math.cos(p) * r,
              z: hub.z + Math.cos(m.yaw) * Math.sin(p) * r,
              sx: 0.3,
              sy: length,
              sz: turbine ? 1.3 : 2,
              yaw: m.yaw,
            },
            pitch: p,
          });
        }
      });
      this.sails.batch.set(list.length, (i, out) => put(out, list[i]!.piece, list[i]!.pitch));
    }
    if (this.tractors) {
      const spots = c.tractors.map((_, k) => tractorAt(plan, c, k, t, clock)),
        tr = this.tractors;
      this.working = spots.filter((s) => s.working).length;
      tr.body.set(spots.length, (i, out) => put(out, at(spots[i]!, 0.3, 1.3, 0, 3.4, 1.3, 1.9)));
      tr.cab.set(spots.length, (i, out) => put(out, at(spots[i]!, -0.7, 2.65, 0, 1.5, 1.5, 1.6)));
      tr.wheels.set(spots.length * 4, (i, out) => {
        const s = spots[i >> 2]!,
          k = i & 3,
          rear = k < 2,
          side = k % 2 ? 1 : -1,
          d = rear ? 1.7 : 1.1;
        put(
          out,
          at(s, rear ? -0.9 : 1.25, d / 2, side * (rear ? 1.05 : 0.95), d, 0.55, d),
          Math.PI / 2,
        );
      });
    }
    // The boats out on the water by day, tied up by night and on ice.
    if (c.water && this.boats.length) {
      const frozen = (this.seasonNow?.ice ?? 0) > 0.5,
        spots = c.water.boats.map((_, k) => boatAt(c, k, t, clock, frozen)),
        parts = BOAT_PARTS[c.water.boat];
      this.afloat = spots.filter((s) => s.out).length;
      parts.forEach((part, pi) => {
        const [ax, ay, az, sx, sy, sz] = part.at;
        this.boats[pi]!.set(spots.length, (i, out) =>
          put(out, at(spots[i]!, ax, ay, az, sx, sy, sz)),
        );
      });
    }
  }

  /** The orchards' blossom as last drawn, the first mill's sails' turn, the tractors at work, the boats out. */
  private bloom = 0;
  private spin = 0;
  private working = 0;

  /**
   * The crop laid out at t as `year` stands it: each row's standing part (withered where a blight
   * has taken it) and its stubble, as far as its reaping has come; the stooks behind the reapers;
   * where the blighted crop burns.
   */
  private lay(t: number, year: FieldsNow): void {
    const plan = this.plan!,
      c = this.country!,
      crop = this.cropRows!,
      parts: Record<"grain" | "greens" | "withered" | "stubble", CountryPiece[]> = {
        grain: [],
        greens: [],
        withered: [],
        stubble: [],
      };
    let high = 0;
    for (const r of c.rows) {
      const now = rowNow(plan, r.field, r.row, t, year),
        // (A part of the row from share a to b along it, from the field's one side.)
        part = (a: number, b: number, h: number, into: CountryPiece[]) => {
          if (b - a < 1e-3 || h < 0.02) return;
          const mid = ((a + b) / 2 - 0.5) * r.sx;
          into.push({
            x: r.x + Math.cos(r.yaw) * mid,
            y: h / 2,
            z: r.z - Math.sin(r.yaw) * mid,
            sx: (b - a) * r.sx,
            sy: h,
            sz: r.sz,
            yaw: r.yaw,
          });
        };
      if (now.high > 0) {
        part(
          now.from,
          now.to,
          now.high,
          now.blighted ? parts.withered : parts[r.crop === "greens" ? "greens" : "grain"],
        );
        high = Math.max(high, now.high);
      }
      if (now.stubble > 0) {
        part(0, now.from, now.stubble, parts.stubble);
        part(now.to, 1, now.stubble, parts.stubble);
      }
    }
    for (const name of ["grain", "greens", "withered", "stubble"] as const)
      crop[name].set(parts[name].length, (i, out) => put(out, parts[name][i]!));
    const stooks: CountryPiece[] = [];
    plan.fields.forEach((_, k) => {
      for (const s of stooksOf(plan, k, t, year))
        stooks.push({ x: s.x, y: 1, z: s.z, sx: 1.5, sy: 2, sz: 1.5, yaw: s.yaw });
    });
    crop.stooks.set(stooks.length, (i, out) => put(out, stooks[i]!));
    this.fires = blightFires(plan, t, year).slice(0, MOST_FIRES);
    this.laid = {
      standing: parts.grain.length + parts.greens.length,
      withered: parts.withered.length,
      stubble: parts.stubble.length,
      stooks: Math.min(stooks.length, crop.stooks.capacity),
      high,
    };
  }

  /** The blighted crop's fires, their flames leaping and their smoke rising by the screen's clock. */
  private burn(clock: number): void {
    const crop = this.cropRows!,
      fires = this.fires,
      t = this.motion ? clock : 0;
    crop.flames.set(fires.length * FLAMES, (i, out) => {
      const f = fires[Math.floor(i / FLAMES)]!,
        n = i % FLAMES,
        a = n * 2.1 + Math.floor(i / FLAMES),
        leap = 0.75 + 0.25 * Math.sin(t * 7 + i * 1.3);
      out[0] = (f.x + Math.cos(a) * 0.5) * M;
      out[1] = 0.9 * leap * M;
      out[2] = (f.z + Math.sin(a) * 0.5) * M;
      out[3] = 1.1 * M;
      out[4] = 1.8 * leap * M;
      out[5] = 1.1 * M;
      out[6] = a;
    });
    crop.smoke.set(fires.length * PUFFS, (i, out) => {
      const f = fires[Math.floor(i / PUFFS)]!,
        rise = (t * 0.25 + (i % PUFFS) / PUFFS) % 1,
        size = 1.2 + 2.2 * rise;
      out[0] = (f.x + 1.2 * rise) * M;
      out[1] = (2 + 9 * rise) * M;
      out[2] = (f.z + 0.6 * rise) * M;
      out[3] = size * M;
      out[4] = size * M;
      out[5] = size * M;
      out[6] = 0;
    });
  }

  /** What the crop shows now (the look tools): its rows standing, withered, in stubble; stooks; fires. */
  cropShown(): {
    standing: number;
    withered: number;
    stubble: number;
    stooks: number;
    high: number;
    fires: number;
  } {
    return { ...this.laid, fires: this.fires.length };
  }

  /** How many of each thing the countryside shows now (the look tools). */
  counts(): Record<string, number> {
    const c = this.country;
    if (!c) return {};
    const shown = (name: Seasonal["name"]) =>
      this.seasonal
        .filter((s) => s.name === name && s.shown)
        .reduce((a, s) => a + s.pieces.length, 0);
    return {
      bounds: c.bounds.length,
      posts: c.posts.length,
      rows: c.rows.length,
      fallow: c.crop.filter((x) => x === "fallow").length,
      greens: c.crop.filter((x) => x === "greens").length,
      orchards: c.orchard.filter(Boolean).length,
      trees: c.trees.length,
      barns: c.barns.length,
      silos: c.silos.length,
      mills: c.mills.filter((m) => m.kind === "mill").length,
      turbines: c.mills.filter((m) => m.kind === "turbine").length,
      tractors: c.tractors.length,
      pen: c.pen.rails.length,
      hay: shown("hay"),
      scarecrows: shown("scarecrows"),
      fruit: shown("fruit"),
      blossom: this.bloom,
      spin: this.spin,
      working: this.working,
      boats: c.water?.boats.length ?? 0,
      afloat: this.afloat,
    };
  }

  destroy(): void {
    for (const b of this.batches) b.destroy();
    this.batches = [];
  }
}
