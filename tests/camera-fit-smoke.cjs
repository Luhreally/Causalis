// A world fills its canvas (157): the home zoom fits the whole world in each
// view, a loaded world shown smaller than that is fitted when first drawn, and
// the camera does not zoom out past seven tenths of the fit.
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
const rt = loadRuntime(),
  debug = rt.sandbox.window.ALIFE_CAMERA_FIT_DEBUG;
rt.sandbox.window.ALIFE_DEBUG.createTestWorld({
  seed: "causal-origin",
  size: "battery",
  complexity: "lean",
});
const fits = {};
for (const view of ["top", "iso", "oblique"]) {
  rt.get(`UI.view = ${JSON.stringify(view)}`);
  fits[view] = +debug.fit().toFixed(3);
  // At the fit, the four corners of the world lie inside the canvas.
  rt.get(
    `(UI.camera.zoom = ${debug.fit()}, UI.camera.x = W.width / 2, UI.camera.y = W.height / 2)`,
  );
  const inside = rt.get(
    `(() => { const m = projectionMetrics(); return [[0,0],[W.width,0],[0,W.height],[W.width,W.height]].every(([x, y]) => { const p = projectWithMetrics(x, y, 0, m); return p.x >= -1 && p.y >= -1 && p.x <= m.w + 1 && p.y <= m.h + 1; }); })()`,
  );
  if (!inside) failures.push(`at the ${view} fit a corner of the world is off the canvas`);
}
rt.get('UI.view = "top"');
if (!(fits.top > 1.5)) failures.push(`the top fit of a battery world is only ${fits.top}`);
// Zooming far out stops at the floor.
rt.get("(UI.camera.zoom = fitZoom(), CAMERA_GLIDE.zoom = null)");
rt.get("zoomCamera(0.01)");
const target = rt.get("CAMERA_GLIDE.zoom"),
  floor = debug.floor();
if (Math.abs(target - floor) > 1e-6)
  failures.push(`zooming out went to ${target}, not the floor ${floor}`);
// A camera left at zoom 1 is fitted on the first draw after a load.
rt.get("(UI.camera.zoom = 1, UI.cameraFitPending = true)");
rt.get("renderWorld(1000)");
if (debug.pending()) failures.push("the fit stayed pending after a draw");
if (!(rt.get("UI.camera.zoom") >= fits.top - 1e-3))
  failures.push("a world shown small was not fitted");
report({ fits, floor: +floor.toFixed(3) }, failures);
