// A new section, ready to fill: the file, its place in the manifest, a debug
// surface and a smoke test the suite finds by name.
//
//   node scripts/new-section.cjs 156-harbours "Harbours"            after the last section
//   node scripts/new-section.cjs 156-harbours "Harbours" --after 57-seafaring.js
//
// The file shows the extension points in their usual form: a tick system, an
// event's sentence, and the debug surface. Delete what the feature does not need.
const fs = require("node:fs");
const path = require("node:path");

const [name, title = "", ...rest] = process.argv.slice(2);
if (!/^\d+[a-z]?-[a-z0-9-]+$/.test(name || "")) {
  console.error(
    'usage: node scripts/new-section.cjs <number-name> "<Title>" [--after <section.js>]',
  );
  process.exit(2);
}
const afterAt = rest.indexOf("--after"),
  after = afterAt >= 0 ? rest[afterAt + 1] : null,
  root = path.resolve(__dirname, ".."),
  manifestPath = path.join(root, "src", "game", "manifest.json"),
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")),
  file = `${name}.js`,
  sectionPath = path.join(root, "src", "game", "sections", file),
  short = name.replace(/^\d+[a-z]?-/, ""),
  words = short.split("-"),
  upper = words.join("_").toUpperCase(),
  camel = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join(""),
  heading = title || words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
  testPath = path.join(root, "tests", `${short}-smoke.cjs`);
if (manifest.includes(file) || fs.existsSync(sectionPath)) throw new Error(`${file} exists`);
if (fs.existsSync(testPath)) throw new Error(`${path.relative(root, testPath)} exists`);
if (after && !manifest.includes(after)) throw new Error(`${after} is not in the manifest`);

const section = `// ═══════════════════════════════════════════════════════════════════════════
// ${name.split("-")[0]}. ${heading.toUpperCase()}
// ═══════════════════════════════════════════════════════════════════════════
// What this adds to the world, in plain words, and why; the numbers that were
// measured to choose its constants go beside the constants.
const ${upper} = { passes: 0 };

// The world's state for this feature lives in W, so a save keeps it. Make it
// when first needed and give a loaded world the same (restoreWorldDefaults).
function ensure${camel[0].toUpperCase() + camel.slice(1)}(world = W) {
  if (!world) return null;
  world.${camel} ||= { version: 1 };
  return world.${camel};
}

// A system of the tick (16): it runs after the core tick, in manifest order.
// Keep it on a cadence and offset of its own, so it does not stack on others.
tickSystem("${short.replace(/-/g, " ")}", function () {
  if (!W?.settlements || W.tick % 64 !== 17) return;
  ${upper}.passes++;
});

// An event's sentence (15): return the words, or next(e) for another's type.
// Give a new event type a category in EVENT_CATEGORY (01) as well.
// eventText(["${camel[0].toUpperCase() + camel.slice(1)}Event"], function (e, next) {
//   return \`\${e.data.name} ...\`;
// });

window.ALIFE_${upper}_DEBUG = Object.freeze({
  counts: () => ({ ...${upper} }),
});
`;

const test = `// ${heading}: what the feature promises, checked on a world that has it.
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
const rt = loadRuntime();
rt.sandbox.window.ALIFE_DEBUG.createTestWorld({ seed: "causal-origin", size: "battery", complexity: "lean" });
const tick = rt.get("simTick");
for (let i = 0; i < 128; i++) tick();
const counts = rt.sandbox.window.ALIFE_${upper}_DEBUG.counts();
// Assert on the feature's own effect in the world, not only that it ran: a
// green test whose fixture builds the precondition is not evidence the change
// fires on a generated world.
if (rt.get("auditMatter().delta") !== 0) failures.push("matter drifted");
report({ counts }, failures);
`;

fs.writeFileSync(sectionPath, section);
const at = after ? manifest.indexOf(after) + 1 : manifest.length;
manifest.splice(at, 0, file);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
fs.writeFileSync(testPath, test);
console.log(`wrote src/game/sections/${file} (manifest position ${at + 1} of ${manifest.length})`);
console.log(`wrote tests/${short}-smoke.cjs`);
console.log(`run it: node scripts/test.cjs ${short}`);
console.log(
  `then: the oracle (npm run oracle -- --compare <golden>) if the feature is meant to leave the road alone,`,
);
console.log(`and a README paragraph in the project's voice.`);
