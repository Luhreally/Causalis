// node tools/suite.ts [options] [files or folders...]: the test suite, run wide.
//
// Each test file runs in its own node process, as under `node --test`, but as many at once as the
// machine's cores and free memory allow rather than a fixed two: a file is let in only while the
// memory the running files are known to want (tools/suite-timings.json, their peak at the last
// measured run) plus its own stays under the budget, and while the machine keeps a reserve free.
// The longest files start first, so the tail is short files filling the gaps. The perf tests
// (tests/perf) measure time, so they run last and alone. A file that fails is run once more alone
// before it is called failed (and is named in the report if it then passes).
//
//   --jobs N        at most N files at once (default: cores minus two, at most 12)
//   --budget GB     the most the running files' peaks may sum to (default 20, and never more
//                   than what is free as the run begins allows: see TOGETHER)
//   --reserve GB    never start a file while less than this is free on the machine (default 6)
//   --no-perf       leave the perf tests out
//   --record        write what was measured back to tools/suite-timings.json
//   --json FILE     write this run's measurements to FILE
//   --slow N        how many of the slowest files to list (default 15)
//   --list          print the files that would run, and stop
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism, freemem } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const TIMINGS = join(root, "tools", "suite-timings.json");
const MB = 1024 ** 2;
/** Of the sum of their peaks, the share the files running at one time were measured to hold. */
const TOGETHER = 0.6;

/** What one file took at a measured run: seconds of wall time and megabytes at its peak. */
export interface Timing {
  s: number;
  mb: number;
}
export interface Result extends Timing {
  file: string;
  ok: boolean;
  /** Failed among the others, passed run again alone: what it said the first time. */
  flaked?: string;
  /** When it began and ended, in milliseconds since the run began. */
  from: number;
  to: number;
  tests: number;
  pass: number;
  fail: number;
  output: string;
}
export interface SuiteOptions {
  jobs?: number | undefined;
  budgetGb?: number | undefined;
  reserveGb?: number | undefined;
  perf?: boolean | undefined;
  quiet?: boolean | undefined;
}

const slash = (p: string) => p.replaceAll("\\", "/");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (entry.endsWith(".test.ts")) out.push(slash(relative(root, path)));
  }
  return out;
}

/** Every test file of the suite, as paths from the universe folder. */
export function allTests(): string[] {
  return walk(join(root, "tests"));
}

export function readTimings(): Record<string, Timing> {
  return existsSync(TIMINGS) ? JSON.parse(readFileSync(TIMINGS, "utf8")) : {};
}

/** The timings as the file keeps them: a line a test file, as prettier would lay them. */
function timingsText(timings: Record<string, Timing>): string {
  const lines = Object.entries(timings).map(
    ([file, t]) => `  ${JSON.stringify(file)}: { "s": ${t.s}, "mb": ${t.mb} }`,
  );
  return `{\n${lines.join(",\n")}\n}\n`;
}

const isPerf = (file: string) => file.startsWith("tests/perf/");

function runFile(file: string): Promise<Result> {
  return new Promise((done) => {
    const began = Date.now();
    const child = spawn(
      process.execPath,
      ["--import", "./tools/suite-rss.mjs", "--test-reporter=tap", file],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      const count = (word: string) =>
        Number(out.match(new RegExp(`^# ${word} (\\d+)`, "m"))?.[1] ?? 0);
      const rss = Number(err.match(/^#suite-rss (\d+)/m)?.[1] ?? 0);
      done({
        file,
        ok: code === 0,
        from: began,
        to: Date.now(),
        s: (Date.now() - began) / 1000,
        mb: Math.round(rss / 1024),
        tests: count("tests"),
        pass: count("pass"),
        fail: count("fail"),
        output: out + err.replace(/^#suite-rss \d+\r?\n/m, ""),
      });
    });
  });
}

/** Runs the files wide (the perf tests after, alone); the results come back in the order given. */
export async function runSuite(files: string[], options: SuiteOptions = {}): Promise<Result[]> {
  const jobs = options.jobs ?? Math.max(2, Math.min(12, availableParallelism() - 2));
  const reserve = (options.reserveGb ?? 6) * 1024;
  // The files' peaks do not fall together: measured, the files running at one time hold about
  // six tenths of their peaks' sum. So the peaks let in sum to no more than what is free as
  // the run begins, less the reserve, over six tenths.
  const budget = Math.min(
    (options.budgetGb ?? 20) * 1024,
    Math.max(2048, (freemem() / MB - reserve) / TOGETHER),
  );
  const known = readTimings();
  // A file never measured is taken for a middling one.
  const want = (file: string) => known[file]?.mb ?? 1200;
  const wide = files.filter((f) => !isPerf(f)),
    alone = options.perf === false ? [] : files.filter(isPerf);
  const queue = [...wide].sort((a, b) => (known[b]?.s ?? 1e9) - (known[a]?.s ?? 1e9));
  const results = new Map<string, Result>();
  const running = new Map<string, Promise<void>>();
  let finished = 0;
  const note = (r: Result) => {
    finished++;
    if (options.quiet) return;
    if (!r.ok) console.log(`FAIL ${r.file} (${r.s.toFixed(1)}s)`);
    else if (process.stdout.isTTY)
      process.stdout.write(`\r${finished}/${files.length} ${r.file}`.padEnd(100).slice(0, 100));
  };
  const start = (file: string) => {
    running.set(
      file,
      runFile(file).then((r) => {
        results.set(file, r);
        running.delete(file);
        note(r);
      }),
    );
  };
  // A file just started has not yet taken its memory, so what the machine shows free is
  // read less what the files started in the last while are still to take.
  const fresh = new Map<string, number>();
  while (queue.length || running.size) {
    let held = 0,
      coming = 0;
    const now = Date.now();
    for (const f of running.keys()) {
      held += want(f);
      if (now - (fresh.get(f) ?? 0) < 45_000) coming += want(f) * TOGETHER;
    }
    let started = false;
    if (running.size < jobs) {
      const free = freemem() / MB - coming;
      // The first waiting file that fits: a giant waits its turn while small ones go by it.
      const at = queue.findIndex(
        (f) => running.size === 0 || (held + want(f) <= budget && free - want(f) >= reserve),
      );
      if (at >= 0) {
        const file = queue.splice(at, 1)[0]!;
        fresh.set(file, now);
        start(file);
        started = true;
      }
    }
    if (started) continue;
    // Nothing fits: wait for a file to end (or, memory being short, a moment for it to come back).
    await Promise.race([...running.values(), new Promise((r) => setTimeout(r, 2000))]);
  }
  // A file that failed among the others is run once more, alone: some tests hold a query to a
  // number of milliseconds, which a loaded machine can miss. One that passes alone is reported
  // as such (and what it said the first time kept); one that fails again has failed.
  for (const first of [...results.values()].filter((r) => !r.ok)) {
    const again = await runFile(first.file);
    if (again.ok) results.set(first.file, { ...again, flaked: first.output });
    if (!options.quiet) console.log(`${again.ok ? "passed" : "FAILED again"} alone: ${first.file}`);
  }
  for (const file of alone) {
    start(file);
    await running.get(file);
  }
  if (!options.quiet && process.stdout.isTTY) process.stdout.write("\r".padEnd(101) + "\r");
  return files.filter((f) => results.has(f)).map((f) => results.get(f)!);
}

const clock = (s: number) =>
  `${Math.floor(s / 60)}m${String(Math.floor(s % 60)).padStart(2, "0")}s`;

/** Prints a run: the failures first (with what they said), the slowest files last, then the sum. */
export function report(results: Result[], wall: number, slow = 15): boolean {
  const failed = results.filter((r) => !r.ok);
  for (const r of failed) {
    console.log(`\n=== FAILED ${r.file} ===`);
    console.log(r.output.trimEnd());
  }
  for (const r of results.filter((x) => x.flaked !== undefined)) {
    console.log(`\n=== failed among the others, passed alone: ${r.file} ===`);
    console.log(r.flaked!.trimEnd());
  }
  // The most memory the files running at one time held, were each at its peak together.
  let most = 0;
  for (const r of results) {
    let sum = 0;
    for (const o of results) if (o.from <= r.from && o.to > r.from) sum += o.mb;
    most = Math.max(most, sum);
  }
  const bySlow = [...results].sort((a, b) => a.s - b.s).slice(-slow);
  if (bySlow.length) console.log(`\nslowest files (seconds, peak MB):`);
  for (const r of bySlow)
    console.log(`  ${r.s.toFixed(1).padStart(7)}  ${String(r.mb).padStart(6)}  ${r.file}`);
  const sum = (pick: (r: Result) => number) => results.reduce((n, r) => n + pick(r), 0);
  console.log(
    `\n${results.length} files, ${sum((r) => r.tests)} tests: ${sum((r) => r.pass)} passed, ` +
      `${sum((r) => r.fail)} failed, ${failed.length} files failed. ` +
      `Wall ${clock(wall)}, summed ${clock(sum((r) => r.s))}. ` +
      `Memory at most ${(most / 1024).toFixed(1)} GB (the peaks of the files running together).`,
  );
  const flaked = results.filter((r) => r.flaked !== undefined);
  if (flaked.length)
    console.log(
      `failed among the others and passed alone:\n${flaked.map((r) => `  ${r.file}`).join("\n")}`,
    );
  if (failed.length) console.log(`failed files:\n${failed.map((r) => `  ${r.file}`).join("\n")}`);
  return failed.length === 0;
}

async function main(argv: string[]): Promise<void> {
  const value = (flag: string) => {
    const at = argv.indexOf(flag);
    return at < 0 ? undefined : argv.splice(at, 2)[1];
  };
  const has = (flag: string) => {
    const at = argv.indexOf(flag);
    if (at >= 0) argv.splice(at, 1);
    return at >= 0;
  };
  const num = (flag: string) => {
    const v = value(flag);
    return v === undefined ? undefined : Number(v);
  };
  const jobs = num("--jobs"),
    budgetGb = num("--budget"),
    reserveGb = num("--reserve"),
    slow = num("--slow"),
    json = value("--json");
  const noPerf = has("--no-perf"),
    record = has("--record"),
    list = has("--list");
  let files = allTests();
  if (argv.length) {
    const asked = argv.map((a) => slash(relative(root, resolve(root, a))));
    files = files.filter((f) => asked.some((a) => f === a || f.startsWith(a + "/")));
  }
  if (noPerf) files = files.filter((f) => !isPerf(f));
  if (list) {
    console.log(files.join("\n"));
    return;
  }
  const began = Date.now();
  const results = await runSuite(files, { jobs, budgetGb, reserveGb });
  const ok = report(results, (Date.now() - began) / 1000, slow);
  const measured = Object.fromEntries(
    results
      .filter((r) => r.ok && r.mb > 0)
      .map((r) => [r.file, { s: Math.round(r.s * 10) / 10, mb: r.mb }]),
  );
  if (json) writeFileSync(json, timingsText(measured));
  if (record) {
    const merged = { ...readTimings(), ...measured };
    const live = new Set(allTests());
    const sorted = Object.fromEntries(
      Object.entries(merged)
        .filter(([f]) => live.has(f))
        .sort(([a], [b]) => (a < b ? -1 : 1)),
    );
    writeFileSync(TIMINGS, timingsText(sorted));
  }
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2));
