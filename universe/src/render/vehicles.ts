// An armoured car in the battle (Phase 53 M220): its hull on four wheels, a narrower deck on the
// hull, its turret turned as its gunner turns it, its gun out of the turret's front and drawn back as
// it fires, its wheels under it. One knocked out is a wreck: tipped and sunk, its turret askew, its
// paint burnt off, black smoke going up from it and flames on it. carParts is the pure geometry, where
// each part is drawn; VehicleLayer draws them, each side in its own paint.
import * as pc from "playcanvas";
import type { VehicleNow } from "../view/index.ts";
import { InstancedBatch } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

/** Units to the metre of the field (as the battle's). */
const M = 0.1;
/** The most cars a battle draws, and the smoke puffs and the flames each may have. */
const CARS = 32,
  PUFFS = 6,
  FIRES = 3;
const OLIVE: Rgb = [0.33, 0.36, 0.26],
  STEEL: Rgb = [0.2, 0.2, 0.22],
  RUBBER: Rgb = [0.07, 0.07, 0.07],
  CHARRED: Rgb = [0.12, 0.11, 0.1],
  SOOT: Rgb = [0.1, 0.1, 0.1];

/** An armoured car's measures (m): its hull, its turret, its gun, its wheels. */
export const CAR = {
  long: 5.2,
  wide: 2.3,
  high: 1.3,
  clear: 0.55,
  turret: 1.3,
  turretHigh: 0.8,
  gun: 1.2,
  wheel: 0.55,
} as const;

/** One drawn part of a car: which batch, where (units), how big (units), its yaw and pitch. */
export type CarPart = {
  kind: "hull" | "deck" | "turret" | "gun" | "wheel";
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  pitch: number;
};

/** The parts the measures do not name (m): the deck, the gun's barrel, the wheels' width and where they stand, the gun's kick. */
const DECK = { wide: 0.78, long: 0.8, high: 0.3 },
  BARREL = 0.2,
  WHEEL_WIDE = 0.3,
  WHEEL_AT = 0.36,
  KICK = 0.3;
/** A wreck, all the way (rad and m): its hull tipped and sunk, its turret raised and tipped, its gun drooping. */
const WRECK = { tip: 0.08, sink: 0.1, rise: 0.1, turret: 0.3, droop: 0.35 };

/**
 * A car's parts as drawn now: its hull on its four wheels, a narrower deck on the hull, the turret
 * turned by `turret` from the hull's facing, its gun out of the turret's front (drawn back by
 * `recoil`); a wreck tipped and sunk, its turret raised and askew, its gun drooping. Positions are
 * the field's metres (× M) and the car's own (× metre) for its heights and sizes; a car faces its
 * yaw as a trooper does (0 toward +z, π/2 toward +x). Pure: the same car always looks the same.
 */
export function carParts(v: VehicleNow, metre: number, M: number): CarPart[] {
  const w = v.knocked,
    turned = v.yaw + v.turret,
    // A point of the car: `along` ahead of the way `yaw` faces, `across` to its right, `up` (m).
    at = (yaw: number, along: number, across: number, up: number) => ({
      x: v.x * M + (Math.sin(yaw) * along + Math.cos(yaw) * across) * metre,
      y: v.y * M + up * metre,
      z: v.z * M + (Math.cos(yaw) * along - Math.sin(yaw) * across) * metre,
    }),
    hullUp = CAR.clear + CAR.high / 2 - WRECK.sink * w,
    deckUp = CAR.clear + CAR.high + DECK.high / 2 - WRECK.sink * w,
    turretUp = CAR.clear + CAR.high + DECK.high + CAR.turretHigh / 2 + WRECK.rise * w,
    reach = CAR.turret / 2 + CAR.gun / 2 - KICK * v.recoil,
    parts: CarPart[] = [
      {
        kind: "hull",
        ...at(v.yaw, 0, 0, hullUp),
        sx: CAR.wide * metre,
        sy: CAR.high * metre,
        sz: CAR.long * metre,
        yaw: v.yaw,
        pitch: WRECK.tip * w,
      },
      {
        kind: "deck",
        ...at(v.yaw, 0, 0, deckUp),
        sx: CAR.wide * DECK.wide * metre,
        sy: DECK.high * metre,
        sz: CAR.long * DECK.long * metre,
        yaw: v.yaw,
        pitch: WRECK.tip * w,
      },
      {
        kind: "turret",
        ...at(turned, 0, 0, turretUp),
        sx: CAR.turret * metre,
        sy: CAR.turretHigh * metre,
        sz: CAR.turret * metre,
        yaw: turned,
        pitch: WRECK.turret * w,
      },
      {
        kind: "gun",
        ...at(turned, reach, 0, turretUp),
        // (Laid along the turret's way: a cylinder turned on its side.)
        sx: BARREL * metre,
        sy: CAR.gun * metre,
        sz: BARREL * metre,
        yaw: turned,
        pitch: Math.PI / 2 + WRECK.droop * w,
      },
    ];
  // Four wheels, at the corners of the hull, each turning on its axle across the car.
  for (const fore of [-1, 1])
    for (const across of [-1, 1]) {
      parts.push({
        kind: "wheel",
        ...at(v.yaw, fore * CAR.long * WHEEL_AT, (across * CAR.wide) / 2, CAR.wheel / 2),
        sx: CAR.wheel * metre,
        sy: WHEEL_WIDE * metre,
        sz: CAR.wheel * metre,
        yaw: v.yaw + Math.PI / 2,
        pitch: Math.PI / 2,
      });
    }
  return parts;
}

/** Draw each part given, one instance to a part. */
function drawParts(batch: InstancedBatch, list: readonly CarPart[]): void {
  batch.set(list.length, (i, out) => {
    const p = list[i]!;
    out[0] = p.x;
    out[1] = p.y;
    out[2] = p.z;
    out[3] = p.sx;
    out[4] = p.sy;
    out[5] = p.sz;
    out[6] = p.yaw;
    out[7] = p.pitch;
  });
}

/** The cars of a battle: each side's hulls, decks and turrets in its paint, the guns and wheels of those running, the wrecks charred, their smoke and fire. */
export class VehicleLayer {
  readonly root = new pc.Entity("vehicles");
  private readonly sides: { hull: InstancedBatch; deck: InstancedBatch; turret: InstancedBatch }[];
  private readonly guns: InstancedBatch;
  private readonly wheels: InstancedBatch;
  private readonly charred: InstancedBatch;
  private readonly charredRound: InstancedBatch;
  private readonly fumes: InstancedBatch;
  private readonly flames: InstancedBatch;

  constructor(stage: Stage, parent: pc.Entity, box: pc.Mesh, cyl: pc.Mesh, cone: pc.Mesh) {
    const batch = (mesh: pc.Mesh, color: Rgb, n: number, material?: pc.Material) =>
      new InstancedBatch(stage, mesh, color, n, this.root, material);
    this.sides = [0, 1].map(() => ({
      hull: batch(box, OLIVE, CARS),
      deck: batch(box, OLIVE, CARS),
      turret: batch(box, OLIVE, CARS),
    }));
    this.guns = batch(cyl, STEEL, CARS);
    this.wheels = batch(cyl, RUBBER, CARS * 4);
    this.charred = batch(box, CHARRED, CARS * 3);
    this.charredRound = batch(cyl, CHARRED, CARS * 5);
    this.fumes = batch(box, SOOT, CARS * PUFFS, flatMaterial(SOOT, 0.7));
    // (The fire of the town's flames: lit from within, not by the light about it.)
    const fire = new pc.StandardMaterial();
    fire.useLighting = false;
    fire.diffuse = new pc.Color(0, 0, 0);
    fire.emissive = new pc.Color(1, 0.5, 0.12);
    fire.update();
    this.flames = batch(cone, [1, 0.5, 0.1], CARS * FIRES, fire);
    parent.addChild(this.root);
    this.root.enabled = false;
  }

  /** Each side's paint: its colour mixed half with drab olive. */
  setup(colors: readonly [Rgb, Rgb]): void {
    colors.forEach((c, side) => {
      const paint: Rgb = [(c[0] + OLIVE[0]) / 2, (c[1] + OLIVE[1]) / 2, (c[2] + OLIVE[2]) / 2],
        s = this.sides[side]!;
      s.hull.recolor(paint);
      s.deck.recolor(paint);
      s.turret.recolor(paint);
    });
  }

  /**
   * The cars at their moment, with the smoke and the flames off the wrecks (x, y, z, r in the
   * field's metres; y where each rises from). Hidden when no car is brought to the field.
   */
  update(
    cars: readonly VehicleNow[],
    fumes: readonly { x: number; y: number; z: number; r: number }[],
    flames: readonly { x: number; y: number; z: number; r: number }[],
    metre: number,
  ): void {
    this.root.enabled = cars.length > 0;
    const posed = cars.map((v) => ({ v, parts: carParts(v, metre, M) })),
      // The parts of those cars that `keep` names, of the kinds named.
      pick = (kinds: readonly CarPart["kind"][], keep: (v: VehicleNow) => boolean) =>
        posed
          .filter(({ v }) => keep(v))
          .flatMap(({ parts }) => parts.filter((p) => kinds.includes(p.kind))),
      running = (v: VehicleNow) => v.knocked <= 0.5,
      wrecked = (v: VehicleNow) => v.knocked > 0.5;
    for (const side of [0, 1] as const) {
      const s = this.sides[side]!,
        mine = (v: VehicleNow) => v.side === side && running(v);
      drawParts(s.hull, pick(["hull"], mine));
      drawParts(s.deck, pick(["deck"], mine));
      drawParts(s.turret, pick(["turret"], mine));
    }
    drawParts(this.guns, pick(["gun"], running));
    drawParts(this.wheels, pick(["wheel"], running));
    drawParts(this.charred, pick(["hull", "deck", "turret"], wrecked));
    drawParts(this.charredRound, pick(["gun", "wheel"], wrecked));
    this.fumes.set(fumes.length, (j, out) => {
      const f = fumes[j]!;
      out[0] = f.x * M;
      out[1] = f.y * M;
      out[2] = f.z * M;
      out[3] = f.r * M * 2;
      out[4] = f.r * M * 2;
      out[5] = f.r * M * 2;
      out[6] = j * 0.9;
      out[7] = 0;
    });
    this.flames.set(flames.length, (j, out) => {
      const f = flames[j]!,
        // (Standing on the wreck: its base where it burns, its flame going up.)
        tall = f.r * M * 3;
      out[0] = f.x * M;
      out[1] = f.y * M + tall / 2;
      out[2] = f.z * M;
      out[3] = f.r * M * 2;
      out[4] = tall;
      out[5] = f.r * M * 2;
      out[6] = j;
      out[7] = 0;
    });
  }

  /** How many of its parts are drawn (the look tools). */
  count(): number {
    const all = [
      ...this.sides.flatMap((s) => [s.hull, s.deck, s.turret]),
      this.guns,
      this.wheels,
      this.charred,
      this.charredRound,
      this.fumes,
      this.flames,
    ];
    return all.reduce((n, b) => n + b.size, 0);
  }
}
