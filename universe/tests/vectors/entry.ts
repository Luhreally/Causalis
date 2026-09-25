// What tools/engines.ts runs inside each browser: every golden suite, by name.
// The kernel's vectors, and the oracle fixtures' checkpoint chains.
import { kernelDigest, kernelVectors } from "./kernel.ts";
import { FIXTURES, recordFixture } from "./oracle.ts";
import { Hasher, seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE } from "../../src/rules/index.ts";
import { generateHomeWorld, refineRegion } from "../../src/gen/index.ts";

export type SuiteResult = { digest: string; vectors: [string, string][] };

export const suites: Record<string, () => SuiteResult> = {
  kernel: () => {
    const vectors = kernelVectors();
    return { digest: kernelDigest(vectors), vectors };
  },
  oracle: () => {
    const vectors: [string, string][] = [];
    for (const fixture of FIXTURES)
      for (const c of recordFixture(fixture).checkpoints) {
        vectors.push([`${fixture.name}@${c.t}`, c.chain]);
        for (const [d, h] of c.domains) vectors.push([`${fixture.name}@${c.t}/${d}`, h]);
      }
    return { digest: kernelDigest(vectors), vectors };
  },
};

/** Regions refined from a generated world: each field's hash, per region. */
function regionVectors(): [string, string][] {
  const w = generateHomeWorld(seedFromText("first light"), EARTHLIKE),
    out: [string, string][] = [];
  for (const center of [8558, 688, 20578]) {
    const r = refineRegion(w, center);
    for (const [name, a] of Object.entries({
      elevation: r.elevation,
      temperature: r.temperature,
      precipitation: r.precipitation,
      water: r.water,
      discharge: r.discharge,
      fertility: r.fertility,
    })) {
      const h = new Hasher();
      for (let i = 0; i < a.length; i++) h.float(a[i]!);
      out.push([`region ${center} ${name}`, h.hex()]);
    }
  }
  return out;
}
suites.regions = () => {
  const vectors = regionVectors();
  return { digest: kernelDigest(vectors), vectors };
};

export function run(): Record<string, SuiteResult> {
  const out: Record<string, SuiteResult> = {};
  for (const [name, suite] of Object.entries(suites)) out[name] = suite();
  return out;
}
