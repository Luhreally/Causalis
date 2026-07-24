// ═══════════════════════════════════════════════════════════════════════════
// 37. MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════
function cacheDom() {
  const ids = [
    "titleScreen",
    "loadingScreen",
    "loadingTitle",
    "loadingDetail",
    "loadProgress",
    "game",
    "world",
    "stage",
    "tooltip",
    "toastStack",
    "topSeed",
    "topTime",
    "topEpoch",
    "topWeather",
    "topHash",
    "topStatus",
    "copySeedBtn",
    "saveBtn",
    "loadBtn",
    "menuBtn",
    "leftPanel",
    "rightPanel",
    "pauseBtn",
    "stepBtn",
    "speedLabel",
    "speedControls",
    "viewControls",
    "viewLabel",
    "toolGrid",
    "toolLabel",
    "brushRange",
    "brushValue",
    "overlayGrid",
    "clearOverlay",
    "populationCounts",
    "entityCapLabel",
    "renderQuality",
    "showLabels",
    "mapLens",
    "mapOverlay",
    "bottomTool",
    "contextText",
    "tab-inspect",
    "tab-chronicle",
    "tab-warfare",
    "tab-worldinfo",
    "tab-stats",
    "statsChart",
    "modalLayer",
    "modalBox",
    "modalTitle",
    "modalBody",
    "modalFoot",
    "modalClose",
    "newWorldBtn",
    "continueBtn",
    "titleLoadBtn",
    "titleSettingsBtn",
    "titleHelpBtn",
  ];
  for (const id of ids)
    DOM[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
  DOM.canvas = DOM.world;
  DOM.inspectPane = document.getElementById("tab-inspect");
  DOM.chroniclePane = document.getElementById("tab-chronicle");
  DOM.warfarePane = document.getElementById("tab-warfare");
  DOM.worldPane = document.getElementById("tab-worldinfo");
  DOM.statsPane = document.getElementById("tab-stats");
  DOM.statsBody = $("#statsBody");
}
const cacheDomCausalSkipBase = cacheDom;
cacheDom = function () {
  cacheDomCausalSkipBase();
  DOM.causalSkipBtn = document.getElementById("causalSkipBtn");
  DOM.causalSkipStatus = document.getElementById("causalSkipStatus");
};
function cacheCameraDom() {
  for (const id of [
    "zoomLabel",
    "zoomOutBtn",
    "zoomInBtn",
    "centerCameraBtn",
    "rotateLeftBtn",
    "rotateRightBtn",
    "cameraModeLabel",
    "tiltLabel",
    "tiltRange",
    "edgeScrollToggle",
    "interiorBtn",
  ])
    DOM[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
}
function buildControls() {
  DOM.toolGrid.innerHTML = TOOL_DEFS.map(
    ([id, name, icon, desc]) =>
      `<button class="tool ${id === "inspect" ? "active" : ""}" data-tool="${id}" title="${esc(desc)}"><span class="tool-icon">${icon}</span><span>${esc(name)}</span></button>`,
  ).join("");
  DOM.overlayGrid.innerHTML = OVERLAY_DEFS.map(
    ([id, name]) =>
      `<button class="overlay-btn" data-overlay="${id}"><span class="dot" style="color:${overlayLegendColor(id)}"></span> ${esc(name)}</button>`,
  ).join("");
}
function overlayLegendColor(id) {
  return {
    elevation: "#ddd",
    temperature: "#df755d",
    fire: "#f19b4a",
    moisture: "#5fa9d6",
    fertility: "#87c96c",
    food: "#a2d46e",
    blood: "#d45454",
    fear: "#e99b52",
    disease: "#b87bd1",
    danger: "#ef745d",
    territory: "#76a8de",
    culture: "#d08ed6",
    population: "#67d5c6",
    resources: "#e3c15d",
    microbial: "#5fe0a0",
    macrolife: "#f0a860",
    construction: "#e7bd63",
    logistics: "#62d7cf",
  }[id];
}
function bindUI() {
  DOM.newWorldBtn.onclick = showNewWorld;
  DOM.continueBtn.onclick = () => {
    const s = saveList()[0];
    if (s) loadWorld(s.slot);
  };
  DOM.titleLoadBtn.onclick = () => renderSaveModal();
  DOM.titleSettingsBtn.onclick = showSettings;
  DOM.titleHelpBtn.onclick = showHelp;
  DOM.modalClose.onclick = closeModal;
  DOM.modalLayer.onclick = (e) => {
    if (e.target === DOM.modalLayer) closeModal();
  };
  DOM.pauseBtn.onclick = () => togglePause();
  DOM.stepBtn.onclick = () => stepTicks(1);
  DOM.speedControls.onclick = (e) => {
    const b = e.target.closest("[data-speed]");
    if (b) setSpeed(Number(b.dataset.speed));
  };
  DOM.viewControls.onclick = (e) => {
    const b = e.target.closest("[data-view]");
    if (b) setView(b.dataset.view);
  };
  DOM.toolGrid.onclick = (e) => {
    const b = e.target.closest("[data-tool]");
    if (b) setTool(b.dataset.tool);
  };
  DOM.overlayGrid.onclick = (e) => {
    const b = e.target.closest("[data-overlay]");
    if (b) setOverlay(b.dataset.overlay);
  };
  DOM.clearOverlay.onclick = () => setOverlay(UI.overlay);
  DOM.brushRange.oninput = (e) => {
    UI.brush = Number(e.target.value);
    DOM.brushValue.textContent = UI.brush;
  };
  DOM.renderQuality.onchange = (e) => (UI.quality = e.target.value);
  DOM.showLabels.onchange = (e) => (UI.labels = e.target.checked);
  DOM.copySeedBtn.onclick = () =>
    navigator.clipboard
      ?.writeText(W.seed)
      .then(() => toast("Seed copied"))
      .catch(() => toast(`Seed: ${W.seed}`));
  DOM.saveBtn.onclick = () => renderSaveModal();
  DOM.loadBtn.onclick = () => renderSaveModal();
  DOM.menuBtn.onclick = showPauseMenu;
  $$(`.tab`).forEach((b) => (b.onclick = () => refreshTabs(b.dataset.tab)));
  $$(`[data-collapse]`).forEach(
    (b) =>
      (b.onclick = () => {
        const side = b.dataset.collapse,
          panel = side === "left" ? DOM.leftPanel : DOM.rightPanel,
          on = panel.classList.toggle("collapsed");
        document.documentElement.style.setProperty(
          side === "left" ? "--left" : "--right",
          on ? "32px" : side === "left" ? "252px" : "326px",
        );
        b.textContent = on ? (side === "left" ? "›" : "‹") : side === "left" ? "‹" : "›";
        resizeCanvas();
      }),
  );
  DOM.rightPanel.addEventListener("click", (e) => {
    const wt = e.target.closest("[data-world-target]"),
      wg = e.target.closest("[data-world-goto]"),
      er = e.target.closest("[data-entity]"),
      ev = e.target.closest("[data-event]"),
      fil = e.target.closest("[data-filter]"),
      fol = e.target.closest("[data-follow]"),
      fac = e.target.closest("[data-faction]"),
      set = e.target.closest("[data-settlement-entity]");
    if (wt) focusHistoryTarget(Number(wt.dataset.worldTarget), Number(wt.dataset.worldTile ?? -1));
    else if (wg) focusHistoryTarget(0, Number(wg.dataset.worldGoto));
    else if (er) selectEntity(Number(er.dataset.entity));
    else if (ev) {
      UI.selectedEvent = Number(ev.dataset.event);
      refreshTabs("chronicle");
    } else if (fil) {
      UI.chronicleFilter = fil.dataset.filter;
      refreshChronicle();
    } else if (fol) {
      const id = Number(fol.dataset.follow);
      UI.followId = UI.followId === id ? 0 : id;
      if (UI.followId) {
        const fp = W.components.position[id],
          ft = VISUAL_MOTION.get(id);
        if (fp) {
          UI.camera.x = ft && Number.isFinite(ft.wx) ? ft.wx : fp.x + 0.5;
          UI.camera.y = ft && Number.isFinite(ft.wy) ? ft.wy : fp.y + 0.5;
          clampCamera();
        }
      }
      refreshInspector();
    } else if (fac) showFaction(Number(fac.dataset.faction));
    else if (set) selectEntity(Number(set.dataset.settlementEntity));
  });
  DOM.canvas.addEventListener("pointerdown", handlePointerDown);
  DOM.canvas.addEventListener("pointermove", handlePointerMove);
  DOM.canvas.addEventListener("pointerup", handlePointerUp);
  DOM.canvas.addEventListener("pointerleave", () => {
    DOM.tooltip.style.display = "none";
    UI.hoverTile = -1;
  });
  DOM.canvas.addEventListener("wheel", handleWheel, { passive: false });
  DOM.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown", handleKey);
  window.addEventListener("resize", resizeCanvas);
}
const bindUISocietyBase = bindUI;
bindUI = function () {
  bindUISocietyBase();
  DOM.rightPanel.addEventListener("input", (e) => {
    const slider = e.target.closest("[data-city-priority]");
    if (!slider) return;
    const card = slider.closest("details"),
      value = card?.querySelector(`[data-priority-value="${slider.dataset.cityPriority}"]`);
    if (value) value.textContent = slider.value;
  });
  DOM.rightPanel.addEventListener("change", (e) => {
    const slider = e.target.closest("[data-city-priority]");
    if (!slider) return;
    if (
      setCityPriority(
        slider.dataset.cityKind,
        Number(slider.dataset.cityId),
        slider.dataset.cityPriority,
        Number(slider.value),
      )
    ) {
      toast(`${titleCase(slider.dataset.cityPriority)} priority set to ${slider.value}`);
      audioClick(300);
    }
    refreshInspector();
  });
  DOM.rightPanel.addEventListener("click", (e) => {
    const policy = e.target.closest("[data-city-policy]"),
      plan = e.target.closest("[data-city-plan]");
    if (policy) {
      if (
        setCityPolicy(
          policy.dataset.cityKind,
          Number(policy.dataset.cityId),
          policy.dataset.cityPolicy,
        )
      ) {
        toast(`${titleCase(policy.dataset.cityPolicy)} policy adopted`);
        audioClick(340);
      }
      refreshInspector();
      return;
    }
    if (plan) {
      const b = requestCityBuilding(
        plan.dataset.cityKind,
        Number(plan.dataset.cityId),
        plan.dataset.cityPlan,
      );
      if (b) {
        toast(`${b.name} blueprint placed`);
        audioClick(270);
      } else toast("That project is already planned, locked, or the work queue is full.", "warn");
      refreshInspector();
    }
  });
};
