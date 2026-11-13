// node tools/life-time.ts [from=0] [to=20]: how long a world takes to make with its life read from its numbers, against the
// same world kept as it was made before B3 ("~bodies kept"), in one process, each world made both ways in turn.
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld } from "../src/gen/index.ts";
import { OPEN, keptLife } from "../src/rules/index.ts";

const [from = 0, to = 20] = process.argv.slice(2).map(Number);
let read = 0,
  kept = 0;
// (One of each first, unmeasured: the code warmed.)
generateHomeWorld(seedFromText("alien 999"), OPEN, 64);
generateHomeWorld(seedFromText(keptLife("alien 999")), OPEN, 64);
for (let i = from; i < to; i++) {
  const seed = `alien ${i}`;
  let t = performance.now();
  generateHomeWorld(seedFromText(keptLife(seed)), OPEN, 64);
  kept += performance.now() - t;
  t = performance.now();
  generateHomeWorld(seedFromText(seed), OPEN, 64);
  read += performance.now() - t;
}
const n = to - from;
console.log(
  `${n} worlds: read from their numbers ${(read / n).toFixed(0)} ms each, kept as before ${(kept / n).toFixed(0)} ms each (${((100 * (read - kept)) / kept).toFixed(1)}%)`,
);
