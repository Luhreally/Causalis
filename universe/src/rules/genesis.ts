// Where a world's buried fuels and its ores come from, read from its own life and crust (the breadth round's
// "fossil fuels' origin and ore genesis"). A buried fuel is whatever its life was built of, pressed and cooked: what
// it is, what burning it leaves and how much heat it gives follow from its life's chains (rules/biochem.ts), and
// whether it is a fuel at all from whether its air holds anything to burn it in. An ore is a place where the ground
// gathered an element past the grade a smelter can win it from: how many times over it must be gathered is that
// grade over what the world's crust holds of it (rules/crust.ts), so a crust rich in an element needs less of its
// rivers, magmas and hot waters, and a world's own abundant elements are its ores.
import type { LifeChemistry } from "./biochem.ts";
import { crustOf } from "./crust.ts";
import type { Chemistry } from "./chemistry.ts";
import { findSubstance } from "./matter.ts";

/** What a world's life leaves buried, by its chains: the solid of its land's growth and the liquid of its seas' bloom. */
export type FossilOrigin = {
  /** What its life is built of, in words ("carbon's chains (cellulose)"). */
  readonly of: string;
  /** The solid fuel of its land's buried growth and the liquid of its shallow seas' buried bloom: how each was made. */
  readonly solid: string;
  readonly liquid: string;
  /** The heat a kilogram gives, burned (MJ, est: from the bonds its chains hold), and what burning leaves. */
  readonly solidMJ: number;
  readonly liquidMJ: number;
  readonly leaves: string;
  /** Whether it is a fuel there: something in its air to burn it in. */
  readonly burns: boolean;
  readonly words: string;
  /** The same of the solid alone, and of the liquid alone. */
  readonly solidWords: string;
  readonly liquidWords: string;
};

/**
 * The heat of each chain burned in oxygen (MJ a kilogram, est). Carbon's, cooked to coal and to oil (measured: 30
 * and 42). Silicon's chains of hydrogen and nitrogen lose their hydrogen as they are cooked and leave silicon,
 * which burns to sand at 32 (measured for silicon); their liquid part, silanes, at 44 (measured for the light
 * silanes). Siloxanes are silicon half burned already: only their side groups burn, at 25 (measured for silicone
 * oil), and their solid at some 15.
 */
const CHAIN_HEAT: Readonly<
  Record<
    "carbon" | "silane" | "silazane" | "siloxane",
    { readonly solid: number; readonly liquid: number; readonly leaves: string }
  >
> = {
  carbon: { solid: 30, liquid: 42, leaves: "gas, and a little ash" },
  silane: {
    solid: 32,
    liquid: 44,
    leaves: "sand: its smoke is white dust of silica, and its hearth fills with glass",
  },
  silazane: { solid: 30, liquid: 40, leaves: "sand and nitrogen" },
  siloxane: { solid: 15, liquid: 25, leaves: "sand, more than half its weight" },
};

/** What a world's buried fuels are, from what its life is built of and whether its air burns. */
export function fossilOrigin(l: LifeChemistry, burns: boolean): FossilOrigin {
  const chain = l.backbone ?? "carbon",
    h = CHAIN_HEAT[chain],
    fibre = findSubstance(l.fibre)?.name ?? l.fibre,
    store = findSubstance(l.store)?.name ?? l.store,
    liquidName = findSubstance(l.liquid)?.name ?? l.liquid,
    of = chain === "carbon" ? `carbon's chains (${fibre})` : `silicon's chains (${fibre})`,
    cooked =
      chain === "carbon"
        ? "pressed and cooked until little but carbon was left"
        : chain === "siloxane"
          ? "pressed and cooked to a waxy shale of silicon and oxygen"
          : "pressed and cooked until its hydrogen left it, a dark shale of silicon";
  const unburned = `nothing in its air burns it: it is a stock of ${chain === "carbon" ? "carbon" : "silicon"} to make things of, not a fuel`;
  return {
    of,
    solid: `the growth of its land, of ${of}, buried under wet ground in ${liquidName} and ${cooked}`,
    liquid: `the bloom of its shallow seas (its ${store}) buried under mud and cooked to a liquid`,
    solidMJ: h.solid,
    liquidMJ: h.liquid,
    leaves: h.leaves,
    burns,
    words: burns
      ? `burned, a kilogram of the solid gives some ${h.solid} MJ and of the liquid ${h.liquid}, leaving ${h.leaves}`
      : unburned,
    solidWords: burns
      ? `burned, a kilogram gives some ${h.solid} MJ, leaving ${h.leaves}`
      : unburned,
    liquidWords: burns
      ? `burned, a kilogram gives some ${h.liquid} MJ, leaving ${h.leaves}`
      : unburned,
  };
}

/**
 * The least an ore must hold of its element for a furnace to win it (a share by weight, est: the lean ores worked
 * with bellows and fire, which follow the heat each takes to free and how readily its mineral parts from the rock).
 */
export const WORKABLE: Readonly<Record<string, number>> = {
  Fe: 0.25,
  Al: 0.3,
  Ti: 0.03,
  Mn: 0.25,
  Cr: 0.3,
  Zn: 0.04,
  Ni: 0.01,
  Cu: 0.005,
  Co: 0.001,
  Pb: 0.04,
  As: 0.02,
  Sn: 0.005,
  Ag: 0.0001,
  Au: 0.000001,
};

/** One element of a world's crust as an ore: how many times over its ground must gather it, against Earth's. */
export type OreGenesis = {
  readonly symbol: string;
  readonly name: string;
  readonly ppm: number;
  /** How many times over its crust's share it must be gathered to be worth a furnace. */
  readonly gather: number;
  /** Earth's, for the same element. */
  readonly earth: number;
};

/**
 * A world's ores from its own crust: every metal a furnace can win, by how many times over the ground must gather
 * it there, the easiest first. A crust that holds twice the copper needs half the gathering, and has ore where
 * Earth's ground would have left bare rock.
 */
export function oreGenesis(chem: Chemistry): readonly OreGenesis[] {
  return crustOf(chem)
    .flatMap((r) => {
      const grade = WORKABLE[r.symbol];
      return grade === undefined || r.ppm <= 0
        ? []
        : [
            {
              symbol: r.symbol,
              name: r.name,
              ppm: r.ppm,
              gather: (grade * 1e6) / r.ppm,
              earth: (grade * 1e6) / r.earth,
            },
          ];
    })
    .sort((a, b) => a.gather - b.gather || (a.symbol < b.symbol ? -1 : 1));
}

/** The element each deposit kind is of on a world (its hardener's for "tin"), or null for one that is no metal's. */
export function depositElement(chem: Chemistry, kind: string): string | null {
  if (kind === "copper") return "Cu";
  if (kind === "gold") return "Au";
  if (kind === "iron") return "Fe";
  if (kind === "tin")
    return chem.hardener === "arsenic" ? "As" : chem.hardener === "nickel" ? "Ni" : "Sn";
  return null;
}

/**
 * The share of Earth's deposits of a metal a world has, from how much less (or more) its ground must gather it:
 * what gen/deposits.ts counts by, read here from the gathering itself (Earth's 1).
 */
export function oreEase(chem: Chemistry, kind: string): number | null {
  const symbol = depositElement(chem, kind),
    row = symbol ? oreGenesis(chem).find((r) => r.symbol === symbol) : undefined;
  return row ? row.earth / row.gather : null;
}

const times = (x: number) =>
  x >= 100 ? `${Math.round(x / 10) * 10}` : x >= 10 ? `${Math.round(x)}` : x.toFixed(1);

/** A metal deposit's making in a clause: what its crust holds and how far its ground gathered it. */
export function oreWords(chem: Chemistry, kind: string): string | null {
  const symbol = depositElement(chem, kind),
    row = symbol ? oreGenesis(chem).find((r) => r.symbol === symbol) : undefined;
  if (!row) return null;
  const against = row.earth / row.gather;
  return `its crust holds ${row.ppm >= 1000 ? `${(row.ppm / 10000).toFixed(1)}%` : `${row.ppm >= 10 ? Math.round(row.ppm) : row.ppm.toPrecision(2)} ppm`} of ${row.name}, gathered here ${times(row.gather)} times over${Math.abs(against - 1) < 0.05 ? "" : against > 1 ? ` (${times(against)} times less than Earth's ground must)` : ` (${times(1 / against)} times more than Earth's ground must)`}`;
}

/**
 * What else a world's crust could be worked for: the metals no deposit is yet told of that its ground need gather
 * no further than it gathers the hardest of those it has.
 */
export function otherOres(chem: Chemistry): readonly OreGenesis[] {
  const all = oreGenesis(chem),
    told = new Set(["copper", "gold", "tin", "iron"].flatMap((k) => depositElement(chem, k) ?? [])),
    reach = Math.max(
      0,
      ...all.filter((r) => told.has(r.symbol) && r.symbol !== "Au").map((r) => r.gather),
    );
  return all.filter((r) => !told.has(r.symbol) && r.gather <= reach);
}
