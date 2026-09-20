// ═══════════════════════════════════════════════════════════════════════════
// 141. SETTLED INTENT — the inspector reads what a life is doing, not the tick
// ═══════════════════════════════════════════════════════════════════════════
// A life on a grown battery world (causal-origin at year forty, four hundred
// ticks, sixty-nine people) steps almost every tick, reverses forty-three
// steps in a hundred, and changes its behaviour word twenty-eight times in a
// hundred ticks: it weighs two needs and takes a step toward each in turn.
// The figure's shuttle is settled by the walk (32d, a shuttling walker aims
// between its two tiles); the inspector's "Behavior" and "Why?" lines still
// flickered at the refresh rate between "food" and "return" and back. Now
// the inspector keeps the last dozen readings of a selected life, taken as
// it is drawn, and shows the one that held most, with the reason given the
// last time that word was read; the tick's own word is shown beside it only
// when it differs, in the muted voice. The samples live beside the world, so
// reading them writes nothing to it, and a paused world holds its reading.
const INTENT_SAMPLES = 12,
  INTENT_STALE_MS = 6000,
  INTENT = { world: null, byId: new Map(), notes: 0 };
function intentSamplesOf(id) {
  if (INTENT.world !== W) {
    INTENT.world = W;
    INTENT.byId = new Map();
  }
  let s = INTENT.byId.get(id);
  if (!s) {
    s = { words: [], reasons: new Map(), at: 0 };
    INTENT.byId.set(id, s);
  }
  return s;
}
function noteIntent(id, now = performance.now()) {
  const l = W?.components?.life?.[id];
  if (!l) return null;
  const s = intentSamplesOf(id),
    word = l.behavior || "";
  if (now - s.at > INTENT_STALE_MS) s.words.length = 0;
  s.at = now;
  s.words.push(word);
  if (s.words.length > INTENT_SAMPLES) s.words.shift();
  if (word) s.reasons.set(word, l.behaviorReason || "");
  INTENT.notes++;
  return s;
}
// The word that held most among the recent readings; the latest breaks a tie.
function settledIntent(id) {
  const l = W?.components?.life?.[id];
  if (!l) return null;
  const s = intentSamplesOf(id),
    words = s.words.length ? s.words : [l.behavior || ""],
    counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  let best = words[words.length - 1],
    bestCount = -1;
  for (const w of words) {
    const c = counts.get(w);
    if (c > bestCount || (c === bestCount && w === words[words.length - 1])) {
      best = w;
      bestCount = c;
    }
  }
  return {
    word: best,
    reason: s.reasons.get(best) || (best === (l.behavior || "") ? l.behaviorReason || "" : ""),
    current: l.behavior || "",
    held: words.length ? bestCount / words.length : 1,
    samples: words.length,
  };
}
function intentLabel(id, fallback = "Observing its surroundings") {
  const s = settledIntent(id);
  if (!s) return fallback;
  const word = s.word || fallback;
  return s.current && s.current !== s.word ? `${word} <span class="muted">(now ${esc(s.current)})</span>` : esc(word);
}
const organismInspectorIntentBase = organismInspector;
organismInspector = function (id) {
  const html = organismInspectorIntentBase(id);
  const l = W?.components?.life?.[id];
  if (!l) return html;
  noteIntent(id);
  const s = settledIntent(id);
  // The label is a span in the plain inspector and an explain button under the field guide (38).
  return html
    .replace(/(Behavior<\/(?:span|button)>)<b>[^<]*<\/b>/, `$1<b>${s.word ? intentLabel(id) : "none"}</b>`)
    .replace(/(Why\?<\/(?:span|button)>)<b>[^<]*<\/b>/, `$1<b>${esc(s.reason || l.behaviorReason || "no active need")}</b>`);
};
const selectionSummaryIntentBase = selectionSummaryMarkup;
selectionSummaryMarkup = function () {
  const id = UI.selectedEntity,
    life = id && W?.components?.life?.[id];
  if (!life) return selectionSummaryIntentBase();
  noteIntent(id);
  const s = settledIntent(id),
    html = selectionSummaryIntentBase();
  return html.replace(
    esc(titleCase(W.kind[id]) + " · " + (life.behavior || "Observing its surroundings")),
    esc(titleCase(W.kind[id]) + " · ") + intentLabel(id),
  );
};
window.ALIFE_INTENT_DEBUG = Object.freeze({
  note: (id, now) => noteIntent(id, now),
  settled: (id) => settledIntent(id),
  samples: (id) => [...intentSamplesOf(id).words],
  counts: () => ({ notes: INTENT.notes, tracked: INTENT.byId.size }),
});
