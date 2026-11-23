// Mineral deposits (docs/architecture §24). Each kind forms where its process
// would put it — copper and gold over subduction zones, tin in collision belts,
// iron in the old hearts of continents, salt in dry hollows; coal and oil where
// deep time buried swamp forests and shallow-sea plankton (gen/deeptime.ts) — and
// records that process, the plates behind it and, for coal and oil, the age that
// laid it down, so the explainer can walk from a mine back to what made it.
import {
  defineStream,
  dmath,
  purpose,
  weightedKey,
  type Rng,
  type SphereGrid,
} from "../kernel/index.ts";
import { BOUNDARY, type Tectonics } from "./plates.ts";
import type { Climate } from "./climate.ts";
import type { Hydrology } from "./hydrology.ts";
import type { DeepTime } from "./deeptime.ts";
import { depositRef } from "./kinds.ts";
import type { Biosphere } from "./biosphere.ts";
import { crustMultiplier, type Chemistry } from "../rules/index.ts";

const DEPOSITS = defineStream("gen.deposits");

export const DEPOSIT_KINDS = ["copper", "gold", "tin", "iron", "coal", "oil", "salt"] as const;
export type DepositKind = (typeof DEPOSIT_KINDS)[number];

export type Process =
  | "the god's hand"
  | "arc magmatism"
  | "orogenic veins"
  | "collision granites"
  | "banded iron of an ancient craton"
  | "iron of layered intrusions"
  | "buried swamp forests"
  | "buried growth of its land's swamps"
  | "plankton buried under a shallow sea"
  | "the bloom of its shallow seas buried"
  | "evaporites in a closed basin";

export type Deposit = {
  readonly index: number;
  readonly ref: string;
  readonly kind: DepositKind;
  readonly cell: number;
  /** Units of ore the deposit holds when generated. */
  readonly richness: number;
  readonly process: Process;
  /** The plates the process involved: the cell's own plate first, then the one across the boundary. */
  readonly plates: readonly number[];
  readonly detail: Readonly<Record<string, number | string>>;
};

type Rule = {
  readonly kind: DepositKind;
  readonly count: number;
  readonly process: Process;
  readonly weight: (c: number) => number;
};

export function makeDeposits(
  grid: SphereGrid,
  rng: Rng,
  t: Tectonics,
  climate: Climate,
  water: Hydrology,
  elevation: Float32Array,
  deep: DeepTime,
  /** Its life (absent: as Earth's always was) and its chemistry (absent: the Sun's). */
  life?: Biosphere,
  chem?: Chemistry,
  /** Whether its air holds an oxidant its first growth could have made (rules/kinds.ts `burns`; absent: as Earth's). */
  oxidant = true,
): Deposit[] {
  // (How many of each a world holds, against Earth's: as much of its element as its crust holds against Earth's (rules/crust.ts),
  // the "tin" its hardener's; and its rusted iron only where its first seas' growth made the oxygen that dropped it.)
  const scale = (symbol: string) => (chem ? crustMultiplier(chem, symbol) : 1),
    hardener = chem?.hardener === "arsenic" ? "As" : chem?.hardener === "nickel" ? "Ni" : "Sn",
    physical = !!life?.species.some((s) => s.place !== undefined),
    lived = !life || life.species.length > 0,
    rusted = lived && oxidant,
    counted = (base: number, symbol: string) =>
      Math.max(1, Math.min(2 * base, Math.round(base * scale(symbol))));
  const land = (c: number) => elevation[c]! > 0,
    across = (c: number) => t.across[c]!,
    oceanic = (p: number) => p >= 0 && !t.plates[p]!.continental,
    continentalPlate = (p: number) => p >= 0 && t.plates[p]!.continental,
    d = (c: number) => t.toBoundary[c]!;
  const rules: Rule[] = [
    {
      kind: "copper",
      count: counted(14, "Cu"),
      process: "arc magmatism",
      weight: (c) =>
        land(c) &&
        t.crust[c] &&
        t.boundary[c] === BOUNDARY.convergent &&
        oceanic(across(c)) &&
        d(c) <= 3
          ? 1 / (1 + d(c))
          : 0,
    },
    {
      kind: "gold",
      count: counted(10, "Au"),
      process: "orogenic veins",
      weight: (c) =>
        land(c) && t.boundary[c] === BOUNDARY.convergent && d(c) <= 4 ? 0.6 / (1 + d(c)) : 0,
    },
    {
      kind: "tin",
      count: counted(8, hardener),
      process: "collision granites",
      weight: (c) =>
        land(c) &&
        t.crust[c] &&
        t.boundary[c] === BOUNDARY.convergent &&
        continentalPlate(across(c)) &&
        d(c) <= 3
          ? 1 / (1 + d(c))
          : 0,
    },
    rusted
      ? {
          kind: "iron",
          count: counted(14, "Fe"),
          process: "banded iron of an ancient craton",
          weight: (c) => (land(c) && t.crust[c] && d(c) >= 6 ? Math.min(d(c), 14) / 14 : 0),
        }
      : {
          // (No growth made oxygen in its first seas to drop their iron as rust: its iron is the magma's, settled out where a
          // plume or a rift fed great sills.)
          kind: "iron",
          count: counted(14, "Fe"),
          process: "iron of layered intrusions",
          weight: (c) =>
            land(c) &&
            (t.hotspots.includes(c) || (t.boundary[c] === BOUNDARY.divergent && d(c) <= 3))
              ? t.hotspots.includes(c)
                ? 1
                : 1 / (1 + d(c))
              : 0,
        },
    {
      // Coal lies under land now where deep time buried swamp forests.
      kind: "coal",
      count: 14,
      process: physical ? "buried growth of its land's swamps" : "buried swamp forests",
      weight: (c) => (land(c) && deep.coal[c]! > 0 ? Math.min(2, deep.coal[c]!) : 0),
    },
    {
      // Oil, under land or a shelf, where it buried the plankton of warm shallow seas.
      kind: "oil",
      count: 12,
      process: physical
        ? "the bloom of its shallow seas buried"
        : "plankton buried under a shallow sea",
      weight: (c) => (elevation[c]! > -250 && deep.oil[c]! > 0 ? Math.min(2, deep.oil[c]!) : 0),
    },
    {
      kind: "salt",
      count: 8,
      process: "evaporites in a closed basin",
      weight: (c) =>
        land(c) && climate.precipitation[c]! < 300 && elevation[c]! < 1200
          ? 1 - climate.precipitation[c]! / 300
          : 0,
    },
  ];
  const out: Deposit[] = [];
  for (const rule of rules) {
    const p = purpose(`deposit ${rule.kind}`),
      candidates: { key: number; cell: number }[] = [];
    for (let c = 0; c < grid.count; c++) {
      const w = rule.weight(c);
      if (w > 0) candidates.push({ key: weightedKey(rng.real(DEPOSITS, c, 0, p), w), cell: c });
    }
    candidates.sort((a, b) => (a.key !== b.key ? a.key - b.key : a.cell - b.cell));
    const taken: number[] = [];
    for (const { cell } of candidates) {
      if (taken.length >= rule.count) break;
      // No two of a kind in neighbouring cells.
      let near = false;
      for (let k = grid.offsets[cell]!; k < grid.offsets[cell + 1]!; k++)
        if (taken.includes(grid.neighbours[k]!)) near = true;
      if (near || taken.includes(cell)) continue;
      taken.push(cell);
      const index = out.length,
        other = t.across[cell]!;
      out.push({
        index,
        ref: depositRef(0, index),
        kind: rule.kind,
        cell,
        richness:
          200 +
          Math.floor(1800 * rng.real(DEPOSITS, cell, 0, p, 1) * Math.min(1, rule.weight(cell))),
        process: rule.process,
        plates: other >= 0 && d(cell) !== 255 ? [t.plate[cell]!, other] : [t.plate[cell]!],
        detail: {
          toBoundary: d(cell),
          elevation: Math.round(elevation[cell]!),
          rain: Math.round(climate.precipitation[cell]!),
          // The age that laid down coal or oil (see gen/deeptime.ts).
          ...(rule.kind === "coal" ? { age: deep.coalAge[cell]! } : {}),
          ...(rule.kind === "oil" ? { age: deep.oilAge[cell]! } : {}),
        },
      });
    }
  }
  return out;
}
