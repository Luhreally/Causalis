// A realm asked where its next ship sails (Live a Line's space, S8, 2026-11-28): the hand that has followed a line from its
// first cell to the realm its people's land became part of says which star its next ship is to sail for. The realm's own
// voyage still decides everything else: whether it can sail at all, its drive, its machines, its settlers (voyages.ts). It
// heeds the ask only where the star is within its reach and holds a world its people could live on that no one has taken;
// else it sails as it would have, and the ask waits. Spent when the ship sails. A world never asked keeps nothing here and
// is hashed as if the store were not there (dormant), so no world anyone has moves for it.
import type { Hasher, Ref, StateStore, World } from "../../kernel/index.ts";

/** The reason a ship's sailing gives where it sailed for the star asked. */
export const ASKED_REASON = "the star it was asked to sail for";
/** The reason it gives where another took the star asked first, and it sailed where it would have. */
export const ASKED_TAKEN = "the star it was asked to sail for taken by another first";

export type SpaceAsk = { readonly realm: Ref; readonly star: Ref; readonly t: number };

export class SpaceAskStore implements StateStore {
  readonly name = "space.asks";
  asks: SpaceAsk[] = [];

  dormant(): boolean {
    return !this.asks.length;
  }
  hashInto(h: Hasher): void {
    h.value(this.asks);
  }
  save(): unknown {
    return this.asks.length ? { asks: this.asks } : {};
  }
  load(state: unknown): void {
    const asks = (state as { asks?: unknown } | null)?.asks;
    this.asks = Array.isArray(asks)
      ? asks.filter(
          (a): a is SpaceAsk =>
            !!a &&
            typeof (a as SpaceAsk).realm === "string" &&
            typeof (a as SpaceAsk).star === "string" &&
            typeof (a as SpaceAsk).t === "number",
        )
      : [];
  }

  of(realm: Ref): Ref | null {
    return this.asks.find((a) => a.realm === realm)?.star ?? null;
  }
  spend(realm: Ref): void {
    if (this.asks.some((a) => a.realm === realm))
      this.asks = this.asks.filter((a) => a.realm !== realm);
  }
}

/** The star a realm was asked to sail for next (null: none asked). */
export function askedStar(world: World, realm: Ref): Ref | null {
  return world.hasStore("space.asks") ? world.store<SpaceAskStore>("space.asks").of(realm) : null;
}

/** The ask spent: its ship has sailed. */
export function spendAsk(world: World, realm: Ref): void {
  if (world.hasStore("space.asks")) world.store<SpaceAskStore>("space.asks").spend(realm);
}

/**
 * Teach a world the ask: "space.ask" { realm, star } (star null: the ask taken back). Valid for a living realm and a star of
 * its sky; whether it can be heeded is the voyage's to say, year by year.
 */
export function installSpaceAsks(
  world: World,
  realmLives: (ref: Ref) => boolean,
  starOfSky: (ref: Ref) => boolean,
): SpaceAskStore {
  const store = world.register(new SpaceAskStore());
  world.defineCommand({
    type: "space.ask",
    validate: (args) => {
      const a = args as { realm?: unknown; star?: unknown } | null;
      if (typeof a?.realm !== "string" || !realmLives(a.realm as Ref))
        return "no such realm living";
      if (a.star !== null && (typeof a.star !== "string" || !starOfSky(a.star as Ref)))
        return "no such star in this sky";
      return null;
    },
    apply: (command, t) => {
      const a = command.args as { realm: Ref; star: Ref | null },
        rest = store.asks.filter((x) => x.realm !== a.realm);
      store.asks = a.star ? [...rest, { realm: a.realm, star: a.star, t }] : rest;
    },
  });
  return store;
}
