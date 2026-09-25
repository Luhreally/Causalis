// References: the identity of everything in the universe (docs/architecture §5).
//
// A Ref is the string "kind:a:b". It is readable in logs, saves and why-chains,
// and usable directly as a Map key. There are two ways to get one:
//
//  - minted: the authoritative simulation creates a thing (a town founded, an army
//    raised, an event emitted) and a Minter hands out the next number of that kind.
//    Only simulation code mints, in deterministic order.
//  - structural: anything that can be generated or resolved lazily has a Ref
//    computed from its origin (a star from its sector and slot, a planet from its
//    star and orbit), so its identity cannot depend on when or whether anyone looked.
//    Generators, resolvers and the observatory never mint.
import { Hasher, hashString } from "./hash.ts";
import { TWO32, hi32, lo32 } from "./bits.ts";

declare const refBrand: unique symbol;
export type Ref = string & { readonly [refBrand]: true };

export type KindOrigin = "minted" | "structural";
export type Kind = { readonly code: string; readonly name: string; readonly origin: KindOrigin };

const KINDS = new Map<string, Kind>();

/** Declare a kind of thing. Codes are 2–5 lowercase letters and unique. */
export function defineKind(code: string, name: string, origin: KindOrigin): Kind {
  if (!/^[a-z]{2,5}$/.test(code))
    throw new Error(`kind code ${code} must be 2–5 lowercase letters`);
  if (KINDS.has(code)) throw new Error(`kind ${code} is defined twice`);
  const kind = Object.freeze({ code, name, origin });
  KINDS.set(code, kind);
  return kind;
}

export function kindByCode(code: string): Kind | undefined {
  return KINDS.get(code);
}

/** Every declared kind, in code order. */
export function kinds(): readonly Kind[] {
  return [...KINDS.values()].sort((x, y) => (x.code < y.code ? -1 : x.code > y.code ? 1 : 0));
}

function assertWord(n: number, what: string): void {
  if (!Number.isInteger(n) || n < 0 || n >= TWO32)
    throw new Error(`${what} ${n} is not a 32-bit unsigned integer`);
}

/** The Ref kind:a:b, with a and b unsigned 32-bit integers. */
export function makeRef(kind: Kind, a: number, b: number): Ref {
  assertWord(a, "ref part");
  assertWord(b, "ref part");
  return `${kind.code}:${a}:${b}` as Ref;
}

export type RefParts = { readonly kind: string; readonly a: number; readonly b: number };

const REF_PATTERN = /^([a-z]{2,5}):(\d+):(\d+)$/;

/** Whether text is a well-formed Ref. */
export function isRef(text: string): text is Ref {
  const m = REF_PATTERN.exec(text);
  return m !== null && Number(m[2]) < TWO32 && Number(m[3]) < TWO32;
}

export function parseRef(ref: Ref): RefParts {
  const m = REF_PATTERN.exec(ref);
  if (!m) throw new Error(`${ref} is not a reference`);
  return { kind: m[1]!, a: Number(m[2]), b: Number(m[3]) };
}

export function kindCodeOf(ref: Ref): string {
  return ref.slice(0, ref.indexOf(":"));
}

/** A total order on refs (code-unit order of the text). */
export function compareRefs(x: Ref, y: Ref): number {
  return x < y ? -1 : x > y ? 1 : 0;
}

// A pure memo: a hit and a miss return the same value, so clearing it is harmless.
const REF_HASH = new Map<string, number>();

/** A 32-bit hash of a ref, for keying random draws on it. */
export function refHash(ref: Ref): number {
  let h = REF_HASH.get(ref);
  if (h === undefined) {
    if (REF_HASH.size >= 1 << 16) REF_HASH.clear();
    h = hashString(ref, 0x52ef);
    REF_HASH.set(ref, h);
  }
  return h;
}

/**
 * A structural ref: its identity is the hash of its origin path (the parent's
 * ref and the integers or words that locate it there). 64 bits of hash; the
 * registry that materializes such things stores the origin and checks it.
 */
export function structuralRef(
  kind: Kind,
  parent: Ref | null,
  ...path: readonly (number | string)[]
): Ref {
  if (kind.origin !== "structural") throw new Error(`${kind.code} refs are minted, not structural`);
  const h = new Hasher().string(kind.code).string(parent ?? "");
  for (const part of path) {
    if (typeof part === "number") h.int(part);
    else h.string(part);
  }
  const [a, b] = h.lanes();
  return makeRef(kind, a, b);
}

/** A structural ref that is simply an index under its kind (e.g. a sector of the galaxy). */
export function indexRef(kind: Kind, index: number): Ref {
  if (kind.origin !== "structural") throw new Error(`${kind.code} refs are minted, not structural`);
  return makeRef(kind, hi32(index), lo32(index));
}

/**
 * Hands out minted refs. One per universe; its state is saved with the world.
 * Minting order is part of history, so only the authoritative simulation mints.
 */
export class Minter {
  private readonly next = new Map<string, number>();
  mint(kind: Kind): Ref {
    if (kind.origin !== "minted") throw new Error(`${kind.code} refs are structural, not minted`);
    const n = (this.next.get(kind.code) ?? 0) + 1;
    this.next.set(kind.code, n);
    return makeRef(kind, hi32(n), lo32(n));
  }
  /** How many of a kind have been minted. */
  count(kind: Kind): number {
    return this.next.get(kind.code) ?? 0;
  }
  /** The counters, in code order, for saving and hashing. */
  state(): [string, number][] {
    return [...this.next.entries()].sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  }
  restore(state: readonly (readonly [string, number])[]): void {
    this.next.clear();
    for (const [code, n] of state) this.next.set(code, n);
  }
}
