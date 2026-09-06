// ═══════════════════════════════════════════════════════════════════════════
// 77. HEARTLINES — the drama you can see, and the children of affairs
// ═══════════════════════════════════════════════════════════════════════════
// Stories named lovers and affairs but the map did not show them and the alert
// feed only spoke of polities. Partners standing together now share a warm
// line, lovers meeting in secret a dim violet one that flickers, the people
// bar says who is with whom or keeping a secret, and caught betrayals, feuds,
// brawls, and revealed parentage reach the notable-now feed. A child conceived
// in a secret affair is raised as the partner's child: the world, the family
// tree, and the chronicle believe the presumed parent until the child comes of
// age and the truth shows in them, at which point the wronged partner learns
// it, the bond may break, the tree corrects itself, and the lover's house
// gains a child it never knew. Rendering only reads the world.
const DRAMA_ALERTS = new Set([
  "CheatingDiscoveredEvent",
  "FeudEvent",
  "QuarrelEvent",
  "RivalryEvent",
  "ParentageRevealedEvent",
  "RelationshipBrokenEvent",
]);
const alertWorthyHeartBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyHeartBase(a) || (a.importance >= 3 && DRAMA_ALERTS.has(a.type));
};
function recentLover(id, within = 48) {
  const lovers = W.components.social[id]?.lovers;
  if (!lovers) return 0;
  let best = 0,
    tick = -1;
  for (const [k, v] of Object.entries(lovers))
    if (W.tick - v.lastTick <= within && v.lastTick > tick && W.components.identity[+k]) {
      tick = v.lastTick;
      best = +k;
    }
  return best;
}
const personStatusWordHeartBase = personStatusWord;
personStatusWord = function (id) {
  const life = W.components.life[id];
  if (!life) return "";
  if (life.wounded || life.infected || life.hunger > 70 || life.thirst > 70)
    return personStatusWordHeartBase(id);
  const lover = recentLover(id);
  if (lover) {
    const soc = W.components.social[id],
      name = (W.components.identity[lover]?.generatedName || "").split(" ")[0] || "someone";
    return soc?.partnerId === lover ? `with ${name}` : `lately with ${name}`;
  }
  const soc = W.components.social[id];
  if (soc?.affairs?.some((a) => !a.endedTick && !a.discovered)) return "keeping a secret";
  return personStatusWordHeartBase(id);
};
// ── Heart lines on the map ─────────────────────────────────────────────────────
const drawWorkerActivityHeartBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivityHeartBase(now, bounds);
  if (UI.quality === "low" || UI.camera.zoom < 1.8) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    still = ACTIVE_REDUCED_MOTION,
    pos = W.components.position,
    life = W.components.life,
    visible = (p) =>
      p &&
      p.x >= bounds.x0 - 1 &&
      p.x <= bounds.x1 + 1 &&
      p.y >= bounds.y0 - 1 &&
      p.y <= bounds.y1 + 1;
  let drawn = 0;
  for (const id of W.activeIds) {
    if (drawn > 30) break;
    if (W.kind[id] !== KINDS.PERSON) continue;
    const soc = W.components.social[id],
      p = pos[id];
    if (!soc || !visible(p) || life[id]?.insideBuildingId) continue;
    const links = [];
    if (soc.partnerId && soc.partnerId > id) links.push([soc.partnerId, "partner"]);
    for (const affair of soc.affairs || [])
      if (!affair.endedTick && affair.otherId > id) links.push([affair.otherId, "lover"]);
    for (const [other, kind] of links) {
      const q = pos[other];
      if (!visible(q) || life[other]?.insideBuildingId || dist2(p.x, p.y, q.x, q.y) > 9) continue;
      const s = visualAnchor(id, p, m, now).s,
        t = visualAnchor(other, q, m, now).s,
        r = clamp(m.tw * 0.3, 3, 40),
        pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.003 + id * 0.9),
        mx = (s.x + t.x) / 2,
        my = Math.min(s.y, t.y) - r * (1.6 + pulse * 0.3);
      if (kind === "lover") {
        const flicker = still ? 0.6 : Math.sin(now * 0.011 + other * 0.7);
        if (!still && flicker < 0) continue;
        ctx.strokeStyle = hsl(285, 70, 70, 0.18 + Math.abs(flicker) * 0.25);
        ctx.setLineDash([Math.max(2, r * 0.3), Math.max(2, r * 0.3)]);
      } else {
        ctx.strokeStyle = hsl(345, 80, 72, 0.3 + pulse * 0.35);
        ctx.setLineDash([]);
      }
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r * 0.9);
      ctx.quadraticCurveTo(mx, my, t.x, t.y - r * 0.9);
      ctx.stroke();
      ctx.setLineDash([]);
      // A small heart: two lobes and a point.
      const hx = mx,
        hy = my + r * 0.4,
        hr = Math.max(1.4, r * 0.14 * (kind === "lover" ? 0.8 : 1));
      ctx.fillStyle =
        kind === "lover"
          ? hsl(285, 75, 78, 0.55 + pulse * 0.3)
          : hsl(345, 85, 76, 0.6 + pulse * 0.4);
      ctx.beginPath();
      ctx.arc(hx - hr * 0.55, hy - hr * 0.3, hr * 0.6, 0, Math.PI * 2);
      ctx.arc(hx + hr * 0.55, hy - hr * 0.3, hr * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - hr * 1.1, hy - hr * 0.1);
      ctx.lineTo(hx, hy + hr * 1.1);
      ctx.lineTo(hx + hr * 1.1, hy - hr * 0.1);
      ctx.closePath();
      ctx.fill();
      drawn++;
    }
  }
};
// ── Children of affairs ────────────────────────────────────────────────────────
function setSecretParentage(child, bearer, lover, presumed) {
  const ident = W.components.identity[child];
  if (!ident || !presumed || presumed === lover) return false;
  ident.trueParents = [bearer, lover];
  ident.parents = [bearer, presumed];
  ident.secretParentId = lover;
  ident.presumedParentId = presumed;
  const loverIdent = W.components.identity[lover],
    presumedIdent = W.components.identity[presumed];
  if (loverIdent?.children) loverIdent.children = loverIdent.children.filter((c) => c !== child);
  if (presumedIdent) {
    presumedIdent.children = presumedIdent.children || [];
    if (!presumedIdent.children.includes(child)) presumedIdent.children.push(child);
    if (typeof linkKin === "function") linkKin(presumed, child, ident.birthEventId || 0);
  }
  return true;
}
function revealParentage(child, force = false) {
  const ident = W.components.identity[child];
  if (!ident?.secretParentId || ident.parentageRevealedTick) return null;
  const [bearer] = ident.trueParents || [],
    lover = ident.secretParentId,
    presumed = ident.presumedParentId,
    presumedAlive = !!presumed && classifyAlive(presumed),
    affair = typeof affairBetween === "function" && bearer ? affairBetween(bearer, lover) : null,
    known = !!(affair?.discovered || W.components.social[presumed]?.betrayedBy?.includes(bearer));
  if (!force) {
    if (!isAdultPerson(child)) return null;
    const cycle = Math.floor(W.tick / 256);
    if (counterRand("parentage", cycle, child) >= (known ? 0.5 : 0.12)) return null;
  }
  ident.parentageRevealedTick = W.tick;
  ident.parents = (ident.trueParents || ident.parents).slice();
  const presumedIdent = W.components.identity[presumed],
    loverIdent = W.components.identity[lover];
  if (presumedIdent?.children)
    presumedIdent.children = presumedIdent.children.filter((c) => c !== child);
  if (loverIdent) {
    loverIdent.children = loverIdent.children || [];
    if (!loverIdent.children.includes(child)) loverIdent.children.push(child);
    if (typeof linkKin === "function") linkKin(lover, child, ident.birthEventId || 0);
  }
  ident.titles = ident.titles || [];
  if (!ident.titles.includes("Born of an affair")) ident.titles.push("Born of an affair");
  ident.significance = (ident.significance || 0) + 2;
  const p = W.components.position[child],
    reason = presumedAlive
      ? "the look of another house was on them"
      : `the truth came out after ${entityName(presumed)}'s death`,
    ev = emitEvent("ParentageRevealedEvent", {
      subjects: [child, bearer, lover, presumed].filter(Boolean),
      location: p ? idx(p.x, p.y) : -1,
      factions: [W.components.social[child]?.factionId].filter(Boolean),
      causes: [ident.birthEventId, affair?.eventId].filter(Boolean),
      evidence: [reason, `raised as the child of ${entityName(presumed)}`],
      importance: presumedAlive ? 3 : 2,
      data: {
        child: entityName(child),
        bearer: entityName(bearer),
        lover: entityName(lover),
        presumed: entityName(presumed),
        reason,
      },
    });
  if (presumedAlive && bearer) {
    const toBearer = relationshipState(presumed, bearer),
      toLover = relationshipState(presumed, lover),
      psoc = W.components.social[presumed];
    if (toBearer) {
      toBearer.betrayal = clamp((toBearer.betrayal || 0) + 0.6, 0, 1);
      toBearer.grievance = clamp((toBearer.grievance || 0) + 0.5, 0, 1);
      toBearer.jealousy = clamp((toBearer.jealousy || 0) + 0.4, 0, 1);
    }
    if (toLover) toLover.grievance = clamp((toLover.grievance || 0) + 0.6, 0, 1);
    if (psoc?.betrayedBy && !psoc.betrayedBy.includes(bearer)) psoc.betrayedBy.push(bearer);
    setEmotionImpulse(
      presumed,
      { anger: 0.5, sadness: 0.5, jealousy: 0.4, contentment: -0.4 },
      ev.id,
      "💔",
    );
    if (
      psoc?.partnerId === bearer &&
      (toBearer?.commitment || 0) > 0.5 &&
      typeof endPartnership === "function"
    )
      endPartnership(presumed, bearer, ev.id, "the child they had raised was not theirs");
  }
  return ev;
}
function updateParentage() {
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const ident = W.components.identity[id];
    if (ident?.secretParentId && !ident.parentageRevealedTick) revealParentage(id);
  }
}
const updateWeatherCycleHeartBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleHeartBase();
  if (!W?.components?.identity) return;
  if (W.tick % 256 === 56) updateParentage();
};
// ── Chronicle, story, houses ───────────────────────────────────────────────────
const eventSentenceHeartBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "ParentageRevealedEvent")
    return `${d.child}, raised as the child of ${d.bearer} and ${d.presumed}, was seen to be ${d.lover}'s: ${d.reason}.`;
  if (e.type === "BirthEvent") {
    const child = e.subjects?.[0],
      ident = child ? W.components.identity[child] || W.historicalIdentities?.[child] : null;
    if (ident?.secretParentId && !ident.parentageRevealedTick && ident.parents?.length === 2)
      return `${entityName(child)} was born to ${entityName(ident.parents[0])} and ${entityName(ident.parents[1])}.`;
  }
  return eventSentenceHeartBase(e);
};
const personStoryHeartBase = personStory;
personStory = function (id) {
  const html = personStoryHeartBase(id),
    ident = W.components.identity[id];
  if (!html || !ident?.parentageRevealedTick) return html;
  const [bearer, lover] = ident.trueParents || [],
    line = `<p>Born of ${typeof loreName === "function" ? loreName(bearer) : esc(entityName(bearer))}'s affair with ${
      typeof loreName === "function" ? loreName(lover) : esc(entityName(lover))
    }; raised as ${typeof loreName === "function" ? loreName(ident.presumedParentId) : esc(entityName(ident.presumedParentId))}'s child until year ${formatYear(ident.parentageRevealedTick)}.</p>`,
    at = html.indexOf('<div class="subhead">Lately</div>');
  return at < 0 ? html + line : html.slice(0, at) + line + html.slice(at);
};
function houseSecretChildren(kin) {
  const out = [];
  for (const [key, ident] of Object.entries(W.components.identity)) {
    if (!ident?.parentageRevealedTick || !ident.trueParents) continue;
    const id = Number(key),
      lover = ident.secretParentId,
      loverKin = W.components.social[lover]?.kinGroupId;
    if (loverKin === kin && W.components.social[id]?.kinGroupId !== kin) out.push(id);
  }
  return out;
}
const renderHousePageHeartBase = renderHousePage;
renderHousePage = function (kin) {
  const html = renderHousePageHeartBase(kin),
    secret = houseSecretChildren(kin);
  if (!secret.length) return html;
  const rows = secret
    .map(
      (id) =>
        `<div class="kv"><span>${lifeLink(id) || esc(entityName(id))}</span><b>born to this house in secret · revealed year ${formatYear(
          W.components.identity[id].parentageRevealedTick,
        )}</b></div>`,
    )
    .join("");
  return `${html}<div class="subhead">Children born outside the house</div>${rows}`;
};
window.ALIFE_HEARTLINES_DEBUG = Object.freeze({
  reveal: (childId, force = true) => revealParentage(childId, force),
  update: () => updateParentage(),
  secrets: () =>
    W.activeIds
      .filter(
        (id) =>
          W.components.identity[id]?.secretParentId &&
          !W.components.identity[id].parentageRevealedTick,
      )
      .map((id) => ({
        id,
        name: entityName(id),
        presumed: W.components.identity[id].presumedParentId,
        lover: W.components.identity[id].secretParentId,
      })),
  status: (id) => personStatusWord(id),
  alertWorthy: (e) => alertWorthy(e),
});
