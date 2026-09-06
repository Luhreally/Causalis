// ═══════════════════════════════════════════════════════════════════════════
// 69. ERAS — ages of the world, leagues, wonders, and a ship that leaves
// ═══════════════════════════════════════════════════════════════════════════
// History had years but no shape. Here the world passes through ages named
// for what its most advanced people can do (Stone, Hearths, Metal, Letters,
// Engines, Stewardship, Stars), each recorded in the annals and shown on the
// top bar and the World tab. Three or more polities bound by alliance form a
// league with a name in their tongue and a Legends page; leagues restrain
// quarrels among members and pull members into a member's wars. Towns that
// know letters and navigation raise observatories and learn the sky; those
// that also master engines and stewardship raise a launch tower, learn
// starflight, and one day send the first ship off the world, which begins the
// Age of Stars and shows an ending screen the player can close and keep
// watching past. Rendering only reads the world.
const AGES = Object.freeze([
  { tier: 0, gloss: "Stone", techs: [] },
  { tier: 1, gloss: "Hearths", techs: ["controlled_fire"] },
  { tier: 2, gloss: "Metal", techs: ["metalworking"] },
  { tier: 3, gloss: "Letters", techs: ["writing", "governance"] },
  { tier: 4, gloss: "Engines", techs: ["mechanization", "waterworks"] },
  { tier: 5, gloss: "Stewardship", techs: ["planetary_stewardship"] },
  { tier: 6, gloss: "Stars", techs: [] },
]);
function ensureEras(world = W) {
  if (!world) return;
  world.ages = world.ages || [];
  world.leagues = world.leagues || [];
  world.ascensions = world.ascensions || [];
  if (world.nextLeagueId == null) world.nextLeagueId = 1;
}
const restoreWorldErasBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldErasBase();
  if (!W) return;
  const fresh = !W.ages;
  ensureEras(W);
  // An older save catches up on its ages quietly.
  if (fresh && W.tick > 0) updateAges(true);
};
// ── Ages of the world ──────────────────────────────────────────────────────────
function ageName(tier) {
  const lang = protoLanguageOf(W);
  if (lang.legacy) return "";
  return titleWord(langWord(lang, makeRng(hashParts(W.seedHash, tier), "age"), 2));
}
function ageLabel(age) {
  return `Age of ${age.gloss}`;
}
function currentAge() {
  ensureEras();
  return W.ages.at(-1) || { tier: 0, gloss: "Stone", name: "", tick: 0 };
}
function techTierOf(place) {
  let tier = 0;
  for (const age of AGES)
    if (age.techs.some((t) => place.knownProcesses.includes(t))) tier = Math.max(tier, age.tier);
  return tier;
}
function reachedTier() {
  let tier = 0,
    leader = null;
  for (const s of W.settlements) {
    if (s.ruined || !s.knownProcesses) continue;
    const t = techTierOf(s);
    if (t > tier) {
      tier = t;
      leader = s;
    }
  }
  if (W.ascensions?.length) {
    tier = 6;
    leader = W.settlements.find((s) => s.id === W.ascensions[0].settlementId) || leader;
  }
  return { tier, leader };
}
function updateAges(silent = false) {
  ensureEras();
  const { tier, leader } = reachedTier(),
    current = currentAge();
  if (tier <= current.tier) return null;
  let last = null;
  // Every age passed through is recorded, so the annals never skip one.
  for (let t = current.tier + 1; t <= tier; t++) {
    const def = AGES[t],
      f = leader ? W.factions.find((x) => x.id === leader.factionId) : null,
      age = {
        tier: t,
        gloss: def.gloss,
        name: ageName(t),
        tick: W.tick,
        eventId: 0,
        place: leader?.name || "",
        factionId: f?.id || 0,
      };
    W.ages.push(age);
    if (!silent) {
      const ev = emitEvent("AgeEvent", {
        subjects: leader ? [leader.entityId] : [],
        location: leader ? idx(leader.x, leader.y) : -1,
        factions: f ? [f.id] : [],
        causes: [W.lastEventByType.AscensionEvent, W.lastEventByType.TechAdvanceEvent].filter(
          Boolean,
        ),
        evidence:
          t === 6
            ? ["a ship left the world"]
            : [
                `${def.techs.map((x) => technologyDefinition(x)?.name || x).join(" or ")} was known`,
              ],
        importance: 5,
        data: {
          tier: t,
          gloss: def.gloss,
          name: age.name,
          place: leader?.name || "",
          polity: f?.name || "",
          year: formatYear(),
        },
      });
      age.eventId = ev.id;
    }
    last = age;
  }
  return last;
}
// ── Leagues ────────────────────────────────────────────────────────────────────
function livingPolities() {
  return W.factions.filter((f) =>
    typeof livingFaction === "function" ? livingFaction(f) : f.stability > 0,
  );
}
function alliedPair(a, b) {
  return !!(a.allies?.includes(b.id) && b.allies?.includes(a.id));
}
function leagueClusters() {
  const living = livingPolities(),
    byId = new Map(living.map((f) => [f.id, f])),
    seen = new Set(),
    clusters = [];
  for (const f of living) {
    if (seen.has(f.id)) continue;
    const stack = [f],
      members = [];
    seen.add(f.id);
    while (stack.length) {
      const x = stack.pop();
      members.push(x.id);
      for (const id of x.allies || []) {
        const y = byId.get(id);
        if (y && !seen.has(id) && alliedPair(x, y)) {
          seen.add(id);
          stack.push(y);
        }
      }
    }
    if (members.length >= 3) clusters.push(members.sort((p, q) => p - q));
  }
  return clusters;
}
function polityNames(ids) {
  return ids.map((id) => W.factions.find((f) => f.id === id)?.name || "a lost polity");
}
function leagueName(memberIds) {
  const strongest = memberIds
      .map((id) => W.factions.find((f) => f.id === id))
      .filter(Boolean)
      .sort((a, b) => (b.population || 0) - (a.population || 0) || a.id - b.id)[0],
    culture = W.cultures.find((c) => c.id === strongest?.cultureId),
    lang = culture ? languageOf(culture) : protoLanguageOf(W),
    r = makeRng(hashParts(W.seedHash, W.nextLeagueId, W.tick), "league");
  return lang.legacy
    ? `League of ${strongest?.name || "the Allies"}`
    : `${titleWord(langWord(lang, r, 2))} League`;
}
function leagueOf(f) {
  return (W.leagues || []).find((l) => !l.dissolvedTick && l.members.includes(f?.id)) || null;
}
function leagueEvent(type, league, extra, importance, factions = league.members) {
  return emitEvent(type, {
    subjects: factions.map((id) => W.factions.find((f) => f.id === id)?.leaderId).filter(Boolean),
    factions: factions.slice(),
    causes: [
      league.eventId,
      W.lastEventByType.AllianceEvent,
      W.lastEventByType.DynasticUnionEvent,
    ].filter(Boolean),
    evidence: [`${league.members.length} polities bound by alliance`],
    importance,
    data: { leagueId: league.id, name: league.name, ...extra },
  });
}
function formLeague(memberIds) {
  const league = {
    id: W.nextLeagueId++,
    name: leagueName(memberIds),
    members: memberIds.slice(),
    foundedTick: W.tick,
    eventId: 0,
    dissolvedTick: 0,
    wars: 0,
  };
  W.leagues.push(league);
  league.eventId = leagueEvent(
    "LeagueFormedEvent",
    league,
    { members: polityNames(memberIds), count: memberIds.length },
    5,
  ).id;
  return league;
}
function joinLeague(league, id) {
  league.members.push(id);
  leagueEvent("LeagueJoinedEvent", league, { polity: polityNames([id])[0] }, 3, [id]);
}
function leaveLeague(league, id) {
  league.members = league.members.filter((m) => m !== id);
  leagueEvent("LeagueLeftEvent", league, { polity: polityNames([id])[0] }, 2, [id]);
}
function dissolveLeague(league) {
  league.dissolvedTick = W.tick;
  leagueEvent(
    "LeagueDissolvedEvent",
    league,
    { years: Math.max(1, Math.round((W.tick - league.foundedTick) / TICKS_PER_YEAR)) },
    3,
  );
}
// Members keep their quarrels small.
function restrainMembers(league) {
  for (const aId of league.members)
    for (const bId of league.members) {
      if (aId === bId) continue;
      const a = W.factions.find((f) => f.id === aId),
        rel = a?.relations?.[bId];
      if (rel && rel.status !== "at war" && rel.pressure > 30) rel.pressure = 30;
    }
}
function joinWar(member, enemy, league, war, ally) {
  for (const [x, y] of [
    [member, enemy],
    [enemy, member],
  ]) {
    const rel = relationOf(x, y);
    rel.status = "at war";
    rel.pressure = Math.max(rel.pressure || 0, 110);
  }
  addRelation(member.entityId, enemy.entityId, "at_war_with", 1);
  addRelation(enemy.entityId, member.entityId, "at_war_with", 1);
  const ev = emitEvent("LeagueWarEvent", {
    subjects: [member.leaderId, ally.leaderId].filter(Boolean),
    factions: [member.id, enemy.id, ally.id],
    causes: [war.startEventId, league.eventId].filter(Boolean),
    evidence: [`${ally.name} was already at war with ${enemy.name}`, "the league's oath held"],
    importance: 4,
    data: {
      leagueId: league.id,
      name: league.name,
      polity: member.name,
      enemy: enemy.name,
      ally: ally.name,
    },
  });
  const joined = {
    id: Math.max(0, ...W.activeWars.map((w) => w.id || 0)) + 1,
    a: member.id,
    b: enemy.id,
    attackerId: member.id,
    started: W.tick,
    startEventId: ev.id,
    startPopulation: member.population + enemy.population,
    casualties: 0,
    wounded: 0,
    turns: 0,
    contactTurns: 0,
    ended: 0,
    leagueId: league.id,
  };
  W.activeWars.push(joined);
  league.wars++;
  if (typeof ensureAttackPlan === "function") ensureAttackPlan(joined, true);
  return joined;
}
function honourLeagueWars(league) {
  let joinedThisTurn = false;
  for (const war of W.activeWars) {
    if (war.ended) continue;
    const inA = league.members.includes(war.a),
      inB = league.members.includes(war.b);
    if (inA === inB) continue;
    const ally = W.factions.find((f) => f.id === (inA ? war.a : war.b)),
      enemy = W.factions.find((f) => f.id === (inA ? war.b : war.a));
    if (!ally || !enemy || !livingPolities().includes(enemy)) continue;
    for (const id of league.members) {
      if (id === ally.id) continue;
      const member = W.factions.find((f) => f.id === id);
      if (!member || member.stability <= 0 || warBetween(member, enemy)) continue;
      if (typeof activeTreaty === "function" && activeTreaty("peace", member, enemy)) continue;
      const rel = relationOf(member, enemy);
      rel.pressure = Math.min(140, (rel.pressure || 0) + 10);
      if (rel.status === "neutral" || rel.status === "truce") rel.status = "hostile";
      const fighters =
          typeof factionFieldableFighters === "function" ? factionFieldableFighters(member) : 2,
        route =
          typeof warCampaignRouteExists !== "function" ||
          warCampaignRouteExists(member, enemy) ||
          warCampaignRouteExists(enemy, member);
      if (!joinedThisTurn && rel.pressure >= 80 && fighters >= 2 && route) {
        joinWar(member, enemy, league, war, ally);
        joinedThisTurn = true;
      }
    }
  }
}
function updateLeagues() {
  ensureEras();
  const clusters = leagueClusters(),
    used = new Set();
  for (const league of W.leagues) {
    if (league.dissolvedTick) continue;
    let best = -1,
      overlap = 0;
    clusters.forEach((c, i) => {
      if (used.has(i)) return;
      const n = c.filter((id) => league.members.includes(id)).length;
      if (n > overlap) {
        overlap = n;
        best = i;
      }
    });
    if (best < 0 || overlap < 2) {
      dissolveLeague(league);
      continue;
    }
    used.add(best);
    const cluster = clusters[best];
    for (const id of cluster) if (!league.members.includes(id)) joinLeague(league, id);
    for (const id of league.members.slice()) if (!cluster.includes(id)) leaveLeague(league, id);
  }
  clusters.forEach((c, i) => {
    if (!used.has(i)) formLeague(c);
  });
  for (const league of W.leagues)
    if (!league.dissolvedTick) {
      restrainMembers(league);
      honourLeagueWars(league);
    }
  if (W.leagues.length > 30)
    W.leagues = W.leagues
      .filter((l) => !l.dissolvedTick)
      .concat(W.leagues.filter((l) => l.dissolvedTick).slice(-10));
  return W.leagues;
}
// ── Wonders: observatories and launch towers ───────────────────────────────────
const ensurePlacePlansErasBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansErasBase(place);
  if (!place || place.ruined || place.active === false || !place.knownProcesses) return;
  const knows = (t) => place.knownProcesses.includes(t),
    pr = place.management?.priorities || {},
    has = (type) =>
      W.buildings.some(
        (b) =>
          !b.ruined && b.placeKind === "settlement" && b.placeId === place.id && b.type === type,
      );
  if (knows("writing") && knows("navigation") && !has("observatory"))
    planBuilding(place, "observatory", pr.knowledge || 3);
  if (
    knows("astronomy") &&
    knows("mechanization") &&
    knows("planetary_stewardship") &&
    !has("launch_tower")
  )
    planBuilding(place, "launch_tower", Math.max(4, pr.knowledge || 3));
};
function drawObservatory(g, b, s, r, p, now, detail) {
  const spin = ACTIVE_REDUCED_MOTION ? 0.7 : (now * 0.0004 + b.id) % (Math.PI * 2),
    domeY = s.y - r * 0.45,
    eyeX = s.x + Math.cos(spin) * r * 0.6,
    eyeY = domeY - Math.abs(Math.sin(spin)) * r * 0.6;
  g.fillStyle = p.base;
  g.strokeStyle = p.dark;
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(s.x, s.y + r * 0.25, r * 0.66, r * 0.34, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = p.light;
  g.beginPath();
  g.rect(s.x - r * 0.5, domeY, r, r * 0.7);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(s.x, domeY, r * 0.5, Math.PI, 0);
  g.closePath();
  g.fill();
  g.stroke();
  // The slit, and the tube that looks out of it.
  g.strokeStyle = p.dark;
  g.lineWidth = Math.max(1, r * 0.1);
  g.beginPath();
  g.moveTo(s.x, domeY);
  g.lineTo(eyeX, eyeY);
  g.stroke();
  if (detail) {
    g.fillStyle = hsl(50, 90, 85, 0.9);
    g.beginPath();
    g.arc(eyeX, eyeY, Math.max(1, r * 0.09), 0, Math.PI * 2);
    g.fill();
  }
}
function drawLaunchTower(g, b, s, r, p, now, detail) {
  const launch = (W.ascensions || []).find((a) => a.buildingId === b.id),
    age = launch ? clamp((W.tick - launch.tick) / 900, 0, 1) : -1,
    lift = age > 0 ? age * age : 0,
    hullY = s.y - r * 0.15 - lift * r * 16;
  g.fillStyle = p.dark;
  g.beginPath();
  g.ellipse(s.x, s.y + r * 0.35, r * 0.78, r * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  // The gantry: two masts and their braces.
  g.strokeStyle = p.dark;
  g.lineWidth = Math.max(1, r * 0.1);
  for (const dx of [-0.42, 0.42]) {
    g.beginPath();
    g.moveTo(s.x + dx * r, s.y + r * 0.3);
    g.lineTo(s.x + dx * r, s.y - r * 1.9);
    g.stroke();
  }
  g.lineWidth = 1;
  for (let k = 0; k < 6; k++) {
    const y = s.y + r * 0.2 - k * r * 0.36;
    g.beginPath();
    g.moveTo(s.x - r * 0.42, y);
    g.lineTo(s.x + r * 0.42, y - r * 0.18);
    g.stroke();
  }
  if (age >= 1) return;
  // The ship: a pale hull with a nose and fins, standing on the pad or lifting.
  if (age > 0 && !ACTIVE_REDUCED_MOTION) {
    g.fillStyle = hsl(40, 95, 70, 0.75 * (1 - age));
    g.beginPath();
    g.ellipse(s.x, hullY + r * 0.25, r * 0.3, r * (0.5 + lift * 3), 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = p.light;
  g.strokeStyle = p.dark;
  g.beginPath();
  g.moveTo(s.x, hullY - r * 1.7);
  g.lineTo(s.x + r * 0.22, hullY - r * 1.2);
  g.lineTo(s.x + r * 0.22, hullY);
  g.lineTo(s.x - r * 0.22, hullY);
  g.lineTo(s.x - r * 0.22, hullY - r * 1.2);
  g.closePath();
  g.fill();
  g.stroke();
  if (detail) {
    g.fillStyle = p.dark;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(s.x + side * r * 0.22, hullY - r * 0.5);
      g.lineTo(s.x + side * r * 0.42, hullY);
      g.lineTo(s.x + side * r * 0.22, hullY);
      g.closePath();
      g.fill();
    }
  }
}
// A bright streak climbs from the tower and out of the sky for a while.
const drawProceduralAtmosphereErasBase = drawProceduralAtmosphere;
drawProceduralAtmosphere = function (now, m, v) {
  drawProceduralAtmosphereErasBase(now, m, v);
  const live = (W?.ascensions || []).filter((a) => W.tick - a.tick < 700);
  if (!live.length || UI.quality === "low") return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const a of live) {
    const age = clamp((W.tick - a.tick) / 700, 0, 1),
      [tx, ty] = xy(a.tile),
      base = proceduralProjectTile(tx + 0.5, ty + 0.5, m),
      rise = ACTIVE_REDUCED_MOTION ? 0.5 : age * age,
      x = base.x + rise * m.w * 0.08,
      y = base.y - rise * m.h * 1.3,
      fade = age < 0.8 ? 1 : (1 - age) / 0.2;
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      ctx.fillStyle = hsl(30 + t * 20, 90, 80, fade * (1 - t) * 0.5);
      ctx.beginPath();
      ctx.arc(
        x - t * rise * m.w * 0.02,
        y + t * rise * m.h * 0.28,
        Math.max(1.5, m.tw * 0.5 * (1.3 - t)),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = hsl(50, 95, 95, fade);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, m.tw * 0.45), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};
// ── The first ship ─────────────────────────────────────────────────────────────
function launchTower(place) {
  return completedBuildings(place, "launch_tower")[0] || null;
}
function launchShip(place, force = false) {
  ensureEras();
  if (!place || place.ruined || !place.knownProcesses) return null;
  if (!force && (!place.knownProcesses.includes("starflight") || (place.stability || 0) < 0.35))
    return null;
  const tower = launchTower(place);
  if (!tower || W.ascensions.some((a) => a.settlementId === place.id)) return null;
  const f = W.factions.find((x) => x.id === place.factionId),
    builders = typeof caravanCandidates === "function" ? caravanCandidates(place, 3) : [],
    first = !W.ascensions.length,
    tile = idx(tower.x, tower.y),
    ev = emitEvent("AscensionEvent", {
      subjects: [...builders, place.entityId],
      location: tile,
      factions: f ? [f.id] : [],
      causes: [W.lastEventByType.TechAdvanceEvent, W.causalIndex.tile[tile] || 0].filter(Boolean),
      evidence: [
        "a launch tower stood complete",
        "starflight was understood",
        `${builders.length} builders watched it go`,
      ],
      importance: 5,
      data: {
        place: place.name,
        polity: f?.name || "",
        first,
        builders: builders.length,
        year: formatYear(),
      },
    }),
    ascension = {
      id: W.ascensions.length + 1,
      settlementId: place.id,
      factionId: place.factionId || 0,
      buildingId: tower.id,
      tile,
      tick: W.tick,
      eventId: ev.id,
      first,
    };
  W.ascensions.push(ascension);
  for (const id of builders) {
    const ident = W.components.identity[id];
    if (!ident) continue;
    ident.significance += 12;
    ident.notable = true;
    if (first && !ident.titles.includes("Builder of the First Ship"))
      ident.titles.push("Builder of the First Ship");
  }
  updateAges();
  if (first) showEnding();
  return ascension;
}
function considerLaunches() {
  const cycle = Math.floor(W.tick / 256);
  for (const s of W.settlements) {
    if (s.ruined || !s.knownProcesses?.includes("starflight")) continue;
    if (counterRand("launch", cycle, s.id) < 0.3) launchShip(s);
  }
}
// ── The ending screen ──────────────────────────────────────────────────────────
function renderEnding() {
  ensureEras();
  const a = W.ascensions[0],
    place = a ? W.settlements.find((s) => s.id === a.settlementId) : null,
    f = a ? W.factions.find((x) => x.id === a.factionId) : null,
    living = W.factions.filter((x) => x.stability > 0).length,
    fallen = W.factions.length - living,
    wars = W.activeWars.length,
    songs = W.cultures.reduce((n, c) => n + (c.songs?.length || 0), 0),
    houses = Object.values(W.houses || {}).filter((h) => h.members.length >= 2).length,
    lives = legendLives().slice(0, 3),
    ages = W.ages
      .map(
        (age) =>
          `<li><b>${esc(ageLabel(age))}</b>${age.name ? ` <span class="muted">${esc(age.name)}</span>` : ""} · year ${formatYear(age.tick)}${age.place ? ` · ${esc(age.place)}` : ""}</li>`,
      )
      .join("");
  return `<div class="eyebrow">An ending you can continue past</div><h3 style="margin:4px 0 8px">${
    a ? `The first ship has left the world` : `The world so far`
  }</h3><p>${
    a
      ? `In year ${a ? formatYear(a.tick) : formatYear()}, from the launch tower of ${legendLink("place", place?.id || 0, esc(place?.name || "a lost town"))}${
          f ? ` of ${legendLink("faction", f.id, esc(f.name))}` : ""
        }, a ship rose carrying seed, record, and the names of every people that ever lived here. Nothing else changes: the fields still want tending, the feuds are not forgotten, and the god is still watched for.`
      : `No ship has left the world yet. This page fills in when one does.`
  }</p><div class="subhead">The ages</div><ul class="tree">${ages || "<li>The Age of Stone</li>"}</ul><div class="subhead">The world in year ${formatYear()}</div><div class="kv"><span>Polities</span><b>${living} living · ${fallen} fallen</b></div><div class="kv"><span>Wars</span><b>${wars}</b></div><div class="kv"><span>Houses</span><b>${houses}</b></div><div class="kv"><span>Songs</span><b>${songs}</b></div>${
    lives.length
      ? `<div class="subhead">The greatest lives</div>${lives
          .map(
            (l) =>
              `<div class="kv"><span>${legendLink("life", l.id, esc(l.name))}</span><b>${Math.round(l.renown)} renown</b></div>`,
          )
          .join("")}`
      : ""
  }<p class="muted" style="margin-top:8px">Close this and keep watching. The Legends keep the whole story.</p>`;
}
function showEnding() {
  if (W.endingShownTick) return false;
  W.endingShownTick = W.tick;
  if (typeof DOM === "undefined" || !DOM?.modalLayer || typeof openModal !== "function")
    return false;
  try {
    openModal(
      "The first ship leaves the world",
      renderEnding(),
      `<button id="endingLegends">Read the Legends</button><button id="endingContinue" class="primary">Keep watching</button>`,
      true,
    );
    const keep = $("#endingContinue"),
      go = $("#endingLegends");
    if (keep) keep.onclick = () => closeModal();
    if (go)
      go.onclick = () => {
        closeModal();
        if (typeof openLegend === "function") openLegend("ending");
      };
  } catch (err) {
    return false;
  }
  return true;
}
// ── Tick hook ──────────────────────────────────────────────────────────────────
const updateWeatherCycleErasBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleErasBase();
  if (!W?.settlements || !W.factions) return;
  ensureEras(W);
  if (W.tick % 128 === 100) updateAges();
  if (W.tick % 256 === 136) updateLeagues();
  if (W.tick % 256 === 168) considerLaunches();
};
// ── Chronicle, songs, and Legends ──────────────────────────────────────────────
const eventSentenceErasBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "AgeEvent":
      return d.tier === 6
        ? `The Age of Stars began when the first ship left the world from ${d.place || "a lost town"}${d.name ? `; the first tongue calls it ${d.name}` : ""}.`
        : `The Age of ${d.gloss} began${d.name ? `, called ${d.name} in the first tongue` : ""}${
            d.place ? `; ${d.place}${d.polity ? ` of ${d.polity}` : ""} led the way` : ""
          }.`;
    case "LeagueFormedEvent":
      return `${(d.members || []).join(", ")} swore the ${d.name}, a league of ${d.count} polities.`;
    case "LeagueJoinedEvent":
      return `${d.polity} joined the ${d.name}.`;
    case "LeagueLeftEvent":
      return `${d.polity} left the ${d.name}.`;
    case "LeagueDissolvedEvent":
      return `The ${d.name} dissolved after ${d.years} year${d.years === 1 ? "" : "s"}.`;
    case "LeagueWarEvent":
      return `${d.polity} honoured the ${d.name} and went to war with ${d.enemy} beside ${d.ally}.`;
    case "AscensionEvent":
      return `From the launch tower of ${d.place}${d.polity ? ` of ${d.polity}` : ""}, ${
        d.first ? "the first ship" : "another ship"
      } left the world, carrying seed, record, and the names of its peoples.`;
    default:
      return eventSentenceErasBase(e);
  }
};
const songTitleForErasBase = songTitleFor;
songTitleFor = function (event) {
  const d = event.data || {};
  switch (event.type) {
    case "AgeEvent":
      return { kind: "song", title: `The Dawn of the Age of ${d.gloss}` };
    case "LeagueFormedEvent":
      return { kind: "tale", title: `The Oath of the ${d.name}` };
    case "AscensionEvent":
      return { kind: "song", title: `The Ship That Left ${d.place}` };
    default:
      return songTitleForErasBase(event);
  }
};
function renderLeaguePage(id) {
  ensureEras();
  const league = W.leagues.find((l) => l.id === id);
  if (!league) return `<div class="empty">No such league.</div>`;
  const members = league.members
      .map((mid) => W.factions.find((f) => f.id === mid))
      .filter(Boolean)
      .map(
        (f) =>
          `<div class="kv"><span>${legendLink("faction", f.id, f.name)}</span><b>${f.stability > 0 ? "living" : "fallen"} · ${f.population || 0} people</b></div>`,
      )
      .join(""),
    events = legendEvents((e) => e.data?.leagueId === league.id);
  return `${legendHero(league.name, [
    league.dissolvedTick ? "dissolved" : "standing",
    `${league.members.length} polities`,
    `since year ${formatYear(league.foundedTick)}`,
  ])}<div class="subhead">Members</div>${members || `<div class="empty">None remain.</div>`}<div class="kv"><span>Wars honoured</span><b>${league.wars}</b></div>${
    league.dissolvedTick
      ? `<div class="kv"><span>Dissolved</span><b>year ${formatYear(league.dissolvedTick)}</b></div>`
      : ""
  }<div class="subhead">Chronicle</div>${timelineRows(events, 40)}`;
}
function renderAgesPage() {
  ensureEras();
  const rows = W.ages
    .map(
      (age) =>
        `<div class="kv"><span>${esc(ageLabel(age))}${age.name ? ` <span class="muted">${esc(age.name)}</span>` : ""}</span><b>year ${formatYear(age.tick)}${
          age.place ? ` · ${esc(age.place)}` : ""
        }</b></div>`,
    )
    .join("");
  return `${legendHero("The ages of the world", [ageLabel(currentAge())])}${
    rows || `<div class="empty">The Age of Stone. Nothing has changed the world yet.</div>`
  }${
    W.ascensions.length
      ? `<div class="subhead">The ships</div>${timelineRows(
          legendEvents((e) => e.type === "AscensionEvent"),
          10,
        )}<p>${legendLink("ending", 0, "Read the ending")}</p>`
      : ""
  }`;
}
function leagueCards(limit = 6) {
  return (W.leagues || [])
    .filter((l) => !l.dissolvedTick)
    .slice(-limit)
    .reverse()
    .map(
      (l) =>
        `<div class="legend-card" data-legend="league:${l.id}"><b>${esc(l.name)}</b><small>${l.members.length} polities · since year ${formatYear(l.foundedTick)}</small></div>`,
    );
}
const renderLegendPageErasBase = renderLegendPage;
renderLegendPage = function (kind = UI.legend.kind, id = UI.legend.id) {
  if (!W) return renderLegendPageErasBase(kind, id);
  if (kind === "league") return renderLeaguePage(Number(id));
  if (kind === "ages") return renderAgesPage();
  if (kind === "ending") return renderEnding();
  if (kind === "list" && id === "leagues")
    return `${legendHero("Leagues", [`${(W.leagues || []).filter((l) => !l.dissolvedTick).length} standing`])}<div class="legend-grid">${leagueCards(60).join("")}</div>`;
  return renderLegendPageErasBase(kind, id);
};
const renderLegendIndexErasBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const html = renderLegendIndexErasBase(query),
    age = currentAge(),
    cards = leagueCards(6),
    standing = (W.leagues || []).filter((l) => !l.dissolvedTick).length,
    ageCard = `<div class="row between" style="margin-top:10px"><span class="subhead" style="margin:0">The age of the world</span></div><div class="legend-grid"><div class="legend-card" data-legend="ages:0"><b>${esc(ageLabel(age))}</b><small>${
      age.name ? `${esc(age.name)} · ` : ""
    }${W.ages.length} age${W.ages.length === 1 ? "" : "s"} recorded${W.ascensions?.length ? " · a ship has left" : ""}</small></div>${
      W.endingShownTick
        ? `<div class="legend-card" data-legend="ending:0"><b>The ending</b><small>the first ship, year ${formatYear(W.ascensions[0]?.tick || W.endingShownTick)}</small></div>`
        : ""
    }</div>`,
    leagues = cards.length
      ? `<div class="row between" style="margin-top:10px"><span class="subhead" style="margin:0">Leagues</span>${
          standing > 6
            ? legendLink("list", "leagues", `all ${standing}`)
            : `<span class="muted">${standing}</span>`
        }</div><div class="legend-grid">${cards.join("")}</div>`
      : "";
  return `${html}${ageCard}${leagues}`;
};
const renderFactionPageErasBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageErasBase(id),
    f = W.factions.find((x) => x.id === id),
    league = f ? leagueOf(f) : null;
  if (!league) return html;
  const row = `<div class="kv"><span>League</span><b>${legendLink("league", league.id, league.name)}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
// ── Top bar and World tab ──────────────────────────────────────────────────────
const refreshTopbarErasBase = refreshTopbar;
refreshTopbar = function () {
  refreshTopbarErasBase();
  if (!W || !DOM?.topEpoch) return;
  const age = currentAge();
  if (age.tier > 0) DOM.topEpoch.textContent = `${epochName()} · ${ageLabel(age)}`;
};
const refreshWorldInfoErasBase = refreshWorldInfo;
refreshWorldInfo = function () {
  refreshWorldInfoErasBase();
  if (!W || !DOM?.worldPane) return;
  const age = currentAge(),
    card = `<div class="subhead">The age of the world</div><div class="card"><div class="row between"><b>${esc(ageLabel(age))}</b><span class="tag mono">${
      age.name ? esc(age.name) : "in the Common tongue"
    }</span></div><small class="muted">${
      W.ages.length
        ? W.ages.map((x) => `${esc(ageLabel(x))} from year ${formatYear(x.tick)}`).join(" · ")
        : "Stone, until someone learns to keep a fire."
    }${(W.leagues || []).some((l) => !l.dissolvedTick) ? ` · ${W.leagues.filter((l) => !l.dissolvedTick).length} league(s) standing` : ""}${
      W.ascensions?.length ? ` · ${W.ascensions.length} ship(s) have left` : ""
    }</small></div>`,
    anchor = `<div class="subhead">Chemistry viability`;
  DOM.worldPane.innerHTML = DOM.worldPane.innerHTML.includes(anchor)
    ? DOM.worldPane.innerHTML.replace(anchor, `${card}${anchor}`)
    : DOM.worldPane.innerHTML + card;
};
window.ALIFE_ERAS_DEBUG = Object.freeze({
  age: () => ({ ...currentAge() }),
  ages: () => (W.ages || []).map((a) => ({ ...a })),
  updateAges: () => updateAges(),
  leagues: () => (W.leagues || []).map((l) => ({ ...l, members: l.members.slice() })),
  updateLeagues: () => updateLeagues(),
  clusters: () => leagueClusters(),
  plan: (settlementId) => ensurePlacePlans(W.settlements.find((s) => s.id === settlementId)),
  launch: (settlementId, force = true) =>
    launchShip(
      W.settlements.find((s) => s.id === settlementId),
      force,
    ),
  ascensions: () => (W.ascensions || []).map((a) => ({ ...a })),
  ending: () => renderEnding(),
  show: () => {
    W.endingShownTick = 0;
    return showEnding();
  },
  page: (kind, id) => renderLegendPage(kind, id),
});
