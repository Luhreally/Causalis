// Whatever fires on screen is heard (2026-11-20, the owner: "i also dont here the sfx of the muskets"): every gun is heard as a
// gun by its physics; each view that draws musket fire tells the sound each shot, when it is drawn and from where; the sound
// hears the nearest each by itself and the rest as a line's fire, never more voices than its rules let it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import type {
  BattleNear,
  BattleSideNear,
  SeaFightNear,
  SeaFightSide,
} from "../../src/bridge/index.ts";
import {
  ARM_LOOKS,
  MOMENTS,
  battleAt,
  battleSounds,
  looseVoice,
  newBattle,
  newSeaFight,
  seaBroadsides,
  seaHullAt,
  type BattleNow,
  type SeaBroadside,
  type SeaHullNow,
  type TownWarScene,
} from "../../src/view/index.ts";
import { batteryFlashing, firesBetween } from "../../src/render/townwar.ts";
import { Ears, type TownShot } from "../../src/app/ears.ts";
import type { HeardEvent, Sound as SoundClass } from "../../src/app/sound.ts";
import { CUE_RULES } from "../../src/app/sound-mix.ts";

// (app/sound.ts brings in its stylesheet, as the page does: here nothing.)
register(
  `data:text/javascript,${encodeURIComponent(
    'export async function load(url, context, next) { return url.endsWith(".css") ? { format: "module", source: "", shortCircuit: true } : next(url, context); }',
  )}`,
);
const { Sound } = (await import("../../src/app/sound.ts")) as { Sound: typeof SoundClass };

const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");

const side = (name: string, arm: string): BattleSideNear => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded: 2400,
  fallen: 300,
  host: { arm, guard: "shield", mount: "" },
  kit: `${arm}s, on foot`,
});
const muskets = (): BattleNear =>
  ({
    event: "ev:0:muskets",
    war: "war:1",
    title: "The battle at the test land",
    cell: 1,
    land: "The test land",
    year: 721,
    attacker: side("Ash", "musket"),
    defender: { ...side("Elm", "musket"), color: [0.2, 0.3, 0.85] },
    won: true,
    outcome: "field",
    civil: null,
    hills: false,
    river: false,
    walls: 0,
    town: null,
    figure: null,
    plan: {
      seed: "test battle",
      ages: [
        { index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true },
      ] as never,
      lineages: [],
    },
  }) as BattleNear;

/** A stage whose eye stands at the middle, looking along +z with its right +x; a layer that lays the field as it is. */
const stage = {
  camera: { getPosition: () => ({ x: 0, y: 0, z: 0 }), right: { x: 1, y: 0, z: 0 } },
} as never;
const layer = {
  heardFrom(x: number, z: number, out: { far: number; pan: number }) {
    out.far = Math.hypot(x, z);
    out.pan = Math.sign(x);
  },
} as never;
/** What a listener is told, copied (the ears keep their slots and fill them again). */
const listener = () => {
  const told: { kind: string; in: number; far: number; pace: number }[] = [];
  return {
    told,
    heard(list: readonly HeardEvent[], pace: number) {
      for (const e of list) told.push({ kind: e.kind, in: e.in, far: e.far, pace });
    },
  };
};

test("every arm that fires powder and shot is heard as a gun; a beam as a beam, a bow as a bow", () => {
  for (const [arm, look] of Object.entries(ARM_LOOKS)) {
    const l = looseVoice(arm);
    if (look.looses === "none") assert.equal(l, null, arm);
    else if (look.beam) assert.equal(l?.kind, "zap", arm);
    else if (look.looses === "shot") {
      assert.equal(l?.kind, "gun", `${arm} is heard as a gun`);
      assert.ok((l?.v.joules ?? 0) > 100 && (l?.v.speed ?? 0) > 100, `${arm}: its ball's energy`);
    } else assert.ok(l?.kind === "bow" || l?.kind === "dart", arm);
  }
  for (const arm of ["musket", "rifle", "repeater"]) {
    const l = looseVoice(arm)!;
    assert.equal(l.kind, "gun");
    assert.equal(l.v.black, true, `${arm}: black powder`);
  }
});

test("a battle of muskets is heard shot by shot as its field draws them, read ahead in step with its clock", () => {
  const field = newBattle(muskets(), 120),
    shots = field.arrows.filter((a) => a.shot),
    all = battleSounds(field, null, 0, 200, null).filter((e) => e.kind === "gun");
  assert.ok(shots.length > 50, `muskets fired on the field (${shots.length})`);
  assert.equal(all.length, shots.length, "each shot drawn is a gun heard");
  // The ears, read four times a second at its own pace, tell each shot once, as late as it is from now.
  const l = listener(),
    ears = new Ears(stage, l),
    pace = 2;
  let s = MOMENTS.arrows - 2;
  const now: BattleNow = battleAt(field, s);
  for (let i = 0; i < 4 * 30; i++, s += 0.25 * pace)
    ears.battle(field, null, field.near, now, s, pace, layer);
  const heard = l.told.filter((e) => e.kind === "gun"),
    fired = shots.filter((a) => a.at > MOMENTS.arrows - 2 && a.at <= s + 0.32 * pace);
  assert.equal(heard.length, fired.length, "each fired in the stretch heard once");
  assert.ok(
    heard.every((e) => e.in >= -0.01 && e.in <= 0.33 && e.far > 0 && e.pace === pace),
    "each told as it is about to be drawn, from where it is",
  );
  assert.ok(ears.told.battle >= heard.length);
});

test("a soldier's fight under the hand: each who levels to fire is heard once as he fires", () => {
  const field = newBattle(muskets(), 40),
    base = battleAt(field, 30),
    l = listener(),
    ears = new Ears(stage, l),
    drawn = (loosing: Set<number>): BattleNow => ({
      ...base,
      troopers: base.troopers.map((t) => ({
        ...t,
        act: loosing.has(t.id) ? "loose" : "stand",
        size: 1,
      })),
    }),
    arms = ["musket", "musket"] as const;
  ears.held("k", drawn(new Set([1])), arms, 1, layer);
  assert.equal(l.told.length, 0, "one loosing as the fight is first seen is not heard again");
  ears.held("k", drawn(new Set([1, 2, 3])), arms, 1, layer);
  ears.held("k", drawn(new Set([1, 2, 3])), arms, 1, layer);
  assert.equal(l.told.length, 2, "two newly levelled: two shots, once each");
  ears.held("k", drawn(new Set()), arms, 1, layer);
  ears.held("k", drawn(new Set([2])), arms, 1, layer);
  assert.equal(l.told.length, 3, "levelled again: heard again");
  assert.ok(l.told.every((e) => e.kind === "gun"));
});

test("a town's war: each shot, each field gun and each shell as its layer draws them", () => {
  const l = listener(),
    ears = new Ears(stage, l),
    fire = (c0: number, c1: number, out: TownShot[]) => {
      out.length = 0;
      for (let t = Math.floor(c0) + 1; t <= c1; t++) out.push({ t, x: 30, z: 0, arm: "musket" });
      out.push({ t: c1, x: 50, z: 0, arm: "", kind: "cannon", black: true });
      out.push({ t: c1, x: 50, z: 9, arm: "", kind: "blast" });
    };
  for (let c = 100; c < 110; c += 0.25) ears.town("war", fire, c);
  const kinds = new Set(l.told.map((e) => e.kind));
  assert.deepEqual([...kinds].sort(), ["blast", "cannon", "gun"]);
  assert.equal(
    l.told.filter((e) => e.kind === "gun").length,
    10,
    "a shot a second for ten seconds",
  );
  // The field guns standing off: heard as their flash begins, each turn of it.
  const scene = {
      battery: [
        { x: 0, z: 0, yaw: 0 },
        { x: 4, z: 0, yaw: 0 },
      ],
      shells: [{ x: 1, z: 1 }],
    } as unknown as TownWarScene,
    out: TownShot[] = [];
  firesBetween(scene, 10, 40, true, out);
  const cannons = out.filter((q) => q.kind === "cannon");
  let rises = 0;
  for (let n = 0; n < 2; n++)
    for (let s = 10; s < 40; s += 0.001)
      if (batteryFlashing(s, n) && !batteryFlashing(s - 0.001, n)) rises++;
  assert.equal(cannons.length, rises, "a field gun heard each time its flash is drawn beginning");
  for (const q of cannons) {
    const n = q.x === 0 ? 0 : 1;
    assert.ok(batteryFlashing(q.t + 0.002, n) && !batteryFlashing(q.t - 0.002, n), "at its flash");
  }
  assert.equal(
    out.filter((q) => q.kind === "blast").length,
    Math.floor(40 / 0.7) - Math.floor(10 / 0.7),
  );
});

test("the hearing stands a third of the way from what is looked at toward the eye", () => {
  const high = {
      camera: { getPosition: () => ({ x: 0, y: 30, z: 0 }), right: { x: 1, y: 0, z: 0 } },
    } as never,
    one = (c0: number, c1: number, out: TownShot[]) => {
      out.length = 0;
      out.push({ t: (c0 + c1) / 2, x: 0, z: 0, arm: "musket" });
    },
    at = (focus: (() => { x: number; y: number; z: number }) | null) => {
      const l = listener(),
        ears = new Ears(high, l, focus);
      ears.town("war", one, 10);
      return l.told[0]!.far;
    },
    eye = at(null),
    looked = at(() => ({ x: 0, y: 0, z: 0 }));
  // (The eye 30 units, 300 m, over the shot: heard from 300 m at the eye, from 90 m where the hearing is.)
  assert.ok(Math.abs(eye - 300 + 1.5) < 1, `from the eye ${eye}`);
  assert.ok(Math.abs(looked - 0.3 * 300 + 1.5) < 1, `from the hearing ${looked}`);
});

test("a meeting of fleets: each broadside heard as she is drawn firing", () => {
  const fleet = (name: string): SeaFightSide =>
      ({
        ref: `pol:0:${name}`,
        name,
        color: [0.8, 0.2, 0.2],
        tons: 30000,
        sunk: 3000,
        flagship: `${name}'s Pride`,
        flagLost: false,
        led: null,
        ledRef: null,
        rig: "tall",
        guns: true,
        ships: "tall ships",
      }) as SeaFightSide,
    near = {
      event: "ev:0:77",
      war: "war:0:3",
      title: "The fleets meet",
      year: 721,
      cell: 4,
      off: "Test's land",
      sides: [fleet("Aa"), fleet("Bb")],
      won: 0,
      kind: "rocky",
    } as SeaFightNear,
    field = newSeaFight(near, 20),
    at: SeaHullNow = { x: 0, z: 0, yaw: 0, sunk: 0, tip: 0, fired: -1 },
    out: SeaBroadside[] = [];
  // Drawn: a broadside's flash wherever a hull's `fired` begins again (from none, or wrapping round) at its gun's moment; one
  // coming into the fight between two firings shows her smoke drifting, no flash: none fired then.
  let drawn = 0;
  const was = field.hulls.map(() => -1);
  for (let s = 0; s <= 80; s += 0.01)
    field.hulls.forEach((h, i) => {
      const f = seaHullAt(field, h, s, at).fired;
      if (f >= 0 && f < 0.011 && (was[i]! < 0 || f < was[i]!)) drawn++;
      was[i] = f;
    });
  let heard = 0;
  for (let s = 0; s < 80; s += 0.25) heard += seaBroadsides(field, s, s + 0.25, out, at);
  assert.ok(drawn > 50, `broadsides drawn (${drawn})`);
  assert.ok(Math.abs(heard - drawn) <= 2, `each drawn heard: ${heard} heard of ${drawn}`);
});

test("the sound hears a line's fire: the nearest each by itself, the rest together, never past its rules", () => {
  const g = globalThis as { document?: unknown };
  const had = g.document;
  g.document = { hidden: false };
  try {
    const s = new Sound(),
      played: string[] = [],
      t = s as unknown as Record<string, unknown>;
    t.graph = {
      master: { gain: { value: 0 } },
      cue: (c: string) => {
        played.push(c);
        return true;
      },
    };
    t.ctx = { state: "running", currentTime: 0 };
    const list: HeardEvent[] = Array.from({ length: 300 }, (_, i) => ({
      kind: "gun",
      v: looseVoice("musket")!.v,
      in: (i % 30) * 0.01,
      far: 60 + i,
      pan: 0,
    }));
    s.heard(list, 1);
    const guns = played.filter((c) => c === "gun").length,
      volleys = played.filter((c) => c === "volley").length;
    assert.ok(guns >= 1 && guns <= CUE_RULES.gun.most, `the nearest by themselves (${guns})`);
    assert.equal(volleys, 1, "the rest as one line's fire");
    assert.equal(s.state().played.gun + s.state().played.volley, guns + volleys);
  } finally {
    g.document = had;
  }
});

test("every view that draws musket fire tells the sound its shots, through the ears or the same path", () => {
  const main = src("app/main.ts"),
    street = src("app/street-fight.ts"),
    sea = src("app/sea-fight.ts");
  // The battle film, a battle before a town, the town's war and its siege's guns, a raid, and the hand's fight.
  assert.match(main, /new Ears\(stage, sound, \(\) => rig\.target\)/);
  assert.match(main, /ears\.battle\(\s*fight\.field/, "the battle film");
  assert.match(main, /ears\.battle\(\s*P\.field/, "a battle before the town");
  assert.match(
    main,
    /ears\.town\(war, shotsBetween/,
    "the town's war, its siege's guns and shells",
  );
  assert.match(main, /ears\.raid\(/, "a raid");
  assert.match(main, /ears\.held\(\s*fight\.held/, "the hand's fight on its field");
  assert.match(main, /ears\.held\(\s*placed,/, "the hand's fight before the town");
  // A fight of the underworld: its shooters drawn and heard by the town's war (render/village.ts gunsOf, shotsBetween).
  assert.match(street, /village\.gunsOf = scene\.soldiers/);
  assert.match(
    src("render/village.ts"),
    /const troops = this\.gunsOf \?\? this\.warScene\?\.soldiers/,
  );
  assert.match(src("render/village.ts"), /firesBetween\(this\.warScene/);
  // A meeting of fleets: its broadsides as drawn.
  assert.match(sea, /seaBroadsides\(field/);
  // No view plays a gun by name alone, off what it draws (as a musket of no physics, or once in a while).
  for (const f of ["app/main.ts", "app/street-fight.ts", "app/sea-fight.ts"])
    assert.doesNotMatch(src(f), /sound\.cue\("gun"/, f);
});
