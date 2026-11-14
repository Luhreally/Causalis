// node tools/bake.ts [--out dist/baked] [--years 1500,3000] — worlds run ahead for a deploy (Phase 63):
// the Earth seed, saved at each far year as the host would save it, with a manifest saying which
// is which. Far years chosen for that world on the title screen then take seconds on a phone, not
// minutes: the page fetches the nearest save before the year asked and runs on from there (the same
// history as running from the start). Written into the built app, never into the repository: a deploy
// bakes its own (.github/workflows/pages.yml), so a save is always of the rules it is served with, and
// is named for its bytes, so that no cache hands out an earlier deploy's under a manifest of this one.
// (Named .save, not .json.gz: a server that reads that name sends it as gzipped JSON, the browser takes
// the gzip off, and the page does not get the bytes it was told of.)
// The seed catalogue (Phase 65) is committed, not baked, so its years hold only while the history they
// were run under does, and a universe's version is moved by hand. This world runs to those far years
// anyway, so it is held to its record there, and one small alien world with it: if either has moved, the
// manifest says so and the title passes the catalogue over rather than promise what no longer happens.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { rawReading, readingMark } from "../src/host/reading.ts";
import type { World } from "../src/kernel/index.ts";
import { PAST_WORLD, type Baked } from "../src/ui/jump.ts";

const argv = process.argv.slice(2),
  value = (flag: string, otherwise: string) => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1]! : otherwise;
  },
  out = value("--out", fileURLToPath(new URL("../dist/baked", import.meta.url))),
  years = value("--years", "1500,2000,3000")
    .split(",")
    .map(Number)
    .sort((a, b) => a - b),
  seed = "first light",
  // (A world past our ages by another road, for the picker: a people of the water, who never hold a
  // flame, with worlds remade. Phase 66.)
  beyond = { seed: "alien 41", year: Number(value("--beyond", "2000")) },
  // (And the world the title's way into those ages opens: Phase 66.)
  past = { ...PAST_WORLD, year: Number(value("--past", `${PAST_WORLD.year}`)) };

type Marked = {
  readonly universe: string;
  readonly seed: string;
  readonly lands: number;
  readonly ages: Readonly<Record<string, unknown>>;
  readonly marks?: Readonly<Record<string, string>>;
};
const catalogue = JSON.parse(
    readFileSync(new URL("../public/catalogue.json", import.meta.url), "utf8"),
  ) as { seeds: readonly Marked[]; rulesets?: Readonly<Record<string, string>> },
  marked = catalogue.seeds;
let catalogueMoved = "";
/** Hold a world to the catalogue's record of it at a year, where it has one. */
const holdToRecord = (world: World, universe: string, text: string, year: number) => {
  const mark = marked.find((s) => s.universe === universe && s.seed === text)?.marks?.[year];
  if (mark && !catalogueMoved && mark !== readingMark(rawReading(world)))
    catalogueMoved = `${text} at year ${year}`;
};

mkdirSync(out, { recursive: true });
// Each world in a process of its own, for a runner's four cores: some twenty minutes, not forty.
const PARTS = ["seed", "past", "beyond", "alien"],
  part = value("--part", "");
if (!part) {
  await Promise.all(
    PARTS.map(
      (p) =>
        new Promise<void>((done, failed) =>
          spawn(process.execPath, [process.argv[1]!, ...argv, "--part", p], {
            stdio: "inherit",
          }).on("exit", (code) =>
            code === 0 ? done() : failed(new Error(`the bake's ${p} ended ${code}`)),
          ),
        ),
    ),
  );
  const parts = PARTS.map((p) => {
      const file = join(out, `.part-${p}.json`),
        got = JSON.parse(readFileSync(file, "utf8")) as { worlds: Baked[]; moved: string };
      rmSync(file);
      return got;
    }),
    moved = parts.find((x) => x.moved)?.moved ?? "";
  if (moved)
    console.log(
      `THE CATALOGUE IS STALE: ${moved} no longer stands as recorded, so this deploy passes it over. Run the seed list again.`,
    );
  else console.log("  the catalogue's worlds still run as recorded");
  writeFileSync(
    join(out, "manifest.json"),
    JSON.stringify({
      worlds: parts.flatMap((x) => x.worlds),
      ...(moved ? { catalogueMoved: moved } : {}),
    }),
  );
  process.exit(0);
}
const t0 = performance.now(),
  worlds: Baked[] = [];
if (part === "seed") {
  const world = EARTH.build(seedFromText(seed)),
    ruleset = rulesetId(world, EARTH.version);
  for (const year of years) {
    world.runTo(year * YEAR);
    holdToRecord(world, EARTH.name, seed, year);
    const bytes = gzipSync(JSON.stringify(saveWorld(world, ruleset, { universe: EARTH.name }))),
      file = `${EARTH.name}-${year}-${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.save`;
    writeFileSync(join(out, file), bytes);
    worlds.push({ universe: EARTH.name, seed, year, file, bytes: bytes.length, ruleset });
    console.log(
      `  year ${year}: ${(bytes.length / 1e6).toFixed(1)} MB, ${Math.round((performance.now() - t0) / 1000)} s on`,
    );
  }
}
if (part === "past") {
  const other = EARTH.build(seedFromText(past.seed)),
    its = rulesetId(other, EARTH.version);
  other.runTo(past.year * YEAR);
  holdToRecord(other, EARTH.name, past.seed, past.year);
  const bytes = gzipSync(JSON.stringify(saveWorld(other, its, { universe: EARTH.name }))),
    file = `${EARTH.name}-${past.year}-${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.save`;
  writeFileSync(join(out, file), bytes);
  worlds.push({
    universe: EARTH.name,
    seed: past.seed,
    year: past.year,
    file,
    bytes: bytes.length,
    ruleset: its,
  });
  console.log(
    `  ${past.seed}, year ${past.year}: ${(bytes.length / 1e6).toFixed(1)} MB, ${Math.round((performance.now() - t0) / 1000)} s on`,
  );
}
if (part === "beyond" && beyond.year > 0) {
  const other = ALIEN.build(seedFromText(beyond.seed)),
    its = rulesetId(other, ALIEN.version);
  other.runTo(beyond.year * YEAR);
  holdToRecord(other, ALIEN.name, beyond.seed, beyond.year);
  const bytes = gzipSync(JSON.stringify(saveWorld(other, its, { universe: ALIEN.name }))),
    file = `${ALIEN.name}-${beyond.year}-${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.save`;
  writeFileSync(join(out, file), bytes);
  worlds.push({
    universe: ALIEN.name,
    seed: beyond.seed,
    year: beyond.year,
    file,
    bytes: bytes.length,
    ruleset: its,
  });
  console.log(
    `  ${beyond.seed}, year ${beyond.year}: ${(bytes.length / 1e6).toFixed(1)} MB, ${Math.round((performance.now() - t0) / 1000)} s on`,
  );
}
// The smallest alien world that came to orbit: alien history, as far as it goes, in a minute or two.
const alien = marked
  .filter((s) => s.universe === ALIEN.name && s.ages.orbit && s.marks)
  .sort((a, b) => a.lands - b.lands)[0];
if (part === "alien" && alien) {
  const other = ALIEN.build(seedFromText(alien.seed));
  // (A catalogue of other rules is told so by its rulesets alone, and the title reads it as close, not exact: a world held
  // to it can only be found moved. Under rules that make its people anew a small world can grow great and slow (kestrel
  // 557's sea people walk now), and its run outlasted the deploy's hour and a half. 2026-11-13.)
  if (catalogue.rulesets?.[ALIEN.name] !== rulesetId(other, ALIEN.version))
    console.log(
      `  the catalogue's alien worlds are of other rules: ${alien.seed} not held to them`,
    );
  else {
    for (const year of Object.keys(alien.marks!)
      .map(Number)
      .sort((a, b) => a - b)) {
      other.runTo(year * YEAR);
      holdToRecord(other, ALIEN.name, alien.seed, year);
      // (Moved once is moved: no later year can say more.)
      if (catalogueMoved) break;
    }
    console.log(
      `  ${alien.seed} held to its record: ${Math.round((performance.now() - t0) / 1000)} s on`,
    );
  }
}
writeFileSync(join(out, `.part-${part}.json`), JSON.stringify({ worlds, moved: catalogueMoved }));
