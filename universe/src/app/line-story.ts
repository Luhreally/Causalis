// Live a Line's civilization (S7, 2026-11-28): the line's story as six pages, walked with Back and Forward as every page of
// the mode is (ui/line-pages.ts): its cell, its body, its band, then what came of the band's land in the world: its first
// village, its market town, the realm that holds it (host/line-story.ts). A step not reached yet says so, and what brings
// it, never a stand-in. The village, town and realm each lead into the god game's own page, where living as one of them,
// ruling them and their courts already are.
import type { LineStars, LineStory } from "../host/line-story.ts";
import { el } from "../ui/index.ts";
import { fact, para, type LinePage } from "../ui/line-pages.ts";

export type StoryOf = {
  /** The cell: its generations, the way it came to, when it began (My ago). */
  readonly cell: { readonly gens: number; readonly way: string; readonly my: number } | null;
  /** The bodies it lived in, the founder first. */
  readonly bodies: readonly {
    readonly name: string;
    readonly way: string;
    readonly mass: string;
    readonly my: number;
  }[];
  /** The band led: its people's name, its land, how many it is and was born to it, the grain seen, the land taught. */
  readonly band: {
    readonly people: string;
    readonly land: string;
    readonly size: number;
    readonly born: number;
    readonly sprouted: boolean;
    readonly taught: boolean;
  } | null;
  /** What came of its land in the world (null: no band led, or not asked yet). */
  readonly world: LineStory | null;
  /** The realm holding its land at the stars (S8; null: no band led, or not asked yet). */
  readonly stars: LineStars | null;
};

export const STORY = [
  "story:cell",
  "story:body",
  "story:band",
  "story:village",
  "story:town",
  "story:realm",
  "story:stars",
] as const;
const NAMES: Readonly<Record<(typeof STORY)[number], string>> = {
  "story:cell": "Its cell",
  "story:body": "Its body",
  "story:band": "Its band",
  "story:village": "Its village",
  "story:town": "Its town",
  "story:realm": "Its realm",
  "story:stars": "Its stars",
};

const myWords = (my: number) =>
  my >= 1000
    ? `${(my / 1000).toFixed(2)} billion years ago`
    : `${Math.round(my)} million years ago`;

/**
 * A page of the line's story. `link` makes a link to another of the mode's pages; `go` a button that leaves the mode for
 * the god game's own page of a thing of the world.
 */
export function storyPage(
  ref: string,
  s: StoryOf,
  link: (text: string, ref: string) => HTMLElement,
  go: (text: string, ref: string) => HTMLElement,
  /** A button asking the realm's next ship to sail for a star (null: the ask taken back). */
  send: (text: string, realm: string, star: string | null) => HTMLElement,
): LinePage | null {
  const i = STORY.indexOf(ref as (typeof STORY)[number]);
  if (i < 0) return null;
  // (On along the story, and back: each page names its neighbours.)
  const nav = el("p", "line-story-nav");
  if (i > 0) nav.append(link(`‹ ${NAMES[STORY[i - 1]!]}`, STORY[i - 1]!));
  if (i < STORY.length - 1) nav.append(link(`${NAMES[STORY[i + 1]!]} ›`, STORY[i + 1]!));
  const w = s.world,
    page = (title: string, parts: HTMLElement[]): LinePage => ({
      title: `Your line's story: ${title}`,
      help: "help:story",
      parts: [...parts, nav],
    });
  switch (ref) {
    case "story:cell":
      return page(
        "its cell",
        s.cell
          ? [
              fact("Began", `as one of your world's first cells, ${myWords(s.cell.my)}`),
              fact("Lived", `${s.cell.gens + 1} generations, each a daughter you chose`),
              fact("Came to", s.cell.way),
            ]
          : [
              para(
                "Your line was not lived as a cell: begin as a cell to live it from your world's first seas.",
              ),
            ],
      );
    case "story:body":
      return page(
        "its body",
        s.bodies.length
          ? s.bodies.map((b, k) =>
              fact(
                k ? `Then, ${myWords(b.my)}` : `Founded, ${myWords(b.my)}`,
                `${b.name}: ${b.mass}, a ${b.way}`,
              ),
            )
          : [
              para(
                "Your line has not founded a body yet: its cells must live together as one first.",
              ),
            ],
      );
    case "story:band":
      return page(
        "its band",
        s.band
          ? [
              fact(
                "Led",
                `a band of the ${s.band.people}, camped in ${s.band.land.replace(/^The /, "the ")}`,
              ),
              fact(
                "Now",
                `${s.band.size} in the band, ${s.band.born ? `${s.band.born} born under your hand` : "none born under your hand yet"}`,
              ),
              fact(
                "Sowing",
                s.band.taught
                  ? "seen come up where they dropped seed, and taught to their land"
                  : s.band.sprouted
                    ? "seen come up where they dropped seed; not taught yet"
                    : "not seen yet",
              ),
            ]
          : [
              para(
                "You have not led a band of your world's people yet. ⛺ Lead a band, from the start of a line.",
              ),
            ],
      );
    case "story:village":
      return page(
        "its village",
        w?.village
          ? [
              fact("Founded", `${w.village.name}, in the year ${w.village.founded}`),
              fact("People", `${w.village.people.toLocaleString()}`),
              go(`🏘️ Go and see ${w.village.name}`, w.village.ref),
            ]
          : [
              para(
                !w
                  ? "Lead a band first: its land's first village is what comes of it."
                  : w.sows
                    ? `Its land sows, and its first village comes in its turn: ${w.waiting.toLocaleString()} lands that sow wait for their first village the world over. Wake and let the years run.`
                    : "Its land does not sow yet. Lead its band to see wild grain come up, and teach the land to sow.",
              ),
            ],
      );
    case "story:town":
      return page(
        "its town",
        w?.town
          ? [
              fact("Its market town", w.town.name),
              fact("People", `${w.town.people.toLocaleString()}`),
              go(`🏙️ Go and see ${w.town.name}`, w.town.ref),
            ]
          : [
              para(
                w?.village
                  ? "No market town yet: a land's best-placed village becomes one once it has two villages and enough of its people at crafts and trade."
                  : "First its village.",
              ),
            ],
      );
    case "story:realm":
      return page(
        "its realm",
        w?.realm
          ? [
              fact("Held by", w.realm.name),
              fact("Since", `the year ${w.realm.founded}, ${w.realm.lands} lands now`),
              go(`👑 Go and see ${w.realm.name}`, w.realm.ref),
            ]
          : [
              para(
                w?.town
                  ? "No realm holds its land yet: one rises where a town's leaders come to rule the lands about."
                  : "First its town.",
              ),
            ],
      );
    case "story:stars": {
      const st = s.stars;
      if (!st?.realm)
        return page("its stars", [
          para(
            w?.realm
              ? "Its realm is not at the stars yet."
              : "First its realm: a realm sends ships to the stars, when it can.",
          ),
        ]);
      const r = st.realm,
        parts: HTMLElement[] = [];
      if (st.wants.length)
        parts.push(fact("Not at the stars yet", `${r.name} lacks ${st.wants.join("; ")}`));
      if (st.asked)
        parts.push(
          fact("Its next ship", `asked to sail for ${st.asked.words}, when the realm can send one`),
          send("Take the ask back", r.ref, null),
        );
      for (const sh of st.ships)
        parts.push(
          fact(
            sh.arrived ? "Come down" : `Under way, arriving in the year ${sh.arrives}`,
            sh.words,
          ),
          go("🚀 Go and see the ship", sh.land),
        );
      if (st.stars.length) {
        parts.push(
          para(
            "The stars in its reach with a world its people could live on, nearest in time first. Ask, and its next ship sails for the one you choose, if it is still free when the realm can send one.",
          ),
        );
        for (const x of st.stars)
          parts.push(
            fact(
              x.words,
              `${x.years.toLocaleString()} years under way · ${x.upkeep} machines a settler a year to keep${x.taken ? " · taken" : ""}`,
            ),
            ...(x.taken || st.asked?.ref === x.ref
              ? []
              : [send("🚀 Send our next ship here", r.ref, x.ref)]),
          );
      } else if (!st.wants.length)
        parts.push(para("No star in its reach holds a world its people could live on."));
      return page(`its stars, ${r.name}`, parts);
    }
  }
  return null;
}
