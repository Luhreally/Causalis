// The oracle's fixtures (docs/architecture §35–36): worlds run for a span, whose
// checkpoint chains are recorded in tests/golden/oracle.json. A change meant to
// leave history alone must leave every chain unchanged; a change meant to alter
// it rewrites the golden file on purpose (node tools/oracle.ts --write).
import { YEAR, type World } from "../../src/kernel/index.ts";
import { makePlanetWorld, makeToyWorld } from "../../src/sim/index.ts";
import { seedFromText } from "../../src/kernel/index.ts";

export type Fixture = { readonly name: string; readonly years: number; readonly make: () => World };

export const FIXTURES: readonly Fixture[] = [
  { name: "toy/alpha", years: 30, make: () => makeToyWorld("alpha") },
  { name: "toy/beta", years: 30, make: () => makeToyWorld("beta") },
  { name: "earth/first-light", years: 2, make: () => makePlanetWorld(seedFromText("first light")) },
  { name: "earth/kestrel", years: 2, make: () => makePlanetWorld(seedFromText("kestrel")) },
];

export type FixtureRecord = {
  name: string;
  checkpoints: { t: number; chain: string; domains: [string, string][] }[];
};

export function recordFixture(fixture: Fixture, years = fixture.years): FixtureRecord {
  const world = fixture.make();
  world.runTo(years * YEAR);
  return {
    name: fixture.name,
    checkpoints: world.checkpoints().map((c) => ({
      t: c.t,
      chain: c.chain,
      domains: c.domains.map(([d, h]) => [d, h] as [string, string]),
    })),
  };
}

/** Where two records first part: the checkpoint and the domains that differ there. */
export function firstDivergence(a: FixtureRecord, b: FixtureRecord): string | null {
  const n = Math.max(a.checkpoints.length, b.checkpoints.length);
  for (let i = 0; i < n; i++) {
    const x = a.checkpoints[i],
      y = b.checkpoints[i];
    if (!x || !y) return `${a.name}: checkpoint ${i} exists in only one record`;
    if (x.chain === y.chain) continue;
    const domains = x.domains
      .filter(([d, h]) => y.domains.find(([e]) => e === d)?.[1] !== h)
      .map(([d]) => d);
    return `${a.name}: first differs at t=${x.t} (checkpoint ${i}), domains ${domains.join(", ") || "(chain only)"}`;
  }
  return null;
}
