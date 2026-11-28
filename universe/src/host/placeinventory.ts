// What one holds, by what it is made of (town mode, R3), as Classic's inventory panel had it: each thing they hold in its
// slot (a tool in hand, a garment on their body, their household's pot at its hearth where they are its cook), how worn,
// working or worn out; and all they hold and carry by the stuff it is, with its weight and its colour as the world's
// matter has it. Read off the world's own make-up of each good (rules/matter.ts GOOD_MATTER: a unit's weight, its parts
// by substance), with the town's own stuff for a thing's head, its cloth, its ware. Read only.
import type { World } from "../kernel/index.ts";
import { GOODS, GOOD_MATTER, findSubstance, type MakeUp } from "../rules/index.ts";
import { placeItemRef, type PlaceInventory } from "../bridge/index.ts";
import { GEAR, placeGear, type Item, type Place } from "./place.ts";

/** Each kind of thing's good (GEAR), slot and sign. */
const SLOT: Readonly<Record<number, readonly [string, string, string]>> = {
  [GEAR.tool]: ["tools", "In hand", "🛠️"],
  [GEAR.garment]: ["clothing", "On the body", "👕"],
  [GEAR.pot]: ["pottery", "At the hearth", "🍲"],
};
/** Wear from which a thing is said to be failing (thousandths of its life). */
const FAILING = 800;

/** The way a thing of a good is made that its stuff names (its head's substance, or the way's own), else the first. */
export function wayOf(ways: readonly MakeUp[], stuff: string): MakeUp | null {
  const s = stuff.toLowerCase();
  return (
    ways.find((w) => s.includes(w.id) || w.parts.some(([id]) => id.length > 3 && s.includes(id))) ??
    ways[0] ??
    null
  );
}
/** A substance's colour, as a CSS colour (grey where the world's matter does not name it). */
export function colourOf(id: string): string {
  const c = findSubstance(id)?.colour;
  return c
    ? `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`
    : "rgb(150, 150, 150)";
}

/** What one holds and carries, slot by slot and by stuff (R3). */
export function placeInventory(
  world: World,
  place: Place,
  i: number,
  carry: { readonly good: number; readonly amount: number } | null,
): PlaceInventory {
  const kg = new Map<string, { kg: number; colour: string }>(),
    add = (name: string, w: number, colour: string) => {
      if (!(w > 0)) return;
      const was = kg.get(name);
      if (was) was.kg += w;
      else kg.set(name, { kg: w, colour });
    },
    items = placeGear(world, place, i),
    slots: PlaceInventory["slots"][number][] = [];
  for (const x of items) {
    const [good, slot, icon] = SLOT[x.k] ?? ["tools", "Held", "•"],
      m = GOOD_MATTER[good];
    slots.push({
      slot,
      icon,
      name: x.stuff,
      ref: placeItemRef(place.town, place.people.id[i]!, x.k),
      wear: Math.min(100, Math.round(x.wear / 10)),
      state: x.wear >= 1000 ? "worn out" : x.wear >= FAILING ? "failing" : "working",
    });
    if (m) byStuff(x, m.unitKg, wayOf(m.ways, x.stuff), add);
  }
  // (What they carry: so much of a good, by the parts its first way is made of.)
  if (carry && carry.amount > 0) {
    const g = GOODS[carry.good],
      m = g ? GOOD_MATTER[g.id] : undefined,
      way = m?.ways[0];
    if (m && way)
      for (const [id, share] of way.parts)
        add(findSubstance(id)?.name ?? id, carry.amount * m.unitKg * share, colourOf(id));
  }
  const materials = [...kg]
    .map(([name, x]) => ({ name, kg: Math.round(x.kg * 100) / 100, colour: x.colour }))
    .sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name));
  return {
    slots,
    materials,
    kg: Math.round(materials.reduce((s, x) => s + x.kg, 0) * 100) / 100,
  };
}
/**
 * A thing by its stuff: its head (a tool's, the first part of its way) of the town's own stuff, named as the town names
 * it; the rest by the substances of its way (a tool's haft of wood). A garment and a pot are of their cloth and ware whole.
 */
function byStuff(
  x: Item,
  unitKg: number,
  way: MakeUp | null,
  add: (name: string, kg: number, colour: string) => void,
): void {
  if (!way || x.k !== GEAR.tool) {
    const id = way?.parts[0]?.[0] ?? "";
    add(x.stuff, unitKg, colourOf(id));
    return;
  }
  const [head, ...rest] = way.parts;
  if (head) add(x.stuff, unitKg * head[1], colourOf(head[0]));
  for (const [id, share] of rest) add(findSubstance(id)?.name ?? id, unitKg * share, colourOf(id));
}
