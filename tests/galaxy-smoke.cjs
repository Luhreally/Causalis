// Galaxy smoke: every charted star has a system of worlds at a fixed bearing,
// generated the same way twice; a colony works out crafts and a polity with
// radio and an archive receives them; a rich system pays coin home; a hard
// year takes its toll; a grown colony settles the other worlds of its system
// and sends ships onward that found colonies in their turn; a great and
// distant colony declares itself free; the Stars page carries the chart and
// the systems, the colony page its world; and none of it disturbs the world
// when drawn.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const gal = window.ALIFE_GALAXY_DEBUG, orbit = window.ALIFE_ORBIT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const f = W.factions.find((x) => x.id === s.factionId);
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === place.id && x.type === type);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  // Systems: worlds at fixed bearings, the same twice.
  gal.ensure();
  const stars = W.stars;
  out.stars = stars.length;
  for (const star of stars) if (!(star.worlds.length === star.planets) || !(star.angle >= 0)) fail(star.name + " has no whole system");
  const first = stars[0];
  if (first.worlds[0].habitability !== first.habitability) fail("the prime world does not carry the star's habitability");
  const a = JSON.stringify(gal.worlds(first.id)); first.worlds = null; gal.ensure(); const b = JSON.stringify(gal.worlds(first.id));
  if (a !== b) fail("the worlds of a system are not generated the same way twice");
  const p1 = JSON.stringify(gal.positions()); const p2 = JSON.stringify(gal.positions());
  if (p1 !== p2) fail("star bearings drift");
  if (stars.length > 1 && !(Math.abs(gal.apart(stars[0].id, stars[1].id) - gal.apart(stars[1].id, stars[0].id)) < 1e-9)) fail("distance between stars is not symmetric");
  // A ship leaves and founds a colony.
  for (const t of ["astronomy", "starflight", "currency", "radio"]) if (!s.knownProcesses.includes(t)) s.knownProcesses.push(t);
  s.stability = Math.max(s.stability || 0, 0.6);
  complete(s, "archive");
  if (!complete(s, "launch_tower")) { fail("no launch tower could be raised"); return out; }
  orbit.chart(true);
  const ascension = orbit.launch(s.id, true);
  if (!ascension) { fail("no ship left"); return out; }
  const voyage = W.voyages.find((v) => v.id === ascension.voyageId);
  if (!voyage) { fail("no voyage"); return out; }
  orbit.arrive(voyage.id);
  const colony = W.colonies.find((c) => c.voyageId === voyage.id);
  if (!colony) { fail("no colony was founded"); return out; }
  gal.ensure();
  out.colony = colony.name;
  const star = stars.find((x) => x.id === colony.starId);
  if (colony.worldIndex !== 0) fail("the first colony is not on the prime world");
  // It works out crafts; radio carries them home to the archive.
  colony.population = Math.max(colony.population, 120);
  colony.research = 1e6;
  out.target = gal.target(colony.id);
  out.learned = gal.research(colony.id);
  if (!out.learned || !colony.knownProcesses.includes(out.learned)) fail("the colony worked out nothing: " + out.target);
  const discovery = W.events.filter((e) => e.type === "ColonyDiscoveryEvent").at(-1);
  out.discovery = discovery ? eventSentence(discovery) : "";
  if (!discovery) fail("no discovery was chronicled");
  if (!s.knownProcesses.includes(out.learned) && !(f.records || []).includes(out.learned)) fail("radio carried nothing home: " + JSON.stringify(f.records || []));
  // A rich system pays coin home.
  ensureMarkets(W);
  star.worlds[0].resources = Math.max(star.worlds[0].resources, 0.8);
  f.treasury = 0;
  out.coin = gal.shipment(colony.id);
  if (!(out.coin >= 1) || !(f.treasury >= 1)) fail("the rich colony sent no coin: " + out.coin + " treasury " + f.treasury);
  // A hard year takes its toll.
  const before = colony.population;
  const hardship = gal.hardship(colony.id, true);
  if (!hardship || !(colony.population < before)) fail("the hard year took nothing");
  colony.population = gal.cap(colony.id);
  // A grown colony settles another world of its system, then sends a ship onward.
  if (star.planets < 2) { star.planets = 3; star.worlds = null; gal.ensure(); }
  if (!colony.knownProcesses.includes("starflight")) colony.knownProcesses.push("starflight");
  colony.foundedTick = W.tick - TICKS_PER_YEAR * 61;
  const daughter = gal.daughter(colony.id, true);
  if (!daughter) fail("no daughter colony was founded");
  else {
    out.daughter = daughter.name;
    if (daughter.starId !== star.id || daughter.worldIndex === 0 || daughter.parentColonyId !== colony.id) fail("the daughter colony is not on another world of the same system");
    if (!W.events.some((e) => e.type === "DaughterColonyEvent")) fail("the daughter colony was not chronicled");
  }
  colony.population = gal.cap(colony.id);
  const onward = stars.length > 1 ? gal.onward(colony.id, true) : null;
  if (stars.length > 1) {
    if (!onward) fail("no ship left the colony onward");
    else {
      out.onward = onward.name;
      const target = stars.find((x) => x.id === onward.starId);
      if (!target || !target.chartedTick || target.chartedBy !== colony.name) fail("the onward ship charted nothing: " + JSON.stringify(target && { charted: target.chartedTick, by: target.chartedBy }));
      if (onward.fromColonyId !== colony.id || onward.status !== "under way") fail("the onward voyage is malformed");
      orbit.arrive(onward.id);
      const second = W.colonies.find((c) => c.voyageId === onward.id);
      if (!second) fail("the onward ship founded no colony");
      else {
        out.second = second.name;
        const founded = W.events.filter((e) => e.type === "ColonyFoundedEvent").at(-1);
        if (!founded || founded.data.from !== colony.name) fail("the second founding does not name the colony it came from");
        if (/^New New/.test(second.name) || second.name !== target.worlds[0].name || second.parentColonyId !== colony.id) fail("the onward colony is not named for its world: " + second.name);
      }
    }
  }
  // A great and distant colony declares itself free.
  const freed = gal.independence(colony.id, true);
  if (!freed || colony.factionId !== 0 || !colony.independent) fail("the colony did not go free");
  if (!/free/.test(eventSentence(freed || {}))) fail("independence is not chronicled");
  // The yearly pass runs whole.
  out.pass = gal.tick();
  // Pages: the chart, the systems, the colony's world; the world untouched.
  const h0 = worldHash();
  const starsPage = renderLegendPage("stars"), colonyPage = renderLegendPage("colony", colony.id);
  if (!/<svg/.test(starsPage) || !/Systems/.test(starsPage) || !starsPage.includes(esc(star.worlds[0].name))) fail("the stars page shows no chart or systems");
  if (!/World<\/span>/.test(colonyPage) || !/free world/.test(colonyPage)) fail("the colony page shows no world or standing");
  if (worldHash() !== h0) fail("rendering the pages changed the world");
  if (/undefined|NaN/.test(starsPage + colonyPage)) fail("a page contains undefined");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_GALAXY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_GALAXY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
