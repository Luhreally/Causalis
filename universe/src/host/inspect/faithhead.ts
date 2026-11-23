// A faith's head on its page, and the realms that press it (sim/belief/heads.ts): who heads it, how the faith finds its head, since
// when and how many it has had, and each realm whose ruler contests it, names its priests, or was cast out, with why. Level: a
// named person (the head, a notable), and a record a realm. Pure reads.
import type { World } from "../../kernel/index.ts";
import type { Block, Item } from "../../bridge/index.ts";
import { FAITH_FORMS } from "../../rules/index.ts";
import { CLASH_STATES, CLASH_WHAT, faithHeadsOf, notablesOf, type Faith } from "../../sim/index.ts";
import { CLASH_WHAT_WORDS, FAITH_FORM_WORDS } from "../../causal/index.ts";
import { item, link, stat, yearNow } from "./words.ts";
import { realmLink } from "./names.ts";

const STATE_WORDS: Readonly<Record<string, string>> = {
  contested: "its ruler presses it over",
  invested: "its seat has taken from it",
  cast: "its ruler is cast out of the faith, over",
};

/** The head of a faith and its quarrels with rulers, as blocks for its page (none where no head is kept). */
export function faithHeadBlocks(world: World, f: Faith): Block[] {
  const rec = faithHeadsOf(world)?.get(f.ref);
  if (!rec) return [];
  const kept = notablesOf(world),
    n = rec.id ? kept?.get(rec.id) : undefined,
    gone = !n && rec.id ? kept?.goneOf(rec.id) : undefined,
    form = FAITH_FORMS[rec.form] ?? "chosen",
    year = yearNow(world),
    who = n ?? gone,
    out: Block[] = [
      {
        type: "facts",
        title: "Its head",
        rows: [
          stat(
            "Head",
            who
              ? [
                  link(who.name, `note:named:${who.id}`),
                  n ? `, ${year - n.born}` : ", now dead: another is not yet raised",
                ]
              : "none raised yet",
            { why: rec.event },
          ),
          stat("Since", `year ${rec.since}`),
          stat("Heads it has had", String(rec.heads)),
          stat("How it finds its head", FAITH_FORM_WORDS[form] ?? form),
          ...(rec.family ? [stat("Its line", `the ${rec.family}`)] : []),
        ],
      },
    ];
  const concords: Item[] = rec.clashes
    .filter((c) => c.state === 0)
    .map((c) =>
      item(
        [
          realmLink(world, c.realm),
          `: at one with its head by a concord since year ${c.since}, after a quarrel opened in year ${c.opened}`,
        ],
        c.event,
        c.since,
      ),
    );
  // (The longest quarrels first; the rest counted.)
  const against = rec.clashes
      .filter((c) => c.state !== 0)
      .sort((a, b) => a.since - b.since || (a.realm < b.realm ? -1 : 1)),
    items: Item[] = against.slice(0, AGAINST_NAMED).map((c) => {
      const state = CLASH_STATES[c.state] ?? "",
        what = CLASH_WHAT_WORDS[CLASH_WHAT[c.what] ?? ""] ?? "what it holds there";
      return item(
        [
          realmLink(world, c.realm),
          `: ${STATE_WORDS[state] ?? "presses it over"} ${state === "invested" ? "the naming of its priests" : what}, since year ${c.since}; ${keepWords(c.share)}`,
        ],
        c.event,
        c.since,
      );
    });
  if (items.length)
    out.push({
      type: "list",
      title: "Rulers against it",
      items,
      ...(against.length > AGAINST_NAMED ? { more: against.length - AGAINST_NAMED } : {}),
    });
  if (concords.length) out.push({ type: "list", title: "Concords with rulers", items: concords });
  return out;
}

const AGAINST_NAMED = 12;

/** How many of a realm's people keep the faith (`share` in a thousand), in words. */
function keepWords(share: number): string {
  if (share >= 995) return "all its people keep the faith";
  return `${Math.max(1, Math.round(share / 10))} in a hundred of its people keep the faith`;
}
