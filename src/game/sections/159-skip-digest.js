// ═══════════════════════════════════════════════════════════════════════════
// 159. WHAT HAPPENED WHILE YOU SKIPPED
// ═══════════════════════════════════════════════════════════════════════════
// The Causal skip is how a world is carried from its first camps to its first
// ship, and a press can cover two dozen years; it ended in one sentence in the
// status line and a toast for three seconds. Now a press ends in a digest: the
// years it covered, the people, towns, polities and crafts before and after,
// the notable events between (the chronicle's own, linked to the lives and
// places they name), and what the world still needs for the next stage. It can
// be turned off from the digest itself. Only reads the world.
const SKIP_DIGEST_EVENTS = 8;

function skipDigestSnapshot() {
  const p = populationSummary();
  return {
    tick: W.tick,
    eventId: W.nextEventId,
    people: p.person || 0,
    towns: W.settlements.filter((s) => !s.ruined).length,
    polities: W.factions.filter((f) => f.stability > 0).length,
    crafts: W.technologies?.length || 0,
    wars: (W.activeWars || []).filter((w) => !w.ended).length,
  };
}
function skipDigestDelta(before, after) {
  const d = after - before;
  return d
    ? `<small class="${d > 0 ? "good" : "red"}">${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}</small>`
    : "";
}
function skipDigestHTML(before, after, told) {
  const events = W.events
      .filter((e) => e.id >= before.eventId && e.importance >= 3 && e.type !== "YearEvent")
      .sort((a, b) => b.importance - a.importance || a.id - b.id)
      .slice(0, SKIP_DIGEST_EVENTS)
      .sort((a, b) => a.id - b.id),
    gate = civilizationGateStatus(),
    row = (label, key) =>
      `<span>${label}</span><b>${fmt(after[key])} ${skipDigestDelta(before[key], after[key])}</b>`;
  return `<p style="line-height:1.55;margin:0 0 10px">${esc(told)}</p><div class="kv">${row("People", "people")}${row("Towns", "towns")}${row("Polities", "polities")}${row("Crafts known", "crafts")}${row("Wars under way", "wars")}</div>${
    events.length
      ? `<div class="subhead">What the chronicle remembers</div>${events
          .map(
            (e) =>
              `<div class="legend-row" data-legend="event:${e.id}"><span class="legend-year">Y${e.year}</span><span>${linkedEventSentence(e)}</span></div>`,
          )
          .join("")}`
      : `<div class="subhead">A quiet stretch</div><div class="muted">Nothing the chronicle counts as notable happened between these years.</div>`
  }${
    gate && gate.missing?.length
      ? `<div class="subhead">Toward ${esc(titleCase(gate.next))}</div><div class="muted">${gate.leader ? `${esc(gate.leader)} still needs: ` : "Still needed: "}${esc(gate.missing.join(" · "))}</div>`
      : ""
  }`;
}
function showSkipDigest(before, after, told) {
  const from = formatYear(before.tick),
    to = formatYear(after.tick);
  openModal(
    from === to ? `Year ${to}` : `Years ${from} to ${to}`,
    skipDigestHTML(before, after, told),
    `<label class="row" style="gap:6px;margin-right:auto"><input type="checkbox" id="skipDigestOff"> Don't show this after a skip</label><button id="skipDigestAgain">Skip again</button><button id="skipDigestClose" class="primary">Continue</button>`,
  );
  $("#skipDigestClose").onclick = closeModal;
  $("#skipDigestAgain").onclick = () => {
    closeModal();
    causalSkipForward();
  };
  $("#skipDigestOff").onchange = (e) => storeExperiencePreference("skipDigest", !e.target.checked);
}
const causalSkipForwardDigestBase = causalSkipForward;
causalSkipForward = async function () {
  if (!W || UI.causalSkipActive) return causalSkipForwardDigestBase();
  const before = skipDigestSnapshot(),
    result = await causalSkipForwardDigestBase();
  if (!W || W.tick <= before.tick || !experiencePreference("skipDigest", true)) return result;
  showSkipDigest(before, skipDigestSnapshot(), DOM.causalSkipStatus?.textContent || "");
  return result;
};

window.ALIFE_SKIP_DIGEST_DEBUG = Object.freeze({
  snapshot: () => skipDigestSnapshot(),
  html: (before, told = "") => skipDigestHTML(before, skipDigestSnapshot(), told),
});
