// A town's people posed by render/folk.ts (Phase 60 T1) — geometry alone, no GPU needed: written
// straight into their batches, the same numbers as the village wrote through each batch's set()
// before, part for part and one for one; and those small on the screen posed every other frame and
// carried between, each where they are drawn every frame, their limbs a frame behind at most, while
// those near the eye, those the god's hand walks among, the struck down and the wounded are posed
// every frame as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY,
  GROUP_COLORS,
  HAIRS,
  bobOf,
  figureOf,
  hairOf,
  keepApart,
  limbPitch,
  lookNow,
  looksHurt,
  momentsOf,
  partExtent,
  personGroup,
  present,
  villageSolids,
  woundBob,
  woundGear,
  woundPitch,
  type Figure,
  type Presence,
  type WoundGear,
} from "../../src/view/index.ts";
import { FOLK_NEAR_PX, FolkPoses, nearReach, type FolkFrame } from "../../src/render/folk.ts";
import { lieDown } from "../../src/render/possess.ts";
import { stumpAlong } from "../../src/render/wounds.ts";
import { D0, DAY, HOUR, woundedPlan } from "../view/wounded-town.ts";

const M = 0.1;

/** A batch's instances as InstancedBatch.set() wrote them, from each one's place. */
function setBefore(count: number, place: (i: number, out: number[]) => void): Float32Array {
  const t = [0, 0, 0, 1, 1, 1, 0, 0],
    m = new Float32Array(count * 16);
  for (let i = 0; i < count; i++) {
    t[7] = 0;
    place(i, t);
    const [x, y, z, sx, sy, sz, yaw, pitch] = t as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    const c = Math.cos(yaw),
      s = Math.sin(yaw),
      cp = Math.cos(pitch),
      sp = Math.sin(pitch),
      o = i * 16;
    m.set(
      [
        c * sx,
        0,
        -s * sx,
        0,
        s * sp * sy,
        cp * sy,
        c * sp * sy,
        0,
        s * cp * sz,
        -sp * sz,
        c * cp * sz,
        0,
        x,
        y,
        z,
        1,
      ],
      o,
    );
  }
  return m;
}

type Drawn = { people: (Float32Array | null)[][]; hair: (Float32Array[] | null)[] };

/** The village's people as it posed them before (to Phase 59): each one, every frame. */
class Before {
  private readonly limbs = new Map<string, Float32Array>();
  place: (out: number[], i: number, pi: number) => void = () => {};

  pose(f: FolkFrame): Drawn {
    const { plan, figure, moments, sizes, strides, gear, clock, dt } = f,
      parts = figure.parts;
    const ease = dt > 0 ? 1 - Math.exp(-Math.min(0.1, dt) / 0.08) : 1,
      pitches = plan.people.map((p, i) => {
        const m = moments[i]!;
        let drawnPitch = this.limbs.get(p.ref);
        if (!drawnPitch || drawnPitch.length !== parts.length) {
          drawnPitch = new Float32Array(parts.length).fill(Number.NaN);
          this.limbs.set(p.ref, drawnPitch);
        }
        if (m.hidden) return drawnPitch;
        const walking = m.activity === ACTIVITY.walking;
        parts.forEach((part, pi) => {
          const posed = limbPitch(part, m.task, walking, walking ? strides[i]! : clock, i),
            g = gear[i],
            aim = g ? woundPitch(g, pi, posed) : posed,
            was = drawnPitch[pi]!;
          drawnPitch[pi] = Number.isNaN(was) ? aim : was + (aim - was) * ease;
        });
        return drawnPitch;
      });
    const place = (out: number[], i: number, pi: number) => {
      const p = plan.people[i]!,
        part = parts[pi]!,
        m = moments[i]!,
        size = (p.child ? 0.7 : 1) * figure.scale * (sizes[i] ?? 1),
        c = Math.cos(m.yaw),
        sn = Math.sin(m.yaw),
        pitch = pitches[i]![pi]!,
        g = gear[i] ?? null,
        keep = g ? g.keep[pi]! : 1,
        lift = keep < 1 ? stumpAlong(partExtent(part)[1], keep) : 0,
        hinge = (part.pivot ?? 0) - lift,
        dy = hinge - hinge * Math.cos(pitch),
        dz = -hinge * Math.sin(pitch),
        px = part.x,
        pz = part.z + dz,
        limp = g && m.activity === ACTIVITY.walking ? woundBob(g, strides[i]!, i) : 0;
      out[0] = m.x * M + (px * c + pz * sn) * size;
      out[1] = (part.y + lift + dy + bobOf(m.task, clock, i) + limp) * size;
      out[2] = m.z * M + (-px * sn + pz * c) * size;
      out[3] = keep > 0 ? part.sx * size : 0;
      out[4] = part.sy * size * keep;
      out[5] = keep > 0 ? part.sz * size : 0;
      out[6] = m.yaw;
      out[7] = pitch;
      if (f.downed?.has(i)) lieDown(out, part, m.x, m.z, m.yaw, size, pitch);
    };
    this.place = place;
    const people = f.people.map((batches, gi) => {
      const members = plan.people
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => personGroup(p) === gi && !moments[i]!.hidden);
      return batches.map((batch, pi) =>
        batch ? setBefore(members.length, (k, out) => place(out, members[k]!.i, pi)) : null,
      );
    });
    const span = plan.body?.span ?? 70,
      hair = f.hair.map((colours, pi) =>
        colours
          ? colours.map((_, hi) => {
              const wearers = plan.people
                .map((p, i) => ({ p, i }))
                .filter(({ p, i }) => !moments[i]!.hidden && hairOf(p.ref, p.age, span) === hi);
              return setBefore(wearers.length, (k, out) => place(out, wearers[k]!.i, pi));
            })
          : null,
      );
    return { people, hair };
  }
}

/** A batch that keeps what was last written into it. */
class Kept {
  drawn = new Float32Array(0);
  setMatrices(count: number, write: (m: Float32Array) => void): void {
    const m = new Float32Array(count * 16);
    write(m);
    this.drawn = m;
  }
}

const plan = woundedPlan(),
  figure: Figure = figureOf(plan.body, 2);

/** The batches the village draws its people in: a part's for each group, a hair part's by colour. */
function batches(): { people: (Kept | null)[][]; hair: (Kept[] | null)[] } {
  return {
    people: GROUP_COLORS.map(() =>
      figure.parts.map((part) => (part.tone === 3 ? null : new Kept())),
    ),
    hair: figure.parts.map((part) => (part.tone === 3 ? HAIRS.map(() => new Kept()) : null)),
  };
}
const drawnOf = (b: ReturnType<typeof batches>): Drawn => ({
  people: b.people.map((g) => g.map((k) => k?.drawn ?? null)),
  hair: b.hair.map((h) => h?.map((k) => k.drawn) ?? null),
});

/**
 * Frames of the town at a run, its people drawn as the village draws them (kept apart, carried
 * where they are drawn): coming out of doors and going in, struck down, hurt.
 */
function* frames(n: number): Generator<Omit<FolkFrame, "people" | "hair" | "eye" | "near">> {
  const steps = [1 / 60, 1 / 60, 1 / 15, 0.25, 0, 1 / 30, 0.11],
    presence = new Map<string, Presence>(),
    refs = plan.people.map((p) => p.ref);
  let clock = 3,
    t = (D0 + 1) * DAY + 7.6 * HOUR;
  for (let f = 0; f < n; f++) {
    const dt = f ? steps[f % steps.length]! : 0;
    clock += dt;
    t += dt * 40;
    const targets = momentsOf(plan, t);
    keepApart(plan, targets);
    const drawn = present(presence, refs, targets, dt, villageSolids(plan)),
      gear: (WoundGear | null)[] = plan.people.map((p) => {
        if (!p.wounds?.length) return null;
        const look = lookNow(p, t);
        return looksHurt(look) ? woundGear(figure, look) : null;
      });
    yield {
      plan,
      figure,
      moments: drawn.map((d) => d.moment),
      sizes: drawn.map((d) => d.size),
      strides: drawn.map((d) => d.stride),
      gear,
      clock,
      dt,
      downed: new Set([12]),
      kept: new Set([13, 14]),
    };
  }
}

/** Whether two batches' numbers are the same, bit for bit (and where they first are not). */
function differ(a: Float32Array | null, b: Float32Array | null): string | null {
  if (!a || !b) return a === b ? null : "one batch missing";
  if (a.length !== b.length) return `${a.length / 16} against ${b.length / 16} drawn`;
  for (let k = 0; k < a.length; k++)
    if (!Object.is(a[k], b[k])) return `instance ${Math.floor(k / 16)}[${k % 16}]: ${a[k]} ${b[k]}`;
  return null;
}

test("every one posed every frame, the batches hold the same numbers as before", () => {
  const before = new Before(),
    poses = new FolkPoses(),
    b = batches(),
    eye = { x: 0, y: 30, z: 0 };
  let wounded = 0,
    lying = 0;
  for (const f of frames(160)) {
    const was = before.pose({ ...f, ...b, eye, near: Infinity }),
      partAt = poses.pose({ ...f, ...b, eye, near: Infinity }),
      now = drawnOf(b);
    now.people.forEach((g, gi) =>
      g.forEach((d, pi) => {
        const why = differ(d, was.people[gi]![pi]!);
        assert.equal(why, null, `group ${gi} part ${pi}: ${why}`);
      }),
    );
    now.hair.forEach((h, pi) =>
      h?.forEach((d, hi) => {
        const why = differ(d, was.hair[pi]![hi]!);
        assert.equal(why, null, `hair ${hi} part ${pi}: ${why}`);
      }),
    );
    // A part of one as posed now, for what is worn on it: as before.
    f.moments.forEach((m, i) => {
      if (m.hidden || !(f.gear[i] || f.downed!.has(i))) return;
      if (f.gear[i]) wounded++;
      else lying++;
      for (let pi = 0; pi < figure.parts.length; pi++) {
        const mine = [0, 0, 0, 1, 1, 1, 0, 0],
          theirs = [0, 0, 0, 1, 1, 1, 0, 0];
        partAt(mine, i, pi);
        before.place(theirs, i, pi);
        assert.deepEqual(mine, theirs, `${i} part ${pi}`);
      }
    });
    assert.equal(poses.shown.carried, 0);
  }
  assert.ok(wounded > 100 && lying > 100, `${wounded} wounded, ${lying} lying drawn`);
});

test("the parts of one shape and colour drawn in one batch, the same numbers one after another", () => {
  // (As the village makes them: a batch for the parts of one shape and one colour.)
  const alike = figure.parts.map((part) =>
      figure.parts.findIndex((p) => p.shape === part.shape && p.tone === part.tone),
    ),
    people = GROUP_COLORS.map(() => {
      const made: Kept[] = [];
      return figure.parts.map((part, pi) =>
        part.tone === 3 ? null : (made[alike[pi]!] ??= new Kept()),
      );
    }),
    made: Kept[][] = [],
    hair = figure.parts.map((part, pi) =>
      part.tone === 3 ? (made[alike[pi]!] ??= HAIRS.map(() => new Kept())) : null,
    ),
    before = new Before(),
    poses = new FolkPoses(),
    eye = { x: 0, y: 30, z: 0 };
  assert.ok(new Set(people[0]).size < figure.parts.length, "some parts share a batch");
  /** A shared batch's numbers as those of its parts' own batches, one after another for each one. */
  const joined = (parts: readonly (Float32Array | null)[], pis: readonly number[]) => {
    const count = parts[pis[0]!]!.length / 16,
      out = new Float32Array(count * pis.length * 16);
    for (let k = 0; k < count; k++)
      pis.forEach((pi, q) =>
        out.set(parts[pi]!.subarray(k * 16, k * 16 + 16), (k * pis.length + q) * 16),
      );
    return out;
  };
  for (const f of frames(60)) {
    const was = before.pose({ ...f, people, hair, eye, near: Infinity });
    poses.pose({ ...f, people, hair, eye, near: Infinity });
    people.forEach((g, gi) =>
      new Set(g).forEach((batch) => {
        if (!batch) return;
        const pis = g.flatMap((b, pi) => (b === batch ? [pi] : [])),
          why = differ(batch.drawn, joined(was.people[gi]!, pis));
        assert.equal(why, null, `group ${gi} parts ${pis}: ${why}`);
      }),
    );
    new Set(hair).forEach((byColour) =>
      byColour?.forEach((batch, hi) => {
        const pis = hair.flatMap((h, pi) => (h === byColour ? [pi] : [])),
          why = differ(
            batch.drawn,
            joined(
              pis.map((pi) => was.hair[pi]![hi]!),
              pis.map((_, q) => q),
            ),
          );
        assert.equal(why, null, `hair ${hi} parts ${pis}: ${why}`);
      }),
    );
  }
});

test("those small on the screen are posed every other frame, as every frame poses them, each where they are", () => {
  const before = new Before(),
    poses = new FolkPoses(),
    b = batches(),
    eye = { x: 0, y: 25, z: 0 },
    near = 40,
    always = new Set(plan.people.map((_, i) => i)),
    run = [...frames(161)];
  let carried = 0,
    far = 0,
    placed = 0;
  run.forEach((f, n) => {
    // (The last frame poses every one, as if near.)
    const last = n === run.length - 1,
      was = before.pose({ ...f, ...b, eye, near: Infinity });
    poses.pose({ ...f, ...b, eye, near: last ? Infinity : near });
    carried += poses.shown.carried;
    // Those posed every frame: the struck down, those the hand walks among, the wounded, those
    // coming out of a door or going in, and those near the eye (whenever drawn, so far).
    const list: number[][] = GROUP_COLORS.map(() => []);
    f.moments.forEach((m, i) => {
      if (m.hidden) return;
      list[personGroup(plan.people[i]!)]!.push(i);
      const d2 = (m.x - eye.x) ** 2 + eye.y ** 2 + (m.z - eye.z) ** 2;
      if (f.downed!.has(i) || f.kept!.has(i) || f.gear[i] || f.sizes[i]! < 1 || d2 < near * near)
        return;
      far++;
      always.delete(i);
    });
    drawnOf(b).people.forEach((g, gi) =>
      g.forEach((d, pi) => {
        const them = was.people[gi]![pi]!;
        if (!d || !them) return;
        assert.equal(d.length, them.length, `group ${gi} part ${pi}: as many drawn`);
        list[gi]!.forEach((i, k) => {
          const mine = d.subarray(k * 16, k * 16 + 16),
            theirs = them.subarray(k * 16, k * 16 + 16),
            off = Math.hypot(mine[12]! - theirs[12]!, mine[14]! - theirs[14]!) / M;
          // Those posed now (the far ones at their turn, every other frame): as posed every frame,
          // number for number, their limbs eased every frame all the same.
          if (always.has(i) || last || (i & 1) === (n & 1))
            assert.equal(differ(mine, theirs), null, `${i} part ${pi} frame ${n}: as every frame`);
          // (The body stands at the figure's middle: where they are drawn.)
          if (pi === 0) placed = Math.max(placed, off);
        });
      }),
    );
  });
  // Half the far ones carried each frame (those posed the frame before), each where they are.
  assert.ok(carried > 0.4 * far && carried < 0.6 * far, `${carried} carried of ${far}`);
  assert.ok(always.size >= 3, `${always.size} posed every frame throughout`);
  assert.ok(placed < 0.001, `drawn ${(placed * 100).toFixed(2)} cm from where they are`);
});

test("a figure is posed every other frame only when it is small on the screen", () => {
  // (Seen at 932 CSS pixels tall through a 50° lens: a grown one is 72 pixels tall at its reach.)
  let top = 0;
  for (const p of figure.parts) top = Math.max(top, p.y + partExtent(p)[1] / 2);
  const reach = nearReach(figure, 50, 932),
    focal = 932 / 2 / Math.tan((25 * Math.PI) / 180);
  assert.ok(Math.abs(((top * figure.scale) / M / reach) * focal - FOLK_NEAR_PX) < 1e-9);
  assert.ok(reach > 40 && reach < 120, `${reach} m`);
});
