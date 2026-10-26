// Earth's showings as they were before Phase 54 M222 drew them from each world's chemistry: the
// three functions copied verbatim before the change, and on Earth's seeds every land, on the fine
// grid and the provinces alike, shows the same copper, tin, iron, salt, coal, vents and oil as these.
import { test } from "node:test";
import assert from "node:assert/strict";
import { finish, hashString, mix, seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE } from "../../src/rules/index.ts";
import {
  BOUNDARY,
  SEAM,
  generateHomeWorld,
  ironShowing,
  provinceWorld,
  surfaceCopper,
  surfaceOre,
  type HomeWorld,
} from "../../src/gen/index.ts";

// ---- Frozen copies (src/gen/homeworld.ts before Phase 54 M222) ----

function frozenSurfaceCopper(w: HomeWorld, cell: number): boolean {
  const t = w.tectonics,
    e = t.elevation[cell]!;
  if (e <= 0) return false;
  const belt = t.boundary[cell] === BOUNDARY.convergent && t.toBoundary[cell]! <= 6,
    high = e > 900;
  if (!belt && !high) return false;
  const u = finish(mix(hashString(`surface copper ${w.ground}`), cell), 11) / 4294967296;
  return u < (belt ? 0.3 : 0.15);
}

function frozenSurfaceOre(w: HomeWorld, cell: number, kind: string): boolean {
  if (kind === "copper") return frozenSurfaceCopper(w, cell);
  if (kind === "coal") return w.tectonics.elevation[cell]! > 0 && w.deep.coal[cell]! >= SEAM.coal;
  if (kind === "vent") {
    const t = w.tectonics;
    if (t.elevation[cell]! > 0) return false;
    const near = t.boundary[cell] !== BOUNDARY.none || t.toBoundary[cell]! <= 2;
    return near || t.hotspots.includes(cell);
  }
  if (kind === "oil") return w.deep.oil[cell]! >= SEAM.oil;
  const t = w.tectonics,
    e = t.elevation[cell]!;
  if (e <= 0) return false;
  const u = finish(mix(hashString(`surface ${kind} ${w.ground}`), cell), 11) / 4294967296,
    rain = w.climate.precipitation[cell]!,
    coast = (() => {
      for (let k = w.grid.offsets[cell]!; k < w.grid.offsets[cell + 1]!; k++)
        if (t.elevation[w.grid.neighbours[k]!]! <= 0) return true;
      return false;
    })();
  switch (kind) {
    case "tin":
      return t.boundary[cell] === BOUNDARY.convergent && t.toBoundary[cell]! <= 5 && u < 0.18;
    case "iron":
      return (rain > 700 && e < 400 && u < 0.4) || (e > 700 && u < 0.3);
    case "salt":
      return (rain < 350 && u < 0.35) || (coast && u < 0.25);
    default:
      return false;
  }
}

function frozenIronShowing(w: HomeWorld, cell: number): "bog" | "hill" | null {
  const t = w.tectonics,
    e = t.elevation[cell]!;
  if (e <= 0) return null;
  const u = finish(mix(hashString(`surface iron ${w.ground}`), cell), 11) / 4294967296,
    rain = w.climate.precipitation[cell]!;
  if (rain > 700 && e < 400 && u < 0.4) return "bog";
  if (e > 700 && u < 0.3) return "hill";
  return null;
}

// ---- The check ----

const KINDS = ["copper", "tin", "iron", "salt", "coal", "vent", "oil"] as const;

for (const seed of ["first light", "kestrel", "amber", "juniper"])
  test(`Earth's showings on ${seed} as before Phase 54`, () => {
    const fine = generateHomeWorld(seedFromText(seed), EARTHLIKE);
    for (const w of [fine, provinceWorld(fine)]) {
      const shown = new Map<string, number>();
      for (let cell = 0; cell < w.grid.count; cell++) {
        assert.equal(surfaceCopper(w, cell), frozenSurfaceCopper(w, cell), `copper ${cell}`);
        assert.equal(ironShowing(w, cell), frozenIronShowing(w, cell), `iron showing ${cell}`);
        for (const kind of KINDS) {
          const was = frozenSurfaceOre(w, cell, kind);
          assert.equal(surfaceOre(w, cell, kind), was, `${kind} ${cell}`);
          if (was) shown.set(kind, (shown.get(kind) ?? 0) + 1);
        }
      }
      // (Something of each worked kind shows, so the comparison is not of nothing with nothing.)
      for (const kind of ["copper", "tin", "iron", "salt"])
        assert.ok((shown.get(kind) ?? 0) > 0, `${seed}: some ${kind} shows`);
    }
  });
