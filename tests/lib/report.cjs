// The line a test prints: { ok, failures, ...what it measured }. scripts/test.cjs
// counts the `"ok": true` lines and fails a test that prints `"ok": false` or
// exits non-zero.
function report(result, failures) {
  console.log(JSON.stringify({ ok: !failures.length, failures, ...result }, null, 2));
  if (failures.length) process.exitCode = 1;
}
module.exports = { report };
