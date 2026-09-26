// node tools/phase2-gate.ts [years] [seed ...] — the Phase 2 gate (docs/architecture
// §I.2, milestone 25): on each of eleven seeds, run the app's world (bands across the
// land) for five hundred years and require that realms form and split, that they
// fight wars whose why reaches both an economic fact (a famine, a road, a market, a
// thing learned) and the ground (a place, a plate), and that the world sees four or
// more distinct ways of being ruled. Each seed runs in its own process.
import { fork } from "node:child_process";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { YEAR, seedFromText, type Ref, type World } from "../src/kernel/index.ts";
import {
  POLITY_EVENTS,
  governmentKey,
  makePopulationWorld,
  politiesOf,
  warsOf,
} from "../src/sim/index.ts";
import { why, type Explanation } from "../src/causal/index.ts";

export const GATE_SEEDS = [
  "first light",
  "kestrel",
  "amber",
  "tolvey",
  "arren",
  "moss",
  "halcyon",
  "brine",
  "cinder",
  "wren",
  "juniper",
];

type Verdict = {
  seed: string;
  ms: number;
  realms: number;
  splits: number;
  wars: number;
  explained: number;
  governments: string[];
  /** Realms standing at the end, and the largest one's share of the realms' lands. */
  living: number;
  largest: number;
  problems: string[];
};

/** Every ref the why-tree of `ref` reaches within `depth` steps (bounded). */
function reach(w: World, ref: string, depth = 9): Set<string> {
  const seen = new Set<string>([ref]);
  let level: Explanation[] = [why(w, ref as Ref)];
  for (let d = 0; d < depth && level.length; d++) {
    const next: Explanation[] = [];
    for (const node of level)
      for (const edge of node.causes) {
        if (seen.has(edge.cause.ref) || seen.size > 3000) continue;
        seen.add(edge.cause.ref);
        next.push(edge.next());
      }
    level = next;
  }
  return seen;
}

const ECONOMIC = /^(people\.famine|trade\.|settlement\.market|lore\.|knowledge\.)/;

function judge(seed: string, years: number): Verdict {
  const started = Date.now(),
    world = makePopulationWorld(seedFromText(seed), { start: "spread" }),
    realms = politiesOf(world),
    governments = new Set<string>();
  for (let y = 10; y <= years; y += 10) {
    world.runTo(y * YEAR);
    for (const p of realms.living()) governments.add(governmentKey(p));
  }
  const count = (type: string) => world.events.all().filter((e) => e.type === type).length,
    splits = count(POLITY_EVENTS.split.type) + count(POLITY_EVENTS.seceded.type),
    wars = warsOf(world).all(),
    economic = (r: string) => {
      const e = world.events.get(r as Ref);
      return e ? ECONOMIC.test(e.type) : r.startsWith("mkt:");
    },
    explained = wars.filter((w) => {
      const refs = [...reach(world, w.event)];
      return (
        refs.some((r) => r.startsWith("cell:") || r.startsWith("plate:")) && refs.some(economic)
      );
    }).length;
  const problems: string[] = [];
  if (realms.all().length < 3) problems.push(`only ${realms.all().length} realms formed`);
  if (splits < 1) problems.push("no realm split or lost lands to secession");
  if (wars.length < 1) problems.push("no wars");
  if (explained < 1) problems.push("no war's why reaches both the economy and the ground");
  if (governments.size < 4) problems.push(`only ${governments.size} ways of being ruled`);
  return {
    seed,
    ms: Date.now() - started,
    realms: realms.all().length,
    splits,
    wars: wars.length,
    explained,
    governments: [...governments].sort(),
    living: realms.living().length,
    largest:
      Math.max(0, ...realms.living().map((p) => p.members.length)) /
      Math.max(
        1,
        realms.living().reduce((s, p) => s + p.members.length, 0),
      ),
    problems,
  };
}

const args = process.argv.slice(2);
if (args[0] === "--one") {
  // A child: judge one seed and send the verdict home.
  process.send!(judge(args[1]!, Number(args[2])));
} else {
  const years = Number(args[0] ?? 500),
    seeds = args.length > 1 ? args.slice(1) : GATE_SEEDS,
    self = fileURLToPath(import.meta.url),
    lanes = Math.max(1, Math.min(seeds.length, availableParallelism() - 1)),
    queue = [...seeds],
    verdicts: Verdict[] = [];
  const lane = async () => {
    for (let seed = queue.shift(); seed !== undefined; seed = queue.shift()) {
      const s = seed;
      verdicts.push(
        await new Promise<Verdict>((done, fail) => {
          const child = fork(self, ["--one", s, String(years)]);
          child.once("message", (v) => done(v as Verdict));
          child.once("exit", (code) => code && fail(new Error(`${s} exited with ${code}`)));
        }),
      );
      const v = verdicts.at(-1)!;
      console.log(
        `${v.seed.padEnd(12)} ${String(v.realms).padStart(3)} realms, ${String(v.splits).padStart(2)} splits, ${String(v.wars).padStart(3)} wars (${v.explained} reaching economy and ground), ${v.governments.length} ways of rule; ${v.living} realms stand, the largest ${Math.round(v.largest * 100)}%  ${(v.ms / 1000).toFixed(0)} s${v.problems.length ? `  ✖ ${v.problems.join("; ")}` : ""}`,
      );
    }
  };
  await Promise.all(Array.from({ length: lanes }, lane));
  const failed = verdicts.filter((v) => v.problems.length),
    all = new Set(verdicts.flatMap((v) => v.governments));
  console.log(
    `\n${verdicts.length - failed.length} of ${verdicts.length} seeds pass over ${years} years; ${all.size} ways of rule in all`,
  );
  if (failed.length) process.exit(1);
}
