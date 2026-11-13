// Hosts the god stood up through one it had entered (asked 2026-11-13: "when i rule i should have ultimate power if god
// is channelled"): men of a realm's own kind, as many as were asked, armed as asked, out of nothing but the god's word.
// They stand in its host beside those it fields from its own lands: they weigh in its strength and fight its battles,
// and the fallen among them are struck from them, not from its lands' people. They waste a little each year as any host
// kept under arms does, and are gone when their realm is. Nothing kept, nothing hashed, not even a name, while none stands.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";

/** A host the god stood up for a realm. */
export type GodHost = {
  readonly realm: Ref;
  /** The land it stood up at. */
  readonly cell: number;
  /** How many still stand. */
  men: number;
  /** As many as stood up. */
  readonly raised: number;
  /** Each man's power in the field, against an unarmed man's 1 (rules/designs.ts hostPower). */
  readonly power: number;
  /** What they bear, in words. */
  readonly arms: string;
  readonly year: number;
  readonly event: Ref;
};

/** Of a host kept under arms with no war to feed it, the share gone each year: age, desertion, sickness in camp. */
export const GOD_HOST_WASTE = 0.04;
/** The fewest left that are a host still. */
export const GOD_HOST_LEAST = 50;

export class GodHostStore implements StateStore {
  readonly name = "war.godhosts";
  private list: GodHost[] = [];

  all(): readonly GodHost[] {
    return this.list;
  }
  add(h: GodHost): void {
    this.list.push(h);
  }
  drop(h: GodHost): void {
    this.list = this.list.filter((x) => x !== h);
  }
  /** The god's hosts standing for a realm (none, nearly always). */
  of(realm: Ref): GodHost[] {
    return this.list.length ? this.list.filter((h) => h.realm === realm) : [];
  }
  pinned(): Ref[] {
    return this.list.map((h) => h.event);
  }
  /** None stands: nothing in a world's hash, not even a name. */
  dormant(): boolean {
    return !this.list.length;
  }
  hashInto(h: Hasher): void {
    h.value(this.list);
  }
  save(): unknown {
    return this.list.length ? { list: this.list } : {};
  }
  load(state: unknown): void {
    this.list = ((state as { list?: GodHost[] } | null)?.list ?? []).map((h) => ({ ...h }));
  }
}

export function godHostsOf(world: World): GodHostStore | null {
  return world.hasStore("war.godhosts") ? world.store<GodHostStore>("war.godhosts") : null;
}

/** How many of the god's men stand for a realm (0 for nearly every realm). */
export function godMen(world: World, realm: Ref): number {
  const held = godHostsOf(world)?.of(realm);
  if (!held?.length) return 0;
  let n = 0;
  for (const h of held) n += h.men;
  return n;
}

/** The god's men's weight in a realm's strength, before its people's bodies (0 for nearly every realm). */
export function godPower(world: World, realm: Ref): number {
  const held = godHostsOf(world)?.of(realm);
  if (!held?.length) return 0;
  let n = 0;
  for (const h of held) n += h.men * h.power;
  return n;
}

/** The fallen of a realm's side struck from the god's men first by their share of the field: how many of them fell. */
export function godFall(world: World, realm: Ref, fielded: number, dead: number): number {
  const held = godHostsOf(world)?.of(realm);
  if (!held?.length || dead <= 0) return 0;
  const men = held.reduce((n, h) => n + h.men, 0),
    fell = Math.min(men, Math.round((dead * men) / Math.max(1, fielded)));
  let left = fell;
  for (const h of held) {
    const take = Math.min(h.men, Math.round((fell * h.men) / Math.max(1, men)), left);
    h.men -= take;
    left -= take;
  }
  for (const h of held)
    if (left > 0 && h.men > 0) {
      const take = Math.min(h.men, left);
      h.men -= take;
      left -= take;
    }
  return fell;
}
