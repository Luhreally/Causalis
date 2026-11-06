// What is heard (Sound, first slice; Classic's section 35, "there is no sound"): every place its own
// air and what happens its own short sound, all made here in the browser from noise and oscillators,
// with no file to load. It hears and never touches: nothing here reaches the world, its randomness is
// its own, and the page tells it what is about (a few times a second, only as it changes).
//
// The graph is bounded: a fixed set of layers, built once at the first touch, whose levels move for
// every crossfade, and short voices over them up to a limit. Layers at nothing are unplugged; with 🔊
// off, or the tab hidden, the context is suspended and its timer stopped; nothing ever starts it
// before a person's touch. A browser with no WebAudio has no button and no sound, and runs the same.
import "./sound.css";
import {
  CUES,
  CUE_LASTS,
  CUE_RULES,
  NODE_BOUND,
  airOf,
  cueAllowed,
  mixOf,
  type Air,
  type Cue,
  type Mix,
} from "./sound-mix.ts";

const STORE = "causalis.sound";
/** The whole of it, under what a phone's speaker can stand: never a surprise. */
const VOLUME = 0.72;
/** How long a crossfade takes to get most of the way (s, the time constant of its fade). */
const FADE = 0.55;
/** The voices at once: the world's small sounds, then cues, then the greatest. Three nodes each at most. */
const VOICES_SMALL = 10,
  VOICES_CUE = 20,
  VOICES_ALL = 26;
/** The rates of the small sounds are worked out over this much of the future, this often (s). */
const AHEAD = 0.7,
  PUMP_MS = 400;
/** Modes whose chrome puts the corner tools away: 🔊 stays, standing by itself. */
const CHROMELESS = ["filming", "fleet-filming", "living", "possessing", "ruling", "homing"];

type Rand = () => number;
const randOf = (seed: number): Rand => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A loop's end crossed into its start, so no click marks its turn. */
function seam(a: Float32Array, n: number): void {
  const len = a.length - n;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    a[i] = a[i]! * k + a[len + i]! * (1 - k);
  }
}

function peakTo(chs: Float32Array[], to: number): void {
  let hi = 1e-6;
  for (const c of chs) for (let i = 0; i < c.length; i++) hi = Math.max(hi, Math.abs(c[i]!));
  const k = to / hi;
  for (const c of chs) for (let i = 0; i < c.length; i++) c[i]! *= k;
}

function bufferOf(chs: Float32Array[], rate: number, trim = 0): AudioBuffer {
  const length = chs[0]!.length - trim,
    b = new AudioBuffer({ numberOfChannels: chs.length, length, sampleRate: rate });
  chs.forEach((c, i) => b.copyToChannel(c.subarray(0, length) as Float32Array<ArrayBuffer>, i));
  return b;
}

/** Everything a graph plays from: noise, and the loops that would cost nodes to make live. */
type Loops = {
  white: AudioBuffer;
  brown: AudioBuffer;
  surf: AudioBuffer;
  rain: AudioBuffer;
  murmur: AudioBuffer;
  crickets: AudioBuffer;
};

function loopMakers(seed: number) {
  const r = randOf(seed);
  const white = () => {
    const rate = 32000,
      chs = [new Float32Array(rate * 3), new Float32Array(rate * 3)];
    for (const c of chs) for (let i = 0; i < c.length; i++) c[i] = 2 * r() - 1;
    return bufferOf(chs, rate);
  };
  const brown = () => {
    const rate = 16000,
      over = 1600,
      chs = [new Float32Array(rate * 4 + over), new Float32Array(rate * 4 + over)];
    for (const c of chs) {
      let y = 0;
      for (let i = 0; i < c.length; i++) {
        y = (y + 0.04 * (2 * r() - 1)) * 0.996;
        c[i] = y;
      }
      seam(c, over);
    }
    peakTo(chs, 0.95);
    return bufferOf(chs, rate, over);
  };
  // The sea: three waves in the loop, not alike, each a swell, a break and a long wash back.
  const surf = () => {
    const rate = 16000,
      seconds = 21,
      n = rate * seconds,
      chs = [new Float32Array(n), new Float32Array(n)],
      waves = [
        { at: 1.5, rise: 2.6, fall: 3.6, big: 1 },
        { at: 8.6, rise: 2.1, fall: 3, big: 0.72 },
        { at: 14.6, rise: 2.9, fall: 4, big: 0.9 },
      ];
    const shape = (t: number) => {
      let e = 0.05;
      for (const w of waves)
        for (const d of [t - w.at, t - w.at - seconds, t - w.at + seconds]) {
          if (d < -w.rise) continue;
          const v = d < 0 ? Math.pow(1 + d / w.rise, 2.4) : Math.exp(-d / w.fall);
          e = Math.max(e, w.big * v);
        }
      return e;
    };
    for (const [ci, c] of chs.entries()) {
      let lo = 0,
        hi = 0,
        e = 0;
      for (let i = 0; i < n; i++) {
        if ((i & 31) === 0) e = shape((i + ci * 1600) / rate);
        const x = 2 * r() - 1;
        // (Dark as it swells; bright and hissing as it breaks.)
        lo += (0.03 + 0.55 * e * e) * (x - lo);
        hi += 0.35 * (x - hi);
        c[i] = e * (lo * 1.2 + (x - hi) * 0.28 * e);
      }
    }
    peakTo(chs, 0.92);
    return bufferOf(chs, rate);
  };
  // Rain: a hiss, and drops striking.
  const rain = () => {
    const rate = 22050,
      n = rate * 4,
      chs = [new Float32Array(n), new Float32Array(n)];
    for (const c of chs) {
      let last = 0;
      for (let i = 0; i < n; i++) {
        const x = 2 * r() - 1;
        c[i] = (x - last) * 0.2;
        last = x;
      }
      for (let d = 0; d < 1400; d++) {
        const at = Math.floor(r() * n),
          f = (900 + 3800 * r()) / rate,
          big = 0.05 + 0.3 * r() * r(),
          len = 40 + Math.floor(r() * 90);
        for (let i = 0; i < len; i++)
          c[(at + i) % n]! += big * Math.sin(2 * Math.PI * f * i) * Math.exp((-5 * i) / len);
      }
    }
    peakTo(chs, 0.9);
    return bufferOf(chs, rate);
  };
  // People talking, no word of it clear: a dozen voices, each its pitch and its breath, syllable by syllable.
  const murmur = () => {
    const rate = 12000,
      seconds = 8,
      n = rate * seconds,
      chs = [new Float32Array(n), new Float32Array(n)];
    for (let talker = 0; talker < 9; talker++) {
      const pitch = 95 + 140 * r(),
        pan = r(),
        far = 0.45 + 0.55 * r();
      let t = r() * 2;
      while (t < seconds) {
        const syllables = 2 + Math.floor(r() * 6);
        for (let s = 0; s < syllables && t < seconds; s++) {
          const len = 0.1 + 0.2 * r(),
            count = Math.floor(len * rate),
            f1 = (350 + 500 * r()) / rate,
            f2 = (950 + 1300 * r()) / rate,
            hz = pitch * (0.9 + 0.3 * r()),
            from = Math.floor(t * rate);
          let a1 = 0,
            b1 = 0,
            a2 = 0,
            b2 = 0;
          for (let i = 0; i < count; i++) {
            const phase = (i * hz) / rate,
              pulse = phase - Math.floor(phase) < 0.08 ? 1 : 0,
              breath = 0.15 * (2 * r() - 1),
              x = pulse + breath,
              env = Math.sin((Math.PI * i) / count);
            // (Two resonators: the mouth's shape on this syllable.)
            a1 += 2 * Math.sin(Math.PI * f1) * (x - b1 - 0.24 * a1);
            b1 += 2 * Math.sin(Math.PI * f1) * a1;
            a2 += 2 * Math.sin(Math.PI * f2) * (x - b2 - 0.2 * a2);
            b2 += 2 * Math.sin(Math.PI * f2) * a2;
            const out = env * far * (a1 * 0.7 + a2 * 0.5),
              at = (from + i) % n;
            chs[0]![at]! += out * (1 - pan);
            chs[1]![at]! += out * pan;
          }
          t += len + 0.02 + 0.09 * r();
        }
        t += 0.2 + 1.2 * r();
      }
    }
    peakTo(chs, 0.95);
    return bufferOf(chs, rate);
  };
  // Night's insects: two kinds, each its own pitch and pulse.
  const crickets = () => {
    const rate = 22050,
      n = rate * 5,
      chs = [new Float32Array(n), new Float32Array(n)];
    const kinds = [
      { hz: 4300, pulse: 26, every: 0.86, burst: 0.3, big: 1, side: 0.25 },
      { hz: 4950, pulse: 34, every: 1.25, burst: 0.42, big: 0.6, side: 0.8 },
      { hz: 3700, pulse: 19, every: 1.0, burst: 0.25, big: 0.45, side: 0.5 },
    ];
    for (const k of kinds)
      for (let i = 0; i < n; i++) {
        const t = i / rate,
          b = t / k.every,
          inBurst = b - Math.floor(b) < k.burst / k.every,
          beat = 0.5 + 0.5 * Math.sin(2 * Math.PI * k.pulse * t);
        if (!inBurst) continue;
        const v = k.big * beat * beat * Math.sin(2 * Math.PI * k.hz * t);
        chs[0]![i]! += v * (1 - k.side);
        chs[1]![i]! += v * k.side;
      }
    peakTo(chs, 0.9);
    return bufferOf(chs, rate);
  };
  return { white, brown, surf, rain, murmur, crickets };
}

/** All the loops at once (an offline render, which holds nothing up). */
function makeLoops(seed: number): Loops {
  const m = loopMakers(seed);
  return {
    white: m.white(),
    brown: m.brown(),
    surf: m.surf(),
    rain: m.rain(),
    murmur: m.murmur(),
    crickets: m.crickets(),
  };
}

/** The loops one at a time, a breath between each: the first touch is not held up by them. The longest one taken, in `worst`. */
async function loopsInTurn(seed: number, worst: { ms: number }): Promise<Loops> {
  const m = loopMakers(seed),
    out = {} as Loops;
  for (const name of ["white", "brown", "rain", "crickets", "murmur", "surf"] as const) {
    await new Promise((r) => setTimeout(r, 0));
    const from = performance.now();
    out[name] = m[name]();
    worst.ms = Math.max(worst.ms, performance.now() - from);
  }
  return out;
}

type Tone = {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  at: number;
  len: number;
  gain: number;
  attack?: number;
  to?: AudioNode;
};
type Burst = {
  from: "white" | "brown";
  kind: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
  at: number;
  len: number;
  gain: number;
  attack?: number;
  to?: AudioNode;
};

/** The graph itself, on any context: the live one, or an offline one for a measured render. */
class Graph {
  readonly ctx: BaseAudioContext;
  readonly loops: Loops;
  private readonly rand: Rand;
  readonly limited: boolean;
  nodes = 0;
  nodesPeak = 0;
  voices = 0;
  voicesPeak = 0;
  awake = 0;
  private duckUntil = 0;
  readonly master: GainNode;
  /** The output, after the limiter: what a speaker gets. */
  readonly out: GainNode;
  private readonly amb: GainNode;
  private readonly water: BiquadFilterNode;
  private readonly level: GainNode;
  private readonly dry: GainNode;
  private readonly cueBus: GainNode;
  private readonly pans: StereoPannerNode[];
  // The layers.
  private readonly gains: Record<
    "wind" | "high" | "surf" | "rain" | "crowd" | "crickets" | "pad" | "shimmer" | "rumble",
    { gain: GainNode; bus: AudioNode; on: boolean; offAt: number }
  >;
  private readonly windLp: BiquadFilterNode;
  private readonly crowdBp: BiquadFilterNode;
  private readonly crowdSrc: AudioBufferSourceNode;
  private readonly padOsc: OscillatorNode[];
  private readonly padLp: BiquadFilterNode;
  private readonly shimmerOsc: OscillatorNode[];
  private readonly rumbleOsc: OscillatorNode;
  private readonly rumbleLp: BiquadFilterNode;
  private shown: Mix | null = null;

  constructor(ctx: BaseAudioContext, seed: number, limited: boolean, loops?: Loops) {
    this.ctx = ctx;
    this.rand = randOf(seed ^ 0x51ed27);
    this.limited = limited;
    this.loops = loops ?? makeLoops(seed);
    const gainOf = (v: number) => {
      const g = this.n(ctx.createGain());
      g.gain.value = v;
      return g;
    };
    this.master = gainOf(limited ? 0 : VOLUME);
    const comp = this.n(ctx.createDynamicsCompressor());
    comp.threshold.value = -9;
    comp.knee.value = 9;
    comp.ratio.value = 10;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    // (A last soft ceiling: nothing past it, whatever comes.)
    const clip = this.n(ctx.createWaveShaper()),
      curve = new Float32Array(1025);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / 512 - 1) * 1.6;
      curve[i] = 0.93 * Math.tanh(x / 0.93);
    }
    clip.curve = curve;
    this.out = gainOf(1);
    this.master.connect(comp).connect(clip).connect(this.out).connect(ctx.destination);
    this.level = gainOf(1);
    this.level.connect(this.master);
    this.water = this.n(ctx.createBiquadFilter());
    this.water.type = "lowpass";
    this.water.frequency.value = 16000;
    this.water.Q.value = 0.7;
    this.water.connect(this.level);
    this.amb = gainOf(1);
    this.amb.connect(this.water);
    this.dry = gainOf(1);
    this.dry.connect(this.level);
    this.cueBus = gainOf(1);
    this.cueBus.connect(this.master);
    this.pans = [-0.7, 0, 0.7].map((p) => {
      const s = this.n(ctx.createStereoPanner());
      s.pan.value = p;
      s.connect(this.amb);
      return s;
    });
    const r = this.rand,
      loop = (b: AudioBuffer) => {
        const s = this.n(ctx.createBufferSource());
        s.buffer = b;
        s.loop = true;
        s.start(0, r() * b.duration);
        return s;
      },
      osc = (type: OscillatorType, hz: number) => {
        const o = this.n(ctx.createOscillator());
        o.type = type;
        o.frequency.value = hz;
        o.start();
        return o;
      },
      filter = (type: BiquadFilterType, hz: number, q = 0.7) => {
        const f = this.n(ctx.createBiquadFilter());
        f.type = type;
        f.frequency.value = hz;
        f.Q.value = q;
        return f;
      },
      layer = (bus: AudioNode) => ({ gain: gainOf(0), bus, on: false, offAt: 0 });
    this.gains = {
      wind: layer(this.amb),
      high: layer(this.amb),
      surf: layer(this.amb),
      rain: layer(this.amb),
      crowd: layer(this.amb),
      crickets: layer(this.amb),
      pad: layer(this.dry),
      shimmer: layer(this.dry),
      rumble: layer(this.dry),
    };
    // Wind: brown noise, its edge and its strength each moved slowly by a gust (8 nodes). What lies under
    // the high-pass is what a phone's speaker can't give, and would only press on the limiter.
    this.windLp = filter("lowpass", 500);
    const windHp = filter("highpass", 150);
    loop(this.loops.brown).connect(windHp).connect(this.windLp).connect(this.gains.wind.gain);
    const gust = osc("sine", 0.13 + 0.05 * r()),
      gustHz = gainOf(180),
      gustGain = gainOf(0.2);
    gust.connect(gustHz).connect(this.windLp.frequency);
    gust.connect(gustGain).connect(this.gains.wind.gain.gain);
    // High thin wind: white noise, narrow, moved by the same gust (4 nodes).
    const highBp = filter("bandpass", 2600, 0.5),
      highSweep = gainOf(900);
    loop(this.loops.white).connect(highBp).connect(this.gains.high.gain);
    gust.connect(highSweep).connect(highBp.frequency);
    // The sea, the rain, the insects: their own loops (2 nodes each).
    loop(this.loops.surf).connect(this.gains.surf.gain);
    loop(this.loops.rain).connect(this.gains.rain.gain);
    loop(this.loops.crickets).connect(this.gains.crickets.gain);
    // A crowd: voices, the band of them moved by what it is (3 nodes).
    this.crowdSrc = loop(this.loops.murmur);
    this.crowdBp = filter("bandpass", 900, 0.6);
    this.crowdSrc.connect(this.crowdBp).connect(this.gains.crowd.gain);
    // The drone: three notes through a slowly moving lowpass (7 nodes).
    this.padLp = filter("lowpass", 400, 1.1);
    this.padOsc = [osc("sawtooth", 55), osc("triangle", 82), osc("sawtooth", 110)];
    this.padOsc[0]!.detune.value = -5;
    this.padOsc[2]!.detune.value = 6;
    for (const o of this.padOsc) o.connect(this.padLp);
    this.padLp.connect(this.gains.pad.gain);
    const padLfo = osc("sine", 0.047),
      padSweep = gainOf(160);
    padLfo.connect(padSweep).connect(this.padLp.frequency);
    // Glass over the drone: three high partials, beating, breathing (6 nodes).
    this.shimmerOsc = [1, 1.498, 2.01].map((k) => osc("sine", 1760 * k));
    const shimmerIn = gainOf(0.34),
      breathe = osc("sine", 0.19);
    for (const o of this.shimmerOsc) o.connect(shimmerIn);
    shimmerIn.connect(this.gains.shimmer.gain);
    breathe.connect(gainOf(0.2)).connect(shimmerIn.gain);
    // Under everything, low (4 nodes).
    this.rumbleOsc = osc("sine", 40);
    this.rumbleLp = filter("lowpass", 90);
    this.rumbleOsc.connect(this.rumbleLp);
    loop(this.loops.brown).connect(this.rumbleLp).connect(this.gains.rumble.gain);
  }

  private n<T extends AudioNode>(node: T): T {
    this.nodes++;
    if (this.nodes > this.nodesPeak) this.nodesPeak = this.nodes;
    return node;
  }

  /** The air moved to this mix: every level on its way there at once, from where it stands. */
  apply(m: Mix, at: number, fade = FADE): void {
    const was = this.shown,
      set = (p: AudioParam, v: number, last: number | undefined, tc = fade) => {
        if (last === undefined || Math.abs(last - v) > 1e-4) p.setTargetAtTime(v, at, tc);
      },
      lay = (name: keyof Graph["gains"], v: number) => {
        const L = this.gains[name];
        if (v > 0 && !L.on) {
          L.gain.connect(L.bus);
          L.on = true;
          this.awake++;
        }
        L.offAt = v > 0 ? 0 : L.offAt || at + fade * 8;
        set(L.gain.gain, v, was?.[name]);
      };
    lay("wind", m.wind);
    lay("high", m.high);
    lay("surf", m.surf);
    lay("rain", m.rain);
    lay("crowd", m.crowd);
    lay("crickets", m.crickets);
    lay("pad", m.pad);
    lay("shimmer", m.shimmer);
    lay("rumble", m.rumble);
    set(this.windLp.frequency, m.windHz, was?.windHz);
    set(this.crowdBp.frequency, m.crowdHz, was?.crowdHz);
    set(this.crowdSrc.playbackRate, m.crowdRate, was?.crowdRate);
    set(this.padLp.frequency, m.padHz, was?.padHz);
    if (!was || was.padRoot !== m.padRoot || was.padUp !== m.padUp || was.padUp2 !== m.padUp2) {
      set(this.padOsc[0]!.frequency, m.padRoot, undefined);
      set(this.padOsc[1]!.frequency, m.padRoot * m.padUp, undefined);
      set(this.padOsc[2]!.frequency, m.padRoot * m.padUp2, undefined);
    }
    if (!was || was.shimmerHz !== m.shimmerHz)
      [1, 1.498, 2.01].forEach((k, i) =>
        set(this.shimmerOsc[i]!.frequency, m.shimmerHz * k, undefined),
      );
    set(this.rumbleOsc.frequency, m.rumbleHz, was?.rumbleHz);
    set(this.rumbleLp.frequency, m.rumbleHz * 2.2, was?.rumbleHz ? was.rumbleHz * 2.2 : undefined);
    set(this.water.frequency, m.waterHz, was?.waterHz, 0.3);
    // (A greatest fire's silence is kept to the end of it.)
    set(this.level.gain, m.level, was?.level);
    if (at < this.duckUntil) this.level.gain.setTargetAtTime(m.level, this.duckUntil, 6);
    this.shown = m;
  }

  /** The layers long at nothing unplugged, so nothing behind them is worked out. */
  rest(now: number): void {
    for (const L of Object.values(this.gains))
      if (L.on && L.offAt > 0 && now > L.offAt) {
        L.gain.disconnect();
        L.on = false;
        this.awake--;
      }
  }

  private room(limit: number): boolean {
    return !this.limited || this.voices < limit;
  }

  private tone(t: Tone, limit: number): void {
    if (!this.room(limit)) return;
    const c = this.ctx,
      o = this.n(c.createOscillator()),
      g = this.n(c.createGain()),
      attack = t.attack ?? 0.004;
    o.type = t.type ?? "sine";
    o.frequency.setValueAtTime(t.f0, t.at);
    if (t.f1) o.frequency.exponentialRampToValueAtTime(t.f1, t.at + t.len);
    g.gain.setValueAtTime(0, t.at);
    g.gain.linearRampToValueAtTime(t.gain, t.at + attack);
    g.gain.exponentialRampToValueAtTime(0.0004, t.at + t.len);
    o.connect(g).connect(t.to ?? this.cueBus);
    this.voice(o, [o, g], t.at, t.at + t.len + 0.02);
  }

  private burst(b: Burst, limit: number): void {
    if (!this.room(limit)) return;
    const c = this.ctx,
      s = this.n(c.createBufferSource()),
      f = this.n(c.createBiquadFilter()),
      g = this.n(c.createGain()),
      attack = b.attack ?? 0.004,
      from = this.loops[b.from];
    s.buffer = from;
    s.loop = true;
    f.type = b.kind;
    f.Q.value = b.q ?? 0.7;
    f.frequency.setValueAtTime(b.f0, b.at);
    if (b.f1) f.frequency.exponentialRampToValueAtTime(b.f1, b.at + b.len);
    g.gain.setValueAtTime(0, b.at);
    g.gain.linearRampToValueAtTime(b.gain, b.at + attack);
    g.gain.exponentialRampToValueAtTime(0.0004, b.at + b.len);
    s.connect(f)
      .connect(g)
      .connect(b.to ?? this.cueBus);
    this.voice(s, [s, f, g], b.at, b.at + b.len + 0.02, this.rand() * from.duration);
  }

  private voice(
    src: AudioScheduledSourceNode,
    parts: AudioNode[],
    at: number,
    end: number,
    offset?: number,
  ): void {
    this.voices++;
    if (this.voices > this.voicesPeak) this.voicesPeak = this.voices;
    if (offset === undefined) src.start(at);
    else (src as AudioBufferSourceNode).start(at, offset);
    src.stop(end);
    src.onended = () => {
      for (const p of parts) p.disconnect();
      this.nodes -= parts.length;
      this.voices--;
    };
  }

  /** A second or so of the small sounds of a place, each as often as its rate says, from `from` to `to`. */
  sprinkle(m: Mix, from: number, to: number): void {
    const r = this.rand,
      span = to - from,
      times = (rate: number, each: (at: number) => void) => {
        let n = rate * span;
        while (n > 0) {
          if (n >= 1 || r() < n) each(from + r() * span);
          n -= 1;
        }
      },
      pan = () => this.pans[Math.floor(r() * 3)]!;
    const small = VOICES_SMALL;
    times(m.birds, (at) => {
      // A call: a few quick notes, its own for each bird.
      const notes = 3 + Math.floor(r() * 4),
        hz = 2300 + r() * 2600,
        to_ = pan();
      for (let i = 0; i < notes; i++)
        this.tone(
          {
            f0: hz * (1 + 0.25 * r()),
            f1: hz * (0.8 + 0.5 * r()),
            at: at + i * (0.07 + 0.05 * r()),
            len: 0.06,
            gain: 0.05,
            to: to_,
          },
          small,
        );
    });
    times(m.gulls, (at) => {
      const to_ = pan();
      for (let i = 0; i < 3; i++)
        this.tone(
          {
            type: "triangle",
            f0: 1600 - 60 * i,
            f1: 980,
            at: at + i * 0.3,
            len: 0.26,
            attack: 0.05,
            gain: 0.05,
            to: to_,
          },
          small,
        );
    });
    times(m.owls, (at) => {
      for (let i = 0; i < 2; i++)
        this.tone(
          { f0: 410, f1: 375, at: at + i * 0.62, len: 0.5, attack: 0.08, gain: 0.05, to: pan() },
          small,
        );
    });
    times(m.tinks, (at) => {
      // A hammer on an anvil, across the town.
      const hz = 1500 + 1400 * r(),
        to_ = pan(),
        blows = 1 + Math.floor(r() * 3);
      for (let i = 0; i < blows; i++) {
        this.tone({ f0: hz, at: at + i * 0.42, len: 0.18, gain: 0.05, to: to_ }, small);
        this.tone({ f0: hz * 2.76, at: at + i * 0.42, len: 0.09, gain: 0.022, to: to_ }, small);
      }
    });
    times(m.hawkers, (at) => {
      // Someone crying their wares, no word of it clear.
      const hz = 240 + 220 * r(),
        to_ = pan();
      this.tone(
        {
          type: "sawtooth",
          f0: hz,
          f1: hz * 1.28,
          at,
          len: 0.32,
          attack: 0.05,
          gain: 0.035,
          to: to_,
        },
        small,
      );
      this.tone(
        {
          type: "sawtooth",
          f0: hz * 1.26,
          f1: hz * 0.84,
          at: at + 0.3,
          len: 0.44,
          attack: 0.03,
          gain: 0.035,
          to: to_,
        },
        small,
      );
    });
    times(m.bells, (at) => {
      const hz = 340 + 40 * r(),
        to_ = pan();
      for (const [k, g, len] of [
        [1, 0.1, 1.5],
        [2.01, 0.05, 1],
        [2.76, 0.03, 0.6],
      ] as const)
        this.tone({ f0: hz * k, at, len, gain: g, to: to_ }, small);
    });
    times(m.drums, (at) => {
      this.tone({ f0: 150, f1: 62, at, len: 0.3, gain: 0.2, to: this.dry }, small);
      this.burst(
        {
          from: "brown",
          kind: "lowpass",
          f0: 420,
          f1: 90,
          at,
          len: 0.2,
          gain: 0.16,
          to: this.dry,
        },
        small,
      );
    });
    times(m.clashes, (at) => {
      // Iron on iron.
      const to_ = pan(),
        hz = 2200 + 2600 * r();
      this.burst(
        { from: "white", kind: "bandpass", f0: hz, q: 3, at, len: 0.07, gain: 0.3, to: to_ },
        small,
      );
      this.tone({ f0: hz * 1.31, at, len: 0.16, gain: 0.03, to: to_ }, small);
    });
    times(m.shots, (at) => {
      this.burst(
        {
          from: "white",
          kind: "lowpass",
          f0: 3200,
          f1: 240,
          at,
          len: 0.32,
          gain: 0.28,
          to: pan(),
        },
        small,
      );
    });
    times(m.bubbles, (at) => {
      const runs = 1 + Math.floor(r() * 4),
        hz = 180 + 280 * r();
      for (let i = 0; i < runs; i++)
        this.tone(
          {
            f0: hz * (1 + i * 0.1),
            f1: hz * (2 + i * 0.2),
            at: at + i * (0.08 + 0.1 * r()),
            len: 0.1,
            attack: 0.012,
            gain: 0.09,
            to: this.dry,
          },
          small,
        );
    });
    times(m.moans, (at) => {
      const hz = 90 + 60 * r();
      this.tone(
        { f0: hz, f1: hz * 0.72, at, len: 3.2, attack: 1.1, gain: 0.11, to: this.dry },
        small,
      );
    });
    times(m.plucks, (at) => {
      // A slow bell-like note over the title's drone, drawn from no scale's tune: no two runs alike.
      const stair = [3, 4, 4.5, 6, 6.75, 8, 9];
      this.tone(
        {
          type: "triangle",
          f0: m.padRoot * stair[Math.floor(r() * stair.length)]!,
          at,
          len: 2.1,
          attack: 0.008,
          gain: 0.075,
          to: pan(),
        },
        small,
      );
    });
    times(m.dance, (at) => {
      // Hand drums, and hands, in a lilt.
      for (let i = 0; i < 3; i++)
        this.tone(
          { f0: 180, f1: 120, at: at + i * 0.21, len: 0.14, gain: i === 0 ? 0.12 : 0.07 },
          small,
        );
      this.burst(
        { from: "white", kind: "bandpass", f0: 1800, q: 0.9, at: at + 0.42, len: 0.06, gain: 0.06 },
        small,
      );
    });
  }

  /** A short sound, from `at`, at this level. */
  cue(cue: Cue, at: number, level: number): void {
    const L = level,
      r = this.rand,
      lim = VOICES_CUE,
      top = VOICES_ALL;
    switch (cue) {
      case "press":
        this.tone({ f0: 1240, f1: 860, at, len: 0.05, gain: L }, top);
        this.burst(
          { from: "white", kind: "highpass", f0: 5000, at, len: 0.014, gain: L * 0.35 },
          top,
        );
        break;
      case "page":
        this.tone({ type: "triangle", f0: 520, f1: 545, at, len: 0.09, gain: L }, top);
        this.tone({ type: "triangle", f0: 780, f1: 800, at: at + 0.065, len: 0.13, gain: L }, top);
        this.burst(
          { from: "white", kind: "bandpass", f0: 2400, f1: 4400, at, len: 0.17, gain: L * 0.22 },
          top,
        );
        break;
      case "event":
        // A great happening: one heavy bell, and the floor under it.
        for (const [k, g, len] of [
          [1, 1, 2.6],
          [2.002, 0.55, 1.8],
          [2.76, 0.42, 1.2],
          [5.42, 0.16, 0.55],
        ] as const)
          this.tone({ f0: 196 * k, at, len, gain: L * g }, top);
        this.tone({ f0: 98, at, len: 1.7, attack: 0.2, gain: L * 0.7 }, top);
        break;
      case "first":
        // A world's first: three rising, open, and a breath of air after them.
        [587.3, 880, 1318.5].forEach((hz, i) =>
          this.tone({ f0: hz, at: at + i * 0.14, len: 1.25, gain: L * (0.8 - i * 0.14) }, top),
        );
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: 6200,
            q: 1.4,
            at: at + 0.1,
            len: 1.1,
            attack: 0.45,
            gain: L * 0.18,
          },
          top,
        );
        break;
      case "beam": {
        const hz = 1700 + 800 * r();
        this.tone(
          { type: "sawtooth", f0: hz, f1: 260 + 120 * r(), at, len: 0.13, gain: L * 0.6 },
          lim,
        );
        break;
      }
      case "missile":
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: 420,
            f1: 2700,
            q: 1.2,
            at,
            len: 0.72,
            attack: 0.26,
            gain: L,
          },
          lim,
        );
        break;
      case "break":
        // A ship breaking up: the blast, her back going, and the low fall of it.
        this.burst(
          { from: "brown", kind: "lowpass", f0: 1900, f1: 90, at, len: 1.5, gain: L * 1.4 },
          lim,
        );
        this.tone({ f0: 128, f1: 30, at, len: 1.1, gain: L }, lim);
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: 2500,
            f1: 620,
            q: 3,
            at: at + 0.05,
            len: 0.42,
            gain: L * 0.5,
          },
          lim,
        );
        break;
      case "jump":
        // Into the lane: climbing, climbing; then a blow from under it.
        this.tone(
          { type: "sawtooth", f0: 62, f1: 980, at, len: 1.55, attack: 1.3, gain: L * 0.42 },
          top,
        );
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: 260,
            f1: 5400,
            q: 1,
            at,
            len: 1.55,
            attack: 1.35,
            gain: L * 0.8,
          },
          top,
        );
        this.tone({ f0: 170, f1: 26, at: at + 1.5, len: 0.95, gain: L * 1.3 }, top);
        break;
      case "out":
        // Out of it: thrown clear, the roar falling away.
        this.burst(
          { from: "white", kind: "lowpass", f0: 7000, f1: 180, at, len: 1.2, gain: L * 0.9 },
          top,
        );
        this.tone({ f0: 280, f1: 48, at, len: 1, gain: L }, top);
        break;
      case "landing":
        // Down through the air on its engines, and the ground taking it.
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: 160,
            f1: 1050,
            at,
            len: 3.1,
            attack: 2.2,
            gain: L * 1.4,
          },
          top,
        );
        this.tone({ f0: 88, f1: 33, at: at + 3, len: 0.7, gain: L * 1.4 }, top);
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: 460,
            f1: 80,
            at: at + 3,
            len: 0.85,
            gain: L * 1.4,
          },
          top,
        );
        break;
      case "thunder":
        this.burst(
          { from: "brown", kind: "lowpass", f0: 1000, f1: 70, at, len: 3.4, gain: L * 1.5 },
          lim,
        );
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: 300,
            f1: 60,
            at: at + 0.45,
            len: 2.7,
            attack: 0.3,
            gain: L * 1.1,
          },
          lim,
        );
        break;
      case "fire": {
        // The greatest fire. First the air gone, all of it, as the light comes: a moment of nothing.
        // Then a blow in the chest, a long way down; the sky answering, slowly; and after it, nothing
        // much at all (the mix's hush keeps it quiet for as long as it lasts).
        this.level.gain.cancelScheduledValues(at);
        this.level.gain.setTargetAtTime(0, at, 0.012);
        const blow = at + 0.2;
        this.duckUntil = blow + 11;
        this.level.gain.setTargetAtTime(this.shown?.level ?? 1, this.duckUntil, 6);
        this.burst(
          { from: "white", kind: "lowpass", f0: 6000, f1: 260, at: blow, len: 2, gain: L * 0.5 },
          top,
        );
        this.tone({ f0: 58, f1: 19, at: blow, len: 9.5, gain: L * 1.1 }, top);
        this.burst(
          { from: "brown", kind: "lowpass", f0: 2400, f1: 55, at: blow, len: 15, gain: L * 1.2 },
          top,
        );
        this.tone({ f0: 34, f1: 23, at: blow + 0.9, len: 13, attack: 2, gain: L * 0.6 }, top);
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: 520,
            f1: 70,
            at: blow + 1.7,
            len: 8,
            attack: 0.8,
            gain: L * 0.7,
          },
          top,
        );
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: 340,
            f1: 60,
            at: blow + 4,
            len: 10,
            attack: 1.5,
            gain: L * 0.46,
          },
          top,
        );
        break;
      }
    }
  }
}

/** Numbers off a stretch of sound: how loud, its loudest, its spectrum, and how much it moves. */
export type Heard = {
  rms: number;
  peak: number;
  /** dB in each octave from 40 Hz up to 10 kHz and over. */
  bands: number[];
  /** How much its loudness moves from one twentieth of a second to the next (dB). */
  moves: number;
};

const BAND_EDGES = [40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 16000];
const dbOf = (power: number) => 10 * Math.log10(Math.max(power, 1e-10));

/** The spectrum and loudness of a mono signal, by the same bands as the live measure. */
export function hearOf(x: Float32Array, rate: number): Heard {
  let sum = 0,
    peak = 0;
  for (let i = 0; i < x.length; i++) {
    sum += x[i]! * x[i]!;
    peak = Math.max(peak, Math.abs(x[i]!));
  }
  const size = 2048,
    bandPower = new Array(BAND_EDGES.length - 1).fill(0) as number[],
    re = new Float32Array(size),
    im = new Float32Array(size),
    hann = new Float32Array(size);
  for (let i = 0; i < size; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  let frames = 0;
  for (let from = 0; from + size <= x.length; from += size) {
    for (let i = 0; i < size; i++) {
      re[i] = x[from + i]! * hann[i]!;
      im[i] = 0;
    }
    fft(re, im);
    frames++;
    addBands(bandPower, rate, size, (k) => (re[k]! * re[k]! + im[k]! * im[k]!) / (size * size));
  }
  const step = Math.floor(rate / 20),
    steps: number[] = [];
  for (let from = 0; from + step <= x.length; from += step) {
    let s = 0;
    for (let i = 0; i < step; i++) s += x[from + i]! * x[from + i]!;
    steps.push(Math.max(-70, dbOf(s / step)));
  }
  return {
    rms: Math.sqrt(sum / Math.max(1, x.length)),
    peak,
    bands: bandPower.map((p) => dbOf(p / Math.max(1, frames))),
    moves: spread(steps),
  };
}

function spread(xs: number[]): number {
  if (!xs.length) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length);
}

function addBands(out: number[], rate: number, size: number, power: (k: number) => number): void {
  for (let k = 1; k < size / 2; k++) {
    const hz = (k * rate) / size;
    for (let b = 0; b < out.length; b++)
      if (hz >= BAND_EDGES[b]! && hz < BAND_EDGES[b + 1]!) {
        out[b]! += power(k);
        break;
      }
  }
}

function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len,
      wr = Math.cos(ang),
      wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1,
        ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j,
          b = a + len / 2,
          xr = re[b]! * cr - im[b]! * ci,
          xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a]! += xr;
        im[a]! += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Sixteen-bit stereo WAV, as base64 (to be kept in a shots folder, for a person to listen to). */
function wavOf(b: AudioBuffer): string {
  const n = b.length,
    ch = [b.getChannelData(0), b.getChannelData(Math.min(1, b.numberOfChannels - 1))],
    bytes = new Uint8Array(44 + n * 4),
    v = new DataView(bytes.buffer),
    text = (at: number, s: string) => {
      for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
    };
  text(0, "RIFF");
  v.setUint32(4, 36 + n * 4, true);
  text(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, b.sampleRate, true);
  v.setUint32(28, b.sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, ch[0]![i]!)) * 32767, true);
    v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, ch[1]![i]!)) * 32767, true);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 32768)
    out += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(out);
}

const kept = (): string | null => {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
};
const keep = (v: string): void => {
  try {
    localStorage.setItem(STORE, v);
  } catch {
    // (Storage may be shut, as in a private window: then it holds only for this visit.)
  }
};

/** Whether this browser can make sound at all. */
const canSound = () =>
  typeof AudioContext !== "undefined" && typeof OfflineAudioContext !== "undefined";

/**
 * A machine driving the page, not come to hear it: its clicks start nothing, and a runner of few cores keeps
 * them. (Gate 90 says it has come to hear. 🔊 is there either way, so every gate sees the same page.)
 */
const machineOnly = () =>
  (navigator as { webdriver?: boolean }).webdriver === true &&
  !(globalThis as { causalisHears?: boolean }).causalisHears;

/** Sound on the page: its button, its context, and what the page tells it. */
export class Sound {
  /** 🔊 or 🔇; among the corner's tools, or by itself where a mode has put them away. */
  readonly button: HTMLButtonElement | null = null;
  private corner: HTMLElement | null = null;
  private wanted = kept() !== "off";
  private ctx: AudioContext | null = null;
  private graph: Graph | null = null;
  private pump = 0;
  private until = 0;
  private air: Air = airOf("title");
  private airKey = "";
  private mix: Mix = mixOf(this.air);
  private readonly played = {} as Record<Cue, number>;
  private readonly dropped = {} as Record<Cue, number>;
  private readonly lastAt = {} as Record<Cue, number>;
  private readonly ends = {} as Record<Cue, number[]>;
  private unheard = 0;
  private errors: string[] = [];
  private startMs = -1;
  private told = 0;
  private states: string[] = [];
  private fleetWas = { beams: 0, missiles: 0, wrecks: 0 };
  private fireWas = -1;
  /** While the greatest fire's aftermath lasts (the page's reading of the hour takes it in). */
  fireHush = 0;
  private installed = false;

  constructor() {
    for (const c of CUES) {
      this.played[c] = 0;
      this.dropped[c] = 0;
      this.lastAt[c] = -1e9;
      this.ends[c] = [];
    }
  }

  /** The way of hearing on this page: `corner` its tools, or none, where 🔊 stands by itself. */
  mount(corner: HTMLElement | null, onTitle = false): void {
    if (!canSound()) return;
    if (!this.button) {
      const b = document.createElement("button");
      b.className = "sound-button";
      b.onclick = () => this.setOn(!this.wanted);
      (this as { button: HTMLButtonElement | null }).button = b;
      this.drawButton();
    }
    this.corner = corner;
    const b = this.button!;
    b.classList.toggle("on-title", onTitle);
    this.place();
    if (this.installed) return;
    this.installed = true;
    // (A phone starts audio only inside a touch's own handler; the same handlers bring it back after a call took it.)
    for (const type of ["touchend", "pointerup", "click", "keydown"])
      addEventListener(type, this.gesture, { capture: true, passive: true });
    // Any button pressed, wherever it is, sounds it (🔊 says for itself).
    addEventListener(
      "click",
      (e) => {
        const t = e.target as Element | null,
          on = t?.closest?.("button");
        if (on && on !== this.button) this.cue("press");
      },
      { capture: true, passive: true },
    );
    document.addEventListener("visibilitychange", this.seen);
    addEventListener("pagehide", this.seen);
    addEventListener("pageshow", this.seen);
    new MutationObserver(() => this.place()).observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    setInterval(() => this.place(), 500);
  }

  /** Into the corner's tools; or, where a mode has put them away, by itself, over its chrome. */
  private place(): void {
    const b = this.button;
    if (!b) return;
    // (A phone's sheet may put the corner away too, as at the galaxy: 🔊 stays in reach all the same.)
    const by =
        !this.corner ||
        CHROMELESS.some((c) => document.body.classList.contains(c)) ||
        this.corner.offsetParent === null,
      into: HTMLElement = by ? document.body : this.corner!;
    b.classList.toggle("free", by);
    if (b.parentElement !== into) into.append(b);
    // (Clear of the strip a life or a reign keeps along the top, which is as long as what it has to say.)
    let below = 0;
    if (by)
      for (const s of document.querySelectorAll<HTMLElement>(".life-strip, .reign-strip")) {
        const r = s.getBoundingClientRect();
        if (r.height > 0) below = Math.max(below, r.bottom);
      }
    const top = below > 0 ? `${Math.round(below + 8)}px` : "";
    if (b.style.top !== top) b.style.top = top;
  }

  private drawButton(): void {
    const b = this.button;
    if (!b) return;
    const words = this.wanted ? "Sound on: tap for quiet" : "Sound off: tap to hear";
    b.textContent = this.wanted ? "🔊" : "🔇";
    b.classList.toggle("off", !this.wanted);
    b.title = words;
    b.setAttribute("aria-label", words);
    b.setAttribute("aria-pressed", String(this.wanted));
  }

  /** On or off, as chosen, and remembered. */
  setOn(on: boolean): void {
    this.wanted = on;
    keep(on ? "on" : "off");
    this.drawButton();
    if (on) {
      this.begin();
      void this.wake();
      this.cue("press");
    } else this.sleep();
  }

  private readonly gesture = (): void => {
    if (!this.wanted || !canSound() || machineOnly()) return;
    if (!this.ctx) this.begin();
    else if (this.ctx.state !== "running" && !document.hidden) void this.wake();
  };

  private readonly seen = (e?: Event): void => {
    if (!this.ctx) return;
    const away = document.hidden || e?.type === "pagehide";
    if (away) this.sleep();
    else if (this.wanted) void this.wake();
  };

  /** The context begun, inside the touch's own handler; the graph just after it, so the touch is not held up. */
  private begin(): void {
    if (this.ctx || !canSound()) return;
    try {
      // (Mixes with what the phone is playing, and keeps to its silent switch: never a surprise.)
      const session = (navigator as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "ambient";
      const ctx = new AudioContext({ latencyHint: "balanced" });
      this.ctx = ctx;
      ctx.onstatechange = () => {
        this.states.push(ctx.state);
        if (this.states.length > 24) this.states.shift();
      };
      void ctx.resume().catch((e: unknown) => this.fail(e));
      void this.build();
    } catch (e) {
      this.fail(e);
      this.ctx = null;
    }
  }

  private async build(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || this.graph) return;
    try {
      const seed = (Math.random() * 2 ** 31) | 0,
        worst = { ms: 0 },
        loops = await loopsInTurn(seed, worst),
        from = performance.now();
      this.graph = new Graph(ctx, seed, true, loops);
      this.startMs = Math.max(worst.ms, performance.now() - from);
      this.graph.apply(this.mix, ctx.currentTime, 0.05);
      // (In softly, from nothing.)
      this.graph.master.gain.setTargetAtTime(VOLUME, ctx.currentTime + 0.05, 0.9);
      this.until = ctx.currentTime;
      if (this.wanted && !document.hidden) this.startPump();
      else void ctx.suspend();
    } catch (e) {
      this.fail(e);
    }
  }

  private async wake(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      await ctx.resume();
      this.until = ctx.currentTime;
      if (this.wanted && !document.hidden) this.startPump();
    } catch (e) {
      this.fail(e);
    }
  }

  private sleep(): void {
    clearInterval(this.pump);
    this.pump = 0;
    if (this.ctx && this.ctx.state === "running")
      void this.ctx.suspend().catch((e: unknown) => this.fail(e));
  }

  private startPump(): void {
    if (this.pump || !this.graph) return;
    this.pump = setInterval(this.tick, PUMP_MS) as unknown as number;
    this.tick();
  }

  private readonly tick = (): void => {
    const g = this.graph,
      ctx = this.ctx;
    if (!g || !ctx || ctx.state !== "running") return;
    try {
      const now = ctx.currentTime,
        to = now + AHEAD;
      if (to > this.until) {
        g.sprinkle(this.mix, Math.max(now + 0.02, this.until), to);
        this.until = to;
      }
      g.rest(now);
    } catch (e) {
      this.fail(e);
    }
  };

  private fail(e: unknown): void {
    if (this.errors.length < 8) this.errors.push(String(e));
  }

  /** Whether anyone is listening: the page need read nothing for sound when no one is. */
  get listening(): boolean {
    return !!this.graph && this.wanted && !document.hidden;
  }

  /** Whether this visit's sound has been asked for: a reading of the world for it may begin. */
  get wantedNow(): boolean {
    return this.wanted;
  }

  /** What is about now: taken up only if it has changed by enough to hear. */
  tell(a: Air): void {
    const key = `${a.place}|${a.night}|${Math.round(a.rain * 12)}|${a.market}|${a.feast}|${a.war}|${a.under}|${a.alive}|${Math.round(a.thin * 12)}|${Math.round(a.wind * 12)}|${Math.round(a.hush * 12)}|${a.held}`;
    if (key === this.airKey) return;
    this.airKey = key;
    this.air = { ...a };
    this.mix = mixOf(this.air);
    this.told++;
    const g = this.graph,
      ctx = this.ctx;
    if (!g || !ctx) return;
    try {
      g.apply(this.mix, ctx.currentTime);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Something that happened, heard: unless no one is listening, or its kind has had enough for now. */
  cue(c: Cue, level = 1): void {
    const g = this.graph,
      ctx = this.ctx;
    if (!g || !ctx || !this.listening || ctx.state !== "running") {
      this.unheard++;
      return;
    }
    const wall = performance.now(),
      ends = this.ends[c],
      lasts = CUE_LASTS[c] * 1000;
    while (ends.length && ends[0]! < wall) ends.shift();
    if (!cueAllowed(c, wall - this.lastAt[c], ends.length)) {
      this.dropped[c]++;
      return;
    }
    try {
      g.cue(c, ctx.currentTime + 0.004, CUE_RULES[c].level * level);
      this.lastAt[c] = wall;
      ends.push(wall + lasts);
      this.played[c]++;
    } catch (e) {
      this.fail(e);
    }
  }

  /** A fight among the stars, as drawn this frame (no allocation; counts only): what has just begun in it, heard. */
  fleet(beams: number, missiles: number, wrecks: number): void {
    const f = this.fleetWas;
    if (beams > f.beams) this.cue("beam", 1 / (1 + beams / 30));
    if (missiles > f.missiles) this.cue("missile", 1 / (1 + missiles / 24));
    if (wrecks > f.wrecks) this.cue("break");
    f.beams = beams;
    f.missiles = missiles;
    f.wrecks = wrecks;
  }

  /** The greatest fire as seen on the town now: how long since it fell, or below nothing where it has not. */
  fireSeen(since: number): void {
    if (since >= 0 && this.fireWas < 0) this.cue("fire");
    this.fireWas = since;
    this.fireHush = since >= 0 ? 1 : 0;
  }

  /** What a gate reads: the state of things, off the graph's own bookkeeping. */
  state() {
    const g = this.graph;
    return {
      can: canSound(),
      ctx: this.ctx?.state ?? "none",
      time: this.ctx?.currentTime ?? 0,
      on: this.wanted,
      place: this.air.place,
      air: { ...this.air },
      nodes: g?.nodes ?? 0,
      nodesPeak: g?.nodesPeak ?? 0,
      voices: g?.voices ?? 0,
      voicesPeak: g?.voicesPeak ?? 0,
      awake: g?.awake ?? 0,
      played: { ...this.played },
      dropped: { ...this.dropped },
      unheard: this.unheard,
      told: this.told,
      startMs: this.startMs,
      errors: [...this.errors],
      states: [...this.states],
      pumping: !!this.pump,
      bound: NODE_BOUND,
    };
  }

  /** The real output, as a speaker gets it, over this many milliseconds (for a gate; no one else makes this analyser). */
  async measure(ms: number): Promise<Heard & { ran: number }> {
    const g = this.graph,
      ctx = this.ctx;
    if (!g || !ctx) return { rms: 0, peak: 0, bands: [], moves: 0, ran: 0 };
    const a = ctx.createAnalyser();
    a.fftSize = 2048;
    a.smoothingTimeConstant = 0;
    g.out.connect(a);
    const wave = new Float32Array(a.fftSize),
      spec = new Float32Array(a.frequencyBinCount),
      power = new Array(BAND_EDGES.length - 1).fill(0) as number[],
      steps: number[] = [];
    let sum = 0,
      count = 0,
      peak = 0,
      frames = 0;
    const began = ctx.currentTime,
      end = performance.now() + ms;
    while (performance.now() < end) {
      await new Promise((r) => setTimeout(r, 45));
      a.getFloatTimeDomainData(wave);
      let s = 0;
      for (let i = 0; i < wave.length; i++) {
        s += wave[i]! * wave[i]!;
        peak = Math.max(peak, Math.abs(wave[i]!));
      }
      sum += s;
      count += wave.length;
      steps.push(Math.max(-70, dbOf(s / wave.length)));
      a.getFloatFrequencyData(spec);
      addBands(power, ctx.sampleRate, a.fftSize, (k) => Math.pow(10, spec[k]! / 10));
      frames++;
    }
    g.out.disconnect(a);
    return {
      rms: Math.sqrt(sum / Math.max(1, count)),
      peak,
      bands: power.map((p) => dbOf(p / Math.max(1, frames))),
      moves: spread(steps),
      ran: ctx.currentTime - began,
    };
  }

  /**
   * A place, and any cues at their moments, rendered offline: repeatable numbers for a gate, and a
   * WAV for a person. `seed` is the randomness: the same place from two seeds is the measure's own noise.
   */
  async render(o: {
    air: Air;
    seconds: number;
    seed: number;
    rate?: number;
    cues?: readonly { cue: Cue; at: number; level?: number }[];
    /** Fade from another place at this moment. */
    then?: { air: Air; at: number };
    wav?: boolean;
    /** Measure from here on. */
    from?: number;
    /** The small sounds left out: the layers alone. */
    bare?: boolean;
    /** No air at all: the cues alone on silence. */
    silent?: boolean;
  }): Promise<Heard & { wav?: string; ms: number; nodesPeak: number; lasts: number }> {
    const rate = o.rate ?? 32000,
      off = new OfflineAudioContext(2, Math.round(rate * o.seconds), rate),
      from = performance.now(),
      g = new Graph(off, o.seed, false);
    let mix = mixOf(o.air);
    if (o.silent) mix = { ...mix, level: 0 };
    g.apply(mix, 0, 0.02);
    const endOfFirst = o.then ? o.then.at : o.seconds;
    if (!o.bare) g.sprinkle(mix, 0, endOfFirst);
    if (o.then) {
      mix = mixOf(o.then.air);
      g.apply(mix, o.then.at);
      if (!o.bare) g.sprinkle(mix, o.then.at, o.seconds);
    }
    for (const c of o.cues ?? []) g.cue(c.cue, c.at, CUE_RULES[c.cue].level * (c.level ?? 1));
    const b = await off.startRendering(),
      ms = performance.now() - from,
      left = b.getChannelData(0),
      right = b.getChannelData(1),
      mono = new Float32Array(b.length - Math.round((o.from ?? 0) * rate));
    const skip = b.length - mono.length;
    for (let i = 0; i < mono.length; i++) mono[i] = 0.5 * (left[skip + i]! + right[skip + i]!);
    // (The last moment still sounding, for a cue's being over when it should be.)
    let lastLoud = b.length - 1;
    while (lastLoud > 0 && Math.abs(left[lastLoud]!) < 0.002) lastLoud--;
    return {
      ...hearOf(mono, rate),
      ms,
      nodesPeak: g.nodesPeak,
      lasts: lastLoud / rate,
      ...(o.wav ? { wav: wavOf(b) } : {}),
    };
  }
}

/** Sound on this page: the one everything tells. */
export const sound = new Sound();
