// ═══════════════════════════════════════════════════════════════════════════
// 157. A WORLD THAT FILLS THE SCREEN
// ═══════════════════════════════════════════════════════════════════════════
// A new world, a loaded one and the "centre" button all came to zoom 1, and at
// zoom 1 a battery world (72 by 44 tiles, five and a half pixels a tile from
// above) is 400 by 240 pixels in a canvas three or four times that: the world
// floated small in a dark field, on the desktop and more so on a phone. Zoom
// could also go out to 0.16, where it is a speck.
//
// The home zoom is now the one at which the whole world fills the canvas in the
// current view (the four corners projected, a little margin kept), and the
// camera cannot be zoomed out past seven tenths of it. A world is fitted once
// its canvas has a size: after it is made, or loaded with a camera that shows
// it smaller than that. Only the camera is touched; the world is not read for
// anything but its size.
const CAMERA_FIT_MARGIN = 0.94,
  CAMERA_FIT_FLOOR = 0.7;

// The zoom at which the whole world fits the canvas in the current view.
function fitZoom() {
  if (!W || !DOM.canvas) return 1;
  const w = DOM.canvas.clientWidth,
    h = DOM.canvas.clientHeight;
  if (!(w > 50 && h > 50)) return 1;
  const corners = [
    [0, 0],
    [W.width, 0],
    [0, W.height],
    [W.width, W.height],
  ];
  let project;
  if (UI.view === "top") project = (x, y) => [x * 5.5, y * 5.5];
  else if (UI.view === "iso") project = (x, y) => [(x - y) * 5, (x + y) * 2.5];
  else {
    const a = cameraAngle(),
      c = Math.cos(a),
      s = Math.sin(a),
      th = 6.4 * cameraTilt();
    project = (x, y) => [(x * c + y * s) * 6.4, (-x * s + y * c) * th];
  }
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [x, y] of corners) {
    const [px, py] = project(x, y);
    x0 = Math.min(x0, px);
    x1 = Math.max(x1, px);
    y0 = Math.min(y0, py);
    y1 = Math.max(y1, py);
  }
  return clamp(Math.min(w / (x1 - x0), h / (y1 - y0)) * CAMERA_FIT_MARGIN, 0.16, 80);
}
function minCameraZoom() {
  return clamp(fitZoom() * CAMERA_FIT_FLOOR, 0.16, 80);
}

// The centre button and the Home key: the whole world, filling the screen.
const centerCameraFitBase = centerCamera;
centerCamera = function (resetZoom = true) {
  centerCameraFitBase(resetZoom);
  if (resetZoom && W) {
    UI.camera.zoom = fitZoom();
    refreshCameraControls();
  }
};
// No zooming out past the floor, by wheel, button or pinch.
const zoomCameraFitBase = zoomCamera;
zoomCamera = function (factor, px, py) {
  if (!W) return;
  const current = CAMERA_GLIDE.zoom ?? UI.camera.zoom,
    floor = minCameraZoom();
  if (factor < 1 && current * factor < floor) factor = Math.min(1, floor / current);
  return zoomCameraFitBase(factor, px, py);
};

// Fit once the canvas has a size: a world just made or loaded may be staged
// while the title screen still covers the canvas.
const renderWorldFitBase = renderWorld;
renderWorld = function (now) {
  if (UI.cameraFitPending && W && DOM.canvas?.clientWidth > 50 && DOM.canvas?.clientHeight > 50) {
    UI.cameraFitPending = false;
    const fit = fitZoom();
    if (!(UI.camera.zoom >= fit)) {
      UI.camera.zoom = fit;
      UI.camera.x = W.width / 2;
      UI.camera.y = W.height / 2;
      CAMERA_GLIDE.zoom = CAMERA_GLIDE.cx = CAMERA_GLIDE.cy = null;
      refreshCameraControls();
    }
  }
  return renderWorldFitBase(now);
};

window.ALIFE_CAMERA_FIT_DEBUG = Object.freeze({
  fit: () => fitZoom(),
  floor: () => minCameraZoom(),
  pending: () => !!UI.cameraFitPending,
});
