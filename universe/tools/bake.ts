// node tools/bake.ts [--out dist/baked] [--years 1500,3000] — worlds run ahead for a deploy (Phase 63):
// the Earth seed, saved at each far year as the host would save it, with a manifest saying which
// is which. Far years chosen for that world on the title screen then take seconds on a phone, not
// minutes: the page fetches the nearest save before the year asked and runs on from there (the same
// history as running from the start). Written into the built app, never into the repository: a deploy
// bakes its own (.github/workflows/pages.yml), so a save is always of the rules it is served with, and
// is named for its bytes, so that no cache hands out an earlier deploy's under a manifest of this one.
// (Named .save, not .json.gz: a server that reads that name sends it as gzipped JSON, the browser takes
// the gzip off, and the page does not get the bytes it was told of.)
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import type { Baked } from "../src/ui/jump.ts";

const argv = process.argv.slice(2),
  value = (flag: string, otherwise: string) => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1]! : otherwise;
  },
  out = value("--out", fileURLToPath(new URL("../dist/baked", import.meta.url))),
  years = value("--years", "1500,3000")
    .split(",")
    .map(Number)
    .sort((a, b) => a - b),
  seed = "first light";

mkdirSync(out, { recursive: true });
const t0 = performance.now(),
  world = EARTH.build(seedFromText(seed)),
  ruleset = rulesetId(world, EARTH.version),
  worlds: Baked[] = [];
for (const year of years) {
  world.runTo(year * YEAR);
  const bytes = gzipSync(JSON.stringify(saveWorld(world, ruleset, { universe: EARTH.name }))),
    file = `${EARTH.name}-${year}-${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.save`;
  writeFileSync(join(out, file), bytes);
  worlds.push({ universe: EARTH.name, seed, year, file, bytes: bytes.length, ruleset });
  console.log(
    `  year ${year}: ${(bytes.length / 1e6).toFixed(1)} MB, ${Math.round((performance.now() - t0) / 1000)} s on`,
  );
}
writeFileSync(join(out, "manifest.json"), JSON.stringify({ worlds }));
