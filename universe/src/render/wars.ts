// Wars on the globe (Phase 9 M87): each host a column of tokens under its realm's colours —
// a banner-bearer and those behind, a ship with its sail where the way crosses the sea —
// the defenders' standards at what they hold, and a clash where each battle was fought
// lately: crossed blades over a flare that pulses, the larger the more fell, dimmer as the
// years pass. Instanced, each mark stood upright on the globe's face.
import * as pc from "playcanvas";
import { warTokens, type WarPaths, type WarToken } from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import type { Rgb, Stage } from "./stage.ts";

/** The most tokens and clashes drawn at once. */
const MOST = 160,
  MOST_CLASHES = 48;

type V = { x: number; y: number; z: number };

export class GlobeWars {
  readonly root = new pc.Entity("wars");
  private readonly stage: Stage;
  private readonly box: pc.Mesh;
  private paths: WarPaths | null = null;
  private readonly bodies: InstancedBatch;
  private readonly heads: InstancedBatch;
  private readonly poles: InstancedBatch;
  private readonly hulls: InstancedBatch;
  private readonly sails: InstancedBatch;
  private readonly blades: InstancedBatch;
  private readonly flares: InstancedBatch;
  private readonly embers: InstancedBatch;
  /** Each side's flags, by the colours of the year's wars. */
  private flags: InstancedBatch[] = [];
  /** How many marks were drawn at the last update (for the look tools). */
  drawn = 0;
  /** Where each host and clash stood at the last update, and its page (for picking). */
  private marks: { at: V; ref: string }[] = [];
  /** Where each host's head stood at the last update: its war, and whether the attacker's. */
  private leads: { at: V; ref: string; attacker: boolean }[] = [];

  constructor(stage: Stage, parent: pc.Entity) {
    this.stage = stage;
    this.box = keptMesh(boxMesh(stage));
    const make = (color: Rgb, n: number) =>
      new InstancedBatch(stage, this.box, color, n, this.root);
    this.bodies = make([0.16, 0.14, 0.12], MOST);
    this.heads = make([0.9, 0.72, 0.56], MOST);
    this.poles = make([0.42, 0.3, 0.18], MOST);
    this.hulls = make([0.46, 0.3, 0.16], MOST);
    this.sails = make([0.94, 0.92, 0.84], MOST);
    this.blades = make([0.86, 0.88, 0.92], MOST_CLASHES * 2);
    this.flares = make([1, 0.8, 0.28], MOST_CLASHES * 3);
    this.embers = make([0.66, 0.4, 0.18], MOST_CLASHES * 3);
    parent.addChild(this.root);
  }

  /** The year's wars, as ways over the globe (null: none shown). */
  set(paths: WarPaths | null): void {
    this.paths = paths;
    for (const f of this.flags) f.destroy();
    this.flags = (paths?.colors ?? []).map(
      (c) => new InstancedBatch(this.stage, this.box, c, MOST, this.root),
    );
  }

  /** Put every host and clash where it is at screen time `s` (seconds). */
  update(s: number): void {
    const paths = this.paths;
    if (!paths || !this.root.enabled) return;
    const tokens = warTokens(paths, s).slice(0, MOST),
      walkers = tokens.filter((t) => !t.ship),
      ships = tokens.filter((t) => t.ship),
      // (A token shrinks toward the ground as its march ends, and grows as it begins.)
      lift = (t: WarToken, h: number): V => ({
        x: t.at.x + t.up.x * h * t.size,
        y: t.at.y + t.up.y * h * t.size,
        z: t.at.z + t.up.z * h * t.size,
      }),
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
      };
    // On foot: a body, the banner-bearer larger; over the sea: a hull and its sail.
    this.bodies.setBasis(walkers.length, (i, out) => {
      const t = walkers[i]!,
        h = t.lead ? 0.022 : 0.014;
      stand(
        out,
        lift(t, h / 2),
        t.up,
        t.ahead,
        t.lead ? 0.016 : 0.01,
        h,
        t.lead ? 0.01 : 0.008,
        t.size,
      );
    });
    // (A head on each, so a token reads as one who marches.)
    this.heads.setBasis(walkers.length, (i, out) => {
      const t = walkers[i]!,
        h = t.lead ? 0.022 : 0.014,
        r = t.lead ? 0.011 : 0.008;
      stand(out, lift(t, h + r / 2), t.up, t.ahead, r, r, r, t.size);
    });
    this.hulls.setBasis(ships.length, (i, out) => {
      const t = ships[i]!;
      stand(out, lift(t, 0.003), t.up, t.ahead, 0.011, 0.006, 0.028, t.size);
    });
    this.sails.setBasis(ships.length, (i, out) => {
      const t = ships[i]!;
      stand(out, lift(t, 0.016), t.up, t.ahead, 0.002, 0.02, 0.016, t.size);
    });
    // The banners: a pole and a flag in its side's colour, over the lead of each column
    // and over every ship.
    const bearers = tokens.filter((t) => t.lead || t.ship);
    this.poles.setBasis(bearers.length, (i, out) => {
      const t = bearers[i]!;
      stand(out, lift(t, 0.03), t.up, t.ahead, 0.0022, 0.05, 0.0022, t.size);
    });
    this.flags.forEach((batch, side) => {
      const mine = bearers.filter((t) => t.side === side);
      batch.setBasis(mine.length, (i, out) => {
        const t = mine[i]!,
          at = lift(t, 0.047),
          back = { x: -t.ahead.x * 0.012, y: -t.ahead.y * 0.012, z: -t.ahead.z * 0.012 };
        stand(
          out,
          { x: at.x + back.x, y: at.y + back.y, z: at.z + back.z },
          t.up,
          t.ahead,
          0.002,
          0.014,
          0.024,
          t.size,
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
            size = c.size * (pulse ? 0.85 + 0.35 * Math.abs(Math.sin(s * 3 + i)) : 0.7);
          stand(out, c.at, up, ahead, size * 0.28, 0.003, size * 1.6);
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
        h = 0.05;
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
    this.drawn = tokens.length + clashes.length;
    // (A host's marks stand for its war; a clash for its battle.)
    this.marks = [
      ...clashes.map((c) => ({ at: c.at, ref: c.event })),
      ...tokens.filter((k) => k.lead).map((k) => ({ at: k.at, ref: k.ref })),
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

  /** The war (a host) or battle (a clash) nearest a screen point, within `reach`: its ref. */
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
      this.bodies,
      this.heads,
      this.poles,
      this.hulls,
      this.sails,
      this.blades,
      this.flares,
      this.embers,
      ...this.flags,
    ])
      b.destroy();
    this.flags = [];
  }
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
