// ═══════════════════════════════════════════════════════════════════════════
// 35. AUDIO GENERATION
// ═══════════════════════════════════════════════════════════════════════════
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const gain = audioCtx.createGain(),
    osc = audioCtx.createOscillator(),
    filter = audioCtx.createBiquadFilter();
  osc.type = "sine";
  osc.frequency.value = 54;
  filter.type = "lowpass";
  filter.frequency.value = 180;
  gain.gain.value = 0;
  osc.connect(filter).connect(gain).connect(audioCtx.destination);
  osc.start();
  ambientNode = { gain, osc, filter };
}
function setAudio(on, volume = 0.12) {
  UI.audio = on;
  if (on) {
    initAudio();
    audioCtx.resume();
    ambientNode.gain.gain.setTargetAtTime(volume * 0.16, audioCtx.currentTime, 0.5);
  } else if (ambientNode) ambientNode.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
}
function audioClick(freq = 260) {
  if (!UI.audio || !audioCtx) return;
  const o = audioCtx.createOscillator(),
    g = audioCtx.createGain();
  o.frequency.value = freq;
  o.type = "triangle";
  g.gain.setValueAtTime(0.025, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + 0.09);
}
function updateAudioAmbience() {
  if (!UI.audio || !ambientNode || !W) return;
  const burning = sampleField((i) => W.tiles.fire[i] / 1000),
    weather = W.weather.name;
  ambientNode.osc.frequency.setTargetAtTime(
    weather.includes("Rain") ? 47 : burning > 0.05 ? 62 : 54,
    audioCtx.currentTime,
    0.8,
  );
  ambientNode.filter.frequency.setTargetAtTime(
    weather.includes("Rain") ? 330 : burning > 0.05 ? 240 : 180,
    audioCtx.currentTime,
    1,
  );
}
