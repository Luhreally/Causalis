import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "index.html");
const source = await readFile(sourcePath, "utf8");
const lines = source.replace(/\r\n/g, "\n").split("\n");

if (!source.includes("const Game=(()=>{") || !source.includes("Game.boot();")) {
  throw new Error("index.html is not the expected Causalis single-file source");
}

await mkdir(path.join(root, "legacy"), { recursive: true });
await mkdir(path.join(root, "src", "game", "sections"), { recursive: true });
await mkdir(path.join(root, "src", "styles"), { recursive: true });
await mkdir(path.join(root, "tests"), { recursive: true });

await copyFile(sourcePath, path.join(root, "legacy", "index.single-file.html"));
await copyFile(path.join(root, "smoke-test.cjs"), path.join(root, "tests", "smoke-test.cjs"));

const lineRange = (start, end) =>
  lines
    .slice(start - 1, end)
    .join("\n")
    .trimEnd() + "\n";

const styles = [
  ["01-foundation.css", [12, 13]],
  ["02-game-shell.css", [14, 19]],
  ["03-dialogs-and-title.css", [20, 22]],
  ["04-shell-responsive.css", [23, 23]],
  ["05-observatory.css", [24, 32]],
  ["06-observatory-responsive.css", [33, 34]],
];

for (const [name, [start, end]] of styles) {
  await writeFile(path.join(root, "src", "styles", name), lineRange(start, end), "utf8");
}

const sections = [
  [76, "01-configuration.js"],
  [108, "02-definitions.js"],
  [159, "03-utilities.js"],
  [181, "04-determinism.js"],
  [194, "05-save-system.js"],
  [225, "06-world-generation.js"],
  [322, "07-tile-world.js"],
  [344, "08-environment-fields.js"],
  [351, "09-entity-allocator.js"],
  [359, "10-component-stores.js"],
  [373, "11-relations.js"],
  [381, "12-population-cohorts.js"],
  [395, "13-processes.js"],
  [423, "14-effects.js"],
  [435, "15-events.js"],
  [448, "16-scheduler.js"],
  [454, "17-physical-substrate.js"],
  [484, "18-material-resources.js"],
  [508, "19-plant-ecology.js"],
  [514, "20-artificial-life.js"],
  [538, "21-perception-behavior.js"],
  [578, "22-health-disease-death.js"],
  [593, "23-reproduction-evolution.js"],
  [602, "24-memory-social.js"],
  [614, "25-settlements-construction.js"],
  [642, "26-culture-factions.js"],
  [666, "27-technology.js"],
  [677, "28-war-conflict.js"],
  [689, "29-history.js"],
  [714, "30-level-of-detail.js"],
  [721, "30a-material-society.js"],
  [934, "31-god-tools.js"],
  [942, "32-rendering.js"],
  [965, "32b-planet-visuals.js"],
  [1030, "32c-creature-visuals.js"],
  [1063, "32d-spatial-rendering.js"],
  [1281, "33-camera-input.js"],
  [1317, "34-interface.js"],
  [1389, "34a-civic-inspectors.js"],
  [1432, "35-audio.js"],
  [1440, "36-menus.js"],
  [1464, "37-main-loop.js"],
  [1476, "38-field-guide-controls.js"],
  [1591, "39-debug-audits.js"],
  [1611, "40-sentience-continuity.js"],
  [1652, "41-implicit-society.js"],
  [1694, "42-environment-warfare.js"],
  [1768, "43-bootstrap-debug-api.js"],
];

for (let index = 0; index < sections.length; index++) {
  const [start, name] = sections[index];
  const end = index + 1 < sections.length ? sections[index + 1][0] - 1 : 1788;
  await writeFile(path.join(root, "src", "game", "sections", name), lineRange(start, end), "utf8");
}

await writeFile(
  path.join(root, "src", "game", "manifest.json"),
  JSON.stringify(
    sections.map(([, name]) => name),
    null,
    2,
  ) + "\n",
  "utf8",
);

const documentHead = lines.slice(0, 10).join("\n");
const documentBody = lines.slice(35, 72).join("\n");
const structuredHtml = `${documentHead}\n${documentBody}\n<script type="module" src="/src/main.js"></script>\n</body>\n</html>\n`;
await writeFile(sourcePath, structuredHtml, "utf8");

await writeFile(path.join(root, "smoke-test.cjs"), 'require("./tests/smoke-test.cjs");\n', "utf8");

console.log(`Migrated ${sections.length} game sections and ${styles.length} style layers.`);
