// node tools/cost.ts [seed] [years] [--universe earth|alien] [--json out] [--alloc N] [--jump] — where a world's year goes.
//
// A world is run year by year with the scheduler's own tally on (kernel/schedule.ts: off, nothing is timed and nothing
// read; the tally is the host's and no part of history), and each system's and agenda handler's work is told:
//
//   - its milliseconds a year (mean and p99 over the run), its share of the last two centuries, and its cost about
//     years 100, 500, 1,000 and 1,500, with the count it most nearly goes by (peopled lands, realms, towns, people,
//     or the year itself: a cost that grows with the world's age alone) and the power of it (1: in step with it; 2:
//     with its square). Counts that move together in one world cannot be told apart by it: set worlds side by side;
//   - what it allocates a year: every --alloc'th year (25 unless said; 0: never) the young heap is emptied before each
//     system and the heap read after it. A system that allocates more than the young heap holds is under-told; the
//     tool starts itself again with a young heap of 256 MB so that few are;
//   - what it wrote: events and decisions a year, which no machine's clock changes (the budget gate holds these);
//   - at each of those years the save: its milliseconds (made, written out, gzipped), every store's bytes as written
//     and gzipped, and the heap the worker would hold after a full collection; at the last, the largest stores' heap,
//     each loaded alone into a world just made (an estimate: what a store builds only as it runs is not in it);
//   - with --jump, the deep-time path as the host runs it (host/host.ts: the same moments in slices of 100 ms, with
//     no tally), a century at a time, to set beside the year-by-year run.
//
// The seed may carry its making ("first light ~size small"). --json writes everything read, for tools/budget-gate.ts.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { politiesOf, populationContext, warsOf } from "../src/sim/index.ts";

/** What a system or handler is part of, by its order key's name ("125.economy.year": the economy). */
const DOMAINS: readonly (readonly [RegExp, string])[] = [
  [/^population\./, "population"],
  [/^hand\./, "lives"],
  [/^(weather|climate)\./, "climate"],
  [/^(ecology|woods|herds)\./, "ecology"],
  [/^(economy|lodes)\./, "economy"],
  [/^(knowledge|lore|lessons)\./, "lore and learning"],
  [/^culture\./, "culture"],
  [/^(acts|wild)\.|^war\.godhosts/, "acts"],
  [/^polity\./, "polity"],
  [/^belief\./, "belief"],
  [/^war\./, "war"],
  [/^diplomacy\./, "diplomacy"],
  [/^order\./, "order"],
  [/^health\./, "health"],
  [/^(credit|finance)\./, "credit and finance"],
  [/^strife\./, "strife and courts"],
  [/^(city|town)\./, "town fabric"],
  [/^design\./, "design"],
  [/^space\./, "space"],
  [/^(history|checkpoint)/, "checkpoint and history"],
  [/^commands/, "commands"],
];
export function domainOf(key: string): string {
  const name = key.replace(/^\d+\./, "");
  return DOMAINS.find(([re]) => re.test(name))?.[1] ?? name.split(".")[0]!;
}

/** The counts a system's work may go by. */
export const DRIVERS = ["lands", "realms", "towns", "people", "year"] as const;
export type Facts = Record<(typeof DRIVERS)[number], number> & { wars: number };

export function factsOf(world: World): Facts {
  const ctx = populationContext(world);
  let lands = 0,
    people = 0;
  for (const p of ctx.provinces.all()) {
    const n = p.total();
    if (n > 0) lands++;
    people += n;
  }
  return {
    year: Math.round(world.now / YEAR),
    lands,
    people,
    realms: politiesOf(world)
      .all()
      .filter((p) => p.ended === null).length,
    towns: ctx.settlements.all().length,
    wars: warsOf(world)
      .all()
      .filter((w) => w.ended === null).length,
  };
}

export type SaveReading = {
  readonly year: number;
  /** Milliseconds to make the document, write it out and gzip it. */
  readonly makeMs: number;
  readonly writeMs: number;
  readonly gzipMs: number;
  /** The whole save as written, and gzipped. */
  readonly bytes: number;
  readonly gz: number;
  /** Each store as written (and gzipped alone), largest first. */
  readonly stores: readonly (readonly [name: string, bytes: number, gz: number])[];
  /** The heap after a full collection, the save let go (null: no collector to ask), and the buffers outside it. */
  readonly heap: number | null;
  readonly outside: number;
};

export type SystemCost = {
  readonly key: string;
  readonly domain: string;
  /** Milliseconds a year over the whole run: mean, and the 99th year in a hundred. */
  readonly mean: number;
  readonly p99: number;
  /** Over the last window: milliseconds a year, and its share of the systems' work. */
  readonly last: number;
  readonly share: number;
  /** About each marked year (the fifty years to it). */
  readonly at: readonly number[];
  /** The count it most nearly goes by, the power of it, and how well (R²); null: too little to tell. */
  readonly fit: { readonly by: string; readonly power: number; readonly r2: number } | null;
  /** Bytes allocated a year over the last window's sampled years (null: not sampled). */
  readonly alloc: number | null;
  /** Events and decisions written a year over the last window: the same on every machine. */
  readonly events: number;
  readonly decisions: number;
};

export type CostReport = {
  readonly universe: string;
  readonly seed: string;
  readonly years: number;
  readonly window: number;
  readonly marks: readonly number[];
  readonly facts: readonly Facts[];
  /** A year's wall clock: mean, p99, slowest; over the last window; and about each mark. */
  readonly year: {
    readonly mean: number;
    readonly p99: number;
    readonly slowest: number;
    readonly last: number;
    readonly lastP99: number;
    readonly at: readonly number[];
  };
  /** A year's work outside every system (the scheduler, the agenda's keeping), over the last window. */
  readonly outside: number;
  readonly systems: readonly SystemCost[];
  readonly domains: readonly {
    readonly name: string;
    readonly last: number;
    readonly share: number;
    readonly at: readonly number[];
    readonly alloc: number | null;
  }[];
  readonly saves: readonly SaveReading[];
  /** The largest stores' heap, each loaded alone into a world just made (bytes): an estimate. */
  readonly storeHeap: readonly (readonly [string, number])[];
  readonly ms: number;
};

const collect = (globalThis as { gc?: (o?: { type: "minor" | "major" }) => void }).gc;
const used = () => process.memoryUsage().heapUsed;

function buildWorld(universe: string, seed: string): World {
  return (universe === "earth" ? EARTH : ALIEN).build(seedFromText(seed));
}

function mean(xs: ArrayLike<number>, from = 0, to = xs.length): number {
  let s = 0;
  for (let i = Math.max(0, from); i < to; i++) s += xs[i]!;
  return to > from ? s / (to - Math.max(0, from)) : 0;
}
function p99(xs: ArrayLike<number>, from = 0, to = xs.length): number {
  const sorted = Array.from({ length: to - from }, (_, i) => xs[from + i]!).sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] ?? 0;
}

/** log y = a + b log x by least squares: b and R² (null: under four points, or x never moves). */
function powerFit(xs: number[], ys: number[]): { power: number; r2: number } | null {
  const pts = xs.map((x, i) => [x, ys[i]!] as const).filter(([x, y]) => x > 0 && y > 0);
  if (pts.length < 4) return null;
  const lx = pts.map(([x]) => Math.log(x)),
    ly = pts.map(([, y]) => Math.log(y)),
    mx = mean(lx),
    my = mean(ly);
  let sxx = 0,
    sxy = 0,
    syy = 0;
  for (let i = 0; i < lx.length; i++) {
    sxx += (lx[i]! - mx) ** 2;
    sxy += (lx[i]! - mx) * (ly[i]! - my);
    syy += (ly[i]! - my) ** 2;
  }
  if (sxx < 1e-6 || syy < 1e-9) return null;
  return { power: sxy / sxx, r2: (sxy * sxy) / (sxx * syy) };
}

export function readSave(world: World, heap = true): SaveReading {
  const made = makeSave(world);
  // (The heap read once the save made is let go: the worker holds none of it after. 2026-11-15: read while the
  // document and its text were still at hand, a world at 1,400 told 84 MB more than it holds.)
  let held: number | null = null;
  if (heap && collect) {
    collect();
    held = used();
  }
  const m = process.memoryUsage();
  return { ...made, heap: held, outside: m.arrayBuffers };
}

/** A save made and written, and how long each took. */
function makeSave(world: World): Omit<SaveReading, "heap" | "outside"> {
  const t0 = performance.now(),
    doc = saveWorld(world, rulesetId(world, "cost")),
    t1 = performance.now(),
    text = JSON.stringify(doc),
    t2 = performance.now(),
    gz = gzipSync(text).length,
    t3 = performance.now(),
    stores = Object.entries(doc.stores)
      .map(([name, chunk]) => {
        const s = JSON.stringify(chunk);
        return [name, s.length, gzipSync(s).length] as const;
      })
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return {
    year: Math.round(world.now / YEAR),
    makeMs: t1 - t0,
    writeMs: t2 - t1,
    gzipMs: t3 - t2,
    bytes: text.length,
    gz,
    stores,
  };
}

/**
 * The largest stores' heap: what each takes, loaded alone into a world just made (the heap and the buffers outside
 * it, after a full collection, less what was held before). An estimate: what a store keeps only while it runs (its
 * caches, built as they are asked for) is not in it, and a store that would not load alone is left out.
 */
function storeHeaps(world: World, universe: string, most: number): [string, number][] {
  if (!collect) return [];
  const held = () => {
      collect();
      const m = process.memoryUsage();
      return m.heapUsed + m.arrayBuffers;
    },
    fresh = buildWorld(universe, world.seed.text),
    names = world
      .storeNames()
      .map((name) => [name, JSON.stringify(world.store(name).save())?.length ?? 0] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, most),
    out: [string, number][] = [];
  for (const [name] of names) {
    try {
      const before = held();
      fresh.store(name).load(structuredClone(world.store(name).save()));
      out.push([name, Math.max(0, held() - before)]);
    } catch {
      // (It reads another store as it loads: not told.)
    }
  }
  return out.sort((a, b) => b[1] - a[1]);
}

export type CostOptions = {
  readonly universe: string;
  readonly seed: string;
  readonly years: number;
  /** Every how many years allocations are read (0: never). */
  readonly alloc?: number;
  /** The years the save and the heap are read at (and costs told about); the last year is always one. */
  readonly marks?: readonly number[];
  /** How many of the last years "now" is. */
  readonly window?: number;
  readonly storeHeap?: boolean;
  readonly told?: (line: string) => void;
};

export async function cost(o: CostOptions): Promise<CostReport> {
  const started = performance.now(),
    years = o.years,
    window = Math.min(years, o.window ?? 200),
    marks = [...new Set([...(o.marks ?? [100, 500, 1000, 1500]), years])]
      .filter((m) => m <= years)
      .sort((a, b) => a - b),
    world = buildWorld(o.universe, o.seed),
    wall = new Float64Array(years),
    rows = new Map<
      string,
      { ms: Float64Array; events: Int32Array; decisions: Int32Array; alloc: Float64Array }
    >(),
    rowOf = (key: string) => {
      let r = rows.get(key);
      if (!r)
        rows.set(
          key,
          (r = {
            ms: new Float64Array(years),
            events: new Int32Array(years),
            decisions: new Int32Array(years),
            // (-1: not read that year.)
            alloc: new Float64Array(years).fill(-1),
          }),
        );
      return r;
    };
  for (const key of world.scheduler.systemKeys()) rowOf(key);
  // The scheduler reads the clock before a piece of work and after it, then sets the work's sum: the clock's two
  // readings are where the logs' counts and the heap are read, and the setting is where they are given their key.
  let y = 0,
    sampling = false,
    open = false,
    e0 = 0,
    d0 = 0,
    h0 = 0,
    h1 = 0;
  const sink = new Map<string, number>();
  sink.set = (key: string, ms: number) => {
    const r = rowOf(key);
    r.ms[y] = r.ms[y]! + ms;
    // (The decade's forgetting takes events away: no fewer than none were written.)
    r.events[y] = r.events[y]! + Math.max(0, world.events.count - e0);
    r.decisions[y] = r.decisions[y]! + Math.max(0, world.decisions.count - d0);
    if (sampling) r.alloc[y] = Math.max(0, r.alloc[y]!) + Math.max(0, h1 - h0);
    return sink;
  };
  world.scheduler.tally = {
    clock: () => {
      if (!open) {
        open = true;
        e0 = world.events.count;
        d0 = world.decisions.count;
        if (sampling) {
          collect!({ type: "minor" });
          h0 = used();
        }
        return performance.now();
      }
      open = false;
      const now = performance.now();
      if (sampling) h1 = used();
      return now;
    },
    ms: sink,
  };
  const facts: Facts[] = [factsOf(world)],
    saves: SaveReading[] = [];
  for (y = 0; y < years; y++) {
    sampling = !!collect && !!o.alloc && (y + 1) % o.alloc === 0;
    const a = performance.now();
    world.runTo((y + 1) * YEAR);
    wall[y] = performance.now() - a;
    // (The event loop turned between years, as the host's loop turns it: tools/sky-survey.ts.)
    await new Promise((turned) => setImmediate(turned));
    if ((y + 1) % 50 === 0) facts.push(factsOf(world));
    if (marks.includes(y + 1)) {
      saves.push(readSave(world));
      o.told?.(
        `  year ${y + 1}: ${mean(wall, y - 49, y + 1).toFixed(0)} ms a year, ${facts.at(-1)!.lands} lands, ${facts.at(-1)!.realms} realms, ${facts.at(-1)!.towns} towns, ${(facts.at(-1)!.people / 1e6).toFixed(2)} M people`,
      );
    }
  }
  world.scheduler.tally = null;
  const from = years - window,
    about = (xs: ArrayLike<number>) => marks.map((m) => mean(xs, m - 50, m)),
    // Fifty years at a time, each beside the counts at its end.
    bins = facts.slice(1),
    binned = (xs: ArrayLike<number>) => bins.map((_, i) => mean(xs, i * 50, i * 50 + 50)),
    fitOf = (xs: ArrayLike<number>): SystemCost["fit"] => {
      const ys = binned(xs);
      let best: SystemCost["fit"] = null;
      for (const by of DRIVERS) {
        const xs = bins.map((b) => b[by]),
          least = Math.min(...xs);
        // (A count that hardly moves over the run tells nothing of what goes by it.)
        if (least <= 0 || Math.max(...xs) < least * 1.5) continue;
        const f = powerFit(xs, ys);
        if (f && (!best || f.r2 > best.r2))
          best = { by, power: Math.round(f.power * 100) / 100, r2: Math.round(f.r2 * 100) / 100 };
      }
      return best;
    },
    allocOf = (xs: Float64Array) => {
      let s = 0,
        n = 0;
      for (let i = from; i < years; i++)
        if (xs[i]! >= 0) {
          s += xs[i]!;
          n++;
        }
      return n ? s / n : null;
    };
  let work = 0;
  for (const r of rows.values()) work += mean(r.ms, from, years);
  const systems: SystemCost[] = [...rows]
    .map(([key, r]) => {
      const last = mean(r.ms, from, years);
      return {
        key,
        domain: domainOf(key),
        mean: mean(r.ms),
        p99: p99(r.ms),
        last,
        share: work ? last / work : 0,
        at: about(r.ms),
        fit: fitOf(r.ms),
        alloc: allocOf(r.alloc),
        events: mean(r.events, from, years),
        decisions: mean(r.decisions, from, years),
      };
    })
    .sort((a, b) => b.last - a.last || (a.key < b.key ? -1 : 1));
  const byDomain = new Map<string, SystemCost[]>();
  for (const s of systems) byDomain.set(s.domain, [...(byDomain.get(s.domain) ?? []), s]);
  const domains = [...byDomain]
    .map(([name, of]) => ({
      name,
      last: of.reduce((a, s) => a + s.last, 0),
      share: of.reduce((a, s) => a + s.share, 0),
      at: marks.map((_, i) => of.reduce((a, s) => a + s.at[i]!, 0)),
      alloc: of.some((s) => s.alloc !== null) ? of.reduce((a, s) => a + (s.alloc ?? 0), 0) : null,
    }))
    .sort((a, b) => b.last - a.last);
  return {
    universe: o.universe,
    seed: o.seed,
    years,
    window,
    marks,
    facts,
    year: {
      mean: mean(wall),
      p99: p99(wall),
      slowest: Math.max(...wall),
      last: mean(wall, from, years),
      lastP99: p99(wall, from, years),
      at: about(wall),
    },
    outside: Math.max(0, mean(wall, from, years) - work),
    systems,
    domains,
    saves,
    storeHeap: o.storeHeap === false ? [] : storeHeaps(world, o.universe, 20),
    ms: performance.now() - started,
  };
}

/** The deep-time path as the host runs it: slices of 100 ms of the world's own steps, no tally; ms a year by the century. */
export async function jump(universe: string, seed: string, years: number): Promise<number[]> {
  const world = buildWorld(universe, seed),
    steps = world.advance(years * YEAR),
    out: number[] = [];
  let ms = 0,
    done = false,
    century = 1;
  while (!done) {
    const start = performance.now();
    while (performance.now() - start < 100) {
      if (steps.next().done) {
        done = true;
        break;
      }
      if (world.now >= century * 100 * YEAR && !world.scheduler.midMoment) break;
    }
    ms += performance.now() - start;
    const lived = world.now / YEAR - (century - 1) * 100;
    if (world.now >= century * 100 * YEAR || (done && lived >= 1)) {
      out.push(ms / lived);
      ms = 0;
      century++;
    }
    await new Promise((turned) => setImmediate(turned));
  }
  return out;
}

const ms = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const mb = (x: number | null) => (x === null ? "-" : (x / 1e6).toFixed(x < 1e5 ? 3 : 2));
const pad = (s: string, n: number) => (n < 0 ? s.padEnd(-n) : s.padStart(n));

export function tell(r: CostReport): string {
  const out: string[] = [],
    f = r.facts.at(-1)!,
    marks = r.marks.map((m) => pad(`@${m}`, 7)).join("");
  out.push(
    `== ${r.universe}:${r.seed}, to year ${r.years} (run in ${Math.round(r.ms / 1000)} s): ${f.lands} peopled lands, ${f.realms} realms, ${f.towns} towns, ${(f.people / 1e6).toFixed(2)} M people, ${f.wars} wars`,
  );
  out.push(
    `a year: mean ${ms(r.year.mean)} ms, p99 ${ms(r.year.p99)}, slowest ${ms(r.year.slowest)}; the last ${r.window} years ${ms(r.year.last)} (p99 ${ms(r.year.lastP99)}), ${ms(r.outside)} of it outside every system; about${marks}: ${r.year.at.map(ms).join(" ")}`,
  );
  out.push(
    `${pad("domain", -24)}${pad("ms/yr", 8)}${pad("share", 7)}${marks}${pad("MB/yr", 8)}   (the last ${r.window} years)`,
  );
  for (const d of r.domains)
    out.push(
      `${pad(d.name, -24)}${pad(ms(d.last), 8)}${pad((d.share * 100).toFixed(1) + "%", 7)}${d.at.map((x) => pad(ms(x), 7)).join("")}${pad(mb(d.alloc), 8)}`,
    );
  out.push(
    `${pad("system", -28)}${pad("mean", 7)}${pad("p99", 7)}${pad("now", 7)}${pad("share", 7)}${marks}  ${pad("goes by", -18)}${pad("MB/yr", 7)}${pad("ev/yr", 8)}${pad("dec/yr", 8)}`,
  );
  for (const s of r.systems)
    out.push(
      `${pad(s.key, -28)}${pad(ms(s.mean), 7)}${pad(ms(s.p99), 7)}${pad(ms(s.last), 7)}${pad((s.share * 100).toFixed(1) + "%", 7)}${s.at.map((x) => pad(ms(x), 7)).join("")}  ${pad(s.fit ? `${s.fit.by}^${s.fit.power} (${s.fit.r2})` : "-", -18)}${pad(mb(s.alloc), 7)}${pad(s.events.toFixed(1), 8)}${pad(s.decisions.toFixed(1), 8)}`,
    );
  for (const s of r.saves)
    out.push(
      `save at ${s.year}: ${mb(s.bytes)} MB written (${mb(s.gz)} gzipped); made in ${ms(s.makeMs)} ms, written ${ms(s.writeMs)}, gzipped ${ms(s.gzipMs)}; heap ${mb(s.heap)} MB, ${mb(s.outside)} outside it\n    ${s.stores
        .slice(0, 12)
        .map(([name, b, gz]) => `${name} ${mb(b)} (${mb(gz)})`)
        .join(", ")}`,
    );
  if (r.storeHeap.length)
    out.push(
      `heap by store, each loaded alone into a new world (MB, an estimate): ${r.storeHeap.map(([n, b]) => `${n} ${mb(b)}`).join(", ")}`,
    );
  return out.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2),
    flag = (name: string) => {
      const i = argv.indexOf(name);
      return i >= 0 ? argv[i + 1] : undefined;
    },
    valued = new Set(["--universe", "--json", "--alloc"]),
    plain = argv.filter((a, i) => !a.startsWith("--") && !valued.has(argv[i - 1] ?? "")),
    seed = plain[0] ?? "first light",
    years = Number(plain[1] ?? 1500),
    universe = flag("--universe") ?? (/^(first light|tide \d+)/.test(seed) ? "earth" : "alien");
  if (!collect) {
    // A collector to ask, and a young heap few systems fill in one year's turn.
    const again = spawnSync(
      process.execPath,
      [
        "--expose-gc",
        "--min-semi-space-size=256",
        "--max-semi-space-size=256",
        "--max-old-space-size=6144",
        process.argv[1],
        ...argv,
      ],
      { stdio: "inherit" },
    );
    process.exit(again.status ?? 1);
  }
  if (argv.includes("--jump")) {
    const by = await jump(universe, seed, years);
    console.log(
      `== ${universe}:${seed}, the jump's path to year ${years}: ms a year by the century: ${by.map(ms).join(" ")}; ${Math.round(by.reduce((a, b) => a + b * 100, 0) / 1000)} s in all`,
    );
  } else {
    console.log(`== ${universe}:${seed}`);
    const report = await cost({
      universe,
      seed,
      years,
      alloc: Number(flag("--alloc") ?? 25),
      told: (line) => console.log(line),
    });
    console.log(tell(report));
    const out = flag("--json");
    if (out) writeFileSync(out, JSON.stringify(report) + "\n");
  }
}
