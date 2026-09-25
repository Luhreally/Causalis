// What tools/engines.ts runs inside each browser: every golden suite, by name.
// The kernel's vectors, and the oracle fixtures' checkpoint chains.
import { kernelDigest, kernelVectors } from "./kernel.ts";
import { FIXTURES, recordFixture } from "./oracle.ts";

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

export function run(): Record<string, SuiteResult> {
  const out: Record<string, SuiteResult> = {};
  for (const [name, suite] of Object.entries(suites)) out[name] = suite();
  return out;
}
