// Where a seed's first people began (the cell the upright apes arose in), for tests
// that watch the cradle's land.
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld } from "../src/gen/index.ts";
import { EARTHLIKE } from "../src/rules/index.ts";

export function cradleCell(seed: string): number {
  return generateHomeWorld(seedFromText(seed), EARTHLIKE).life.apes!.cell;
}
