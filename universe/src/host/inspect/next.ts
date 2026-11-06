// What's next (A1, classic 160): the age a world would come to next, what it has of what that asks and what it
// still wants, in plain words. Whether and why are F5's (rules/can.ts): the same reading as What can be done
// here, so the two can't disagree. A world that never will says so and why, and what else could come instead.
import type { World } from "../../kernel/index.ts";
import {
  asLandsStand,
  causeOf,
  firstWanted,
  stepName,
  stopWords,
  whyShut,
  type CanWorld,
} from "../../rules/index.ts";
import type { Block, Item, Line, Span } from "../../bridge/index.ts";
import { lifelessWhy } from "../kinds.ts";
import { lacksNow } from "../reading.ts";
import { hereOf } from "./can.ts";
import { stageOf } from "./stage.ts";
import { link, sentence } from "./words.ts";

const prinRef = (id: string) => `prin:${id}`;
const low = (s: string) => `${s[0]!.toLowerCase()}${s.slice(1)}`;

/** Names as words, the last with "and". */
function andList(spans: readonly Span[]): Span[] {
  return spans.flatMap((s, i) => [...(i ? [i === spans.length - 1 ? " and " : ", "] : []), s]);
}

/** A step's name, as a link to its page. */
const stepLink = (id: string, w: CanWorld) => link(stepName(id, w), prinRef(id));

/** What could still come, whatever the ladder of ages says: the next rung of each function open to them. */
function stillOpen(read: ReturnType<typeof hereOf>["read"], w: CanWorld): Span[] {
  const ids: string[] = [];
  for (const f of read) if (f.main && f.next?.by && !ids.includes(f.next.by)) ids.push(f.next.by);
  return andList(ids.slice(0, 3).map((id) => stepLink(id, w)));
}

/** What's next in a few words, for under a page's title: its first line's first sentence. */
export function nextWords(block: Block): Line {
  const first = block.type === "list" ? block.items[0]?.line[0] : undefined,
    words = typeof first === "string" ? first : (first?.text ?? "");
  return words ? [words.replace(/^(.*?[.:])\s.*$/, "$1")] : [];
}

/** The world's next age and what stands between it and that age, from what it holds now. */
export function nextBlock(world: World): Block {
  const here = hereOf(world),
    { g, w, open, known, read, peopled } = here,
    title = "What's next";
  // No one here at all, or no one left.
  if (!g.life.people)
    return {
      type: "list",
      title,
      items: [
        {
          tone: "shut",
          line: [
            `Nothing, by its own hand: ${g.life.species.length ? "life arose here, and no people rose from it" : lifelessWhy(g)}.`,
          ],
        },
      ],
    };
  if (!peopled.length)
    return {
      type: "list",
      title,
      items: [
        {
          tone: "shut",
          line: [
            "Nothing, unless someone comes: no one is left on it. What its people knew lies with them.",
          ],
        },
      ],
    };
  const lacks = lacksNow(world),
    stage = stageOf(world),
    knows = (id: string) => !!known.get(id)?.now,
    instead = stillOpen(read, w);
  // The top of the ladder.
  if (!lacks)
    return {
      type: "list",
      title,
      items: [
        {
          tone: "have",
          line: [
            "No age yet told lies past this one.",
            ...(instead.length ? [" What could still come: ", ...instead, "."] : []),
          ],
        },
      ],
    };
  const name = stage.stages.find((s) => s.id === lacks.age.id)?.name ?? lacks.age.name,
    met = lacks.age.asks.filter((a) => !lacks.lacks.some((l) => l.words === a.words)),
    items: Item[] = [],
    shut: Line[] = [],
    wants: Item[] = [];
  for (const lack of lacks.lacks) {
    const ask = lacks.age.asks.find((a) => a.words === lack.words),
      road = ask?.road ?? [],
      // (The way F5 reads as open: the one its people know, else the first they could come to.)
      way = road.find((id) => known.has(id)) ?? road.find((id) => open.has(id)) ?? road[0] ?? null;
    if (way && !open.has(way)) {
      const stop = whyShut(way, w, open)!,
        words = stopWords(stop, w),
        lands = asLandsStand(causeOf(stop, w));
      shut.push([
        lands ? "Not as its lands stand: " : "It never will: ",
        lands ? low(words) : low(words),
      ]);
      continue;
    }
    const line: Span[] = [`Still to come: ${lack.words}. It has ${lack.has}.`];
    let ref: string | null = null;
    if (way) {
      ref = prinRef(way);
      if (knows(way)) {
        line.push(" They know ", stepLink(way, w), ".");
        if (lack.wanting) line.push(` ${lack.wanting}`);
      } else {
        const first = firstWanted(way, w, open, knows).filter((id) => id !== way);
        line.push(" The way is ", stepLink(way, w));
        if (first.length)
          line.push(", and first ", ...andList(first.slice(0, 3).map((id) => stepLink(id, w))));
        line.push(".");
      }
    }
    wants.push({ tone: "open", line, ...(ref ? { ref } : {}) });
  }
  items.push({
    tone: shut.length ? "shut" : "open",
    line: [
      `${lacks.age.icon} Next: ${sentence(name)}.`,
      ...(met.length ? [` They have ${met.map((a) => a.words).join(", and ")}.`] : []),
    ],
  });
  for (const line of shut) items.push({ tone: "shut", line });
  items.push(...wants);
  // Where the way on is shut: what else could come.
  if (shut.length && instead.length)
    items.push({ tone: "open", line: ["What could come instead: ", ...instead, "."] });
  return { type: "list", title, items };
}
