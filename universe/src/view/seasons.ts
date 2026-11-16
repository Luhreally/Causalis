// The farming year (Phase 39 M198; kept apart since Phase 44 M206, so that the countryside, the
// year in its fields and the day's errands share it): its seasons as shares of the year (0 … 1).

/** The share of the year gone (0 … 1) when the fields are ripe and reaped; when they are sown (rules/seasons.ts: what a people must put by is reckoned from them). */
export { HARVEST, SOWING } from "../rules/index.ts";
/** From this share of the year until the sowing, the fields lie fallow: the slack season. */
export const WINTER = 0.9;

/** One day in seven is a day of rest, on a day kept by the village: given to play and talk. */
export function restDay(plan: { readonly seed: number }, day: number): boolean {
  return (day + (plan.seed % 7)) % 7 === 0;
}
