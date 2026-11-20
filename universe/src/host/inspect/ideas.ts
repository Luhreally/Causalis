// Things of the mind as pages (sim/ideas): a school of thought (what it teaches, who founded it and for whom, the lands that hold
// it, the realms it draws, what broke from it), the world's schools side by side, and what a land and a realm are taught.
import { cellRef } from "../../gen/index.ts";
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, PageModel, Place, Row, Stat, Tab } from "../../bridge/index.ts";
import { HOLD_KINDS, IDEA_ASKS, IDEA_PARTS, holdWords } from "../../rules/index.ts";
import {
  beliefOf,
  homePlanet,
  notablesOf,
  pilgrimsOf,
  politiesOf,
  populationContext,
  realmName,
  schoolId,
  schoolOver,
  schoolRef,
  schoolStands,
  schoolsOf,
  type Polity,
  type School,
} from "../../sim/index.ts";
import { schoolAsks } from "../../causal/index.ts";
import { realmColor } from "../colors.ts";
import { count, eventsAbout, item, link, many, sentence, share, stat, yearNow } from "./words.ts";
import { landLink, landTitle, realmLink, spotOfLand } from "./names.ts";
import { namedRef } from "./notables.ts";

const spanOf = (world: World): number => homePlanet(world).generated.life.people?.body.span ?? 70;

/** A school as a link (by its id). */
export function schoolLink(world: World, id: number | null | undefined): ReturnType<typeof link> {
  const s = id !== null && id !== undefined ? schoolsOf(world)?.get(id) : undefined;
  return s ? link(s.name, schoolRef(s.id)) : "a school now forgotten";
}

/** Its founder, as a link where the world still keeps them. */
function founderOf(world: World, s: School): ReturnType<typeof link> {
  if (!s.by) return "no one of name";
  const kept = notablesOf(world),
    known = s.founder && (kept?.get(s.founder) ?? kept?.goneOf(s.founder));
  return known ? link(s.by, namedRef(s.founder)) : s.by;
}

const groupWords = (g: string): string => (/^the /.test(g) ? g : `the ${g}`);

/**
 * What a school teaches: each leaning, the end it presses toward and how hard; and, of how a realm is held, where it would
 * have that stand (its voice is for that and no further: where a realm's groups want more, it is for less).
 */
function teachingBlock(world: World, s: School): Block {
  const rows: Stat[] = [],
    body = homePlanet(world).generated.life.people?.body,
    stands = schoolStands(s);
  for (const a of schoolAsks(s, IDEA_PARTS))
    rows.push(
      stat(sentence(a.words), `${Math.abs(a.lean) >= 15 ? "pressed hard" : "asked"}`, {
        parts: [
          {
            label: [`rather than ${IDEA_ASKS[a.part]![a.lean >= 0 ? 0 : 1]}`],
            value: `${Math.abs(a.lean)} in a hundred`,
          },
          ...(a.part < HOLD_KINDS.length
            ? [
                {
                  label: ["It would have a realm held so, and no further"],
                  value: holdWords(HOLD_KINDS[a.part]!, (stands[a.part] ?? 50) / 100, {
                    body,
                    arm: null,
                    far: null,
                  }),
                },
              ]
            : []),
        ],
      }),
    );
  return {
    type: "facts",
    title: "What it teaches",
    rows: rows.length ? rows : [stat("Its teaching", "nothing it presses hard")],
  };
}

/** The realms a school draws: those most of whose lands hold it, and how far. */
function realmsDrawn(world: World, s: School): { realm: Polity; hold: number }[] {
  const store = schoolsOf(world)!,
    polities = politiesOf(world),
    year = yearNow(world),
    span = spanOf(world),
    seen = new Set<string>(),
    out: { realm: Polity; hold: number }[] = [];
  for (const c of store.landList(s.id)) {
    const r = polities.of(c);
    if (!r || r.ended !== null || seen.has(r.ref)) continue;
    seen.add(r.ref);
    const over = schoolOver(world, r.members, r.seat, year, span);
    if (over && over.school.id === s.id) out.push({ realm: r, hold: over.hold });
  }
  return out.sort((a, b) => b.hold - a.hold || (a.realm.ref < b.realm.ref ? -1 : 1));
}

export function schoolPage(world: World, ref: string): PageModel {
  const store = schoolsOf(world),
    s = store?.get(schoolId(ref));
  if (!store || !s) throw new Error(`no school ${ref}`);
  const ctx = populationContext(world),
    lands = store.landList(s.id),
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    people = lands.reduce((n, c) => n + peopleOf(c), 0),
    offshoots = store.all().filter((x) => x.from === s.id),
    drawn = realmsDrawn(world, s),
    spot = spotOfLand(world, s.seat),
    place: Place | null = spot === null ? null : { scale: "globe", spot },
    color = realmColor(`${schoolRef(s.id)}:school`),
    rows: Row[] = [...lands]
      .sort((a, b) => peopleOf(b) - peopleOf(a) || a - b)
      .map((c) => {
        const h = store.of(c)!;
        return {
          ref: cellRef(0, c),
          cells: [
            [landLink(world, c)],
            [count(peopleOf(c))],
            [`year ${count(h.since)}`],
            h.via === c ? ["it began here"] : [landLink(world, h.via)],
          ],
          keys: [
            landTitle(world, c),
            peopleOf(c),
            h.since,
            h.via === c ? "" : landTitle(world, h.via),
          ],
        };
      }),
    tabs: Tab[] = [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Founded", `year ${count(s.founded)}`, { why: s.event }),
              stat("By", [founderOf(world, s)], { why: s.event }),
              stat("Speaks for", [
                groupWords(s.speaks),
                ...(s.realm ? [" of ", realmLink(world, s.realm)] : []),
              ]),
              stat("Where it began", [landLink(world, s.seat)]),
              ...(s.from !== null
                ? [stat("Broke from", [schoolLink(world, s.from)], { why: s.event })]
                : []),
            ],
          },
          teachingBlock(world, s),
          {
            type: "text",
            title: "What holding it does",
            lines: [
              [
                "A realm most of whose lands hold a school is drawn the way it teaches when it weighs how it is held and when it weighs its laws: the more of its lands hold it and the longer they have, the harder. A land takes a school from a neighbour of like speech, sooner by a road, where a body teaches and from a land of higher learning, later where word is watched.",
              ],
            ],
          },
          ...(drawn.length
            ? [
                {
                  type: "table" as const,
                  title: "The realms it draws",
                  columns: ["Realm", "How far it holds there"],
                  rows: drawn.slice(0, 12).map(({ realm, hold }) => ({
                    ref: realm.ref,
                    cells: [[link(realmName(realm), realm.ref)], [share(hold)]],
                    keys: [realmName(realm), hold],
                  })),
                },
              ]
            : []),
          ...(() => {
            const going = pilgrimageBlock(world, schoolRef(s.id));
            return going ? [going] : [];
          })(),
          { type: "why", title: "How it began", ref: schoolRef(s.id) },
        ],
      },
      {
        id: "lands",
        name: "Lands",
        blocks: [
          { type: "table", columns: ["Land", "People", "Since", "Came by"], rows },
          ...(rows.length
            ? []
            : [
                {
                  type: "text" as const,
                  lines: [["No land holds it now: it is remembered, no more."]],
                },
              ]),
        ],
      },
    ];
  if (offshoots.length)
    tabs.push({
      id: "offshoots",
      name: "Offshoots",
      blocks: [
        {
          type: "list",
          items: offshoots.map((o) =>
            item(
              [
                schoolLink(world, o.id),
                `: broke away in year ${o.founded}${o.by ? `, led out by ${o.by}` : ""}`,
              ],
              schoolRef(o.id),
            ),
          ),
        },
      ],
    });
  const history = eventsAbout(world, [schoolRef(s.id)], 30);
  if (history.length)
    tabs.push({ id: "history", name: "History", blocks: [{ type: "list", items: history }] });
  const asks = schoolAsks(s, 2).map((a) => a.words);
  return {
    ref: schoolRef(s.id),
    kind: "school",
    icon: "📜",
    portrait: { kind: "sign", color, tenet: "teaching" },
    title: sentence(s.name),
    subtitle: [
      asks.length
        ? `A school of thought that teaches ${asks.join(" and ")}`
        : "A school of thought",
    ],
    color,
    place,
    stats: [
      stat("Lands", count(lands.length)),
      stat("Those taught", count(people)),
      stat("Founded", `year ${count(s.founded)}`, { why: s.event }),
    ],
    tabs,
    followable: false,
    year: yearNow(world),
  };
}

/** The world's schools side by side (the ledger's Faiths tab, under the faiths). */
export function schoolsLedger(world: World): Block[] {
  const store = schoolsOf(world);
  if (!store || !store.all().length) return [];
  const ctx = populationContext(world),
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    all = store
      .all()
      .map((s) => {
        const lands = store.landList(s.id);
        return { s, lands: lands.length, people: lands.reduce((n, c) => n + peopleOf(c), 0) };
      })
      .sort((a, b) => b.people - a.people || b.lands - a.lands || a.s.id - b.s.id),
    held = all.filter((x) => x.lands > 0),
    gone = all.length - held.length;
  return [
    {
      type: "table",
      title: "Schools of thought",
      columns: ["School", "Teaches", "Lands", "People", "Founded", "By", "Speaks for", "Began in"],
      rows: held.map(({ s, lands, people }) => {
        const asks = schoolAsks(s, 1)[0]?.words ?? "";
        return {
          ref: schoolRef(s.id),
          cells: [
            [link(s.name, schoolRef(s.id))],
            [asks],
            [count(lands)],
            [count(people)],
            [`year ${count(s.founded)}`],
            [founderOf(world, s)],
            [groupWords(s.speaks)],
            [landLink(world, s.seat)],
          ],
          keys: [s.name, asks, lands, people, s.founded, s.by, s.speaks, landTitle(world, s.seat)],
        };
      }),
    },
    ...(gone
      ? [
          {
            type: "text" as const,
            lines: [[`And ${many(gone, "school", "schools")} no land holds now.`]],
          },
        ]
      : []),
  ];
}

/** What a land is taught, as rows for its page (none where it holds no school). */
export function landSchoolRows(world: World, cell: number): Stat[] {
  const store = schoolsOf(world),
    h = store?.of(cell),
    s = h ? store!.get(h.school) : undefined;
  if (!h || !s) return [];
  return [
    stat("School of thought", [link(s.name, schoolRef(s.id))], { why: s.event }),
    stat(
      "Teaches",
      schoolAsks(s, 2)
        .map((a) => a.words)
        .join("; ") || "little it presses",
    ),
    stat(
      "Held since",
      h.via === cell
        ? `year ${count(h.since)}: it began here`
        : [`year ${count(h.since)}, come by `, landLink(world, h.via)],
    ),
  ];
}

/** What a realm is taught: the school most of its lands hold, how far, and what it draws the realm toward (null: none). */
export function realmSchoolBlock(world: World, r: Polity): Block | null {
  const over = schoolOver(world, r.members, r.seat, yearNow(world), spanOf(world));
  if (!over) return null;
  const s = over.school;
  return {
    type: "facts",
    title: "The school its lands hold",
    rows: [
      stat("School of thought", [link(s.name, schoolRef(s.id))], { why: s.event as Ref }),
      stat("How far it holds", share(over.hold), {
        parts: [
          { label: ["the share of its lands that hold it, its seat counted twice"], value: "" },
          { label: ["by how long each has: half in a generation"], value: "" },
        ],
      }),
      stat(
        "Draws it toward",
        schoolAsks(s, 3)
          .map((a) => a.words)
          .join("; ") || "little it presses",
      ),
    ],
  };
}

/**
 * The pilgrimage to where a thing began (a faith's ref, a school's), for its page: how many come a year, from where, and what
 * they leave (null: none comes).
 */
export function pilgrimageBlock(world: World, of: string): Block | null {
  const p = pilgrimsOf(world)?.get(of as Ref);
  if (!p || !p.pilgrims) return null;
  return {
    type: "facts",
    title: "Pilgrimage",
    rows: [
      stat("Pilgrims a year", count(p.pilgrims), {
        why: p.event,
        parts: [
          {
            label: [
              "of those who hold it in each land: more the more devout, half as many for each 1,500 km of the way",
            ],
            value: "",
          },
        ],
      }),
      stat("To", [landLink(world, p.seat)]),
      stat("From", many(p.lands, "land", "lands")),
      stat("Since", `year ${count(p.since)}`, { why: p.event }),
      stat("What they leave", `${(p.feed / 10).toFixed(1)}% of its town's own keep`, {
        parts: [{ label: ["its town draws so much the more of its land's people"], value: "" }],
      }),
      ...p.ways.map(([c, n], i) =>
        stat(i ? `Way ${i + 1}` : "Greatest way", [landLink(world, c), `: ${count(n)} a year`]),
      ),
    ],
  };
}

/** The pilgrimages that come to a land, for its page (none: nothing). */
export function landPilgrimRows(world: World, cell: number): Stat[] {
  const out: Stat[] = [];
  for (const p of pilgrimsOf(world)?.all() ?? []) {
    if (p.seat !== cell || !p.pilgrims) continue;
    const school = p.of.startsWith("idea:"),
      name = school ? schoolLink(world, schoolId(p.of)) : link(beliefName(world, p.of), p.of);
    out.push(
      stat(
        "Pilgrims a year",
        [`${count(p.pilgrims)}, ${school ? "those taught by" : "the faithful of"} `, name],
        {
          why: p.event,
        },
      ),
    );
  }
  return out;
}
function beliefName(world: World, ref: string): string {
  return (
    (world.hasStore("belief.faiths") ? beliefOf(world).get(ref as Ref)?.name : undefined) ??
    "a faith"
  );
}
