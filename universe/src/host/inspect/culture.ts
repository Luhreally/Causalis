// The pages of what people hold in common (Phase 10 M91): a faith, a tongue, a design (how
// a people builds, what a realm's host fights with, a land's works) and a good in a land's
// market.
import {
  cellRef,
  tongueName,
  tonguePersonName,
  tongueSounds,
  type Tongue,
} from "../../gen/index.ts";
import { DEITIES, beliefOf, designsOf, languagesOf, populationContext } from "../../sim/index.ts";
import { GOODS, GOOD_MATTER, designWords } from "../../rules/index.ts";
import { goodHere, goodRef, howMadeHere, makeUpBlock, weight } from "./matter.ts";
import { goodYearBlocks } from "./stores.ts";
import { parseRef, type Ref, type World } from "../../kernel/index.ts";
import type { Block, PageModel, Place, Row, Tab } from "../../bridge/index.ts";
import { market } from "../planet.ts";
import { realmColor } from "../colors.ts";
import { count, eventsAbout, item, link, many, stat, yearNow } from "./words.ts";
import { faithLink, landLink, landTitle, languageLink, realmLink, spotOfLand } from "./names.ts";
import { landPlace } from "./land.ts";
import { peopleBlocks } from "./peoples.ts";
import { realmPlace } from "./realm.ts";

function globeAt(world: World, cell: number): Place | null {
  const spot = spotOfLand(world, cell);
  return spot === null ? null : { scale: "globe", spot };
}

/** A faith: its god, its founding, its lands and people, what split from it. */
export function faithPage(world: World, ref: string): PageModel {
  const store = beliefOf(world),
    f = store.get(ref as Ref);
  if (!f) throw new Error(`no faith ${ref}`);
  const ctx = populationContext(world),
    lands = store.lands(f.ref),
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    people = lands.reduce((s, c) => s + peopleOf(c), 0),
    offshoots = store.all().filter((x) => x.from === f.ref);
  const rows: Row[] = [...lands]
    .sort((a, b) => peopleOf(b) - peopleOf(a) || a - b)
    .map((c) => ({
      ref: cellRef(0, c),
      cells: [[landLink(world, c)], [count(peopleOf(c))]],
      keys: [landTitle(world, c), peopleOf(c)],
    }));
  const tabs: Tab[] = [
    {
      id: "overview",
      name: "Overview",
      blocks: [
        {
          type: "facts",
          rows: [
            stat("God", DEITIES[f.tenet]),
            stat("Founded", `year ${f.founded}`, { why: f.event }),
            stat("Where it began", [landLink(world, f.seat)]),
            ...(f.from ? [stat("Split from", [faithLink(world, f.from)], { why: f.event })] : []),
          ],
        },
        { type: "why", title: "How it began", ref: f.ref },
      ],
    },
    { id: "lands", name: "Lands", blocks: [{ type: "table", columns: ["Land", "People"], rows }] },
  ];
  if (offshoots.length)
    tabs.push({
      id: "offshoots",
      name: "Offshoots",
      blocks: [
        {
          type: "list",
          items: offshoots.map((o) =>
            item([faithLink(world, o.ref), ` — split in year ${o.founded}`], o.ref),
          ),
        },
      ],
    });
  const history = eventsAbout(world, [f.ref], 30);
  if (history.length)
    tabs.push({ id: "history", name: "History", blocks: [{ type: "list", items: history }] });
  return {
    ref: f.ref,
    kind: "faith",
    icon: "✨",
    portrait: { kind: "sign", color: realmColor(`${f.ref}:faith`), tenet: f.tenet },
    title: f.name,
    subtitle: [`A faith of ${DEITIES[f.tenet]}`],
    color: realmColor(`${f.ref}:faith`),
    place: globeAt(world, f.seat),
    stats: [
      stat("Lands", count(lands.length)),
      stat("Believers", count(people)),
      stat("Founded", `year ${f.founded}`, { why: f.event }),
    ],
    tabs,
    followable: false,
    year: yearNow(world),
  };
}

/** A tongue: its family, where it is spoken and by how many, what grew from it. */
/** A tongue heard: its sounds, words in it, how it names people and places, what it changed. */
function speechBlocks(
  l: { name: string; standard: Tongue; born: number },
  parent: { name: string; standard: Tongue } | null,
): Block[] {
  const sounds = tongueSounds(l.standard),
    said = (xs: readonly string[]) => (xs.length ? xs.join(" · ") : "—"),
    blocks: Block[] = [
      {
        type: "facts",
        title: "Its sounds",
        rows: [
          stat("Syllables begin", said(sounds.onsets)),
          stat("Its vowels", said(sounds.vowels)),
          stat("Syllables close", said(sounds.codas)),
          stat("Its places end", said(sounds.endings)),
        ],
      },
      {
        type: "facts",
        title: "Words in it",
        rows: [
          stat(
            "Places",
            [0, 1, 2, 3, 4].map((k) => tongueName(l.standard, l.born * 31 + k)).join(", "),
          ),
          stat(
            "Women",
            [0, 1, 2, 3].map((k) => tonguePersonName(l.standard, l.born * 17 + k, 0)).join(", "),
          ),
          stat(
            "Men",
            [0, 1, 2, 3].map((k) => tonguePersonName(l.standard, l.born * 17 + k, 1)).join(", "),
          ),
        ],
      },
    ];
  if (parent) {
    const was = tongueSounds(parent.standard),
      change = (a: readonly string[], b: readonly string[]) => ({
        lost: a.filter((x) => !b.includes(x)),
        gained: b.filter((x) => !a.includes(x)),
      }),
      parts = [
        ["beginnings", change(was.onsets, sounds.onsets)],
        ["vowels", change(was.vowels, sounds.vowels)],
        ["closings", change(was.codas, sounds.codas)],
        ["endings", change(was.endings, sounds.endings)],
      ] as const,
      lines = parts
        .filter(([, c]) => c.lost.length || c.gained.length)
        .map(([part, c]) => [
          `Its ${part}: ${[
            ...(c.lost.length ? [`lost ${c.lost.join(", ")}`] : []),
            ...(c.gained.length ? [`gained ${c.gained.join(", ")}`] : []),
          ].join("; ")}`,
        ]);
    blocks.push({
      type: "text",
      title: `What changed from ${parent.name}`,
      lines: lines.length
        ? lines
        : [["Its sounds are its mother tongue's: it drifted in its words."]],
    });
  }
  return blocks;
}

export function languagePage(world: World, ref: string): PageModel {
  const store = languagesOf(world),
    l = store.get(ref as Ref);
  if (!l) throw new Error(`no tongue ${ref}`);
  const ctx = populationContext(world),
    lands = store.speakers().get(l.index) ?? [],
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    people = lands.reduce((s, c) => s + peopleOf(c), 0),
    parent = l.parent === null ? null : store.at(l.parent),
    children = store.all().filter((x) => x.parent === l.index);
  const rows: Row[] = [...lands]
    .sort((a, b) => peopleOf(b) - peopleOf(a) || a - b)
    .map((c) => ({
      ref: cellRef(0, c),
      cells: [[landLink(world, c)], [count(peopleOf(c))]],
      keys: [landTitle(world, c), peopleOf(c)],
    }));
  const tabs: Tab[] = [
    {
      id: "overview",
      name: "Overview",
      blocks: [
        {
          type: "facts",
          rows: [
            stat("Family", store.familyName(l)),
            stat("Arose", `year ${l.born}`, { why: l.event }),
            stat("Its standard", ["the speech of ", landLink(world, l.home)]),
            ...(parent ? [stat("Grew from", [languageLink(world, parent.ref)])] : []),
            ...(l.died !== null ? [stat("Last spoken", `year ${l.died}`)] : []),
          ],
        },
        { type: "why", title: "How it arose", ref: l.ref },
      ],
    },
    // Its people read (Phase 14 M119): the god as they name it, their ways, faiths, realms,
    // numbers; and its speech, to be heard (M117).
    { id: "people", name: "People", blocks: peopleBlocks(world, l) },
    { id: "speech", name: "Speech", blocks: speechBlocks(l, parent) },
    {
      id: "lands",
      name: "Lands",
      blocks: [{ type: "table", columns: ["Land", "Speakers"], rows }],
    },
  ];
  if (children.length)
    tabs.push({
      id: "descendants",
      name: "Descendants",
      blocks: [
        {
          type: "list",
          items: children.map((c) =>
            item([languageLink(world, c.ref), ` — arose in year ${c.born}`], c.ref),
          ),
        },
      ],
    });
  const history = eventsAbout(world, [l.ref], 30);
  if (history.length)
    tabs.push({ id: "history", name: "History", blocks: [{ type: "list", items: history }] });
  return {
    ref: l.ref,
    kind: "language",
    icon: "🗣️",
    title: l.name,
    subtitle: [`A tongue of the ${store.familyName(l)} family`],
    color: null,
    place: globeAt(world, l.home),
    stats: [
      stat("Lands", count(lands.length)),
      stat("Speakers", count(people)),
      stat("Arose", `year ${l.born}`, { why: l.event }),
    ],
    tabs,
    followable: false,
    year: yearNow(world),
  };
}

const DESIGN_KIND = {
  house: "How a people builds",
  host: "What a realm's host fights with",
  works: "A land's works",
} as const;

/** A design: what it is made of, whose it is, and when it was realized. */
export function designPage(world: World, ref: string): PageModel {
  const d = designsOf(world).get(ref as Ref);
  if (!d) throw new Error(`no design ${ref}`);
  const ownerKind = d.owner.slice(0, d.owner.indexOf(":")),
    ownerCell = ownerKind === "folk" || ownerKind === "cell" ? parseRef(d.owner).b : null,
    owner =
      ownerCell !== null
        ? landLink(world, ownerCell)
        : ownerKind === "pol"
          ? realmLink(world, d.owner)
          : d.owner;
  return {
    ref: d.ref,
    kind: "design",
    icon: d.kind === "host" ? "🛡️" : d.kind === "works" ? "🏭" : "📐",
    title: designWords(d.parts),
    subtitle: [DESIGN_KIND[d.kind], " — ", owner],
    color: null,
    place:
      ownerCell !== null
        ? landPlace(world, ownerCell)
        : ownerKind === "pol"
          ? realmPlace(world, d.owner)
          : null,
    stats: [
      stat("Since", `year ${d.since}`, { why: d.event }),
      stat("Parts", count(d.parts.length)),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "list",
            title: "What it is made of",
            items: d.parts.map((p) => item(designWords([p]))),
          },
          { type: "why", title: "How it was come to", ref: d.ref },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** A good in a land's market (`mkt:cell:good`): its price and why, its stock, what is made and used. */
export function goodPage(world: World, ref: string): PageModel {
  const { a: cell, b: index } = parseRef(ref as Ref),
    m = market(world, cell),
    g = m?.goods.find((x) => x.ref === ref);
  if (!m || !g) throw new Error(`no market good ${ref}`);
  const kind = GOODS[index]!,
    here = goodHere(world, cell, kind.id);
  return {
    ref,
    kind: "good",
    icon: "📦",
    title: `${g.name[0]!.toUpperCase()}${g.name.slice(1)} at ${m.town ? m.town.name : landTitle(world, cell)}`,
    subtitle: ["In the market of ", landLink(world, cell)],
    color: null,
    place: landPlace(world, cell),
    stats: [
      stat("Price", g.words, { why: ref }),
      stat("Stock", count(g.stock)),
      stat("Made", count(g.made)),
      stat("Used", count(g.used)),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Price", `${g.words} (${g.ratio.toFixed(2)} of its worth)`, { why: ref }),
              stat("Stock", count(g.stock)),
              stat("Made this year", count(g.made)),
              stat("Used this year", count(g.used)),
              stat("Brought in", count(g.into)),
              stat("Sent out", count(g.out)),
              ...(m.town ? [stat("Market town", [link(m.town.name, m.town.ref)])] : []),
            ],
          },
          { type: "why", title: "Why its price is what it is", ref },
        ],
      },
      // Its year: what it began with, each line in and out, what it ended with (Phase 15 M123).
      { id: "year", name: "Its year", blocks: goodYearBlocks(world, cell, index) },
      // What it is made of here, and how it is made here — or why not (Phase 15 M122).
      {
        id: "matter",
        name: "What it is",
        blocks: [
          makeUpBlock(
            here.parts,
            g.stock * GOOD_MATTER[kind.id]!.unitKg,
            `What it is made of here: ${here.name}`,
            `A unit weighs ${weight(GOOD_MATTER[kind.id]!.unitKg)}; the stock, ${weight(g.stock * GOOD_MATTER[kind.id]!.unitKg)}.`,
          ),
          { type: "list", title: "How it is made here", items: howMadeHere(world, cell, kind.id) },
          {
            type: "text",
            lines: [["The good the world over: ", link(kind.name, goodRef(kind.id))]],
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

export { many };
