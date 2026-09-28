// The god's answers to a great happening (Phase 11 M100): which of the hand's acts may answer
// an event told in its window — rain and a fat harvest for a land in famine; for a realm
// followed at war, a fat harvest at its seat, or a plague upon its foe's. Only what the hand
// can do, where it can do it (a peopled land). Pure reads of the world.
import { parseRef, type Ref, type World } from "../../kernel/index.ts";
import { politiesOf, populationContext, warsOf } from "../../sim/index.ts";
import type { Answer } from "../../bridge/index.ts";
import { landTitle } from "./names.ts";

/** How many years the hand's answer lasts. */
const YEARS = 3;

/** The answers the hand may give to event `ref`, told of the thing followed `watch`. */
export function answersOf(world: World, ref: string, watch: string): Answer[] {
  const e = world.events.get(ref as Ref);
  if (!e) return [];
  const ctx = populationContext(world),
    peopled = (cell: number) => (ctx.provinces.get(cell)?.total() ?? 0) > 0,
    cellOf = (place: string | null | undefined) => {
      if (!place?.startsWith("cell:")) return null;
      try {
        return parseRef(place as Ref).b;
      } catch {
        return null;
      }
    };
  switch (e.type) {
    case "people.famine": {
      const cell = cellOf(e.place);
      if (cell === null || !peopled(cell)) return [];
      const where = landTitle(world, cell);
      return [
        {
          label: `Send rain upon ${where} (${YEARS} years)`,
          act: "act.rain",
          args: { cell, sign: 1, years: YEARS },
        },
        {
          label: `A fat harvest in ${where} (${YEARS} years)`,
          act: "act.harvest",
          args: { cell, sign: 1, years: YEARS },
        },
      ];
    }
    case "war.declared": {
      const war = warsOf(world)
          .all()
          .find((w) => w.event === ref),
        realms = politiesOf(world);
      if (!war) return [];
      // (The side of the realm followed — or of the realm the land followed is in — else the
      // one attacked.)
      const side = watch.startsWith("cell:") ? realms.of(cellOf(watch) ?? -1)?.ref : watch,
        ours = side === war.attacker ? war.attacker : war.defender,
        theirs = ours === war.attacker ? war.defender : war.attacker,
        us = realms.get(ours),
        them = realms.get(theirs),
        out: Answer[] = [];
      if (us && us.ended === null && peopled(us.seat))
        out.push({
          label: `A fat harvest at ${us.town}'s seat (${YEARS} years)`,
          act: "act.harvest",
          args: { cell: us.seat, sign: 1, years: YEARS },
        });
      if (them && them.ended === null && peopled(them.seat))
        out.push({
          label: `A plague upon ${them.town}'s seat (${YEARS} years)`,
          act: "act.plague",
          args: { cell: them.seat, sign: -1, years: YEARS },
        });
      return out;
    }
    default:
      return [];
  }
}
