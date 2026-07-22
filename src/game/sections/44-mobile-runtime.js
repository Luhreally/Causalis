// ═══════════════════════════════════════════════════════════════════════════
// 44. TOUCH-FIRST INTERFACE AND PHONE PERFORMANCE PROFILE
// Mobile presentation is a render/input lens. It never resizes an existing
// world or changes the fixed-tick simulation order.
// ═══════════════════════════════════════════════════════════════════════════
const MOBILE_SPEEDS = Object.freeze([1, 4, 16, 64]);
const MOBILE_WORLD_DEFAULTS = Object.freeze({
  size: "phone",
  complexity: "lean",
  quality: "low",
  labels: false,
});
const TOUCH_POINTERS = new Map();
let TOUCH_GESTURE = null;
let MOBILE_PANEL_OPENER = null;

const loadSettingsMobileBase = loadSettings;
loadSettings = function () {
  return Object.assign({ interfaceMode: "auto" }, loadSettingsMobileBase());
};

function mobileAutoMatch() {
  const width = Number(window.innerWidth) || document.documentElement.clientWidth || 1280;
  const height = Number(window.innerHeight) || document.documentElement.clientHeight || 800;
  const coarse = !!(
    window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0
  );
  return (coarse && Math.min(width, height) <= 700) || width <= 570;
}
function mobileInterfaceEnabled(mode = UI.interfaceMode || "auto") {
  return mode === "mobile" || (mode === "auto" && mobileAutoMatch());
}
function applyInterfaceMode(mode = "auto", refresh = true) {
  mode = ["auto", "mobile", "desktop"].includes(mode) ? mode : "auto";
  const wasMobile = !!UI.mobileMode,
    mobile = mobileInterfaceEnabled(mode);
  UI.interfaceMode = mode;
  UI.mobileMode = mobile;
  document.documentElement.classList.toggle("mobile-mode", mobile);
  document.documentElement.classList.toggle("desktop-mode", !mobile);
  document.documentElement.dataset.interface = mobile ? "mobile" : "desktop";
  if (mobile) {
    if (!wasMobile) UI.desktopEdgeScroll = UI.camera.edgeScroll;
    UI.camera.edgeScroll = false;
    UI.pointerInside = false;
    UI.cameraMotion = { x: 0, y: 0, orbit: 0, tilt: 0 };
  } else if (wasMobile && UI.desktopEdgeScroll != null) UI.camera.edgeScroll = UI.desktopEdgeScroll;
  closeMobilePanels();
  if (DOM.leftPanel) {
    DOM.leftPanel.classList.remove("collapsed");
    DOM.rightPanel.classList.remove("collapsed");
    document.documentElement.style.setProperty("--left", "");
    document.documentElement.style.setProperty("--right", "");
  }
  if (DOM.edgeScrollToggle) {
    DOM.edgeScrollToggle.disabled = mobile;
    DOM.edgeScrollToggle.checked = !mobile && UI.camera.edgeScroll !== false;
  }
  if (DOM.cameraHint)
    DOM.cameraHint.textContent = mobile
      ? "Drag to pan · pinch to zoom · tap the world to inspect or apply a tool"
      : "Wheel zoom · middle/right-drag orbit + pitch · Shift-drag pan · WASD/arrows move · Q/E rotate · Z/X pitch";
  if (refresh && DOM.canvas) {
    resizeCanvas();
    refreshCameraControls();
    syncMobileDock();
  }
  return mobile;
}

const cacheDomMobileBase = cacheDom;
cacheDom = function () {
  cacheDomMobileBase();
  for (const id of [
    "mobileLeftBtn",
    "mobileRightBtn",
    "panelScrim",
    "mobileDock",
    "dockToolsBtn",
    "dockZoomOutBtn",
    "dockPauseBtn",
    "dockZoomInBtn",
    "dockSpeedBtn",
    "dockSpeedValue",
    "dockToolLabel",
    "dockInspectBtn",
    "cameraHint",
  ]) {
    DOM[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
  }
};

function mobilePanelsOpen() {
  return !!(
    DOM.leftPanel?.classList.contains("open") || DOM.rightPanel?.classList.contains("open")
  );
}
function syncMobilePanels() {
  const left = !!DOM.leftPanel?.classList.contains("open"),
    right = !!DOM.rightPanel?.classList.contains("open"),
    open = left || right;
  DOM.panelScrim?.classList.toggle("open", open);
  DOM.panelScrim?.setAttribute("aria-hidden", String(!open));
  document.documentElement.classList.toggle("panel-open", open);
  for (const button of [DOM.mobileLeftBtn, DOM.dockToolsBtn])
    button?.setAttribute("aria-expanded", String(left));
  for (const button of [DOM.mobileRightBtn, DOM.dockInspectBtn])
    button?.setAttribute("aria-expanded", String(right));
  DOM.dockToolsBtn?.classList.toggle("active", left);
  DOM.dockInspectBtn?.classList.toggle("active", right);
  for (const [panel, isOpen] of [
    [DOM.leftPanel, left],
    [DOM.rightPanel, right],
  ])
    if (panel) {
      if (UI.mobileMode) {
        panel.setAttribute("aria-hidden", String(!isOpen));
        panel.inert = !isOpen;
      } else {
        panel.removeAttribute?.("aria-hidden");
        panel.inert = false;
      }
    }
}
function closeMobilePanels(restoreFocus = false) {
  DOM.leftPanel?.classList.remove("open");
  DOM.rightPanel?.classList.remove("open");
  syncMobilePanels();
  if (restoreFocus && MOBILE_PANEL_OPENER?.focus) MOBILE_PANEL_OPENER.focus();
  MOBILE_PANEL_OPENER = null;
}
function setMobilePanel(side, opener = null) {
  if (!UI.mobileMode) return false;
  const panel = side === "left" ? DOM.leftPanel : side === "right" ? DOM.rightPanel : null;
  const open = !!panel && !panel.classList.contains("open");
  DOM.leftPanel?.classList.remove("open");
  DOM.rightPanel?.classList.remove("open");
  if (open) {
    panel.classList.add("open");
    MOBILE_PANEL_OPENER = opener || document.activeElement;
  } else MOBILE_PANEL_OPENER = null;
  syncMobilePanels();
  return open;
}
function syncMobileDock() {
  if (!DOM.dockPauseBtn) return;
  const pauseIcon = DOM.dockPauseBtn.querySelector("span"),
    pauseLabel = DOM.dockPauseBtn.querySelector("small");
  if (pauseIcon) pauseIcon.textContent = UI.running ? "Ⅱ" : "▶";
  if (pauseLabel) pauseLabel.textContent = UI.running ? "Pause" : "Play";
  DOM.dockPauseBtn.setAttribute("aria-label", UI.running ? "Pause simulation" : "Play simulation");
  if (DOM.dockSpeedValue) DOM.dockSpeedValue.textContent = formatSpeed(UI.speed);
  if (DOM.dockToolLabel)
    DOM.dockToolLabel.textContent =
      TOOL_DEFS.find((x) => x[0] === UI.tool)?.[1] || titleCase(UI.tool);
  syncMobilePanels();
}

installResponsivePanels = function () {
  const leftButton = DOM.mobileLeftBtn,
    rightButton = DOM.mobileRightBtn;
  leftButton.onclick = () => setMobilePanel("left", leftButton);
  rightButton.onclick = () => setMobilePanel("right", rightButton);
  DOM.dockToolsBtn.onclick = () => setMobilePanel("left", DOM.dockToolsBtn);
  DOM.dockInspectBtn.onclick = () => setMobilePanel("right", DOM.dockInspectBtn);
  DOM.dockPauseBtn.onclick = () => togglePause();
  DOM.dockZoomOutBtn.onclick = () => zoomCamera(1 / 1.45);
  DOM.dockZoomInBtn.onclick = () => zoomCamera(1.45);
  DOM.dockSpeedBtn.onclick = () => {
    const current = MOBILE_SPEEDS.indexOf(UI.speed),
      next = MOBILE_SPEEDS[(current + 1 + MOBILE_SPEEDS.length) % MOBILE_SPEEDS.length];
    setSpeed(next);
  };
  DOM.panelScrim.onclick = () => closeMobilePanels(true);
  $$(`[data-collapse]`).forEach((button) => {
    const desktopHandler = button.onclick;
    button.onclick = (e) => {
      if (UI.mobileMode) {
        e.preventDefault();
        closeMobilePanels(true);
      } else desktopHandler?.call(button, e);
    };
  });
  DOM.leftPanel.addEventListener("click", (e) => {
    if (UI.mobileMode && e.target.closest("[data-tool],[data-overlay]")) closeMobilePanels(true);
  });
  const reevaluate = () => {
    const next = mobileInterfaceEnabled(UI.interfaceMode);
    if (next !== UI.mobileMode) applyInterfaceMode(UI.interfaceMode);
    else resizeCanvas();
  };
  window.addEventListener("resize", reevaluate);
  window.addEventListener("orientationchange", reevaluate);
  window.visualViewport?.addEventListener("resize", resizeCanvas);
  syncMobileDock();
};

function touchPoint(e) {
  const p = pointerPosition(e);
  return {
    id: e.pointerId,
    x: p.x,
    y: p.y,
    startX: p.x,
    startY: p.y,
    lastX: p.x,
    lastY: p.y,
    moved: false,
  };
}
function beginTouchPinch() {
  const points = Array.from(TOUCH_POINTERS.values());
  if (points.length < 2 || !W) return;
  const a = points[0],
    b = points[1],
    x = (a.x + b.x) / 2,
    y = (a.y + b.y) / 2;
  TOUCH_GESTURE = {
    ids: [a.id, b.id],
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    zoom: UI.camera.zoom,
    world: cameraWorldAtScreen(x, y),
    centerX: x,
    centerY: y,
    lastCenterX: x,
    lastCenterY: y,
    originA: { x: a.x, y: a.y },
    originB: { x: b.x, y: b.y },
    orbiting: false,
    multi: true,
  };
  for (const point of points) point.moved = true;
  UI.drag = true;
  UI.dragMoved = true;
  UI.dragMode = "pinch";
  UI.followId = 0;
  CAMERA_GLIDE.zoom = null;
}
function updateTouchPinch() {
  if (TOUCH_POINTERS.size < 2 || !TOUCH_GESTURE || !W) return;
  let a = TOUCH_POINTERS.get(TOUCH_GESTURE.ids[0]),
    b = TOUCH_POINTERS.get(TOUCH_GESTURE.ids[1]);
  if (!a || !b) {
    beginTouchPinch();
    a = TOUCH_POINTERS.get(TOUCH_GESTURE.ids[0]);
    b = TOUCH_POINTERS.get(TOUCH_GESTURE.ids[1]);
  }
  const x = (a.x + b.x) / 2,
    y = (a.y + b.y) / 2,
    distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    centerDx = x - TOUCH_GESTURE.lastCenterX,
    centerDy = y - TOUCH_GESTURE.lastCenterY,
    aDx = a.x - TOUCH_GESTURE.originA.x,
    aDy = a.y - TOUCH_GESTURE.originA.y,
    bDx = b.x - TOUCH_GESTURE.originB.x,
    bDy = b.y - TOUCH_GESTURE.originB.y,
    aTravel = Math.hypot(aDx, aDy),
    bTravel = Math.hypot(bDx, bDy),
    coherence = aTravel > 0 && bTravel > 0 ? (aDx * bDx + aDy * bDy) / (aTravel * bTravel) : -1;
  UI.camera.zoom = clamp((TOUCH_GESTURE.zoom * distance) / TOUCH_GESTURE.distance, 0.16, 80);
  if ((aTravel > 5 && bTravel > 5 && coherence > 0.55) || TOUCH_GESTURE.orbiting) {
    TOUCH_GESTURE.orbiting = true;
    orbitCamera(centerDx * 0.0065, -centerDy * 0.0048);
  }
  const after = cameraWorldAtScreen(x, y);
  UI.camera.x += TOUCH_GESTURE.world.x - after.x;
  UI.camera.y += TOUCH_GESTURE.world.y - after.y;
  TOUCH_GESTURE.world = cameraWorldAtScreen(x, y);
  TOUCH_GESTURE.lastCenterX = x;
  TOUCH_GESTURE.lastCenterY = y;
  clampCamera();
  refreshCameraControls();
  DOM.tooltip.style.display = "none";
}
function resumeRemainingTouch() {
  if (TOUCH_POINTERS.size !== 1) return;
  const remaining = TOUCH_POINTERS.values().next().value;
  remaining.startX = remaining.lastX = remaining.x;
  remaining.startY = remaining.lastY = remaining.y;
  remaining.moved = true;
  UI.lastPointer = { x: remaining.x, y: remaining.y };
  UI.drag = true;
  UI.dragMoved = true;
  UI.dragMode = "pan";
}
function cancelTouchPointer(e) {
  if (e.pointerType !== "touch") return;
  TOUCH_POINTERS.delete(e.pointerId);
  if (UI.suppressedWorldPointer === e.pointerId) UI.suppressedWorldPointer = null;
  if (TOUCH_POINTERS.size >= 2) beginTouchPinch();
  else {
    TOUCH_GESTURE = null;
    resumeRemainingTouch();
  }
  if (!TOUCH_POINTERS.size) {
    UI.drag = false;
    UI.dragMode = "pan";
    DOM.canvas.style.cursor = UI.tool === "inspect" ? "crosshair" : "cell";
  }
}

const handlePointerDownMobileBase = handlePointerDown;
handlePointerDown = function (e) {
  if (UI.mobileMode && mobilePanelsOpen()) {
    UI.suppressedWorldPointer = e.pointerId;
    closeMobilePanels();
    e.preventDefault?.();
    return;
  }
  if (!UI.mobileMode || e.pointerType !== "touch") return handlePointerDownMobileBase(e);
  if (!W) return;
  e.preventDefault?.();
  UI.pointerInside = false;
  const point = touchPoint(e);
  TOUCH_POINTERS.set(e.pointerId, point);
  UI.drag = true;
  UI.dragMoved = false;
  UI.dragButton = 0;
  UI.dragMode = "pan";
  UI.lastPointer = { x: point.x, y: point.y };
  DOM.canvas.setPointerCapture(e.pointerId);
  if (TOUCH_POINTERS.size >= 2) beginTouchPinch();
};
const handlePointerMoveMobileBase = handlePointerMove;
handlePointerMove = function (e) {
  if (!UI.mobileMode || e.pointerType !== "touch") return handlePointerMoveMobileBase(e);
  const point = TOUCH_POINTERS.get(e.pointerId);
  if (!point) return;
  e.preventDefault?.();
  const p = pointerPosition(e);
  point.x = p.x;
  point.y = p.y;
  UI.lastPointer = p;
  if (TOUCH_POINTERS.size >= 2) {
    updateTouchPinch();
    return;
  }
  const total = Math.hypot(point.x - point.startX, point.y - point.startY),
    dx = point.x - point.lastX,
    dy = point.y - point.lastY;
  if (total > 10) point.moved = UI.dragMoved = true;
  if (point.moved && (dx || dy)) {
    panCamera(dx, dy);
    UI.followId = 0;
  }
  point.lastX = point.x;
  point.lastY = point.y;
};
const handlePointerUpMobileBase = handlePointerUp;
handlePointerUp = function (e) {
  if (UI.suppressedWorldPointer === e.pointerId) {
    UI.suppressedWorldPointer = null;
    TOUCH_POINTERS.delete(e.pointerId);
    try {
      DOM.canvas.releasePointerCapture(e.pointerId);
    } catch {}
    return;
  }
  if (!UI.mobileMode || e.pointerType !== "touch") return handlePointerUpMobileBase(e);
  const point = TOUCH_POINTERS.get(e.pointerId),
    wasMulti = !!TOUCH_GESTURE?.multi || TOUCH_POINTERS.size > 1;
  TOUCH_POINTERS.delete(e.pointerId);
  if (!wasMulti && point) {
    UI.dragMoved = point.moved;
    handlePointerUpMobileBase(e);
  } else {
    UI.drag = false;
    UI.dragMoved = true;
    UI.dragMode = "pan";
    try {
      DOM.canvas.releasePointerCapture(e.pointerId);
    } catch {}
  }
  if (TOUCH_POINTERS.size >= 2) beginTouchPinch();
  else {
    TOUCH_GESTURE = null;
    resumeRemainingTouch();
  }
};

const handleKeyMobileBase = handleKey;
handleKey = function (e) {
  if (UI.mobileMode && e.key?.toLowerCase() === "escape" && mobilePanelsOpen()) {
    e.preventDefault();
    closeMobilePanels(true);
    return;
  }
  handleKeyMobileBase(e);
};

const bindUIMobileBase = bindUI;
bindUI = function () {
  bindUIMobileBase();
  const qualityHandler = DOM.renderQuality.onchange;
  DOM.renderQuality.onchange = (e) => {
    qualityHandler?.call(DOM.renderQuality, e);
    resizeCanvas();
  };
  DOM.canvas.addEventListener("pointercancel", cancelTouchPointer);
  DOM.canvas.addEventListener("lostpointercapture", cancelTouchPointer);
};
const bindCameraUIMobileBase = bindCameraUI;
bindCameraUI = function () {
  bindCameraUIMobileBase();
  const edgeHandler = DOM.edgeScrollToggle.onchange;
  DOM.edgeScrollToggle.onchange = (e) => {
    if (UI.mobileMode) {
      e.target.checked = false;
      UI.camera.edgeScroll = false;
      UI.cameraMotion.x = 0;
      UI.cameraMotion.y = 0;
      return;
    }
    edgeHandler?.call(DOM.edgeScrollToggle, e);
  };
  DOM.edgeScrollToggle.disabled = !!UI.mobileMode;
};

const setSpeedMobileBase = setSpeed;
setSpeed = function (speed) {
  setSpeedMobileBase(speed);
  syncMobileDock();
};
const togglePauseMobileBase = togglePause;
togglePause = function (force) {
  togglePauseMobileBase(force);
  syncMobileDock();
};
const setToolMobileBase = setTool;
setTool = function (tool) {
  setToolMobileBase(tool);
  syncMobileDock();
};

resizeCanvas = function () {
  const c = DOM.canvas,
    cap = UI.mobileMode && UI.quality === "low" ? 1.5 : 2,
    dpr = Math.min(cap, Number(window.devicePixelRatio) || 1),
    r = c.getBoundingClientRect(),
    width = Math.max(1, Math.floor(r.width * dpr)),
    height = Math.max(1, Math.floor(r.height * dpr)),
    resized = c.width !== width || c.height !== height;
  if (resized) {
    c.width = width;
    c.height = height;
  }
  if (resized || c._dpr !== dpr) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    c._dpr = dpr;
  }
};

const runSimulationClockMobileBase = runSimulationClock;
runSimulationClock = function (dt, budgetMs = null) {
  const phoneBudget = UI.mobileMode
    ? UI.speed >= 128
      ? 18
      : UI.speed >= 64
        ? 15
        : UI.speed >= 16
          ? 12
          : 9
    : null;
  return runSimulationClockMobileBase(dt, budgetMs ?? phoneBudget);
};

showNewWorld = function () {
  const mobile = !!UI.mobileMode,
    defaultSize = mobile ? MOBILE_WORLD_DEFAULTS.size : "standard",
    defaultComplexity = mobile ? MOBILE_WORLD_DEFAULTS.complexity : "standard";
  const selected = (value) => (value === defaultSize ? " selected" : "");
  openModal(
    "Compose a new cosmos",
    `<div class="form-grid"><label class="field" style="grid-column:1/-1"><span>Master seed</span><div class="row"><input id="newSeed" type="text" maxlength="48" value="${freshSeed()}"><button id="randomSeedBtn" class="small">Randomize</button></div></label><label class="field"><span>World size</span><select id="newSize"><option value="battery"${selected("battery")}>Battery saver · 72 × 44</option><option value="phone"${selected("phone")}>Phone · 96 × 58 (recommended)</option><option value="small"${selected("small")}>Small · 120 × 72</option><option value="standard"${selected("standard")}>Standard · 180 × 110</option><option value="grand"${selected("grand")}>Grand · 220 × 132</option></select><small id="worldProfileNote">${mobile ? "Phone is tuned for your touch interface; Battery saver uses the least memory." : "Standard preserves the original desktop default."}</small></label><label class="field"><span>Initial life density <b class="range-value" id="lifeDensityV">1.0×</b></span><input id="lifeDensity" type="range" min="0.6" max="1.8" value="1" step="0.1"></label><label class="field"><span>Climate harshness <b class="range-value" id="harshnessV">0.5</b></span><input id="harshness" type="range" min="0" max="1" value="0.5" step="0.1"></label><label class="field"><span>Law variability <b class="range-value" id="variabilityV">0.5</b></span><input id="variability" type="range" min="0" max="1.5" value="0.5" step="0.1"></label><label class="field"><span>Disaster frequency</span><select id="disasterFrequency"><option value="0.65">Quiet</option><option value="1" selected>Natural</option><option value="1.6">Volatile</option></select></label><label class="field"><span>Simulation complexity</span><select id="complexity"><option value="lean" ${defaultComplexity === "lean" ? "selected" : ""}>Lean</option><option value="standard" ${defaultComplexity === "standard" ? "selected" : ""}>Balanced</option><option value="deep">Deep</option></select></label><label class="check"><input id="chaoticLaws" type="checkbox"> Chaotic laws</label><label class="check"><input id="unfilteredCosmos" type="checkbox"> Unfiltered cosmos (may be hostile)</label><label class="check"><input id="tutorialHints" type="checkbox" checked> Tutorial hints</label></div><div class="card" style="margin-top:14px"><div class="eyebrow">Deep-time bootstrap</div><div class="muted" style="line-height:1.5;margin-top:5px">World size is fixed when history begins. Saves always retain their original dimensions, laws, matter, and deterministic timeline.</div></div>`,
    `<button id="cancelNew">Cancel</button><button id="createWorldBtn" class="primary">Generate World</button>`,
    true,
  );
  const bind = (id, out, suffix = "") => {
    $(`#${id}`).oninput = (e) => ($(`#${out}`).textContent = `${e.target.value}${suffix}`);
  };
  bind("lifeDensity", "lifeDensityV", "×");
  bind("harshness", "harshnessV");
  bind("variability", "variabilityV");
  $("#newSize").onchange = (e) => {
    $("#worldProfileNote").textContent =
      e.target.value === "battery"
        ? "Fastest phone profile with the smallest supported geography."
        : e.target.value === "phone"
          ? "Recommended for iPhone 15 Plus: 5,568 tiles and full simulation rules."
          : e.target.value === "small"
            ? "Richer phone world; use Low rendering for smoother 3D."
            : "Desktop-scale world; generation and 3D rendering are heavier on a phone.";
  };
  $("#randomSeedBtn").onclick = () => ($("#newSeed").value = freshSeed());
  $("#cancelNew").onclick = closeModal;
  $("#createWorldBtn").onclick = () => {
    const chaotic = $("#chaoticLaws").checked,
      size = $("#newSize").value,
      phoneProfile = UI.mobileMode && (size === "phone" || size === "battery"),
      opts = {
        seed: $("#newSeed").value,
        size,
        lifeDensity: Number($("#lifeDensity").value),
        harshness: Number($("#harshness").value),
        variability: chaotic ? 1.5 : Number($("#variability").value),
        disasterFrequency: Number($("#disasterFrequency").value),
        complexity: $("#complexity").value,
        tutorial: $("#tutorialHints").checked,
        unfiltered: $("#unfilteredCosmos").checked,
        chaotic,
      };
    if (phoneProfile) {
      UI.quality = "low";
      UI.labels = false;
    }
    closeModal();
    performWorldCreation(opts);
  };
};

const showSettingsMobileBase = showSettings;
showSettings = function () {
  showSettingsMobileBase();
  const settings = loadSettings(),
    stack = DOM.modalBody.querySelector(".stack");
  stack?.insertAdjacentHTML(
    "beforeend",
    `<label class="field"><span>Interface layout</span><select id="settingInterface"><option value="auto" ${settings.interfaceMode === "auto" ? "selected" : ""}>Auto for this device</option><option value="mobile" ${settings.interfaceMode === "mobile" ? "selected" : ""}>Always use touch layout</option><option value="desktop" ${settings.interfaceMode === "desktop" ? "selected" : ""}>Always use desktop layout</option></select></label>`,
  );
  const save = $("#saveSettings"),
    baseHandler = save.onclick;
  save.onclick = () => {
    const mode = $("#settingInterface").value;
    baseHandler();
    const next = loadSettings();
    next.interfaceMode = mode;
    persistSettings(next);
    applyInterfaceMode(mode);
    toast(UI.mobileMode ? "Touch layout enabled" : "Desktop layout enabled");
  };
};
const showHelpMobileBase = showHelp;
showHelp = function () {
  showHelpMobileBase();
  if (UI.mobileMode)
    DOM.modalBody.insertAdjacentHTML(
      "afterbegin",
      `<div class="help-card good" style="margin-bottom:10px"><h3>Touch controls</h3><p>Drag one finger to pan. Pinch with two fingers to zoom; move both fingers together to orbit and tilt in free roam. Tap to inspect or use the selected instrument. The bottom dock opens tools and the observatory, controls time, and zooms without covering the world.</p></div>`,
    );
};

const enterGameMobileBase = enterGame;
enterGame = function () {
  enterGameMobileBase();
  if (UI.mobileMode) {
    UI.camera.edgeScroll = false;
    DOM.edgeScrollToggle.checked = false;
    DOM.edgeScrollToggle.disabled = true;
  }
  closeMobilePanels();
  syncMobileDock();
};
const returnToTitleMobileBase = returnToTitle;
returnToTitle = function () {
  returnToTitleMobileBase();
  closeMobilePanels();
};

const bootMobileBase = boot;
boot = function () {
  const settings = loadSettings();
  applyInterfaceMode(settings.interfaceMode || "auto", false);
  bootMobileBase();
  applyInterfaceMode(settings.interfaceMode || "auto", false);
  syncMobileDock();
  window.ALIFE_MOBILE_DEBUG = Object.freeze({
    mode: () => ({
      preference: UI.interfaceMode,
      active: UI.mobileMode,
      viewport: [Number(window.innerWidth) || 0, Number(window.innerHeight) || 0],
      edgeScroll: UI.camera.edgeScroll,
    }),
    sizes: () =>
      Object.fromEntries(Object.entries(SIZE_PRESETS).map(([name, size]) => [name, size.slice()])),
    defaults: () =>
      UI.mobileMode
        ? { ...MOBILE_WORLD_DEFAULTS }
        : { size: "standard", complexity: "standard", quality: UI.quality, labels: UI.labels },
    apply: applyInterfaceMode,
    panels: () => ({
      left: DOM.leftPanel.classList.contains("open"),
      right: DOM.rightPanel.classList.contains("open"),
    }),
    camera: () => ({
      x: UI.camera.x,
      y: UI.camera.y,
      zoom: UI.camera.zoom,
      angle: UI.camera.angle,
      tilt: UI.camera.tilt,
      view: UI.view,
    }),
    selection: () => ({ tile: UI.selectedTile, entity: UI.selectedEntity }),
    touches: () => ({ count: TOUCH_POINTERS.size, pinch: !!TOUCH_GESTURE }),
    canvas: () => ({
      width: DOM.canvas.width,
      height: DOM.canvas.height,
      dpr: DOM.canvas._dpr || 1,
    }),
  });
};
