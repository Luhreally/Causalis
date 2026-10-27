// Who a figure of the war drawn about a town is, and the blows a figure of a battle has taken so far
// (Phase 55 wave 5; asked for 2026-10-27: "i cant click on the soldiers on the field and see they
// family and anatomy etc in town vieww"). The war about a town (Phase 40) draws so many of each host,
// and the fallen of the battle fought before it where they fell: once that battle is fought, each
// figure stands for a man of its roll — its fallen the roll's fallen, its living the rest, each in
// the order drawn, so the same figure is the same man however often it is tapped. Before it is
// fought, a figure stands for many: history names a battle's men once it is fought. Pure.
import type {
  BattleRoll,
  RollEntry,
  StruckMember,
  StruckNow,
  WoundMember,
} from "../bridge/index.ts";
import { BLOW_PLACES, type BattleField, type BlowPlace } from "./battle.ts";
import type { BlowTold, Blows } from "./blows.ts";
import type { TownWarScene } from "./townwar.ts";

/** A soldier of a town's war drawn: its side, which of its host it is, and whether it lies fallen. */
export type WarSlot = { readonly side: 0 | 1; readonly i: number; readonly fallen: boolean };

/** Which soldier a scene's slot is (`each` of a side's host drawn, then its fallen: townWarScene's order); null: none. */
export function warSlot(slot: number, each: number): WarSlot | null {
  if (!Number.isInteger(slot) || slot < 0 || each <= 0 || slot >= 4 * each) return null;
  const side: 0 | 1 = slot < 2 * each ? 0 : 1,
    within = slot - side * 2 * each;
  return within < each
    ? { side, i: within, fallen: false }
    : { side, i: within - each, fallen: true };
}

/**
 * The man of a battle's roll a soldier of the war drawn about a town stands for (by its slot in the
 * scene): of its side, a fallen one the roll's fallen, a living one its rest (those who came
 * through whole, then its wounded), by its place among those drawn so; null: the roll names no
 * more of them.
 */
export function warManOf(
  scene: TownWarScene,
  each: number,
  slot: number,
  roll: BattleRoll,
): { readonly entry: RollEntry; readonly fate: "fell" | "maimed" | "wounded" | "stood" } | null {
  const at = warSlot(slot, each);
  if (!at) return null;
  const side = at.side === 0 ? roll.attacker : roll.defender,
    base = at.side * 2 * each + (at.fallen ? each : 0),
    drawn = (i: number) => {
      const q = scene.soldiers[base + i];
      return !!q && q.size > 0.5 && (q.doing === "fallen") === at.fallen;
    };
  if (!drawn(at.i)) return null;
  let rank = 0;
  for (let i = 0; i < at.i; i++) if (drawn(i)) rank++;
  if (at.fallen) {
    const entry = side.fell[rank];
    return entry ? { entry, fate: "fell" } : null;
  }
  const entry = rank < side.stood.length ? side.stood[rank] : side.hurt[rank - side.stood.length];
  return entry
    ? { entry, fate: rank < side.stood.length ? "stood" : entry.maimed ? "maimed" : "wounded" }
    : null;
}

/**
 * The blows a figure of a battle has taken by battle second `s`, as a body tells them (bridge/body.ts):
 * in the member history says its man was struck in, where told (an eye is drawn struck on the head).
 */
export function struckOf(
  field: BattleField,
  blows: Blows,
  id: number,
  s: number,
  member?: WoundMember,
): StruckNow[] {
  const k = blows.of[id] ?? -1,
    hit = k >= 0 ? blows.hits[k] : undefined;
  if (!hit || hit.at > s || !field.troopers[id]) return [];
  return [
    {
      member: member ?? (hit.place as WoundMember),
      lost: hit.lost !== null && hit.lost === hit.place,
      fell: hit.back === null,
    },
  ];
}

/** A member history tells as the place a blow lands on a figure drawn: an eye on its head (null: none drawn so). */
export function placeOfMember(m: WoundMember): BlowPlace | null {
  if (m === "eye-l" || m === "eye-r") return "head";
  return BLOW_PLACES.find((p) => p === m) ?? null;
}

/**
 * Where history struck the men a battle's figures stand for (the host's "battle.members", by ref),
 * for newBlows by a figure's id: so the battle seen near strikes each named man where his page says
 * he was struck — the blow that killed him, or his wound — and cuts a member off only where history
 * did (Phase 55 wave 5).
 */
export function toldBlows(
  names: readonly (RollEntry | null)[],
  members: Readonly<Record<string, StruckMember>>,
): BlowTold {
  return (id) => {
    const e = names[id],
      m = e ? members[e.ref] : undefined,
      place = m ? placeOfMember(m.member) : null;
    return m && place ? { place, cut: m.cut } : null;
  };
}
