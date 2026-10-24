// The god calls strangers down (Phase 20 M142, asked for 2026-10-23: "i should see them landing
// on planets tryna socialize and like the different reactions and wars and exchanges"). Of the
// peoples of other stars already at the stars, the one least often come — the nearest of those —
// crosses the dark in a year at the god's call and comes down in the land the god chose. What
// follows is theirs and the land's, as when they come of themselves: how each meets the other,
// what passes between them, the sicknesses that cross.
import { defineEventType, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { cellRef, type Civilization } from "../../gen/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { civilizationsNear } from "./contact.ts";
import { peoplesOf, peopleWords, starPoint } from "./peoples.ts";

export const SUMMON_EVENTS = { called: defineEventType("act.summon", 6) };

/** Of the peoples at the stars by a year, the one the god calls: the least often come, then the nearest. */
export function calledPeople(
  world: World,
  ctx: PopulationContext,
  year: number,
): Civilization | null {
  const store = peoplesOf(world);
  if (!store) return null;
  const home = starPoint(world, ctx.generated.star.ref as Ref),
    far = (c: Civilization) => {
      const p = starPoint(world, c.star),
        x = p.x - home.x,
        y = p.y - home.y,
        z = p.z - home.z;
      return x * x + y * y + z * z;
    },
    came = (c: Civilization) => store.landings.filter((l) => l.civ === c.ref).length;
  return (
    [...civilizationsNear(world)]
      .filter((c) => c.stars <= year)
      .sort((a, b) => came(a) - came(b) || far(a) - far(b) || (a.ref < b.ref ? -1 : 1))[0] ?? null
  );
}

/** Teach a world the god's call to the strangers. */
export function installSummon(world: World, ctx: () => PopulationContext): void {
  world.defineCommand({
    type: "act.summon",
    validate: (args) => {
      const a = args as { cell?: unknown } | null,
        c = ctx();
      if (!peoplesOf(world)) return "no peoples of other stars in this sky";
      if (typeof a?.cell !== "number") return "a land is wanted";
      if (!((c.provinces.get(a.cell)?.total() ?? 0) > 0)) return "no one lives there";
      if (!calledPeople(world, c, yearOfMoment(world.now)))
        return "no people of another star sails between the stars yet";
      return null;
    },
    apply: (command, t) => {
      const c = ctx(),
        store = peoplesOf(world)!,
        year = yearOfMoment(t),
        cell = (command.args as { cell: number }).cell,
        civ = calledPeople(world, c, year)!,
        words = peopleWords(world, civ),
        event = world.events.emit({
          type: SUMMON_EVENTS.called.type,
          place: c.provinces.get(cell)?.ref ?? cellRef(0, cell),
          subjects: [civ.ref],
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { name: words.name, kind: words.kind },
        });
      store.ships.push({
        id: store.count++,
        civ: civ.ref,
        kind: "envoys",
        from: civ.star,
        to: c.generated.star.ref as Ref,
        sailed: year,
        arrives: year + 1,
        event,
        toward: null,
        heard: store.homeSignals !== null,
        arrived: null,
        cell,
      });
    },
  });
}
