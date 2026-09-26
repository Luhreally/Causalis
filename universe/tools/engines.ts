// node tools/engines.ts [chromium webkit firefox] — the cross-engine determinism check
// (docs/architecture §36). Bundles tests/vectors/entry.ts, runs every golden suite
// in Node (V8) and in each browser engine through Playwright, and requires every
// engine to produce the same bits as tests/golden/kernel.json.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { chromium, firefox, webkit, type BrowserType } from "playwright";
import { run, type SuiteResult } from "../tests/vectors/entry.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const ENGINES: Record<string, BrowserType> = { chromium, webkit, firefox };
const wanted = process.argv.slice(2).filter((a) => a in ENGINES);
const engines = wanted.length ? wanted : Object.keys(ENGINES);

async function bundle(): Promise<string> {
  const result = await build({
    configFile: false,
    root,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry: "tests/vectors/entry.ts", formats: ["iife"], name: "CausalisVectors" },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  for (const out of outputs)
    if ("output" in out)
      for (const chunk of out.output) if (chunk.type === "chunk") return chunk.code;
  throw new Error("the vector bundle produced no code");
}

function compare(
  name: string,
  got: Record<string, SuiteResult>,
  want: Record<string, SuiteResult>,
): string[] {
  const problems: string[] = [];
  for (const [suite, expected] of Object.entries(want)) {
    const actual = got[suite];
    if (!actual) {
      problems.push(`${name}: suite ${suite} missing`);
      continue;
    }
    if (actual.digest === expected.digest) continue;
    const diffs = expected.vectors.filter(
      ([label, value], i) => actual.vectors[i]?.[0] !== label || actual.vectors[i]?.[1] !== value,
    );
    problems.push(
      `${name}: ${suite} digest ${actual.digest}, expected ${expected.digest} (${diffs.length} vectors differ)`,
    );
    for (const [label, value] of diffs.slice(0, 8)) {
      const i = expected.vectors.findIndex((v) => v[0] === label);
      problems.push(`    ${label}: ${actual.vectors[i]?.[1]} ≠ ${value}`);
    }
  }
  return problems;
}

/** Checks a suite states about itself (a "no" is a failure even if every engine says it). */
function selfChecks(engine: string, result: Record<string, SuiteResult>): string[] {
  const problems: string[] = [];
  for (const [label, value] of result.slice?.vectors ?? [])
    if (value === "no") problems.push(`${engine}: the slice does not hold — ${label}`);
  return problems;
}

const golden = JSON.parse(
  readFileSync(new URL("../tests/golden/kernel.json", import.meta.url), "utf8"),
) as SuiteResult;
const node = run();
const problems = [
  ...compare("node", { kernel: node.kernel! }, { kernel: golden }),
  ...selfChecks("node", node),
];
console.log(
  `node       ${Object.entries(node)
    .map(([k, v]) => `${k} ${v.digest}`)
    .join("  ")}`,
);
const code = await bundle();
for (const engine of engines) {
  const browser = await ENGINES[engine]!.launch();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><title>vectors</title>");
    await page.addScriptTag({ content: code });
    const result = (await page.evaluate("CausalisVectors.run()")) as Record<string, SuiteResult>;
    console.log(
      `${engine.padEnd(10)} ${Object.entries(result)
        .map(([k, v]) => `${k} ${v.digest}`)
        .join("  ")}  (${browser.version()})`,
    );
    problems.push(...compare(engine, result, node), ...selfChecks(engine, result));
  } finally {
    await browser.close();
  }
}
if (problems.length) {
  for (const p of problems) console.log(p);
  process.exitCode = 1;
} else console.log(`engines agree: node, ${engines.join(", ")}`);
