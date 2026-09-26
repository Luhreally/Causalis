// What tools/engines.ts runs inside each browser: every golden suite, by name.
// The kernel's vectors, the oracle fixtures' checkpoint chains, refined regions, and
// the people an observer meets (their lives are drawn with the same keyed streams).
import { kernelDigest, kernelVectors } from "./kernel.ts";
import { FIXTURES, recordFixture } from "./oracle.ts";
import {
  Hasher,
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
} from "../../src/kernel/index.ts";
import { EARTHLIKE } from "../../src/rules/index.ts";
import { generateHomeWorld, refineRegion } from "../../src/gen/index.ts";
import { homePlanet, makePopulationWorld, populationContext } from "../../src/sim/index.ts";
import { deepen, meetHousehold, observer } from "../../src/causal/index.ts";

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

/** Families met in a grown world, and each member's life told in full. */
function observerVectors(): [string, string][] {
  const world = makePopulationWorld(seedFromText("first light")),
    out: [string, string][] = [];
  world.runTo(240 * YEAR);
  const villages = populationContext(world).settlements.all();
  for (let i = 0; i < 8; i++) {
    const v = villages[(i * 5) % villages.length]!,
      hh = meetHousehold(world, v.cell, v.ref);
    for (const r of hh.members) {
      const p = deepen(world, observer(world).person(r)!);
      out.push([`${hh.ref} ${r}`, new Hasher().value(p).hex()]);
    }
  }
  const ledger = new Hasher();
  observer(world).hashInto(ledger);
  out.push(["ledger", ledger.hex()]);
  return out;
}
suites.observer = () => {
  const vectors = observerVectors();
  return { digest: kernelDigest(vectors), vectors };
};

/**
 * The Phase 1 slice (docs/architecture Part VII): a peopled world with the god's
 * acts and the hand laid, saved through text, loaded, the hand lifted in both, run
 * on — every checkpoint's chain, whether the loaded copy continued as the unbroken
 * run did, and whether the save replays from its commands.
 */
function sliceVectors(): [string, string][] {
  const build = () => makePopulationWorld(seedFromText("first light")),
    world = build(),
    // Where the first people began: where the upright apes arose.
    home = homePlanet(world).generated.life.apes!.cell;
  world.runTo(120 * YEAR);
  world.submit("act.rain", { cell: home, sign: -1, years: 3 });
  world.runTo(200 * YEAR);
  world.submit("act.harvest", { cell: home, sign: 1, years: 5 });
  world.runTo(240 * YEAR);
  world.submit("hand.lay", {
    village: populationContext(world).settlements.inProvince(home)[0]!.ref,
  });
  world.runTo(260 * YEAR);
  const ruleset = rulesetId(world, "slice"),
    doc = saveWorld(world, ruleset),
    loaded = loadWorld(JSON.parse(JSON.stringify(doc)), build, ruleset).world;
  world.submit("hand.lift", {});
  loaded.submit("hand.lift", {});
  world.runTo(280 * YEAR);
  loaded.runTo(280 * YEAR);
  const chain = world.checkpoints().map((c) => c.chain),
    again = loaded.checkpoints().map((c) => c.chain);
  const out: [string, string][] = chain
    .map((c, i) => [`slice year ${i + 1}`, c] as [string, string])
    .filter((_, i) => (i + 1) % 10 === 0);
  out.push(["continues as the unbroken run", again.join() === chain.join() ? "yes" : "no"]);
  out.push(["replays from its commands", verifyByReplay(doc, build).ok ? "yes" : "no"]);
  return out;
}
suites.slice = () => {
  const vectors = sliceVectors();
  return { digest: kernelDigest(vectors), vectors };
};

export function run(): Record<string, SuiteResult> {
  const out: Record<string, SuiteResult> = {};
  for (const [name, suite] of Object.entries(suites)) out[name] = suite();
  return out;
}
