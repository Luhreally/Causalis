// A town's beasts and power (town mode, R9), as RimWorld's animals and power tabs have them, read off the town: who keeps
// its flock and how well trained each is at it (their hours at the herds, as their skill reads them: the training of
// beast and keeper alike); what pulls and carries for it (draught beasts, riding, the cart, where its land knows them);
// and what drives its works, rung by rung: hands, beasts, engines, power by wire, each where its land knows it, with the
// works it drives standing in the town. The flock itself, and the wild beasts of its land that could be kept, its view
// draws off its plan. Read only.
import { type World } from "../kernel/index.ts";
import { OCC, PRINCIPLES } from "../rules/index.ts";
import { knows, populationContext } from "../sim/index.ts";
import { placeBeastsRef, type PlaceInspectBeasts } from "../bridge/index.ts";
import { placeSkill, type Place } from "./place.ts";
import { placeWho } from "./placeplan.ts";

/** The rungs of what drives a town's works, each by the principles that bring it (any one of them known). */
const POWER: readonly (readonly [string, readonly string[], string])[] = [
  ["Hands", [], "its people's own strength, at every work"],
  ["Beasts", ["draught"], "beasts yoked to its ploughs and carts"],
  [
    "Engines",
    ["steam-engine", "heat-engines", "sun-engines"],
    "engines at its works, to pump, hoist and turn",
  ],
  [
    "Power by wire",
    ["electricity", "sea-electricity"],
    "power carried to its works and homes by wire",
  ],
];
/** Each rung as what does a town's work, in a phrase. */
const POWER_BY: Readonly<Record<string, string>> = {
  Hands: "its people's own hands",
  Beasts: "hand and beasts' strength",
  Engines: "engines",
  "Power by wire": "power by wire",
};
/** What pulls and carries for it, where its land knows how. */
const CARRY: readonly (readonly [string, string])[] = [
  ["draught", "Beasts pull its ploughs"],
  ["riding", "Beasts are ridden"],
  ["cart", "Carts carry its loads"],
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A town's beasts and power (R9). */
export function placeBeasts(world: World, place: Place): PlaceInspectBeasts {
  const ctx = populationContext(world),
    cell = place.cell,
    p = place.people,
    who = placeWho(world, place),
    keepers: PlaceInspectBeasts["keepers"][number][] = [];
  for (let i = 0; i < p.n; i++) {
    if ((p.sexOcc[i]! & 15) !== OCC.herder) continue;
    const s = placeSkill(place, i),
      w = who(i);
    keepers.push({ name: w.name, ref: w.ref, hours: s.hours, words: cap(s.words) });
  }
  keepers.sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  const name = (id: string) => PRINCIPLES.find((x) => x.id === id)?.name ?? id,
    known = (id: string) => knows(ctx, cell, id),
    power = POWER.map(([rung, by, words]) => {
      const had = by.length === 0 ? null : (by.find(known) ?? null);
      return {
        rung,
        on: by.length === 0 || had !== null,
        words:
          by.length === 0
            ? cap(words)
            : had
              ? `${cap(words)}: by ${name(had)}`
              : `Not yet: its land knows none of ${by.map(name).join(", ")}`,
      };
    }),
    carry = CARRY.filter(([id]) => PRINCIPLES.some((x) => x.id === id) && known(id)).map(
      ([, w]) => w,
    ),
    top = [...power].reverse().find((x) => x.on)!;
  return {
    kind: "beasts",
    ref: placeBeastsRef(place.town),
    name: "Its beasts and power",
    icon: "🐂",
    // (Said as what does the work, U4: "driven by beasts" read as beasts driving it.)
    sub: `${keepers.length} keep its flock · its work done by ${POWER_BY[top.rung] ?? top.rung.toLowerCase()}`,
    keepers: keepers.slice(0, 12),
    more: Math.max(0, keepers.length - 12),
    carry,
    power,
  };
}
