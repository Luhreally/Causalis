// Provision smoke: every habitable stretch of a new world has an ochre seam and
// a polymer bed within a prospector's reach, the seams are booked into the
// world's initial matter, provisioning runs once, and crystal stands in for
// pigment in research and in the archive's inks where pigment is out of reach.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const prov = window.ALIFE_PROVISION_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  out.state = prov.state();
  if (!out.state || out.state.version !== 1) fail("the world was not provisioned: " + JSON.stringify(out.state));
  const coverage = prov.coverage();
  out.blocks = coverage.blocks; out.missing = coverage.missing.length;
  if (!(coverage.blocks > 0)) fail("no habitable blocks were found");
  if (coverage.missing.length) fail("habitable land without a seam within reach: " + JSON.stringify(coverage.missing.slice(0, 3)));
  const audit = auditMatter();
  out.drift = audit.delta;
  if (audit.delta !== 0) fail("the seams were not booked into the initial matter: " + audit.delta);
  // Provisioning runs once.
  const again = prov.provision();
  if (again.deposited !== out.state.deposited || again.tick !== out.state.tick) fail("provisioning ran twice");
  // Crystal stands in for pigment in research.
  for (let i = 0; i < 160; i++) simTick();
  const place = W.settlements.find((s) => !s.ruined) || W.camps.find((c) => c.active);
  if (!place) { fail("no place"); return out; }
  place.researchInventory = place.researchInventory || new Uint16Array(SPECIES_COUNT);
  place.inventory[C.PIGMENT] = 0; place.researchInventory[C.PIGMENT] = 0; place.inventory[C.CRYSTAL] = 0; place.researchInventory[C.CRYSTAL] = 0;
  if (hasResearchMaterial(place, C.PIGMENT)) fail("pigment counted as present with none in store");
  place.researchInventory[C.CRYSTAL] = 10;
  if (!hasResearchMaterial(place, C.PIGMENT)) fail("crystal did not stand in for pigment in research");
  // And in the archive's inks when pigment is out of reach.
  if (place.knownProcesses) {
    prov.forceSwap(true);
    place.inventory[C.CRYSTAL] = 10;
    out.archiveNeeds = prov.requirements(place.id, "archive");
    prov.forceSwap(false);
    const names = out.archiveNeeds.map(([n]) => n);
    if (names.includes(W.definitions.species[C.PIGMENT].name)) fail("the archive still asks for pigment when none is within reach: " + JSON.stringify(out.archiveNeeds));
    if (!names.includes(W.definitions.species[C.CRYSTAL].name)) fail("the archive does not accept crystal: " + JSON.stringify(out.archiveNeeds));
    out.archiveNeedsNormal = prov.requirements(place.id, "archive").map(([n]) => n);
  }
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_PROVISION_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_PROVISION_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
