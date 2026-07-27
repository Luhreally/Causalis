// ═══════════════════════════════════════════════════════════════════════════
// 8. ENVIRONMENTAL FIELDS
// ═══════════════════════════════════════════════════════════════════════════
function transferChem(from, to, species, amount) {
  amount = Math.max(0, Math.min(amount, from[species] || 0, 65535 - (to[species] || 0))) | 0;
  if (!amount) return 0;
  from[species] -= amount;
  to[species] = (to[species] || 0) + amount;
  return amount;
}
function diffusePair(arr, a, b, rate, delta) {
  const d = arr[a] - arr[b],
    flow = Math.trunc(d * rate);
  if (!flow) return;
  delta[a] -= flow;
  delta[b] += flow;
}
function updateEnvironmentalFields() {
  const t = W.tiles,
    y = W.tick % W.height,
    start = y * W.width,
    end = start + W.width,
    chemApplyEnd = Math.min(W.tileCount, end + W.width);
  for (const a of [C.SOLVENT, C.OXIDANT, C.TOXIN, C.WASTE, C.PATHOGEN, C.BLOOD, C.FEAR, C.GAS]) {
    const arr = t.chem[a],
      d = t.chemDelta[a],
      rate =
        a === C.SOLVENT
          ? W.laws.moistureDiffusion * 0.08
          : a === C.OXIDANT
            ? 0.055
            : a === C.PATHOGEN
              ? 0.025
              : 0.08;
    for (let i = start; i < end; i++) {
      if (i + 1 < end) diffusePair(arr, i, i + 1, rate, d);
      if (i + W.width < W.tileCount) diffusePair(arr, i, i + W.width, rate, d);
    }
    for (let i = start; i < chemApplyEnd; i++)
      if (d[i]) {
        arr[i] = u16(arr[i] + d[i]);
        d[i] = 0;
      }
  }
  const tempApplyEnd = Math.min(W.tileCount, end + W.width);
  for (let i = start; i < end; i++) {
    if (i + 1 < end) diffusePair(t.temperature, i, i + 1, W.laws.heatDiffusion * 0.02, t.tempDelta);
    if (i + W.width < W.tileCount)
      diffusePair(t.temperature, i, i + W.width, W.laws.heatDiffusion * 0.02, t.tempDelta);
    if (t.chem[C.BLOOD][i]) executeProcess("blood_decay", invTile(i), 1);
    if (t.chem[C.FEAR][i]) executeProcess("fear_decay", invTile(i), Math.min(2, t.chem[C.FEAR][i]));
    if (t.danger[i]) t.danger[i] = Math.max(0, Math.floor(t.danger[i] * 0.94) - 1);
    if (t.populationPressure[i]) t.populationPressure[i] = u16(t.populationPressure[i] * 0.998);
  }
  for (let i = start; i < tempApplyEnd; i++)
    if (t.tempDelta[i]) {
      t.temperature[i] = i16(t.temperature[i] + t.tempDelta[i]);
      t.tempDelta[i] = 0;
    }
}
