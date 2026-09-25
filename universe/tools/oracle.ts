// node tools/oracle.ts [--write] [name…] — run the oracle fixtures and compare their
// checkpoint chains with tests/golden/oracle.json (or record them with --write).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  FIXTURES,
  firstDivergence,
  recordFixture,
  type FixtureRecord,
} from "../tests/vectors/oracle.ts";

const path = fileURLToPath(new URL("../tests/golden/oracle.json", import.meta.url));
const names = process.argv.slice(2).filter((a) => !a.startsWith("--"));
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
    if (problem) failed = true;
  }
  if (failed) process.exitCode = 1;
}
