import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld, refineRegion } from "../src/gen/index.ts";
import { EARTHLIKE } from "../src/rules/index.ts";
const w = generateHomeWorld(seedFromText("first light"), EARTHLIKE);
let t0 = performance.now();
const n = 20;
for (let i = 0; i < n; i++) refineRegion(w, w.life.people!.cell + i);
console.log("refineRegion avg ms", ((performance.now() - t0) / n).toFixed(1));
