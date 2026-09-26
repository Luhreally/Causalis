// What tools/slice.ts runs in a slowed browser tab: the app's world, simulated alone
// (no drawing), year by year, timing each year with the tab's own clock.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";

export function run(years: number, seed = "first light"): { perYear: number[]; built: number } {
  const t0 = performance.now(),
    world = EARTH.build(seedFromText(seed)),
    built = performance.now() - t0,
    perYear: number[] = [];
  let last = performance.now();
  for (let y = 1; y <= years; y++) {
    world.runTo(y * YEAR);
    const now = performance.now();
    perYear.push(now - last);
    last = now;
  }
  return { perYear, built };
}
