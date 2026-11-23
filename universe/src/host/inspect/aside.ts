// A land's ground set aside (conservation; rules/lessons.ts kept-woods, kept-wild): how much its people keep from their own
// use now, what it costs them in food forgone, how its woods and game stand, since when, whether hunger is breaking it, and
// what has come of it (sim/ecology/ecology.ts keptTurns). A section of the land's Life tab. Pure reading.
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Item, Stat } from "../../bridge/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  ECOLOGY_EVENTS,
  ecologyOf,
  lessonsOf,
  populationContext,
  pressIn,
  provinceCapacity,
} from "../../sim/index.ts";
import { claimUnder, count, item, link, part, share, stat, yearAt, yearNow } from "./words.ts";

const TOLD: ReadonlySet<string> = new Set([
  ECOLOGY_EVENTS.keptBack.type,
  ECOLOGY_EVENTS.keptBroken.type,
]);

/** The land's ground set aside, or null where its people keep none and never have. */
export function asideBlocks(world: World, cell: number): Block[] {
  const w = ecologyOf(world).get(cell),
    ref = cellRef(0, cell) as Ref,
    h = lessonsOf(world)?.get(ref),
    woodsUse = h?.uses.get("kept-woods"),
    wildUse = h?.uses.get("kept-wild");
  if (!w || (!woodsUse && !wildUse)) return [];
  const ctx = populationContext(world),
    year = yearNow(world),
    c = ctx.provinces.get(cell) ? provinceCapacity(ctx, cell) : null,
    woods = w.asideWoods ?? 0,
    wild = w.asideWild ?? 0,
    hunger = h ? pressIn(h, "famine", year) : 0,
    rows: Stat[] = [];
  if (woodsUse)
    rows.push(
      stat(
        "Woods kept from the axe",
        woods > 0 ? `${share(woods)} of its farming ground` : "none now",
        {
          ...(woodsUse.ref ? { why: woodsUse.ref } : {}),
          parts: [
            part("kept since", `year ${woodsUse.taken}`),
            part("its woods stand at", share(w.forest)),
            ...(c && woods > 0
              ? [
                  part(
                    "what it forgoes",
                    `the harvest of some ${count(c.farm * woods)} people a year`,
                  ),
                ]
              : []),
          ],
        },
      ),
    );
  if (wildUse)
    rows.push(
      stat(
        "Hunting grounds closed",
        wild > 0 ? `${share(wild)} of what its wild yields` : "none now",
        {
          ...(wildUse.ref ? { why: wildUse.ref } : {}),
          parts: [
            part("closed since", `year ${wildUse.taken}`),
            part("its game stands at", share(w.wild)),
            ...(c && wild > 0
              ? [
                  part(
                    "what it forgoes",
                    `the wild food of some ${count(c.forage * w.wild * wild)} people a year`,
                  ),
                ]
              : []),
          ],
        },
      ),
    );
  if (hunger > 0.02)
    rows.push(
      stat(
        "Hunger",
        `breaks it: of what they would keep, ${share(Math.min(1, hunger))} is taken back to be cleared and hunted`,
      ),
    );
  const blocks: Block[] = [{ type: "facts", title: "Ground set aside", rows }];
  // (What has come of it: its woods or game back, or hunger breaking it, the latest first.)
  const all = world.events.all(),
    since = Math.min(woodsUse?.taken ?? year, wildUse?.taken ?? year),
    told: Item[] = [];
  for (let i = all.length - 1; i >= 0 && told.length < 6; i--) {
    const e = all[i]!,
      y = yearAt(e.t);
    if (y < since) break;
    if (!TOLD.has(e.type) || e.place !== ref) continue;
    told.push(item([`Year ${y}: `, link(claimUnder(world, e.id, y), e.id)], e.id, y));
  }
  if (told.length) blocks.push({ type: "list", title: "What has come of it", items: told });
  return blocks;
}
