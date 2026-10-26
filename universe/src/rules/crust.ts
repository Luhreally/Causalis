// A world's crust (Phase 54 M221): Earth's upper continental crust, element by element (Rudnick &
// Gao 2003), and how a world's metals, silica and carbon move each element. The moved crust is
// scaled back to Earth's total, so another world's rock is a different mix of the same total. The
// Sun's own chemistry shows Earth's crust exactly.
import { dmath } from "../kernel/index.ts";
import type { CarbonClass, Chemistry, MetalsClass, SilicaClass } from "./chemistry.ts";

/** One element of a crust: its symbol and name, its ppm on Earth, and its ppm here. */
export type CrustRow = {
  readonly symbol: string;
  readonly name: string;
  readonly earth: number;
  readonly ppm: number;
};

/** The upper crust's oxides: each one's wt%, and its formula as atoms of its element and of oxygen. */
const OXIDES = [
  { oxide: "SiO2", wt: 66.62, el: "Si", atoms: 1, oxygen: 2 },
  { oxide: "TiO2", wt: 0.64, el: "Ti", atoms: 1, oxygen: 2 },
  { oxide: "Al2O3", wt: 15.4, el: "Al", atoms: 2, oxygen: 3 },
  // (FeOT is all the iron, counted as FeO.)
  { oxide: "FeOT", wt: 5.04, el: "Fe", atoms: 1, oxygen: 1 },
  { oxide: "MnO", wt: 0.1, el: "Mn", atoms: 1, oxygen: 1 },
  { oxide: "MgO", wt: 2.48, el: "Mg", atoms: 1, oxygen: 1 },
  { oxide: "CaO", wt: 3.59, el: "Ca", atoms: 1, oxygen: 1 },
  { oxide: "Na2O", wt: 3.27, el: "Na", atoms: 2, oxygen: 1 },
  { oxide: "K2O", wt: 2.8, el: "K", atoms: 2, oxygen: 1 },
  { oxide: "P2O5", wt: 0.15, el: "P", atoms: 2, oxygen: 5 },
] as const;

/** Upper continental crust (Rudnick & Gao 2003): each oxide's wt%. */
export const UCC_OXIDES: Readonly<Record<string, number>> = Object.fromEntries(
  OXIDES.map((r): [string, number] => [r.oxide, r.wt]),
);

/** Upper continental crust: trace elements, ppm (Rudnick & Gao 2003). */
export const UCC_TRACE: Readonly<Record<string, number>> = {
  // (Carbon is Wedepohl's 1995 figure, not Rudnick & Gao's.)
  C: 3240,
  S: 62,
  Cr: 92,
  Zn: 67,
  Ni: 47,
  Cu: 28,
  Co: 17.3,
  Pb: 17,
  As: 4.8,
  Sn: 2.1,
  Sb: 0.4,
  Ag: 0.053,
  Au: 0.0015,
};

/** Standard atomic masses (IUPAC's conventional values). */
const MASS = {
  O: 15.999,
  Si: 28.085,
  Al: 26.982,
  Fe: 55.845,
  Ca: 40.078,
  Na: 22.99,
  K: 39.098,
  Mg: 24.305,
  Ti: 47.867,
  P: 30.974,
  Mn: 54.938,
} as const;

/** Each major element's ppm, from the oxides that hold it; oxygen is the oxygen of all of them. */
function majorPpm(): Record<string, number> {
  const ppm: Record<string, number> = {};
  let oxygen = 0;
  for (const r of OXIDES) {
    // (A wt% is 10,000 ppm, shared out by the oxide's molar mass.)
    const molar = r.atoms * MASS[r.el] + r.oxygen * MASS.O;
    ppm[r.el] = (r.wt * 10000 * r.atoms * MASS[r.el]) / molar;
    oxygen += (r.wt * 10000 * r.oxygen * MASS.O) / molar;
  }
  return { O: oxygen, ...ppm };
}

/** Earth's ppm of each element: the majors from the oxides, the traces as given. */
const EARTH_PPM: Readonly<Record<string, number>> = { ...majorPpm(), ...UCC_TRACE };

/** English names, British spelling. */
const NAME: Readonly<Record<string, string>> = {
  O: "oxygen",
  Si: "silicon",
  Al: "aluminium",
  Fe: "iron",
  Ca: "calcium",
  Na: "sodium",
  K: "potassium",
  Mg: "magnesium",
  Ti: "titanium",
  P: "phosphorus",
  Mn: "manganese",
  C: "carbon",
  S: "sulphur",
  Cr: "chromium",
  Zn: "zinc",
  Ni: "nickel",
  Cu: "copper",
  Co: "cobalt",
  Pb: "lead",
  As: "arsenic",
  Sn: "tin",
  Sb: "antimony",
  Ag: "silver",
  Au: "gold",
};

/** The rows' order: the majors, then the traces. */
export const CRUST_ORDER: readonly string[] = [
  "O",
  "Si",
  "Al",
  "Fe",
  "Ca",
  "Na",
  "K",
  "Mg",
  "Ti",
  "P",
  "Mn",
  "C",
  "S",
  "Cr",
  "Zn",
  "Ni",
  "Cu",
  "Co",
  "Pb",
  "As",
  "Sn",
  "Sb",
  "Ag",
  "Au",
];

/** A table's entry for a symbol the table must hold. */
function entryOf<T>(table: Readonly<Record<string, T>>, symbol: string): T {
  const value = Object.hasOwn(table, symbol) ? table[symbol] : undefined;
  if (value === undefined) throw new Error(`crust: no entry for ${symbol}`);
  return value;
}

/** The sum of a crust's ppm, in row order (so every engine adds them the same way). */
function total(rows: readonly CrustRow[]): number {
  let sum = 0;
  for (const r of rows) sum += r.ppm;
  return sum;
}

const EARTH: readonly CrustRow[] = Object.freeze(
  CRUST_ORDER.map((symbol) => {
    const earth = entryOf(EARTH_PPM, symbol);
    return Object.freeze({ symbol, name: entryOf(NAME, symbol), earth, ppm: earth });
  }),
);
const EARTH_TOTAL = total(EARTH);

/** The iron peak: the elements the iron group makes. */
const IRON_PEAK = ["Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn"];
/** The heavies: the s-process elements, tin among them. */
const HEAVIES = ["Sn", "Sb", "Pb", "Ag", "Au"];

/** Each of some symbols at one factor. */
function each(symbols: readonly string[], value: number): Record<string, number> {
  return Object.fromEntries(symbols.map((s): [string, number] => [s, value]));
}

// Each class's factors. A world's classes multiply; air and redox move none of the elements.
const METALS: Readonly<Record<MetalsClass, Readonly<Record<string, number>>>> = {
  // (α-enhanced disks: the iron peak runs about −0.3 dex against Si, the s-process heavies −0.5.)
  poor: { ...each(IRON_PEAK, 0.5), As: 0.5, ...each(HEAVIES, 0.3) },
  solar: {},
  // (About +0.1 dex for the iron peak and +0.2 dex for the heavies.)
  rich: { ...each(IRON_PEAK, 1.25), As: 1.25, ...each(HEAVIES, 1.6) },
};
const SILICA: Readonly<Record<SilicaClass, Readonly<Record<string, number>>>> = {
  // (An ultramafic-rich crust, with fewer granites.)
  low: { Mg: 1.5, Ni: 2.5, Cr: 2, Co: 1.5, Si: 0.9, K: 0.8, Sn: 0.6 },
  solar: {},
  // (More quartz and granite.)
  high: { Si: 1.1, Mg: 0.7, Ni: 0.7, Cr: 0.7, K: 1.2, Sn: 1.3 },
};
const CARBON: Readonly<Record<CarbonClass, Readonly<Record<string, number>>>> = {
  oxide: {},
  // (Graphite and carbides.)
  "carbon-rich": { C: 10, O: 0.97 },
};

/** A class's factor for a symbol: 1 where the class says nothing. */
function factor(table: Readonly<Record<string, number>>, symbol: string): number {
  return Object.hasOwn(table, symbol) ? (table[symbol] ?? 1) : 1;
}

/** Earth's upper continental crust, one row per element in CRUST_ORDER. */
export function earthCrust(): readonly CrustRow[] {
  return EARTH;
}

/** A calibration lever: a multiplier shows at this power (1 as it is; 0.5 would soften it). */
export const SHOWING_EXPONENT = 1;

/** The multiplier of one element in a world: the product of its metals, silica and carbon factors. */
export function crustMultiplier(chem: Chemistry, symbol: string): number {
  if (chem.solar) return 1;
  return (
    factor(METALS[chem.metals], symbol) *
    factor(SILICA[chem.silica], symbol) *
    factor(CARBON[chem.carbon], symbol)
  );
}

/** How far a multiplier shows on a chart: the multiplier itself at exponent 1. */
export function showingScale(chem: Chemistry, symbol: string): number {
  const multiplier = crustMultiplier(chem, symbol);
  return SHOWING_EXPONENT === 1 ? multiplier : dmath.pow(multiplier, SHOWING_EXPONENT);
}

/** A world's crust: Earth's rows, each element times its multiplier, scaled back to Earth's total. */
export function crustOf(chem: Chemistry): readonly CrustRow[] {
  if (chem.solar) return EARTH;
  const moved = EARTH.map((r) => ({ ...r, ppm: r.earth * crustMultiplier(chem, r.symbol) })),
    // (The classes move the elements, not the crust's total: this scales it back.)
    scale = EARTH_TOTAL / total(moved);
  return Object.freeze(moved.map((r) => Object.freeze({ ...r, ppm: r.ppm * scale })));
}
