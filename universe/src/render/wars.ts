// Wars on the globe (Phase 9 M87, Phase 12 M110): each host a column in its realm's colours, as
// many ranks and files as the men it fields — riders on their horses where its design rides, and
// cars among its men where it is armoured (Phase 53) — its banners over its head and every third
// rank, a ship with its sail where the way crosses the sea; the defenders in a block at what they
// hold; each battle of this year and last two masses meeting in their colours, the fallen lying
// between them, crossed blades over a flare that pulses, the larger the more fell, dimmer as the
// years pass; a ring of tents about a seat under siege; and at the seats of realms at peace, their
// garrisons under their banners. Instanced, each mark stood upright on the globe's face (the fallen
// laid along it).
import * as pc from "playcanvas";
import {
  RANK_STEP,
  warBattleFigures,
  holdShape,
  hostShape,
  warTokens,
  type BattleFigure,
  type WarPaths,
  type WarToken,
} from "../view/index.ts";
import { InstancedBatch, boxMesh, coneMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

/** The most tokens, clashes and figures of one kind drawn at once. */
const MOST = 700,
  MOST_CLASHES = 48,
  /** The most men drawn at once (a war watched drawn near: its figures squads of men, M195). */
  MOST_MEN = MOST * 4;
/** A head's colour where the people have no look of their own (Earth's upright apes). */
const SKIN: Rgb = [0.9, 0.72, 0.56];
/** How close the eye comes (the globe's radius 1) before the seats' garrisons show. */
export const GARRISON_ZOOM = 2.4;

type V = { x: number; y: number; z: number };

/** A figure standing (or lying) on the globe: where, which way up and ahead, its side, its size. */
type Stood = {
  readonly at: V;
  readonly up: V;
  readonly ahead: V;
  readonly side: number;
  readonly size: number;
  readonly lead: boolean;
  readonly mounted: boolean;
  /** Whether its host has armoured cars among its men (Phase 53). */
  readonly armoured: boolean;
  /** A car: a hull and a turret, no body, head or horse. Left out for the others. */
  readonly car?: true;
};

export class GlobeWars {
  readonly root = new pc.Entity("wars");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private readonly tent: pc.Mesh;
  private paths: WarPaths | null = null;
  private readonly heads: InstancedBatch;
  private readonly horses: InstancedBatch;
  private readonly fallen: InstancedBatch;
  private readonly poles: InstancedBatch;
  private readonly hulls: InstancedBatch;
  private readonly sails: InstancedBatch;
  private readonly blades: InstancedBatch;
  private readonly flares: InstancedBatch;
  private readonly embers: InstancedBatch;
  /** The charred hulls of the cars fallen (Phase 53). */
  private readonly wrecks: InstancedBatch;
  /** Each side's flags, bodies (tabards) and tents, by the colours of the year's wars. */
  private flags: InstancedBatch[] = [];
  private tabards: InstancedBatch[] = [];
  private tents: InstancedBatch[] = [];
  /** Each side with armoured cars this year: its cars' hulls and turrets, and the side. */
  private carHulls: InstancedBatch[] = [];
  private carTurrets: InstancedBatch[] = [];
  private carSides: number[] = [];
  /** How much larger than the year's its figures are drawn (a war watched unfolding's, Phase 38 M193). */
  grand = 1;
  /**
   * How far the eye leans over the land (0 … 1, M195): the figures of a war watched, drawn larger,
   * have their heads small and their bodies broad to show their colours from above — seen from
   * the side, as they are.
   */
  lean = 0;
  /**
   * How many men abreast and deep each figure of a war watched is drawn as (M195: near, its hosts
   * crowds, not a few great figures; 1: each one). Its batches are made for it as the wars are set.
   */
  squad = 1;
  /** Each war watched's march at the last update: a host gone on since steps as it goes (M195). */
  private marched = new Map<string, number>();
  /** How many marks were drawn at the last update (for the look tools). */
  drawn = 0;
  /** What was drawn at the last update, by kind (for the look tools and the gate). */
  counts = { marching: 0, battle: 0, fallen: 0, tents: 0, garrison: 0, riders: 0, men: 0 };
  /** Where each host, clash, camp and garrison stood at the last update, and its page (for picking). */
  private marks: { at: V; ref: string }[] = [];
  /** Where each host's head stood at the last update: its war, and whether the attacker's. */
  private leads: { at: V; ref: string; attacker: boolean }[] = [];

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    this.tent = keptMesh(coneMesh(stage, 0.5, 1, 4));
    const make = (color: Rgb, n: number) =>
      new InstancedBatch(stage, this.box, color, n, this.root);
    this.heads = make(SKIN, MOST_MEN);
    this.horses = make([0.46, 0.3, 0.18], MOST_MEN);
    this.fallen = make([0.3, 0.18, 0.14], MOST_MEN);
    this.poles = make([0.42, 0.3, 0.18], MOST);
    this.hulls = make([0.46, 0.3, 0.16], MOST);
    this.sails = make([0.94, 0.92, 0.84], MOST);
    this.blades = make([0.86, 0.88, 0.92], MOST_CLASHES * 2);
    this.flares = make([1, 0.8, 0.28], MOST_CLASHES * 3);
    this.embers = make([0.66, 0.4, 0.18], MOST_CLASHES * 3);
    this.wrecks = make([0.12, 0.11, 0.1], MOST_MEN);
    parent.addChild(this.root);
  }

  /** Its soldiers' heads in their people's own hide (null: as Earth's upright apes'). */
  skin(c: Rgb | null): void {
    this.heads.recolor(c ?? SKIN);
  }

  /** The year's wars, as ways over the globe (null: none shown). */
  set(paths: WarPaths | null): void {
    this.paths = paths;
    for (const f of [
      ...this.flags,
      ...this.tabards,
      ...this.tents,
      ...this.carHulls,
      ...this.carTurrets,
    ])
      f.destroy();
    const colors = paths?.colors ?? [],
      // Each colour's batches hold as many as it can show (a garrison's few, a great host's
      // many), not the most any could.
      bodies = colors.map(() => 0),
      banners = colors.map(() => 0),
      camps = colors.map(() => 0);
    for (const p of paths?.paths ?? []) {
      const host = hostShape(p.men),
        hold = holdShape(p.foeMen);
      bodies[p.side]! += host.ranks * host.files;
      banners[p.side]! += host.ranks * host.files;
      bodies[p.foe]! += hold.ranks * hold.files;
      banners[p.foe]! += 1;
    }
    for (const b of paths?.bursts ?? []) {
      bodies[b.side]! += 8;
      bodies[b.foe]! += 8;
    }
    for (const c of paths?.camps ?? []) {
      camps[c.side]! += 8;
      banners[c.side]! += 1;
    }
    for (const g of paths?.garrisons ?? []) {
      bodies[g.side]! += 3;
      banners[g.side]! += 1;
    }
    // (A war watched drawn near: each body a squad's.)
    const many = Math.max(1, Math.round(this.squad)) ** 2,
      cap = (n: number, k = 1) => Math.min(MOST * k, n * k + 4);
    this.flags = colors.map(
      (c, i) => new InstancedBatch(this.stage, this.box, c, cap(banners[i]!), this.root),
    );
    // (A body in its side's colour, a little darker than its banner.)
    this.tabards = colors.map(
      (c, i) =>
        new InstancedBatch(
          this.stage,
          this.box,
          [c[0] * 0.78, c[1] * 0.78, c[2] * 0.78],
          cap(bodies[i]!, many),
          this.root,
        ),
    );
    this.tents = colors.flatMap((c, i) =>
      camps[i] ? [new InstancedBatch(this.stage, this.tent, c, camps[i]!, this.root)] : [],
    );
    this.tentSides = colors.flatMap((_, i) => (camps[i] ? [i] : []));
    // The sides with armoured cars among their men this year (each gets a car's two batches).
    const armour = colors.map(() => false);
    for (const p of paths?.paths ?? []) {
      if (p.armoured) armour[p.side] = true;
      if (p.foeArmoured) armour[p.foe] = true;
    }
    for (const g of paths?.garrisons ?? []) if (g.armoured) armour[g.side] = true;
    this.carSides = colors.flatMap((_, i) => (armour[i] ? [i] : []));
    // A car's hull and turret: in its side's colour mixed half with drab olive.
    const carBatch = (i: number) => {
      const [r, g, b] = colors[i]!;
      return new InstancedBatch(
        this.stage,
        this.box,
        [(r + 0.33) / 2, (g + 0.36) / 2, (b + 0.26) / 2],
        MOST_MEN,
        this.root,
      );
    };
    this.carHulls = this.carSides.map(carBatch);
    this.carTurrets = this.carSides.map(carBatch);
  }
  /** The colour each tents' batch is of. */
  private tentSides: number[] = [];

  /**
   * Put every host, battle, camp and garrison where it is at screen time `s` (seconds), the eye
   * `zoom` from the globe's middle (garrisons are shown only closer than GARRISON_ZOOM); the host
   * of a war watched unfolding as far along its way as `marching` has it (Phase 38 M193).
   */
  update(s: number, zoom = 3, marching?: ReadonlyMap<string, number>): void {
    const paths = this.paths;
    if (!paths || !this.root.enabled) return;
    // (A war watched unfolding: its figures `g` the larger, their heads the smaller so their
    // colours show from above, its banners and blades `pg` the larger.)
    const g = this.grand,
      pg = Math.sqrt(g),
      lean = Math.max(0, Math.min(1, this.lean)),
      wide = g > 1 ? 1.35 - 0.35 * lean : 1,
      headK = g > 1 ? 0.6 + 0.4 * lean : 1,
      tokens = warTokens(paths, s, marching, g).slice(0, MOST),
      walkers = tokens.filter((t) => !t.ship),
      ships = tokens.filter((t) => t.ship),
      stand = (
        out: number[],
        at: V,
        up: V,
        ahead: V,
        sx: number,
        sy: number,
        sz: number,
        k = 1,
      ) => {
        out[0] = at.x;
        out[1] = at.y;
        out[2] = at.z;
        out[3] = sx * k;
        out[4] = sy * k;
        out[5] = sz * k;
        out[6] = up.x;
        out[7] = up.y;
        out[8] = up.z;
        out[9] = ahead.x;
        out[10] = ahead.y;
        out[11] = ahead.z;
      },
      lift = (at: V, up: V, h: number, k: number): V => ({
        x: at.x + up.x * h * k,
        y: at.y + up.y * h * k,
        z: at.z + up.z * h * k,
      });
    // Everyone standing: the marchers and defenders, the battles' masses, the garrisons.
    const battle = warBattleFigures(paths, s, g),
      fighting = battle.filter((f) => !f.fallen),
      lying = battle.filter((f) => f.fallen),
      garrison = zoom < GARRISON_ZOOM ? garrisonFigures(paths) : [],
      standing: Stood[] = [
        ...walkers,
        ...fighting.map((f: BattleFigure) => ({
          ...f,
          lead: false,
          mounted: false,
          armoured: false,
        })),
        ...garrison,
      ].slice(0, MOST);
    // (A host watched on the march — its clock gone on since the last — steps as it goes, each
    // rank a little behind the one before: each lifted a little, and set down.)
    const going = new Set<string>();
    for (const [ref, k] of marching ?? []) {
      const was = this.marched.get(ref);
      if (was !== undefined && Math.abs(k - was) > 1e-6) going.add(ref);
    }
    this.marched = new Map(marching ?? []);
    // (A war watched drawn near, M195: each of its figures a squad of men, `n` abreast and deep —
    // its hosts crowds, not a few great figures — each of its fallen three; each man of a host on
    // the march stepping in his turn.)
    const n = Math.max(1, Math.round(this.squad)),
      steps = new Map<Stood, number>(),
      men: Stood[] = [];
    standing.forEach((f, i) => {
      const walker = i < walkers.length,
        stepping = walker && (f as WarToken).attacker && going.has((f as WarToken).ref),
        // (A car is one vehicle, not a squad of men.)
        k = f.car ? 1 : walker ? n : Math.min(n, 2);
      if (k === 1) {
        men.push(f);
        if (stepping) steps.set(f, Math.abs(Math.sin(s * 7 + i * 0.9)) * 0.003);
        return;
      }
      const [across, deep] = walker ? [0.014 * g, RANK_STEP * g] : [0.012 * g, 0.01 * g],
        aside = unit(cross(f.up, f.ahead));
      for (let a = 0; a < k; a++)
        for (let b = 0; b < k; b++) {
          const x = ((a - (k - 1) / 2) * across) / k,
            y = ((b - (k - 1) / 2) * deep) / k,
            man: Stood = {
              at: {
                x: f.at.x + aside.x * x + f.ahead.x * y,
                y: f.at.y + aside.y * x + f.ahead.y * y,
                z: f.at.z + aside.z * x + f.ahead.z * y,
              },
              up: f.up,
              ahead: f.ahead,
              side: f.side,
              size: (f.size * 1.2) / k,
              lead: false,
              mounted: f.mounted,
              armoured: f.armoured,
            };
          men.push(man);
          if (stepping)
            steps.set(man, Math.abs(Math.sin(s * 7 + i * 0.9 + (a * k + b) * 1.3)) * 0.003);
        }
    });
    // (A fallen car lies where it was, its hull charred: the men are strewn as they were.)
    const wrecks = lying.filter((f) => f.car),
      dead = lying.filter((f) => !f.car);
    const strewn: { at: V; up: V; ahead: V; size: number }[] =
      n > 1
        ? dead.flatMap((f) => {
            const aside = unit(cross(f.up, f.ahead));
            return (
              [
                [-0.5, -0.3, false],
                [0.45, 0.35, true],
                [0.1, -0.8, false],
              ] as const
            ).map(([x, y, turned]) => ({
              at: {
                x: f.at.x + (aside.x * x + f.ahead.x * y) * 0.01 * g,
                y: f.at.y + (aside.y * x + f.ahead.y * y) * 0.01 * g,
                z: f.at.z + (aside.z * x + f.ahead.z * y) * 0.01 * g,
              },
              up: f.up,
              ahead: turned ? aside : f.ahead,
              size: f.size * 0.6,
            }));
          })
        : dead;
    // (Their banners over the squads the less tall.)
    const q = n > 1 ? 0.7 : 1;
    // (A rider sits on a horse: a body the higher by it.)
    const seat = (f: Stood) => (f.mounted ? 0.012 : 0) + (steps.get(f) ?? 0),
      height = (f: Stood) => (f.lead ? 0.022 : 0.014);
    // (A car is drawn as a hull and a turret, not a man: its batches below.)
    const people = men.filter((f) => !f.car),
      vehicles = men.filter((f) => f.car);
    this.tabards.forEach((batch, side) => {
      const mine = people.filter((f) => f.side === side);
      batch.setBasis(mine.length, (i, out) => {
        const f = mine[i]!,
          h = height(f);
        stand(
          out,
          lift(f.at, f.up, seat(f) + h / 2, f.size * g),
          f.up,
          f.ahead,
          (f.lead ? 0.016 : 0.01) * wide,
          h,
          (f.lead ? 0.01 : 0.008) * wide,
          f.size * g,
        );
      });
    });
    this.heads.setBasis(people.length, (i, out) => {
      const f = people[i]!,
        h = height(f),
        r = (f.lead ? 0.011 : 0.008) * headK;
      stand(
        out,
        lift(f.at, f.up, seat(f) + h + r / 2, f.size * g),
        f.up,
        f.ahead,
        r,
        r,
        r,
        f.size * g,
      );
    });
    const riders = people.filter((f) => f.mounted);
    this.horses.setBasis(riders.length, (i, out) => {
      const f = riders[i]!;
      stand(
        out,
        lift(f.at, f.up, 0.006 + (steps.get(f) ?? 0), f.size * g),
        f.up,
        f.ahead,
        0.009,
        0.01,
        0.024,
        f.size * g,
      );
    });
    // The cars: a hull on the ground and a turret on it, in their side's colour; a wreck's hull
    // charred, lying where it was.
    this.carHulls.forEach((batch, k) => {
      const mine = vehicles.filter((f) => f.side === this.carSides[k]);
      batch.setBasis(mine.length, (i, out) => {
        const f = mine[i]!;
        stand(
          out,
          lift(f.at, f.up, 0.004, f.size * g),
          f.up,
          f.ahead,
          0.016,
          0.008,
          0.03,
          f.size * g,
        );
      });
    });
    this.carTurrets.forEach((batch, k) => {
      const mine = vehicles.filter((f) => f.side === this.carSides[k]);
      batch.setBasis(mine.length, (i, out) => {
        const f = mine[i]!;
        stand(
          out,
          lift(f.at, f.up, 0.011, f.size * g),
          f.up,
          f.ahead,
          0.008,
          0.006,
          0.012,
          f.size * g,
        );
      });
    });
    this.wrecks.setBasis(wrecks.length, (i, out) => {
      const f = wrecks[i]!;
      stand(
        out,
        lift(f.at, f.up, 0.004, f.size * g),
        f.up,
        f.ahead,
        0.016,
        0.008,
        0.03,
        f.size * g,
      );
    });
    // The fallen, laid along the ground.
    this.fallen.setBasis(strewn.length, (i, out) => {
      const f = strewn[i]!;
      stand(
        out,
        lift(f.at, f.up, 0.003, f.size * g),
        f.ahead,
        f.up,
        0.01,
        0.018,
        0.006,
        f.size * g,
      );
    });
    this.hulls.setBasis(ships.length, (i, out) => {
      const t = ships[i]!;
      stand(
        out,
        lift(t.at, t.up, 0.003, t.size * g),
        t.up,
        t.ahead,
        0.011,
        0.006,
        0.028,
        t.size * g,
      );
    });
    this.sails.setBasis(ships.length, (i, out) => {
      const t = ships[i]!;
      stand(
        out,
        lift(t.at, t.up, 0.016, t.size * g),
        t.up,
        t.ahead,
        0.002,
        0.02,
        0.016,
        t.size * g,
      );
    });
    // The camps about the seats under siege: a ring of tents in the besiegers' colours, a
    // banner at their middle.
    const camps = paths.camps.flatMap((c) => {
      const up = unit(c.at),
        [t0, t1] = tangents(up);
      return Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI * 2) / 8,
          r = 0.026 * g;
        return {
          at: {
            x: c.at.x + (t0.x * Math.cos(a) + t1.x * Math.sin(a)) * r,
            y: c.at.y + (t0.y * Math.cos(a) + t1.y * Math.sin(a)) * r,
            z: c.at.z + (t0.z * Math.cos(a) + t1.z * Math.sin(a)) * r,
          },
          up,
          side: c.side,
          ahead: t0,
        };
      });
    });
    this.tents.forEach((batch, k) => {
      const mine = camps.filter((c) => c.side === this.tentSides[k]);
      batch.setBasis(mine.length, (i, out) => {
        const c = mine[i]!;
        stand(out, lift(c.at, c.up, 0.007, g), c.up, c.ahead, 0.014, 0.014, 0.014, g);
      });
    });
    // The banners: a pole and a flag in its side's colour, over each banner-bearer, every
    // ship, each camp's middle and each garrison's.
    const bearers: Stood[] = [
      ...tokens.filter((t) => t.banner || t.ship),
      ...paths.camps.map((c) => ({
        at: c.at,
        up: unit(c.at),
        ahead: tangents(unit(c.at))[0],
        side: c.side,
        size: 1,
        lead: true,
        mounted: false,
        armoured: false,
      })),
      ...garrison.filter((g) => g.lead),
    ];
    this.poles.setBasis(bearers.length, (i, out) => {
      const t = bearers[i]!;
      stand(
        out,
        lift(t.at, t.up, 0.03 + seat(t), t.size * g * q),
        t.up,
        t.ahead,
        0.0022,
        0.05,
        0.0022,
        t.size * pg * q,
      );
    });
    this.flags.forEach((batch, side) => {
      const mine = bearers.filter((t) => t.side === side);
      batch.setBasis(mine.length, (i, out) => {
        const t = mine[i]!,
          at = lift(t.at, t.up, 0.047 + seat(t), t.size * g * q),
          back = {
            x: -t.ahead.x * 0.012 * pg * q,
            y: -t.ahead.y * 0.012 * pg * q,
            z: -t.ahead.z * 0.012 * pg * q,
          };
        stand(
          out,
          { x: at.x + back.x, y: at.y + back.y, z: at.z + back.z },
          t.up,
          t.ahead,
          0.002,
          0.014,
          0.024,
          t.size * pg * q,
        );
      });
    });
    // The clashes: crossed blades over a flare, pulsing; last year's and before dimmer.
    const clashes = paths.bursts.slice(0, MOST_CLASHES),
      fresh = clashes.filter((c) => c.age === 0),
      old = clashes.filter((c) => c.age > 0),
      spokes = (list: typeof clashes, batch: InstancedBatch, pulse: boolean) =>
        batch.setBasis(list.length * 3, (i, out) => {
          const c = list[Math.floor(i / 3)]!,
            up = unit(c.at),
            [t0, t1] = tangents(up),
            a = ((i % 3) * Math.PI) / 3 + (pulse ? s * 0.8 : 0),
            ahead = {
              x: t0.x * Math.cos(a) + t1.x * Math.sin(a),
              y: t0.y * Math.cos(a) + t1.y * Math.sin(a),
              z: t0.z * Math.cos(a) + t1.z * Math.sin(a),
            },
            // (To a leaning eye, the flare laid on the ground the smaller: seen from the side.)
            size =
              c.size *
              (pulse ? 0.85 + 0.35 * Math.abs(Math.sin(s * 3 + i)) : 0.7) *
              (1 - 0.45 * lean);
          stand(out, c.at, up, ahead, size * 0.28, 0.003, size * 1.6, g);
        });
    spokes(fresh, this.flares, true);
    spokes(old, this.embers, false);
    this.blades.setBasis(clashes.length * 2, (i, out) => {
      const c = clashes[Math.floor(i / 2)]!,
        up0 = unit(c.at),
        [t0, t1] = tangents(up0),
        lean = (i % 2 ? 1 : -1) * 0.6,
        up = {
          x: up0.x * Math.cos(lean) + t0.x * Math.sin(lean),
          y: up0.y * Math.cos(lean) + t0.y * Math.sin(lean),
          z: up0.z * Math.cos(lean) + t0.z * Math.sin(lean),
        },
        h = 0.05 * pg * (1 - 0.3 * lean);
      stand(
        out,
        { x: c.at.x + up.x * h * 0.5, y: c.at.y + up.y * h * 0.5, z: c.at.z + up.z * h * 0.5 },
        up,
        t1,
        0.004,
        h,
        0.004,
      );
    });
    this.drawn = tokens.length + clashes.length + battle.length + camps.length + garrison.length;
    this.counts = {
      marching: walkers.length,
      battle: fighting.length,
      fallen: lying.length,
      tents: camps.length,
      garrison: garrison.length,
      riders: riders.length,
      men: men.length,
    };
    // (A host's marks stand for its war; a clash for its battle; a camp for its war; a
    // garrison for its realm.)
    this.marks = [
      ...clashes.map((c) => ({ at: c.at, ref: c.event })),
      ...tokens.filter((k) => k.lead).map((k) => ({ at: k.at, ref: k.ref })),
      ...paths.camps.map((c) => ({ at: c.at, ref: c.war })),
      ...(garrison.length ? paths.garrisons.map((g) => ({ at: g.at, ref: g.realm })) : []),
    ];
    this.leads = tokens
      .filter((k) => k.lead && k.size > 0.5)
      .map((k) => ({ at: k.at, ref: k.ref, attacker: k.attacker }));
  }

  /**
   * Each host's head on the screen (CSS pixels), where its counter stands (Phase 11 M101): its
   * war, and whether the attacker's. Those over the globe's rim, from the eye, are left out.
   */
  hostsOnScreen(): { ref: string; attacker: boolean; x: number; y: number }[] {
    if (!this.root.enabled) return [];
    const cam = this.stage.camera,
      eye = cam.getPosition(),
      at = new pc.Vec3(),
      out = new pc.Vec3(),
      found: { ref: string; attacker: boolean; x: number; y: number }[] = [];
    for (const h of this.leads) {
      // (Facing the eye: a unit globe's rim, seen from the eye, is where this is 1.)
      if (h.at.x * eye.x + h.at.y * eye.y + h.at.z * eye.z <= 1.02) continue;
      at.set(h.at.x * 1.02, h.at.y * 1.02, h.at.z * 1.02);
      cam.camera!.worldToScreen(at, out);
      if (out.z > 0) found.push({ ref: h.ref, attacker: h.attacker, x: out.x, y: out.y });
    }
    return found;
  }

  /**
   * The war (a host, a camp), battle (a clash) or realm (a garrison) nearest a screen point,
   * within `reach`: its ref.
   */
  pick(x: number, y: number, reach = 22): string | null {
    if (!this.root.enabled) return null;
    const cam = this.stage.camera,
      eye = cam.getPosition(),
      at = new pc.Vec3(),
      out = new pc.Vec3();
    let best: string | null = null,
      bestD = reach;
    for (const m of this.marks) {
      // (Only what faces the eye: a mark on the far side is hidden by the globe.)
      if (m.at.x * eye.x + m.at.y * eye.y + m.at.z * eye.z <= 0) continue;
      at.set(m.at.x, m.at.y, m.at.z);
      cam.camera!.worldToScreen(at, out);
      if (out.z <= 0) continue;
      const d = Math.hypot(out.x - x, out.y - y);
      if (d < bestD) {
        bestD = d;
        best = m.ref;
      }
    }
    return best;
  }

  destroy(): void {
    for (const b of [
      this.heads,
      this.horses,
      this.fallen,
      this.poles,
      this.hulls,
      this.sails,
      this.blades,
      this.flares,
      this.embers,
      this.wrecks,
      ...this.flags,
      ...this.tabards,
      ...this.tents,
      ...this.carHulls,
      ...this.carTurrets,
    ])
      b.destroy();
    this.flags = [];
    this.tabards = [];
    this.tents = [];
    this.carHulls = [];
    this.carTurrets = [];
    this.carSides = [];
  }
}

/**
 * Each realm at peace's garrison by its seat: a short line under its banner — two, three for a
 * great realm's — riders if it rides.
 */
function garrisonFigures(paths: WarPaths): Stood[] {
  const out: Stood[] = [];
  for (const g of paths.garrisons) {
    const up = unit(g.at),
      [t0, t1] = tangents(up),
      files = g.men >= 20000 ? 3 : 2;
    for (let f = 0; f < files; f++) {
      const across = (f - (files - 1) / 2) * 0.006;
      out.push({
        at: {
          x: g.at.x + t0.x * 0.01 + t1.x * across,
          y: g.at.y + t0.y * 0.01 + t1.y * across,
          z: g.at.z + t0.z * 0.01 + t1.z * across,
        },
        up,
        ahead: { x: -t0.x, y: -t0.y, z: -t0.z },
        side: g.side,
        size: 0.55,
        lead: f === Math.floor((files - 1) / 2),
        mounted: g.mounted,
        armoured: g.armoured,
        // (In an armoured garrison every fourth man, counted in its line, is a car.)
        ...(g.armoured && f % 4 === 2 ? { car: true as const } : {}),
      });
    }
  }
  return out;
}

function cross(a: V, b: V): V {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function unit(v: V): V {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** Two directions along the globe's face at a place whose up is `u`. */
function tangents(u: V): [V, V] {
  const a = Math.abs(u.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 },
    t0 = unit({ x: a.y * u.z - a.z * u.y, y: a.z * u.x - a.x * u.z, z: a.x * u.y - a.y * u.x }),
    t1 = { x: u.y * t0.z - u.z * t0.y, y: u.z * t0.x - u.x * t0.z, z: u.x * t0.y - u.y * t0.x };
  return [t0, t1];
}
