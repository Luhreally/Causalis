import type { Block } from "../bridge/index.ts";
import { figureOf, figureAnatomy, partExtent, woundGear, bloodTones } from "../view/index.ts";
import type { Solid } from "./portrait.ts";
type Body = Extract<Block, { type: "body" }>;
const BONE = [0.91, 0.86, 0.7] as const,
  MUSCLE = [0.58, 0.14, 0.16] as const;
/** A diagram of the recorded body plan; organ shapes are illustrative, not new injury records. */
export function internalSolids(b: Body, skeleton: boolean): Solid[] {
  const f = figureOf(b.person.body, 3),
    a = figureAnatomy(f),
    gear = b.person.look ? woundGear(f, b.person.look) : null,
    k = b.person.child ? 0.7 : 1;
  const out: Solid[] = [];
  const box = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: Solid["color"],
  ) =>
    out.push({
      x: x * k,
      y: y * k,
      z: z * k,
      sx: sx * k,
      sy: sy * k,
      sz: sz * k,
      yaw: 0,
      pitch: 0,
      color,
    });
  f.parts.forEach((p, i) => {
    const e = partExtent(p),
      keep = gear?.keep[i] ?? 1;
    if (!keep || p.tone === 3 || p.tone === 4) return;
    if (p.role) {
      if (!skeleton)
        box(p.x, p.y + ((1 - keep) * e[1]) / 2, p.z, e[0] * 0.85, e[1] * keep, e[2] * 0.75, MUSCLE);
      box(
        p.x,
        p.y + ((1 - keep) * e[1]) / 2,
        p.z + e[2] * 0.43,
        e[0] * 0.24,
        e[1] * keep,
        e[2] * 0.26,
        BONE,
      );
      box(p.x, p.y + e[1] * 0.45, p.z + e[2] * 0.43, e[0] * 0.47, e[0] * 0.4, e[2] * 0.35, BONE);
    }
  });
  const head = f.parts[a.on.head],
    torso = f.parts[a.on.trunk];
  if (head && (gear?.keep[a.on.head] ?? 1) > 0) {
    const e = partExtent(head);
    box(head.x, head.y, head.z, e[0] * 0.9, e[1] * 0.95, e[2] * 0.72, BONE);
    for (const side of [-1, 1])
      box(
        head.x + side * e[0] * 0.23,
        head.y + e[1] * 0.03,
        head.z + e[2] * 0.4,
        e[0] * 0.23,
        e[1] * 0.2,
        e[2] * 0.16,
        [0.12, 0.07, 0.09],
      );
    if (!skeleton)
      for (let row = 0; row < 3; row++)
        for (const side of [-1, 1])
          box(
            head.x + side * e[0] * 0.2,
            head.y + e[1] * (0.22 + row * 0.1),
            head.z + e[2] * 0.39,
            e[0] * 0.36,
            e[1] * 0.14,
            e[2] * 0.3,
            [0.74, 0.43 + row * 0.04, 0.45],
          );
  }
  if (torso) {
    const e = partExtent(torso),
      x = torso.x,
      y = torso.y,
      z = torso.z;
    for (let row = 0; row < 9; row++)
      box(
        x,
        y + e[1] * (0.43 - row * 0.1),
        z - e[2] * 0.1,
        e[0] * 0.12,
        e[1] * 0.075,
        e[2] * 0.3,
        BONE,
      );
    if (!skeleton) {
      // A non-human plan keeps a schematic central organ system rather than human-specific labels.
      const alien = !!b.person.body?.folk;
      for (const side of [-1, 1])
        box(
          x + side * e[0] * 0.22,
          y + e[1] * 0.19,
          z + e[2] * 0.18,
          e[0] * 0.3,
          e[1] * 0.42,
          e[2] * 0.5,
          [0.61, 0.29, 0.36],
        );
      box(
        x - e[0] * 0.06,
        y + e[1] * 0.1,
        z + e[2] * 0.48,
        e[0] * 0.24,
        e[1] * 0.24,
        e[2] * 0.34,
        [0.69, 0.04, 0.09],
      );
      box(
        x + e[0] * 0.15,
        y - e[1] * 0.12,
        z + e[2] * 0.25,
        e[0] * 0.52,
        e[1] * 0.19,
        e[2] * 0.48,
        [0.34, 0.07, 0.12],
      );
      for (let row = 0; row < (alien ? 3 : 5); row++)
        box(
          x + (row % 2 ? 0.04 : -0.04) * e[0],
          y - e[1] * (0.23 + row * 0.045),
          z + e[2] * 0.36,
          e[0] * (row % 2 ? 0.58 : 0.7),
          e[1] * 0.045,
          e[2] * 0.33,
          [0.71, 0.36, 0.35],
        );
    }
    for (let row = 0; row < 5; row++)
      for (const side of [-1, 1])
        box(
          x + side * e[0] * 0.25,
          y + e[1] * (0.37 - row * 0.1),
          z + e[2] * (skeleton ? 0.2 : 0.5),
          e[0] * 0.36,
          e[1] * 0.035,
          e[2] * 0.15,
          BONE,
        );
    box(x, y - e[1] * 0.47, z, e[0] * 0.79, e[1] * 0.14, e[2] * 0.65, BONE);
  }
  return out;
}

/** Substantial wound cavities, muscle and exposed bone, placed on the actual wounded member. */
export function injurySolids(b: Body, full = true): Solid[] {
  const f = figureOf(b.person.body, 3),
    a = figureAnatomy(f),
    gear = b.person.look ? woundGear(f, b.person.look) : null,
    k = b.person.child ? 0.7 : 1;
  const blood = bloodTones(b.person.body?.folk?.blood),
    out: Solid[] = [];
  for (const m of b.members) {
    if (!["lost", "struck", "killed", "abed", "healing", "scarred"].includes(m.state)) continue;
    const i = a.on[m.member === "eye-l" || m.member === "eye-r" ? "head" : m.member],
      p = f.parts[i];
    if (!p) continue;
    const e = partExtent(p),
      lost = m.state === "lost" || gear?.keep[i] === 0,
      fresh = ["struck", "killed", "abed"].includes(m.state),
      keep = gear?.keep[i] ?? 1;
    const y = lost ? p.y + e[1] * (m.member === "head" ? -0.5 : 0.5 - keep) : p.y,
      z = p.z + e[2] * 0.53;
    const put = (
      dx: number,
      dy: number,
      dz: number,
      sx: number,
      sy: number,
      sz: number,
      color: Solid["color"],
    ) =>
      out.push({
        x: (p.x + dx) * k,
        y: (y + dy) * k,
        z: (z + dz) * k,
        sx: sx * k,
        sy: sy * k,
        sz: sz * k,
        yaw: 0,
        pitch: 0,
        color,
      });
    const width = e[0] * (lost ? 0.95 : fresh ? 0.66 : 0.36),
      height = e[1] * (lost ? 0.14 : fresh ? 0.32 : 0.07);
    put(0, 0, 0, width, height, 0.009, fresh || lost ? blood.core : [0.62, 0.34, 0.31]);
    if (fresh || lost) {
      for (let n = 0; n < 5; n++)
        put(
          (n - 2) * width * 0.16,
          (n % 2 ? 0.2 : -0.2) * height,
          0.006,
          width * 0.22,
          height * 0.65,
          0.008,
          blood.flesh,
        );
      if (full) {
        put(0, 0, 0.014, width * 0.18, height * 0.8, 0.008, BONE);
        for (let n = 0; n < 3; n++)
          put(
            (n - 1) * width * 0.24,
            -height * (0.7 + n * 0.22),
            0.005,
            width * 0.09,
            height * (0.7 + n * 0.32),
            0.005,
            blood.wet,
          );
      }
    }
  }
  return out;
}
