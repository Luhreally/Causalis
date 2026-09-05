// ═══════════════════════════════════════════════════════════════════════════
// 62. LIQUID MIND — the controller becomes a real liquid time-constant network
// ═══════════════════════════════════════════════════════════════════════════
// Every creature already carried a small fixed-point controller: eight hidden
// neurons wired sparsely to thirty-two senses, a per-neuron time constant, a
// learned value per action, and an output layer that biases the behaviour
// scores. Its state update was an explicit Euler step toward a sigmoid target.
// Here the update becomes the liquid time-constant neuron of Hasani et al.:
//   dx/dt = -x/τ + f(x, I) · (A - x)
// where f is the input-dependent conductance and A the neuron's reversal
// potential, solved with the fused semi-implicit step
//   x' = (x + Δt·f·A) / (1 + Δt·(1/τ + f))
// which is stable for any Δt and gives each neuron a time constant that
// shortens under strong input. Everything stays in Q1024 integer arithmetic so
// it is deterministic on every engine. Reversal potentials join the genome and
// are inherited and mutated like the rest of the controller. The inspector
// gains a Mind card so the network is readable, not a black box.
const LTC_REV_DEFAULT = Object.freeze([1, 1, -1, 1, 1, -1, 1, 1]);
function ensureReversal(controller, id, parents = []) {
  if (controller.rev?.length === LTC_HIDDEN) return controller.rev;
  const a = W.components.genome[parents[0]]?.controller?.rev,
    b = W.components.genome[parents[1]]?.controller?.rev,
    rev = new Int16Array(LTC_HIDDEN);
  for (let i = 0; i < LTC_HIDDEN; i++) {
    let v;
    if (a && b) v = hashParts(W.seedHash, id, "ltc-rev-parent", i) & 1 ? a[i] : b[i];
    else if (a || b) v = (a || b)[i];
    else v = LTC_REV_DEFAULT[i] * (LTC_Q - 128 + (hashParts(W.seedHash, id, "ltc-rev", i) % 129));
    if (
      (a || b) &&
      counterRand("ltc-rev-mutation", id, i) < (W.laws?.mutationIntensity || 0.1) * 0.3
    )
      v = -v;
    rev[i] = clamp(Math.round(v), -LTC_Q, LTC_Q);
  }
  controller.rev = rev;
  controller.solver = "fused";
  return rev;
}
const makeLTCControllerMindBase = makeLTCController;
makeLTCController = function (id, kind, parents = []) {
  const controller = makeLTCControllerMindBase(id, kind, parents);
  ensureReversal(controller, id, parents);
  return controller;
};
const cloneGenomeMindBase = cloneGenome;
cloneGenome = function (g) {
  const q = cloneGenomeMindBase(g);
  if (g?.controller?.rev && q.controller) q.controller.rev = new Int16Array(g.controller.rev);
  return q;
};
// The fused step in Q arithmetic. x, A in [-Q, Q]; f in [0, Q]; τ in Q ticks.
function ltcFusedStepQ(stateQ, fQ, revQ, tauQ, dt) {
  const tau = Math.max(256, tauQ),
    numerator = (stateQ * LTC_Q + dt * fQ * revQ) * tau,
    denominator = LTC_Q * tau + dt * (LTC_Q * LTC_Q + fQ * tau);
  return clamp(Math.trunc(numerator / denominator), -LTC_Q, LTC_Q);
}
advanceLTC = function (id) {
  const g = W.components.genome[id],
    c = initCognition(id),
    inputs = cognitionInputs(id),
    dt = clamp(W.tick - c.lastTick, 1, 8),
    utility = cognitionUtilityQ(id),
    reward = clamp((utility - c.lastUtility) * 4 + c.pendingReward, -LTC_Q, LTC_Q),
    rev = ensureReversal(g.controller, id);
  c.inputs.set(inputs);
  if (c.lastAction >= 0) {
    const a = c.lastAction,
      rate = g.controller.plasticity;
    c.value[a] = clamp(
      c.value[a] + Math.round((rate * (reward - c.value[a])) / LTC_Q),
      -LTC_Q,
      LTC_Q,
    );
    for (let n = 0; n < LTC_OUTPUT_FAN; n++) {
      const pos = a * LTC_OUTPUT_FAN + n,
        h = (a * 3 + n * 5) % LTC_HIDDEN;
      c.plastic[pos] = clamp(
        c.plastic[pos] + Math.round((rate * reward * c.state[h]) / (LTC_Q * LTC_Q)),
        -384,
        384,
      );
    }
  }
  c.lastReward = reward;
  c.pendingReward = 0;
  c.lastUtility = utility;
  c.gate = resizedTyped(c.gate, Int16Array, LTC_HIDDEN);
  const next = new Int16Array(LTC_HIDDEN);
  for (let h = 0; h < LTC_HIDDEN; h++) {
    let drive = g.controller.leak[h] * 2;
    for (let n = 0; n < LTC_INPUT_FAN; n++) {
      const pos = h * LTC_INPUT_FAN + n,
        w = g.controller.input[pos],
        source = inputs[(pos * 13 + (pos >= inputs.length ? 7 : 0)) % inputs.length];
      drive += Math.round((w * source) / LTC_Q);
    }
    for (let n = 0; n < LTC_REC_FAN; n++) {
      const w = g.controller.rec[h * LTC_REC_FAN + n],
        source = c.state[(h + n + 1) % LTC_HIDDEN];
      drive += Math.round((w * source) / LTC_Q);
    }
    // The conductance is the liquid part: the neuron's rate is 1/τ + f, so a
    // strongly driven neuron answers fast and a quiet one drifts slowly.
    const f = fastSigmoidQ(drive);
    c.gate[h] = f;
    next[h] = ltcFusedStepQ(c.state[h], f, rev[h], g.controller.tau[h], dt);
  }
  c.state.set(next);
  let first = -1e9,
    second = -1e9,
    best = 0;
  for (let a = 0; a < LTC_ACTIONS.length; a++) {
    let raw = c.value[a];
    for (let n = 0; n < LTC_OUTPUT_FAN; n++) {
      const pos = a * LTC_OUTPUT_FAN + n,
        h = (a * 3 + n * 5) % LTC_HIDDEN;
      raw += Math.round(((g.controller.out[pos] + c.plastic[pos]) * c.state[h]) / LTC_Q);
    }
    c.value[a] = clamp(c.value[a], -LTC_Q, LTC_Q);
    const output = clamp(Math.round((LTC_Q * raw) / (LTC_Q + Math.abs(raw))), -LTC_Q, LTC_Q);
    c.output[a] = output;
    if (output > first) {
      second = first;
      first = output;
      best = a;
    } else if (output > second) second = output;
  }
  c.confidence = clamp(first - second, 0, LTC_Q);
  c.dominant = LTC_ACTIONS[best];
  c.lastAction = best;
  c.lastTick = W.tick;
  c.updates++;
  return c;
};
// ── The Mind card ──────────────────────────────────────────────────────────────
function mindCard(id) {
  const c = W.components.cognition?.[id],
    g = W.components.genome[id]?.controller;
  if (!c || !g) return "";
  const rev = g.rev || [],
    bars = Array.from(c.state)
      .map((v, h) => {
        const tau = ((g.tau?.[h] || LTC_Q) / LTC_Q).toFixed(1),
          gate = ((c.gate?.[h] || 0) / LTC_Q).toFixed(2),
          kind = (rev[h] || 1) >= 0 ? "excitatory" : "inhibitory";
        return `<div class="mind-neuron" title="Neuron ${h + 1}: state ${v}, τ ${tau} ticks, gate ${gate}, ${kind}"><i style="height:${Math.round((Math.abs(v) / LTC_Q) * 100)}%;background:${v >= 0 ? "#8fc07a" : "#e0645c"}"></i></div>`;
      })
      .join(""),
    senses = LTC_SENSE_LABELS.map((label, i) => [label, c.inputs?.[i] || 0])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, v]) => `${label} ${Math.round((v / LTC_Q) * 100)}%`)
      .join(" · "),
    drives = LTC_ACTIONS.map((a, i) => [a, c.output?.[i] || 0]).sort((a, b) => b[1] - a[1]);
  return `<div class="card mind-card"><div class="row between"><div class="subhead" style="margin:0">Mind</div><span class="tag" title="Liquid time-constant neurons solved with the fused semi-implicit step; deterministic integer arithmetic">liquid time-constant · fused solver</span></div><div class="kv"><span>Drive</span><b>${esc(titleCase(c.dominant || "wander"))} <span class="muted">· confidence ${Math.round(((c.confidence || 0) / LTC_Q) * 100)}%</span></b><span>Leanings</span><b>${drives
    .slice(0, 3)
    .map(([a, v]) => `${esc(titleCase(a))} ${v >= 0 ? "+" : ""}${Math.round((v / LTC_Q) * 100)}`)
    .join(
      " · ",
    )}</b><span>Senses</span><b>${esc(senses) || "quiet"}</b><span>Learning</span><b>${c.updates || 0} steps · changed ${c.influenceCount || 0} choice${
    c.influenceCount === 1 ? "" : "s"
  }${c.lastInfluence ? ` · last ${esc(c.lastInfluence)}` : ""} · plasticity ${g.plasticity}</b></div><div class="mind-neurons">${bars}</div></div>`;
}
const refreshInspectorMindBase = refreshInspector;
refreshInspector = function () {
  refreshInspectorMindBase();
  const id = UI.selectedEntity;
  if (!W || !id || !W.components.cognition?.[id] || !W.components.life?.[id] || !DOM.inspectPane)
    return;
  const card = mindCard(id);
  if (!card) return;
  const anchor =
    DOM.inspectPane.querySelector?.(".story-card") ||
    DOM.inspectPane.querySelector?.(".legend-entry");
  if (anchor?.insertAdjacentHTML) anchor.insertAdjacentHTML("afterend", card);
  else if (typeof DOM.inspectPane.insertAdjacentHTML === "function")
    DOM.inspectPane.insertAdjacentHTML("afterbegin", card);
  else DOM.inspectPane.innerHTML = card + DOM.inspectPane.innerHTML;
};
window.ALIFE_MIND_DEBUG = Object.freeze({
  step: (id) => {
    const c = advanceLTC(id);
    return {
      state: Array.from(c.state),
      gate: Array.from(c.gate || []),
      dominant: c.dominant,
      confidence: c.confidence,
    };
  },
  fused: (stateQ, fQ, revQ, tauQ, dt) => ltcFusedStepQ(stateQ, fQ, revQ, tauQ, dt),
  rev: (id) => Array.from(W.components.genome[id]?.controller?.rev || []),
  card: (id) => mindCard(id),
  q: LTC_Q,
});
