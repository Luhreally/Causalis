// What is heard of arms and blasts where they are seen (asked for 2026-11-12: "add synthetic sfx for the missles and new
// firearms ... all the other stuff"; 2026-11-20: "i also dont here the sfx of the muskets"): a battle on its own field or
// before a town, a town's war in its streets and a siege's guns and shells, a raid over it, a fight of the underworld, a
// soldier's fight under the god's hand. Read four times a second while someone is listening (app/main.ts), never in a frame,
// but for the hand's fight, whose shots are seen a step at a time and so are caught as they are drawn: what each is about to
// make in the next moments (view/heard.ts says what, from its own physics), told to app/sound.ts with how far it is from the
// eye and to which side. Nothing here reaches the world, and nothing is made anew as it is read: its lists are its own, kept.
import type { BattleLayer, Stage } from "../render/index.ts";
import {
  BLASTS,
  battleSounds,
  cannonVoice,
  guardVoice,
  looseVoice,
  strikeVoice,
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
/** How long before it lands a shell's fall is heard (s): INCOMING's. */
const COMING = 0.65;
/** The acts of one a blow has just struck home on: he reels under it, or goes down. */
const HIT: ReadonlySet<string> = new Set(["stagger", "fall"]);
/** How long the fighting's din is heard from where its last shots were, when none are heard (ms): a reload and more. */
const DIN_KEPT_MS = 12_000;
/** How far ahead of now each reading hears (s of the wall's clock): past the next reading, so nothing falls between two. */
const AHEAD = 0.32;
/** A load's whistle is heard for at most this much of its fall (s of the wall's clock). */
const WHISTLE_MOST = 2.4;
/** A field gun's firing, of black powder and of smokeless; a shell's burst, a dropped load's, a rocket's (made once). */
const BLACK = cannonVoice(true),
  SMOKELESS = cannonVoice(false),
  SHELL = { mj: BLASTS.shell },
  /** A shell's fall heard before it lands (s), and its voice. */
  INCOMING = { coming: COMING },
  LOAD_BURST = { mj: BLASTS.load },
  ROCKET_BURST = { mj: BLASTS.rocket };
/**
 * Where the hearing is: this share of the way from what the eye looks at toward the eye. Seen from high over a town, a fight
 * looked at is heard as near as it is looked at, and the farther the eye stands off the farther it is heard; its shots come
 * as late as their distance from there makes them.
 */
const EAR_SHARE = 0.3;
/** The most sounds one reading tells (the sound hears the nearest each by itself and the rest as a line's fire). */
export const HEARD_MOST = 384;

/** Who hears what is told: app/sound.ts. */
export type Listener = { heard(list: readonly HeardEvent[], pace: number): void };
type Way = { far: number; pan: number };

/** One clock's stretch heard: where it was heard to last, so each moment is heard once however the readings fall. */
type Heard = { key: unknown; to: number };

/**
 * One firing in a town (its screen's clock, s; where, its metres): what fired it (an arm, by its physics), or a field gun
 * (`kind` "cannon", `black` its powder) or a shell bursting (`kind` "blast").
 */
export type TownShot = {
  t: number;
  x: number;
  z: number;
  arm: string;
  gun?: true;
  kind?: "cannon" | "blast";
  black?: boolean;
};

/** A heard event, kept to be told again (its fields set in place: no list made anew each reading). */
type Slot = { kind: HeardEvent["kind"]; v: HeardEvent["v"]; in: number; far: number; pan: number };

export class Ears {
  private readonly stage: Stage;
  private readonly sound: Listener;
  private readonly pool: Slot[] = [];
  private readonly out: Slot[] = [];
  private readonly sounds: BattleSound[] = [];
  private readonly way: Way = { far: 0, pan: 0 };
  private readonly battleHeard: Heard = { key: null, to: 0 };
  private readonly townHeard: Heard = { key: null, to: 0 };
  private readonly shots: TownShot[] = [];
  private readonly coming: TownShot[] = [];
  private raidKey: unknown = null;
  private readonly bursts = new Set<number>();
  private readonly rockets = new Set<number>();
  private falling = 0;
  /** The hand's fight: each figure's act as last drawn (1: loosing), and the fight it is of. */
  private loosing = new Uint8Array(64);
  /** And whether each was reeling or down under a blow. */
  private struck = new Uint8Array(64);

  private heldKey: unknown = null;
  /** The nearest of the fighting last heard (m), and when (performance.now ms): where the din of it is made. */
  private dinFar = Infinity;
  private dinAt = 0;
  /** Heard so far, by where (the look tools). */
  readonly told = { battle: 0, town: 0, raid: 0, held: 0 };

  /** What the eye looks at (the rig's target; none: the hearing is at the eye), and the hearing, kept. */
  private readonly focus: (() => { x: number; y: number; z: number } | null) | null;
  private readonly earAt = { x: 0, y: 0, z: 0 };

  constructor(
    stage: Stage,
    sound: Listener,
    focus: (() => { x: number; y: number; z: number } | null) | null = null,
  ) {
    this.stage = stage;
    this.sound = sound;
    this.focus = focus;
  }

  /**
   * How far the hearing is from where the fighting is (m): what a war's din comes over. Its armies' din is where they fire, so as far as
   * the nearest of their shots last heard, for a while after (they are there still between their volleys); else as far as what the eye
   * looks at.
   */
  get far(): number {
    if (this.dinFar < Infinity && performance.now() - this.dinAt < DIN_KEPT_MS) return this.dinFar;
    const eye = this.stage.camera.getPosition(),
      t = this.focus?.() ?? null;
    return t ? (EAR_SHARE * Math.hypot(eye.x - t.x, eye.y - t.y, eye.z - t.z)) / M : 0;
  }

  /** What was read told the sound, and where the nearest of it was kept, for the din (far). */
  private tell(pace: number): void {
    const n = this.out.length;
    if (!n) return;
    let near = Infinity;
    for (let i = 0; i < n; i++) near = Math.min(near, this.out[i]!.far);
    this.dinFar = near;
    this.dinAt = performance.now();
    this.sound.heard(this.out, pace);
  }

  /** Where the hearing is now: EAR_SHARE of the way from what the eye looks at toward the eye. */
  private ear(): { x: number; y: number; z: number } {
    const eye = this.stage.camera.getPosition(),
      t = this.focus?.() ?? null,
      e = this.earAt;
    if (!t) {
      e.x = eye.x;
      e.y = eye.y;
      e.z = eye.z;
    } else {
      e.x = t.x + EAR_SHARE * (eye.x - t.x);
      e.y = t.y + EAR_SHARE * (eye.y - t.y);
      e.z = t.z + EAR_SHARE * (eye.z - t.z);
    }
    return e;
  }

  /** One more heard, into a kept slot (none past the most a reading tells). */
  private add(kind: Slot["kind"], v: Slot["v"], at: number, far: number, pan: number): void {
    const n = this.out.length;
    if (n >= HEARD_MOST) return;
    const s = this.pool[n] ?? (this.pool[n] = { kind, v, in: 0, far: 0, pan: 0 });
    s.kind = kind;
    s.v = v;
    s.in = at;
    s.far = far;
    s.pan = pan;
    this.out.push(s);
  }

  /** Where a point of a scene (its units) lies from the hearing: how far (m) and to which side. */
  private from(x: number, y: number, z: number, eye = this.ear()): Way {
    const cam = this.stage.camera,
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
  private stretch(
    h: Heard,
    key: unknown,
    now: number,
    pace: number,
  ): { from: number; to: number } | null {
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
    this.out.length = 0;
    const ear = this.ear();
    for (const e of this.sounds) {
      layer.heardFrom(e.x, e.z, this.way, ear);
      this.add(e.kind, e.v, (e.t - s) / pace, this.way.far, this.way.pan);
    }
    this.told.battle += this.out.length;
    this.tell(pace);
  }

  /**
   * A battle drawn from the god's hand (Phase 61), its figures as drawn this frame: each who has just levelled to fire heard as
   * he fires (a step of the hand's fight at a time: caught where it is drawn, not read ahead). `arms` each side's arm.
   */
  held(
    key: unknown,
    now: BattleNow,
    arms: readonly [string | undefined, string | undefined],
    pace: number,
    layer: BattleLayer,
    guards: readonly [string | undefined, string | undefined] = [undefined, undefined],
  ): void {
    const ts = now.troopers;
    if (key !== this.heldKey || this.loosing.length < ts.length) {
      this.heldKey = key;
      if (this.loosing.length < ts.length) {
        this.loosing = new Uint8Array(ts.length * 2);
        this.struck = new Uint8Array(ts.length * 2);
      }
      // (Those loosing or struck down as the hand's fight is first seen were caught mid-act: not heard again.)
      for (let i = 0; i < ts.length; i++) {
        this.loosing[i] = ts[i]!.act === "loose" ? 1 : 0;
        this.struck[i] = HIT.has(ts[i]!.act) ? 1 : 0;
      }
      return;
    }
    this.out.length = 0;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i]!,
        on = t.act === "loose" && t.size > 0.3 ? 1 : 0,
        hit = HIT.has(t.act) && t.size > 0.3 ? 1 : 0;
      if (on && !this.loosing[i]) {
        const l = looseVoice(arms[t.side]);
        if (l) {
          layer.heardFrom(t.x, t.z, this.way, this.ear());
          this.add(l.kind, l.v, 0, this.way.far, this.way.pan);
        }
      }
      // A blow struck home by hand, as one reels or goes down under it: the striker's arm ringing on what the struck one wears
      // (where his foe's arm fires, he went down to its shot, heard as it fired).
      if (hit && !this.struck[i]) {
        const by = arms[t.side === 0 ? 1 : 0];
        if (!looseVoice(by)) {
          layer.heardFrom(t.x, t.z, this.way, this.ear());
          this.add("clash", strikeVoice(by, undefined), 0, this.way.far, this.way.pan);
          this.add("thud", guardVoice(guards[t.side], undefined), 0.02, this.way.far, this.way.pan);
        }
      }
      this.loosing[i] = on;
      this.struck[i] = hit;
    }
    this.told.held += this.out.length;
    this.tell(Math.max(0.05, pace));
  }

  /**
   * A town's war in its streets: its guns as they fire (render/village.ts shotsBetween, on its clock `clock`, which runs `pace`
   * of its seconds to one of the wall's: the screen's own, or a film's).
   */
  town(
    key: unknown,
    shotsBetween: (c0: number, c1: number, out: TownShot[]) => void,
    clock: number,
    pace = 1,
  ): void {
    const span = this.stretch(this.townHeard, key, clock, pace);
    if (!span) return;
    shotsBetween(span.from, span.to, this.shots);
    this.out.length = 0;
    const ear = this.ear();
    for (const q of this.shots) {
      const w = this.from(q.x * M, 0.15, q.z * M, ear),
        at = (q.t - clock) / pace;
      if (q.kind === "cannon")
        this.add("cannon", q.black === false ? SMOKELESS : BLACK, at, w.far, w.pan);
      else if (q.kind === "blast") this.add("blast", SHELL, at, w.far, w.pan);
      else {
        const l = looseVoice(q.arm);
        if (l) this.add(l.kind, l.v, at, w.far, w.pan);
      }
    }
    // A shell coming down: its rush and whistle as it falls, high where the burst is low, ending as it lands (those landing
    // COMING later, read now).
    shotsBetween(span.from + COMING, span.to + COMING, this.coming);
    for (const q of this.coming) {
      if (q.kind !== "blast") continue;
      const w = this.from(q.x * M, 0.15, q.z * M, ear);
      this.add("whistle", INCOMING, (q.t - COMING - clock) / pace, w.far, w.pan);
    }
    this.told.town += this.out.length;
    this.tell(pace);
  }

  /**
   * A raid over a town, as last drawn (`r`), its clock running `pace` world seconds to one of the wall's: each hit's blast as it
   * first shows, as late as its sound takes; each rocket's roar as it first shows, to where it comes down; a falling load's
   * whistle. And the engines overhead, as loud as they are near and many (what main.ts puts in the air).
   */
  raid(key: unknown, r: RaidNow | null, pace: number): number {
    if (key !== this.raidKey) {
      this.raidKey = key;
      this.bursts.clear();
      this.rockets.clear();
      this.falling = 0;
    }
    if (!r) return 0;
    this.out.length = 0;
    const p = Math.max(0.05, pace);
    for (const b of r.bursts) {
      if (this.bursts.has(b.key)) continue;
      this.bursts.add(b.key);
      const w = this.from(b.x * M, b.y * M, b.z * M);
      this.add("blast", (b.size ?? 1) > 1 ? ROCKET_BURST : LOAD_BURST, -b.s / p, w.far, w.pan);
    }
    for (const k of r.streaks) {
      if (!k.falling || this.rockets.has(k.key)) continue;
      this.rockets.add(k.key);
      const w = this.from(k.ax * M, k.ay * M, k.az * M);
      this.add("rocket", { coming: -k.since / p, speed: k.speed }, 0, w.far, w.pan);
    }
    // (A load's whistle as it begins to fall: the nearest of those newly falling.)
    const more = r.falling.length - this.falling;
    this.falling = r.falling.length;
    if (more > 0)
      for (let i = Math.max(0, r.falling.length - Math.min(more, 3)); i < r.falling.length; i++) {
        const f = r.falling[i]!,
          w = this.from(f.x * M, f.y * M, f.z * M);
        this.add("whistle", { coming: Math.min(WHISTLE_MOST, (5.5 * 0.8) / p) }, 0, w.far, w.pan);
      }
    if (this.out.length) {
      this.told.raid += this.out.length;
      this.sound.heard(this.out, p);
    }
    // The machines' engines: the nearest's loudness, and a little more for each.
    let engines = 0;
    for (const f of r.flyers) {
      const w = this.from(f.x * M, f.y * M, f.z * M),
        near = 1 / (1 + Math.max(0, w.far - 60) / 220);
      engines = Math.max(engines, near) + 0.04 * near;
    }
    return Math.min(1, engines);
  }
}
