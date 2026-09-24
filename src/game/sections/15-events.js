// ═══════════════════════════════════════════════════════════════════════════
// 15. EVENT BUS AND CAUSAL JOURNAL
// ═══════════════════════════════════════════════════════════════════════════
function emitEvent(type, data = {}) {
  const id = W.nextEventId++,
    location = data.location ?? -1,
    military =
      (type === "KillEvent" || type === "InjuryEvent") &&
      ((data.factions || []).length || data.data?.military),
    ev = {
      id,
      tick: W.tick,
      year: formatYear(),
      epoch: epochName(),
      type,
      category: military ? "war" : EVENT_CATEGORY[type] || "ecology",
      subjects: data.subjects || [],
      location,
      factions: data.factions || [],
      causes: Array.from(new Set((data.causes || []).filter((x) => x && x < id))).slice(0, 6),
      evidence: data.evidence || [],
      magnitude: data.magnitude ?? 1,
      importance: data.importance ?? 1,
      data: data.data || {},
    };
  W.events.push(ev);
  W.lastEventByType[type] = id;
  if (location >= 0) W.causalIndex.tile[location] = id;
  for (const s of ev.subjects) W.causalIndex.entity[s] = id;
  W.causalIndex.domain[ev.category] = id;
  // Compression walks the whole world for live references, so trim in larger batches.
  if (W.events.length > MAX_EVENTS + 384) compressEvents(W.events.length - MAX_EVENTS + 256);
  return ev;
}
// Whether a key of the world names an event id. Asked once for every key of
// every object in W on each compaction, so the answer is kept; a key that is a
// number (the component stores are keyed by entity id) never names one.
const EVENT_REFERENCE_KEYS = new Map();
function eventReferenceKey(key) {
  const first = key.charCodeAt(0);
  if (first >= 48 && first <= 57) return false;
  let named = EVENT_REFERENCE_KEYS.get(key);
  if (named === undefined) {
    if (EVENT_REFERENCE_KEYS.size > 4096) EVENT_REFERENCE_KEYS.clear();
    named =
      /event/i.test(key) ||
      ["cycleCause", "genesisId", "colonyId", "multiId", "radId"].includes(key);
    EVENT_REFERENCE_KEYS.set(key, named);
  }
  return named;
}
function eventReferenceIds() {
  const active = new Set(W.events.map((e) => e.id)),
    referenced = new Set();
  for (const event of W.events)
    for (const id of event.causes || []) if (active.has(id)) referenced.add(id);
  const seen = new WeakSet(),
    referenceKey = eventReferenceKey,
    scan = (value, key = "", forced = false) => {
      if (typeof value === "number") {
        if ((forced || referenceKey(key)) && Number.isSafeInteger(value) && active.has(value))
          referenced.add(value);
        return;
      }
      if (
        !value ||
        typeof value !== "object" ||
        ArrayBuffer.isView(value) ||
        value === W.events ||
        value === W.eventTombstones ||
        seen.has(value)
      )
        return;
      seen.add(value);
      const nextForced =
        forced || referenceKey(key) || key === "lastEventByType" || key === "causalIndex";
      if (Array.isArray(value)) {
        for (const item of value) scan(item, "", nextForced);
        return;
      }
      for (const childKey of Object.keys(value)) scan(value[childKey], childKey, nextForced);
    };
  scan(W);
  return referenced;
}
function recordEventTombstone(event) {
  const prior = W.eventTombstones;
  if (prior) {
    prior.firstId = Math.min(prior.firstId, event.id);
    prior.lastId = Math.max(prior.lastId, event.id);
    prior.firstTick = Math.min(prior.firstTick, event.tick);
    prior.lastTick = Math.max(prior.lastTick, event.tick);
    prior.count++;
  } else
    W.eventTombstones = {
      firstId: event.id,
      lastId: event.id,
      firstTick: event.tick,
      lastTick: event.tick,
      count: 1,
    };
}
function summarizeCompressedEvent(event) {
  W.worldSummary.push({ tick: event.tick, category: event.category, count: 1 });
  if (W.worldSummary.length > 300) W.worldSummary.shift();
}
// Trim `amount` events: first the minor ones nothing points to, then any that
// nothing points to, then the oldest, which leave a tombstone. The order is the
// one a find-and-splice per event gave; choosing all of them in three passes
// and closing the gaps once took a compaction from 80 ms to under 20.
function compressEvents(amount = 1) {
  const events = W.events,
    n = events.length;
  if (!n) return null;
  const referenced = eventReferenceIds(),
    removed = new Uint8Array(n),
    order = [];
  for (let i = 0; i < n && order.length < amount; i++)
    if (events[i].importance < 2 && !referenced.has(events[i].id)) {
      order.push(i);
      removed[i] = 1;
    }
  for (let i = 0; i < n && order.length < amount; i++)
    if (!removed[i] && !referenced.has(events[i].id)) {
      order.push(i);
      removed[i] = 1;
    }
  const tombstonesFrom = order.length;
  for (let i = 0; i < n && order.length < amount; i++)
    if (!removed[i]) {
      order.push(i);
      removed[i] = 1;
    }
  for (let k = 0; k < order.length; k++) {
    const event = events[order[k]];
    if (k >= tombstonesFrom) recordEventTombstone(event);
    summarizeCompressedEvent(event);
  }
  const first = order.length ? events[order[0]] : null;
  let kept = 0;
  for (let i = 0; i < n; i++) if (!removed[i]) events[kept++] = events[i];
  events.length = kept;
  return first;
}
function lastCauseForTile(i, types = null) {
  for (let n = W.events.length - 1; n >= 0; n--) {
    const e = W.events[n];
    if (e.location === i && (!types || types.includes(e.type))) return e.id;
  }
  return 0;
}
// The log is in id order: emitEvent appends the next id and compaction only
// removes, so an event is found by halving, not by reading from the start
// (152's talk asks for the news it retells hundreds of times a pass).
function eventById(id) {
  const events = W.events;
  let low = 0,
    high = events.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1,
      at = events[mid].id;
    if (at === id) return events[mid];
    if (at < id) low = mid + 1;
    else high = mid - 1;
  }
  // A log read from an old save could be out of order; look the long way.
  const live = events.find((e) => e.id === id);
  if (live) return live;
  const range = W.eventTombstones;
  if (!range || id < range.firstId || id > range.lastId) return undefined;
  const span = Math.max(1, range.lastId - range.firstId),
    tick = Math.round(
      range.firstTick + ((range.lastTick - range.firstTick) * (id - range.firstId)) / span,
    );
  return {
    id,
    tick,
    year: Math.floor(tick / TICKS_PER_YEAR),
    epoch: "Archived",
    type: "ArchivedEvent",
    category: "history",
    subjects: [],
    location: -1,
    factions: [],
    causes: [],
    evidence: ["The detailed record was compacted while its referenced causal ID was retained."],
    magnitude: 1,
    importance: 1,
    data: { tombstone: true },
  };
}
function debugEventRetentionProbe() {
  const prior = W,
    event = (id, importance = 1) => ({
      id,
      tick: id,
      year: 0,
      epoch: "Genesis",
      type: "TestEvent",
      category: "ecology",
      subjects: [],
      location: -1,
      factions: [],
      causes: [],
      evidence: [],
      magnitude: 1,
      importance,
      data: {},
    });
  try {
    W = {
      events: [event(1), event(2), event(3), event(4), event(5)],
      lastEventByType: { Pinned: 1 },
      causalIndex: { tile: { 0: 2 }, entity: {}, domain: {} },
      components: {
        memory: { 1: { rememberedEvents: [3], ring: [{ eventId: 4 }] } },
        identity: {},
      },
      settlements: [],
      worldSummary: [],
    };
    const first = compressEvents(),
      retained = [1, 2, 3, 4].every((id) => !!eventById(id)),
      unreferencedRemoved = first?.id === 5 && !eventById(5);
    W = {
      events: [event(1), event(2), event(3)],
      lastEventByType: { A: 1, B: 2, C: 3 },
      causalIndex: { tile: {}, entity: {}, domain: {} },
      components: {},
      worldSummary: [],
    };
    const tombstonedFirst = compressEvents(),
      firstLookup = eventById(1),
      tombstonedSecond = compressEvents(),
      secondLookup = eventById(2),
      boundedRange =
        W.eventTombstones?.firstId === 1 &&
        W.eventTombstones?.lastId === 2 &&
        W.eventTombstones?.count === 2,
      tombstones = { ...W.eventTombstones },
      remaining = W.events.map((e) => e.id);
    W = {
      nextEventId: 1,
      tick: 0,
      events: [],
      lastEventByType: {},
      causalIndex: { tile: {}, entity: {}, domain: {} },
      worldSummary: [],
    };
    const militaryCategory =
      emitEvent("InjuryEvent", { factions: [7], data: { military: true } }).category === "war";
    return {
      ok:
        retained &&
        unreferencedRemoved &&
        tombstonedFirst?.id === 1 &&
        tombstonedSecond?.id === 2 &&
        firstLookup?.data?.tombstone &&
        secondLookup?.data?.tombstone &&
        boundedRange &&
        militaryCategory,
      retained,
      unreferencedRemoved,
      militaryCategory,
      tombstones,
      remaining,
    };
  } finally {
    W = prior;
  }
}
function entityName(id) {
  return (
    W.components.identity[id]?.generatedName ||
    W.historicalIdentities[id]?.name ||
    W.settlements.find((s) => s.entityId === id)?.name ||
    W.factions.find((f) => f.entityId === id)?.name ||
    W.cultures.find((c) => c.entityId === id)?.name ||
    W.artifacts.find((a) => a.entityId === id)?.name ||
    `Entity ${id}`
  );
}
function locationName(i) {
  if (i < 0) return "the wider world";
  const s = nearestSettlement(i, 3);
  if (s) return s.name;
  const [x, y] = xy(i),
    feature = featureNameAt(i);
  return `${(feature || biomeAt(i)).toLowerCase()} at ${x},${y}`;
}
// ── What an event says ──────────────────────────────────────────────────────
// A section tells its own events: eventText(types, function (e, next) {...})
// returns the sentence for an event of one of those types, or next(e) to leave
// it to whoever told that type before (and last to the core sentences below).
// The chronicle reads one sentence per event through eventSentence(e); a type
// no section tells falls to the core. Tellers of a type are asked newest first.
const EVENT_TEXT = new Map();
function eventText(types, tell) {
  for (const type of types) {
    const before = EVENT_TEXT.get(type) || eventSentenceCore;
    EVENT_TEXT.set(type, (e) => tell(e, before));
  }
}
function eventSentence(e) {
  const tell = EVENT_TEXT.get(e.type);
  return tell ? tell(e) : eventSentenceCore(e);
}
function eventSentenceCore(e) {
  const names = e.subjects.map(entityName),
    loc = locationName(e.location),
    f = e.factions.map((id) => W.factions.find((x) => x.id === id)?.name || `Faction ${id}`);
  switch (e.type) {
    case "AbiogenesisEvent":
      return names[0]
        ? `${names[0]} arose as a bounded, self-maintaining chemical network in ${loc}.`
        : `Life crossed the threshold of bounded replication in ${loc}.`;
    case "BirthEvent":
      return `${names[0] || "An organism"} was born in ${loc}.`;
    case "DeathEvent":
      return `${names[0] || fmt(e.magnitude) + " lives"} died in ${loc}${e.evidence[0] ? ` from ${e.evidence[0]}` : ""}.`;
    case "KillEvent":
      return `${names[0]} killed ${names[1]} in ${loc}.`;
    case "InjuryEvent":
      return `${names[0]} was injured${names[1] ? ` by ${names[1]}` : ""} in ${loc}.`;
    case "InfectionEvent":
      return `${names[0]} became host to a replicating pathogen in ${loc}.`;
    case "DiseaseOutbreakEvent":
      return `A chemical pathogen outbreak spread through ${loc}.`;
    case "FireStartedEvent":
      return `Combustion began in ${loc}${e.evidence[0] ? ` when ${e.evidence[0]}` : ""}.`;
    case "FireDisasterEvent":
      return `A major fire consumed stored chemical energy across ${loc}.`;
    case "RainEvent":
      return `Rain transferred solvent across ${loc}.`;
    case "DroughtEvent":
      return `Drought concentrated dissolved compounds across ${loc}.`;
    case "MigrationEvent":
      return `${names[0] || fmt(e.magnitude) + " lives"} migrated from chemical scarcity toward ${loc}.`;
    case "MutationEvent":
      return `${names[0] || "A lineage"} inherited a changed information polymer in ${loc}.`;
    case "AdaptationEvent":
      return `The ${e.data.species || "local"} lineage adapted to ${e.evidence[0] || "its chemical environment"}.`;
    case "SpeciesDivergenceEvent":
      return `The ${e.data.species || "new"} lineage diverged in ${loc}.`;
    case "ExtinctionEvent":
      return `The ${e.data.species || "recorded"} lineage vanished from the living world.`;
    case "CampFoundedEvent":
      return `${names[0]} founded ${e.data.name || "a camp"} in ${loc}.`;
    case "CampAbandonedEvent":
      return `${e.data.name || "A camp"} was abandoned after ${e.evidence[0] || "local conditions failed"}.`;
    case "SettlementFoundedEvent":
      return `${names[0]} founded ${e.data.name} in ${loc}.`;
    case "SettlementDestroyedEvent":
      return `${e.data.name} became a ruin because ${e.evidence[0] || "its structure failed"}.`;
    case "FactionFoundedEvent":
      return `${e.data.name} formed around ${loc}.`;
    case "AllianceEvent":
      return `${f[0]} and ${f[1]} formed an alliance after sustained exchange.`;
    case "WarTensionEvent":
      return `Tension rose between ${f[0]} and ${f[1]} because ${e.evidence.join(", ")}.`;
    case "WarStartedEvent":
      return `${f[0]} entered war with ${f[1]} after ${e.evidence.join(", ")}.`;
    case "WarEndedEvent":
      return `${f[0]} and ${f[1]} ended their war after ${e.evidence[0] || "exhaustion"}.`;
    case "TechAdvanceEvent":
      return `${names[0] || e.data.settlement || "A settlement"} made ${e.data.name} reproducible from local matter.`;
    case "ArtifactCreatedEvent":
      return `${names[0]} created ${e.data.name} from ${e.data.material}.`;
    case "NotableFigureEvent":
      return `${names[0]} became known as ${e.data.title}.`;
    case "LeadershipEvent":
      return `${names[0]} became a leader of ${f[0]}.`;
    case "DisasterEvent":
      return `${e.data.name || "A disaster"} altered matter and life in ${loc}.`;
    case "InterventionEvent":
      return `An outside intervention—${e.data.tool}—entered history at ${loc}.`;
    case "ChemistryEvent":
      return `${e.data.text || "A consequential chemical transformation occurred"} in ${loc}.`;
    default:
      return `${titleCase(e.type)} occurred in ${loc}.`;
  }
}
eventText(
  [
    "ConstructionStartedEvent",
    "BuildingCompletedEvent",
    "ToolCraftedEvent",
    "StageAdvanceEvent",
    "PolicyChangedEvent",
    "BuildingCollapsedEvent",
  ],
  function (e, next) {
    const names = e.subjects.map(entityName),
      loc = locationName(e.location);
    switch (e.type) {
      case "ConstructionStartedEvent":
        return `${names[0] || e.data.place || "A community"} marked a ${e.data.name || "structure"} blueprint in ${loc}; its matter still had to be gathered.`;
      case "BuildingCompletedEvent":
        return `${e.data.place || names[0] || "A community"} completed ${e.data.name || "a structure"} through delivered material and visible labor.`;
      case "ToolCraftedEvent":
        return `${names[0] || "A worker"} crafted ${e.data.name || "a functional tool"} for ${e.data.purpose || "work"} from local compounds.`;
      case "StageAdvanceEvent":
        return `Life advanced from ${titleCase(e.data.prior || "an earlier stage")} to ${titleCase(e.data.stage || e.data.name || "a new stage")}.`;
      case "PolicyChangedEvent":
        return `${e.data.place || names[0] || "A community"} adopted the directive “${e.data.name || e.evidence[0]}”.`;
      case "BuildingCollapsedEvent":
        return `${e.data.name || "A structure"} collapsed in ${loc} after ${e.evidence[0] || "its integrity failed"}.`;
      default:
        return next(e);
    }
  },
);
