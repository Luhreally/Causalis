import { test } from "node:test";
import assert from "node:assert/strict";
import { hashString, seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import { CLADES, EARTHLIKE } from "../../src/rules/index.ts";
import { buildBody, coatOf, figureOf, posed, type BeastPart } from "../../src/view/index.ts";

// B0 of the life plan: Earth's beasts and people pinned, drawn exactly as they were before every body was drawn
// from its parts (B1). The beasts: every lineage first light ever had, built at every detail and posed standing,
// walking and running; the people: every kind's plain figure (no look of its own, as Earth's apes are drawn).

const g = generateHomeWorld(seedFromText("first light"), EARTHLIKE, 32);

/** A hash of numbers, each to a millionth. */
function digest(xs: number[]): string {
  let s = "";
  for (const x of xs) s += `${Math.round(x * 1e6)},`;
  return `${hashString(s) >>> 0}:${xs.length}`;
}

test("first light's beasts are drawn as they were", () => {
  const out: number[] = [],
    parts: BeastPart[] = [];
  for (const s of g.life.species) {
    if (!s.body) continue;
    const coat = coatOf(s.name, s.wool);
    for (let detail = 0; detail <= 3; detail++) {
      const b = buildBody(s.body, detail, coat.pattern, hashString(s.ref));
      for (const pose of [
        { gait: 0 as const, phase: 0, head: 0.25, crouch: 0 },
        { gait: 1 as const, phase: 1.3, head: 0.6, crouch: 0 },
        { gait: 2 as const, phase: 2.2, head: 0.1, crouch: 0.4 },
      ]) {
        const n = posed(b, pose, parts);
        out.push(n);
        for (let i = 0; i < n; i++) {
          const p = parts[i]!;
          out.push(
            p.x,
            p.y,
            p.z,
            p.sx,
            p.sy,
            p.sz,
            p.pitch,
            p.yaw,
            p.tone,
            (p as { shape?: number }).shape ?? 0,
          );
        }
      }
    }
  }
  assert.equal(digest(out), EARTH_BEASTS);
});

test("every kind's plain figure is drawn as it was", () => {
  const out: number[] = [];
  for (const c of CLADES)
    for (let detail = 0; detail <= 3; detail++) {
      const f = figureOf({ ...c.body, folk: null }, detail);
      out.push(f.scale, f.parts.length);
      for (const p of f.parts)
        out.push(p.x, p.y, p.z, p.sx, p.sy, p.sz, p.tone, p.swing ?? 0, p.pivot ?? 0);
    }
  assert.equal(digest(out), EARTH_FIGURES);
});

const EARTH_BEASTS = "3978190297:135492";
const EARTH_FIGURES = "1326412574:2017";
