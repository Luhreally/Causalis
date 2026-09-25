// What tools/engines.ts runs inside each browser: every golden suite, by name.
// Later milestones add the simulation's checkpoint hash chains here.
import { kernelDigest, kernelVectors } from "./kernel.ts";

export type SuiteResult = { digest: string; vectors: [string, string][] };

export const suites: Record<string, () => SuiteResult> = {
  kernel: () => {
    const vectors = kernelVectors();
    return { digest: kernelDigest(vectors), vectors };
  },
};

export function run(): Record<string, SuiteResult> {
  const out: Record<string, SuiteResult> = {};
  for (const [name, suite] of Object.entries(suites)) out[name] = suite();
  return out;
}
