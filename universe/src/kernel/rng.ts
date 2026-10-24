// Keyed randomness (docs/architecture §6). A random number is a pure function of
// its key: the universe seed, a stream, the subject it is about, the time, a
// purpose and a draw index. Nothing stores or shares a random stream, so the
// order in which things are computed can never change what they draw.
import { TWO32, TWO53 } from "./bits.ts";
import { finish, hashString, mix, mixInt } from "./hash.ts";

/** The universe seed: 64 bits from the player's seed text. */
export type Seed = { readonly text: string; readonly lo: number; readonly hi: number };

/**
 * The 64 bits are of the world's name alone: the acts laid on its dawn (Phase 24) remake it
 * where they reach, and every draw they do not reach is as it was.
 */
export function seedFromText(text: string): Seed {
  const name = seedName(text);
  return Object.freeze({
    text,
    lo: hashString(name, 0x9747b28c),
    hi: hashString(name, 0x1b873593),
  });
}

/** What marks an act laid on a world's dawn in its seed's text: "first light ~age 7 cool". */
const ACT = " ~";

/** The name of a seed's world: its text before the acts laid on its dawn. */
export function seedName(text: string): string {
  const i = text.indexOf(ACT);
  return i < 0 ? text : text.slice(0, i);
}

/** The acts laid on a seed's dawn, each its subject's words and then what was done ("age 7 cool"). */
export function seedActs(text: string): string[] {
  const i = text.indexOf(ACT);
  if (i < 0) return [];
  return text
    .slice(i + ACT.length)
    .split(ACT)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/**
 * The seed's text with an act laid on: it takes the place of any act on the same subject (an
 * act's words but its last), and the acts are kept in one order, so that the same acts, however
 * they were laid, name the same world.
 */
export function seedWithAct(text: string, act: string): string {
  const subject = (a: string) => a.slice(0, Math.max(0, a.lastIndexOf(" "))),
    laid = act.trim(),
    acts = seedActs(text).filter((a) => subject(a) !== subject(laid));
  acts.push(laid);
  acts.sort(actOrder);
  return [seedName(text), ...acts].join(ACT);
}

/** Acts in order: by their first word, then by their number ("age 3" before "age 12"). */
function actOrder(a: string, b: string): number {
  const [wa, na] = actKey(a),
    [wb, nb] = actKey(b);
  if (wa !== wb) return wa < wb ? -1 : 1;
  if (na !== nb) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

function actKey(a: string): [string, number] {
  const words = a.split(" ");
  return [words[0] ?? "", Number(words[1]) || 0];
}

/**
 * A stream is a named family of draws ("pop.death", "gen.plates"). Its salt
 * comes from its tag and version: bump the version when a stream's meaning
 * changes, and only that stream's draws change.
 */
export type Stream = { readonly tag: string; readonly version: number; readonly salt: number };

const STREAMS = new Map<string, Stream>();

export function defineStream(tag: string, version = 1): Stream {
  if (!/^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/.test(tag))
    throw new Error(`stream tag ${tag} must be dotted lowercase words, e.g. "pop.death"`);
  if (STREAMS.has(tag)) throw new Error(`stream ${tag} is defined twice`);
  const stream = Object.freeze({ tag, version, salt: hashString(`${tag}#${version}`, 0x2f0b3c6d) });
  STREAMS.set(tag, stream);
  return stream;
}

/** Every declared stream, in tag order (part of the ruleset's identity). */
export function streams(): readonly Stream[] {
  return [...STREAMS.values()].sort((x, y) => (x.tag < y.tag ? -1 : x.tag > y.tag ? 1 : 0));
}

/** A 32-bit hash of a purpose name, for readable purposes at call sites. */
export function purpose(name: string): number {
  return hashString(name, 0x71e3);
}

/**
 * The universe's random numbers. Every method is a pure function of
 * (seed, stream, subject, time, purpose, n):
 *
 *  - subject: a 32-bit key of the thing the draw is about (refHash(ref), a cell index);
 *  - time: a safe integer (SimTime seconds, a period index, a year);
 *  - purpose: which question is being asked of that subject at that time;
 *  - n: the draw's index when one question needs several numbers.
 */
export class Rng {
  readonly seed: Seed;
  private readonly base: number;
  constructor(seed: Seed) {
    this.seed = seed;
    this.base = mix(mix(0x6b43a9b5, seed.lo), seed.hi);
  }
  private key(stream: Stream, subject: number, time: number, purpose: number, n: number): number {
    let h = mix(this.base, stream.salt);
    h = mix(h, subject >>> 0);
    h = mixInt(h, time);
    h = mix(h, purpose >>> 0);
    return mix(h, n >>> 0);
  }
  /** A uniform unsigned 32-bit integer. */
  u32(stream: Stream, subject: number, time = 0, purpose = 0, n = 0): number {
    return finish(this.key(stream, subject, time, purpose, n), 8);
  }
  /** A uniform number in [0, 1) with 32 bits of resolution. */
  unit(stream: Stream, subject: number, time = 0, purpose = 0, n = 0): number {
    return this.u32(stream, subject, time, purpose, n) / TWO32;
  }
  /** A uniform number in [0, 1) with 53 bits of resolution. */
  real(stream: Stream, subject: number, time = 0, purpose = 0, n = 0): number {
    const h = this.key(stream, subject, time, purpose, n),
      a = finish(h, 8) >>> 5,
      b = finish(mix(h, 0x9e3779b9), 9) >>> 6;
    return (a * 67108864 + b) / TWO53;
  }
  /** A uniform integer in [0, count), for count ≤ 2^21 without bias worth measuring. */
  index(count: number, stream: Stream, subject: number, time = 0, purpose = 0, n = 0): number {
    return Math.floor((this.u32(stream, subject, time, purpose, n) * count) / TWO32);
  }
  /** True with probability p. */
  chance(p: number, stream: Stream, subject: number, time = 0, purpose = 0, n = 0): boolean {
    return this.u32(stream, subject, time, purpose, n) < p * TWO32;
  }
  /** A uniform number in [lo, hi). */
  range(
    lo: number,
    hi: number,
    stream: Stream,
    subject: number,
    time = 0,
    purpose = 0,
    n = 0,
  ): number {
    return lo + (hi - lo) * this.real(stream, subject, time, purpose, n);
  }
}
