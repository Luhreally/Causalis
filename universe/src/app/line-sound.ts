// Live a Line's own small sounds (2026-11-28, the owner's "fun pizaz"): a chomp as food is taken in, a pop as the meter
// fills, a soft thud when the cell is hurt, a bubbling split as it divides, and under it all a gentle bed of water. Made
// on the spot from oscillators and a little noise (no files), gentle, and silent whenever the game's sound is off (🔊 and
// its effects, app/sound.ts settingsNow): nothing sounds that the player has not let sound. Its context is made at the
// first sound asked after a touch, and closed on waking.
import type { sound as Sound } from "./sound.ts";

/** The game's own sound, as the mode is handed it (only its settings are read: whether, and how loud). */
type Settings = Pick<typeof Sound, "settingsNow">;

type Tone = { f: number; to: number; len: number; type: OscillatorType; level: number };

const TONES: Readonly<Record<"chomp" | "pop" | "hurt" | "split" | "danger", readonly Tone[]>> = {
  chomp: [{ f: 520, to: 260, len: 0.07, type: "triangle", level: 0.16 }],
  pop: [
    { f: 440, to: 880, len: 0.12, type: "sine", level: 0.22 },
    { f: 660, to: 1320, len: 0.16, type: "sine", level: 0.14 },
  ],
  hurt: [{ f: 180, to: 70, len: 0.22, type: "sawtooth", level: 0.12 }],
  split: [
    { f: 300, to: 600, len: 0.18, type: "sine", level: 0.16 },
    { f: 420, to: 840, len: 0.24, type: "sine", level: 0.12 },
    { f: 560, to: 1120, len: 0.3, type: "sine", level: 0.08 },
  ],
  danger: [{ f: 110, to: 98, len: 0.5, type: "triangle", level: 0.14 }],
};

export class LineSound {
  private readonly sound: Settings;
  constructor(sound: Settings) {
    this.sound = sound;
  }
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private bed: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private last: Record<string, number> = {};

  /** Whether the game lets sounds be heard now. */
  private get allowed(): boolean {
    const s = this.sound.settingsNow();
    return s.can && s.on && s.effects && !document.hidden;
  }

  private context(): AudioContext | null {
    if (!this.allowed) {
      if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
      return null;
    }
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state !== "running") void this.ctx.resume();
    this.out!.gain.value = 0.6 * this.sound.settingsNow().volume;
    return this.ctx;
  }

  /** A short sound, no oftener than its own kind allows. */
  play(kind: keyof typeof TONES): void {
    const now = performance.now();
    if (now - (this.last[kind] ?? -1e9) < (kind === "chomp" ? 70 : 200)) return;
    this.last[kind] = now;
    const ctx = this.context();
    if (!ctx) return;
    const at = ctx.currentTime + 0.005;
    TONES[kind].forEach((t, i) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain(),
        start = at + i * 0.04;
      o.type = t.type;
      o.frequency.setValueAtTime(t.f, start);
      o.frequency.exponentialRampToValueAtTime(t.to, start + t.len);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(t.level, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + t.len);
      o.connect(g).connect(this.out!);
      o.start(start);
      o.stop(start + t.len + 0.02);
    });
  }

  /** The water's gentle bed (on: while the mode stands), its loudness by how near danger is (0 … 1). */
  ambient(on: boolean, tense = 0): void {
    const ctx = on ? this.context() : null;
    if (!ctx) {
      if (this.bed) {
        this.bed.src.stop();
        this.bed = null;
      }
      return;
    }
    if (!this.bed) {
      // (Brown noise, low-passed: water heard from inside it.)
      const len = ctx.sampleRate * 3,
        buf = ctx.createBuffer(1, len, ctx.sampleRate),
        d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.5;
      }
      const src = ctx.createBufferSource(),
        lp = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      src.buffer = buf;
      src.loop = true;
      lp.type = "lowpass";
      lp.frequency.value = 420;
      gain.gain.value = 0;
      src.connect(lp).connect(gain).connect(this.out!);
      src.start();
      this.bed = { src, gain };
    }
    this.bed.gain.gain.setTargetAtTime(
      0.05 + 0.06 * Math.max(0, Math.min(1, tense)),
      ctx.currentTime,
      0.5,
    );
  }

  close(): void {
    this.ambient(false);
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.out = null;
  }
}
