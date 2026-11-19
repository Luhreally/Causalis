// How a fight of the underworld is looked at (view/street-shots.ts; asked for 2026-11-19: "the gang war camreas i guess move too
// fast between battles like i cant see the whole scene"): a clash lasts by how much happens in it and never less than several
// seconds; the eye stays on one until it is decided and a breath more; the way to the next can be followed at any speed; a
// stand fitted to its men has every one of them in the screen left free, on a phone held upright, on its side, and on a desk.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOUGHT_LEAST,
  FOUGHT_MOST,
  LINGER,
  STAND_OFF,
  TRAVEL,
  WIDE_MORE,
  clashBounds,
  clashFacing,
  clashFought,
  eyeSees,
  fitEye,
  nextClashFrom,
  shareSeen,
  shotStarts,
  shotStep,
  streetShot,
  travelSeconds,
  type EyeFrame,
} from "../../src/view/street-shots.ts";
import type { StreetFigure, StreetScript } from "../../src/view/streetfight.ts";

/** A scene made by hand: so many clashes, one after another as the rule has them, so many men of each side at each. */
function scene(clashes: number, each: number): StreetScript {
  const cs: { spot: { x: number; z: number; why: "crossing" }; from: number; to: number }[] = [],
    figures: StreetFigure[] = [];
  for (let k = 0, at = 2; k < clashes; k++) {
    const to = at + STAND_OFF + clashFought(2 * each, true);
    cs.push({ spot: { x: k * 40, z: 0, why: "crossing" }, from: at, to });
    for (const side of [0, 1] as const)
      for (let m = 0; m < each; m++) {
        const sign = side ? -1 : 1,
          meet = { x: k * 40 + sign * 0.85, z: (m - (each - 1) / 2) * 2.4 },
          place = { x: meet.x + sign * 2.6, z: meet.z };
        figures.push({
          side,
          slot: k * each + m,
          path: [{ x: place.x + sign * 30, z: place.z }, place],
          face: { x: k * 40, z: meet.z },
          meet,
          from: at - 3.2,
          arrive: at,
          fight: [at + STAND_OFF, to],
          falls: null,
          leaves: to,
          clash: k,
        });
      }
    at = nextClashFrom(to);
  }
  return {
    kind: "turf",
    hour: 0.7,
    figures,
    clashes: cs,
    posts: [],
    drawn: [clashes * each, clashes * each],
    falls: [0, 0],
    quiet: cs[cs.length - 1]!.to,
    end: cs[cs.length - 1]!.to + 16,
    bystanders: [],
    carriers: [false, false],
    engines: false,
  };
}

test("a clash lasts by how much happens in it: longer the more are in it and where any fall, several seconds at the least", () => {
  assert.ok(FOUGHT_LEAST >= 5, "several seconds at the least");
  for (let n = 0; n <= 40; n++) {
    const quiet = clashFought(n, false),
      bloody = clashFought(n, true);
    assert.ok(quiet >= FOUGHT_LEAST && bloody <= FOUGHT_MOST, `${n}: ${quiet} … ${bloody}`);
    assert.ok(bloody >= quiet, `${n}: no shorter where they fall`);
    if (n) assert.ok(quiet >= clashFought(n - 1, false), `${n}: no shorter with one more`);
  }
  assert.ok(clashFought(14, true) > clashFought(4, true), "fourteen take longer than four");
  // (All of a look: the eye's way over, their standing off, the fight, the breath after. Never under ten seconds.)
  assert.ok(TRAVEL + STAND_OFF + FOUGHT_LEAST + LINGER >= 10);
});

test("the eye stays on a clash until it is decided and a breath more, and the next begins only once it has gone over", () => {
  const s = scene(5, 6);
  for (let k = 0; k < s.clashes.length; k++) {
    const c = s.clashes[k]!;
    // (From before its men come to after it is decided: this clash and no other.)
    for (let t = c.from - 1; t <= c.to + LINGER - 0.05; t += 0.25)
      assert.equal(streetShot(s, t)!.clash, k, `clash ${k} at ${t.toFixed(2)}s`);
    // (Seen whole as they come and stand off and for a moment of the fight; then nearer, to its end.)
    assert.equal(streetShot(s, c.from)!.wide, true);
    assert.equal(streetShot(s, c.from + STAND_OFF + WIDE_MORE - 0.1)!.wide, true);
    assert.equal(streetShot(s, c.from + STAND_OFF + WIDE_MORE + 0.1)!.wide, false);
    assert.equal(streetShot(s, c.to)!.wide, false);
    if (k) {
      const before = s.clashes[k - 1]!;
      assert.ok(
        c.from >= before.to + LINGER + TRAVEL - 1e-9,
        `clash ${k} begins after the eye is there`,
      );
      // (No one of it closes on his man before the eye has come.)
      for (const g of s.figures)
        if (g.clash === k) assert.ok(g.fight![0] >= before.to + LINGER + TRAVEL);
    }
  }
  // (Others begun meanwhile do not take it: a scene whose clashes ran over one another is still looked at one at a time.)
  const over = {
    ...s,
    clashes: s.clashes.map((c, k) => ({ ...c, from: 2 + k * 6, to: 14 + k * 6 })),
  };
  assert.equal(streetShot(over, 9)!.clash, 0);
  assert.equal(streetShot(over, 14 + LINGER - 0.1)!.clash, 0);
  assert.equal(streetShot(over, 14 + LINGER + 0.1)!.clash, 1);
  // (After the last it stays there.)
  assert.equal(streetShot(s, s.end)!.clash, s.clashes.length - 1);
  assert.equal(streetShot({ ...s, clashes: [] }, 3), null);
});

test("the next clash and the one before: a step is to where the eye turns to it; a few seconds in, back is this one again", () => {
  const s = scene(4, 5),
    starts = shotStarts(s);
  assert.equal(starts[0], 0);
  for (let k = 1; k < starts.length; k++) assert.equal(starts[k], s.clashes[k - 1]!.to + LINGER);
  assert.equal(shotStep(s, 1, 1), starts[1]);
  assert.equal(shotStep(s, starts[1]! + 5, 1), starts[2]);
  assert.equal(shotStep(s, starts[3]! + 1, 1), null, "none after the last");
  assert.equal(shotStep(s, starts[2]! + 5, -1), starts[2], "a few seconds in: this one again");
  assert.equal(shotStep(s, starts[2]! + 1, -1), starts[1], "at its beginning: the one before");
  assert.equal(shotStep(s, 1, -1), 0);
  // (Held, a step is to where that clash's men have come and stand off; and back from there is the one before, not this again.)
  const held = shotStep(s, 1, 1, true)!;
  assert.ok(held > s.clashes[1]!.from && held < s.clashes[1]!.from + STAND_OFF);
  assert.equal(streetShot(s, held)!.clash, 1);
  assert.equal(streetShot(s, held)!.wide, true, "held on all of it");
  for (const g of s.figures) if (g.clash === 1) assert.ok(g.arrive <= held && g.fight![0] > held);
  assert.equal(streetShot(s, shotStep(s, held, -1, true)!)!.clash, 0);
  assert.ok(shotStep(s, held, -1, true)! > s.clashes[0]!.from);
  assert.equal(shotStep(s, held + 5, -1, true), held, "a few seconds on: this one again");
  // (Soldiers on their way in for half a minute before the first post is met: next is that post, not the one after it.)
  const army: StreetScript = {
    ...s,
    kind: "army",
    clashes: s.clashes.map((c) => ({ ...c, from: c.from + 30, to: c.to + 30 })),
  };
  assert.equal(streetShot(army, shotStep(army, 5, 1)!)!.clash, 0);
  assert.ok(shotStep(army, 5, 1)! < army.clashes[0]!.from);
  assert.equal(shotStep(army, 5, 1, true), army.clashes[0]!.from + (held - s.clashes[1]!.from));
  assert.equal(shotStep(army, 5, -1), 0);
  assert.equal(streetShot(army, shotStep(army, army.clashes[0]!.from, 1)!)!.clash, 1);
  // (Each step lands on the clash asked for.)
  for (let k = 1; k < starts.length; k++) assert.equal(streetShot(s, starts[k]!)!.clash, k);
});

test("the way between two can be followed at every speed of its clock, and the eye is there before they close", () => {
  for (const pace of [0, 0.5, 1, 2, 4]) {
    const t = travelSeconds(pace);
    assert.ok(t >= 1.2 && t <= 3, `${pace}×: ${t}s`);
    // (Left a breath after the last was decided, it is there before the next two sides close: they stand off first.)
    if (pace > 0) assert.ok(t * pace <= TRAVEL + STAND_OFF + 1e-9, `${pace}×: there in time`);
  }
  assert.equal(travelSeconds(1), TRAVEL);
});

const SCREENS = [
  { name: "a phone held upright", w: 430, h: 932, caption: 175 },
  { name: "a phone on its side", w: 932, h: 430, caption: 150 },
  { name: "a desk", w: 1440, h: 900, caption: 150 },
];
const frameOf = (
  screen: (typeof SCREENS)[number],
  yaw: number,
  pitch: number,
  wide: boolean,
): EyeFrame => ({
  yaw,
  pitch,
  tan: Math.tan((45 * Math.PI) / 360),
  aspect: screen.w / screen.h,
  lo: -1 + (2 * screen.caption) / screen.h + (wide ? 0.1 : 0.04),
  hi: 1 - (2 * 52) / screen.h - (wide ? 0.1 : 0.04),
  side: wide ? 0.78 : 0.94,
  high: 6.5,
  about: 3.5,
  level: 1.2,
  min: wide ? 58 : 44,
  max: 120,
});

test("a stand fitted to a clash has every one of its men in the screen left free: upright, on its side, on a desk", () => {
  const s = scene(3, 9);
  for (const screen of SCREENS)
    for (const wide of [true, false])
      for (const yaw of [0, 45, 90, 200, 315])
        for (const pitch of [-32, -46, -56, -80]) {
          const f = frameOf(screen, yaw, pitch, wide),
            pts = clashBounds(s, 1, wide),
            fit = fitEye(pts, f),
            what = `${screen.name}, ${wide ? "whole" : "nearer"}, turned ${yaw}, tilted ${pitch}`;
          assert.ok(fit.fits, `${what}: within its reach`);
          assert.equal(shareSeen(pts, f, fit), 1, `${what}: all of them`);
          // (Foot and head of each above the caption, under the corner, inside the sides; none behind the eye.)
          for (const p of pts)
            for (const high of [0, f.high]) {
              const at = eyeSees(f, fit, p, high);
              assert.ok(
                at.z > 0 && Math.abs(at.x) <= f.side && at.y >= f.lo - 1e-6 && at.y <= f.hi + 1e-6,
                what,
              );
            }
          // (And no further off than it must be: nearer by a tenth, someone is out; or it is as near as it may stand.)
          const nearer = { ...fit, distance: fit.distance * 0.9 };
          assert.ok(
            fit.distance <= f.min + 1e-6 || shareSeen(pts, f, nearer) < 1,
            `${what}: ${fit.distance.toFixed(1)} m is as near as holds them`,
          );
        }
  // (Seen whole it has where they stand off as well as where they close: more of the street than nearer.)
  assert.ok(clashBounds(s, 1, true).length > clashBounds(s, 1, false).length);
  // (Its sides face each other along the street they came by: the first's men to the second's.)
  assert.equal(Math.round(clashFacing(s, 1)!), -90);
});

test("a tall screen stands further off than a wide one for the same line of men, and says so where it cannot stand far enough", () => {
  // (A line of twelve across the screen: 26 metres of them.)
  const line = [...Array(12).keys()].map((m) => ({ x: (m - 5.5) * 2.4, z: 0 })),
    tall = fitEye(line, frameOf(SCREENS[0]!, 0, -38, false)),
    wide = fitEye(line, frameOf(SCREENS[2]!, 0, -38, false));
  assert.ok(tall.fits && wide.fits);
  assert.ok(
    tall.distance > wide.distance * 1.5,
    `${tall.distance.toFixed(0)} m against ${wide.distance.toFixed(0)} m`,
  );
  // (A hundred metres of them on a phone held upright: further than the eye may stand. It stands as far as it may, and says so.)
  const long = [...Array(40).keys()].map((m) => ({ x: (m - 19.5) * 2.6, z: 0 })),
    f = frameOf(SCREENS[0]!, 0, -38, true),
    far = fitEye(long, f);
  assert.equal(far.fits, false);
  assert.equal(far.distance, f.max);
  assert.ok(shareSeen(long, f, far) < 1);
  // (No one to look at: where it is, as near as it stands.)
  assert.equal(fitEye([], f).distance, f.min);
});
