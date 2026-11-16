// node tools/budget-gate.ts [--ci] [--write] [--only name] [--strict] [--budgets file] — gate 122, what a system may cost.
//
// Each world of tools/budgets.json is run to its year with the scheduler's tally on (tools/cost.ts) and held to
// its rows there:
//
//   - every system and agenda handler has a row (one without is told to register its budget);
//   - what no machine's clock changes fails the gate: the events and decisions each system writes a year, every
//     store's bytes as a save writes it, the save whole;
//   - each system's share of the year's work fails it too: a share is the same work on a fast machine and a slow
//     one, near enough, and its budget carries a point and a half above its headroom for what is left;
//   - the heap after a full collection fails it;
//   - milliseconds (a year's mean and p99, each system's) are only told as warnings: a shared runner's clock is
//     no one's budget. --strict fails on them too, for a quiet machine.
//
// --ci leaves out the worlds marked far (the default world to year 1,500, where the stars' systems work): those
// run here. --write measures and writes each world's rows afresh with the file's headroom over what was read, the
// checklist kept: after a change that is meant to cost more, and said so. --only runs the world of that name;
// --budgets reads (and writes) another file than tools/budgets.json.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cost, type CostReport } from "./cost.ts";

type SystemBudget = { share: number; ms: number; events: number; decisions: number };
type WorldBudget = {
  name: string;
  universe: string;
  seed: string;
  year: number;
  window: number;
  far?: boolean;
  /** What the world held when the budgets were set (no budget: a history that moved is told, not failed). */
  world: { lands: number; realms: number; towns: number; people: number };
  totals: { yearMs: number; p99Ms: number; saveBytes: number; heapBytes: number };
  systems: Record<string, SystemBudget>;
  stores: Record<string, number>;
};
type Budgets = { checklist: string[]; headroom: number; worlds: WorldBudget[] };

const argv = process.argv.slice(2),
  path = argv.includes("--budgets")
    ? argv[argv.indexOf("--budgets") + 1]!
    : fileURLToPath(new URL("./budgets.json", import.meta.url)),
  ci = argv.includes("--ci"),
  write = argv.includes("--write"),
  strict = argv.includes("--strict"),
  only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : undefined;

if (!(globalThis as { gc?: unknown }).gc) {
  // (A collector to ask, for the heap's reading.)
  const again = spawnSync(
    process.execPath,
    ["--expose-gc", "--max-old-space-size=6144", process.argv[1]!, ...argv],
    { stdio: "inherit" },
  );
  process.exit(again.status ?? 1);
}

const budgets = JSON.parse(readFileSync(path, "utf8")) as Budgets,
  /** Above the headroom: a point and a half of the year for a share, one event, two thousand bytes. */
  SHARE_SLACK = 0.015,
  COUNT_SLACK = 1,
  BYTES_SLACK = 2000,
  round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places,
  pct = (x: number) => `${(x * 100).toFixed(1)}%`,
  mb = (x: number) => `${(x / 1e6).toFixed(2)} MB`;

function measured(w: WorldBudget, r: CostReport): WorldBudget {
  const h = budgets.headroom,
    save = r.saves.at(-1)!,
    f = r.facts.at(-1)!;
  return {
    name: w.name,
    universe: w.universe,
    seed: w.seed,
    year: w.year,
    window: w.window,
    ...(w.far ? { far: true } : {}),
    world: { lands: f.lands, realms: f.realms, towns: f.towns, people: f.people },
    totals: {
      yearMs: Math.ceil(r.year.last * h),
      p99Ms: Math.ceil(r.year.lastP99 * h),
      saveBytes: Math.ceil(save.bytes * h),
      heapBytes: Math.ceil((save.heap ?? 0) * h),
    },
    systems: Object.fromEntries(
      [...r.systems]
        .sort((a, b) => (a.key < b.key ? -1 : 1))
        .map((s) => [
          s.key,
          {
            share: round(s.share * h + SHARE_SLACK, 4),
            ms: round(s.last * h + 0.5, 2),
            events: round(s.events * h + COUNT_SLACK, 1),
            decisions: round(s.decisions * h + COUNT_SLACK, 1),
          },
        ]),
    ),
    stores: Object.fromEntries(
      [...save.stores]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([name, bytes]) => [name, Math.ceil(bytes * h + BYTES_SLACK)]),
    ),
  };
}

const problems: string[] = [],
  warnings: string[] = [],
  written: WorldBudget[] = [];
for (const w of budgets.worlds) {
  if ((only && w.name !== only) || (ci && w.far)) {
    written.push(w);
    continue;
  }
  const r = await cost({
      universe: w.universe,
      seed: w.seed,
      years: w.year,
      window: w.window,
      marks: [w.year],
      alloc: 0,
      storeHeap: false,
    }),
    save = r.saves.at(-1)!,
    f = r.facts.at(-1)!,
    at = `${w.name} (${w.universe}:${w.seed} at ${w.year})`,
    top = r.systems
      .slice(0, 5)
      .map((s) => `${s.key} ${pct(s.share)}`)
      .join(", ");
  console.log(
    `${at}: a year ${r.year.last.toFixed(0)} ms (p99 ${r.year.lastP99.toFixed(0)}) over its last ${w.window}; save ${mb(save.bytes)} as written (${mb(save.gz)} gzipped), heap ${mb(save.heap ?? 0)}; ${f.lands} lands, ${f.realms} realms, ${f.towns} towns; run in ${Math.round(r.ms / 1000)} s\n    most of the year: ${top}`,
  );
  if (write) {
    written.push(measured(w, r));
    continue;
  }
  if (worldMoved(w, f))
    console.log(
      `    (this world is not the one the budgets were set on: it held ${w.world.lands} lands, ${w.world.realms} realms, ${w.world.towns} towns then. The rules moved its history; what follows compares the two.)`,
    );
  for (const s of r.systems) {
    const b = w.systems[s.key];
    if (!b) {
      problems.push(
        `${at}: ${s.key} has no budget row (it takes ${pct(s.share)} of a year, ${s.last.toFixed(2)} ms): register it in tools/budgets.json`,
      );
      continue;
    }
    if (s.share > b.share)
      problems.push(
        `${at}: ${s.key} takes ${pct(s.share)} of a year's work, over its budget of ${pct(b.share)} (${s.last.toFixed(1)} ms of ${r.year.last.toFixed(0)})`,
      );
    if (s.events > b.events)
      problems.push(
        `${at}: ${s.key} writes ${s.events.toFixed(1)} events a year, over its budget of ${b.events}`,
      );
    if (s.decisions > b.decisions)
      problems.push(
        `${at}: ${s.key} writes ${s.decisions.toFixed(1)} decisions a year, over its budget of ${b.decisions}`,
      );
    // (Where the whole year ran slow the machine did, and every system with it: told once, below.)
    if (s.last > b.ms && r.year.last <= w.totals.yearMs)
      warnings.push(`${at}: ${s.key} took ${s.last.toFixed(1)} ms a year (budget ${b.ms})`);
  }
  for (const [name, bytes] of save.stores) {
    const b = w.stores[name];
    if (b === undefined)
      problems.push(
        `${at}: the store ${name} has no budget row (${bytes} bytes as written): register it in tools/budgets.json`,
      );
    else if (bytes > b)
      problems.push(
        `${at}: the store ${name} is ${bytes} bytes as written, over its budget of ${b}`,
      );
  }
  if (save.bytes > w.totals.saveBytes)
    problems.push(
      `${at}: the save is ${mb(save.bytes)} as written, over ${mb(w.totals.saveBytes)}`,
    );
  if ((save.heap ?? 0) > w.totals.heapBytes)
    problems.push(
      `${at}: the heap holds ${mb(save.heap ?? 0)} after a full collection, over ${mb(w.totals.heapBytes)}`,
    );
  if (r.year.last > w.totals.yearMs)
    warnings.push(
      `${at}: a year took ${r.year.last.toFixed(0)} ms (budget ${w.totals.yearMs}); its systems' milliseconds are not set against theirs`,
    );
  if (r.year.lastP99 > w.totals.p99Ms)
    warnings.push(
      `${at}: a year's p99 was ${r.year.lastP99.toFixed(0)} ms (budget ${w.totals.p99Ms})`,
    );
}

function worldMoved(w: WorldBudget, f: { lands: number; realms: number; towns: number }): boolean {
  return w.world.lands !== f.lands || w.world.realms !== f.realms || w.world.towns !== f.towns;
}

if (write) {
  writeFileSync(path, JSON.stringify({ ...budgets, worlds: written }, null, 2) + "\n");
  console.log(`budgets written to ${path} (headroom ${budgets.headroom})`);
} else {
  for (const w of warnings)
    console.log(`warning (the clock's, no failure${strict ? " but here" : ""}): ${w}`);
  for (const p of problems) console.log(`OVER BUDGET: ${p}`);
  const failed = problems.length + (strict ? warnings.length : 0);
  console.log(
    failed
      ? `gate 122 fails: ${failed} over budget`
      : `gate 122 passes: every system, store and total within its budget${warnings.length ? ` (${warnings.length} warnings of the clock)` : ""}`,
  );
  if (failed) process.exitCode = 1;
}
