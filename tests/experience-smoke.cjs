const fs = require("node:fs");
const assert = require("node:assert/strict");
const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SAVE_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Shared smoke harness not found");

// Exercise production experience functions against a real deterministic world.
// Only the DOM/canvas are mocked; world generation, tools, events, and saves run.
const fixture = async function () {
  const check = (value, label) => {
    if (!value) throw new Error(label);
  };
  const report = {};
  check(PLAYER_EXPERIENCE.ready, "Product shell did not install at boot");
  $("#firstJourneyBtn").onclick();
  check(DOM.modalLayer.classList.contains("open"), "First expedition button did not open setup");
  $("#cancelExpedition").onclick();
  report.shellMounted = true;
  PLAYER_EXPERIENCE.ready = false;
  W = createWorld(expeditionOptions(false));
  bootstrapWorld();
  const freshHash = worldHash();
  report.founderPeople = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON).length;
  check(report.founderPeople >= 1, "Expedition must start with people");
  const sameOptions = expeditionOptions(false),
    phoneOptions = expeditionOptions(true);
  check(
    sameOptions.size === "small" && phoneOptions.size === "phone",
    "Responsive expedition sizes",
  );
  PLAYER_EXPERIENCE.ready = true;
  UI.view = "oblique";
  UI.camera.edgeScroll = true;
  UI.selectedEntity = 0;
  enterGame();
  check(UI.view === "top" && !UI.camera.edgeScroll, "Expedition did not initialize its first view");
  check(PLAYER_EXPERIENCE.guide.step === 0, "Expedition skipped the first journal step");
  const person = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON);
  const p = W.components.position[person],
    tile = idx(p.x, p.y);
  UI.selectedEntity = person;
  UI.selectedTile = tile;
  pinExperienceEntity(person);
  check(PLAYER_EXPERIENCE.pins.includes(person), "Watchlist did not pin a person");
  selectionSummaryMarkup();
  check(worldHash() === freshHash, "Inspection or pinning changed the simulation");
  report.presentationIsReadOnly = true;
  DOM.modalBox.focus = () => {};
  DOM.modalBox.querySelectorAll = () => [];
  DOM.game.classList.remove("hidden");
  PLAYER_EXPERIENCE.ready = true;
  updatePlayerExperience(1000);
  check(PLAYER_EXPERIENCE.guide.step === 1, "Inspecting a life did not progress the journal");
  UI.followId = 0;
  PLAYER_EXPERIENCE.guide.suspended = true;
  stepTicks(80);
  UI.running = true;
  updatePlayerExperience(1900);
  check(
    PLAYER_EXPERIENCE.guide.step === 1 && UI.running,
    "Dismissed journal interrupted free exploration",
  );
  PLAYER_EXPERIENCE.guide.suspended = false;
  updatePlayerExperience(2000);
  check(PLAYER_EXPERIENCE.guide.step === 2, "Observed time did not progress the journal");
  UI.tool = "rain";
  UI.brush = 1;
  const before = W.tiles.chem[C.SOLVENT][tile];
  applyTool(tile);
  check(PLAYER_EXPERIENCE.guide.step === 3, "Rain did not progress the journal");
  check(PLAYER_EXPERIENCE.impact.before.water === before, "Before reading incorrect");
  check(
    PLAYER_EXPERIENCE.impact.after.water === W.tiles.chem[C.SOLVENT][tile],
    "After reading incorrect",
  );
  check(
    PLAYER_EXPERIENCE.impact.event === W.interventions.at(-1).eventId,
    "Impact lacks real event link",
  );
  check(UI.tool === "inspect", "Guided rain should return to inspection");
  showImpactRecord();
  check(PLAYER_EXPERIENCE.guide.step === 4, "Reading impact did not progress the journal");
  const saved = await saveWorld("slot1", "Expedition test");
  check(saved && PLAYER_EXPERIENCE.guide.step === 5, "Journal completed before a successful save");
  const savedWorld = W;
  PLAYER_EXPERIENCE.ready = false;
  check(await loadWorld("slot1"), "Expedition save failed to load");
  check(W !== savedWorld && W.config.expedition, "Expedition identity not restored");
  resetExperienceWorld();
  check(
    PLAYER_EXPERIENCE.guide.step === 5 && PLAYER_EXPERIENCE.pins.includes(person),
    "Journal or pins did not persist",
  );
  report.journalSteps = 5;
  report.impactRecorded = true;
  report.archiveRestored = true;
  report.matter = auditMatter();
  check(
    report.matter.ok !== false && Math.abs(report.matter.delta) === 0,
    "Intervention or archive violated conservation",
  );
  // Normal sandbox rain remains a continuous tool.
  PLAYER_EXPERIENCE.ready = true;
  UI.tool = "rain";
  applyTool(tile);
  check(UI.tool === "rain", "Completed guide changed sandbox tool behavior");
  PLAYER_EXPERIENCE.ready = false;
  UI.running = false;
  UI.view = "oblique";
  UI.quality = "standard";
  UI.camera.x = W.width / 2;
  UI.camera.y = W.height / 2;
  UI.camera.zoom = 1;
  UI.followId = 0;
  CAMERA_GLIDE.zoom = CAMERA_GLIDE.angle = CAMERA_GLIDE.cx = CAMERA_GLIDE.cy = null;
  PROJECTED_FRAME_CACHE = null;
  const startHash = worldHash(),
    hitBefore = TERRAIN_FRAME_STATS.hits;
  renderWorld(5000);
  renderWorld(5033);
  check(
    TERRAIN_FRAME_STATS.hits === hitBefore + 1,
    "Unchanged projected frame did not use terrain cache",
  );
  check(worldHash() === startHash, "Cached rendering changed world state");
  const misses = TERRAIN_FRAME_STATS.misses;
  UI.camera.angle += 0.1;
  renderWorld(5066);
  check(
    TERRAIN_FRAME_STATS.misses === misses + 1,
    "Camera change failed to invalidate terrain cache",
  );
  UI.overlay = "fertility";
  renderWorld(5099);
  check(
    TERRAIN_FRAME_STATS.misses === misses + 2,
    "Overlay change failed to invalidate terrain cache",
  );
  const afterOverlay = TERRAIN_FRAME_STATS.misses;
  UI.tool = "rain";
  applyTool(tile);
  renderWorld(5132);
  check(
    TERRAIN_FRAME_STATS.misses === afterOverlay + 1,
    "Paused intervention failed to invalidate cache",
  );
  report.cache = {
    reused: true,
    cameraInvalidation: true,
    overlayInvalidation: true,
    interventionInvalidation: true,
  };
  // Unavailable optional storage must not prevent the journal from operating.
  const writer = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error("storage unavailable");
  };
  storeExperiencePreference("probe", true);
  localStorage.setItem = writer;
  report.preferenceFailureIsNonfatal = true;
  return report;
};
const injectedRuntime =
  "window.EXPERIENCE_TEST = { run: " + fixture.toString() + " };\nreturn {boot};";
const harness = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    'const script = composeRuntime({ format: "script" }).replace("return {boot};", ' +
      JSON.stringify(injectedRuntime) +
      ");",
  )
  .replace(
    "vm.createContext(sandbox);",
    `Element.prototype.insertAdjacentHTML = function (position, html) { this.innerHTML += html; };
Element.prototype.focus = function () { document.activeElement = this; };
document.addEventListener = function () {};
getElement("firstJourneyBtn").dataset.experience = "journey";
vm.createContext(sandbox);`,
  );
new Function(
  "require",
  "assert",
  harness +
    `
sandbox.window.EXPERIENCE_TEST.run().then((report) => {
  assert.equal(report.presentationIsReadOnly, true);
  console.log(JSON.stringify({ok: true, report}, null, 2));
}).catch((error) => { console.error(error); process.exitCode = 1; });
`,
)(require, assert);
