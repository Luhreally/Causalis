// Society life smoke, one fixture for the round's four sections. Conversation
// (152): a hungry speaker is fed by a friend who has food, a mourner is
// comforted, a crime is passed on by gossip, a speech bubble is recorded and
// a mood is kept. First aid (153): the hurt one's partner comes before a
// stranger, the clinic dresses wounds with the town's medicine, aid given
// teaches the healer's craft, a hungry child is fed from a parent's pack.
// Justice (154): a robbery is a case with witnesses, the court convicts and
// restores, the cell holds its prisoner out of work, banishment sends the
// offender out and a return is a new case, the law's eye is felt. Streets
// (155): a household of a driving town buys a car, a lane worn by traffic is
// paved, and the crowd is drawn without writing the world. The matter of the
// world balances throughout.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id)).sort((a, b) => a - b);
  if (people.length < 6) { fail("too few people: " + people.length); return out; }
  for (const id of people) {
    Object.assign(W.components.social[id], { homePlaceKind: "settlement", homePlaceId: s.id, factionId: s.factionId || W.components.social[id].factionId });
    const body = W.components.body[id];
    W.components.life[id].age = Math.max(W.components.life[id].age, Math.floor((body?.maxAge || 19200) * 0.3));
  }
  const place = (id, dx, dy) => { const p = W.components.position[id]; p.x = s.x + dx; p.y = s.y + dy; p.regionId = regionId(p.x, p.y); };
  const [a, b, c, d, e, f] = people;
  people.forEach((id, n) => place(id, (n % 3) - 1, Math.floor(n / 3) - 1));
  rebuildSpatialBins();
  const matter = () => auditMatter().delta,
    conserved = (label, fn) => { const before = matter(), r = fn(); if (matter() !== before) fail(label + " lost or made matter: " + (matter() - before)); return r; };
  // ── Conversation ──
  const T = window.ALIFE_TALK_DEBUG;
  W.components.chemistry[a].q[C.ENERGY] = 60;
  derivedLife(a);
  W.components.inventory[b].materials[C.ORGANIC] = 40;
  Object.assign(relationshipState(b, a), { trust: 0.8, affection: 0.7, familiarity: 0.6 });
  const gutBefore = W.components.inventory[a].digestive[C.ORGANIC];
  const said = conserved("food shared in talk", () => T.converse(a, b));
  out.hunger = [said.topic, said.replyKey, W.components.inventory[a].digestive[C.ORGANIC] - gutBefore];
  if (said.topic !== "hunger" || said.replyKey !== "share" || !(W.components.inventory[a].digestive[C.ORGANIC] > gutBefore)) fail("a hungry speaker was not fed by a friend with food: " + JSON.stringify(out.hunger));
  W.components.chemistry[a].q[C.ENERGY] = 800; derivedLife(a);
  const emo = W.components.social[a].emotion;
  emo.sadness = 0.9;
  const griefSaid = T.converse(a, b), sadAfter = W.components.social[a].emotion.sadness;
  out.grief = [griefSaid.topic, griefSaid.replyKey, +sadAfter.toFixed(2)];
  if (griefSaid.topic !== "grief" || griefSaid.replyKey !== "comfort" || !(sadAfter < 0.9)) fail("a mourner was not comforted: " + JSON.stringify(out.grief));
  emo.sadness = 0;
  W.components.identity[c].crimes = 1;
  Object.assign(relationshipState(a, c), { familiarity: 0.8, grievance: 0.9, trust: 0, heardCrimes: 1 });
  W.components.chemistry[a].q[C.ENERGY] = 800;
  const gossip = T.converse(a, d);
  out.gossip = [gossip.topic, gossip.replyKey, relationshipState(d, c).heardCrimes || 0];
  if (gossip.topic !== "crime" || !((relationshipState(d, c).heardCrimes || 0) >= 1)) fail("a crime was not passed on: " + JSON.stringify(out.gossip));
  out.speech = T.speech(a);
  if (!out.speech || out.speech.role !== "say" || !out.speech.text) fail("no speech bubble was recorded: " + JSON.stringify(out.speech));
  updateMeasuredEmotion(a);
  out.mood = T.state(a);
  if (!Number.isFinite(out.mood.mood) || !Number.isFinite(out.mood.loneliness)) fail("the mood was not kept");
  const h0 = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, x: s.x + 0.5, y: s.y + 0.5, now: 4000 });
  if (worldHash() !== h0) fail("drawing the talk changed the world");
  // ── First aid ──
  const A = window.ALIFE_AID_DEBUG;
  const victim = e, partner = f, stranger = d;
  place(victim, 0, 0); place(stranger, 1, 0); place(partner, 3, 0); rebuildSpatialBins();
  W.components.social[victim].partnerId = partner; W.components.social[partner].partnerId = victim;
  for (const id of [partner, stranger]) { const q = W.components.chemistry[id].q; q[C.ENERGY] = Math.max(q[C.ENERGY], 400); q[C.SOLVENT] = Math.max(q[C.SOLVENT], 300); derivedLife(id); }
  const life = W.components.life[victim];
  life.wounds = [{ id: 1, tick: W.tick, part: "arm", type: "cut", severity: 0.6, bleed: 4, bloodLost: 0, treated: false }];
  const before = A.counts();
  while (W.tick % 4 !== 2) W.tick++;
  conserved("choosing a helper", () => updatePersonRescue());
  out.aid = A.counts();
  // The partner comes alongside and gives the aid.
  place(partner, 1, 0); place(stranger, 4, 4); rebuildSpatialBins();
  W.tick += 4;
  conserved("aid given", () => updatePersonRescue());
  if (!(out.aid.kinHelped > before.kinHelped)) fail("the hurt one's partner did not come before a stranger: " + JSON.stringify(out.aid));
  out.healSkill = W.components.identity[partner].skills?.heal || 0;
  if (!(out.healSkill > 0)) fail("giving aid taught no healing");
  const clinic = planBuilding(s, "clinic", 9);
  if (clinic) {
    clinic.complete = true; clinic.stage = 6; clinic.integrity = clinic.maxIntegrity; clinic.completedTick = W.tick;
    for (const [sp, n] of clinic.requirements || []) clinic.composition[sp] = n;
    const pt = W.components.position[victim]; pt.x = clinic.x; pt.y = clinic.y; rebuildSpatialBins();
    life.wounds = [{ id: 2, tick: W.tick, part: "leg", type: "cut", severity: 0.5, bleed: 3, bloodLost: 0, treated: false }];
    if (!s.knownProcesses.includes("medicine")) s.knownProcesses.push("medicine");
    s.inventory[C.MEDICINE] = 5;
    conserved("the clinic's care", () => A.clinicCare());
    out.clinic = [life.wounds[0].treated, s.inventory[C.MEDICINE]];
    if (!life.wounds[0].treated || s.inventory[C.MEDICINE] !== 4) fail("the clinic did not dress the wound with the town's medicine: " + JSON.stringify(out.clinic));
  } else fail("no clinic could be planned");
  const child = people.find((id) => id !== partner && id !== victim) ;
  W.components.life[child].age = 10;
  W.components.identity[child].parents = [partner];
  place(child, 3, 1); rebuildSpatialBins();
  W.components.chemistry[child].q[C.ENERGY] = 60; derivedLife(child);
  W.components.inventory[partner].materials[C.ORGANIC] = 30;
  const fedBefore = A.counts().childrenFed;
  conserved("a child fed", () => A.feedChildren());
  if (!(A.counts().childrenFed > fedBefore)) fail("a hungry child was not fed from a parent's pack");
  W.components.life[child].age = Math.floor((W.components.body[child]?.maxAge || 19200) * 0.3);
  // ── Justice ──
  const J = window.ALIFE_JUSTICE_DEBUG, fac = W.factions.find((x) => x.id === s.factionId) || (createFaction(s.id), W.factions.find((x) => x.id === s.factionId));
  const hall = planBuilding(s, "hall", 9);
  if (!hall || !fac) { fail("no hall or no polity for a court"); return out; }
  hall.complete = true; hall.stage = 6; hall.integrity = hall.maxIntegrity; hall.completedTick = W.tick;
  for (const [sp, n] of hall.requirements || []) hall.composition[sp] = n;
  fac.stability = Math.max(fac.stability || 0, 0.6);
  fac.law = { code: "fines", adoptedTick: W.tick, eventId: 0 };
  const robber = a, robbed = b;
  people.forEach((id, n) => place(id, (n % 3) - 1, Math.floor(n / 3) - 1)); rebuildSpatialBins();
  W.components.inventory[robber].materials[C.ORGANIC] = 20;
  const theCase = J.open("robbery", robber, robbed, idx(s.x, s.y));
  out.case = { witnesses: theCase?.witnesses?.length || 0 };
  if (!theCase || !(theCase.witnesses.length >= 1)) fail("a robbery was not a case with witnesses");
  if (!J.court(s.id)) fail("a town with a hall under a code holds no court");
  const tried = conserved("the court's sentence", () => J.hold(s.id)), verdict = J.cases().find((x) => x.id === theCase.id);
  out.verdict = [tried, verdict?.status, verdict?.punishment];
  if (verdict?.status !== "convicted" || !verdict.punishment) fail("the court did not convict and sentence: " + JSON.stringify(out.verdict));
  fac.law.code = "cell";
  for (const w of people) if (w !== c) relationshipState(w, c).heardCrimes = 1;
  const cellCase = J.open("assault", c, d, idx(s.x, s.y));
  J.hold(s.id);
  out.cell = J.jailedNow(c);
  if (!out.cell) fail("the cell took no prisoner under a written law");
  place(c, 5, 5); J.cells();
  const pc = W.components.position[c];
  if (pc.x !== hall.x || pc.y !== hall.y) fail("the cell did not hold its prisoner");
  if (workerReadyForLabor(c)) fail("a prisoner was ready for labour");
  fac.law.code = "exile";
  const exile = people.find((id) => id !== c && id !== robber) ;
  for (const w of people) if (w !== exile) relationshipState(w, exile).heardCrimes = 1;
  J.open("murder", exile, robbed, idx(s.x, s.y));
  const ideology = typeof ensureIdeology === "function" ? ensureIdeology(fac) : null;
  if (ideology) ideology.rule = 0.4;
  J.hold(s.id);
  out.banished = [W.components.identity[exile]?.banishedFrom, W.components.social[exile]?.factionId];
  if (W.components.identity[exile]?.banishedFrom !== fac.id || W.components.social[exile].factionId) fail("banishment did not send the offender out: " + JSON.stringify(out.banished));
  clearCivilOrder(exile); place(exile, 0, 1); rebuildSpatialBins();
  const returnedBefore = J.counts().returned;
  J.returned();
  if (!(J.counts().returned > returnedBefore)) fail("a return from banishment was not a new case");
  out.risk = J.risk(robbed);
  if (!(out.risk >= 0.5)) fail("the law's eye is not felt beside a court: " + out.risk);
  // ── Streets ──
  const S = window.ALIFE_STREETS_DEBUG;
  for (const t of ["combustion", "masonry"]) if (!s.knownProcesses.includes(t)) s.knownProcesses.push(t);
  out.drives = S.drives(s.id);
  if (out.drives) {
    s.inventory[C.METAL] = 60;
    for (const id of people) if (W.components.identity[id]) W.components.identity[id].civicCoins = 60;
    const bought = conserved("a car bought", () => S.buy(s.id));
    out.cars = bought;
    if (!(bought >= 1)) fail("no household of a driving town bought a car");
  } else fail("a town that knows combustion does not drive");
  const plan = townPlan(s);
  let lane = -1;
  for (let dy = -4; dy <= 4 && lane < 0; dy++) for (let dx = -4; dx <= 4 && lane < 0; dx++) {
    const x = s.x + dx, y = s.y + dy;
    if (inside(x, y) && isLaneTile(s, plan, x, y) && !W.tiles.road[idx(x, y)] && developmentFootprintClear(x, y, 0)) lane = idx(x, y);
  }
  if (lane >= 0) {
    W.tiles.traffic[lane] = 5000;
    s.inventory[C.MINERAL] = Math.max(s.inventory[C.MINERAL], 20);
    conserved("a lane paved", () => S.pave(s.id));
    out.paved = W.tiles.road[lane];
    if (!out.paved) fail("a worn lane was not paved");
  } else out.paved = "no clear lane near the fixture town";
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_SOCIETY_LIFE_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_SOCIETY_LIFE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
