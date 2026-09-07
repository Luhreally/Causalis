// Player experience is a view over the simulation. Presentation state lives
// outside W; opening a journal, pinning an identity, and drawing feedback never
// consume deterministic random streams or change authoritative world state.
const PLAYER_EXPERIENCE = {
  ready: false,
  world: null,
  guide: null,
  impact: null,
  pins: [],
  notice: null,
  noticeUntil: 0,
  seenEvent: 0,
  journalKey: "",
  lastUpdate: 0,
  renderMs: 0,
  renderSamples: 0,
  effects: [],
  detailKey: "",
  detailOpen: false,
};
const EXPEDITION_STEPS = [
  [
    "Meet a living world",
    "People and creatures already live here. Find a person and read what they are doing.",
    "Find a person",
  ],
  [
    "Let time move",
    "Follow your person as the world changes. Let 80 ticks pass; you can pause whenever you want.",
    "Follow and play",
  ],
  [
    "Change one thing",
    "Bring rain to a patch of land. Choose Rain, then click or tap the world once.",
    "Choose Rain",
  ],
  [
    "Read the consequence",
    "Your intervention is recorded. Compare the water before and after, then trace its place in history.",
    "Read your impact",
  ],
  [
    "Keep this world",
    "Save your expedition so you can return. After this, the world is yours to explore.",
    "Save expedition",
  ],
];
function experiencePreference(name, fallback) {
  try {
    return JSON.parse(localStorage.getItem("causalis.experience." + name) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function storeExperiencePreference(name, value) {
  try {
    localStorage.setItem("causalis.experience." + name, JSON.stringify(value));
  } catch {
    /* Preferences are optional; unavailable storage never stops play. */
  }
}
function experienceWorldKey() {
  return W
    ? W.seed +
        ":" +
        W.width +
        "x" +
        W.height +
        ":" +
        (W.config.expedition ? "expedition" : W.config.origin || "world")
    : "";
}
function expeditionOptions(mobile = false) {
  return {
    seed: "causal-origin",
    size: mobile ? "phone" : "small",
    origin: "radiation",
    lifeDensity: 1,
    harshness: 0.35,
    variability: 0.5,
    disasterFrequency: 0.65,
    complexity: mobile ? "lean" : "standard",
    tutorial: false,
    expedition: true,
    unfiltered: false,
    chaotic: false,
  };
}
function showFirstExpedition() {
  openModal(
    "Your first expedition",
    '<div class="expedition-chooser"><div class="eyebrow">A living world, ready to explore</div>' +
      "<h3>Follow a life. Change its world.</h3><p>Start with people, grazers, and hunters already present. A short field journal will help you inspect a life, move time, bring rain, and trace what changed.</p>" +
      '<div class="expedition-facts"><span>5 guided steps</span><span>Pause at any time</span><span>Free exploration afterwards</span></div>' +
      '<label class="check"><input id="expeditionAudio" type="checkbox"' +
      (loadSettings().audio ? " checked" : "") +
      "> Enable ambient sound and action cues</label>" +
      (W
        ? '<p class="gold">This starts a new world. Save your current world first if you want to return to it.</p>'
        : "") +
      "</div>",
    '<button id="cancelExpedition">Back</button>' +
      (W ? '<button id="saveBeforeExpedition">Save current world</button>' : "") +
      '<button id="startExpedition" class="primary">Begin expedition</button>',
  );
  $("#cancelExpedition").onclick = closeModal;
  if ($("#saveBeforeExpedition")) $("#saveBeforeExpedition").onclick = () => renderSaveModal();
  $("#startExpedition").onclick = () => {
    const audio = $("#expeditionAudio").checked;
    setAudio(audio, loadSettings().volume);
    const settings = { ...loadSettings(), audio };
    try {
      persistSettings(settings);
    } catch {
      /* Usable without persistent preferences. */
    }
    const opts = expeditionOptions(!!UI.mobileMode);
    storeExperiencePreference(
      "guide:" + opts.seed + ":" + SIZE_PRESETS[opts.size].join("x") + ":expedition",
      null,
    );
    UI.modalResumeOnClose = false;
    closeModal();
    performWorldCreation(opts);
  };
}
function resetExperienceWorld() {
  PLAYER_EXPERIENCE.world = W;
  PROJECTED_FRAME_CACHE = null;
  PROJECTED_TILE_ORDER = null;
  PLAYER_EXPERIENCE.impact = null;
  PLAYER_EXPERIENCE.notice = null;
  PLAYER_EXPERIENCE.effects = [];
  PLAYER_EXPERIENCE.seenEvent = W.nextEventId - 1;
  PLAYER_EXPERIENCE.journalKey = "";
  PLAYER_EXPERIENCE.detailKey = "";
  const savedPins = experiencePreference("pins:" + experienceWorldKey(), []);
  PLAYER_EXPERIENCE.pins = (Array.isArray(savedPins) ? savedPins : [])
    .filter((id) => Number.isSafeInteger(id) && (W.kind[id] || W.historicalIdentities[id]))
    .slice(0, 8);
  const stored = experiencePreference("guide:" + experienceWorldKey(), null);
  PLAYER_EXPERIENCE.guide = W.config.expedition
    ? {
        step: Math.min(5, Math.max(0, Math.floor(Number(stored?.step) || 0))),
        startTick: W.tick,
        minimized: !!stored?.minimized,
        suspended: !!stored?.suspended,
        person: 0,
      }
    : null;
  // A loaded archive may predate the device-local guide record.
  if (PLAYER_EXPERIENCE.guide?.step === 3) PLAYER_EXPERIENCE.guide.step = 2;
}
function persistGuide() {
  if (W && PLAYER_EXPERIENCE.guide)
    storeExperiencePreference("guide:" + experienceWorldKey(), {
      step: PLAYER_EXPERIENCE.guide.step,
      minimized: PLAYER_EXPERIENCE.guide.minimized,
      suspended: PLAYER_EXPERIENCE.guide.suspended,
    });
}
function advanceExpedition(step) {
  const guide = PLAYER_EXPERIENCE.guide;
  if (!guide || guide.suspended || guide.step !== step) return;
  guide.step++;
  guide.startTick = W.tick;
  persistGuide();
  playExperienceCue("discovery");
  refreshFieldJournal();
}
function focusExperienceTile(tile) {
  if (!W || tile < 0 || tile >= W.tileCount) return;
  const [x, y] = xy(tile);
  UI.followId = 0;
  UI.camera.x = x + 0.5;
  UI.camera.y = y + 0.5;
  UI.camera.zoom = Math.max(UI.camera.zoom, 1.7);
  CAMERA_GLIDE.cx = CAMERA_GLIDE.cy = CAMERA_GLIDE.zoom = null;
  selectTile(tile);
  updateZoomLabel();
}
function findExpeditionPerson() {
  const id = W.activeIds.find(
    (id) =>
      W.kind[id] === KINDS.PERSON &&
      W.components.life[id]?.alive !== false &&
      W.components.position[id],
  );
  if (!id) {
    toast("No living people remain. You can seed life or start another expedition.", "warn");
    return;
  }
  const p = W.components.position[id];
  focusExperienceTile(idx(p.x, p.y));
  selectEntity(id);
  UI.followId = id;
  if (PLAYER_EXPERIENCE.guide) PLAYER_EXPERIENCE.guide.person = id;
  advanceExpedition(0);
}
function measureImpact(tile) {
  return {
    water: W.tiles.chem[C.SOLVENT][tile],
    plants: W.tiles.plantOrder[tile],
    heat: W.tiles.temperature[tile],
    fire: W.tiles.fire[tile],
  };
}
function showImpactRecord() {
  const impact = PLAYER_EXPERIENCE.impact;
  if (!impact || !W) {
    toast("Use a world tool to create an intervention record.");
    return;
  }
  const [x, y] = xy(impact.tile);
  const rows = [
    ["Water / solvent", "water"],
    ["Plant cover", "plants"],
    ["Temperature units", "heat"],
    ["Fire intensity", "fire"],
  ];
  openModal(
    "Your intervention",
    '<div class="eyebrow">' +
      esc(impact.label) +
      " · tile " +
      x +
      ", " +
      y +
      "</div>" +
      "<p>These readings were captured immediately before and after your action. Later changes belong to the continuing simulation.</p>" +
      '<table class="impact-table"><thead><tr><th>Reading</th><th>Before</th><th>After</th></tr></thead><tbody>' +
      rows
        .map(
          ([label, key]) =>
            "<tr><th>" +
            label +
            "</th><td>" +
            fmt(impact.before[key]) +
            "</td><td>" +
            fmt(impact.after[key]) +
            "</td></tr>",
        )
        .join("") +
      '</tbody></table><p class="muted">The history record links this action to its causes and consequences.</p>',
    '<button id="impactClose">Return to world</button><button id="impactHistory" class="primary">Trace in history</button>',
  );
  $("#impactClose").onclick = closeModal;
  $("#impactHistory").onclick = () => {
    closeModal();
    UI.selectedEvent = impact.event;
    refreshTabs("chronicle");
  };
  advanceExpedition(3);
}
async function saveExpedition() {
  const guide = PLAYER_EXPERIENCE.guide;
  if (!guide || guide.step !== 4) return;
  const used = new Set(saveList().map((s) => s.slot));
  const slot = ["slot1", "slot2", "slot3"].find((s) => !used.has(s));
  if (!slot) {
    renderSaveModal();
    return;
  }
  const button = $("#journalAction");
  if (button) {
    button.disabled = true;
    button.textContent = "Saving…";
  }
  await saveWorld(slot, "First expedition");
  refreshFieldJournal(true);
}
function journalAction() {
  const guide = PLAYER_EXPERIENCE.guide;
  if (!guide) return;
  if (guide.step === 0) findExpeditionPerson();
  else if (guide.step === 1) {
    if (guide.person && W.components.position[guide.person]) UI.followId = guide.person;
    setSpeed(4);
    togglePause(true);
  } else if (guide.step === 2) {
    togglePause(false);
    UI.followId = 0;
    setTool("rain");
    UI.brush = 1;
    DOM.brushRange.value = 1;
    DOM.brushValue.textContent = "1";
    if (UI.mobileMode) closeMobilePanels();
    guide.minimized = true;
    persistGuide();
    refreshFieldJournal(true);
    toast("Click or tap a patch of land to bring rain.");
  } else if (guide.step === 3) showImpactRecord();
  else if (guide.step === 4) saveExpedition();
  else {
    guide.minimized = true;
    persistGuide();
    refreshFieldJournal(true);
  }
}
function refreshFieldJournal(force = false) {
  const el = $("#fieldJournal"),
    guide = PLAYER_EXPERIENCE.guide;
  if (!el) return;
  el.hidden = !guide;
  if (!guide) return;
  const progress = guide.step === 1 ? Math.min(80, Math.max(0, W.tick - guide.startTick)) : 0;
  const key = [guide.step, guide.minimized, Math.floor(progress / 8)].join(":");
  if (!force && PLAYER_EXPERIENCE.journalKey === key) return;
  PLAYER_EXPERIENCE.journalKey = key;
  const row = EXPEDITION_STEPS[guide.step] || [
    "The next chapter is yours",
    "Your expedition is saved. Pin a person, watch a settlement grow, or change the landscape and follow the consequences.",
    "Keep exploring",
  ];
  el.classList.toggle("journal-mini", guide.minimized);
  el.innerHTML =
    '<div class="journal-top"><span>Field journal · ' +
    (guide.step >= 5 ? "Complete" : guide.step + 1 + " / 5") +
    '</span><button id="journalMinimize" aria-label="' +
    (guide.minimized ? "Expand" : "Minimize") +
    ' field journal">' +
    (guide.minimized ? "Open" : "Hide") +
    "</button></div>" +
    '<div class="journal-body"><div class="journal-progress" aria-hidden="true">' +
    EXPEDITION_STEPS.map(
      (_, i) =>
        '<i class="' + (i < guide.step ? "done" : i === guide.step ? "current" : "") + '"></i>',
    ).join("") +
    "</div><h3>" +
    row[0] +
    "</h3><p>" +
    row[1] +
    (guide.step === 1 ? " " + progress + " / 80 ticks observed." : "") +
    '</p><div class="experience-actions"><button id="journalAction" class="primary">' +
    row[2] +
    "</button>" +
    (guide.step < 5 ? '<button id="journalSkip">Explore freely</button>' : "") +
    "</div></div>";
  $("#journalMinimize").onclick = () => {
    guide.minimized = !guide.minimized;
    if (!guide.minimized) guide.suspended = false;
    persistGuide();
    refreshFieldJournal(true);
  };
  $("#journalAction").onclick = journalAction;
  if ($("#journalSkip"))
    $("#journalSkip").onclick = () => {
      guide.minimized = true;
      guide.suspended = true;
      persistGuide();
      refreshFieldJournal(true);
    };
}
function pinExperienceEntity(id) {
  if (!id || (!W.kind[id] && !W.historicalIdentities[id])) return;
  const pins = PLAYER_EXPERIENCE.pins;
  if (pins.includes(id)) pins.splice(pins.indexOf(id), 1);
  else if (pins.length < 8) pins.push(id);
  else {
    toast("Your watchlist holds eight lives. Remove one to add another.");
    return;
  }
  storeExperiencePreference("pins:" + experienceWorldKey(), pins);
  refreshInspector();
}
function showWatchlist() {
  const pins = PLAYER_EXPERIENCE.pins;
  openModal(
    "Your watchlist",
    '<div class="watch-list">' +
      (pins.length
        ? pins
            .map((id) => {
              const l = W.components.life[id],
                p = W.components.position[id];
              return (
                '<div class="watch-record"><strong>' +
                esc(entityName(id)) +
                "</strong><p>" +
                esc(l ? l.behavior || "Living" : "Remembered in this world's history") +
                '</p><div class="experience-actions">' +
                (p ? '<button data-watch-focus="' + id + '">Find in world</button>' : "") +
                '<button data-watch-record="' +
                id +
                '">Open record</button><button data-watch-remove="' +
                id +
                '">Remove</button></div></div>'
              );
            })
            .join("")
        : "<p>Pin a person or creature from its inspector to keep track of its life here.</p>") +
      "</div>",
    '<button id="closeWatchlist">Return to world</button>',
  );
  $("#closeWatchlist").onclick = closeModal;
  DOM.modalBody.onclick = (e) => {
    const focus = e.target.closest("[data-watch-focus]"),
      record = e.target.closest("[data-watch-record]"),
      remove = e.target.closest("[data-watch-remove]");
    if (focus) {
      const id = Number(focus.dataset.watchFocus),
        p = W.components.position[id];
      closeModal();
      if (p) {
        focusExperienceTile(idx(p.x, p.y));
        selectEntity(id);
        UI.followId = id;
      }
    }
    if (record) {
      closeModal();
      selectEntity(Number(record.dataset.watchRecord));
    }
    if (remove) {
      pinExperienceEntity(Number(remove.dataset.watchRemove));
      showWatchlist();
    }
  };
}
function selectionSummaryMarkup() {
  const id = UI.selectedEntity,
    tile = UI.selectedTile;
  if (id && W.components.life[id]) {
    const life = W.components.life[id];
    return (
      '<div class="selection-summary"><span class="summary-label">A life in this world</span><h3>' +
      esc(entityName(id)) +
      "</h3><p>" +
      esc(titleCase(W.kind[id]) + " · " + (life.behavior || "Observing its surroundings")) +
      '</p><div class="experience-actions"><button id="experienceFollow">' +
      (UI.followId === id ? "Stop following" : "Follow this life") +
      '</button><button id="experiencePin">' +
      (PLAYER_EXPERIENCE.pins.includes(id) ? "Unpin" : "Pin to watchlist") +
      "</button></div></div>"
    );
  }
  if (tile >= 0 && tile < W.tileCount && !id) {
    const fire = W.tiles.fire[tile],
      liquid = W.tiles.liquid[tile];
    const condition =
      fire > 25
        ? "Fire is consuming fuel here. Rain can bring solvent to help suppress it."
        : liquid > WATER_DEPTH.DEEP
          ? "Deep water. Creatures need suitable traits or watercraft to travel safely."
          : tileFertility(tile) < 25
            ? "Growth is limited here. Inspect the soil and moisture before adding life."
            : "This patch supports growth. Watch how moisture, feeding, and nearby life change it.";
    return (
      '<div class="selection-summary"><span class="summary-label">Selected habitat</span><h3>' +
      esc(biomeDisplayName(tile)) +
      "</h3><p>" +
      condition +
      '</p><div class="experience-actions"><button id="experienceMoisture">Show moisture</button>' +
      (PLAYER_EXPERIENCE.impact ? '<button id="experienceImpact">Last intervention</button>' : "") +
      "</div></div>"
    );
  }
  return "";
}
function decorateExperienceInspector() {
  if (!PLAYER_EXPERIENCE.ready || !W) return;
  const pane = DOM.inspectPane,
    summary = selectionSummaryMarkup();
  if (!summary) return;
  const key = UI.selectedEntity + ":" + UI.selectedTile;
  if (key !== PLAYER_EXPERIENCE.detailKey) {
    PLAYER_EXPERIENCE.detailOpen = false;
    PLAYER_EXPERIENCE.detailKey = key;
  }
  const prior = pane.innerHTML;
  pane.innerHTML =
    summary +
    '<details class="instrument-details"' +
    (PLAYER_EXPERIENCE.detailOpen ? " open" : "") +
    "><summary>Full record &amp; measurements</summary><div>" +
    prior +
    "</div></details>";
  pane.querySelector(".instrument-details").ontoggle = (e) => {
    PLAYER_EXPERIENCE.detailOpen = e.target.open;
  };
  if ($("#experienceFollow"))
    $("#experienceFollow").onclick = () => {
      UI.followId = UI.followId === UI.selectedEntity ? 0 : UI.selectedEntity;
      refreshInspector();
    };
  if ($("#experiencePin"))
    $("#experiencePin").onclick = () => pinExperienceEntity(UI.selectedEntity);
  if ($("#experienceMoisture")) $("#experienceMoisture").onclick = () => setOverlay("moisture");
  if ($("#experienceImpact")) $("#experienceImpact").onclick = showImpactRecord;
}
function updateExperienceNotice(now) {
  const node = $("#worldNotice");
  if (!node || !W) return;
  // A bounded scan only reads new records. The journal never invents events.
  let latest = null;
  for (let n = W.events.length - 1; n >= Math.max(0, W.events.length - 80); n--) {
    const ev = W.events[n];
    if (ev.id <= PLAYER_EXPERIENCE.seenEvent) break;
    if (ev.importance >= 3 && !/Chemistry|Intervention|CombatExchange|BirthEvent/.test(ev.type)) {
      latest = ev;
      break;
    }
  }
  PLAYER_EXPERIENCE.seenEvent = W.nextEventId - 1;
  if (latest) {
    PLAYER_EXPERIENCE.notice = latest;
    PLAYER_EXPERIENCE.noticeUntil = now + 12000;
    node.innerHTML =
      '<button id="openWorldNotice"><small>In your world · ' +
      esc(latest.category) +
      "</small>" +
      esc(sceneEventLabel(latest)) +
      "</button>";
    $("#openWorldNotice").onclick = () => {
      if (latest.location >= 0) focusExperienceTile(latest.location);
      UI.selectedEvent = latest.id;
      refreshTabs("chronicle");
    };
    playExperienceCue(
      /War|Fire|Disaster|Famine|Death|Extinction/.test(latest.type) ? "warning" : "discovery",
    );
  }
  node.hidden = !PLAYER_EXPERIENCE.notice || now > PLAYER_EXPERIENCE.noticeUntil;
}
function updatePlayerExperience(now = performance.now()) {
  if (!PLAYER_EXPERIENCE.ready || !W || DOM.game.classList.contains("hidden")) return;
  if (PLAYER_EXPERIENCE.world !== W) resetExperienceWorld();
  const guide = PLAYER_EXPERIENCE.guide;
  if (
    guide?.step === 0 &&
    !guide.suspended &&
    UI.selectedEntity &&
    W.components.life[UI.selectedEntity]
  ) {
    guide.person = UI.selectedEntity;
    advanceExpedition(0);
  }
  if (guide?.step === 1 && !guide.suspended && W.tick - guide.startTick >= 80) {
    togglePause(false);
    advanceExpedition(1);
  }
  refreshFieldJournal();
  if (now - PLAYER_EXPERIENCE.lastUpdate < 700) return;
  PLAYER_EXPERIENCE.lastUpdate = now;
  updateExperienceNotice(now);
  const save = $("#experienceSaveStatus");
  if (save)
    save.textContent = autosaveWriteBlocked
      ? "Autosave unavailable — save manually"
      : W.saveMetadata?.date
        ? "Saved " +
          new Date(W.saveMetadata.date).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Not saved yet";
}
function setCompactInstruments(compact) {
  DOM.game.classList.toggle("compact-controls", compact);
  const button = $("#instrumentMode");
  if (button) {
    button.textContent = compact ? "All controls" : "Simple controls";
    button.setAttribute("aria-pressed", String(!compact));
  }
  storeExperiencePreference("compact", compact);
}
function installPlayerExperience() {
  // The standard smoke harness does not mount the product shell.
  const start = $("#firstJourneyBtn");
  if (start?.dataset.experience !== "journey") return;
  PLAYER_EXPERIENCE.ready = true;
  start.onclick = showFirstExpedition;
  DOM.canvas.setAttribute(
    "aria-label",
    "Living world. Use the world controls to move time, choose a tool, or inspect a life.",
  );
  DOM.pauseBtn.setAttribute("aria-label", "Play or pause simulation");
  DOM.modalClose.setAttribute("aria-label", "Close dialog");
  DOM.leftPanel
    .querySelector(".side-head")
    .insertAdjacentHTML(
      "afterend",
      '<div class="experience-toolbar"><button id="instrumentMode">All controls</button><button id="openFieldJournal">Journal</button><button id="openWatchlist">Watchlist</button></div>',
    );
  for (const anchor of [DOM.tiltRange, DOM.populationCounts])
    anchor.closest(".section")?.classList.add("advanced-instrument");
  DOM.stage.insertAdjacentHTML(
    "beforeend",
    '<div id="worldNotice" class="world-notice" hidden></div><section id="fieldJournal" class="journal-card" aria-label="Expedition field journal" hidden></section>',
  );
  DOM.leftPanel.insertAdjacentHTML(
    "beforeend",
    '<div class="experience-footer"><span id="experienceSaveStatus">Not saved yet</span><button id="experienceSound" aria-label="Toggle sound">Sound off</button></div>',
  );
  $("#instrumentMode").onclick = () =>
    setCompactInstruments(!DOM.game.classList.contains("compact-controls"));
  $("#openWatchlist").onclick = () => W && showWatchlist();
  $("#openFieldJournal").onclick = () => {
    if (PLAYER_EXPERIENCE.guide) {
      PLAYER_EXPERIENCE.guide.minimized = false;
      PLAYER_EXPERIENCE.guide.suspended = false;
      persistGuide();
      refreshFieldJournal(true);
    } else showFirstExpedition();
  };
  $("#experienceSound").onclick = () => {
    const settings = loadSettings(),
      on = !UI.audio;
    setAudio(on, settings.volume);
    try {
      persistSettings({ ...settings, audio: on });
    } catch {
      /* Nonessential. */
    }
    $("#experienceSound").textContent = on ? "Sound on" : "Sound off";
    $("#experienceSound").setAttribute("aria-pressed", String(on));
  };
  setCompactInstruments(experiencePreference("compact", true));
  const reduced = experiencePreference("reducedMotion", false);
  document.body.classList.toggle("reduced-motion", reduced);
  // Resume opted-in audio only after a real gesture, as browsers require.
  document.addEventListener(
    "pointerdown",
    () => {
      if (loadSettings().audio && !UI.audio) {
        setAudio(true, loadSettings().volume);
        $("#experienceSound").textContent = UI.audio ? "Sound on" : "Sound off";
      }
    },
    { once: true },
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      UI.keys.clear();
      UI.cameraMotion = { x: 0, y: 0, orbit: 0, tilt: 0 };
      if (W && UI.running) {
        togglePause(false);
        toast("Paused while you were away.");
      }
      if (audioCtx?.state === "running") audioCtx.suspend().catch(() => {});
    } else if (UI.audio && audioCtx) audioCtx.resume().catch(() => {});
  });
  document.addEventListener("keydown", (e) => {
    if (!DOM.modalLayer.classList.contains("open") || e.key !== "Tab") return;
    const items = Array.from(
      DOM.modalBox.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"], summary',
      ),
    ).filter((el) => el.getClientRects().length);
    if (!items.length) return;
    const first = items[0],
      last = items[items.length - 1];
    if (
      e.shiftKey &&
      (document.activeElement === first || document.activeElement === DOM.modalBox)
    ) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}
// The interface skin: Y2K chrome by default, the classic observatory one setting away.
function applyInterfaceTheme(theme = loadSettings().theme || "y2k") {
  const root = document.documentElement;
  root.classList.toggle("theme-y2k", theme !== "classic");
  root.classList.toggle("lean-fx", UI.quality === "low");
  return theme;
}
const bootExperienceBase = boot;
boot = function () {
  applyInterfaceTheme();
  bootExperienceBase();
  installPlayerExperience();
};
const enterExperienceBase = enterGame;
enterGame = function () {
  const changed = PLAYER_EXPERIENCE.world !== W;
  enterExperienceBase();
  if (changed && W) {
    // Open on the whole world; the tutorial tile stays selected but is not the anchor.
    const keepTile = UI.selectedTile,
      keepEntity = UI.selectedEntity;
    UI.selectedTile = -1;
    UI.selectedEntity = 0;
    UI.followId = 0;
    centerCamera(true);
    UI.selectedTile = keepTile;
    UI.selectedEntity = keepEntity;
  }
  if (!PLAYER_EXPERIENCE.ready) return;
  if (PLAYER_EXPERIENCE.world !== W) resetExperienceWorld();
  if (changed && W.config.expedition && PLAYER_EXPERIENCE.guide.step === 0) {
    setView("top");
    UI.camera.edgeScroll = false;
    DOM.edgeScrollToggle.checked = false;
    const id = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && W.components.position[id]);
    if (id) {
      const p = W.components.position[id];
      focusExperienceTile(idx(p.x, p.y));
    }
  }
  updatePlayerExperience();
};
const refreshInspectorExperienceBase = refreshInspector;
refreshInspector = function () {
  refreshInspectorExperienceBase();
  decorateExperienceInspector();
};
const refreshUIExperienceBase = refreshUI;
refreshUI = function (force = false) {
  refreshUIExperienceBase(force);
  updatePlayerExperience();
};
const applyToolExperienceBase = applyTool;
applyTool = function (tile) {
  if (!PLAYER_EXPERIENCE.ready || !W || UI.tool === "inspect" || tile < 0 || tile >= W.tileCount)
    return applyToolExperienceBase(tile);
  const tool = UI.tool,
    before = measureImpact(tile),
    world = W;
  applyToolExperienceBase(tile);
  if (W !== world) return;
  const ev = W.interventions.at(-1);
  PLAYER_EXPERIENCE.impact = {
    tile,
    tool,
    label: TOOL_DEFS.find((d) => d[0] === tool)?.[1] || tool,
    before,
    after: measureImpact(tile),
    event: ev?.eventId || 0,
  };
  PLAYER_EXPERIENCE.effects.push({ tile, tool, started: performance.now() });
  PLAYER_EXPERIENCE.effects = PLAYER_EXPERIENCE.effects.slice(-8);
  playExperienceCue(
    tool === "rain" || tool === "water"
      ? "rain"
      : tool === "ignite" || tool === "lightning"
        ? "fire"
        : "action",
  );
  if (
    tool === "rain" &&
    PLAYER_EXPERIENCE.guide?.step === 2 &&
    !PLAYER_EXPERIENCE.guide.suspended
  ) {
    PLAYER_EXPERIENCE.guide.minimized = false;
    advanceExpedition(2);
    setTool("inspect");
  }
  refreshInspector();
};
const saveWorldExperienceBase = saveWorld;
saveWorld = async function (slot = "auto", name = "Autosave", quiet = false) {
  const target = W,
    ok = await saveWorldExperienceBase(slot, name, quiet);
  if (ok && W === target && PLAYER_EXPERIENCE.ready) {
    if (!quiet && slot !== "auto") advanceExpedition(4);
    updatePlayerExperience(performance.now() + 701);
  }
  return ok;
};
let experienceModalFocus = null;
const openModalExperienceBase = openModal;
openModal = function (...args) {
  if (PLAYER_EXPERIENCE.ready) {
    experienceModalFocus = document.activeElement;
    DOM.modalBody.onclick = null;
  }
  openModalExperienceBase(...args);
  if (PLAYER_EXPERIENCE.ready) {
    DOM.modalBox.focus({ preventScroll: true });
    DOM.modalBox.scrollTop = 0;
  }
};
const closeModalExperienceBase = closeModal;
closeModal = function () {
  closeModalExperienceBase();
  if (PLAYER_EXPERIENCE.ready && experienceModalFocus?.isConnected)
    experienceModalFocus.focus({ preventScroll: true });
  experienceModalFocus = null;
};
const renderExperienceBase = renderWorld;
renderWorld = function (now) {
  const started = performance.now();
  renderExperienceBase(now);
  if (!PLAYER_EXPERIENCE.ready || !W) return;
  const elapsed = performance.now() - started;
  PLAYER_EXPERIENCE.renderMs = PLAYER_EXPERIENCE.renderSamples
    ? PLAYER_EXPERIENCE.renderMs * 0.9 + elapsed * 0.1
    : elapsed;
  PLAYER_EXPERIENCE.renderSamples++;
  const reduced =
    document.body.classList.contains("reduced-motion") ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    PLAYER_EXPERIENCE.effects = [];
    return;
  }
  PLAYER_EXPERIENCE.effects = PLAYER_EXPERIENCE.effects.filter(
    (effect) => now - effect.started < 850,
  );
  if (!PLAYER_EXPERIENCE.effects.length) return;
  const m = projectionMetrics();
  ctx.save();
  for (const effect of PLAYER_EXPERIENCE.effects) {
    const age = clamp((now - effect.started) / 850, 0, 1),
      [x, y] = xy(effect.tile),
      p = proceduralProjectTile(x + 0.5, y + 0.5, m),
      radius = (1 + age * 3) * Math.max(7, m.tw);
    ctx.globalAlpha = (1 - age) * 0.75;
    ctx.strokeStyle = /rain|water/.test(effect.tool)
      ? "#8ae2ee"
      : /ignite|lightning/.test(effect.tool)
        ? "#ffb773"
        : "#b5e6aa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius, radius * (UI.view === "top" ? 1 : 0.5), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};
const showSettingsExperienceBase = showSettings;
showSettings = function () {
  showSettingsExperienceBase();
  if (!PLAYER_EXPERIENCE.ready) return;
  DOM.modalBody
    .querySelector(".stack")
    ?.insertAdjacentHTML(
      "beforeend",
      '<label class="check"><input id="settingReducedMotion" type="checkbox"' +
        (experiencePreference("reducedMotion", false) ? " checked" : "") +
        "> Reduce interface motion and intervention effects</label>" +
        '<label class="field"><span>Interface skin</span><select id="settingTheme"><option value="y2k"' +
        (loadSettings().theme !== "classic" ? " selected" : "") +
        '>Y2K chrome · glossy aqua and silver</option><option value="classic"' +
        (loadSettings().theme === "classic" ? " selected" : "") +
        ">Classic observatory · dark and quiet</option></select></label>" +
        '<div class="card"><b>Display performance</b><p class="muted">' +
        (PLAYER_EXPERIENCE.renderSamples
          ? "Recent drawing work averages " +
            PLAYER_EXPERIENCE.renderMs.toFixed(1) +
            " ms per rendered frame. This excludes simulation time."
          : "Performance is measured while a world is open.") +
        '</p><p class="muted">For smoother play, choose Top view or Lean detail. Larger worlds and fast-forward need more processing time.</p></div>',
    );
  const save = $("#saveSettings"),
    original = save.onclick;
  save.onclick = () => {
    const reduced = $("#settingReducedMotion").checked,
      theme = $("#settingTheme")?.value || "y2k";
    original();
    persistSettings({ ...loadSettings(), theme });
    applyInterfaceTheme(theme);
    storeExperiencePreference("reducedMotion", reduced);
    document.body.classList.toggle("reduced-motion", reduced);
    $("#experienceSound").textContent = UI.audio ? "Sound on" : "Sound off";
  };
};
