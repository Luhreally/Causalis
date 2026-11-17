// What a people wears, and why (the society sweep, asked 2026-11-16: "dress and fashion from stuff and climate"). Before it, every
// land wanted the same clothes a head, the tropics' as the tundra's, and the cold killed a furred body as it killed a bare one. Now:
//   Warmth (warmthNeeded): a body loses heat as its coldest months lie below what it is comfortable bare at; its own coat keeps the
//     most of that for it (fur and feathers hold a still layer of air against the skin, scales and shell little), and in the water
//     no cloth keeps anyone warm. What the cold leaves to clothes is the need, and the cold's deaths fall on the unclothed by it.
//   Display (displayOf): clothes say who one is, the more where wealth lies with a few who can show it, among strangers in towns who
//     know one only by it (Simmel, Veblen), the less where a devout people holds show for vanity.
//   What is wanted (dressWanted): some clothes everywhere (modesty, carrying, the sun), more as the cold asks, and more again for show.
//   What it is made of (dressStuff): of the wool its flocks give, the hides its herds and hunters bring, the fibres its fields grow
//     where it weaves: each as much as it has of it.
// Pure functions.
import { dmath } from "../kernel/index.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

/** How much of the cold a body's own coat leaves to clothes (1: a bare skin's all). */
export const COAT: Readonly<Record<string, number>> = {
  skin: 1,
  fur: 0.25,
  feathers: 0.35,
  scales: 0.9,
  shell: 0.6,
};

export const DRESS = {
  /** A body is comfortable bare at this warmth (°C) in its coldest months; this many degrees under it, it needs all clothes can give. */
  comfort: 16,
  span: 24,
  /** The share of the clothes it once wanted everywhere that a land wants with no cold at all (modesty, carrying, the sun's glare). */
  least: 0.5,
  /** How much more it wants for show, at the most. */
  display: 0.6,
} as const;

/** What a body's coat leaves to clothes (1 where its skin is not known). */
export function coatOf(skin: string | null | undefined): number {
  return skin ? (COAT[skin] ?? 1) : 1;
}

/** The warmth a land's people need of clothes (0 … 1), by its cold months and their coat; none in the water. */
export function warmthNeeded(
  temperature: number,
  seasonality: number,
  coat: number,
  water: boolean,
): number {
  if (water) return 0;
  const low = temperature - 0.5 * Math.abs(seasonality);
  return clamp01((DRESS.comfort - low) / DRESS.span) * clamp01(coat);
}

/** How far clothes show who one is (0 … 1): wealth's top tenth's share, towns, against a devout people's plainness. */
export function displayOf(top: number, towns: number, piety: number): number {
  return clamp01((top - 0.25) * 2.5) * (0.3 + 0.7 * clamp01(towns)) * (1 - 0.4 * clamp01(piety));
}

/** The clothes a land wants against what it once wanted everywhere (0.3 a head a year): for warmth, and for show. */
export function dressWanted(need: number, display: number): number {
  return dmath.clamp(
    DRESS.least + (1 - DRESS.least) * clamp01(need) + DRESS.display * clamp01(display),
    0.2,
    1.6,
  );
}

/** What a land's clothes are made of, as shares: wool, hides, woven fibre (by what it has of each, in a year's making). */
export function dressStuff(
  wool: number,
  hides: number,
  fibre: number,
): { wool: number; hides: number; fibre: number } {
  const all = Math.max(0, wool) + Math.max(0, hides) + Math.max(0, fibre);
  if (all <= 0) return { wool: 0, hides: 0, fibre: 0 };
  return {
    wool: Math.max(0, wool) / all,
    hides: Math.max(0, hides) / all,
    fibre: Math.max(0, fibre) / all,
  };
}
