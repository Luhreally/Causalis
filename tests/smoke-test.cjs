const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { composeRuntime } = require("../scripts/compose-runtime.cjs");

const script = composeRuntime({ format: "script" });
const drawOps = { count: 0 };

class ClassList {
  constructor() {
    this.values = new Set();
  }
  add(...values) {
    values.forEach((value) => this.values.add(value));
  }
  remove(...values) {
    values.forEach((value) => this.values.delete(value));
  }
  contains(value) {
    return this.values.has(value);
  }
  toggle(value, force) {
    const next = force == null ? !this.values.has(value) : !!force;
    next ? this.values.add(value) : this.values.delete(value);
    return next;
  }
}

const gradient = {
  addColorStop() {
    drawOps.count++;
  },
};
const mockCanvasContext = new Proxy(
  {
    createRadialGradient() {
      drawOps.count++;
      return gradient;
    },
    createLinearGradient() {
      drawOps.count++;
      return gradient;
    },
    measureText(text) {
      return { width: String(text).length * 6 };
    },
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "symbol") return target[prop];
      target[prop] = () => {
        drawOps.count++;
      };
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  },
);
const canvasContext = mockCanvasContext;

class Element {
  constructor(id = "") {
    this.id = id;
    this.classList = new ClassList();
    this.style = { setProperty() {} };
    this.dataset = {};
    this.children = [];
    this.clientWidth = id === "world" ? 960 : 300;
    this.clientHeight = id === "world" ? 720 : 120;
    this.width = this.clientWidth;
    this.height = this.clientHeight;
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.innerHTML = "";
    this.textContent = "";
  }
  getContext() {
    return canvasContext;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }
  addEventListener() {}
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  remove() {}
  setAttribute() {}
  matches() {
    return false;
  }
  querySelector() {
    return new Element();
  }
  querySelectorAll() {
    return [];
  }
  closest() {
    return null;
  }
  after() {}
  select() {}
  setPointerCapture() {}
  releasePointerCapture() {}
}

const elements = new Map();
const getElement = (id) => {
  if (!elements.has(id)) elements.set(id, new Element(id));
  return elements.get(id);
};
const document = {
  body: new Element("body"),
  documentElement: new Element("html"),
  getElementById: getElement,
  querySelector(selector) {
    return selector.startsWith("#") ? getElement(selector.slice(1)) : new Element();
  },
  querySelectorAll() {
    return [];
  },
  createElement(tag) {
    return new Element(tag);
  },
  execCommand() {
    return true;
  },
};
const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};
const windowObject = { addEventListener() {}, AudioContext: null, webkitAudioContext: null };
const sandbox = {
  console,
  document,
  localStorage,
  crypto: webcrypto,
  navigator: {},
  window: windowObject,
  requestAnimationFrame() {
    return 1;
  },
  cancelAnimationFrame() {},
  setTimeout,
  clearTimeout,
  performance,
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 800,
  Blob,
  URL,
  TextEncoder,
  TextDecoder,
  btoa(value) {
    return Buffer.from(value, "binary").toString("base64");
  },
  atob(value) {
    return Buffer.from(value, "base64").toString("binary");
  },
};
Object.assign(windowObject, sandbox);
vm.createContext(sandbox);
vm.runInContext(script, sandbox, { filename: "index.inline.js" });

const game = sandbox.window.ALIFE_DEBUG;
const visuals = sandbox.window.ALIFE_VISUAL_DEBUG;
const controls = sandbox.window.ALIFE_CONTROL_DEBUG;
const cameraDebug = sandbox.window.ALIFE_CAMERA_DEBUG;
const predationDebug = sandbox.window.ALIFE_PREDATION_DEBUG;
if (!game || !visuals || !controls || !cameraDebug || !predationDebug)
  throw new Error("Debug surfaces did not initialize");

if (process.env.SAVE_DEBUG === "1") {
  const saves = sandbox.window.ALIFE_SAVE_DEBUG;
  if (!saves) throw new Error("Save debug surface did not initialize");
  (async () => {
    game.createTestWorld({
      seed: "save-integrity-probe",
      size: "battery",
      lifeDensity: 0.7,
      harshness: 0.5,
      variability: 0.5,
      disasterFrequency: 1,
      complexity: "standard",
    });
    game.step(32);
    const codec = saves.codecProbe();
    const eventRetention = saves.eventRetentionProbe();
    const archive = game.archiveReplay(8);
    const rollback = await saves.loadRollbackProbe();
    const switchedSave = await saves.saveSwitchProbe();
    const failures = [];
    if (!codec.ok) failures.push("typed-array archive validation or round-trip failed");
    if (!eventRetention.ok)
      failures.push(
        "event compression deleted an external reference or failed to retain a bounded tombstone",
      );
    if (!archive.ok) failures.push("current-version archive replay changed hash or continuation");
    if (!rollback.ok)
      failures.push("failed load did not atomically restore the prior world and UI");
    if (!switchedSave.ok)
      failures.push(
        "delayed save used or annotated the world that became active after its snapshot",
      );
    console.log(
      JSON.stringify(
        { ok: !failures.length, failures, codec, eventRetention, archive, rollback, switchedSave },
        null,
        2,
      ),
    );
    if (failures.length) process.exitCode = 1;
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  return;
}

if (process.env.SETTLEMENT_DEBUG === "1") {
  const settlement = sandbox.window.ALIFE_SETTLEMENT_DEBUG;
  if (!settlement) throw new Error("Settlement debug surface did not initialize");
  const seeds = (
    process.env.SETTLEMENT_SEEDS ||
    "vale-11skofv,causal-origin,violet-abyss,glass-orbit,mycelial-moon"
  )
    .split(",")
    .filter(Boolean);
  const foundingTicks = Number(process.env.SETTLEMENT_FOUNDING_TICKS || 1024);
  const buildingTicks = Number(process.env.SETTLEMENT_BUILDING_TICKS || 1024);
  const report = [];
  for (const seed of seeds) {
    game.createTestWorld({
      seed,
      size: "small",
      lifeDensity: 0.9,
      harshness: 0.55,
      variability: 0.75,
      disasterFrequency: 1,
      complexity: "standard",
    });
    game.step(foundingTicks);
    const founded = settlement.summary(),
      civicAtFounding = game.civilization();
    game.step(buildingTicks);
    const built = settlement.summary(),
      civic = game.civilization(),
      audit = game.civicAudit(),
      matter = game.auditMatter();
    report.push({
      seed,
      founded,
      civicAtFounding,
      built,
      civic,
      audit: {
        camps: audit.camps,
        settlements: audit.settlements,
        buildings: audit.buildings,
        metrics: audit.metrics,
        failures: audit.failures,
      },
      matter,
    });
  }
  const failures = [];
  for (const world of report) {
    if (
      world.founded.camps + world.founded.settlements < 1 ||
      world.civicAtFounding.buildings.planned + world.civicAtFounding.buildings.complete < 2
    )
      failures.push(`${world.seed}: no causal camp and blueprints by the founding deadline`);
    if (world.civic.metrics.delivered < 1 || world.civic.metrics.constructionWork < 1)
      failures.push(`${world.seed}: camp never converted gathering into delivery and construction`);
    if (world.audit.failures.length || world.matter.relative > 1e-8)
      failures.push(`${world.seed}: settlement emergence violated civic or matter invariants`);
  }
  console.log(JSON.stringify({ ok: !failures.length, failures, report }, null, 2));
  if (failures.length) process.exitCode = 1;
  return;
}

if (process.env.SENTIENCE_DEBUG === "1") {
  const sentience = sandbox.window.ALIFE_SENTIENCE_DEBUG;
  if (!sentience) throw new Error("Sentience debug surface did not initialize");
  const seeds = (
    process.env.SENTIENCE_SEEDS ||
    "causal-origin,quartz-13vxtpp,violet-abyss,glass-orbit,mycelial-moon"
  )
    .split(",")
    .filter(Boolean);
  const ticks = Number(process.env.SENTIENCE_TICKS || 512);
  const report = [];
  for (const seed of seeds) {
    game.createTestWorld({
      seed,
      size: "small",
      lifeDensity: 0.7,
      harshness: 0.65,
      variability: 0.8,
      disasterFrequency: 1,
      complexity: "standard",
    });
    const initial = sentience.summary();
    const firstCollapse = sentience.collapse();
    game.step(Math.floor(ticks / 2));
    const secondCollapse = sentience.collapse();
    game.step(Math.ceil(ticks / 2));
    const final = sentience.summary(),
      matter = game.auditMatter(),
      archiveDiff = seed === seeds[0] ? sentience.archiveDiff() : null,
      archive = seed === seeds[0] ? game.archiveReplay(16) : null,
      legacyRecovery = seed === seeds[0] ? sentience.legacyRecovery() : null;
    report.push({
      seed,
      initial,
      firstCollapse,
      secondCollapse,
      final,
      population: game.summary().population,
      birthsByKind: game.summary().birthsByKind,
      matter,
      archiveDiff,
      archive,
      legacyRecovery,
    });
  }
  const failures = [];
  for (const world of report) {
    if (
      !world.initial.viable ||
      !world.firstCollapse.after.viable ||
      !world.secondCollapse.after.viable ||
      !world.final.viable
    )
      failures.push(`${world.seed}: sentient lineage became nonviable`);
    if (world.firstCollapse.collapsed !== 0 || world.secondCollapse.collapsed !== 0)
      failures.push(`${world.seed}: collapse fixture did not reach zero before same-tick recovery`);
    if (
      world.firstCollapse.after.population < 8 ||
      world.secondCollapse.after.population < 8 ||
      world.final.population < 8
    )
      failures.push(`${world.seed}: recovery fell below the viable floor`);
    if (world.firstCollapse.after.lineages < 4 || world.secondCollapse.after.lineages < 4)
      failures.push(`${world.seed}: recovery lacked genetic diversity`);
    if (
      world.firstCollapse.matterDelta !== 0 ||
      world.secondCollapse.matterDelta !== 0 ||
      world.matter.relative > 1e-8
    )
      failures.push(`${world.seed}: recovery violated matter conservation`);
    if (world.archive && !world.archive.ok)
      failures.push(`${world.seed}: sentience continuity changed across archive replay`);
    if (
      world.legacyRecovery &&
      (world.legacyRecovery.legacyPopulation !== 1 ||
        !world.legacyRecovery.after.viable ||
        world.legacyRecovery.after.population < 8 ||
        world.legacyRecovery.matterDelta !== 0)
    )
      failures.push(
        `${world.seed}: legacy one-person save did not migrate into a viable conserved population`,
      );
  }
  console.log(JSON.stringify({ ok: !failures.length, failures, report }, null, 2));
  if (failures.length) process.exitCode = 1;
  return;
}

if (process.env.CLOCK_DEBUG === "1") {
  game.createTestWorld({
    seed: "clock-equivalence",
    size: "small",
    lifeDensity: 0.7,
    harshness: 0.5,
    variability: 0.5,
  });
  const manual = [];
  for (let n = 0; n < 64; n++) {
    game.step(1);
    manual.push(game.hashNow());
  }
  game.createTestWorld({
    seed: "clock-equivalence",
    size: "small",
    lifeDensity: 0.7,
    harshness: 0.5,
    variability: 0.5,
  });
  controls.resetClock();
  controls.setSpeed(64);
  controls.setRunning(true);
  const scheduled = [];
  for (let n = 0; n < 64; n++) {
    controls.advanceClock(100 / 64);
    scheduled.push(game.hashNow());
  }
  controls.setRunning(false);
  const firstMismatch = manual.findIndex((hash, n) => hash !== scheduled[n]);
  console.log(
    JSON.stringify(
      {
        ok: firstMismatch < 0,
        firstMismatch,
        manual: firstMismatch < 0 ? manual.at(-1) : manual[firstMismatch],
        scheduled: firstMismatch < 0 ? scheduled.at(-1) : scheduled[firstMismatch],
      },
      null,
      2,
    ),
  );
  if (firstMismatch >= 0) process.exitCode = 1;
  return;
}

if (process.env.STAGE_UI_DEBUG === "1") {
  const stageDebug = sandbox.window.ALIFE_STAGE_DEBUG;
  if (!stageDebug) throw new Error("Stage-consistency debug surface did not initialize");
  game.createTestWorld({
    seed: "stage-ui-consistency",
    size: "small",
    lifeDensity: 0.9,
    harshness: 0.5,
    variability: 0.7,
  });
  const checkpoints = [];
  for (const ticks of [1, 127, 256, 512]) {
    game.step(ticks);
    checkpoints.push(stageDebug.audit());
  }
  const failures = checkpoints.flatMap((checkpoint) =>
    checkpoint.failures.map((failure) => `tick ${checkpoint.tick}: ${failure}`),
  );
  console.log(JSON.stringify({ ok: !failures.length, failures, checkpoints }, null, 2));
  if (failures.length) process.exitCode = 1;
  return;
}

if (process.env.CAUSAL_SKIP_DEBUG === "1") {
  const skip = sandbox.window.ALIFE_CAUSAL_SKIP_DEBUG;
  if (!skip) throw new Error("Causal-skip debug surface did not initialize");
  const options = {
    seed: "causal-skip-equivalence",
    size: "small",
    lifeDensity: 0.9,
    harshness: 0.5,
    variability: 0.7,
  };
  game.createTestWorld(options);
  const firstPlan = skip.plan(),
    before = game.summary(),
    result = skip.run(),
    skippedHash = game.hashNow(),
    after = game.summary();
  game.createTestWorld(options);
  const secondPlan = skip.plan();
  game.step(result.advanced);
  const manualHash = game.hashNow(),
    failures = [];
  if (result.endTick <= result.startTick || result.advanced < 1)
    failures.push("skip did not move strictly forward");
  if (result.advanced > result.limit)
    failures.push("skip exceeded its seeded probabilistic horizon");
  if (result.endStageIndex - result.startStageIndex > 1)
    failures.push("skip crossed more than one epoch boundary");
  if (result.matter.relative > 1e-8) failures.push("skip violated matter conservation");
  if (firstPlan.limit !== secondPlan.limit || firstPlan.probability !== secondPlan.probability)
    failures.push("probabilistic horizon was not seed-deterministic");
  if (skippedHash !== manualHash)
    failures.push("skip diverged from ordinary fixed-tick simulation");
  console.log(
    JSON.stringify(
      {
        ok: !failures.length,
        failures,
        firstPlan: { limit: firstPlan.limit, probability: firstPlan.probability },
        secondPlan: { limit: secondPlan.limit, probability: secondPlan.probability },
        before: { tick: before.tick, stage: before.civilization?.stage },
        result,
        after: { tick: after.tick, stage: after.civilization?.stage },
        skippedHash,
        manualHash,
      },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
  return;
}

if (process.env.PROGRESSION_DEBUG === "1") {
  const seeds = (process.env.PROGRESSION_SEEDS || "vale-11skofv,causal-origin,glass-orbit")
    .split(",")
    .filter(Boolean);
  const ticks = Number(process.env.PROGRESSION_TICKS || 16384);
  const chunk = Number(process.env.PROGRESSION_CHUNK || 2048);
  const report = [];
  for (const seed of seeds) {
    game.createTestWorld({
      seed,
      size: "small",
      lifeDensity: 0.9,
      harshness: 0.55,
      variability: 0.75,
      disasterFrequency: 1,
      complexity: "standard",
    });
    const timeline = [];
    for (let elapsed = 0; elapsed < ticks; elapsed += chunk) {
      const amount = Math.min(chunk, ticks - elapsed),
        started = performance.now();
      game.step(amount);
      const audit = game.progressAudit(),
        durationMs = +(performance.now() - started).toFixed(1);
      timeline.push({
        tick: audit.tick,
        stage: audit.stage,
        durationMs,
        settlements: audit.settlements.map((s) => ({
          name: s.name,
          stage: s.stage,
          localPopulation: s.localPopulation,
          networkPopulation: s.networkPopulation,
          known: s.known.length,
          complete: s.complete.length,
          active: s.active,
          blockers: s.stageBlockers,
        })),
      });
      if (audit.stage === "complex terrestrial") break;
    }
    report.push({ seed, timeline, audit: game.progressAudit() });
  }
  const failures = [];
  for (const world of report) {
    if (world.audit.definitions.length)
      failures.push(
        `${world.seed}: disconnected definitions: ${world.audit.definitions.join(", ")}`,
      );
    if (!world.audit.settlements.length) failures.push(`${world.seed}: no persistent settlement`);
    if (world.audit.stage === "multicellular" || world.audit.stage === "sapient foraging")
      failures.push(`${world.seed}: civic progression never connected`);
    if (world.audit.matter.relative > 1e-8)
      failures.push(`${world.seed}: matter conservation drifted`);
  }
  const output =
    process.env.PROGRESSION_CONCISE === "1"
      ? report.map((world) => ({
          seed: world.seed,
          timeline: world.timeline,
          final: {
            tick: world.audit.tick,
            stage: world.audit.stage,
            next: world.audit.next,
            definitions: world.audit.definitions,
            settlements: world.audit.settlements.map((s) => ({
              name: s.name,
              stage: s.stage,
              localPopulation: s.localPopulation,
              networkPopulation: s.networkPopulation,
              isCapital: s.isCapital,
              stability: s.stability,
              known: s.known,
              complete: s.complete,
              active: s.active,
              blockers: s.stageBlockers,
            })),
            matter: world.audit.matter,
          },
        }))
      : report;
  console.log(JSON.stringify({ ok: !failures.length, failures, report: output }, null, 2));
  if (failures.length) process.exitCode = 1;
  return;
}

if (process.env.SYSTEMS_DEBUG === "1") {
  const social = sandbox.window.ALIFE_SOCIAL_DEBUG,
    embodied = sandbox.window.ALIFE_EMBODIED_DEBUG,
    agriculture = sandbox.window.ALIFE_AGRICULTURE_DEBUG;
  if (!social || !embodied || !agriculture)
    throw new Error("Social, embodied, or agriculture-system debug surface did not initialize");
  game.createTestWorld({
    seed: "embodied-social-systems-probe",
    size: "phone",
    lifeDensity: 0.9,
    harshness: 0.5,
    variability: 0.65,
    disasterFrequency: 1,
    complexity: "lean",
  });
  const fixture = controls.createCivicTestScenario(),
    socialProbe = social.probe(),
    embodiedProbe = embodied.probe(),
    agricultureProbe = agriculture.probe();
  game.step(8);
  const drawOpsBefore = drawOps.count;
  visuals.renderOnly({ view: "oblique", quality: "high", zoom: 9, now: 1800 });
  const embodiedDrawOps = drawOps.count - drawOpsBefore;
  const socialAudit = social.audit(),
    embodiedAudit = embodied.audit(),
    agricultureAudit = agriculture.audit(),
    failures = [...socialAudit.failures, ...embodiedAudit.failures, ...agricultureAudit.failures];
  if (!fixture)
    failures.push("civic fixture could not gather enough people for causal system probes");
  if (!socialProbe.ok)
    failures.push(
      `social drama probe failed: ${socialProbe.reason || "missing causal emotional state"}`,
    );
  for (const type of [
    "LoveBondEvent",
    "BetrayalEvent",
    "CheatingDiscoveredEvent",
    "GriefEvent",
    "RevengeVowEvent",
  ])
    if (!socialProbe.eventTypes?.includes(type)) failures.push(`social drama omitted ${type}`);
  if (!socialProbe.concealedBeforeDiscovery || !socialProbe.relationshipEnded)
    failures.push(
      "betrayal was not concealed before observation or did not alter the prior relationship",
    );
  if (!socialProbe.betrayedBy?.includes(socialProbe.people?.betrayer))
    failures.push("betrayal knowledge was assigned to the wrong person");
  if (
    socialProbe.criticalPriority?.key !== "critical" ||
    socialProbe.criticalPriority.glyphs?.[0] !== socialProbe.criticalPriority.emoji
  )
    failures.push("critical bodily distress did not override a contentment emoji");
  if (!socialProbe.attachmentCondition || /concealed bond/i.test(socialProbe.attachmentCondition))
    failures.push("attachment state remained a one-off concealed-bond counter");
  if (!embodiedProbe.ok)
    failures.push(`embodied systems probe failed: ${embodiedProbe.reason || "incomplete result"}`);
  if (!embodiedProbe.fire?.eventId || embodiedProbe.fire.after >= embodiedProbe.fire.before)
    failures.push("a bucket did not physically transfer solvent and suppress fire");
  if (!embodiedProbe.navigation?.exactArrival || embodiedProbe.navigation.depth <= 820)
    failures.push("watercraft did not complete a long move onto deep water");
  if (
    !embodiedProbe.anatomy?.severed ||
    embodiedProbe.anatomy.manipulationAfter >= embodiedProbe.anatomy.manipulationBefore
  )
    failures.push("dismemberment did not persist or reduce embodied capability");
  if (!embodiedAudit.severedVisuals || embodiedDrawOps < 1)
    failures.push("persistent limb-loss state did not survive a high-detail oblique render");
  if (!embodiedAudit.fluidSplatters)
    failures.push("injury did not create persistent causal fluid-splatter records");
  if (!agricultureProbe.ok)
    failures.push(
      `agriculture and herding probe failed: ${agricultureProbe.reason || "incomplete result"}`,
    );
  for (const type of [
    "CropSownEvent",
    "CropHarvestedEvent",
    "HerdFormedEvent",
    "PredatorDefenseEvent",
  ])
    if (!agricultureProbe.eventTypes?.includes(type))
      failures.push(`agriculture and herding mechanics omitted ${type}`);
  if (agricultureProbe.herd?.actualAnimalIds?.length < 2)
    failures.push("herding did not retain individually simulated prey organisms");
  if (!agricultureProbe.predatorDefense?.result)
    failures.push("people did not physically fight a predator threatening protected prey");
  if (!agricultureProbe.fluidSplatters)
    failures.push("predator defense did not leave persistent blood/fluid traces");
  if (Math.abs(embodiedProbe.matterDelta || 0) > 1e-8 || embodiedAudit.matter.relative > 1e-8)
    failures.push("equipment, firefighting, or dismemberment violated matter conservation");
  if (Math.abs(agricultureProbe.matterDelta || 0) > 1e-8 || agricultureAudit.matter.relative > 1e-8)
    failures.push("farming, herding, or predator defense violated matter conservation");
  console.log(
    JSON.stringify(
      {
        ok: !failures.length,
        failures,
        fixture,
        social: { probe: socialProbe, audit: socialAudit },
        embodied: { probe: embodiedProbe, audit: embodiedAudit, drawOps: embodiedDrawOps },
        agriculture: { probe: agricultureProbe, audit: agricultureAudit },
      },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
  return;
}

if (process.env.CONFLICT_DEBUG === "1") {
  const conflict = sandbox.window.ALIFE_CONFLICT_DEBUG;
  if (!conflict) throw new Error("Conflict-drama debug surface did not initialize");
  game.createTestWorld({
    seed: "causal-conflict-probe",
    size: "phone",
    lifeDensity: 0.9,
    harshness: 0.5,
    variability: 0.65,
    disasterFrequency: 1,
    complexity: "lean",
  });
  const probe = conflict.probe();
  game.step(16);
  const audit = conflict.audit(),
    failures = [...audit.failures];
  if (!probe.ok) failures.push(`combat probe failed: ${probe.reason || "no injury"}`);
  if (!probe.wounds.length) failures.push("a landed person-level exchange did not persist a wound");
  if (!probe.injuryEvent?.bodyPart || !probe.injuryEvent?.wound)
    failures.push("injury event omitted tactical wound detail");
  if (!probe.combatEvent?.tactic || !probe.combatEvent?.defense)
    failures.push("combat exchange omitted attack/defense tactics");
  if (!probe.preservedOnCapture)
    failures.push("occupation doctrine damaged intact test buildings without a physical strike");
  if (probe.siege.damage <= 0 || probe.siege.eventType !== "BuildingDamagedEvent")
    failures.push("siege damage did not cite a physical building-damage event");
  if (probe.internalEvent !== "InternalConflictEvent")
    failures.push(
      "material and social tension did not produce an implicit internal-conflict event",
    );
  if (probe.capture.owner !== probe.capture.expectedOwner)
    failures.push("physical occupation did not transfer settlement ownership");
  if (probe.capture.eventData.preserved !== 1 || probe.capture.eventData.damaged !== 1)
    failures.push("capture event did not distinguish intact and previously damaged structures");
  if (!probe.capture.occupation.active)
    failures.push("capture did not establish a persistent occupation state");
  if (probe.doctrine.destroyed !== 0 || probe.doctrine.razed !== 0)
    failures.push("capture doctrine directly destroyed a building");
  if (Math.abs(probe.matterDelta) > 1e-8)
    failures.push(`combat blood transfer drifted matter by ${probe.matterDelta}`);
  if (audit.matter.relative > 1e-8) failures.push("conflict systems violated matter conservation");
  console.log(JSON.stringify({ ok: !failures.length, failures, probe, audit }, null, 2));
  if (failures.length) process.exitCode = 1;
  return;
}

if (process.env.IMPLICIT_DEBUG === "1") {
  const implicit = sandbox.window.ALIFE_IMPLICIT_DEBUG;
  if (!implicit) throw new Error("Implicit-society debug surface did not initialize");
  const seed = process.env.IMPLICIT_SEED || "vale-11skofv";
  const naturalTicks = Number(process.env.IMPLICIT_NATURAL_TICKS || 6144);
  const conflictTicks = Number(process.env.IMPLICIT_CONFLICT_TICKS || 2048);
  game.createTestWorld({
    seed,
    size: "small",
    lifeDensity: 0.9,
    harshness: 0.55,
    variability: 0.75,
    disasterFrequency: 1,
    complexity: "standard",
  });
  game.step(naturalTicks);
  const natural = implicit.audit(),
    fixture = implicit.fixture();
  game.step(conflictTicks);
  const after = implicit.audit(),
    civic = game.civilization();
  const failures = [...natural.failures, ...after.failures];
  if (!fixture.ok) failures.push(`conflict fixture failed: ${fixture.reason}`);
  if (fixture.matter?.relative > 1e-8) failures.push("conflict setup violated matter conservation");
  if (after.factions.length < 2) failures.push("independent political actors did not persist");
  if (!after.militaryUnits.length)
    failures.push("threat did not recruit a supplied physical militia");
  if (!after.wars.length) failures.push("material rivalry did not produce a war record");
  if (after.metrics.matterMoved < 1)
    failures.push("no conserved matter moved through the implicit economy");
  if (after.matter.relative > 1e-8)
    failures.push("implicit institutions violated matter conservation");
  console.log(
    JSON.stringify(
      {
        ok: !failures.length,
        failures,
        seed,
        natural: {
          tick: naturalTicks,
          factions: natural.factions,
          routes: natural.routes,
          institutions: natural.institutions,
          roles: natural.roles,
          metrics: natural.metrics,
        },
        fixture,
        after: {
          tick: naturalTicks + conflictTicks,
          factions: after.factions,
          routes: after.routes,
          institutions: after.institutions,
          units: after.militaryUnits,
          wars: after.wars,
          roles: after.roles,
          metrics: after.metrics,
          matter: after.matter,
        },
        civic,
      },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
  return;
}

if (process.env.ECO_DEBUG === "1") {
  const ecoSeeds = (process.env.ECO_SEEDS || "oak-zn4nh1").split(",").filter(Boolean);
  const ticks = Number(process.env.ECO_TICKS || 8192);
  const density = Number(process.env.ECO_DENSITY || 1);
  const report = ecoSeeds.map((seed) => {
    game.createTestWorld({
      seed,
      size: "small",
      lifeDensity: density,
      harshness: 0.5,
      variability: 0.5,
      disasterFrequency: 1,
      complexity: "standard",
    });
    game.step(ticks);
    const summary = game.summary(),
      baseline = game.baseline(),
      people = game.populationMechanics();
    return {
      seed,
      ticks,
      population: summary.population,
      birthsByKind: summary.birthsByKind,
      deaths: summary.deathCauses,
      food: baseline.ecology.food,
      cognition: game.cognitionAudit(),
      people: {
        mature: people.mature,
        reproductionReady: people.reproductionReady,
        meanEnergy: people.mean.energy,
        starving: people.starving,
      },
      civilization: game.civilization(),
      matter: game.auditMatter(),
    };
  });
  const output =
    process.env.ECO_CONCISE === "1"
      ? report.map(({ seed, ticks, population, birthsByKind, deaths, food, people, matter }) => ({
          seed,
          ticks,
          population,
          birthsByKind,
          deaths,
          food,
          people,
          matter,
        }))
      : report;
  console.log(JSON.stringify(output, null, 2));
  return;
}

if (process.env.CIVIC_DEBUG === "1") {
  if (process.env.CIVIC_STALE === "1") {
    game.createTestWorld({
      seed: "followed-death-64x",
      size: "small",
      lifeDensity: 0.7,
      harshness: 0.5,
      variability: 0.5,
    });
    controls.armFollowedDeathForTest("herbivore");
    controls.setSpeed(128);
    controls.resetClock();
    controls.setRunning(true);
    controls.advanceClock(1000);
  }
  game.createTestWorld({
    seed: "civic-probe",
    size: "small",
    lifeDensity: 0.7,
    harshness: 0.5,
    variability: 0.5,
  });
  const fixture = controls.createCivicTestScenario();
  game.step(Number(process.env.CIVIC_TICKS || 512));
  console.log(
    JSON.stringify(
      {
        fixture,
        audit: game.civicAudit(),
        cognition: game.cognitionAudit(),
        civilization: game.civilization(),
        population: game.summary().population,
        people: game.populationMechanics(),
      },
      null,
      2,
    ),
  );
  return;
}

if (process.env.QUICK_VISUAL === "1") {
  game.createTestWorld({
    seed: "close-view-probe",
    size: "small",
    lifeDensity: 0.8,
    harshness: 0.5,
    variability: 0.7,
  });
  const fixture = controls.createCivicTestScenario();
  game.step(512);
  const cognition = game.cognitionAudit();
  const predation = predationDebug.demo(true);
  const simsCamera = cameraDebug.probe();
  const hashBefore = game.hashNow();
  const projection = [-2.7, -1.2, 0, 1.4, 2.8].map((angle, n) =>
    visuals.cameraProjection(angle, 0.25 + n * 0.16),
  );
  for (const angle of [-2.7, -1.2, 0, 1.4, 2.8]) {
    for (const tilt of [0.24, 0.58, 0.96])
      visuals.renderOnly({
        view: "oblique",
        quality: "high",
        zoom: 14,
        angle,
        tilt,
        cutaway: true,
        now: 1800 + angle * 10 + tilt,
      });
  }
  const interiors = visuals.interiorSummary();
  const renderIsolation = visuals.renderIsolation(2200);
  controls.collapseKindForTest("person");
  const combat = visuals.combatSummary();
  const hashAfter = game.hashNow();
  const failures = [];
  if (projection.some((result) => result.maxError > 1e-9))
    failures.push("free-orbit inverse projection drifted");
  if (
    !simsCamera.hashIsolated ||
    simsCamera.keyboardMove <= 0 ||
    simsCamera.keyboardOrbit <= 0 ||
    simsCamera.inertiaMove <= 0 ||
    simsCamera.edgeMove <= 0
  )
    failures.push("Sims-style keyboard, orbit, inertia, or edge scrolling failed");
  if (
    interiors.duplicateOccupants.length ||
    interiors.invalidOccupants.length ||
    interiors.capacityViolations.length
  )
    failures.push("interior assignment duplicated, invented, or overfilled residents");
  if (
    cognition.malformed.length ||
    cognition.topology.senses !== 32 ||
    cognition.topology.hidden !== 8 ||
    cognition.topology.inputConnections !== 48 ||
    cognition.topology.recurrentConnections !== 32 ||
    cognition.topology.outputConnections !== 70
  )
    failures.push("expanded LTC cognition topology is malformed");
  if (
    !predation.ok ||
    !predation.lethal ||
    !predation.visual ||
    !predation.bodyPart ||
    !predation.fluidSplatters ||
    !predation.bloodLost ||
    !predation.fluid?.every(
      (splatter) => splatter.amount > 0 && splatter.lifeTicks >= 2 && splatter.lifeTicks <= 12,
    ) ||
    !predation.events.includes("InjuryEvent") ||
    !predation.events.includes("KillEvent")
  )
    failures.push(
      "predation did not create anatomy-scaled fluid that dries within its causal lifetime",
    );
  if (!renderIsolation.ok)
    failures.push(
      `close-view rendering mutated authoritative state: ${renderIsolation.changedKeys.join(", ")}`,
    );
  if (hashBefore === hashAfter) failures.push("death fixture failed to alter authoritative state");
  if (!combat.recent.some((event) => event.death))
    failures.push("death did not enter the close combat/death visual feed");
  const report = {
    ok: !failures.length,
    failures,
    fixture,
    cognition,
    predation,
    simsCamera,
    projection,
    interiors,
    renderIsolation,
    combat,
    drawOps: drawOps.count,
  };
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
  return;
}

function create(seed) {
  const started = Date.now();
  game.createTestWorld({ seed, size: "small", lifeDensity: 0.7, harshness: 0.5, variability: 0.5 });
  const summary = visuals.summary();
  if (summary.models[0]) visuals.portrait(summary.models[0].id);
  summary.generationMs = Date.now() - started;
  const warmRenderStarted = Date.now();
  visuals.renderOnly({ view: "top", quality: "high", zoom: 1, now: 1000 });
  summary.firstRenderMs = Date.now() - warmRenderStarted;
  const cachedRenderStarted = Date.now();
  visuals.renderOnly({ view: "top", quality: "high", zoom: 1, now: 1100 });
  summary.cachedRenderMs = Date.now() - cachedRenderStarted;
  const renderStarted = Date.now();
  summary.renderIsolation = visuals.renderIsolation(1234);
  summary.renderMs = Date.now() - renderStarted;
  if (seed === "causal-origin" || seed === "quartz-13vxtpp") {
    const beforeViews = game.hashNow();
    visuals.renderOnly({ view: "iso", quality: "standard", zoom: 0.9, now: 1300 });
    visuals.renderOnly({ view: "oblique", quality: "standard", zoom: 0.9, now: 1400 });
    summary.projectedViewsIsolation = beforeViews === game.hashNow();
  }
  return summary;
}

const seeds = [
  "causal-origin",
  "quartz-13vxtpp",
  "violet-abyss",
  "glass-orbit",
  "mycelial-moon",
  "iron-dream",
];
const worlds = seeds.map(create);
const firstRepeat = create("causal-origin");
const alienRepeat = create("violet-abyss");
const determinism = game.determinismProbe("determinism-visual", 48);
const failures = [];

game.createTestWorld({
  seed: "clock-equivalence",
  size: "small",
  lifeDensity: 0.7,
  harshness: 0.5,
  variability: 0.5,
});
game.step(64);
const steppedHash = game.hashNow();
game.createTestWorld({
  seed: "clock-equivalence",
  size: "small",
  lifeDensity: 0.7,
  harshness: 0.5,
  variability: 0.5,
});
controls.resetClock();
controls.setSpeed(64);
controls.setRunning(true);
const scheduledTicks = controls.advanceClock(100);
controls.setRunning(false);
const scheduledHash = game.hashNow();
game.createTestWorld({
  seed: "clock-equivalence-128",
  size: "small",
  lifeDensity: 0.7,
  harshness: 0.5,
  variability: 0.5,
});
game.step(128);
const stepped128Hash = game.hashNow();
game.createTestWorld({
  seed: "clock-equivalence-128",
  size: "small",
  lifeDensity: 0.7,
  harshness: 0.5,
  variability: 0.5,
});
controls.resetClock();
controls.setSpeed(128);
controls.setRunning(true);
const scheduled128Ticks = controls.advanceClock(100);
controls.setRunning(false);
const scheduled128Hash = game.hashNow();
game.createTestWorld({
  seed: "followed-death-64x",
  size: "small",
  lifeDensity: 0.7,
  harshness: 0.5,
  variability: 0.5,
});
const followedId = controls.armFollowedDeathForTest("herbivore");
controls.setSpeed(64);
controls.resetClock();
controls.setRunning(true);
const followedBefore = controls.controlState();
const followedDeathTicks = controls.advanceClock(1000);
const followedAfter = controls.controlState();
const postDeathTicks = controls.advanceClock(1000);
const followedSettled = controls.controlState();
const followedCombatVisual = visuals.combatSummary();
visuals.renderOnly({ view: "top", quality: "standard", zoom: 1, now: 1500 });
const anchorBefore = controls.worldAt(327, 219);
controls.zoomAt(3.25, 327, 219);
const anchorAfter = controls.worldAt(327, 219);
const anchorError = Math.hypot(anchorBefore.x - anchorAfter.x, anchorBefore.y - anchorAfter.y);
const orbitProjection = [-2.7, -1.2, 0, 1.4, 2.8].map((angle, n) =>
  visuals.cameraProjection(angle, 0.25 + n * 0.16),
);
const orbitHashBefore = game.hashNow();
for (const angle of [-2.7, 0, 2.8])
  for (const tilt of [0.24, 0.58, 0.96])
    visuals.renderOnly({
      view: "oblique",
      quality: "high",
      zoom: 14,
      angle,
      tilt,
      cutaway: false,
      now: 1550 + angle + tilt,
    });
const orbitRenderIsolation = orbitHashBefore === game.hashNow();
game.createTestWorld({
  seed: "hydrology-recovery",
  size: "small",
  lifeDensity: 0.7,
  harshness: 0.5,
  variability: 0.5,
});
const floodBefore = controls.induceSurfaceFloodForTest(800);
game.step(768);
const floodAfter = game.hydrology();
const floodRecovery = { before: floodBefore, after: floodAfter, matter: game.auditMatter() };
const survivalSeeds = [
  "causal-origin",
  "quartz-13vxtpp",
  "violet-abyss",
  "glass-orbit",
  "mycelial-moon",
  "iron-dream",
];
const survival = survivalSeeds.map((seed) => {
  game.createTestWorld({ seed, size: "small", lifeDensity: 0.7, harshness: 0.5, variability: 0.5 });
  game.step(512);
  const summary = game.summary();
  return {
    seed,
    population: summary.population,
    biosphere: summary.biosphere,
    matter: game.auditMatter(),
  };
});
const longTerm = ["quartz-13vxtpp", "glass-orbit"].map((seed) => {
  game.createTestWorld({ seed, size: "small", lifeDensity: 0.7, harshness: 0.5, variability: 0.5 });
  game.step(4096);
  const summary = game.summary();
  return {
    seed,
    population: summary.population,
    births: summary.births,
    birthsByKind: summary.birthsByKind,
    deaths: summary.deaths,
    deathCauses: summary.deathCauses,
    hydrology: summary.hydrology,
    biosphere: summary.biosphere,
    matter: game.auditMatter(),
  };
});
const standardBaseline = ["oak-zn4nh1", "violet-abyss", "iron-dream"].map((seed) => {
  game.createTestWorld({
    seed,
    size: "small",
    lifeDensity: 1,
    harshness: 0.5,
    variability: 0.5,
    disasterFrequency: 1,
    complexity: "standard",
  });
  game.step(8192);
  const summary = game.summary();
  const baseline = game.baseline();
  const people = game.populationMechanics();
  return {
    seed,
    population: summary.population,
    birthsByKind: summary.birthsByKind,
    deathCauses: summary.deathCauses,
    food: baseline.ecology.food,
    fire: baseline.fire,
    refugia: baseline.refugia,
    people: {
      mature: people.mature,
      reproductionReady: people.reproductionReady,
      meanEnergy: people.mean.energy,
      starving: people.starving,
    },
    matter: game.auditMatter(),
  };
});
game.createTestWorld({
  seed: "refuge-recovery",
  size: "small",
  lifeDensity: 0.7,
  harshness: 0.5,
  variability: 0.5,
});
controls.collapseKindForTest("herbivore");
game.step(128);
const refugeRecovery = { summary: game.summary(), matter: game.auditMatter() };
game.createTestWorld({
  seed: "civic-probe",
  size: "small",
  lifeDensity: 0.7,
  harshness: 0.5,
  variability: 0.5,
});
const civicFixture = controls.createCivicTestScenario();
game.step(512);
visuals.renderOnly({
  view: "oblique",
  quality: "high",
  zoom: 14,
  angle: 1.1,
  tilt: 0.48,
  cutaway: true,
  now: 2100,
});
const civicInterior = visuals.interiorSummary();
const civicCutawayIsolation = visuals.renderIsolation(2150);
const civicPolicyChanged = controls.setCityPolicy("settlement", civicFixture?.campId, "growth");
const civicPriorityChanged = controls.setCityPriority(
  "settlement",
  civicFixture?.campId,
  "knowledge",
  5,
);
const civicPlan = controls.planBuilding("settlement", civicFixture?.campId, "wall");
const civicAudit = game.civicAudit();
const cognitionAudit = game.cognitionAudit();
const civilization = game.civilization();
const civicArchive = game.archiveReplay(16);
const functionalToolKeys = civicAudit.tools
  .filter((tool) => tool.functional)
  .map((tool) => `${tool.placeKind}:${tool.placeId}:${tool.purpose}`);
const civicMechanics = {
  fixture: civicFixture,
  civicPolicyChanged,
  civicPriorityChanged,
  civicPlan: civicPlan?.id || 0,
  civicAudit,
  cognitionAudit,
  civilization,
  interiors: civicInterior,
  cutawayIsolation: civicCutawayIsolation,
  archive: civicArchive,
};

if (worlds[0].terrain.topology !== "continental" || worlds[0].terrain.alienness >= 0.2)
  failures.push("canonical seed is not Earth-adjacent");
if (worlds.slice(1).some((world) => world.terrain.alienness < 0.62))
  failures.push("an alien seed fell below the novelty floor");
if (worlds[0].terrain.digest !== firstRepeat.terrain.digest)
  failures.push("canonical terrain digest changed between runs");
if (worlds[2].terrain.digest !== alienRepeat.terrain.digest)
  failures.push("alien terrain digest changed between runs");
if (worlds[0].structures.digest !== firstRepeat.structures.digest)
  failures.push("canonical ecological structures changed between runs");
if (worlds[2].structures.digest !== alienRepeat.structures.digest)
  failures.push("alien ecological structures changed between runs");
if (new Set(worlds.map((world) => world.terrain.digest)).size !== worlds.length)
  failures.push("different seeds produced duplicate terrain digests");
if (new Set(worlds.slice(1).map((world) => world.structures.signature)).size < 4)
  failures.push("alien seeds reused too many ecological structure grammars");
if (new Set(worlds.slice(1).map((world) => world.terrain.topology)).size < 3)
  failures.push("topology diversity is too low");
if (
  new Set(
    worlds
      .slice(1)
      .map(
        (world) =>
          `${Math.round(world.palette.liquid)}:${Math.round(world.palette.flora)}:${world.palette.floraForm}`,
      ),
  ).size < 4
)
  failures.push("palette/flora diversity is too low");
if (worlds.some((world) => Object.values(world.structures.counts).some((count) => count < 1)))
  failures.push("a generated world is missing an ecological structure category");
if (worlds.some((world) => world.structures.total < 45 || world.structures.subsurface < 20))
  failures.push("a generated world lacks visible or subsurface niche density");
if (
  ![
    "Giant Trees",
    "Mountain Spires",
    "Cavern Entrances",
    "Hydrothermal Vents",
    "Coral Reefs",
    "Mineral Deposits",
  ].every((name) => worlds[0].structures.forms.some((form) => form.name === name))
)
  failures.push("canonical seed is missing familiar Earth-adjacent niche structures");
if (worlds.some((world) => !world.renderIsolation.ok))
  failures.push("rendering mutated an authoritative world hash");
if (worlds.some((world) => world.projectedViewsIsolation === false))
  failures.push("iso/oblique rendering mutated an authoritative world hash");
if (worlds.some((world) => world.terrain.mountains < 1))
  failures.push("a generated world has no high-relief terrain");
if (!determinism.ok) failures.push("fixed-tick replay is not deterministic");
if (scheduledTicks !== 64 || scheduledHash !== steppedHash)
  failures.push("64× clock did not execute the same 64 fixed ticks as manual stepping");
if (scheduled128Ticks !== 128 || scheduled128Hash !== stepped128Hash)
  failures.push("128× clock did not execute the same 128 fixed ticks as manual stepping");
if (
  !followedId ||
  followedDeathTicks !== 1 ||
  followedAfter.running ||
  !followedAfter.interrupted ||
  followedAfter.followId !== 0
)
  failures.push("followed death did not hard-interrupt 64× simulation on its exact death tick");
if (
  postDeathTicks !== 0 ||
  followedSettled.tick !== followedAfter.tick ||
  followedSettled.accumulator !== 0
)
  failures.push("queued 64× time continued behind the followed-death summary");
if (
  followedBefore.population.person !== followedAfter.population.person ||
  followedBefore.population.predator !== followedAfter.population.predator ||
  followedBefore.population.herbivore - followedAfter.population.herbivore !== 1
)
  failures.push("followed death altered unrelated planetary populations");
if (anchorError > 1e-9) failures.push("cursor-anchored camera zoom drifted across the world");
if (orbitProjection.some((result) => result.maxError > 1e-9))
  failures.push("free-orbit projection did not invert coherently across rotation and tilt");
if (!orbitRenderIsolation) failures.push("free-orbit rendering mutated authoritative world state");
if (
  !followedCombatVisual.recent.some((event) => event.death && event.subjects.includes(followedId))
)
  failures.push("followed death did not enter the close death-animation feed");
if (
  floodAfter.excess >= floodBefore.excess * 0.15 ||
  floodAfter.floodedLandTiles >= floodBefore.floodedLandTiles
)
  failures.push("temporary surface flooding did not drain toward the natural waterline");
if (floodRecovery.matter.relative > 1e-8)
  failures.push("hydrological drainage violated matter conservation");
if (
  survival.some(
    (world) =>
      world.population.herbivore < 1 ||
      world.population.predator < 1 ||
      world.population.person < 1,
  )
)
  failures.push("a seed lost an entire founding niche within 512 ticks");
if (survival.some((world) => world.matter.relative > 1e-8))
  failures.push("biosphere survival or dormancy violated matter conservation");
if (
  longTerm.some(
    (world) =>
      world.population.herbivore < 1 ||
      world.population.predator < 1 ||
      world.population.person < 1,
  )
)
  failures.push("a sexually reproducing biosphere lost a founding niche within 4096 ticks");
if (longTerm.some((world) => world.births < 1))
  failures.push("sexual creature reproduction produced no births after maturity");
if (
  longTerm.some(
    (world) =>
      world.birthsByKind.herbivore < 1 ||
      world.birthsByKind.predator < 1 ||
      world.birthsByKind.person < 1,
  )
)
  failures.push("a creature niche failed to produce sexual offspring after maturity");
if (
  longTerm.some(
    (world) =>
      world.hydrology.landFloodCoverage > 0.01 ||
      world.hydrology.excess > world.hydrology.baseline * 0.002,
  )
)
  failures.push("weather cycles accumulated into an unexplained long-term flood");
if (longTerm.some((world) => world.matter.relative > 1e-8))
  failures.push("long-term sexual reproduction violated matter conservation");
if (
  standardBaseline.some(
    (world) =>
      world.population.person < 8 ||
      world.population.herbivore < 18 ||
      world.population.predator < 4,
  )
)
  failures.push(
    "the standard baseline lost a minimum viable sexual population across tested seeds",
  );
if (
  standardBaseline.some(
    (world) => world.birthsByKind.person < 2 || world.birthsByKind.herbivore < 2,
  )
)
  failures.push(
    "the standard baseline did not renew its social and grazer sexual niches across tested seeds",
  );
if (standardBaseline.some((world) => world.food < 3 || world.people.meanEnergy < 40))
  failures.push("the standard baseline entered an unrecoverable food-energy collapse");
if (
  standardBaseline.some(
    (world) => world.fire.nearLife > 0 || world.fire.nearPlaces > 0 || world.fire.disasters > 0,
  )
)
  failures.push("natural fire intersected life or built places in the standard baseline");
if (standardBaseline.some((world) => world.matter.relative > 1e-8))
  failures.push("the standard baseline or sexual seed bank violated matter conservation");
if (refugeRecovery.summary.population.herbivore < 1 || refugeRecovery.summary.biosphere.rescues < 1)
  failures.push("dormant refugia did not recover a deliberately collapsed niche");
if (refugeRecovery.matter.relative > 1e-8)
  failures.push("refuge germination created or destroyed matter");
if (!civicFixture || civicFixture.matterDelta !== 0)
  failures.push("civic fixture created or destroyed matter");
if (civicAudit.failures.length || civicAudit.matter.relative > 1e-8)
  failures.push("civic construction, tools, or storage failed its conservation audit");
if (
  civicAudit.metrics.gathered < 1 ||
  civicAudit.metrics.delivered < 1 ||
  civicAudit.metrics.constructionWork < 1
)
  failures.push("workers did not visibly gather, haul, and construct");
if (
  civicAudit.buildings.filter((building) => building.complete).length < 3 ||
  civicAudit.tools.filter((tool) => tool.functional).length < 2
)
  failures.push("civic scenario did not produce physical structures and tools");
if (
  civicInterior.duplicateOccupants.length ||
  civicInterior.invalidOccupants.length ||
  civicInterior.capacityViolations.length
)
  failures.push("cutaway interiors duplicated, invented, or overfilled household residents");
if (!civicCutawayIsolation.ok)
  failures.push("interior cutaway rendering mutated authoritative world state");
if (new Set(functionalToolKeys).size !== functionalToolKeys.length)
  failures.push("camp promotion duplicated a functional tool order");
if (
  cognitionAudit.malformed.length ||
  cognitionAudit.agents < 4 ||
  cognitionAudit.updates < 1 ||
  cognitionAudit.influences < 1
)
  failures.push("liquid-time-constant cognition did not influence agents");
if (civilization.stageIndex < 3)
  failures.push("cell-to-civilization progression did not reach a built village");
if (!civicPolicyChanged || !civicPriorityChanged || !civicPlan)
  failures.push("city management controls did not alter policy, labor priority, and construction");
if (!civicArchive.ok || !civicArchive.typed.buildingComposition || !civicArchive.typed.cognition)
  failures.push("save/archive replay lost deterministic civic or cognition state");

const report = {
  ok: failures.length === 0,
  failures,
  determinism,
  clockEquivalence: {
    ok: scheduledTicks === 64 && scheduledHash === steppedHash,
    scheduledTicks,
    steppedHash,
    scheduledHash,
  },
  clockEquivalence128x: {
    ok: scheduled128Ticks === 128 && scheduled128Hash === stepped128Hash,
    scheduledTicks: scheduled128Ticks,
    steppedHash: stepped128Hash,
    scheduledHash: scheduled128Hash,
  },
  followedDeath64x: {
    followedId,
    followedDeathTicks,
    postDeathTicks,
    before: followedBefore,
    after: followedAfter,
    settled: followedSettled,
  },
  cameraAnchorError: anchorError,
  freeOrbit: { projection: orbitProjection, renderIsolation: orbitRenderIsolation },
  floodRecovery,
  survival,
  longTerm,
  standardBaseline,
  refugeRecovery,
  civicMechanics,
  drawOps: drawOps.count,
  worlds: worlds.map((world) => ({
    seed: world.seed,
    generationMs: world.generationMs,
    firstRenderMs: world.firstRenderMs,
    cachedRenderMs: world.cachedRenderMs,
    renderMs: world.renderMs,
    terrain: world.terrain,
    structures: world.structures,
    palette: world.palette,
    modelTopologies: [...new Set(world.models.map((model) => model.topology))],
    renderIsolation: world.renderIsolation.ok,
  })),
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
