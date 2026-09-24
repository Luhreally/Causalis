// The test suite, run in parallel.
//
//   node scripts/test.cjs                 every fast test (npm test, npm run test:fast)
//   node scripts/test.cjs roads markets   only the tests whose names contain a word
//   node scripts/test.cjs --slow          the fast tests and the long smoke modes
//   node scripts/test.cjs --list          what would run, longest first
//   node scripts/test.cjs -j 8            eight at a time (default: half the cores, at most 16)
//
// A test is any tests/*-smoke.cjs file, found by name, so a new one needs no
// entry anywhere; the modes of the root smoke test are listed below. The chain
// of `npm run` it replaces took 323 s on the 32-core machine this was written
// on, one test at a time, with 600 ms of npm start-up each; a pool of sixteen
// ran the same tests in about 45. More than sixteen is slower here: the tests
// share memory bandwidth and the efficiency cores.
//
// The sections are read once, when the run starts, and every test composes
// the runtime from that copy, so an edit made while the suite runs no longer
// gives half the tests the old game and half the new. A test passes when it
// exits 0 and prints no `"ok": false`.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { readSections } = require("./compose-runtime.cjs");

const ROOT = path.resolve(__dirname, "..");
// The root smoke test's modes. The fast ones run in every suite; the slow ones
// only with --slow. Four slow modes failed when this was written (the default,
// IMPLICIT, QUICK_VISUAL, CAUSAL_SKIP) and PROGRESSION ran past fifteen minutes.
const MODES = {
  fast: ["CONFLICT_DEBUG", "SYSTEMS_DEBUG", "SAVE_DEBUG"],
  slow: [
    "CLOCK_DEBUG",
    "SETTLEMENT_DEBUG",
    "SENTIENCE_DEBUG",
    "STAGE_UI_DEBUG",
    "ECO_DEBUG",
    "CIVIC_DEBUG",
    "IMPLICIT_DEBUG",
    "QUICK_VISUAL",
    "CAUSAL_SKIP_DEBUG",
    "DEFAULT",
  ],
};
const TIMINGS = path.join(ROOT, "node_modules", ".cache", "causalis-test-timings.json");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const jobsAt = argv.findIndex((a) => a === "-j" || a === "--jobs");
const parallel =
  jobsAt >= 0
    ? Math.max(1, Number(argv[jobsAt + 1]) || 1)
    : Math.max(1, Math.min(16, Math.floor((os.availableParallelism?.() || os.cpus().length) / 2)));
const words = argv.filter((a, i) => !a.startsWith("-") && !(jobsAt >= 0 && i === jobsAt + 1));

function discover() {
  const tests = [{ name: "syntax", args: [path.join("scripts", "check-runtime.cjs")] }];
  for (const file of fs.readdirSync(path.join(ROOT, "tests")).sort())
    if (file.endsWith("-smoke.cjs"))
      tests.push({ name: file.slice(0, -"-smoke.cjs".length), args: [path.join("tests", file)] });
  const modes = flag("--slow") ? [...MODES.fast, ...MODES.slow] : MODES.fast;
  for (const mode of modes)
    tests.push({
      name: `mode:${mode.replace(/_DEBUG$/, "").toLowerCase()}`,
      args: ["smoke-test.cjs"],
      env: mode === "DEFAULT" ? {} : { [mode]: "1" },
    });
  return words.length ? tests.filter((t) => words.some((w) => t.name.includes(w))) : tests;
}

function readTimings() {
  try {
    return JSON.parse(fs.readFileSync(TIMINGS, "utf8"));
  } catch {
    return {};
  }
}

function snapshotSections() {
  const file = path.join(os.tmpdir(), `causalis-sections-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(readSections()));
  return file;
}

function run(test, env) {
  return new Promise((resolve) => {
    const started = Date.now(),
      child = spawn(process.execPath, test.args, {
        cwd: ROOT,
        env: { ...env, ...(test.env || {}) },
      });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    const timer = setTimeout(() => child.kill(), 15 * 60 * 1000);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const ok = (output.match(/"ok": true/g) || []).length,
        notOk = (output.match(/"ok": false/g) || []).length,
        // A test that says nothing has not passed: one whose promise never
        // settled exits 0 in silence (the skip once waited on a frame the
        // stand-in DOM never draws). The syntax check is the one that prints
        // a sentence instead.
        silent = !ok && !notOk && test.name !== "syntax";
      resolve({
        ...test,
        ms: Date.now() - started,
        ok,
        passed: code === 0 && !notOk && !signal && !silent,
        code: signal ? `killed (${signal})` : silent ? "0, but printed no result" : code,
        output,
      });
    });
  });
}

async function main() {
  const timings = readTimings(),
    tests = discover().sort((a, b) => (timings[b.name] || 5000) - (timings[a.name] || 5000));
  if (flag("--list")) {
    for (const t of tests)
      console.log(`${t.name.padEnd(24)} ${((timings[t.name] || 0) / 1000).toFixed(1)} s`);
    return;
  }
  if (!tests.length) {
    console.error(`no test matches ${words.join(" ")}`);
    process.exit(2);
  }
  const snapshot = snapshotSections(),
    env = { ...process.env, CAUSALIS_SECTIONS_SNAPSHOT: snapshot },
    started = Date.now(),
    results = [];
  console.log(
    `${tests.length} test${tests.length === 1 ? "" : "s"}, ${Math.min(parallel, tests.length)} at a time`,
  );
  let next = 0;
  async function worker() {
    while (next < tests.length) {
      const result = await run(tests[next++], env);
      results.push(result);
      const mark = result.passed ? "ok  " : "FAIL";
      console.log(
        `${mark} ${result.name.padEnd(24)} ${(result.ms / 1000).toFixed(1).padStart(6)} s  ${result.ok} ok  [${results.length}/${tests.length}]`,
      );
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, tests.length) }, worker));
  fs.rmSync(snapshot, { force: true });

  for (const r of results) timings[r.name] = r.ms;
  try {
    fs.mkdirSync(path.dirname(TIMINGS), { recursive: true });
    fs.writeFileSync(TIMINGS, JSON.stringify(timings, null, 1));
  } catch {}

  const failed = results.filter((r) => !r.passed),
    okLines = results.reduce((n, r) => n + r.ok, 0);
  for (const r of failed) {
    console.log(`\n── ${r.name} (exit ${r.code}) ${"─".repeat(Math.max(0, 60 - r.name.length))}`);
    console.log(r.output.split("\n").slice(-60).join("\n"));
  }
  console.log(
    `\n${results.length - failed.length} of ${results.length} passed, ${okLines} "ok": true lines, in ${((Date.now() - started) / 1000).toFixed(1)} s${failed.length ? ` — failed: ${failed.map((r) => r.name).join(", ")}` : ""}`,
  );
  if (failed.length) process.exitCode = 1;
}

main();
