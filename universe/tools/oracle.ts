// node tools/oracle.ts [--write] [--report] [--expect dom1,dom2] [name…] — run the oracle fixtures
// and compare their checkpoint chains with tests/golden/oracle.json (or record them with --write).
// --report tells, for each fixture, the year each domain first parts from its record; --expect
// passes a change meant to move only those domains (Phase 52 M218): every other domain must keep
// its recorded history to the end, and the run fails if one does not.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  FIXTURES,
  domainDivergence,
  firstDivergence,
  recordFixture,
  type FixtureRecord,
} from "../tests/vectors/oracle.ts";

const path = fileURLToPath(new URL("../tests/golden/oracle.json", import.meta.url));
const argv = process.argv.slice(2),
  at = argv.indexOf("--expect"),
  expect = at >= 0 ? new Set((argv[at + 1] ?? "").split(",").filter(Boolean)) : null,
  report = argv.includes("--report");
const names = argv.filter((a, i) => !a.startsWith("--") && !(at >= 0 && i === at + 1));
const chosen = FIXTURES.filter((f) => !names.length || names.some((n) => f.name.includes(n)));

const started = Date.now();
const records = chosen.map((f) => recordFixture(f));
console.log(`ran ${records.length} fixtures in ${Date.now() - started} ms`);

if (process.argv.includes("--write")) {
  mkdirSync(fileURLToPath(new URL("../tests/golden/", import.meta.url)), { recursive: true });
  const previous: FixtureRecord[] = (() => {
    try {
      return (JSON.parse(readFileSync(path, "utf8")) as { fixtures: FixtureRecord[] }).fixtures;
    } catch {
      return [];
    }
  })();
  const merged = [
    ...previous.filter((p) => !records.some((r) => r.name === p.name)),
    ...records,
  ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  writeFileSync(path, JSON.stringify({ fixtures: merged }) + "\n");
  for (const r of records) console.log(`recorded ${r.name}: ${r.checkpoints.at(-1)?.chain}`);
} else {
  const golden = (JSON.parse(readFileSync(path, "utf8")) as { fixtures: FixtureRecord[] }).fixtures;
  let failed = false;
  for (const r of records) {
    const g = golden.find((x) => x.name === r.name);
    const problem = g ? firstDivergence(r, g) : `${r.name}: not in the golden file`;
    console.log(problem ?? `${r.name}: unchanged (${r.checkpoints.at(-1)?.chain})`);
    const parted = g ? domainDivergence(r, g) : new Map<string, number>();
    if (report || expect)
      for (const [d, t] of [...parted].sort((x, y) => x[1] - y[1] || (x[0] < y[0] ? -1 : 1)))
        console.log(
          `  ${d}: first parts at year ${Math.round(t / 31_536_000)}${expect && !expect.has(d) ? " (not expected)" : ""}`,
        );
    // (With --expect, only a domain not expected to move fails it.)
    if (expect ? !g || [...parted.keys()].some((d) => !expect.has(d)) : problem) failed = true;
  }
  if (failed) process.exitCode = 1;
}
