// ═══════════════════════════════════════════════════════════════════════════
// 60. LORE — a person's story, readable where you click them
// ═══════════════════════════════════════════════════════════════════════════
// Selecting a person used to show measurements and a button into Legends. Now
// the inspector opens with their story in prose, written from the world state:
// who they are and what they want, who they love and who they are drawn to,
// affairs and betrayals, friends, rivals, quarrels, grudges, vows of revenge,
// the feud of their house, whom they mourn, their deeds, songs made and sung of
// them, where they are bound right now, and the last things the chronicle says
// about them. Every name inspects that person; a button opens the full page in
// Legends. Nothing here writes the world.
function loreName(id) {
  return entityLink(id) || esc(entityName(id) || "someone");
}
function loreYear(tick) {
  return `Year ${formatYear(tick)}`;
}
function loreList(ids, limit = 4) {
  const names = ids.slice(0, limit).map(loreName),
    more = ids.length - names.length;
  if (!names.length) return "";
  if (names.length === 1) return names[0] + (more > 0 ? ` and ${more} more` : "");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}${more > 0 ? ` and ${more} more` : ""}`;
}
function loreJoin(words) {
  if (!words.length) return "";
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
function loreOrderPhrase(order) {
  switch (order?.kind) {
    case "envoy":
      return "away carrying terms to another polity";
    case "caravan":
      return "walking the trade road with a caravan";
    case "voyage":
      return "at sea, sailing for a far shore";
    case "fish":
      return "out fishing from the town's boat";
    case "festival":
      return "at the feast, dancing";
    case "wedding":
      return "travelling to be wed across the border";
    case "journey":
      return "on a journey to see what lies beyond the horizon";
    case "exile":
      return "leaving under sentence of exile";
    case "captive":
      return "being led away as a captive";
    default:
      return "";
  }
}
function loreSongs(id) {
  const composed = [],
    about = [];
  for (const c of W.cultures)
    for (const s of c.songs || []) {
      if (s.spreadFrom) continue;
      if (s.composerId === id) composed.push(s);
      else {
        const theme = eventById(s.eventId);
        if (theme?.subjects?.includes(id)) about.push(s);
      }
    }
  return { composed, about };
}
function personStory(id) {
  const ident = W.components.identity[id],
    soc = W.components.social[id],
    life = W.components.life[id];
  if (!ident || !soc || !life || W.kind[id] !== KINDS.PERSON) return "";
  const alive = classifyAlive(id),
    age = (life.age / TICKS_PER_YEAR).toFixed(1),
    house = typeof houseName === "function" ? houseName(soc.kinGroupId, id) : "",
    culture = soc.cultureId ? W.cultures.find((c) => c.id === soc.cultureId) : null,
    faction = soc.factionId ? W.factions.find((f) => f.id === soc.factionId) : null,
    home =
      soc.homePlaceKind === "settlement"
        ? W.settlements.find((s) => s.id === soc.homePlaceId)
        : soc.homePlaceKind === "camp"
          ? W.camps.find((c) => c.id === soc.homePlaceId)
          : null,
    adult = typeof isAdultPerson === "function" ? isAdultPerson(id) : true,
    rels = soc.relationships || {},
    isPerson = (x) => W.kind[x] === KINDS.PERSON && classifyAlive(x),
    paras = [];
  // Who they are.
  const titles = (ident.titles || []).filter((t) => t && t !== "Polity"),
    traits = (ident.traits || []).map((t) => (TRAIT_DEFS[t]?.[0] || t).toLowerCase());
  let who = `<b>${esc(ident.generatedName)}</b>${house ? ` of the house of ${esc(house)}` : ""} is ${age} years old${adult ? "" : ", still young"}${
    titles.length ? `, ${esc(titles.slice(0, 3).join(", "))}` : ""
  }.`;
  if (traits.length) {
    const phrase = loreJoin(traits);
    who += ` ${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} by nature.`;
  }
  if (culture || faction || home)
    who += ` One of the ${culture ? esc(culture.name) : "unnamed people"}${
      faction ? `, living under ${legendLink("faction", faction.id, faction.name)}` : ""
    }${home ? ` at ${esc(home.name)}` : ""}.`;
  if (ident.want)
    who += ` Right now they want ${esc(WANT_DEFS[ident.want.id]?.[0] || ident.want.id)}, and have since ${loreYear(ident.want.since)}.`;
  else if (ident.fulfilled?.length)
    who += ` They are content for now; last they ${esc(WANT_DEFS[ident.fulfilled[ident.fulfilled.length - 1]]?.[1] || "got what they wanted")}.`;
  paras.push(who);
  // The heart.
  const partner = soc.partnerId && isPerson(soc.partnerId) ? soc.partnerId : 0;
  let heart = "";
  if (partner) {
    const r = rels[partner],
      since = relationsOf(id, "partner_of").find((e) => e.to === partner)?.createdTick;
    heart += `They are partnered with ${loreName(partner)}${since != null ? ` since ${loreYear(since)}` : ""}${
      r
        ? r.commitment > 0.7
          ? "; the bond is strong"
          : r.commitment < 0.4
            ? "; the bond is strained"
            : ""
        : ""
    }.`;
  } else if (adult) {
    let best = 0,
      bestV = 0.35;
    for (const key in rels) {
      const other = +key,
        r = rels[key];
      if (!isPerson(other) || W.components.social[other]?.kinGroupId === soc.kinGroupId) continue;
      if (r.attraction > bestV) {
        bestV = r.attraction;
        best = other;
      }
    }
    heart += best
      ? `They have no partner but are drawn to ${loreName(best)}.`
      : `They have no partner and no one has caught their eye.`;
  }
  const affairs = (soc.affairs || []).filter((a) => !a.endedTick && isPerson(a.otherId));
  for (const a of affairs.slice(0, 2))
    heart += ` They keep ${a.discovered ? "an affair, now discovered," : "a secret affair"} with ${loreName(a.otherId)}.`;
  const betrayers = (soc.betrayedBy || []).filter(isPerson);
  if (betrayers.length) heart += ` They were betrayed by ${loreList(betrayers, 2)}.`;
  if ((soc.emotion?.jealousy || 0) > 0.5) heart += " Jealousy burns in them.";
  const parents = (ident.parents || []).filter(
      (x) => W.components.identity[x] || W.historicalIdentities?.[x],
    ),
    kids = (ident.children || []).filter(isPerson);
  if (parents.length) heart += ` Child of ${loreList(parents, 2)}.`;
  if (kids.length) heart += ` Parent of ${loreList(kids, 4)}.`;
  if (heart) paras.push(heart);
  // Friends, rivals, quarrels, grudges, feuds, grief.
  const bonds = soc.bonds || { friends: [], rivals: [], foes: [] },
    friends = bonds.friends.filter(isPerson),
    rivals = bonds.rivals.filter(isPerson);
  let strife = "";
  if (friends.length) strife += `Fast friends with ${loreList(friends, 4)}.`;
  for (const r of rivals.slice(0, 3)) {
    const rel = rels[r],
      ev = rel?.lastEventId ? eventById(rel.lastEventId) : null,
      cause = ev?.type === "RivalryEvent" ? ev.data?.cause : "";
    strife += ` Rival of ${loreName(r)}${cause ? ` over ${esc(cause)}` : ""}.`;
  }
  const quarrels = legendEvents((e) => e.type === "QuarrelEvent" && e.subjects?.includes(id));
  if (quarrels.length) {
    const last = quarrels[quarrels.length - 1],
      other = (last.subjects || []).find((x) => x !== id);
    strife += ` ${quarrels.length === 1 ? "One quarrel" : `${quarrels.length} quarrels`} on record, the last with ${
      other ? loreName(other) : "a stranger"
    } in ${loreYear(last.tick)}${last.data?.brawl ? ", when blows were struck" : ""}.`;
  }
  const grudges = Object.entries(rels)
    .filter(([k, r]) => r.grievance > 0.4 && isPerson(+k) && !rivals.includes(+k))
    .sort((a, b) => b[1].grievance - a[1].grievance)
    .slice(0, 2)
    .map(([k]) => +k);
  if (grudges.length) strife += ` Holds a grudge against ${loreList(grudges, 2)}.`;
  if (soc.revengeTargetId && isPerson(soc.revengeTargetId))
    strife += ` Has sworn revenge on ${loreName(soc.revengeTargetId)}.`;
  const feuds = typeof houseFeuds === "function" ? houseFeuds(soc.kinGroupId) : [];
  for (const f of feuds.slice(0, 2))
    strife += ` Their house feuds with the house of ${esc(f.a === soc.kinGroupId ? f.names[1] : f.names[0])} (${legendLink(
      "feud",
      f.id,
      typeof feudHeatWord === "function" ? feudHeatWord(f) : "feud",
    )}, ${f.deaths} dead).`;
  const mourned = (W.components.memory[id]?.kinDeaths || []).slice(-3);
  if (mourned.length)
    strife += ` Mourns ${mourned.map((k) => `${loreName(k.id)} (${loreYear(k.tick)})`).join(", ")}.`;
  if (strife) paras.push(strife);
  // Deeds and works.
  const deeds = [];
  if (ident.kills) deeds.push(countNoun(ident.kills, "kill"));
  if (ident.battles) deeds.push(countNoun(ident.battles, "battle"));
  if (ident.injuries) deeds.push(countNoun(ident.injuries, "wound"));
  if (ident.disastersSurvived) deeds.push(`${ident.disastersSurvived} disasters survived`);
  if (ident.crimes) deeds.push(countNoun(ident.crimes, "theft"));
  let works = deeds.length ? `${loreJoin(deeds)} to their name.` : "";
  const founded = (ident.settlementsFounded || []).map((x) => entityName(x)).filter(Boolean);
  if (founded.length) works += ` Founded ${esc(founded.slice(0, 3).join(", "))}.`;
  const made = (ident.artifacts || []).map((x) => entityName(x)).filter(Boolean);
  if (made.length)
    works += ` Made ${esc(made.slice(0, 3).join(", "))}${made.length > 3 ? ` and ${made.length - 3} more` : ""}.`;
  const songs = loreSongs(id);
  if (songs.composed.length)
    works += ` Composed ${songs.composed
      .slice(0, 2)
      .map((s) => `'${esc(s.title)}'`)
      .join(" and ")}.`;
  if (songs.about.length)
    works += ` Sung of in ${songs.about
      .slice(0, 2)
      .map((s) => `'${esc(s.title)}'`)
      .join(" and ")}.`;
  if (ident.chosen)
    works += ` Marked as Chosen of ${esc(ident.chosen.god)} in ${loreYear(ident.chosen.tick)}.`;
  if (W.cultures.some((c) => c.belief?.prophetId === id))
    works += " Speaks for the god as its Speaker.";
  const skills = Object.entries(ident.skills || {})
    .filter(([, v]) => v >= 20)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  if (skills.length)
    works += ` Skilled in ${loreJoin(skills.map(([k, v]) => `${k} (${Math.round(v)})`))}.`;
  const standing = typeof personStandingLine === "function" ? personStandingLine(id) : "";
  if (standing) works += ` ${standing}`;
  if (works) paras.push(works.trim());
  // Where they are bound now.
  if (alive) {
    const order = typeof civilOrderOf === "function" ? civilOrderOf(id) : null,
      phrase = loreOrderPhrase(order),
      captor = soc.captiveOf ? W.factions.find((f) => f.id === soc.captiveOf) : null;
    let now = "";
    if (captor) now = `Held captive by ${legendLink("faction", captor.id, captor.name)}.`;
    else if (phrase) now = `Now ${phrase}.`;
    else if (life.behaviorReason) now = `Now: ${esc(String(life.behaviorReason).split(" · ")[0])}.`;
    if (now) paras.push(now);
  }
  // The last things the chronicle says about them.
  const recent = legendEvents((e) => e.subjects?.includes(id))
    .slice(-6)
    .reverse()
    .map(
      (e) =>
        `<div class="legend-row" data-legend="event:${e.id}"><span class="legend-year">Y${e.year}</span><span>${esc(eventSentence(e))}</span></div>`,
    );
  return `<div class="card story-card"><div class="row between"><div class="subhead" style="margin:0">Story</div><button class="small" data-legend="life:${id}">Full story in Legends</button></div>${paras
    .map((p) => `<p>${p}</p>`)
    .join(
      "",
    )}${recent.length ? `<div class="subhead">Lately</div><div class="legend-timeline">${recent.join("")}</div>` : ""}</div>`;
}
const refreshInspectorLoreBase = refreshInspector;
refreshInspector = function () {
  refreshInspectorLoreBase();
  const id = UI.selectedEntity;
  if (!W || !id || W.kind[id] !== KINDS.PERSON || !DOM.inspectPane) return;
  const card = personStory(id);
  if (!card) return;
  const anchor = DOM.inspectPane.querySelector?.(".legend-entry");
  if (anchor?.insertAdjacentHTML) anchor.insertAdjacentHTML("afterend", card);
  else if (typeof DOM.inspectPane.insertAdjacentHTML === "function")
    DOM.inspectPane.insertAdjacentHTML("afterbegin", card);
  else DOM.inspectPane.innerHTML = card + DOM.inspectPane.innerHTML;
};
window.ALIFE_LORE_DEBUG = Object.freeze({
  story: (id) => personStory(id),
  songs: (id) => loreSongs(id),
});
