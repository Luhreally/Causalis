// ═══════════════════════════════════════════════════════════════════════════
// 33. CAMERA AND INPUT HANDLING
// ═══════════════════════════════════════════════════════════════════════════
function setView(view) {
  if (!["top", "iso", "oblique"].includes(view)) return;
  UI.view = view;
  if (!Number.isFinite(UI.camera.angle)) UI.camera.angle = -0.35;
  if (!Number.isFinite(UI.camera.tilt)) UI.camera.tilt = 0.58;
  $$(`[data-view]`).forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  DOM.viewLabel.textContent =
    view === "top" ? "Top-down" : view === "iso" ? "Isometric" : "Free 3D";
  DOM.mapLens.textContent = `${DOM.viewLabel.textContent} substrate`;
  refreshCameraControls();
  refreshUI(true);
}
function setOverlay(name) {
  UI.overlay = UI.overlay === name ? null : name;
  $$(`.overlay-btn`).forEach((b) => b.classList.toggle("active", b.dataset.overlay === UI.overlay));
  DOM.mapOverlay.textContent = UI.overlay ? `${titleCase(UI.overlay)} field` : "No overlay";
}
function setTool(tool) {
  UI.tool = tool;
  $$(`.tool`).forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  const d = TOOL_DEFS.find((x) => x[0] === tool);
  DOM.toolLabel.textContent = d?.[1] || titleCase(tool);
  DOM.bottomTool.textContent = d?.[1] || titleCase(tool);
  DOM.contextText.textContent = d?.[3] || "Click the world.";
  DOM.canvas.style.cursor = tool === "inspect" ? "crosshair" : "cell";
}
function formatSpeed(speed) {
  return speed === 0.25 ? "¼×" : speed === 0.5 ? "½×" : `${speed}×`;
}
function setSpeed(speed) {
  UI.speed = clamp(Number(speed) || 1, 0.25, 128);
  $$(`[data-speed]`).forEach((b) =>
    b.classList.toggle("active", Number(b.dataset.speed) === UI.speed),
  );
  DOM.speedLabel.textContent = formatSpeed(UI.speed);
  refreshTopbar();
}
function togglePause(force) {
  UI.running = force == null ? !UI.running : !!force;
  if (UI.running) {
    UI.clockInterrupted = false;
    UI.followDeathWasRunning = false;
  }
  DOM.pauseBtn.textContent = UI.running ? "Ⅱ" : "▶";
  refreshTopbar();
  audioClick(310);
}
function causalSkipMicroStages() {
  const authority = normalizeCivilizationAuthority(),
    next = CIV_STAGE_ORDER[authority.stageIndex + 1],
    places = () => [...W.camps.filter((c) => c.active), ...W.settlements.filter((s) => !s.ruined)],
    settlements = () => W.settlements.filter((s) => !s.ruined);
  if (next === "sapient foraging")
    return [
      { key: "first", label: "a first person", done: () => biospherePopulation(KINDS.PERSON) >= 1 },
      { key: "pair", label: "a forager pair", done: () => biospherePopulation(KINDS.PERSON) >= 2 },
      { key: "band", label: "a growing band", done: () => biospherePopulation(KINDS.PERSON) >= 3 },
      {
        key: "viable",
        label: "a viable forager band",
        done: () => biospherePopulation(KINDS.PERSON) >= 4,
      },
    ];
  if (next === "tribal")
    return [
      { key: "camp", label: "a communal camp", done: () => places().length > 0 },
      {
        key: "tool",
        label: "a functional tool",
        done: () => W.artifacts.some((a) => isFunctionalTool(a)),
      },
      {
        key: "shelter",
        label: "a completed shelter",
        done: () => places().some((p) => completedBuildings(p, "shelter").length > 0),
      },
      {
        key: "stockpile",
        label: "a communal stockpile",
        done: () => places().some((p) => completedBuildings(p, "stockpile").length > 0),
      },
    ];
  if (next === "village")
    return [
      { key: "settlement", label: "a permanent settlement", done: () => settlements().length > 0 },
      {
        key: "first-structure",
        label: "a first completed settlement structure",
        done: () => settlements().some((s) => completedBuildings(s).length >= 1),
      },
      {
        key: "second-structure",
        label: "a second completed structure",
        done: () => settlements().some((s) => completedBuildings(s).length >= 2),
      },
      {
        key: "third-structure",
        label: "a third completed structure",
        done: () => settlements().some((s) => completedBuildings(s).length >= 3),
      },
    ];
  if (next === "civic")
    return [
      {
        key: "faction",
        label: "a founded polity",
        done: () => settlements().some((s) => s.factionId),
      },
      {
        key: "records",
        label: "recorded knowledge (Polymer Inscription or Recorded Governance)",
        done: () =>
          settlements().some(
            (s) => s.knownProcesses.includes("writing") || s.knownProcesses.includes("governance"),
          ),
      },
      {
        key: "hall-started",
        label: "a Civic hall under construction",
        done: () =>
          settlements().some(
            (s) =>
              activeBuildings(s, "hall").length > 0 || completedBuildings(s, "hall").length > 0,
          ),
      },
      {
        key: "hall",
        label: "a completed Civic hall",
        done: () => settlements().some((s) => completedBuildings(s, "hall").length > 0),
      },
    ];
  if (next === "urban")
    return [
      {
        key: "clinic",
        label: "a completed Catalytic clinic",
        done: () => settlements().some((s) => completedBuildings(s, "clinic").length > 0),
      },
      {
        key: "eight",
        label: "an eight-structure settlement",
        done: () => settlements().some((s) => completedBuildings(s).length >= 8),
      },
      {
        key: "metro",
        label: "a metropolitan population",
        done: () =>
          settlements().some(
            (s) =>
              settlementPopulation(s) >= 24 || (!!s.factionId && factionNetworkPopulation(s) >= 32),
          ),
      },
      {
        key: "center",
        label: "a full civic center (hall and clinic together)",
        done: () =>
          settlements().some(
            (s) =>
              completedBuildings(s, "hall").length > 0 &&
              completedBuildings(s, "clinic").length > 0,
          ),
      },
    ];
  if (next === "complex terrestrial")
    return [
      {
        key: "metalworking",
        label: "Ore Reduction metallurgy",
        done: () => settlements().some((s) => s.knownProcesses.includes("metalworking")),
      },
      {
        key: "mechanization",
        label: "Terrestrial Mechanization",
        done: () => settlements().some((s) => s.knownProcesses.includes("mechanization")),
      },
      {
        key: "stewardship",
        label: "Planetary Stewardship",
        done: () => settlements().some((s) => s.knownProcesses.includes("planetary_stewardship")),
      },
      {
        key: "waterworks",
        label: "completed Waterworks",
        done: () => settlements().some((s) => completedBuildings(s, "waterworks").length > 0),
      },
    ];
  return [];
}
function causalSkipEventLabel(event) {
  if (!event) return "the probabilistic horizon";
  const labels = {
    CampFoundedEvent: "a camp founding",
    BuildingCompletedEvent: "a completed structure",
    ToolCraftedEvent: "a functional tool",
    SettlementFoundedEvent: "a permanent settlement",
    FactionFoundedEvent: "a new polity",
    TechAdvanceEvent: "a reproducible technology",
    InstitutionFormedEvent: "an emergent institution",
    ExchangeEvent: "a material exchange",
    MilitaryMusterEvent: "a militia muster",
    WarStartedEvent: "a war beginning",
    WarEndedEvent: "a war ending",
    SettlementCapturedEvent: "a settlement capture",
    FactionSchismEvent: "a political schism",
    AllianceEvent: "an alliance",
    StageAdvanceEvent: "an epoch boundary",
  };
  return labels[event.type] || titleCase(event.type.replace("Event", ""));
}
function makeCausalSkipState(limitOverride = 0) {
  const authority = normalizeCivilizationAuthority(),
    probability =
      1 -
      Math.pow(counterRand("causal-skip-horizon", W.tick, authority.stageIndex, W.nextEventId), 3),
    base = 16384 + authority.stageIndex * 1024,
    span = 4096,
    limit =
      limitOverride > 0
        ? Math.floor(limitOverride)
        : Math.min(24576, Math.round(base + probability * span));
  return {
    startTick: W.tick,
    startStageIndex: authority.stageIndex,
    startBiosphereStage: W.biosphere?.stage || "",
    eventFloor: W.nextEventId,
    probability,
    limit,
    advanced: 0,
    pending: causalSkipMicroStages().filter((stage) => !stage.done()),
    milestone: null,
    stopReason: "",
    done: false,
  };
}
function causalSkipStep(state) {
  if (state.done || state.advanced >= state.limit)
    return ((state.done = true), (state.stopReason = state.stopReason || "horizon"), state);
  simTick();
  state.advanced++;
  const authority = normalizeCivilizationAuthority();
  if (
    authority.stageIndex > state.startStageIndex ||
    (W.biosphere?.stage || "") !== state.startBiosphereStage
  ) {
    state.done = true;
    state.stopReason = "epoch";
    state.milestone =
      W.events.find((e) => e.id >= state.eventFloor && e.type === "StageAdvanceEvent") || null;
    return state;
  }
  if (W.tick % 16 === 0)
    for (const stage of state.pending)
      if (stage.done()) {
        state.done = true;
        state.stopReason = "milestone";
        state.milestone = {
          type: "CausalMicroStage",
          id: 0,
          tick: W.tick,
          label: stage.label,
          key: stage.key,
        };
        return state;
      }
  if (state.advanced >= state.limit) {
    state.done = true;
    state.stopReason = "horizon";
  }
  if (UI.clockInterrupted) {
    state.done = true;
    state.stopReason = "interrupted";
  }
  return state;
}
function causalSkipResult(state) {
  return {
    startTick: state.startTick,
    endTick: W.tick,
    advanced: state.advanced,
    limit: state.limit,
    probability: +state.probability.toFixed(4),
    stopReason: state.stopReason,
    milestone: state.milestone
      ? {
          id: state.milestone.id || 0,
          type: state.milestone.type,
          tick: state.milestone.tick,
          label: state.milestone.label || causalSkipEventLabel(state.milestone),
        }
      : null,
    startStageIndex: state.startStageIndex,
    endStageIndex: normalizeCivilizationAuthority().stageIndex,
    matter: auditMatter(),
  };
}
function runCausalSkipForDebug(limit = 0) {
  if (!W) return null;
  const state = makeCausalSkipState(limit);
  while (!state.done) causalSkipStep(state);
  worldHash();
  refreshUI(true);
  return causalSkipResult(state);
}
async function causalSkipForward() {
  if (!W || UI.causalSkipActive) return;
  togglePause(false);
  UI.clockInterrupted = false;
  UI.causalSkipActive = true;
  const state = makeCausalSkipState();
  DOM.causalSkipBtn.disabled = true;
  DOM.causalSkipBtn.textContent = "⏩ Searching…";
  DOM.causalSkipStatus.textContent = `Causally seeking ${state.pending[0]?.label || "the next epoch boundary"} within ${state.limit.toLocaleString()} future ticks…`;
  try {
    const clickDeadline = performance.now() + 8000;
    while (!state.done) {
      const frameStart = performance.now(),
        tickBudget = UI.quality === "low" ? 12 : 6;
      let frameTicks = 0;
      do {
        causalSkipStep(state);
        frameTicks++;
      } while (
        !state.done &&
        frameTicks < 48 &&
        performance.now() - frameStart < tickBudget &&
        performance.now() < clickDeadline
      );
      refreshTopbar();
      DOM.causalSkipStatus.textContent = `Advanced ${state.advanced.toLocaleString()} real ticks…`;
      if (!state.done && performance.now() >= clickDeadline) {
        state.done = true;
        state.stopReason = "horizon";
      }
      if (!state.done)
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    }
    worldHash();
    refreshUI(true);
    renderWorld(performance.now());
    const result = causalSkipResult(state),
      gate = state.stopReason === "horizon" ? civilizationGateStatus() : null,
      message =
        state.stopReason === "epoch"
          ? `Reached ${epochName()} after ${state.advanced.toLocaleString()} causal ticks.`
          : state.milestone
            ? `Reached ${state.milestone.label || causalSkipEventLabel(state.milestone)} after ${state.advanced.toLocaleString()} causal ticks.`
            : state.stopReason === "interrupted"
              ? `Stopped after ${state.advanced.toLocaleString()} ticks because followed life ended.`
              : gate && gate.missing.length
                ? `Advanced ${state.advanced.toLocaleString()} causal ticks; ${gate.leader ? `${gate.leader} still needs: ` : "next: "}${gate.missing.join(" · ")}.`
                : `Advanced ${state.advanced.toLocaleString()} causal ticks; no milestone occurred inside this horizon.`;
    DOM.causalSkipStatus.textContent = message;
    toast(message);
    return result;
  } finally {
    UI.causalSkipActive = false;
    DOM.causalSkipBtn.disabled = false;
    DOM.causalSkipBtn.textContent = "⏩ Causal skip";
  }
}
function cycleView() {
  setView(UI.view === "top" ? "iso" : UI.view === "iso" ? "oblique" : "top");
}
function pointerPosition(e) {
  const r = DOM.canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function clampCamera() {
  if (!W) return;
  const margin = clamp(16 / UI.camera.zoom, 2, 28);
  UI.camera.x = clamp(UI.camera.x, -margin, W.width + margin);
  UI.camera.y = clamp(UI.camera.y, -margin, W.height + margin);
}
function cameraWorldAtScreen(px, py) {
  const m = projectionMetrics();
  if (UI.view === "top")
    return { x: UI.camera.x + (px - m.w / 2) / m.tw, y: UI.camera.y + (py - m.h / 2) / m.th };
  if (UI.view === "iso") {
    const dx = (px - m.w / 2) / (m.tw / 2),
      dy = (py - m.h / 2) / (m.th / 2);
    return { x: UI.camera.x + (dx + dy) / 2, y: UI.camera.y + (dy - dx) / 2 };
  }
  const q = obliqueBasis(m),
    rx = (px - m.w / 2) / m.tw,
    ry = (py - m.h / 2) / m.th;
  return { x: UI.camera.x + rx * q.c - ry * q.s, y: UI.camera.y + rx * q.s + ry * q.c };
}
function refreshCameraControls() {
  if (!DOM.zoomLabel) return;
  DOM.zoomLabel.textContent = `${Math.round(UI.camera.zoom * 100)}%`;
  if (DOM.cameraModeLabel)
    DOM.cameraModeLabel.textContent = `Orbit ${Math.round((cameraAngle() * 180) / Math.PI)}°`;
  if (DOM.tiltLabel) DOM.tiltLabel.textContent = `${Math.round(cameraTilt() * 100)}%`;
  if (DOM.tiltRange) DOM.tiltRange.value = String(cameraTilt());
  if (DOM.edgeScrollToggle) DOM.edgeScrollToggle.checked = UI.camera.edgeScroll !== false;
  if (DOM.interiorBtn) {
    DOM.interiorBtn.classList.toggle("active", !!UI.camera.cutaway);
    DOM.interiorBtn.textContent = UI.camera.cutaway
      ? "Interiors: cutaway on"
      : "Interiors: roofs on";
  }
}
function updateZoomLabel() {
  refreshCameraControls();
}
function zoomCamera(factor, px, py) {
  if (!W) return;
  const current = CAMERA_GLIDE.zoom ?? UI.camera.zoom,
    target = clamp(current * factor, 0.16, 80);
  CAMERA_GLIDE.zoom = target;
  CAMERA_GLIDE.px = px ?? null;
  CAMERA_GLIDE.py = py ?? null;
  if (Math.abs(target - UI.camera.zoom) > 0.001) DOM.tooltip.style.display = "none";
}
function orbitCamera(angleDelta = 0, tiltDelta = 0) {
  if (!W) return;
  if (UI.view !== "oblique") setView("oblique");
  CAMERA_GLIDE.angle = null;
  UI.camera.angle =
    ((((cameraAngle() + angleDelta + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) -
    Math.PI;
  UI.camera.tilt = clamp(cameraTilt() + tiltDelta, 0.22, 1);
  refreshCameraControls();
  DOM.tooltip.style.display = "none";
}
function toggleCutaway(force) {
  UI.camera.cutaway = force == null ? !UI.camera.cutaway : !!force;
  if (UI.camera.cutaway && UI.view === "top") setView("oblique");
  refreshCameraControls();
  toast(
    UI.camera.cutaway
      ? "Roof cutaways enabled. Zoom in to see rooms and actual occupants."
      : "Exterior roofs restored.",
  );
}
function centerCamera(resetZoom = true) {
  if (!W) return;
  CAMERA_GLIDE.zoom = null;
  CAMERA_GLIDE.px = null;
  CAMERA_GLIDE.py = null;
  CAMERA_GLIDE.angle = null;
  CAMERA_GLIDE.cx = null;
  CAMERA_GLIDE.cy = null;
  const followed = UI.followId && W.components.position[UI.followId],
    selected = UI.selectedEntity && W.components.position[UI.selectedEntity];
  if (followed) {
    UI.camera.x = followed.x + 0.5;
    UI.camera.y = followed.y + 0.5;
  } else if (selected) {
    UI.camera.x = selected.x + 0.5;
    UI.camera.y = selected.y + 0.5;
  } else if (UI.selectedTile >= 0) {
    const [scx, scy] = xy(UI.selectedTile);
    UI.camera.x = scx + 0.5;
    UI.camera.y = scy + 0.5;
  } else {
    UI.camera.x = W.width / 2;
    UI.camera.y = W.height / 2;
  }
  if (resetZoom) {
    UI.camera.zoom = 1;
    UI.camera.angle = -0.35;
    UI.camera.tilt = 0.58;
  }
  UI.cameraMotion = { x: 0, y: 0, orbit: 0, tilt: 0 };
  clampCamera();
  refreshCameraControls();
}
function panCamera(dx, dy) {
  CAMERA_GLIDE.cx = null;
  CAMERA_GLIDE.cy = null;
  const m = projectionMetrics();
  if (UI.view === "top") {
    UI.camera.x -= dx / m.tw;
    UI.camera.y -= dy / m.th;
  } else if (UI.view === "iso") {
    UI.camera.x += -dx / m.tw - dy / m.th;
    UI.camera.y += dx / m.tw - dy / m.th;
  } else {
    const q = obliqueBasis(m),
      rx = -dx / m.tw,
      ry = -dy / m.th;
    UI.camera.x += rx * q.c - ry * q.s;
    UI.camera.y += rx * q.s + ry * q.c;
  }
  clampCamera();
}
function handlePointerDown(e) {
  if (!W) return;
  const p = pointerPosition(e),
    orbitButton = e.button === 1 || e.button === 2;
  if (orbitButton) e.preventDefault();
  UI.pointerInside = true;
  UI.drag = true;
  UI.dragMoved = false;
  UI.dragButton = e.button;
  UI.dragMode = orbitButton && !e.shiftKey ? "orbit" : "pan";
  UI.lastPointer = p;
  DOM.canvas.style.cursor = "grabbing";
  DOM.canvas.setPointerCapture(e.pointerId);
}
function handlePointerMove(e) {
  if (!W) return;
  const p = pointerPosition(e);
  UI.pointerInside = true;
  if (UI.drag && e.buttons) {
    const dx = p.x - UI.lastPointer.x,
      dy = p.y - UI.lastPointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) {
      if (UI.dragMode === "orbit") orbitCamera(dx * 0.0065, -dy * 0.0048);
      else panCamera(dx, dy);
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        UI.dragMoved = true;
        if (UI.dragMode === "pan") UI.followId = 0;
      }
    }
    UI.lastPointer = p;
  } else {
    UI.lastPointer = p;
    UI.hoverTile = pickTile(p.x, p.y);
    updateTooltip(p.x, p.y, UI.hoverTile);
  }
}
function handlePointerUp(e) {
  if (!W) return;
  const p = pointerPosition(e);
  if (UI.dragButton === 0 && !UI.dragMoved) {
    if (UI.tool === "inspect") {
      const hit = pickSceneTarget(p.x, p.y);
      if (hit) {
        if (UI.selectedEntity === hit.id && W.components.life[hit.id] && classifyAlive(hit.id)) {
          UI.followId = UI.followId === hit.id ? 0 : hit.id;
          refreshInspector();
          toast(
            UI.followId
              ? `Following ${entityName(hit.id)} — click again to release.`
              : `Stopped following ${entityName(hit.id)}.`,
          );
        } else {
          selectEntity(hit.id);
          const tp = W.components.position[hit.id];
          if (tp) {
            const tv = VISUAL_MOTION.get(hit.id);
            CAMERA_GLIDE.cx = tv && Number.isFinite(tv.wx) ? tv.wx : tp.x + 0.5;
            CAMERA_GLIDE.cy = tv && Number.isFinite(tv.wy) ? tv.wy : tp.y + 0.5;
          }
        }
      } else {
        const tile = pickTile(p.x, p.y);
        if (tile >= 0) applyTool(tile);
      }
    } else {
      const tile = pickTile(p.x, p.y);
      if (tile >= 0) applyTool(tile);
    }
  }
  UI.drag = false;
  UI.dragMode = "pan";
  DOM.canvas.style.cursor = UI.tool === "inspect" ? "crosshair" : "cell";
  try {
    DOM.canvas.releasePointerCapture(e.pointerId);
  } catch {}
}
function handleWheel(e) {
  if (!W) return;
  e.preventDefault();
  const p = pointerPosition(e);
  if (e.ctrlKey) orbitCameraEased(Math.sign(e.deltaY) * 0.12);
  else if (e.shiftKey) orbitCamera(0, Math.sign(e.deltaY) * 0.055);
  else zoomCamera(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
}
function handleKey(e) {
  if (e.target.matches("input,select,textarea") || DOM.game.classList.contains("hidden")) return;
  const k = e.key.toLowerCase(),
    modalOpen = DOM.modalLayer.classList.contains("open"),
    cameraKeys = [
      "w",
      "a",
      "s",
      "d",
      "q",
      "e",
      "z",
      "x",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ];
  if (modalOpen && k !== "escape") return;
  if ([" ", ...cameraKeys].includes(k)) e.preventDefault();
  if (e.shiftKey && k === "d" && !e.repeat) {
    setOverlay("disease");
    return;
  }
  if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && cameraKeys.includes(k)) {
    UI.keys.add(k);
    return;
  }
  if (e.repeat) return;
  if (k === " ") togglePause();
  else if (k === "." || k === "n") stepTicks(1);
  else if (k === "v") cycleView();
  else if (k === "1") setView("top");
  else if (k === "2") setView("iso");
  else if (k === "3") setView("oblique");
  else if (k === "i") toggleCutaway();
  else if (k === "+" || k === "=") zoomCamera(1.5);
  else if (k === "-" || k === "_") zoomCamera(1 / 1.5);
  else if (k === "0" || k === "home") centerCamera();
  else if (k === "f") setOverlay("fire");
  else if (k === "b") setOverlay("blood");
  else if (k === "t") setOverlay("territory");
  else if (k === "c") setOverlay("culture");
  else if (k === "r" && W) regenerateCurrent();
  else if (k === "escape") {
    if (modalOpen) closeModal();
    else {
      UI.selectedEntity = 0;
      UI.selectedTile = -1;
      UI.followId = 0;
      refreshInspector();
    }
  }
}
function handleKeyUp(e) {
  UI.keys.delete(e.key.toLowerCase());
}
function updateCameraKeys(dt) {
  if (!W) return;
  const motion = UI.cameraMotion || (UI.cameraMotion = { x: 0, y: 0, orbit: 0, tilt: 0 }),
    keyX =
      (UI.keys.has("d") || UI.keys.has("arrowright") ? 1 : 0) -
      (UI.keys.has("a") || UI.keys.has("arrowleft") ? 1 : 0),
    keyY =
      (UI.keys.has("s") || UI.keys.has("arrowdown") ? 1 : 0) -
      (UI.keys.has("w") || UI.keys.has("arrowup") ? 1 : 0),
    rotate = (UI.keys.has("e") ? 1 : 0) - (UI.keys.has("q") ? 1 : 0),
    pitch = (UI.keys.has("x") ? 1 : 0) - (UI.keys.has("z") ? 1 : 0),
    edgeAllowed =
      UI.camera.edgeScroll !== false &&
      UI.pointerInside &&
      !UI.drag &&
      !UI.followId &&
      !DOM.modalLayer.classList.contains("open"),
    zone = 24,
    m = projectionMetrics();
  let edgeX = 0,
    edgeY = 0;
  if (edgeAllowed) {
    if (UI.lastPointer.x < zone) edgeX = -(1 - UI.lastPointer.x / zone);
    else if (UI.lastPointer.x > m.w - zone) edgeX = 1 - (m.w - UI.lastPointer.x) / zone;
    if (UI.lastPointer.y < zone) edgeY = -(1 - UI.lastPointer.y / zone);
    else if (UI.lastPointer.y > m.h - zone) edgeY = 1 - (m.h - UI.lastPointer.y) / zone;
  }
  let horizontal = clamp(keyX + edgeX, -1, 1),
    vertical = clamp(keyY + edgeY, -1, 1);
  const length = Math.hypot(horizontal, vertical);
  if (length > 1) {
    horizontal /= length;
    vertical /= length;
  }
  const response = 1 - Math.exp(-dt / 82),
    targetX = horizontal * 650,
    targetY = vertical * 650;
  motion.x = lerp(motion.x, targetX, response);
  motion.y = lerp(motion.y, targetY, response);
  motion.orbit = lerp(motion.orbit, rotate * 1.45, response);
  motion.tilt = lerp(motion.tilt, pitch * 0.72, response);
  if (Math.abs(motion.x) < 0.05) motion.x = 0;
  if (Math.abs(motion.y) < 0.05) motion.y = 0;
  if (Math.abs(motion.orbit) < 0.0005) motion.orbit = 0;
  if (Math.abs(motion.tilt) < 0.0005) motion.tilt = 0;
  if (keyX || keyY || rotate || pitch) UI.followId = 0;
  if (motion.x || motion.y) panCamera((-motion.x * dt) / 1000, (-motion.y * dt) / 1000);
  if (motion.orbit || motion.tilt)
    orbitCamera((motion.orbit * dt) / 1000, (motion.tilt * dt) / 1000);
}
function updateTooltip(x, y, tile) {
  if (tile < 0) {
    DOM.tooltip.style.display = "none";
    return;
  }
  const [tx, ty] = xy(tile),
    feature = featureNameAt(tile),
    biome = biomeDisplayName(tile),
    building = buildingAtTile(tile),
    inside = (building && ACTIVE_INTERIOR_STATE?.inside.get(building.id)?.length) || 0,
    residents = (building && ACTIVE_INTERIOR_STATE?.homes.get(building.id)?.length) || 0;
  DOM.tooltip.innerHTML = `<b>${esc(building?.name || feature || biome)}</b> <span class="muted mono">${tx},${ty}</span>${building ? `<br><span class="gold">${building.complete ? "Completed" : "Under construction"} · ${esc(building.architecture?.wallForm || "material structure")}</span><br><span class="muted">Condition ${Math.round((building.integrity / Math.max(1, building.maxIntegrity)) * 100)}% · ${residents} residents · ${inside} inside</span><br><span class="cyan">Press I for roof cutaway</span>` : feature ? `<br><span class="gold">${esc(biome)} · ${esc(nicheDescriptionAt(tile))}</span>` : ""}<br><span class="muted">${esc(tileMaterial(tile).name)} · ${Math.round(W.tiles.temperature[tile] / 10)}° · ${Math.round(tileMoisture(tile))}% solvent</span><br><span class="good">Food ${Math.round(tileFood(tile, "omnivore"))}</span> · <span class="red">Danger ${Math.round(W.tiles.danger[tile] / 10)}</span>`;
  DOM.tooltip.style.display = "block";
  DOM.tooltip.style.left = `${clamp(x + 14, 5, DOM.stage.clientWidth - 280)}px`;
  DOM.tooltip.style.top = `${clamp(y + 14, 5, DOM.stage.clientHeight - 115)}px`;
}
