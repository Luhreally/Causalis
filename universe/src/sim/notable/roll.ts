// Who commanded each realm's host (asked 2026-11-22: "every host in a battle names its commander"). The war asks who commands a host
// before every battle (sim/notable/notables.ts commandIn): the one its court keeps for the army, or someone the day makes. A battle
// told its commanders' names only where one stood high enough to be spoken of (an untried name on every battle was 0.4 MB of a
// save at 1,500). Kept here instead, once a commander: their name, the realm whose host it was, and the first and last battles they
// led (by the moments they were fought, so a battle's commander is the one whose span holds it), with their wins and losses. A reading
// beside the world, never read by its rules and no part of its hash: a save made without it loads, and it begins there, empty. Let
// go with the battles: a commander none of whose battles history still tells is let go too.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";

/** One who commanded a realm's host: their id (sim/notable), name, the realm, the moments of the first and last battle, won and lost. */
export type Led = {
  readonly id: number;
  readonly name: string;
  readonly realm: Ref;
  readonly first: number;
  last: number;
  /** The last battle's ref (to know when history lets it go). */
  lastRef: Ref;
  won: number;
  lost: number;
};

export const COMMAND_ROLL_STORE = "readings.commanders";

export class CommandRollStore implements StateStore {
  readonly name = COMMAND_ROLL_STORE;
  readonly packed = true;
  readonly observational = true;
  readonly outsideRules = true;
  private list: Led[] = [];
  private byRealm: Map<Ref, Led[]> | null = null;
  /** Each realm's latest: a commander led again after another is a new span. */
  private current = new Map<Ref, Led>();

  /** A battle a commander led: their span of the realm's host's battles grows to it. */
  note(id: number, name: string, realm: Ref, battle: Ref, t: number, won: boolean): void {
    const serial = t;
    let x = this.current.get(realm);
    if (!x || x.id !== id) {
      x = { id, name, realm, first: serial, last: serial, lastRef: battle, won: 0, lost: 0 };
      this.list.push(x);
      this.current.set(realm, x);
      this.byRealm = null;
    }
    x.last = serial;
    x.lastRef = battle;
    if (won) x.won++;
    else x.lost++;
  }
  /** Who commanded a realm's host at a battle (the moment it was fought), where it is kept. */
  at(realm: Ref, t: number): Led | undefined {
    if (!this.byRealm) {
      this.byRealm = new Map();
      for (const x of this.list) {
        const l = this.byRealm.get(x.realm);
        if (l) l.push(x);
        else this.byRealm.set(x.realm, [x]);
      }
    }
    for (const x of this.byRealm.get(realm) ?? []) if (x.first <= t && t <= x.last) return x;
    return undefined;
  }
  /** Those a realm's host was led by, the latest first. */
  of(realm: Ref): Led[] {
    return this.list.filter((x) => x.realm === realm).reverse();
  }
  /** Those whose last battle history no longer tells are let go. */
  prune(world: World): void {
    const before = this.list.length;
    this.list = this.list.filter((x) => !!world.events.get(x.lastRef));
    if (this.list.length === before) return;
    this.byRealm = null;
    this.current = new Map(this.list.map((x) => [x.realm, x]));
  }
  get size(): number {
    return this.list.length;
  }
  pinned(): Ref[] {
    return [];
  }
  hashInto(_h: Hasher): void {}
  save(): unknown {
    return { list: this.list };
  }
  load(state: unknown): void {
    const s = state as { list?: Led[] } | null;
    this.list = (s?.list ?? []).map((x) => ({ ...x }));
    this.byRealm = null;
    this.current = new Map(this.list.map((x) => [x.realm, x]));
  }
}

export function commandRollOf(world: World): CommandRollStore | null {
  return world.peek<CommandRollStore>(COMMAND_ROLL_STORE) ?? null;
}

/** Who led each side at a battle (an event of `war.battle` at moment `t`, its realms its second and third subjects), where kept. */
export function battleCommanders(
  world: World,
  t: number,
  realms: readonly [Ref, Ref],
): [Led | undefined, Led | undefined] {
  const roll = commandRollOf(world);
  return roll ? [roll.at(realms[0], t), roll.at(realms[1], t)] : [undefined, undefined];
}
