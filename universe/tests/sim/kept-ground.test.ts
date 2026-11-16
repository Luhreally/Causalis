// What a process keeps of a world's ground follows the ground when it moves (gen/homeworld.ts keptKey). A reading kept by
// the world's digest alone, made before a rise of the ground, was kept after it: a world run on in one process read its old
// ground where the same world loaded in a fresh one read its new, and their histories parted (gates 76, 79 and 101 on CI:
// first light at 450, every land's wind read from its tropics' warmth before a rise cooled them).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { YEAR, rulesetId, saveWorld, seedFromText, type World } from "../../src/kernel/index.ts";
import { carriersOf, windContrast } from "../../src/gen/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { homePlanet } from "../../src/sim/index.ts";

/** Cool the warmest land of the tropics by 30 °C, as a rise of its ground would. */
function rise(world: World): void {
  const home = homePlanet(world),
    f = home.generated.fine;
  let at = -1;
  for (let c = 0; c < f.grid.count; c++)
    if (
      f.tectonics.elevation[c]! > 0 &&
      Math.abs(f.grid.lat[c]!) < 0.35 &&
      (at < 0 || f.climate.temperature[c]! > f.climate.temperature[at]!)
    )
      at = c;
  assert.ok(at >= 0, "a tropical land");
  const p = home.surface(at);
  p.elevation = Math.fround(p.elevation + 4000);
  p.temperature = Math.fround(p.temperature - 30);
  home.changeSurface([p]);
}

test("a reading kept by world follows its ground: one read before a rise is read again after it", () => {
  const before = EARTH.build(seedFromText("first light")),
    after = EARTH.build(seedFromText("first light")),
    gb = homePlanet(before).generated,
    ga = homePlanet(after).generated;
  // (Read once on the ground as made, then the ground moved; the other world's ground moved before anything was read.)
  const contrast = windContrast(gb.fine),
    wind = carriersOf(gb).wind.reduce((s, x) => s + x, 0);
  rise(before);
  rise(after);
  assert.ok(
    gb.surface && gb.fine.surface === gb.surface,
    "the ground's departures are on both grids",
  );
  assert.equal(windContrast(gb.fine), windContrast(ga.fine));
  assert.notEqual(windContrast(gb.fine), contrast, "the rise cooled the tropics");
  assert.equal(
    carriersOf(gb).wind.reduce((s, x) => s + x, 0),
    carriersOf(ga).wind.reduce((s, x) => s + x, 0),
  );
  assert.notEqual(
    carriersOf(gb).wind.reduce((s, x) => s + x, 0),
    wind,
  );
});

test("a world saved after its ground moved and loaded in a fresh process runs on as the one never saved", () => {
  const world = ALIEN.build(seedFromText("harrow 348"));
  world.runTo(40 * YEAR);
  rise(world);
  world.runTo(45 * YEAR);
  const dir = mkdtempSync(join(tmpdir(), "kept-ground-")),
    file = join(dir, "world.json");
  writeFileSync(
    file,
    JSON.stringify(saveWorld(world, rulesetId(world, ALIEN.version), { universe: ALIEN.name })),
  );
  world.runTo(47 * YEAR);
  const root = fileURLToPath(new URL("../../src/", import.meta.url)),
    at = (p: string) => JSON.stringify(pathToFileURL(join(root, p)).href),
    child = `
      import { readFileSync } from "node:fs";
      const k = await import(${at("kernel/index.ts")}), { ALIEN } = await import(${at("host/planet.ts")});
      const doc = JSON.parse(readFileSync(process.argv[1], "utf8")),
        probe = ALIEN.build(k.seedFromText(doc.seed)),
        w = k.loadWorld(doc, (s) => ALIEN.build(s), k.rulesetId(probe, ALIEN.version), { allowRulesetChange: true }).world;
      w.runTo(${47 * YEAR});
      process.stdout.write(JSON.stringify(w.domainHashes()));
    `,
    out = execFileSync(process.execPath, ["--input-type=module", "-e", child, file], {
      encoding: "utf8",
      maxBuffer: 1 << 24,
    });
  assert.deepEqual(JSON.parse(out), JSON.parse(JSON.stringify(world.domainHashes())));
});
