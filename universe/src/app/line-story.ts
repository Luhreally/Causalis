// Live a Line's civilization (S7, 2026-11-28): the line's story as six pages, walked with Back and Forward as every page of
// the mode is (ui/line-pages.ts): its cell, its body, its band, then what came of the band's land in the world: its first
// village, its market town, the realm that holds it (host/line-story.ts). A step not reached yet says so, and what brings
// it, never a stand-in. The village, town and realm each lead into the god game's own page, where living as one of them,
// ruling them and their courts already are.
import type { LineStars, LineStory } from "../host/line-story.ts";
import type { Council } from "./line-realm.ts";
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
  /** Its realm's council this year (C1; null: no realm, or not asked yet). */
  readonly council: Council | null;
  /** This year's word, if given; what last year came to, in words. */
  readonly year: { readonly said: string | null; readonly last: readonly string[] };
};

export const STORY = [
  "story:cell",
  "story:body",
  "story:band",
  "story:village",
  "story:town",
  "story:realm",
  "story:year",
  "story:stars",
] as const;
const NAMES: Readonly<Record<(typeof STORY)[number], string>> = {
  "story:cell": "Its cell",
  "story:body": "Its body",
  "story:band": "Its band",
  "story:village": "Its village",
  "story:town": "Its town",
  "story:realm": "Its realm",
  "story:year": "Its year",
  "story:stars": "Its stars",
};

/** Words that open with a capital put mid-sentence ("A red dwarf" → "a red dwarf"). */
const mid = (words: string) => words.replace(/^(A|An|The) /, (w) => w.toLowerCase());

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
  /** A button of the realm's year (C1): one of its council's choices by its place, or the year let pass. */
  rule: (text: string, choice: number | "pass", can: boolean) => HTMLElement,
  /** Its stars played: the map, the star picked on it, and the years let pass until a ship sails or comes down. */
  space: {
    readonly map: (st: LineStars) => HTMLElement;
    readonly picked: string | null;
    readonly landing: (st: LineStars, star: string) => HTMLElement | null;
    readonly run: (text: string) => HTMLElement;
    /** Aboard a ship under way (app/line-ride.ts). */
    readonly ride: (text: string, land: string) => HTMLElement;
  },
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
      return page("its village", [
        ...(w?.from === "cradle"
          ? [
              para(
                "No band was led, so the story follows your world's people from the land they rose in.",
              ),
            ]
          : []),
        ...(w?.village
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
                    ? `Its land sows, and its first village comes in its turn: ${w.waiting <= 1 ? "it is the one land in the world that sows and waits for its first village" : `${w.waiting.toLocaleString()} lands that sow wait for their first village the world over`}. Wake and let the years run.`
                    : "Its land does not sow yet. Lead its band to see wild grain come up, and teach the land to sow.",
              ),
            ]),
      ]);
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
    case "story:year": {
      const c = s.council;
      if (!w?.realm || !c)
        return page("its year", [
          para(
            w?.realm
              ? `${w.realm.name} has no one to rule it now: its year comes when it has a ruler again.`
              : "First its realm: once a realm holds your line's land, you rule its years.",
          ),
        ]);
      const t = c.tally,
        parts: HTMLElement[] = [
          fact("Ruled by", `${c.ruler}, ${c.title}`),
          fact(
            "Its people",
            `${t.people.toLocaleString("en")} in ${t.lands} ${t.lands === 1 ? "land" : "lands"}`,
          ),
          fact("Its place", `${t.rank} of the ${t.of} realms it meets`),
          fact("Its host", `${t.host.toLocaleString("en")} under arms`),
          fact(
            "Its ruler's standing",
            `${Math.round(t.standing * 100)} in a hundred; its lands' unrest ${Math.round(t.unrest * 100)} in a hundred`,
          ),
        ];
      if (s.year.last.length) parts.push(fact("Last year", s.year.last.join("; ")));
      parts.push(
        para(
          s.year.said
            ? `This year's word is given: ${s.year.said}. Let the year pass to see what it comes to.`
            : "One word a year: choose what your realm does, then let the year pass. Each costs what it says.",
        ),
      );
      c.choices.forEach((ch, i) => {
        // (Each a block of its own: what it is, what it would cost or why not, and its key.)
        const box = el("div", ch.can ? "line-council" : "line-council cannot");
        box.append(
          el("div", "line-council-what", `${ch.icon} ${ch.label}`),
          el("div", "line-council-cost", ch.words),
          rule(ch.can ? "Do it" : "It cannot be done now", i, ch.can && !s.year.said),
        );
        parts.push(box);
      });
      parts.push(rule("⏭ Let a year pass", "pass", true));
      return page("its year", parts);
    }
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
      // (First, the stage's own key where there is a ship to wait for: the years let pass in the mode, until the
      // ship asked for sails, or until one under way comes down.)
      const under = st.ships.filter((x) => !x.arrived);
      if (under.length) parts.push(space.ride("🚀 Ride aboard your ship", under[0]!.land));
      else if (st.asked && !st.asked.taken && !st.wants.length)
        parts.push(space.run("⏭ Let the years pass until it sails"));
      // (The map, once there is anything at the stars to draw: press a star to pick it.)
      if (st.stars.length || st.ships.length) {
        parts.push(space.map(st));
        const picked = space.picked ? st.stars.find((x) => x.ref === space.picked) : undefined;
        if (picked) {
          const shown = space.landing(st, picked.ref);
          if (shown) parts.push(shown);
          parts.push(
            fact(
              "Picked",
              `${picked.words}: ${picked.years.toLocaleString()} years under way${picked.lands ? `; a ship comes down on ${picked.lands.words}` : ""}${picked.taken ? " · taken" : ""}`,
            ),
            ...(picked.taken || st.asked?.ref === picked.ref
              ? []
              : [send("🚀 Send our next ship here", r.ref, picked.ref)]),
          );
        } else
          parts.push(para("Press a star on the map to pick it, or choose from the list below."));
      }
      if (st.asked)
        parts.push(
          fact(
            "Its next ship",
            st.asked.taken
              ? `asked to sail for ${mid(st.asked.words)}, but another took it first: it sails where the realm chooses. Ask for another star`
              : `asked to sail for ${mid(st.asked.words)}, when the realm can send one`,
          ),
          send("Take the ask back", r.ref, null),
        );
      for (const sh of st.ships)
        parts.push(
          fact(
            sh.arrived ? "Come down" : `Under way, arriving in the year ${sh.arrives}`,
            `${sh.words}${sh.asked ? ", the star you asked it to sail for" : ""}`,
          ),
          go(sh.arrived ? "🏙️ Go and see the colony" : "🚀 Go and see the ship", sh.land),
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
              `${x.years.toLocaleString()} years under way · ${x.upkeep} machines a settler a year to keep${x.lands ? ` · comes down on ${x.lands.words}` : ""}${x.taken ? " · taken" : ""}`,
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
