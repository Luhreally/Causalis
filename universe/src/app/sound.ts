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
  ARMS_CUES,
  CUES,
  CUE_RULES,
  KIND_CUE,
  NODE_BOUND,
  VOICED,
  airOf,
  blastScale,
  cueAllowed,
  cueLength,
  farOf,
  gunScale,
  massOf,
  mixOf,
  type Air,
  type Cue,
  type Mix,
} from "./sound-mix.ts";
import { SOUND_SPEED, type HeardKind, type Voicing } from "../view/index.ts";

const STORE = "causalis.sound",
  STORE_VOLUME = "causalis.sound.volume",
  STORE_EFFECTS = "causalis.sound.effects";
/** The whole of it, under what a phone's speaker can stand: never a surprise (the volume set in Settings is a share of this). */
const VOLUME = 0.72;
/** How long a crossfade takes to get most of the way (s, the time constant of its fade). */
const FADE = 0.55;
/** The voices at once: the world's small sounds, then cues, then the greatest. Three nodes each at most. */
const VOICES_SMALL = 10,
  VOICES_CUE = 28,
  VOICES_ALL = 34;
/** The ways a cue comes from afar: duller at each (lowpass, Hz), and from the left, ahead or the right. */
const FAR_HZ = [16000, 6000, 2800, 1300],
  FAR_PANS = [-0.6, 0, 0.6];
/** The longest a sound is let take to come across the ground to the ear (s), however slow the clock it was made on. */
const MOST_DELAY = 2.5;
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
  crackle: AudioBuffer;
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
  // A line's fire, too thick to tell shot by shot: reports at random, each its own size, none of them in step.
  const crackle = () => {
    const rate = 22050,
      n = rate * 2,
      chs = [new Float32Array(n), new Float32Array(n)];
    for (const c of chs)
      for (let k = 0; k < 150; k++) {
        const at = Math.floor(r() * n),
          big = 0.15 + 0.85 * r() * r(),
          len = 120 + Math.floor(r() * 500);
        for (let i = 0; i < len; i++)
          c[(at + i) % n]! += big * (2 * r() - 1) * Math.exp((-6 * i) / len);
      }
    peakTo(chs, 0.9);
    return bufferOf(chs, rate);
  };
  return { white, brown, surf, rain, murmur, crickets, crackle };
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
    crackle: m.crackle(),
  };
}

/** The loops one at a time, a breath between each: the first touch is not held up by them. The longest one taken, in `worst`. */
async function loopsInTurn(seed: number, worst: { ms: number }): Promise<Loops> {
  const m = loopMakers(seed),
    out = {} as Loops;
  for (const name of ["white", "brown", "rain", "crickets", "murmur", "surf", "crackle"] as const) {
    await new Promise((r) => setTimeout(r, 0));
    const from = performance.now();
    out[name] = m[name]();
    worst.ms = Math.max(worst.ms, performance.now() - from);
  }
  return out;
}

/** Sounded again so many times, so far apart (s): a burst's rounds on one voice. */
type Again = { times?: number; every?: number };
type Tone = Again & {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  at: number;
  len: number;
  gain: number;
  attack?: number;
  to?: AudioNode;
};
type Burst = Again & {
  from: "white" | "brown" | "crackle";
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
    | "wind"
    | "high"
    | "surf"
    | "rain"
    | "crowd"
    | "crickets"
    | "pad"
    | "shimmer"
    | "rumble"
    | "engines",
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
  private readonly engLp: BiquadFilterNode;
  private readonly engOsc: OscillatorNode[];
  private readonly propGain: GainNode;
  private readonly jetGain: GainNode;
  /** The ways a cue comes from afar, by how far ([band][pan]). */
  private readonly far: StereoPannerNode[][];
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
      engines: layer(this.amb),
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
    // Machines' engines overhead (8 nodes): two engines' beat, a little out of step, through their edge; or a jet's roar.
    this.engLp = filter("lowpass", 760, 0.9);
    this.engOsc = [osc("sawtooth", 76), osc("sawtooth", 77.1)];
    for (const o of this.engOsc) o.connect(this.engLp);
    this.propGain = gainOf(1);
    this.engLp.connect(this.propGain).connect(this.gains.engines.gain);
    const jetBp = filter("bandpass", 2400, 0.7);
    this.jetGain = gainOf(0);
    loop(this.loops.white).connect(jetBp).connect(this.jetGain).connect(this.gains.engines.gain);
    // The ways a cue comes from afar (16 nodes): each band of distance its own dullness, each a side.
    this.far = FAR_HZ.map((hz) => {
      const lp = filter("lowpass", hz, 0.6);
      lp.connect(this.cueBus);
      return FAR_PANS.map((p) => {
        const s = this.n(ctx.createStereoPanner());
        s.pan.value = p;
        s.connect(lp);
        return s;
      });
    });
  }

  /** The way a cue comes in from so far off (m), and from which side (-1 … 1). */
  wayFrom(metres: number, pan: number): AudioNode {
    const hz = farOf(metres).hz;
    let band = 0;
    for (let b = 1; b < FAR_HZ.length; b++)
      if (Math.abs(Math.log(FAR_HZ[b]! / hz)) < Math.abs(Math.log(FAR_HZ[band]! / hz))) band = b;
    const side = pan < -0.33 ? 0 : pan > 0.33 ? 2 : 1;
    return this.far[band]![side]!;
  }

  /** The level everything is played at (the volume in Settings, a share of the whole). */
  setVolume(v: number, at: number): void {
    this.master.gain.cancelScheduledValues(at);
    this.master.gain.setTargetAtTime(VOLUME * v, at, 0.05);
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
    lay("engines", m.engines);
    set(this.engLp.frequency, m.enginesHz, was?.enginesHz);
    set(this.propGain.gain, 1 - m.jet, was ? 1 - was.jet : undefined);
    set(this.jetGain.gain, 1.6 * m.jet, was ? 1.6 * was.jet : undefined);
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

  /** Room for a whole sound of so many voices: rather none of it than half. */
  private fits(n: number, limit: number): boolean {
    return !this.limited || this.voices + n <= limit;
  }

  /** A voice's level from `at`: up over its attack and away over its length, so many times over, so far apart. */
  private envelope(
    g: GainNode,
    at: number,
    gain: number,
    attack: number,
    len: number,
    a: Again,
  ): void {
    const times = Math.max(1, a.times ?? 1),
      every = a.every ?? len;
    g.gain.setValueAtTime(0, at);
    for (let k = 0; k < times; k++) {
      const from = at + k * every,
        last = k === times - 1,
        to = from + (last ? len : Math.min(len, every * 0.92));
      if (k > 0) g.gain.setValueAtTime(0.0004, from);
      g.gain.linearRampToValueAtTime(gain, from + attack);
      g.gain.exponentialRampToValueAtTime(0.0004, to);
    }
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
    this.envelope(g, t.at, t.gain, attack, t.len, t);
    o.connect(g).connect(t.to ?? this.cueBus);
    const span = ((t.times ?? 1) - 1) * (t.every ?? 0);
    this.voice(o, [o, g], t.at, t.at + span + t.len + 0.02);
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
    this.envelope(g, b.at, b.gain, attack, b.len, b);
    s.connect(f)
      .connect(g)
      .connect(b.to ?? this.cueBus);
    const span = ((b.times ?? 1) - 1) * (b.every ?? 0);
    this.voice(s, [s, f, g], b.at, b.at + span + b.len + 0.02, this.rand() * from.duration);
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
      // Iron on iron: at what its metal rings at, where that is told.
      const to_ = pan(),
        hz = m.ringHz > 0 ? m.ringHz * (0.88 + 0.24 * r()) : 2200 + 2600 * r();
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

  /**
   * A short sound, from `at`, at this level: made from its numbers (`v`; else its kind's commonest) and, given `way`, heard from
   * so far off and that side (its level by the distance, and duller). Whether it was played (no room: none of it).
   */
  cue(
    cue: Cue,
    at: number,
    level: number,
    v?: Voicing & { n?: number },
    way?: { far: number; pan: number },
  ): boolean {
    const r = this.rand,
      lim = VOICES_CUE,
      top = VOICES_ALL,
      n: Voicing & { n?: number } = { ...VOICED[cue], ...v },
      far = way?.far ?? 30,
      to = way ? this.wayFrom(way.far, way.pan) : this.cueBus,
      L = level * (way ? farOf(way.far).level : 1);
    switch (cue) {
      case "gun": {
        // A gun fired: its ball's crack where it outruns sound, ahead of the report by as much as it outruns it over the
        // distance; black powder's fizz in the pan; the report, deeper and longer as the cube root of its energy; its thump.
        const J = n.joules ?? 2480,
          s = gunScale(J),
          black = !!n.black,
          speed = n.speed ?? 400,
          mach = speed / SOUND_SPEED,
          G = L * Math.max(0.35, Math.min(1.05, 0.62 + 0.14 * Math.log10(J / 2480))),
          again = { times: Math.max(1, n.rounds ?? 1), every: n.apart ?? 0.09 },
          cracks = mach > 1.02,
          gap = cracks ? Math.max(0.008, Math.min(0.16, far * (1 / SOUND_SPEED - 1 / speed))) : 0,
          len = 0.12 + 0.3 * Math.pow(s, 0.9) + (black ? 0.06 : 0);
        if (!this.fits(2 + (cracks ? 1 : 0) + (black ? 1 : 0), lim)) return false;
        if (cracks)
          this.burst(
            {
              from: "white",
              kind: "highpass",
              f0: 3000,
              at,
              len: 0.008 + 0.0006 * (n.bore ?? 10),
              attack: 0.001,
              gain: L * Math.min(0.95, 0.45 + 0.5 * Math.sqrt(mach - 1)),
              to,
              ...again,
            },
            lim,
          );
        if (black)
          this.burst(
            {
              from: "white",
              kind: "bandpass",
              f0: 5200,
              q: 0.8,
              at: Math.max(at, at + gap - 0.05),
              len: 0.09,
              attack: 0.02,
              gain: G * 0.24,
              to,
            },
            lim,
          );
        this.burst(
          {
            from: "white",
            kind: "lowpass",
            f0: (black ? 3600 : 5600) / Math.pow(s, 0.8),
            f1: (black ? 200 : 320) / Math.sqrt(s),
            at: at + gap,
            len,
            attack: 0.002,
            gain: G * 1.25,
            to,
            ...again,
          },
          lim,
        );
        this.tone(
          {
            f0: 160 / Math.sqrt(s),
            f1: 55 / Math.sqrt(s),
            at: at + gap,
            len: 0.1 + 0.16 * s,
            attack: 0.002,
            gain: G * 0.9,
            to,
            ...again,
          },
          lim,
        );
        return true;
      }
      case "cannon": {
        // A field gun: its report down low and long, a mid edge a phone's speaker gives, the land answering after.
        const J = n.joules ?? 261000,
          s = gunScale(J),
          speed = n.speed ?? 440,
          cracks = speed / SOUND_SPEED > 1.02,
          G = L * Math.max(0.4, Math.min(1.05, 0.62 + 0.14 * Math.log10(J / 2480)));
        if (!this.fits(4 + (cracks ? 1 : 0), lim)) return false;
        if (cracks)
          this.burst(
            { from: "white", kind: "highpass", f0: 2500, at, len: 0.02, gain: L * 0.5, to },
            lim,
          );
        const gap = cracks
            ? Math.max(0.01, Math.min(0.16, far * (1 / SOUND_SPEED - 1 / speed)))
            : 0,
          bang = at + gap;
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: 2400 / Math.sqrt(s),
            f1: 70,
            at: bang,
            len: 0.4 + 0.4 * Math.pow(s, 0.6),
            attack: 0.003,
            gain: G * 1.3,
            to,
          },
          lim,
        );
        this.tone(
          {
            f0: 120 / Math.pow(s, 0.4),
            f1: 28,
            at: bang,
            len: 0.3 + 0.25 * s,
            attack: 0.003,
            gain: G,
            to,
          },
          lim,
        );
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: 1100,
            f1: 600,
            q: 1.1,
            at: bang,
            len: 0.12 + 0.04 * s,
            attack: 0.002,
            gain: G * 0.75,
            to,
          },
          lim,
        );
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: 600,
            f1: 60,
            at: bang + 0.15,
            len: 1.4 * Math.sqrt(s) - 0.15,
            attack: 0.25,
            gain: G * 0.6,
            to,
          },
          lim,
        );
        return true;
      }
      case "bow": {
        // A bowstring let go: its note by its draw (a string's pitch goes as the root of its pull), the slap, the arrow away.
        const hz = 105 * Math.sqrt((n.joules ?? 40) / 40);
        if (!this.fits(3, lim)) return false;
        this.tone(
          {
            type: "sawtooth",
            f0: hz,
            f1: hz * 0.94,
            at,
            len: 0.22,
            attack: 0.002,
            gain: L * 0.3,
            to,
          },
          lim,
        );
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: 1500,
            q: 1.5,
            at,
            len: 0.028,
            attack: 0.001,
            gain: L * 0.7,
            to,
          },
          lim,
        );
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: 1400 * Math.sqrt((n.speed ?? 45) / 45),
            f1: 600,
            q: 2.5,
            at: at + 0.03,
            len: 0.32,
            attack: 0.1,
            gain: L * 0.22,
            to,
          },
          lim,
        );
        return true;
      }
      case "dart":
        // A dart thrown hard: its whip through the air, and the click that loosed it.
        if (!this.fits(2, lim)) return false;
        this.burst(
          {
            from: "white",
            kind: "highpass",
            f0: 4000,
            at,
            len: 0.012,
            attack: 0.001,
            gain: L * 0.5,
            to,
          },
          lim,
        );
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: 50 * (n.speed ?? 60),
            f1: 900,
            q: 3,
            at,
            len: 0.13,
            attack: 0.01,
            gain: L * 0.8,
            to,
          },
          lim,
        );
        return true;
      case "clash": {
        // A blade struck: the bite of it, and its ring, a free bar's three strongest, the higher dying the sooner.
        const ring = (n.ring ?? 3170) * (0.94 + 0.12 * r()),
          decay = n.decay ?? 0.25,
          parts = [1, 2.76, 5.4].filter((k) => ring * k < 12000);
        if (!this.fits(1 + parts.length, lim)) return false;
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: ring * 1.25,
            q: 2.5,
            at,
            len: 0.03,
            attack: 0.001,
            gain: L * 0.7,
            to,
          },
          lim,
        );
        parts.forEach((k, i) =>
          this.tone(
            {
              f0: ring * k,
              at,
              len: Math.min(2, 0.04 + (4 * decay) / (1 + i)),
              attack: 0.001,
              gain: L * [0.5, 0.24, 0.1][i]!,
              to,
            },
            lim,
          ),
        );
        return true;
      }
      case "thud": {
        // A blow landing on what is worn: the dull of it; a plate's clang where it rings; mail's rings, each its own.
        const ring = n.ring ?? 0,
          decay = n.decay ?? 0.03,
          clangs = !n.mail && ring > 0 && decay > 0.05;
        if (!this.fits(2 + (n.mail ? 2 : clangs ? 1 : 0), lim)) return false;
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: 900,
            f1: 160,
            at,
            len: 0.14,
            attack: 0.002,
            gain: L * 1.1,
            to,
          },
          lim,
        );
        this.tone({ f0: 150, f1: 85, at, len: 0.12, attack: 0.002, gain: L * 0.7, to }, lim);
        if (clangs)
          this.tone(
            { f0: ring * 0.5, at, len: Math.min(0.9, 3 * decay), attack: 0.002, gain: L * 0.3, to },
            lim,
          );
        if (n.mail)
          for (let i = 0; i < 2; i++)
            this.tone(
              {
                f0: 3800 + 2700 * r(),
                at: at + 0.012 + 0.018 * i,
                len: 0.05,
                attack: 0.001,
                gain: L * 0.16,
                to,
              },
              lim,
            );
        return true;
      }
      case "zap": {
        // Burning light let go: a falling edge, its pitch its own.
        const hz = (n.hz ?? 1800) * (0.9 + 0.2 * r());
        if (!this.fits(1, lim)) return false;
        this.tone(
          { type: "sawtooth", f0: hz, f1: hz * 0.18, at, len: 0.13, gain: L * 0.55, to },
          lim,
        );
        return true;
      }
      case "rocket": {
        // A rocket on its fire, coming: its roar rising as it nears and falling in pitch as it comes past onto its mark (the
        // way it comes in is drawn out of the sky toward the ear and then across it); its boom where it outruns sound.
        const coming = Math.max(0.3, n.coming ?? 2),
          V = n.speed ?? 700,
          up = SOUND_SPEED / (SOUND_SPEED - 0.8 * Math.min(V, 0.6 * SOUND_SPEED)),
          hz = 900;
        if (!this.fits(V > SOUND_SPEED ? 3 : 2, lim)) return false;
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: hz * up,
            f1: hz * 1.05,
            q: 1.4,
            at,
            len: coming,
            attack: coming * 0.7,
            gain: L * 0.9,
            to,
          },
          lim,
        );
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: 520,
            f1: 260,
            at,
            len: coming,
            attack: coming * 0.8,
            gain: L * 0.9,
            to,
          },
          lim,
        );
        if (V > SOUND_SPEED)
          this.burst(
            {
              from: "white",
              kind: "highpass",
              f0: 2500,
              at: at + coming - 0.03,
              len: 0.025,
              attack: 0.001,
              gain: L * 0.6,
              to,
            },
            lim,
          );
        return true;
      }
      case "whistle": {
        // A load falling: its fins' whistle, high and falling away as it comes down past the ear's line.
        const coming = Math.max(0.3, n.coming ?? 1.7);
        if (!this.fits(2, lim)) return false;
        this.tone(
          { f0: 1700, f1: 620, at, len: coming, attack: coming * 0.5, gain: L * 0.5, to },
          lim,
        );
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: 1700,
            f1: 620,
            q: 8,
            at,
            len: coming,
            attack: coming * 0.5,
            gain: L * 0.6,
            to,
          },
          lim,
        );
        return true;
      }
      case "blast": {
        // A charge going off: its crack, its boom, the rumble after, what it threw coming down; all of it slower and deeper
        // as the cube root of its energy, and only a little louder.
        const mj = n.mj ?? 210,
          s = blastScale(mj),
          G = L * Math.max(0.4, Math.min(1, 0.7 + 0.12 * Math.log10(mj / 210)));
        if (!this.fits(4, lim)) return false;
        this.burst(
          {
            from: "white",
            kind: "lowpass",
            f0: 7500 / Math.pow(s, 0.25),
            f1: 500,
            at,
            len: 0.18 + 0.12 * Math.sqrt(s),
            attack: 0.002,
            gain: G * 0.9,
            to,
          },
          lim,
        );
        this.tone(
          {
            f0: 85 / Math.pow(s, 0.35),
            f1: 24,
            at,
            len: 0.5 + 0.9 * Math.pow(s, 0.6),
            attack: 0.003,
            gain: G,
            to,
          },
          lim,
        );
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: 1000 / Math.pow(s, 0.4),
            f1: 45,
            at,
            len: 0.6 + 2.4 * Math.pow(s, 0.6),
            attack: 0.03,
            gain: G * 1.1,
            to,
          },
          lim,
        );
        this.burst(
          {
            from: "white",
            kind: "bandpass",
            f0: 2400,
            f1: 900,
            q: 1.3,
            at: at + 0.12 + 0.2 * Math.sqrt(s),
            len: 0.4 + Math.pow(s, 0.4),
            attack: 0.12,
            gain: G * 0.22,
            to,
          },
          lim,
        );
        return true;
      }
      case "volley": {
        // Fire too thick to tell shot by shot: a crackle of reports as many as there are; a flight of arrows, a rush of air.
        const many = massOf(n.n ?? 40),
          bows = (n.joules ?? 2480) < 300,
          s = gunScale(n.joules ?? 2480);
        if (!this.fits(2, lim)) return false;
        this.burst(
          {
            from: bows ? "white" : "crackle",
            kind: "bandpass",
            f0: bows ? 1100 : 1800 / Math.sqrt(s),
            f1: bows ? 700 : undefined,
            q: bows ? 0.8 : 0.6,
            at,
            len: 0.6,
            attack: 0.06,
            gain: L * many * (bows ? 0.35 : 1),
            to,
          },
          lim,
        );
        this.burst(
          {
            from: "brown",
            kind: "lowpass",
            f0: bows ? 500 : 320,
            f1: 90,
            at,
            len: 0.55,
            attack: 0.03,
            gain: L * many * 0.5,
            to,
          },
          lim,
        );
        return true;
      }
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
        // Then a blow in the chest, a long way down, as late as it is far (`coming`: light is there at
        // once, sound at its own speed); the sky answering, slowly; and after it, nothing much at all
        // (the mix's hush keeps it quiet for as long as it lasts).
        this.level.gain.cancelScheduledValues(at);
        this.level.gain.setTargetAtTime(0, at, 0.012);
        const blow = at + 0.2 + Math.max(0, v?.coming ?? 0);
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
    return true;
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

const kept = (key = STORE): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const keep = (v: string, key = STORE): void => {
  try {
    localStorage.setItem(key, v);
  } catch {
    // (Storage may be shut, as in a private window: then it holds only for this visit.)
  }
};
/** The volume kept (0 … 1; all of it where none is kept). */
const keptVolume = (): number => {
  const v = Number(kept(STORE_VOLUME) ?? "1");
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
};

/**
 * One sound of arms or a blast, as the page tells it: what makes it and by what numbers (view/heard.ts), in how long (s of the
 * wall's clock, from now) it is made where it is, how far from the ear that is (m), and from which side (-1 left … 1 right).
 */
export type HeardEvent = {
  readonly kind: HeardKind;
  readonly v: Voicing;
  readonly in: number;
  readonly far: number;
  readonly pan: number;
};
/** The kinds whose too many at once are heard together, as a line's fire. */
const MASSED: ReadonlySet<HeardKind> = new Set(["gun", "bow", "dart", "zap"]);

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
  /** The volume (0 … 1) and whether the sounds of arms and blasts are heard (Settings; kept between visits). */
  private volume = keptVolume();
  private effects = kept(STORE_EFFECTS) !== "off";
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
      this.graph.master.gain.setTargetAtTime(VOLUME * this.volume, ctx.currentTime + 0.05, 0.9);
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

  /**
   * Something that happened, heard: unless no one is listening, or its kind has had enough for now (or it is of arms and the
   * effects are off). `v` its numbers, `way` where it is from the ear, `delay` how long until it reaches the ear (s).
   */
  cue(
    c: Cue,
    level = 1,
    v?: Voicing & { n?: number },
    way?: { far: number; pan: number },
    delay = 0,
  ): boolean {
    const g = this.graph,
      ctx = this.ctx;
    if (!g || !ctx || !this.listening || ctx.state !== "running" || !this.heardNow(c)) {
      this.unheard++;
      return false;
    }
    const wall = performance.now(),
      ends = this.ends[c],
      when = wall + delay * 1000;
    while (ends.length && ends[0]! < wall) ends.shift();
    if (!cueAllowed(c, when - this.lastAt[c], ends.length)) {
      this.dropped[c]++;
      return false;
    }
    try {
      if (!g.cue(c, ctx.currentTime + 0.004 + delay, CUE_RULES[c].level * level, v, way)) {
        this.dropped[c]++;
        return false;
      }
      this.lastAt[c] = Math.max(this.lastAt[c], when);
      ends.push(when + cueLength(c, v) * 1000);
      ends.sort((a, b) => a - b);
      this.played[c]++;
      return true;
    } catch (e) {
      this.fail(e);
      return false;
    }
  }

  /** Whether a cue's kind is heard now: everything but arms and blasts, and those while the effects are on. */
  private heardNow(c: Cue): boolean {
    return this.effects || !ARMS_CUES.includes(c);
  }

  /**
   * What arms and blasts are making now and in the next moments, told four times a second (view/heard.ts says what, the page
   * says where): each as late as its sound takes to reach the ear over the ground (`pace`: the seconds of the clock it was
   * made on that go by in one of the wall's, so a battle watched at four times its pace hears its far guns four times as soon),
   * as faint and dull as its distance makes it. Of each kind, the nearest are heard each by itself, as many as the rules let
   * sound at once and far enough apart; the rest of a line's fire together, as a crackle as thick as they are many.
   */
  heard(list: readonly HeardEvent[], pace = 1): void {
    if (!list.length) return;
    if (!this.listening || !this.effects) {
      this.unheard += list.length;
      return;
    }
    const kinds = new Map<HeardKind, { e: HeardEvent; when: number; level: number }[]>();
    for (const e of list) {
      const delay = Math.min(MOST_DELAY, e.far / SOUND_SPEED / Math.max(0.05, pace)),
        at = { e, when: Math.max(0, e.in + delay), level: farOf(e.far).level };
      // (Made so long ago that its sound has passed the ear already: not heard.)
      if (e.in + delay < -0.4) {
        this.unheard++;
        continue;
      }
      const k = kinds.get(e.kind);
      if (k) k.push(at);
      else kinds.set(e.kind, [at]);
    }
    for (const [kind, all] of kinds) {
      const cue = KIND_CUE[kind],
        wait = CUE_RULES[cue].wait / 1000,
        chosen: number[] = [],
        rest: typeof all = [];
      all.sort((a, b) => b.level - a.level);
      for (const a of all) {
        const apart = chosen.every((w) => Math.abs(w - a.when) >= wait);
        if (apart && chosen.length < CUE_RULES[cue].most && this.cue(cue, 1, a.e.v, a.e, a.when))
          chosen.push(a.when);
        else rest.push(a);
      }
      if (!rest.length) continue;
      if (!MASSED.has(kind)) {
        this.dropped[cue] += rest.length;
        continue;
      }
      // (The rest of them together: when most of them are, from where most of them are.)
      let when = 0,
        far = 0,
        pan = 0;
      for (const a of rest) {
        when += a.when;
        far += a.e.far;
        pan += a.e.pan;
      }
      const n = rest.length;
      this.cue(
        "volley",
        kind === "gun" ? 1 : 0.8,
        { ...rest[0]!.e.v, n },
        { far: far / n, pan: pan / n },
        when / n,
      );
    }
  }

  /** The volume (0 … 1), kept between visits, heard at once. */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    keep(String(Math.round(this.volume * 100) / 100), STORE_VOLUME);
    const g = this.graph,
      ctx = this.ctx;
    if (g && ctx) g.setVolume(this.volume, ctx.currentTime);
  }

  /** The sounds of arms and blasts heard or not, kept between visits (🔊 still silences everything). */
  setEffects(on: boolean): void {
    this.effects = on;
    keep(on ? "on" : "off", STORE_EFFECTS);
  }

  /** What Settings shows: whether there is sound here at all, 🔊, the volume and the effects. */
  settingsNow(): { can: boolean; on: boolean; volume: number; effects: boolean } {
    return { can: canSound(), on: this.wanted, volume: this.volume, effects: this.effects };
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

  /**
   * The greatest fire as seen on the town now: how long since it fell, or below nothing where it has not; how far it is from
   * the ear (m), and the seconds of its clock in one of the wall's. Its light is there at once; its blow comes as late as sound
   * takes over the distance, on that clock (no later than MOST_DELAY).
   */
  fireSeen(since: number, far = 0, pace = 1): void {
    if (since >= 0 && this.fireWas < 0)
      this.cue("fire", 1, {
        coming: Math.min(MOST_DELAY, far / SOUND_SPEED / Math.max(0.05, pace)),
      });
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
      volume: this.volume,
      effects: this.effects,
      /** The master's level now (its target, the volume's share of the whole). */
      master: g?.master.gain.value ?? 0,
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
    cues?: readonly {
      cue: Cue;
      at: number;
      level?: number;
      v?: Voicing & { n?: number };
      way?: { far: number; pan: number };
    }[];
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
    for (const c of o.cues ?? [])
      g.cue(c.cue, c.at, CUE_RULES[c.cue].level * (c.level ?? 1), c.v, c.way);
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
