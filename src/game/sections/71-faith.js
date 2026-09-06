// ═══════════════════════════════════════════════════════════════════════════
// 71. FAITH — sects, zeal, and holy wars
// ═══════════════════════════════════════════════════════════════════════════
// Cultures already name their god and read its acts as favour or wrath, and a
// town that reads the god the other way breaks off in a schism. Here those
// readings become sects with names: the Bright Way of a god, the Dread Way, or
// its Watchers. Polities of different sects feel zeal against each other, more
// when one is Zealots or when they quarrel over the same god, and that zeal
// presses toward war; a war begun under such pressure is a holy war, marked as
// such in the chronicle and on its Legends page. Polities of one sect keep
// their quarrels small. Rendering only reads the world.
const ZEAL_PRESSURE = 6,
  ZEAL_HOLY = 0.45;
function ensureFaith(world = W) {
  if (!world) return;
  world.faith = world.faith || { lastEventId: 0, holyWars: 0, sects: {} };
}
const restoreWorldFaithBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldFaithBase();
  ensureFaith(W);
};
function sectName(belief) {
  const lean = beliefLean(belief);
  return lean === "favour"
    ? `the Bright Way of ${belief.name}`
    : lean === "wrath"
      ? `the Dread Way of ${belief.name}`
      : `the Watchers of ${belief.name}`;
}
function cultureFaith(culture) {
  const b = culture?.belief;
  if (!b?.named || !b.name) return null;
  const lean = beliefLean(b);
  return { key: `${b.name}:${lean}`, god: b.name, lean, name: sectName(b), cultureId: culture.id };
}
function faithOf(f) {
  if (!f) return null;
  return cultureFaith(W.cultures.find((c) => c.id === f.cultureId));
}
function zealBetween(a, b, fa, fb) {
  const spiritual = ((a.ethos?.spiritual || 0) + (b.ethos?.spiritual || 0)) / 2,
    zealots =
      typeof polityHasTrait === "function" &&
      (polityHasTrait(a, "Zealots") || polityHasTrait(b, "Zealots"))
        ? 0.3
        : 0,
    sameGod = fa.god === fb.god ? 0.2 : 0;
  return clamp(spiritual + zealots + sameGod, 0, 1.5);
}
function noteSects() {
  for (const c of W.cultures) {
    const faith = cultureFaith(c);
    if (!faith || W.faith.sects[faith.key]) continue;
    W.faith.sects[faith.key] = {
      name: faith.name,
      god: faith.god,
      lean: faith.lean,
      tick: W.tick,
      cultureId: c.id,
    };
    emitEvent("SectEvent", {
      subjects: [c.entityId].filter(Boolean),
      factions: cultureFactions(c).map((f) => f.id),
      causes: [W.lastEventByType.SchismEvent, W.lastEventByType.OmenEvent].filter(Boolean),
      evidence: [`the ${c.name} read their god as ${faith.lean}`],
      importance: 3,
      data: { sect: faith.name, culture: c.name, god: faith.god, lean: faith.lean },
    });
  }
}
function pressFaith() {
  const living = W.factions.filter((f) =>
    typeof livingFaction === "function" ? livingFaction(f) : f.stability > 0,
  );
  for (let i = 0; i < living.length; i++)
    for (let j = i + 1; j < living.length; j++) {
      const a = living[i],
        b = living[j],
        fa = faithOf(a),
        fb = faithOf(b);
      if (!fa || !fb) continue;
      const ra = relationOf(a, b),
        rb = relationOf(b, a);
      if (fa.key === fb.key) {
        ra.zeal = rb.zeal = 0;
        if (ra.status !== "at war" && ra.pressure > 20) ra.pressure = rb.pressure = ra.pressure - 4;
        continue;
      }
      const zeal = zealBetween(a, b, fa, fb);
      ra.zeal = rb.zeal = zeal;
      if (
        ra.status === "at war" ||
        (typeof activeTreaty === "function" && activeTreaty("peace", a, b))
      )
        continue;
      const appetite = typeof warAppetite === "function" ? warAppetite(a, b) : 1;
      ra.pressure = rb.pressure = Math.min(
        200,
        (ra.pressure || 0) + zeal * ZEAL_PRESSURE * appetite,
      );
    }
}
function markHolyWars() {
  const since = W.faith.lastEventId || 0,
    fresh = [];
  for (let n = W.events.length - 1; n >= 0; n--) {
    const e = W.events[n];
    if (e.id <= since) break;
    if (e.type === "WarStartedEvent" || e.type === "LeagueWarEvent") fresh.push(e);
  }
  if (W.events.length) W.faith.lastEventId = W.events[W.events.length - 1].id;
  fresh.reverse();
  for (const e of fresh) {
    const a = W.factions.find((f) => f.id === e.factions?.[0]),
      b = W.factions.find((f) => f.id === e.factions?.[1]),
      fa = faithOf(a),
      fb = faithOf(b);
    if (!a || !b || !fa || !fb || fa.key === fb.key) continue;
    const war = warBetween(a, b);
    if (!war || war.holy || (a.relations[b.id]?.zeal || 0) < ZEAL_HOLY) continue;
    war.holy = true;
    war.holyId = ++W.faith.holyWars;
    const ev = emitEvent("HolyWarEvent", {
      subjects: [a.leaderId, b.leaderId].filter(Boolean),
      factions: [a.id, b.id],
      causes: [e.id, W.lastEventByType.SectEvent].filter(Boolean),
      evidence: [
        `${fa.name} against ${fb.name}`,
        `zeal ${(a.relations[b.id].zeal || 0).toFixed(2)}`,
      ],
      importance: 5,
      data: {
        a: a.name,
        b: b.name,
        sectA: fa.name,
        sectB: fb.name,
        god: fa.god,
        sameGod: fa.god === fb.god,
      },
    });
    war.holyEventId = ev.id;
  }
}
function updateFaith() {
  ensureFaith();
  noteSects();
  pressFaith();
  markHolyWars();
}
const updateWeatherCycleFaithBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleFaithBase();
  if (!W?.factions || !W.cultures) return;
  ensureFaith(W);
  if (W.tick % 128 === 72) updateFaith();
};
// ── Chronicle and Legends ──────────────────────────────────────────────────────
const eventSentenceFaithBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "SectEvent":
      return `${d.sect ? d.sect.charAt(0).toUpperCase() + d.sect.slice(1) : "A sect"} took shape among the ${d.culture}.`;
    case "HolyWarEvent":
      return `${d.a} marched against ${d.b} in the name of ${d.god}: a holy war of ${d.sectA} against ${d.sectB}${
        d.sameGod ? ", two readings of one god" : ""
      }.`;
    default:
      return eventSentenceFaithBase(e);
  }
};
const songTitleForFaithBase = songTitleFor;
songTitleFor = function (event) {
  const d = event.data || {};
  if (event.type === "HolyWarEvent") return { kind: "song", title: `The Sword of ${d.god}` };
  if (event.type === "SectEvent") return { kind: "song", title: `The Creed of ${d.god}` };
  return songTitleForFaithBase(event);
};
function faithRow(f) {
  const faith = faithOf(f);
  return faith
    ? `<div class="kv"><span>Faith</span><b>${esc(faith.name.charAt(0).toUpperCase() + faith.name.slice(1))}</b></div>`
    : "";
}
const renderFactionPageFaithBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageFaithBase(id),
    f = W.factions.find((x) => x.id === id),
    row = f ? faithRow(f) : "";
  if (!row) return html;
  const holy = W.activeWars.filter((w) => w.holy && (w.a === id || w.b === id)).length,
    extra = holy ? `<div class="kv"><span>Holy wars</span><b>${holy}</b></div>` : "",
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row + extra : html.slice(0, at) + row + extra + html.slice(at);
};
const renderCulturePageFaithBase = renderCulturePage;
renderCulturePage = function (id) {
  const html = renderCulturePageFaithBase(id),
    c = W.cultures.find((x) => x.id === id),
    faith = c ? cultureFaith(c) : null;
  if (!faith) return html;
  const row = `<div class="kv"><span>Sect</span><b>${esc(faith.name.charAt(0).toUpperCase() + faith.name.slice(1))}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
const renderLeaguePageFaithBase = renderLeaguePage;
renderLeaguePage = function (id) {
  const html = renderLeaguePageFaithBase(id),
    league = (W.leagues || []).find((l) => l.id === id);
  if (!league) return html;
  const keys = new Set(
    league.members.map((m) => faithOf(W.factions.find((f) => f.id === m))?.key).filter(Boolean),
  );
  if (keys.size !== 1) return html;
  const faith = W.faith?.sects?.[[...keys][0]],
    row = faith
      ? `<div class="kv"><span>Faith</span><b>${esc(faith.name.charAt(0).toUpperCase() + faith.name.slice(1))} binds every member</b></div>`
      : "";
  if (!row) return html;
  const at = html.indexOf('<div class="subhead">Members</div>');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
// ── Compacts: polities of one sect at peace count as bound for leagues ─────────
function faithBond(a, b) {
  if (!a || !b || a === b) return false;
  const fa = faithOf(a),
    fb = faithOf(b);
  if (!fa || !fb || fa.key !== fb.key) return false;
  const rel = a.relations?.[b.id],
    rev = b.relations?.[a.id];
  if (!rel || !rev) return false;
  if (
    ["hostile", "mobilizing", "at war"].includes(rel.status) ||
    ["hostile", "mobilizing", "at war"].includes(rev.status)
  )
    return false;
  if ((rel.pressure || 0) >= 30 || (rev.pressure || 0) >= 30) return false;
  if (warBetween(a, b)) return false;
  return (a.ethos?.spiritual || 0) >= 0.45 && (b.ethos?.spiritual || 0) >= 0.45;
}
leagueClusters = function () {
  const living = livingPolities(),
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
      for (const y of living)
        if (!seen.has(y.id) && (alliedPair(x, y) || faithBond(x, y))) {
          seen.add(y.id);
          stack.push(y);
        }
    }
    if (members.length >= 3) clusters.push(members.sort((p, q) => p - q));
  }
  return clusters;
};
window.ALIFE_FAITH_DEBUG = Object.freeze({
  faith: (factionId) => faithOf(W.factions.find((f) => f.id === factionId)),
  update: () => (updateFaith(), { sects: { ...W.faith.sects }, holyWars: W.faith.holyWars }),
  sects: () => ({ ...(W.faith?.sects || {}) }),
  zeal: (a, b) => W.factions.find((f) => f.id === a)?.relations?.[b]?.zeal ?? null,
  bond: (a, b) =>
    faithBond(
      W.factions.find((f) => f.id === a),
      W.factions.find((f) => f.id === b),
    ),
});
