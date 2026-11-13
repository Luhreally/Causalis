// What is heard of arms and blasts where they are seen (asked for 2026-11-12: "add synthetic sfx for the missles and new
// firearms ... all the other stuff"): a battle on its own field or before a town, a town's war in its streets, a raid over it.
// Read four times a second while someone is listening (app/main.ts), never in a frame: what each is about to make in the next
// moments (view/heard.ts says what, from its own physics), told to app/sound.ts with how far it is from the eye and to which
// side. Nothing here reaches the world.
import type { BattleLayer, Stage } from "../render/index.ts";
import {
  BLASTS,
  battleSounds,
  looseVoice,
  type BattleField,
  type BattleNow,
  type BattleSound,
  type Blows,
  type RaidNow,
} from "../view/index.ts";
import type { BattleNear } from "../bridge/index.ts";
import type { HeardEvent } from "./sound.ts";

/** A scene's units to the metre (the village's and the meadow's). */
const M = 0.1;
/** How far ahead of now each reading hears (s of the wall's clock): past the next reading, so nothing falls between two. */
const AHEAD = 0.32;
/** A load's whistle is heard for at most this much of its fall (s of the wall's clock). */
const WHISTLE_MOST = 2.4;

type Listener = { tell(list: readonly HeardEvent[], pace: number): void };
type Way = { far: number; pan: number };

/** One clock's stretch heard: where it was heard to last, so each moment is heard once however the readings fall. */
type Heard = { key: unknown; to: number };

export class Ears {
  private readonly stage: Stage;
  private readonly sound: Listener;
  private readonly out: HeardEvent[] = [];
  private readonly sounds: BattleSound[] = [];
  private readonly way: Way = { far: 0, pan: 0 };
  private battleHeard: Heard = { key: null, to: 0 };
  private townHeard: Heard = { key: null, to: 0 };
  private readonly shots: { t: number; x: number; z: number; arm: string; gun?: true }[] = [];
  private raidKey: unknown = null;
  private readonly bursts = new Set<number>();
  private readonly rockets = new Set<number>();
  private falling = 0;
  /** Heard so far, by where (the look tools). */
  readonly told = { battle: 0, town: 0, raid: 0 };

  constructor(stage: Stage, sound: Listener) {
    this.stage = stage;
    this.sound = sound;
  }

  /** Where a point of a scene (its units) lies from the eye: how far (m) and to which side. */
  private from(x: number, y: number, z: number): Way {
    const cam = this.stage.camera,
      eye = cam.getPosition(),
      right = cam.right,
      dx = x - eye.x,
      dy = y - eye.y,
      dz = z - eye.z,
      d = Math.hypot(dx, dy, dz);
    this.way.far = d / M;
    this.way.pan = d > 1e-6 ? (dx * right.x + dy * right.y + dz * right.z) / d : 0;
    return this.way;
  }

  /** The stretch of a clock to hear now: from where it was heard to, unless it has jumped; to a little past now. */
  private stretch(h: Heard, key: unknown, now: number, pace: number): { from: number; to: number } | null {
    const to = now + AHEAD * pace;
    if (h.key !== key || h.to < now - 1.5 * pace - 0.5 || h.to > to + 0.5) {
      h.key = key;
      h.to = now;
    }
    if (pace <= 0 || to <= h.to) return null;
    const from = Math.max(h.to, now);
    h.to = to;
    return { from, to };
  }

  /**
   * A battle at second `s` of its field, its clock running `pace` of its seconds to one of the wall's: what it makes up to a
   * little past now, each from where it is on the field as `layer` lays it (its own field, or before a town).
   */
  battle(
    field: BattleField,
    blows: Blows | null,
    near: BattleNear,
    now: BattleNow | null,
    s: number,
    pace: number,
    layer: BattleLayer,
  ): void {
    const span = this.stretch(this.battleHeard, field, s, pace);
    if (!span) return;
    const sides = [near.attacker, near.defender].map((x) => ({
      arm: x.host?.arm,
      guard: x.host?.guard,
      stuff: x.stuffs?.arm,
      guardStuff: x.stuffs?.guard,
    })) as [object, object];
    battleSounds(field, blows, span.from, span.to, now, sides, this.sounds);
    const out = this.out;
    out.length = 0;
    for (const e of this.sounds) {
      layer.heardFrom(e.x, e.z, this.way);
      out.push({ kind: e.kind, v: e.v, in: (e.t - s) / pace, far: this.way.far, pan: this.way.pan });
    }
    this.told.battle += out.length;
    this.sound.tell(out, pace);
  }

  /** A town's war in its streets: its guns as they fire (render/village.ts shotsBetween, on the screen's clock). */
  town(
    key: unknown,
    shotsBetween: (c0: number, c1: number, out: Ears["shots"]) => void,
    clock: number,
  ): void {
    const span = this.stretch(this.townHeard, key, clock, 1);
    if (!span) return;
    shotsBetween(span.from, span.to, this.shots);
    const out = this.out;
    out.length = 0;
    for (const q of this.shots) {
      const l = looseVoice(q.arm);
      if (!l) continue;
      const w = this.from(q.x * M, 0.15, q.z * M);
      out.push({ kind: l.kind, v: l.v, in: q.t - clock, far: w.far, pan: w.pan });
    }
    this.told.town += out.length;
    this.sound.tell(out, 1);
  }

  /**
   * A raid over a town, as last drawn (`r`), its clock running `pace` world seconds to one of the wall's: each hit's blast as it
   * first shows, as late as its sound takes; each rocket's roar as it first shows, to where it comes down; a falling load's
   * whistle. And the engines overhead, as loud as they are near and many (what main.ts puts in the air).
   */
  raid(key: unknown, r: RaidNow | null, pace: number): { engines: number } {
    if (key !== this.raidKey) {
      this.raidKey = key;
      this.bursts.clear();
      this.rockets.clear();
      this.falling = 0;
    }
    if (!r) return { engines: 0 };
    const out = this.out;
    out.length = 0;
    const p = Math.max(0.05, pace);
    for (const b of r.bursts) {
      if (this.bursts.has(b.key)) continue;
      this.bursts.add(b.key);
      const w = this.from(b.x * M, b.y * M, b.z * M);
      out.push({
        kind: "blast",
        v: { mj: (b.size ?? 1) > 1 ? BLASTS.rocket : BLASTS.load },
        in: -b.s / p,
        far: w.far,
        pan: w.pan,
      });
    }
    for (const k of r.streaks) {
      if (!k.falling || this.rockets.has(k.key)) continue;
      this.rockets.add(k.key);
      const w = this.from(k.ax * M, k.ay * M, k.az * M);
      out.push({
        kind: "rocket",
        v: { coming: -k.since / p, speed: k.speed },
        in: 0,
        far: w.far,
        pan: w.pan,
      });
    }
    // (A load's whistle as it begins to fall: the nearest of those newly falling.)
    const more = r.falling.length - this.falling;
    this.falling = r.falling.length;
    if (more > 0)
      for (const f of r.falling.slice(-Math.min(more, 3))) {
        const w = this.from(f.x * M, f.y * M, f.z * M);
        out.push({
          kind: "whistle",
          v: { coming: Math.min(WHISTLE_MOST, (5.5 * 0.8) / p) },
          in: 0,
          far: w.far,
          pan: w.pan,
        });
      }
    if (out.length) {
      this.told.raid += out.length;
      this.sound.tell(out, p);
    }
    // The machines' engines: the nearest's loudness, and a little more for each.
    let engines = 0;
    for (const f of r.flyers) {
      const w = this.from(f.x * M, f.y * M, f.z * M),
        near = 1 / (1 + Math.max(0, w.far - 60) / 220);
      engines = Math.max(engines, near) + 0.04 * near;
    }
    return { engines: Math.min(1, engines) };
  }
}
