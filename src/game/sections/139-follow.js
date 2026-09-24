// ═══════════════════════════════════════════════════════════════════════════
// 139. FOLLOWING A LIFE — the camera holds it in the middle of what is seen
// ═══════════════════════════════════════════════════════════════════════════
// Three things stood between "Follow this life" and a life you could watch.
//
// The button did nothing to the camera. The inspector's small Follow snapped
// the camera to the person and clamped it (37); the experience panel's
// "Follow this life" set the followed id and refreshed the panel (45), and
// left the camera wherever it was, so on a world pressed far from the person
// the player pressed a button and nothing happened — the render loop's ease
// crawled toward them at a sixth of the remaining distance a frame, from the
// far side of the map, with nothing to look at on the way.
//
// The camera aimed at the tile, not at the figure. The follow eased the
// camera toward the person's smoothed world point, and the middle of the
// canvas is that point at ground level (32, projectWithMetrics), but the
// figure is drawn lifted by the ground it stands on: the elevation term is
// eighteen pixels a unit at zoom one in the oblique lens, and nothing lifts
// the camera with it. Measured on battery causal-origin at year forty, on a
// 960 by 720 canvas, a person standing on ground of 0.9: forty-one pixels
// above the middle in the oblique lens at zoom 2.6, seventy-eight at zoom 5,
// twelve in the isometric one, none in the top-down one, which has no lift.
// The ease made it worse while the person walked, since an exponential ease
// toward a moving point always trails it, by as much again at zoom 5.
//
// And the middle of the canvas is not the middle of what the player sees.
// The people bar covers the foot of the stage, and on a phone the panels are
// drawers over it, ninety-two percent of the width: pressing Follow in the
// inspector centred the life behind the drawer the player had just used. A
// phone's canvas is 430 by 816 where a desktop's is 1600 by 900, so the
// answer cannot be a constant either.
//
// The people bar had a fourth way of its own, and it never followed at all:
// it set the followed id and then called the history focus, which clears the
// followed id before it glides (32d), so a tap on a life already selected
// there followed nothing.
//
// So: one way to focus a life, for every button that offers it — the two in
// the inspector, the people bar, and a click on the life itself. The
// camera is solved, not eased toward — the world point that puts the
// figure's own drawn anchor on the middle of the free part of the canvas,
// found by inverting the lens (33, cameraWorldAtScreen), which costs one
// projection and works the same in all three of them. The free part is the
// canvas less whatever covers it: the people bar, and an open drawer on a
// phone, each measured from the page rather than assumed, and each ignored
// if it would leave less than half the canvas to aim at. A life far from the
// camera glides in; a life in hand is held exactly, frame by frame, so a
// standing person does not drift and a walking one does not trail. And the
// press closes the drawer that would cover them and opens the world to a
// span of about forty tiles across its shorter side, which is a readable
// life on a phone and on a desktop both, since it is the span that is held
// and not the zoom.
const FOLLOW = {
  centred: 0,
  glided: 0,
  inset: { left: 0, top: 0, right: 0, bottom: 0 },
  span: 0,
};
const FOLLOW_KEEP = 0.5, // never aim at less than half the canvas on an axis
  FOLLOW_SNAP = 1.2, // world tiles: nearer than this and the camera is solved outright
  FOLLOW_EASE = 0.02, // per millisecond, so the glide is the same at any frame rate
  FOLLOW_SPAN = 40, // tiles across the shorter side of the free part, when a follow starts
  FOLLOW_ZOOM = [1.4, 6];
// The panels are drawers over the stage on a phone and columns beside it on a
// desktop, so both are read from the page and only the overlap counts.
function followOverlayNodes() {
  const bar = DOM.peopleBar || (DOM.peopleBar = typeof $ === "function" ? $("#peopleBar") : null);
  return [bar, DOM.leftPanel, DOM.rightPanel].filter(
    (node) => node && typeof node.getBoundingClientRect === "function",
  );
}
function followRectOf(node) {
  const r = node.getBoundingClientRect();
  if (!r) return null;
  const w = Number.isFinite(r.width) ? r.width : 0,
    h = Number.isFinite(r.height) ? r.height : 0;
  if (!(w > 0) || !(h > 0)) return null;
  const left = Number.isFinite(r.left) ? r.left : 0,
    top = Number.isFinite(r.top) ? r.top : 0;
  return { left, top, right: left + w, bottom: top + h };
}
// The part of the canvas the player can actually see, in canvas pixels.
function focusViewportRect(m = projectionMetrics()) {
  const rect = { left: 0, top: 0, right: m.w, bottom: m.h };
  FOLLOW.inset = { left: 0, top: 0, right: 0, bottom: 0 };
  const canvas = DOM.canvas && followRectOf(DOM.canvas);
  if (!canvas) return rect;
  const sx = m.w / (canvas.right - canvas.left),
    sy = m.h / (canvas.bottom - canvas.top);
  for (const node of followOverlayNodes()) {
    const r = followRectOf(node);
    if (!r) continue;
    const x0 = (Math.max(r.left, canvas.left) - canvas.left) * sx,
      x1 = (Math.min(r.right, canvas.right) - canvas.left) * sx,
      y0 = (Math.max(r.top, canvas.top) - canvas.top) * sy,
      y1 = (Math.min(r.bottom, canvas.bottom) - canvas.top) * sy;
    if (!(x1 > x0) || !(y1 > y0)) continue;
    // A cover is docked to whichever edge it reaches, give or take the gap the
    // page leaves round it; the shallowest bite is the one it takes.
    const gx = Math.max(12, m.w * 0.04),
      gy = Math.max(12, m.h * 0.04),
      bites = [
        ["left", x1 - rect.left, x0 <= rect.left + gx],
        ["right", rect.right - x0, x1 >= rect.right - gx],
        ["top", y1 - rect.top, y0 <= rect.top + gy],
        ["bottom", rect.bottom - y0, y1 >= rect.bottom - gy],
      ]
        .filter(([, bite, touches]) => touches && bite > 0)
        .sort((a, b) => a[1] - b[1]);
    if (!bites.length) continue;
    const [edge, bite] = bites[0],
      next = { ...rect };
    if (edge === "left") next.left += bite;
    else if (edge === "right") next.right -= bite;
    else if (edge === "top") next.top += bite;
    else next.bottom -= bite;
    if (next.right - next.left < m.w * FOLLOW_KEEP || next.bottom - next.top < m.h * FOLLOW_KEEP)
      continue;
    rect.left = next.left;
    rect.right = next.right;
    rect.top = next.top;
    rect.bottom = next.bottom;
    FOLLOW.inset[edge] += bite;
  }
  return rect;
}
function focusViewportCentre(m = projectionMetrics()) {
  const r = focusViewportRect(m);
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
}
// The point the figure is drawn from: its own smoothed place in the world,
// crowd shuffle and all (32d), not the tile beneath it.
function followAnchorWorld(id) {
  const p = W?.components?.position?.[id];
  if (!p) return null;
  const t = typeof VISUAL_MOTION !== "undefined" ? VISUAL_MOTION.get(id) : null;
  return {
    x: t && Number.isFinite(t.wx) ? t.wx : p.x + 0.5,
    y: t && Number.isFinite(t.wy) ? t.wy : p.y + 0.5,
  };
}
// The camera that puts that anchor on the middle of the free part. The lens is
// affine in the world and adds the ground's lift in screen y alone, so the lift
// is measured against the same point at sea level and the rest is inverted.
function followCameraTarget(id, m = projectionMetrics()) {
  const a = followAnchorWorld(id);
  if (!a || !m.w || !m.h) return null;
  const el = UI.view === "top" ? 0 : elevationAtSmooth(a.x, a.y),
    lift = projectWithMetrics(a.x, a.y, el, m).y - projectWithMetrics(a.x, a.y, 0, m).y,
    v = focusViewportCentre(m),
    seen = cameraWorldAtScreen(m.w / 2 + (v.x - m.w / 2), m.h / 2 + (v.y - m.h / 2 - lift));
  return { x: a.x - (seen.x - UI.camera.x), y: a.y - (seen.y - UI.camera.y) };
}
// One step of the follow, called by the renderer before it draws.
function followCameraStep(now) {
  if (!W || !UI.followId) {
    FOLLOW.last = now;
    return false;
  }
  const target = followCameraTarget(UI.followId);
  if (!target) return false;
  const dt = clamp(now - (FOLLOW.last || now), 0, 120);
  FOLLOW.last = now;
  const dx = target.x - UI.camera.x,
    dy = target.y - UI.camera.y;
  if (Math.hypot(dx, dy) > FOLLOW_SNAP) {
    const f = 1 - Math.exp(-dt * FOLLOW_EASE);
    UI.camera.x += dx * f;
    UI.camera.y += dy * f;
    FOLLOW.glided++;
  } else {
    UI.camera.x = target.x;
    UI.camera.y = target.y;
    FOLLOW.centred++;
  }
  clampCamera();
  return true;
}
// A span of ground rather than a zoom, so a life reads the same on a phone as
// on a desktop. The lens scales with the zoom, so the span it shows now gives
// the zoom the wanted span needs.
function followSpanZoom(span = FOLLOW_SPAN) {
  const m = projectionMetrics();
  if (!(m.tw > 0) || !(m.th > 0)) return UI.camera.zoom;
  const r = focusViewportRect(m),
    shown = Math.min((r.right - r.left) / m.tw, (r.bottom - r.top) / m.th);
  if (!(shown > 0)) return UI.camera.zoom;
  FOLLOW.span = shown;
  return clamp((UI.camera.zoom * shown) / span, FOLLOW_ZOOM[0], FOLLOW_ZOOM[1]);
}
// The one way to follow a life, for every button that offers it.
function focusLife(id, { toggle = true, open = true } = {}) {
  if (!W || !id || !W.components?.position?.[id]) return false;
  const following = UI.followId === id && toggle;
  UI.followId = following ? 0 : id;
  if (!UI.followId) return false;
  // The drawer the press came from would cover the life it focused.
  if (open && UI.mobileMode && typeof closeMobilePanels === "function") closeMobilePanels();
  CAMERA_GLIDE.cx = null;
  CAMERA_GLIDE.cy = null;
  if (open) {
    const zoom = followSpanZoom();
    if (zoom > UI.camera.zoom * 1.02) {
      CAMERA_GLIDE.zoom = zoom;
      CAMERA_GLIDE.px = null;
      CAMERA_GLIDE.py = null;
    }
  }
  const target = followCameraTarget(id);
  if (target) {
    UI.camera.x = target.x;
    UI.camera.y = target.y;
    clampCamera();
  }
  return true;
}
window.ALIFE_FOLLOW_DEBUG = Object.freeze({
  counts: () => ({ ...FOLLOW, inset: { ...FOLLOW.inset } }),
  viewport: () => focusViewportRect(),
  centre: () => focusViewportCentre(),
  target: (id = UI.followId) => followCameraTarget(id),
  anchor: (id = UI.followId) => followAnchorWorld(id),
  spanZoom: (span = FOLLOW_SPAN) => followSpanZoom(span),
  focus: (id) => focusLife(id),
  offset: (id = UI.followId) => {
    const t = typeof VISUAL_MOTION !== "undefined" ? VISUAL_MOTION.get(id) : null,
      m = projectionMetrics(),
      v = focusViewportCentre(m);
    return t?.s ? { x: t.s.x - v.x, y: t.s.y - v.y } : null;
  },
});
