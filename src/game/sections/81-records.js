// ═══════════════════════════════════════════════════════════════════════════
// 81. RECORDS — archives remember what the ruins forgot
// ═══════════════════════════════════════════════════════════════════════════
// When a town fell in war it took its crafts with it. The world kept a faint
// shared memory (a legacy list that made rediscovery a little faster), but a
// polity whose only smiths died in a sacked town could go a century without
// metal. Now a polity with a completed archive keeps records: every process
// any of its living towns practises is written down, and when a town is ruined
// what it knew survives in the archive of a surviving town. A town of the same
// polity that has the priors, the materials, and the facility recovers a
// recorded process outright, chronicled as a recovery from the archive; and
// where recovery is not yet possible, a recorded process is researched at four
// times the pace, at half the threshold, and without waiting to observe it
// afresh. A polity without an archive still loses what its dead towns knew.
const RECORDS_CADENCE = 256;
function factionArchives(faction) {
  if (!faction) return [];
  return W.settlements.filter(
    (s) => !s.ruined && s.factionId === faction.id && completedBuildings(s, "archive").length > 0,
  );
}
function ensureRecords(faction) {
  if (!faction) return [];
  if (!Array.isArray(faction.records)) faction.records = [];
  return faction.records;
}
function recordProcesses(faction, processes, archive) {
  const records = ensureRecords(faction);
  let added = 0;
  for (const id of processes)
    if (!records.includes(id)) {
      records.push(id);
      added++;
    }
  if (added) records.sort();
  if (archive) faction.recordsArchive = archive.name;
  return added;
}
// Archives take down what the polity's living towns practise.
function recordFactionKnowledge() {
  for (const faction of W.factions) {
    const archives = factionArchives(faction);
    if (!archives.length) continue;
    const known = new Set();
    for (const s of W.settlements)
      if (!s.ruined && s.factionId === faction.id) for (const t of s.knownProcesses) known.add(t);
    recordProcesses(faction, known, archives[0]);
  }
}
function processRecorded(place, techId) {
  const faction = place?.factionId ? W.factions.find((f) => f.id === place.factionId) : null;
  return !!faction?.records?.includes(techId) && factionArchives(faction).length > 0;
}
// A ruined town's crafts survive in a surviving archive of its polity.
const ruinSettlementRecordsBase = ruinSettlement;
ruinSettlement = function (s, causes = [], evidence = "structural material failed") {
  const faction = s && !s.ruined ? W.factions.find((f) => f.id === s.factionId) : null,
    crafts = s?.knownProcesses?.slice() || [],
    ev = ruinSettlementRecordsBase(s, causes, evidence);
  if (faction && crafts.length) {
    const archives = factionArchives(faction).filter((a) => a !== s);
    if (archives.length) {
      recordProcesses(faction, crafts, archives[0]);
      if (ev) ev.evidence.push(`the archive of ${archives[0].name} holds the record of its crafts`);
    } else if (ev) ev.evidence.push("no archive of its people survives to hold the record");
  }
  return ev;
};
// A town recovers a recorded process it is ready for, one per polity per pass.
function recoverRecordedKnowledge() {
  const catalog = [...TECH_BASE, ...ADVANCED_TECH_BASE],
    recovered = [];
  for (const faction of W.factions) {
    const records = faction.records || [],
      archives = factionArchives(faction);
    if (!records.length || !archives.length) continue;
    const towns = W.settlements
      .filter((s) => !s.ruined && s.factionId === faction.id)
      .sort((a, b) => a.id - b.id);
    let done = false;
    for (const target of towns) {
      if (done || settlementPopulation(target) < 4 || target.stability < 0.2) continue;
      for (const id of records) {
        const tech = catalog.find((t) => t.id === id);
        if (
          !tech ||
          target.knownProcesses.includes(id) ||
          !(tech.prior || []).every((p) => target.knownProcesses.includes(p)) ||
          !(tech.materials || []).every((sp) => hasResearchMaterial(target, sp))
        )
          continue;
        const facility = facilityForTechnology(id);
        if (facility && !placeHasFacility(target, facility)) continue;
        const base = TECH_BASE.includes(tech),
          evidenceIds = [target.importantEvents.at(-1) || W.lastEventByType.TechAdvanceEvent || 1],
          temperature = base
            ? settlementTemperatureCapacity(target, tech, evidenceIds)
            : target.productionTemperature || 20;
        if (base && temperature < (tech.heat || 0)) continue;
        if (base && !(tech.structures || []).every((req) => settlementHasStructure(target, req)))
          continue;
        target.knownProcesses.push(id);
        target.researchProgress = target.researchProgress || {};
        delete target.researchProgress[id];
        const archive = archives[0],
          ev = emitEvent("KnowledgeRecoveredEvent", {
            subjects: [target.entityId, archive.entityId],
            location: idx(target.x, target.y),
            factions: [faction.id],
            causes: [W.lastEventByType.SettlementDestroyedEvent || 0].filter(Boolean),
            evidence: [
              `${tech.name} was read back from the records kept at ${archive.name}`,
              facility
                ? `${BUILDING_DEFS[facility].name} stood ready to practise it`
                : "the craft needed no special facility",
            ],
            importance: 3,
            data: { name: tech.name, process: id, settlement: target.name, archive: archive.name },
          });
        target.importantEvents.push(ev.id);
        W.technologies.push({
          id: W.technologies.length + 1,
          definitionId: id,
          settlementId: target.id,
          discovererId: 0,
          tick: W.tick,
          eventId: ev.id,
          temperature: Math.round(temperature),
          structure: [facility].filter(Boolean),
          transmittedFrom: archive.id,
          recovered: true,
        });
        ensurePlacePlans(target);
        recovered.push({ settlement: target.name, process: id });
        done = true;
        break;
      }
    }
  }
  return recovered;
}
const updateTechnologyRecordsBase = updateTechnology;
updateTechnology = function () {
  updateTechnologyRecordsBase();
  if (W.tick % RECORDS_CADENCE === 128) recordFactionKnowledge();
  if (W.tick % RECORDS_CADENCE === 64) recoverRecordedKnowledge();
};
// ── Chronicle and pages ────────────────────────────────────────────────────────
const eventSentenceRecordsBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "KnowledgeRecoveredEvent")
    return `${d.settlement} recovered ${d.name} from the records kept at ${d.archive}.`;
  return eventSentenceRecordsBase(e);
};
const renderFactionPageRecordsBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageRecordsBase(id),
    f = W.factions.find((x) => x.id === id);
  if (!f?.records?.length) return html;
  const archives = factionArchives(f),
    row = `<div class="kv"><span>Records</span><b>${f.records.length} process${f.records.length === 1 ? "" : "es"} archived${archives.length ? ` at ${esc(archives.map((s) => s.name).join(", "))}` : " · no archive stands to keep them"}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_RECORDS_DEBUG = Object.freeze({
  records: (factionId) => (W.factions.find((f) => f.id === factionId)?.records || []).slice(),
  archives: (factionId) =>
    factionArchives(W.factions.find((f) => f.id === factionId)).map((s) => s.name),
  recorded: (settlementId, techId) =>
    processRecorded(
      W.settlements.find((s) => s.id === settlementId),
      techId,
    ),
  update: () => recordFactionKnowledge(),
  recover: () => recoverRecordedKnowledge(),
});
