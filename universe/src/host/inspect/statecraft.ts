// A realm's Powers tab (round E, order): who holds which powers and the rule read off them, what each of its groups has
// come to want and from what, its choices put to its people, its spies and those it caught, the lands it holds by force and
// those that fight it there, and the bodies of realms it sits in. Each block reads the world's own stores; phone first: facts
// and short lists, no table wider than a phone.
import type { World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import {
  GENERAL,
  GROUPS,
  LAW,
  LEADERSHIP,
  SUCCESSION,
  holdsOf,
  interestsOf,
  populationContext,
  type Polity,
} from "../../sim/index.ts";
import { HOLDING } from "../../rules/index.ts";
import { part, share, stat } from "./words.ts";

/** Why a realm is ruled as it is: its numbers and whose sway is greatest, as formFromPowers reads them. */
export function powersBlocks(world: World, r: Polity): Block[] {
  const ctx = populationContext(world),
    [force, voice] = holdsOf(world, r.ref) as [number, number],
    interests = r.ended === null ? interestsOf(ctx, r, world.now) : [],
    sway = new Map(interests.map((i) => [i.group, i.sway])),
    temple = sway.get("the temple") ?? 0,
    others = Math.max(sway.get("the court") ?? 0, sway.get("the army") ?? 0),
    who =
      r.leadership === GENERAL
        ? "A general holds it: its host seized it, and holds it until it is restored."
        : voice >= 0.6
          ? `Its choices are carried by many (${share(voice)}): an assembly decides.`
          : voice >= HOLDING.voiceMid
            ? `Its choices are carried by a few (${share(voice)}): they decide in council.`
            : temple > others && temple > 0.1
              ? `Its choices are carried by one (${share(voice)}), and the temple outweighs the court and the arms: a priest-king.`
              : `Its choices are carried by one (${share(voice)}): a chief decides.`,
    passes =
      r.succession === 1
        ? "Rule passes by choice: many choose."
        : r.succession === 2
          ? `Rule passes by acclaim: the arms are in its people's hands (the seat keeps ${share(force)} of them).`
          : "Rule passes by birth: few choose, and the arms are the seat's.",
    rows: Stat[] = [
      stat("Who decides", who),
      stat("How rule passes", passes),
      stat(
        "Its law",
        r.law === 2
          ? "Sacred: the temple outweighs the court and the arms."
          : r.law === 1
            ? "Written: it writes, and its word is carried."
            : "Custom: what has always been done.",
      ),
      stat("Read as", `${LEADERSHIP[r.leadership]}, ${SUCCESSION[r.succession]}, ${LAW[r.law]}`),
    ];
  if (interests.length)
    rows.push(
      stat("Whose sway", "Shares of what its choices weigh", {
        parts: GROUPS.filter((g) => (sway.get(g) ?? 0) >= 0.005)
          .sort((a, b) => (sway.get(b) ?? 0) - (sway.get(a) ?? 0))
          .map((g) => part(g, share(sway.get(g) ?? 0))),
      }),
    );
  return [{ type: "facts", title: "Who holds which powers", rows }];
}
