// The pages' words (Phase 10 M91): names as links, numbers in words, and a thing's own
// history — the events that name it, newest first, each a link to its page.
import { YEAR, isRef, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { why } from "../../causal/index.ts";
import type { Item, Line, Part, Span, Stat } from "../../bridge/index.ts";

/** A name that opens its page (plain words when it has none). */
export function link(text: string, ref: string | null | undefined): Span {
  return ref ? { text, ref } : text;
}

/** A whole number with its thousands marked: 12,345. */
export function count(n: number): string {
  const whole = Math.round(n),
    digits = String(Math.abs(whole)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return whole < 0 ? `-${digits}` : digits;
}

/** So many of a thing, said: "1 person", "12 people". */
export function many(n: number, one: string, more: string): string {
  return `${count(n)} ${Math.round(n) === 1 ? one : more}`;
}

/** A share as a percentage. */
export function share(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function yearNow(world: World): number {
  return Math.floor(world.now / YEAR);
}

/** The year of a moment (as the explainer counts it: a moment closing a year is of that year). */
export function yearAt(t: number): number {
  return yearOfMoment(t);
}

/** An event's words without the year they end on (a line that says its year first). */
export function bare(claim: string): string {
  return claim.replace(/,? (?:in )?year -?\d+$/, "");
}

/** What a ref is, in the explainer's words (every ref has some). */
export function claimOf(world: World, ref: string): string {
  return isRef(ref) ? why(world, ref).claim : ref;
}

/** A headline number or word, with what explains it and what it is made of. */
export function stat(
  label: string,
  value: Line | string,
  extra: { why?: string | null; parts?: readonly Part[] } = {},
): Stat {
  return {
    label,
    value: typeof value === "string" ? [value] : value,
    ...(extra.why ? { why: extra.why } : {}),
    ...(extra.parts?.length ? { parts: extra.parts } : {}),
  };
}

/** A part of a number: its label (words or a name) and its amount in words. */
export function part(label: Line | string, value: string): Part {
  return { label: typeof label === "string" ? [label] : label, value };
}

/** An entry of a list that opens a page. */
export function item(line: Line | string, ref?: string | null, year?: number): Item {
  return {
    line: typeof line === "string" ? [line] : line,
    ...(ref ? { ref } : {}),
    ...(year !== undefined ? { year } : {}),
  };
}

/**
 * The events that name a thing (as one of their subjects or their place), newest first:
 * at most `most` of them, of at least `least` importance, each a line "Year N: what
 * happened" that opens the event's page.
 */
export function eventsAbout(world: World, refs: readonly string[], most = 24, least = 0): Item[] {
  const wanted = new Set(refs),
    all = world.events.all(),
    out: Item[] = [];
  for (let i = all.length - 1; i >= 0 && out.length < most; i--) {
    const e = all[i]!;
    if (e.importance < least) continue;
    if (!(e.place && wanted.has(e.place)) && !e.subjects.some((s) => wanted.has(s))) continue;
    const year = yearAt(e.t);
    out.push({ line: [`Year ${year}: `, { text: bare(why(world, e.id).claim), ref: e.id }], year });
  }
  return out;
}

/** The events that cite one as a cause: what it led to, newest first. */
export function eventsCiting(world: World, ref: string, most = 12): Item[] {
  const all = world.events.all(),
    out: Item[] = [];
  for (let i = all.length - 1; i >= 0 && out.length < most; i--) {
    const e = all[i]!;
    if (!e.causes.some((c) => c.ref === ref)) continue;
    const year = yearAt(e.t);
    out.push({ line: [`Year ${year}: `, { text: bare(why(world, e.id).claim), ref: e.id }], year });
  }
  return out;
}

/** The first letter up. */
export function sentence(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

/** A ref as a Ref, for the stores (the page's refs are plain strings on the wire). */
export function asRef(ref: string): Ref {
  return ref as Ref;
}
