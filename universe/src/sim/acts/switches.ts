// The world's own hand, switched (asked for 2026-11-11: "give option in game to get rid of natural
// disasters and other options"): what the player has turned off of what the world does by itself —
// its disasters (quakes, wildfire, stones from the sky: acts/wild.ts), its plagues (no sickness
// rises, wakes, comes from the stars or spreads: health/health.ts). Each is a command, so a history
// says when it was turned off and on. A world never switched keeps nothing here and is hashed as if
// the store were not there (dormant), so no world anyone has moves for it.
import type { Hasher, StateStore, World } from "../../kernel/index.ts";

/** What can be turned off. */
export const SWITCHES = ["disasters", "plagues"] as const;
export type SwitchId = (typeof SWITCHES)[number];

export class SwitchStore implements StateStore {
  readonly name = "acts.switches";
  /** Those turned off now, in SWITCHES' order. */
  off: SwitchId[] = [];

  dormant(): boolean {
    return !this.off.length;
  }
  hashInto(h: Hasher): void {
    h.value(this.off);
  }
  save(): unknown {
    return this.off.length ? { off: this.off } : {};
  }
  load(state: unknown): void {
    const off = (state as { off?: unknown } | null)?.off;
    this.off = Array.isArray(off) ? SWITCHES.filter((s) => (off as unknown[]).includes(s)) : [];
  }
}

/** Whether the player has turned this off in this world. */
export function switchedOff(world: World, what: SwitchId): boolean {
  return (
    world.hasStore("acts.switches") && world.store<SwitchStore>("acts.switches").off.includes(what)
  );
}

/** Teach a world its switches: "world.switch" { what, on }. */
export function installSwitches(world: World): SwitchStore {
  const store = world.register(new SwitchStore());
  world.defineCommand({
    type: "world.switch",
    validate: (args) => {
      const a = args as { what?: unknown; on?: unknown } | null;
      if (!a || !(SWITCHES as readonly unknown[]).includes(a.what)) return "no such switch";
      if (typeof a.on !== "boolean") return "on or off?";
      return null;
    },
    apply: (command) => {
      const a = command.args as { what: SwitchId; on: boolean },
        off = new Set(store.off);
      if (a.on) off.delete(a.what);
      else off.add(a.what);
      store.off = SWITCHES.filter((s) => off.has(s));
    },
  });
  return store;
}
