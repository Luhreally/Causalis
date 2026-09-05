// ═══════════════════════════════════════════════════════════════════════════
// 58. FESTIVALS AND ARTS — feasts, songs, tales, dances, and murals
// ═══════════════════════════════════════════════════════════════════════════
// Cultures had myths, rites, and artifacts but nothing sung between people.
// Now a town feasts once a year and after a triumph: real food leaves the
// store and is eaten, the town gathers at the hall or hearth, friendships
// deepen, and the people dance in their culture's way while songs are sung.
// Songs and tales are composed from the annals by a person with a gift for
// lore and spread to other peoples who hear them at a feast. Painters spend
// pigment on murals that show on the walls. Rendering only reads the world.
const FEAST_LENGTH = 96,
  FEAST_SHARE = 3,
  SONG_LIMIT = 16,
  DANCE_STYLES = Object.freeze(["ring", "line", "leaping", "stamping"]),
  MURAL_MOTIFS = Object.freeze(["waves", "spirals", "beasts", "hands", "suns"]),
  FEAST_OCCASIONS = Object.freeze({
    harvest: "the harvest",
    wedding: "the wedding",
    peace: "the peace",
    monument: "the new monument",
    naming: "the naming of the god",
    landing: "the landing across the water",
    union: "the union of the crowns",
    chosen: "the marking of a chosen one",
    feast: "the joy of the day",
  }),
  FEAST_TRIGGERS = Object.freeze({
    RoyalMarriageEvent: "wedding",
    WarEndedEvent: "peace",
    DivineTruceEvent: "peace",
    MonumentRaisedEvent: "monument",
    NamingEvent: "naming",
    ColonyEvent: "landing",
    DynasticUnionEvent: "union",
    ChosenEvent: "chosen",
  });
function ensureFestivals(world = W) {
  if (!world) return;
  world.festivals = world.festivals || {
    active: [],
    nextId: 1,
    lastEventId: 0,
    lastAnnalId: 0,
    held: 0,
  };
  for (const c of world.cultures || []) {
    c.songs = c.songs || [];
    if (c.songSeq == null) c.songSeq = 0;
  }
}
const restoreWorldFestivalsBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldFestivalsBase();
  ensureFestivals(W);
};
function danceStyle(culture) {
  return DANCE_STYLES[hashParts(W.seedHash, "dance", culture?.id || 0) % DANCE_STYLES.length];
}
function cultureOfPlace(place) {
  return (
    (place?.cultureId && W.cultures.find((c) => c.id === place.cultureId)) ||
    (place?.factionId &&
      W.cultures.find((c) => c.id === W.factions.find((f) => f.id === place.factionId)?.cultureId)) ||
    null
  );
}
function gatheringTile(place) {
  const b =
    completedBuildings(place, "hall")[0] ||
    completedBuildings(place, "shrine")[0] ||
    completedBuildings(place, "hearth")[0];
  return b ? idx(b.x, b.y) : idx(place.x, place.y);
}
function feastAttendees(place, limit = 14) {
  return entityAtRadius(idx(place.x, place.y), 8, KINDS.PERSON)
    .filter((id) => {
      const soc = W.components.social[id],
        life = W.components.life[id];
      return (
        classifyAlive(id) &&
        soc &&
        life &&
        (!place.factionId || soc.factionId === place.factionId) &&
        !W.components.campaign?.[id] &&
        !life.wounded
      );
    })
    .sort((a, b) => a - b)
    .slice(0, limit);
}
// ── Songs and tales ────────────────────────────────────────────────────────────
function songTitleFor(event) {
  const names = (event.subjects || []).map((id) => entityName(id)).filter(Boolean),
    d = event.data || {},
    f = (event.factions || []).map((id) => W.factions.find((x) => x.id === id)?.name || "a lost polity");
  switch (event.type) {
    case "WarStartedEvent":
      return { kind: "song", title: `The War Song of ${f[0]} and ${f[1]}` };
    case "WarEndedEvent":
      return { kind: "tale", title: `How the War of ${f[0]} and ${f[1]} Ended` };
    case "GriefEvent":
    case "DeathEvent":
      return names[0] ? { kind: "song", title: `The Lament for ${names[0]}` } : null;
    case "SettlementFoundedEvent":
      return { kind: "tale", title: `The Founding of ${d.name}` };
    case "SettlementDestroyedEvent":
      return { kind: "song", title: `The Fall of ${d.name}` };
    case "EruptionEvent":
    case "EarthquakeEvent":
    case "MeteorEvent":
    case "DisasterEvent":
    case "FireDisasterEvent":
      return { kind: "tale", title: `The Night of the ${titleCase(event.type.replace("Event", "").replace("Disaster", "Ruin"))}` };
    case "RoyalMarriageEvent":
      return { kind: "dance", title: `The Wedding Dance of ${d.a} and ${d.b}` };
    case "ColonyEvent":
      return { kind: "tale", title: `The Crossing to ${d.camp}` };
    case "NamingEvent":
      return { kind: "song", title: `The Hymn to ${d.name}` };
    case "ProphecyFulfilledEvent":
      return { kind: "tale", title: `The Words of the Speaker` };
    case "BeastOfLegendEvent":
      return { kind: "tale", title: `The Hunt of ${d.name}` };
    case "FeudEvent":
      return { kind: "song", title: `The Blood of ${d.houseA} and ${d.houseB}` };
    case "MonumentRaisedEvent":
      return { kind: "song", title: `The Raising of the ${d.name}` };
    case "ChosenEvent":
      return { kind: "song", title: `The Marking of ${d.name}` };
    case "DynasticUnionEvent":
      return { kind: "dance", title: `The Dance of the Two Crowns` };
    case "SuccessionEvent":
    case "LeadershipEvent":
      return names[0] ? { kind: "song", title: `The Rising of ${names[0]}` } : null;
    case "VassalageEvent":
      return { kind: "song", title: `The Bending of ${d.a}` };
    case "TreatyEvent":
      return { kind: "tale", title: `The Terms of ${d.a} and ${d.b}` };
    default:
      return names[0] ? { kind: "tale", title: `The Tale of ${names[0]}` } : null;
  }
}
function culturesConcerned(event) {
  const out = [];
  for (const fid of event.factions || []) {
    const c = W.cultures.find((x) => x.id === W.factions.find((f) => f.id === fid)?.cultureId);
    if (c && !out.includes(c)) out.push(c);
  }
  if (!out.length && event.location >= 0) {
    const s = nearestSettlement(event.location, 10),
      c = s ? cultureOfPlace(s) : null;
    if (c) out.push(c);
  }
  return out.slice(0, 2);
}
function composerFor(culture) {
  const candidates = [];
  for (const s of W.settlements) {
    if (s.ruined || s.cultureId !== culture.id) continue;
    for (const id of entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON))
      if (classifyAlive(id) && W.components.social[id]?.cultureId === culture.id) candidates.push(id);
  }
  candidates.sort((a, b) => {
    const ia = W.components.identity[a],
      ib = W.components.identity[b],
      la = (ia?.skills?.lore || 0) + (ia?.traits?.includes("curious") ? 8 : 0) + (ia?.traits?.includes("warm") ? 4 : 0),
      lb = (ib?.skills?.lore || 0) + (ib?.traits?.includes("curious") ? 8 : 0) + (ib?.traits?.includes("warm") ? 4 : 0);
    return lb - la || (ib?.significance || 0) - (ia?.significance || 0) || a - b;
  });
  return candidates[0] || 0;
}
function composeSong(culture, event, composerId = composerFor(culture)) {
  ensureFestivals();
  if (!culture || !event) return null;
  if (culture.songs.some((s) => s.eventId === event.id)) return null;
  const spec = songTitleFor(event);
  if (!spec || /undefined/.test(spec.title)) return null;
  const lang = languageOf(culture),
    r = makeRng(hashParts(W.seedHash, "song", culture.id, event.id), "song"),
    song = {
      id: ++culture.songSeq,
      title: spec.title,
      kind: spec.kind,
      name: lang.legacy ? "" : titleWord(langWord(lang, r, 2)),
      eventId: event.id,
      composerId,
      tick: W.tick,
      sung: 0,
      spreadTo: [],
      originCultureId: culture.id,
    };
  culture.songs.push(song);
  if (culture.songs.length > SONG_LIMIT) {
    const drop = culture.songs
      .slice(0, -4)
      .sort((a, b) => a.sung - b.sung || a.tick - b.tick)[0];
    culture.songs = culture.songs.filter((s) => s !== drop);
  }
  const home = W.settlements.find((s) => !s.ruined && s.cultureId === culture.id),
    p = composerId ? W.components.position[composerId] : null,
    ev = emitEvent("SongEvent", {
      subjects: [composerId, culture.entityId].filter(Boolean),
      location: p ? idx(p.x, p.y) : home ? idx(home.x, home.y) : event.location,
      factions: cultureFactions(culture).map((f) => f.id),
      causes: [event.id],
      evidence: [`made from ${event.type.replace("Event", "")}`, spec.kind],
      importance: 3,
      data: {
        title: song.title,
        name: song.name,
        kind: song.kind,
        culture: culture.name,
        composer: composerId ? entityName(composerId) : "",
      },
    });
  song.songEventId = ev.id;
  if (composerId) {
    const ident = W.components.identity[composerId];
    ident.significance += 2;
    ident.works = (ident.works || []).concat(`${culture.id}:${song.id}`).slice(-12);
    if (typeof grantSkill === "function") grantSkill(composerId, "lore", 4, ev.id);
    setEmotionImpulse(composerId, { contentment: 0.15 }, ev.id, "🎶");
  }
  return song;
}
function composeSongs() {
  ensureFestivals();
  const annals = W.annals || [];
  let since = W.festivals.lastAnnalId || 0,
    composed = 0;
  for (const a of annals) {
    if (a.id <= since) continue;
    since = Math.max(since, a.id);
    if (a.type === "SongEvent" || a.type === "FeastEvent" || a.type === "YearEvent" || a.importance < 4)
      continue;
    for (const culture of culturesConcerned(a)) {
      if (composed >= 3) break;
      if (counterRand("compose", a.id, culture.id) > 0.55) continue;
      if (composeSong(culture, a)) composed++;
    }
  }
  W.festivals.lastAnnalId = since;
}
function pickSongs(culture, n = 2) {
  const songs = culture?.songs || [];
  if (!songs.length) return [];
  const newest = songs[songs.length - 1],
    famous = songs.slice().sort((a, b) => b.sung - a.sung || a.tick - b.tick)[0],
    out = [newest];
  if (famous !== newest) out.push(famous);
  return out.slice(0, n);
}
function spreadSong(song, culture, place) {
  if (!culture || culture.id === song.originCultureId) return null;
  if (culture.songs.some((s) => s.eventId === song.eventId && s.title === song.title)) return null;
  culture.songs.push({ ...song, id: ++culture.songSeq, sung: 0, spreadTo: [], spreadFrom: song.originCultureId, tick: W.tick });
  if (culture.songs.length > SONG_LIMIT) culture.songs.shift();
  if (!song.spreadTo.includes(culture.id)) song.spreadTo.push(culture.id);
  return emitEvent("SongSpreadEvent", {
    subjects: [culture.entityId],
    location: place ? idx(place.x, place.y) : -1,
    factions: cultureFactions(culture).map((f) => f.id),
    causes: [song.songEventId].filter(Boolean),
    evidence: ["heard at a feast"],
    importance: 2,
    data: { title: song.title, culture: culture.name, place: place?.name || "" },
  });
}
// ── Feasts ─────────────────────────────────────────────────────────────────────
function holdFeast(place, occasion = "feast", cause = 0) {
  ensureFestivals();
  if (!place || place.ruined || !place.knownProcesses) return null;
  if (W.festivals.active.some((f) => f.active && f.placeId === place.id)) return null;
  const attendees = feastAttendees(place);
  if (attendees.length < 4) return null;
  if ((place.inventory?.[C.ORGANIC] || 0) < attendees.length * FEAST_SHARE + 8) return null;
  let eaten = 0;
  for (const id of attendees)
    eaten += resolveTransfer({
      fromType: "settlement",
      from: place.id,
      toType: "entity",
      to: id,
      amounts: [[C.ORGANIC, FEAST_SHARE]],
    });
  const culture = cultureOfPlace(place),
    tile = gatheringTile(place),
    [tx, ty] = xy(tile),
    songs = culture ? pickSongs(culture, 2) : [],
    feast = {
      id: W.festivals.nextId++,
      placeId: place.id,
      cultureId: culture?.id || 0,
      tile,
      occasion,
      attendees,
      startedTick: W.tick,
      endTick: W.tick + FEAST_LENGTH,
      songIds: songs.map((s) => s.id),
      active: true,
      eventId: 0,
    };
  W.festivals.active.push(feast);
  for (const id of attendees) issueCivilOrder(id, "festival", tx, ty, { festivalId: feast.id });
  for (const song of songs) song.sung++;
  place.stability = clamp((place.stability || 0) + 0.03, 0, 1);
  place.feasts = (place.feasts || 0) + 1;
  place.lastFeastTick = W.tick;
  const faction = W.factions.find((f) => f.id === place.factionId);
  if (faction) faction.cohesion = clamp(faction.cohesion + 0.01, 0.12, 1);
  for (const id of attendees) setEmotionImpulse(id, { contentment: 0.2, sadness: -0.1 }, 0, "🎶");
  // Those who feast together grow closer.
  for (let i = 0; i < attendees.length; i++)
    for (let j = i + 1; j < Math.min(attendees.length, i + 6); j++) {
      const a = attendees[i],
        b = attendees[j],
        ar = W.components.social[a].relationships?.[b],
        br = W.components.social[b].relationships?.[a];
      if (!ar || !br) continue;
      ar.familiarity = br.familiarity = clamp(Math.max(ar.familiarity, br.familiarity) + 0.05, 0, 1);
      ar.affection = clamp(ar.affection + 0.03, 0, 1);
      br.affection = clamp(br.affection + 0.03, 0, 1);
    }
  W.festivals.held++;
  const ev = emitEvent("FeastEvent", {
    subjects: [...attendees.slice(0, 3), place.entityId],
    location: tile,
    factions: place.factionId ? [place.factionId] : [],
    causes: [cause].filter(Boolean),
    evidence: [
      `${attendees.length} gathered`,
      `${eaten} units of food eaten`,
      songs.length ? `${songs.length} song${songs.length === 1 ? "" : "s"} sung` : "no songs yet",
    ],
    importance: occasion === "harvest" || occasion === "feast" ? 2 : 3,
    data: {
      place: place.name,
      occasion,
      attendees: attendees.length,
      eaten,
      songs: songs.map((s) => s.title),
      dance: culture ? danceStyle(culture) : "ring",
    },
  });
  feast.eventId = ev.id;
  if (songs.length && typeof grantSkill === "function") grantSkill(attendees[0], "lore", 2, ev.id);
  // Guests of other peoples carry the songs home.
  if (culture && songs.length)
    for (const id of entityAtRadius(tile, 6, KINDS.PERSON)) {
      const other = W.components.social[id]?.cultureId;
      if (!classifyAlive(id) || !other || other === culture.id) continue;
      const guestCulture = W.cultures.find((c) => c.id === other);
      for (const song of songs) spreadSong(song, guestCulture, place);
    }
  return feast;
}
function festivalPhase(culture) {
  return (hashParts(W.seedHash, "festival-day", culture?.id || 0) % 1000) / 1000;
}
function updateFestivals() {
  ensureFestivals();
  for (const feast of W.festivals.active) {
    if (!feast.active) continue;
    const place = W.settlements.find((s) => s.id === feast.placeId);
    if (W.tick >= feast.endTick || !place || place.ruined) {
      for (const id of feast.attendees) if (civilOrderOf(id)?.kind === "festival") clearCivilOrder(id);
      feast.active = false;
    }
  }
  if (W.festivals.active.length > 24)
    W.festivals.active = W.festivals.active
      .filter((f) => f.active)
      .concat(W.festivals.active.filter((f) => !f.active).slice(-8));
  // Triumphs call for a feast within the season.
  const since = W.festivals.lastEventId || 0,
    fresh = [];
  for (let n = W.events.length - 1; n >= 0; n--) {
    const e = W.events[n];
    if (e.id <= since) break;
    if (FEAST_TRIGGERS[e.type]) fresh.push(e);
  }
  if (W.events.length) W.festivals.lastEventId = W.events[W.events.length - 1].id;
  fresh.reverse();
  for (const e of fresh) {
    const place =
      (e.location >= 0 && nearestSettlement(e.location, 8)) ||
      W.settlements.find((s) => !s.ruined && s.id === W.factions.find((f) => f.id === e.factions?.[0])?.capitalSettlementId);
    if (place && W.tick - (place.lastFeastTick || -9999) > 128) holdFeast(place, FEAST_TRIGGERS[e.type], e.id);
  }
  // The harvest feast falls on each people's own day of the year.
  const phase = seasonPhase(W.tick);
  for (const place of W.settlements) {
    if (place.ruined || !place.knownProcesses) continue;
    const culture = cultureOfPlace(place);
    if (!culture) continue;
    const day = festivalPhase(culture),
      near = Math.abs(((phase - day + 1.5) % 1) - 0.5) < 32 / TICKS_PER_YEAR;
    if (near && W.tick - (place.lastFeastTick || -9999) > TICKS_PER_YEAR * 0.6)
      holdFeast(place, "harvest", W.lastEventByType.SeasonEvent || 0);
  }
}
// ── Murals ─────────────────────────────────────────────────────────────────────
function paintMurals() {
  ensureFestivals();
  for (const place of W.settlements) {
    if (place.ruined || (place.inventory?.[C.PIGMENT] || 0) < 3) continue;
    if (W.tick - (place.lastMuralTick || -9999) < 256) continue;
    if (counterRand("mural", place.id, Math.floor(W.tick / 256)) > 0.35) continue;
    paintMural(place);
  }
}
function paintMural(place) {
  const canvasBuilding = W.buildings
    .filter(
      (b) =>
        !b.ruined &&
        b.complete &&
        b.placeKind === "settlement" &&
        b.placeId === place.id &&
        !b.mural &&
        !OPEN_BUILDING_TYPES.has(b.type) &&
        b.type !== "dock",
    )
    .sort((a, b) => (b.type === "hall" ? 1 : 0) - (a.type === "hall" ? 1 : 0) || a.id - b.id)[0];
  if (!canvasBuilding) return null;
  const artist = entityAtRadius(idx(place.x, place.y), 8, KINDS.PERSON)
    .filter((id) => classifyAlive(id))
    .sort((a, b) => {
      const ia = W.components.identity[a],
        ib = W.components.identity[b];
      return (
        (ib?.skills?.craft || 0) + (ib?.traits?.includes("curious") ? 10 : 0) -
          (ia?.skills?.craft || 0) - (ia?.traits?.includes("curious") ? 10 : 0) || a - b
      );
    })[0];
  if (!artist) return null;
  const tile = idx(canvasBuilding.x, canvasBuilding.y),
    moved = resolveTransfer({
      fromType: "settlement",
      from: place.id,
      toType: "tile",
      to: tile,
      amounts: [[C.PIGMENT, 2]],
    });
  if (!moved) return null;
  const culture = cultureOfPlace(place),
    seed = hashParts(W.seedHash, "mural", canvasBuilding.id, W.tick),
    motif = MURAL_MOTIFS[hashParts(W.seedHash, "motif", culture?.id || 0, canvasBuilding.id) % MURAL_MOTIFS.length];
  canvasBuilding.mural = {
    seed,
    hue: (hashParts(W.seedHash, "mural-hue", culture?.id || place.id) % 360),
    motif,
    tick: W.tick,
    artistId: artist,
  };
  place.lastMuralTick = W.tick;
  const ident = W.components.identity[artist];
  ident.significance += 2;
  if (typeof grantSkill === "function") grantSkill(artist, "craft", 3);
  return emitEvent("MuralEvent", {
    subjects: [artist, place.entityId],
    location: tile,
    factions: place.factionId ? [place.factionId] : [],
    causes: [W.causalIndex.tile[tile] || 0].filter(Boolean),
    evidence: [`${moved} units of pigment spent`, motif],
    importance: 2,
    data: {
      artist: ident.generatedName,
      place: place.name,
      building: BUILDING_DEFS[canvasBuilding.type]?.name || canvasBuilding.type,
      motif,
    },
  });
}
// ── Tick hook ──────────────────────────────────────────────────────────────────
const updateWeatherCycleFestivalsBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleFestivalsBase();
  if (!W?.settlements || !W.cultures || !W.annals) return;
  ensureFestivals(W);
  if (W.tick % 32 === 14) updateFestivals();
  if (W.tick % 128 === 60) composeSongs();
  if (W.tick % 256 === 240) paintMurals();
};
const chooseBehaviorFestivalsBase = chooseBehavior;
chooseBehavior = function (id, tier) {
  chooseBehaviorFestivalsBase(id, tier);
  const l = W.components.life[id];
  if (l?.behavior === "march" && civilOrderOf(id)?.kind === "festival")
    l.behaviorReason = "feasting and dancing with the town";
};
// ── Chronicle sentences ────────────────────────────────────────────────────────
const eventSentenceFestivalsBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "FeastEvent":
      return `${d.place} feasted for ${FEAST_OCCASIONS[d.occasion] || "the joy of the day"}: ${d.attendees} gathered and ${d.eaten} units of food were eaten${
        d.songs?.length ? `, and '${d.songs[0]}' was sung` : ""
      }.`;
    case "SongEvent":
      return `${d.composer || "An unknown hand"} composed '${d.title}'${d.name ? ` (${d.name})` : ""}, a ${d.kind} of the ${d.culture}.`;
    case "SongSpreadEvent":
      return `'${d.title}' reached the ${d.culture}${d.place ? ` at ${d.place}` : ""}.`;
    case "MuralEvent":
      return `${d.artist} painted the walls of the ${d.building} in ${d.place} with ${d.motif}.`;
    default:
      return eventSentenceFestivalsBase(e);
  }
};
// ── Legends ────────────────────────────────────────────────────────────────────
function songRow(song, culture) {
  const composer = song.composerId ? lifeLink(song.composerId) : "";
  return `<div class="legend-row" data-legend="event:${song.eventId}"><span class="legend-year">Y${formatYear(song.tick)}</span><span><b>${esc(song.title)}</b>${
    song.name ? ` <span class="muted">(${esc(song.name)})</span>` : ""
  } · ${esc(song.kind)}${composer ? ` · by ${composer}` : ""}${song.sung ? ` · sung ${song.sung} time${song.sung === 1 ? "" : "s"}` : ""}${
    song.spreadFrom ? ` · learned from the ${esc(W.cultures.find((c) => c.id === song.spreadFrom)?.name || "old people")}` : ""
  }${song.spreadTo?.length ? ` · known to ${song.spreadTo.length} other people${song.spreadTo.length === 1 ? "" : "s"}` : ""}</span></div>`;
}
const renderCulturePageFestivalsBase = renderCulturePage;
renderCulturePage = function (id) {
  const html = renderCulturePageFestivalsBase(id),
    c = W.cultures.find((x) => x.id === id);
  if (!c) return html;
  ensureFestivals();
  const rows = c.songs
      .slice()
      .reverse()
      .map((s) => songRow(s, c)),
    block = `<div class="subhead">Songs and stories</div><div class="kv"><span>Dance</span><b>${esc(titleCase(danceStyle(c)))} dance</b></div>${
      rows.length ? `<div class="legend-timeline">${rows.join("")}</div>` : `<div class="empty">Nothing sung yet.</div>`
    }`,
    at = html.indexOf('<div class="subhead">Chronicle</div>');
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
const renderLifePageFestivalsBase = renderLifePage;
renderLifePage = function (id) {
  const html = renderLifePageFestivalsBase(id);
  ensureFestivals();
  const composed = [],
    about = [];
  for (const c of W.cultures)
    for (const s of c.songs || []) {
      if (s.composerId === id && !s.spreadFrom) composed.push([s, c]);
      const theme = eventById(s.eventId);
      if (theme?.subjects?.includes(id) && !s.spreadFrom) about.push([s, c]);
    }
  if (!composed.length && !about.length) return html;
  return `${html}${composed.length ? `<div class="subhead">Composed</div><div class="legend-timeline">${composed.map(([s, c]) => songRow(s, c)).join("")}</div>` : ""}${
    about.length ? `<div class="subhead">Sung of</div><div class="legend-timeline">${about.map(([s, c]) => songRow(s, c)).join("")}</div>` : ""
  }`;
};
const renderPlacePageFestivalsBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageFestivalsBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s || !s.feasts) return html;
  const murals = W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id && b.mural).length,
    block = `<div class="subhead">Festivals</div><div class="kv"><span>Feasts held</span><b>${s.feasts}${s.lastFeastTick != null ? ` · last Year ${formatYear(s.lastFeastTick)}` : ""}</b><span>Murals</span><b>${murals || "none"}</b></div>`,
    at = html.indexOf('<div class="subhead">Chronicle</div>');
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
const renderLegendIndexFestivalsBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const html = renderLegendIndexFestivalsBase(query),
    q = query.trim().toLowerCase(),
    songs = [];
  for (const c of W.cultures)
    for (const s of c.songs || []) if (!s.spreadFrom && (!q || s.title.toLowerCase().includes(q))) songs.push([s, c]);
  if (!songs.length) return html;
  songs.sort((a, b) => b[0].tick - a[0].tick || b[0].id - a[0].id);
  const cards = songs
    .slice(0, 6)
    .map(
      ([s, c]) =>
        `<div class="legend-card" data-legend="culture:${c.id}"><b>${esc(s.title)}</b><small>${esc(s.kind)} of the ${esc(c.name)} · Year ${formatYear(s.tick)}${s.sung ? ` · sung ${s.sung}×` : ""}</small></div>`,
    )
    .join("");
  return `${html}<div class="row between" style="margin-top:10px"><span class="subhead" style="margin:0">Songs and stories</span><span class="muted">${songs.length}</span></div><div class="legend-grid">${cards}</div>`;
};
// ── Drawing ────────────────────────────────────────────────────────────────────
// A feast lights a fire at the gathering, hangs lanterns around it, sends notes
// up, and the people who have arrived dance in their culture's way. Murals are
// a band of motifs on the facade.
let FESTIVAL_DANCE_FRAME = -1,
  FESTIVAL_DANCERS = new Map();
function festivalDancers(now) {
  if (FESTIVAL_DANCE_FRAME === now) return FESTIVAL_DANCERS;
  FESTIVAL_DANCE_FRAME = now;
  FESTIVAL_DANCERS = new Map();
  for (const feast of W?.festivals?.active || []) {
    if (!feast.active) continue;
    const [tx, ty] = xy(feast.tile),
      culture = W.cultures.find((c) => c.id === feast.cultureId),
      style = culture ? danceStyle(culture) : "ring";
    feast.attendees.forEach((id, index) => {
      const p = W.components.position[id];
      if (p && Math.max(Math.abs(p.x - tx), Math.abs(p.y - ty)) <= 2)
        FESTIVAL_DANCERS.set(id, { style, index, feast });
    });
  }
  return FESTIVAL_DANCERS;
}
const visualAnchorFestivalsBase = visualAnchor;
visualAnchor = function (id, p, m, now) {
  const e = visualAnchorFestivalsBase(id, p, m, now);
  if (!W?.festivals?.active?.length || ACTIVE_REDUCED_MOTION) return e;
  const d = festivalDancers(now).get(id);
  if (!d || !e?.s) return e;
  const r = clamp(m.tw * 0.3, 3, 40),
    t = now * 0.0025 + d.index * 0.9;
  let dx = 0,
    dy = 0;
  if (d.style === "ring") {
    dx = Math.cos(t) * r * 0.35;
    dy = Math.sin(t) * r * 0.18;
  } else if (d.style === "line") {
    dx = Math.sin(t * 1.3) * r * 0.4;
    dy = Math.abs(Math.sin(t * 2.6)) * -r * 0.08;
  } else if (d.style === "leaping") dy = -Math.abs(Math.sin(t * 2)) * r * 0.45;
  else {
    dx = (visualHash01(id, Math.floor(now / 120)) - 0.5) * r * 0.15;
    dy = -Math.abs(Math.sin(t * 3)) * r * 0.12;
  }
  return { ...e, s: { x: e.s.x + dx, y: e.s.y + dy } };
};
const drawWorkerActivityFestivalsBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivityFestivalsBase(now, bounds);
  if (UI.quality === "low" || !W.festivals?.active?.length) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    still = ACTIVE_REDUCED_MOTION;
  for (const feast of W.festivals.active) {
    if (!feast.active) continue;
    const [tx, ty] = xy(feast.tile);
    if (tx < bounds.x0 - 2 || tx > bounds.x1 + 2 || ty < bounds.y0 - 2 || ty > bounds.y1 + 2) continue;
    const s = proceduralProjectTile(tx + 0.5, ty + 0.5, m),
      r = clamp(m.tw * 0.45, 4, 50),
      flick = still ? 1 : 1 + Math.sin(now * 0.012 + feast.id) * 0.15;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(s.x, s.y - r * 0.4, 0, s.x, s.y - r * 0.4, r * 3 * flick);
    halo.addColorStop(0, hsl(34, 95, 60, 0.28));
    halo.addColorStop(0.5, hsl(24, 90, 50, 0.1));
    halo.addColorStop(1, hsl(18, 90, 40, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(s.x, s.y - r * 0.4, r * 3 * flick, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const [scale, lean, hue, alpha] of [
      [1, 0, 22, 0.85],
      [0.7, 0.25, 38, 0.9],
      [0.45, -0.2, 52, 0.95],
    ]) {
      const h = r * scale * flick;
      ctx.fillStyle = hsl(hue, 95, 60, alpha);
      ctx.beginPath();
      ctx.moveTo(s.x + lean * r * 0.3, s.y - h * 1.3);
      ctx.quadraticCurveTo(s.x + r * 0.35 * scale, s.y - h * 0.2, s.x, s.y + r * 0.2);
      ctx.quadraticCurveTo(s.x - r * 0.35 * scale, s.y - h * 0.2, s.x + lean * r * 0.3, s.y - h * 1.3);
      ctx.fill();
    }
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + 0.3,
        pulse = still ? 0.7 : 0.6 + 0.4 * Math.sin(now * 0.005 + k * 1.7 + feast.id);
      ctx.fillStyle = hsl(40, 90, 70, 0.55 * pulse);
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * r * 2.2, s.y - r * 0.9 + Math.sin(a) * r * 1.1, Math.max(1.2, r * 0.13), 0, Math.PI * 2);
      ctx.fill();
    }
    if (feast.songIds.length || true) {
      ctx.font = `${Math.max(9, Math.round(r * 0.7))}px "Segoe UI Symbol","Apple Symbols",sans-serif`;
      ctx.textAlign = "center";
      for (let k = 0; k < 4; k++) {
        const t = still ? 0.3 + k * 0.15 : ((now * 0.0004 + k * 0.25 + feast.id * 0.13) % 1);
        ctx.fillStyle = hsl(v.accentHue, 70, 80, (1 - t) * 0.8);
        ctx.fillText(k % 2 ? "♫" : "♪", s.x + Math.sin(t * 6 + k) * r * 1.4, s.y - r * 1.4 - t * r * 3);
      }
    }
  }
};
const drawBuildingExteriorDetailsFestivalsBase = drawBuildingExteriorDetails;
drawBuildingExteriorDetails = function (g, b, now, m) {
  drawBuildingExteriorDetailsFestivalsBase(g, b, now, m);
  if (!b.mural || !b.complete || b.ruined || UI.camera.zoom < 2.1) return;
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
    r = buildingScreenSize(b, m),
    mural = b.mural,
    hue = mural.hue,
    y = s.y + r * 0.02,
    w = r * 0.7,
    n = 5;
  g.save();
  g.strokeStyle = hsl(hue, 70, 62, 0.9);
  g.fillStyle = hsl((hue + 150) % 360, 60, 65, 0.85);
  g.lineWidth = Math.max(1, r * 0.05);
  for (let k = 0; k < n; k++) {
    const x = s.x - w + ((2 * w) / (n - 1)) * k,
      size = r * 0.09;
    g.beginPath();
    if (mural.motif === "waves") {
      g.moveTo(x - size, y);
      g.quadraticCurveTo(x - size * 0.5, y - size, x, y);
      g.quadraticCurveTo(x + size * 0.5, y + size, x + size, y);
      g.stroke();
    } else if (mural.motif === "spirals") {
      g.arc(x, y, size, 0, Math.PI * 1.5);
      g.stroke();
    } else if (mural.motif === "beasts") {
      g.moveTo(x - size, y + size * 0.6);
      g.lineTo(x, y - size);
      g.lineTo(x + size, y + size * 0.6);
      g.closePath();
      g.fill();
    } else if (mural.motif === "hands") {
      for (let f = -2; f <= 2; f++) {
        g.moveTo(x, y + size * 0.6);
        g.lineTo(x + f * size * 0.35, y - size * 0.8);
      }
      g.stroke();
    } else {
      g.arc(x, y, size * 0.6, 0, Math.PI * 2);
      g.fill();
      for (let ray = 0; ray < 6; ray++) {
        const a = (ray * Math.PI) / 3;
        g.moveTo(x + Math.cos(a) * size * 0.8, y + Math.sin(a) * size * 0.8);
        g.lineTo(x + Math.cos(a) * size * 1.3, y + Math.sin(a) * size * 1.3);
      }
      g.stroke();
    }
  }
  g.restore();
};
window.ALIFE_FESTIVAL_DEBUG = Object.freeze({
  feast: (settlementId, occasion = "feast") =>
    holdFeast(
      W.settlements.find((s) => s.id === settlementId),
      occasion,
    ),
  festivals: () => (W.festivals?.active || []).map((f) => ({ ...f, attendees: f.attendees.slice() })),
  tick: () => updateFestivals(),
  compose: (annalId, cultureId) =>
    composeSong(
      W.cultures.find((c) => c.id === cultureId),
      eventById(annalId),
    ),
  composeAll: () => {
    composeSongs();
    return W.cultures.reduce((n, c) => n + (c.songs?.length || 0), 0);
  },
  songs: (cultureId) => (W.cultures.find((c) => c.id === cultureId)?.songs || []).map((s) => ({ ...s })),
  spread: (cultureId, song, settlementId) =>
    spreadSong(
      song,
      W.cultures.find((c) => c.id === cultureId),
      W.settlements.find((s) => s.id === settlementId),
    ),
  mural: (settlementId) => paintMural(W.settlements.find((s) => s.id === settlementId)),
  dance: (cultureId) => danceStyle(W.cultures.find((c) => c.id === cultureId)),
  dancers: (now = 1) => festivalDancers(now).size,
  gathering: (settlementId) => gatheringTile(W.settlements.find((s) => s.id === settlementId)),
});
