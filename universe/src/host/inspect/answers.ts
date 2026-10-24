// The god's answers to a great happening (Phase 11 M100): which of the hand's acts may answer
// an event told in its window — rain and a fat harvest for a land in famine; for a realm
// followed at war, a fat harvest at its seat, a plague upon its foe's, or peace between them;
// for a realm that took captives, crushed a rising, lost its people's faith or met a movement to
// free its bound, its chains broken or a sign for or against its rule (Phase 19 M138). Only what
// the hand can do, where it can do it (a peopled land, a realm holding the bound). Pure reads.
import { parseRef, type Ref, type World } from "../../kernel/index.ts";
import {
  creditOf,
  orderOf,
  politiesOf,
  populationContext,
  strifeOf,
  warsOf,
} from "../../sim/index.ts";
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
      // (Or the war ended before it is fought: the god's hold on the peoples, Phase 12 M107.)
      if (war.ended === null && us?.ended === null && them?.ended === null)
        out.push({
          label: `Make peace between ${us.town} and ${them.town}`,
          act: "act.peace",
          args: { a: war.attacker, b: war.defender },
        });
      return out;
    }
    case "order.captives":
    case "order.revolt":
    case "order.crushed":
    case "order.crisis":
    case "order.movement": {
      const r = politiesOf(world).get(e.subjects[0] as Ref),
        store = orderOf(world);
      if (!r || r.ended !== null || !store) return [];
      const out: Answer[] = [];
      if (r.members.some((c) => store.bound(c) >= 0.0005))
        out.push({
          label: `Break the chains of ${r.town}'s bound`,
          act: "act.unchain",
          args: { realm: r.ref },
        });
      if (e.type === "order.crisis" || e.type === "order.movement")
        out.push({
          label: `A sign for ${r.town}'s rule`,
          act: "act.mandate",
          args: { realm: r.ref, sign: 1 },
        });
      out.push({
        label: `A sign against ${r.town}'s rule`,
        act: "act.mandate",
        args: { realm: r.ref, sign: -1 },
      });
      return out;
    }
    // A sickness risen or come (Phase 20 M140): the land warded, or the sickness loosed on another.
    case "health.rose":
    case "health.outbreak": {
      const cell = e.place ? parseRef(e.place as Ref).b : -1,
        prov = populationContext(world).provinces.get(cell);
      if (!prov || prov.total() <= 0) return [];
      const out: Answer[] = [
        {
          label: `Ward ${landTitle(world, cell)} against sickness`,
          act: "act.ward",
          args: { cell },
        },
      ];
      const realm = politiesOf(world).of(cell);
      if (realm && realm.ended === null && realm.seat !== cell)
        out.push({
          label: `Ward ${realm.town}'s seat`,
          act: "act.ward",
          args: { cell: realm.seat },
        });
      return out;
    }
    // Grain lent, or a war chest (Phase 21 M144): the debt forgiven; a repudiation: its lender broken.
    case "credit.lent":
    case "credit.chest": {
      const cell = e.place ? parseRef(e.place as Ref).b : -1;
      if (!creditOf(world)?.owedBy(cell).loan) return [];
      return [
        {
          label: `Forgive ${landTitle(world, cell)} its debts`,
          act: "act.forgive",
          args: { cell },
        },
      ];
    }
    case "credit.defaulted": {
      const h = creditOf(world)?.house(e.subjects[1] as Ref);
      if (!h || h.failed !== null) return [];
      return [{ label: `Break ${h.name}`, act: "act.break", args: { cell: h.cell } }];
    }
    // A coup won (Phase 22 M145): the realm given back its own rule; foiled: its army stirred again.
    case "strife.coup":
    case "strife.foiled": {
      const r = politiesOf(world).get(e.subjects[0] as Ref);
      if (!r || r.ended !== null) return [];
      return strifeOf(world)?.junta(r.ref)
        ? [
            {
              label: `Give ${r.town} back its own rule`,
              act: "act.restore",
              args: { cell: r.seat },
            },
          ]
        : [{ label: `Stir ${r.town}'s army again`, act: "act.incite", args: { cell: r.seat } }];
    }
    default:
      return [];
  }
}
