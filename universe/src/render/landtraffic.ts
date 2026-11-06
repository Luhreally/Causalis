// What goes along a land's ways (Phase 26 M153): carts, wagons or trucks on its roads by how far
// its people have come, trains on its railways, ships out along its sea lanes toward the lands
// across the sea and home again — as many on each as it is busy, within the setting's. They go on
// while the clock runs, at a pace the eye can follow whatever its speed, and stand while it is
// held; drawn in a few batches by mesh and colour, put again each frame.
import * as pc from "playcanvas";
import type { GetAbout, LandEra } from "../bridge/index.ts";
import { CARRIERS, alongWay, floorAt, groundAt, type LandGround, type Way } from "../view/index.ts";
import { InstancedBatch } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

type Mesh = "box" | "gable" | "cyl";

/**
 * A part of a car: its mesh and colour, how far ahead of the car's middle it sits (along its way),
 * how high its foot stands, and its size (region units); a ridged part's ridge runs along the way.
 */
type Part = {
  readonly mesh: Mesh;
  readonly color: Rgb;
  readonly along: number;
  readonly up: number;
  readonly len: number;
  readonly wide: number;
  readonly tall: number;
  readonly ridge?: boolean;
};

/** A car of a carrier: how far behind the carrier's head it goes, and its parts. */
type Car = { readonly back: number; readonly parts: readonly Part[] };

export type CarrierKind =
  | "cart"
  | "wagon"
  | "truck"
  | "steam-train"
  | "train"
  | "sail"
  | "steam"
  | "envoy"
  /** By what a people is (R1): a sled over the sea's floor; a file on foot with loads; a hive's hauler; a car on a line. */
  | "sled"
  | "porters"
  | "hauler"
  | "shuttle";

/** How much larger than life one on an errand is drawn: the land's nearest eye is twelve units off, and they should be picked out from there. */
const RIDER_LARGE = 2.5;
/** One on an errand, going along a road under their realm's colour (D1): a mount, a rider, a staff and a banner, large enough to be picked out. */
const envoyCar = (banner: Rgb): Car => ({
  back: 0,
  parts: (
    [
      {
        mesh: "box",
        color: [0.3, 0.22, 0.16],
        along: 0,
        up: 0.012,
        len: 0.05,
        wide: 0.02,
        tall: 0.024,
      },
      { mesh: "box", color: banner, along: 0, up: 0.034, len: 0.022, wide: 0.022, tall: 0.036 },
      {
        mesh: "box",
        color: [0.9, 0.86, 0.72],
        along: 0,
        up: 0.068,
        len: 0.016,
        wide: 0.016,
        tall: 0.016,
      },
      {
        mesh: "box",
        color: [0.2, 0.16, 0.12],
        along: -0.016,
        up: 0.03,
        len: 0.005,
        wide: 0.005,
        tall: 0.11,
      },
      {
        mesh: "box",
        color: banner,
        along: -0.038,
        up: 0.104,
        len: 0.042,
        wide: 0.006,
        tall: 0.036,
      },
    ] as Part[]
  ).map((p) => ({
    ...p,
    along: p.along * RIDER_LARGE,
    up: p.up * RIDER_LARGE,
    len: p.len * RIDER_LARGE,
    wide: p.wide * RIDER_LARGE,
    tall: p.tall * RIDER_LARGE,
  })),
});

const SLED: Rgb = [0.3, 0.62, 0.64],
  HAULER: Rgb = [0.5, 0.42, 0.3];
const WOOD: Rgb = [0.5, 0.36, 0.22],
  OX: Rgb = [0.36, 0.26, 0.18],
  HORSE: Rgb = [0.44, 0.3, 0.2],
  CANVAS: Rgb = [0.92, 0.89, 0.8],
  LOAD: Rgb = [0.84, 0.84, 0.8],
  IRON: Rgb = [0.17, 0.17, 0.19],
  RUST: Rgb = [0.5, 0.24, 0.18],
  SMOKE_RED: Rgb = [0.62, 0.16, 0.1],
  HULL: Rgb = [0.34, 0.23, 0.14],
  SAIL: Rgb = [0.95, 0.93, 0.86],
  STEEL: Rgb = [0.22, 0.24, 0.3],
  WHITE: Rgb = [0.92, 0.92, 0.9];
/** The cabs of trucks, by turns. */
const CABS: readonly Rgb[] = [
  [0.75, 0.18, 0.14],
  [0.2, 0.36, 0.7],
  [0.92, 0.92, 0.88],
  [0.86, 0.62, 0.16],
];

/** A railway wagon of goods (its colour by turns). */
const goodsWagon = (back: number, color: Rgb): Car => ({
  back,
  parts: [{ mesh: "box", color, along: 0, up: 0.006, len: 0.075, wide: 0.034, tall: 0.03 }],
});

/** Each kind of carrier's cars (a cab's colour put in by its carrier's turn). */
function cars(kind: CarrierKind, turn: number): readonly Car[] {
  switch (kind) {
    case "envoy":
      return [];
    case "sled":
      return [
        {
          back: 0,
          parts: [
            { mesh: "box", color: SLED, along: 0, up: 0.03, len: 0.08, wide: 0.034, tall: 0.012 },
            {
              mesh: "box",
              color: LOAD,
              along: -0.01,
              up: 0.042,
              len: 0.044,
              wide: 0.024,
              tall: 0.016,
            },
          ],
        },
      ];
    case "porters":
      return [0, 1, 2, 3].map((k) => ({
        back: k * 0.038,
        parts: [
          {
            mesh: "box" as const,
            color: WOOD,
            along: 0,
            up: 0.004,
            len: 0.012,
            wide: 0.012,
            tall: 0.024,
          },
          {
            mesh: "box" as const,
            color: CANVAS,
            along: 0,
            up: 0.028,
            len: 0.018,
            wide: 0.018,
            tall: 0.012,
          },
        ],
      }));
    case "hauler":
      return [
        {
          back: 0,
          parts: [
            { mesh: "box", color: HAULER, along: 0, up: 0.004, len: 0.1, wide: 0.034, tall: 0.022 },
            {
              mesh: "gable",
              color: LOAD,
              along: -0.008,
              up: 0.026,
              len: 0.07,
              wide: 0.03,
              tall: 0.014,
              ridge: true,
            },
          ],
        },
      ];
    case "shuttle":
      return [
        {
          back: 0,
          parts: [
            { mesh: "box", color: WHITE, along: 0, up: 0.006, len: 0.09, wide: 0.03, tall: 0.024 },
            { mesh: "box", color: SLED, along: 0, up: 0.016, len: 0.091, wide: 0.032, tall: 0.006 },
          ],
        },
      ];
    case "cart":
      return [
        {
          back: 0,
          parts: [
            { mesh: "box", color: OX, along: 0, up: 0.004, len: 0.03, wide: 0.014, tall: 0.016 },
          ],
        },
        {
          back: 0.045,
          parts: [
            { mesh: "box", color: WOOD, along: 0, up: 0.006, len: 0.05, wide: 0.032, tall: 0.016 },
          ],
        },
      ];
    case "wagon":
      return [
        {
          back: 0,
          parts: [
            {
              mesh: "box",
              color: HORSE,
              along: 0,
              up: 0.004,
              len: 0.034,
              wide: 0.022,
              tall: 0.018,
            },
          ],
        },
        {
          back: 0.055,
          parts: [
            { mesh: "box", color: WOOD, along: 0, up: 0.006, len: 0.06, wide: 0.034, tall: 0.014 },
            {
              mesh: "gable",
              color: CANVAS,
              along: 0,
              up: 0.02,
              len: 0.058,
              wide: 0.034,
              tall: 0.022,
              ridge: true,
            },
          ],
        },
      ];
    case "truck":
      return [
        {
          back: 0,
          parts: [
            {
              mesh: "box",
              color: CABS[turn % CABS.length]!,
              along: 0.035,
              up: 0.004,
              len: 0.022,
              wide: 0.03,
              tall: 0.024,
            },
            {
              mesh: "box",
              color: LOAD,
              along: -0.012,
              up: 0.004,
              len: 0.062,
              wide: 0.032,
              tall: 0.03,
            },
          ],
        },
      ];
    case "steam-train":
      return [
        {
          back: 0,
          parts: [
            { mesh: "box", color: IRON, along: 0, up: 0.006, len: 0.09, wide: 0.034, tall: 0.028 },
            {
              mesh: "box",
              color: IRON,
              along: -0.03,
              up: 0.006,
              len: 0.03,
              wide: 0.036,
              tall: 0.046,
            },
            {
              mesh: "cyl",
              color: SMOKE_RED,
              along: 0.032,
              up: 0.03,
              len: 0.014,
              wide: 0.014,
              tall: 0.022,
            },
          ],
        },
        goodsWagon(0.088, RUST),
        goodsWagon(0.17, WOOD),
        goodsWagon(0.252, RUST),
      ];
    case "train":
      return [0, 1, 2, 3].map((k) => ({
        back: k * 0.1,
        parts: [
          {
            mesh: "box" as const,
            color: WHITE,
            along: 0,
            up: 0.006,
            len: 0.094,
            wide: 0.034,
            tall: 0.032,
          },
          {
            mesh: "box" as const,
            color: CABS[0]!,
            along: 0,
            up: 0.02,
            len: 0.095,
            wide: 0.036,
            tall: 0.008,
          },
        ],
      }));
    case "sail":
      return [
        {
          back: 0,
          parts: [
            { mesh: "box", color: HULL, along: 0, up: -0.012, len: 0.2, wide: 0.06, tall: 0.032 },
            {
              mesh: "cyl",
              color: HULL,
              along: 0.01,
              up: 0.018,
              len: 0.008,
              wide: 0.008,
              tall: 0.14,
            },
            {
              mesh: "box",
              color: SAIL,
              along: 0.012,
              up: 0.045,
              len: 0.01,
              wide: 0.11,
              tall: 0.09,
            },
            {
              mesh: "box",
              color: SAIL,
              along: -0.055,
              up: 0.04,
              len: 0.008,
              wide: 0.07,
              tall: 0.07,
            },
          ],
        },
      ];
    case "steam":
      return [
        {
          back: 0,
          parts: [
            { mesh: "box", color: STEEL, along: 0, up: -0.014, len: 0.3, wide: 0.07, tall: 0.036 },
            { mesh: "box", color: WHITE, along: -0.05, up: 0.02, len: 0.1, wide: 0.05, tall: 0.03 },
            {
              mesh: "cyl",
              color: SMOKE_RED,
              along: 0.02,
              up: 0.03,
              len: 0.026,
              wide: 0.026,
              tall: 0.05,
            },
          ],
        },
      ];
  }
}

/** How fast each kind goes (region units a real second), at a pace the eye can follow. */
const PACE: Readonly<Record<CarrierKind, number>> = {
  envoy: 0.1,
  cart: 0.08,
  wagon: 0.11,
  truck: 0.34,
  sled: 0.3,
  porters: 0.06,
  hauler: 0.26,
  shuttle: 0.5,
  "steam-train": 0.42,
  train: 0.7,
  sail: 0.22,
  steam: 0.4,
};

/** A road of a land as its carriers go along it: its way, how it looks, how busy it is. */
export type RoadWay = {
  readonly way: Way;
  readonly look: "track" | "paved" | "rails";
  readonly traffic: number;
};
/** A railway or a sea lane, and how many go along it. */
export type BusyWay = { readonly way: Way; readonly busy: number };

/** A batch of one mesh and colour, and the parts put in it this frame. */
type Slot = { batch: InstancedBatch; data: Float32Array; n: number };

type Carrier = {
  readonly way: Way;
  readonly kind: CarrierKind;
  readonly cars: readonly Car[];
  /** Each car's parts' batches (as its parts). */
  slots: Slot[][];
  readonly start: number;
  readonly pace: number;
  /** How far to the right of its way it keeps; and whether it floats (a ship) or goes on the ground. */
  readonly aside: number;
  readonly floats: boolean;
  readonly lift: number;
};

/** How far over the ground a carrier on a road stands, and on a railway (the rails' bed). */
const ON_ROAD = 0.014,
  ON_RAILS = 0.016;

export class LandTraffic {
  private readonly stage: Stage;
  private readonly root: pc.Entity;
  private readonly meshes: Readonly<Record<Mesh, pc.Mesh>>;
  private readonly batches = new Map<string, Slot>();
  private carriers: Carrier[] = [];
  /** How far they have gone, real seconds while the clock ran. */
  private gone = 0;
  /** The ground they went on when last moved (for where one of them is). */
  private ground: { g: LandGround; at: (g: LandGround, x: number, z: number) => number } | null =
    null;
  private last = 0;
  private drawn = false;
  private undersea = false;

  constructor(stage: Stage, root: pc.Entity, meshes: Readonly<Record<Mesh, pc.Mesh>>) {
    this.stage = stage;
    this.root = root;
    this.meshes = meshes;
  }

  /**
   * What goes along the land's ways now: on its roads by its era, trains on its railways, ships on
   * its sea lanes — `most` carriers at the most, every way given one before any is given more.
   */
  lay(
    era: LandEra,
    roads: readonly RoadWay[],
    rails: readonly BusyWay[],
    lanes: readonly BusyWay[],
    most: number,
    /** A people of the water's: what goes along its roads goes along the seabed. */
    undersea = false,
    /** Those on an errand on its roads this year, each under their realm's colour (D1). */
    envoys: readonly Rgb[] = [],
    /** How its people get about, read off what they are (R1): what goes on its roads, if not a cart behind a beast. */
    how?: GetAbout["how"],
  ): void {
    this.undersea = undersea;
    const by = CARRIERS[era],
      rail: CarrierKind = era === "modern" ? "train" : "steam-train",
      wants: {
        way: Way;
        kind: CarrierKind;
        n: number;
        aside: number;
        floats: boolean;
        lift: number;
      }[] = [];
    const onRoad: CarrierKind | "none" =
      by.road === "none"
        ? "none"
        : how === "sled" || how === "swim"
          ? "sled"
          : how === "feet"
            ? "porters"
            : how === "hauler"
              ? "hauler"
              : how === "line"
                ? "shuttle"
                : by.road;
    if (onRoad !== "none")
      for (const r of roads)
        if (r.way.length > 0.2)
          wants.push({
            way: r.way,
            kind: onRoad,
            n: r.traffic,
            aside: r.look === "track" ? 0.016 : 0.024,
            floats: false,
            lift: ON_ROAD,
          });
    if (era === "industry" || era === "modern")
      for (const r of rails)
        if (r.way.length > 0.4)
          wants.push({
            way: r.way,
            kind: rail,
            n: r.busy >= 5 ? 2 : 1,
            aside: 0,
            floats: false,
            lift: ON_RAILS,
          });
    if (by.sea !== "none")
      for (const l of lanes)
        if (l.way.length > 0.5)
          wants.push({
            way: l.way,
            kind: by.sea,
            n: Math.min(4, l.busy),
            aside: 0,
            floats: true,
            lift: 0,
          });
    // Every way one before any is given more, until the most are given.
    const given = wants.map(() => 0);
    let left = most;
    for (let round = 0; left > 0; round++) {
      let any = false;
      for (let k = 0; k < wants.length && left > 0; k++)
        if (wants[k]!.n > round) {
          given[k]!++;
          left--;
          any = true;
        }
      if (!any) break;
    }
    this.carriers = [];
    // (Whoever is on an errand goes first, on the longest road, whatever else is on it: D1.)
    const road = [...roads].sort((a, b) => b.way.length - a.way.length)[0];
    if (road)
      envoys.forEach((banner, k) =>
        this.carriers.push({
          way: road.way,
          kind: "envoy",
          cars: [envoyCar(banner)],
          slots: [],
          start: ((k + 0.2) / envoys.length) * 2 * road.way.length,
          pace: PACE.envoy,
          aside: -0.03,
          floats: false,
          lift: ON_ROAD,
        }),
      );
    wants.forEach((w, k) => {
      const n = given[k]!;
      for (let c = 0; c < n; c++) {
        const turn = this.carriers.length;
        this.carriers.push({
          way: w.way,
          kind: w.kind,
          cars: cars(w.kind, turn),
          slots: [],
          // (Spread along the way out and back, each way's a little apart from the next's.)
          start: ((c + 0.37 * k) / n) * 2 * w.way.length,
          pace: PACE[w.kind] * (0.85 + 0.3 * frac(turn * 0.618)),
          aside: w.aside,
          floats: w.floats,
          lift: w.lift,
        });
      }
    });
    // The batches each part goes in, as many as there are of it.
    const keyOf = (p: Part) => `${p.mesh}|${p.color.join(",")}`,
      counts = new Map<string, { mesh: Mesh; color: Rgb; n: number }>();
    for (const c of this.carriers)
      for (const car of c.cars)
        for (const p of car.parts) {
          const key = keyOf(p),
            had = counts.get(key);
          if (had) had.n++;
          else counts.set(key, { mesh: p.mesh, color: p.color, n: 1 });
        }
    for (const [key, k] of counts) {
      const had = this.batches.get(key);
      if (had && had.batch.capacity >= k.n) continue;
      had?.batch.destroy();
      const cap = Math.max(8, Math.ceil(k.n * 1.3));
      this.batches.set(key, {
        batch: new InstancedBatch(
          this.stage,
          this.meshes[k.mesh],
          [k.color[0], k.color[1], k.color[2]],
          cap,
          this.root,
        ),
        data: new Float32Array(cap * 8),
        n: 0,
      });
    }
    for (const [key, b] of this.batches)
      if (!counts.has(key)) {
        b.batch.set(0, () => {});
        b.n = 0;
      }
    for (const c of this.carriers)
      c.slots = c.cars.map((car) => car.parts.map((p) => this.batches.get(keyOf(p))!));
    this.drawn = false;
  }

  /** Each carrier where it has got to: on while the clock runs, standing while it is held. */
  move(
    g: LandGround,
    running: boolean,
    onLand: (g: LandGround, x: number, z: number) => number = groundAt,
  ): void {
    this.ground = { g, at: onLand };
    const wall = performance.now() / 1000;
    if (running && this.last) this.gone += Math.min(0.25, wall - this.last);
    this.last = wall;
    if (!running && this.drawn) return;
    this.drawn = true;
    for (const b of this.batches.values()) b.n = 0;
    for (const c of this.carriers) {
      const head = c.start + c.pace * this.gone;
      c.cars.forEach((car, k) => {
        const at = alongWay(c.way, head - car.back, c.aside),
          sin = Math.sin(at.yaw),
          cos = Math.cos(at.yaw),
          base = c.floats ? 0.01 : (this.undersea ? floorAt : onLand)(g, at.x, at.z) + c.lift,
          slots = c.slots[k]!;
        car.parts.forEach((p, j) => {
          const b = slots[j]!;
          if (b.n >= b.batch.capacity) return;
          const o = b.n * 8;
          b.data[o] = at.x + sin * p.along;
          b.data[o + 1] = base + p.up + p.tall / 2;
          b.data[o + 2] = at.z + cos * p.along;
          // (A ridge along the way: the gable's ridge runs along its x, so turned a quarter.)
          b.data[o + 3] = p.ridge ? p.len : p.wide;
          b.data[o + 4] = p.tall;
          b.data[o + 5] = p.ridge ? p.wide : p.len;
          b.data[o + 6] = p.ridge ? at.yaw + Math.PI / 2 : at.yaw;
          b.data[o + 7] = 0;
          b.n++;
        });
      });
    }
    for (const b of this.batches.values()) {
      const d = b.data;
      b.batch.set(b.n, (i, o) => {
        const q = i * 8;
        for (let k = 0; k < 8; k++) o[k] = d[q + k]!;
      });
    }
  }

  /** Carriers going, by kind (the look tools). */
  info(): Partial<Record<CarrierKind, number>> {
    const out: Partial<Record<CarrierKind, number>> = {};
    for (const c of this.carriers) out[c.kind] = (out[c.kind] ?? 0) + 1;
    return out;
  }

  /** Where the first carrier of a kind is now (region units), or null (the look tools). */
  nth(kind: CarrierKind, k: number): { x: number; y: number; z: number } | null {
    const c = this.carriers.filter((x) => x.kind === kind)[k];
    if (!c) return null;
    const at = alongWay(c.way, c.start + c.pace * this.gone, c.aside),
      on = this.ground;
    return {
      x: at.x,
      y: on ? (c.floats ? 0.01 : (this.undersea ? floorAt : on.at)(on.g, at.x, at.z) + c.lift) : 0,
      z: at.z,
    };
  }

  clear(): void {
    this.carriers = [];
    for (const b of this.batches.values()) {
      b.batch.set(0, () => {});
      b.n = 0;
    }
    this.drawn = false;
  }

  destroy(): void {
    for (const b of this.batches.values()) b.batch.destroy();
    this.batches.clear();
  }
}

function frac(x: number): number {
  return x - Math.floor(x);
}
