// What a people eats and how it keeps it (the society sweep, asked 2026-11-16: "cuisine from the land's crops and beasts"). Before
// it, food spoiled at one rate a good wherever it lay, the jungle's as the steppe's, halved by pots and by what the lore knew. Now a
// land's own air, coast, woods and life keep it too, as they keep it everywhere food is kept:
//   drying: warm dry air takes the water that rot needs (est: sun-dried grain, fish and meat keep the year round where it rarely rains);
//   frost: a land whose winters freeze keeps what is laid by in its cold months;
//   salt: at the coast, salt drawn from the sea keeps flesh and fish;
//   smoke: where woods stand, smoke dries and seals what hangs in it;
//   ferment: where life makes sugar and its people brew, a ferment keeps what it turns;
//   spice: hot lands' plants make the most of what keeps their eaters off, and a people of a hot land cooks with them the more, as
//     those compounds keep what they cook (Billing and Sherman: spice used rises with a land's heat).
// What is kept (keptShare) is what all of them together spare of food's spoiling. And the land's dishes are named from what it eats
// and how it keeps it (tableWords): a reading.
// Pure functions.
import { dmath } from "../kernel/index.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

export const KEEPING_MEANS = ["drying", "frost", "salt", "smoke", "ferment", "spice"] as const;
export type KeepingMean = (typeof KEEPING_MEANS)[number];

/** How much of food's spoiling each means spares at its fullest (est); and the most all together spare. */
export const KEEPING: Readonly<Record<KeepingMean, number>> & { readonly most: number } = {
  drying: 0.45,
  frost: 0.5,
  salt: 0.4,
  smoke: 0.3,
  ferment: 0.2,
  spice: 0.15,
  most: 0.6,
};

/** What a land has about it to keep its food. */
export type KeepingLand = {
  /** Its mean warmth (°C), half its year's swing (°C), its rain (mm a year). */
  readonly temperature: number;
  readonly seasonality: number;
  readonly rain: number;
  /** Whether it lies at the sea; the share of it wooded; whether it brews; how richly its life grows (0 … 1). */
  readonly coast: boolean;
  readonly woods: number;
  readonly brews: boolean;
  readonly growth: number;
  /** Whether it lives in the water (its food is under the sea: no drying, no smoke). */
  readonly water: boolean;
};

/** How far each means keeps a land's food (0 … 1). */
export function keepingMeans(l: KeepingLand): Record<KeepingMean, number> {
  const t = l.temperature,
    low = t - Math.abs(l.seasonality);
  return {
    drying: l.water ? 0 : clamp01(1 - l.rain / 1200) * clamp01((t - 2) / 18),
    frost: clamp01(-low / 10),
    salt: l.coast ? 1 : 0,
    smoke: l.water ? 0 : clamp01(2 * l.woods),
    ferment: l.brews ? 1 : 0,
    spice: clamp01((t - 12) / 16) * clamp01(l.growth),
  };
}

/** The share of food's spoiling a land's means spare it, all together (0 … KEEPING.most). */
export function keptShare(means: Readonly<Record<KeepingMean, number>>): number {
  let left = 1;
  for (const k of KEEPING_MEANS) left *= 1 - KEEPING[k] * clamp01(means[k]);
  return Math.min(KEEPING.most, 1 - left);
}

/** What a land eats, as shares of its food (grain, flesh and milk, the wild's). */
export type Eaten = { readonly grain: number; readonly meat: number; readonly wild: number };

/** A land's dishes, said: from what it eats most, how it keeps it, what it cooks with. */
export function tableWords(
  d: Eaten,
  means: Readonly<Record<KeepingMean, number>>,
  water: boolean,
): string[] {
  const out: string[] = [];
  const most =
    d.grain >= d.meat && d.grain >= d.wild ? "grain" : d.meat >= d.wild ? "meat" : "wild";
  if (water)
    out.push(
      most === "wild"
        ? "what the currents bring, eaten fresh"
        : "what its gardens and flocks of the deep give",
    );
  else if (most === "grain")
    out.push(
      d.grain > 0.7
        ? "bread and porridge of its grain, and little else"
        : "bread and porridge of its grain",
    );
  else if (most === "meat") out.push("flesh and milk of its flocks");
  else out.push("what it gathers and hunts, eaten as it is found");
  if (!water && d.meat >= 0.15 && most !== "meat") out.push("stews of its flocks' flesh");
  if (means.salt >= 0.5) out.push("salted fish and flesh");
  if (means.drying >= 0.4) out.push("what is dried in the sun");
  if (means.frost >= 0.4) out.push("what is laid by in the winter's cold");
  if (means.smoke >= 0.5) out.push("smoked meats");
  if (means.ferment >= 0.5) out.push("brewed drink");
  if (means.spice >= 0.4) out.push("hot and fragrant with what grows about it");
  return out;
}
