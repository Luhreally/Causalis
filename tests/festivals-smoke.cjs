// Festivals smoke: a feast that eats real food and gathers the town, songs
// composed from the annals and carried to another people, murals painted with
// pigment, dancers on screen, the Legends rows, and stable drawing.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const fest = window.ALIFE_FESTIVAL_DEBUG, legends = window.ALIFE_LEGENDS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  const culture = W.cultures.find((c) => c.id === faction.cultureId);
  if (!culture) { fail("no culture"); return out; }
  const people = entityAtRadius(idx(settlement.x, settlement.y), 8, KINDS.PERSON).filter((id) => classifyAlive(id));
  if (people.length < 4) { fail("too few people at the settlement"); return out; }
  for (const id of people) { W.components.life[id].age = Math.max(W.components.life[id].age, 4000); W.components.life[id].hunger = Math.min(W.components.life[id].hunger || 0, 30); }
  settlement.inventory[C.ORGANIC] = Math.max(settlement.inventory[C.ORGANIC], 120);
  settlement.inventory[C.PIGMENT] = Math.max(settlement.inventory[C.PIGMENT], 6);
  const matterBefore = totalMatter();
  // A song from the annals, in the people's own tongue.
  const founding = (W.annals || []).find((a) => a.type === "SettlementFoundedEvent") || (W.annals || []).find((a) => a.importance >= 3);
  if (!founding) { fail("no annal to sing of"); return out; }
  const song = fest.compose(founding.id, culture.id);
  if (!song) fail("no song was composed");
  else {
    out.song = { title: song.title, name: song.name, kind: song.kind };
    if (!/^The /.test(song.title) || /undefined/.test(song.title)) fail("the song has no proper title (" + song.title + ")");
    if (!languageOf(culture).legacy && !song.name) fail("the song has no name in the people's tongue");
  }
  const songEvent = W.events.filter((e) => e.type === "SongEvent").at(-1);
  if (!songEvent) fail("no SongEvent"); else out.songSentence = eventSentence(songEvent);
  if (fest.compose(founding.id, culture.id)) fail("the same event was sung twice by one people");
  // The feast: food really eaten, the town gathered, the song sung.
  out.dance = fest.dance(culture.id);
  const storeBefore = settlement.inventory[C.ORGANIC];
  const feast = fest.feast(settlement.id, "harvest");
  if (!feast) { fail("no feast was held"); return out; }
  out.feast = { attendees: feast.attendees.length, songs: feast.songIds.length };
  if (feast.attendees.length < 4) fail("too few attended");
  if (!(settlement.inventory[C.ORGANIC] < storeBefore)) fail("the feast ate nothing from the store");
  if (totalMatter() !== matterBefore) fail("the feast changed total matter");
  if (!feast.attendees.every((id) => W.civilOrders.some((o) => o.id === id && o.kind === "festival"))) fail("attendees were not gathered");
  const feastEvent = W.events.filter((e) => e.type === "FeastEvent").at(-1);
  if (!feastEvent) fail("no FeastEvent"); else out.feastSentence = eventSentence(feastEvent);
  if (song && song.sung < 1) fail("the song was not sung at the feast");
  if (fest.feast(settlement.id, "feast")) fail("a second feast began while the first was on");
  // Dancers: those who reached the gathering sway on screen and nothing else changes.
  const [gx, gy] = xy(fest.gathering(settlement.id));
  for (const id of feast.attendees) { const p = W.components.position[id]; p.x = gx; p.y = gy; }
  rebuildSpatialBins();
  const hashBefore = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 6, now: 5000 });
  out.dancers = fest.dancers(5000);
  if (!out.dancers) fail("no one is dancing at the gathering");
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "standard", zoom: 3, now: 5200 });
  if (worldHash() !== hashBefore) fail("rendering the feast changed the world hash");
  // A guest of another people carries the song home.
  const other = W.cultures.find((c) => c.id !== culture.id);
  if (other && song) {
    const carried = fest.spread(other.id, fest.songs(culture.id).find((s) => s.eventId === song.eventId), settlement.id);
    if (!carried) fail("the song did not spread to another people");
    else out.spreadSentence = eventSentence(carried);
    if (!fest.songs(other.id).some((s) => s.title === song.title)) fail("the other people did not learn the song");
  } else out.singleCulture = true;
  // The feast ends and the town goes back to work.
  W.tick += 0;
  for (let i = 0; i < 100; i++) simTick();
  fest.tick();
  if (W.civilOrders.some((o) => o.kind === "festival")) fail("festival orders outlived the feast");
  // A mural, paid for in pigment.
  const b = W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && !x.complete && x.type !== "dock");
  if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; }
  const pigmentBefore = totalMatter();
  const mural = fest.mural(settlement.id);
  if (!mural) fail("no mural was painted");
  else {
    out.muralSentence = eventSentence(mural);
    if (!W.buildings.some((x) => x.placeId === settlement.id && x.mural)) fail("no building carries the mural");
    if (totalMatter() !== pigmentBefore) fail("painting changed total matter");
  }
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 8, now: 6000 });
  // Legends: songs on the culture page, the composer's page, the place's feasts, the index.
  if (!/Songs and stories/.test(legends.render("culture", culture.id))) fail("the culture page has no songs section");
  if (song?.composerId && !/Composed/.test(legends.render("life", song.composerId))) fail("the composer's page lists no works");
  if (!/Feasts held/.test(legends.render("place", settlement.id))) fail("the place page has no festivals row");
  if (!/Songs and stories/.test(legends.render("index", 0))) fail("the Legends index has no songs section");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_FESTIVAL_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_FESTIVAL_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
