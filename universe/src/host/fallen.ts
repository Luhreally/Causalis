// A battle's record as the host shows it (Phase 55 M224): where each side's men came from, the
// most dead first — a town, a land's countryside, or a land whole where its towns' tallies have been
// let go — each with the men it sent, the dead among them and the wounded who lived. Read from the
// record, never drawn.
import type { World } from "../kernel/index.ts";
import { populationContext, type War } from "../sim/index.ts";
import { fellRows, type FellRow } from "../rules/index.ts";
import type { LevyPlace } from "../bridge/index.ts";
import { landTitle } from "./inspect/names.ts";

/** The most places a side's levy is told by when a battle is seen near. */
export const LEVY_SHOWN = 24;

const by = (p: number, q: number) => (p < q ? -1 : p > q ? 1 : 0);

/**
 * Where a side's men came from, the most dead first (then most sent, cell, town index, countryside
 * after its towns), at most `most` of them. A battle with no record of its men (before Phase 55)
 * has none.
 */
export function levyPlaces(
  world: World,
  b: War["battles"][number],
  side: 0 | 1,
  most = LEVY_SHOWN,
): LevyPlace[] {
  const ctx = populationContext(world),
    // (A town ranks by its index among its land's towns; the countryside comes after them all, and
    // a land whole, which has no towns of its own, first.)
    rank = (r: FellRow) => r.town ?? (r.whole ? -1 : Infinity),
    rows = fellRows(b.fell?.[side] ?? []).sort(
      (p, q) =>
        by(q.dead, p.dead) || by(q.sent, p.sent) || by(p.cell, q.cell) || by(rank(p), rank(q)),
    );
  return rows.slice(0, most).map((r): LevyPlace => {
    const part = { cell: r.cell, sent: r.sent, dead: r.dead, hurt: r.hurt };
    if (r.town !== null) {
      // (A town is found by its place in its land's founding order, which only grows.)
      const t = ctx.settlements.inProvince(r.cell)[r.town];
      return { kind: "town", ref: t?.ref ?? null, name: t?.name ?? "a town now gone", ...part };
    }
    const land = landTitle(world, r.cell, true);
    return r.whole
      ? { kind: "land", ref: null, name: land, ...part }
      : { kind: "countryside", ref: null, name: `the countryside of ${land}`, ...part };
  });
}
