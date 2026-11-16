// Who reads in a land, and why (rules/letters.ts, sim/lore/letters.ts): its readers now, what its teaching reaches a generation
// on, and what makes that: its script, those whose work wants letters, those its fields spare, a school, how freely word moves,
// its faith. Pure readings, made when a page is read.
import type { World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import { lettersOf, loreOf, populationContext, readersOf, teachingOf } from "../../sim/index.ts";
import { share, stat } from "./words.ts";

/** A land's readers and what makes them, for its People tab (nothing where no one could read yet). */
export function lettersBlock(world: World, cell: number): Block | null {
  if (!lettersOf(world)) return null;
  const ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p?.total()) return null;
  const now = readersOf(world, cell),
    t = teachingOf(ctx, p);
  if (!t.script && !now) return null;
  const script = loreOf(world).get(cell, "writing"),
    rows: Stat[] = [
      stat("Who read", `${share(now)} of them`),
      stat("A generation on", `${share(t.target)}, as they teach now`),
      stat(
        "Their script",
        t.script ? (script ? `since year ${script.year}` : "they write") : "lost: none writes now",
        script ? { why: script.event } : {},
      ),
      stat("Whose work wants letters", share(t.scribes)),
      stat("Spared from the food", share(t.spare)),
      stat("A school", t.school ? "stands in one of their towns" : "none"),
    ];
  if (t.scripture > 0) rows.push(stat("Their faith", "holds its teaching written"));
  return { type: "facts", title: "Reading and writing", rows };
}
