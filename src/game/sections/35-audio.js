// ═══════════════════════════════════════════════════════════════════════════
// 35. AUDIO GENERATION
// ═══════════════════════════════════════════════════════════════════════════
function initAudio() {
  if (audioCtx) return;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return;
  audioCtx = new AudioEngine();
  const gain = audioCtx.createGain(),
    osc = audioCtx.createOscillator(),
    filter = audioCtx.createBiquadFilter(),
    master = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = 54;
  filter.type = "lowpass";
  filter.frequency.value = 180;
  gain.gain.value = 0;
  master.gain.value = 0;
  master.connect(audioCtx.destination);
  osc.connect(filter).connect(gain).connect(master);
  osc.start();
  const noise = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate),
    samples = noise.getChannelData(0);
  let seed = 9147,
    soft = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    soft = soft * 0.96 + ((seed / 4294967296) * 2 - 1) * 0.04;
    samples[i] = soft * 3;
  }
  const source = audioCtx.createBufferSource(),
    rain = audioCtx.createGain(),
    rainFilter = audioCtx.createBiquadFilter(),
    wind = audioCtx.createGain(),
    windFilter = audioCtx.createBiquadFilter();
  source.buffer = noise;
  source.loop = true;
  rainFilter.type = "highpass";
  rainFilter.frequency.value = 850;
  windFilter.type = "lowpass";
  windFilter.frequency.value = 420;
  rain.gain.value = 0;
  wind.gain.value = 0.08;
  source.connect(rainFilter).connect(rain).connect(master);
  source.connect(windFilter).connect(wind).connect(master);
  source.start();
  ambientNode = { gain, osc, filter, master, rain, wind, source };
}
function setAudio(on, volume = 0.12) {
  try {
    if (on) initAudio();
    UI.audio = !!on && !!audioCtx;
    if (UI.audio) audioCtx.resume().catch(() => {});
    if (ambientNode) {
      ambientNode.master.gain.setTargetAtTime(
        UI.audio ? clamp(volume, 0, 0.5) : 0,
        audioCtx.currentTime,
        0.15,
      );
      ambientNode.gain.gain.setTargetAtTime(UI.audio ? 0.16 : 0, audioCtx.currentTime, 0.5);
    }
  } catch {
    UI.audio = false;
    toast("Sound is unavailable in this browser. You can keep playing.", "warn");
  }
}
function audioClick(freq = 260) {
  if (!UI.audio || !audioCtx) return;
  const o = audioCtx.createOscillator(),
    g = audioCtx.createGain();
  o.frequency.value = freq;
  o.type = "triangle";
  g.gain.setValueAtTime(0.15, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
  o.connect(g).connect(ambientNode.master);
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
  ambientNode.rain.gain.setTargetAtTime(
    /Rain|Storm/i.test(weather) ? 0.8 : 0,
    audioCtx.currentTime,
    1,
  );
  ambientNode.wind.gain.setTargetAtTime(
    /Storm|Drought/i.test(weather) ? 0.24 : 0.08,
    audioCtx.currentTime,
    1,
  );
}
let LAST_EXPERIENCE_CUE = -Infinity;
function playExperienceCue(kind) {
  if (!UI.audio || !audioCtx || !ambientNode?.master) return;
  const now = audioCtx.currentTime;
  if (now - LAST_EXPERIENCE_CUE < 0.12) return;
  LAST_EXPERIENCE_CUE = now;
  const notes =
    kind === "discovery"
      ? [392, 493.88, 587.33]
      : kind === "warning"
        ? [196, 185]
        : kind === "rain"
          ? [880, 1174, 988]
          : kind === "fire"
            ? [110, 73.42]
            : [330, 440];
  notes.forEach((frequency, n) => {
    const oscillator = audioCtx.createOscillator(),
      envelope = audioCtx.createGain(),
      start = now + n * 0.1,
      duration = kind === "discovery" ? 0.7 : 0.35;
    oscillator.type = kind === "fire" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * (kind === "rain" ? 0.6 : 1),
      start + duration,
    );
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(0.16, start + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(ambientNode.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  });
}
