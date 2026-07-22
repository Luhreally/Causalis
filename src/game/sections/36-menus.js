// ═══════════════════════════════════════════════════════════════════════════
// 36. TITLE SCREEN AND MENUS
// ═══════════════════════════════════════════════════════════════════════════
function openModal(title, body, foot = "", wide = false) {
  const autoPause = !!W && UI.running && !DOM.game.classList.contains("hidden");
  UI.modalResumeOnClose = autoPause;
  if (autoPause) {
    UI.running = false;
    accumulator = 0;
    DOM.pauseBtn.textContent = "▶";
    refreshTopbar();
  }
  DOM.modalTitle.textContent = title;
  DOM.modalBody.innerHTML = body;
  DOM.modalFoot.innerHTML = foot;
  DOM.modalBox.classList.toggle("wide", wide);
  DOM.modalLayer.classList.add("open");
}
function closeModal() {
  DOM.modalLayer.classList.remove("open");
  const resume = UI.modalResumeOnClose && !UI.clockInterrupted;
  UI.modalResumeOnClose = false;
  if (resume) togglePause(true);
}
function freshSeed() {
  if (!freshSeed.canonicalOffered) {
    freshSeed.canonicalOffered = true;
    return "causal-origin";
  }
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return `${NAME_B[a[0] % NAME_B.length].toLowerCase()}-${(a[1] >>> 0).toString(36)}`;
}
function showNewWorld() {
  openModal(
    "Compose a new cosmos",
    `<div class="form-grid"><label class="field" style="grid-column:1/-1"><span>Master seed</span><div class="row"><input id="newSeed" type="text" maxlength="48" value="${freshSeed()}"><button id="randomSeedBtn" class="small">Randomize</button></div></label><label class="field"><span>World size</span><select id="newSize"><option value="small">Small · 120 × 72</option><option value="standard" selected>Standard · 180 × 110</option><option value="grand">Grand · 220 × 132</option></select></label><label class="field"><span>Initial life density <b class="range-value" id="lifeDensityV">1.0×</b></span><input id="lifeDensity" type="range" min="0.6" max="1.8" value="1" step="0.1"></label><label class="field"><span>Climate harshness <b class="range-value" id="harshnessV">0.5</b></span><input id="harshness" type="range" min="0" max="1" value="0.5" step="0.1"></label><label class="field"><span>Law variability <b class="range-value" id="variabilityV">0.5</b></span><input id="variability" type="range" min="0" max="1.5" value="0.5" step="0.1"></label><label class="field"><span>Disaster frequency</span><select id="disasterFrequency"><option value="0.65">Quiet</option><option value="1" selected>Natural</option><option value="1.6">Volatile</option></select></label><label class="field"><span>Simulation complexity</span><select id="complexity"><option value="lean">Lean</option><option value="standard" selected>Balanced</option><option value="deep">Deep</option></select></label><label class="check"><input id="chaoticLaws" type="checkbox"> Chaotic laws</label><label class="check"><input id="unfilteredCosmos" type="checkbox"> Unfiltered cosmos (may be hostile)</label><label class="check"><input id="tutorialHints" type="checkbox" checked> Tutorial hints</label></div><div class="card" style="margin-top:14px"><div class="eyebrow">Deep-time bootstrap</div><div class="muted" style="line-height:1.5;margin-top:5px">Before Year 0, deterministic viability probes compile stable matter, solvents, energy gradients, autocatalysis, membranes, and imperfect information copying. Starting organisms are assembled by transferring actual world matter through that causal chain.</div></div>`,
    `<button id="cancelNew">Cancel</button><button id="createWorldBtn" class="primary">Generate World</button>`,
    true,
  );
  const bind = (id, out, suffix = "") => {
    $(`#${id}`).oninput = (e) => ($(`#${out}`).textContent = `${e.target.value}${suffix}`);
  };
  bind("lifeDensity", "lifeDensityV", "×");
  bind("harshness", "harshnessV");
  bind("variability", "variabilityV");
  $("#randomSeedBtn").onclick = () => ($("#newSeed").value = freshSeed());
  $("#cancelNew").onclick = closeModal;
  $("#createWorldBtn").onclick = () => {
    const chaotic = $("#chaoticLaws").checked,
      opts = {
        seed: $("#newSeed").value,
        size: $("#newSize").value,
        lifeDensity: Number($("#lifeDensity").value),
        harshness: Number($("#harshness").value),
        variability: chaotic ? 1.5 : Number($("#variability").value),
        disasterFrequency: Number($("#disasterFrequency").value),
        complexity: $("#complexity").value,
        tutorial: $("#tutorialHints").checked,
        unfiltered: $("#unfilteredCosmos").checked,
        chaotic,
      };
    closeModal();
    performWorldCreation(opts);
  };
}
function performWorldCreation(opts) {
  togglePause(false);
  setLoading(
    8,
    "Generating immutable laws…",
    "Deriving thermal, chemical, ecological, and social constants",
  );
  setTimeout(() => {
    try {
      W = createWorld({ origin: "cellular", ...opts });
      setLoading(
        42,
        "Compiling a fictional chemistry…",
        `${W.definitions.families.length} matter families · ${W.definitions.species.length} compounds · ${W.definitions.reactions.length} balanced reactions`,
      );
      setTimeout(() => {
        setLoading(
          69,
          "Running deterministic deep time…",
          "Testing stable phases, autocatalysis, membranes, and information copying",
        );
        bootstrapWorld();
        setLoading(91, "Awakening the observatory…", "Rebuilding causal indexes and render lenses");
        UI.camera = {
          x: W.width / 2,
          y: W.height / 2,
          zoom: 1,
          angle: -0.35,
          tilt: 0.58,
          cutaway: false,
          edgeScroll: true,
        };
        CAMERA_GLIDE.zoom = null;
        CAMERA_GLIDE.px = null;
        CAMERA_GLIDE.py = null;
        CAMERA_GLIDE.angle = null;
        CAMERA_GLIDE.cx = null;
        CAMERA_GLIDE.cy = null;
        UI.cameraMotion = { x: 0, y: 0, orbit: 0, tilt: 0 };
        UI.view = "top";
        UI.overlay = null;
        UI.tool = "inspect";
        UI.selectedTile = idx(Math.floor(W.width / 2), Math.floor(W.height / 2));
        UI.selectedEntity = 0;
        UI.followId = 0;
        UI.running = false;
        setTimeout(() => {
          hideLoading();
          enterGame();
          if (opts.tutorial)
            toast("Time is paused. Inspect a life, choose 16×, or shape the substrate.");
        }, 60);
      }, 20);
    } catch (err) {
      hideLoading();
      showFatal(err);
    }
  }, 30);
}
function regenerateCurrent() {
  if (!W) return;
  const opts = { ...W.config, seed: W.seed };
  performWorldCreation(opts);
}
function enterGame() {
  DOM.titleScreen.classList.add("hidden");
  DOM.game.classList.remove("hidden");
  closeModal();
  resizeCanvas();
  setView(UI.view || "top");
  setTool(UI.tool || "inspect");
  setSpeed(UI.speed || 1);
  updateZoomLabel();
  const savedOverlay = UI.overlay;
  UI.overlay = null;
  if (savedOverlay) setOverlay(savedOverlay);
  DOM.renderQuality.value = UI.quality;
  DOM.showLabels.checked = UI.labels;
  rebuildDerivedCaches();
  refreshUI(true);
}
function returnToTitle() {
  togglePause(false);
  DOM.game.classList.add("hidden");
  DOM.titleScreen.classList.remove("hidden");
  closeModal();
  refreshContinueButton();
}
function refreshContinueButton() {
  const list = saveList();
  DOM.continueBtn.disabled = !list.length;
  DOM.continueBtn.style.opacity = list.length ? "1" : ".45";
}
function renderSaveModal(update = false) {
  const metas = saveList(),
    by = Object.fromEntries(metas.map((m) => [m.slot, m])),
    slots = ["auto", "slot1", "slot2", "slot3"],
    body = `<div class="save-slots">${slots
      .map((slot, n) => {
        const m = by[slot],
          label = slot === "auto" ? "Autosave" : `Manual slot ${n}`;
        return `<div class="save-slot" data-slotbox="${slot}"><div><input class="slot-name" type="text" value="${esc(m?.name || label)}" ${slot === "auto" ? "readonly" : ""}><div class="slot-meta">${m ? `${new Date(m.date).toLocaleString()} · Year ${m.year} · ${esc(m.seed)} · ${fmt(m.population.person || 0)} people · ${fmt(m.bytes / 1024)} KB` : "Empty slot"}</div></div><div class="row wrap">${W && slot !== "auto" ? `<button class="small primary" data-save-slot="${slot}">Save</button>` : ""}${m ? `<button class="small" data-load-slot="${slot}">Load</button><button class="small danger" data-delete-slot="${slot}">Delete</button>` : ""}</div></div>`;
      })
      .join("")}</div>`;
  if (!update) openModal("World archives", body, `<button id="closeSaves">Close</button>`, true);
  else DOM.modalBody.innerHTML = body;
  $("#closeSaves") && ($("#closeSaves").onclick = closeModal);
  DOM.modalBody.onclick = (e) => {
    const save = e.target.closest("[data-save-slot]"),
      load = e.target.closest("[data-load-slot]"),
      del = e.target.closest("[data-delete-slot]");
    if (save) {
      const slot = save.dataset.saveSlot,
        name = save.closest(".save-slot").querySelector(".slot-name").value || "World";
      saveWorld(slot, name);
      renderSaveModal(true);
    } else if (load) {
      const slot = load.dataset.loadSlot;
      closeModal();
      loadWorld(slot);
    } else if (del) {
      deleteSave(del.dataset.deleteSlot);
    }
  };
}
const renderSaveModalAsyncBase = renderSaveModal;
renderSaveModal = function (update = false) {
  renderSaveModalAsyncBase(update);
  DOM.modalBody.onclick = async (e) => {
    const save = e.target.closest("[data-save-slot]"),
      load = e.target.closest("[data-load-slot]"),
      del = e.target.closest("[data-delete-slot]");
    if (save) {
      const slot = save.dataset.saveSlot,
        name = save.closest(".save-slot").querySelector(".slot-name").value || "World";
      save.disabled = true;
      await saveWorld(slot, name);
      renderSaveModal(true);
    } else if (load) {
      const slot = load.dataset.loadSlot;
      closeModal();
      await loadWorld(slot);
    } else if (del) {
      del.disabled = true;
      await deleteSave(del.dataset.deleteSlot);
    }
  };
};
function showSettings() {
  const s = loadSettings();
  openModal(
    "Settings",
    `<div class="stack"><label class="check"><input id="settingAudio" type="checkbox" ${s.audio ? "checked" : ""}> Generated ambient audio</label><label class="field"><span>Audio volume <b class="range-value" id="volumeV">${Math.round(s.volume * 100)}%</b></span><input id="settingVolume" type="range" min="0" max="0.5" value="${s.volume}" step="0.01"></label><label class="field"><span>Default render detail</span><select id="settingQuality"><option value="low" ${s.quality === "low" ? "selected" : ""}>Lean</option><option value="standard" ${s.quality === "standard" ? "selected" : ""}>Balanced</option><option value="high" ${s.quality === "high" ? "selected" : ""}>Rich</option></select></label><label class="check"><input id="settingLabels" type="checkbox" ${s.labels ? "checked" : ""}> Labels for settlements and notable figures</label></div><div class="card" style="margin-top:14px"><span class="muted">Audio is synthesized locally with Web Audio. It is off by default and never loads a file.</span></div>`,
    `<button id="cancelSettings">Cancel</button><button id="saveSettings" class="primary">Apply</button>`,
  );
  $("#settingVolume").oninput = (e) =>
    ($("#volumeV").textContent = `${Math.round(e.target.value * 100)}%`);
  $("#cancelSettings").onclick = closeModal;
  $("#saveSettings").onclick = () => {
    const next = {
      audio: $("#settingAudio").checked,
      volume: Number($("#settingVolume").value),
      quality: $("#settingQuality").value,
      labels: $("#settingLabels").checked,
    };
    persistSettings(next);
    UI.quality = next.quality;
    UI.labels = next.labels;
    DOM.renderQuality.value = next.quality;
    DOM.showLabels.checked = next.labels;
    setAudio(next.audio, next.volume);
    closeModal();
    toast("Settings applied");
  };
}
function showHelp() {
  openModal(
    "Help & controls",
    `<div class="help-grid"><div class="help-card"><h3>Your role</h3><p>You are an outside cause, not a ruler. Observe a world whose matter, life, society, and history continue without you. Every tool becomes a recorded intervention.</p></div><div class="help-card"><h3>Time</h3><p>Play from ¼× through 128×. At 64× and 128× the renderer yields CPU to deterministic fast-forward; biology still executes the same fixed ticks in the same order.</p></div><div class="help-card"><h3>Views & overlays</h3><p>Top-down, isometric, and fake 3D are lenses over one reality. Field overlays expose heat, chemistry, danger, territory, culture, and population.</p></div><div class="help-card"><h3>God tools</h3><p>Tools add ordinary effects: heat starts reactions, rain transfers solvent, life is assembled from matter, and healing consumes precursors.</p></div><div class="help-card"><h3>Inspection & following</h3><p>Click a tile, then an identity. Inspect its body chemistry, genome functions, phenotype, kin, memory, and reasons. Follow keeps the camera centered.</p></div><div class="help-card"><h3>Causality & saves</h3><p>Click a chronicle entry to walk its cause graph. Saves preserve authoritative state, events, relations, cohorts, definitions, and deterministic streams.</p></div></div><div class="subhead">Keyboard shortcuts</div><div class="shortcut-table"><span class="key">Space</span><span>Play / pause</span><span class="key">S</span><span>Single fixed tick</span><span class="key">V / 1 / 2 / 3</span><span>Cycle or choose render lens</span><span class="key">F B D T C</span><span>Fire, blood, disease, territory, culture overlays</span><span class="key">R</span><span>Regenerate the current seed</span><span class="key">Escape</span><span>Close a menu or clear selection</span><span class="key">Wheel</span><span>Zoom</span><span class="key">Drag</span><span>Pan</span></div>`,
    `<button id="closeHelp" class="primary">Return</button>`,
    true,
  );
  $("#closeHelp").onclick = closeModal;
}
const showHelpCameraBase = showHelp;
showHelp = function () {
  showHelpCameraBase();
  DOM.modalBody.innerHTML = DOM.modalBody.innerHTML
    .replace("Top-down, isometric, and fake 3D", "Top-down, isometric, and free-orbit 3D")
    .replace(
      '<span class="key">S</span><span>Single fixed tick</span>',
      '<span class="key">WASD / arrows</span><span>Smooth camera movement</span><span class="key">Q / E · Z / X</span><span>Orbit · pitch</span><span class="key">N / .</span><span>Single fixed tick</span>',
    )
    .replace(
      '<span class="key">Wheel</span><span>Zoom</span><span class="key">Drag</span><span>Pan</span>',
      '<span class="key">Wheel</span><span>Cursor-centered zoom</span><span class="key">Middle / right drag</span><span>Orbit and pitch</span><span class="key">Shift + drag</span><span>Pan / track</span><span class="key">Screen edge</span><span>Pan when edge scrolling is enabled</span>',
    );
  $("#closeHelp").onclick = closeModal;
};
function showPauseMenu() {
  togglePause(false);
  openModal(
    "World paused",
    `<div class="stack"><button id="resumeWorld" class="primary">Resume history</button><button id="pauseSave">Save world</button><button id="pauseLoad">Load world</button><button id="pauseSettings">Settings</button><button id="pauseRegen">Regenerate current seed</button><button id="pauseHelp">Help & controls</button><button id="pauseTitle" class="danger">Return to title</button></div>`,
  );
  $("#resumeWorld").onclick = () => {
    closeModal();
    togglePause(true);
  };
  $("#pauseSave").onclick = () => renderSaveModal();
  $("#pauseLoad").onclick = () => renderSaveModal();
  $("#pauseSettings").onclick = showSettings;
  $("#pauseRegen").onclick = () => {
    closeModal();
    regenerateCurrent();
  };
  $("#pauseHelp").onclick = showHelp;
  $("#pauseTitle").onclick = returnToTitle;
}
function showFaction(id) {
  const f = W.factions.find((x) => x.id === id);
  if (!f) return;
  const cap = W.settlements.find((s) => s.id === f.capitalSettlementId),
    allies = f.allies.map((x) => W.factions.find((q) => q.id === x)?.name).filter(Boolean),
    enemies = Object.entries(f.relations)
      .filter(([, r]) => r.status === "hostile" || r.status === "at war")
      .map(([x]) => W.factions.find((q) => q.id === Number(x))?.name)
      .filter(Boolean);
  openModal(
    f.name,
    `<div class="row wrap"><span class="tag" style="color:${f.color}"><span class="dot"></span>Faction</span><span class="tag">${f.population} people</span><span class="tag">${f.territorySize} tiles</span></div><div class="subhead">Political state</div><div class="kv"><span>Capital</span><b>${esc(cap?.name || "lost")}</b><span>Settlements</span><b>${
      f.settlementIds
        .map((x) => W.settlements.find((s) => s.id === x)?.name)
        .filter(Boolean)
        .join(", ") || "none"
    }</b><span>Cohesion</span><b>${pct(f.cohesion * 100)}</b><span>Aggression</span><b>${pct(f.aggression * 100)}</b><span>Technology</span><b>${f.technologyLevel} reproducible processes</b><span>Military strength</span><b>${f.militaryStrength.toFixed(1)}</b><span>War pressure</span><b>${f.warPressure.toFixed(1)}</b><span>Stability</span><b>${pct(f.stability * 100)}</b><span>Allies</span><b>${esc(allies.join(", ") || "none")}</b><span>Enemies</span><b>${esc(enemies.join(", ") || "none")}</b><span>Grievances</span><b>${f.grievances}</b></div><div class="subhead">Ethos weights</div><div class="stack">${Object.entries(
      f.ethos,
    )
      .map(
        ([k, v]) =>
          `<div><div class="row between"><span>${titleCase(k)}</span><b>${pct(v * 100)}</b></div><div class="bar"><i style="width:${v * 100}%;background:${f.color}"></i></div></div>`,
      )
      .join("")}</div>`,
    `<button id="closeFaction">Close</button>`,
  );
  $("#closeFaction").onclick = closeModal;
}
function showLifeSummary(id) {
  const ident = W.components.identity[id] || W.historicalIdentities[id],
    l = W.components.life[id] || W.historicalIdentities[id]?.lifeSummary;
  if (!ident || !l) return;
  const resume = UI.followDeathWasRunning
    ? `<button id="resumeAfterLife" class="primary">Resume world</button>`
    : "";
  openModal(
    `${ident.generatedName || ident.name}: a completed life`,
    `<div class="eyebrow">Year ${formatYear()} · ${esc(ident.titles?.at(-1) || titleCase(ident.lifeKind || ident.kind || "organism"))}</div><div class="card good" style="margin-bottom:10px"><b>World auto-paused at the death tick.</b><div class="muted" style="margin-top:4px">Queued fast-forward time was cleared. No later simulation ticks are running behind this summary.</div></div><p style="line-height:1.6">${esc(ident.generatedName || ident.name)} lived ${l.age} ticks, had ${ident.children?.length || 0} children, made ${ident.kills || 0} kills, migrated ${ident.migrations || 0} times, survived ${ident.disastersSurvived || 0} disasters, founded ${ident.settlementsFounded?.length || 0} places, and created ${ident.artifacts?.length || 0} artifacts.</p><div class="card"><b>Cause of death</b><div class="muted" style="margin-top:5px">${esc(l.causeOfDeath)}. Its remaining chemical and structural inventory is now a corpse and will return to soil, water, atmosphere, or another body through decomposition and feeding.</div></div>`,
    `<button id="closeLife">Stay paused</button>${resume}`,
  );
  $("#closeLife").onclick = closeModal;
  if ($("#resumeAfterLife"))
    $("#resumeAfterLife").onclick = () => {
      closeModal();
      togglePause(true);
    };
}
function showFatal(err) {
  openModal(
    "The cosmos could not form",
    `<div class="card red">${esc(err?.message || err)}</div><p class="muted">Try a different seed or a smaller world.</p>`,
    `<button id="fatalTitle">Return to title</button>`,
  );
  $("#fatalTitle").onclick = () => {
    closeModal();
    returnToTitle();
  };
}
