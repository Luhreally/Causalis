// Signals on the pages (signals, docs/architecture/first-principles-plan.md, "Signals"): how fast a land's word goes and by what, how much of its
// dealings is on the line and what that does to its markets, its hosts and its work; what a signal step does, and why a world
// can or cannot come to it; and how much of its world a people knows. Read from lore; nothing here is kept.
import type { World } from "../../kernel/index.ts";
import type { Stat } from "../../bridge/index.ts";
import {
  OCC,
  SIGNAL,
  SIGNAL_STEPS,
  WORD_WAYS,
  connectivityOf,
  delayWords,
  infoShare,
  principle,
  wayName,
  wordPace,
} from "../../rules/index.ts";
import { loreOf, populationContext } from "../../sim/index.ts";
import { knownWorld } from "../known.ts";
import { count, share, stat } from "./words.ts";

const prinRef = (id: string) => `prin:${id}`;

/** What a land's signals come to: how fast its word goes, and what being on the line does to it. */
export function landSignalStats(world: World, cell: number): Stat[] {
  const lore = loreOf(world),
    ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p?.total()) return [];
  const knows = (id: string) => !!lore.get(cell, id),
    pace = wordPace(knows, ctx.medium),
    by = pace.way.by.at(-1)?.[0] ?? null,
    c = connectivityOf(lore.effect(cell, "signal")),
    rows: Stat[] = [
      stat("A word goes", `1,000 km in ${pace.words}, by ${wayName(pace.way, ctx.medium)}`, {
        why: by ? prinRef(by) : null,
      }),
    ];
  if (c <= 0) return rows;
  const info = infoShare(c),
    hands = p.occupation(OCC.crafter) + p.occupation(OCC.trader);
  rows.push(
    stat("On the line", `${share(c)} of its dealings`),
    stat(
      "Its markets",
      `traders move ${round(1 + SIGNAL.tradeShare * c)}× as much of what is spare, on a margin ${round(1 + SIGNAL.tradeMargin * c)}× as fine, and dealing costs ${share(SIGNAL.tradeCost * c)} less`,
    ),
    stat(
      "Information work",
      `${share(info)} of its crafters and traders (${count(hands * info)}): clerks at the key, operators at the exchange, makers of programs; its carriers move ${round(1 + SIGNAL.carriers * info)}× as much`,
    ),
    stat(
      "Its hosts afield",
      `kept in step with their seat: their supply thins ${share(SIGNAL.warSteadied * c)} less with each land out`,
    ),
  );
  return rows;
}

const round = (x: number) => `${Math.round(x * 10) / 10}`;

/** What a signal step does, for its page: its pace, its share of a land's dealings, and what that changes. */
export function principleSignalStats(world: World, id: string): Stat[] {
  if (!SIGNAL_STEPS.includes(id)) return [];
  const p = principle(id),
    medium = populationContext(world).medium,
    way = WORD_WAYS.find((w) => w.by.length && w.by.every((any) => any.includes(id))),
    adds = p.effects.signal ?? 0,
    rows: Stat[] = [];
  if (way)
    rows.push(
      stat(
        "What it does",
        `a word over 1,000 km in ${delayWords(1000 / way.kmADay)}, by ${wayName(way, medium)}`,
      ),
    );
  else if (id === "computing" || id === "solid-state")
    rows.push(stat("What it does", "reckons and switches the word on, at the exchange and beyond"));
  else if (id === "hand-sets" || id === "pocket-machines")
    rows.push(stat("What it does", "carries the word with whoever holds it"));
  if (adds > 0)
    rows.push(
      stat(
        "What it changes",
        `puts ${share(adds)} more of a land's dealings on the line: its markets' prices come nearer, its hosts keep in step with their seat, ${share(SIGNAL.infoWork * adds)} more of its crafters and traders work at information`,
      ),
    );
  return rows;
}

/** How much of its world its people know, and by what. */
export function knownStat(world: World): Stat {
  const k = knownWorld(world);
  const by: Readonly<Record<string, string>> = {
    feet: "about their own lands",
    ships: "by their ships",
    wings: "from the air",
    rocket: "from a rocket's height",
    orbit: "from orbit: all of it",
  };
  return stat("Of its world known", `${share(k.share)}, ${by[k.by] ?? k.by}`, {
    why: prinRef(k.by === "orbit" ? "orbital-flight" : k.by === "rocket" ? "rocketry" : "sailing"),
  });
}
