const { spawnSync } = require("node:child_process");
const path = require("node:path");

const mode = process.argv[2];
if (!/^[A-Z][A-Z0-9_]*$/.test(mode || "")) {
  console.error("Usage: node scripts/run-smoke-mode.cjs MODE_NAME");
  process.exit(2);
}

const result = spawnSync(process.execPath, [path.resolve("smoke-test.cjs")], {
  cwd: path.resolve("."),
  env: { ...process.env, [mode]: "1" },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
